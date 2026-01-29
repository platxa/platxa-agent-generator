/**
 * AutoFixer - Generates targeted fixes for categorized errors
 *
 * Uses ErrorPatternLibrary to match error patterns and generate
 * context-aware fix suggestions based on error category.
 */

import {
  ErrorPatternLibrary,
  matchErrorPattern,
  matchAllErrorPatterns,
  type ErrorPattern,
  type ErrorCategory,
  type PatternMatch,
  type PatternMatchOptions,
} from "./error-pattern-library";

import {
  extractErrorLocation,
  type ErrorLocation,
} from "./error-location-extractor";

// =============================================================================
// Types
// =============================================================================

/** Context information for generating fixes */
export interface FixContext {
  /** File path where error occurred */
  file?: string;
  /** Line number (1-based) */
  line?: number;
  /** Column number (1-based) */
  column?: number;
  /** Code snippet around the error */
  codeSnippet?: string;
  /** Additional context variables for fix templates */
  variables?: Record<string, string>;
}

/** A single fix suggestion */
export interface FixSuggestion {
  /** Unique ID for the fix */
  id: string;
  /** Human-readable title */
  title: string;
  /** Detailed description of the fix */
  description: string;
  /** The actual fix to apply (code, command, or instruction) */
  fix: string;
  /** Type of fix */
  type: FixType;
  /** Priority (1 = highest) */
  priority: number;
  /** Confidence in the fix (0-1) */
  confidence: number;
  /** Category of the error this fixes */
  category: ErrorCategory;
  /** Original pattern that was matched */
  patternId: string;
  /** Location where fix should be applied */
  location?: ErrorLocation;
}

/** Types of fixes that can be generated */
export type FixType =
  | "code-change"      // Direct code modification
  | "add-code"         // Add new code
  | "remove-code"      // Remove code
  | "import-add"       // Add import statement
  | "variable-define"  // Define missing variable
  | "syntax-fix"       // Fix syntax error
  | "instruction"      // Manual instruction for user
  | "configuration";   // Configuration change

/** Result of auto-fix generation */
export interface AutoFixResult {
  /** Original error message */
  errorMessage: string;
  /** Extracted location from error */
  location: ErrorLocation;
  /** Pattern that matched (if any) */
  matchedPattern: ErrorPattern | null;
  /** Generated fix suggestions (sorted by priority) */
  suggestions: FixSuggestion[];
  /** Whether any pattern matched */
  hasMatch: boolean;
  /** Category of the matched error */
  category: ErrorCategory | null;
}

/** Options for AutoFixer */
export interface AutoFixerOptions {
  /** Maximum number of suggestions to return */
  maxSuggestions?: number;
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Filter by categories */
  categories?: ErrorCategory[];
  /** Include generic fallback suggestions */
  includeFallbacks?: boolean;
}

// =============================================================================
// Category-specific fix generators
// =============================================================================

type FixGenerator = (
  pattern: ErrorPattern,
  match: PatternMatch,
  context: FixContext
) => FixSuggestion[];

const CATEGORY_FIX_GENERATORS: Partial<Record<ErrorCategory, FixGenerator>> = {
  "qweb-directive": (pattern, match, context) => {
    const suggestions: FixSuggestion[] = [];
    const baseFix = createBaseFix(pattern, match, context);

    // Add directive-specific fixes
    if (pattern.id.includes("t-foreach") || pattern.id.includes("t-as")) {
      suggestions.push({
        ...baseFix,
        id: `${pattern.id}-add-directive`,
        type: "add-code",
        fix: match.suggestedFix,
      });
    } else if (pattern.id.includes("t-if") || pattern.id.includes("elif") || pattern.id.includes("else")) {
      suggestions.push({
        ...baseFix,
        id: `${pattern.id}-fix-conditional`,
        type: "code-change",
        fix: match.suggestedFix,
      });
    } else if (pattern.id.includes("t-call")) {
      suggestions.push({
        ...baseFix,
        id: `${pattern.id}-check-template`,
        type: "instruction",
        fix: match.suggestedFix,
      });
    } else {
      suggestions.push(baseFix);
    }

    return suggestions;
  },

  "qweb-syntax": (pattern, match, context) => {
    const baseFix = createBaseFix(pattern, match, context);
    return [{
      ...baseFix,
      type: "syntax-fix",
    }];
  },

  "qweb-expression": (pattern, match, context) => {
    const baseFix = createBaseFix(pattern, match, context);
    return [{
      ...baseFix,
      type: "syntax-fix",
    }];
  },

  "scss-variable": (pattern, match, context) => {
    const suggestions: FixSuggestion[] = [];
    const baseFix = createBaseFix(pattern, match, context);

    if (pattern.id.includes("undefined")) {
      // Suggest defining the variable
      const varName = match.captures[0] || "variable";
      suggestions.push({
        ...baseFix,
        id: `${pattern.id}-define`,
        type: "variable-define",
        title: `Define missing variable $${varName}`,
        fix: `$${varName}: <value>; // Add to your variables file`,
      });

      // Also suggest importing a file that might have it
      suggestions.push({
        ...baseFix,
        id: `${pattern.id}-import`,
        type: "import-add",
        title: "Import file containing the variable",
        fix: `@import 'variables'; // Import the file defining $${varName}`,
        priority: baseFix.priority + 1,
      });
    } else {
      suggestions.push(baseFix);
    }

    return suggestions;
  },

  "scss-syntax": (pattern, match, context) => {
    const baseFix = createBaseFix(pattern, match, context);
    return [{
      ...baseFix,
      type: "syntax-fix",
    }];
  },

  "scss-mixin": (pattern, match, context) => {
    const suggestions: FixSuggestion[] = [];
    const baseFix = createBaseFix(pattern, match, context);

    if (pattern.id.includes("undefined")) {
      const mixinName = match.captures[0] || "mixin";
      suggestions.push({
        ...baseFix,
        id: `${pattern.id}-define`,
        type: "add-code",
        title: `Define mixin ${mixinName}`,
        fix: `@mixin ${mixinName}() {\n  // Add mixin content\n}`,
      });
    } else {
      suggestions.push(baseFix);
    }

    return suggestions;
  },

  "scss-function": (pattern, match, context) => {
    const suggestions: FixSuggestion[] = [];
    const baseFix = createBaseFix(pattern, match, context);

    if (pattern.id.includes("undefined")) {
      const funcName = match.captures[0] || "function";
      suggestions.push({
        ...baseFix,
        id: `${pattern.id}-define`,
        type: "add-code",
        title: `Define function ${funcName}`,
        fix: `@function ${funcName}() {\n  @return <value>;\n}`,
      });
    } else {
      suggestions.push(baseFix);
    }

    return suggestions;
  },

  "scss-import": (pattern, match, context) => {
    const baseFix = createBaseFix(pattern, match, context);
    return [{
      ...baseFix,
      type: "configuration",
      title: "Fix import path",
    }];
  },

  "odoo-field": (pattern, match, context) => {
    const baseFix = createBaseFix(pattern, match, context);
    return [{
      ...baseFix,
      type: "instruction",
      title: "Check field definition",
    }];
  },

  "odoo-model": (pattern, match, context) => {
    const baseFix = createBaseFix(pattern, match, context);
    return [{
      ...baseFix,
      type: "instruction",
      title: "Check model registration",
    }];
  },

  "odoo-view": (pattern, match, context) => {
    const baseFix = createBaseFix(pattern, match, context);
    return [{
      ...baseFix,
      type: "instruction",
      title: "Check view XML ID",
    }];
  },
};

/**
 * Create a base fix suggestion from pattern match
 */
function createBaseFix(
  pattern: ErrorPattern,
  match: PatternMatch,
  context: FixContext
): FixSuggestion {
  return {
    id: pattern.id,
    title: pattern.name,
    description: pattern.description,
    fix: match.suggestedFix,
    type: "code-change",
    priority: pattern.severity === "error" ? 1 : pattern.severity === "warning" ? 2 : 3,
    confidence: match.confidence,
    category: pattern.category,
    patternId: pattern.id,
    location: context.file ? {
      file: context.file,
      line: context.line ?? null,
      column: context.column ?? null,
      endLine: null,
      endColumn: null,
      format: "generic",
      confidence: "medium",
    } : undefined,
  };
}

// =============================================================================
// AutoFixer Class
// =============================================================================

/**
 * AutoFixer generates targeted fixes for categorized errors.
 *
 * @example
 * ```typescript
 * const fixer = new AutoFixer();
 *
 * const result = fixer.generateFixes("Undefined variable: $primary-color", {
 *   file: "styles/theme.scss",
 *   line: 42,
 * });
 *
 * for (const suggestion of result.suggestions) {
 *   console.log(`${suggestion.title}: ${suggestion.fix}`);
 * }
 * ```
 */
export class AutoFixer {
  private library: ErrorPatternLibrary;

  constructor(library?: ErrorPatternLibrary) {
    this.library = library ?? new ErrorPatternLibrary();
  }

  /**
   * Generate fix suggestions for an error message.
   */
  generateFixes(
    errorMessage: string,
    context: FixContext = {},
    options: AutoFixerOptions = {}
  ): AutoFixResult {
    const {
      maxSuggestions = 5,
      minConfidence = 0.3,
      categories,
      includeFallbacks = true,
    } = options;

    // Extract location from error message
    const extractedLocation = extractErrorLocation(errorMessage);

    // Merge with provided context
    const location: ErrorLocation = {
      file: context.file ?? extractedLocation.file,
      line: context.line ?? extractedLocation.line,
      column: context.column ?? extractedLocation.column,
      endLine: extractedLocation.endLine,
      endColumn: extractedLocation.endColumn,
      format: extractedLocation.format,
      confidence: extractedLocation.confidence,
    };

    // Match patterns
    const matchOptions: PatternMatchOptions = {
      categories,
      minConfidence,
      maxMatches: maxSuggestions * 2, // Get more matches for variety
    };

    const matches = this.library.matchAll(errorMessage, matchOptions);

    if (matches.length === 0) {
      return {
        errorMessage,
        location,
        matchedPattern: null,
        suggestions: includeFallbacks ? this.generateFallbackSuggestions(errorMessage, context) : [],
        hasMatch: false,
        category: null,
      };
    }

    // Generate suggestions from matches
    const suggestions: FixSuggestion[] = [];
    const seenIds = new Set<string>();

    for (const match of matches) {
      const fixContext: FixContext = {
        ...context,
        file: location.file ?? undefined,
        line: location.line ?? undefined,
        column: location.column ?? undefined,
      };

      const generator = CATEGORY_FIX_GENERATORS[match.pattern.category];
      const fixSuggestions = generator
        ? generator(match.pattern, match, fixContext)
        : [createBaseFix(match.pattern, match, fixContext)];

      for (const suggestion of fixSuggestions) {
        if (!seenIds.has(suggestion.id)) {
          seenIds.add(suggestion.id);
          suggestions.push(suggestion);
        }
      }
    }

    // Sort by priority, then confidence
    suggestions.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.confidence - a.confidence;
    });

    return {
      errorMessage,
      location,
      matchedPattern: matches[0].pattern,
      suggestions: suggestions.slice(0, maxSuggestions),
      hasMatch: true,
      category: matches[0].pattern.category,
    };
  }

  /**
   * Generate a single best fix for an error.
   */
  getBestFix(
    errorMessage: string,
    context: FixContext = {}
  ): FixSuggestion | null {
    const result = this.generateFixes(errorMessage, context, { maxSuggestions: 1 });
    return result.suggestions[0] ?? null;
  }

  /**
   * Check if an error can be auto-fixed.
   */
  canFix(errorMessage: string): boolean {
    const match = this.library.match(errorMessage);
    return match !== null;
  }

  /**
   * Get fix suggestions for a specific category.
   */
  getFixesByCategory(
    errorMessage: string,
    category: ErrorCategory,
    context: FixContext = {}
  ): FixSuggestion[] {
    const result = this.generateFixes(errorMessage, context, {
      categories: [category],
    });
    return result.suggestions;
  }

  /**
   * Generate fallback suggestions when no pattern matches.
   */
  private generateFallbackSuggestions(
    errorMessage: string,
    context: FixContext
  ): FixSuggestion[] {
    const suggestions: FixSuggestion[] = [];

    // Generic syntax check suggestion
    if (errorMessage.toLowerCase().includes("syntax") ||
        errorMessage.toLowerCase().includes("parse")) {
      suggestions.push({
        id: "fallback-syntax-check",
        title: "Check syntax",
        description: "Review the code for syntax errors",
        fix: "Check for missing brackets, semicolons, or quotes",
        type: "instruction",
        priority: 5,
        confidence: 0.3,
        category: "general",
        patternId: "fallback",
      });
    }

    // Generic undefined suggestion
    if (errorMessage.toLowerCase().includes("undefined") ||
        errorMessage.toLowerCase().includes("not found") ||
        errorMessage.toLowerCase().includes("not defined")) {
      suggestions.push({
        id: "fallback-check-definition",
        title: "Check definition",
        description: "Ensure the referenced item is defined",
        fix: "Verify the name spelling and ensure it's imported or defined",
        type: "instruction",
        priority: 5,
        confidence: 0.3,
        category: "general",
        patternId: "fallback",
      });
    }

    // Always add a generic suggestion
    if (suggestions.length === 0) {
      suggestions.push({
        id: "fallback-review-error",
        title: "Review error",
        description: "Manually review the error message for clues",
        fix: "Check the error message and surrounding code for issues",
        type: "instruction",
        priority: 10,
        confidence: 0.1,
        category: "general",
        patternId: "fallback",
      });
    }

    return suggestions;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an AutoFixer instance.
 */
export function createAutoFixer(): AutoFixer {
  return new AutoFixer();
}

/**
 * Quick fix generation for an error message.
 */
export function generateFixes(
  errorMessage: string,
  context?: FixContext,
  options?: AutoFixerOptions
): AutoFixResult {
  const fixer = new AutoFixer();
  return fixer.generateFixes(errorMessage, context, options);
}

/**
 * Get the best fix for an error.
 */
export function getBestFix(
  errorMessage: string,
  context?: FixContext
): FixSuggestion | null {
  const fixer = new AutoFixer();
  return fixer.getBestFix(errorMessage, context);
}

/**
 * Check if an error can be auto-fixed.
 */
export function canAutoFix(errorMessage: string): boolean {
  const fixer = new AutoFixer();
  return fixer.canFix(errorMessage);
}
