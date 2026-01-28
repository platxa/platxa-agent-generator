import { describe, it, expect, beforeEach } from "vitest";
import {
  resetStepCounter,
  assessSeverity,
  selectStrategy,
  selectFallback,
  generateSteps,
  createRecoveryPlan,
  createRollbackState,
  setLastGoodState,
  recordAttempt,
  getFailedAttemptCount,
  getLastSuccessfulRecovery,
} from "@/lib/agent-bridge/rollback-recovery";
import type { FailureContext, RecoveryPlan, RecoveryResult } from "@/lib/agent-bridge/rollback-recovery";

beforeEach(() => {
  resetStepCounter();
});

function makeContext(overrides: Partial<FailureContext> = {}): FailureContext {
  return {
    error: "Generation failed",
    phase: "generate",
    affectedSections: ["s_hero"],
    hasPartialOutput: false,
    hasSnapshot: true,
    hasGitHistory: true,
    hasYjsHistory: false,
    retryCount: 0,
    maxRetries: 3,
    ...overrides,
  };
}

describe("Rollback Recovery", () => {
  describe("assessSeverity", () => {
    it("returns low for single section, first attempt, no partial", () => {
      expect(assessSeverity(makeContext())).toBe("low");
    });

    it("returns medium for single section with partial output", () => {
      expect(assessSeverity(makeContext({ hasPartialOutput: true }))).toBe("medium");
    });

    it("returns high for multiple sections", () => {
      expect(assessSeverity(makeContext({ affectedSections: ["a", "b"] }))).toBe("high");
    });

    it("returns high for repeated failures", () => {
      expect(assessSeverity(makeContext({ retryCount: 2 }))).toBe("high");
    });

    it("returns critical for many sections with no partial output", () => {
      expect(assessSeverity(makeContext({
        affectedSections: ["a", "b", "c", "d"],
        hasPartialOutput: false,
      }))).toBe("critical");
    });
  });

  describe("selectStrategy", () => {
    it("selects retry for low severity with retries remaining", () => {
      expect(selectStrategy(makeContext())).toBe("retry");
    });

    it("selects snapshot when available and retries exhausted", () => {
      expect(selectStrategy(makeContext({ retryCount: 3, maxRetries: 3 }))).toBe("snapshot");
    });

    it("selects yjs when snapshot unavailable", () => {
      expect(selectStrategy(makeContext({
        retryCount: 3, maxRetries: 3,
        hasSnapshot: false, hasYjsHistory: true,
      }))).toBe("yjs");
    });

    it("selects git when snapshot and yjs unavailable", () => {
      expect(selectStrategy(makeContext({
        retryCount: 3, maxRetries: 3,
        hasSnapshot: false, hasYjsHistory: false, hasGitHistory: true,
      }))).toBe("git");
    });

    it("selects manual when nothing available and retries exhausted", () => {
      expect(selectStrategy(makeContext({
        retryCount: 3, maxRetries: 3,
        hasSnapshot: false, hasYjsHistory: false, hasGitHistory: false,
      }))).toBe("manual");
    });

    it("prefers snapshot over retry for high severity", () => {
      expect(selectStrategy(makeContext({
        affectedSections: ["a", "b"], // high severity
        retryCount: 0,
      }))).toBe("snapshot");
    });
  });

  describe("selectFallback", () => {
    it("selects snapshot as fallback when primary is retry", () => {
      expect(selectFallback("retry", makeContext())).toBe("snapshot");
    });

    it("selects git when primary is snapshot", () => {
      expect(selectFallback("snapshot", makeContext())).toBe("git");
    });

    it("returns manual when no alternatives", () => {
      expect(selectFallback("retry", makeContext({
        hasSnapshot: false, hasYjsHistory: false, hasGitHistory: false,
        retryCount: 3, maxRetries: 3,
      }))).toBe("manual");
    });

    it("does not select same strategy as primary", () => {
      const fallback = selectFallback("snapshot", makeContext());
      expect(fallback).not.toBe("snapshot");
    });
  });

  describe("generateSteps", () => {
    it("generates snapshot steps", () => {
      const steps = generateSteps("snapshot", makeContext());
      expect(steps).toHaveLength(3);
      expect(steps[0].action).toBe("locate_snapshot");
      expect(steps[2].action).toBe("verify_restore");
      expect(steps.every((s) => s.strategy === "snapshot")).toBe(true);
    });

    it("generates git steps", () => {
      const steps = generateSteps("git", makeContext());
      expect(steps).toHaveLength(3);
      expect(steps[0].action).toBe("identify_commit");
    });

    it("generates yjs steps", () => {
      const steps = generateSteps("yjs", makeContext());
      expect(steps).toHaveLength(3);
      expect(steps[2].action).toBe("sync_clients");
    });

    it("generates retry steps with attempt count", () => {
      const steps = generateSteps("retry", makeContext({ retryCount: 1, maxRetries: 3 }));
      expect(steps).toHaveLength(2);
      expect(steps[1].description).toContain("2/3");
    });

    it("generates manual steps", () => {
      const steps = generateSteps("manual", makeContext());
      expect(steps).toHaveLength(2);
      expect(steps[0].action).toBe("notify_user");
    });

    it("assigns sequential step IDs", () => {
      const steps = generateSteps("snapshot", makeContext());
      expect(steps[0].id).toBe("step_1");
      expect(steps[1].id).toBe("step_2");
      expect(steps[2].id).toBe("step_3");
    });
  });

  describe("createRecoveryPlan", () => {
    it("creates plan with strategy and fallback", () => {
      const plan = createRecoveryPlan(makeContext());
      expect(plan.strategy).toBe("retry");
      expect(plan.fallback).not.toBe("retry");
      expect(plan.severity).toBe("low");
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.explanation).toBeTruthy();
    });

    it("sets autoExecute false for manual strategy", () => {
      const plan = createRecoveryPlan(makeContext({
        retryCount: 3, maxRetries: 3,
        hasSnapshot: false, hasYjsHistory: false, hasGitHistory: false,
      }));
      expect(plan.strategy).toBe("manual");
      expect(plan.autoExecute).toBe(false);
    });

    it("sets autoExecute false for critical severity", () => {
      const plan = createRecoveryPlan(makeContext({
        affectedSections: ["a", "b", "c", "d"],
        hasPartialOutput: false,
        retryCount: 3, maxRetries: 3,
      }));
      expect(plan.severity).toBe("critical");
      expect(plan.autoExecute).toBe(false);
    });

    it("sets autoExecute true for non-critical auto strategies", () => {
      const plan = createRecoveryPlan(makeContext());
      expect(plan.autoExecute).toBe(true);
    });
  });

  describe("rollback state", () => {
    it("creates empty state", () => {
      const state = createRollbackState();
      expect(state.attempts).toHaveLength(0);
      expect(state.lastGoodStateId).toBeNull();
    });

    it("sets last good state", () => {
      let state = createRollbackState();
      state = setLastGoodState(state, "snap_5", "snapshot");
      expect(state.lastGoodStateId).toBe("snap_5");
      expect(state.lastGoodStrategy).toBe("snapshot");
    });

    it("records recovery attempt", () => {
      let state = createRollbackState();
      const ctx = makeContext();
      const plan = createRecoveryPlan(ctx);
      const result: RecoveryResult = {
        success: true,
        strategyUsed: "retry",
        usedFallback: false,
        recoveredSections: ["s_hero"],
        unrecoveredSections: [],
        durationMs: 500,
        message: "Retry succeeded",
      };
      state = recordAttempt(state, ctx, plan, result);
      expect(state.attempts).toHaveLength(1);
      expect(state.attempts[0].result.success).toBe(true);
    });

    it("counts failed attempts", () => {
      let state = createRollbackState();
      const ctx = makeContext();
      const plan = createRecoveryPlan(ctx);
      const fail: RecoveryResult = {
        success: false, strategyUsed: "retry", usedFallback: false,
        recoveredSections: [], unrecoveredSections: ["s_hero"],
        durationMs: 100, message: "Failed",
      };
      const ok: RecoveryResult = {
        success: true, strategyUsed: "snapshot", usedFallback: true,
        recoveredSections: ["s_hero"], unrecoveredSections: [],
        durationMs: 200, message: "OK",
      };
      state = recordAttempt(state, ctx, plan, fail);
      state = recordAttempt(state, ctx, plan, ok);
      expect(getFailedAttemptCount(state)).toBe(1);
    });

    it("returns last successful recovery", () => {
      let state = createRollbackState();
      const ctx = makeContext();
      const plan = createRecoveryPlan(ctx);
      const fail: RecoveryResult = {
        success: false, strategyUsed: "retry", usedFallback: false,
        recoveredSections: [], unrecoveredSections: ["s_hero"],
        durationMs: 100, message: "Failed",
      };
      const ok: RecoveryResult = {
        success: true, strategyUsed: "snapshot", usedFallback: true,
        recoveredSections: ["s_hero"], unrecoveredSections: [],
        durationMs: 200, message: "Recovered",
      };
      state = recordAttempt(state, ctx, plan, fail);
      state = recordAttempt(state, ctx, plan, ok);
      const last = getLastSuccessfulRecovery(state);
      expect(last).not.toBeNull();
      expect(last!.result.message).toBe("Recovered");
    });

    it("returns null when no successful recovery", () => {
      const state = createRollbackState();
      expect(getLastSuccessfulRecovery(state)).toBeNull();
    });
  });

  describe("immutability", () => {
    it("does not mutate rollback state", () => {
      const state = createRollbackState();
      const updated = setLastGoodState(state, "snap_1", "snapshot");
      expect(state.lastGoodStateId).toBeNull();
      expect(updated.lastGoodStateId).toBe("snap_1");
    });
  });
});
