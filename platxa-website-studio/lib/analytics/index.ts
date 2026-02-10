/**
 * Analytics Module
 *
 * Comprehensive analytics tracking for the Platxa platform.
 * Includes model usage, tool usage, and theme performance metrics.
 *
 * @module analytics
 */

// Model usage analytics
export {
  ModelUsageTracker,
  getTracker,
  generateDashboardData,
  MODEL_REGISTRY,
  type ModelProvider,
  type ModelTier,
  type ModelInfo,
  type UsageRecord,
  type UsageSummary,
  type ModelBreakdown,
  type OperationBreakdown,
  type HourlyBreakdown,
  type CostAlert,
  type OptimizationSuggestion,
  type UseModelAnalyticsOptions,
  type UseModelAnalyticsReturn,
  type DashboardData,
} from "./model-usage"

// Tool usage analytics
export {
  ToolUsageTracker,
  getToolTracker,
  generateToolDashboardData,
  TOOL_REGISTRY,
  type ToolCategory,
  type ToolDefinition,
  type ToolParameter,
  type ToolInvocation,
  type ToolResult,
  type ToolContext,
  type ToolUsageSummary,
  type ToolBreakdown,
  type CategoryBreakdown,
  type HourlyToolUsage,
  type ToolSequence,
  type ErrorPattern,
  type AgentBehaviorInsight,
  type ToolDashboardData,
} from "./tool-usage"

// Theme performance analytics
export {
  ThemePerformanceTracker,
  getThemeAnalytics,
  createThemeAnalytics,
  recordThemeGeneration,
  getThemeSummary,
  getThemeDashboardData,
  type GenerationOutcome,
  type GenerationErrorCategory,
  type ThemeType,
  type ThemeGenerationEvent,
  type RecordGenerationInput,
  type AnalyticsPeriod,
  type ThemeAnalyticsSummary,
  type ThemeTypeBreakdown,
  type OutcomeBreakdown,
  type ErrorCategoryBreakdown,
  type HourlyMetrics,
  type DailyMetrics,
  type UserThemeAnalytics,
  type ProjectThemeAnalytics,
  type PerformanceInsight,
  type ThemeDashboardData,
} from "./theme-performance-analytics"

// Competitive analysis
export {
  analyzeTheme,
  getMarketComparison,
  getCompetitiveInsights,
  getCompetitiveDashboard,
  type ThemeCategory,
  type QualityDimension,
  type MarketPosition,
  type AdvantageType,
  type ThemeForAnalysis,
  type ThemeFeatureSet,
  type QualityMetrics,
  type MarketplaceTheme,
  type FeatureGap,
  type FeatureDifference,
  type CompetitiveAdvantage,
  type Recommendation,
  type TrendAlignment,
  type PriceRange,
  type CompetitiveAnalysis,
  type ThemeComparison,
  type MarketOverview,
  type ScoreHistoryPoint,
  type KeyMetrics,
  type CompetitiveDashboard,
} from "./competitive-analysis"
