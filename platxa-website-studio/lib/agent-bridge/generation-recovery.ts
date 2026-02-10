/**
 * Generation Recovery Service
 *
 * Integrates snapshot, rollback-recovery, and the generation pipeline
 * to provide automatic failure recovery during AI generation.
 *
 * Flow:
 * 1. Before generation: Create snapshot checkpoint
 * 2. During generation: Monitor for failures
 * 3. On failure: Select recovery strategy and execute
 * 4. After recovery: Update state and optionally retry
 */

import {
  createTimeline,
  addSnapshot,
  getCurrentSnapshot,
  restoreById,
  type Timeline,
  type Snapshot,
} from "./snapshot-timeline";
import {
  createRecoveryPlan,
  createRollbackState,
  setLastGoodState,
  recordAttempt,
  assessSeverity,
  type FailureContext,
  type RecoveryPlan,
  type RecoveryResult,
  type RollbackState,
  type RecoveryStrategy,
} from "./rollback-recovery";

// =============================================================================
// Types
// =============================================================================

/** Generation state for recovery tracking */
export interface GenerationState {
  /** Current file contents before generation */
  preGenerationSnapshot: Snapshot | null;
  /** Timeline for undo/redo */
  timeline: Timeline;
  /** Rollback state for recovery tracking */
  rollbackState: RollbackState;
  /** Current generation ID */
  generationId: string | null;
  /** Whether generation is in progress */
  isGenerating: boolean;
  /** Number of retries for current generation */
  retryCount: number;
  /** Maximum retries allowed */
  maxRetries: number;
}

/** Configuration for recovery service */
export interface RecoveryConfig {
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Whether to auto-execute recovery (default: true) */
  autoExecute?: boolean;
  /** Callback when recovery starts */
  onRecoveryStart?: (plan: RecoveryPlan) => void;
  /** Callback when recovery completes */
  onRecoveryComplete?: (result: RecoveryResult) => void;
  /** Callback when state is restored */
  onStateRestored?: (snapshot: Snapshot) => void;
}

/** Result of starting a generation */
export interface GenerationStartResult {
  /** Generation ID */
  generationId: string;
  /** Snapshot created before generation */
  snapshot: Snapshot;
  /** Updated state */
  state: GenerationState;
}

/** Result of handling a generation failure */
export interface FailureHandleResult {
  /** Recovery plan created */
  plan: RecoveryPlan;
  /** Recovery result after execution */
  result: RecoveryResult;
  /** Updated state */
  state: GenerationState;
  /** Whether retry is recommended */
  shouldRetry: boolean;
}

// =============================================================================
// State Management
// =============================================================================

let idCounter = 0;

/**
 * Creates a new generation state.
 */
export function createGenerationState(config?: RecoveryConfig): GenerationState {
  return {
    preGenerationSnapshot: null,
    timeline: createTimeline(),
    rollbackState: createRollbackState(),
    generationId: null,
    isGenerating: false,
    retryCount: 0,
    maxRetries: config?.maxRetries ?? 3,
  };
}

/**
 * Prepares for generation by creating a snapshot checkpoint.
 * Call this BEFORE starting AI generation.
 */
export function prepareForGeneration(
  state: GenerationState,
  currentHtml: string,
  currentScss: string,
  label: string = "Pre-generation checkpoint",
): GenerationStartResult {
  idCounter++;
  const generationId = `gen_${Date.now()}_${idCounter}`;

  // Create snapshot of current state
  const updatedTimeline = addSnapshot(
    state.timeline,
    currentHtml,
    currentScss,
    label,
    "", // thumbnail - can be added later
    { generationId, type: "pre-generation" }
  );

  const snapshot = getCurrentSnapshot(updatedTimeline);

  // Update rollback state with last known-good state
  const updatedRollbackState = snapshot
    ? setLastGoodState(state.rollbackState, snapshot.id, "snapshot")
    : state.rollbackState;

  const newState: GenerationState = {
    ...state,
    preGenerationSnapshot: snapshot,
    timeline: updatedTimeline,
    rollbackState: updatedRollbackState,
    generationId,
    isGenerating: true,
    retryCount: 0,
  };

  return {
    generationId,
    snapshot: snapshot!,
    state: newState,
  };
}

/**
 * Marks generation as complete (successful).
 */
export function completeGeneration(
  state: GenerationState,
  finalHtml: string,
  finalScss: string,
  label: string = "Generation complete",
): GenerationState {
  // Add successful generation to timeline
  const updatedTimeline = addSnapshot(
    state.timeline,
    finalHtml,
    finalScss,
    label,
    "",
    { generationId: state.generationId, type: "post-generation", success: true }
  );

  const currentSnapshot = getCurrentSnapshot(updatedTimeline);

  // Update last-good state
  const updatedRollbackState = currentSnapshot
    ? setLastGoodState(state.rollbackState, currentSnapshot.id, "snapshot")
    : state.rollbackState;

  return {
    ...state,
    timeline: updatedTimeline,
    rollbackState: updatedRollbackState,
    generationId: null,
    isGenerating: false,
    retryCount: 0,
  };
}

/**
 * Handles a generation failure by creating and optionally executing a recovery plan.
 */
export function handleGenerationFailure(
  state: GenerationState,
  error: string,
  phase: string,
  affectedSections: string[] = [],
  hasPartialOutput: boolean = false,
  config?: RecoveryConfig,
): FailureHandleResult {
  const startTime = Date.now();

  // Build failure context
  const context: FailureContext = {
    error,
    phase,
    affectedSections,
    hasPartialOutput,
    hasSnapshot: state.preGenerationSnapshot !== null,
    hasGitHistory: false, // Would need git integration
    hasYjsHistory: false, // Would need Yjs integration
    retryCount: state.retryCount,
    maxRetries: state.maxRetries,
  };

  // Create recovery plan
  const plan = createRecoveryPlan(context);

  config?.onRecoveryStart?.(plan);

  // Execute recovery
  let result: RecoveryResult;

  if (plan.strategy === "snapshot" && state.preGenerationSnapshot) {
    // Restore from snapshot by ID
    const restoreResult = restoreById(state.timeline, state.preGenerationSnapshot.id);

    if (restoreResult) {
      config?.onStateRestored?.(restoreResult.snapshot);
      result = {
        success: true,
        strategyUsed: "snapshot",
        usedFallback: false,
        recoveredSections: affectedSections,
        unrecoveredSections: [],
        durationMs: Date.now() - startTime,
        message: `Restored from snapshot: ${state.preGenerationSnapshot.label}`,
      };
    } else {
      // Snapshot restore failed, try fallback
      result = executeFallbackRecovery(plan, context, startTime);
    }
  } else if (plan.strategy === "retry") {
    // Retry will be handled by caller
    result = {
      success: true,
      strategyUsed: "retry",
      usedFallback: false,
      recoveredSections: [],
      unrecoveredSections: affectedSections,
      durationMs: Date.now() - startTime,
      message: `Retry recommended (attempt ${state.retryCount + 1}/${state.maxRetries})`,
    };
  } else {
    // Manual or unsupported strategy
    result = {
      success: false,
      strategyUsed: plan.strategy,
      usedFallback: false,
      recoveredSections: [],
      unrecoveredSections: affectedSections,
      durationMs: Date.now() - startTime,
      message: `${plan.strategy} recovery: ${plan.explanation}`,
    };
  }

  // Record attempt
  const updatedRollbackState = recordAttempt(state.rollbackState, context, plan, result);

  config?.onRecoveryComplete?.(result);

  // Update state
  const shouldRetry = plan.strategy === "retry" && state.retryCount < state.maxRetries;

  const newState: GenerationState = {
    ...state,
    rollbackState: updatedRollbackState,
    retryCount: shouldRetry ? state.retryCount + 1 : state.retryCount,
    isGenerating: shouldRetry, // Stay generating if retry
  };

  return {
    plan,
    result,
    state: newState,
    shouldRetry,
  };
}

/**
 * Executes fallback recovery when primary strategy fails.
 */
function executeFallbackRecovery(
  plan: RecoveryPlan,
  context: FailureContext,
  startTime: number,
): RecoveryResult {
  // For now, fallback always results in manual recovery
  // In a full implementation, this would try the fallback strategy
  return {
    success: false,
    strategyUsed: plan.fallback,
    usedFallback: true,
    recoveredSections: [],
    unrecoveredSections: context.affectedSections,
    durationMs: Date.now() - startTime,
    message: `Primary ${plan.strategy} failed, fallback ${plan.fallback}: manual intervention needed`,
  };
}

/**
 * Resets the generation state after all retries exhausted.
 */
export function resetAfterFailure(state: GenerationState): GenerationState {
  return {
    ...state,
    generationId: null,
    isGenerating: false,
    retryCount: 0,
    preGenerationSnapshot: null,
  };
}

/**
 * Gets recovery statistics from state.
 */
export function getRecoveryStats(state: GenerationState): {
  totalAttempts: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  lastRecoveryStrategy: RecoveryStrategy | null;
  lastRecoverySuccess: boolean | null;
} {
  const attempts = state.rollbackState.attempts;
  const successful = attempts.filter((a) => a.result.success).length;
  const lastAttempt = attempts[attempts.length - 1];

  return {
    totalAttempts: attempts.length,
    successfulRecoveries: successful,
    failedRecoveries: attempts.length - successful,
    lastRecoveryStrategy: lastAttempt?.plan.strategy ?? null,
    lastRecoverySuccess: lastAttempt?.result.success ?? null,
  };
}

/**
 * Checks if recovery is possible given current state.
 */
export function canRecover(state: GenerationState): boolean {
  return (
    state.preGenerationSnapshot !== null ||
    state.retryCount < state.maxRetries
  );
}

/**
 * Gets the current snapshot for potential restore.
 */
export function getPreGenerationSnapshot(state: GenerationState): Snapshot | null {
  return state.preGenerationSnapshot;
}
