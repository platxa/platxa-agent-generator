"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  FileCode2,
  FileEdit,
  FilePlus2,
  FileSearch,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type {
  StepPreview,
  FilePreview,
  PlanPreview as PlanPreviewType,
} from "@/lib/agentic-core/plan-preview";

// =============================================================================
// Types
// =============================================================================

interface PlanPreviewProps {
  /** The plan preview data to display */
  preview: PlanPreviewType;
  /** Whether to show file details */
  showFiles?: boolean;
  /** Whether to show duration estimates */
  showDuration?: boolean;
  /** Callback when a step is clicked */
  onStepClick?: (stepNumber: number) => void;
  /** Currently active step (for highlighting) */
  activeStep?: number;
  /** Additional class name */
  className?: string;
  /** Compact mode (fewer details) */
  compact?: boolean;
}

// =============================================================================
// Helpers
// =============================================================================

const ACTION_ICONS: Record<string, typeof FileCode2> = {
  read_file: FileSearch,
  write_file: FilePlus2,
  edit_file: FileEdit,
  delete_file: Trash2,
  search: FileSearch,
  execute: FileCode2,
  validate: CheckCircle2,
};

const STATUS_CONFIG = {
  pending: {
    icon: Circle,
    color: "text-muted-foreground",
    bg: "bg-muted",
    label: "Pending",
  },
  in_progress: {
    icon: Loader2,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    label: "In Progress",
  },
  completed: {
    icon: CheckCircle2,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    label: "Completed",
  },
  failed: {
    icon: XCircle,
    color: "text-red-500",
    bg: "bg-red-500/10",
    label: "Failed",
  },
  skipped: {
    icon: Circle,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    label: "Skipped",
  },
};

const RISK_CONFIG = {
  low: { color: "text-emerald-600", bg: "bg-emerald-500/10" },
  medium: { color: "text-amber-600", bg: "bg-amber-500/10" },
  high: { color: "text-red-600", bg: "bg-red-500/10" },
};

// =============================================================================
// Subcomponents
// =============================================================================

interface StepRowProps {
  step: StepPreview;
  isActive?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

function StepRow({ step, isActive, onClick, compact }: StepRowProps) {
  const ActionIcon = ACTION_ICONS[step.action] || FileCode2;
  const statusConfig = STATUS_CONFIG[step.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;
  const riskConfig = step.riskLevel ? RISK_CONFIG[step.riskLevel] : null;

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border transition-colors",
        isActive
          ? "border-primary bg-primary/5"
          : "border-transparent hover:bg-muted/50",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Step number */}
      <div
        className={cn(
          "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
          statusConfig.bg,
          statusConfig.color
        )}
      >
        {step.status === "in_progress" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : step.status === "completed" ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          step.number
        )}
      </div>

      {/* Step content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <ActionIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium">{step.actionLabel}</span>
          {riskConfig && step.riskLevel !== "low" && (
            <span
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded",
                riskConfig.bg,
                riskConfig.color
              )}
            >
              <AlertTriangle className="w-3 h-3" />
              {step.riskLevel}
            </span>
          )}
        </div>

        {/* Target */}
        <p className="text-xs font-mono text-muted-foreground mt-0.5 truncate">
          {step.target}
        </p>

        {/* Rationale/Description */}
        {!compact && step.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {step.description}
          </p>
        )}

        {/* Duration estimate */}
        {!compact && step.estimatedDurationSec > 0 && (
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>~{formatDuration(step.estimatedDurationSec)}</span>
          </div>
        )}
      </div>

      {/* Status indicator */}
      <StatusIcon
        className={cn(
          "w-4 h-4 flex-shrink-0",
          statusConfig.color,
          step.status === "in_progress" && "animate-spin"
        )}
      />
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) return `${minutes}m`;
  return `${minutes}m ${remainingSeconds}s`;
}

interface FilesListProps {
  files: FilePreview[];
}

function FilesList({ files }: FilesListProps) {
  const [expanded, setExpanded] = useState(false);
  const displayFiles = expanded ? files : files.slice(0, 3);
  const hasMore = files.length > 3;

  const changeTypeIcons = {
    create: FilePlus2,
    modify: FileEdit,
    delete: Trash2,
    read: FileSearch,
  };

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <FileCode2 className="w-3 h-3" />
        Affected Files ({files.length})
      </h4>
      <div className="space-y-1">
        {displayFiles.map((file, i) => {
          const Icon = changeTypeIcons[file.changeType] || FileCode2;
          return (
            <div
              key={i}
              className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-muted/50"
            >
              <Icon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="font-mono flex-1 truncate" title={file.path}>
                {file.path}
              </span>
              {file.linesChanged && (
                <span className="text-muted-foreground">~{file.linesChanged}</span>
              )}
            </div>
          );
        })}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-primary hover:underline flex items-center gap-1"
          type="button"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              Show {files.length - 3} more
            </>
          )}
        </button>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * PlanPreview - Shows numbered execution steps with details
 *
 * Feature #51: Shows steps 1-N with action, target, and rationale
 *
 * @example
 * ```tsx
 * <PlanPreview
 *   preview={planPreviewData}
 *   activeStep={currentStep}
 *   onStepClick={(n) => console.log('Clicked step', n)}
 * />
 * ```
 */
export function PlanPreview({
  preview,
  showFiles = true,
  showDuration = true,
  onStepClick,
  activeStep,
  className,
  compact = false,
}: PlanPreviewProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="space-y-1">
        <h3 className="font-medium">{preview.title}</h3>
        {!compact && preview.description && (
          <p className="text-sm text-muted-foreground">{preview.description}</p>
        )}
      </div>

      {/* Summary stats */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{preview.stepCount} steps</span>
        <span>{preview.fileCount} files</span>
        {showDuration && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {preview.duration.totalFormatted}
          </span>
        )}
        <span
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded",
            RISK_CONFIG[preview.riskLevel].bg,
            RISK_CONFIG[preview.riskLevel].color
          )}
        >
          <AlertTriangle className="w-3 h-3" />
          {preview.riskLevel} risk
        </span>
      </div>

      {/* Steps list */}
      <div className="space-y-1">
        <h4 className="text-xs font-medium text-muted-foreground mb-2">
          Execution Steps
        </h4>
        <div className="space-y-1">
          {preview.steps.map((step) => (
            <StepRow
              key={step.id}
              step={step}
              isActive={activeStep === step.number}
              onClick={onStepClick ? () => onStepClick(step.number) : undefined}
              compact={compact}
            />
          ))}
        </div>
      </div>

      {/* Files list */}
      {showFiles && preview.files.length > 0 && (
        <FilesList files={preview.files} />
      )}

      {/* Summary */}
      {!compact && preview.summary && (
        <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          {preview.summary}
        </p>
      )}
    </div>
  );
}

export default PlanPreview;
