/**
 * Visual Regression — Baseline Capture & Pixel-Level Comparison
 *
 * Captures baseline screenshots per page and compares subsequent
 * generations with configurable pixel diff threshold (default < 5%).
 */

// =============================================================================
// Types
// =============================================================================

export interface PixelData {
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** RGBA pixel data (length = width * height * 4) */
  data: number[];
}

export interface Baseline {
  /** Page identifier */
  pageId: string;
  /** Captured pixel data */
  pixels: PixelData;
  /** Capture timestamp (ms) */
  capturedAt: number;
  /** Viewport dimensions */
  viewport: { width: number; height: number };
  /** Metadata */
  metadata?: Record<string, unknown>;
}

export interface DiffResult {
  /** Number of pixels that differ */
  diffPixelCount: number;
  /** Total comparable pixels */
  totalPixels: number;
  /** Diff percentage (0-100) */
  diffPercentage: number;
  /** Whether diff is within threshold */
  withinThreshold: boolean;
  /** Configured threshold */
  threshold: number;
  /** Diff pixel map (indices of changed pixels) */
  changedPixels: number[];
}

export interface ComparisonResult {
  /** Page being compared */
  pageId: string;
  /** Whether comparison passed */
  pass: boolean;
  /** Diff details */
  diff: DiffResult;
  /** Baseline capture time */
  baselineCapturedAt: number;
  /** Comparison timestamp */
  comparedAt: number;
}

export interface VisualRegressionConfig {
  /** Max pixel diff percentage allowed (0-100) */
  diffThreshold: number;
  /** Per-pixel color tolerance (0-255) */
  colorTolerance: number;
  /** Anti-aliasing detection enabled */
  antiAliasing: boolean;
}

export const DEFAULT_VR_CONFIG: VisualRegressionConfig = {
  diffThreshold: 5,
  colorTolerance: 10,
  antiAliasing: true,
};

export interface VisualRegressionState {
  /** Stored baselines by page ID */
  baselines: Map<string, Baseline>;
  /** Comparison history */
  history: ComparisonResult[];
  /** Config */
  config: VisualRegressionConfig;
}

// =============================================================================
// State
// =============================================================================

export function createVRState(
  config: Partial<VisualRegressionConfig> = {},
): VisualRegressionState {
  return {
    baselines: new Map(),
    history: [],
    config: { ...DEFAULT_VR_CONFIG, ...config },
  };
}

// =============================================================================
// Baseline Management
// =============================================================================

/** Captures a baseline for a page. Returns new state. */
export function captureBaseline(
  state: VisualRegressionState,
  pageId: string,
  pixels: PixelData,
  viewport: { width: number; height: number },
  timestamp: number = Date.now(),
): VisualRegressionState {
  const baseline: Baseline = {
    pageId,
    pixels,
    capturedAt: timestamp,
    viewport,
  };
  const baselines = new Map(state.baselines);
  baselines.set(pageId, baseline);
  return { ...state, baselines };
}

/** Returns baseline for a page, or undefined. */
export function getBaseline(
  state: VisualRegressionState,
  pageId: string,
): Baseline | undefined {
  return state.baselines.get(pageId);
}

/** Returns all page IDs with baselines. */
export function getBaselinePageIds(state: VisualRegressionState): string[] {
  return Array.from(state.baselines.keys());
}

/** Removes a baseline. */
export function removeBaseline(
  state: VisualRegressionState,
  pageId: string,
): VisualRegressionState {
  const baselines = new Map(state.baselines);
  baselines.delete(pageId);
  return { ...state, baselines };
}

// =============================================================================
// Pixel Comparison
// =============================================================================

/**
 * Compares two pixel buffers and returns diff statistics.
 * Uses per-channel color tolerance to reduce false positives.
 */
export function comparePixels(
  baseline: PixelData,
  current: PixelData,
  config: VisualRegressionConfig = DEFAULT_VR_CONFIG,
): DiffResult {
  const width = Math.min(baseline.width, current.width);
  const height = Math.min(baseline.height, current.height);
  const totalPixels = width * height;
  const changedPixels: number[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const bIdx = (y * baseline.width + x) * 4;
      const cIdx = (y * current.width + x) * 4;

      const dr = Math.abs((baseline.data[bIdx] ?? 0) - (current.data[cIdx] ?? 0));
      const dg = Math.abs((baseline.data[bIdx + 1] ?? 0) - (current.data[cIdx + 1] ?? 0));
      const db = Math.abs((baseline.data[bIdx + 2] ?? 0) - (current.data[cIdx + 2] ?? 0));
      const da = Math.abs((baseline.data[bIdx + 3] ?? 0) - (current.data[cIdx + 3] ?? 0));

      const maxDiff = Math.max(dr, dg, db, da);

      if (maxDiff > config.colorTolerance) {
        // Anti-aliasing check: skip if pixel is likely AA
        if (config.antiAliasing && isAntiAliased(baseline, x, y, current, x, y)) {
          continue;
        }
        changedPixels.push(idx / 4);
      }
    }
  }

  // Account for size differences
  const maxWidth = Math.max(baseline.width, current.width);
  const maxHeight = Math.max(baseline.height, current.height);
  const sizeExtra = maxWidth * maxHeight - totalPixels;
  const totalChanged = changedPixels.length + sizeExtra;
  const totalComparable = Math.max(totalPixels, maxWidth * maxHeight);

  const diffPercentage =
    totalComparable > 0 ? (totalChanged / totalComparable) * 100 : 0;

  return {
    diffPixelCount: totalChanged,
    totalPixels: totalComparable,
    diffPercentage,
    withinThreshold: diffPercentage <= config.diffThreshold,
    threshold: config.diffThreshold,
    changedPixels,
  };
}

/**
 * Simple anti-aliasing detection: pixel is likely AA if its neighbors
 * in the baseline differ significantly (edge pixel).
 */
function isAntiAliased(
  img1: PixelData,
  x1: number,
  y1: number,
  _img2: PixelData,
  _x2: number,
  _y2: number,
): boolean {
  // Check if pixel is on an edge in the baseline
  const neighbors = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
  ];
  let edgeCount = 0;
  for (const [dx, dy] of neighbors) {
    const nx = x1 + dx;
    const ny = y1 + dy;
    if (nx < 0 || ny < 0 || nx >= img1.width || ny >= img1.height) continue;
    const idx1 = (y1 * img1.width + x1) * 4;
    const idx2 = (ny * img1.width + nx) * 4;
    const diff =
      Math.abs((img1.data[idx1] ?? 0) - (img1.data[idx2] ?? 0)) +
      Math.abs((img1.data[idx1 + 1] ?? 0) - (img1.data[idx2 + 1] ?? 0)) +
      Math.abs((img1.data[idx1 + 2] ?? 0) - (img1.data[idx2 + 2] ?? 0));
    if (diff > 50) edgeCount++;
  }
  return edgeCount >= 2;
}

// =============================================================================
// Full Comparison Pipeline
// =============================================================================

/**
 * Compares current pixels against stored baseline for a page.
 * Returns comparison result and updated state with history.
 */
export function compareWithBaseline(
  state: VisualRegressionState,
  pageId: string,
  current: PixelData,
  timestamp: number = Date.now(),
): { state: VisualRegressionState; result: ComparisonResult | null } {
  const baseline = state.baselines.get(pageId);
  if (!baseline) {
    return { state, result: null };
  }

  const diff = comparePixels(baseline.pixels, current, state.config);
  const result: ComparisonResult = {
    pageId,
    pass: diff.withinThreshold,
    diff,
    baselineCapturedAt: baseline.capturedAt,
    comparedAt: timestamp,
  };

  return {
    state: { ...state, history: [...state.history, result] },
    result,
  };
}

/** Returns comparison history for a page. */
export function getHistory(
  state: VisualRegressionState,
  pageId?: string,
): ComparisonResult[] {
  if (!pageId) return state.history;
  return state.history.filter((r) => r.pageId === pageId);
}

/** Returns pass rate across all comparisons (0-1). */
export function getPassRate(state: VisualRegressionState): number {
  if (state.history.length === 0) return 1;
  const passed = state.history.filter((r) => r.pass).length;
  return passed / state.history.length;
}
