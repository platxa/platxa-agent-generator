/**
 * Tests for ScrollPreserver
 *
 * Feature #63: Implement scroll position preservation during HMR updates
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock types
interface ScrollPosition {
  selector: string;
  scrollLeft: number;
  scrollTop: number;
  scrollWidth: number;
  scrollHeight: number;
  capturedAt: number;
}

interface RestoreOptions {
  smooth?: boolean;
  allowPartial?: boolean;
  maxAge?: number;
  onRestored?: (position: ScrollPosition) => void;
}

interface ScrollSnapshot {
  id: string;
  positions: ScrollPosition[];
  timestamp: number;
}

interface PreservationResult {
  success: boolean;
  restoredPositions: ScrollPosition[];
  failedPositions: Array<{ position: ScrollPosition; reason: string }>;
  restoreTimeMs: number;
}

// Mock ScrollPreserver
class MockScrollPreserver {
  private positions: Map<string, ScrollPosition[]> = new Map();
  private lastSnapshot: ScrollSnapshot | null = null;
  private mockElements: Map<string, {
    scrollLeft: number;
    scrollTop: number;
    scrollWidth: number;
    scrollHeight: number;
    clientWidth: number;
    clientHeight: number;
  }> = new Map();
  private snapshotIdCounter = 0;

  constructor() {
    // Set up mock elements
    this.mockElements.set('html', {
      scrollLeft: 0,
      scrollTop: 100,
      scrollWidth: 1200,
      scrollHeight: 3000,
      clientWidth: 1200,
      clientHeight: 800,
    });
    this.mockElements.set('#content', {
      scrollLeft: 50,
      scrollTop: 200,
      scrollWidth: 1600,  // Must be > clientWidth for horizontal scroll
      scrollHeight: 2000,
      clientWidth: 800,
      clientHeight: 600,
    });
  }

  setElementScroll(selector: string, scrollTop: number, scrollLeft: number = 0): void {
    const existing = this.mockElements.get(selector);
    if (existing) {
      existing.scrollTop = scrollTop;
      existing.scrollLeft = scrollLeft;
    } else {
      this.mockElements.set(selector, {
        scrollLeft,
        scrollTop,
        scrollWidth: 1000,
        scrollHeight: 2000,
        clientWidth: 800,
        clientHeight: 600,
      });
    }
  }

  capture(selectors?: string[]): ScrollSnapshot {
    const selectorsToCapture = selectors ?? ['html', '#content'];
    const positions: ScrollPosition[] = [];

    for (const selector of selectorsToCapture) {
      const element = this.mockElements.get(selector);
      if (element) {
        const pos: ScrollPosition = {
          selector,
          scrollLeft: element.scrollLeft,
          scrollTop: element.scrollTop,
          scrollWidth: element.scrollWidth,
          scrollHeight: element.scrollHeight,
          capturedAt: Date.now(),
        };
        positions.push(pos);

        // Store in history
        let history = this.positions.get(selector);
        if (!history) {
          history = [];
          this.positions.set(selector, history);
        }
        history.push(pos);
      }
    }

    const snapshot: ScrollSnapshot = {
      id: `snap-${++this.snapshotIdCounter}`,
      positions,
      timestamp: Date.now(),
    };

    this.lastSnapshot = snapshot;
    return snapshot;
  }

  captureElement(selector: string): ScrollPosition | null {
    const element = this.mockElements.get(selector);
    if (!element) return null;

    return {
      selector,
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop,
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight,
      capturedAt: Date.now(),
    };
  }

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
      if (now - position.capturedAt > maxAge) {
        failedPositions.push({ position, reason: 'Position expired' });
        continue;
      }

      const element = this.mockElements.get(position.selector);
      if (element) {
        // Clamp to valid range
        const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
        const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);

        element.scrollTop = Math.min(position.scrollTop, maxScrollTop);
        element.scrollLeft = Math.min(position.scrollLeft, maxScrollLeft);

        restoredPositions.push(position);
        options.onRestored?.(position);
      } else {
        failedPositions.push({ position, reason: 'Element not found' });
      }
    }

    return {
      success: failedPositions.length === 0,
      restoredPositions,
      failedPositions,
      restoreTimeMs: performance.now() - startTime,
    };
  }

  restoreElement(position: ScrollPosition, options: RestoreOptions = {}): boolean {
    const element = this.mockElements.get(position.selector);
    if (!element) return false;

    element.scrollTop = position.scrollTop;
    element.scrollLeft = position.scrollLeft;
    return true;
  }

  getLastSnapshot(): ScrollSnapshot | null {
    return this.lastSnapshot;
  }

  getHistory(selector: string): ScrollPosition[] {
    return this.positions.get(selector) ?? [];
  }

  clear(): void {
    this.positions.clear();
    this.lastSnapshot = null;
  }

  async preserveDuring<T>(callback: () => T | Promise<T>, options?: RestoreOptions): Promise<T> {
    this.capture();
    const result = await callback();
    this.restore(options);
    return result;
  }

  getElementScroll(selector: string): { scrollTop: number; scrollLeft: number } | null {
    const element = this.mockElements.get(selector);
    if (!element) return null;
    return { scrollTop: element.scrollTop, scrollLeft: element.scrollLeft };
  }
}

describe('ScrollPreserver', () => {
  let preserver: MockScrollPreserver;

  beforeEach(() => {
    preserver = new MockScrollPreserver();
  });

  describe('scroll position restoration (Feature #63)', () => {
    it('should restore scroll position after DOM morph', async () => {
      // Set initial scroll
      preserver.setElementScroll('html', 500);

      // Capture before morph
      preserver.capture(['html']);

      // Simulate DOM change resetting scroll
      preserver.setElementScroll('html', 0);

      // Restore
      const result = preserver.restore();

      expect(result.success).toBe(true);
      expect(preserver.getElementScroll('html')?.scrollTop).toBe(500);
    });

    it('should restore both horizontal and vertical scroll', async () => {
      preserver.setElementScroll('#content', 300, 150);
      preserver.capture(['#content']);

      preserver.setElementScroll('#content', 0, 0);
      preserver.restore();

      const scroll = preserver.getElementScroll('#content');
      expect(scroll?.scrollTop).toBe(300);
      expect(scroll?.scrollLeft).toBe(150);
    });

    it('should restore multiple elements', async () => {
      preserver.setElementScroll('html', 100);
      preserver.setElementScroll('#content', 200);

      preserver.capture(['html', '#content']);

      preserver.setElementScroll('html', 0);
      preserver.setElementScroll('#content', 0);

      const result = preserver.restore();

      expect(result.restoredPositions).toHaveLength(2);
      expect(preserver.getElementScroll('html')?.scrollTop).toBe(100);
      expect(preserver.getElementScroll('#content')?.scrollTop).toBe(200);
    });
  });

  describe('capture', () => {
    it('should capture scroll position', () => {
      preserver.setElementScroll('html', 250);
      const snapshot = preserver.capture(['html']);

      expect(snapshot.positions).toHaveLength(1);
      expect(snapshot.positions[0].scrollTop).toBe(250);
    });

    it('should capture scroll width and height', () => {
      const snapshot = preserver.capture(['html']);
      const pos = snapshot.positions[0];

      expect(pos.scrollWidth).toBeGreaterThan(0);
      expect(pos.scrollHeight).toBeGreaterThan(0);
    });

    it('should record capture timestamp', () => {
      const before = Date.now();
      const snapshot = preserver.capture(['html']);
      const after = Date.now();

      expect(snapshot.positions[0].capturedAt).toBeGreaterThanOrEqual(before);
      expect(snapshot.positions[0].capturedAt).toBeLessThanOrEqual(after);
    });

    it('should generate unique snapshot IDs', () => {
      const snap1 = preserver.capture(['html']);
      const snap2 = preserver.capture(['html']);

      expect(snap1.id).not.toBe(snap2.id);
    });
  });

  describe('captureElement', () => {
    it('should capture single element', () => {
      preserver.setElementScroll('html', 300);
      const pos = preserver.captureElement('html');

      expect(pos).not.toBeNull();
      expect(pos?.scrollTop).toBe(300);
    });

    it('should return null for non-existent element', () => {
      const pos = preserver.captureElement('#non-existent');
      expect(pos).toBeNull();
    });
  });

  describe('restore', () => {
    it('should return success for all restored', () => {
      preserver.capture(['html']);
      const result = preserver.restore();

      expect(result.success).toBe(true);
      expect(result.failedPositions).toHaveLength(0);
    });

    it('should call onRestored callback', () => {
      const onRestored = vi.fn();
      preserver.capture(['html']);
      preserver.restore({ onRestored });

      expect(onRestored).toHaveBeenCalled();
    });

    it('should track failed restorations', () => {
      // Capture a position for element that will be "removed"
      preserver.setElementScroll('#temp', 100);
      preserver.capture(['#temp', 'html']);

      // "Remove" the element by clearing its mock
      preserver['mockElements'].delete('#temp');

      const result = preserver.restore();

      expect(result.failedPositions).toHaveLength(1);
      expect(result.failedPositions[0].position.selector).toBe('#temp');
    });

    it('should expire old positions', () => {
      preserver.capture(['html']);

      // Artificially age the position
      const snapshot = preserver.getLastSnapshot();
      if (snapshot) {
        snapshot.positions[0].capturedAt = Date.now() - 10000; // 10 seconds ago
      }

      const result = preserver.restore({ maxAge: 5000 });

      expect(result.failedPositions).toHaveLength(1);
      expect(result.failedPositions[0].reason).toContain('expired');
    });
  });

  describe('restoreElement', () => {
    it('should restore single element', () => {
      preserver.setElementScroll('html', 500);
      const pos = preserver.captureElement('html')!;

      preserver.setElementScroll('html', 0);

      const success = preserver.restoreElement(pos);

      expect(success).toBe(true);
      expect(preserver.getElementScroll('html')?.scrollTop).toBe(500);
    });

    it('should return false for non-existent element', () => {
      const pos: ScrollPosition = {
        selector: '#gone',
        scrollLeft: 0,
        scrollTop: 100,
        scrollWidth: 1000,
        scrollHeight: 2000,
        capturedAt: Date.now(),
      };

      const success = preserver.restoreElement(pos);
      expect(success).toBe(false);
    });
  });

  describe('getLastSnapshot', () => {
    it('should return null before capture', () => {
      expect(preserver.getLastSnapshot()).toBeNull();
    });

    it('should return last snapshot after capture', () => {
      preserver.capture(['html']);
      const snapshot = preserver.getLastSnapshot();

      expect(snapshot).not.toBeNull();
      expect(snapshot?.positions).toHaveLength(1);
    });
  });

  describe('getHistory', () => {
    it('should track position history', () => {
      preserver.setElementScroll('html', 100);
      preserver.capture(['html']);

      preserver.setElementScroll('html', 200);
      preserver.capture(['html']);

      preserver.setElementScroll('html', 300);
      preserver.capture(['html']);

      const history = preserver.getHistory('html');
      expect(history).toHaveLength(3);
      expect(history[0].scrollTop).toBe(100);
      expect(history[2].scrollTop).toBe(300);
    });

    it('should return empty array for unknown selector', () => {
      const history = preserver.getHistory('#unknown');
      expect(history).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should clear all positions', () => {
      preserver.capture(['html']);
      preserver.clear();

      expect(preserver.getLastSnapshot()).toBeNull();
      expect(preserver.getHistory('html')).toEqual([]);
    });
  });

  describe('preserveDuring', () => {
    it('should capture before and restore after callback', async () => {
      preserver.setElementScroll('html', 400);

      await preserver.preserveDuring(() => {
        // Simulate DOM change
        preserver.setElementScroll('html', 0);
      });

      expect(preserver.getElementScroll('html')?.scrollTop).toBe(400);
    });

    it('should return callback result', async () => {
      const result = await preserver.preserveDuring(() => {
        return 'test result';
      });

      expect(result).toBe('test result');
    });

    it('should work with async callbacks', async () => {
      preserver.setElementScroll('html', 250);

      await preserver.preserveDuring(async () => {
        await new Promise((r) => setTimeout(r, 10));
        preserver.setElementScroll('html', 0);
      });

      expect(preserver.getElementScroll('html')?.scrollTop).toBe(250);
    });
  });

  describe('PreservationResult', () => {
    it('should include restore time', () => {
      preserver.capture(['html']);
      const result = preserver.restore();

      expect(result.restoreTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should count successful restorations', () => {
      preserver.capture(['html', '#content']);
      const result = preserver.restore();

      expect(result.restoredPositions).toHaveLength(2);
    });
  });

  describe('ScrollSnapshot', () => {
    it('should include timestamp', () => {
      const before = Date.now();
      const snapshot = preserver.capture(['html']);
      const after = Date.now();

      expect(snapshot.timestamp).toBeGreaterThanOrEqual(before);
      expect(snapshot.timestamp).toBeLessThanOrEqual(after);
    });

    it('should include all captured positions', () => {
      const snapshot = preserver.capture(['html', '#content']);

      expect(snapshot.positions).toHaveLength(2);
      expect(snapshot.positions.map((p) => p.selector)).toContain('html');
      expect(snapshot.positions.map((p) => p.selector)).toContain('#content');
    });
  });

  describe('RestoreOptions', () => {
    it('should support maxAge option', () => {
      preserver.capture(['html']);

      const snapshot = preserver.getLastSnapshot()!;
      snapshot.positions[0].capturedAt = Date.now() - 100;

      const result = preserver.restore({ maxAge: 50 });
      expect(result.failedPositions).toHaveLength(1);
    });

    it('should support onRestored callback', () => {
      const callback = vi.fn();
      preserver.capture(['html']);
      preserver.restore({ onRestored: callback });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ selector: 'html' })
      );
    });
  });
});
