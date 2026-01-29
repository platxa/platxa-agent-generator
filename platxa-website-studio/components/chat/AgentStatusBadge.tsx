"use client";

import { FileSearch, Bot, Pause, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// =============================================================================
// Types
// =============================================================================

/** Agent mode types */
export type AgentMode = "plan" | "agent" | "idle" | "error";

/** Props for AgentStatusBadge component */
export interface AgentStatusBadgeProps {
  /** Current agent mode */
  mode: AgentMode;
  /** Optional custom label override */
  label?: string;
  /** Badge size variant */
  size?: "sm" | "md" | "lg";
  /** Whether to show the icon */
  showIcon?: boolean;
  /** Whether the badge should pulse when active */
  pulse?: boolean;
  /** Optional className */
  className?: string;
}

// =============================================================================
// Configuration
// =============================================================================

/** Configuration for each agent mode */
export const MODE_CONFIG: Record<
  AgentMode,
  {
    label: string;
    icon: typeof Bot;
    color: string;
    bgColor: string;
    borderColor: string;
    description: string;
  }
> = {
  plan: {
    label: "Plan",
    icon: FileSearch,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-100 dark:bg-violet-900/30",
    borderColor: "border-violet-200 dark:border-violet-800",
    description: "Planning mode - analyzing and designing approach",
  },
  agent: {
    label: "Agent",
    icon: Bot,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    borderColor: "border-blue-200 dark:border-blue-800",
    description: "Agent mode - executing tasks autonomously",
  },
  idle: {
    label: "Idle",
    icon: Pause,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    borderColor: "border-border",
    description: "Idle - waiting for input",
  },
  error: {
    label: "Error",
    icon: AlertCircle,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    borderColor: "border-red-200 dark:border-red-800",
    description: "Error state - action required",
  },
};

/** Size variants */
export const SIZE_VARIANTS = {
  sm: {
    badge: "px-1.5 py-0.5 text-xs gap-1",
    icon: "w-3 h-3",
  },
  md: {
    badge: "px-2 py-1 text-sm gap-1.5",
    icon: "w-4 h-4",
  },
  lg: {
    badge: "px-3 py-1.5 text-base gap-2",
    icon: "w-5 h-5",
  },
} as const;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Gets the configuration for a mode.
 */
export function getModeConfig(mode: AgentMode) {
  return MODE_CONFIG[mode];
}

/**
 * Checks if a mode is an active mode (plan or agent).
 */
export function isActiveMode(mode: AgentMode): boolean {
  return mode === "plan" || mode === "agent";
}

/**
 * Gets the mode label.
 */
export function getModeLabel(mode: AgentMode, customLabel?: string): string {
  return customLabel || MODE_CONFIG[mode].label;
}

// =============================================================================
// Component
// =============================================================================

/**
 * AgentStatusBadge - Shows current agent mode with appropriate icon.
 *
 * Displays the mode name (Plan/Agent) with a colored badge and icon.
 *
 * @example
 * ```tsx
 * <AgentStatusBadge mode="plan" />
 * <AgentStatusBadge mode="agent" pulse />
 * <AgentStatusBadge mode="idle" size="sm" />
 * ```
 */
export function AgentStatusBadge({
  mode,
  label,
  size = "md",
  showIcon = true,
  pulse = false,
  className,
}: AgentStatusBadgeProps) {
  const config = MODE_CONFIG[mode];
  const sizeConfig = SIZE_VARIANTS[size];
  const Icon = config.icon;
  const displayLabel = getModeLabel(mode, label);

  const shouldPulse = pulse && isActiveMode(mode);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium border",
        "transition-colors duration-200",
        sizeConfig.badge,
        config.bgColor,
        config.color,
        config.borderColor,
        shouldPulse && "animate-pulse",
        className
      )}
      role="status"
      aria-label={`Agent mode: ${displayLabel}`}
      title={config.description}
    >
      {showIcon && (
        <Icon
          className={cn(
            sizeConfig.icon,
            shouldPulse && mode === "agent" && "animate-bounce"
          )}
          aria-hidden="true"
        />
      )}
      <span>{displayLabel}</span>
    </span>
  );
}

export default AgentStatusBadge;
