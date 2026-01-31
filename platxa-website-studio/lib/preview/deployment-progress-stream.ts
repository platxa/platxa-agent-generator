/**
 * Deployment Progress Stream
 *
 * Streams deployment progress to UI with real-time stage updates.
 * Stages: Packaging → Uploading → Installing → Verifying → Complete
 */

// =============================================================================
// Types
// =============================================================================

/** Deployment stage names */
export type DeploymentStage =
  | "packaging"
  | "uploading"
  | "installing"
  | "verifying"
  | "complete";

/** Stage execution status */
export type StageStatus =
  | "pending"
  | "active"
  | "completed"
  | "failed"
  | "skipped";

/** A single stage in the deployment pipeline */
export interface DeploymentStageInfo {
  /** Stage name */
  name: DeploymentStage;
  /** Display label */
  label: string;
  /** Execution status */
  status: StageStatus;
  /** Expected weight (proportion of total time, 0-1) */
  weight: number;
  /** Stage start time (epoch ms), null if not started */
  startedAt: number | null;
  /** Stage end time (epoch ms), null if not ended */
  endedAt: number | null;
  /** Stage duration in ms (computed) */
  durationMs: number;
  /** Optional detail message */
  message?: string;
  /** Substep progress (0-100) for stages with multiple operations */
  substepProgress?: number;
  /** Substep label (e.g., "Uploading file 3/10") */
  substepLabel?: string;
}

/** Deployment progress state */
export interface DeploymentProgressState {
  /** Unique deployment ID */
  deploymentId: string;
  /** All stages in order */
  stages: DeploymentStageInfo[];
  /** Index of currently active stage (-1 if not started) */
  activeStageIndex: number;
  /** Overall start time (epoch ms) */
  startedAt: number | null;
  /** Overall end time (epoch ms) */
  completedAt: number | null;
  /** Whether deployment is complete */
  isComplete: boolean;
  /** Whether deployment has failed */
  hasFailed: boolean;
  /** Error message if failed */
  error?: string;
  /** Target environment */
  target: "preview" | "staging" | "production";
  /** Peak progress achieved (ensures monotonic increase) */
  peakProgress: number;
}

/** Progress event emitted on state change */
export interface DeploymentProgressEvent {
  /** Deployment ID */
  deploymentId: string;
  /** Current stage name */
  currentStage: DeploymentStage;
  /** Current stage label */
  currentStageLabel: string;
  /** Overall progress (0-1) */
  progress: number;
  /** Estimated time remaining (ms) */
  estimatedRemainingMs: number;
  /** Elapsed time (ms) */
  elapsedMs: number;
  /** Estimated total time (ms) */
  estimatedTotalMs: number;
  /** Stages completed count */
  stagesCompleted: number;
  /** Total stages count */
  stagesTotal: number;
  /** Whether complete */
  isComplete: boolean;
  /** Whether failed */
  hasFailed: boolean;
  /** Optional message */
  message?: string;
  /** Substep progress for current stage (0-100) */
  substepProgress?: number;
  /** Substep label */
  substepLabel?: string;
  /** Target environment */
  target: "preview" | "staging" | "production";
}

/** Event callback type */
export type DeploymentProgressCallback = (event: DeploymentProgressEvent) => void;

/** Stream event types */
export type StreamEventType =
  | "stage_start"
  | "stage_progress"
  | "stage_complete"
  | "stage_failed"
  | "deployment_complete"
  | "deployment_failed";

/** Stream event */
export interface StreamEvent {
  type: StreamEventType;
  timestamp: number;
  deploymentId: string;
  stage?: DeploymentStage;
  progress?: DeploymentProgressEvent;
  error?: string;
}

// =============================================================================
// Default Stage Configuration
// =============================================================================

/** Default deployment stages with weights */
export const DEFAULT_DEPLOYMENT_STAGES: Array<{
  name: DeploymentStage;
  label: string;
  weight: number;
}> = [
  { name: "packaging", label: "Packaging module", weight: 0.15 },
  { name: "uploading", label: "Uploading to server", weight: 0.25 },
  { name: "installing", label: "Installing module", weight: 0.35 },
  { name: "verifying", label: "Verifying deployment", weight: 0.20 },
  { name: "complete", label: "Complete", weight: 0.05 },
];

// =============================================================================
// State Management
// =============================================================================

/**
 * Creates initial deployment progress state.
 */
export function createDeploymentProgressState(
  deploymentId: string,
  target: "preview" | "staging" | "production" = "preview",
  stageDefs: Array<{ name: DeploymentStage; label: string; weight: number }> = DEFAULT_DEPLOYMENT_STAGES
): DeploymentProgressState {
  const stages: DeploymentStageInfo[] = stageDefs.map((def) => ({
    name: def.name,
    label: def.label,
    status: "pending",
    weight: def.weight,
    startedAt: null,
    endedAt: null,
    durationMs: 0,
  }));

  return {
    deploymentId,
    stages,
    activeStageIndex: -1,
    startedAt: null,
    completedAt: null,
    isComplete: false,
    hasFailed: false,
    target,
    peakProgress: 0,
  };
}

/**
 * Starts the next pending stage or the first stage.
 */
export function advanceStage(
  state: DeploymentProgressState,
  now: number = Date.now(),
  message?: string
): DeploymentProgressState {
  const stages = state.stages.map((s) => ({ ...s }));
  let activeIndex = state.activeStageIndex;
  let startedAt = state.startedAt;

  // Complete current active stage
  if (activeIndex >= 0 && activeIndex < stages.length) {
    const activeStage = stages[activeIndex];
    stages[activeIndex] = {
      ...activeStage,
      status: "completed",
      endedAt: now,
      durationMs: activeStage.startedAt != null ? now - activeStage.startedAt : 0,
      substepProgress: 100,
    };
  }

  // Find next pending stage
  let nextIndex = -1;
  for (let i = activeIndex + 1; i < stages.length; i++) {
    if (stages[i].status === "pending") {
      nextIndex = i;
      break;
    }
  }

  if (nextIndex >= 0) {
    stages[nextIndex] = {
      ...stages[nextIndex],
      status: "active",
      startedAt: now,
      message,
      // Don't initialize substepProgress - leave undefined for 50% estimate
      // until explicit progress is reported
    };
    activeIndex = nextIndex;
    if (startedAt === null) startedAt = now;
  }

  const allDone = stages.every(
    (s) => s.status === "completed" || s.status === "skipped"
  );

  const newState: DeploymentProgressState = {
    ...state,
    stages,
    activeStageIndex: allDone ? -1 : activeIndex,
    startedAt,
    completedAt: allDone ? now : null,
    isComplete: allDone,
    hasFailed: stages.some((s) => s.status === "failed"),
    peakProgress: state.peakProgress,
  };

  // Update peak progress
  const rawProgress = computeRawProgress(newState);
  newState.peakProgress = Math.max(newState.peakProgress, rawProgress);

  return newState;
}

/**
 * Updates substep progress for the current active stage.
 */
export function updateSubstepProgress(
  state: DeploymentProgressState,
  progress: number,
  label?: string
): DeploymentProgressState {
  if (state.activeStageIndex < 0) return state;

  const stages = state.stages.map((s) => ({ ...s }));
  const idx = state.activeStageIndex;
  stages[idx] = {
    ...stages[idx],
    substepProgress: Math.min(100, Math.max(0, progress)),
    substepLabel: label,
  };

  const newState: DeploymentProgressState = { ...state, stages };

  // Update peak progress
  const rawProgress = computeRawProgress(newState);
  newState.peakProgress = Math.max(newState.peakProgress, rawProgress);

  return newState;
}

/**
 * Marks the current active stage as failed.
 */
export function failCurrentStage(
  state: DeploymentProgressState,
  errorMessage: string,
  now: number = Date.now()
): DeploymentProgressState {
  if (state.activeStageIndex < 0) return state;

  const stages = state.stages.map((s) => ({ ...s }));
  const idx = state.activeStageIndex;
  stages[idx] = {
    ...stages[idx],
    status: "failed",
    endedAt: now,
    durationMs: stages[idx].startedAt != null ? now - stages[idx].startedAt : 0,
    message: errorMessage,
  };

  return {
    ...state,
    stages,
    hasFailed: true,
    error: errorMessage,
  };
}

/**
 * Skips a pending stage by name.
 */
export function skipStage(
  state: DeploymentProgressState,
  stageName: DeploymentStage
): DeploymentProgressState {
  const stages = state.stages.map((s) =>
    s.name === stageName && s.status === "pending"
      ? { ...s, status: "skipped" as StageStatus }
      : s
  );
  return { ...state, stages };
}

/**
 * Marks deployment as complete.
 * Completes all active and pending stages (no skipping on success).
 */
export function completeDeployment(
  state: DeploymentProgressState,
  now: number = Date.now()
): DeploymentProgressState {
  const stages = state.stages.map((s) => {
    if (s.status === "active") {
      return {
        ...s,
        status: "completed" as StageStatus,
        endedAt: now,
        durationMs: s.startedAt != null ? now - s.startedAt : 0,
        substepProgress: 100,
      };
    }
    if (s.status === "pending") {
      // On successful completion, mark pending stages as completed (instant)
      // This handles the final "complete" stage and any skipped intermediate stages
      return {
        ...s,
        status: "completed" as StageStatus,
        startedAt: now,
        endedAt: now,
        durationMs: 0,
        substepProgress: 100,
      };
    }
    return s;
  });

  return {
    ...state,
    stages,
    activeStageIndex: -1,
    completedAt: now,
    isComplete: true,
    peakProgress: 1, // Complete means 100%
  };
}

// =============================================================================
// Progress Calculation
// =============================================================================

/**
 * Computes raw progress (0-1) based on completed stage weights.
 * Does not account for peak progress - use getMonotonicProgress for that.
 */
export function computeRawProgress(state: DeploymentProgressState): number {
  let completed = 0;
  let activePartial = 0;

  for (const stage of state.stages) {
    if (stage.status === "completed" || stage.status === "skipped") {
      completed += stage.weight;
    } else if (stage.status === "active") {
      // Use substep progress if available, otherwise estimate 50%
      const substepFactor = stage.substepProgress != null
        ? stage.substepProgress / 100
        : 0.5;
      activePartial += stage.weight * substepFactor;
    }
  }

  return Math.min(1, completed + activePartial);
}

/**
 * Computes overall progress (0-1) ensuring monotonic increase.
 * Progress never decreases once it reaches a certain level.
 */
export function computeDeploymentProgress(state: DeploymentProgressState): number {
  const raw = computeRawProgress(state);
  return Math.max(raw, state.peakProgress);
}

/**
 * Estimates remaining time based on elapsed time and progress.
 */
export function estimateRemainingMs(
  state: DeploymentProgressState,
  now: number = Date.now()
): number {
  if (state.isComplete || state.startedAt === null) return 0;

  const elapsed = now - state.startedAt;
  const progress = computeDeploymentProgress(state);

  if (progress <= 0) return 0;
  if (progress >= 1) return 0;

  const estimatedTotal = elapsed / progress;
  return Math.max(0, Math.round(estimatedTotal - elapsed));
}

/**
 * Generates a progress event from current state.
 */
export function getDeploymentProgressEvent(
  state: DeploymentProgressState,
  now: number = Date.now()
): DeploymentProgressEvent {
  const activeStage = state.activeStageIndex >= 0
    ? state.stages[state.activeStageIndex]
    : null;

  const elapsed = state.startedAt != null ? now - state.startedAt : 0;
  const progress = computeDeploymentProgress(state);
  const remaining = estimateRemainingMs(state, now);
  const stagesCompleted = state.stages.filter(
    (s) => s.status === "completed" || s.status === "skipped"
  ).length;

  return {
    deploymentId: state.deploymentId,
    currentStage: activeStage?.name ?? (state.isComplete ? "complete" : "packaging"),
    currentStageLabel: activeStage?.label ?? (state.isComplete ? "Complete" : "Waiting"),
    progress,
    estimatedRemainingMs: remaining,
    elapsedMs: elapsed,
    estimatedTotalMs: elapsed + remaining,
    stagesCompleted,
    stagesTotal: state.stages.length,
    isComplete: state.isComplete,
    hasFailed: state.hasFailed,
    message: activeStage?.message,
    substepProgress: activeStage?.substepProgress,
    substepLabel: activeStage?.substepLabel,
    target: state.target,
  };
}

/**
 * Returns a summary of stage durations.
 */
export function getStageSummary(state: DeploymentProgressState): Array<{
  name: DeploymentStage;
  label: string;
  status: StageStatus;
  durationMs: number;
}> {
  return state.stages.map((s) => ({
    name: s.name,
    label: s.label,
    status: s.status,
    durationMs: s.durationMs,
  }));
}

// =============================================================================
// DeploymentProgressStream Class
// =============================================================================

/**
 * Manages deployment progress streaming to UI.
 *
 * @example
 * ```typescript
 * const stream = new DeploymentProgressStream("deploy-123");
 *
 * stream.onProgress((event) => {
 *   updateUI(event.currentStageLabel, event.progress);
 * });
 *
 * // Start deployment stages
 * stream.startStage("packaging");
 * stream.updateProgress(50, "Creating archive...");
 * stream.startStage("uploading");
 * // ... etc
 * stream.complete();
 * ```
 */
export class DeploymentProgressStream {
  private state: DeploymentProgressState;
  private callbacks: DeploymentProgressCallback[] = [];
  private streamCallbacks: Array<(event: StreamEvent) => void> = [];

  constructor(
    deploymentId: string,
    target: "preview" | "staging" | "production" = "preview",
    stageDefs?: Array<{ name: DeploymentStage; label: string; weight: number }>
  ) {
    this.state = createDeploymentProgressState(deploymentId, target, stageDefs);
  }

  // ---------------------------------------------------------------------------
  // Stage Control
  // ---------------------------------------------------------------------------

  /**
   * Starts the next stage (or first stage if none started).
   */
  startNextStage(message?: string): void {
    this.state = advanceStage(this.state, Date.now(), message);
    this.emitProgress();

    const activeStage = this.getActiveStage();
    if (activeStage) {
      this.emitStreamEvent({
        type: "stage_start",
        timestamp: Date.now(),
        deploymentId: this.state.deploymentId,
        stage: activeStage.name,
        progress: getDeploymentProgressEvent(this.state),
      });
    }
  }

  /**
   * Starts a specific stage by name.
   */
  startStage(stageName: DeploymentStage, message?: string): void {
    // Skip to the specified stage
    while (this.state.activeStageIndex < this.state.stages.length - 1) {
      const nextStage = this.state.stages[this.state.activeStageIndex + 1];
      if (nextStage.name === stageName) {
        this.startNextStage(message);
        return;
      }
      // Skip intermediate stages
      this.state = skipStage(this.state, nextStage.name);
      this.state = advanceStage(this.state);
    }
  }

  /**
   * Updates progress within the current stage.
   */
  updateProgress(substepProgress: number, substepLabel?: string): void {
    this.state = updateSubstepProgress(this.state, substepProgress, substepLabel);
    this.emitProgress();

    this.emitStreamEvent({
      type: "stage_progress",
      timestamp: Date.now(),
      deploymentId: this.state.deploymentId,
      stage: this.getActiveStage()?.name,
      progress: getDeploymentProgressEvent(this.state),
    });
  }

  /**
   * Updates the message for the current stage.
   */
  updateMessage(message: string): void {
    if (this.state.activeStageIndex >= 0) {
      const stages = this.state.stages.map((s) => ({ ...s }));
      stages[this.state.activeStageIndex].message = message;
      this.state = { ...this.state, stages };
      this.emitProgress();
    }
  }

  /**
   * Marks the current stage as failed.
   */
  failStage(errorMessage: string): void {
    const stage = this.getActiveStage()?.name;
    this.state = failCurrentStage(this.state, errorMessage);
    this.emitProgress();

    this.emitStreamEvent({
      type: "stage_failed",
      timestamp: Date.now(),
      deploymentId: this.state.deploymentId,
      stage,
      error: errorMessage,
      progress: getDeploymentProgressEvent(this.state),
    });

    this.emitStreamEvent({
      type: "deployment_failed",
      timestamp: Date.now(),
      deploymentId: this.state.deploymentId,
      error: errorMessage,
      progress: getDeploymentProgressEvent(this.state),
    });
  }

  /**
   * Marks deployment as complete.
   */
  complete(): void {
    this.state = completeDeployment(this.state);
    this.emitProgress();

    this.emitStreamEvent({
      type: "deployment_complete",
      timestamp: Date.now(),
      deploymentId: this.state.deploymentId,
      progress: getDeploymentProgressEvent(this.state),
    });
  }

  // ---------------------------------------------------------------------------
  // State Queries
  // ---------------------------------------------------------------------------

  /**
   * Gets current state.
   */
  getState(): DeploymentProgressState {
    return { ...this.state };
  }

  /**
   * Gets current progress event.
   */
  getProgressEvent(): DeploymentProgressEvent {
    return getDeploymentProgressEvent(this.state);
  }

  /**
   * Gets the currently active stage.
   */
  getActiveStage(): DeploymentStageInfo | null {
    return this.state.activeStageIndex >= 0
      ? this.state.stages[this.state.activeStageIndex]
      : null;
  }

  /**
   * Checks if deployment is complete.
   */
  isComplete(): boolean {
    return this.state.isComplete;
  }

  /**
   * Checks if deployment has failed.
   */
  hasFailed(): boolean {
    return this.state.hasFailed;
  }

  /**
   * Gets stage summary.
   */
  getSummary(): ReturnType<typeof getStageSummary> {
    return getStageSummary(this.state);
  }

  // ---------------------------------------------------------------------------
  // Event Handling
  // ---------------------------------------------------------------------------

  /**
   * Registers progress callback.
   */
  onProgress(callback: DeploymentProgressCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Removes progress callback.
   */
  offProgress(callback: DeploymentProgressCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Registers stream event callback.
   */
  onStreamEvent(callback: (event: StreamEvent) => void): void {
    this.streamCallbacks.push(callback);
  }

  /**
   * Removes stream event callback.
   */
  offStreamEvent(callback: (event: StreamEvent) => void): void {
    const index = this.streamCallbacks.indexOf(callback);
    if (index !== -1) {
      this.streamCallbacks.splice(index, 1);
    }
  }

  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

  private emitProgress(): void {
    const event = getDeploymentProgressEvent(this.state);
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch {
        // Ignore callback errors
      }
    }
  }

  private emitStreamEvent(event: StreamEvent): void {
    for (const callback of this.streamCallbacks) {
      try {
        callback(event);
      } catch {
        // Ignore callback errors
      }
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a DeploymentProgressStream instance.
 */
export function createDeploymentProgressStream(
  deploymentId: string,
  target: "preview" | "staging" | "production" = "preview"
): DeploymentProgressStream {
  return new DeploymentProgressStream(deploymentId, target);
}

/**
 * Creates a deployment ID.
 */
export function generateDeploymentId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `deploy_${timestamp}_${random}`;
}
