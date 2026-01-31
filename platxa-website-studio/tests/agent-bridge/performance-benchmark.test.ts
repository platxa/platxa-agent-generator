/**
 * Performance Benchmark Tests (Feature #187)
 *
 * Tests for: generation time, preview latency, tool execution time benchmarks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeStats,
  percentile,
  runBenchmark,
  runBenchmarkSuite,
  compareBenchmarks,
  createGenerationBenchmark,
  createPreviewBenchmark,
  createToolExecutionBenchmark,
  formatBenchmarkResult,
  formatBenchmarkSuite,
  formatComparison,
  createBenchmarkState,
  setBaseline,
  getBaseline,
  addToHistory,
  getPerformanceTrend,
  DEFAULT_BENCHMARK_CONFIG,
  type BenchmarkResult,
  type BenchmarkSuite,
  type BenchmarkState,
} from '@/lib/agent-bridge/performance-benchmark';

describe('Performance Benchmark (Feature #187)', () => {
  // ===========================================================================
  // Statistical Functions
  // ===========================================================================

  describe('computeStats', () => {
    it('computes stats for sample data', () => {
      const samples = [10, 20, 30, 40, 50];
      const stats = computeStats(samples);

      expect(stats.min).toBe(10);
      expect(stats.max).toBe(50);
      expect(stats.avg).toBe(30);
      expect(stats.p50).toBe(30);
      expect(stats.stdDev).toBeCloseTo(14.14, 1);
      expect(stats.opsPerSec).toBeCloseTo(33.33, 1);
    });

    it('handles single sample', () => {
      const stats = computeStats([100]);

      expect(stats.min).toBe(100);
      expect(stats.max).toBe(100);
      expect(stats.avg).toBe(100);
      expect(stats.p50).toBe(100);
      expect(stats.p95).toBe(100);
      expect(stats.p99).toBe(100);
      expect(stats.stdDev).toBe(0);
    });

    it('handles empty array', () => {
      const stats = computeStats([]);

      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.avg).toBe(0);
      expect(stats.opsPerSec).toBe(0);
    });

    it('computes percentiles correctly', () => {
      // 100 samples from 1 to 100
      const samples = Array.from({ length: 100 }, (_, i) => i + 1);
      const stats = computeStats(samples);

      expect(stats.p50).toBeCloseTo(50.5, 0);
      expect(stats.p95).toBeCloseTo(95.05, 0);
      expect(stats.p99).toBeCloseTo(99.01, 0);
    });
  });

  describe('percentile', () => {
    it('computes p50 (median)', () => {
      expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    });

    it('interpolates between values', () => {
      const result = percentile([10, 20, 30, 40], 50);
      expect(result).toBe(25); // Midpoint between 20 and 30
    });

    it('handles empty array', () => {
      expect(percentile([], 50)).toBe(0);
    });

    it('handles single element', () => {
      expect(percentile([42], 95)).toBe(42);
    });
  });

  // ===========================================================================
  // Benchmark Runner
  // ===========================================================================

  describe('runBenchmark', () => {
    it('runs benchmark with default config', async () => {
      let callCount = 0;
      const fn = () => {
        callCount++;
      };

      const result = await runBenchmark('test-bench', 'generation', fn, {
        warmupIterations: 2,
        iterations: 5,
      });

      // 2 warmup + 5 measured = 7 total calls
      expect(callCount).toBe(7);
      expect(result.name).toBe('test-bench');
      expect(result.category).toBe('generation');
      expect(result.iterations).toBe(5);
      expect(result.samples).toHaveLength(5);
      expect(result.stats.avg).toBeGreaterThanOrEqual(0);
      expect(result.completedAt).toBeGreaterThan(0);
    });

    it('measures async function timing', async () => {
      const delay = 10;
      const fn = async () => {
        await new Promise((resolve) => setTimeout(resolve, delay));
      };

      const result = await runBenchmark('async-bench', 'preview', fn, {
        warmupIterations: 1,
        iterations: 3,
      });

      // Each sample should be at least the delay time
      for (const sample of result.samples) {
        expect(sample).toBeGreaterThanOrEqual(delay - 2); // Allow small variance
      }
    });

    it('includes metadata in result', async () => {
      const result = await runBenchmark(
        'meta-bench',
        'tool_execution',
        () => {},
        { warmupIterations: 0, iterations: 1 },
        { toolName: 'read_file', inputSize: 1024 }
      );

      expect(result.metadata).toEqual({
        toolName: 'read_file',
        inputSize: 1024,
      });
    });

    it('handles synchronous functions', async () => {
      let sum = 0;
      const fn = () => {
        for (let i = 0; i < 1000; i++) sum += i;
      };

      const result = await runBenchmark('sync-bench', 'generation', fn, {
        warmupIterations: 1,
        iterations: 3,
      });

      expect(result.samples).toHaveLength(3);
      expect(result.stats.avg).toBeGreaterThanOrEqual(0);
    });
  });

  // ===========================================================================
  // Benchmark Suite
  // ===========================================================================

  describe('runBenchmarkSuite', () => {
    it('runs multiple benchmarks', async () => {
      const suite = await runBenchmarkSuite(
        'Test Suite',
        'Testing multiple benchmarks',
        [
          { name: 'bench-1', category: 'generation', fn: () => {} },
          { name: 'bench-2', category: 'preview', fn: () => {} },
          { name: 'bench-3', category: 'tool_execution', fn: () => {} },
        ]
      );

      expect(suite.name).toBe('Test Suite');
      expect(suite.description).toBe('Testing multiple benchmarks');
      expect(suite.results).toHaveLength(3);
      expect(suite.results[0].name).toBe('bench-1');
      expect(suite.results[1].name).toBe('bench-2');
      expect(suite.results[2].name).toBe('bench-3');
      expect(suite.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(suite.startedAt).toBeLessThanOrEqual(suite.completedAt);
    });

    it('respects per-benchmark config', async () => {
      const suite = await runBenchmarkSuite('Config Suite', 'Testing config', [
        {
          name: 'few-iterations',
          category: 'generation',
          fn: () => {},
          config: { warmupIterations: 0, iterations: 2 },
        },
        {
          name: 'more-iterations',
          category: 'generation',
          fn: () => {},
          config: { warmupIterations: 0, iterations: 5 },
        },
      ]);

      expect(suite.results[0].iterations).toBe(2);
      expect(suite.results[1].iterations).toBe(5);
    });
  });

  // ===========================================================================
  // Benchmark Comparison
  // ===========================================================================

  describe('compareBenchmarks', () => {
    const createMockResult = (avgMs: number, p95Ms: number): BenchmarkResult => ({
      name: 'test',
      category: 'generation',
      iterations: 10,
      samples: [avgMs],
      stats: {
        min: avgMs * 0.8,
        max: avgMs * 1.2,
        avg: avgMs,
        p50: avgMs,
        p95: p95Ms,
        p99: p95Ms * 1.1,
        stdDev: avgMs * 0.1,
        opsPerSec: 1000 / avgMs,
      },
      completedAt: Date.now(),
    });

    it('detects performance regression', () => {
      const baseline = createMockResult(100, 120);
      const current = createMockResult(150, 180);

      const comparison = compareBenchmarks(baseline, current, 10);

      expect(comparison.avgDiffMs).toBe(50);
      expect(comparison.avgDiffPercent).toBe(50);
      expect(comparison.p95DiffMs).toBe(60);
      expect(comparison.acceptable).toBe(false);
    });

    it('detects performance improvement', () => {
      const baseline = createMockResult(100, 120);
      const current = createMockResult(80, 95);

      const comparison = compareBenchmarks(baseline, current, 10);

      expect(comparison.avgDiffMs).toBe(-20);
      expect(comparison.avgDiffPercent).toBe(-20);
      expect(comparison.acceptable).toBe(true); // Faster is always acceptable
    });

    it('passes within threshold', () => {
      const baseline = createMockResult(100, 120);
      const current = createMockResult(105, 125);

      const comparison = compareBenchmarks(baseline, current, 10);

      expect(comparison.avgDiffPercent).toBe(5);
      expect(comparison.acceptable).toBe(true);
    });

    it('uses custom threshold', () => {
      const baseline = createMockResult(100, 120);
      const current = createMockResult(103, 123);

      const strictComparison = compareBenchmarks(baseline, current, 2);
      const lenientComparison = compareBenchmarks(baseline, current, 5);

      expect(strictComparison.acceptable).toBe(false);
      expect(lenientComparison.acceptable).toBe(true);
    });
  });

  // ===========================================================================
  // Benchmark Helpers
  // ===========================================================================

  describe('createGenerationBenchmark', () => {
    it('creates generation benchmark definition', async () => {
      const generateFn = vi.fn().mockResolvedValue({
        promptTokens: 100,
        completionTokens: 200,
      });

      const def = createGenerationBenchmark('gen-test', generateFn, {
        warmupIterations: 0,
        iterations: 1,
      });

      expect(def.name).toBe('gen-test');
      expect(def.category).toBe('generation');

      // Run the function to populate metadata
      await def.fn();
      expect(generateFn).toHaveBeenCalled();
    });
  });

  describe('createPreviewBenchmark', () => {
    it('creates preview latency benchmark', () => {
      const previewFn = vi.fn().mockResolvedValue(undefined);

      const def = createPreviewBenchmark('preview-test', previewFn, 'hot_reload');

      expect(def.name).toBe('preview-test');
      expect(def.category).toBe('preview');
      expect(def.metadata).toEqual({ previewType: 'hot_reload' });
    });
  });

  describe('createToolExecutionBenchmark', () => {
    it('creates tool execution benchmark', () => {
      const executeFn = vi.fn().mockResolvedValue(undefined);

      const def = createToolExecutionBenchmark('tool-test', 'write_file', executeFn);

      expect(def.name).toBe('tool-test');
      expect(def.category).toBe('tool_execution');
      expect(def.metadata).toEqual({ toolName: 'write_file' });
    });
  });

  // ===========================================================================
  // Formatting
  // ===========================================================================

  describe('formatBenchmarkResult', () => {
    it('formats result as readable string', () => {
      const result: BenchmarkResult = {
        name: 'Format Test',
        category: 'generation',
        iterations: 10,
        samples: [10, 20, 30],
        stats: {
          min: 10,
          max: 30,
          avg: 20,
          p50: 20,
          p95: 28,
          p99: 29,
          stdDev: 8.16,
          opsPerSec: 50,
        },
        completedAt: Date.now(),
      };

      const formatted = formatBenchmarkResult(result);

      expect(formatted).toContain('Format Test');
      expect(formatted).toContain('generation');
      expect(formatted).toContain('Iterations: 10');
      expect(formatted).toContain('Avg: 20.00ms');
      expect(formatted).toContain('p95: 28.00ms');
    });
  });

  describe('formatBenchmarkSuite', () => {
    it('formats suite with all results', () => {
      const suite: BenchmarkSuite = {
        name: 'Test Suite',
        description: 'Suite description',
        results: [
          {
            name: 'Bench 1',
            category: 'generation',
            iterations: 5,
            samples: [10],
            stats: computeStats([10, 12, 11, 10, 11]),
            completedAt: Date.now(),
          },
        ],
        totalDurationMs: 1000,
        startedAt: Date.now() - 1000,
        completedAt: Date.now(),
      };

      const formatted = formatBenchmarkSuite(suite);

      expect(formatted).toContain('Test Suite');
      expect(formatted).toContain('Suite description');
      expect(formatted).toContain('Total Duration: 1000ms');
      expect(formatted).toContain('Bench 1');
    });
  });

  describe('formatComparison', () => {
    it('formats regression comparison', () => {
      const baseline: BenchmarkResult = {
        name: 'Test',
        category: 'generation',
        iterations: 10,
        samples: [100],
        stats: { min: 90, max: 110, avg: 100, p50: 100, p95: 105, p99: 108, stdDev: 5, opsPerSec: 10 },
        completedAt: Date.now(),
      };
      const current: BenchmarkResult = {
        ...baseline,
        stats: { ...baseline.stats, avg: 150, p95: 160 },
      };

      const comparison = compareBenchmarks(baseline, current, 10);
      const formatted = formatComparison(comparison);

      expect(formatted).toContain('Test');
      expect(formatted).toContain('Baseline avg: 100.00ms');
      expect(formatted).toContain('Current avg: 150.00ms');
      expect(formatted).toContain('+50.00ms');
      expect(formatted).toContain('slower');
      expect(formatted).toContain('FAIL');
    });

    it('formats improvement comparison', () => {
      const baseline: BenchmarkResult = {
        name: 'Test',
        category: 'generation',
        iterations: 10,
        samples: [100],
        stats: { min: 90, max: 110, avg: 100, p50: 100, p95: 105, p99: 108, stdDev: 5, opsPerSec: 10 },
        completedAt: Date.now(),
      };
      const current: BenchmarkResult = {
        ...baseline,
        stats: { ...baseline.stats, avg: 80, p95: 85 },
      };

      const comparison = compareBenchmarks(baseline, current, 10);
      const formatted = formatComparison(comparison);

      expect(formatted).toContain('-20.00ms');
      expect(formatted).toContain('faster');
      expect(formatted).toContain('PASS');
    });
  });

  // ===========================================================================
  // State Management
  // ===========================================================================

  describe('createBenchmarkState', () => {
    it('creates initial state with default config', () => {
      const state = createBenchmarkState();

      expect(state.baselines.size).toBe(0);
      expect(state.history).toHaveLength(0);
      expect(state.config).toEqual(DEFAULT_BENCHMARK_CONFIG);
    });

    it('accepts custom config', () => {
      const state = createBenchmarkState({ iterations: 20 });

      expect(state.config.iterations).toBe(20);
      expect(state.config.warmupIterations).toBe(DEFAULT_BENCHMARK_CONFIG.warmupIterations);
    });
  });

  describe('setBaseline / getBaseline', () => {
    it('stores and retrieves baseline', () => {
      let state = createBenchmarkState();
      const result: BenchmarkResult = {
        name: 'baseline-test',
        category: 'generation',
        iterations: 10,
        samples: [100],
        stats: computeStats([100]),
        completedAt: Date.now(),
      };

      state = setBaseline(state, result);
      const retrieved = getBaseline(state, 'baseline-test');

      expect(retrieved).toEqual(result);
    });

    it('returns undefined for missing baseline', () => {
      const state = createBenchmarkState();

      expect(getBaseline(state, 'nonexistent')).toBeUndefined();
    });

    it('overwrites existing baseline', () => {
      let state = createBenchmarkState();
      const result1: BenchmarkResult = {
        name: 'test',
        category: 'generation',
        iterations: 10,
        samples: [100],
        stats: computeStats([100]),
        completedAt: Date.now(),
      };
      const result2: BenchmarkResult = {
        ...result1,
        stats: computeStats([200]),
      };

      state = setBaseline(state, result1);
      state = setBaseline(state, result2);

      expect(getBaseline(state, 'test')?.stats.avg).toBe(200);
    });
  });

  describe('addToHistory', () => {
    it('adds suite to history', () => {
      let state = createBenchmarkState();
      const suite: BenchmarkSuite = {
        name: 'Suite 1',
        description: 'Test',
        results: [],
        totalDurationMs: 100,
        startedAt: Date.now(),
        completedAt: Date.now(),
      };

      state = addToHistory(state, suite);

      expect(state.history).toHaveLength(1);
      expect(state.history[0].name).toBe('Suite 1');
    });
  });

  describe('getPerformanceTrend', () => {
    it('extracts trend data from history', () => {
      let state = createBenchmarkState();
      const now = Date.now();

      // Add 3 suites with the same benchmark
      for (let i = 0; i < 3; i++) {
        const suite: BenchmarkSuite = {
          name: `Suite ${i}`,
          description: 'Test',
          results: [
            {
              name: 'trending-bench',
              category: 'generation',
              iterations: 10,
              samples: [100 + i * 10],
              stats: computeStats([100 + i * 10]),
              completedAt: now + i * 1000,
            },
          ],
          totalDurationMs: 100,
          startedAt: now + i * 1000,
          completedAt: now + i * 1000,
        };
        state = addToHistory(state, suite);
      }

      const trend = getPerformanceTrend(state, 'trending-bench');

      expect(trend).toHaveLength(3);
      expect(trend[0].avgMs).toBe(100);
      expect(trend[1].avgMs).toBe(110);
      expect(trend[2].avgMs).toBe(120);
    });

    it('respects limit parameter', () => {
      let state = createBenchmarkState();
      const now = Date.now();

      for (let i = 0; i < 20; i++) {
        const suite: BenchmarkSuite = {
          name: `Suite ${i}`,
          description: 'Test',
          results: [
            {
              name: 'bench',
              category: 'generation',
              iterations: 10,
              samples: [i],
              stats: computeStats([i]),
              completedAt: now + i,
            },
          ],
          totalDurationMs: 10,
          startedAt: now + i,
          completedAt: now + i,
        };
        state = addToHistory(state, suite);
      }

      const trend = getPerformanceTrend(state, 'bench', 5);

      expect(trend).toHaveLength(5);
      // Should get last 5 entries (15, 16, 17, 18, 19)
      expect(trend[0].avgMs).toBe(15);
      expect(trend[4].avgMs).toBe(19);
    });

    it('returns empty array for unknown benchmark', () => {
      const state = createBenchmarkState();
      const trend = getPerformanceTrend(state, 'unknown');

      expect(trend).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Integration: Full Benchmark Workflow
  // ===========================================================================

  describe('full benchmark workflow', () => {
    it('runs complete benchmark cycle', async () => {
      // 1. Create state
      let state = createBenchmarkState({ warmupIterations: 1, iterations: 3 });

      // 2. Run baseline suite
      const baselineSuite = await runBenchmarkSuite(
        'Baseline',
        'Initial measurements',
        [
          createGenerationBenchmark('page-generation', async () => {
            await new Promise((r) => setTimeout(r, 5));
            return { promptTokens: 100, completionTokens: 50 };
          }, state.config),
          createPreviewBenchmark('hot-reload', async () => {
            await new Promise((r) => setTimeout(r, 3));
          }, 'hot_reload', state.config),
          createToolExecutionBenchmark('file-write', 'write_file', async () => {
            await new Promise((r) => setTimeout(r, 2));
          }, state.config),
        ]
      );

      // 3. Store baselines
      for (const result of baselineSuite.results) {
        state = setBaseline(state, result);
      }
      state = addToHistory(state, baselineSuite);

      // 4. Run current suite
      const currentSuite = await runBenchmarkSuite(
        'Current',
        'After optimization',
        [
          createGenerationBenchmark('page-generation', async () => {
            await new Promise((r) => setTimeout(r, 4));
            return { promptTokens: 100, completionTokens: 50 };
          }, state.config),
          createPreviewBenchmark('hot-reload', async () => {
            await new Promise((r) => setTimeout(r, 2));
          }, 'hot_reload', state.config),
          createToolExecutionBenchmark('file-write', 'write_file', async () => {
            await new Promise((r) => setTimeout(r, 1));
          }, state.config),
        ]
      );
      state = addToHistory(state, currentSuite);

      // 5. Compare results
      const comparisons = currentSuite.results.map((current) => {
        const baseline = getBaseline(state, current.name);
        return baseline ? compareBenchmarks(baseline, current, 20) : null;
      }).filter(Boolean);

      // Verify workflow completed
      expect(state.baselines.size).toBe(3);
      expect(state.history).toHaveLength(2);
      expect(comparisons).toHaveLength(3);

      // Verify trend tracking
      const genTrend = getPerformanceTrend(state, 'page-generation');
      expect(genTrend).toHaveLength(2);
    });
  });
});
