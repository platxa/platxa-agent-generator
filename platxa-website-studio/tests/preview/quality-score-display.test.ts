/**
 * Tests for Quality Score Display
 *
 * Feature #112: Create quality score display after generation completion
 * Verification: Shows 'Quality: 85/100' with breakdown (syntax, a11y, structure)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  QualityScoreDisplay,
  createQualityScoreDisplay,
  CATEGORY_LABELS,
  CATEGORY_SHORT_LABELS,
  DEFAULT_CATEGORY_WEIGHTS,
  GRADE_THRESHOLDS,
  SCORE_COLORS,
  getGrade,
  getScoreColor,
  getScoreStatus,
  formatScore,
  formatCategoryScore,
  calculateWeightedAverage,
  normalizeWeights,
  createSyntaxCheck,
  createA11yCheck,
  createStructureCheck,
  createPerformanceCheck,
  createQualityCheck,
  type QualityCategory,
  type QualityCheck,
} from "../../lib/preview/quality-score-display";

describe("QualityScoreDisplay", () => {
  let display: QualityScoreDisplay;

  beforeEach(() => {
    display = createQualityScoreDisplay();
  });

  afterEach(() => {
    display.dispose();
  });

  describe("utility functions", () => {
    describe("getGrade", () => {
      it("should return A+ for scores >= 95", () => {
        expect(getGrade(100)).toBe("A+");
        expect(getGrade(95)).toBe("A+");
      });

      it("should return A for scores >= 85", () => {
        expect(getGrade(94)).toBe("A");
        expect(getGrade(85)).toBe("A");
      });

      it("should return B for scores >= 70", () => {
        expect(getGrade(84)).toBe("B");
        expect(getGrade(70)).toBe("B");
      });

      it("should return C for scores >= 55", () => {
        expect(getGrade(69)).toBe("C");
        expect(getGrade(55)).toBe("C");
      });

      it("should return D for scores >= 40", () => {
        expect(getGrade(54)).toBe("D");
        expect(getGrade(40)).toBe("D");
      });

      it("should return F for scores < 40", () => {
        expect(getGrade(39)).toBe("F");
        expect(getGrade(0)).toBe("F");
      });
    });

    describe("getScoreColor", () => {
      it("should return green for high scores", () => {
        expect(getScoreColor(100)).toBe("green");
        expect(getScoreColor(85)).toBe("green");
      });

      it("should return lime for good scores", () => {
        expect(getScoreColor(84)).toBe("lime");
        expect(getScoreColor(70)).toBe("lime");
      });

      it("should return yellow for fair scores", () => {
        expect(getScoreColor(69)).toBe("yellow");
        expect(getScoreColor(55)).toBe("yellow");
      });

      it("should return orange for poor scores", () => {
        expect(getScoreColor(54)).toBe("orange");
        expect(getScoreColor(40)).toBe("orange");
      });

      it("should return red for failing scores", () => {
        expect(getScoreColor(39)).toBe("red");
        expect(getScoreColor(0)).toBe("red");
      });
    });

    describe("getScoreStatus", () => {
      it("should return correct status", () => {
        expect(getScoreStatus(95)).toBe("excellent");
        expect(getScoreStatus(75)).toBe("good");
        expect(getScoreStatus(55)).toBe("fair");
        expect(getScoreStatus(35)).toBe("poor");
        expect(getScoreStatus(15)).toBe("failing");
      });
    });

    describe("formatScore", () => {
      it("should round to integer", () => {
        expect(formatScore(85)).toBe("85");
        expect(formatScore(85.4)).toBe("85");
        expect(formatScore(85.5)).toBe("86");
      });
    });

    describe("formatCategoryScore", () => {
      it("should format with short label", () => {
        expect(formatCategoryScore("syntax", 90)).toBe("syntax: 90");
        expect(formatCategoryScore("a11y", 80)).toBe("a11y: 80");
        expect(formatCategoryScore("structure", 85)).toBe("structure: 85");
      });
    });

    describe("calculateWeightedAverage", () => {
      it("should calculate weighted average", () => {
        const scores = [
          { score: 100, weight: 0.5 },
          { score: 50, weight: 0.5 },
        ];
        expect(calculateWeightedAverage(scores)).toBe(75);
      });

      it("should handle unequal weights", () => {
        const scores = [
          { score: 100, weight: 0.75 },
          { score: 0, weight: 0.25 },
        ];
        expect(calculateWeightedAverage(scores)).toBe(75);
      });

      it("should return 0 for empty array", () => {
        expect(calculateWeightedAverage([])).toBe(0);
      });

      it("should return 0 for zero total weight", () => {
        const scores = [
          { score: 100, weight: 0 },
          { score: 50, weight: 0 },
        ];
        expect(calculateWeightedAverage(scores)).toBe(0);
      });
    });

    describe("normalizeWeights", () => {
      it("should normalize weights to sum to 1", () => {
        const weights = normalizeWeights({ syntax: 2, a11y: 2 });
        const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
        expect(total).toBeCloseTo(1);
      });

      it("should use defaults for missing categories", () => {
        const weights = normalizeWeights({ syntax: 1 });
        expect(weights.syntax).toBeGreaterThan(0);
        expect(weights.a11y).toBeGreaterThan(0);
      });
    });
  });

  describe("check builders", () => {
    it("should create syntax check", () => {
      const check = createSyntaxCheck("syn-1", "Valid HTML", 90);
      expect(check.category).toBe("syntax");
      expect(check.id).toBe("syn-1");
      expect(check.score).toBe(90);
      expect(check.passed).toBe(true);
    });

    it("should create a11y check", () => {
      const check = createA11yCheck("a11y-1", "Alt text", 80);
      expect(check.category).toBe("a11y");
      expect(check.passed).toBe(true);
    });

    it("should create structure check", () => {
      const check = createStructureCheck("str-1", "Heading order", 60);
      expect(check.category).toBe("structure");
      expect(check.passed).toBe(false); // 60 < 70
    });

    it("should create performance check", () => {
      const check = createPerformanceCheck("perf-1", "Image size", 75);
      expect(check.category).toBe("performance");
      expect(check.passed).toBe(true);
    });

    it("should create generic check", () => {
      const check = createQualityCheck("seo", "seo-1", "Meta tags", 85);
      expect(check.category).toBe("seo");
      expect(check.score).toBe(85);
    });

    it("should clamp score to 0-100", () => {
      const low = createSyntaxCheck("syn-1", "Test", -10);
      const high = createSyntaxCheck("syn-2", "Test", 150);
      expect(low.score).toBe(0);
      expect(high.score).toBe(100);
    });

    it("should include issues when provided", () => {
      const check = createSyntaxCheck("syn-1", "Test", 80, {
        issues: [{ severity: "warning", message: "Minor issue" }],
      });
      expect(check.issues).toHaveLength(1);
      expect(check.issues![0].severity).toBe("warning");
    });
  });

  describe("addCheck", () => {
    it("should add a check", () => {
      const check = createSyntaxCheck("syn-1", "Test", 90);
      display.addCheck(check);

      expect(display.getCheck("syn-1")).toEqual(check);
    });

    it("should replace existing check with same id", () => {
      display.addCheck(createSyntaxCheck("syn-1", "Test", 90));
      display.addCheck(createSyntaxCheck("syn-1", "Updated", 80));

      const check = display.getCheck("syn-1");
      expect(check?.name).toBe("Updated");
      expect(check?.score).toBe(80);
    });

    it("should throw if disposed", () => {
      display.dispose();
      expect(() =>
        display.addCheck(createSyntaxCheck("syn-1", "Test", 90))
      ).toThrow("QualityScoreDisplay is disposed");
    });
  });

  describe("addChecks", () => {
    it("should add multiple checks", () => {
      display.addChecks([
        createSyntaxCheck("syn-1", "Test 1", 90),
        createA11yCheck("a11y-1", "Test 2", 85),
      ]);

      expect(display.getAllChecks()).toHaveLength(2);
    });
  });

  describe("removeCheck", () => {
    it("should remove a check", () => {
      display.addCheck(createSyntaxCheck("syn-1", "Test", 90));
      expect(display.removeCheck("syn-1")).toBe(true);
      expect(display.getCheck("syn-1")).toBeUndefined();
    });

    it("should return false for non-existent check", () => {
      expect(display.removeCheck("non-existent")).toBe(false);
    });
  });

  describe("clearChecks", () => {
    it("should clear all checks", () => {
      display.addChecks([
        createSyntaxCheck("syn-1", "Test 1", 90),
        createA11yCheck("a11y-1", "Test 2", 85),
      ]);
      display.clearChecks();

      expect(display.getAllChecks()).toHaveLength(0);
    });
  });

  describe("getChecksByCategory", () => {
    it("should return checks by category", () => {
      display.addChecks([
        createSyntaxCheck("syn-1", "Test 1", 90),
        createSyntaxCheck("syn-2", "Test 2", 85),
        createA11yCheck("a11y-1", "Test 3", 80),
      ]);

      const syntaxChecks = display.getChecksByCategory("syntax");
      expect(syntaxChecks).toHaveLength(2);
      expect(syntaxChecks.every((c) => c.category === "syntax")).toBe(true);
    });
  });

  describe("calculateScore", () => {
    it("should calculate overall score", () => {
      display.addChecks([
        createSyntaxCheck("syn-1", "Test", 90),
        createA11yCheck("a11y-1", "Test", 80),
        createStructureCheck("str-1", "Test", 85),
      ]);

      const score = display.calculateScore();
      expect(score.overall).toBeGreaterThan(0);
      expect(score.overall).toBeLessThanOrEqual(100);
    });

    it("should return 100 for no checks", () => {
      const score = display.calculateScore();
      expect(score.overall).toBe(100);
      expect(score.grade).toBe("A+");
    });

    it("should include category breakdown", () => {
      display.addChecks([
        createSyntaxCheck("syn-1", "Test", 90),
        createA11yCheck("a11y-1", "Test", 80),
      ]);

      const score = display.calculateScore();
      expect(score.categories.length).toBe(6); // All categories

      const syntaxCat = score.categories.find((c) => c.category === "syntax");
      expect(syntaxCat?.score).toBe(90);

      const a11yCat = score.categories.find((c) => c.category === "a11y");
      expect(a11yCat?.score).toBe(80);
    });

    it("should count passed and failed checks", () => {
      display.addChecks([
        createSyntaxCheck("syn-1", "Test", 90), // passed
        createSyntaxCheck("syn-2", "Test", 60), // failed
        createA11yCheck("a11y-1", "Test", 80),  // passed
      ]);

      const score = display.calculateScore();
      expect(score.totalChecks).toBe(3);
      expect(score.passedChecks).toBe(2);
      expect(score.failedChecks).toBe(1);
    });

    it("should count issues", () => {
      display.addChecks([
        createSyntaxCheck("syn-1", "Test", 80, {
          issues: [
            { severity: "error", message: "Issue 1" },
            { severity: "warning", message: "Issue 2" },
          ],
        }),
        createA11yCheck("a11y-1", "Test", 70, {
          issues: [{ severity: "info", message: "Issue 3" }],
        }),
      ]);

      const score = display.calculateScore();
      expect(score.totalIssues).toBe(3);
    });

    it("should cache score until invalidated", () => {
      display.addCheck(createSyntaxCheck("syn-1", "Test", 90));

      const score1 = display.calculateScore();
      const score2 = display.calculateScore();

      // Same reference means cached
      expect(score1).toBe(score2);

      // Adding check invalidates cache
      display.addCheck(createSyntaxCheck("syn-2", "Test", 80));
      const score3 = display.calculateScore();
      expect(score3).not.toBe(score1);
    });
  });

  describe("getDisplay", () => {
    it("should return formatted display", () => {
      display.addChecks([
        createSyntaxCheck("syn-1", "Test", 90),
        createA11yCheck("a11y-1", "Test", 80),
        createStructureCheck("str-1", "Test", 85),
      ]);

      const result = display.getDisplay();
      expect(result.text).toContain("Quality:");
      expect(result.text).toContain("/100");
      expect(result.score).toBeGreaterThan(0);
    });

    it("should include breakdown", () => {
      display.addChecks([
        createSyntaxCheck("syn-1", "Test", 90),
        createA11yCheck("a11y-1", "Test", 80),
        createStructureCheck("str-1", "Test", 85),
      ]);

      const result = display.getDisplay({ showBreakdown: true });
      expect(result.breakdown).toHaveLength(3);
      expect(result.breakdownText).toContain("syntax:");
      expect(result.breakdownText).toContain("a11y:");
      expect(result.breakdownText).toContain("structure:");
    });

    it("should include grade when requested", () => {
      display.addCheck(createSyntaxCheck("syn-1", "Test", 90));

      const result = display.getDisplay({ showGrade: true });
      expect(result.text).toContain("(");
      expect(result.grade).toBeDefined();
    });

    it("should respect custom breakdown categories", () => {
      display.addChecks([
        createSyntaxCheck("syn-1", "Test", 90),
        createA11yCheck("a11y-1", "Test", 80),
        createStructureCheck("str-1", "Test", 85),
        createPerformanceCheck("perf-1", "Test", 75),
      ]);

      const result = display.getDisplay({
        breakdownCategories: ["syntax", "performance"],
      });
      expect(result.breakdown).toHaveLength(2);
      expect(result.breakdownText).toContain("syntax:");
      expect(result.breakdownText).toContain("perf:");
      expect(result.breakdownText).not.toContain("a11y:");
    });
  });

  describe("getHeaderDisplay", () => {
    it("should show 'Quality: 85/100' format", () => {
      // Add checks to get approximately 85 overall
      display.addChecks([
        createSyntaxCheck("syn-1", "Test", 85),
        createA11yCheck("a11y-1", "Test", 85),
        createStructureCheck("str-1", "Test", 85),
      ]);

      const header = display.getHeaderDisplay();
      expect(header.text).toBe("Quality: 85/100");
    });

    it("should include breakdown (syntax, a11y, structure)", () => {
      display.addChecks([
        createSyntaxCheck("syn-1", "Test", 90),
        createA11yCheck("a11y-1", "Test", 80),
        createStructureCheck("str-1", "Test", 85),
      ]);

      const header = display.getHeaderDisplay();
      expect(header.breakdown).toContain("syntax: 90");
      expect(header.breakdown).toContain("a11y: 80");
      expect(header.breakdown).toContain("structure: 85");
    });
  });

  describe("isPassing", () => {
    it("should return true for passing scores", () => {
      display.addCheck(createSyntaxCheck("syn-1", "Test", 90));
      expect(display.isPassing()).toBe(true);
    });

    it("should return false for failing scores", () => {
      display.addCheck(createSyntaxCheck("syn-1", "Test", 50));
      expect(display.isPassing()).toBe(false);
    });

    it("should respect custom passing score", () => {
      display.setPassingScore(90);
      display.addCheck(createSyntaxCheck("syn-1", "Test", 85));
      expect(display.isPassing()).toBe(false);
    });
  });

  describe("category weights", () => {
    it("should allow setting custom weights", () => {
      display.setCategoryWeight("syntax", 0.5);
      const weights = display.getCategoryWeights();
      expect(weights.syntax).toBeGreaterThan(0);
    });

    it("should affect score calculation", () => {
      const heavySyntax = createQualityScoreDisplay({
        categoryWeights: { syntax: 1, a11y: 0, structure: 0 },
      });

      heavySyntax.addChecks([
        createSyntaxCheck("syn-1", "Test", 100),
        createA11yCheck("a11y-1", "Test", 0),
        createStructureCheck("str-1", "Test", 0),
      ]);

      const score = heavySyntax.calculateScore();
      // Syntax is weighted heavily, so overall should be close to 100
      expect(score.overall).toBeGreaterThan(80);

      heavySyntax.dispose();
    });
  });

  describe("subscribe", () => {
    it("should call callback on check changes", () => {
      const callback = vi.fn();
      display.subscribe(callback);

      display.addCheck(createSyntaxCheck("syn-1", "Test", 90));

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          overall: expect.any(Number),
        })
      );
    });

    it("should allow unsubscribing", () => {
      const callback = vi.fn();
      const unsubscribe = display.subscribe(callback);

      display.addCheck(createSyntaxCheck("syn-1", "Test", 90));
      unsubscribe();
      display.addCheck(createSyntaxCheck("syn-2", "Test", 85));

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should throw if disposed", () => {
      display.dispose();
      expect(() => display.subscribe(() => {})).toThrow(
        "QualityScoreDisplay is disposed"
      );
    });

    it("should handle callback errors gracefully", () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const errorCallback = vi.fn(() => {
        throw new Error("Callback error");
      });

      display.subscribe(errorCallback);

      expect(() =>
        display.addCheck(createSyntaxCheck("syn-1", "Test", 90))
      ).not.toThrow();

      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe("refresh", () => {
    it("should recalculate and notify", () => {
      const callback = vi.fn();
      display.subscribe(callback);
      display.addCheck(createSyntaxCheck("syn-1", "Test", 90));

      callback.mockClear();
      display.refresh();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should throw if disposed", () => {
      display.dispose();
      expect(() => display.refresh()).toThrow("QualityScoreDisplay is disposed");
    });
  });

  describe("dispose", () => {
    it("should mark as disposed", () => {
      expect(display.isDisposed()).toBe(false);
      display.dispose();
      expect(display.isDisposed()).toBe(true);
    });

    it("should be idempotent", () => {
      display.dispose();
      expect(() => display.dispose()).not.toThrow();
    });

    it("should clear callbacks and checks", () => {
      const callback = vi.fn();
      display.subscribe(callback);
      display.addCheck(createSyntaxCheck("syn-1", "Test", 90));

      display.dispose();

      expect(display.getAllChecks()).toHaveLength(0);
    });
  });
});

describe("constants", () => {
  it("should have labels for all categories", () => {
    const categories: QualityCategory[] = [
      "syntax", "a11y", "structure", "performance", "seo", "security"
    ];

    for (const cat of categories) {
      expect(CATEGORY_LABELS[cat]).toBeDefined();
      expect(CATEGORY_SHORT_LABELS[cat]).toBeDefined();
      expect(DEFAULT_CATEGORY_WEIGHTS[cat]).toBeDefined();
    }
  });

  it("should have grade thresholds in descending order", () => {
    for (let i = 1; i < GRADE_THRESHOLDS.length; i++) {
      expect(GRADE_THRESHOLDS[i - 1].min).toBeGreaterThan(
        GRADE_THRESHOLDS[i].min
      );
    }
  });

  it("should have score colors in descending order", () => {
    for (let i = 1; i < SCORE_COLORS.length; i++) {
      expect(SCORE_COLORS[i - 1].min).toBeGreaterThan(SCORE_COLORS[i].min);
    }
  });
});

describe("verification tests", () => {
  it("should show 'Quality: 85/100' with breakdown (syntax, a11y, structure)", () => {
    const display = createQualityScoreDisplay();

    // Add checks to get exactly 85 overall
    display.addChecks([
      createSyntaxCheck("syn-1", "Valid HTML", 85),
      createA11yCheck("a11y-1", "Alt text", 85),
      createStructureCheck("str-1", "Heading order", 85),
    ]);

    const header = display.getHeaderDisplay();

    expect(header.text).toBe("Quality: 85/100");
    expect(header.breakdown).toContain("syntax: 85");
    expect(header.breakdown).toContain("a11y: 85");
    expect(header.breakdown).toContain("structure: 85");

    display.dispose();
  });

  it("should correctly calculate score as 85", () => {
    const display = createQualityScoreDisplay();

    display.addChecks([
      createSyntaxCheck("syn-1", "Test", 85),
      createA11yCheck("a11y-1", "Test", 85),
      createStructureCheck("str-1", "Test", 85),
    ]);

    const score = display.calculateScore();
    expect(Math.round(score.overall)).toBe(85);

    display.dispose();
  });

  it("should format display with correct breakdown categories", () => {
    const display = createQualityScoreDisplay();

    display.addChecks([
      createSyntaxCheck("syn-1", "Valid syntax", 90),
      createA11yCheck("a11y-1", "Accessibility", 80),
      createStructureCheck("str-1", "Good structure", 85),
    ]);

    const result = display.getDisplay({
      showBreakdown: true,
      breakdownCategories: ["syntax", "a11y", "structure"],
    });

    expect(result.breakdown).toEqual([
      "syntax: 90",
      "a11y: 80",
      "structure: 85",
    ]);

    display.dispose();
  });
});
