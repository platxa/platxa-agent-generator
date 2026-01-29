/**
 * Evidence Collector (Feature #33)
 *
 * Collects evidence from code structure and tests to support or refute
 * debugging hypotheses. Provides evidence-based RCA rather than speculation.
 *
 * @packageDocumentation
 */

import { randomUUID } from 'node:crypto';
import type {
  Evidence,
  RootCauseHypothesis,
  SourceLocation,
  NormalizedError,
  Language,
} from './types.js';
import type { TestResult, TestSuiteResult } from './test-runner.js';
import type { CodeContext } from './context-engine.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Evidence type categories.
 */
export type EvidenceType = Evidence['type'];

/**
 * Evidence direction - supports or refutes a hypothesis.
 */
export type EvidenceDirection = 'supporting' | 'refuting' | 'neutral';

/**
 * Source of evidence collection.
 */
export type EvidenceSource =
  | 'code_analysis'      // AST/code structure analysis
  | 'test_results'       // Test execution results
  | 'test_coverage'      // Code coverage data
  | 'type_checking'      // Type system analysis
  | 'static_analysis'    // Linter/static analysis tools
  | 'git_history'        // Version control history
  | 'error_pattern'      // Pattern matching against known errors
  | 'data_flow'          // Data flow analysis
  | 'control_flow'       // Control flow analysis
  | 'dependency_graph';  // Import/dependency analysis

/**
 * Detailed evidence item with metadata.
 */
export interface DetailedEvidence extends Evidence {
  /** Unique identifier */
  id: string;
  /** Direction relative to hypothesis */
  direction: EvidenceDirection;
  /** Source of the evidence */
  source: EvidenceSource;
  /** Hypothesis ID this evidence relates to */
  hypothesisId: string;
  /** Confidence in the evidence itself (0-1) */
  confidence: number;
  /** Supporting details */
  details: Record<string, unknown>;
  /** Related code snippet */
  codeSnippet?: string;
  /** Timestamp of collection */
  collectedAt: number;
}

/**
 * Code structure for evidence analysis.
 */
export interface CodeStructure {
  /** File path */
  filePath: string;
  /** Language */
  language: Language;
  /** Function/method definitions */
  functions: FunctionDefinition[];
  /** Variable declarations */
  variables: VariableDeclaration[];
  /** Class definitions */
  classes: ClassDefinition[];
  /** Import statements */
  imports: ImportStatement[];
  /** Export statements */
  exports: ExportStatement[];
  /** Control flow structures */
  controlFlow: ControlFlowStructure[];
}

/**
 * Function definition in code.
 */
export interface FunctionDefinition {
  /** Function name */
  name: string;
  /** Parameters */
  parameters: ParameterDefinition[];
  /** Return type (if available) */
  returnType?: string;
  /** Source location */
  location: SourceLocation;
  /** Whether it's async */
  isAsync: boolean;
  /** Whether it's a generator */
  isGenerator: boolean;
  /** Complexity score */
  complexity: number;
  /** Called functions */
  calls: string[];
}

/**
 * Parameter definition.
 */
export interface ParameterDefinition {
  /** Parameter name */
  name: string;
  /** Parameter type (if available) */
  type?: string;
  /** Default value (if any) */
  defaultValue?: string;
  /** Whether parameter is optional */
  isOptional: boolean;
}

/**
 * Variable declaration.
 */
export interface VariableDeclaration {
  /** Variable name */
  name: string;
  /** Variable type (if available) */
  type?: string;
  /** Declaration kind */
  kind: 'const' | 'let' | 'var' | 'parameter' | 'property';
  /** Source location */
  location: SourceLocation;
  /** Whether it's used */
  isUsed: boolean;
  /** Whether it's modified after declaration */
  isModified: boolean;
}

/**
 * Class definition.
 */
export interface ClassDefinition {
  /** Class name */
  name: string;
  /** Parent class (if extending) */
  extends?: string;
  /** Implemented interfaces */
  implements: string[];
  /** Methods */
  methods: FunctionDefinition[];
  /** Properties */
  properties: VariableDeclaration[];
  /** Source location */
  location: SourceLocation;
}

/**
 * Import statement.
 */
export interface ImportStatement {
  /** Module specifier */
  source: string;
  /** Imported names */
  names: string[];
  /** Whether it's a type import */
  isTypeOnly: boolean;
  /** Source location */
  location: SourceLocation;
}

/**
 * Export statement.
 */
export interface ExportStatement {
  /** Exported names */
  names: string[];
  /** Whether it's a re-export */
  isReExport: boolean;
  /** Source (for re-exports) */
  source?: string;
  /** Source location */
  location: SourceLocation;
}

/**
 * Control flow structure.
 */
export interface ControlFlowStructure {
  /** Type of control flow */
  type: 'if' | 'switch' | 'loop' | 'try' | 'throw' | 'return';
  /** Source location */
  location: SourceLocation;
  /** Branches (for if/switch) */
  branches: number;
  /** Has else/default branch */
  hasDefault: boolean;
  /** Nested depth */
  depth: number;
}

/**
 * Test coverage data.
 */
export interface CoverageData {
  /** File path */
  filePath: string;
  /** Line coverage (line number -> hit count) */
  lines: Map<number, number>;
  /** Branch coverage (branch id -> [taken, not taken]) */
  branches: Map<string, [number, number]>;
  /** Function coverage (function name -> hit count) */
  functions: Map<string, number>;
  /** Overall line coverage percentage */
  linePercentage: number;
  /** Overall branch coverage percentage */
  branchPercentage: number;
}

/**
 * Evidence collection result.
 */
export interface EvidenceCollectionResult {
  /** Hypothesis being evaluated */
  hypothesisId: string;
  /** Collected evidence */
  evidence: DetailedEvidence[];
  /** Supporting evidence count */
  supportingCount: number;
  /** Refuting evidence count */
  refutingCount: number;
  /** Neutral evidence count */
  neutralCount: number;
  /** Overall support score (-1 to 1) */
  supportScore: number;
  /** Collection duration in ms */
  durationMs: number;
  /** Collection timestamp */
  collectedAt: number;
  /** Summary of findings */
  summary: string;
}

/**
 * Batch evidence collection result.
 */
export interface BatchEvidenceResult {
  /** Results per hypothesis */
  results: Map<string, EvidenceCollectionResult>;
  /** All collected evidence */
  allEvidence: DetailedEvidence[];
  /** Total collection duration */
  totalDurationMs: number;
  /** Overall summary */
  summary: string;
}

/**
 * Configuration for the evidence collector.
 */
export interface EvidenceCollectorConfig {
  /** Minimum evidence strength to include */
  minStrength?: number;
  /** Maximum evidence items per hypothesis */
  maxEvidencePerHypothesis?: number;
  /** Whether to analyze code structure */
  analyzeCodeStructure?: boolean;
  /** Whether to analyze test results */
  analyzeTests?: boolean;
  /** Whether to analyze coverage */
  analyzeCoverage?: boolean;
  /** Whether to analyze git history */
  analyzeGitHistory?: boolean;
  /** Whether to perform data flow analysis */
  analyzeDataFlow?: boolean;
  /** Custom evidence sources */
  customSources?: EvidenceSource[];
}

// =============================================================================
// Evidence Collection Strategies
// =============================================================================

/**
 * Strategy for collecting evidence from a specific source.
 */
interface EvidenceCollectionStrategy {
  /** Source type */
  source: EvidenceSource;
  /** Collect evidence for a hypothesis */
  collect(
    hypothesis: RootCauseHypothesis,
    context: EvidenceContext
  ): DetailedEvidence[];
}

/**
 * Context provided to evidence collection strategies.
 */
export interface EvidenceContext {
  /** Normalized error */
  error: NormalizedError;
  /** Code structures for relevant files */
  codeStructures: CodeStructure[];
  /** Test results */
  testResults?: TestSuiteResult;
  /** Coverage data */
  coverage?: CoverageData[];
  /** Code context from context engine */
  codeContext?: CodeContext;
  /** Git history data */
  gitHistory?: GitHistoryData[];
}

/**
 * Git history entry.
 */
export interface GitHistoryData {
  /** File path */
  filePath: string;
  /** Commit hash */
  commitHash: string;
  /** Author */
  author: string;
  /** Date */
  date: Date;
  /** Changed lines */
  changedLines: number[];
  /** Commit message */
  message: string;
}

// =============================================================================
// Evidence Collector Implementation
// =============================================================================

/**
 * Collects evidence from code structure and tests to evaluate hypotheses.
 *
 * @example
 * ```typescript
 * const collector = createEvidenceCollector();
 *
 * const result = await collector.collectEvidence(
 *   hypothesis,
 *   {
 *     error: normalizedError,
 *     codeStructures: [codeStructure],
 *     testResults: testSuiteResult,
 *   }
 * );
 *
 * console.log(`Support score: ${result.supportScore}`);
 * console.log(`Supporting: ${result.supportingCount}, Refuting: ${result.refutingCount}`);
 * ```
 */
export class EvidenceCollector {
  /** Configuration */
  private readonly config: Required<EvidenceCollectorConfig>;

  /** Collection strategies */
  private readonly strategies: EvidenceCollectionStrategy[];

  constructor(config: EvidenceCollectorConfig = {}) {
    this.config = {
      minStrength: config.minStrength ?? 0.1,
      maxEvidencePerHypothesis: config.maxEvidencePerHypothesis ?? 20,
      analyzeCodeStructure: config.analyzeCodeStructure ?? true,
      analyzeTests: config.analyzeTests ?? true,
      analyzeCoverage: config.analyzeCoverage ?? true,
      analyzeGitHistory: config.analyzeGitHistory ?? true,
      analyzeDataFlow: config.analyzeDataFlow ?? true,
      customSources: config.customSources ?? [],
    };

    this.strategies = this.initializeStrategies();
  }

  /**
   * Initialize evidence collection strategies.
   */
  private initializeStrategies(): EvidenceCollectionStrategy[] {
    const strategies: EvidenceCollectionStrategy[] = [];

    if (this.config.analyzeCodeStructure) {
      strategies.push(new CodeAnalysisStrategy());
    }

    if (this.config.analyzeTests) {
      strategies.push(new TestResultsStrategy());
    }

    if (this.config.analyzeCoverage) {
      strategies.push(new CoverageAnalysisStrategy());
    }

    if (this.config.analyzeGitHistory) {
      strategies.push(new GitHistoryStrategy());
    }

    if (this.config.analyzeDataFlow) {
      strategies.push(new DataFlowStrategy());
    }

    strategies.push(new ErrorPatternStrategy());
    strategies.push(new TypeCheckingStrategy());

    return strategies;
  }

  /**
   * Collect evidence for a single hypothesis.
   */
  collectEvidence(
    hypothesis: RootCauseHypothesis,
    context: EvidenceContext
  ): EvidenceCollectionResult {
    const startTime = Date.now();
    const allEvidence: DetailedEvidence[] = [];

    // Collect evidence from all strategies
    for (const strategy of this.strategies) {
      try {
        const evidence = strategy.collect(hypothesis, context);
        allEvidence.push(...evidence);
      } catch {
        // Continue with other strategies if one fails
      }
    }

    // Filter by minimum strength
    const filteredEvidence = allEvidence.filter(
      (e) => e.strength >= this.config.minStrength
    );

    // Sort by strength (descending)
    filteredEvidence.sort((a, b) => b.strength - a.strength);

    // Limit evidence count
    const limitedEvidence = filteredEvidence.slice(
      0,
      this.config.maxEvidencePerHypothesis
    );

    // Calculate counts
    const supportingCount = limitedEvidence.filter(
      (e) => e.direction === 'supporting'
    ).length;
    const refutingCount = limitedEvidence.filter(
      (e) => e.direction === 'refuting'
    ).length;
    const neutralCount = limitedEvidence.filter(
      (e) => e.direction === 'neutral'
    ).length;

    // Calculate support score
    const supportScore = this.calculateSupportScore(limitedEvidence);

    const durationMs = Date.now() - startTime;

    return {
      hypothesisId: hypothesis.id,
      evidence: limitedEvidence,
      supportingCount,
      refutingCount,
      neutralCount,
      supportScore,
      durationMs,
      collectedAt: Date.now(),
      summary: this.generateSummary(
        hypothesis,
        limitedEvidence,
        supportScore
      ),
    };
  }

  /**
   * Collect evidence for multiple hypotheses.
   */
  collectBatchEvidence(
    hypotheses: RootCauseHypothesis[],
    context: EvidenceContext
  ): BatchEvidenceResult {
    const startTime = Date.now();
    const results = new Map<string, EvidenceCollectionResult>();
    const allEvidence: DetailedEvidence[] = [];

    for (const hypothesis of hypotheses) {
      const result = this.collectEvidence(hypothesis, context);
      results.set(hypothesis.id, result);
      allEvidence.push(...result.evidence);
    }

    const totalDurationMs = Date.now() - startTime;

    // Generate overall summary
    const summaryParts: string[] = [];
    for (const [id, result] of results) {
      const hypothesis = hypotheses.find((h) => h.id === id);
      if (hypothesis !== undefined) {
        const direction =
          result.supportScore > 0.3
            ? 'supported'
            : result.supportScore < -0.3
              ? 'refuted'
              : 'inconclusive';
        summaryParts.push(
          `"${hypothesis.description.slice(0, 50)}...": ${direction} (${result.supportScore.toFixed(2)})`
        );
      }
    }

    return {
      results,
      allEvidence,
      totalDurationMs,
      summary: `Analyzed ${hypotheses.length} hypotheses:\n${summaryParts.join('\n')}`,
    };
  }

  /**
   * Calculate support score from evidence.
   */
  private calculateSupportScore(evidence: DetailedEvidence[]): number {
    if (evidence.length === 0) {
      return 0;
    }

    let weightedSum = 0;
    let totalWeight = 0;

    for (const e of evidence) {
      const directionMultiplier =
        e.direction === 'supporting' ? 1 : e.direction === 'refuting' ? -1 : 0;
      const weight = e.strength * e.confidence;
      weightedSum += directionMultiplier * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Generate a summary of evidence collection.
   */
  private generateSummary(
    hypothesis: RootCauseHypothesis,
    evidence: DetailedEvidence[],
    supportScore: number
  ): string {
    const supportingEvidence = evidence.filter(
      (e) => e.direction === 'supporting'
    );
    const refutingEvidence = evidence.filter((e) => e.direction === 'refuting');

    let conclusion: string;
    if (supportScore > 0.5) {
      conclusion = 'strongly supported';
    } else if (supportScore > 0.2) {
      conclusion = 'moderately supported';
    } else if (supportScore > -0.2) {
      conclusion = 'inconclusive';
    } else if (supportScore > -0.5) {
      conclusion = 'moderately refuted';
    } else {
      conclusion = 'strongly refuted';
    }

    const parts: string[] = [
      `Hypothesis "${hypothesis.description.slice(0, 100)}" is ${conclusion}.`,
    ];

    if (supportingEvidence.length > 0) {
      parts.push(
        `Supporting evidence (${supportingEvidence.length}): ${supportingEvidence
          .slice(0, 3)
          .map((e) => e.description)
          .join('; ')}`
      );
    }

    if (refutingEvidence.length > 0) {
      parts.push(
        `Refuting evidence (${refutingEvidence.length}): ${refutingEvidence
          .slice(0, 3)
          .map((e) => e.description)
          .join('; ')}`
      );
    }

    return parts.join(' ');
  }

  /**
   * Analyze code structure for a file.
   */
  analyzeCodeStructure(
    source: string,
    filePath: string,
    language: Language
  ): CodeStructure {
    return parseCodeStructure(source, filePath, language);
  }

  /**
   * Extract evidence from test results.
   */
  extractTestEvidence(
    testResults: TestSuiteResult,
    hypothesis: RootCauseHypothesis
  ): DetailedEvidence[] {
    const strategy = new TestResultsStrategy();
    return strategy.collect(hypothesis, {
      error: {
        id: '',
        type: 'Error',
        message: '',
        severity: 'error',
        source: 'runtime',
        language: 'javascript',
        raw: '',
        timestamp: new Date(),
      },
      codeStructures: [],
      testResults,
    });
  }

  /**
   * Extract evidence from coverage data.
   */
  extractCoverageEvidence(
    coverage: CoverageData[],
    hypothesis: RootCauseHypothesis
  ): DetailedEvidence[] {
    const strategy = new CoverageAnalysisStrategy();
    return strategy.collect(hypothesis, {
      error: {
        id: '',
        type: 'Error',
        message: '',
        severity: 'error',
        source: 'runtime',
        language: 'javascript',
        raw: '',
        timestamp: new Date(),
      },
      codeStructures: [],
      coverage,
    });
  }
}

// =============================================================================
// Evidence Collection Strategies Implementation
// =============================================================================

/**
 * Code analysis strategy - examines code structure for evidence.
 */
class CodeAnalysisStrategy implements EvidenceCollectionStrategy {
  source: EvidenceSource = 'code_analysis';

  collect(
    hypothesis: RootCauseHypothesis,
    context: EvidenceContext
  ): DetailedEvidence[] {
    const evidence: DetailedEvidence[] = [];
    const now = Date.now();

    for (const structure of context.codeStructures) {
      // Check for null/undefined handling issues
      if (
        hypothesis.description.toLowerCase().includes('null') ||
        hypothesis.description.toLowerCase().includes('undefined')
      ) {
        const nullIssues = this.findNullabilityIssues(structure);
        for (const issue of nullIssues) {
          const evidenceItem: DetailedEvidence = {
            id: randomUUID(),
            type: 'code',
            description: issue.description,
            location: issue.location,
            strength: issue.strength,
            direction: issue.direction,
            source: this.source,
            hypothesisId: hypothesis.id,
            confidence: 0.7,
            details: { type: 'nullability', issue },
            collectedAt: now,
          };
          if (issue.codeSnippet !== undefined) {
            evidenceItem.codeSnippet = issue.codeSnippet;
          }
          evidence.push(evidenceItem);
        }
      }

      // Check for type mismatches
      if (hypothesis.description.toLowerCase().includes('type')) {
        const typeIssues = this.findTypeIssues(structure);
        for (const issue of typeIssues) {
          const evidenceItem: DetailedEvidence = {
            id: randomUUID(),
            type: 'code',
            description: issue.description,
            location: issue.location,
            strength: issue.strength,
            direction: issue.direction,
            source: this.source,
            hypothesisId: hypothesis.id,
            confidence: 0.8,
            details: { type: 'type_mismatch', issue },
            collectedAt: now,
          };
          if (issue.codeSnippet !== undefined) {
            evidenceItem.codeSnippet = issue.codeSnippet;
          }
          evidence.push(evidenceItem);
        }
      }

      // Check for complexity issues
      const complexFunctions = structure.functions.filter(
        (f) => f.complexity > 10
      );
      for (const func of complexFunctions) {
        if (this.isRelatedToHypothesis(func, hypothesis)) {
          evidence.push({
            id: randomUUID(),
            type: 'code',
            description: `High complexity function "${func.name}" (complexity: ${func.complexity}) may be error-prone`,
            location: func.location,
            strength: Math.min(func.complexity / 20, 1),
            direction: 'supporting',
            source: this.source,
            hypothesisId: hypothesis.id,
            confidence: 0.5,
            details: { complexity: func.complexity, functionName: func.name },
            collectedAt: now,
          });
        }
      }

      // Check for unused variables
      const unusedVars = structure.variables.filter((v) => !v.isUsed);
      for (const varDecl of unusedVars) {
        if (hypothesis.description.includes(varDecl.name)) {
          evidence.push({
            id: randomUUID(),
            type: 'code',
            description: `Unused variable "${varDecl.name}" may indicate logic error`,
            location: varDecl.location,
            strength: 0.4,
            direction: 'supporting',
            source: this.source,
            hypothesisId: hypothesis.id,
            confidence: 0.6,
            details: { variableName: varDecl.name },
            collectedAt: now,
          });
        }
      }
    }

    return evidence;
  }

  private findNullabilityIssues(
    structure: CodeStructure
  ): Array<{
    description: string;
    location: SourceLocation;
    strength: number;
    direction: EvidenceDirection;
    codeSnippet?: string;
  }> {
    const issues: Array<{
      description: string;
      location: SourceLocation;
      strength: number;
      direction: EvidenceDirection;
      codeSnippet?: string;
    }> = [];

    // Check for optional parameters without default values
    for (const func of structure.functions) {
      for (const param of func.parameters) {
        if (param.isOptional && param.defaultValue === undefined) {
          issues.push({
            description: `Optional parameter "${param.name}" in "${func.name}" has no default value`,
            location: func.location,
            strength: 0.6,
            direction: 'supporting',
          });
        }
      }
    }

    return issues;
  }

  private findTypeIssues(
    structure: CodeStructure
  ): Array<{
    description: string;
    location: SourceLocation;
    strength: number;
    direction: EvidenceDirection;
    codeSnippet?: string;
  }> {
    const issues: Array<{
      description: string;
      location: SourceLocation;
      strength: number;
      direction: EvidenceDirection;
      codeSnippet?: string;
    }> = [];

    // Check for any types
    for (const func of structure.functions) {
      if (func.returnType === 'any') {
        issues.push({
          description: `Function "${func.name}" returns "any" type, losing type safety`,
          location: func.location,
          strength: 0.5,
          direction: 'supporting',
        });
      }

      for (const param of func.parameters) {
        if (param.type === 'any') {
          issues.push({
            description: `Parameter "${param.name}" in "${func.name}" has "any" type`,
            location: func.location,
            strength: 0.4,
            direction: 'supporting',
          });
        }
      }
    }

    return issues;
  }

  private isRelatedToHypothesis(
    func: FunctionDefinition,
    hypothesis: RootCauseHypothesis
  ): boolean {
    const hypothesisLower = hypothesis.description.toLowerCase();
    const funcNameLower = func.name.toLowerCase();

    // Check if function name is mentioned
    if (hypothesisLower.includes(funcNameLower)) {
      return true;
    }

    // Check if any related location matches
    for (const loc of hypothesis.relatedLocations) {
      if (loc.line === func.location.line && loc.file === func.location.file) {
        return true;
      }
    }

    return false;
  }
}

/**
 * Test results strategy - examines test outcomes for evidence.
 */
class TestResultsStrategy implements EvidenceCollectionStrategy {
  source: EvidenceSource = 'test_results';

  collect(
    hypothesis: RootCauseHypothesis,
    context: EvidenceContext
  ): DetailedEvidence[] {
    const evidence: DetailedEvidence[] = [];
    const now = Date.now();

    if (context.testResults === undefined) {
      return evidence;
    }

    const { testResults } = context;

    // Analyze failed tests
    for (const test of testResults.tests) {
      if (test.status === 'failed') {
        const isRelated = this.isTestRelatedToHypothesis(test, hypothesis);
        if (isRelated) {
          evidence.push({
            id: randomUUID(),
            type: 'test',
            description: `Test "${test.name}" failed: ${test.errorMessage ?? 'Unknown error'}`,
            strength: 0.8,
            direction: 'supporting',
            source: this.source,
            hypothesisId: hypothesis.id,
            confidence: 0.9,
            details: {
              testName: test.name,
              error: test.errorMessage,
              duration: test.durationMs,
            },
            collectedAt: now,
          });
        }
      }

      if (test.status === 'passed') {
        const isRelated = this.isTestRelatedToHypothesis(test, hypothesis);
        if (isRelated) {
          evidence.push({
            id: randomUUID(),
            type: 'test',
            description: `Test "${test.name}" passed, may refute hypothesis`,
            strength: 0.5,
            direction: 'refuting',
            source: this.source,
            hypothesisId: hypothesis.id,
            confidence: 0.7,
            details: {
              testName: test.name,
              duration: test.durationMs,
            },
            collectedAt: now,
          });
        }
      }
    }

    // Overall test suite analysis
    if (testResults.failed > 0 && testResults.passed === 0) {
      evidence.push({
        id: randomUUID(),
        type: 'test',
        description: `All ${testResults.failed} tests failed, indicating severe issue`,
        strength: 0.9,
        direction: 'supporting',
        source: this.source,
        hypothesisId: hypothesis.id,
        confidence: 0.8,
        details: {
          total: testResults.total,
          failed: testResults.failed,
          passed: testResults.passed,
        },
        collectedAt: now,
      });
    }

    return evidence;
  }

  private isTestRelatedToHypothesis(
    test: TestResult,
    hypothesis: RootCauseHypothesis
  ): boolean {
    const hypothesisLower = hypothesis.description.toLowerCase();
    const testNameLower = test.name.toLowerCase();

    // Check if test name relates to hypothesis
    const hypothesisWords = hypothesisLower.split(/\s+/);
    for (const word of hypothesisWords) {
      if (word.length > 3 && testNameLower.includes(word)) {
        return true;
      }
    }

    // Check if test error relates to hypothesis
    if (test.errorMessage !== undefined) {
      const errorLower = test.errorMessage.toLowerCase();
      for (const word of hypothesisWords) {
        if (word.length > 3 && errorLower.includes(word)) {
          return true;
        }
      }
    }

    return false;
  }
}

/**
 * Coverage analysis strategy - examines code coverage for evidence.
 */
class CoverageAnalysisStrategy implements EvidenceCollectionStrategy {
  source: EvidenceSource = 'test_coverage';

  collect(
    hypothesis: RootCauseHypothesis,
    context: EvidenceContext
  ): DetailedEvidence[] {
    const evidence: DetailedEvidence[] = [];
    const now = Date.now();

    if (context.coverage === undefined) {
      return evidence;
    }

    for (const cov of context.coverage) {
      // Check if hypothesis relates to this file
      const isRelated = hypothesis.relatedLocations.some(
        (loc) => loc.file === cov.filePath
      );

      if (!isRelated) {
        continue;
      }

      // Low coverage is supporting evidence for bugs
      if (cov.linePercentage < 50) {
        evidence.push({
          id: randomUUID(),
          type: 'test',
          description: `Low test coverage (${cov.linePercentage.toFixed(1)}%) in ${cov.filePath}`,
          strength: (100 - cov.linePercentage) / 100,
          direction: 'supporting',
          source: this.source,
          hypothesisId: hypothesis.id,
          confidence: 0.6,
          details: {
            filePath: cov.filePath,
            linePercentage: cov.linePercentage,
            branchPercentage: cov.branchPercentage,
          },
          collectedAt: now,
        });
      }

      // Check if specific lines in hypothesis locations are uncovered
      for (const loc of hypothesis.relatedLocations) {
        if (loc.file === cov.filePath) {
          const hitCount = cov.lines.get(loc.line);
          if (hitCount === 0) {
            evidence.push({
              id: randomUUID(),
              type: 'test',
              description: `Line ${loc.line} in ${loc.file} is not covered by tests`,
              location: loc,
              strength: 0.7,
              direction: 'supporting',
              source: this.source,
              hypothesisId: hypothesis.id,
              confidence: 0.8,
              details: {
                line: loc.line,
                hitCount: 0,
              },
              collectedAt: now,
            });
          } else if (hitCount !== undefined && hitCount > 10) {
            evidence.push({
              id: randomUUID(),
              type: 'test',
              description: `Line ${loc.line} is well-tested (${hitCount} executions)`,
              location: loc,
              strength: 0.5,
              direction: 'refuting',
              source: this.source,
              hypothesisId: hypothesis.id,
              confidence: 0.7,
              details: {
                line: loc.line,
                hitCount,
              },
              collectedAt: now,
            });
          }
        }
      }
    }

    return evidence;
  }
}

/**
 * Git history strategy - examines version control history for evidence.
 */
class GitHistoryStrategy implements EvidenceCollectionStrategy {
  source: EvidenceSource = 'git_history';

  collect(
    hypothesis: RootCauseHypothesis,
    context: EvidenceContext
  ): DetailedEvidence[] {
    const evidence: DetailedEvidence[] = [];
    const now = Date.now();

    if (context.gitHistory === undefined) {
      return evidence;
    }

    for (const history of context.gitHistory) {
      // Check if hypothesis relates to this file
      const relatedLocation = hypothesis.relatedLocations.find(
        (loc) => loc.file === history.filePath
      );

      if (relatedLocation === undefined) {
        continue;
      }

      // Check if changed lines include the hypothesis location
      if (history.changedLines.includes(relatedLocation.line)) {
        const daysSinceChange = Math.floor(
          (now - history.date.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Recent changes are more likely to be related to bugs
        const recentness = Math.max(0, 1 - daysSinceChange / 30);

        evidence.push({
          id: randomUUID(),
          type: 'history',
          description: `Line ${relatedLocation.line} was changed ${daysSinceChange} days ago: "${history.message.slice(0, 50)}"`,
          location: relatedLocation,
          strength: 0.5 + recentness * 0.4,
          direction: 'supporting',
          source: this.source,
          hypothesisId: hypothesis.id,
          confidence: 0.6,
          details: {
            commitHash: history.commitHash,
            author: history.author,
            date: history.date.toISOString(),
            message: history.message,
            daysSinceChange,
          },
          collectedAt: now,
        });
      }
    }

    return evidence;
  }
}

/**
 * Data flow strategy - analyzes data flow for evidence.
 */
class DataFlowStrategy implements EvidenceCollectionStrategy {
  source: EvidenceSource = 'data_flow';

  collect(
    hypothesis: RootCauseHypothesis,
    context: EvidenceContext
  ): DetailedEvidence[] {
    const evidence: DetailedEvidence[] = [];
    const now = Date.now();

    // Analyze variable modifications
    for (const structure of context.codeStructures) {
      const modifiedVars = structure.variables.filter((v) => v.isModified);

      for (const varDecl of modifiedVars) {
        // Check if variable is mentioned in hypothesis
        if (
          hypothesis.description.includes(varDecl.name) ||
          hypothesis.relatedLocations.some(
            (loc) =>
              loc.file === varDecl.location.file &&
              Math.abs(loc.line - varDecl.location.line) < 5
          )
        ) {
          evidence.push({
            id: randomUUID(),
            type: 'code',
            description: `Variable "${varDecl.name}" is modified after declaration, potential data flow issue`,
            location: varDecl.location,
            strength: 0.5,
            direction: 'supporting',
            source: this.source,
            hypothesisId: hypothesis.id,
            confidence: 0.5,
            details: {
              variableName: varDecl.name,
              kind: varDecl.kind,
            },
            collectedAt: now,
          });
        }
      }
    }

    return evidence;
  }
}

/**
 * Error pattern strategy - matches against known error patterns.
 */
class ErrorPatternStrategy implements EvidenceCollectionStrategy {
  source: EvidenceSource = 'error_pattern';

  private readonly patterns: Array<{
    name: string;
    keywords: string[];
    strength: number;
  }> = [
    { name: 'null_reference', keywords: ['null', 'undefined', 'cannot read'], strength: 0.8 },
    { name: 'type_error', keywords: ['type', 'expected', 'got'], strength: 0.7 },
    { name: 'async_error', keywords: ['async', 'await', 'promise', 'unhandled'], strength: 0.75 },
    { name: 'import_error', keywords: ['import', 'require', 'module', 'not found'], strength: 0.8 },
    { name: 'syntax_error', keywords: ['syntax', 'unexpected token', 'parse'], strength: 0.9 },
    { name: 'bounds_error', keywords: ['index', 'out of', 'bounds', 'range'], strength: 0.75 },
  ];

  collect(
    hypothesis: RootCauseHypothesis,
    context: EvidenceContext
  ): DetailedEvidence[] {
    const evidence: DetailedEvidence[] = [];
    const now = Date.now();

    const errorMessage = context.error.message.toLowerCase();
    const hypothesisText = hypothesis.description.toLowerCase();

    for (const pattern of this.patterns) {
      const errorMatches = pattern.keywords.filter((k) =>
        errorMessage.includes(k)
      ).length;
      const hypothesisMatches = pattern.keywords.filter((k) =>
        hypothesisText.includes(k)
      ).length;

      if (errorMatches > 0 && hypothesisMatches > 0) {
        const matchRatio =
          (errorMatches + hypothesisMatches) / (pattern.keywords.length * 2);

        evidence.push({
          id: randomUUID(),
          type: 'pattern',
          description: `Error matches "${pattern.name}" pattern (${(matchRatio * 100).toFixed(0)}% match)`,
          strength: pattern.strength * matchRatio,
          direction: 'supporting',
          source: this.source,
          hypothesisId: hypothesis.id,
          confidence: 0.7,
          details: {
            patternName: pattern.name,
            errorMatches,
            hypothesisMatches,
            matchRatio,
          },
          collectedAt: now,
        });
      }
    }

    return evidence;
  }
}

/**
 * Type checking strategy - analyzes type information for evidence.
 */
class TypeCheckingStrategy implements EvidenceCollectionStrategy {
  source: EvidenceSource = 'type_checking';

  collect(
    hypothesis: RootCauseHypothesis,
    context: EvidenceContext
  ): DetailedEvidence[] {
    const evidence: DetailedEvidence[] = [];
    const now = Date.now();

    // Check for type-related issues in code structures
    for (const structure of context.codeStructures) {
      if (
        structure.language !== 'typescript' &&
        structure.language !== 'javascript'
      ) {
        continue;
      }

      // Check function return types
      for (const func of structure.functions) {
        if (func.returnType === undefined) {
          const isRelated = hypothesis.relatedLocations.some(
            (loc) =>
              loc.file === func.location.file &&
              Math.abs(loc.line - func.location.line) < 20
          );

          if (isRelated) {
            evidence.push({
              id: randomUUID(),
              type: 'static_analysis',
              description: `Function "${func.name}" has no return type annotation`,
              location: func.location,
              strength: 0.4,
              direction: 'supporting',
              source: this.source,
              hypothesisId: hypothesis.id,
              confidence: 0.5,
              details: {
                functionName: func.name,
                hasReturnType: false,
              },
              collectedAt: now,
            });
          }
        }
      }
    }

    return evidence;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse code structure from source.
 */
function parseCodeStructure(
  source: string,
  filePath: string,
  language: Language
): CodeStructure {
  const lines = source.split('\n');
  const structure: CodeStructure = {
    filePath,
    language,
    functions: [],
    variables: [],
    classes: [],
    imports: [],
    exports: [],
    controlFlow: [],
  };

  if (language === 'javascript' || language === 'typescript') {
    parseJavaScriptStructure(source, lines, structure);
  } else if (language === 'python') {
    parsePythonStructure(source, lines, structure);
  }

  return structure;
}

/**
 * Parse JavaScript/TypeScript code structure.
 */
function parseJavaScriptStructure(
  source: string,
  lines: string[],
  structure: CodeStructure
): void {
  // Parse functions
  const functionRegex =
    /(?:async\s+)?(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>|\w+\s*=>))/g;
  let match: RegExpExecArray | null;

  while ((match = functionRegex.exec(source)) !== null) {
    const name = match[1] ?? match[2] ?? 'anonymous';
    const lineNumber = getLineNumber(source, match.index);
    const isAsync = match[0].includes('async');

    structure.functions.push({
      name,
      parameters: [],
      location: { file: structure.filePath, line: lineNumber },
      isAsync,
      isGenerator: match[0].includes('function*'),
      complexity: calculateComplexity(
        getBlockContent(lines, lineNumber)
      ),
      calls: [],
    });
  }

  // Parse imports
  const importRegex =
    /import\s+(?:{([^}]+)}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = importRegex.exec(source)) !== null) {
    const names = match[1]
      ? match[1].split(',').map((s) => s.trim())
      : [match[2] ?? ''];
    const sourcePath = match[3] ?? '';
    const lineNumber = getLineNumber(source, match.index);

    structure.imports.push({
      source: sourcePath,
      names: names.filter(Boolean),
      isTypeOnly: match[0].includes('import type'),
      location: { file: structure.filePath, line: lineNumber },
    });
  }

  // Parse exports
  const exportRegex = /export\s+(?:{([^}]+)}|(?:default\s+)?(\w+))/g;
  while ((match = exportRegex.exec(source)) !== null) {
    const names = match[1]
      ? match[1].split(',').map((s) => s.trim())
      : [match[2] ?? 'default'];
    const lineNumber = getLineNumber(source, match.index);

    structure.exports.push({
      names: names.filter(Boolean),
      isReExport: match[0].includes('from'),
      location: { file: structure.filePath, line: lineNumber },
    });
  }

  // Parse control flow
  const controlFlowPatterns = [
    { regex: /\bif\s*\(/g, type: 'if' as const },
    { regex: /\bswitch\s*\(/g, type: 'switch' as const },
    { regex: /\b(?:for|while|do)\s*[({]/g, type: 'loop' as const },
    { regex: /\btry\s*{/g, type: 'try' as const },
    { regex: /\bthrow\s+/g, type: 'throw' as const },
    { regex: /\breturn\b/g, type: 'return' as const },
  ];

  for (const { regex, type } of controlFlowPatterns) {
    let cfMatch: RegExpExecArray | null;
    while ((cfMatch = regex.exec(source)) !== null) {
      const lineNumber = getLineNumber(source, cfMatch.index);
      structure.controlFlow.push({
        type,
        location: { file: structure.filePath, line: lineNumber },
        branches: type === 'if' || type === 'switch' ? 2 : 0,
        hasDefault: false,
        depth: calculateNestingDepth(lines, lineNumber),
      });
    }
  }

  // Parse variables
  const varRegex = /(?:const|let|var)\s+(\w+)/g;
  while ((match = varRegex.exec(source)) !== null) {
    const name = match[1] ?? '';
    const lineNumber = getLineNumber(source, match.index);
    const kind = match[0].startsWith('const')
      ? 'const'
      : match[0].startsWith('let')
        ? 'let'
        : 'var';

    // Simple check if variable is used elsewhere
    const usageRegex = new RegExp(`\\b${name}\\b`, 'g');
    const usageCount = (source.match(usageRegex) ?? []).length;

    structure.variables.push({
      name,
      kind: kind as 'const' | 'let' | 'var',
      location: { file: structure.filePath, line: lineNumber },
      isUsed: usageCount > 1,
      isModified: kind !== 'const' && source.includes(`${name} =`),
    });
  }
}

/**
 * Parse Python code structure.
 */
function parsePythonStructure(
  source: string,
  lines: string[],
  structure: CodeStructure
): void {
  // Parse functions
  const functionRegex = /^(\s*)(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/gm;
  let match: RegExpExecArray | null;

  while ((match = functionRegex.exec(source)) !== null) {
    const name = match[2] ?? '';
    const params = match[3] ?? '';
    const lineNumber = getLineNumber(source, match.index);
    const isAsync = match[0].includes('async');

    const parameters: ParameterDefinition[] = params
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const [paramName, paramType] = p.split(':').map((s) => s.trim());
        const [nameWithDefault, defaultVal] = (paramName ?? '').split('=').map((s) =>
          s.trim()
        );
        const param: ParameterDefinition = {
          name: nameWithDefault ?? '',
          isOptional: defaultVal !== undefined,
        };
        if (paramType !== undefined) {
          param.type = paramType;
        }
        if (defaultVal !== undefined) {
          param.defaultValue = defaultVal;
        }
        return param;
      });

    structure.functions.push({
      name,
      parameters,
      location: { file: structure.filePath, line: lineNumber },
      isAsync,
      isGenerator: source.includes('yield'),
      complexity: calculateComplexity(getBlockContent(lines, lineNumber)),
      calls: [],
    });
  }

  // Parse imports
  const importRegex = /^(?:from\s+(\S+)\s+import\s+(.+)|import\s+(.+))$/gm;
  while ((match = importRegex.exec(source)) !== null) {
    const sourcePath = match[1] ?? match[3] ?? '';
    const names = (match[2] ?? match[3] ?? '')
      .split(',')
      .map((s) => s.trim().split(' as ')[0] ?? s.trim());
    const lineNumber = getLineNumber(source, match.index);

    structure.imports.push({
      source: sourcePath,
      names: names.filter(Boolean),
      isTypeOnly: false,
      location: { file: structure.filePath, line: lineNumber },
    });
  }

  // Parse classes
  const classRegex = /^(\s*)class\s+(\w+)(?:\s*\(([^)]*)\))?:/gm;
  while ((match = classRegex.exec(source)) !== null) {
    const name = match[2] ?? '';
    const parents = match[3] ?? '';
    const lineNumber = getLineNumber(source, match.index);

    const classDef: ClassDefinition = {
      name,
      implements: [],
      methods: [],
      properties: [],
      location: { file: structure.filePath, line: lineNumber },
    };
    const parentClass = parents.split(',')[0]?.trim();
    if (parentClass !== undefined && parentClass !== '') {
      classDef.extends = parentClass;
    }
    structure.classes.push(classDef);
  }
}

/**
 * Get line number from character index.
 */
function getLineNumber(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

/**
 * Get block content starting from a line.
 */
function getBlockContent(lines: string[], startLine: number): string {
  const endLine = Math.min(startLine + 50, lines.length);
  return lines.slice(startLine - 1, endLine).join('\n');
}

/**
 * Calculate cyclomatic complexity of a code block.
 */
function calculateComplexity(code: string): number {
  let complexity = 1;

  // Count decision points
  const patterns = [
    /\bif\b/g,
    /\belse\s+if\b/g,
    /\bfor\b/g,
    /\bwhile\b/g,
    /\bcase\b/g,
    /\bcatch\b/g,
    /\?\s*[^:]+:/g, // ternary
    /&&/g,
    /\|\|/g,
  ];

  for (const pattern of patterns) {
    const matches = code.match(pattern);
    if (matches !== null) {
      complexity += matches.length;
    }
  }

  return complexity;
}

/**
 * Calculate nesting depth at a line.
 */
function calculateNestingDepth(lines: string[], lineNumber: number): number {
  let depth = 0;
  let maxDepth = 0;

  for (let i = 0; i < lineNumber && i < lines.length; i++) {
    const line = lines[i] ?? '';
    depth += (line.match(/{/g) ?? []).length;
    depth -= (line.match(/}/g) ?? []).length;
    maxDepth = Math.max(maxDepth, depth);
  }

  return maxDepth;
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an evidence collector with default configuration.
 */
export function createEvidenceCollector(
  config?: EvidenceCollectorConfig
): EvidenceCollector {
  return new EvidenceCollector(config);
}

/**
 * Convenience function to collect evidence for a hypothesis.
 */
export function collectEvidence(
  hypothesis: RootCauseHypothesis,
  context: EvidenceContext,
  config?: EvidenceCollectorConfig
): EvidenceCollectionResult {
  const collector = createEvidenceCollector(config);
  return collector.collectEvidence(hypothesis, context);
}

/**
 * Convenience function to collect evidence for multiple hypotheses.
 */
export function collectBatchEvidence(
  hypotheses: RootCauseHypothesis[],
  context: EvidenceContext,
  config?: EvidenceCollectorConfig
): BatchEvidenceResult {
  const collector = createEvidenceCollector(config);
  return collector.collectBatchEvidence(hypotheses, context);
}
