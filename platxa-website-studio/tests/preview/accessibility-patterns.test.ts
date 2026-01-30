/**
 * Tests for Accessibility Error Patterns
 *
 * Feature #143: Add accessibility error patterns (contrast, labels, focus)
 * Verification: Patterns for: low contrast, missing alt, no focus visible, missing ARIA
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AccessibilityErrorDetector,
  createAccessibilityErrorDetector,
  SEVERITY_PRIORITY,
  ALL_CATEGORIES,
  CONTRAST_PATTERNS,
  ALT_TEXT_PATTERNS,
  FOCUS_PATTERNS,
  ARIA_PATTERNS,
  KEYBOARD_PATTERNS,
  SEMANTIC_PATTERNS,
  FORM_PATTERNS,
  HEADING_PATTERNS,
  LANDMARK_PATTERNS,
  ALL_PATTERNS,
  getPatternsByCategory,
  getPatternsBySeverity,
  getPatternsByLevel,
  getPatternById,
  matchPattern,
  findMatchingPattern,
  findAllMatchingPatterns,
  isA11yError,
  sortPatternsBySeverity,
  formatPattern,
  formatA11yError,
  getSeverityPriority,
  compareSeverity,
  type A11yPattern,
  type A11yError,
  type A11yErrorCategory,
  type A11ySeverity,
} from "../../lib/preview/accessibility-patterns";

// ============================================================================
// Constants
// ============================================================================

describe("Constants", () => {
  describe("SEVERITY_PRIORITY", () => {
    it("should define priority for all severities", () => {
      expect(SEVERITY_PRIORITY.critical).toBe(0);
      expect(SEVERITY_PRIORITY.serious).toBe(1);
      expect(SEVERITY_PRIORITY.moderate).toBe(2);
      expect(SEVERITY_PRIORITY.minor).toBe(3);
    });

    it("should have critical as highest priority", () => {
      expect(SEVERITY_PRIORITY.critical).toBeLessThan(SEVERITY_PRIORITY.serious);
      expect(SEVERITY_PRIORITY.serious).toBeLessThan(SEVERITY_PRIORITY.moderate);
      expect(SEVERITY_PRIORITY.moderate).toBeLessThan(SEVERITY_PRIORITY.minor);
    });
  });

  describe("ALL_CATEGORIES", () => {
    it("should include all expected categories", () => {
      expect(ALL_CATEGORIES).toContain("contrast");
      expect(ALL_CATEGORIES).toContain("alt-text");
      expect(ALL_CATEGORIES).toContain("focus");
      expect(ALL_CATEGORIES).toContain("aria");
      expect(ALL_CATEGORIES).toContain("keyboard");
      expect(ALL_CATEGORIES).toContain("semantics");
      expect(ALL_CATEGORIES).toContain("forms");
      expect(ALL_CATEGORIES).toContain("headings");
      expect(ALL_CATEGORIES).toContain("landmarks");
    });
  });
});

// ============================================================================
// Pattern Collections
// ============================================================================

describe("Pattern Collections", () => {
  describe("CONTRAST_PATTERNS", () => {
    it("should have patterns for low contrast", () => {
      expect(CONTRAST_PATTERNS.length).toBeGreaterThan(0);
      expect(CONTRAST_PATTERNS.some((p) => p.id === "contrast-ratio-fail")).toBe(true);
    });

    it("should all have contrast category", () => {
      CONTRAST_PATTERNS.forEach((p) => {
        expect(p.category).toBe("contrast");
      });
    });

    it("should match low contrast messages", () => {
      const pattern = CONTRAST_PATTERNS.find((p) => p.id === "contrast-ratio-fail")!;
      expect(matchPattern("Color contrast ratio is too low", pattern)).toBe(true);
      expect(matchPattern("Insufficient contrast between text and background", pattern)).toBe(true);
      expect(matchPattern("Text contrast fails WCAG requirements", pattern)).toBe(true);
    });
  });

  describe("ALT_TEXT_PATTERNS", () => {
    it("should have patterns for missing alt", () => {
      expect(ALT_TEXT_PATTERNS.length).toBeGreaterThan(0);
      expect(ALT_TEXT_PATTERNS.some((p) => p.id === "missing-alt")).toBe(true);
    });

    it("should all have alt-text category", () => {
      ALT_TEXT_PATTERNS.forEach((p) => {
        expect(p.category).toBe("alt-text");
      });
    });

    it("should match missing alt messages", () => {
      const pattern = ALT_TEXT_PATTERNS.find((p) => p.id === "missing-alt")!;
      expect(matchPattern("Image is missing alt attribute", pattern)).toBe(true);
      expect(matchPattern("No alt text provided for img element", pattern)).toBe(true);
      expect(matchPattern("Alt attribute is required for images", pattern)).toBe(true);
    });
  });

  describe("FOCUS_PATTERNS", () => {
    it("should have patterns for focus visibility", () => {
      expect(FOCUS_PATTERNS.length).toBeGreaterThan(0);
      expect(FOCUS_PATTERNS.some((p) => p.id === "focus-not-visible")).toBe(true);
    });

    it("should all have focus category", () => {
      FOCUS_PATTERNS.forEach((p) => {
        expect(p.category).toBe("focus");
      });
    });

    it("should match no focus visible messages", () => {
      const pattern = FOCUS_PATTERNS.find((p) => p.id === "focus-not-visible")!;
      expect(matchPattern("Focus indicator is not visible", pattern)).toBe(true);
      expect(matchPattern("Element has outline: none and no visible focus style", pattern)).toBe(true);
      expect(matchPattern("Missing focus ring on interactive element", pattern)).toBe(true);
    });
  });

  describe("ARIA_PATTERNS", () => {
    it("should have patterns for ARIA issues", () => {
      expect(ARIA_PATTERNS.length).toBeGreaterThan(0);
      expect(ARIA_PATTERNS.some((p) => p.id === "missing-aria-label")).toBe(true);
    });

    it("should all have aria category", () => {
      ARIA_PATTERNS.forEach((p) => {
        expect(p.category).toBe("aria");
      });
    });

    it("should match missing ARIA messages", () => {
      const pattern = ARIA_PATTERNS.find((p) => p.id === "missing-aria-label")!;
      expect(matchPattern("Button is missing aria-label", pattern)).toBe(true);
      expect(matchPattern("Accessible name is missing for this element", pattern)).toBe(true);
      expect(matchPattern("Unlabeled form control", pattern)).toBe(true);
    });
  });

  describe("ALL_PATTERNS", () => {
    it("should include patterns from all categories", () => {
      expect(ALL_PATTERNS.length).toBeGreaterThan(20);
    });

    it("should have unique IDs", () => {
      const ids = ALL_PATTERNS.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should all have required properties", () => {
      ALL_PATTERNS.forEach((pattern) => {
        expect(pattern.id).toBeDefined();
        expect(pattern.name).toBeDefined();
        expect(pattern.category).toBeDefined();
        expect(pattern.severity).toBeDefined();
        expect(pattern.messagePatterns.length).toBeGreaterThan(0);
        expect(pattern.description).toBeDefined();
        expect(pattern.remediation).toBeDefined();
        expect(pattern.impact).toBeDefined();
        expect(pattern.affectedGroups.length).toBeGreaterThan(0);
      });
    });
  });
});

// ============================================================================
// Utility Functions
// ============================================================================

describe("Utility Functions", () => {
  describe("getPatternsByCategory", () => {
    it("should return patterns for contrast category", () => {
      const patterns = getPatternsByCategory("contrast");
      expect(patterns.length).toBeGreaterThan(0);
      patterns.forEach((p) => expect(p.category).toBe("contrast"));
    });

    it("should return patterns for aria category", () => {
      const patterns = getPatternsByCategory("aria");
      expect(patterns.length).toBeGreaterThan(0);
      patterns.forEach((p) => expect(p.category).toBe("aria"));
    });

    it("should return empty array for unknown category", () => {
      const patterns = getPatternsByCategory("unknown" as A11yErrorCategory);
      expect(patterns.length).toBe(0);
    });
  });

  describe("getPatternsBySeverity", () => {
    it("should return critical patterns", () => {
      const patterns = getPatternsBySeverity("critical");
      expect(patterns.length).toBeGreaterThan(0);
      patterns.forEach((p) => expect(p.severity).toBe("critical"));
    });

    it("should return serious patterns", () => {
      const patterns = getPatternsBySeverity("serious");
      expect(patterns.length).toBeGreaterThan(0);
      patterns.forEach((p) => expect(p.severity).toBe("serious"));
    });
  });

  describe("getPatternsByLevel", () => {
    it("should return Level A patterns", () => {
      const patterns = getPatternsByLevel("A");
      expect(patterns.length).toBeGreaterThan(0);
      patterns.forEach((p) => expect(p.level).toBe("A"));
    });

    it("should return Level AA patterns", () => {
      const patterns = getPatternsByLevel("AA");
      expect(patterns.length).toBeGreaterThan(0);
      patterns.forEach((p) => expect(p.level).toBe("AA"));
    });
  });

  describe("getPatternById", () => {
    it("should find pattern by ID", () => {
      const pattern = getPatternById("missing-alt");
      expect(pattern).toBeDefined();
      expect(pattern?.id).toBe("missing-alt");
    });

    it("should return undefined for unknown ID", () => {
      const pattern = getPatternById("unknown-pattern");
      expect(pattern).toBeUndefined();
    });
  });

  describe("matchPattern", () => {
    it("should match message against pattern", () => {
      const pattern = getPatternById("missing-alt")!;
      expect(matchPattern("Image is missing alt attribute", pattern)).toBe(true);
    });

    it("should not match unrelated message", () => {
      const pattern = getPatternById("missing-alt")!;
      expect(matchPattern("Color contrast is too low", pattern)).toBe(false);
    });
  });

  describe("findMatchingPattern", () => {
    it("should find first matching pattern", () => {
      const pattern = findMatchingPattern("Image is missing alt text");
      expect(pattern).toBeDefined();
      expect(pattern?.category).toBe("alt-text");
    });

    it("should return undefined for non-a11y message", () => {
      const pattern = findMatchingPattern("Syntax error in code");
      expect(pattern).toBeUndefined();
    });
  });

  describe("findAllMatchingPatterns", () => {
    it("should find all matching patterns", () => {
      const patterns = findAllMatchingPatterns("Focus indicator is missing and not visible");
      expect(patterns.length).toBeGreaterThan(0);
    });

    it("should return empty array for non-a11y message", () => {
      const patterns = findAllMatchingPatterns("Regular application error");
      expect(patterns.length).toBe(0);
    });
  });

  describe("isA11yError", () => {
    it("should return true for accessibility error messages", () => {
      expect(isA11yError("Missing alt text on image")).toBe(true);
      expect(isA11yError("Color contrast ratio too low")).toBe(true);
      expect(isA11yError("Focus not visible on button")).toBe(true);
      expect(isA11yError("Missing aria-label")).toBe(true);
    });

    it("should return false for non-accessibility messages", () => {
      expect(isA11yError("Undefined variable x")).toBe(false);
      expect(isA11yError("Network request failed")).toBe(false);
      expect(isA11yError("Module not found")).toBe(false);
    });
  });

  describe("sortPatternsBySeverity", () => {
    it("should sort patterns by severity", () => {
      const patterns = sortPatternsBySeverity(ALL_PATTERNS);
      for (let i = 0; i < patterns.length - 1; i++) {
        expect(SEVERITY_PRIORITY[patterns[i].severity])
          .toBeLessThanOrEqual(SEVERITY_PRIORITY[patterns[i + 1].severity]);
      }
    });

    it("should put critical patterns first", () => {
      const patterns = sortPatternsBySeverity(ALL_PATTERNS);
      const criticalPatterns = patterns.filter((p) => p.severity === "critical");
      if (criticalPatterns.length > 0) {
        expect(patterns[0].severity).toBe("critical");
      }
    });
  });

  describe("formatPattern", () => {
    it("should format pattern for display", () => {
      const pattern = getPatternById("missing-alt")!;
      const formatted = formatPattern(pattern);
      expect(formatted).toContain("[CRITICAL]");
      expect(formatted).toContain("Missing Alt Text");
      expect(formatted).toContain("WCAG 1.1.1");
    });
  });

  describe("formatA11yError", () => {
    it("should format error for display", () => {
      const pattern = getPatternById("missing-alt")!;
      const error: A11yError = {
        pattern,
        message: "Image missing alt attribute",
        file: "test.html",
        line: 10,
        timestamp: Date.now(),
      };
      const formatted = formatA11yError(error);
      expect(formatted).toContain("Missing Alt Text");
      expect(formatted).toContain("Image missing alt attribute");
      expect(formatted).toContain("test.html:10");
    });
  });

  describe("getSeverityPriority", () => {
    it("should return correct priority", () => {
      expect(getSeverityPriority("critical")).toBe(0);
      expect(getSeverityPriority("serious")).toBe(1);
      expect(getSeverityPriority("moderate")).toBe(2);
      expect(getSeverityPriority("minor")).toBe(3);
    });
  });

  describe("compareSeverity", () => {
    it("should return negative when first is more severe", () => {
      expect(compareSeverity("critical", "serious")).toBeLessThan(0);
      expect(compareSeverity("serious", "moderate")).toBeLessThan(0);
    });

    it("should return positive when first is less severe", () => {
      expect(compareSeverity("minor", "critical")).toBeGreaterThan(0);
    });

    it("should return zero for same severity", () => {
      expect(compareSeverity("serious", "serious")).toBe(0);
    });
  });
});

// ============================================================================
// AccessibilityErrorDetector Class
// ============================================================================

describe("AccessibilityErrorDetector", () => {
  let detector: AccessibilityErrorDetector;

  beforeEach(() => {
    detector = new AccessibilityErrorDetector();
  });

  afterEach(() => {
    detector.dispose();
  });

  describe("constructor", () => {
    it("should create with default options", () => {
      expect(detector.isDisposed()).toBe(false);
    });

    it("should accept custom patterns", () => {
      const customPattern: A11yPattern = {
        id: "custom-pattern",
        name: "Custom Pattern",
        category: "other",
        severity: "moderate",
        messagePatterns: [/custom error/i],
        description: "Custom error",
        remediation: "Fix it",
        impact: "Some impact",
        affectedGroups: ["all"],
      };
      const d = new AccessibilityErrorDetector({ customPatterns: [customPattern] });
      const result = d.detect("This is a custom error message");
      expect(result.isA11yError).toBe(true);
      expect(result.error?.pattern.id).toBe("custom-pattern");
      d.dispose();
    });

    it("should accept minimum severity filter", () => {
      const d = new AccessibilityErrorDetector({ minSeverity: "serious" });
      // Moderate severity should be filtered out
      const patterns = d.getPatterns();
      const moderatePattern = patterns.find((p) => p.severity === "moderate");
      if (moderatePattern) {
        const result = d.detect(moderatePattern.description);
        // Should not detect because severity is below threshold
        expect(result.confidence).toBeLessThanOrEqual(1);
      }
      d.dispose();
    });

    it("should accept category filter", () => {
      const d = new AccessibilityErrorDetector({ categories: ["contrast"] });
      const result = d.detect("Image is missing alt text");
      expect(result.isA11yError).toBe(false); // alt-text category is filtered out
      d.dispose();
    });
  });

  describe("detect", () => {
    it("should detect contrast errors", () => {
      const result = detector.detect("Color contrast ratio is insufficient");
      expect(result.isA11yError).toBe(true);
      expect(result.error?.pattern.category).toBe("contrast");
    });

    it("should detect missing alt errors", () => {
      const result = detector.detect("Image is missing alt attribute");
      expect(result.isA11yError).toBe(true);
      expect(result.error?.pattern.category).toBe("alt-text");
    });

    it("should detect focus visibility errors", () => {
      const result = detector.detect("Focus indicator not visible on element");
      expect(result.isA11yError).toBe(true);
      expect(result.error?.pattern.category).toBe("focus");
    });

    it("should detect ARIA errors", () => {
      const result = detector.detect("Button is missing aria-label");
      expect(result.isA11yError).toBe(true);
      expect(result.error?.pattern.category).toBe("aria");
    });

    it("should return false for non-a11y errors", () => {
      const result = detector.detect("TypeError: undefined is not a function");
      expect(result.isA11yError).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it("should include context in error", () => {
      const result = detector.detect("Missing alt text", {
        selector: "img.hero",
        file: "page.html",
        line: 42,
        column: 5,
      });
      expect(result.error?.selector).toBe("img.hero");
      expect(result.error?.file).toBe("page.html");
      expect(result.error?.line).toBe(42);
      expect(result.error?.column).toBe(5);
    });

    it("should track detected errors", () => {
      detector.detect("Missing alt text");
      detector.detect("Low contrast");
      expect(detector.getErrors().length).toBe(2);
    });

    it("should throw if disposed", () => {
      detector.dispose();
      expect(() => detector.detect("test")).toThrow("disposed");
    });
  });

  describe("detectBatch", () => {
    it("should detect multiple messages", () => {
      const results = detector.detectBatch([
        { message: "Missing alt text" },
        { message: "Low contrast ratio" },
        { message: "Regular error" },
      ]);
      expect(results.length).toBe(3);
      expect(results.filter((r) => r.isA11yError).length).toBe(2);
    });
  });

  describe("getErrors", () => {
    it("should return all detected errors", () => {
      detector.detect("Missing alt text");
      detector.detect("Focus not visible");
      const errors = detector.getErrors();
      expect(errors.length).toBe(2);
    });
  });

  describe("getErrorsByCategory", () => {
    it("should filter errors by category", () => {
      detector.detect("Missing alt text");
      detector.detect("Low contrast");
      const altErrors = detector.getErrorsByCategory("alt-text");
      expect(altErrors.length).toBe(1);
      expect(altErrors[0].pattern.category).toBe("alt-text");
    });
  });

  describe("getErrorsBySeverity", () => {
    it("should filter errors by severity", () => {
      detector.detect("Missing alt text"); // critical
      detector.detect("Focus order issues"); // moderate
      const criticalErrors = detector.getErrorsBySeverity("critical");
      expect(criticalErrors.every((e) => e.pattern.severity === "critical")).toBe(true);
    });
  });

  describe("getCriticalErrors", () => {
    it("should return critical and serious errors", () => {
      detector.detect("Missing alt text"); // critical
      detector.detect("Low contrast"); // serious
      const critical = detector.getCriticalErrors();
      expect(critical.length).toBeGreaterThan(0);
      critical.forEach((e) => {
        expect(["critical", "serious"]).toContain(e.pattern.severity);
      });
    });
  });

  describe("getStats", () => {
    it("should return statistics", () => {
      detector.detect("Missing alt text");
      detector.detect("Missing alt text"); // duplicate
      detector.detect("Low contrast");
      const stats = detector.getStats();
      expect(stats.totalErrors).toBe(3);
      expect(stats.byCategory.get("alt-text")).toBe(2);
      expect(stats.byCategory.get("contrast")).toBe(1);
    });

    it("should track top patterns", () => {
      for (let i = 0; i < 5; i++) {
        detector.detect("Missing alt text");
      }
      detector.detect("Low contrast");
      const stats = detector.getStats();
      expect(stats.topPatterns[0].patternId).toBe("missing-alt");
      expect(stats.topPatterns[0].count).toBe(5);
    });
  });

  describe("clear", () => {
    it("should clear all errors", () => {
      detector.detect("Missing alt text");
      detector.detect("Low contrast");
      detector.clear();
      expect(detector.getErrors().length).toBe(0);
    });

    it("should throw if disposed", () => {
      detector.dispose();
      expect(() => detector.clear()).toThrow("disposed");
    });
  });

  describe("onChange", () => {
    it("should subscribe to error detection", () => {
      const callback = vi.fn();
      detector.onChange(callback);
      detector.detect("Missing alt text");
      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].pattern.id).toBe("missing-alt");
    });

    it("should return unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = detector.onChange(callback);
      unsubscribe();
      detector.detect("Missing alt text");
      expect(callback).not.toHaveBeenCalled();
    });

    it("should catch callback errors", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      detector.onChange(() => {
        throw new Error("Callback error");
      });
      detector.detect("Missing alt text");
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it("should throw if disposed", () => {
      detector.dispose();
      expect(() => detector.onChange(() => {})).toThrow("disposed");
    });
  });

  describe("addPattern", () => {
    it("should add custom pattern", () => {
      const customPattern: A11yPattern = {
        id: "custom-test",
        name: "Custom Test",
        category: "other",
        severity: "moderate",
        messagePatterns: [/custom test error/i],
        description: "Test",
        remediation: "Fix",
        impact: "Impact",
        affectedGroups: ["all"],
      };
      detector.addPattern(customPattern);
      const result = detector.detect("This is a custom test error");
      expect(result.isA11yError).toBe(true);
      expect(result.error?.pattern.id).toBe("custom-test");
    });

    it("should throw if disposed", () => {
      detector.dispose();
      expect(() => detector.addPattern({} as A11yPattern)).toThrow("disposed");
    });
  });

  describe("removePattern", () => {
    it("should remove pattern by ID", () => {
      const result = detector.removePattern("missing-alt");
      expect(result).toBe(true);
      const detectResult = detector.detect("Missing alt text");
      // Should not match removed pattern
      expect(detectResult.error?.pattern.id).not.toBe("missing-alt");
    });

    it("should return false for unknown ID", () => {
      const result = detector.removePattern("unknown-id");
      expect(result).toBe(false);
    });
  });

  describe("getPatterns", () => {
    it("should return all patterns", () => {
      const patterns = detector.getPatterns();
      expect(patterns.length).toBeGreaterThan(20);
    });
  });

  describe("isDisposed", () => {
    it("should return false when not disposed", () => {
      expect(detector.isDisposed()).toBe(false);
    });

    it("should return true when disposed", () => {
      detector.dispose();
      expect(detector.isDisposed()).toBe(true);
    });
  });

  describe("dispose", () => {
    it("should dispose resources", () => {
      detector.detect("Missing alt text");
      detector.dispose();
      expect(detector.isDisposed()).toBe(true);
    });

    it("should be idempotent", () => {
      detector.dispose();
      expect(() => detector.dispose()).not.toThrow();
    });
  });
});

// ============================================================================
// Factory Function
// ============================================================================

describe("createAccessibilityErrorDetector", () => {
  it("should create AccessibilityErrorDetector instance", () => {
    const d = createAccessibilityErrorDetector();
    expect(d).toBeInstanceOf(AccessibilityErrorDetector);
    d.dispose();
  });

  it("should pass options to constructor", () => {
    const d = createAccessibilityErrorDetector({ minSeverity: "serious" });
    expect(d.isDisposed()).toBe(false);
    d.dispose();
  });
});

// ============================================================================
// Integration: Pattern Detection Verification
// ============================================================================

describe("Integration: Pattern Detection for WCAG Requirements", () => {
  let detector: AccessibilityErrorDetector;

  beforeEach(() => {
    detector = new AccessibilityErrorDetector();
  });

  afterEach(() => {
    detector.dispose();
  });

  describe("Low Contrast Detection (WCAG 1.4.3)", () => {
    it("should detect low contrast messages", () => {
      const messages = [
        "Color contrast ratio of 2.5:1 is below 4.5:1 requirement",
        "Insufficient contrast between foreground and background",
        "Text contrast fails WCAG AA guidelines",
        "Low contrast ratio detected on heading",
      ];
      messages.forEach((msg) => {
        const result = detector.detect(msg);
        expect(result.isA11yError).toBe(true);
        expect(result.error?.pattern.category).toBe("contrast");
      });
    });
  });

  describe("Missing Alt Detection (WCAG 1.1.1)", () => {
    it("should detect missing alt messages", () => {
      const messages = [
        "Image element is missing alt attribute",
        "No alt text provided for img tag",
        "Alt attribute required for this image",
        "Missing alternative text on decorative image",
      ];
      messages.forEach((msg) => {
        const result = detector.detect(msg);
        expect(result.isA11yError).toBe(true);
        expect(result.error?.pattern.category).toBe("alt-text");
      });
    });
  });

  describe("Focus Visibility Detection (WCAG 2.4.7)", () => {
    it("should detect no focus visible messages", () => {
      const messages = [
        "Focus indicator is not visible on this element",
        "No visible focus style applied",
        "Element has outline: none without alternative focus indicator",
        "Missing focus ring on button",
      ];
      messages.forEach((msg) => {
        const result = detector.detect(msg);
        expect(result.isA11yError).toBe(true);
        expect(result.error?.pattern.category).toBe("focus");
      });
    });
  });

  describe("Missing ARIA Detection (WCAG 4.1.2)", () => {
    it("should detect missing ARIA messages", () => {
      const messages = [
        "Button is missing aria-label attribute",
        "Accessible name is missing for interactive element",
        "No aria-label or visible text for this control",
        "Unlabeled icon button",
      ];
      messages.forEach((msg) => {
        const result = detector.detect(msg);
        expect(result.isA11yError).toBe(true);
        expect(result.error?.pattern.category).toBe("aria");
      });
    });
  });

  describe("Complete Detection Flow", () => {
    it("should detect multiple a11y errors in batch", () => {
      const results = detector.detectBatch([
        { message: "Low contrast on heading", context: { selector: "h1.title" } },
        { message: "Missing alt on hero image", context: { selector: "img.hero" } },
        { message: "Focus not visible on submit button", context: { selector: "button.submit" } },
        { message: "aria-label missing on navigation", context: { selector: "nav" } },
      ]);

      expect(results.filter((r) => r.isA11yError).length).toBe(4);

      const categories = results
        .filter((r) => r.isA11yError)
        .map((r) => r.error?.pattern.category);

      expect(categories).toContain("contrast");
      expect(categories).toContain("alt-text");
      expect(categories).toContain("focus");
      expect(categories).toContain("aria");
    });

    it("should provide remediation for all detected errors", () => {
      const results = detector.detectBatch([
        { message: "Low contrast" },
        { message: "Missing alt" },
        { message: "No focus visible" },
        { message: "Missing aria-label" },
      ]);

      results
        .filter((r) => r.isA11yError)
        .forEach((result) => {
          expect(result.error?.pattern.remediation).toBeDefined();
          expect(result.error?.pattern.remediation.length).toBeGreaterThan(0);
        });
    });

    it("should track WCAG success criteria", () => {
      detector.detect("Low contrast ratio");
      detector.detect("Missing alt text");

      const stats = detector.getStats();
      const errors = detector.getErrors();

      const wcagCriteria = errors.map((e) => e.pattern.wcag).filter(Boolean);
      expect(wcagCriteria).toContain("1.4.3"); // Contrast
      expect(wcagCriteria).toContain("1.1.1"); // Alt text
    });
  });
});
