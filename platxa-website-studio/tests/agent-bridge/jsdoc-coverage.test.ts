import { describe, it, expect } from 'vitest';
import {
  DEFAULT_COVERAGE_CONFIG,
  isJsDocStart,
  isJsDocEnd,
  isExportLine,
  extractExports,
  computeFileCoverage,
  computeCoverageSummary,
  formatCoverageReport,
  formatFileCoverage,
  validateFileCoverage,
  validateCoverage,
  generateJsDocTemplate,
  suggestJsDoc,
  type DetectedExport,
} from '@/lib/agent-bridge/jsdoc-coverage';

describe('JSDoc Coverage Checker', () => {
  // ===========================================================================
  // Verification Test: All public functions have JSDoc comments
  // ===========================================================================

  describe('Verification: JSDoc Coverage', () => {
    it('verifies that documented code passes coverage check', () => {
      const source = `
/**
 * Adds two numbers.
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Multiplies two numbers.
 */
export function multiply(a: number, b: number): number {
  return a * b;
}
`;
      const coverage = computeFileCoverage('test.ts', source);
      expect(coverage.coveragePercent).toBe(100);
      expect(coverage.undocumented).toHaveLength(0);
    });

    it('detects undocumented functions', () => {
      const source = `
/**
 * Documented function.
 */
export function documented(): void {}

export function undocumented(): void {}
`;
      const coverage = computeFileCoverage('test.ts', source);
      expect(coverage.coveragePercent).toBe(50);
      expect(coverage.undocumented).toContain('undocumented');
    });
  });

  // ===========================================================================
  // Parsing Functions
  // ===========================================================================

  describe('isJsDocStart', () => {
    it('detects JSDoc start', () => {
      expect(isJsDocStart('/**')).toBe(true);
      expect(isJsDocStart('  /**')).toBe(true);
      expect(isJsDocStart('/* not jsdoc')).toBe(false);
      expect(isJsDocStart('// comment')).toBe(false);
    });
  });

  describe('isJsDocEnd', () => {
    it('detects JSDoc end', () => {
      expect(isJsDocEnd(' */')).toBe(true);
      expect(isJsDocEnd('text */')).toBe(true);
      expect(isJsDocEnd('/* start')).toBe(false);
    });
  });

  describe('isExportLine', () => {
    it('detects function exports', () => {
      const result = isExportLine('export function myFunc()', ['function']);
      expect(result.isExport).toBe(true);
      expect(result.type).toBe('function');
      expect(result.name).toBe('myFunc');
    });

    it('detects const exports', () => {
      const result = isExportLine('export const MY_CONST = 1', ['const']);
      expect(result.isExport).toBe(true);
      expect(result.type).toBe('const');
      expect(result.name).toBe('MY_CONST');
    });

    it('detects class exports', () => {
      const result = isExportLine('export class MyClass {', ['class']);
      expect(result.isExport).toBe(true);
      expect(result.type).toBe('class');
      expect(result.name).toBe('MyClass');
    });

    it('returns false for non-exports', () => {
      expect(isExportLine('const x = 1', ['const']).isExport).toBe(false);
      expect(isExportLine('function foo() {}', ['function']).isExport).toBe(false);
    });
  });

  describe('extractExports', () => {
    it('extracts exports with JSDoc', () => {
      const source = `
/**
 * My function.
 */
export function myFunc(): void {}
`;
      const exports = extractExports(source);
      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('myFunc');
      expect(exports[0].hasJsDoc).toBe(true);
    });

    it('extracts exports without JSDoc', () => {
      const source = `
export function noDoc(): void {}
`;
      const exports = extractExports(source);
      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('noDoc');
      expect(exports[0].hasJsDoc).toBe(false);
    });

    it('handles multiple exports', () => {
      const source = `
/**
 * First function.
 */
export function first(): void {}

export function second(): void {}

/**
 * Third function.
 */
export function third(): void {}
`;
      const exports = extractExports(source);
      expect(exports).toHaveLength(3);
      expect(exports[0].hasJsDoc).toBe(true);
      expect(exports[1].hasJsDoc).toBe(false);
      expect(exports[2].hasJsDoc).toBe(true);
    });

    it('skips private exports when configured', () => {
      const source = `
export function _private(): void {}
export function public1(): void {}
`;
      const exports = extractExports(source, { ...DEFAULT_COVERAGE_CONFIG, includePrivate: false });
      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('public1');
    });

    it('includes private exports when configured', () => {
      const source = `
export function _private(): void {}
export function public1(): void {}
`;
      const exports = extractExports(source, { ...DEFAULT_COVERAGE_CONFIG, includePrivate: true });
      expect(exports).toHaveLength(2);
    });

    it('captures JSDoc content', () => {
      const source = `
/**
 * This is a description.
 * @param x The parameter
 * @returns The result
 */
export function myFunc(x: number): number { return x; }
`;
      const exports = extractExports(source);
      expect(exports[0].jsDoc).toContain('This is a description');
      expect(exports[0].jsDoc).toContain('@param x');
    });
  });

  // ===========================================================================
  // Coverage Computation
  // ===========================================================================

  describe('computeFileCoverage', () => {
    it('computes 100% coverage for fully documented file', () => {
      const source = `
/**
 * Function A.
 */
export function a(): void {}

/**
 * Function B.
 */
export function b(): void {}
`;
      const coverage = computeFileCoverage('test.ts', source);
      expect(coverage.coveragePercent).toBe(100);
      expect(coverage.totalExports).toBe(2);
      expect(coverage.documentedExports).toBe(2);
      expect(coverage.undocumented).toHaveLength(0);
    });

    it('computes partial coverage', () => {
      const source = `
/**
 * Documented.
 */
export function doc(): void {}

export function noDoc(): void {}
`;
      const coverage = computeFileCoverage('test.ts', source);
      expect(coverage.coveragePercent).toBe(50);
      expect(coverage.undocumented).toEqual(['noDoc']);
    });

    it('handles empty files', () => {
      const coverage = computeFileCoverage('empty.ts', '');
      expect(coverage.coveragePercent).toBe(100);
      expect(coverage.totalExports).toBe(0);
    });

    it('handles files with no exports', () => {
      const source = `
const x = 1;
function internal() {}
`;
      const coverage = computeFileCoverage('internal.ts', source);
      expect(coverage.coveragePercent).toBe(100);
      expect(coverage.totalExports).toBe(0);
    });
  });

  describe('computeCoverageSummary', () => {
    it('computes summary from multiple files', () => {
      const files = [
        {
          filePath: 'a.ts',
          totalExports: 4,
          documentedExports: 4,
          coveragePercent: 100,
          exports: [],
          undocumented: [],
        },
        {
          filePath: 'b.ts',
          totalExports: 2,
          documentedExports: 1,
          coveragePercent: 50,
          exports: [],
          undocumented: ['missing'],
        },
      ];

      const summary = computeCoverageSummary(files, 100);
      expect(summary.totalFiles).toBe(2);
      expect(summary.totalExports).toBe(6);
      expect(summary.documentedExports).toBe(5);
      expect(summary.coveragePercent).toBe(83);
      expect(summary.fullyDocumented).toBe(1);
      expect(summary.belowThreshold).toBe(1);
      expect(summary.passed).toBe(false);
    });

    it('passes when meeting threshold', () => {
      const files = [
        {
          filePath: 'a.ts',
          totalExports: 10,
          documentedExports: 8,
          coveragePercent: 80,
          exports: [],
          undocumented: [],
        },
      ];

      const summary = computeCoverageSummary(files, 80);
      expect(summary.passed).toBe(true);
    });
  });

  // ===========================================================================
  // Formatting Functions
  // ===========================================================================

  describe('formatCoverageReport', () => {
    it('formats passing report', () => {
      const summary = computeCoverageSummary([
        {
          filePath: 'a.ts',
          totalExports: 5,
          documentedExports: 5,
          coveragePercent: 100,
          exports: [],
          undocumented: [],
        },
      ], 100);

      const report = formatCoverageReport(summary);
      expect(report).toContain('PASSED');
      expect(report).toContain('100%');
      expect(report).toContain('a.ts');
    });

    it('formats failing report with undocumented exports', () => {
      const summary = computeCoverageSummary([
        {
          filePath: 'b.ts',
          totalExports: 2,
          documentedExports: 1,
          coveragePercent: 50,
          exports: [],
          undocumented: ['missingDoc'],
        },
      ], 100);

      const report = formatCoverageReport(summary);
      expect(report).toContain('FAILED');
      expect(report).toContain('missingDoc');
      expect(report).toContain('50%');
    });
  });

  describe('formatFileCoverage', () => {
    it('formats fully documented file', () => {
      const coverage = {
        filePath: 'complete.ts',
        totalExports: 3,
        documentedExports: 3,
        coveragePercent: 100,
        exports: [],
        undocumented: [],
      };

      const formatted = formatFileCoverage(coverage);
      expect(formatted).toContain('✓');
      expect(formatted).toContain('complete.ts');
      expect(formatted).toContain('100%');
    });

    it('formats partially documented file', () => {
      const coverage = {
        filePath: 'partial.ts',
        totalExports: 4,
        documentedExports: 2,
        coveragePercent: 50,
        exports: [],
        undocumented: ['a', 'b'],
      };

      const formatted = formatFileCoverage(coverage);
      expect(formatted).toContain('○');
      expect(formatted).toContain('50%');
    });
  });

  // ===========================================================================
  // Validation Functions
  // ===========================================================================

  describe('validateFileCoverage', () => {
    it('validates passing file', () => {
      const coverage = {
        filePath: 'good.ts',
        totalExports: 5,
        documentedExports: 5,
        coveragePercent: 100,
        exports: [],
        undocumented: [],
      };

      const result = validateFileCoverage(coverage, 100);
      expect(result.valid).toBe(true);
      expect(result.message).toContain('meets threshold');
    });

    it('validates failing file', () => {
      const coverage = {
        filePath: 'bad.ts',
        totalExports: 4,
        documentedExports: 2,
        coveragePercent: 50,
        exports: [],
        undocumented: ['a', 'b'],
      };

      const result = validateFileCoverage(coverage, 100);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('below threshold');
      expect(result.message).toContain('a, b');
    });

    it('respects custom threshold', () => {
      const coverage = {
        filePath: 'ok.ts',
        totalExports: 10,
        documentedExports: 8,
        coveragePercent: 80,
        exports: [],
        undocumented: [],
      };

      expect(validateFileCoverage(coverage, 80).valid).toBe(true);
      expect(validateFileCoverage(coverage, 90).valid).toBe(false);
    });
  });

  describe('validateCoverage', () => {
    it('validates passing summary', () => {
      const summary = {
        totalFiles: 2,
        totalExports: 10,
        documentedExports: 10,
        coveragePercent: 100,
        fullyDocumented: 2,
        belowThreshold: 0,
        files: [],
        passed: true,
        threshold: 100,
      };

      const result = validateCoverage(summary);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('validates failing summary with issues', () => {
      const summary = {
        totalFiles: 2,
        totalExports: 10,
        documentedExports: 8,
        coveragePercent: 80,
        fullyDocumented: 1,
        belowThreshold: 1,
        files: [
          {
            filePath: 'bad.ts',
            totalExports: 4,
            documentedExports: 2,
            coveragePercent: 50,
            exports: [],
            undocumented: ['x', 'y'],
          },
        ],
        passed: false,
        threshold: 100,
      };

      const result = validateCoverage(summary);
      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain('bad.ts');
    });
  });

  // ===========================================================================
  // JSDoc Generation
  // ===========================================================================

  describe('generateJsDocTemplate', () => {
    it('generates basic template', () => {
      const template = generateJsDocTemplate('myFunction');
      expect(template).toContain('/**');
      expect(template).toContain('myFunction');
      expect(template).toContain('*/');
    });

    it('includes params', () => {
      const template = generateJsDocTemplate('myFunc', ['a', 'b']);
      expect(template).toContain('@param a');
      expect(template).toContain('@param b');
    });

    it('includes return type', () => {
      const template = generateJsDocTemplate('myFunc', [], 'number');
      expect(template).toContain('@returns number');
    });
  });

  describe('suggestJsDoc', () => {
    it('suggests JSDoc for export', () => {
      const exp: DetectedExport = {
        name: 'calculateTotal',
        type: 'function',
        line: 10,
        hasJsDoc: false,
      };

      const suggestion = suggestJsDoc(exp);
      expect(suggestion).toContain('calculateTotal');
      expect(suggestion).toContain('/**');
    });
  });

  // ===========================================================================
  // Configuration
  // ===========================================================================

  describe('DEFAULT_COVERAGE_CONFIG', () => {
    it('has expected defaults', () => {
      expect(DEFAULT_COVERAGE_CONFIG.threshold).toBe(100);
      expect(DEFAULT_COVERAGE_CONFIG.exportTypes).toContain('function');
      expect(DEFAULT_COVERAGE_CONFIG.exportTypes).toContain('const');
      expect(DEFAULT_COVERAGE_CONFIG.includePrivate).toBe(false);
    });
  });
});
