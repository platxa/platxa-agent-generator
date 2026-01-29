/**
 * Sidecar Health Check
 *
 * Verifies sidecar service is responding before Odoo-dependent operations:
 * - Health endpoint check
 * - Startup verification with retries
 * - Readiness gating for operations
 */

// =============================================================================
// Types
// =============================================================================

/** Health check status */
export type HealthStatus = "healthy" | "unhealthy" | "unknown" | "checking";

/** Health check result */
export interface HealthCheckResult {
  /** Current status */
  status: HealthStatus;
  /** Response time in ms */
  responseTime: number;
  /** Last successful check timestamp */
  lastSuccess: number | null;
  /** Last failure timestamp */
  lastFailure: number | null;
  /** Error message if unhealthy */
  error?: string;
  /** Number of consecutive failures */
  consecutiveFailures: number;
  /** Number of consecutive successes */
  consecutiveSuccesses: number;
  /** Timestamp of this check */
  timestamp: number;
}

/** Sidecar service info */
export interface SidecarInfo {
  /** Service name */
  name: string;
  /** Service version */
  version?: string;
  /** Uptime in seconds */
  uptime?: number;
  /** Ready for operations */
  ready: boolean;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/** Health check configuration */
export interface HealthCheckConfig {
  /** Base URL of sidecar service */
  sidecarUrl: string;
  /** Health endpoint path */
  healthEndpoint: string;
  /** Timeout for health check request (ms) */
  timeout: number;
  /** Number of retries on failure */
  retries: number;
  /** Delay between retries (ms) */
  retryDelay: number;
  /** Interval for periodic checks (ms, 0 = disabled) */
  checkInterval: number;
  /** Threshold for considering service healthy (consecutive successes) */
  healthyThreshold: number;
  /** Threshold for considering service unhealthy (consecutive failures) */
  unhealthyThreshold: number;
}

/** Health check event types */
export type HealthEventType =
  | "check:start"
  | "check:success"
  | "check:failure"
  | "status:healthy"
  | "status:unhealthy"
  | "startup:complete"
  | "startup:failed";

/** Health check event */
export interface HealthEvent {
  /** Event type */
  type: HealthEventType;
  /** Health result at event time */
  result: HealthCheckResult;
  /** Timestamp */
  timestamp: number;
}

/** Health event callback */
export type HealthEventCallback = (event: HealthEvent) => void;

/** Fetch function type (for dependency injection) */
export type FetchFunction = (
  url: string,
  options?: { signal?: AbortSignal; timeout?: number }
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: HealthCheckConfig = {
  sidecarUrl: "http://localhost:8069",
  healthEndpoint: "/health",
  timeout: 5000,
  retries: 3,
  retryDelay: 1000,
  checkInterval: 30000,
  healthyThreshold: 2,
  unhealthyThreshold: 3,
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Creates initial health check result.
 */
export function createInitialResult(): HealthCheckResult {
  return {
    status: "unknown",
    responseTime: 0,
    lastSuccess: null,
    lastFailure: null,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    timestamp: Date.now(),
  };
}

/**
 * Clones health check result.
 */
export function cloneResult(result: HealthCheckResult): HealthCheckResult {
  return { ...result };
}

/**
 * Checks if service is healthy.
 */
export function isHealthy(result: HealthCheckResult): boolean {
  return result.status === "healthy";
}

/**
 * Checks if service is ready for operations.
 */
export function isReady(result: HealthCheckResult, threshold: number = 1): boolean {
  return result.status === "healthy" && result.consecutiveSuccesses >= threshold;
}

/**
 * Creates a delay promise.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates an abort controller with timeout.
 */
export function createTimeoutController(timeoutMs: number): {
  controller: AbortController;
  timeoutId: ReturnType<typeof setTimeout>;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeoutId };
}

// =============================================================================
// Mock Fetch (for testing)
// =============================================================================

/**
 * Creates a mock fetch function for testing.
 */
export function createMockFetch(options: {
  healthy?: boolean;
  responseTime?: number;
  failCount?: number;
  serviceInfo?: Partial<SidecarInfo>;
} = {}): FetchFunction {
  let callCount = 0;
  const failCount = options.failCount ?? 0;

  return async () => {
    callCount++;

    // Simulate response time
    if (options.responseTime) {
      await delay(options.responseTime);
    }

    // Simulate failures
    if (callCount <= failCount) {
      return {
        ok: false,
        status: 503,
        json: async () => ({ error: "Service unavailable" }),
      };
    }

    const healthy = options.healthy ?? true;
    return {
      ok: healthy,
      status: healthy ? 200 : 503,
      json: async () => ({
        status: healthy ? "healthy" : "unhealthy",
        name: options.serviceInfo?.name ?? "odoo-sidecar",
        version: options.serviceInfo?.version ?? "1.0.0",
        uptime: options.serviceInfo?.uptime ?? 3600,
        ready: options.serviceInfo?.ready ?? healthy,
        ...options.serviceInfo?.metadata,
      }),
    };
  };
}

// =============================================================================
// SidecarHealthChecker Class
// =============================================================================

/**
 * Manages sidecar health checking.
 */
export class SidecarHealthChecker {
  private config: HealthCheckConfig;
  private result: HealthCheckResult;
  private callbacks: HealthEventCallback[] = [];
  private checkIntervalId: ReturnType<typeof setInterval> | null = null;
  private fetchFn: FetchFunction;
  private startupComplete: boolean = false;

  constructor(
    config: Partial<HealthCheckConfig> = {},
    fetchFn?: FetchFunction
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.result = createInitialResult();
    this.fetchFn = fetchFn ?? this.defaultFetch.bind(this);
  }

  /**
   * Performs startup health check with retries.
   * Verifies sidecar is responding before Odoo-dependent operations.
   */
  async verifyStartup(): Promise<boolean> {
    this.startupComplete = false;

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      const success = await this.performCheck();

      if (success && isReady(this.result, this.config.healthyThreshold)) {
        this.startupComplete = true;
        this.emit({
          type: "startup:complete",
          result: cloneResult(this.result),
          timestamp: Date.now(),
        });
        return true;
      }

      // Wait before retry (except on last attempt)
      if (attempt < this.config.retries) {
        await delay(this.config.retryDelay);
      }
    }

    this.emit({
      type: "startup:failed",
      result: cloneResult(this.result),
      timestamp: Date.now(),
    });

    return false;
  }

  /**
   * Performs a single health check.
   */
  async performCheck(): Promise<boolean> {
    this.result.status = "checking";

    this.emit({
      type: "check:start",
      result: cloneResult(this.result),
      timestamp: Date.now(),
    });

    const startTime = Date.now();

    try {
      const { controller, timeoutId } = createTimeoutController(this.config.timeout);

      const url = `${this.config.sidecarUrl}${this.config.healthEndpoint}`;
      const response = await this.fetchFn(url, { signal: controller.signal });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      this.result.responseTime = responseTime;
      this.result.timestamp = Date.now();

      if (response.ok) {
        return this.handleSuccess();
      } else {
        return this.handleFailure(`HTTP ${response.status}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return this.handleFailure(message);
    }
  }

  /**
   * Starts periodic health checks.
   */
  startPeriodicChecks(): void {
    if (this.checkIntervalId || this.config.checkInterval <= 0) {
      return;
    }

    this.checkIntervalId = setInterval(() => {
      this.performCheck();
    }, this.config.checkInterval);
  }

  /**
   * Stops periodic health checks.
   */
  stopPeriodicChecks(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
  }

  /**
   * Checks if sidecar is ready for operations.
   */
  isReadyForOperations(): boolean {
    return this.startupComplete && isHealthy(this.result);
  }

  /**
   * Gets current health status.
   */
  getStatus(): HealthStatus {
    return this.result.status;
  }

  /**
   * Gets current health result.
   */
  getResult(): HealthCheckResult {
    return cloneResult(this.result);
  }

  /**
   * Checks if startup verification is complete.
   */
  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  /**
   * Waits for sidecar to be ready.
   */
  async waitForReady(timeout: number = 30000): Promise<boolean> {
    if (this.isReadyForOperations()) {
      return true;
    }

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const success = await this.performCheck();
      if (success && isReady(this.result, this.config.healthyThreshold)) {
        // Mark startup complete since we've verified the sidecar is healthy
        this.startupComplete = true;
        return true;
      }
      await delay(this.config.retryDelay);
    }

    return false;
  }

  /**
   * Registers event callback.
   */
  onEvent(callback: HealthEventCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Removes event callback.
   */
  offEvent(callback: HealthEventCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Updates configuration.
   */
  updateConfig(config: Partial<HealthCheckConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets current configuration.
   */
  getConfig(): HealthCheckConfig {
    return { ...this.config };
  }

  /**
   * Resets health state.
   */
  reset(): void {
    this.stopPeriodicChecks();
    this.result = createInitialResult();
    this.startupComplete = false;
  }

  // Private methods

  private handleSuccess(): boolean {
    const now = Date.now();
    this.result.lastSuccess = now;
    this.result.consecutiveSuccesses++;
    this.result.consecutiveFailures = 0;
    this.result.error = undefined;

    // Update status based on threshold
    if (this.result.consecutiveSuccesses >= this.config.healthyThreshold) {
      const wasHealthy = this.result.status === "healthy";
      this.result.status = "healthy";

      if (!wasHealthy) {
        this.emit({
          type: "status:healthy",
          result: cloneResult(this.result),
          timestamp: now,
        });
      }
    }

    this.emit({
      type: "check:success",
      result: cloneResult(this.result),
      timestamp: now,
    });

    return true;
  }

  private handleFailure(error: string): boolean {
    const now = Date.now();
    this.result.lastFailure = now;
    this.result.consecutiveFailures++;
    this.result.consecutiveSuccesses = 0;
    this.result.error = error;

    // Update status based on threshold
    if (this.result.consecutiveFailures >= this.config.unhealthyThreshold) {
      const wasUnhealthy = this.result.status === "unhealthy";
      this.result.status = "unhealthy";

      if (!wasUnhealthy) {
        this.emit({
          type: "status:unhealthy",
          result: cloneResult(this.result),
          timestamp: now,
        });
      }
    }

    this.emit({
      type: "check:failure",
      result: cloneResult(this.result),
      timestamp: now,
    });

    return false;
  }

  private emit(event: HealthEvent): void {
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch {
        // Ignore callback errors
      }
    }
  }

  private async defaultFetch(
    url: string,
    options?: { signal?: AbortSignal }
  ): Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }> {
    // Default implementation uses global fetch if available
    if (typeof fetch !== "undefined") {
      const response = await fetch(url, {
        method: "GET",
        signal: options?.signal,
      });
      return {
        ok: response.ok,
        status: response.status,
        json: () => response.json(),
      };
    }

    // Fallback for environments without fetch
    throw new Error("Fetch not available");
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a SidecarHealthChecker instance.
 */
export function createHealthChecker(
  config?: Partial<HealthCheckConfig>,
  fetchFn?: FetchFunction
): SidecarHealthChecker {
  return new SidecarHealthChecker(config, fetchFn);
}

/**
 * Creates a health checker with mock fetch for testing.
 */
export function createMockHealthChecker(
  config?: Partial<HealthCheckConfig>,
  mockOptions?: Parameters<typeof createMockFetch>[0]
): SidecarHealthChecker {
  return new SidecarHealthChecker(config, createMockFetch(mockOptions));
}

// =============================================================================
// Operation Gating
// =============================================================================

/**
 * Creates an operation guard that checks sidecar health.
 */
export function createOperationGuard(
  checker: SidecarHealthChecker
): {
  canProceed: () => boolean;
  waitAndProceed: (timeout?: number) => Promise<boolean>;
  requireHealthy: () => void;
} {
  return {
    canProceed: () => checker.isReadyForOperations(),

    waitAndProceed: async (timeout = 30000) => {
      if (checker.isReadyForOperations()) {
        return true;
      }
      return checker.waitForReady(timeout);
    },

    requireHealthy: () => {
      if (!checker.isReadyForOperations()) {
        const result = checker.getResult();
        throw new Error(
          `Sidecar not ready: ${result.error ?? result.status}`
        );
      }
    },
  };
}

/**
 * Decorator function to gate operations on sidecar health.
 */
export function withHealthCheck<T>(
  checker: SidecarHealthChecker,
  operation: () => T | Promise<T>,
  options: { waitTimeout?: number; throwOnUnhealthy?: boolean } = {}
): () => Promise<T> {
  return async () => {
    const { waitTimeout = 5000, throwOnUnhealthy = true } = options;

    // Try to wait for ready
    const ready = await checker.waitForReady(waitTimeout);

    if (!ready && throwOnUnhealthy) {
      const result = checker.getResult();
      throw new Error(
        `Sidecar health check failed: ${result.error ?? result.status}`
      );
    }

    return operation();
  };
}
