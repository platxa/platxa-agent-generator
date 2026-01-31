/**
 * Version Pruning for Storage Management
 *
 * Auto-deletes versions beyond configurable limit (default 20).
 * Starred versions are exempt from pruning.
 */

// ============================================================================
// Types
// ============================================================================

export interface PrunableVersion {
  readonly id: string;
  readonly createdAt: number;
  readonly creationOrder: number;
  readonly isStarred: boolean;
}

export interface PruningConfig {
  readonly maxVersions: number;
  readonly exemptStarred: boolean;
  readonly pruneOnCreate: boolean;
  readonly minRetentionMs: number; // Minimum age before eligible for pruning
}

export interface PruningState {
  readonly config: PruningConfig;
  readonly versions: Map<string, PrunableVersion>;
  readonly lastPruneTime: number | null;
  readonly totalPruned: number;
  readonly enabled: boolean;
}

export interface PruneResult {
  readonly pruned: readonly string[];
  readonly retained: readonly string[];
  readonly starredExempt: readonly string[];
  readonly recentExempt: readonly string[];
  readonly prunedCount: number;
  readonly retainedCount: number;
}

export interface PruneEvent {
  readonly prunedIds: readonly string[];
  readonly reason: 'manual' | 'auto' | 'config_change';
  readonly timestamp: number;
  readonly previousCount: number;
  readonly newCount: number;
}

export type PruneHandler = (event: PruneEvent) => void;

export interface PruningSummary {
  readonly totalVersions: number;
  readonly starredVersions: number;
  readonly prunableVersions: number;
  readonly overLimit: boolean;
  readonly excessCount: number;
  readonly nextPruneTarget: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_VERSIONS = 20;
const DEFAULT_MIN_RETENTION_MS = 0; // No minimum retention by default

// ============================================================================
// State
// ============================================================================

let state: PruningState = {
  config: {
    maxVersions: DEFAULT_MAX_VERSIONS,
    exemptStarred: true,
    pruneOnCreate: true,
    minRetentionMs: DEFAULT_MIN_RETENTION_MS,
  },
  versions: new Map(),
  lastPruneTime: null,
  totalPruned: 0,
  enabled: true,
};

let pruneHandlers: PruneHandler[] = [];

// Monotonic counter for stable sorting
let creationOrderCounter = 0;

// ============================================================================
// Configuration
// ============================================================================

export function getConfig(): PruningConfig {
  return state.config;
}

export function setConfig(config: Partial<PruningConfig>): PruningConfig {
  state = {
    ...state,
    config: {
      ...state.config,
      ...config,
    },
  };

  return state.config;
}

export function setMaxVersions(max: number): number {
  const validated = Math.max(1, Math.floor(max));
  state = {
    ...state,
    config: {
      ...state.config,
      maxVersions: validated,
    },
  };

  return validated;
}

export function getMaxVersions(): number {
  return state.config.maxVersions;
}

export function setExemptStarred(exempt: boolean): void {
  state = {
    ...state,
    config: {
      ...state.config,
      exemptStarred: exempt,
    },
  };
}

export function isExemptStarred(): boolean {
  return state.config.exemptStarred;
}

export function setPruneOnCreate(enabled: boolean): void {
  state = {
    ...state,
    config: {
      ...state.config,
      pruneOnCreate: enabled,
    },
  };
}

export function isPruneOnCreate(): boolean {
  return state.config.pruneOnCreate;
}

export function setMinRetention(ms: number): void {
  state = {
    ...state,
    config: {
      ...state.config,
      minRetentionMs: Math.max(0, ms),
    },
  };
}

export function getMinRetention(): number {
  return state.config.minRetentionMs;
}

// ============================================================================
// Enable/Disable
// ============================================================================

export function enable(): void {
  state = {
    ...state,
    enabled: true,
  };
}

export function disable(): void {
  state = {
    ...state,
    enabled: false,
  };
}

export function isEnabled(): boolean {
  return state.enabled;
}

// ============================================================================
// Version Management
// ============================================================================

export function addVersion(id: string, isStarred: boolean = false): PrunableVersion {
  const now = Date.now();
  const version: PrunableVersion = {
    id,
    createdAt: now,
    creationOrder: creationOrderCounter++,
    isStarred,
  };

  const newVersions = new Map(state.versions);
  newVersions.set(id, version);

  state = {
    ...state,
    versions: newVersions,
  };

  // Auto-prune if enabled
  if (state.enabled && state.config.pruneOnCreate) {
    prune('auto');
  }

  return version;
}

export function removeVersion(id: string): boolean {
  if (!state.versions.has(id)) {
    return false;
  }

  const newVersions = new Map(state.versions);
  newVersions.delete(id);

  state = {
    ...state,
    versions: newVersions,
  };

  return true;
}

export function getVersion(id: string): PrunableVersion | null {
  return state.versions.get(id) ?? null;
}

export function getAllVersions(): readonly PrunableVersion[] {
  return Array.from(state.versions.values());
}

export function getVersionCount(): number {
  return state.versions.size;
}

export function setVersionStarred(id: string, starred: boolean): PrunableVersion | null {
  const version = state.versions.get(id);
  if (!version) {
    return null;
  }

  const updated: PrunableVersion = {
    ...version,
    isStarred: starred,
  };

  const newVersions = new Map(state.versions);
  newVersions.set(id, updated);

  state = {
    ...state,
    versions: newVersions,
  };

  return updated;
}

export function toggleVersionStarred(id: string): PrunableVersion | null {
  const version = state.versions.get(id);
  if (!version) {
    return null;
  }

  return setVersionStarred(id, !version.isStarred);
}

// ============================================================================
// Pruning Logic
// ============================================================================

export function prune(reason: 'manual' | 'auto' | 'config_change' = 'manual'): PruneResult {
  const now = Date.now();
  const previousCount = state.versions.size;

  // Get all versions sorted by creation time (oldest first for pruning)
  const allVersions = Array.from(state.versions.values()).sort((a, b) => {
    const timeDiff = a.createdAt - b.createdAt;
    return timeDiff !== 0 ? timeDiff : a.creationOrder - b.creationOrder;
  });

  const pruned: string[] = [];
  const retained: string[] = [];
  const starredExempt: string[] = [];
  const recentExempt: string[] = [];

  // Separate starred versions if exempt
  const starredVersions: PrunableVersion[] = [];
  const nonStarredVersions: PrunableVersion[] = [];

  for (const version of allVersions) {
    if (state.config.exemptStarred && version.isStarred) {
      starredVersions.push(version);
      starredExempt.push(version.id);
    } else {
      nonStarredVersions.push(version);
    }
  }

  // Check minimum retention (skip check when minRetentionMs is 0)
  const minRetentionCutoff = now - state.config.minRetentionMs;
  const eligibleForPrune: PrunableVersion[] = [];
  const tooRecent: PrunableVersion[] = [];

  for (const version of nonStarredVersions) {
    // When minRetentionMs is 0, all versions are eligible (no retention requirement)
    // Otherwise, version must be older than cutoff to be eligible
    if (state.config.minRetentionMs === 0 || version.createdAt < minRetentionCutoff) {
      eligibleForPrune.push(version);
    } else {
      tooRecent.push(version);
      recentExempt.push(version.id);
    }
  }

  // Calculate how many non-starred versions to keep
  // Total retained = starred + non-starred kept
  // We need: starred + nonStarredKept <= maxVersions
  // BUT starred are exempt, so they don't count against limit
  // Actually: we keep up to maxVersions of non-starred, starred are bonus

  // Determine target count for non-starred
  const targetNonStarred = state.config.maxVersions;
  const currentNonStarred = eligibleForPrune.length + tooRecent.length;
  const excessNonStarred = Math.max(0, currentNonStarred - targetNonStarred);

  // Prune oldest eligible versions
  const toPrune = eligibleForPrune.slice(0, excessNonStarred);
  const toRetain = eligibleForPrune.slice(excessNonStarred);

  for (const version of toPrune) {
    pruned.push(version.id);
  }

  for (const version of toRetain) {
    retained.push(version.id);
  }

  for (const version of tooRecent) {
    retained.push(version.id);
  }

  for (const version of starredVersions) {
    retained.push(version.id);
  }

  // Remove pruned versions from state
  if (pruned.length > 0) {
    const newVersions = new Map(state.versions);
    for (const id of pruned) {
      newVersions.delete(id);
    }

    state = {
      ...state,
      versions: newVersions,
      lastPruneTime: now,
      totalPruned: state.totalPruned + pruned.length,
    };

    // Notify handlers
    notifyPrune({
      prunedIds: pruned,
      reason,
      timestamp: now,
      previousCount,
      newCount: state.versions.size,
    });
  }

  return {
    pruned,
    retained,
    starredExempt,
    recentExempt,
    prunedCount: pruned.length,
    retainedCount: retained.length,
  };
}

export function getPruneCandidates(): readonly PrunableVersion[] {
  const now = Date.now();
  const minRetentionCutoff = now - state.config.minRetentionMs;

  // Get non-starred, old enough versions sorted oldest first
  const candidates = Array.from(state.versions.values())
    .filter(v => {
      if (state.config.exemptStarred && v.isStarred) {
        return false;
      }
      // When minRetentionMs is 0, skip retention check (all eligible)
      if (state.config.minRetentionMs > 0 && v.createdAt >= minRetentionCutoff) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const timeDiff = a.createdAt - b.createdAt;
      return timeDiff !== 0 ? timeDiff : a.creationOrder - b.creationOrder;
    });

  // Return only the excess ones
  const nonStarredCount = Array.from(state.versions.values())
    .filter(v => !state.config.exemptStarred || !v.isStarred).length;
  const excess = Math.max(0, nonStarredCount - state.config.maxVersions);

  return candidates.slice(0, excess);
}

export function wouldBePruned(id: string): boolean {
  const candidates = getPruneCandidates();
  return candidates.some(c => c.id === id);
}

export function isExempt(id: string): boolean {
  const version = state.versions.get(id);
  if (!version) {
    return false;
  }

  // Exempt if starred and config says exempt starred
  if (state.config.exemptStarred && version.isStarred) {
    return true;
  }

  // Exempt if too recent (only when minRetentionMs > 0)
  if (state.config.minRetentionMs > 0) {
    const now = Date.now();
    const minRetentionCutoff = now - state.config.minRetentionMs;
    if (version.createdAt >= minRetentionCutoff) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Summary and Statistics
// ============================================================================

export function getSummary(): PruningSummary {
  const allVersions = Array.from(state.versions.values());
  const starredVersions = allVersions.filter(v => v.isStarred);
  const prunableVersions = getPruneCandidates();
  const nonStarredCount = state.config.exemptStarred
    ? allVersions.length - starredVersions.length
    : allVersions.length;
  const excessCount = Math.max(0, nonStarredCount - state.config.maxVersions);
  const nextTarget = prunableVersions.length > 0 ? prunableVersions[0].id : null;

  return {
    totalVersions: allVersions.length,
    starredVersions: starredVersions.length,
    prunableVersions: prunableVersions.length,
    overLimit: excessCount > 0,
    excessCount,
    nextPruneTarget: nextTarget,
  };
}

export function getLastPruneTime(): number | null {
  return state.lastPruneTime;
}

export function getTotalPruned(): number {
  return state.totalPruned;
}

export function getRetentionStatus(): {
  readonly current: number;
  readonly max: number;
  readonly percentage: number;
  readonly remaining: number;
} {
  const nonStarredCount = state.config.exemptStarred
    ? Array.from(state.versions.values()).filter(v => !v.isStarred).length
    : state.versions.size;

  return {
    current: nonStarredCount,
    max: state.config.maxVersions,
    percentage: Math.round((nonStarredCount / state.config.maxVersions) * 100),
    remaining: Math.max(0, state.config.maxVersions - nonStarredCount),
  };
}

// ============================================================================
// Batch Operations
// ============================================================================

export function importVersions(
  versions: readonly { id: string; createdAt: number; isStarred: boolean }[]
): number {
  let imported = 0;
  const newVersions = new Map(state.versions);

  for (const v of versions) {
    if (!newVersions.has(v.id)) {
      newVersions.set(v.id, {
        id: v.id,
        createdAt: v.createdAt,
        creationOrder: creationOrderCounter++,
        isStarred: v.isStarred,
      });
      imported++;
    }
  }

  state = {
    ...state,
    versions: newVersions,
  };

  // Auto-prune if enabled
  if (state.enabled && state.config.pruneOnCreate && imported > 0) {
    prune('auto');
  }

  return imported;
}

export function clearAllVersions(): number {
  const count = state.versions.size;

  state = {
    ...state,
    versions: new Map(),
  };

  return count;
}

// ============================================================================
// Event Handlers
// ============================================================================

export function onPrune(handler: PruneHandler): () => void {
  pruneHandlers.push(handler);

  return () => {
    pruneHandlers = pruneHandlers.filter(h => h !== handler);
  };
}

function notifyPrune(event: PruneEvent): void {
  for (const handler of pruneHandlers) {
    handler(event);
  }
}

// ============================================================================
// State Inspection
// ============================================================================

export function getState(): PruningState {
  return {
    ...state,
    versions: new Map(state.versions),
  };
}

export function needsPruning(): boolean {
  return getPruneCandidates().length > 0;
}

export function getStarredCount(): number {
  return Array.from(state.versions.values()).filter(v => v.isStarred).length;
}

export function getNonStarredCount(): number {
  return Array.from(state.versions.values()).filter(v => !v.isStarred).length;
}

// ============================================================================
// Reset
// ============================================================================

export function resetVersionPruning(): void {
  state = {
    config: {
      maxVersions: DEFAULT_MAX_VERSIONS,
      exemptStarred: true,
      pruneOnCreate: true,
      minRetentionMs: DEFAULT_MIN_RETENTION_MS,
    },
    versions: new Map(),
    lastPruneTime: null,
    totalPruned: 0,
    enabled: true,
  };
  pruneHandlers = [];
  creationOrderCounter = 0;
}
