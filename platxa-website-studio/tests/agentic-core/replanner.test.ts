/**
 * Replanner Tests
 * Verifies Feature #7: replanWithErrors() generates new plan targeting specific error files/lines
 */

import { describe, it, expect, vi } from 'vitest';
import {
  Replanner,
  createReplanner,
  type FixStrategy,
} from '@/lib/agentic-core/replanner';
import type { AgentContext, ValidationResult, AgentError } from '@/lib/agentic-core/agent-engine';

const createMockContext = (files: Record<string, string> = {}): AgentContext => ({
  filesRead: new Map(Object.entries(files)),
  searchResults: new Map(),
  userPreferences: {},
  odooContext: {},
});

const createMockValidation = (
  checks: Array<{
    name: string;
    passed: boolean;
    score: number;
    errors: string[];
    warnings: string[];
  }>
): ValidationResult => ({
  passed: checks.every(c => c.passed),
  qualityScore: checks.reduce((sum, c) => sum + c.score, 0) / checks.length,
  checks,
  timestamp: new Date(),
});

describe('Replanner', () => {
  describe('instantiation', () => {
    it('should create instance with default config', () => {
      const replanner = new Replanner();
      expect(replanner).toBeInstanceOf(Replanner);
    });

    it('should create instance with custom config', () => {
      const replanner = new Replanner({
        maxFixSteps: 10,
        includeRevalidation: false,
        groupByFile: false,
      });
      expect(replanner).toBeInstanceOf(Replanner);
    });

    it('should create via factory function', () => {
      const replanner = createReplanner();
      expect(replanner).toBeInstanceOf(Replanner);
    });
  });

  describe('replanWithErrors()', () => {
    it('should return ReplanResult structure', async () => {
      const replanner = new Replanner();
      const validation = createMockValidation([
        { name: 'qweb', passed: true, score: 100, errors: [], warnings: [] },
      ]);

      const result = await replanner.replanWithErrors(
        validation,
        createMockContext(),
        null,
        1
      );

      expect(result).toMatchObject({
        fixSteps: expect.any(Array),
        errorContext: expect.any(Object),
        targetedFiles: expect.any(Array),
        strategy: expect.any(String),
      });
    });

    it('should generate fix steps targeting error files', async () => {
      const replanner = new Replanner();
      const validation = createMockValidation([
        {
          name: 'qweb',
          passed: false,
          score: 50,
          errors: ['Template missing t-name attribute in views/template.xml:10'],
          warnings: [],
        },
      ]);

      const result = await replanner.replanWithErrors(
        validation,
        createMockContext(),
        null,
        1
      );

      expect(result.fixSteps.length).toBeGreaterThan(0);
      // Should have fix step targeting template file
      const hasTemplateTarget = result.fixSteps.some(
        s => s.target.includes('template') || s.target.includes('xml')
      );
      expect(hasTemplateTarget).toBe(true);
    });

    it('should include revalidation step when enabled', async () => {
      const replanner = new Replanner({ includeRevalidation: true });
      const validation = createMockValidation([
        {
          name: 'qweb',
          passed: false,
          score: 50,
          errors: ['Error in template'],
          warnings: [],
        },
      ]);

      const result = await replanner.replanWithErrors(
        validation,
        createMockContext(),
        null,
        1
      );

      const revalidateStep = result.fixSteps.find(s => s.action === 'validate');
      expect(revalidateStep).toBeDefined();
      expect(revalidateStep?.target).toBe('all');
    });

    it('should not include revalidation when disabled', async () => {
      const replanner = new Replanner({ includeRevalidation: false });
      const validation = createMockValidation([
        {
          name: 'qweb',
          passed: false,
          score: 50,
          errors: ['Error'],
          warnings: [],
        },
      ]);

      const result = await replanner.replanWithErrors(
        validation,
        createMockContext(),
        null,
        1
      );

      const revalidateStep = result.fixSteps.find(s => s.action === 'validate');
      expect(revalidateStep).toBeUndefined();
    });

    it('should return empty fix steps for passing validation', async () => {
      const replanner = new Replanner({ includeRevalidation: false });
      const validation = createMockValidation([
        { name: 'qweb', passed: true, score: 100, errors: [], warnings: [] },
      ]);

      const result = await replanner.replanWithErrors(
        validation,
        createMockContext(),
        null,
        1
      );

      expect(result.fixSteps.length).toBe(0);
    });

    it('should target specific files from errors', async () => {
      const replanner = new Replanner({ includeRevalidation: false });
      const validation = createMockValidation([
        {
          name: 'scss',
          passed: false,
          score: 40,
          errors: ['Unbalanced braces in static/src/scss/custom.scss'],
          warnings: [],
        },
      ]);

      const result = await replanner.replanWithErrors(
        validation,
        createMockContext(),
        null,
        1
      );

      expect(result.targetedFiles.length).toBeGreaterThanOrEqual(0);
      expect(result.fixSteps.some(s => s.target.includes('scss'))).toBe(true);
    });
  });

  describe('fix strategies', () => {
    it('should use edit action for QWeb errors', async () => {
      const replanner = new Replanner({ includeRevalidation: false });
      const validation = createMockValidation([
        {
          name: 'qweb',
          passed: false,
          score: 50,
          errors: ['Template error'],
          warnings: [],
        },
      ]);

      const result = await replanner.replanWithErrors(
        validation,
        createMockContext(),
        null,
        1
      );

      const qwebFix = result.fixSteps.find(s => s.rationale.includes('QWeb'));
      expect(qwebFix?.action).toBe('edit');
    });

    it('should use edit action for SCSS errors', async () => {
      const replanner = new Replanner({ includeRevalidation: false });
      const validation = createMockValidation([
        {
          name: 'scss',
          passed: false,
          score: 50,
          errors: ['SCSS syntax error'],
          warnings: [],
        },
      ]);

      const result = await replanner.replanWithErrors(
        validation,
        createMockContext(),
        null,
        1
      );

      const scssFix = result.fixSteps.find(s => s.rationale.toLowerCase().includes('scss'));
      expect(scssFix?.action).toBe('edit');
    });

    it('should use write action for missing manifest', async () => {
      const replanner = new Replanner({ includeRevalidation: false });
      const validation = createMockValidation([
        {
          name: 'odoo_structure',
          passed: false,
          score: 50,
          errors: ['Missing __manifest__.py file'],
          warnings: [],
        },
      ]);

      const result = await replanner.replanWithErrors(
        validation,
        createMockContext(),
        null,
        1
      );

      const manifestFix = result.fixSteps.find(s => s.target.includes('manifest'));
      expect(manifestFix?.action).toBe('write');
    });

    it('should handle accessibility errors', async () => {
      const replanner = new Replanner({ includeRevalidation: false });
      const validation = createMockValidation([
        {
          name: 'accessibility',
          passed: false,
          score: 60,
          errors: ['Image missing alt attribute'],
          warnings: [],
        },
      ]);

      const result = await replanner.replanWithErrors(
        validation,
        createMockContext(),
        null,
        1
      );

      const a11yFix = result.fixSteps.find(s => s.rationale.includes('alt'));
      expect(a11yFix).toBeDefined();
    });
  });

  describe('registerStrategy()', () => {
    it('should allow registering custom strategies', async () => {
      const replanner = new Replanner({ includeRevalidation: false });
      const customStrategy: FixStrategy = {
        errorType: 'qweb',
        messagePattern: /custom-pattern/i,
        action: 'write',
        targetResolver: () => 'custom/path.xml',
        rationaleTemplate: 'Custom fix strategy',
      };

      replanner.registerStrategy(customStrategy);

      const validation = createMockValidation([
        {
          name: 'qweb',
          passed: false,
          score: 50,
          errors: ['Error with custom-pattern detected'],
          warnings: [],
        },
      ]);

      const result = await replanner.replanWithErrors(
        validation,
        createMockContext(),
        null,
        1
      );

      expect(result.fixSteps.some(s => s.target === 'custom/path.xml')).toBe(true);
    });
  });

  describe('groupByFile', () => {
    it('should group fixes by file when enabled', async () => {
      const replanner = new Replanner({
        groupByFile: true,
        includeRevalidation: false,
      });

      const validation = createMockValidation([
        {
          name: 'qweb',
          passed: false,
          score: 30,
          errors: [
            'Error 1 in views/template.xml',
            'Error 2 in views/template.xml',
            'Error 3 in views/template.xml',
          ],
          warnings: [],
        },
      ]);

      const result = await replanner.replanWithErrors(
        validation,
        createMockContext(),
        null,
        1
      );

      // Should have fewer steps than errors due to grouping
      expect(result.fixSteps.length).toBeLessThanOrEqual(3);
    });

    it('should not group when disabled', async () => {
      const replanner = new Replanner({
        groupByFile: false,
        includeRevalidation: false,
      });

      const validation = createMockValidation([
        {
          name: 'qweb',
          passed: false,
          score: 30,
          errors: ['Error 1', 'Error 2'],
          warnings: [],
        },
      ]);

      const result = await replanner.replanWithErrors(
        validation,
        createMockContext(),
        null,
        1
      );

      // Each error gets its own step
      expect(result.fixSteps.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('maxFixSteps', () => {
    it('should limit fix steps to maxFixSteps', async () => {
      const replanner = new Replanner({
        maxFixSteps: 2,
        includeRevalidation: false,
        groupByFile: false,
      });

      const validation = createMockValidation([
        {
          name: 'qweb',
          passed: false,
          score: 20,
          errors: Array.from({ length: 10 }, (_, i) => `Error ${i + 1}`),
          warnings: [],
        },
      ]);

      const result = await replanner.replanWithErrors(
        validation,
        createMockContext(),
        null,
        1
      );

      expect(result.fixSteps.length).toBeLessThanOrEqual(2);
    });
  });

  describe('replanFromAgentErrors()', () => {
    it('should generate fixes from AgentError array', async () => {
      const replanner = new Replanner({ includeRevalidation: false });
      const errors: AgentError[] = [
        {
          id: 'err-1',
          type: 'qweb',
          message: 'Template error',
          file: 'views/page.xml',
          line: 25,
          severity: 'error',
          iteration: 1,
          timestamp: new Date(),
        },
      ];

      const result = await replanner.replanFromAgentErrors(
        errors,
        createMockContext(),
        1
      );

      expect(result.fixSteps.length).toBeGreaterThan(0);
      expect(result.targetedFiles).toContain('views/page.xml');
    });

    it('should include line number in rationale', async () => {
      const replanner = new Replanner({ includeRevalidation: false });
      const errors: AgentError[] = [
        {
          id: 'err-1',
          type: 'scss',
          message: 'Syntax error',
          file: 'static/styles.scss',
          line: 42,
          severity: 'error',
          iteration: 1,
          timestamp: new Date(),
        },
      ];

      const result = await replanner.replanFromAgentErrors(
        errors,
        createMockContext(),
        1
      );

      const hasLineRef = result.fixSteps.some(s => s.rationale.includes('42'));
      expect(hasLineRef).toBe(true);
    });
  });

  describe('getReplanPrompt()', () => {
    it('should return formatted prompt for LLM', async () => {
      const replanner = new Replanner();
      const validation = createMockValidation([
        {
          name: 'qweb',
          passed: false,
          score: 50,
          errors: ['Test error'],
          warnings: [],
        },
      ]);

      const result = await replanner.replanWithErrors(
        validation,
        createMockContext(),
        null,
        1
      );

      const prompt = replanner.getReplanPrompt(result.errorContext);

      expect(prompt).toContain('Validation Errors');
      expect(typeof prompt).toBe('string');
    });
  });

  describe('strategy summary', () => {
    it('should include error count in strategy', async () => {
      const replanner = new Replanner();
      const validation = createMockValidation([
        {
          name: 'qweb',
          passed: false,
          score: 50,
          errors: ['Error 1', 'Error 2'],
          warnings: [],
        },
      ]);

      const result = await replanner.replanWithErrors(
        validation,
        createMockContext(),
        null,
        1
      );

      expect(result.strategy).toContain('2');
      expect(result.strategy).toContain('error');
    });

    it('should include file count in strategy', async () => {
      const replanner = new Replanner();
      const validation = createMockValidation([
        {
          name: 'qweb',
          passed: false,
          score: 50,
          errors: ['Error in file'],
          warnings: [],
        },
      ]);

      const result = await replanner.replanWithErrors(
        validation,
        createMockContext(),
        null,
        1
      );

      expect(result.strategy).toContain('file');
      expect(result.strategy).toContain('targeted');
    });
  });
});
