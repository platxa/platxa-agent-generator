/**
 * Error History Tracking for Debugging Patterns
 *
 * Tracks past errors with timestamps and fix status to help identify
 * recurring patterns and improve self-correction capabilities.
 */

// ============================================================================
// Types
// ============================================================================

export interface ErrorEntry {
  readonly id: string;
  readonly errorType: string;
  readonly errorMessage: string;
  readonly errorCode: string | null;
  readonly context: ErrorContext;
  readonly timestamp: number;
  readonly fixStatus: FixStatus;
  readonly fixAttempts: readonly FixAttempt[];
  readonly resolvedAt: number | null;
  readonly tags: readonly string[];
  readonly creationOrder: number;
}

export type FixStatus = 'pending' | 'in_progress' | 'fixed' | 'failed' | 'ignored';

export interface FixAttempt {
  readonly id: string;
  readonly description: string;
  readonly timestamp: number;
  readonly success: boolean;
  readonly duration: number;
}

export interface ErrorContext {
  readonly file: string | null;
  readonly line: number | null;
  readonly column: number | null;
  readonly component: string | null;
  readonly operation: string | null;
  readonly stackTrace: string | null;
}

export interface ErrorPattern {
  readonly patternId: string;
  readonly errorType: string;
  readonly occurrenceCount: number;
  readonly firstSeen: number;
  readonly lastSeen: number;
  readonly fixSuccessRate: number;
  readonly commonContexts: readonly string[];
}

export interface ErrorHistoryState {
  readonly entries: Map<string, ErrorEntry>;
  readonly patterns: Map<string, ErrorPattern>;
  readonly maxEntries: number;
  readonly retentionMs: number;
  readonly creationCounter: number;
}

export interface HistoryQuery {
  readonly errorType?: string;
  readonly fixStatus?: FixStatus;
  readonly fromTimestamp?: number;
  readonly toTimestamp?: number;
  readonly tags?: readonly string[];
  readonly limit?: number;
}

export interface HistoryStats {
  readonly totalErrors: number;
  readonly fixedCount: number;
  readonly pendingCount: number;
  readonly failedCount: number;
  readonly fixRate: number;
  readonly averageFixTime: number;
  readonly mostCommonType: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_ENTRIES = 500;
const DEFAULT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ============================================================================
// State
// ============================================================================

let state: ErrorHistoryState = {
  entries: new Map(),
  patterns: new Map(),
  maxEntries: DEFAULT_MAX_ENTRIES,
  retentionMs: DEFAULT_RETENTION_MS,
  creationCounter: 0,
};

// ============================================================================
// Core Functions
// ============================================================================

export function addError(
  errorType: string,
  errorMessage: string,
  context: Partial<ErrorContext> = {},
  options: { errorCode?: string; tags?: readonly string[] } = {}
): ErrorEntry {
  const id = generateId();
  const now = Date.now();

  const entry: ErrorEntry = {
    id,
    errorType,
    errorMessage,
    errorCode: options.errorCode ?? null,
    context: {
      file: context.file ?? null,
      line: context.line ?? null,
      column: context.column ?? null,
      component: context.component ?? null,
      operation: context.operation ?? null,
      stackTrace: context.stackTrace ?? null,
    },
    timestamp: now,
    fixStatus: 'pending',
    fixAttempts: [],
    resolvedAt: null,
    tags: options.tags ?? [],
    creationOrder: state.creationCounter,
  };

  const newEntries = new Map(state.entries);
  newEntries.set(id, entry);

  state = {
    ...state,
    entries: newEntries,
    creationCounter: state.creationCounter + 1,
  };

  updatePattern(entry);
  enforceMaxEntries();

  return entry;
}

export function getError(id: string): ErrorEntry | null {
  return state.entries.get(id) ?? null;
}

export function getAllErrors(): readonly ErrorEntry[] {
  return Array.from(state.entries.values())
    .sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return b.timestamp - a.timestamp;
      }
      return b.creationOrder - a.creationOrder;
    });
}

export function getErrorCount(): number {
  return state.entries.size;
}

// ============================================================================
// Fix Status Management
// ============================================================================

export function startFix(errorId: string, description: string): FixAttempt | null {
  const entry = state.entries.get(errorId);
  if (!entry) {
    return null;
  }

  const attemptId = generateId();
  const now = Date.now();

  const attempt: FixAttempt = {
    id: attemptId,
    description,
    timestamp: now,
    success: false,
    duration: 0,
  };

  const updated: ErrorEntry = {
    ...entry,
    fixStatus: 'in_progress',
    fixAttempts: [...entry.fixAttempts, attempt],
  };

  const newEntries = new Map(state.entries);
  newEntries.set(errorId, updated);

  state = {
    ...state,
    entries: newEntries,
  };

  return attempt;
}

export function completeFix(errorId: string, success: boolean): ErrorEntry | null {
  const entry = state.entries.get(errorId);
  if (!entry || entry.fixAttempts.length === 0) {
    return null;
  }

  const now = Date.now();
  const lastAttempt = entry.fixAttempts[entry.fixAttempts.length - 1];

  const updatedAttempt: FixAttempt = {
    ...lastAttempt,
    success,
    duration: now - lastAttempt.timestamp,
  };

  const updatedAttempts = [
    ...entry.fixAttempts.slice(0, -1),
    updatedAttempt,
  ];

  const updated: ErrorEntry = {
    ...entry,
    fixStatus: success ? 'fixed' : 'failed',
    fixAttempts: updatedAttempts,
    resolvedAt: success ? now : null,
  };

  const newEntries = new Map(state.entries);
  newEntries.set(errorId, updated);

  state = {
    ...state,
    entries: newEntries,
  };

  updatePatternFixRate(entry.errorType);

  return updated;
}

export function markIgnored(errorId: string): ErrorEntry | null {
  const entry = state.entries.get(errorId);
  if (!entry) {
    return null;
  }

  const updated: ErrorEntry = {
    ...entry,
    fixStatus: 'ignored',
    resolvedAt: Date.now(),
  };

  const newEntries = new Map(state.entries);
  newEntries.set(errorId, updated);

  state = {
    ...state,
    entries: newEntries,
  };

  return updated;
}

export function getFixStatus(errorId: string): FixStatus | null {
  const entry = state.entries.get(errorId);
  return entry?.fixStatus ?? null;
}

// ============================================================================
// Query Functions
// ============================================================================

export function queryErrors(query: HistoryQuery): readonly ErrorEntry[] {
  let results = getAllErrors();

  if (query.errorType !== undefined) {
    results = results.filter(e => e.errorType === query.errorType);
  }

  if (query.fixStatus !== undefined) {
    results = results.filter(e => e.fixStatus === query.fixStatus);
  }

  if (query.fromTimestamp !== undefined) {
    results = results.filter(e => e.timestamp >= query.fromTimestamp!);
  }

  if (query.toTimestamp !== undefined) {
    results = results.filter(e => e.timestamp <= query.toTimestamp!);
  }

  if (query.tags !== undefined && query.tags.length > 0) {
    results = results.filter(e =>
      query.tags!.some(tag => e.tags.includes(tag))
    );
  }

  if (query.limit !== undefined) {
    results = results.slice(0, query.limit);
  }

  return results;
}

export function getErrorsByType(errorType: string): readonly ErrorEntry[] {
  return queryErrors({ errorType });
}

export function getErrorsByStatus(status: FixStatus): readonly ErrorEntry[] {
  return queryErrors({ fixStatus: status });
}

export function getPendingErrors(): readonly ErrorEntry[] {
  return queryErrors({ fixStatus: 'pending' });
}

export function getRecentErrors(limit: number = 10): readonly ErrorEntry[] {
  return queryErrors({ limit });
}

// ============================================================================
// Pattern Analysis
// ============================================================================

function updatePattern(entry: ErrorEntry): void {
  const existing = state.patterns.get(entry.errorType);

  if (existing) {
    const updated: ErrorPattern = {
      ...existing,
      occurrenceCount: existing.occurrenceCount + 1,
      lastSeen: entry.timestamp,
      commonContexts: updateCommonContexts(existing.commonContexts, entry.context),
    };

    const newPatterns = new Map(state.patterns);
    newPatterns.set(entry.errorType, updated);

    state = {
      ...state,
      patterns: newPatterns,
    };
  } else {
    const pattern: ErrorPattern = {
      patternId: generateId(),
      errorType: entry.errorType,
      occurrenceCount: 1,
      firstSeen: entry.timestamp,
      lastSeen: entry.timestamp,
      fixSuccessRate: 0,
      commonContexts: extractContexts(entry.context),
    };

    const newPatterns = new Map(state.patterns);
    newPatterns.set(entry.errorType, pattern);

    state = {
      ...state,
      patterns: newPatterns,
    };
  }
}

function updateCommonContexts(
  existing: readonly string[],
  context: ErrorContext
): readonly string[] {
  const newContexts = extractContexts(context);
  const combined = new Set([...existing, ...newContexts]);
  return Array.from(combined).slice(0, 10); // Keep top 10
}

function extractContexts(context: ErrorContext): readonly string[] {
  const contexts: string[] = [];
  if (context.file) contexts.push(`file:${context.file}`);
  if (context.component) contexts.push(`component:${context.component}`);
  if (context.operation) contexts.push(`operation:${context.operation}`);
  return contexts;
}

function updatePatternFixRate(errorType: string): void {
  const pattern = state.patterns.get(errorType);
  if (!pattern) return;

  const errors = getErrorsByType(errorType);
  const fixed = errors.filter(e => e.fixStatus === 'fixed').length;
  const resolved = errors.filter(e =>
    e.fixStatus === 'fixed' || e.fixStatus === 'failed'
  ).length;

  const fixSuccessRate = resolved > 0 ? fixed / resolved : 0;

  const updated: ErrorPattern = {
    ...pattern,
    fixSuccessRate,
  };

  const newPatterns = new Map(state.patterns);
  newPatterns.set(errorType, updated);

  state = {
    ...state,
    patterns: newPatterns,
  };
}

export function getPattern(errorType: string): ErrorPattern | null {
  return state.patterns.get(errorType) ?? null;
}

export function getAllPatterns(): readonly ErrorPattern[] {
  return Array.from(state.patterns.values())
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount);
}

export function getFrequentPatterns(minOccurrences: number = 3): readonly ErrorPattern[] {
  return getAllPatterns().filter(p => p.occurrenceCount >= minOccurrences);
}

// ============================================================================
// Statistics
// ============================================================================

export function getStats(): HistoryStats {
  const all = getAllErrors();
  const fixed = all.filter(e => e.fixStatus === 'fixed');
  const pending = all.filter(e => e.fixStatus === 'pending');
  const failed = all.filter(e => e.fixStatus === 'failed');

  const totalWithOutcome = fixed.length + failed.length;
  const fixRate = totalWithOutcome > 0 ? fixed.length / totalWithOutcome : 0;

  const fixTimes = fixed
    .filter(e => e.resolvedAt !== null)
    .map(e => e.resolvedAt! - e.timestamp);
  const averageFixTime = fixTimes.length > 0
    ? fixTimes.reduce((a, b) => a + b, 0) / fixTimes.length
    : 0;

  const patterns = getAllPatterns();
  const mostCommonType = patterns.length > 0 ? patterns[0].errorType : null;

  return {
    totalErrors: all.length,
    fixedCount: fixed.length,
    pendingCount: pending.length,
    failedCount: failed.length,
    fixRate,
    averageFixTime,
    mostCommonType,
  };
}

// ============================================================================
// Retention and Cleanup
// ============================================================================

export function setMaxEntries(max: number): void {
  state = {
    ...state,
    maxEntries: Math.max(1, max),
  };
  enforceMaxEntries();
}

export function getMaxEntries(): number {
  return state.maxEntries;
}

export function setRetention(ms: number): void {
  state = {
    ...state,
    retentionMs: Math.max(0, ms),
  };
}

export function getRetention(): number {
  return state.retentionMs;
}

function enforceMaxEntries(): void {
  if (state.entries.size <= state.maxEntries) {
    return;
  }

  const sorted = getAllErrors();
  const toKeep = sorted.slice(0, state.maxEntries);
  const toKeepIds = new Set(toKeep.map(e => e.id));

  const newEntries = new Map<string, ErrorEntry>();
  for (const entry of toKeep) {
    newEntries.set(entry.id, entry);
  }

  state = {
    ...state,
    entries: newEntries,
  };
}

export function cleanupOldErrors(): number {
  const now = Date.now();
  const cutoff = now - state.retentionMs;
  let cleaned = 0;

  const newEntries = new Map<string, ErrorEntry>();

  for (const [id, entry] of state.entries) {
    // When retentionMs is 0, clean all entries (no retention)
    // Otherwise keep entries within retention period
    if (state.retentionMs > 0 && entry.timestamp >= cutoff) {
      newEntries.set(id, entry);
    } else {
      cleaned++;
    }
  }

  state = {
    ...state,
    entries: newEntries,
  };

  return cleaned;
}

// ============================================================================
// Tags
// ============================================================================

export function addTag(errorId: string, tag: string): ErrorEntry | null {
  const entry = state.entries.get(errorId);
  if (!entry) {
    return null;
  }

  if (entry.tags.includes(tag)) {
    return entry;
  }

  const updated: ErrorEntry = {
    ...entry,
    tags: [...entry.tags, tag],
  };

  const newEntries = new Map(state.entries);
  newEntries.set(errorId, updated);

  state = {
    ...state,
    entries: newEntries,
  };

  return updated;
}

export function removeTag(errorId: string, tag: string): ErrorEntry | null {
  const entry = state.entries.get(errorId);
  if (!entry) {
    return null;
  }

  const updated: ErrorEntry = {
    ...entry,
    tags: entry.tags.filter(t => t !== tag),
  };

  const newEntries = new Map(state.entries);
  newEntries.set(errorId, updated);

  state = {
    ...state,
    entries: newEntries,
  };

  return updated;
}

export function getErrorsByTag(tag: string): readonly ErrorEntry[] {
  return queryErrors({ tags: [tag] });
}

// ============================================================================
// Export and Display
// ============================================================================

export interface ErrorHistoryDisplay {
  readonly errors: readonly ErrorEntry[];
  readonly stats: HistoryStats;
  readonly patterns: readonly ErrorPattern[];
}

export function getDisplayData(): ErrorHistoryDisplay {
  return {
    errors: getRecentErrors(20),
    stats: getStats(),
    patterns: getFrequentPatterns(),
  };
}

export function exportHistory(): string {
  const data = {
    exportedAt: Date.now(),
    entries: getAllErrors(),
    patterns: getAllPatterns(),
    stats: getStats(),
  };
  return JSON.stringify(data, null, 2);
}

export function getState(): ErrorHistoryState {
  return {
    ...state,
    entries: new Map(state.entries),
    patterns: new Map(state.patterns),
  };
}

// ============================================================================
// Remove and Clear
// ============================================================================

export function removeError(id: string): boolean {
  if (!state.entries.has(id)) {
    return false;
  }

  const newEntries = new Map(state.entries);
  newEntries.delete(id);

  state = {
    ...state,
    entries: newEntries,
  };

  return true;
}

export function clearHistory(): void {
  state = {
    entries: new Map(),
    patterns: new Map(),
    maxEntries: state.maxEntries,
    retentionMs: state.retentionMs,
    creationCounter: 0,
  };
}

// ============================================================================
// Reset
// ============================================================================

export function resetErrorHistory(): void {
  state = {
    entries: new Map(),
    patterns: new Map(),
    maxEntries: DEFAULT_MAX_ENTRIES,
    retentionMs: DEFAULT_RETENTION_MS,
    creationCounter: 0,
  };
}

// ============================================================================
// Utilities
// ============================================================================

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
