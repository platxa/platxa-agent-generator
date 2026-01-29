/**
 * Scroll Preservation - Maintains scroll position during HMR updates
 *
 * Captures and restores scroll position before/after DOM morphing
 * to ensure users don't lose their place during live updates.
 *
 * @module preview/scroll-preservation
 */

// =============================================================================
// Types
// =============================================================================

/** Scroll position data for an element */
export interface ScrollPosition {
  /** Element selector or identifier */
  selector: string;
  /** Horizontal scroll position */
  scrollLeft: number;
  /** Vertical scroll position */
  scrollTop: number;
  /** Element's scroll width (for validation) */
  scrollWidth: number;
  /** Element's scroll height (for validation) */
  scrollHeight: number;
  /** Timestamp when captured */
  capturedAt: number;
}

/** Options for scroll restoration */
export interface RestoreOptions {
  /** Smooth scroll animation (default: false for HMR) */
  smooth?: boolean;
  /** Allow partial restoration if dimensions changed */
  allowPartial?: boolean;
  /** Maximum age of captured position in ms (default: 5000) */
  maxAge?: number;
  /** Callback after restoration */
  onRestored?: (position: ScrollPosition) => void;
}

/** Configuration for ScrollPreserver */
export interface ScrollPreserverConfig {
  /** Default selectors to track (default: document scrolling elements) */
  defaultSelectors?: string[];
  /** Auto-capture on mutation observer (default: false) */
  autoCapture?: boolean;
  /** Max positions to store per element (default: 10) */
  maxHistorySize?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/** Result of a preservation cycle */
export interface PreservationResult {
  /** Whether restoration was successful */
  success: boolean;
  /** Positions that were restored */
  restoredPositions: ScrollPosition[];
  /** Positions that failed to restore */
  failedPositions: Array<{ position: ScrollPosition; reason: string }>;
  /** Time taken to restore in ms */
  restoreTimeMs: number;
}

/** Snapshot of all scroll positions */
export interface ScrollSnapshot {
  /** Snapshot ID */
  id: string;
  /** All captured positions */
  positions: ScrollPosition[];
  /** When snapshot was taken */
  timestamp: number;
}

// =============================================================================
// Scroll Preserver Class
// =============================================================================

/**
 * ScrollPreserver - Captures and restores scroll positions during HMR
 *
 * Feature #63: Scroll position restored after DOM morph
 *
 * @example
 * ```typescript
 * const preserver = new ScrollPreserver();
 *
 * // Before DOM morph
 * preserver.capture();
 *
 * // Perform HMR update / DOM morph
 * morphdom(oldNode, newNode);
 *
 * // Restore scroll position
 * preserver.restore();
 * ```
 */
export class ScrollPreserver {
  private config: Required<ScrollPreserverConfig>;
  private positions: Map<string, ScrollPosition[]> = new Map();
  private lastSnapshot: ScrollSnapshot | null = null;
  private snapshotIdCounter = 0;

  constructor(config: ScrollPreserverConfig = {}) {
    this.config = {
      defaultSelectors: config.defaultSelectors ?? [
        'html',
        'body',
        '[data-scroll-container]',
        '.scroll-container',
        'main',
        '.main-content',
      ],
      autoCapture: config.autoCapture ?? false,
      maxHistorySize: config.maxHistorySize ?? 10,
      debug: config.debug ?? false,
    };
  }

  /**
   * Capture current scroll positions for all tracked elements
   *
   * Call this before DOM morph/HMR update
   */
  capture(selectors?: string[]): ScrollSnapshot {
    const selectorsToCapture = selectors ?? this.config.defaultSelectors;
    const positions: ScrollPosition[] = [];

    for (const selector of selectorsToCapture) {
      const pos = this.captureElement(selector);
      if (pos) {
        positions.push(pos);
        this.addToHistory(selector, pos);
      }
    }

    const snapshot: ScrollSnapshot = {
      id: `snap-${++this.snapshotIdCounter}`,
      positions,
      timestamp: Date.now(),
    };

    this.lastSnapshot = snapshot;
    this.log(`Captured ${positions.length} scroll positions`);

    return snapshot;
  }

  /**
   * Capture scroll position for a specific element
   */
  captureElement(selector: string): ScrollPosition | null {
    if (typeof document === 'undefined') return null;

    const element = this.getScrollElement(selector);
    if (!element) return null;

    const position: ScrollPosition = {
      selector,
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop,
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight,
      capturedAt: Date.now(),
    };

    this.log(`Captured: ${selector} at (${position.scrollLeft}, ${position.scrollTop})`);

    return position;
  }

  /**
   * Restore scroll positions from last snapshot
   *
   * Call this after DOM morph/HMR update
   */
  restore(options: RestoreOptions = {}): PreservationResult {
    const startTime = performance.now();
    const restoredPositions: ScrollPosition[] = [];
    const failedPositions: Array<{ position: ScrollPosition; reason: string }> = [];

    if (!this.lastSnapshot) {
      return {
        success: false,
        restoredPositions: [],
        failedPositions: [],
        restoreTimeMs: performance.now() - startTime,
      };
    }

    const maxAge = options.maxAge ?? 5000;
    const now = Date.now();

    for (const position of this.lastSnapshot.positions) {
      // Check if position is too old
      if (now - position.capturedAt > maxAge) {
        failedPositions.push({ position, reason: 'Position expired' });
        continue;
      }

      const success = this.restoreElement(position, options);
      if (success) {
        restoredPositions.push(position);
        options.onRestored?.(position);
      } else {
        failedPositions.push({ position, reason: 'Element not found or restore failed' });
      }
    }

    const restoreTimeMs = performance.now() - startTime;
    this.log(`Restored ${restoredPositions.length}/${this.lastSnapshot.positions.length} positions in ${restoreTimeMs.toFixed(2)}ms`);

    return {
      success: failedPositions.length === 0,
      restoredPositions,
      failedPositions,
      restoreTimeMs,
    };
  }

  /**
   * Restore scroll position for a specific element
   */
  restoreElement(position: ScrollPosition, options: RestoreOptions = {}): boolean {
    if (typeof document === 'undefined') return false;

    const element = this.getScrollElement(position.selector);
    if (!element) return false;

    // Validate dimensions haven't changed dramatically
    if (!options.allowPartial) {
      const dimensionChange = Math.abs(element.scrollHeight - position.scrollHeight);
      const changeRatio = dimensionChange / position.scrollHeight;

      // If content changed by more than 50%, don't restore
      if (changeRatio > 0.5 && position.scrollHeight > 0) {
        this.log(`Skipping restore for ${position.selector}: content changed significantly`);
        return false;
      }
    }

    // Clamp scroll position to valid range
    const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);

    const scrollTop = Math.min(position.scrollTop, maxScrollTop);
    const scrollLeft = Math.min(position.scrollLeft, maxScrollLeft);

    if (options.smooth) {
      element.scrollTo({
        top: scrollTop,
        left: scrollLeft,
        behavior: 'smooth',
      });
    } else {
      element.scrollTop = scrollTop;
      element.scrollLeft = scrollLeft;
    }

    this.log(`Restored: ${position.selector} to (${scrollLeft}, ${scrollTop})`);

    return true;
  }

  /**
   * Restore from a specific snapshot
   */
  restoreFromSnapshot(snapshot: ScrollSnapshot, options: RestoreOptions = {}): PreservationResult {
    const previousSnapshot = this.lastSnapshot;
    this.lastSnapshot = snapshot;
    const result = this.restore(options);
    this.lastSnapshot = previousSnapshot;
    return result;
  }

  /**
   * Get the last captured snapshot
   */
  getLastSnapshot(): ScrollSnapshot | null {
    return this.lastSnapshot;
  }

  /**
   * Get scroll history for an element
   */
  getHistory(selector: string): ScrollPosition[] {
    return this.positions.get(selector) ?? [];
  }

  /**
   * Clear all captured positions
   */
  clear(): void {
    this.positions.clear();
    this.lastSnapshot = null;
    this.log('Cleared all positions');
  }

  /**
   * Create a wrapper that preserves scroll during a callback
   *
   * @example
   * ```typescript
   * await preserver.preserveDuring(() => {
   *   morphdom(oldNode, newNode);
   * });
   * ```
   */
  async preserveDuring<T>(
    callback: () => T | Promise<T>,
    options: RestoreOptions = {}
  ): Promise<T> {
    this.capture();

    const result = await callback();

    // Use requestAnimationFrame to ensure DOM has updated
    await new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          this.restore(options);
          resolve();
        });
      } else {
        this.restore(options);
        resolve();
      }
    });

    return result;
  }

  /**
   * Wrap morphdom or similar function to auto-preserve scroll
   */
  wrapMorph<T extends (...args: unknown[]) => unknown>(
    morphFn: T,
    options: RestoreOptions = {}
  ): T {
    return ((...args: unknown[]) => {
      this.capture();
      const result = morphFn(...args);
      // Defer restore to next frame
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => this.restore(options));
      } else {
        this.restore(options);
      }
      return result;
    }) as T;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private getScrollElement(selector: string): Element | null {
    if (typeof document === 'undefined') return null;

    if (selector === 'html' || selector === 'document') {
      return document.documentElement;
    }

    if (selector === 'body') {
      return document.body;
    }

    return document.querySelector(selector);
  }

  private addToHistory(selector: string, position: ScrollPosition): void {
    let history = this.positions.get(selector);
    if (!history) {
      history = [];
      this.positions.set(selector, history);
    }

    history.push(position);

    // Trim history to max size
    if (history.length > this.config.maxHistorySize) {
      history.shift();
    }
  }

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[ScrollPreserver] ${message}`);
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new ScrollPreserver
 */
export function createScrollPreserver(config?: ScrollPreserverConfig): ScrollPreserver {
  return new ScrollPreserver(config);
}

/**
 * Capture and restore scroll in a single operation
 */
export async function preserveScrollDuring<T>(
  callback: () => T | Promise<T>,
  options?: RestoreOptions
): Promise<T> {
  const preserver = new ScrollPreserver();
  return preserver.preserveDuring(callback, options);
}

/**
 * Create a scroll-preserving wrapper for morphdom
 */
export function createPreservingMorph<T extends (...args: unknown[]) => unknown>(
  morphFn: T,
  options?: RestoreOptions
): T {
  const preserver = new ScrollPreserver();
  return preserver.wrapMorph(morphFn, options);
}

// =============================================================================
// Exports
// =============================================================================

export default ScrollPreserver;
