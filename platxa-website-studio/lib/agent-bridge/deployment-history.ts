/**
 * Deployment History Tracking
 *
 * Tracks past deployments with timestamps, versions, and status
 * to provide visibility into deployment activity and rollback options.
 */

// ============================================================================
// Types
// ============================================================================

export type DeploymentStatus =
  | 'pending'
  | 'in_progress'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'rolled_back';

export type DeploymentEnvironment = 'development' | 'staging' | 'production' | 'preview';

export interface Deployment {
  readonly id: string;
  readonly version: string;
  readonly environment: DeploymentEnvironment;
  readonly status: DeploymentStatus;
  readonly startedAt: number;
  readonly completedAt: number | null;
  readonly duration: number | null;
  readonly initiatedBy: string;
  readonly commitHash: string | null;
  readonly branch: string | null;
  readonly url: string | null;
  readonly notes: string | null;
  readonly metadata: Record<string, unknown>;
  readonly creationOrder: number;
}

export interface DeploymentEvent {
  readonly id: string;
  readonly deploymentId: string;
  readonly type: DeploymentEventType;
  readonly timestamp: number;
  readonly message: string;
  readonly details: Record<string, unknown>;
}

export type DeploymentEventType =
  | 'started'
  | 'building'
  | 'deploying'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'rolled_back';

export interface DeploymentHistoryState {
  readonly deployments: Map<string, Deployment>;
  readonly events: Map<string, DeploymentEvent[]>;
  readonly maxDeployments: number;
  readonly creationCounter: number;
}

export interface DeploymentQuery {
  readonly environment?: DeploymentEnvironment;
  readonly status?: DeploymentStatus;
  readonly fromTimestamp?: number;
  readonly toTimestamp?: number;
  readonly initiatedBy?: string;
  readonly branch?: string;
  readonly limit?: number;
}

export interface DeploymentStats {
  readonly totalDeployments: number;
  readonly successCount: number;
  readonly failedCount: number;
  readonly successRate: number;
  readonly averageDuration: number;
  readonly deploymentsToday: number;
  readonly lastDeployment: Deployment | null;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_DEPLOYMENTS = 100;

// ============================================================================
// State
// ============================================================================

let state: DeploymentHistoryState = {
  deployments: new Map(),
  events: new Map(),
  maxDeployments: DEFAULT_MAX_DEPLOYMENTS,
  creationCounter: 0,
};

// ============================================================================
// Core Functions
// ============================================================================

export function createDeployment(
  version: string,
  environment: DeploymentEnvironment,
  initiatedBy: string,
  options: {
    commitHash?: string;
    branch?: string;
    notes?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Deployment {
  const id = generateId();
  const now = Date.now();

  const deployment: Deployment = {
    id,
    version,
    environment,
    status: 'pending',
    startedAt: now,
    completedAt: null,
    duration: null,
    initiatedBy,
    commitHash: options.commitHash ?? null,
    branch: options.branch ?? null,
    url: null,
    notes: options.notes ?? null,
    metadata: options.metadata ?? {},
    creationOrder: state.creationCounter,
  };

  const newDeployments = new Map(state.deployments);
  newDeployments.set(id, deployment);

  const newEvents = new Map(state.events);
  newEvents.set(id, []);

  state = {
    ...state,
    deployments: newDeployments,
    events: newEvents,
    creationCounter: state.creationCounter + 1,
  };

  addEvent(id, 'started', 'Deployment initiated');
  enforceMaxDeployments();

  return deployment;
}

export function getDeployment(id: string): Deployment | null {
  return state.deployments.get(id) ?? null;
}

export function getAllDeployments(): readonly Deployment[] {
  return Array.from(state.deployments.values())
    .sort((a, b) => {
      if (a.startedAt !== b.startedAt) {
        return b.startedAt - a.startedAt;
      }
      return b.creationOrder - a.creationOrder;
    });
}

export function getDeploymentCount(): number {
  return state.deployments.size;
}

// ============================================================================
// Status Updates
// ============================================================================

export function startDeployment(id: string): Deployment | null {
  const deployment = state.deployments.get(id);
  if (!deployment || deployment.status !== 'pending') {
    return null;
  }

  const updated: Deployment = {
    ...deployment,
    status: 'in_progress',
  };

  const newDeployments = new Map(state.deployments);
  newDeployments.set(id, updated);

  state = {
    ...state,
    deployments: newDeployments,
  };

  addEvent(id, 'building', 'Build started');

  return updated;
}

export function completeDeployment(
  id: string,
  success: boolean,
  url?: string
): Deployment | null {
  const deployment = state.deployments.get(id);
  if (!deployment) {
    return null;
  }

  const now = Date.now();
  const updated: Deployment = {
    ...deployment,
    status: success ? 'succeeded' : 'failed',
    completedAt: now,
    duration: now - deployment.startedAt,
    url: url ?? deployment.url,
  };

  const newDeployments = new Map(state.deployments);
  newDeployments.set(id, updated);

  state = {
    ...state,
    deployments: newDeployments,
  };

  addEvent(
    id,
    success ? 'completed' : 'failed',
    success ? 'Deployment completed successfully' : 'Deployment failed'
  );

  return updated;
}

export function cancelDeployment(id: string, reason?: string): Deployment | null {
  const deployment = state.deployments.get(id);
  if (!deployment || (deployment.status !== 'pending' && deployment.status !== 'in_progress')) {
    return null;
  }

  const now = Date.now();
  const updated: Deployment = {
    ...deployment,
    status: 'cancelled',
    completedAt: now,
    duration: now - deployment.startedAt,
  };

  const newDeployments = new Map(state.deployments);
  newDeployments.set(id, updated);

  state = {
    ...state,
    deployments: newDeployments,
  };

  addEvent(id, 'cancelled', reason ?? 'Deployment cancelled');

  return updated;
}

export function rollbackDeployment(id: string, reason?: string): Deployment | null {
  const deployment = state.deployments.get(id);
  if (!deployment || deployment.status !== 'succeeded') {
    return null;
  }

  const now = Date.now();
  const updated: Deployment = {
    ...deployment,
    status: 'rolled_back',
    completedAt: now,
  };

  const newDeployments = new Map(state.deployments);
  newDeployments.set(id, updated);

  state = {
    ...state,
    deployments: newDeployments,
  };

  addEvent(id, 'rolled_back', reason ?? 'Deployment rolled back');

  return updated;
}

export function updateDeploymentUrl(id: string, url: string): Deployment | null {
  const deployment = state.deployments.get(id);
  if (!deployment) {
    return null;
  }

  const updated: Deployment = {
    ...deployment,
    url,
  };

  const newDeployments = new Map(state.deployments);
  newDeployments.set(id, updated);

  state = {
    ...state,
    deployments: newDeployments,
  };

  return updated;
}

// ============================================================================
// Events
// ============================================================================

function addEvent(
  deploymentId: string,
  type: DeploymentEventType,
  message: string,
  details: Record<string, unknown> = {}
): DeploymentEvent {
  const event: DeploymentEvent = {
    id: generateId(),
    deploymentId,
    type,
    timestamp: Date.now(),
    message,
    details,
  };

  const events = state.events.get(deploymentId) ?? [];
  const newEvents = new Map(state.events);
  newEvents.set(deploymentId, [...events, event]);

  state = {
    ...state,
    events: newEvents,
  };

  return event;
}

export function logDeploymentEvent(
  deploymentId: string,
  type: DeploymentEventType,
  message: string,
  details?: Record<string, unknown>
): DeploymentEvent | null {
  if (!state.deployments.has(deploymentId)) {
    return null;
  }

  return addEvent(deploymentId, type, message, details ?? {});
}

export function getDeploymentEvents(deploymentId: string): readonly DeploymentEvent[] {
  return state.events.get(deploymentId) ?? [];
}

export function getLatestEvent(deploymentId: string): DeploymentEvent | null {
  const events = state.events.get(deploymentId);
  if (!events || events.length === 0) {
    return null;
  }
  return events[events.length - 1];
}

// ============================================================================
// Query Functions
// ============================================================================

export function queryDeployments(query: DeploymentQuery): readonly Deployment[] {
  let results = getAllDeployments();

  if (query.environment !== undefined) {
    results = results.filter(d => d.environment === query.environment);
  }

  if (query.status !== undefined) {
    results = results.filter(d => d.status === query.status);
  }

  if (query.fromTimestamp !== undefined) {
    results = results.filter(d => d.startedAt >= query.fromTimestamp!);
  }

  if (query.toTimestamp !== undefined) {
    results = results.filter(d => d.startedAt <= query.toTimestamp!);
  }

  if (query.initiatedBy !== undefined) {
    results = results.filter(d => d.initiatedBy === query.initiatedBy);
  }

  if (query.branch !== undefined) {
    results = results.filter(d => d.branch === query.branch);
  }

  if (query.limit !== undefined) {
    results = results.slice(0, query.limit);
  }

  return results;
}

export function getDeploymentsByEnvironment(
  environment: DeploymentEnvironment
): readonly Deployment[] {
  return queryDeployments({ environment });
}

export function getDeploymentsByStatus(status: DeploymentStatus): readonly Deployment[] {
  return queryDeployments({ status });
}

export function getRecentDeployments(limit: number = 10): readonly Deployment[] {
  return queryDeployments({ limit });
}

export function getActiveDeployments(): readonly Deployment[] {
  return getAllDeployments().filter(
    d => d.status === 'pending' || d.status === 'in_progress'
  );
}

export function getSuccessfulDeployments(): readonly Deployment[] {
  return queryDeployments({ status: 'succeeded' });
}

export function getFailedDeployments(): readonly Deployment[] {
  return queryDeployments({ status: 'failed' });
}

// ============================================================================
// Latest Deployments
// ============================================================================

export function getLatestDeployment(): Deployment | null {
  const all = getAllDeployments();
  return all.length > 0 ? all[0] : null;
}

export function getLatestSuccessfulDeployment(
  environment?: DeploymentEnvironment
): Deployment | null {
  let deployments = getSuccessfulDeployments();
  if (environment) {
    deployments = deployments.filter(d => d.environment === environment);
  }
  return deployments.length > 0 ? deployments[0] : null;
}

export function getLatestDeploymentByEnvironment(
  environment: DeploymentEnvironment
): Deployment | null {
  const deployments = getDeploymentsByEnvironment(environment);
  return deployments.length > 0 ? deployments[0] : null;
}

// ============================================================================
// Statistics
// ============================================================================

export function getStats(): DeploymentStats {
  const all = getAllDeployments();
  const succeeded = all.filter(d => d.status === 'succeeded');
  const failed = all.filter(d => d.status === 'failed');

  const totalWithOutcome = succeeded.length + failed.length;
  const successRate = totalWithOutcome > 0 ? succeeded.length / totalWithOutcome : 0;

  const durations = all
    .filter(d => d.duration !== null)
    .map(d => d.duration!);
  const averageDuration = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();
  const deploymentsToday = all.filter(d => d.startedAt >= todayStart).length;

  return {
    totalDeployments: all.length,
    successCount: succeeded.length,
    failedCount: failed.length,
    successRate,
    averageDuration,
    deploymentsToday,
    lastDeployment: all.length > 0 ? all[0] : null,
  };
}

export function getStatsByEnvironment(
  environment: DeploymentEnvironment
): DeploymentStats {
  const all = getDeploymentsByEnvironment(environment);
  const succeeded = all.filter(d => d.status === 'succeeded');
  const failed = all.filter(d => d.status === 'failed');

  const totalWithOutcome = succeeded.length + failed.length;
  const successRate = totalWithOutcome > 0 ? succeeded.length / totalWithOutcome : 0;

  const durations = all
    .filter(d => d.duration !== null)
    .map(d => d.duration!);
  const averageDuration = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();
  const deploymentsToday = all.filter(d => d.startedAt >= todayStart).length;

  return {
    totalDeployments: all.length,
    successCount: succeeded.length,
    failedCount: failed.length,
    successRate,
    averageDuration,
    deploymentsToday,
    lastDeployment: all.length > 0 ? all[0] : null,
  };
}

// ============================================================================
// Retention
// ============================================================================

export function setMaxDeployments(max: number): void {
  state = {
    ...state,
    maxDeployments: Math.max(1, max),
  };
  enforceMaxDeployments();
}

export function getMaxDeployments(): number {
  return state.maxDeployments;
}

function enforceMaxDeployments(): void {
  if (state.deployments.size <= state.maxDeployments) {
    return;
  }

  const sorted = getAllDeployments();
  const toKeep = sorted.slice(0, state.maxDeployments);
  const toKeepIds = new Set(toKeep.map(d => d.id));

  const newDeployments = new Map<string, Deployment>();
  const newEvents = new Map<string, DeploymentEvent[]>();

  for (const deployment of toKeep) {
    newDeployments.set(deployment.id, deployment);
    const events = state.events.get(deployment.id);
    if (events) {
      newEvents.set(deployment.id, events);
    }
  }

  state = {
    ...state,
    deployments: newDeployments,
    events: newEvents,
  };
}

// ============================================================================
// Metadata
// ============================================================================

export function updateMetadata(
  id: string,
  metadata: Record<string, unknown>
): Deployment | null {
  const deployment = state.deployments.get(id);
  if (!deployment) {
    return null;
  }

  const updated: Deployment = {
    ...deployment,
    metadata: {
      ...deployment.metadata,
      ...metadata,
    },
  };

  const newDeployments = new Map(state.deployments);
  newDeployments.set(id, updated);

  state = {
    ...state,
    deployments: newDeployments,
  };

  return updated;
}

export function updateNotes(id: string, notes: string): Deployment | null {
  const deployment = state.deployments.get(id);
  if (!deployment) {
    return null;
  }

  const updated: Deployment = {
    ...deployment,
    notes,
  };

  const newDeployments = new Map(state.deployments);
  newDeployments.set(id, updated);

  state = {
    ...state,
    deployments: newDeployments,
  };

  return updated;
}

// ============================================================================
// Export and Display
// ============================================================================

export interface DeploymentHistoryDisplay {
  readonly deployments: readonly Deployment[];
  readonly stats: DeploymentStats;
  readonly activeCount: number;
}

export function getDisplayData(): DeploymentHistoryDisplay {
  return {
    deployments: getRecentDeployments(20),
    stats: getStats(),
    activeCount: getActiveDeployments().length,
  };
}

export function exportHistory(): string {
  const data = {
    exportedAt: Date.now(),
    deployments: getAllDeployments(),
    events: Object.fromEntries(state.events),
    stats: getStats(),
  };
  return JSON.stringify(data, null, 2);
}

export function getState(): DeploymentHistoryState {
  return {
    ...state,
    deployments: new Map(state.deployments),
    events: new Map(state.events),
  };
}

// ============================================================================
// Remove and Clear
// ============================================================================

export function removeDeployment(id: string): boolean {
  if (!state.deployments.has(id)) {
    return false;
  }

  const newDeployments = new Map(state.deployments);
  newDeployments.delete(id);

  const newEvents = new Map(state.events);
  newEvents.delete(id);

  state = {
    ...state,
    deployments: newDeployments,
    events: newEvents,
  };

  return true;
}

export function clearHistory(): void {
  state = {
    deployments: new Map(),
    events: new Map(),
    maxDeployments: state.maxDeployments,
    creationCounter: 0,
  };
}

// ============================================================================
// Reset
// ============================================================================

export function resetDeploymentHistory(): void {
  state = {
    deployments: new Map(),
    events: new Map(),
    maxDeployments: DEFAULT_MAX_DEPLOYMENTS,
    creationCounter: 0,
  };
}

// ============================================================================
// Utilities
// ============================================================================

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function isDeploymentActive(deployment: Deployment): boolean {
  return deployment.status === 'pending' || deployment.status === 'in_progress';
}

export function isDeploymentComplete(deployment: Deployment): boolean {
  return (
    deployment.status === 'succeeded' ||
    deployment.status === 'failed' ||
    deployment.status === 'cancelled' ||
    deployment.status === 'rolled_back'
  );
}

export function getDeploymentDuration(deployment: Deployment): number {
  if (deployment.duration !== null) {
    return deployment.duration;
  }
  if (deployment.completedAt !== null) {
    return deployment.completedAt - deployment.startedAt;
  }
  return Date.now() - deployment.startedAt;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${Math.round(ms / 1000)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}
