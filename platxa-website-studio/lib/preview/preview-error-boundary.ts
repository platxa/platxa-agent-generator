/**
 * PreviewErrorBoundary — Error boundary logic for preview failures.
 *
 * Feature #94: Implement error boundary for preview failures with fallback UI
 * Verification: Preview errors show friendly message with retry button
 *
 * Provides error capture, categorization, and recovery logic for preview
 * failures. Works with both iframe-based previews and direct rendering.
 *
 * @module lib/preview/preview-error-boundary
 */

// =============================================================================
// Types
// =============================================================================

/** Error severity levels */
export type ErrorSeverity = "info" | "warning" | "error" | "fatal";

/** Error category */
export type ErrorCategory =
  | "render"
  | "script"
  | "network"
  | "timeout"
  | "syntax"
  | "runtime"
  | "resource"
  | "unknown";

/** Preview error information */
export interface PreviewError {
  /** Unique error ID */
  id: string;
  /** Error message */
  message: string;
  /** Error category */
  category: ErrorCategory;
  /** Error severity */
  severity: ErrorSeverity;
  /** Source file (if available) */
  source?: string;
  /** Line number (if available) */
  line?: number;
  /** Column number (if available) */
  column?: number;
  /** Stack trace (if available) */
  stack?: string;
  /** Timestamp */
  timestamp: number;
  /** Whether error is recoverable */
  recoverable: boolean;
  /** Suggested action */
  suggestedAction?: string;
  /** Original error object */
  originalError?: Error | unknown;
}

/** Error boundary state */
export interface ErrorBoundaryState {
  /** Whether there's an active error */
  hasError: boolean;
  /** Current error (if any) */
  error: PreviewError | null;
  /** Error history */
  errorHistory: PreviewError[];
  /** Retry count for current error */
  retryCount: number;
  /** Maximum retries allowed */
  maxRetries: number;
  /** Whether recovery is in progress */
  recovering: boolean;
}

/** Error boundary options */
export interface ErrorBoundaryOptions {
  /** Maximum errors to keep in history (default: 10) */
  maxHistory?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Auto-retry on recoverable errors (default: false) */
  autoRetry?: boolean;
  /** Auto-retry delay in ms (default: 1000) */
  autoRetryDelay?: number;
  /** Error filter - return false to ignore error */
  errorFilter?: (error: PreviewError) => boolean;
}

/** Fallback UI configuration */
export interface FallbackUIConfig {
  /** Title text */
  title: string;
  /** Description text */
  description: string;
  /** Whether to show retry button */
  showRetry: boolean;
  /** Whether to show dismiss button */
  showDismiss: boolean;
  /** Whether to show error details */
  showDetails: boolean;
  /** Icon name/type */
  icon: "error" | "warning" | "info";
  /** CSS class for styling */
  className?: string;
}

/** Callback for error events */
export type ErrorCallback = (error: PreviewError) => void;

/** Callback for recovery events */
export type RecoveryCallback = (success: boolean, error?: PreviewError) => void;

/** Callback for state changes */
export type StateChangeCallback = (state: ErrorBoundaryState) => void;

// =============================================================================
// Constants
// =============================================================================

/** Default options */
const DEFAULT_OPTIONS: Required<Omit<ErrorBoundaryOptions, "errorFilter">> = {
  maxHistory: 10,
  maxRetries: 3,
  autoRetry: false,
  autoRetryDelay: 1000,
};

/** Error messages by category */
export const ERROR_MESSAGES: Record<ErrorCategory, string> = {
  render: "Failed to render preview",
  script: "Script error in preview",
  network: "Failed to load resources",
  timeout: "Preview timed out",
  syntax: "Syntax error in template",
  runtime: "Runtime error occurred",
  resource: "Resource not found",
  unknown: "An unexpected error occurred",
};

/** Suggested actions by category */
export const SUGGESTED_ACTIONS: Record<ErrorCategory, string> = {
  render: "Check your template syntax and try again",
  script: "Review your JavaScript code for errors",
  network: "Check your network connection",
  timeout: "Try simplifying your content or increasing timeout",
  syntax: "Fix the syntax error in your template",
  runtime: "Check the error details and fix the issue",
  resource: "Verify the resource path is correct",
  unknown: "Try refreshing or contact support if the issue persists",
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generates a unique error ID.
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Categorizes an error based on its message and properties.
 */
export function categorizeError(
  error: Error | string | unknown
): ErrorCategory {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : String(error);

  const messageLower = message.toLowerCase();

  // Network errors
  if (
    messageLower.includes("network") ||
    messageLower.includes("fetch") ||
    messageLower.includes("load failed") ||
    messageLower.includes("cors")
  ) {
    return "network";
  }

  // Timeout errors
  if (messageLower.includes("timeout") || messageLower.includes("timed out")) {
    return "timeout";
  }

  // Syntax errors
  if (
    messageLower.includes("syntax") ||
    messageLower.includes("unexpected token") ||
    messageLower.includes("parsing")
  ) {
    return "syntax";
  }

  // Script errors
  if (
    messageLower.includes("script") ||
    messageLower.includes("undefined is not") ||
    messageLower.includes("is not a function") ||
    messageLower.includes("cannot read property")
  ) {
    return "script";
  }

  // Resource errors
  if (
    messageLower.includes("not found") ||
    messageLower.includes("404") ||
    messageLower.includes("resource")
  ) {
    return "resource";
  }

  // Render errors
  if (
    messageLower.includes("render") ||
    messageLower.includes("mount") ||
    messageLower.includes("hydrat")
  ) {
    return "render";
  }

  // Runtime errors (catch-all for Error instances)
  if (error instanceof Error) {
    return "runtime";
  }

  return "unknown";
}

/**
 * Determines error severity based on category and error properties.
 */
export function determineSeverity(
  category: ErrorCategory,
  error?: Error | unknown
): ErrorSeverity {
  switch (category) {
    case "fatal":
      return "fatal";
    case "syntax":
    case "render":
      return "error";
    case "network":
    case "timeout":
    case "resource":
      return "warning";
    case "script":
    case "runtime":
      return "error";
    default:
      return "warning";
  }
}

/**
 * Determines if an error is recoverable.
 */
export function isRecoverable(category: ErrorCategory): boolean {
  switch (category) {
    case "network":
    case "timeout":
    case "resource":
      return true;
    case "syntax":
    case "render":
    case "script":
    case "runtime":
      return false;
    default:
      return true;
  }
}

/**
 * Creates a PreviewError from various error types.
 */
export function createPreviewError(
  error: Error | ErrorEvent | string | unknown,
  overrides?: Partial<PreviewError>
): PreviewError {
  let message: string;
  let source: string | undefined;
  let line: number | undefined;
  let column: number | undefined;
  let stack: string | undefined;
  let originalError: Error | unknown = error;

  if (error instanceof ErrorEvent) {
    message = error.message || "Unknown error";
    source = error.filename;
    line = error.lineno;
    column = error.colno;
    stack = error.error?.stack;
    originalError = error.error;
  } else if (error instanceof Error) {
    message = error.message;
    stack = error.stack;

    // Try to extract location from stack using multiple patterns
    // Pattern 1: Chrome/Node format - "at functionName (file:line:col)"
    // Pattern 2: Chrome/Node format - "at file:line:col"
    // Pattern 3: Firefox format - "functionName@file:line:col"
    const patterns = [
      /at\s+(?:.*?\s+)?\(([^)]+):(\d+):(\d+)\)/, // at func (file:line:col)
      /at\s+([^\s]+):(\d+):(\d+)/, // at file:line:col
      /@([^\s]+):(\d+):(\d+)/, // func@file:line:col (Firefox)
    ];

    for (const pattern of patterns) {
      const stackMatch = stack?.match(pattern);
      if (stackMatch) {
        source = stackMatch[1];
        line = parseInt(stackMatch[2], 10);
        column = parseInt(stackMatch[3], 10);
        break;
      }
    }
  } else if (typeof error === "string") {
    message = error;
  } else {
    message = String(error);
  }

  const category = overrides?.category ?? categorizeError(error);
  const severity = overrides?.severity ?? determineSeverity(category, error);
  const recoverable = overrides?.recoverable ?? isRecoverable(category);

  return {
    id: generateErrorId(),
    message,
    category,
    severity,
    source,
    line,
    column,
    stack,
    timestamp: Date.now(),
    recoverable,
    suggestedAction: SUGGESTED_ACTIONS[category],
    originalError,
    ...overrides,
  };
}

/**
 * Generates fallback UI configuration based on error.
 */
export function getFallbackUIConfig(error: PreviewError): FallbackUIConfig {
  return {
    title: ERROR_MESSAGES[error.category],
    description: error.message,
    showRetry: error.recoverable,
    showDismiss: true,
    showDetails: !!error.stack,
    icon: error.severity === "warning" ? "warning" : "error",
    className: `preview-error-${error.severity}`,
  };
}

/**
 * Formats error for display.
 */
export function formatErrorMessage(error: PreviewError): string {
  let formatted = error.message;

  if (error.source) {
    const filename = error.source.split("/").pop() || error.source;
    formatted += ` (${filename}`;
    if (error.line) {
      formatted += `:${error.line}`;
      if (error.column) {
        formatted += `:${error.column}`;
      }
    }
    formatted += ")";
  }

  return formatted;
}

/**
 * Formats error for logging.
 */
export function formatErrorForLog(error: PreviewError): string {
  const parts = [
    `[${error.severity.toUpperCase()}]`,
    `[${error.category}]`,
    error.message,
  ];

  if (error.source) {
    parts.push(`at ${error.source}:${error.line || "?"}:${error.column || "?"}`);
  }

  return parts.join(" ");
}

// =============================================================================
// PreviewErrorBoundary Class
// =============================================================================

/**
 * PreviewErrorBoundary — Manages error state for preview.
 *
 * Provides error capture, categorization, history tracking, and recovery
 * logic for preview failures.
 *
 * @example
 * ```typescript
 * const boundary = new PreviewErrorBoundary({
 *   maxRetries: 3,
 *   autoRetry: false,
 * });
 *
 * // Listen for errors
 * boundary.onError((error) => {
 *   console.log(`Error: ${error.message}`);
 * });
 *
 * // Capture an error
 * boundary.captureError(new Error("Something went wrong"));
 *
 * // Get fallback UI config
 * const ui = boundary.getFallbackUI();
 *
 * // Retry
 * await boundary.retry(() => reloadPreview());
 *
 * // Dismiss
 * boundary.dismiss();
 * ```
 */
export class PreviewErrorBoundary {
  private state: ErrorBoundaryState;
  private options: Required<Omit<ErrorBoundaryOptions, "errorFilter">>;
  private errorFilter?: (error: PreviewError) => boolean;
  private errorCallbacks = new Set<ErrorCallback>();
  private recoveryCallbacks = new Set<RecoveryCallback>();
  private stateCallbacks = new Set<StateChangeCallback>();
  private disposed = false;
  private autoRetryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: ErrorBoundaryOptions = {}) {
    const { errorFilter, ...rest } = options;
    this.options = { ...DEFAULT_OPTIONS, ...rest };
    this.errorFilter = errorFilter;

    this.state = {
      hasError: false,
      error: null,
      errorHistory: [],
      retryCount: 0,
      maxRetries: this.options.maxRetries,
      recovering: false,
    };
  }

  // ---------------------------------------------------------------------------
  // Error Capture
  // ---------------------------------------------------------------------------

  /**
   * Captures an error.
   */
  captureError(
    error: Error | ErrorEvent | string | unknown,
    overrides?: Partial<PreviewError>
  ): PreviewError | null {
    if (this.disposed) return null;

    const previewError = createPreviewError(error, overrides);

    // Apply filter
    if (this.errorFilter && !this.errorFilter(previewError)) {
      return null;
    }

    // Preserve retry count if we're in recovery mode (failed retry attempt)
    // This ensures retry count accumulates across failed attempts
    const preserveRetryCount = this.state.recovering;
    const currentRetryCount = this.state.retryCount;

    // Update state
    this.state.hasError = true;
    this.state.error = previewError;
    this.state.retryCount = preserveRetryCount ? currentRetryCount : 0;
    this.state.recovering = false;

    // Add to history
    this.state.errorHistory.unshift(previewError);
    if (this.state.errorHistory.length > this.options.maxHistory) {
      this.state.errorHistory.pop();
    }

    // Notify callbacks
    this.notifyError(previewError);
    this.notifyStateChange();

    // Auto-retry if enabled and recoverable
    if (this.options.autoRetry && previewError.recoverable) {
      this.scheduleAutoRetry();
    }

    return previewError;
  }

  /**
   * Captures an error event from window.
   */
  captureErrorEvent(event: ErrorEvent): PreviewError | null {
    return this.captureError(event);
  }

  /**
   * Captures a promise rejection.
   */
  captureRejection(event: PromiseRejectionEvent): PreviewError | null {
    const error = event.reason;
    return this.captureError(error, {
      category: categorizeError(error),
    });
  }

  // ---------------------------------------------------------------------------
  // Recovery
  // ---------------------------------------------------------------------------

  /**
   * Attempts to recover from the current error.
   */
  async retry<T>(recoveryFn: () => T | Promise<T>): Promise<boolean> {
    if (this.disposed || !this.state.hasError) return true;
    if (this.state.retryCount >= this.state.maxRetries) {
      this.notifyRecovery(false, this.state.error!);
      return false;
    }

    this.cancelAutoRetry();
    this.state.recovering = true;
    this.state.retryCount++;
    this.notifyStateChange();

    try {
      await recoveryFn();
      this.dismiss();
      this.notifyRecovery(true);
      return true;
    } catch (error) {
      const newError = this.captureError(error);
      if (newError) {
        this.state.retryCount = this.state.retryCount; // Keep retry count
      }
      this.state.recovering = false;
      this.notifyStateChange();
      this.notifyRecovery(false, newError || undefined);
      return false;
    }
  }

  /**
   * Dismisses the current error.
   */
  dismiss(): void {
    if (!this.state.hasError) return;

    this.cancelAutoRetry();
    this.state.hasError = false;
    this.state.error = null;
    this.state.retryCount = 0;
    this.state.recovering = false;
    this.notifyStateChange();
  }

  /**
   * Clears all error history.
   */
  clearHistory(): void {
    this.state.errorHistory = [];
    this.notifyStateChange();
  }

  private scheduleAutoRetry(): void {
    this.cancelAutoRetry();

    if (this.state.retryCount >= this.state.maxRetries) return;

    this.autoRetryTimer = setTimeout(() => {
      // Auto-retry will need an external recovery function
      // This just notifies that auto-retry was scheduled
      this.notifyStateChange();
    }, this.options.autoRetryDelay);
  }

  private cancelAutoRetry(): void {
    if (this.autoRetryTimer) {
      clearTimeout(this.autoRetryTimer);
      this.autoRetryTimer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  /**
   * Gets current state.
   */
  getState(): ErrorBoundaryState {
    return { ...this.state, errorHistory: [...this.state.errorHistory] };
  }

  /**
   * Gets the current error.
   */
  getError(): PreviewError | null {
    return this.state.error;
  }

  /**
   * Checks if there's an active error.
   */
  hasError(): boolean {
    return this.state.hasError;
  }

  /**
   * Checks if can retry.
   */
  canRetry(): boolean {
    return (
      this.state.hasError &&
      this.state.error?.recoverable === true &&
      this.state.retryCount < this.state.maxRetries
    );
  }

  /**
   * Gets retry count.
   */
  getRetryCount(): number {
    return this.state.retryCount;
  }

  /**
   * Gets error history.
   */
  getErrorHistory(): PreviewError[] {
    return [...this.state.errorHistory];
  }

  /**
   * Gets fallback UI configuration for current error.
   */
  getFallbackUI(): FallbackUIConfig | null {
    if (!this.state.error) return null;
    return getFallbackUIConfig(this.state.error);
  }

  // ---------------------------------------------------------------------------
  // Event Callbacks
  // ---------------------------------------------------------------------------

  /**
   * Registers a callback for errors.
   */
  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  /**
   * Registers a callback for recovery attempts.
   */
  onRecovery(callback: RecoveryCallback): () => void {
    this.recoveryCallbacks.add(callback);
    return () => this.recoveryCallbacks.delete(callback);
  }

  /**
   * Registers a callback for state changes.
   */
  onStateChange(callback: StateChangeCallback): () => void {
    this.stateCallbacks.add(callback);
    return () => this.stateCallbacks.delete(callback);
  }

  private notifyError(error: PreviewError): void {
    for (const callback of this.errorCallbacks) {
      try {
        callback(error);
      } catch (e) {
        console.error("PreviewErrorBoundary error callback failed:", e);
      }
    }
  }

  private notifyRecovery(success: boolean, error?: PreviewError): void {
    for (const callback of this.recoveryCallbacks) {
      try {
        callback(success, error);
      } catch (e) {
        console.error("PreviewErrorBoundary recovery callback failed:", e);
      }
    }
  }

  private notifyStateChange(): void {
    const state = this.getState();
    for (const callback of this.stateCallbacks) {
      try {
        callback(state);
      } catch (e) {
        console.error("PreviewErrorBoundary state callback failed:", e);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Disposes the instance.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.cancelAutoRetry();
    this.errorCallbacks.clear();
    this.recoveryCallbacks.clear();
    this.stateCallbacks.clear();
  }
}

// =============================================================================
// Iframe Script
// =============================================================================

/**
 * Script to inject into iframe for error capture.
 */
export const PREVIEW_ERROR_SCRIPT = `
(function() {
  if (window.__PLATXA_ERROR_BOUNDARY__) return;
  window.__PLATXA_ERROR_BOUNDARY__ = true;

  // Capture global errors
  window.addEventListener('error', function(event) {
    window.parent.postMessage({
      type: 'PLATXA_PREVIEW_ERROR',
      error: {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      },
    }, '*');
  });

  // Capture unhandled rejections
  window.addEventListener('unhandledrejection', function(event) {
    window.parent.postMessage({
      type: 'PLATXA_PREVIEW_REJECTION',
      error: {
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
      },
    }, '*');
  });

  // Capture console errors
  const originalConsoleError = console.error;
  console.error = function(...args) {
    window.parent.postMessage({
      type: 'PLATXA_CONSOLE_ERROR',
      args: args.map(arg =>
        arg instanceof Error ? { message: arg.message, stack: arg.stack } : String(arg)
      ),
    }, '*');
    originalConsoleError.apply(console, args);
  };
})();
`;

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates a PreviewErrorBoundary instance.
 */
export function createPreviewErrorBoundary(
  options?: ErrorBoundaryOptions
): PreviewErrorBoundary {
  return new PreviewErrorBoundary(options);
}

// =============================================================================
// Export
// =============================================================================

export default PreviewErrorBoundary;
