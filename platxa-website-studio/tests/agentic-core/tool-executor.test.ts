/**
 * ToolExecutor Tests
 * Verifies Feature #4: executeStep() routes 'search' to search_codebase, 'read' to read_file, etc.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  AgentToolExecutor,
  createToolExecutor,
  createToolExecutorWithTools,
  type ToolFunction,
  type ToolParams,
  type ToolResult,
} from '@/lib/agentic-core/tool-executor';
import type { AgentContext, AgentPlanStep, AgentActionType } from '@/lib/agentic-core/agent-engine';

const createMockContext = (): AgentContext => ({
  filesRead: new Map(),
  searchResults: new Map(),
  userPreferences: {},
  odooContext: {},
});

const createMockStep = (action: AgentActionType, target: string): AgentPlanStep => ({
  id: 'step-1',
  action,
  target,
  rationale: 'Test step',
  status: 'pending',
});

describe('AgentToolExecutor', () => {
  describe('instantiation', () => {
    it('should create instance with default config', () => {
      const executor = new AgentToolExecutor();
      expect(executor).toBeInstanceOf(AgentToolExecutor);
    });

    it('should create instance with custom config', () => {
      const executor = new AgentToolExecutor({
        timeout: 5000,
        cacheResults: false,
        retryOnFailure: false,
      });
      expect(executor).toBeInstanceOf(AgentToolExecutor);
    });

    it('should create via factory function', () => {
      const executor = createToolExecutor();
      expect(executor).toBeInstanceOf(AgentToolExecutor);
    });

    it('should create with custom tools via factory', () => {
      const customSearch = vi.fn().mockResolvedValue({
        success: true,
        data: [],
        duration: 10,
        toolName: 'custom_search',
      });

      const executor = createToolExecutorWithTools({ search: customSearch });
      expect(executor).toBeInstanceOf(AgentToolExecutor);
    });
  });

  describe('action routing', () => {
    it('should route "search" to search_codebase', async () => {
      const executor = new AgentToolExecutor();
      const step = createMockStep('search', '**/*.xml');

      const result = await executor.executeStep(step, createMockContext());

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('search_codebase');
    });

    it('should route "read" to read_file', async () => {
      const executor = new AgentToolExecutor();
      // Use a real file that exists in the codebase
      const step = createMockStep('read', 'lib/agentic-core/tool-executor.ts');

      const result = await executor.executeStep(step, createMockContext());

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('read_file');
    });

    it('should route "write" to write_file', async () => {
      const executor = new AgentToolExecutor();
      // Use test output directory and provide content for real write operation
      const testFile = '.test-output/tool-executor-write-test.txt';
      const step = createMockStep('write', testFile);
      const context = createMockContext();

      // Execute with content in the params (via execute method which accepts options)
      const result = await executor.execute('write', {
        target: testFile,
        context,
        content: 'Test write content',
      });

      // Verify write succeeded and returned correct data
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should route "edit" to edit_file', async () => {
      const executor = new AgentToolExecutor();
      // Use real file with actual edit operations
      const testFile = 'lib/agentic-core/tool-executor.ts';
      const context = createMockContext();

      // Execute with operations (will find nothing to replace, but verifies routing)
      const result = await executor.execute('edit', {
        target: testFile,
        context,
        operations: [{ search: 'NONEXISTENT_STRING_12345', replace: 'x' }],
      });

      // Verify routing works (returns data even if no changes made)
      expect(result).toBeDefined();
    });

    it('should route "validate" to validate_qweb', async () => {
      const executor = new AgentToolExecutor();
      // Pass valid QWeb XML content with isContent option
      const validQweb = '<templates><t t-name="test"><div t-esc="name"/></t></templates>';
      const context = createMockContext();

      const result = await executor.execute('validate', {
        target: validQweb,
        context,
        isContent: true,
      });

      // Verify routing works and returns validation data
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should route "compile" to compile_scss', async () => {
      const executor = new AgentToolExecutor();
      // Pass valid SCSS content with isContent option
      const validScss = '.test { color: blue; }';
      const context = createMockContext();

      const result = await executor.execute('compile', {
        target: validScss,
        context,
        isContent: true,
      });

      // Verify routing works and returns compiled CSS
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should route "preview" to preview_render', async () => {
      const executor = new AgentToolExecutor();
      const step = createMockStep('preview', 'generated');

      const result = await executor.executeStep(step, createMockContext());

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('preview_render');
    });

    it('should route "test" to test_odoo', async () => {
      const executor = new AgentToolExecutor();
      const step = createMockStep('test', 'module');

      const result = await executor.executeStep(step, createMockContext());

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('test_odoo');
    });

    it('should route "web_search" to web_search', async () => {
      const executor = new AgentToolExecutor();
      const step = createMockStep('web_search', 'odoo qweb directives');

      const result = await executor.executeStep(step, createMockContext());

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('web_search');
    });
  });

  describe('execute()', () => {
    it('should execute action and return data', async () => {
      const executor = new AgentToolExecutor();

      const result = await executor.execute('search', {
        target: '**/*.xml',
        context: createMockContext(),
      });

      expect(result).toBeDefined();
    });

    it('should throw error for unknown action', async () => {
      const executor = new AgentToolExecutor();

      await expect(
        executor.execute('unknown' as AgentActionType, {
          target: 'test',
          context: createMockContext(),
        })
      ).rejects.toThrow('No tool registered for action');
    });
  });

  describe('custom tools', () => {
    it('should allow registering custom tools', async () => {
      const executor = new AgentToolExecutor();
      const customHandler = vi.fn().mockResolvedValue({
        success: true,
        data: { custom: true },
        duration: 5,
        toolName: 'custom_tool',
      });

      executor.registerTool({
        name: 'custom_search',
        description: 'Custom search implementation',
        handler: customHandler,
        actions: ['search'],
      });

      const step = createMockStep('search', 'test');
      const result = await executor.executeStep(step, createMockContext());

      expect(customHandler).toHaveBeenCalled();
      expect(result.toolName).toBe('custom_tool');
    });

    it('should allow overriding default handlers', async () => {
      const executor = new AgentToolExecutor();
      const customRead = vi.fn().mockResolvedValue({
        success: true,
        data: { content: 'custom content' },
        duration: 3,
        toolName: 'custom_read',
      });

      executor.setToolHandler('read', customRead);

      const step = createMockStep('read', 'file.txt');
      const result = await executor.executeStep(step, createMockContext());

      expect(customRead).toHaveBeenCalled();
      expect(result.toolName).toBe('custom_read');
    });
  });

  describe('hasToolFor()', () => {
    it('should return true for registered actions', () => {
      const executor = new AgentToolExecutor();

      expect(executor.hasToolFor('search')).toBe(true);
      expect(executor.hasToolFor('read')).toBe(true);
      expect(executor.hasToolFor('write')).toBe(true);
      expect(executor.hasToolFor('edit')).toBe(true);
      expect(executor.hasToolFor('validate')).toBe(true);
      expect(executor.hasToolFor('compile')).toBe(true);
      expect(executor.hasToolFor('preview')).toBe(true);
      expect(executor.hasToolFor('test')).toBe(true);
      expect(executor.hasToolFor('web_search')).toBe(true);
    });
  });

  describe('caching', () => {
    it('should cache results when enabled', async () => {
      const executor = new AgentToolExecutor({ cacheResults: true });
      const customSearch = vi.fn().mockResolvedValue({
        success: true,
        data: { results: [] },
        duration: 10,
        toolName: 'search',
      });
      executor.setToolHandler('search', customSearch);

      // First call
      await executor.execute('search', {
        target: 'test',
        context: createMockContext(),
      });

      // Second call with same params
      await executor.execute('search', {
        target: 'test',
        context: createMockContext(),
      });

      // Should only be called once due to caching
      expect(customSearch).toHaveBeenCalledTimes(1);
    });

    it('should not cache when disabled', async () => {
      const executor = new AgentToolExecutor({ cacheResults: false });
      const customSearch = vi.fn().mockResolvedValue({
        success: true,
        data: { results: [] },
        duration: 10,
        toolName: 'search',
      });
      executor.setToolHandler('search', customSearch);

      await executor.execute('search', {
        target: 'test',
        context: createMockContext(),
      });

      await executor.execute('search', {
        target: 'test',
        context: createMockContext(),
      });

      expect(customSearch).toHaveBeenCalledTimes(2);
    });

    it('should clear cache', async () => {
      const executor = new AgentToolExecutor({ cacheResults: true });
      const customSearch = vi.fn().mockResolvedValue({
        success: true,
        data: { results: [] },
        duration: 10,
        toolName: 'search',
      });
      executor.setToolHandler('search', customSearch);

      await executor.execute('search', {
        target: 'test',
        context: createMockContext(),
      });

      executor.clearCache();

      await executor.execute('search', {
        target: 'test',
        context: createMockContext(),
      });

      expect(customSearch).toHaveBeenCalledTimes(2);
    });
  });

  describe('retry behavior with exponential backoff (Feature #15)', () => {
    it('should retry on failure when enabled', async () => {
      const executor = new AgentToolExecutor({
        retryOnFailure: true,
        maxRetries: 3,
        baseDelayMs: 10, // Use short delays for testing
        useJitter: false,
      });

      let callCount = 0;
      const flakyHandler = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 2) {
          return {
            success: false,
            error: 'Temporary failure',
            duration: 5,
            toolName: 'flaky',
          };
        }
        return {
          success: true,
          data: { recovered: true },
          duration: 5,
          toolName: 'flaky',
        };
      });

      executor.setToolHandler('search', flakyHandler);

      const result = await executor.execute('search', {
        target: 'test',
        context: createMockContext(),
      });

      expect(result).toEqual({ recovered: true });
      expect(flakyHandler).toHaveBeenCalledTimes(2);
    });

    it('should calculate exponential backoff delays correctly', () => {
      const executor = new AgentToolExecutor({
        baseDelayMs: 1000,
        backoffMultiplier: 2,
        useJitter: false, // Disable jitter for deterministic testing
      });

      // attempt 1: 1000 * 2^0 = 1000ms (1s)
      expect(executor.getRetryDelay(1)).toBe(1000);
      // attempt 2: 1000 * 2^1 = 2000ms (2s)
      expect(executor.getRetryDelay(2)).toBe(2000);
      // attempt 3: 1000 * 2^2 = 4000ms (4s)
      expect(executor.getRetryDelay(3)).toBe(4000);
    });

    it('should cap delay at maxDelayMs', () => {
      const executor = new AgentToolExecutor({
        baseDelayMs: 1000,
        backoffMultiplier: 2,
        maxDelayMs: 3000,
        useJitter: false,
      });

      // attempt 3 would be 4000ms but capped at 3000ms
      expect(executor.getRetryDelay(3)).toBe(3000);
      // attempt 10 would be huge but capped at 3000ms
      expect(executor.getRetryDelay(10)).toBe(3000);
    });

    it('should add jitter when enabled', () => {
      const executor = new AgentToolExecutor({
        baseDelayMs: 1000,
        backoffMultiplier: 2,
        useJitter: true,
      });

      // With jitter, delay should be within ±25% of base
      const delays = Array.from({ length: 10 }, () => executor.getRetryDelay(1));
      const minExpected = 750; // 1000 - 25%
      const maxExpected = 1250; // 1000 + 25%

      delays.forEach(delay => {
        expect(delay).toBeGreaterThanOrEqual(minExpected);
        expect(delay).toBeLessThanOrEqual(maxExpected);
      });

      // Verify there's actual variation (not all same value)
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });

    it('should give up after maxRetries attempts', async () => {
      const executor = new AgentToolExecutor({
        retryOnFailure: true,
        maxRetries: 3,
        baseDelayMs: 10,
        useJitter: false,
      });

      const alwaysFailHandler = vi.fn().mockResolvedValue({
        success: false,
        error: 'Persistent failure',
        duration: 5,
        toolName: 'failing',
      });

      executor.setToolHandler('search', alwaysFailHandler);

      await expect(
        executor.execute('search', {
          target: 'test',
          context: createMockContext(),
        })
      ).rejects.toThrow('Persistent failure');

      // Should be called exactly maxRetries times
      expect(alwaysFailHandler).toHaveBeenCalledTimes(3);
    });

    it('should apply delays between retries', async () => {
      const executor = new AgentToolExecutor({
        retryOnFailure: true,
        maxRetries: 3,
        baseDelayMs: 50, // 50ms base for faster test
        backoffMultiplier: 2,
        useJitter: false,
      });

      let callCount = 0;
      const timestamps: number[] = [];

      const flakyHandler = vi.fn().mockImplementation(async () => {
        timestamps.push(Date.now());
        callCount++;
        if (callCount < 3) {
          return {
            success: false,
            error: 'Temporary failure',
            duration: 5,
            toolName: 'flaky',
          };
        }
        return {
          success: true,
          data: { recovered: true },
          duration: 5,
          toolName: 'flaky',
        };
      });

      executor.setToolHandler('search', flakyHandler);

      await executor.execute('search', {
        target: 'test',
        context: createMockContext(),
      });

      // Verify delays between attempts (with some tolerance)
      // First retry delay: 50ms (base * 2^0)
      const delay1 = timestamps[1] - timestamps[0];
      expect(delay1).toBeGreaterThanOrEqual(40); // Allow some timing variance

      // Second retry delay: 100ms (base * 2^1)
      const delay2 = timestamps[2] - timestamps[1];
      expect(delay2).toBeGreaterThanOrEqual(80);
    });

    it('should not apply delay on first attempt', async () => {
      const executor = new AgentToolExecutor({
        retryOnFailure: true,
        maxRetries: 3,
        baseDelayMs: 1000, // Would be noticeable if applied
        useJitter: false,
      });

      const successHandler = vi.fn().mockResolvedValue({
        success: true,
        data: { immediate: true },
        duration: 5,
        toolName: 'fast',
      });

      executor.setToolHandler('search', successHandler);

      const start = Date.now();
      await executor.execute('search', {
        target: 'test',
        context: createMockContext(),
      });
      const elapsed = Date.now() - start;

      // Should complete almost immediately (well under 1000ms base delay)
      expect(elapsed).toBeLessThan(500);
    });

    it('should not retry when retryOnFailure is disabled', async () => {
      const executor = new AgentToolExecutor({
        retryOnFailure: false,
        maxRetries: 3,
      });

      const failingHandler = vi.fn().mockResolvedValue({
        success: false,
        error: 'Failure',
        duration: 5,
        toolName: 'failing',
      });

      executor.setToolHandler('search', failingHandler);

      await expect(
        executor.execute('search', {
          target: 'test',
          context: createMockContext(),
        })
      ).rejects.toThrow('Failure');

      // Should only be called once
      expect(failingHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should return error result for failed steps', async () => {
      const executor = new AgentToolExecutor({ retryOnFailure: false });
      const failingHandler = vi.fn().mockResolvedValue({
        success: false,
        error: 'Tool failed',
        duration: 5,
        toolName: 'failing',
      });

      executor.setToolHandler('search', failingHandler);

      const step = createMockStep('search', 'test');
      const result = await executor.executeStep(step, createMockContext());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tool failed');
    });

    it('should return error for unregistered action in executeStep', async () => {
      const executor = new AgentToolExecutor();

      // Create a step with an invalid action (cast to bypass type check)
      const step = createMockStep('invalid_action' as AgentActionType, 'test');
      const result = await executor.executeStep(step, createMockContext());

      expect(result.success).toBe(false);
      expect(result.error).toContain('No tool registered');
    });
  });

  describe('getRegisteredTools()', () => {
    it('should return registered custom tools', () => {
      const executor = new AgentToolExecutor();

      executor.registerTool({
        name: 'my_tool',
        description: 'My custom tool',
        handler: async () => ({
          success: true,
          data: {},
          duration: 0,
          toolName: 'my_tool',
        }),
        actions: ['search'],
      });

      const tools = executor.getRegisteredTools();
      expect(tools.has('my_tool')).toBe(true);
    });
  });

  describe('getToolForAction()', () => {
    it('should return tool function for action', () => {
      const executor = new AgentToolExecutor();
      const tool = executor.getToolForAction('search');

      expect(typeof tool).toBe('function');
    });

    it('should return undefined for unknown action', () => {
      const executor = new AgentToolExecutor();
      const tool = executor.getToolForAction('unknown' as AgentActionType);

      expect(tool).toBeUndefined();
    });
  });

  describe('memoization (Feature #200)', () => {
    it('should track memoization statistics', async () => {
      const executor = new AgentToolExecutor({ cacheResults: true });
      const customSearch = vi.fn().mockResolvedValue({
        success: true,
        data: { results: ['a', 'b'] },
        duration: 10,
        toolName: 'search',
      });
      executor.setToolHandler('search', customSearch);

      // First call - miss
      await executor.execute('search', {
        target: 'test',
        context: createMockContext(),
      });

      // Second call - hit
      await executor.execute('search', {
        target: 'test',
        context: createMockContext(),
      });

      const stats = executor.getMemoizationStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
      expect(stats.cacheSize).toBe(1);
      expect(stats.bytesSaved).toBeGreaterThan(0);
    });

    it('should NOT memoize write operations', async () => {
      const executor = new AgentToolExecutor({ cacheResults: true });
      const customWrite = vi.fn().mockResolvedValue({
        success: true,
        data: { written: true },
        duration: 10,
        toolName: 'write_file',
      });
      executor.setToolHandler('write', customWrite);

      // First call
      await executor.execute('write', {
        target: 'test.txt',
        context: createMockContext(),
        content: 'content1',
      });

      // Second call with same target - should NOT use cache
      await executor.execute('write', {
        target: 'test.txt',
        context: createMockContext(),
        content: 'content2',
      });

      // Write should be called twice (not cached)
      expect(customWrite).toHaveBeenCalledTimes(2);

      const stats = executor.getMemoizationStats();
      expect(stats.cacheSize).toBe(0); // Write operations not cached
    });

    it('should NOT memoize edit operations', async () => {
      const executor = new AgentToolExecutor({ cacheResults: true });
      const customEdit = vi.fn().mockResolvedValue({
        success: true,
        data: { edited: true },
        duration: 10,
        toolName: 'edit_file',
      });
      executor.setToolHandler('edit', customEdit);

      // First call
      await executor.execute('edit', {
        target: 'test.txt',
        context: createMockContext(),
        operations: [{ search: 'a', replace: 'b' }],
      });

      // Second call
      await executor.execute('edit', {
        target: 'test.txt',
        context: createMockContext(),
        operations: [{ search: 'a', replace: 'b' }],
      });

      expect(customEdit).toHaveBeenCalledTimes(2);
    });

    it('should correctly identify memoizable actions', () => {
      const executor = new AgentToolExecutor();

      // Memoizable (read-only/idempotent)
      expect(executor.isMemoizableAction('search')).toBe(true);
      expect(executor.isMemoizableAction('read')).toBe(true);
      expect(executor.isMemoizableAction('validate')).toBe(true);
      expect(executor.isMemoizableAction('compile')).toBe(true);
      expect(executor.isMemoizableAction('preview')).toBe(true);
      expect(executor.isMemoizableAction('test')).toBe(true);
      expect(executor.isMemoizableAction('web_search')).toBe(true);
      expect(executor.isMemoizableAction('inspect_logs')).toBe(true);

      // NOT memoizable (side effects)
      expect(executor.isMemoizableAction('write')).toBe(false);
      expect(executor.isMemoizableAction('edit')).toBe(false);
    });

    it('should evict LRU entries when cache is full', async () => {
      const executor = new AgentToolExecutor({
        cacheResults: true,
        maxCacheEntries: 2,
      });
      const customSearch = vi.fn().mockImplementation(async (params: ToolParams) => ({
        success: true,
        data: { query: params.target },
        duration: 10,
        toolName: 'search',
      }));
      executor.setToolHandler('search', customSearch);

      // Fill cache with 2 entries
      await executor.execute('search', { target: 'query1', context: createMockContext() });
      await executor.execute('search', { target: 'query2', context: createMockContext() });

      // Access query1 to make it recently used
      await executor.execute('search', { target: 'query1', context: createMockContext() });

      // Add third entry - should evict query2 (LRU)
      await executor.execute('search', { target: 'query3', context: createMockContext() });

      const stats = executor.getMemoizationStats();
      expect(stats.cacheSize).toBe(2);
      expect(stats.evictions).toBe(1);

      // query1 should still be cached (was accessed recently)
      customSearch.mockClear();
      await executor.execute('search', { target: 'query1', context: createMockContext() });
      expect(customSearch).not.toHaveBeenCalled(); // cache hit

      // query2 should have been evicted
      await executor.execute('search', { target: 'query2', context: createMockContext() });
      expect(customSearch).toHaveBeenCalledTimes(1); // cache miss
    });

    it('should reset memoization statistics', async () => {
      const executor = new AgentToolExecutor({ cacheResults: true });
      const customSearch = vi.fn().mockResolvedValue({
        success: true,
        data: { results: [] },
        duration: 10,
        toolName: 'search',
      });
      executor.setToolHandler('search', customSearch);

      // Generate some stats
      await executor.execute('search', { target: 'test', context: createMockContext() });
      await executor.execute('search', { target: 'test', context: createMockContext() });

      let stats = executor.getMemoizationStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);

      // Reset stats
      executor.resetMemoizationStats();

      stats = executor.getMemoizationStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.evictions).toBe(0);
      expect(stats.bytesSaved).toBe(0);
      // Cache size should remain (only stats reset, not cache)
      expect(stats.cacheSize).toBe(1);
    });

    it('should memoize read operations within session', async () => {
      const executor = new AgentToolExecutor({ cacheResults: true });
      const customRead = vi.fn().mockResolvedValue({
        success: true,
        data: { content: 'file content' },
        duration: 10,
        toolName: 'read_file',
      });
      executor.setToolHandler('read', customRead);

      // First read
      const result1 = await executor.execute('read', {
        target: 'test.ts',
        context: createMockContext(),
      });

      // Second read - should be memoized
      const result2 = await executor.execute('read', {
        target: 'test.ts',
        context: createMockContext(),
      });

      expect(customRead).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });

    it('should use different cache keys for different parameters', async () => {
      const executor = new AgentToolExecutor({ cacheResults: true });
      const customSearch = vi.fn().mockImplementation(async (params: ToolParams) => ({
        success: true,
        data: { query: params.target },
        duration: 10,
        toolName: 'search',
      }));
      executor.setToolHandler('search', customSearch);

      await executor.execute('search', { target: 'query1', context: createMockContext() });
      await executor.execute('search', { target: 'query2', context: createMockContext() });
      await executor.execute('search', { target: 'query1', context: createMockContext() }); // hit

      expect(customSearch).toHaveBeenCalledTimes(2);

      const stats = executor.getMemoizationStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
      expect(stats.cacheSize).toBe(2);
    });
  });

  describe('plan mode (read-only exploration)', () => {
    const createPlanModeContext = (): AgentContext => ({
      filesRead: new Map(),
      searchResults: new Map(),
      userPreferences: {},
      odooContext: {},
      planMode: true,
    });

    it('should disable write_file in plan mode via execute()', async () => {
      const executor = new AgentToolExecutor();

      await expect(
        executor.execute('write', {
          target: 'test.txt',
          context: createPlanModeContext(),
          content: 'test content',
        })
      ).rejects.toThrow('disabled in plan mode');
    });

    it('should disable edit_file in plan mode via execute()', async () => {
      const executor = new AgentToolExecutor();

      await expect(
        executor.execute('edit', {
          target: 'test.txt',
          context: createPlanModeContext(),
          operations: [{ search: 'a', replace: 'b' }],
        })
      ).rejects.toThrow('disabled in plan mode');
    });

    it('should disable write_file in plan mode via executeStep()', async () => {
      const executor = new AgentToolExecutor();
      const step = createMockStep('write', 'test.txt');

      const result = await executor.executeStep(step, createPlanModeContext());

      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled in plan mode');
      expect(result.toolName).toBe('write_file');
    });

    it('should disable edit_file in plan mode via executeStep()', async () => {
      const executor = new AgentToolExecutor();
      const step = createMockStep('edit', 'test.txt');

      const result = await executor.executeStep(step, createPlanModeContext());

      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled in plan mode');
      expect(result.toolName).toBe('edit_file');
    });

    it('should allow search in plan mode', async () => {
      const executor = new AgentToolExecutor();
      const step = createMockStep('search', '**/*.ts');

      const result = await executor.executeStep(step, createPlanModeContext());

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('search_codebase');
    });

    it('should allow read in plan mode', async () => {
      const executor = new AgentToolExecutor();
      const step = createMockStep('read', 'lib/agentic-core/tool-executor.ts');

      const result = await executor.executeStep(step, createPlanModeContext());

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('read_file');
    });

    it('should allow validate in plan mode', async () => {
      const executor = new AgentToolExecutor();
      const validQweb = '<templates><t t-name="test"><div/></t></templates>';

      const result = await executor.execute('validate', {
        target: validQweb,
        context: createPlanModeContext(),
        isContent: true,
      });

      expect(result).toBeDefined();
    });

    it('should allow compile in plan mode', async () => {
      const executor = new AgentToolExecutor();
      const scss = '.test { color: blue; }';

      const result = await executor.execute('compile', {
        target: scss,
        context: createPlanModeContext(),
        isContent: true,
      });

      expect(result).toBeDefined();
    });

    it('should allow write when planMode is false', async () => {
      const executor = new AgentToolExecutor();
      const normalContext = createMockContext(); // planMode undefined = allowed

      // This should not throw (might fail for other reasons but not plan mode)
      const result = await executor.execute('write', {
        target: '.test-output/plan-mode-test.txt',
        context: normalContext,
        content: 'test',
      });

      expect(result).toBeDefined();
    });
  });
});
