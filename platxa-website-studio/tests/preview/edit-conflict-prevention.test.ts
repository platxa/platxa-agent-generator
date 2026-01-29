// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ConflictPreventionManager,
  createConflictPreventionManager,
  createFileEditState,
  cloneFileEditState,
  hasActiveConflict,
  shouldPauseAI,
  canResumeAI,
  timeSinceHumanEdit,
  getAIPauseDuration,
  createConflictAwareEditHandler,
  waitForAIEditPermission,
  type FileEditState,
  type ConflictEvent,
  type ConflictPreventionConfig,
} from "@/lib/preview/edit-conflict-prevention";

describe("ConflictPreventionManager", () => {
  describe("agent pauses if human editing same file (Feature #170)", () => {
    it("pauses AI when human starts editing", () => {
      // Feature #170: Agent pauses if human editing same file
      const manager = createConflictPreventionManager();

      manager.recordAIEdit("/test.ts");
      manager.recordHumanEdit("/test.ts");

      expect(manager.isAIPaused("/test.ts")).toBe(true);
    });

    it("detects conflict when both editing same file", () => {
      // Feature #170: Conflict detection
      const manager = createConflictPreventionManager();
      const events: ConflictEvent[] = [];
      manager.onEvent((e) => events.push(e));

      manager.recordAIEdit("/test.ts");
      manager.recordHumanEdit("/test.ts");

      expect(events.some((e) => e.type === "conflict:detected")).toBe(true);
    });

    it("allows AI to edit different files", () => {
      // Feature #170: No conflict for different files
      const manager = createConflictPreventionManager();

      manager.recordHumanEdit("/human.ts");
      manager.recordAIEdit("/ai.ts");

      expect(manager.canAIEdit("/ai.ts")).toBe(true);
      expect(manager.isAIPaused("/ai.ts")).toBe(false);
    });

    it("blocks AI edit when human is active", () => {
      // Feature #170: Agent pauses if human editing
      const manager = createConflictPreventionManager();

      manager.recordHumanEdit("/test.ts");

      expect(manager.canAIEdit("/test.ts")).toBe(false);
    });
  });

  describe("resumes after human stops (Feature #170)", () => {
    it("resumes AI after human stop debounce", async () => {
      // Feature #170: Resumes after human stops
      vi.useFakeTimers();
      const manager = createConflictPreventionManager({
        humanStopDebounce: 1000,
        resumeGracePeriod: 500,
      });

      manager.recordAIEdit("/test.ts");
      manager.recordHumanEdit("/test.ts");
      expect(manager.isAIPaused("/test.ts")).toBe(true);

      // Wait for human stop debounce + resume grace period
      vi.advanceTimersByTime(1500);

      expect(manager.isAIPaused("/test.ts")).toBe(false);
      vi.useRealTimers();
    });

    it("emits ai:resume event after human stops", async () => {
      // Feature #170: Resume event emission
      vi.useFakeTimers();
      const manager = createConflictPreventionManager({
        humanStopDebounce: 1000,
        resumeGracePeriod: 500,
      });
      const events: ConflictEvent[] = [];
      manager.onEvent((e) => events.push(e));

      manager.recordAIEdit("/test.ts");
      manager.recordHumanEdit("/test.ts");

      vi.advanceTimersByTime(1500);

      expect(events.some((e) => e.type === "ai:resume")).toBe(true);
      vi.useRealTimers();
    });

    it("cancels resume if human starts editing again", async () => {
      // Feature #170: No resume if human continues
      vi.useFakeTimers();
      const manager = createConflictPreventionManager({
        humanStopDebounce: 1000,
        resumeGracePeriod: 500,
      });

      manager.recordAIEdit("/test.ts");
      manager.recordHumanEdit("/test.ts");

      // Partial wait then human edits again
      vi.advanceTimersByTime(800);
      manager.recordHumanEdit("/test.ts");
      vi.advanceTimersByTime(800);

      // Still paused because debounce restarted
      expect(manager.isAIPaused("/test.ts")).toBe(true);
      vi.useRealTimers();
    });
  });

  describe("createFileEditState", () => {
    it("creates initial state", () => {
      const state = createFileEditState("/test.ts");

      expect(state.filePath).toBe("/test.ts");
      expect(state.humanActive).toBe(false);
      expect(state.aiActive).toBe(false);
      expect(state.aiPaused).toBe(false);
      expect(state.pauseCount).toBe(0);
    });
  });

  describe("cloneFileEditState", () => {
    it("creates independent copy", () => {
      const original = createFileEditState("/test.ts");
      original.humanActive = true;

      const cloned = cloneFileEditState(original);

      expect(cloned.filePath).toBe("/test.ts");
      expect(cloned.humanActive).toBe(true);
      expect(cloned).not.toBe(original);
    });
  });

  describe("hasActiveConflict", () => {
    it("returns true when both human and AI active", () => {
      const state = createFileEditState("/test.ts");
      state.humanActive = true;
      state.aiActive = true;

      expect(hasActiveConflict(state)).toBe(true);
    });

    it("returns false when only human active", () => {
      const state = createFileEditState("/test.ts");
      state.humanActive = true;

      expect(hasActiveConflict(state)).toBe(false);
    });

    it("returns false when only AI active", () => {
      const state = createFileEditState("/test.ts");
      state.aiActive = true;

      expect(hasActiveConflict(state)).toBe(false);
    });
  });

  describe("shouldPauseAI", () => {
    it("returns true when human active and AI not paused", () => {
      const state = createFileEditState("/test.ts");
      state.humanActive = true;
      state.aiPaused = false;

      expect(shouldPauseAI(state)).toBe(true);
    });

    it("returns false when AI already paused", () => {
      const state = createFileEditState("/test.ts");
      state.humanActive = true;
      state.aiPaused = true;

      expect(shouldPauseAI(state)).toBe(false);
    });

    it("returns false when human not active", () => {
      const state = createFileEditState("/test.ts");
      state.humanActive = false;

      expect(shouldPauseAI(state)).toBe(false);
    });
  });

  describe("canResumeAI", () => {
    it("returns true when AI paused and human not active", () => {
      const state = createFileEditState("/test.ts");
      state.aiPaused = true;
      state.humanActive = false;

      expect(canResumeAI(state)).toBe(true);
    });

    it("returns false when AI not paused", () => {
      const state = createFileEditState("/test.ts");
      state.aiPaused = false;

      expect(canResumeAI(state)).toBe(false);
    });

    it("returns false when human still active", () => {
      const state = createFileEditState("/test.ts");
      state.aiPaused = true;
      state.humanActive = true;

      expect(canResumeAI(state)).toBe(false);
    });
  });

  describe("timeSinceHumanEdit", () => {
    it("returns time since last human edit", () => {
      vi.useFakeTimers();
      const state = createFileEditState("/test.ts");
      state.lastHumanEdit = Date.now();

      vi.advanceTimersByTime(1000);

      expect(timeSinceHumanEdit(state)).toBe(1000);
      vi.useRealTimers();
    });
  });

  describe("getAIPauseDuration", () => {
    it("returns 0 when not paused", () => {
      const state = createFileEditState("/test.ts");
      state.aiPaused = false;

      expect(getAIPauseDuration(state)).toBe(0);
    });

    it("returns pause duration when paused", () => {
      vi.useFakeTimers();
      const state = createFileEditState("/test.ts");
      state.aiPaused = true;
      state.lastHumanEdit = Date.now();

      vi.advanceTimersByTime(2000);

      expect(getAIPauseDuration(state)).toBe(2000);
      vi.useRealTimers();
    });
  });

  describe("ConflictPreventionManager class", () => {
    let manager: ConflictPreventionManager;

    beforeEach(() => {
      manager = createConflictPreventionManager({
        humanStopDebounce: 1000,
        resumeGracePeriod: 500,
      });
    });

    describe("recordHumanEdit", () => {
      it("marks human as active", () => {
        manager.recordHumanEdit("/test.ts");

        expect(manager.isHumanEditing("/test.ts")).toBe(true);
      });

      it("emits human:start event on first edit", () => {
        const events: ConflictEvent[] = [];
        manager.onEvent((e) => events.push(e));

        manager.recordHumanEdit("/test.ts");

        expect(events.some((e) => e.type === "human:start")).toBe(true);
      });

      it("does not emit human:start if already active", () => {
        manager.recordHumanEdit("/test.ts");
        const events: ConflictEvent[] = [];
        manager.onEvent((e) => events.push(e));

        manager.recordHumanEdit("/test.ts");

        expect(events.filter((e) => e.type === "human:start").length).toBe(0);
      });

      it("pauses AI if AI was editing", () => {
        manager.recordAIEdit("/test.ts");
        manager.recordHumanEdit("/test.ts");

        expect(manager.isAIPaused("/test.ts")).toBe(true);
      });
    });

    describe("recordAIEdit", () => {
      it("marks AI as active", () => {
        manager.recordAIEdit("/test.ts");

        const state = manager.getFileState("/test.ts");
        expect(state?.aiActive).toBe(true);
      });

      it("does not record if AI is paused", () => {
        manager.recordAIEdit("/test.ts");
        manager.recordHumanEdit("/test.ts"); // Pauses AI

        const initialState = manager.getFileState("/test.ts");
        manager.recordAIEdit("/test.ts");
        const finalState = manager.getFileState("/test.ts");

        // lastAIEdit should not have changed
        expect(finalState?.lastAIEdit).toBe(initialState?.lastAIEdit);
      });

      it("emits conflict:detected when human already editing", () => {
        manager.recordHumanEdit("/test.ts");
        const events: ConflictEvent[] = [];
        manager.onEvent((e) => events.push(e));

        manager.recordAIEdit("/test.ts");

        expect(events.some((e) => e.type === "conflict:detected")).toBe(true);
      });
    });

    describe("pauseAI", () => {
      it("pauses AI for file", () => {
        manager.recordAIEdit("/test.ts");
        manager.pauseAI("/test.ts", "Test reason");

        expect(manager.isAIPaused("/test.ts")).toBe(true);
      });

      it("increments pause count", () => {
        manager.recordAIEdit("/test.ts");
        manager.pauseAI("/test.ts", "First");
        manager.resumeAI("/test.ts");
        manager.pauseAI("/test.ts", "Second");

        const state = manager.getFileState("/test.ts");
        expect(state?.pauseCount).toBe(2);
      });

      it("emits ai:pause event", () => {
        const events: ConflictEvent[] = [];
        manager.onEvent((e) => events.push(e));

        manager.recordAIEdit("/test.ts");
        manager.pauseAI("/test.ts", "Test");

        expect(events.some((e) => e.type === "ai:pause")).toBe(true);
      });

      it("returns pause request", () => {
        const request = manager.pauseAI("/test.ts", "Test reason");

        expect(request.filePath).toBe("/test.ts");
        expect(request.reason).toBe("Test reason");
        expect(request.timestamp).toBeGreaterThan(0);
      });
    });

    describe("resumeAI", () => {
      it("resumes paused AI", () => {
        manager.recordAIEdit("/test.ts");
        manager.pauseAI("/test.ts", "Test");
        manager.resumeAI("/test.ts");

        expect(manager.isAIPaused("/test.ts")).toBe(false);
      });

      it("emits ai:resume event", () => {
        manager.recordAIEdit("/test.ts");
        manager.pauseAI("/test.ts", "Test");

        const events: ConflictEvent[] = [];
        manager.onEvent((e) => events.push(e));

        manager.resumeAI("/test.ts");

        expect(events.some((e) => e.type === "ai:resume")).toBe(true);
      });

      it("emits conflict:resolved when human not active", () => {
        manager.recordAIEdit("/test.ts");
        manager.pauseAI("/test.ts", "Test");

        const events: ConflictEvent[] = [];
        manager.onEvent((e) => events.push(e));

        manager.resumeAI("/test.ts");

        expect(events.some((e) => e.type === "conflict:resolved")).toBe(true);
      });

      it("returns resume request", () => {
        manager.recordAIEdit("/test.ts");
        manager.pauseAI("/test.ts", "Test");

        const request = manager.resumeAI("/test.ts", true);

        expect(request.filePath).toBe("/test.ts");
        expect(request.automatic).toBe(true);
      });
    });

    describe("endAIEdit", () => {
      it("marks AI as inactive", () => {
        manager.recordAIEdit("/test.ts");
        manager.endAIEdit("/test.ts");

        const state = manager.getFileState("/test.ts");
        expect(state?.aiActive).toBe(false);
      });

      it("clears paused state", () => {
        manager.recordAIEdit("/test.ts");
        manager.pauseAI("/test.ts", "Test");
        manager.endAIEdit("/test.ts");

        expect(manager.isAIPaused("/test.ts")).toBe(false);
      });
    });

    describe("canAIEdit", () => {
      it("returns true for new file", () => {
        expect(manager.canAIEdit("/new.ts")).toBe(true);
      });

      it("returns false when human active", () => {
        manager.recordHumanEdit("/test.ts");

        expect(manager.canAIEdit("/test.ts")).toBe(false);
      });

      it("returns false when AI paused", () => {
        manager.recordAIEdit("/test.ts");
        manager.pauseAI("/test.ts", "Test");

        expect(manager.canAIEdit("/test.ts")).toBe(false);
      });

      it("returns true when no conflict", () => {
        manager.recordAIEdit("/test.ts");

        expect(manager.canAIEdit("/test.ts")).toBe(true);
      });
    });

    describe("getFileState", () => {
      it("returns null for unknown file", () => {
        expect(manager.getFileState("/unknown.ts")).toBeNull();
      });

      it("returns cloned state", () => {
        manager.recordHumanEdit("/test.ts");

        const state1 = manager.getFileState("/test.ts");
        const state2 = manager.getFileState("/test.ts");

        expect(state1).not.toBe(state2);
      });
    });

    describe("getAllFileStates", () => {
      it("returns all tracked files", () => {
        manager.recordHumanEdit("/a.ts");
        manager.recordAIEdit("/b.ts");

        const states = manager.getAllFileStates();

        expect(states.length).toBe(2);
      });

      it("returns cloned states", () => {
        manager.recordHumanEdit("/test.ts");

        const states1 = manager.getAllFileStates();
        const states2 = manager.getAllFileStates();

        expect(states1[0]).not.toBe(states2[0]);
      });
    });

    describe("getConflictingFiles", () => {
      it("returns files with active conflicts", () => {
        manager.recordAIEdit("/conflict.ts");
        manager.recordHumanEdit("/conflict.ts");
        manager.recordHumanEdit("/human-only.ts");

        const conflicting = manager.getConflictingFiles();

        expect(conflicting).toContain("/conflict.ts");
        expect(conflicting).not.toContain("/human-only.ts");
      });
    });

    describe("getPausedFiles", () => {
      it("returns files where AI is paused", () => {
        manager.recordAIEdit("/paused.ts");
        manager.pauseAI("/paused.ts", "Test");
        manager.recordAIEdit("/active.ts");

        const paused = manager.getPausedFiles();

        expect(paused).toContain("/paused.ts");
        expect(paused).not.toContain("/active.ts");
      });
    });

    describe("clearFileState", () => {
      it("removes file state", () => {
        manager.recordHumanEdit("/test.ts");
        manager.clearFileState("/test.ts");

        expect(manager.getFileState("/test.ts")).toBeNull();
      });
    });

    describe("clearAllState", () => {
      it("removes all state", () => {
        manager.recordHumanEdit("/a.ts");
        manager.recordAIEdit("/b.ts");
        manager.clearAllState();

        expect(manager.getAllFileStates().length).toBe(0);
      });
    });

    describe("event callbacks", () => {
      it("registers callback", () => {
        const callback = vi.fn();
        manager.onEvent(callback);

        manager.recordHumanEdit("/test.ts");

        expect(callback).toHaveBeenCalled();
      });

      it("removes callback", () => {
        const callback = vi.fn();
        manager.onEvent(callback);
        manager.offEvent(callback);

        manager.recordHumanEdit("/test.ts");

        expect(callback).not.toHaveBeenCalled();
      });

      it("handles callback errors gracefully", () => {
        manager.onEvent(() => {
          throw new Error("Callback error");
        });

        expect(() => manager.recordHumanEdit("/test.ts")).not.toThrow();
      });
    });

    describe("config management", () => {
      it("updates configuration", () => {
        manager.updateConfig({ humanStopDebounce: 2000 });

        const config = manager.getConfig();
        expect(config.humanStopDebounce).toBe(2000);
      });

      it("returns config copy", () => {
        const config1 = manager.getConfig();
        const config2 = manager.getConfig();

        expect(config1).not.toBe(config2);
      });
    });

    describe("getStats", () => {
      it("returns statistics", () => {
        manager.recordAIEdit("/conflict.ts");
        manager.recordHumanEdit("/conflict.ts");
        manager.recordHumanEdit("/human.ts");

        const stats = manager.getStats();

        expect(stats.totalFiles).toBe(2);
        expect(stats.conflictingFiles).toBe(1);
        expect(stats.pausedFiles).toBe(1);
        expect(stats.totalPauseCount).toBe(1);
      });
    });

    describe("auto-resume behavior", () => {
      it("emits human:stop after debounce", async () => {
        vi.useFakeTimers();
        const events: ConflictEvent[] = [];
        manager.onEvent((e) => events.push(e));

        manager.recordHumanEdit("/test.ts");
        vi.advanceTimersByTime(1000);

        expect(events.some((e) => e.type === "human:stop")).toBe(true);
        vi.useRealTimers();
      });

      it("does not auto-resume if disabled", async () => {
        vi.useFakeTimers();
        manager.updateConfig({ autoResumeAI: false });

        manager.recordAIEdit("/test.ts");
        manager.recordHumanEdit("/test.ts");

        vi.advanceTimersByTime(2000);

        expect(manager.isAIPaused("/test.ts")).toBe(true);
        vi.useRealTimers();
      });

      it("does not auto-pause if disabled", () => {
        manager.updateConfig({ autoPauseAI: false });

        manager.recordAIEdit("/test.ts");
        manager.recordHumanEdit("/test.ts");

        expect(manager.isAIPaused("/test.ts")).toBe(false);
      });
    });
  });

  describe("createConflictAwareEditHandler", () => {
    it("creates handler with callbacks", () => {
      const manager = createConflictPreventionManager();
      const onPause = vi.fn();
      const onResume = vi.fn();

      const handler = createConflictAwareEditHandler(manager, { onPause, onResume });

      // AI starts editing first
      handler.beforeAIEdit("/test.ts");
      // Then human starts editing - this triggers conflict and pause
      handler.beforeHumanEdit("/test.ts");

      expect(onPause).toHaveBeenCalledWith("/test.ts");
    });

    it("beforeHumanEdit records human activity", () => {
      const manager = createConflictPreventionManager();
      const handler = createConflictAwareEditHandler(manager);

      handler.beforeHumanEdit("/test.ts");

      expect(manager.isHumanEditing("/test.ts")).toBe(true);
    });

    it("beforeAIEdit returns false if cannot edit", () => {
      const manager = createConflictPreventionManager();
      const handler = createConflictAwareEditHandler(manager);

      handler.beforeHumanEdit("/test.ts");
      const canEdit = handler.beforeAIEdit("/test.ts");

      expect(canEdit).toBe(false);
    });

    it("beforeAIEdit returns true if can edit", () => {
      const manager = createConflictPreventionManager();
      const handler = createConflictAwareEditHandler(manager);

      const canEdit = handler.beforeAIEdit("/test.ts");

      expect(canEdit).toBe(true);
    });

    it("afterAIEdit ends AI activity", () => {
      const manager = createConflictPreventionManager();
      const handler = createConflictAwareEditHandler(manager);

      handler.beforeAIEdit("/test.ts");
      handler.afterAIEdit("/test.ts");

      const state = manager.getFileState("/test.ts");
      expect(state?.aiActive).toBe(false);
    });
  });

  describe("waitForAIEditPermission", () => {
    it("resolves immediately if can edit", async () => {
      const manager = createConflictPreventionManager();

      const result = await waitForAIEditPermission(manager, "/test.ts", 1000);

      expect(result).toBe(true);
    });

    it("waits for resume if paused", async () => {
      vi.useFakeTimers();
      const manager = createConflictPreventionManager({
        humanStopDebounce: 500,
        resumeGracePeriod: 200,
      });

      manager.recordAIEdit("/test.ts");
      manager.recordHumanEdit("/test.ts");

      const promise = waitForAIEditPermission(manager, "/test.ts", 5000);

      // Wait for human stop + resume
      vi.advanceTimersByTime(700);

      const result = await promise;
      expect(result).toBe(true);

      vi.useRealTimers();
    });

    it("times out if permission not granted", async () => {
      vi.useFakeTimers();
      const manager = createConflictPreventionManager({
        autoResumeAI: false,
      });

      manager.recordHumanEdit("/test.ts");

      const promise = waitForAIEditPermission(manager, "/test.ts", 1000);
      vi.advanceTimersByTime(1000);

      const result = await promise;
      expect(result).toBe(false);

      vi.useRealTimers();
    });
  });
});
