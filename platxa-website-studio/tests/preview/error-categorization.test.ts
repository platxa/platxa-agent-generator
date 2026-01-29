import { describe, it, expect, beforeEach } from "vitest";
import {
  ErrorCategorizer,
  createErrorCategorizer,
  categorizeError,
  generateSuggestedFix,
  extractIdentifier,
  extractProperty,
  getFixApproaches,
  isSyntaxError,
  isReferenceError,
  isTypeError,
  isRuntimeError,
  isStructureError,
  getCategoryStats,
  formatCategorizedError,
  CATEGORY_CONFIG,
  FIX_APPROACH_CONFIG,
  SYNTAX_PATTERNS,
  REFERENCE_PATTERNS,
  TYPE_PATTERNS,
  RUNTIME_PATTERNS,
  STRUCTURE_PATTERNS,
  ALL_PATTERNS,
  type ErrorCategory,
  type FixApproach,
  type CategorizedError,
} from "@/lib/preview/error-categorization";

describe("ErrorCategorization", () => {
  describe("each error assigned to category (Feature #135)", () => {
    it("categorizes syntax errors", () => {
      // Feature #135: Each error assigned to category
      const result = categorizeError("SyntaxError: Unexpected token '}'");

      expect(result).not.toBeNull();
      expect(result!.category).toBe("syntax");
      expect(result!.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it("categorizes reference errors", () => {
      // Feature #135: Each error assigned to category
      const result = categorizeError("ReferenceError: myVar is not defined");

      expect(result).not.toBeNull();
      expect(result!.category).toBe("reference");
    });

    it("categorizes type errors", () => {
      // Feature #135: Each error assigned to category
      const result = categorizeError("TypeError: Cannot read property 'x' of undefined");

      expect(result).not.toBeNull();
      expect(result!.category).toBe("type");
    });

    it("categorizes runtime errors", () => {
      // Feature #135: Each error assigned to category
      const result = categorizeError("RuntimeError: division by zero");

      expect(result).not.toBeNull();
      expect(result!.category).toBe("runtime");
    });

    it("categorizes structure errors", () => {
      // Feature #135: Each error assigned to category
      const result = categorizeError("Circular dependency detected in module imports");

      expect(result).not.toBeNull();
      expect(result!.category).toBe("structure");
    });
  });

  describe("category influences fix approach (Feature #135)", () => {
    it("syntax errors suggest syntax fixes", () => {
      // Feature #135: Category influences fix approach
      const result = categorizeError("SyntaxError: missing semicolon");

      expect(result).not.toBeNull();
      expect(result!.fixApproaches).toContain("correct_syntax");
      expect(result!.suggestedFix).toContain("syntax");
    });

    it("reference errors suggest import/define fixes", () => {
      // Feature #135: Category influences fix approach
      const result = categorizeError("NameError: name 'pandas' is not defined");

      expect(result).not.toBeNull();
      expect(result!.fixApproaches).toContain("add_import");
      expect(result!.suggestedFix).toContain("pandas");
    });

    it("type errors suggest null check/type fixes", () => {
      // Feature #135: Category influences fix approach
      const result = categorizeError("Cannot read property 'length' of undefined");

      expect(result).not.toBeNull();
      expect(result!.fixApproaches).toContain("add_null_check");
      expect(result!.suggestedFix).toContain("null check");
    });

    it("runtime errors suggest error handling", () => {
      // Feature #135: Category influences fix approach
      const result = categorizeError("Unhandled exception in async code");

      expect(result).not.toBeNull();
      expect(result!.fixApproaches).toContain("handle_exception");
    });

    it("structure errors suggest structure fixes", () => {
      // Feature #135: Category influences fix approach
      const result = categorizeError("Invalid inheritance hierarchy detected");

      expect(result).not.toBeNull();
      expect(result!.fixApproaches).toContain("fix_hierarchy");
    });
  });

  describe("SYNTAX_PATTERNS", () => {
    it("matches SyntaxError", () => {
      expect(isSyntaxError("SyntaxError: invalid syntax")).toBe(true);
    });

    it("matches unexpected token", () => {
      expect(isSyntaxError("Unexpected token 'else'")).toBe(true);
    });

    it("matches unterminated string", () => {
      expect(isSyntaxError("Unterminated string literal")).toBe(true);
    });

    it("matches parse error", () => {
      expect(isSyntaxError("Parse error at line 10")).toBe(true);
    });

    it("matches IndentationError", () => {
      expect(isSyntaxError("IndentationError: unexpected indent")).toBe(true);
    });

    it("does not match unrelated errors", () => {
      expect(isSyntaxError("TypeError: x is not a function")).toBe(false);
    });
  });

  describe("REFERENCE_PATTERNS", () => {
    it("matches ReferenceError", () => {
      expect(isReferenceError("ReferenceError: x is not defined")).toBe(true);
    });

    it("matches NameError", () => {
      expect(isReferenceError("NameError: name 'foo' is not defined")).toBe(true);
    });

    it("matches ImportError", () => {
      expect(isReferenceError("ImportError: No module named 'missing'")).toBe(true);
    });

    it("matches ModuleNotFoundError", () => {
      expect(isReferenceError("ModuleNotFoundError: No module named 'pkg'")).toBe(true);
    });

    it("matches 'cannot find module'", () => {
      expect(isReferenceError("Cannot find module 'lodash'")).toBe(true);
    });

    it("does not match unrelated errors", () => {
      expect(isReferenceError("SyntaxError: invalid syntax")).toBe(false);
    });
  });

  describe("TYPE_PATTERNS", () => {
    it("matches TypeError", () => {
      expect(isTypeError("TypeError: x is not a function")).toBe(true);
    });

    it("matches AttributeError", () => {
      expect(isTypeError("AttributeError: 'str' object has no attribute 'foo'")).toBe(true);
    });

    it("matches property of undefined", () => {
      expect(isTypeError("Cannot read property 'x' of undefined")).toBe(true);
    });

    it("matches 'is not a function'", () => {
      expect(isTypeError("myVar is not a function")).toBe(true);
    });

    it("matches 'has no attribute'", () => {
      expect(isTypeError("Object has no attribute 'missing'")).toBe(true);
    });

    it("does not match unrelated errors", () => {
      expect(isTypeError("ReferenceError: x is not defined")).toBe(false);
    });
  });

  describe("RUNTIME_PATTERNS", () => {
    it("matches RuntimeError", () => {
      expect(isRuntimeError("RuntimeError: maximum recursion depth exceeded")).toBe(true);
    });

    it("matches division by zero", () => {
      expect(isRuntimeError("ZeroDivisionError: division by zero")).toBe(true);
    });

    it("matches stack overflow", () => {
      expect(isRuntimeError("RangeError: Maximum call stack overflow")).toBe(true);
    });

    it("matches timeout", () => {
      expect(isRuntimeError("Operation timed out after 30s")).toBe(true);
    });

    it("matches unhandled exception", () => {
      expect(isRuntimeError("Unhandled exception in promise")).toBe(true);
    });

    it("does not match unrelated errors", () => {
      expect(isRuntimeError("SyntaxError: invalid syntax")).toBe(false);
    });
  });

  describe("STRUCTURE_PATTERNS", () => {
    it("matches circular dependency", () => {
      expect(isStructureError("Circular dependency detected")).toBe(true);
    });

    it("matches invalid inheritance", () => {
      expect(isStructureError("Invalid inheritance: class not found")).toBe(true);
    });

    it("matches abstract method not implemented", () => {
      expect(isStructureError("Abstract method 'render' not implemented")).toBe(true);
    });

    it("matches duplicate definition", () => {
      expect(isStructureError("Duplicate definition of 'myFunc'")).toBe(true);
    });

    it("matches missing required field", () => {
      expect(isStructureError("Missing required field 'name'")).toBe(true);
    });

    it("does not match unrelated errors", () => {
      expect(isStructureError("TypeError: x is not a function")).toBe(false);
    });
  });

  describe("categorizeError", () => {
    it("returns null for unrecognized errors", () => {
      const result = categorizeError("Something went wrong");
      expect(result).toBeNull();
    });

    it("selects highest confidence match", () => {
      // TypeError has confidence 1.0, while partial matches might be lower
      const result = categorizeError("TypeError: Cannot read property 'x' of null");

      expect(result).not.toBeNull();
      expect(result!.category).toBe("type");
      expect(result!.confidence).toBe(1.0);
    });

    it("includes fix approaches in result", () => {
      const result = categorizeError("SyntaxError: unexpected end of input");

      expect(result).not.toBeNull();
      expect(result!.fixApproaches.length).toBeGreaterThan(0);
    });

    it("includes suggested fix in result", () => {
      const result = categorizeError("NameError: name 'config' is not defined");

      expect(result).not.toBeNull();
      expect(result!.suggestedFix).toBeTruthy();
      expect(result!.suggestedFix).toContain("config");
    });
  });

  describe("extractIdentifier", () => {
    it("extracts from quoted 'is not defined'", () => {
      expect(extractIdentifier("'myVar' is not defined")).toBe("myVar");
    });

    it("extracts from name pattern", () => {
      expect(extractIdentifier("name 'config' is undefined")).toBe("config");
    });

    it("extracts from module pattern", () => {
      expect(extractIdentifier("No module 'requests' found")).toBe("requests");
    });

    it("extracts from cannot find pattern", () => {
      expect(extractIdentifier("Cannot find 'lodash'")).toBe("lodash");
    });

    it("returns null for non-matching", () => {
      expect(extractIdentifier("Some generic error")).toBeNull();
    });
  });

  describe("extractProperty", () => {
    it("extracts from property pattern", () => {
      expect(extractProperty("property 'length' of undefined")).toBe("length");
    });

    it("extracts from attribute pattern", () => {
      expect(extractProperty("attribute 'name' not found")).toBe("name");
    });

    it("extracts from read pattern", () => {
      expect(extractProperty("Cannot read 'map' of null")).toBe("map");
    });

    it("returns null for non-matching", () => {
      expect(extractProperty("Generic error message")).toBeNull();
    });
  });

  describe("getFixApproaches", () => {
    it("returns approaches for syntax category", () => {
      const approaches = getFixApproaches("syntax");

      expect(approaches.length).toBeGreaterThan(0);
      expect(approaches[0].name).toBe("correct_syntax");
    });

    it("returns approaches for reference category", () => {
      const approaches = getFixApproaches("reference");

      expect(approaches.length).toBeGreaterThan(0);
      expect(approaches.some((a) => a.name === "add_import")).toBe(true);
    });

    it("returns approaches for type category", () => {
      const approaches = getFixApproaches("type");

      expect(approaches.some((a) => a.name === "add_null_check")).toBe(true);
    });
  });

  describe("getCategoryStats", () => {
    it("counts errors by category", () => {
      const errors = [
        "SyntaxError: invalid syntax",
        "ReferenceError: x is not defined",
        "TypeError: y is not a function",
        "SyntaxError: unexpected token",
        "RuntimeError: division by zero",
      ];

      const stats = getCategoryStats(errors);

      expect(stats.syntax).toBe(2);
      expect(stats.reference).toBe(1);
      expect(stats.type).toBe(1);
      expect(stats.runtime).toBe(1);
      expect(stats.structure).toBe(0);
    });

    it("handles empty array", () => {
      const stats = getCategoryStats([]);

      expect(stats.syntax).toBe(0);
      expect(stats.reference).toBe(0);
    });
  });

  describe("formatCategorizedError", () => {
    it("formats error with all details", () => {
      const error: CategorizedError = {
        message: "ReferenceError: foo is not defined",
        category: "reference",
        confidence: 0.95,
        fixApproaches: ["add_import", "define_variable"],
        suggestedFix: "Add import or define 'foo'",
      };

      const formatted = formatCategorizedError(error);

      expect(formatted).toContain("Reference Error");
      expect(formatted).toContain("95%");
      expect(formatted).toContain("foo is not defined");
      expect(formatted).toContain("Add Import");
    });
  });

  describe("CATEGORY_CONFIG", () => {
    it("provides config for all categories", () => {
      const categories: ErrorCategory[] = [
        "syntax",
        "reference",
        "type",
        "runtime",
        "structure",
      ];

      for (const category of categories) {
        const config = CATEGORY_CONFIG[category];

        expect(config).toBeDefined();
        expect(config.name).toBe(category);
        expect(config.label).toBeTruthy();
        expect(config.description).toBeTruthy();
        expect(config.icon).toBeTruthy();
        expect(config.color).toBeTruthy();
        expect(config.fixApproaches.length).toBeGreaterThan(0);
      }
    });
  });

  describe("FIX_APPROACH_CONFIG", () => {
    it("provides config for all approaches", () => {
      const approaches: FixApproach[] = [
        "correct_syntax",
        "add_import",
        "define_variable",
        "fix_type_mismatch",
        "add_null_check",
        "fix_logic",
        "handle_exception",
        "fix_structure",
        "fix_hierarchy",
      ];

      for (const approach of approaches) {
        const config = FIX_APPROACH_CONFIG[approach];

        expect(config).toBeDefined();
        expect(config.name).toBe(approach);
        expect(config.label).toBeTruthy();
        expect(config.description).toBeTruthy();
        expect(config.template).toBeTruthy();
      }
    });
  });

  describe("ErrorCategorizer class", () => {
    let categorizer: ErrorCategorizer;

    beforeEach(() => {
      categorizer = createErrorCategorizer();
    });

    it("categorizes single error", () => {
      const result = categorizer.categorize("SyntaxError: invalid syntax");

      expect(result).not.toBeNull();
      expect(result!.category).toBe("syntax");
    });

    it("caches results", () => {
      const message = "TypeError: x is not callable";

      const result1 = categorizer.categorize(message);
      const result2 = categorizer.categorize(message);

      expect(result1).toBe(result2); // Same reference
    });

    it("clears cache", () => {
      categorizer.categorize("SyntaxError: test");
      categorizer.clearCache();

      // Should still work after clearing
      const result = categorizer.categorize("SyntaxError: test");
      expect(result).not.toBeNull();
    });

    it("categorizes multiple errors", () => {
      const messages = [
        "SyntaxError: invalid",
        "TypeError: not a function",
        "Random message", // Won't categorize
      ];

      const results = categorizer.categorizeAll(messages);

      expect(results.length).toBe(2);
    });

    it("gets fix approaches for error", () => {
      const approaches = categorizer.getFixApproachesFor("NameError: x is not defined");

      expect(approaches.length).toBeGreaterThan(0);
      expect(approaches.some((a) => a.name === "add_import")).toBe(true);
    });

    it("returns empty approaches for unknown error", () => {
      const approaches = categorizer.getFixApproachesFor("Unknown error");

      expect(approaches.length).toBe(0);
    });

    it("supports custom patterns", () => {
      const custom = createErrorCategorizer([
        {
          pattern: /custom error:\s*(\w+)/i,
          category: "runtime",
          confidence: 1.0,
        },
      ]);

      const result = custom.categorize("custom error: MyError");

      expect(result).not.toBeNull();
      expect(result!.category).toBe("runtime");
    });

    it("can add patterns after construction", () => {
      categorizer.addPatterns([
        {
          pattern: /added pattern/i,
          category: "structure",
          confidence: 0.9,
        },
      ]);

      const result = categorizer.categorize("added pattern detected");

      expect(result).not.toBeNull();
      expect(result!.category).toBe("structure");
    });

    it("calculates statistics", () => {
      const messages = [
        "SyntaxError: a",
        "SyntaxError: b",
        "TypeError: c",
        "Unknown error",
      ];

      const stats = categorizer.getStats(messages);

      expect(stats.total).toBe(4);
      expect(stats.categorized).toBe(3);
      expect(stats.uncategorized).toBe(1);
      expect(stats.byCategory.syntax).toBe(2);
      expect(stats.byCategory.type).toBe(1);
    });
  });

  describe("pattern arrays", () => {
    it("ALL_PATTERNS contains all pattern sets", () => {
      const expectedCount =
        SYNTAX_PATTERNS.length +
        REFERENCE_PATTERNS.length +
        TYPE_PATTERNS.length +
        RUNTIME_PATTERNS.length +
        STRUCTURE_PATTERNS.length;

      expect(ALL_PATTERNS.length).toBe(expectedCount);
    });

    it("all patterns have required fields", () => {
      for (const pattern of ALL_PATTERNS) {
        expect(pattern.pattern).toBeInstanceOf(RegExp);
        expect(["syntax", "reference", "type", "runtime", "structure"]).toContain(
          pattern.category
        );
        expect(pattern.confidence).toBeGreaterThan(0);
        expect(pattern.confidence).toBeLessThanOrEqual(1);
      }
    });
  });
});
