/**
 * Theme Performance Analytics
 *
 * Track and analyze theme generation performance metrics including
 * success rates, generation times, credit usage, and user satisfaction.
 *
 * Key Features:
 * - Generation success rate tracking
 * - Time-to-completion metrics
 * - Credit usage analysis
 * - Iteration patterns
 * - Error categorization
 * - User satisfaction correlation
 *
 * @example
 * ```typescript
 * import { getThemeAnalytics, recordThemeGeneration } from "@/lib/analytics/theme-performance-analytics"
 *
 * // Record a generation event
 * await recordThemeGeneration({
 *   projectId: "proj_123",
 *   userId: "user_456",
 *   success: true,
 *   generationTimeMs: 2500,
 *   creditsUsed: 10,
 *   tokenCount: 3200,
 * })
 *
 * // Get analytics summary
 * const analytics = getThemeAnalytics()
 * const summary = analytics.getSummary("week")
 * console.log(`Success rate: ${summary.successRate}%`)
 * ```
 *
 * @module analytics/theme-performance-analytics
 */

// ============================================================================
// Types
// ============================================================================

/** Theme generation outcome */
export type GenerationOutcome =
  | "success"           // Theme generated successfully
  | "partial"           // Theme generated with warnings
  | "failed"            // Generation failed
  | "timeout"           // Generation timed out
  | "cancelled"         // User cancelled
  | "rate_limited"      // Rate limit exceeded
  | "insufficient_credits" // Not enough credits

/** Error category for failed generations */
export type GenerationErrorCategory =
  | "prompt_error"      // Invalid or unclear prompt
  | "model_error"       // AI model error
  | "validation_error"  // Theme validation failed
  | "system_error"      // Internal system error
  | "timeout_error"     // Took too long
  | "credit_error"      // Credit-related issue
  | "unknown"           // Unknown error

/** Theme type being generated */
export type ThemeType =
  | "full"              // Complete theme from scratch
  | "iteration"         // Iterative refinement
  | "component"         // Single component styling
  | "color_scheme"      // Color scheme only
  | "typography"        // Typography only
  | "import"            // Imported/converted theme

/** Theme generation event record */
export interface ThemeGenerationEvent {
  /** Unique event ID */
  id: string
  /** Project ID */
  projectId: string
  /** User ID */
  userId: string
  /** Session ID */
  sessionId?: string
  /** Theme type */
  themeType: ThemeType
  /** Generation outcome */
  outcome: GenerationOutcome
  /** Error category (if failed) */
  errorCategory?: GenerationErrorCategory
  /** Error message (if failed) */
  errorMessage?: string
  /** Generation time in milliseconds */
  generationTimeMs: number
  /** Credits used */
  creditsUsed: number
  /** Token count (input + output) */
  tokenCount?: number
  /** Iteration number (1 for initial, 2+ for iterations) */
  iterationNumber: number
  /** Whether this was deployed */
  deployed: boolean
  /** Deployment outcome (if deployed) */
  deploymentOutcome?: "success" | "failed"
  /** User satisfaction rating (1-5) */
  satisfactionRating?: number
  /** Timestamp */
  timestamp: Date
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/** Input for recording a theme generation */
export interface RecordGenerationInput {
  projectId: string
  userId: string
  sessionId?: string
  themeType?: ThemeType
  outcome?: GenerationOutcome
  errorCategory?: GenerationErrorCategory
  errorMessage?: string
  generationTimeMs: number
  creditsUsed: number
  tokenCount?: number
  iterationNumber?: number
  deployed?: boolean
  deploymentOutcome?: "success" | "failed"
  satisfactionRating?: number
  metadata?: Record<string, unknown>
}

/** Time period for analytics */
export type AnalyticsPeriod = "hour" | "day" | "week" | "month" | "quarter" | "year"

/** Summary statistics for a period */
export interface ThemeAnalyticsSummary {
  /** Period type */
  period: AnalyticsPeriod
  /** Start of period */
  startDate: Date
  /** End of period */
  endDate: Date
  /** Total generation attempts */
  totalGenerations: number
  /** Successful generations */
  successfulGenerations: number
  /** Failed generations */
  failedGenerations: number
  /** Success rate (0-100) */
  successRate: number
  /** Average generation time in ms */
  averageGenerationTimeMs: number
  /** Median generation time in ms */
  medianGenerationTimeMs: number
  /** P95 generation time in ms */
  p95GenerationTimeMs: number
  /** Total credits used */
  totalCreditsUsed: number
  /** Average credits per generation */
  averageCreditsPerGeneration: number
  /** Total tokens processed */
  totalTokens: number
  /** Unique users */
  uniqueUsers: number
  /** Unique projects */
  uniqueProjects: number
  /** Deployment rate (% of themes deployed) */
  deploymentRate: number
  /** Average satisfaction rating */
  averageSatisfaction: number | null
  /** Breakdown by theme type */
  byThemeType: ThemeTypeBreakdown[]
  /** Breakdown by outcome */
  byOutcome: OutcomeBreakdown[]
  /** Breakdown by error category */
  byErrorCategory: ErrorCategoryBreakdown[]
  /** Hourly distribution (for day view) */
  hourlyDistribution?: HourlyMetrics[]
  /** Daily trend (for week/month view) */
  dailyTrend?: DailyMetrics[]
}

/** Theme type breakdown */
export interface ThemeTypeBreakdown {
  themeType: ThemeType
  count: number
  percentage: number
  successRate: number
  averageTimeMs: number
  averageCredits: number
}

/** Outcome breakdown */
export interface OutcomeBreakdown {
  outcome: GenerationOutcome
  count: number
  percentage: number
}

/** Error category breakdown */
export interface ErrorCategoryBreakdown {
  category: GenerationErrorCategory
  count: number
  percentage: number
  commonMessages: string[]
}

/** Hourly metrics */
export interface HourlyMetrics {
  hour: number
  generations: number
  successRate: number
  averageTimeMs: number
}

/** Daily metrics */
export interface DailyMetrics {
  date: string
  generations: number
  successRate: number
  creditsUsed: number
  uniqueUsers: number
}

/** User-level analytics */
export interface UserThemeAnalytics {
  userId: string
  totalGenerations: number
  successfulGenerations: number
  successRate: number
  totalCreditsUsed: number
  averageIterations: number
  averageSatisfaction: number | null
  topThemeTypes: ThemeType[]
  lastGenerationAt: Date | null
  deploymentRate: number
}

/** Project-level analytics */
export interface ProjectThemeAnalytics {
  projectId: string
  totalGenerations: number
  successfulGenerations: number
  totalIterations: number
  totalCreditsUsed: number
  deploymentCount: number
  lastDeployedAt: Date | null
  averageSatisfaction: number | null
}

/** Performance insights */
export interface PerformanceInsight {
  type: "success_rate" | "performance" | "cost" | "user_behavior" | "trend"
  severity: "info" | "warning" | "critical" | "positive"
  title: string
  description: string
  metric?: string
  value?: number
  recommendation?: string
  affectedPeriod?: string
}

/** Dashboard data for UI */
export interface ThemeDashboardData {
  /** Overall success rate */
  successRate: number
  /** Success rate change from previous period */
  successRateChange: number
  /** Total generations this period */
  totalGenerations: number
  /** Generation count change */
  generationCountChange: number
  /** Average generation time */
  averageTimeSeconds: number
  /** Time change from previous period */
  timeChange: number
  /** Total credits used */
  totalCreditsUsed: number
  /** Credits change */
  creditsChange: number
  /** Generation trend (last 7 days) */
  generationTrend: Array<{ date: string; count: number; successRate: number }>
  /** Theme type distribution */
  themeTypeDistribution: Array<{ type: string; percentage: number }>
  /** Recent failures */
  recentFailures: Array<{ projectId: string; error: string; time: string }>
  /** Active insights count */
  activeInsights: number
}

// ============================================================================
// Theme Performance Tracker
// ============================================================================

export class ThemePerformanceTracker {
  private events: ThemeGenerationEvent[] = []
  private listeners: Set<(event: ThemeGenerationEvent) => void> = new Set()

  /**
   * Record a theme generation event
   */
  recordGeneration(input: RecordGenerationInput): ThemeGenerationEvent {
    const event: ThemeGenerationEvent = {
      id: `thm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectId: input.projectId,
      userId: input.userId,
      sessionId: input.sessionId,
      themeType: input.themeType || "full",
      outcome: input.outcome || "success",
      errorCategory: input.errorCategory,
      errorMessage: input.errorMessage,
      generationTimeMs: input.generationTimeMs,
      creditsUsed: input.creditsUsed,
      tokenCount: input.tokenCount,
      iterationNumber: input.iterationNumber || 1,
      deployed: input.deployed || false,
      deploymentOutcome: input.deploymentOutcome,
      satisfactionRating: input.satisfactionRating,
      timestamp: new Date(),
      metadata: input.metadata,
    }

    this.events.push(event)
    this.notifyListeners(event)

    return event
  }

  /**
   * Record a successful generation (convenience method)
   */
  recordSuccess(
    projectId: string,
    userId: string,
    generationTimeMs: number,
    creditsUsed: number,
    options?: Partial<RecordGenerationInput>
  ): ThemeGenerationEvent {
    return this.recordGeneration({
      projectId,
      userId,
      generationTimeMs,
      creditsUsed,
      outcome: "success",
      ...options,
    })
  }

  /**
   * Record a failed generation (convenience method)
   */
  recordFailure(
    projectId: string,
    userId: string,
    generationTimeMs: number,
    errorCategory: GenerationErrorCategory,
    errorMessage: string,
    options?: Partial<RecordGenerationInput>
  ): ThemeGenerationEvent {
    return this.recordGeneration({
      projectId,
      userId,
      generationTimeMs,
      creditsUsed: 0,
      outcome: "failed",
      errorCategory,
      errorMessage,
      ...options,
    })
  }

  /**
   * Update an event (e.g., add satisfaction rating after generation)
   */
  updateEvent(
    eventId: string,
    updates: Partial<Pick<ThemeGenerationEvent, "satisfactionRating" | "deployed" | "deploymentOutcome">>
  ): ThemeGenerationEvent | null {
    const event = this.events.find((e) => e.id === eventId)
    if (!event) return null

    Object.assign(event, updates)
    return event
  }

  /**
   * Get analytics summary for a period
   */
  getSummary(period: AnalyticsPeriod, startDate?: Date): ThemeAnalyticsSummary {
    const now = new Date()
    const start = startDate || this.getPeriodStart(period, now)
    const end = now

    const filtered = this.events.filter(
      (e) => e.timestamp >= start && e.timestamp <= end
    )

    if (filtered.length === 0) {
      return this.getEmptySummary(period, start, end)
    }

    const successful = filtered.filter((e) => e.outcome === "success" || e.outcome === "partial")
    const failed = filtered.filter((e) => e.outcome === "failed")
    const deployed = filtered.filter((e) => e.deployed)
    const withRatings = filtered.filter((e) => e.satisfactionRating !== undefined)

    // Calculate timing metrics
    const times = filtered.map((e) => e.generationTimeMs).sort((a, b) => a - b)
    const averageTime = times.reduce((a, b) => a + b, 0) / times.length
    const medianTime = times[Math.floor(times.length / 2)]
    const p95Time = times[Math.floor(times.length * 0.95)]

    // Credit metrics
    const totalCredits = filtered.reduce((sum, e) => sum + e.creditsUsed, 0)
    const totalTokens = filtered.reduce((sum, e) => sum + (e.tokenCount || 0), 0)

    // Unique counts
    const uniqueUsers = new Set(filtered.map((e) => e.userId)).size
    const uniqueProjects = new Set(filtered.map((e) => e.projectId)).size

    // Satisfaction
    const avgSatisfaction = withRatings.length > 0
      ? withRatings.reduce((sum, e) => sum + (e.satisfactionRating || 0), 0) / withRatings.length
      : null

    // Theme type breakdown
    const byThemeType = this.getThemeTypeBreakdown(filtered)

    // Outcome breakdown
    const byOutcome = this.getOutcomeBreakdown(filtered)

    // Error breakdown
    const byErrorCategory = this.getErrorCategoryBreakdown(failed)

    // Time-based distributions
    const hourlyDistribution = period === "day" ? this.getHourlyDistribution(filtered) : undefined
    const dailyTrend = ["week", "month", "quarter"].includes(period)
      ? this.getDailyTrend(filtered, start, end)
      : undefined

    return {
      period,
      startDate: start,
      endDate: end,
      totalGenerations: filtered.length,
      successfulGenerations: successful.length,
      failedGenerations: failed.length,
      successRate: (successful.length / filtered.length) * 100,
      averageGenerationTimeMs: averageTime,
      medianGenerationTimeMs: medianTime,
      p95GenerationTimeMs: p95Time,
      totalCreditsUsed: totalCredits,
      averageCreditsPerGeneration: totalCredits / filtered.length,
      totalTokens,
      uniqueUsers,
      uniqueProjects,
      deploymentRate: (deployed.length / filtered.length) * 100,
      averageSatisfaction: avgSatisfaction,
      byThemeType,
      byOutcome,
      byErrorCategory,
      hourlyDistribution,
      dailyTrend,
    }
  }

  /**
   * Get user-level analytics
   */
  getUserAnalytics(userId: string): UserThemeAnalytics {
    const userEvents = this.events.filter((e) => e.userId === userId)

    if (userEvents.length === 0) {
      return {
        userId,
        totalGenerations: 0,
        successfulGenerations: 0,
        successRate: 0,
        totalCreditsUsed: 0,
        averageIterations: 0,
        averageSatisfaction: null,
        topThemeTypes: [],
        lastGenerationAt: null,
        deploymentRate: 0,
      }
    }

    const successful = userEvents.filter((e) => e.outcome === "success" || e.outcome === "partial")
    const deployed = userEvents.filter((e) => e.deployed)
    const withRatings = userEvents.filter((e) => e.satisfactionRating !== undefined)

    // Get top theme types
    const typeCounts = new Map<ThemeType, number>()
    for (const event of userEvents) {
      typeCounts.set(event.themeType, (typeCounts.get(event.themeType) || 0) + 1)
    }
    const topThemeTypes = Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type)

    // Calculate average iterations per project
    const projectIterations = new Map<string, number>()
    for (const event of userEvents) {
      const current = projectIterations.get(event.projectId) || 0
      projectIterations.set(event.projectId, Math.max(current, event.iterationNumber))
    }
    const avgIterations = Array.from(projectIterations.values()).reduce((a, b) => a + b, 0) /
      projectIterations.size

    return {
      userId,
      totalGenerations: userEvents.length,
      successfulGenerations: successful.length,
      successRate: (successful.length / userEvents.length) * 100,
      totalCreditsUsed: userEvents.reduce((sum, e) => sum + e.creditsUsed, 0),
      averageIterations: avgIterations,
      averageSatisfaction: withRatings.length > 0
        ? withRatings.reduce((sum, e) => sum + (e.satisfactionRating || 0), 0) / withRatings.length
        : null,
      topThemeTypes,
      lastGenerationAt: userEvents.length > 0
        ? new Date(Math.max(...userEvents.map((e) => e.timestamp.getTime())))
        : null,
      deploymentRate: (deployed.length / userEvents.length) * 100,
    }
  }

  /**
   * Get project-level analytics
   */
  getProjectAnalytics(projectId: string): ProjectThemeAnalytics {
    const projectEvents = this.events.filter((e) => e.projectId === projectId)

    if (projectEvents.length === 0) {
      return {
        projectId,
        totalGenerations: 0,
        successfulGenerations: 0,
        totalIterations: 0,
        totalCreditsUsed: 0,
        deploymentCount: 0,
        lastDeployedAt: null,
        averageSatisfaction: null,
      }
    }

    const successful = projectEvents.filter((e) => e.outcome === "success" || e.outcome === "partial")
    const deployed = projectEvents.filter((e) => e.deployed && e.deploymentOutcome === "success")
    const withRatings = projectEvents.filter((e) => e.satisfactionRating !== undefined)
    const iterations = projectEvents.filter((e) => e.themeType === "iteration")

    return {
      projectId,
      totalGenerations: projectEvents.length,
      successfulGenerations: successful.length,
      totalIterations: iterations.length,
      totalCreditsUsed: projectEvents.reduce((sum, e) => sum + e.creditsUsed, 0),
      deploymentCount: deployed.length,
      lastDeployedAt: deployed.length > 0
        ? new Date(Math.max(...deployed.map((e) => e.timestamp.getTime())))
        : null,
      averageSatisfaction: withRatings.length > 0
        ? withRatings.reduce((sum, e) => sum + (e.satisfactionRating || 0), 0) / withRatings.length
        : null,
    }
  }

  /**
   * Get performance insights
   */
  getInsights(): PerformanceInsight[] {
    const insights: PerformanceInsight[] = []
    const weekSummary = this.getSummary("week")
    const prevWeekStart = new Date()
    prevWeekStart.setDate(prevWeekStart.getDate() - 14)
    const prevWeekSummary = this.getSummary("week", prevWeekStart)

    // Success rate insights
    if (weekSummary.successRate < 80 && weekSummary.totalGenerations >= 10) {
      insights.push({
        type: "success_rate",
        severity: weekSummary.successRate < 60 ? "critical" : "warning",
        title: "Low generation success rate",
        description: `Success rate is ${weekSummary.successRate.toFixed(1)}%, which is below the target of 80%.`,
        metric: "Success Rate",
        value: weekSummary.successRate,
        recommendation: "Review common error patterns and improve prompt handling.",
      })
    }

    // Success rate improvement
    if (prevWeekSummary.totalGenerations >= 10 && weekSummary.successRate > prevWeekSummary.successRate + 5) {
      insights.push({
        type: "trend",
        severity: "positive",
        title: "Success rate improving",
        description: `Success rate increased from ${prevWeekSummary.successRate.toFixed(1)}% to ${weekSummary.successRate.toFixed(1)}%.`,
        metric: "Success Rate Change",
        value: weekSummary.successRate - prevWeekSummary.successRate,
      })
    }

    // Performance insights
    if (weekSummary.p95GenerationTimeMs > 10000 && weekSummary.totalGenerations >= 10) {
      insights.push({
        type: "performance",
        severity: "warning",
        title: "Slow P95 generation time",
        description: `95th percentile generation time is ${(weekSummary.p95GenerationTimeMs / 1000).toFixed(1)}s.`,
        metric: "P95 Time",
        value: weekSummary.p95GenerationTimeMs,
        recommendation: "Consider optimizing model parameters or adding caching.",
      })
    }

    // Cost insights
    if (weekSummary.averageCreditsPerGeneration > 12) {
      insights.push({
        type: "cost",
        severity: "info",
        title: "Higher than average credit usage",
        description: `Average ${weekSummary.averageCreditsPerGeneration.toFixed(1)} credits per generation.`,
        metric: "Avg Credits",
        value: weekSummary.averageCreditsPerGeneration,
        recommendation: "Review token usage and consider optimization strategies.",
      })
    }

    // User behavior insights
    const userEvents = this.events.filter(
      (e) => e.timestamp >= this.getPeriodStart("week", new Date())
    )
    const userIterations = new Map<string, number>()
    for (const event of userEvents) {
      if (event.themeType === "iteration") {
        userIterations.set(event.userId, (userIterations.get(event.userId) || 0) + 1)
      }
    }
    const highIterationUsers = Array.from(userIterations.entries()).filter(([, count]) => count > 5)

    if (highIterationUsers.length > 3) {
      insights.push({
        type: "user_behavior",
        severity: "info",
        title: "High iteration usage detected",
        description: `${highIterationUsers.length} users have more than 5 iterations this week.`,
        metric: "High Iteration Users",
        value: highIterationUsers.length,
        recommendation: "Consider improving initial generation quality to reduce iterations.",
      })
    }

    // Deployment rate
    if (weekSummary.deploymentRate < 30 && weekSummary.successfulGenerations >= 10) {
      insights.push({
        type: "user_behavior",
        severity: "info",
        title: "Low deployment rate",
        description: `Only ${weekSummary.deploymentRate.toFixed(1)}% of successful themes are deployed.`,
        metric: "Deployment Rate",
        value: weekSummary.deploymentRate,
        recommendation: "Improve deployment UX or investigate user satisfaction.",
      })
    }

    // Error pattern insights
    for (const errorBreakdown of weekSummary.byErrorCategory) {
      if (errorBreakdown.count >= 5 && errorBreakdown.percentage > 20) {
        insights.push({
          type: "success_rate",
          severity: errorBreakdown.percentage > 40 ? "critical" : "warning",
          title: `Frequent ${errorBreakdown.category} errors`,
          description: `${errorBreakdown.count} failures (${errorBreakdown.percentage.toFixed(1)}%) due to ${errorBreakdown.category}.`,
          metric: "Error Count",
          value: errorBreakdown.count,
          recommendation: this.getErrorRecommendation(errorBreakdown.category),
        })
      }
    }

    return insights.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2, positive: 3 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })
  }

  /**
   * Get dashboard data
   */
  getDashboardData(): ThemeDashboardData {
    const thisWeek = this.getSummary("week")
    const lastWeekStart = new Date()
    lastWeekStart.setDate(lastWeekStart.getDate() - 14)
    const lastWeek = this.getSummary("week", lastWeekStart)

    // Calculate changes
    const successRateChange = lastWeek.totalGenerations > 0
      ? thisWeek.successRate - lastWeek.successRate
      : 0
    const generationCountChange = lastWeek.totalGenerations > 0
      ? ((thisWeek.totalGenerations - lastWeek.totalGenerations) / lastWeek.totalGenerations) * 100
      : 0
    const timeChange = lastWeek.totalGenerations > 0
      ? ((thisWeek.averageGenerationTimeMs - lastWeek.averageGenerationTimeMs) / lastWeek.averageGenerationTimeMs) * 100
      : 0
    const creditsChange = lastWeek.totalCreditsUsed > 0
      ? ((thisWeek.totalCreditsUsed - lastWeek.totalCreditsUsed) / lastWeek.totalCreditsUsed) * 100
      : 0

    // Generation trend
    const generationTrend = (thisWeek.dailyTrend || []).map((day) => ({
      date: day.date,
      count: day.generations,
      successRate: day.successRate,
    }))

    // Theme type distribution
    const themeTypeDistribution = thisWeek.byThemeType.map((t) => ({
      type: t.themeType,
      percentage: t.percentage,
    }))

    // Recent failures
    const recentFailures = this.events
      .filter((e) => e.outcome === "failed")
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 5)
      .map((e) => ({
        projectId: e.projectId,
        error: e.errorMessage || e.errorCategory || "Unknown error",
        time: this.formatRelativeTime(e.timestamp),
      }))

    const insights = this.getInsights()

    return {
      successRate: thisWeek.successRate,
      successRateChange,
      totalGenerations: thisWeek.totalGenerations,
      generationCountChange,
      averageTimeSeconds: thisWeek.averageGenerationTimeMs / 1000,
      timeChange,
      totalCreditsUsed: thisWeek.totalCreditsUsed,
      creditsChange,
      generationTrend,
      themeTypeDistribution,
      recentFailures,
      activeInsights: insights.filter((i) => i.severity !== "info" && i.severity !== "positive").length,
    }
  }

  /**
   * Subscribe to generation events
   */
  onGeneration(listener: (event: ThemeGenerationEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Export data
   */
  exportData(format: "json" | "csv" = "json"): string {
    if (format === "csv") {
      const headers = [
        "id", "timestamp", "projectId", "userId", "themeType", "outcome",
        "errorCategory", "generationTimeMs", "creditsUsed", "tokenCount",
        "iterationNumber", "deployed", "satisfactionRating"
      ]
      const rows = this.events.map((e) => [
        e.id,
        e.timestamp.toISOString(),
        e.projectId,
        e.userId,
        e.themeType,
        e.outcome,
        e.errorCategory || "",
        e.generationTimeMs,
        e.creditsUsed,
        e.tokenCount || "",
        e.iterationNumber,
        e.deployed,
        e.satisfactionRating || "",
      ])
      return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    }

    return JSON.stringify(this.events, null, 2)
  }

  /**
   * Clear old records
   */
  pruneRecords(olderThan: Date): number {
    const initialCount = this.events.length
    this.events = this.events.filter((e) => e.timestamp >= olderThan)
    return initialCount - this.events.length
  }

  /**
   * Get all events (for debugging/testing)
   */
  getAllEvents(): ThemeGenerationEvent[] {
    return [...this.events]
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private getPeriodStart(period: AnalyticsPeriod, from: Date): Date {
    const start = new Date(from)
    switch (period) {
      case "hour":
        start.setMinutes(0, 0, 0)
        break
      case "day":
        start.setHours(0, 0, 0, 0)
        break
      case "week":
        start.setHours(0, 0, 0, 0)
        start.setDate(start.getDate() - start.getDay())
        break
      case "month":
        start.setHours(0, 0, 0, 0)
        start.setDate(1)
        break
      case "quarter":
        start.setHours(0, 0, 0, 0)
        start.setDate(1)
        start.setMonth(Math.floor(start.getMonth() / 3) * 3)
        break
      case "year":
        start.setHours(0, 0, 0, 0)
        start.setMonth(0, 1)
        break
    }
    return start
  }

  private getEmptySummary(period: AnalyticsPeriod, startDate: Date, endDate: Date): ThemeAnalyticsSummary {
    return {
      period,
      startDate,
      endDate,
      totalGenerations: 0,
      successfulGenerations: 0,
      failedGenerations: 0,
      successRate: 0,
      averageGenerationTimeMs: 0,
      medianGenerationTimeMs: 0,
      p95GenerationTimeMs: 0,
      totalCreditsUsed: 0,
      averageCreditsPerGeneration: 0,
      totalTokens: 0,
      uniqueUsers: 0,
      uniqueProjects: 0,
      deploymentRate: 0,
      averageSatisfaction: null,
      byThemeType: [],
      byOutcome: [],
      byErrorCategory: [],
    }
  }

  private getThemeTypeBreakdown(events: ThemeGenerationEvent[]): ThemeTypeBreakdown[] {
    const groups = new Map<ThemeType, ThemeGenerationEvent[]>()
    for (const event of events) {
      const list = groups.get(event.themeType) || []
      list.push(event)
      groups.set(event.themeType, list)
    }

    return Array.from(groups.entries()).map(([themeType, typeEvents]) => {
      const successful = typeEvents.filter((e) => e.outcome === "success" || e.outcome === "partial")
      const times = typeEvents.map((e) => e.generationTimeMs)
      const credits = typeEvents.reduce((sum, e) => sum + e.creditsUsed, 0)

      return {
        themeType,
        count: typeEvents.length,
        percentage: (typeEvents.length / events.length) * 100,
        successRate: (successful.length / typeEvents.length) * 100,
        averageTimeMs: times.reduce((a, b) => a + b, 0) / times.length,
        averageCredits: credits / typeEvents.length,
      }
    }).sort((a, b) => b.count - a.count)
  }

  private getOutcomeBreakdown(events: ThemeGenerationEvent[]): OutcomeBreakdown[] {
    const groups = new Map<GenerationOutcome, number>()
    for (const event of events) {
      groups.set(event.outcome, (groups.get(event.outcome) || 0) + 1)
    }

    return Array.from(groups.entries()).map(([outcome, count]) => ({
      outcome,
      count,
      percentage: (count / events.length) * 100,
    })).sort((a, b) => b.count - a.count)
  }

  private getErrorCategoryBreakdown(failedEvents: ThemeGenerationEvent[]): ErrorCategoryBreakdown[] {
    if (failedEvents.length === 0) return []

    const groups = new Map<GenerationErrorCategory, ThemeGenerationEvent[]>()
    for (const event of failedEvents) {
      const category = event.errorCategory || "unknown"
      const list = groups.get(category) || []
      list.push(event)
      groups.set(category, list)
    }

    return Array.from(groups.entries()).map(([category, categoryEvents]) => {
      const messages = categoryEvents
        .map((e) => e.errorMessage)
        .filter((m): m is string => !!m)
      const uniqueMessages = Array.from(new Set(messages)).slice(0, 3)

      return {
        category,
        count: categoryEvents.length,
        percentage: (categoryEvents.length / failedEvents.length) * 100,
        commonMessages: uniqueMessages,
      }
    }).sort((a, b) => b.count - a.count)
  }

  private getHourlyDistribution(events: ThemeGenerationEvent[]): HourlyMetrics[] {
    return Array.from({ length: 24 }, (_, hour) => {
      const hourEvents = events.filter((e) => e.timestamp.getHours() === hour)
      const successful = hourEvents.filter((e) => e.outcome === "success" || e.outcome === "partial")
      const times = hourEvents.map((e) => e.generationTimeMs)

      return {
        hour,
        generations: hourEvents.length,
        successRate: hourEvents.length > 0 ? (successful.length / hourEvents.length) * 100 : 0,
        averageTimeMs: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
      }
    })
  }

  private getDailyTrend(events: ThemeGenerationEvent[], startDate: Date, endDate: Date): DailyMetrics[] {
    const days: DailyMetrics[] = []
    const current = new Date(startDate)

    while (current <= endDate) {
      const dayStart = new Date(current)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(current)
      dayEnd.setHours(23, 59, 59, 999)

      const dayEvents = events.filter(
        (e) => e.timestamp >= dayStart && e.timestamp <= dayEnd
      )
      const successful = dayEvents.filter((e) => e.outcome === "success" || e.outcome === "partial")
      const uniqueUsers = new Set(dayEvents.map((e) => e.userId)).size

      days.push({
        date: current.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        generations: dayEvents.length,
        successRate: dayEvents.length > 0 ? (successful.length / dayEvents.length) * 100 : 0,
        creditsUsed: dayEvents.reduce((sum, e) => sum + e.creditsUsed, 0),
        uniqueUsers,
      })

      current.setDate(current.getDate() + 1)
    }

    return days
  }

  private getErrorRecommendation(category: GenerationErrorCategory): string {
    const recommendations: Record<GenerationErrorCategory, string> = {
      prompt_error: "Review prompt validation and provide better user guidance.",
      model_error: "Check model availability and implement retry logic.",
      validation_error: "Review theme validation rules for edge cases.",
      system_error: "Check system logs and infrastructure health.",
      timeout_error: "Optimize generation pipeline or increase timeout limits.",
      credit_error: "Improve credit balance UX and pre-validation.",
      unknown: "Add better error categorization to identify root causes.",
    }
    return recommendations[category]
  }

  private formatRelativeTime(date: Date): string {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return "just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  private notifyListeners(event: ThemeGenerationEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event)
      } catch (e) {
        console.error("Theme analytics listener error:", e)
      }
    })
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let trackerInstance: ThemePerformanceTracker | null = null

/**
 * Get the global theme analytics tracker
 */
export function getThemeAnalytics(): ThemePerformanceTracker {
  if (!trackerInstance) {
    trackerInstance = new ThemePerformanceTracker()
  }
  return trackerInstance
}

/**
 * Create a new tracker instance (for testing)
 */
export function createThemeAnalytics(): ThemePerformanceTracker {
  return new ThemePerformanceTracker()
}

/**
 * Record a theme generation (convenience export)
 */
export function recordThemeGeneration(input: RecordGenerationInput): ThemeGenerationEvent {
  return getThemeAnalytics().recordGeneration(input)
}

/**
 * Get analytics summary (convenience export)
 */
export function getThemeSummary(period: AnalyticsPeriod): ThemeAnalyticsSummary {
  return getThemeAnalytics().getSummary(period)
}

/**
 * Get dashboard data (convenience export)
 */
export function getThemeDashboardData(): ThemeDashboardData {
  return getThemeAnalytics().getDashboardData()
}

export default ThemePerformanceTracker
