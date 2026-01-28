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
} from "@/lib/agent-bridge/observability-dashboard";
import type { GenerationRecord } from "@/lib/agent-bridge/observability-dashboard";

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
});
