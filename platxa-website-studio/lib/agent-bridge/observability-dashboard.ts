/**
 * Agent Observability Dashboard
 *
 * Tracks latency, quality scores, token costs, and error rates
 * across agent generations.
 */

// =============================================================================
// Types
// =============================================================================

export interface GenerationRecord {
  /** Unique ID */
  id: string;
  /** Timestamp (ms) */
  timestamp: number;
  /** Duration (ms) */
  durationMs: number;
  /** Quality score (0-100) */
  qualityScore: number;
  /** Prompt tokens */
  promptTokens: number;
  /** Completion tokens */
  completionTokens: number;
  /** Cost (USD) */
  cost: number;
  /** Success */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Model used */
  model: string;
  /** Task type */
  taskType: string;
}

export interface DashboardMetrics {
  /** Total generations */
  totalGenerations: number;
  /** Successful generations */
  successCount: number;
  /** Failed generations */
  errorCount: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** Average generation time (ms) */
  avgLatencyMs: number;
  /** p50 latency (ms) */
  p50LatencyMs: number;
  /** p95 latency (ms) */
  p95LatencyMs: number;
  /** Average quality score */
  avgQualityScore: number;
  /** Quality score distribution */
  qualityDistribution: { excellent: number; good: number; fair: number; poor: number };
  /** Total cost (USD) */
  totalCost: number;
  /** Average cost per generation */
  avgCostPerGeneration: number;
  /** Total tokens */
  totalTokens: number;
  /** Cost by model */
  costByModel: Record<string, number>;
  /** Count by task type */
  countByTaskType: Record<string, number>;
}

export interface DashboardConfig {
  /** Quality thresholds for distribution */
  qualityThresholds: { excellent: number; good: number; fair: number };
  /** Max records to keep */
  maxRecords: number;
}

export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  qualityThresholds: { excellent: 90, good: 70, fair: 50 },
  maxRecords: 10000,
};

export interface DashboardState {
  records: GenerationRecord[];
  config: DashboardConfig;
  counter: number;
}

// =============================================================================
// State
// =============================================================================

export function createDashboardState(
  config: Partial<DashboardConfig> = {},
): DashboardState {
  return {
    records: [],
    config: { ...DEFAULT_DASHBOARD_CONFIG, ...config },
    counter: 0,
  };
}

// =============================================================================
// Recording
// =============================================================================

export function recordGeneration(
  state: DashboardState,
  record: Omit<GenerationRecord, "id">,
): DashboardState {
  const nextCounter = state.counter + 1;
  const newRecord: GenerationRecord = { ...record, id: `gen_${nextCounter}` };
  let records = [...state.records, newRecord];
  if (records.length > state.config.maxRecords) {
    records = records.slice(records.length - state.config.maxRecords);
  }
  return { ...state, records, counter: nextCounter };
}

// =============================================================================
// Metrics Computation
// =============================================================================

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export function computeMetrics(state: DashboardState): DashboardMetrics {
  const { records, config } = state;
  const total = records.length;

  if (total === 0) {
    return {
      totalGenerations: 0,
      successCount: 0,
      errorCount: 0,
      errorRate: 0,
      avgLatencyMs: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      avgQualityScore: 0,
      qualityDistribution: { excellent: 0, good: 0, fair: 0, poor: 0 },
      totalCost: 0,
      avgCostPerGeneration: 0,
      totalTokens: 0,
      costByModel: {},
      countByTaskType: {},
    };
  }

  const successCount = records.filter((r) => r.success).length;
  const errorCount = total - successCount;
  const durations = records.map((r) => r.durationMs);
  const scores = records.map((r) => r.qualityScore);
  const { excellent, good, fair } = config.qualityThresholds;

  let excellentCount = 0, goodCount = 0, fairCount = 0, poorCount = 0;
  for (const s of scores) {
    if (s >= excellent) excellentCount++;
    else if (s >= good) goodCount++;
    else if (s >= fair) fairCount++;
    else poorCount++;
  }

  const totalCost = records.reduce((s, r) => s + r.cost, 0);
  const totalTokens = records.reduce((s, r) => s + r.promptTokens + r.completionTokens, 0);

  const costByModel: Record<string, number> = {};
  const countByTaskType: Record<string, number> = {};
  for (const r of records) {
    costByModel[r.model] = (costByModel[r.model] ?? 0) + r.cost;
    countByTaskType[r.taskType] = (countByTaskType[r.taskType] ?? 0) + 1;
  }

  return {
    totalGenerations: total,
    successCount,
    errorCount,
    errorRate: errorCount / total,
    avgLatencyMs: durations.reduce((a, b) => a + b, 0) / total,
    p50LatencyMs: percentile(durations, 50),
    p95LatencyMs: percentile(durations, 95),
    avgQualityScore: scores.reduce((a, b) => a + b, 0) / total,
    qualityDistribution: {
      excellent: excellentCount,
      good: goodCount,
      fair: fairCount,
      poor: poorCount,
    },
    totalCost,
    avgCostPerGeneration: totalCost / total,
    totalTokens,
    costByModel,
    countByTaskType,
  };
}

// =============================================================================
// Time-based Queries
// =============================================================================

/** Returns records within a time range. */
export function getRecordsByRange(
  state: DashboardState,
  startMs: number,
  endMs: number,
): GenerationRecord[] {
  return state.records.filter((r) => r.timestamp >= startMs && r.timestamp <= endMs);
}

/** Returns records for a specific model. */
export function getRecordsByModel(
  state: DashboardState,
  model: string,
): GenerationRecord[] {
  return state.records.filter((r) => r.model === model);
}

/** Returns error records. */
export function getErrors(state: DashboardState): GenerationRecord[] {
  return state.records.filter((r) => !r.success);
}

/** Returns recent N records. */
export function getRecentRecords(
  state: DashboardState,
  count: number,
): GenerationRecord[] {
  return state.records.slice(-count);
}

/** Computes metrics for a time window. */
export function computeWindowMetrics(
  state: DashboardState,
  startMs: number,
  endMs: number,
): DashboardMetrics {
  const filtered = getRecordsByRange(state, startMs, endMs);
  return computeMetrics({ ...state, records: filtered });
}

// =============================================================================
// Dashboard Rendering (Feature #189)
// =============================================================================

export interface DashboardView {
  /** Title for the dashboard section */
  title: string;
  /** Time range description */
  timeRange: string;
  /** Formatted latency section */
  latency: {
    avg: string;
    p50: string;
    p95: string;
    bar: string;
  };
  /** Formatted quality section */
  quality: {
    avg: string;
    distribution: string;
    bar: string;
  };
  /** Formatted cost section */
  cost: {
    total: string;
    perGeneration: string;
    byModel: string[];
  };
  /** Summary stats */
  summary: {
    totalGenerations: string;
    successRate: string;
    errorRate: string;
    totalTokens: string;
  };
}

/**
 * Formats duration in human-readable format.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * Formats cost in USD.
 */
export function formatCost(usd: number): string {
  if (usd < 0.01) return `$${(usd * 100).toFixed(3)}¢`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

/**
 * Creates an ASCII bar for visualization.
 */
export function createBar(value: number, max: number, width: number = 20): string {
  const filled = Math.round((value / max) * width);
  const empty = width - filled;
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));
}

/**
 * Creates quality distribution bar.
 */
export function createQualityBar(dist: DashboardMetrics['qualityDistribution']): string {
  const total = dist.excellent + dist.good + dist.fair + dist.poor;
  if (total === 0) return '░'.repeat(20);

  const width = 20;
  const e = Math.round((dist.excellent / total) * width);
  const g = Math.round((dist.good / total) * width);
  const f = Math.round((dist.fair / total) * width);
  const p = width - e - g - f;

  return '🟢'.repeat(Math.max(0, e)) +
         '🟡'.repeat(Math.max(0, g)) +
         '🟠'.repeat(Math.max(0, f)) +
         '🔴'.repeat(Math.max(0, p));
}

/**
 * Formats latency bar relative to a target.
 */
export function createLatencyBar(avgMs: number, targetMs: number = 5000): string {
  const ratio = Math.min(avgMs / targetMs, 1);
  return createBar(ratio * 100, 100);
}

/**
 * Renders dashboard metrics as a DashboardView.
 */
export function renderDashboard(
  metrics: DashboardMetrics,
  title: string = 'Agent Metrics Dashboard',
  timeRange: string = 'All Time',
): DashboardView {
  const { qualityDistribution } = metrics;
  const total = qualityDistribution.excellent + qualityDistribution.good +
                qualityDistribution.fair + qualityDistribution.poor;

  const distStr = total > 0
    ? `Excellent: ${qualityDistribution.excellent} | Good: ${qualityDistribution.good} | Fair: ${qualityDistribution.fair} | Poor: ${qualityDistribution.poor}`
    : 'No data';

  const costByModelLines = Object.entries(metrics.costByModel)
    .sort(([, a], [, b]) => b - a)
    .map(([model, cost]) => `  ${model}: ${formatCost(cost)}`);

  return {
    title,
    timeRange,
    latency: {
      avg: formatDuration(metrics.avgLatencyMs),
      p50: formatDuration(metrics.p50LatencyMs),
      p95: formatDuration(metrics.p95LatencyMs),
      bar: createLatencyBar(metrics.avgLatencyMs),
    },
    quality: {
      avg: metrics.avgQualityScore.toFixed(1),
      distribution: distStr,
      bar: createQualityBar(qualityDistribution),
    },
    cost: {
      total: formatCost(metrics.totalCost),
      perGeneration: formatCost(metrics.avgCostPerGeneration),
      byModel: costByModelLines,
    },
    summary: {
      totalGenerations: metrics.totalGenerations.toLocaleString(),
      successRate: `${((1 - metrics.errorRate) * 100).toFixed(1)}%`,
      errorRate: `${(metrics.errorRate * 100).toFixed(1)}%`,
      totalTokens: metrics.totalTokens.toLocaleString(),
    },
  };
}

/**
 * Formats dashboard view as a string for display.
 */
export function formatDashboard(view: DashboardView): string {
  const lines = [
    '╔══════════════════════════════════════════════════════════════╗',
    `║  ${view.title.padEnd(58)}║`,
    `║  Time Range: ${view.timeRange.padEnd(47)}║`,
    '╠══════════════════════════════════════════════════════════════╣',
    '║  📊 LATENCY                                                  ║',
    `║    Average: ${view.latency.avg.padEnd(10)} ${view.latency.bar.padEnd(25)}║`,
    `║    p50:     ${view.latency.p50.padEnd(10)} p95: ${view.latency.p95.padEnd(20)}║`,
    '╠══════════════════════════════════════════════════════════════╣',
    '║  ⭐ QUALITY                                                  ║',
    `║    Average Score: ${view.quality.avg.padEnd(40)}║`,
    `║    ${view.quality.bar.padEnd(58)}║`,
    `║    ${view.quality.distribution.slice(0, 56).padEnd(56)}  ║`,
    '╠══════════════════════════════════════════════════════════════╣',
    '║  💰 COST                                                     ║',
    `║    Total: ${view.cost.total.padEnd(15)} Per Gen: ${view.cost.perGeneration.padEnd(18)}║`,
    ...view.cost.byModel.slice(0, 3).map(line =>
      `║  ${line.padEnd(58)}║`
    ),
    '╠══════════════════════════════════════════════════════════════╣',
    '║  📈 SUMMARY                                                  ║',
    `║    Generations: ${view.summary.totalGenerations.padEnd(10)} Success: ${view.summary.successRate.padEnd(18)}║`,
    `║    Tokens: ${view.summary.totalTokens.padEnd(14)} Errors: ${view.summary.errorRate.padEnd(19)}║`,
    '╚══════════════════════════════════════════════════════════════╝',
  ];

  return lines.join('\n');
}

/**
 * Computes trend data for a metric over time buckets.
 */
export interface TrendPoint {
  timestamp: number;
  value: number;
  label: string;
}

export function computeLatencyTrend(
  state: DashboardState,
  bucketCount: number = 10,
): TrendPoint[] {
  if (state.records.length === 0) return [];

  const sorted = [...state.records].sort((a, b) => a.timestamp - b.timestamp);
  const minTs = sorted[0].timestamp;
  const maxTs = sorted[sorted.length - 1].timestamp;
  const bucketSize = Math.max(1, (maxTs - minTs) / bucketCount);

  const buckets: { sum: number; count: number; ts: number }[] = [];
  for (let i = 0; i < bucketCount; i++) {
    buckets.push({ sum: 0, count: 0, ts: minTs + i * bucketSize });
  }

  for (const r of sorted) {
    const idx = Math.min(
      Math.floor((r.timestamp - minTs) / bucketSize),
      bucketCount - 1
    );
    buckets[idx].sum += r.durationMs;
    buckets[idx].count++;
  }

  return buckets
    .filter(b => b.count > 0)
    .map(b => ({
      timestamp: b.ts,
      value: b.sum / b.count,
      label: formatDuration(b.sum / b.count),
    }));
}

/**
 * Computes quality trend over time buckets.
 */
export function computeQualityTrend(
  state: DashboardState,
  bucketCount: number = 10,
): TrendPoint[] {
  if (state.records.length === 0) return [];

  const sorted = [...state.records].sort((a, b) => a.timestamp - b.timestamp);
  const minTs = sorted[0].timestamp;
  const maxTs = sorted[sorted.length - 1].timestamp;
  const bucketSize = Math.max(1, (maxTs - minTs) / bucketCount);

  const buckets: { sum: number; count: number; ts: number }[] = [];
  for (let i = 0; i < bucketCount; i++) {
    buckets.push({ sum: 0, count: 0, ts: minTs + i * bucketSize });
  }

  for (const r of sorted) {
    const idx = Math.min(
      Math.floor((r.timestamp - minTs) / bucketSize),
      bucketCount - 1
    );
    buckets[idx].sum += r.qualityScore;
    buckets[idx].count++;
  }

  return buckets
    .filter(b => b.count > 0)
    .map(b => ({
      timestamp: b.ts,
      value: b.sum / b.count,
      label: (b.sum / b.count).toFixed(1),
    }));
}

/**
 * Computes cost trend over time buckets.
 */
export function computeCostTrend(
  state: DashboardState,
  bucketCount: number = 10,
): TrendPoint[] {
  if (state.records.length === 0) return [];

  const sorted = [...state.records].sort((a, b) => a.timestamp - b.timestamp);
  const minTs = sorted[0].timestamp;
  const maxTs = sorted[sorted.length - 1].timestamp;
  const bucketSize = Math.max(1, (maxTs - minTs) / bucketCount);

  const buckets: { sum: number; ts: number }[] = [];
  for (let i = 0; i < bucketCount; i++) {
    buckets.push({ sum: 0, ts: minTs + i * bucketSize });
  }

  for (const r of sorted) {
    const idx = Math.min(
      Math.floor((r.timestamp - minTs) / bucketSize),
      bucketCount - 1
    );
    buckets[idx].sum += r.cost;
  }

  return buckets.map(b => ({
    timestamp: b.ts,
    value: b.sum,
    label: formatCost(b.sum),
  }));
}

/**
 * Formats trend as ASCII sparkline.
 */
export function formatTrendSparkline(trend: TrendPoint[], width: number = 20): string {
  if (trend.length === 0) return '─'.repeat(width);

  const values = trend.map(t => t.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

  return values.map(v => {
    const normalized = (v - min) / range;
    const idx = Math.min(Math.floor(normalized * chars.length), chars.length - 1);
    return chars[idx];
  }).join('');
}

/**
 * Creates a complete dashboard summary string.
 */
export function createDashboardSummary(state: DashboardState): string {
  const metrics = computeMetrics(state);
  const view = renderDashboard(metrics);
  const dashboard = formatDashboard(view);

  const latencyTrend = computeLatencyTrend(state);
  const qualityTrend = computeQualityTrend(state);
  const costTrend = computeCostTrend(state);

  const trends = [
    '',
    '📉 TRENDS',
    `  Latency:  ${formatTrendSparkline(latencyTrend)}`,
    `  Quality:  ${formatTrendSparkline(qualityTrend)}`,
    `  Cost:     ${formatTrendSparkline(costTrend)}`,
  ].join('\n');

  return dashboard + '\n' + trends;
}
