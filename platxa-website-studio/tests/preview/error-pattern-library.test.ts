import { describe, it, expect } from "vitest";
import {
  ErrorPatternLibrary,
  createErrorPatternLibrary,
  matchErrorPattern,
  matchAllErrorPatterns,
  getPatternCount,
  ERROR_PATTERNS,
  type ErrorPattern,
  type PatternMatch,
} from "@/lib/preview/error-pattern-library";

describe("ErrorPatternLibrary", () => {
  describe("pattern count verification", () => {
    it("contains 50+ patterns", () => {
      expect(ERROR_PATTERNS.length).toBeGreaterThanOrEqual(50);
    });

    it("getPatternCount returns correct count", () => {
      expect(getPatternCount()).toBe(ERROR_PATTERNS.length);
      expect(getPatternCount()).toBeGreaterThanOrEqual(50);
    });
  });

  describe("pattern structure verification", () => {
    it("all patterns have required fields", () => {
      for (const pattern of ERROR_PATTERNS) {
        expect(pattern.id).toBeTruthy();
        expect(pattern.name).toBeTruthy();
        expect(pattern.category).toBeTruthy();
        expect(pattern.pattern).toBeInstanceOf(RegExp);
        expect(pattern.description).toBeTruthy();
        expect(pattern.fixTemplate).toBeTruthy();
        expect(pattern.example).toBeTruthy();
        expect(["error", "warning", "info"]).toContain(pattern.severity);
        expect(Array.isArray(pattern.tags)).toBe(true);
        expect(pattern.tags.length).toBeGreaterThan(0);
      }
    });

    it("all pattern IDs are unique", () => {
      const ids = ERROR_PATTERNS.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("all patterns have valid categories", () => {
      const validCategories = [
        "qweb-directive",
        "qweb-syntax",
        "qweb-template",
        "qweb-expression",
        "scss-variable",
        "scss-syntax",
        "scss-mixin",
        "scss-import",
        "scss-function",
        "odoo-field",
        "odoo-model",
        "odoo-view",
        "odoo-asset",
        "odoo-security",
        "python-import",
        "python-syntax",
        "javascript",
        "xml-syntax",
        "general",
      ];

      for (const pattern of ERROR_PATTERNS) {
        expect(validCategories).toContain(pattern.category);
      }
    });
  });

  describe("QWeb directive pattern matching", () => {
    it("matches missing t-as error", () => {
      const match = matchErrorPattern("t-foreach without t-as on element");
      expect(match).not.toBeNull();
      expect(match!.pattern.id).toBe("qweb-missing-t-as");
    });

    it("matches orphan t-elif error", () => {
      const match = matchErrorPattern("t-elif must follow a t-if or another t-elif");
      expect(match).not.toBeNull();
      expect(match!.pattern.id).toBe("qweb-orphan-elif");
    });

    it("matches orphan t-else error", () => {
      const match = matchErrorPattern("orphan t-else directive found");
      expect(match).not.toBeNull();
      expect(match!.pattern.id).toBe("qweb-orphan-else");
    });

    it("matches invalid directive error", () => {
      const match = matchErrorPattern("Unknown QWeb directive: t-invalid");
      expect(match).not.toBeNull();
      expect(match!.pattern.id).toBe("qweb-invalid-directive");
    });

    it("matches deprecated t-raw warning", () => {
      const match = matchErrorPattern("Deprecated directive 't-raw'. Use t-out instead.");
      expect(match).not.toBeNull();
      expect(match!.pattern.id).toBe("qweb-deprecated-t-raw");
    });
  });

  describe("QWeb syntax pattern matching", () => {
    it("matches unclosed tag error", () => {
      const match = matchErrorPattern("Unclosed tag: <div>");
      expect(match).not.toBeNull();
      expect(match!.pattern.id).toBe("qweb-unclosed-tag");
    });

    it("matches mismatched tags error", () => {
      const match = matchErrorPattern("Mismatched: expected </div>, found </span>");
      expect(match).not.toBeNull();
      expect(match!.pattern.id).toBe("qweb-mismatched-tags");
    });

    it("matches invalid XML error", () => {
      const match = matchErrorPattern("XML parse error: not well-formed");
      expect(match).not.toBeNull();
      expect(match!.pattern.id).toBe("qweb-invalid-xml");
    });
  });

  describe("SCSS variable pattern matching", () => {
    it("matches undefined variable error", () => {
      // Use a non-Bootstrap variable name (primary/secondary/etc. match Bootstrap pattern)
      const match = matchErrorPattern("Undefined variable: $custom-color");
      expect(match).not.toBeNull();
      expect(match!.pattern.id).toBe("scss-undefined-variable");
    });

    it("matches Odoo color variable error", () => {
      const match = matchErrorPattern("Undefined variable: $o-color-1");
      expect(match).not.toBeNull();
      expect(match!.pattern.id).toBe("scss-odoo-color-undefined");
    });

    it("matches Bootstrap variable error", () => {
      const match = matchErrorPattern("Undefined variable: $primary");
      expect(match).not.toBeNull();
      expect(match!.pattern.id).toBe("scss-bootstrap-variable-missing");
    });

    it("matches map key not found error", () => {
      const match = matchErrorPattern("Key 'primary' not found in map $colors");
      expect(match).not.toBeNull();
      expect(match!.pattern.id).toBe("scss-map-key-missing");
    });
  });

  describe("SCSS syntax pattern matching", () => {
    it("matches missing semicolon error", () => {
      const match = matchErrorPattern("Expected ';' after property value");
      expect(match).not.toBeNull();
      expect(match!.pattern.id).toBe("scss-missing-semicolon");
    });

    it("matches missing brace error", () => {
      const match = matchErrorPattern("Expected '{' after selector");
      expect(match).not.toBeNull();
      expect(match!.pattern.id).toBe("scss-missing-brace");
    });

    it("matches undefined mixin error", () => {
      const match = matchErrorPattern("Undefined mixin: button-style");
      expect(match).not.toBeNull();
      expect(match!.pattern.id).toBe("scss-undefined-mixin");
    });

    it("matches undefined function error", () => {
      const match = matchErrorPattern("Undefined function: custom-calc");
      expect(match).not.toBeNull();
      expect(match!.pattern.id).toBe("scss-undefined-function");
    });
  });

  describe("Odoo-specific pattern matching", () => {
    it("matches field not found error", () => {
      const match = matchErrorPattern("Field 'user_name' not found on model 'res.partner'");
      expect(match).not.toBeNull();
      expect(match!.pattern.id).toBe("odoo-field-not-found");
    });

    it("matches model not found error", () => {
      const match = matchErrorPattern("Model 'custom.model' not found");
      expect(match).not.toBeNull();
      expect(match!.pattern.id).toBe("odoo-model-not-found");
    });

    it("matches view not found error", () => {
      const match = matchErrorPattern("View 'website.custom_page' not found");
      expect(match).not.toBeNull();
      expect(match!.pattern.id).toBe("odoo-view-not-found");
    });

    it("matches access denied error", () => {
      const match = matchErrorPattern("Access Denied: permission denied for model");
      expect(match).not.toBeNull();
      expect(match!.pattern.id).toBe("odoo-access-denied");
    });
  });

  describe("fix template generation", () => {
    it("generates fix with captured groups", () => {
      const library = new ErrorPatternLibrary();
      const match = library.match("Undefined variable: $my-custom-var");

      expect(match).not.toBeNull();
      expect(match!.suggestedFix).toBeTruthy();
    });

    it("provides actionable fix suggestions", () => {
      const testCases = [
        { error: "t-foreach without t-as", expectContains: "t-as" },
        { error: "Undefined mixin: gradient", expectContains: "@mixin" },
        { error: "Expected ';'", expectContains: ";" },
      ];

      for (const { error, expectContains } of testCases) {
        const match = matchErrorPattern(error);
        expect(match).not.toBeNull();
        expect(match!.suggestedFix.toLowerCase()).toContain(expectContains.toLowerCase());
      }
    });
  });

  describe("matchAll functionality", () => {
    it("returns multiple matches when applicable", () => {
      // An error that could match multiple patterns (generic SCSS variable)
      const matches = matchAllErrorPatterns("Undefined variable: $custom-var");
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it("sorts matches by confidence", () => {
      const matches = matchAllErrorPatterns("Undefined variable: $primary");

      if (matches.length > 1) {
        for (let i = 1; i < matches.length; i++) {
          expect(matches[i - 1].confidence).toBeGreaterThanOrEqual(matches[i].confidence);
        }
      }
    });

    it("respects maxMatches option", () => {
      const matches = matchAllErrorPatterns("error", { maxMatches: 3 });
      expect(matches.length).toBeLessThanOrEqual(3);
    });
  });

  describe("filtering options", () => {
    it("filters by category", () => {
      const library = new ErrorPatternLibrary();
      const matches = library.matchAll("Undefined variable: $color", {
        categories: ["scss-variable"],
      });

      for (const match of matches) {
        expect(match.pattern.category).toBe("scss-variable");
      }
    });

    it("filters by tags", () => {
      const library = new ErrorPatternLibrary();
      const matches = library.matchAll("variable error", {
        tags: ["variable"],
      });

      for (const match of matches) {
        expect(match.pattern.tags).toContain("variable");
      }
    });

    it("filters by minimum confidence", () => {
      const library = new ErrorPatternLibrary();
      const matches = library.matchAll("Undefined variable: $test", {
        minConfidence: 0.5,
      });

      for (const match of matches) {
        expect(match.confidence).toBeGreaterThanOrEqual(0.5);
      }
    });
  });

  describe("library query methods", () => {
    it("getPattern returns pattern by ID", () => {
      const library = new ErrorPatternLibrary();
      const pattern = library.getPattern("scss-undefined-variable");

      expect(pattern).not.toBeUndefined();
      expect(pattern!.id).toBe("scss-undefined-variable");
    });

    it("getPattern returns undefined for unknown ID", () => {
      const library = new ErrorPatternLibrary();
      const pattern = library.getPattern("unknown-pattern-id");

      expect(pattern).toBeUndefined();
    });

    it("getPatternsByCategory returns matching patterns", () => {
      const library = new ErrorPatternLibrary();
      const patterns = library.getPatternsByCategory("qweb-directive");

      expect(patterns.length).toBeGreaterThan(0);
      for (const pattern of patterns) {
        expect(pattern.category).toBe("qweb-directive");
      }
    });

    it("getPatternsByTag returns matching patterns", () => {
      const library = new ErrorPatternLibrary();
      const patterns = library.getPatternsByTag("variable");

      expect(patterns.length).toBeGreaterThan(0);
      for (const pattern of patterns) {
        expect(pattern.tags).toContain("variable");
      }
    });

    it("getCategories returns all unique categories", () => {
      const library = new ErrorPatternLibrary();
      const categories = library.getCategories();

      expect(categories.length).toBeGreaterThan(0);
      expect(new Set(categories).size).toBe(categories.length);
    });

    it("getTags returns all unique tags sorted", () => {
      const library = new ErrorPatternLibrary();
      const tags = library.getTags();

      expect(tags.length).toBeGreaterThan(0);
      // Check sorted
      for (let i = 1; i < tags.length; i++) {
        expect(tags[i - 1].localeCompare(tags[i])).toBeLessThanOrEqual(0);
      }
    });

    it("count returns total pattern count", () => {
      const library = new ErrorPatternLibrary();
      expect(library.count).toBe(ERROR_PATTERNS.length);
    });
  });

  describe("confidence calculation", () => {
    it("returns confidence between 0 and 1", () => {
      const matches = matchAllErrorPatterns("Undefined variable: $test");

      for (const match of matches) {
        expect(match.confidence).toBeGreaterThanOrEqual(0);
        expect(match.confidence).toBeLessThanOrEqual(1);
      }
    });

    it("higher confidence for more specific matches", () => {
      // Specific SCSS variable error
      const specificMatch = matchErrorPattern("Undefined variable: $primary-color");
      // Generic error
      const genericMatch = matchErrorPattern("some error occurred");

      if (specificMatch && genericMatch) {
        expect(specificMatch.confidence).toBeGreaterThan(genericMatch.confidence);
      }
    });
  });
});

describe("createErrorPatternLibrary", () => {
  it("creates library instance", () => {
    const library = createErrorPatternLibrary();
    expect(library).toBeInstanceOf(ErrorPatternLibrary);
  });

  it("library has all patterns", () => {
    const library = createErrorPatternLibrary();
    expect(library.count).toBe(ERROR_PATTERNS.length);
  });
});

describe("verification: library contains 50+ patterns with regex, category, and fix template", () => {
  it("has at least 50 patterns", () => {
    expect(ERROR_PATTERNS.length).toBeGreaterThanOrEqual(50);
  });

  it("each pattern has regex for matching", () => {
    for (const pattern of ERROR_PATTERNS) {
      expect(pattern.pattern).toBeInstanceOf(RegExp);
      // Verify regex is usable
      expect(() => "test string".match(pattern.pattern)).not.toThrow();
    }
  });

  it("each pattern has category", () => {
    for (const pattern of ERROR_PATTERNS) {
      expect(pattern.category).toBeTruthy();
      expect(typeof pattern.category).toBe("string");
    }
  });

  it("each pattern has fix template", () => {
    for (const pattern of ERROR_PATTERNS) {
      expect(pattern.fixTemplate).toBeTruthy();
      expect(typeof pattern.fixTemplate).toBe("string");
      expect(pattern.fixTemplate.length).toBeGreaterThan(10); // Meaningful fix
    }
  });

  it("covers QWeb patterns", () => {
    const qwebPatterns = ERROR_PATTERNS.filter((p) =>
      p.category.startsWith("qweb")
    );
    expect(qwebPatterns.length).toBeGreaterThanOrEqual(15);
  });

  it("covers SCSS patterns", () => {
    const scssPatterns = ERROR_PATTERNS.filter((p) =>
      p.category.startsWith("scss")
    );
    expect(scssPatterns.length).toBeGreaterThanOrEqual(15);
  });

  it("covers Odoo patterns", () => {
    const odooPatterns = ERROR_PATTERNS.filter((p) =>
      p.category.startsWith("odoo")
    );
    expect(odooPatterns.length).toBeGreaterThanOrEqual(8);
  });

  it("patterns match their example errors", () => {
    for (const pattern of ERROR_PATTERNS) {
      const match = pattern.pattern.test(pattern.example);
      expect(match).toBe(true);
    }
  });
});
