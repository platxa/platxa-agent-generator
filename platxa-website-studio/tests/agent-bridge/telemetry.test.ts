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
  createAnalyticsState,
  hashPrompt,
  trackPrompt,
  trackError,
  trackGeneration,
  trackSatisfaction,
  computePromptAnalytics,
  computeErrorAnalytics,
  computeGenerationAnalytics,
  formatAnalyticsReport,
} from "@/lib/agent-bridge/telemetry";
import type { GenerationMetrics, AnalyticsState } from "@/lib/agent-bridge/telemetry";

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

  // ===========================================================================
  // Generation Analytics Tracking (Feature #190)
  // ===========================================================================

  describe("createAnalyticsState", () => {
    it("creates empty analytics state", () => {
      const state = createAnalyticsState("sess-1");
      expect(state.telemetry.sessionId).toBe("sess-1");
      expect(state.prompts).toHaveLength(0);
      expect(state.errors).toHaveLength(0);
    });
  });

  describe("hashPrompt", () => {
    it("generates consistent hash for same text", () => {
      const hash1 = hashPrompt("test prompt");
      const hash2 = hashPrompt("test prompt");
      expect(hash1).toBe(hash2);
    });

    it("generates different hash for different text", () => {
      const hash1 = hashPrompt("prompt A");
      const hash2 = hashPrompt("prompt B");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("trackPrompt", () => {
    it("records prompt with type and hash", () => {
      let state = createAnalyticsState("s1");
      state = trackPrompt(state, "user_request", "Generate a landing page");

      expect(state.prompts).toHaveLength(1);
      expect(state.prompts[0].type).toBe("user_request");
      expect(state.prompts[0].length).toBe(23); // "Generate a landing page" = 23 chars
      expect(state.prompts[0].hash).toBeTruthy();
    });

    it("records generation_start event", () => {
      let state = createAnalyticsState("s1");
      state = trackPrompt(state, "template", "System prompt template");

      const events = getEventsByType(state.telemetry, "generation_start");
      expect(events).toHaveLength(1);
      expect(events[0].data.type).toBe("template");
    });

    it("associates prompt with generation ID", () => {
      let state = createAnalyticsState("s1");
      state = trackPrompt(state, "refinement", "Improve the header", "gen_123");

      expect(state.prompts[0].generationId).toBe("gen_123");
    });
  });

  describe("trackError", () => {
    it("records error with category", () => {
      let state = createAnalyticsState("s1");
      state = trackError(state, "api_error", "Rate limit exceeded");

      expect(state.errors).toHaveLength(1);
      expect(state.errors[0].category).toBe("api_error");
      expect(state.errors[0].message).toBe("Rate limit exceeded");
    });

    it("records generation_error event", () => {
      let state = createAnalyticsState("s1");
      state = trackError(state, "timeout", "Request timed out");

      const events = getEventsByType(state.telemetry, "generation_error");
      expect(events).toHaveLength(1);
    });

    it("tracks recovery status", () => {
      let state = createAnalyticsState("s1");
      state = trackError(state, "rate_limit", "Too many requests", {
        recovered: true,
        recoveryAction: "retry_with_backoff",
      });

      expect(state.errors[0].recovered).toBe(true);
      expect(state.errors[0].recoveryAction).toBe("retry_with_backoff");
    });
  });

  describe("trackGeneration", () => {
    it("records generation through analytics state", () => {
      let state = createAnalyticsState("s1");
      state = trackGeneration(state, makeMetrics());

      expect(state.telemetry.metrics).toHaveLength(1);
    });
  });

  describe("trackSatisfaction", () => {
    it("records satisfaction through analytics state", () => {
      let state = createAnalyticsState("s1");
      state = trackGeneration(state, makeMetrics());
      const genId = state.telemetry.metrics[0].generationId;
      state = trackSatisfaction(state, genId, 1);

      expect(state.telemetry.metrics[0].satisfaction).toBe(1);
    });
  });

  describe("computePromptAnalytics", () => {
    it("returns zeros for empty state", () => {
      const state = createAnalyticsState("s1");
      const analytics = computePromptAnalytics(state);

      expect(analytics.totalPrompts).toBe(0);
      expect(analytics.uniqueCount).toBe(0);
    });

    it("counts prompts by type", () => {
      let state = createAnalyticsState("s1");
      state = trackPrompt(state, "user_request", "prompt 1");
      state = trackPrompt(state, "user_request", "prompt 2");
      state = trackPrompt(state, "template", "template 1");

      const analytics = computePromptAnalytics(state);
      expect(analytics.byType.user_request).toBe(2);
      expect(analytics.byType.template).toBe(1);
    });

    it("calculates reuse rate", () => {
      let state = createAnalyticsState("s1");
      state = trackPrompt(state, "user_request", "same prompt");
      state = trackPrompt(state, "user_request", "same prompt"); // Duplicate
      state = trackPrompt(state, "user_request", "different prompt");

      const analytics = computePromptAnalytics(state);
      expect(analytics.totalPrompts).toBe(3);
      expect(analytics.uniqueCount).toBe(2);
      expect(analytics.reuseRate).toBeCloseTo(1/3, 2);
    });

    it("calculates average length", () => {
      let state = createAnalyticsState("s1");
      state = trackPrompt(state, "user_request", "short"); // 5 chars
      state = trackPrompt(state, "user_request", "much longer prompt"); // 18 chars

      const analytics = computePromptAnalytics(state);
      expect(analytics.avgLength).toBe(11.5);
    });
  });

  describe("computeErrorAnalytics", () => {
    it("returns zeros for empty state", () => {
      const state = createAnalyticsState("s1");
      const analytics = computeErrorAnalytics(state);

      expect(analytics.totalErrors).toBe(0);
      expect(analytics.mostCommon).toBeNull();
    });

    it("counts errors by category", () => {
      let state = createAnalyticsState("s1");
      state = trackError(state, "api_error", "Error 1");
      state = trackError(state, "api_error", "Error 2");
      state = trackError(state, "timeout", "Timeout");

      const analytics = computeErrorAnalytics(state);
      expect(analytics.byCategory.api_error).toBe(2);
      expect(analytics.byCategory.timeout).toBe(1);
    });

    it("identifies most common category", () => {
      let state = createAnalyticsState("s1");
      state = trackError(state, "rate_limit", "Rate limit 1");
      state = trackError(state, "rate_limit", "Rate limit 2");
      state = trackError(state, "timeout", "Timeout");

      const analytics = computeErrorAnalytics(state);
      expect(analytics.mostCommon).toBe("rate_limit");
    });

    it("calculates recovery rate", () => {
      let state = createAnalyticsState("s1");
      state = trackError(state, "api_error", "Error 1", { recovered: true });
      state = trackError(state, "api_error", "Error 2", { recovered: true });
      state = trackError(state, "api_error", "Error 3", { recovered: false });

      const analytics = computeErrorAnalytics(state);
      expect(analytics.recoveryRate).toBeCloseTo(2/3, 2);
    });

    it("returns recent errors", () => {
      let state = createAnalyticsState("s1");
      for (let i = 0; i < 15; i++) {
        state = trackError(state, "api_error", `Error ${i}`);
      }

      const analytics = computeErrorAnalytics(state);
      expect(analytics.recent).toHaveLength(10);
      expect(analytics.recent[9].message).toBe("Error 14");
    });
  });

  describe("computeGenerationAnalytics", () => {
    it("combines all analytics", () => {
      let state = createAnalyticsState("s1");
      state = trackPrompt(state, "user_request", "Create a page");
      state = trackGeneration(state, makeMetrics({ startTime: Date.now() }));
      state = trackError(state, "validation_error", "Invalid HTML");

      const analytics = computeGenerationAnalytics(state);

      expect(analytics.summary.totalGenerations).toBe(1);
      expect(analytics.prompts.totalPrompts).toBe(1);
      expect(analytics.errors.totalErrors).toBe(1);
    });

    it("tracks generations by period", () => {
      const now = Date.now();
      let state = createAnalyticsState("s1");

      // Recent generation
      state = trackGeneration(state, makeMetrics({ startTime: now - 1000 }));

      const analytics = computeGenerationAnalytics(state);
      expect(analytics.byPeriod.lastHour).toBe(1);
      expect(analytics.byPeriod.lastDay).toBe(1);
      expect(analytics.byPeriod.lastWeek).toBe(1);
    });
  });

  describe("formatAnalyticsReport", () => {
    it("generates formatted report", () => {
      let state = createAnalyticsState("s1");
      state = trackPrompt(state, "user_request", "Test prompt");
      state = trackGeneration(state, makeMetrics({ satisfaction: 1 }));
      state = trackError(state, "api_error", "Test error");

      const analytics = computeGenerationAnalytics(state);
      const report = formatAnalyticsReport(analytics);

      expect(report).toContain("GENERATION ANALYTICS REPORT");
      expect(report).toContain("GENERATIONS");
      expect(report).toContain("PROMPTS");
      expect(report).toContain("ERRORS");
      expect(report).toContain("USER SATISFACTION");
      expect(report).toContain("BY PERIOD");
    });
  });
});
