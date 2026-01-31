// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DeploymentProgressStream,
  createDeploymentProgressStream,
  createDeploymentProgressState,
  advanceStage,
  updateSubstepProgress,
  failCurrentStage,
  skipStage,
  completeDeployment,
  computeDeploymentProgress,
  estimateRemainingMs,
  getDeploymentProgressEvent,
  getStageSummary,
  generateDeploymentId,
  DEFAULT_DEPLOYMENT_STAGES,
  type DeploymentStage,
  type DeploymentProgressState,
  type DeploymentProgressEvent,
  type StreamEvent,
} from "@/lib/preview/deployment-progress-stream";

describe("Deployment Progress Stream (Feature #179)", () => {
  describe("createDeploymentProgressState", () => {
    it("creates initial state with default stages", () => {
      const state = createDeploymentProgressState("deploy-123");

      expect(state.deploymentId).toBe("deploy-123");
      expect(state.stages).toHaveLength(5);
      expect(state.activeStageIndex).toBe(-1);
      expect(state.startedAt).toBeNull();
      expect(state.completedAt).toBeNull();
      expect(state.isComplete).toBe(false);
      expect(state.hasFailed).toBe(false);
      expect(state.target).toBe("preview");
    });

    it("creates state with custom target", () => {
      const state = createDeploymentProgressState("deploy-123", "production");

      expect(state.target).toBe("production");
    });

    it("creates state with custom stages", () => {
      const customStages = [
        { name: "packaging" as DeploymentStage, label: "Pack", weight: 0.5 },
        { name: "complete" as DeploymentStage, label: "Done", weight: 0.5 },
      ];
      const state = createDeploymentProgressState("deploy-123", "preview", customStages);

      expect(state.stages).toHaveLength(2);
      expect(state.stages[0].label).toBe("Pack");
    });

    it("initializes all stages as pending", () => {
      const state = createDeploymentProgressState("deploy-123");

      for (const stage of state.stages) {
        expect(stage.status).toBe("pending");
        expect(stage.startedAt).toBeNull();
        expect(stage.endedAt).toBeNull();
        expect(stage.durationMs).toBe(0);
      }
    });
  });

  describe("DEFAULT_DEPLOYMENT_STAGES", () => {
    it("has correct stage sequence", () => {
      const stageNames = DEFAULT_DEPLOYMENT_STAGES.map((s) => s.name);

      expect(stageNames).toEqual([
        "packaging",
        "uploading",
        "installing",
        "verifying",
        "complete",
      ]);
    });

    it("has weights that sum to 1", () => {
      const totalWeight = DEFAULT_DEPLOYMENT_STAGES.reduce((sum, s) => sum + s.weight, 0);

      expect(totalWeight).toBe(1);
    });

    it("has human-readable labels", () => {
      expect(DEFAULT_DEPLOYMENT_STAGES[0].label).toBe("Packaging module");
      expect(DEFAULT_DEPLOYMENT_STAGES[1].label).toBe("Uploading to server");
      expect(DEFAULT_DEPLOYMENT_STAGES[2].label).toBe("Installing module");
      expect(DEFAULT_DEPLOYMENT_STAGES[3].label).toBe("Verifying deployment");
      expect(DEFAULT_DEPLOYMENT_STAGES[4].label).toBe("Complete");
    });
  });

  describe("advanceStage", () => {
    it("starts first stage when none active", () => {
      const state = createDeploymentProgressState("deploy-123");
      const now = 1000;

      const newState = advanceStage(state, now);

      expect(newState.activeStageIndex).toBe(0);
      expect(newState.stages[0].status).toBe("active");
      expect(newState.stages[0].startedAt).toBe(now);
      expect(newState.startedAt).toBe(now);
    });

    it("completes current stage and starts next", () => {
      let state = createDeploymentProgressState("deploy-123");
      state = advanceStage(state, 1000); // Start packaging
      state = advanceStage(state, 2000); // Complete packaging, start uploading

      expect(state.stages[0].status).toBe("completed");
      expect(state.stages[0].durationMs).toBe(1000);
      expect(state.stages[1].status).toBe("active");
      expect(state.activeStageIndex).toBe(1);
    });

    it("sets stage message", () => {
      const state = createDeploymentProgressState("deploy-123");
      const newState = advanceStage(state, 1000, "Starting packaging...");

      expect(newState.stages[0].message).toBe("Starting packaging...");
    });

    it("marks deployment complete when all stages done", () => {
      let state = createDeploymentProgressState("deploy-123");

      // Advance through all stages
      for (let i = 0; i <= DEFAULT_DEPLOYMENT_STAGES.length; i++) {
        state = advanceStage(state, 1000 * (i + 1));
      }

      expect(state.isComplete).toBe(true);
      expect(state.completedAt).not.toBeNull();
      expect(state.activeStageIndex).toBe(-1);
    });
  });

  describe("updateSubstepProgress", () => {
    it("updates substep progress for active stage", () => {
      let state = createDeploymentProgressState("deploy-123");
      state = advanceStage(state, 1000);
      state = updateSubstepProgress(state, 50, "File 5/10");

      expect(state.stages[0].substepProgress).toBe(50);
      expect(state.stages[0].substepLabel).toBe("File 5/10");
    });

    it("clamps progress to 0-100", () => {
      let state = createDeploymentProgressState("deploy-123");
      state = advanceStage(state, 1000);

      state = updateSubstepProgress(state, 150);
      expect(state.stages[0].substepProgress).toBe(100);

      state = updateSubstepProgress(state, -10);
      expect(state.stages[0].substepProgress).toBe(0);
    });

    it("does nothing if no active stage", () => {
      const state = createDeploymentProgressState("deploy-123");
      const newState = updateSubstepProgress(state, 50);

      expect(newState).toEqual(state);
    });
  });

  describe("failCurrentStage", () => {
    it("marks current stage as failed", () => {
      let state = createDeploymentProgressState("deploy-123");
      state = advanceStage(state, 1000);
      state = failCurrentStage(state, "Upload failed", 2000);

      expect(state.stages[0].status).toBe("failed");
      expect(state.stages[0].message).toBe("Upload failed");
      expect(state.stages[0].durationMs).toBe(1000);
      expect(state.hasFailed).toBe(true);
      expect(state.error).toBe("Upload failed");
    });

    it("does nothing if no active stage", () => {
      const state = createDeploymentProgressState("deploy-123");
      const newState = failCurrentStage(state, "Error");

      expect(newState).toEqual(state);
    });
  });

  describe("skipStage", () => {
    it("skips pending stage by name", () => {
      const state = createDeploymentProgressState("deploy-123");
      const newState = skipStage(state, "verifying");

      expect(newState.stages[3].status).toBe("skipped");
    });

    it("does not skip non-pending stages", () => {
      let state = createDeploymentProgressState("deploy-123");
      state = advanceStage(state, 1000); // Start packaging
      state = skipStage(state, "packaging"); // Try to skip active

      expect(state.stages[0].status).toBe("active"); // Still active
    });
  });

  describe("completeDeployment", () => {
    it("marks all remaining stages as completed on success", () => {
      let state = createDeploymentProgressState("deploy-123");
      state = advanceStage(state, 1000); // Start first stage
      state = completeDeployment(state, 2000);

      // All stages should be completed on successful deployment
      expect(state.stages[0].status).toBe("completed");
      expect(state.stages[1].status).toBe("completed");
      expect(state.stages[2].status).toBe("completed");
      expect(state.stages[3].status).toBe("completed");
      expect(state.stages[4].status).toBe("completed");
      expect(state.isComplete).toBe(true);
      expect(state.completedAt).toBe(2000);
    });
  });

  describe("computeDeploymentProgress", () => {
    it("returns 0 for initial state", () => {
      const state = createDeploymentProgressState("deploy-123");

      expect(computeDeploymentProgress(state)).toBe(0);
    });

    it("includes partial progress from active stage", () => {
      let state = createDeploymentProgressState("deploy-123");
      state = advanceStage(state, 1000);
      state = updateSubstepProgress(state, 50);

      const progress = computeDeploymentProgress(state);
      // packaging weight is 0.15, 50% of that = 0.075
      expect(progress).toBeCloseTo(0.075, 2);
    });

    it("returns 1 when complete", () => {
      let state = createDeploymentProgressState("deploy-123");
      state = completeDeployment(state);

      expect(computeDeploymentProgress(state)).toBe(1);
    });

    it("accumulates completed stage weights", () => {
      let state = createDeploymentProgressState("deploy-123");
      state = advanceStage(state, 1000); // Start packaging (0.15)
      state = advanceStage(state, 2000); // Complete packaging, start uploading (0.25)

      const progress = computeDeploymentProgress(state);
      // packaging complete (0.15) + uploading active at 50% (0.125) = 0.275
      expect(progress).toBeGreaterThan(0.15);
    });
  });

  describe("estimateRemainingMs", () => {
    it("returns 0 for complete deployment", () => {
      let state = createDeploymentProgressState("deploy-123");
      state = completeDeployment(state);

      expect(estimateRemainingMs(state)).toBe(0);
    });

    it("returns 0 if not started", () => {
      const state = createDeploymentProgressState("deploy-123");

      expect(estimateRemainingMs(state)).toBe(0);
    });

    it("estimates remaining time based on progress", () => {
      let state = createDeploymentProgressState("deploy-123");
      state = advanceStage(state, 1000);
      state = advanceStage(state, 2000); // 1s elapsed, packaging done

      // At 2000ms with packaging (15%) + uploading partial complete
      const remaining = estimateRemainingMs(state, 2000);
      expect(remaining).toBeGreaterThan(0);
    });
  });

  describe("getDeploymentProgressEvent", () => {
    it("returns event with all fields", () => {
      let state = createDeploymentProgressState("deploy-123", "staging");
      state = advanceStage(state, 1000, "Starting...");
      state = updateSubstepProgress(state, 30, "Processing");

      const event = getDeploymentProgressEvent(state, 1500);

      expect(event.deploymentId).toBe("deploy-123");
      expect(event.currentStage).toBe("packaging");
      expect(event.currentStageLabel).toBe("Packaging module");
      expect(event.progress).toBeGreaterThan(0);
      expect(event.elapsedMs).toBe(500);
      expect(event.stagesCompleted).toBe(0);
      expect(event.stagesTotal).toBe(5);
      expect(event.isComplete).toBe(false);
      expect(event.hasFailed).toBe(false);
      expect(event.message).toBe("Starting...");
      expect(event.substepProgress).toBe(30);
      expect(event.substepLabel).toBe("Processing");
      expect(event.target).toBe("staging");
    });

    it("returns complete event when finished", () => {
      let state = createDeploymentProgressState("deploy-123");
      state = completeDeployment(state);

      const event = getDeploymentProgressEvent(state);

      expect(event.currentStage).toBe("complete");
      expect(event.currentStageLabel).toBe("Complete");
      expect(event.isComplete).toBe(true);
      expect(event.progress).toBe(1);
    });
  });

  describe("getStageSummary", () => {
    it("returns summary of all stages", () => {
      let state = createDeploymentProgressState("deploy-123");
      state = advanceStage(state, 1000);
      state = advanceStage(state, 2000);

      const summary = getStageSummary(state);

      expect(summary).toHaveLength(5);
      expect(summary[0].name).toBe("packaging");
      expect(summary[0].status).toBe("completed");
      expect(summary[0].durationMs).toBe(1000);
      expect(summary[1].status).toBe("active");
    });
  });

  describe("generateDeploymentId", () => {
    it("generates unique IDs", () => {
      const id1 = generateDeploymentId();
      const id2 = generateDeploymentId();

      expect(id1).not.toBe(id2);
    });

    it("starts with deploy_ prefix", () => {
      const id = generateDeploymentId();

      expect(id).toMatch(/^deploy_/);
    });
  });

  describe("DeploymentProgressStream class", () => {
    let stream: DeploymentProgressStream;

    beforeEach(() => {
      stream = new DeploymentProgressStream("deploy-test");
    });

    describe("initialization", () => {
      it("creates with deployment ID", () => {
        const state = stream.getState();

        expect(state.deploymentId).toBe("deploy-test");
        expect(state.isComplete).toBe(false);
      });

      it("creates with target", () => {
        const prodStream = new DeploymentProgressStream("deploy-prod", "production");
        const state = prodStream.getState();

        expect(state.target).toBe("production");
      });
    });

    describe("startNextStage", () => {
      it("starts first stage", () => {
        stream.startNextStage("Beginning...");

        const stage = stream.getActiveStage();
        expect(stage?.name).toBe("packaging");
        expect(stage?.status).toBe("active");
        expect(stage?.message).toBe("Beginning...");
      });

      it("advances through stages", () => {
        stream.startNextStage();
        expect(stream.getActiveStage()?.name).toBe("packaging");

        stream.startNextStage();
        expect(stream.getActiveStage()?.name).toBe("uploading");

        stream.startNextStage();
        expect(stream.getActiveStage()?.name).toBe("installing");
      });

      it("emits progress events", () => {
        const events: DeploymentProgressEvent[] = [];
        stream.onProgress((e) => events.push(e));

        stream.startNextStage();

        expect(events.length).toBeGreaterThan(0);
        expect(events[0].currentStage).toBe("packaging");
      });

      it("emits stream events", () => {
        const events: StreamEvent[] = [];
        stream.onStreamEvent((e) => events.push(e));

        stream.startNextStage();

        expect(events.some((e) => e.type === "stage_start")).toBe(true);
      });
    });

    describe("startStage", () => {
      it("starts specific stage by name", () => {
        stream.startStage("installing", "Installing module...");

        const stage = stream.getActiveStage();
        expect(stage?.name).toBe("installing");
      });
    });

    describe("updateProgress", () => {
      it("updates substep progress", () => {
        stream.startNextStage();
        stream.updateProgress(75, "Uploading file 7/10");

        const stage = stream.getActiveStage();
        expect(stage?.substepProgress).toBe(75);
        expect(stage?.substepLabel).toBe("Uploading file 7/10");
      });

      it("emits progress event", () => {
        const events: StreamEvent[] = [];
        stream.onStreamEvent((e) => events.push(e));

        stream.startNextStage();
        stream.updateProgress(50);

        expect(events.some((e) => e.type === "stage_progress")).toBe(true);
      });
    });

    describe("updateMessage", () => {
      it("updates stage message", () => {
        stream.startNextStage();
        stream.updateMessage("Creating archive...");

        expect(stream.getActiveStage()?.message).toBe("Creating archive...");
      });
    });

    describe("failStage", () => {
      it("marks stage as failed", () => {
        stream.startNextStage();
        stream.failStage("Connection refused");

        expect(stream.hasFailed()).toBe(true);
        expect(stream.getState().error).toBe("Connection refused");
      });

      it("emits failure events", () => {
        const events: StreamEvent[] = [];
        stream.onStreamEvent((e) => events.push(e));

        stream.startNextStage();
        stream.failStage("Error");

        expect(events.some((e) => e.type === "stage_failed")).toBe(true);
        expect(events.some((e) => e.type === "deployment_failed")).toBe(true);
      });
    });

    describe("complete", () => {
      it("marks deployment complete", () => {
        stream.startNextStage();
        stream.complete();

        expect(stream.isComplete()).toBe(true);
      });

      it("emits completion event", () => {
        const events: StreamEvent[] = [];
        stream.onStreamEvent((e) => events.push(e));

        stream.startNextStage();
        stream.complete();

        expect(events.some((e) => e.type === "deployment_complete")).toBe(true);
      });
    });

    describe("getProgressEvent", () => {
      it("returns current progress event", () => {
        stream.startNextStage();
        stream.updateProgress(50);

        const event = stream.getProgressEvent();

        expect(event.deploymentId).toBe("deploy-test");
        expect(event.progress).toBeGreaterThan(0);
      });
    });

    describe("getSummary", () => {
      it("returns stage summary", () => {
        stream.startNextStage();
        stream.startNextStage();

        const summary = stream.getSummary();

        expect(summary).toHaveLength(5);
        expect(summary[0].status).toBe("completed");
      });
    });

    describe("callback management", () => {
      it("registers and calls progress callbacks", () => {
        const callback = vi.fn();
        stream.onProgress(callback);

        stream.startNextStage();

        expect(callback).toHaveBeenCalled();
      });

      it("removes progress callbacks", () => {
        const callback = vi.fn();
        stream.onProgress(callback);
        stream.offProgress(callback);

        stream.startNextStage();

        expect(callback).not.toHaveBeenCalled();
      });

      it("registers and calls stream event callbacks", () => {
        const callback = vi.fn();
        stream.onStreamEvent(callback);

        stream.startNextStage();

        expect(callback).toHaveBeenCalled();
      });

      it("removes stream event callbacks", () => {
        const callback = vi.fn();
        stream.onStreamEvent(callback);
        stream.offStreamEvent(callback);

        stream.startNextStage();

        expect(callback).not.toHaveBeenCalled();
      });

      it("handles callback errors gracefully", () => {
        stream.onProgress(() => {
          throw new Error("Callback error");
        });

        expect(() => stream.startNextStage()).not.toThrow();
      });
    });
  });

  describe("createDeploymentProgressStream factory", () => {
    it("creates stream instance", () => {
      const stream = createDeploymentProgressStream("deploy-factory");

      expect(stream).toBeInstanceOf(DeploymentProgressStream);
      expect(stream.getState().deploymentId).toBe("deploy-factory");
    });

    it("creates with target", () => {
      const stream = createDeploymentProgressStream("deploy-prod", "production");

      expect(stream.getState().target).toBe("production");
    });
  });

  describe("end-to-end deployment flow", () => {
    it("simulates complete deployment: Packaging → Uploading → Installing → Verifying → Complete", () => {
      const stream = createDeploymentProgressStream("deploy-e2e");
      const progressEvents: DeploymentProgressEvent[] = [];
      const streamEvents: StreamEvent[] = [];

      stream.onProgress((e) => progressEvents.push(e));
      stream.onStreamEvent((e) => streamEvents.push(e));

      // Stage 1: Packaging
      stream.startNextStage("Creating module archive");
      expect(stream.getActiveStage()?.name).toBe("packaging");
      stream.updateProgress(50, "Compressing files...");
      stream.updateProgress(100, "Archive created");

      // Stage 2: Uploading
      stream.startNextStage("Uploading to Odoo server");
      expect(stream.getActiveStage()?.name).toBe("uploading");
      stream.updateProgress(25, "Uploading 1/4 chunks");
      stream.updateProgress(50, "Uploading 2/4 chunks");
      stream.updateProgress(75, "Uploading 3/4 chunks");
      stream.updateProgress(100, "Upload complete");

      // Stage 3: Installing
      stream.startNextStage("Installing module in Odoo");
      expect(stream.getActiveStage()?.name).toBe("installing");
      stream.updateProgress(50, "Running migrations...");
      stream.updateProgress(100, "Module installed");

      // Stage 4: Verifying
      stream.startNextStage("Verifying deployment");
      expect(stream.getActiveStage()?.name).toBe("verifying");
      stream.updateProgress(50, "Checking module state...");
      stream.updateProgress(100, "Verification passed");

      // Stage 5: Complete
      stream.complete();

      // Verify final state
      expect(stream.isComplete()).toBe(true);
      expect(stream.hasFailed()).toBe(false);

      const summary = stream.getSummary();
      expect(summary.filter((s) => s.status === "completed")).toHaveLength(5);

      // Verify events emitted
      expect(streamEvents.filter((e) => e.type === "stage_start")).toHaveLength(4);
      expect(streamEvents.some((e) => e.type === "deployment_complete")).toBe(true);

      // Verify progress increased monotonically
      let lastProgress = 0;
      for (const event of progressEvents) {
        expect(event.progress).toBeGreaterThanOrEqual(lastProgress);
        lastProgress = event.progress;
      }
    });

    it("handles failure during deployment", () => {
      const stream = createDeploymentProgressStream("deploy-fail");

      stream.startNextStage(); // Packaging
      stream.startNextStage(); // Uploading
      stream.failStage("Network timeout");

      expect(stream.hasFailed()).toBe(true);
      expect(stream.isComplete()).toBe(false);
      expect(stream.getState().error).toBe("Network timeout");

      const summary = stream.getSummary();
      expect(summary[1].status).toBe("failed");
    });
  });
});
