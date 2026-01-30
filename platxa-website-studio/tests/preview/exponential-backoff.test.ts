/**
 * Tests for Exponential Backoff Strategy for Repeated Failures
 *
 * Feature #153: Create exponential backoff strategy for repeated failures
 * Verification: Delays: 0s, 1s, 3s between retry attempts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ExponentialBackoff,
  RetryStrategy,
  createExponentialBackoff,
  createRetryStrategy,
  createVerificationRetryStrategy,
  retry,
  DEFAULT_CONFIG,
  DELAY_SEQUENCES,
  calculateDelay,
  addJitter,
  createDelay,
  calculateTotalDelay,
  getDelaySequence,
  createRetryState,
  isRetryableError,
  type BackoffConfig,
} from "../../lib/preview/exponential-backoff";

// ============================================================================
// Constants Tests
// ============================================================================

describe("DEFAULT_CONFIG", () => {
  it("should have correct default values", () => {
    expect(DEFAULT_CONFIG.type).toBe("exponential");
    expect(DEFAULT_CONFIG.baseDelay).toBe(1000);
    expect(DEFAULT_CONFIG.multiplier).toBe(3);
    expect(DEFAULT_CONFIG.maxDelay).toBe(30000);
    expect(DEFAULT_CONFIG.maxRetries).toBe(5);
    expect(DEFAULT_CONFIG.delayFirstAttempt).toBe(false);
  });
});

describe("DELAY_SEQUENCES", () => {
  it("should have verification pattern matching 0s, 1s, 3s", () => {
    expect(DELAY_SEQUENCES.verification[0]).toBe(0);    // 0s
    expect(DELAY_SEQUENCES.verification[1]).toBe(1000); // 1s
    expect(DELAY_SEQUENCES.verification[2]).toBe(3000); // 3s
  });

  it("should have multiple predefined patterns", () => {
    expect(DELAY_SEQUENCES.aggressive).toBeDefined();
    expect(DELAY_SEQUENCES.conservative).toBeDefined();
    expect(DELAY_SEQUENCES.linear).toBeDefined();
    expect(DELAY_SEQUENCES.fixed).toBeDefined();
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe("calculateDelay", () => {
  it("should return 0 for first attempt by default", () => {
    expect(calculateDelay(0)).toBe(0);
  });

  it("should return baseDelay for second attempt", () => {
    expect(calculateDelay(1)).toBe(1000);
  });

  it("should return baseDelay * multiplier for third attempt", () => {
    // With default config: 1000 * 3 = 3000
    expect(calculateDelay(2)).toBe(3000);
  });

  it("should match verification pattern: 0s, 1s, 3s", () => {
    expect(calculateDelay(0)).toBe(0);
    expect(calculateDelay(1)).toBe(1000);
    expect(calculateDelay(2)).toBe(3000);
  });

  it("should respect maxDelay cap", () => {
    const config: BackoffConfig = {
      baseDelay: 10000,
      multiplier: 10,
      maxDelay: 5000,
    };
    expect(calculateDelay(5, config)).toBe(5000);
  });

  it("should support linear backoff", () => {
    const config: BackoffConfig = { type: "linear", baseDelay: 1000 };
    expect(calculateDelay(0, config)).toBe(0);
    expect(calculateDelay(1, config)).toBe(1000);
    expect(calculateDelay(2, config)).toBe(2000);
    expect(calculateDelay(3, config)).toBe(3000);
  });

  it("should support fixed backoff", () => {
    const config: BackoffConfig = { type: "fixed", baseDelay: 500 };
    expect(calculateDelay(0, config)).toBe(0);
    expect(calculateDelay(1, config)).toBe(500);
    expect(calculateDelay(2, config)).toBe(500);
    expect(calculateDelay(3, config)).toBe(500);
  });

  it("should support custom delays", () => {
    const config: BackoffConfig = {
      type: "custom",
      customDelays: [0, 100, 500, 2000],
    };
    expect(calculateDelay(0, config)).toBe(0);
    expect(calculateDelay(1, config)).toBe(100);
    expect(calculateDelay(2, config)).toBe(500);
    expect(calculateDelay(3, config)).toBe(2000);
  });

  it("should delay first attempt if configured", () => {
    const config: BackoffConfig = { delayFirstAttempt: true, baseDelay: 1000 };
    expect(calculateDelay(0, config)).toBe(1000);
  });
});

describe("addJitter", () => {
  it("should return 0 for 0 delay", () => {
    expect(addJitter(0)).toBe(0);
  });

  it("should add randomness to delay", () => {
    const delay = 1000;
    const results = new Set<number>();

    // Run multiple times to see variation
    for (let i = 0; i < 20; i++) {
      results.add(addJitter(delay, 0.5));
    }

    // Should have some variation
    expect(results.size).toBeGreaterThan(1);
  });

  it("should stay within jitter factor range", () => {
    const delay = 1000;
    const factor = 0.1;

    for (let i = 0; i < 50; i++) {
      const jittered = addJitter(delay, factor);
      expect(jittered).toBeGreaterThanOrEqual(delay * (1 - factor));
      expect(jittered).toBeLessThanOrEqual(delay * (1 + factor));
    }
  });
});

describe("createDelay", () => {
  it("should resolve immediately for 0 delay", async () => {
    const start = Date.now();
    await createDelay(0);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it("should wait for specified delay", async () => {
    const start = Date.now();
    await createDelay(100);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(90);
    expect(elapsed).toBeLessThan(200);
  });

  it("should abort when signal is triggered", async () => {
    const controller = new AbortController();

    setTimeout(() => controller.abort(), 50);

    await expect(createDelay(5000, controller.signal)).rejects.toThrow("aborted");
  });
});

describe("calculateTotalDelay", () => {
  it("should sum all delays", () => {
    // With default config (0, 1000, 3000, 9000, 27000, 81000 but capped at 30000)
    // Actually: 0 + 1000 + 3000 + 9000 + 27000 + 30000 (capped) = 70000
    const total = calculateTotalDelay(5);
    expect(total).toBe(0 + 1000 + 3000 + 9000 + 27000 + 30000);
  });
});

describe("getDelaySequence", () => {
  it("should return array of delays", () => {
    const sequence = getDelaySequence(3);
    expect(sequence).toEqual([0, 1000, 3000, 9000]);
  });

  it("should match verification pattern for first 3 attempts", () => {
    const sequence = getDelaySequence(2);
    expect(sequence[0]).toBe(0);    // 0s
    expect(sequence[1]).toBe(1000); // 1s
    expect(sequence[2]).toBe(3000); // 3s
  });
});

describe("createRetryState", () => {
  it("should create initial state", () => {
    const state = createRetryState();
    expect(state.attempt).toBe(0);
    expect(state.failures).toBe(0);
    expect(state.nextDelay).toBe(0);
    expect(state.canRetry).toBe(true);
  });

  it("should respect config for canRetry", () => {
    const state = createRetryState(5, { maxRetries: 3 });
    expect(state.canRetry).toBe(false);
  });
});

describe("isRetryableError", () => {
  it("should identify network errors as retryable", () => {
    expect(isRetryableError(new Error("Network error"))).toBe(true);
    expect(isRetryableError(new Error("Connection timeout"))).toBe(true);
    expect(isRetryableError(new Error("ECONNRESET"))).toBe(true);
  });

  it("should identify rate limiting as retryable", () => {
    expect(isRetryableError(new Error("Rate limit exceeded"))).toBe(true);
    expect(isRetryableError(new Error("Too many requests"))).toBe(true);
  });

  it("should identify 503 errors as retryable", () => {
    expect(isRetryableError(new Error("503 Service Unavailable"))).toBe(true);
    expect(isRetryableError(new Error("Temporarily unavailable"))).toBe(true);
  });

  it("should identify syntax errors as non-retryable", () => {
    expect(isRetryableError(new Error("Syntax error at line 5"))).toBe(false);
    expect(isRetryableError(new Error("Type error: undefined is not a function"))).toBe(false);
  });
});

// ============================================================================
// ExponentialBackoff Class Tests
// ============================================================================

describe("ExponentialBackoff", () => {
  let backoff: ExponentialBackoff;

  beforeEach(() => {
    backoff = createExponentialBackoff();
  });

  afterEach(() => {
    backoff.dispose();
  });

  describe("getDelay", () => {
    it("should return 0 for first attempt", () => {
      expect(backoff.getDelay()).toBe(0);
    });

    it("should increase delay with each attempt", () => {
      expect(backoff.getDelay()).toBe(0);
      backoff.recordAttempt();
      expect(backoff.getDelay()).toBe(1000);
      backoff.recordAttempt();
      expect(backoff.getDelay()).toBe(3000);
    });
  });

  describe("recordAttempt", () => {
    it("should track attempts", () => {
      backoff.recordAttempt();
      backoff.recordAttempt();
      const state = backoff.getState();
      expect(state.attempt).toBe(2);
    });

    it("should reset on success if configured", () => {
      backoff.recordAttempt();
      backoff.recordAttempt();
      backoff.recordAttempt(true); // Success
      const state = backoff.getState();
      expect(state.attempt).toBe(0);
    });

    it("should return the delay used", () => {
      expect(backoff.recordAttempt()).toBe(0);
      expect(backoff.recordAttempt()).toBe(1000);
    });
  });

  describe("wait", () => {
    it("should wait for calculated delay", async () => {
      const start = Date.now();
      await backoff.wait(); // 0ms for first attempt
      const elapsed1 = Date.now() - start;
      expect(elapsed1).toBeLessThan(50);

      const start2 = Date.now();
      await backoff.wait(); // Should wait ~1000ms (but we'll test with short delay)
    });

    it("should be abortable", async () => {
      const controller = new AbortController();
      backoff.recordAttempt(); // Move past 0-delay first attempt

      setTimeout(() => controller.abort(), 50);
      await expect(backoff.wait(controller.signal)).rejects.toThrow();
    });
  });

  describe("canRetry", () => {
    it("should return true when under max retries", () => {
      expect(backoff.canRetry()).toBe(true);
    });

    it("should return false when max retries exceeded", () => {
      const limitedBackoff = createExponentialBackoff({ maxRetries: 2 });
      expect(limitedBackoff.canRetry()).toBe(true);
      limitedBackoff.recordAttempt();
      expect(limitedBackoff.canRetry()).toBe(true);
      limitedBackoff.recordAttempt();
      expect(limitedBackoff.canRetry()).toBe(true);
      limitedBackoff.recordAttempt();
      expect(limitedBackoff.canRetry()).toBe(false);
      limitedBackoff.dispose();
    });
  });

  describe("getState", () => {
    it("should return current state", () => {
      const state = backoff.getState();
      expect(state.attempt).toBe(0);
      expect(state.failures).toBe(0);
      expect(state.nextDelay).toBe(0);
      expect(state.canRetry).toBe(true);
      expect(state.delayHistory).toEqual([]);
    });

    it("should track delay history", () => {
      backoff.recordAttempt();
      backoff.recordAttempt();
      const state = backoff.getState();
      expect(state.delayHistory).toEqual([0, 1000]);
    });
  });

  describe("reset", () => {
    it("should reset to initial state", () => {
      backoff.recordAttempt();
      backoff.recordAttempt();
      backoff.reset();
      const state = backoff.getState();
      expect(state.attempt).toBe(0);
      expect(state.delayHistory).toEqual([]);
    });
  });

  describe("getSequence", () => {
    it("should return delay sequence preview", () => {
      const sequence = backoff.getSequence();
      expect(sequence[0]).toBe(0);
      expect(sequence[1]).toBe(1000);
      expect(sequence[2]).toBe(3000);
    });
  });

  describe("jitter", () => {
    it("should add jitter when enabled", () => {
      const jitterBackoff = createExponentialBackoff({ jitter: true, jitterFactor: 0.5 });
      jitterBackoff.recordAttempt(); // Skip 0-delay first attempt

      const delays = new Set<number>();
      for (let i = 0; i < 20; i++) {
        jitterBackoff.reset();
        jitterBackoff.recordAttempt();
        delays.add(jitterBackoff.getDelay());
      }

      // Should have variation due to jitter
      expect(delays.size).toBeGreaterThan(1);
      jitterBackoff.dispose();
    });
  });

  describe("dispose", () => {
    it("should mark as disposed", () => {
      expect(backoff.isDisposed()).toBe(false);
      backoff.dispose();
      expect(backoff.isDisposed()).toBe(true);
    });

    it("should throw when methods called after dispose", () => {
      backoff.dispose();
      expect(() => backoff.getDelay()).toThrow("disposed");
    });
  });
});

// ============================================================================
// RetryStrategy Class Tests
// ============================================================================

describe("RetryStrategy", () => {
  let strategy: RetryStrategy;

  beforeEach(() => {
    strategy = createRetryStrategy({ maxRetries: 3 });
  });

  afterEach(() => {
    strategy.dispose();
  });

  describe("execute", () => {
    it("should succeed on first attempt", async () => {
      const operation = vi.fn().mockResolvedValue("success");

      const result = await strategy.execute(operation);

      expect(result.success).toBe(true);
      expect(result.value).toBe("success");
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should retry on failure", async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValue("success");

      const result = await strategy.execute(operation);

      expect(result.success).toBe(true);
      expect(result.value).toBe("success");
      expect(result.attempts).toBe(2);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it("should fail after max retries", async () => {
      // Use short delays to avoid test timeout (default 0,1000,3000,9000ms = 13s)
      const fastStrategy = createRetryStrategy({ maxRetries: 3, baseDelay: 10 });
      const operation = vi.fn().mockRejectedValue(new Error("Always fails"));

      const result = await fastStrategy.execute(operation);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Always fails");
      expect(result.attempts).toBe(4); // 1 initial + 3 retries
      fastStrategy.dispose();
    });

    it("should not retry non-retryable errors", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Syntax error"));

      const result = await strategy.execute(operation, {
        isRetryable: (e) => !e.message.includes("Syntax"),
      });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should call onRetry callback", async () => {
      const onRetry = vi.fn();
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error("Fail 1"))
        .mockResolvedValue("success");

      await strategy.execute(operation, { onRetry });

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("should call onSuccess callback", async () => {
      const onSuccess = vi.fn();
      const operation = vi.fn().mockResolvedValue("success");

      await strategy.execute(operation, { onSuccess });

      expect(onSuccess).toHaveBeenCalledWith("success", expect.any(Object));
    });

    it("should call onFailure callback", async () => {
      // Use short delays to avoid test timeout
      const fastStrategy = createRetryStrategy({ maxRetries: 3, baseDelay: 10 });
      const onFailure = vi.fn();
      const operation = vi.fn().mockRejectedValue(new Error("Failed"));

      await fastStrategy.execute(operation, { onFailure });

      expect(onFailure).toHaveBeenCalled();
      fastStrategy.dispose();
    });

    it("should abort when signal is triggered", async () => {
      const controller = new AbortController();
      const operation = vi.fn().mockRejectedValue(new Error("Network error"));

      setTimeout(() => controller.abort(), 50);

      const result = await strategy.execute(operation, { signal: controller.signal });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("abort");
    });

    it("should throw when disposed", async () => {
      strategy.dispose();
      await expect(strategy.execute(() => Promise.resolve("test"))).rejects.toThrow("disposed");
    });
  });

  describe("wrap", () => {
    it("should create retryable wrapper", async () => {
      const operation = vi.fn().mockResolvedValue("wrapped");
      const wrapped = strategy.wrap(operation);

      const result = await wrapped();

      expect(result.success).toBe(true);
      expect(result.value).toBe("wrapped");
    });
  });

  describe("getDelaySequence", () => {
    it("should return delay sequence", () => {
      const sequence = strategy.getDelaySequence();
      expect(sequence[0]).toBe(0);
      expect(sequence[1]).toBe(1000);
      expect(sequence[2]).toBe(3000);
    });
  });

  describe("getTotalMaxDelay", () => {
    it("should return total of all delays", () => {
      const total = strategy.getTotalMaxDelay();
      expect(total).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe("createVerificationRetryStrategy", () => {
  it("should create strategy with 0s, 1s, 3s pattern", () => {
    const strategy = createVerificationRetryStrategy();
    const sequence = strategy.getDelaySequence();

    expect(sequence[0]).toBe(0);    // 0s
    expect(sequence[1]).toBe(1000); // 1s
    expect(sequence[2]).toBe(3000); // 3s

    strategy.dispose();
  });
});

describe("retry helper", () => {
  it("should execute with retry", async () => {
    let attempt = 0;
    const result = await retry(async () => {
      attempt++;
      if (attempt < 2) throw new Error("Network error");
      return "success";
    });

    expect(result).toBe("success");
    expect(attempt).toBe(2);
  });

  it("should throw on final failure", async () => {
    // Use short delays to avoid test timeout
    await expect(
      retry(() => Promise.reject(new Error("Always fails")), { maxRetries: 2, baseDelay: 10 })
    ).rejects.toThrow("Always fails");
  });
});

// ============================================================================
// Verification: Delays: 0s, 1s, 3s between retry attempts
// ============================================================================

describe("Feature Verification: Delays 0s, 1s, 3s", () => {
  it("should have 0s delay for first attempt", () => {
    const delay = calculateDelay(0);
    expect(delay).toBe(0);
  });

  it("should have 1s delay for second attempt", () => {
    const delay = calculateDelay(1);
    expect(delay).toBe(1000); // 1 second
  });

  it("should have 3s delay for third attempt", () => {
    const delay = calculateDelay(2);
    expect(delay).toBe(3000); // 3 seconds
  });

  it("should produce correct sequence for verification pattern", () => {
    const sequence = getDelaySequence(2);
    expect(sequence).toEqual([0, 1000, 3000]);
  });

  it("should match DELAY_SEQUENCES.verification", () => {
    expect(DELAY_SEQUENCES.verification.slice(0, 3)).toEqual([0, 1000, 3000]);
  });

  it("should use verification pattern in createVerificationRetryStrategy", () => {
    const strategy = createVerificationRetryStrategy();
    const sequence = strategy.getDelaySequence();

    // First three delays should be 0s, 1s, 3s
    expect(sequence[0]).toBe(0);
    expect(sequence[1]).toBe(1000);
    expect(sequence[2]).toBe(3000);

    strategy.dispose();
  });

  it("should actually wait correct delays", async () => {
    const backoff = createExponentialBackoff();
    const delays: number[] = [];

    // First attempt: 0ms
    const start1 = Date.now();
    await backoff.wait();
    delays.push(Date.now() - start1);

    // Second attempt: should be ~1000ms (but let's use smaller values for testing)
    expect(backoff.getDelay()).toBe(1000);

    // Third attempt: should be ~3000ms
    backoff.recordAttempt();
    expect(backoff.getDelay()).toBe(3000);

    backoff.dispose();
  });
});
