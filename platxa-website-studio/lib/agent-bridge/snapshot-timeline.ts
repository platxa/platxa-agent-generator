/**
 * Snapshot Timeline — Version History for Generation Steps
 *
 * Manages a timeline of page snapshots with thumbnail references,
 * timestamps, and restore capability for each generation step.
 */

// =============================================================================
// Types
// =============================================================================

/** A single snapshot in the timeline */
export interface Snapshot {
  /** Unique snapshot ID */
  id: string;
  /** ISO timestamp */
  timestamp: string;
  /** Human-readable label (e.g. "Initial generation", "Color update") */
  label: string;
  /** Thumbnail data URL or path */
  thumbnail: string;
  /** Full page HTML at this point */
  html: string;
  /** Full page SCSS at this point */
  scss: string;
  /** Generation step number (1-based) */
  step: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/** Timeline state */
export interface Timeline {
  /** All snapshots in chronological order */
  snapshots: Snapshot[];
  /** Current active snapshot index */
  currentIndex: number;
  /** Maximum snapshots to keep (0 = unlimited) */
  maxSnapshots: number;
}

/** Result of restoring a snapshot */
export interface RestoreResult {
  /** The restored snapshot */
  snapshot: Snapshot;
  /** New current index */
  currentIndex: number;
  /** Whether future snapshots were discarded */
  discardedFuture: boolean;
  /** Number of snapshots discarded */
  discardedCount: number;
}

/** Diff between two snapshots */
export interface SnapshotDiff {
  /** Whether HTML changed */
  htmlChanged: boolean;
  /** Whether SCSS changed */
  scssChanged: boolean;
  /** HTML size change in bytes */
  htmlSizeDelta: number;
  /** SCSS size change in bytes */
  scssSizeDelta: number;
  /** Time elapsed between snapshots in ms */
  elapsedMs: number;
}

// =============================================================================
// Timeline Management
// =============================================================================

let snapshotCounter = 0;

/**
 * Resets the snapshot ID counter (for testing).
 */
export function resetSnapshotCounter(): void {
  snapshotCounter = 0;
}

/**
 * Creates a new empty timeline.
 */
export function createTimeline(maxSnapshots: number = 50): Timeline {
  return { snapshots: [], currentIndex: -1, maxSnapshots };
}

/**
 * Adds a snapshot to the timeline. If we're not at the end (i.e. user
 * restored an older version), future snapshots are discarded.
 */
export function addSnapshot(
  timeline: Timeline,
  html: string,
  scss: string,
  label: string,
  thumbnail: string = "",
  metadata?: Record<string, unknown>,
): Timeline {
  snapshotCounter++;
  const snapshot: Snapshot = {
    id: `snap_${snapshotCounter}`,
    timestamp: new Date().toISOString(),
    label,
    thumbnail,
    html,
    scss,
    step: snapshotCounter,
    metadata,
  };

  // Discard any snapshots after current position
  const snapshots = timeline.snapshots.slice(0, timeline.currentIndex + 1);
  snapshots.push(snapshot);

  // Enforce max limit
  const trimmed = timeline.maxSnapshots > 0 && snapshots.length > timeline.maxSnapshots
    ? snapshots.slice(snapshots.length - timeline.maxSnapshots)
    : snapshots;

  return {
    ...timeline,
    snapshots: trimmed,
    currentIndex: trimmed.length - 1,
  };
}

/**
 * Restores a snapshot by index, making it the current version.
 * Does NOT discard future snapshots (they remain for redo).
 */
export function restoreSnapshot(
  timeline: Timeline,
  index: number,
): RestoreResult | null {
  if (index < 0 || index >= timeline.snapshots.length) return null;

  return {
    snapshot: timeline.snapshots[index],
    currentIndex: index,
    discardedFuture: false,
    discardedCount: 0,
  };
}

/**
 * Restores a snapshot by ID.
 */
export function restoreById(
  timeline: Timeline,
  snapshotId: string,
): RestoreResult | null {
  const index = timeline.snapshots.findIndex((s) => s.id === snapshotId);
  if (index === -1) return null;
  return restoreSnapshot(timeline, index);
}

/**
 * Gets the current snapshot (or null if timeline is empty).
 */
export function getCurrentSnapshot(timeline: Timeline): Snapshot | null {
  if (timeline.currentIndex < 0 || timeline.currentIndex >= timeline.snapshots.length) return null;
  return timeline.snapshots[timeline.currentIndex];
}

/**
 * Checks if undo is possible.
 */
export function canUndo(timeline: Timeline): boolean {
  return timeline.currentIndex > 0;
}

/**
 * Checks if redo is possible.
 */
export function canRedo(timeline: Timeline): boolean {
  return timeline.currentIndex < timeline.snapshots.length - 1;
}

/**
 * Undoes to the previous snapshot.
 */
export function undo(timeline: Timeline): Timeline {
  if (!canUndo(timeline)) return timeline;
  return { ...timeline, currentIndex: timeline.currentIndex - 1 };
}

/**
 * Redoes to the next snapshot.
 */
export function redo(timeline: Timeline): Timeline {
  if (!canRedo(timeline)) return timeline;
  return { ...timeline, currentIndex: timeline.currentIndex + 1 };
}

/**
 * Computes the diff between two snapshots.
 */
export function diffSnapshots(a: Snapshot, b: Snapshot): SnapshotDiff {
  return {
    htmlChanged: a.html !== b.html,
    scssChanged: a.scss !== b.scss,
    htmlSizeDelta: b.html.length - a.html.length,
    scssSizeDelta: b.scss.length - a.scss.length,
    elapsedMs: new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  };
}

/**
 * Returns a summary of the timeline for display.
 */
export function getTimelineSummary(timeline: Timeline): Array<{
  id: string;
  label: string;
  timestamp: string;
  step: number;
  isCurrent: boolean;
  thumbnail: string;
}> {
  return timeline.snapshots.map((s, i) => ({
    id: s.id,
    label: s.label,
    timestamp: s.timestamp,
    step: s.step,
    isCurrent: i === timeline.currentIndex,
    thumbnail: s.thumbnail,
  }));
}
