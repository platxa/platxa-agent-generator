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
// Animation Configuration
// =============================================================================

/** Animation settings for step transitions */
export const STEP_ANIMATIONS = {
  /** Duration for state transitions (ms) */
  transitionDuration: 300,
  /** Duration for checkmark pop animation (ms) */
  checkmarkDuration: 400,
  /** Delay before checkmark appears (ms) */
  checkmarkDelay: 100,
  /** Spinner rotation speed */
  spinnerSpeed: "1s",
  /** CSS classes for each animation state */
  classes: {
    /** Pending state: faded, waiting */
    pending: "opacity-50 scale-95",
    /** Running/active state: pulsing, highlighted */
    running: "opacity-100 scale-100",
    /** Complete state: checkmark with pop animation */
    complete: "opacity-100 scale-100",
  },
} as const;

// =============================================================================
// Sub-components
// =============================================================================

interface PhaseIndicatorProps {
  phase: AgentWorkflowPhase;
  status: PhaseStatus;
}

/**
 * Animated phase indicator with smooth transitions.
 * - pending → running: fade in + scale up
 * - running → complete: checkmark pops in with scale animation
 */
function PhaseIndicator({ phase, status }: PhaseIndicatorProps) {
  const config = PHASE_LABELS[phase];

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md",
        // Smooth transitions for all property changes
        "transition-all duration-300 ease-out",
        // Status-specific styles
        status === "complete" && "text-emerald-600 dark:text-emerald-400",
        status === "active" && "text-primary font-medium",
        status === "pending" && "text-muted-foreground opacity-60"
      )}
    >
      {/* Animated Icon Container */}
      <div className="relative w-4 h-4 flex items-center justify-center">
        {/* Complete: Animated checkmark with pop-in effect */}
        {status === "complete" && (
          <CheckCircle2
            className={cn(
              "w-4 h-4 text-emerald-500",
              // Pop-in animation for checkmark
              "animate-in zoom-in-50 duration-300"
            )}
            aria-label="Completed"
          />
        )}
        {/* Active: Spinning loader with pulse */}
        {status === "active" && (
          <Loader2
            className={cn(
              "w-4 h-4 text-primary",
              // Spinning animation
              "animate-spin"
            )}
            aria-label="In progress"
          />
        )}
        {/* Pending: Faded circle */}
        {status === "pending" && (
          <Circle
            className={cn(
              "w-4 h-4 text-muted-foreground/40",
              // Subtle scale for pending
              "scale-90 transition-transform duration-300"
            )}
            aria-label="Pending"
          />
        )}
      </div>

      {/* Label with smooth opacity transition */}
      <span
        className={cn(
          "text-sm whitespace-nowrap transition-opacity duration-300",
          status === "pending" && "opacity-60",
          status === "active" && "opacity-100",
          status === "complete" && "opacity-100"
        )}
      >
        {config.label}
      </span>
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
