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

// =============================================================================
// Generation Analytics Tracking (Feature #190)
// =============================================================================

/** Prompt tracking record */
export interface PromptRecord {
  /** Unique prompt ID */
  promptId: string;
  /** Prompt type */
  type: PromptType;
  /** Prompt hash (for deduplication) */
  hash: string;
  /** Prompt length in characters */
  length: number;
  /** Timestamp */
  timestamp: number;
  /** Associated generation ID (if any) */
  generationId?: string;
  /** Template used (if any) */
  templateId?: string;
}

export type PromptType =
  | 'user_request'
  | 'system_prompt'
  | 'template'
  | 'refinement'
  | 'error_recovery'
  | 'validation';

/** Error tracking record */
export interface ErrorRecord {
  /** Unique error ID */
  errorId: string;
  /** Error category */
  category: ErrorCategory;
  /** Error message */
  message: string;
  /** Error code (if any) */
  code?: string;
  /** Stack trace (if available) */
  stack?: string;
  /** Associated generation ID */
  generationId?: string;
  /** Timestamp */
  timestamp: number;
  /** Whether error was recovered */
  recovered: boolean;
  /** Recovery action taken */
  recoveryAction?: string;
}

export type ErrorCategory =
  | 'api_error'
  | 'validation_error'
  | 'timeout'
  | 'rate_limit'
  | 'content_filter'
  | 'generation_failed'
  | 'parse_error'
  | 'network_error'
  | 'unknown';

/** Extended analytics state with prompt and error tracking */
export interface AnalyticsState {
  /** Base telemetry state */
  telemetry: TelemetryState;
  /** Tracked prompts */
  prompts: PromptRecord[];
  /** Tracked errors */
  errors: ErrorRecord[];
  /** Prompt counter */
  promptCounter: number;
  /** Error counter */
  errorCounter: number;
}

/** Creates analytics state */
export function createAnalyticsState(sessionId: string): AnalyticsState {
  return {
    telemetry: createTelemetryState(sessionId),
    prompts: [],
    errors: [],
    promptCounter: 0,
    errorCounter: 0,
  };
}

/** Simple string hash for prompt deduplication */
export function hashPrompt(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/** Records a prompt */
export function trackPrompt(
  state: AnalyticsState,
  type: PromptType,
  promptText: string,
  generationId?: string,
  templateId?: string,
): AnalyticsState {
  const promptId = `prompt_${++state.promptCounter}`;
  const prompt: PromptRecord = {
    promptId,
    type,
    hash: hashPrompt(promptText),
    length: promptText.length,
    timestamp: Date.now(),
    generationId,
    templateId,
  };

  const updatedTelemetry = recordEvent(
    state.telemetry,
    'generation_start',
    { promptId, type, length: prompt.length, hash: prompt.hash }
  );

  return {
    ...state,
    telemetry: updatedTelemetry,
    prompts: [...state.prompts, prompt],
    promptCounter: state.promptCounter,
  };
}

/** Records an error */
export function trackError(
  state: AnalyticsState,
  category: ErrorCategory,
  message: string,
  options: {
    code?: string;
    stack?: string;
    generationId?: string;
    recovered?: boolean;
    recoveryAction?: string;
  } = {},
): AnalyticsState {
  const errorId = `error_${++state.errorCounter}`;
  const error: ErrorRecord = {
    errorId,
    category,
    message,
    code: options.code,
    stack: options.stack,
    generationId: options.generationId,
    timestamp: Date.now(),
    recovered: options.recovered ?? false,
    recoveryAction: options.recoveryAction,
  };

  const updatedTelemetry = recordEvent(
    state.telemetry,
    'generation_error',
    { errorId, category, message, recovered: error.recovered }
  );

  return {
    ...state,
    telemetry: updatedTelemetry,
    errors: [...state.errors, error],
    errorCounter: state.errorCounter,
  };
}

/** Records a generation with full tracking */
export function trackGeneration(
  state: AnalyticsState,
  metrics: Omit<GenerationMetrics, "generationId" | "sessionId">,
): AnalyticsState {
  const updatedTelemetry = recordGeneration(state.telemetry, metrics);
  return { ...state, telemetry: updatedTelemetry };
}

/** Records user satisfaction with analytics */
export function trackSatisfaction(
  state: AnalyticsState,
  generationId: string,
  satisfaction: -1 | 0 | 1,
): AnalyticsState {
  const updatedTelemetry = recordSatisfaction(state.telemetry, generationId, satisfaction);
  return { ...state, telemetry: updatedTelemetry };
}

// =============================================================================
// Analytics Queries
// =============================================================================

/** Prompt analytics summary */
export interface PromptAnalytics {
  /** Total prompts tracked */
  totalPrompts: number;
  /** Prompts by type */
  byType: Record<PromptType, number>;
  /** Average prompt length */
  avgLength: number;
  /** Unique prompts (by hash) */
  uniqueCount: number;
  /** Reuse rate (1 - unique/total) */
  reuseRate: number;
}

/** Computes prompt analytics */
export function computePromptAnalytics(state: AnalyticsState): PromptAnalytics {
  const { prompts } = state;
  const total = prompts.length;

  if (total === 0) {
    return {
      totalPrompts: 0,
      byType: {
        user_request: 0,
        system_prompt: 0,
        template: 0,
        refinement: 0,
        error_recovery: 0,
        validation: 0,
      },
      avgLength: 0,
      uniqueCount: 0,
      reuseRate: 0,
    };
  }

  const byType: Record<PromptType, number> = {
    user_request: 0,
    system_prompt: 0,
    template: 0,
    refinement: 0,
    error_recovery: 0,
    validation: 0,
  };

  const uniqueHashes = new Set<string>();
  let totalLength = 0;

  for (const p of prompts) {
    byType[p.type]++;
    uniqueHashes.add(p.hash);
    totalLength += p.length;
  }

  const uniqueCount = uniqueHashes.size;

  return {
    totalPrompts: total,
    byType,
    avgLength: totalLength / total,
    uniqueCount,
    reuseRate: 1 - (uniqueCount / total),
  };
}

/** Error analytics summary */
export interface ErrorAnalytics {
  /** Total errors */
  totalErrors: number;
  /** Errors by category */
  byCategory: Record<ErrorCategory, number>;
  /** Recovery rate */
  recoveryRate: number;
  /** Most common error category */
  mostCommon: ErrorCategory | null;
  /** Recent errors (last 10) */
  recent: ErrorRecord[];
}

/** Computes error analytics */
export function computeErrorAnalytics(state: AnalyticsState): ErrorAnalytics {
  const { errors } = state;
  const total = errors.length;

  const byCategory: Record<ErrorCategory, number> = {
    api_error: 0,
    validation_error: 0,
    timeout: 0,
    rate_limit: 0,
    content_filter: 0,
    generation_failed: 0,
    parse_error: 0,
    network_error: 0,
    unknown: 0,
  };

  if (total === 0) {
    return {
      totalErrors: 0,
      byCategory,
      recoveryRate: 0,
      mostCommon: null,
      recent: [],
    };
  }

  let recoveredCount = 0;
  for (const e of errors) {
    byCategory[e.category]++;
    if (e.recovered) recoveredCount++;
  }

  // Find most common category
  let mostCommon: ErrorCategory | null = null;
  let maxCount = 0;
  for (const [cat, count] of Object.entries(byCategory)) {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = cat as ErrorCategory;
    }
  }

  return {
    totalErrors: total,
    byCategory,
    recoveryRate: recoveredCount / total,
    mostCommon,
    recent: errors.slice(-10),
  };
}

/** Comprehensive generation analytics */
export interface GenerationAnalytics {
  /** Base analytics from telemetry */
  summary: AnalyticsSummary;
  /** Prompt analytics */
  prompts: PromptAnalytics;
  /** Error analytics */
  errors: ErrorAnalytics;
  /** Generations by period */
  byPeriod: {
    lastHour: number;
    lastDay: number;
    lastWeek: number;
  };
}

/** Computes comprehensive generation analytics */
export function computeGenerationAnalytics(state: AnalyticsState): GenerationAnalytics {
  const now = Date.now();
  const hourAgo = now - 3600000;
  const dayAgo = now - 86400000;
  const weekAgo = now - 604800000;

  const metrics = state.telemetry.metrics;

  return {
    summary: computeAnalytics(state.telemetry),
    prompts: computePromptAnalytics(state),
    errors: computeErrorAnalytics(state),
    byPeriod: {
      lastHour: metrics.filter(m => m.startTime >= hourAgo).length,
      lastDay: metrics.filter(m => m.startTime >= dayAgo).length,
      lastWeek: metrics.filter(m => m.startTime >= weekAgo).length,
    },
  };
}

/** Formats analytics as human-readable report */
export function formatAnalyticsReport(analytics: GenerationAnalytics): string {
  const { summary, prompts, errors, byPeriod } = analytics;

  const lines = [
    '═══════════════════════════════════════════════════════════',
    '  GENERATION ANALYTICS REPORT',
    '═══════════════════════════════════════════════════════════',
    '',
    '📊 GENERATIONS',
    `  Total: ${summary.totalGenerations}`,
    `  Success Rate: ${(summary.successRate * 100).toFixed(1)}%`,
    `  Avg Quality: ${summary.avgQualityScore.toFixed(1)}`,
    `  Avg Duration: ${summary.avgDurationMs.toFixed(0)}ms`,
    '',
    '📝 PROMPTS',
    `  Total: ${prompts.totalPrompts}`,
    `  Unique: ${prompts.uniqueCount}`,
    `  Reuse Rate: ${(prompts.reuseRate * 100).toFixed(1)}%`,
    `  Avg Length: ${prompts.avgLength.toFixed(0)} chars`,
    '',
    '❌ ERRORS',
    `  Total: ${errors.totalErrors}`,
    `  Recovery Rate: ${(errors.recoveryRate * 100).toFixed(1)}%`,
    `  Most Common: ${errors.mostCommon ?? 'N/A'}`,
    '',
    '👍 USER SATISFACTION',
    `  Positive: ${summary.satisfactionDistribution.positive}`,
    `  Neutral: ${summary.satisfactionDistribution.neutral}`,
    `  Negative: ${summary.satisfactionDistribution.negative}`,
    '',
    '📅 BY PERIOD',
    `  Last Hour: ${byPeriod.lastHour}`,
    `  Last Day: ${byPeriod.lastDay}`,
    `  Last Week: ${byPeriod.lastWeek}`,
    '═══════════════════════════════════════════════════════════',
  ];

  return lines.join('\n');
}
