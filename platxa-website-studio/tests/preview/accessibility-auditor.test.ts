// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AccessibilityAuditor,
  createAccessibilityAuditor,
  createAuditorWithFixer,
  createMockFixFunction,
  getRulesForLevel,
  getRulesByCategory,
  getRulesBySeverity,
  checkHtmlAccessibility,
  hasBlockingViolations,
  getBlockingViolations,
  formatViolation,
  BUILT_IN_RULES,
  type AuditResult,
  type AccessibilityViolation,
  type WCAGLevel,
} from "@/lib/preview/accessibility-auditor";

describe("AccessibilityAuditor", () => {
  describe("validation phase includes accessibility check (Feature #164)", () => {
    it("runs accessibility check during validation", () => {
      // Feature #164: Validation phase includes accessibility check
      const auditor = createAccessibilityAuditor();
      const html = '<html><body><img src="test.jpg"></body></html>';

      const result = auditor.runValidation(html);

      expect(result.rulesApplied).toBeGreaterThan(0);
      expect(result.elementsChecked).toBeGreaterThan(0);
    });

    it("detects accessibility violations", () => {
      // Feature #164: Accessibility check finds violations
      const auditor = createAccessibilityAuditor();
      const html = '<img src="test.jpg"><button></button>';

      const result = auditor.audit(html);

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.passed).toBe(false);
    });

    it("passes when no violations", () => {
      // Feature #164: Validation passes with accessible content
      const auditor = createAccessibilityAuditor();
      const html = '<img src="test.jpg" alt="Description"><button>Click me</button>';

      const result = auditor.audit(html);

      // May have other violations but img and button should pass
      const imgViolations = result.violations.filter((v) => v.rule.id === "img-alt");
      const buttonViolations = result.violations.filter((v) => v.rule.id === "button-name");

      expect(imgViolations.length).toBe(0);
      expect(buttonViolations.length).toBe(0);
    });
  });

  describe("failures trigger fix loop (Feature #164)", () => {
    it("triggers fix loop on violations", async () => {
      // Feature #164: Failures trigger fix loop
      const fixFn = createMockFixFunction(1);
      const auditor = createAuditorWithFixer(fixFn);
      const html = '<img src="test.jpg">';

      const result = auditor.audit(html);
      const fixLoop = await auditor.triggerFixLoop(result.violations);

      expect(fixLoop.attempts.length).toBeGreaterThan(0);
    });

    it("retries fix up to maxFixAttempts", async () => {
      // Feature #164: Fix loop retries
      const fixFn = createMockFixFunction(3); // Succeeds on 3rd attempt
      const auditor = createAuditorWithFixer(fixFn, { maxFixAttempts: 3 });
      const html = '<img src="test.jpg">';

      const result = auditor.audit(html);
      const fixLoop = await auditor.triggerFixLoop(result.violations);

      // Should have 3 attempts for the violation
      const attemptsForFirst = fixLoop.attempts.filter(
        (a) => a.violation.id === result.violations[0]?.id
      );
      expect(attemptsForFirst.length).toBe(3);
      expect(attemptsForFirst[2]?.success).toBe(true);
    });

    it("reports remaining violations after fix loop", async () => {
      // Feature #164: Fix loop reports results
      const fixFn = vi.fn().mockResolvedValue({
        violation: {} as AccessibilityViolation,
        fixApplied: "",
        success: false,
        error: "Cannot fix",
        timestamp: Date.now(),
      });

      const auditor = createAuditorWithFixer(fixFn, { maxFixAttempts: 1 });
      const html = '<img src="test.jpg">';

      const result = auditor.audit(html);
      const fixLoop = await auditor.triggerFixLoop(result.violations);

      expect(fixLoop.remainingViolations).toBe(result.violations.length);
      expect(fixLoop.allFixed).toBe(false);
    });

    it("validateAndFix runs audit then fix loop", async () => {
      // Feature #164: Integrated validation and fix
      const fixFn = createMockFixFunction(1);
      const auditor = createAuditorWithFixer(fixFn);
      const html = '<img src="test.jpg">';

      const { audit, fixLoop } = await auditor.validateAndFix(html);

      expect(audit).toBeDefined();
      expect(audit.violations.length).toBeGreaterThan(0);
      expect(fixLoop).toBeDefined();
      expect(fixLoop!.attempts.length).toBeGreaterThan(0);
    });
  });

  describe("BUILT_IN_RULES", () => {
    it("includes img-alt rule", () => {
      const rule = BUILT_IN_RULES.find((r) => r.id === "img-alt");

      expect(rule).toBeDefined();
      expect(rule!.severity).toBe("critical");
      expect(rule!.level).toBe("A");
    });

    it("includes button-name rule", () => {
      const rule = BUILT_IN_RULES.find((r) => r.id === "button-name");

      expect(rule).toBeDefined();
      expect(rule!.category).toBe("name-role");
    });

    it("includes color-contrast rule", () => {
      const rule = BUILT_IN_RULES.find((r) => r.id === "color-contrast");

      expect(rule).toBeDefined();
      expect(rule!.level).toBe("AA");
    });
  });

  describe("getRulesForLevel", () => {
    it("returns only A level rules for level A", () => {
      const rules = getRulesForLevel(BUILT_IN_RULES, "A");

      expect(rules.every((r) => r.level === "A")).toBe(true);
    });

    it("returns A and AA rules for level AA", () => {
      const rules = getRulesForLevel(BUILT_IN_RULES, "AA");
      const levels = new Set(rules.map((r) => r.level));

      expect(levels.has("A")).toBe(true);
      expect(levels.has("AA")).toBe(true);
      expect(levels.has("AAA")).toBe(false);
    });

    it("returns all rules for level AAA", () => {
      const rules = getRulesForLevel(BUILT_IN_RULES, "AAA");

      expect(rules.length).toBe(BUILT_IN_RULES.length);
    });
  });

  describe("getRulesByCategory", () => {
    it("filters rules by category", () => {
      const rules = getRulesByCategory(BUILT_IN_RULES, "aria");

      expect(rules.length).toBeGreaterThan(0);
      expect(rules.every((r) => r.category === "aria")).toBe(true);
    });
  });

  describe("getRulesBySeverity", () => {
    it("filters rules by severity", () => {
      const rules = getRulesBySeverity(BUILT_IN_RULES, "critical");

      expect(rules.length).toBeGreaterThan(0);
      expect(rules.every((r) => r.severity === "critical")).toBe(true);
    });
  });

  describe("checkHtmlAccessibility", () => {
    it("detects missing alt on images", () => {
      const violations = checkHtmlAccessibility(
        '<img src="test.jpg">',
        BUILT_IN_RULES
      );

      expect(violations.some((v) => v.rule.id === "img-alt")).toBe(true);
    });

    it("does not flag images with alt", () => {
      const violations = checkHtmlAccessibility(
        '<img src="test.jpg" alt="Test image">',
        BUILT_IN_RULES
      );

      expect(violations.some((v) => v.rule.id === "img-alt")).toBe(false);
    });

    it("detects empty buttons", () => {
      const violations = checkHtmlAccessibility(
        "<button></button>",
        BUILT_IN_RULES
      );

      expect(violations.some((v) => v.rule.id === "button-name")).toBe(true);
    });

    it("detects inputs without labels", () => {
      const violations = checkHtmlAccessibility(
        '<input type="text">',
        BUILT_IN_RULES
      );

      expect(violations.some((v) => v.rule.id === "form-label")).toBe(true);
    });

    it("detects missing html lang", () => {
      const violations = checkHtmlAccessibility(
        "<html><body>Content</body></html>",
        BUILT_IN_RULES
      );

      expect(violations.some((v) => v.rule.id === "html-lang")).toBe(true);
    });

    it("does not flag html with lang", () => {
      const violations = checkHtmlAccessibility(
        '<html lang="en"><body>Content</body></html>',
        BUILT_IN_RULES
      );

      expect(violations.some((v) => v.rule.id === "html-lang")).toBe(false);
    });
  });

  describe("AccessibilityAuditor class", () => {
    let auditor: AccessibilityAuditor;

    beforeEach(() => {
      auditor = createAccessibilityAuditor();
    });

    it("audits HTML and returns result", () => {
      const result = auditor.audit('<img src="test.jpg">');

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("groups violations by severity", () => {
      const result = auditor.audit('<img src="a.jpg"><img src="b.jpg">');

      expect(result.bySeverity.critical).toBeDefined();
      expect(result.bySeverity.serious).toBeDefined();
      expect(result.bySeverity.moderate).toBeDefined();
      expect(result.bySeverity.minor).toBeDefined();
    });

    it("fails when blocking violations present", () => {
      const result = auditor.audit('<img src="test.jpg">'); // critical violation

      expect(result.passed).toBe(false);
    });

    it("passes when only non-blocking violations", () => {
      auditor.updateConfig({ blockingSeverities: [] }); // No blocking severities
      const result = auditor.audit('<img src="test.jpg">');

      expect(result.passed).toBe(true);
    });

    it("respects runInValidation config", () => {
      auditor.updateConfig({ runInValidation: false });
      const result = auditor.runValidation('<img src="test.jpg">');

      expect(result.violations.length).toBe(0);
      expect(result.passed).toBe(true);
    });

    it("calls validation hooks", () => {
      const hook = vi.fn();
      auditor.onValidation(hook);

      auditor.audit('<img src="test.jpg">');

      expect(hook).toHaveBeenCalledWith(
        expect.objectContaining({ violations: expect.any(Array) })
      );
    });

    it("handles hook errors gracefully", () => {
      auditor.onValidation(() => {
        throw new Error("Hook error");
      });

      // Should not throw
      expect(() => auditor.audit('<img src="test.jpg">')).not.toThrow();
    });

    it("getActiveRules respects wcagLevel", () => {
      auditor.updateConfig({ wcagLevel: "A" });
      const rules = auditor.getActiveRules();

      expect(rules.every((r) => r.level === "A")).toBe(true);
    });

    it("getActiveRules respects categories", () => {
      auditor.updateConfig({ categories: ["aria"] });
      const rules = auditor.getActiveRules();

      expect(rules.every((r) => r.category === "aria")).toBe(true);
    });

    it("getViolationSummary formats result", () => {
      const result = auditor.audit('<img src="test.jpg">');
      const summary = auditor.getViolationSummary(result);

      expect(summary).toContain("Accessibility Audit");
      expect(summary).toContain("WCAG Level");
      expect(summary).toContain("Violations");
    });

    it("does not trigger fix loop without fix function", async () => {
      const result = auditor.audit('<img src="test.jpg">');
      const fixLoop = await auditor.triggerFixLoop(result.violations);

      expect(fixLoop.attempts.length).toBe(0);
      expect(fixLoop.allFixed).toBe(false);
    });

    it("does not trigger fix loop when autoFix disabled", async () => {
      auditor.setFixFunction(createMockFixFunction(1));
      auditor.updateConfig({ autoFix: false });

      const result = auditor.audit('<img src="test.jpg">');
      const fixLoop = await auditor.triggerFixLoop(result.violations);

      expect(fixLoop.attempts.length).toBe(0);
    });

    it("updates and gets config", () => {
      auditor.updateConfig({ wcagLevel: "AAA" });
      const config = auditor.getConfig();

      expect(config.wcagLevel).toBe("AAA");
    });
  });

  describe("factory functions", () => {
    it("createAccessibilityAuditor creates instance", () => {
      const auditor = createAccessibilityAuditor();

      expect(auditor).toBeInstanceOf(AccessibilityAuditor);
    });

    it("createAuditorWithFixer creates instance with fix function", async () => {
      const fixFn = createMockFixFunction(1);
      const auditor = createAuditorWithFixer(fixFn);

      const result = auditor.audit('<img src="test.jpg">');
      const fixLoop = await auditor.triggerFixLoop(result.violations);

      expect(fixLoop.attempts.length).toBeGreaterThan(0);
    });
  });

  describe("utility functions", () => {
    describe("createMockFixFunction", () => {
      it("succeeds on specified attempt", async () => {
        const fixFn = createMockFixFunction(2);
        const violation: AccessibilityViolation = {
          id: "test-1",
          rule: BUILT_IN_RULES[0],
          selector: "img",
          message: "Test",
          impact: "Test impact",
        };

        const attempt1 = await fixFn(violation);
        expect(attempt1.success).toBe(false);

        const attempt2 = await fixFn(violation);
        expect(attempt2.success).toBe(true);
      });
    });

    describe("hasBlockingViolations", () => {
      it("returns true when blocking violations present", () => {
        const result: AuditResult = {
          passed: false,
          violations: [],
          bySeverity: {
            critical: [{ id: "1" } as AccessibilityViolation],
            serious: [],
            moderate: [],
            minor: [],
          },
          elementsChecked: 1,
          rulesApplied: 1,
          duration: 0,
          timestamp: Date.now(),
          wcagLevel: "AA",
        };

        expect(hasBlockingViolations(result)).toBe(true);
      });

      it("returns false when no blocking violations", () => {
        const result: AuditResult = {
          passed: true,
          violations: [],
          bySeverity: {
            critical: [],
            serious: [],
            moderate: [{ id: "1" } as AccessibilityViolation],
            minor: [],
          },
          elementsChecked: 1,
          rulesApplied: 1,
          duration: 0,
          timestamp: Date.now(),
          wcagLevel: "AA",
        };

        expect(hasBlockingViolations(result)).toBe(false);
      });
    });

    describe("getBlockingViolations", () => {
      it("returns blocking violations", () => {
        const critical = { id: "1" } as AccessibilityViolation;
        const result: AuditResult = {
          passed: false,
          violations: [critical],
          bySeverity: {
            critical: [critical],
            serious: [],
            moderate: [],
            minor: [],
          },
          elementsChecked: 1,
          rulesApplied: 1,
          duration: 0,
          timestamp: Date.now(),
          wcagLevel: "AA",
        };

        const blocking = getBlockingViolations(result);

        expect(blocking).toContain(critical);
      });
    });

    describe("formatViolation", () => {
      it("formats violation for display", () => {
        const violation: AccessibilityViolation = {
          id: "test-1",
          rule: BUILT_IN_RULES.find((r) => r.id === "img-alt")!,
          selector: "img",
          message: "Image missing alt",
          impact: "Screen readers cannot describe",
          suggestedFix: "Add alt attribute",
        };

        const formatted = formatViolation(violation);

        expect(formatted).toContain("CRITICAL");
        expect(formatted).toContain("Image missing alt");
        expect(formatted).toContain("img-alt");
        expect(formatted).toContain("Add alt attribute");
      });
    });
  });
});
