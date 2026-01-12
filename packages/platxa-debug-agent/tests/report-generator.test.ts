/**
 * Tests for ReportGenerator
 *
 * Verifies CI/CD report generation in various formats.
 * Features #21-25
 */

import { describe, expect, it } from 'vitest';
import {
  ReportGenerator,
  createReportGenerator,
  reportGenerator,
  type DebugResults,
  type DebugError,
  type Hypothesis,
  type SuggestedFix,
} from '../src/reporting/report-generator.js';

// =============================================================================
// Test Data
// =============================================================================

function createTestResults(): DebugResults {
  const errors: DebugError[] = [
    {
      id: 'err-1',
      message: 'Variable x is undefined',
      type: 'ReferenceError',
      severity: 'error',
      location: { file: 'src/utils.ts', line: 42, column: 10 },
      ruleId: 'no-undef',
      codeSnippet: 'console.log(x);',
    },
    {
      id: 'err-2',
      message: 'Unused variable y',
      type: 'UnusedVariable',
      severity: 'warning',
      location: { file: 'src/utils.ts', line: 50 },
      ruleId: 'no-unused-vars',
    },
    {
      id: 'err-3',
      message: 'Consider using const instead of let',
      type: 'StyleSuggestion',
      severity: 'info',
      location: { file: 'src/index.ts', line: 10, column: 1 },
    },
  ];

  const hypotheses: Hypothesis[] = [
    {
      id: 'hyp-1',
      errorId: 'err-1',
      description: 'Variable x was not declared before use',
      confidence: 0.9,
      evidence: ['No declaration found in scope', 'Similar pattern in other files'],
    },
    {
      id: 'hyp-2',
      errorId: 'err-2',
      description: 'Variable y was assigned but never read',
      confidence: 0.85,
      evidence: ['No usage found after assignment'],
    },
  ];

  const fixes: SuggestedFix[] = [
    {
      id: 'fix-1',
      errorId: 'err-1',
      description: 'Declare variable x before use',
      before: 'console.log(x);',
      after: 'const x = undefined;\nconsole.log(x);',
      file: 'src/utils.ts',
      lineRange: { start: 42, end: 42 },
      confidence: 0.8,
      autoApplicable: true,
    },
    {
      id: 'fix-2',
      errorId: 'err-2',
      description: 'Remove unused variable y',
      before: 'const y = 10;',
      after: '',
      file: 'src/utils.ts',
      lineRange: { start: 50, end: 50 },
      confidence: 0.95,
      autoApplicable: true,
    },
  ];

  return {
    sessionId: 'test-session-123',
    timestamp: new Date('2024-01-15T10:30:00Z'),
    errors,
    hypotheses,
    fixes,
    metadata: {
      analysisTimeMs: 150,
      toolVersion: '0.1.0',
      projectName: 'test-project',
    },
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('ReportGenerator', () => {
  describe('generateReport()', () => {
    it('should generate report in specified format', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const checkstyle = generator.generateReport(results, 'checkstyle');
      expect(checkstyle).toContain('<?xml');
      expect(checkstyle).toContain('<checkstyle');

      const json = generator.generateReport(results, 'json');
      expect(() => JSON.parse(json)).not.toThrow();

      const markdown = generator.generateReport(results, 'markdown');
      expect(markdown).toContain('# Debug Report');
    });

    it('should throw for unsupported format', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      expect(() => generator.generateReport(results, 'invalid' as never)).toThrow(
        'Unsupported report format'
      );
    });
  });

  // ===========================================================================
  // Feature #21: Generate valid Checkstyle XML structure
  // ===========================================================================

  describe('Feature #21: Checkstyle XML structure', () => {
    it('should generate valid XML with checkstyle root element', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const xml = generator.generateReport(results, 'checkstyle');

      // Verify XML declaration
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');

      // Verify checkstyle root element with version
      expect(xml).toContain('<checkstyle version="8.0">');
      expect(xml).toContain('</checkstyle>');
    });

    it('should produce well-formed XML', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const xml = generator.generateReport(results, 'checkstyle');

      // Basic XML structure checks
      expect(xml.indexOf('<checkstyle')).toBeLessThan(xml.indexOf('</checkstyle>'));
      expect(xml.split('<file').length - 1).toBe(xml.split('</file>').length - 1);
    });

    it('should escape special characters in XML', () => {
      const generator = new ReportGenerator();
      const results: DebugResults = {
        ...createTestResults(),
        errors: [{
          id: 'err-special',
          message: 'Error with <special> & "characters"',
          type: 'SpecialError',
          severity: 'error',
          location: { file: 'src/test.ts', line: 1 },
        }],
      };

      const xml = generator.generateReport(results, 'checkstyle');

      expect(xml).toContain('&lt;special&gt;');
      expect(xml).toContain('&amp;');
      expect(xml).toContain('&quot;characters&quot;');
      expect(xml).not.toContain('<special>');
    });
  });

  // ===========================================================================
  // Feature #22: Include file elements with error children
  // ===========================================================================

  describe('Feature #22: File elements with error children', () => {
    it('should have file elements per source file', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const xml = generator.generateReport(results, 'checkstyle');

      // Should have file elements for each unique file
      expect(xml).toContain('<file name="src/utils.ts">');
      expect(xml).toContain('<file name="src/index.ts">');
    });

    it('should have error elements as children of file elements', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const xml = generator.generateReport(results, 'checkstyle');

      // Verify error elements appear between file tags
      const utilsFileStart = xml.indexOf('<file name="src/utils.ts">');
      const utilsFileEnd = xml.indexOf('</file>', utilsFileStart);
      const utilsSection = xml.substring(utilsFileStart, utilsFileEnd);

      expect(utilsSection).toContain('<error');
      expect(utilsSection).toContain('line="42"');
      expect(utilsSection).toContain('line="50"');
    });

    it('should include line and column attributes', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const xml = generator.generateReport(results, 'checkstyle');

      // Error with column
      expect(xml).toContain('line="42" column="10"');

      // Error without column should not have column attribute
      const err2Match = xml.match(/line="50"[^>]*>/);
      expect(err2Match).toBeTruthy();
      expect(err2Match![0]).not.toContain('column=');
    });

    it('should include message and source attributes', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const xml = generator.generateReport(results, 'checkstyle');

      expect(xml).toContain('message="Variable x is undefined"');
      expect(xml).toContain('source="platxa-debug-agent.no-undef"');
    });

    it('should group multiple errors in same file', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const xml = generator.generateReport(results, 'checkstyle');

      // Count file elements - should be 2 (utils.ts and index.ts)
      const fileMatches = xml.match(/<file name=/g);
      expect(fileMatches).toHaveLength(2);

      // utils.ts should have 2 errors
      const utilsStart = xml.indexOf('<file name="src/utils.ts">');
      const utilsEnd = xml.indexOf('</file>', utilsStart);
      const utilsSection = xml.substring(utilsStart, utilsEnd);
      const errorMatches = utilsSection.match(/<error/g);
      expect(errorMatches).toHaveLength(2);
    });
  });

  // ===========================================================================
  // Feature #23: Map severity correctly in Checkstyle
  // ===========================================================================

  describe('Feature #23: Checkstyle severity mapping', () => {
    it('should map error severity to error', () => {
      const generator = new ReportGenerator();
      const results: DebugResults = {
        ...createTestResults(),
        errors: [{
          id: 'err',
          message: 'Error message',
          type: 'TestError',
          severity: 'error',
          location: { file: 'test.ts', line: 1 },
        }],
      };

      const xml = generator.generateReport(results, 'checkstyle');
      expect(xml).toContain('severity="error"');
    });

    it('should map warning severity to warning', () => {
      const generator = new ReportGenerator();
      const results: DebugResults = {
        ...createTestResults(),
        errors: [{
          id: 'warn',
          message: 'Warning message',
          type: 'TestWarning',
          severity: 'warning',
          location: { file: 'test.ts', line: 1 },
        }],
      };

      const xml = generator.generateReport(results, 'checkstyle');
      expect(xml).toContain('severity="warning"');
    });

    it('should map info severity to info', () => {
      const generator = new ReportGenerator();
      const results: DebugResults = {
        ...createTestResults(),
        errors: [{
          id: 'info',
          message: 'Info message',
          type: 'TestInfo',
          severity: 'info',
          location: { file: 'test.ts', line: 1 },
        }],
      };

      const xml = generator.generateReport(results, 'checkstyle');
      expect(xml).toContain('severity="info"');
    });

    it('should have correct severity for each error in full report', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const xml = generator.generateReport(results, 'checkstyle');

      // Check each error has correct severity
      expect(xml).toMatch(/line="42"[^>]*severity="error"/);
      expect(xml).toMatch(/line="50"[^>]*severity="warning"/);
      expect(xml).toMatch(/line="10"[^>]*severity="info"/);
    });
  });

  // ===========================================================================
  // Feature #24: Generate valid JSON report structure
  // ===========================================================================

  describe('Feature #24: JSON report structure', () => {
    it('should generate valid JSON', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const json = generator.generateReport(results, 'json');

      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should have errors array', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const json = generator.generateReport(results, 'json');
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed.errors)).toBe(true);
      expect(parsed.errors.length).toBe(3);
    });

    it('should have hypotheses array', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const json = generator.generateReport(results, 'json');
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed.hypotheses)).toBe(true);
      expect(parsed.hypotheses.length).toBe(2);
    });

    it('should have fixes array', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const json = generator.generateReport(results, 'json');
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed.fixes)).toBe(true);
      expect(parsed.fixes.length).toBe(2);
    });

    it('should include summary statistics', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const json = generator.generateReport(results, 'json');
      const parsed = JSON.parse(json);

      expect(parsed.summary).toBeDefined();
      expect(parsed.summary.totalErrors).toBe(3);
      expect(parsed.summary.totalHypotheses).toBe(2);
      expect(parsed.summary.totalFixes).toBe(2);
      expect(parsed.summary.errorsBySeverity).toBeDefined();
      expect(parsed.summary.errorsBySeverity.error).toBe(1);
      expect(parsed.summary.errorsBySeverity.warning).toBe(1);
      expect(parsed.summary.errorsBySeverity.info).toBe(1);
    });

    it('should include generator metadata', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const json = generator.generateReport(results, 'json');
      const parsed = JSON.parse(json);

      expect(parsed.generator).toBeDefined();
      expect(parsed.generator.name).toBe('platxa-debug-agent');
      expect(parsed.version).toBe('1.0');
    });

    it('should include error details in correct structure', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const json = generator.generateReport(results, 'json');
      const parsed = JSON.parse(json);

      const firstError = parsed.errors[0];
      expect(firstError.id).toBe('err-1');
      expect(firstError.type).toBe('ReferenceError');
      expect(firstError.severity).toBe('error');
      expect(firstError.message).toBe('Variable x is undefined');
      expect(firstError.location).toBeDefined();
      expect(firstError.location.file).toBe('src/utils.ts');
      expect(firstError.location.line).toBe(42);
    });

    it('should include hypothesis details in correct structure', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const json = generator.generateReport(results, 'json');
      const parsed = JSON.parse(json);

      const firstHypothesis = parsed.hypotheses[0];
      expect(firstHypothesis.id).toBe('hyp-1');
      expect(firstHypothesis.errorId).toBe('err-1');
      expect(firstHypothesis.description).toContain('Variable x');
      expect(firstHypothesis.confidence).toBe(0.9);
      expect(Array.isArray(firstHypothesis.evidence)).toBe(true);
    });

    it('should include fix details in correct structure', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const json = generator.generateReport(results, 'json');
      const parsed = JSON.parse(json);

      const firstFix = parsed.fixes[0];
      expect(firstFix.id).toBe('fix-1');
      expect(firstFix.errorId).toBe('err-1');
      expect(firstFix.description).toContain('Declare variable');
      expect(firstFix.confidence).toBe(0.8);
      expect(firstFix.autoApplicable).toBe(true);
    });
  });

  // ===========================================================================
  // Feature #25: Generate PR comment body with summary
  // ===========================================================================

  describe('Feature #25: PR comments with summary', () => {
    it('should return array of PR comments', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const comments = generator.generatePRComments(results);

      expect(Array.isArray(comments)).toBe(true);
      expect(comments.length).toBeGreaterThan(0);
    });

    it('should have a summary comment', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const comments = generator.generatePRComments(results);

      const summaryComment = comments.find((c) => c.isSummary);
      expect(summaryComment).toBeDefined();
    });

    it('should include summary statistics in summary comment', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const comments = generator.generatePRComments(results);
      const summaryComment = comments.find((c) => c.isSummary);

      expect(summaryComment!.body).toContain('Summary');
      expect(summaryComment!.body).toContain('Errors');
      expect(summaryComment!.body).toContain('Warnings');
    });

    it('should include inline comments for errors with fixes', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const comments = generator.generatePRComments(results);

      const inlineComments = comments.filter((c) => !c.isSummary);
      expect(inlineComments.length).toBeGreaterThan(0);

      // Check inline comment has path and line
      const firstInline = inlineComments[0];
      expect(firstInline!.path).toBeDefined();
      expect(firstInline!.line).toBeDefined();
    });

    it('should include fix suggestions in inline comments', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const comments = generator.generatePRComments(results);
      const inlineComments = comments.filter((c) => !c.isSummary);

      const commentWithFix = inlineComments.find((c) => c.body.includes('Suggested fix'));
      expect(commentWithFix).toBeDefined();
    });

    it('should handle results with no errors', () => {
      const generator = new ReportGenerator();
      const results: DebugResults = {
        sessionId: 'test',
        timestamp: new Date(),
        errors: [],
        hypotheses: [],
        fixes: [],
      };

      const comments = generator.generatePRComments(results);

      expect(comments.length).toBe(1);
      expect(comments[0]!.isSummary).toBe(true);
      expect(comments[0]!.body).toContain('No issues detected');
    });
  });

  // ===========================================================================
  // Other formats
  // ===========================================================================

  describe('SARIF format', () => {
    it('should generate valid SARIF 2.1.0', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const sarif = generator.generateReport(results, 'sarif');
      const parsed = JSON.parse(sarif);

      expect(parsed.$schema).toContain('sarif-schema-2.1.0');
      expect(parsed.version).toBe('2.1.0');
      expect(Array.isArray(parsed.runs)).toBe(true);
    });

    it('should include tool information', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const sarif = generator.generateReport(results, 'sarif');
      const parsed = JSON.parse(sarif);

      expect(parsed.runs[0].tool.driver.name).toBe('platxa-debug-agent');
    });

    it('should include results with locations', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const sarif = generator.generateReport(results, 'sarif');
      const parsed = JSON.parse(sarif);

      expect(parsed.runs[0].results.length).toBe(3);
      expect(parsed.runs[0].results[0].locations[0].physicalLocation).toBeDefined();
    });
  });

  describe('Markdown format', () => {
    it('should generate valid markdown', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const md = generator.generateReport(results, 'markdown');

      expect(md).toContain('# Debug Report');
      expect(md).toContain('## Summary');
      expect(md).toContain('## Errors');
    });

    it('should include error details', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const md = generator.generateReport(results, 'markdown');

      expect(md).toContain('ReferenceError');
      expect(md).toContain('src/utils.ts:42');
    });
  });

  describe('HTML format', () => {
    it('should generate valid HTML', () => {
      const generator = new ReportGenerator();
      const results = createTestResults();

      const html = generator.generateReport(results, 'html');

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
    });
  });

  // ===========================================================================
  // Options
  // ===========================================================================

  describe('options', () => {
    it('should respect maxErrorsPerFile option', () => {
      const generator = new ReportGenerator({ maxErrorsPerFile: 1 });
      const results: DebugResults = {
        sessionId: 'test',
        timestamp: new Date(),
        errors: [
          { id: '1', message: 'Error 1', type: 'E', severity: 'error', location: { file: 'f.ts', line: 1 } },
          { id: '2', message: 'Error 2', type: 'E', severity: 'error', location: { file: 'f.ts', line: 2 } },
          { id: '3', message: 'Error 3', type: 'E', severity: 'error', location: { file: 'f.ts', line: 3 } },
        ],
        hypotheses: [],
        fixes: [],
      };

      const xml = generator.generateReport(results, 'checkstyle');
      const errorMatches = xml.match(/<error/g);
      expect(errorMatches).toHaveLength(1);
    });

    it('should include snippets when enabled', () => {
      const generator = new ReportGenerator({ includeSnippets: true });
      const results = createTestResults();

      const json = generator.generateReport(results, 'json');
      const parsed = JSON.parse(json);

      expect(parsed.errors[0].codeSnippet).toBe('console.log(x);');
    });

    it('should exclude snippets when disabled', () => {
      const generator = new ReportGenerator({ includeSnippets: false });
      const results = createTestResults();

      const json = generator.generateReport(results, 'json');
      const parsed = JSON.parse(json);

      expect(parsed.errors[0].codeSnippet).toBeUndefined();
    });

    it('should use custom tool name', () => {
      const generator = new ReportGenerator({ toolName: 'custom-tool' });
      const results = createTestResults();

      const xml = generator.generateReport(results, 'checkstyle');
      expect(xml).toContain('source="custom-tool.');
    });
  });

  // ===========================================================================
  // Factory and exports
  // ===========================================================================

  describe('factory and exports', () => {
    it('should create generator with factory function', () => {
      const generator = createReportGenerator({ maxErrorsPerFile: 50 });
      expect(generator).toBeInstanceOf(ReportGenerator);
    });

    it('should export default generator instance', () => {
      expect(reportGenerator).toBeInstanceOf(ReportGenerator);
    });
  });
});
