/**
 * Error Categorization — Syntax, Reference, Type, Runtime, Structure
 *
 * Categorizes errors into specific types and provides category-specific
 * fix approaches for each error type.
 */

// =============================================================================
// Types
// =============================================================================

/** Error categories */
export type ErrorCategory =
  | "syntax"
  | "reference"
  | "type"
  | "runtime"
  | "structure";

/** Fix approach types */
export type FixApproach =
  | "correct_syntax"
  | "add_import"
  | "define_variable"
  | "fix_type_mismatch"
  | "add_null_check"
  | "fix_logic"
  | "handle_exception"
  | "fix_structure"
  | "fix_hierarchy";

/** Category configuration */
export interface CategoryConfig {
  /** Category name */
  name: string;
  /** Human-readable label */
  label: string;
  /** Description of this category */
  description: string;
  /** Icon identifier */
  icon: string;
  /** Color class */
  color: string;
  /** Severity level */
  severity: "low" | "medium" | "high" | "critical";
  /** Primary fix approaches for this category */
  fixApproaches: FixApproach[];
}

/** Fix approach configuration */
export interface FixApproachConfig {
  /** Approach name */
  name: string;
  /** Human-readable label */
  label: string;
  /** Description of this approach */
  description: string;
  /** Template for generating fix suggestions */
  template: string;
}

/** Categorized error */
export interface CategorizedError {
  /** Original error message */
  message: string;
  /** Assigned category */
  category: ErrorCategory;
  /** Confidence of categorization */
  confidence: number;
  /** Recommended fix approaches */
  fixApproaches: FixApproach[];
  /** Primary suggested fix */
  suggestedFix: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/** Categorization pattern */
export interface CategorizationPattern {
  /** Pattern to match */
  pattern: RegExp;
  /** Target category */
  category: ErrorCategory;
  /** Confidence score (0-1) */
  confidence: number;
  /** Extract additional info */
  extract?: (match: RegExpMatchArray) => Record<string, unknown>;
}

// =============================================================================
// Constants
// =============================================================================

/** Category configurations */
export const CATEGORY_CONFIG: Record<ErrorCategory, CategoryConfig> = {
  syntax: {
    name: "syntax",
    label: "Syntax Error",
    description: "Errors in code syntax, parsing, or formatting",
    icon: "code",
    color: "text-red-600",
    severity: "high",
    fixApproaches: ["correct_syntax"],
  },
  reference: {
    name: "reference",
    label: "Reference Error",
    description: "Errors from undefined variables, missing imports, or unresolved references",
    icon: "link-off",
    color: "text-orange-500",
    severity: "high",
    fixApproaches: ["add_import", "define_variable"],
  },
  type: {
    name: "type",
    label: "Type Error",
    description: "Errors from type mismatches, null/undefined access, or invalid operations",
    icon: "type",
    color: "text-purple-500",
    severity: "medium",
    fixApproaches: ["fix_type_mismatch", "add_null_check"],
  },
  runtime: {
    name: "runtime",
    label: "Runtime Error",
    description: "Errors that occur during execution, including logic errors and exceptions",
    icon: "play-circle",
    color: "text-yellow-500",
    severity: "medium",
    fixApproaches: ["fix_logic", "handle_exception"],
  },
  structure: {
    name: "structure",
    label: "Structure Error",
    description: "Errors in code structure, hierarchy, or organization",
    icon: "layers",
    color: "text-blue-500",
    severity: "low",
    fixApproaches: ["fix_structure", "fix_hierarchy"],
  },
};

/** Fix approach configurations */
export const FIX_APPROACH_CONFIG: Record<FixApproach, FixApproachConfig> = {
  correct_syntax: {
    name: "correct_syntax",
    label: "Correct Syntax",
    description: "Fix syntax errors by correcting code formatting",
    template: "Fix the syntax error: {details}",
  },
  add_import: {
    name: "add_import",
    label: "Add Import",
    description: "Add missing import statement",
    template: "Add import for '{identifier}'",
  },
  define_variable: {
    name: "define_variable",
    label: "Define Variable",
    description: "Define the missing variable or constant",
    template: "Define '{identifier}' before use",
  },
  fix_type_mismatch: {
    name: "fix_type_mismatch",
    label: "Fix Type Mismatch",
    description: "Correct type mismatches in assignments or function calls",
    template: "Convert '{value}' to expected type '{expectedType}'",
  },
  add_null_check: {
    name: "add_null_check",
    label: "Add Null Check",
    description: "Add null/undefined check before property access",
    template: "Add null check before accessing '{property}'",
  },
  fix_logic: {
    name: "fix_logic",
    label: "Fix Logic",
    description: "Correct logical errors in code flow",
    template: "Review and fix the logic: {details}",
  },
  handle_exception: {
    name: "handle_exception",
    label: "Handle Exception",
    description: "Add proper exception handling",
    template: "Add try-catch block to handle: {exceptionType}",
  },
  fix_structure: {
    name: "fix_structure",
    label: "Fix Structure",
    description: "Correct code structure issues",
    template: "Reorganize code structure: {details}",
  },
  fix_hierarchy: {
    name: "fix_hierarchy",
    label: "Fix Hierarchy",
    description: "Correct inheritance or component hierarchy",
    template: "Fix the hierarchy: {details}",
  },
};

/** Patterns for syntax errors */
export const SYNTAX_PATTERNS: CategorizationPattern[] = [
  {
    pattern: /SyntaxError/i,
    category: "syntax",
    confidence: 1.0,
  },
  {
    pattern: /unexpected\s+(?:token|character|end)/i,
    category: "syntax",
    confidence: 0.95,
  },
  {
    pattern: /(?:invalid|illegal)\s+(?:syntax|character|token)/i,
    category: "syntax",
    confidence: 0.95,
  },
  {
    pattern: /(?:missing|expected)\s+['"]?[;:,{}()\[\]]?['"]?/i,
    category: "syntax",
    confidence: 0.9,
  },
  {
    pattern: /(?:unterminated|unclosed)\s+(?:string|bracket|parenthesis|brace)/i,
    category: "syntax",
    confidence: 0.95,
  },
  {
    pattern: /parse\s+error/i,
    category: "syntax",
    confidence: 0.9,
  },
  {
    pattern: /IndentationError/i,
    category: "syntax",
    confidence: 1.0,
  },
];

/** Patterns for reference errors */
export const REFERENCE_PATTERNS: CategorizationPattern[] = [
  {
    pattern: /ReferenceError/i,
    category: "reference",
    confidence: 1.0,
  },
  {
    pattern: /NameError/i,
    category: "reference",
    confidence: 1.0,
  },
  {
    pattern: /(?:is\s+)?not\s+defined/i,
    category: "reference",
    confidence: 0.95,
  },
  {
    pattern: /(?:cannot|can't)\s+(?:find|resolve)\s+(?:module|name|symbol)/i,
    category: "reference",
    confidence: 0.95,
  },
  {
    pattern: /ImportError/i,
    category: "reference",
    confidence: 1.0,
  },
  {
    pattern: /ModuleNotFoundError/i,
    category: "reference",
    confidence: 1.0,
  },
  {
    pattern: /no\s+module\s+named/i,
    category: "reference",
    confidence: 0.95,
  },
  {
    pattern: /undefined\s+(?:variable|identifier|symbol)/i,
    category: "reference",
    confidence: 0.95,
  },
];

/** Patterns for type errors */
export const TYPE_PATTERNS: CategorizationPattern[] = [
  {
    pattern: /TypeError/i,
    category: "type",
    confidence: 1.0,
  },
  {
    pattern: /AttributeError/i,
    category: "type",
    confidence: 0.95,
  },
  {
    // Matches: "Cannot read property 'x' of undefined", "can't read properties of null"
    pattern: /(?:cannot|can't)\s+read\s+propert(?:y|ies)\s+(?:['"]?\w+['"]?\s+)?of\s+(?:undefined|null)/i,
    category: "type",
    confidence: 1.0,
  },
  {
    pattern: /is\s+not\s+(?:a\s+)?(?:function|callable|iterable)/i,
    category: "type",
    confidence: 0.95,
  },
  {
    pattern: /(?:type|expected)\s+['"]?\w+['"]?\s+(?:but\s+)?(?:got|received|found)/i,
    category: "type",
    confidence: 0.9,
  },
  {
    pattern: /(?:invalid|incompatible)\s+type/i,
    category: "type",
    confidence: 0.9,
  },
  {
    pattern: /has\s+no\s+(?:attribute|property|method)/i,
    category: "type",
    confidence: 0.9,
  },
  {
    pattern: /(?:null|undefined)\s+(?:is\s+not|has\s+no)/i,
    category: "type",
    confidence: 0.95,
  },
];

/** Patterns for runtime errors */
export const RUNTIME_PATTERNS: CategorizationPattern[] = [
  {
    pattern: /RuntimeError/i,
    category: "runtime",
    confidence: 1.0,
  },
  {
    pattern: /(?:index|key)\s*(?:out\s+of\s+(?:range|bounds)|error)/i,
    category: "runtime",
    confidence: 0.95,
  },
  {
    pattern: /(?:division|divide)\s+by\s+zero/i,
    category: "runtime",
    confidence: 1.0,
  },
  {
    pattern: /(?:stack\s+)?overflow/i,
    category: "runtime",
    confidence: 0.9,
  },
  {
    pattern: /(?:memory|heap)\s+(?:error|exhausted|exceeded)/i,
    category: "runtime",
    confidence: 0.95,
  },
  {
    pattern: /(?:timeout|timed\s+out)/i,
    category: "runtime",
    confidence: 0.85,
  },
  {
    pattern: /(?:assertion|assert)\s+(?:failed|error)/i,
    category: "runtime",
    confidence: 0.9,
  },
  {
    pattern: /(?:infinite|endless)\s+loop/i,
    category: "runtime",
    confidence: 0.85,
  },
  {
    pattern: /(?:unhandled|uncaught)\s+(?:exception|error|rejection)/i,
    category: "runtime",
    confidence: 0.9,
  },
];

/** Patterns for structure errors */
export const STRUCTURE_PATTERNS: CategorizationPattern[] = [
  {
    pattern: /(?:circular|cyclic)\s+(?:dependency|import|reference)/i,
    category: "structure",
    confidence: 0.95,
  },
  {
    pattern: /(?:invalid|broken)\s+(?:inheritance|hierarchy)/i,
    category: "structure",
    confidence: 0.9,
  },
  {
    pattern: /(?:class|interface)\s+(?:not\s+found|missing)/i,
    category: "structure",
    confidence: 0.85,
  },
  {
    // Matches: "Abstract method 'render' not implemented", "interface property not implemented"
    pattern: /(?:abstract|interface)\s+(?:method|property)\s+(?:['"]?\w+['"]?\s+)?not\s+implemented/i,
    category: "structure",
    confidence: 0.95,
  },
  {
    pattern: /(?:duplicate|conflicting)\s+(?:definition|declaration)/i,
    category: "structure",
    confidence: 0.9,
  },
  {
    pattern: /(?:invalid|malformed)\s+(?:manifest|config|schema)/i,
    category: "structure",
    confidence: 0.85,
  },
  {
    pattern: /(?:missing|required)\s+(?:field|property|attribute)/i,
    category: "structure",
    confidence: 0.8,
  },
];

/** All categorization patterns */
export const ALL_PATTERNS: CategorizationPattern[] = [
  ...SYNTAX_PATTERNS,
  ...REFERENCE_PATTERNS,
  ...TYPE_PATTERNS,
  ...RUNTIME_PATTERNS,
  ...STRUCTURE_PATTERNS,
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Categorizes an error message.
 */
export function categorizeError(message: string): CategorizedError | null {
  let bestMatch: {
    pattern: CategorizationPattern;
    match: RegExpMatchArray;
  } | null = null;

  for (const pattern of ALL_PATTERNS) {
    const match = message.match(pattern.pattern);
    if (match) {
      if (!bestMatch || pattern.confidence > bestMatch.pattern.confidence) {
        bestMatch = { pattern, match };
      }
    }
  }

  if (!bestMatch) {
    return null;
  }

  const { pattern, match } = bestMatch;
  const config = CATEGORY_CONFIG[pattern.category];
  const context = pattern.extract ? pattern.extract(match) : {};

  return {
    message,
    category: pattern.category,
    confidence: pattern.confidence,
    fixApproaches: config.fixApproaches,
    suggestedFix: generateSuggestedFix(pattern.category, message, context),
    context,
  };
}

/**
 * Generates a suggested fix based on category.
 */
export function generateSuggestedFix(
  category: ErrorCategory,
  message: string,
  context: Record<string, unknown> = {}
): string {
  const config = CATEGORY_CONFIG[category];
  const primaryApproach = config.fixApproaches[0];
  const approachConfig = FIX_APPROACH_CONFIG[primaryApproach];

  switch (category) {
    case "syntax":
      return `Fix the syntax error. Check for missing brackets, quotes, or semicolons.`;

    case "reference": {
      const identifier = extractIdentifier(message);
      return identifier
        ? `Add import or define '${identifier}' before use.`
        : `Check that all referenced variables and modules are defined.`;
    }

    case "type": {
      const property = extractProperty(message);
      return property
        ? `Add null check before accessing '${property}' or verify the type.`
        : `Check type compatibility and add appropriate type guards.`;
    }

    case "runtime":
      return `Add error handling and validate inputs to prevent runtime errors.`;

    case "structure":
      return `Review code organization and ensure proper structure/hierarchy.`;

    default:
      return approachConfig.template;
  }
}

/**
 * Extracts an identifier from an error message.
 */
export function extractIdentifier(message: string): string | null {
  const patterns = [
    /['"](\w+)['"]\s+is\s+not\s+defined/i,
    /name\s+['"](\w+)['"]/i,
    /module\s+['"]([^'"]+)['"]/i,
    /(?:cannot|can't)\s+find\s+['"]?(\w+)['"]?/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Extracts a property name from an error message.
 */
export function extractProperty(message: string): string | null {
  const patterns = [
    /property\s+['"](\w+)['"]/i,
    /attribute\s+['"](\w+)['"]/i,
    /read\s+['"]?(\w+)['"]?\s+of/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Gets the fix approaches for a category.
 */
export function getFixApproaches(category: ErrorCategory): FixApproachConfig[] {
  const config = CATEGORY_CONFIG[category];
  return config.fixApproaches.map((approach) => FIX_APPROACH_CONFIG[approach]);
}

/**
 * Checks if an error is a syntax error.
 */
export function isSyntaxError(message: string): boolean {
  return SYNTAX_PATTERNS.some((p) => p.pattern.test(message));
}

/**
 * Checks if an error is a reference error.
 */
export function isReferenceError(message: string): boolean {
  return REFERENCE_PATTERNS.some((p) => p.pattern.test(message));
}

/**
 * Checks if an error is a type error.
 */
export function isTypeError(message: string): boolean {
  return TYPE_PATTERNS.some((p) => p.pattern.test(message));
}

/**
 * Checks if an error is a runtime error.
 */
export function isRuntimeError(message: string): boolean {
  return RUNTIME_PATTERNS.some((p) => p.pattern.test(message));
}

/**
 * Checks if an error is a structure error.
 */
export function isStructureError(message: string): boolean {
  return STRUCTURE_PATTERNS.some((p) => p.pattern.test(message));
}

/**
 * Gets category statistics from a list of errors.
 */
export function getCategoryStats(
  errors: string[]
): Record<ErrorCategory, number> {
  const stats: Record<ErrorCategory, number> = {
    syntax: 0,
    reference: 0,
    type: 0,
    runtime: 0,
    structure: 0,
  };

  for (const error of errors) {
    const categorized = categorizeError(error);
    if (categorized) {
      stats[categorized.category]++;
    }
  }

  return stats;
}

/**
 * Formats a categorized error for display.
 */
export function formatCategorizedError(error: CategorizedError): string {
  const config = CATEGORY_CONFIG[error.category];
  const parts = [
    `[${config.label}] (${Math.round(error.confidence * 100)}% confidence)`,
    `Message: ${error.message}`,
    `Suggested Fix: ${error.suggestedFix}`,
    `Approaches: ${error.fixApproaches.map((a) => FIX_APPROACH_CONFIG[a].label).join(", ")}`,
  ];

  return parts.join("\n");
}

// =============================================================================
// ErrorCategorizer Class
// =============================================================================

/**
 * Service for categorizing errors and suggesting fixes.
 */
export class ErrorCategorizer {
  private patterns: CategorizationPattern[];
  private cache: Map<string, CategorizedError | null> = new Map();

  constructor(customPatterns: CategorizationPattern[] = []) {
    this.patterns = [...ALL_PATTERNS, ...customPatterns];
  }

  /**
   * Categorizes an error message.
   */
  categorize(message: string): CategorizedError | null {
    if (this.cache.has(message)) {
      return this.cache.get(message) || null;
    }

    const result = this.findBestMatch(message);
    this.cache.set(message, result);
    return result;
  }

  /**
   * Finds the best matching pattern.
   */
  private findBestMatch(message: string): CategorizedError | null {
    let bestMatch: {
      pattern: CategorizationPattern;
      match: RegExpMatchArray;
    } | null = null;

    for (const pattern of this.patterns) {
      const match = message.match(pattern.pattern);
      if (match) {
        if (!bestMatch || pattern.confidence > bestMatch.pattern.confidence) {
          bestMatch = { pattern, match };
        }
      }
    }

    if (!bestMatch) {
      return null;
    }

    const { pattern, match } = bestMatch;
    const config = CATEGORY_CONFIG[pattern.category];
    const context = pattern.extract ? pattern.extract(match) : {};

    return {
      message,
      category: pattern.category,
      confidence: pattern.confidence,
      fixApproaches: config.fixApproaches,
      suggestedFix: generateSuggestedFix(pattern.category, message, context),
      context,
    };
  }

  /**
   * Categorizes multiple errors.
   */
  categorizeAll(messages: string[]): CategorizedError[] {
    const results: CategorizedError[] = [];

    for (const message of messages) {
      const result = this.categorize(message);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Gets fix approaches for an error.
   */
  getFixApproachesFor(message: string): FixApproachConfig[] {
    const categorized = this.categorize(message);
    if (!categorized) return [];

    return categorized.fixApproaches.map((a) => FIX_APPROACH_CONFIG[a]);
  }

  /**
   * Clears the cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Adds custom patterns.
   */
  addPatterns(patterns: CategorizationPattern[]): void {
    this.patterns.push(...patterns);
    this.clearCache();
  }

  /**
   * Gets statistics for a list of errors.
   */
  getStats(messages: string[]): {
    total: number;
    categorized: number;
    uncategorized: number;
    byCategory: Record<ErrorCategory, number>;
  } {
    const byCategory: Record<ErrorCategory, number> = {
      syntax: 0,
      reference: 0,
      type: 0,
      runtime: 0,
      structure: 0,
    };

    let categorized = 0;

    for (const message of messages) {
      const result = this.categorize(message);
      if (result) {
        categorized++;
        byCategory[result.category]++;
      }
    }

    return {
      total: messages.length,
      categorized,
      uncategorized: messages.length - categorized,
      byCategory,
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates an ErrorCategorizer instance.
 */
export function createErrorCategorizer(
  customPatterns?: CategorizationPattern[]
): ErrorCategorizer {
  return new ErrorCategorizer(customPatterns);
}
