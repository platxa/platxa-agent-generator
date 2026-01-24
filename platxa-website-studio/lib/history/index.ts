/**
 * History and Undo System
 *
 * Provides version control, undo/redo, and timeline
 * features for theme editing sessions.
 */

// =============================================================================
// TYPES
// =============================================================================

export type ActionType =
  | "file_create"
  | "file_update"
  | "file_delete"
  | "config_change"
  | "snippet_add"
  | "snippet_remove"
  | "style_change"
  | "asset_upload"
  | "asset_delete"
  | "batch";

export interface HistoryAction {
  /** Unique action ID */
  id: string;
  /** Action type */
  type: ActionType;
  /** Human-readable description */
  description: string;
  /** Timestamp */
  timestamp: Date;
  /** Data before the action (for undo) */
  before: unknown;
  /** Data after the action (for redo) */
  after: unknown;
  /** Affected file paths */
  affectedPaths: string[];
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

export interface HistorySnapshot {
  /** Snapshot ID */
  id: string;
  /** Snapshot name */
  name: string;
  /** Description */
  description?: string;
  /** Creation timestamp */
  timestamp: Date;
  /** Full state at this point */
  state: Record<string, unknown>;
  /** Is auto-saved snapshot */
  isAuto: boolean;
  /** Action ID this snapshot was created after */
  afterActionId?: string;
}

export interface HistoryBranch {
  /** Branch ID */
  id: string;
  /** Branch name */
  name: string;
  /** Parent branch ID */
  parentId?: string;
  /** Fork point action ID */
  forkActionId?: string;
  /** Actions in this branch */
  actions: HistoryAction[];
  /** Creation timestamp */
  createdAt: Date;
}

export interface HistoryStats {
  /** Total actions */
  totalActions: number;
  /** Undoable actions */
  undoableCount: number;
  /** Redoable actions */
  redoableCount: number;
  /** Snapshots count */
  snapshotsCount: number;
  /** Session duration in ms */
  sessionDuration: number;
}

export interface DiffResult {
  /** Path of changed file/property */
  path: string;
  /** Type of change */
  type: "added" | "removed" | "modified";
  /** Old value (for modified/removed) */
  oldValue?: string;
  /** New value (for modified/added) */
  newValue?: string;
  /** Line-by-line diff for text */
  lineDiff?: LineDiff[];
}

export interface LineDiff {
  /** Line number */
  lineNumber: number;
  /** Type of change */
  type: "added" | "removed" | "unchanged";
  /** Line content */
  content: string;
}

// =============================================================================
// HISTORY MANAGER
// =============================================================================

/**
 * History manager for undo/redo and version tracking
 */
export class HistoryManager {
  private actions: HistoryAction[] = [];
  private currentIndex: number = -1;
  private snapshots: Map<string, HistorySnapshot> = new Map();
  private branches: Map<string, HistoryBranch> = new Map();
  private currentBranchId: string = "main";
  private maxHistory: number;
  private autoSnapshotInterval: number;
  private lastAutoSnapshot: Date;
  private sessionStart: Date;
  private listeners: Set<(event: HistoryEvent) => void> = new Set();

  constructor(options: { maxHistory?: number; autoSnapshotInterval?: number } = {}) {
    this.maxHistory = options.maxHistory || 100;
    this.autoSnapshotInterval = options.autoSnapshotInterval || 5 * 60 * 1000; // 5 minutes
    this.lastAutoSnapshot = new Date();
    this.sessionStart = new Date();

    // Create main branch
    this.branches.set("main", {
      id: "main",
      name: "Main",
      actions: [],
      createdAt: new Date(),
    });
  }

  // ===========================================================================
  // CORE UNDO/REDO
  // ===========================================================================

  /**
   * Record an action
   */
  record(action: Omit<HistoryAction, "id" | "timestamp">): HistoryAction {
    const fullAction: HistoryAction = {
      ...action,
      id: this.generateId(),
      timestamp: new Date(),
    };

    // If we're not at the end of history, truncate forward history
    if (this.currentIndex < this.actions.length - 1) {
      this.actions = this.actions.slice(0, this.currentIndex + 1);
    }

    // Add action
    this.actions.push(fullAction);
    this.currentIndex = this.actions.length - 1;

    // Also add to current branch
    const branch = this.branches.get(this.currentBranchId);
    if (branch) {
      branch.actions.push(fullAction);
    }

    // Enforce max history
    if (this.actions.length > this.maxHistory) {
      const removed = this.actions.shift();
      this.currentIndex--;
      if (removed && branch) {
        const idx = branch.actions.findIndex((a) => a.id === removed.id);
        if (idx !== -1) branch.actions.splice(idx, 1);
      }
    }

    // Check for auto-snapshot
    this.checkAutoSnapshot();

    // Emit event
    this.emit({ type: "action_recorded", action: fullAction });

    return fullAction;
  }

  /**
   * Record a batch of related actions as one undoable unit
   */
  recordBatch(
    description: string,
    actions: Array<Omit<HistoryAction, "id" | "timestamp">>
  ): HistoryAction {
    const batchAction: HistoryAction = {
      id: this.generateId(),
      type: "batch",
      description,
      timestamp: new Date(),
      before: actions.map((a) => a.before),
      after: actions.map((a) => a.after),
      affectedPaths: [...new Set(actions.flatMap((a) => a.affectedPaths))],
      metadata: { batchSize: actions.length, actions },
    };

    // Use record method for consistency
    return this.record(batchAction);
  }

  /**
   * Undo the last action
   */
  undo(): HistoryAction | null {
    if (!this.canUndo()) {
      return null;
    }

    const action = this.actions[this.currentIndex];
    this.currentIndex--;

    this.emit({ type: "undo", action });

    return action;
  }

  /**
   * Redo the next action
   */
  redo(): HistoryAction | null {
    if (!this.canRedo()) {
      return null;
    }

    this.currentIndex++;
    const action = this.actions[this.currentIndex];

    this.emit({ type: "redo", action });

    return action;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.currentIndex < this.actions.length - 1;
  }

  /**
   * Get the action that would be undone
   */
  peekUndo(): HistoryAction | null {
    if (!this.canUndo()) return null;
    return this.actions[this.currentIndex];
  }

  /**
   * Get the action that would be redone
   */
  peekRedo(): HistoryAction | null {
    if (!this.canRedo()) return null;
    return this.actions[this.currentIndex + 1];
  }

  // ===========================================================================
  // SNAPSHOTS
  // ===========================================================================

  /**
   * Create a named snapshot
   */
  createSnapshot(
    name: string,
    state: Record<string, unknown>,
    description?: string
  ): HistorySnapshot {
    const snapshot: HistorySnapshot = {
      id: this.generateId(),
      name,
      description,
      timestamp: new Date(),
      state,
      isAuto: false,
      afterActionId: this.actions[this.currentIndex]?.id,
    };

    this.snapshots.set(snapshot.id, snapshot);
    this.emit({ type: "snapshot_created", snapshot });

    return snapshot;
  }

  /**
   * Create an auto-snapshot
   */
  private createAutoSnapshot(state: Record<string, unknown>): HistorySnapshot {
    const count = Array.from(this.snapshots.values()).filter((s) => s.isAuto).length;
    const snapshot: HistorySnapshot = {
      id: this.generateId(),
      name: `Auto-save #${count + 1}`,
      timestamp: new Date(),
      state,
      isAuto: true,
      afterActionId: this.actions[this.currentIndex]?.id,
    };

    this.snapshots.set(snapshot.id, snapshot);
    this.lastAutoSnapshot = new Date();

    return snapshot;
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): HistorySnapshot[] {
    return Array.from(this.snapshots.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Get a snapshot by ID
   */
  getSnapshot(id: string): HistorySnapshot | undefined {
    return this.snapshots.get(id);
  }

  /**
   * Delete a snapshot
   */
  deleteSnapshot(id: string): boolean {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) return false;

    this.snapshots.delete(id);
    this.emit({ type: "snapshot_deleted", snapshot });

    return true;
  }

  /**
   * Restore to a snapshot
   */
  restoreSnapshot(id: string): HistorySnapshot | null {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) return null;

    // Record restore action
    this.record({
      type: "config_change",
      description: `Restored to snapshot: ${snapshot.name}`,
      before: null,
      after: snapshot.state,
      affectedPaths: Object.keys(snapshot.state),
      metadata: { snapshotId: id },
    });

    this.emit({ type: "snapshot_restored", snapshot });

    return snapshot;
  }

  // ===========================================================================
  // TIMELINE
  // ===========================================================================

  /**
   * Get action history (most recent first)
   */
  getHistory(limit?: number): HistoryAction[] {
    const history = [...this.actions].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get timeline grouped by time period
   */
  getTimeline(): Array<{
    period: string;
    actions: HistoryAction[];
    snapshots: HistorySnapshot[];
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    const periods: Array<{
      period: string;
      start: Date;
      end: Date;
      actions: HistoryAction[];
      snapshots: HistorySnapshot[];
    }> = [
      { period: "Last Hour", start: new Date(now.getTime() - 60 * 60 * 1000), end: now, actions: [], snapshots: [] },
      { period: "Today", start: today, end: now, actions: [], snapshots: [] },
      { period: "Yesterday", start: yesterday, end: today, actions: [], snapshots: [] },
      { period: "This Week", start: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), end: yesterday, actions: [], snapshots: [] },
      { period: "Older", start: new Date(0), end: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), actions: [], snapshots: [] },
    ];

    // Categorize actions
    for (const action of this.actions) {
      for (const period of periods) {
        if (action.timestamp >= period.start && action.timestamp <= period.end) {
          period.actions.push(action);
          break;
        }
      }
    }

    // Categorize snapshots
    for (const snapshot of this.snapshots.values()) {
      for (const period of periods) {
        if (snapshot.timestamp >= period.start && snapshot.timestamp <= period.end) {
          period.snapshots.push(snapshot);
          break;
        }
      }
    }

    // Filter empty periods and return
    return periods
      .filter((p) => p.actions.length > 0 || p.snapshots.length > 0)
      .map(({ period, actions, snapshots }) => ({
        period,
        actions: actions.reverse(),
        snapshots: snapshots.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
      }));
  }

  /**
   * Jump to a specific point in history
   */
  jumpTo(actionId: string): HistoryAction | null {
    const index = this.actions.findIndex((a) => a.id === actionId);
    if (index === -1) return null;

    const previousIndex = this.currentIndex;
    this.currentIndex = index;

    this.emit({
      type: "jump",
      fromIndex: previousIndex,
      toIndex: index,
      action: this.actions[index],
    });

    return this.actions[index];
  }

  // ===========================================================================
  // DIFF
  // ===========================================================================

  /**
   * Get diff between two actions
   */
  getDiff(fromActionId: string, toActionId: string): DiffResult[] {
    const fromIndex = this.actions.findIndex((a) => a.id === fromActionId);
    const toIndex = this.actions.findIndex((a) => a.id === toActionId);

    if (fromIndex === -1 || toIndex === -1) {
      return [];
    }

    const diffs: DiffResult[] = [];
    const affectedPaths = new Set<string>();

    // Collect all affected paths between the two actions
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);

    for (let i = start + 1; i <= end; i++) {
      for (const path of this.actions[i].affectedPaths) {
        affectedPaths.add(path);
      }
    }

    // For each affected path, determine the change type
    for (const path of affectedPaths) {
      const fromAction = this.actions[fromIndex];
      const toAction = this.actions[toIndex];

      // Simplified diff - in a real implementation, we'd look at actual content
      diffs.push({
        path,
        type: "modified",
        oldValue: JSON.stringify(fromAction.after, null, 2),
        newValue: JSON.stringify(toAction.after, null, 2),
      });
    }

    return diffs;
  }

  /**
   * Get diff between current state and a snapshot
   */
  getDiffFromSnapshot(
    snapshotId: string,
    currentState: Record<string, unknown>
  ): DiffResult[] {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) return [];

    const diffs: DiffResult[] = [];
    const allPaths = new Set([
      ...Object.keys(snapshot.state),
      ...Object.keys(currentState),
    ]);

    for (const path of allPaths) {
      const oldValue = snapshot.state[path];
      const newValue = currentState[path];

      if (oldValue === undefined && newValue !== undefined) {
        diffs.push({
          path,
          type: "added",
          newValue: JSON.stringify(newValue, null, 2),
        });
      } else if (oldValue !== undefined && newValue === undefined) {
        diffs.push({
          path,
          type: "removed",
          oldValue: JSON.stringify(oldValue, null, 2),
        });
      } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        diffs.push({
          path,
          type: "modified",
          oldValue: JSON.stringify(oldValue, null, 2),
          newValue: JSON.stringify(newValue, null, 2),
        });
      }
    }

    return diffs;
  }

  // ===========================================================================
  // BRANCHES (Experimental)
  // ===========================================================================

  /**
   * Create a new branch from current point
   */
  createBranch(name: string): HistoryBranch {
    const branch: HistoryBranch = {
      id: this.generateId(),
      name,
      parentId: this.currentBranchId,
      forkActionId: this.actions[this.currentIndex]?.id,
      actions: [],
      createdAt: new Date(),
    };

    this.branches.set(branch.id, branch);
    this.emit({ type: "branch_created", branch });

    return branch;
  }

  /**
   * Switch to a branch (by ID or name)
   */
  switchBranch(branchIdOrName: string): boolean {
    // First try to find by ID
    if (this.branches.has(branchIdOrName)) {
      this.currentBranchId = branchIdOrName;
      this.emit({ type: "branch_switched", branchId: branchIdOrName });
      return true;
    }

    // Then try to find by name
    for (const [id, branch] of this.branches.entries()) {
      if (branch.name === branchIdOrName) {
        this.currentBranchId = id;
        this.emit({ type: "branch_switched", branchId: id });
        return true;
      }
    }

    return false;
  }

  /**
   * Get all branches
   */
  getBranches(): HistoryBranch[] {
    return Array.from(this.branches.values());
  }

  // ===========================================================================
  // STATS AND UTILITIES
  // ===========================================================================

  /**
   * Get history statistics
   */
  getStats(): HistoryStats {
    return {
      totalActions: this.actions.length,
      undoableCount: this.currentIndex + 1,
      redoableCount: this.actions.length - this.currentIndex - 1,
      snapshotsCount: this.snapshots.size,
      sessionDuration: Date.now() - this.sessionStart.getTime(),
    };
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.actions = [];
    this.currentIndex = -1;
    this.snapshots.clear();
    this.emit({ type: "cleared" });
  }

  /**
   * Export history for persistence
   */
  export(): {
    actions: HistoryAction[];
    currentIndex: number;
    snapshots: HistorySnapshot[];
    branches: HistoryBranch[];
    currentBranchId: string;
  } {
    return {
      actions: this.actions,
      currentIndex: this.currentIndex,
      snapshots: Array.from(this.snapshots.values()),
      branches: Array.from(this.branches.values()),
      currentBranchId: this.currentBranchId,
    };
  }

  /**
   * Import history from persistence
   */
  import(data: ReturnType<typeof this.export>): void {
    this.actions = data.actions.map((a) => ({
      ...a,
      timestamp: new Date(a.timestamp),
    }));
    this.currentIndex = data.currentIndex;
    this.snapshots = new Map(
      data.snapshots.map((s) => [s.id, { ...s, timestamp: new Date(s.timestamp) }])
    );
    this.branches = new Map(
      data.branches.map((b) => [b.id, { ...b, createdAt: new Date(b.createdAt) }])
    );
    this.currentBranchId = data.currentBranchId;
  }

  // ===========================================================================
  // EVENTS
  // ===========================================================================

  /**
   * Subscribe to history events
   */
  subscribe(listener: (event: HistoryEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: HistoryEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error("History event listener error:", e);
      }
    }
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private generateId(): string {
    return `h_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private checkAutoSnapshot(): void {
    const now = Date.now();
    if (now - this.lastAutoSnapshot.getTime() >= this.autoSnapshotInterval) {
      // Would create auto-snapshot here if we had current state
      this.lastAutoSnapshot = new Date();
    }
  }
}

// =============================================================================
// EVENT TYPES
// =============================================================================

export type HistoryEvent =
  | { type: "action_recorded"; action: HistoryAction }
  | { type: "undo"; action: HistoryAction }
  | { type: "redo"; action: HistoryAction }
  | { type: "jump"; fromIndex: number; toIndex: number; action: HistoryAction }
  | { type: "snapshot_created"; snapshot: HistorySnapshot }
  | { type: "snapshot_deleted"; snapshot: HistorySnapshot }
  | { type: "snapshot_restored"; snapshot: HistorySnapshot }
  | { type: "branch_created"; branch: HistoryBranch }
  | { type: "branch_switched"; branchId: string }
  | { type: "cleared" };

// =============================================================================
// REACT HOOK (if using React)
// =============================================================================

/**
 * Create a history-enabled state wrapper
 */
export function createHistoryState<T extends Record<string, unknown>>(
  initialState: T,
  historyManager: HistoryManager
): {
  getState: () => T;
  setState: (updater: Partial<T> | ((prev: T) => Partial<T>), description: string) => void;
  subscribe: (listener: (state: T) => void) => () => void;
} {
  let state = { ...initialState };
  const listeners = new Set<(state: T) => void>();

  return {
    getState: () => ({ ...state }),

    setState: (updater, description) => {
      const before = { ...state };
      const updates = typeof updater === "function" ? updater(state) : updater;
      state = { ...state, ...updates };

      // Record in history
      historyManager.record({
        type: "config_change",
        description,
        before,
        after: { ...state },
        affectedPaths: Object.keys(updates),
      });

      // Notify listeners
      for (const listener of listeners) {
        listener({ ...state });
      }
    },

    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// =============================================================================
// KEYBOARD SHORTCUTS HELPER
// =============================================================================

/**
 * Setup keyboard shortcuts for undo/redo
 */
export function setupHistoryShortcuts(
  historyManager: HistoryManager,
  handlers: {
    onUndo?: (action: HistoryAction) => void;
    onRedo?: (action: HistoryAction) => void;
  } = {}
): () => void {
  const handleKeyDown = (e: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const modifier = isMac ? e.metaKey : e.ctrlKey;

    if (modifier && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      const action = historyManager.undo();
      if (action && handlers.onUndo) {
        handlers.onUndo(action);
      }
    } else if (
      (modifier && e.key === "z" && e.shiftKey) ||
      (modifier && e.key === "y")
    ) {
      e.preventDefault();
      const action = historyManager.redo();
      if (action && handlers.onRedo) {
        handlers.onRedo(action);
      }
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }

  return () => {};
}
