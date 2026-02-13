import { describe, it, expect, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { useAgentStore } from "@/lib/stores/agent-store";
import type { RecoveryPlan, RecoveryResult } from "@/lib/agent-bridge/rollback-recovery";

/**
 * Tests for agent-store recovery actions (Fix 3: H6)
 */

const mockPlan: RecoveryPlan = {
  strategy: "retry",
  fallback: "manual",
  severity: "low",
  explanation: "Retry the failed generation. Fallback: Manual recovery required.",
  steps: [
    { id: "step_1", action: "clear_partial", description: "Clear partial output", strategy: "retry" },
    { id: "step_2", action: "retry_generation", description: "Retry generation (attempt 1/3)", strategy: "retry" },
  ],
  autoExecute: true,
};

const mockResult: RecoveryResult = {
  success: true,
  strategyUsed: "retry",
  usedFallback: false,
  recoveredSections: ["hero", "features"],
  unrecoveredSections: [],
  durationMs: 1500,
  message: "Successfully retried generation",
};

describe("agent-store recovery actions", () => {
  beforeEach(() => {
    act(() => {
      useAgentStore.setState(useAgentStore.getInitialState());
    });
  });

  it("startRecovery sets isRecovering and stores plan", () => {
    act(() => {
      useAgentStore.getState().startRecovery(mockPlan);
    });

    const state = useAgentStore.getState();
    expect(state.recoveryState.isRecovering).toBe(true);
    expect(state.recoveryState.lastPlan).toEqual(mockPlan);
  });

  it("startRecovery increments attemptCount", () => {
    act(() => {
      useAgentStore.getState().startRecovery(mockPlan);
    });
    expect(useAgentStore.getState().recoveryState.attemptCount).toBe(1);

    act(() => {
      useAgentStore.getState().startRecovery(mockPlan);
    });
    expect(useAgentStore.getState().recoveryState.attemptCount).toBe(2);

    act(() => {
      useAgentStore.getState().startRecovery(mockPlan);
    });
    expect(useAgentStore.getState().recoveryState.attemptCount).toBe(3);
  });

  it("completeRecovery clears isRecovering and stores result", () => {
    act(() => {
      useAgentStore.getState().startRecovery(mockPlan);
    });
    expect(useAgentStore.getState().recoveryState.isRecovering).toBe(true);

    act(() => {
      useAgentStore.getState().completeRecovery(mockResult);
    });

    const state = useAgentStore.getState();
    expect(state.recoveryState.isRecovering).toBe(false);
    expect(state.recoveryState.lastResult).toEqual(mockResult);
  });

  it("failPipeline sets error status and lastError", () => {
    act(() => {
      useAgentStore.getState().failPipeline("Connection timeout");
    });

    const state = useAgentStore.getState();
    expect(state.pipelineStatus).toBe("error");
    expect(state.lastError).toBe("Connection timeout");
    expect(state.agentStatus?.phase).toBe("error");
    expect(state.agentStatus?.message).toBe("Connection timeout");
  });

  it("setSnapshotId stores snapshot ID", () => {
    act(() => {
      useAgentStore.getState().setSnapshotId("snap_abc123");
    });

    expect(useAgentStore.getState().recoveryState.snapshotId).toBe("snap_abc123");
  });

  it("reset clears recovery state", () => {
    // Set up recovery state
    act(() => {
      useAgentStore.getState().startRecovery(mockPlan);
      useAgentStore.getState().completeRecovery(mockResult);
      useAgentStore.getState().setSnapshotId("snap_xyz");
    });

    // Verify state is set
    expect(useAgentStore.getState().recoveryState.attemptCount).toBe(1);
    expect(useAgentStore.getState().recoveryState.lastResult).toBeTruthy();

    // Reset
    act(() => {
      useAgentStore.getState().reset();
    });

    const state = useAgentStore.getState();
    expect(state.recoveryState.isRecovering).toBe(false);
    expect(state.recoveryState.lastPlan).toBeNull();
    expect(state.recoveryState.lastResult).toBeNull();
    expect(state.recoveryState.attemptCount).toBe(0);
    expect(state.recoveryState.snapshotId).toBeNull();
    expect(state.pipelineStatus).toBe("idle");
    expect(state.lastError).toBeNull();
  });

  it("completeRecovery preserves attemptCount", () => {
    act(() => {
      useAgentStore.getState().startRecovery(mockPlan);
      useAgentStore.getState().startRecovery(mockPlan);
      useAgentStore.getState().completeRecovery(mockResult);
    });

    // attemptCount should still be 2 after completeRecovery
    expect(useAgentStore.getState().recoveryState.attemptCount).toBe(2);
  });

  it("failPipeline followed by startRecovery transitions correctly", () => {
    act(() => {
      useAgentStore.getState().failPipeline("Network error");
    });
    expect(useAgentStore.getState().pipelineStatus).toBe("error");

    act(() => {
      useAgentStore.getState().startRecovery(mockPlan);
    });
    expect(useAgentStore.getState().recoveryState.isRecovering).toBe(true);
    // Pipeline status should still be error until explicit state change
    expect(useAgentStore.getState().pipelineStatus).toBe("error");
  });
});
