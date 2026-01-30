/**
 * ETACalculator — Estimated time remaining calculation based on plan steps.
 *
 * Feature #99: Implement estimated time remaining calculation
 * Verification: Shows 'Estimated: ~30s remaining' based on steps completed vs total
 *
 * Calculates estimated time remaining using weighted moving average of
 * step completion times, with adaptive smoothing for accuracy.
 *
 * @module lib/preview/eta-calculator
 */

// =============================================================================
// Types
// =============================================================================

/** Step timing information */
export interface StepTiming {
  /** Step index (0-based) */
  index: number;
  /** Step name/description */
  name: string;
  /** Start timestamp */
  startedAt: number;
  /** End timestamp (if completed) */
  completedAt?: number;
  /** Duration in ms (if completed) */
  duration?: number;
  /** Step weight (default: 1) */
  weight?: number;
}

/** ETA calculation state */
export interface ETAState {
  /** Total number of steps */
  totalSteps: number;
  /** Number of completed steps */
  completedSteps: number;
  /** Current step index */
  currentStep: number;
  /** Overall progress (0-100) */
  progress: number;
  /** Elapsed time since start (ms) */
  elapsedTime: number;
  /** Estimated remaining time (ms) */
  remainingTime: number;
  /** Estimated total time (ms) */
  estimatedTotalTime: number;
  /** Estimated completion timestamp */
  estimatedCompletion: number;
  /** Average step duration (ms) */
  averageStepDuration: number;
  /** Whether calculation is active */
  isActive: boolean;
  /** Whether calculation is complete */
  isComplete: boolean;
}

/** ETA calculator options */
export interface ETACalculatorOptions {
  /** Smoothing factor for moving average (0-1, default: 0.3) */
  smoothingFactor?: number;
  /** Minimum samples before showing ETA (default: 1) */
  minSamples?: number;
  /** Default step duration estimate in ms (default: 5000) */
  defaultStepDuration?: number;
  /** Update interval in ms (default: 1000) */
  updateInterval?: number;
  /** Use weighted average based on step weights (default: true) */
  useWeightedAverage?: boolean;
}

/** Formatted ETA display */
export interface ETADisplay {
  /** Short format: "~30s" */
  short: string;
  /** Medium format: "~30 seconds remaining" */
  medium: string;
  /** Long format: "Estimated: ~30 seconds remaining" */
  long: string;
  /** Progress format: "3/10 steps (30%)" */
  progress: string;
  /** Completion time format: "Complete at 3:45 PM" */
  completionTime: string;
  /** Whether ETA is available (enough data) */
  available: boolean;
  /** Raw remaining time in ms */
  remainingMs: number;
}

/** Callback for ETA updates */
export type ETAUpdateCallback = (state: ETAState, display: ETADisplay) => void;

// =============================================================================
// Constants
// =============================================================================

/** Default options */
const DEFAULT_OPTIONS: Required<ETACalculatorOptions> = {
  smoothingFactor: 0.3,
  minSamples: 1,
  defaultStepDuration: 5000,
  updateInterval: 1000,
  useWeightedAverage: true,
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Formats milliseconds to human-readable duration.
 */
export function formatDuration(ms: number): string {
  if (ms < 0) return "0s";

  const seconds = Math.round(ms / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    if (remainingSeconds === 0) {
      return `${minutes}m`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Formats time to locale time string.
 */
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Rounds to nearest significant value for display.
 */
export function roundForDisplay(ms: number): number {
  if (ms < 5000) {
    return Math.round(ms / 1000) * 1000; // Round to nearest second
  } else if (ms < 60000) {
    return Math.round(ms / 5000) * 5000; // Round to nearest 5 seconds
  } else if (ms < 300000) {
    return Math.round(ms / 15000) * 15000; // Round to nearest 15 seconds
  } else {
    return Math.round(ms / 60000) * 60000; // Round to nearest minute
  }
}

/**
 * Calculates exponential moving average.
 */
function exponentialMovingAverage(
  newValue: number,
  previousAverage: number,
  smoothingFactor: number
): number {
  return smoothingFactor * newValue + (1 - smoothingFactor) * previousAverage;
}

// =============================================================================
// ETACalculator Class
// =============================================================================

/**
 * ETACalculator — Calculates estimated time remaining for plan execution.
 *
 * Uses weighted moving average of step completion times for accuracy.
 *
 * @example
 * ```typescript
 * const eta = new ETACalculator({ totalSteps: 10 });
 *
 * // Start the calculation
 * eta.start();
 *
 * // Start each step
 * eta.startStep(0, "Reading files");
 *
 * // Complete steps
 * eta.completeStep(0);
 * eta.startStep(1, "Processing");
 * eta.completeStep(1);
 *
 * // Get ETA display
 * const display = eta.getDisplay();
 * console.log(display.long); // "Estimated: ~45 seconds remaining"
 *
 * // Listen for updates
 * eta.onUpdate((state, display) => {
 *   updateUI(display.short);
 * });
 * ```
 */
export class ETACalculator {
  private options: Required<ETACalculatorOptions>;
  private totalSteps: number;
  private stepTimings: Map<number, StepTiming> = new Map();
  private startTime: number | null = null;
  private currentStepIndex: number = -1;
  private completedCount: number = 0;
  private movingAverage: number = 0;
  private callbacks = new Set<ETAUpdateCallback>();
  private updateTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  constructor(
    totalSteps: number,
    options: ETACalculatorOptions = {}
  ) {
    this.totalSteps = Math.max(1, totalSteps);
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.movingAverage = this.options.defaultStepDuration;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Starts the ETA calculation.
   */
  start(): void {
    if (this.disposed) return;

    this.startTime = Date.now();
    this.currentStepIndex = -1;
    this.completedCount = 0;
    this.stepTimings.clear();
    this.movingAverage = this.options.defaultStepDuration;

    this.startUpdateTimer();
    this.notifyUpdate();
  }

  /**
   * Resets the calculator.
   */
  reset(): void {
    this.stopUpdateTimer();
    this.startTime = null;
    this.currentStepIndex = -1;
    this.completedCount = 0;
    this.stepTimings.clear();
    this.movingAverage = this.options.defaultStepDuration;
    this.notifyUpdate();
  }

  /**
   * Stops and completes the calculation.
   */
  complete(): void {
    this.stopUpdateTimer();
    this.notifyUpdate();
  }

  // ---------------------------------------------------------------------------
  // Step Tracking
  // ---------------------------------------------------------------------------

  /**
   * Starts a step.
   */
  startStep(index: number, name: string = `Step ${index + 1}`, weight = 1): void {
    if (this.disposed || index < 0 || index >= this.totalSteps) return;

    // Auto-complete previous step if still active
    if (this.currentStepIndex >= 0 && this.currentStepIndex !== index) {
      const prevTiming = this.stepTimings.get(this.currentStepIndex);
      if (prevTiming && !prevTiming.completedAt) {
        this.completeStep(this.currentStepIndex);
      }
    }

    this.currentStepIndex = index;

    const timing: StepTiming = {
      index,
      name,
      startedAt: Date.now(),
      weight,
    };

    this.stepTimings.set(index, timing);
    this.notifyUpdate();
  }

  /**
   * Completes a step.
   */
  completeStep(index: number): void {
    if (this.disposed) return;

    const timing = this.stepTimings.get(index);
    if (!timing || timing.completedAt) return;

    const now = Date.now();
    timing.completedAt = now;
    timing.duration = now - timing.startedAt;

    // Update moving average
    this.updateMovingAverage(timing);
    this.completedCount++;

    this.notifyUpdate();
  }

  /**
   * Sets step weights for better estimates.
   */
  setStepWeights(weights: number[]): void {
    for (let i = 0; i < weights.length && i < this.totalSteps; i++) {
      const timing = this.stepTimings.get(i);
      if (timing) {
        timing.weight = weights[i];
      }
    }
  }

  private updateMovingAverage(timing: StepTiming): void {
    if (!timing.duration) return;

    const weight = timing.weight ?? 1;
    const weightedDuration = timing.duration / weight;

    this.movingAverage = exponentialMovingAverage(
      weightedDuration,
      this.movingAverage,
      this.options.smoothingFactor
    );
  }

  // ---------------------------------------------------------------------------
  // ETA Calculation
  // ---------------------------------------------------------------------------

  /**
   * Gets the current ETA state.
   */
  getState(): ETAState {
    const now = Date.now();
    const isActive = this.startTime !== null;
    const isComplete = this.completedCount >= this.totalSteps;

    const elapsedTime = isActive ? now - this.startTime! : 0;
    const progress = (this.completedCount / this.totalSteps) * 100;

    // Calculate remaining time
    const remainingSteps = this.totalSteps - this.completedCount;
    let remainingTime = 0;

    if (this.options.useWeightedAverage) {
      // Calculate remaining time based on weighted average
      remainingTime = this.calculateWeightedRemainingTime(remainingSteps);
    } else {
      // Simple calculation based on moving average
      remainingTime = remainingSteps * this.movingAverage;
    }

    // Apply rounding for display stability
    remainingTime = roundForDisplay(remainingTime);

    const estimatedTotalTime = elapsedTime + remainingTime;
    const estimatedCompletion = now + remainingTime;

    return {
      totalSteps: this.totalSteps,
      completedSteps: this.completedCount,
      currentStep: this.currentStepIndex,
      progress: Math.round(progress * 10) / 10,
      elapsedTime,
      remainingTime,
      estimatedTotalTime,
      estimatedCompletion,
      averageStepDuration: Math.round(this.movingAverage),
      isActive,
      isComplete,
    };
  }

  private calculateWeightedRemainingTime(remainingSteps: number): number {
    if (remainingSteps <= 0) return 0;

    // Calculate total remaining weight
    let totalRemainingWeight = 0;
    for (let i = this.completedCount; i < this.totalSteps; i++) {
      const timing = this.stepTimings.get(i);
      totalRemainingWeight += timing?.weight ?? 1;
    }

    // Estimate remaining time based on average and weights
    return totalRemainingWeight * this.movingAverage;
  }

  /**
   * Gets formatted ETA display.
   */
  getDisplay(): ETADisplay {
    const state = this.getState();
    const hasEnoughData = this.completedCount >= this.options.minSamples;
    const available = hasEnoughData && state.isActive && !state.isComplete;

    const remainingRounded = roundForDisplay(state.remainingTime);
    const durationStr = formatDuration(remainingRounded);

    return {
      short: available ? `~${durationStr}` : "--",
      medium: available ? `~${durationStr} remaining` : "Calculating...",
      long: available
        ? `Estimated: ~${durationStr} remaining`
        : state.isComplete
          ? "Complete"
          : "Estimating...",
      progress: `${state.completedSteps}/${state.totalSteps} steps (${Math.round(state.progress)}%)`,
      completionTime: available
        ? `Complete at ${formatTime(state.estimatedCompletion)}`
        : "--",
      available,
      remainingMs: state.remainingTime,
    };
  }

  // ---------------------------------------------------------------------------
  // Update Timer
  // ---------------------------------------------------------------------------

  private startUpdateTimer(): void {
    this.stopUpdateTimer();

    if (this.options.updateInterval > 0) {
      this.updateTimer = setInterval(() => {
        this.notifyUpdate();
      }, this.options.updateInterval);
    }
  }

  private stopUpdateTimer(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  /**
   * Gets total steps.
   */
  getTotalSteps(): number {
    return this.totalSteps;
  }

  /**
   * Gets completed steps count.
   */
  getCompletedSteps(): number {
    return this.completedCount;
  }

  /**
   * Gets current step index.
   */
  getCurrentStepIndex(): number {
    return this.currentStepIndex;
  }

  /**
   * Gets step timing by index.
   */
  getStepTiming(index: number): StepTiming | undefined {
    return this.stepTimings.get(index);
  }

  /**
   * Gets all step timings.
   */
  getAllTimings(): StepTiming[] {
    return Array.from(this.stepTimings.values());
  }

  /**
   * Checks if active.
   */
  isActive(): boolean {
    return this.startTime !== null;
  }

  /**
   * Checks if complete.
   */
  isComplete(): boolean {
    return this.completedCount >= this.totalSteps;
  }

  // ---------------------------------------------------------------------------
  // Event Callbacks
  // ---------------------------------------------------------------------------

  /**
   * Registers a callback for ETA updates.
   */
  onUpdate(callback: ETAUpdateCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private notifyUpdate(): void {
    if (this.disposed) return;

    const state = this.getState();
    const display = this.getDisplay();

    for (const callback of this.callbacks) {
      try {
        callback(state, display);
      } catch (e) {
        console.error("ETACalculator update callback error:", e);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Disposes the calculator.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.stopUpdateTimer();
    this.callbacks.clear();
    this.stepTimings.clear();
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates an ETACalculator instance.
 */
export function createETACalculator(
  totalSteps: number,
  options?: ETACalculatorOptions
): ETACalculator {
  return new ETACalculator(totalSteps, options);
}

// =============================================================================
// Export
// =============================================================================

export default ETACalculator;
