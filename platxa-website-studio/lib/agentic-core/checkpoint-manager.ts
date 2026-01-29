/**
 * Checkpoint Manager - Rollback preparation before agent execution
 *
 * Creates checkpoints (Git commit or Yjs snapshot) before agent starts,
 * enabling safe rollback if execution fails or needs to be undone.
 *
 * @module agentic-core/checkpoint-manager
 */

import { execSync } from 'child_process';

// ============================================================================
// Types
// ============================================================================

/** Type of checkpoint to create */
export type CheckpointType = 'git' | 'yjs' | 'both';

/** Checkpoint metadata */
export interface Checkpoint {
  /** Unique checkpoint ID */
  id: string;
  /** Type of checkpoint */
  type: CheckpointType;
  /** Timestamp when created */
  createdAt: Date;
  /** Associated plan ID (if any) */
  planId?: string;
  /** Git commit hash (if git checkpoint) */
  gitCommitHash?: string;
  /** Yjs snapshot ID (if yjs checkpoint) */
  yjsSnapshotId?: string;
  /** Description of what this checkpoint precedes */
  description: string;
  /** Files that will be modified (for reference) */
  affectedFiles?: string[];
  /** Workspace root */
  workspaceRoot: string;
}

/** Result of checkpoint creation */
export interface CheckpointResult {
  /** Whether checkpoint was successfully created */
  success: boolean;
  /** The created checkpoint (if successful) */
  checkpoint?: Checkpoint;
  /** Error message (if failed) */
  error?: string;
  /** Warnings (non-fatal issues) */
  warnings?: string[];
}

/** Result of rollback operation */
export interface RollbackResult {
  /** Whether rollback was successful */
  success: boolean;
  /** The checkpoint that was rolled back to */
  checkpoint?: Checkpoint;
  /** Error message (if failed) */
  error?: string;
  /** Files that were restored */
  restoredFiles?: string[];
}

/** Yjs document interface (simplified) */
export interface YjsDocument {
  /** Get document state as Uint8Array */
  encodeStateAsUpdate(): Uint8Array;
  /** Apply update to restore state */
  applyUpdate(update: Uint8Array): void;
}

/** Yjs provider interface */
export interface YjsProvider {
  /** Get the Yjs document */
  getDocument(): YjsDocument;
  /** Create a snapshot of current state */
  createSnapshot(): string;
  /** Restore from a snapshot */
  restoreSnapshot(snapshotId: string): boolean;
}

/** Configuration for CheckpointManager */
export interface CheckpointManagerConfig {
  /** Default checkpoint type */
  defaultType?: CheckpointType;
  /** Workspace root directory */
  workspaceRoot: string;
  /** Optional Yjs provider for collaborative snapshots */
  yjsProvider?: YjsProvider;
  /** Whether to auto-clean old checkpoints */
  autoCleanup?: boolean;
  /** Maximum checkpoints to keep */
  maxCheckpoints?: number;
  /** Git commit message prefix */
  gitCommitPrefix?: string;
}

// ============================================================================
// Checkpoint Manager Class
// ============================================================================

/**
 * CheckpointManager - Creates rollback points before agent execution
 *
 * Feature #57: Git commit or Yjs snapshot created before agent starts
 *
 * @example
 * ```typescript
 * const manager = new CheckpointManager({
 *   workspaceRoot: '/path/to/project',
 *   defaultType: 'git',
 * });
 *
 * // Before agent execution
 * const result = await manager.createCheckpoint({
 *   planId: 'plan-123',
 *   description: 'Before implementing login feature',
 *   affectedFiles: ['src/auth.ts', 'src/login.tsx'],
 * });
 *
 * if (result.success) {
 *   // Agent executes...
 *   // If something goes wrong:
 *   await manager.rollback(result.checkpoint!.id);
 * }
 * ```
 */
export class CheckpointManager {
  private config: Required<Omit<CheckpointManagerConfig, 'yjsProvider'>> & {
    yjsProvider?: YjsProvider;
  };
  private checkpoints: Map<string, Checkpoint> = new Map();

  constructor(config: CheckpointManagerConfig) {
    this.config = {
      defaultType: config.defaultType || 'git',
      workspaceRoot: config.workspaceRoot,
      yjsProvider: config.yjsProvider,
      autoCleanup: config.autoCleanup ?? true,
      maxCheckpoints: config.maxCheckpoints ?? 10,
      gitCommitPrefix: config.gitCommitPrefix ?? '[checkpoint]',
    };
  }

  /**
   * Create a checkpoint before agent execution
   *
   * This is the main method for Feature #57 - creates a rollback point
   */
  async createCheckpoint(params: {
    planId?: string;
    description: string;
    affectedFiles?: string[];
    type?: CheckpointType;
  }): Promise<CheckpointResult> {
    const type = params.type || this.config.defaultType;
    const checkpointId = this.generateCheckpointId();

    const checkpoint: Checkpoint = {
      id: checkpointId,
      type,
      createdAt: new Date(),
      planId: params.planId,
      description: params.description,
      affectedFiles: params.affectedFiles,
      workspaceRoot: this.config.workspaceRoot,
    };

    const warnings: string[] = [];

    try {
      // Create Git checkpoint
      if (type === 'git' || type === 'both') {
        const gitResult = await this.createGitCheckpoint(checkpoint);
        if (gitResult.success) {
          checkpoint.gitCommitHash = gitResult.commitHash;
        } else {
          if (type === 'git') {
            return { success: false, error: gitResult.error };
          }
          warnings.push(`Git checkpoint failed: ${gitResult.error}`);
        }
      }

      // Create Yjs checkpoint
      if (type === 'yjs' || type === 'both') {
        const yjsResult = await this.createYjsCheckpoint(checkpoint);
        if (yjsResult.success) {
          checkpoint.yjsSnapshotId = yjsResult.snapshotId;
        } else {
          if (type === 'yjs') {
            return { success: false, error: yjsResult.error };
          }
          warnings.push(`Yjs checkpoint failed: ${yjsResult.error}`);
        }
      }

      // Store checkpoint
      this.checkpoints.set(checkpointId, checkpoint);

      // Auto cleanup old checkpoints
      if (this.config.autoCleanup) {
        this.cleanupOldCheckpoints();
      }

      return {
        success: true,
        checkpoint,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating checkpoint',
      };
    }
  }

  /**
   * Create a Git commit checkpoint
   */
  private async createGitCheckpoint(checkpoint: Checkpoint): Promise<{
    success: boolean;
    commitHash?: string;
    error?: string;
  }> {
    try {
      // Check if in a git repository
      const isGitRepo = this.isGitRepository();
      if (!isGitRepo) {
        return { success: false, error: 'Not a git repository' };
      }

      // Check for uncommitted changes
      const hasChanges = this.hasUncommittedChanges();
      if (!hasChanges) {
        // No changes to checkpoint, get current HEAD
        const currentHead = this.getGitHead();
        return { success: true, commitHash: currentHead };
      }

      // Stage all changes
      execSync('git add -A', {
        cwd: this.config.workspaceRoot,
        encoding: 'utf-8',
      });

      // Create checkpoint commit
      const commitMessage = `${this.config.gitCommitPrefix} ${checkpoint.description}`;
      execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
        cwd: this.config.workspaceRoot,
        encoding: 'utf-8',
      });

      // Get the commit hash
      const commitHash = this.getGitHead();

      return { success: true, commitHash };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Git checkpoint failed',
      };
    }
  }

  /**
   * Create a Yjs snapshot checkpoint
   */
  private async createYjsCheckpoint(checkpoint: Checkpoint): Promise<{
    success: boolean;
    snapshotId?: string;
    error?: string;
  }> {
    if (!this.config.yjsProvider) {
      return { success: false, error: 'No Yjs provider configured' };
    }

    try {
      const snapshotId = this.config.yjsProvider.createSnapshot();
      return { success: true, snapshotId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Yjs snapshot failed',
      };
    }
  }

  /**
   * Rollback to a checkpoint
   */
  async rollback(checkpointId: string): Promise<RollbackResult> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      return { success: false, error: `Checkpoint '${checkpointId}' not found` };
    }

    const restoredFiles: string[] = [];

    try {
      // Rollback Git
      if (checkpoint.gitCommitHash) {
        const gitResult = await this.rollbackGit(checkpoint.gitCommitHash);
        if (!gitResult.success) {
          return { success: false, error: gitResult.error, checkpoint };
        }
        restoredFiles.push(...(checkpoint.affectedFiles || []));
      }

      // Rollback Yjs
      if (checkpoint.yjsSnapshotId && this.config.yjsProvider) {
        const yjsResult = this.config.yjsProvider.restoreSnapshot(checkpoint.yjsSnapshotId);
        if (!yjsResult) {
          return { success: false, error: 'Yjs rollback failed', checkpoint };
        }
      }

      return { success: true, checkpoint, restoredFiles };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Rollback failed',
        checkpoint,
      };
    }
  }

  /**
   * Rollback Git to a specific commit
   */
  private async rollbackGit(commitHash: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Use git reset --hard to restore to checkpoint
      execSync(`git reset --hard ${commitHash}`, {
        cwd: this.config.workspaceRoot,
        encoding: 'utf-8',
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Git rollback failed',
      };
    }
  }

  /**
   * Get a checkpoint by ID
   */
  getCheckpoint(checkpointId: string): Checkpoint | undefined {
    return this.checkpoints.get(checkpointId);
  }

  /**
   * Get all checkpoints
   */
  getAllCheckpoints(): Checkpoint[] {
    return Array.from(this.checkpoints.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  /**
   * Get the latest checkpoint
   */
  getLatestCheckpoint(): Checkpoint | undefined {
    const checkpoints = this.getAllCheckpoints();
    return checkpoints[0];
  }

  /**
   * Delete a checkpoint
   */
  deleteCheckpoint(checkpointId: string): boolean {
    return this.checkpoints.delete(checkpointId);
  }

  /**
   * Clean up old checkpoints beyond max limit
   */
  private cleanupOldCheckpoints(): void {
    const checkpoints = this.getAllCheckpoints();
    if (checkpoints.length > this.config.maxCheckpoints) {
      const toDelete = checkpoints.slice(this.config.maxCheckpoints);
      for (const checkpoint of toDelete) {
        this.checkpoints.delete(checkpoint.id);
      }
    }
  }

  /**
   * Check if current directory is a git repository
   */
  private isGitRepository(): boolean {
    try {
      execSync('git rev-parse --git-dir', {
        cwd: this.config.workspaceRoot,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if there are uncommitted changes
   */
  private hasUncommittedChanges(): boolean {
    try {
      const status = execSync('git status --porcelain', {
        cwd: this.config.workspaceRoot,
        encoding: 'utf-8',
      });
      return status.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get current git HEAD commit hash
   */
  private getGitHead(): string {
    try {
      return execSync('git rev-parse HEAD', {
        cwd: this.config.workspaceRoot,
        encoding: 'utf-8',
      }).trim();
    } catch {
      return '';
    }
  }

  /**
   * Generate unique checkpoint ID
   */
  private generateCheckpointId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `ckpt-${timestamp}-${random}`;
  }

  /**
   * Prepare for agent execution (convenience method)
   *
   * Creates a checkpoint and returns a cleanup function
   */
  async prepareForExecution(params: {
    planId?: string;
    description: string;
    affectedFiles?: string[];
  }): Promise<{
    checkpoint: Checkpoint | null;
    rollback: () => Promise<RollbackResult>;
  }> {
    const result = await this.createCheckpoint(params);

    return {
      checkpoint: result.checkpoint || null,
      rollback: async () => {
        if (result.checkpoint) {
          return this.rollback(result.checkpoint.id);
        }
        return { success: false, error: 'No checkpoint to rollback to' };
      },
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new CheckpointManager
 */
export function createCheckpointManager(config: CheckpointManagerConfig): CheckpointManager {
  return new CheckpointManager(config);
}

/**
 * Create a checkpoint before agent execution (convenience function)
 */
export async function createPreExecutionCheckpoint(
  workspaceRoot: string,
  description: string,
  options?: {
    planId?: string;
    affectedFiles?: string[];
    type?: CheckpointType;
  }
): Promise<CheckpointResult> {
  const manager = new CheckpointManager({ workspaceRoot });
  return manager.createCheckpoint({
    description,
    ...options,
  });
}

// ============================================================================
// Exports
// ============================================================================

export default CheckpointManager;
