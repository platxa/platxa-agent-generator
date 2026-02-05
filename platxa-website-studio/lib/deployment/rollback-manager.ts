/**
 * Deployment Rollback Manager
 *
 * Manages deployment versions and provides rollback functionality
 * to revert to any previous deployment version.
 *
 * Feature #86: Deployment - Rollback functionality
 */

// =============================================================================
// Types
// =============================================================================

export type DeploymentStatus =
  | "pending"
  | "in_progress"
  | "success"
  | "failed"
  | "rolled_back"
  | "cancelled";

export type RollbackStatus =
  | "pending"
  | "in_progress"
  | "success"
  | "failed"
  | "cancelled";

export interface DeploymentArtifact {
  /** Artifact type */
  type: "bundle" | "asset" | "config" | "database" | "other";
  /** Artifact name/path */
  name: string;
  /** Artifact size in bytes */
  size: number;
  /** Checksum/hash */
  checksum: string;
  /** Storage URL */
  url: string;
}

export interface DeploymentVersion {
  /** Unique version ID */
  id: string;
  /** Version number (semver or incremental) */
  version: string;
  /** Environment deployed to */
  environment: string;
  /** Deployment status */
  status: DeploymentStatus;
  /** Git commit hash */
  commitHash: string;
  /** Git branch */
  branch: string;
  /** Commit message */
  commitMessage?: string;
  /** Deployed by user */
  deployedBy: {
    id: string;
    name: string;
    email?: string;
  };
  /** Deployment start time */
  startedAt: Date;
  /** Deployment completion time */
  completedAt?: Date;
  /** Deployment duration in ms */
  duration?: number;
  /** Deployment artifacts */
  artifacts: DeploymentArtifact[];
  /** Configuration snapshot */
  configSnapshot?: Record<string, unknown>;
  /** Database migration version */
  migrationVersion?: string;
  /** Deployment notes */
  notes?: string;
  /** Tags/labels */
  tags: string[];
  /** Health check results */
  healthCheck?: {
    passed: boolean;
    checks: Array<{ name: string; passed: boolean; message?: string }>;
  };
  /** Rollback reference (if this version was rolled back) */
  rolledBackTo?: string;
  /** Rollback timestamp */
  rolledBackAt?: Date;
}

export interface RollbackOperation {
  /** Unique rollback ID */
  id: string;
  /** Source version being rolled back from */
  fromVersion: string;
  /** Target version to rollback to */
  toVersion: string;
  /** Environment */
  environment: string;
  /** Rollback status */
  status: RollbackStatus;
  /** Initiated by user */
  initiatedBy: {
    id: string;
    name: string;
  };
  /** Rollback reason */
  reason: string;
  /** Start time */
  startedAt: Date;
  /** Completion time */
  completedAt?: Date;
  /** Duration in ms */
  duration?: number;
  /** Rollback steps executed */
  steps: RollbackStep[];
  /** Error details if failed */
  error?: string;
  /** Auto-rollback trigger */
  autoTriggered: boolean;
  /** Trigger reason if auto */
  triggerReason?: string;
}

export interface RollbackStep {
  /** Step name */
  name: string;
  /** Step status */
  status: "pending" | "in_progress" | "success" | "failed" | "skipped";
  /** Start time */
  startedAt?: Date;
  /** Completion time */
  completedAt?: Date;
  /** Step output/logs */
  output?: string;
  /** Error message */
  error?: string;
}

export interface RollbackPolicy {
  /** Enable auto-rollback on deployment failure */
  autoRollbackOnFailure: boolean;
  /** Enable auto-rollback on health check failure */
  autoRollbackOnHealthFailure: boolean;
  /** Health check timeout before auto-rollback (ms) */
  healthCheckTimeout: number;
  /** Maximum rollback attempts */
  maxRollbackAttempts: number;
  /** Keep minimum number of versions */
  minVersionsToKeep: number;
  /** Maximum versions to retain */
  maxVersionsToRetain: number;
  /** Notify on rollback */
  notifyOnRollback: boolean;
  /** Require approval for production rollback */
  requireApprovalForProduction: boolean;
}

export interface RollbackResult {
  success: boolean;
  operation: RollbackOperation;
  newCurrentVersion?: DeploymentVersion;
  error?: string;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_ROLLBACK_POLICY: RollbackPolicy = {
  autoRollbackOnFailure: true,
  autoRollbackOnHealthFailure: true,
  healthCheckTimeout: 60000,
  maxRollbackAttempts: 3,
  minVersionsToKeep: 5,
  maxVersionsToRetain: 50,
  notifyOnRollback: true,
  requireApprovalForProduction: true,
};

const ROLLBACK_STEPS: string[] = [
  "validate_target_version",
  "backup_current_state",
  "stop_services",
  "restore_artifacts",
  "restore_config",
  "run_migrations_down",
  "start_services",
  "health_check",
  "cleanup",
];

// =============================================================================
// Rollback Manager
// =============================================================================

export class RollbackManager {
  private versions: Map<string, DeploymentVersion[]> = new Map(); // env -> versions
  private rollbacks: Map<string, RollbackOperation[]> = new Map(); // env -> rollbacks
  private currentVersions: Map<string, string> = new Map(); // env -> version id
  private policies: Map<string, RollbackPolicy> = new Map(); // env -> policy
  private listeners: ((event: RollbackEvent) => void)[] = [];

  constructor() {}

  // ---------------------------------------------------------------------------
  // Version Management
  // ---------------------------------------------------------------------------

  /**
   * Record a new deployment version
   */
  recordDeployment(
    environment: string,
    deployment: Omit<DeploymentVersion, "id">
  ): DeploymentVersion {
    const versions = this.versions.get(environment) || [];

    const version: DeploymentVersion = {
      ...deployment,
      id: `deploy-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };

    versions.unshift(version); // Add to beginning (newest first)

    // Enforce retention policy
    const policy = this.getPolicy(environment);
    while (versions.length > policy.maxVersionsToRetain) {
      versions.pop();
    }

    this.versions.set(environment, versions);

    // Update current version if deployment succeeded
    if (version.status === "success") {
      this.currentVersions.set(environment, version.id);
    }

    this.emit({
      type: "deployment:recorded",
      environment,
      version,
    });

    return version;
  }

  /**
   * Update deployment status
   */
  updateDeploymentStatus(
    environment: string,
    versionId: string,
    status: DeploymentStatus,
    details?: Partial<DeploymentVersion>
  ): DeploymentVersion | null {
    const versions = this.versions.get(environment);
    const version = versions?.find((v) => v.id === versionId);

    if (!version) return null;

    version.status = status;
    if (details) {
      Object.assign(version, details);
    }

    if (status === "success" || status === "failed") {
      version.completedAt = new Date();
      version.duration = version.completedAt.getTime() - version.startedAt.getTime();
    }

    // Auto-rollback on failure
    if (status === "failed") {
      const policy = this.getPolicy(environment);
      if (policy.autoRollbackOnFailure) {
        this.triggerAutoRollback(environment, versionId, "Deployment failed");
      }
    }

    // Update current version on success
    if (status === "success") {
      this.currentVersions.set(environment, versionId);
    }

    return version;
  }

  /**
   * Get deployment versions for an environment
   */
  getVersions(
    environment: string,
    options?: {
      status?: DeploymentStatus;
      limit?: number;
      since?: Date;
    }
  ): DeploymentVersion[] {
    let versions = this.versions.get(environment) || [];

    if (options?.status) {
      versions = versions.filter((v) => v.status === options.status);
    }

    if (options?.since) {
      versions = versions.filter((v) => v.startedAt >= options.since!);
    }

    if (options?.limit) {
      versions = versions.slice(0, options.limit);
    }

    return versions;
  }

  /**
   * Get a specific version
   */
  getVersion(environment: string, versionId: string): DeploymentVersion | null {
    const versions = this.versions.get(environment) || [];
    return versions.find((v) => v.id === versionId) || null;
  }

  /**
   * Get current active version
   */
  getCurrentVersion(environment: string): DeploymentVersion | null {
    const currentId = this.currentVersions.get(environment);
    if (!currentId) return null;
    return this.getVersion(environment, currentId);
  }

  /**
   * Get previous version (for rollback)
   */
  getPreviousVersion(environment: string): DeploymentVersion | null {
    const versions = this.getVersions(environment, { status: "success" });
    return versions.length > 1 ? versions[1] : null;
  }

  /**
   * Get rollback-eligible versions
   */
  getRollbackTargets(environment: string): DeploymentVersion[] {
    const currentId = this.currentVersions.get(environment);
    const versions = this.getVersions(environment, { status: "success" });

    // Filter out current version and already rolled-back versions
    return versions.filter(
      (v) => v.id !== currentId && v.status !== "rolled_back"
    );
  }

  // ---------------------------------------------------------------------------
  // Rollback Operations
  // ---------------------------------------------------------------------------

  /**
   * Initiate a rollback operation
   */
  async rollback(
    environment: string,
    targetVersionId: string,
    initiatedBy: { id: string; name: string },
    reason: string,
    options?: { skipApproval?: boolean }
  ): Promise<RollbackResult> {
    const policy = this.getPolicy(environment);
    const currentVersion = this.getCurrentVersion(environment);
    const targetVersion = this.getVersion(environment, targetVersionId);

    // Validation
    if (!currentVersion) {
      return {
        success: false,
        operation: this.createFailedOperation(environment, "", targetVersionId, initiatedBy, reason, "No current version found"),
        error: "No current version found",
      };
    }

    if (!targetVersion) {
      return {
        success: false,
        operation: this.createFailedOperation(environment, currentVersion.id, targetVersionId, initiatedBy, reason, "Target version not found"),
        error: "Target version not found",
      };
    }

    if (targetVersion.status !== "success") {
      return {
        success: false,
        operation: this.createFailedOperation(environment, currentVersion.id, targetVersionId, initiatedBy, reason, "Cannot rollback to a non-successful deployment"),
        error: "Cannot rollback to a non-successful deployment",
      };
    }

    // Check approval requirement
    if (
      policy.requireApprovalForProduction &&
      environment === "production" &&
      !options?.skipApproval
    ) {
      return {
        success: false,
        operation: this.createFailedOperation(environment, currentVersion.id, targetVersionId, initiatedBy, reason, "Production rollback requires approval"),
        error: "Production rollback requires approval",
      };
    }

    // Create rollback operation
    const operation: RollbackOperation = {
      id: `rollback-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fromVersion: currentVersion.id,
      toVersion: targetVersionId,
      environment,
      status: "in_progress",
      initiatedBy,
      reason,
      startedAt: new Date(),
      steps: ROLLBACK_STEPS.map((name) => ({
        name,
        status: "pending" as const,
      })),
      autoTriggered: false,
    };

    // Store rollback operation
    const rollbacks = this.rollbacks.get(environment) || [];
    rollbacks.unshift(operation);
    this.rollbacks.set(environment, rollbacks);

    this.emit({
      type: "rollback:started",
      environment,
      operation,
    });

    // Execute rollback steps
    try {
      await this.executeRollback(operation, currentVersion, targetVersion);

      operation.status = "success";
      operation.completedAt = new Date();
      operation.duration = operation.completedAt.getTime() - operation.startedAt.getTime();

      // Update version states
      currentVersion.status = "rolled_back";
      currentVersion.rolledBackTo = targetVersionId;
      currentVersion.rolledBackAt = new Date();

      // Set target as current
      this.currentVersions.set(environment, targetVersionId);

      this.emit({
        type: "rollback:completed",
        environment,
        operation,
      });

      if (policy.notifyOnRollback) {
        this.emit({
          type: "rollback:notify",
          environment,
          operation,
        });
      }

      return {
        success: true,
        operation,
        newCurrentVersion: targetVersion,
      };
    } catch (error) {
      operation.status = "failed";
      operation.completedAt = new Date();
      operation.duration = operation.completedAt.getTime() - operation.startedAt.getTime();
      operation.error = error instanceof Error ? error.message : String(error);

      this.emit({
        type: "rollback:failed",
        environment,
        operation,
        error: operation.error,
      });

      return {
        success: false,
        operation,
        error: operation.error,
      };
    }
  }

  /**
   * Execute rollback steps
   */
  private async executeRollback(
    operation: RollbackOperation,
    _fromVersion: DeploymentVersion,
    _toVersion: DeploymentVersion
  ): Promise<void> {
    for (const step of operation.steps) {
      step.status = "in_progress";
      step.startedAt = new Date();

      this.emit({
        type: "rollback:step",
        environment: operation.environment,
        operation,
        step,
      });

      try {
        // Simulate step execution
        await this.executeStep(step.name, operation);

        step.status = "success";
        step.completedAt = new Date();
      } catch (error) {
        step.status = "failed";
        step.completedAt = new Date();
        step.error = error instanceof Error ? error.message : String(error);
        throw error;
      }
    }
  }

  /**
   * Execute individual rollback step
   */
  private async executeStep(
    stepName: string,
    _operation: RollbackOperation
  ): Promise<void> {
    // Simulated step execution - in real implementation would perform actual operations
    const stepDurations: Record<string, number> = {
      validate_target_version: 100,
      backup_current_state: 500,
      stop_services: 1000,
      restore_artifacts: 2000,
      restore_config: 200,
      run_migrations_down: 1500,
      start_services: 1000,
      health_check: 500,
      cleanup: 200,
    };

    await new Promise((resolve) =>
      setTimeout(resolve, stepDurations[stepName] || 100)
    );
  }

  /**
   * Trigger auto-rollback
   */
  private async triggerAutoRollback(
    environment: string,
    failedVersionId: string,
    triggerReason: string
  ): Promise<void> {
    const previousVersion = this.getPreviousVersion(environment);
    if (!previousVersion) {
      this.emit({
        type: "rollback:auto_failed",
        environment,
        error: "No previous version available for auto-rollback",
      });
      return;
    }

    const result = await this.rollback(
      environment,
      previousVersion.id,
      { id: "system", name: "Auto-Rollback" },
      triggerReason,
      { skipApproval: true }
    );

    if (result.success) {
      result.operation.autoTriggered = true;
      result.operation.triggerReason = triggerReason;
    }
  }

  /**
   * Create a failed operation record
   */
  private createFailedOperation(
    environment: string,
    fromVersion: string,
    toVersion: string,
    initiatedBy: { id: string; name: string },
    reason: string,
    error: string
  ): RollbackOperation {
    return {
      id: `rollback-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fromVersion,
      toVersion,
      environment,
      status: "failed",
      initiatedBy,
      reason,
      startedAt: new Date(),
      completedAt: new Date(),
      duration: 0,
      steps: [],
      error,
      autoTriggered: false,
    };
  }

  /**
   * Cancel a pending rollback
   */
  cancelRollback(environment: string, rollbackId: string): boolean {
    const rollbacks = this.rollbacks.get(environment) || [];
    const operation = rollbacks.find((r) => r.id === rollbackId);

    if (!operation || operation.status !== "pending") {
      return false;
    }

    operation.status = "cancelled";
    operation.completedAt = new Date();

    this.emit({
      type: "rollback:cancelled",
      environment,
      operation,
    });

    return true;
  }

  /**
   * Get rollback history
   */
  getRollbackHistory(
    environment: string,
    limit?: number
  ): RollbackOperation[] {
    const rollbacks = this.rollbacks.get(environment) || [];
    return limit ? rollbacks.slice(0, limit) : rollbacks;
  }

  // ---------------------------------------------------------------------------
  // Policy Management
  // ---------------------------------------------------------------------------

  /**
   * Get rollback policy for environment
   */
  getPolicy(environment: string): RollbackPolicy {
    return this.policies.get(environment) || { ...DEFAULT_ROLLBACK_POLICY };
  }

  /**
   * Set rollback policy for environment
   */
  setPolicy(environment: string, policy: Partial<RollbackPolicy>): RollbackPolicy {
    const current = this.getPolicy(environment);
    const updated = { ...current, ...policy };
    this.policies.set(environment, updated);
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to rollback events
   */
  on(callback: (event: RollbackEvent) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit rollback event
   */
  private emit(event: RollbackEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("Rollback event listener error:", error);
      }
    }
  }
}

// =============================================================================
// Event Types
// =============================================================================

export type RollbackEvent =
  | { type: "deployment:recorded"; environment: string; version: DeploymentVersion }
  | { type: "rollback:started"; environment: string; operation: RollbackOperation }
  | { type: "rollback:step"; environment: string; operation: RollbackOperation; step: RollbackStep }
  | { type: "rollback:completed"; environment: string; operation: RollbackOperation }
  | { type: "rollback:failed"; environment: string; operation: RollbackOperation; error: string }
  | { type: "rollback:cancelled"; environment: string; operation: RollbackOperation }
  | { type: "rollback:notify"; environment: string; operation: RollbackOperation }
  | { type: "rollback:auto_failed"; environment: string; error: string };

// =============================================================================
// Singleton
// =============================================================================

let rollbackManager: RollbackManager | null = null;

/**
 * Get the singleton RollbackManager instance
 */
export function getRollbackManager(): RollbackManager {
  if (!rollbackManager) {
    rollbackManager = new RollbackManager();
  }
  return rollbackManager;
}

/**
 * Create a new RollbackManager instance
 */
export function createRollbackManager(): RollbackManager {
  return new RollbackManager();
}

// =============================================================================
// Export
// =============================================================================

export default RollbackManager;
