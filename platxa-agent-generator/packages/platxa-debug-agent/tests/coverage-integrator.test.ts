/**
 * Tests for CoverageIntegrator
 *
 * Verifies coverage data parsing and SBFL integration.
 */

import { describe, expect, it } from 'vitest';
import {
  CoverageIntegrator,
  createCoverageIntegrator,
  coverageIntegrator,
  type TestResult,
} from '../src/core/coverage-integrator.js';

// =============================================================================
// Test Data
// =============================================================================

const SAMPLE_LCOV = `TN:
SF:/src/utils.js
FN:1,add
FN:5,subtract
FNDA:3,add
FNDA:1,subtract
DA:1,3
DA:2,3
DA:3,3
DA:5,1
DA:6,1
DA:7,0
BRDA:2,0,0,2
BRDA:2,0,1,1
LF:6
LH:5
BRF:2
BRH:2
end_of_record
SF:/src/math.js
DA:1,5
DA:2,5
DA:3,0
end_of_record`;

const SAMPLE_ISTANBUL = JSON.stringify({
  '/src/utils.js': {
    path: '/src/utils.js',
    s: { '0': 3, '1': 3, '2': 0 },
    statementMap: {
      '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 20 } },
      '1': { start: { line: 2, column: 0 }, end: { line: 2, column: 15 } },
      '2': { start: { line: 3, column: 0 }, end: { line: 3, column: 10 } },
    },
    b: { '0': [2, 1] },
    branchMap: {
      '0': {
        type: 'if',
        loc: { start: { line: 2, column: 0 }, end: { line: 2, column: 20 } },
        locations: [
          { start: { line: 2, column: 0 }, end: { line: 2, column: 10 } },
          { start: { line: 2, column: 10 }, end: { line: 2, column: 20 } },
        ],
      },
    },
    f: { '0': 3, '1': 1 },
    fnMap: {
      '0': {
        name: 'add',
        decl: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
        loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 20 } },
      },
      '1': {
        name: 'subtract',
        decl: { start: { line: 5, column: 0 }, end: { line: 5, column: 10 } },
        loc: { start: { line: 5, column: 0 }, end: { line: 5, column: 20 } },
      },
    },
  },
});

const SAMPLE_COBERTURA = `<?xml version="1.0" ?>
<coverage version="1.0">
  <packages>
    <package name="src">
      <classes>
        <class name="utils" filename="src/utils.js" line-rate="0.8">
          <lines>
            <line number="1" hits="3"/>
            <line number="2" hits="3"/>
            <line number="3" hits="0"/>
            <line number="4" hits="2"/>
          </lines>
        </class>
      </classes>
    </package>
  </packages>
</coverage>`;

const SAMPLE_CLOVER = `<?xml version="1.0" ?>
<coverage generated="1234567890" clover="3.0">
  <project timestamp="1234567890">
    <package name="src">
      <file name="utils.js" path="src/utils.js">
        <line num="1" count="3" type="stmt"/>
        <line num="2" count="3" type="stmt"/>
        <line num="3" count="0" type="stmt"/>
        <line num="4" count="2" type="stmt"/>
      </file>
    </package>
  </project>
</coverage>`;

// =============================================================================
// Tests
// =============================================================================

describe('CoverageIntegrator', () => {
  describe('parseLcov()', () => {
    it('should parse lcov format correctly', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseLcov(SAMPLE_LCOV);

      expect(report.format).toBe('lcov');
      expect(report.files.length).toBe(2);
    });

    it('should extract line coverage from lcov', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseLcov(SAMPLE_LCOV);

      const utilsFile = report.files.find((f) => f.path.includes('utils.js'));
      expect(utilsFile).toBeDefined();
      expect(utilsFile!.lines.length).toBe(6);
      expect(utilsFile!.coveredLines).toBe(5);
      expect(utilsFile!.totalLines).toBe(6);
    });

    it('should extract branch coverage from lcov', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseLcov(SAMPLE_LCOV);

      const utilsFile = report.files.find((f) => f.path.includes('utils.js'));
      expect(utilsFile).toBeDefined();
      expect(utilsFile!.branches.length).toBe(2);
      expect(utilsFile!.coveredBranches).toBe(2);
    });

    it('should extract function coverage from lcov', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseLcov(SAMPLE_LCOV);

      const utilsFile = report.files.find((f) => f.path.includes('utils.js'));
      expect(utilsFile).toBeDefined();
      expect(utilsFile!.functions.length).toBe(2);

      const addFunc = utilsFile!.functions.find((f) => f.name === 'add');
      expect(addFunc).toBeDefined();
      expect(addFunc!.hits).toBe(3);
    });

    it('should calculate summary statistics', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseLcov(SAMPLE_LCOV);

      expect(report.summary.totalLines).toBeGreaterThan(0);
      expect(report.summary.coveredLines).toBeGreaterThan(0);
      expect(report.summary.linePercentage).toBeGreaterThan(0);
      expect(report.summary.linePercentage).toBeLessThanOrEqual(100);
    });

    it('should handle empty lcov content', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseLcov('');

      expect(report.files.length).toBe(0);
      expect(report.summary.totalLines).toBe(0);
    });
  });

  describe('parseIstanbul()', () => {
    it('should parse istanbul JSON format correctly', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseIstanbul(SAMPLE_ISTANBUL);

      expect(report.format).toBe('istanbul');
      expect(report.files.length).toBe(1);
    });

    it('should extract statement coverage from istanbul', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseIstanbul(SAMPLE_ISTANBUL);

      const utilsFile = report.files[0];
      expect(utilsFile).toBeDefined();
      expect(utilsFile!.lines.length).toBe(3);
      expect(utilsFile!.coveredLines).toBe(2);
    });

    it('should extract branch coverage from istanbul', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseIstanbul(SAMPLE_ISTANBUL);

      const utilsFile = report.files[0];
      expect(utilsFile).toBeDefined();
      expect(utilsFile!.branches.length).toBe(2);
    });

    it('should extract function coverage from istanbul', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseIstanbul(SAMPLE_ISTANBUL);

      const utilsFile = report.files[0];
      expect(utilsFile).toBeDefined();
      expect(utilsFile!.functions.length).toBe(2);

      const addFunc = utilsFile!.functions.find((f) => f.name === 'add');
      expect(addFunc).toBeDefined();
      expect(addFunc!.hits).toBe(3);
    });
  });

  describe('parseCobertura()', () => {
    it('should parse cobertura XML format', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseCobertura(SAMPLE_COBERTURA);

      expect(report.format).toBe('cobertura');
      expect(report.files.length).toBe(1);
    });

    it('should extract line coverage from cobertura', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseCobertura(SAMPLE_COBERTURA);

      const file = report.files[0];
      expect(file).toBeDefined();
      expect(file!.lines.length).toBe(4);
      expect(file!.coveredLines).toBe(3);
    });
  });

  describe('parseClover()', () => {
    it('should parse clover XML format', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseClover(SAMPLE_CLOVER);

      expect(report.format).toBe('clover');
      expect(report.files.length).toBe(1);
    });

    it('should extract line coverage from clover', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseClover(SAMPLE_CLOVER);

      const file = report.files[0];
      expect(file).toBeDefined();
      expect(file!.lines.length).toBe(4);
      expect(file!.coveredLines).toBe(3);
    });
  });

  describe('toSpectrum()', () => {
    it('should convert coverage report to SBFL spectrum', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseLcov(SAMPLE_LCOV);

      const testResults: TestResult[] = [
        { id: 't1', name: 'test1', file: 'test.js', passed: true },
        { id: 't2', name: 'test2', file: 'test.js', passed: false, error: 'assertion failed' },
      ];

      const spectrum = integrator.toSpectrum(report, testResults);

      expect(spectrum.elements.length).toBeGreaterThan(0);
      expect(spectrum.tests.length).toBe(2);
      expect(spectrum.matrix.length).toBeGreaterThan(0);
    });

    it('should create elements for lines', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseLcov(SAMPLE_LCOV);

      const testResults: TestResult[] = [
        { id: 't1', name: 'test1', file: 'test.js', passed: true },
      ];

      const spectrum = integrator.toSpectrum(report, testResults);

      const lineElements = spectrum.elements.filter((e) => e.type === 'line');
      expect(lineElements.length).toBeGreaterThan(0);
    });

    it('should create elements for branches when enabled', () => {
      const integrator = new CoverageIntegrator({ includeBranches: true });
      const report = integrator.parseLcov(SAMPLE_LCOV);

      const testResults: TestResult[] = [
        { id: 't1', name: 'test1', file: 'test.js', passed: true },
      ];

      const spectrum = integrator.toSpectrum(report, testResults);

      const branchElements = spectrum.elements.filter((e) => e.type === 'branch');
      expect(branchElements.length).toBeGreaterThan(0);
    });

    it('should create elements for functions when enabled', () => {
      const integrator = new CoverageIntegrator({ includeFunctions: true });
      const report = integrator.parseLcov(SAMPLE_LCOV);

      const testResults: TestResult[] = [
        { id: 't1', name: 'test1', file: 'test.js', passed: true },
      ];

      const spectrum = integrator.toSpectrum(report, testResults);

      const functionElements = spectrum.elements.filter((e) => e.type === 'function');
      expect(functionElements.length).toBeGreaterThan(0);
    });

    it('should handle optional test properties', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseLcov(SAMPLE_LCOV);

      const testResults: TestResult[] = [
        { id: 't1', name: 'test1', file: 'test.js', passed: true, duration: 100 },
        { id: 't2', name: 'test2', file: 'test.js', passed: false, error: 'error msg' },
        { id: 't3', name: 'test3', file: 'test.js', passed: true },
      ];

      const spectrum = integrator.toSpectrum(report, testResults);

      expect(spectrum.tests[0]!.executionTime).toBe(100);
      expect(spectrum.tests[1]!.errorMessage).toBe('error msg');
      expect(spectrum.tests[2]!.executionTime).toBeUndefined();
    });
  });

  describe('analyzeWithSBFL()', () => {
    it('should analyze coverage with SBFL and return results', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseLcov(SAMPLE_LCOV);

      const testResults: TestResult[] = [
        { id: 't1', name: 'test1', file: 'test.js', passed: true },
        { id: 't2', name: 'test2', file: 'test.js', passed: false },
      ];

      const result = integrator.analyzeWithSBFL(report, testResults);

      expect(result.rankings).toBeDefined();
      expect(result.formula).toBe('ochiai');
      expect(result.spectrum).toBeDefined();
      expect(result.statistics).toBeDefined();
    });

    it('should use specified formula', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseLcov(SAMPLE_LCOV);

      const testResults: TestResult[] = [
        { id: 't1', name: 'test1', file: 'test.js', passed: true },
        { id: 't2', name: 'test2', file: 'test.js', passed: false },
      ];

      const result = integrator.analyzeWithSBFL(report, testResults, 'tarantula');

      expect(result.formula).toBe('tarantula');
    });

    it('should calculate suspiciousness scores', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseLcov(SAMPLE_LCOV);

      const testResults: TestResult[] = [
        { id: 't1', name: 'test1', file: 'test.js', passed: true },
        { id: 't2', name: 'test2', file: 'test.js', passed: false },
      ];

      const result = integrator.analyzeWithSBFL(report, testResults);

      expect(result.rankings.length).toBeGreaterThan(0);
      for (const ranking of result.rankings) {
        expect(ranking.score).toBeGreaterThanOrEqual(0);
        expect(ranking.rank).toBeGreaterThan(0);
      }
    });
  });

  describe('getFileCoverage()', () => {
    it('should return coverage for exact file path', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseLcov(SAMPLE_LCOV);

      const fileCov = integrator.getFileCoverage(report, '/src/utils.js');

      expect(fileCov).toBeDefined();
      expect(fileCov!.path).toBe('/src/utils.js');
    });

    it('should match partial file paths', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseLcov(SAMPLE_LCOV);

      const fileCov = integrator.getFileCoverage(report, 'utils.js');

      expect(fileCov).toBeDefined();
    });

    it('should return undefined for non-existent file', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseLcov(SAMPLE_LCOV);

      const fileCov = integrator.getFileCoverage(report, 'nonexistent.js');

      expect(fileCov).toBeUndefined();
    });
  });

  describe('getUncoveredLines()', () => {
    it('should return uncovered line numbers', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseLcov(SAMPLE_LCOV);

      const uncovered = integrator.getUncoveredLines(report, 'utils.js');

      expect(uncovered).toContain(7);
    });

    it('should return empty array for fully covered file', () => {
      const lcov = `SF:/src/covered.js
DA:1,1
DA:2,1
end_of_record`;

      const integrator = new CoverageIntegrator();
      const report = integrator.parseLcov(lcov);

      const uncovered = integrator.getUncoveredLines(report, 'covered.js');

      expect(uncovered.length).toBe(0);
    });

    it('should return empty array for non-existent file', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseLcov(SAMPLE_LCOV);

      const uncovered = integrator.getUncoveredLines(report, 'nonexistent.js');

      expect(uncovered.length).toBe(0);
    });
  });

  describe('getFileCoveragePercentage()', () => {
    it('should calculate coverage percentage', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseLcov(SAMPLE_LCOV);

      const percentage = integrator.getFileCoveragePercentage(report, 'utils.js');

      expect(percentage).toBeGreaterThan(0);
      expect(percentage).toBeLessThanOrEqual(100);
    });

    it('should return 0 for non-existent file', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseLcov(SAMPLE_LCOV);

      const percentage = integrator.getFileCoveragePercentage(report, 'nonexistent.js');

      expect(percentage).toBe(0);
    });

    it('should return 0 for file with no lines', () => {
      const lcov = `SF:/src/empty.js
end_of_record`;

      const integrator = new CoverageIntegrator();
      const report = integrator.parseLcov(lcov);

      const percentage = integrator.getFileCoveragePercentage(report, 'empty.js');

      expect(percentage).toBe(0);
    });
  });

  describe('options', () => {
    it('should respect minHits option', () => {
      const integrator = new CoverageIntegrator({ minHits: 2 });
      const lcov = `SF:/src/test.js
DA:1,1
DA:2,2
DA:3,3
end_of_record`;

      const report = integrator.parseLcov(lcov);

      expect(report.summary.coveredLines).toBe(2); // Only lines with hits >= 2
    });

    it('should respect includeBranches option', () => {
      const integratorWithBranches = new CoverageIntegrator({ includeBranches: true });
      const integratorWithoutBranches = new CoverageIntegrator({ includeBranches: false });

      const reportWith = integratorWithBranches.parseLcov(SAMPLE_LCOV);
      const reportWithout = integratorWithoutBranches.parseLcov(SAMPLE_LCOV);

      const utilsWithBranches = reportWith.files.find((f) => f.path.includes('utils.js'));
      const utilsWithoutBranches = reportWithout.files.find((f) => f.path.includes('utils.js'));

      expect(utilsWithBranches!.branches.length).toBeGreaterThan(0);
      expect(utilsWithoutBranches!.branches.length).toBe(0);
    });

    it('should respect includeFunctions option', () => {
      const integratorWithFunctions = new CoverageIntegrator({ includeFunctions: true });
      const integratorWithoutFunctions = new CoverageIntegrator({ includeFunctions: false });

      const reportWith = integratorWithFunctions.parseLcov(SAMPLE_LCOV);
      const reportWithout = integratorWithoutFunctions.parseLcov(SAMPLE_LCOV);

      const utilsWithFunctions = reportWith.files.find((f) => f.path.includes('utils.js'));
      const utilsWithoutFunctions = reportWithout.files.find((f) => f.path.includes('utils.js'));

      expect(utilsWithFunctions!.functions.length).toBeGreaterThan(0);
      expect(utilsWithoutFunctions!.functions.length).toBe(0);
    });
  });

  describe('factory and exports', () => {
    it('should create integrator with factory function', () => {
      const integrator = createCoverageIntegrator({ minHits: 2 });
      expect(integrator).toBeInstanceOf(CoverageIntegrator);
    });

    it('should export default integrator instance', () => {
      expect(coverageIntegrator).toBeInstanceOf(CoverageIntegrator);
    });
  });

  describe('edge cases', () => {
    it('should handle malformed lcov gracefully', () => {
      const integrator = new CoverageIntegrator();
      const malformed = `SF:/src/test.js
DA:invalid
BRDA:bad,data
end_of_record`;

      const report = integrator.parseLcov(malformed);

      expect(report.files.length).toBe(1);
      expect(report.files[0]!.lines.length).toBe(0);
    });

    it('should handle empty istanbul JSON', () => {
      const integrator = new CoverageIntegrator();
      const report = integrator.parseIstanbul('{}');

      expect(report.files.length).toBe(0);
    });

    it('should handle cobertura with no classes', () => {
      const integrator = new CoverageIntegrator();
      const xml = `<?xml version="1.0" ?>
<coverage version="1.0">
  <packages></packages>
</coverage>`;

      const report = integrator.parseCobertura(xml);

      expect(report.files.length).toBe(0);
    });

    it('should handle clover with no files', () => {
      const integrator = new CoverageIntegrator();
      const xml = `<?xml version="1.0" ?>
<coverage clover="3.0">
  <project></project>
</coverage>`;

      const report = integrator.parseClover(xml);

      expect(report.files.length).toBe(0);
    });
  });
});
