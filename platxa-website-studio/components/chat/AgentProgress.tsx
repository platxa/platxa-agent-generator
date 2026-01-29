"use client";

import { CheckCircle2, Circle, Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// =============================================================================
// Types
// =============================================================================

/** High-level agent workflow phases */
export type AgentWorkflowPhase = "planning" | "generating" | "validating" | "complete";

/** Phase status for display */
export type PhaseStatus = "pending" | "active" | "complete";

/** Props for the AgentProgress component */
export interface AgentProgressProps {
  /** Current phase of the workflow */
  currentPhase: AgentWorkflowPhase;
  /** Optional className for the container */
  className?: string;
}

// =============================================================================
// Configuration
// =============================================================================

interface PhaseConfig {
  label: string;
  shortLabel: string;
}

/** Workflow phases in order */
export const WORKFLOW_PHASES: AgentWorkflowPhase[] = [
  "planning",
  "generating",
  "validating",
  "complete",
];

/** Configuration for each phase */
export const PHASE_LABELS: Record<AgentWorkflowPhase, PhaseConfig> = {
  planning: { label: "Planning", shortLabel: "Plan" },
  generating: { label: "Generating", shortLabel: "Gen" },
  validating: { label: "Validating", shortLabel: "Val" },
  complete: { label: "Complete", shortLabel: "Done" },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Gets the status of a phase relative to the current phase.
 */
export function getPhaseStatus(
  phase: AgentWorkflowPhase,
  currentPhase: AgentWorkflowPhase
): PhaseStatus {
  const phaseIndex = WORKFLOW_PHASES.indexOf(phase);
  const currentIndex = WORKFLOW_PHASES.indexOf(currentPhase);

  if (phaseIndex < currentIndex) return "complete";
  if (phaseIndex === currentIndex) return "active";
  return "pending";
}

// =============================================================================
// Sub-components
// =============================================================================

interface PhaseIndicatorProps {
  phase: AgentWorkflowPhase;
  status: PhaseStatus;
}

function PhaseIndicator({ phase, status }: PhaseIndicatorProps) {
  const config = PHASE_LABELS[phase];

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md transition-all duration-300",
        status === "complete" && "text-emerald-600 dark:text-emerald-400",
        status === "active" && "text-primary font-medium",
        status === "pending" && "text-muted-foreground"
      )}
    >
      {/* Icon */}
      {status === "complete" && (
        <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-label="Completed" />
      )}
      {status === "active" && (
        <Loader2 className="w-4 h-4 animate-spin text-primary" aria-label="In progress" />
      )}
      {status === "pending" && (
        <Circle className="w-4 h-4 text-muted-foreground/50" aria-label="Pending" />
      )}

      {/* Label */}
      <span className="text-sm whitespace-nowrap">{config.label}</span>
    </div>
  );
}

interface PhaseConnectorProps {
  isComplete: boolean;
}

function PhaseConnector({ isComplete }: PhaseConnectorProps) {
  return (
    <ChevronRight
      className={cn(
        "w-4 h-4 flex-shrink-0 transition-colors duration-300",
        isComplete ? "text-emerald-500" : "text-muted-foreground/30"
      )}
      aria-hidden="true"
    />
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * AgentProgress - Shows phase progression with checkmarks.
 *
 * Displays the agent workflow as: Planning ✓ → Generating ⏳ → Validating → Complete
 *
 * @example
 * ```tsx
 * <AgentProgress currentPhase="generating" />
 * ```
 */
export function AgentProgress({ currentPhase, className }: AgentProgressProps) {
  const currentIndex = WORKFLOW_PHASES.indexOf(currentPhase);

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 p-2 rounded-lg bg-muted/30 border border-border/50",
        className
      )}
      role="progressbar"
      aria-valuenow={currentIndex + 1}
      aria-valuemin={1}
      aria-valuemax={WORKFLOW_PHASES.length}
      aria-label={`Agent progress: ${PHASE_LABELS[currentPhase].label}`}
    >
      {WORKFLOW_PHASES.map((phase, index) => {
        const status = getPhaseStatus(phase, currentPhase);
        const isLast = index === WORKFLOW_PHASES.length - 1;
        const connectorComplete = index < currentIndex;

        return (
          <div key={phase} className="flex items-center">
            <PhaseIndicator phase={phase} status={status} />
            {!isLast && <PhaseConnector isComplete={connectorComplete} />}
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// Compact Variant
// =============================================================================

/**
 * Compact version of AgentProgress for smaller spaces.
 */
export function AgentProgressCompact({ currentPhase, className }: AgentProgressProps) {
  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="progressbar"
      aria-label={`Agent progress: ${PHASE_LABELS[currentPhase].label}`}
    >
      {WORKFLOW_PHASES.map((phase, index) => {
        const status = getPhaseStatus(phase, currentPhase);
        const config = PHASE_LABELS[phase];
        const isLast = index === WORKFLOW_PHASES.length - 1;

        return (
          <div key={phase} className="flex items-center gap-1">
            <span
              className={cn(
                "text-xs",
                status === "complete" && "text-emerald-600 dark:text-emerald-400",
                status === "active" && "text-primary font-medium",
                status === "pending" && "text-muted-foreground"
              )}
              title={config.label}
            >
              {status === "complete" && "✓"}
              {status === "active" && "⏳"}
              {status === "pending" && "○"}
              {" "}
              {config.shortLabel}
            </span>
            {!isLast && (
              <span className="text-xs text-muted-foreground/50">→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default AgentProgress;
