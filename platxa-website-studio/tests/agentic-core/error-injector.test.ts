/**
 * ErrorInjector Tests
 * Verifies Feature #6: Errors include file path, line number, error message, and suggested fix area
 */

import { describe, it, expect } from 'vitest';
import {
  ErrorInjector,
  createErrorInjector,
  type InjectedError,
} from '@/lib/agentic-core/error-injector';
import type { ValidatorResult, ValidationError } from '@/lib/agentic-core/validation-engine';
import type { AgentContext, AgentError } from '@/lib/agentic-core/agent-engine';

const createMockContext = (files: Record<string, string> = {}): AgentContext => ({
  filesRead: new Map(Object.entries(files)),
  searchResults: new Map(),
  userPreferences: {},
  odooContext: {},
});

const createMockValidatorResult = (
  name: string,
  errors: ValidationError[] = [],
  warnings: { code: string; message: string; file?: string; line?: number; suggestion?: string }[] = []
): ValidatorResult => ({
  name,
  passed: errors.length === 0,
  score: errors.length === 0 ? 100 : 50,
  errors,
  warnings,
  duration: 10,
});

describe('ErrorInjector', () => {
  describe('instantiation', () => {
    it('should create instance with default options', () => {
      const injector = new ErrorInjector();
      expect(injector).toBeInstanceOf(ErrorInjector);
    });

    it('should create instance with custom options', () => {
      const injector = new ErrorInjector({
        includeSnippets: false,
        maxErrors: 10,
        includeWarnings: false,
      });
      expect(injector).toBeInstanceOf(ErrorInjector);
    });

    it('should create via factory function', () => {
      const injector = createErrorInjector();
      expect(injector).toBeInstanceOf(ErrorInjector);
    });
  });

  describe('injectErrors()', () => {
    it('should return ErrorContext structure', () => {
      const injector = new ErrorInjector();
      const result = injector.injectErrors([], createMockContext(), 1);

      expect(result).toMatchObject({
        totalErrors: expect.any(Number),
        errorsByType: expect.any(Object),
        criticalErrors: expect.any(Array),
        errors: expect.any(Array),
        warnings: expect.any(Array),
        summary: expect.any(String),
        details: expect.any(String),
        affectedFiles: expect.any(Array),
        fixPriority: expect.any(Array),
      });
    });

    it('should include file path in injected errors', () => {
      const injector = new ErrorInjector();
      const validatorResult = createMockValidatorResult('qweb', [
        {
          code: 'TEST_ERROR',
          message: 'Test error',
          file: 'views/template.xml',
          severity: 'error',
        },
      ]);

      const result = injector.injectErrors([validatorResult], createMockContext(), 1);

      expect(result.errors[0].filePath).toBe('views/template.xml');
    });

    it('should include line number in injected errors', () => {
      const injector = new ErrorInjector();
      const validatorResult = createMockValidatorResult('qweb', [
        {
          code: 'TEST_ERROR',
          message: 'Test error',
          file: 'views/template.xml',
          line: 42,
          severity: 'error',
        },
      ]);

      const result = injector.injectErrors([validatorResult], createMockContext(), 1);

      expect(result.errors[0].lineNumber).toBe(42);
    });

    it('should include column number in injected errors', () => {
      const injector = new ErrorInjector();
      const validatorResult = createMockValidatorResult('qweb', [
        {
          code: 'TEST_ERROR',
          message: 'Test error',
          file: 'views/template.xml',
          line: 42,
          column: 10,
          severity: 'error',
        },
      ]);

      const result = injector.injectErrors([validatorResult], createMockContext(), 1);

      expect(result.errors[0].columnNumber).toBe(10);
    });

    it('should include error message', () => {
      const injector = new ErrorInjector();
      const validatorResult = createMockValidatorResult('qweb', [
        {
          code: 'TEST_ERROR',
          message: 'Template is missing t-name attribute',
          severity: 'error',
        },
      ]);

      const result = injector.injectErrors([validatorResult], createMockContext(), 1);

      expect(result.errors[0].message).toBe('Template is missing t-name attribute');
    });

    it('should include suggested fix from validation error', () => {
      const injector = new ErrorInjector();
      const validatorResult = createMockValidatorResult('qweb', [
        {
          code: 'TEST_ERROR',
          message: 'Missing attribute',
          suggestion: 'Add the required attribute',
          severity: 'error',
        },
      ]);

      const result = injector.injectErrors([validatorResult], createMockContext(), 1);

      expect(result.errors[0].suggestedFix).toBe('Add the required attribute');
    });

    it('should infer suggestion when not provided', () => {
      const injector = new ErrorInjector();
      const validatorResult = createMockValidatorResult('qweb', [
        {
          code: 'QWEB_NO_NAME',
          message: 'Template missing t-name attribute',
          severity: 'error',
        },
      ]);

      const result = injector.injectErrors([validatorResult], createMockContext(), 1);

      expect(result.errors[0].suggestedFix).not.toBeNull();
      expect(result.errors[0].suggestedFix).toContain('t-name');
    });
  });

  describe('code snippets', () => {
    it('should include code snippet when file content available', () => {
      const injector = new ErrorInjector({ includeSnippets: true, snippetContextLines: 2 });
      const context = createMockContext({
        'views/template.xml': `<odoo>
  <template t-name="test">
    <div>Line 3</div>
    <div>Line 4 - error here</div>
    <div>Line 5</div>
  </template>
</odoo>`,
      });

      const validatorResult = createMockValidatorResult('qweb', [
        {
          code: 'TEST_ERROR',
          message: 'Error on line 4',
          file: 'views/template.xml',
          line: 4,
          severity: 'error',
        },
      ]);

      const result = injector.injectErrors([validatorResult], context, 1);

      expect(result.errors[0].codeSnippet).not.toBeNull();
      expect(result.errors[0].codeSnippet).toContain('Line 4');
    });

    it('should mark the error line in snippet', () => {
      const injector = new ErrorInjector({ includeSnippets: true, snippetContextLines: 1 });
      const context = createMockContext({
        'test.xml': 'line1\nline2\nline3\nline4\nline5',
      });

      const validatorResult = createMockValidatorResult('qweb', [
        {
          code: 'TEST',
          message: 'Error',
          file: 'test.xml',
          line: 3,
          severity: 'error',
        },
      ]);

      const result = injector.injectErrors([validatorResult], context, 1);

      expect(result.errors[0].codeSnippet).toContain('>');
      expect(result.errors[0].codeSnippet).toContain('3');
    });

    it('should skip snippets when disabled', () => {
      const injector = new ErrorInjector({ includeSnippets: false });
      const context = createMockContext({
        'test.xml': 'content',
      });

      const validatorResult = createMockValidatorResult('qweb', [
        {
          code: 'TEST',
          message: 'Error',
          file: 'test.xml',
          line: 1,
          severity: 'error',
        },
      ]);

      const result = injector.injectErrors([validatorResult], context, 1);

      expect(result.errors[0].codeSnippet).toBeNull();
    });
  });

  describe('error grouping', () => {
    it('should group related errors by file', () => {
      const injector = new ErrorInjector({ groupRelated: true });
      const validatorResult = createMockValidatorResult('qweb', [
        {
          code: 'ERR1',
          message: 'Error 1',
          file: 'views/template.xml',
          line: 10,
          severity: 'error',
        },
        {
          code: 'ERR2',
          message: 'Error 2',
          file: 'views/template.xml',
          line: 20,
          severity: 'error',
        },
      ]);

      const result = injector.injectErrors([validatorResult], createMockContext(), 1);

      // Each error should reference the other
      expect(result.errors[0].relatedErrorIds.length).toBe(1);
      expect(result.errors[1].relatedErrorIds.length).toBe(1);
    });
  });

  describe('error prioritization', () => {
    it('should put critical errors first', () => {
      const injector = new ErrorInjector();
      const validatorResult = createMockValidatorResult('qweb', [
        {
          code: 'REGULAR',
          message: 'Regular error',
          severity: 'error',
        },
        {
          code: 'CRITICAL',
          message: 'Critical error',
          severity: 'critical',
        },
      ]);

      const result = injector.injectErrors([validatorResult], createMockContext(), 1);

      expect(result.criticalErrors.length).toBe(1);
      expect(result.criticalErrors[0].message).toBe('Critical error');
    });

    it('should calculate fix priority by error count per file', () => {
      const injector = new ErrorInjector();
      const validatorResult = createMockValidatorResult('qweb', [
        { code: 'E1', message: 'Error', file: 'file1.xml', severity: 'error' },
        { code: 'E2', message: 'Error', file: 'file2.xml', severity: 'error' },
        { code: 'E3', message: 'Error', file: 'file2.xml', severity: 'error' },
        { code: 'E4', message: 'Error', file: 'file2.xml', severity: 'error' },
      ]);

      const result = injector.injectErrors([validatorResult], createMockContext(), 1);

      // file2.xml has more errors, should be first
      expect(result.fixPriority[0]).toBe('file2.xml');
    });
  });

  describe('warnings', () => {
    it('should include warnings when enabled', () => {
      const injector = new ErrorInjector({ includeWarnings: true });
      const validatorResult = createMockValidatorResult('qweb', [], [
        { code: 'WARN', message: 'Warning message' },
      ]);

      const result = injector.injectErrors([validatorResult], createMockContext(), 1);

      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0].message).toBe('Warning message');
    });

    it('should exclude warnings when disabled', () => {
      const injector = new ErrorInjector({ includeWarnings: false });
      const validatorResult = createMockValidatorResult('qweb', [], [
        { code: 'WARN', message: 'Warning message' },
      ]);

      const result = injector.injectErrors([validatorResult], createMockContext(), 1);

      expect(result.warnings.length).toBe(0);
    });
  });

  describe('fromAgentErrors()', () => {
    it('should convert AgentError array to ErrorContext', () => {
      const injector = new ErrorInjector();
      const errors: AgentError[] = [
        {
          id: 'err-1',
          type: 'qweb',
          message: 'QWeb error',
          file: 'views/template.xml',
          line: 10,
          severity: 'error',
          iteration: 1,
          timestamp: new Date(),
        },
      ];

      const result = injector.fromAgentErrors(errors, createMockContext());

      expect(result.totalErrors).toBe(1);
      expect(result.errors[0].filePath).toBe('views/template.xml');
      expect(result.errors[0].lineNumber).toBe(10);
    });
  });

  describe('formatForPrompt()', () => {
    it('should format error context for LLM prompt', () => {
      const injector = new ErrorInjector();
      const validatorResult = createMockValidatorResult('qweb', [
        {
          code: 'TEST',
          message: 'Test error',
          file: 'test.xml',
          line: 5,
          severity: 'error',
          suggestion: 'Fix it',
        },
      ]);

      const errorContext = injector.injectErrors([validatorResult], createMockContext(), 1);
      const formatted = injector.formatForPrompt(errorContext);

      expect(formatted).toContain('Validation Errors');
      expect(formatted).toContain('Test error');
      expect(formatted).toContain('test.xml');
      expect(formatted).toContain('Fix it');
    });

    it('should include fix priority in prompt', () => {
      const injector = new ErrorInjector();
      const validatorResult = createMockValidatorResult('qweb', [
        { code: 'E1', message: 'Error', file: 'file1.xml', severity: 'error' },
        { code: 'E2', message: 'Error', file: 'file2.xml', severity: 'error' },
      ]);

      const errorContext = injector.injectErrors([validatorResult], createMockContext(), 1);
      const formatted = injector.formatForPrompt(errorContext);

      expect(formatted).toContain('Suggested Fix Order');
    });
  });

  describe('maxErrors limit', () => {
    it('should limit errors to maxErrors option', () => {
      const injector = new ErrorInjector({ maxErrors: 3 });
      const errors: ValidationError[] = Array.from({ length: 10 }, (_, i) => ({
        code: `ERR${i}`,
        message: `Error ${i}`,
        severity: 'error' as const,
      }));

      const validatorResult = createMockValidatorResult('qweb', errors);
      const result = injector.injectErrors([validatorResult], createMockContext(), 1);

      expect(result.errors.length).toBeLessThanOrEqual(3);
    });
  });

  describe('error type mapping', () => {
    it('should map qweb validator to qweb type', () => {
      const injector = new ErrorInjector();
      const validatorResult = createMockValidatorResult('qweb', [
        { code: 'TEST', message: 'Error', severity: 'error' },
      ]);

      const result = injector.injectErrors([validatorResult], createMockContext(), 1);

      expect(result.errors[0].type).toBe('qweb');
    });

    it('should map scss validator to scss type', () => {
      const injector = new ErrorInjector();
      const validatorResult = createMockValidatorResult('scss', [
        { code: 'TEST', message: 'Error', severity: 'error' },
      ]);

      const result = injector.injectErrors([validatorResult], createMockContext(), 1);

      expect(result.errors[0].type).toBe('scss');
    });

    it('should map accessibility validator to validation type', () => {
      const injector = new ErrorInjector();
      const validatorResult = createMockValidatorResult('accessibility', [
        { code: 'TEST', message: 'Error', severity: 'error' },
      ]);

      const result = injector.injectErrors([validatorResult], createMockContext(), 1);

      expect(result.errors[0].type).toBe('validation');
    });

    it('should map odoo_structure validator to odoo type', () => {
      const injector = new ErrorInjector();
      const validatorResult = createMockValidatorResult('odoo_structure', [
        { code: 'TEST', message: 'Error', severity: 'error' },
      ]);

      const result = injector.injectErrors([validatorResult], createMockContext(), 1);

      expect(result.errors[0].type).toBe('odoo');
    });
  });

  describe('summary generation', () => {
    it('should include error count in summary', () => {
      const injector = new ErrorInjector();
      const validatorResult = createMockValidatorResult('qweb', [
        { code: 'E1', message: 'Error 1', severity: 'error' },
        { code: 'E2', message: 'Error 2', severity: 'error' },
      ]);

      const result = injector.injectErrors([validatorResult], createMockContext(), 1);

      expect(result.summary).toContain('2');
      expect(result.summary).toContain('error');
    });

    it('should highlight critical errors in summary', () => {
      const injector = new ErrorInjector();
      const validatorResult = createMockValidatorResult('qweb', [
        { code: 'CRIT', message: 'Critical', severity: 'critical' },
      ]);

      const result = injector.injectErrors([validatorResult], createMockContext(), 1);

      expect(result.summary).toContain('CRITICAL');
    });
  });
});
