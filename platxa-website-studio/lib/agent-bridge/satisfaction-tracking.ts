/**
 * User Satisfaction Tracking
 *
 * Provides optional thumbs up/down feedback after generation,
 * tracked in analytics to measure and improve user experience.
 */

// ============================================================================
// Types
// ============================================================================

export type SatisfactionRating = 'positive' | 'negative' | 'neutral';

export interface SatisfactionFeedback {
  readonly id: string;
  readonly generationId: string;
  readonly userId: string;
  readonly rating: SatisfactionRating;
  readonly comment: string | null;
  readonly tags: readonly string[];
  readonly timestamp: number;
  readonly context: FeedbackContext;
  readonly creationOrder: number;
}

export interface FeedbackContext {
  readonly generationType: string;
  readonly promptLength: number;
  readonly responseTime: number;
  readonly iterationCount: number;
  readonly wasEdited: boolean;
  readonly metadata: Record<string, unknown>;
}

export interface SatisfactionStats {
  readonly totalFeedback: number;
  readonly positiveCount: number;
  readonly negativeCount: number;
  readonly neutralCount: number;
  readonly positiveRate: number;
  readonly negativeRate: number;
  readonly netSatisfactionScore: number;
  readonly averageResponseTime: number;
  readonly feedbackRate: number;
}

export interface SatisfactionTrend {
  readonly period: string;
  readonly startDate: number;
  readonly endDate: number;
  readonly stats: SatisfactionStats;
  readonly change: number;
}

export interface SatisfactionState {
  readonly feedback: Map<string, SatisfactionFeedback>;
  readonly pendingGenerations: Set<string>;
  readonly totalGenerations: number;
  readonly maxFeedback: number;
  readonly creationCounter: number;
}

export interface FeedbackQuery {
  readonly rating?: SatisfactionRating;
  readonly userId?: string;
  readonly generationType?: string;
  readonly fromTimestamp?: number;
  readonly toTimestamp?: number;
  readonly hasTags?: readonly string[];
  readonly limit?: number;
}

export type FeedbackHandler = (feedback: SatisfactionFeedback) => void;

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_FEEDBACK = 1000;

// ============================================================================
// State
// ============================================================================

let state: SatisfactionState = {
  feedback: new Map(),
  pendingGenerations: new Set(),
  totalGenerations: 0,
  maxFeedback: DEFAULT_MAX_FEEDBACK,
  creationCounter: 0,
};

let feedbackHandlers: FeedbackHandler[] = [];

// ============================================================================
// Generation Tracking
// ============================================================================

export function trackGeneration(generationId: string): void {
  const newPending = new Set(state.pendingGenerations);
  newPending.add(generationId);

  state = {
    ...state,
    pendingGenerations: newPending,
    totalGenerations: state.totalGenerations + 1,
  };
}

export function isPendingFeedback(generationId: string): boolean {
  return state.pendingGenerations.has(generationId);
}

export function getPendingGenerations(): readonly string[] {
  return Array.from(state.pendingGenerations);
}

export function dismissFeedbackPrompt(generationId: string): boolean {
  if (!state.pendingGenerations.has(generationId)) {
    return false;
  }

  const newPending = new Set(state.pendingGenerations);
  newPending.delete(generationId);

  state = {
    ...state,
    pendingGenerations: newPending,
  };

  return true;
}

// ============================================================================
// Feedback Submission
// ============================================================================

export function submitFeedback(
  generationId: string,
  userId: string,
  rating: SatisfactionRating,
  options: {
    comment?: string;
    tags?: readonly string[];
    context?: Partial<FeedbackContext>;
  } = {}
): SatisfactionFeedback {
  const id = generateId();
  const now = Date.now();

  const feedback: SatisfactionFeedback = {
    id,
    generationId,
    userId,
    rating,
    comment: options.comment ?? null,
    tags: options.tags ?? [],
    timestamp: now,
    context: {
      generationType: options.context?.generationType ?? 'unknown',
      promptLength: options.context?.promptLength ?? 0,
      responseTime: options.context?.responseTime ?? 0,
      iterationCount: options.context?.iterationCount ?? 0,
      wasEdited: options.context?.wasEdited ?? false,
      metadata: options.context?.metadata ?? {},
    },
    creationOrder: state.creationCounter,
  };

  const newFeedback = new Map(state.feedback);
  newFeedback.set(id, feedback);

  const newPending = new Set(state.pendingGenerations);
  newPending.delete(generationId);

  state = {
    ...state,
    feedback: newFeedback,
    pendingGenerations: newPending,
    creationCounter: state.creationCounter + 1,
  };

  enforceMaxFeedback();
  notifyHandlers(feedback);

  return feedback;
}

export function submitPositive(
  generationId: string,
  userId: string,
  options?: { comment?: string; tags?: readonly string[]; context?: Partial<FeedbackContext> }
): SatisfactionFeedback {
  return submitFeedback(generationId, userId, 'positive', options);
}

export function submitNegative(
  generationId: string,
  userId: string,
  options?: { comment?: string; tags?: readonly string[]; context?: Partial<FeedbackContext> }
): SatisfactionFeedback {
  return submitFeedback(generationId, userId, 'negative', options);
}

export function submitNeutral(
  generationId: string,
  userId: string,
  options?: { comment?: string; tags?: readonly string[]; context?: Partial<FeedbackContext> }
): SatisfactionFeedback {
  return submitFeedback(generationId, userId, 'neutral', options);
}

// ============================================================================
// Feedback Retrieval
// ============================================================================

export function getFeedback(id: string): SatisfactionFeedback | null {
  return state.feedback.get(id) ?? null;
}

export function getFeedbackByGeneration(generationId: string): SatisfactionFeedback | null {
  for (const feedback of state.feedback.values()) {
    if (feedback.generationId === generationId) {
      return feedback;
    }
  }
  return null;
}

export function getAllFeedback(): readonly SatisfactionFeedback[] {
  return Array.from(state.feedback.values())
    .sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return b.timestamp - a.timestamp;
      }
      return b.creationOrder - a.creationOrder;
    });
}

export function getFeedbackCount(): number {
  return state.feedback.size;
}

// ============================================================================
// Query Functions
// ============================================================================

export function queryFeedback(query: FeedbackQuery): readonly SatisfactionFeedback[] {
  let results = getAllFeedback();

  if (query.rating !== undefined) {
    results = results.filter(f => f.rating === query.rating);
  }

  if (query.userId !== undefined) {
    results = results.filter(f => f.userId === query.userId);
  }

  if (query.generationType !== undefined) {
    results = results.filter(f => f.context.generationType === query.generationType);
  }

  if (query.fromTimestamp !== undefined) {
    results = results.filter(f => f.timestamp >= query.fromTimestamp!);
  }

  if (query.toTimestamp !== undefined) {
    results = results.filter(f => f.timestamp <= query.toTimestamp!);
  }

  if (query.hasTags !== undefined && query.hasTags.length > 0) {
    results = results.filter(f =>
      query.hasTags!.some(tag => f.tags.includes(tag))
    );
  }

  if (query.limit !== undefined) {
    results = results.slice(0, query.limit);
  }

  return results;
}

export function getPositiveFeedback(): readonly SatisfactionFeedback[] {
  return queryFeedback({ rating: 'positive' });
}

export function getNegativeFeedback(): readonly SatisfactionFeedback[] {
  return queryFeedback({ rating: 'negative' });
}

export function getRecentFeedback(limit: number = 10): readonly SatisfactionFeedback[] {
  return queryFeedback({ limit });
}

export function getFeedbackByUser(userId: string): readonly SatisfactionFeedback[] {
  return queryFeedback({ userId });
}

// ============================================================================
// Statistics
// ============================================================================

export function getStats(): SatisfactionStats {
  const all = getAllFeedback();
  const positive = all.filter(f => f.rating === 'positive');
  const negative = all.filter(f => f.rating === 'negative');
  const neutral = all.filter(f => f.rating === 'neutral');

  const total = all.length;
  const positiveRate = total > 0 ? positive.length / total : 0;
  const negativeRate = total > 0 ? negative.length / total : 0;

  // Net Satisfaction Score: (positive - negative) / total * 100
  const netSatisfactionScore = total > 0
    ? ((positive.length - negative.length) / total) * 100
    : 0;

  const responseTimes = all
    .filter(f => f.context.responseTime > 0)
    .map(f => f.context.responseTime);
  const averageResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;

  const feedbackRate = state.totalGenerations > 0
    ? total / state.totalGenerations
    : 0;

  return {
    totalFeedback: total,
    positiveCount: positive.length,
    negativeCount: negative.length,
    neutralCount: neutral.length,
    positiveRate,
    negativeRate,
    netSatisfactionScore,
    averageResponseTime,
    feedbackRate,
  };
}

export function getStatsByGenerationType(generationType: string): SatisfactionStats {
  const all = queryFeedback({ generationType });
  const positive = all.filter(f => f.rating === 'positive');
  const negative = all.filter(f => f.rating === 'negative');
  const neutral = all.filter(f => f.rating === 'neutral');

  const total = all.length;
  const positiveRate = total > 0 ? positive.length / total : 0;
  const negativeRate = total > 0 ? negative.length / total : 0;

  const netSatisfactionScore = total > 0
    ? ((positive.length - negative.length) / total) * 100
    : 0;

  const responseTimes = all
    .filter(f => f.context.responseTime > 0)
    .map(f => f.context.responseTime);
  const averageResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;

  return {
    totalFeedback: total,
    positiveCount: positive.length,
    negativeCount: negative.length,
    neutralCount: neutral.length,
    positiveRate,
    negativeRate,
    netSatisfactionScore,
    averageResponseTime,
    feedbackRate: 0, // Not calculable per type
  };
}

export function getStatsByUser(userId: string): SatisfactionStats {
  const all = queryFeedback({ userId });
  const positive = all.filter(f => f.rating === 'positive');
  const negative = all.filter(f => f.rating === 'negative');
  const neutral = all.filter(f => f.rating === 'neutral');

  const total = all.length;
  const positiveRate = total > 0 ? positive.length / total : 0;
  const negativeRate = total > 0 ? negative.length / total : 0;

  const netSatisfactionScore = total > 0
    ? ((positive.length - negative.length) / total) * 100
    : 0;

  const responseTimes = all
    .filter(f => f.context.responseTime > 0)
    .map(f => f.context.responseTime);
  const averageResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;

  return {
    totalFeedback: total,
    positiveCount: positive.length,
    negativeCount: negative.length,
    neutralCount: neutral.length,
    positiveRate,
    negativeRate,
    netSatisfactionScore,
    averageResponseTime,
    feedbackRate: 0,
  };
}

// ============================================================================
// Trends
// ============================================================================

export function getTrend(
  periodMs: number,
  periodsCount: number = 7
): readonly SatisfactionTrend[] {
  const now = Date.now();
  const trends: SatisfactionTrend[] = [];

  for (let i = 0; i < periodsCount; i++) {
    const endDate = now - (i * periodMs);
    const startDate = endDate - periodMs;

    const periodFeedback = queryFeedback({
      fromTimestamp: startDate,
      toTimestamp: endDate,
    });

    const positive = periodFeedback.filter(f => f.rating === 'positive');
    const negative = periodFeedback.filter(f => f.rating === 'negative');
    const neutral = periodFeedback.filter(f => f.rating === 'neutral');
    const total = periodFeedback.length;

    const stats: SatisfactionStats = {
      totalFeedback: total,
      positiveCount: positive.length,
      negativeCount: negative.length,
      neutralCount: neutral.length,
      positiveRate: total > 0 ? positive.length / total : 0,
      negativeRate: total > 0 ? negative.length / total : 0,
      netSatisfactionScore: total > 0
        ? ((positive.length - negative.length) / total) * 100
        : 0,
      averageResponseTime: 0,
      feedbackRate: 0,
    };

    // Calculate change from previous period
    const previousTrend = trends[trends.length - 1];
    const change = previousTrend
      ? stats.netSatisfactionScore - previousTrend.stats.netSatisfactionScore
      : 0;

    trends.unshift({
      period: `Period ${periodsCount - i}`,
      startDate,
      endDate,
      stats,
      change,
    });
  }

  return trends;
}

export function getDailyTrend(daysCount: number = 7): readonly SatisfactionTrend[] {
  return getTrend(24 * 60 * 60 * 1000, daysCount);
}

export function getWeeklyTrend(weeksCount: number = 4): readonly SatisfactionTrend[] {
  return getTrend(7 * 24 * 60 * 60 * 1000, weeksCount);
}

// ============================================================================
// Handlers
// ============================================================================

export function onFeedback(handler: FeedbackHandler): () => void {
  feedbackHandlers.push(handler);

  return () => {
    feedbackHandlers = feedbackHandlers.filter(h => h !== handler);
  };
}

function notifyHandlers(feedback: SatisfactionFeedback): void {
  for (const handler of feedbackHandlers) {
    handler(feedback);
  }
}

// ============================================================================
// Tags Analysis
// ============================================================================

export function getTagStats(): Record<string, { count: number; positiveRate: number }> {
  const tagData: Record<string, { total: number; positive: number }> = {};

  for (const feedback of state.feedback.values()) {
    for (const tag of feedback.tags) {
      if (!tagData[tag]) {
        tagData[tag] = { total: 0, positive: 0 };
      }
      tagData[tag].total++;
      if (feedback.rating === 'positive') {
        tagData[tag].positive++;
      }
    }
  }

  const result: Record<string, { count: number; positiveRate: number }> = {};
  for (const [tag, data] of Object.entries(tagData)) {
    result[tag] = {
      count: data.total,
      positiveRate: data.total > 0 ? data.positive / data.total : 0,
    };
  }

  return result;
}

export function getCommonTags(limit: number = 10): readonly string[] {
  const tagCounts: Record<string, number> = {};

  for (const feedback of state.feedback.values()) {
    for (const tag of feedback.tags) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
  }

  return Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

// ============================================================================
// Retention
// ============================================================================

export function setMaxFeedback(max: number): void {
  state = {
    ...state,
    maxFeedback: Math.max(1, max),
  };
  enforceMaxFeedback();
}

export function getMaxFeedback(): number {
  return state.maxFeedback;
}

function enforceMaxFeedback(): void {
  if (state.feedback.size <= state.maxFeedback) {
    return;
  }

  const sorted = getAllFeedback();
  const toKeep = sorted.slice(0, state.maxFeedback);

  const newFeedback = new Map<string, SatisfactionFeedback>();
  for (const feedback of toKeep) {
    newFeedback.set(feedback.id, feedback);
  }

  state = {
    ...state,
    feedback: newFeedback,
  };
}

// ============================================================================
// Export and Analytics
// ============================================================================

export interface AnalyticsExport {
  readonly exportedAt: number;
  readonly stats: SatisfactionStats;
  readonly feedback: readonly SatisfactionFeedback[];
  readonly tagStats: Record<string, { count: number; positiveRate: number }>;
  readonly trends: readonly SatisfactionTrend[];
}

export function exportAnalytics(): AnalyticsExport {
  return {
    exportedAt: Date.now(),
    stats: getStats(),
    feedback: getAllFeedback(),
    tagStats: getTagStats(),
    trends: getDailyTrend(),
  };
}

export function exportAnalyticsJson(): string {
  return JSON.stringify(exportAnalytics(), null, 2);
}

export function getState(): SatisfactionState {
  return {
    ...state,
    feedback: new Map(state.feedback),
    pendingGenerations: new Set(state.pendingGenerations),
  };
}

// ============================================================================
// Remove and Clear
// ============================================================================

export function removeFeedback(id: string): boolean {
  if (!state.feedback.has(id)) {
    return false;
  }

  const newFeedback = new Map(state.feedback);
  newFeedback.delete(id);

  state = {
    ...state,
    feedback: newFeedback,
  };

  return true;
}

export function clearFeedback(): void {
  state = {
    ...state,
    feedback: new Map(),
    creationCounter: 0,
  };
}

export function clearPending(): void {
  state = {
    ...state,
    pendingGenerations: new Set(),
  };
}

// ============================================================================
// Reset
// ============================================================================

export function resetSatisfactionTracking(): void {
  state = {
    feedback: new Map(),
    pendingGenerations: new Set(),
    totalGenerations: 0,
    maxFeedback: DEFAULT_MAX_FEEDBACK,
    creationCounter: 0,
  };
  feedbackHandlers = [];
}

// ============================================================================
// Utilities
// ============================================================================

function generateId(): string {
  return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function formatStats(stats: SatisfactionStats): string {
  return [
    `Total Feedback: ${stats.totalFeedback}`,
    `Positive: ${stats.positiveCount} (${(stats.positiveRate * 100).toFixed(1)}%)`,
    `Negative: ${stats.negativeCount} (${(stats.negativeRate * 100).toFixed(1)}%)`,
    `Neutral: ${stats.neutralCount}`,
    `Net Satisfaction Score: ${stats.netSatisfactionScore.toFixed(1)}`,
    `Feedback Rate: ${(stats.feedbackRate * 100).toFixed(1)}%`,
  ].join('\n');
}
