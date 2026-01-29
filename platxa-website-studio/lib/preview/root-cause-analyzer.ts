/**
 * Root Cause Analyzer — Trace Errors to Source
 *
 * Identifies the root cause of errors by analyzing error patterns
 * and tracing them back to their likely source (missing imports,
 * missing templates, etc.).
 */

// =============================================================================
// Types
// =============================================================================

/** Root cause categories */
export type RootCauseCategory =
  | "missing_import"
  | "missing_template"
  | "missing_variable"
  | "missing_file"
  | "syntax_error"
  | "type_error"
  | "configuration_error"
  | "dependency_error"
  | "unknown";

/** Confidence level for root cause identification */
export type ConfidenceLevel = "high" | "medium" | "low";

/** Identified root cause */
export interface RootCause {
  /** Root cause category */
  category: RootCauseCategory;
  /** Human-readable description */
  description: string;
  /** Confidence level */
  confidence: ConfidenceLevel;
  /** The identified source (variable, template, file, etc.) */
  source?: string;
  /** Suggested fix */
  suggestedFix?: string;
  /** Related file path */
  filePath?: string;
  /** Related line number */
  lineNumber?: number;
  /** Additional context */
  context?: Record<string, unknown>;
}

/** Error input for analysis */
export interface ErrorInput {
  /** Error message */
  message: string;
  /** Error type/name */
  type?: string;
  /** Source file */
  file?: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Stack trace */
  stack?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/** Root cause pattern definition */
export interface RootCausePattern {
  /** Pattern to match against error message */
  pattern: RegExp;
  /** Root cause category */
  category: RootCauseCategory;
  /** Confidence level when matched */
  confidence: ConfidenceLevel;
  /** Function to extract details from match */
  extract?: (match: RegExpMatchArray, error: ErrorInput) => Partial<RootCause>;
  /** Description template (use {1}, {2} for capture groups) */
  descriptionTemplate?: string;
  /** Fix template */
  fixTemplate?: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Category display configuration */
export const CATEGORY_CONFIG: Record<
  RootCauseCategory,
  { label: string; icon: string; color: string }
> = {
  missing_import: { label: "Missing Import", icon: "package-x", color: "text-orange-500" },
  missing_template: { label: "Missing Template", icon: "file-x", color: "text-red-500" },
  missing_variable: { label: "Undefined Variable", icon: "variable", color: "text-amber-500" },
  missing_file: { label: "Missing File", icon: "file-warning", color: "text-red-500" },
  syntax_error: { label: "Syntax Error", icon: "code", color: "text-red-600" },
  type_error: { label: "Type Error", icon: "type", color: "text-purple-500" },
  configuration_error: { label: "Configuration Error", icon: "settings", color: "text-blue-500" },
  dependency_error: { label: "Dependency Error", icon: "puzzle", color: "text-indigo-500" },
  unknown: { label: "Unknown", icon: "help-circle", color: "text-gray-500" },
};

/** Patterns for undefined variable errors → missing import */
export const UNDEFINED_VARIABLE_PATTERNS: RootCausePattern[] = [
  {
    pattern: /(?:NameError|ReferenceError):\s*(?:name\s*)?['"]?(\w+)['"]?\s*is not defined/i,
    category: "missing_import",
    confidence: "high",
    extract: (m) => ({
      source: m[1],
      description: `Variable '${m[1]}' is not defined - likely a missing import`,
      suggestedFix: `Add import statement for '${m[1]}' or define it before use`,
    }),
  },
  {
    pattern: /undefined variable\s*['"]?(\w+)['"]?/i,
    category: "missing_import",
    confidence: "high",
    extract: (m) => ({
      source: m[1],
      description: `Undefined variable '${m[1]}' - check imports`,
      suggestedFix: `Import '${m[1]}' from the appropriate module`,
    }),
  },
  {
    pattern: /(?:cannot\s+)?(?:find|resolve)\s+(?:name|symbol)\s*['"]?(\w+)['"]?/i,
    category: "missing_import",
    confidence: "medium",
    extract: (m) => ({
      source: m[1],
      description: `Cannot resolve '${m[1]}' - may need import`,
      suggestedFix: `Check if '${m[1]}' needs to be imported`,
    }),
  },
  {
    pattern: /(\w+)\s+is\s+not\s+(?:defined|declared)/i,
    category: "missing_variable",
    confidence: "medium",
    extract: (m) => ({
      source: m[1],
      description: `'${m[1]}' is not defined`,
      suggestedFix: `Define '${m[1]}' or import it from another module`,
    }),
  },
];

/** Patterns for t-call/template errors → missing template */
export const TEMPLATE_ERROR_PATTERNS: RootCausePattern[] = [
  {
    pattern: /t-call\s*['"]([^'"]+)['"]\s*(?:not found|does not exist|missing)/i,
    category: "missing_template",
    confidence: "high",
    extract: (m) => ({
      source: m[1],
      description: `Template '${m[1]}' referenced by t-call not found`,
      suggestedFix: `Create template '${m[1]}' or fix the t-call reference`,
    }),
  },
  {
    pattern: /template\s*['"]([^'"]+)['"]\s*(?:not found|does not exist|is missing)/i,
    category: "missing_template",
    confidence: "high",
    extract: (m) => ({
      source: m[1],
      description: `Template '${m[1]}' does not exist`,
      suggestedFix: `Create the template '${m[1]}' or correct the template name`,
    }),
  },
  {
    pattern: /(?:QWeb|qweb)\s*(?:error|exception).*template\s*['"]?([^'":\s]+)['"]?/i,
    category: "missing_template",
    confidence: "high",
    extract: (m) => ({
      source: m[1],
      description: `QWeb template error for '${m[1]}'`,
      suggestedFix: `Check that template '${m[1]}' exists and has valid syntax`,
    }),
  },
  {
    pattern: /(?:view|template)\s*['"]([^'"]+)['"]\s*(?:cannot be|could not be)\s*(?:found|rendered)/i,
    category: "missing_template",
    confidence: "medium",
    extract: (m) => ({
      source: m[1],
      description: `View/template '${m[1]}' cannot be found or rendered`,
      suggestedFix: `Verify template '${m[1]}' exists and is properly defined`,
    }),
  },
  {
    pattern: /invalid\s+(?:xpath|XPath).*['"]([^'"]+)['"]/i,
    category: "missing_template",
    confidence: "medium",
    extract: (m) => ({
      source: m[1],
      description: `Invalid XPath expression in template inheritance`,
      suggestedFix: `Check the XPath '${m[1]}' targets an existing element`,
    }),
  },
];

/** Patterns for missing file errors */
export const MISSING_FILE_PATTERNS: RootCausePattern[] = [
  {
    pattern: /(?:file|module)\s*['"]([^'"]+)['"]\s*(?:not found|does not exist|missing)/i,
    category: "missing_file",
    confidence: "high",
    extract: (m) => ({
      source: m[1],
      filePath: m[1],
      description: `File '${m[1]}' not found`,
      suggestedFix: `Create the file '${m[1]}' or correct the path`,
    }),
  },
  {
    pattern: /(?:cannot|could not)\s+(?:open|read|find|load)\s+['"]([^'"]+)['"]/i,
    category: "missing_file",
    confidence: "medium",
    extract: (m) => ({
      source: m[1],
      filePath: m[1],
      description: `Cannot access file '${m[1]}'`,
      suggestedFix: `Verify file '${m[1]}' exists and has correct permissions`,
    }),
  },
];

/** Patterns for syntax errors - ordered from most specific to least specific */
export const SYNTAX_ERROR_PATTERNS: RootCausePattern[] = [
  // Most specific: SyntaxError with file AND line number
  {
    pattern: /SyntaxError:\s*(.+?)\s+at\s+['"]([^'"]+)['"]\s+line\s+(\d+)/i,
    category: "syntax_error",
    confidence: "high",
    extract: (m) => ({
      description: `Syntax error: ${m[1]}`,
      filePath: m[2],
      lineNumber: parseInt(m[3]),
      suggestedFix: `Fix the syntax error at line ${m[3]} in ${m[2]}`,
    }),
  },
  // SyntaxError with file only (no line number)
  {
    pattern: /SyntaxError:\s*(.+?)\s+at\s+['"]([^'"]+)['"]/i,
    category: "syntax_error",
    confidence: "high",
    extract: (m) => ({
      description: `Syntax error: ${m[1]}`,
      filePath: m[2],
      suggestedFix: `Fix the syntax error in ${m[2]}`,
    }),
  },
  // SyntaxError with line number only (Python style: "line 42")
  {
    pattern: /SyntaxError:\s*(.+?)\s+line\s+(\d+)/i,
    category: "syntax_error",
    confidence: "high",
    extract: (m) => ({
      description: `Syntax error: ${m[1]}`,
      lineNumber: parseInt(m[2]),
      suggestedFix: `Fix the syntax error at line ${m[2]}`,
    }),
  },
  // Simple SyntaxError (least specific, matches any SyntaxError)
  {
    pattern: /SyntaxError:\s*(.+)/i,
    category: "syntax_error",
    confidence: "medium",
    extract: (m) => ({
      description: `Syntax error: ${m[1]}`,
      suggestedFix: `Fix the syntax error: ${m[1]}`,
    }),
  },
  {
    pattern: /unexpected\s+(?:token|character)\s*['"]?([^'"]+)['"]?/i,
    category: "syntax_error",
    confidence: "high",
    extract: (m) => ({
      source: m[1],
      description: `Unexpected token '${m[1]}'`,
      suggestedFix: `Remove or fix the unexpected token '${m[1]}'`,
    }),
  },
];

/** Patterns for type errors */
export const TYPE_ERROR_PATTERNS: RootCausePattern[] = [
  {
    pattern: /TypeError:\s*['"]?(\w+)['"]?\s*(?:is not|has no)\s*(?:a\s+)?(?:function|method|callable)/i,
    category: "type_error",
    confidence: "high",
    extract: (m) => ({
      source: m[1],
      description: `'${m[1]}' is not callable`,
      suggestedFix: `Check that '${m[1]}' is defined as a function`,
    }),
  },
  {
    pattern: /(?:cannot|can't)\s+read\s+propert(?:y|ies)\s+['"]?(\w+)['"]?\s+of\s+(?:undefined|null)/i,
    category: "type_error",
    confidence: "high",
    extract: (m) => ({
      source: m[1],
      description: `Cannot access '${m[1]}' of undefined/null`,
      suggestedFix: `Add null check before accessing '${m[1]}'`,
    }),
  },
  {
    pattern: /AttributeError:\s*['"]?(\w+)['"]?\s*object has no attribute\s*['"]?(\w+)['"]?/i,
    category: "type_error",
    confidence: "high",
    extract: (m) => ({
      source: m[2],
      description: `'${m[1]}' has no attribute '${m[2]}'`,
      suggestedFix: `Check that '${m[2]}' exists on '${m[1]}' objects`,
    }),
  },
];

/** All patterns combined */
export const ALL_ROOT_CAUSE_PATTERNS: RootCausePattern[] = [
  ...UNDEFINED_VARIABLE_PATTERNS,
  ...TEMPLATE_ERROR_PATTERNS,
  ...MISSING_FILE_PATTERNS,
  ...SYNTAX_ERROR_PATTERNS,
  ...TYPE_ERROR_PATTERNS,
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Analyzes an error and identifies its root cause.
 */
export function analyzeError(
  error: ErrorInput,
  patterns: RootCausePattern[] = ALL_ROOT_CAUSE_PATTERNS
): RootCause | null {
  const text = `${error.message} ${error.stack || ""}`;

  for (const pattern of patterns) {
    const match = text.match(pattern.pattern);
    if (match) {
      const extracted = pattern.extract ? pattern.extract(match, error) : {};

      return {
        category: pattern.category,
        confidence: pattern.confidence,
        description: extracted.description || `Matched pattern for ${pattern.category}`,
        source: extracted.source,
        suggestedFix: extracted.suggestedFix,
        filePath: extracted.filePath || error.file,
        lineNumber: extracted.lineNumber || error.line,
        context: error.context,
      };
    }
  }

  return null;
}

/**
 * Traces an undefined variable error to a missing import.
 */
export function traceUndefinedVariable(
  variableName: string,
  error: ErrorInput
): RootCause {
  return {
    category: "missing_import",
    confidence: "high",
    description: `Variable '${variableName}' is undefined - likely missing import`,
    source: variableName,
    suggestedFix: `Add: import { ${variableName} } from 'module' or define ${variableName}`,
    filePath: error.file,
    lineNumber: error.line,
  };
}

/**
 * Traces a t-call error to a missing template.
 */
export function traceTCallError(
  templateName: string,
  error: ErrorInput
): RootCause {
  return {
    category: "missing_template",
    confidence: "high",
    description: `Template '${templateName}' referenced by t-call not found`,
    source: templateName,
    suggestedFix: `Create template '${templateName}' in views/ or fix the t-call reference`,
    filePath: error.file,
    lineNumber: error.line,
  };
}

/**
 * Extracts variable name from an error message.
 */
export function extractVariableName(message: string): string | null {
  const patterns = [
    /['"](\w+)['"]\s*is not defined/i,
    /name\s*['"](\w+)['"]\s*is not defined/i,
    /undefined variable\s*['"]?(\w+)['"]?/i,
    /(\w+)\s+is\s+not\s+defined/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Extracts template name from an error message.
 */
export function extractTemplateName(message: string): string | null {
  const patterns = [
    /t-call\s*['"]([^'"]+)['"]/i,
    /template\s*['"]([^'"]+)['"]/i,
    /(?:view|template)\s*['"]([^'"]+)['"]/i,
    /QWeb.*template\s*['"]?([^'":\s]+)['"]?/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Gets the confidence score as a number (for sorting).
 */
export function getConfidenceScore(confidence: ConfidenceLevel): number {
  const scores: Record<ConfidenceLevel, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };
  return scores[confidence];
}

/**
 * Formats a root cause for display.
 */
export function formatRootCause(rootCause: RootCause): string {
  const parts = [
    `[${CATEGORY_CONFIG[rootCause.category].label}] ${rootCause.description}`,
  ];

  if (rootCause.filePath) {
    let location = `  File: ${rootCause.filePath}`;
    if (rootCause.lineNumber) {
      location += `:${rootCause.lineNumber}`;
    }
    parts.push(location);
  }

  if (rootCause.suggestedFix) {
    parts.push(`  Fix: ${rootCause.suggestedFix}`);
  }

  parts.push(`  Confidence: ${rootCause.confidence}`);

  return parts.join("\n");
}

/**
 * Checks if an error is likely caused by a missing import.
 */
export function isMissingImportError(message: string): boolean {
  return UNDEFINED_VARIABLE_PATTERNS.some((p) => p.pattern.test(message));
}

/**
 * Checks if an error is likely caused by a missing template.
 */
export function isMissingTemplateError(message: string): boolean {
  return TEMPLATE_ERROR_PATTERNS.some((p) => p.pattern.test(message));
}

// =============================================================================
// RootCauseAnalyzer Class
// =============================================================================

/**
 * Service for analyzing errors and identifying root causes.
 */
export class RootCauseAnalyzer {
  private patterns: RootCausePattern[];
  private analysisCache: Map<string, RootCause | null> = new Map();

  constructor(customPatterns: RootCausePattern[] = []) {
    this.patterns = [...ALL_ROOT_CAUSE_PATTERNS, ...customPatterns];
  }

  /**
   * Analyzes an error and returns the identified root cause.
   */
  analyze(error: ErrorInput): RootCause | null {
    const cacheKey = `${error.message}|${error.file}|${error.line}`;

    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey) || null;
    }

    const rootCause = analyzeError(error, this.patterns);
    this.analysisCache.set(cacheKey, rootCause);

    return rootCause;
  }

  /**
   * Analyzes multiple errors and returns all identified root causes.
   */
  analyzeAll(errors: ErrorInput[]): RootCause[] {
    const causes: RootCause[] = [];

    for (const error of errors) {
      const cause = this.analyze(error);
      if (cause) {
        causes.push(cause);
      }
    }

    return causes;
  }

  /**
   * Clears the analysis cache.
   */
  clearCache(): void {
    this.analysisCache.clear();
  }

  /**
   * Adds custom patterns.
   */
  addPatterns(patterns: RootCausePattern[]): void {
    this.patterns.push(...patterns);
  }

  /**
   * Gets the most likely root cause from multiple errors.
   */
  getMostLikelyCause(errors: ErrorInput[]): RootCause | null {
    const causes = this.analyzeAll(errors);
    if (causes.length === 0) return null;

    // Sort by confidence (high first)
    causes.sort((a, b) => getConfidenceScore(b.confidence) - getConfidenceScore(a.confidence));

    return causes[0];
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a RootCauseAnalyzer instance.
 */
export function createRootCauseAnalyzer(
  customPatterns?: RootCausePattern[]
): RootCauseAnalyzer {
  return new RootCauseAnalyzer(customPatterns);
}
