/**
 * Agent Store
 *
 * Zustand store for agent pipeline state.
 * Tracks pipeline execution, brand context, and quality reports
 * for UI components to display agent activity.
 */

import { create } from "zustand";
import type {
  AgentStatus,
  BrandTokenContext,
  QualityReport,
  PreGenerationResult,
  PostGenerationResult,
  AgentPipelineResult,
} from "@/lib/agent-bridge/types";
import type { RecoveryPlan, RecoveryResult } from "@/lib/agent-bridge/rollback-recovery";

// =============================================================================
// State Interface
// =============================================================================

export type PipelineStatus = "idle" | "running" | "completed" | "error";

/** Recovery state for UI display */
export interface RecoveryState {
  /** Whether recovery is in progress */
  isRecovering: boolean;
  /** Last recovery plan executed */
  lastPlan: RecoveryPlan | null;
  /** Last recovery result */
  lastResult: RecoveryResult | null;
  /** Number of recovery attempts in current session */
  attemptCount: number;
  /** Snapshot ID for potential restore */
  snapshotId: string | null;
}

interface AgentState {
  // Pipeline status
  pipelineStatus: PipelineStatus;
  agentStatus: AgentStatus | null;

  // Results
  preGenerationResult: PreGenerationResult | null;
  postGenerationResult: PostGenerationResult | null;

  // Brand context (persists across messages in a session)
  brandContext: BrandTokenContext | null;

  // Quality
  qualityScore: number | null;
  qualityReport: QualityReport | null;

  // Recovery state (Feature #7)
  recoveryState: RecoveryState;

  // Error tracking
  lastError: string | null;

  // Actions
  startPipeline: () => void;
  setAgentStatus: (status: AgentStatus) => void;
  setPreGenerationResult: (result: PreGenerationResult) => void;
  setPostGenerationResult: (result: PostGenerationResult) => void;
  completePipeline: (result: AgentPipelineResult) => void;
  /** Marks pipeline as complete without requiring full result (for simple completion signals) */
  markComplete: (message?: string) => void;
  setBrandContext: (context: BrandTokenContext) => void;
  reset: () => void;
}

// =============================================================================
// Store
// =============================================================================

const initialRecoveryState: RecoveryState = {
  isRecovering: false,
  lastPlan: null,
  lastResult: null,
  attemptCount: 0,
  snapshotId: null,
};

export const useAgentStore = create<AgentState>()((set) => ({
  // Initial state
  pipelineStatus: "idle",
  agentStatus: null,
  preGenerationResult: null,
  postGenerationResult: null,
  brandContext: null,
  qualityScore: null,
  qualityReport: null,
  recoveryState: initialRecoveryState,
  lastError: null,

  // Actions
  startPipeline: () =>
    set({
      pipelineStatus: "running",
      agentStatus: {
        phase: "analyzing",
        message: "Starting agent pipeline...",
        progress: 0,
        startedAt: new Date().toISOString(),
      },
      preGenerationResult: null,
      postGenerationResult: null,
      lastError: null,
    }),

  setAgentStatus: (status) =>
    set({ agentStatus: status }),

  setPreGenerationResult: (result) =>
    set({
      preGenerationResult: result,
      brandContext: result.brandTokens,
    }),

  setPostGenerationResult: (result) =>
    set({
      postGenerationResult: result,
      qualityScore: result.quality.overallScore,
      qualityReport: result.quality,
    }),

  completePipeline: (result) =>
    set({
      pipelineStatus: "completed",
      agentStatus: {
        phase: "complete",
        message: "Generation complete",
        progress: 100,
        startedAt: new Date().toISOString(),
      },
    }),

  markComplete: (message = "Generation complete") =>
    set({
      pipelineStatus: "completed",
      agentStatus: {
        phase: "complete",
        message,
        progress: 100,
        startedAt: new Date().toISOString(),
      },
    }),

  setBrandContext: (context) =>
    set({ brandContext: context }),

  reset: () =>
    set({
      pipelineStatus: "idle",
      agentStatus: null,
      preGenerationResult: null,
      postGenerationResult: null,
      qualityScore: null,
      qualityReport: null,
      recoveryState: initialRecoveryState,
      lastError: null,
      // Note: brandContext is NOT reset — it persists across messages
    }),
}));

// =============================================================================
// Selectors
// =============================================================================

export const selectIsRunning = (state: AgentState) =>
  state.pipelineStatus === "running";

export const selectQualityScore = (state: AgentState) =>
  state.qualityScore;

export const selectBrandColors = (state: AgentState) =>
  state.brandContext?.colors ?? null;

export const selectAgentPhase = (state: AgentState) =>
  state.agentStatus?.phase ?? "idle";

export const selectIsRecovering = (state: AgentState) =>
  state.recoveryState.isRecovering;

export const selectRecoveryAttempts = (state: AgentState) =>
  state.recoveryState.attemptCount;

export const selectLastRecoveryResult = (state: AgentState) =>
  state.recoveryState.lastResult;
