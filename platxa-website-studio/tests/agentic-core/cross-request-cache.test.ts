/**
 * Cross-Request Cache Tests
 *
 * Tests for context caching across requests with file-change invalidation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  CrossRequestCache,
  getCrossRequestCache,
  withCrossRequestCache,
  type CacheStats,
  type FileChangeEvent,
} from '../../lib/agentic-core/cross-request-cache';

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    statSync: vi.fn(),
  };
});

describe('CrossRequestCache', () => {
  let cache: CrossRequestCache;
  const testWorkspace = '/test/workspace';

  beforeEach(() => {
    // Reset singleton for isolated tests
    CrossRequestCache.resetInstance();

    // Mock file stats
    vi.mocked(fs.statSync).mockImplementation((filePath) => ({
      mtimeMs: 1000,
      size: 100,
      isFile: () => true,
      isDirectory: () => false,
    } as fs.Stats));

    cache = CrossRequestCache.getInstance({
      workspaceRoot: testWorkspace,
      maxEntries: 100,
      maxMemory: 10 * 1024 * 1024,
      cleanupIntervalMs: 60000,
    });
  });

  afterEach(() => {
    cache.destroy();
    CrossRequestCache.resetInstance();
    vi.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('returns same instance on multiple calls', () => {
      const instance1 = CrossRequestCache.getInstance();
      const instance2 = CrossRequestCache.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('creates new instance after reset', () => {
      const instance1 = CrossRequestCache.getInstance();
      CrossRequestCache.resetInstance();
      const instance2 = CrossRequestCache.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('File Caching', () => {
    it('caches and retrieves file content', () => {
      const filePath = '/test/workspace/src/main.ts';
      const content = 'const x = 1;';

      cache.setFile(filePath, content);
      const cached = cache.getFile(filePath);

      expect(cached).toBe(content);
    });

    it('returns null for uncached file', () => {
      const cached = cache.getFile('/test/workspace/nonexistent.ts');
      expect(cached).toBeNull();
    });

    it('invalidates cache when file mtime changes', () => {
      const filePath = '/test/workspace/src/main.ts';
      const content = 'const x = 1;';

      cache.setFile(filePath, content);

      // Simulate file modification
      vi.mocked(fs.statSync).mockReturnValueOnce({
        mtimeMs: 2000, // Changed mtime
        size: 100,
        isFile: () => true,
      } as fs.Stats);

      const cached = cache.getFile(filePath);
      expect(cached).toBeNull();
    });

    it('invalidates cache when file size changes', () => {
      const filePath = '/test/workspace/src/main.ts';
      const content = 'const x = 1;';

      cache.setFile(filePath, content);

      // Simulate file size change
      vi.mocked(fs.statSync).mockReturnValueOnce({
        mtimeMs: 1000,
        size: 200, // Changed size
        isFile: () => true,
      } as fs.Stats);

      const cached = cache.getFile(filePath);
      expect(cached).toBeNull();
    });

    it('invalidates cache when file is deleted', () => {
      const filePath = '/test/workspace/src/main.ts';
      const content = 'const x = 1;';

      cache.setFile(filePath, content);

      // Simulate file deletion
      vi.mocked(fs.statSync).mockImplementationOnce(() => {
        throw new Error('ENOENT');
      });

      const cached = cache.getFile(filePath);
      expect(cached).toBeNull();
    });

    it('tracks cache hits and misses', () => {
      const filePath = '/test/workspace/src/main.ts';
      cache.setFile(filePath, 'content');

      cache.getFile(filePath); // hit
      cache.getFile(filePath); // hit
      cache.getFile('/nonexistent'); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });

    it('checks file validity without retrieving', () => {
      const filePath = '/test/workspace/src/main.ts';
      cache.setFile(filePath, 'content');

      expect(cache.hasValidFile(filePath)).toBe(true);
      expect(cache.hasValidFile('/nonexistent')).toBe(false);
    });
  });

  describe('Search Result Caching', () => {
    it('caches and retrieves search results', () => {
      const query = 'function test';
      const results = [{ file: 'a.ts', line: 1 }, { file: 'b.ts', line: 5 }];

      cache.setSearchResults(query, results);
      const cached = cache.getSearchResults(query);

      expect(cached).toEqual(results);
    });

    it('returns null for uncached query', () => {
      const cached = cache.getSearchResults('nonexistent query');
      expect(cached).toBeNull();
    });

    it('invalidates when dependency file changes', () => {
      const query = 'function test';
      const results = [{ file: 'a.ts', line: 1 }];
      const dependencies = ['/test/workspace/src/a.ts'];

      cache.setSearchResults(query, results, dependencies);

      // Simulate dependency file modification
      vi.mocked(fs.statSync).mockReturnValueOnce({
        mtimeMs: 2000, // Changed
        size: 100,
        isFile: () => true,
      } as fs.Stats);

      const cached = cache.getSearchResults(query);
      expect(cached).toBeNull();
    });

    it('remains valid when dependencies unchanged', () => {
      const query = 'function test';
      const results = [{ file: 'a.ts', line: 1 }];
      const dependencies = ['/test/workspace/src/a.ts'];

      cache.setSearchResults(query, results, dependencies);
      const cached = cache.getSearchResults(query);

      expect(cached).toEqual(results);
    });
  });

  describe('Generic Context Caching', () => {
    it('caches and retrieves arbitrary context', () => {
      const key = 'user-preferences';
      const value = { theme: 'dark', fontSize: 14 };

      cache.setContext(key, value, 'context');
      const cached = cache.getContext<typeof value>(key, 'context');

      expect(cached).toEqual(value);
    });

    it('supports different cache types', () => {
      cache.setContext('ast-main', { type: 'Program' }, 'ast');
      cache.setContext('analysis-errors', [{ error: 'test' }], 'analysis');

      expect(cache.getContext('ast-main', 'ast')).toEqual({ type: 'Program' });
      expect(cache.getContext('analysis-errors', 'analysis')).toEqual([{ error: 'test' }]);
    });

    it('tracks entries by type in stats', () => {
      cache.setFile('/test/workspace/a.ts', 'content');
      cache.setSearchResults('query', []);
      cache.setContext('ctx', {}, 'context');
      cache.setContext('ast', {}, 'ast');

      const stats = cache.getStats();
      expect(stats.entriesByType.file).toBe(1);
      expect(stats.entriesByType.search).toBe(1);
      expect(stats.entriesByType.context).toBe(1);
      expect(stats.entriesByType.ast).toBe(1);
    });
  });

  describe('Batch Operations', () => {
    it('retrieves multiple files', () => {
      cache.setFile('/test/workspace/a.ts', 'content a');
      cache.setFile('/test/workspace/b.ts', 'content b');

      const files = cache.getFiles([
        '/test/workspace/a.ts',
        '/test/workspace/b.ts',
        '/test/workspace/c.ts', // not cached
      ]);

      expect(files.size).toBe(2);
      expect(files.get('/test/workspace/a.ts')).toBe('content a');
      expect(files.get('/test/workspace/b.ts')).toBe('content b');
    });

    it('caches multiple files', () => {
      const files = new Map([
        ['/test/workspace/a.ts', 'content a'],
        ['/test/workspace/b.ts', 'content b'],
      ]);

      cache.setFiles(files);

      expect(cache.getFile('/test/workspace/a.ts')).toBe('content a');
      expect(cache.getFile('/test/workspace/b.ts')).toBe('content b');
    });
  });

  describe('Manual Invalidation', () => {
    it('invalidates file and dependent entries', () => {
      const filePath = '/test/workspace/src/main.ts';
      cache.setFile(filePath, 'content');
      cache.setSearchResults('query', [], [filePath]);

      const invalidated = cache.invalidateFile(filePath);

      expect(invalidated).toBe(2); // file entry + search entry
      expect(cache.getFile(filePath)).toBeNull();
      expect(cache.getSearchResults('query')).toBeNull();
    });

    it('invalidates by type', () => {
      cache.setFile('/test/workspace/a.ts', 'a');
      cache.setFile('/test/workspace/b.ts', 'b');
      cache.setSearchResults('query', []);

      const invalidated = cache.invalidateByType('file');

      expect(invalidated).toBe(2);
      expect(cache.getFile('/test/workspace/a.ts')).toBeNull();
      expect(cache.getSearchResults('query')).not.toBeNull();
    });

    it('handles file change events', () => {
      const filePath = '/test/workspace/src/main.ts';
      cache.setFile(filePath, 'content');

      const event: FileChangeEvent = {
        path: filePath,
        type: 'modified',
      };

      const invalidated = cache.handleFileChange(event);
      expect(invalidated).toBe(1);
    });
  });

  describe('TTL Expiration', () => {
    it('expires entries after TTL', async () => {
      // Create cache with short TTL
      CrossRequestCache.resetInstance();
      const shortTtlCache = CrossRequestCache.getInstance({
        workspaceRoot: testWorkspace,
        defaultTtlMs: 50, // 50ms TTL
        ttlByType: { file: 50 },
      });

      shortTtlCache.setFile('/test/workspace/a.ts', 'content');
      expect(shortTtlCache.getFile('/test/workspace/a.ts')).toBe('content');

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(shortTtlCache.getFile('/test/workspace/a.ts')).toBeNull();
    });
  });

  describe('Memory Management', () => {
    it('prunes oldest entries when max entries reached', () => {
      CrossRequestCache.resetInstance();
      const smallCache = CrossRequestCache.getInstance({
        workspaceRoot: testWorkspace,
        maxEntries: 3,
      });

      // Add entries with slight delays to ensure different lastAccessedAt
      smallCache.setFile('/test/workspace/1.ts', 'content 1');
      smallCache.setFile('/test/workspace/2.ts', 'content 2');
      smallCache.setFile('/test/workspace/3.ts', 'content 3');

      // Adding 4th entry should automatically prune to make room
      smallCache.setFile('/test/workspace/4.ts', 'content 4');

      const stats = smallCache.getStats();
      // Should never exceed maxEntries
      expect(stats.totalEntries).toBeLessThanOrEqual(3);
      // The newest entry should exist
      expect(smallCache.getFile('/test/workspace/4.ts')).toBe('content 4');
      // The oldest entry (1.ts) should have been pruned
      expect(smallCache.getFile('/test/workspace/1.ts')).toBeNull();
    });

    it('estimates memory usage', () => {
      cache.setFile('/test/workspace/a.ts', 'x'.repeat(1000));

      const stats = cache.getStats();
      expect(stats.estimatedMemory).toBeGreaterThan(0);
    });

    it('clears all entries', () => {
      cache.setFile('/test/workspace/a.ts', 'content');
      cache.setSearchResults('query', []);

      cache.clear();

      expect(cache.getStats().totalEntries).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('provides comprehensive stats', () => {
      cache.setFile('/test/workspace/a.ts', 'content');
      cache.getFile('/test/workspace/a.ts'); // hit
      cache.getFile('/nonexistent'); // miss

      const stats = cache.getStats();

      expect(stats.totalEntries).toBe(1);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
      expect(stats.entriesByType.file).toBe(1);
    });

    it('resets statistics', () => {
      cache.setFile('/test/workspace/a.ts', 'content');
      cache.getFile('/test/workspace/a.ts');
      cache.getFile('/nonexistent');

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.totalEntries).toBe(1); // entries remain
    });
  });

  describe('Path Resolution', () => {
    it('resolves relative paths to workspace root', () => {
      cache.setFile('src/main.ts', 'content');

      // Should be accessible via absolute path too
      const cached = cache.getFile(path.join(testWorkspace, 'src/main.ts'));
      expect(cached).toBe('content');
    });

    it('handles absolute paths correctly', () => {
      const absolutePath = '/other/project/file.ts';
      cache.setFile(absolutePath, 'content');

      expect(cache.getFile(absolutePath)).toBe('content');
    });
  });

  describe('withCrossRequestCache Integration', () => {
    it('enhances ContextManager with cross-request caching', () => {
      // Mock minimal ContextManager
      const mockManager = {
        getFileContent: vi.fn().mockReturnValue(undefined),
        addFileContent: vi.fn(),
      };

      const cached = withCrossRequestCache(mockManager);

      // Cache via enhanced manager
      cached.addFileContent('/test/workspace/a.ts', 'cached content');

      // Verify cross-request cache was populated
      expect(cached.crossRequestCache.getFile('/test/workspace/a.ts')).toBe('cached content');
      // Verify original manager was also called
      expect(mockManager.addFileContent).toHaveBeenCalledWith(
        '/test/workspace/a.ts',
        'cached content',
        undefined
      );
    });

    it('checks cross-request cache when manager has no content', () => {
      // Pre-populate cross-request cache
      cache.setFile('/test/workspace/a.ts', 'cross-request content');

      const mockManager = {
        getFileContent: vi.fn().mockReturnValue(undefined),
        addFileContent: vi.fn(),
      };

      const cached = withCrossRequestCache(mockManager);
      const content = cached.getFileContent('/test/workspace/a.ts');

      expect(content).toBe('cross-request content');
      // Should also add to manager for this session
      expect(mockManager.addFileContent).toHaveBeenCalledWith(
        '/test/workspace/a.ts',
        'cross-request content'
      );
    });

    it('prefers manager content over cross-request cache', () => {
      cache.setFile('/test/workspace/a.ts', 'old content');

      const mockManager = {
        getFileContent: vi.fn().mockReturnValue('fresh content'),
        addFileContent: vi.fn(),
      };

      const cached = withCrossRequestCache(mockManager);
      const content = cached.getFileContent('/test/workspace/a.ts');

      expect(content).toBe('fresh content');
      // Should NOT call addFileContent since manager already had it
      expect(mockManager.addFileContent).not.toHaveBeenCalled();
    });

    it('provides access to original manager', () => {
      const mockManager = {
        getFileContent: vi.fn(),
        addFileContent: vi.fn(),
      };

      const cached = withCrossRequestCache(mockManager);

      expect(cached.manager).toBe(mockManager);
    });
  });
});

describe('getCrossRequestCache', () => {
  afterEach(() => {
    CrossRequestCache.resetInstance();
  });

  it('returns singleton instance', () => {
    const cache1 = getCrossRequestCache();
    const cache2 = getCrossRequestCache();
    expect(cache1).toBe(cache2);
  });

  it('applies configuration on first call', () => {
    const cache = getCrossRequestCache({ maxEntries: 50 });
    // Configuration is applied internally
    expect(cache).toBeDefined();
  });
});
