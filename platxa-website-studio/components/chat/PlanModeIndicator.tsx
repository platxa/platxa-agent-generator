"use client";

import { Brain, Bot, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// =============================================================================
// Types
// =============================================================================

export type IndicatorMode = "plan" | "agent";

interface PlanModeIndicatorProps {
  /** Current mode: 'plan' for planning phase, 'agent' for execution */
  mode: IndicatorMode;
  /** Optional additional class name */
  className?: string;
  /** Whether to show in compact mode */
  compact?: boolean;
}

// =============================================================================
// Configuration
// =============================================================================

interface ModeConfig {
  label: string;
  icon: typeof Bot;
  color: string;
  bgColor: string;
  description: string;
}

const MODE_CONFIG: Record<IndicatorMode, ModeConfig> = {
  plan: {
    label: "Plan Mode",
    icon: Brain,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    description: "Exploring and planning approach",
  },
  agent: {
    label: "Agent Mode",
    icon: Bot,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    description: "Executing plan with full tools",
  },
};

// =============================================================================
// Component
// =============================================================================

/**
 * PlanModeIndicator - Shows current mode with appropriate icon
 *
 * Feature #49: Visual indicator for Plan Mode vs Agent Mode
 *
 * @example
 * ```tsx
 * <PlanModeIndicator mode="plan" />   // Shows "Plan Mode" with thinking/brain icon
 * <PlanModeIndicator mode="agent" />  // Shows "Agent Mode" with robot icon
 * ```
 */
export function PlanModeIndicator({
  mode,
  className,
  compact = false,
}: PlanModeIndicatorProps) {
  const config = MODE_CONFIG[mode];
  const Icon = config.icon;

  if (compact) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium",
          config.bgColor,
          config.color,
          className
        )}
        title={config.description}
      >
        <Icon className="w-3 h-3" />
        <span>{config.label}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border",
        config.bgColor,
        "border-border/50",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full",
          mode === "plan" ? "bg-purple-500/20" : "bg-blue-500/20"
        )}
      >
        <Icon className={cn("w-4 h-4", config.color)} />
      </div>
      <div className="flex flex-col">
        <span className={cn("text-sm font-medium", config.color)}>
          {config.label}
        </span>
        <span className="text-xs text-muted-foreground">
          {config.description}
        </span>
      </div>
    </div>
  );
}

/**
 * Hook to get mode indicator configuration
 */
export function useModeConfig(mode: IndicatorMode) {
  return MODE_CONFIG[mode];
}

export default PlanModeIndicator;
