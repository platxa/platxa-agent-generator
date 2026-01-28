/**
 * Self-Correction from Quality Gate Feedback
 *
 * When the quality gate fails, this module translates failure details
 * into structured correction instructions and automatically retries
 * generation with those corrections applied.
 */

import type { QualityReport, PageSectionResult } from "./types";

// =============================================================================
// Types
// =============================================================================

/** A specific correction instruction derived from a quality failure */
export interface CorrectionInstruction {
  /** Category of the correction */
  category: "accessibility" | "brand" | "structure" | "performance" | "content";
  /** Human-readable description of what to fix */
  description: string;
  /** Severity: how critical this fix is */
  severity: "critical" | "major" | "minor";
  /** Suggested fix approach */
  suggestion: string;
}

/** Input to the regeneration function */
export interface RegenerationInput {
  /** The section that failed quality gate */
  section: PageSectionResult;
  /** Structured corrections to apply */
  corrections: CorrectionInstruction[];
  /** The quality report that triggered correction */
  qualityReport: QualityReport;
  /** Which retry attempt this is (0-based) */
  attempt: number;
}

/** Function that regenerates content with corrections applied */
export type RegenerateFn = (input: RegenerationInput) => Promise<PageSectionResult>;

/** Result of a single correction attempt */
export interface CorrectionAttempt {
  /** 0-based attempt index */
  attempt: number;
  /** Section before correction */
  inputSection: PageSectionResult;
  /** Section after correction */
  outputSection: PageSectionResult;
  /** Corrections that were applied */
  corrections: CorrectionInstruction[];
  /** Quality report after correction */
  qualityReport: QualityReport;
  /** Whether quality gate passed after this attempt */
  passed: boolean;
  /** Duration of this attempt in ms */
  durationMs: number;
}

/** Complete result of the self-correction process */
export interface SelfCorrectionResult {
  /** Final section (best result) */
  finalSection: PageSectionResult;
  /** Whether quality gate ultimately passed */
  passed: boolean;
  /** All correction attempts */
  attempts: CorrectionAttempt[];
  /** Total attempts made */
  totalAttempts: number;
  /** Total duration across all attempts */
  totalDurationMs: number;
  /** Corrections that were never resolved */
  unresolvedCorrections: CorrectionInstruction[];
}

/** Options for self-correction */
export interface SelfCorrectionOptions {
  /** Maximum retry attempts (default 3) */
  maxAttempts?: number;
  /** Minimum overall score to pass (default 70) */
  minOverallScore?: number;
  /** Minimum accessibility score to pass (default 80) */
  minAccessibilityScore?: number;
  /** Minimum brand consistency to pass (default 60) */
  minBrandConsistency?: number;
  /** Called after each attempt */
  onAttempt?: (attempt: CorrectionAttempt) => void;
}

// =============================================================================
// Correction Extraction
// =============================================================================

/**
 * Translates a quality report into structured correction instructions.
 * Analyzes each quality dimension and produces actionable fixes.
 */
export function extractCorrections(
  report: QualityReport,
  options: Pick<SelfCorrectionOptions, "minOverallScore" | "minAccessibilityScore" | "minBrandConsistency"> = {},
): CorrectionInstruction[] {
  const {
    minOverallScore = 70,
    minAccessibilityScore = 80,
    minBrandConsistency = 60,
  } = options;

  const corrections: CorrectionInstruction[] = [];

  // Accessibility issues
  if (report.accessibility.score < minAccessibilityScore) {
    for (const issue of report.accessibility.issues) {
      corrections.push({
        category: "accessibility",
        severity: issue.severity === "error" ? "critical" : issue.severity === "warning" ? "major" : "minor",
        description: `Accessibility: ${issue.message}`,
        suggestion: issue.fix || `Fix accessibility issue: ${issue.rule}`,
      });
    }

    // If no specific issues but score is low, add generic
    if (report.accessibility.issues.length === 0) {
      corrections.push({
        category: "accessibility",
        severity: "major",
        description: `Accessibility score ${report.accessibility.score} is below threshold ${minAccessibilityScore}`,
        suggestion: "Add proper ARIA labels, ensure sufficient color contrast, and include alt text for images",
      });
    }
  }

  // Brand consistency
  if (report.brandConsistency < minBrandConsistency) {
    corrections.push({
      category: "brand",
      severity: report.brandConsistency < 40 ? "critical" : "major",
      description: `Brand consistency ${report.brandConsistency} is below threshold ${minBrandConsistency}`,
      suggestion: "Use brand color variables ($o-color-1 through $o-color-5), maintain consistent typography, and follow the design token palette",
    });
  }

  // Overall score suggestions from report
  if (report.overallScore < minOverallScore) {
    for (const suggestion of report.suggestions) {
      corrections.push({
        category: "content",
        severity: "major",
        description: suggestion,
        suggestion: `Address: ${suggestion}`,
      });
    }

    // If no suggestions but score low, add generic
    if (report.suggestions.length === 0 && corrections.length === 0) {
      corrections.push({
        category: "structure",
        severity: "major",
        description: `Overall quality score ${report.overallScore} is below threshold ${minOverallScore}`,
        suggestion: "Improve semantic HTML structure, ensure proper heading hierarchy, and validate snippet markup",
      });
    }
  }

  // Sort by severity: critical > major > minor
  const severityOrder = { critical: 0, major: 1, minor: 2 };
  corrections.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return corrections;
}

/**
 * Formats corrections into a prompt-friendly string for the agent.
 */
export function formatCorrectionsForPrompt(corrections: CorrectionInstruction[]): string {
  if (corrections.length === 0) return "";

  const lines = corrections.map((c, i) =>
    `${i + 1}. [${c.severity.toUpperCase()}] ${c.description}\n   Fix: ${c.suggestion}`
  );

  return `Quality gate failed. Apply these corrections:\n\n${lines.join("\n\n")}`;
}

// =============================================================================
// Self-Correction Loop
// =============================================================================

/**
 * Runs self-correction: evaluates quality, extracts corrections from failures,
 * and retries generation with correction instructions until the gate passes
 * or max attempts are exhausted.
 */
export async function runSelfCorrection(
  section: PageSectionResult,
  evaluateFn: (section: PageSectionResult) => Promise<QualityReport>,
  regenerateFn: RegenerateFn,
  options: SelfCorrectionOptions = {},
): Promise<SelfCorrectionResult> {
  const {
    maxAttempts = 3,
    minOverallScore = 70,
    minAccessibilityScore = 80,
    minBrandConsistency = 60,
    onAttempt,
  } = options;

  const thresholds = { minOverallScore, minAccessibilityScore, minBrandConsistency };
  const attempts: CorrectionAttempt[] = [];
  let currentSection = section;
  let bestSection = section;
  let bestScore = -1;

  for (let i = 0; i < maxAttempts; i++) {
    const start = performance.now();

    // Evaluate current section
    const report = await evaluateFn(currentSection);
    const corrections = extractCorrections(report, thresholds);
    const passed = corrections.length === 0;

    const attempt: CorrectionAttempt = {
      attempt: i,
      inputSection: currentSection,
      outputSection: currentSection,
      corrections,
      qualityReport: report,
      passed,
      durationMs: 0,
    };

    // Track best
    if (report.overallScore > bestScore) {
      bestScore = report.overallScore;
      bestSection = currentSection;
    }

    if (passed) {
      attempt.durationMs = Math.round(performance.now() - start);
      attempts.push(attempt);
      onAttempt?.(attempt);
      break;
    }

    // Last attempt — don't regenerate
    if (i === maxAttempts - 1) {
      attempt.durationMs = Math.round(performance.now() - start);
      attempts.push(attempt);
      onAttempt?.(attempt);
      break;
    }

    // Regenerate with corrections
    const regenerated = await regenerateFn({
      section: currentSection,
      corrections,
      qualityReport: report,
      attempt: i,
    });

    attempt.outputSection = regenerated;
    attempt.durationMs = Math.round(performance.now() - start);
    attempts.push(attempt);
    onAttempt?.(attempt);

    currentSection = regenerated;
  }

  const lastAttempt = attempts[attempts.length - 1];
  const passed = lastAttempt.passed;

  // Collect unresolved corrections from last attempt
  const unresolvedCorrections = passed ? [] : lastAttempt.corrections;

  return {
    finalSection: passed ? currentSection : bestSection,
    passed,
    attempts,
    totalAttempts: attempts.length,
    totalDurationMs: attempts.reduce((s, a) => s + a.durationMs, 0),
    unresolvedCorrections,
  };
}
