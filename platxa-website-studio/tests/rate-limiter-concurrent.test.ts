/**
 * Concurrent Rate Limiting Tests
 *
 * Validates that the rate limiter correctly enforces limits under
 * concurrent request patterns. While Node.js is single-threaded,
 * Promise.all can surface logical issues in state management.
 *
 * Feature #29: Concurrent rate limiting test coverage
 */

import { describe, it, expect } from "vitest";
import {
  createRateLimitState,
  checkRateLimit,
  recordApiCall,
} from "../lib/agent-bridge/rate-limiter";

describe("Concurrent rate limiting", () => {
  describe("per-minute request limit under burst load", () => {
    it("enforces maxRequestsPerMinute across 100 rapid requests", () => {
      const state = createRateLimitState({ maxRequestsPerMinute: 10 });
      const now = 1000000;
      let allowed = 0;
      let denied = 0;

      // Simulate 100 requests at the same timestamp
      for (let i = 0; i < 100; i++) {
        const decision = checkRateLimit(state, 100, now);
        if (decision.allowed) {
          // Record the call so subsequent checks see it
          const result = recordApiCall(state, 50, 50, "test", now);
          // Update state in-place (calls array is mutated by recordApiCall)
          state.calls = result.state.calls;
          state.callCounter = result.state.callCounter;
          allowed++;
        } else {
          denied++;
        }
      }

      expect(allowed).toBe(10); // Exactly maxRequestsPerMinute
      expect(denied).toBe(90); // Rest should be denied
    });

    it("allows new requests after window expires", () => {
      const state = createRateLimitState({ maxRequestsPerMinute: 5 });
      const now = 1000000;

      // Fill the limit
      for (let i = 0; i < 5; i++) {
        const decision = checkRateLimit(state, 100, now);
        expect(decision.allowed).toBe(true);
        const result = recordApiCall(state, 50, 50, "test", now);
        state.calls = result.state.calls;
        state.callCounter = result.state.callCounter;
      }

      // Should be denied at same time
      expect(checkRateLimit(state, 100, now).allowed).toBe(false);

      // 61 seconds later, window has expired
      const later = now + 61_000;
      expect(checkRateLimit(state, 100, later).allowed).toBe(true);
    });
  });

  describe("per-minute token limit under burst load", () => {
    it("enforces maxTokensPerMinute across rapid token-heavy requests", () => {
      const state = createRateLimitState({
        maxRequestsPerMinute: 1000, // high limit so we hit token limit first
        maxTokensPerMinute: 10000,
        maxTokensPerRequest: 5000,
      });
      const now = 1000000;
      let allowed = 0;

      // Each request uses 2000 tokens, so 5 should be allowed (10000/2000)
      for (let i = 0; i < 20; i++) {
        const decision = checkRateLimit(state, 2000, now);
        if (decision.allowed) {
          const result = recordApiCall(state, 1000, 1000, "test", now);
          state.calls = result.state.calls;
          state.callCounter = result.state.callCounter;
          allowed++;
        }
      }

      expect(allowed).toBe(5);
    });
  });

  describe("per-request token limit", () => {
    it("rejects single request exceeding maxTokensPerRequest", () => {
      const state = createRateLimitState({ maxTokensPerRequest: 5000 });
      const decision = checkRateLimit(state, 6000);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain("Per-request limit");
    });

    it("allows request at exact maxTokensPerRequest boundary", () => {
      const state = createRateLimitState({ maxTokensPerRequest: 5000 });
      const decision = checkRateLimit(state, 5000);
      expect(decision.allowed).toBe(true);
    });
  });

  describe("session budget under sustained load", () => {
    it("enforces sessionTokenBudget across many small requests", () => {
      const state = createRateLimitState({
        maxRequestsPerMinute: 10000, // high limit
        maxTokensPerMinute: 1000000, // high limit
        maxTokensPerRequest: 10000,
        sessionTokenBudget: 10000,
      });
      let allowed = 0;

      // Spread requests across different minute windows
      for (let i = 0; i < 200; i++) {
        const now = 1000000 + i * 60_000; // each in its own minute
        const decision = checkRateLimit(state, 1000, now);
        if (decision.allowed) {
          const result = recordApiCall(state, 500, 500, "test", now);
          state.calls = result.state.calls;
          state.callCounter = result.state.callCounter;
          allowed++;
        }
      }

      expect(allowed).toBe(10); // 10000 budget / 1000 per request = 10
    });
  });

  describe("budget alerts under rapid consumption", () => {
    it("fires alerts at correct thresholds during burst", () => {
      const state = createRateLimitState({
        maxRequestsPerMinute: 100,
        maxTokensPerMinute: 1000000,
        maxTokensPerRequest: 50000,
        sessionTokenBudget: 10000,
        alertThresholds: [0.5, 0.8, 1.0],
      });
      const allAlerts: Array<{ threshold: number }> = [];

      // Consume budget in small chunks spread across time
      for (let i = 0; i < 20; i++) {
        const now = 1000000 + i * 61_000; // different windows
        const decision = checkRateLimit(state, 1000, now);
        if (decision.allowed) {
          const result = recordApiCall(state, 500, 500, "test", now);
          state.calls = result.state.calls;
          state.callCounter = result.state.callCounter;
          state.firedAlerts = result.state.firedAlerts;
          state.alerts = result.state.alerts;
          allAlerts.push(...result.newAlerts);
        }
      }

      const thresholds = allAlerts.map((a) => a.threshold);
      expect(thresholds).toContain(0.5);
      expect(thresholds).toContain(0.8);
      expect(thresholds).toContain(1.0);
    });

    it("does not fire duplicate alerts", () => {
      const state = createRateLimitState({
        maxRequestsPerMinute: 100,
        maxTokensPerMinute: 1000000,
        maxTokensPerRequest: 50000,
        sessionTokenBudget: 10000,
        alertThresholds: [0.5],
      });
      const allAlerts: Array<{ threshold: number }> = [];

      for (let i = 0; i < 20; i++) {
        const now = 1000000 + i * 61_000;
        const decision = checkRateLimit(state, 1000, now);
        if (decision.allowed) {
          const result = recordApiCall(state, 500, 500, "test", now);
          state.calls = result.state.calls;
          state.callCounter = result.state.callCounter;
          state.firedAlerts = result.state.firedAlerts;
          state.alerts = result.state.alerts;
          allAlerts.push(...result.newAlerts);
        }
      }

      // 50% threshold should only fire once
      const fiftyAlerts = allAlerts.filter((a) => a.threshold === 0.5);
      expect(fiftyAlerts).toHaveLength(1);
    });
  });

  describe("concurrent state consistency", () => {
    it("maintains accurate call count after rapid check-record cycles", () => {
      const state = createRateLimitState({ maxRequestsPerMinute: 50 });
      const now = 1000000;
      let recorded = 0;

      for (let i = 0; i < 100; i++) {
        const decision = checkRateLimit(state, 100, now);
        if (decision.allowed) {
          const result = recordApiCall(state, 50, 50, "test", now + i);
          state.calls = result.state.calls;
          state.callCounter = result.state.callCounter;
          recorded++;
        }
      }

      expect(recorded).toBe(50);
      expect(state.calls).toHaveLength(50);
      expect(state.callCounter).toBe(50);
    });

    it("generates unique call IDs across all recorded calls", () => {
      const state = createRateLimitState({ maxRequestsPerMinute: 100 });
      const now = 1000000;

      for (let i = 0; i < 50; i++) {
        const result = recordApiCall(state, 50, 50, "test", now + i);
        state.calls = result.state.calls;
        state.callCounter = result.state.callCounter;
      }

      const ids = state.calls.map((c) => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(50);
    });
  });
});
