/**
 * Load Testing for Concurrent Generations
 *
 * Tests system performance under load with multiple concurrent users
 * to ensure no degradation when handling simultaneous generations.
 */

// ============================================================================
// Types
// ============================================================================

export interface LoadTestConfig {
  readonly concurrentUsers: number;
  readonly requestsPerUser: number;
  readonly rampUpMs: number;
  readonly testDurationMs: number;
  readonly thinkTimeMs: number;
  readonly timeoutMs: number;
}

export interface LoadTestResult {
  readonly id: string;
  readonly config: LoadTestConfig;
  readonly startedAt: number;
  readonly completedAt: number;
  readonly duration: number;
  readonly metrics: LoadTestMetrics;
  readonly userResults: readonly UserResult[];
  readonly status: LoadTestStatus;
  readonly errors: readonly LoadTestError[];
}

export type LoadTestStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface LoadTestMetrics {
  readonly totalRequests: number;
  readonly successfulRequests: number;
  readonly failedRequests: number;
  readonly successRate: number;
  readonly averageResponseTime: number;
  readonly minResponseTime: number;
  readonly maxResponseTime: number;
  readonly p50ResponseTime: number;
  readonly p90ResponseTime: number;
  readonly p95ResponseTime: number;
  readonly p99ResponseTime: number;
  readonly requestsPerSecond: number;
  readonly concurrentPeak: number;
}

export interface UserResult {
  readonly userId: string;
  readonly requests: readonly RequestResult[];
  readonly totalTime: number;
  readonly successRate: number;
  readonly averageResponseTime: number;
}

export interface RequestResult {
  readonly id: string;
  readonly userId: string;
  readonly startedAt: number;
  readonly completedAt: number;
  readonly duration: number;
  readonly success: boolean;
  readonly error: string | null;
  readonly statusCode: number | null;
}

export interface LoadTestError {
  readonly timestamp: number;
  readonly userId: string;
  readonly requestId: string;
  readonly message: string;
  readonly code: string | null;
}

export interface LoadTestState {
  readonly tests: Map<string, LoadTestResult>;
  readonly activeTestId: string | null;
  readonly defaultConfig: LoadTestConfig;
}

export type GenerationHandler = (userId: string, requestId: string) => Promise<RequestResult>;

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: LoadTestConfig = {
  concurrentUsers: 10,
  requestsPerUser: 5,
  rampUpMs: 5000,
  testDurationMs: 60000,
  thinkTimeMs: 1000,
  timeoutMs: 30000,
};

// ============================================================================
// State
// ============================================================================

let state: LoadTestState = {
  tests: new Map(),
  activeTestId: null,
  defaultConfig: DEFAULT_CONFIG,
};

let generationHandler: GenerationHandler | null = null;
let cancelRequested = false;

// ============================================================================
// Configuration
// ============================================================================

export function setDefaultConfig(config: Partial<LoadTestConfig>): void {
  state = {
    ...state,
    defaultConfig: {
      ...state.defaultConfig,
      ...config,
    },
  };
}

export function getDefaultConfig(): LoadTestConfig {
  return state.defaultConfig;
}

export function setGenerationHandler(handler: GenerationHandler): void {
  generationHandler = handler;
}

// ============================================================================
// Test Execution
// ============================================================================

export async function runLoadTest(
  config: Partial<LoadTestConfig> = {}
): Promise<LoadTestResult> {
  if (state.activeTestId !== null) {
    throw new Error('A load test is already running');
  }

  const fullConfig: LoadTestConfig = {
    ...state.defaultConfig,
    ...config,
  };

  const testId = generateId();
  const startedAt = Date.now();
  cancelRequested = false;

  const result: LoadTestResult = {
    id: testId,
    config: fullConfig,
    startedAt,
    completedAt: 0,
    duration: 0,
    metrics: createEmptyMetrics(),
    userResults: [],
    status: 'running',
    errors: [],
  };

  const newTests = new Map(state.tests);
  newTests.set(testId, result);

  state = {
    ...state,
    tests: newTests,
    activeTestId: testId,
  };

  try {
    const userResults = await executeLoadTest(testId, fullConfig);
    const completedAt = Date.now();

    const errors: LoadTestError[] = [];
    for (const userResult of userResults) {
      for (const request of userResult.requests) {
        if (!request.success && request.error) {
          errors.push({
            timestamp: request.completedAt,
            userId: request.userId,
            requestId: request.id,
            message: request.error,
            code: null,
          });
        }
      }
    }

    const metrics = calculateMetrics(userResults, startedAt, completedAt);

    const finalResult: LoadTestResult = {
      ...result,
      completedAt,
      duration: completedAt - startedAt,
      metrics,
      userResults,
      status: cancelRequested ? 'cancelled' : 'completed',
      errors,
    };

    const updatedTests = new Map(state.tests);
    updatedTests.set(testId, finalResult);

    state = {
      ...state,
      tests: updatedTests,
      activeTestId: null,
    };

    return finalResult;
  } catch (error) {
    const completedAt = Date.now();
    const failedResult: LoadTestResult = {
      ...result,
      completedAt,
      duration: completedAt - startedAt,
      status: 'failed',
      errors: [{
        timestamp: completedAt,
        userId: 'system',
        requestId: 'system',
        message: error instanceof Error ? error.message : String(error),
        code: 'TEST_FAILED',
      }],
    };

    const updatedTests = new Map(state.tests);
    updatedTests.set(testId, failedResult);

    state = {
      ...state,
      tests: updatedTests,
      activeTestId: null,
    };

    return failedResult;
  }
}

async function executeLoadTest(
  testId: string,
  config: LoadTestConfig
): Promise<UserResult[]> {
  const userPromises: Promise<UserResult>[] = [];
  const rampUpDelay = config.rampUpMs / config.concurrentUsers;

  for (let i = 0; i < config.concurrentUsers; i++) {
    if (cancelRequested) break;

    const userId = `user_${i + 1}`;
    const startDelay = i * rampUpDelay;

    const userPromise = new Promise<UserResult>(async (resolve) => {
      await sleep(startDelay);

      if (cancelRequested) {
        resolve({
          userId,
          requests: [],
          totalTime: 0,
          successRate: 0,
          averageResponseTime: 0,
        });
        return;
      }

      const userResult = await executeUserSession(userId, config);
      resolve(userResult);
    });

    userPromises.push(userPromise);
  }

  return Promise.all(userPromises);
}

async function executeUserSession(
  userId: string,
  config: LoadTestConfig
): Promise<UserResult> {
  const requests: RequestResult[] = [];
  const sessionStart = Date.now();

  for (let i = 0; i < config.requestsPerUser; i++) {
    if (cancelRequested) break;

    const requestId = `${userId}_req_${i + 1}`;
    const result = await executeRequest(userId, requestId, config);
    requests.push(result);

    // Think time between requests
    if (i < config.requestsPerUser - 1 && config.thinkTimeMs > 0) {
      await sleep(config.thinkTimeMs);
    }
  }

  const sessionEnd = Date.now();
  const successfulRequests = requests.filter(r => r.success);
  const responseTimes = requests.map(r => r.duration);

  return {
    userId,
    requests,
    totalTime: sessionEnd - sessionStart,
    successRate: requests.length > 0 ? successfulRequests.length / requests.length : 0,
    averageResponseTime: responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0,
  };
}

async function executeRequest(
  userId: string,
  requestId: string,
  config: LoadTestConfig
): Promise<RequestResult> {
  const startedAt = Date.now();

  try {
    if (generationHandler) {
      const result = await Promise.race([
        generationHandler(userId, requestId),
        timeout(config.timeoutMs),
      ]);

      if (result === 'timeout') {
        return {
          id: requestId,
          userId,
          startedAt,
          completedAt: Date.now(),
          duration: Date.now() - startedAt,
          success: false,
          error: 'Request timed out',
          statusCode: 408,
        };
      }

      return result;
    }

    // Default mock handler for testing
    const mockDuration = 50 + Math.random() * 200;
    await sleep(mockDuration);

    return {
      id: requestId,
      userId,
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
      success: true,
      error: null,
      statusCode: 200,
    };
  } catch (error) {
    return {
      id: requestId,
      userId,
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      statusCode: 500,
    };
  }
}

// ============================================================================
// Metrics Calculation
// ============================================================================

function createEmptyMetrics(): LoadTestMetrics {
  return {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    successRate: 0,
    averageResponseTime: 0,
    minResponseTime: 0,
    maxResponseTime: 0,
    p50ResponseTime: 0,
    p90ResponseTime: 0,
    p95ResponseTime: 0,
    p99ResponseTime: 0,
    requestsPerSecond: 0,
    concurrentPeak: 0,
  };
}

function calculateMetrics(
  userResults: readonly UserResult[],
  startedAt: number,
  completedAt: number
): LoadTestMetrics {
  const allRequests: RequestResult[] = [];
  for (const user of userResults) {
    allRequests.push(...user.requests);
  }

  if (allRequests.length === 0) {
    return createEmptyMetrics();
  }

  const successfulRequests = allRequests.filter(r => r.success);
  const responseTimes = allRequests.map(r => r.duration).sort((a, b) => a - b);
  const durationSeconds = (completedAt - startedAt) / 1000;

  return {
    totalRequests: allRequests.length,
    successfulRequests: successfulRequests.length,
    failedRequests: allRequests.length - successfulRequests.length,
    successRate: successfulRequests.length / allRequests.length,
    averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
    minResponseTime: responseTimes[0],
    maxResponseTime: responseTimes[responseTimes.length - 1],
    p50ResponseTime: percentile(responseTimes, 50),
    p90ResponseTime: percentile(responseTimes, 90),
    p95ResponseTime: percentile(responseTimes, 95),
    p99ResponseTime: percentile(responseTimes, 99),
    requestsPerSecond: durationSeconds > 0 ? allRequests.length / durationSeconds : 0,
    concurrentPeak: userResults.length,
  };
}

function percentile(sortedValues: readonly number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
}

// ============================================================================
// Test Management
// ============================================================================

export function cancelLoadTest(): boolean {
  if (state.activeTestId === null) {
    return false;
  }

  cancelRequested = true;
  return true;
}

export function isTestRunning(): boolean {
  return state.activeTestId !== null;
}

export function getActiveTestId(): string | null {
  return state.activeTestId;
}

export function getTest(id: string): LoadTestResult | null {
  return state.tests.get(id) ?? null;
}

export function getAllTests(): readonly LoadTestResult[] {
  return Array.from(state.tests.values())
    .sort((a, b) => b.startedAt - a.startedAt);
}

export function getRecentTests(limit: number = 10): readonly LoadTestResult[] {
  return getAllTests().slice(0, limit);
}

export function removeTest(id: string): boolean {
  if (!state.tests.has(id)) {
    return false;
  }

  if (state.activeTestId === id) {
    return false;
  }

  const newTests = new Map(state.tests);
  newTests.delete(id);

  state = {
    ...state,
    tests: newTests,
  };

  return true;
}

export function clearTests(): void {
  if (state.activeTestId !== null) {
    throw new Error('Cannot clear tests while a test is running');
  }

  state = {
    ...state,
    tests: new Map(),
  };
}

// ============================================================================
// Performance Thresholds
// ============================================================================

export interface PerformanceThresholds {
  readonly maxAverageResponseTime: number;
  readonly maxP95ResponseTime: number;
  readonly minSuccessRate: number;
  readonly minRequestsPerSecond: number;
}

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  maxAverageResponseTime: 5000,
  maxP95ResponseTime: 10000,
  minSuccessRate: 0.95,
  minRequestsPerSecond: 1,
};

export function checkThresholds(
  metrics: LoadTestMetrics,
  thresholds: Partial<PerformanceThresholds> = {}
): ThresholdResult {
  const fullThresholds: PerformanceThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...thresholds,
  };

  const violations: ThresholdViolation[] = [];

  if (metrics.averageResponseTime > fullThresholds.maxAverageResponseTime) {
    violations.push({
      metric: 'averageResponseTime',
      threshold: fullThresholds.maxAverageResponseTime,
      actual: metrics.averageResponseTime,
      message: `Average response time ${metrics.averageResponseTime}ms exceeds threshold ${fullThresholds.maxAverageResponseTime}ms`,
    });
  }

  if (metrics.p95ResponseTime > fullThresholds.maxP95ResponseTime) {
    violations.push({
      metric: 'p95ResponseTime',
      threshold: fullThresholds.maxP95ResponseTime,
      actual: metrics.p95ResponseTime,
      message: `P95 response time ${metrics.p95ResponseTime}ms exceeds threshold ${fullThresholds.maxP95ResponseTime}ms`,
    });
  }

  if (metrics.successRate < fullThresholds.minSuccessRate) {
    violations.push({
      metric: 'successRate',
      threshold: fullThresholds.minSuccessRate,
      actual: metrics.successRate,
      message: `Success rate ${(metrics.successRate * 100).toFixed(1)}% below threshold ${(fullThresholds.minSuccessRate * 100)}%`,
    });
  }

  if (metrics.requestsPerSecond < fullThresholds.minRequestsPerSecond) {
    violations.push({
      metric: 'requestsPerSecond',
      threshold: fullThresholds.minRequestsPerSecond,
      actual: metrics.requestsPerSecond,
      message: `Requests per second ${metrics.requestsPerSecond.toFixed(2)} below threshold ${fullThresholds.minRequestsPerSecond}`,
    });
  }

  return {
    passed: violations.length === 0,
    violations,
    thresholds: fullThresholds,
  };
}

export interface ThresholdResult {
  readonly passed: boolean;
  readonly violations: readonly ThresholdViolation[];
  readonly thresholds: PerformanceThresholds;
}

export interface ThresholdViolation {
  readonly metric: string;
  readonly threshold: number;
  readonly actual: number;
  readonly message: string;
}

// ============================================================================
// Degradation Detection
// ============================================================================

export function checkDegradation(
  baseline: LoadTestMetrics,
  current: LoadTestMetrics,
  tolerancePercent: number = 20
): DegradationResult {
  const issues: DegradationIssue[] = [];
  const tolerance = 1 + tolerancePercent / 100;

  if (baseline.averageResponseTime > 0) {
    const ratio = current.averageResponseTime / baseline.averageResponseTime;
    if (ratio > tolerance) {
      issues.push({
        metric: 'averageResponseTime',
        baseline: baseline.averageResponseTime,
        current: current.averageResponseTime,
        degradationPercent: (ratio - 1) * 100,
        message: `Average response time degraded by ${((ratio - 1) * 100).toFixed(1)}%`,
      });
    }
  }

  if (baseline.successRate > 0) {
    const ratio = baseline.successRate / current.successRate;
    if (ratio > tolerance) {
      issues.push({
        metric: 'successRate',
        baseline: baseline.successRate,
        current: current.successRate,
        degradationPercent: (ratio - 1) * 100,
        message: `Success rate degraded by ${((ratio - 1) * 100).toFixed(1)}%`,
      });
    }
  }

  if (baseline.requestsPerSecond > 0) {
    const ratio = baseline.requestsPerSecond / current.requestsPerSecond;
    if (ratio > tolerance) {
      issues.push({
        metric: 'requestsPerSecond',
        baseline: baseline.requestsPerSecond,
        current: current.requestsPerSecond,
        degradationPercent: (ratio - 1) * 100,
        message: `Throughput degraded by ${((ratio - 1) * 100).toFixed(1)}%`,
      });
    }
  }

  return {
    degraded: issues.length > 0,
    issues,
    tolerancePercent,
  };
}

export interface DegradationResult {
  readonly degraded: boolean;
  readonly issues: readonly DegradationIssue[];
  readonly tolerancePercent: number;
}

export interface DegradationIssue {
  readonly metric: string;
  readonly baseline: number;
  readonly current: number;
  readonly degradationPercent: number;
  readonly message: string;
}

// ============================================================================
// State Access
// ============================================================================

export function getState(): LoadTestState {
  return {
    ...state,
    tests: new Map(state.tests),
  };
}

// ============================================================================
// Reset
// ============================================================================

export function resetLoadTesting(): void {
  if (state.activeTestId !== null) {
    cancelRequested = true;
  }

  state = {
    tests: new Map(),
    activeTestId: null,
    defaultConfig: DEFAULT_CONFIG,
  };

  generationHandler = null;
  cancelRequested = false;
}

// ============================================================================
// Utilities
// ============================================================================

function generateId(): string {
  return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function timeout(ms: number): Promise<'timeout'> {
  return new Promise(resolve => setTimeout(() => resolve('timeout'), ms));
}

export function formatMetrics(metrics: LoadTestMetrics): string {
  return [
    `Total Requests: ${metrics.totalRequests}`,
    `Successful: ${metrics.successfulRequests} (${(metrics.successRate * 100).toFixed(1)}%)`,
    `Failed: ${metrics.failedRequests}`,
    `Avg Response Time: ${metrics.averageResponseTime.toFixed(0)}ms`,
    `P50: ${metrics.p50ResponseTime.toFixed(0)}ms`,
    `P95: ${metrics.p95ResponseTime.toFixed(0)}ms`,
    `P99: ${metrics.p99ResponseTime.toFixed(0)}ms`,
    `RPS: ${metrics.requestsPerSecond.toFixed(2)}`,
  ].join('\n');
}
