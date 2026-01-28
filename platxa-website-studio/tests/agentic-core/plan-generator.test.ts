/**
 * PlanGenerator Tests
 * Verifies Feature #3: planPhase() returns valid AgentPlan with steps array;
 * each step has action, target, rationale
 */

import { describe, it, expect, vi } from 'vitest';
import {
  PlanGenerator,
  createPlanGenerator,
  type PlanGeneratorOptions,
} from '@/lib/agentic-core/plan-generator';
import type { AgentContext, AgentError } from '@/lib/agentic-core/agent-engine';

const createMockContext = (): AgentContext => ({
  filesRead: new Map(),
  searchResults: new Map(),
  userPreferences: {},
  odooContext: {},
});

describe('PlanGenerator', () => {
  describe('instantiation', () => {
    it('should create instance with default options', () => {
      const generator = new PlanGenerator();
      expect(generator).toBeInstanceOf(PlanGenerator);
    });

    it('should create instance with custom options', () => {
      const generator = new PlanGenerator({
        maxSteps: 10,
        includeExplorationSteps: false,
        odooHints: false,
      });
      expect(generator).toBeInstanceOf(PlanGenerator);
    });

    it('should create via factory function', () => {
      const generator = createPlanGenerator();
      expect(generator).toBeInstanceOf(PlanGenerator);
    });
  });

  describe('generatePlan()', () => {
    it('should return AgentPlan structure', async () => {
      const generator = new PlanGenerator();
      const plan = await generator.generatePlan('Test goal', createMockContext());

      expect(plan).toMatchObject({
        id: expect.any(String),
        goal: 'Test goal',
        steps: expect.any(Array),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should have steps array', async () => {
      const generator = new PlanGenerator();
      const plan = await generator.generatePlan('Create a landing page', createMockContext());

      expect(Array.isArray(plan.steps)).toBe(true);
      expect(plan.steps.length).toBeGreaterThan(0);
    });

    it('should have action, target, rationale in each step', async () => {
      const generator = new PlanGenerator();
      const plan = await generator.generatePlan('Create a snippet', createMockContext());

      for (const step of plan.steps) {
        expect(step).toMatchObject({
          id: expect.any(String),
          action: expect.any(String),
          target: expect.any(String),
          rationale: expect.any(String),
          status: 'pending',
        });
      }
    });

    it('should include search step when exploration enabled', async () => {
      const generator = new PlanGenerator({ includeExplorationSteps: true });
      const plan = await generator.generatePlan('Create a template', createMockContext());

      const searchStep = plan.steps.find(s => s.action === 'search');
      expect(searchStep).toBeDefined();
    });

    it('should skip search step when exploration disabled', async () => {
      const generator = new PlanGenerator({ includeExplorationSteps: false });
      const plan = await generator.generatePlan('Create a template', createMockContext());

      const searchStep = plan.steps.find(s => s.action === 'search');
      expect(searchStep).toBeUndefined();
    });

    it('should include validate step for Odoo hints', async () => {
      const generator = new PlanGenerator({ odooHints: true });
      const plan = await generator.generatePlan('Create a page', createMockContext());

      const validateStep = plan.steps.find(s => s.action === 'validate');
      expect(validateStep).toBeDefined();
    });

    it('should limit steps to maxSteps', async () => {
      const generator = new PlanGenerator({ maxSteps: 2 });
      const plan = await generator.generatePlan('Complex task with many steps', createMockContext());

      expect(plan.steps.length).toBeLessThanOrEqual(2);
    });

    it('should infer snippet target for snippet goals', async () => {
      const generator = new PlanGenerator({ includeExplorationSteps: true });
      const plan = await generator.generatePlan('Create a new snippet', createMockContext());

      const searchStep = plan.steps.find(s => s.action === 'search');
      expect(searchStep?.target).toContain('snippet');
    });

    it('should infer scss target for style goals', async () => {
      const generator = new PlanGenerator();
      const plan = await generator.generatePlan('Update styles and scss', createMockContext());

      const writeStep = plan.steps.find(s => s.action === 'write');
      expect(writeStep?.target).toContain('scss');
    });

    it('should include preview step', async () => {
      const generator = new PlanGenerator();
      const plan = await generator.generatePlan('Create content', createMockContext());

      const previewStep = plan.steps.find(s => s.action === 'preview');
      expect(previewStep).toBeDefined();
    });
  });

  describe('generatePlan() with LLM', () => {
    it('should use LLM when provided', async () => {
      const mockLLM = vi.fn().mockResolvedValue(JSON.stringify({
        steps: [
          { action: 'read', target: 'config.xml', rationale: 'Read configuration' },
          { action: 'write', target: 'output.xml', rationale: 'Generate output' },
        ],
      }));

      const generator = new PlanGenerator({}, mockLLM);
      const plan = await generator.generatePlan('LLM test', createMockContext());

      expect(mockLLM).toHaveBeenCalled();
      expect(plan.steps.length).toBe(2);
      expect(plan.steps[0].action).toBe('read');
      expect(plan.steps[1].action).toBe('write');
    });

    it('should parse JSON from markdown code blocks', async () => {
      const mockLLM = vi.fn().mockResolvedValue(`
Here's the plan:
\`\`\`json
{
  "steps": [
    { "action": "search", "target": "**/*.xml", "rationale": "Find templates" }
  ]
}
\`\`\`
      `);

      const generator = new PlanGenerator({}, mockLLM);
      const plan = await generator.generatePlan('Test', createMockContext());

      expect(plan.steps.length).toBe(1);
      expect(plan.steps[0].action).toBe('search');
    });

    it('should normalize action names', async () => {
      const mockLLM = vi.fn().mockResolvedValue(JSON.stringify({
        steps: [
          { action: 'CREATE', target: 'file.xml', rationale: 'Create file' },
          { action: 'modify', target: 'other.xml', rationale: 'Modify file' },
        ],
      }));

      const generator = new PlanGenerator({}, mockLLM);
      const plan = await generator.generatePlan('Test', createMockContext());

      expect(plan.steps[0].action).toBe('write'); // CREATE -> write
      expect(plan.steps[1].action).toBe('edit');  // modify -> edit
    });

    it('should fallback to defaults on LLM error', async () => {
      const mockLLM = vi.fn().mockRejectedValue(new Error('LLM error'));

      const generator = new PlanGenerator({}, mockLLM);
      const plan = await generator.generatePlan('Test', createMockContext());

      // Should still return a valid plan with default steps
      expect(plan.steps.length).toBeGreaterThan(0);
    });
  });

  describe('generateFix()', () => {
    it('should return empty array for no errors', async () => {
      const generator = new PlanGenerator();
      const fixes = await generator.generateFix([], createMockContext());

      expect(fixes).toEqual([]);
    });

    it('should generate fix steps for errors', async () => {
      const generator = new PlanGenerator();
      const errors: AgentError[] = [
        {
          id: 'err-1',
          type: 'qweb',
          message: 'Invalid t-directive',
          file: 'views/template.xml',
          line: 10,
          severity: 'error',
          iteration: 1,
          timestamp: new Date(),
        },
      ];

      const fixes = await generator.generateFix(errors, createMockContext());

      expect(fixes.length).toBeGreaterThan(0);
      expect(fixes[0].action).toBe('edit');
      expect(fixes[0].target).toBe('views/template.xml');
    });

    it('should include re-validation step after fixes', async () => {
      const generator = new PlanGenerator();
      const errors: AgentError[] = [
        {
          id: 'err-1',
          type: 'scss',
          message: 'Invalid syntax',
          severity: 'error',
          iteration: 1,
          timestamp: new Date(),
        },
      ];

      const fixes = await generator.generateFix(errors, createMockContext());

      const revalidateStep = fixes.find(f => f.action === 'validate');
      expect(revalidateStep).toBeDefined();
    });

    it('should skip warning-level errors', async () => {
      const generator = new PlanGenerator();
      const errors: AgentError[] = [
        {
          id: 'warn-1',
          type: 'validation',
          message: 'Minor issue',
          severity: 'warning',
          iteration: 1,
          timestamp: new Date(),
        },
      ];

      const fixes = await generator.generateFix(errors, createMockContext());

      // Should only have revalidate step if any, but no fix for warning
      const fixSteps = fixes.filter(f => f.id.startsWith('fix-warn'));
      expect(fixSteps.length).toBe(0);
    });
  });

  describe('context handling', () => {
    it('should include Odoo version in context summary', async () => {
      const mockLLM = vi.fn().mockResolvedValue(JSON.stringify({ steps: [] }));
      const generator = new PlanGenerator({}, mockLLM);

      const context = createMockContext();
      context.odooContext.version = '17.0';

      await generator.generatePlan('Test', context);

      const promptArg = mockLLM.mock.calls[0][0] as string;
      expect(promptArg).toContain('17.0');
    });

    it('should include modules in context summary', async () => {
      const mockLLM = vi.fn().mockResolvedValue(JSON.stringify({ steps: [] }));
      const generator = new PlanGenerator({}, mockLLM);

      const context = createMockContext();
      context.odooContext.modules = ['website', 'sale'];

      await generator.generatePlan('Test', context);

      const promptArg = mockLLM.mock.calls[0][0] as string;
      expect(promptArg).toContain('website');
      expect(promptArg).toContain('sale');
    });
  });

  describe('setTemplates()', () => {
    it('should allow custom templates', async () => {
      const mockLLM = vi.fn().mockResolvedValue(JSON.stringify({ steps: [] }));
      const generator = new PlanGenerator({}, mockLLM);

      generator.setTemplates({
        systemPrompt: 'Custom system prompt',
      });

      await generator.generatePlan('Test', createMockContext());

      const promptArg = mockLLM.mock.calls[0][0] as string;
      expect(promptArg).toContain('Custom system prompt');
    });
  });

  describe('setLLMCall()', () => {
    it('should allow setting LLM after construction', async () => {
      const generator = new PlanGenerator();
      const mockLLM = vi.fn().mockResolvedValue(JSON.stringify({
        steps: [{ action: 'test', target: 'test', rationale: 'test' }],
      }));

      generator.setLLMCall(mockLLM);
      await generator.generatePlan('Test', createMockContext());

      expect(mockLLM).toHaveBeenCalled();
    });
  });
});
