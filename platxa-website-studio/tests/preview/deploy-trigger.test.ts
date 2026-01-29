// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  DeployTrigger,
  createDeployTrigger,
  createMockDeployTrigger,
  createMockFetch,
  generateDeployId,
  createInitialState,
  cloneState,
  isDeployable,
  createSuccessResult,
  createFailureResult,
  type GenerationResult,
  type DeployRequest,
  type DeployResult,
  type DeployEvent,
  type DeployTriggerState,
} from "@/lib/preview/deploy-trigger";

describe("DeployTrigger", () => {
  describe("Deploy button appears after successful generation (Feature #177)", () => {
    it("shows deploy button after successful generation", () => {
      // Feature #177: 'Deploy' button appears after successful generation
      const trigger = createMockDeployTrigger();

      trigger.recordGeneration({
        id: "gen-1",
        status: "success",
        files: ["views/template.xml"],
        timestamp: Date.now(),
      });

      expect(trigger.isDeployButtonVisible()).toBe(true);
    });

    it("does not show deploy button after failed generation", () => {
      // Feature #177: Button only appears on success
      const trigger = createMockDeployTrigger();

      trigger.recordGeneration({
        id: "gen-1",
        status: "failed",
        error: "Generation error",
        timestamp: Date.now(),
      });

      expect(trigger.isDeployButtonVisible()).toBe(false);
    });

    it("triggers deployment flow when deploy is called", async () => {
      // Feature #177: triggers deployment flow
      const trigger = createMockDeployTrigger(
        {},
        { success: true, deployUrl: "https://preview.example.com" }
      );

      trigger.recordGeneration({
        id: "gen-1",
        status: "success",
        files: ["views/template.xml"],
        timestamp: Date.now(),
      });

      const result = await trigger.deploy();

      expect(result.success).toBe(true);
      expect(result.deployUrl).toBe("https://preview.example.com");
    });

    it("emits deploy:ready event after successful generation", () => {
      // Feature #177: Ready state for deployment
      const trigger = createMockDeployTrigger();
      const events: DeployEvent[] = [];
      trigger.onEvent((e) => events.push(e));

      trigger.recordGeneration({
        id: "gen-1",
        status: "success",
        timestamp: Date.now(),
      });

      expect(events.some((e) => e.type === "deploy:ready")).toBe(true);
    });

    it("emits button:show event when button becomes visible", () => {
      // Feature #177: Button visibility event
      const trigger = createMockDeployTrigger();
      const events: DeployEvent[] = [];
      trigger.onEvent((e) => events.push(e));

      trigger.recordGeneration({
        id: "gen-1",
        status: "success",
        timestamp: Date.now(),
      });

      expect(events.some((e) => e.type === "button:show")).toBe(true);
    });
  });

  describe("generateDeployId", () => {
    it("generates unique IDs", () => {
      const id1 = generateDeployId();
      const id2 = generateDeployId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^deploy-\d+-[a-z0-9]+$/);
    });
  });

  describe("createInitialState", () => {
    it("creates initial state with defaults", () => {
      const state = createInitialState();

      expect(state.status).toBe("idle");
      expect(state.latestGeneration).toBeNull();
      expect(state.showDeployButton).toBe(false);
      expect(state.currentDeploy).toBeNull();
      expect(state.lastResult).toBeNull();
    });
  });

  describe("cloneState", () => {
    it("creates a deep copy", () => {
      const state: DeployTriggerState = {
        status: "ready",
        latestGeneration: { id: "gen-1", status: "success", timestamp: Date.now() },
        showDeployButton: true,
        currentDeploy: null,
        lastResult: null,
        timestamp: Date.now(),
      };

      const clone = cloneState(state);

      expect(clone).not.toBe(state);
      expect(clone.latestGeneration).not.toBe(state.latestGeneration);
      expect(clone).toEqual(state);
    });
  });

  describe("isDeployable", () => {
    it("returns true for successful generation", () => {
      const generation: GenerationResult = {
        id: "gen-1",
        status: "success",
        timestamp: Date.now(),
      };

      expect(isDeployable(generation)).toBe(true);
    });

    it("returns false for failed generation", () => {
      const generation: GenerationResult = {
        id: "gen-1",
        status: "failed",
        timestamp: Date.now(),
      };

      expect(isDeployable(generation)).toBe(false);
    });

    it("returns false for null", () => {
      expect(isDeployable(null)).toBe(false);
    });
  });

  describe("createSuccessResult", () => {
    it("creates success result", () => {
      const request: DeployRequest = {
        generation: { id: "gen-1", status: "success", timestamp: Date.now() },
        target: "preview",
      };
      const result = createSuccessResult(request, 1000, "https://test.com", ["Warning"]);

      expect(result.success).toBe(true);
      expect(result.status).toBe("success");
      expect(result.duration).toBe(1000);
      expect(result.deployUrl).toBe("https://test.com");
      expect(result.warnings).toContain("Warning");
    });
  });

  describe("createFailureResult", () => {
    it("creates failure result", () => {
      const request: DeployRequest = {
        generation: { id: "gen-1", status: "success", timestamp: Date.now() },
        target: "preview",
      };
      const result = createFailureResult(request, "Error", 500, "Details");

      expect(result.success).toBe(false);
      expect(result.status).toBe("failed");
      expect(result.error).toBe("Error");
      expect(result.errorDetails).toBe("Details");
    });
  });

  describe("createMockFetch", () => {
    it("returns success by default", async () => {
      const fetch = createMockFetch();
      const response = await fetch("http://test", {
        method: "POST",
        headers: {},
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it("returns failure when configured", async () => {
      const fetch = createMockFetch({ success: false, error: "Failed" });
      const response = await fetch("http://test", {
        method: "POST",
        headers: {},
      });

      expect(response.ok).toBe(false);
      const data = await response.json();
      expect(data.error).toBe("Failed");
    });

    it("fails for specified count then succeeds", async () => {
      const fetch = createMockFetch({ failCount: 2 });

      const r1 = await fetch("http://test", { method: "POST", headers: {} });
      const r2 = await fetch("http://test", { method: "POST", headers: {} });
      const r3 = await fetch("http://test", { method: "POST", headers: {} });

      expect(r1.ok).toBe(false);
      expect(r2.ok).toBe(false);
      expect(r3.ok).toBe(true);
    });
  });

  describe("DeployTrigger class", () => {
    let trigger: DeployTrigger;

    beforeEach(() => {
      trigger = createMockDeployTrigger(
        { retryOnError: false },
        { success: true }
      );
    });

    describe("recordGeneration", () => {
      it("updates state with generation result", () => {
        trigger.recordGeneration({
          id: "gen-1",
          status: "success",
          timestamp: Date.now(),
        });

        const state = trigger.getState();
        expect(state.latestGeneration?.id).toBe("gen-1");
      });

      it("sets status to ready on success", () => {
        trigger.recordGeneration({
          id: "gen-1",
          status: "success",
          timestamp: Date.now(),
        });

        expect(trigger.getStatus()).toBe("ready");
      });

      it("sets status to idle on failure", () => {
        trigger.recordGeneration({
          id: "gen-1",
          status: "failed",
          timestamp: Date.now(),
        });

        expect(trigger.getStatus()).toBe("idle");
      });

      it("emits generation:success event", () => {
        const events: DeployEvent[] = [];
        trigger.onEvent((e) => events.push(e));

        trigger.recordGeneration({
          id: "gen-1",
          status: "success",
          timestamp: Date.now(),
        });

        expect(events.some((e) => e.type === "generation:success")).toBe(true);
      });

      it("emits generation:failed event", () => {
        const events: DeployEvent[] = [];
        trigger.onEvent((e) => events.push(e));

        trigger.recordGeneration({
          id: "gen-1",
          status: "failed",
          timestamp: Date.now(),
        });

        expect(events.some((e) => e.type === "generation:failed")).toBe(true);
      });
    });

    describe("showDeployButton / hideDeployButton", () => {
      it("shows button", () => {
        trigger.showDeployButton();
        expect(trigger.isDeployButtonVisible()).toBe(true);
      });

      it("hides button", () => {
        trigger.showDeployButton();
        trigger.hideDeployButton();
        expect(trigger.isDeployButtonVisible()).toBe(false);
      });

      it("emits button:show event", () => {
        const events: DeployEvent[] = [];
        trigger.onEvent((e) => events.push(e));

        trigger.showDeployButton();

        expect(events.some((e) => e.type === "button:show")).toBe(true);
      });

      it("emits button:hide event", () => {
        trigger.showDeployButton();
        const events: DeployEvent[] = [];
        trigger.onEvent((e) => events.push(e));

        trigger.hideDeployButton();

        expect(events.some((e) => e.type === "button:hide")).toBe(true);
      });

      it("does not emit if already in desired state", () => {
        const events: DeployEvent[] = [];
        trigger.onEvent((e) => events.push(e));

        trigger.hideDeployButton(); // Already hidden

        expect(events.filter((e) => e.type === "button:hide").length).toBe(0);
      });
    });

    describe("deploy", () => {
      beforeEach(() => {
        trigger.recordGeneration({
          id: "gen-1",
          status: "success",
          files: ["views/template.xml"],
          timestamp: Date.now(),
        });
      });

      it("returns success result", async () => {
        const result = await trigger.deploy();

        expect(result.success).toBe(true);
        expect(result.status).toBe("success");
      });

      it("includes deploy URL", async () => {
        trigger = createMockDeployTrigger(
          { retryOnError: false },
          { success: true, deployUrl: "https://deploy.example.com" }
        );
        trigger.recordGeneration({
          id: "gen-1",
          status: "success",
          timestamp: Date.now(),
        });

        const result = await trigger.deploy();

        expect(result.deployUrl).toBe("https://deploy.example.com");
      });

      it("uses specified target", async () => {
        const result = await trigger.deploy({ target: "staging" });

        expect(result.target).toBe("staging");
      });

      it("returns failure when no generation", async () => {
        trigger = createMockDeployTrigger({ retryOnError: false });

        const result = await trigger.deploy();

        expect(result.success).toBe(false);
        expect(result.error).toContain("No successful generation");
      });

      it("emits deploy:start event", async () => {
        const events: DeployEvent[] = [];
        trigger.onEvent((e) => events.push(e));

        await trigger.deploy();

        expect(events.some((e) => e.type === "deploy:start")).toBe(true);
      });

      it("emits deploy:success event", async () => {
        const events: DeployEvent[] = [];
        trigger.onEvent((e) => events.push(e));

        await trigger.deploy();

        expect(events.some((e) => e.type === "deploy:success")).toBe(true);
      });

      it("emits deploy:failed event on error", async () => {
        trigger = createMockDeployTrigger(
          { retryOnError: false },
          { success: false, error: "Deploy failed" }
        );
        trigger.recordGeneration({
          id: "gen-1",
          status: "success",
          timestamp: Date.now(),
        });

        const events: DeployEvent[] = [];
        trigger.onEvent((e) => events.push(e));

        await trigger.deploy();

        expect(events.some((e) => e.type === "deploy:failed")).toBe(true);
      });

      it("updates status during deployment", async () => {
        const fetchMock = vi.fn().mockImplementation(async () => {
          // Check status during deployment
          expect(trigger.getStatus()).toBe("deploying");
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true }),
          };
        });

        trigger = createDeployTrigger({ retryOnError: false }, fetchMock);
        trigger.recordGeneration({
          id: "gen-1",
          status: "success",
          timestamp: Date.now(),
        });

        await trigger.deploy();
      });
    });

    describe("retry logic", () => {
      it("retries on failure", async () => {
        trigger = createMockDeployTrigger(
          { retryOnError: true, maxRetries: 2, retryDelay: 10 },
          { failCount: 1 }
        );
        trigger.recordGeneration({
          id: "gen-1",
          status: "success",
          timestamp: Date.now(),
        });

        const result = await trigger.deploy();

        expect(result.success).toBe(true);
      });

      it("respects maxRetries", async () => {
        trigger = createMockDeployTrigger(
          { retryOnError: true, maxRetries: 1, retryDelay: 10 },
          { failCount: 5 }
        );
        trigger.recordGeneration({
          id: "gen-1",
          status: "success",
          timestamp: Date.now(),
        });

        const result = await trigger.deploy();

        expect(result.success).toBe(false);
      });

      it("emits progress events during retry", async () => {
        trigger = createMockDeployTrigger(
          { retryOnError: true, maxRetries: 2, retryDelay: 10 },
          { failCount: 1 }
        );
        trigger.recordGeneration({
          id: "gen-1",
          status: "success",
          timestamp: Date.now(),
        });

        const events: DeployEvent[] = [];
        trigger.onEvent((e) => events.push(e));

        await trigger.deploy();

        expect(events.some((e) => e.type === "deploy:progress")).toBe(true);
      });
    });

    describe("cancelDeploy", () => {
      it("cancels active deployment", async () => {
        const slowFetch = vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true }),
          };
        });

        trigger = createDeployTrigger({ retryOnError: false }, slowFetch);
        trigger.recordGeneration({
          id: "gen-1",
          status: "success",
          timestamp: Date.now(),
        });

        const deployPromise = trigger.deploy();

        await new Promise((resolve) => setTimeout(resolve, 50));
        const cancelled = trigger.cancelDeploy();

        expect(cancelled).toBe(true);

        const result = await deployPromise;
        expect(result.status).toBe("cancelled");
      });

      it("returns false when no active deployment", () => {
        const cancelled = trigger.cancelDeploy();
        expect(cancelled).toBe(false);
      });

      it("emits deploy:cancelled event", async () => {
        const slowFetch = vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return { ok: true, status: 200, json: async () => ({ success: true }) };
        });

        trigger = createDeployTrigger({ retryOnError: false }, slowFetch);
        trigger.recordGeneration({
          id: "gen-1",
          status: "success",
          timestamp: Date.now(),
        });

        const events: DeployEvent[] = [];
        trigger.onEvent((e) => events.push(e));

        const deployPromise = trigger.deploy();

        await new Promise((resolve) => setTimeout(resolve, 50));
        trigger.cancelDeploy();

        await deployPromise;

        expect(events.some((e) => e.type === "deploy:cancelled")).toBe(true);
      });
    });

    describe("isDeploying", () => {
      it("returns true during deployment", async () => {
        const slowFetch = vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return { ok: true, status: 200, json: async () => ({ success: true }) };
        });

        trigger = createDeployTrigger({ retryOnError: false }, slowFetch);
        trigger.recordGeneration({
          id: "gen-1",
          status: "success",
          timestamp: Date.now(),
        });

        const deployPromise = trigger.deploy();

        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(trigger.isDeploying()).toBe(true);

        trigger.cancelDeploy();
        await deployPromise;
      });

      it("returns false when not deploying", () => {
        expect(trigger.isDeploying()).toBe(false);
      });
    });

    describe("isReadyToDeploy", () => {
      it("returns true when ready with successful generation", () => {
        trigger.recordGeneration({
          id: "gen-1",
          status: "success",
          timestamp: Date.now(),
        });

        expect(trigger.isReadyToDeploy()).toBe(true);
      });

      it("returns false when no generation", () => {
        expect(trigger.isReadyToDeploy()).toBe(false);
      });

      it("returns false when generation failed", () => {
        trigger.recordGeneration({
          id: "gen-1",
          status: "failed",
          timestamp: Date.now(),
        });

        expect(trigger.isReadyToDeploy()).toBe(false);
      });
    });

    describe("event callbacks", () => {
      it("registers callback", () => {
        const callback = vi.fn();
        trigger.onEvent(callback);

        trigger.recordGeneration({
          id: "gen-1",
          status: "success",
          timestamp: Date.now(),
        });

        expect(callback).toHaveBeenCalled();
      });

      it("removes callback", () => {
        const callback = vi.fn();
        trigger.onEvent(callback);
        trigger.offEvent(callback);

        trigger.recordGeneration({
          id: "gen-1",
          status: "success",
          timestamp: Date.now(),
        });

        expect(callback).not.toHaveBeenCalled();
      });

      it("handles callback errors gracefully", () => {
        trigger.onEvent(() => {
          throw new Error("Callback error");
        });

        expect(() =>
          trigger.recordGeneration({
            id: "gen-1",
            status: "success",
            timestamp: Date.now(),
          })
        ).not.toThrow();
      });
    });

    describe("config management", () => {
      it("updates configuration", () => {
        trigger.updateConfig({ timeout: 30000 });

        const config = trigger.getConfig();
        expect(config.timeout).toBe(30000);
      });

      it("returns config copy", () => {
        const config1 = trigger.getConfig();
        const config2 = trigger.getConfig();

        expect(config1).not.toBe(config2);
      });
    });

    describe("reset", () => {
      it("resets to initial state", async () => {
        trigger.recordGeneration({
          id: "gen-1",
          status: "success",
          timestamp: Date.now(),
        });

        trigger.reset();

        expect(trigger.getStatus()).toBe("idle");
        expect(trigger.isDeployButtonVisible()).toBe(false);
        expect(trigger.getState().latestGeneration).toBeNull();
      });

      it("cancels active deployment", async () => {
        const slowFetch = vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return { ok: true, status: 200, json: async () => ({ success: true }) };
        });

        trigger = createDeployTrigger({ retryOnError: false }, slowFetch);
        trigger.recordGeneration({
          id: "gen-1",
          status: "success",
          timestamp: Date.now(),
        });

        const deployPromise = trigger.deploy();

        await new Promise((resolve) => setTimeout(resolve, 50));
        trigger.reset();

        const result = await deployPromise;
        expect(result.status).toBe("cancelled");
      });
    });
  });

  describe("factory functions", () => {
    it("createDeployTrigger creates instance", () => {
      const trigger = createDeployTrigger();

      expect(trigger).toBeInstanceOf(DeployTrigger);
    });

    it("createMockDeployTrigger creates instance with mock", async () => {
      const trigger = createMockDeployTrigger({}, { success: true });
      trigger.recordGeneration({
        id: "gen-1",
        status: "success",
        timestamp: Date.now(),
      });

      const result = await trigger.deploy();

      expect(result.success).toBe(true);
    });
  });
});
