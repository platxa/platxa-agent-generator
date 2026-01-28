/**
 * Evaluator-Optimizer Feedback Loop
 *
 * Iteratively improves generated output by evaluating quality and
 * re-generating failing sections. The loop runs up to maxIterations
 * times (default 3) until the quality gate passes.
 */

import type { QualityReport, PageSectionResult } from "./types";

// =============================================================================
// Types
// =============================================================================

/** Evaluation criteria and thresholds */
export interface QualityGate {
  /** Minimum overall score to pass (0-100, default 70) */
  minOverallScore: number;
  /** Minimum accessibility score to pass (0-100, default 80) */
  minAccessibilityScore: number;
  /** Minimum brand consistency score (0-100, default 60) */
  minBrandConsistency: number;
}

/** Result of evaluating a section */
export interface EvaluationResult {
  /** Whether the section passed the quality gate */
  passed: boolean;
  /** Quality report for this evaluation */
  quality: QualityReport;
  /** Specific failures that triggered re-generation */
  failures: string[];
}

/** A single iteration in the feedback loop */
export interface FeedbackIteration {
  /** 0-based iteration index */
  iteration: number;
  /** Evaluation result for this iteration */
  evaluation: EvaluationResult;
  /** The section content at this iteration */
  section: PageSectionResult;
  /** Duration of this iteration in ms */
  durationMs: number;
}

/** Complete result of the evaluator-optimizer loop */
export interface FeedbackLoopResult {
  /** Final section content (best result) */
  finalSection: PageSectionResult;
  /** Whether the final result passes the quality gate */
  passed: boolean;
  /** All iterations executed */
  iterations: FeedbackIteration[];
  /** Total iterations run */
  totalIterations: number;
  /** Total duration across all iterations */
  totalDurationMs: number;
}

/** Evaluator function: assesses quality of generated content */
export type EvaluatorFn = (section: PageSectionResult) => Promise<QualityReport>;

/** Optimizer function: regenerates content with feedback from failures */
export type OptimizerFn = (
  section: PageSectionResult,
  failures: string[],
  iteration: number,
) => Promise<PageSectionResult>;

/** Options for the feedback loop */
export interface FeedbackLoopOptions {
  /** Maximum iterations before giving up (default 3) */
  maxIterations?: number;
  /** Quality gate thresholds */
  gate?: Partial<QualityGate>;
  /** Called after each iteration */
  onIteration?: (iteration: FeedbackIteration) => void;
}

// =============================================================================
// Default Quality Gate
// =============================================================================

export const DEFAULT_QUALITY_GATE: QualityGate = {
  minOverallScore: 70,
  minAccessibilityScore: 80,
  minBrandConsistency: 60,
};

// =============================================================================
// Evaluation
// =============================================================================

/**
 * Evaluates a section against the quality gate.
 * Returns detailed pass/fail with specific failure reasons.
 */
export function evaluate(
  quality: QualityReport,
  gate: QualityGate = DEFAULT_QUALITY_GATE,
): EvaluationResult {
  const failures: string[] = [];

  if (quality.overallScore < gate.minOverallScore) {
    failures.push(
      `Overall score ${quality.overallScore} below threshold ${gate.minOverallScore}`,
    );
  }

  if (quality.accessibility.score < gate.minAccessibilityScore) {
    failures.push(
      `Accessibility score ${quality.accessibility.score} below threshold ${gate.minAccessibilityScore}`,
    );
  }

  if (quality.brandConsistency < gate.minBrandConsistency) {
    failures.push(
      `Brand consistency ${quality.brandConsistency} below threshold ${gate.minBrandConsistency}`,
    );
  }

  return {
    passed: failures.length === 0,
    quality,
    failures,
  };
}

// =============================================================================
// Feedback Loop
// =============================================================================

/**
 * Runs the evaluator-optimizer feedback loop.
 *
 * 1. Evaluate the section with the evaluator function
 * 2. If quality gate passes → return
 * 3. Otherwise → pass failures to optimizer for re-generation
 * 4. Repeat up to maxIterations times
 * 5. Return best result if gate never passes
 */
export async function runFeedbackLoop(
  initialSection: PageSectionResult,
  evaluatorFn: EvaluatorFn,
  optimizerFn: OptimizerFn,
  options: FeedbackLoopOptions = {},
): Promise<FeedbackLoopResult> {
  const {
    maxIterations = 3,
    gate: gateOverrides,
    onIteration,
  } = options;

  const gate: QualityGate = { ...DEFAULT_QUALITY_GATE, ...gateOverrides };
  const iterations: FeedbackIteration[] = [];
  let currentSection = initialSection;
  let bestSection = initialSection;
  let bestScore = -1;

  for (let i = 0; i < maxIterations; i++) {
    const start = performance.now();

    // Evaluate
    const quality = await evaluatorFn(currentSection);
    const evaluation = evaluate(quality, gate);

    const iteration: FeedbackIteration = {
      iteration: i,
      evaluation,
      section: currentSection,
      durationMs: Math.round(performance.now() - start),
    };

    iterations.push(iteration);
    onIteration?.(iteration);

    // Track best result
    if (quality.overallScore > bestScore) {
      bestScore = quality.overallScore;
      bestSection = currentSection;
    }

    // Pass → done
    if (evaluation.passed) {
      return {
        finalSection: currentSection,
        passed: true,
        iterations,
        totalIterations: i + 1,
        totalDurationMs: iterations.reduce((s, it) => s + it.durationMs, 0),
      };
    }

    // Last iteration — don't optimize again
    if (i === maxIterations - 1) break;

    // Optimize → regenerate with failure feedback
    const optimizeStart = performance.now();
    currentSection = await optimizerFn(currentSection, evaluation.failures, i);
    // Update the last iteration duration to include optimization
    iteration.durationMs += Math.round(performance.now() - optimizeStart);
  }

  // Return best result even if gate never passed
  return {
    finalSection: bestSection,
    passed: false,
    iterations,
    totalIterations: iterations.length,
    totalDurationMs: iterations.reduce((s, it) => s + it.durationMs, 0),
  };
}
