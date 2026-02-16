/**
 * Self-Correction Divergence Detection Tests
 *
 * Validates that the self-correction loop detects when iteration N
 * introduces new errors (divergence) or makes no progress (oscillation)
 * and stops instead of continuing.
 *
 * Feature #28: Test coverage for self-correction divergence
 */

import { describe, it, expect } from "vitest";
import {
  shouldAttemptCorrection,
  calculateQualityScore,
} from "../lib/ai/self-correction-loop";
import type { ValidationSummary } from "../lib/ai/self-correction-loop";

// Helper: create a ValidationSummary with given error/warning counts
function makeSummary(
  errors: Array<{ message: string; code?: string }>,
  warnings: string[] = []
): ValidationSummary {
  return {
    allValid: errors.length === 0 && warnings.length === 0,
    totalErrors: errors.length,
    totalWarnings: warnings.length,
    results: [
      {
        file: "test.xml",
        type: "qweb",
        valid: errors.length === 0,
        errors: errors.map((e) => ({ message: e.message, code: e.code })),
        warnings,
      },
    ],
    errorPrompt: errors.map((e) => e.message).join("\n"),
  };
}

describe("Self-correction divergence detection", () => {
  describe("shouldAttemptCorrection", () => {
    it("returns true when errors exist and no previous validation", () => {
      const validation = makeSummary([
        { message: "Missing <odoo>", code: "QWEB002" },
      ]);
      expect(shouldAttemptCorrection(validation)).toBe(true);
    });

    it("returns false when all valid", () => {
      const validation = makeSummary([]);
      expect(shouldAttemptCorrection(validation)).toBe(false);
    });

    it("returns false when quality score meets threshold", () => {
      // Only warnings, no errors — score should be high enough
      const validation: ValidationSummary = {
        allValid: false,
        totalErrors: 0,
        totalWarnings: 2,
        results: [
          {
            file: "test.xml",
            type: "qweb",
            valid: true,
            errors: [],
            warnings: ["warn1", "warn2"],
          },
        ],
        errorPrompt: "",
      };
      expect(shouldAttemptCorrection(validation)).toBe(false);
    });

    it("detects divergence: stops when quality degrades", () => {
      // Iteration 1: 1 error (score ~80)
      const prev = makeSummary([
        { message: "Missing alt", code: "A11Y001" },
      ]);
      // Iteration 2: 3 errors including critical (score much lower)
      const current = makeSummary([
        { message: "Missing alt", code: "A11Y001" },
        { message: "Missing <odoo>", code: "QWEB002" },
        { message: "Mismatched tags", code: "QWEB003" },
      ]);

      const prevScore = calculateQualityScore(prev);
      const currentScore = calculateQualityScore(current);
      expect(currentScore).toBeLessThan(prevScore);

      // Should detect divergence and stop
      expect(shouldAttemptCorrection(current, {}, prev)).toBe(false);
    });

    it("detects oscillation: stops when error count stays same", () => {
      // Iteration 1: 2 errors
      const prev = makeSummary([
        { message: "Error A", code: "QWEB005" },
        { message: "Error B", code: "QWEB007" },
      ]);
      // Iteration 2: still 2 errors (different ones, but same count)
      const current = makeSummary([
        { message: "Error C", code: "QWEB008" },
        { message: "Error D", code: "QWEB010" },
      ]);

      // Same error count = no progress, should stop
      expect(shouldAttemptCorrection(current, {}, prev)).toBe(false);
    });

    it("detects divergence: more errors than before", () => {
      const prev = makeSummary([
        { message: "Error A", code: "QWEB005" },
      ]);
      const current = makeSummary([
        { message: "Error A", code: "QWEB005" },
        { message: "Error B", code: "QWEB007" },
        { message: "Error C", code: "QWEB010" },
      ]);

      expect(shouldAttemptCorrection(current, {}, prev)).toBe(false);
    });

    it("allows correction when errors decrease and score still below threshold", () => {
      // Iteration 1: 3 errors (score = 0, clamped)
      const prev = makeSummary([
        { message: "Error A", code: "QWEB002" },  // critical: -50
        { message: "Error B", code: "QWEB003" },  // critical: -50
        { message: "Error C", code: "QWEB009" },  // critical: -50
      ]);
      // Iteration 2: 1 critical error remains (score = 50, below 80 threshold)
      const current = makeSummary([
        { message: "Error C", code: "QWEB009" },  // critical: -50
      ]);

      // Score improved (0 → 50) but still below 80 → should continue correcting
      expect(shouldAttemptCorrection(current, {}, prev)).toBe(true);
    });

    it("stops when errors decrease but score already acceptable", () => {
      // Iteration 1: 2 errors
      const prev = makeSummary([
        { message: "Error A", code: "QWEB002" },  // critical: -50
        { message: "Error B", code: "QWEB005" },  // medium: -10
      ]);
      // Iteration 2: 1 low error remains (score = 95, above 80)
      const current = makeSummary([
        { message: "Minor issue", code: "QWEB011" },  // low: -5
      ]);

      // Score is 95 ≥ 80, so no further correction needed
      expect(shouldAttemptCorrection(current, {}, prev)).toBe(false);
    });

    it("stops correction on first iteration when quality is already acceptable", () => {
      // Only low-severity warnings, score >= 80
      const validation = makeSummary([], ["minor warning"]);
      expect(shouldAttemptCorrection(validation, { minQualityScore: 80 })).toBe(false);
    });
  });

  describe("calculateQualityScore", () => {
    it("returns 100 for valid input with no errors", () => {
      const validation = makeSummary([]);
      expect(calculateQualityScore(validation)).toBe(100);
    });

    it("deducts heavily for critical errors", () => {
      const validation = makeSummary([
        { message: "Missing <odoo>", code: "QWEB002" },
      ]);
      const score = calculateQualityScore(validation);
      expect(score).toBeLessThanOrEqual(50); // Critical = -50
    });

    it("deducts less for low-severity errors", () => {
      const validation = makeSummary([
        { message: "Unknown snippet", code: "QWEB011" },
      ]);
      const score = calculateQualityScore(validation);
      expect(score).toBeGreaterThanOrEqual(90); // Low = -5
    });

    it("accumulates deductions from multiple errors", () => {
      const validation = makeSummary([
        { message: "Error 1", code: "QWEB002" }, // critical: -50
        { message: "Error 2", code: "QWEB003" }, // critical: -50
      ]);
      const score = calculateQualityScore(validation);
      expect(score).toBe(0); // 100 - 50 - 50 = 0, clamped to 0
    });

    it("never goes below 0", () => {
      const validation = makeSummary([
        { message: "E1", code: "QWEB002" },
        { message: "E2", code: "QWEB003" },
        { message: "E3", code: "QWEB006" },
        { message: "E4", code: "QWEB009" },
      ]);
      const score = calculateQualityScore(validation);
      expect(score).toBe(0);
    });

    it("deducts for warnings", () => {
      const validation = makeSummary([], ["warn1", "warn2", "warn3"]);
      const score = calculateQualityScore(validation);
      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThan(80); // Warnings are mild
    });
  });
});
