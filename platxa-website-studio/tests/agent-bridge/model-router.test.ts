import { describe, it, expect } from "vitest";
import {
  REASONING_MODEL,
  CODE_MODEL,
  FAST_MODEL,
  DEFAULT_MODELS,
  DEFAULT_ROUTING_RULES,
  DEFAULT_ROUTER_CONFIG,
  createRouterState,
  getModel,
  estimateCost,
  routeTask,
  routeAndRecord,
  getHistoryByType,
  getTotalEstimatedCost,
  getModelUsage,
} from "@/lib/agent-bridge/model-router";
import type { RoutingRequest } from "@/lib/agent-bridge/model-router";

function makeRequest(taskType: RoutingRequest["taskType"], opts: Partial<RoutingRequest> = {}): RoutingRequest {
  return {
    taskType,
    estimatedPromptTokens: 1000,
    estimatedCompletionTokens: 500,
    ...opts,
  };
}

describe("Model Router", () => {
  describe("DEFAULT_MODELS", () => {
    it("has 3 models", () => {
      expect(DEFAULT_MODELS).toHaveLength(3);
    });

    it("reasoning model supports planning", () => {
      expect(REASONING_MODEL.capabilities).toContain("planning");
      expect(REASONING_MODEL.capabilities).toContain("review");
    });

    it("code model supports code_generation", () => {
      expect(CODE_MODEL.capabilities).toContain("code_generation");
    });

    it("fast model supports content_writing", () => {
      expect(FAST_MODEL.capabilities).toContain("content_writing");
      expect(FAST_MODEL.capabilities).toContain("translation");
    });
  });

  describe("DEFAULT_ROUTING_RULES", () => {
    it("routes planning to reasoning model", () => {
      const rule = DEFAULT_ROUTING_RULES.find((r) => r.taskType === "planning");
      expect(rule?.modelId).toBe("claude-opus");
    });

    it("routes code_generation to code model", () => {
      const rule = DEFAULT_ROUTING_RULES.find((r) => r.taskType === "code_generation");
      expect(rule?.modelId).toBe("claude-sonnet");
    });

    it("routes review to reasoning model", () => {
      const rule = DEFAULT_ROUTING_RULES.find((r) => r.taskType === "review");
      expect(rule?.modelId).toBe("claude-opus");
    });
  });

  describe("createRouterState", () => {
    it("creates state with defaults", () => {
      const state = createRouterState();
      expect(state.config.models).toHaveLength(3);
      expect(state.history).toHaveLength(0);
    });
  });

  describe("getModel", () => {
    it("finds model by ID", () => {
      expect(getModel(DEFAULT_ROUTER_CONFIG, "claude-opus")).toBe(REASONING_MODEL);
    });

    it("returns undefined for unknown ID", () => {
      expect(getModel(DEFAULT_ROUTER_CONFIG, "unknown")).toBeUndefined();
    });
  });

  describe("estimateCost", () => {
    it("computes cost for given tokens", () => {
      // CODE_MODEL: prompt=0.003/1K, completion=0.015/1K
      const cost = estimateCost(CODE_MODEL, 1000, 1000);
      expect(cost).toBeCloseTo(0.003 + 0.015, 4);
    });

    it("scales with token count", () => {
      const cost1 = estimateCost(CODE_MODEL, 1000, 500);
      const cost2 = estimateCost(CODE_MODEL, 2000, 1000);
      expect(cost2).toBeCloseTo(cost1 * 2, 4);
    });
  });

  describe("routeTask", () => {
    it("routes planning to reasoning model", () => {
      const decision = routeTask(DEFAULT_ROUTER_CONFIG, makeRequest("planning"));
      expect(decision.model.id).toBe("claude-opus");
      expect(decision.isFallback).toBe(false);
      expect(decision.reason).toContain("planning");
    });

    it("routes code_generation to code model", () => {
      const decision = routeTask(DEFAULT_ROUTER_CONFIG, makeRequest("code_generation"));
      expect(decision.model.id).toBe("claude-sonnet");
    });

    it("routes review to reasoning model", () => {
      const decision = routeTask(DEFAULT_ROUTER_CONFIG, makeRequest("review"));
      expect(decision.model.id).toBe("claude-opus");
    });

    it("routes content_writing to fast model", () => {
      const decision = routeTask(DEFAULT_ROUTER_CONFIG, makeRequest("content_writing"));
      expect(decision.model.id).toBe("claude-haiku");
    });

    it("routes translation to fast model", () => {
      const decision = routeTask(DEFAULT_ROUTER_CONFIG, makeRequest("translation"));
      expect(decision.model.id).toBe("claude-haiku");
    });

    it("uses fallback when primary unavailable", () => {
      const config = {
        ...DEFAULT_ROUTER_CONFIG,
        models: [CODE_MODEL, FAST_MODEL], // no opus
      };
      const decision = routeTask(config, makeRequest("planning"));
      expect(decision.model.id).toBe("claude-sonnet");
      expect(decision.isFallback).toBe(true);
    });

    it("uses default model when no rule matches", () => {
      const config = { ...DEFAULT_ROUTER_CONFIG, rules: [] };
      const decision = routeTask(config, makeRequest("planning"));
      expect(decision.model.id).toBe("claude-sonnet"); // default
      expect(decision.reason).toContain("Default");
    });

    it("prefers cheapest model when preferCost is true", () => {
      const decision = routeTask(
        DEFAULT_ROUTER_CONFIG,
        makeRequest("debugging", { preferCost: true }),
      );
      // FAST_MODEL doesn't have debugging, CODE_MODEL and REASONING do
      // CODE_MODEL is cheaper than REASONING
      expect(decision.model.id).toBe("claude-sonnet");
      expect(decision.reason).toContain("Cost-optimized");
    });

    it("includes estimated cost", () => {
      const decision = routeTask(DEFAULT_ROUTER_CONFIG, makeRequest("code_generation"));
      expect(decision.estimatedCost).toBeGreaterThan(0);
    });
  });

  describe("routeAndRecord", () => {
    it("records routing in history", () => {
      const { state, decision } = routeAndRecord(
        createRouterState(),
        makeRequest("planning"),
        1000,
      );
      expect(state.history).toHaveLength(1);
      expect(state.history[0].decision.model.id).toBe(decision.model.id);
      expect(state.history[0].timestamp).toBe(1000);
    });

    it("does not mutate input state", () => {
      const original = createRouterState();
      routeAndRecord(original, makeRequest("planning"));
      expect(original.history).toHaveLength(0);
    });
  });

  describe("queries", () => {
    it("getHistoryByType filters by task type", () => {
      let state = createRouterState();
      ({ state } = routeAndRecord(state, makeRequest("planning")));
      ({ state } = routeAndRecord(state, makeRequest("code_generation")));
      ({ state } = routeAndRecord(state, makeRequest("planning")));
      expect(getHistoryByType(state, "planning")).toHaveLength(2);
      expect(getHistoryByType(state, "code_generation")).toHaveLength(1);
    });

    it("getTotalEstimatedCost sums costs", () => {
      let state = createRouterState();
      ({ state } = routeAndRecord(state, makeRequest("planning")));
      ({ state } = routeAndRecord(state, makeRequest("code_generation")));
      expect(getTotalEstimatedCost(state)).toBeGreaterThan(0);
    });

    it("getModelUsage returns counts", () => {
      let state = createRouterState();
      ({ state } = routeAndRecord(state, makeRequest("planning")));
      ({ state } = routeAndRecord(state, makeRequest("planning")));
      ({ state } = routeAndRecord(state, makeRequest("code_generation")));
      const usage = getModelUsage(state);
      expect(usage["claude-opus"]).toBe(2);
      expect(usage["claude-sonnet"]).toBe(1);
    });
  });
});
