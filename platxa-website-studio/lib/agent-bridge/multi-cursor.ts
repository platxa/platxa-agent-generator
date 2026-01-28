/**
 * Multi-Cursor Awareness
 *
 * Tracks AI and human cursor positions simultaneously in a code editor,
 * with distinct colors, labels, and selection ranges.
 */

// =============================================================================
// Types
// =============================================================================

export interface CursorPosition {
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
}

export interface SelectionRange {
  start: CursorPosition;
  end: CursorPosition;
}

export type CursorOwner = "human" | "ai";

export interface CursorState {
  /** Unique cursor ID */
  id: string;
  /** Owner type */
  owner: CursorOwner;
  /** Display label */
  label: string;
  /** CSS color for the cursor */
  color: string;
  /** Current position */
  position: CursorPosition;
  /** Active selection (null if no selection) */
  selection: SelectionRange | null;
  /** File path the cursor is in */
  filePath: string;
  /** Last updated timestamp (ms) */
  updatedAt: number;
  /** Whether cursor is currently active/visible */
  active: boolean;
}

export interface CursorConfig {
  /** Color for human cursors */
  humanColor: string;
  /** Color for AI cursors */
  aiColor: string;
  /** Human cursor label */
  humanLabel: string;
  /** AI cursor label */
  aiLabel: string;
  /** Cursor timeout (ms) — inactive after this */
  inactiveTimeoutMs: number;
}

export const DEFAULT_CURSOR_CONFIG: CursorConfig = {
  humanColor: "#3b82f6",
  aiColor: "#f59e0b",
  humanLabel: "You",
  aiLabel: "AI",
  inactiveTimeoutMs: 30000,
};

export interface MultiCursorState {
  /** All tracked cursors by ID */
  cursors: Map<string, CursorState>;
  /** Config */
  config: CursorConfig;
  /** Cursor counter for ID generation */
  counter: number;
}

// =============================================================================
// State Management
// =============================================================================

export function createMultiCursorState(
  config: Partial<CursorConfig> = {},
): MultiCursorState {
  return {
    cursors: new Map(),
    config: { ...DEFAULT_CURSOR_CONFIG, ...config },
    counter: 0,
  };
}

/** Adds a new cursor. Returns updated state and cursor ID. */
export function addCursor(
  state: MultiCursorState,
  owner: CursorOwner,
  filePath: string,
  position: CursorPosition,
  timestamp: number = Date.now(),
): { state: MultiCursorState; cursorId: string } {
  const nextCounter = state.counter + 1;
  const cursorId = `cursor_${owner}_${nextCounter}`;
  const { config } = state;

  const cursor: CursorState = {
    id: cursorId,
    owner,
    label: owner === "human" ? config.humanLabel : config.aiLabel,
    color: owner === "human" ? config.humanColor : config.aiColor,
    position,
    selection: null,
    filePath,
    updatedAt: timestamp,
    active: true,
  };

  const cursors = new Map(state.cursors);
  cursors.set(cursorId, cursor);
  return {
    state: { ...state, cursors, counter: nextCounter },
    cursorId,
  };
}

/** Updates a cursor's position. */
export function moveCursor(
  state: MultiCursorState,
  cursorId: string,
  position: CursorPosition,
  timestamp: number = Date.now(),
): MultiCursorState {
  const existing = state.cursors.get(cursorId);
  if (!existing) return state;

  const cursors = new Map(state.cursors);
  cursors.set(cursorId, {
    ...existing,
    position,
    selection: null,
    updatedAt: timestamp,
    active: true,
  });
  return { ...state, cursors };
}

/** Sets a selection range on a cursor. */
export function setSelection(
  state: MultiCursorState,
  cursorId: string,
  selection: SelectionRange,
  timestamp: number = Date.now(),
): MultiCursorState {
  const existing = state.cursors.get(cursorId);
  if (!existing) return state;

  const cursors = new Map(state.cursors);
  cursors.set(cursorId, {
    ...existing,
    position: selection.end,
    selection,
    updatedAt: timestamp,
    active: true,
  });
  return { ...state, cursors };
}

/** Clears selection on a cursor. */
export function clearSelection(
  state: MultiCursorState,
  cursorId: string,
  timestamp: number = Date.now(),
): MultiCursorState {
  const existing = state.cursors.get(cursorId);
  if (!existing) return state;

  const cursors = new Map(state.cursors);
  cursors.set(cursorId, { ...existing, selection: null, updatedAt: timestamp });
  return { ...state, cursors };
}

/** Removes a cursor. */
export function removeCursor(
  state: MultiCursorState,
  cursorId: string,
): MultiCursorState {
  const cursors = new Map(state.cursors);
  cursors.delete(cursorId);
  return { ...state, cursors };
}

/** Marks inactive cursors based on timeout. */
export function markInactive(
  state: MultiCursorState,
  now: number = Date.now(),
): MultiCursorState {
  const { inactiveTimeoutMs } = state.config;
  const cursors = new Map(state.cursors);
  let changed = false;

  for (const [id, cursor] of cursors) {
    if (cursor.active && now - cursor.updatedAt > inactiveTimeoutMs) {
      cursors.set(id, { ...cursor, active: false });
      changed = true;
    }
  }

  return changed ? { ...state, cursors } : state;
}

// =============================================================================
// Queries
// =============================================================================

/** Returns all cursors. */
export function getAllCursors(state: MultiCursorState): CursorState[] {
  return Array.from(state.cursors.values());
}

/** Returns cursors by owner type. */
export function getCursorsByOwner(
  state: MultiCursorState,
  owner: CursorOwner,
): CursorState[] {
  return getAllCursors(state).filter((c) => c.owner === owner);
}

/** Returns cursors in a specific file. */
export function getCursorsInFile(
  state: MultiCursorState,
  filePath: string,
): CursorState[] {
  return getAllCursors(state).filter((c) => c.filePath === filePath);
}

/** Returns active cursors only. */
export function getActiveCursors(state: MultiCursorState): CursorState[] {
  return getAllCursors(state).filter((c) => c.active);
}

/** Checks if AI and human cursors coexist in the same file. */
export function hasSimultaneousCursors(
  state: MultiCursorState,
  filePath: string,
): boolean {
  const inFile = getCursorsInFile(state, filePath);
  const hasHuman = inFile.some((c) => c.owner === "human" && c.active);
  const hasAi = inFile.some((c) => c.owner === "ai" && c.active);
  return hasHuman && hasAi;
}

// =============================================================================
// CSS Generation for Editor Integration
// =============================================================================

/** Generates CSS for cursor decorations. */
export function generateCursorCSS(state: MultiCursorState): string {
  const rules: string[] = [];

  for (const cursor of state.cursors.values()) {
    if (!cursor.active) continue;

    const id = cursor.id.replace(/[^a-zA-Z0-9_-]/g, "_");

    // Cursor line decoration
    rules.push(
      `.cursor-${id} {\n` +
      `  border-left: 2px solid ${cursor.color};\n` +
      `  position: absolute;\n` +
      `  z-index: ${cursor.owner === "ai" ? 10 : 20};\n` +
      `}`,
    );

    // Label decoration
    rules.push(
      `.cursor-label-${id} {\n` +
      `  background: ${cursor.color};\n` +
      `  color: white;\n` +
      `  font-size: 11px;\n` +
      `  padding: 1px 4px;\n` +
      `  border-radius: 2px;\n` +
      `  position: absolute;\n` +
      `  top: -18px;\n` +
      `  white-space: nowrap;\n` +
      `}`,
    );

    // Selection decoration
    if (cursor.selection) {
      rules.push(
        `.cursor-selection-${id} {\n` +
        `  background: ${cursor.color}33;\n` +
        `  position: absolute;\n` +
        `}`,
      );
    }
  }

  return rules.join("\n\n");
}
