"use client";

import { useState, useCallback, useId } from "react";
import { Brain, Bot, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// =============================================================================
// Types
// =============================================================================

/** Available modes for the agent */
export type AgentMode = "plan" | "agent";

/** Props for ModeSwitcher component */
export interface ModeSwitcherProps {
  /** Current mode (controlled) - if provided, component is controlled */
  mode?: AgentMode;
  /** Default mode for uncontrolled usage */
  defaultMode?: AgentMode;
  /** Callback when mode changes */
  onModeChange?: (mode: AgentMode) => void;
  /** Whether switching is disabled */
  disabled?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Show dropdown indicator */
  showDropdown?: boolean;
  /** Additional class name */
  className?: string;
  /** Compact mode - icon only with tooltip */
  compact?: boolean;
}

// =============================================================================
// Configuration
// =============================================================================

/** Configuration for each mode */
interface ModeConfig {
  label: string;
  shortLabel: string;
  icon: typeof Bot;
  color: string;
  bgColor: string;
  hoverBg: string;
  borderColor: string;
  description: string;
  activeIndicator: string;
}

const MODE_CONFIG: Record<AgentMode, ModeConfig> = {
  plan: {
    label: "Plan Mode",
    shortLabel: "Plan",
    icon: Brain,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-50 dark:bg-violet-950/50",
    hoverBg: "hover:bg-violet-100 dark:hover:bg-violet-900/50",
    borderColor: "border-violet-200 dark:border-violet-800",
    description: "Explore and plan approach before executing",
    activeIndicator: "bg-violet-500",
  },
  agent: {
    label: "Agent Mode",
    shortLabel: "Agent",
    icon: Bot,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/50",
    hoverBg: "hover:bg-blue-100 dark:hover:bg-blue-900/50",
    borderColor: "border-blue-200 dark:border-blue-800",
    description: "Execute tasks with full tool access",
    activeIndicator: "bg-blue-500",
  },
};

/** Size variants */
const SIZE_VARIANTS = {
  sm: {
    container: "h-8 text-xs",
    icon: "w-3.5 h-3.5",
    padding: "px-2 py-1",
    gap: "gap-1.5",
    indicator: "w-1.5 h-1.5",
  },
  md: {
    container: "h-9 text-sm",
    icon: "w-4 h-4",
    padding: "px-3 py-1.5",
    gap: "gap-2",
    indicator: "w-2 h-2",
  },
  lg: {
    container: "h-10 text-base",
    icon: "w-5 h-5",
    padding: "px-4 py-2",
    gap: "gap-2.5",
    indicator: "w-2.5 h-2.5",
  },
} as const;

// =============================================================================
// Component
// =============================================================================

/**
 * ModeSwitcher - Toggle between Plan and Agent modes
 *
 * Feature #29: Mode switching UI with clear visual indicators
 *
 * Features:
 * - Click to toggle between plan/agent modes
 * - Clear visual indicators (brain icon for plan, robot for agent)
 * - Keyboard accessible (Enter/Space to toggle)
 * - Supports controlled and uncontrolled usage
 * - Smooth transitions and hover states
 *
 * @example
 * ```tsx
 * // Uncontrolled
 * <ModeSwitcher defaultMode="plan" onModeChange={(mode) => console.log(mode)} />
 *
 * // Controlled
 * const [mode, setMode] = useState<AgentMode>("plan");
 * <ModeSwitcher mode={mode} onModeChange={setMode} />
 *
 * // Compact mode
 * <ModeSwitcher mode="agent" compact />
 * ```
 */
export function ModeSwitcher({
  mode: controlledMode,
  defaultMode = "plan",
  onModeChange,
  disabled = false,
  size = "md",
  showDropdown = false,
  className,
  compact = false,
}: ModeSwitcherProps) {
  // Support both controlled and uncontrolled usage
  const [internalMode, setInternalMode] = useState<AgentMode>(defaultMode);
  const isControlled = controlledMode !== undefined;
  const currentMode = isControlled ? controlledMode : internalMode;

  // Generate unique ID for accessibility
  const labelId = useId();

  // Get configuration for current mode
  const config = MODE_CONFIG[currentMode];
  const sizeConfig = SIZE_VARIANTS[size];
  const Icon = config.icon;

  // Handle mode toggle
  const handleToggle = useCallback(() => {
    if (disabled) return;

    const newMode: AgentMode = currentMode === "plan" ? "agent" : "plan";

    if (!isControlled) {
      setInternalMode(newMode);
    }

    onModeChange?.(newMode);
  }, [currentMode, disabled, isControlled, onModeChange]);

  // Handle keyboard interaction
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleToggle();
      }
    },
    [handleToggle]
  );

  // Compact mode - icon only with tooltip
  if (compact) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={currentMode === "agent"}
        aria-label={`Current mode: ${config.label}. Click to switch to ${
          currentMode === "plan" ? "Agent" : "Plan"
        } mode`}
        disabled={disabled}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative inline-flex items-center justify-center rounded-lg border transition-all duration-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          config.bgColor,
          config.borderColor,
          !disabled && config.hoverBg,
          disabled && "opacity-50 cursor-not-allowed",
          size === "sm" && "w-8 h-8",
          size === "md" && "w-9 h-9",
          size === "lg" && "w-10 h-10",
          currentMode === "plan"
            ? "focus-visible:ring-violet-500"
            : "focus-visible:ring-blue-500",
          className
        )}
        title={`${config.label}: ${config.description}`}
      >
        <Icon className={cn(sizeConfig.icon, config.color)} aria-hidden="true" />
        {/* Active indicator dot */}
        <span
          className={cn(
            "absolute -top-0.5 -right-0.5 rounded-full ring-2 ring-background",
            sizeConfig.indicator,
            config.activeIndicator
          )}
          aria-hidden="true"
        />
      </button>
    );
  }

  // Full mode with label
  return (
    <button
      type="button"
      role="switch"
      aria-checked={currentMode === "agent"}
      aria-labelledby={labelId}
      disabled={disabled}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative inline-flex items-center rounded-lg border font-medium transition-all duration-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        sizeConfig.container,
        sizeConfig.padding,
        sizeConfig.gap,
        config.bgColor,
        config.borderColor,
        config.color,
        !disabled && config.hoverBg,
        disabled && "opacity-50 cursor-not-allowed",
        currentMode === "plan"
          ? "focus-visible:ring-violet-500"
          : "focus-visible:ring-blue-500",
        className
      )}
      title={config.description}
    >
      {/* Active indicator dot */}
      <span
        className={cn(
          "rounded-full animate-pulse",
          sizeConfig.indicator,
          config.activeIndicator
        )}
        aria-hidden="true"
      />

      {/* Icon */}
      <Icon className={sizeConfig.icon} aria-hidden="true" />

      {/* Label */}
      <span id={labelId}>{config.shortLabel}</span>

      {/* Dropdown indicator (optional) */}
      {showDropdown && (
        <ChevronDown
          className={cn("w-3 h-3 opacity-60", config.color)}
          aria-hidden="true"
        />
      )}
    </button>
  );
}

// =============================================================================
// Mode Badge Variant
// =============================================================================

export interface ModeBadgeProps {
  /** Current mode */
  mode: AgentMode;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional class name */
  className?: string;
}

/**
 * ModeBadge - Non-interactive mode indicator badge
 *
 * Use when you just need to display the current mode without interaction.
 */
export function ModeBadge({ mode, size = "md", className }: ModeBadgeProps) {
  const config = MODE_CONFIG[mode];
  const sizeConfig = SIZE_VARIANTS[size];
  const Icon = config.icon;

  return (
    <span
      role="status"
      aria-label={`Current mode: ${config.label}`}
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        sizeConfig.padding,
        sizeConfig.gap,
        config.bgColor,
        config.borderColor,
        config.color,
        className
      )}
      title={config.description}
    >
      <Icon className={sizeConfig.icon} aria-hidden="true" />
      <span>{config.shortLabel}</span>
    </span>
  );
}

// =============================================================================
// Utility Hooks
// =============================================================================

/**
 * Hook to get mode configuration
 */
export function useModeConfig(mode: AgentMode) {
  return MODE_CONFIG[mode];
}

/**
 * Hook to manage mode state with persistence
 */
export function useAgentMode(initialMode: AgentMode = "plan") {
  const [mode, setMode] = useState<AgentMode>(() => {
    // Try to restore from localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("platxa-agent-mode");
      if (stored === "plan" || stored === "agent") {
        return stored;
      }
    }
    return initialMode;
  });

  const setModeWithPersistence = useCallback((newMode: AgentMode) => {
    setMode(newMode);
    if (typeof window !== "undefined") {
      localStorage.setItem("platxa-agent-mode", newMode);
    }
  }, []);

  const toggleMode = useCallback(() => {
    setModeWithPersistence(mode === "plan" ? "agent" : "plan");
  }, [mode, setModeWithPersistence]);

  return {
    mode,
    setMode: setModeWithPersistence,
    toggleMode,
    isPlanMode: mode === "plan",
    isAgentMode: mode === "agent",
  };
}

// =============================================================================
// Exports
// =============================================================================

export default ModeSwitcher;
