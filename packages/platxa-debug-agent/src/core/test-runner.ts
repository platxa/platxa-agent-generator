/**
 * Test Runner
 *
 * Executes test suites to verify fixes. Supports pytest for Python
 * and Jest/Vitest/Mocha for JavaScript/TypeScript.
 *
 * @module test-runner
 */

import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Language } from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Individual test result
 */
export interface TestResult {
  /** Test name/identifier */
  name: string;
  /** Test file path */
  file: string;
  /** Test status */
  status: 'passed' | 'failed' | 'skipped' | 'error';
  /** Duration in milliseconds */
  durationMs: number;
  /** Error message if failed */
  errorMessage?: string;
  /** Stack trace if failed */
  stackTrace?: string;
  /** Line number of test */
  line?: number;
}

/**
 * Test suite execution result
 */
export interface TestSuiteResult {
  /** Unique run ID */
  id: string;
  /** Test framework used */
  framework: 'pytest' | 'jest' | 'vitest' | 'mocha' | 'unknown';
  /** Overall status */
  status: 'passed' | 'failed' | 'error';
  /** Total tests */
  total: number;
  /** Passed tests */
  passed: number;
  /** Failed tests */
  failed: number;
  /** Skipped tests */
  skipped: number;
  /** Individual test results */
  tests: TestResult[];
  /** Total duration in milliseconds */
  durationMs: number;
  /** Raw output from test runner */
  rawOutput: string;
  /** Exit code */
  exitCode: number;
  /** Error message if execution failed */
  errorMessage?: string;
}

/**
 * Test execution options
 */
export interface TestExecutionOptions {
  /** Working directory */
  workingDir?: string;
  /** Specific test file to run */
  testFile?: string;
  /** Specific test name pattern */
  testPattern?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Environment variables */
  env?: Record<string, string>;
  /** Additional arguments for test runner */
  extraArgs?: string[];
  /** Collect coverage */
  coverage?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Test runner configuration
 */
export interface TestRunnerConfig {
  /** Path to pytest executable */
  pytestPath?: string;
  /** Path to Jest executable */
  jestPath?: string;
  /** Path to Vitest executable */
  vitestPath?: string;
  /** Path to Mocha executable */
  mochaPath?: string;
  /** Path to npm/pnpm/yarn */
  npmPath?: string;
  /** Default timeout in milliseconds */
  defaultTimeout?: number;
  /** Preferred JS test framework */
  preferredJsFramework?: 'jest' | 'vitest' | 'mocha';
}

// =============================================================================
// Test Runner Implementation
// =============================================================================

/**
 * Executes test suites to verify fixes.
 */
export class TestRunner {
  private readonly config: Required<TestRunnerConfig>;

  constructor(config: Partial<TestRunnerConfig> = {}) {
    this.config = {
      pytestPath: config.pytestPath ?? 'pytest',
      jestPath: config.jestPath ?? 'npx jest',
      vitestPath: config.vitestPath ?? 'npx vitest',
      mochaPath: config.mochaPath ?? 'npx mocha',
      npmPath: config.npmPath ?? 'npm',
      defaultTimeout: config.defaultTimeout ?? 120000, // 2 minutes
      preferredJsFramework: config.preferredJsFramework ?? 'jest',
    };
  }

  /**
   * Run tests for the given language.
   */
  async runTests(
    language: Language,
    options: TestExecutionOptions = {}
  ): Promise<TestSuiteResult> {
    switch (language) {
      case 'python':
        return this.runPytest(options);

      case 'javascript':
      case 'typescript':
        return this.runJsTests(options);

      default:
        return {
          id: randomUUID(),
          framework: 'unknown',
          status: 'error',
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          tests: [],
          durationMs: 0,
          rawOutput: `No test runner available for language: ${language}`,
          exitCode: 1,
          errorMessage: `Unsupported language: ${language}`,
        };
    }
  }

  /**
   * Run tests before and after a fix to detect regressions.
   */
  async runBeforeAfter(
    language: Language,
    applyFix: () => Promise<void>,
    revertFix: () => Promise<void>,
    options: TestExecutionOptions = {}
  ): Promise<{
    before: TestSuiteResult;
    after: TestSuiteResult;
    regressions: TestResult[];
    fixed: TestResult[];
  }> {
    // Run tests before fix
    const before = await this.runTests(language, options);

    // Apply fix
    await applyFix();

    // Run tests after fix
    const after = await this.runTests(language, options);

    // Detect regressions (tests that passed before but fail after)
    const regressions: TestResult[] = [];
    const fixed: TestResult[] = [];

    const beforeMap = new Map(before.tests.map(t => [t.name, t]));
    const afterMap = new Map(after.tests.map(t => [t.name, t]));

    for (const [name, afterTest] of afterMap) {
      const beforeTest = beforeMap.get(name);

      if (beforeTest !== undefined) {
        // Test existed before
        if (beforeTest.status === 'passed' && afterTest.status === 'failed') {
          regressions.push(afterTest);
        } else if (beforeTest.status === 'failed' && afterTest.status === 'passed') {
          fixed.push(afterTest);
        }
      }
    }

    // Revert if there are regressions
    if (regressions.length > 0) {
      await revertFix();
    }

    return { before, after, regressions, fixed };
  }

  /**
   * Check if a test framework is available.
   */
  async isFrameworkAvailable(
    framework: 'pytest' | 'jest' | 'vitest' | 'mocha'
  ): Promise<boolean> {
    try {
      switch (framework) {
        case 'pytest':
          await this.runCommand(this.config.pytestPath, ['--version'], {
            timeout: 5000,
          });
          return true;

        case 'jest':
          await this.runCommand('npx', ['jest', '--version'], { timeout: 10000 });
          return true;

        case 'vitest':
          await this.runCommand('npx', ['vitest', '--version'], { timeout: 10000 });
          return true;

        case 'mocha':
          await this.runCommand('npx', ['mocha', '--version'], { timeout: 10000 });
          return true;

        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Detect available test framework in a directory.
   */
  async detectFramework(workingDir: string): Promise<'pytest' | 'jest' | 'vitest' | 'mocha' | null> {
    try {
      // Check for Python test files
      const hasPytest = await this.fileExists(path.join(workingDir, 'pytest.ini')) ||
        await this.fileExists(path.join(workingDir, 'pyproject.toml')) ||
        await this.hasTestFiles(workingDir, 'test_*.py');

      if (hasPytest) {
        return 'pytest';
      }

      // Check package.json for JS test frameworks
      const packageJsonPath = path.join(workingDir, 'package.json');
      if (await this.fileExists(packageJsonPath)) {
        const content = await fs.readFile(packageJsonPath, 'utf-8');
        const pkg = JSON.parse(content) as {
          devDependencies?: Record<string, string>;
          dependencies?: Record<string, string>;
        };

        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        if ('vitest' in deps) return 'vitest';
        if ('jest' in deps) return 'jest';
        if ('mocha' in deps) return 'mocha';
      }

      return null;
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // Python (pytest)
  // ===========================================================================

  /**
   * Run pytest for Python tests.
   */
  private async runPytest(options: TestExecutionOptions): Promise<TestSuiteResult> {
    const startTime = Date.now();
    const runId = randomUUID();

    const args: string[] = ['--tb=short', '-q', '--json-report', '--json-report-file=-'];

    if (options.testFile !== undefined) {
      args.push(options.testFile);
    }

    if (options.testPattern !== undefined) {
      args.push('-k', options.testPattern);
    }

    if (options.coverage) {
      args.push('--cov');
    }

    if (options.verbose) {
      args.push('-v');
    }

    if (options.extraArgs !== undefined) {
      args.push(...options.extraArgs);
    }

    try {
      const cmdOptions = this.buildCommandOptions(options);
      const result = await this.runCommand(this.config.pytestPath, args, cmdOptions);

      // Try to parse JSON report
      const tests: TestResult[] = [];
      let total = 0;
      let passed = 0;
      let failed = 0;
      let skipped = 0;

      try {
        // pytest-json-report outputs JSON
        const jsonMatch = result.stdout.match(/\{[\s\S]*"tests"[\s\S]*\}/);
        if (jsonMatch !== null) {
          const report = JSON.parse(jsonMatch[0]) as {
            tests?: Array<{
              nodeid: string;
              outcome: string;
              duration: number;
              call?: {
                longrepr?: string;
              };
              lineno?: number;
            }>;
            summary?: {
              total?: number;
              passed?: number;
              failed?: number;
              skipped?: number;
            };
          };

          for (const test of report.tests ?? []) {
            const testResult: TestResult = {
              name: test.nodeid,
              file: test.nodeid.split('::')[0] ?? '',
              status: this.mapPytestOutcome(test.outcome),
              durationMs: test.duration * 1000,
            };

            if (test.lineno !== undefined) {
              testResult.line = test.lineno;
            }

            if (test.call?.longrepr !== undefined) {
              testResult.errorMessage = test.call.longrepr;
            }

            tests.push(testResult);
          }

          total = report.summary?.total ?? tests.length;
          passed = report.summary?.passed ?? tests.filter(t => t.status === 'passed').length;
          failed = report.summary?.failed ?? tests.filter(t => t.status === 'failed').length;
          skipped = report.summary?.skipped ?? tests.filter(t => t.status === 'skipped').length;
        } else {
          // Fallback: parse text output
          const parsed = this.parsePytestTextOutput(result.stdout + result.stderr);
          tests.push(...parsed.tests);
          total = parsed.total;
          passed = parsed.passed;
          failed = parsed.failed;
          skipped = parsed.skipped;
        }
      } catch {
        // Fallback to text parsing
        const parsed = this.parsePytestTextOutput(result.stdout + result.stderr);
        tests.push(...parsed.tests);
        total = parsed.total;
        passed = parsed.passed;
        failed = parsed.failed;
        skipped = parsed.skipped;
      }

      return {
        id: runId,
        framework: 'pytest',
        status: failed > 0 ? 'failed' : 'passed',
        total,
        passed,
        failed,
        skipped,
        tests,
        durationMs: Date.now() - startTime,
        rawOutput: result.stdout + result.stderr,
        exitCode: result.exitCode,
      };
    } catch (error) {
      return {
        id: runId,
        framework: 'pytest',
        status: 'error',
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        tests: [],
        durationMs: Date.now() - startTime,
        rawOutput: '',
        exitCode: 1,
        errorMessage: error instanceof Error ? error.message : 'pytest execution failed',
      };
    }
  }

  /**
   * Map pytest outcome to TestResult status.
   */
  private mapPytestOutcome(outcome: string): TestResult['status'] {
    switch (outcome) {
      case 'passed':
        return 'passed';
      case 'failed':
        return 'failed';
      case 'skipped':
        return 'skipped';
      default:
        return 'error';
    }
  }

  /**
   * Parse pytest text output.
   */
  private parsePytestTextOutput(output: string): {
    tests: TestResult[];
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  } {
    const tests: TestResult[] = [];
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    // Parse summary line: "5 passed, 2 failed, 1 skipped in 1.23s"
    const summaryMatch = output.match(/(\d+)\s+passed(?:,\s+(\d+)\s+failed)?(?:,\s+(\d+)\s+skipped)?/);
    if (summaryMatch !== null) {
      passed = parseInt(summaryMatch[1] ?? '0', 10);
      failed = parseInt(summaryMatch[2] ?? '0', 10);
      skipped = parseInt(summaryMatch[3] ?? '0', 10);
    }

    // Parse individual test lines: "test_file.py::test_name PASSED"
    const testPattern = /^([\w/.]+\.py)::(\S+)\s+(PASSED|FAILED|SKIPPED|ERROR)/gm;
    let match;

    while ((match = testPattern.exec(output)) !== null) {
      const [, file, name, status] = match;
      if (file !== undefined && name !== undefined && status !== undefined) {
        tests.push({
          name: `${file}::${name}`,
          file,
          status: status.toLowerCase() as TestResult['status'],
          durationMs: 0,
        });
      }
    }

    return {
      tests,
      total: passed + failed + skipped,
      passed,
      failed,
      skipped,
    };
  }

  // ===========================================================================
  // JavaScript/TypeScript (Jest/Vitest/Mocha)
  // ===========================================================================

  /**
   * Run JavaScript/TypeScript tests.
   */
  private async runJsTests(options: TestExecutionOptions): Promise<TestSuiteResult> {
    // Detect framework
    const workingDir = options.workingDir ?? process.cwd();
    const framework = await this.detectFramework(workingDir) ?? this.config.preferredJsFramework;

    switch (framework) {
      case 'jest':
        return this.runJest(options);
      case 'vitest':
        return this.runVitest(options);
      case 'mocha':
        return this.runMocha(options);
      default:
        return this.runJest(options);
    }
  }

  /**
   * Run Jest tests.
   */
  private async runJest(options: TestExecutionOptions): Promise<TestSuiteResult> {
    const startTime = Date.now();
    const runId = randomUUID();

    const args: string[] = ['jest', '--json', '--testLocationInResults'];

    if (options.testFile !== undefined) {
      args.push(options.testFile);
    }

    if (options.testPattern !== undefined) {
      args.push('-t', options.testPattern);
    }

    if (options.coverage) {
      args.push('--coverage');
    }

    if (options.verbose) {
      args.push('--verbose');
    }

    if (options.extraArgs !== undefined) {
      args.push(...options.extraArgs);
    }

    try {
      const cmdOptions = this.buildCommandOptions(options);
      const result = await this.runCommand('npx', args, cmdOptions);

      // Parse Jest JSON output
      const tests: TestResult[] = [];
      let total = 0;
      let passed = 0;
      let failed = 0;
      let skipped = 0;

      try {
        const report = JSON.parse(result.stdout) as {
          testResults?: Array<{
            name: string;
            assertionResults?: Array<{
              title: string;
              status: string;
              duration: number | null;
              failureMessages?: string[];
              location?: { line: number };
            }>;
          }>;
          numTotalTests?: number;
          numPassedTests?: number;
          numFailedTests?: number;
          numPendingTests?: number;
        };

        for (const suite of report.testResults ?? []) {
          for (const test of suite.assertionResults ?? []) {
            const testResult: TestResult = {
              name: test.title,
              file: suite.name,
              status: this.mapJestStatus(test.status),
              durationMs: test.duration ?? 0,
            };

            if (test.location?.line !== undefined) {
              testResult.line = test.location.line;
            }

            if (test.failureMessages !== undefined && test.failureMessages.length > 0) {
              testResult.errorMessage = test.failureMessages.join('\n');
            }

            tests.push(testResult);
          }
        }

        total = report.numTotalTests ?? tests.length;
        passed = report.numPassedTests ?? tests.filter(t => t.status === 'passed').length;
        failed = report.numFailedTests ?? tests.filter(t => t.status === 'failed').length;
        skipped = report.numPendingTests ?? tests.filter(t => t.status === 'skipped').length;
      } catch {
        // Fallback to summary extraction
        const parsed = this.parseJestTextOutput(result.stdout + result.stderr);
        total = parsed.total;
        passed = parsed.passed;
        failed = parsed.failed;
        skipped = parsed.skipped;
      }

      return {
        id: runId,
        framework: 'jest',
        status: failed > 0 ? 'failed' : 'passed',
        total,
        passed,
        failed,
        skipped,
        tests,
        durationMs: Date.now() - startTime,
        rawOutput: result.stdout + result.stderr,
        exitCode: result.exitCode,
      };
    } catch (error) {
      return {
        id: runId,
        framework: 'jest',
        status: 'error',
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        tests: [],
        durationMs: Date.now() - startTime,
        rawOutput: '',
        exitCode: 1,
        errorMessage: error instanceof Error ? error.message : 'Jest execution failed',
      };
    }
  }

  /**
   * Run Vitest tests.
   */
  private async runVitest(options: TestExecutionOptions): Promise<TestSuiteResult> {
    const startTime = Date.now();
    const runId = randomUUID();

    const args: string[] = ['vitest', 'run', '--reporter=json'];

    if (options.testFile !== undefined) {
      args.push(options.testFile);
    }

    if (options.testPattern !== undefined) {
      args.push('-t', options.testPattern);
    }

    if (options.coverage) {
      args.push('--coverage');
    }

    if (options.extraArgs !== undefined) {
      args.push(...options.extraArgs);
    }

    try {
      const cmdOptions = this.buildCommandOptions(options);
      const result = await this.runCommand('npx', args, cmdOptions);

      // Parse Vitest JSON output (similar to Jest)
      const tests: TestResult[] = [];
      let total = 0;
      let passed = 0;
      let failed = 0;
      let skipped = 0;

      try {
        const report = JSON.parse(result.stdout) as {
          testResults?: Array<{
            name: string;
            assertionResults?: Array<{
              title: string;
              status: string;
              duration: number;
              failureMessages?: string[];
            }>;
          }>;
          numTotalTests?: number;
          numPassedTests?: number;
          numFailedTests?: number;
          numPendingTests?: number;
        };

        for (const suite of report.testResults ?? []) {
          for (const test of suite.assertionResults ?? []) {
            const testResult: TestResult = {
              name: test.title,
              file: suite.name,
              status: this.mapJestStatus(test.status),
              durationMs: test.duration,
            };

            const errorMsg = test.failureMessages?.join('\n');
            if (errorMsg !== undefined) {
              testResult.errorMessage = errorMsg;
            }

            tests.push(testResult);
          }
        }

        total = report.numTotalTests ?? tests.length;
        passed = report.numPassedTests ?? tests.filter(t => t.status === 'passed').length;
        failed = report.numFailedTests ?? tests.filter(t => t.status === 'failed').length;
        skipped = report.numPendingTests ?? tests.filter(t => t.status === 'skipped').length;
      } catch {
        // Minimal fallback
        const exitSuccess = result.exitCode === 0;
        total = exitSuccess ? 1 : 1;
        passed = exitSuccess ? 1 : 0;
        failed = exitSuccess ? 0 : 1;
      }

      return {
        id: runId,
        framework: 'vitest',
        status: failed > 0 ? 'failed' : 'passed',
        total,
        passed,
        failed,
        skipped,
        tests,
        durationMs: Date.now() - startTime,
        rawOutput: result.stdout + result.stderr,
        exitCode: result.exitCode,
      };
    } catch (error) {
      return {
        id: runId,
        framework: 'vitest',
        status: 'error',
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        tests: [],
        durationMs: Date.now() - startTime,
        rawOutput: '',
        exitCode: 1,
        errorMessage: error instanceof Error ? error.message : 'Vitest execution failed',
      };
    }
  }

  /**
   * Run Mocha tests.
   */
  private async runMocha(options: TestExecutionOptions): Promise<TestSuiteResult> {
    const startTime = Date.now();
    const runId = randomUUID();

    const args: string[] = ['mocha', '--reporter', 'json'];

    if (options.testFile !== undefined) {
      args.push(options.testFile);
    }

    if (options.testPattern !== undefined) {
      args.push('--grep', options.testPattern);
    }

    if (options.extraArgs !== undefined) {
      args.push(...options.extraArgs);
    }

    try {
      const cmdOptions = this.buildCommandOptions(options);
      const result = await this.runCommand('npx', args, cmdOptions);

      // Parse Mocha JSON output
      const tests: TestResult[] = [];
      let total = 0;
      let passed = 0;
      let failed = 0;
      let skipped = 0;

      try {
        const report = JSON.parse(result.stdout) as {
          tests?: Array<{
            title: string;
            file: string;
            state: string;
            duration: number;
            err?: {
              message?: string;
              stack?: string;
            };
          }>;
          stats?: {
            tests?: number;
            passes?: number;
            failures?: number;
            pending?: number;
          };
        };

        for (const test of report.tests ?? []) {
          const testResult: TestResult = {
            name: test.title,
            file: test.file,
            status: this.mapMochaState(test.state),
            durationMs: test.duration,
          };

          if (test.err?.message !== undefined) {
            testResult.errorMessage = test.err.message;
          }

          if (test.err?.stack !== undefined) {
            testResult.stackTrace = test.err.stack;
          }

          tests.push(testResult);
        }

        total = report.stats?.tests ?? tests.length;
        passed = report.stats?.passes ?? tests.filter(t => t.status === 'passed').length;
        failed = report.stats?.failures ?? tests.filter(t => t.status === 'failed').length;
        skipped = report.stats?.pending ?? tests.filter(t => t.status === 'skipped').length;
      } catch {
        // Minimal fallback
        const exitSuccess = result.exitCode === 0;
        total = 1;
        passed = exitSuccess ? 1 : 0;
        failed = exitSuccess ? 0 : 1;
      }

      return {
        id: runId,
        framework: 'mocha',
        status: failed > 0 ? 'failed' : 'passed',
        total,
        passed,
        failed,
        skipped,
        tests,
        durationMs: Date.now() - startTime,
        rawOutput: result.stdout + result.stderr,
        exitCode: result.exitCode,
      };
    } catch (error) {
      return {
        id: runId,
        framework: 'mocha',
        status: 'error',
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        tests: [],
        durationMs: Date.now() - startTime,
        rawOutput: '',
        exitCode: 1,
        errorMessage: error instanceof Error ? error.message : 'Mocha execution failed',
      };
    }
  }

  /**
   * Map Jest status to TestResult status.
   */
  private mapJestStatus(status: string): TestResult['status'] {
    switch (status) {
      case 'passed':
        return 'passed';
      case 'failed':
        return 'failed';
      case 'pending':
      case 'skipped':
      case 'todo':
        return 'skipped';
      default:
        return 'error';
    }
  }

  /**
   * Map Mocha state to TestResult status.
   */
  private mapMochaState(state: string): TestResult['status'] {
    switch (state) {
      case 'passed':
        return 'passed';
      case 'failed':
        return 'failed';
      case 'pending':
        return 'skipped';
      default:
        return 'error';
    }
  }

  /**
   * Parse Jest text output for summary.
   */
  private parseJestTextOutput(output: string): {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  } {
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    // Parse: "Tests: X passed, Y failed, Z skipped, N total"
    const testsMatch = output.match(/Tests:\s+(?:(\d+)\s+passed)?(?:,?\s*(\d+)\s+failed)?(?:,?\s*(\d+)\s+skipped)?/);
    if (testsMatch !== null) {
      passed = parseInt(testsMatch[1] ?? '0', 10);
      failed = parseInt(testsMatch[2] ?? '0', 10);
      skipped = parseInt(testsMatch[3] ?? '0', 10);
    }

    return {
      total: passed + failed + skipped,
      passed,
      failed,
      skipped,
    };
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Build command options from execution options.
   */
  private buildCommandOptions(
    options: TestExecutionOptions
  ): { timeout: number; cwd?: string; env?: Record<string, string> } {
    const cmdOptions: { timeout: number; cwd?: string; env?: Record<string, string> } = {
      timeout: options.timeout ?? this.config.defaultTimeout,
    };

    if (options.workingDir !== undefined) {
      cmdOptions.cwd = options.workingDir;
    }

    if (options.env !== undefined) {
      cmdOptions.env = options.env;
    }

    return cmdOptions;
  }

  /**
   * Check if a file exists.
   */
  private async fileExists(filepath: string): Promise<boolean> {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if directory has test files matching pattern.
   */
  private async hasTestFiles(dir: string, pattern: string): Promise<boolean> {
    try {
      const files = await fs.readdir(dir, { recursive: true });
      const regex = new RegExp(pattern.replace('*', '.*'));
      return files.some(f => regex.test(String(f)));
    } catch {
      return false;
    }
  }

  /**
   * Run a command and return its output.
   */
  private runCommand(
    command: string,
    args: string[],
    options: { timeout?: number; cwd?: string; env?: Record<string, string> }
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      const timeout = options.timeout ?? this.config.defaultTimeout;
      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);

      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 1,
        });
      });

      proc.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a test runner with default configuration.
 */
export function createTestRunner(config?: Partial<TestRunnerConfig>): TestRunner {
  return new TestRunner(config);
}
