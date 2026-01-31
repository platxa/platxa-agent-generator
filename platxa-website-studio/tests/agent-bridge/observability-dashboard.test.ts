import { describe, it, expect } from "vitest";
import {
  DEFAULT_DASHBOARD_CONFIG,
  createDashboardState,
  recordGeneration,
  computeMetrics,
  getRecordsByRange,
  getRecordsByModel,
  getErrors,
  getRecentRecords,
  computeWindowMetrics,
  formatDuration,
  formatCost,
  createBar,
  createQualityBar,
  createLatencyBar,
  renderDashboard,
  formatDashboard,
  computeLatencyTrend,
  computeQualityTrend,
  computeCostTrend,
  formatTrendSparkline,
  createDashboardSummary,
} from "@/lib/agent-bridge/observability-dashboard";
import type { GenerationRecord, DashboardMetrics } from "@/lib/agent-bridge/observability-dashboard";

const now = 1000000;

function makeRecord(overrides: Partial<Omit<GenerationRecord, "id">> = {}): Omit<GenerationRecord, "id"> {
  return {
    timestamp: now,
    durationMs: 2000,
    qualityScore: 85,
    promptTokens: 1000,
    completionTokens: 500,
    cost: 0.018,
    success: true,
    model: "claude-sonnet",
    taskType: "code_generation",
    ...overrides,
  };
}

describe("Observability Dashboard", () => {
  describe("DEFAULT_DASHBOARD_CONFIG", () => {
    it("has expected quality thresholds", () => {
      expect(DEFAULT_DASHBOARD_CONFIG.qualityThresholds.excellent).toBe(90);
      expect(DEFAULT_DASHBOARD_CONFIG.qualityThresholds.good).toBe(70);
      expect(DEFAULT_DASHBOARD_CONFIG.qualityThresholds.fair).toBe(50);
    });
  });

  describe("createDashboardState", () => {
    it("creates empty state", () => {
      const state = createDashboardState();
      expect(state.records).toHaveLength(0);
      expect(state.counter).toBe(0);
    });
  });

  describe("recordGeneration", () => {
    it("adds record with ID", () => {
      const state = recordGeneration(createDashboardState(), makeRecord());
      expect(state.records).toHaveLength(1);
      expect(state.records[0].id).toBe("gen_1");
    });

    it("assigns unique IDs", () => {
      let state = createDashboardState();
      state = recordGeneration(state, makeRecord());
      state = recordGeneration(state, makeRecord());
      expect(state.records[0].id).not.toBe(state.records[1].id);
    });

    it("does not mutate input", () => {
      const original = createDashboardState();
      recordGeneration(original, makeRecord());
      expect(original.records).toHaveLength(0);
    });

    it("trims records beyond maxRecords", () => {
      let state = createDashboardState({ maxRecords: 3 });
      for (let i = 0; i < 5; i++) {
        state = recordGeneration(state, makeRecord({ timestamp: now + i }));
      }
      expect(state.records).toHaveLength(3);
      expect(state.records[0].timestamp).toBe(now + 2);
    });
  });

  describe("computeMetrics", () => {
    it("returns zeros for empty state", () => {
      const m = computeMetrics(createDashboardState());
      expect(m.totalGenerations).toBe(0);
      expect(m.errorRate).toBe(0);
      expect(m.avgLatencyMs).toBe(0);
    });

    it("computes avg generation time", () => {
      let state = createDashboardState();
      state = recordGeneration(state, makeRecord({ durationMs: 1000 }));
      state = recordGeneration(state, makeRecord({ durationMs: 3000 }));
      expect(computeMetrics(state).avgLatencyMs).toBe(2000);
    });

    it("computes quality score distribution", () => {
      let state = createDashboardState();
      state = recordGeneration(state, makeRecord({ qualityScore: 95 })); // excellent
      state = recordGeneration(state, makeRecord({ qualityScore: 80 })); // good
      state = recordGeneration(state, makeRecord({ qualityScore: 55 })); // fair
      state = recordGeneration(state, makeRecord({ qualityScore: 30 })); // poor
      const dist = computeMetrics(state).qualityDistribution;
      expect(dist.excellent).toBe(1);
      expect(dist.good).toBe(1);
      expect(dist.fair).toBe(1);
      expect(dist.poor).toBe(1);
    });

    it("computes cost per generation", () => {
      let state = createDashboardState();
      state = recordGeneration(state, makeRecord({ cost: 0.01 }));
      state = recordGeneration(state, makeRecord({ cost: 0.03 }));
      const m = computeMetrics(state);
      expect(m.totalCost).toBeCloseTo(0.04, 4);
      expect(m.avgCostPerGeneration).toBeCloseTo(0.02, 4);
    });

    it("computes error rate", () => {
      let state = createDashboardState();
      state = recordGeneration(state, makeRecord({ success: true }));
      state = recordGeneration(state, makeRecord({ success: false, error: "timeout" }));
      state = recordGeneration(state, makeRecord({ success: true }));
      state = recordGeneration(state, makeRecord({ success: false, error: "bad output" }));
      const m = computeMetrics(state);
      expect(m.errorRate).toBe(0.5);
      expect(m.errorCount).toBe(2);
    });

    it("computes p50 and p95 latency", () => {
      let state = createDashboardState();
      for (let i = 1; i <= 20; i++) {
        state = recordGeneration(state, makeRecord({ durationMs: i * 100 }));
      }
      const m = computeMetrics(state);
      expect(m.p50LatencyMs).toBeGreaterThanOrEqual(900);
      expect(m.p95LatencyMs).toBeGreaterThanOrEqual(1800);
    });

    it("computes cost by model", () => {
      let state = createDashboardState();
      state = recordGeneration(state, makeRecord({ model: "opus", cost: 0.05 }));
      state = recordGeneration(state, makeRecord({ model: "opus", cost: 0.03 }));
      state = recordGeneration(state, makeRecord({ model: "sonnet", cost: 0.01 }));
      const m = computeMetrics(state);
      expect(m.costByModel["opus"]).toBeCloseTo(0.08, 4);
      expect(m.costByModel["sonnet"]).toBeCloseTo(0.01, 4);
    });

    it("computes count by task type", () => {
      let state = createDashboardState();
      state = recordGeneration(state, makeRecord({ taskType: "planning" }));
      state = recordGeneration(state, makeRecord({ taskType: "planning" }));
      state = recordGeneration(state, makeRecord({ taskType: "review" }));
      const m = computeMetrics(state);
      expect(m.countByTaskType["planning"]).toBe(2);
      expect(m.countByTaskType["review"]).toBe(1);
    });

    it("computes total tokens", () => {
      let state = createDashboardState();
      state = recordGeneration(state, makeRecord({ promptTokens: 1000, completionTokens: 500 }));
      state = recordGeneration(state, makeRecord({ promptTokens: 2000, completionTokens: 800 }));
      expect(computeMetrics(state).totalTokens).toBe(4300);
    });
  });

  describe("queries", () => {
    it("getRecordsByRange filters by time", () => {
      let state = createDashboardState();
      state = recordGeneration(state, makeRecord({ timestamp: 1000 }));
      state = recordGeneration(state, makeRecord({ timestamp: 5000 }));
      state = recordGeneration(state, makeRecord({ timestamp: 9000 }));
      expect(getRecordsByRange(state, 2000, 6000)).toHaveLength(1);
    });

    it("getRecordsByModel filters by model", () => {
      let state = createDashboardState();
      state = recordGeneration(state, makeRecord({ model: "opus" }));
      state = recordGeneration(state, makeRecord({ model: "sonnet" }));
      expect(getRecordsByModel(state, "opus")).toHaveLength(1);
    });

    it("getErrors returns failed records", () => {
      let state = createDashboardState();
      state = recordGeneration(state, makeRecord({ success: true }));
      state = recordGeneration(state, makeRecord({ success: false, error: "fail" }));
      const errors = getErrors(state);
      expect(errors).toHaveLength(1);
      expect(errors[0].error).toBe("fail");
    });

    it("getRecentRecords returns last N", () => {
      let state = createDashboardState();
      for (let i = 0; i < 10; i++) {
        state = recordGeneration(state, makeRecord({ timestamp: now + i }));
      }
      const recent = getRecentRecords(state, 3);
      expect(recent).toHaveLength(3);
      expect(recent[0].timestamp).toBe(now + 7);
    });

    it("computeWindowMetrics computes for time range", () => {
      let state = createDashboardState();
      state = recordGeneration(state, makeRecord({ timestamp: 1000, qualityScore: 60 }));
      state = recordGeneration(state, makeRecord({ timestamp: 5000, qualityScore: 90 }));
      state = recordGeneration(state, makeRecord({ timestamp: 9000, qualityScore: 80 }));
      const m = computeWindowMetrics(state, 4000, 10000);
      expect(m.totalGenerations).toBe(2);
      expect(m.avgQualityScore).toBe(85);
    });
  });

  // ===========================================================================
  // Dashboard Rendering (Feature #189)
  // ===========================================================================

  describe("formatDuration", () => {
    it("formats milliseconds", () => {
      expect(formatDuration(500)).toBe("500ms");
    });

    it("formats seconds", () => {
      expect(formatDuration(2500)).toBe("2.50s");
    });

    it("formats minutes", () => {
      expect(formatDuration(90000)).toBe("1.50m");
    });
  });

  describe("formatCost", () => {
    it("formats small costs as cents", () => {
      expect(formatCost(0.005)).toContain("¢");
    });

    it("formats medium costs", () => {
      expect(formatCost(0.05)).toBe("$0.0500");
    });

    it("formats large costs", () => {
      expect(formatCost(1.50)).toBe("$1.50");
    });
  });

  describe("createBar", () => {
    it("creates full bar at max value", () => {
      const bar = createBar(100, 100, 10);
      expect(bar).toBe("██████████");
    });

    it("creates empty bar at zero", () => {
      const bar = createBar(0, 100, 10);
      expect(bar).toBe("░░░░░░░░░░");
    });

    it("creates half bar at 50%", () => {
      const bar = createBar(50, 100, 10);
      expect(bar).toBe("█████░░░░░");
    });
  });

  describe("createQualityBar", () => {
    it("creates bar from quality distribution", () => {
      const dist = { excellent: 5, good: 3, fair: 1, poor: 1 };
      const bar = createQualityBar(dist);
      expect(bar).toContain("🟢"); // Excellent
      expect(bar).toContain("🟡"); // Good
    });

    it("handles empty distribution", () => {
      const dist = { excellent: 0, good: 0, fair: 0, poor: 0 };
      const bar = createQualityBar(dist);
      expect(bar).toBe("░░░░░░░░░░░░░░░░░░░░");
    });
  });

  describe("createLatencyBar", () => {
    it("creates bar relative to target", () => {
      const bar = createLatencyBar(2500, 5000);
      expect(bar.length).toBe(20);
    });
  });

  describe("renderDashboard", () => {
    it("renders dashboard view from metrics", () => {
      let state = createDashboardState();
      state = recordGeneration(state, makeRecord({ durationMs: 2000, qualityScore: 85, cost: 0.02 }));
      state = recordGeneration(state, makeRecord({ durationMs: 3000, qualityScore: 75, cost: 0.03 }));
      const metrics = computeMetrics(state);

      const view = renderDashboard(metrics, "Test Dashboard", "Last Hour");

      expect(view.title).toBe("Test Dashboard");
      expect(view.timeRange).toBe("Last Hour");
      expect(view.latency.avg).toBe("2.50s");
      expect(view.quality.avg).toBe("80.0");
      expect(view.summary.totalGenerations).toBe("2");
    });

    it("includes cost by model", () => {
      let state = createDashboardState();
      state = recordGeneration(state, makeRecord({ model: "opus", cost: 0.05 }));
      state = recordGeneration(state, makeRecord({ model: "sonnet", cost: 0.01 }));
      const metrics = computeMetrics(state);

      const view = renderDashboard(metrics);

      expect(view.cost.byModel.length).toBe(2);
      expect(view.cost.byModel[0]).toContain("opus");
    });
  });

  describe("formatDashboard", () => {
    it("formats dashboard as string with borders", () => {
      let state = createDashboardState();
      state = recordGeneration(state, makeRecord());
      const metrics = computeMetrics(state);
      const view = renderDashboard(metrics);

      const formatted = formatDashboard(view);

      expect(formatted).toContain("╔");
      expect(formatted).toContain("╚");
      expect(formatted).toContain("LATENCY");
      expect(formatted).toContain("QUALITY");
      expect(formatted).toContain("COST");
      expect(formatted).toContain("SUMMARY");
    });
  });

  describe("computeLatencyTrend", () => {
    it("computes latency trend over buckets", () => {
      let state = createDashboardState();
      for (let i = 0; i < 10; i++) {
        state = recordGeneration(state, makeRecord({
          timestamp: now + i * 1000,
          durationMs: 100 + i * 10, // Use small durations to get "ms" format
        }));
      }

      const trend = computeLatencyTrend(state, 5);

      expect(trend.length).toBeGreaterThan(0);
      expect(trend[0].value).toBeGreaterThan(0);
      expect(trend[0].label).toContain("ms");
    });

    it("returns empty for no records", () => {
      const state = createDashboardState();
      const trend = computeLatencyTrend(state);
      expect(trend).toHaveLength(0);
    });
  });

  describe("computeQualityTrend", () => {
    it("computes quality trend over buckets", () => {
      let state = createDashboardState();
      for (let i = 0; i < 10; i++) {
        state = recordGeneration(state, makeRecord({
          timestamp: now + i * 1000,
          qualityScore: 70 + i * 2,
        }));
      }

      const trend = computeQualityTrend(state, 5);

      expect(trend.length).toBeGreaterThan(0);
      expect(trend[0].value).toBeGreaterThanOrEqual(70);
    });
  });

  describe("computeCostTrend", () => {
    it("computes cumulative cost per bucket", () => {
      let state = createDashboardState();
      for (let i = 0; i < 10; i++) {
        state = recordGeneration(state, makeRecord({
          timestamp: now + i * 1000,
          cost: 0.01,
        }));
      }

      const trend = computeCostTrend(state, 5);

      expect(trend.length).toBe(5);
      const totalCost = trend.reduce((sum, t) => sum + t.value, 0);
      expect(totalCost).toBeCloseTo(0.1, 2);
    });
  });

  describe("formatTrendSparkline", () => {
    it("creates sparkline from trend", () => {
      const trend = [
        { timestamp: 0, value: 10, label: "10" },
        { timestamp: 1, value: 50, label: "50" },
        { timestamp: 2, value: 30, label: "30" },
        { timestamp: 3, value: 90, label: "90" },
      ];

      const sparkline = formatTrendSparkline(trend);

      expect(sparkline.length).toBe(4);
      expect(sparkline).toMatch(/[▁▂▃▄▅▆▇█]+/);
    });

    it("returns dashes for empty trend", () => {
      const sparkline = formatTrendSparkline([], 10);
      expect(sparkline).toBe("──────────");
    });
  });

  describe("createDashboardSummary", () => {
    it("creates complete dashboard summary", () => {
      let state = createDashboardState();
      for (let i = 0; i < 5; i++) {
        state = recordGeneration(state, makeRecord({
          timestamp: now + i * 1000,
          durationMs: 2000 + i * 100,
          qualityScore: 80 + i,
          cost: 0.02,
        }));
      }

      const summary = createDashboardSummary(state);

      expect(summary).toContain("LATENCY");
      expect(summary).toContain("QUALITY");
      expect(summary).toContain("COST");
      expect(summary).toContain("TRENDS");
      expect(summary).toContain("Latency:");
      expect(summary).toContain("Quality:");
      expect(summary).toContain("Cost:");
    });
  });
});
