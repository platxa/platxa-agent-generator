/**
 * Tests for ContextBuilder
 * Feature #30: Mode-specific context preparation
 *
 * Verification: Plan mode disables write_file, edit_file tools; agent mode enables all
 */

import { describe, it, expect } from 'vitest';
import {
  ContextBuilder,
  createContextBuilder,
  buildContextFromMessage,
  buildPlanContext,
  buildAgentContext,
  PLAN_MODE_DISABLED_TOOLS,
  PLAN_MODE_TOOLS,
  AGENT_MODE_TOOLS,
  ALL_TOOLS,
} from '@/lib/agentic-core/context-builder';
import { AgentToolExecutor } from '@/lib/agentic-core/tool-executor';
import { createAgentContext, type AgentContext } from '@/lib/agentic-core/agent-engine';

describe('ContextBuilder', () => {
  describe('constructor', () => {
    it('creates instance with default ModeRouter', () => {
      const builder = new ContextBuilder();
      expect(builder).toBeInstanceOf(ContextBuilder);
    });

    it('accepts custom ModeRouter', () => {
      const builder = createContextBuilder();
      expect(builder).toBeInstanceOf(ContextBuilder);
    });
  });

  describe('buildFromMessage', () => {
    const builder = new ContextBuilder();

    it('detects plan mode from message', () => {
      const result = builder.buildFromMessage({
        workspaceRoot: '/project',
        goal: 'What if we used a different approach?',
      });

      expect(result.mode).toBe('plan');
      expect(result.context.planMode).toBe(true);
      expect(result.classification).toBeDefined();
    });

    it('detects agent mode from message', () => {
      const result = builder.buildFromMessage({
        workspaceRoot: '/project',
        goal: 'Create a new login component',
      });

      expect(result.mode).toBe('agent');
      expect(result.context.planMode).toBe(false);
    });

    it('respects forceMode option', () => {
      const result = builder.buildFromMessage({
        workspaceRoot: '/project',
        goal: 'Create something', // Would normally be agent
        forceMode: 'plan',
      });

      expect(result.mode).toBe('plan');
      expect(result.context.planMode).toBe(true);
      expect(result.classification).toBeUndefined(); // Not classified when forced
    });

    it('sets correct workspace and goal', () => {
      const result = builder.buildFromMessage({
        workspaceRoot: '/my/project',
        goal: 'Test goal',
      });

      expect(result.context.workspaceRoot).toBe('/my/project');
      expect(result.context.goal).toBe('Test goal');
    });

    it('uses custom maxIterations', () => {
      const result = builder.buildFromMessage({
        workspaceRoot: '/project',
        goal: 'Build something',
        maxIterations: 10,
      });

      expect(result.context.maxIterations).toBe(10);
    });
  });

  describe('buildPlanContext', () => {
    const builder = new ContextBuilder();

    it('creates plan mode context', () => {
      const result = builder.buildPlanContext('/project', 'Explore options');

      expect(result.mode).toBe('plan');
      expect(result.context.planMode).toBe(true);
    });

    it('disables write_file and edit_file', () => {
      const result = builder.buildPlanContext('/project', 'Plan task');

      expect(result.disabledTools).toContain('write_file');
      expect(result.disabledTools).toContain('edit_file');
    });

    it('enables read-only tools', () => {
      const result = builder.buildPlanContext('/project', 'Plan task');

      expect(result.enabledTools).toContain('search_codebase');
      expect(result.enabledTools).toContain('read_file');
      expect(result.enabledTools).toContain('validate_qweb');
      expect(result.enabledTools).not.toContain('write_file');
      expect(result.enabledTools).not.toContain('edit_file');
    });
  });

  describe('buildAgentContext', () => {
    const builder = new ContextBuilder();

    it('creates agent mode context', () => {
      const result = builder.buildAgentContext('/project', 'Build feature');

      expect(result.mode).toBe('agent');
      expect(result.context.planMode).toBe(false);
    });

    it('enables all tools', () => {
      const result = builder.buildAgentContext('/project', 'Build feature');

      expect(result.enabledTools).toEqual(ALL_TOOLS);
      expect(result.disabledTools).toEqual([]);
    });

    it('includes write_file and edit_file', () => {
      const result = builder.buildAgentContext('/project', 'Build feature');

      expect(result.enabledTools).toContain('write_file');
      expect(result.enabledTools).toContain('edit_file');
    });
  });

  describe('isToolEnabled', () => {
    const builder = new ContextBuilder();

    it('returns false for write_file in plan mode', () => {
      expect(builder.isToolEnabled('write_file', 'plan')).toBe(false);
    });

    it('returns false for edit_file in plan mode', () => {
      expect(builder.isToolEnabled('edit_file', 'plan')).toBe(false);
    });

    it('returns true for read_file in plan mode', () => {
      expect(builder.isToolEnabled('read_file', 'plan')).toBe(true);
    });

    it('returns true for all tools in agent mode', () => {
      for (const tool of ALL_TOOLS) {
        expect(builder.isToolEnabled(tool, 'agent')).toBe(true);
      }
    });
  });

  describe('getEnabledTools / getDisabledTools', () => {
    const builder = new ContextBuilder();

    it('returns correct enabled tools for plan mode', () => {
      const enabled = builder.getEnabledTools('plan');
      expect(enabled).toEqual(PLAN_MODE_TOOLS);
      expect(enabled).not.toContain('write_file');
      expect(enabled).not.toContain('edit_file');
    });

    it('returns correct disabled tools for plan mode', () => {
      const disabled = builder.getDisabledTools('plan');
      expect(disabled).toEqual(PLAN_MODE_DISABLED_TOOLS);
      expect(disabled).toContain('write_file');
      expect(disabled).toContain('edit_file');
    });

    it('returns all tools enabled for agent mode', () => {
      const enabled = builder.getEnabledTools('agent');
      expect(enabled).toEqual(AGENT_MODE_TOOLS);
    });

    it('returns no disabled tools for agent mode', () => {
      const disabled = builder.getDisabledTools('agent');
      expect(disabled).toEqual([]);
    });
  });

  describe('factory functions', () => {
    it('buildContextFromMessage works', () => {
      const result = buildContextFromMessage({
        workspaceRoot: '/project',
        goal: 'What if we changed this?',
      });
      expect(result.mode).toBe('plan');
    });

    it('buildPlanContext works', () => {
      const result = buildPlanContext('/project', 'Explore');
      expect(result.mode).toBe('plan');
      expect(result.context.planMode).toBe(true);
    });

    it('buildAgentContext works', () => {
      const result = buildAgentContext('/project', 'Build');
      expect(result.mode).toBe('agent');
      expect(result.context.planMode).toBe(false);
    });
  });

  describe('constants', () => {
    it('PLAN_MODE_DISABLED_TOOLS contains write_file and edit_file', () => {
      expect(PLAN_MODE_DISABLED_TOOLS).toContain('write_file');
      expect(PLAN_MODE_DISABLED_TOOLS).toContain('edit_file');
      expect(PLAN_MODE_DISABLED_TOOLS).toHaveLength(2);
    });

    it('ALL_TOOLS contains all expected tools', () => {
      expect(ALL_TOOLS).toContain('search_codebase');
      expect(ALL_TOOLS).toContain('read_file');
      expect(ALL_TOOLS).toContain('write_file');
      expect(ALL_TOOLS).toContain('edit_file');
      expect(ALL_TOOLS).toContain('validate_qweb');
      expect(ALL_TOOLS).toContain('compile_scss');
      expect(ALL_TOOLS).toContain('preview_render');
      expect(ALL_TOOLS).toContain('test_odoo');
      expect(ALL_TOOLS).toContain('web_search');
      expect(ALL_TOOLS).toContain('inspect_logs');
    });

    it('PLAN_MODE_TOOLS equals ALL_TOOLS minus disabled', () => {
      const expected = ALL_TOOLS.filter(t => !PLAN_MODE_DISABLED_TOOLS.includes(t));
      expect(PLAN_MODE_TOOLS).toEqual(expected);
    });

    it('AGENT_MODE_TOOLS equals ALL_TOOLS', () => {
      expect(AGENT_MODE_TOOLS).toEqual(ALL_TOOLS);
    });
  });

  // ==========================================================================
  // Feature #30 Verification: Tool Executor Integration
  // ==========================================================================

  describe('Feature #30 verification: plan mode disables write_file, edit_file', () => {
    it('plan mode context has planMode=true', () => {
      const result = buildPlanContext('/project', 'Explore options');
      expect(result.context.planMode).toBe(true);
    });

    it('plan mode disables write_file tool', () => {
      const result = buildPlanContext('/project', 'What if analysis');
      expect(result.disabledTools).toContain('write_file');
      expect(result.enabledTools).not.toContain('write_file');
    });

    it('plan mode disables edit_file tool', () => {
      const result = buildPlanContext('/project', 'Explore alternatives');
      expect(result.disabledTools).toContain('edit_file');
      expect(result.enabledTools).not.toContain('edit_file');
    });

    it('AgentToolExecutor rejects write in plan mode', async () => {
      const executor = new AgentToolExecutor();
      const planContext = createAgentContext({
        workspaceRoot: '/project',
        goal: 'Plan',
        iteration: 1,
        maxIterations: 5,
        planMode: true,
      });

      // write action should fail in plan mode
      await expect(
        executor.execute('write', { target: 'test.txt', context: planContext, content: 'test' })
      ).rejects.toThrow(/disabled in plan mode/);
    });

    it('AgentToolExecutor rejects edit in plan mode', async () => {
      const executor = new AgentToolExecutor();
      const planContext = createAgentContext({
        workspaceRoot: '/project',
        goal: 'Plan',
        iteration: 1,
        maxIterations: 5,
        planMode: true,
      });

      // edit action should fail in plan mode
      await expect(
        executor.execute('edit', { target: 'test.txt', context: planContext })
      ).rejects.toThrow(/disabled in plan mode/);
    });

    it('AgentToolExecutor allows read in plan mode', async () => {
      const executor = new AgentToolExecutor();
      const planContext = createAgentContext({
        workspaceRoot: '/project',
        goal: 'Plan',
        iteration: 1,
        maxIterations: 5,
        planMode: true,
      });

      // read action should work in plan mode (will fail on file not found, not plan mode)
      await expect(
        executor.execute('read', { target: '/nonexistent/file.txt', context: planContext })
      ).rejects.not.toThrow(/disabled in plan mode/);
    });
  });

  describe('Feature #30 verification: agent mode enables all tools', () => {
    it('agent mode context has planMode=false', () => {
      const result = buildAgentContext('/project', 'Build feature');
      expect(result.context.planMode).toBe(false);
    });

    it('agent mode enables all tools including write_file', () => {
      const result = buildAgentContext('/project', 'Create component');
      expect(result.enabledTools).toContain('write_file');
      expect(result.disabledTools).not.toContain('write_file');
    });

    it('agent mode enables all tools including edit_file', () => {
      const result = buildAgentContext('/project', 'Update code');
      expect(result.enabledTools).toContain('edit_file');
      expect(result.disabledTools).not.toContain('edit_file');
    });

    it('agent mode has no disabled tools', () => {
      const result = buildAgentContext('/project', 'Build everything');
      expect(result.disabledTools).toHaveLength(0);
    });

    it('AgentToolExecutor allows write in agent mode', async () => {
      const executor = new AgentToolExecutor();
      const agentContext = createAgentContext({
        workspaceRoot: '/project',
        goal: 'Build',
        iteration: 1,
        maxIterations: 5,
        planMode: false,
      });

      // write action should succeed in agent mode (no plan mode error)
      const result = await executor.execute('write', {
        target: '/tmp/context-builder-test.txt',
        context: agentContext,
        content: 'test content',
      });

      // Should succeed - write is allowed in agent mode
      expect(result).toBeDefined();
    });

    it('AgentToolExecutor allows edit in agent mode', async () => {
      const executor = new AgentToolExecutor();
      const agentContext = createAgentContext({
        workspaceRoot: '/project',
        goal: 'Build',
        iteration: 1,
        maxIterations: 5,
        planMode: false,
      });

      // First write a file to edit
      await executor.execute('write', {
        target: '/tmp/context-builder-edit-test.txt',
        context: agentContext,
        content: 'original content',
      });

      // edit action should succeed in agent mode (no plan mode error)
      // Note: execute() flattens params into toolParams.options, so operations goes at top level
      const result = await executor.execute('edit', {
        target: '/tmp/context-builder-edit-test.txt',
        context: agentContext,
        operations: [{ search: 'original', replace: 'modified' }],
      });

      // Should succeed - edit is allowed in agent mode
      expect(result).toBeDefined();
    });
  });
});
