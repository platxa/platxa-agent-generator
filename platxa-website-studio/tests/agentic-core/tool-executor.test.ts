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
      const step = createMockStep('read', 'views/template.xml');

      const result = await executor.executeStep(step, createMockContext());

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('read_file');
    });

    it('should route "write" to write_file', async () => {
      const executor = new AgentToolExecutor();
      const step = createMockStep('write', 'views/new.xml');

      const result = await executor.executeStep(step, createMockContext());

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('write_file');
    });

    it('should route "edit" to edit_file', async () => {
      const executor = new AgentToolExecutor();
      const step = createMockStep('edit', 'views/existing.xml');

      const result = await executor.executeStep(step, createMockContext());

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('edit_file');
    });

    it('should route "validate" to validate_qweb', async () => {
      const executor = new AgentToolExecutor();
      const step = createMockStep('validate', 'qweb');

      const result = await executor.executeStep(step, createMockContext());

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('validate_qweb');
    });

    it('should route "compile" to compile_scss', async () => {
      const executor = new AgentToolExecutor();
      const step = createMockStep('compile', 'styles.scss');

      const result = await executor.executeStep(step, createMockContext());

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('compile_scss');
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

  describe('retry behavior', () => {
    it('should retry on failure when enabled', async () => {
      const executor = new AgentToolExecutor({
        retryOnFailure: true,
        maxRetries: 2,
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
});
