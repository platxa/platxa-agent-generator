"use client";

/**
 * PresenceIndicator
 *
 * Shows real-time presence status: who's typing, editing, or viewing.
 * Displays activity messages and typing indicators.
 */

import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Users, Pencil, Eye } from "lucide-react";
import type { CollaboratorInfo } from "@/lib/collaboration";

// =============================================================================
// Types
// =============================================================================

export interface PresenceIndicatorProps {
  /** List of collaborators */
  collaborators: CollaboratorInfo[];
  /** Current file path to filter by */
  currentFile?: string;
  /** Compact mode (icon only) */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function PresenceIndicator({
  collaborators,
  currentFile,
  compact = false,
  className,
}: PresenceIndicatorProps) {
  const [dots, setDots] = useState("");

  // Animate typing dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Filter and categorize collaborators
  const { typing, editing, viewing } = useMemo(() => {
    const remote = collaborators.filter((c) => !c.isLocal);
    const inFile = currentFile
      ? remote.filter((c) => c.currentFile === currentFile)
      : remote;

    return {
      typing: inFile.filter((c) => c.status === "typing"),
      editing: inFile.filter((c) => c.status === "editing"),
      viewing: inFile.filter((c) => c.status === "viewing"),
    };
  }, [collaborators, currentFile]);

  // No remote activity
  if (typing.length === 0 && editing.length === 0 && viewing.length === 0) {
    return null;
  }

  // Compact mode - just show icon with count
  if (compact) {
    const total = typing.length + editing.length + viewing.length;
    const hasActivity = typing.length > 0 || editing.length > 0;

    return (
      <div
        className={cn(
          "flex items-center gap-1 text-xs",
          hasActivity ? "text-green-500" : "text-muted-foreground",
          className
        )}
      >
        <Users className="w-3.5 h-3.5" />
        <span>{total}</span>
        {typing.length > 0 && <TypingDots />}
      </div>
    );
  }

  // Full mode - show detailed status
  return (
    <div className={cn("flex flex-col gap-1 text-xs", className)}>
      {typing.length > 0 && (
        <PresenceRow
          icon={<Pencil className="w-3 h-3" />}
          color="text-yellow-500"
          message={formatNames(typing) + " typing" + dots}
        />
      )}
      {editing.length > 0 && (
        <PresenceRow
          icon={<Pencil className="w-3 h-3" />}
          color="text-green-500"
          message={formatNames(editing) + " editing"}
        />
      )}
      {viewing.length > 0 && (
        <PresenceRow
          icon={<Eye className="w-3 h-3" />}
          color="text-blue-500"
          message={formatNames(viewing) + " viewing"}
        />
      )}
    </div>
  );
}

// =============================================================================
// Subcomponents
// =============================================================================

interface PresenceRowProps {
  icon: React.ReactNode;
  color: string;
  message: string;
}

function PresenceRow({ icon, color, message }: PresenceRowProps) {
  return (
    <div className={cn("flex items-center gap-1.5", color)}>
      {icon}
      <span className="truncate">{message}</span>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-0.5 ml-0.5">
      <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
    </span>
  );
}

// =============================================================================
// Typing Indicator (Standalone)
// =============================================================================

export interface TypingIndicatorProps {
  /** Names of people typing */
  names: string[];
  /** Additional CSS classes */
  className?: string;
}

export function TypingIndicator({ names, className }: TypingIndicatorProps) {
  if (names.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      <TypingDots />
      <span>{formatNames(names.map((n) => ({ name: n })))} typing...</span>
    </div>
  );
}

// =============================================================================
// Activity Badge
// =============================================================================

export interface ActivityBadgeProps {
  /** Activity type */
  type: "typing" | "editing" | "viewing" | "idle";
  /** Show label */
  showLabel?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function ActivityBadge({ type, showLabel = true, className }: ActivityBadgeProps) {
  const config = {
    typing: { color: "bg-yellow-500", label: "Typing" },
    editing: { color: "bg-green-500", label: "Editing" },
    viewing: { color: "bg-blue-500", label: "Viewing" },
    idle: { color: "bg-gray-400", label: "Idle" },
  };

  const { color, label } = config[type];

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "w-2 h-2 rounded-full",
          color,
          type === "typing" && "animate-pulse"
        )}
      />
      {showLabel && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  );
}

// =============================================================================
// Collaborator List Panel
// =============================================================================

export interface CollaboratorListProps {
  /** List of collaborators */
  collaborators: CollaboratorInfo[];
  /** Current file to highlight */
  currentFile?: string;
  /** Additional CSS classes */
  className?: string;
}

export function CollaboratorList({ collaborators, currentFile, className }: CollaboratorListProps) {
  const remote = collaborators.filter((c) => !c.isLocal);

  if (remote.length === 0) {
    return (
      <div className={cn("text-xs text-muted-foreground text-center py-4", className)}>
        No other collaborators
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {remote.map((collaborator) => (
        <div
          key={collaborator.clientId}
          className={cn(
            "flex items-center gap-3 p-2 rounded-lg",
            collaborator.currentFile === currentFile && "bg-muted/50"
          )}
        >
          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
            style={{ backgroundColor: collaborator.color }}
          >
            {collaborator.isAi ? "AI" : getInitials(collaborator.name)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">{collaborator.name}</span>
              {collaborator.isAi && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                  AI
                </span>
              )}
            </div>
            {collaborator.currentFile && (
              <span className="text-xs text-muted-foreground truncate block">
                {getFileName(collaborator.currentFile)}
              </span>
            )}
          </div>

          {/* Status */}
          <ActivityBadge type={collaborator.status} showLabel={false} />
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Utilities
// =============================================================================

function formatNames(collaborators: { name: string }[]): string {
  if (collaborators.length === 0) return "";
  if (collaborators.length === 1) return collaborators[0].name;
  if (collaborators.length === 2) {
    return `${collaborators[0].name} and ${collaborators[1].name}`;
  }
  return `${collaborators[0].name} and ${collaborators.length - 1} others`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getFileName(path: string): string {
  return path.split("/").pop() || path;
}
