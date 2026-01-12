/**
 * SBFL (Spectrum-Based Fault Localization) Analyzer
 *
 * Implements spectrum-based fault localization techniques to identify
 * suspicious code elements based on test execution data.
 *
 * Feature #34: SBFL fault localization for test-based debugging
 *
 * @module sbfl-analyzer
 */

import type { SourceLocation } from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Suspiciousness formula type
 */
export type SBFLFormula =
  | 'tarantula'
  | 'ochiai'
  | 'dstar'
  | 'barinel'
  | 'jaccard'
  | 'kulczynski2'
  | 'mccon'
  | 'minus'
  | 'zoltar'
  | 'wong2'
  | 'naish2'
  | 'gp13'
  | 'op2';

/**
 * A code element (line, statement, branch, etc.)
 */
export interface CodeElement {
  /** Unique identifier */
  id: string;
  /** Element type */
  type: 'line' | 'statement' | 'branch' | 'function' | 'block';
  /** Source location */
  location: SourceLocation;
  /** Element content (code text) */
  content?: string;
  /** Function name (if applicable) */
  functionName?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Test execution result
 */
export interface TestExecution {
  /** Test identifier */
  testId: string;
  /** Test name */
  testName: string;
  /** Test outcome */
  passed: boolean;
  /** Code elements covered by this test */
  coveredElements: string[];
  /** Execution time (ms) */
  executionTime?: number;
  /** Error message (if failed) */
  errorMessage?: string;
  /** Error location (if failed) */
  errorLocation?: SourceLocation;
}

/**
 * Coverage spectrum - matrix of test executions vs code elements
 */
export interface CoverageSpectrum {
  /** All code elements */
  elements: CodeElement[];
  /** All test executions */
  tests: TestExecution[];
  /** Coverage matrix: elements x tests (true = covered) */
  matrix: boolean[][];
}

/**
 * Suspiciousness score for a code element
 */
export interface SuspiciousnessScore {
  /** Code element */
  element: CodeElement;
  /** Suspiciousness score (0-1, higher = more suspicious) */
  score: number;
  /** Formula used */
  formula: SBFLFormula;
  /** Execution statistics */
  stats: ExecutionStats;
  /** Rank among all elements */
  rank: number;
  /** Percentile (0-100) */
  percentile: number;
}

/**
 * Execution statistics for a code element
 */
export interface ExecutionStats {
  /** Number of failed tests that cover this element */
  executedFailed: number;
  /** Number of passed tests that cover this element */
  executedPassed: number;
  /** Number of failed tests that don't cover this element */
  notExecutedFailed: number;
  /** Number of passed tests that don't cover this element */
  notExecutedPassed: number;
  /** Total failed tests */
  totalFailed: number;
  /** Total passed tests */
  totalPassed: number;
}

/**
 * SBFL analysis result
 */
export interface SBFLResult {
  /** Ranked list of suspicious elements */
  rankings: SuspiciousnessScore[];
  /** Formula used */
  formula: SBFLFormula;
  /** Spectrum analyzed */
  spectrum: CoverageSpectrum;
  /** Analysis statistics */
  statistics: SBFLStatistics;
  /** Top N most suspicious elements */
  topSuspicious: SuspiciousnessScore[];
  /** Confidence in the analysis (0-1) */
  confidence: number;
}

/**
 * SBFL analysis statistics
 */
export interface SBFLStatistics {
  /** Total code elements */
  totalElements: number;
  /** Total tests */
  totalTests: number;
  /** Number of passing tests */
  passingTests: number;
  /** Number of failing tests */
  failingTests: number;
  /** Average coverage per test */
  averageCoverage: number;
  /** Elements with non-zero suspiciousness */
  suspiciousElements: number;
  /** Maximum suspiciousness score */
  maxScore: number;
  /** Median suspiciousness score */
  medianScore: number;
  /** Analysis time (ms) */
  analysisTimeMs: number;
}

/**
 * Configuration for SBFL analyzer
 */
export interface SBFLConfig {
  /** Primary formula to use */
  formula: SBFLFormula;
  /** Secondary formulas for comparison */
  secondaryFormulas: SBFLFormula[];
  /** Number of top suspicious elements to return */
  topN: number;
  /** Minimum suspiciousness threshold */
  minThreshold: number;
  /** D* formula exponent (when using dstar) */
  dstarExponent: number;
  /** Whether to include tie-breaking analysis */
  tieBreaking: boolean;
  /** Whether to aggregate by function */
  aggregateByFunction: boolean;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: SBFLConfig = {
  formula: 'ochiai',
  secondaryFormulas: ['tarantula', 'dstar'],
  topN: 10,
  minThreshold: 0.1,
  dstarExponent: 2,
  tieBreaking: true,
  aggregateByFunction: false,
};

// =============================================================================
// Suspiciousness Formulas
// =============================================================================

/**
 * Calculate suspiciousness using Tarantula formula
 *
 * Tarantula = (ef/tf) / ((ef/tf) + (ep/tp))
 */
function tarantula(stats: ExecutionStats): number {
  const { executedFailed: ef, executedPassed: ep, totalFailed: tf, totalPassed: tp } = stats;

  if (tf === 0) return 0;
  if (ef === 0) return 0;

  const failRatio = ef / tf;
  const passRatio = tp > 0 ? ep / tp : 0;

  if (failRatio + passRatio === 0) return 0;
  return failRatio / (failRatio + passRatio);
}

/**
 * Calculate suspiciousness using Ochiai formula
 *
 * Ochiai = ef / sqrt(tf * (ef + ep))
 */
function ochiai(stats: ExecutionStats): number {
  const { executedFailed: ef, executedPassed: ep, totalFailed: tf } = stats;

  if (tf === 0 || ef === 0) return 0;

  const denominator = Math.sqrt(tf * (ef + ep));
  if (denominator === 0) return 0;

  return ef / denominator;
}

/**
 * Calculate suspiciousness using D* formula
 *
 * D* = ef^n / (ep + nf)
 * where n is the exponent (typically 2 or 3)
 */
function dstar(stats: ExecutionStats, exponent: number = 2): number {
  const { executedFailed: ef, executedPassed: ep, notExecutedFailed: nf } = stats;

  const denominator = ep + nf;
  if (denominator === 0) {
    return ef > 0 ? Number.MAX_SAFE_INTEGER : 0;
  }

  return Math.pow(ef, exponent) / denominator;
}

/**
 * Calculate suspiciousness using Barinel formula
 *
 * Barinel = 1 - (ep / (ep + ef))
 */
function barinel(stats: ExecutionStats): number {
  const { executedFailed: ef, executedPassed: ep } = stats;

  if (ef + ep === 0) return 0;
  return 1 - (ep / (ef + ep));
}

/**
 * Calculate suspiciousness using Jaccard formula
 *
 * Jaccard = ef / (tf + ep)
 */
function jaccard(stats: ExecutionStats): number {
  const { executedFailed: ef, executedPassed: ep, totalFailed: tf } = stats;

  const denominator = tf + ep;
  if (denominator === 0) return 0;

  return ef / denominator;
}

/**
 * Calculate suspiciousness using Kulczynski2 formula
 *
 * Kulczynski2 = 0.5 * ((ef/tf) + (ef/(ef + ep)))
 */
function kulczynski2(stats: ExecutionStats): number {
  const { executedFailed: ef, executedPassed: ep, totalFailed: tf } = stats;

  if (tf === 0 || ef === 0) return 0;

  const term1 = ef / tf;
  const term2 = ef / (ef + ep);

  return 0.5 * (term1 + term2);
}

/**
 * Calculate suspiciousness using M-Con formula
 *
 * MCon = ef^2 - ep
 */
function mccon(stats: ExecutionStats): number {
  const { executedFailed: ef, executedPassed: ep } = stats;
  return Math.max(0, (ef * ef) - ep);
}

/**
 * Calculate suspiciousness using Minus formula
 *
 * Minus = (ef/tf) - (ep/tp)
 */
function minus(stats: ExecutionStats): number {
  const { executedFailed: ef, executedPassed: ep, totalFailed: tf, totalPassed: tp } = stats;

  const failRatio = tf > 0 ? ef / tf : 0;
  const passRatio = tp > 0 ? ep / tp : 0;

  // Normalize to 0-1 range
  return Math.max(0, (failRatio - passRatio + 1) / 2);
}

/**
 * Calculate suspiciousness using Zoltar formula
 *
 * Zoltar = ef / (tf + ep + 10000 * nf * ep / ef)
 */
function zoltar(stats: ExecutionStats): number {
  const { executedFailed: ef, executedPassed: ep, notExecutedFailed: nf, totalFailed: tf } = stats;

  if (ef === 0) return 0;

  const penalty = ef > 0 ? (10000 * nf * ep) / ef : 0;
  const denominator = tf + ep + penalty;

  if (denominator === 0) return 0;
  return ef / denominator;
}

/**
 * Calculate suspiciousness using Wong2 formula
 *
 * Wong2 = ef - ep
 */
function wong2(stats: ExecutionStats): number {
  const { executedFailed: ef, executedPassed: ep, totalFailed: tf } = stats;

  // Normalize by total failed
  if (tf === 0) return 0;
  return Math.max(0, (ef - ep) / tf);
}

/**
 * Calculate suspiciousness using Naish2 formula
 *
 * Naish2 = ef - (ep / (tp + 1))
 */
function naish2(stats: ExecutionStats): number {
  const { executedFailed: ef, executedPassed: ep, totalPassed: tp, totalFailed: tf } = stats;

  const score = ef - (ep / (tp + 1));
  // Normalize
  if (tf === 0) return 0;
  return Math.max(0, score / tf);
}

/**
 * Calculate suspiciousness using GP13 formula (Genetic Programming derived)
 *
 * GP13 = ef * (1 + 1/(2*ep + ef))
 */
function gp13(stats: ExecutionStats): number {
  const { executedFailed: ef, executedPassed: ep, totalFailed: tf } = stats;

  if (ef === 0 || tf === 0) return 0;

  const score = ef * (1 + 1 / (2 * ep + ef));
  // Normalize by max possible
  const maxPossible = tf * (1 + 1 / tf);
  return score / maxPossible;
}

/**
 * Calculate suspiciousness using Op2 formula
 *
 * Op2 = ef - (ep / (tp + 1))
 */
function op2(stats: ExecutionStats): number {
  const { executedFailed: ef, executedPassed: ep, totalPassed: tp, totalFailed: tf } = stats;

  if (tf === 0) return 0;

  const score = ef - (ep / (tp + 1));
  return Math.max(0, score / tf);
}

/**
 * Get the formula function for a given formula type
 */
function getFormulaFunction(
  formula: SBFLFormula,
  exponent: number = 2
): (stats: ExecutionStats) => number {
  switch (formula) {
    case 'tarantula':
      return tarantula;
    case 'ochiai':
      return ochiai;
    case 'dstar':
      return (stats) => dstar(stats, exponent);
    case 'barinel':
      return barinel;
    case 'jaccard':
      return jaccard;
    case 'kulczynski2':
      return kulczynski2;
    case 'mccon':
      return mccon;
    case 'minus':
      return minus;
    case 'zoltar':
      return zoltar;
    case 'wong2':
      return wong2;
    case 'naish2':
      return naish2;
    case 'gp13':
      return gp13;
    case 'op2':
      return op2;
    default:
      return ochiai;
  }
}

// =============================================================================
// SBFL Analyzer Implementation
// =============================================================================

/**
 * SBFL Fault Localization Analyzer
 *
 * Analyzes test execution coverage to identify suspicious code elements
 * using spectrum-based fault localization techniques.
 */
export class SBFLAnalyzer {
  private config: SBFLConfig;

  constructor(config: Partial<SBFLConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // Spectrum Building
  // ===========================================================================

  /**
   * Create a coverage spectrum from test executions
   */
  createSpectrum(
    elements: CodeElement[],
    tests: TestExecution[]
  ): CoverageSpectrum {
    // Build element index for fast lookup
    const elementIndex = new Map<string, number>();
    elements.forEach((el, idx) => elementIndex.set(el.id, idx));

    // Build coverage matrix
    const matrix: boolean[][] = elements.map(() =>
      tests.map(() => false)
    );

    for (let testIdx = 0; testIdx < tests.length; testIdx++) {
      const test = tests[testIdx];
      if (!test) continue;

      for (const elementId of test.coveredElements) {
        const elementIdx = elementIndex.get(elementId);
        if (elementIdx !== undefined) {
          const row = matrix[elementIdx];
          if (row) {
            row[testIdx] = true;
          }
        }
      }
    }

    return { elements, tests, matrix };
  }

  /**
   * Create spectrum from raw coverage data
   */
  createSpectrumFromCoverage(
    coverageData: Array<{
      file: string;
      lines: Map<number, boolean>;
    }>,
    testResults: Array<{
      testId: string;
      testName: string;
      passed: boolean;
      coveredLines: Array<{ file: string; line: number }>;
      errorMessage?: string;
    }>
  ): CoverageSpectrum {
    // Create code elements from coverage data
    const elements: CodeElement[] = [];
    const elementMap = new Map<string, string>(); // "file:line" -> elementId

    for (const coverage of coverageData) {
      for (const [line] of coverage.lines) {
        const id = `${coverage.file}:${line}`;
        if (!elementMap.has(id)) {
          elementMap.set(id, id);
          elements.push({
            id,
            type: 'line',
            location: { file: coverage.file, line },
          });
        }
      }
    }

    // Create test executions
    const tests: TestExecution[] = testResults.map((result) => {
      const test: TestExecution = {
        testId: result.testId,
        testName: result.testName,
        passed: result.passed,
        coveredElements: result.coveredLines.map((l) => `${l.file}:${l.line}`),
      };
      if (result.errorMessage) {
        test.errorMessage = result.errorMessage;
      }
      return test;
    });

    return this.createSpectrum(elements, tests);
  }

  // ===========================================================================
  // Analysis
  // ===========================================================================

  /**
   * Analyze a coverage spectrum and calculate suspiciousness scores
   */
  analyze(spectrum: CoverageSpectrum): SBFLResult {
    const startTime = Date.now();

    // Calculate execution statistics for each element
    const totalPassed = spectrum.tests.filter((t) => t.passed).length;
    const totalFailed = spectrum.tests.filter((t) => !t.passed).length;

    const rankings: SuspiciousnessScore[] = [];
    const formulaFn = getFormulaFunction(this.config.formula, this.config.dstarExponent);

    for (let elemIdx = 0; elemIdx < spectrum.elements.length; elemIdx++) {
      const element = spectrum.elements[elemIdx];
      if (!element) continue;

      const coverage = spectrum.matrix[elemIdx] ?? [];

      // Calculate execution statistics
      let executedFailed = 0;
      let executedPassed = 0;

      for (let testIdx = 0; testIdx < spectrum.tests.length; testIdx++) {
        const test = spectrum.tests[testIdx];
        const isCovered = coverage[testIdx];

        if (test && isCovered) {
          if (test.passed) {
            executedPassed++;
          } else {
            executedFailed++;
          }
        }
      }

      const stats: ExecutionStats = {
        executedFailed,
        executedPassed,
        notExecutedFailed: totalFailed - executedFailed,
        notExecutedPassed: totalPassed - executedPassed,
        totalFailed,
        totalPassed,
      };

      const score = formulaFn(stats);

      rankings.push({
        element,
        score: isFinite(score) ? score : 0,
        formula: this.config.formula,
        stats,
        rank: 0, // Will be set after sorting
        percentile: 0, // Will be set after sorting
      });
    }

    // Sort by score (descending)
    rankings.sort((a, b) => b.score - a.score);

    // Apply tie-breaking if enabled
    if (this.config.tieBreaking) {
      this.applyTieBreaking(rankings, spectrum);
    }

    // Calculate ranks and percentiles
    for (let i = 0; i < rankings.length; i++) {
      const ranking = rankings[i];
      if (ranking) {
        ranking.rank = i + 1;
        ranking.percentile = ((rankings.length - i) / rankings.length) * 100;
      }
    }

    // Calculate statistics
    const scores = rankings.map((r) => r.score);
    const nonZeroScores = scores.filter((s) => s > 0);
    const sortedScores = [...scores].sort((a, b) => a - b);

    const statistics: SBFLStatistics = {
      totalElements: spectrum.elements.length,
      totalTests: spectrum.tests.length,
      passingTests: totalPassed,
      failingTests: totalFailed,
      averageCoverage: this.calculateAverageCoverage(spectrum),
      suspiciousElements: nonZeroScores.length,
      maxScore: scores[0] ?? 0,
      medianScore: sortedScores[Math.floor(sortedScores.length / 2)] ?? 0,
      analysisTimeMs: Date.now() - startTime,
    };

    // Get top suspicious elements
    const topSuspicious = rankings
      .filter((r) => r.score >= this.config.minThreshold)
      .slice(0, this.config.topN);

    // Calculate confidence based on test distribution
    const confidence = this.calculateConfidence(spectrum, rankings);

    return {
      rankings,
      formula: this.config.formula,
      spectrum,
      statistics,
      topSuspicious,
      confidence,
    };
  }

  /**
   * Apply tie-breaking using secondary formulas
   */
  private applyTieBreaking(
    rankings: SuspiciousnessScore[],
    _spectrum: CoverageSpectrum
  ): void {
    if (this.config.secondaryFormulas.length === 0) return;

    // Group elements by score
    const groups = new Map<number, SuspiciousnessScore[]>();
    for (const ranking of rankings) {
      const key = Math.round(ranking.score * 1000000) / 1000000;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(ranking);
    }

    // Apply secondary formulas to break ties
    for (const group of groups.values()) {
      if (group.length <= 1) continue;

      // Calculate secondary scores
      const secondaryScores = new Map<string, number[]>();

      for (const formula of this.config.secondaryFormulas) {
        const formulaFn = getFormulaFunction(formula, this.config.dstarExponent);

        for (const ranking of group) {
          const score = formulaFn(ranking.stats);
          if (!secondaryScores.has(ranking.element.id)) {
            secondaryScores.set(ranking.element.id, []);
          }
          secondaryScores.get(ranking.element.id)!.push(score);
        }
      }

      // Sort group by secondary scores
      group.sort((a, b) => {
        const scoresA = secondaryScores.get(a.element.id) ?? [];
        const scoresB = secondaryScores.get(b.element.id) ?? [];

        for (let i = 0; i < scoresA.length; i++) {
          const diff = (scoresB[i] ?? 0) - (scoresA[i] ?? 0);
          if (Math.abs(diff) > 0.0001) return diff;
        }
        return 0;
      });
    }

    // Rebuild rankings from sorted groups
    rankings.length = 0;
    const sortedKeys = [...groups.keys()].sort((a, b) => b - a);
    for (const key of sortedKeys) {
      rankings.push(...(groups.get(key) ?? []));
    }
  }

  /**
   * Calculate average coverage per test
   */
  private calculateAverageCoverage(spectrum: CoverageSpectrum): number {
    if (spectrum.tests.length === 0) return 0;

    let totalCovered = 0;
    for (const test of spectrum.tests) {
      totalCovered += test.coveredElements.length;
    }

    return totalCovered / spectrum.tests.length;
  }

  /**
   * Calculate confidence in the analysis
   */
  private calculateConfidence(
    spectrum: CoverageSpectrum,
    rankings: SuspiciousnessScore[]
  ): number {
    // Factors affecting confidence:
    // 1. Number of tests (more = better)
    // 2. Balance of passing/failing tests
    // 3. Coverage diversity
    // 4. Score distribution

    const totalTests = spectrum.tests.length;
    const failingTests = spectrum.tests.filter((t) => !t.passed).length;

    // Test count factor (diminishing returns after 20 tests)
    const testCountFactor = Math.min(1, totalTests / 20);

    // Balance factor (best when roughly 20-50% fail)
    const failRatio = failingTests / totalTests;
    const balanceFactor = failRatio > 0.1 && failRatio < 0.5 ? 1 : 0.5;

    // Coverage factor (more coverage = more confidence)
    const avgCoverage = this.calculateAverageCoverage(spectrum);
    const elementCount = spectrum.elements.length;
    const coverageRatio = elementCount > 0 ? avgCoverage / elementCount : 0;
    const coverageFactor = Math.min(1, coverageRatio * 2);

    // Separation factor (clear separation of top suspects)
    let separationFactor = 0.5;
    if (rankings.length >= 2) {
      const topScore = rankings[0]?.score ?? 0;
      const secondScore = rankings[1]?.score ?? 0;
      if (topScore > 0) {
        separationFactor = Math.min(1, (topScore - secondScore) / topScore + 0.5);
      }
    }

    return (
      testCountFactor * 0.25 +
      balanceFactor * 0.25 +
      coverageFactor * 0.25 +
      separationFactor * 0.25
    );
  }

  // ===========================================================================
  // Multi-Formula Analysis
  // ===========================================================================

  /**
   * Analyze with multiple formulas for comparison
   */
  analyzeMultiple(
    spectrum: CoverageSpectrum,
    formulas: SBFLFormula[] = ['ochiai', 'tarantula', 'dstar', 'barinel']
  ): Map<SBFLFormula, SBFLResult> {
    const results = new Map<SBFLFormula, SBFLResult>();

    for (const formula of formulas) {
      const analyzer = new SBFLAnalyzer({ ...this.config, formula });
      results.set(formula, analyzer.analyze(spectrum));
    }

    return results;
  }

  /**
   * Get consensus ranking from multiple formulas
   */
  getConsensusRanking(
    spectrum: CoverageSpectrum,
    formulas: SBFLFormula[] = ['ochiai', 'tarantula', 'dstar', 'barinel']
  ): SuspiciousnessScore[] {
    const results = this.analyzeMultiple(spectrum, formulas);

    // Calculate average rank for each element
    const rankSums = new Map<string, { sum: number; count: number; element: CodeElement; stats: ExecutionStats }>();

    for (const result of results.values()) {
      for (const ranking of result.rankings) {
        const existing = rankSums.get(ranking.element.id);
        if (existing) {
          existing.sum += ranking.rank;
          existing.count++;
        } else {
          rankSums.set(ranking.element.id, {
            sum: ranking.rank,
            count: 1,
            element: ranking.element,
            stats: ranking.stats,
          });
        }
      }
    }

    // Create consensus rankings
    const consensus: SuspiciousnessScore[] = [];
    for (const [_id, data] of rankSums) {
      const avgRank = data.sum / data.count;
      // Convert average rank to score (inverse)
      const score = 1 / (avgRank || 1);

      consensus.push({
        element: data.element,
        score,
        formula: 'ochiai' as SBFLFormula, // Placeholder
        stats: data.stats,
        rank: 0,
        percentile: 0,
      });
    }

    // Sort by score (descending) and calculate ranks
    consensus.sort((a, b) => b.score - a.score);
    for (let i = 0; i < consensus.length; i++) {
      const item = consensus[i];
      if (item) {
        item.rank = i + 1;
        item.percentile = ((consensus.length - i) / consensus.length) * 100;
      }
    }

    return consensus;
  }

  // ===========================================================================
  // Aggregation
  // ===========================================================================

  /**
   * Aggregate scores by function
   */
  aggregateByFunction(rankings: SuspiciousnessScore[]): Map<string, {
    functionName: string;
    file: string;
    maxScore: number;
    avgScore: number;
    elements: SuspiciousnessScore[];
  }> {
    const functionGroups = new Map<string, SuspiciousnessScore[]>();

    for (const ranking of rankings) {
      const funcName = ranking.element.functionName ?? 'unknown';
      const file = ranking.element.location.file;
      const key = `${file}:${funcName}`;

      if (!functionGroups.has(key)) {
        functionGroups.set(key, []);
      }
      functionGroups.get(key)!.push(ranking);
    }

    const result = new Map<string, {
      functionName: string;
      file: string;
      maxScore: number;
      avgScore: number;
      elements: SuspiciousnessScore[];
    }>();

    for (const [key, elements] of functionGroups) {
      const [file, funcName] = key.split(':');
      const scores = elements.map((e) => e.score);
      const maxScore = Math.max(...scores);
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      result.set(key, {
        functionName: funcName ?? 'unknown',
        file: file ?? '',
        maxScore,
        avgScore,
        elements,
      });
    }

    return result;
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Filter rankings by file
   */
  filterByFile(rankings: SuspiciousnessScore[], filePath: string): SuspiciousnessScore[] {
    return rankings.filter((r) => r.element.location.file === filePath);
  }

  /**
   * Get elements within a specific line range
   */
  getInRange(
    rankings: SuspiciousnessScore[],
    file: string,
    startLine: number,
    endLine: number
  ): SuspiciousnessScore[] {
    return rankings.filter((r) => {
      const loc = r.element.location;
      return (
        loc.file === file &&
        loc.line >= startLine &&
        loc.line <= endLine
      );
    });
  }

  /**
   * Format ranking for display
   */
  formatRanking(ranking: SuspiciousnessScore): string {
    const loc = ranking.element.location;
    return `#${ranking.rank} ${loc.file}:${loc.line} (score: ${ranking.score.toFixed(4)}, ` +
      `ef: ${ranking.stats.executedFailed}, ep: ${ranking.stats.executedPassed})`;
  }

  /**
   * Export rankings as CSV
   */
  exportAsCSV(rankings: SuspiciousnessScore[]): string {
    const headers = [
      'rank',
      'file',
      'line',
      'score',
      'percentile',
      'executed_failed',
      'executed_passed',
      'not_executed_failed',
      'not_executed_passed',
    ];

    const rows = rankings.map((r) => [
      r.rank.toString(),
      r.element.location.file,
      r.element.location.line.toString(),
      r.score.toFixed(6),
      r.percentile.toFixed(2),
      r.stats.executedFailed.toString(),
      r.stats.executedPassed.toString(),
      r.stats.notExecutedFailed.toString(),
      r.stats.notExecutedPassed.toString(),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an SBFL analyzer with optional configuration
 */
export function createSBFLAnalyzer(config: Partial<SBFLConfig> = {}): SBFLAnalyzer {
  return new SBFLAnalyzer(config);
}

/**
 * Quick function to analyze test coverage and get suspicious elements
 */
export function analyzeFaultLocalization(
  elements: CodeElement[],
  tests: TestExecution[],
  config: Partial<SBFLConfig> = {}
): SBFLResult {
  const analyzer = createSBFLAnalyzer(config);
  const spectrum = analyzer.createSpectrum(elements, tests);
  return analyzer.analyze(spectrum);
}

/**
 * Quick function to get top suspicious lines
 */
export function getTopSuspiciousLines(
  elements: CodeElement[],
  tests: TestExecution[],
  topN: number = 10,
  formula: SBFLFormula = 'ochiai'
): SuspiciousnessScore[] {
  const result = analyzeFaultLocalization(elements, tests, { formula, topN });
  return result.topSuspicious;
}
