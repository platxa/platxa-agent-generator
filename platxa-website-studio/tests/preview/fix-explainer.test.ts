/**
 * Tests for Fix Explainer for User Transparency
 *
 * Feature #151: Create fix explanation for user transparency
 * Verification: Each fix includes plain-language explanation of what was wrong and how it was fixed
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  FixExplainer,
  createFixExplainer,
  EXPLANATION_TEMPLATES,
  generateExplanationId,
  interpolate,
  extractCaptures,
  categorizeError as categorizeErrorForExplanation,
  determineSeverity as determineSeverityForExplanation,
  findMatchingTemplate,
  buildVariableMap,
  formatLocation,
  generateGenericExplanation,
  type ExplainableError,
  type ExplainableFix,
  type ExplanationTemplate,
} from "../../lib/preview/fix-explainer";

// ============================================================================
// Test Utilities
// ============================================================================

function createError(overrides: Partial<ExplainableError> = {}): ExplainableError {
  return {
    message: "Test error message",
    ...overrides,
  };
}

function createFix(overrides: Partial<ExplainableFix> = {}): ExplainableFix {
  return {
    description: "Test fix description",
    ...overrides,
  };
}

// ============================================================================
// Constants Tests
// ============================================================================

describe("EXPLANATION_TEMPLATES", () => {
  it("should have templates for all major categories", () => {
    const categories = new Set(EXPLANATION_TEMPLATES.map((t) => t.category));
    expect(categories.has("syntax")).toBe(true);
    expect(categories.has("type")).toBe(true);
    expect(categories.has("reference")).toBe(true);
    expect(categories.has("import")).toBe(true);
    expect(categories.has("qweb")).toBe(true);
    expect(categories.has("scss")).toBe(true);
    expect(categories.has("accessibility")).toBe(true);
    expect(categories.has("runtime")).toBe(true);
  });

  it("should have unique template IDs", () => {
    const ids = EXPLANATION_TEMPLATES.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("each template should have required fields", () => {
    for (const template of EXPLANATION_TEMPLATES) {
      expect(template.id).toBeTruthy();
      expect(template.pattern).toBeInstanceOf(RegExp);
      expect(template.category).toBeTruthy();
      expect(template.severity).toBeTruthy();
      expect(template.problemSummary).toBeTruthy();
      expect(template.problemDetail).toBeTruthy();
      expect(template.solutionSummary).toBeTruthy();
      expect(template.solutionSteps.length).toBeGreaterThan(0);
      expect(template.oneLiner).toBeTruthy();
    }
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe("generateExplanationId", () => {
  it("should generate unique IDs", () => {
    const id1 = generateExplanationId();
    const id2 = generateExplanationId();
    expect(id1).not.toBe(id2);
  });

  it("should start with 'exp-' prefix", () => {
    const id = generateExplanationId();
    expect(id.startsWith("exp-")).toBe(true);
  });
});

describe("interpolate", () => {
  it("should replace template variables", () => {
    const result = interpolate("Hello {{name}}, you have {{count}} messages", {
      name: "Alice",
      count: "5",
    });
    expect(result).toBe("Hello Alice, you have 5 messages");
  });

  it("should leave unknown variables as-is", () => {
    const result = interpolate("Hello {{name}}, {{unknown}}", {
      name: "Bob",
    });
    expect(result).toBe("Hello Bob, {{unknown}}");
  });

  it("should handle empty values", () => {
    const result = interpolate("Value: {{value}}", { value: "" });
    expect(result).toBe("Value: ");
  });

  it("should handle no variables", () => {
    const result = interpolate("No variables here", {});
    expect(result).toBe("No variables here");
  });
});

describe("extractCaptures", () => {
  it("should extract numbered groups", () => {
    const pattern = /error in (\w+) at line (\d+)/i;
    const text = "Error in module at line 42";
    const captures = extractCaptures(pattern, text);
    expect(captures.capture1).toBe("module");
    expect(captures.capture2).toBe("42");
  });

  it("should return empty object for no match", () => {
    const pattern = /hello (\w+)/;
    const text = "goodbye world";
    const captures = extractCaptures(pattern, text);
    expect(captures).toEqual({});
  });

  it("should handle patterns with no groups", () => {
    const pattern = /error/i;
    const text = "Error occurred";
    const captures = extractCaptures(pattern, text);
    expect(Object.keys(captures).length).toBe(0);
  });
});

describe("categorizeErrorForExplanation", () => {
  it("should categorize syntax errors", () => {
    expect(categorizeErrorForExplanation(createError({ type: "SyntaxError" }))).toBe("syntax");
    expect(categorizeErrorForExplanation(createError({ message: "Syntax error at line 5" }))).toBe("syntax");
  });

  it("should categorize type errors", () => {
    expect(categorizeErrorForExplanation(createError({ type: "TypeError" }))).toBe("type");
    expect(categorizeErrorForExplanation(createError({ message: "Type mismatch" }))).toBe("type");
  });

  it("should categorize reference errors", () => {
    expect(categorizeErrorForExplanation(createError({ type: "ReferenceError" }))).toBe("reference");
    expect(categorizeErrorForExplanation(createError({ message: "foo is not defined" }))).toBe("reference");
  });

  it("should categorize import errors", () => {
    expect(categorizeErrorForExplanation(createError({ message: "Cannot find module 'foo'" }))).toBe("import");
    expect(categorizeErrorForExplanation(createError({ message: "Import statement failed" }))).toBe("import");
  });

  it("should categorize QWeb errors", () => {
    expect(categorizeErrorForExplanation(createError({ message: "Invalid t-if directive" }))).toBe("qweb");
    expect(categorizeErrorForExplanation(createError({ message: "QWeb template error" }))).toBe("qweb");
  });

  it("should categorize SCSS errors", () => {
    expect(categorizeErrorForExplanation(createError({ message: "SCSS compilation failed" }))).toBe("scss");
    expect(categorizeErrorForExplanation(createError({ file: "styles.scss" }))).toBe("scss");
  });

  it("should categorize accessibility errors", () => {
    expect(categorizeErrorForExplanation(createError({ message: "Missing alt attribute" }))).toBe("accessibility");
    expect(categorizeErrorForExplanation(createError({ message: "Low contrast ratio" }))).toBe("accessibility");
  });

  it("should categorize runtime errors", () => {
    expect(categorizeErrorForExplanation(createError({ message: "Network fetch failed" }))).toBe("runtime");
    expect(categorizeErrorForExplanation(createError({ message: "JSON parse error" }))).toBe("runtime");
  });

  it("should return unknown for unrecognized errors", () => {
    expect(categorizeErrorForExplanation(createError({ message: "Something happened" }))).toBe("unknown");
  });
});

describe("determineSeverityForExplanation", () => {
  it("should identify critical errors", () => {
    expect(determineSeverityForExplanation(createError({ type: "SyntaxError" }))).toBe("critical");
    expect(determineSeverityForExplanation(createError({ type: "ReferenceError" }))).toBe("critical");
    expect(determineSeverityForExplanation(createError({ message: "Cannot read property" }))).toBe("critical");
    expect(determineSeverityForExplanation(createError({ message: "Operation failed" }))).toBe("critical");
  });

  it("should identify warnings", () => {
    expect(determineSeverityForExplanation(createError({ type: "Warning" }))).toBe("warning");
    expect(determineSeverityForExplanation(createError({ message: "Deprecated API" }))).toBe("warning");
    expect(determineSeverityForExplanation(createError({ message: "Accessibility issue" }))).toBe("warning");
  });

  it("should default to info for other errors", () => {
    expect(determineSeverityForExplanation(createError({ message: "Something happened" }))).toBe("info");
  });
});

describe("findMatchingTemplate", () => {
  it("should find template for syntax error", () => {
    const error = createError({ message: "Unexpected token: }" });
    const template = findMatchingTemplate(error);
    expect(template).not.toBeNull();
    expect(template!.category).toBe("syntax");
  });

  it("should find template for type error", () => {
    const error = createError({ message: "Cannot read property 'foo' of undefined" });
    const template = findMatchingTemplate(error);
    expect(template).not.toBeNull();
    expect(template!.category).toBe("type");
  });

  it("should find template for import error", () => {
    const error = createError({ message: "Cannot find module 'react'" });
    const template = findMatchingTemplate(error);
    expect(template).not.toBeNull();
    expect(template!.category).toBe("import");
  });

  it("should return null for unmatched errors", () => {
    const error = createError({ message: "Some random error that matches nothing" });
    const template = findMatchingTemplate(error);
    expect(template).toBeNull();
  });
});

describe("formatLocation", () => {
  it("should format file only", () => {
    const error = createError({ file: "/src/app.ts" });
    expect(formatLocation(error)).toBe("/src/app.ts");
  });

  it("should format file and line", () => {
    const error = createError({ file: "/src/app.ts", line: 42 });
    expect(formatLocation(error)).toBe("/src/app.ts:42");
  });

  it("should format file, line, and column", () => {
    const error = createError({ file: "/src/app.ts", line: 42, column: 10 });
    expect(formatLocation(error)).toBe("/src/app.ts:42:10");
  });

  it("should return undefined for no file", () => {
    const error = createError({});
    expect(formatLocation(error)).toBeUndefined();
  });
});

describe("buildVariableMap", () => {
  it("should include error properties", () => {
    const error = createError({
      message: "Test error",
      type: "TypeError",
      code: "TS2345",
      file: "/src/app.ts",
      line: 42,
      column: 10,
    });
    const fix = createFix({ description: "Fix it" });
    const vars = buildVariableMap(error, fix, null);

    expect(vars.message).toBe("Test error");
    expect(vars.type).toBe("TypeError");
    expect(vars.code).toBe("TS2345");
    expect(vars.file).toBe("/src/app.ts");
    expect(vars.line).toBe("42");
    expect(vars.column).toBe("10");
  });

  it("should include fix properties", () => {
    const error = createError({});
    const fix = createFix({
      description: "Apply this fix",
      type: "code-change",
      linesChanged: 5,
    });
    const vars = buildVariableMap(error, fix, null);

    expect(vars.fixDescription).toBe("Apply this fix");
    expect(vars.fixType).toBe("code-change");
    expect(vars.linesChanged).toBe("5");
  });
});

describe("generateGenericExplanation", () => {
  it("should create valid explanation structure", () => {
    const error = createError({
      message: "Unknown error occurred",
      file: "/src/app.ts",
      line: 10,
    });
    const fix = createFix({ description: "Fixed the issue" });
    const explanation = generateGenericExplanation(error, fix, "unknown", "info");

    expect(explanation.id).toBeTruthy();
    expect(explanation.category).toBe("unknown");
    expect(explanation.severity).toBe("info");
    expect(explanation.problem.summary).toContain("Unknown");
    expect(explanation.problem.detail).toBe(error.message);
    expect(explanation.problem.location).toBe("/src/app.ts:10");
    expect(explanation.solution.summary).toBe(fix.description);
    expect(explanation.solution.steps.length).toBeGreaterThan(0);
    expect(explanation.oneLiner).toContain(fix.description);
    expect(explanation.timestamp).toBeGreaterThan(0);
  });
});

// ============================================================================
// FixExplainer Class Tests
// ============================================================================

describe("FixExplainer", () => {
  let explainer: FixExplainer;

  beforeEach(() => {
    explainer = createFixExplainer();
  });

  afterEach(() => {
    explainer.dispose();
  });

  describe("explain", () => {
    it("should generate explanation for syntax error", () => {
      const error = createError({
        message: "Unexpected token: }",
        type: "SyntaxError",
        file: "/src/app.ts",
        line: 10,
      });
      const fix = createFix({
        description: "Removed extra closing brace",
        originalCode: "}}",
        fixedCode: "}",
      });

      const explanation = explainer.explain(error, fix);

      expect(explanation.category).toBe("syntax");
      expect(explanation.severity).toBe("critical");
      expect(explanation.problem.summary).toBeTruthy();
      expect(explanation.problem.detail).toBeTruthy();
      expect(explanation.problem.reason).toBeTruthy();
      expect(explanation.solution.summary).toBeTruthy();
      expect(explanation.solution.steps.length).toBeGreaterThan(0);
      expect(explanation.solution.rationale).toBeTruthy();
      expect(explanation.oneLiner).toBeTruthy();
    });

    it("should generate explanation for type error", () => {
      const error = createError({
        message: "Cannot read property 'name' of undefined",
        type: "TypeError",
      });
      const fix = createFix({
        description: "Added null check before accessing property",
      });

      const explanation = explainer.explain(error, fix);

      expect(explanation.category).toBe("type");
      expect(explanation.problem.detail).toContain("undefined");
      expect(explanation.tip).toBeTruthy(); // Should include tip about optional chaining
    });

    it("should generate explanation for import error", () => {
      const error = createError({
        message: "Cannot find module 'lodash'",
      });
      const fix = createFix({
        description: "Installed missing lodash package",
      });

      const explanation = explainer.explain(error, fix);

      expect(explanation.category).toBe("import");
      expect(explanation.problem.detail).toContain("lodash");
    });

    it("should generate explanation for accessibility error", () => {
      const error = createError({
        message: "Image missing alt attribute",
      });
      const fix = createFix({
        description: "Added alt text to image",
      });

      const explanation = explainer.explain(error, fix);

      expect(explanation.category).toBe("accessibility");
      expect(explanation.docLink).toBeTruthy(); // Should include doc link
    });

    it("should generate generic explanation for unknown errors", () => {
      const error = createError({
        message: "Something completely random happened here",
      });
      const fix = createFix({
        description: "Fixed the random thing",
      });

      const explanation = explainer.explain(error, fix);

      expect(explanation.category).toBe("unknown");
      expect(explanation.problem.detail).toBe(error.message);
    });

    it("should throw when disposed", () => {
      explainer.dispose();
      expect(() => explainer.explain(createError({}), createFix({}))).toThrow("disposed");
    });
  });

  describe("explainBatch", () => {
    it("should generate explanations for multiple errors", () => {
      const pairs = [
        {
          error: createError({ message: "Unexpected token: }" }),
          fix: createFix({ description: "Fixed syntax" }),
        },
        {
          error: createError({ message: "Cannot read property 'x' of undefined" }),
          fix: createFix({ description: "Added null check" }),
        },
        {
          error: createError({ message: "Cannot find module 'foo'" }),
          fix: createFix({ description: "Installed module" }),
        },
      ];

      const explanations = explainer.explainBatch(pairs);

      expect(explanations.length).toBe(3);
      expect(explanations[0].category).toBe("syntax");
      expect(explanations[1].category).toBe("type");
      expect(explanations[2].category).toBe("import");
    });
  });

  describe("getTemplateIds", () => {
    it("should return all template IDs", () => {
      const ids = explainer.getTemplateIds();
      expect(ids.length).toBe(EXPLANATION_TEMPLATES.length);
      expect(ids).toContain("syntax-unexpected-token");
      expect(ids).toContain("type-undefined-property");
    });
  });

  describe("getTemplate", () => {
    it("should return template by ID", () => {
      const template = explainer.getTemplate("syntax-unexpected-token");
      expect(template).toBeDefined();
      expect(template!.category).toBe("syntax");
    });

    it("should return undefined for unknown ID", () => {
      const template = explainer.getTemplate("nonexistent-template");
      expect(template).toBeUndefined();
    });
  });

  describe("addTemplate", () => {
    it("should add custom template", () => {
      const customTemplate: ExplanationTemplate = {
        id: "custom-test-error",
        pattern: /custom test error/i,
        category: "runtime",
        severity: "warning",
        problemSummary: "Custom test error",
        problemDetail: "A custom test error occurred",
        problemReason: "Testing",
        solutionSummary: "Fix the custom error",
        solutionSteps: ["Step 1"],
        solutionRationale: "Testing works",
        oneLiner: "Fixed custom error",
      };

      explainer.addTemplate(customTemplate);

      const ids = explainer.getTemplateIds();
      expect(ids).toContain("custom-test-error");

      const error = createError({ message: "Custom test error happened" });
      const fix = createFix({ description: "Fixed it" });
      const explanation = explainer.explain(error, fix);

      expect(explanation.problem.summary).toBe("Custom test error");
    });
  });

  describe("formatAsText", () => {
    it("should format explanation as plain text", () => {
      const error = createError({
        message: "Unexpected token: }",
        file: "/src/app.ts",
        line: 10,
      });
      const fix = createFix({ description: "Removed extra brace" });
      const explanation = explainer.explain(error, fix);

      const text = explainer.formatAsText(explanation);

      expect(text).toContain("##"); // Markdown heading
      expect(text).toContain("What went wrong:");
      expect(text).toContain("How it was fixed:");
      expect(text).toContain("Steps:");
      expect(text).toContain("Rationale:");
      expect(text).toContain("/src/app.ts:10");
    });

    it("should include tip when present", () => {
      const error = createError({ message: "Unexpected token: foo" });
      const fix = createFix({ description: "Fixed" });
      const explanation = explainer.explain(error, fix);

      if (explanation.tip) {
        const text = explainer.formatAsText(explanation);
        expect(text).toContain("**Tip:**");
      }
    });
  });

  describe("formatAsHtml", () => {
    it("should format explanation as HTML", () => {
      const error = createError({
        message: "Cannot read property 'x' of undefined",
        file: "/src/app.ts",
        line: 10,
      });
      const fix = createFix({ description: "Added null check" });
      const explanation = explainer.explain(error, fix);

      const html = explainer.formatAsHtml(explanation);

      expect(html).toContain('<div class="fix-explanation');
      expect(html).toContain("severity-critical");
      expect(html).toContain("category-type");
      expect(html).toContain('<h3 class="problem-summary">');
      expect(html).toContain('<div class="problem">');
      expect(html).toContain('<div class="solution">');
      expect(html).toContain('<ol class="steps">');
    });

    it("should escape HTML entities", () => {
      const error = createError({ message: "Error with <script>alert('xss')</script>" });
      const fix = createFix({ description: "Fixed <dangerous> thing" });
      const explanation = explainer.explain(error, fix);

      const html = explainer.formatAsHtml(explanation);

      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });
  });

  describe("options", () => {
    it("should respect includeTips option", () => {
      const noTipsExplainer = createFixExplainer({ includeTips: false });
      const error = createError({ message: "Unexpected token: }" });
      const fix = createFix({ description: "Fixed" });

      const explanation = noTipsExplainer.explain(error, fix);
      expect(explanation.tip).toBeUndefined();

      noTipsExplainer.dispose();
    });

    it("should respect includeDocLinks option", () => {
      const noDocsExplainer = createFixExplainer({ includeDocLinks: false });
      const error = createError({ message: "Missing alt attribute" });
      const fix = createFix({ description: "Added alt" });

      const explanation = noDocsExplainer.explain(error, fix);
      expect(explanation.docLink).toBeUndefined();

      noDocsExplainer.dispose();
    });

    it("should respect minimal verbosity", () => {
      const minimalExplainer = createFixExplainer({ verbosity: "minimal" });
      const error = createError({ message: "Unexpected token: }" });
      const fix = createFix({ description: "Fixed" });

      const explanation = minimalExplainer.explain(error, fix);
      expect(explanation.solution.steps.length).toBe(1);

      minimalExplainer.dispose();
    });

    it("should include related patterns for detailed verbosity", () => {
      const detailedExplainer = createFixExplainer({ verbosity: "detailed" });
      const error = createError({ message: "Unexpected token: }" });
      const fix = createFix({ description: "Fixed" });

      const explanation = detailedExplainer.explain(error, fix);
      expect(explanation.relatedPatterns).toBeDefined();

      detailedExplainer.dispose();
    });
  });

  describe("dispose", () => {
    it("should mark as disposed", () => {
      expect(explainer.isDisposed()).toBe(false);
      explainer.dispose();
      expect(explainer.isDisposed()).toBe(true);
    });

    it("should be idempotent", () => {
      explainer.dispose();
      explainer.dispose(); // Should not throw
      expect(explainer.isDisposed()).toBe(true);
    });
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe("createFixExplainer", () => {
  it("should create explainer with default options", () => {
    const explainer = createFixExplainer();
    expect(explainer).toBeInstanceOf(FixExplainer);
    explainer.dispose();
  });

  it("should create explainer with custom templates", () => {
    const customTemplate: ExplanationTemplate = {
      id: "custom-error",
      pattern: /custom pattern/i,
      category: "runtime",
      severity: "info",
      problemSummary: "Custom",
      problemDetail: "Custom detail",
      problemReason: "Custom reason",
      solutionSummary: "Custom solution",
      solutionSteps: ["Step"],
      solutionRationale: "Custom rationale",
      oneLiner: "Custom one-liner",
    };

    const explainer = createFixExplainer({ customTemplates: [customTemplate] });
    expect(explainer.getTemplateIds()).toContain("custom-error");
    explainer.dispose();
  });
});

// ============================================================================
// Verification: Each fix includes plain-language explanation
// ============================================================================

describe("Feature Verification: Plain-language explanations", () => {
  let explainer: FixExplainer;

  beforeEach(() => {
    explainer = createFixExplainer();
  });

  afterEach(() => {
    explainer.dispose();
  });

  it("should explain what was wrong in plain language", () => {
    const error = createError({
      message: "Cannot read property 'name' of undefined",
      file: "/src/user.ts",
      line: 25,
    });
    const fix = createFix({
      description: "Added optional chaining operator",
      originalCode: "user.name",
      fixedCode: "user?.name",
    });

    const explanation = explainer.explain(error, fix);

    // Problem explanation should be human-readable
    expect(explanation.problem.summary).not.toContain("Cannot read property"); // Not just echoing error
    expect(explanation.problem.detail).toBeTruthy();
    expect(explanation.problem.reason).toBeTruthy();
    expect(explanation.problem.location).toBe("/src/user.ts:25");
  });

  it("should explain how it was fixed in plain language", () => {
    const error = createError({
      message: "foo is not defined",
      type: "ReferenceError",
    });
    const fix = createFix({
      description: "Added import for foo",
      fixedCode: "import { foo } from './utils'",
    });

    const explanation = explainer.explain(error, fix);

    // Solution explanation should have clear steps
    expect(explanation.solution.summary).toBeTruthy();
    expect(explanation.solution.steps.length).toBeGreaterThan(0);
    expect(explanation.solution.rationale).toBeTruthy();

    // Steps should be actionable
    explanation.solution.steps.forEach((step) => {
      expect(step.length).toBeGreaterThan(5); // Not empty placeholders
    });
  });

  it("should provide one-liner summary for quick display", () => {
    const error = createError({ message: "Missing semicolon" });
    const fix = createFix({ description: "Added semicolon" });

    const explanation = explainer.explain(error, fix);

    expect(explanation.oneLiner).toBeTruthy();
    expect(explanation.oneLiner.length).toBeLessThan(100); // Concise
  });

  it("should include educational tips for common errors", () => {
    const error = createError({ message: "Cannot read property 'x' of undefined" });
    const fix = createFix({ description: "Added null check" });

    const explanation = explainer.explain(error, fix);

    // Should include tip about optional chaining
    expect(explanation.tip).toBeTruthy();
  });

  it("should include documentation links for accessibility errors", () => {
    const error = createError({ message: "Missing alt attribute on image" });
    const fix = createFix({ description: "Added alt text" });

    const explanation = explainer.explain(error, fix);

    // Should include WCAG documentation link
    expect(explanation.docLink).toBeTruthy();
    expect(explanation.docLink).toContain("w3.org");
  });

  it("should format explanations for display in chat", () => {
    const error = createError({
      message: "Unexpected token: }",
      file: "/src/app.ts",
      line: 10,
    });
    const fix = createFix({ description: "Removed extra brace" });
    const explanation = explainer.explain(error, fix);

    // Text format should be readable
    const text = explainer.formatAsText(explanation);
    expect(text).toContain("What went wrong:");
    expect(text).toContain("How it was fixed:");

    // HTML format should be structured
    const html = explainer.formatAsHtml(explanation);
    expect(html).toContain("class=");
    expect(html).toContain("<ol");
  });
});
