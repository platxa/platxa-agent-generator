import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CACHE_CONFIG,
  computeContentHash,
  computeCombinedHash,
  createCacheState,
  getEntryStatus,
  lookupCache,
  storeInCache,
  invalidateEntry,
  invalidateWithDependents,
  invalidateAll,
  hasContentChanged,
  updateContentHash,
  getEntriesByLru,
  evictLru,
  ensureCapacity,
  removeExpired,
  computeCacheMetrics,
  formatCacheMetrics,
  formatCacheEntry,
  getCachedPreview,
  cachePreview,
  notifyContentChange,
  hasCachedPreview,
} from '@/lib/agent-bridge/preview-cache';

describe('Preview Cache', () => {
  // ===========================================================================
  // Verification: Unchanged pages return cached; cache invalidated on change
  // ===========================================================================

  describe('Verification: Cache Behavior', () => {
    it('returns cached preview for unchanged page', () => {
      let state = createCacheState();
      const pageId = 'page-1';
      const content = '<div>Hello World</div>';
      const html = '<html><body>Hello World</body></html>';
      const css = 'body { color: black; }';

      // Cache the preview
      state = cachePreview(state, pageId, content, html, css, 100);

      // Lookup with same content - should hit cache
      const { html: cachedHtml, css: cachedCss, fromCache } = getCachedPreview(
        state,
        pageId,
        content,
      );

      expect(fromCache).toBe(true);
      expect(cachedHtml).toBe(html);
      expect(cachedCss).toBe(css);
    });

    it('invalidates cache when content changes', () => {
      let state = createCacheState();
      const pageId = 'page-1';
      const content1 = '<div>Hello World</div>';
      const content2 = '<div>Hello Universe</div>';
      const html = '<html><body>Hello World</body></html>';
      const css = 'body { color: black; }';

      // Cache the preview
      state = cachePreview(state, pageId, content1, html, css, 100);

      // Lookup with different content - should miss
      const { fromCache } = getCachedPreview(state, pageId, content2);
      expect(fromCache).toBe(false);
    });

    it('notifyContentChange invalidates cache entry', () => {
      let state = createCacheState();
      const pageId = 'page-1';
      const content1 = '<div>Original</div>';
      const content2 = '<div>Modified</div>';
      const html = '<html><body>Original</body></html>';
      const css = 'body { }';

      // Cache the preview
      state = cachePreview(state, pageId, content1, html, css, 100);
      expect(hasCachedPreview(state, pageId, content1)).toBe(true);

      // Notify content change
      state = notifyContentChange(state, pageId, content2);

      // Original content no longer cached
      expect(hasCachedPreview(state, pageId, content1)).toBe(false);
    });

    it('dependent pages invalidated when dependency changes', () => {
      let state = createCacheState();

      // Page 2 depends on Page 1
      state = storeInCache(
        state,
        'page-1',
        'hash1',
        '<div>Page 1</div>',
        '',
        50,
        [],
      );
      state = storeInCache(
        state,
        'page-2',
        'hash2',
        '<div>Page 2</div>',
        '',
        50,
        ['page-1'], // Depends on page-1
      );

      expect(state.entries.has('page-1')).toBe(true);
      expect(state.entries.has('page-2')).toBe(true);

      // Invalidate page-1 with dependents
      state = invalidateWithDependents(state, 'page-1');

      // Both should be invalidated
      expect(state.entries.has('page-1')).toBe(false);
      expect(state.entries.has('page-2')).toBe(false);
    });
  });

  // ===========================================================================
  // Hash Functions
  // ===========================================================================

  describe('computeContentHash', () => {
    it('returns consistent hash for same content', () => {
      const content = '<div>Hello World</div>';
      const hash1 = computeContentHash(content);
      const hash2 = computeContentHash(content);
      expect(hash1).toBe(hash2);
    });

    it('returns different hash for different content', () => {
      const hash1 = computeContentHash('<div>Hello</div>');
      const hash2 = computeContentHash('<div>World</div>');
      expect(hash1).not.toBe(hash2);
    });

    it('returns hash starting with h_', () => {
      const hash = computeContentHash('test');
      expect(hash.startsWith('h_')).toBe(true);
    });
  });

  describe('computeCombinedHash', () => {
    it('combines multiple content pieces', () => {
      const hash = computeCombinedHash(['a', 'b', 'c']);
      expect(hash).toBeTruthy();
      expect(hash.startsWith('h_')).toBe(true);
    });

    it('different order produces different hash', () => {
      const hash1 = computeCombinedHash(['a', 'b']);
      const hash2 = computeCombinedHash(['b', 'a']);
      expect(hash1).not.toBe(hash2);
    });
  });

  // ===========================================================================
  // State Management
  // ===========================================================================

  describe('createCacheState', () => {
    it('creates empty state with defaults', () => {
      const state = createCacheState();
      expect(state.entries.size).toBe(0);
      expect(state.contentHashes.size).toBe(0);
      expect(state.totalSizeBytes).toBe(0);
      expect(state.config).toEqual(DEFAULT_CACHE_CONFIG);
    });

    it('accepts custom config', () => {
      const state = createCacheState({ maxEntries: 50 });
      expect(state.config.maxEntries).toBe(50);
      expect(state.config.maxSizeBytes).toBe(DEFAULT_CACHE_CONFIG.maxSizeBytes);
    });

    it('initializes stats to zero', () => {
      const state = createCacheState();
      expect(state.stats.hits).toBe(0);
      expect(state.stats.misses).toBe(0);
      expect(state.stats.invalidations).toBe(0);
    });
  });

  describe('getEntryStatus', () => {
    const config = DEFAULT_CACHE_CONFIG;

    it('returns fresh for valid recent entry', () => {
      const entry = {
        pageId: 'p1',
        contentHash: 'h1',
        renderedHtml: '',
        renderedCss: '',
        createdAt: 1000,
        lastAccessedAt: 1000,
        accessCount: 0,
        sizeBytes: 100,
        renderTimeMs: 50,
        dependencies: [],
      };

      const status = getEntryStatus(entry, 'h1', config, 2000);
      expect(status).toBe('fresh');
    });

    it('returns invalid for different hash', () => {
      const entry = {
        pageId: 'p1',
        contentHash: 'h1',
        renderedHtml: '',
        renderedCss: '',
        createdAt: 1000,
        lastAccessedAt: 1000,
        accessCount: 0,
        sizeBytes: 100,
        renderTimeMs: 50,
        dependencies: [],
      };

      const status = getEntryStatus(entry, 'h2', config, 2000);
      expect(status).toBe('invalid');
    });

    it('returns expired for old entry', () => {
      const entry = {
        pageId: 'p1',
        contentHash: 'h1',
        renderedHtml: '',
        renderedCss: '',
        createdAt: 1000,
        lastAccessedAt: 1000,
        accessCount: 0,
        sizeBytes: 100,
        renderTimeMs: 50,
        dependencies: [],
      };

      // Entry older than TTL
      const status = getEntryStatus(entry, 'h1', config, 1000 + config.ttlMs + 1);
      expect(status).toBe('expired');
    });

    it('returns stale for entry in revalidate window', () => {
      const entry = {
        pageId: 'p1',
        contentHash: 'h1',
        renderedHtml: '',
        renderedCss: '',
        createdAt: 1000,
        lastAccessedAt: 1000,
        accessCount: 0,
        sizeBytes: 100,
        renderTimeMs: 50,
        dependencies: [],
      };

      // Entry in stale-while-revalidate window
      const staleTime = 1000 + config.ttlMs - config.staleWhileRevalidateMs + 1;
      const status = getEntryStatus(entry, 'h1', config, staleTime);
      expect(status).toBe('stale');
    });
  });

  // ===========================================================================
  // Cache Operations
  // ===========================================================================

  describe('lookupCache', () => {
    it('returns miss for non-existent entry', () => {
      const state = createCacheState();
      const { result } = lookupCache(state, 'page-1', 'hash1');

      expect(result.hit).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.reason).toContain('not found');
    });

    it('returns hit for valid entry', () => {
      let state = createCacheState();
      state = storeInCache(state, 'page-1', 'hash1', '<html/>', '', 100);

      const { result } = lookupCache(state, 'page-1', 'hash1');

      expect(result.hit).toBe(true);
      expect(result.status).toBe('fresh');
      expect(result.entry).toBeDefined();
    });

    it('returns miss when content changed', () => {
      let state = createCacheState();
      state = storeInCache(state, 'page-1', 'hash1', '<html/>', '', 100);

      const { result } = lookupCache(state, 'page-1', 'hash2');

      expect(result.hit).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.reason).toContain('changed');
    });

    it('updates access time on hit', () => {
      let state = createCacheState();
      state = storeInCache(state, 'page-1', 'hash1', '<html/>', '', 100, [], 1000);

      const { state: newState } = lookupCache(state, 'page-1', 'hash1', 2000);
      const entry = newState.entries.get('page-1');

      expect(entry?.lastAccessedAt).toBe(2000);
      expect(entry?.accessCount).toBe(1);
    });

    it('increments hit counter', () => {
      let state = createCacheState();
      state = storeInCache(state, 'page-1', 'hash1', '<html/>', '', 100);

      const { state: newState } = lookupCache(state, 'page-1', 'hash1');

      expect(newState.stats.hits).toBe(1);
    });

    it('increments miss counter', () => {
      const state = createCacheState();
      const { state: newState } = lookupCache(state, 'page-1', 'hash1');

      expect(newState.stats.misses).toBe(1);
    });

    it('tracks render time saved', () => {
      let state = createCacheState();
      state = storeInCache(state, 'page-1', 'hash1', '<html/>', '', 150);

      const { state: newState } = lookupCache(state, 'page-1', 'hash1');

      expect(newState.stats.renderTimeSavedMs).toBe(150);
    });
  });

  describe('storeInCache', () => {
    it('stores entry in cache', () => {
      let state = createCacheState();
      state = storeInCache(state, 'page-1', 'hash1', '<html/>', 'css', 100);

      expect(state.entries.has('page-1')).toBe(true);
      const entry = state.entries.get('page-1');
      expect(entry?.renderedHtml).toBe('<html/>');
      expect(entry?.renderedCss).toBe('css');
    });

    it('updates total size', () => {
      let state = createCacheState();
      state = storeInCache(state, 'page-1', 'hash1', '12345', '67890', 100);

      expect(state.totalSizeBytes).toBe(10); // 5 + 5
    });

    it('stores content hash', () => {
      let state = createCacheState();
      state = storeInCache(state, 'page-1', 'hash1', '<html/>', '', 100);

      expect(state.contentHashes.get('page-1')).toBe('hash1');
    });

    it('updates dependency graph', () => {
      let state = createCacheState();
      state = storeInCache(state, 'page-2', 'hash2', '<html/>', '', 100, ['page-1']);

      expect(state.dependencyGraph.get('page-1')?.has('page-2')).toBe(true);
    });

    it('replaces existing entry', () => {
      let state = createCacheState();
      state = storeInCache(state, 'page-1', 'hash1', 'old', '', 100);
      state = storeInCache(state, 'page-1', 'hash2', 'new', '', 100);

      expect(state.entries.get('page-1')?.renderedHtml).toBe('new');
      expect(state.entries.get('page-1')?.contentHash).toBe('hash2');
    });
  });

  describe('invalidateEntry', () => {
    it('removes entry from cache', () => {
      let state = createCacheState();
      state = storeInCache(state, 'page-1', 'hash1', '<html/>', '', 100);
      state = invalidateEntry(state, 'page-1');

      expect(state.entries.has('page-1')).toBe(false);
    });

    it('removes content hash', () => {
      let state = createCacheState();
      state = storeInCache(state, 'page-1', 'hash1', '<html/>', '', 100);
      state = invalidateEntry(state, 'page-1');

      expect(state.contentHashes.has('page-1')).toBe(false);
    });

    it('updates total size', () => {
      let state = createCacheState();
      state = storeInCache(state, 'page-1', 'hash1', '12345', '', 100);
      state = invalidateEntry(state, 'page-1');

      expect(state.totalSizeBytes).toBe(0);
    });

    it('increments invalidation counter', () => {
      let state = createCacheState();
      state = storeInCache(state, 'page-1', 'hash1', '<html/>', '', 100);
      state = invalidateEntry(state, 'page-1');

      expect(state.stats.invalidations).toBe(1);
    });

    it('handles non-existent entry gracefully', () => {
      const state = createCacheState();
      const newState = invalidateEntry(state, 'page-1');

      expect(newState).toBe(state);
    });
  });

  describe('invalidateWithDependents', () => {
    it('invalidates entry and dependents', () => {
      let state = createCacheState();
      state = storeInCache(state, 'page-1', 'h1', 'a', '', 50);
      state = storeInCache(state, 'page-2', 'h2', 'b', '', 50, ['page-1']);
      state = storeInCache(state, 'page-3', 'h3', 'c', '', 50, ['page-2']);

      state = invalidateWithDependents(state, 'page-1');

      expect(state.entries.has('page-1')).toBe(false);
      expect(state.entries.has('page-2')).toBe(false);
      expect(state.entries.has('page-3')).toBe(false);
    });
  });

  describe('invalidateAll', () => {
    it('clears all entries', () => {
      let state = createCacheState();
      state = storeInCache(state, 'page-1', 'h1', 'a', '', 50);
      state = storeInCache(state, 'page-2', 'h2', 'b', '', 50);

      state = invalidateAll(state);

      expect(state.entries.size).toBe(0);
      expect(state.totalSizeBytes).toBe(0);
    });

    it('counts all invalidations', () => {
      let state = createCacheState();
      state = storeInCache(state, 'page-1', 'h1', 'a', '', 50);
      state = storeInCache(state, 'page-2', 'h2', 'b', '', 50);

      state = invalidateAll(state);

      expect(state.stats.invalidations).toBe(2);
    });
  });

  // ===========================================================================
  // Change Detection
  // ===========================================================================

  describe('hasContentChanged', () => {
    it('returns true for new page', () => {
      const state = createCacheState();
      expect(hasContentChanged(state, 'page-1', 'hash1')).toBe(true);
    });

    it('returns false for same hash', () => {
      let state = createCacheState();
      state = storeInCache(state, 'page-1', 'hash1', 'a', '', 50);

      expect(hasContentChanged(state, 'page-1', 'hash1')).toBe(false);
    });

    it('returns true for different hash', () => {
      let state = createCacheState();
      state = storeInCache(state, 'page-1', 'hash1', 'a', '', 50);

      expect(hasContentChanged(state, 'page-1', 'hash2')).toBe(true);
    });
  });

  describe('updateContentHash', () => {
    it('returns unchanged for same hash', () => {
      let state = createCacheState();
      state = storeInCache(state, 'page-1', 'hash1', 'a', '', 50);

      const { changed } = updateContentHash(state, 'page-1', 'hash1');
      expect(changed).toBe(false);
    });

    it('invalidates and returns changed for different hash', () => {
      let state = createCacheState();
      state = storeInCache(state, 'page-1', 'hash1', 'a', '', 50);

      const { state: newState, changed } = updateContentHash(state, 'page-1', 'hash2');

      expect(changed).toBe(true);
      expect(newState.entries.has('page-1')).toBe(false);
    });
  });

  // ===========================================================================
  // Eviction
  // ===========================================================================

  describe('getEntriesByLru', () => {
    it('sorts by last accessed time', () => {
      let state = createCacheState();
      state = storeInCache(state, 'page-1', 'h1', 'a', '', 50, [], 1000);
      state = storeInCache(state, 'page-2', 'h2', 'b', '', 50, [], 3000);
      state = storeInCache(state, 'page-3', 'h3', 'c', '', 50, [], 2000);

      const sorted = getEntriesByLru(state);

      expect(sorted[0].pageId).toBe('page-1');
      expect(sorted[1].pageId).toBe('page-3');
      expect(sorted[2].pageId).toBe('page-2');
    });
  });

  describe('evictLru', () => {
    it('evicts least recently used entry', () => {
      let state = createCacheState();
      state = storeInCache(state, 'page-1', 'h1', 'a', '', 50, [], 1000);
      state = storeInCache(state, 'page-2', 'h2', 'b', '', 50, [], 2000);

      state = evictLru(state);

      expect(state.entries.has('page-1')).toBe(false);
      expect(state.entries.has('page-2')).toBe(true);
    });

    it('increments eviction counter', () => {
      let state = createCacheState();
      state = storeInCache(state, 'page-1', 'h1', 'a', '', 50);

      state = evictLru(state);

      expect(state.stats.evictions).toBe(1);
    });
  });

  describe('ensureCapacity', () => {
    it('evicts to make room for new entry', () => {
      let state = createCacheState({ maxSizeBytes: 100 });
      state = storeInCache(state, 'page-1', 'h1', '12345678901234567890', '12345678901234567890', 50, [], 1000);
      // Size is now 40 bytes

      state = ensureCapacity(state, 70); // Need 70 more, total would be 110 > 100

      expect(state.entries.has('page-1')).toBe(false);
    });

    it('evicts to respect max entries', () => {
      let state = createCacheState({ maxEntries: 2 });
      state = storeInCache(state, 'page-1', 'h1', 'a', '', 50, [], 1000);
      state = storeInCache(state, 'page-2', 'h2', 'b', '', 50, [], 2000);

      state = ensureCapacity(state, 1);

      expect(state.entries.size).toBe(1);
      expect(state.entries.has('page-2')).toBe(true);
    });
  });

  describe('removeExpired', () => {
    it('removes expired entries', () => {
      let state = createCacheState({ ttlMs: 1000 });
      state = storeInCache(state, 'page-1', 'h1', 'a', '', 50, [], 1000);
      state = storeInCache(state, 'page-2', 'h2', 'b', '', 50, [], 3000);

      state = removeExpired(state, 2500);

      expect(state.entries.has('page-1')).toBe(false);
      expect(state.entries.has('page-2')).toBe(true);
    });
  });

  // ===========================================================================
  // Metrics
  // ===========================================================================

  describe('computeCacheMetrics', () => {
    it('computes hit rate', () => {
      let state = createCacheState();
      state = storeInCache(state, 'page-1', 'h1', 'a', '', 50);

      // 2 hits, 1 miss
      const { state: s1 } = lookupCache(state, 'page-1', 'h1');
      const { state: s2 } = lookupCache(s1, 'page-1', 'h1');
      const { state: s3 } = lookupCache(s2, 'page-2', 'h2');

      const metrics = computeCacheMetrics(s3);

      expect(metrics.hitRate).toBeCloseTo(0.67, 1);
    });

    it('computes size utilization', () => {
      let state = createCacheState({ maxSizeBytes: 1000 });
      state = storeInCache(state, 'page-1', 'h1', '1234567890', '', 50); // 10 bytes

      const metrics = computeCacheMetrics(state);

      expect(metrics.sizeUtilization).toBe(0.01); // 10/1000
    });

    it('computes average render time saved', () => {
      let state = createCacheState();
      state = storeInCache(state, 'page-1', 'h1', 'a', '', 100);
      state = storeInCache(state, 'page-2', 'h2', 'b', '', 200);

      const { state: s1 } = lookupCache(state, 'page-1', 'h1');
      const { state: s2 } = lookupCache(s1, 'page-2', 'h2');

      const metrics = computeCacheMetrics(s2);

      expect(metrics.avgRenderTimeSavedMs).toBe(150); // (100+200)/2
    });
  });

  // ===========================================================================
  // Formatting
  // ===========================================================================

  describe('formatCacheMetrics', () => {
    it('includes hit rate', () => {
      const state = createCacheState();
      const metrics = computeCacheMetrics(state);
      const formatted = formatCacheMetrics(metrics);

      expect(formatted).toContain('Hit Rate');
    });

    it('includes storage info', () => {
      const state = createCacheState();
      const metrics = computeCacheMetrics(state);
      const formatted = formatCacheMetrics(metrics);

      expect(formatted).toContain('STORAGE');
      expect(formatted).toContain('Entries');
    });

    it('includes lifecycle stats', () => {
      const state = createCacheState();
      const metrics = computeCacheMetrics(state);
      const formatted = formatCacheMetrics(metrics);

      expect(formatted).toContain('Invalidations');
      expect(formatted).toContain('Evictions');
    });
  });

  describe('formatCacheEntry', () => {
    it('includes page ID', () => {
      const entry = {
        pageId: 'page-1',
        contentHash: 'h1',
        renderedHtml: '12345',
        renderedCss: '',
        createdAt: 1000,
        lastAccessedAt: 2000,
        accessCount: 5,
        sizeBytes: 5,
        renderTimeMs: 100,
        dependencies: [],
      };

      const formatted = formatCacheEntry(entry, 3000);

      expect(formatted).toContain('page-1');
      expect(formatted).toContain('5 accesses');
      expect(formatted).toContain('100ms');
    });
  });

  // ===========================================================================
  // Convenience Functions
  // ===========================================================================

  describe('getCachedPreview', () => {
    it('returns cached preview when available', () => {
      let state = createCacheState();
      const content = '<div>Test</div>';
      state = cachePreview(state, 'page-1', content, '<html/>', 'css', 100);

      const { html, css, fromCache } = getCachedPreview(state, 'page-1', content);

      expect(fromCache).toBe(true);
      expect(html).toBe('<html/>');
      expect(css).toBe('css');
    });

    it('returns null when not cached', () => {
      const state = createCacheState();

      const { html, css, fromCache } = getCachedPreview(state, 'page-1', '<div/>');

      expect(fromCache).toBe(false);
      expect(html).toBeNull();
      expect(css).toBeNull();
    });
  });

  describe('hasCachedPreview', () => {
    it('returns true for cached page', () => {
      let state = createCacheState();
      const content = '<div>Test</div>';
      state = cachePreview(state, 'page-1', content, '<html/>', '', 100);

      expect(hasCachedPreview(state, 'page-1', content)).toBe(true);
    });

    it('returns false for uncached page', () => {
      const state = createCacheState();

      expect(hasCachedPreview(state, 'page-1', '<div/>')).toBe(false);
    });

    it('returns false when content changed', () => {
      let state = createCacheState();
      state = cachePreview(state, 'page-1', '<div>Old</div>', '<html/>', '', 100);

      expect(hasCachedPreview(state, 'page-1', '<div>New</div>')).toBe(false);
    });
  });
});
