/**
 * Deployment Rollback Handler
 *
 * Orchestrates automatic rollback on deployment failure:
 * - Creates pre-deployment snapshots for recovery
 * - Detects deployment failures via verification
 * - Triggers module uninstall on failure
 * - Restores previous version from snapshot
 * - Provides audit trail of all rollback attempts
 */

import type { LogInspector } from "./log-inspector";
import type {
  FailureContext,
  RecoveryPlan,
  RecoveryResult,
  RecoveryStrategy,
  RollbackState,
} from "../agent-bridge/rollback-recovery";
import {
  createRecoveryPlan,
  createRollbackState,
  recordAttempt,
  setLastGoodState,
} from "../agent-bridge/rollback-recovery";

// =============================================================================
// Types
// =============================================================================

/** Deployment snapshot for rollback */
export interface DeploymentSnapshot {
  /** Unique snapshot ID */
  id: string;
  /** Module name */
  moduleName: string;
  /** Module version before deployment */
  previousVersion: string | null;
  /** Timestamp when snapshot was created */
  timestamp: number;
  /** Module files for restoration */
  files?: ModuleFile[];
  /** Module manifest */
  manifest?: Record<string, unknown>;
  /** Git commit hash if available */
  gitCommit?: string;
  /** Label for this snapshot */
  label?: string;
}

/** Module file for backup */
export interface ModuleFile {
  /** Relative path within module */
  path: string;
  /** File content */
  content: string;
  /** Content hash for integrity */
  hash: string;
}

/** Deployment context for rollback decisions */
export interface DeploymentContext {
  /** Module being deployed */
  moduleName: string;
  /** Target environment */
  target: "preview" | "staging" | "production";
  /** Deploy ID for tracking */
  deployId: string;
  /** Deployment start timestamp */
  startTime: number;
  /** Pre-deployment snapshot */
  snapshot: DeploymentSnapshot | null;
  /** Whether git history is available */
  gitAvailable: boolean;
}

/** Rollback request */
export interface RollbackRequest {
  /** Deployment context */
  context: DeploymentContext;
  /** Error that triggered rollback */
  error: string;
  /** Which phase failed */
  failedPhase: "upload" | "install" | "verify" | "activate";
  /** Affected components */
  affectedComponents: string[];
  /** Whether partial deployment occurred */
  hasPartialDeployment: boolean;
}

/** Rollback result */
export interface RollbackResult {
  /** Whether rollback succeeded */
  success: boolean;
  /** Strategy that was used */
  strategyUsed: RecoveryStrategy;
  /** Whether fallback strategy was needed */
  usedFallback: boolean;
  /** Module state after rollback */
  moduleState: "uninstalled" | "restored" | "failed" | "unknown";
  /** Previous version restored (if applicable) */
  restoredVersion: string | null;
  /** Duration of rollback (ms) */
  duration: number;
  /** Human-readable message */
  message: string;
  /** Detailed steps taken */
  steps: RollbackStep[];
  /** Error if rollback failed */
  error?: string;
}

/** Individual rollback step result */
export interface RollbackStep {
  /** Step name */
  name: string;
  /** Whether step succeeded */
  success: boolean;
  /** Duration (ms) */
  duration: number;
  /** Message */
  message: string;
  /** Error if failed */
  error?: string;
}

/** Sidecar module info response */
export interface SidecarModuleInfo {
  name?: string;
  version?: string;
  state?: string;
  error?: string;
}

/** Sidecar uninstall response */
export interface SidecarUninstallResponse {
  success?: boolean;
  error?: string;
  message?: string;
}

/** Sidecar file write response */
export interface SidecarFileWriteResponse {
  success?: boolean;
  error?: string;
  path?: string;
}

/** Handler configuration */
export interface RollbackHandlerConfig {
  /** Sidecar base URL */
  sidecarUrl: string;
  /** Module info endpoint */
  moduleInfoEndpoint: string;
  /** Module uninstall endpoint */
  uninstallEndpoint: string;
  /** Module install endpoint */
  installEndpoint: string;
  /** File write endpoint */
  fileWriteEndpoint: string;
  /** Request timeout (ms) */
  timeout: number;
  /** Max rollback retries */
  maxRetries: number;
  /** Retry delay (ms) */
  retryDelay: number;
  /** Auto-execute rollback on failure */
  autoRollback: boolean;
  /** Create snapshot before deployment */
  createSnapshot: boolean;
  /** Maximum snapshots to retain */
  maxSnapshots: number;
}

/** Rollback event types */
export type RollbackEventType =
  | "snapshot:created"
  | "rollback:start"
  | "rollback:step"
  | "rollback:success"
  | "rollback:failed"
  | "uninstall:start"
  | "uninstall:success"
  | "uninstall:failed"
  | "restore:start"
  | "restore:success"
  | "restore:failed";

/** Rollback event */
export interface RollbackEvent {
  /** Event type */
  type: RollbackEventType;
  /** Deployment context */
  context: DeploymentContext;
  /** Current step if applicable */
  step?: RollbackStep;
  /** Result if complete */
  result?: RollbackResult;
  /** Timestamp */
  timestamp: number;
}

/** Rollback event callback */
export type RollbackEventCallback = (event: RollbackEvent) => void;

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
  json: () => Promise<SidecarModuleInfo | SidecarUninstallResponse | SidecarFileWriteResponse>;
}>;

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: RollbackHandlerConfig = {
  sidecarUrl: "http://localhost:8069",
  moduleInfoEndpoint: "/api/modules/info",
  uninstallEndpoint: "/api/modules/uninstall",
  installEndpoint: "/api/modules/install",
  fileWriteEndpoint: "/files",
  timeout: 60000,
  maxRetries: 2,
  retryDelay: 2000,
  autoRollback: true,
  createSnapshot: true,
  maxSnapshots: 10,
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generates a unique snapshot ID.
 */
export function generateSnapshotId(): string {
  return `snap-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Generates a unique deploy ID.
 */
export function generateDeployId(): string {
  return `deploy-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
 * Simple hash function for file content.
 */
export function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// =============================================================================
// Mock Fetch
// =============================================================================

/**
 * Creates a mock fetch function for testing.
 */
export function createMockFetch(options: {
  moduleInstalled?: boolean;
  moduleVersion?: string;
  moduleState?: string;
  uninstallSuccess?: boolean;
  installSuccess?: boolean;
  fileWriteSuccess?: boolean;
  failCount?: number;
} = {}): FetchFunction {
  let callCount = 0;
  const failCount = options.failCount ?? 0;

  return async (url: string) => {
    callCount++;

    await delay(50);

    if (callCount <= failCount) {
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: "Server error" }),
      };
    }

    if (url.includes("/api/modules/info")) {
      if (options.moduleInstalled === false) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            name: "test_module",
            state: "uninstalled",
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          name: "test_module",
          version: options.moduleVersion ?? "1.0.0",
          state: options.moduleState ?? "installed",
        }),
      };
    }

    if (url.includes("/api/modules/uninstall")) {
      if (options.uninstallSuccess === false) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: "Uninstall failed" }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: "Module uninstalled successfully",
        }),
      };
    }

    if (url.includes("/api/modules/install")) {
      if (options.installSuccess === false) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: "Install failed" }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: "Module installed successfully",
        }),
      };
    }

    if (url.includes("/files")) {
      if (options.fileWriteSuccess === false) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: "File write failed" }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          path: url.replace(/.*\/files/, ""),
        }),
      };
    }

    return {
      ok: false,
      status: 404,
      json: async () => ({ error: "Unknown endpoint" }),
    };
  };
}

// =============================================================================
// DeploymentRollbackHandler Class
// =============================================================================

/**
 * Handles automatic rollback on deployment failure.
 */
export class DeploymentRollbackHandler {
  private config: RollbackHandlerConfig;
  private callbacks: RollbackEventCallback[] = [];
  private fetchFn: FetchFunction;
  private logInspector: LogInspector | null = null;
  private snapshots: Map<string, DeploymentSnapshot> = new Map();
  private rollbackState: RollbackState;

  constructor(
    config: Partial<RollbackHandlerConfig> = {},
    fetchFn?: FetchFunction,
    logInspector?: LogInspector
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.fetchFn = fetchFn ?? this.defaultFetch.bind(this);
    this.logInspector = logInspector ?? null;
    this.rollbackState = createRollbackState();
  }

  // ---------------------------------------------------------------------------
  // Pre-Deployment Snapshot
  // ---------------------------------------------------------------------------

  /**
   * Creates a snapshot before deployment for potential rollback.
   */
  async createPreDeploySnapshot(
    moduleName: string,
    files?: ModuleFile[],
    manifest?: Record<string, unknown>
  ): Promise<DeploymentSnapshot> {
    const snapshotId = generateSnapshotId();

    const moduleInfo = await this.getModuleInfo(moduleName);
    const previousVersion = moduleInfo?.version ?? null;

    const snapshot: DeploymentSnapshot = {
      id: snapshotId,
      moduleName,
      previousVersion,
      timestamp: Date.now(),
      files,
      manifest,
      label: `pre-deploy-${Date.now()}`,
    };

    this.snapshots.set(snapshotId, snapshot);
    this.pruneSnapshots();

    if (moduleInfo?.state === "installed") {
      this.rollbackState = setLastGoodState(
        this.rollbackState,
        snapshotId,
        "snapshot"
      );
    }

    this.emit({
      type: "snapshot:created",
      context: {
        moduleName,
        target: "preview",
        deployId: "",
        startTime: Date.now(),
        snapshot,
        gitAvailable: false,
      },
      timestamp: Date.now(),
    });

    return snapshot;
  }

  /**
   * Retrieves a snapshot by ID.
   */
  getSnapshot(snapshotId: string): DeploymentSnapshot | null {
    return this.snapshots.get(snapshotId) ?? null;
  }

  /**
   * Gets the most recent snapshot for a module.
   */
  getLatestSnapshot(moduleName: string): DeploymentSnapshot | null {
    let latest: DeploymentSnapshot | null = null;
    for (const snapshot of this.snapshots.values()) {
      if (snapshot.moduleName === moduleName) {
        if (!latest || snapshot.timestamp > latest.timestamp) {
          latest = snapshot;
        }
      }
    }
    return latest;
  }

  // ---------------------------------------------------------------------------
  // Rollback Execution
  // ---------------------------------------------------------------------------

  /**
   * Executes rollback on deployment failure.
   */
  async rollback(request: RollbackRequest): Promise<RollbackResult> {
    const startTime = Date.now();
    const steps: RollbackStep[] = [];

    const { context } = request;

    this.emit({
      type: "rollback:start",
      context,
      timestamp: Date.now(),
    });

    const failureContext = this.buildFailureContext(request);
    const plan = createRecoveryPlan(failureContext);

    let result = await this.executeStrategy(
      plan.strategy,
      request,
      steps
    );

    // Only try fallback if:
    // 1. Primary strategy failed
    // 2. Fallback is not manual
    // 3. No partial completion occurred (module not already modified)
    // When snapshot restore partially completes (uninstall succeeded but file restore failed),
    // falling back to retry won't help - we've lost the restoration goal.
    const hasPartialCompletion = !result.success &&
      result.moduleState === "uninstalled" &&
      steps.some(s => s.name === "restore_files" && !s.success);

    if (!result.success && plan.fallback !== "manual" && !hasPartialCompletion) {
      const fallbackResult = await this.executeStrategy(
        plan.fallback,
        request,
        steps
      );
      result = {
        ...fallbackResult,
        usedFallback: true,
      };
    }

    const finalResult: RollbackResult = {
      ...result,
      duration: Date.now() - startTime,
      steps,
    };

    const recoveryResult: RecoveryResult = {
      success: finalResult.success,
      strategyUsed: result.strategyUsed,
      usedFallback: result.usedFallback,
      recoveredSections: finalResult.success ? [context.moduleName] : [],
      unrecoveredSections: finalResult.success ? [] : [context.moduleName],
      durationMs: finalResult.duration,
      message: finalResult.message,
    };

    this.rollbackState = recordAttempt(
      this.rollbackState,
      failureContext,
      plan,
      recoveryResult
    );

    this.emit({
      type: finalResult.success ? "rollback:success" : "rollback:failed",
      context,
      result: finalResult,
      timestamp: Date.now(),
    });

    return finalResult;
  }

  /**
   * Quick rollback using the most recent snapshot.
   */
  async quickRollback(
    moduleName: string,
    error: string
  ): Promise<RollbackResult> {
    const snapshot = this.getLatestSnapshot(moduleName);

    const context: DeploymentContext = {
      moduleName,
      target: "preview",
      deployId: generateDeployId(),
      startTime: Date.now(),
      snapshot,
      gitAvailable: false,
    };

    return this.rollback({
      context,
      error,
      failedPhase: "verify",
      affectedComponents: [moduleName],
      hasPartialDeployment: true,
    });
  }

  // ---------------------------------------------------------------------------
  // Strategy Execution
  // ---------------------------------------------------------------------------

  private async executeStrategy(
    strategy: RecoveryStrategy,
    request: RollbackRequest,
    steps: RollbackStep[]
  ): Promise<RollbackResult> {
    const { context } = request;

    switch (strategy) {
      case "snapshot":
        return this.executeSnapshotRestore(context, steps);

      case "retry":
        return this.executeRetry(context, steps);

      case "git":
        return this.executeGitRevert(context, steps);

      case "manual":
        return this.executeManualRecovery(context, request, steps);

      default:
        return {
          success: false,
          strategyUsed: strategy,
          usedFallback: false,
          moduleState: "unknown",
          restoredVersion: null,
          duration: 0,
          message: `Unknown strategy: ${strategy}`,
          steps,
          error: `Unknown recovery strategy: ${strategy}`,
        };
    }
  }

  private async executeSnapshotRestore(
    context: DeploymentContext,
    steps: RollbackStep[]
  ): Promise<RollbackResult> {
    const { moduleName, snapshot } = context;

    // Step 1: Uninstall failed module
    const uninstallStep = await this.executeUninstall(moduleName);
    steps.push(uninstallStep);
    this.emitStep(context, uninstallStep);

    if (!uninstallStep.success) {
      return {
        success: false,
        strategyUsed: "snapshot",
        usedFallback: false,
        moduleState: "failed",
        restoredVersion: null,
        duration: 0,
        message: `Failed to uninstall module: ${uninstallStep.error}`,
        steps,
        error: uninstallStep.error,
      };
    }

    // Step 2: Restore files from snapshot (if available)
    if (snapshot?.files && snapshot.files.length > 0) {
      const restoreStep = await this.executeFileRestore(snapshot);
      steps.push(restoreStep);
      this.emitStep(context, restoreStep);

      if (!restoreStep.success) {
        return {
          success: false,
          strategyUsed: "snapshot",
          usedFallback: false,
          moduleState: "uninstalled",
          restoredVersion: null,
          duration: 0,
          message: `Module uninstalled but file restore failed: ${restoreStep.error}`,
          steps,
          error: restoreStep.error,
        };
      }

      // Step 3: Reinstall module from restored files
      const installStep = await this.executeInstall(moduleName);
      steps.push(installStep);
      this.emitStep(context, installStep);

      if (!installStep.success) {
        return {
          success: false,
          strategyUsed: "snapshot",
          usedFallback: false,
          moduleState: "uninstalled",
          restoredVersion: null,
          duration: 0,
          message: `Files restored but module install failed: ${installStep.error}`,
          steps,
          error: installStep.error,
        };
      }

      // Step 4: Verify restoration
      const verifyStep = await this.executeVerify(moduleName);
      steps.push(verifyStep);
      this.emitStep(context, verifyStep);

      return {
        success: verifyStep.success,
        strategyUsed: "snapshot",
        usedFallback: false,
        moduleState: verifyStep.success ? "restored" : "uninstalled",
        restoredVersion: snapshot.previousVersion,
        duration: 0,
        message: verifyStep.success
          ? `Restored to version ${snapshot.previousVersion ?? "unknown"}`
          : `Restore verification failed: ${verifyStep.error}`,
        steps,
        error: verifyStep.success ? undefined : verifyStep.error,
      };
    }

    // No files to restore - module is just uninstalled
    return {
      success: true,
      strategyUsed: "snapshot",
      usedFallback: false,
      moduleState: "uninstalled",
      restoredVersion: null,
      duration: 0,
      message: "Failed module uninstalled (no previous version to restore)",
      steps,
    };
  }

  private async executeRetry(
    context: DeploymentContext,
    steps: RollbackStep[]
  ): Promise<RollbackResult> {
    const uninstallStep = await this.executeUninstall(context.moduleName);
    steps.push(uninstallStep);
    this.emitStep(context, uninstallStep);

    return {
      success: uninstallStep.success,
      strategyUsed: "retry",
      usedFallback: false,
      moduleState: uninstallStep.success ? "uninstalled" : "failed",
      restoredVersion: null,
      duration: 0,
      message: uninstallStep.success
        ? "Module uninstalled, ready for retry"
        : `Uninstall failed: ${uninstallStep.error}`,
      steps,
      error: uninstallStep.success ? undefined : uninstallStep.error,
    };
  }

  private async executeGitRevert(
    context: DeploymentContext,
    steps: RollbackStep[]
  ): Promise<RollbackResult> {
    const uninstallStep = await this.executeUninstall(context.moduleName);
    steps.push(uninstallStep);
    this.emitStep(context, uninstallStep);

    const gitStep: RollbackStep = {
      name: "git_revert",
      success: true,
      duration: 0,
      message: "Git revert should be performed externally",
    };
    steps.push(gitStep);

    return {
      success: uninstallStep.success,
      strategyUsed: "git",
      usedFallback: false,
      moduleState: uninstallStep.success ? "uninstalled" : "failed",
      restoredVersion: null,
      duration: 0,
      message: uninstallStep.success
        ? "Module uninstalled. Run git revert manually to restore files."
        : `Uninstall failed: ${uninstallStep.error}`,
      steps,
      error: uninstallStep.success ? undefined : uninstallStep.error,
    };
  }

  private async executeManualRecovery(
    context: DeploymentContext,
    request: RollbackRequest,
    steps: RollbackStep[]
  ): Promise<RollbackResult> {
    const diagnosticStep: RollbackStep = {
      name: "generate_diagnostics",
      success: true,
      duration: 0,
      message: `Manual recovery required. Error: ${request.error}. Failed phase: ${request.failedPhase}`,
    };
    steps.push(diagnosticStep);

    return {
      success: false,
      strategyUsed: "manual",
      usedFallback: false,
      moduleState: "unknown",
      restoredVersion: null,
      duration: 0,
      message: `Manual recovery required: ${request.error}`,
      steps,
      error: "Automatic recovery not possible",
    };
  }

  // ---------------------------------------------------------------------------
  // Individual Step Execution
  // ---------------------------------------------------------------------------

  private async executeUninstall(moduleName: string): Promise<RollbackStep> {
    const startTime = Date.now();

    this.emit({
      type: "uninstall:start",
      context: {
        moduleName,
        target: "preview",
        deployId: "",
        startTime,
        snapshot: null,
        gitAvailable: false,
      },
      timestamp: Date.now(),
    });

    try {
      const { controller, timeoutId } = createTimeoutController(this.config.timeout);

      const url = `${this.config.sidecarUrl}${this.config.uninstallEndpoint}`;
      const response = await this.fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module_name: moduleName }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = (await response.json()) as SidecarUninstallResponse;
      const duration = Date.now() - startTime;

      if (!response.ok || data.error) {
        this.emit({
          type: "uninstall:failed",
          context: {
            moduleName,
            target: "preview",
            deployId: "",
            startTime,
            snapshot: null,
            gitAvailable: false,
          },
          timestamp: Date.now(),
        });

        return {
          name: "uninstall_module",
          success: false,
          duration,
          message: `Failed to uninstall ${moduleName}`,
          error: data.error ?? `HTTP ${response.status}`,
        };
      }

      this.emit({
        type: "uninstall:success",
        context: {
          moduleName,
          target: "preview",
          deployId: "",
          startTime,
          snapshot: null,
          gitAvailable: false,
        },
        timestamp: Date.now(),
      });

      return {
        name: "uninstall_module",
        success: true,
        duration,
        message: `Module ${moduleName} uninstalled successfully`,
      };
    } catch (error) {
      this.emit({
        type: "uninstall:failed",
        context: {
          moduleName,
          target: "preview",
          deployId: "",
          startTime,
          snapshot: null,
          gitAvailable: false,
        },
        timestamp: Date.now(),
      });

      return {
        name: "uninstall_module",
        success: false,
        duration: Date.now() - startTime,
        message: `Failed to uninstall ${moduleName}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async executeFileRestore(
    snapshot: DeploymentSnapshot
  ): Promise<RollbackStep> {
    const startTime = Date.now();

    this.emit({
      type: "restore:start",
      context: {
        moduleName: snapshot.moduleName,
        target: "preview",
        deployId: "",
        startTime,
        snapshot,
        gitAvailable: false,
      },
      timestamp: Date.now(),
    });

    if (!snapshot.files || snapshot.files.length === 0) {
      return {
        name: "restore_files",
        success: true,
        duration: 0,
        message: "No files to restore",
      };
    }

    try {
      const { controller, timeoutId } = createTimeoutController(this.config.timeout);
      const errors: string[] = [];
      let restoredCount = 0;

      // Restore each file via sidecar
      for (const file of snapshot.files) {
        const filePath = `${snapshot.moduleName}/${file.path}`;
        const url = `${this.config.sidecarUrl}${this.config.fileWriteEndpoint}/${filePath}`;

        try {
          const response = await this.fetchFn(url, {
            method: "PUT",
            headers: {
              "Content-Type": "application/octet-stream",
              "X-File-Hash": file.hash,
            },
            body: file.content,
            signal: controller.signal,
          });

          if (!response.ok) {
            const data = (await response.json()) as SidecarFileWriteResponse;
            errors.push(`${file.path}: ${data.error ?? `HTTP ${response.status}`}`);
          } else {
            restoredCount++;
          }
        } catch (err) {
          errors.push(`${file.path}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;

      if (errors.length > 0) {
        this.emit({
          type: "restore:failed",
          context: {
            moduleName: snapshot.moduleName,
            target: "preview",
            deployId: "",
            startTime,
            snapshot,
            gitAvailable: false,
          },
          timestamp: Date.now(),
        });

        return {
          name: "restore_files",
          success: false,
          duration,
          message: `Restored ${restoredCount}/${snapshot.files.length} files`,
          error: errors.join("; "),
        };
      }

      this.emit({
        type: "restore:success",
        context: {
          moduleName: snapshot.moduleName,
          target: "preview",
          deployId: "",
          startTime,
          snapshot,
          gitAvailable: false,
        },
        timestamp: Date.now(),
      });

      return {
        name: "restore_files",
        success: true,
        duration,
        message: `Restored ${restoredCount} files from snapshot`,
      };
    } catch (error) {
      this.emit({
        type: "restore:failed",
        context: {
          moduleName: snapshot.moduleName,
          target: "preview",
          deployId: "",
          startTime,
          snapshot,
          gitAvailable: false,
        },
        timestamp: Date.now(),
      });

      return {
        name: "restore_files",
        success: false,
        duration: Date.now() - startTime,
        message: "Failed to restore files from snapshot",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async executeInstall(moduleName: string): Promise<RollbackStep> {
    const startTime = Date.now();

    try {
      const { controller, timeoutId } = createTimeoutController(this.config.timeout);

      const url = `${this.config.sidecarUrl}${this.config.installEndpoint}`;
      const response = await this.fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module_name: moduleName,
          force_reinstall: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = (await response.json()) as SidecarUninstallResponse;
      const duration = Date.now() - startTime;

      if (!response.ok || data.error) {
        return {
          name: "install_module",
          success: false,
          duration,
          message: `Failed to install ${moduleName}`,
          error: data.error ?? `HTTP ${response.status}`,
        };
      }

      return {
        name: "install_module",
        success: true,
        duration,
        message: `Module ${moduleName} installed successfully`,
      };
    } catch (error) {
      return {
        name: "install_module",
        success: false,
        duration: Date.now() - startTime,
        message: `Failed to install ${moduleName}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async executeVerify(moduleName: string): Promise<RollbackStep> {
    const startTime = Date.now();

    try {
      const moduleInfo = await this.getModuleInfo(moduleName);
      const duration = Date.now() - startTime;

      if (!moduleInfo) {
        return {
          name: "verify_restore",
          success: false,
          duration,
          message: "Could not verify module state",
          error: "Module info not available",
        };
      }

      const isInstalled = moduleInfo.state === "installed";

      return {
        name: "verify_restore",
        success: isInstalled,
        duration,
        message: isInstalled
          ? `Module ${moduleName} verified as installed (v${moduleInfo.version})`
          : `Module state is '${moduleInfo.state}', expected 'installed'`,
        error: isInstalled ? undefined : `Unexpected state: ${moduleInfo.state}`,
      };
    } catch (error) {
      return {
        name: "verify_restore",
        success: false,
        duration: Date.now() - startTime,
        message: "Verification failed",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Helper Methods
  // ---------------------------------------------------------------------------

  private buildFailureContext(request: RollbackRequest): FailureContext {
    const { context, error, failedPhase, affectedComponents, hasPartialDeployment } = request;

    return {
      error,
      phase: failedPhase,
      affectedSections: affectedComponents,
      hasPartialOutput: hasPartialDeployment,
      hasSnapshot: context.snapshot !== null,
      hasGitHistory: context.gitAvailable,
      hasYjsHistory: false,
      retryCount: this.rollbackState.attempts.length,
      maxRetries: this.config.maxRetries,
    };
  }

  private async getModuleInfo(moduleName: string): Promise<SidecarModuleInfo | null> {
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

      return (await response.json()) as SidecarModuleInfo;
    } catch {
      return null;
    }
  }

  private pruneSnapshots(): void {
    if (this.snapshots.size <= this.config.maxSnapshots) {
      return;
    }

    const sorted = Array.from(this.snapshots.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = sorted.slice(0, sorted.length - this.config.maxSnapshots);
    for (const [id] of toRemove) {
      this.snapshots.delete(id);
    }
  }

  // ---------------------------------------------------------------------------
  // Event Emission
  // ---------------------------------------------------------------------------

  private emit(event: RollbackEvent): void {
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch {
        // Ignore callback errors
      }
    }
  }

  private emitStep(context: DeploymentContext, step: RollbackStep): void {
    this.emit({
      type: "rollback:step",
      context,
      step,
      timestamp: Date.now(),
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Registers event callback.
   */
  onEvent(callback: RollbackEventCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Removes event callback.
   */
  offEvent(callback: RollbackEventCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Sets log inspector for log analysis.
   */
  setLogInspector(inspector: LogInspector): void {
    this.logInspector = inspector;
  }

  /**
   * Gets current rollback state.
   */
  getRollbackState(): RollbackState {
    return this.rollbackState;
  }

  /**
   * Gets all snapshots.
   */
  getSnapshots(): DeploymentSnapshot[] {
    return Array.from(this.snapshots.values());
  }

  /**
   * Clears all snapshots.
   */
  clearSnapshots(): void {
    this.snapshots.clear();
  }

  /**
   * Updates configuration.
   */
  updateConfig(config: Partial<RollbackHandlerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets current configuration.
   */
  getConfig(): RollbackHandlerConfig {
    return { ...this.config };
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
    json: () => Promise<SidecarModuleInfo | SidecarUninstallResponse | SidecarFileWriteResponse>;
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
 * Creates a DeploymentRollbackHandler instance.
 */
export function createRollbackHandler(
  config?: Partial<RollbackHandlerConfig>,
  fetchFn?: FetchFunction,
  logInspector?: LogInspector
): DeploymentRollbackHandler {
  return new DeploymentRollbackHandler(config, fetchFn, logInspector);
}

/**
 * Creates a handler with mock fetch for testing.
 */
export function createMockRollbackHandler(
  config?: Partial<RollbackHandlerConfig>,
  mockOptions?: Parameters<typeof createMockFetch>[0],
  logInspector?: LogInspector
): DeploymentRollbackHandler {
  return new DeploymentRollbackHandler(config, createMockFetch(mockOptions), logInspector);
}
