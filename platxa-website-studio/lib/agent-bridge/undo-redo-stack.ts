/**
 * Undo/Redo Stack — Visual Edit History with Keyboard Shortcuts
 *
 * Manages an undo/redo stack for visual edits with configurable
 * max depth and keyboard shortcut support (Cmd+Z / Cmd+Shift+Z).
 */

// =============================================================================
// Types
// =============================================================================

/** Types of visual edit operations */
export type EditOperationType =
  | "text"
  | "style"
  | "layout"
  | "add"
  | "remove"
  | "move"
  | "resize"
  | "color"
  | "font"
  | "image"
  | "custom";

/** A single edit operation */
export interface EditOperation {
  /** Unique operation ID */
  id: string;
  /** Type of edit */
  type: EditOperationType;
  /** Human-readable description */
  description: string;
  /** Element selector or identifier that was edited */
  targetSelector: string;
  /** State before the edit (for undo) */
  before: string;
  /** State after the edit (for redo) */
  after: string;
  /** ISO timestamp */
  timestamp: string;
  /** Optional grouping key for batch operations */
  groupId?: string;
}

/** Undo/Redo stack state */
export interface UndoRedoStack {
  /** Past operations (most recent last) */
  past: EditOperation[];
  /** Future operations available for redo (most recent undo first) */
  future: EditOperation[];
  /** Maximum operations to keep */
  maxDepth: number;
}

/** Result of an undo or redo action */
export interface UndoRedoResult {
  /** The operation that was undone/redone */
  operation: EditOperation;
  /** Updated stack */
  stack: UndoRedoStack;
}

/** Keyboard shortcut definition */
export interface KeyboardShortcut {
  /** Key code */
  key: string;
  /** Requires meta (Cmd on Mac) or ctrl */
  metaOrCtrl: boolean;
  /** Requires shift */
  shift: boolean;
  /** Action name */
  action: "undo" | "redo";
}

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_MAX_DEPTH = 50;

export const UNDO_SHORTCUT: KeyboardShortcut = {
  key: "z",
  metaOrCtrl: true,
  shift: false,
  action: "undo",
};

export const REDO_SHORTCUT: KeyboardShortcut = {
  key: "z",
  metaOrCtrl: true,
  shift: true,
  action: "redo",
};

// =============================================================================
// Stack Management
// =============================================================================

let operationCounter = 0;

/** Reset the operation counter (for testing). */
export function resetOperationCounter(): void {
  operationCounter = 0;
}

/** Creates a new empty undo/redo stack. */
export function createStack(maxDepth: number = DEFAULT_MAX_DEPTH): UndoRedoStack {
  return { past: [], future: [], maxDepth };
}

/** Pushes a new edit operation onto the stack, clearing the redo future. */
export function pushOperation(
  stack: UndoRedoStack,
  type: EditOperationType,
  description: string,
  targetSelector: string,
  before: string,
  after: string,
  groupId?: string,
): UndoRedoStack {
  operationCounter++;
  const op: EditOperation = {
    id: `op_${operationCounter}`,
    type,
    description,
    targetSelector,
    before,
    after,
    timestamp: new Date().toISOString(),
    groupId,
  };

  const past = [...stack.past, op];
  // Enforce max depth
  const trimmed = past.length > stack.maxDepth
    ? past.slice(past.length - stack.maxDepth)
    : past;

  return { ...stack, past: trimmed, future: [] };
}

/** Undoes the most recent operation. Returns null if nothing to undo. */
export function undoOperation(stack: UndoRedoStack): UndoRedoResult | null {
  if (stack.past.length === 0) return null;

  const past = [...stack.past];
  const op = past.pop()!;
  const future = [op, ...stack.future];

  return {
    operation: op,
    stack: { ...stack, past, future },
  };
}

/** Redoes the most recently undone operation. Returns null if nothing to redo. */
export function redoOperation(stack: UndoRedoStack): UndoRedoResult | null {
  if (stack.future.length === 0) return null;

  const future = [...stack.future];
  const op = future.shift()!;
  const past = [...stack.past, op];

  return {
    operation: op,
    stack: { ...stack, past, future },
  };
}

/** Whether undo is available. */
export function canUndoStack(stack: UndoRedoStack): boolean {
  return stack.past.length > 0;
}

/** Whether redo is available. */
export function canRedoStack(stack: UndoRedoStack): boolean {
  return stack.future.length > 0;
}

/** Clears the entire stack. */
export function clearStack(stack: UndoRedoStack): UndoRedoStack {
  return { ...stack, past: [], future: [] };
}

/** Returns the total number of operations (past + future). */
export function stackSize(stack: UndoRedoStack): number {
  return stack.past.length + stack.future.length;
}

/** Returns the most recent operation without modifying the stack. */
export function peekUndo(stack: UndoRedoStack): EditOperation | null {
  return stack.past.length > 0 ? stack.past[stack.past.length - 1] : null;
}

/** Returns the next redo operation without modifying the stack. */
export function peekRedo(stack: UndoRedoStack): EditOperation | null {
  return stack.future.length > 0 ? stack.future[0] : null;
}

// =============================================================================
// Keyboard Shortcut Matching
// =============================================================================

/** Checks if a keyboard event matches a shortcut definition. */
export function matchesShortcut(
  event: { key: string; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean },
  shortcut: KeyboardShortcut,
): boolean {
  const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
  const metaOrCtrl = shortcut.metaOrCtrl ? (event.metaKey || event.ctrlKey) : true;
  const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
  return keyMatch && metaOrCtrl && shiftMatch;
}

/** Determines the action from a keyboard event. Returns null if no match. */
export function getShortcutAction(
  event: { key: string; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean },
): "undo" | "redo" | null {
  if (matchesShortcut(event, REDO_SHORTCUT)) return "redo";
  if (matchesShortcut(event, UNDO_SHORTCUT)) return "undo";
  return null;
}

// =============================================================================
// Batch / Group Operations
// =============================================================================

/** Undoes all operations in the same group as the most recent operation. */
export function undoGroup(stack: UndoRedoStack): UndoRedoResult | null {
  if (stack.past.length === 0) return null;

  const groupId = stack.past[stack.past.length - 1].groupId;
  if (!groupId) return undoOperation(stack);

  let current = stack;
  let lastOp: EditOperation | null = null;

  while (
    current.past.length > 0 &&
    current.past[current.past.length - 1].groupId === groupId
  ) {
    const result = undoOperation(current)!;
    current = result.stack;
    lastOp = result.operation;
  }

  return lastOp ? { operation: lastOp, stack: current } : null;
}

/** Redoes all operations in the same group as the next redo operation. */
export function redoGroup(stack: UndoRedoStack): UndoRedoResult | null {
  if (stack.future.length === 0) return null;

  const groupId = stack.future[0].groupId;
  if (!groupId) return redoOperation(stack);

  let current = stack;
  let lastOp: EditOperation | null = null;

  while (
    current.future.length > 0 &&
    current.future[0].groupId === groupId
  ) {
    const result = redoOperation(current)!;
    current = result.stack;
    lastOp = result.operation;
  }

  return lastOp ? { operation: lastOp, stack: current } : null;
}
