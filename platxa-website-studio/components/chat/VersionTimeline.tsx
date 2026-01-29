"use client";

import { useState } from "react";
import { Clock, Check, AlertCircle, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// =============================================================================
// Types
// =============================================================================

/** Version status in the timeline */
export type VersionStatus = "pending" | "generating" | "complete" | "error";

/** Version entry in the timeline */
export interface TimelineVersion {
  /** Unique version identifier */
  id: string;
  /** Version label (e.g., "v1", "v2", "Initial") */
  label: string;
  /** Timestamp of the version */
  timestamp: Date;
  /** Current status */
  status: VersionStatus;
  /** Optional description */
  description?: string;
  /** Optional error message */
  errorMessage?: string;
}

/** Props for VersionTimeline component */
export interface VersionTimelineProps {
  /** Array of versions to display */
  versions: TimelineVersion[];
  /** Currently selected version ID */
  selectedId?: string;
  /** Callback when a version is selected */
  onSelect?: (version: TimelineVersion) => void;
  /** Whether the timeline is collapsed */
  defaultCollapsed?: boolean;
  /** Optional className */
  className?: string;
}

// =============================================================================
// Configuration
// =============================================================================

/** Status configuration for visual display */
export const VERSION_STATUS_CONFIG = {
  pending: {
    icon: Clock,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    dotColor: "bg-muted-foreground/50",
    label: "Pending",
  },
  generating: {
    icon: Loader2,
    color: "text-primary",
    bgColor: "bg-primary/10",
    dotColor: "bg-primary",
    label: "Generating",
  },
  complete: {
    icon: Check,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    dotColor: "bg-emerald-500",
    label: "Complete",
  },
  error: {
    icon: AlertCircle,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    dotColor: "bg-red-500",
    label: "Error",
  },
} as const;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Formats a timestamp for display in the timeline.
 */
export function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formats a timestamp to full datetime string.
 */
export function formatFullTimestamp(date: Date): string {
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// =============================================================================
// Sub-components
// =============================================================================

interface TimelineItemProps {
  version: TimelineVersion;
  isSelected: boolean;
  isLast: boolean;
  onClick?: () => void;
}

function TimelineItem({ version, isSelected, isLast, onClick }: TimelineItemProps) {
  const statusConfig = VERSION_STATUS_CONFIG[version.status];
  const StatusIcon = statusConfig.icon;

  return (
    <div
      className={cn(
        "relative flex gap-3 pb-4",
        !isLast && "before:absolute before:left-[11px] before:top-6 before:h-full before:w-0.5 before:bg-border"
      )}
    >
      {/* Timeline dot */}
      <div
        className={cn(
          "relative z-10 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
          "border-2 border-background",
          statusConfig.bgColor,
          isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
        )}
      >
        <StatusIcon
          className={cn(
            "w-3 h-3",
            statusConfig.color,
            version.status === "generating" && "animate-spin"
          )}
        />
      </div>

      {/* Content */}
      <button
        className={cn(
          "flex-1 text-left rounded-lg px-3 py-2 -mt-0.5 transition-colors duration-150",
          "hover:bg-muted/50",
          isSelected && "bg-muted/70"
        )}
        onClick={onClick}
        disabled={!onClick}
      >
        <div className="flex items-center justify-between gap-2">
          <span className={cn("text-sm font-medium", statusConfig.color)}>
            {version.label}
          </span>
          <span
            className="text-xs text-muted-foreground"
            title={formatFullTimestamp(version.timestamp)}
          >
            {formatTimestamp(version.timestamp)}
          </span>
        </div>

        {version.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {version.description}
          </p>
        )}

        {version.status === "error" && version.errorMessage && (
          <p className="text-xs text-red-500 mt-0.5 line-clamp-1">
            {version.errorMessage}
          </p>
        )}
      </button>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * VersionTimeline - Vertical timeline showing generation history.
 *
 * Displays versions with timestamps in a collapsible sidebar component.
 *
 * @example
 * ```tsx
 * <VersionTimeline
 *   versions={[
 *     { id: "v1", label: "v1", timestamp: new Date(), status: "complete" },
 *     { id: "v2", label: "v2", timestamp: new Date(), status: "generating" },
 *   ]}
 *   selectedId="v1"
 *   onSelect={(v) => console.log("Selected:", v.id)}
 * />
 * ```
 */
export function VersionTimeline({
  versions,
  selectedId,
  onSelect,
  defaultCollapsed = false,
  className,
}: VersionTimelineProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  if (versions.length === 0) {
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
        onClick={() => setIsCollapsed((prev) => !prev)}
        aria-expanded={!isCollapsed}
        aria-controls="version-timeline-content"
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}

        <Clock className="w-4 h-4 text-muted-foreground" />

        <span className="flex-1 text-sm font-medium text-left">
          Version History
        </span>

        <span className="text-xs text-muted-foreground">
          {versions.length} version{versions.length !== 1 ? "s" : ""}
        </span>
      </button>

      {/* Timeline content */}
      {!isCollapsed && (
        <div
          id="version-timeline-content"
          className="px-3 py-2 border-t border-border/50"
          role="list"
          aria-label="Version timeline"
        >
          {versions.map((version, index) => (
            <TimelineItem
              key={version.id}
              version={version}
              isSelected={version.id === selectedId}
              isLast={index === versions.length - 1}
              onClick={onSelect ? () => onSelect(version) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default VersionTimeline;
