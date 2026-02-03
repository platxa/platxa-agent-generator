// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AICursorManager,
  createAICursorManager,
  createAICursorManagerWithAdapter,
  createMockCursorAdapter,
  createPosition,
  createRange,
  positionsEqual,
  rangesEqual,
  positionInRange,
  positionDistance,
  clonePosition,
  cloneRange,
  generateCursorCSS,
  getDefaultAICursorColor,
  createCursorStyle,
  type CursorPosition,
  type CursorRange,
  type AICursorState,
  type CursorStyle,
  type CursorEvent,
  type CursorEditorAdapter,
} from "@/lib/preview/ai-awareness-cursor";

describe("AICursorManager", () => {
  describe("editor shows AI cursor at agent's edit position (Feature #168)", () => {
    it("shows AI cursor at specified position", () => {
      // Feature #168: Editor shows AI cursor at agent's edit position
      const adapter = createMockCursorAdapter();
      const manager = createAICursorManagerWithAdapter(adapter);

      manager.showAt("/path/to/file.ts", 10, 5);

      const state = manager.getState();
      expect(state).not.toBeNull();
      expect(state!.position.line).toBe(10);
      expect(state!.position.column).toBe(5);
      expect(state!.visible).toBe(true);
    });

    it("uses distinct color for AI cursor", () => {
      // Feature #168: Distinct color for AI cursor
      const color = getDefaultAICursorColor();

      // AI cursor should be purple/violet - distinct from typical blue user cursor
      expect(color).toBe("#9333ea");
    });

    it("updates cursor position when agent moves", () => {
      // Feature #168: Cursor follows agent's edit position
      const adapter = createMockCursorAdapter();
      const manager = createAICursorManagerWithAdapter(adapter);

      manager.showAt("/path/to/file.ts", 1, 1);
      manager.moveTo(25, 10);

      const state = manager.getState();
      expect(state!.position.line).toBe(25);
      expect(state!.position.column).toBe(10);
    });

    it("creates decoration in editor adapter", () => {
      // Feature #168: Editor shows AI cursor
      const adapter = createMockCursorAdapter();
      const manager = createAICursorManagerWithAdapter(adapter);

      manager.showAt("/path/to/file.ts", 5, 1);

      const cursors = adapter.getCursors();
      expect(cursors.length).toBe(1);
      expect(cursors[0].active).toBe(true);
      expect(cursors[0].position.line).toBe(5);
    });

    it("emits events on cursor movement", () => {
      // Feature #168: Track agent's current edit position
      const adapter = createMockCursorAdapter();
      const manager = createAICursorManagerWithAdapter(adapter);
      const events: CursorEvent[] = [];
      manager.onEvent((e) => events.push(e));

      manager.showAt("/path/to/file.ts", 1, 1);
      manager.moveTo(5, 10);

      expect(events.length).toBe(2);
      expect(events[0].type).toBe("cursor:show");
      expect(events[1].type).toBe("cursor:move");
      expect(events[1].cursor.position.line).toBe(5);
    });
  });

  describe("createPosition", () => {
    it("creates position with valid values", () => {
      const pos = createPosition(10, 5);

      expect(pos.line).toBe(10);
      expect(pos.column).toBe(5);
    });

    it("clamps line to minimum 1", () => {
      const pos = createPosition(0, 5);

      expect(pos.line).toBe(1);
    });

    it("clamps column to minimum 1", () => {
      const pos = createPosition(10, 0);

      expect(pos.column).toBe(1);
    });

    it("handles negative values", () => {
      const pos = createPosition(-5, -3);

      expect(pos.line).toBe(1);
      expect(pos.column).toBe(1);
    });
  });

  describe("createRange", () => {
    it("creates range with valid values", () => {
      const range = createRange(1, 1, 10, 20);

      expect(range.start.line).toBe(1);
      expect(range.start.column).toBe(1);
      expect(range.end.line).toBe(10);
      expect(range.end.column).toBe(20);
    });
  });

  describe("positionsEqual", () => {
    it("returns true for equal positions", () => {
      const a = createPosition(10, 5);
      const b = createPosition(10, 5);

      expect(positionsEqual(a, b)).toBe(true);
    });

    it("returns false for different lines", () => {
      const a = createPosition(10, 5);
      const b = createPosition(11, 5);

      expect(positionsEqual(a, b)).toBe(false);
    });

    it("returns false for different columns", () => {
      const a = createPosition(10, 5);
      const b = createPosition(10, 6);

      expect(positionsEqual(a, b)).toBe(false);
    });
  });

  describe("rangesEqual", () => {
    it("returns true for equal ranges", () => {
      const a = createRange(1, 1, 10, 20);
      const b = createRange(1, 1, 10, 20);

      expect(rangesEqual(a, b)).toBe(true);
    });

    it("returns false for different start", () => {
      const a = createRange(1, 1, 10, 20);
      const b = createRange(2, 1, 10, 20);

      expect(rangesEqual(a, b)).toBe(false);
    });

    it("returns false for different end", () => {
      const a = createRange(1, 1, 10, 20);
      const b = createRange(1, 1, 10, 21);

      expect(rangesEqual(a, b)).toBe(false);
    });
  });

  describe("positionInRange", () => {
    it("returns true for position inside range", () => {
      const pos = createPosition(5, 10);
      const range = createRange(1, 1, 10, 20);

      expect(positionInRange(pos, range)).toBe(true);
    });

    it("returns true for position at range start", () => {
      const pos = createPosition(1, 1);
      const range = createRange(1, 1, 10, 20);

      expect(positionInRange(pos, range)).toBe(true);
    });

    it("returns true for position at range end", () => {
      const pos = createPosition(10, 20);
      const range = createRange(1, 1, 10, 20);

      expect(positionInRange(pos, range)).toBe(true);
    });

    it("returns false for position before range", () => {
      const pos = createPosition(1, 1);
      const range = createRange(5, 1, 10, 20);

      expect(positionInRange(pos, range)).toBe(false);
    });

    it("returns false for position after range", () => {
      const pos = createPosition(15, 1);
      const range = createRange(1, 1, 10, 20);

      expect(positionInRange(pos, range)).toBe(false);
    });

    it("returns false for position on start line but before start column", () => {
      const pos = createPosition(1, 1);
      const range = createRange(1, 5, 10, 20);

      expect(positionInRange(pos, range)).toBe(false);
    });

    it("returns false for position on end line but after end column", () => {
      const pos = createPosition(10, 25);
      const range = createRange(1, 1, 10, 20);

      expect(positionInRange(pos, range)).toBe(false);
    });
  });

  describe("positionDistance", () => {
    it("returns 0 for same position", () => {
      const a = createPosition(10, 5);
      const b = createPosition(10, 5);

      expect(positionDistance(a, b)).toBe(0);
    });

    it("calculates distance for same line", () => {
      const a = createPosition(10, 5);
      const b = createPosition(10, 15);

      expect(positionDistance(a, b)).toBe(10);
    });

    it("calculates distance for different lines", () => {
      const a = createPosition(1, 1);
      const b = createPosition(3, 1);

      // 2 lines * 80 chars = 160
      expect(positionDistance(a, b)).toBe(160);
    });
  });

  describe("clonePosition", () => {
    it("creates independent copy", () => {
      const original = createPosition(10, 5);
      const cloned = clonePosition(original);

      expect(cloned.line).toBe(10);
      expect(cloned.column).toBe(5);
      expect(cloned).not.toBe(original);
    });
  });

  describe("cloneRange", () => {
    it("creates independent copy", () => {
      const original = createRange(1, 1, 10, 20);
      const cloned = cloneRange(original);

      expect(cloned.start.line).toBe(1);
      expect(cloned.end.line).toBe(10);
      expect(cloned).not.toBe(original);
      expect(cloned.start).not.toBe(original.start);
    });
  });

  describe("createMockCursorAdapter", () => {
    it("creates adapter with default options", () => {
      const adapter = createMockCursorAdapter();

      expect(adapter.type).toBe("monaco");
      expect(adapter.isReady()).toBe(true);
    });

    it("adds cursor decoration", () => {
      const adapter = createMockCursorAdapter();
      const state: AICursorState = {
        position: createPosition(10, 5),
        filePath: "/test.ts",
        visible: true,
        lastUpdate: Date.now(),
      };
      const style = createCursorStyle({});

      const decoration = adapter.addCursor(state, style);

      expect(decoration.id).toBeTruthy();
      expect(decoration.active).toBe(true);
      expect(adapter.getCursors().length).toBe(1);
    });

    it("updates cursor position", () => {
      const adapter = createMockCursorAdapter();
      const state: AICursorState = {
        position: createPosition(1, 1),
        filePath: "/test.ts",
        visible: true,
        lastUpdate: Date.now(),
      };
      const decoration = adapter.addCursor(state, createCursorStyle({}));

      const updated = adapter.updateCursor(decoration.id, createPosition(5, 10));

      expect(updated).toBe(true);
      expect(adapter.getCursors()[0].position.line).toBe(5);
    });

    it("removes cursor decoration", () => {
      const adapter = createMockCursorAdapter();
      const state: AICursorState = {
        position: createPosition(1, 1),
        filePath: "/test.ts",
        visible: true,
        lastUpdate: Date.now(),
      };
      const decoration = adapter.addCursor(state, createCursorStyle({}));

      const removed = adapter.removeCursor(decoration.id);

      expect(removed).toBe(true);
      expect(adapter.getCursors().length).toBe(0);
    });

    it("clears all cursors", () => {
      const adapter = createMockCursorAdapter();
      const style = createCursorStyle({});
      adapter.addCursor({ position: createPosition(1, 1), filePath: "/a.ts", visible: true, lastUpdate: Date.now() }, style);
      adapter.addCursor({ position: createPosition(2, 1), filePath: "/b.ts", visible: true, lastUpdate: Date.now() }, style);

      adapter.clearCursors();

      expect(adapter.getCursors().length).toBe(0);
    });

    it("handles failAdd option", () => {
      const adapter = createMockCursorAdapter({ failAdd: true });
      const state: AICursorState = {
        position: createPosition(1, 1),
        filePath: "/test.ts",
        visible: true,
        lastUpdate: Date.now(),
      };

      const decoration = adapter.addCursor(state, createCursorStyle({}));

      expect(decoration.id).toBe("");
      expect(decoration.active).toBe(false);
    });

    it("handles failUpdate option", () => {
      const adapter = createMockCursorAdapter({ failUpdate: true });
      const state: AICursorState = {
        position: createPosition(1, 1),
        filePath: "/test.ts",
        visible: true,
        lastUpdate: Date.now(),
      };
      const decoration = adapter.addCursor(state, createCursorStyle({}));

      const updated = adapter.updateCursor(decoration.id, createPosition(5, 10));

      expect(updated).toBe(false);
    });
  });

  describe("AICursorManager class", () => {
    let manager: AICursorManager;
    let adapter: CursorEditorAdapter;

    beforeEach(() => {
      adapter = createMockCursorAdapter();
      manager = createAICursorManagerWithAdapter(adapter);
    });

    describe("showAt", () => {
      it("creates cursor at specified position", () => {
        manager.showAt("/test.ts", 10, 5);

        const state = manager.getState();
        expect(state).not.toBeNull();
        expect(state!.position.line).toBe(10);
        expect(state!.position.column).toBe(5);
        expect(state!.filePath).toBe("/test.ts");
        expect(state!.visible).toBe(true);
      });

      it("emits cursor:show event", () => {
        const events: CursorEvent[] = [];
        manager.onEvent((e) => events.push(e));

        manager.showAt("/test.ts", 10, 5);

        expect(events.length).toBe(1);
        expect(events[0].type).toBe("cursor:show");
      });

      it("creates decoration in adapter", () => {
        manager.showAt("/test.ts", 10, 5);

        expect(adapter.getCursors().length).toBe(1);
      });
    });

    describe("moveTo", () => {
      it("updates cursor position", () => {
        manager.showAt("/test.ts", 1, 1);
        manager.moveTo(20, 15);

        const pos = manager.getPosition();
        expect(pos!.line).toBe(20);
        expect(pos!.column).toBe(15);
      });

      it("does nothing if no cursor exists", () => {
        manager.moveTo(20, 15);

        expect(manager.getState()).toBeNull();
      });

      it("does not emit if position unchanged", () => {
        manager.showAt("/test.ts", 10, 5);
        const events: CursorEvent[] = [];
        manager.onEvent((e) => events.push(e));

        manager.moveTo(10, 5);

        expect(events.filter((e) => e.type === "cursor:move").length).toBe(0);
      });

      it("emits cursor:move event", () => {
        manager.showAt("/test.ts", 1, 1);
        const events: CursorEvent[] = [];
        manager.onEvent((e) => events.push(e));

        manager.moveTo(5, 10);

        expect(events.some((e) => e.type === "cursor:move")).toBe(true);
      });

      it("clears selection on move", () => {
        manager.showAt("/test.ts", 1, 1);
        manager.selectRange(1, 1, 5, 10);
        manager.moveTo(10, 1);

        expect(manager.getSelection()).toBeNull();
      });
    });

    describe("selectRange", () => {
      it("sets selection range", () => {
        manager.showAt("/test.ts", 1, 1);
        manager.selectRange(5, 1, 10, 20);

        const selection = manager.getSelection();
        expect(selection).not.toBeNull();
        expect(selection!.start.line).toBe(5);
        expect(selection!.end.line).toBe(10);
      });

      it("moves cursor to end of selection", () => {
        manager.showAt("/test.ts", 1, 1);
        manager.selectRange(5, 1, 10, 20);

        const pos = manager.getPosition();
        expect(pos!.line).toBe(10);
        expect(pos!.column).toBe(20);
      });

      it("emits cursor:select event", () => {
        manager.showAt("/test.ts", 1, 1);
        const events: CursorEvent[] = [];
        manager.onEvent((e) => events.push(e));

        manager.selectRange(5, 1, 10, 20);

        expect(events.some((e) => e.type === "cursor:select")).toBe(true);
      });
    });

    describe("show/hide", () => {
      it("shows hidden cursor", () => {
        manager.showAt("/test.ts", 1, 1);
        manager.hide();
        manager.show();

        expect(manager.isVisible()).toBe(true);
      });

      it("hides visible cursor", () => {
        manager.showAt("/test.ts", 1, 1);
        manager.hide();

        expect(manager.isVisible()).toBe(false);
      });

      it("emits cursor:show event", () => {
        manager.showAt("/test.ts", 1, 1);
        manager.hide();
        const events: CursorEvent[] = [];
        manager.onEvent((e) => events.push(e));

        manager.show();

        expect(events.some((e) => e.type === "cursor:show")).toBe(true);
      });

      it("emits cursor:hide event", () => {
        manager.showAt("/test.ts", 1, 1);
        const events: CursorEvent[] = [];
        manager.onEvent((e) => events.push(e));

        manager.hide();

        expect(events.some((e) => e.type === "cursor:hide")).toBe(true);
      });
    });

    describe("clear", () => {
      it("removes cursor state", () => {
        manager.showAt("/test.ts", 1, 1);
        manager.clear();

        expect(manager.getState()).toBeNull();
      });

      it("removes decoration from adapter", () => {
        manager.showAt("/test.ts", 1, 1);
        manager.clear();

        expect(adapter.getCursors().length).toBe(0);
      });

      it("emits cursor:clear event", () => {
        manager.showAt("/test.ts", 1, 1);
        const events: CursorEvent[] = [];
        manager.onEvent((e) => events.push(e));

        manager.clear();

        expect(events.some((e) => e.type === "cursor:clear")).toBe(true);
      });
    });

    describe("getFilePath", () => {
      it("returns file path when cursor exists", () => {
        manager.showAt("/test.ts", 1, 1);

        expect(manager.getFilePath()).toBe("/test.ts");
      });

      it("returns null when no cursor", () => {
        expect(manager.getFilePath()).toBeNull();
      });
    });

    describe("event callbacks", () => {
      it("registers callback", () => {
        const callback = vi.fn();
        manager.onEvent(callback);

        manager.showAt("/test.ts", 1, 1);

        expect(callback).toHaveBeenCalled();
      });

      it("removes callback", () => {
        const callback = vi.fn();
        manager.onEvent(callback);
        manager.offEvent(callback);

        manager.showAt("/test.ts", 1, 1);

        expect(callback).not.toHaveBeenCalled();
      });

      it("handles callback errors gracefully", () => {
        manager.onEvent(() => {
          throw new Error("Callback error");
        });

        // Should not throw
        expect(() => manager.showAt("/test.ts", 1, 1)).not.toThrow();
      });
    });

    describe("style management", () => {
      it("updates cursor style", () => {
        manager.updateStyle({ color: "#ff0000" });

        const style = manager.getStyle();
        expect(style.color).toBe("#ff0000");
      });

      it("recreates decoration with new style", () => {
        manager.showAt("/test.ts", 1, 1);
        const originalDecoration = manager.getDecoration();

        manager.updateStyle({ color: "#ff0000" });

        const newDecoration = manager.getDecoration();
        expect(newDecoration!.id).not.toBe(originalDecoration!.id);
      });
    });

    describe("config management", () => {
      it("updates configuration", () => {
        manager.updateConfig({ autoHideDelay: 5000 });

        const config = manager.getConfig();
        expect(config.autoHideDelay).toBe(5000);
      });

      it("preserves style when updating config", () => {
        const originalStyle = manager.getStyle();
        manager.updateConfig({ autoHideDelay: 5000 });

        const newStyle = manager.getStyle();
        expect(newStyle.color).toBe(originalStyle.color);
      });
    });

    describe("adapter management", () => {
      it("sets new adapter", () => {
        const newAdapter = createMockCursorAdapter({ type: "codemirror" });
        manager.setAdapter(newAdapter);

        expect(manager.getAdapter()).toBe(newAdapter);
      });

      it("cleans up old adapter on change", () => {
        manager.showAt("/test.ts", 1, 1);
        const newAdapter = createMockCursorAdapter();

        manager.setAdapter(newAdapter);

        // Old adapter should have cursor removed
        expect(adapter.getCursors().length).toBe(0);
      });

      it("recreates cursor in new adapter", () => {
        manager.showAt("/test.ts", 1, 1);
        const newAdapter = createMockCursorAdapter();

        manager.setAdapter(newAdapter);

        expect(newAdapter.getCursors().length).toBe(1);
      });
    });

    describe("state snapshots", () => {
      it("returns immutable state snapshot", () => {
        manager.showAt("/test.ts", 10, 5);

        const state1 = manager.getState();
        const state2 = manager.getState();

        expect(state1).not.toBe(state2);
        expect(state1!.position).not.toBe(state2!.position);
      });

      it("returns immutable position snapshot", () => {
        manager.showAt("/test.ts", 10, 5);

        const pos1 = manager.getPosition();
        const pos2 = manager.getPosition();

        expect(pos1).not.toBe(pos2);
      });
    });
  });

  describe("factory functions", () => {
    it("createAICursorManager creates instance", () => {
      const manager = createAICursorManager();

      expect(manager).toBeInstanceOf(AICursorManager);
    });

    it("createAICursorManagerWithAdapter creates instance with adapter", () => {
      const adapter = createMockCursorAdapter();
      const manager = createAICursorManagerWithAdapter(adapter);

      expect(manager.getAdapter()).toBe(adapter);
    });
  });

  describe("generateCursorCSS", () => {
    it("generates CSS with cursor styles", () => {
      const style = createCursorStyle({});
      const css = generateCursorCSS(style);

      expect(css).toContain(".ai-cursor");
      expect(css).toContain("background-color");
      expect(css).toContain(style.color);
    });

    it("includes blink animation for blink type", () => {
      const style = createCursorStyle({ animation: "blink" });
      const css = generateCursorCSS(style);

      expect(css).toContain("ai-cursor-blink");
    });

    it("includes pulse animation for pulse type", () => {
      const style = createCursorStyle({ animation: "pulse" });
      const css = generateCursorCSS(style);

      expect(css).toContain("ai-cursor-pulse");
    });

    it("includes label styles", () => {
      const style = createCursorStyle({});
      const css = generateCursorCSS(style);

      expect(css).toContain(".ai-cursor-label");
    });
  });

  describe("createCursorStyle", () => {
    it("creates style with defaults", () => {
      const style = createCursorStyle({});

      expect(style.color).toBe("#9333ea");
      expect(style.animation).toBe("pulse");
    });

    it("overrides specific properties", () => {
      const style = createCursorStyle({
        color: "#ff0000",
        width: 4,
      });

      expect(style.color).toBe("#ff0000");
      expect(style.width).toBe(4);
      expect(style.animation).toBe("pulse"); // Not overridden
    });

    it("merges label properties", () => {
      const style = createCursorStyle({
        label: { fontSize: 14, show: true, background: '#000', textColor: '#fff' },
      });

      expect(style.label.fontSize).toBe(14);
      expect(style.label.show).toBe(true); // Default preserved
    });
  });

  describe("auto-hide behavior", () => {
    it("schedules auto-hide when delay configured", async () => {
      vi.useFakeTimers();
      const manager = createAICursorManager({ autoHideDelay: 1000 });
      const adapter = createMockCursorAdapter();
      manager.setAdapter(adapter);

      manager.showAt("/test.ts", 1, 1);
      expect(manager.isVisible()).toBe(true);

      vi.advanceTimersByTime(1000);
      expect(manager.isVisible()).toBe(false);

      vi.useRealTimers();
    });

    it("resets auto-hide timer on move", async () => {
      vi.useFakeTimers();
      const manager = createAICursorManager({ autoHideDelay: 1000 });
      const adapter = createMockCursorAdapter();
      manager.setAdapter(adapter);

      manager.showAt("/test.ts", 1, 1);
      vi.advanceTimersByTime(500);

      manager.moveTo(5, 5);
      vi.advanceTimersByTime(500);

      // Should still be visible - timer was reset
      expect(manager.isVisible()).toBe(true);

      vi.advanceTimersByTime(500);
      expect(manager.isVisible()).toBe(false);

      vi.useRealTimers();
    });

    it("does not auto-hide when delay is 0", async () => {
      vi.useFakeTimers();
      const manager = createAICursorManager({ autoHideDelay: 0 });
      const adapter = createMockCursorAdapter();
      manager.setAdapter(adapter);

      manager.showAt("/test.ts", 1, 1);
      vi.advanceTimersByTime(10000);

      expect(manager.isVisible()).toBe(true);

      vi.useRealTimers();
    });
  });
});
