"use client";

/**
 * StopExecutionButton Component
 *
 * A prominent button to halt running agent execution with rollback support.
 * Provides clear visual feedback during execution and stop process.
 *
 * Features:
 * - Visible during agent execution
 * - Animated pulsing indicator
 * - Confirmation dialog option
 * - Rollback to previous state
 * - Keyboard shortcut support (Escape)
 * - Progress indication
 *
 * Feature #95: UI Enhancements - StopExecutionButton
 */

import * as React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import {
  StopCircle,
  Loader2,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Keyboard,
  Square,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

/** Execution status */
export type ExecutionStatus = "idle" | "running" | "stopping" | "stopped" | "rolling_back" | "rolled_back" | "error";

/** Rollback option */
export interface RollbackOption {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Description */
  description?: string;
  /** Timestamp */
  timestamp?: Date;
  /** Is this the recommended option */
  recommended?: boolean;
}

/** Stop result */
export interface StopResult {
  success: boolean;
  message?: string;
  canRollback: boolean;
  rollbackOptions?: RollbackOption[];
}

/** Rollback result */
export interface RollbackResult {
  success: boolean;
  message?: string;
  restoredTo?: string;
}

/** StopExecutionButton props */
export interface StopExecutionButtonProps {
  /** Current execution status */
  status: ExecutionStatus;
  /** Callback when stop is triggered */
  onStop: () => Promise<StopResult>;
  /** Callback when rollback is triggered */
  onRollback?: (optionId: string) => Promise<RollbackResult>;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Show confirmation dialog before stopping */
  requireConfirmation?: boolean;
  /** Enable keyboard shortcut (Escape) */
  enableKeyboardShortcut?: boolean;
  /** Current task name */
  taskName?: string;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Elapsed time in ms */
  elapsedTime?: number;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Position style */
  position?: "inline" | "floating" | "fixed";
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatElapsedTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

// =============================================================================
// Sub-Components
// =============================================================================

/** Confirmation dialog */
function ConfirmationDialog({
  onConfirm,
  onCancel,
  taskName,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  taskName?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Stop Execution?
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {taskName
                ? `This will stop "${taskName}" immediately. Any uncommitted changes may be lost.`
                : "This will stop the current execution immediately. Any uncommitted changes may be lost."}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Continue Running
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            Stop Execution
          </button>
        </div>
      </div>
    </div>
  );
}

/** Rollback options dialog */
function RollbackDialog({
  options,
  onRollback,
  onSkip,
  isRollingBack,
}: {
  options: RollbackOption[];
  onRollback: (optionId: string) => void;
  onSkip: () => void;
  isRollingBack: boolean;
}) {
  const [selectedOption, setSelectedOption] = useState<string | null>(
    options.find((o) => o.recommended)?.id || options[0]?.id || null
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <RotateCcw className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Rollback Changes?
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Execution was stopped. Would you like to rollback to a previous state?
            </p>
          </div>
        </div>

        {/* Rollback options */}
        <div className="mt-4 space-y-2">
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => setSelectedOption(option.id)}
              disabled={isRollingBack}
              className={`
                w-full p-3 rounded-lg border-2 text-left transition-colors
                ${
                  selectedOption === option.id
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                }
                ${isRollingBack ? "opacity-50 cursor-not-allowed" : ""}
              `}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {option.label}
                </span>
                {option.recommended && (
                  <span className="px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 rounded">
                    Recommended
                  </span>
                )}
              </div>
              {option.description && (
                <p className="mt-1 text-sm text-gray-500">{option.description}</p>
              )}
              {option.timestamp && (
                <p className="mt-1 text-xs text-gray-400">
                  {option.timestamp.toLocaleString()}
                </p>
              )}
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onSkip}
            disabled={isRollingBack}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
          >
            Skip Rollback
          </button>
          <button
            onClick={() => selectedOption && onRollback(selectedOption)}
            disabled={!selectedOption || isRollingBack}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isRollingBack ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Rolling back...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                Rollback
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Status result message */
function StatusMessage({
  status,
  message,
  onDismiss,
}: {
  status: "success" | "error";
  message: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={`
        flex items-center gap-3 p-4 rounded-lg
        ${
          status === "success"
            ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
            : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
        }
      `}
    >
      {status === "success" ? (
        <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
      ) : (
        <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
      )}
      <p
        className={`text-sm font-medium ${
          status === "success"
            ? "text-green-800 dark:text-green-200"
            : "text-red-800 dark:text-red-200"
        }`}
      >
        {message}
      </p>
      <button
        onClick={onDismiss}
        className="ml-auto p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        <XCircle className="w-4 h-4" />
      </button>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function StopExecutionButton({
  status,
  onStop,
  onRollback,
  onDismiss,
  requireConfirmation = true,
  enableKeyboardShortcut = true,
  taskName,
  progress,
  elapsedTime,
  size = "md",
  position = "inline",
  className = "",
}: StopExecutionButtonProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showRollback, setShowRollback] = useState(false);
  const [rollbackOptions, setRollbackOptions] = useState<RollbackOption[]>([]);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ status: "success" | "error"; message: string } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Keyboard shortcut handler
  useEffect(() => {
    if (!enableKeyboardShortcut || status !== "running") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (requireConfirmation) {
          setShowConfirmation(true);
        } else {
          handleStop();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enableKeyboardShortcut, status, requireConfirmation]);

  const handleStop = useCallback(async () => {
    setShowConfirmation(false);
    try {
      const result = await onStop();
      if (result.success) {
        if (result.canRollback && result.rollbackOptions && result.rollbackOptions.length > 0) {
          setRollbackOptions(result.rollbackOptions);
          setShowRollback(true);
        } else {
          setResultMessage({ status: "success", message: result.message || "Execution stopped successfully" });
        }
      } else {
        setResultMessage({ status: "error", message: result.message || "Failed to stop execution" });
      }
    } catch (err) {
      setResultMessage({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to stop execution",
      });
    }
  }, [onStop]);

  const handleRollback = useCallback(
    async (optionId: string) => {
      if (!onRollback) return;
      setIsRollingBack(true);
      try {
        const result = await onRollback(optionId);
        setShowRollback(false);
        if (result.success) {
          setResultMessage({
            status: "success",
            message: result.message || `Rolled back to ${result.restoredTo || "previous state"}`,
          });
        } else {
          setResultMessage({ status: "error", message: result.message || "Rollback failed" });
        }
      } catch (err) {
        setResultMessage({
          status: "error",
          message: err instanceof Error ? err.message : "Rollback failed",
        });
      } finally {
        setIsRollingBack(false);
      }
    },
    [onRollback]
  );

  const handleSkipRollback = useCallback(() => {
    setShowRollback(false);
    setResultMessage({ status: "success", message: "Execution stopped. Changes preserved." });
  }, []);

  const handleDismissResult = useCallback(() => {
    setResultMessage(null);
    onDismiss?.();
  }, [onDismiss]);

  // Size classes
  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-5 py-2.5 text-base gap-2.5",
  };

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  // Position classes
  const positionClasses = {
    inline: "",
    floating: "fixed bottom-6 right-6 z-40 shadow-lg",
    fixed: "fixed bottom-6 left-1/2 -translate-x-1/2 z-40 shadow-lg",
  };

  // Don't show if idle
  if (status === "idle") return null;

  // Show result message if available
  if (resultMessage) {
    return (
      <div className={`${positionClasses[position]} ${className}`}>
        <StatusMessage
          status={resultMessage.status}
          message={resultMessage.message}
          onDismiss={handleDismissResult}
        />
      </div>
    );
  }

  return (
    <>
      {/* Main button */}
      <div className={`${positionClasses[position]} ${className}`}>
        {status === "running" && (
          <button
            ref={buttonRef}
            onClick={() => (requireConfirmation ? setShowConfirmation(true) : handleStop())}
            className={`
              inline-flex items-center font-medium rounded-lg transition-all
              ${sizeClasses[size]}
              bg-red-600 hover:bg-red-700 text-white
              shadow-md hover:shadow-lg
              animate-pulse hover:animate-none
            `}
          >
            <StopCircle className={iconSizes[size]} />
            <span>Stop</span>
            {enableKeyboardShortcut && (
              <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-red-700/50 rounded">Esc</kbd>
            )}
          </button>
        )}

        {status === "stopping" && (
          <div
            className={`
              inline-flex items-center font-medium rounded-lg
              ${sizeClasses[size]}
              bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300
            `}
          >
            <Loader2 className={`${iconSizes[size]} animate-spin`} />
            <span>Stopping...</span>
          </div>
        )}

        {/* Progress info */}
        {status === "running" && (progress !== undefined || elapsedTime !== undefined) && (
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
            {taskName && <span className="truncate max-w-[200px]">{taskName}</span>}
            {progress !== undefined && <span>{Math.round(progress)}%</span>}
            {elapsedTime !== undefined && <span>{formatElapsedTime(elapsedTime)}</span>}
          </div>
        )}
      </div>

      {/* Confirmation dialog */}
      {showConfirmation && (
        <ConfirmationDialog
          onConfirm={handleStop}
          onCancel={() => setShowConfirmation(false)}
          taskName={taskName}
        />
      )}

      {/* Rollback dialog */}
      {showRollback && rollbackOptions.length > 0 && (
        <RollbackDialog
          options={rollbackOptions}
          onRollback={handleRollback}
          onSkip={handleSkipRollback}
          isRollingBack={isRollingBack}
        />
      )}
    </>
  );
}

export default StopExecutionButton;
