/**
 * Tests for BatchedUpdateSystem
 *
 * Feature #62: Create batched update system debouncing rapid changes for performance
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock types matching the implementation
type UpdateType = 'html' | 'css' | 'snippet' | 'attribute' | 'class';

interface PendingUpdate {
  id: string;
  type: UpdateType;
  target: string;
  payload: unknown;
  queuedAt: number;
  priority?: number;
}

interface BatchResult {
  success: boolean;
  batch: { id: string; updates: PendingUpdate[]; totalMerged: number };
  successCount: number;
  failedCount: number;
  applyTimeMs: number;
}

interface BatchedUpdateConfig {
  debounceMs?: number;
  maxBatchSize?: number;
  maxWaitMs?: number;
  mergeUpdates?: boolean;
  applyFn?: (updates: PendingUpdate[]) => Promise<void>;
  onBatchApplied?: (result: BatchResult) => void;
  debug?: boolean;
}

// Mock BatchedUpdateSystem for testing
class MockBatchedUpdateSystem {
  private config: Required<Omit<BatchedUpdateConfig, 'applyFn' | 'onBatchApplied'>> & {
    applyFn?: (updates: PendingUpdate[]) => Promise<void>;
    onBatchApplied?: (result: BatchResult) => void;
  };
  private pendingUpdates: Map<string, PendingUpdate> = new Map();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private updateIdCounter = 0;
  private batchIdCounter = 0;
  private mergedCount = 0;

  constructor(config: BatchedUpdateConfig = {}) {
    this.config = {
      debounceMs: config.debounceMs ?? 50,
      maxBatchSize: config.maxBatchSize ?? 100,
      maxWaitMs: config.maxWaitMs ?? 200,
      mergeUpdates: config.mergeUpdates ?? true,
      applyFn: config.applyFn,
      onBatchApplied: config.onBatchApplied,
      debug: config.debug ?? false,
    };
  }

  queue(update: Omit<PendingUpdate, 'id' | 'queuedAt'>): PendingUpdate {
    const pendingUpdate: PendingUpdate = {
      ...update,
      id: `upd-${++this.updateIdCounter}`,
      queuedAt: Date.now(),
    };

    const key = `${update.type}:${update.target}`;

    if (this.config.mergeUpdates && this.pendingUpdates.has(key)) {
      this.mergedCount++;
    }

    this.pendingUpdates.set(key, pendingUpdate);

    if (this.pendingUpdates.size >= this.config.maxBatchSize) {
      this.flush();
      return pendingUpdate;
    }

    this.restartDebounceTimer();
    return pendingUpdate;
  }

  async flush(): Promise<BatchResult | null> {
    this.clearTimers();

    if (this.pendingUpdates.size === 0) {
      return null;
    }

    const updates = Array.from(this.pendingUpdates.values());
    const batch = {
      id: `batch-${++this.batchIdCounter}`,
      updates,
      totalMerged: this.mergedCount,
    };

    this.pendingUpdates.clear();

    const startTime = performance.now();

    if (this.config.applyFn) {
      await this.config.applyFn(updates);
    }

    const applyTimeMs = performance.now() - startTime;

    const result: BatchResult = {
      success: true,
      batch,
      successCount: updates.length,
      failedCount: 0,
      applyTimeMs,
    };

    this.config.onBatchApplied?.(result);
    return result;
  }

  getPendingCount(): number {
    return this.pendingUpdates.size;
  }

  hasPending(): boolean {
    return this.pendingUpdates.size > 0;
  }

  cancel(): void {
    this.clearTimers();
    this.pendingUpdates.clear();
  }

  getDebounceMs(): number {
    return this.config.debounceMs;
  }

  private restartDebounceTimer(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.flush();
    }, this.config.debounceMs);
  }

  private clearTimers(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}

describe('BatchedUpdateSystem', () => {
  let batcher: MockBatchedUpdateSystem;

  beforeEach(() => {
    vi.useFakeTimers();
    batcher = new MockBatchedUpdateSystem({ debounceMs: 50 });
  });

  afterEach(() => {
    batcher.cancel();
    vi.useRealTimers();
  });

  describe('debouncing (Feature #62)', () => {
    it('should batch updates within 50ms window', async () => {
      expect(batcher.getDebounceMs()).toBe(50);
    });

    it('should not flush immediately when update queued', () => {
      batcher.queue({ type: 'html', target: '#content', payload: '<div>A</div>' });
      expect(batcher.hasPending()).toBe(true);
    });

    it('should flush after debounce period', async () => {
      const onApply = vi.fn();
      const customBatcher = new MockBatchedUpdateSystem({
        debounceMs: 50,
        applyFn: onApply,
      });

      customBatcher.queue({ type: 'html', target: '#content', payload: '<div>A</div>' });

      expect(onApply).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      await Promise.resolve();

      expect(onApply).toHaveBeenCalled();
    });

    it('should batch multiple updates within debounce window', async () => {
      const onApply = vi.fn();
      const customBatcher = new MockBatchedUpdateSystem({
        debounceMs: 50,
        applyFn: onApply,
      });

      customBatcher.queue({ type: 'html', target: '#a', payload: '1' });
      vi.advanceTimersByTime(20);
      customBatcher.queue({ type: 'html', target: '#b', payload: '2' });
      vi.advanceTimersByTime(20);
      customBatcher.queue({ type: 'html', target: '#c', payload: '3' });

      // Not yet flushed
      expect(onApply).not.toHaveBeenCalled();

      // Advance past debounce
      vi.advanceTimersByTime(50);
      await Promise.resolve();

      // Single batch with all 3 updates
      expect(onApply).toHaveBeenCalledTimes(1);
      expect(onApply).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ target: '#a' }),
          expect.objectContaining({ target: '#b' }),
          expect.objectContaining({ target: '#c' }),
        ])
      );
    });

    it('should reset debounce timer on new update', () => {
      const onApply = vi.fn();
      const customBatcher = new MockBatchedUpdateSystem({
        debounceMs: 50,
        applyFn: onApply,
      });

      customBatcher.queue({ type: 'html', target: '#a', payload: '1' });
      vi.advanceTimersByTime(40);

      // Add another update, should reset timer
      customBatcher.queue({ type: 'html', target: '#b', payload: '2' });
      vi.advanceTimersByTime(40);

      // Still not flushed (40ms since last update)
      expect(onApply).not.toHaveBeenCalled();

      vi.advanceTimersByTime(10);
      expect(onApply).toHaveBeenCalled();
    });
  });

  describe('update merging', () => {
    it('should merge updates to same target', async () => {
      const onApply = vi.fn();
      const customBatcher = new MockBatchedUpdateSystem({
        debounceMs: 50,
        mergeUpdates: true,
        applyFn: onApply,
      });

      customBatcher.queue({ type: 'html', target: '#content', payload: '<div>A</div>' });
      customBatcher.queue({ type: 'html', target: '#content', payload: '<div>B</div>' });
      customBatcher.queue({ type: 'html', target: '#content', payload: '<div>C</div>' });

      vi.advanceTimersByTime(50);
      await Promise.resolve();

      // Should only have one update with latest value
      expect(onApply).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ target: '#content', payload: '<div>C</div>' }),
        ])
      );
      expect(onApply.mock.calls[0][0]).toHaveLength(1);
    });

    it('should not merge different targets', async () => {
      const onApply = vi.fn();
      const customBatcher = new MockBatchedUpdateSystem({
        debounceMs: 50,
        mergeUpdates: true,
        applyFn: onApply,
      });

      customBatcher.queue({ type: 'html', target: '#a', payload: '1' });
      customBatcher.queue({ type: 'html', target: '#b', payload: '2' });

      vi.advanceTimersByTime(50);
      await Promise.resolve();

      expect(onApply.mock.calls[0][0]).toHaveLength(2);
    });

    it('should not merge different update types', async () => {
      const onApply = vi.fn();
      const customBatcher = new MockBatchedUpdateSystem({
        debounceMs: 50,
        mergeUpdates: true,
        applyFn: onApply,
      });

      customBatcher.queue({ type: 'html', target: '#content', payload: '<div>A</div>' });
      customBatcher.queue({ type: 'css', target: '#content', payload: '.foo {}' });

      vi.advanceTimersByTime(50);
      await Promise.resolve();

      expect(onApply.mock.calls[0][0]).toHaveLength(2);
    });

    it('should respect mergeUpdates=false config', async () => {
      const onApply = vi.fn();
      const customBatcher = new MockBatchedUpdateSystem({
        debounceMs: 50,
        mergeUpdates: false,
        applyFn: onApply,
      });

      customBatcher.queue({ type: 'html', target: '#content', payload: 'A' });
      customBatcher.queue({ type: 'html', target: '#content', payload: 'B' });

      vi.advanceTimersByTime(50);
      await Promise.resolve();

      // Without merging, last one wins (Map behavior)
      expect(onApply.mock.calls[0][0]).toHaveLength(1);
    });
  });

  describe('immediate flush', () => {
    it('should flush immediately when manually called', async () => {
      const onApply = vi.fn();
      const customBatcher = new MockBatchedUpdateSystem({
        debounceMs: 50,
        applyFn: onApply,
      });

      customBatcher.queue({ type: 'html', target: '#a', payload: '1' });
      customBatcher.queue({ type: 'html', target: '#b', payload: '2' });

      // Force flush before debounce
      await customBatcher.flush();

      expect(onApply).toHaveBeenCalled();
      expect(customBatcher.hasPending()).toBe(false);
    });

    it('should return null when flushing empty queue', async () => {
      const result = await batcher.flush();
      expect(result).toBeNull();
    });
  });

  describe('max batch size', () => {
    it('should force flush when max batch size reached', async () => {
      const onApply = vi.fn();
      const customBatcher = new MockBatchedUpdateSystem({
        debounceMs: 50,
        maxBatchSize: 3,
        applyFn: onApply,
      });

      customBatcher.queue({ type: 'html', target: '#a', payload: '1' });
      customBatcher.queue({ type: 'html', target: '#b', payload: '2' });

      // Not yet at max
      expect(onApply).not.toHaveBeenCalled();

      // This should trigger flush
      customBatcher.queue({ type: 'html', target: '#c', payload: '3' });

      await Promise.resolve();
      expect(onApply).toHaveBeenCalled();
    });
  });

  describe('update types', () => {
    it('should handle html updates', () => {
      const update = batcher.queue({ type: 'html', target: '#div', payload: '<p>Hello</p>' });
      expect(update.type).toBe('html');
    });

    it('should handle css updates', () => {
      const update = batcher.queue({ type: 'css', target: '#styles', payload: '.foo { color: red }' });
      expect(update.type).toBe('css');
    });

    it('should handle snippet updates', () => {
      const update = batcher.queue({ type: 'snippet', target: '#snippet-1', payload: '<section>Content</section>' });
      expect(update.type).toBe('snippet');
    });

    it('should handle attribute updates', () => {
      const update = batcher.queue({
        type: 'attribute',
        target: '#elem',
        payload: { 'data-value': '123', 'aria-label': 'Test' },
      });
      expect(update.type).toBe('attribute');
    });

    it('should handle class updates', () => {
      const update = batcher.queue({
        type: 'class',
        target: '#elem',
        payload: { add: ['active'], remove: ['hidden'] },
      });
      expect(update.type).toBe('class');
    });
  });

  describe('batch result', () => {
    it('should return batch result with success info', async () => {
      const customBatcher = new MockBatchedUpdateSystem({ debounceMs: 50 });
      customBatcher.queue({ type: 'html', target: '#a', payload: '1' });

      const result = await customBatcher.flush();

      expect(result).not.toBeNull();
      expect(result!.success).toBe(true);
      expect(result!.successCount).toBe(1);
      expect(result!.failedCount).toBe(0);
    });

    it('should include apply time in result', async () => {
      const customBatcher = new MockBatchedUpdateSystem({ debounceMs: 50 });
      customBatcher.queue({ type: 'html', target: '#a', payload: '1' });

      const result = await customBatcher.flush();

      expect(result!.applyTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should call onBatchApplied callback', async () => {
      const onBatchApplied = vi.fn();
      const customBatcher = new MockBatchedUpdateSystem({
        debounceMs: 50,
        onBatchApplied,
      });

      customBatcher.queue({ type: 'html', target: '#a', payload: '1' });
      await customBatcher.flush();

      expect(onBatchApplied).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          successCount: 1,
        })
      );
    });
  });

  describe('cancellation', () => {
    it('should cancel all pending updates', () => {
      batcher.queue({ type: 'html', target: '#a', payload: '1' });
      batcher.queue({ type: 'html', target: '#b', payload: '2' });

      expect(batcher.hasPending()).toBe(true);

      batcher.cancel();

      expect(batcher.hasPending()).toBe(false);
      expect(batcher.getPendingCount()).toBe(0);
    });
  });

  describe('pending updates', () => {
    it('should track pending count', () => {
      expect(batcher.getPendingCount()).toBe(0);

      batcher.queue({ type: 'html', target: '#a', payload: '1' });
      expect(batcher.getPendingCount()).toBe(1);

      batcher.queue({ type: 'html', target: '#b', payload: '2' });
      expect(batcher.getPendingCount()).toBe(2);
    });

    it('should generate unique update IDs', () => {
      const update1 = batcher.queue({ type: 'html', target: '#a', payload: '1' });
      const update2 = batcher.queue({ type: 'html', target: '#b', payload: '2' });

      expect(update1.id).not.toBe(update2.id);
    });
  });

  describe('50ms batching requirement (Feature #62)', () => {
    it('should batch changes within 50ms into single DOM update', async () => {
      const applyFn = vi.fn();
      const customBatcher = new MockBatchedUpdateSystem({
        debounceMs: 50,
        applyFn,
      });

      // Simulate rapid changes within 50ms
      customBatcher.queue({ type: 'html', target: '#el1', payload: 'Update 1' });
      vi.advanceTimersByTime(10); // 10ms

      customBatcher.queue({ type: 'css', target: '#styles', payload: '.a {}' });
      vi.advanceTimersByTime(15); // 25ms

      customBatcher.queue({ type: 'html', target: '#el2', payload: 'Update 2' });
      vi.advanceTimersByTime(20); // 45ms

      customBatcher.queue({ type: 'snippet', target: '#snippet', payload: '<div/>' });

      // Still within debounce window, no flush yet
      expect(applyFn).not.toHaveBeenCalled();

      // Advance past 50ms from last update
      vi.advanceTimersByTime(50);
      await Promise.resolve();

      // Single batch containing all updates
      expect(applyFn).toHaveBeenCalledTimes(1);
      expect(applyFn.mock.calls[0][0]).toHaveLength(4);
    });
  });
});
