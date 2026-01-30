/**
 * Post-Deploy Verifier
 *
 * Comprehensive verification that a deployed module loads correctly:
 * - Verifies module is installed in Odoo
 * - Renders a sample page to confirm functionality
 * - Checks logs for errors during/after deployment
 *
 * Implements a multi-step verification pipeline with detailed reporting.
 */

import type { ModuleInfo } from "./module-installation-tester";
import type { RenderResult } from "./odoo-preview-renderer";
import type { LogEntry, LogInspector, LogSource } from "./log-inspector";

// =============================================================================
// Types
// =============================================================================

/** Individual verification check types */
export type VerificationCheckType =
  | "module_installed"
  | "module_state"
  | "render_page"
  | "render_template"
  | "log_errors"
  | "log_warnings"
  | "dependencies";

/** Status of a verification check */
export type VerificationStatus =
  | "pending"
  | "running"
  | "passed"
  | "failed"
  | "skipped"
  | "warning";

/** Individual verification check result */
export interface VerificationCheck {
  /** Check type */
  type: VerificationCheckType;
  /** Human-readable name */
  name: string;
  /** Check status */
  status: VerificationStatus;
  /** Detailed message */
  message: string;
  /** Duration in ms */
  duration: number;
  /** Additional details */
  details?: Record<string, unknown>;
  /** Timestamp */
  timestamp: number;
}

/** Post-deploy verification request */
export interface VerificationRequest {
  /** Module name to verify */
  moduleName: string;
  /** Request ID for tracking */
  requestId?: string;
  /** Page URL to render for verification (optional) */
  samplePageUrl?: string;
  /** Template to render for verification (optional) */
  sampleTemplate?: string;
  /** Context for template rendering */
  templateContext?: Record<string, unknown>;
  /** Whether to check for log errors */
  checkLogs?: boolean;
  /** Log sources to check for errors */
  logSources?: LogSource[];
  /**
   * Time window for log checking (ms).
   * Checks logs from (deployStartTime - logTimeWindow) to now.
   * This captures logs from before, during, and after deployment.
   */
  logTimeWindow?: number;
  /**
   * Timestamp when the deployment actually started (optional).
   * If not provided, uses the verification start time.
   * Pass this to capture logs from the actual deployment process.
   */
  deployStartTime?: number;
  /** Skip specific checks */
  skipChecks?: VerificationCheckType[];
  /** Timeout for verification (ms) */
  timeout?: number;
}

/** Complete verification result */
export interface VerificationResult {
  /** Overall verification passed */
  success: boolean;
  /** Module name */
  moduleName: string;
  /** Request ID */
  requestId: string;
  /** All checks performed */
  checks: VerificationCheck[];
  /** Summary counts */
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
  /** Total duration (ms) */
  duration: number;
  /** Timestamp */
  timestamp: number;
  /** Error message if failed */
  error?: string;
}

/** Sidecar module info response */
export interface SidecarModuleInfoResponse {
  /** Module name */
  name?: string;
  /** Display name */
  display_name?: string;
  /** Version */
  version?: string;
  /** Module state (installed, uninstalled, to_install, etc.) */
  state?: string;
  /** Dependencies */
  dependencies?: string[];
  /** Error message */
  error?: string;
}

/** Sidecar render response */
export interface SidecarRenderResponse {
  /** Rendered HTML */
  html?: string;
  /** Error message */
  error?: string;
  /** Render time from sidecar */
  render_time?: number;
}

/** Verifier configuration */
export interface VerifierConfig {
  /** Sidecar base URL */
  sidecarUrl: string;
  /** Module info endpoint */
  moduleInfoEndpoint: string;
  /** Render endpoint */
  renderEndpoint: string;
  /** Default timeout (ms) */
  timeout: number;
  /** Default page URL for verification */
  defaultPageUrl: string;
  /** Retry on transient failures */
  retryOnError: boolean;
  /** Max retries */
  maxRetries: number;
  /** Retry delay (ms) */
  retryDelay: number;
  /** Max acceptable log errors */
  maxLogErrors: number;
  /** Max acceptable log warnings */
  maxLogWarnings: number;
  /** Default log sources to check */
  defaultLogSources: LogSource[];
  /** Default log time window (ms) */
  defaultLogTimeWindow: number;
}

/** Verification event types */
export type VerificationEventType =
  | "verification:start"
  | "check:start"
  | "check:complete"
  | "verification:complete";

/** Verification event */
export interface VerificationEvent {
  /** Event type */
  type: VerificationEventType;
  /** Request that triggered event */
  request: VerificationRequest;
  /** Check if applicable */
  check?: VerificationCheck;
  /** Result if complete */
  result?: VerificationResult;
  /** Timestamp */
  timestamp: number;
}

/** Verification event callback */
export type VerificationEventCallback = (event: VerificationEvent) => void;

/** Fetch function type for dependency injection */
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
  json: () => Promise<SidecarModuleInfoResponse | SidecarRenderResponse>;
}>;

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: VerifierConfig = {
  sidecarUrl: "http://localhost:8069",
  moduleInfoEndpoint: "/api/modules/info",
  renderEndpoint: "/api/preview/render",
  timeout: 30000,
  defaultPageUrl: "/",
  retryOnError: true,
  maxRetries: 2,
  retryDelay: 1000,
  maxLogErrors: 0,
  maxLogWarnings: 5,
  defaultLogSources: ["odoo", "qweb", "preview"],
  defaultLogTimeWindow: 60000, // 1 minute
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generates a unique request ID.
 */
export function generateRequestId(): string {
  return `verify-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
 * Creates a passed check result.
 */
export function createPassedCheck(
  type: VerificationCheckType,
  name: string,
  message: string,
  duration: number,
  details?: Record<string, unknown>
): VerificationCheck {
  return {
    type,
    name,
    status: "passed",
    message,
    duration,
    details,
    timestamp: Date.now(),
  };
}

/**
 * Creates a failed check result.
 */
export function createFailedCheck(
  type: VerificationCheckType,
  name: string,
  message: string,
  duration: number,
  details?: Record<string, unknown>
): VerificationCheck {
  return {
    type,
    name,
    status: "failed",
    message,
    duration,
    details,
    timestamp: Date.now(),
  };
}

/**
 * Creates a warning check result.
 */
export function createWarningCheck(
  type: VerificationCheckType,
  name: string,
  message: string,
  duration: number,
  details?: Record<string, unknown>
): VerificationCheck {
  return {
    type,
    name,
    status: "warning",
    message,
    duration,
    details,
    timestamp: Date.now(),
  };
}

/**
 * Creates a skipped check result.
 */
export function createSkippedCheck(
  type: VerificationCheckType,
  name: string,
  reason: string
): VerificationCheck {
  return {
    type,
    name,
    status: "skipped",
    message: reason,
    duration: 0,
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
  moduleInstalled?: boolean;
  moduleState?: string;
  moduleVersion?: string;
  moduleDependencies?: string[];
  renderSuccess?: boolean;
  renderHtml?: string;
  renderError?: string;
  failCount?: number;
} = {}): FetchFunction {
  let callCount = 0;
  const failCount = options.failCount ?? 0;

  return async (url: string) => {
    callCount++;

    // Simulate network delay
    await delay(50);

    // Simulate transient failures
    if (callCount <= failCount) {
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: "Server error" }),
      };
    }

    // Module info endpoint
    if (url.includes("/api/modules/info")) {
      if (options.moduleInstalled === false) {
        return {
          ok: false,
          status: 404,
          json: async () => ({ error: "Module not found" }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          name: "test_module",
          display_name: "Test Module",
          version: options.moduleVersion ?? "1.0.0",
          state: options.moduleState ?? "installed",
          dependencies: options.moduleDependencies ?? [],
        }),
      };
    }

    // Render endpoint
    if (url.includes("/api/preview/render")) {
      if (options.renderSuccess === false || options.renderError) {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            error: options.renderError ?? "Render failed",
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          html: options.renderHtml ?? "<html><body>Sample Page</body></html>",
          render_time: 100,
        }),
      };
    }

    // Default response
    return {
      ok: false,
      status: 404,
      json: async () => ({ error: "Unknown endpoint" }),
    };
  };
}

// =============================================================================
// PostDeployVerifier Class
// =============================================================================

/**
 * Verifies that a deployed module loads correctly.
 */
export class PostDeployVerifier {
  private config: VerifierConfig;
  private callbacks: VerificationEventCallback[] = [];
  private fetchFn: FetchFunction;
  private logInspector: LogInspector | null = null;

  constructor(
    config: Partial<VerifierConfig> = {},
    fetchFn?: FetchFunction,
    logInspector?: LogInspector
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.fetchFn = fetchFn ?? this.defaultFetch.bind(this);
    this.logInspector = logInspector ?? null;
  }

  /**
   * Verifies a deployed module.
   */
  async verify(request: VerificationRequest): Promise<VerificationResult> {
    const requestId = request.requestId ?? generateRequestId();
    const fullRequest = { ...request, requestId };
    const timeout = request.timeout ?? this.config.timeout;
    const skipChecks = request.skipChecks ?? [];

    const startTime = Date.now();
    // Use provided deployStartTime for log checking, or fall back to verification start
    const deployStartTime = request.deployStartTime ?? startTime;
    const checks: VerificationCheck[] = [];

    this.emit({
      type: "verification:start",
      request: fullRequest,
      timestamp: Date.now(),
    });

    const { controller, timeoutId } = createTimeoutController(timeout);

    try {
      // 1. Verify module is installed
      if (!skipChecks.includes("module_installed")) {
        const installCheck = await this.checkModuleInstalled(
          fullRequest.moduleName,
          controller.signal
        );
        checks.push(installCheck);
        this.emitCheckComplete(fullRequest, installCheck);

        // If module not installed, fail fast
        if (installCheck.status === "failed") {
          return this.createResult(fullRequest, checks, startTime);
        }
      }

      // 2. Verify module state is "installed"
      if (!skipChecks.includes("module_state")) {
        const stateCheck = await this.checkModuleState(
          fullRequest.moduleName,
          controller.signal
        );
        checks.push(stateCheck);
        this.emitCheckComplete(fullRequest, stateCheck);
      }

      // 3. Verify dependencies are installed
      if (!skipChecks.includes("dependencies")) {
        const depsCheck = await this.checkDependencies(
          fullRequest.moduleName,
          controller.signal
        );
        checks.push(depsCheck);
        this.emitCheckComplete(fullRequest, depsCheck);
      }

      // 4. Render sample page
      if (!skipChecks.includes("render_page")) {
        const pageUrl = fullRequest.samplePageUrl ?? this.config.defaultPageUrl;
        const renderCheck = await this.checkRenderPage(
          pageUrl,
          controller.signal
        );
        checks.push(renderCheck);
        this.emitCheckComplete(fullRequest, renderCheck);
      }

      // 5. Render sample template (if specified)
      if (fullRequest.sampleTemplate && !skipChecks.includes("render_template")) {
        const templateCheck = await this.checkRenderTemplate(
          fullRequest.sampleTemplate,
          fullRequest.templateContext,
          controller.signal
        );
        checks.push(templateCheck);
        this.emitCheckComplete(fullRequest, templateCheck);
      }

      // 6. Check logs for errors
      if (
        (request.checkLogs !== false) &&
        !skipChecks.includes("log_errors")
      ) {
        if (this.logInspector) {
          const logErrorCheck = await this.checkLogErrors(
            fullRequest,
            deployStartTime
          );
          checks.push(logErrorCheck);
          this.emitCheckComplete(fullRequest, logErrorCheck);
        } else {
          // Add skipped check for audit trail when no inspector configured
          const skippedCheck = createSkippedCheck(
            "log_errors",
            "Log Errors",
            "No log inspector configured"
          );
          checks.push(skippedCheck);
          this.emitCheckComplete(fullRequest, skippedCheck);
        }
      }

      // 7. Check logs for warnings
      if (
        (request.checkLogs !== false) &&
        !skipChecks.includes("log_warnings")
      ) {
        if (this.logInspector) {
          const logWarningCheck = await this.checkLogWarnings(
            fullRequest,
            deployStartTime
          );
          checks.push(logWarningCheck);
          this.emitCheckComplete(fullRequest, logWarningCheck);
        } else {
          // Add skipped check for audit trail when no inspector configured
          const skippedCheck = createSkippedCheck(
            "log_warnings",
            "Log Warnings",
            "No log inspector configured"
          );
          checks.push(skippedCheck);
          this.emitCheckComplete(fullRequest, skippedCheck);
        }
      }

      return this.createResult(fullRequest, checks, startTime);
    } catch (error) {
      // Handle timeout or other errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.createResult(fullRequest, checks, startTime, errorMessage);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Quick verification - just module installed and sample page render.
   */
  async quickVerify(
    moduleName: string,
    pageUrl?: string
  ): Promise<VerificationResult> {
    return this.verify({
      moduleName,
      samplePageUrl: pageUrl,
      skipChecks: ["dependencies", "log_errors", "log_warnings", "render_template"],
    });
  }

  /**
   * Sets the log inspector for log checking.
   */
  setLogInspector(inspector: LogInspector): void {
    this.logInspector = inspector;
  }

  /**
   * Registers event callback.
   */
  onEvent(callback: VerificationEventCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Removes event callback.
   */
  offEvent(callback: VerificationEventCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Updates configuration.
   */
  updateConfig(config: Partial<VerifierConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets current configuration.
   */
  getConfig(): VerifierConfig {
    return { ...this.config };
  }

  // ---------------------------------------------------------------------------
  // Individual Check Methods
  // ---------------------------------------------------------------------------

  private async checkModuleInstalled(
    moduleName: string,
    signal: AbortSignal
  ): Promise<VerificationCheck> {
    const startTime = Date.now();
    const checkName = "Module Installed";

    this.emitCheckStart({ moduleName, requestId: "internal" }, "module_installed", checkName);

    try {
      const moduleInfo = await this.fetchModuleInfo(moduleName, signal);
      const duration = Date.now() - startTime;

      if (!moduleInfo) {
        return createFailedCheck(
          "module_installed",
          checkName,
          `Module '${moduleName}' not found in Odoo`,
          duration
        );
      }

      return createPassedCheck(
        "module_installed",
        checkName,
        `Module '${moduleName}' is installed (v${moduleInfo.version ?? "unknown"})`,
        duration,
        { version: moduleInfo.version, displayName: moduleInfo.display_name }
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      return createFailedCheck(
        "module_installed",
        checkName,
        `Failed to check module installation: ${message}`,
        duration
      );
    }
  }

  private async checkModuleState(
    moduleName: string,
    signal: AbortSignal
  ): Promise<VerificationCheck> {
    const startTime = Date.now();
    const checkName = "Module State";

    this.emitCheckStart({ moduleName, requestId: "internal" }, "module_state", checkName);

    try {
      const moduleInfo = await this.fetchModuleInfo(moduleName, signal);
      const duration = Date.now() - startTime;

      if (!moduleInfo) {
        return createFailedCheck(
          "module_state",
          checkName,
          "Cannot verify state - module not found",
          duration
        );
      }

      const state = moduleInfo.state ?? "unknown";
      if (state === "installed") {
        return createPassedCheck(
          "module_state",
          checkName,
          `Module state is '${state}'`,
          duration,
          { state }
        );
      }

      // Some states are warnings, others are failures
      if (state === "to upgrade" || state === "to install") {
        return createWarningCheck(
          "module_state",
          checkName,
          `Module state is '${state}' - pending action`,
          duration,
          { state }
        );
      }

      return createFailedCheck(
        "module_state",
        checkName,
        `Module state is '${state}' (expected 'installed')`,
        duration,
        { state }
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      return createFailedCheck(
        "module_state",
        checkName,
        `Failed to check module state: ${message}`,
        duration
      );
    }
  }

  private async checkDependencies(
    moduleName: string,
    signal: AbortSignal
  ): Promise<VerificationCheck> {
    const startTime = Date.now();
    const checkName = "Dependencies";

    this.emitCheckStart({ moduleName, requestId: "internal" }, "dependencies", checkName);

    try {
      const moduleInfo = await this.fetchModuleInfo(moduleName, signal);
      const duration = Date.now() - startTime;

      if (!moduleInfo) {
        return createSkippedCheck(
          "dependencies",
          checkName,
          "Cannot check dependencies - module not found"
        );
      }

      const dependencies = moduleInfo.dependencies ?? [];
      if (dependencies.length === 0) {
        return createPassedCheck(
          "dependencies",
          checkName,
          "No dependencies to verify",
          duration
        );
      }

      // Check each dependency
      const missingDeps: string[] = [];
      for (const dep of dependencies) {
        const depInfo = await this.fetchModuleInfo(dep, signal);
        if (!depInfo || depInfo.state !== "installed") {
          missingDeps.push(dep);
        }
      }

      if (missingDeps.length > 0) {
        return createFailedCheck(
          "dependencies",
          checkName,
          `Missing or uninstalled dependencies: ${missingDeps.join(", ")}`,
          Date.now() - startTime,
          { missingDeps, totalDeps: dependencies.length }
        );
      }

      return createPassedCheck(
        "dependencies",
        checkName,
        `All ${dependencies.length} dependencies installed`,
        Date.now() - startTime,
        { dependencies }
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      return createFailedCheck(
        "dependencies",
        checkName,
        `Failed to check dependencies: ${message}`,
        duration
      );
    }
  }

  private async checkRenderPage(
    pageUrl: string,
    signal: AbortSignal
  ): Promise<VerificationCheck> {
    const startTime = Date.now();
    const checkName = "Render Page";

    this.emitCheckStart({ moduleName: "", requestId: "internal" }, "render_page", checkName);

    try {
      const result = await this.fetchRender(pageUrl, undefined, undefined, signal);
      const duration = Date.now() - startTime;

      if (!result.success) {
        return createFailedCheck(
          "render_page",
          checkName,
          `Page render failed: ${result.error}`,
          duration,
          { pageUrl }
        );
      }

      // Check if HTML is non-empty and looks valid
      const html = result.html ?? "";
      if (html.length === 0) {
        return createFailedCheck(
          "render_page",
          checkName,
          "Page rendered empty content",
          duration,
          { pageUrl, htmlLength: 0 }
        );
      }

      // Basic sanity check - should contain HTML structure
      const hasHtmlStructure =
        html.includes("<html") ||
        html.includes("<body") ||
        html.includes("<div");

      if (!hasHtmlStructure) {
        return createWarningCheck(
          "render_page",
          checkName,
          `Page rendered but content looks unusual (${html.length} chars)`,
          duration,
          { pageUrl, htmlLength: html.length }
        );
      }

      return createPassedCheck(
        "render_page",
        checkName,
        `Page rendered successfully (${html.length} chars, ${result.renderTime ?? 0}ms)`,
        duration,
        { pageUrl, htmlLength: html.length, renderTime: result.renderTime }
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      return createFailedCheck(
        "render_page",
        checkName,
        `Page render error: ${message}`,
        duration,
        { pageUrl }
      );
    }
  }

  private async checkRenderTemplate(
    template: string,
    context: Record<string, unknown> | undefined,
    signal: AbortSignal
  ): Promise<VerificationCheck> {
    const startTime = Date.now();
    const checkName = "Render Template";

    this.emitCheckStart({ moduleName: "", requestId: "internal" }, "render_template", checkName);

    try {
      const result = await this.fetchRender(undefined, template, context, signal);
      const duration = Date.now() - startTime;

      if (!result.success) {
        return createFailedCheck(
          "render_template",
          checkName,
          `Template render failed: ${result.error}`,
          duration,
          { template }
        );
      }

      const html = result.html ?? "";
      if (html.length === 0) {
        return createWarningCheck(
          "render_template",
          checkName,
          "Template rendered empty content (may be expected)",
          duration,
          { template, htmlLength: 0 }
        );
      }

      return createPassedCheck(
        "render_template",
        checkName,
        `Template rendered successfully (${html.length} chars)`,
        duration,
        { template, htmlLength: html.length }
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      return createFailedCheck(
        "render_template",
        checkName,
        `Template render error: ${message}`,
        duration,
        { template }
      );
    }
  }

  private async checkLogErrors(
    request: VerificationRequest,
    deployStartTime: number
  ): Promise<VerificationCheck> {
    const startTime = Date.now();
    const checkName = "Log Errors";

    this.emitCheckStart(request, "log_errors", checkName);

    if (!this.logInspector) {
      return createSkippedCheck(
        "log_errors",
        checkName,
        "No log inspector configured"
      );
    }

    const sources = request.logSources ?? this.config.defaultLogSources;
    const timeWindow = request.logTimeWindow ?? this.config.defaultLogTimeWindow;
    // Look backward from deploy start to capture logs from deployment process
    // and forward to now to capture any runtime errors
    const sinceTime = deployStartTime - timeWindow;
    const untilTime = Date.now();

    const errors = this.logInspector.query({
      severity: ["error"],
      source: sources,
      since: sinceTime,
      until: untilTime,
    });

    const duration = Date.now() - startTime;

    if (errors.length > this.config.maxLogErrors) {
      return createFailedCheck(
        "log_errors",
        checkName,
        `Found ${errors.length} error(s) in logs (max allowed: ${this.config.maxLogErrors})`,
        duration,
        {
          errorCount: errors.length,
          maxAllowed: this.config.maxLogErrors,
          errors: errors.slice(0, 5).map((e) => ({
            source: e.source,
            message: e.message,
            file: e.file,
          })),
        }
      );
    }

    if (errors.length > 0) {
      return createWarningCheck(
        "log_errors",
        checkName,
        `Found ${errors.length} error(s) in logs (within threshold)`,
        duration,
        { errorCount: errors.length }
      );
    }

    return createPassedCheck(
      "log_errors",
      checkName,
      "No errors found in logs",
      duration,
      { sources, timeWindowMs: timeWindow }
    );
  }

  private async checkLogWarnings(
    request: VerificationRequest,
    deployStartTime: number
  ): Promise<VerificationCheck> {
    const startTime = Date.now();
    const checkName = "Log Warnings";

    this.emitCheckStart(request, "log_warnings", checkName);

    if (!this.logInspector) {
      return createSkippedCheck(
        "log_warnings",
        checkName,
        "No log inspector configured"
      );
    }

    const sources = request.logSources ?? this.config.defaultLogSources;
    const timeWindow = request.logTimeWindow ?? this.config.defaultLogTimeWindow;
    // Look backward from deploy start to capture logs from deployment process
    // and forward to now to capture any runtime warnings
    const sinceTime = deployStartTime - timeWindow;
    const untilTime = Date.now();

    const warnings = this.logInspector.query({
      severity: ["warning"],
      source: sources,
      since: sinceTime,
      until: untilTime,
    });

    const duration = Date.now() - startTime;

    if (warnings.length > this.config.maxLogWarnings) {
      return createWarningCheck(
        "log_warnings",
        checkName,
        `Found ${warnings.length} warning(s) in logs (exceeds threshold of ${this.config.maxLogWarnings})`,
        duration,
        {
          warningCount: warnings.length,
          threshold: this.config.maxLogWarnings,
          warnings: warnings.slice(0, 5).map((w) => ({
            source: w.source,
            message: w.message,
          })),
        }
      );
    }

    if (warnings.length > 0) {
      return createPassedCheck(
        "log_warnings",
        checkName,
        `Found ${warnings.length} warning(s) (within threshold)`,
        duration,
        { warningCount: warnings.length }
      );
    }

    return createPassedCheck(
      "log_warnings",
      checkName,
      "No warnings found in logs",
      duration
    );
  }

  // ---------------------------------------------------------------------------
  // Fetch Methods
  // ---------------------------------------------------------------------------

  private async fetchModuleInfo(
    moduleName: string,
    signal: AbortSignal
  ): Promise<SidecarModuleInfoResponse | null> {
    const url = `${this.config.sidecarUrl}${this.config.moduleInfoEndpoint}/${moduleName}`;

    for (let attempt = 0; attempt <= (this.config.retryOnError ? this.config.maxRetries : 0); attempt++) {
      try {
        const response = await this.fetchFn(url, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal,
        });

        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        return (await response.json()) as SidecarModuleInfoResponse;
      } catch (error) {
        if (signal.aborted) throw error;
        if (attempt < this.config.maxRetries) {
          await delay(this.config.retryDelay);
        } else {
          throw error;
        }
      }
    }

    return null;
  }

  private async fetchRender(
    pageUrl: string | undefined,
    template: string | undefined,
    context: Record<string, unknown> | undefined,
    signal: AbortSignal
  ): Promise<{ success: boolean; html?: string; error?: string; renderTime?: number }> {
    const url = `${this.config.sidecarUrl}${this.config.renderEndpoint}`;

    for (let attempt = 0; attempt <= (this.config.retryOnError ? this.config.maxRetries : 0); attempt++) {
      try {
        const response = await this.fetchFn(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            page_url: pageUrl,
            template,
            context,
            include_assets: false,
          }),
          signal,
        });

        const data = (await response.json()) as SidecarRenderResponse;

        if (!response.ok || data.error) {
          return {
            success: false,
            error: data.error ?? `HTTP ${response.status}`,
          };
        }

        return {
          success: true,
          html: data.html,
          renderTime: data.render_time,
        };
      } catch (error) {
        if (signal.aborted) throw error;
        if (attempt < this.config.maxRetries) {
          await delay(this.config.retryDelay);
        } else {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }
    }

    return { success: false, error: "Max retries exceeded" };
  }

  // ---------------------------------------------------------------------------
  // Result Creation
  // ---------------------------------------------------------------------------

  private createResult(
    request: VerificationRequest,
    checks: VerificationCheck[],
    startTime: number,
    error?: string
  ): VerificationResult {
    const summary = {
      total: checks.length,
      passed: checks.filter((c) => c.status === "passed").length,
      failed: checks.filter((c) => c.status === "failed").length,
      warnings: checks.filter((c) => c.status === "warning").length,
      skipped: checks.filter((c) => c.status === "skipped").length,
    };

    const success = summary.failed === 0 && !error;

    const result: VerificationResult = {
      success,
      moduleName: request.moduleName,
      requestId: request.requestId ?? generateRequestId(),
      checks,
      summary,
      duration: Date.now() - startTime,
      timestamp: Date.now(),
      error,
    };

    this.emit({
      type: "verification:complete",
      request,
      result,
      timestamp: Date.now(),
    });

    return result;
  }

  // ---------------------------------------------------------------------------
  // Event Emission
  // ---------------------------------------------------------------------------

  private emit(event: VerificationEvent): void {
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch {
        // Ignore callback errors
      }
    }
  }

  private emitCheckStart(
    request: VerificationRequest,
    type: VerificationCheckType,
    name: string
  ): void {
    this.emit({
      type: "check:start",
      request,
      check: {
        type,
        name,
        status: "running",
        message: "",
        duration: 0,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    });
  }

  private emitCheckComplete(
    request: VerificationRequest,
    check: VerificationCheck
  ): void {
    this.emit({
      type: "check:complete",
      request,
      check,
      timestamp: Date.now(),
    });
  }

  // ---------------------------------------------------------------------------
  // Default Fetch
  // ---------------------------------------------------------------------------

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
    json: () => Promise<SidecarModuleInfoResponse | SidecarRenderResponse>;
  }> {
    if (typeof fetch !== "undefined") {
      const response = await fetch(url, options);
      return {
        ok: response.ok,
        status: response.status,
        json: () => response.json(),
      };
    }
    throw new Error("Fetch not available");
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a PostDeployVerifier instance.
 */
export function createPostDeployVerifier(
  config?: Partial<VerifierConfig>,
  fetchFn?: FetchFunction,
  logInspector?: LogInspector
): PostDeployVerifier {
  return new PostDeployVerifier(config, fetchFn, logInspector);
}

/**
 * Creates a verifier with mock fetch for testing.
 */
export function createMockPostDeployVerifier(
  config?: Partial<VerifierConfig>,
  mockOptions?: Parameters<typeof createMockFetch>[0],
  logInspector?: LogInspector
): PostDeployVerifier {
  return new PostDeployVerifier(config, createMockFetch(mockOptions), logInspector);
}

// =============================================================================
// Convenience Function
// =============================================================================

/**
 * Quick post-deploy verification function.
 */
export async function verifyPostDeploy(
  moduleName: string,
  options: {
    sidecarUrl?: string;
    pageUrl?: string;
    timeout?: number;
    logInspector?: LogInspector;
  } = {}
): Promise<{
  success: boolean;
  message: string;
  details?: VerificationResult;
}> {
  const verifier = createPostDeployVerifier(
    { sidecarUrl: options.sidecarUrl, timeout: options.timeout },
    undefined,
    options.logInspector
  );

  const result = await verifier.verify({
    moduleName,
    samplePageUrl: options.pageUrl,
  });

  const failedChecks = result.checks.filter((c) => c.status === "failed");
  const warningChecks = result.checks.filter((c) => c.status === "warning");

  let message: string;
  if (result.success) {
    if (warningChecks.length > 0) {
      message = `Module '${moduleName}' verified with ${warningChecks.length} warning(s)`;
    } else {
      message = `Module '${moduleName}' verified successfully`;
    }
  } else {
    message = `Module '${moduleName}' verification failed: ${failedChecks.map((c) => c.message).join("; ")}`;
  }

  return {
    success: result.success,
    message,
    details: result,
  };
}
