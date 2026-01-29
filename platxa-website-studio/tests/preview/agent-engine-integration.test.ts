// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AgentEngineIntegration,
  createAgentEngineIntegration,
  createIntegrationWithOrchestrator,
  createMockOrchestrator,
  createGenerationInput,
  getStepDuration,
  isTerminalStatus,
  formatStep,
  type GenerationStep,
  type GenerationInput,
  type FrontendOrchestrator,
  type IntegrationEvent,
} from "@/lib/preview/agent-engine-integration";

describe("AgentEngineIntegration", () => {
  describe("Agent Engine calls FrontendOrchestrator.process() (Feature #162)", () => {
    it("calls FrontendOrchestrator.process() when executing step", async () => {
      // Feature #162: Agent Engine calls FrontendOrchestrator.process()
      const orchestrator = createMockOrchestrator();
      const processSpy = vi.spyOn(orchestrator, "process");
      const integration = createIntegrationWithOrchestrator(orchestrator);

      const step = integration.createStep("frontend", {
        prompt: "Generate a button component",
      });

      await integration.executeStep(step);

      expect(processSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "Generate a button component",
        })
      );
    });

    it("processes frontend generation steps", async () => {
      // Feature #162: Agent Engine calls FrontendOrchestrator.process() for generation steps
      const orchestrator = createMockOrchestrator();
      const integration = createIntegrationWithOrchestrator(orchestrator);

      const result = await integration.processFrontendGeneration(
        "Create a user profile component"
      );

      expect(result.status).toBe("completed");
      expect(result.output).toBeDefined();
      expect(result.output?.content).toContain("Create a user profile component");
    });

    it("passes context to FrontendOrchestrator", async () => {
      // Feature #162: Context is passed to orchestrator
      const orchestrator = createMockOrchestrator();
      const processSpy = vi.spyOn(orchestrator, "process");
      const integration = createIntegrationWithOrchestrator(orchestrator);

      await integration.processFrontendGeneration(
        "Update component",
        { currentContent: "existing code" },
        { streaming: true }
      );

      expect(processSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          context: { currentContent: "existing code" },
          options: { streaming: true },
        })
      );
    });

    it("returns generated output from orchestrator", async () => {
      // Feature #162: Generation output is returned
      const orchestrator = createMockOrchestrator();
      const integration = createIntegrationWithOrchestrator(orchestrator);

      const result = await integration.processFrontendGeneration("Generate form");

      expect(result.output?.content).toBeDefined();
      expect(result.output?.contentType).toBe("text/typescript");
    });
  });

  describe("orchestrator connection", () => {
    it("connects orchestrator", () => {
      const integration = createAgentEngineIntegration();
      const orchestrator = createMockOrchestrator();

      integration.connect(orchestrator);

      expect(integration.isReady()).toBe(true);
    });

    it("disconnects orchestrator", () => {
      const orchestrator = createMockOrchestrator();
      const integration = createIntegrationWithOrchestrator(orchestrator);

      integration.disconnect();

      expect(integration.isReady()).toBe(false);
    });

    it("isReady returns false when no orchestrator", () => {
      const integration = createAgentEngineIntegration();

      expect(integration.isReady()).toBe(false);
    });

    it("isReady returns false when orchestrator not ready", () => {
      const orchestrator = createMockOrchestrator({ isReady: false });
      const integration = createIntegrationWithOrchestrator(orchestrator);

      expect(integration.isReady()).toBe(false);
    });

    it("emits connected event", () => {
      const integration = createAgentEngineIntegration();
      const listener = vi.fn();
      integration.addEventListener(listener);

      integration.connect(createMockOrchestrator());

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: "orchestrator:connected" })
      );
    });

    it("emits disconnected event", () => {
      const orchestrator = createMockOrchestrator();
      const integration = createIntegrationWithOrchestrator(orchestrator);
      const listener = vi.fn();
      integration.addEventListener(listener);

      integration.disconnect();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: "orchestrator:disconnected" })
      );
    });
  });

  describe("step execution", () => {
    let integration: AgentEngineIntegration;
    let orchestrator: FrontendOrchestrator;

    beforeEach(() => {
      orchestrator = createMockOrchestrator();
      integration = createIntegrationWithOrchestrator(orchestrator);
    });

    it("creates step with pending status", () => {
      const step = integration.createStep("frontend", { prompt: "Test" });

      expect(step.status).toBe("pending");
      expect(step.id).toBeDefined();
    });

    it("updates step to processing during execution", async () => {
      const listener = vi.fn();
      integration.addEventListener(listener);

      const step = integration.createStep("frontend", { prompt: "Test" });
      await integration.executeStep(step);

      // Event should contain snapshot with "processing" status at time of emission
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "step:started",
          step: expect.objectContaining({ status: "processing" }),
        })
      );
    });

    it("updates step to completed on success", async () => {
      const step = integration.createStep("frontend", { prompt: "Test" });
      const result = await integration.executeStep(step);

      expect(result.status).toBe("completed");
      expect(result.output).toBeDefined();
      expect(result.endTime).toBeDefined();
    });

    it("updates step to failed on error", async () => {
      const failingOrchestrator = createMockOrchestrator({ failProcess: true });
      integration = createIntegrationWithOrchestrator(failingOrchestrator, {
        autoRetry: false,
      });

      const step = integration.createStep("frontend", { prompt: "Test" });
      const result = await integration.executeStep(step);

      expect(result.status).toBe("failed");
      expect(result.error).toBeDefined();
    });

    it("emits step:completed event on success", async () => {
      const listener = vi.fn();
      integration.addEventListener(listener);

      const step = integration.createStep("frontend", { prompt: "Test" });
      await integration.executeStep(step);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "step:completed",
          step: expect.objectContaining({ status: "completed" }),
        })
      );
    });

    it("emits step:failed event on failure", async () => {
      const failingOrchestrator = createMockOrchestrator({ failProcess: true });
      integration = createIntegrationWithOrchestrator(failingOrchestrator, {
        autoRetry: false,
      });
      const listener = vi.fn();
      integration.addEventListener(listener);

      const step = integration.createStep("frontend", { prompt: "Test" });
      await integration.executeStep(step);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "step:failed",
          error: expect.any(String),
        })
      );
    });

    it("fails when no orchestrator connected", async () => {
      const noOrchestratorIntegration = createAgentEngineIntegration();
      const step = noOrchestratorIntegration.createStep("frontend", { prompt: "Test" });

      const result = await noOrchestratorIntegration.executeStep(step);

      expect(result.status).toBe("failed");
      expect(result.error).toContain("No orchestrator");
    });

    it("fails when orchestrator not ready", async () => {
      const notReadyOrchestrator = createMockOrchestrator({ isReady: false });
      integration = createIntegrationWithOrchestrator(notReadyOrchestrator);

      const step = integration.createStep("frontend", { prompt: "Test" });
      const result = await integration.executeStep(step);

      expect(result.status).toBe("failed");
      expect(result.error).toContain("not ready");
    });
  });

  describe("retry logic", () => {
    it("retries on failure when autoRetry enabled", async () => {
      let attempts = 0;
      const orchestrator: FrontendOrchestrator = {
        async process(input) {
          attempts++;
          if (attempts < 2) {
            throw new Error("Temporary failure");
          }
          return { content: "Success", contentType: "text" };
        },
        isReady: () => true,
        getStatus: () => ({ isProcessing: false, queueLength: 0 }),
        cancel: () => {},
      };

      const integration = createIntegrationWithOrchestrator(orchestrator, {
        autoRetry: true,
        maxRetries: 3,
        retryDelay: 10,
      });

      const step = integration.createStep("frontend", { prompt: "Test" });
      const result = await integration.executeStep(step);

      expect(result.status).toBe("completed");
      expect(attempts).toBe(2);
    });

    it("fails after max retries exceeded", async () => {
      const failingOrchestrator = createMockOrchestrator({ failProcess: true });
      const integration = createIntegrationWithOrchestrator(failingOrchestrator, {
        autoRetry: true,
        maxRetries: 2,
        retryDelay: 10,
      });

      const step = integration.createStep("frontend", { prompt: "Test" });
      const result = await integration.executeStep(step);

      expect(result.status).toBe("failed");
    });

    it("does not retry when autoRetry disabled", async () => {
      let attempts = 0;
      const orchestrator: FrontendOrchestrator = {
        async process() {
          attempts++;
          throw new Error("Failure");
        },
        isReady: () => true,
        getStatus: () => ({ isProcessing: false, queueLength: 0 }),
        cancel: () => {},
      };

      const integration = createIntegrationWithOrchestrator(orchestrator, {
        autoRetry: false,
      });

      const step = integration.createStep("frontend", { prompt: "Test" });
      await integration.executeStep(step);

      expect(attempts).toBe(1);
    });
  });

  describe("step cancellation", () => {
    it("returns false when cancelling non-existent step", () => {
      const integration = createIntegrationWithOrchestrator(createMockOrchestrator());

      expect(integration.cancelStep("non-existent")).toBe(false);
    });

    it("returns false when step is not processing", async () => {
      const integration = createIntegrationWithOrchestrator(createMockOrchestrator());

      // Create a step but don't execute it
      const step = integration.createStep("frontend", { prompt: "Test" });

      // Step is pending, not processing
      expect(integration.cancelStep(step.id)).toBe(false);
    });

    it("cancelStep updates step status when called on processing step", () => {
      const integration = createIntegrationWithOrchestrator(createMockOrchestrator());

      // Manually create a step in processing state for unit test
      const step = integration.createStep("frontend", { prompt: "Test" });
      // Simulate the step being in processing state
      (step as { status: string }).status = "processing";

      const cancelled = integration.cancelStep(step.id);

      expect(cancelled).toBe(true);
      expect(step.status).toBe("cancelled");
      expect(step.endTime).toBeDefined();
    });
  });

  describe("step management", () => {
    let integration: AgentEngineIntegration;

    beforeEach(() => {
      integration = createIntegrationWithOrchestrator(createMockOrchestrator());
    });

    it("getStep returns step by ID", () => {
      const step = integration.createStep("frontend", { prompt: "Test" });

      expect(integration.getStep(step.id)).toBe(step);
    });

    it("getStep returns undefined for non-existent ID", () => {
      expect(integration.getStep("non-existent")).toBeUndefined();
    });

    it("getAllSteps returns all steps", () => {
      integration.createStep("frontend", { prompt: "Test 1" });
      integration.createStep("backend", { prompt: "Test 2" });

      expect(integration.getAllSteps().length).toBe(2);
    });

    it("getStepsByStatus filters by status", async () => {
      integration.createStep("frontend", { prompt: "Test 1" });
      const step2 = integration.createStep("frontend", { prompt: "Test 2" });
      await integration.executeStep(step2);

      expect(integration.getStepsByStatus("pending").length).toBe(1);
      expect(integration.getStepsByStatus("completed").length).toBe(1);
    });

    it("clearSteps removes all steps", () => {
      integration.createStep("frontend", { prompt: "Test" });
      integration.clearSteps();

      expect(integration.getAllSteps().length).toBe(0);
    });
  });

  describe("status reporting", () => {
    it("getStatus returns engine status", async () => {
      const integration = createIntegrationWithOrchestrator(createMockOrchestrator());

      const step = integration.createStep("frontend", { prompt: "Test" });
      await integration.executeStep(step);

      const status = integration.getStatus();

      expect(status.isRunning).toBe(true);
      expect(status.completedSteps).toBe(1);
    });

    it("getOrchestratorStatus returns orchestrator status", () => {
      const integration = createIntegrationWithOrchestrator(createMockOrchestrator());

      const status = integration.getOrchestratorStatus();

      expect(status).not.toBeNull();
      expect(status?.isProcessing).toBe(false);
    });

    it("getOrchestratorStatus returns null when no orchestrator", () => {
      const integration = createAgentEngineIntegration();

      expect(integration.getOrchestratorStatus()).toBeNull();
    });
  });

  describe("event listeners", () => {
    it("adds and removes event listeners", () => {
      const integration = createAgentEngineIntegration();
      const listener = vi.fn();

      integration.addEventListener(listener);
      integration.connect(createMockOrchestrator());

      expect(listener).toHaveBeenCalled();

      listener.mockClear();
      integration.removeEventListener(listener);
      integration.disconnect();

      expect(listener).not.toHaveBeenCalled();
    });

    it("handles listener errors gracefully", async () => {
      const integration = createIntegrationWithOrchestrator(createMockOrchestrator());
      integration.addEventListener(() => {
        throw new Error("Listener error");
      });

      const step = integration.createStep("frontend", { prompt: "Test" });

      // Should not throw
      await expect(integration.executeStep(step)).resolves.toBeDefined();
    });
  });

  describe("configuration", () => {
    it("updateConfig updates configuration", () => {
      const integration = createAgentEngineIntegration();

      integration.updateConfig({ autoRetry: false });

      expect(integration.getConfig().autoRetry).toBe(false);
    });

    it("getConfig returns current configuration", () => {
      const integration = createAgentEngineIntegration({ maxRetries: 5 });
      const config = integration.getConfig();

      expect(config.maxRetries).toBe(5);
    });
  });

  describe("utility functions", () => {
    describe("getStepDuration", () => {
      it("returns duration for completed step", () => {
        const step: GenerationStep = {
          id: "test",
          type: "frontend",
          status: "completed",
          input: { prompt: "Test" },
          startTime: 1000,
          endTime: 1500,
        };

        expect(getStepDuration(step)).toBe(500);
      });

      it("returns null for step without times", () => {
        const step: GenerationStep = {
          id: "test",
          type: "frontend",
          status: "pending",
          input: { prompt: "Test" },
        };

        expect(getStepDuration(step)).toBeNull();
      });
    });

    describe("isTerminalStatus", () => {
      it("returns true for terminal statuses", () => {
        expect(isTerminalStatus("completed")).toBe(true);
        expect(isTerminalStatus("failed")).toBe(true);
        expect(isTerminalStatus("cancelled")).toBe(true);
      });

      it("returns false for non-terminal statuses", () => {
        expect(isTerminalStatus("pending")).toBe(false);
        expect(isTerminalStatus("processing")).toBe(false);
      });
    });

    describe("createGenerationInput", () => {
      it("creates input from prompt", () => {
        const input = createGenerationInput("Test prompt");

        expect(input.prompt).toBe("Test prompt");
      });

      it("includes optional fields", () => {
        const input = createGenerationInput("Test", {
          context: { currentContent: "code" },
          targetPath: "/app/test.ts",
        });

        expect(input.context?.currentContent).toBe("code");
        expect(input.targetPath).toBe("/app/test.ts");
      });
    });

    describe("formatStep", () => {
      it("formats step without duration", () => {
        const step: GenerationStep = {
          id: "step-123",
          type: "frontend",
          status: "pending",
          input: { prompt: "Test" },
        };

        expect(formatStep(step)).toBe("[step-123] frontend - pending");
      });

      it("formats step with duration", () => {
        const step: GenerationStep = {
          id: "step-123",
          type: "frontend",
          status: "completed",
          input: { prompt: "Test" },
          startTime: 1000,
          endTime: 1500,
        };

        expect(formatStep(step)).toBe("[step-123] frontend - completed (500ms)");
      });
    });
  });

  describe("factory functions", () => {
    it("createAgentEngineIntegration creates instance", () => {
      const integration = createAgentEngineIntegration();

      expect(integration).toBeInstanceOf(AgentEngineIntegration);
    });

    it("createIntegrationWithOrchestrator creates connected instance", () => {
      const orchestrator = createMockOrchestrator();
      const integration = createIntegrationWithOrchestrator(orchestrator);

      expect(integration.isReady()).toBe(true);
    });
  });
});
