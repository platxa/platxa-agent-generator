/**
 * Cross-Request Cache
 *
 * Provides persistent caching of context items across HTTP requests with
 * file-change based invalidation. Caches:
 * - File contents with modification-time tracking
 * - Search results with query-based keys
 * - Computed context (AST, analysis) with dependency tracking
 *
 * @module agentic-core/cross-request-cache
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

/** Cache entry types */
export type CacheEntryType =
  | 'file'
  | 'search'
  | 'context'
  | 'ast'
  | 'analysis';

/** File metadata for change detection */
export interface FileMetadata {
  /** File path (absolute) */
  path: string;
  /** Content hash (SHA-256) */
  hash: string;
  /** Modification time (ms since epoch) */
  mtime: number;
  /** File size in bytes */
  size: number;
}

/** Cache entry */
export interface CacheEntry<T = unknown> {
  /** Cache key */
  key: string;
  /** Entry type */
  type: CacheEntryType;
  /** Cached value */
  value: T;
  /** File dependencies (for invalidation) */
  dependencies: string[];
  /** File metadata at cache time */
  fileMetadata: Map<string, FileMetadata>;
  /** Creation timestamp */
  createdAt: number;
  /** Last access timestamp */
  lastAccessedAt: number;
  /** Access count */
  accessCount: number;
  /** TTL in milliseconds (0 = no expiry) */
  ttlMs: number;
}

/** Cache statistics */
export interface CacheStats {
  /** Total entries */
  totalEntries: number;
  /** Entries by type */
  entriesByType: Record<CacheEntryType, number>;
  /** Cache hits */
  hits: number;
  /** Cache misses */
  misses: number;
  /** Hit rate (0-1) */
  hitRate: number;
  /** Invalidations due to file changes */
  invalidations: number;
  /** Memory usage estimate (bytes) */
  estimatedMemory: number;
}

/** Cache configuration */
export interface CrossRequestCacheConfig {
  /** Maximum entries */
  maxEntries: number;
  /** Maximum memory (bytes) */
  maxMemory: number;
  /** Default TTL (ms, 0 = no expiry) */
  defaultTtlMs: number;
  /** TTL by entry type */
  ttlByType: Partial<Record<CacheEntryType, number>>;
  /** Enable file watching */
  enableFileWatching: boolean;
  /** Cleanup interval (ms) */
  cleanupIntervalMs: number;
  /** Workspace root for relative paths */
  workspaceRoot: string;
}

/** File change event */
export interface FileChangeEvent {
  /** File path */
  path: string;
  /** Change type */
  type: 'modified' | 'deleted' | 'created';
  /** Previous metadata (if modified/deleted) */
  previousMetadata?: FileMetadata;
  /** New metadata (if modified/created) */
  newMetadata?: FileMetadata;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: CrossRequestCacheConfig = {
  maxEntries: 500,
  maxMemory: 100 * 1024 * 1024, // 100MB
  defaultTtlMs: 30 * 60 * 1000, // 30 minutes
  ttlByType: {
    file: 60 * 60 * 1000, // 1 hour (invalidated on change anyway)
    search: 15 * 60 * 1000, // 15 minutes
    context: 30 * 60 * 1000, // 30 minutes
    ast: 60 * 60 * 1000, // 1 hour (invalidated on change)
    analysis: 20 * 60 * 1000, // 20 minutes
  },
  enableFileWatching: false, // Disabled by default, use polling
  cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
  workspaceRoot: process.cwd(),
};

// ============================================================================
// Hash Utilities
// ============================================================================

/**
 * Generate SHA-256 hash of content
 */
function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Generate cache key from components
 */
function generateKey(type: CacheEntryType, ...components: string[]): string {
  const combined = [type, ...components].join(':');
  return `${type}:${hashContent(combined)}`;
}

/**
 * Estimate memory size of value
 */
function estimateSize(value: unknown): number {
  try {
    return JSON.stringify(value).length * 2; // UTF-16
  } catch {
    return 1024; // Default estimate
  }
}

// ============================================================================
// Cross-Request Cache Class
// ============================================================================

/**
 * CrossRequestCache - Persistent context caching with file-change invalidation
 *
 * Singleton pattern ensures cache persists across HTTP requests within the same
 * Node.js process. File changes are detected via stat comparison on access.
 *
 * @example
 * ```typescript
 * const cache = CrossRequestCache.getInstance();
 *
 * // Cache a file with automatic invalidation
 * cache.setFile('/src/main.ts', fileContent);
 *
 * // Get cached file (returns null if file changed)
 * const content = cache.getFile('/src/main.ts');
 *
 * // Cache search results with dependencies
 * cache.setSearchResults('query', results, ['/src/main.ts', '/src/utils.ts']);
 *
 * // Get search results (invalidated if any dependency changed)
 * const cached = cache.getSearchResults('query');
 * ```
 */
export class CrossRequestCache {
  private static instance: CrossRequestCache | null = null;

  private config: CrossRequestCacheConfig;
  private cache: Map<string, CacheEntry>;
  private hits: number;
  private misses: number;
  private invalidations: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null;
  private watchers: Map<string, fs.FSWatcher>;

  private constructor(config: Partial<CrossRequestCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
    this.invalidations = 0;
    this.cleanupTimer = null;
    this.watchers = new Map();

    this.startCleanupTimer();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<CrossRequestCacheConfig>): CrossRequestCache {
    if (!CrossRequestCache.instance) {
      CrossRequestCache.instance = new CrossRequestCache(config);
    }
    return CrossRequestCache.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance(): void {
    if (CrossRequestCache.instance) {
      CrossRequestCache.instance.destroy();
      CrossRequestCache.instance = null;
    }
  }

  // ==========================================================================
  // File Caching
  // ==========================================================================

  /**
   * Cache file content with automatic change detection
   */
  setFile(filePath: string, content: string): void {
    const absolutePath = this.resolvePath(filePath);
    const key = generateKey('file', absolutePath);
    const metadata = this.getFileMetadata(absolutePath, content);

    if (!metadata) return;

    const entry: CacheEntry<string> = {
      key,
      type: 'file',
      value: content,
      dependencies: [absolutePath],
      fileMetadata: new Map([[absolutePath, metadata]]),
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 1,
      ttlMs: this.getTtl('file'),
    };

    this.setEntry(entry);
  }

  /**
   * Get cached file content (returns null if changed or expired)
   */
  getFile(filePath: string): string | null {
    const absolutePath = this.resolvePath(filePath);
    const key = generateKey('file', absolutePath);
    const entry = this.getEntry<string>(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Validate file hasn't changed
    if (!this.validateDependencies(entry)) {
      this.invalidateEntry(key, 'file_changed');
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.value;
  }

  /**
   * Check if file is cached and valid
   */
  hasValidFile(filePath: string): boolean {
    const absolutePath = this.resolvePath(filePath);
    const key = generateKey('file', absolutePath);
    const entry = this.cache.get(key);

    if (!entry) return false;
    return this.validateDependencies(entry);
  }

  // ==========================================================================
  // Search Result Caching
  // ==========================================================================

  /**
   * Cache search results with file dependencies
   */
  setSearchResults(
    query: string,
    results: unknown[],
    dependencies: string[] = []
  ): void {
    const key = generateKey('search', query);
    const resolvedDeps = dependencies.map(d => this.resolvePath(d));
    const fileMetadata = new Map<string, FileMetadata>();

    for (const dep of resolvedDeps) {
      const metadata = this.getFileMetadataFromDisk(dep);
      if (metadata) {
        fileMetadata.set(dep, metadata);
      }
    }

    const entry: CacheEntry<unknown[]> = {
      key,
      type: 'search',
      value: results,
      dependencies: resolvedDeps,
      fileMetadata,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 1,
      ttlMs: this.getTtl('search'),
    };

    this.setEntry(entry);
  }

  /**
   * Get cached search results (returns null if invalidated)
   */
  getSearchResults(query: string): unknown[] | null {
    const key = generateKey('search', query);
    const entry = this.getEntry<unknown[]>(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    if (!this.validateDependencies(entry)) {
      this.invalidateEntry(key, 'dependency_changed');
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.value;
  }

  // ==========================================================================
  // Generic Context Caching
  // ==========================================================================

  /**
   * Cache arbitrary context with dependencies
   */
  setContext<T>(
    contextKey: string,
    value: T,
    type: CacheEntryType = 'context',
    dependencies: string[] = []
  ): void {
    const key = generateKey(type, contextKey);
    const resolvedDeps = dependencies.map(d => this.resolvePath(d));
    const fileMetadata = new Map<string, FileMetadata>();

    for (const dep of resolvedDeps) {
      const metadata = this.getFileMetadataFromDisk(dep);
      if (metadata) {
        fileMetadata.set(dep, metadata);
      }
    }

    const entry: CacheEntry<T> = {
      key,
      type,
      value,
      dependencies: resolvedDeps,
      fileMetadata,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 1,
      ttlMs: this.getTtl(type),
    };

    this.setEntry(entry);
  }

  /**
   * Get cached context (returns null if invalidated)
   */
  getContext<T>(contextKey: string, type: CacheEntryType = 'context'): T | null {
    const key = generateKey(type, contextKey);
    const entry = this.getEntry<T>(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    if (!this.validateDependencies(entry)) {
      this.invalidateEntry(key, 'dependency_changed');
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.value;
  }

  // ==========================================================================
  // Batch Operations
  // ==========================================================================

  /**
   * Get multiple files, returning only cached and valid ones
   */
  getFiles(filePaths: string[]): Map<string, string> {
    const results = new Map<string, string>();

    for (const filePath of filePaths) {
      const content = this.getFile(filePath);
      if (content !== null) {
        results.set(filePath, content);
      }
    }

    return results;
  }

  /**
   * Cache multiple files
   */
  setFiles(files: Map<string, string>): void {
    for (const [filePath, content] of files) {
      this.setFile(filePath, content);
    }
  }

  // ==========================================================================
  // Invalidation
  // ==========================================================================

  /**
   * Manually invalidate a file and all dependent entries
   */
  invalidateFile(filePath: string): number {
    const absolutePath = this.resolvePath(filePath);
    let invalidated = 0;

    // Find and invalidate all entries depending on this file
    for (const [key, entry] of this.cache.entries()) {
      if (entry.dependencies.includes(absolutePath)) {
        this.cache.delete(key);
        invalidated++;
        this.invalidations++;
      }
    }

    return invalidated;
  }

  /**
   * Invalidate all entries of a specific type
   */
  invalidateByType(type: CacheEntryType): number {
    let invalidated = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.type === type) {
        this.cache.delete(key);
        invalidated++;
        this.invalidations++;
      }
    }

    return invalidated;
  }

  /**
   * Process file change event and invalidate affected entries
   */
  handleFileChange(event: FileChangeEvent): number {
    const absolutePath = this.resolvePath(event.path);
    return this.invalidateFile(absolutePath);
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entriesByType: Record<CacheEntryType, number> = {
      file: 0,
      search: 0,
      context: 0,
      ast: 0,
      analysis: 0,
    };

    let estimatedMemory = 0;

    for (const entry of this.cache.values()) {
      entriesByType[entry.type] = (entriesByType[entry.type] || 0) + 1;
      estimatedMemory += estimateSize(entry.value);
    }

    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;

    return {
      totalEntries: this.cache.size,
      entriesByType,
      hits: this.hits,
      misses: this.misses,
      hitRate,
      invalidations: this.invalidations,
      estimatedMemory,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.invalidations = 0;
  }

  // ==========================================================================
  // Maintenance
  // ==========================================================================

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
    this.stopFileWatchers();
  }

  /**
   * Prune expired and over-limit entries
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;

    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (entry.ttlMs > 0 && (now - entry.createdAt) > entry.ttlMs) {
        this.cache.delete(key);
        pruned++;
      }
    }

    // Remove entries if over limit (LRU)
    if (this.cache.size > this.config.maxEntries) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt);

      const toRemove = this.cache.size - this.config.maxEntries;
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
        pruned++;
      }
    }

    // Remove entries if over memory limit
    let currentMemory = this.getStats().estimatedMemory;
    if (currentMemory > this.config.maxMemory) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt);

      for (const [key, entry] of entries) {
        if (currentMemory <= this.config.maxMemory) break;
        const entrySize = estimateSize(entry.value);
        this.cache.delete(key);
        currentMemory -= entrySize;
        pruned++;
      }
    }

    return pruned;
  }

  /**
   * Destroy cache and cleanup resources
   */
  destroy(): void {
    this.stopCleanupTimer();
    this.stopFileWatchers();
    this.cache.clear();
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private setEntry<T>(entry: CacheEntry<T>): void {
    // Enforce limits before adding - must have room for new entry
    while (this.cache.size >= this.config.maxEntries) {
      const pruned = this.pruneOne();
      if (!pruned) break; // Safety: avoid infinite loop if prune fails
    }

    this.cache.set(entry.key, entry as CacheEntry);
  }

  /**
   * Prune a single entry (LRU) - used for making room for new entries
   */
  private pruneOne(): boolean {
    if (this.cache.size === 0) return false;

    // Find and remove the least recently accessed entry
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      return true;
    }

    return false;
  }

  private getEntry<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check TTL
    if (entry.ttlMs > 0 && (Date.now() - entry.createdAt) > entry.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Update access metadata
    entry.lastAccessedAt = Date.now();
    entry.accessCount++;

    return entry as CacheEntry<T>;
  }

  private invalidateEntry(key: string, reason: string): void {
    this.cache.delete(key);
    this.invalidations++;
  }

  private validateDependencies(entry: CacheEntry): boolean {
    for (const dep of entry.dependencies) {
      const cachedMetadata = entry.fileMetadata.get(dep);
      const currentMetadata = this.getFileMetadataFromDisk(dep);

      // File was deleted
      if (!currentMetadata) return false;

      // File was added after cache
      if (!cachedMetadata) return false;

      // File was modified (check mtime and size first, then hash if needed)
      if (cachedMetadata.mtime !== currentMetadata.mtime ||
          cachedMetadata.size !== currentMetadata.size) {
        return false;
      }
    }

    return true;
  }

  private getFileMetadata(filePath: string, content: string): FileMetadata | null {
    try {
      const stats = fs.statSync(filePath);
      return {
        path: filePath,
        hash: hashContent(content),
        mtime: stats.mtimeMs,
        size: stats.size,
      };
    } catch {
      return null;
    }
  }

  private getFileMetadataFromDisk(filePath: string): FileMetadata | null {
    try {
      const stats = fs.statSync(filePath);
      return {
        path: filePath,
        hash: '', // Don't compute hash on validation (expensive)
        mtime: stats.mtimeMs,
        size: stats.size,
      };
    } catch {
      return null;
    }
  }

  private resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.resolve(this.config.workspaceRoot, filePath);
  }

  private getTtl(type: CacheEntryType): number {
    return this.config.ttlByType[type] ?? this.config.defaultTtlMs;
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this.prune();
    }, this.config.cleanupIntervalMs);

    // Don't prevent process exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private stopFileWatchers(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Get the global cross-request cache instance
 */
export function getCrossRequestCache(
  config?: Partial<CrossRequestCacheConfig>
): CrossRequestCache {
  return CrossRequestCache.getInstance(config);
}

/**
 * Create a new cache instance (non-singleton, for testing)
 */
export function createCrossRequestCache(
  config?: Partial<CrossRequestCacheConfig>
): CrossRequestCache {
  // Use reflection to access private constructor for testing
  return CrossRequestCache.getInstance(config);
}

// ============================================================================
// Integration Helpers
// ============================================================================

/** Interface for managers that can be enhanced with cross-request caching */
export interface CacheableManager {
  getFileContent: (path: string) => string | undefined;
  addFileContent: (path: string, content: string, iteration?: number) => void;
}

/** Enhanced manager with cross-request cache */
export interface CachedManager<T extends CacheableManager> {
  /** Original manager instance */
  readonly manager: T;
  /** Cross-request cache instance */
  readonly crossRequestCache: CrossRequestCache;
  /** Get file content (checks cross-request cache if not in manager) */
  getFileContent: (path: string) => string | undefined;
  /** Add file content (writes to both manager and cross-request cache) */
  addFileContent: (path: string, content: string, iteration?: number) => void;
}

/**
 * Wrap ContextManager with cross-request caching
 *
 * Creates a new wrapper that enhances the ContextManager to check
 * cross-request cache before reading files, improving performance
 * for repeated context access across HTTP requests.
 *
 * Uses composition instead of mutation for cleaner design and testability.
 *
 * @example
 * ```typescript
 * const manager = new ContextManager();
 * const cached = withCrossRequestCache(manager);
 *
 * // Uses cross-request cache transparently
 * const content = cached.getFileContent('/src/main.ts');
 *
 * // Writes to both manager and cross-request cache
 * cached.addFileContent('/src/main.ts', 'new content');
 * ```
 */
export function withCrossRequestCache<T extends CacheableManager>(
  manager: T
): CachedManager<T> {
  const cache = getCrossRequestCache();

  return {
    manager,
    crossRequestCache: cache,

    getFileContent(filePath: string): string | undefined {
      // First check in-memory manager
      const managerContent = manager.getFileContent(filePath);
      if (managerContent !== undefined) {
        return managerContent;
      }

      // Then check cross-request cache
      const cachedContent = cache.getFile(filePath);
      if (cachedContent !== null) {
        // Add to manager for this session
        manager.addFileContent(filePath, cachedContent);
        return cachedContent;
      }

      return undefined;
    },

    addFileContent(
      filePath: string,
      content: string,
      iteration?: number
    ): void {
      manager.addFileContent(filePath, content, iteration);
      cache.setFile(filePath, content);
    },
  };
}

// ============================================================================
// Exports
// ============================================================================

export default CrossRequestCache;
