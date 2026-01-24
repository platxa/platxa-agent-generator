"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { AlertCircle, RefreshCw, Code, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface PreviewError {
  message: string;
  source?: string;
  line?: number;
  column?: number;
  stack?: string;
}

interface PreviewErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: PreviewError) => void;
  onRetry?: () => void;
  className?: string;
}

/**
 * Preview Error Boundary Component
 *
 * Catches and displays errors from the preview iframe gracefully.
 * Provides recovery options and error details for debugging.
 */
export function PreviewErrorBoundary({
  children,
  onError,
  onRetry,
  className,
}: PreviewErrorBoundaryProps) {
  const [error, setError] = useState<PreviewError | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Handle global errors from preview iframe
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // Only catch errors from preview iframe (blob URLs or same-origin)
      if (
        event.filename?.includes("blob:") ||
        event.filename?.includes("preview") ||
        event.message?.includes("preview")
      ) {
        const previewError: PreviewError = {
          message: event.message || "Unknown error",
          source: event.filename,
          line: event.lineno,
          column: event.colno,
          stack: event.error?.stack,
        };

        setError(previewError);
        onError?.(previewError);
        event.preventDefault();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Check if rejection is from preview context
      const reason = event.reason;
      if (reason?.message?.includes("preview") || reason?.stack?.includes("blob:")) {
        const previewError: PreviewError = {
          message: reason?.message || "Unhandled promise rejection",
          stack: reason?.stack,
        };

        setError(previewError);
        onError?.(previewError);
        event.preventDefault();
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [onError]);

  // Dismiss error
  const dismissError = useCallback(() => {
    setError(null);
    setShowDetails(false);
  }, []);

  // Retry handler
  const handleRetry = useCallback(() => {
    setError(null);
    setShowDetails(false);
    onRetry?.();
  }, [onRetry]);

  if (error) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center h-full p-6 bg-red-50 dark:bg-red-950/20",
          className
        )}
      >
        <div className="max-w-md w-full space-y-4">
          {/* Error icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </div>

          {/* Error message */}
          <div className="text-center space-y-2">
            <h3 className="font-semibold text-lg text-red-900 dark:text-red-100">
              Preview Error
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300">
              {error.message}
            </p>
          </div>

          {/* Error location */}
          {(error.source || error.line) && (
            <div className="flex items-center justify-center gap-2 text-xs text-red-600 dark:text-red-400">
              <Code className="w-3 h-3" />
              <span className="font-mono">
                {error.source?.split("/").pop() || "preview"}
                {error.line && `:${error.line}`}
                {error.column && `:${error.column}`}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={dismissError}
              className="border-red-300 text-red-700 hover:bg-red-100"
            >
              Dismiss
            </Button>
            {onRetry && (
              <Button
                size="sm"
                onClick={handleRetry}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            )}
          </div>

          {/* Toggle details */}
          {error.stack && (
            <div className="pt-2">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-1 mx-auto text-xs text-red-600 hover:text-red-800 dark:text-red-400"
              >
                <Bug className="w-3 h-3" />
                {showDetails ? "Hide" : "Show"} details
              </button>

              {showDetails && (
                <pre className="mt-3 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg text-xs font-mono text-red-800 dark:text-red-200 overflow-auto max-h-40">
                  {error.stack}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Hook to manually trigger preview errors
 */
export function usePreviewError() {
  const [error, setError] = useState<PreviewError | null>(null);

  const triggerError = useCallback((error: PreviewError) => {
    setError(error);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { error, triggerError, clearError };
}
