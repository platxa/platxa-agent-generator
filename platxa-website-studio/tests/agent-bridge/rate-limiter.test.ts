import { describe, it, expect } from "vitest";
import {
  DEFAULT_RATE_CONFIG,
  createRateLimitState,
  getCallsInWindow,
  checkRateLimit,
  recordApiCall,
  getTotalTokens,
  getCostBreakdown,
  getBudgetUtilization,
  getRemainingBudget,
  getAlerts,
  resetRateWindows,
} from "@/lib/agent-bridge/rate-limiter";

describe("Rate Limiter", () => {
  const now = 1000000;

  describe("createRateLimitState", () => {
    it("creates empty state with defaults", () => {
      const state = createRateLimitState();
      expect(state.calls).toHaveLength(0);
      expect(state.config.maxRequestsPerMinute).toBe(30);
    });

    it("accepts custom config", () => {
      const state = createRateLimitState({ maxRequestsPerMinute: 10 });
      expect(state.config.maxRequestsPerMinute).toBe(10);
      expect(state.config.maxTokensPerMinute).toBe(100000); // default preserved
    });
  });

  describe("checkRateLimit", () => {
    it("allows call when under limits", () => {
      const state = createRateLimitState();
      const decision = checkRateLimit(state, 1000, now);
      expect(decision.allowed).toBe(true);
    });

    it("blocks when requests per minute exceeded", () => {
      let state = createRateLimitState({ maxRequestsPerMinute: 2 });
      ({ state } = recordApiCall(state, 100, 100, "m", now - 10000));
      ({ state } = recordApiCall(state, 100, 100, "m", now - 5000));
      const decision = checkRateLimit(state, 100, now);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain("requests/min");
      expect(decision.retryAfterMs).toBeGreaterThan(0);
    });

    it("blocks when tokens per minute exceeded", () => {
      let state = createRateLimitState({ maxTokensPerMinute: 5000 });
      ({ state } = recordApiCall(state, 3000, 1500, "m", now - 10000));
      const decision = checkRateLimit(state, 1000, now);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain("tokens/min");
    });

    it("blocks when session budget exhausted", () => {
      let state = createRateLimitState({ sessionTokenBudget: 1000 });
      ({ state } = recordApiCall(state, 500, 400, "m", now - 120000)); // outside 1min window
      const decision = checkRateLimit(state, 200, now);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain("budget");
    });

    it("allows after rate window expires", () => {
      let state = createRateLimitState({ maxRequestsPerMinute: 1 });
      ({ state } = recordApiCall(state, 100, 100, "m", now - 70000)); // 70s ago
      const decision = checkRateLimit(state, 100, now);
      expect(decision.allowed).toBe(true);
    });
  });

  describe("recordApiCall", () => {
    it("adds call to state", () => {
      const { state } = recordApiCall(createRateLimitState(), 1000, 500, "gpt-4", now);
      expect(state.calls).toHaveLength(1);
      expect(state.calls[0].promptTokens).toBe(1000);
      expect(state.calls[0].completionTokens).toBe(500);
    });

    it("fires 50% budget alert", () => {
      let state = createRateLimitState({ sessionTokenBudget: 1000 });
      const result = recordApiCall(state, 300, 200, "m", now);
      expect(result.newAlerts).toHaveLength(1);
      expect(result.newAlerts[0].threshold).toBe(0.5);
      expect(result.newAlerts[0].label).toBe("50%");
    });

    it("fires 80% and 100% alerts on same call", () => {
      let state = createRateLimitState({ sessionTokenBudget: 1000 });
      ({ state } = recordApiCall(state, 300, 200, "m", now)); // 500 = 50%
      // Jump from 500 to 1050 in one call — crosses both 80% and 100%
      const result = recordApiCall(state, 350, 200, "m", now); // 1050 = 105%
      expect(result.newAlerts.length).toBe(2);
      expect(result.newAlerts.map((a) => a.threshold)).toContain(0.8);
      expect(result.newAlerts.map((a) => a.threshold)).toContain(1.0);
    });

    it("does not fire same alert twice", () => {
      let state = createRateLimitState({ sessionTokenBudget: 1000 });
      ({ state } = recordApiCall(state, 300, 200, "m", now)); // 50% fires
      const result = recordApiCall(state, 10, 10, "m", now); // still above 50%
      expect(result.newAlerts).toHaveLength(0);
    });
  });

  describe("getCallsInWindow", () => {
    it("returns only calls within window", () => {
      let state = createRateLimitState();
      ({ state } = recordApiCall(state, 100, 100, "m", now - 120000)); // 2min ago
      ({ state } = recordApiCall(state, 100, 100, "m", now - 30000));  // 30s ago
      ({ state } = recordApiCall(state, 100, 100, "m", now));
      const recent = getCallsInWindow(state, 60000, now);
      expect(recent).toHaveLength(2);
    });
  });

  describe("cost tracking", () => {
    it("computes total tokens", () => {
      let state = createRateLimitState();
      ({ state } = recordApiCall(state, 1000, 500, "m", now));
      ({ state } = recordApiCall(state, 2000, 800, "m", now));
      expect(getTotalTokens(state)).toBe(4300);
    });

    it("computes cost breakdown", () => {
      let state = createRateLimitState({
        promptCostPer1K: 0.003,
        completionCostPer1K: 0.015,
      });
      ({ state } = recordApiCall(state, 1000, 1000, "m", now));
      const cost = getCostBreakdown(state);
      expect(cost.promptCost).toBeCloseTo(0.003, 4);
      expect(cost.completionCost).toBeCloseTo(0.015, 4);
      expect(cost.totalCost).toBeCloseTo(0.018, 4);
    });

    it("computes budget utilization", () => {
      let state = createRateLimitState({ sessionTokenBudget: 10000 });
      ({ state } = recordApiCall(state, 2000, 1000, "m", now));
      expect(getBudgetUtilization(state)).toBeCloseTo(0.3, 2);
    });

    it("computes remaining budget", () => {
      let state = createRateLimitState({ sessionTokenBudget: 10000 });
      ({ state } = recordApiCall(state, 2000, 1000, "m", now));
      expect(getRemainingBudget(state)).toBe(7000);
    });

    it("clamps remaining to 0", () => {
      let state = createRateLimitState({ sessionTokenBudget: 100 });
      ({ state } = recordApiCall(state, 80, 80, "m", now));
      expect(getRemainingBudget(state)).toBe(0);
    });
  });

  describe("getAlerts", () => {
    it("returns all fired alerts", () => {
      let state = createRateLimitState({ sessionTokenBudget: 100 });
      ({ state } = recordApiCall(state, 60, 50, "m", now)); // crosses 50%, 80%, 100%
      expect(getAlerts(state).length).toBe(3);
    });
  });

  describe("resetRateWindows", () => {
    it("removes old calls outside window", () => {
      let state = createRateLimitState();
      ({ state } = recordApiCall(state, 100, 100, "m", now - 120000));
      ({ state } = recordApiCall(state, 100, 100, "m", now));
      state = resetRateWindows(state, now);
      expect(state.calls).toHaveLength(1);
    });

    it("preserves alerts", () => {
      let state = createRateLimitState({ sessionTokenBudget: 100 });
      ({ state } = recordApiCall(state, 60, 50, "m", now - 120000));
      state = resetRateWindows(state, now);
      expect(state.alerts.length).toBeGreaterThan(0);
    });
  });

  describe("DEFAULT_RATE_CONFIG", () => {
    it("has alert thresholds at 50%, 80%, 100%", () => {
      expect(DEFAULT_RATE_CONFIG.alertThresholds).toEqual([0.5, 0.8, 1.0]);
    });
  });
});
