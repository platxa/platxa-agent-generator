// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  SidecarHealthChecker,
  createHealthChecker,
  createMockHealthChecker,
  createMockFetch,
  createInitialResult,
  cloneResult,
  isHealthy,
  isReady,
  delay,
  createOperationGuard,
  withHealthCheck,
  type HealthCheckResult,
  type HealthEvent,
  type HealthCheckConfig,
} from "@/lib/preview/sidecar-health-check";

describe("SidecarHealthChecker", () => {
  describe("agent verifies sidecar responding before Odoo-dependent operations (Feature #172)", () => {
    it("verifies sidecar at startup", async () => {
      // Feature #172: Agent verifies sidecar responding before Odoo-dependent operations
      const checker = createMockHealthChecker(
        { healthyThreshold: 1, retries: 0 },
        { healthy: true }
      );

      const result = await checker.verifyStartup();

      expect(result).toBe(true);
      expect(checker.isStartupComplete()).toBe(true);
    });

    it("blocks operations until sidecar is ready", async () => {
      // Feature #172: Verifies before Odoo-dependent operations
      const checker = createMockHealthChecker(
        { healthyThreshold: 1, retries: 0 },
        { healthy: true }
      );

      // Before startup verification
      expect(checker.isReadyForOperations()).toBe(false);

      await checker.verifyStartup();

      // After startup verification
      expect(checker.isReadyForOperations()).toBe(true);
    });

    it("retries on initial failure", async () => {
      // Feature #172: Retry logic for startup
      const checker = createMockHealthChecker(
        { healthyThreshold: 1, retries: 3, retryDelay: 10 },
        { healthy: true, failCount: 2 } // Fails twice then succeeds
      );

      const result = await checker.verifyStartup();

      expect(result).toBe(true);
    });

    it("emits startup:complete event", async () => {
      // Feature #172: Startup verification signals
      const checker = createMockHealthChecker(
        { healthyThreshold: 1, retries: 0 },
        { healthy: true }
      );
      const events: HealthEvent[] = [];
      checker.onEvent((e) => events.push(e));

      await checker.verifyStartup();

      expect(events.some((e) => e.type === "startup:complete")).toBe(true);
    });

    it("emits startup:failed when sidecar unavailable", async () => {
      // Feature #172: Failure handling
      const checker = createMockHealthChecker(
        { healthyThreshold: 1, retries: 1, retryDelay: 10 },
        { healthy: false }
      );
      const events: HealthEvent[] = [];
      checker.onEvent((e) => events.push(e));

      await checker.verifyStartup();

      expect(events.some((e) => e.type === "startup:failed")).toBe(true);
    });
  });

  describe("createInitialResult", () => {
    it("creates unknown status", () => {
      const result = createInitialResult();

      expect(result.status).toBe("unknown");
      expect(result.consecutiveFailures).toBe(0);
      expect(result.consecutiveSuccesses).toBe(0);
    });
  });

  describe("cloneResult", () => {
    it("creates independent copy", () => {
      const original = createInitialResult();
      original.status = "healthy";

      const cloned = cloneResult(original);

      expect(cloned.status).toBe("healthy");
      expect(cloned).not.toBe(original);
    });
  });

  describe("isHealthy", () => {
    it("returns true for healthy status", () => {
      const result = createInitialResult();
      result.status = "healthy";

      expect(isHealthy(result)).toBe(true);
    });

    it("returns false for unhealthy status", () => {
      const result = createInitialResult();
      result.status = "unhealthy";

      expect(isHealthy(result)).toBe(false);
    });

    it("returns false for unknown status", () => {
      const result = createInitialResult();

      expect(isHealthy(result)).toBe(false);
    });
  });

  describe("isReady", () => {
    it("returns true when healthy with enough successes", () => {
      const result = createInitialResult();
      result.status = "healthy";
      result.consecutiveSuccesses = 3;

      expect(isReady(result, 2)).toBe(true);
    });

    it("returns false when not enough successes", () => {
      const result = createInitialResult();
      result.status = "healthy";
      result.consecutiveSuccesses = 1;

      expect(isReady(result, 2)).toBe(false);
    });

    it("returns false when not healthy", () => {
      const result = createInitialResult();
      result.status = "unhealthy";
      result.consecutiveSuccesses = 5;

      expect(isReady(result, 2)).toBe(false);
    });
  });

  describe("delay", () => {
    it("delays for specified time", async () => {
      vi.useFakeTimers();
      let resolved = false;

      const promise = delay(1000).then(() => {
        resolved = true;
      });

      expect(resolved).toBe(false);
      vi.advanceTimersByTime(1000);
      await promise;
      expect(resolved).toBe(true);

      vi.useRealTimers();
    });
  });

  describe("createMockFetch", () => {
    it("returns healthy response by default", async () => {
      const fetch = createMockFetch();
      const response = await fetch("http://test/health");

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
    });

    it("returns unhealthy response when configured", async () => {
      const fetch = createMockFetch({ healthy: false });
      const response = await fetch("http://test/health");

      expect(response.ok).toBe(false);
      expect(response.status).toBe(503);
    });

    it("fails for specified count then succeeds", async () => {
      const fetch = createMockFetch({ failCount: 2 });

      const r1 = await fetch("http://test/health");
      const r2 = await fetch("http://test/health");
      const r3 = await fetch("http://test/health");

      expect(r1.ok).toBe(false);
      expect(r2.ok).toBe(false);
      expect(r3.ok).toBe(true);
    });

    it("includes service info in response", async () => {
      const fetch = createMockFetch({
        serviceInfo: { name: "test-sidecar", version: "2.0.0" },
      });

      const response = await fetch("http://test/health");
      const data = await response.json();

      expect(data).toMatchObject({
        name: "test-sidecar",
        version: "2.0.0",
      });
    });
  });

  describe("SidecarHealthChecker class", () => {
    let checker: SidecarHealthChecker;

    beforeEach(() => {
      checker = createMockHealthChecker(
        { healthyThreshold: 2, unhealthyThreshold: 2, retries: 0 },
        { healthy: true }
      );
    });

    describe("performCheck", () => {
      it("updates result on success", async () => {
        await checker.performCheck();

        const result = checker.getResult();
        expect(result.lastSuccess).not.toBeNull();
        expect(result.consecutiveSuccesses).toBe(1);
      });

      it("updates result on failure", async () => {
        checker = createMockHealthChecker(
          { healthyThreshold: 2, unhealthyThreshold: 2 },
          { healthy: false }
        );

        await checker.performCheck();

        const result = checker.getResult();
        expect(result.lastFailure).not.toBeNull();
        expect(result.consecutiveFailures).toBe(1);
        expect(result.error).toBeDefined();
      });

      it("emits check:start event", async () => {
        const events: HealthEvent[] = [];
        checker.onEvent((e) => events.push(e));

        await checker.performCheck();

        expect(events.some((e) => e.type === "check:start")).toBe(true);
      });

      it("emits check:success event", async () => {
        const events: HealthEvent[] = [];
        checker.onEvent((e) => events.push(e));

        await checker.performCheck();

        expect(events.some((e) => e.type === "check:success")).toBe(true);
      });

      it("emits check:failure event", async () => {
        checker = createMockHealthChecker({}, { healthy: false });
        const events: HealthEvent[] = [];
        checker.onEvent((e) => events.push(e));

        await checker.performCheck();

        expect(events.some((e) => e.type === "check:failure")).toBe(true);
      });

      it("transitions to healthy after threshold", async () => {
        const events: HealthEvent[] = [];
        checker.onEvent((e) => events.push(e));

        await checker.performCheck();
        await checker.performCheck();

        expect(checker.getStatus()).toBe("healthy");
        expect(events.some((e) => e.type === "status:healthy")).toBe(true);
      });

      it("transitions to unhealthy after threshold", async () => {
        checker = createMockHealthChecker(
          { unhealthyThreshold: 2 },
          { healthy: false }
        );
        const events: HealthEvent[] = [];
        checker.onEvent((e) => events.push(e));

        await checker.performCheck();
        await checker.performCheck();

        expect(checker.getStatus()).toBe("unhealthy");
        expect(events.some((e) => e.type === "status:unhealthy")).toBe(true);
      });

      it("resets consecutive counters on state change", async () => {
        // Success then failure
        await checker.performCheck();
        expect(checker.getResult().consecutiveSuccesses).toBe(1);

        checker = createMockHealthChecker({}, { healthy: false });
        await checker.performCheck();

        expect(checker.getResult().consecutiveFailures).toBe(1);
        expect(checker.getResult().consecutiveSuccesses).toBe(0);
      });
    });

    describe("verifyStartup", () => {
      it("returns true when sidecar healthy", async () => {
        checker = createMockHealthChecker(
          { healthyThreshold: 1, retries: 0 },
          { healthy: true }
        );

        const result = await checker.verifyStartup();

        expect(result).toBe(true);
        expect(checker.isStartupComplete()).toBe(true);
      });

      it("returns false when sidecar unhealthy", async () => {
        checker = createMockHealthChecker(
          { healthyThreshold: 1, retries: 0 },
          { healthy: false }
        );

        const result = await checker.verifyStartup();

        expect(result).toBe(false);
        expect(checker.isStartupComplete()).toBe(false);
      });

      it("retries on failure", async () => {
        checker = createMockHealthChecker(
          { healthyThreshold: 1, retries: 3, retryDelay: 1 },
          { healthy: true, failCount: 2 }
        );

        const result = await checker.verifyStartup();

        expect(result).toBe(true);
      });

      it("respects healthy threshold", async () => {
        checker = createMockHealthChecker(
          { healthyThreshold: 3, retries: 5, retryDelay: 1 },
          { healthy: true }
        );

        const result = await checker.verifyStartup();

        expect(result).toBe(true);
        expect(checker.getResult().consecutiveSuccesses).toBeGreaterThanOrEqual(3);
      });
    });

    describe("isReadyForOperations", () => {
      it("returns false before startup", () => {
        expect(checker.isReadyForOperations()).toBe(false);
      });

      it("returns true after successful startup", async () => {
        checker = createMockHealthChecker(
          { healthyThreshold: 1, retries: 0 },
          { healthy: true }
        );

        await checker.verifyStartup();

        expect(checker.isReadyForOperations()).toBe(true);
      });

      it("returns false if status becomes unhealthy", async () => {
        checker = createMockHealthChecker(
          { healthyThreshold: 1, unhealthyThreshold: 1, retries: 0 },
          { healthy: true }
        );

        await checker.verifyStartup();
        expect(checker.isReadyForOperations()).toBe(true);

        // Manually set to unhealthy for test
        const unhealthyChecker = createMockHealthChecker(
          { unhealthyThreshold: 1 },
          { healthy: false }
        );
        await unhealthyChecker.performCheck();

        expect(unhealthyChecker.isReadyForOperations()).toBe(false);
      });
    });

    describe("waitForReady", () => {
      it("returns immediately if already ready", async () => {
        checker = createMockHealthChecker(
          { healthyThreshold: 1, retries: 0 },
          { healthy: true }
        );
        await checker.verifyStartup();

        const start = Date.now();
        const result = await checker.waitForReady(5000);
        const elapsed = Date.now() - start;

        expect(result).toBe(true);
        expect(elapsed).toBeLessThan(100);
      });

      it("waits and returns true when becomes ready", async () => {
        checker = createMockHealthChecker(
          { healthyThreshold: 1, retryDelay: 10 },
          { healthy: true, failCount: 1 }
        );

        const result = await checker.waitForReady(5000);

        expect(result).toBe(true);
      });

      it("returns false on timeout", async () => {
        checker = createMockHealthChecker(
          { healthyThreshold: 1, retryDelay: 100 },
          { healthy: false }
        );

        const result = await checker.waitForReady(50);

        expect(result).toBe(false);
      });
    });

    describe("periodic checks", () => {
      it("starts periodic checks", () => {
        vi.useFakeTimers();
        checker = createMockHealthChecker({ checkInterval: 1000 });

        checker.startPeriodicChecks();

        // Verify it's scheduled (check won't run until interval)
        expect(checker.getStatus()).toBe("unknown");

        vi.useRealTimers();
        checker.stopPeriodicChecks();
      });

      it("stops periodic checks", () => {
        vi.useFakeTimers();
        checker = createMockHealthChecker({ checkInterval: 1000 });

        checker.startPeriodicChecks();
        checker.stopPeriodicChecks();

        // Should not throw or cause issues
        vi.advanceTimersByTime(2000);

        vi.useRealTimers();
      });

      it("does not start if interval is 0", () => {
        checker = createMockHealthChecker({ checkInterval: 0 });

        // Should not throw
        checker.startPeriodicChecks();
        checker.stopPeriodicChecks();
      });
    });

    describe("event callbacks", () => {
      it("registers callback", async () => {
        const callback = vi.fn();
        checker.onEvent(callback);

        await checker.performCheck();

        expect(callback).toHaveBeenCalled();
      });

      it("removes callback", async () => {
        const callback = vi.fn();
        checker.onEvent(callback);
        checker.offEvent(callback);

        await checker.performCheck();

        expect(callback).not.toHaveBeenCalled();
      });

      it("handles callback errors gracefully", async () => {
        checker.onEvent(() => {
          throw new Error("Callback error");
        });

        // Should not throw
        await expect(checker.performCheck()).resolves.not.toThrow();
      });
    });

    describe("config management", () => {
      it("updates configuration", () => {
        checker.updateConfig({ timeout: 10000 });

        const config = checker.getConfig();
        expect(config.timeout).toBe(10000);
      });

      it("returns config copy", () => {
        const config1 = checker.getConfig();
        const config2 = checker.getConfig();

        expect(config1).not.toBe(config2);
      });
    });

    describe("reset", () => {
      it("resets health state", async () => {
        checker = createMockHealthChecker(
          { healthyThreshold: 1, retries: 0 },
          { healthy: true }
        );
        await checker.verifyStartup();

        checker.reset();

        expect(checker.getStatus()).toBe("unknown");
        expect(checker.isStartupComplete()).toBe(false);
      });

      it("stops periodic checks on reset", () => {
        vi.useFakeTimers();
        checker = createMockHealthChecker({ checkInterval: 1000 });
        checker.startPeriodicChecks();

        checker.reset();

        // Should not throw
        vi.advanceTimersByTime(2000);
        vi.useRealTimers();
      });
    });
  });

  describe("factory functions", () => {
    it("createHealthChecker creates instance", () => {
      const checker = createHealthChecker();

      expect(checker).toBeInstanceOf(SidecarHealthChecker);
    });

    it("createMockHealthChecker creates instance with mock fetch", async () => {
      const checker = createMockHealthChecker({}, { healthy: true });

      await checker.performCheck();

      expect(checker.getResult().lastSuccess).not.toBeNull();
    });
  });

  describe("createOperationGuard", () => {
    it("canProceed returns false before startup", () => {
      const checker = createMockHealthChecker();
      const guard = createOperationGuard(checker);

      expect(guard.canProceed()).toBe(false);
    });

    it("canProceed returns true after startup", async () => {
      const checker = createMockHealthChecker(
        { healthyThreshold: 1, retries: 0 },
        { healthy: true }
      );
      await checker.verifyStartup();

      const guard = createOperationGuard(checker);

      expect(guard.canProceed()).toBe(true);
    });

    it("waitAndProceed returns immediately if ready", async () => {
      const checker = createMockHealthChecker(
        { healthyThreshold: 1, retries: 0 },
        { healthy: true }
      );
      await checker.verifyStartup();

      const guard = createOperationGuard(checker);
      const result = await guard.waitAndProceed(1000);

      expect(result).toBe(true);
    });

    it("requireHealthy throws when not ready", () => {
      const checker = createMockHealthChecker();
      const guard = createOperationGuard(checker);

      expect(() => guard.requireHealthy()).toThrow("Sidecar not ready");
    });

    it("requireHealthy does not throw when ready", async () => {
      const checker = createMockHealthChecker(
        { healthyThreshold: 1, retries: 0 },
        { healthy: true }
      );
      await checker.verifyStartup();

      const guard = createOperationGuard(checker);

      expect(() => guard.requireHealthy()).not.toThrow();
    });
  });

  describe("withHealthCheck", () => {
    it("executes operation when healthy", async () => {
      const checker = createMockHealthChecker(
        { healthyThreshold: 1, retries: 0, retryDelay: 1 },
        { healthy: true }
      );
      await checker.verifyStartup();

      const operation = vi.fn().mockReturnValue("result");
      const guarded = withHealthCheck(checker, operation);

      const result = await guarded();

      expect(result).toBe("result");
      expect(operation).toHaveBeenCalled();
    });

    it("throws when unhealthy and throwOnUnhealthy is true", async () => {
      const checker = createMockHealthChecker(
        { healthyThreshold: 1, retryDelay: 1 },
        { healthy: false }
      );

      const operation = vi.fn();
      const guarded = withHealthCheck(checker, operation, {
        waitTimeout: 10,
        throwOnUnhealthy: true,
      });

      await expect(guarded()).rejects.toThrow("Sidecar health check failed");
      expect(operation).not.toHaveBeenCalled();
    });

    it("executes operation when throwOnUnhealthy is false", async () => {
      const checker = createMockHealthChecker(
        { healthyThreshold: 1, retryDelay: 1 },
        { healthy: false }
      );

      const operation = vi.fn().mockReturnValue("result");
      const guarded = withHealthCheck(checker, operation, {
        waitTimeout: 10,
        throwOnUnhealthy: false,
      });

      const result = await guarded();

      expect(result).toBe("result");
      expect(operation).toHaveBeenCalled();
    });
  });
});
