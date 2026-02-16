/**
 * Self-Correction Loop - Automatic error detection and correction
 *
 * After generating code, this module:
 * 1. Runs all validators (QWeb, SCSS, accessibility)
 * 2. If errors detected, feeds them back to the AI
 * 3. AI generates corrected version
 * 4. Repeat until valid or max iterations
 *
 * This is the key to production-grade code generation.
 */

import { validateScss, type ScssValidationResult } from "@/lib/validators/scss-validator";
import { validateQWeb, type QWebValidationResult } from "@/lib/preview/qweb-validation";
import type { ParsedFile } from "./parser";

// =============================================================================
// Types
// =============================================================================

/** Validation result for a single file */
export interface FileValidationResult {
  file: string;
  type: "scss" | "qweb" | "xml" | "html" | "unknown";
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

/** Error severity levels for weighted quality scoring */
export type ErrorSeverity = "critical" | "high" | "medium" | "low";

/** A validation error with context */
export interface ValidationError {
  message: string;
  line?: number;
  column?: number;
  code?: string;
  severity?: ErrorSeverity;
  suggestion?: string;
}

/** Result of running all validators */
export interface ValidationSummary {
  allValid: boolean;
  totalErrors: number;
  totalWarnings: number;
  results: FileValidationResult[];
  /** Error summary formatted for AI feedback */
  errorPrompt: string;
}

/** Options for self-correction */
export interface SelfCorrectionOptions {
  /** Maximum correction iterations (default: 3) */
  maxIterations?: number;
  /** Minimum quality score to accept (default: 80) */
  minQualityScore?: number;
  /** Whether to include warnings in feedback (default: false) */
  includeWarnings?: boolean;
  /** Files to validate (by extension) */
  fileExtensions?: string[];
}

/** Result of self-correction process */
export interface CorrectionResult {
  /** Final generated content */
  content: string;
  /** Number of iterations performed */
  iterations: number;
  /** Whether final result passes validation */
  isValid: boolean;
  /** Final validation summary */
  validation: ValidationSummary;
  /** History of corrections made */
  correctionHistory: CorrectionHistoryEntry[];
}

/** A single correction iteration */
export interface CorrectionHistoryEntry {
  iteration: number;
  errorCount: number;
  errors: string[];
  correctionApplied: boolean;
}

// =============================================================================
// File Detection
// =============================================================================

/**
 * Detects file type from content or filename
 */
function detectFileType(
  content: string,
  filename?: string
): "scss" | "qweb" | "xml" | "html" | "unknown" {
  // Check filename extension first
  if (filename) {
    if (filename.endsWith(".scss")) return "scss";
    if (filename.endsWith(".css")) return "scss"; // Validate CSS same as SCSS
    if (filename.endsWith(".xml")) return "qweb";
    if (filename.endsWith(".html")) return "html";
  }

  // Content-based detection
  if (content.includes("t-if=") || content.includes("t-foreach=") || content.includes("t-name=")) {
    return "qweb";
  }
  if (content.includes("$") && (content.includes("{") || content.includes("@import"))) {
    return "scss";
  }
  if (content.includes("<!DOCTYPE html") || content.includes("<html")) {
    return "html";
  }
  if (content.includes("<template") || content.includes("<odoo>")) {
    return "xml";
  }

  return "unknown";
}

// =============================================================================
// Validators
// =============================================================================

/**
 * Validates SCSS content
 */
function validateScssContent(content: string, filename: string): FileValidationResult {
  const result: ScssValidationResult = validateScss(content, filename);

  return {
    file: filename,
    type: "scss",
    valid: result.valid,
    errors: result.errors.map((e) => ({
      message: e.message,
      line: e.line ?? undefined,
      column: e.column ?? undefined,
      suggestion: e.context ? `Context:\n${e.context}` : undefined,
    })),
    warnings: [],
  };
}

/**
 * Validates QWeb/XML content
 */
function validateQWebContent(content: string, filename: string): FileValidationResult {
  const result: QWebValidationResult = validateQWeb(content, { file: filename });

  return {
    file: filename,
    type: "qweb",
    valid: result.valid,
    errors: result.errors.map((e) => ({
      message: e.message,
      line: e.line,
      column: e.column ?? undefined,
      code: e.code,
      suggestion: e.directive ? `Directive: ${e.directive}` : undefined,
    })),
    warnings: result.warnings.map((w) => `[${w.code}] ${w.message}`),
  };
}

/**
 * Basic HTML validation (structure check)
 */
function validateHtmlContent(content: string, filename: string): FileValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Check for unbalanced tags
  const tagStack: string[] = [];
  const selfClosing = new Set(["br", "hr", "img", "input", "meta", "link", "area", "base", "col"]);
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*\/?>/g;

  let match;
  while ((match = tagRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const tagName = match[1].toLowerCase();

    if (selfClosing.has(tagName) || fullMatch.endsWith("/>")) {
      continue;
    }

    if (fullMatch.startsWith("</")) {
      // Closing tag
      const expected = tagStack.pop();
      if (expected !== tagName) {
        errors.push({
          message: `Mismatched closing tag: expected </${expected}>, found </${tagName}>`,
        });
      }
    } else {
      // Opening tag
      tagStack.push(tagName);
    }
  }

  // Report unclosed tags
  for (const unclosed of tagStack) {
    errors.push({
      message: `Unclosed element: <${unclosed}>`,
    });
  }

  // Check for accessibility basics
  const imgWithoutAlt = content.match(/<img(?![^>]*alt=)[^>]*>/gi);
  if (imgWithoutAlt && imgWithoutAlt.length > 0) {
    warnings.push(`${imgWithoutAlt.length} image(s) missing alt attribute`);
  }

  return {
    file: filename,
    type: "html",
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// Content Extraction
// =============================================================================

/**
 * Extracts code blocks from AI response
 * Returns array of {content, filename, language} objects
 */
export function extractCodeBlocks(
  response: string
): Array<{ content: string; filename?: string; language?: string }> {
  const blocks: Array<{ content: string; filename?: string; language?: string }> = [];

  // Match fenced code blocks with optional language and filename
  // Format: ```language [filename]\n...\n``` or ```language:filename\n...\n```
  const codeBlockRegex = /```(\w+)?(?::([^\n]+)|[ \t]+([^\n]+))?\n([\s\S]*?)```/g;

  let match;
  while ((match = codeBlockRegex.exec(response)) !== null) {
    const language = match[1] || undefined;
    const filename = match[2] || match[3] || undefined;
    const content = match[4].trim();

    if (content) {
      blocks.push({ content, filename, language });
    }
  }

  // If no code blocks found, treat entire response as code if it looks like code
  if (blocks.length === 0 && (response.includes("{") || response.includes("<"))) {
    blocks.push({ content: response.trim() });
  }

  return blocks;
}

// =============================================================================
// Main Validation Function
// =============================================================================

/**
 * Validates all code blocks in an AI response
 */
export function validateGeneratedCode(response: string): ValidationSummary {
  const codeBlocks = extractCodeBlocks(response);
  const results: FileValidationResult[] = [];

  for (let i = 0; i < codeBlocks.length; i++) {
    const block = codeBlocks[i];
    const filename = block.filename || `block_${i + 1}.${block.language || "txt"}`;
    const type = detectFileType(block.content, filename);

    let result: FileValidationResult;

    switch (type) {
      case "scss":
        result = validateScssContent(block.content, filename);
        break;
      case "qweb":
      case "xml":
        result = validateQWebContent(block.content, filename);
        break;
      case "html":
        result = validateHtmlContent(block.content, filename);
        break;
      default:
        // Unknown type - pass through
        result = {
          file: filename,
          type: "unknown",
          valid: true,
          errors: [],
          warnings: [],
        };
    }

    results.push(result);
  }

  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
  const allValid = results.every((r) => r.valid);

  // Build error prompt for AI feedback
  let errorPrompt = "";
  if (!allValid) {
    errorPrompt = buildErrorPrompt(results);
  }

  return {
    allValid,
    totalErrors,
    totalWarnings,
    results,
    errorPrompt,
  };
}

/**
 * Builds a prompt containing validation errors for AI correction
 */
function buildErrorPrompt(results: FileValidationResult[]): string {
  const lines: string[] = [
    "## Validation Errors Found",
    "",
    "The generated code has the following issues that need to be fixed:",
    "",
  ];

  for (const result of results) {
    if (!result.valid || result.errors.length > 0) {
      lines.push(`### ${result.file} (${result.type})`);
      lines.push("");

      for (const error of result.errors) {
        const location = error.line ? ` (line ${error.line})` : "";
        lines.push(`- **ERROR${location}**: ${error.message}`);
        if (error.suggestion) {
          lines.push(`  - Suggestion: ${error.suggestion}`);
        }
      }
      lines.push("");
    }
  }

  lines.push("Please fix these errors and regenerate the code.");
  lines.push("");

  return lines.join("\n");
}

// =============================================================================
// Correction Prompt Builder
// =============================================================================

/**
 * Builds a correction prompt that includes the original request,
 * the generated code, and the validation errors
 */
export function buildCorrectionPrompt(
  originalPrompt: string,
  generatedCode: string,
  validation: ValidationSummary
): string {
  return `The following code was generated for this request:

<original_request>
${originalPrompt}
</original_request>

<generated_code>
${generatedCode}
</generated_code>

However, the code has validation errors:

${validation.errorPrompt}

Please regenerate the code with these errors fixed. Make sure to:
1. Fix all the errors mentioned above
2. Keep the same functionality and design
3. Output only the corrected code, not explanations

Corrected code:`;
}

// =============================================================================
// Quality Score Calculation
// =============================================================================

/** Deduction points per severity level */
const SEVERITY_WEIGHTS: Record<ErrorSeverity, number> = {
  critical: 50,
  high: 20,
  medium: 10,
  low: 5,
};

/**
 * Maps error codes to severity levels.
 * Critical: structural/security issues that break the theme
 * High: functional issues that cause runtime errors
 * Medium: convention violations that may cause problems
 * Low: cosmetic/best-practice issues
 */
const ERROR_CODE_SEVERITY: Record<string, ErrorSeverity> = {
  // QWeb - Critical (structural)
  QWEB002: "critical",   // Missing <odoo> root
  QWEB003: "critical",   // Mismatched closing tags
  QWEB004: "critical",   // Unclosed tags
  QWEB006: "critical",   // Security patterns (XSS)
  QWEB009: "critical",   // Unknown inherit_id target
  // QWeb - High (functional)
  QWEB007: "high",       // t-foreach without t-as
  QWEB010: "high",       // Invalid o_cc color class
  // QWeb - Medium (conventions)
  QWEB001: "medium",     // Missing XML declaration
  QWEB005: "medium",     // Deprecated patterns
  QWEB008: "low",        // inherit_id without xpath (warning-level)
  // Manifest - Critical
  MANIFEST001: "critical", // Missing required field
  MANIFEST007: "critical", // Path traversal
  MANIFEST008: "high",    // Bundle requires tuple format
  // Manifest - Medium
  MANIFEST003: "medium",  // Invalid version format
  MANIFEST004: "medium",  // Unknown license
  MANIFEST005: "medium",  // Missing website dependency
  // Manifest - Low
  MANIFEST002: "low",     // Missing recommended field
  MANIFEST006: "low",     // Missing installable flag
  // SCSS - Critical
  SCSS001: "critical",    // Unexpected closing brace
  SCSS002: "critical",    // Unclosed brace
  // SCSS - Low
  SCSS003: "low",         // Excessive !important
  SCSS004: "medium",      // Deprecated variables
  SCSS005: "low",         // Hardcoded colors
  QWEB011: "low",        // Unknown snippet type
  // Accessibility - Low/Medium
  A11Y001: "low",         // Image missing alt attribute
  A11Y002: "low",         // Interactive element missing aria-label
  A11Y003: "low",         // Heading hierarchy skipped
  // Structure - Critical
  STRUCT001: "critical",  // Missing required file
  STRUCT003: "high",      // Data file referenced but not found
  // Structure - Medium
  STRUCT002: "medium",    // Asset file referenced but not found
};

/**
 * Infers severity from an error code, falling back to "high" for unknown codes.
 */
export function getErrorSeverity(error: ValidationError): ErrorSeverity {
  if (error.severity) return error.severity;
  if (error.code && error.code in ERROR_CODE_SEVERITY) {
    return ERROR_CODE_SEVERITY[error.code];
  }
  return "high"; // Unknown errors default to high — better safe than silent
}

/**
 * Calculates a quality score based on validation results.
 * Uses weighted severity deductions instead of flat per-error penalties.
 * Score is 0-100, higher is better.
 *
 * Severity weights:
 *   critical = -50 pts  (structural/security breaks)
 *   high     = -20 pts  (functional errors)
 *   medium   = -10 pts  (convention violations)
 *   low      = -5  pts  (cosmetic/best-practice)
 */
export function calculateQualityScore(validation: ValidationSummary): number {
  if (validation.allValid && validation.totalErrors === 0) {
    return 100;
  }

  let score = 100;

  // Weighted deductions from errors based on severity
  for (const result of validation.results) {
    for (const error of result.errors) {
      const severity = getErrorSeverity(error);
      score -= SEVERITY_WEIGHTS[severity];
    }
  }

  // Deduct 2 points per warning (capped at 20 points deduction)
  score -= Math.min(20, validation.totalWarnings * 2);

  return Math.max(0, Math.min(100, score));
}

// =============================================================================
// Self-Correction Integration Helper
// =============================================================================

/**
 * Checks if correction should be attempted based on validation.
 * Includes divergence detection: if the current iteration introduced
 * more errors than the previous one, stop and use the best-so-far output.
 */
export function shouldAttemptCorrection(
  validation: ValidationSummary,
  options: SelfCorrectionOptions = {},
  previousValidation?: ValidationSummary
): boolean {
  const { minQualityScore = 80 } = options;

  // Don't attempt if already valid
  if (validation.allValid) {
    return false;
  }

  // Check quality score
  const score = calculateQualityScore(validation);
  if (score >= minQualityScore) {
    // Score is acceptable even with some warnings
    return false;
  }

  // Divergence detection: if this iteration made quality WORSE, stop
  if (previousValidation) {
    const previousScore = calculateQualityScore(previousValidation);
    if (score < previousScore) {
      // Quality degraded — correction is diverging
      return false;
    }
    // Also detect oscillation: same error count means no progress
    if (validation.totalErrors >= previousValidation.totalErrors && previousValidation.totalErrors > 0) {
      return false;
    }
  }

  // Attempt correction if there are errors
  return validation.totalErrors > 0;
}

/**
 * Creates a concise error summary for logging/display
 */
export function formatValidationSummary(validation: ValidationSummary): string {
  if (validation.allValid) {
    return "✅ All validations passed";
  }

  const parts: string[] = [];

  if (validation.totalErrors > 0) {
    parts.push(`❌ ${validation.totalErrors} error(s)`);
  }

  if (validation.totalWarnings > 0) {
    parts.push(`⚠️ ${validation.totalWarnings} warning(s)`);
  }

  const score = calculateQualityScore(validation);
  parts.push(`Quality: ${score}/100`);

  return parts.join(" | ");
}

/**
 * Validates already-parsed files (post parser fixes).
 * Use this instead of validateGeneratedCode() when you have ParsedFile[] from the parser,
 * so validation runs on the FIXED content, not the raw AI response.
 */
export function validateParsedFiles(files: ParsedFile[]): ValidationSummary {
  const results: FileValidationResult[] = [];

  for (const file of files) {
    const type = detectFileType(file.content, file.path);

    let result: FileValidationResult;

    switch (type) {
      case "scss":
        result = validateScssContent(file.content, file.path);
        break;
      case "qweb":
      case "xml":
        result = validateQWebContent(file.content, file.path);
        break;
      case "html":
        result = validateHtmlContent(file.content, file.path);
        break;
      default:
        result = {
          file: file.path,
          type: "unknown",
          valid: true,
          errors: [],
          warnings: [],
        };
    }

    results.push(result);
  }

  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
  const allValid = results.every((r) => r.valid);

  let errorPrompt = "";
  if (!allValid) {
    errorPrompt = buildErrorPrompt(results);
  }

  return {
    allValid,
    totalErrors,
    totalWarnings,
    results,
    errorPrompt,
  };
}

// =============================================================================
// Exports
// =============================================================================

const selfCorrectionLoop = {
  validateGeneratedCode,
  validateParsedFiles,
  extractCodeBlocks,
  buildCorrectionPrompt,
  calculateQualityScore,
  getErrorSeverity,
  shouldAttemptCorrection,
  formatValidationSummary,
};

export default selfCorrectionLoop;
