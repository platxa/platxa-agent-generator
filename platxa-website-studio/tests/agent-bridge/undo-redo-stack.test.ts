import { describe, it, expect, beforeEach } from "vitest";
import {
  resetOperationCounter,
  createStack,
  pushOperation,
  undoOperation,
  redoOperation,
  canUndoStack,
  canRedoStack,
  clearStack,
  stackSize,
  peekUndo,
  peekRedo,
  matchesShortcut,
  getShortcutAction,
  undoGroup,
  redoGroup,
  DEFAULT_MAX_DEPTH,
  UNDO_SHORTCUT,
  REDO_SHORTCUT,
} from "@/lib/agent-bridge/undo-redo-stack";

beforeEach(() => {
  resetOperationCounter();
});

describe("Undo/Redo Stack", () => {
  describe("createStack", () => {
    it("creates empty stack with default depth", () => {
      const s = createStack();
      expect(s.past).toHaveLength(0);
      expect(s.future).toHaveLength(0);
      expect(s.maxDepth).toBe(DEFAULT_MAX_DEPTH);
    });

    it("accepts custom max depth", () => {
      const s = createStack(10);
      expect(s.maxDepth).toBe(10);
    });
  });

  describe("pushOperation", () => {
    it("adds operation to past", () => {
      let s = createStack();
      s = pushOperation(s, "text", "Edit heading", ".h1", "old", "new");
      expect(s.past).toHaveLength(1);
      expect(s.past[0].id).toBe("op_1");
      expect(s.past[0].type).toBe("text");
      expect(s.past[0].description).toBe("Edit heading");
      expect(s.past[0].before).toBe("old");
      expect(s.past[0].after).toBe("new");
    });

    it("clears future on new push", () => {
      let s = createStack();
      s = pushOperation(s, "text", "A", ".a", "1", "2");
      s = pushOperation(s, "text", "B", ".b", "2", "3");
      const result = undoOperation(s)!;
      s = result.stack;
      expect(s.future).toHaveLength(1);
      s = pushOperation(s, "text", "C", ".c", "2", "4");
      expect(s.future).toHaveLength(0);
      expect(s.past).toHaveLength(2);
    });

    it("enforces max depth", () => {
      let s = createStack(3);
      s = pushOperation(s, "text", "A", ".a", "", "1");
      s = pushOperation(s, "text", "B", ".b", "", "2");
      s = pushOperation(s, "text", "C", ".c", "", "3");
      s = pushOperation(s, "text", "D", ".d", "", "4");
      expect(s.past).toHaveLength(3);
      expect(s.past[0].description).toBe("B"); // oldest trimmed
    });

    it("preserves 50 operations by default", () => {
      expect(DEFAULT_MAX_DEPTH).toBe(50);
    });

    it("stores groupId", () => {
      let s = createStack();
      s = pushOperation(s, "style", "Bold", ".p", "normal", "bold", "g1");
      expect(s.past[0].groupId).toBe("g1");
    });

    it("assigns sequential IDs", () => {
      let s = createStack();
      s = pushOperation(s, "text", "A", ".a", "", "1");
      s = pushOperation(s, "text", "B", ".b", "", "2");
      expect(s.past[0].id).toBe("op_1");
      expect(s.past[1].id).toBe("op_2");
    });
  });

  describe("undoOperation", () => {
    it("returns null on empty stack", () => {
      expect(undoOperation(createStack())).toBeNull();
    });

    it("moves last past item to future", () => {
      let s = createStack();
      s = pushOperation(s, "text", "A", ".a", "old", "new");
      const result = undoOperation(s)!;
      expect(result.operation.description).toBe("A");
      expect(result.stack.past).toHaveLength(0);
      expect(result.stack.future).toHaveLength(1);
    });

    it("supports multiple undos", () => {
      let s = createStack();
      s = pushOperation(s, "text", "A", ".a", "", "1");
      s = pushOperation(s, "text", "B", ".b", "", "2");
      s = pushOperation(s, "text", "C", ".c", "", "3");
      s = undoOperation(s)!.stack;
      s = undoOperation(s)!.stack;
      expect(s.past).toHaveLength(1);
      expect(s.future).toHaveLength(2);
      expect(s.future[0].description).toBe("B");
      expect(s.future[1].description).toBe("C");
    });
  });

  describe("redoOperation", () => {
    it("returns null when no future", () => {
      expect(redoOperation(createStack())).toBeNull();
    });

    it("moves first future item to past", () => {
      let s = createStack();
      s = pushOperation(s, "text", "A", ".a", "", "1");
      s = undoOperation(s)!.stack;
      const result = redoOperation(s)!;
      expect(result.operation.description).toBe("A");
      expect(result.stack.past).toHaveLength(1);
      expect(result.stack.future).toHaveLength(0);
    });
  });

  describe("canUndoStack / canRedoStack", () => {
    it("canUndo is false on empty", () => {
      expect(canUndoStack(createStack())).toBe(false);
    });

    it("canUndo is true with operations", () => {
      let s = createStack();
      s = pushOperation(s, "text", "A", ".a", "", "1");
      expect(canUndoStack(s)).toBe(true);
    });

    it("canRedo is false on empty", () => {
      expect(canRedoStack(createStack())).toBe(false);
    });

    it("canRedo is true after undo", () => {
      let s = createStack();
      s = pushOperation(s, "text", "A", ".a", "", "1");
      s = undoOperation(s)!.stack;
      expect(canRedoStack(s)).toBe(true);
    });
  });

  describe("clearStack", () => {
    it("clears all operations", () => {
      let s = createStack();
      s = pushOperation(s, "text", "A", ".a", "", "1");
      s = pushOperation(s, "text", "B", ".b", "", "2");
      s = clearStack(s);
      expect(s.past).toHaveLength(0);
      expect(s.future).toHaveLength(0);
    });
  });

  describe("stackSize", () => {
    it("returns total past + future", () => {
      let s = createStack();
      s = pushOperation(s, "text", "A", ".a", "", "1");
      s = pushOperation(s, "text", "B", ".b", "", "2");
      s = undoOperation(s)!.stack;
      expect(stackSize(s)).toBe(2);
    });
  });

  describe("peekUndo / peekRedo", () => {
    it("peekUndo returns last past op", () => {
      let s = createStack();
      s = pushOperation(s, "text", "A", ".a", "", "1");
      s = pushOperation(s, "text", "B", ".b", "", "2");
      expect(peekUndo(s)!.description).toBe("B");
    });

    it("peekUndo returns null on empty", () => {
      expect(peekUndo(createStack())).toBeNull();
    });

    it("peekRedo returns first future op", () => {
      let s = createStack();
      s = pushOperation(s, "text", "A", ".a", "", "1");
      s = undoOperation(s)!.stack;
      expect(peekRedo(s)!.description).toBe("A");
    });

    it("peekRedo returns null on empty", () => {
      expect(peekRedo(createStack())).toBeNull();
    });
  });

  describe("keyboard shortcuts", () => {
    it("matches Cmd+Z for undo", () => {
      expect(matchesShortcut(
        { key: "z", metaKey: true, ctrlKey: false, shiftKey: false },
        UNDO_SHORTCUT,
      )).toBe(true);
    });

    it("matches Ctrl+Z for undo", () => {
      expect(matchesShortcut(
        { key: "z", metaKey: false, ctrlKey: true, shiftKey: false },
        UNDO_SHORTCUT,
      )).toBe(true);
    });

    it("matches Cmd+Shift+Z for redo", () => {
      expect(matchesShortcut(
        { key: "z", metaKey: true, ctrlKey: false, shiftKey: true },
        REDO_SHORTCUT,
      )).toBe(true);
    });

    it("does not match plain Z", () => {
      expect(matchesShortcut(
        { key: "z", metaKey: false, ctrlKey: false, shiftKey: false },
        UNDO_SHORTCUT,
      )).toBe(false);
    });

    it("getShortcutAction returns undo for Cmd+Z", () => {
      expect(getShortcutAction(
        { key: "z", metaKey: true, ctrlKey: false, shiftKey: false },
      )).toBe("undo");
    });

    it("getShortcutAction returns redo for Cmd+Shift+Z", () => {
      expect(getShortcutAction(
        { key: "z", metaKey: true, ctrlKey: false, shiftKey: true },
      )).toBe("redo");
    });

    it("getShortcutAction returns null for unrelated key", () => {
      expect(getShortcutAction(
        { key: "a", metaKey: true, ctrlKey: false, shiftKey: false },
      )).toBeNull();
    });
  });

  describe("group operations", () => {
    it("undoGroup undoes all ops in same group", () => {
      let s = createStack();
      s = pushOperation(s, "style", "Color 1", ".a", "", "red", "batch1");
      s = pushOperation(s, "style", "Color 2", ".b", "", "blue", "batch1");
      s = pushOperation(s, "style", "Color 3", ".c", "", "green", "batch1");
      const result = undoGroup(s)!;
      expect(result.stack.past).toHaveLength(0);
      expect(result.stack.future).toHaveLength(3);
    });

    it("undoGroup stops at different group", () => {
      let s = createStack();
      s = pushOperation(s, "text", "X", ".x", "", "1", "g1");
      s = pushOperation(s, "style", "A", ".a", "", "2", "g2");
      s = pushOperation(s, "style", "B", ".b", "", "3", "g2");
      const result = undoGroup(s)!;
      expect(result.stack.past).toHaveLength(1);
      expect(result.stack.past[0].groupId).toBe("g1");
    });

    it("undoGroup falls back to single undo without groupId", () => {
      let s = createStack();
      s = pushOperation(s, "text", "A", ".a", "", "1");
      const result = undoGroup(s)!;
      expect(result.stack.past).toHaveLength(0);
    });

    it("redoGroup redoes all ops in same group", () => {
      let s = createStack();
      s = pushOperation(s, "style", "A", ".a", "", "1", "g1");
      s = pushOperation(s, "style", "B", ".b", "", "2", "g1");
      s = undoGroup(s)!.stack;
      expect(s.future).toHaveLength(2);
      const result = redoGroup(s)!;
      expect(result.stack.past).toHaveLength(2);
      expect(result.stack.future).toHaveLength(0);
    });

    it("undoGroup returns null on empty", () => {
      expect(undoGroup(createStack())).toBeNull();
    });

    it("redoGroup returns null on empty", () => {
      expect(redoGroup(createStack())).toBeNull();
    });
  });
});
