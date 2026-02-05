"use client";

/**
 * TaskProgressIndicator Component
 *
 * Shows current agent task progress with steps completed and estimated completion.
 * Provides real-time feedback during AI-powered operations.
 *
 * Features:
 * - Current step indicator with description
 * - Progress bar with percentage
 * - Files modified list
 * - Estimated time remaining
 * - Step history with status
 * - Cancel operation support
 *
 * Feature #92: UI Enhancements - TaskProgressIndicator
 */

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  FileCode,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Pause,
  Play,
  X,
  Sparkles,
  Zap,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

/** Step status */
export type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

/** Task step */
export interface TaskStep {
  id: string;
  name: string;
  description?: string;
  status: StepStatus;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

/** Modified file info */
export interface ModifiedFile {
  path: string;
  action: "created" | "modified" | "deleted";
  linesChanged?: number;
}

/** Task progress data */
export interface TaskProgress {
  taskId: string;
  taskName: string;
  taskDescription?: string;
  status: "running" | "paused" | "completed" | "failed" | "cancelled";
  steps: TaskStep[];
  currentStepIndex: number;
  modifiedFiles: ModifiedFile[];
  startedAt: Date;
  estimatedDuration?: number; // in ms
  progress: number; // 0-100
}

/** TaskProgressIndicator props */
export interface TaskProgressIndicatorProps {
  progress: TaskProgress;
  onCancel?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  showDetails?: boolean;
  compact?: boolean;
  className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return "< 1s";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function formatTimeRemaining(ms: number): string {
  if (ms < 1000) return "Almost done";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `~${seconds}s remaining`;
  const minutes = Math.ceil(seconds / 60);
  return `~${minutes}m remaining`;
}

function getElapsedTime(startedAt: Date): number {
  return Date.now() - startedAt.getTime();
}

// =============================================================================
// Sub-Components
// =============================================================================

/** Step status icon */
function StepStatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "running":
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    case "completed":
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case "failed":
      return <XCircle className="w-4 h-4 text-red-500" />;
    case "skipped":
      return <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />;
    default:
      return <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />;
  }
}

/** File action badge */
function FileActionBadge({ action }: { action: ModifiedFile["action"] }) {
  const config = {
    created: { label: "New", color: "text-green-600 bg-green-100 dark:bg-green-900/30" },
    modified: { label: "Modified", color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
    deleted: { label: "Deleted", color: "text-red-600 bg-red-100 dark:bg-red-900/30" },
  };

  const cfg = config[action];
  return (
    <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

/** Progress bar */
function ProgressBar({ progress, status }: { progress: number; status: TaskProgress["status"] }) {
  const colorClass = {
    running: "bg-blue-500",
    paused: "bg-amber-500",
    completed: "bg-green-500",
    failed: "bg-red-500",
    cancelled: "bg-gray-400",
  };

  return (
    <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`absolute inset-y-0 left-0 transition-all duration-300 rounded-full ${colorClass[status]}`}
        style={{ width: `${progress}%` }}
      />
      {status === "running" && (
        <div
          className="absolute inset-y-0 left-0 bg-white/30 animate-pulse rounded-full"
          style={{ width: `${progress}%` }}
        />
      )}
    </div>
  );
}

/** Step list item */
function StepItem({ step, isActive }: { step: TaskStep; isActive: boolean }) {
  return (
    <div className={`flex items-start gap-3 p-2 rounded-lg ${
      isActive ? "bg-blue-50 dark:bg-blue-900/20" : ""
    }`}>
      <div className="mt-0.5">
        <StepStatusIcon status={step.status} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${
          step.status === "completed" ? "text-gray-500" :
          step.status === "failed" ? "text-red-600 dark:text-red-400" :
          isActive ? "text-blue-700 dark:text-blue-300" :
          "text-gray-700 dark:text-gray-300"
        }`}>
          {step.name}
        </p>
        {step.description && (
          <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
        )}
        {step.error && (
          <p className="text-xs text-red-500 mt-1">{step.error}</p>
        )}
      </div>
      {step.completedAt && step.startedAt && (
        <span className="text-xs text-gray-400">
          {formatDuration(step.completedAt.getTime() - step.startedAt.getTime())}
        </span>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function TaskProgressIndicator({
  progress,
  onCancel,
  onPause,
  onResume,
  showDetails = true,
  compact = false,
  className = "",
}: TaskProgressIndicatorProps) {
  const [expanded, setExpanded] = useState(!compact);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Update elapsed time
  useEffect(() => {
    if (progress.status !== "running") return;

    const interval = setInterval(() => {
      setElapsedTime(getElapsedTime(progress.startedAt));
    }, 1000);

    return () => clearInterval(interval);
  }, [progress.status, progress.startedAt]);

  // Calculate estimated time remaining
  const timeRemaining = useMemo(() => {
    if (!progress.estimatedDuration || progress.status !== "running") return null;
    const elapsed = getElapsedTime(progress.startedAt);
    const remaining = progress.estimatedDuration - elapsed;
    return remaining > 0 ? remaining : null;
  }, [progress.estimatedDuration, progress.status, progress.startedAt, elapsedTime]);

  // Get current step
  const currentStep = progress.steps[progress.currentStepIndex];

  // Count completed steps
  const completedSteps = progress.steps.filter(s => s.status === "completed").length;

  if (compact) {
    return (
      <div className={`flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
        {progress.status === "running" ? (
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" />
        ) : progress.status === "completed" ? (
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
        ) : progress.status === "failed" ? (
          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
        ) : (
          <Pause className="w-5 h-5 text-amber-500 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {currentStep?.name || progress.taskName}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <ProgressBar progress={progress.progress} status={progress.status} />
            <span className="text-xs text-gray-500 flex-shrink-0">
              {Math.round(progress.progress)}%
            </span>
          </div>
        </div>

        {onCancel && progress.status === "running" && (
          <button
            onClick={onCancel}
            className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              progress.status === "running" ? "bg-blue-100 dark:bg-blue-900/30" :
              progress.status === "completed" ? "bg-green-100 dark:bg-green-900/30" :
              progress.status === "failed" ? "bg-red-100 dark:bg-red-900/30" :
              "bg-gray-100 dark:bg-gray-800"
            }`}>
              {progress.status === "running" ? (
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              ) : progress.status === "completed" ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : progress.status === "failed" ? (
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              ) : (
                <Pause className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              )}
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {progress.taskName}
              </h3>
              {progress.taskDescription && (
                <p className="text-sm text-gray-500 mt-0.5">{progress.taskDescription}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {progress.status === "running" && onPause && (
              <button
                onClick={onPause}
                className="p-2 text-gray-400 hover:text-amber-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Pause"
              >
                <Pause className="w-4 h-4" />
              </button>
            )}
            {progress.status === "paused" && onResume && (
              <button
                onClick={onResume}
                className="p-2 text-gray-400 hover:text-green-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Resume"
              >
                <Play className="w-4 h-4" />
              </button>
            )}
            {onCancel && (progress.status === "running" || progress.status === "paused") && (
              <button
                onClick={onCancel}
                className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              Step {progress.currentStepIndex + 1} of {progress.steps.length}
            </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {Math.round(progress.progress)}%
            </span>
          </div>
          <ProgressBar progress={progress.progress} status={progress.status} />
        </div>

        {/* Current step and time info */}
        <div className="flex items-center justify-between mt-3">
          {currentStep && (
            <div className="flex items-center gap-2 text-sm">
              {progress.status === "running" && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />}
              <span className="text-gray-600 dark:text-gray-400">
                {currentStep.name}
              </span>
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDuration(elapsedTime || getElapsedTime(progress.startedAt))}
            </span>
            {timeRemaining && (
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                {formatTimeRemaining(timeRemaining)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Expandable details */}
      {showDetails && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            <span>
              {completedSteps}/{progress.steps.length} steps completed
              {progress.modifiedFiles.length > 0 && ` • ${progress.modifiedFiles.length} files`}
            </span>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {expanded && (
            <div className="border-t border-gray-200 dark:border-gray-800">
              {/* Steps list */}
              <div className="p-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Steps
                </h4>
                <div className="space-y-1">
                  {progress.steps.map((step, index) => (
                    <StepItem
                      key={step.id}
                      step={step}
                      isActive={index === progress.currentStepIndex && progress.status === "running"}
                    />
                  ))}
                </div>
              </div>

              {/* Modified files */}
              {progress.modifiedFiles.length > 0 && (
                <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Modified Files
                  </h4>
                  <div className="space-y-2">
                    {progress.modifiedFiles.map((file, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <FileCode className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-700 dark:text-gray-300 truncate font-mono text-xs">
                          {file.path}
                        </span>
                        <FileActionBadge action={file.action} />
                        {file.linesChanged !== undefined && (
                          <span className="text-xs text-gray-400">
                            {file.linesChanged} lines
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default TaskProgressIndicator;
