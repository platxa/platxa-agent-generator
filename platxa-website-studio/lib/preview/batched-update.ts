/**
 * Batched Update System - Debounces rapid changes for performance
 *
 * Batches multiple DOM updates that occur within a short time window (default 50ms)
 * into a single update cycle, preventing thrashing and improving performance.
 *
 * @module preview/batched-update
 */

// =============================================================================
// Types
// =============================================================================

/** Type of update to batch */
export type UpdateType = 'html' | 'css' | 'snippet' | 'attribute' | 'class';

/** A pending update in the queue */
export interface PendingUpdate {
  /** Unique ID for this update */
  id: string;
  /** Type of update */
  type: UpdateType;
  /** Target element selector or ID */
  target: string;
  /** The update payload (content, styles, etc.) */
  payload: unknown;
  /** Timestamp when queued */
  queuedAt: number;
  /** Priority (higher = processed first) */
  priority?: number;
}

/** Batch of updates ready to apply */
export interface UpdateBatch {
  /** Batch ID */
  id: string;
  /** Updates in this batch */
  updates: PendingUpdate[];
  /** When the batch was created */
  createdAt: number;
  /** When the batch was flushed */
  flushedAt?: number;
  /** Total updates merged into this batch */
  totalMerged: number;
}

/** Result of applying a batch */
export interface BatchResult {
  /** Whether all updates were successful */
  success: boolean;
  /** Batch that was applied */
  batch: UpdateBatch;
  /** Number of successful updates */
  successCount: number;
  /** Number of failed updates */
  failedCount: number;
  /** Errors encountered */
  errors?: Array<{ updateId: string; error: string }>;
  /** Time taken to apply in ms */
  applyTimeMs: number;
}

/** Statistics for the batcher */
export interface BatcherStats {
  /** Total batches processed */
  totalBatches: number;
  /** Total updates processed */
  totalUpdates: number;
  /** Total updates merged (deduplicated) */
  totalMerged: number;
  /** Average updates per batch */
  averageUpdatesPerBatch: number;
  /** Average batch apply time in ms */
  averageApplyTimeMs: number;
  /** Updates saved via merging */
  updatesSaved: number;
}

/** Configuration for the batcher */
export interface BatchedUpdateConfig {
  /** Debounce window in milliseconds (default: 50) */
  debounceMs?: number;
  /** Maximum updates per batch before force flush (default: 100) */
  maxBatchSize?: number;
  /** Maximum wait time before force flush in ms (default: 200) */
  maxWaitMs?: number;
  /** Enable update merging for same target (default: true) */
  mergeUpdates?: boolean;
  /** Custom apply function */
  applyFn?: (updates: PendingUpdate[]) => Promise<void>;
  /** Callback when batch is applied */
  onBatchApplied?: (result: BatchResult) => void;
  /** Enable debug logging */
  debug?: boolean;
}

/** Events emitted by the batcher */
export interface BatcherEvents {
  /** Fired when an update is queued */
  onQueue: (update: PendingUpdate) => void;
  /** Fired when a batch starts applying */
  onFlushStart: (batch: UpdateBatch) => void;
  /** Fired when a batch finishes applying */
  onFlushEnd: (result: BatchResult) => void;
  /** Fired when updates are merged */
  onMerge: (target: string, count: number) => void;
}

// =============================================================================
// Batched Update System
// =============================================================================

/**
 * BatchedUpdateSystem - Debounces and batches rapid DOM updates
 *
 * Feature #62: Multiple changes within 50ms batched into single DOM update
 *
 * @example
 * ```typescript
 * const batcher = new BatchedUpdateSystem({
 *   debounceMs: 50,
 *   mergeUpdates: true,
 * });
 *
 * // These updates within 50ms will be batched together
 * batcher.queue({ type: 'html', target: '#content', payload: '<div>A</div>' });
 * batcher.queue({ type: 'css', target: '#styles', payload: '.foo { color: red }' });
 * batcher.queue({ type: 'html', target: '#content', payload: '<div>B</div>' }); // Merges with first
 *
 * // Single DOM update with final values
 * ```
 */
export class BatchedUpdateSystem {
  private config: Required<Omit<BatchedUpdateConfig, 'applyFn' | 'onBatchApplied'>> & {
    applyFn?: (updates: PendingUpdate[]) => Promise<void>;
    onBatchApplied?: (result: BatchResult) => void;
  };

  private pendingUpdates: Map<string, PendingUpdate> = new Map();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
  private firstUpdateTime: number | null = null;
  private stats: BatcherStats = {
    totalBatches: 0,
    totalUpdates: 0,
    totalMerged: 0,
    averageUpdatesPerBatch: 0,
    averageApplyTimeMs: 0,
    updatesSaved: 0,
  };
  private events: Partial<BatcherEvents> = {};
  private batchIdCounter = 0;
  private updateIdCounter = 0;

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

  /**
   * Queue an update for batching
   *
   * @param update - The update to queue (without id)
   * @returns The queued update with assigned ID
   */
  queue(update: Omit<PendingUpdate, 'id' | 'queuedAt'>): PendingUpdate {
    const now = Date.now();
    const updateId = this.generateUpdateId();

    const pendingUpdate: PendingUpdate = {
      ...update,
      id: updateId,
      queuedAt: now,
    };

    // Track first update time for max wait
    if (this.firstUpdateTime === null) {
      this.firstUpdateTime = now;
      this.startMaxWaitTimer();
    }

    // Merge or add update
    const key = this.getUpdateKey(pendingUpdate);

    if (this.config.mergeUpdates && this.pendingUpdates.has(key)) {
      // Merge: keep new update, increment merged count
      this.stats.totalMerged++;
      this.stats.updatesSaved++;
      this.events.onMerge?.(pendingUpdate.target, this.stats.totalMerged);
      this.log(`Merged update for ${key}`);
    }

    this.pendingUpdates.set(key, pendingUpdate);
    this.events.onQueue?.(pendingUpdate);

    // Check if we should force flush due to size
    if (this.pendingUpdates.size >= this.config.maxBatchSize) {
      this.log(`Max batch size reached (${this.config.maxBatchSize}), forcing flush`);
      this.flush();
      return pendingUpdate;
    }

    // Restart debounce timer
    this.restartDebounceTimer();

    return pendingUpdate;
  }

  /**
   * Force flush all pending updates immediately
   */
  async flush(): Promise<BatchResult | null> {
    this.clearTimers();

    if (this.pendingUpdates.size === 0) {
      return null;
    }

    const updates = Array.from(this.pendingUpdates.values());
    const batch = this.createBatch(updates);

    this.pendingUpdates.clear();
    this.firstUpdateTime = null;

    this.events.onFlushStart?.(batch);
    this.log(`Flushing batch ${batch.id} with ${updates.length} updates`);

    const startTime = performance.now();
    const errors: Array<{ updateId: string; error: string }> = [];
    let successCount = 0;

    try {
      if (this.config.applyFn) {
        // Use custom apply function
        await this.config.applyFn(updates);
        successCount = updates.length;
      } else {
        // Default: apply updates in priority order
        const sorted = updates.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        for (const update of sorted) {
          try {
            this.applyUpdate(update);
            successCount++;
          } catch (err) {
            errors.push({
              updateId: update.id,
              error: err instanceof Error ? err.message : 'Unknown error',
            });
          }
        }
      }
    } catch (err) {
      errors.push({
        updateId: 'batch',
        error: err instanceof Error ? err.message : 'Batch apply failed',
      });
    }

    const applyTimeMs = performance.now() - startTime;
    batch.flushedAt = Date.now();

    const result: BatchResult = {
      success: errors.length === 0,
      batch,
      successCount,
      failedCount: updates.length - successCount,
      errors: errors.length > 0 ? errors : undefined,
      applyTimeMs,
    };

    // Update stats
    this.updateStats(result);

    this.events.onFlushEnd?.(result);
    this.config.onBatchApplied?.(result);

    this.log(`Batch ${batch.id} applied in ${applyTimeMs.toFixed(2)}ms`);

    return result;
  }

  /**
   * Get current pending update count
   */
  getPendingCount(): number {
    return this.pendingUpdates.size;
  }

  /**
   * Get all pending updates
   */
  getPendingUpdates(): PendingUpdate[] {
    return Array.from(this.pendingUpdates.values());
  }

  /**
   * Check if there are pending updates
   */
  hasPending(): boolean {
    return this.pendingUpdates.size > 0;
  }

  /**
   * Cancel all pending updates
   */
  cancel(): void {
    this.clearTimers();
    this.pendingUpdates.clear();
    this.firstUpdateTime = null;
    this.log('Cancelled all pending updates');
  }

  /**
   * Get batcher statistics
   */
  getStats(): BatcherStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalBatches: 0,
      totalUpdates: 0,
      totalMerged: 0,
      averageUpdatesPerBatch: 0,
      averageApplyTimeMs: 0,
      updatesSaved: 0,
    };
  }

  /**
   * Set event listeners
   */
  on<K extends keyof BatcherEvents>(event: K, handler: BatcherEvents[K]): void {
    this.events[event] = handler;
  }

  /**
   * Remove event listener
   */
  off<K extends keyof BatcherEvents>(event: K): void {
    delete this.events[event];
  }

  /**
   * Destroy the batcher, clearing all timers and state
   */
  destroy(): void {
    this.cancel();
    this.events = {};
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private getUpdateKey(update: PendingUpdate): string {
    return `${update.type}:${update.target}`;
  }

  private generateUpdateId(): string {
    return `upd-${++this.updateIdCounter}-${Date.now().toString(36)}`;
  }

  private createBatch(updates: PendingUpdate[]): UpdateBatch {
    return {
      id: `batch-${++this.batchIdCounter}`,
      updates,
      createdAt: Date.now(),
      totalMerged: this.stats.totalMerged,
    };
  }

  private restartDebounceTimer(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.flush();
    }, this.config.debounceMs);
  }

  private startMaxWaitTimer(): void {
    if (this.maxWaitTimer) {
      clearTimeout(this.maxWaitTimer);
    }

    this.maxWaitTimer = setTimeout(() => {
      this.log(`Max wait time reached (${this.config.maxWaitMs}ms), forcing flush`);
      this.flush();
    }, this.config.maxWaitMs);
  }

  private clearTimers(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.maxWaitTimer) {
      clearTimeout(this.maxWaitTimer);
      this.maxWaitTimer = null;
    }
  }

  private applyUpdate(update: PendingUpdate): void {
    // Default DOM update logic
    if (typeof document === 'undefined') return;

    const element = document.querySelector(update.target);
    if (!element) {
      throw new Error(`Target element not found: ${update.target}`);
    }

    switch (update.type) {
      case 'html': {
        const doc = new DOMParser().parseFromString(update.payload as string, 'text/html');
        element.replaceChildren(...Array.from(doc.body.childNodes));
        break;
      }
      case 'css':
        if (element instanceof HTMLStyleElement) {
          element.textContent = update.payload as string;
        }
        break;
      case 'attribute':
        const attrs = update.payload as Record<string, string>;
        for (const [key, value] of Object.entries(attrs)) {
          element.setAttribute(key, value);
        }
        break;
      case 'class':
        const classes = update.payload as { add?: string[]; remove?: string[] };
        if (classes.add) element.classList.add(...classes.add);
        if (classes.remove) element.classList.remove(...classes.remove);
        break;
      case 'snippet': {
        // Snippet updates use DOMParser for safe HTML parsing
        const snippetDoc = new DOMParser().parseFromString(update.payload as string, 'text/html');
        element.replaceChildren(...Array.from(snippetDoc.body.childNodes));
        break;
      }
    }
  }

  private updateStats(result: BatchResult): void {
    this.stats.totalBatches++;
    this.stats.totalUpdates += result.batch.updates.length;

    // Calculate running averages
    this.stats.averageUpdatesPerBatch =
      this.stats.totalUpdates / this.stats.totalBatches;
    this.stats.averageApplyTimeMs =
      (this.stats.averageApplyTimeMs * (this.stats.totalBatches - 1) +
        result.applyTimeMs) /
      this.stats.totalBatches;
  }

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[BatchedUpdate] ${message}`);
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new BatchedUpdateSystem
 */
export function createBatchedUpdateSystem(
  config?: BatchedUpdateConfig
): BatchedUpdateSystem {
  return new BatchedUpdateSystem(config);
}

/**
 * Create a batcher with 50ms debounce (Feature #62 default)
 */
export function createDefaultBatcher(): BatchedUpdateSystem {
  return new BatchedUpdateSystem({
    debounceMs: 50,
    mergeUpdates: true,
    maxBatchSize: 100,
    maxWaitMs: 200,
  });
}

// =============================================================================
// Exports
// =============================================================================

export default BatchedUpdateSystem;
