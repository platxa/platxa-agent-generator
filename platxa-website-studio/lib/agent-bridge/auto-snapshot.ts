/**
 * Auto Snapshot Service — Automatic Capture After Successful Generation
 *
 * Automatically captures git commits or file snapshots after each
 * successful generation, providing version history and rollback capability.
 */

import type { Timeline, Snapshot } from "./snapshot-timeline";
import { addSnapshot } from "./snapshot-timeline";
import type { GitCommit, GitOperationResult } from "../git";
import { generateCommitMessage } from "../git";

// =============================================================================
// Types
// =============================================================================

/** Snapshot capture method */
export type SnapshotMethod = "git" | "file" | "both";

/** Configuration for auto snapshot */
export interface AutoSnapshotConfig {
  /** Whether auto-snapshot is enabled */
  enabled: boolean;
  /** Snapshot method: git commit, file snapshot, or both */
  method: SnapshotMethod;
  /** Whether to capture thumbnail */
  captureThumbnail: boolean;
  /** Maximum snapshots to keep (0 = unlimited) */
  maxSnapshots: number;
  /** Commit message prefix */
  commitPrefix: string;
}

/** Result of auto-snapshot capture */
export interface AutoSnapshotResult {
  /** Whether capture was successful */
  success: boolean;
  /** Capture method used */
  method: SnapshotMethod;
  /** Git commit if created */
  gitCommit?: GitCommit;
  /** File snapshot if created */
  fileSnapshot?: Snapshot;
  /** Error message if failed */
  error?: string;
  /** Timestamp of capture */
  timestamp: Date;
}

/** Generation result for snapshot capture */
export interface GenerationResult {
  /** Whether generation was successful */
  success: boolean;
  /** Generated HTML content */
  html: string;
  /** Generated SCSS content */
  scss: string;
  /** Generation label/description */
  label: string;
  /** Optional thumbnail data URL */
  thumbnail?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/** Git service interface for snapshot integration */
export interface GitServiceInterface {
  saveChanges(
    files: Array<{ path: string; content: string; type?: string }>,
    message: string
  ): GitOperationResult;
  getHistory(limit?: number): GitCommit[];
}

// =============================================================================
// Constants
// =============================================================================

/** Default configuration */
export const DEFAULT_AUTO_SNAPSHOT_CONFIG: AutoSnapshotConfig = {
  enabled: true,
  method: "both",
  captureThumbnail: true,
  maxSnapshots: 50,
  commitPrefix: "auto",
};

/** Snapshot method labels */
export const SNAPSHOT_METHOD_LABELS: Record<SnapshotMethod, string> = {
  git: "Git Commit",
  file: "File Snapshot",
  both: "Git + File Snapshot",
};

// =============================================================================
// Auto Snapshot Service
// =============================================================================

/**
 * Service for automatic snapshot capture after successful generation.
 */
export class AutoSnapshotService {
  private config: AutoSnapshotConfig;
  private gitService?: GitServiceInterface;
  private captureCount: number = 0;

  constructor(
    config: Partial<AutoSnapshotConfig> = {},
    gitService?: GitServiceInterface
  ) {
    this.config = { ...DEFAULT_AUTO_SNAPSHOT_CONFIG, ...config };
    this.gitService = gitService;
  }

  /**
   * Gets the current configuration.
   */
  getConfig(): AutoSnapshotConfig {
    return { ...this.config };
  }

  /**
   * Updates configuration.
   */
  setConfig(config: Partial<AutoSnapshotConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Enables auto-snapshot.
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disables auto-snapshot.
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * Checks if auto-snapshot is enabled.
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Gets the snapshot method.
   */
  getMethod(): SnapshotMethod {
    return this.config.method;
  }

  /**
   * Sets the snapshot method.
   */
  setMethod(method: SnapshotMethod): void {
    this.config.method = method;
  }

  /**
   * Gets the total capture count.
   */
  getCaptureCount(): number {
    return this.captureCount;
  }

  /**
   * Captures a snapshot after successful generation.
   * Returns the capture result with git commit and/or file snapshot.
   */
  captureAfterGeneration(
    result: GenerationResult,
    timeline: Timeline
  ): { autoResult: AutoSnapshotResult; updatedTimeline: Timeline } {
    const timestamp = new Date();

    if (!this.config.enabled) {
      return {
        autoResult: {
          success: false,
          method: this.config.method,
          error: "Auto-snapshot is disabled",
          timestamp,
        },
        updatedTimeline: timeline,
      };
    }

    if (!result.success) {
      return {
        autoResult: {
          success: false,
          method: this.config.method,
          error: "Generation was not successful",
          timestamp,
        },
        updatedTimeline: timeline,
      };
    }

    this.captureCount++;

    let gitCommit: GitCommit | undefined;
    let fileSnapshot: Snapshot | undefined;
    let updatedTimeline = timeline;
    let error: string | undefined;

    // Capture git commit if configured
    if (
      (this.config.method === "git" || this.config.method === "both") &&
      this.gitService
    ) {
      const commitResult = this.captureGitCommit(result);
      if (commitResult.success && commitResult.commit) {
        gitCommit = commitResult.commit;
      } else {
        error = commitResult.error;
      }
    }

    // Capture file snapshot if configured
    if (this.config.method === "file" || this.config.method === "both") {
      const snapshotResult = this.captureFileSnapshot(result, timeline);
      fileSnapshot = snapshotResult.snapshot;
      updatedTimeline = snapshotResult.timeline;
    }

    const success = Boolean(gitCommit || fileSnapshot);

    return {
      autoResult: {
        success,
        method: this.config.method,
        gitCommit,
        fileSnapshot,
        error: success ? undefined : error || "Failed to capture snapshot",
        timestamp,
      },
      updatedTimeline,
    };
  }

  /**
   * Captures a git commit for the generation.
   */
  private captureGitCommit(result: GenerationResult): {
    success: boolean;
    commit?: GitCommit;
    error?: string;
  } {
    if (!this.gitService) {
      return { success: false, error: "Git service not available" };
    }

    const message = generateCommitMessage(
      "feat",
      this.config.commitPrefix,
      result.label
    );

    const files = [
      { path: "views/snippets.xml", content: result.html, type: "xml" as const },
      { path: "static/src/scss/theme.scss", content: result.scss, type: "scss" as const },
    ];

    const opResult = this.gitService.saveChanges(files, message);

    if (opResult.success && opResult.data?.commit) {
      return { success: true, commit: opResult.data.commit as GitCommit };
    }

    return { success: false, error: opResult.error };
  }

  /**
   * Captures a file snapshot for the generation.
   */
  private captureFileSnapshot(
    result: GenerationResult,
    timeline: Timeline
  ): { snapshot: Snapshot; timeline: Timeline } {
    const updatedTimeline = addSnapshot(
      timeline,
      result.html,
      result.scss,
      result.label,
      this.config.captureThumbnail ? result.thumbnail || "" : "",
      result.metadata
    );

    const snapshot = updatedTimeline.snapshots[updatedTimeline.currentIndex];

    return { snapshot, timeline: updatedTimeline };
  }

  /**
   * Resets the capture counter (for testing).
   */
  resetCaptureCount(): void {
    this.captureCount = 0;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates an AutoSnapshotService with default configuration.
 */
export function createAutoSnapshotService(
  config?: Partial<AutoSnapshotConfig>,
  gitService?: GitServiceInterface
): AutoSnapshotService {
  return new AutoSnapshotService(config, gitService);
}

/**
 * Checks if a generation result should trigger auto-snapshot.
 */
export function shouldCaptureSnapshot(
  result: GenerationResult,
  config: AutoSnapshotConfig
): boolean {
  return config.enabled && result.success;
}

/**
 * Generates a snapshot label from generation context.
 */
export function generateSnapshotLabel(
  step: number,
  description?: string
): string {
  const base = `Generation #${step}`;
  return description ? `${base}: ${description}` : base;
}
