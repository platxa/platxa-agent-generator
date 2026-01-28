import { describe, it, expect } from "vitest";
import {
  DEFAULT_PHASES,
  createProgressState,
  advancePhase,
  failCurrentPhase,
  skipPhase,
  completeAll,
  computeProgress,
  estimateRemainingMs,
  getProgressEvent,
  getPhaseSummary,
} from "@/lib/agent-bridge/progress-streaming";

describe("Progress Streaming", () => {
  describe("DEFAULT_PHASES", () => {
    it("has 6 phases", () => {
      expect(DEFAULT_PHASES).toHaveLength(6);
    });

    it("weights sum to 1", () => {
      const sum = DEFAULT_PHASES.reduce((s, p) => s + p.weight, 0);
      expect(sum).toBeCloseTo(1, 5);
    });

    it("generate phase has highest weight", () => {
      const gen = DEFAULT_PHASES.find((p) => p.name === "generate");
      expect(gen!.weight).toBe(0.45);
    });
  });

  describe("createProgressState", () => {
    it("creates state with all phases pending", () => {
      const state = createProgressState();
      expect(state.phases).toHaveLength(6);
      expect(state.phases.every((p) => p.status === "pending")).toBe(true);
      expect(state.activePhaseIndex).toBe(-1);
      expect(state.isComplete).toBe(false);
      expect(state.startedAt).toBeNull();
    });

    it("accepts custom phases", () => {
      const state = createProgressState([
        { name: "init", label: "Start", weight: 0.5 },
        { name: "finalize", label: "End", weight: 0.5 },
      ]);
      expect(state.phases).toHaveLength(2);
    });
  });

  describe("advancePhase", () => {
    it("starts first phase", () => {
      const state = createProgressState();
      const next = advancePhase(state, 1000);
      expect(next.activePhaseIndex).toBe(0);
      expect(next.phases[0].status).toBe("active");
      expect(next.phases[0].startedAt).toBe(1000);
      expect(next.startedAt).toBe(1000);
    });

    it("completes current and starts next", () => {
      let state = createProgressState();
      state = advancePhase(state, 1000);
      state = advancePhase(state, 2000);
      expect(state.phases[0].status).toBe("completed");
      expect(state.phases[0].durationMs).toBe(1000);
      expect(state.phases[1].status).toBe("active");
      expect(state.activePhaseIndex).toBe(1);
    });

    it("completes all phases sequentially", () => {
      let state = createProgressState();
      let t = 1000;
      // Advance through all 6 phases + one more to complete last
      for (let i = 0; i <= DEFAULT_PHASES.length; i++) {
        state = advancePhase(state, t);
        t += 500;
      }
      expect(state.isComplete).toBe(true);
      expect(state.completedAt).not.toBeNull();
    });

    it("sets message on active phase", () => {
      let state = createProgressState();
      state = advancePhase(state, 1000, "Loading resources");
      expect(state.phases[0].message).toBe("Loading resources");
    });

    it("skips already-skipped phases", () => {
      let state = createProgressState();
      state = skipPhase(state, "analyze");
      state = advancePhase(state, 1000); // starts init
      state = advancePhase(state, 2000); // completes init, skips analyze, starts generate
      expect(state.phases[1].status).toBe("skipped");
      expect(state.phases[2].status).toBe("active");
      expect(state.activePhaseIndex).toBe(2);
    });
  });

  describe("failCurrentPhase", () => {
    it("marks active phase as failed", () => {
      let state = createProgressState();
      state = advancePhase(state, 1000);
      state = failCurrentPhase(state, "Network error", 2000);
      expect(state.phases[0].status).toBe("failed");
      expect(state.phases[0].message).toBe("Network error");
      expect(state.phases[0].durationMs).toBe(1000);
      expect(state.hasFailed).toBe(true);
    });

    it("no-ops when no active phase", () => {
      const state = createProgressState();
      const result = failCurrentPhase(state, "Error");
      expect(result.hasFailed).toBe(false);
    });
  });

  describe("skipPhase", () => {
    it("skips a pending phase", () => {
      let state = createProgressState();
      state = skipPhase(state, "optimize");
      const opt = state.phases.find((p) => p.name === "optimize");
      expect(opt!.status).toBe("skipped");
    });

    it("does not skip non-pending phase", () => {
      let state = createProgressState();
      state = advancePhase(state, 1000); // init is active
      state = skipPhase(state, "init"); // should not skip active
      expect(state.phases[0].status).toBe("active");
    });
  });

  describe("completeAll", () => {
    it("completes active and skips remaining pending", () => {
      let state = createProgressState();
      state = advancePhase(state, 1000); // init active
      state = advancePhase(state, 2000); // analyze active
      state = completeAll(state, 3000);
      expect(state.isComplete).toBe(true);
      expect(state.phases[0].status).toBe("completed");
      expect(state.phases[1].status).toBe("completed"); // was active
      expect(state.phases[2].status).toBe("skipped"); // was pending
      expect(state.completedAt).toBe(3000);
    });
  });

  describe("computeProgress", () => {
    it("returns 0 for fresh state", () => {
      expect(computeProgress(createProgressState())).toBe(0);
    });

    it("returns partial progress with active phase", () => {
      let state = createProgressState();
      state = advancePhase(state, 1000);
      const progress = computeProgress(state);
      // init weight=0.05, active gets 50% → 0.025
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThan(0.1);
    });

    it("returns 1 when all complete", () => {
      let state = createProgressState();
      let t = 1000;
      for (let i = 0; i <= DEFAULT_PHASES.length; i++) {
        state = advancePhase(state, t);
        t += 100;
      }
      expect(computeProgress(state)).toBe(1);
    });

    it("counts skipped phases as complete weight", () => {
      let state = createProgressState();
      state = skipPhase(state, "init");
      state = skipPhase(state, "analyze");
      const progress = computeProgress(state);
      expect(progress).toBeCloseTo(0.2, 1); // 0.05 + 0.15
    });
  });

  describe("estimateRemainingMs", () => {
    it("returns 0 for complete state", () => {
      let state = createProgressState();
      state = completeAll(state, 5000);
      expect(estimateRemainingMs(state, 5000)).toBe(0);
    });

    it("returns 0 for not-started state", () => {
      expect(estimateRemainingMs(createProgressState())).toBe(0);
    });

    it("estimates remaining time based on progress", () => {
      let state = createProgressState();
      state = advancePhase(state, 1000); // init active at t=1000
      state = advancePhase(state, 2000); // init done, analyze active at t=2000
      // At t=3000, elapsed=2000ms, progress ~ 0.05 (init done) + 0.075 (analyze half) = 0.125
      const remaining = estimateRemainingMs(state, 3000);
      expect(remaining).toBeGreaterThan(0);
    });
  });

  describe("getProgressEvent", () => {
    it("returns event for active state", () => {
      let state = createProgressState();
      state = advancePhase(state, 1000, "Starting up");
      const event = getProgressEvent(state, 2000);
      expect(event.currentPhase).toBe("init");
      expect(event.currentPhaseLabel).toBe("Initializing");
      expect(event.progress).toBeGreaterThan(0);
      expect(event.elapsedMs).toBe(1000);
      expect(event.phasesCompleted).toBe(0);
      expect(event.phasesTotal).toBe(6);
      expect(event.isComplete).toBe(false);
      expect(event.message).toBe("Starting up");
    });

    it("returns complete event", () => {
      let state = createProgressState();
      state = completeAll(state, 5000);
      const event = getProgressEvent(state, 5000);
      expect(event.isComplete).toBe(true);
      expect(event.currentPhase).toBe("complete");
    });

    it("returns waiting event for not-started", () => {
      const event = getProgressEvent(createProgressState());
      expect(event.currentPhaseLabel).toBe("Waiting");
      expect(event.elapsedMs).toBe(0);
    });
  });

  describe("getPhaseSummary", () => {
    it("returns summary of all phases", () => {
      let state = createProgressState();
      state = advancePhase(state, 1000);
      state = advancePhase(state, 2000);
      const summary = getPhaseSummary(state);
      expect(summary).toHaveLength(6);
      expect(summary[0].status).toBe("completed");
      expect(summary[0].durationMs).toBe(1000);
      expect(summary[1].status).toBe("active");
    });
  });

  describe("immutability", () => {
    it("does not mutate original state", () => {
      const state = createProgressState();
      const next = advancePhase(state, 1000);
      expect(state.activePhaseIndex).toBe(-1);
      expect(next.activePhaseIndex).toBe(0);
      expect(state.phases[0].status).toBe("pending");
    });
  });
});
