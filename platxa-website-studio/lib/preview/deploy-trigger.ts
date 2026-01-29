/**
 * Deploy Trigger
 *
 * Triggers deployment flow after successful agent completion:
 * - Shows deploy button after successful generation
 * - Manages deployment state and lifecycle
 * - Handles deployment success/failure with retries
 */

// =============================================================================
// Types
// =============================================================================

/** Deployment status */
export type DeployStatus =
  | "idle"
  | "ready"
  | "deploying"
  | "success"
  | "failed"
  | "cancelled";

/** Generation status for triggering deploy */
export type GenerationStatus =
  | "pending"
  | "generating"
  | "success"
  | "failed";

/** Deploy target environment */
export type DeployTarget = "preview" | "staging" | "production";

/** Generation result that triggers deploy */
export interface GenerationResult {
  /** Generation ID */
  id: string;
  /** Generation status */
  status: GenerationStatus;
  /** Generated files */
  files?: string[];
  /** Module name if applicable */
  moduleName?: string;
  /** Timestamp */
  timestamp: number;
  /** Error if failed */
  error?: string;
}

/** Deploy request */
export interface DeployRequest {
  /** Generation result to deploy */
  generation: GenerationResult;
  /** Target environment */
  target: DeployTarget;
  /** Deploy ID for tracking */
  deployId?: string;
  /** Force deploy even if previous deployment exists */
  force?: boolean;
  /** Custom timeout (ms) */
  timeout?: number;
}

/** Deploy result */
export interface DeployResult {
  /** Whether deployment succeeded */
  success: boolean;
  /** Deployment status */
  status: DeployStatus;
  /** Deploy ID */
  deployId: string;
  /** Target environment */
  target: DeployTarget;
  /** Generation ID that was deployed */
  generationId: string;
  /** Error message if failed */
  error?: string;
  /** Error details */
  errorDetails?: string;
  /** Deployment duration (ms) */
  duration: number;
  /** Timestamp */
  timestamp: number;
  /** Deployment URL if available */
  deployUrl?: string;
  /** Warnings during deployment */
  warnings?: string[];
}

/** Deploy trigger state */
export interface DeployTriggerState {
  /** Current deployment status */
  status: DeployStatus;
  /** Latest generation result */
  latestGeneration: GenerationResult | null;
  /** Whether deploy button should be visible */
  showDeployButton: boolean;
  /** Current deployment request */
  currentDeploy: DeployRequest | null;
  /** Last deployment result */
  lastResult: DeployResult | null;
  /** Timestamp */
  timestamp: number;
}

/** Deploy trigger configuration */
export interface DeployTriggerConfig {
  /** Sidecar base URL */
  sidecarUrl: string;
  /** Deploy endpoint */
  deployEndpoint: string;
  /** Default target environment */
  defaultTarget: DeployTarget;
  /** Request timeout (ms) */
  timeout: number;
  /** Auto-show deploy button on success */
  autoShowButton: boolean;
  /** Retry on failure */
  retryOnError: boolean;
  /** Max retries */
  maxRetries: number;
  /** Retry delay (ms) */
  retryDelay: number;
  /** Require confirmation before deploy */
  requireConfirmation: boolean;
}

/** Deploy event types */
export type DeployEventType =
  | "generation:success"
  | "generation:failed"
  | "deploy:ready"
  | "deploy:start"
  | "deploy:progress"
  | "deploy:success"
  | "deploy:failed"
  | "deploy:cancelled"
  | "button:show"
  | "button:hide";

/** Deploy event */
export interface DeployEvent {
  /** Event type */
  type: DeployEventType;
  /** Current state */
  state: DeployTriggerState;
  /** Deploy result if available */
  result?: DeployResult;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Progress message */
  message?: string;
  /** Timestamp */
  timestamp: number;
}

/** Deploy event callback */
export type DeployEventCallback = (event: DeployEvent) => void;

/** Sidecar deploy response */
export interface SidecarDeployResponse {
  /** Success status */
  success?: boolean;
  /** Error message */
  error?: string;
  /** Error details */
  error_details?: string;
  /** Deploy URL */
  deploy_url?: string;
  /** Warnings */
  warnings?: string[];
  /** Duration from sidecar */
  duration_ms?: number;
}

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
  json: () => Promise<SidecarDeployResponse>;
}>;

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: DeployTriggerConfig = {
  sidecarUrl: "http://localhost:8069",
  deployEndpoint: "/api/deploy",
  defaultTarget: "preview",
  timeout: 60000, // 1 minute for deployment
  autoShowButton: true,
  retryOnError: true,
  maxRetries: 2,
  retryDelay: 2000,
  requireConfirmation: true,
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generates a unique deploy ID.
 */
export function generateDeployId(): string {
  return `deploy-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Creates initial deploy trigger state.
 */
export function createInitialState(): DeployTriggerState {
  return {
    status: "idle",
    latestGeneration: null,
    showDeployButton: false,
    currentDeploy: null,
    lastResult: null,
    timestamp: Date.now(),
  };
}

/**
 * Clones deploy trigger state.
 */
export function cloneState(state: DeployTriggerState): DeployTriggerState {
  return {
    ...state,
    latestGeneration: state.latestGeneration
      ? { ...state.latestGeneration }
      : null,
    currentDeploy: state.currentDeploy ? { ...state.currentDeploy } : null,
    lastResult: state.lastResult ? { ...state.lastResult } : null,
  };
}

/**
 * Checks if generation is successful and deployable.
 */
export function isDeployable(generation: GenerationResult | null): boolean {
  return generation?.status === "success";
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
 * Creates a successful deploy result.
 */
export function createSuccessResult(
  request: DeployRequest,
  duration: number,
  deployUrl?: string,
  warnings?: string[]
): DeployResult {
  return {
    success: true,
    status: "success",
    deployId: request.deployId ?? generateDeployId(),
    target: request.target,
    generationId: request.generation.id,
    duration,
    timestamp: Date.now(),
    deployUrl,
    warnings,
  };
}

/**
 * Creates a failed deploy result.
 */
export function createFailureResult(
  request: DeployRequest,
  error: string,
  duration: number,
  errorDetails?: string
): DeployResult {
  return {
    success: false,
    status: "failed",
    deployId: request.deployId ?? generateDeployId(),
    target: request.target,
    generationId: request.generation.id,
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
  deployUrl?: string;
  warnings?: string[];
  duration?: number;
  failCount?: number;
} = {}): FetchFunction {
  let callCount = 0;
  const failCount = options.failCount ?? 0;

  return async () => {
    callCount++;

    // Simulate deployment time
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
          error: options.error ?? "Deployment failed",
          error_details: options.errorDetails,
        }),
      };
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        deploy_url: options.deployUrl ?? "https://preview.example.com",
        warnings: options.warnings,
        duration_ms: options.duration ?? 100,
      }),
    };
  };
}

// =============================================================================
// DeployTrigger Class
// =============================================================================

/**
 * Manages deployment triggering after agent completion.
 */
export class DeployTrigger {
  private config: DeployTriggerConfig;
  private state: DeployTriggerState;
  private callbacks: DeployEventCallback[] = [];
  private fetchFn: FetchFunction;
  private activeDeploy: AbortController | null = null;

  constructor(
    config: Partial<DeployTriggerConfig> = {},
    fetchFn?: FetchFunction
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = createInitialState();
    this.fetchFn = fetchFn ?? this.defaultFetch.bind(this);
  }

  /**
   * Records a generation result - shows deploy button on success.
   */
  recordGeneration(generation: GenerationResult): void {
    this.state.latestGeneration = generation;
    this.state.timestamp = Date.now();

    if (generation.status === "success") {
      this.emit({
        type: "generation:success",
        state: cloneState(this.state),
        timestamp: Date.now(),
      });

      if (this.config.autoShowButton) {
        this.showDeployButton();
      }

      this.state.status = "ready";
      this.emit({
        type: "deploy:ready",
        state: cloneState(this.state),
        timestamp: Date.now(),
      });
    } else if (generation.status === "failed") {
      this.emit({
        type: "generation:failed",
        state: cloneState(this.state),
        timestamp: Date.now(),
      });

      this.hideDeployButton();
      this.state.status = "idle";
    }
  }

  /**
   * Shows the deploy button.
   */
  showDeployButton(): void {
    if (!this.state.showDeployButton) {
      this.state.showDeployButton = true;
      this.state.timestamp = Date.now();

      this.emit({
        type: "button:show",
        state: cloneState(this.state),
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Hides the deploy button.
   */
  hideDeployButton(): void {
    if (this.state.showDeployButton) {
      this.state.showDeployButton = false;
      this.state.timestamp = Date.now();

      this.emit({
        type: "button:hide",
        state: cloneState(this.state),
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Checks if deploy button should be visible.
   */
  isDeployButtonVisible(): boolean {
    return this.state.showDeployButton;
  }

  /**
   * Triggers deployment of the latest generation.
   */
  async deploy(options: {
    target?: DeployTarget;
    force?: boolean;
    timeout?: number;
  } = {}): Promise<DeployResult> {
    const generation = this.state.latestGeneration;

    if (!generation || !isDeployable(generation)) {
      const error = "No successful generation to deploy";
      const result: DeployResult = {
        success: false,
        status: "failed",
        deployId: generateDeployId(),
        target: options.target ?? this.config.defaultTarget,
        generationId: generation?.id ?? "unknown",
        error,
        duration: 0,
        timestamp: Date.now(),
      };

      this.emit({
        type: "deploy:failed",
        state: cloneState(this.state),
        result,
        timestamp: Date.now(),
      });

      return result;
    }

    const request: DeployRequest = {
      generation,
      target: options.target ?? this.config.defaultTarget,
      deployId: generateDeployId(),
      force: options.force,
      timeout: options.timeout,
    };

    return this.executeDeploy(request);
  }

  /**
   * Cancels the current deployment.
   */
  cancelDeploy(): boolean {
    if (this.activeDeploy) {
      this.activeDeploy.abort();
      return true;
    }
    return false;
  }

  /**
   * Gets current state.
   */
  getState(): DeployTriggerState {
    return cloneState(this.state);
  }

  /**
   * Gets current status.
   */
  getStatus(): DeployStatus {
    return this.state.status;
  }

  /**
   * Checks if currently deploying.
   */
  isDeploying(): boolean {
    return this.state.status === "deploying";
  }

  /**
   * Checks if ready to deploy.
   */
  isReadyToDeploy(): boolean {
    return this.state.status === "ready" && isDeployable(this.state.latestGeneration);
  }

  /**
   * Registers event callback.
   */
  onEvent(callback: DeployEventCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Removes event callback.
   */
  offEvent(callback: DeployEventCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Updates configuration.
   */
  updateConfig(config: Partial<DeployTriggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets current configuration.
   */
  getConfig(): DeployTriggerConfig {
    return { ...this.config };
  }

  /**
   * Resets state.
   */
  reset(): void {
    this.cancelDeploy();
    this.state = createInitialState();
  }

  // Private methods

  private async executeDeploy(request: DeployRequest): Promise<DeployResult> {
    const timeout = request.timeout ?? this.config.timeout;
    const startTime = Date.now();

    this.state.status = "deploying";
    this.state.currentDeploy = request;
    this.state.timestamp = Date.now();

    // Create abort controller for this deployment
    const { controller, timeoutId } = createTimeoutController(timeout);
    this.activeDeploy = controller;

    this.emit({
      type: "deploy:start",
      state: cloneState(this.state),
      timestamp: Date.now(),
    });

    let lastError: string | undefined;
    let lastErrorDetails: string | undefined;

    try {
      for (let attempt = 0; attempt <= (this.config.retryOnError ? this.config.maxRetries : 0); attempt++) {
        // Check if cancelled
        if (controller.signal.aborted) {
          return this.createCancelledResult(request, Date.now() - startTime);
        }

        try {
          const result = await this.fetchDeploy(request, controller.signal, startTime);

          // CRITICAL: Check if aborted AFTER fetch completes
          if (controller.signal.aborted) {
            return this.createCancelledResult(request, Date.now() - startTime);
          }

          if (result.success) {
            this.state.status = "success";
            this.state.lastResult = result;
            this.state.currentDeploy = null;
            this.state.timestamp = Date.now();

            this.emit({
              type: "deploy:success",
              state: cloneState(this.state),
              result,
              timestamp: Date.now(),
            });

            return result;
          }

          lastError = result.error;
          lastErrorDetails = result.errorDetails;
        } catch (error) {
          // Check abort signal on any error
          if (controller.signal.aborted) {
            return this.createCancelledResult(request, Date.now() - startTime);
          }
          lastError = error instanceof Error ? error.message : String(error);
        }

        // Wait before retry
        if (attempt < this.config.maxRetries) {
          this.emit({
            type: "deploy:progress",
            state: cloneState(this.state),
            message: `Retry attempt ${attempt + 1}/${this.config.maxRetries}`,
            timestamp: Date.now(),
          });
          await delay(this.config.retryDelay);
        }
      }

      // All attempts failed
      const failureResult = createFailureResult(
        request,
        lastError ?? "Deployment failed",
        Date.now() - startTime,
        lastErrorDetails
      );

      this.state.status = "failed";
      this.state.lastResult = failureResult;
      this.state.currentDeploy = null;
      this.state.timestamp = Date.now();

      this.emit({
        type: "deploy:failed",
        state: cloneState(this.state),
        result: failureResult,
        timestamp: Date.now(),
      });

      return failureResult;
    } finally {
      clearTimeout(timeoutId);
      this.activeDeploy = null;
    }
  }

  private async fetchDeploy(
    request: DeployRequest,
    signal: AbortSignal,
    startTime: number
  ): Promise<DeployResult> {
    const url = `${this.config.sidecarUrl}${this.config.deployEndpoint}`;

    const response = await this.fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generation_id: request.generation.id,
        target: request.target,
        files: request.generation.files,
        module_name: request.generation.moduleName,
        force: request.force,
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
      data.deploy_url,
      data.warnings
    );
  }

  private createCancelledResult(request: DeployRequest, duration: number): DeployResult {
    const result: DeployResult = {
      success: false,
      status: "cancelled",
      deployId: request.deployId ?? generateDeployId(),
      target: request.target,
      generationId: request.generation.id,
      error: "Deployment cancelled",
      duration,
      timestamp: Date.now(),
    };

    this.state.status = "cancelled";
    this.state.lastResult = result;
    this.state.currentDeploy = null;
    this.state.timestamp = Date.now();

    this.emit({
      type: "deploy:cancelled",
      state: cloneState(this.state),
      result,
      timestamp: Date.now(),
    });

    return result;
  }

  private emit(event: DeployEvent): void {
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
    json: () => Promise<SidecarDeployResponse>;
  }> {
    if (typeof fetch !== "undefined") {
      const response = await fetch(url, options);
      return {
        ok: response.ok,
        status: response.status,
        json: () => response.json() as Promise<SidecarDeployResponse>,
      };
    }
    throw new Error("Fetch not available");
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a DeployTrigger instance.
 */
export function createDeployTrigger(
  config?: Partial<DeployTriggerConfig>,
  fetchFn?: FetchFunction
): DeployTrigger {
  return new DeployTrigger(config, fetchFn);
}

/**
 * Creates a trigger with mock fetch for testing.
 */
export function createMockDeployTrigger(
  config?: Partial<DeployTriggerConfig>,
  mockOptions?: Parameters<typeof createMockFetch>[0]
): DeployTrigger {
  return new DeployTrigger(config, createMockFetch(mockOptions));
}
