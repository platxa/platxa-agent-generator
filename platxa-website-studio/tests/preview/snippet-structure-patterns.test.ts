import { describe, it, expect, beforeEach } from "vitest";
import {
  SnippetErrorDetector,
  createSnippetErrorDetector,
  detectSnippetError,
  detectAllSnippetErrors,
  interpolateTemplate,
  isMissingOeStructureError,
  isInvalidSPrefixError,
  isBadDataAttributeError,
  isValidSnippetId,
  hasOeStructureClass,
  findMissingDataAttributes,
  getSnippetErrorStats,
  formatSnippetError,
  MISSING_OE_STRUCTURE_PATTERNS,
  INVALID_S_PREFIX_PATTERNS,
  BAD_DATA_ATTRIBUTE_PATTERNS,
  INVALID_STRUCTURE_PATTERNS,
  ALL_SNIPPET_PATTERNS,
  VALID_SNIPPET_PREFIXES,
  REQUIRED_DATA_ATTRIBUTES,
  STRUCTURE_CLASSES,
  type SnippetError,
  type SnippetErrorType,
} from "@/lib/preview/snippet-structure-patterns";

describe("SnippetStructurePatterns", () => {
  describe("patterns for missing oe_structure (Feature #142)", () => {
    it("detects missing oe_structure class on element", () => {
      // Feature #142: Patterns for missing oe_structure
      const error = detectSnippetError("missing class 'oe_structure' on element");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("missing_oe_structure");
    });

    it("detects oe_structure required error", () => {
      // Feature #142: Patterns for missing oe_structure
      const error = detectSnippetError("oe_structure class is required");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("missing_oe_structure");
    });

    it("detects cannot drop snippet without oe_structure", () => {
      // Feature #142: Patterns for missing oe_structure
      const error = detectSnippetError("cannot drop snippet without oe_structure");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("missing_oe_structure");
    });

    it("detects drop zone requires oe_structure", () => {
      // Feature #142: Patterns for missing oe_structure
      const error = detectSnippetError("snippet drop zone requires oe_structure");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("missing_oe_structure");
    });

    it("isMissingOeStructureError returns true for oe_structure errors", () => {
      expect(isMissingOeStructureError("missing oe_structure on container")).toBe(true);
      expect(isMissingOeStructureError("oe_structure is missing")).toBe(true);
      expect(isMissingOeStructureError("drop area needs oe_structure")).toBe(true);
    });
  });

  describe("patterns for invalid s_ prefix (Feature #142)", () => {
    it("detects invalid snippet prefix", () => {
      // Feature #142: Patterns for invalid s_ prefix
      const error = detectSnippetError("invalid snippet prefix: 'my_banner'");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("invalid_s_prefix");
      expect(error!.details.value).toBe("my_banner");
    });

    it("detects snippet must start with s_", () => {
      // Feature #142: Patterns for invalid s_ prefix
      const error = detectSnippetError("snippet id 'banner_hero' must start with 's_'");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("invalid_s_prefix");
      expect(error!.details.value).toBe("banner_hero");
    });

    it("detects missing s_ prefix", () => {
      // Feature #142: Patterns for invalid s_ prefix
      const error = detectSnippetError("missing s_ prefix on snippet 'custom_block'");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("invalid_s_prefix");
    });

    it("detects invalid snippet naming", () => {
      // Feature #142: Patterns for invalid s_ prefix
      const error = detectSnippetError("snippet 'MySnippet' has invalid naming format");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("invalid_s_prefix");
      expect(error!.details.value).toBe("MySnippet");
    });

    it("isInvalidSPrefixError returns true for prefix errors", () => {
      expect(isInvalidSPrefixError("invalid snippet prefix: 'test'")).toBe(true);
      expect(isInvalidSPrefixError("snippet id 'x' should start with s_")).toBe(true);
      expect(isInvalidSPrefixError("no s_ prefix for snippet")).toBe(true);
    });
  });

  describe("patterns for bad data attributes (Feature #142)", () => {
    it("detects missing data-snippet attribute", () => {
      // Feature #142: Patterns for bad data attributes
      const error = detectSnippetError("missing required data-snippet attribute");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("bad_data_attribute");
      expect(error!.details.attribute).toBe("data-snippet");
    });

    it("detects invalid data attribute value", () => {
      // Feature #142: Patterns for bad data attributes
      const error = detectSnippetError("invalid data-name attribute value: ''");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("bad_data_attribute");
      expect(error!.details.attribute).toBe("data-name");
    });

    it("detects empty data attribute", () => {
      // Feature #142: Patterns for bad data attributes
      const error = detectSnippetError("data-selector='' is empty");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("bad_data_attribute");
    });

    it("detects unknown data attribute", () => {
      // Feature #142: Patterns for bad data attributes
      const error = detectSnippetError("unknown data attribute: 'data-custom-invalid'");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("bad_data_attribute");
      expect(error!.details.attribute).toBe("data-custom-invalid");
    });

    it("detects missing data-name", () => {
      // Feature #142: Patterns for bad data attributes
      const error = detectSnippetError("data-name attribute is missing");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("bad_data_attribute");
    });

    it("isBadDataAttributeError returns true for data attribute errors", () => {
      expect(isBadDataAttributeError("missing data-snippet attribute")).toBe(true);
      expect(isBadDataAttributeError("invalid data-name attribute")).toBe(true);
      expect(isBadDataAttributeError("unknown data attribute: 'data-x'")).toBe(true);
    });
  });

  describe("detectSnippetError", () => {
    it("returns null for non-matching messages", () => {
      const error = detectSnippetError("Some random error message");
      expect(error).toBeNull();
    });

    it("includes suggested fix", () => {
      const error = detectSnippetError("oe_structure is missing");

      expect(error).not.toBeNull();
      expect(error!.suggestedFix).toBeTruthy();
    });

    it("includes matched text", () => {
      const error = detectSnippetError("invalid snippet prefix: 'test'");

      expect(error).not.toBeNull();
      expect(error!.matchedText).toBeTruthy();
    });
  });

  describe("detectAllSnippetErrors", () => {
    it("detects multiple errors", () => {
      const message = "missing oe_structure and invalid snippet prefix: 'bad'";
      const errors = detectAllSnippetErrors(message);

      expect(errors.length).toBe(2);
      expect(errors.map((e) => e.type)).toContain("missing_oe_structure");
      expect(errors.map((e) => e.type)).toContain("invalid_s_prefix");
    });

    it("returns empty array for no matches", () => {
      const errors = detectAllSnippetErrors("Everything is fine");
      expect(errors.length).toBe(0);
    });
  });

  describe("interpolateTemplate", () => {
    it("replaces element placeholder", () => {
      const result = interpolateTemplate("Missing on {element}", { element: "section" });
      expect(result).toBe("Missing on section");
    });

    it("replaces attribute placeholder", () => {
      const result = interpolateTemplate("Invalid {attribute}", { attribute: "data-name" });
      expect(result).toBe("Invalid data-name");
    });

    it("replaces value placeholder", () => {
      const result = interpolateTemplate("Got: {value}", { value: "my_snippet" });
      expect(result).toBe("Got: my_snippet");
    });

    it("replaces multiple placeholders", () => {
      const result = interpolateTemplate(
        "{attribute} on {element} has {value}",
        { attribute: "data-x", element: "div", value: "test" }
      );
      expect(result).toBe("data-x on div has test");
    });
  });

  describe("isValidSnippetId", () => {
    it("accepts s_ prefix", () => {
      expect(isValidSnippetId("s_banner")).toBe(true);
      expect(isValidSnippetId("s_hero_section")).toBe(true);
    });

    it("accepts o_ prefix", () => {
      expect(isValidSnippetId("o_website")).toBe(true);
    });

    it("accepts oe_ prefix", () => {
      expect(isValidSnippetId("oe_structure")).toBe(true);
    });

    it("rejects invalid prefixes", () => {
      expect(isValidSnippetId("my_snippet")).toBe(false);
      expect(isValidSnippetId("banner")).toBe(false);
      expect(isValidSnippetId("x_test")).toBe(false);
    });
  });

  describe("hasOeStructureClass", () => {
    it("detects oe_structure class", () => {
      expect(hasOeStructureClass("container oe_structure")).toBe(true);
      expect(hasOeStructureClass("oe_structure oe_empty")).toBe(true);
    });

    it("detects oe_structure_solo class", () => {
      expect(hasOeStructureClass("oe_structure_solo")).toBe(true);
    });

    it("detects oe_empty class", () => {
      expect(hasOeStructureClass("oe_empty")).toBe(true);
    });

    it("returns false without structure class", () => {
      expect(hasOeStructureClass("container row")).toBe(false);
      expect(hasOeStructureClass("")).toBe(false);
    });
  });

  describe("findMissingDataAttributes", () => {
    it("finds missing required attributes", () => {
      const attrs = ["data-name"];
      const missing = findMissingDataAttributes(attrs);

      expect(missing).toContain("data-snippet");
    });

    it("returns empty for complete attributes", () => {
      const attrs = ["data-snippet", "data-name"];
      const missing = findMissingDataAttributes(attrs);

      expect(missing.length).toBe(0);
    });
  });

  describe("getSnippetErrorStats", () => {
    it("counts errors by type", () => {
      const errors: SnippetError[] = [
        { type: "missing_oe_structure", severity: "error", message: "", suggestedFix: "", details: {}, matchedText: "", confidence: 0.9 },
        { type: "missing_oe_structure", severity: "error", message: "", suggestedFix: "", details: {}, matchedText: "", confidence: 0.9 },
        { type: "invalid_s_prefix", severity: "error", message: "", suggestedFix: "", details: {}, matchedText: "", confidence: 0.9 },
        { type: "bad_data_attribute", severity: "warning", message: "", suggestedFix: "", details: {}, matchedText: "", confidence: 0.9 },
      ];

      const stats = getSnippetErrorStats(errors);

      expect(stats.missing_oe_structure).toBe(2);
      expect(stats.invalid_s_prefix).toBe(1);
      expect(stats.bad_data_attribute).toBe(1);
      expect(stats.invalid_structure).toBe(0);
    });
  });

  describe("formatSnippetError", () => {
    it("formats error for display", () => {
      const error: SnippetError = {
        type: "missing_oe_structure",
        severity: "error",
        message: "Missing oe_structure class",
        suggestedFix: "Add oe_structure class",
        details: {},
        matchedText: "missing oe_structure",
        confidence: 0.9,
      };

      const formatted = formatSnippetError(error);

      expect(formatted).toContain("ERROR");
      expect(formatted).toContain("MISSING OE STRUCTURE");
    });
  });

  describe("SnippetErrorDetector class", () => {
    let detector: SnippetErrorDetector;

    beforeEach(() => {
      detector = createSnippetErrorDetector();
    });

    it("detects errors", () => {
      const errors = detector.detect("oe_structure is missing");

      expect(errors.length).toBe(1);
      expect(errors[0].type).toBe("missing_oe_structure");
    });

    it("caches results", () => {
      const errors1 = detector.detect("oe_structure is missing");
      const errors2 = detector.detect("oe_structure is missing");

      expect(errors1).toBe(errors2);
    });

    it("clears cache", () => {
      detector.detect("oe_structure is missing");
      detector.clearCache();

      const errors = detector.detect("oe_structure is missing");
      expect(errors.length).toBe(1);
    });

    it("detects first error only", () => {
      const error = detector.detectFirst("missing oe_structure and invalid prefix: 'x'");

      expect(error).not.toBeNull();
    });

    it("hasError returns true for matching messages", () => {
      expect(detector.hasError("oe_structure is missing")).toBe(true);
      expect(detector.hasError("No errors here")).toBe(false);
    });

    it("supports custom patterns", () => {
      const custom = createSnippetErrorDetector([
        {
          pattern: /custom snippet error/i,
          type: "unknown",
          severity: "warning",
          description: "Custom error",
          fixTemplate: "Fix custom error",
        },
      ]);

      const errors = custom.detect("custom snippet error detected");

      expect(errors.length).toBe(1);
      expect(errors[0].type).toBe("unknown");
    });

    it("can add patterns after construction", () => {
      detector.addPatterns([
        {
          pattern: /added snippet pattern/i,
          type: "invalid_structure",
          severity: "info",
          description: "Added pattern",
          fixTemplate: "Fix added pattern",
        },
      ]);

      const errors = detector.detect("added snippet pattern");

      expect(errors.length).toBe(1);
    });
  });

  describe("pattern arrays", () => {
    it("ALL_SNIPPET_PATTERNS contains all pattern sets", () => {
      const expectedCount =
        MISSING_OE_STRUCTURE_PATTERNS.length +
        INVALID_S_PREFIX_PATTERNS.length +
        BAD_DATA_ATTRIBUTE_PATTERNS.length +
        INVALID_STRUCTURE_PATTERNS.length;

      expect(ALL_SNIPPET_PATTERNS.length).toBe(expectedCount);
    });

    it("all patterns have required fields", () => {
      for (const pattern of ALL_SNIPPET_PATTERNS) {
        expect(pattern.pattern).toBeInstanceOf(RegExp);
        expect(pattern.type).toBeTruthy();
        expect(pattern.severity).toBeTruthy();
        expect(pattern.description).toBeTruthy();
        expect(pattern.fixTemplate).toBeTruthy();
      }
    });
  });

  describe("constants", () => {
    it("VALID_SNIPPET_PREFIXES includes standard prefixes", () => {
      expect(VALID_SNIPPET_PREFIXES).toContain("s_");
      expect(VALID_SNIPPET_PREFIXES).toContain("o_");
      expect(VALID_SNIPPET_PREFIXES).toContain("oe_");
    });

    it("REQUIRED_DATA_ATTRIBUTES includes essential attributes", () => {
      expect(REQUIRED_DATA_ATTRIBUTES).toContain("data-snippet");
      expect(REQUIRED_DATA_ATTRIBUTES).toContain("data-name");
    });

    it("STRUCTURE_CLASSES includes oe_structure", () => {
      expect(STRUCTURE_CLASSES).toContain("oe_structure");
      expect(STRUCTURE_CLASSES).toContain("oe_structure_solo");
    });
  });
});
