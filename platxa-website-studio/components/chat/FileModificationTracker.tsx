"use client";

import { useState, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  FilePlus,
  FileEdit,
  FileX,
  File,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { getFileIcon } from "@/lib/utils/file-icons";

// =============================================================================
// Types
// =============================================================================

/** File modification action types */
export type ModificationAction = "add" | "edit" | "delete";

/** Tracked file modification record */
export interface TrackedModification {
  /** File path */
  path: string;
  /** Modification action */
  action: ModificationAction;
  /** Timestamp of modification */
  timestamp: Date;
  /** Previous content (for edit/delete) */
  previousContent?: string;
  /** New content (for add/edit) */
  newContent?: string;
}

/** Props for FileModificationTracker component */
export interface FileModificationTrackerProps {
  /** List of file modifications */
  modifications: TrackedModification[];
  /** Whether the list is initially collapsed */
  defaultCollapsed?: boolean;
  /** Callback when a file is clicked */
  onFileClick?: (modification: TrackedModification) => void;
  /** Optional className */
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Status configuration for each modification action */
export const MODIFICATION_STATUS = {
  add: {
    label: "Added",
    shortLabel: "A",
    icon: FilePlus,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    borderColor: "border-emerald-200 dark:border-emerald-800",
  },
  edit: {
    label: "Modified",
    shortLabel: "M",
    icon: FileEdit,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    borderColor: "border-amber-200 dark:border-amber-800",
  },
  delete: {
    label: "Deleted",
    shortLabel: "D",
    icon: FileX,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    borderColor: "border-red-200 dark:border-red-800",
  },
} as const;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Groups modifications by directory for organized display.
 */
export function groupModificationsByDirectory(
  modifications: TrackedModification[]
): Map<string, TrackedModification[]> {
  const groups = new Map<string, TrackedModification[]>();

  for (const mod of modifications) {
    const parts = mod.path.split("/");
    const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
    const existing = groups.get(dir) || [];
    groups.set(dir, [...existing, mod]);
  }

  return groups;
}

/**
 * Gets summary counts of modifications by action type.
 */
export function getModificationSummary(
  modifications: TrackedModification[]
): Record<ModificationAction, number> {
  const summary: Record<ModificationAction, number> = {
    add: 0,
    edit: 0,
    delete: 0,
  };

  for (const mod of modifications) {
    summary[mod.action]++;
  }

  return summary;
}

/**
 * Extracts filename from path.
 */
export function getFileName(path: string): string {
  return path.split("/").pop() || path;
}

// =============================================================================
// Sub-components
// =============================================================================

interface ModificationBadgeProps {
  action: ModificationAction;
  compact?: boolean;
}

function ModificationBadge({ action, compact = false }: ModificationBadgeProps) {
  const status = MODIFICATION_STATUS[action];
  const Icon = status.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
        status.bgColor,
        status.color
      )}
      title={status.label}
    >
      <Icon className="w-3 h-3" />
      {!compact && <span>{status.shortLabel}</span>}
    </span>
  );
}

interface FileModificationItemProps {
  modification: TrackedModification;
  onClick?: () => void;
}

function FileModificationItem({ modification, onClick }: FileModificationItemProps) {
  const fileName = getFileName(modification.path);
  const FileIcon = getFileIcon(fileName);
  const status = MODIFICATION_STATUS[modification.action];

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer",
        "hover:bg-muted/50 transition-colors duration-150",
        "animate-in fade-in slide-in-from-left-2 duration-200"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
    >
      <FileIcon className={cn("w-4 h-4 flex-shrink-0", status.color)} />
      <span className="flex-1 text-sm font-mono truncate" title={modification.path}>
        {modification.path}
      </span>
      <ModificationBadge action={modification.action} />
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * FileModificationTracker - Collapsible list of changed files in real-time.
 *
 * Shows file modifications with add/edit/delete status and updates as files
 * are modified.
 *
 * @example
 * ```tsx
 * <FileModificationTracker
 *   modifications={[
 *     { path: "src/App.tsx", action: "edit", timestamp: new Date() },
 *     { path: "src/utils/new.ts", action: "add", timestamp: new Date() },
 *   ]}
 *   onFileClick={(mod) => console.log("Clicked:", mod.path)}
 * />
 * ```
 */
export function FileModificationTracker({
  modifications,
  defaultCollapsed = false,
  onFileClick,
  className,
}: FileModificationTrackerProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const summary = getModificationSummary(modifications);
  const totalCount = modifications.length;

  if (totalCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border/50 bg-muted/20 overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <button
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2",
          "hover:bg-muted/30 transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-primary/20"
        )}
        onClick={toggleCollapsed}
        aria-expanded={!isCollapsed}
        aria-controls="file-modification-list"
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}

        <File className="w-4 h-4 text-muted-foreground" />

        <span className="flex-1 text-sm font-medium text-left">
          {totalCount} file{totalCount !== 1 ? "s" : ""} changed
        </span>

        {/* Summary badges */}
        <div className="flex items-center gap-1">
          {summary.add > 0 && (
            <span className={cn("text-xs px-1.5 py-0.5 rounded", MODIFICATION_STATUS.add.bgColor, MODIFICATION_STATUS.add.color)}>
              +{summary.add}
            </span>
          )}
          {summary.edit > 0 && (
            <span className={cn("text-xs px-1.5 py-0.5 rounded", MODIFICATION_STATUS.edit.bgColor, MODIFICATION_STATUS.edit.color)}>
              ~{summary.edit}
            </span>
          )}
          {summary.delete > 0 && (
            <span className={cn("text-xs px-1.5 py-0.5 rounded", MODIFICATION_STATUS.delete.bgColor, MODIFICATION_STATUS.delete.color)}>
              -{summary.delete}
            </span>
          )}
        </div>
      </button>

      {/* File list */}
      {!isCollapsed && (
        <div
          id="file-modification-list"
          className="border-t border-border/50 py-1"
          role="list"
          aria-label="Modified files"
        >
          {modifications.map((mod, index) => (
            <FileModificationItem
              key={`${mod.path}-${mod.timestamp.getTime()}-${index}`}
              modification={mod}
              onClick={() => onFileClick?.(mod)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default FileModificationTracker;
