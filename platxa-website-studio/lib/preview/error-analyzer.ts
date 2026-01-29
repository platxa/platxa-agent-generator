/**
 * Error Analyzer
 *
 * Parses raw error messages into structured format for self-debugging.
 * Supports TypeScript, SCSS, QWeb, JavaScript runtime, and generic errors.
 */

// =============================================================================
// Types
// =============================================================================

/** Error types that can be detected and parsed */
export type ErrorType =
  | "typescript"
  | "scss"
  | "qweb"
  | "javascript"
  | "runtime"
  | "syntax"
  | "reference"
  | "type"
  | "network"
  | "unknown";

/** Structured error with parsed components */
export interface StructuredError {
  /** Error type/category */
  type: ErrorType;
  /** File path where error occurred */
  file: string | null;
  /** Line number (1-based) */
  line: number | null;
  /** Column number (1-based) */
  column: number | null;
  /** Error message (cleaned/normalized) */
  message: string;
  /** Additional context */
  context: ErrorContext;
  /** Original raw error string */
  raw: string;
}

/** Additional error context */
export interface ErrorContext {
  /** Error code (e.g., TS2322, SCSS syntax error) */
  code: string | null;
  /** Stack trace if available */
  stack: string | null;
  /** Source code snippet around error */
  sourceSnippet: string | null;
  /** Related errors or notes */
  related: string[];
  /** Suggested fix if parseable */
  suggestion: string | null;
  /** End line for multi-line errors */
  endLine: number | null;
  /** End column for range errors */
  endColumn: number | null;
}

/** Options for error analysis */
export interface ErrorAnalyzerOptions {
  /** Include stack traces in context */
  includeStack?: boolean;
  /** Extract source snippets from error messages */
  extractSnippets?: boolean;
  /** Default file path for errors without location */
  defaultFile?: string;
}

// =============================================================================
// Error Patterns
// =============================================================================

/** Pattern definitions for different error formats */
interface ErrorPattern {
  type: ErrorType;
  pattern: RegExp;
  extract: (match: RegExpMatchArray, raw: string) => Partial<StructuredError>;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // TypeScript errors: path/file.ts(line,col): error TSxxxx: message
  {
    type: "typescript",
    pattern: /^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/m,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      message: match[5],
      context: { code: match[4], related: [], stack: null, sourceSnippet: null, suggestion: null, endLine: null, endColumn: null },
    }),
  },
  // TypeScript errors (alternative): path/file.ts:line:col - error TSxxxx: message
  {
    type: "typescript",
    pattern: /^(.+?):(\d+):(\d+)\s*-\s*error\s+(TS\d+):\s*(.+)$/m,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      message: match[5],
      context: { code: match[4], related: [], stack: null, sourceSnippet: null, suggestion: null, endLine: null, endColumn: null },
    }),
  },
  // QWeb errors: [QWeb ERROR] file:line:col [template] (directive): message
  {
    type: "qweb",
    pattern: /\[QWeb\s+(?:ERROR|WARNING)\]\s*(.+?):(\d+)(?::(\d+))?\s*(?:\[([^\]]+)\])?\s*(?:\(([^)]+)\))?:\s*(.+)/i,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2], 10),
      column: match[3] ? parseInt(match[3], 10) : null,
      message: match[6],
      context: {
        code: match[5] || null, // directive
        related: match[4] ? [`template: ${match[4]}`] : [],
        stack: null,
        sourceSnippet: null,
        suggestion: null,
        endLine: null,
        endColumn: null,
      },
    }),
  },
  // JavaScript ReferenceError: message at file:line:col (MUST be before generic SCSS pattern)
  {
    type: "reference",
    pattern: /ReferenceError:\s*(.+?)(?:\s+at\s+\S+\s+\((.+?):(\d+):(\d+)\)|$)/,
    extract: (match) => ({
      message: match[1],
      file: match[2] || null,
      line: match[3] ? parseInt(match[3], 10) : null,
      column: match[4] ? parseInt(match[4], 10) : null,
    }),
  },
  // JavaScript TypeError: message at file:line:col (MUST be before generic SCSS pattern)
  {
    type: "type",
    pattern: /TypeError:\s*(.+?)(?:\s+at\s+\S+\s+\((.+?):(\d+):(\d+)\)|$)/,
    extract: (match) => ({
      message: match[1],
      file: match[2] || null,
      line: match[3] ? parseInt(match[3], 10) : null,
      column: match[4] ? parseInt(match[4], 10) : null,
    }),
  },
  // JavaScript SyntaxError: message at file:line:col (MUST be before generic SCSS pattern)
  {
    type: "syntax",
    pattern: /SyntaxError:\s*(.+?)(?:\s+at\s+\S+\s+\((.+?):(\d+):(\d+)\)|$)/,
    extract: (match) => ({
      message: match[1],
      file: match[2] || null,
      line: match[3] ? parseInt(match[3], 10) : null,
      column: match[4] ? parseInt(match[4], 10) : null,
    }),
  },
  // SCSS dart-sass style: file.scss:line:col: message (specific .scss extension)
  {
    type: "scss",
    pattern: /^(.+\.scss):(\d+):(\d+):\s*(.+)$/m,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      message: match[4],
    }),
  },
  // SCSS/Sass errors: Error: message on line X of file.scss
  {
    type: "scss",
    pattern: /Error:\s*(.+?)\s+on\s+line\s+(\d+)\s+of\s+(.+\.scss)/i,
    extract: (match) => ({
      message: match[1],
      file: match[3],
      line: parseInt(match[2], 10),
      column: null,
    }),
  },
  // ESLint/Prettier style: path/file.ts:line:col: message
  {
    type: "javascript",
    pattern: /^(.+?\.[jt]sx?):(\d+):(\d+):\s*(.+)$/m,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      message: match[4],
    }),
  },
  // Generic stack trace: at Function (file:line:col)
  {
    type: "runtime",
    pattern: /at\s+(?:[\w.<>]+\s+)?\((.+?):(\d+):(\d+)\)/,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      message: "",
    }),
  },
  // Network errors (match ERR_ codes, Failed to load, CORS, fetch errors)
  {
    type: "network",
    pattern: /(?:Failed to load|net::|ERR_[A-Z_]+|CORS.*(?:policy|blocked|error)|fetch.*(?:error|failed))/i,
    extract: (match) => ({
      message: match[0],
    }),
  },
];

// =============================================================================
// ErrorAnalyzer Class
// =============================================================================

/**
 * Analyzes and parses error messages into structured format.
 *
 * @example
 * ```typescript
 * const analyzer = new ErrorAnalyzer();
 * const error = analyzer.analyze("src/app.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.");
 *
 * console.log(error.type);    // "typescript"
 * console.log(error.file);    // "src/app.ts"
 * console.log(error.line);    // 10
 * console.log(error.message); // "Type 'string' is not assignable to type 'number'."
 * console.log(error.context.code); // "TS2322"
 * ```
 */
export class ErrorAnalyzer {
  private options: Required<ErrorAnalyzerOptions>;

  constructor(options: ErrorAnalyzerOptions = {}) {
    this.options = {
      includeStack: options.includeStack ?? true,
      extractSnippets: options.extractSnippets ?? true,
      defaultFile: options.defaultFile ?? null,
    } as Required<ErrorAnalyzerOptions>;
  }

  /**
   * Analyze a raw error string and return structured error.
   */
  analyze(raw: string): StructuredError {
    const trimmed = raw.trim();

    // Try each pattern
    for (const patternDef of ERROR_PATTERNS) {
      const match = trimmed.match(patternDef.pattern);
      if (match) {
        const extracted = patternDef.extract(match, trimmed);
        return this.buildStructuredError(patternDef.type, extracted, trimmed);
      }
    }

    // Fallback: try to extract any location info
    return this.buildStructuredError("unknown", this.extractFallback(trimmed), trimmed);
  }

  /**
   * Analyze an Error object.
   */
  analyzeError(error: Error): StructuredError {
    const raw = error.stack || error.message;
    const result = this.analyze(raw);

    // Enhance with Error properties
    if (!result.message && error.message) {
      result.message = error.message;
    }

    if (this.options.includeStack && error.stack && !result.context.stack) {
      result.context.stack = error.stack;
    }

    // Detect error type from Error name - this is MORE RELIABLE than pattern matching
    // for actual Error objects, so always override if we get a specific type
    const detectedType = this.detectTypeFromErrorName(error.name);
    if (detectedType !== "unknown") {
      result.type = detectedType;
    }

    return result;
  }

  /**
   * Analyze multiple errors from a combined output.
   */
  analyzeMultiple(raw: string): StructuredError[] {
    const errors: StructuredError[] = [];
    const lines = raw.split("\n");

    let currentError: string[] = [];

    for (const line of lines) {
      // Check if this line starts a new error
      const isErrorStart = ERROR_PATTERNS.some((p) => p.pattern.test(line));

      if (isErrorStart && currentError.length > 0) {
        errors.push(this.analyze(currentError.join("\n")));
        currentError = [];
      }

      currentError.push(line);
    }

    // Process last error
    if (currentError.length > 0) {
      const joined = currentError.join("\n").trim();
      if (joined) {
        errors.push(this.analyze(joined));
      }
    }

    return errors.filter((e) => e.message || e.file);
  }

  /**
   * Extract location from a code snippet or caret indicator.
   */
  extractLocationFromSnippet(raw: string): { line: number; column: number } | null {
    // Look for caret indicators like "    ^" or "    ~~~"
    const caretMatch = raw.match(/\n(\s*)(\^+|~+)/);
    if (caretMatch) {
      return {
        line: 1, // Relative to snippet
        column: caretMatch[1].length + 1,
      };
    }

    // Look for line number indicators like "10 |"
    const lineIndicator = raw.match(/^\s*(\d+)\s*\|/m);
    if (lineIndicator) {
      return {
        line: parseInt(lineIndicator[1], 10),
        column: 1,
      };
    }

    return null;
  }

  /**
   * Build a complete StructuredError from partial data.
   */
  private buildStructuredError(
    type: ErrorType,
    partial: Partial<StructuredError>,
    raw: string
  ): StructuredError {
    const defaultContext: ErrorContext = {
      code: null,
      stack: null,
      sourceSnippet: null,
      related: [],
      suggestion: null,
      endLine: null,
      endColumn: null,
    };

    const context = { ...defaultContext, ...partial.context };

    // Extract source snippet if enabled
    if (this.options.extractSnippets && !context.sourceSnippet) {
      context.sourceSnippet = this.extractSourceSnippet(raw);
    }

    // Extract suggestion from error message
    if (!context.suggestion) {
      context.suggestion = this.extractSuggestion(raw);
    }

    return {
      type,
      file: partial.file ?? this.options.defaultFile,
      line: partial.line ?? null,
      column: partial.column ?? null,
      message: partial.message || this.extractMessage(raw),
      context,
      raw,
    };
  }

  /**
   * Fallback extraction for unknown error formats.
   */
  private extractFallback(raw: string): Partial<StructuredError> {
    // Try to find any file:line:col pattern
    const locationMatch = raw.match(/([^\s:]+\.[a-z]{1,4}):(\d+)(?::(\d+))?/i);

    return {
      file: locationMatch?.[1] || null,
      line: locationMatch?.[2] ? parseInt(locationMatch[2], 10) : null,
      column: locationMatch?.[3] ? parseInt(locationMatch[3], 10) : null,
      message: this.extractMessage(raw),
    };
  }

  /**
   * Extract clean message from raw error.
   */
  private extractMessage(raw: string): string {
    // Remove common prefixes
    let message = raw
      .replace(/^(Error|TypeError|ReferenceError|SyntaxError):\s*/i, "")
      .replace(/^\[.+?\]\s*/, "")
      .replace(/^.+?:\d+:\d+:\s*/, "");

    // Take first meaningful line
    const lines = message.split("\n");
    message = lines[0].trim();

    // Remove trailing location info
    message = message.replace(/\s+at\s+.+$/, "").trim();

    return message || raw.slice(0, 200);
  }

  /**
   * Extract source code snippet from error output.
   */
  private extractSourceSnippet(raw: string): string | null {
    // Look for code blocks with line numbers
    const snippetMatch = raw.match(/(\d+\s*\|[^\n]+(?:\n\s*\|[^\n]*)*)/);
    if (snippetMatch) {
      return snippetMatch[1];
    }

    // Look for indented code with caret
    const caretMatch = raw.match(/((?:^|\n)[ \t]+[^\n]+\n[ \t]+\^+)/);
    if (caretMatch) {
      return caretMatch[1].trim();
    }

    return null;
  }

  /**
   * Extract suggestion/fix from error message.
   */
  private extractSuggestion(raw: string): string | null {
    // Look for common suggestion patterns
    const patterns = [
      /Did you mean[:\s]+['"]?([^'"?\n]+)['"]?\??/i,
      /Try[:\s]+(.+?)(?:\.|$)/i,
      /Consider[:\s]+(.+?)(?:\.|$)/i,
      /Use\s+['"]?([^'"]+)['"]?\s+instead/i,
    ];

    for (const pattern of patterns) {
      const match = raw.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Detect error type from Error.name property.
   */
  private detectTypeFromErrorName(name: string): ErrorType {
    const nameMap: Record<string, ErrorType> = {
      TypeError: "type",
      ReferenceError: "reference",
      SyntaxError: "syntax",
      RangeError: "runtime",
      EvalError: "runtime",
      URIError: "runtime",
    };

    return nameMap[name] || "unknown";
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an ErrorAnalyzer instance.
 */
export function createErrorAnalyzer(options?: ErrorAnalyzerOptions): ErrorAnalyzer {
  return new ErrorAnalyzer(options);
}

/**
 * Quick analysis of a raw error string.
 */
export function analyzeError(raw: string, options?: ErrorAnalyzerOptions): StructuredError {
  const analyzer = new ErrorAnalyzer(options);
  return analyzer.analyze(raw);
}

/**
 * Analyze an Error object.
 */
export function analyzeErrorObject(error: Error, options?: ErrorAnalyzerOptions): StructuredError {
  const analyzer = new ErrorAnalyzer(options);
  return analyzer.analyzeError(error);
}

/**
 * Format a structured error for display.
 */
export function formatStructuredError(error: StructuredError): string {
  const parts: string[] = [];

  // Type prefix
  parts.push(`[${error.type.toUpperCase()}]`);

  // Location
  if (error.file) {
    let location = error.file;
    if (error.line != null) {
      location += `:${error.line}`;
      if (error.column != null) {
        location += `:${error.column}`;
      }
    }
    parts.push(location);
  }

  // Code
  if (error.context.code) {
    parts.push(`(${error.context.code})`);
  }

  // Message
  parts.push(error.message);

  let result = parts.join(" ");

  // Add suggestion
  if (error.context.suggestion) {
    result += `\n  → Suggestion: ${error.context.suggestion}`;
  }

  return result;
}

/**
 * Check if a string looks like an error message.
 */
export function isErrorMessage(text: string): boolean {
  const errorIndicators = [
    /error/i,
    /exception/i,
    /failed/i,
    /cannot/i,
    /unable/i,
    /invalid/i,
    /unexpected/i,
    /undefined/i,
    /null/i,
    /not found/i,
  ];

  return errorIndicators.some((pattern) => pattern.test(text));
}
