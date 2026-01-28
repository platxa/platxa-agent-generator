/**
 * ValidationEngine Tests
 * Verifies Feature #5: validatePhase() runs all validators in parallel;
 * returns aggregated pass/fail with errors array
 */

import { describe, it, expect, vi } from 'vitest';
import {
  ValidationEngine,
  createValidationEngine,
  type ValidatorFunction,
  type ValidatorResult,
} from '@/lib/agentic-core/validation-engine';
import type { AgentContext, ValidationResult } from '@/lib/agentic-core/agent-engine';

const createMockContext = (files: Record<string, string> = {}): AgentContext => ({
  filesRead: new Map(Object.entries(files)),
  searchResults: new Map(),
  userPreferences: {},
  odooContext: {},
});

describe('ValidationEngine', () => {
  describe('instantiation', () => {
    it('should create instance with default config', () => {
      const engine = new ValidationEngine();
      expect(engine).toBeInstanceOf(ValidationEngine);
    });

    it('should create instance with custom config', () => {
      const engine = new ValidationEngine({
        parallel: false,
        validatorTimeout: 5000,
        passingScore: 90,
      });
      expect(engine).toBeInstanceOf(ValidationEngine);
    });

    it('should create via factory function', () => {
      const engine = createValidationEngine();
      expect(engine).toBeInstanceOf(ValidationEngine);
    });
  });

  describe('validate()', () => {
    it('should return ValidationResult structure', async () => {
      const engine = new ValidationEngine();
      const result = await engine.validate(createMockContext());

      expect(result).toMatchObject({
        passed: expect.any(Boolean),
        qualityScore: expect.any(Number),
        checks: expect.any(Array),
        timestamp: expect.any(Date),
      });
    });

    it('should run all default validators', async () => {
      const engine = new ValidationEngine();
      const result = await engine.validate(createMockContext());

      const validatorNames = result.checks.map(c => c.name);
      expect(validatorNames).toContain('qweb');
      expect(validatorNames).toContain('scss');
      expect(validatorNames).toContain('accessibility');
      expect(validatorNames).toContain('odoo_structure');
    });

    it('should aggregate errors from all validators', async () => {
      const engine = new ValidationEngine();

      // Context with files that will trigger validation errors
      const context = createMockContext({
        'views/broken.xml': '<template><img src="test.png"></template>',
        'static/styles.scss': '{ color: red;', // Unbalanced braces
      });

      const result = await engine.validate(context);

      // Should have errors from multiple validators
      const allErrors = result.checks.flatMap(c => c.errors);
      expect(allErrors.length).toBeGreaterThan(0);
    });

    it('should calculate weighted quality score', async () => {
      const engine = new ValidationEngine();
      const result = await engine.validate(createMockContext());

      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
    });

    it('should pass when quality score meets threshold', async () => {
      const engine = new ValidationEngine({ passingScore: 80 });
      const result = await engine.validate(createMockContext());

      // Empty context should pass all validators
      expect(result.passed).toBe(true);
      expect(result.qualityScore).toBeGreaterThanOrEqual(80);
    });
  });

  describe('parallel execution', () => {
    it('should run validators in parallel by default', async () => {
      const engine = new ValidationEngine({ parallel: true });
      const executionOrder: string[] = [];

      const slowValidator: ValidatorFunction = async () => {
        executionOrder.push('slow-start');
        await new Promise(resolve => setTimeout(resolve, 50));
        executionOrder.push('slow-end');
        return {
          name: 'slow',
          passed: true,
          score: 100,
          errors: [],
          warnings: [],
          duration: 50,
        };
      };

      const fastValidator: ValidatorFunction = async () => {
        executionOrder.push('fast-start');
        executionOrder.push('fast-end');
        return {
          name: 'fast',
          passed: true,
          score: 100,
          errors: [],
          warnings: [],
          duration: 1,
        };
      };

      engine.registerValidator('slow', slowValidator);
      engine.registerValidator('fast', fastValidator);

      await engine.validate(createMockContext());

      // In parallel, fast should complete before slow
      expect(executionOrder.indexOf('fast-end')).toBeLessThan(executionOrder.indexOf('slow-end'));
    });

    it('should run validators sequentially when parallel=false', async () => {
      const engine = new ValidationEngine({ parallel: false });
      const executionOrder: string[] = [];

      engine.registerValidator('first', async () => {
        executionOrder.push('first');
        return { name: 'first', passed: true, score: 100, errors: [], warnings: [], duration: 0 };
      });

      engine.registerValidator('second', async () => {
        executionOrder.push('second');
        return { name: 'second', passed: true, score: 100, errors: [], warnings: [], duration: 0 };
      });

      await engine.validate(createMockContext());

      // Custom validators run after built-ins, but in order
      const firstIdx = executionOrder.indexOf('first');
      const secondIdx = executionOrder.indexOf('second');
      expect(firstIdx).toBeLessThan(secondIdx);
    });
  });

  describe('QWeb validator', () => {
    it('should detect missing template name', async () => {
      const engine = new ValidationEngine();
      const context = createMockContext({
        'views/test.xml': '<template><div>Content</div></template>',
      });

      const result = await engine.runValidator('qweb', context);

      expect(result.errors.some(e => e.code === 'QWEB_NO_NAME')).toBe(true);
    });

    it('should pass for valid QWeb', async () => {
      const engine = new ValidationEngine();
      const context = createMockContext({
        'views/test.xml': '<template t-name="module.template"><div>Content</div></template>',
      });

      const result = await engine.runValidator('qweb', context);

      expect(result.errors.filter(e => e.code === 'QWEB_NO_NAME').length).toBe(0);
    });
  });

  describe('SCSS validator', () => {
    it('should detect unbalanced braces', async () => {
      const engine = new ValidationEngine();
      const context = createMockContext({
        'static/styles.scss': '.class { color: red;',
      });

      const result = await engine.runValidator('scss', context);

      expect(result.errors.some(e => e.code === 'SCSS_UNBALANCED_BRACES')).toBe(true);
    });

    it('should warn about hardcoded colors', async () => {
      const engine = new ValidationEngine();
      const context = createMockContext({
        'static/styles.scss': `
          .a { color: #ff0000; }
          .b { color: #00ff00; }
          .c { color: #0000ff; }
          .d { color: #ffffff; }
          .e { color: #000000; }
          .f { color: #cccccc; }
        `,
      });

      const result = await engine.runValidator('scss', context);

      expect(result.warnings.some(w => w.code === 'SCSS_HARDCODED_COLORS')).toBe(true);
    });

    it('should pass for valid SCSS', async () => {
      const engine = new ValidationEngine();
      const context = createMockContext({
        'static/styles.scss': '.class { color: $primary; }',
      });

      const result = await engine.runValidator('scss', context);

      expect(result.errors.filter(e => e.severity === 'critical').length).toBe(0);
    });
  });

  describe('accessibility validator', () => {
    it('should detect images without alt', async () => {
      const engine = new ValidationEngine();
      const context = createMockContext({
        'views/page.xml': '<div><img src="image.png"></div>',
      });

      const result = await engine.runValidator('accessibility', context);

      expect(result.errors.some(e => e.code === 'A11Y_IMG_NO_ALT')).toBe(true);
    });

    it('should pass for images with alt', async () => {
      const engine = new ValidationEngine();
      const context = createMockContext({
        'views/page.xml': '<div><img src="image.png" alt="Description"></div>',
      });

      const result = await engine.runValidator('accessibility', context);

      expect(result.errors.filter(e => e.code === 'A11Y_IMG_NO_ALT').length).toBe(0);
    });
  });

  describe('Odoo structure validator', () => {
    it('should warn about missing manifest', async () => {
      const engine = new ValidationEngine();
      const context = createMockContext({
        'models/model.py': 'class MyModel(models.Model): pass',
      });

      const result = await engine.runValidator('odoo_structure', context);

      expect(result.warnings.some(w => w.code === 'ODOO_NO_MANIFEST')).toBe(true);
    });

    it('should error on filename with spaces', async () => {
      const engine = new ValidationEngine();
      const context = createMockContext({
        'views/my template.xml': '<odoo></odoo>',
      });

      const result = await engine.runValidator('odoo_structure', context);

      expect(result.errors.some(e => e.code === 'ODOO_FILENAME_SPACE')).toBe(true);
    });
  });

  describe('custom validators', () => {
    it('should allow registering custom validators', async () => {
      const engine = new ValidationEngine();
      const customValidator = vi.fn().mockResolvedValue({
        name: 'custom',
        passed: true,
        score: 95,
        errors: [],
        warnings: [],
        duration: 10,
      });

      engine.registerValidator('custom', customValidator);
      const result = await engine.validate(createMockContext());

      expect(customValidator).toHaveBeenCalled();
      expect(result.checks.some(c => c.name === 'custom')).toBe(true);
    });

    it('should allow overriding built-in validators', async () => {
      const engine = new ValidationEngine();
      const customQweb = vi.fn().mockResolvedValue({
        name: 'qweb',
        passed: true,
        score: 100,
        errors: [],
        warnings: [],
        duration: 5,
      });

      engine.setValidator('qweb', customQweb);
      await engine.validate(createMockContext());

      expect(customQweb).toHaveBeenCalled();
    });
  });

  describe('getValidators()', () => {
    it('should return list of all validators', () => {
      const engine = new ValidationEngine();
      const validators = engine.getValidators();

      expect(validators).toContain('qweb');
      expect(validators).toContain('scss');
      expect(validators).toContain('accessibility');
      expect(validators).toContain('odoo_structure');
    });

    it('should include custom validators', () => {
      const engine = new ValidationEngine();
      engine.registerValidator('custom', async () => ({
        name: 'custom',
        passed: true,
        score: 100,
        errors: [],
        warnings: [],
        duration: 0,
      }));

      const validators = engine.getValidators();
      expect(validators).toContain('custom');
    });
  });

  describe('timeout handling', () => {
    it('should timeout slow validators', async () => {
      const engine = new ValidationEngine({ validatorTimeout: 50 });

      const slowValidator: ValidatorFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return {
          name: 'slow',
          passed: true,
          score: 100,
          errors: [],
          warnings: [],
          duration: 200,
        };
      };

      engine.registerValidator('slow', slowValidator);
      const result = await engine.validate(createMockContext());

      const slowResult = result.checks.find(c => c.name === 'slow');
      expect(slowResult?.passed).toBe(false);
      expect(slowResult?.errors.some(e => e.includes('timed out'))).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle validator errors gracefully', async () => {
      const engine = new ValidationEngine();

      const failingValidator: ValidatorFunction = async () => {
        throw new Error('Validator crashed');
      };

      engine.registerValidator('failing', failingValidator);
      const result = await engine.validate(createMockContext());

      const failResult = result.checks.find(c => c.name === 'failing');
      expect(failResult?.passed).toBe(false);
      expect(failResult?.errors.some(e => e.includes('Validator crashed'))).toBe(true);
    });
  });

  describe('weight configuration', () => {
    it('should apply custom weights', async () => {
      const engine = new ValidationEngine({
        weights: { qweb: 50, scss: 50, accessibility: 0, odoo_structure: 0 },
      });

      const result = await engine.validate(createMockContext());

      // With empty context, all validators pass with 100
      // Score should still be 100 regardless of weights
      expect(result.qualityScore).toBe(100);
    });

    it('should allow setting weight after construction', () => {
      const engine = new ValidationEngine();
      engine.setWeight('qweb', 100);

      // Verify it doesn't throw
      expect(engine.getValidators()).toContain('qweb');
    });
  });
});
