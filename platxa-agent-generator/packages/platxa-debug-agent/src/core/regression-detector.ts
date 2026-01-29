/**
 * Regression Detector
 *
 * Detects regressions by comparing program behavior before and after fixes.
 * Ensures fixes don't break previously working functionality.
 *
 * @module regression-detector
 */

import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import type { Language, FixSuggestion } from './types.js';
import { TestRunner, type TestSuiteResult, type TestResult, type TestExecutionOptions } from './test-runner.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Behavioral snapshot of program state
 */
export interface BehaviorSnapshot {
  /** Unique snapshot ID */
  id: string;
  /** Timestamp when snapshot was taken */
  timestamp: Date;
  /** Test results at snapshot time */
  testResults: TestSuiteResult;
  /** Output hashes for deterministic comparison */
  outputHashes: Map<string, string>;
  /** File checksums for affected files */
  fileChecksums: Map<string, string>;
  /** Captured console/log output */
  capturedOutput?: string;
  /** Memory/performance metrics */
  metrics?: BehaviorMetrics;
}

/**
 * Performance and resource metrics
 */
export interface BehaviorMetrics {
  /** Total execution time in ms */
  executionTimeMs: number;
  /** Peak memory usage in bytes */
  peakMemoryBytes?: number;
  /** Number of function calls (if instrumented) */
  functionCalls?: number;
  /** Number of I/O operations */
  ioOperations?: number;
}

/**
 * Detected regression
 */
export interface Regression {
  /** Regression ID */
  id: string;
  /** Type of regression */
  type: 'test_failure' | 'output_change' | 'performance' | 'behavior_change';
  /** Severity level */
  severity: 'critical' | 'major' | 'minor';
  /** Description of the regression */
  description: string;
  /** Affected test or component */
  affected: string;
  /** Before state */
  before: string;
  /** After state */
  after: string;
  /** Suggested action */
  suggestion?: string;
}

/**
 * Regression detection result
 */
export interface RegressionResult {
  /** Unique result ID */
  id: string;
  /** Fix being analyzed */
  fixId: string;
  /** Whether any regressions were detected */
  hasRegressions: boolean;
  /** List of detected regressions */
  regressions: Regression[];
  /** Before snapshot */
  beforeSnapshot: BehaviorSnapshot;
  /** After snapshot */
  afterSnapshot: BehaviorSnapshot;
  /** Tests that were fixed */
  fixedTests: TestResult[];
  /** Tests that regressed */
  regressedTests: TestResult[];
  /** New tests that appeared */
  newTests: TestResult[];
  /** Tests that disappeared */
  removedTests: TestResult[];
  /** Summary message */
  summary: string;
  /** Total analysis time in ms */
  durationMs: number;
}

/**
 * Regression detector configuration
 */
export interface RegressionDetectorConfig {
  /** Test runner instance */
  testRunner?: TestRunner;
  /** Performance regression threshold (percentage) */
  performanceThreshold?: number;
  /** Whether to capture output hashes */
  captureOutputHashes?: boolean;
  /** Whether to compute file checksums */
  computeFileChecksums?: boolean;
  /** Files to monitor for changes */
  monitoredFiles?: string[];
  /** Timeout for each snapshot in ms */
  snapshotTimeout?: number;
}

/**
 * Options for regression detection
 */
export interface RegressionDetectionOptions {
  /** Working directory */
  workingDir?: string;
  /** Test execution options */
  testOptions?: TestExecutionOptions;
  /** Files affected by the fix */
  affectedFiles?: string[];
  /** Skip performance comparison */
  skipPerformance?: boolean;
  /** Skip output hash comparison */
  skipOutputHash?: boolean;
}

// =============================================================================
// Regression Detector Implementation
// =============================================================================

/**
 * Detects regressions by comparing behavior before and after fixes.
 */
export class RegressionDetector {
  private readonly config: Required<RegressionDetectorConfig>;
  private readonly testRunner: TestRunner;

  constructor(config: Partial<RegressionDetectorConfig> = {}) {
    this.testRunner = config.testRunner ?? new TestRunner();
    this.config = {
      testRunner: this.testRunner,
      performanceThreshold: config.performanceThreshold ?? 20, // 20% degradation threshold
      captureOutputHashes: config.captureOutputHashes ?? true,
      computeFileChecksums: config.computeFileChecksums ?? true,
      monitoredFiles: config.monitoredFiles ?? [],
      snapshotTimeout: config.snapshotTimeout ?? 120000,
    };
  }

  /**
   * Detect regressions for a fix.
   */
  async detectRegressions(
    fix: FixSuggestion,
    language: Language,
    applyFix: () => Promise<void>,
    revertFix: () => Promise<void>,
    options: RegressionDetectionOptions = {}
  ): Promise<RegressionResult> {
    const startTime = Date.now();
    const resultId = randomUUID();

    // Take before snapshot
    const beforeSnapshot = await this.captureSnapshot(language, options);

    // Apply fix
    await applyFix();

    // Take after snapshot
    const afterSnapshot = await this.captureSnapshot(language, options);

    // Analyze differences
    const regressions = this.analyzeRegressions(
      beforeSnapshot,
      afterSnapshot,
      options
    );

    // Categorize test changes
    const { fixedTests, regressedTests, newTests, removedTests } = this.categorizeTestChanges(
      beforeSnapshot.testResults,
      afterSnapshot.testResults
    );

    // If critical regressions, revert
    const hasCriticalRegression = regressions.some(r => r.severity === 'critical');
    if (hasCriticalRegression) {
      await revertFix();
    }

    const result: RegressionResult = {
      id: resultId,
      fixId: fix.id,
      hasRegressions: regressions.length > 0,
      regressions,
      beforeSnapshot,
      afterSnapshot,
      fixedTests,
      regressedTests,
      newTests,
      removedTests,
      summary: this.buildSummary(regressions, fixedTests, regressedTests),
      durationMs: Date.now() - startTime,
    };

    return result;
  }

  /**
   * Quick regression check using only test results.
   */
  async quickCheck(
    language: Language,
    applyFix: () => Promise<void>,
    revertFix: () => Promise<void>,
    options: RegressionDetectionOptions = {}
  ): Promise<{
    hasRegressions: boolean;
    regressedTests: TestResult[];
    fixedTests: TestResult[];
  }> {
    const testOptions = options.testOptions ?? {};

    // Run tests before
    const beforeResults = await this.testRunner.runTests(language, testOptions);

    // Apply fix
    await applyFix();

    // Run tests after
    const afterResults = await this.testRunner.runTests(language, testOptions);

    // Find regressions
    const { fixedTests, regressedTests } = this.categorizeTestChanges(
      beforeResults,
      afterResults
    );

    // Revert if regressions found
    if (regressedTests.length > 0) {
      await revertFix();
    }

    return {
      hasRegressions: regressedTests.length > 0,
      regressedTests,
      fixedTests,
    };
  }

  /**
   * Compare two snapshots for behavioral differences.
   */
  compareSnapshots(
    before: BehaviorSnapshot,
    after: BehaviorSnapshot
  ): Regression[] {
    return this.analyzeRegressions(before, after, {});
  }

  /**
   * Capture a behavioral snapshot.
   */
  async captureSnapshot(
    language: Language,
    options: RegressionDetectionOptions = {}
  ): Promise<BehaviorSnapshot> {
    const snapshotId = randomUUID();
    const testOptions: TestExecutionOptions = {
      ...options.testOptions,
      timeout: this.config.snapshotTimeout,
    };

    if (options.workingDir !== undefined) {
      testOptions.workingDir = options.workingDir;
    }

    // Run tests
    const testResults = await this.testRunner.runTests(language, testOptions);

    // Compute file checksums
    const fileChecksums = new Map<string, string>();
    if (this.config.computeFileChecksums) {
      const filesToCheck = [
        ...this.config.monitoredFiles,
        ...(options.affectedFiles ?? []),
      ];

      for (const file of filesToCheck) {
        try {
          const checksum = await this.computeFileChecksum(file);
          fileChecksums.set(file, checksum);
        } catch {
          // File doesn't exist or can't be read
        }
      }
    }

    // Compute output hashes
    const outputHashes = new Map<string, string>();
    if (this.config.captureOutputHashes) {
      // Hash test output for comparison
      outputHashes.set('test_output', this.hashString(testResults.rawOutput));
    }

    const snapshot: BehaviorSnapshot = {
      id: snapshotId,
      timestamp: new Date(),
      testResults,
      outputHashes,
      fileChecksums,
    };

    // Add metrics if available
    if (testResults.durationMs > 0) {
      snapshot.metrics = {
        executionTimeMs: testResults.durationMs,
      };
    }

    return snapshot;
  }

  // ===========================================================================
  // Analysis
  // ===========================================================================

  /**
   * Analyze regressions between snapshots.
   */
  private analyzeRegressions(
    before: BehaviorSnapshot,
    after: BehaviorSnapshot,
    options: RegressionDetectionOptions
  ): Regression[] {
    const regressions: Regression[] = [];

    // Test regressions
    const testRegressions = this.findTestRegressions(
      before.testResults,
      after.testResults
    );
    regressions.push(...testRegressions);

    // Output hash changes (if enabled)
    if (!options.skipOutputHash && this.config.captureOutputHashes) {
      const outputRegressions = this.findOutputRegressions(
        before.outputHashes,
        after.outputHashes
      );
      regressions.push(...outputRegressions);
    }

    // Performance regressions (if enabled)
    if (!options.skipPerformance && before.metrics !== undefined && after.metrics !== undefined) {
      const perfRegressions = this.findPerformanceRegressions(
        before.metrics,
        after.metrics
      );
      regressions.push(...perfRegressions);
    }

    // File checksum changes
    if (this.config.computeFileChecksums) {
      const fileRegressions = this.findFileRegressions(
        before.fileChecksums,
        after.fileChecksums
      );
      regressions.push(...fileRegressions);
    }

    return regressions;
  }

  /**
   * Find test-related regressions.
   */
  private findTestRegressions(
    before: TestSuiteResult,
    after: TestSuiteResult
  ): Regression[] {
    const regressions: Regression[] = [];

    const beforeMap = new Map(before.tests.map(t => [t.name, t]));
    const afterMap = new Map(after.tests.map(t => [t.name, t]));

    for (const [name, afterTest] of afterMap) {
      const beforeTest = beforeMap.get(name);

      if (beforeTest !== undefined) {
        // Test existed before - check for regression
        if (beforeTest.status === 'passed' && afterTest.status === 'failed') {
          regressions.push({
            id: randomUUID(),
            type: 'test_failure',
            severity: 'critical',
            description: `Test "${name}" was passing but now fails`,
            affected: name,
            before: 'passed',
            after: 'failed',
            suggestion: afterTest.errorMessage !== undefined
              ? `Error: ${afterTest.errorMessage.slice(0, 200)}`
              : 'Review the test failure and fix the regression',
          });
        }
      }
    }

    return regressions;
  }

  /**
   * Find output-related regressions.
   */
  private findOutputRegressions(
    before: Map<string, string>,
    after: Map<string, string>
  ): Regression[] {
    const regressions: Regression[] = [];

    for (const [key, beforeHash] of before) {
      const afterHash = after.get(key);

      if (afterHash !== undefined && beforeHash !== afterHash) {
        regressions.push({
          id: randomUUID(),
          type: 'output_change',
          severity: 'minor',
          description: `Output "${key}" has changed`,
          affected: key,
          before: beforeHash.slice(0, 8),
          after: afterHash.slice(0, 8),
          suggestion: 'Verify the output change is expected',
        });
      }
    }

    return regressions;
  }

  /**
   * Find performance regressions.
   */
  private findPerformanceRegressions(
    before: BehaviorMetrics,
    after: BehaviorMetrics
  ): Regression[] {
    const regressions: Regression[] = [];

    // Check execution time
    if (before.executionTimeMs > 0 && after.executionTimeMs > 0) {
      const percentageIncrease =
        ((after.executionTimeMs - before.executionTimeMs) / before.executionTimeMs) * 100;

      if (percentageIncrease > this.config.performanceThreshold) {
        regressions.push({
          id: randomUUID(),
          type: 'performance',
          severity: percentageIncrease > 50 ? 'major' : 'minor',
          description: `Execution time increased by ${percentageIncrease.toFixed(1)}%`,
          affected: 'execution_time',
          before: `${before.executionTimeMs}ms`,
          after: `${after.executionTimeMs}ms`,
          suggestion: 'Review the fix for performance implications',
        });
      }
    }

    // Check memory usage
    if (before.peakMemoryBytes !== undefined && after.peakMemoryBytes !== undefined) {
      const memoryIncrease =
        ((after.peakMemoryBytes - before.peakMemoryBytes) / before.peakMemoryBytes) * 100;

      if (memoryIncrease > this.config.performanceThreshold) {
        regressions.push({
          id: randomUUID(),
          type: 'performance',
          severity: memoryIncrease > 50 ? 'major' : 'minor',
          description: `Memory usage increased by ${memoryIncrease.toFixed(1)}%`,
          affected: 'memory_usage',
          before: this.formatBytes(before.peakMemoryBytes),
          after: this.formatBytes(after.peakMemoryBytes),
          suggestion: 'Check for memory leaks or inefficient allocations',
        });
      }
    }

    return regressions;
  }

  /**
   * Find file-related regressions.
   */
  private findFileRegressions(
    before: Map<string, string>,
    after: Map<string, string>
  ): Regression[] {
    const regressions: Regression[] = [];

    // Check for unexpected file changes
    for (const [file, beforeChecksum] of before) {
      const afterChecksum = after.get(file);

      if (afterChecksum === undefined) {
        regressions.push({
          id: randomUUID(),
          type: 'behavior_change',
          severity: 'major',
          description: `File "${file}" was deleted`,
          affected: file,
          before: 'exists',
          after: 'deleted',
          suggestion: 'Verify file deletion is intentional',
        });
      } else if (beforeChecksum !== afterChecksum) {
        // This is expected for fix changes, only flag if unexpected
        // We track but don't report as regression by default
      }
    }

    // Check for new files
    for (const [file] of after) {
      if (!before.has(file)) {
        // New file created - informational, not a regression
      }
    }

    return regressions;
  }

  /**
   * Categorize test changes between before and after.
   */
  private categorizeTestChanges(
    before: TestSuiteResult,
    after: TestSuiteResult
  ): {
    fixedTests: TestResult[];
    regressedTests: TestResult[];
    newTests: TestResult[];
    removedTests: TestResult[];
  } {
    const fixedTests: TestResult[] = [];
    const regressedTests: TestResult[] = [];
    const newTests: TestResult[] = [];
    const removedTests: TestResult[] = [];

    const beforeMap = new Map(before.tests.map(t => [t.name, t]));
    const afterMap = new Map(after.tests.map(t => [t.name, t]));

    // Find fixed and regressed tests
    for (const [name, afterTest] of afterMap) {
      const beforeTest = beforeMap.get(name);

      if (beforeTest === undefined) {
        newTests.push(afterTest);
      } else if (beforeTest.status === 'failed' && afterTest.status === 'passed') {
        fixedTests.push(afterTest);
      } else if (beforeTest.status === 'passed' && afterTest.status === 'failed') {
        regressedTests.push(afterTest);
      }
    }

    // Find removed tests
    for (const [name, beforeTest] of beforeMap) {
      if (!afterMap.has(name)) {
        removedTests.push(beforeTest);
      }
    }

    return { fixedTests, regressedTests, newTests, removedTests };
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Compute SHA-256 checksum of a file.
   */
  private async computeFileChecksum(filepath: string): Promise<string> {
    const content = await fs.readFile(filepath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Hash a string using SHA-256.
   */
  private hashString(str: string): string {
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  /**
   * Format bytes to human-readable string.
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  /**
   * Build summary message from regression analysis.
   */
  private buildSummary(
    regressions: Regression[],
    fixedTests: TestResult[],
    regressedTests: TestResult[]
  ): string {
    const parts: string[] = [];

    if (fixedTests.length > 0) {
      parts.push(`${fixedTests.length} test(s) fixed`);
    }

    if (regressedTests.length > 0) {
      parts.push(`${regressedTests.length} test(s) regressed`);
    }

    const critical = regressions.filter(r => r.severity === 'critical').length;
    const major = regressions.filter(r => r.severity === 'major').length;
    const minor = regressions.filter(r => r.severity === 'minor').length;

    if (critical > 0) {
      parts.push(`${critical} critical regression(s)`);
    }
    if (major > 0) {
      parts.push(`${major} major regression(s)`);
    }
    if (minor > 0) {
      parts.push(`${minor} minor regression(s)`);
    }

    if (parts.length === 0) {
      return 'No regressions detected';
    }

    return parts.join(', ');
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a regression detector with default configuration.
 */
export function createRegressionDetector(
  config?: Partial<RegressionDetectorConfig>
): RegressionDetector {
  return new RegressionDetector(config);
}
