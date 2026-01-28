/**
 * Error Pipeline — Unified Agent Error Handling
 *
 * Transforms raw agent errors into categorized, user-facing messages
 * with actionable suggestions for the chat UI.
 */

// =============================================================================
// Types
// =============================================================================

/** Error category for classification */
export type ErrorCategory =
  | "validation"    // Input/output validation failures
  | "generation"    // LLM generation errors
  | "network"       // Network/API connectivity issues
  | "permission"    // Auth/permission denied
  | "timeout"       // Operation timed out
  | "resource"      // Resource not found or exhausted
  | "configuration" // Missing/invalid configuration
  | "internal";     // Unexpected internal errors

/** Severity level */
export type ErrorSeverity = "info" | "warning" | "error" | "critical";

/** An actionable suggestion for the user */
export interface ErrorSuggestion {
  /** Short label for the action */
  label: string;
  /** Detailed description */
  description: string;
  /** Action type: retry, modify, configure, contact */
  actionType: "retry" | "modify" | "configure" | "contact";
}

/** A processed, user-facing error */
export interface PipelineError {
  /** Original error message */
  originalMessage: string;
  /** User-friendly message */
  userMessage: string;
  /** Error category */
  category: ErrorCategory;
  /** Severity level */
  severity: ErrorSeverity;
  /** Actionable suggestions */
  suggestions: ErrorSuggestion[];
  /** Error code for programmatic handling */
  code: string;
  /** Whether the error is recoverable */
  recoverable: boolean;
  /** Timestamp */
  timestamp: string;
}

/** Raw error input from any agent phase */
export interface RawAgentError {
  /** Error message or Error object */
  error: string | Error;
  /** Phase where error occurred */
  phase?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

// =============================================================================
// Classification Rules
// =============================================================================

interface ClassificationRule {
  pattern: RegExp;
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;
  userMessage: string;
  suggestions: ErrorSuggestion[];
  recoverable: boolean;
}

const CLASSIFICATION_RULES: ClassificationRule[] = [
  // Network errors
  {
    pattern: /\b(ECONNREFUSED|ENOTFOUND|ETIMEDOUT|fetch failed|network|socket hang up|ECONNRESET)\b/i,
    category: "network",
    severity: "error",
    code: "ERR_NETWORK",
    userMessage: "Unable to connect to the server. Please check your network connection.",
    suggestions: [
      { label: "Retry", description: "Try the operation again", actionType: "retry" },
      { label: "Check connection", description: "Verify your network settings and server availability", actionType: "configure" },
    ],
    recoverable: true,
  },
  // Timeout
  {
    pattern: /\b(timeout|timed?\s*out|deadline exceeded|took too long)\b/i,
    category: "timeout",
    severity: "warning",
    code: "ERR_TIMEOUT",
    userMessage: "The operation took too long and was stopped. Try simplifying your request.",
    suggestions: [
      { label: "Retry", description: "Try again — it may succeed on the next attempt", actionType: "retry" },
      { label: "Simplify prompt", description: "Use a shorter or simpler description", actionType: "modify" },
    ],
    recoverable: true,
  },
  // Permission/Auth
  {
    pattern: /\b(unauthorized|forbidden|403|401|permission denied|access denied|auth)\b/i,
    category: "permission",
    severity: "error",
    code: "ERR_PERMISSION",
    userMessage: "You don't have permission to perform this action.",
    suggestions: [
      { label: "Check credentials", description: "Verify your API key or login credentials", actionType: "configure" },
      { label: "Contact support", description: "Reach out if you believe this is an error", actionType: "contact" },
    ],
    recoverable: false,
  },
  // Rate limiting
  {
    pattern: /\b(rate\s*limit|too many requests|429|throttle)\b/i,
    category: "resource",
    severity: "warning",
    code: "ERR_RATE_LIMIT",
    userMessage: "Too many requests. Please wait a moment before trying again.",
    suggestions: [
      { label: "Wait and retry", description: "Wait 30 seconds then try again", actionType: "retry" },
    ],
    recoverable: true,
  },
  // Validation
  {
    pattern: /\b(invalid|malformed|missing required|validation failed|schema|parse error|unexpected token)\b/i,
    category: "validation",
    severity: "warning",
    code: "ERR_VALIDATION",
    userMessage: "The input or output didn't match the expected format.",
    suggestions: [
      { label: "Modify input", description: "Check your prompt for special characters or formatting issues", actionType: "modify" },
      { label: "Retry", description: "Try again with a clearer description", actionType: "retry" },
    ],
    recoverable: true,
  },
  // Generation failures
  {
    pattern: /\b(generation failed|LLM|model error|completion|token limit|context length|content filter)\b/i,
    category: "generation",
    severity: "error",
    code: "ERR_GENERATION",
    userMessage: "The AI generation encountered an issue. Try adjusting your prompt.",
    suggestions: [
      { label: "Simplify prompt", description: "Use a shorter or simpler description", actionType: "modify" },
      { label: "Retry", description: "Try the same request again", actionType: "retry" },
    ],
    recoverable: true,
  },
  // Resource not found
  {
    pattern: /\b(not found|404|no such file|ENOENT|does not exist|missing)\b/i,
    category: "resource",
    severity: "error",
    code: "ERR_NOT_FOUND",
    userMessage: "The requested resource could not be found.",
    suggestions: [
      { label: "Check configuration", description: "Verify file paths and resource names", actionType: "configure" },
    ],
    recoverable: false,
  },
  // Configuration
  {
    pattern: /\b(config|configuration|env|environment|API_KEY|missing key|not configured)\b/i,
    category: "configuration",
    severity: "error",
    code: "ERR_CONFIG",
    userMessage: "A required configuration is missing or invalid.",
    suggestions: [
      { label: "Check settings", description: "Review your project configuration and environment variables", actionType: "configure" },
    ],
    recoverable: false,
  },
];

// =============================================================================
// Classification
// =============================================================================

/**
 * Classifies a raw error message into a categorized PipelineError.
 */
export function classifyError(raw: RawAgentError): PipelineError {
  const message = typeof raw.error === "string" ? raw.error : raw.error.message;
  const timestamp = new Date().toISOString();

  // Try each rule in order
  for (const rule of CLASSIFICATION_RULES) {
    if (rule.pattern.test(message)) {
      return {
        originalMessage: message,
        userMessage: rule.userMessage,
        category: rule.category,
        severity: rule.severity,
        suggestions: rule.suggestions,
        code: rule.code,
        recoverable: rule.recoverable,
        timestamp,
      };
    }
  }

  // Fallback: internal error
  return {
    originalMessage: message,
    userMessage: "An unexpected error occurred. Please try again.",
    category: "internal",
    severity: "error",
    suggestions: [
      { label: "Retry", description: "Try the operation again", actionType: "retry" },
      { label: "Contact support", description: "Report this issue if it persists", actionType: "contact" },
    ],
    code: "ERR_INTERNAL",
    recoverable: true,
    timestamp,
  };
}

// =============================================================================
// Formatting for Chat UI
// =============================================================================

/**
 * Formats a PipelineError into a chat-friendly message string.
 */
export function formatForChat(error: PipelineError): string {
  const icon = SEVERITY_ICONS[error.severity];
  const lines: string[] = [];

  lines.push(`${icon} **${error.userMessage}**`);
  lines.push("");

  if (error.suggestions.length > 0) {
    lines.push("**Suggested actions:**");
    for (const s of error.suggestions) {
      lines.push(`- **${s.label}**: ${s.description}`);
    }
  }

  lines.push("");
  lines.push(`_Error code: ${error.code}_`);

  return lines.join("\n");
}

const SEVERITY_ICONS: Record<ErrorSeverity, string> = {
  info: "ℹ️",
  warning: "⚠️",
  error: "❌",
  critical: "🚨",
};

// =============================================================================
// Pipeline
// =============================================================================

/** Handler called when a processed error is ready for the UI */
export type ErrorHandler = (error: PipelineError) => void;

/**
 * Creates an error pipeline that classifies raw errors and dispatches
 * them to a handler (typically the chat UI).
 */
export function createErrorPipeline(handler: ErrorHandler) {
  const errors: PipelineError[] = [];

  return {
    /** Process a raw agent error */
    handle(raw: RawAgentError): PipelineError {
      const processed = classifyError(raw);
      errors.push(processed);
      handler(processed);
      return processed;
    },

    /** Get all processed errors */
    getErrors(): PipelineError[] {
      return [...errors];
    },

    /** Get errors by category */
    getByCategory(category: ErrorCategory): PipelineError[] {
      return errors.filter((e) => e.category === category);
    },

    /** Get count of errors by severity */
    countBySeverity(): Record<ErrorSeverity, number> {
      const counts: Record<ErrorSeverity, number> = { info: 0, warning: 0, error: 0, critical: 0 };
      for (const e of errors) counts[e.severity]++;
      return counts;
    },

    /** Whether any non-recoverable errors occurred */
    hasBlockingErrors(): boolean {
      return errors.some((e) => !e.recoverable);
    },

    /** Clear error history */
    clear(): void {
      errors.length = 0;
    },
  };
}
