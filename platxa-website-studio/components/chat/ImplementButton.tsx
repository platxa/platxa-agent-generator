"use client";

import { useState, useCallback } from "react";
import {
  Play,
  AlertTriangle,
  FileCode2,
  Layers,
  Clock,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import type { ImplementationPlan } from "@/lib/agent-bridge/chat-mode";

// =============================================================================
// Types
// =============================================================================

interface ImplementButtonProps {
  /** The implementation plan to execute */
  plan: ImplementationPlan;
  /** Called when execution is confirmed */
  onExecute: (plan: ImplementationPlan) => void | Promise<void>;
  /** Called when execution is cancelled */
  onCancel?: () => void;
  /** Whether execution is currently in progress */
  isExecuting?: boolean;
  /** Whether to skip confirmation dialog */
  skipConfirmation?: boolean;
  /** Custom button text */
  buttonText?: string;
  /** Button variant */
  variant?: "default" | "secondary" | "outline";
  /** Button size */
  size?: "default" | "sm" | "lg";
  /** Additional class name */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
}

// =============================================================================
// Helpers
// =============================================================================

const COMPLEXITY_CONFIG = {
  simple: {
    color: "text-emerald-600",
    bg: "bg-emerald-500/10",
    label: "Simple",
    description: "Quick changes with minimal risk",
  },
  moderate: {
    color: "text-amber-600",
    bg: "bg-amber-500/10",
    label: "Moderate",
    description: "Multiple steps with some complexity",
  },
  complex: {
    color: "text-red-600",
    bg: "bg-red-500/10",
    label: "Complex",
    description: "Significant changes across multiple files",
  },
};

function formatStepCount(count: number): string {
  return count === 1 ? "1 step" : `${count} steps`;
}

function formatFileCount(count: number): string {
  return count === 1 ? "1 file" : `${count} files`;
}

function estimateDuration(plan: ImplementationPlan): string {
  // Rough estimation: simple=30s, moderate=2m, complex=5m+ per step
  const baseSeconds = {
    simple: 5,
    moderate: 15,
    complex: 30,
  };
  const totalSeconds = plan.steps.length * baseSeconds[plan.estimatedComplexity];
  if (totalSeconds < 60) return `~${totalSeconds}s`;
  const minutes = Math.ceil(totalSeconds / 60);
  return `~${minutes}m`;
}

// =============================================================================
// Subcomponents
// =============================================================================

interface PlanSummaryProps {
  plan: ImplementationPlan;
  compact?: boolean;
}

function PlanSummary({ plan, compact = false }: PlanSummaryProps) {
  const complexityConfig = COMPLEXITY_CONFIG[plan.estimatedComplexity];

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {/* Title and description */}
      {!compact && (
        <div className="space-y-1">
          <h4 className="font-medium text-sm">{plan.title}</h4>
          {plan.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {plan.description}
            </p>
          )}
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-3 text-xs">
        {/* Step count */}
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-muted-foreground" />
          <span>{formatStepCount(plan.steps.length)}</span>
        </div>

        {/* File count */}
        <div className="flex items-center gap-1.5">
          <FileCode2 className="w-3.5 h-3.5 text-muted-foreground" />
          <span>{formatFileCount(plan.affectedFiles.length)}</span>
        </div>

        {/* Duration estimate */}
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span>{estimateDuration(plan)}</span>
        </div>

        {/* Complexity badge */}
        <span
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
            complexityConfig.bg,
            complexityConfig.color
          )}
        >
          {complexityConfig.label}
        </span>
      </div>
    </div>
  );
}

interface ConfirmationContentProps {
  plan: ImplementationPlan;
}

function ConfirmationContent({ plan }: ConfirmationContentProps) {
  const complexityConfig = COMPLEXITY_CONFIG[plan.estimatedComplexity];
  const isRisky = plan.estimatedComplexity === "complex";

  return (
    <div className="space-y-4">
      {/* Plan summary */}
      <PlanSummary plan={plan} />

      {/* Steps preview */}
      <div className="space-y-2">
        <h5 className="text-xs font-medium text-muted-foreground">
          Execution Steps
        </h5>
        <div className="max-h-40 overflow-y-auto space-y-1">
          {plan.steps.map((step, index) => (
            <div
              key={step.id}
              className="flex items-start gap-2 text-xs p-2 rounded bg-muted/50"
            >
              <span className="font-mono text-muted-foreground w-5 flex-shrink-0">
                {index + 1}.
              </span>
              <span className="flex-1">{step.description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Affected files */}
      {plan.affectedFiles.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-muted-foreground">
            Files to be Modified
          </h5>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {plan.affectedFiles.slice(0, 10).map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-muted/50"
              >
                <FileCode2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="font-mono truncate" title={file}>
                  {file}
                </span>
              </div>
            ))}
            {plan.affectedFiles.length > 10 && (
              <p className="text-xs text-muted-foreground px-2">
                +{plan.affectedFiles.length - 10} more files
              </p>
            )}
          </div>
        </div>
      )}

      {/* Risk warning for complex plans */}
      {isRisky && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-medium text-red-600">
              This is a complex operation
            </p>
            <p className="text-muted-foreground mt-0.5">
              {complexityConfig.description}. Make sure you have reviewed the
              steps above before proceeding.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * ImplementButton - Shows plan summary and triggers execution with confirmation
 *
 * Feature #5: Chat Mode System - Implementation trigger
 *
 * @example
 * ```tsx
 * <ImplementButton
 *   plan={implementationPlan}
 *   onExecute={(plan) => executor.execute(plan)}
 *   isExecuting={executor.isRunning()}
 * />
 * ```
 */
export function ImplementButton({
  plan,
  onExecute,
  onCancel,
  isExecuting = false,
  skipConfirmation = false,
  buttonText,
  variant = "default",
  size = "default",
  className,
  disabled = false,
}: ImplementButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleExecute = useCallback(async () => {
    if (skipConfirmation || !plan.requiresConfirmation) {
      setIsConfirming(true);
      try {
        await onExecute(plan);
      } finally {
        setIsConfirming(false);
      }
      return;
    }
    setIsOpen(true);
  }, [plan, onExecute, skipConfirmation]);

  const handleConfirm = useCallback(async () => {
    setIsConfirming(true);
    try {
      await onExecute(plan);
      setIsOpen(false);
    } finally {
      setIsConfirming(false);
    }
  }, [plan, onExecute]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    onCancel?.();
  }, [onCancel]);

  const isLoading = isExecuting || isConfirming;
  const complexityConfig = COMPLEXITY_CONFIG[plan.estimatedComplexity];

  // Button content
  const buttonContent = (
    <>
      {isLoading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Play className="w-4 h-4 mr-2" />
      )}
      {buttonText || (isLoading ? "Implementing..." : "Implement")}
    </>
  );

  // If no confirmation needed, just render the button
  if (skipConfirmation || !plan.requiresConfirmation) {
    return (
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleExecute}
        disabled={disabled || isLoading}
      >
        {buttonContent}
      </Button>
    );
  }

  // Render button with dialog
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          disabled={disabled || isLoading}
        >
          {buttonContent}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Implement Changes
          </DialogTitle>
          <DialogDescription>
            Review the plan below before starting implementation.
          </DialogDescription>
        </DialogHeader>

        <ConfirmationContent plan={plan} />

        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleConfirm}
            disabled={isConfirming}
            className={cn(
              plan.estimatedComplexity === "complex" &&
                "bg-red-600 hover:bg-red-700"
            )}
          >
            {isConfirming ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Confirm & Implement
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ImplementButton;
