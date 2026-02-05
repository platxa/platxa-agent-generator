/**
 * Model Fallback Chain
 *
 * Implements resilient model execution with automatic fallback when
 * the primary model is unavailable due to errors, rate limits, or timeouts.
 *
 * Features:
 * - Configurable fallback chain per task type
 * - Automatic retry with exponential backoff
 * - Rate limit detection and handling
 * - Timeout management
 * - Circuit breaker pattern for failing models
 * - Health monitoring and recovery
 * - Execution metrics and logging
 *
 * Feature #40: Multi-Model Orchestration - Model fallback chain
 */

// =============================================================================
// Types
// =============================================================================

/** Model identifier */
export type ModelId = string;

/** Error types that trigger fallback */
export type FallbackTrigger =
  | "api_error"
  | "rate_limit"
  | "timeout"
  | "auth_error"
  | "model_unavailable"
  | "context_length_exceeded"
  | "content_filter"
  | "unknown";

/** Model health status */
export type ModelHealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

/** Execution result */
export interface ExecutionResult<T> {
  success: boolean;
  data?: T;
  error?: ExecutionError;
  modelUsed: ModelId;
  attemptCount: number;
  totalLatencyMs: number;
  fallbacksUsed: ModelId[];
}

/** Execution error details */
export interface ExecutionError {
  type: FallbackTrigger;
  message: string;
  statusCode?: number;
  retryAfterMs?: number;
  modelId: ModelId;
}

/** Model configuration in the chain */
export interface ChainedModel {
  id: ModelId;
  priority: number;
  maxRetries: number;
  timeoutMs: number;
  retryDelayMs: number;
  maxRetryDelayMs: number;
  enabled: boolean;
}

/** Circuit breaker state */
export interface CircuitBreakerState {
  modelId: ModelId;
  status: "closed" | "open" | "half-open";
  failureCount: number;
  lastFailureTime: number;
  nextRetryTime: number;
  successCount: number;
}

/** Model health metrics */
export interface ModelHealthMetrics {
  modelId: ModelId;
  status: ModelHealthStatus;
  successRate: number;
  avgLatencyMs: number;
  totalRequests: number;
  failedRequests: number;
  lastSuccessTime: number | null;
  lastErrorTime: number | null;
  lastError: string | null;
  circuitBreaker: CircuitBreakerState;
}

/** Fallback chain configuration */
export interface FallbackChainConfig {
  /** Ordered list of models to try */
  models: ChainedModel[];
  /** Global timeout for entire chain execution */
  globalTimeoutMs: number;
  /** Whether to enable circuit breaker */
  enableCircuitBreaker: boolean;
  /** Number of failures before opening circuit */
  circuitBreakerThreshold: number;
  /** Time to wait before trying half-open state */
  circuitBreakerResetMs: number;
  /** Callback for logging/monitoring */
  onAttempt?: (modelId: ModelId, attempt: number) => void;
  /** Callback when fallback occurs */
  onFallback?: (fromModel: ModelId, toModel: ModelId, error: ExecutionError) => void;
  /** Callback when execution completes */
  onComplete?: (result: ExecutionResult<unknown>) => void;
}

/** Model executor function type */
export type ModelExecutor<T> = (modelId: ModelId, signal: AbortSignal) => Promise<T>;

// =============================================================================
// Error Classification
// =============================================================================

/** HTTP status codes that indicate rate limiting */
const RATE_LIMIT_STATUS_CODES = [429, 503];

/** HTTP status codes that indicate auth errors */
const AUTH_ERROR_STATUS_CODES = [401, 403];

/** HTTP status codes that indicate model unavailable */
const UNAVAILABLE_STATUS_CODES = [500, 502, 503, 504];

/**
 * Classify an error to determine fallback trigger type
 */
export function classifyError(error: unknown): FallbackTrigger {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Check for specific error types
    if (message.includes("rate limit") || message.includes("too many requests")) {
      return "rate_limit";
    }
    if (message.includes("timeout") || message.includes("timed out")) {
      return "timeout";
    }
    if (message.includes("unauthorized") || message.includes("authentication")) {
      return "auth_error";
    }
    if (message.includes("context length") || message.includes("too long")) {
      return "context_length_exceeded";
    }
    if (message.includes("content filter") || message.includes("blocked")) {
      return "content_filter";
    }
    if (message.includes("model") && message.includes("unavailable")) {
      return "model_unavailable";
    }

    // Check for HTTP status codes in error
    const statusMatch = message.match(/status[:\s]+(\d{3})/i);
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10);
      if (RATE_LIMIT_STATUS_CODES.includes(status)) return "rate_limit";
      if (AUTH_ERROR_STATUS_CODES.includes(status)) return "auth_error";
      if (UNAVAILABLE_STATUS_CODES.includes(status)) return "model_unavailable";
    }

    return "api_error";
  }

  return "unknown";
}

/**
 * Extract retry-after time from error if available
 */
export function extractRetryAfter(error: unknown): number | undefined {
  if (error instanceof Error) {
    const message = error.message;

    // Look for retry-after in message
    const retryMatch = message.match(/retry[- ]?after[:\s]+(\d+)/i);
    if (retryMatch) {
      return parseInt(retryMatch[1], 10) * 1000; // Convert to ms
    }
  }

  return undefined;
}

/**
 * Determine if an error should trigger fallback
 */
export function shouldFallback(trigger: FallbackTrigger): boolean {
  // Don't fallback for auth errors (likely configuration issue)
  // Don't fallback for content filter (content issue, not model issue)
  const noFallbackTriggers: FallbackTrigger[] = ["auth_error", "content_filter"];
  return !noFallbackTriggers.includes(trigger);
}

// =============================================================================
// Circuit Breaker
// =============================================================================

/**
 * Create initial circuit breaker state
 */
function createCircuitBreakerState(modelId: ModelId): CircuitBreakerState {
  return {
    modelId,
    status: "closed",
    failureCount: 0,
    lastFailureTime: 0,
    nextRetryTime: 0,
    successCount: 0,
  };
}

/**
 * Check if circuit breaker allows execution
 */
function canExecute(state: CircuitBreakerState): boolean {
  if (state.status === "closed") return true;
  if (state.status === "open") {
    return Date.now() >= state.nextRetryTime;
  }
  // half-open: allow one request
  return true;
}

/**
 * Record a successful execution
 */
function recordSuccess(state: CircuitBreakerState): CircuitBreakerState {
  if (state.status === "half-open") {
    return {
      ...state,
      status: "closed",
      failureCount: 0,
      successCount: state.successCount + 1,
    };
  }
  return {
    ...state,
    successCount: state.successCount + 1,
  };
}

/**
 * Record a failed execution
 */
function recordFailure(
  state: CircuitBreakerState,
  threshold: number,
  resetMs: number
): CircuitBreakerState {
  const newFailureCount = state.failureCount + 1;

  if (state.status === "half-open" || newFailureCount >= threshold) {
    return {
      ...state,
      status: "open",
      failureCount: newFailureCount,
      lastFailureTime: Date.now(),
      nextRetryTime: Date.now() + resetMs,
    };
  }

  return {
    ...state,
    failureCount: newFailureCount,
    lastFailureTime: Date.now(),
  };
}

// =============================================================================
// Model Health Manager
// =============================================================================

/**
 * Manages health metrics for multiple models
 */
export class ModelHealthManager {
  private metrics: Map<ModelId, ModelHealthMetrics> = new Map();
  private circuitBreakerThreshold: number;
  private circuitBreakerResetMs: number;

  constructor(threshold = 5, resetMs = 60000) {
    this.circuitBreakerThreshold = threshold;
    this.circuitBreakerResetMs = resetMs;
  }

  /**
   * Get or create metrics for a model
   */
  getMetrics(modelId: ModelId): ModelHealthMetrics {
    if (!this.metrics.has(modelId)) {
      this.metrics.set(modelId, {
        modelId,
        status: "unknown",
        successRate: 1,
        avgLatencyMs: 0,
        totalRequests: 0,
        failedRequests: 0,
        lastSuccessTime: null,
        lastErrorTime: null,
        lastError: null,
        circuitBreaker: createCircuitBreakerState(modelId),
      });
    }
    return this.metrics.get(modelId)!;
  }

  /**
   * Record a successful request
   */
  recordSuccess(modelId: ModelId, latencyMs: number): void {
    const metrics = this.getMetrics(modelId);
    const newTotal = metrics.totalRequests + 1;
    const successCount = newTotal - metrics.failedRequests;

    this.metrics.set(modelId, {
      ...metrics,
      totalRequests: newTotal,
      avgLatencyMs:
        (metrics.avgLatencyMs * metrics.totalRequests + latencyMs) / newTotal,
      successRate: successCount / newTotal,
      lastSuccessTime: Date.now(),
      status: this.calculateStatus(successCount / newTotal),
      circuitBreaker: recordSuccess(metrics.circuitBreaker),
    });
  }

  /**
   * Record a failed request
   */
  recordFailure(modelId: ModelId, error: string): void {
    const metrics = this.getMetrics(modelId);
    const newTotal = metrics.totalRequests + 1;
    const newFailed = metrics.failedRequests + 1;
    const successRate = (newTotal - newFailed) / newTotal;

    this.metrics.set(modelId, {
      ...metrics,
      totalRequests: newTotal,
      failedRequests: newFailed,
      successRate,
      lastErrorTime: Date.now(),
      lastError: error,
      status: this.calculateStatus(successRate),
      circuitBreaker: recordFailure(
        metrics.circuitBreaker,
        this.circuitBreakerThreshold,
        this.circuitBreakerResetMs
      ),
    });
  }

  /**
   * Check if model is available (circuit breaker allows)
   */
  isAvailable(modelId: ModelId): boolean {
    const metrics = this.getMetrics(modelId);
    return canExecute(metrics.circuitBreaker);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): ModelHealthMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Calculate health status from success rate
   */
  private calculateStatus(successRate: number): ModelHealthStatus {
    if (successRate >= 0.95) return "healthy";
    if (successRate >= 0.8) return "degraded";
    if (successRate >= 0) return "unhealthy";
    return "unknown";
  }

  /**
   * Reset metrics for a model
   */
  reset(modelId: ModelId): void {
    this.metrics.delete(modelId);
  }

  /**
   * Reset all metrics
   */
  resetAll(): void {
    this.metrics.clear();
  }
}

// =============================================================================
// Fallback Chain Executor
// =============================================================================

/**
 * Execute a model with timeout
 */
async function executeWithTimeout<T>(
  executor: ModelExecutor<T>,
  modelId: ModelId,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await executor(modelId, controller.signal);
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Sleep for a duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate retry delay with exponential backoff
 */
function calculateRetryDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  retryAfterMs?: number
): number {
  if (retryAfterMs) {
    return Math.min(retryAfterMs, maxDelayMs);
  }

  const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 0.3 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

/**
 * Main fallback chain executor
 */
export class FallbackChainExecutor {
  private config: FallbackChainConfig;
  private healthManager: ModelHealthManager;

  constructor(config: FallbackChainConfig) {
    this.config = config;
    this.healthManager = new ModelHealthManager(
      config.circuitBreakerThreshold,
      config.circuitBreakerResetMs
    );
  }

  /**
   * Execute with fallback chain
   */
  async execute<T>(executor: ModelExecutor<T>): Promise<ExecutionResult<T>> {
    const startTime = Date.now();
    const fallbacksUsed: ModelId[] = [];
    let totalAttempts = 0;

    // Filter and sort models by priority
    const availableModels = this.config.models
      .filter((m) => m.enabled && this.healthManager.isAvailable(m.id))
      .sort((a, b) => a.priority - b.priority);

    if (availableModels.length === 0) {
      return {
        success: false,
        error: {
          type: "model_unavailable",
          message: "No models available in fallback chain",
          modelId: "none",
        },
        modelUsed: "none",
        attemptCount: 0,
        totalLatencyMs: Date.now() - startTime,
        fallbacksUsed: [],
      };
    }

    let lastError: ExecutionError | undefined;

    for (let modelIndex = 0; modelIndex < availableModels.length; modelIndex++) {
      const model = availableModels[modelIndex];

      // Check global timeout
      if (Date.now() - startTime >= this.config.globalTimeoutMs) {
        return {
          success: false,
          error: {
            type: "timeout",
            message: "Global timeout exceeded",
            modelId: model.id,
          },
          modelUsed: model.id,
          attemptCount: totalAttempts,
          totalLatencyMs: Date.now() - startTime,
          fallbacksUsed,
        };
      }

      // Try this model with retries
      for (let attempt = 1; attempt <= model.maxRetries; attempt++) {
        totalAttempts++;
        const attemptStart = Date.now();

        this.config.onAttempt?.(model.id, attempt);

        try {
          const result = await executeWithTimeout(executor, model.id, model.timeoutMs);

          // Success!
          const latency = Date.now() - attemptStart;
          this.healthManager.recordSuccess(model.id, latency);

          const executionResult: ExecutionResult<T> = {
            success: true,
            data: result,
            modelUsed: model.id,
            attemptCount: totalAttempts,
            totalLatencyMs: Date.now() - startTime,
            fallbacksUsed,
          };

          this.config.onComplete?.(executionResult);
          return executionResult;
        } catch (error) {
          const errorType = classifyError(error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          const retryAfterMs = extractRetryAfter(error);

          this.healthManager.recordFailure(model.id, errorMessage);

          lastError = {
            type: errorType,
            message: errorMessage,
            retryAfterMs,
            modelId: model.id,
          };

          // Check if we should retry with this model
          if (attempt < model.maxRetries && shouldFallback(errorType)) {
            const delay = calculateRetryDelay(
              attempt,
              model.retryDelayMs,
              model.maxRetryDelayMs,
              retryAfterMs
            );
            await sleep(delay);
            continue;
          }

          // Move to next model if available
          if (modelIndex < availableModels.length - 1 && shouldFallback(errorType)) {
            const nextModel = availableModels[modelIndex + 1];
            fallbacksUsed.push(model.id);
            this.config.onFallback?.(model.id, nextModel.id, lastError);
          }

          break; // Exit retry loop for this model
        }
      }
    }

    // All models exhausted
    const executionResult: ExecutionResult<T> = {
      success: false,
      error: lastError,
      modelUsed: lastError?.modelId || "none",
      attemptCount: totalAttempts,
      totalLatencyMs: Date.now() - startTime,
      fallbacksUsed,
    };

    this.config.onComplete?.(executionResult);
    return executionResult;
  }

  /**
   * Get health metrics for all models
   */
  getHealthMetrics(): ModelHealthMetrics[] {
    return this.healthManager.getAllMetrics();
  }

  /**
   * Check if a specific model is available
   */
  isModelAvailable(modelId: ModelId): boolean {
    return this.healthManager.isAvailable(modelId);
  }

  /**
   * Reset health metrics
   */
  resetMetrics(modelId?: ModelId): void {
    if (modelId) {
      this.healthManager.reset(modelId);
    } else {
      this.healthManager.resetAll();
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a default fallback chain configuration
 */
export function createDefaultChainConfig(
  models: { id: ModelId; priority?: number }[]
): FallbackChainConfig {
  return {
    models: models.map((m, index) => ({
      id: m.id,
      priority: m.priority ?? index,
      maxRetries: 3,
      timeoutMs: 30000,
      retryDelayMs: 1000,
      maxRetryDelayMs: 30000,
      enabled: true,
    })),
    globalTimeoutMs: 120000,
    enableCircuitBreaker: true,
    circuitBreakerThreshold: 5,
    circuitBreakerResetMs: 60000,
  };
}

/**
 * Create a fallback chain executor with default config
 */
export function createFallbackChain(
  models: { id: ModelId; priority?: number }[],
  overrides?: Partial<FallbackChainConfig>
): FallbackChainExecutor {
  const config = {
    ...createDefaultChainConfig(models),
    ...overrides,
  };
  return new FallbackChainExecutor(config);
}

// =============================================================================
// Utility Exports
// =============================================================================

export {
  createCircuitBreakerState,
  canExecute,
  recordSuccess,
  recordFailure,
  executeWithTimeout,
  sleep,
  calculateRetryDelay,
};
