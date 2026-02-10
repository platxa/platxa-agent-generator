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
  lastPipelineResult: AgentPipelineResult | null;

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
  failPipeline: (error: string) => void;
  setBrandContext: (context: BrandTokenContext) => void;
  /** Start recovery process */
  startRecovery: (snapshotId: string | null) => void;
  /** Complete recovery with result */
  completeRecovery: (plan: RecoveryPlan, result: RecoveryResult) => void;
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
  lastPipelineResult: null,
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
      lastPipelineResult: result,
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

  failPipeline: (error) =>
    set({
      pipelineStatus: "error",
      lastError: error,
      agentStatus: {
        phase: "error",
        message: error,
        startedAt: new Date().toISOString(),
      },
    }),

  setBrandContext: (context) =>
    set({ brandContext: context }),

  startRecovery: (snapshotId) =>
    set((state) => ({
      recoveryState: {
        ...state.recoveryState,
        isRecovering: true,
        snapshotId,
      },
      agentStatus: {
        phase: "analyzing",
        message: "Recovering from failure...",
        progress: 0,
        startedAt: new Date().toISOString(),
      },
    })),

  completeRecovery: (plan, result) =>
    set((state) => ({
      recoveryState: {
        isRecovering: false,
        lastPlan: plan,
        lastResult: result,
        attemptCount: state.recoveryState.attemptCount + 1,
        snapshotId: null,
      },
      pipelineStatus: result.success ? "completed" : "error",
      agentStatus: {
        phase: result.success ? "complete" : "error",
        message: result.message,
        progress: result.success ? 100 : 0,
        startedAt: new Date().toISOString(),
      },
      lastError: result.success ? null : result.message,
    })),

  reset: () =>
    set({
      pipelineStatus: "idle",
      agentStatus: null,
      preGenerationResult: null,
      postGenerationResult: null,
      lastPipelineResult: null,
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
