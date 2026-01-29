/**
 * Module Installation Tester
 *
 * Tests module installation via sidecar's Odoo instance:
 * - Installs modules for testing
 * - Reports success/failure with details
 * - Handles installation errors and timeouts
 */

// =============================================================================
// Types
// =============================================================================

/** Module installation status */
export type InstallationStatus =
  | "pending"
  | "installing"
  | "installed"
  | "failed"
  | "cancelled";

/** Module info */
export interface ModuleInfo {
  /** Technical module name */
  name: string;
  /** Display name */
  displayName?: string;
  /** Version */
  version?: string;
  /** State in Odoo */
  state?: string;
  /** Dependencies */
  dependencies?: string[];
}

/** Installation request */
export interface InstallRequest {
  /** Module name to install */
  moduleName: string;
  /** Request ID for tracking */
  requestId?: string;
  /** Force reinstall if already installed */
  forceReinstall?: boolean;
  /** Upgrade dependencies */
  upgradeDependencies?: boolean;
  /** Timeout override (ms) */
  timeout?: number;
}

/** Installation result */
export interface InstallResult {
  /** Whether installation succeeded */
  success: boolean;
  /** Installation status */
  status: InstallationStatus;
  /** Module name */
  moduleName: string;
  /** Request ID */
  requestId: string;
  /** Error message if failed */
  error?: string;
  /** Error details/stacktrace */
  errorDetails?: string;
  /** Installation duration (ms) */
  duration: number;
  /** Timestamp */
  timestamp: number;
  /** Modules that were installed (including dependencies) */
  installedModules?: string[];
  /** Warnings during installation */
  warnings?: string[];
}

/** Sidecar installation response */
export interface SidecarInstallResponse {
  /** Success status */
  success?: boolean;
  /** Error message */
  error?: string;
  /** Error details */
  error_details?: string;
  /** Status */
  status?: string;
  /** Installed modules */
  installed_modules?: string[];
  /** Warnings */
  warnings?: string[];
  /** Duration from sidecar */
  duration_ms?: number;
}

/** Tester configuration */
export interface TesterConfig {
  /** Sidecar base URL */
  sidecarUrl: string;
  /** Installation endpoint */
  installEndpoint: string;
  /** Module info endpoint */
  moduleInfoEndpoint: string;
  /** Default timeout (ms) */
  timeout: number;
  /** Retry on transient failure */
  retryOnError: boolean;
  /** Max retries */
  maxRetries: number;
  /** Retry delay (ms) */
  retryDelay: number;
  /** Poll interval for async install (ms) */
  pollInterval: number;
}

/** Installation event types */
export type InstallEventType =
  | "install:start"
  | "install:progress"
  | "install:success"
  | "install:failure"
  | "install:cancelled";

/** Installation event */
export interface InstallEvent {
  /** Event type */
  type: InstallEventType;
  /** Installation request */
  request: InstallRequest;
  /** Result if available */
  result?: InstallResult;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Progress message */
  message?: string;
  /** Timestamp */
  timestamp: number;
}

/** Install event callback */
export type InstallEventCallback = (event: InstallEvent) => void;

/** Fetch function type */
export type FetchFunction = (
  url: string,
  options: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  }
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<SidecarInstallResponse>;
}>;

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: TesterConfig = {
  sidecarUrl: "http://localhost:8069",
  installEndpoint: "/api/modules/install",
  moduleInfoEndpoint: "/api/modules/info",
  timeout: 120000, // 2 minutes for module installation
  retryOnError: true,
  maxRetries: 2,
  retryDelay: 2000,
  pollInterval: 1000,
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generates a unique request ID.
 */
export function generateRequestId(): string {
  return `install-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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

/**
 * Creates a successful install result.
 */
export function createSuccessResult(
  request: InstallRequest,
  duration: number,
  installedModules?: string[],
  warnings?: string[]
): InstallResult {
  return {
    success: true,
    status: "installed",
    moduleName: request.moduleName,
    requestId: request.requestId ?? generateRequestId(),
    duration,
    timestamp: Date.now(),
    installedModules,
    warnings,
  };
}

/**
 * Creates a failed install result.
 */
export function createFailureResult(
  request: InstallRequest,
  error: string,
  duration: number,
  errorDetails?: string
): InstallResult {
  return {
    success: false,
    status: "failed",
    moduleName: request.moduleName,
    requestId: request.requestId ?? generateRequestId(),
    error,
    errorDetails,
    duration,
    timestamp: Date.now(),
  };
}

// =============================================================================
// Mock Fetch
// =============================================================================

/**
 * Creates a mock fetch function for testing.
 */
export function createMockFetch(options: {
  success?: boolean;
  error?: string;
  errorDetails?: string;
  installedModules?: string[];
  warnings?: string[];
  duration?: number;
  failCount?: number;
} = {}): FetchFunction {
  let callCount = 0;
  const failCount = options.failCount ?? 0;

  return async () => {
    callCount++;

    // Simulate installation time
    await delay(options.duration ?? 100);

    // Simulate failures
    if (callCount <= failCount) {
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: "Server error" }),
      };
    }

    if (options.error || options.success === false) {
      return {
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: options.error ?? "Installation failed",
          error_details: options.errorDetails,
        }),
      };
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        status: "installed",
        installed_modules: options.installedModules ?? ["test_module"],
        warnings: options.warnings,
        duration_ms: options.duration ?? 100,
      }),
    };
  };
}

// =============================================================================
// ModuleInstallationTester Class
// =============================================================================

/**
 * Tests module installation via sidecar.
 */
export class ModuleInstallationTester {
  private config: TesterConfig;
  private callbacks: InstallEventCallback[] = [];
  private fetchFn: FetchFunction;
  private activeInstalls: Map<string, AbortController> = new Map();

  constructor(
    config: Partial<TesterConfig> = {},
    fetchFn?: FetchFunction
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.fetchFn = fetchFn ?? this.defaultFetch.bind(this);
  }

  /**
   * Installs a module and reports success/failure.
   */
  async installModule(request: InstallRequest): Promise<InstallResult> {
    const requestId = request.requestId ?? generateRequestId();
    const fullRequest = { ...request, requestId };
    const timeout = request.timeout ?? this.config.timeout;

    this.emit({
      type: "install:start",
      request: fullRequest,
      timestamp: Date.now(),
    });

    const startTime = Date.now();
    let lastError: string | undefined;
    let lastErrorDetails: string | undefined;

    // Create abort controller for this installation
    const { controller, timeoutId } = createTimeoutController(timeout);
    this.activeInstalls.set(requestId, controller);

    try {
      for (let attempt = 0; attempt <= (this.config.retryOnError ? this.config.maxRetries : 0); attempt++) {
        // Check if cancelled
        if (controller.signal.aborted) {
          return this.createCancelledResult(fullRequest, Date.now() - startTime);
        }

        try {
          const result = await this.executeInstall(fullRequest, controller.signal, startTime);

          // CRITICAL: Check if aborted AFTER fetch completes - the fetch may have
          // completed successfully but cancellation was requested during execution
          if (controller.signal.aborted) {
            return this.createCancelledResult(fullRequest, Date.now() - startTime);
          }

          if (result.success) {
            this.emit({
              type: "install:success",
              request: fullRequest,
              result,
              timestamp: Date.now(),
            });
            return result;
          }

          lastError = result.error;
          lastErrorDetails = result.errorDetails;
        } catch (error) {
          // Check abort signal on any error (including AbortError)
          if (controller.signal.aborted) {
            return this.createCancelledResult(fullRequest, Date.now() - startTime);
          }
          lastError = error instanceof Error ? error.message : String(error);
        }

        // Wait before retry
        if (attempt < this.config.maxRetries) {
          this.emit({
            type: "install:progress",
            request: fullRequest,
            message: `Retry attempt ${attempt + 1}/${this.config.maxRetries}`,
            timestamp: Date.now(),
          });
          await delay(this.config.retryDelay);
        }
      }

      // All attempts failed
      const failureResult = createFailureResult(
        fullRequest,
        lastError ?? "Installation failed",
        Date.now() - startTime,
        lastErrorDetails
      );

      this.emit({
        type: "install:failure",
        request: fullRequest,
        result: failureResult,
        timestamp: Date.now(),
      });

      return failureResult;
    } finally {
      clearTimeout(timeoutId);
      this.activeInstalls.delete(requestId);
    }
  }

  /**
   * Installs module by name (convenience method).
   */
  async testInstall(moduleName: string): Promise<InstallResult> {
    return this.installModule({ moduleName });
  }

  /**
   * Cancels an active installation.
   */
  cancelInstall(requestId: string): boolean {
    const controller = this.activeInstalls.get(requestId);
    if (controller) {
      controller.abort();
      return true;
    }
    return false;
  }

  /**
   * Gets module info from sidecar.
   */
  async getModuleInfo(moduleName: string): Promise<ModuleInfo | null> {
    try {
      const { controller, timeoutId } = createTimeoutController(10000);

      const url = `${this.config.sidecarUrl}${this.config.moduleInfoEndpoint}/${moduleName}`;
      const response = await this.fetchFn(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return {
        name: moduleName,
        displayName: (data as Record<string, unknown>).display_name as string | undefined,
        version: (data as Record<string, unknown>).version as string | undefined,
        state: (data as Record<string, unknown>).state as string | undefined,
        dependencies: (data as Record<string, unknown>).dependencies as string[] | undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Checks if a module is installed.
   */
  async isModuleInstalled(moduleName: string): Promise<boolean> {
    const info = await this.getModuleInfo(moduleName);
    return info?.state === "installed";
  }

  /**
   * Gets list of active installations.
   */
  getActiveInstalls(): string[] {
    return Array.from(this.activeInstalls.keys());
  }

  /**
   * Registers event callback.
   */
  onEvent(callback: InstallEventCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Removes event callback.
   */
  offEvent(callback: InstallEventCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Updates configuration.
   */
  updateConfig(config: Partial<TesterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets current configuration.
   */
  getConfig(): TesterConfig {
    return { ...this.config };
  }

  // Private methods

  private async executeInstall(
    request: InstallRequest,
    signal: AbortSignal,
    startTime: number
  ): Promise<InstallResult> {
    const url = `${this.config.sidecarUrl}${this.config.installEndpoint}`;

    const response = await this.fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module_name: request.moduleName,
        force_reinstall: request.forceReinstall,
        upgrade_dependencies: request.upgradeDependencies,
      }),
      signal,
    });

    const data = await response.json();
    const duration = Date.now() - startTime;

    if (!response.ok || data.error) {
      return createFailureResult(
        request,
        data.error ?? `HTTP ${response.status}`,
        duration,
        data.error_details
      );
    }

    return createSuccessResult(
      request,
      data.duration_ms ?? duration,
      data.installed_modules,
      data.warnings
    );
  }

  private createCancelledResult(request: InstallRequest, duration: number): InstallResult {
    const result: InstallResult = {
      success: false,
      status: "cancelled",
      moduleName: request.moduleName,
      requestId: request.requestId ?? generateRequestId(),
      error: "Installation cancelled",
      duration,
      timestamp: Date.now(),
    };

    this.emit({
      type: "install:cancelled",
      request,
      result,
      timestamp: Date.now(),
    });

    return result;
  }

  private emit(event: InstallEvent): void {
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
    options: {
      method: string;
      headers: Record<string, string>;
      body?: string;
      signal?: AbortSignal;
    }
  ): Promise<{
    ok: boolean;
    status: number;
    json: () => Promise<SidecarInstallResponse>;
  }> {
    if (typeof fetch !== "undefined") {
      const response = await fetch(url, options);
      return {
        ok: response.ok,
        status: response.status,
        json: () => response.json() as Promise<SidecarInstallResponse>,
      };
    }
    throw new Error("Fetch not available");
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a ModuleInstallationTester instance.
 */
export function createInstallationTester(
  config?: Partial<TesterConfig>,
  fetchFn?: FetchFunction
): ModuleInstallationTester {
  return new ModuleInstallationTester(config, fetchFn);
}

/**
 * Creates a tester with mock fetch for testing.
 */
export function createMockInstallationTester(
  config?: Partial<TesterConfig>,
  mockOptions?: Parameters<typeof createMockFetch>[0]
): ModuleInstallationTester {
  return new ModuleInstallationTester(config, createMockFetch(mockOptions));
}

// =============================================================================
// Test Odoo Tool
// =============================================================================

/**
 * test_odoo tool implementation for module installation testing.
 */
export async function testOdooInstall(
  moduleName: string,
  options: {
    sidecarUrl?: string;
    timeout?: number;
    forceReinstall?: boolean;
  } = {}
): Promise<{
  success: boolean;
  message: string;
  details?: InstallResult;
}> {
  const tester = createInstallationTester({
    sidecarUrl: options.sidecarUrl,
    timeout: options.timeout,
  });

  const result = await tester.installModule({
    moduleName,
    forceReinstall: options.forceReinstall,
  });

  return {
    success: result.success,
    message: result.success
      ? `Module '${moduleName}' installed successfully in ${result.duration}ms`
      : `Failed to install module '${moduleName}': ${result.error}`,
    details: result,
  };
}
