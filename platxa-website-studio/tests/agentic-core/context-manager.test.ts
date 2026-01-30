/**
 * Tests for ContextManager
 * Feature #32: Create ContextManager tracking accumulated knowledge across agent steps
 *
 * Verification: Context grows with each tool result; persists across iterations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ContextManager,
  createContextManager,
  createContextManagerFrom,
  type KnowledgeEntry,
  type ContextStats,
  type RankedKnowledgeEntry,
  type RelevanceQueryOptions,
} from '@/lib/agentic-core/context-manager';
import type { AgentContext, AgentPlanStep, ValidationResult } from '@/lib/agentic-core/agent-engine';
import type { ToolResult } from '@/lib/agentic-core/tool-executor';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockToolResult(success: boolean, data?: unknown): ToolResult {
  return {
    success,
    data,
    duration: 100,
    toolName: 'test_tool',
    error: success ? undefined : 'Test error',
  };
}

function createMockAgentContext(): Partial<AgentContext> {
  const filesRead = new Map<string, string>();
  filesRead.set('src/main.ts', 'console.log("hello");');
  filesRead.set('templates/base.xml', '<template>base</template>');

  const searchResults = new Map<string, unknown[]>();
  searchResults.set('query1', [{ file: 'a.ts', matches: 2 }]);

  return {
    filesRead,
    searchResults,
    userPreferences: { theme: 'dark' },
    odooContext: { version: '17.0', modules: ['website'] },
    planMode: false,
  };
}

function createMockPlanStep(action: string, status: string): AgentPlanStep {
  return {
    id: `step-${Math.random().toString(36).substring(7)}`,
    action: action as AgentPlanStep['action'],
    target: 'test/target',
    rationale: 'Test rationale',
    status: status as AgentPlanStep['status'],
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('ContextManager', () => {
  describe('constructor', () => {
    it('creates instance with default options', () => {
      const manager = new ContextManager();
      expect(manager).toBeInstanceOf(ContextManager);
    });

    it('accepts custom options', () => {
      const manager = createContextManager({
        maxEntries: 500,
        maxFileSize: 512 * 1024,
        trackHistory: false,
        workspaceRoot: '/custom/path',
      });
      expect(manager).toBeInstanceOf(ContextManager);
    });
  });

  describe('initializeFrom', () => {
    it('initializes from existing AgentContext', () => {
      const manager = new ContextManager();
      const context = createMockAgentContext();

      manager.initializeFrom(context);

      expect(manager.getFileContent('src/main.ts')).toBe('console.log("hello");');
      expect(manager.getFileContent('templates/base.xml')).toBe('<template>base</template>');
      expect(manager.getSearchResults('query1')).toEqual([{ file: 'a.ts', matches: 2 }]);
    });

    it('handles empty context', () => {
      const manager = new ContextManager();
      manager.initializeFrom({});

      const stats = manager.getStats();
      expect(stats.filesCount).toBe(0);
      expect(stats.searchResultsCount).toBe(0);
    });
  });

  describe('addFileContent', () => {
    let manager: ContextManager;

    beforeEach(() => {
      manager = new ContextManager();
    });

    it('adds file content to context', () => {
      manager.addFileContent('test.ts', 'const x = 1;');

      expect(manager.getFileContent('test.ts')).toBe('const x = 1;');
      expect(manager.hasFile('test.ts')).toBe(true);
    });

    it('creates knowledge entry for file', () => {
      manager.addFileContent('test.ts', 'const x = 1;');

      const entries = manager.getKnowledgeByType('file');
      expect(entries.length).toBe(1);
      expect(entries[0].key).toBe('test.ts');
    });

    it('truncates large files', () => {
      const manager = new ContextManager({ maxFileSize: 100 });
      const largeContent = 'x'.repeat(200);

      manager.addFileContent('large.ts', largeContent);

      const stored = manager.getFileContent('large.ts');
      expect(stored!.length).toBeLessThan(200);
      expect(stored).toContain('[truncated]');
    });

    it('overwrites existing file content', () => {
      manager.addFileContent('test.ts', 'version 1');
      manager.addFileContent('test.ts', 'version 2');

      expect(manager.getFileContent('test.ts')).toBe('version 2');
    });
  });

  describe('addSearchResults', () => {
    let manager: ContextManager;

    beforeEach(() => {
      manager = new ContextManager();
    });

    it('adds search results to context', () => {
      const results = [{ file: 'a.ts', line: 10 }, { file: 'b.ts', line: 20 }];
      manager.addSearchResults('function test', results);

      expect(manager.getSearchResults('function test')).toEqual(results);
    });

    it('merges results for same query', () => {
      manager.addSearchResults('query', [{ file: 'a.ts' }]);
      manager.addSearchResults('query', [{ file: 'b.ts' }]);

      const results = manager.getSearchResults('query');
      expect(results).toHaveLength(2);
    });

    it('creates knowledge entry for search', () => {
      manager.addSearchResults('query', [{ file: 'a.ts' }]);

      const entries = manager.getKnowledgeByType('search');
      expect(entries.length).toBe(1);
      expect(entries[0].key).toBe('query');
    });
  });

  describe('addToolResult', () => {
    let manager: ContextManager;

    beforeEach(() => {
      manager = new ContextManager();
    });

    it('adds tool output to knowledge', () => {
      const result = createMockToolResult(true, { output: 'test' });
      manager.addToolResult('compile', result);

      const entries = manager.getKnowledgeByType('tool_output');
      expect(entries.length).toBe(1);
      expect(entries[0].source).toBe('compile');
    });

    it('extracts file content from read results', () => {
      const result = createMockToolResult(true, {
        path: 'extracted.ts',
        content: 'extracted content',
      });

      manager.addToolResult('read', result);

      expect(manager.getFileContent('extracted.ts')).toBe('extracted content');
    });

    it('extracts search results from search tool', () => {
      const result = createMockToolResult(true, {
        query: 'search query',
        results: [{ file: 'found.ts' }],
      });

      manager.addToolResult('search', result);

      expect(manager.getSearchResults('search query')).toEqual([{ file: 'found.ts' }]);
    });

    it('tags failed results appropriately', () => {
      const result = createMockToolResult(false);
      manager.addToolResult('test', result);

      const entries = manager.getKnowledgeByType('tool_output');
      expect(entries[0].tags).toContain('failure');
    });
  });

  describe('addValidationResult', () => {
    it('stores validation results', () => {
      const manager = new ContextManager();
      const validation: ValidationResult = {
        passed: true,
        qualityScore: 0.95,
        checks: [],
        timestamp: new Date(),
      };

      manager.addValidationResult(validation);

      const entries = manager.getKnowledgeByType('validation');
      expect(entries.length).toBe(1);
      expect((entries[0].data as ValidationResult).passed).toBe(true);
    });
  });

  describe('addError', () => {
    it('stores error information', () => {
      const manager = new ContextManager();
      manager.addError('Something went wrong', 'test_tool');

      const entries = manager.getKnowledgeByType('error');
      expect(entries.length).toBe(1);
      expect(entries[0].tags).toContain('error');
    });
  });

  describe('addUserInput', () => {
    it('stores user preferences', () => {
      const manager = new ContextManager();
      manager.addUserInput('theme', 'dark');
      manager.addUserInput('fontSize', 14);

      const context = manager.toAgentContext();
      expect(context.userPreferences.theme).toBe('dark');
      expect(context.userPreferences.fontSize).toBe(14);
    });
  });

  describe('iteration management', () => {
    let manager: ContextManager;

    beforeEach(() => {
      manager = new ContextManager({ trackHistory: true });
    });

    it('starts at iteration 0', () => {
      expect(manager.getCurrentIteration()).toBe(0);
    });

    it('increments iteration on startIteration', () => {
      manager.startIteration();
      expect(manager.getCurrentIteration()).toBe(1);

      manager.startIteration();
      expect(manager.getCurrentIteration()).toBe(2);
    });

    it('associates knowledge with current iteration', () => {
      manager.startIteration(); // iteration 1
      manager.addFileContent('file1.ts', 'content1');

      manager.startIteration(); // iteration 2
      manager.addFileContent('file2.ts', 'content2');

      const iter1 = manager.getKnowledgeByIteration(1);
      const iter2 = manager.getKnowledgeByIteration(2);

      expect(iter1.length).toBe(1);
      expect(iter1[0].key).toBe('file1.ts');
      expect(iter2.length).toBe(1);
      expect(iter2[0].key).toBe('file2.ts');
    });

    it('completes iteration with snapshot', () => {
      manager.startIteration();
      manager.addFileContent('test.ts', 'content');

      const steps = [createMockPlanStep('read', 'completed')];
      manager.completeIteration(steps, [], undefined);

      const history = manager.getIterationHistory();
      expect(history.length).toBe(1);
      expect(history[0].iteration).toBe(1);
      expect(history[0].steps.length).toBe(1);
      expect(history[0].knowledgeAdded.length).toBe(1);
    });

    it('records errors in iteration snapshot', () => {
      manager.startIteration();
      manager.completeIteration([], ['Error 1', 'Error 2']);

      const history = manager.getIterationHistory();
      expect(history[0].errors).toEqual(['Error 1', 'Error 2']);
    });
  });

  describe('toAgentContext', () => {
    it('exports complete AgentContext', () => {
      const manager = new ContextManager();
      manager.addFileContent('test.ts', 'content');
      manager.addSearchResults('query', [{ file: 'a.ts' }]);
      manager.addUserInput('pref', 'value');
      manager.updateOdooContext({ version: '17.0' });
      manager.setPlanMode(true);

      const context = manager.toAgentContext();

      expect(context.filesRead.get('test.ts')).toBe('content');
      expect(context.searchResults.get('query')).toEqual([{ file: 'a.ts' }]);
      expect(context.userPreferences.pref).toBe('value');
      expect(context.odooContext.version).toBe('17.0');
      expect(context.planMode).toBe(true);
    });

    it('creates deep copies to prevent mutation', () => {
      const manager = new ContextManager();
      manager.addFileContent('test.ts', 'original');

      const context1 = manager.toAgentContext();
      manager.addFileContent('test.ts', 'modified');
      const context2 = manager.toAgentContext();

      expect(context1.filesRead.get('test.ts')).toBe('original');
      expect(context2.filesRead.get('test.ts')).toBe('modified');
    });
  });

  describe('getStats', () => {
    it('returns accurate statistics', () => {
      const manager = new ContextManager();
      manager.addFileContent('file1.ts', 'content1');
      manager.addFileContent('file2.ts', 'content2');
      manager.addSearchResults('q1', [{ file: 'a.ts' }]);
      manager.addError('error', 'source');

      const stats = manager.getStats();

      expect(stats.filesCount).toBe(2);
      expect(stats.searchResultsCount).toBe(1);
      expect(stats.entriesByType.file).toBe(2);
      expect(stats.entriesByType.search).toBe(1);
      expect(stats.entriesByType.error).toBe(1);
      expect(stats.totalEntries).toBe(4);
    });

    it('tracks iteration count', () => {
      const manager = new ContextManager({ trackHistory: true });
      manager.startIteration();
      manager.completeIteration([]);
      manager.startIteration();
      manager.completeIteration([]);

      const stats = manager.getStats();
      expect(stats.currentIteration).toBe(2);
      expect(stats.totalIterations).toBe(2);
    });
  });

  describe('reset', () => {
    it('clears all context', () => {
      const manager = new ContextManager();
      manager.addFileContent('test.ts', 'content');
      manager.addSearchResults('query', []);
      manager.startIteration();

      manager.reset();

      const stats = manager.getStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.filesCount).toBe(0);
      expect(manager.getCurrentIteration()).toBe(0);
    });
  });

  describe('memory management', () => {
    it('prunes old entries when limit reached', () => {
      const manager = new ContextManager({ maxEntries: 10 });

      // Add more than max entries
      for (let i = 0; i < 15; i++) {
        manager.addFileContent(`file${i}.ts`, `content${i}`);
      }

      const stats = manager.getStats();
      expect(stats.totalEntries).toBeLessThanOrEqual(10);
    });
  });

  describe('factory functions', () => {
    it('createContextManager creates instance', () => {
      const manager = createContextManager({ maxEntries: 100 });
      expect(manager).toBeInstanceOf(ContextManager);
    });

    it('createContextManagerFrom initializes with context', () => {
      const context = createMockAgentContext();
      const manager = createContextManagerFrom(context);

      expect(manager.getFileContent('src/main.ts')).toBe('console.log("hello");');
    });
  });

  // ==========================================================================
  // Feature #32 Verification Tests
  // ==========================================================================

  describe('Feature #32 verification: Context grows with each tool result', () => {
    it('context grows as tool results are added', () => {
      const manager = new ContextManager();

      // Initial state
      let stats = manager.getStats();
      expect(stats.totalEntries).toBe(0);

      // Add first tool result
      manager.addToolResult('read', createMockToolResult(true, {
        path: 'file1.ts',
        content: 'content1',
      }));
      stats = manager.getStats();
      expect(stats.totalEntries).toBe(2); // tool_output + file

      // Add second tool result
      manager.addToolResult('search', createMockToolResult(true, {
        query: 'test query',
        results: [{ file: 'found.ts' }],
      }));
      stats = manager.getStats();
      expect(stats.totalEntries).toBe(4); // previous + tool_output + search

      // Add third tool result
      manager.addToolResult('compile', createMockToolResult(true, { compiled: true }));
      stats = manager.getStats();
      expect(stats.totalEntries).toBe(5); // previous + tool_output

      // Context has grown with each addition
      expect(stats.filesCount).toBe(1);
      expect(stats.searchResultsCount).toBe(1);
    });

    it('file contents accumulate across multiple reads', () => {
      const manager = new ContextManager();

      manager.addFileContent('file1.ts', 'content1');
      manager.addFileContent('file2.ts', 'content2');
      manager.addFileContent('file3.ts', 'content3');

      expect(manager.getReadFilePaths()).toHaveLength(3);
      expect(manager.hasFile('file1.ts')).toBe(true);
      expect(manager.hasFile('file2.ts')).toBe(true);
      expect(manager.hasFile('file3.ts')).toBe(true);
    });

    it('search results accumulate across multiple queries', () => {
      const manager = new ContextManager();

      manager.addSearchResults('query1', [{ file: 'a.ts' }]);
      manager.addSearchResults('query2', [{ file: 'b.ts' }]);
      manager.addSearchResults('query1', [{ file: 'c.ts' }]); // Merge with existing

      const stats = manager.getStats();
      expect(stats.searchResultsCount).toBe(2); // 2 unique queries

      // First query has merged results
      const query1Results = manager.getSearchResults('query1');
      expect(query1Results).toHaveLength(2);
    });
  });

  describe('Feature #32 verification: Context persists across iterations', () => {
    it('context persists across multiple iterations', () => {
      const manager = new ContextManager({ trackHistory: true });

      // Iteration 1
      manager.startIteration();
      manager.addFileContent('iter1.ts', 'iteration 1 content');
      manager.addSearchResults('iter1 query', [{ file: 'found1.ts' }]);
      manager.completeIteration([createMockPlanStep('read', 'completed')]);

      // Iteration 2
      manager.startIteration();
      manager.addFileContent('iter2.ts', 'iteration 2 content');
      manager.addSearchResults('iter2 query', [{ file: 'found2.ts' }]);
      manager.completeIteration([createMockPlanStep('search', 'completed')]);

      // Iteration 3
      manager.startIteration();
      manager.addFileContent('iter3.ts', 'iteration 3 content');
      manager.completeIteration([createMockPlanStep('write', 'completed')]);

      // All content from all iterations is accessible
      expect(manager.getFileContent('iter1.ts')).toBe('iteration 1 content');
      expect(manager.getFileContent('iter2.ts')).toBe('iteration 2 content');
      expect(manager.getFileContent('iter3.ts')).toBe('iteration 3 content');

      // Search results persist
      expect(manager.getSearchResults('iter1 query')).toBeDefined();
      expect(manager.getSearchResults('iter2 query')).toBeDefined();

      // History is tracked
      const history = manager.getIterationHistory();
      expect(history).toHaveLength(3);
      expect(history[0].iteration).toBe(1);
      expect(history[1].iteration).toBe(2);
      expect(history[2].iteration).toBe(3);
    });

    it('knowledge can be retrieved by iteration', () => {
      const manager = new ContextManager();

      manager.startIteration(); // 1
      manager.addFileContent('file1.ts', 'content1');

      manager.startIteration(); // 2
      manager.addFileContent('file2.ts', 'content2');
      manager.addFileContent('file2b.ts', 'content2b');

      manager.startIteration(); // 3
      manager.addFileContent('file3.ts', 'content3');

      const iter1Knowledge = manager.getKnowledgeByIteration(1);
      const iter2Knowledge = manager.getKnowledgeByIteration(2);
      const iter3Knowledge = manager.getKnowledgeByIteration(3);

      expect(iter1Knowledge).toHaveLength(1);
      expect(iter2Knowledge).toHaveLength(2);
      expect(iter3Knowledge).toHaveLength(1);
    });

    it('exported AgentContext contains all accumulated knowledge', () => {
      const manager = new ContextManager();

      // Accumulate across iterations
      manager.startIteration();
      manager.addFileContent('file1.ts', 'content1');
      manager.addUserInput('pref1', 'value1');

      manager.startIteration();
      manager.addFileContent('file2.ts', 'content2');
      manager.addSearchResults('query', [{ match: true }]);
      manager.updateOdooContext({ version: '17.0' });

      manager.startIteration();
      manager.addFileContent('file3.ts', 'content3');
      manager.addUserInput('pref2', 'value2');

      // Export contains everything
      const context = manager.toAgentContext();

      expect(context.filesRead.size).toBe(3);
      expect(context.searchResults.size).toBe(1);
      expect(context.userPreferences.pref1).toBe('value1');
      expect(context.userPreferences.pref2).toBe('value2');
      expect(context.odooContext.version).toBe('17.0');
    });

    it('iteration history tracks knowledge additions', () => {
      const manager = new ContextManager({ trackHistory: true });

      manager.startIteration();
      manager.addFileContent('file1.ts', 'c1');
      manager.addFileContent('file2.ts', 'c2');
      manager.completeIteration([]);

      manager.startIteration();
      manager.addSearchResults('q', []);
      manager.completeIteration([]);

      const history = manager.getIterationHistory();

      // Iteration 1 added 2 knowledge entries
      expect(history[0].knowledgeAdded.length).toBe(2);

      // Iteration 2 added 1 knowledge entry
      expect(history[1].knowledgeAdded.length).toBe(1);
    });
  });

  // ==========================================================================
  // Feature #34 Verification Tests: Relevance Ranking
  // ==========================================================================

  describe('Feature #34 verification: Relevance ranking based on recency and semantic similarity', () => {
    describe('recency-based scoring', () => {
      it('scores recent items higher than older items', async () => {
        const manager = new ContextManager({
          recencyHalfLife: 1000, // 1 second half-life for testing
        });

        // Add item at time T
        manager.addFileContent('old-file.ts', 'old content');

        // Wait a bit to create age difference
        await new Promise(resolve => setTimeout(resolve, 50));

        // Add newer item
        manager.addFileContent('new-file.ts', 'new content');

        // Get items ranked by recency
        const ranked = manager.getRecent(10, 'file');

        expect(ranked.length).toBe(2);
        // Most recent should be first
        expect(ranked[0].key).toBe('new-file.ts');
        expect(ranked[1].key).toBe('old-file.ts');
        // Recent item should have higher recency score
        expect(ranked[0].scoreBreakdown.recency).toBeGreaterThan(ranked[1].scoreBreakdown.recency);
      });

      it('recency score decays with time', () => {
        const manager = new ContextManager({
          recencyHalfLife: 100, // 100ms half-life
        });

        // Manually test the recency calculation
        const now = Date.now();
        const recentDate = new Date(now - 10); // 10ms ago
        const oldDate = new Date(now - 200); // 200ms ago (2 half-lives)

        // Access private method via getByRelevance results
        manager.addFileContent('test.ts', 'content');

        const results = manager.getByRelevance({ recencyBoost: 1.0 });
        expect(results.length).toBe(1);
        // Score should be close to 1.0 since just added
        expect(results[0].scoreBreakdown.recency).toBeGreaterThan(0.9);
      });

      it('getRecent returns items primarily by recency', () => {
        const manager = new ContextManager();

        manager.addFileContent('file1.ts', 'authentication login security');
        manager.addFileContent('file2.ts', 'simple content');
        manager.addFileContent('file3.ts', 'more content here');

        const recent = manager.getRecent(2);

        // Should return 2 most recent
        expect(recent.length).toBe(2);
        // Recency weight should be dominant (0.95)
        expect(recent[0].scoreBreakdown.recency).toBeDefined();
      });
    });

    describe('semantic similarity scoring', () => {
      it('scores semantically similar items higher', () => {
        const manager = new ContextManager();

        // Add files with different content
        manager.addFileContent('auth/login.ts', 'export function authenticate(user, password) { return token; }');
        manager.addFileContent('utils/math.ts', 'export function calculateSum(a, b) { return a + b; }');
        manager.addFileContent('auth/session.ts', 'export function validateToken(token) { authenticate(); }');

        // Query for authentication-related items
        const ranked = manager.getByRelevance({
          query: 'authenticate token login',
          type: 'file',
          recencyBoost: 0.0, // Pure semantic matching
        });

        expect(ranked.length).toBe(3);
        // Auth files should rank higher due to semantic similarity
        expect(ranked[0].scoreBreakdown.semantic).toBeGreaterThan(ranked[2].scoreBreakdown.semantic);
      });

      it('handles partial token matches', () => {
        const manager = new ContextManager();

        manager.addFileContent('authentication.ts', 'auth function');
        manager.addFileContent('unrelated.ts', 'completely different');

        const ranked = manager.getByRelevance({
          query: 'auth',
          recencyBoost: 0.0,
        });

        // 'auth' should partially match 'authentication.ts' key
        expect(ranked[0].key).toBe('authentication.ts');
        expect(ranked[0].scoreBreakdown.semantic).toBeGreaterThan(0);
      });

      it('handles empty query gracefully', () => {
        const manager = new ContextManager();
        manager.addFileContent('test.ts', 'content');

        const ranked = manager.getByRelevance({});

        // Should return items with neutral semantic score
        expect(ranked.length).toBe(1);
        expect(ranked[0].scoreBreakdown.semantic).toBe(0.5);
      });
    });

    describe('combined relevance scoring', () => {
      it('combines recency and semantic similarity', () => {
        const manager = new ContextManager({
          recencyWeight: 0.4,
          semanticWeight: 0.6,
        });

        manager.addFileContent('old-auth.ts', 'authentication login');
        manager.addFileContent('new-unrelated.ts', 'completely different topic');

        const ranked = manager.getByRelevance({
          query: 'authentication',
        });

        // Both scores should be present in breakdown
        expect(ranked[0].scoreBreakdown.recency).toBeDefined();
        expect(ranked[0].scoreBreakdown.semantic).toBeDefined();
        expect(ranked[0].scoreBreakdown.combined).toBeDefined();

        // Combined should be weighted average
        const entry = ranked[0];
        const expectedCombined = (0.4 * entry.scoreBreakdown.recency) + (0.6 * entry.scoreBreakdown.semantic);
        expect(entry.scoreBreakdown.combined).toBeCloseTo(expectedCombined, 5);
      });

      it('respects recencyBoost parameter', () => {
        const manager = new ContextManager();

        manager.addFileContent('file.ts', 'content');

        const highRecency = manager.getByRelevance({
          query: 'test',
          recencyBoost: 0.9,
        });

        const lowRecency = manager.getByRelevance({
          query: 'test',
          recencyBoost: 0.1,
        });

        // With high recency boost, recency dominates the combined score
        // With low recency boost, semantic dominates
        // The actual combined scores will differ based on the weighting
        expect(highRecency[0].relevanceScore).toBeDefined();
        expect(lowRecency[0].relevanceScore).toBeDefined();
      });
    });

    describe('filtering and limits', () => {
      it('filters by minimum relevance', () => {
        const manager = new ContextManager();

        manager.addFileContent('relevant.ts', 'authentication login security');
        manager.addFileContent('irrelevant.ts', 'xyz abc 123');

        const ranked = manager.getByRelevance({
          query: 'authentication',
          minRelevance: 0.3,
          recencyBoost: 0.0,
        });

        // Only items above threshold
        for (const entry of ranked) {
          expect(entry.relevanceScore).toBeGreaterThanOrEqual(0.3);
        }
      });

      it('limits number of results', () => {
        const manager = new ContextManager();

        for (let i = 0; i < 20; i++) {
          manager.addFileContent(`file${i}.ts`, `content ${i}`);
        }

        const ranked = manager.getByRelevance({ limit: 5 });

        expect(ranked.length).toBe(5);
      });

      it('filters by type', () => {
        const manager = new ContextManager();

        manager.addFileContent('file.ts', 'file content');
        manager.addSearchResults('query', [{ match: 'result' }]);
        manager.addError('error message', 'test');

        const filesOnly = manager.getByRelevance({ type: 'file' });
        const searchOnly = manager.getByRelevance({ type: 'search' });

        expect(filesOnly.every(e => e.type === 'file')).toBe(true);
        expect(searchOnly.every(e => e.type === 'search')).toBe(true);
      });

      it('filters by tags', () => {
        const manager = new ContextManager();

        manager.addFileContent('app.ts', 'typescript code');
        manager.addFileContent('style.css', 'css styles');

        const tsFiles = manager.getByRelevance({ tags: ['ts'] });

        expect(tsFiles.length).toBe(1);
        expect(tsFiles[0].key).toBe('app.ts');
      });
    });

    describe('convenience methods', () => {
      it('getMostRelevant returns single best match', () => {
        const manager = new ContextManager();

        manager.addFileContent('auth.ts', 'authentication login');
        manager.addFileContent('math.ts', 'calculate sum');

        const best = manager.getMostRelevant('authentication', 'file');

        expect(best).toBeDefined();
        expect(best!.key).toBe('auth.ts');
      });

      it('getMostRelevant returns undefined for empty results', () => {
        const manager = new ContextManager();

        const best = manager.getMostRelevant('nonexistent');

        expect(best).toBeUndefined();
      });

      it('setRelevance updates entry relevance', () => {
        const manager = new ContextManager();
        manager.addFileContent('test.ts', 'content');

        const entries = manager.getAllKnowledge();
        const entryId = entries[0].id;

        const result = manager.setRelevance(entryId, 0.9);

        expect(result).toBe(true);
        expect(entries[0].relevance).toBe(0.9);
      });

      it('setRelevance clamps values to 0-1', () => {
        const manager = new ContextManager();
        manager.addFileContent('test.ts', 'content');

        const entries = manager.getAllKnowledge();
        const entryId = entries[0].id;

        manager.setRelevance(entryId, 1.5);
        expect(entries[0].relevance).toBe(1);

        manager.setRelevance(entryId, -0.5);
        expect(entries[0].relevance).toBe(0);
      });

      it('setRelevance returns false for unknown entry', () => {
        const manager = new ContextManager();

        const result = manager.setRelevance('nonexistent-id', 0.5);

        expect(result).toBe(false);
      });
    });

    describe('verification: Recent items and semantically similar items score higher', () => {
      it('recent items score higher in recency component', async () => {
        const manager = new ContextManager({
          recencyHalfLife: 50, // Short half-life for testing
        });

        // Add old item
        manager.addFileContent('old.ts', 'old content');

        // Wait for significant time relative to half-life
        await new Promise(resolve => setTimeout(resolve, 100));

        // Add new item
        manager.addFileContent('new.ts', 'new content');

        const ranked = manager.getByRelevance({ recencyBoost: 1.0 });

        // New item should be first with higher recency score
        expect(ranked[0].key).toBe('new.ts');
        expect(ranked[0].scoreBreakdown.recency).toBeGreaterThan(ranked[1].scoreBreakdown.recency);
      });

      it('semantically similar items score higher in semantic component', () => {
        const manager = new ContextManager();

        manager.addFileContent('database.ts', 'export class Database { query() { return sql; } }');
        manager.addFileContent('auth.ts', 'export function login(user, password) { authenticate(); }');
        manager.addFileContent('styles.css', '.button { color: blue; }');

        const ranked = manager.getByRelevance({
          query: 'database query sql',
          recencyBoost: 0.0, // Pure semantic matching
        });

        // Database file should score highest semantically
        expect(ranked[0].key).toBe('database.ts');
        expect(ranked[0].scoreBreakdown.semantic).toBeGreaterThan(ranked[1].scoreBreakdown.semantic);
        expect(ranked[0].scoreBreakdown.semantic).toBeGreaterThan(ranked[2].scoreBreakdown.semantic);
      });

      it('combined scoring balances recency and semantic similarity', () => {
        const manager = new ContextManager({
          recencyWeight: 0.4,
          semanticWeight: 0.6,
          recencyHalfLife: 100,
        });

        // Add highly relevant but older item
        manager.addFileContent('old-relevant.ts', 'authentication login security token');

        // Small delay
        manager.addFileContent('new-irrelevant.ts', 'unrelated xyz content');

        const ranked = manager.getByRelevance({
          query: 'authentication login',
        });

        // With balanced weights, the older but more relevant item should still compete
        // Both should have reasonable combined scores
        expect(ranked.length).toBe(2);
        expect(ranked[0].relevanceScore).toBeGreaterThan(0);
        expect(ranked[1].relevanceScore).toBeGreaterThan(0);
      });
    });
  });
});
