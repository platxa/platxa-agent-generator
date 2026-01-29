/**
 * Preview Iframe Error Capture — JS Errors and Failed Loads
 *
 * Captures JavaScript errors (window.onerror) and resource load failures
 * from the preview iframe for self-debugging capabilities.
 */

// =============================================================================
// Types
// =============================================================================

/** Error types captured from iframe */
export type IframeErrorType =
  | "javascript"
  | "resource"
  | "network"
  | "security"
  | "unhandled_rejection";

/** Resource types that can fail to load */
export type ResourceType = "script" | "stylesheet" | "image" | "font" | "other";

/** Captured error from iframe */
export interface IframeCapturedError {
  /** Unique error ID */
  id: string;
  /** Error type */
  type: IframeErrorType;
  /** Error message */
  message: string;
  /** Source file URL */
  source?: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Stack trace */
  stack?: string;
  /** Resource type for load failures */
  resourceType?: ResourceType;
  /** Timestamp of capture */
  timestamp: Date;
  /** Additional context */
  context?: Record<string, unknown>;
}

/** Error capture configuration */
export interface ErrorCaptureConfig {
  /** Capture JavaScript errors */
  captureJsErrors?: boolean;
  /** Capture resource load failures */
  captureResourceErrors?: boolean;
  /** Capture unhandled promise rejections */
  captureUnhandledRejections?: boolean;
  /** Maximum errors to buffer */
  maxBufferSize?: number;
  /** Error patterns to ignore */
  ignorePatterns?: RegExp[];
}

/** Error capture state */
export interface ErrorCaptureState {
  /** Whether capture is active */
  isActive: boolean;
  /** Number of errors captured */
  errorCount: number;
  /** Last error timestamp */
  lastErrorAt?: Date;
}

/** Message sent from iframe to parent */
export interface IframeErrorMessage {
  type: "iframe-error";
  error: IframeCapturedError;
}

/** Error listener callback */
export type ErrorListener = (error: IframeCapturedError) => void;

// =============================================================================
// Constants
// =============================================================================

/** Default capture configuration */
export const DEFAULT_CAPTURE_CONFIG: Required<ErrorCaptureConfig> = {
  captureJsErrors: true,
  captureResourceErrors: true,
  captureUnhandledRejections: true,
  maxBufferSize: 100,
  ignorePatterns: [],
};

/** Message type identifier for iframe errors */
export const IFRAME_ERROR_MESSAGE_TYPE = "iframe-error";

/** Resource type detection patterns */
export const RESOURCE_TYPE_PATTERNS: Record<ResourceType, RegExp> = {
  script: /\.(js|mjs|jsx|ts|tsx)(\?.*)?$/i,
  stylesheet: /\.(css|scss|sass|less)(\?.*)?$/i,
  image: /\.(png|jpg|jpeg|gif|webp|svg|ico|bmp)(\?.*)?$/i,
  font: /\.(woff2?|ttf|otf|eot)(\?.*)?$/i,
  other: /.*/,
};

/** Error severity levels */
export const ERROR_SEVERITY: Record<IframeErrorType, "low" | "medium" | "high" | "critical"> = {
  javascript: "high",
  resource: "medium",
  network: "medium",
  security: "critical",
  unhandled_rejection: "high",
};

// =============================================================================
// Helper Functions
// =============================================================================

let errorIdCounter = 0;

/**
 * Generates a unique error ID.
 */
export function generateErrorId(): string {
  return `err-${Date.now()}-${++errorIdCounter}`;
}

/**
 * Resets the error ID counter (for testing).
 */
export function resetErrorIdCounter(): void {
  errorIdCounter = 0;
}

/**
 * Detects resource type from URL.
 */
export function detectResourceType(url: string): ResourceType {
  for (const [type, pattern] of Object.entries(RESOURCE_TYPE_PATTERNS)) {
    if (type !== "other" && pattern.test(url)) {
      return type as ResourceType;
    }
  }
  return "other";
}

/**
 * Checks if an error should be ignored based on patterns.
 */
export function shouldIgnoreError(
  error: IframeCapturedError,
  patterns: RegExp[]
): boolean {
  if (patterns.length === 0) return false;

  const text = `${error.message} ${error.source || ""} ${error.stack || ""}`;
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * Creates an error from window.onerror arguments.
 */
export function createJsError(
  message: string,
  source?: string,
  line?: number,
  column?: number,
  error?: Error
): IframeCapturedError {
  return {
    id: generateErrorId(),
    type: "javascript",
    message: message || "Unknown JavaScript error",
    source,
    line,
    column,
    stack: error?.stack,
    timestamp: new Date(),
  };
}

/**
 * Creates an error from a failed resource load.
 */
export function createResourceError(
  url: string,
  tagName?: string
): IframeCapturedError {
  const resourceType = detectResourceType(url);

  return {
    id: generateErrorId(),
    type: "resource",
    message: `Failed to load ${resourceType}: ${url}`,
    source: url,
    resourceType,
    timestamp: new Date(),
    context: { tagName },
  };
}

/**
 * Creates an error from an unhandled promise rejection.
 */
export function createUnhandledRejectionError(
  reason: unknown
): IframeCapturedError {
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : "Unhandled promise rejection";

  return {
    id: generateErrorId(),
    type: "unhandled_rejection",
    message,
    stack: reason instanceof Error ? reason.stack : undefined,
    timestamp: new Date(),
  };
}

/**
 * Formats an error for display.
 */
export function formatCapturedError(error: IframeCapturedError): string {
  const parts = [`[${error.type.toUpperCase()}] ${error.message}`];

  if (error.source) {
    parts.push(`  at ${error.source}`);
    if (error.line !== undefined) {
      parts[parts.length - 1] += `:${error.line}`;
      if (error.column !== undefined) {
        parts[parts.length - 1] += `:${error.column}`;
      }
    }
  }

  return parts.join("\n");
}

/**
 * Groups errors by type.
 */
export function groupErrorsByType(
  errors: IframeCapturedError[]
): Record<IframeErrorType, IframeCapturedError[]> {
  const grouped: Record<IframeErrorType, IframeCapturedError[]> = {
    javascript: [],
    resource: [],
    network: [],
    security: [],
    unhandled_rejection: [],
  };

  for (const error of errors) {
    grouped[error.type].push(error);
  }

  return grouped;
}

/**
 * Gets error statistics.
 */
export function getErrorStats(errors: IframeCapturedError[]): {
  total: number;
  byType: Record<IframeErrorType, number>;
  bySeverity: Record<string, number>;
} {
  const stats = {
    total: errors.length,
    byType: {
      javascript: 0,
      resource: 0,
      network: 0,
      security: 0,
      unhandled_rejection: 0,
    } as Record<IframeErrorType, number>,
    bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
  };

  for (const error of errors) {
    stats.byType[error.type]++;
    stats.bySeverity[ERROR_SEVERITY[error.type]]++;
  }

  return stats;
}

/**
 * Generates the script to inject into iframe for error capture.
 */
export function generateCaptureScript(config: ErrorCaptureConfig = {}): string {
  const mergedConfig = { ...DEFAULT_CAPTURE_CONFIG, ...config };

  return `
(function() {
  var errors = [];
  var maxBuffer = ${mergedConfig.maxBufferSize};

  function sendError(error) {
    if (errors.length >= maxBuffer) {
      errors.shift();
    }
    errors.push(error);

    try {
      window.parent.postMessage({
        type: '${IFRAME_ERROR_MESSAGE_TYPE}',
        error: error
      }, '*');
    } catch (e) {
      console.error('Failed to send error to parent:', e);
    }
  }

  ${mergedConfig.captureJsErrors ? `
  window.onerror = function(message, source, line, column, error) {
    sendError({
      id: 'err-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      type: 'javascript',
      message: message || 'Unknown error',
      source: source,
      line: line,
      column: column,
      stack: error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    return false;
  };
  ` : ''}

  ${mergedConfig.captureUnhandledRejections ? `
  window.addEventListener('unhandledrejection', function(event) {
    var reason = event.reason;
    sendError({
      id: 'err-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      type: 'unhandled_rejection',
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      timestamp: new Date().toISOString()
    });
  });
  ` : ''}

  ${mergedConfig.captureResourceErrors ? `
  window.addEventListener('error', function(event) {
    if (event.target && event.target !== window) {
      var target = event.target;
      var url = target.src || target.href || '';
      if (url) {
        var resourceType = 'other';
        if (/\\.(js|mjs)$/i.test(url)) resourceType = 'script';
        else if (/\\.(css|scss)$/i.test(url)) resourceType = 'stylesheet';
        else if (/\\.(png|jpg|jpeg|gif|webp|svg)$/i.test(url)) resourceType = 'image';
        else if (/\\.(woff2?|ttf|otf)$/i.test(url)) resourceType = 'font';

        sendError({
          id: 'err-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
          type: 'resource',
          message: 'Failed to load ' + resourceType + ': ' + url,
          source: url,
          resourceType: resourceType,
          timestamp: new Date().toISOString(),
          context: { tagName: target.tagName }
        });
      }
    }
  }, true);
  ` : ''}

  window.__iframeErrorCapture = {
    getErrors: function() { return errors.slice(); },
    clearErrors: function() { errors = []; },
    getErrorCount: function() { return errors.length; }
  };
})();
`;
}

// =============================================================================
// IframeErrorCapture Class
// =============================================================================

/**
 * Service for capturing errors from preview iframe.
 */
export class IframeErrorCapture {
  private config: Required<ErrorCaptureConfig>;
  private errors: IframeCapturedError[] = [];
  private listeners: Set<ErrorListener> = new Set();
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private isActive = false;

  constructor(config: ErrorCaptureConfig = {}) {
    this.config = { ...DEFAULT_CAPTURE_CONFIG, ...config };
  }

  /**
   * Gets current state.
   */
  getState(): ErrorCaptureState {
    return {
      isActive: this.isActive,
      errorCount: this.errors.length,
      lastErrorAt: this.errors.length > 0
        ? this.errors[this.errors.length - 1].timestamp
        : undefined,
    };
  }

  /**
   * Gets captured errors.
   */
  getErrors(): IframeCapturedError[] {
    return [...this.errors];
  }

  /**
   * Gets filtered errors (excluding ignored patterns).
   */
  getFilteredErrors(): IframeCapturedError[] {
    return this.errors.filter(
      (error) => !shouldIgnoreError(error, this.config.ignorePatterns)
    );
  }

  /**
   * Clears captured errors.
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * Adds an error listener.
   */
  addListener(listener: ErrorListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Removes an error listener.
   */
  removeListener(listener: ErrorListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Starts listening for iframe errors.
   */
  start(): void {
    if (this.isActive) return;

    this.messageHandler = (event: MessageEvent) => {
      if (
        event.data &&
        event.data.type === IFRAME_ERROR_MESSAGE_TYPE &&
        event.data.error
      ) {
        this.handleError(event.data.error);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("message", this.messageHandler);
    }

    this.isActive = true;
  }

  /**
   * Stops listening for iframe errors.
   */
  stop(): void {
    if (!this.isActive || !this.messageHandler) return;

    if (typeof window !== "undefined") {
      window.removeEventListener("message", this.messageHandler);
    }

    this.messageHandler = null;
    this.isActive = false;
  }

  /**
   * Handles an incoming error.
   */
  private handleError(error: IframeCapturedError): void {
    // Normalize timestamp
    if (typeof error.timestamp === "string") {
      error.timestamp = new Date(error.timestamp);
    }

    // Check ignore patterns
    if (shouldIgnoreError(error, this.config.ignorePatterns)) {
      return;
    }

    // Add to buffer
    if (this.errors.length >= this.config.maxBufferSize) {
      this.errors.shift();
    }
    this.errors.push(error);

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(error);
      } catch (err) {
        console.error("Error listener failed:", err);
      }
    }
  }

  /**
   * Manually adds an error (for testing or external sources).
   */
  addError(error: IframeCapturedError): void {
    this.handleError(error);
  }

  /**
   * Gets the capture script to inject into iframe.
   */
  getCaptureScript(): string {
    return generateCaptureScript(this.config);
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates an IframeErrorCapture instance.
 */
export function createErrorCapture(
  config?: ErrorCaptureConfig
): IframeErrorCapture {
  return new IframeErrorCapture(config);
}

/**
 * Creates a mock error for testing.
 */
export function createMockError(
  overrides: Partial<IframeCapturedError> = {}
): IframeCapturedError {
  return {
    id: generateErrorId(),
    type: "javascript",
    message: "Test error",
    timestamp: new Date(),
    ...overrides,
  };
}
