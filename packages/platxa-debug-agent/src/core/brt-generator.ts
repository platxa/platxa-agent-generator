/**
 * Bug Reproduction Test (BRT) Generator
 *
 * LLM-based test generation from bug reports.
 * Based on LIBRO research for automated test case generation.
 *
 * Features #20-25: BRT Generator implementation
 *
 * @module brt-generator
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Bug Report
 *
 * Feature #20: Interface with id, title, description, stackTrace, reproduction steps
 */
export interface BugReport {
  /** Unique identifier for the bug report */
  id: string;
  /** Bug title/summary */
  title: string;
  /** Detailed bug description */
  description: string;
  /** Stack trace if available */
  stackTrace?: string;
  /** Steps to reproduce the bug */
  reproductionSteps: ReproductionStep[];
  /** Expected behavior */
  expectedBehavior?: string;
  /** Actual behavior observed */
  actualBehavior?: string;
  /** Affected component/module */
  component?: string;
  /** Bug severity */
  severity?: BugSeverity;
  /** Environment information */
  environment?: EnvironmentInfo;
  /** Related code snippets */
  codeSnippets?: CodeSnippet[];
  /** Bug creation timestamp */
  createdAt?: Date;
}

/**
 * Step to reproduce the bug
 */
export interface ReproductionStep {
  /** Step number */
  step: number;
  /** Step description */
  description: string;
  /** Input data for this step */
  input?: string;
  /** Expected output at this step */
  expectedOutput?: string;
  /** Code to execute (if applicable) */
  code?: string;
}

/**
 * Bug severity levels
 */
export type BugSeverity = 'critical' | 'high' | 'medium' | 'low' | 'trivial';

/**
 * Environment information
 */
export interface EnvironmentInfo {
  /** Operating system */
  os?: string;
  /** Programming language version */
  languageVersion?: string;
  /** Framework version */
  frameworkVersion?: string;
  /** Additional environment details */
  additional?: Record<string, string>;
}

/**
 * Code snippet related to bug
 */
export interface CodeSnippet {
  /** File path */
  file: string;
  /** Start line */
  startLine: number;
  /** End line */
  endLine: number;
  /** Code content */
  code: string;
  /** Language */
  language: string;
}

/**
 * Test plausibility classification
 */
export type TestPlausibility = 'plausible' | 'candidate' | 'invalid';

/**
 * Bug Reproduction Test
 *
 * Feature #21: Interface with testCode, bugReportId, failsOnBuggy, passesOnFixed, plausibility
 */
export interface BugReproductionTest {
  /** Generated test code */
  testCode: string;
  /** ID of the bug report this test is for */
  bugReportId: string;
  /** Whether the test fails on buggy code */
  failsOnBuggy: boolean;
  /** Whether the test passes on fixed code */
  passesOnFixed: boolean;
  /** Test plausibility classification */
  plausibility: TestPlausibility;
  /** Test name/description */
  name: string;
  /** Test framework (jest, mocha, pytest, etc.) */
  framework: TestFramework;
  /** Confidence score (0-1) */
  confidence: number;
  /** Assertions in the test */
  assertions: TestAssertion[];
  /** Setup code */
  setup?: string;
  /** Teardown code */
  teardown?: string;
  /** Error message expected when test fails on buggy code */
  expectedError?: string;
}

/**
 * Supported test frameworks
 */
export type TestFramework = 'jest' | 'mocha' | 'vitest' | 'pytest' | 'unittest' | 'jasmine';

/**
 * Test assertion
 */
export interface TestAssertion {
  /** Assertion type */
  type: AssertionType;
  /** Expected value */
  expected: unknown;
  /** Actual value expression */
  actualExpression: string;
  /** Assertion message */
  message?: string;
}

/**
 * Assertion types
 */
export type AssertionType =
  | 'equals'
  | 'notEquals'
  | 'throws'
  | 'notThrows'
  | 'truthy'
  | 'falsy'
  | 'contains'
  | 'notContains'
  | 'matches'
  | 'instanceof';

/**
 * BRT Generator configuration
 */
export interface BRTGeneratorConfig {
  /** Target test framework */
  framework: TestFramework;
  /** Language for generated tests */
  language: 'javascript' | 'typescript' | 'python';
  /** Maximum tests to generate per bug report */
  maxTestsPerReport: number;
  /** Include setup/teardown boilerplate */
  includeSetupTeardown: boolean;
  /** Minimum confidence threshold */
  confidenceThreshold: number;
  /** Include error message assertions */
  assertErrorMessages: boolean;
}

/**
 * Test validation result
 */
export interface TestValidationResult {
  /** Test being validated */
  test: BugReproductionTest;
  /** Whether validation passed */
  valid: boolean;
  /** Result on buggy code */
  buggyResult: ExecutionResult;
  /** Result on fixed code */
  fixedResult: ExecutionResult;
  /** Validation errors */
  errors: string[];
}

/**
 * Test execution result
 */
export interface ExecutionResult {
  /** Whether test passed */
  passed: boolean;
  /** Error if test failed */
  error?: string;
  /** Execution time in milliseconds */
  durationMs: number;
  /** Output from test */
  output?: string;
}

/**
 * Test ranking result
 */
export interface RankedTest {
  /** The test */
  test: BugReproductionTest;
  /** Ranking score (higher is better) */
  score: number;
  /** Ranking factors */
  factors: RankingFactor[];
}

/**
 * Factor contributing to test ranking
 */
export interface RankingFactor {
  /** Factor name */
  name: string;
  /** Factor score */
  score: number;
  /** Factor weight */
  weight: number;
  /** Factor description */
  description: string;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: BRTGeneratorConfig = {
  framework: 'jest',
  language: 'typescript',
  maxTestsPerReport: 5,
  includeSetupTeardown: true,
  confidenceThreshold: 0.6,
  assertErrorMessages: true,
};

// =============================================================================
// Test Templates
// =============================================================================

const TEST_TEMPLATES: Record<TestFramework, {
  wrapper: (name: string, body: string) => string;
  assertion: Record<AssertionType, (expected: string, actual: string, msg?: string) => string>;
  setup: string;
  teardown: string;
}> = {
  jest: {
    wrapper: (name, body) => `test('${name}', async () => {\n${body}\n});`,
    assertion: {
      equals: (exp, act, msg) => msg ? `expect(${act}).toBe(${exp}); // ${msg}` : `expect(${act}).toBe(${exp});`,
      notEquals: (exp, act, msg) => msg ? `expect(${act}).not.toBe(${exp}); // ${msg}` : `expect(${act}).not.toBe(${exp});`,
      throws: (exp, act, msg) => msg ? `expect(() => ${act}).toThrow(${exp}); // ${msg}` : `expect(() => ${act}).toThrow(${exp});`,
      notThrows: (_exp, act, msg) => msg ? `expect(() => ${act}).not.toThrow(); // ${msg}` : `expect(() => ${act}).not.toThrow();`,
      truthy: (_exp, act, msg) => msg ? `expect(${act}).toBeTruthy(); // ${msg}` : `expect(${act}).toBeTruthy();`,
      falsy: (_exp, act, msg) => msg ? `expect(${act}).toBeFalsy(); // ${msg}` : `expect(${act}).toBeFalsy();`,
      contains: (exp, act, msg) => msg ? `expect(${act}).toContain(${exp}); // ${msg}` : `expect(${act}).toContain(${exp});`,
      notContains: (exp, act, msg) => msg ? `expect(${act}).not.toContain(${exp}); // ${msg}` : `expect(${act}).not.toContain(${exp});`,
      matches: (exp, act, msg) => msg ? `expect(${act}).toMatch(${exp}); // ${msg}` : `expect(${act}).toMatch(${exp});`,
      instanceof: (exp, act, msg) => msg ? `expect(${act}).toBeInstanceOf(${exp}); // ${msg}` : `expect(${act}).toBeInstanceOf(${exp});`,
    },
    setup: 'beforeEach(() => {\n  // Setup\n});',
    teardown: 'afterEach(() => {\n  // Teardown\n});',
  },
  mocha: {
    wrapper: (name, body) => `it('${name}', async () => {\n${body}\n});`,
    assertion: {
      equals: (exp, act, msg) => msg ? `assert.strictEqual(${act}, ${exp}, '${msg}');` : `assert.strictEqual(${act}, ${exp});`,
      notEquals: (exp, act, msg) => msg ? `assert.notStrictEqual(${act}, ${exp}, '${msg}');` : `assert.notStrictEqual(${act}, ${exp});`,
      throws: (exp, act, msg) => msg ? `assert.throws(() => ${act}, ${exp}, '${msg}');` : `assert.throws(() => ${act}, ${exp});`,
      notThrows: (_exp, act, msg) => msg ? `assert.doesNotThrow(() => ${act}, '${msg}');` : `assert.doesNotThrow(() => ${act});`,
      truthy: (_exp, act, msg) => msg ? `assert.ok(${act}, '${msg}');` : `assert.ok(${act});`,
      falsy: (_exp, act, msg) => msg ? `assert.ok(!${act}, '${msg}');` : `assert.ok(!${act});`,
      contains: (exp, act, msg) => msg ? `assert.include(${act}, ${exp}, '${msg}');` : `assert.include(${act}, ${exp});`,
      notContains: (exp, act, msg) => msg ? `assert.notInclude(${act}, ${exp}, '${msg}');` : `assert.notInclude(${act}, ${exp});`,
      matches: (exp, act, msg) => msg ? `assert.match(${act}, ${exp}, '${msg}');` : `assert.match(${act}, ${exp});`,
      instanceof: (exp, act, msg) => msg ? `assert.instanceOf(${act}, ${exp}, '${msg}');` : `assert.instanceOf(${act}, ${exp});`,
    },
    setup: 'beforeEach(() => {\n  // Setup\n});',
    teardown: 'afterEach(() => {\n  // Teardown\n});',
  },
  vitest: {
    wrapper: (name, body) => `test('${name}', async () => {\n${body}\n});`,
    assertion: {
      equals: (exp, act, msg) => msg ? `expect(${act}).toBe(${exp}); // ${msg}` : `expect(${act}).toBe(${exp});`,
      notEquals: (exp, act, msg) => msg ? `expect(${act}).not.toBe(${exp}); // ${msg}` : `expect(${act}).not.toBe(${exp});`,
      throws: (exp, act, msg) => msg ? `expect(() => ${act}).toThrow(${exp}); // ${msg}` : `expect(() => ${act}).toThrow(${exp});`,
      notThrows: (_exp, act, msg) => msg ? `expect(() => ${act}).not.toThrow(); // ${msg}` : `expect(() => ${act}).not.toThrow();`,
      truthy: (_exp, act, msg) => msg ? `expect(${act}).toBeTruthy(); // ${msg}` : `expect(${act}).toBeTruthy();`,
      falsy: (_exp, act, msg) => msg ? `expect(${act}).toBeFalsy(); // ${msg}` : `expect(${act}).toBeFalsy();`,
      contains: (exp, act, msg) => msg ? `expect(${act}).toContain(${exp}); // ${msg}` : `expect(${act}).toContain(${exp});`,
      notContains: (exp, act, msg) => msg ? `expect(${act}).not.toContain(${exp}); // ${msg}` : `expect(${act}).not.toContain(${exp});`,
      matches: (exp, act, msg) => msg ? `expect(${act}).toMatch(${exp}); // ${msg}` : `expect(${act}).toMatch(${exp});`,
      instanceof: (exp, act, msg) => msg ? `expect(${act}).toBeInstanceOf(${exp}); // ${msg}` : `expect(${act}).toBeInstanceOf(${exp});`,
    },
    setup: 'beforeEach(() => {\n  // Setup\n});',
    teardown: 'afterEach(() => {\n  // Teardown\n});',
  },
  pytest: {
    wrapper: (name, body) => `def test_${name.replace(/\s+/g, '_').toLowerCase()}():\n${body}`,
    assertion: {
      equals: (exp, act, msg) => msg ? `assert ${act} == ${exp}, "${msg}"` : `assert ${act} == ${exp}`,
      notEquals: (exp, act, msg) => msg ? `assert ${act} != ${exp}, "${msg}"` : `assert ${act} != ${exp}`,
      throws: (exp, act, msg) => msg ? `with pytest.raises(${exp}):\n        ${act}  # ${msg}` : `with pytest.raises(${exp}):\n        ${act}`,
      notThrows: (_exp, act, _msg) => `${act}  # Should not raise`,
      truthy: (_exp, act, msg) => msg ? `assert ${act}, "${msg}"` : `assert ${act}`,
      falsy: (_exp, act, msg) => msg ? `assert not ${act}, "${msg}"` : `assert not ${act}`,
      contains: (exp, act, msg) => msg ? `assert ${exp} in ${act}, "${msg}"` : `assert ${exp} in ${act}`,
      notContains: (exp, act, msg) => msg ? `assert ${exp} not in ${act}, "${msg}"` : `assert ${exp} not in ${act}`,
      matches: (exp, act, msg) => msg ? `assert re.match(${exp}, ${act}), "${msg}"` : `assert re.match(${exp}, ${act})`,
      instanceof: (exp, act, msg) => msg ? `assert isinstance(${act}, ${exp}), "${msg}"` : `assert isinstance(${act}, ${exp})`,
    },
    setup: '@pytest.fixture\ndef setup():\n    # Setup\n    yield\n    # Teardown',
    teardown: '',
  },
  unittest: {
    wrapper: (name, body) => `def test_${name.replace(/\s+/g, '_').toLowerCase()}(self):\n${body}`,
    assertion: {
      equals: (exp, act, msg) => msg ? `self.assertEqual(${act}, ${exp}, "${msg}")` : `self.assertEqual(${act}, ${exp})`,
      notEquals: (exp, act, msg) => msg ? `self.assertNotEqual(${act}, ${exp}, "${msg}")` : `self.assertNotEqual(${act}, ${exp})`,
      throws: (exp, act, msg) => msg ? `with self.assertRaises(${exp}):\n            ${act}  # ${msg}` : `with self.assertRaises(${exp}):\n            ${act}`,
      notThrows: (_exp, act, _msg) => `${act}  # Should not raise`,
      truthy: (_exp, act, msg) => msg ? `self.assertTrue(${act}, "${msg}")` : `self.assertTrue(${act})`,
      falsy: (_exp, act, msg) => msg ? `self.assertFalse(${act}, "${msg}")` : `self.assertFalse(${act})`,
      contains: (exp, act, msg) => msg ? `self.assertIn(${exp}, ${act}, "${msg}")` : `self.assertIn(${exp}, ${act})`,
      notContains: (exp, act, msg) => msg ? `self.assertNotIn(${exp}, ${act}, "${msg}")` : `self.assertNotIn(${exp}, ${act})`,
      matches: (exp, act, msg) => msg ? `self.assertRegex(${act}, ${exp}, "${msg}")` : `self.assertRegex(${act}, ${exp})`,
      instanceof: (exp, act, msg) => msg ? `self.assertIsInstance(${act}, ${exp}, "${msg}")` : `self.assertIsInstance(${act}, ${exp})`,
    },
    setup: 'def setUp(self):\n        # Setup\n        pass',
    teardown: 'def tearDown(self):\n        # Teardown\n        pass',
  },
  jasmine: {
    wrapper: (name, body) => `it('${name}', async () => {\n${body}\n});`,
    assertion: {
      equals: (exp, act, msg) => msg ? `expect(${act}).toBe(${exp}); // ${msg}` : `expect(${act}).toBe(${exp});`,
      notEquals: (exp, act, msg) => msg ? `expect(${act}).not.toBe(${exp}); // ${msg}` : `expect(${act}).not.toBe(${exp});`,
      throws: (exp, act, msg) => msg ? `expect(() => ${act}).toThrowError(${exp}); // ${msg}` : `expect(() => ${act}).toThrowError(${exp});`,
      notThrows: (_exp, act, msg) => msg ? `expect(() => ${act}).not.toThrow(); // ${msg}` : `expect(() => ${act}).not.toThrow();`,
      truthy: (_exp, act, msg) => msg ? `expect(${act}).toBeTruthy(); // ${msg}` : `expect(${act}).toBeTruthy();`,
      falsy: (_exp, act, msg) => msg ? `expect(${act}).toBeFalsy(); // ${msg}` : `expect(${act}).toBeFalsy();`,
      contains: (exp, act, msg) => msg ? `expect(${act}).toContain(${exp}); // ${msg}` : `expect(${act}).toContain(${exp});`,
      notContains: (exp, act, msg) => msg ? `expect(${act}).not.toContain(${exp}); // ${msg}` : `expect(${act}).not.toContain(${exp});`,
      matches: (exp, act, msg) => msg ? `expect(${act}).toMatch(${exp}); // ${msg}` : `expect(${act}).toMatch(${exp});`,
      instanceof: (exp, act, msg) => msg ? `expect(${act}).toBeInstanceOf(${exp}); // ${msg}` : `expect(${act}).toBeInstanceOf(${exp});`,
    },
    setup: 'beforeEach(() => {\n  // Setup\n});',
    teardown: 'afterEach(() => {\n  // Teardown\n});',
  },
};

// =============================================================================
// BRT Generator Class
// =============================================================================

/**
 * Bug Reproduction Test Generator
 *
 * Feature #22: Class with config for test generation
 * Generates tests from bug reports following LIBRO research.
 */
export class BRTGenerator {
  private config: BRTGeneratorConfig;

  constructor(config: Partial<BRTGeneratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate tests from a bug report
   *
   * Feature #23: Creates tests from bug reports.
   *
   * @param report - Bug report to generate tests from
   * @returns Promise resolving to array of generated tests
   */
  async generateFromReport(report: BugReport): Promise<BugReproductionTest[]> {
    const tests: BugReproductionTest[] = [];

    // Generate tests from reproduction steps
    if (report.reproductionSteps.length > 0) {
      const stepsTest = this.generateFromSteps(report);
      tests.push(stepsTest);
    }

    // Generate test from stack trace if available
    if (report.stackTrace) {
      const stackTest = this.generateFromStackTrace(report);
      tests.push(stackTest);
    }

    // Generate test from code snippets if available
    if (report.codeSnippets && report.codeSnippets.length > 0) {
      const snippetTests = this.generateFromSnippets(report);
      tests.push(...snippetTests);
    }

    // Generate error boundary test
    const errorTest = this.generateErrorBoundaryTest(report);
    tests.push(errorTest);

    // Limit to max tests per report
    return tests.slice(0, this.config.maxTestsPerReport);
  }

  /**
   * Validate a test against buggy and fixed versions
   *
   * Feature #24: Verifies test fails on buggy, passes on fixed.
   *
   * @param test - Test to validate
   * @param buggyCode - Code with the bug
   * @param fixedCode - Code after fix
   * @returns Validation result
   */
  async validateTest(
    test: BugReproductionTest,
    buggyCode: string,
    fixedCode: string
  ): Promise<TestValidationResult> {
    const errors: string[] = [];

    // Run test on buggy code
    const buggyResult = await this.runTestOnCode(test, buggyCode);

    // Run test on fixed code
    const fixedResult = await this.runTestOnCode(test, fixedCode);

    // Update test properties
    test.failsOnBuggy = !buggyResult.passed;
    test.passesOnFixed = fixedResult.passed;

    // Validate expectations
    if (buggyResult.passed) {
      errors.push('Test should fail on buggy code but passed');
    }

    if (!fixedResult.passed) {
      errors.push(`Test should pass on fixed code but failed: ${fixedResult.error ?? 'Unknown error'}`);
    }

    // Update plausibility based on validation
    if (test.failsOnBuggy && test.passesOnFixed) {
      test.plausibility = 'plausible';
    } else if (test.failsOnBuggy || test.passesOnFixed) {
      test.plausibility = 'candidate';
    } else {
      test.plausibility = 'invalid';
    }

    return {
      test,
      valid: errors.length === 0,
      buggyResult,
      fixedResult,
      errors,
    };
  }

  /**
   * Rank tests by plausibility
   *
   * Feature #25: Orders tests by likelihood of correctness.
   * Order: plausible > candidate > invalid
   *
   * @param tests - Tests to rank
   * @returns Ranked tests with scores
   */
  rankByPlausibility(tests: BugReproductionTest[]): RankedTest[] {
    return tests
      .map((test) => this.calculateRankingScore(test))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Generate test code for a test
   */
  generateTestCode(test: BugReproductionTest): string {
    const template = TEST_TEMPLATES[test.framework];
    const lines: string[] = [];

    // Add setup if configured
    if (this.config.includeSetupTeardown && test.setup) {
      lines.push(test.setup);
      lines.push('');
    }

    // Build assertion code
    const assertionLines: string[] = [];
    for (const assertion of test.assertions) {
      const assertFn = template.assertion[assertion.type];
      const expectedStr = JSON.stringify(assertion.expected);
      assertionLines.push('  ' + assertFn(expectedStr, assertion.actualExpression, assertion.message));
    }

    // Build test body
    const body = assertionLines.join('\n');
    lines.push(template.wrapper(test.name, body));

    // Add teardown if configured
    if (this.config.includeSetupTeardown && test.teardown) {
      lines.push('');
      lines.push(test.teardown);
    }

    return lines.join('\n');
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Generate test from reproduction steps
   */
  private generateFromSteps(report: BugReport): BugReproductionTest {
    const assertions: TestAssertion[] = [];

    // Build assertions from steps
    for (const step of report.reproductionSteps) {
      if (step.expectedOutput) {
        assertions.push({
          type: 'equals',
          expected: step.expectedOutput,
          actualExpression: step.code ?? `result_step_${step.step}`,
          message: step.description,
        });
      }
    }

    // Add assertion for expected vs actual behavior
    if (report.expectedBehavior && report.actualBehavior) {
      assertions.push({
        type: 'notEquals',
        expected: report.actualBehavior,
        actualExpression: 'result',
        message: `Should be "${report.expectedBehavior}" not "${report.actualBehavior}"`,
      });
    }

    const test: BugReproductionTest = {
      testCode: '',
      bugReportId: report.id,
      failsOnBuggy: false,
      passesOnFixed: false,
      plausibility: 'candidate',
      name: `Reproduction: ${report.title}`,
      framework: this.config.framework,
      confidence: 0.7,
      assertions,
    };

    test.testCode = this.generateTestCode(test);
    return test;
  }

  /**
   * Generate test from stack trace
   */
  private generateFromStackTrace(report: BugReport): BugReproductionTest {
    const assertions: TestAssertion[] = [];

    // Extract error type from stack trace
    const errorMatch = report.stackTrace?.match(/^(\w+Error):/);
    const errorType = errorMatch?.[1] ?? 'Error';

    // Add throws assertion
    assertions.push({
      type: 'throws',
      expected: errorType,
      actualExpression: 'triggerBug()',
      message: `Should throw ${errorType}`,
    });

    const test: BugReproductionTest = {
      testCode: '',
      bugReportId: report.id,
      failsOnBuggy: false,
      passesOnFixed: false,
      plausibility: 'candidate',
      name: `Error handling: ${report.title}`,
      framework: this.config.framework,
      confidence: 0.6,
      assertions,
      expectedError: errorType,
    };

    test.testCode = this.generateTestCode(test);
    return test;
  }

  /**
   * Generate tests from code snippets
   */
  private generateFromSnippets(report: BugReport): BugReproductionTest[] {
    const tests: BugReproductionTest[] = [];

    for (const snippet of report.codeSnippets ?? []) {
      const assertions: TestAssertion[] = [];

      // Basic assertion that code executes
      assertions.push({
        type: 'notThrows',
        expected: undefined,
        actualExpression: `executeSnippet()`,
        message: `Code from ${snippet.file}:${snippet.startLine} should not throw`,
      });

      const test: BugReproductionTest = {
        testCode: '',
        bugReportId: report.id,
        failsOnBuggy: false,
        passesOnFixed: false,
        plausibility: 'candidate',
        name: `Snippet: ${snippet.file}:${snippet.startLine}`,
        framework: this.config.framework,
        confidence: 0.5,
        assertions,
        setup: `// From ${snippet.file}:${snippet.startLine}-${snippet.endLine}\nconst executeSnippet = () => {\n${snippet.code}\n};`,
      };

      test.testCode = this.generateTestCode(test);
      tests.push(test);
    }

    return tests;
  }

  /**
   * Generate error boundary test
   */
  private generateErrorBoundaryTest(report: BugReport): BugReproductionTest {
    const assertions: TestAssertion[] = [];

    // Test that proper error handling exists
    assertions.push({
      type: 'throws',
      expected: 'Error',
      actualExpression: 'triggerBugCondition()',
      message: 'Bug condition should be caught',
    });

    const test: BugReproductionTest = {
      testCode: '',
      bugReportId: report.id,
      failsOnBuggy: false,
      passesOnFixed: false,
      plausibility: 'candidate',
      name: `Error boundary: ${report.title}`,
      framework: this.config.framework,
      confidence: 0.5,
      assertions,
    };

    test.testCode = this.generateTestCode(test);
    return test;
  }

  /**
   * Run test on code (simulated)
   */
  private async runTestOnCode(
    _test: BugReproductionTest,
    _code: string
  ): Promise<ExecutionResult> {
    // In a real implementation, this would:
    // 1. Create a temporary test file
    // 2. Run the test framework
    // 3. Parse the results
    // For now, return simulated result
    const startTime = Date.now();

    return {
      passed: false, // Assume failure for buggy code
      durationMs: Date.now() - startTime,
      output: 'Simulated test execution',
    };
  }

  /**
   * Calculate ranking score for a test
   */
  private calculateRankingScore(test: BugReproductionTest): RankedTest {
    const factors: RankingFactor[] = [];
    let totalScore = 0;

    // Plausibility factor (weight: 40%)
    const plausibilityScores: Record<TestPlausibility, number> = {
      plausible: 1.0,
      candidate: 0.5,
      invalid: 0.0,
    };
    const plausibilityScore = plausibilityScores[test.plausibility];
    factors.push({
      name: 'plausibility',
      score: plausibilityScore,
      weight: 0.4,
      description: `Test is ${test.plausibility}`,
    });
    totalScore += plausibilityScore * 0.4;

    // Confidence factor (weight: 25%)
    factors.push({
      name: 'confidence',
      score: test.confidence,
      weight: 0.25,
      description: `Confidence: ${(test.confidence * 100).toFixed(0)}%`,
    });
    totalScore += test.confidence * 0.25;

    // Assertion count factor (weight: 15%)
    const assertionScore = Math.min(test.assertions.length / 5, 1.0);
    factors.push({
      name: 'assertions',
      score: assertionScore,
      weight: 0.15,
      description: `${test.assertions.length} assertion(s)`,
    });
    totalScore += assertionScore * 0.15;

    // Validation factor (weight: 20%)
    let validationScore = 0;
    if (test.failsOnBuggy) validationScore += 0.5;
    if (test.passesOnFixed) validationScore += 0.5;
    factors.push({
      name: 'validation',
      score: validationScore,
      weight: 0.2,
      description: `Fails on buggy: ${test.failsOnBuggy}, Passes on fixed: ${test.passesOnFixed}`,
    });
    totalScore += validationScore * 0.2;

    return {
      test,
      score: totalScore,
      factors,
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a BRT Generator instance
 */
export function createBRTGenerator(
  config?: Partial<BRTGeneratorConfig>
): BRTGenerator {
  return new BRTGenerator(config);
}

/**
 * Generate tests from a bug report (convenience function)
 */
export async function generateBugTests(
  report: BugReport,
  config?: Partial<BRTGeneratorConfig>
): Promise<BugReproductionTest[]> {
  const generator = new BRTGenerator(config);
  return generator.generateFromReport(report);
}

/**
 * Rank tests by plausibility (convenience function)
 */
export function rankBugTests(
  tests: BugReproductionTest[],
  config?: Partial<BRTGeneratorConfig>
): RankedTest[] {
  const generator = new BRTGenerator(config);
  return generator.rankByPlausibility(tests);
}
