/**
 * Performance Benchmark — Measures generation time, preview latency, tool execution time
 *
 * Provides structured benchmarking with statistical analysis:
 * - Average, median (p50), p95, p99 latencies
 * - Throughput measurements
 * - Configurable warmup and iteration counts
 */

// =============================================================================
// Types
// =============================================================================

export type BenchmarkCategory = 'generation' | 'preview' | 'tool_execution';

export interface BenchmarkResult {
  /** Benchmark name */
  name: string;
  /** Category */
  category: BenchmarkCategory;
  /** Number of iterations run */
  iterations: number;
  /** Individual run times in ms */
  samples: number[];
  /** Statistical summary */
  stats: BenchmarkStats;
  /** Timestamp when benchmark completed */
  completedAt: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

export interface BenchmarkStats {
  /** Minimum time (ms) */
  min: number;
  /** Maximum time (ms) */
  max: number;
  /** Average/mean time (ms) */
  avg: number;
  /** Median (50th percentile) (ms) */
  p50: number;
  /** 95th percentile (ms) */
  p95: number;
  /** 99th percentile (ms) */
  p99: number;
  /** Standard deviation (ms) */
  stdDev: number;
  /** Operations per second */
  opsPerSec: number;
}

export interface BenchmarkConfig {
  /** Number of warmup runs (not counted in results) */
  warmupIterations: number;
  /** Number of measured iterations */
  iterations: number;
  /** Timeout per iteration in ms */
  timeoutMs: number;
  /** Whether to run GC between iterations (if available) */
  gcBetweenIterations: boolean;
}

export const DEFAULT_BENCHMARK_CONFIG: BenchmarkConfig = {
  warmupIterations: 3,
  iterations: 10,
  timeoutMs: 30000,
  gcBetweenIterations: false,
};

export interface BenchmarkSuite {
  /** Suite name */
  name: string;
  /** Description */
  description: string;
  /** Individual benchmark results */
  results: BenchmarkResult[];
  /** Total suite duration (ms) */
  totalDurationMs: number;
  /** Suite start timestamp */
  startedAt: number;
  /** Suite end timestamp */
  completedAt: number;
}

export interface BenchmarkComparison {
  /** Baseline benchmark */
  baseline: BenchmarkResult;
  /** Current benchmark */
  current: BenchmarkResult;
  /** Difference in avg (positive = slower) */
  avgDiffMs: number;
  /** Percentage change (positive = slower) */
  avgDiffPercent: number;
  /** Difference in p95 */
  p95DiffMs: number;
  /** Whether current is within acceptable threshold */
  acceptable: boolean;
  /** Threshold used for comparison */
  thresholdPercent: number;
}

// =============================================================================
// Statistical Functions
// =============================================================================

/**
 * Computes statistical summary from sample times.
 */
export function computeStats(samples: number[]): BenchmarkStats {
  if (samples.length === 0) {
    return {
      min: 0,
      max: 0,
      avg: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      stdDev: 0,
      opsPerSec: 0,
    };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const avg = sum / sorted.length;

  // Standard deviation
  const squaredDiffs = sorted.map((v) => Math.pow(v - avg, 2));
  const avgSquaredDiff = squaredDiffs.reduce((acc, v) => acc + v, 0) / sorted.length;
  const stdDev = Math.sqrt(avgSquaredDiff);

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    stdDev,
    opsPerSec: avg > 0 ? 1000 / avg : 0,
  };
}

/**
 * Computes percentile from sorted array.
 */
export function percentile(sortedSamples: number[], p: number): number {
  if (sortedSamples.length === 0) return 0;
  if (sortedSamples.length === 1) return sortedSamples[0];

  const index = (p / 100) * (sortedSamples.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sortedSamples[lower];
  }

  // Linear interpolation
  const fraction = index - lower;
  return sortedSamples[lower] + fraction * (sortedSamples[upper] - sortedSamples[lower]);
}

// =============================================================================
// Benchmark Runner
// =============================================================================

export type BenchmarkFn = () => Promise<void> | void;

/**
 * Runs a single benchmark with the given configuration.
 */
export async function runBenchmark(
  name: string,
  category: BenchmarkCategory,
  fn: BenchmarkFn,
  config: Partial<BenchmarkConfig> = {},
  metadata?: Record<string, unknown>,
): Promise<BenchmarkResult> {
  const cfg = { ...DEFAULT_BENCHMARK_CONFIG, ...config };
  const samples: number[] = [];

  // Warmup phase
  for (let i = 0; i < cfg.warmupIterations; i++) {
    await runWithTimeout(fn, cfg.timeoutMs);
  }

  // Measured iterations
  for (let i = 0; i < cfg.iterations; i++) {
    if (cfg.gcBetweenIterations && typeof global.gc === 'function') {
      global.gc();
    }

    const start = performance.now();
    await runWithTimeout(fn, cfg.timeoutMs);
    const elapsed = performance.now() - start;
    samples.push(elapsed);
  }

  return {
    name,
    category,
    iterations: cfg.iterations,
    samples,
    stats: computeStats(samples),
    completedAt: Date.now(),
    metadata,
  };
}

/**
 * Runs function with timeout.
 */
async function runWithTimeout(fn: BenchmarkFn, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Benchmark timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    Promise.resolve(fn())
      .then(() => {
        clearTimeout(timer);
        resolve();
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// =============================================================================
// Benchmark Suite
// =============================================================================

export interface BenchmarkDefinition {
  name: string;
  category: BenchmarkCategory;
  fn: BenchmarkFn;
  config?: Partial<BenchmarkConfig>;
  metadata?: Record<string, unknown>;
}

/**
 * Runs a suite of benchmarks.
 */
export async function runBenchmarkSuite(
  name: string,
  description: string,
  benchmarks: BenchmarkDefinition[],
): Promise<BenchmarkSuite> {
  const startedAt = Date.now();
  const results: BenchmarkResult[] = [];

  for (const bench of benchmarks) {
    const result = await runBenchmark(
      bench.name,
      bench.category,
      bench.fn,
      bench.config,
      bench.metadata,
    );
    results.push(result);
  }

  const completedAt = Date.now();

  return {
    name,
    description,
    results,
    totalDurationMs: completedAt - startedAt,
    startedAt,
    completedAt,
  };
}

// =============================================================================
// Comparison
// =============================================================================

/**
 * Compares two benchmark results.
 */
export function compareBenchmarks(
  baseline: BenchmarkResult,
  current: BenchmarkResult,
  thresholdPercent: number = 10,
): BenchmarkComparison {
  const avgDiffMs = current.stats.avg - baseline.stats.avg;
  const avgDiffPercent = baseline.stats.avg > 0
    ? (avgDiffMs / baseline.stats.avg) * 100
    : 0;
  const p95DiffMs = current.stats.p95 - baseline.stats.p95;

  return {
    baseline,
    current,
    avgDiffMs,
    avgDiffPercent,
    p95DiffMs,
    acceptable: avgDiffPercent <= thresholdPercent,
    thresholdPercent,
  };
}

// =============================================================================
// Specific Benchmark Types
// =============================================================================

/** Generation time benchmark result */
export interface GenerationBenchmark extends BenchmarkResult {
  category: 'generation';
  metadata: {
    promptTokens?: number;
    completionTokens?: number;
    modelId?: string;
  };
}

/** Preview latency benchmark result */
export interface PreviewBenchmark extends BenchmarkResult {
  category: 'preview';
  metadata: {
    previewType?: 'full' | 'incremental' | 'hot_reload';
    componentCount?: number;
  };
}

/** Tool execution benchmark result */
export interface ToolExecutionBenchmark extends BenchmarkResult {
  category: 'tool_execution';
  metadata: {
    toolName?: string;
    inputSize?: number;
  };
}

// =============================================================================
// Benchmark Helpers
// =============================================================================

/**
 * Creates a generation benchmark runner.
 */
export function createGenerationBenchmark(
  name: string,
  generateFn: () => Promise<{ promptTokens?: number; completionTokens?: number }>,
  config?: Partial<BenchmarkConfig>,
): BenchmarkDefinition {
  let lastResult: { promptTokens?: number; completionTokens?: number } = {};

  return {
    name,
    category: 'generation',
    fn: async () => {
      lastResult = await generateFn();
    },
    config,
    metadata: {
      get promptTokens() { return lastResult.promptTokens; },
      get completionTokens() { return lastResult.completionTokens; },
    },
  };
}

/**
 * Creates a preview latency benchmark runner.
 */
export function createPreviewBenchmark(
  name: string,
  previewFn: () => Promise<void>,
  previewType: 'full' | 'incremental' | 'hot_reload',
  config?: Partial<BenchmarkConfig>,
): BenchmarkDefinition {
  return {
    name,
    category: 'preview',
    fn: previewFn,
    config,
    metadata: { previewType },
  };
}

/**
 * Creates a tool execution benchmark runner.
 */
export function createToolExecutionBenchmark(
  name: string,
  toolName: string,
  executeFn: () => Promise<void>,
  config?: Partial<BenchmarkConfig>,
): BenchmarkDefinition {
  return {
    name,
    category: 'tool_execution',
    fn: executeFn,
    config,
    metadata: { toolName },
  };
}

// =============================================================================
// Reporting
// =============================================================================

/**
 * Formats benchmark result as human-readable string.
 */
export function formatBenchmarkResult(result: BenchmarkResult): string {
  const { name, category, iterations, stats } = result;
  const lines = [
    `📊 ${name} (${category})`,
    `   Iterations: ${iterations}`,
    `   Min: ${stats.min.toFixed(2)}ms`,
    `   Max: ${stats.max.toFixed(2)}ms`,
    `   Avg: ${stats.avg.toFixed(2)}ms`,
    `   Median (p50): ${stats.p50.toFixed(2)}ms`,
    `   p95: ${stats.p95.toFixed(2)}ms`,
    `   p99: ${stats.p99.toFixed(2)}ms`,
    `   Std Dev: ${stats.stdDev.toFixed(2)}ms`,
    `   Ops/sec: ${stats.opsPerSec.toFixed(2)}`,
  ];
  return lines.join('\n');
}

/**
 * Formats benchmark suite as human-readable string.
 */
export function formatBenchmarkSuite(suite: BenchmarkSuite): string {
  const header = [
    `═══════════════════════════════════════════`,
    `📈 Benchmark Suite: ${suite.name}`,
    `   ${suite.description}`,
    `   Total Duration: ${suite.totalDurationMs.toFixed(0)}ms`,
    `═══════════════════════════════════════════`,
  ];

  const results = suite.results.map(formatBenchmarkResult);

  return [...header, '', ...results].join('\n');
}

/**
 * Formats comparison as human-readable string.
 */
export function formatComparison(comparison: BenchmarkComparison): string {
  const { baseline, current, avgDiffMs, avgDiffPercent, p95DiffMs, acceptable } = comparison;
  const trend = avgDiffMs > 0 ? '🔺 slower' : avgDiffMs < 0 ? '🔻 faster' : '➖ same';
  const status = acceptable ? '✅ PASS' : '❌ FAIL';

  return [
    `📊 Comparison: ${baseline.name}`,
    `   Baseline avg: ${baseline.stats.avg.toFixed(2)}ms`,
    `   Current avg: ${current.stats.avg.toFixed(2)}ms`,
    `   Difference: ${avgDiffMs > 0 ? '+' : ''}${avgDiffMs.toFixed(2)}ms (${avgDiffPercent > 0 ? '+' : ''}${avgDiffPercent.toFixed(1)}%) ${trend}`,
    `   p95 diff: ${p95DiffMs > 0 ? '+' : ''}${p95DiffMs.toFixed(2)}ms`,
    `   Status: ${status} (threshold: ${comparison.thresholdPercent}%)`,
  ].join('\n');
}

// =============================================================================
// Benchmark State Management
// =============================================================================

export interface BenchmarkState {
  /** Stored baseline results by name */
  baselines: Map<string, BenchmarkResult>;
  /** Historical suite results */
  history: BenchmarkSuite[];
  /** Configuration */
  config: BenchmarkConfig;
}

/**
 * Creates initial benchmark state.
 */
export function createBenchmarkState(
  config: Partial<BenchmarkConfig> = {},
): BenchmarkState {
  return {
    baselines: new Map(),
    history: [],
    config: { ...DEFAULT_BENCHMARK_CONFIG, ...config },
  };
}

/**
 * Stores a result as baseline.
 */
export function setBaseline(
  state: BenchmarkState,
  result: BenchmarkResult,
): BenchmarkState {
  const baselines = new Map(state.baselines);
  baselines.set(result.name, result);
  return { ...state, baselines };
}

/**
 * Gets baseline for a benchmark name.
 */
export function getBaseline(
  state: BenchmarkState,
  name: string,
): BenchmarkResult | undefined {
  return state.baselines.get(name);
}

/**
 * Adds suite to history.
 */
export function addToHistory(
  state: BenchmarkState,
  suite: BenchmarkSuite,
): BenchmarkState {
  return { ...state, history: [...state.history, suite] };
}

/**
 * Gets performance trend for a benchmark over history.
 */
export function getPerformanceTrend(
  state: BenchmarkState,
  benchmarkName: string,
  limit: number = 10,
): { timestamp: number; avgMs: number }[] {
  const points: { timestamp: number; avgMs: number }[] = [];

  for (const suite of state.history.slice(-limit)) {
    const result = suite.results.find((r) => r.name === benchmarkName);
    if (result) {
      points.push({
        timestamp: result.completedAt,
        avgMs: result.stats.avg,
      });
    }
  }

  return points;
}
