/**
 * Tests for Tool Indicator
 *
 * Feature #97: Add current tool indicator showing active operation
 * Verification: Badge shows current tool name with spinning icon
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  ToolIndicator,
  createToolIndicator,
  TOOL_DEFINITIONS,
  CATEGORY_STYLES,
  getToolDefinition,
  formatDuration,
  truncateTarget,
  getCategoryStyle,
  type ToolOperation,
  type ToolCategory,
} from "../../lib/preview/tool-indicator";

describe("ToolIndicator", () => {
  let indicator: ToolIndicator;

  beforeEach(() => {
    indicator = new ToolIndicator();
  });

  afterEach(() => {
    indicator.dispose();
  });

  describe("constructor", () => {
    it("should create instance with default state", () => {
      const state = indicator.getState();

      expect(state.activeTool).toBeNull();
      expect(state.history).toEqual([]);
      expect(state.visible).toBe(true);
      expect(state.minimized).toBe(false);
    });

    it("should accept custom options", () => {
      const custom = new ToolIndicator({
        maxHistory: 5,
        startMinimized: true,
      });
      const state = custom.getState();

      expect(state.minimized).toBe(true);
      custom.dispose();
    });
  });

  describe("start", () => {
    it("should start a tool operation", () => {
      indicator.start("searching", "*.ts files");

      expect(indicator.isActive()).toBe(true);
      expect(indicator.getCurrentOperation()).toBe("searching");

      const tool = indicator.getActiveTool();
      expect(tool?.tool.operation).toBe("searching");
      expect(tool?.target).toBe("*.ts files");
      expect(tool?.startedAt).toBeLessThanOrEqual(Date.now());
    });

    it("should complete previous operation when starting new one", () => {
      indicator.start("searching");
      indicator.start("reading");

      expect(indicator.getCurrentOperation()).toBe("reading");
      expect(indicator.getHistory()).toHaveLength(1);
      expect(indicator.getHistory()[0].operation).toBe("searching");
    });

    it("should make indicator visible", () => {
      indicator.hide();
      indicator.start("searching");

      expect(indicator.getState().visible).toBe(true);
    });

    it("should trigger onChange callback", () => {
      const callback = vi.fn();
      indicator.onChange(callback);

      indicator.start("searching");

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].activeTool).not.toBeNull();
    });
  });

  describe("setProgress", () => {
    it("should update progress", () => {
      indicator.start("generating");
      indicator.setProgress(50);

      expect(indicator.getActiveTool()?.progress).toBe(50);
    });

    it("should clamp progress to 0-100", () => {
      indicator.start("generating");

      indicator.setProgress(-10);
      expect(indicator.getActiveTool()?.progress).toBe(0);

      indicator.setProgress(150);
      expect(indicator.getActiveTool()?.progress).toBe(100);
    });

    it("should do nothing if no active tool", () => {
      expect(() => indicator.setProgress(50)).not.toThrow();
    });
  });

  describe("setDetails", () => {
    it("should update details", () => {
      indicator.start("compiling");
      indicator.setDetails("Processing file 5 of 10");

      expect(indicator.getActiveTool()?.details).toBe("Processing file 5 of 10");
    });
  });

  describe("setTarget", () => {
    it("should update target", () => {
      indicator.start("reading");
      indicator.setTarget("new-file.ts");

      expect(indicator.getActiveTool()?.target).toBe("new-file.ts");
    });
  });

  describe("complete", () => {
    it("should complete operation and add to history", () => {
      indicator.start("searching", "query");
      indicator.complete(true);

      expect(indicator.isActive()).toBe(false);
      expect(indicator.getHistory()).toHaveLength(1);

      const entry = indicator.getHistory()[0];
      expect(entry.operation).toBe("searching");
      expect(entry.target).toBe("query");
      expect(entry.success).toBe(true);
      expect(entry.duration).toBeGreaterThanOrEqual(0);
    });

    it("should record failed operations", () => {
      indicator.start("validating");
      indicator.complete(false);

      expect(indicator.getHistory()[0].success).toBe(false);
    });

    it("should limit history size", () => {
      const custom = new ToolIndicator({ maxHistory: 3 });

      for (let i = 0; i < 5; i++) {
        custom.start("reading", `file${i}`);
        custom.complete(true);
      }

      expect(custom.getHistory()).toHaveLength(3);
      expect(custom.getHistory()[0].target).toBe("file4"); // Most recent
      custom.dispose();
    });

    it("should trigger onComplete callback", () => {
      const callback = vi.fn();
      indicator.onComplete(callback);

      indicator.start("searching");
      indicator.complete(true);

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].operation).toBe("searching");
    });

    it("should do nothing if no active tool", () => {
      expect(() => indicator.complete(true)).not.toThrow();
      expect(indicator.getHistory()).toHaveLength(0);
    });
  });

  describe("cancel", () => {
    it("should cancel without adding to history", () => {
      indicator.start("searching");
      indicator.cancel();

      expect(indicator.isActive()).toBe(false);
      expect(indicator.getHistory()).toHaveLength(0);
    });
  });

  describe("reset", () => {
    it("should reset to initial state", () => {
      indicator.start("searching");
      indicator.hide();
      indicator.reset();

      expect(indicator.isActive()).toBe(false);
      expect(indicator.getState().visible).toBe(true);
    });
  });

  describe("visibility", () => {
    it("should show indicator", () => {
      indicator.hide();
      indicator.show();

      expect(indicator.getState().visible).toBe(true);
    });

    it("should hide indicator", () => {
      indicator.hide();

      expect(indicator.getState().visible).toBe(false);
    });

    it("should toggle minimized", () => {
      expect(indicator.getState().minimized).toBe(false);

      indicator.toggleMinimized();
      expect(indicator.getState().minimized).toBe(true);

      indicator.toggleMinimized();
      expect(indicator.getState().minimized).toBe(false);
    });

    it("should set minimized", () => {
      indicator.setMinimized(true);
      expect(indicator.getState().minimized).toBe(true);

      indicator.setMinimized(false);
      expect(indicator.getState().minimized).toBe(false);
    });
  });

  describe("getCurrentOperation", () => {
    it("should return idle when no active tool", () => {
      expect(indicator.getCurrentOperation()).toBe("idle");
    });

    it("should return current operation", () => {
      indicator.start("compiling");
      expect(indicator.getCurrentOperation()).toBe("compiling");
    });
  });

  describe("getBadgeConfig", () => {
    it("should return idle badge when no active tool", () => {
      const badge = indicator.getBadgeConfig();

      expect(badge).not.toBeNull();
      expect(badge?.label).toBe("Ready");
      expect(badge?.animated).toBe(false);
    });

    it("should return active tool badge", () => {
      indicator.start("searching", "*.ts");
      const badge = indicator.getBadgeConfig();

      expect(badge?.label).toBe("Searching...");
      expect(badge?.icon).toBe("search");
      expect(badge?.animated).toBe(true);
      expect(badge?.target).toBe("*.ts");
      expect(badge?.category).toBe("file");
    });

    it("should use short label when minimized", () => {
      indicator.start("searching");
      indicator.setMinimized(true);

      const badge = indicator.getBadgeConfig();
      expect(badge?.label).toBe("Search");
    });

    it("should include progress when available", () => {
      indicator.start("generating");
      indicator.setProgress(75);

      const badge = indicator.getBadgeConfig();
      expect(badge?.progress).toBe(75);
    });

    it("should format duration", () => {
      indicator.start("compiling");

      // Wait a bit
      const badge = indicator.getBadgeConfig();
      expect(badge?.duration).toMatch(/\d+ms/);
    });

    it("should truncate long targets", () => {
      const longPath = "/very/long/path/to/some/deeply/nested/file.ts";
      indicator.start("reading", longPath);

      const badge = indicator.getBadgeConfig();
      expect(badge?.target?.length).toBeLessThanOrEqual(33); // 30 + "..."
    });

    it("should include aria label", () => {
      indicator.start("searching", "query");
      const badge = indicator.getBadgeConfig();

      expect(badge?.ariaLabel).toContain("Searching");
      expect(badge?.ariaLabel).toContain("query");
    });
  });

  describe("callbacks", () => {
    it("should support multiple onChange callbacks", () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      indicator.onChange(cb1);
      indicator.onChange(cb2);

      indicator.start("searching");

      expect(cb1).toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
    });

    it("should return unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = indicator.onChange(callback);

      indicator.start("reading");
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      indicator.start("writing");
      expect(callback).toHaveBeenCalledTimes(1); // Not called again
    });

    it("should handle callback errors gracefully", () => {
      const errorCb = vi.fn(() => {
        throw new Error("Callback error");
      });
      const normalCb = vi.fn();

      indicator.onChange(errorCb);
      indicator.onChange(normalCb);

      expect(() => indicator.start("searching")).not.toThrow();
      expect(normalCb).toHaveBeenCalled();
    });
  });

  describe("dispose", () => {
    it("should prevent further updates", () => {
      const callback = vi.fn();
      indicator.onChange(callback);

      indicator.dispose();
      indicator.start("searching");

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

describe("createToolIndicator", () => {
  it("should create instance with factory function", () => {
    const instance = createToolIndicator({ maxHistory: 5 });

    expect(instance).toBeInstanceOf(ToolIndicator);
    instance.dispose();
  });
});

describe("utility functions", () => {
  describe("getToolDefinition", () => {
    it("should return tool definition", () => {
      const def = getToolDefinition("searching");

      expect(def.operation).toBe("searching");
      expect(def.label).toBe("Searching...");
      expect(def.icon).toBe("search");
      expect(def.animated).toBe(true);
    });

    it("should return idle definition", () => {
      const def = getToolDefinition("idle");

      expect(def.animated).toBe(false);
      expect(def.label).toBe("Ready");
    });
  });

  describe("formatDuration", () => {
    it("should format milliseconds", () => {
      expect(formatDuration(500)).toBe("500ms");
      expect(formatDuration(0)).toBe("0ms");
    });

    it("should format seconds", () => {
      expect(formatDuration(1500)).toBe("1.5s");
      expect(formatDuration(30000)).toBe("30.0s");
    });

    it("should format minutes", () => {
      expect(formatDuration(90000)).toBe("1m 30s");
      expect(formatDuration(120000)).toBe("2m 0s");
    });
  });

  describe("truncateTarget", () => {
    it("should not truncate short strings", () => {
      expect(truncateTarget("short.ts")).toBe("short.ts");
    });

    it("should truncate long strings at end", () => {
      const long = "this is a very long string that needs truncation";
      const result = truncateTarget(long, 20);

      expect(result.length).toBe(20);
      expect(result.endsWith("...")).toBe(true);
    });

    it("should truncate file paths from start", () => {
      const path = "/very/long/path/to/some/file.ts";
      const result = truncateTarget(path, 20);

      expect(result.startsWith("...")).toBe(true);
      expect(result).toContain("file.ts");
    });

    it("should use custom max length", () => {
      const result = truncateTarget("1234567890", 5);
      expect(result.length).toBe(5);
    });
  });

  describe("getCategoryStyle", () => {
    it("should return style for each category", () => {
      const categories: ToolCategory[] = [
        "file",
        "code",
        "preview",
        "ai",
        "network",
        "system",
      ];

      for (const cat of categories) {
        const style = getCategoryStyle(cat);
        expect(style).toBeTruthy();
        expect(typeof style).toBe("string");
      }
    });
  });
});

describe("constants", () => {
  describe("TOOL_DEFINITIONS", () => {
    it("should have all operation types", () => {
      const operations: ToolOperation[] = [
        "idle",
        "searching",
        "reading",
        "writing",
        "editing",
        "compiling",
        "validating",
        "previewing",
        "generating",
        "analyzing",
        "fixing",
        "deploying",
        "testing",
        "indexing",
        "connecting",
        "syncing",
        "processing",
      ];

      for (const op of operations) {
        expect(TOOL_DEFINITIONS[op]).toBeDefined();
        expect(TOOL_DEFINITIONS[op].operation).toBe(op);
        expect(TOOL_DEFINITIONS[op].label).toBeTruthy();
        expect(TOOL_DEFINITIONS[op].icon).toBeTruthy();
      }
    });

    it("should have animated flag for active operations", () => {
      expect(TOOL_DEFINITIONS.idle.animated).toBe(false);
      expect(TOOL_DEFINITIONS.searching.animated).toBe(true);
      expect(TOOL_DEFINITIONS.generating.animated).toBe(true);
    });
  });

  describe("CATEGORY_STYLES", () => {
    it("should have styles for all categories", () => {
      const categories: ToolCategory[] = [
        "file",
        "code",
        "preview",
        "ai",
        "network",
        "system",
      ];

      for (const cat of categories) {
        expect(CATEGORY_STYLES[cat]).toBeTruthy();
        expect(CATEGORY_STYLES[cat]).toContain("text-");
        expect(CATEGORY_STYLES[cat]).toContain("bg-");
      }
    });
  });
});
