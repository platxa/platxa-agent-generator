/**
 * Preview Render Caching
 *
 * Caches rendered previews for unchanged pages to improve performance.
 * Automatically invalidates cache entries when content changes.
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Cache entry status.
 */
export type CacheStatus = 'fresh' | 'stale' | 'expired' | 'invalid';

/**
 * A cached preview entry.
 */
export interface CacheEntry {
  /** Unique page identifier */
  pageId: string;
  /** Content hash for change detection */
  contentHash: string;
  /** Rendered HTML preview */
  renderedHtml: string;
  /** Rendered CSS */
  renderedCss: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last access timestamp */
  lastAccessedAt: number;
  /** Access count */
  accessCount: number;
  /** Size in bytes */
  sizeBytes: number;
  /** Time to render in ms */
  renderTimeMs: number;
  /** Dependencies (other pages, components) */
  dependencies: string[];
}

/**
 * Cache lookup result.
 */
export interface CacheLookupResult {
  /** Whether cache hit occurred */
  hit: boolean;
  /** Cache entry if hit */
  entry?: CacheEntry;
  /** Status of the entry */
  status: CacheStatus;
  /** Reason for miss/staleness */
  reason?: string;
}

/**
 * Cache configuration.
 */
export interface CacheConfig {
  /** Maximum cache size in bytes */
  maxSizeBytes: number;
  /** Maximum number of entries */
  maxEntries: number;
  /** Entry TTL in milliseconds */
  ttlMs: number;
  /** Stale-while-revalidate window in ms */
  staleWhileRevalidateMs: number;
  /** Enable LRU eviction */
  enableLruEviction: boolean;
}

/**
 * Default cache configuration.
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxSizeBytes: 50 * 1024 * 1024, // 50MB
  maxEntries: 100,
  ttlMs: 3600000, // 1 hour
  staleWhileRevalidateMs: 300000, // 5 minutes
  enableLruEviction: true,
};

/**
 * Cache state.
 */
export interface CacheState {
  /** Cache entries by page ID */
  entries: Map<string, CacheEntry>;
  /** Content hashes by page ID (for change detection) */
  contentHashes: Map<string, string>;
  /** Dependency graph (page -> dependents) */
  dependencyGraph: Map<string, Set<string>>;
  /** Total cache size in bytes */
  totalSizeBytes: number;
  /** Cache configuration */
  config: CacheConfig;
  /** Cache statistics */
  stats: CacheStats;
}

/**
 * Cache statistics.
 */
export interface CacheStats {
  /** Total hits */
  hits: number;
  /** Total misses */
  misses: number;
  /** Stale hits (served stale) */
  staleHits: number;
  /** Invalidations */
  invalidations: number;
  /** Evictions */
  evictions: number;
  /** Total render time saved (ms) */
  renderTimeSavedMs: number;
}

/**
 * Cache metrics.
 */
export interface CacheMetrics {
  /** Hit rate (0-1) */
  hitRate: number;
  /** Miss rate (0-1) */
  missRate: number;
  /** Total entries */
  totalEntries: number;
  /** Total size bytes */
  totalSizeBytes: number;
  /** Size utilization (0-1) */
  sizeUtilization: number;
  /** Entry utilization (0-1) */
  entryUtilization: number;
  /** Average entry size */
  avgEntrySizeBytes: number;
  /** Average render time saved */
  avgRenderTimeSavedMs: number;
  /** Statistics */
  stats: CacheStats;
}

// =============================================================================
// Hash Functions
// =============================================================================

/**
 * Computes a simple hash of content for change detection.
 */
export function computeContentHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `h_${Math.abs(hash).toString(16)}`;
}

/**
 * Computes hash for multiple content pieces.
 */
export function computeCombinedHash(contents: string[]): string {
  const combined = contents.join('|');
  return computeContentHash(combined);
}

// =============================================================================
// State Management
// =============================================================================

/**
 * Creates initial cache state.
 */
export function createCacheState(
  config: Partial<CacheConfig> = {},
): CacheState {
  return {
    entries: new Map(),
    contentHashes: new Map(),
    dependencyGraph: new Map(),
    totalSizeBytes: 0,
    config: { ...DEFAULT_CACHE_CONFIG, ...config },
    stats: {
      hits: 0,
      misses: 0,
      staleHits: 0,
      invalidations: 0,
      evictions: 0,
      renderTimeSavedMs: 0,
    },
  };
}

/**
 * Gets cache entry status.
 */
export function getEntryStatus(
  entry: CacheEntry,
  contentHash: string,
  config: CacheConfig,
  now: number = Date.now(),
): CacheStatus {
  // Check if content changed
  if (entry.contentHash !== contentHash) {
    return 'invalid';
  }

  const age = now - entry.createdAt;

  // Check if expired
  if (age > config.ttlMs) {
    return 'expired';
  }

  // Check if stale
  if (age > config.ttlMs - config.staleWhileRevalidateMs) {
    return 'stale';
  }

  return 'fresh';
}

// =============================================================================
// Cache Operations
// =============================================================================

/**
 * Looks up a page in the cache.
 */
export function lookupCache(
  state: CacheState,
  pageId: string,
  currentContentHash: string,
  now: number = Date.now(),
): { state: CacheState; result: CacheLookupResult } {
  const entry = state.entries.get(pageId);

  // Cache miss
  if (!entry) {
    const newStats = { ...state.stats, misses: state.stats.misses + 1 };
    return {
      state: { ...state, stats: newStats },
      result: { hit: false, status: 'invalid', reason: 'Entry not found' },
    };
  }

  const status = getEntryStatus(entry, currentContentHash, state.config, now);

  // Content changed - invalidate
  if (status === 'invalid') {
    const newStats = { ...state.stats, misses: state.stats.misses + 1 };
    return {
      state: { ...state, stats: newStats },
      result: { hit: false, status: 'invalid', reason: 'Content changed' },
    };
  }

  // Expired
  if (status === 'expired') {
    const newStats = { ...state.stats, misses: state.stats.misses + 1 };
    return {
      state: { ...state, stats: newStats },
      result: { hit: false, entry, status: 'expired', reason: 'Entry expired' },
    };
  }

  // Update last accessed time
  const updatedEntry: CacheEntry = {
    ...entry,
    lastAccessedAt: now,
    accessCount: entry.accessCount + 1,
  };

  const entries = new Map(state.entries);
  entries.set(pageId, updatedEntry);

  // Stale hit (can be served but should revalidate)
  if (status === 'stale') {
    const newStats = {
      ...state.stats,
      staleHits: state.stats.staleHits + 1,
      renderTimeSavedMs: state.stats.renderTimeSavedMs + entry.renderTimeMs,
    };
    return {
      state: { ...state, entries, stats: newStats },
      result: { hit: true, entry: updatedEntry, status: 'stale' },
    };
  }

  // Fresh hit
  const newStats = {
    ...state.stats,
    hits: state.stats.hits + 1,
    renderTimeSavedMs: state.stats.renderTimeSavedMs + entry.renderTimeMs,
  };

  return {
    state: { ...state, entries, stats: newStats },
    result: { hit: true, entry: updatedEntry, status: 'fresh' },
  };
}

/**
 * Stores a rendered preview in the cache.
 */
export function storeInCache(
  state: CacheState,
  pageId: string,
  contentHash: string,
  renderedHtml: string,
  renderedCss: string,
  renderTimeMs: number,
  dependencies: string[] = [],
  now: number = Date.now(),
): CacheState {
  const sizeBytes = renderedHtml.length + renderedCss.length;

  // Check if we need to evict
  let currentState = state;
  if (state.config.enableLruEviction) {
    currentState = ensureCapacity(currentState, sizeBytes);
  }

  const entry: CacheEntry = {
    pageId,
    contentHash,
    renderedHtml,
    renderedCss,
    createdAt: now,
    lastAccessedAt: now,
    accessCount: 0,
    sizeBytes,
    renderTimeMs,
    dependencies,
  };

  // Remove old entry size if exists
  const oldEntry = currentState.entries.get(pageId);
  const sizeDelta = oldEntry ? sizeBytes - oldEntry.sizeBytes : sizeBytes;

  const entries = new Map(currentState.entries);
  entries.set(pageId, entry);

  // Update content hash
  const contentHashes = new Map(currentState.contentHashes);
  contentHashes.set(pageId, contentHash);

  // Update dependency graph
  const dependencyGraph = new Map(currentState.dependencyGraph);
  for (const dep of dependencies) {
    if (!dependencyGraph.has(dep)) {
      dependencyGraph.set(dep, new Set());
    }
    dependencyGraph.get(dep)!.add(pageId);
  }

  return {
    ...currentState,
    entries,
    contentHashes,
    dependencyGraph,
    totalSizeBytes: currentState.totalSizeBytes + sizeDelta,
  };
}

/**
 * Invalidates a cache entry.
 */
export function invalidateEntry(
  state: CacheState,
  pageId: string,
): CacheState {
  const entry = state.entries.get(pageId);
  if (!entry) return state;

  const entries = new Map(state.entries);
  entries.delete(pageId);

  const contentHashes = new Map(state.contentHashes);
  contentHashes.delete(pageId);

  const newStats = {
    ...state.stats,
    invalidations: state.stats.invalidations + 1,
  };

  return {
    ...state,
    entries,
    contentHashes,
    totalSizeBytes: state.totalSizeBytes - entry.sizeBytes,
    stats: newStats,
  };
}

/**
 * Invalidates entry and all dependents.
 */
export function invalidateWithDependents(
  state: CacheState,
  pageId: string,
): CacheState {
  let currentState = invalidateEntry(state, pageId);

  // Invalidate dependents
  const dependents = state.dependencyGraph.get(pageId);
  if (dependents) {
    for (const dependent of dependents) {
      currentState = invalidateWithDependents(currentState, dependent);
    }
  }

  // Clean up dependency graph
  const dependencyGraph = new Map(currentState.dependencyGraph);
  dependencyGraph.delete(pageId);

  return { ...currentState, dependencyGraph };
}

/**
 * Invalidates all cache entries.
 */
export function invalidateAll(state: CacheState): CacheState {
  const newStats = {
    ...state.stats,
    invalidations: state.stats.invalidations + state.entries.size,
  };

  return {
    ...state,
    entries: new Map(),
    contentHashes: new Map(),
    dependencyGraph: new Map(),
    totalSizeBytes: 0,
    stats: newStats,
  };
}

// =============================================================================
// Change Detection
// =============================================================================

/**
 * Checks if content has changed for a page.
 */
export function hasContentChanged(
  state: CacheState,
  pageId: string,
  newContentHash: string,
): boolean {
  const storedHash = state.contentHashes.get(pageId);
  if (!storedHash) return true;
  return storedHash !== newContentHash;
}

/**
 * Updates content hash and invalidates if changed.
 */
export function updateContentHash(
  state: CacheState,
  pageId: string,
  newContentHash: string,
): { state: CacheState; changed: boolean } {
  const changed = hasContentChanged(state, pageId, newContentHash);

  if (!changed) {
    return { state, changed: false };
  }

  // Content changed - invalidate entry and dependents
  const newState = invalidateWithDependents(state, pageId);

  // Store new hash
  const contentHashes = new Map(newState.contentHashes);
  contentHashes.set(pageId, newContentHash);

  return {
    state: { ...newState, contentHashes },
    changed: true,
  };
}

// =============================================================================
// Eviction
// =============================================================================

/**
 * Gets entries sorted by LRU (least recently used first).
 */
export function getEntriesByLru(state: CacheState): CacheEntry[] {
  return [...state.entries.values()].sort(
    (a, b) => a.lastAccessedAt - b.lastAccessedAt,
  );
}

/**
 * Evicts least recently used entry.
 */
export function evictLru(state: CacheState): CacheState {
  const lruEntries = getEntriesByLru(state);
  if (lruEntries.length === 0) return state;

  const toEvict = lruEntries[0];
  const entries = new Map(state.entries);
  entries.delete(toEvict.pageId);

  const contentHashes = new Map(state.contentHashes);
  contentHashes.delete(toEvict.pageId);

  const newStats = {
    ...state.stats,
    evictions: state.stats.evictions + 1,
  };

  return {
    ...state,
    entries,
    contentHashes,
    totalSizeBytes: state.totalSizeBytes - toEvict.sizeBytes,
    stats: newStats,
  };
}

/**
 * Ensures cache has capacity for new entry.
 */
export function ensureCapacity(
  state: CacheState,
  requiredBytes: number,
): CacheState {
  let currentState = state;

  // Evict while over size limit
  while (
    currentState.totalSizeBytes + requiredBytes > currentState.config.maxSizeBytes &&
    currentState.entries.size > 0
  ) {
    currentState = evictLru(currentState);
  }

  // Evict while over entry limit
  while (
    currentState.entries.size >= currentState.config.maxEntries &&
    currentState.entries.size > 0
  ) {
    currentState = evictLru(currentState);
  }

  return currentState;
}

/**
 * Removes expired entries.
 */
export function removeExpired(
  state: CacheState,
  now: number = Date.now(),
): CacheState {
  let currentState = state;

  for (const [pageId, entry] of state.entries) {
    const age = now - entry.createdAt;
    if (age > state.config.ttlMs) {
      currentState = invalidateEntry(currentState, pageId);
    }
  }

  return currentState;
}

// =============================================================================
// Metrics
// =============================================================================

/**
 * Computes cache metrics.
 */
export function computeCacheMetrics(state: CacheState): CacheMetrics {
  const totalRequests = state.stats.hits + state.stats.misses + state.stats.staleHits;
  const hitRate = totalRequests > 0
    ? (state.stats.hits + state.stats.staleHits) / totalRequests
    : 0;

  const avgEntrySizeBytes = state.entries.size > 0
    ? Math.round(state.totalSizeBytes / state.entries.size)
    : 0;

  const totalHits = state.stats.hits + state.stats.staleHits;
  const avgRenderTimeSavedMs = totalHits > 0
    ? Math.round(state.stats.renderTimeSavedMs / totalHits)
    : 0;

  return {
    hitRate,
    missRate: 1 - hitRate,
    totalEntries: state.entries.size,
    totalSizeBytes: state.totalSizeBytes,
    sizeUtilization: state.totalSizeBytes / state.config.maxSizeBytes,
    entryUtilization: state.entries.size / state.config.maxEntries,
    avgEntrySizeBytes,
    avgRenderTimeSavedMs,
    stats: state.stats,
  };
}

// =============================================================================
// Formatting
// =============================================================================

/**
 * Formats cache metrics as string.
 */
export function formatCacheMetrics(metrics: CacheMetrics): string {
  const hitRatePct = (metrics.hitRate * 100).toFixed(1);
  const sizeUtilPct = (metrics.sizeUtilization * 100).toFixed(1);
  const entryUtilPct = (metrics.entryUtilization * 100).toFixed(1);
  const sizeMB = (metrics.totalSizeBytes / (1024 * 1024)).toFixed(2);

  const lines = [
    '═══════════════════════════════════════════════════════════',
    '  PREVIEW CACHE STATUS',
    '═══════════════════════════════════════════════════════════',
    '',
    '📊 PERFORMANCE',
    `  Hit Rate: ${hitRatePct}%`,
    `  Hits: ${metrics.stats.hits}`,
    `  Stale Hits: ${metrics.stats.staleHits}`,
    `  Misses: ${metrics.stats.misses}`,
    `  Avg Time Saved: ${metrics.avgRenderTimeSavedMs}ms`,
    '',
    '💾 STORAGE',
    `  Entries: ${metrics.totalEntries}`,
    `  Size: ${sizeMB}MB`,
    `  Size Utilization: ${sizeUtilPct}%`,
    `  Entry Utilization: ${entryUtilPct}%`,
    '',
    '🔄 LIFECYCLE',
    `  Invalidations: ${metrics.stats.invalidations}`,
    `  Evictions: ${metrics.stats.evictions}`,
    '═══════════════════════════════════════════════════════════',
  ];

  return lines.join('\n');
}

/**
 * Formats cache entry as string.
 */
export function formatCacheEntry(entry: CacheEntry, now: number = Date.now()): string {
  const ageMs = now - entry.createdAt;
  const ageMin = Math.round(ageMs / 60000);
  const sizeKB = (entry.sizeBytes / 1024).toFixed(1);

  return `${entry.pageId}: ${sizeKB}KB, ${entry.accessCount} accesses, ${ageMin}min old, ${entry.renderTimeMs}ms render`;
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Gets cached preview if available and valid.
 */
export function getCachedPreview(
  state: CacheState,
  pageId: string,
  content: string,
): { state: CacheState; html: string | null; css: string | null; fromCache: boolean } {
  const contentHash = computeContentHash(content);
  const { state: newState, result } = lookupCache(state, pageId, contentHash);

  if (result.hit && result.entry) {
    return {
      state: newState,
      html: result.entry.renderedHtml,
      css: result.entry.renderedCss,
      fromCache: true,
    };
  }

  return {
    state: newState,
    html: null,
    css: null,
    fromCache: false,
  };
}

/**
 * Caches a rendered preview.
 */
export function cachePreview(
  state: CacheState,
  pageId: string,
  content: string,
  renderedHtml: string,
  renderedCss: string,
  renderTimeMs: number,
  dependencies: string[] = [],
): CacheState {
  const contentHash = computeContentHash(content);
  return storeInCache(
    state,
    pageId,
    contentHash,
    renderedHtml,
    renderedCss,
    renderTimeMs,
    dependencies,
  );
}

/**
 * Notifies cache of content change.
 */
export function notifyContentChange(
  state: CacheState,
  pageId: string,
  newContent: string,
): CacheState {
  const newHash = computeContentHash(newContent);
  const { state: newState } = updateContentHash(state, pageId, newHash);
  return newState;
}

/**
 * Checks if page has valid cache entry.
 */
export function hasCachedPreview(
  state: CacheState,
  pageId: string,
  content: string,
): boolean {
  const contentHash = computeContentHash(content);
  const entry = state.entries.get(pageId);
  if (!entry) return false;

  const status = getEntryStatus(entry, contentHash, state.config);
  return status === 'fresh' || status === 'stale';
}
