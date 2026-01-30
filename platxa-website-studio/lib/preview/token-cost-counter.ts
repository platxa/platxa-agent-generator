/**
 * Token Cost Counter for tracking session usage
 *
 * Feature #111: Add token/cost counter for current session
 * Verification: Shows 'Tokens: 12.3K | Cost: $0.05' in header
 */

// ============================================================================
// Types
// ============================================================================

/** Supported model identifiers */
export type ModelId =
  | "gpt-4"
  | "gpt-4-turbo"
  | "gpt-4o"
  | "gpt-4o-mini"
  | "gpt-3.5-turbo"
  | "claude-3-opus"
  | "claude-3-sonnet"
  | "claude-3-haiku"
  | "claude-3.5-sonnet"
  | "claude-3.5-haiku"
  | "custom";

/** Pricing configuration per 1K tokens */
export interface ModelPricing {
  /** Cost per 1K input tokens in USD */
  inputPer1K: number;
  /** Cost per 1K output tokens in USD */
  outputPer1K: number;
  /** Optional display name */
  displayName?: string;
}

/** Token usage for a single request */
export interface TokenUsage {
  /** Number of input/prompt tokens */
  inputTokens: number;
  /** Number of output/completion tokens */
  outputTokens: number;
  /** Model used for this request */
  model?: ModelId;
  /** Timestamp of the usage */
  timestamp?: number;
  /** Optional request identifier */
  requestId?: string;
}

/** Aggregated session statistics */
export interface SessionStats {
  /** Total input tokens used */
  totalInputTokens: number;
  /** Total output tokens used */
  totalOutputTokens: number;
  /** Combined total tokens */
  totalTokens: number;
  /** Total cost in USD */
  totalCost: number;
  /** Number of requests made */
  requestCount: number;
  /** Session start time */
  startTime: number;
  /** Last update time */
  lastUpdateTime: number;
  /** Breakdown by model */
  byModel: Map<ModelId, ModelStats>;
}

/** Per-model statistics */
export interface ModelStats {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  requestCount: number;
}

/** Display format options */
export interface DisplayOptions {
  /** Show token breakdown (input/output) */
  showBreakdown?: boolean;
  /** Currency symbol to use */
  currencySymbol?: string;
  /** Decimal places for cost */
  costDecimals?: number;
  /** Show model breakdown */
  showModelBreakdown?: boolean;
  /** Separator between tokens and cost */
  separator?: string;
}

/** Header display result */
export interface HeaderDisplay {
  /** Full formatted string (e.g., 'Tokens: 12.3K | Cost: $0.05') */
  text: string;
  /** Formatted token count */
  tokens: string;
  /** Formatted cost */
  cost: string;
  /** Raw values for custom formatting */
  raw: {
    totalTokens: number;
    totalCost: number;
    inputTokens: number;
    outputTokens: number;
  };
}

/** Usage history entry */
export interface UsageHistoryEntry extends TokenUsage {
  /** Calculated cost for this usage */
  cost: number;
  /** Cumulative total after this usage */
  cumulativeTokens: number;
  /** Cumulative cost after this usage */
  cumulativeCost: number;
}

/** Budget alert configuration */
export interface BudgetAlert {
  /** Alert identifier */
  id: string;
  /** Type of threshold */
  type: "tokens" | "cost";
  /** Threshold value */
  threshold: number;
  /** Whether this alert has been triggered */
  triggered: boolean;
  /** Callback when threshold is reached */
  callback?: (current: number, threshold: number) => void;
}

/** Change callback for stats updates */
export type StatsChangeCallback = (stats: SessionStats) => void;

// ============================================================================
// Constants
// ============================================================================

/** Default pricing per 1K tokens (USD) - as of early 2024 */
export const MODEL_PRICING: Record<ModelId, ModelPricing> = {
  "gpt-4": { inputPer1K: 0.03, outputPer1K: 0.06, displayName: "GPT-4" },
  "gpt-4-turbo": {
    inputPer1K: 0.01,
    outputPer1K: 0.03,
    displayName: "GPT-4 Turbo",
  },
  "gpt-4o": { inputPer1K: 0.005, outputPer1K: 0.015, displayName: "GPT-4o" },
  "gpt-4o-mini": {
    inputPer1K: 0.00015,
    outputPer1K: 0.0006,
    displayName: "GPT-4o Mini",
  },
  "gpt-3.5-turbo": {
    inputPer1K: 0.0005,
    outputPer1K: 0.0015,
    displayName: "GPT-3.5 Turbo",
  },
  "claude-3-opus": {
    inputPer1K: 0.015,
    outputPer1K: 0.075,
    displayName: "Claude 3 Opus",
  },
  "claude-3-sonnet": {
    inputPer1K: 0.003,
    outputPer1K: 0.015,
    displayName: "Claude 3 Sonnet",
  },
  "claude-3-haiku": {
    inputPer1K: 0.00025,
    outputPer1K: 0.00125,
    displayName: "Claude 3 Haiku",
  },
  "claude-3.5-sonnet": {
    inputPer1K: 0.003,
    outputPer1K: 0.015,
    displayName: "Claude 3.5 Sonnet",
  },
  "claude-3.5-haiku": {
    inputPer1K: 0.001,
    outputPer1K: 0.005,
    displayName: "Claude 3.5 Haiku",
  },
  custom: { inputPer1K: 0, outputPer1K: 0, displayName: "Custom" },
};

/** Default display options */
const DEFAULT_DISPLAY_OPTIONS: Required<DisplayOptions> = {
  showBreakdown: false,
  currencySymbol: "$",
  costDecimals: 2,
  showModelBreakdown: false,
  separator: " | ",
};

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format a number with K/M/B suffixes
 * @example formatTokenCount(12300) => '12.3K'
 * @example formatTokenCount(1500000) => '1.5M'
 */
export function formatTokenCount(count: number): string {
  if (count < 0) {
    return `-${formatTokenCount(Math.abs(count))}`;
  }

  if (count < 1000) {
    return count.toString();
  }

  if (count < 1_000_000) {
    const value = count / 1000;
    // Use at most 1 decimal place, remove trailing zeros
    const formatted = value.toFixed(1).replace(/\.0$/, "");
    return `${formatted}K`;
  }

  if (count < 1_000_000_000) {
    const value = count / 1_000_000;
    const formatted = value.toFixed(1).replace(/\.0$/, "");
    return `${formatted}M`;
  }

  const value = count / 1_000_000_000;
  const formatted = value.toFixed(1).replace(/\.0$/, "");
  return `${formatted}B`;
}

/**
 * Format cost as currency
 * @example formatCost(0.05) => '$0.05'
 * @example formatCost(1.234, { decimals: 3 }) => '$1.234'
 */
export function formatCost(
  cost: number,
  options: { currencySymbol?: string; decimals?: number } = {}
): string {
  const { currencySymbol = "$", decimals = 2 } = options;

  if (cost < 0) {
    return `-${currencySymbol}${Math.abs(cost).toFixed(decimals)}`;
  }

  return `${currencySymbol}${cost.toFixed(decimals)}`;
}

/**
 * Calculate cost for token usage
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  pricing: ModelPricing
): number {
  const inputCost = (inputTokens / 1000) * pricing.inputPer1K;
  const outputCost = (outputTokens / 1000) * pricing.outputPer1K;
  return inputCost + outputCost;
}

// ============================================================================
// TokenCostCounter Class
// ============================================================================

/**
 * Token and cost counter for tracking session usage
 */
export class TokenCostCounter {
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private totalCost = 0;
  private requestCount = 0;
  private startTime: number;
  private lastUpdateTime: number;
  private byModel: Map<ModelId, ModelStats> = new Map();
  private history: UsageHistoryEntry[] = [];
  private budgetAlerts: Map<string, BudgetAlert> = new Map();
  private callbacks: Set<StatsChangeCallback> = new Set();
  private disposed = false;
  private defaultModel: ModelId;
  private customPricing: Map<ModelId, ModelPricing> = new Map();
  private maxHistorySize: number;

  constructor(
    options: {
      defaultModel?: ModelId;
      customPricing?: Record<string, ModelPricing>;
      maxHistorySize?: number;
    } = {}
  ) {
    this.defaultModel = options.defaultModel ?? "gpt-4o";
    this.maxHistorySize = options.maxHistorySize ?? 1000;
    this.startTime = Date.now();
    this.lastUpdateTime = this.startTime;

    // Apply custom pricing
    if (options.customPricing) {
      for (const [model, pricing] of Object.entries(options.customPricing)) {
        this.customPricing.set(model as ModelId, pricing);
      }
    }
  }

  /**
   * Track token usage
   */
  track(usage: TokenUsage): void {
    if (this.disposed) {
      throw new Error("TokenCostCounter is disposed");
    }

    const model = usage.model ?? this.defaultModel;
    const pricing = this.getPricing(model);
    const cost = calculateCost(usage.inputTokens, usage.outputTokens, pricing);

    // Update totals
    this.totalInputTokens += usage.inputTokens;
    this.totalOutputTokens += usage.outputTokens;
    this.totalCost += cost;
    this.requestCount++;
    this.lastUpdateTime = Date.now();

    // Update per-model stats
    const modelStats = this.byModel.get(model) ?? {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cost: 0,
      requestCount: 0,
    };
    modelStats.inputTokens += usage.inputTokens;
    modelStats.outputTokens += usage.outputTokens;
    modelStats.totalTokens += usage.inputTokens + usage.outputTokens;
    modelStats.cost += cost;
    modelStats.requestCount++;
    this.byModel.set(model, modelStats);

    // Add to history
    const historyEntry: UsageHistoryEntry = {
      ...usage,
      model,
      timestamp: usage.timestamp ?? Date.now(),
      cost,
      cumulativeTokens: this.totalInputTokens + this.totalOutputTokens,
      cumulativeCost: this.totalCost,
    };
    this.history.push(historyEntry);

    // Trim history if needed
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }

    // Check budget alerts
    this.checkBudgetAlerts();

    // Notify callbacks
    this.notifyChange();
  }

  /**
   * Get pricing for a model
   */
  private getPricing(model: ModelId): ModelPricing {
    return this.customPricing.get(model) ?? MODEL_PRICING[model];
  }

  /**
   * Get current session statistics
   */
  getStats(): SessionStats {
    return {
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      totalTokens: this.totalInputTokens + this.totalOutputTokens,
      totalCost: this.totalCost,
      requestCount: this.requestCount,
      startTime: this.startTime,
      lastUpdateTime: this.lastUpdateTime,
      byModel: new Map(this.byModel),
    };
  }

  /**
   * Get formatted header display
   * @example getHeaderDisplay() => { text: 'Tokens: 12.3K | Cost: $0.05', ... }
   */
  getHeaderDisplay(options: DisplayOptions = {}): HeaderDisplay {
    const opts = { ...DEFAULT_DISPLAY_OPTIONS, ...options };
    const totalTokens = this.totalInputTokens + this.totalOutputTokens;

    let tokensStr: string;
    if (opts.showBreakdown) {
      tokensStr = `${formatTokenCount(this.totalInputTokens)}↓ ${formatTokenCount(this.totalOutputTokens)}↑`;
    } else {
      tokensStr = formatTokenCount(totalTokens);
    }

    const costStr = formatCost(this.totalCost, {
      currencySymbol: opts.currencySymbol,
      decimals: opts.costDecimals,
    });

    const text = `Tokens: ${tokensStr}${opts.separator}Cost: ${costStr}`;

    return {
      text,
      tokens: tokensStr,
      cost: costStr,
      raw: {
        totalTokens,
        totalCost: this.totalCost,
        inputTokens: this.totalInputTokens,
        outputTokens: this.totalOutputTokens,
      },
    };
  }

  /**
   * Get usage history
   */
  getHistory(): UsageHistoryEntry[] {
    return [...this.history];
  }

  /**
   * Add a budget alert
   */
  addBudgetAlert(
    id: string,
    type: "tokens" | "cost",
    threshold: number,
    callback?: (current: number, threshold: number) => void
  ): void {
    if (this.disposed) {
      throw new Error("TokenCostCounter is disposed");
    }

    this.budgetAlerts.set(id, {
      id,
      type,
      threshold,
      triggered: false,
      callback,
    });

    // Check immediately in case already over threshold
    this.checkBudgetAlerts();
  }

  /**
   * Remove a budget alert
   */
  removeBudgetAlert(id: string): boolean {
    return this.budgetAlerts.delete(id);
  }

  /**
   * Check and trigger budget alerts
   */
  private checkBudgetAlerts(): void {
    const totalTokens = this.totalInputTokens + this.totalOutputTokens;

    for (const alert of this.budgetAlerts.values()) {
      if (alert.triggered) continue;

      const current = alert.type === "tokens" ? totalTokens : this.totalCost;

      if (current >= alert.threshold) {
        alert.triggered = true;
        if (alert.callback) {
          try {
            alert.callback(current, alert.threshold);
          } catch (err) {
            console.error("Budget alert callback error:", err);
          }
        }
      }
    }
  }

  /**
   * Reset budget alert triggered state
   */
  resetBudgetAlert(id: string): boolean {
    const alert = this.budgetAlerts.get(id);
    if (alert) {
      alert.triggered = false;
      return true;
    }
    return false;
  }

  /**
   * Subscribe to stats changes
   */
  subscribe(callback: StatsChangeCallback): () => void {
    if (this.disposed) {
      throw new Error("TokenCostCounter is disposed");
    }

    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Notify callbacks of changes
   */
  private notifyChange(): void {
    const stats = this.getStats();
    for (const callback of this.callbacks) {
      try {
        callback(stats);
      } catch (err) {
        console.error("TokenCostCounter callback error:", err);
      }
    }
  }

  /**
   * Set custom pricing for a model
   */
  setCustomPricing(model: ModelId, pricing: ModelPricing): void {
    if (this.disposed) {
      throw new Error("TokenCostCounter is disposed");
    }
    this.customPricing.set(model, pricing);
  }

  /**
   * Get pricing for all models
   */
  getAllPricing(): Record<ModelId, ModelPricing> {
    const result = { ...MODEL_PRICING };
    for (const [model, pricing] of this.customPricing) {
      result[model] = pricing;
    }
    return result;
  }

  /**
   * Reset the counter
   */
  reset(): void {
    if (this.disposed) {
      throw new Error("TokenCostCounter is disposed");
    }

    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.totalCost = 0;
    this.requestCount = 0;
    this.startTime = Date.now();
    this.lastUpdateTime = this.startTime;
    this.byModel.clear();
    this.history = [];

    // Reset all budget alerts
    for (const alert of this.budgetAlerts.values()) {
      alert.triggered = false;
    }

    this.notifyChange();
  }

  /**
   * Check if the counter is disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose the counter
   */
  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.callbacks.clear();
    this.budgetAlerts.clear();
    this.history = [];
    this.byModel.clear();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new TokenCostCounter instance
 */
export function createTokenCostCounter(options?: {
  defaultModel?: ModelId;
  customPricing?: Record<string, ModelPricing>;
  maxHistorySize?: number;
}): TokenCostCounter {
  return new TokenCostCounter(options);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Estimate tokens from text (rough approximation)
 * Rule of thumb: ~4 characters per token for English
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Format session duration
 */
export function formatSessionDuration(startTime: number): string {
  const duration = Date.now() - startTime;
  const seconds = Math.floor(duration / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Calculate cost per token (average)
 */
export function calculateCostPerToken(stats: SessionStats): number {
  if (stats.totalTokens === 0) return 0;
  return stats.totalCost / stats.totalTokens;
}

/**
 * Generate a summary string for the session
 */
export function generateSessionSummary(stats: SessionStats): string {
  const duration = formatSessionDuration(stats.startTime);
  const tokens = formatTokenCount(stats.totalTokens);
  const cost = formatCost(stats.totalCost);
  const requests = stats.requestCount;

  return `Session: ${duration} | ${requests} requests | ${tokens} tokens | ${cost}`;
}
