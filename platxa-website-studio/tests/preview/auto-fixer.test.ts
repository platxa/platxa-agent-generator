import { describe, it, expect } from "vitest";
import {
  AutoFixer,
  createAutoFixer,
  generateFixes,
  getBestFix,
  canAutoFix,
  type FixSuggestion,
  type AutoFixResult,
  type FixContext,
} from "@/lib/preview/auto-fixer";

describe("AutoFixer", () => {
  describe("generateFixes", () => {
    it("generates fixes for SCSS undefined variable", () => {
      const fixer = new AutoFixer();
      const result = fixer.generateFixes("Undefined variable: $primary-color");

      expect(result.hasMatch).toBe(true);
      expect(result.category).toBe("scss-variable");
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.matchedPattern).not.toBeNull();
    });

    it("generates multiple fix suggestions for undefined variable", () => {
      const fixer = new AutoFixer();
      const result = fixer.generateFixes("Undefined variable: $my-var");

      // Should have both "define variable" and "import file" suggestions
      expect(result.suggestions.length).toBeGreaterThanOrEqual(2);

      const types = result.suggestions.map((s) => s.type);
      expect(types).toContain("variable-define");
      expect(types).toContain("import-add");
    });

    it("generates fixes for QWeb directive errors", () => {
      const fixer = new AutoFixer();
      const result = fixer.generateFixes("t-foreach without t-as on element");

      expect(result.hasMatch).toBe(true);
      expect(result.category).toBe("qweb-directive");
      expect(result.suggestions[0].fix).toContain("t-as");
    });

    it("generates fixes for SCSS syntax errors", () => {
      const fixer = new AutoFixer();
      const result = fixer.generateFixes("Expected ';' after property value");

      expect(result.hasMatch).toBe(true);
      expect(result.category).toBe("scss-syntax");
      expect(result.suggestions[0].type).toBe("syntax-fix");
    });

    it("includes location from error message", () => {
      const fixer = new AutoFixer();
      const result = fixer.generateFixes("styles/theme.scss:25:10: Undefined variable: $color");

      expect(result.location.file).toBe("styles/theme.scss");
      expect(result.location.line).toBe(25);
      expect(result.location.column).toBe(10);
    });

    it("uses provided context over extracted location", () => {
      const fixer = new AutoFixer();
      const result = fixer.generateFixes("Undefined variable: $color", {
        file: "override.scss",
        line: 100,
      });

      expect(result.location.file).toBe("override.scss");
      expect(result.location.line).toBe(100);
    });

    it("respects maxSuggestions option", () => {
      const fixer = new AutoFixer();
      const result = fixer.generateFixes("Undefined variable: $test", {}, {
        maxSuggestions: 1,
      });

      expect(result.suggestions.length).toBeLessThanOrEqual(1);
    });

    it("filters by categories option", () => {
      const fixer = new AutoFixer();
      const result = fixer.generateFixes("Undefined variable: $test", {}, {
        categories: ["scss-variable"],
      });

      for (const suggestion of result.suggestions) {
        expect(suggestion.category).toBe("scss-variable");
      }
    });

    it("generates fallback suggestions when no pattern matches", () => {
      const fixer = new AutoFixer();
      const result = fixer.generateFixes("Some unknown error xyz123");

      expect(result.hasMatch).toBe(false);
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0].patternId).toBe("fallback");
    });

    it("generates syntax fallback for syntax-related errors", () => {
      const fixer = new AutoFixer();
      const result = fixer.generateFixes("Syntax error in unknown format");

      expect(result.suggestions.some((s) => s.id === "fallback-syntax-check")).toBe(true);
    });

    it("generates definition fallback for undefined errors", () => {
      const fixer = new AutoFixer();
      const result = fixer.generateFixes("Something undefined xyz");

      expect(result.suggestions.some((s) => s.id === "fallback-check-definition")).toBe(true);
    });
  });

  describe("getBestFix", () => {
    it("returns single best fix", () => {
      const fixer = new AutoFixer();
      const fix = fixer.getBestFix("Undefined variable: $primary");

      expect(fix).not.toBeNull();
      expect(fix!.priority).toBe(1); // Error priority
    });

    it("returns null for completely unknown errors with fallbacks disabled", () => {
      const fixer = new AutoFixer();
      const result = fixer.generateFixes("xyz unknown abc", {}, {
        includeFallbacks: false,
      });

      expect(result.suggestions.length).toBe(0);
    });
  });

  describe("canFix", () => {
    it("returns true for known patterns", () => {
      const fixer = new AutoFixer();

      expect(fixer.canFix("Undefined variable: $test")).toBe(true);
      expect(fixer.canFix("t-foreach without t-as")).toBe(true);
      expect(fixer.canFix("Expected ';' after property")).toBe(true);
    });

    it("returns false for unknown errors", () => {
      const fixer = new AutoFixer();

      expect(fixer.canFix("completely random error xyz123")).toBe(false);
    });
  });

  describe("getFixesByCategory", () => {
    it("returns only fixes for specified category", () => {
      const fixer = new AutoFixer();
      const fixes = fixer.getFixesByCategory(
        "Undefined variable: $test",
        "scss-variable"
      );

      expect(fixes.length).toBeGreaterThan(0);
      for (const fix of fixes) {
        expect(fix.category).toBe("scss-variable");
      }
    });
  });

  describe("fix suggestion structure", () => {
    it("includes all required fields", () => {
      const fixer = new AutoFixer();
      const result = fixer.generateFixes("Undefined variable: $my-var");

      for (const suggestion of result.suggestions) {
        expect(suggestion.id).toBeTruthy();
        expect(suggestion.title).toBeTruthy();
        expect(suggestion.description).toBeTruthy();
        expect(suggestion.fix).toBeTruthy();
        expect(suggestion.type).toBeTruthy();
        expect(typeof suggestion.priority).toBe("number");
        expect(typeof suggestion.confidence).toBe("number");
        expect(suggestion.category).toBeTruthy();
        expect(suggestion.patternId).toBeTruthy();
      }
    });

    it("sorts suggestions by priority then confidence", () => {
      const fixer = new AutoFixer();
      const result = fixer.generateFixes("Undefined variable: $test");

      for (let i = 1; i < result.suggestions.length; i++) {
        const prev = result.suggestions[i - 1];
        const curr = result.suggestions[i];

        if (prev.priority === curr.priority) {
          expect(prev.confidence).toBeGreaterThanOrEqual(curr.confidence);
        } else {
          expect(prev.priority).toBeLessThanOrEqual(curr.priority);
        }
      }
    });

    it("has confidence between 0 and 1", () => {
      const fixer = new AutoFixer();
      const result = fixer.generateFixes("Undefined variable: $test");

      for (const suggestion of result.suggestions) {
        expect(suggestion.confidence).toBeGreaterThanOrEqual(0);
        expect(suggestion.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("category-specific fix generation", () => {
    it("generates variable-define for scss-variable errors", () => {
      const fixer = new AutoFixer();
      const result = fixer.generateFixes("Undefined variable: $custom-color");

      const defineFix = result.suggestions.find((s) => s.type === "variable-define");
      expect(defineFix).toBeTruthy();
      expect(defineFix!.fix).toContain("$custom");
    });

    it("generates syntax-fix for qweb-syntax errors", () => {
      const fixer = new AutoFixer();
      const result = fixer.generateFixes("Unclosed tag: <div>");

      expect(result.suggestions[0].type).toBe("syntax-fix");
    });

    it("generates instruction for odoo-field errors", () => {
      const fixer = new AutoFixer();
      const result = fixer.generateFixes("Field 'user_name' not found on model");

      expect(result.suggestions[0].type).toBe("instruction");
    });
  });
});

describe("createAutoFixer", () => {
  it("creates AutoFixer instance", () => {
    const fixer = createAutoFixer();
    expect(fixer).toBeInstanceOf(AutoFixer);
  });
});

describe("generateFixes (standalone function)", () => {
  it("generates fixes without creating instance", () => {
    const result = generateFixes("Undefined variable: $test");

    expect(result.hasMatch).toBe(true);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});

describe("getBestFix (standalone function)", () => {
  it("returns best fix without creating instance", () => {
    const fix = getBestFix("Undefined variable: $test");

    expect(fix).not.toBeNull();
    expect(fix!.category).toBe("scss-variable");
  });
});

describe("canAutoFix (standalone function)", () => {
  it("checks fixability without creating instance", () => {
    expect(canAutoFix("Undefined variable: $test")).toBe(true);
    expect(canAutoFix("random unknown error")).toBe(false);
  });
});

describe("verification: generates fix based on error category and pattern match", () => {
  it("generates targeted fix for QWeb category", () => {
    const result = generateFixes("t-foreach without t-as attribute");

    expect(result.hasMatch).toBe(true);
    expect(result.category).toBe("qweb-directive");
    expect(result.suggestions[0].fix).toBeTruthy();
  });

  it("generates targeted fix for SCSS category", () => {
    const result = generateFixes("Undefined variable: $primary-color");

    expect(result.hasMatch).toBe(true);
    expect(result.category).toBe("scss-variable");
    expect(result.suggestions[0].fix).toBeTruthy();
  });

  it("generates targeted fix for Odoo category", () => {
    const result = generateFixes("Model 'custom.model' not found");

    expect(result.hasMatch).toBe(true);
    expect(result.category).toBe("odoo-model");
    expect(result.suggestions[0].fix).toBeTruthy();
  });

  it("fix suggestion matches pattern from library", () => {
    const result = generateFixes("Expected ';' after property value");

    expect(result.matchedPattern).not.toBeNull();
    expect(result.matchedPattern!.id).toBe("scss-missing-semicolon");
    expect(result.suggestions[0].patternId).toBe("scss-missing-semicolon");
  });
});
