"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Circle,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ChevronDown,
  ChevronRight,
  Play,
  RotateCcw,
  FileCode,
  Paintbrush,
  Layout,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PlanStep, ImplementationPlan } from "@/lib/agent-bridge/chat-mode";
import type { StepStatus, ExecutionProgress } from "@/lib/agent-bridge/plan-executor";

// =============================================================================
// Types
// =============================================================================

interface PlanViewerProps {
  /** The implementation plan to display */
  plan: ImplementationPlan;
  /** Current execution progress (if executing) */
  progress?: ExecutionProgress;
  /** Called when user requests to execute a specific step */
  onExecuteStep?: (stepId: string) => void;
  /** Called when user requests to retry a failed step */
  onRetryStep?: (stepId: string) => void;
  /** Whether execution is currently running */
  isExecuting?: boolean;
  /** Show compact view */
  compact?: boolean;
  /** Additional class name */
  className?: string;
}

interface StepItemProps {
  step: PlanStep;
  index: number;
  status: StepStatus;
  isCurrentStep: boolean;
  onExecute?: () => void;
  onRetry?: () => void;
  isExecuting: boolean;
  compact: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/** Status configuration */
const STATUS_CONFIG: Record<
  StepStatus,
  { icon: typeof Circle; color: string; label: string; bgColor: string }
> = {
  pending: {
    icon: Circle,
    color: "text-muted-foreground",
    label: "Pending",
    bgColor: "bg-muted",
  },
  running: {
    icon: Loader2,
    color: "text-blue-500",
    label: "Running",
    bgColor: "bg-blue-500/10",
  },
  completed: {
    icon: CheckCircle2,
    color: "text-green-500",
    label: "Completed",
    bgColor: "bg-green-500/10",
  },
  failed: {
    icon: XCircle,
    color: "text-red-500",
    label: "Failed",
    bgColor: "bg-red-500/10",
  },
  skipped: {
    icon: Circle,
    color: "text-yellow-500",
    label: "Skipped",
    bgColor: "bg-yellow-500/10",
  },
};

/** Tool type icons */
const TOOL_ICONS: Record<string, typeof FileCode> = {
  generate_template: FileCode,
  generate_scss: Paintbrush,
  generate_snippet: Layout,
  analyze_design: Sparkles,
};

// =============================================================================
// Helper Components
// =============================================================================

function StepIcon({
  status,
  className,
}: {
  status: StepStatus;
  className?: string;
}) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Icon
      className={cn(
        "w-5 h-5",
        config.color,
        status === "running" && "animate-spin",
        className
      )}
    />
  );
}

function ProgressBar({
  current,
  total,
  className,
}: {
  current: number;
  total: number;
  className?: string;
}) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground font-mono w-12 text-right">
        {percent}%
      </span>
    </div>
  );
}

function TimeEstimate({ seconds }: { seconds: number }) {
  if (seconds < 60) {
    return <span>{seconds}s</span>;
  }
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return (
    <span>
      {minutes}m {secs}s
    </span>
  );
}

// =============================================================================
// Step Item Component
// =============================================================================

function StepItem({
  step,
  index,
  status,
  isCurrentStep,
  onExecute,
  onRetry,
  isExecuting,
  compact,
}: StepItemProps) {
  const [isOpen, setIsOpen] = useState(isCurrentStep);
  const config = STATUS_CONFIG[status];
  const ToolIcon = step.tool ? TOOL_ICONS[step.tool] : null;

  // Auto-expand current step
  useEffect(() => {
    if (isCurrentStep) {
      setIsOpen(true);
    }
  }, [isCurrentStep]);

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors",
                isCurrentStep && config.bgColor
              )}
            >
              <StepIcon status={status} className="w-4 h-4" />
              <span className="text-sm truncate flex-1">{step.description}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">{step.description}</p>
              {step.tool && (
                <p className="text-xs text-muted-foreground">Tool: {step.tool}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Status: {config.label}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          "border rounded-lg transition-colors",
          isCurrentStep && "border-primary/50",
          status === "failed" && "border-red-500/50"
        )}
      >
        {/* Step Header */}
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2 text-left transition-colors",
              "hover:bg-muted/50 rounded-t-lg",
              isOpen && "border-b"
            )}
          >
            {/* Expand/Collapse Icon */}
            {isOpen ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}

            {/* Step Number */}
            <span
              className={cn(
                "flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium",
                config.bgColor,
                config.color
              )}
            >
              {index + 1}
            </span>

            {/* Status Icon */}
            <StepIcon status={status} />

            {/* Description */}
            <span className="flex-1 text-sm font-medium truncate">
              {step.description}
            </span>

            {/* Tool Badge */}
            {ToolIcon && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <ToolIcon className="w-3 h-3" />
                {step.tool}
              </span>
            )}

            {/* Time Estimate */}
            {step.estimatedTime && status === "pending" && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <TimeEstimate seconds={step.estimatedTime} />
              </span>
            )}
          </button>
        </CollapsibleTrigger>

        {/* Step Details */}
        <CollapsibleContent>
          <div className="px-3 py-2 space-y-3">
            {/* Parameters */}
            {step.params && Object.keys(step.params).length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1">
                  Parameters
                </h4>
                <div className="bg-muted rounded p-2 text-xs font-mono overflow-x-auto">
                  <pre>{JSON.stringify(step.params, null, 2)}</pre>
                </div>
              </div>
            )}

            {/* Dependencies */}
            {step.dependencies && step.dependencies.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1">
                  Depends on
                </h4>
                <div className="flex flex-wrap gap-1">
                  {step.dependencies.map((dep) => (
                    <span
                      key={dep}
                      className="px-2 py-0.5 bg-muted rounded text-xs"
                    >
                      Step {dep}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t">
              {status === "pending" && onExecute && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onExecute}
                  disabled={isExecuting}
                  className="h-7 text-xs"
                >
                  <Play className="w-3 h-3 mr-1" />
                  Execute
                </Button>
              )}
              {status === "failed" && onRetry && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRetry}
                  disabled={isExecuting}
                  className="h-7 text-xs text-red-500 hover:text-red-600"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {config.label}
              </span>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * PlanViewer - Displays implementation plan steps with status indicators
 *
 * Feature #10: Chat Mode System - Plan viewer
 *
 * @example
 * ```tsx
 * <PlanViewer
 *   plan={implementationPlan}
 *   progress={executionProgress}
 *   onExecuteStep={(stepId) => executor.executeStep(stepId)}
 *   onRetryStep={(stepId) => executor.retryStep(stepId)}
 *   isExecuting={isRunning}
 * />
 * ```
 */
export function PlanViewer({
  plan,
  progress,
  onExecuteStep,
  onRetryStep,
  isExecuting = false,
  compact = false,
  className,
}: PlanViewerProps) {
  // Build step status map from progress
  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
      if (!progress) return "pending";
      const stepProgress = progress.steps.find((s) => s.stepId === stepId);
      return stepProgress?.status ?? "pending";
    },
    [progress]
  );

  // Calculate overall progress
  const completedCount = progress?.steps.filter(
    (s) => s.status === "completed"
  ).length ?? 0;
  const failedCount = progress?.steps.filter(
    (s) => s.status === "failed"
  ).length ?? 0;
  const totalSteps = plan.steps.length;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{plan.title || "Implementation Plan"}</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{completedCount}/{totalSteps} completed</span>
            {failedCount > 0 && (
              <span className="text-red-500">{failedCount} failed</span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <ProgressBar current={completedCount} total={totalSteps} />

        {/* Summary */}
        {plan.summary && !compact && (
          <p className="text-sm text-muted-foreground">{plan.summary}</p>
        )}
      </div>

      {/* Steps List */}
      <div className={cn("space-y-2", compact && "space-y-1")}>
        {plan.steps.map((step, index) => {
          const status = getStepStatus(step.id);
          const isCurrentStep = progress?.currentStepId === step.id;

          return (
            <StepItem
              key={step.id}
              step={step}
              index={index}
              status={status}
              isCurrentStep={isCurrentStep}
              onExecute={onExecuteStep ? () => onExecuteStep(step.id) : undefined}
              onRetry={onRetryStep ? () => onRetryStep(step.id) : undefined}
              isExecuting={isExecuting}
              compact={compact}
            />
          );
        })}
      </div>

      {/* Footer Stats */}
      {!compact && (
        <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-green-500" />
              {completedCount} done
            </span>
            {failedCount > 0 && (
              <span className="flex items-center gap-1">
                <XCircle className="w-3 h-3 text-red-500" />
                {failedCount} failed
              </span>
            )}
            <span className="flex items-center gap-1">
              <Circle className="w-3 h-3" />
              {totalSteps - completedCount - failedCount} pending
            </span>
          </div>
          {plan.estimatedTime && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Est. <TimeEstimate seconds={plan.estimatedTime} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default PlanViewer;
