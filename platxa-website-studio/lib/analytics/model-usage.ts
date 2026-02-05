/**
 * Model Usage Analytics
 *
 * Tracking for AI model usage, cost monitoring, and optimization insights.
 */

// ============================================================================
// Types
// ============================================================================

export type ModelProvider = 'anthropic' | 'openai' | 'google' | 'mistral' | 'local';

export type ModelTier = 'fast' | 'standard' | 'advanced' | 'flagship';

export interface ModelInfo {
  id: string;
  name: string;
  provider: ModelProvider;
  tier: ModelTier;
  contextWindow: number;
  inputPricePer1k: number;  // USD per 1000 tokens
  outputPricePer1k: number; // USD per 1000 tokens
  capabilities: string[];
}

export interface UsageRecord {
  id: string;
  timestamp: Date;
  modelId: string;
  provider: ModelProvider;
  sessionId: string;
  userId?: string;
  projectId?: string;
  operation: 'chat' | 'completion' | 'embedding' | 'vision' | 'code';
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
  cost: number;
  success: boolean;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

export interface UsageSummary {
  period: 'hour' | 'day' | 'week' | 'month';
  startDate: Date;
  endDate: Date;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  byModel: ModelBreakdown[];
  byOperation: OperationBreakdown[];
  byHour?: HourlyBreakdown[];
}

export interface ModelBreakdown {
  modelId: string;
  modelName: string;
  provider: ModelProvider;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  percentage: number;
  averageLatencyMs: number;
}

export interface OperationBreakdown {
  operation: string;
  requests: number;
  tokens: number;
  cost: number;
  percentage: number;
}

export interface HourlyBreakdown {
  hour: number;
  requests: number;
  tokens: number;
  cost: number;
}

export interface CostAlert {
  id: string;
  type: 'daily_limit' | 'weekly_limit' | 'monthly_limit' | 'rate_spike' | 'error_rate';
  threshold: number;
  currentValue: number;
  triggeredAt: Date;
  acknowledged: boolean;
  message: string;
}

export interface OptimizationSuggestion {
  id: string;
  type: 'model_switch' | 'caching' | 'batching' | 'prompt_optimization' | 'rate_limiting';
  priority: 'low' | 'medium' | 'high';
  potentialSavings: number;
  description: string;
  recommendation: string;
  affectedOperations: string[];
}

// ============================================================================
// Model Registry
// ============================================================================

export const MODEL_REGISTRY: Record<string, ModelInfo> = {
  // Anthropic
  'claude-3-opus': {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    tier: 'flagship',
    contextWindow: 200000,
    inputPricePer1k: 0.015,
    outputPricePer1k: 0.075,
    capabilities: ['chat', 'vision', 'code', 'analysis'],
  },
  'claude-3-sonnet': {
    id: 'claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    provider: 'anthropic',
    tier: 'advanced',
    contextWindow: 200000,
    inputPricePer1k: 0.003,
    outputPricePer1k: 0.015,
    capabilities: ['chat', 'vision', 'code', 'analysis'],
  },
  'claude-3-haiku': {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    tier: 'fast',
    contextWindow: 200000,
    inputPricePer1k: 0.00025,
    outputPricePer1k: 0.00125,
    capabilities: ['chat', 'code'],
  },
  // OpenAI
  'gpt-4-turbo': {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    tier: 'flagship',
    contextWindow: 128000,
    inputPricePer1k: 0.01,
    outputPricePer1k: 0.03,
    capabilities: ['chat', 'vision', 'code', 'function_calling'],
  },
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    tier: 'advanced',
    contextWindow: 128000,
    inputPricePer1k: 0.005,
    outputPricePer1k: 0.015,
    capabilities: ['chat', 'vision', 'code', 'function_calling'],
  },
  'gpt-3.5-turbo': {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    tier: 'fast',
    contextWindow: 16385,
    inputPricePer1k: 0.0005,
    outputPricePer1k: 0.0015,
    capabilities: ['chat', 'code', 'function_calling'],
  },
  // Google
  'gemini-pro': {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    provider: 'google',
    tier: 'advanced',
    contextWindow: 32000,
    inputPricePer1k: 0.00025,
    outputPricePer1k: 0.0005,
    capabilities: ['chat', 'code'],
  },
  'gemini-ultra': {
    id: 'gemini-ultra',
    name: 'Gemini Ultra',
    provider: 'google',
    tier: 'flagship',
    contextWindow: 32000,
    inputPricePer1k: 0.00125,
    outputPricePer1k: 0.00375,
    capabilities: ['chat', 'vision', 'code', 'analysis'],
  },
  // Mistral
  'mistral-large': {
    id: 'mistral-large',
    name: 'Mistral Large',
    provider: 'mistral',
    tier: 'advanced',
    contextWindow: 32000,
    inputPricePer1k: 0.004,
    outputPricePer1k: 0.012,
    capabilities: ['chat', 'code', 'function_calling'],
  },
  'mistral-medium': {
    id: 'mistral-medium',
    name: 'Mistral Medium',
    provider: 'mistral',
    tier: 'standard',
    contextWindow: 32000,
    inputPricePer1k: 0.0027,
    outputPricePer1k: 0.0081,
    capabilities: ['chat', 'code'],
  },
};

// ============================================================================
// Usage Tracker
// ============================================================================

export class ModelUsageTracker {
  private records: UsageRecord[] = [];
  private alerts: CostAlert[] = [];
  private limits: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  private listeners: Set<(record: UsageRecord) => void> = new Set();

  constructor(limits?: { daily?: number; weekly?: number; monthly?: number }) {
    this.limits = {
      daily: limits?.daily || 100,
      weekly: limits?.weekly || 500,
      monthly: limits?.monthly || 2000,
    };
  }

  /**
   * Record a model usage event
   */
  recordUsage(
    params: Omit<UsageRecord, 'id' | 'timestamp' | 'cost'>
  ): UsageRecord {
    const model = MODEL_REGISTRY[params.modelId];
    const cost = model
      ? this.calculateCost(model, params.inputTokens, params.outputTokens)
      : 0;

    const record: UsageRecord = {
      ...params,
      id: `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      cost,
    };

    this.records.push(record);
    this.checkAlerts();
    this.notifyListeners(record);

    return record;
  }

  /**
   * Calculate cost for token usage
   */
  calculateCost(model: ModelInfo, inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1000) * model.inputPricePer1k;
    const outputCost = (outputTokens / 1000) * model.outputPricePer1k;
    return Math.round((inputCost + outputCost) * 10000) / 10000;
  }

  /**
   * Get usage summary for a period
   */
  getSummary(period: UsageSummary['period'], startDate?: Date): UsageSummary {
    const now = new Date();
    const start = startDate || this.getPeriodStart(period, now);
    const end = now;

    const filteredRecords = this.records.filter(
      (r) => r.timestamp >= start && r.timestamp <= end
    );

    const successful = filteredRecords.filter((r) => r.success);
    const failed = filteredRecords.filter((r) => !r.success);

    const latencies = successful.map((r) => r.latencyMs).sort((a, b) => a - b);
    const p95Index = Math.floor(latencies.length * 0.95);

    // Group by model
    const modelGroups = this.groupBy(filteredRecords, 'modelId');
    const totalCost = filteredRecords.reduce((sum, r) => sum + r.cost, 0);

    const byModel: ModelBreakdown[] = Object.entries(modelGroups).map(([modelId, records]) => {
      const model = MODEL_REGISTRY[modelId];
      const modelCost = records.reduce((sum, r) => sum + r.cost, 0);
      const modelLatencies = records.filter((r) => r.success).map((r) => r.latencyMs);

      return {
        modelId,
        modelName: model?.name || modelId,
        provider: model?.provider || 'unknown' as ModelProvider,
        requests: records.length,
        inputTokens: records.reduce((sum, r) => sum + r.inputTokens, 0),
        outputTokens: records.reduce((sum, r) => sum + r.outputTokens, 0),
        cost: modelCost,
        percentage: totalCost > 0 ? (modelCost / totalCost) * 100 : 0,
        averageLatencyMs: modelLatencies.length > 0
          ? modelLatencies.reduce((a, b) => a + b, 0) / modelLatencies.length
          : 0,
      };
    });

    // Group by operation
    const opGroups = this.groupBy(filteredRecords, 'operation');
    const totalTokens = filteredRecords.reduce((sum, r) => sum + r.totalTokens, 0);

    const byOperation: OperationBreakdown[] = Object.entries(opGroups).map(([op, records]) => {
      const opTokens = records.reduce((sum, r) => sum + r.totalTokens, 0);
      const opCost = records.reduce((sum, r) => sum + r.cost, 0);

      return {
        operation: op,
        requests: records.length,
        tokens: opTokens,
        cost: opCost,
        percentage: totalCost > 0 ? (opCost / totalCost) * 100 : 0,
      };
    });

    // Hourly breakdown (for day view)
    let byHour: HourlyBreakdown[] | undefined;
    if (period === 'day') {
      byHour = Array.from({ length: 24 }, (_, hour) => {
        const hourRecords = filteredRecords.filter(
          (r) => r.timestamp.getHours() === hour
        );
        return {
          hour,
          requests: hourRecords.length,
          tokens: hourRecords.reduce((sum, r) => sum + r.totalTokens, 0),
          cost: hourRecords.reduce((sum, r) => sum + r.cost, 0),
        };
      });
    }

    return {
      period,
      startDate: start,
      endDate: end,
      totalRequests: filteredRecords.length,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      totalInputTokens: filteredRecords.reduce((sum, r) => sum + r.inputTokens, 0),
      totalOutputTokens: filteredRecords.reduce((sum, r) => sum + r.outputTokens, 0),
      totalTokens,
      totalCost,
      averageLatencyMs: latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0,
      p95LatencyMs: latencies[p95Index] || 0,
      byModel: byModel.sort((a, b) => b.cost - a.cost),
      byOperation: byOperation.sort((a, b) => b.cost - a.cost),
      byHour,
    };
  }

  /**
   * Get optimization suggestions based on usage patterns
   */
  getOptimizationSuggestions(): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const summary = this.getSummary('week');

    // Check for expensive model overuse
    for (const model of summary.byModel) {
      if (model.provider === 'anthropic' && model.modelId === 'claude-3-opus') {
        const opusPercentage = model.percentage;
        if (opusPercentage > 50) {
          const savings = model.cost * 0.8; // Could save 80% by switching to Sonnet
          suggestions.push({
            id: `opt_model_switch_${model.modelId}`,
            type: 'model_switch',
            priority: 'high',
            potentialSavings: savings,
            description: `${opusPercentage.toFixed(1)}% of costs are from Claude 3 Opus`,
            recommendation: 'Consider using Claude 3 Sonnet for routine tasks. Reserve Opus for complex analysis.',
            affectedOperations: ['chat', 'completion'],
          });
        }
      }

      if (model.provider === 'openai' && model.modelId === 'gpt-4-turbo') {
        const gpt4Percentage = model.percentage;
        if (gpt4Percentage > 40) {
          suggestions.push({
            id: `opt_model_switch_${model.modelId}`,
            type: 'model_switch',
            priority: 'medium',
            potentialSavings: model.cost * 0.5,
            description: `${gpt4Percentage.toFixed(1)}% of costs from GPT-4 Turbo`,
            recommendation: 'GPT-4o offers similar quality at lower cost for most use cases.',
            affectedOperations: ['chat', 'completion'],
          });
        }
      }
    }

    // Check for caching opportunities
    if (summary.totalRequests > 100) {
      // Simplified check - in reality you'd analyze request patterns
      suggestions.push({
        id: 'opt_caching_responses',
        type: 'caching',
        priority: 'medium',
        potentialSavings: summary.totalCost * 0.15,
        description: 'High request volume detected',
        recommendation: 'Implement response caching for repeated queries to reduce API calls by ~15%.',
        affectedOperations: ['chat', 'completion'],
      });
    }

    // Check for batching opportunities
    const avgTokensPerRequest = summary.totalTokens / Math.max(summary.totalRequests, 1);
    if (avgTokensPerRequest < 500 && summary.totalRequests > 50) {
      suggestions.push({
        id: 'opt_batching_requests',
        type: 'batching',
        priority: 'low',
        potentialSavings: summary.totalCost * 0.1,
        description: 'Many small requests detected',
        recommendation: 'Consider batching multiple small requests together to reduce overhead.',
        affectedOperations: ['completion'],
      });
    }

    // Check error rate
    const errorRate = summary.failedRequests / Math.max(summary.totalRequests, 1);
    if (errorRate > 0.05) {
      suggestions.push({
        id: 'opt_error_reduction',
        type: 'rate_limiting',
        priority: 'high',
        potentialSavings: summary.totalCost * errorRate,
        description: `Error rate of ${(errorRate * 100).toFixed(1)}% detected`,
        recommendation: 'Investigate and fix errors to avoid wasted API calls. Consider implementing retry logic.',
        affectedOperations: Object.keys(this.groupBy(this.records.filter((r) => !r.success), 'operation')),
      });
    }

    return suggestions.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  /**
   * Get active alerts
   */
  getAlerts(): CostAlert[] {
    return this.alerts.filter((a) => !a.acknowledged);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  /**
   * Set spending limits
   */
  setLimits(limits: { daily?: number; weekly?: number; monthly?: number }): void {
    if (limits.daily !== undefined) this.limits.daily = limits.daily;
    if (limits.weekly !== undefined) this.limits.weekly = limits.weekly;
    if (limits.monthly !== undefined) this.limits.monthly = limits.monthly;
  }

  /**
   * Subscribe to usage events
   */
  onUsage(listener: (record: UsageRecord) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Export usage data
   */
  exportData(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = [
        'id', 'timestamp', 'modelId', 'provider', 'operation',
        'inputTokens', 'outputTokens', 'totalTokens', 'latencyMs', 'cost', 'success'
      ];
      const rows = this.records.map((r) => [
        r.id,
        r.timestamp.toISOString(),
        r.modelId,
        r.provider,
        r.operation,
        r.inputTokens,
        r.outputTokens,
        r.totalTokens,
        r.latencyMs,
        r.cost,
        r.success,
      ]);
      return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    }

    return JSON.stringify(this.records, null, 2);
  }

  /**
   * Clear old records
   */
  pruneRecords(olderThan: Date): number {
    const initialCount = this.records.length;
    this.records = this.records.filter((r) => r.timestamp >= olderThan);
    return initialCount - this.records.length;
  }

  // Private helpers

  private getPeriodStart(period: UsageSummary['period'], from: Date): Date {
    const start = new Date(from);

    switch (period) {
      case 'hour':
        start.setMinutes(0, 0, 0);
        break;
      case 'day':
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - start.getDay());
        break;
      case 'month':
        start.setHours(0, 0, 0, 0);
        start.setDate(1);
        break;
    }

    return start;
  }

  private groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
    return items.reduce((groups, item) => {
      const value = String(item[key]);
      if (!groups[value]) groups[value] = [];
      groups[value].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  private checkAlerts(): void {
    const now = new Date();

    // Check daily limit
    const daySummary = this.getSummary('day');
    if (daySummary.totalCost >= this.limits.daily) {
      this.addAlert('daily_limit', this.limits.daily, daySummary.totalCost);
    }

    // Check weekly limit
    const weekSummary = this.getSummary('week');
    if (weekSummary.totalCost >= this.limits.weekly) {
      this.addAlert('weekly_limit', this.limits.weekly, weekSummary.totalCost);
    }

    // Check monthly limit
    const monthSummary = this.getSummary('month');
    if (monthSummary.totalCost >= this.limits.monthly) {
      this.addAlert('monthly_limit', this.limits.monthly, monthSummary.totalCost);
    }

    // Check error rate spike
    const hourSummary = this.getSummary('hour');
    const errorRate = hourSummary.failedRequests / Math.max(hourSummary.totalRequests, 1);
    if (errorRate > 0.1 && hourSummary.totalRequests > 10) {
      this.addAlert('error_rate', 0.1, errorRate);
    }
  }

  private addAlert(
    type: CostAlert['type'],
    threshold: number,
    currentValue: number
  ): void {
    // Don't duplicate alerts
    const existing = this.alerts.find(
      (a) => a.type === type && !a.acknowledged &&
        Date.now() - a.triggeredAt.getTime() < 3600000 // Within last hour
    );
    if (existing) return;

    const messages: Record<CostAlert['type'], string> = {
      daily_limit: `Daily spending limit of $${threshold.toFixed(2)} reached`,
      weekly_limit: `Weekly spending limit of $${threshold.toFixed(2)} reached`,
      monthly_limit: `Monthly spending limit of $${threshold.toFixed(2)} reached`,
      rate_spike: `Unusual usage rate spike detected`,
      error_rate: `High error rate of ${(currentValue * 100).toFixed(1)}% detected`,
    };

    this.alerts.push({
      id: `alert_${Date.now()}`,
      type,
      threshold,
      currentValue,
      triggeredAt: new Date(),
      acknowledged: false,
      message: messages[type],
    });
  }

  private notifyListeners(record: UsageRecord): void {
    this.listeners.forEach((listener) => {
      try {
        listener(record);
      } catch (e) {
        console.error('Usage listener error:', e);
      }
    });
  }
}

// ============================================================================
// React Hook
// ============================================================================

export interface UseModelAnalyticsOptions {
  limits?: { daily?: number; weekly?: number; monthly?: number };
  autoRefresh?: number; // ms
}

export interface UseModelAnalyticsReturn {
  tracker: ModelUsageTracker;
  summary: UsageSummary | null;
  alerts: CostAlert[];
  suggestions: OptimizationSuggestion[];
  recordUsage: (params: Omit<UsageRecord, 'id' | 'timestamp' | 'cost'>) => UsageRecord;
  refreshSummary: (period?: UsageSummary['period']) => void;
  acknowledgeAlert: (alertId: string) => void;
  exportData: (format?: 'json' | 'csv') => string;
}

// Note: This would be implemented as a React hook in a component file
// For now, we export the tracker class and types

// ============================================================================
// Dashboard Data Helpers
// ============================================================================

export interface DashboardData {
  currentSpend: number;
  budgetUsed: number;
  projectedMonthly: number;
  topModels: Array<{ name: string; cost: number; percentage: number }>;
  costTrend: Array<{ date: string; cost: number }>;
  tokenDistribution: { input: number; output: number };
}

export function generateDashboardData(
  tracker: ModelUsageTracker,
  monthlyBudget: number
): DashboardData {
  const monthSummary = tracker.getSummary('month');
  const weekSummary = tracker.getSummary('week');

  // Calculate projected monthly based on current pace
  const daysInMonth = 30;
  const daysPassed = Math.max(1, Math.ceil(
    (monthSummary.endDate.getTime() - monthSummary.startDate.getTime()) / (1000 * 60 * 60 * 24)
  ));
  const projectedMonthly = (monthSummary.totalCost / daysPassed) * daysInMonth;

  // Cost trend for last 7 days
  const costTrend: Array<{ date: string; cost: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const daySummary = tracker.getSummary('day', date);
    costTrend.push({
      date: date.toLocaleDateString('en-US', { weekday: 'short' }),
      cost: daySummary.totalCost,
    });
  }

  return {
    currentSpend: monthSummary.totalCost,
    budgetUsed: (monthSummary.totalCost / monthlyBudget) * 100,
    projectedMonthly,
    topModels: monthSummary.byModel.slice(0, 5).map((m) => ({
      name: m.modelName,
      cost: m.cost,
      percentage: m.percentage,
    })),
    costTrend,
    tokenDistribution: {
      input: monthSummary.totalInputTokens,
      output: monthSummary.totalOutputTokens,
    },
  };
}

// ============================================================================
// Singleton Instance
// ============================================================================

let trackerInstance: ModelUsageTracker | null = null;

export function getTracker(limits?: { daily?: number; weekly?: number; monthly?: number }): ModelUsageTracker {
  if (!trackerInstance) {
    trackerInstance = new ModelUsageTracker(limits);
  }
  return trackerInstance;
}

export default ModelUsageTracker;
