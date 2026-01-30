/**
 * Tests for Fix Confidence Scoring
 *
 * Feature #149: Implement fix confidence scoring based on pattern match quality
 * Verification: Score 0-100 based on: pattern match (40), context clarity (30), fix simplicity (30)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  FixConfidenceScorer,
  createFixConfidenceScorer,
  DEFAULT_WEIGHTS,
  GRADE_THRESHOLDS,
  CONFIDENCE_THRESHOLDS,
  COMMON_ERROR_PATTERNS,
  LINES_CHANGED_THRESHOLDS,
  levenshteinDistance,
  stringSimilarity,
  countPatternMatches,
  getMatchSpecificity,
  calculateMessageClarity,
  getGrade,
  getConfidenceLevel,
  generateSummary,
  normalizeWeights,
  clamp01,
  averageFactors,
  type ErrorForScoring,
  type FixForScoring,
  type CategoryScore,
  type ScoreWeights,
} from "../../lib/preview/fix-confidence-scorer";

// ============================================================================
// Constants
// ============================================================================

describe("Constants", () => {
  describe("DEFAULT_WEIGHTS", () => {
    it("should have pattern match weight of 40", () => {
      expect(DEFAULT_WEIGHTS.patternMatch).toBe(40);
    });

    it("should have context clarity weight of 30", () => {
      expect(DEFAULT_WEIGHTS.contextClarity).toBe(30);
    });

    it("should have fix simplicity weight of 30", () => {
      expect(DEFAULT_WEIGHTS.fixSimplicity).toBe(30);
    });

    it("should sum to 100", () => {
      const sum = DEFAULT_WEIGHTS.patternMatch + DEFAULT_WEIGHTS.contextClarity + DEFAULT_WEIGHTS.fixSimplicity;
      expect(sum).toBe(100);
    });
  });

  describe("GRADE_THRESHOLDS", () => {
    it("should define A as 90", () => {
      expect(GRADE_THRESHOLDS.A).toBe(90);
    });

    it("should define B as 80", () => {
      expect(GRADE_THRESHOLDS.B).toBe(80);
    });

    it("should define C as 70", () => {
      expect(GRADE_THRESHOLDS.C).toBe(70);
    });

    it("should define D as 60", () => {
      expect(GRADE_THRESHOLDS.D).toBe(60);
    });

    it("should define F as 0", () => {
      expect(GRADE_THRESHOLDS.F).toBe(0);
    });
  });

  describe("CONFIDENCE_THRESHOLDS", () => {
    it("should define very-high as 90", () => {
      expect(CONFIDENCE_THRESHOLDS["very-high"]).toBe(90);
    });

    it("should define high as 75", () => {
      expect(CONFIDENCE_THRESHOLDS["high"]).toBe(75);
    });

    it("should define medium as 50", () => {
      expect(CONFIDENCE_THRESHOLDS["medium"]).toBe(50);
    });

    it("should define low as 25", () => {
      expect(CONFIDENCE_THRESHOLDS["low"]).toBe(25);
    });
  });

  describe("COMMON_ERROR_PATTERNS", () => {
    it("should have multiple patterns", () => {
      expect(COMMON_ERROR_PATTERNS.length).toBeGreaterThan(10);
    });

    it("should include JavaScript error patterns", () => {
      const hasTypeError = COMMON_ERROR_PATTERNS.some((p) => p.test("TypeError: x is undefined"));
      expect(hasTypeError).toBe(true);
    });

    it("should include CSS error patterns", () => {
      const hasCSSError = COMMON_ERROR_PATTERNS.some((p) => p.test("Invalid CSS property"));
      expect(hasCSSError).toBe(true);
    });
  });

  describe("LINES_CHANGED_THRESHOLDS", () => {
    it("should define few as 10", () => {
      expect(LINES_CHANGED_THRESHOLDS.few).toBe(10);
    });

    it("should define moderate as 50", () => {
      expect(LINES_CHANGED_THRESHOLDS.moderate).toBe(50);
    });

    it("should define many as 100", () => {
      expect(LINES_CHANGED_THRESHOLDS.many).toBe(100);
    });
  });
});

// ============================================================================
// Utility Functions
// ============================================================================

describe("Utility Functions", () => {
  describe("levenshteinDistance", () => {
    it("should return 0 for identical strings", () => {
      expect(levenshteinDistance("hello", "hello")).toBe(0);
    });

    it("should return length for empty comparison", () => {
      expect(levenshteinDistance("hello", "")).toBe(5);
      expect(levenshteinDistance("", "world")).toBe(5);
    });

    it("should calculate correct distance", () => {
      expect(levenshteinDistance("kitten", "sitting")).toBe(3);
      expect(levenshteinDistance("saturday", "sunday")).toBe(3);
    });
  });

  describe("stringSimilarity", () => {
    it("should return 1 for identical strings", () => {
      expect(stringSimilarity("hello", "hello")).toBe(1);
    });

    it("should return 0 for empty strings", () => {
      expect(stringSimilarity("", "hello")).toBe(0);
      expect(stringSimilarity("hello", "")).toBe(0);
    });

    it("should return value between 0 and 1", () => {
      const sim = stringSimilarity("hello", "hallo");
      expect(sim).toBeGreaterThan(0);
      expect(sim).toBeLessThan(1);
    });

    it("should be case insensitive", () => {
      expect(stringSimilarity("Hello", "hello")).toBe(1);
    });
  });

  describe("countPatternMatches", () => {
    it("should count matching patterns", () => {
      const patterns = [/error/i, /warning/i, /info/i];
      expect(countPatternMatches("Error occurred", patterns)).toBe(1);
      expect(countPatternMatches("Error and Warning", patterns)).toBe(2);
    });

    it("should return 0 for no matches", () => {
      const patterns = [/error/i, /warning/i];
      expect(countPatternMatches("Success", patterns)).toBe(0);
    });
  });

  describe("getMatchSpecificity", () => {
    it("should return 0 for no match", () => {
      expect(getMatchSpecificity(/error/i, "success")).toBe(0);
    });

    it("should return positive value for match", () => {
      const spec = getMatchSpecificity(/TypeError/i, "TypeError: undefined");
      expect(spec).toBeGreaterThan(0);
    });

    it("should return higher value for more specific match", () => {
      const general = getMatchSpecificity(/error/i, "TypeError: undefined is not a function");
      const specific = getMatchSpecificity(/TypeError:/i, "TypeError: undefined is not a function");
      expect(specific).toBeGreaterThan(general);
    });
  });

  describe("calculateMessageClarity", () => {
    it("should return higher score for clear messages", () => {
      const clear = calculateMessageClarity('TypeError: Cannot read property "x" of undefined at file.ts:10');
      const unclear = calculateMessageClarity("error");
      expect(clear).toBeGreaterThan(unclear);
    });

    it("should give bonus for error type", () => {
      const withType = calculateMessageClarity("TypeError: something");
      const withoutType = calculateMessageClarity("something went wrong");
      expect(withType).toBeGreaterThan(withoutType);
    });

    it("should give bonus for location info", () => {
      const withLocation = calculateMessageClarity("error at file.ts:10");
      const withoutLocation = calculateMessageClarity("error occurred");
      expect(withLocation).toBeGreaterThan(withoutLocation);
    });
  });

  describe("getGrade", () => {
    it("should return A for 90+", () => {
      expect(getGrade(90)).toBe("A");
      expect(getGrade(100)).toBe("A");
    });

    it("should return B for 80-89", () => {
      expect(getGrade(80)).toBe("B");
      expect(getGrade(89)).toBe("B");
    });

    it("should return C for 70-79", () => {
      expect(getGrade(70)).toBe("C");
      expect(getGrade(79)).toBe("C");
    });

    it("should return D for 60-69", () => {
      expect(getGrade(60)).toBe("D");
      expect(getGrade(69)).toBe("D");
    });

    it("should return F for below 60", () => {
      expect(getGrade(59)).toBe("F");
      expect(getGrade(0)).toBe("F");
    });
  });

  describe("getConfidenceLevel", () => {
    it("should return very-high for 90+", () => {
      expect(getConfidenceLevel(90)).toBe("very-high");
    });

    it("should return high for 75-89", () => {
      expect(getConfidenceLevel(75)).toBe("high");
      expect(getConfidenceLevel(89)).toBe("high");
    });

    it("should return medium for 50-74", () => {
      expect(getConfidenceLevel(50)).toBe("medium");
      expect(getConfidenceLevel(74)).toBe("medium");
    });

    it("should return low for 25-49", () => {
      expect(getConfidenceLevel(25)).toBe("low");
      expect(getConfidenceLevel(49)).toBe("low");
    });

    it("should return very-low for below 25", () => {
      expect(getConfidenceLevel(24)).toBe("very-low");
      expect(getConfidenceLevel(0)).toBe("very-low");
    });
  });

  describe("generateSummary", () => {
    it("should generate summary with score", () => {
      const categories: CategoryScore[] = [
        { category: "pattern-match", rawScore: 0.8, weight: 40, weightedScore: 32, factors: {} },
        { category: "context-clarity", rawScore: 0.7, weight: 30, weightedScore: 21, factors: {} },
        { category: "fix-simplicity", rawScore: 0.9, weight: 30, weightedScore: 27, factors: {} },
      ];
      const summary = generateSummary(80, categories);
      expect(summary).toContain("80%");
      expect(summary).toContain("Grade B");
    });
  });

  describe("normalizeWeights", () => {
    it("should normalize weights to sum to 100", () => {
      const weights: ScoreWeights = { patternMatch: 20, contextClarity: 20, fixSimplicity: 20 };
      const normalized = normalizeWeights(weights);
      const sum = normalized.patternMatch + normalized.contextClarity + normalized.fixSimplicity;
      expect(Math.round(sum)).toBe(100);
    });

    it("should return default for zero weights", () => {
      const weights: ScoreWeights = { patternMatch: 0, contextClarity: 0, fixSimplicity: 0 };
      const normalized = normalizeWeights(weights);
      expect(normalized).toEqual(DEFAULT_WEIGHTS);
    });
  });

  describe("clamp01", () => {
    it("should clamp values to 0-1 range", () => {
      expect(clamp01(-0.5)).toBe(0);
      expect(clamp01(0.5)).toBe(0.5);
      expect(clamp01(1.5)).toBe(1);
    });
  });

  describe("averageFactors", () => {
    it("should calculate average of factors", () => {
      expect(averageFactors({ a: 0.5, b: 0.5 })).toBe(0.5);
      expect(averageFactors({ a: 0, b: 1 })).toBe(0.5);
    });

    it("should return 0 for empty object", () => {
      expect(averageFactors({})).toBe(0);
    });
  });
});

// ============================================================================
// FixConfidenceScorer Class
// ============================================================================

describe("FixConfidenceScorer", () => {
  let scorer: FixConfidenceScorer;

  beforeEach(() => {
    scorer = new FixConfidenceScorer();
  });

  afterEach(() => {
    scorer.dispose();
  });

  describe("constructor", () => {
    it("should create with default options", () => {
      expect(scorer.isDisposed()).toBe(false);
    });

    it("should accept custom weights", () => {
      const s = new FixConfidenceScorer({ weights: { patternMatch: 50 } });
      const weights = s.getWeights();
      expect(weights.patternMatch).toBeGreaterThan(40);
      s.dispose();
    });

    it("should accept custom patterns", () => {
      const s = new FixConfidenceScorer({
        knownPatterns: [/custom error/i],
      });
      const error: ErrorForScoring = { message: "This is a custom error" };
      const fix: FixForScoring = { description: "Fix it" };
      const score = s.score(error, fix);
      expect(score.total).toBeGreaterThan(0);
      s.dispose();
    });

    it("should accept confidence threshold", () => {
      const s = new FixConfidenceScorer({ confidenceThreshold: 80 });
      expect(s.isDisposed()).toBe(false);
      s.dispose();
    });
  });

  describe("score", () => {
    it("should return score between 0 and 100", () => {
      const error: ErrorForScoring = { message: "TypeError: undefined" };
      const fix: FixForScoring = { description: "Add null check" };
      const result = scorer.score(error, fix);
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.total).toBeLessThanOrEqual(100);
    });

    it("should include all three categories", () => {
      const error: ErrorForScoring = { message: "Error occurred" };
      const fix: FixForScoring = { description: "Fix it" };
      const result = scorer.score(error, fix);
      expect(result.categories.length).toBe(3);
      expect(result.categories.some((c) => c.category === "pattern-match")).toBe(true);
      expect(result.categories.some((c) => c.category === "context-clarity")).toBe(true);
      expect(result.categories.some((c) => c.category === "fix-simplicity")).toBe(true);
    });

    it("should return higher score for well-defined errors", () => {
      const wellDefined: ErrorForScoring = {
        message: "TypeError: Cannot read property 'x' of undefined",
        type: "TypeError",
        file: "app.ts",
        line: 42,
        stack: "at foo (app.ts:42)",
        codeContext: "const x = obj.x;",
      };
      const poorlyDefined: ErrorForScoring = {
        message: "error",
      };
      const fix: FixForScoring = { description: "Add null check" };

      const wellScore = scorer.score(wellDefined, fix);
      const poorScore = scorer.score(poorlyDefined, fix);

      expect(wellScore.total).toBeGreaterThan(poorScore.total);
    });

    it("should return higher score for simple fixes", () => {
      const error: ErrorForScoring = { message: "TypeError: undefined" };
      const simpleFix: FixForScoring = {
        description: "Add null check",
        files: ["app.ts"],
        linesChanged: 5,
        reversible: true,
        complexity: 1,
      };
      const complexFix: FixForScoring = {
        description: "Refactor entire module",
        files: ["a.ts", "b.ts", "c.ts", "d.ts"],
        linesChanged: 500,
        dependencies: ["new-lib"],
        reversible: false,
        complexity: 5,
      };

      const simpleScore = scorer.score(error, simpleFix);
      const complexScore = scorer.score(error, complexFix);

      expect(simpleScore.total).toBeGreaterThan(complexScore.total);
    });

    it("should include grade in result", () => {
      const error: ErrorForScoring = { message: "Error" };
      const fix: FixForScoring = { description: "Fix" };
      const result = scorer.score(error, fix);
      expect(["A", "B", "C", "D", "F"]).toContain(result.grade);
    });

    it("should include confidence level in result", () => {
      const error: ErrorForScoring = { message: "Error" };
      const fix: FixForScoring = { description: "Fix" };
      const result = scorer.score(error, fix);
      expect(["very-high", "high", "medium", "low", "very-low"]).toContain(result.level);
    });

    it("should include summary in result", () => {
      const error: ErrorForScoring = { message: "Error" };
      const fix: FixForScoring = { description: "Fix" };
      const result = scorer.score(error, fix);
      expect(result.summary.length).toBeGreaterThan(0);
    });

    it("should throw if disposed", () => {
      scorer.dispose();
      expect(() => scorer.score({ message: "Error" }, { description: "Fix" })).toThrow("disposed");
    });
  });

  describe("scoreAndRank", () => {
    it("should rank fixes by score", () => {
      const error: ErrorForScoring = { message: "TypeError: undefined" };
      const fixes: FixForScoring[] = [
        { description: "Complex fix", files: ["a.ts", "b.ts", "c.ts"], linesChanged: 200 },
        { description: "Simple fix", files: ["a.ts"], linesChanged: 5 },
        { description: "Medium fix", files: ["a.ts", "b.ts"], linesChanged: 50 },
      ];

      const ranked = scorer.scoreAndRank(error, fixes);

      expect(ranked.length).toBe(3);
      // Should be sorted by score descending
      expect(ranked[0].score.total).toBeGreaterThanOrEqual(ranked[1].score.total);
      expect(ranked[1].score.total).toBeGreaterThanOrEqual(ranked[2].score.total);
    });
  });

  describe("isConfident", () => {
    it("should return true for high scores", () => {
      const highScore = {
        total: 85,
        grade: "B" as const,
        categories: [],
        level: "high" as const,
        summary: "",
        timestamp: Date.now(),
      };
      expect(scorer.isConfident(highScore)).toBe(true);
    });

    it("should return false for low scores", () => {
      const lowScore = {
        total: 40,
        grade: "F" as const,
        categories: [],
        level: "low" as const,
        summary: "",
        timestamp: Date.now(),
      };
      expect(scorer.isConfident(lowScore)).toBe(false);
    });
  });

  describe("getBestFix", () => {
    it("should return best scoring fix", () => {
      const error: ErrorForScoring = { message: "TypeError: undefined" };
      const fixes: FixForScoring[] = [
        { description: "Complex fix", linesChanged: 200 },
        { description: "Simple fix", linesChanged: 5 },
      ];

      const best = scorer.getBestFix(error, fixes);

      expect(best).not.toBeNull();
      expect(best?.fix.description).toBe("Simple fix");
    });

    it("should return null for empty fixes", () => {
      const error: ErrorForScoring = { message: "Error" };
      const best = scorer.getBestFix(error, []);
      expect(best).toBeNull();
    });
  });

  describe("getConfidentFixes", () => {
    it("should return only fixes above threshold", () => {
      const s = new FixConfidenceScorer({ confidenceThreshold: 50 });
      const error: ErrorForScoring = {
        message: "TypeError: Cannot read property",
        type: "TypeError",
        file: "app.ts",
        line: 10,
      };
      const fixes: FixForScoring[] = [
        { description: "Good fix", files: ["a.ts"], linesChanged: 5 },
        { description: "Another fix", files: ["a.ts"], linesChanged: 10 },
      ];

      const confident = s.getConfidentFixes(error, fixes);

      confident.forEach((result) => {
        expect(result.score.total).toBeGreaterThanOrEqual(50);
      });

      s.dispose();
    });
  });

  describe("addPattern", () => {
    it("should add custom pattern", () => {
      scorer.addPattern(/my custom error/i);
      const error: ErrorForScoring = { message: "This is my custom error" };
      const fix: FixForScoring = { description: "Fix it" };
      const score = scorer.score(error, fix);
      // Should have pattern match contribution
      const patternScore = score.categories.find((c) => c.category === "pattern-match");
      expect(patternScore?.rawScore).toBeGreaterThan(0);
    });

    it("should throw if disposed", () => {
      scorer.dispose();
      expect(() => scorer.addPattern(/test/)).toThrow("disposed");
    });
  });

  describe("setThreshold", () => {
    it("should update threshold", () => {
      scorer.setThreshold(80);
      const score = {
        total: 75,
        grade: "C" as const,
        categories: [],
        level: "high" as const,
        summary: "",
        timestamp: Date.now(),
      };
      expect(scorer.isConfident(score)).toBe(false);
    });
  });

  describe("getWeights", () => {
    it("should return current weights", () => {
      const weights = scorer.getWeights();
      expect(weights.patternMatch).toBe(40);
      expect(weights.contextClarity).toBe(30);
      expect(weights.fixSimplicity).toBe(30);
    });
  });

  describe("isDisposed", () => {
    it("should return false when not disposed", () => {
      expect(scorer.isDisposed()).toBe(false);
    });

    it("should return true when disposed", () => {
      scorer.dispose();
      expect(scorer.isDisposed()).toBe(true);
    });
  });

  describe("dispose", () => {
    it("should dispose resources", () => {
      scorer.dispose();
      expect(scorer.isDisposed()).toBe(true);
    });

    it("should be idempotent", () => {
      scorer.dispose();
      expect(() => scorer.dispose()).not.toThrow();
    });
  });
});

// ============================================================================
// Factory Function
// ============================================================================

describe("createFixConfidenceScorer", () => {
  it("should create FixConfidenceScorer instance", () => {
    const s = createFixConfidenceScorer();
    expect(s).toBeInstanceOf(FixConfidenceScorer);
    s.dispose();
  });

  it("should pass options to constructor", () => {
    const s = createFixConfidenceScorer({ confidenceThreshold: 80 });
    expect(s.isDisposed()).toBe(false);
    s.dispose();
  });
});

// ============================================================================
// Integration: Score Verification
// ============================================================================

describe("Integration: Score 0-100 based on weights", () => {
  let scorer: FixConfidenceScorer;

  beforeEach(() => {
    scorer = new FixConfidenceScorer();
  });

  afterEach(() => {
    scorer.dispose();
  });

  describe("Pattern Match (40 points)", () => {
    it("should contribute up to 40 points", () => {
      const error: ErrorForScoring = {
        message: "TypeError: Cannot read property 'x' of undefined",
        type: "TypeError",
      };
      const fix: FixForScoring = { description: "Add null check" };
      const score = scorer.score(error, fix);

      const patternScore = score.categories.find((c) => c.category === "pattern-match");
      expect(patternScore?.weightedScore).toBeLessThanOrEqual(40);
      expect(patternScore?.weight).toBe(40);
    });

    it("should score higher for recognized error types", () => {
      const recognized: ErrorForScoring = {
        message: "TypeError: undefined is not a function",
        type: "TypeError",
      };
      const unrecognized: ErrorForScoring = {
        message: "Something strange happened",
      };
      const fix: FixForScoring = { description: "Fix" };

      const recScore = scorer.score(recognized, fix);
      const unrecScore = scorer.score(unrecognized, fix);

      const recPattern = recScore.categories.find((c) => c.category === "pattern-match");
      const unrecPattern = unrecScore.categories.find((c) => c.category === "pattern-match");

      expect(recPattern!.rawScore).toBeGreaterThan(unrecPattern!.rawScore);
    });
  });

  describe("Context Clarity (30 points)", () => {
    it("should contribute up to 30 points", () => {
      const error: ErrorForScoring = {
        message: "Error at file.ts:10",
        file: "file.ts",
        line: 10,
        stack: "at foo (file.ts:10)",
        codeContext: "const x = y;",
      };
      const fix: FixForScoring = { description: "Fix" };
      const score = scorer.score(error, fix);

      const contextScore = score.categories.find((c) => c.category === "context-clarity");
      expect(contextScore?.weightedScore).toBeLessThanOrEqual(30);
      expect(contextScore?.weight).toBe(30);
    });

    it("should score higher with more context", () => {
      const fullContext: ErrorForScoring = {
        message: "TypeError: Cannot read property at file.ts:42",
        file: "file.ts",
        line: 42,
        column: 10,
        stack: "at foo (file.ts:42)",
        codeContext: "const x = obj.prop;",
      };
      const noContext: ErrorForScoring = {
        message: "error",
      };
      const fix: FixForScoring = { description: "Fix" };

      const fullScore = scorer.score(fullContext, fix);
      const noScore = scorer.score(noContext, fix);

      const fullClarity = fullScore.categories.find((c) => c.category === "context-clarity");
      const noClarity = noScore.categories.find((c) => c.category === "context-clarity");

      expect(fullClarity!.rawScore).toBeGreaterThan(noClarity!.rawScore);
    });
  });

  describe("Fix Simplicity (30 points)", () => {
    it("should contribute up to 30 points", () => {
      const error: ErrorForScoring = { message: "Error" };
      const fix: FixForScoring = {
        description: "Simple one-line fix",
        files: ["app.ts"],
        linesChanged: 1,
        reversible: true,
      };
      const score = scorer.score(error, fix);

      const simplicityScore = score.categories.find((c) => c.category === "fix-simplicity");
      expect(simplicityScore?.weightedScore).toBeLessThanOrEqual(30);
      expect(simplicityScore?.weight).toBe(30);
    });

    it("should score higher for simpler fixes", () => {
      const error: ErrorForScoring = { message: "Error" };
      const simple: FixForScoring = {
        description: "Add null check",
        files: ["app.ts"],
        linesChanged: 2,
        reversible: true,
        complexity: 1,
      };
      const complex: FixForScoring = {
        description: "Refactor architecture",
        files: ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts"],
        linesChanged: 500,
        dependencies: ["new-lib", "another-lib"],
        reversible: false,
        complexity: 5,
      };

      const simpleScore = scorer.score(error, simple);
      const complexScore = scorer.score(error, complex);

      const simpleSimplicity = simpleScore.categories.find((c) => c.category === "fix-simplicity");
      const complexSimplicity = complexScore.categories.find((c) => c.category === "fix-simplicity");

      expect(simpleSimplicity!.rawScore).toBeGreaterThan(complexSimplicity!.rawScore);
    });
  });

  describe("Total Score", () => {
    it("should sum all category weighted scores", () => {
      const error: ErrorForScoring = { message: "Error" };
      const fix: FixForScoring = { description: "Fix" };
      const score = scorer.score(error, fix);

      const calculatedTotal = score.categories.reduce((sum, cat) => sum + cat.weightedScore, 0);
      expect(Math.abs(score.total - calculatedTotal)).toBeLessThan(0.01);
    });

    it("should be between 0 and 100", () => {
      const testCases = [
        { error: { message: "x" }, fix: { description: "y" } },
        {
          error: { message: "TypeError: x", type: "TypeError", file: "a.ts", line: 1, stack: "at x" },
          fix: { description: "Fix", files: ["a.ts"], linesChanged: 1, reversible: true },
        },
      ];

      testCases.forEach(({ error, fix }) => {
        const score = scorer.score(error, fix);
        expect(score.total).toBeGreaterThanOrEqual(0);
        expect(score.total).toBeLessThanOrEqual(100);
      });
    });
  });
});
