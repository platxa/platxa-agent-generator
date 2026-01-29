/**
 * Error Escalation System
 *
 * Handles escalation to user when automatic fixes fail:
 * - After 3 failed retry attempts
 * - Provides suggested manual fixes
 * - Formats error details for user display
 */

import type { ErrorIdentifier, RetryState, RetryAttempt } from "./error-retry-logic";

// =============================================================================
// Types
// =============================================================================

/** Severity level for escalated errors */
export type EscalationSeverity = "low" | "medium" | "high" | "critical";

/** Category of manual fix suggestion */
export type SuggestionCategory =
  | "syntax"      // Fix syntax issues
  | "structure"   // Fix structural issues
  | "reference"   // Fix missing references
  | "config"      // Fix configuration
  | "dependency"  // Fix dependencies
  | "logic"       // Fix logic errors
  | "other";      // Other fixes

/** Manual fix suggestion */
export interface ManualSuggestion {
  /** Unique ID for the suggestion */
  id: string;
  /** Category of the fix */
  category: SuggestionCategory;
  /** Short title */
  title: string;
  /** Detailed description */
  description: string;
  /** Step-by-step instructions */
  steps: string[];
  /** Code example if applicable */
  codeExample?: string;
  /** Confidence level (0-1) */
  confidence: number;
  /** Estimated effort (minutes) */
  estimatedEffort?: number;
}

/** Escalated error with context */
export interface EscalatedError {
  /** Unique escalation ID */
  id: string;
  /** Original error */
  error: ErrorIdentifier;
  /** Severity level */
  severity: EscalationSeverity;
  /** Why escalation occurred */
  reason: string;
  /** Retry attempts made */
  attempts: RetryAttempt[];
  /** Manual fix suggestions */
  suggestions: ManualSuggestion[];
  /** Timestamp of escalation */
  timestamp: number;
  /** Formatted message for display */
  displayMessage: string;
  /** Context about what was tried */
  triedApproaches: string[];
}

/** Escalation callback */
export type EscalationCallback = (escalation: EscalatedError) => void;

/** Suggestion generator function */
export type SuggestionGenerator = (
  error: ErrorIdentifier,
  attempts: RetryAttempt[]
) => ManualSuggestion[];

/** Escalation configuration */
export interface EscalationConfig {
  /** Custom suggestion generators by error type */
  suggestionGenerators: Map<string, SuggestionGenerator>;
  /** Default suggestions when no specific generator matches */
  defaultSuggestions: boolean;
  /** Include code examples in suggestions */
  includeCodeExamples: boolean;
  /** Escalation callbacks */
  callbacks: EscalationCallback[];
}

// =============================================================================
// ID Generation
// =============================================================================

let escalationCounter = 0;
let suggestionCounter = 0;

function generateEscalationId(): string {
  escalationCounter++;
  return `esc-${Date.now()}-${escalationCounter}`;
}

function generateSuggestionId(): string {
  suggestionCounter++;
  return `sug-${Date.now()}-${suggestionCounter}`;
}

// =============================================================================
// Severity Detection
// =============================================================================

/** Keywords indicating critical errors */
const CRITICAL_KEYWORDS = [
  "crash", "fatal", "corruption", "data loss", "security",
  "injection", "xss", "sql injection", "unauthorized",
];

/** Keywords indicating high severity */
const HIGH_KEYWORDS = [
  "exception", "unhandled", "cannot", "failed to",
  "undefined", "null reference", "type error",
];

/** Keywords indicating medium severity */
const MEDIUM_KEYWORDS = [
  "warning", "deprecated", "missing", "not found",
  "invalid", "unexpected",
];

/**
 * Determines severity based on error message.
 */
export function determineSeverity(error: ErrorIdentifier): EscalationSeverity {
  const message = error.message.toLowerCase();
  const errorType = error.errorType?.toLowerCase() ?? "";
  const combined = `${message} ${errorType}`;

  if (CRITICAL_KEYWORDS.some((kw) => combined.includes(kw))) {
    return "critical";
  }
  if (HIGH_KEYWORDS.some((kw) => combined.includes(kw))) {
    return "high";
  }
  if (MEDIUM_KEYWORDS.some((kw) => combined.includes(kw))) {
    return "medium";
  }
  return "low";
}

// =============================================================================
// Default Suggestion Generators
// =============================================================================

/** Generates suggestions for syntax errors */
export function generateSyntaxSuggestions(
  error: ErrorIdentifier
): ManualSuggestion[] {
  const suggestions: ManualSuggestion[] = [];
  const message = error.message.toLowerCase();

  if (message.includes("unexpected token") || message.includes("parse error")) {
    suggestions.push({
      id: generateSuggestionId(),
      category: "syntax",
      title: "Check for syntax errors",
      description: "The code contains a syntax error that prevents parsing.",
      steps: [
        "Review the error location for missing or extra characters",
        "Check for unclosed brackets, parentheses, or quotes",
        "Verify proper comma placement in arrays/objects",
        "Ensure statements are properly terminated",
      ],
      confidence: 0.8,
      estimatedEffort: 5,
    });
  }

  if (message.includes("unclosed") || message.includes("unterminated")) {
    suggestions.push({
      id: generateSuggestionId(),
      category: "syntax",
      title: "Close unclosed block",
      description: "A code block or string is not properly closed.",
      steps: [
        "Find the opening character (bracket, quote, etc.)",
        "Trace to find where it should be closed",
        "Add the matching closing character",
      ],
      confidence: 0.9,
      estimatedEffort: 2,
    });
  }

  return suggestions;
}

/** Generates suggestions for structure errors */
export function generateStructureSuggestions(
  error: ErrorIdentifier
): ManualSuggestion[] {
  const suggestions: ManualSuggestion[] = [];
  const message = error.message.toLowerCase();

  if (message.includes("missing") || message.includes("required")) {
    suggestions.push({
      id: generateSuggestionId(),
      category: "structure",
      title: "Add missing element",
      description: "A required element or attribute is missing.",
      steps: [
        "Identify what element is required",
        "Check documentation for correct format",
        "Add the missing element in the correct location",
      ],
      confidence: 0.7,
      estimatedEffort: 10,
    });
  }

  if (message.includes("invalid") && message.includes("structure")) {
    suggestions.push({
      id: generateSuggestionId(),
      category: "structure",
      title: "Fix invalid structure",
      description: "The code structure doesn't match the expected format.",
      steps: [
        "Compare with working examples",
        "Check parent-child element relationships",
        "Ensure proper nesting of elements",
      ],
      confidence: 0.6,
      estimatedEffort: 15,
    });
  }

  return suggestions;
}

/** Generates suggestions for reference errors */
export function generateReferenceSuggestions(
  error: ErrorIdentifier
): ManualSuggestion[] {
  const suggestions: ManualSuggestion[] = [];
  const message = error.message.toLowerCase();

  if (message.includes("undefined") || message.includes("not defined")) {
    suggestions.push({
      id: generateSuggestionId(),
      category: "reference",
      title: "Define missing variable/function",
      description: "A referenced variable or function is not defined.",
      steps: [
        "Check for typos in the reference name",
        "Verify the import/require statement exists",
        "Ensure the definition is in scope",
        "Add the missing definition if needed",
      ],
      confidence: 0.85,
      estimatedEffort: 5,
    });
  }

  if (message.includes("cannot find") || message.includes("not found")) {
    suggestions.push({
      id: generateSuggestionId(),
      category: "reference",
      title: "Fix missing reference",
      description: "A file, module, or resource cannot be found.",
      steps: [
        "Verify the path is correct",
        "Check for case sensitivity issues",
        "Ensure the file/module exists",
        "Update the reference if moved",
      ],
      confidence: 0.8,
      estimatedEffort: 10,
    });
  }

  return suggestions;
}

/** Generates suggestions for type errors */
export function generateTypeSuggestions(
  error: ErrorIdentifier
): ManualSuggestion[] {
  const suggestions: ManualSuggestion[] = [];
  const message = error.message.toLowerCase();

  if (message.includes("type") && (message.includes("error") || message.includes("mismatch"))) {
    suggestions.push({
      id: generateSuggestionId(),
      category: "logic",
      title: "Fix type mismatch",
      description: "A value has an unexpected type.",
      steps: [
        "Check the expected type for the operation",
        "Verify the actual value being passed",
        "Add type conversion if needed",
        "Fix the source of the incorrect type",
      ],
      confidence: 0.75,
      estimatedEffort: 10,
    });
  }

  return suggestions;
}

/** Generates generic fallback suggestions */
export function generateGenericSuggestions(
  error: ErrorIdentifier,
  attempts: RetryAttempt[]
): ManualSuggestion[] {
  const suggestions: ManualSuggestion[] = [];

  suggestions.push({
    id: generateSuggestionId(),
    category: "other",
    title: "Review error context",
    description: "Manually review the error and surrounding code.",
    steps: [
      `Go to ${error.filePath ?? "the affected file"}${error.lineNumber ? ` line ${error.lineNumber}` : ""}`,
      "Read the error message carefully",
      "Check recent changes to this area",
      "Look for similar patterns in working code",
    ],
    confidence: 0.5,
    estimatedEffort: 15,
  });

  // Add attempt-based suggestion
  if (attempts.length > 0) {
    const lastAttempt = attempts[attempts.length - 1];
    if (lastAttempt.errorMessage) {
      suggestions.push({
        id: generateSuggestionId(),
        category: "other",
        title: "Investigate last fix attempt",
        description: `The last automated fix attempt failed: ${lastAttempt.errorMessage}`,
        steps: [
          "Review why the automated fix didn't work",
          "Consider if the error diagnosis was correct",
          "Try a different approach based on the failure",
        ],
        confidence: 0.4,
        estimatedEffort: 20,
      });
    }
  }

  return suggestions;
}

// =============================================================================
// Display Formatting
// =============================================================================

/**
 * Formats escalated error for display.
 */
export function formatEscalatedError(escalation: EscalatedError): string {
  const lines: string[] = [];

  // Header with severity
  const severityEmoji = {
    critical: "🚨",
    high: "❌",
    medium: "⚠️",
    low: "ℹ️",
  }[escalation.severity];

  lines.push(`${severityEmoji} Error requires manual attention`);
  lines.push("");
  lines.push(`Error: ${escalation.error.message}`);

  if (escalation.error.filePath) {
    lines.push(`Location: ${escalation.error.filePath}${escalation.error.lineNumber ? `:${escalation.error.lineNumber}` : ""}`);
  }

  lines.push("");
  lines.push(`Reason: ${escalation.reason}`);
  lines.push(`Attempts: ${escalation.attempts.length} automatic fix attempts failed`);

  if (escalation.triedApproaches.length > 0) {
    lines.push(`Tried: ${escalation.triedApproaches.join(", ")}`);
  }

  if (escalation.suggestions.length > 0) {
    lines.push("");
    lines.push("Suggested fixes:");
    for (const suggestion of escalation.suggestions) {
      lines.push(`  • ${suggestion.title} (${Math.round(suggestion.confidence * 100)}% confidence)`);
    }
  }

  return lines.join("\n");
}

/**
 * Formats a suggestion with full details.
 */
export function formatSuggestion(suggestion: ManualSuggestion): string {
  const lines: string[] = [];

  lines.push(`📋 ${suggestion.title}`);
  lines.push(`   Category: ${suggestion.category}`);
  lines.push(`   ${suggestion.description}`);
  lines.push("");
  lines.push("   Steps:");
  suggestion.steps.forEach((step, i) => {
    lines.push(`   ${i + 1}. ${step}`);
  });

  if (suggestion.codeExample) {
    lines.push("");
    lines.push("   Example:");
    lines.push(`   ${suggestion.codeExample}`);
  }

  if (suggestion.estimatedEffort) {
    lines.push("");
    lines.push(`   Estimated time: ~${suggestion.estimatedEffort} minutes`);
  }

  return lines.join("\n");
}

// =============================================================================
// ErrorEscalationManager Class
// =============================================================================

/**
 * Manages error escalation to users.
 */
export class ErrorEscalationManager {
  private config: EscalationConfig;
  private escalations: Map<string, EscalatedError> = new Map();

  constructor(config: Partial<EscalationConfig> = {}) {
    this.config = {
      suggestionGenerators: config.suggestionGenerators ?? new Map(),
      defaultSuggestions: config.defaultSuggestions ?? true,
      includeCodeExamples: config.includeCodeExamples ?? true,
      callbacks: config.callbacks ?? [],
    };
  }

  /**
   * Registers a suggestion generator for an error type.
   */
  registerGenerator(errorType: string, generator: SuggestionGenerator): void {
    this.config.suggestionGenerators.set(errorType, generator);
  }

  /**
   * Adds an escalation callback.
   */
  onEscalation(callback: EscalationCallback): void {
    this.config.callbacks.push(callback);
  }

  /**
   * Generates suggestions for an error.
   */
  generateSuggestions(
    error: ErrorIdentifier,
    attempts: RetryAttempt[]
  ): ManualSuggestion[] {
    const suggestions: ManualSuggestion[] = [];

    // Try custom generator first
    if (error.errorType) {
      const customGenerator = this.config.suggestionGenerators.get(error.errorType);
      if (customGenerator) {
        suggestions.push(...customGenerator(error, attempts));
      }
    }

    // Add default suggestions
    if (this.config.defaultSuggestions) {
      suggestions.push(...generateSyntaxSuggestions(error));
      suggestions.push(...generateStructureSuggestions(error));
      suggestions.push(...generateReferenceSuggestions(error));
      suggestions.push(...generateTypeSuggestions(error));

      // Add generic suggestions if none matched
      if (suggestions.length === 0) {
        suggestions.push(...generateGenericSuggestions(error, attempts));
      }
    }

    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence);

    // Limit to top suggestions
    return suggestions.slice(0, 5);
  }

  /**
   * Escalates an error after retry failures.
   */
  escalate(error: ErrorIdentifier, retryState: RetryState): EscalatedError {
    const suggestions = this.generateSuggestions(error, retryState.attempts);
    const severity = determineSeverity(error);

    const escalation: EscalatedError = {
      id: generateEscalationId(),
      error,
      severity,
      reason: `All ${retryState.maxAttempts} automatic fix attempts failed`,
      attempts: [...retryState.attempts],
      suggestions,
      timestamp: Date.now(),
      displayMessage: "",
      triedApproaches: retryState.approachesTried,
    };

    // Generate display message
    escalation.displayMessage = formatEscalatedError(escalation);

    // Store escalation
    this.escalations.set(escalation.id, escalation);

    // Notify callbacks
    for (const callback of this.config.callbacks) {
      try {
        callback(escalation);
      } catch {
        // Ignore callback errors
      }
    }

    return escalation;
  }

  /**
   * Escalates from retry state if needed.
   */
  escalateIfNeeded(
    error: ErrorIdentifier,
    retryState: RetryState
  ): EscalatedError | null {
    if (retryState.exhausted && !retryState.resolved) {
      return this.escalate(error, retryState);
    }
    return null;
  }

  /**
   * Gets an escalation by ID.
   */
  getEscalation(id: string): EscalatedError | undefined {
    return this.escalations.get(id);
  }

  /**
   * Gets all escalations.
   */
  getAllEscalations(): EscalatedError[] {
    return Array.from(this.escalations.values());
  }

  /**
   * Gets escalations by severity.
   */
  getEscalationsBySeverity(severity: EscalationSeverity): EscalatedError[] {
    return this.getAllEscalations().filter((e) => e.severity === severity);
  }

  /**
   * Marks an escalation as resolved.
   */
  resolveEscalation(id: string): boolean {
    return this.escalations.delete(id);
  }

  /**
   * Gets count of active escalations.
   */
  getActiveCount(): number {
    return this.escalations.size;
  }

  /**
   * Gets statistics about escalations.
   */
  getStats(): {
    total: number;
    bySeverity: Record<EscalationSeverity, number>;
    averageSuggestions: number;
  } {
    const escalations = this.getAllEscalations();
    const bySeverity: Record<EscalationSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    let totalSuggestions = 0;
    for (const e of escalations) {
      bySeverity[e.severity]++;
      totalSuggestions += e.suggestions.length;
    }

    return {
      total: escalations.length,
      bySeverity,
      averageSuggestions: escalations.length > 0 ? totalSuggestions / escalations.length : 0,
    };
  }

  /**
   * Clears all escalations.
   */
  clear(): void {
    this.escalations.clear();
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates an ErrorEscalationManager instance.
 */
export function createEscalationManager(
  config?: Partial<EscalationConfig>
): ErrorEscalationManager {
  return new ErrorEscalationManager(config);
}

/**
 * Creates an escalation manager with a callback.
 */
export function createEscalationManagerWithCallback(
  callback: EscalationCallback,
  config?: Partial<EscalationConfig>
): ErrorEscalationManager {
  const manager = new ErrorEscalationManager(config);
  manager.onEscalation(callback);
  return manager;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Checks if an error should be escalated.
 */
export function shouldEscalateError(retryState: RetryState): boolean {
  return retryState.exhausted && !retryState.resolved;
}

/**
 * Gets the highest priority suggestion.
 */
export function getTopSuggestion(
  escalation: EscalatedError
): ManualSuggestion | undefined {
  return escalation.suggestions[0];
}

/**
 * Filters suggestions by category.
 */
export function filterSuggestionsByCategory(
  suggestions: ManualSuggestion[],
  category: SuggestionCategory
): ManualSuggestion[] {
  return suggestions.filter((s) => s.category === category);
}

/**
 * Creates a summary of escalation for logging.
 */
export function createEscalationSummary(escalation: EscalatedError): string {
  return `[${escalation.severity.toUpperCase()}] ${escalation.error.message} - ${escalation.suggestions.length} suggestions`;
}
