/**
 * Rollback Recovery — Automatic Failure Recovery with Strategy Selection
 *
 * Manages rollback-on-failure with multiple recovery strategies:
 * snapshot restore, git revert, Yjs history undo, and retry.
 */

// =============================================================================
// Types
// =============================================================================

/** Available recovery strategies */
export type RecoveryStrategy = "snapshot" | "git" | "yjs" | "retry" | "manual";

/** Severity of the failure */
export type FailureSeverity = "low" | "medium" | "high" | "critical";

/** Failure context provided when a generation fails */
export interface FailureContext {
  /** Error message */
  error: string;
  /** Which phase failed */
  phase: string;
  /** Affected section IDs */
  affectedSections: string[];
  /** Whether partial output exists */
  hasPartialOutput: boolean;
  /** Whether a snapshot exists to restore */
  hasSnapshot: boolean;
  /** Whether git history is available */
  hasGitHistory: boolean;
  /** Whether Yjs history is available */
  hasYjsHistory: boolean;
  /** Number of previous retry attempts */
  retryCount: number;
  /** Maximum retries allowed */
  maxRetries: number;
}

/** A recovery plan produced by strategy selection */
export interface RecoveryPlan {
  /** Selected primary strategy */
  strategy: RecoveryStrategy;
  /** Fallback strategy if primary fails */
  fallback: RecoveryStrategy;
  /** Severity assessment */
  severity: FailureSeverity;
  /** Human-readable explanation */
  explanation: string;
  /** Steps to execute */
  steps: RecoveryStep[];
  /** Whether automatic execution is recommended */
  autoExecute: boolean;
}

/** A single recovery step */
export interface RecoveryStep {
  /** Step ID */
  id: string;
  /** Action to perform */
  action: string;
  /** Description */
  description: string;
  /** Strategy this step belongs to */
  strategy: RecoveryStrategy;
}

/** Result of executing a recovery */
export interface RecoveryResult {
  /** Whether recovery succeeded */
  success: boolean;
  /** Strategy that was used */
  strategyUsed: RecoveryStrategy;
  /** Whether fallback was needed */
  usedFallback: boolean;
  /** Sections that were recovered */
  recoveredSections: string[];
  /** Sections that could not be recovered */
  unrecoveredSections: string[];
  /** Duration of recovery in ms */
  durationMs: number;
  /** Message */
  message: string;
}

/** Recovery executor function */
export type RecoveryExecutor = (
  plan: RecoveryPlan,
  context: FailureContext,
) => Promise<RecoveryResult>;

/** Rollback state tracking */
export interface RollbackState {
  /** Recovery attempts history */
  attempts: Array<{
    context: FailureContext;
    plan: RecoveryPlan;
    result: RecoveryResult;
    timestamp: string;
  }>;
  /** Current known-good state identifier (snapshot ID, git hash, etc.) */
  lastGoodStateId: string | null;
  /** Strategy that was used for last good state */
  lastGoodStrategy: RecoveryStrategy | null;
}

// =============================================================================
// Severity Assessment
// =============================================================================

/**
 * Assesses failure severity based on context.
 */
export function assessSeverity(context: FailureContext): FailureSeverity {
  // Critical: all sections affected with no partial output
  if (context.affectedSections.length > 3 && !context.hasPartialOutput) {
    return "critical";
  }
  // High: multiple sections or repeated failures
  if (context.affectedSections.length > 1 || context.retryCount >= 2) {
    return "high";
  }
  // Medium: single section with partial output
  if (context.affectedSections.length === 1 && context.hasPartialOutput) {
    return "medium";
  }
  // Low: single section, first attempt
  if (context.retryCount === 0) {
    return "low";
  }
  return "medium";
}

// =============================================================================
// Strategy Selection
// =============================================================================

/**
 * Selects the best recovery strategy based on failure context.
 */
export function selectStrategy(context: FailureContext): RecoveryStrategy {
  // If retries remain and severity is low, try again
  if (context.retryCount < context.maxRetries) {
    const severity = assessSeverity(context);
    if (severity === "low") return "retry";
  }

  // Prefer snapshot restore (fastest, most precise)
  if (context.hasSnapshot) return "snapshot";

  // Yjs history for real-time collaborative state
  if (context.hasYjsHistory) return "yjs";

  // Git as persistent fallback
  if (context.hasGitHistory) return "git";

  // If retries remain, retry even at higher severity
  if (context.retryCount < context.maxRetries) return "retry";

  return "manual";
}

/**
 * Selects a fallback strategy (different from primary).
 */
export function selectFallback(
  primary: RecoveryStrategy,
  context: FailureContext,
): RecoveryStrategy {
  const candidates: RecoveryStrategy[] = [];

  if (primary !== "snapshot" && context.hasSnapshot) candidates.push("snapshot");
  if (primary !== "yjs" && context.hasYjsHistory) candidates.push("yjs");
  if (primary !== "git" && context.hasGitHistory) candidates.push("git");
  if (primary !== "retry" && context.retryCount < context.maxRetries) candidates.push("retry");

  return candidates.length > 0 ? candidates[0] : "manual";
}

// =============================================================================
// Recovery Plan Generation
// =============================================================================

let stepCounter = 0;

/** Reset step counter (for testing). */
export function resetStepCounter(): void {
  stepCounter = 0;
}

function makeStep(action: string, description: string, strategy: RecoveryStrategy): RecoveryStep {
  stepCounter++;
  return { id: `step_${stepCounter}`, action, description, strategy };
}

/**
 * Generates recovery steps for a given strategy.
 */
export function generateSteps(
  strategy: RecoveryStrategy,
  context: FailureContext,
): RecoveryStep[] {
  switch (strategy) {
    case "snapshot":
      return [
        makeStep("locate_snapshot", "Locate last-good snapshot", strategy),
        makeStep("restore_snapshot", "Restore HTML and SCSS from snapshot", strategy),
        makeStep("verify_restore", "Verify restored output renders correctly", strategy),
      ];
    case "git":
      return [
        makeStep("identify_commit", "Identify last-good git commit", strategy),
        makeStep("git_checkout", "Checkout files from last-good commit", strategy),
        makeStep("verify_files", "Verify file integrity after checkout", strategy),
      ];
    case "yjs":
      return [
        makeStep("locate_yjs_state", "Locate last-good Yjs document state", strategy),
        makeStep("yjs_undo", "Undo Yjs changes to last-good state", strategy),
        makeStep("sync_clients", "Synchronize all connected clients", strategy),
      ];
    case "retry":
      return [
        makeStep("clear_partial", "Clear partial output from failed attempt", strategy),
        makeStep("retry_generation", `Retry generation (attempt ${context.retryCount + 1}/${context.maxRetries})`, strategy),
      ];
    case "manual":
      return [
        makeStep("notify_user", "Notify user of unrecoverable failure", strategy),
        makeStep("provide_diagnostics", "Provide failure diagnostics for manual recovery", strategy),
      ];
  }
}

/**
 * Creates a full recovery plan from failure context.
 */
export function createRecoveryPlan(context: FailureContext): RecoveryPlan {
  const strategy = selectStrategy(context);
  const fallback = selectFallback(strategy, context);
  const severity = assessSeverity(context);
  const steps = generateSteps(strategy, context);

  const strategyLabels: Record<RecoveryStrategy, string> = {
    snapshot: "Restore from last-good snapshot",
    git: "Revert to last-good git commit",
    yjs: "Undo via Yjs collaborative history",
    retry: "Retry the failed generation",
    manual: "Manual recovery required",
  };

  return {
    strategy,
    fallback,
    severity,
    explanation: `${strategyLabels[strategy]}. Fallback: ${strategyLabels[fallback]}.`,
    steps,
    autoExecute: strategy !== "manual" && severity !== "critical",
  };
}

// =============================================================================
// State Management
// =============================================================================

/** Creates a new rollback state. */
export function createRollbackState(): RollbackState {
  return { attempts: [], lastGoodStateId: null, lastGoodStrategy: null };
}

/** Records a known-good state. */
export function setLastGoodState(
  state: RollbackState,
  stateId: string,
  strategy: RecoveryStrategy,
): RollbackState {
  return { ...state, lastGoodStateId: stateId, lastGoodStrategy: strategy };
}

/** Records a recovery attempt. */
export function recordAttempt(
  state: RollbackState,
  context: FailureContext,
  plan: RecoveryPlan,
  result: RecoveryResult,
): RollbackState {
  return {
    ...state,
    attempts: [
      ...state.attempts,
      { context, plan, result, timestamp: new Date().toISOString() },
    ],
  };
}

/** Returns the number of failed recovery attempts. */
export function getFailedAttemptCount(state: RollbackState): number {
  return state.attempts.filter((a) => !a.result.success).length;
}

/** Returns the last successful recovery, if any. */
export function getLastSuccessfulRecovery(
  state: RollbackState,
): RollbackState["attempts"][0] | null {
  for (let i = state.attempts.length - 1; i >= 0; i--) {
    if (state.attempts[i].result.success) return state.attempts[i];
  }
  return null;
}
