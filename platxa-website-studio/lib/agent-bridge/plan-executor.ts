/**
 * Plan Executor — Sequential Execution of Implementation Plans
 *
 * Takes an ImplementationPlan generated in Chat mode and executes
 * steps sequentially in Agent mode. Tracks progress, handles failures,
 * and supports pause/resume functionality.
 *
 * This bridges the "plan before execute" paradigm with actual implementation.
 */

import { getModeManager } from "./mode-manager";
import type { ImplementationPlan, PlanStep, ToolResult } from "./chat-mode";

// =============================================================================
// Types
// =============================================================================

/** Status of a single step execution */
export type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

/** Result of executing a single step */
export interface StepExecutionResult {
  stepId: string;
  status: StepStatus;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  result?: ToolResult;
  error?: string;
  retryCount: number;
}

/** Overall execution status */
export type ExecutionStatus =
  | "idle"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

/** Execution progress information */
export interface ExecutionProgress {
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  currentStep: number;
  percentComplete: number;
  estimatedRemainingMs?: number;
}

/** Full execution state */
export interface ExecutionState {
  planId: string;
  status: ExecutionStatus;
  progress: ExecutionProgress;
  stepResults: Map<string, StepExecutionResult>;
  startedAt?: number;
  completedAt?: number;
  pausedAt?: number;
  error?: string;
}

/** Event emitted during execution */
export interface ExecutionEvent {
  type: ExecutionEventType;
  planId: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export type ExecutionEventType =
  | "execution_started"
  | "step_started"
  | "step_completed"
  | "step_failed"
  | "step_skipped"
  | "execution_paused"
  | "execution_resumed"
  | "execution_completed"
  | "execution_failed"
  | "execution_cancelled";

/** Tool executor function type */
export type ToolExecutorFn = (
  tool: string,
  params: Record<string, unknown>
) => Promise<ToolResult>;

/** Execution event listener */
export type ExecutionEventListener = (event: ExecutionEvent) => void;

/** Plan executor configuration */
export interface PlanExecutorConfig {
  /** Maximum retries per step */
  maxRetries: number;
  /** Delay between retries (ms) */
  retryDelayMs: number;
  /** Whether to continue on step failure */
  continueOnFailure: boolean;
  /** Timeout per step (ms) */
  stepTimeoutMs: number;
  /** Whether to require Agent mode */
  requireAgentMode: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/** Default executor configuration */
export const DEFAULT_EXECUTOR_CONFIG: PlanExecutorConfig = {
  maxRetries: 2,
  retryDelayMs: 1000,
  continueOnFailure: false,
  stepTimeoutMs: 60000,
  requireAgentMode: true,
};

// =============================================================================
// Helper Functions
// =============================================================================

/** Create initial execution state */
function createExecutionState(plan: ImplementationPlan): ExecutionState {
  return {
    planId: plan.id,
    status: "idle",
    progress: {
      totalSteps: plan.steps.length,
      completedSteps: 0,
      failedSteps: 0,
      skippedSteps: 0,
      currentStep: 0,
      percentComplete: 0,
    },
    stepResults: new Map(),
  };
}

/** Update progress from step results */
function updateProgress(state: ExecutionState): void {
  let completed = 0;
  let failed = 0;
  let skipped = 0;

  state.stepResults.forEach((result) => {
    switch (result.status) {
      case "completed":
        completed++;
        break;
      case "failed":
        failed++;
        break;
      case "skipped":
        skipped++;
        break;
    }
  });

  const total = state.progress.totalSteps;
  const done = completed + failed + skipped;

  state.progress = {
    ...state.progress,
    completedSteps: completed,
    failedSteps: failed,
    skippedSteps: skipped,
    percentComplete: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

/** Sleep utility */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Create timeout promise */
function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMsg));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

// =============================================================================
// PlanExecutor Class
// =============================================================================

/**
 * PlanExecutor executes implementation plans step by step.
 *
 * Usage:
 * ```ts
 * const executor = new PlanExecutor(toolExecutor);
 *
 * // Listen for events
 * executor.on("step_completed", (event) => {
 *   console.log(`Step completed: ${event.data?.stepId}`);
 * });
 *
 * // Execute a plan
 * const result = await executor.execute(plan);
 *
 * // Or execute with pause/resume
 * executor.start(plan);
 * // ... later
 * executor.pause();
 * // ... later
 * executor.resume();
 * ```
 */
export class PlanExecutor {
  private config: PlanExecutorConfig;
  private toolExecutor: ToolExecutorFn;
  private listeners: Set<ExecutionEventListener> = new Set();
  private state: ExecutionState | null = null;
  private currentPlan: ImplementationPlan | null = null;
  private abortController: AbortController | null = null;

  constructor(
    toolExecutor: ToolExecutorFn,
    config: Partial<PlanExecutorConfig> = {}
  ) {
    this.toolExecutor = toolExecutor;
    this.config = { ...DEFAULT_EXECUTOR_CONFIG, ...config };
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  /** Get current configuration */
  getConfig(): PlanExecutorConfig {
    return { ...this.config };
  }

  /** Update configuration */
  setConfig(config: Partial<PlanExecutorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ---------------------------------------------------------------------------
  // Event System
  // ---------------------------------------------------------------------------

  /** Subscribe to execution events */
  on(listener: ExecutionEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Unsubscribe from execution events */
  off(listener: ExecutionEventListener): void {
    this.listeners.delete(listener);
  }

  /** Emit an event */
  private emit(type: ExecutionEventType, data?: Record<string, unknown>): void {
    if (!this.state) return;

    const event: ExecutionEvent = {
      type,
      planId: this.state.planId,
      timestamp: Date.now(),
      data,
    };

    const listeners = Array.from(this.listeners);
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("[PlanExecutor] Event listener error:", error);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // State Access
  // ---------------------------------------------------------------------------

  /** Get current execution state */
  getState(): ExecutionState | null {
    return this.state ? { ...this.state, stepResults: new Map(this.state.stepResults) } : null;
  }

  /** Get current progress */
  getProgress(): ExecutionProgress | null {
    return this.state ? { ...this.state.progress } : null;
  }

  /** Get result for a specific step */
  getStepResult(stepId: string): StepExecutionResult | undefined {
    return this.state?.stepResults.get(stepId);
  }

  /** Check if currently executing */
  isRunning(): boolean {
    return this.state?.status === "running";
  }

  /** Check if paused */
  isPaused(): boolean {
    return this.state?.status === "paused";
  }

  /** Get current execution status */
  getStatus(): ExecutionStatus {
    return this.state?.status ?? "idle";
  }

  // ---------------------------------------------------------------------------
  // Execution Control
  // ---------------------------------------------------------------------------

  /**
   * Execute a plan synchronously (blocking).
   * Returns when plan completes or fails.
   */
  async execute(plan: ImplementationPlan): Promise<ExecutionState> {
    this.start(plan);

    // Wait for completion
    while (this.state && (this.state.status === "running" || this.state.status === "idle")) {
      await sleep(100);
    }

    return this.state!;
  }

  /**
   * Start executing a plan (non-blocking).
   */
  start(plan: ImplementationPlan): void {
    if (this.state?.status === "running") {
      throw new Error("Already executing a plan");
    }

    // Check mode requirement
    if (this.config.requireAgentMode) {
      const manager = getModeManager();
      if (manager.getMode() !== "agent") {
        manager.toAgentMode("system");
      }
    }

    // Initialize state
    this.currentPlan = plan;
    this.state = createExecutionState(plan);
    this.abortController = new AbortController();

    // Start execution
    this.runExecution().catch((error) => {
      if (this.state) {
        this.state.status = "failed";
        this.state.error = error instanceof Error ? error.message : String(error);
        this.emit("execution_failed", { error: this.state.error });
      }
    });
  }

  /**
   * Pause execution.
   */
  pause(): boolean {
    if (!this.state || this.state.status !== "running") {
      return false;
    }

    this.state.status = "paused";
    this.state.pausedAt = Date.now();
    this.emit("execution_paused");
    return true;
  }

  /**
   * Resume paused execution.
   */
  resume(): boolean {
    if (!this.state || this.state.status !== "paused") {
      return false;
    }

    this.state.status = "running";
    this.state.pausedAt = undefined;
    this.emit("execution_resumed");

    // Continue execution
    this.runExecution().catch((error) => {
      if (this.state) {
        this.state.status = "failed";
        this.state.error = error instanceof Error ? error.message : String(error);
        this.emit("execution_failed", { error: this.state.error });
      }
    });

    return true;
  }

  /**
   * Cancel execution.
   */
  cancel(): boolean {
    if (!this.state || (this.state.status !== "running" && this.state.status !== "paused")) {
      return false;
    }

    this.abortController?.abort();
    this.state.status = "cancelled";
    this.state.completedAt = Date.now();
    this.emit("execution_cancelled");
    return true;
  }

  /**
   * Skip the current step.
   */
  skipCurrentStep(): boolean {
    if (!this.state || !this.currentPlan || this.state.status !== "running") {
      return false;
    }

    const currentStepIndex = this.state.progress.currentStep;
    if (currentStepIndex >= this.currentPlan.steps.length) {
      return false;
    }

    const step = this.currentPlan.steps[currentStepIndex];
    this.state.stepResults.set(step.id, {
      stepId: step.id,
      status: "skipped",
      startedAt: Date.now(),
      completedAt: Date.now(),
      durationMs: 0,
      retryCount: 0,
    });

    updateProgress(this.state);
    this.emit("step_skipped", { stepId: step.id });
    return true;
  }

  // ---------------------------------------------------------------------------
  // Internal Execution
  // ---------------------------------------------------------------------------

  /**
   * Main execution loop.
   */
  private async runExecution(): Promise<void> {
    if (!this.state || !this.currentPlan) return;

    this.state.status = "running";
    this.state.startedAt = this.state.startedAt || Date.now();
    this.emit("execution_started");

    const steps = this.currentPlan.steps;
    let currentIndex = this.state.progress.currentStep;

    while (currentIndex < steps.length) {
      // Check for pause/cancel (use getter to avoid TypeScript narrowing)
      const currentStatus = this.getStatus();
      if (currentStatus === "paused" || currentStatus === "cancelled") {
        return;
      }

      // Check abort signal
      if (this.abortController?.signal.aborted) {
        return;
      }

      const step = steps[currentIndex];

      // Skip already completed/failed/skipped steps
      const existing = this.state.stepResults.get(step.id);
      if (existing && existing.status !== "pending" && existing.status !== "running") {
        currentIndex++;
        this.state.progress.currentStep = currentIndex;
        continue;
      }

      // Execute step
      const result = await this.executeStep(step);
      this.state.stepResults.set(step.id, result);
      updateProgress(this.state);

      // Handle failure
      if (result.status === "failed" && !this.config.continueOnFailure) {
        this.state.status = "failed";
        this.state.completedAt = Date.now();
        this.state.error = result.error || "Step execution failed";
        this.emit("execution_failed", { stepId: step.id, error: this.state.error });
        return;
      }

      currentIndex++;
      this.state.progress.currentStep = currentIndex;
    }

    // All steps completed
    this.state.status = "completed";
    this.state.completedAt = Date.now();
    this.emit("execution_completed", {
      totalDurationMs: this.state.completedAt - (this.state.startedAt || 0),
    });
  }

  /**
   * Execute a single step with retries.
   */
  private async executeStep(step: PlanStep): Promise<StepExecutionResult> {
    const result: StepExecutionResult = {
      stepId: step.id,
      status: "running",
      startedAt: Date.now(),
      retryCount: 0,
    };

    this.emit("step_started", { stepId: step.id, tool: step.tool });

    let lastError: string | undefined;
    let attempts = 0;
    const maxAttempts = this.config.maxRetries + 1;

    while (attempts < maxAttempts) {
      try {
        // Execute with timeout
        const toolResult = await withTimeout(
          this.toolExecutor(step.tool, step.params),
          this.config.stepTimeoutMs,
          `Step timed out after ${this.config.stepTimeoutMs}ms`
        );

        if (toolResult.success) {
          result.status = "completed";
          result.result = toolResult;
          result.completedAt = Date.now();
          result.durationMs = result.completedAt - result.startedAt;

          this.emit("step_completed", {
            stepId: step.id,
            durationMs: result.durationMs,
          });

          return result;
        } else {
          lastError = toolResult.error || "Tool execution returned failure";
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }

      attempts++;
      result.retryCount = attempts - 1;

      if (attempts < maxAttempts) {
        await sleep(this.config.retryDelayMs);
      }
    }

    // All retries exhausted
    result.status = "failed";
    result.error = lastError || "Unknown error";
    result.completedAt = Date.now();
    result.durationMs = result.completedAt - result.startedAt;

    this.emit("step_failed", {
      stepId: step.id,
      error: result.error,
      retryCount: result.retryCount,
    });

    return result;
  }

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  /**
   * Reset the executor state.
   */
  reset(): void {
    if (this.state?.status === "running") {
      this.cancel();
    }

    this.state = null;
    this.currentPlan = null;
    this.abortController = null;
  }

  /**
   * Clear event listeners.
   */
  clearListeners(): void {
    this.listeners.clear();
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a plan executor with a mock tool executor (for testing).
 */
export function createMockExecutor(
  config: Partial<PlanExecutorConfig> = {}
): PlanExecutor {
  const mockToolExecutor: ToolExecutorFn = async (tool, params) => {
    // Simulate some work
    await sleep(100);
    return { success: true, data: { tool, params } };
  };

  return new PlanExecutor(mockToolExecutor, config);
}

/**
 * Create a plan executor that logs all steps (for debugging).
 */
export function createLoggingExecutor(
  toolExecutor: ToolExecutorFn,
  config: Partial<PlanExecutorConfig> = {}
): PlanExecutor {
  const executor = new PlanExecutor(toolExecutor, config);

  executor.on((event) => {
    console.log(`[PlanExecutor] ${event.type}`, event.data || "");
  });

  return executor;
}

// =============================================================================
// Singleton
// =============================================================================

let _instance: PlanExecutor | null = null;
let _defaultToolExecutor: ToolExecutorFn | null = null;

/**
 * Set the default tool executor for the singleton.
 */
export function setDefaultToolExecutor(executor: ToolExecutorFn): void {
  _defaultToolExecutor = executor;
}

/**
 * Get the global PlanExecutor instance.
 */
export function getPlanExecutor(): PlanExecutor {
  if (!_instance) {
    if (!_defaultToolExecutor) {
      // Create a no-op executor if none set
      _defaultToolExecutor = async () => ({
        success: false,
        error: "No tool executor configured. Call setDefaultToolExecutor() first.",
      });
    }
    _instance = new PlanExecutor(_defaultToolExecutor);
  }
  return _instance;
}

/**
 * Reset the global PlanExecutor instance.
 */
export function resetPlanExecutor(): void {
  if (_instance) {
    _instance.reset();
    _instance.clearListeners();
    _instance = null;
  }
}
