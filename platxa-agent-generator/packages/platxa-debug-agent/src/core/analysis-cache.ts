/**
 * Analysis Cache
 *
 * Provides performance caching for repeated analysis operations.
 * Caches error parsing, hypothesis generation, and fix suggestions
 * to avoid redundant computation.
 *
 * @module analysis-cache
 */

import type {
  Language,
  NormalizedError,
  RootCauseHypothesis,
  FixSuggestion,
  ModuleAnalysisResult,
} from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Cache entry type
 */
export type CacheEntryType =
  | 'parsed_error'
  | 'hypothesis'
  | 'fix'
  | 'analysis_result'
  | 'file_hash'
  | 'pattern_match';

/**
 * Cache entry metadata
 */
export interface CacheEntryMetadata {
  /** Entry type */
  type: CacheEntryType;
  /** Language */
  language: Language;
  /** Creation timestamp */
  createdAt: Date;
  /** Last access timestamp */
  lastAccessedAt: Date;
  /** Access count */
  accessCount: number;
  /** Time to live (ms) */
  ttlMs: number;
  /** Size in bytes (estimated) */
  sizeBytes: number;
}

/**
 * Cache entry
 */
export interface CacheEntry<T = unknown> {
  /** Cache key */
  key: string;
  /** Cached value */
  value: T;
  /** Metadata */
  metadata: CacheEntryMetadata;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total entries */
  totalEntries: number;
  /** Total size in bytes */
  totalSizeBytes: number;
  /** Entries by type */
  entriesByType: Record<CacheEntryType, number>;
  /** Hit count */
  hits: number;
  /** Miss count */
  misses: number;
  /** Hit rate (0-1) */
  hitRate: number;
  /** Eviction count */
  evictions: number;
  /** Average entry age (ms) */
  avgEntryAgeMs: number;
}

/**
 * Cache eviction policy
 */
export type EvictionPolicy = 'lru' | 'lfu' | 'fifo' | 'ttl';

/**
 * Analysis cache configuration
 */
export interface AnalysisCacheConfig {
  /** Maximum entries */
  maxEntries: number;
  /** Maximum size in bytes */
  maxSizeBytes: number;
  /** Default TTL (ms) */
  defaultTtlMs: number;
  /** TTL by entry type */
  ttlByType: Partial<Record<CacheEntryType, number>>;
  /** Eviction policy */
  evictionPolicy: EvictionPolicy;
  /** Enable auto-cleanup */
  autoCleanup: boolean;
  /** Cleanup interval (ms) */
  cleanupIntervalMs: number;
  /** Verbose logging */
  verbose: boolean;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: AnalysisCacheConfig = {
  maxEntries: 1000,
  maxSizeBytes: 50 * 1024 * 1024, // 50MB
  defaultTtlMs: 10 * 60 * 1000, // 10 minutes
  ttlByType: {
    parsed_error: 30 * 60 * 1000, // 30 minutes - errors don't change
    hypothesis: 15 * 60 * 1000, // 15 minutes
    fix: 15 * 60 * 1000, // 15 minutes
    analysis_result: 5 * 60 * 1000, // 5 minutes - may need refresh
    file_hash: 60 * 60 * 1000, // 1 hour - file hashes are stable
    pattern_match: 30 * 60 * 1000, // 30 minutes
  },
  evictionPolicy: 'lru',
  autoCleanup: true,
  cleanupIntervalMs: 60 * 1000, // 1 minute
  verbose: false,
};

// =============================================================================
// Hash Functions
// =============================================================================

/**
 * Simple string hash using djb2 algorithm
 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Create cache key from error
 */
function createErrorKey(error: NormalizedError): string {
  const components = [
    error.type,
    error.message,
    error.language,
    error.location?.file ?? '',
    String(error.location?.line ?? 0),
  ];
  return `err:${hashString(components.join('|'))}`;
}

/**
 * Create cache key from raw input
 */
function createRawKey(raw: string, language: Language): string {
  return `raw:${language}:${hashString(raw)}`;
}

/**
 * Estimate size of object in bytes
 */
function estimateSize(obj: unknown): number {
  return JSON.stringify(obj).length * 2; // UTF-16 encoding
}

// =============================================================================
// Analysis Cache Class
// =============================================================================

/**
 * Analysis Cache
 *
 * High-performance cache for analysis results with configurable
 * eviction policies and TTL support.
 */
export class AnalysisCache {
  private config: AnalysisCacheConfig;
  private cache: Map<string, CacheEntry>;
  private hits: number;
  private misses: number;
  private evictions: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null;

  constructor(config: Partial<AnalysisCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.cleanupTimer = null;

    if (this.config.autoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * Get parsed errors from cache
   */
  getParsedErrors(raw: string, language: Language): NormalizedError[] | null {
    const key = createRawKey(raw, language);
    const entry = this.get<NormalizedError[]>(key);
    return entry;
  }

  /**
   * Cache parsed errors
   */
  setParsedErrors(
    raw: string,
    language: Language,
    errors: NormalizedError[]
  ): void {
    const key = createRawKey(raw, language);
    this.set(key, errors, 'parsed_error', language);
  }

  /**
   * Get hypothesis from cache
   */
  getHypothesis(error: NormalizedError): RootCauseHypothesis[] | null {
    const key = `hyp:${createErrorKey(error)}`;
    return this.get<RootCauseHypothesis[]>(key);
  }

  /**
   * Cache hypothesis
   */
  setHypothesis(error: NormalizedError, hypotheses: RootCauseHypothesis[]): void {
    const key = `hyp:${createErrorKey(error)}`;
    this.set(key, hypotheses, 'hypothesis', error.language);
  }

  /**
   * Get fix suggestions from cache
   */
  getFixes(hypothesis: RootCauseHypothesis): FixSuggestion[] | null {
    const key = `fix:${hashString(hypothesis.id)}`;
    return this.get<FixSuggestion[]>(key);
  }

  /**
   * Cache fix suggestions
   */
  setFixes(
    hypothesis: RootCauseHypothesis,
    fixes: FixSuggestion[],
    language: Language
  ): void {
    const key = `fix:${hashString(hypothesis.id)}`;
    this.set(key, fixes, 'fix', language);
  }

  /**
   * Get analysis result from cache
   */
  getAnalysisResult(
    errors: NormalizedError[],
    language: Language
  ): ModuleAnalysisResult | null {
    const errorHashes = errors.map((e) => createErrorKey(e)).join(':');
    const key = `analysis:${language}:${hashString(errorHashes)}`;
    return this.get<ModuleAnalysisResult>(key);
  }

  /**
   * Cache analysis result
   */
  setAnalysisResult(
    errors: NormalizedError[],
    language: Language,
    result: ModuleAnalysisResult
  ): void {
    const errorHashes = errors.map((e) => createErrorKey(e)).join(':');
    const key = `analysis:${language}:${hashString(errorHashes)}`;
    this.set(key, result, 'analysis_result', language);
  }

  /**
   * Get file hash from cache
   */
  getFileHash(filePath: string): string | null {
    const key = `filehash:${hashString(filePath)}`;
    return this.get<string>(key);
  }

  /**
   * Cache file hash
   */
  setFileHash(filePath: string, content: string): void {
    const hash = hashString(content);
    const key = `filehash:${hashString(filePath)}`;
    this.set(key, hash, 'file_hash', 'unknown');
  }

  /**
   * Check if file has changed
   */
  hasFileChanged(filePath: string, content: string): boolean {
    const cachedHash = this.getFileHash(filePath);
    if (cachedHash === null) {
      return true; // No cached hash, assume changed
    }
    const currentHash = hashString(content);
    return cachedHash !== currentHash;
  }

  /**
   * Get pattern match from cache
   */
  getPatternMatch(pattern: string, input: string): unknown | null {
    const key = `pattern:${hashString(pattern)}:${hashString(input)}`;
    return this.get<unknown>(key);
  }

  /**
   * Cache pattern match
   */
  setPatternMatch(
    pattern: string,
    input: string,
    result: unknown,
    language: Language
  ): void {
    const key = `pattern:${hashString(pattern)}:${hashString(input)}`;
    this.set(key, result, 'pattern_match', language);
  }

  /**
   * Generic get from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if expired
    const now = Date.now();
    const age = now - entry.metadata.createdAt.getTime();
    if (age > entry.metadata.ttlMs) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Update access metadata
    entry.metadata.lastAccessedAt = new Date();
    entry.metadata.accessCount++;
    this.hits++;

    return entry.value as T;
  }

  /**
   * Generic set to cache
   */
  set<T>(
    key: string,
    value: T,
    type: CacheEntryType,
    language: Language
  ): void {
    // Calculate TTL
    const ttlMs = this.config.ttlByType[type] ?? this.config.defaultTtlMs;

    // Calculate size
    const sizeBytes = estimateSize(value);

    // Check if we need to evict entries
    this.ensureCapacity(sizeBytes);

    const now = new Date();
    const entry: CacheEntry<T> = {
      key,
      value,
      metadata: {
        type,
        language,
        createdAt: now,
        lastAccessedAt: now,
        accessCount: 0,
        ttlMs,
        sizeBytes,
      },
    };

    this.cache.set(key, entry);
  }

  /**
   * Delete from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Check if expired
    const age = Date.now() - entry.metadata.createdAt.getTime();
    if (age > entry.metadata.ttlMs) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Clear entries by type
   */
  clearByType(type: CacheEntryType): number {
    let count = 0;
    for (const [key, entry] of this.cache) {
      if (entry.metadata.type === type) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear entries by language
   */
  clearByLanguage(language: Language): number {
    let count = 0;
    for (const [key, entry] of this.cache) {
      if (entry.metadata.language === language) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear expired entries
   */
  clearExpired(): number {
    const now = Date.now();
    let count = 0;

    for (const [key, entry] of this.cache) {
      const age = now - entry.metadata.createdAt.getTime();
      if (age > entry.metadata.ttlMs) {
        this.cache.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entriesByType: Record<CacheEntryType, number> = {
      parsed_error: 0,
      hypothesis: 0,
      fix: 0,
      analysis_result: 0,
      file_hash: 0,
      pattern_match: 0,
    };

    let totalSizeBytes = 0;
    let totalAgeMs = 0;
    const now = Date.now();

    for (const entry of this.cache.values()) {
      entriesByType[entry.metadata.type]++;
      totalSizeBytes += entry.metadata.sizeBytes;
      totalAgeMs += now - entry.metadata.createdAt.getTime();
    }

    const totalRequests = this.hits + this.misses;

    return {
      totalEntries: this.cache.size,
      totalSizeBytes,
      entriesByType,
      hits: this.hits,
      misses: this.misses,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      evictions: this.evictions,
      avgEntryAgeMs: this.cache.size > 0 ? totalAgeMs / this.cache.size : 0,
    };
  }

  /**
   * Ensure capacity for new entry
   */
  private ensureCapacity(newSizeBytes: number): void {
    // Calculate current size
    let currentSize = 0;
    for (const entry of this.cache.values()) {
      currentSize += entry.metadata.sizeBytes;
    }

    // Check if we need to evict
    while (
      (this.cache.size >= this.config.maxEntries ||
        currentSize + newSizeBytes > this.config.maxSizeBytes) &&
      this.cache.size > 0
    ) {
      const evictedEntry = this.evictOne();
      if (evictedEntry) {
        currentSize -= evictedEntry.metadata.sizeBytes;
        this.evictions++;
      } else {
        break;
      }
    }
  }

  /**
   * Evict one entry based on policy
   */
  private evictOne(): CacheEntry | null {
    if (this.cache.size === 0) {
      return null;
    }

    let entryToEvict: CacheEntry | null = null;
    let keyToEvict: string | null = null;

    switch (this.config.evictionPolicy) {
      case 'lru':
        // Least Recently Used
        let oldestAccess = Date.now();
        for (const [key, entry] of this.cache) {
          if (entry.metadata.lastAccessedAt.getTime() < oldestAccess) {
            oldestAccess = entry.metadata.lastAccessedAt.getTime();
            entryToEvict = entry;
            keyToEvict = key;
          }
        }
        break;

      case 'lfu':
        // Least Frequently Used
        let lowestCount = Infinity;
        for (const [key, entry] of this.cache) {
          if (entry.metadata.accessCount < lowestCount) {
            lowestCount = entry.metadata.accessCount;
            entryToEvict = entry;
            keyToEvict = key;
          }
        }
        break;

      case 'fifo':
        // First In First Out
        let oldestCreation = Date.now();
        for (const [key, entry] of this.cache) {
          if (entry.metadata.createdAt.getTime() < oldestCreation) {
            oldestCreation = entry.metadata.createdAt.getTime();
            entryToEvict = entry;
            keyToEvict = key;
          }
        }
        break;

      case 'ttl':
        // Closest to expiration
        let closestToExpiry = Infinity;
        const now = Date.now();
        for (const [key, entry] of this.cache) {
          const remaining =
            entry.metadata.ttlMs -
            (now - entry.metadata.createdAt.getTime());
          if (remaining < closestToExpiry) {
            closestToExpiry = remaining;
            entryToEvict = entry;
            keyToEvict = key;
          }
        }
        break;
    }

    if (keyToEvict) {
      this.cache.delete(keyToEvict);
    }

    return entryToEvict;
  }

  /**
   * Start auto-cleanup timer
   */
  private startAutoCleanup(): void {
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.clearExpired();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Stop auto-cleanup timer
   */
  stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Destroy the cache
   */
  destroy(): void {
    this.stopAutoCleanup();
    this.clear();
  }

  /**
   * Export cache summary for debugging
   */
  exportSummary(): {
    stats: CacheStats;
    config: AnalysisCacheConfig;
    entries: Array<{ key: string; type: CacheEntryType; ageMs: number; accessCount: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      type: entry.metadata.type,
      ageMs: now - entry.metadata.createdAt.getTime(),
      accessCount: entry.metadata.accessCount,
    }));

    return {
      stats: this.getStats(),
      config: this.config,
      entries,
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an analysis cache
 */
export function createAnalysisCache(
  config?: Partial<AnalysisCacheConfig>
): AnalysisCache {
  return new AnalysisCache(config);
}

/**
 * Create a shared analysis cache instance
 */
let sharedCache: AnalysisCache | null = null;

export function getSharedCache(): AnalysisCache {
  if (!sharedCache) {
    sharedCache = new AnalysisCache();
  }
  return sharedCache;
}

export function resetSharedCache(): void {
  if (sharedCache) {
    sharedCache.destroy();
    sharedCache = null;
  }
}
