"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageSquare, Bot, Eye, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getModeManager,
  type OperationalMode,
  type ModeChangeEvent,
} from "@/lib/agent-bridge/mode-manager";

// =============================================================================
// Types
// =============================================================================

interface ModeSwitchProps {
  /** Current mode (controlled) */
  mode?: OperationalMode;
  /** Called when mode changes */
  onModeChange?: (mode: OperationalMode) => void;
  /** Display variant */
  variant?: "tabs" | "dropdown" | "compact";
  /** Disable mode switching */
  disabled?: boolean;
  /** Show keyboard shortcut hints */
  showShortcuts?: boolean;
  /** Additional class name */
  className?: string;
}

interface ModeInfo {
  id: OperationalMode;
  label: string;
  description: string;
  icon: typeof MessageSquare;
  shortcut: string;
  color: string;
}

// =============================================================================
// Constants
// =============================================================================

const MODE_INFO: ModeInfo[] = [
  {
    id: "chat",
    label: "Chat",
    description: "Discuss ideas and generate plans",
    icon: MessageSquare,
    shortcut: "⌘1",
    color: "text-blue-500",
  },
  {
    id: "agent",
    label: "Agent",
    description: "Execute plans autonomously",
    icon: Bot,
    shortcut: "⌘2",
    color: "text-green-500",
  },
  {
    id: "visual",
    label: "Visual",
    description: "Edit elements directly on preview",
    icon: Eye,
    shortcut: "⌘3",
    color: "text-purple-500",
  },
];

/** Keyboard shortcuts */
const SHORTCUTS: Record<string, OperationalMode> = {
  "1": "chat",
  "2": "agent",
  "3": "visual",
};

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook for managing mode state with keyboard shortcuts.
 */
function useModeSwitch(
  controlledMode?: OperationalMode,
  onModeChange?: (mode: OperationalMode) => void
) {
  const manager = getModeManager();
  const [mode, setMode] = useState<OperationalMode>(
    controlledMode ?? manager.getCurrentMode()
  );

  // Sync with manager
  useEffect(() => {
    const unsubscribe = manager.on((event: ModeChangeEvent) => {
      if (!controlledMode) {
        setMode(event.to);
      }
      onModeChange?.(event.to);
    });

    return unsubscribe;
  }, [manager, controlledMode, onModeChange]);

  // Update when controlled mode changes
  useEffect(() => {
    if (controlledMode && controlledMode !== mode) {
      setMode(controlledMode);
    }
  }, [controlledMode, mode]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd/Ctrl + number
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        const targetMode = SHORTCUTS[e.key];
        if (targetMode) {
          e.preventDefault();
          switchMode(targetMode);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const switchMode = useCallback(
    (newMode: OperationalMode) => {
      if (newMode === mode) return;

      const success = manager.setMode(newMode);
      if (success) {
        if (!controlledMode) {
          setMode(newMode);
        }
        onModeChange?.(newMode);
      }
    },
    [manager, mode, controlledMode, onModeChange]
  );

  return { mode, switchMode };
}

// =============================================================================
// Tab Variant
// =============================================================================

function TabsVariant({
  mode,
  switchMode,
  disabled,
  showShortcuts,
  className,
}: {
  mode: OperationalMode;
  switchMode: (mode: OperationalMode) => void;
  disabled?: boolean;
  showShortcuts?: boolean;
  className?: string;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "inline-flex items-center gap-1 p-1 bg-muted rounded-lg",
          className
        )}
        role="tablist"
        aria-label="Mode selection"
      >
        {MODE_INFO.map((info) => {
          const Icon = info.icon;
          const isActive = mode === info.id;

          return (
            <Tooltip key={info.id}>
              <TooltipTrigger asChild>
                <button
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`${info.id}-panel`}
                  disabled={disabled}
                  onClick={() => switchMode(info.id)}
                  className={cn(
                    "relative flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isActive
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                    disabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 transition-colors",
                      isActive && info.color
                    )}
                  />
                  <span>{info.label}</span>
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="flex flex-col gap-1">
                <span className="font-medium">{info.label}</span>
                <span className="text-xs text-muted-foreground">
                  {info.description}
                </span>
                {showShortcuts && (
                  <span className="text-xs text-muted-foreground font-mono">
                    {info.shortcut}
                  </span>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

// =============================================================================
// Dropdown Variant
// =============================================================================

function DropdownVariant({
  mode,
  switchMode,
  disabled,
  showShortcuts,
  className,
}: {
  mode: OperationalMode;
  switchMode: (mode: OperationalMode) => void;
  disabled?: boolean;
  showShortcuts?: boolean;
  className?: string;
}) {
  const currentMode = MODE_INFO.find((m) => m.id === mode)!;
  const CurrentIcon = currentMode.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn("gap-2", className)}
        >
          <CurrentIcon className={cn("w-4 h-4", currentMode.color)} />
          <span>{currentMode.label}</span>
          <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {MODE_INFO.map((info) => {
          const Icon = info.icon;
          const isActive = mode === info.id;

          return (
            <DropdownMenuItem
              key={info.id}
              onClick={() => switchMode(info.id)}
              className={cn(
                "flex items-center gap-3 py-2",
                isActive && "bg-accent"
              )}
            >
              <Icon className={cn("w-4 h-4", info.color)} />
              <div className="flex-1">
                <div className="font-medium">{info.label}</div>
                <div className="text-xs text-muted-foreground">
                  {info.description}
                </div>
              </div>
              {showShortcuts && (
                <span className="text-xs text-muted-foreground font-mono">
                  {info.shortcut}
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// =============================================================================
// Compact Variant
// =============================================================================

function CompactVariant({
  mode,
  switchMode,
  disabled,
  className,
}: {
  mode: OperationalMode;
  switchMode: (mode: OperationalMode) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn("inline-flex items-center gap-0.5", className)}
        role="tablist"
        aria-label="Mode selection"
      >
        {MODE_INFO.map((info) => {
          const Icon = info.icon;
          const isActive = mode === info.id;

          return (
            <Tooltip key={info.id}>
              <TooltipTrigger asChild>
                <button
                  role="tab"
                  aria-selected={isActive}
                  aria-label={info.label}
                  disabled={disabled}
                  onClick={() => switchMode(info.id)}
                  className={cn(
                    "p-2 rounded-md transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    disabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 transition-colors",
                      isActive && info.color
                    )}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <span>{info.label}</span>
                <span className="ml-2 text-muted-foreground font-mono text-xs">
                  {info.shortcut}
                </span>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * ModeSwitch - UI component for switching between Chat/Agent/Visual modes
 *
 * Feature #6: Chat Mode System - Mode switch UI
 *
 * @example
 * ```tsx
 * // Uncontrolled (syncs with ModeManager)
 * <ModeSwitch onModeChange={(mode) => console.log(`Switched to ${mode}`)} />
 *
 * // Controlled
 * <ModeSwitch mode={currentMode} onModeChange={setCurrentMode} />
 *
 * // Different variants
 * <ModeSwitch variant="tabs" />
 * <ModeSwitch variant="dropdown" />
 * <ModeSwitch variant="compact" />
 * ```
 */
export function ModeSwitch({
  mode: controlledMode,
  onModeChange,
  variant = "tabs",
  disabled = false,
  showShortcuts = true,
  className,
}: ModeSwitchProps) {
  const { mode, switchMode } = useModeSwitch(controlledMode, onModeChange);

  const props = {
    mode,
    switchMode,
    disabled,
    showShortcuts,
    className,
  };

  switch (variant) {
    case "dropdown":
      return <DropdownVariant {...props} />;
    case "compact":
      return <CompactVariant {...props} />;
    case "tabs":
    default:
      return <TabsVariant {...props} />;
  }
}

export default ModeSwitch;
