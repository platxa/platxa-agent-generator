"use client";

import { Bot, Search, PenLine, TestTube2, CheckCircle2, Palette, Shield, FileCode2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAgentStore, selectIsRunning, selectAgentPhase } from "@/lib/stores/agent-store";
import type { AgentPhase } from "@/lib/agent-bridge/types";

// =============================================================================
// Phase Configuration
// =============================================================================

interface PhaseConfig {
  label: string;
  icon: typeof Bot;
  color: string;
  bgColor: string;
}

const PHASE_CONFIG: Record<AgentPhase, PhaseConfig> = {
  idle: { label: "Ready", icon: Bot, color: "text-muted-foreground", bgColor: "bg-muted" },
  analyzing: { label: "Analyzing", icon: Search, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  generating_palette: { label: "Generating palette", icon: Palette, color: "text-purple-500", bgColor: "bg-purple-500/10" },
  generating_theme: { label: "Generating theme", icon: FileCode2, color: "text-violet-500", bgColor: "bg-violet-500/10" },
  injecting_tokens: { label: "Injecting tokens", icon: PenLine, color: "text-indigo-500", bgColor: "bg-indigo-500/10" },
  streaming: { label: "Streaming", icon: Loader2, color: "text-primary", bgColor: "bg-primary/10" },
  post_processing: { label: "Post-processing", icon: PenLine, color: "text-amber-500", bgColor: "bg-amber-500/10" },
  auditing_a11y: { label: "Accessibility audit", icon: Shield, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  computing_quality: { label: "Quality check", icon: TestTube2, color: "text-teal-500", bgColor: "bg-teal-500/10" },
  writing_files: { label: "Writing files", icon: FileCode2, color: "text-orange-500", bgColor: "bg-orange-500/10" },
  complete: { label: "Complete", icon: CheckCircle2, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  error: { label: "Error", icon: Bot, color: "text-red-500", bgColor: "bg-red-500/10" },
};

/** Ordered pipeline phases for the step indicator */
const PIPELINE_STEPS: AgentPhase[] = [
  "analyzing",
  "generating_palette",
  "generating_theme",
  "streaming",
  "auditing_a11y",
  "computing_quality",
  "writing_files",
  "complete",
];

// =============================================================================
// Component
// =============================================================================

export function AgentPhaseIndicator() {
  const isRunning = useAgentStore(selectIsRunning);
  const currentPhase = useAgentStore(selectAgentPhase);
  const agentStatus = useAgentStore((s) => s.agentStatus);

  if (!isRunning && currentPhase === "idle") return null;

  const config = PHASE_CONFIG[currentPhase] || PHASE_CONFIG.idle;
  const Icon = config.icon;
  const progress = agentStatus?.progress ?? 0;
  const message = agentStatus?.message ?? config.label;

  // Determine which steps are completed
  const currentStepIndex = PIPELINE_STEPS.indexOf(currentPhase);

  return (
    <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-primary/10">
        <Bot className="w-4 h-4 text-primary" />
      </div>

      {/* Content */}
      <div className="flex-1 space-y-3">
        <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-muted/50 border border-border/50">
          {/* Current phase */}
          <div className="flex items-center gap-2">
            <Icon className={cn("w-4 h-4", config.color, isRunning && "animate-pulse")} />
            <span className="text-sm font-medium">{message}</span>
          </div>

          {/* Progress bar */}
          {progress > 0 && (
            <div className="mt-3 space-y-1">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    currentPhase === "complete" ? "bg-emerald-500" : "bg-primary/60",
                  )}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{config.label}</span>
                <span>{Math.round(progress)}%</span>
              </div>
            </div>
          )}

          {/* Step indicators */}
          {isRunning && currentStepIndex >= 0 && (
            <div className="mt-3 flex items-center gap-1">
              {PIPELINE_STEPS.map((step, i) => {
                const stepConfig = PHASE_CONFIG[step];
                const isComplete = i < currentStepIndex;
                const isCurrent = i === currentStepIndex;
                return (
                  <div
                    key={step}
                    className={cn(
                      "flex-1 h-1 rounded-full transition-all duration-300",
                      isComplete ? "bg-emerald-500" : isCurrent ? "bg-primary animate-pulse" : "bg-muted",
                    )}
                    title={stepConfig.label}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
