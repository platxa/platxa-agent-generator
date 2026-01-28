import { describe, it, expect } from "vitest";
import {
  DEFAULT_OPTIMIZER_CONFIG,
  DEFAULT_OPTIMIZATION_RULES,
  createOptimizerState,
  needsOptimization,
  selectRules,
  applyRules,
  recordFeedback,
  getLatestScore,
  getImprovement,
  getAttemptCount,
  getAllOptimizations,
  wasSuccessful,
} from "@/lib/agent-bridge/prompt-optimizer";
import type { QualityFeedback, QualityIssue } from "@/lib/agent-bridge/prompt-optimizer";

const now = 1000000;

function makeFeedback(score: number, issues: QualityIssue[] = [], acceptable = score >= 70): QualityFeedback {
  return { score, issues, acceptable };
}

function makeIssue(type: QualityIssue["type"], severity: QualityIssue["severity"] = "medium"): QualityIssue {
  return { type, description: `${type} issue`, severity };
}

describe("Prompt Optimizer", () => {
  describe("DEFAULT_OPTIMIZER_CONFIG", () => {
    it("has expected defaults", () => {
      expect(DEFAULT_OPTIMIZER_CONFIG.qualityThreshold).toBe(70);
      expect(DEFAULT_OPTIMIZER_CONFIG.maxAttempts).toBe(3);
      expect(DEFAULT_OPTIMIZER_CONFIG.rules.length).toBeGreaterThan(0);
    });
  });

  describe("DEFAULT_OPTIMIZATION_RULES", () => {
    it("covers all issue types", () => {
      const types = DEFAULT_OPTIMIZATION_RULES.map((r) => r.issueType);
      expect(types).toContain("too_short");
      expect(types).toContain("missing_sections");
      expect(types).toContain("invalid_html");
      expect(types).toContain("accessibility_issues");
    });
  });

  describe("createOptimizerState", () => {
    it("creates state with original prompt", () => {
      const state = createOptimizerState("Generate a homepage");
      expect(state.originalPrompt).toBe("Generate a homepage");
      expect(state.currentPrompt).toBe("Generate a homepage");
      expect(state.attempts).toHaveLength(0);
      expect(state.complete).toBe(false);
    });

    it("accepts custom config", () => {
      const state = createOptimizerState("test", { qualityThreshold: 80 });
      expect(state.config.qualityThreshold).toBe(80);
    });
  });

  describe("needsOptimization", () => {
    it("returns true when score below threshold", () => {
      const state = createOptimizerState("test");
      expect(needsOptimization(state, makeFeedback(50))).toBe(true);
    });

    it("returns false when score meets threshold", () => {
      const state = createOptimizerState("test");
      expect(needsOptimization(state, makeFeedback(85))).toBe(false);
    });

    it("returns false when max attempts reached", () => {
      let state = createOptimizerState("test", { maxAttempts: 1 });
      state = recordFeedback(state, makeFeedback(40, [makeIssue("too_short")]), now);
      expect(needsOptimization(state, makeFeedback(50))).toBe(false);
    });

    it("returns false when complete", () => {
      let state = createOptimizerState("test");
      state = recordFeedback(state, makeFeedback(90), now);
      expect(needsOptimization(state, makeFeedback(40))).toBe(false);
    });
  });

  describe("selectRules", () => {
    it("selects rules matching issues", () => {
      const issues = [makeIssue("too_short"), makeIssue("missing_brand")];
      const rules = selectRules(DEFAULT_OPTIMIZER_CONFIG, issues);
      expect(rules.length).toBe(2);
      expect(rules.map((r) => r.issueType)).toContain("too_short");
      expect(rules.map((r) => r.issueType)).toContain("missing_brand");
    });

    it("returns empty for no matching issues", () => {
      const rules = selectRules(DEFAULT_OPTIMIZER_CONFIG, []);
      expect(rules).toHaveLength(0);
    });

    it("sorts by priority descending", () => {
      const issues = [makeIssue("too_short"), makeIssue("invalid_html")];
      const rules = selectRules(DEFAULT_OPTIMIZER_CONFIG, issues);
      expect(rules[0].priority).toBeGreaterThanOrEqual(rules[1].priority);
    });
  });

  describe("applyRules", () => {
    it("prepends and appends instructions", () => {
      const rules = selectRules(DEFAULT_OPTIMIZER_CONFIG, [
        makeIssue("invalid_html"),  // prepend
        makeIssue("too_short"),     // append
      ]);
      const { optimizedPrompt, appliedNames } = applyRules("Generate a page", rules);
      expect(optimizedPrompt).toContain("IMPORTANT REQUIREMENTS");
      expect(optimizedPrompt).toContain("Generate a page");
      expect(optimizedPrompt).toContain("ADDITIONAL GUIDELINES");
      expect(appliedNames).toContain("invalid_html");
      expect(appliedNames).toContain("too_short");
    });

    it("returns original prompt with no rules", () => {
      const { optimizedPrompt } = applyRules("test prompt", []);
      expect(optimizedPrompt).toBe("test prompt");
    });
  });

  describe("recordFeedback", () => {
    it("records attempt and marks complete on good score", () => {
      const state = recordFeedback(
        createOptimizerState("Generate homepage"),
        makeFeedback(85),
        now,
      );
      expect(state.attempts).toHaveLength(1);
      expect(state.complete).toBe(true);
    });

    it("optimizes prompt on low score with issues", () => {
      const state = recordFeedback(
        createOptimizerState("Generate homepage"),
        makeFeedback(40, [makeIssue("too_short"), makeIssue("missing_brand")]),
        now,
      );
      expect(state.attempts).toHaveLength(1);
      expect(state.complete).toBe(false);
      expect(state.currentPrompt).not.toBe("Generate homepage");
      expect(state.currentPrompt).toContain("Generate homepage");
      expect(state.currentPrompt.length).toBeGreaterThan("Generate homepage".length);
    });

    it("records optimizations applied", () => {
      const state = recordFeedback(
        createOptimizerState("test"),
        makeFeedback(30, [makeIssue("poor_structure")]),
        now,
      );
      expect(state.attempts[0].optimizations).toContain("poor_structure");
    });

    it("marks complete when no rules match issues", () => {
      const config = { ...DEFAULT_OPTIMIZER_CONFIG, rules: [] };
      const state = recordFeedback(
        createOptimizerState("test", config),
        makeFeedback(30, [makeIssue("too_short")]),
        now,
      );
      expect(state.complete).toBe(true);
    });

    it("does not mutate input state", () => {
      const original = createOptimizerState("test");
      recordFeedback(original, makeFeedback(40, [makeIssue("too_short")]));
      expect(original.attempts).toHaveLength(0);
    });

    it("second attempt shows improvement scenario", () => {
      let state = createOptimizerState("Generate homepage");

      // First attempt: low quality
      state = recordFeedback(
        state,
        makeFeedback(40, [makeIssue("too_short"), makeIssue("missing_sections")]),
        now,
      );
      expect(state.complete).toBe(false);
      expect(state.currentPrompt).toContain("IMPORTANT REQUIREMENTS");

      // Second attempt with improved score
      state = recordFeedback(state, makeFeedback(80), now + 1000);
      expect(state.complete).toBe(true);
      expect(getImprovement(state)).toBe(40);
    });
  });

  describe("queries", () => {
    it("getLatestScore returns last score", () => {
      let state = createOptimizerState("test");
      expect(getLatestScore(state)).toBe(0);
      state = recordFeedback(state, makeFeedback(55, [makeIssue("too_short")]), now);
      expect(getLatestScore(state)).toBe(55);
    });

    it("getImprovement returns score delta", () => {
      let state = createOptimizerState("test");
      state = recordFeedback(state, makeFeedback(40, [makeIssue("too_short")]), now);
      state = recordFeedback(state, makeFeedback(85), now + 1000);
      expect(getImprovement(state)).toBe(45);
    });

    it("getImprovement returns 0 for single attempt", () => {
      let state = createOptimizerState("test");
      state = recordFeedback(state, makeFeedback(80), now);
      expect(getImprovement(state)).toBe(0);
    });

    it("getAttemptCount tracks attempts", () => {
      let state = createOptimizerState("test");
      expect(getAttemptCount(state)).toBe(0);
      state = recordFeedback(state, makeFeedback(40, [makeIssue("too_short")]), now);
      expect(getAttemptCount(state)).toBe(1);
    });

    it("getAllOptimizations returns unique set", () => {
      let state = createOptimizerState("test");
      state = recordFeedback(state, makeFeedback(30, [makeIssue("too_short"), makeIssue("missing_brand")]), now);
      state = recordFeedback(state, makeFeedback(50, [makeIssue("too_short"), makeIssue("poor_structure")]), now);
      const opts = getAllOptimizations(state);
      expect(opts).toContain("too_short");
      expect(opts).toContain("missing_brand");
    });

    it("wasSuccessful returns true when threshold met", () => {
      let state = createOptimizerState("test");
      state = recordFeedback(state, makeFeedback(40, [makeIssue("too_short")]), now);
      expect(wasSuccessful(state)).toBe(false);
      state = recordFeedback(state, makeFeedback(80), now + 1000);
      expect(wasSuccessful(state)).toBe(true);
    });

    it("wasSuccessful returns false for empty state", () => {
      expect(wasSuccessful(createOptimizerState("test"))).toBe(false);
    });
  });
});
