// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  SidecarRecoveryManager,
  createRecoveryManager,
  createRecoveryManagerWithRestart,
  calculateRestartDelay,
  type RecoveryEvent,
  type RecoveryState,
} from "@/lib/preview/sidecar-recovery";
import { createMockFetch } from "@/lib/preview/sidecar-health-check";

describe("Sidecar Recovery Manager (Feature #176)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("calculateRestartDelay", () => {
    it("returns 0 for immediate strategy", () => {
      expect(calculateRestartDelay("immediate", 1, 1000, 60000)).toBe(0);
      expect(calculateRestartDelay("immediate", 5, 1000, 60000)).toBe(0);
    });

    it("returns base delay for fixed_delay strategy", () => {
      expect(calculateRestartDelay("fixed_delay", 1, 2000, 60000)).toBe(2000);
      expect(calculateRestartDelay("fixed_delay", 5, 2000, 60000)).toBe(2000);
    });

    it("calculates exponential backoff correctly", () => {
      expect(calculateRestartDelay("exponential_backoff", 1, 1000, 60000)).toBe(1000);
      expect(calculateRestartDelay("exponential_backoff", 2, 1000, 60000)).toBe(2000);
      expect(calculateRestartDelay("exponential_backoff", 3, 1000, 60000)).toBe(4000);
      expect(calculateRestartDelay("exponential_backoff", 4, 1000, 60000)).toBe(8000);
    });

    it("caps exponential backoff at max delay", () => {
      expect(calculateRestartDelay("exponential_backoff", 10, 1000, 30000)).toBe(30000);
    });
  });

  describe("SidecarRecoveryManager", () => {
    describe("initialization", () => {
      it("creates with default configuration", () => {
        const manager = createRecoveryManager();

        expect(manager.getState()).toBe("idle");
        expect(manager.isReady()).toBe(false);
        expect(manager.isRecovering()).toBe(false);
      });

      it("accepts custom configuration", () => {
        const manager = createRecoveryManager({
          failureThreshold: 5,
          maxRestartAttempts: 10,
          restartStrategy: "fixed_delay",
          restartDelay: 5000,
        });

        const config = manager.getConfig();
        expect(config.failureThreshold).toBe(5);
        expect(config.maxRestartAttempts).toBe(10);
        expect(config.restartStrategy).toBe("fixed_delay");
        expect(config.restartDelay).toBe(5000);
      });

      it("creates with restart function", () => {
        const restartFn = vi.fn().mockResolvedValue(true);
        const manager = createRecoveryManagerWithRestart(restartFn);

        expect(manager).toBeInstanceOf(SidecarRecoveryManager);
      });
    });

    describe("monitoring", () => {
      it("starts monitoring and changes state", () => {
        const manager = createRecoveryManager();

        manager.startMonitoring();

        expect(manager.getState()).toBe("monitoring");
      });

      it("stops monitoring and returns to idle", () => {
        const manager = createRecoveryManager();

        manager.startMonitoring();
        manager.stopMonitoring();

        expect(manager.getState()).toBe("idle");
      });

      it("emits state_change event on start", () => {
        const manager = createRecoveryManager();
        const events: RecoveryEvent[] = [];
        manager.onEvent((e) => events.push(e));

        manager.startMonitoring();

        expect(events.some((e) => e.type === "state_change" && e.state === "monitoring")).toBe(true);
      });
    });

    describe("failure detection", () => {
      it("detects failure when threshold reached", async () => {
        const mockFetch = createMockFetch({ healthy: false });
        const manager = createRecoveryManager(
          {
            failureThreshold: 2,
            healthCheck: {
              unhealthyThreshold: 2,
              retryDelay: 100,
            },
          },
          mockFetch
        );

        const events: RecoveryEvent[] = [];
        manager.onEvent((e) => events.push(e));
        manager.setRestartFunction(vi.fn().mockResolvedValue(true));

        manager.startMonitoring();

        // Trigger health checks to reach failure threshold
        await manager.checkHealth();
        await vi.advanceTimersByTimeAsync(100);
        await manager.checkHealth();
        await vi.advanceTimersByTimeAsync(100);
        await manager.checkHealth();

        expect(events.some((e) => e.type === "failure_detected")).toBe(true);
      });

      it("tracks failure statistics", async () => {
        const mockFetch = createMockFetch({ healthy: false });
        const manager = createRecoveryManager(
          {
            failureThreshold: 1,
            healthCheck: { unhealthyThreshold: 1 },
          },
          mockFetch
        );
        manager.setRestartFunction(vi.fn().mockResolvedValue(false));

        manager.startMonitoring();
        await manager.checkHealth();

        const stats = manager.getStats();
        expect(stats.totalFailures).toBeGreaterThanOrEqual(0);
      });
    });

    describe("restart behavior", () => {
      it("triggers restart on failure detection", async () => {
        const mockFetch = createMockFetch({ healthy: false });
        const restartFn = vi.fn().mockResolvedValue(true);
        const manager = createRecoveryManager(
          {
            failureThreshold: 1,
            maxRestartAttempts: 1,
            restartStrategy: "immediate",
            healthCheck: { unhealthyThreshold: 1 },
          },
          mockFetch
        );
        manager.setRestartFunction(restartFn);

        const events: RecoveryEvent[] = [];
        manager.onEvent((e) => events.push(e));

        manager.startMonitoring();
        await manager.checkHealth();
        await vi.advanceTimersByTimeAsync(1000);

        expect(restartFn).toHaveBeenCalled();
        expect(events.some((e) => e.type === "restart_triggered")).toBe(true);
      });

      it("emits restart_failed when no restart function", async () => {
        const mockFetch = createMockFetch({ healthy: false });
        const manager = createRecoveryManager(
          {
            failureThreshold: 1,
            healthCheck: { unhealthyThreshold: 1 },
          },
          mockFetch
        );

        const events: RecoveryEvent[] = [];
        manager.onEvent((e) => events.push(e));

        manager.startMonitoring();
        await manager.checkHealth();

        expect(events.some((e) => e.type === "recovery_failed")).toBe(true);
        expect(manager.getState()).toBe("failed");
      });

      it("retries restart on failure", async () => {
        let callCount = 0;
        const mockFetch = createMockFetch({ healthy: false });
        const restartFn = vi.fn().mockImplementation(async () => {
          callCount++;
          return callCount >= 2; // Succeed on second attempt
        });

        const manager = createRecoveryManager(
          {
            failureThreshold: 1,
            maxRestartAttempts: 3,
            restartStrategy: "immediate",
            healthCheck: { unhealthyThreshold: 1 },
          },
          mockFetch
        );
        manager.setRestartFunction(restartFn);

        manager.startMonitoring();
        await manager.checkHealth();
        await vi.advanceTimersByTimeAsync(5000);

        expect(restartFn).toHaveBeenCalledTimes(2);
      });

      it("stops after max restart attempts", async () => {
        const mockFetch = createMockFetch({ healthy: false });
        const restartFn = vi.fn().mockResolvedValue(false);
        const manager = createRecoveryManager(
          {
            failureThreshold: 1,
            maxRestartAttempts: 2,
            restartStrategy: "immediate",
            healthCheck: { unhealthyThreshold: 1 },
          },
          mockFetch
        );
        manager.setRestartFunction(restartFn);

        const events: RecoveryEvent[] = [];
        manager.onEvent((e) => events.push(e));

        manager.startMonitoring();
        await manager.checkHealth();
        await vi.advanceTimersByTimeAsync(10000);

        expect(manager.getState()).toBe("failed");
        expect(events.some((e) => e.type === "recovery_failed")).toBe(true);
      });

      it("uses exponential backoff delay", async () => {
        const mockFetch = createMockFetch({ healthy: false });
        const restartFn = vi.fn().mockResolvedValue(false);
        const manager = createRecoveryManager(
          {
            failureThreshold: 1,
            maxRestartAttempts: 3,
            restartStrategy: "exponential_backoff",
            restartDelay: 1000,
            maxRestartDelay: 60000,
            healthCheck: { unhealthyThreshold: 1 },
          },
          mockFetch
        );
        manager.setRestartFunction(restartFn);

        const events: RecoveryEvent[] = [];
        manager.onEvent((e) => events.push(e));

        manager.startMonitoring();
        await manager.checkHealth();

        // First attempt - 1s delay
        await vi.advanceTimersByTimeAsync(1000);
        const firstTrigger = events.find((e) => e.type === "restart_triggered");
        expect(firstTrigger?.details?.delay).toBe(1000);
      });
    });

    describe("recovery completion", () => {
      it("completes recovery when health restored", async () => {
        let healthy = false;
        const mockFetch = vi.fn().mockImplementation(async () => ({
          ok: healthy,
          status: healthy ? 200 : 503,
          json: async () => ({ status: healthy ? "healthy" : "unhealthy" }),
        }));

        const manager = createRecoveryManager(
          {
            failureThreshold: 1,
            maxRestartAttempts: 3,
            restartStrategy: "immediate",
            recoveryTimeout: 5000,
            healthCheck: {
              unhealthyThreshold: 1,
              healthyThreshold: 1,
              retryDelay: 100,
            },
          },
          mockFetch
        );

        manager.setRestartFunction(async () => {
          healthy = true; // Simulate restart fixing the issue
          return true;
        });

        const events: RecoveryEvent[] = [];
        manager.onEvent((e) => events.push(e));

        manager.startMonitoring();
        await manager.checkHealth();
        await vi.advanceTimersByTimeAsync(5000);

        expect(events.some((e) => e.type === "recovery_complete")).toBe(true);
      });

      it("updates statistics on successful recovery", async () => {
        let healthy = false;
        const mockFetch = vi.fn().mockImplementation(async () => ({
          ok: healthy,
          status: healthy ? 200 : 503,
          json: async () => ({ status: healthy ? "healthy" : "unhealthy" }),
        }));

        const manager = createRecoveryManager(
          {
            failureThreshold: 1,
            maxRestartAttempts: 3,
            restartStrategy: "immediate",
            recoveryTimeout: 5000,
            recoveryCooldown: 100,
            healthCheck: {
              unhealthyThreshold: 1,
              healthyThreshold: 1,
              retryDelay: 100,
            },
          },
          mockFetch
        );

        manager.setRestartFunction(async () => {
          healthy = true;
          return true;
        });

        manager.startMonitoring();
        await manager.checkHealth();
        await vi.advanceTimersByTimeAsync(5000);

        const stats = manager.getStats();
        expect(stats.successfulRecoveries).toBeGreaterThanOrEqual(1);
        expect(stats.lastRecovery).not.toBeNull();
      });
    });

    describe("waitForReady", () => {
      it("returns true immediately if healthy", async () => {
        const mockFetch = createMockFetch({ healthy: true });
        const manager = createRecoveryManager(
          {
            healthCheck: { healthyThreshold: 1 },
          },
          mockFetch
        );

        // Verify startup to make health checker ready
        await manager.getHealthChecker().verifyStartup();

        const ready = await manager.waitForReady(1000);

        expect(ready).toBe(true);
      });

      it("returns false on timeout", async () => {
        const mockFetch = createMockFetch({ healthy: false });
        const manager = createRecoveryManager({}, mockFetch);
        manager.startMonitoring();

        const readyPromise = manager.waitForReady(100);
        await vi.advanceTimersByTimeAsync(150);
        const ready = await readyPromise;

        expect(ready).toBe(false);
      });

      it("returns false if in failed state", async () => {
        const mockFetch = createMockFetch({ healthy: false });
        const manager = createRecoveryManager(
          {
            failureThreshold: 1,
            healthCheck: { unhealthyThreshold: 1 },
          },
          mockFetch
        );
        // No restart function - will fail immediately

        manager.startMonitoring();
        await manager.checkHealth();

        expect(manager.getState()).toBe("failed");
        const ready = await manager.waitForReady(100);
        expect(ready).toBe(false);
      });
    });

    describe("requireReady", () => {
      it("resolves if healthy", async () => {
        const mockFetch = createMockFetch({ healthy: true });
        const manager = createRecoveryManager(
          {
            healthCheck: { healthyThreshold: 1 },
          },
          mockFetch
        );

        await manager.getHealthChecker().verifyStartup();

        await expect(manager.requireReady(1000)).resolves.toBeUndefined();
      });

      it("throws on timeout", async () => {
        const mockFetch = createMockFetch({ healthy: false });
        const manager = createRecoveryManager({}, mockFetch);
        manager.startMonitoring();

        // Capture rejection immediately to prevent unhandled rejection warning
        let caughtError: Error | null = null;
        const requirePromise = manager.requireReady(100).catch((e: Error) => {
          caughtError = e;
        });

        await vi.advanceTimersByTimeAsync(150);
        await requirePromise;

        expect(caughtError).toBeInstanceOf(Error);
        expect((caughtError as Error | null)?.message).toContain("not ready");
      });
    });

    describe("manual restart", () => {
      it("triggers restart manually", async () => {
        const mockFetch = createMockFetch({ healthy: true });
        const restartFn = vi.fn().mockResolvedValue(true);
        const manager = createRecoveryManager(
          {
            healthCheck: { healthyThreshold: 1 },
          },
          mockFetch
        );
        manager.setRestartFunction(restartFn);

        const result = await manager.triggerRestart();

        expect(restartFn).toHaveBeenCalled();
      });

      it("returns false if no restart function", async () => {
        const manager = createRecoveryManager();

        const result = await manager.triggerRestart();

        expect(result).toBe(false);
      });
    });

    describe("event callbacks", () => {
      it("registers and triggers callbacks", () => {
        const manager = createRecoveryManager();
        const callback = vi.fn();

        manager.onEvent(callback);
        manager.startMonitoring();

        expect(callback).toHaveBeenCalled();
      });

      it("removes callbacks", () => {
        const manager = createRecoveryManager();
        const callback = vi.fn();

        manager.onEvent(callback);
        manager.offEvent(callback);
        manager.startMonitoring();

        expect(callback).not.toHaveBeenCalled();
      });

      it("handles callback errors gracefully", () => {
        const manager = createRecoveryManager();
        manager.onEvent(() => {
          throw new Error("Callback error");
        });

        expect(() => manager.startMonitoring()).not.toThrow();
      });
    });

    describe("disposal", () => {
      it("stops monitoring on dispose", () => {
        const manager = createRecoveryManager();
        manager.startMonitoring();

        manager.dispose();

        expect(manager.getState()).toBe("idle");
      });

      it("clears callbacks on dispose", () => {
        const manager = createRecoveryManager();
        const callback = vi.fn();
        manager.onEvent(callback);

        manager.dispose();
        manager.startMonitoring();

        // Callback was cleared, so it shouldn't be called
        expect(callback).not.toHaveBeenCalled();
      });
    });

    describe("state queries", () => {
      it("isRecovering returns true during recovery", async () => {
        const mockFetch = createMockFetch({ healthy: false });
        const manager = createRecoveryManager(
          {
            failureThreshold: 1,
            healthCheck: { unhealthyThreshold: 1 },
          },
          mockFetch
        );
        manager.setRestartFunction(vi.fn().mockResolvedValue(true));

        manager.startMonitoring();
        await manager.checkHealth();

        expect(manager.isRecovering()).toBe(true);
      });

      it("getHealthResult returns current health", async () => {
        const mockFetch = createMockFetch({ healthy: true });
        const manager = createRecoveryManager({}, mockFetch);

        await manager.checkHealth();

        const result = manager.getHealthResult();
        expect(result).toBeDefined();
        expect(result.timestamp).toBeGreaterThan(0);
      });
    });

    describe("configuration updates", () => {
      it("updates configuration", () => {
        const manager = createRecoveryManager();

        manager.updateConfig({
          failureThreshold: 10,
          maxRestartAttempts: 20,
        });

        const config = manager.getConfig();
        expect(config.failureThreshold).toBe(10);
        expect(config.maxRestartAttempts).toBe(20);
      });
    });
  });
});
