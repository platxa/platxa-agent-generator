/**
 * Tests for VS Code Diagnostics Adapter
 *
 * Verifies conversion from normalized errors to VS Code diagnostics.
 * Features #31-35
 */

import { describe, expect, it } from 'vitest';
import {
  VSCodeDiagnosticsConverter,
  VSCodeDiagnosticSeverity,
  createVSCodeDiagnosticsConverter,
  convertToDiagnostic,
  convertToDiagnostics,
  vscodeDiagnosticsConverter,
  type NormalizedError,
} from '../src/adapters/vscode-diagnostics.js';

// =============================================================================
// Test Data
// =============================================================================

function createTestError(overrides: Partial<NormalizedError> = {}): NormalizedError {
  return {
    id: 'err-1',
    message: 'Test error message',
    type: 'TypeError',
    severity: 'error',
    location: {
      file: 'src/utils.ts',
      line: 10,
      column: 5,
    },
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('VSCodeDiagnosticsConverter', () => {
  // ===========================================================================
  // Feature #31: Convert normalized error to VS Code diagnostic
  // ===========================================================================

  describe('Feature #31: convertToDiagnostic', () => {
    it('should return VSCodeDiagnostic with correct range', () => {
      const converter = new VSCodeDiagnosticsConverter();
      const error = createTestError({
        location: { file: 'test.ts', line: 10, column: 5 },
      });

      const diagnostic = converter.convertToDiagnostic(error);

      expect(diagnostic.range).toBeDefined();
      expect(diagnostic.range.start).toBeDefined();
      expect(diagnostic.range.end).toBeDefined();
    });

    it('should return VSCodeDiagnostic with correct message', () => {
      const converter = new VSCodeDiagnosticsConverter();
      const error = createTestError({ message: 'Custom error message' });

      const diagnostic = converter.convertToDiagnostic(error);

      expect(diagnostic.message).toBe('Custom error message');
    });

    it('should return VSCodeDiagnostic with correct severity', () => {
      const converter = new VSCodeDiagnosticsConverter();
      const error = createTestError({ severity: 'error' });

      const diagnostic = converter.convertToDiagnostic(error);

      expect(diagnostic.severity).toBe(VSCodeDiagnosticSeverity.Error);
    });

    it('should return VSCodeDiagnostic with source', () => {
      const converter = new VSCodeDiagnosticsConverter({ source: 'test-source' });
      const error = createTestError();

      const diagnostic = converter.convertToDiagnostic(error);

      expect(diagnostic.source).toBe('test-source');
    });

    it('should convert multiple errors', () => {
      const converter = new VSCodeDiagnosticsConverter();
      const errors = [
        createTestError({ message: 'Error 1' }),
        createTestError({ message: 'Error 2' }),
        createTestError({ message: 'Error 3' }),
      ];

      const diagnostics = converter.convertToDiagnostics(errors);

      expect(diagnostics).toHaveLength(3);
      expect(diagnostics[0]!.message).toBe('Error 1');
      expect(diagnostics[1]!.message).toBe('Error 2');
      expect(diagnostics[2]!.message).toBe('Error 3');
    });
  });

  // ===========================================================================
  // Feature #32: Map error severity to VS Code severity correctly
  // ===========================================================================

  describe('Feature #32: Severity mapping', () => {
    it('should map error to VSCodeDiagnosticSeverity.Error', () => {
      const converter = new VSCodeDiagnosticsConverter();

      expect(converter.mapSeverity('error')).toBe(VSCodeDiagnosticSeverity.Error);
    });

    it('should map warning to VSCodeDiagnosticSeverity.Warning', () => {
      const converter = new VSCodeDiagnosticsConverter();

      expect(converter.mapSeverity('warning')).toBe(VSCodeDiagnosticSeverity.Warning);
    });

    it('should map info to VSCodeDiagnosticSeverity.Information', () => {
      const converter = new VSCodeDiagnosticsConverter();

      expect(converter.mapSeverity('info')).toBe(VSCodeDiagnosticSeverity.Information);
    });

    it('should map hint to VSCodeDiagnosticSeverity.Hint', () => {
      const converter = new VSCodeDiagnosticsConverter();

      expect(converter.mapSeverity('hint')).toBe(VSCodeDiagnosticSeverity.Hint);
    });

    it('should use custom severity mapping when provided', () => {
      const converter = new VSCodeDiagnosticsConverter({
        severityMapping: {
          error: VSCodeDiagnosticSeverity.Warning,
          warning: VSCodeDiagnosticSeverity.Information,
        },
      });

      expect(converter.mapSeverity('error')).toBe(VSCodeDiagnosticSeverity.Warning);
      expect(converter.mapSeverity('warning')).toBe(VSCodeDiagnosticSeverity.Information);
      expect(converter.mapSeverity('info')).toBe(VSCodeDiagnosticSeverity.Information); // Default
    });

    it('should apply severity in converted diagnostic', () => {
      const converter = new VSCodeDiagnosticsConverter();

      const errorDiag = converter.convertToDiagnostic(createTestError({ severity: 'error' }));
      const warnDiag = converter.convertToDiagnostic(createTestError({ severity: 'warning' }));
      const infoDiag = converter.convertToDiagnostic(createTestError({ severity: 'info' }));
      const hintDiag = converter.convertToDiagnostic(createTestError({ severity: 'hint' }));

      expect(errorDiag.severity).toBe(VSCodeDiagnosticSeverity.Error);
      expect(warnDiag.severity).toBe(VSCodeDiagnosticSeverity.Warning);
      expect(infoDiag.severity).toBe(VSCodeDiagnosticSeverity.Information);
      expect(hintDiag.severity).toBe(VSCodeDiagnosticSeverity.Hint);
    });
  });

  // ===========================================================================
  // Feature #33: Convert 1-based line numbers to 0-based
  // ===========================================================================

  describe('Feature #33: Line number conversion', () => {
    it('should convert line 1 to VS Code line 0', () => {
      const converter = new VSCodeDiagnosticsConverter();
      const error = createTestError({
        location: { file: 'test.ts', line: 1 },
      });

      const diagnostic = converter.convertToDiagnostic(error);

      expect(diagnostic.range.start.line).toBe(0);
    });

    it('should convert line 10 to VS Code line 9', () => {
      const converter = new VSCodeDiagnosticsConverter();
      const error = createTestError({
        location: { file: 'test.ts', line: 10 },
      });

      const diagnostic = converter.convertToDiagnostic(error);

      expect(diagnostic.range.start.line).toBe(9);
    });

    it('should convert column 1 to VS Code character 0', () => {
      const converter = new VSCodeDiagnosticsConverter();
      const error = createTestError({
        location: { file: 'test.ts', line: 1, column: 1 },
      });

      const diagnostic = converter.convertToDiagnostic(error);

      expect(diagnostic.range.start.character).toBe(0);
    });

    it('should convert column 5 to VS Code character 4', () => {
      const converter = new VSCodeDiagnosticsConverter();
      const error = createTestError({
        location: { file: 'test.ts', line: 1, column: 5 },
      });

      const diagnostic = converter.convertToDiagnostic(error);

      expect(diagnostic.range.start.character).toBe(4);
    });

    it('should convert end line and column correctly', () => {
      const converter = new VSCodeDiagnosticsConverter();
      const error = createTestError({
        location: {
          file: 'test.ts',
          line: 10,
          column: 5,
          endLine: 12,
          endColumn: 20,
        },
      });

      const diagnostic = converter.convertToDiagnostic(error);

      expect(diagnostic.range.start.line).toBe(9);
      expect(diagnostic.range.start.character).toBe(4);
      expect(diagnostic.range.end.line).toBe(11);
      expect(diagnostic.range.end.character).toBe(19);
    });

    it('should handle missing column by defaulting to 0', () => {
      const converter = new VSCodeDiagnosticsConverter();
      const error = createTestError({
        location: { file: 'test.ts', line: 5 },
      });

      const diagnostic = converter.convertToDiagnostic(error);

      expect(diagnostic.range.start.character).toBe(0);
    });

    it('should handle missing end line by using start line', () => {
      const converter = new VSCodeDiagnosticsConverter();
      const error = createTestError({
        location: { file: 'test.ts', line: 5, column: 10 },
      });

      const diagnostic = converter.convertToDiagnostic(error);

      expect(diagnostic.range.end.line).toBe(diagnostic.range.start.line);
    });

    it('should not produce negative line numbers', () => {
      const converter = new VSCodeDiagnosticsConverter();
      const error = createTestError({
        location: { file: 'test.ts', line: 0, column: 0 },
      });

      const diagnostic = converter.convertToDiagnostic(error);

      expect(diagnostic.range.start.line).toBeGreaterThanOrEqual(0);
      expect(diagnostic.range.start.character).toBeGreaterThanOrEqual(0);
    });
  });

  // ===========================================================================
  // Feature #34: Include error type as diagnostic code
  // ===========================================================================

  describe('Feature #34: Diagnostic code from error type', () => {
    it('should set diagnostic code to error.type when present', () => {
      const converter = new VSCodeDiagnosticsConverter();
      const error = createTestError({ type: 'ReferenceError' });

      const diagnostic = converter.convertToDiagnostic(error);

      expect(diagnostic.code).toBe('ReferenceError');
    });

    it('should use ruleId as code when type is not present', () => {
      const converter = new VSCodeDiagnosticsConverter();
      const error = createTestError({ type: undefined, ruleId: 'no-unused-vars' });

      const diagnostic = converter.convertToDiagnostic(error);

      expect(diagnostic.code).toBe('no-unused-vars');
    });

    it('should prefer type over ruleId', () => {
      const converter = new VSCodeDiagnosticsConverter();
      const error = createTestError({ type: 'TypeError', ruleId: 'some-rule' });

      const diagnostic = converter.convertToDiagnostic(error);

      expect(diagnostic.code).toBe('TypeError');
    });

    it('should not set code when neither type nor ruleId present', () => {
      const converter = new VSCodeDiagnosticsConverter();
      const error = createTestError({ type: undefined, ruleId: undefined });

      const diagnostic = converter.convertToDiagnostic(error);

      expect(diagnostic.code).toBeUndefined();
    });
  });

  // ===========================================================================
  // Feature #35: Include related information from stack trace
  // ===========================================================================

  describe('Feature #35: Related information from stack trace', () => {
    it('should populate relatedInformation from stack trace frames', () => {
      const converter = new VSCodeDiagnosticsConverter({ includeRelatedInfo: true });
      const error = createTestError({
        location: { file: 'src/main.ts', line: 10 },
        stackTrace: `Error: Test error
    at doSomething (src/utils.ts:25:10)
    at processData (src/processor.ts:50:5)
    at main (src/main.ts:10:1)`,
      });

      const diagnostic = converter.convertToDiagnostic(error);

      expect(diagnostic.relatedInformation).toBeDefined();
      expect(diagnostic.relatedInformation!.length).toBeGreaterThan(0);
    });

    it('should exclude frames from the same file as the error', () => {
      const converter = new VSCodeDiagnosticsConverter({ includeRelatedInfo: true });
      const error = createTestError({
        location: { file: 'src/main.ts', line: 10 },
        stackTrace: `Error: Test error
    at helper (src/main.ts:5:1)
    at other (src/other.ts:20:5)`,
      });

      const diagnostic = converter.convertToDiagnostic(error);

      // Should only include src/other.ts, not src/main.ts
      const files = diagnostic.relatedInformation?.map((r) => r.location.uri) ?? [];
      expect(files.some((f) => f.includes('other.ts'))).toBe(true);
      expect(files.every((f) => !f.includes('main.ts'))).toBe(true);
    });

    it('should respect maxRelatedFrames option', () => {
      const converter = new VSCodeDiagnosticsConverter({
        includeRelatedInfo: true,
        maxRelatedFrames: 2,
      });
      const error = createTestError({
        location: { file: 'src/main.ts', line: 10 },
        stackTrace: `Error: Test error
    at a (src/a.ts:1:1)
    at b (src/b.ts:2:1)
    at c (src/c.ts:3:1)
    at d (src/d.ts:4:1)
    at e (src/e.ts:5:1)`,
      });

      const diagnostic = converter.convertToDiagnostic(error);

      expect(diagnostic.relatedInformation!.length).toBeLessThanOrEqual(2);
    });

    it('should not include relatedInformation when disabled', () => {
      const converter = new VSCodeDiagnosticsConverter({ includeRelatedInfo: false });
      const error = createTestError({
        stackTrace: `Error: Test
    at test (src/test.ts:1:1)`,
      });

      const diagnostic = converter.convertToDiagnostic(error);

      expect(diagnostic.relatedInformation).toBeUndefined();
    });

    it('should handle V8/Node.js stack trace format', () => {
      const converter = new VSCodeDiagnosticsConverter();
      const frames = converter.parseStackTrace(`Error: Something went wrong
    at Object.<anonymous> (/app/src/index.js:10:15)
    at Module._compile (internal/modules/cjs/loader.js:1063:30)
    at processData (/app/src/utils.js:25:5)`);

      expect(frames.length).toBeGreaterThan(0);
      expect(frames[0]!.file).toBe('/app/src/index.js');
      expect(frames[0]!.line).toBe(10);
      expect(frames[0]!.column).toBe(15);
    });

    it('should handle Firefox stack trace format', () => {
      const converter = new VSCodeDiagnosticsConverter();
      const frames = converter.parseStackTrace(`doSomething@http://example.com/src/utils.js:25:10
main@http://example.com/src/main.js:10:1`);

      expect(frames.length).toBe(2);
      expect(frames[0]!.functionName).toBe('doSomething');
    });

    it('should handle simple file:line format', () => {
      const converter = new VSCodeDiagnosticsConverter();
      const frames = converter.parseStackTrace(`src/utils.ts:25
src/main.ts:10:5`);

      expect(frames.length).toBe(2);
      expect(frames[0]!.file).toBe('src/utils.ts');
      expect(frames[0]!.line).toBe(25);
      expect(frames[1]!.column).toBe(5);
    });
  });

  // ===========================================================================
  // Utility Functions
  // ===========================================================================

  describe('convertAndGroupByFile()', () => {
    it('should group diagnostics by file URI', () => {
      const converter = new VSCodeDiagnosticsConverter();
      const errors = [
        createTestError({ location: { file: 'src/a.ts', line: 1 } }),
        createTestError({ location: { file: 'src/b.ts', line: 1 } }),
        createTestError({ location: { file: 'src/a.ts', line: 5 } }),
      ];

      const grouped = converter.convertAndGroupByFile(errors);

      expect(grouped.size).toBe(2);
      expect(grouped.get('src/a.ts')?.length).toBe(2);
      expect(grouped.get('src/b.ts')?.length).toBe(1);
    });
  });

  describe('fileToUri()', () => {
    it('should convert absolute Unix path to file URI', () => {
      const converter = new VSCodeDiagnosticsConverter();
      const uri = converter.fileToUri('/home/user/project/src/file.ts');

      expect(uri).toBe('file:///home/user/project/src/file.ts');
    });

    it('should convert Windows path to file URI', () => {
      const converter = new VSCodeDiagnosticsConverter();
      const uri = converter.fileToUri('C:\\Users\\user\\project\\src\\file.ts');

      expect(uri).toBe('file:///C:/Users/user/project/src/file.ts');
    });

    it('should return relative paths as-is', () => {
      const converter = new VSCodeDiagnosticsConverter();
      const uri = converter.fileToUri('src/file.ts');

      expect(uri).toBe('src/file.ts');
    });
  });

  // ===========================================================================
  // Factory and Exports
  // ===========================================================================

  describe('factory and exports', () => {
    it('should create converter with factory function', () => {
      const converter = createVSCodeDiagnosticsConverter({ source: 'test' });
      expect(converter).toBeInstanceOf(VSCodeDiagnosticsConverter);
    });

    it('should export convenience function convertToDiagnostic', () => {
      const error = createTestError();
      const diagnostic = convertToDiagnostic(error);

      expect(diagnostic).toBeDefined();
      expect(diagnostic.message).toBe(error.message);
    });

    it('should export convenience function convertToDiagnostics', () => {
      const errors = [createTestError(), createTestError()];
      const diagnostics = convertToDiagnostics(errors);

      expect(diagnostics).toHaveLength(2);
    });

    it('should export default converter instance', () => {
      expect(vscodeDiagnosticsConverter).toBeInstanceOf(VSCodeDiagnosticsConverter);
    });
  });
});
