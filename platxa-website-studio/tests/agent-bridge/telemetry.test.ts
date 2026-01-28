import { describe, it, expect, beforeEach } from "vitest";
import {
  resetTelemetryCounter,
  createTelemetryState,
  recordEvent,
  recordGeneration,
  recordSatisfaction,
  computeAnalytics,
  getMetricsByRange,
  getEventsByType,
  serializeTelemetry,
  deserializeTelemetry,
} from "@/lib/agent-bridge/telemetry";
import type { GenerationMetrics } from "@/lib/agent-bridge/telemetry";

function makeMetrics(overrides: Partial<GenerationMetrics> = {}): Omit<GenerationMetrics, "generationId" | "sessionId"> {
  return {
    startTime: 1000,
    endTime: 2000,
    durationMs: 1000,
    tokenCount: 5000,
    promptTokens: 3000,
    completionTokens: 2000,
    qualityScore: 85,
    success: true,
    sectionCount: 5,
    odooVersion: "17.0",
    satisfaction: 0,
    ...overrides,
  };
}

describe("Telemetry", () => {
  beforeEach(() => resetTelemetryCounter());

  describe("createTelemetryState", () => {
    it("creates empty state with session ID", () => {
      const state = createTelemetryState("sess-1");
      expect(state.sessionId).toBe("sess-1");
      expect(state.events).toHaveLength(0);
      expect(state.metrics).toHaveLength(0);
    });
  });

  describe("recordEvent", () => {
    it("adds event to state", () => {
      let state = createTelemetryState("s1");
      state = recordEvent(state, "performance", { latency: 100 });
      expect(state.events).toHaveLength(1);
      expect(state.events[0].type).toBe("performance");
      expect(state.events[0].data.latency).toBe(100);
    });

    it("assigns unique IDs", () => {
      let state = createTelemetryState("s1");
      state = recordEvent(state, "performance", {});
      state = recordEvent(state, "performance", {});
      expect(state.events[0].id).not.toBe(state.events[1].id);
    });

    it("sets session ID on event", () => {
      let state = createTelemetryState("s1");
      state = recordEvent(state, "performance", {});
      expect(state.events[0].sessionId).toBe("s1");
    });

    it("does not mutate original state", () => {
      const state = createTelemetryState("s1");
      recordEvent(state, "performance", {});
      expect(state.events).toHaveLength(0);
    });
  });

  describe("recordGeneration", () => {
    it("adds metrics and events", () => {
      let state = createTelemetryState("s1");
      state = recordGeneration(state, makeMetrics());
      expect(state.metrics).toHaveLength(1);
      // generation_complete + quality_score + token_usage = 3 events
      expect(state.events).toHaveLength(3);
    });

    it("assigns generation ID", () => {
      let state = createTelemetryState("s1");
      state = recordGeneration(state, makeMetrics());
      expect(state.metrics[0].generationId).toMatch(/^gen_/);
    });

    it("sets session ID on metrics", () => {
      let state = createTelemetryState("s1");
      state = recordGeneration(state, makeMetrics());
      expect(state.metrics[0].sessionId).toBe("s1");
    });
  });

  describe("recordSatisfaction", () => {
    it("updates satisfaction on metrics", () => {
      let state = createTelemetryState("s1");
      state = recordGeneration(state, makeMetrics());
      const genId = state.metrics[0].generationId;
      state = recordSatisfaction(state, genId, 1);
      expect(state.metrics[0].satisfaction).toBe(1);
    });

    it("records satisfaction event", () => {
      let state = createTelemetryState("s1");
      state = recordGeneration(state, makeMetrics());
      const genId = state.metrics[0].generationId;
      state = recordSatisfaction(state, genId, -1);
      const satEvents = state.events.filter((e) => e.type === "user_satisfaction");
      expect(satEvents).toHaveLength(1);
      expect(satEvents[0].data.satisfaction).toBe(-1);
    });
  });

  describe("computeAnalytics", () => {
    it("returns zeros for empty state", () => {
      const state = createTelemetryState("s1");
      const analytics = computeAnalytics(state);
      expect(analytics.totalGenerations).toBe(0);
      expect(analytics.successRate).toBe(0);
      expect(analytics.avgQualityScore).toBe(0);
    });

    it("computes correct success rate", () => {
      let state = createTelemetryState("s1");
      state = recordGeneration(state, makeMetrics({ success: true }));
      state = recordGeneration(state, makeMetrics({ success: false }));
      const analytics = computeAnalytics(state);
      expect(analytics.successRate).toBe(0.5);
    });

    it("computes average quality score", () => {
      let state = createTelemetryState("s1");
      state = recordGeneration(state, makeMetrics({ qualityScore: 80 }));
      state = recordGeneration(state, makeMetrics({ qualityScore: 90 }));
      expect(computeAnalytics(state).avgQualityScore).toBe(85);
    });

    it("computes median quality score", () => {
      let state = createTelemetryState("s1");
      state = recordGeneration(state, makeMetrics({ qualityScore: 60 }));
      state = recordGeneration(state, makeMetrics({ qualityScore: 80 }));
      state = recordGeneration(state, makeMetrics({ qualityScore: 100 }));
      expect(computeAnalytics(state).medianQualityScore).toBe(80);
    });

    it("computes average duration", () => {
      let state = createTelemetryState("s1");
      state = recordGeneration(state, makeMetrics({ durationMs: 1000 }));
      state = recordGeneration(state, makeMetrics({ durationMs: 3000 }));
      expect(computeAnalytics(state).avgDurationMs).toBe(2000);
    });

    it("computes total tokens", () => {
      let state = createTelemetryState("s1");
      state = recordGeneration(state, makeMetrics({ tokenCount: 5000 }));
      state = recordGeneration(state, makeMetrics({ tokenCount: 3000 }));
      expect(computeAnalytics(state).totalTokens).toBe(8000);
    });

    it("computes satisfaction distribution", () => {
      let state = createTelemetryState("s1");
      state = recordGeneration(state, makeMetrics({ satisfaction: 1 }));
      state = recordGeneration(state, makeMetrics({ satisfaction: 1 }));
      state = recordGeneration(state, makeMetrics({ satisfaction: -1 }));
      const dist = computeAnalytics(state).satisfactionDistribution;
      expect(dist.positive).toBe(2);
      expect(dist.negative).toBe(1);
      expect(dist.neutral).toBe(0);
    });

    it("computes quality trend", () => {
      let state = createTelemetryState("s1");
      // First half: lower scores
      state = recordGeneration(state, makeMetrics({ qualityScore: 60 }));
      state = recordGeneration(state, makeMetrics({ qualityScore: 65 }));
      // Second half: higher scores
      state = recordGeneration(state, makeMetrics({ qualityScore: 85 }));
      state = recordGeneration(state, makeMetrics({ qualityScore: 90 }));
      const trend = computeAnalytics(state).qualityTrend;
      expect(trend).toBeGreaterThan(0); // improving
    });

    it("computes p95 duration", () => {
      let state = createTelemetryState("s1");
      for (let i = 1; i <= 20; i++) {
        state = recordGeneration(state, makeMetrics({ durationMs: i * 100 }));
      }
      const p95 = computeAnalytics(state).p95DurationMs;
      expect(p95).toBeGreaterThanOrEqual(1900);
    });
  });

  describe("getMetricsByRange", () => {
    it("filters by time range", () => {
      let state = createTelemetryState("s1");
      state = recordGeneration(state, makeMetrics({ startTime: 1000 }));
      state = recordGeneration(state, makeMetrics({ startTime: 5000 }));
      state = recordGeneration(state, makeMetrics({ startTime: 9000 }));
      const filtered = getMetricsByRange(state, 2000, 6000);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].startTime).toBe(5000);
    });
  });

  describe("getEventsByType", () => {
    it("filters events by type", () => {
      let state = createTelemetryState("s1");
      state = recordGeneration(state, makeMetrics());
      const qualityEvents = getEventsByType(state, "quality_score");
      expect(qualityEvents).toHaveLength(1);
    });
  });

  describe("serialize / deserialize", () => {
    it("round-trips telemetry state", () => {
      let state = createTelemetryState("s1");
      state = recordGeneration(state, makeMetrics());
      const json = serializeTelemetry(state);
      const restored = deserializeTelemetry(json);
      expect(restored.sessionId).toBe("s1");
      expect(restored.metrics).toHaveLength(1);
      expect(restored.events).toHaveLength(3);
    });

    it("handles empty state", () => {
      const json = serializeTelemetry(createTelemetryState("s1"));
      const restored = deserializeTelemetry(json);
      expect(restored.metrics).toHaveLength(0);
    });
  });
});
