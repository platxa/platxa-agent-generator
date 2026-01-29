/**
 * Version Restore Service — One-Click Restore to Previous Version
 *
 * Provides a workflow for restoring previous versions:
 * 1. Click version → show confirmation
 * 2. Confirm → files restored
 * 3. Preview updated with restored content
 */

import type { Snapshot, Timeline, RestoreResult } from "./snapshot-timeline";
import { restoreSnapshot, restoreById, getCurrentSnapshot } from "./snapshot-timeline";

// =============================================================================
// Types
// =============================================================================

/** Restore confirmation state */
export type RestoreConfirmationState =
  | "idle"
  | "pending_confirmation"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "error";

/** Restore request initiated by clicking a version */
export interface RestoreRequest {
  /** Target snapshot ID to restore */
  snapshotId: string;
  /** Target snapshot index */
  snapshotIndex: number;
  /** Timestamp of request */
  requestedAt: Date;
  /** Current snapshot before restore (for undo) */
  previousSnapshotId?: string;
}

/** Result of restore operation */
export interface VersionRestoreResult {
  /** Whether restore was successful */
  success: boolean;
  /** Restored snapshot */
  restoredSnapshot?: Snapshot;
  /** Updated timeline */
  updatedTimeline?: Timeline;
  /** HTML content to update preview */
  html?: string;
  /** SCSS content to update preview */
  scss?: string;
  /** Error message if failed */
  error?: string;
  /** Timestamp of completion */
  completedAt: Date;
}

/** Restore workflow state */
export interface RestoreWorkflowState {
  /** Current confirmation state */
  state: RestoreConfirmationState;
  /** Pending restore request */
  pendingRequest?: RestoreRequest;
  /** Last restore result */
  lastResult?: VersionRestoreResult;
  /** Whether preview needs update */
  previewNeedsUpdate: boolean;
}

/** Callback for preview update */
export type PreviewUpdateCallback = (html: string, scss: string) => void;

// =============================================================================
// Constants
// =============================================================================

/** Default confirmation messages */
export const RESTORE_MESSAGES = {
  confirmTitle: "Restore Version",
  confirmMessage: "Are you sure you want to restore this version? Current changes will be saved as a new version.",
  confirmButton: "Restore",
  cancelButton: "Cancel",
  successMessage: "Version restored successfully",
  errorMessage: "Failed to restore version",
} as const;

/** Restore state labels for UI */
export const RESTORE_STATE_LABELS: Record<RestoreConfirmationState, string> = {
  idle: "Ready",
  pending_confirmation: "Awaiting confirmation",
  confirmed: "Restoring...",
  cancelled: "Cancelled",
  completed: "Restored",
  error: "Error",
};

// =============================================================================
// Version Restore Service
// =============================================================================

/**
 * Service for one-click version restore with confirmation workflow.
 */
export class VersionRestoreService {
  private workflowState: RestoreWorkflowState = {
    state: "idle",
    previewNeedsUpdate: false,
  };
  private previewCallback?: PreviewUpdateCallback;

  /**
   * Gets current workflow state.
   */
  getState(): RestoreWorkflowState {
    return { ...this.workflowState };
  }

  /**
   * Gets confirmation state.
   */
  getConfirmationState(): RestoreConfirmationState {
    return this.workflowState.state;
  }

  /**
   * Checks if a restore is pending confirmation.
   */
  isPendingConfirmation(): boolean {
    return this.workflowState.state === "pending_confirmation";
  }

  /**
   * Sets the preview update callback.
   */
  setPreviewCallback(callback: PreviewUpdateCallback): void {
    this.previewCallback = callback;
  }

  /**
   * Step 1: Click version - Initiates restore with confirmation request.
   */
  requestRestore(
    snapshotId: string,
    snapshotIndex: number,
    timeline: Timeline
  ): RestoreWorkflowState {
    const currentSnapshot = getCurrentSnapshot(timeline);

    this.workflowState = {
      state: "pending_confirmation",
      pendingRequest: {
        snapshotId,
        snapshotIndex,
        requestedAt: new Date(),
        previousSnapshotId: currentSnapshot?.id,
      },
      previewNeedsUpdate: false,
    };

    return this.getState();
  }

  /**
   * Step 2a: Confirm restore - Executes the restore operation.
   * Returns updated timeline and triggers preview update.
   */
  confirmRestore(timeline: Timeline): {
    result: VersionRestoreResult;
    updatedTimeline: Timeline;
  } {
    if (this.workflowState.state !== "pending_confirmation" || !this.workflowState.pendingRequest) {
      const errorResult: VersionRestoreResult = {
        success: false,
        error: "No pending restore request",
        completedAt: new Date(),
      };
      return { result: errorResult, updatedTimeline: timeline };
    }

    this.workflowState.state = "confirmed";

    const { snapshotId, snapshotIndex } = this.workflowState.pendingRequest;

    // Restore the snapshot
    const restoreResult = restoreById(timeline, snapshotId) || restoreSnapshot(timeline, snapshotIndex);

    if (!restoreResult) {
      const errorResult: VersionRestoreResult = {
        success: false,
        error: "Snapshot not found",
        completedAt: new Date(),
      };
      this.workflowState = {
        state: "error",
        lastResult: errorResult,
        previewNeedsUpdate: false,
      };
      return { result: errorResult, updatedTimeline: timeline };
    }

    // Create updated timeline with new current index
    const updatedTimeline: Timeline = {
      ...timeline,
      currentIndex: restoreResult.currentIndex,
    };

    const result: VersionRestoreResult = {
      success: true,
      restoredSnapshot: restoreResult.snapshot,
      updatedTimeline,
      html: restoreResult.snapshot.html,
      scss: restoreResult.snapshot.scss,
      completedAt: new Date(),
    };

    // Step 3: Trigger preview update
    if (this.previewCallback) {
      this.previewCallback(restoreResult.snapshot.html, restoreResult.snapshot.scss);
    }

    this.workflowState = {
      state: "completed",
      lastResult: result,
      previewNeedsUpdate: !this.previewCallback, // True if no callback to handle update
    };

    return { result, updatedTimeline };
  }

  /**
   * Step 2b: Cancel restore - Cancels the pending restore request.
   */
  cancelRestore(): RestoreWorkflowState {
    if (this.workflowState.state !== "pending_confirmation") {
      return this.getState();
    }

    this.workflowState = {
      state: "cancelled",
      previewNeedsUpdate: false,
    };

    return this.getState();
  }

  /**
   * Resets the workflow state to idle.
   */
  reset(): void {
    this.workflowState = {
      state: "idle",
      previewNeedsUpdate: false,
    };
  }

  /**
   * Marks preview as updated (clears the flag).
   */
  markPreviewUpdated(): void {
    this.workflowState.previewNeedsUpdate = false;
  }

  /**
   * One-click restore: Combines request + confirm in one call (for auto-confirm UX).
   */
  oneClickRestore(
    snapshotId: string,
    snapshotIndex: number,
    timeline: Timeline
  ): { result: VersionRestoreResult; updatedTimeline: Timeline } {
    this.requestRestore(snapshotId, snapshotIndex, timeline);
    return this.confirmRestore(timeline);
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a VersionRestoreService instance.
 */
export function createVersionRestoreService(): VersionRestoreService {
  return new VersionRestoreService();
}

/**
 * Quick one-click restore without service instantiation.
 */
export function quickRestore(
  snapshotId: string,
  timeline: Timeline,
  onPreviewUpdate?: PreviewUpdateCallback
): { result: VersionRestoreResult; updatedTimeline: Timeline } {
  const service = new VersionRestoreService();
  if (onPreviewUpdate) {
    service.setPreviewCallback(onPreviewUpdate);
  }

  const index = timeline.snapshots.findIndex((s) => s.id === snapshotId);
  if (index === -1) {
    return {
      result: {
        success: false,
        error: "Snapshot not found",
        completedAt: new Date(),
      },
      updatedTimeline: timeline,
    };
  }

  return service.oneClickRestore(snapshotId, index, timeline);
}

/**
 * Checks if a version can be restored.
 */
export function canRestoreVersion(
  snapshotId: string,
  timeline: Timeline
): boolean {
  const index = timeline.snapshots.findIndex((s) => s.id === snapshotId);
  return index !== -1 && index !== timeline.currentIndex;
}

/**
 * Gets the version that would be restored.
 */
export function getRestoreTarget(
  snapshotId: string,
  timeline: Timeline
): Snapshot | null {
  return timeline.snapshots.find((s) => s.id === snapshotId) || null;
}
