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
