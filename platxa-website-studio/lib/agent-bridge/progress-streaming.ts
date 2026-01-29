/**
 * Progress Streaming — Real-Time Phase Indicators with ETA
 *
 * Tracks generation phases with real-time progress events,
 * phase transitions, and estimated completion time based on
 * elapsed duration and historical phase timing.
 */

// =============================================================================
// Types
// =============================================================================

/** Generation phase names */
export type PhaseName =
  | "init"
  | "analyze"
  | "generate"
  | "validate"
  | "optimize"
  | "finalize"
  | "complete";

/** Phase execution status */
export type PhaseStatus = "pending" | "active" | "completed" | "skipped" | "failed";

/** A single phase in the pipeline */
export interface Phase {
  /** Phase name */
  name: PhaseName;
  /** Display label */
  label: string;
  /** Execution status */
  status: PhaseStatus;
  /** Expected weight (proportion of total time, 0-1) */
  weight: number;
  /** Phase start time (epoch ms), null if not started */
  startedAt: number | null;
  /** Phase end time (epoch ms), null if not ended */
  endedAt: number | null;
  /** Phase duration in ms (computed) */
  durationMs: number;
  /** Optional detail message */
  message?: string;
}

/** Progress stream state */
export interface ProgressState {
  /** All phases in order */
  phases: Phase[];
  /** Index of the currently active phase (-1 if not started) */
  activePhaseIndex: number;
  /** Overall start time (epoch ms) */
  startedAt: number | null;
  /** Overall end time (epoch ms) */
  completedAt: number | null;
  /** Whether the entire pipeline is complete */
  isComplete: boolean;
  /** Whether the pipeline has any failed phases */
  hasFailed: boolean;
}

/** Progress event emitted on state change */
export interface ProgressStreamEvent {
  /** Current phase name */
  currentPhase: PhaseName;
  /** Current phase label */
  currentPhaseLabel: string;
  /** Overall progress 0-1 */
  progress: number;
  /** Estimated time remaining in ms */
  estimatedRemainingMs: number;
  /** Elapsed time in ms */
  elapsedMs: number;
  /** Estimated total time in ms */
  estimatedTotalMs: number;
  /** Phases completed count */
  phasesCompleted: number;
  /** Total phases count */
  phasesTotal: number;
  /** Whether complete */
  isComplete: boolean;
  /** Optional message */
  message?: string;
}

// =============================================================================
// Default Phase Configuration
// =============================================================================

export const DEFAULT_PHASES: Array<{ name: PhaseName; label: string; weight: number }> = [
  { name: "init", label: "Initializing", weight: 0.05 },
  { name: "analyze", label: "Analyzing design intent", weight: 0.15 },
  { name: "generate", label: "Generating sections", weight: 0.45 },
  { name: "validate", label: "Validating output", weight: 0.15 },
  { name: "optimize", label: "Optimizing performance", weight: 0.10 },
  { name: "finalize", label: "Finalizing output", weight: 0.10 },
];

// =============================================================================
// State Management
// =============================================================================

/**
 * Creates a new progress state from phase definitions.
 */
export function createProgressState(
  phaseDefs: Array<{ name: PhaseName; label: string; weight: number }> = DEFAULT_PHASES,
): ProgressState {
  const phases: Phase[] = phaseDefs.map((def) => ({
    name: def.name,
    label: def.label,
    status: "pending",
    weight: def.weight,
    startedAt: null,
    endedAt: null,
    durationMs: 0,
  }));

  return {
    phases,
    activePhaseIndex: -1,
    startedAt: null,
    completedAt: null,
    isComplete: false,
    hasFailed: false,
  };
}

/**
 * Starts the next pending phase. If no phase is active, starts the first.
 * If a phase is active, completes it and starts the next.
 */
export function advancePhase(
  state: ProgressState,
  now: number = Date.now(),
  message?: string,
): ProgressState {
  const phases = state.phases.map((p) => ({ ...p }));
  let activeIndex = state.activePhaseIndex;
  let startedAt = state.startedAt;

  // Complete current active phase
  if (activeIndex >= 0 && activeIndex < phases.length) {
    const activePhase = phases[activeIndex];
    phases[activeIndex] = {
      ...activePhase,
      status: "completed",
      endedAt: now,
      durationMs: activePhase.startedAt != null ? now - activePhase.startedAt : 0,
    };
  }

  // Find next pending phase
  let nextIndex = -1;
  for (let i = activeIndex + 1; i < phases.length; i++) {
    if (phases[i].status === "pending") {
      nextIndex = i;
      break;
    }
  }

  if (nextIndex >= 0) {
    phases[nextIndex] = {
      ...phases[nextIndex],
      status: "active",
      startedAt: now,
      message,
    };
    activeIndex = nextIndex;
    if (startedAt === null) startedAt = now;
  }

  const allDone = phases.every((p) => p.status === "completed" || p.status === "skipped");

  return {
    ...state,
    phases,
    activePhaseIndex: allDone ? -1 : activeIndex,
    startedAt,
    completedAt: allDone ? now : null,
    isComplete: allDone,
    hasFailed: phases.some((p) => p.status === "failed"),
  };
}

/**
 * Marks the current active phase as failed.
 */
export function failCurrentPhase(
  state: ProgressState,
  errorMessage: string,
  now: number = Date.now(),
): ProgressState {
  if (state.activePhaseIndex < 0) return state;

  const phases = state.phases.map((p) => ({ ...p }));
  const idx = state.activePhaseIndex;
  phases[idx] = {
    ...phases[idx],
    status: "failed",
    endedAt: now,
    durationMs: phases[idx].startedAt != null ? now - phases[idx].startedAt : 0,
    message: errorMessage,
  };

  return {
    ...state,
    phases,
    hasFailed: true,
  };
}

/**
 * Skips a pending phase by name.
 */
export function skipPhase(
  state: ProgressState,
  phaseName: PhaseName,
): ProgressState {
  const phases = state.phases.map((p) =>
    p.name === phaseName && p.status === "pending"
      ? { ...p, status: "skipped" as PhaseStatus }
      : p,
  );
  return { ...state, phases };
}

/**
 * Marks the entire pipeline as complete.
 */
export function completeAll(
  state: ProgressState,
  now: number = Date.now(),
): ProgressState {
  const phases = state.phases.map((p) => {
    if (p.status === "active") {
      return { ...p, status: "completed" as PhaseStatus, endedAt: now, durationMs: p.startedAt != null ? now - p.startedAt : 0 };
    }
    if (p.status === "pending") {
      return { ...p, status: "skipped" as PhaseStatus };
    }
    return p;
  });

  return {
    ...state,
    phases,
    activePhaseIndex: -1,
    completedAt: now,
    isComplete: true,
  };
}

// =============================================================================
// Progress Calculation
// =============================================================================

/**
 * Computes overall progress (0-1) based on completed phase weights.
 */
export function computeProgress(state: ProgressState): number {
  let completed = 0;
  let activePartial = 0;

  for (const phase of state.phases) {
    if (phase.status === "completed" || phase.status === "skipped") {
      completed += phase.weight;
    } else if (phase.status === "active") {
      // Estimate partial progress within active phase based on elapsed time
      // Use a sigmoid-like curve: assume 50% done at half expected duration
      activePartial += phase.weight * 0.5; // conservative estimate
    }
  }

  return Math.min(1, completed + activePartial);
}

/**
 * Estimates remaining time based on elapsed time and progress.
 */
export function estimateRemainingMs(state: ProgressState, now: number = Date.now()): number {
  if (state.isComplete || state.startedAt === null) return 0;

  const elapsed = now - state.startedAt;
  const progress = computeProgress(state);

  if (progress <= 0) return 0;
  if (progress >= 1) return 0;

  // Linear extrapolation: total = elapsed / progress
  const estimatedTotal = elapsed / progress;
  return Math.max(0, Math.round(estimatedTotal - elapsed));
}

/**
 * Generates a progress stream event from current state.
 */
export function getProgressEvent(
  state: ProgressState,
  now: number = Date.now(),
): ProgressStreamEvent {
  const activePhase = state.activePhaseIndex >= 0
    ? state.phases[state.activePhaseIndex]
    : null;

  const elapsed = state.startedAt != null ? now - state.startedAt : 0;
  const progress = computeProgress(state);
  const remaining = estimateRemainingMs(state, now);
  const phasesCompleted = state.phases.filter(
    (p) => p.status === "completed" || p.status === "skipped",
  ).length;

  return {
    currentPhase: activePhase?.name ?? (state.isComplete ? "complete" : "init"),
    currentPhaseLabel: activePhase?.label ?? (state.isComplete ? "Complete" : "Waiting"),
    progress,
    estimatedRemainingMs: remaining,
    elapsedMs: elapsed,
    estimatedTotalMs: elapsed + remaining,
    phasesCompleted,
    phasesTotal: state.phases.length,
    isComplete: state.isComplete,
    message: activePhase?.message,
  };
}

/**
 * Returns a human-readable summary of phase durations.
 */
export function getPhaseSummary(state: ProgressState): Array<{
  name: PhaseName;
  label: string;
  status: PhaseStatus;
  durationMs: number;
}> {
  return state.phases.map((p) => ({
    name: p.name,
    label: p.label,
    status: p.status,
    durationMs: p.durationMs,
  }));
}
