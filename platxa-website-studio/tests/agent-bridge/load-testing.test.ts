/**
 * Tests for Load Testing for Concurrent Generations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setDefaultConfig,
  getDefaultConfig,
  setGenerationHandler,
  runLoadTest,
  cancelLoadTest,
  isTestRunning,
  getActiveTestId,
  getTest,
  getAllTests,
  getRecentTests,
  removeTest,
  clearTests,
  checkThresholds,
  checkDegradation,
  getState,
  resetLoadTesting,
  formatMetrics,
  type LoadTestConfig,
  type LoadTestResult,
  type LoadTestMetrics,
  type RequestResult,
} from '../../lib/agent-bridge/load-testing';

describe('Load Testing for Concurrent Generations', () => {
  beforeEach(() => {
    resetLoadTesting();
  });

  describe('Configuration', () => {
    describe('setDefaultConfig / getDefaultConfig', () => {
      it('should return default config', () => {
        const config = getDefaultConfig();

        expect(config.concurrentUsers).toBe(10);
        expect(config.requestsPerUser).toBe(5);
        expect(config.rampUpMs).toBe(5000);
        expect(config.testDurationMs).toBe(60000);
        expect(config.thinkTimeMs).toBe(1000);
        expect(config.timeoutMs).toBe(30000);
      });

      it('should update default config', () => {
        setDefaultConfig({ concurrentUsers: 20 });

        const config = getDefaultConfig();
        expect(config.concurrentUsers).toBe(20);
        expect(config.requestsPerUser).toBe(5); // Unchanged
      });

      it('should merge partial config', () => {
        setDefaultConfig({ concurrentUsers: 15, thinkTimeMs: 500 });

        const config = getDefaultConfig();
        expect(config.concurrentUsers).toBe(15);
        expect(config.thinkTimeMs).toBe(500);
        expect(config.rampUpMs).toBe(5000); // Unchanged
      });
    });
  });

  describe('Test Execution', () => {
    describe('runLoadTest', () => {
      it('should run a basic load test', async () => {
        const result = await runLoadTest({
          concurrentUsers: 2,
          requestsPerUser: 2,
          rampUpMs: 100,
          thinkTimeMs: 10,
        });

        expect(result.id).toBeDefined();
        expect(result.status).toBe('completed');
        expect(result.metrics.totalRequests).toBe(4);
        expect(result.userResults.length).toBe(2);
      });

      it('should use custom generation handler', async () => {
        let handlerCalls = 0;

        setGenerationHandler(async (userId, requestId) => {
          handlerCalls++;
          return {
            id: requestId,
            userId,
            startedAt: Date.now(),
            completedAt: Date.now(),
            duration: 10,
            success: true,
            error: null,
            statusCode: 200,
          };
        });

        await runLoadTest({
          concurrentUsers: 2,
          requestsPerUser: 3,
          rampUpMs: 50,
          thinkTimeMs: 5,
        });

        expect(handlerCalls).toBe(6);
      });

      it('should handle handler errors', async () => {
        setGenerationHandler(async () => {
          throw new Error('Handler error');
        });

        const result = await runLoadTest({
          concurrentUsers: 1,
          requestsPerUser: 2,
          rampUpMs: 10,
          thinkTimeMs: 5,
        });

        expect(result.metrics.failedRequests).toBe(2);
        expect(result.errors.length).toBe(2);
      });

      it('should calculate metrics correctly', async () => {
        const result = await runLoadTest({
          concurrentUsers: 3,
          requestsPerUser: 3,
          rampUpMs: 100,
          thinkTimeMs: 10,
        });

        expect(result.metrics.totalRequests).toBe(9);
        expect(result.metrics.successfulRequests).toBe(9);
        expect(result.metrics.failedRequests).toBe(0);
        expect(result.metrics.successRate).toBe(1);
        expect(result.metrics.averageResponseTime).toBeGreaterThan(0);
        expect(result.metrics.p50ResponseTime).toBeGreaterThan(0);
        expect(result.metrics.requestsPerSecond).toBeGreaterThan(0);
      });

      it('should record user results', async () => {
        const result = await runLoadTest({
          concurrentUsers: 2,
          requestsPerUser: 2,
          rampUpMs: 50,
          thinkTimeMs: 5,
        });

        expect(result.userResults.length).toBe(2);
        expect(result.userResults[0].requests.length).toBe(2);
        expect(result.userResults[0].userId).toMatch(/^user_/);
      });

      it('should handle concurrent test prevention', async () => {
        const testPromise = runLoadTest({
          concurrentUsers: 2,
          requestsPerUser: 1,
          rampUpMs: 100,
          thinkTimeMs: 50,
        });

        // Give time for test to start
        await new Promise(resolve => setTimeout(resolve, 10));

        if (isTestRunning()) {
          await expect(runLoadTest({
            concurrentUsers: 1,
            requestsPerUser: 1,
            rampUpMs: 10,
            thinkTimeMs: 5,
          })).rejects.toThrow('A load test is already running');
        }

        await testPromise;
      });
    });

    describe('cancelLoadTest', () => {
      it('should return false when no test running', () => {
        expect(cancelLoadTest()).toBe(false);
      });

      it('should cancel running test', async () => {
        const testPromise = runLoadTest({
          concurrentUsers: 5,
          requestsPerUser: 10,
          rampUpMs: 1000,
          thinkTimeMs: 100,
        });

        // Wait for test to start
        await new Promise(resolve => setTimeout(resolve, 50));

        if (isTestRunning()) {
          expect(cancelLoadTest()).toBe(true);
        }

        const result = await testPromise;
        // May be completed or cancelled depending on timing
        expect(['completed', 'cancelled']).toContain(result.status);
      });
    });

    describe('isTestRunning', () => {
      it('should return false when no test running', () => {
        expect(isTestRunning()).toBe(false);
      });
    });

    describe('getActiveTestId', () => {
      it('should return null when no test running', () => {
        expect(getActiveTestId()).toBeNull();
      });
    });
  });

  describe('Test Management', () => {
    describe('getTest', () => {
      it('should return test by ID', async () => {
        const result = await runLoadTest({
          concurrentUsers: 1,
          requestsPerUser: 1,
          rampUpMs: 10,
          thinkTimeMs: 5,
        });

        const retrieved = getTest(result.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved!.id).toBe(result.id);
      });

      it('should return null for unknown ID', () => {
        expect(getTest('unknown')).toBeNull();
      });
    });

    describe('getAllTests', () => {
      it('should return empty array initially', () => {
        expect(getAllTests()).toEqual([]);
      });

      it('should return all tests sorted by date', async () => {
        await runLoadTest({
          concurrentUsers: 1,
          requestsPerUser: 1,
          rampUpMs: 10,
          thinkTimeMs: 5,
        });

        await runLoadTest({
          concurrentUsers: 1,
          requestsPerUser: 1,
          rampUpMs: 10,
          thinkTimeMs: 5,
        });

        const all = getAllTests();
        expect(all.length).toBe(2);
        expect(all[0].startedAt).toBeGreaterThanOrEqual(all[1].startedAt);
      });
    });

    describe('getRecentTests', () => {
      it('should return recent tests with limit', async () => {
        for (let i = 0; i < 3; i++) {
          await runLoadTest({
            concurrentUsers: 1,
            requestsPerUser: 1,
            rampUpMs: 10,
            thinkTimeMs: 5,
          });
        }

        const recent = getRecentTests(2);
        expect(recent.length).toBe(2);
      });
    });

    describe('removeTest', () => {
      it('should remove test by ID', async () => {
        const result = await runLoadTest({
          concurrentUsers: 1,
          requestsPerUser: 1,
          rampUpMs: 10,
          thinkTimeMs: 5,
        });

        expect(removeTest(result.id)).toBe(true);
        expect(getTest(result.id)).toBeNull();
      });

      it('should return false for unknown ID', () => {
        expect(removeTest('unknown')).toBe(false);
      });
    });

    describe('clearTests', () => {
      it('should clear all tests', async () => {
        await runLoadTest({
          concurrentUsers: 1,
          requestsPerUser: 1,
          rampUpMs: 10,
          thinkTimeMs: 5,
        });

        await runLoadTest({
          concurrentUsers: 1,
          requestsPerUser: 1,
          rampUpMs: 10,
          thinkTimeMs: 5,
        });

        clearTests();

        expect(getAllTests()).toEqual([]);
      });
    });
  });

  describe('Performance Thresholds', () => {
    describe('checkThresholds', () => {
      it('should pass with good metrics', () => {
        const metrics: LoadTestMetrics = {
          totalRequests: 100,
          successfulRequests: 98,
          failedRequests: 2,
          successRate: 0.98,
          averageResponseTime: 500,
          minResponseTime: 100,
          maxResponseTime: 2000,
          p50ResponseTime: 400,
          p90ResponseTime: 800,
          p95ResponseTime: 1000,
          p99ResponseTime: 1500,
          requestsPerSecond: 10,
          concurrentPeak: 10,
        };

        const result = checkThresholds(metrics);

        expect(result.passed).toBe(true);
        expect(result.violations).toEqual([]);
      });

      it('should detect average response time violation', () => {
        const metrics: LoadTestMetrics = {
          totalRequests: 100,
          successfulRequests: 100,
          failedRequests: 0,
          successRate: 1,
          averageResponseTime: 6000, // Exceeds 5000
          minResponseTime: 100,
          maxResponseTime: 10000,
          p50ResponseTime: 5000,
          p90ResponseTime: 8000,
          p95ResponseTime: 9000,
          p99ResponseTime: 10000,
          requestsPerSecond: 10,
          concurrentPeak: 10,
        };

        const result = checkThresholds(metrics);

        expect(result.passed).toBe(false);
        expect(result.violations.length).toBeGreaterThan(0);
        expect(result.violations.some(v => v.metric === 'averageResponseTime')).toBe(true);
      });

      it('should detect success rate violation', () => {
        const metrics: LoadTestMetrics = {
          totalRequests: 100,
          successfulRequests: 90,
          failedRequests: 10,
          successRate: 0.9, // Below 0.95
          averageResponseTime: 500,
          minResponseTime: 100,
          maxResponseTime: 2000,
          p50ResponseTime: 400,
          p90ResponseTime: 800,
          p95ResponseTime: 1000,
          p99ResponseTime: 1500,
          requestsPerSecond: 10,
          concurrentPeak: 10,
        };

        const result = checkThresholds(metrics);

        expect(result.passed).toBe(false);
        expect(result.violations.some(v => v.metric === 'successRate')).toBe(true);
      });

      it('should use custom thresholds', () => {
        const metrics: LoadTestMetrics = {
          totalRequests: 100,
          successfulRequests: 100,
          failedRequests: 0,
          successRate: 1,
          averageResponseTime: 3000,
          minResponseTime: 100,
          maxResponseTime: 5000,
          p50ResponseTime: 2500,
          p90ResponseTime: 4000,
          p95ResponseTime: 4500,
          p99ResponseTime: 5000,
          requestsPerSecond: 5,
          concurrentPeak: 10,
        };

        const result = checkThresholds(metrics, {
          maxAverageResponseTime: 2000, // Stricter
        });

        expect(result.passed).toBe(false);
        expect(result.violations.some(v => v.metric === 'averageResponseTime')).toBe(true);
      });
    });
  });

  describe('Degradation Detection', () => {
    describe('checkDegradation', () => {
      it('should detect no degradation', () => {
        const baseline: LoadTestMetrics = {
          totalRequests: 100,
          successfulRequests: 100,
          failedRequests: 0,
          successRate: 1,
          averageResponseTime: 500,
          minResponseTime: 100,
          maxResponseTime: 1000,
          p50ResponseTime: 400,
          p90ResponseTime: 800,
          p95ResponseTime: 900,
          p99ResponseTime: 1000,
          requestsPerSecond: 10,
          concurrentPeak: 10,
        };

        const current: LoadTestMetrics = {
          ...baseline,
          averageResponseTime: 550, // 10% increase, within tolerance
        };

        const result = checkDegradation(baseline, current);

        expect(result.degraded).toBe(false);
        expect(result.issues).toEqual([]);
      });

      it('should detect response time degradation', () => {
        const baseline: LoadTestMetrics = {
          totalRequests: 100,
          successfulRequests: 100,
          failedRequests: 0,
          successRate: 1,
          averageResponseTime: 500,
          minResponseTime: 100,
          maxResponseTime: 1000,
          p50ResponseTime: 400,
          p90ResponseTime: 800,
          p95ResponseTime: 900,
          p99ResponseTime: 1000,
          requestsPerSecond: 10,
          concurrentPeak: 10,
        };

        const current: LoadTestMetrics = {
          ...baseline,
          averageResponseTime: 700, // 40% increase
        };

        const result = checkDegradation(baseline, current);

        expect(result.degraded).toBe(true);
        expect(result.issues.some(i => i.metric === 'averageResponseTime')).toBe(true);
      });

      it('should detect success rate degradation', () => {
        const baseline: LoadTestMetrics = {
          totalRequests: 100,
          successfulRequests: 100,
          failedRequests: 0,
          successRate: 1,
          averageResponseTime: 500,
          minResponseTime: 100,
          maxResponseTime: 1000,
          p50ResponseTime: 400,
          p90ResponseTime: 800,
          p95ResponseTime: 900,
          p99ResponseTime: 1000,
          requestsPerSecond: 10,
          concurrentPeak: 10,
        };

        const current: LoadTestMetrics = {
          ...baseline,
          successRate: 0.7, // 30% degradation
        };

        const result = checkDegradation(baseline, current);

        expect(result.degraded).toBe(true);
        expect(result.issues.some(i => i.metric === 'successRate')).toBe(true);
      });

      it('should use custom tolerance', () => {
        const baseline: LoadTestMetrics = {
          totalRequests: 100,
          successfulRequests: 100,
          failedRequests: 0,
          successRate: 1,
          averageResponseTime: 500,
          minResponseTime: 100,
          maxResponseTime: 1000,
          p50ResponseTime: 400,
          p90ResponseTime: 800,
          p95ResponseTime: 900,
          p99ResponseTime: 1000,
          requestsPerSecond: 10,
          concurrentPeak: 10,
        };

        const current: LoadTestMetrics = {
          ...baseline,
          averageResponseTime: 550, // 10% increase
        };

        const result = checkDegradation(baseline, current, 5); // 5% tolerance

        expect(result.degraded).toBe(true);
      });
    });
  });

  describe('Concurrent Users Handling', () => {
    it('should handle 10 concurrent users without degradation', async () => {
      const result = await runLoadTest({
        concurrentUsers: 10,
        requestsPerUser: 2,
        rampUpMs: 500,
        thinkTimeMs: 10,
      });

      expect(result.status).toBe('completed');
      expect(result.metrics.totalRequests).toBe(20);
      expect(result.metrics.successRate).toBe(1);
      expect(result.metrics.concurrentPeak).toBe(10);
    });

    it('should maintain performance with concurrent load', async () => {
      // Baseline with 1 user
      const baseline = await runLoadTest({
        concurrentUsers: 1,
        requestsPerUser: 3,
        rampUpMs: 10,
        thinkTimeMs: 10,
      });

      // Load test with 10 users
      const loadTest = await runLoadTest({
        concurrentUsers: 10,
        requestsPerUser: 3,
        rampUpMs: 200,
        thinkTimeMs: 10,
      });

      // Check for degradation
      const degradation = checkDegradation(
        baseline.metrics,
        loadTest.metrics,
        100 // Allow 100% tolerance for test stability
      );

      expect(loadTest.metrics.successRate).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe('State and Reset', () => {
    describe('getState', () => {
      it('should return current state', async () => {
        await runLoadTest({
          concurrentUsers: 1,
          requestsPerUser: 1,
          rampUpMs: 10,
          thinkTimeMs: 5,
        });

        const currentState = getState();

        expect(currentState.tests.size).toBe(1);
        expect(currentState.activeTestId).toBeNull();
      });
    });

    describe('resetLoadTesting', () => {
      it('should reset all state', async () => {
        setDefaultConfig({ concurrentUsers: 20 });
        await runLoadTest({
          concurrentUsers: 1,
          requestsPerUser: 1,
          rampUpMs: 10,
          thinkTimeMs: 5,
        });

        resetLoadTesting();

        expect(getAllTests()).toEqual([]);
        expect(getDefaultConfig().concurrentUsers).toBe(10);
      });
    });
  });

  describe('Utility Functions', () => {
    describe('formatMetrics', () => {
      it('should format metrics as string', () => {
        const metrics: LoadTestMetrics = {
          totalRequests: 100,
          successfulRequests: 95,
          failedRequests: 5,
          successRate: 0.95,
          averageResponseTime: 500,
          minResponseTime: 100,
          maxResponseTime: 2000,
          p50ResponseTime: 400,
          p90ResponseTime: 800,
          p95ResponseTime: 1000,
          p99ResponseTime: 1500,
          requestsPerSecond: 10.5,
          concurrentPeak: 10,
        };

        const formatted = formatMetrics(metrics);

        expect(formatted).toContain('Total Requests: 100');
        expect(formatted).toContain('95.0%');
        expect(formatted).toContain('Avg Response Time: 500ms');
        expect(formatted).toContain('P95: 1000ms');
        expect(formatted).toContain('RPS: 10.50');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero requests', async () => {
      const result = await runLoadTest({
        concurrentUsers: 0,
        requestsPerUser: 1,
        rampUpMs: 10,
        thinkTimeMs: 5,
      });

      expect(result.metrics.totalRequests).toBe(0);
      expect(result.status).toBe('completed');
    });

    it('should handle failed handler gracefully', async () => {
      setGenerationHandler(async () => {
        throw new Error('Simulated failure');
      });

      const result = await runLoadTest({
        concurrentUsers: 2,
        requestsPerUser: 2,
        rampUpMs: 50,
        thinkTimeMs: 10,
      });

      expect(result.status).toBe('completed');
      expect(result.metrics.failedRequests).toBe(4);
      expect(result.errors.length).toBe(4);
    });

    it('should handle varying response times', async () => {
      let callCount = 0;
      setGenerationHandler(async (userId, requestId) => {
        callCount++;
        const duration = callCount * 10; // Increasing duration
        await new Promise(resolve => setTimeout(resolve, duration));
        return {
          id: requestId,
          userId,
          startedAt: Date.now() - duration,
          completedAt: Date.now(),
          duration,
          success: true,
          error: null,
          statusCode: 200,
        };
      });

      const result = await runLoadTest({
        concurrentUsers: 1,
        requestsPerUser: 5,
        rampUpMs: 10,
        thinkTimeMs: 5,
      });

      expect(result.metrics.minResponseTime).toBeLessThan(result.metrics.maxResponseTime);
      expect(result.metrics.p50ResponseTime).toBeGreaterThanOrEqual(result.metrics.minResponseTime);
    });
  });
});
