// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import {
  ErrorRetryManager,
  createRetryManager,
  createRetryManagerWithFix,
  createErrorIdentifier,
  createErrorKey,
  isSameError,
  createRetryState,
  recordAttempt,
  canRetry,
  getNextApproach,
  calculateRetryDelay,
  formatRetryResult,
  getApproachDescription,
  shouldEscalate,
  createMockFixFunction,
  createFailingFixFunction,
  createSucceedingFixFunction,
  DEFAULT_RETRY_CONFIG,
  APPROACH_DESCRIPTIONS,
  type ErrorIdentifier,
  type RetryAttempt,
  type RetryState,
  type RetryApproach,
} from "@/lib/preview/error-retry-logic";

describe("ErrorRetryLogic", () => {
  // Test config with no delays for fast tests
  const TEST_CONFIG = { retryDelay: 0, exponentialBackoff: false };

  describe("same error retried up to 3 times (Feature #152)", () => {
    it("limits retries to max 3 attempts", async () => {
      // Feature #152: Same error retried up to 3 times
      const manager = createRetryManagerWithFix(createFailingFixFunction(), TEST_CONFIG);
      const error = createErrorIdentifier("Test error");

      const result = await manager.attemptFix(error);

      expect(result.attempts.length).toBe(3);
      expect(result.state.exhausted).toBe(true);
    });

    it("tracks attempt numbers correctly", async () => {
      // Feature #152: Same error retried up to 3 times
      const manager = createRetryManagerWithFix(createFailingFixFunction(), TEST_CONFIG);
      const error = createErrorIdentifier("Test error");

      const result = await manager.attemptFix(error);

      expect(result.attempts[0].attemptNumber).toBe(1);
      expect(result.attempts[1].attemptNumber).toBe(2);
      expect(result.attempts[2].attemptNumber).toBe(3);
    });

    it("stops retrying after success", async () => {
      // Feature #152: Same error retried up to 3 times
      const manager = createRetryManagerWithFix(createMockFixFunction(2), TEST_CONFIG); // Succeeds on attempt 2
      const error = createErrorIdentifier("Test error");

      const result = await manager.attemptFix(error);

      expect(result.success).toBe(true);
      expect(result.attempts.length).toBe(2);
      expect(result.state.resolved).toBe(true);
    });

    it("getRemainingRetries returns correct count", () => {
      // Feature #152: Same error retried up to 3 times
      const manager = createRetryManager();
      const error = createErrorIdentifier("Test error");

      expect(manager.getRemainingRetries(error)).toBe(3);

      // Simulate some attempts
      const state = manager.getState(error);
      const attempt: RetryAttempt = {
        attemptNumber: 1,
        approach: "pattern_match",
        success: false,
        timestamp: Date.now(),
        duration: 10,
      };
      const newState = recordAttempt(state, attempt);

      // The manager should track this internally
      expect(newState.currentAttempt).toBe(1);
    });
  });

  describe("different approaches for each retry (Feature #152)", () => {
    it("uses different approach for each attempt", async () => {
      // Feature #152: Different approaches
      const manager = createRetryManagerWithFix(createFailingFixFunction(), TEST_CONFIG);
      const error = createErrorIdentifier("Test error");

      const result = await manager.attemptFix(error);

      const approaches = result.attempts.map((a) => a.approach);
      expect(approaches[0]).toBe("pattern_match");
      expect(approaches[1]).toBe("fuzzy_match");
      expect(approaches[2]).toBe("llm_generation");
    });

    it("tracks approaches tried", async () => {
      // Feature #152: Different approaches
      const manager = createRetryManagerWithFix(createFailingFixFunction(), TEST_CONFIG);
      const error = createErrorIdentifier("Test error");

      const result = await manager.attemptFix(error);

      expect(result.state.approachesTried).toContain("pattern_match");
      expect(result.state.approachesTried).toContain("fuzzy_match");
      expect(result.state.approachesTried).toContain("llm_generation");
    });

    it("getNextApproach returns untried approach", () => {
      // Feature #152: Different approaches
      const state = createRetryState(createErrorIdentifier("Test"));
      state.approachesTried = ["pattern_match"];

      const next = getNextApproach(state, DEFAULT_RETRY_CONFIG.approachOrder);

      expect(next).toBe("fuzzy_match");
    });

    it("custom approach order is respected", async () => {
      // Feature #152: Different approaches
      const manager = createRetryManagerWithFix(
        createFailingFixFunction(),
        { ...TEST_CONFIG, approachOrder: ["llm_generation", "pattern_match", "fuzzy_match"] }
      );
      const error = createErrorIdentifier("Test error");

      const result = await manager.attemptFix(error);

      expect(result.attempts[0].approach).toBe("llm_generation");
      expect(result.attempts[1].approach).toBe("pattern_match");
    });
  });

  describe("createErrorIdentifier", () => {
    it("creates identifier with message", () => {
      const error = createErrorIdentifier("Test error");

      expect(error.message).toBe("Test error");
    });

    it("includes optional fields", () => {
      const error = createErrorIdentifier("Error", {
        filePath: "/app/test.js",
        lineNumber: 42,
        errorType: "SyntaxError",
      });

      expect(error.filePath).toBe("/app/test.js");
      expect(error.lineNumber).toBe(42);
      expect(error.errorType).toBe("SyntaxError");
    });
  });

  describe("createErrorKey", () => {
    it("creates key from message", () => {
      const error = createErrorIdentifier("Test");
      const key = createErrorKey(error);

      expect(key).toBe("Test");
    });

    it("includes all fields in key", () => {
      const error = createErrorIdentifier("Error", {
        filePath: "/app.js",
        lineNumber: 10,
        errorType: "TypeError",
      });
      const key = createErrorKey(error);

      expect(key).toContain("Error");
      expect(key).toContain("/app.js");
      expect(key).toContain("10");
      expect(key).toContain("TypeError");
    });
  });

  describe("isSameError", () => {
    it("returns true for same error", () => {
      const a = createErrorIdentifier("Error", { filePath: "/app.js" });
      const b = createErrorIdentifier("Error", { filePath: "/app.js" });

      expect(isSameError(a, b)).toBe(true);
    });

    it("returns false for different errors", () => {
      const a = createErrorIdentifier("Error 1");
      const b = createErrorIdentifier("Error 2");

      expect(isSameError(a, b)).toBe(false);
    });
  });

  describe("createRetryState", () => {
    it("creates initial state", () => {
      const error = createErrorIdentifier("Test");
      const state = createRetryState(error);

      expect(state.error).toBe(error);
      expect(state.attempts).toEqual([]);
      expect(state.currentAttempt).toBe(0);
      expect(state.maxAttempts).toBe(3);
      expect(state.exhausted).toBe(false);
      expect(state.resolved).toBe(false);
    });

    it("accepts custom max attempts", () => {
      const state = createRetryState(createErrorIdentifier("Test"), 5);

      expect(state.maxAttempts).toBe(5);
    });
  });

  describe("recordAttempt", () => {
    it("adds attempt to state", () => {
      const state = createRetryState(createErrorIdentifier("Test"));
      const attempt: RetryAttempt = {
        attemptNumber: 1,
        approach: "pattern_match",
        success: false,
        timestamp: Date.now(),
        duration: 10,
      };

      const newState = recordAttempt(state, attempt);

      expect(newState.attempts.length).toBe(1);
      expect(newState.currentAttempt).toBe(1);
    });

    it("marks exhausted after max attempts", () => {
      let state = createRetryState(createErrorIdentifier("Test"));

      for (let i = 1; i <= 3; i++) {
        state = recordAttempt(state, {
          attemptNumber: i,
          approach: "pattern_match",
          success: false,
          timestamp: Date.now(),
          duration: 10,
        });
      }

      expect(state.exhausted).toBe(true);
    });

    it("marks resolved on success", () => {
      const state = createRetryState(createErrorIdentifier("Test"));
      const newState = recordAttempt(state, {
        attemptNumber: 1,
        approach: "pattern_match",
        success: true,
        timestamp: Date.now(),
        duration: 10,
      });

      expect(newState.resolved).toBe(true);
    });

    it("tracks approaches tried", () => {
      let state = createRetryState(createErrorIdentifier("Test"));

      state = recordAttempt(state, {
        attemptNumber: 1,
        approach: "pattern_match",
        success: false,
        timestamp: Date.now(),
        duration: 10,
      });

      expect(state.approachesTried).toContain("pattern_match");
    });
  });

  describe("canRetry", () => {
    it("returns true for fresh state", () => {
      const state = createRetryState(createErrorIdentifier("Test"));

      expect(canRetry(state)).toBe(true);
    });

    it("returns false when exhausted", () => {
      const state = createRetryState(createErrorIdentifier("Test"));
      state.exhausted = true;

      expect(canRetry(state)).toBe(false);
    });

    it("returns false when resolved", () => {
      const state = createRetryState(createErrorIdentifier("Test"));
      state.resolved = true;

      expect(canRetry(state)).toBe(false);
    });

    it("returns false when max attempts reached", () => {
      const state = createRetryState(createErrorIdentifier("Test"));
      state.currentAttempt = 3;

      expect(canRetry(state)).toBe(false);
    });
  });

  describe("calculateRetryDelay", () => {
    it("returns base delay without backoff", () => {
      const delay = calculateRetryDelay(1, {
        ...DEFAULT_RETRY_CONFIG,
        exponentialBackoff: false,
        retryDelay: 100,
      });

      expect(delay).toBe(100);
    });

    it("applies exponential backoff", () => {
      const config = {
        ...DEFAULT_RETRY_CONFIG,
        exponentialBackoff: true,
        retryDelay: 100,
        backoffMultiplier: 2,
      };

      expect(calculateRetryDelay(1, config)).toBe(100);
      expect(calculateRetryDelay(2, config)).toBe(200);
      expect(calculateRetryDelay(3, config)).toBe(400);
    });

    it("respects max delay", () => {
      const config = {
        ...DEFAULT_RETRY_CONFIG,
        exponentialBackoff: true,
        retryDelay: 1000,
        backoffMultiplier: 10,
        maxDelay: 5000,
      };

      expect(calculateRetryDelay(3, config)).toBe(5000);
    });
  });

  describe("ErrorRetryManager class", () => {
    let manager: ErrorRetryManager;

    beforeEach(() => {
      manager = createRetryManager(TEST_CONFIG);
    });

    it("requires fix function to be set", async () => {
      const error = createErrorIdentifier("Test");

      await expect(manager.attemptFix(error)).rejects.toThrow("Fix function not set");
    });

    it("tracks multiple errors", async () => {
      manager.setFixFunction(createSucceedingFixFunction());

      const error1 = createErrorIdentifier("Error 1");
      const error2 = createErrorIdentifier("Error 2");

      await manager.attemptFix(error1);
      await manager.attemptFix(error2);

      const tracked = manager.getTrackedErrors();
      expect(tracked.length).toBe(2);
    });

    it("singleRetry performs one attempt", async () => {
      manager.setFixFunction(createFailingFixFunction());
      const error = createErrorIdentifier("Test");

      const attempt = await manager.singleRetry(error);

      expect(attempt).not.toBeNull();
      expect(attempt!.attemptNumber).toBe(1);
    });

    it("singleRetry returns null when exhausted", async () => {
      manager.setFixFunction(createFailingFixFunction());
      const error = createErrorIdentifier("Test");

      // Exhaust retries
      await manager.attemptFix(error);

      const attempt = await manager.singleRetry(error);

      expect(attempt).toBeNull();
    });

    it("canRetryError checks retry availability", async () => {
      manager.setFixFunction(createFailingFixFunction());
      const error = createErrorIdentifier("Test");

      expect(manager.canRetryError(error)).toBe(true);

      await manager.attemptFix(error);

      expect(manager.canRetryError(error)).toBe(false);
    });

    it("resetError clears state", async () => {
      manager.setFixFunction(createFailingFixFunction());
      const error = createErrorIdentifier("Test");

      await manager.attemptFix(error);
      manager.resetError(error);

      expect(manager.canRetryError(error)).toBe(true);
    });

    it("resetAll clears all states", async () => {
      manager.setFixFunction(createFailingFixFunction());

      await manager.attemptFix(createErrorIdentifier("Error 1"));
      await manager.attemptFix(createErrorIdentifier("Error 2"));

      manager.resetAll();

      expect(manager.getTrackedErrors().length).toBe(0);
    });

    it("getHistory returns attempt history", async () => {
      manager.setFixFunction(createMockFixFunction(2));
      const error = createErrorIdentifier("Test");

      await manager.attemptFix(error);

      const history = manager.getHistory(error);

      expect(history.length).toBe(2);
    });

    it("getStats provides statistics", async () => {
      manager.setFixFunction(createMockFixFunction(2));

      await manager.attemptFix(createErrorIdentifier("Error 1")); // Resolved on attempt 2

      manager.setFixFunction(createFailingFixFunction());
      await manager.attemptFix(createErrorIdentifier("Error 2")); // Exhausted

      const stats = manager.getStats();

      expect(stats.totalErrors).toBe(2);
      expect(stats.resolved).toBe(1);
      expect(stats.exhausted).toBe(1);
    });

    it("updates and gets config", () => {
      manager.updateConfig({ maxAttempts: 5 });
      const config = manager.getConfig();

      expect(config.maxAttempts).toBe(5);
    });
  });

  describe("formatRetryResult", () => {
    it("formats successful result", () => {
      const result = {
        success: true,
        successfulAttempt: {
          attemptNumber: 2,
          approach: "fuzzy_match" as RetryApproach,
          success: true,
          timestamp: Date.now(),
          duration: 10,
        },
        attempts: [],
        canRetry: false,
        state: createRetryState(createErrorIdentifier("Test")),
      };

      const formatted = formatRetryResult(result);

      expect(formatted).toContain("SUCCESS");
      expect(formatted).toContain("attempt 2");
      expect(formatted).toContain("fuzzy_match");
    });

    it("formats failed result with retry available", () => {
      const state = createRetryState(createErrorIdentifier("Test"));
      state.currentAttempt = 1;

      const result = {
        success: false,
        attempts: [],
        canRetry: true,
        nextApproach: "llm_generation" as RetryApproach,
        state,
      };

      const formatted = formatRetryResult(result);

      expect(formatted).toContain("FAILED");
      expect(formatted).toContain("Can retry");
      expect(formatted).toContain("llm_generation");
    });

    it("formats exhausted result", () => {
      const state = createRetryState(createErrorIdentifier("Test"));
      state.exhausted = true;

      const result = {
        success: false,
        attempts: [],
        canRetry: false,
        state,
      };

      const formatted = formatRetryResult(result);

      expect(formatted).toContain("exhausted");
    });
  });

  describe("getApproachDescription", () => {
    it("returns description for each approach", () => {
      expect(getApproachDescription("pattern_match")).toContain("pattern");
      expect(getApproachDescription("fuzzy_match")).toContain("fuzzy");
      expect(getApproachDescription("llm_generation")).toContain("LLM");
    });
  });

  describe("shouldEscalate", () => {
    it("returns true when exhausted and not resolved", () => {
      const state = createRetryState(createErrorIdentifier("Test"));
      state.exhausted = true;
      state.resolved = false;

      expect(shouldEscalate(state)).toBe(true);
    });

    it("returns false when resolved", () => {
      const state = createRetryState(createErrorIdentifier("Test"));
      state.exhausted = true;
      state.resolved = true;

      expect(shouldEscalate(state)).toBe(false);
    });

    it("returns false when not exhausted", () => {
      const state = createRetryState(createErrorIdentifier("Test"));
      state.exhausted = false;

      expect(shouldEscalate(state)).toBe(false);
    });
  });

  describe("mock fix functions", () => {
    it("createMockFixFunction succeeds on specified attempt", async () => {
      const fn = createMockFixFunction(2);

      expect((await fn(createErrorIdentifier("Test"), "pattern_match", 1)).success).toBe(false);
      expect((await fn(createErrorIdentifier("Test"), "pattern_match", 2)).success).toBe(true);
    });

    it("createFailingFixFunction always fails", async () => {
      const fn = createFailingFixFunction();

      expect((await fn(createErrorIdentifier("Test"), "pattern_match", 1)).success).toBe(false);
      expect((await fn(createErrorIdentifier("Test"), "pattern_match", 5)).success).toBe(false);
    });

    it("createSucceedingFixFunction always succeeds", async () => {
      const fn = createSucceedingFixFunction();

      expect((await fn(createErrorIdentifier("Test"), "pattern_match", 1)).success).toBe(true);
    });
  });

  describe("DEFAULT_RETRY_CONFIG", () => {
    it("has max 3 attempts", () => {
      expect(DEFAULT_RETRY_CONFIG.maxAttempts).toBe(3);
    });

    it("has sensible approach order", () => {
      expect(DEFAULT_RETRY_CONFIG.approachOrder).toContain("pattern_match");
      expect(DEFAULT_RETRY_CONFIG.approachOrder).toContain("fuzzy_match");
      expect(DEFAULT_RETRY_CONFIG.approachOrder).toContain("llm_generation");
    });
  });

  describe("APPROACH_DESCRIPTIONS", () => {
    it("has description for all approaches", () => {
      const approaches: RetryApproach[] = [
        "pattern_match",
        "fuzzy_match",
        "llm_generation",
        "context_expanded",
        "alternative_fix",
        "manual_hint",
      ];

      for (const approach of approaches) {
        expect(APPROACH_DESCRIPTIONS[approach]).toBeDefined();
        expect(APPROACH_DESCRIPTIONS[approach].length).toBeGreaterThan(0);
      }
    });
  });
});
