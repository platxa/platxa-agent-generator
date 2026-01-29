/**
 * Metrics Dashboard
 *
 * Provides comprehensive metrics and analytics for debugging effectiveness.
 * Tracks success rates, performance metrics, error patterns, and trends
 * to help improve debugging workflows.
 *
 * @module metrics-dashboard
 */

import type {
  Language,
  NormalizedError,
  RootCauseHypothesis,
  FixSuggestion,
} from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Time period for metrics aggregation
 */
export type MetricsPeriod = 'hour' | 'day' | 'week' | 'month' | 'all';

/**
 * Metric category
 */
export type MetricCategory =
  | 'session'
  | 'error'
  | 'fix'
  | 'performance'
  | 'language';

/**
 * Debug session outcome
 */
export type SessionOutcome =
  | 'success'
  | 'partial'
  | 'failed'
  | 'abandoned'
  | 'pending';

/**
 * Session metrics entry
 */
export interface SessionMetrics {
  /** Session ID */
  sessionId: string;
  /** Start time */
  startedAt: Date;
  /** End time */
  endedAt?: Date;
  /** Session outcome */
  outcome: SessionOutcome;
  /** Language */
  language: Language;
  /** Number of errors analyzed */
  errorsAnalyzed: number;
  /** Number of hypotheses generated */
  hypothesesGenerated: number;
  /** Number of fixes suggested */
  fixesSuggested: number;
  /** Number of fixes applied */
  fixesApplied: number;
  /** Time to first hypothesis (ms) */
  timeToFirstHypothesisMs?: number;
  /** Time to first fix (ms) */
  timeToFirstFixMs?: number;
  /** Total session duration (ms) */
  durationMs?: number;
  /** User feedback score (1-5) */
  feedbackScore?: number;
  /** Tags for categorization */
  tags: string[];
}

/**
 * Error pattern metrics
 */
export interface ErrorPatternMetrics {
  /** Error type */
  errorType: string;
  /** Occurrence count */
  count: number;
  /** Languages affected */
  languages: Set<Language>;
  /** Average fix confidence */
  avgFixConfidence: number;
  /** Success rate for fixes */
  fixSuccessRate: number;
  /** Average time to fix (ms) */
  avgTimeToFixMs: number;
  /** First seen */
  firstSeen: Date;
  /** Last seen */
  lastSeen: Date;
  /** Trend (increasing, stable, decreasing) */
  trend: 'increasing' | 'stable' | 'decreasing';
}

/**
 * Fix effectiveness metrics
 */
export interface FixEffectivenessMetrics {
  /** Fix pattern ID */
  patternId: string;
  /** Fix description */
  description: string;
  /** Times applied */
  timesApplied: number;
  /** Success count */
  successCount: number;
  /** Failure count */
  failureCount: number;
  /** Success rate */
  successRate: number;
  /** Average confidence when suggested */
  avgConfidence: number;
  /** Average time saved (ms) */
  avgTimeSavedMs: number;
  /** Languages applicable */
  languages: Set<Language>;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  /** Analysis time (ms) */
  analysisTimeMs: number;
  /** Cache hit rate */
  cacheHitRate: number;
  /** Memory usage (bytes) */
  memoryUsageBytes: number;
  /** Concurrent sessions */
  concurrentSessions: number;
  /** Throughput (errors/second) */
  throughput: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Language-specific metrics
 */
export interface LanguageMetrics {
  /** Language */
  language: Language;
  /** Total sessions */
  totalSessions: number;
  /** Total errors */
  totalErrors: number;
  /** Success rate */
  successRate: number;
  /** Average confidence */
  avgConfidence: number;
  /** Most common error types */
  topErrorTypes: Array<{ type: string; count: number }>;
  /** Average session duration (ms) */
  avgSessionDurationMs: number;
}

/**
 * Aggregated dashboard metrics
 */
export interface DashboardMetrics {
  /** Time period */
  period: MetricsPeriod;
  /** Generated at */
  generatedAt: Date;
  /** Overall metrics */
  overall: {
    totalSessions: number;
    successfulSessions: number;
    successRate: number;
    totalErrors: number;
    totalFixes: number;
    fixApplicationRate: number;
    avgSessionDurationMs: number;
    avgFeedbackScore: number;
  };
  /** Session metrics by outcome */
  sessionsByOutcome: Record<SessionOutcome, number>;
  /** Metrics by language */
  byLanguage: Map<Language, LanguageMetrics>;
  /** Top error patterns */
  topErrorPatterns: ErrorPatternMetrics[];
  /** Fix effectiveness */
  fixEffectiveness: FixEffectivenessMetrics[];
  /** Performance over time */
  performanceHistory: PerformanceMetrics[];
  /** Trends */
  trends: {
    sessionsChange: number;
    successRateChange: number;
    avgDurationChange: number;
  };
}

/**
 * Metrics export format
 */
export type ExportFormat = 'json' | 'csv' | 'markdown';

/**
 * Metrics dashboard configuration
 */
export interface MetricsDashboardConfig {
  /** Maximum sessions to retain */
  maxSessionsRetained: number;
  /** Performance sampling interval (ms) */
  performanceSamplingIntervalMs: number;
  /** Enable trend calculation */
  enableTrends: boolean;
  /** Trend window size */
  trendWindowSize: number;
  /** Auto-cleanup old metrics */
  autoCleanup: boolean;
  /** Cleanup threshold (days) */
  cleanupThresholdDays: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: MetricsDashboardConfig = {
  maxSessionsRetained: 10000,
  performanceSamplingIntervalMs: 60000, // 1 minute
  enableTrends: true,
  trendWindowSize: 100,
  autoCleanup: true,
  cleanupThresholdDays: 30,
};

// =============================================================================
// Metrics Dashboard Class
// =============================================================================

/**
 * Metrics Dashboard
 *
 * Collects and analyzes debugging metrics for effectiveness tracking.
 */
export class MetricsDashboard {
  private config: MetricsDashboardConfig;
  private sessions: Map<string, SessionMetrics>;
  private errorPatterns: Map<string, ErrorPatternMetrics>;
  private fixPatterns: Map<string, FixEffectivenessMetrics>;
  private performanceHistory: PerformanceMetrics[];
  private lastCleanup: Date;

  constructor(config: Partial<MetricsDashboardConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessions = new Map();
    this.errorPatterns = new Map();
    this.fixPatterns = new Map();
    this.performanceHistory = [];
    this.lastCleanup = new Date();
  }

  // ===========================================================================
  // Session Tracking
  // ===========================================================================

  /**
   * Start tracking a debug session
   */
  startSession(
    sessionId: string,
    language: Language,
    tags: string[] = []
  ): SessionMetrics {
    const session: SessionMetrics = {
      sessionId,
      startedAt: new Date(),
      outcome: 'pending',
      language,
      errorsAnalyzed: 0,
      hypothesesGenerated: 0,
      fixesSuggested: 0,
      fixesApplied: 0,
      tags,
    };

    this.sessions.set(sessionId, session);
    this.enforceRetentionLimit();

    return session;
  }

  /**
   * Record errors analyzed in a session
   */
  recordErrors(sessionId: string, errors: NormalizedError[]): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.errorsAnalyzed += errors.length;

    // Track error patterns
    for (const error of errors) {
      this.trackErrorPattern(error, session.language);
    }
  }

  /**
   * Record hypotheses generated
   */
  recordHypotheses(
    sessionId: string,
    hypotheses: RootCauseHypothesis[]
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.hypothesesGenerated === 0 && hypotheses.length > 0) {
      session.timeToFirstHypothesisMs =
        Date.now() - session.startedAt.getTime();
    }

    session.hypothesesGenerated += hypotheses.length;
  }

  /**
   * Record fixes suggested
   */
  recordFixes(sessionId: string, fixes: FixSuggestion[]): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.fixesSuggested === 0 && fixes.length > 0) {
      session.timeToFirstFixMs = Date.now() - session.startedAt.getTime();
    }

    session.fixesSuggested += fixes.length;

    // Track fix patterns
    for (const fix of fixes) {
      this.trackFixPattern(fix, session.language);
    }
  }

  /**
   * Record fix applied
   */
  recordFixApplied(
    sessionId: string,
    fix: FixSuggestion,
    success: boolean
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.fixesApplied++;

    // Update fix effectiveness
    const patternId = this.getFixPatternId(fix);
    const pattern = this.fixPatterns.get(patternId);
    if (pattern) {
      pattern.timesApplied++;
      if (success) {
        pattern.successCount++;
      } else {
        pattern.failureCount++;
      }
      pattern.successRate =
        pattern.successCount / (pattern.successCount + pattern.failureCount);
    }
  }

  /**
   * End a debug session
   */
  endSession(
    sessionId: string,
    outcome: SessionOutcome,
    feedbackScore?: number
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.endedAt = new Date();
    session.outcome = outcome;
    session.durationMs = session.endedAt.getTime() - session.startedAt.getTime();

    if (feedbackScore !== undefined) {
      session.feedbackScore = feedbackScore;
    }
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): SessionMetrics | undefined {
    return this.sessions.get(sessionId);
  }

  // ===========================================================================
  // Performance Tracking
  // ===========================================================================

  /**
   * Record performance sample
   */
  recordPerformance(metrics: Omit<PerformanceMetrics, 'timestamp'>): void {
    const sample: PerformanceMetrics = {
      ...metrics,
      timestamp: new Date(),
    };

    this.performanceHistory.push(sample);

    // Keep only recent history (last 24 hours by default)
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    this.performanceHistory = this.performanceHistory.filter(
      (p) => p.timestamp.getTime() > cutoff
    );
  }

  /**
   * Get current performance metrics
   */
  getCurrentPerformance(): PerformanceMetrics | null {
    if (this.performanceHistory.length === 0) return null;
    return this.performanceHistory[this.performanceHistory.length - 1] ?? null;
  }

  // ===========================================================================
  // Dashboard Generation
  // ===========================================================================

  /**
   * Generate dashboard metrics
   */
  generateDashboard(period: MetricsPeriod = 'day'): DashboardMetrics {
    const periodStart = this.getPeriodStart(period);
    const sessions = this.getSessionsInPeriod(periodStart);

    // Calculate overall metrics
    const overall = this.calculateOverallMetrics(sessions);

    // Sessions by outcome
    const sessionsByOutcome = this.calculateSessionsByOutcome(sessions);

    // By language
    const byLanguage = this.calculateByLanguage(sessions);

    // Top error patterns
    const topErrorPatterns = this.getTopErrorPatterns(10);

    // Fix effectiveness
    const fixEffectiveness = this.getTopFixPatterns(10);

    // Performance history
    const performanceHistory = this.getPerformanceInPeriod(periodStart);

    // Trends
    const trends = this.config.enableTrends
      ? this.calculateTrends(sessions)
      : { sessionsChange: 0, successRateChange: 0, avgDurationChange: 0 };

    return {
      period,
      generatedAt: new Date(),
      overall,
      sessionsByOutcome,
      byLanguage,
      topErrorPatterns,
      fixEffectiveness,
      performanceHistory,
      trends,
    };
  }

  /**
   * Get metrics for a specific language
   */
  getLanguageMetrics(language: Language): LanguageMetrics {
    const sessions = Array.from(this.sessions.values()).filter(
      (s) => s.language === language
    );

    const successfulSessions = sessions.filter(
      (s) => s.outcome === 'success'
    ).length;

    const totalErrors = sessions.reduce((sum, s) => sum + s.errorsAnalyzed, 0);
    const totalDuration = sessions.reduce(
      (sum, s) => sum + (s.durationMs ?? 0),
      0
    );

    // Get top error types for this language
    const errorTypeCounts = new Map<string, number>();
    for (const [type, pattern] of this.errorPatterns) {
      if (pattern.languages.has(language)) {
        errorTypeCounts.set(type, pattern.count);
      }
    }

    const topErrorTypes = Array.from(errorTypeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    return {
      language,
      totalSessions: sessions.length,
      totalErrors,
      successRate: sessions.length > 0 ? successfulSessions / sessions.length : 0,
      avgConfidence: this.calculateAvgConfidence(sessions),
      topErrorTypes,
      avgSessionDurationMs:
        sessions.length > 0 ? totalDuration / sessions.length : 0,
    };
  }

  // ===========================================================================
  // Export
  // ===========================================================================

  /**
   * Export metrics in specified format
   */
  export(format: ExportFormat, period: MetricsPeriod = 'day'): string {
    const dashboard = this.generateDashboard(period);

    switch (format) {
      case 'json':
        return this.exportJSON(dashboard);
      case 'csv':
        return this.exportCSV(dashboard);
      case 'markdown':
        return this.exportMarkdown(dashboard);
    }
  }

  /**
   * Export as JSON
   */
  private exportJSON(dashboard: DashboardMetrics): string {
    return JSON.stringify(
      dashboard,
      (_, value) => {
        if (value instanceof Map) {
          return Object.fromEntries(value);
        }
        if (value instanceof Set) {
          return Array.from(value);
        }
        return value;
      },
      2
    );
  }

  /**
   * Export as CSV
   */
  private exportCSV(dashboard: DashboardMetrics): string {
    const lines: string[] = [];

    // Overall metrics
    lines.push('# Overall Metrics');
    lines.push('Metric,Value');
    lines.push(`Total Sessions,${dashboard.overall.totalSessions}`);
    lines.push(`Successful Sessions,${dashboard.overall.successfulSessions}`);
    lines.push(`Success Rate,${(dashboard.overall.successRate * 100).toFixed(1)}%`);
    lines.push(`Total Errors,${dashboard.overall.totalErrors}`);
    lines.push(`Total Fixes,${dashboard.overall.totalFixes}`);
    lines.push(`Avg Session Duration (ms),${dashboard.overall.avgSessionDurationMs.toFixed(0)}`);
    lines.push('');

    // Sessions by outcome
    lines.push('# Sessions by Outcome');
    lines.push('Outcome,Count');
    for (const [outcome, count] of Object.entries(dashboard.sessionsByOutcome)) {
      lines.push(`${outcome},${count}`);
    }
    lines.push('');

    // Top error patterns
    lines.push('# Top Error Patterns');
    lines.push('Error Type,Count,Fix Success Rate,Avg Time to Fix (ms)');
    for (const pattern of dashboard.topErrorPatterns) {
      lines.push(
        `${pattern.errorType},${pattern.count},${(pattern.fixSuccessRate * 100).toFixed(1)}%,${pattern.avgTimeToFixMs.toFixed(0)}`
      );
    }

    return lines.join('\n');
  }

  /**
   * Export as Markdown
   */
  private exportMarkdown(dashboard: DashboardMetrics): string {
    const lines: string[] = [];

    lines.push('# Debug Metrics Dashboard');
    lines.push('');
    lines.push(`**Period:** ${dashboard.period}`);
    lines.push(`**Generated:** ${dashboard.generatedAt.toISOString()}`);
    lines.push('');

    // Overall metrics
    lines.push('## Overall Metrics');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Total Sessions | ${dashboard.overall.totalSessions} |`);
    lines.push(`| Successful Sessions | ${dashboard.overall.successfulSessions} |`);
    lines.push(`| Success Rate | ${(dashboard.overall.successRate * 100).toFixed(1)}% |`);
    lines.push(`| Total Errors Analyzed | ${dashboard.overall.totalErrors} |`);
    lines.push(`| Total Fixes Suggested | ${dashboard.overall.totalFixes} |`);
    lines.push(`| Fix Application Rate | ${(dashboard.overall.fixApplicationRate * 100).toFixed(1)}% |`);
    lines.push(`| Avg Session Duration | ${(dashboard.overall.avgSessionDurationMs / 1000).toFixed(1)}s |`);
    if (dashboard.overall.avgFeedbackScore > 0) {
      lines.push(`| Avg Feedback Score | ${dashboard.overall.avgFeedbackScore.toFixed(1)}/5 |`);
    }
    lines.push('');

    // Trends
    if (this.config.enableTrends) {
      lines.push('## Trends');
      lines.push('');
      lines.push(`- Sessions: ${this.formatTrend(dashboard.trends.sessionsChange)}`);
      lines.push(`- Success Rate: ${this.formatTrend(dashboard.trends.successRateChange)}`);
      lines.push(`- Avg Duration: ${this.formatTrend(dashboard.trends.avgDurationChange, true)}`);
      lines.push('');
    }

    // Sessions by outcome
    lines.push('## Sessions by Outcome');
    lines.push('');
    lines.push('| Outcome | Count |');
    lines.push('|---------|-------|');
    for (const [outcome, count] of Object.entries(dashboard.sessionsByOutcome)) {
      lines.push(`| ${outcome} | ${count} |`);
    }
    lines.push('');

    // Top error patterns
    lines.push('## Top Error Patterns');
    lines.push('');
    lines.push('| Error Type | Count | Fix Success Rate | Trend |');
    lines.push('|------------|-------|------------------|-------|');
    for (const pattern of dashboard.topErrorPatterns) {
      const trendIcon =
        pattern.trend === 'increasing'
          ? '↑'
          : pattern.trend === 'decreasing'
            ? '↓'
            : '→';
      lines.push(
        `| ${pattern.errorType} | ${pattern.count} | ${(pattern.fixSuccessRate * 100).toFixed(0)}% | ${trendIcon} |`
      );
    }
    lines.push('');

    // Fix effectiveness
    lines.push('## Fix Effectiveness');
    lines.push('');
    lines.push('| Pattern | Applied | Success Rate | Avg Confidence |');
    lines.push('|---------|---------|--------------|----------------|');
    for (const fix of dashboard.fixEffectiveness) {
      lines.push(
        `| ${fix.description.slice(0, 40)} | ${fix.timesApplied} | ${(fix.successRate * 100).toFixed(0)}% | ${(fix.avgConfidence * 100).toFixed(0)}% |`
      );
    }

    return lines.join('\n');
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Track error pattern
   */
  private trackErrorPattern(error: NormalizedError, language: Language): void {
    const patternId = error.type;
    let pattern = this.errorPatterns.get(patternId);

    if (!pattern) {
      pattern = {
        errorType: error.type,
        count: 0,
        languages: new Set(),
        avgFixConfidence: 0,
        fixSuccessRate: 0,
        avgTimeToFixMs: 0,
        firstSeen: new Date(),
        lastSeen: new Date(),
        trend: 'stable',
      };
      this.errorPatterns.set(patternId, pattern);
    }

    pattern.count++;
    pattern.languages.add(language);
    pattern.lastSeen = new Date();
  }

  /**
   * Track fix pattern
   */
  private trackFixPattern(fix: FixSuggestion, language: Language): void {
    const patternId = this.getFixPatternId(fix);
    let pattern = this.fixPatterns.get(patternId);

    if (!pattern) {
      pattern = {
        patternId,
        description: fix.description,
        timesApplied: 0,
        successCount: 0,
        failureCount: 0,
        successRate: 0,
        avgConfidence: fix.confidence,
        avgTimeSavedMs: 0,
        languages: new Set(),
      };
      this.fixPatterns.set(patternId, pattern);
    }

    // Update average confidence
    const totalSuggestions = pattern.timesApplied + 1;
    pattern.avgConfidence =
      (pattern.avgConfidence * pattern.timesApplied + fix.confidence) /
      totalSuggestions;
    pattern.languages.add(language);
  }

  /**
   * Get fix pattern ID
   */
  private getFixPatternId(fix: FixSuggestion): string {
    // Create a pattern ID based on fix characteristics
    return `${fix.type ?? 'fix'}-${fix.description.slice(0, 50).replace(/\s+/g, '-')}`;
  }

  /**
   * Get period start date
   */
  private getPeriodStart(period: MetricsPeriod): Date {
    const now = new Date();

    switch (period) {
      case 'hour':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'all':
        return new Date(0);
    }
  }

  /**
   * Get sessions in period
   */
  private getSessionsInPeriod(periodStart: Date): SessionMetrics[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.startedAt >= periodStart
    );
  }

  /**
   * Get performance in period
   */
  private getPerformanceInPeriod(periodStart: Date): PerformanceMetrics[] {
    return this.performanceHistory.filter((p) => p.timestamp >= periodStart);
  }

  /**
   * Calculate overall metrics
   */
  private calculateOverallMetrics(sessions: SessionMetrics[]): DashboardMetrics['overall'] {
    const successfulSessions = sessions.filter(
      (s) => s.outcome === 'success'
    ).length;

    const totalErrors = sessions.reduce((sum, s) => sum + s.errorsAnalyzed, 0);
    const totalFixes = sessions.reduce((sum, s) => sum + s.fixesSuggested, 0);
    const totalApplied = sessions.reduce((sum, s) => sum + s.fixesApplied, 0);
    const totalDuration = sessions.reduce(
      (sum, s) => sum + (s.durationMs ?? 0),
      0
    );

    const feedbackScores = sessions
      .filter((s) => s.feedbackScore !== undefined)
      .map((s) => s.feedbackScore!);

    return {
      totalSessions: sessions.length,
      successfulSessions,
      successRate: sessions.length > 0 ? successfulSessions / sessions.length : 0,
      totalErrors,
      totalFixes,
      fixApplicationRate: totalFixes > 0 ? totalApplied / totalFixes : 0,
      avgSessionDurationMs:
        sessions.length > 0 ? totalDuration / sessions.length : 0,
      avgFeedbackScore:
        feedbackScores.length > 0
          ? feedbackScores.reduce((a, b) => a + b, 0) / feedbackScores.length
          : 0,
    };
  }

  /**
   * Calculate sessions by outcome
   */
  private calculateSessionsByOutcome(
    sessions: SessionMetrics[]
  ): Record<SessionOutcome, number> {
    const result: Record<SessionOutcome, number> = {
      success: 0,
      partial: 0,
      failed: 0,
      abandoned: 0,
      pending: 0,
    };

    for (const session of sessions) {
      result[session.outcome]++;
    }

    return result;
  }

  /**
   * Calculate metrics by language
   */
  private calculateByLanguage(
    sessions: SessionMetrics[]
  ): Map<Language, LanguageMetrics> {
    const result = new Map<Language, LanguageMetrics>();

    // Group sessions by language
    const byLanguage = new Map<Language, SessionMetrics[]>();
    for (const session of sessions) {
      const languageSessions = byLanguage.get(session.language) ?? [];
      languageSessions.push(session);
      byLanguage.set(session.language, languageSessions);
    }

    // Calculate metrics for each language
    for (const [language] of byLanguage) {
      result.set(language, this.getLanguageMetrics(language));
    }

    return result;
  }

  /**
   * Get top error patterns
   */
  private getTopErrorPatterns(limit: number): ErrorPatternMetrics[] {
    return Array.from(this.errorPatterns.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get top fix patterns
   */
  private getTopFixPatterns(limit: number): FixEffectivenessMetrics[] {
    return Array.from(this.fixPatterns.values())
      .sort((a, b) => b.timesApplied - a.timesApplied)
      .slice(0, limit);
  }

  /**
   * Calculate average confidence
   */
  private calculateAvgConfidence(_sessions: SessionMetrics[]): number {
    // This would typically involve hypothesis confidence
    // For now, return a placeholder
    return 0.75;
  }

  /**
   * Calculate trends
   */
  private calculateTrends(
    sessions: SessionMetrics[]
  ): DashboardMetrics['trends'] {
    if (sessions.length < this.config.trendWindowSize * 2) {
      return { sessionsChange: 0, successRateChange: 0, avgDurationChange: 0 };
    }

    const midpoint = Math.floor(sessions.length / 2);
    const firstHalf = sessions.slice(0, midpoint);
    const secondHalf = sessions.slice(midpoint);

    const firstMetrics = this.calculateOverallMetrics(firstHalf);
    const secondMetrics = this.calculateOverallMetrics(secondHalf);

    return {
      sessionsChange:
        firstMetrics.totalSessions > 0
          ? (secondMetrics.totalSessions - firstMetrics.totalSessions) /
            firstMetrics.totalSessions
          : 0,
      successRateChange: secondMetrics.successRate - firstMetrics.successRate,
      avgDurationChange:
        firstMetrics.avgSessionDurationMs > 0
          ? (secondMetrics.avgSessionDurationMs -
              firstMetrics.avgSessionDurationMs) /
            firstMetrics.avgSessionDurationMs
          : 0,
    };
  }

  /**
   * Format trend value for display
   */
  private formatTrend(value: number, invertPositive = false): string {
    const percentage = Math.abs(value * 100).toFixed(1);
    const direction = value > 0 ? (invertPositive ? '↓' : '↑') : '↓';
    const sign = value > 0 ? '+' : '-';
    return `${direction} ${sign}${percentage}%`;
  }

  /**
   * Enforce retention limit
   */
  private enforceRetentionLimit(): void {
    if (this.sessions.size <= this.config.maxSessionsRetained) {
      return;
    }

    // Remove oldest sessions
    const sessionsArray = Array.from(this.sessions.entries()).sort(
      (a, b) => a[1].startedAt.getTime() - b[1].startedAt.getTime()
    );

    const toRemove = sessionsArray.slice(
      0,
      sessionsArray.length - this.config.maxSessionsRetained
    );

    for (const [id] of toRemove) {
      this.sessions.delete(id);
    }
  }

  /**
   * Cleanup old data
   */
  cleanup(): void {
    if (!this.config.autoCleanup) return;

    const cutoff = new Date(
      Date.now() - this.config.cleanupThresholdDays * 24 * 60 * 60 * 1000
    );

    // Cleanup old sessions
    for (const [id, session] of this.sessions) {
      if (session.startedAt < cutoff) {
        this.sessions.delete(id);
      }
    }

    this.lastCleanup = new Date();
  }

  /**
   * Get dashboard statistics
   */
  getStats(): {
    totalSessions: number;
    errorPatterns: number;
    fixPatterns: number;
    performanceSamples: number;
    lastCleanup: Date;
  } {
    return {
      totalSessions: this.sessions.size,
      errorPatterns: this.errorPatterns.size,
      fixPatterns: this.fixPatterns.size,
      performanceSamples: this.performanceHistory.length,
      lastCleanup: this.lastCleanup,
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.sessions.clear();
    this.errorPatterns.clear();
    this.fixPatterns.clear();
    this.performanceHistory = [];
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create metrics dashboard
 */
export function createMetricsDashboard(
  config?: Partial<MetricsDashboardConfig>
): MetricsDashboard {
  return new MetricsDashboard(config);
}

/**
 * Shared dashboard instance
 */
let sharedDashboard: MetricsDashboard | null = null;

/**
 * Get shared dashboard instance
 */
export function getSharedDashboard(): MetricsDashboard {
  if (!sharedDashboard) {
    sharedDashboard = createMetricsDashboard();
  }
  return sharedDashboard;
}

/**
 * Reset shared dashboard
 */
export function resetSharedDashboard(): void {
  sharedDashboard = null;
}
