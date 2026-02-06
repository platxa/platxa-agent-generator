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

/** A validation error with context */
export interface ValidationError {
  message: string;
  line?: number;
  column?: number;
  code?: string;
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

/**
 * Calculates a quality score based on validation results
 * Score is 0-100, higher is better
 */
export function calculateQualityScore(validation: ValidationSummary): number {
  if (validation.allValid && validation.totalErrors === 0) {
    return 100;
  }

  // Start with 100 and deduct points
  let score = 100;

  // Deduct 15 points per error (capped at 75 points deduction)
  score -= Math.min(75, validation.totalErrors * 15);

  // Deduct 2 points per warning (capped at 20 points deduction)
  score -= Math.min(20, validation.totalWarnings * 2);

  return Math.max(0, score);
}

// =============================================================================
// Self-Correction Integration Helper
// =============================================================================

/**
 * Checks if correction should be attempted based on validation
 */
export function shouldAttemptCorrection(
  validation: ValidationSummary,
  options: SelfCorrectionOptions = {}
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

// =============================================================================
// Exports
// =============================================================================

export default {
  validateGeneratedCode,
  extractCodeBlocks,
  buildCorrectionPrompt,
  calculateQualityScore,
  shouldAttemptCorrection,
  formatValidationSummary,
};
