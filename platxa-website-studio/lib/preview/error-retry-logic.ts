/**
 * Error Retry Logic
 *
 * Implements retry logic for error fixing:
 * - Max 3 attempts per error
 * - Different approaches for each retry
 * - Tracks retry history and outcomes
 */

// =============================================================================
// Utility - Simple ID Generation (avoids crypto import issues in browser/test)
// =============================================================================

let idCounter = 0;

function generateId(): string {
  idCounter++;
  return `retry-${Date.now()}-${idCounter}-${Math.random().toString(36).slice(2, 10)}`;
}

// =============================================================================
// Types
// =============================================================================

/** Retry approach for fixing errors */
export type RetryApproach =
  | "pattern_match"     // Try pattern-based fix
  | "fuzzy_match"       // Try fuzzy pattern matching
  | "llm_generation"    // Ask LLM to generate fix
  | "context_expanded"  // Retry with more context
  | "alternative_fix"   // Try alternative fix from same pattern
  | "manual_hint";      // Request manual hint from user

/** Error identifier for tracking retries */
export interface ErrorIdentifier {
  /** Error message or unique identifier */
  message: string;
  /** File path where error occurred */
  filePath?: string;
  /** Line number */
  lineNumber?: number;
  /** Error type/category */
  errorType?: string;
}

/** Single retry attempt */
export interface RetryAttempt {
  /** Attempt number (1-3) */
  attemptNumber: number;
  /** Approach used for this attempt */
  approach: RetryApproach;
  /** Whether attempt was successful */
  success: boolean;
  /** Fix that was attempted */
  fixAttempted?: string;
  /** Error message if failed */
  errorMessage?: string;
  /** Timestamp of attempt */
  timestamp: number;
  /** Duration of attempt (ms) */
  duration: number;
}

/** Retry state for an error */
export interface RetryState {
  /** Error identifier */
  error: ErrorIdentifier;
  /** All retry attempts */
  attempts: RetryAttempt[];
  /** Current attempt number */
  currentAttempt: number;
  /** Maximum attempts allowed */
  maxAttempts: number;
  /** Whether all retries exhausted */
  exhausted: boolean;
  /** Whether error was resolved */
  resolved: boolean;
  /** Approaches already tried */
  approachesTried: RetryApproach[];
}

/** Retry result */
export interface RetryResult {
  /** Whether retry was successful */
  success: boolean;
  /** Attempt that succeeded (if any) */
  successfulAttempt?: RetryAttempt;
  /** All attempts made */
  attempts: RetryAttempt[];
  /** Whether more retries available */
  canRetry: boolean;
  /** Suggested next approach */
  nextApproach?: RetryApproach;
  /** Final error state */
  state: RetryState;
}

/** Retry configuration */
export interface RetryConfig {
  /** Maximum retry attempts */
  maxAttempts: number;
  /** Delay between retries (ms) */
  retryDelay: number;
  /** Approach order for retries */
  approachOrder: RetryApproach[];
  /** Enable exponential backoff */
  exponentialBackoff: boolean;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Max delay between retries (ms) */
  maxDelay: number;
}

/** Fix function type */
export type FixFunction = (
  error: ErrorIdentifier,
  approach: RetryApproach,
  attempt: number
) => Promise<FixResult> | FixResult;

/** Fix result */
export interface FixResult {
  /** Whether fix was successful */
  success: boolean;
  /** The fix that was applied */
  fix?: string;
  /** Error message if failed */
  error?: string;
}

// =============================================================================
// Default Configuration
// =============================================================================

/** Default retry configuration */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  retryDelay: 100,
  approachOrder: [
    "pattern_match",
    "fuzzy_match",
    "llm_generation",
  ],
  exponentialBackoff: true,
  backoffMultiplier: 2,
  maxDelay: 5000,
};

/** Default approach descriptions */
export const APPROACH_DESCRIPTIONS: Record<RetryApproach, string> = {
  pattern_match: "Match against known error patterns",
  fuzzy_match: "Use fuzzy matching for similar patterns",
  llm_generation: "Generate fix using LLM",
  context_expanded: "Retry with expanded code context",
  alternative_fix: "Try alternative fix suggestion",
  manual_hint: "Request manual hint from user",
};

// =============================================================================
// Error Identification
// =============================================================================

/**
 * Creates a unique key for an error.
 */
export function createErrorKey(error: ErrorIdentifier): string {
  const parts = [error.message];
  if (error.filePath) parts.push(error.filePath);
  if (error.lineNumber) parts.push(String(error.lineNumber));
  if (error.errorType) parts.push(error.errorType);
  return parts.join("|");
}

/**
 * Checks if two errors are the same.
 */
export function isSameError(a: ErrorIdentifier, b: ErrorIdentifier): boolean {
  return createErrorKey(a) === createErrorKey(b);
}

/**
 * Creates an error identifier.
 */
export function createErrorIdentifier(
  message: string,
  options: Partial<Omit<ErrorIdentifier, "message">> = {}
): ErrorIdentifier {
  return { message, ...options };
}

// =============================================================================
// Retry State Management
// =============================================================================

/**
 * Creates initial retry state for an error.
 */
export function createRetryState(
  error: ErrorIdentifier,
  maxAttempts: number = 3
): RetryState {
  return {
    error,
    attempts: [],
    currentAttempt: 0,
    maxAttempts,
    exhausted: false,
    resolved: false,
    approachesTried: [],
  };
}

/**
 * Records an attempt in retry state.
 */
export function recordAttempt(
  state: RetryState,
  attempt: RetryAttempt
): RetryState {
  const newAttempts = [...state.attempts, attempt];
  const newApproachesTried = state.approachesTried.includes(attempt.approach)
    ? state.approachesTried
    : [...state.approachesTried, attempt.approach];

  return {
    ...state,
    attempts: newAttempts,
    currentAttempt: attempt.attemptNumber,
    exhausted: attempt.attemptNumber >= state.maxAttempts && !attempt.success,
    resolved: attempt.success,
    approachesTried: newApproachesTried,
  };
}

/**
 * Checks if more retries are available.
 */
export function canRetry(state: RetryState): boolean {
  return !state.exhausted && !state.resolved && state.currentAttempt < state.maxAttempts;
}

/**
 * Gets the next approach to try.
 */
export function getNextApproach(
  state: RetryState,
  approachOrder: RetryApproach[]
): RetryApproach | null {
  for (const approach of approachOrder) {
    if (!state.approachesTried.includes(approach)) {
      return approach;
    }
  }
  // If all approaches tried, cycle back with different variant
  return approachOrder[state.currentAttempt % approachOrder.length] ?? null;
}

// =============================================================================
// Delay Calculation
// =============================================================================

/**
 * Calculates delay for next retry.
 */
export function calculateRetryDelay(
  attemptNumber: number,
  config: RetryConfig
): number {
  if (!config.exponentialBackoff) {
    return config.retryDelay;
  }

  const delay = config.retryDelay * Math.pow(config.backoffMultiplier, attemptNumber - 1);
  return Math.min(delay, config.maxDelay);
}

/**
 * Waits for specified delay.
 */
export async function waitForDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// ErrorRetryManager Class
// =============================================================================

/**
 * Manages retry logic for error fixing.
 */
export class ErrorRetryManager {
  private config: RetryConfig;
  private retryStates: Map<string, RetryState> = new Map();
  private fixFunction?: FixFunction;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * Sets the fix function to use for retries.
   */
  setFixFunction(fn: FixFunction): void {
    this.fixFunction = fn;
  }

  /**
   * Gets or creates retry state for an error.
   */
  getState(error: ErrorIdentifier): RetryState {
    const key = createErrorKey(error);
    if (!this.retryStates.has(key)) {
      this.retryStates.set(key, createRetryState(error, this.config.maxAttempts));
    }
    return this.retryStates.get(key)!;
  }

  /**
   * Attempts to fix an error with retry logic.
   */
  async attemptFix(error: ErrorIdentifier): Promise<RetryResult> {
    if (!this.fixFunction) {
      throw new Error("Fix function not set. Call setFixFunction first.");
    }

    let state = this.getState(error);
    const attempts: RetryAttempt[] = [];

    while (canRetry(state)) {
      const attemptNumber = state.currentAttempt + 1;
      const approach = getNextApproach(state, this.config.approachOrder);

      if (!approach) break;

      // Calculate and wait for delay (skip for first attempt)
      if (attemptNumber > 1) {
        const delay = calculateRetryDelay(attemptNumber, this.config);
        await waitForDelay(delay);
      }

      // Execute attempt
      const startTime = Date.now();
      let success = false;
      let fixAttempted: string | undefined;
      let errorMessage: string | undefined;

      try {
        const result = await this.fixFunction(error, approach, attemptNumber);
        success = result.success;
        fixAttempted = result.fix;
        if (!success) {
          errorMessage = result.error;
        }
      } catch (e) {
        success = false;
        errorMessage = e instanceof Error ? e.message : String(e);
      }

      const attempt: RetryAttempt = {
        attemptNumber,
        approach,
        success,
        fixAttempted,
        errorMessage,
        timestamp: startTime,
        duration: Date.now() - startTime,
      };

      attempts.push(attempt);

      // Update state - MUST reassign to update loop condition
      state = recordAttempt(state, attempt);
      this.retryStates.set(createErrorKey(error), state);

      if (success) {
        return {
          success: true,
          successfulAttempt: attempt,
          attempts,
          canRetry: false,
          state,
        };
      }
    }

    const finalState = this.getState(error);
    return {
      success: false,
      attempts,
      canRetry: canRetry(finalState),
      nextApproach: canRetry(finalState)
        ? getNextApproach(finalState, this.config.approachOrder) ?? undefined
        : undefined,
      state: finalState,
    };
  }

  /**
   * Attempts a single retry for an error.
   */
  async singleRetry(
    error: ErrorIdentifier,
    approach?: RetryApproach
  ): Promise<RetryAttempt | null> {
    if (!this.fixFunction) {
      throw new Error("Fix function not set.");
    }

    const state = this.getState(error);

    if (!canRetry(state)) {
      return null;
    }

    const attemptNumber = state.currentAttempt + 1;
    const selectedApproach = approach ?? getNextApproach(state, this.config.approachOrder);

    if (!selectedApproach) {
      return null;
    }

    const startTime = Date.now();
    let success = false;
    let fixAttempted: string | undefined;
    let errorMessage: string | undefined;

    try {
      const result = await this.fixFunction(error, selectedApproach, attemptNumber);
      success = result.success;
      fixAttempted = result.fix;
      if (!success) {
        errorMessage = result.error;
      }
    } catch (e) {
      success = false;
      errorMessage = e instanceof Error ? e.message : String(e);
    }

    const attempt: RetryAttempt = {
      attemptNumber,
      approach: selectedApproach,
      success,
      fixAttempted,
      errorMessage,
      timestamp: startTime,
      duration: Date.now() - startTime,
    };

    const newState = recordAttempt(state, attempt);
    this.retryStates.set(createErrorKey(error), newState);

    return attempt;
  }

  /**
   * Checks if an error can be retried.
   */
  canRetryError(error: ErrorIdentifier): boolean {
    const state = this.getState(error);
    return canRetry(state);
  }

  /**
   * Gets remaining retry count for an error.
   */
  getRemainingRetries(error: ErrorIdentifier): number {
    const state = this.getState(error);
    return Math.max(0, state.maxAttempts - state.currentAttempt);
  }

  /**
   * Resets retry state for an error.
   */
  resetError(error: ErrorIdentifier): void {
    const key = createErrorKey(error);
    this.retryStates.delete(key);
  }

  /**
   * Resets all retry states.
   */
  resetAll(): void {
    this.retryStates.clear();
  }

  /**
   * Gets retry history for an error.
   */
  getHistory(error: ErrorIdentifier): RetryAttempt[] {
    const state = this.getState(error);
    return [...state.attempts];
  }

  /**
   * Gets all tracked errors.
   */
  getTrackedErrors(): ErrorIdentifier[] {
    return Array.from(this.retryStates.values()).map((state) => state.error);
  }

  /**
   * Gets statistics about retries.
   */
  getStats(): {
    totalErrors: number;
    resolved: number;
    exhausted: number;
    pending: number;
    totalAttempts: number;
  } {
    let resolved = 0;
    let exhausted = 0;
    let pending = 0;
    let totalAttempts = 0;

    for (const state of this.retryStates.values()) {
      if (state.resolved) resolved++;
      else if (state.exhausted) exhausted++;
      else pending++;
      totalAttempts += state.attempts.length;
    }

    return {
      totalErrors: this.retryStates.size,
      resolved,
      exhausted,
      pending,
      totalAttempts,
    };
  }

  /**
   * Updates configuration.
   */
  updateConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets current configuration.
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates an ErrorRetryManager instance.
 */
export function createRetryManager(
  config?: Partial<RetryConfig>
): ErrorRetryManager {
  return new ErrorRetryManager(config);
}

/**
 * Creates a retry manager with a fix function.
 */
export function createRetryManagerWithFix(
  fixFn: FixFunction,
  config?: Partial<RetryConfig>
): ErrorRetryManager {
  const manager = new ErrorRetryManager(config);
  manager.setFixFunction(fixFn);
  return manager;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Formats retry result for display.
 */
export function formatRetryResult(result: RetryResult): string {
  const parts: string[] = [];

  parts.push(`Retry ${result.success ? "SUCCESS" : "FAILED"}`);
  parts.push(`Attempts: ${result.attempts.length}/${result.state.maxAttempts}`);

  if (result.successfulAttempt) {
    parts.push(`Succeeded on attempt ${result.successfulAttempt.attemptNumber}`);
    parts.push(`Approach: ${result.successfulAttempt.approach}`);
  }

  if (!result.success && result.canRetry) {
    parts.push(`Can retry with: ${result.nextApproach}`);
  }

  if (result.state.exhausted) {
    parts.push("All retries exhausted");
  }

  return parts.join("\n");
}

/**
 * Gets approach description.
 */
export function getApproachDescription(approach: RetryApproach): string {
  return APPROACH_DESCRIPTIONS[approach];
}

/**
 * Checks if error should escalate (all retries failed).
 */
export function shouldEscalate(state: RetryState): boolean {
  return state.exhausted && !state.resolved;
}

/**
 * Creates a simple mock fix function for testing.
 */
export function createMockFixFunction(
  successOnAttempt: number = 2
): FixFunction {
  return (error, approach, attempt) => ({
    success: attempt >= successOnAttempt,
    fix: attempt >= successOnAttempt ? `Fixed: ${error.message}` : undefined,
    error: attempt < successOnAttempt ? `Attempt ${attempt} failed` : undefined,
  });
}

/**
 * Creates a fix function that always fails.
 */
export function createFailingFixFunction(): FixFunction {
  return () => ({
    success: false,
    error: "Fix failed",
  });
}

/**
 * Creates a fix function that always succeeds.
 */
export function createSucceedingFixFunction(): FixFunction {
  return (error) => ({
    success: true,
    fix: `Fixed: ${error.message}`,
  });
}
