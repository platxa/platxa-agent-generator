"use client";

/**
 * TryToFixButton Component
 *
 * A button that appears on errors and triggers AI-powered auto-fix.
 * Provides visual feedback during fix attempts and shows results.
 *
 * Features:
 * - Animated appearance on errors
 * - Loading state during fix attempt
 * - Success/failure feedback
 * - Retry capability
 * - Expandable error details
 *
 * Feature #88: UI Enhancements - TryToFixButton
 */

import * as React from "react";
import { useState, useCallback, useEffect } from "react";
import {
  Wand2,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  Copy,
  Check,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

/** Fix attempt status */
export type FixStatus = "idle" | "fixing" | "success" | "failed" | "partial";

/** Error context for fix attempt */
export interface ErrorContext {
  /** Error message */
  message: string;
  /** Error type/name */
  type?: string;
  /** Stack trace */
  stack?: string;
  /** Source file */
  file?: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Code snippet around error */
  codeSnippet?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/** Fix result */
export interface FixResult {
  success: boolean;
  message: string;
  changes?: Array<{
    file: string;
    description: string;
    diff?: string;
  }>;
  suggestions?: string[];
  partialFix?: boolean;
}

/** TryToFixButton props */
export interface TryToFixButtonProps {
  /** Error context to fix */
  error: ErrorContext;
  /** Callback when fix is triggered */
  onFix: (error: ErrorContext) => Promise<FixResult>;
  /** Callback when fix succeeds */
  onFixSuccess?: (result: FixResult) => void;
  /** Callback when fix fails */
  onFixFailed?: (result: FixResult) => void;
  /** Show error details */
  showDetails?: boolean;
  /** Auto-show on mount */
  autoShow?: boolean;
  /** Custom button text */
  buttonText?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Disable the button */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatErrorLocation(error: ErrorContext): string | null {
  if (!error.file) return null;
  let location = error.file;
  if (error.line) {
    location += `:${error.line}`;
    if (error.column) {
      location += `:${error.column}`;
    }
  }
  return location;
}

// =============================================================================
// Sub-Components
// =============================================================================

/** Copy button for code snippets */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

/** Error details panel */
function ErrorDetails({ error }: { error: ErrorContext }) {
  const location = formatErrorLocation(error);

  return (
    <div className="mt-3 space-y-3">
      {/* Error type and location */}
      <div className="flex flex-wrap gap-2 text-xs">
        {error.type && (
          <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
            {error.type}
          </span>
        )}
        {location && (
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded font-mono">
            {location}
          </span>
        )}
      </div>

      {/* Code snippet */}
      {error.codeSnippet && (
        <div className="relative">
          <div className="absolute top-2 right-2">
            <CopyButton text={error.codeSnippet} />
          </div>
          <pre className="p-3 bg-gray-900 dark:bg-gray-950 text-gray-100 rounded-lg text-xs overflow-x-auto">
            <code>{error.codeSnippet}</code>
          </pre>
        </div>
      )}

      {/* Stack trace (collapsible) */}
      {error.stack && (
        <details className="group">
          <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            Show stack trace
          </summary>
          <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs overflow-x-auto text-gray-600 dark:text-gray-400">
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  );
}

/** Fix result panel */
function FixResultPanel({ result, status }: { result: FixResult; status: FixStatus }) {
  return (
    <div className={`mt-3 p-3 rounded-lg ${
      status === "success"
        ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
        : status === "partial"
        ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
        : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
    }`}>
      <div className="flex items-start gap-2">
        {status === "success" ? (
          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
        ) : status === "partial" ? (
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
        ) : (
          <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${
            status === "success"
              ? "text-green-800 dark:text-green-200"
              : status === "partial"
              ? "text-amber-800 dark:text-amber-200"
              : "text-red-800 dark:text-red-200"
          }`}>
            {result.message}
          </p>

          {/* Changes made */}
          {result.changes && result.changes.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-gray-600 dark:text-gray-400">Changes made:</p>
              {result.changes.map((change, idx) => (
                <div key={idx} className="text-xs text-gray-700 dark:text-gray-300 pl-2 border-l-2 border-gray-300 dark:border-gray-600">
                  <span className="font-mono">{change.file}</span>: {change.description}
                </div>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {result.suggestions && result.suggestions.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Suggestions:</p>
              <ul className="text-xs text-gray-700 dark:text-gray-300 list-disc list-inside space-y-0.5">
                {result.suggestions.map((suggestion, idx) => (
                  <li key={idx}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function TryToFixButton({
  error,
  onFix,
  onFixSuccess,
  onFixFailed,
  showDetails = true,
  autoShow = true,
  buttonText = "Try to Fix",
  size = "md",
  disabled = false,
  className = "",
}: TryToFixButtonProps) {
  const [status, setStatus] = useState<FixStatus>("idle");
  const [result, setResult] = useState<FixResult | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(autoShow);
  const [retryCount, setRetryCount] = useState(0);

  // Animate in on mount
  useEffect(() => {
    if (autoShow) {
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    }
  }, [autoShow]);

  const handleFix = useCallback(async () => {
    setStatus("fixing");
    setResult(null);

    try {
      const fixResult = await onFix(error);
      setResult(fixResult);

      if (fixResult.success) {
        setStatus(fixResult.partialFix ? "partial" : "success");
        onFixSuccess?.(fixResult);
      } else {
        setStatus("failed");
        onFixFailed?.(fixResult);
      }
    } catch (err) {
      const failResult: FixResult = {
        success: false,
        message: err instanceof Error ? err.message : "Fix attempt failed unexpectedly",
      };
      setResult(failResult);
      setStatus("failed");
      onFixFailed?.(failResult);
    }
  }, [error, onFix, onFixSuccess, onFixFailed]);

  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    handleFix();
  }, [handleFix]);

  // Size classes
  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-5 py-2.5 text-base gap-2",
  };

  const iconSizes = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  if (!isVisible) return null;

  return (
    <div
      className={`
        transform transition-all duration-300 ease-out
        ${isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}
        ${className}
      `}
    >
      {/* Error message display */}
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="p-1.5 bg-red-100 dark:bg-red-900/40 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-medium text-red-800 dark:text-red-200">
              {error.message}
            </p>

            {/* Show details toggle */}
            {showDetails && (error.stack || error.codeSnippet || error.file) && (
              <button
                onClick={() => setDetailsExpanded(!detailsExpanded)}
                className="mt-2 inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
              >
                {detailsExpanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    Hide details
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    Show details
                  </>
                )}
              </button>
            )}

            {/* Expanded error details */}
            {showDetails && detailsExpanded && <ErrorDetails error={error} />}

            {/* Fix result */}
            {result && <FixResultPanel result={result} status={status} />}
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex items-center gap-3">
          {status === "idle" || status === "failed" ? (
            <button
              onClick={status === "failed" ? handleRetry : handleFix}
              disabled={disabled || status === "fixing"}
              className={`
                inline-flex items-center font-medium rounded-lg transition-all
                ${sizeClasses[size]}
                ${disabled
                  ? "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-md hover:shadow-lg"
                }
              `}
            >
              {status === "failed" ? (
                <>
                  <RefreshCw className={iconSizes[size]} />
                  Retry Fix
                  {retryCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-xs">
                      #{retryCount + 1}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <Wand2 className={iconSizes[size]} />
                  {buttonText}
                  <Sparkles className={`${iconSizes[size]} opacity-70`} />
                </>
              )}
            </button>
          ) : status === "fixing" ? (
            <button
              disabled
              className={`
                inline-flex items-center font-medium rounded-lg
                ${sizeClasses[size]}
                bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400
              `}
            >
              <Loader2 className={`${iconSizes[size]} animate-spin`} />
              Analyzing and fixing...
            </button>
          ) : status === "success" ? (
            <div className={`inline-flex items-center ${sizeClasses[size]} text-green-600 dark:text-green-400 font-medium`}>
              <CheckCircle2 className={iconSizes[size]} />
              Fixed successfully!
            </div>
          ) : status === "partial" ? (
            <div className="flex items-center gap-3">
              <div className={`inline-flex items-center ${sizeClasses[size]} text-amber-600 dark:text-amber-400 font-medium`}>
                <AlertTriangle className={iconSizes[size]} />
                Partially fixed
              </div>
              <button
                onClick={handleRetry}
                className={`
                  inline-flex items-center font-medium rounded-lg transition-colors
                  ${sizeClasses[size]}
                  bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300
                  hover:bg-amber-200 dark:hover:bg-amber-900/50
                `}
              >
                <RefreshCw className={iconSizes[size]} />
                Try Again
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default TryToFixButton;
