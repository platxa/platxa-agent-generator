/**
 * Tests for Tool Usage Indicator
 *
 * Feature #110: Implement tool usage indicators in chat messages
 * Verification: Chips show tools used: 'searched 3 files', 'edited 2 files'
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ToolUsageIndicator,
  createToolUsageIndicator,
  TOOL_LABELS,
  getToolLabel,
  formatCount,
  formatDuration,
  generateChipLabel,
  generateShortLabel,
  truncatePath,
  calculateSuccessRate,
  type ToolType,
  type ToolUsage,
} from "../../lib/preview/tool-usage-indicator";

describe("ToolUsageIndicator", () => {
  let indicator: ToolUsageIndicator;

  beforeEach(() => {
    indicator = new ToolUsageIndicator();
  });

  afterEach(() => {
    indicator.dispose();
  });

  describe("constructor", () => {
    it("should create instance with default options", () => {
      expect(indicator.getMessageIds()).toEqual([]);
      expect(indicator.hasUsages("msg-1")).toBe(false);
    });

    it("should accept custom options", () => {
      const custom = new ToolUsageIndicator({
        minCount: 2,
        maxChips: 3,
        showDuration: true,
      });

      expect(custom).toBeDefined();
      custom.dispose();
    });
  });

  describe("track", () => {
    it("should track a tool usage", () => {
      indicator.track("msg-1", "search", "src/*.ts");

      expect(indicator.hasUsages("msg-1")).toBe(true);
      expect(indicator.getUsages("msg-1")).toHaveLength(1);
    });

    it("should track multiple usages for same message", () => {
      indicator.track("msg-1", "search", "src/*.ts");
      indicator.track("msg-1", "edit", "src/app.ts");
      indicator.track("msg-1", "edit", "src/utils.ts");

      expect(indicator.getUsages("msg-1")).toHaveLength(3);
    });

    it("should track usages with details", () => {
      indicator.track("msg-1", "search", "src/*.ts", {
        duration: 150,
        success: true,
        details: "Found 5 matches",
      });

      const usages = indicator.getUsages("msg-1");
      expect(usages[0].duration).toBe(150);
      expect(usages[0].success).toBe(true);
      expect(usages[0].details).toBe("Found 5 matches");
    });

    it("should trigger callback on track", () => {
      const callback = vi.fn();
      indicator.onChange(callback);

      indicator.track("msg-1", "search", "src/*.ts");

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].messageId).toBe("msg-1");
    });

    it("should not track after disposal", () => {
      indicator.dispose();
      indicator.track("msg-1", "search", "src/*.ts");

      expect(indicator.hasUsages("msg-1")).toBe(false);
    });
  });

  describe("trackBatch", () => {
    it("should track multiple usages at once", () => {
      indicator.trackBatch("msg-1", [
        { type: "search", target: "*.ts" },
        { type: "read", target: "config.json" },
        { type: "edit", target: "app.ts" },
      ]);

      expect(indicator.getUsages("msg-1")).toHaveLength(3);
    });
  });

  describe("complete", () => {
    it("should update last usage with completion status", () => {
      indicator.track("msg-1", "search", "src/*.ts");
      indicator.complete("msg-1", true, 200);

      const usages = indicator.getUsages("msg-1");
      expect(usages[0].success).toBe(true);
      expect(usages[0].duration).toBe(200);
    });

    it("should do nothing for non-existent message", () => {
      expect(() => indicator.complete("nonexistent", true)).not.toThrow();
    });
  });

  describe("aggregate", () => {
    it("should aggregate usages by type", () => {
      indicator.track("msg-1", "search", "file1.ts");
      indicator.track("msg-1", "search", "file2.ts");
      indicator.track("msg-1", "search", "file3.ts");
      indicator.track("msg-1", "edit", "app.ts");
      indicator.track("msg-1", "edit", "utils.ts");

      const aggregated = indicator.aggregate("msg-1");

      expect(aggregated).toHaveLength(2);

      const searchAgg = aggregated.find((a) => a.type === "search");
      expect(searchAgg?.count).toBe(3);
      expect(searchAgg?.label).toBe("searched 3 files");

      const editAgg = aggregated.find((a) => a.type === "edit");
      expect(editAgg?.count).toBe(2);
      expect(editAgg?.label).toBe("edited 2 files");
    });

    it("should sort by count descending", () => {
      indicator.track("msg-1", "edit", "file1.ts");
      indicator.track("msg-1", "search", "file1.ts");
      indicator.track("msg-1", "search", "file2.ts");
      indicator.track("msg-1", "search", "file3.ts");

      const aggregated = indicator.aggregate("msg-1");

      expect(aggregated[0].type).toBe("search");
      expect(aggregated[0].count).toBe(3);
      expect(aggregated[1].type).toBe("edit");
      expect(aggregated[1].count).toBe(1);
    });

    it("should calculate total duration", () => {
      indicator.track("msg-1", "search", "file1.ts", { duration: 100 });
      indicator.track("msg-1", "search", "file2.ts", { duration: 150 });

      const aggregated = indicator.aggregate("msg-1");
      expect(aggregated[0].totalDuration).toBe(250);
    });

    it("should calculate success rate", () => {
      indicator.track("msg-1", "edit", "file1.ts", { success: true });
      indicator.track("msg-1", "edit", "file2.ts", { success: true });
      indicator.track("msg-1", "edit", "file3.ts", { success: false });

      const aggregated = indicator.aggregate("msg-1");
      expect(aggregated[0].successRate).toBeCloseTo(0.667, 2);
    });
  });

  describe("getChips", () => {
    it("should generate chips for rendering", () => {
      indicator.track("msg-1", "search", "file1.ts");
      indicator.track("msg-1", "search", "file2.ts");
      indicator.track("msg-1", "search", "file3.ts");
      indicator.track("msg-1", "edit", "app.ts");
      indicator.track("msg-1", "edit", "utils.ts");

      const chips = indicator.getChips("msg-1");

      expect(chips).toHaveLength(2);

      const searchChip = chips.find((c) => c.type === "search");
      expect(searchChip?.label).toBe("searched 3 files");
      expect(searchChip?.count).toBe(3);
      expect(searchChip?.expandable).toBe(true);

      const editChip = chips.find((c) => c.type === "edit");
      expect(editChip?.label).toBe("edited 2 files");
      expect(editChip?.count).toBe(2);
    });

    it("should respect minCount option", () => {
      const indicator2 = new ToolUsageIndicator({ minCount: 2 });

      indicator2.track("msg-1", "search", "file1.ts");
      indicator2.track("msg-1", "edit", "app.ts");
      indicator2.track("msg-1", "edit", "utils.ts");

      const chips = indicator2.getChips("msg-1");

      expect(chips).toHaveLength(1);
      expect(chips[0].type).toBe("edit");

      indicator2.dispose();
    });

    it("should respect maxChips option", () => {
      const indicator2 = new ToolUsageIndicator({ maxChips: 2 });

      indicator2.track("msg-1", "search", "file1.ts");
      indicator2.track("msg-1", "search", "file2.ts");
      indicator2.track("msg-1", "edit", "app.ts");
      indicator2.track("msg-1", "read", "config.json");
      indicator2.track("msg-1", "write", "output.txt");

      const chips = indicator2.getChips("msg-1");

      expect(chips.length).toBeLessThanOrEqual(2);

      indicator2.dispose();
    });

    it("should include details for expandable chips", () => {
      indicator.track("msg-1", "edit", "src/app.ts");
      indicator.track("msg-1", "edit", "src/utils.ts");

      const chips = indicator.getChips("msg-1");

      expect(chips[0].expandable).toBe(true);
      expect(chips[0].details).toBeDefined();
      expect(chips[0].details).toHaveLength(2);
    });

    it("should not be expandable for single usage", () => {
      indicator.track("msg-1", "search", "file.ts");

      const chips = indicator.getChips("msg-1");

      expect(chips[0].expandable).toBe(false);
      expect(chips[0].details).toBeUndefined();
    });
  });

  describe("getSummary", () => {
    it("should return complete summary", () => {
      indicator.track("msg-1", "search", "file1.ts", { duration: 100, success: true });
      indicator.track("msg-1", "edit", "app.ts", { duration: 200, success: true });

      const summary = indicator.getSummary("msg-1");

      expect(summary.messageId).toBe("msg-1");
      expect(summary.usages).toHaveLength(2);
      expect(summary.aggregated).toHaveLength(2);
      expect(summary.chips).toHaveLength(2);
      expect(summary.totalOperations).toBe(2);
      expect(summary.totalDuration).toBe(300);
      expect(summary.overallSuccessRate).toBe(1);
    });
  });

  describe("getCountByType", () => {
    it("should return count for specific type", () => {
      indicator.track("msg-1", "search", "file1.ts");
      indicator.track("msg-1", "search", "file2.ts");
      indicator.track("msg-1", "edit", "app.ts");

      expect(indicator.getCountByType("msg-1", "search")).toBe(2);
      expect(indicator.getCountByType("msg-1", "edit")).toBe(1);
      expect(indicator.getCountByType("msg-1", "read")).toBe(0);
    });
  });

  describe("clear", () => {
    it("should clear usages for a message", () => {
      indicator.track("msg-1", "search", "file.ts");
      indicator.track("msg-2", "edit", "app.ts");

      indicator.clear("msg-1");

      expect(indicator.hasUsages("msg-1")).toBe(false);
      expect(indicator.hasUsages("msg-2")).toBe(true);
    });
  });

  describe("clearAll", () => {
    it("should clear all usages", () => {
      indicator.track("msg-1", "search", "file.ts");
      indicator.track("msg-2", "edit", "app.ts");

      indicator.clearAll();

      expect(indicator.getMessageIds()).toEqual([]);
    });
  });

  describe("callbacks", () => {
    it("should support multiple callbacks", () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      indicator.onChange(cb1);
      indicator.onChange(cb2);

      indicator.track("msg-1", "search", "file.ts");

      expect(cb1).toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
    });

    it("should return unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = indicator.onChange(callback);

      indicator.track("msg-1", "search", "file.ts");
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      indicator.track("msg-1", "edit", "app.ts");
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should handle callback errors gracefully", () => {
      const errorCb = vi.fn(() => {
        throw new Error("Callback error");
      });
      const normalCb = vi.fn();

      indicator.onChange(errorCb);
      indicator.onChange(normalCb);

      expect(() => indicator.track("msg-1", "search", "file.ts")).not.toThrow();
      expect(normalCb).toHaveBeenCalled();
    });
  });

  describe("dispose", () => {
    it("should prevent further operations", () => {
      const callback = vi.fn();
      indicator.onChange(callback);

      indicator.dispose();
      indicator.track("msg-1", "search", "file.ts");

      expect(callback).not.toHaveBeenCalled();
    });

    it("should be idempotent", () => {
      expect(() => {
        indicator.dispose();
        indicator.dispose();
      }).not.toThrow();
    });
  });
});

describe("createToolUsageIndicator", () => {
  it("should create instance with factory function", () => {
    const ind = createToolUsageIndicator({ maxChips: 3 });

    expect(ind).toBeInstanceOf(ToolUsageIndicator);
    ind.dispose();
  });
});

describe("utility functions", () => {
  describe("getToolLabel", () => {
    it("should return default labels", () => {
      const label = getToolLabel("search");

      expect(label.singular).toBe("file");
      expect(label.plural).toBe("files");
      expect(label.verb).toBe("searched");
      expect(label.icon).toBe("search");
    });

    it("should use custom labels when provided", () => {
      const custom = {
        search: {
          singular: "result",
          plural: "results",
          verb: "found",
          icon: "magnifier",
          className: "custom-class",
        },
      };

      const label = getToolLabel("search", custom);

      expect(label.verb).toBe("found");
      expect(label.singular).toBe("result");
    });
  });

  describe("formatCount", () => {
    it("should format singular", () => {
      expect(formatCount(1, "file", "files")).toBe("1 file");
    });

    it("should format plural", () => {
      expect(formatCount(0, "file", "files")).toBe("0 files");
      expect(formatCount(2, "file", "files")).toBe("2 files");
      expect(formatCount(10, "file", "files")).toBe("10 files");
    });
  });

  describe("formatDuration", () => {
    it("should format milliseconds", () => {
      expect(formatDuration(500)).toBe("500ms");
      expect(formatDuration(999)).toBe("999ms");
    });

    it("should format seconds", () => {
      expect(formatDuration(1000)).toBe("1.0s");
      expect(formatDuration(1500)).toBe("1.5s");
      expect(formatDuration(30000)).toBe("30.0s");
    });

    it("should format minutes", () => {
      expect(formatDuration(60000)).toBe("1m 0s");
      expect(formatDuration(90000)).toBe("1m 30s");
      expect(formatDuration(125000)).toBe("2m 5s");
    });
  });

  describe("generateChipLabel", () => {
    it("should generate correct labels", () => {
      expect(generateChipLabel("search", 1)).toBe("searched 1 file");
      expect(generateChipLabel("search", 3)).toBe("searched 3 files");
      expect(generateChipLabel("edit", 2)).toBe("edited 2 files");
      expect(generateChipLabel("read", 1)).toBe("read 1 file");
    });
  });

  describe("generateShortLabel", () => {
    it("should generate short labels", () => {
      expect(generateShortLabel("search", 1)).toBe("1 file");
      expect(generateShortLabel("search", 3)).toBe("3 files");
    });
  });

  describe("truncatePath", () => {
    it("should not truncate short paths", () => {
      expect(truncatePath("short.ts")).toBe("short.ts");
    });

    it("should truncate long paths", () => {
      const long = "/very/long/path/to/some/deeply/nested/file.ts";
      const result = truncatePath(long, 20);

      expect(result.length).toBeLessThanOrEqual(20);
      expect(result.startsWith("...")).toBe(true);
    });

    it("should preserve filename when possible", () => {
      const result = truncatePath("/path/to/important-file.ts", 25);

      expect(result).toContain("important-file.ts");
    });
  });

  describe("calculateSuccessRate", () => {
    it("should return 1 for empty array", () => {
      expect(calculateSuccessRate([])).toBe(1);
    });

    it("should return 1 for all undefined statuses", () => {
      const usages: ToolUsage[] = [
        { type: "search", target: "file.ts", timestamp: Date.now() },
      ];
      expect(calculateSuccessRate(usages)).toBe(1);
    });

    it("should calculate correct rate", () => {
      const usages: ToolUsage[] = [
        { type: "edit", target: "a.ts", timestamp: Date.now(), success: true },
        { type: "edit", target: "b.ts", timestamp: Date.now(), success: true },
        { type: "edit", target: "c.ts", timestamp: Date.now(), success: false },
      ];
      expect(calculateSuccessRate(usages)).toBeCloseTo(0.667, 2);
    });
  });
});

describe("constants", () => {
  describe("TOOL_LABELS", () => {
    it("should have labels for all tool types", () => {
      const types: ToolType[] = [
        "search", "read", "write", "edit", "delete", "create",
        "compile", "validate", "generate", "analyze", "deploy",
        "test", "fetch", "execute",
      ];

      for (const type of types) {
        expect(TOOL_LABELS[type]).toBeDefined();
        expect(TOOL_LABELS[type].singular).toBeTruthy();
        expect(TOOL_LABELS[type].plural).toBeTruthy();
        expect(TOOL_LABELS[type].verb).toBeTruthy();
        expect(TOOL_LABELS[type].icon).toBeTruthy();
        expect(TOOL_LABELS[type].className).toBeTruthy();
      }
    });
  });
});

describe("chip verification", () => {
  it("should show 'searched 3 files' chip", () => {
    const indicator = createToolUsageIndicator();

    indicator.track("msg-1", "search", "file1.ts");
    indicator.track("msg-1", "search", "file2.ts");
    indicator.track("msg-1", "search", "file3.ts");

    const chips = indicator.getChips("msg-1");
    const searchChip = chips.find((c) => c.type === "search");

    expect(searchChip).toBeDefined();
    expect(searchChip?.label).toBe("searched 3 files");
    expect(searchChip?.count).toBe(3);

    indicator.dispose();
  });

  it("should show 'edited 2 files' chip", () => {
    const indicator = createToolUsageIndicator();

    indicator.track("msg-1", "edit", "src/app.ts");
    indicator.track("msg-1", "edit", "src/utils.ts");

    const chips = indicator.getChips("msg-1");
    const editChip = chips.find((c) => c.type === "edit");

    expect(editChip).toBeDefined();
    expect(editChip?.label).toBe("edited 2 files");
    expect(editChip?.count).toBe(2);

    indicator.dispose();
  });

  it("should show multiple tool chips in a message", () => {
    const indicator = createToolUsageIndicator();

    indicator.track("msg-1", "search", "*.ts");
    indicator.track("msg-1", "search", "*.js");
    indicator.track("msg-1", "search", "*.json");
    indicator.track("msg-1", "edit", "app.ts");
    indicator.track("msg-1", "edit", "utils.ts");
    indicator.track("msg-1", "read", "config.json");

    const chips = indicator.getChips("msg-1");

    expect(chips.length).toBeGreaterThanOrEqual(3);
    expect(chips.some((c) => c.label === "searched 3 files")).toBe(true);
    expect(chips.some((c) => c.label === "edited 2 files")).toBe(true);
    expect(chips.some((c) => c.label === "read 1 file")).toBe(true);

    indicator.dispose();
  });
});
