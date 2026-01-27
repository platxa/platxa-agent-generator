/**
 * SCSS Compilation Validator
 *
 * Validates generated SCSS files by compiling them with dart-sass.
 * Reports syntax errors with line numbers and context so issues
 * are caught before deployment to Odoo.
 */

import * as sass from "sass";

// =============================================================================
// Types
// =============================================================================

/** A single SCSS compilation error with location info */
export interface ScssError {
  /** Error message from dart-sass */
  message: string;
  /** Line number (1-based) where the error occurred */
  line: number | null;
  /** Column number (1-based) */
  column: number | null;
  /** Source file path (or "inline" for string compilation) */
  file: string;
  /** Surrounding source context (a few lines around the error) */
  context: string | null;
}

/** Result of validating a single SCSS source */
export interface ScssValidationResult {
  /** Whether compilation succeeded */
  valid: boolean;
  /** File path or identifier */
  file: string;
  /** Compilation errors (empty if valid) */
  errors: ScssError[];
  /** Compiled CSS output (null if compilation failed) */
  css: string | null;
}

/** Result of validating multiple SCSS sources */
export interface ScssBatchValidationResult {
  /** Whether all files compiled successfully */
  allValid: boolean;
  /** Per-file results */
  results: ScssValidationResult[];
  /** Total error count across all files */
  totalErrors: number;
}

// =============================================================================
// Single File Validation
// =============================================================================

/**
 * Validates an SCSS string by compiling it with dart-sass.
 * Returns detailed error information including line numbers.
 */
export function validateScss(
  source: string,
  file = "inline.scss",
): ScssValidationResult {
  try {
    const result = sass.compileString(source, {
      style: "expanded",
      sourceMap: false,
    });

    return {
      valid: true,
      file,
      errors: [],
      css: result.css,
    };
  } catch (error) {
    const scssError = parseSassError(error, file, source);
    return {
      valid: false,
      file,
      errors: [scssError],
      css: null,
    };
  }
}

// =============================================================================
// Batch Validation
// =============================================================================

/**
 * Validates multiple SCSS sources. Each file is compiled independently.
 */
export function validateScssBatch(
  files: Array<{ path: string; content: string }>,
): ScssBatchValidationResult {
  const results = files.map((f) => validateScss(f.content, f.path));
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  return {
    allValid: totalErrors === 0,
    results,
    totalErrors,
  };
}

// =============================================================================
// Error Parsing
// =============================================================================

/**
 * Extracts structured error info from a sass compilation exception.
 */
function parseSassError(
  error: unknown,
  file: string,
  source: string,
): ScssError {
  if (error instanceof sass.Exception) {
    const span = error.span;
    const line = span?.start?.line != null ? span.start.line + 1 : null;
    const column = span?.start?.column != null ? span.start.column + 1 : null;

    return {
      message: error.message,
      line,
      column,
      file,
      context: line != null ? extractContext(source, line) : null,
    };
  }

  if (error instanceof Error) {
    // Fallback: parse line number from error message
    const lineMatch = error.message.match(/line (\d+)/i);
    const line = lineMatch ? parseInt(lineMatch[1], 10) : null;

    return {
      message: error.message,
      line,
      column: null,
      file,
      context: line != null ? extractContext(source, line) : null,
    };
  }

  return {
    message: String(error),
    line: null,
    column: null,
    file,
    context: null,
  };
}

/**
 * Extracts a few lines of context around the error line.
 */
function extractContext(source: string, errorLine: number, radius = 2): string {
  const lines = source.split("\n");
  const start = Math.max(0, errorLine - 1 - radius);
  const end = Math.min(lines.length, errorLine + radius);

  return lines
    .slice(start, end)
    .map((line, i) => {
      const lineNum = start + i + 1;
      const marker = lineNum === errorLine ? ">" : " ";
      return `${marker} ${lineNum.toString().padStart(4)} | ${line}`;
    })
    .join("\n");
}
