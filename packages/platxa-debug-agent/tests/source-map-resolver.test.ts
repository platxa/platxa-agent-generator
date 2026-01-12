/**
 * Tests for SourceMapResolver
 *
 * Verifies that the SourceMapResolver correctly resolves minified locations
 * back to original source locations using .map files.
 */

import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SourceMapResolver } from '../src/modules/javascript-module.js';

describe('SourceMapResolver', () => {
  let tempDir: string;
  let resolver: SourceMapResolver;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'source-map-test-'));
    resolver = new SourceMapResolver([tempDir]);
  });

  afterEach(async () => {
    resolver.destroy();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('resolve()', () => {
    it('should return unresolved location when no source map exists', async () => {
      const result = await resolver.resolve('/nonexistent/file.js', 10, 5);

      expect(result.resolved).toBe(false);
      expect(result.source).toBe('/nonexistent/file.js');
      expect(result.line).toBe(10);
      expect(result.column).toBe(5);
      expect(result.name).toBeNull();
    });

    it('should resolve location using external .map file', async () => {
      // Create a minified JS file with sourceMappingURL
      const minifiedPath = join(tempDir, 'bundle.min.js');
      const mapPath = join(tempDir, 'bundle.min.js.map');

      // Sample source map that maps line 1, col 0 to original.ts line 5, col 10
      const sourceMap = {
        version: 3,
        file: 'bundle.min.js',
        sources: ['../src/original.ts'],
        names: ['myFunction'],
        mappings: 'AAAA,IAAM,UAAU,GAAG',
        sourcesContent: ['const myFunction = () => {};'],
      };

      await writeFile(minifiedPath, '// minified code\n//# sourceMappingURL=bundle.min.js.map');
      await writeFile(mapPath, JSON.stringify(sourceMap));

      const result = await resolver.resolve(minifiedPath, 1, 0);

      expect(result.resolved).toBe(true);
      expect(result.source).toBe('../src/original.ts');
      expect(result.line).toBe(1);
      expect(result.column).toBe(0);
    });

    it('should resolve location using inline base64 source map', async () => {
      const filePath = join(tempDir, 'inline.js');

      // Source map: maps line 1, col 0 to src/app.ts line 1, col 0
      const sourceMap = {
        version: 3,
        file: 'inline.js',
        sources: ['src/app.ts'],
        names: [],
        mappings: 'AAAA',
      };
      const base64Map = Buffer.from(JSON.stringify(sourceMap)).toString('base64');

      await writeFile(
        filePath,
        `console.log("hello");\n//# sourceMappingURL=data:application/json;base64,${base64Map}`
      );

      const result = await resolver.resolve(filePath, 1, 0);

      expect(result.resolved).toBe(true);
      expect(result.source).toBe('src/app.ts');
      expect(result.line).toBe(1);
    });

    it('should resolve location using sourceMappingURL reference', async () => {
      const jsPath = join(tempDir, 'app.js');
      const mapPath = join(tempDir, 'maps', 'app.js.map');

      const sourceMap = {
        version: 3,
        file: 'app.js',
        sources: ['original/source.ts'],
        names: ['handler'],
        mappings: 'AAAA',
      };

      // Create maps subdirectory and write source map
      await writeFile(jsPath, '// code\n//# sourceMappingURL=maps/app.js.map');
      await writeFile(mapPath, JSON.stringify(sourceMap)).catch(async () => {
        // Create directory if needed
        const { mkdir } = await import('fs/promises');
        await mkdir(join(tempDir, 'maps'), { recursive: true });
        await writeFile(mapPath, JSON.stringify(sourceMap));
      });

      const result = await resolver.resolve(jsPath, 1, 0);

      expect(result.resolved).toBe(true);
      expect(result.source).toBe('original/source.ts');
    });

    it('should cache source map consumers for repeated lookups', async () => {
      const minifiedPath = join(tempDir, 'cached.js');
      const mapPath = join(tempDir, 'cached.js.map');

      const sourceMap = {
        version: 3,
        file: 'cached.js',
        sources: ['src/cached.ts'],
        names: [],
        mappings: 'AAAA',
      };

      await writeFile(minifiedPath, '// code\n//# sourceMappingURL=cached.js.map');
      await writeFile(mapPath, JSON.stringify(sourceMap));

      // First call loads the source map
      const result1 = await resolver.resolve(minifiedPath, 1, 0);
      // Second call should use cached consumer
      const result2 = await resolver.resolve(minifiedPath, 1, 0);

      expect(result1.resolved).toBe(true);
      expect(result2.resolved).toBe(true);
      expect(result1.source).toBe(result2.source);
    });

    it('should cache failed lookups to avoid repeated filesystem access', async () => {
      const nonexistentPath = join(tempDir, 'does-not-exist.js');

      const result1 = await resolver.resolve(nonexistentPath, 1, 0);
      const result2 = await resolver.resolve(nonexistentPath, 1, 0);

      expect(result1.resolved).toBe(false);
      expect(result2.resolved).toBe(false);
    });
  });

  describe('resolveStackTrace()', () => {
    it('should resolve all frames in a stack trace', async () => {
      const minifiedPath = join(tempDir, 'stack.min.js');
      const mapPath = join(tempDir, 'stack.min.js.map');

      const sourceMap = {
        version: 3,
        file: 'stack.min.js',
        sources: ['src/handlers.ts'],
        names: ['processRequest'],
        mappings: 'AAAA,SAAS',
      };

      await writeFile(minifiedPath, '// code\n//# sourceMappingURL=stack.min.js.map');
      await writeFile(mapPath, JSON.stringify(sourceMap));

      const frames = [
        {
          location: { file: minifiedPath, line: 1, column: 0 },
          functionName: 'a',
          raw: 'at a (stack.min.js:1:0)',
          isUserCode: true,
        },
        {
          location: { file: '/node_modules/lib.js', line: 50, column: 10 },
          functionName: 'internalFunc',
          raw: 'at internalFunc (/node_modules/lib.js:50:10)',
          isUserCode: false,
        },
      ];

      const resolved = await resolver.resolveStackTrace(frames);

      expect(resolved).toHaveLength(2);
      expect(resolved[0]?.location.file).toBe('src/handlers.ts');
      // Second frame should remain unchanged (no source map)
      expect(resolved[1]?.location.file).toBe('/node_modules/lib.js');
    });

    it('should handle frames with minimal location data', async () => {
      const frames = [
        { location: { file: 'minimal.js', line: 1 }, functionName: 'anonymous' },
        { location: { file: 'test.js', line: 5, column: 10 }, functionName: 'test' },
      ];

      const resolved = await resolver.resolveStackTrace(frames);

      expect(resolved).toHaveLength(2);
      // Both frames should be preserved (no source maps available)
      expect(resolved[0]?.location.file).toBe('minimal.js');
      expect(resolved[1]?.location.file).toBe('test.js');
    });

    it('should preserve original frame data when resolution fails', async () => {
      const frames = [
        {
          location: { file: '/nonexistent/file.js', line: 10, column: 5 },
          functionName: 'myFunc',
          raw: 'at myFunc (/nonexistent/file.js:10:5)',
          isUserCode: true,
        },
      ];

      const resolved = await resolver.resolveStackTrace(frames);

      expect(resolved).toHaveLength(1);
      expect(resolved[0]?.location.file).toBe('/nonexistent/file.js');
      expect(resolved[0]?.location.line).toBe(10);
      expect(resolved[0]?.functionName).toBe('myFunc');
    });
  });

  describe('clearCache()', () => {
    it('should clear all cached consumers and failed lookups', async () => {
      const minifiedPath = join(tempDir, 'clear-test.js');
      const mapPath = join(tempDir, 'clear-test.js.map');

      const sourceMap = {
        version: 3,
        file: 'clear-test.js',
        sources: ['src/clear.ts'],
        names: [],
        mappings: 'AAAA',
      };

      await writeFile(minifiedPath, '// code\n//# sourceMappingURL=clear-test.js.map');
      await writeFile(mapPath, JSON.stringify(sourceMap));

      // Load source map into cache
      await resolver.resolve(minifiedPath, 1, 0);

      // Clear cache
      resolver.clearCache();

      // Should reload from disk (verifiable via coverage, but functionally works)
      const result = await resolver.resolve(minifiedPath, 1, 0);
      expect(result.resolved).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle malformed source map JSON gracefully', async () => {
      const jsPath = join(tempDir, 'malformed.js');
      const mapPath = join(tempDir, 'malformed.js.map');

      await writeFile(jsPath, '// code\n//# sourceMappingURL=malformed.js.map');
      await writeFile(mapPath, '{ invalid json }');

      const result = await resolver.resolve(jsPath, 1, 0);

      expect(result.resolved).toBe(false);
    });

    it('should handle invalid base64 in inline source map', async () => {
      const filePath = join(tempDir, 'invalid-base64.js');

      await writeFile(
        filePath,
        'code();\n//# sourceMappingURL=data:application/json;base64,!!!invalid!!!'
      );

      const result = await resolver.resolve(filePath, 1, 0);

      expect(result.resolved).toBe(false);
    });

    it('should handle source map with null original position', async () => {
      const jsPath = join(tempDir, 'null-pos.js');
      const mapPath = join(tempDir, 'null-pos.js.map');

      // Source map with empty mappings
      const sourceMap = {
        version: 3,
        file: 'null-pos.js',
        sources: ['src/null.ts'],
        names: [],
        mappings: '',
      };

      await writeFile(jsPath, '// code\n//# sourceMappingURL=null-pos.js.map');
      await writeFile(mapPath, JSON.stringify(sourceMap));

      const result = await resolver.resolve(jsPath, 100, 0);

      expect(result.resolved).toBe(false);
    });

    it('should handle webpack-style paths', async () => {
      const result = await resolver.resolve('webpack://my-app/src/index.js', 1, 0);

      // Should gracefully handle webpack URLs (won't resolve without special handling)
      expect(result.resolved).toBe(false);
      expect(result.source).toBe('webpack://my-app/src/index.js');
    });

    it('should handle absolute sourceMappingURL paths', async () => {
      const jsPath = join(tempDir, 'absolute-url.js');
      const mapPath = join(tempDir, 'absolute.map');

      const sourceMap = {
        version: 3,
        file: 'absolute-url.js',
        sources: ['src/absolute.ts'],
        names: [],
        mappings: 'AAAA',
      };

      await writeFile(jsPath, `// code\n//# sourceMappingURL=${mapPath}`);
      await writeFile(mapPath, JSON.stringify(sourceMap));

      const result = await resolver.resolve(jsPath, 1, 0);

      expect(result.resolved).toBe(true);
      expect(result.source).toBe('src/absolute.ts');
    });
  });
});
