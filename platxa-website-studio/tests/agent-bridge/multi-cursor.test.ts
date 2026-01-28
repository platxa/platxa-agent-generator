import { describe, it, expect } from "vitest";
import {
  DEFAULT_CURSOR_CONFIG,
  createMultiCursorState,
  addCursor,
  moveCursor,
  setSelection,
  clearSelection,
  removeCursor,
  markInactive,
  getAllCursors,
  getCursorsByOwner,
  getCursorsInFile,
  getActiveCursors,
  hasSimultaneousCursors,
  generateCursorCSS,
} from "@/lib/agent-bridge/multi-cursor";

const now = 1000000;

describe("Multi-Cursor Awareness", () => {
  describe("DEFAULT_CURSOR_CONFIG", () => {
    it("has distinct colors for human and AI", () => {
      expect(DEFAULT_CURSOR_CONFIG.humanColor).toBe("#3b82f6");
      expect(DEFAULT_CURSOR_CONFIG.aiColor).toBe("#f59e0b");
      expect(DEFAULT_CURSOR_CONFIG.humanColor).not.toBe(DEFAULT_CURSOR_CONFIG.aiColor);
    });
  });

  describe("createMultiCursorState", () => {
    it("creates empty state", () => {
      const state = createMultiCursorState();
      expect(state.cursors.size).toBe(0);
      expect(state.counter).toBe(0);
    });

    it("accepts custom config", () => {
      const state = createMultiCursorState({ aiColor: "#ff0000" });
      expect(state.config.aiColor).toBe("#ff0000");
      expect(state.config.humanColor).toBe("#3b82f6");
    });
  });

  describe("addCursor", () => {
    it("adds a human cursor", () => {
      const { state, cursorId } = addCursor(
        createMultiCursorState(), "human", "main.py", { line: 1, column: 1 }, now,
      );
      expect(cursorId).toContain("human");
      expect(state.cursors.size).toBe(1);
      const cursor = state.cursors.get(cursorId)!;
      expect(cursor.owner).toBe("human");
      expect(cursor.label).toBe("You");
      expect(cursor.color).toBe("#3b82f6");
    });

    it("adds an AI cursor with distinct color", () => {
      const { state, cursorId } = addCursor(
        createMultiCursorState(), "ai", "main.py", { line: 5, column: 10 }, now,
      );
      const cursor = state.cursors.get(cursorId)!;
      expect(cursor.owner).toBe("ai");
      expect(cursor.label).toBe("AI");
      expect(cursor.color).toBe("#f59e0b");
    });

    it("assigns unique IDs", () => {
      let state = createMultiCursorState();
      let id1: string, id2: string;
      ({ state, cursorId: id1 } = addCursor(state, "human", "a.py", { line: 1, column: 1 }, now));
      ({ state, cursorId: id2 } = addCursor(state, "ai", "a.py", { line: 2, column: 1 }, now));
      expect(id1).not.toBe(id2);
    });

    it("does not mutate input state", () => {
      const original = createMultiCursorState();
      addCursor(original, "human", "a.py", { line: 1, column: 1 });
      expect(original.cursors.size).toBe(0);
    });
  });

  describe("moveCursor", () => {
    it("updates cursor position", () => {
      let state = createMultiCursorState();
      let id: string;
      ({ state, cursorId: id } = addCursor(state, "human", "a.py", { line: 1, column: 1 }, now));
      state = moveCursor(state, id, { line: 10, column: 5 }, now + 100);
      const cursor = state.cursors.get(id)!;
      expect(cursor.position).toEqual({ line: 10, column: 5 });
      expect(cursor.updatedAt).toBe(now + 100);
    });

    it("clears selection on move", () => {
      let state = createMultiCursorState();
      let id: string;
      ({ state, cursorId: id } = addCursor(state, "human", "a.py", { line: 1, column: 1 }, now));
      state = setSelection(state, id, {
        start: { line: 1, column: 1 },
        end: { line: 3, column: 10 },
      });
      state = moveCursor(state, id, { line: 5, column: 1 });
      expect(state.cursors.get(id)!.selection).toBeNull();
    });

    it("returns same state for unknown cursor", () => {
      const state = createMultiCursorState();
      const result = moveCursor(state, "unknown", { line: 1, column: 1 });
      expect(result).toBe(state);
    });
  });

  describe("setSelection", () => {
    it("sets selection range", () => {
      let state = createMultiCursorState();
      let id: string;
      ({ state, cursorId: id } = addCursor(state, "ai", "a.py", { line: 1, column: 1 }, now));
      const sel = { start: { line: 2, column: 1 }, end: { line: 4, column: 15 } };
      state = setSelection(state, id, sel, now + 50);
      const cursor = state.cursors.get(id)!;
      expect(cursor.selection).toEqual(sel);
      expect(cursor.position).toEqual(sel.end);
    });
  });

  describe("clearSelection", () => {
    it("clears selection", () => {
      let state = createMultiCursorState();
      let id: string;
      ({ state, cursorId: id } = addCursor(state, "human", "a.py", { line: 1, column: 1 }, now));
      state = setSelection(state, id, {
        start: { line: 1, column: 1 },
        end: { line: 2, column: 5 },
      });
      state = clearSelection(state, id);
      expect(state.cursors.get(id)!.selection).toBeNull();
    });
  });

  describe("removeCursor", () => {
    it("removes a cursor", () => {
      let state = createMultiCursorState();
      let id: string;
      ({ state, cursorId: id } = addCursor(state, "human", "a.py", { line: 1, column: 1 }));
      state = removeCursor(state, id);
      expect(state.cursors.size).toBe(0);
    });
  });

  describe("markInactive", () => {
    it("marks old cursors inactive", () => {
      let state = createMultiCursorState({ inactiveTimeoutMs: 5000 });
      let id: string;
      ({ state, cursorId: id } = addCursor(state, "human", "a.py", { line: 1, column: 1 }, now));
      state = markInactive(state, now + 6000);
      expect(state.cursors.get(id)!.active).toBe(false);
    });

    it("keeps recent cursors active", () => {
      let state = createMultiCursorState({ inactiveTimeoutMs: 5000 });
      let id: string;
      ({ state, cursorId: id } = addCursor(state, "human", "a.py", { line: 1, column: 1 }, now));
      state = markInactive(state, now + 2000);
      expect(state.cursors.get(id)!.active).toBe(true);
    });
  });

  describe("queries", () => {
    it("getAllCursors returns all", () => {
      let state = createMultiCursorState();
      ({ state } = addCursor(state, "human", "a.py", { line: 1, column: 1 }));
      ({ state } = addCursor(state, "ai", "a.py", { line: 2, column: 1 }));
      expect(getAllCursors(state)).toHaveLength(2);
    });

    it("getCursorsByOwner filters by type", () => {
      let state = createMultiCursorState();
      ({ state } = addCursor(state, "human", "a.py", { line: 1, column: 1 }));
      ({ state } = addCursor(state, "ai", "a.py", { line: 2, column: 1 }));
      ({ state } = addCursor(state, "ai", "b.py", { line: 3, column: 1 }));
      expect(getCursorsByOwner(state, "ai")).toHaveLength(2);
      expect(getCursorsByOwner(state, "human")).toHaveLength(1);
    });

    it("getCursorsInFile filters by file", () => {
      let state = createMultiCursorState();
      ({ state } = addCursor(state, "human", "a.py", { line: 1, column: 1 }));
      ({ state } = addCursor(state, "ai", "b.py", { line: 2, column: 1 }));
      expect(getCursorsInFile(state, "a.py")).toHaveLength(1);
    });

    it("getActiveCursors filters inactive", () => {
      let state = createMultiCursorState({ inactiveTimeoutMs: 1000 });
      ({ state } = addCursor(state, "human", "a.py", { line: 1, column: 1 }, now));
      ({ state } = addCursor(state, "ai", "a.py", { line: 2, column: 1 }, now + 5000));
      state = markInactive(state, now + 2000);
      expect(getActiveCursors(state)).toHaveLength(1);
    });
  });

  describe("hasSimultaneousCursors", () => {
    it("returns true when AI and human in same file", () => {
      let state = createMultiCursorState();
      ({ state } = addCursor(state, "human", "main.py", { line: 1, column: 1 }, now));
      ({ state } = addCursor(state, "ai", "main.py", { line: 10, column: 1 }, now));
      expect(hasSimultaneousCursors(state, "main.py")).toBe(true);
    });

    it("returns false when only one owner type", () => {
      let state = createMultiCursorState();
      ({ state } = addCursor(state, "human", "main.py", { line: 1, column: 1 }));
      expect(hasSimultaneousCursors(state, "main.py")).toBe(false);
    });

    it("returns false when in different files", () => {
      let state = createMultiCursorState();
      ({ state } = addCursor(state, "human", "a.py", { line: 1, column: 1 }));
      ({ state } = addCursor(state, "ai", "b.py", { line: 1, column: 1 }));
      expect(hasSimultaneousCursors(state, "a.py")).toBe(false);
    });
  });

  describe("generateCursorCSS", () => {
    it("generates CSS for active cursors", () => {
      let state = createMultiCursorState();
      ({ state } = addCursor(state, "human", "a.py", { line: 1, column: 1 }));
      ({ state } = addCursor(state, "ai", "a.py", { line: 5, column: 1 }));
      const css = generateCursorCSS(state);
      expect(css).toContain("border-left: 2px solid #3b82f6");
      expect(css).toContain("border-left: 2px solid #f59e0b");
      expect(css).toContain("cursor-label");
    });

    it("includes selection CSS when selection exists", () => {
      let state = createMultiCursorState();
      let id: string;
      ({ state, cursorId: id } = addCursor(state, "ai", "a.py", { line: 1, column: 1 }));
      state = setSelection(state, id, {
        start: { line: 1, column: 1 },
        end: { line: 3, column: 10 },
      });
      const css = generateCursorCSS(state);
      expect(css).toContain("cursor-selection");
    });

    it("skips inactive cursors", () => {
      let state = createMultiCursorState({ inactiveTimeoutMs: 1000 });
      ({ state } = addCursor(state, "human", "a.py", { line: 1, column: 1 }, now));
      state = markInactive(state, now + 2000);
      const css = generateCursorCSS(state);
      expect(css).toBe("");
    });

    it("gives AI lower z-index than human", () => {
      let state = createMultiCursorState();
      ({ state } = addCursor(state, "ai", "a.py", { line: 1, column: 1 }));
      ({ state } = addCursor(state, "human", "a.py", { line: 2, column: 1 }));
      const css = generateCursorCSS(state);
      expect(css).toContain("z-index: 10");
      expect(css).toContain("z-index: 20");
    });
  });
});
