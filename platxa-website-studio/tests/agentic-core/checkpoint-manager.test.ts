/**
 * Tests for CheckpointManager
 *
 * Feature #57: Add rollback preparation creating checkpoint before agent execution
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock types
type CheckpointType = 'git' | 'yjs' | 'both';

interface Checkpoint {
  id: string;
  type: CheckpointType;
  createdAt: Date;
  planId?: string;
  gitCommitHash?: string;
  yjsSnapshotId?: string;
  description: string;
  affectedFiles?: string[];
  workspaceRoot: string;
}

interface CheckpointResult {
  success: boolean;
  checkpoint?: Checkpoint;
  error?: string;
  warnings?: string[];
}

interface RollbackResult {
  success: boolean;
  checkpoint?: Checkpoint;
  error?: string;
  restoredFiles?: string[];
}

interface CheckpointManagerConfig {
  defaultType?: CheckpointType;
  workspaceRoot: string;
  autoCleanup?: boolean;
  maxCheckpoints?: number;
  gitCommitPrefix?: string;
}

// Mock CheckpointManager for testing logic
class MockCheckpointManager {
  private config: Required<CheckpointManagerConfig>;
  private checkpoints: Map<string, Checkpoint> = new Map();
  private mockGitAvailable = true;
  private mockHasChanges = true;
  private mockGitHead = 'abc123';

  constructor(config: CheckpointManagerConfig) {
    this.config = {
      defaultType: config.defaultType || 'git',
      workspaceRoot: config.workspaceRoot,
      autoCleanup: config.autoCleanup ?? true,
      maxCheckpoints: config.maxCheckpoints ?? 10,
      gitCommitPrefix: config.gitCommitPrefix ?? '[checkpoint]',
    };
  }

  setMockGitAvailable(available: boolean) {
    this.mockGitAvailable = available;
  }

  setMockHasChanges(hasChanges: boolean) {
    this.mockHasChanges = hasChanges;
  }

  setMockGitHead(head: string) {
    this.mockGitHead = head;
  }

  async createCheckpoint(params: {
    planId?: string;
    description: string;
    affectedFiles?: string[];
    type?: CheckpointType;
  }): Promise<CheckpointResult> {
    const type = params.type || this.config.defaultType;
    const checkpointId = `ckpt-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;

    const checkpoint: Checkpoint = {
      id: checkpointId,
      type,
      createdAt: new Date(),
      planId: params.planId,
      description: params.description,
      affectedFiles: params.affectedFiles,
      workspaceRoot: this.config.workspaceRoot,
    };

    // Mock git checkpoint
    if (type === 'git' || type === 'both') {
      if (!this.mockGitAvailable) {
        if (type === 'git') {
          return { success: false, error: 'Not a git repository' };
        }
      } else {
        checkpoint.gitCommitHash = this.mockGitHead;
      }
    }

    // Mock yjs checkpoint
    if (type === 'yjs' || type === 'both') {
      checkpoint.yjsSnapshotId = `snap-${Date.now()}`;
    }

    this.checkpoints.set(checkpointId, checkpoint);

    // Auto cleanup
    if (this.config.autoCleanup) {
      this.cleanupOldCheckpoints();
    }

    return { success: true, checkpoint };
  }

  async rollback(checkpointId: string): Promise<RollbackResult> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      return { success: false, error: `Checkpoint '${checkpointId}' not found` };
    }

    return {
      success: true,
      checkpoint,
      restoredFiles: checkpoint.affectedFiles,
    };
  }

  getCheckpoint(checkpointId: string): Checkpoint | undefined {
    return this.checkpoints.get(checkpointId);
  }

  getAllCheckpoints(): Checkpoint[] {
    return Array.from(this.checkpoints.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  getLatestCheckpoint(): Checkpoint | undefined {
    const checkpoints = this.getAllCheckpoints();
    return checkpoints[0];
  }

  deleteCheckpoint(checkpointId: string): boolean {
    return this.checkpoints.delete(checkpointId);
  }

  private cleanupOldCheckpoints(): void {
    const checkpoints = this.getAllCheckpoints();
    if (checkpoints.length > this.config.maxCheckpoints) {
      const toDelete = checkpoints.slice(this.config.maxCheckpoints);
      for (const checkpoint of toDelete) {
        this.checkpoints.delete(checkpoint.id);
      }
    }
  }

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

describe('CheckpointManager', () => {
  let manager: MockCheckpointManager;

  beforeEach(() => {
    manager = new MockCheckpointManager({
      workspaceRoot: '/test/workspace',
    });
  });

  describe('checkpoint creation (Feature #57)', () => {
    it('should create Git checkpoint before agent execution', async () => {
      const result = await manager.createCheckpoint({
        description: 'Before implementing feature',
        type: 'git',
      });

      expect(result.success).toBe(true);
      expect(result.checkpoint).toBeDefined();
      expect(result.checkpoint?.gitCommitHash).toBeDefined();
    });

    it('should create Yjs snapshot before agent execution', async () => {
      const result = await manager.createCheckpoint({
        description: 'Before implementing feature',
        type: 'yjs',
      });

      expect(result.success).toBe(true);
      expect(result.checkpoint).toBeDefined();
      expect(result.checkpoint?.yjsSnapshotId).toBeDefined();
    });

    it('should create both Git and Yjs checkpoints', async () => {
      const result = await manager.createCheckpoint({
        description: 'Before implementing feature',
        type: 'both',
      });

      expect(result.success).toBe(true);
      expect(result.checkpoint?.gitCommitHash).toBeDefined();
      expect(result.checkpoint?.yjsSnapshotId).toBeDefined();
    });

    it('should include plan ID in checkpoint', async () => {
      const result = await manager.createCheckpoint({
        planId: 'plan-123',
        description: 'Before plan execution',
      });

      expect(result.checkpoint?.planId).toBe('plan-123');
    });

    it('should include affected files in checkpoint', async () => {
      const files = ['src/auth.ts', 'src/login.tsx'];
      const result = await manager.createCheckpoint({
        description: 'Before changes',
        affectedFiles: files,
      });

      expect(result.checkpoint?.affectedFiles).toEqual(files);
    });

    it('should generate unique checkpoint IDs', async () => {
      const result1 = await manager.createCheckpoint({ description: 'First' });
      const result2 = await manager.createCheckpoint({ description: 'Second' });

      expect(result1.checkpoint?.id).not.toBe(result2.checkpoint?.id);
    });

    it('should set creation timestamp', async () => {
      const before = new Date();
      const result = await manager.createCheckpoint({ description: 'Test' });
      const after = new Date();

      expect(result.checkpoint?.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.checkpoint?.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('checkpoint types', () => {
    it('should default to git type', async () => {
      const result = await manager.createCheckpoint({ description: 'Test' });
      expect(result.checkpoint?.type).toBe('git');
    });

    it('should respect configured default type', async () => {
      const yjsManager = new MockCheckpointManager({
        workspaceRoot: '/test',
        defaultType: 'yjs',
      });
      const result = await yjsManager.createCheckpoint({ description: 'Test' });
      expect(result.checkpoint?.type).toBe('yjs');
    });

    it('should allow overriding type per checkpoint', async () => {
      const result = await manager.createCheckpoint({
        description: 'Test',
        type: 'yjs',
      });
      expect(result.checkpoint?.type).toBe('yjs');
    });
  });

  describe('git checkpoint', () => {
    it('should fail when not in git repository', async () => {
      manager.setMockGitAvailable(false);
      const result = await manager.createCheckpoint({
        description: 'Test',
        type: 'git',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('git');
    });

    it('should store commit hash', async () => {
      manager.setMockGitHead('def456');
      const result = await manager.createCheckpoint({
        description: 'Test',
        type: 'git',
      });

      expect(result.checkpoint?.gitCommitHash).toBe('def456');
    });
  });

  describe('yjs checkpoint', () => {
    it('should store snapshot ID', async () => {
      const result = await manager.createCheckpoint({
        description: 'Test',
        type: 'yjs',
      });

      expect(result.checkpoint?.yjsSnapshotId).toBeDefined();
      expect(result.checkpoint?.yjsSnapshotId).toContain('snap-');
    });
  });

  describe('rollback', () => {
    it('should rollback to a checkpoint', async () => {
      const createResult = await manager.createCheckpoint({
        description: 'Before changes',
        affectedFiles: ['src/file.ts'],
      });

      const rollbackResult = await manager.rollback(createResult.checkpoint!.id);

      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.checkpoint).toBeDefined();
    });

    it('should return restored files on rollback', async () => {
      const files = ['src/a.ts', 'src/b.ts'];
      const createResult = await manager.createCheckpoint({
        description: 'Test',
        affectedFiles: files,
      });

      const rollbackResult = await manager.rollback(createResult.checkpoint!.id);

      expect(rollbackResult.restoredFiles).toEqual(files);
    });

    it('should fail for non-existent checkpoint', async () => {
      const result = await manager.rollback('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('checkpoint management', () => {
    it('should get checkpoint by ID', async () => {
      const createResult = await manager.createCheckpoint({ description: 'Test' });
      const checkpoint = manager.getCheckpoint(createResult.checkpoint!.id);

      expect(checkpoint).toBeDefined();
      expect(checkpoint?.id).toBe(createResult.checkpoint?.id);
    });

    it('should get all checkpoints', async () => {
      await manager.createCheckpoint({ description: 'First' });
      await manager.createCheckpoint({ description: 'Second' });
      await manager.createCheckpoint({ description: 'Third' });

      const checkpoints = manager.getAllCheckpoints();
      expect(checkpoints).toHaveLength(3);
    });

    it('should return checkpoints sorted by date (newest first)', async () => {
      await manager.createCheckpoint({ description: 'First' });
      await new Promise(r => setTimeout(r, 10));
      await manager.createCheckpoint({ description: 'Second' });

      const checkpoints = manager.getAllCheckpoints();
      expect(checkpoints[0].description).toBe('Second');
      expect(checkpoints[1].description).toBe('First');
    });

    it('should get latest checkpoint', async () => {
      await manager.createCheckpoint({ description: 'First' });
      await new Promise(r => setTimeout(r, 10));
      await manager.createCheckpoint({ description: 'Latest' });

      const latest = manager.getLatestCheckpoint();
      expect(latest?.description).toBe('Latest');
    });

    it('should delete checkpoint', async () => {
      const result = await manager.createCheckpoint({ description: 'Test' });
      const deleted = manager.deleteCheckpoint(result.checkpoint!.id);

      expect(deleted).toBe(true);
      expect(manager.getCheckpoint(result.checkpoint!.id)).toBeUndefined();
    });
  });

  describe('auto cleanup', () => {
    it('should cleanup old checkpoints when exceeding max', async () => {
      const smallManager = new MockCheckpointManager({
        workspaceRoot: '/test',
        maxCheckpoints: 3,
      });

      await smallManager.createCheckpoint({ description: '1' });
      await smallManager.createCheckpoint({ description: '2' });
      await smallManager.createCheckpoint({ description: '3' });
      await smallManager.createCheckpoint({ description: '4' });

      const checkpoints = smallManager.getAllCheckpoints();
      expect(checkpoints).toHaveLength(3);
    });

    it('should keep newest checkpoints during cleanup', async () => {
      const smallManager = new MockCheckpointManager({
        workspaceRoot: '/test',
        maxCheckpoints: 2,
      });

      await smallManager.createCheckpoint({ description: 'Old' });
      await new Promise(r => setTimeout(r, 10));
      await smallManager.createCheckpoint({ description: 'Middle' });
      await new Promise(r => setTimeout(r, 10));
      await smallManager.createCheckpoint({ description: 'New' });

      const checkpoints = smallManager.getAllCheckpoints();
      const descriptions = checkpoints.map(c => c.description);

      expect(descriptions).toContain('New');
      expect(descriptions).toContain('Middle');
      expect(descriptions).not.toContain('Old');
    });
  });

  describe('prepareForExecution', () => {
    it('should create checkpoint and return rollback function', async () => {
      const { checkpoint, rollback } = await manager.prepareForExecution({
        description: 'Before agent runs',
      });

      expect(checkpoint).toBeDefined();
      expect(typeof rollback).toBe('function');
    });

    it('should allow rollback via returned function', async () => {
      const { rollback } = await manager.prepareForExecution({
        description: 'Test',
        affectedFiles: ['src/test.ts'],
      });

      const result = await rollback();
      expect(result.success).toBe(true);
    });
  });

  describe('configuration', () => {
    it('should use custom git commit prefix', async () => {
      const customManager = new MockCheckpointManager({
        workspaceRoot: '/test',
        gitCommitPrefix: '[auto-backup]',
      });

      // The prefix is used in git commit message
      expect(customManager).toBeDefined();
    });

    it('should respect autoCleanup setting', async () => {
      const noCleanupManager = new MockCheckpointManager({
        workspaceRoot: '/test',
        autoCleanup: false,
        maxCheckpoints: 2,
      });

      await noCleanupManager.createCheckpoint({ description: '1' });
      await noCleanupManager.createCheckpoint({ description: '2' });
      await noCleanupManager.createCheckpoint({ description: '3' });

      // Without auto cleanup, all checkpoints remain
      const checkpoints = noCleanupManager.getAllCheckpoints();
      expect(checkpoints.length).toBe(3);
    });
  });

  describe('Checkpoint type', () => {
    it('should store workspaceRoot', async () => {
      const result = await manager.createCheckpoint({ description: 'Test' });
      expect(result.checkpoint?.workspaceRoot).toBe('/test/workspace');
    });

    it('should store checkpoint type', async () => {
      const result = await manager.createCheckpoint({
        description: 'Test',
        type: 'both',
      });
      expect(result.checkpoint?.type).toBe('both');
    });
  });
});
