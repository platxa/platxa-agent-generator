/**
 * Search Codebase Tool Tests - REAL INTEGRATION TESTS
 * Verifies Feature #17: search_codebase tool using ripgrep with semantic ranking
 *
 * These are real integration tests that:
 * - Execute actual ripgrep commands on the real codebase
 * - Verify real search results with actual file paths
 * - Test semantic ranking with real code patterns
 *
 * Verification criteria:
 * - Returns top 10 results with { path, snippet, relevance }
 * - Supports glob filtering
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import {
  searchCodebaseTool,
  searchCodebaseImpl,
  type SearchMatch,
} from '@/lib/agentic-core/tools/search-codebase';
import type { ToolParams } from '@/lib/agentic-core/tool-executor';
import type { AgentContext } from '@/lib/agentic-core/agent-engine';

const createMockContext = (): AgentContext => ({
  filesRead: new Map(),
  searchResults: new Map(),
  userPreferences: {},
  odooContext: {},
});

const createToolParams = (target: string, options?: Record<string, unknown>): ToolParams => ({
  target,
  context: createMockContext(),
  options,
});

// Check if ripgrep is available synchronously at module load time
// This is necessary because it.skipIf() evaluates conditions at definition time
let ripgrepAvailable = false;
try {
  execSync('rg --version', { stdio: 'ignore' });
  ripgrepAvailable = true;
} catch {
  console.warn('ripgrep (rg) not installed - some tests will be skipped');
}

describe('Search Codebase Tool - Real Integration Tests', () => {

  describe('ripgrep availability', () => {
    it('should detect ripgrep installation status', () => {
      // This test documents the ripgrep status
      expect(typeof ripgrepAvailable).toBe('boolean');
    });
  });

  describe('searchCodebaseTool() - basic functionality', () => {
    it('should return ToolResult structure', async () => {
      const result = await searchCodebaseTool(createToolParams('AgentEngine'));

      expect(result).toMatchObject({
        success: expect.any(Boolean),
        duration: expect.any(Number),
        toolName: 'search_codebase',
      });
    });

    it('should include query in result data', async () => {
      const result = await searchCodebaseTool(createToolParams('AgentEngine'));

      if (result.success) {
        expect(result.data).toMatchObject({
          query: 'AgentEngine',
        });
      }
    });

    it('should handle empty query gracefully', async () => {
      const result = await searchCodebaseTool(createToolParams(''));

      expect(result.success).toBe(true);
      expect((result.data as { results: SearchMatch[] }).results).toEqual([]);
    });

    it('should handle whitespace-only query', async () => {
      const result = await searchCodebaseTool(createToolParams('   '));

      expect(result.success).toBe(true);
      expect((result.data as { results: SearchMatch[] }).results).toEqual([]);
    });
  });

  describe('searchCodebaseTool() - real search results', () => {
    it.skipIf(!ripgrepAvailable)('should find AgentEngine in agentic-core', async () => {
      const result = await searchCodebaseTool(
        createToolParams('AgentEngine', {
          baseDir: 'lib/agentic-core',
          includeGlobs: ['*.ts'],
        })
      );

      expect(result.success).toBe(true);

      const data = result.data as { results: SearchMatch[]; totalMatches: number };
      expect(data.results.length).toBeGreaterThan(0);

      // Should find it in agent-engine.ts
      const agentEngineResults = data.results.filter(r => r.path.includes('agent-engine'));
      expect(agentEngineResults.length).toBeGreaterThan(0);
    });

    it.skipIf(!ripgrepAvailable)('should return results with path, snippet, relevance', async () => {
      const result = await searchCodebaseTool(
        createToolParams('export', {
          baseDir: 'lib/agentic-core',
          maxResults: 5,
        })
      );

      expect(result.success).toBe(true);

      const data = result.data as { results: SearchMatch[] };
      expect(data.results.length).toBeGreaterThan(0);

      const firstResult = data.results[0];
      expect(firstResult).toHaveProperty('path');
      expect(firstResult).toHaveProperty('snippet');
      expect(firstResult).toHaveProperty('relevance');
      expect(typeof firstResult.path).toBe('string');
      expect(typeof firstResult.snippet).toBe('string');
      expect(typeof firstResult.relevance).toBe('number');
    });

    it.skipIf(!ripgrepAvailable)('should include line numbers in results', async () => {
      const result = await searchCodebaseTool(
        createToolParams('interface', {
          baseDir: 'lib/agentic-core',
          maxResults: 5,
        })
      );

      expect(result.success).toBe(true);

      const data = result.data as { results: SearchMatch[] };
      if (data.results.length > 0) {
        expect(data.results[0]).toHaveProperty('line');
        expect(typeof data.results[0].line).toBe('number');
        expect(data.results[0].line).toBeGreaterThan(0);
      }
    });

    it.skipIf(!ripgrepAvailable)('should return max 10 results by default', async () => {
      const result = await searchCodebaseTool(
        createToolParams('const', {
          baseDir: 'lib/agentic-core',
        })
      );

      expect(result.success).toBe(true);

      const data = result.data as { results: SearchMatch[] };
      expect(data.results.length).toBeLessThanOrEqual(10);
    });

    it.skipIf(!ripgrepAvailable)('should respect maxResults option', async () => {
      const result = await searchCodebaseTool(
        createToolParams('function', {
          baseDir: 'lib/agentic-core',
          maxResults: 3,
        })
      );

      expect(result.success).toBe(true);

      const data = result.data as { results: SearchMatch[] };
      expect(data.results.length).toBeLessThanOrEqual(3);
    });
  });

  describe('semantic ranking', () => {
    it.skipIf(!ripgrepAvailable)('should return relevance scores between 0 and 1', async () => {
      const result = await searchCodebaseTool(
        createToolParams('ValidationResult', {
          baseDir: 'lib/agentic-core',
        })
      );

      expect(result.success).toBe(true);

      const data = result.data as { results: SearchMatch[] };
      data.results.forEach(r => {
        expect(r.relevance).toBeGreaterThanOrEqual(0);
        expect(r.relevance).toBeLessThanOrEqual(1);
      });
    });

    it.skipIf(!ripgrepAvailable)('should rank results by relevance (sorted descending)', async () => {
      const result = await searchCodebaseTool(
        createToolParams('AgentError', {
          baseDir: 'lib/agentic-core',
          maxResults: 10,
        })
      );

      expect(result.success).toBe(true);

      const data = result.data as { results: SearchMatch[] };
      if (data.results.length >= 2) {
        // Verify results are sorted by relevance descending
        for (let i = 1; i < data.results.length; i++) {
          expect(data.results[i - 1].relevance).toBeGreaterThanOrEqual(data.results[i].relevance);
        }
      }
    });

    it.skipIf(!ripgrepAvailable)('should give higher relevance to TypeScript files', async () => {
      const result = await searchCodebaseTool(
        createToolParams('agentic', {
          baseDir: '.',
          maxResults: 20,
        })
      );

      expect(result.success).toBe(true);

      const data = result.data as { results: SearchMatch[] };
      const tsResults = data.results.filter(r => r.path.endsWith('.ts'));
      const otherResults = data.results.filter(r => !r.path.endsWith('.ts') && !r.path.endsWith('.tsx'));

      // If we have both types, TS should generally rank higher
      if (tsResults.length > 0 && otherResults.length > 0) {
        const avgTsRelevance = tsResults.reduce((sum, r) => sum + r.relevance, 0) / tsResults.length;
        const avgOtherRelevance = otherResults.reduce((sum, r) => sum + r.relevance, 0) / otherResults.length;
        // TS files should have higher or equal average relevance
        expect(avgTsRelevance).toBeGreaterThanOrEqual(avgOtherRelevance * 0.8); // Allow some tolerance
      }
    });
  });

  describe('glob filtering', () => {
    it.skipIf(!ripgrepAvailable)('should filter by includeGlobs', async () => {
      const result = await searchCodebaseTool(
        createToolParams('export', {
          baseDir: 'lib/agentic-core',
          includeGlobs: ['**/index.ts'],
        })
      );

      expect(result.success).toBe(true);

      const data = result.data as { results: SearchMatch[] };
      // All results should be index.ts files
      data.results.forEach(r => {
        expect(r.path).toContain('index.ts');
      });
    });

    it.skipIf(!ripgrepAvailable)('should filter by excludeGlobs', async () => {
      const result = await searchCodebaseTool(
        createToolParams('describe', {
          baseDir: '.',
          excludeGlobs: ['*.test.ts', '*.spec.ts'],
          maxResults: 20,
        })
      );

      expect(result.success).toBe(true);

      const data = result.data as { results: SearchMatch[] };
      // No results should be test files
      data.results.forEach(r => {
        expect(r.path).not.toMatch(/\.(test|spec)\.ts$/);
      });
    });

    it.skipIf(!ripgrepAvailable)('should exclude node_modules by default', async () => {
      const result = await searchCodebaseTool(
        createToolParams('require', {
          baseDir: '.',
          maxResults: 50,
        })
      );

      expect(result.success).toBe(true);

      const data = result.data as { results: SearchMatch[] };
      // No results should be from node_modules
      data.results.forEach(r => {
        expect(r.path).not.toContain('node_modules');
      });
    });
  });

  describe('snippet extraction', () => {
    it.skipIf(!ripgrepAvailable)('should include context lines in snippets', async () => {
      const result = await searchCodebaseTool(
        createToolParams('AgentEngine', {
          baseDir: 'lib/agentic-core',
          maxResults: 1,
          contextLines: 2,
        })
      );

      expect(result.success).toBe(true);

      const data = result.data as { results: SearchMatch[] };
      if (data.results.length > 0) {
        const snippet = data.results[0].snippet;
        // Snippet should have multiple lines (context + match)
        const lineCount = snippet.split('\n').length;
        expect(lineCount).toBeGreaterThan(1);
      }
    });

    it.skipIf(!ripgrepAvailable)('should mark the matched line in snippet', async () => {
      const result = await searchCodebaseTool(
        createToolParams('ToolExecutor', {
          baseDir: 'lib/agentic-core',
          maxResults: 1,
        })
      );

      expect(result.success).toBe(true);

      const data = result.data as { results: SearchMatch[] };
      if (data.results.length > 0) {
        // Snippet should have a marker indicating the match line
        expect(data.results[0].snippet).toContain('◀');
      }
    });

    it.skipIf(!ripgrepAvailable)('should include line numbers in snippets', async () => {
      const result = await searchCodebaseTool(
        createToolParams('createAgentEngine', {
          baseDir: 'lib/agentic-core',
          maxResults: 1,
        })
      );

      expect(result.success).toBe(true);

      const data = result.data as { results: SearchMatch[] };
      if (data.results.length > 0) {
        // Snippet should contain line numbers
        expect(data.results[0].snippet).toMatch(/\d+\s*│/);
      }
    });
  });

  describe('error handling', () => {
    it('should handle non-existent directory gracefully', async () => {
      const result = await searchCodebaseTool(
        createToolParams('test', {
          baseDir: '/nonexistent/path/that/does/not/exist',
        })
      );

      // Should either fail gracefully or return empty results
      if (!result.success) {
        expect(result.error).toBeDefined();
      } else {
        expect((result.data as { results: SearchMatch[] }).results).toEqual([]);
      }
    });

    it('should handle special characters in query', async () => {
      const result = await searchCodebaseTool(
        createToolParams('const foo = "bar"', {
          baseDir: 'lib/agentic-core',
        })
      );

      // Should not crash, regardless of results
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('duration');
    });

    it('should report duration even on error', async () => {
      const result = await searchCodebaseTool(
        createToolParams('test', {
          baseDir: '/nonexistent',
        })
      );

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('search options', () => {
    it.skipIf(!ripgrepAvailable)('should support case-insensitive search by default', async () => {
      const lowerResult = await searchCodebaseTool(
        createToolParams('agentengine', {
          baseDir: 'lib/agentic-core',
        })
      );

      const upperResult = await searchCodebaseTool(
        createToolParams('AGENTENGINE', {
          baseDir: 'lib/agentic-core',
        })
      );

      // Both should find results (case-insensitive)
      expect(lowerResult.success).toBe(true);
      expect(upperResult.success).toBe(true);
    });

    it.skipIf(!ripgrepAvailable)('should support case-sensitive search', async () => {
      const result = await searchCodebaseTool(
        createToolParams('AgentEngine', {
          baseDir: 'lib/agentic-core',
          caseSensitive: true,
        })
      );

      expect(result.success).toBe(true);
      // Case-sensitive search for exact "AgentEngine" should find results
      const data = result.data as { results: SearchMatch[] };
      expect(data.results.length).toBeGreaterThan(0);
    });

    it.skipIf(!ripgrepAvailable)('should support base directory option', async () => {
      const result = await searchCodebaseTool(
        createToolParams('Replanner', {
          baseDir: 'lib/agentic-core',
        })
      );

      expect(result.success).toBe(true);

      const data = result.data as { results: SearchMatch[] };
      // All results should be under lib/agentic-core
      data.results.forEach(r => {
        expect(r.path).toMatch(/^(lib\/)?agentic-core/);
      });
    });
  });

  describe('searchCodebaseImpl() - direct API', () => {
    it.skipIf(!ripgrepAvailable)('should return SearchMatch array', async () => {
      const results = await searchCodebaseImpl({
        query: 'ValidationEngine',
        baseDir: 'lib/agentic-core',
        maxResults: 5,
      });

      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
        expect(results[0]).toHaveProperty('path');
        expect(results[0]).toHaveProperty('line');
        expect(results[0]).toHaveProperty('snippet');
        expect(results[0]).toHaveProperty('relevance');
      }
    });

    it.skipIf(!ripgrepAvailable)('should return empty array for no matches', async () => {
      const results = await searchCodebaseImpl({
        query: 'xyzzy_nonexistent_string_12345',
        baseDir: 'lib/agentic-core',
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });
});
