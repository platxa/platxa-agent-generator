/**
 * Coverage Integrator
 *
 * Parses test coverage data from various formats (lcov, istanbul/nyc)
 * and integrates with SBFLAnalyzer for enhanced fault localization.
 *
 * @module core/coverage-integrator
 */

import { readFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';
import type {
  CodeElement,
  TestExecution,
  CoverageSpectrum,
  SBFLResult,
  SBFLFormula,
} from './sbfl-analyzer.js';
import { SBFLAnalyzer } from './sbfl-analyzer.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Coverage format type
 */
export type CoverageFormat = 'lcov' | 'istanbul' | 'nyc' | 'cobertura' | 'clover';

/**
 * Line coverage data
 */
export interface LineCoverage {
  /** Line number (1-based) */
  line: number;
  /** Hit count */
  hits: number;
}

/**
 * Branch coverage data
 */
export interface BranchCoverage {
  /** Line number */
  line: number;
  /** Branch index */
  branchIndex: number;
  /** Branch taken count */
  taken: number;
}

/**
 * Function coverage data
 */
export interface FunctionCoverage {
  /** Function name */
  name: string;
  /** Start line */
  startLine: number;
  /** Hit count */
  hits: number;
}

/**
 * File coverage data
 */
export interface FileCoverage {
  /** File path */
  path: string;
  /** Line coverage */
  lines: LineCoverage[];
  /** Branch coverage */
  branches: BranchCoverage[];
  /** Function coverage */
  functions: FunctionCoverage[];
  /** Total lines */
  totalLines: number;
  /** Covered lines */
  coveredLines: number;
  /** Total branches */
  totalBranches: number;
  /** Covered branches */
  coveredBranches: number;
}

/**
 * Test result for coverage mapping
 */
export interface TestResult {
  /** Test identifier */
  id: string;
  /** Test name */
  name: string;
  /** Test file */
  file: string;
  /** Whether test passed */
  passed: boolean;
  /** Error message if failed */
  error?: string;
  /** Duration in ms */
  duration?: number;
}

/**
 * Coverage report containing all file coverages
 */
export interface CoverageReport {
  /** Format of the original report */
  format: CoverageFormat;
  /** File coverages */
  files: FileCoverage[];
  /** Timestamp */
  timestamp?: Date;
  /** Total summary */
  summary: {
    totalLines: number;
    coveredLines: number;
    totalBranches: number;
    coveredBranches: number;
    totalFunctions: number;
    coveredFunctions: number;
    linePercentage: number;
    branchPercentage: number;
    functionPercentage: number;
  };
}

/**
 * Options for coverage integration
 */
export interface CoverageIntegratorOptions {
  /** Base directory for resolving relative paths */
  baseDir?: string;
  /** Include branch coverage */
  includeBranches?: boolean;
  /** Include function coverage */
  includeFunctions?: boolean;
  /** Minimum hit count to consider covered */
  minHits?: number;
}

// =============================================================================
// Default Options
// =============================================================================

const DEFAULT_OPTIONS: Required<CoverageIntegratorOptions> = {
  baseDir: process.cwd(),
  includeBranches: true,
  includeFunctions: true,
  minHits: 1,
};

// =============================================================================
// Coverage Integrator Class
// =============================================================================

/**
 * Integrates coverage data with SBFL analysis
 */
export class CoverageIntegrator {
  private options: Required<CoverageIntegratorOptions>;

  constructor(options: CoverageIntegratorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Parse coverage from file
   */
  parseCoverageFile(filePath: string, format?: CoverageFormat): CoverageReport {
    if (!existsSync(filePath)) {
      throw new Error(`Coverage file not found: ${filePath}`);
    }

    const content = readFileSync(filePath, 'utf-8');
    const detectedFormat = format ?? this.detectFormat(filePath, content);

    switch (detectedFormat) {
      case 'lcov':
        return this.parseLcov(content);
      case 'istanbul':
      case 'nyc':
        return this.parseIstanbul(content);
      case 'cobertura':
        return this.parseCobertura(content);
      case 'clover':
        return this.parseClover(content);
      default:
        throw new Error(`Unsupported coverage format: ${detectedFormat}`);
    }
  }

  /**
   * Parse lcov format coverage data
   */
  parseLcov(content: string): CoverageReport {
    const files: FileCoverage[] = [];
    let currentFile: FileCoverage | null = null;

    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('SF:')) {
        // Start of file
        currentFile = {
          path: trimmed.substring(3),
          lines: [],
          branches: [],
          functions: [],
          totalLines: 0,
          coveredLines: 0,
          totalBranches: 0,
          coveredBranches: 0,
        };
      } else if (trimmed.startsWith('DA:') && currentFile) {
        // Line data: DA:line,hits
        const parts = trimmed.substring(3).split(',');
        const lineNum = parseInt(parts[0] ?? '', 10);
        const hits = parseInt(parts[1] ?? '', 10);
        if (!isNaN(lineNum) && !isNaN(hits)) {
          currentFile.lines.push({ line: lineNum, hits });
          currentFile.totalLines++;
          if (hits >= this.options.minHits) {
            currentFile.coveredLines++;
          }
        }
      } else if (trimmed.startsWith('BRDA:') && currentFile && this.options.includeBranches) {
        // Branch data: BRDA:line,block,branch,taken
        const parts = trimmed.substring(5).split(',');
        const lineNum = parseInt(parts[0] ?? '0');
        const branchIndex = parseInt(parts[2] ?? '0');
        const taken = parts[3] === '-' ? 0 : parseInt(parts[3] ?? '0');

        if (!isNaN(lineNum) && !isNaN(branchIndex)) {
          currentFile.branches.push({ line: lineNum, branchIndex, taken });
          currentFile.totalBranches++;
          if (taken >= this.options.minHits) {
            currentFile.coveredBranches++;
          }
        }
      } else if (trimmed.startsWith('FN:') && currentFile && this.options.includeFunctions) {
        // Function: FN:line,name
        const [lineStr, name] = trimmed.substring(3).split(',');
        const startLine = parseInt(lineStr ?? '0');
        if (!isNaN(startLine) && name) {
          currentFile.functions.push({ name, startLine, hits: 0 });
        }
      } else if (trimmed.startsWith('FNDA:') && currentFile && this.options.includeFunctions) {
        // Function data: FNDA:hits,name
        const [hitsStr, name] = trimmed.substring(5).split(',');
        const hits = parseInt(hitsStr ?? '0');
        if (!isNaN(hits) && name) {
          const func = currentFile.functions.find((f) => f.name === name);
          if (func) {
            func.hits = hits;
          }
        }
      } else if (trimmed === 'end_of_record' && currentFile) {
        files.push(currentFile);
        currentFile = null;
      }
    }

    return this.createReport('lcov', files);
  }

  /**
   * Parse istanbul/nyc JSON format coverage data
   */
  parseIstanbul(content: string): CoverageReport {
    const data = JSON.parse(content) as Record<string, IstanbulFileCoverage>;
    const files: FileCoverage[] = [];

    for (const [filePath, fileCov] of Object.entries(data)) {
      const lineCoverage: LineCoverage[] = [];
      const branchCoverage: BranchCoverage[] = [];
      const functionCoverage: FunctionCoverage[] = [];

      // Parse statement/line coverage
      if (fileCov.s && fileCov.statementMap) {
        for (const [stmtId, hits] of Object.entries(fileCov.s)) {
          const stmt = fileCov.statementMap[stmtId];
          if (stmt) {
            lineCoverage.push({
              line: stmt.start.line,
              hits: hits as number,
            });
          }
        }
      }

      // Parse branch coverage
      if (this.options.includeBranches && fileCov.b && fileCov.branchMap) {
        for (const [branchId, branches] of Object.entries(fileCov.b)) {
          const branchInfo = fileCov.branchMap[branchId];
          if (branchInfo && Array.isArray(branches)) {
            branches.forEach((taken, idx) => {
              branchCoverage.push({
                line: branchInfo.loc?.start?.line ?? branchInfo.line ?? 0,
                branchIndex: idx,
                taken: taken as number,
              });
            });
          }
        }
      }

      // Parse function coverage
      if (this.options.includeFunctions && fileCov.f && fileCov.fnMap) {
        for (const [fnId, hits] of Object.entries(fileCov.f)) {
          const fnInfo = fileCov.fnMap[fnId];
          if (fnInfo) {
            functionCoverage.push({
              name: fnInfo.name,
              startLine: fnInfo.decl?.start?.line ?? fnInfo.loc?.start?.line ?? 0,
              hits: hits as number,
            });
          }
        }
      }

      const coveredLines = lineCoverage.filter((l) => l.hits >= this.options.minHits).length;
      const coveredBranches = branchCoverage.filter((b) => b.taken >= this.options.minHits).length;

      files.push({
        path: filePath,
        lines: lineCoverage,
        branches: branchCoverage,
        functions: functionCoverage,
        totalLines: lineCoverage.length,
        coveredLines,
        totalBranches: branchCoverage.length,
        coveredBranches,
      });
    }

    return this.createReport('istanbul', files);
  }

  /**
   * Parse Cobertura XML format (basic support)
   */
  parseCobertura(content: string): CoverageReport {
    const files: FileCoverage[] = [];

    // Simple regex-based XML parsing for Cobertura format
    const classRegex = /<class[^>]*filename="([^"]+)"[^>]*>/g;
    const lineRegex = /<line[^>]*number="(\d+)"[^>]*hits="(\d+)"[^>]*/g;

    let classMatch;
    while ((classMatch = classRegex.exec(content)) !== null) {
      const filePath = classMatch[1];
      if (!filePath) continue;

      const lineCoverage: LineCoverage[] = [];

      // Find all lines within this class block
      const classEnd = content.indexOf('</class>', classMatch.index);
      const classContent = content.substring(classMatch.index, classEnd);

      let lineMatch;
      while ((lineMatch = lineRegex.exec(classContent)) !== null) {
        const lineNum = parseInt(lineMatch[1] ?? '0');
        const hits = parseInt(lineMatch[2] ?? '0');
        if (!isNaN(lineNum) && !isNaN(hits)) {
          lineCoverage.push({ line: lineNum, hits });
        }
      }

      const coveredLines = lineCoverage.filter((l) => l.hits >= this.options.minHits).length;

      files.push({
        path: filePath,
        lines: lineCoverage,
        branches: [],
        functions: [],
        totalLines: lineCoverage.length,
        coveredLines,
        totalBranches: 0,
        coveredBranches: 0,
      });
    }

    return this.createReport('cobertura', files);
  }

  /**
   * Parse Clover XML format (basic support)
   */
  parseClover(content: string): CoverageReport {
    const files: FileCoverage[] = [];

    // Simple regex-based XML parsing for Clover format
    const fileRegex = /<file[^>]*name="([^"]+)"[^>]*>/g;
    const lineRegex = /<line[^>]*num="(\d+)"[^>]*count="(\d+)"[^>]*/g;

    let fileMatch;
    while ((fileMatch = fileRegex.exec(content)) !== null) {
      const filePath = fileMatch[1];
      if (!filePath) continue;

      const lineCoverage: LineCoverage[] = [];

      const fileEnd = content.indexOf('</file>', fileMatch.index);
      const fileContent = content.substring(fileMatch.index, fileEnd);

      let lineMatch;
      while ((lineMatch = lineRegex.exec(fileContent)) !== null) {
        const lineNum = parseInt(lineMatch[1] ?? '0');
        const hits = parseInt(lineMatch[2] ?? '0');
        if (!isNaN(lineNum) && !isNaN(hits)) {
          lineCoverage.push({ line: lineNum, hits });
        }
      }

      const coveredLines = lineCoverage.filter((l) => l.hits >= this.options.minHits).length;

      files.push({
        path: filePath,
        lines: lineCoverage,
        branches: [],
        functions: [],
        totalLines: lineCoverage.length,
        coveredLines,
        totalBranches: 0,
        coveredBranches: 0,
      });
    }

    return this.createReport('clover', files);
  }

  /**
   * Convert coverage report to SBFL spectrum
   */
  toSpectrum(
    coverage: CoverageReport,
    testResults: TestResult[]
  ): CoverageSpectrum {
    const elements: CodeElement[] = [];
    const elementIdMap = new Map<string, number>();

    // Create code elements from coverage
    for (const file of coverage.files) {
      for (const line of file.lines) {
        const id = `${file.path}:${line.line}`;
        elementIdMap.set(id, elements.length);
        elements.push({
          id,
          type: 'line',
          location: {
            file: file.path,
            line: line.line,
          },
        });
      }

      if (this.options.includeBranches) {
        for (const branch of file.branches) {
          const id = `${file.path}:${branch.line}:branch${branch.branchIndex}`;
          elementIdMap.set(id, elements.length);
          elements.push({
            id,
            type: 'branch',
            location: {
              file: file.path,
              line: branch.line,
            },
          });
        }
      }

      if (this.options.includeFunctions) {
        for (const func of file.functions) {
          const id = `${file.path}:${func.name}`;
          elementIdMap.set(id, elements.length);
          elements.push({
            id,
            type: 'function',
            location: {
              file: file.path,
              line: func.startLine,
            },
            functionName: func.name,
          });
        }
      }
    }

    // Create test executions
    const tests: TestExecution[] = testResults.map((result) => {
      const test: TestExecution = {
        testId: result.id,
        testName: result.name,
        passed: result.passed,
        coveredElements: [], // Will be populated from coverage
      };
      if (result.duration !== undefined) {
        test.executionTime = result.duration;
      }
      if (result.error !== undefined) {
        test.errorMessage = result.error;
      }
      return test;
    });

    // Build coverage matrix
    // For simplicity, we assume all tests share the same coverage data
    // In real usage, you'd have per-test coverage
    const matrix: boolean[][] = [];

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      if (!element) continue;

      const row: boolean[] = [];
      for (const file of coverage.files) {
        if (element.location.file === file.path) {
          const lineCov = file.lines.find((l) => l.line === element.location.line);
          const covered = lineCov ? lineCov.hits >= this.options.minHits : false;

          // Each test gets the same coverage (simplified)
          for (let t = 0; t < tests.length; t++) {
            row.push(covered);
            if (covered) {
              const test = tests[t];
              if (test) {
                test.coveredElements.push(element.id);
              }
            }
          }
          break;
        }
      }

      // Fill remaining with false if no coverage found
      while (row.length < tests.length) {
        row.push(false);
      }

      matrix.push(row);
    }

    return { elements, tests, matrix };
  }

  /**
   * Analyze coverage with SBFL to find suspicious locations
   */
  analyzeWithSBFL(
    coverage: CoverageReport,
    testResults: TestResult[],
    formula: SBFLFormula = 'ochiai'
  ): SBFLResult {
    const spectrum = this.toSpectrum(coverage, testResults);
    // Create analyzer with the specified formula
    const analyzer = new SBFLAnalyzer({ formula });
    return analyzer.analyze(spectrum);
  }

  /**
   * Get coverage for a specific file
   */
  getFileCoverage(report: CoverageReport, filePath: string): FileCoverage | undefined {
    return report.files.find(
      (f) => f.path === filePath || f.path.endsWith(filePath) || filePath.endsWith(f.path)
    );
  }

  /**
   * Get uncovered lines in a file
   */
  getUncoveredLines(report: CoverageReport, filePath: string): number[] {
    const fileCov = this.getFileCoverage(report, filePath);
    if (!fileCov) return [];

    return fileCov.lines
      .filter((l) => l.hits < this.options.minHits)
      .map((l) => l.line);
  }

  /**
   * Get coverage percentage for a file
   */
  getFileCoveragePercentage(report: CoverageReport, filePath: string): number {
    const fileCov = this.getFileCoverage(report, filePath);
    if (!fileCov || fileCov.totalLines === 0) return 0;

    return (fileCov.coveredLines / fileCov.totalLines) * 100;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private detectFormat(filePath: string, content: string): CoverageFormat {
    const fileName = basename(filePath).toLowerCase();

    if (fileName.endsWith('.info') || fileName === 'lcov.info') {
      return 'lcov';
    }

    if (fileName.includes('coverage') && fileName.endsWith('.json')) {
      return 'istanbul';
    }

    // Check content
    if (content.includes('SF:') && content.includes('DA:')) {
      return 'lcov';
    }

    if (content.startsWith('{') && content.includes('statementMap')) {
      return 'istanbul';
    }

    if (content.includes('<coverage') && content.includes('cobertura')) {
      return 'cobertura';
    }

    if (content.includes('<coverage') && content.includes('clover')) {
      return 'clover';
    }

    // Default to istanbul for JSON
    if (content.startsWith('{')) {
      return 'istanbul';
    }

    return 'lcov';
  }

  private createReport(format: CoverageFormat, files: FileCoverage[]): CoverageReport {
    const totalLines = files.reduce((sum, f) => sum + f.totalLines, 0);
    const coveredLines = files.reduce((sum, f) => sum + f.coveredLines, 0);
    const totalBranches = files.reduce((sum, f) => sum + f.totalBranches, 0);
    const coveredBranches = files.reduce((sum, f) => sum + f.coveredBranches, 0);
    const totalFunctions = files.reduce((sum, f) => sum + f.functions.length, 0);
    const coveredFunctions = files.reduce(
      (sum, f) => sum + f.functions.filter((fn) => fn.hits >= this.options.minHits).length,
      0
    );

    return {
      format,
      files,
      timestamp: new Date(),
      summary: {
        totalLines,
        coveredLines,
        totalBranches,
        coveredBranches,
        totalFunctions,
        coveredFunctions,
        linePercentage: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
        branchPercentage: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0,
        functionPercentage: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0,
      },
    };
  }
}

// =============================================================================
// Istanbul Types (internal)
// =============================================================================

interface IstanbulLocation {
  line: number;
  column: number;
}

interface IstanbulRange {
  start: IstanbulLocation;
  end: IstanbulLocation;
}

interface IstanbulFileCoverage {
  path: string;
  s: Record<string, number>;
  statementMap: Record<string, IstanbulRange>;
  b: Record<string, number[]>;
  branchMap: Record<string, {
    type: string;
    loc?: IstanbulRange;
    line?: number;
    locations: IstanbulRange[];
  }>;
  f: Record<string, number>;
  fnMap: Record<string, {
    name: string;
    decl?: IstanbulRange;
    loc?: IstanbulRange;
  }>;
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new CoverageIntegrator instance
 */
export function createCoverageIntegrator(
  options?: CoverageIntegratorOptions
): CoverageIntegrator {
  return new CoverageIntegrator(options);
}

// =============================================================================
// Default Instance
// =============================================================================

/** Default integrator instance */
export const coverageIntegrator = new CoverageIntegrator();
