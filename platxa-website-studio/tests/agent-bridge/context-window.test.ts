import { describe, it, expect } from "vitest";
import {
  estimateTokens,
  createBudget,
  computeScore,
  sortByRelevance,
  assembleContext,
  createContextItem,
  createContextWindow,
  addItem,
  removeItem,
  updateRelevance,
  assembleFromState,
  getItemsByCategory,
  getTotalTokens,
  isOverBudget,
} from "@/lib/agent-bridge/context-window";
import type { ContextItem } from "@/lib/agent-bridge/context-window";

function makeItem(id: string, tokens: number, priority: "critical" | "high" | "medium" | "low", relevance: number): ContextItem {
  return {
    id,
    source: `${id}.ts`,
    content: "x".repeat(Math.floor(tokens * 3.5)),
    tokenCount: tokens,
    priority,
    relevance,
    category: "code",
  };
}

describe("Context Window Manager", () => {
  describe("estimateTokens", () => {
    it("returns 0 for empty string", () => {
      expect(estimateTokens("")).toBe(0);
    });

    it("estimates ~1 token per 3.5 chars", () => {
      const tokens = estimateTokens("a".repeat(35));
      expect(tokens).toBe(10);
    });

    it("rounds up", () => {
      expect(estimateTokens("abc")).toBe(1);
    });
  });

  describe("createBudget", () => {
    it("computes effective budget at 80%", () => {
      const budget = createBudget(100000);
      expect(budget.effectiveBudget).toBe(80000);
      expect(budget.maxUsageRatio).toBe(0.8);
    });

    it("subtracts reserves from available", () => {
      const budget = createBudget(100000, 0.8, 500, 2000);
      expect(budget.availableForContext).toBe(80000 - 500 - 2000);
    });

    it("clamps available to 0 minimum", () => {
      const budget = createBudget(100, 0.1, 50, 50);
      // effective = 10, available = 10 - 50 - 50 = -90 → 0
      expect(budget.availableForContext).toBe(0);
    });

    it("accepts custom ratio", () => {
      const budget = createBudget(100000, 0.5);
      expect(budget.effectiveBudget).toBe(50000);
    });
  });

  describe("computeScore", () => {
    it("critical priority with high relevance scores highest", () => {
      const item = makeItem("a", 100, "critical", 1.0);
      expect(computeScore(item)).toBeCloseTo(1.0, 2);
    });

    it("low priority with low relevance scores lowest", () => {
      const item = makeItem("b", 100, "low", 0.0);
      expect(computeScore(item)).toBeCloseTo(0.1, 2);
    });

    it("relevance weighs more than priority (60/40)", () => {
      const highRelLowPri = makeItem("a", 100, "low", 1.0);
      const lowRelHighPri = makeItem("b", 100, "critical", 0.0);
      expect(computeScore(highRelLowPri)).toBeGreaterThan(computeScore(lowRelHighPri));
    });
  });

  describe("sortByRelevance", () => {
    it("sorts by composite score descending", () => {
      const items = [
        makeItem("low", 100, "low", 0.1),
        makeItem("high", 100, "critical", 0.9),
        makeItem("mid", 100, "medium", 0.5),
      ];
      const sorted = sortByRelevance(items);
      expect(sorted[0].id).toBe("high");
      expect(sorted[2].id).toBe("low");
    });

    it("does not mutate original", () => {
      const items = [makeItem("a", 100, "low", 0.1), makeItem("b", 100, "high", 0.9)];
      sortByRelevance(items);
      expect(items[0].id).toBe("a");
    });
  });

  describe("assembleContext", () => {
    it("includes items within budget", () => {
      const budget = createBudget(10000, 1.0, 0, 0); // 10000 available
      const items = [
        makeItem("a", 3000, "high", 0.9),
        makeItem("b", 3000, "medium", 0.5),
        makeItem("c", 3000, "low", 0.3),
      ];
      const result = assembleContext(items, budget);
      expect(result.included).toHaveLength(3);
      expect(result.totalTokens).toBe(9000);
      expect(result.withinBudget).toBe(true);
    });

    it("excludes items that exceed budget", () => {
      const budget = createBudget(5000, 1.0, 0, 0); // 5000 available
      const items = [
        makeItem("a", 3000, "high", 0.9),
        makeItem("b", 3000, "medium", 0.5),
      ];
      const result = assembleContext(items, budget);
      expect(result.included).toHaveLength(1);
      expect(result.excluded).toHaveLength(1);
      expect(result.included[0].id).toBe("a"); // higher score
    });

    it("prioritizes higher-scored items", () => {
      const budget = createBudget(4000, 1.0, 0, 0);
      const items = [
        makeItem("low", 2000, "low", 0.1),
        makeItem("high", 2000, "critical", 1.0),
        makeItem("mid", 2000, "medium", 0.5),
      ];
      const result = assembleContext(items, budget);
      expect(result.included.map((i) => i.id)).toEqual(["high", "mid"]);
    });

    it("computes utilization correctly", () => {
      const budget = createBudget(10000, 1.0, 0, 0);
      const items = [makeItem("a", 5000, "high", 0.9)];
      const result = assembleContext(items, budget);
      expect(result.utilization).toBeCloseTo(0.5, 2);
    });

    it("stays under 80% of model limit by default", () => {
      const budget = createBudget(100000); // 80% → 77500 available
      const items = [makeItem("big", 90000, "critical", 1.0)];
      const result = assembleContext(items, budget);
      expect(result.included).toHaveLength(0); // too big for 77500
      expect(result.excluded).toHaveLength(1);
    });

    it("handles empty items", () => {
      const budget = createBudget(10000);
      const result = assembleContext([], budget);
      expect(result.included).toHaveLength(0);
      expect(result.totalTokens).toBe(0);
      expect(result.withinBudget).toBe(true);
    });
  });

  describe("createContextItem", () => {
    it("creates item with estimated tokens", () => {
      const item = createContextItem("f1", "file.ts", "const x = 1;", "high", 0.8);
      expect(item.tokenCount).toBeGreaterThan(0);
      expect(item.priority).toBe("high");
      expect(item.relevance).toBe(0.8);
      expect(item.category).toBe("code");
    });

    it("accepts custom category", () => {
      const item = createContextItem("d1", "readme.md", "text", "low", 0.3, "docs");
      expect(item.category).toBe("docs");
    });
  });

  describe("state management", () => {
    it("creates window with budget", () => {
      const state = createContextWindow(128000);
      expect(state.items).toHaveLength(0);
      expect(state.budget.modelLimit).toBe(128000);
    });

    it("adds and removes items", () => {
      let state = createContextWindow(100000);
      const item = makeItem("a", 500, "high", 0.9);
      state = addItem(state, item);
      expect(state.items).toHaveLength(1);
      state = removeItem(state, "a");
      expect(state.items).toHaveLength(0);
    });

    it("updates relevance", () => {
      let state = createContextWindow(100000);
      state = addItem(state, makeItem("a", 500, "high", 0.5));
      state = updateRelevance(state, "a", 0.9);
      expect(state.items[0].relevance).toBe(0.9);
    });

    it("assembles from state", () => {
      let state = createContextWindow(10000, 1.0);
      state = { ...state, budget: createBudget(10000, 1.0, 0, 0) };
      state = addItem(state, makeItem("a", 3000, "high", 0.9));
      state = addItem(state, makeItem("b", 3000, "medium", 0.5));
      const assembly = assembleFromState(state);
      expect(assembly.included).toHaveLength(2);
      expect(assembly.withinBudget).toBe(true);
    });

    it("groups items by category", () => {
      let state = createContextWindow(100000);
      state = addItem(state, createContextItem("a", "a.ts", "code", "high", 0.9, "code"));
      state = addItem(state, createContextItem("b", "b.md", "docs", "low", 0.3, "docs"));
      state = addItem(state, createContextItem("c", "c.ts", "more", "medium", 0.5, "code"));
      const groups = getItemsByCategory(state);
      expect(groups.get("code")).toHaveLength(2);
      expect(groups.get("docs")).toHaveLength(1);
    });

    it("computes total tokens", () => {
      let state = createContextWindow(100000);
      state = addItem(state, makeItem("a", 500, "high", 0.9));
      state = addItem(state, makeItem("b", 300, "medium", 0.5));
      expect(getTotalTokens(state)).toBe(800);
    });

    it("detects over-budget", () => {
      let state = createContextWindow(1000, 1.0);
      state = { ...state, budget: createBudget(1000, 1.0, 0, 0) };
      state = addItem(state, makeItem("a", 600, "high", 0.9));
      expect(isOverBudget(state)).toBe(false);
      state = addItem(state, makeItem("b", 600, "high", 0.9));
      expect(isOverBudget(state)).toBe(true);
    });
  });

  describe("immutability", () => {
    it("does not mutate state on addItem", () => {
      const state = createContextWindow(100000);
      const updated = addItem(state, makeItem("a", 500, "high", 0.9));
      expect(state.items).toHaveLength(0);
      expect(updated.items).toHaveLength(1);
    });
  });
});
