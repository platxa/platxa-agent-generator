/**
 * Exponential Backoff Strategy for Repeated Failures
 *
 * Feature #153: Create exponential backoff strategy for repeated failures
 * Verification: Delays: 0s, 1s, 3s between retry attempts
 *
 * Implements exponential backoff with configurable base delay, multiplier,
 * max delay, and jitter for retry operations.
 */

// ============================================================================
// Types
// ============================================================================

/** Backoff strategy type */
export type BackoffType = "exponential" | "linear" | "fixed" | "custom";

/** Retry attempt result */
export type AttemptResult = "success" | "failure" | "abort";

/** Retry state */
export interface RetryState {
  /** Current attempt number (0-based) */
  attempt: number;
  /** Total failures so far */
  failures: number;
  /** Delay before next attempt (ms) */
  nextDelay: number;
  /** Delay used for current attempt (ms) */
  currentDelay: number;
  /** Whether more retries are allowed */
  canRetry: boolean;
  /** Time of last attempt */
  lastAttemptTime: number;
  /** Total elapsed time (ms) */
  elapsedTime: number;
  /** History of delays used */
  delayHistory: number[];
}

/** Retry result */
export interface RetryResult<T> {
  /** Whether the operation succeeded */
  success: boolean;
  /** Result value (if successful) */
  value?: T;
  /** Error (if failed) */
  error?: Error;
  /** Final retry state */
  state: RetryState;
  /** Total attempts made */
  attempts: number;
  /** Total time spent (ms) */
  totalTime: number;
}

/** Backoff configuration */
export interface BackoffConfig {
  /** Backoff strategy type */
  type?: BackoffType;
  /** Base delay in milliseconds */
  baseDelay?: number;
  /** Multiplier for exponential backoff */
  multiplier?: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Maximum number of retries (not including first attempt) */
  maxRetries?: number;
  /** Whether to add random jitter */
  jitter?: boolean;
  /** Jitter factor (0-1, percentage of delay) */
  jitterFactor?: number;
  /** Whether first attempt has delay */
  delayFirstAttempt?: boolean;
  /** Custom delay sequence (for custom type) */
  customDelays?: number[];
  /** Reset delay after success */
  resetOnSuccess?: boolean;
}

/** Retry options */
export interface RetryOptions<T> extends BackoffConfig {
  /** Function to determine if error is retryable */
  isRetryable?: (error: Error) => boolean;
  /** Callback before each retry */
  onRetry?: (state: RetryState, error: Error) => void | Promise<void>;
  /** Callback on success */
  onSuccess?: (value: T, state: RetryState) => void;
  /** Callback on final failure */
  onFailure?: (error: Error, state: RetryState) => void;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default configuration matching verification: 0s, 1s, 3s delays
 * - First attempt: immediate (0s)
 * - Second attempt: 1s delay
 * - Third attempt: 3s delay
 */
export const DEFAULT_CONFIG: Required<BackoffConfig> = {
  type: "exponential",
  baseDelay: 1000, // 1 second
  multiplier: 3,   // 1s -> 3s -> 9s progression
  maxDelay: 30000, // 30 seconds max
  maxRetries: 5,
  jitter: false,
  jitterFactor: 0.1,
  delayFirstAttempt: false, // First attempt is immediate (0s)
  customDelays: [],
  resetOnSuccess: true,
};

/**
 * Predefined delay sequences for common patterns
 */
export const DELAY_SEQUENCES = {
  /** Verification pattern: 0s, 1s, 3s */
  verification: [0, 1000, 3000, 9000, 27000],
  /** Aggressive: quick retries */
  aggressive: [0, 100, 200, 400, 800],
  /** Conservative: slow retries */
  conservative: [0, 2000, 5000, 10000, 30000],
  /** Linear: fixed increments */
  linear: [0, 1000, 2000, 3000, 4000],
  /** Fixed: same delay every time */
  fixed: [0, 1000, 1000, 1000, 1000],
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate delay for a given attempt using exponential backoff
 *
 * For the verification pattern (0s, 1s, 3s):
 * - Attempt 0: 0ms (no delay for first attempt)
 * - Attempt 1: 1000ms (base delay)
 * - Attempt 2: 3000ms (base * multiplier)
 * - Attempt 3: 9000ms (base * multiplier^2)
 */
export function calculateDelay(attempt: number, config: BackoffConfig = {}): number {
  const {
    type = DEFAULT_CONFIG.type,
    baseDelay = DEFAULT_CONFIG.baseDelay,
    multiplier = DEFAULT_CONFIG.multiplier,
    maxDelay = DEFAULT_CONFIG.maxDelay,
    delayFirstAttempt = DEFAULT_CONFIG.delayFirstAttempt,
    customDelays = DEFAULT_CONFIG.customDelays,
  } = config;

  // First attempt has no delay unless configured otherwise
  if (attempt === 0) {
    return delayFirstAttempt ? baseDelay : 0;
  }

  let delay: number;

  switch (type) {
    case "exponential":
      // For attempt n (n >= 1): delay = baseDelay * multiplier^(n-1)
      // This gives us: 1000, 3000, 9000, ... for base=1000, multiplier=3
      delay = baseDelay * Math.pow(multiplier, attempt - 1);
      break;

    case "linear":
      // Linear growth: baseDelay * attempt
      delay = baseDelay * attempt;
      break;

    case "fixed":
      // Same delay every time
      delay = baseDelay;
      break;

    case "custom":
      // Use custom sequence or fall back to base delay
      delay = customDelays[attempt] ?? baseDelay;
      break;

    default:
      delay = baseDelay;
  }

  // Cap at max delay
  return Math.min(delay, maxDelay);
}

/**
 * Add jitter to delay
 */
export function addJitter(delay: number, factor: number = 0.1): number {
  if (delay === 0) return 0;

  const jitterRange = delay * factor;
  const jitter = (Math.random() * 2 - 1) * jitterRange;
  return Math.max(0, Math.round(delay + jitter));
}

/**
 * Create a delay promise
 */
export function createDelay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);

    if (signal) {
      signal.addEventListener("abort", () => {
        clearTimeout(timeout);
        reject(new Error("Delay aborted"));
      }, { once: true });
    }
  });
}

/**
 * Calculate total delays for a sequence
 */
export function calculateTotalDelay(maxRetries: number, config: BackoffConfig = {}): number {
  let total = 0;
  for (let i = 0; i <= maxRetries; i++) {
    total += calculateDelay(i, config);
  }
  return total;
}

/**
 * Get delay sequence for debugging
 */
export function getDelaySequence(maxRetries: number, config: BackoffConfig = {}): number[] {
  const sequence: number[] = [];
  for (let i = 0; i <= maxRetries; i++) {
    sequence.push(calculateDelay(i, config));
  }
  return sequence;
}

/**
 * Create retry state
 */
export function createRetryState(attempt: number = 0, config: BackoffConfig = {}): RetryState {
  return {
    attempt,
    failures: 0,
    nextDelay: calculateDelay(attempt, config),
    currentDelay: 0,
    canRetry: attempt <= (config.maxRetries ?? DEFAULT_CONFIG.maxRetries),
    lastAttemptTime: Date.now(),
    elapsedTime: 0,
    delayHistory: [],
  };
}

/**
 * Check if error is retryable (default implementation)
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Network errors are usually retryable
  if (message.includes("network") || message.includes("timeout") ||
      message.includes("econnreset") || message.includes("econnrefused")) {
    return true;
  }

  // Rate limiting is retryable
  if (message.includes("rate limit") || message.includes("too many requests")) {
    return true;
  }

  // Service unavailable is retryable
  if (message.includes("503") || message.includes("service unavailable") ||
      message.includes("temporarily unavailable")) {
    return true;
  }

  // Syntax errors, type errors, etc. are not retryable
  if (message.includes("syntax") || message.includes("type error") ||
      message.includes("invalid")) {
    return false;
  }

  // Default: assume retryable
  return true;
}

// ============================================================================
// ExponentialBackoff Class
// ============================================================================

/**
 * Exponential backoff calculator
 */
export class ExponentialBackoff {
  private config: Required<BackoffConfig>;
  private attempt: number = 0;
  private startTime: number = 0;
  private delayHistory: number[] = [];
  private disposed = false;

  constructor(config: BackoffConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startTime = Date.now();
  }

  /**
   * Get delay for next attempt
   */
  getDelay(): number {
    if (this.disposed) {
      throw new Error("ExponentialBackoff is disposed");
    }

    let delay = calculateDelay(this.attempt, this.config);

    if (this.config.jitter && delay > 0) {
      delay = addJitter(delay, this.config.jitterFactor);
    }

    return delay;
  }

  /**
   * Record an attempt and calculate next delay
   */
  recordAttempt(success: boolean = false): number {
    if (this.disposed) {
      throw new Error("ExponentialBackoff is disposed");
    }

    const delay = this.getDelay();
    this.delayHistory.push(delay);

    if (success && this.config.resetOnSuccess) {
      this.reset();
    } else {
      this.attempt++;
    }

    return delay;
  }

  /**
   * Wait for the current backoff delay
   */
  async wait(signal?: AbortSignal): Promise<number> {
    const delay = this.getDelay();
    this.delayHistory.push(delay);
    this.attempt++;

    await createDelay(delay, signal);
    return delay;
  }

  /**
   * Check if more retries are allowed
   */
  canRetry(): boolean {
    return this.attempt <= this.config.maxRetries;
  }

  /**
   * Get current state
   */
  getState(): RetryState {
    const now = Date.now();
    return {
      attempt: this.attempt,
      failures: this.attempt,
      nextDelay: this.getDelay(),
      currentDelay: this.delayHistory[this.delayHistory.length - 1] ?? 0,
      canRetry: this.canRetry(),
      lastAttemptTime: now,
      elapsedTime: now - this.startTime,
      delayHistory: [...this.delayHistory],
    };
  }

  /**
   * Reset the backoff state
   */
  reset(): void {
    this.attempt = 0;
    this.startTime = Date.now();
    this.delayHistory = [];
  }

  /**
   * Get delay sequence preview
   */
  getSequence(): number[] {
    return getDelaySequence(this.config.maxRetries, this.config);
  }

  /**
   * Check if disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.delayHistory = [];
  }
}

// ============================================================================
// RetryStrategy Class
// ============================================================================

/**
 * Complete retry strategy with execution support
 */
export class RetryStrategy {
  private config: Required<BackoffConfig>;
  private disposed = false;

  constructor(config: BackoffConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute an operation with retries
   */
  async execute<T>(
    operation: () => Promise<T>,
    options: RetryOptions<T> = {}
  ): Promise<RetryResult<T>> {
    if (this.disposed) {
      throw new Error("RetryStrategy is disposed");
    }

    const {
      isRetryable = isRetryableError,
      onRetry,
      onSuccess,
      onFailure,
      signal,
    } = options;

    const mergedConfig = { ...this.config, ...options };
    const backoff = new ExponentialBackoff(mergedConfig);
    const startTime = Date.now();
    let lastError: Error | undefined;

    while (backoff.canRetry()) {
      // Check for abort
      if (signal?.aborted) {
        const state = backoff.getState();
        return {
          success: false,
          error: new Error("Operation aborted"),
          state,
          attempts: state.attempt,
          totalTime: Date.now() - startTime,
        };
      }

      try {
        // Wait for backoff delay (0 for first attempt)
        const delay = await backoff.wait(signal);

        // Execute the operation
        const value = await operation();

        // Success!
        const state = backoff.getState();
        onSuccess?.(value, state);

        return {
          success: true,
          value,
          state,
          attempts: state.attempt,
          totalTime: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const state = backoff.getState();

        // Check if we can retry
        if (!backoff.canRetry() || !isRetryable(lastError)) {
          onFailure?.(lastError, state);
          return {
            success: false,
            error: lastError,
            state,
            attempts: state.attempt,
            totalTime: Date.now() - startTime,
          };
        }

        // Notify retry callback
        await onRetry?.(state, lastError);
      }
    }

    // Exhausted retries
    const finalState = backoff.getState();
    onFailure?.(lastError ?? new Error("Max retries exceeded"), finalState);

    return {
      success: false,
      error: lastError ?? new Error("Max retries exceeded"),
      state: finalState,
      attempts: finalState.attempt,
      totalTime: Date.now() - startTime,
    };
  }

  /**
   * Create a retryable wrapper for a function
   */
  wrap<T>(
    operation: () => Promise<T>,
    options: RetryOptions<T> = {}
  ): () => Promise<RetryResult<T>> {
    return () => this.execute(operation, options);
  }

  /**
   * Get delay sequence preview
   */
  getDelaySequence(): number[] {
    return getDelaySequence(this.config.maxRetries, this.config);
  }

  /**
   * Get total maximum delay
   */
  getTotalMaxDelay(): number {
    return calculateTotalDelay(this.config.maxRetries, this.config);
  }

  /**
   * Check if disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new ExponentialBackoff instance
 */
export function createExponentialBackoff(
  config?: BackoffConfig
): ExponentialBackoff {
  return new ExponentialBackoff(config);
}

/**
 * Create a new RetryStrategy instance
 */
export function createRetryStrategy(config?: BackoffConfig): RetryStrategy {
  return new RetryStrategy(config);
}

/**
 * Create retry strategy with verification pattern (0s, 1s, 3s)
 */
export function createVerificationRetryStrategy(): RetryStrategy {
  return new RetryStrategy({
    type: "custom",
    customDelays: DELAY_SEQUENCES.verification,
    maxRetries: 4,
    delayFirstAttempt: false,
  });
}

/**
 * Quick retry helper
 */
export async function retry<T>(
  operation: () => Promise<T>,
  config: BackoffConfig & RetryOptions<T> = {}
): Promise<T> {
  const strategy = createRetryStrategy(config);
  const result = await strategy.execute(operation, config);
  strategy.dispose();

  if (result.success) {
    return result.value as T;
  }
  throw result.error;
}
