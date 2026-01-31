/**
 * Sidecar Recovery Manager
 *
 * Implements automatic restart and recovery when the sidecar service fails.
 * Monitors health status and triggers restart, with agents waiting for
 * recovery before proceeding with operations.
 */

import {
  SidecarHealthChecker,
  createHealthChecker,
  type HealthCheckConfig,
  type HealthCheckResult,
  type HealthEvent,
  type FetchFunction,
} from "./sidecar-health-check";

// =============================================================================
// Types
// =============================================================================

/** Recovery state */
export type RecoveryState =
  | "idle"
  | "monitoring"
  | "failure_detected"
  | "restarting"
  | "waiting_recovery"
  | "recovered"
  | "failed";

/** Restart strategy */
export type RestartStrategy = "immediate" | "exponential_backoff" | "fixed_delay";

/** Recovery configuration */
export interface RecoveryConfig {
  /** Health check configuration */
  healthCheck: Partial<HealthCheckConfig>;
  /** Number of consecutive failures before triggering restart */
  failureThreshold: number;
  /** Maximum restart attempts before giving up */
  maxRestartAttempts: number;
  /** Restart strategy */
  restartStrategy: RestartStrategy;
  /** Base delay for restart (ms) */
  restartDelay: number;
  /** Maximum delay for exponential backoff (ms) */
  maxRestartDelay: number;
  /** Timeout for waiting for recovery (ms) */
  recoveryTimeout: number;
  /** Cooldown period after successful recovery (ms) */
  recoveryCooldown: number;
}

/** Recovery event types */
export type RecoveryEventType =
  | "failure_detected"
  | "restart_triggered"
  | "restart_complete"
  | "restart_failed"
  | "recovery_started"
  | "recovery_complete"
  | "recovery_timeout"
  | "recovery_failed"
  | "state_change";

/** Recovery event */
export interface RecoveryEvent {
  type: RecoveryEventType;
  timestamp: number;
  state: RecoveryState;
  restartAttempt?: number;
  error?: string;
  details?: Record<string, unknown>;
}

/** Recovery event callback */
export type RecoveryEventCallback = (event: RecoveryEvent) => void;

/** Restart function type (for dependency injection) */
export type RestartFunction = () => Promise<boolean>;

/** Recovery statistics */
export interface RecoveryStats {
  /** Total failures detected */
  totalFailures: number;
  /** Total restart attempts */
  totalRestarts: number;
  /** Successful recoveries */
  successfulRecoveries: number;
  /** Failed recoveries */
  failedRecoveries: number;
  /** Current restart attempt (0 if not restarting) */
  currentRestartAttempt: number;
  /** Time of last failure */
  lastFailure: number | null;
  /** Time of last successful recovery */
  lastRecovery: number | null;
  /** Average recovery time (ms) */
  averageRecoveryTime: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_RECOVERY_CONFIG: RecoveryConfig = {
  healthCheck: {},
  failureThreshold: 3,
  maxRestartAttempts: 5,
  restartStrategy: "exponential_backoff",
  restartDelay: 2000,
  maxRestartDelay: 60000,
  recoveryTimeout: 120000,
  recoveryCooldown: 5000,
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculates delay based on restart strategy.
 */
export function calculateRestartDelay(
  strategy: RestartStrategy,
  attempt: number,
  baseDelay: number,
  maxDelay: number
): number {
  switch (strategy) {
    case "immediate":
      return 0;
    case "fixed_delay":
      return baseDelay;
    case "exponential_backoff":
      const delay = baseDelay * Math.pow(2, attempt - 1);
      return Math.min(delay, maxDelay);
    default:
      return baseDelay;
  }
}

/**
 * Creates a delay promise.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// SidecarRecoveryManager Class
// =============================================================================

/**
 * Manages automatic sidecar restart and recovery.
 *
 * @example
 * ```typescript
 * const recovery = new SidecarRecoveryManager({
 *   healthCheck: { sidecarUrl: "http://localhost:8069" },
 *   maxRestartAttempts: 3,
 * });
 *
 * // Set restart function (calls your sidecar restart mechanism)
 * recovery.setRestartFunction(async () => {
 *   await restartSidecarService();
 *   return true;
 * });
 *
 * // Start monitoring
 * recovery.startMonitoring();
 *
 * // Wait for sidecar to be ready before operations
 * await recovery.waitForReady();
 * ```
 */
export class SidecarRecoveryManager {
  private config: RecoveryConfig;
  private healthChecker: SidecarHealthChecker;
  private state: RecoveryState = "idle";
  private callbacks: RecoveryEventCallback[] = [];
  private restartFunction: RestartFunction | null = null;
  private restartAttempt = 0;
  private stats: RecoveryStats;
  private recoveryStartTime: number | null = null;
  private waitingPromises: Array<{
    resolve: (value: boolean) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = [];

  constructor(
    config: Partial<RecoveryConfig> = {},
    fetchFn?: FetchFunction
  ) {
    this.config = { ...DEFAULT_RECOVERY_CONFIG, ...config };
    this.healthChecker = createHealthChecker(this.config.healthCheck, fetchFn);
    this.stats = this.createInitialStats();

    // Listen to health events
    this.healthChecker.onEvent(this.handleHealthEvent.bind(this));
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  /**
   * Sets the restart function.
   */
  setRestartFunction(fn: RestartFunction): void {
    this.restartFunction = fn;
  }

  /**
   * Updates configuration.
   */
  updateConfig(config: Partial<RecoveryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets current configuration.
   */
  getConfig(): RecoveryConfig {
    return { ...this.config };
  }

  // ---------------------------------------------------------------------------
  // Monitoring
  // ---------------------------------------------------------------------------

  /**
   * Starts monitoring sidecar health.
   */
  startMonitoring(): void {
    if (this.state !== "idle") {
      return;
    }

    this.setState("monitoring");
    this.healthChecker.startPeriodicChecks();
  }

  /**
   * Stops monitoring sidecar health.
   */
  stopMonitoring(): void {
    this.healthChecker.stopPeriodicChecks();
    this.setState("idle");
    this.resetRestartState();
  }

  /**
   * Performs a single health check.
   */
  async checkHealth(): Promise<HealthCheckResult> {
    await this.healthChecker.performCheck();
    return this.healthChecker.getResult();
  }

  // ---------------------------------------------------------------------------
  // Recovery Operations
  // ---------------------------------------------------------------------------

  /**
   * Triggers a manual restart.
   * Unlike automatic recovery, this just triggers the restart and returns.
   * Does not wait for full recovery process.
   */
  async triggerRestart(): Promise<boolean> {
    if (!this.restartFunction) {
      this.emit({
        type: "restart_failed",
        timestamp: Date.now(),
        state: this.state,
        error: "No restart function configured",
      });
      return false;
    }

    this.emit({
      type: "restart_triggered",
      timestamp: Date.now(),
      state: this.state,
      restartAttempt: 0,
      details: { manual: true },
    });

    try {
      const success = await this.restartFunction();

      if (success) {
        this.emit({
          type: "restart_complete",
          timestamp: Date.now(),
          state: this.state,
        });
      } else {
        this.emit({
          type: "restart_failed",
          timestamp: Date.now(),
          state: this.state,
          error: "Restart function returned false",
        });
      }

      return success;
    } catch (error) {
      this.emit({
        type: "restart_failed",
        timestamp: Date.now(),
        state: this.state,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Waits for sidecar to be ready.
   * Returns true if ready, false if timeout or failed.
   */
  async waitForReady(timeout?: number): Promise<boolean> {
    const effectiveTimeout = timeout ?? this.config.recoveryTimeout;

    // If already healthy, return immediately
    if (this.healthChecker.isReadyForOperations()) {
      return true;
    }

    // If in failed state, don't wait
    if (this.state === "failed") {
      return false;
    }

    // Create a promise that resolves when recovered
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        // Remove from waiting list
        this.removeWaitingPromise(timeoutId);
        resolve(false);
      }, effectiveTimeout);

      this.waitingPromises.push({
        resolve,
        reject,
        timeout: timeoutId,
      });
    });
  }

  /**
   * Waits for sidecar to be ready, throwing on timeout.
   */
  async requireReady(timeout?: number): Promise<void> {
    const ready = await this.waitForReady(timeout);
    if (!ready) {
      throw new Error(
        `Sidecar not ready after ${timeout ?? this.config.recoveryTimeout}ms`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // State Queries
  // ---------------------------------------------------------------------------

  /**
   * Gets current recovery state.
   */
  getState(): RecoveryState {
    return this.state;
  }

  /**
   * Checks if sidecar is ready for operations.
   */
  isReady(): boolean {
    return (
      this.healthChecker.isReadyForOperations() &&
      (this.state === "monitoring" || this.state === "recovered")
    );
  }

  /**
   * Checks if recovery is in progress.
   */
  isRecovering(): boolean {
    return (
      this.state === "failure_detected" ||
      this.state === "restarting" ||
      this.state === "waiting_recovery"
    );
  }

  /**
   * Gets current health result.
   */
  getHealthResult(): HealthCheckResult {
    return this.healthChecker.getResult();
  }

  /**
   * Gets recovery statistics.
   */
  getStats(): RecoveryStats {
    return { ...this.stats };
  }

  /**
   * Gets the underlying health checker.
   */
  getHealthChecker(): SidecarHealthChecker {
    return this.healthChecker;
  }

  // ---------------------------------------------------------------------------
  // Event Handling
  // ---------------------------------------------------------------------------

  /**
   * Registers event callback.
   */
  onEvent(callback: RecoveryEventCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Removes event callback.
   */
  offEvent(callback: RecoveryEventCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Disposes the recovery manager.
   */
  dispose(): void {
    this.stopMonitoring();
    this.rejectAllWaiting(new Error("Recovery manager disposed"));
    this.callbacks = [];
  }

  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

  private handleHealthEvent(event: HealthEvent): void {
    if (event.type === "status:unhealthy") {
      this.handleUnhealthy(event.result);
    } else if (event.type === "status:healthy") {
      this.handleHealthy();
    }
  }

  private handleUnhealthy(result: HealthCheckResult): void {
    // Don't react if not monitoring or already recovering
    if (this.state !== "monitoring") {
      return;
    }

    // Check if failure threshold reached
    if (result.consecutiveFailures >= this.config.failureThreshold) {
      this.stats.totalFailures++;
      this.stats.lastFailure = Date.now();

      this.setState("failure_detected");
      this.emit({
        type: "failure_detected",
        timestamp: Date.now(),
        state: this.state,
        details: { consecutiveFailures: result.consecutiveFailures },
      });

      // Trigger automatic restart
      this.initiateRecovery();
    }
  }

  private handleHealthy(): void {
    if (this.state === "waiting_recovery") {
      this.completeRecovery();
    }
  }

  private async initiateRecovery(): Promise<void> {
    if (!this.restartFunction) {
      this.setState("failed");
      this.emit({
        type: "recovery_failed",
        timestamp: Date.now(),
        state: this.state,
        error: "No restart function configured",
      });
      return;
    }

    this.recoveryStartTime = Date.now();
    await this.performRestart();
  }

  private async performRestart(): Promise<boolean> {
    this.restartAttempt++;
    this.stats.totalRestarts++;
    this.stats.currentRestartAttempt = this.restartAttempt;

    // Check if max attempts reached
    if (this.restartAttempt > this.config.maxRestartAttempts) {
      this.setState("failed");
      this.stats.failedRecoveries++;
      this.emit({
        type: "recovery_failed",
        timestamp: Date.now(),
        state: this.state,
        restartAttempt: this.restartAttempt - 1,
        error: `Max restart attempts (${this.config.maxRestartAttempts}) exceeded`,
      });
      this.rejectAllWaiting(new Error("Max restart attempts exceeded"));
      return false;
    }

    // Calculate delay
    const restartDelay = calculateRestartDelay(
      this.config.restartStrategy,
      this.restartAttempt,
      this.config.restartDelay,
      this.config.maxRestartDelay
    );

    if (restartDelay > 0) {
      await delay(restartDelay);
    }

    this.setState("restarting");
    this.emit({
      type: "restart_triggered",
      timestamp: Date.now(),
      state: this.state,
      restartAttempt: this.restartAttempt,
      details: { delay: restartDelay },
    });

    try {
      const success = await this.restartFunction!();

      if (success) {
        this.emit({
          type: "restart_complete",
          timestamp: Date.now(),
          state: this.state,
          restartAttempt: this.restartAttempt,
        });

        // Wait for health to recover
        this.setState("waiting_recovery");
        this.emit({
          type: "recovery_started",
          timestamp: Date.now(),
          state: this.state,
          restartAttempt: this.restartAttempt,
        });

        // Start health checks to detect recovery
        const recovered = await this.healthChecker.waitForReady(
          this.config.recoveryTimeout
        );

        if (recovered) {
          this.completeRecovery();
          return true;
        } else {
          // Recovery timeout - try again
          this.emit({
            type: "recovery_timeout",
            timestamp: Date.now(),
            state: this.state,
            restartAttempt: this.restartAttempt,
          });
          return this.performRestart();
        }
      } else {
        this.emit({
          type: "restart_failed",
          timestamp: Date.now(),
          state: this.state,
          restartAttempt: this.restartAttempt,
          error: "Restart function returned false",
        });
        return this.performRestart();
      }
    } catch (error) {
      this.emit({
        type: "restart_failed",
        timestamp: Date.now(),
        state: this.state,
        restartAttempt: this.restartAttempt,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.performRestart();
    }
  }

  private completeRecovery(): void {
    const recoveryTime = this.recoveryStartTime
      ? Date.now() - this.recoveryStartTime
      : 0;

    this.stats.successfulRecoveries++;
    this.stats.lastRecovery = Date.now();
    this.stats.currentRestartAttempt = 0;

    // Update average recovery time
    const totalRecoveries = this.stats.successfulRecoveries;
    this.stats.averageRecoveryTime =
      (this.stats.averageRecoveryTime * (totalRecoveries - 1) + recoveryTime) /
      totalRecoveries;

    this.setState("recovered");
    this.emit({
      type: "recovery_complete",
      timestamp: Date.now(),
      state: this.state,
      restartAttempt: this.restartAttempt,
      details: { recoveryTime },
    });

    // Resolve all waiting promises
    this.resolveAllWaiting(true);

    // Reset restart state
    this.resetRestartState();

    // After cooldown, return to monitoring
    setTimeout(() => {
      if (this.state === "recovered") {
        this.setState("monitoring");
      }
    }, this.config.recoveryCooldown);
  }

  private resetRestartState(): void {
    this.restartAttempt = 0;
    this.recoveryStartTime = null;
  }

  private setState(state: RecoveryState): void {
    if (this.state !== state) {
      this.state = state;
      this.emit({
        type: "state_change",
        timestamp: Date.now(),
        state,
      });
    }
  }

  private emit(event: RecoveryEvent): void {
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch {
        // Ignore callback errors
      }
    }
  }

  private resolveAllWaiting(value: boolean): void {
    for (const waiting of this.waitingPromises) {
      clearTimeout(waiting.timeout);
      waiting.resolve(value);
    }
    this.waitingPromises = [];
  }

  private rejectAllWaiting(error: Error): void {
    for (const waiting of this.waitingPromises) {
      clearTimeout(waiting.timeout);
      waiting.reject(error);
    }
    this.waitingPromises = [];
  }

  private removeWaitingPromise(timeoutId: ReturnType<typeof setTimeout>): void {
    const index = this.waitingPromises.findIndex((w) => w.timeout === timeoutId);
    if (index !== -1) {
      this.waitingPromises.splice(index, 1);
    }
  }

  private createInitialStats(): RecoveryStats {
    return {
      totalFailures: 0,
      totalRestarts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      currentRestartAttempt: 0,
      lastFailure: null,
      lastRecovery: null,
      averageRecoveryTime: 0,
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a SidecarRecoveryManager instance.
 */
export function createRecoveryManager(
  config?: Partial<RecoveryConfig>,
  fetchFn?: FetchFunction
): SidecarRecoveryManager {
  return new SidecarRecoveryManager(config, fetchFn);
}

/**
 * Creates a recovery manager with a restart function.
 */
export function createRecoveryManagerWithRestart(
  restartFn: RestartFunction,
  config?: Partial<RecoveryConfig>,
  fetchFn?: FetchFunction
): SidecarRecoveryManager {
  const manager = new SidecarRecoveryManager(config, fetchFn);
  manager.setRestartFunction(restartFn);
  return manager;
}
