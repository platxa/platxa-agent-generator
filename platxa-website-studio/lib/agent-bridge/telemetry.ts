/**
 * Telemetry & Analytics — Generation Quality Tracking
 *
 * Logs quality score, generation time, token count, and user
 * satisfaction signals for each generation run.
 */

// =============================================================================
// Types
// =============================================================================

/** A single telemetry event */
export interface TelemetryEvent {
  /** Unique event ID */
  id: string;
  /** Event type */
  type: TelemetryEventType;
  /** ISO timestamp */
  timestamp: string;
  /** Event payload */
  data: Record<string, unknown>;
  /** Session identifier */
  sessionId: string;
}

export type TelemetryEventType =
  | "generation_start"
  | "generation_complete"
  | "generation_error"
  | "quality_score"
  | "user_satisfaction"
  | "token_usage"
  | "performance";

/** Generation metrics captured per run */
export interface GenerationMetrics {
  /** Unique generation ID */
  generationId: string;
  /** Session ID */
  sessionId: string;
  /** Start time (ms since epoch) */
  startTime: number;
  /** End time (ms since epoch, 0 if not finished) */
  endTime: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Total tokens consumed (prompt + completion) */
  tokenCount: number;
  /** Prompt tokens */
  promptTokens: number;
  /** Completion tokens */
  completionTokens: number;
  /** Quality score 0-100 */
  qualityScore: number;
  /** Whether generation succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Number of sections generated */
  sectionCount: number;
  /** Odoo version targeted */
  odooVersion: string;
  /** User satisfaction signal (-1=negative, 0=neutral, 1=positive) */
  satisfaction: -1 | 0 | 1;
}

/** Aggregated analytics over multiple generations */
export interface AnalyticsSummary {
  /** Total generations tracked */
  totalGenerations: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Average quality score */
  avgQualityScore: number;
  /** Median quality score */
  medianQualityScore: number;
  /** Average generation time (ms) */
  avgDurationMs: number;
  /** p95 generation time (ms) */
  p95DurationMs: number;
  /** Average token usage */
  avgTokenCount: number;
  /** Total tokens consumed */
  totalTokens: number;
  /** User satisfaction distribution */
  satisfactionDistribution: { positive: number; neutral: number; negative: number };
  /** Quality score trend (last 10 vs prior 10) */
  qualityTrend: number;
}

/** Telemetry store state */
export interface TelemetryState {
  /** All recorded events */
  events: TelemetryEvent[];
  /** All generation metrics */
  metrics: GenerationMetrics[];
  /** Current session ID */
  sessionId: string;
  /** Event counter for ID generation */
  eventCounter: number;
}

// =============================================================================
// ID Generation
// =============================================================================

let globalCounter = 0;

export function resetTelemetryCounter(): void {
  globalCounter = 0;
}

function nextId(prefix: string): string {
  return `${prefix}_${++globalCounter}`;
}

// =============================================================================
// State Management
// =============================================================================

/** Creates a new telemetry state. */
export function createTelemetryState(sessionId: string): TelemetryState {
  return {
    events: [],
    metrics: [],
    sessionId,
    eventCounter: 0,
  };
}

/** Records a telemetry event. */
export function recordEvent(
  state: TelemetryState,
  type: TelemetryEventType,
  data: Record<string, unknown>,
): TelemetryState {
  const event: TelemetryEvent = {
    id: nextId("evt"),
    type,
    timestamp: new Date().toISOString(),
    data,
    sessionId: state.sessionId,
  };
  return {
    ...state,
    events: [...state.events, event],
    eventCounter: state.eventCounter + 1,
  };
}

/** Records a complete generation run. */
export function recordGeneration(
  state: TelemetryState,
  metrics: Omit<GenerationMetrics, "generationId" | "sessionId">,
): TelemetryState {
  const genMetrics: GenerationMetrics = {
    ...metrics,
    generationId: nextId("gen"),
    sessionId: state.sessionId,
  };

  let updated = { ...state, metrics: [...state.metrics, genMetrics] };

  // Also record as events
  updated = recordEvent(updated, "generation_complete", {
    generationId: genMetrics.generationId,
    durationMs: genMetrics.durationMs,
    success: genMetrics.success,
  });
  updated = recordEvent(updated, "quality_score", {
    generationId: genMetrics.generationId,
    score: genMetrics.qualityScore,
  });
  updated = recordEvent(updated, "token_usage", {
    generationId: genMetrics.generationId,
    total: genMetrics.tokenCount,
    prompt: genMetrics.promptTokens,
    completion: genMetrics.completionTokens,
  });

  return updated;
}

/** Records user satisfaction for a generation. */
export function recordSatisfaction(
  state: TelemetryState,
  generationId: string,
  satisfaction: -1 | 0 | 1,
): TelemetryState {
  const metrics = state.metrics.map((m) =>
    m.generationId === generationId ? { ...m, satisfaction } : m,
  );
  const updated = { ...state, metrics };
  return recordEvent(updated, "user_satisfaction", {
    generationId,
    satisfaction,
  });
}

// =============================================================================
// Analytics
// =============================================================================

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/** Computes analytics summary from all tracked metrics. */
export function computeAnalytics(state: TelemetryState): AnalyticsSummary {
  const { metrics } = state;
  const total = metrics.length;

  if (total === 0) {
    return {
      totalGenerations: 0,
      successRate: 0,
      avgQualityScore: 0,
      medianQualityScore: 0,
      avgDurationMs: 0,
      p95DurationMs: 0,
      avgTokenCount: 0,
      totalTokens: 0,
      satisfactionDistribution: { positive: 0, neutral: 0, negative: 0 },
      qualityTrend: 0,
    };
  }

  const successCount = metrics.filter((m) => m.success).length;
  const qualityScores = metrics.map((m) => m.qualityScore);
  const durations = metrics.map((m) => m.durationMs);
  const tokens = metrics.map((m) => m.tokenCount);

  const positive = metrics.filter((m) => m.satisfaction === 1).length;
  const negative = metrics.filter((m) => m.satisfaction === -1).length;
  const neutral = total - positive - negative;

  // Quality trend: compare last 10 vs prior 10
  let qualityTrend = 0;
  if (total >= 2) {
    const mid = Math.floor(total / 2);
    const recentScores = qualityScores.slice(mid);
    const priorScores = qualityScores.slice(0, mid);
    const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
    const priorAvg = priorScores.reduce((a, b) => a + b, 0) / priorScores.length;
    qualityTrend = recentAvg - priorAvg;
  }

  return {
    totalGenerations: total,
    successRate: successCount / total,
    avgQualityScore: qualityScores.reduce((a, b) => a + b, 0) / total,
    medianQualityScore: median(qualityScores),
    avgDurationMs: durations.reduce((a, b) => a + b, 0) / total,
    p95DurationMs: percentile(durations, 95),
    avgTokenCount: tokens.reduce((a, b) => a + b, 0) / total,
    totalTokens: tokens.reduce((a, b) => a + b, 0),
    satisfactionDistribution: { positive, neutral, negative },
    qualityTrend,
  };
}

/** Returns metrics filtered by time range. */
export function getMetricsByRange(
  state: TelemetryState,
  startMs: number,
  endMs: number,
): GenerationMetrics[] {
  return state.metrics.filter(
    (m) => m.startTime >= startMs && m.startTime <= endMs,
  );
}

/** Returns events by type. */
export function getEventsByType(
  state: TelemetryState,
  type: TelemetryEventType,
): TelemetryEvent[] {
  return state.events.filter((e) => e.type === type);
}

/** Serializes telemetry state for export. */
export function serializeTelemetry(state: TelemetryState): string {
  return JSON.stringify({
    sessionId: state.sessionId,
    events: state.events,
    metrics: state.metrics,
    exportedAt: new Date().toISOString(),
  });
}

/** Deserializes telemetry data. */
export function deserializeTelemetry(json: string): TelemetryState {
  const data = JSON.parse(json);
  return {
    sessionId: data.sessionId ?? "",
    events: data.events ?? [],
    metrics: data.metrics ?? [],
    eventCounter: (data.events ?? []).length,
  };
}
