/**
 * Rate Limiter & Cost Tracker
 *
 * Token-based rate limiting for AI API calls with budget alerts
 * at 50%, 80%, and 100% thresholds.
 */

// =============================================================================
// Types
// =============================================================================

export interface RateLimitConfig {
  /** Max requests per minute */
  maxRequestsPerMinute: number;
  /** Max tokens per minute */
  maxTokensPerMinute: number;
  /** Max tokens per single request (prevents single-request exhaustion) */
  maxTokensPerRequest: number;
  /** Session token budget (total allowed) */
  sessionTokenBudget: number;
  /** Cost per 1K prompt tokens (USD) */
  promptCostPer1K: number;
  /** Cost per 1K completion tokens (USD) */
  completionCostPer1K: number;
  /** Budget alert thresholds (fractions, e.g. [0.5, 0.8, 1.0]) */
  alertThresholds: number[];
}

export const DEFAULT_RATE_CONFIG: RateLimitConfig = {
  maxRequestsPerMinute: 30,
  maxTokensPerMinute: 100000,
  maxTokensPerRequest: 10000,
  sessionTokenBudget: 1000000,
  promptCostPer1K: 0.003,
  completionCostPer1K: 0.015,
  alertThresholds: [0.5, 0.8, 1.0],
};

export interface ApiCall {
  /** Unique call ID */
  id: string;
  /** Timestamp (ms since epoch) */
  timestamp: number;
  /** Prompt tokens used */
  promptTokens: number;
  /** Completion tokens used */
  completionTokens: number;
  /** Model name */
  model: string;
}

export interface BudgetAlert {
  /** Threshold that was crossed (e.g. 0.5, 0.8, 1.0) */
  threshold: number;
  /** Label (e.g. "50%", "80%", "100%") */
  label: string;
  /** Current usage at time of alert */
  currentUsage: number;
  /** Budget limit */
  budgetLimit: number;
  /** Timestamp */
  timestamp: number;
}

export interface CostBreakdown {
  /** Total prompt tokens */
  promptTokens: number;
  /** Total completion tokens */
  completionTokens: number;
  /** Total tokens */
  totalTokens: number;
  /** Prompt cost (USD) */
  promptCost: number;
  /** Completion cost (USD) */
  completionCost: number;
  /** Total cost (USD) */
  totalCost: number;
}

export interface RateLimitState {
  /** All recorded API calls */
  calls: ApiCall[];
  /** Config */
  config: RateLimitConfig;
  /** Fired alerts (threshold values) */
  firedAlerts: Set<number>;
  /** Alert history */
  alerts: BudgetAlert[];
  /** Call counter for ID generation */
  callCounter: number;
}

export type RateLimitDecision = {
  allowed: boolean;
  reason?: string;
  retryAfterMs?: number;
};

// =============================================================================
// State Management
// =============================================================================

/** Creates a new rate limit state. */
export function createRateLimitState(config: Partial<RateLimitConfig> = {}): RateLimitState {
  return {
    calls: [],
    config: { ...DEFAULT_RATE_CONFIG, ...config },
    firedAlerts: new Set(),
    alerts: [],
    callCounter: 0,
  };
}

// =============================================================================
// Rate Limiting
// =============================================================================

/**
 * Returns API calls within the last N milliseconds.
 */
export function getCallsInWindow(state: RateLimitState, windowMs: number, now: number): ApiCall[] {
  const cutoff = now - windowMs;
  return state.calls.filter((c) => c.timestamp >= cutoff);
}

/**
 * Checks if a new API call is allowed under rate limits.
 */
export function checkRateLimit(
  state: RateLimitState,
  estimatedTokens: number,
  now: number = Date.now(),
): RateLimitDecision {
  const { config } = state;

  // Check per-request token limit
  if (estimatedTokens > config.maxTokensPerRequest) {
    return {
      allowed: false,
      reason: `Per-request limit: ${estimatedTokens} tokens exceeds max ${config.maxTokensPerRequest} per request`,
    };
  }

  const oneMinuteMs = 60_000;
  const recentCalls = getCallsInWindow(state, oneMinuteMs, now);

  // Check requests per minute
  if (recentCalls.length >= config.maxRequestsPerMinute) {
    const oldest = recentCalls[0];
    const retryAfterMs = oldest.timestamp + oneMinuteMs - now;
    return {
      allowed: false,
      reason: `Rate limit: ${config.maxRequestsPerMinute} requests/min exceeded`,
      retryAfterMs: Math.max(0, retryAfterMs),
    };
  }

  // Check tokens per minute
  const recentTokens = recentCalls.reduce(
    (sum, c) => sum + c.promptTokens + c.completionTokens,
    0,
  );
  if (recentTokens + estimatedTokens > config.maxTokensPerMinute) {
    const oldest = recentCalls[0];
    const retryAfterMs = oldest ? oldest.timestamp + oneMinuteMs - now : oneMinuteMs;
    return {
      allowed: false,
      reason: `Token limit: ${config.maxTokensPerMinute} tokens/min exceeded`,
      retryAfterMs: Math.max(0, retryAfterMs),
    };
  }

  // Check session budget
  const totalTokens = getTotalTokens(state);
  if (totalTokens + estimatedTokens > config.sessionTokenBudget) {
    return {
      allowed: false,
      reason: `Session budget exhausted: ${totalTokens}/${config.sessionTokenBudget} tokens used`,
    };
  }

  return { allowed: true };
}

// =============================================================================
// Call Recording
// =============================================================================

/**
 * Records an API call and checks for budget alerts.
 */
export function recordApiCall(
  state: RateLimitState,
  promptTokens: number,
  completionTokens: number,
  model: string = "default",
  timestamp: number = Date.now(),
): { state: RateLimitState; newAlerts: BudgetAlert[] } {
  const nextCounter = state.callCounter + 1;
  const call: ApiCall = {
    id: `call_${nextCounter}`,
    timestamp,
    promptTokens,
    completionTokens,
    model,
  };

  const calls = [...state.calls, call];
  const totalTokens = calls.reduce((s, c) => s + c.promptTokens + c.completionTokens, 0);
  const budget = state.config.sessionTokenBudget;

  // Check alert thresholds
  const newAlerts: BudgetAlert[] = [];
  const firedAlerts = new Set(state.firedAlerts);

  for (const threshold of state.config.alertThresholds) {
    if (!firedAlerts.has(threshold) && totalTokens >= budget * threshold) {
      const alert: BudgetAlert = {
        threshold,
        label: `${Math.round(threshold * 100)}%`,
        currentUsage: totalTokens,
        budgetLimit: budget,
        timestamp,
      };
      newAlerts.push(alert);
      firedAlerts.add(threshold);
    }
  }

  return {
    state: {
      ...state,
      calls,
      firedAlerts,
      alerts: [...state.alerts, ...newAlerts],
      callCounter: nextCounter,
    },
    newAlerts,
  };
}

// =============================================================================
// Cost Tracking
// =============================================================================

/** Computes total tokens used in session. */
export function getTotalTokens(state: RateLimitState): number {
  return state.calls.reduce((s, c) => s + c.promptTokens + c.completionTokens, 0);
}

/** Computes cost breakdown for all recorded calls. */
export function getCostBreakdown(state: RateLimitState): CostBreakdown {
  let promptTokens = 0;
  let completionTokens = 0;
  for (const call of state.calls) {
    promptTokens += call.promptTokens;
    completionTokens += call.completionTokens;
  }
  const promptCost = (promptTokens / 1000) * state.config.promptCostPer1K;
  const completionCost = (completionTokens / 1000) * state.config.completionCostPer1K;
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    promptCost,
    completionCost,
    totalCost: promptCost + completionCost,
  };
}

/** Returns budget utilization as a fraction (0-1+). */
export function getBudgetUtilization(state: RateLimitState): number {
  const total = getTotalTokens(state);
  return state.config.sessionTokenBudget > 0
    ? total / state.config.sessionTokenBudget
    : 0;
}

/** Returns remaining token budget. */
export function getRemainingBudget(state: RateLimitState): number {
  return Math.max(0, state.config.sessionTokenBudget - getTotalTokens(state));
}

/** Returns all fired alerts. */
export function getAlerts(state: RateLimitState): BudgetAlert[] {
  return state.alerts;
}

/** Resets rate limit windows (keeps budget tracking). */
export function resetRateWindows(state: RateLimitState, now: number = Date.now()): RateLimitState {
  const oneMinuteMs = 60_000;
  return {
    ...state,
    calls: state.calls.filter((c) => c.timestamp >= now - oneMinuteMs),
  };
}
