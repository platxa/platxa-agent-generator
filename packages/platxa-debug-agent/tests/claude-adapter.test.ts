/**
 * Tests for ClaudeAdapter
 *
 * Verifies that ClaudeAdapter.format() produces properly structured
 * markdown with sections that Claude can parse.
 */

import { describe, expect, it } from 'vitest';
import {
  ClaudeAdapter,
  createClaudeAdapter,
  claudeAdapter,
  type DebugResults,
} from '../src/adapters/claude-adapter.js';
import type {
  NormalizedError,
  RootCauseHypothesis,
  FixSuggestion,
  ModuleAnalysisResult,
} from '../src/core/types.js';

describe('ClaudeAdapter', () => {
  const mockError: NormalizedError = {
    id: 'err-1',
    type: 'TypeError',
    message: "Cannot read property 'map' of undefined",
    severity: 'error',
    source: 'runtime',
    language: 'javascript',
    location: {
      file: 'src/utils.js',
      line: 42,
      column: 15,
    },
    raw: "TypeError: Cannot read property 'map' of undefined",
    timestamp: new Date('2025-01-12T10:00:00Z'),
  };

  const mockHypothesis: RootCauseHypothesis = {
    id: 'hyp-1',
    description: 'Variable is undefined when accessing .map()',
    confidence: 0.92,
    evidence: [
      {
        type: 'code',
        description: 'Variable not initialized before use',
        location: { file: 'src/utils.js', line: 40 },
        strength: 0.85,
      },
    ],
    suggestedFixes: [],
    relatedLocations: [{ file: 'src/utils.js', line: 40 }],
  };

  const mockFix: FixSuggestion = {
    id: 'fix-1',
    description: 'Add null check before calling .map()',
    confidence: 0.88,
    type: 'template',
    changes: [
      {
        file: 'src/utils.js',
        type: 'replace',
        start: { line: 42, column: 1 },
        end: { line: 42, column: 30 },
        originalContent: 'const result = data.map(fn);',
        newContent: 'const result = data ? data.map(fn) : [];',
      },
    ],
    validationSteps: [
      {
        type: 'typecheck',
        command: 'npx tsc --noEmit',
        expectedOutcome: 'No type errors',
      },
    ],
  };

  const mockResults: DebugResults = {
    errors: [mockError],
    hypotheses: [mockHypothesis],
    fixes: [mockFix],
    notes: ['Consider using optional chaining'],
    analysisTimeMs: 150,
  };

  describe('format()', () => {
    it('should produce markdown with header section', () => {
      const adapter = new ClaudeAdapter();
      const output = adapter.format(mockResults);

      expect(output).toContain('## 🔍 Debug Analysis Report');
      expect(output).toContain('| Property | Value |');
      expect(output).toContain('| Errors | 1 |');
    });

    it('should include errors section', () => {
      const adapter = new ClaudeAdapter();
      const output = adapter.format(mockResults);

      expect(output).toContain('## Errors');
      expect(output).toContain('### TypeError');
      expect(output).toContain("Cannot read property 'map' of undefined");
      expect(output).toContain('`src/utils.js:42:15`');
    });

    it('should include root cause analysis section', () => {
      const adapter = new ClaudeAdapter();
      const output = adapter.format(mockResults);

      expect(output).toContain('## Root Cause Analysis');
      expect(output).toContain('### Hypothesis 1');
      expect(output).toContain('Variable is undefined when accessing .map()');
      expect(output).toContain('**Confidence:** 92%');
    });

    it('should include suggested fixes section', () => {
      const adapter = new ClaudeAdapter();
      const output = adapter.format(mockResults);

      expect(output).toContain('## Suggested Fixes');
      expect(output).toContain('### Fix 1');
      expect(output).toContain('Add null check before calling .map()');
      expect(output).toContain('**Confidence:** 88%');
    });

    it('should include notes section', () => {
      const adapter = new ClaudeAdapter();
      const output = adapter.format(mockResults);

      expect(output).toContain('## Notes');
      expect(output).toContain('- Consider using optional chaining');
    });

    it('should include footer with analysis time', () => {
      const adapter = new ClaudeAdapter();
      const output = adapter.format(mockResults);

      expect(output).toContain('*Analysis completed in 150ms*');
    });

    it('should format ModuleAnalysisResult', () => {
      const moduleResult: ModuleAnalysisResult = {
        module: 'javascript',
        errors: [mockError],
        hypotheses: [mockHypothesis],
        fixes: [mockFix],
        notes: ['Test note'],
        analysisTimeMs: 100,
      };

      const adapter = new ClaudeAdapter();
      const output = adapter.format(moduleResult);

      expect(output).toContain('## 🔍 Debug Analysis Report');
      expect(output).toContain('### TypeError');
    });
  });

  describe('formatError()', () => {
    it('should format error with all fields', () => {
      const adapter = new ClaudeAdapter();
      const output = adapter.formatError(mockError);

      expect(output).toContain('### TypeError');
      expect(output).toContain('**Message:**');
      expect(output).toContain('**Location:**');
      expect(output).toContain('**Severity:** 🔴 Error');
      expect(output).toContain('**Language:** javascript');
    });

    it('should format error with stack trace', () => {
      const errorWithStack: NormalizedError = {
        ...mockError,
        stackTrace: [
          {
            functionName: 'processData',
            location: { file: 'src/utils.js', line: 42 },
          },
          {
            functionName: 'handleRequest',
            location: { file: 'src/handler.js', line: 15 },
          },
        ],
      };

      const adapter = new ClaudeAdapter();
      const output = adapter.formatError(errorWithStack);

      expect(output).toContain('**Stack Trace:**');
      expect(output).toContain('at processData');
      expect(output).toContain('at handleRequest');
    });

    it('should include raw error when option enabled', () => {
      const adapter = new ClaudeAdapter({ includeRaw: true });
      const output = adapter.formatError(mockError);

      expect(output).toContain('<details>');
      expect(output).toContain('<summary>Raw Error</summary>');
      expect(output).toContain(mockError.raw);
    });
  });

  describe('formatHypothesis()', () => {
    it('should format hypothesis with confidence bar', () => {
      const adapter = new ClaudeAdapter();
      const output = adapter.formatHypothesis(mockHypothesis, 0);

      expect(output).toContain('### Hypothesis 1');
      expect(output).toContain('92%');
      expect(output).toContain('█'); // Progress bar
    });

    it('should include evidence when option enabled', () => {
      const adapter = new ClaudeAdapter({ includeEvidence: true });
      const output = adapter.formatHypothesis(mockHypothesis, 0);

      expect(output).toContain('**Evidence:**');
      expect(output).toContain('[code]');
      expect(output).toContain('strength: 85%');
    });

    it('should hide evidence when option disabled', () => {
      const adapter = new ClaudeAdapter({ includeEvidence: false });
      const output = adapter.formatHypothesis(mockHypothesis, 0);

      expect(output).not.toContain('**Evidence:**');
    });
  });

  describe('formatFix()', () => {
    it('should format fix with code changes', () => {
      const adapter = new ClaudeAdapter({ includeCodeChanges: true });
      const output = adapter.formatFix(mockFix, 0);

      expect(output).toContain('### Fix 1');
      expect(output).toContain('**Changes:**');
      expect(output).toContain('```diff');
      expect(output).toContain('- const result = data.map(fn);');
      expect(output).toContain('+ const result = data ? data.map(fn) : [];');
    });

    it('should include validation steps when option enabled', () => {
      const adapter = new ClaudeAdapter({ includeValidation: true });
      const output = adapter.formatFix(mockFix, 0);

      expect(output).toContain('**Validation:**');
      expect(output).toContain('[typecheck]');
      expect(output).toContain('npx tsc --noEmit');
    });
  });

  describe('options', () => {
    it('should limit number of fixes shown', () => {
      const manyFixes: FixSuggestion[] = Array.from({ length: 10 }, (_, i) => ({
        ...mockFix,
        id: `fix-${i}`,
        confidence: 0.9 - i * 0.05,
      }));

      const results: DebugResults = {
        errors: [mockError],
        hypotheses: [],
        fixes: manyFixes,
      };

      const adapter = new ClaudeAdapter({ maxFixes: 3 });
      const output = adapter.format(results);

      expect(output).toContain('### Fix 1');
      expect(output).toContain('### Fix 2');
      expect(output).toContain('### Fix 3');
      expect(output).not.toContain('### Fix 4');
      expect(output).toContain('*7 additional fixes not shown*');
    });

    it('should use compact mode', () => {
      const adapter = new ClaudeAdapter({ compact: true });
      const output = adapter.formatHypothesis(mockHypothesis, 0);

      // Compact mode should not include progress bar
      expect(output).toContain('92%');
      expect(output).not.toContain('░'); // No empty blocks in compact
    });
  });

  describe('factory and exports', () => {
    it('should create adapter with factory function', () => {
      const adapter = createClaudeAdapter({ maxFixes: 10 });
      expect(adapter).toBeInstanceOf(ClaudeAdapter);
    });

    it('should export default adapter instance', () => {
      expect(claudeAdapter).toBeInstanceOf(ClaudeAdapter);
      const output = claudeAdapter.format(mockResults);
      expect(output).toContain('## 🔍 Debug Analysis Report');
    });
  });

  describe('severity formatting', () => {
    it('should format different severities with icons', () => {
      const adapter = new ClaudeAdapter();

      const errorOutput = adapter.formatError({ ...mockError, severity: 'error' });
      expect(errorOutput).toContain('🔴 Error');

      const warnOutput = adapter.formatError({ ...mockError, severity: 'warning' });
      expect(warnOutput).toContain('🟡 Warning');

      const infoOutput = adapter.formatError({ ...mockError, severity: 'info' });
      expect(infoOutput).toContain('🔵 Info');

      const hintOutput = adapter.formatError({ ...mockError, severity: 'hint' });
      expect(hintOutput).toContain('💡 Hint');
    });
  });

  describe('edge cases', () => {
    it('should handle empty results', () => {
      const emptyResults: DebugResults = {
        errors: [],
        hypotheses: [],
        fixes: [],
      };

      const adapter = new ClaudeAdapter();
      const output = adapter.format(emptyResults);

      expect(output).toContain('## 🔍 Debug Analysis Report');
      expect(output).not.toContain('## Errors');
      expect(output).not.toContain('## Root Cause Analysis');
      expect(output).not.toContain('## Suggested Fixes');
    });

    it('should handle error without location', () => {
      const errorNoLoc: NormalizedError = {
        ...mockError,
        location: undefined,
      };

      const adapter = new ClaudeAdapter();
      const output = adapter.formatError(errorNoLoc);

      expect(output).not.toContain('**Location:**');
    });

    it('should handle fix without changes', () => {
      const fixNoChanges: FixSuggestion = {
        ...mockFix,
        changes: [],
      };

      const adapter = new ClaudeAdapter();
      const output = adapter.formatFix(fixNoChanges, 0);

      expect(output).not.toContain('**Changes:**');
    });
  });
});
