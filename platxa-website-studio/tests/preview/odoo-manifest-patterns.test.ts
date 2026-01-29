import { describe, it, expect, beforeEach } from "vitest";
import {
  ManifestErrorDetector,
  createManifestErrorDetector,
  detectManifestError,
  detectAllManifestErrors,
  interpolateTemplate,
  isMissingKeyError,
  isInvalidSyntaxError,
  isBadDependencyError,
  isWrongVersionError,
  isValidOdooVersion,
  isValidLicense,
  findMissingKeys,
  findMissingRecommendedKeys,
  getManifestErrorStats,
  formatManifestError,
  MISSING_KEY_PATTERNS,
  INVALID_SYNTAX_PATTERNS,
  BAD_DEPENDENCY_PATTERNS,
  WRONG_VERSION_PATTERNS,
  ALL_MANIFEST_PATTERNS,
  REQUIRED_MANIFEST_KEYS,
  RECOMMENDED_MANIFEST_KEYS,
  VALID_LICENSES,
  type ManifestError,
  type ManifestErrorType,
} from "@/lib/preview/odoo-manifest-patterns";

describe("OdooManifestPatterns", () => {
  describe("patterns for missing key (Feature #141)", () => {
    it("detects manifest missing required key", () => {
      // Feature #141: Patterns for missing key
      const error = detectManifestError("manifest missing required key 'name'");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("missing_key");
      expect(error!.details.key).toBe("name");
    });

    it("detects KeyError in manifest", () => {
      // Feature #141: Patterns for missing key
      const error = detectManifestError("KeyError: 'version'");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("missing_key");
      expect(error!.details.key).toBe("version");
    });

    it("detects required field not found", () => {
      // Feature #141: Patterns for missing key
      const error = detectManifestError("required field 'depends' is missing");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("missing_key");
      expect(error!.details.key).toBe("depends");
    });

    it("isMissingKeyError returns true for missing key errors", () => {
      expect(isMissingKeyError("manifest missing key 'name'")).toBe(true);
      expect(isMissingKeyError("KeyError: 'author'")).toBe(true);
      expect(isMissingKeyError("no 'version' found in manifest")).toBe(true);
    });
  });

  describe("patterns for invalid syntax (Feature #141)", () => {
    it("detects SyntaxError in manifest", () => {
      // Feature #141: Patterns for invalid syntax
      const error = detectManifestError("SyntaxError: invalid syntax in __manifest__.py");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("invalid_syntax");
    });

    it("detects invalid manifest format", () => {
      // Feature #141: Patterns for invalid syntax
      const error = detectManifestError("invalid manifest syntax detected");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("invalid_syntax");
    });

    it("detects manifest not a dictionary", () => {
      // Feature #141: Patterns for invalid syntax
      const error = detectManifestError("manifest is not a valid dictionary");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("invalid_syntax");
    });

    it("isInvalidSyntaxError returns true for syntax errors", () => {
      expect(isInvalidSyntaxError("SyntaxError in __manifest__.py")).toBe(true);
      expect(isInvalidSyntaxError("malformed manifest format")).toBe(true);
      expect(isInvalidSyntaxError("unexpected token in manifest")).toBe(true);
    });
  });

  describe("patterns for bad dependency (Feature #141)", () => {
    it("detects module not found", () => {
      // Feature #141: Patterns for bad dependency
      const error = detectManifestError("module 'sale_custom' not found");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("bad_dependency");
      expect(error!.details.value).toBe("sale_custom");
    });

    it("detects cannot resolve dependency", () => {
      // Feature #141: Patterns for bad dependency
      const error = detectManifestError("cannot find module 'website_partner'");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("bad_dependency");
      expect(error!.details.value).toBe("website_partner");
    });

    it("detects circular dependency", () => {
      // Feature #141: Patterns for bad dependency
      const error = detectManifestError("circular dependency detected with 'stock'");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("bad_dependency");
      expect(error!.details.value).toBe("stock");
    });

    it("detects unmet dependency", () => {
      // Feature #141: Patterns for bad dependency
      const error = detectManifestError("unmet dependency: 'purchase'");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("bad_dependency");
      expect(error!.details.value).toBe("purchase");
    });

    it("isBadDependencyError returns true for dependency errors", () => {
      expect(isBadDependencyError("module 'base' not found")).toBe(true);
      expect(isBadDependencyError("cannot resolve module 'web'")).toBe(true);
      expect(isBadDependencyError("circular dependency with 'sale'")).toBe(true);
    });
  });

  describe("patterns for wrong version (Feature #141)", () => {
    it("detects invalid version format", () => {
      // Feature #141: Patterns for wrong version
      const error = detectManifestError("invalid version format: 'abc'");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("wrong_version");
      expect(error!.details.value).toBe("abc");
    });

    it("detects incompatible version", () => {
      // Feature #141: Patterns for wrong version
      const error = detectManifestError("version '14.0.1.0.0' is incompatible");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("wrong_version");
      expect(error!.details.value).toBe("14.0.1.0.0");
    });

    it("detects version mismatch", () => {
      // Feature #141: Patterns for wrong version
      const error = detectManifestError("module version '15.0' doesn't match");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("wrong_version");
      expect(error!.details.value).toBe("15.0");
    });

    it("detects expected version mismatch", () => {
      // Feature #141: Patterns for wrong version
      const error = detectManifestError("expected odoo version '16.0' but got '15.0.1.0.0'");

      expect(error).not.toBeNull();
      expect(error!.type).toBe("wrong_version");
      expect(error!.details.expected).toBe("16.0");
      expect(error!.details.value).toBe("15.0.1.0.0");
    });

    it("isWrongVersionError returns true for version errors", () => {
      expect(isWrongVersionError("invalid version format: 'x.y'")).toBe(true);
      expect(isWrongVersionError("version '14.0' is incompatible")).toBe(true);
      expect(isWrongVersionError("version must start with '16.0'")).toBe(true);
    });
  });

  describe("detectManifestError", () => {
    it("returns null for non-matching messages", () => {
      const error = detectManifestError("Some random error message");
      expect(error).toBeNull();
    });

    it("includes suggested fix", () => {
      const error = detectManifestError("KeyError: 'name'");

      expect(error).not.toBeNull();
      expect(error!.suggestedFix).toBeTruthy();
      expect(error!.suggestedFix).toContain("name");
    });

    it("includes matched text", () => {
      const error = detectManifestError("manifest missing required key 'author'");

      expect(error).not.toBeNull();
      expect(error!.matchedText).toBeTruthy();
    });
  });

  describe("detectAllManifestErrors", () => {
    it("detects multiple errors", () => {
      const message = "KeyError: 'name' and module 'base' not found";
      const errors = detectAllManifestErrors(message);

      expect(errors.length).toBe(2);
      expect(errors.map((e) => e.type)).toContain("missing_key");
      expect(errors.map((e) => e.type)).toContain("bad_dependency");
    });

    it("returns empty array for no matches", () => {
      const errors = detectAllManifestErrors("Everything is fine");
      expect(errors.length).toBe(0);
    });
  });

  describe("interpolateTemplate", () => {
    it("replaces key placeholder", () => {
      const result = interpolateTemplate("Missing {key} in manifest", { key: "name" });
      expect(result).toBe("Missing name in manifest");
    });

    it("replaces value placeholder", () => {
      const result = interpolateTemplate("Invalid value: {value}", { value: "abc" });
      expect(result).toBe("Invalid value: abc");
    });

    it("replaces expected placeholder", () => {
      const result = interpolateTemplate("Expected {expected}", { expected: "16.0" });
      expect(result).toBe("Expected 16.0");
    });

    it("replaces multiple placeholders", () => {
      const result = interpolateTemplate(
        "{key} should be {expected} but got {value}",
        { key: "version", expected: "16.0", value: "15.0" }
      );
      expect(result).toBe("version should be 16.0 but got 15.0");
    });
  });

  describe("isValidOdooVersion", () => {
    it("accepts Odoo version format", () => {
      expect(isValidOdooVersion("16.0.1.0.0")).toBe(true);
      expect(isValidOdooVersion("15.0.2.1.3")).toBe(true);
    });

    it("accepts semantic version format", () => {
      expect(isValidOdooVersion("1.0.0")).toBe(true);
      expect(isValidOdooVersion("2.3.4")).toBe(true);
    });

    it("accepts simple version format", () => {
      expect(isValidOdooVersion("1.0")).toBe(true);
      expect(isValidOdooVersion("16.0")).toBe(true);
    });

    it("rejects invalid formats", () => {
      expect(isValidOdooVersion("abc")).toBe(false);
      expect(isValidOdooVersion("1")).toBe(false);
      expect(isValidOdooVersion("v1.0.0")).toBe(false);
    });
  });

  describe("isValidLicense", () => {
    it("accepts valid Odoo licenses", () => {
      expect(isValidLicense("LGPL-3")).toBe(true);
      expect(isValidLicense("AGPL-3")).toBe(true);
      expect(isValidLicense("OEEL-1")).toBe(true);
    });

    it("rejects invalid licenses", () => {
      expect(isValidLicense("MIT")).toBe(false);
      expect(isValidLicense("Apache")).toBe(false);
    });
  });

  describe("findMissingKeys", () => {
    it("finds missing required keys", () => {
      const manifestKeys = ["author", "category"];
      const missing = findMissingKeys(manifestKeys);

      expect(missing).toContain("name");
      expect(missing).toContain("version");
      expect(missing).toContain("depends");
    });

    it("returns empty for complete manifest", () => {
      const manifestKeys = ["name", "version", "depends", "author"];
      const missing = findMissingKeys(manifestKeys);

      expect(missing.length).toBe(0);
    });
  });

  describe("findMissingRecommendedKeys", () => {
    it("finds missing recommended keys", () => {
      const manifestKeys = ["name", "version", "depends"];
      const missing = findMissingRecommendedKeys(manifestKeys);

      expect(missing).toContain("author");
      expect(missing).toContain("license");
    });
  });

  describe("getManifestErrorStats", () => {
    it("counts errors by type", () => {
      const errors: ManifestError[] = [
        { type: "missing_key", severity: "error", message: "", suggestedFix: "", details: {}, matchedText: "", confidence: 0.9 },
        { type: "missing_key", severity: "error", message: "", suggestedFix: "", details: {}, matchedText: "", confidence: 0.9 },
        { type: "bad_dependency", severity: "error", message: "", suggestedFix: "", details: {}, matchedText: "", confidence: 0.9 },
        { type: "wrong_version", severity: "warning", message: "", suggestedFix: "", details: {}, matchedText: "", confidence: 0.9 },
      ];

      const stats = getManifestErrorStats(errors);

      expect(stats.missing_key).toBe(2);
      expect(stats.bad_dependency).toBe(1);
      expect(stats.wrong_version).toBe(1);
      expect(stats.invalid_syntax).toBe(0);
    });
  });

  describe("formatManifestError", () => {
    it("formats error for display", () => {
      const error: ManifestError = {
        type: "missing_key",
        severity: "error",
        message: "Required key 'name' is missing",
        suggestedFix: "Add 'name' to __manifest__.py",
        details: { key: "name" },
        matchedText: "missing key 'name'",
        confidence: 0.9,
      };

      const formatted = formatManifestError(error);

      expect(formatted).toContain("ERROR");
      expect(formatted).toContain("MISSING KEY");
      expect(formatted).toContain("name");
    });
  });

  describe("ManifestErrorDetector class", () => {
    let detector: ManifestErrorDetector;

    beforeEach(() => {
      detector = createManifestErrorDetector();
    });

    it("detects errors", () => {
      const errors = detector.detect("KeyError: 'name'");

      expect(errors.length).toBe(1);
      expect(errors[0].type).toBe("missing_key");
    });

    it("caches results", () => {
      const errors1 = detector.detect("KeyError: 'name'");
      const errors2 = detector.detect("KeyError: 'name'");

      expect(errors1).toBe(errors2); // Same reference
    });

    it("clears cache", () => {
      detector.detect("KeyError: 'name'");
      detector.clearCache();

      const errors = detector.detect("KeyError: 'name'");
      expect(errors.length).toBe(1);
    });

    it("detects first error only", () => {
      const error = detector.detectFirst("KeyError: 'name' and module 'base' not found");

      expect(error).not.toBeNull();
    });

    it("hasError returns true for matching messages", () => {
      expect(detector.hasError("KeyError: 'name'")).toBe(true);
      expect(detector.hasError("No errors here")).toBe(false);
    });

    it("supports custom patterns", () => {
      const custom = createManifestErrorDetector([
        {
          pattern: /custom manifest error/i,
          type: "invalid_value",
          severity: "warning",
          description: "Custom error",
          fixTemplate: "Fix custom error",
        },
      ]);

      const errors = custom.detect("custom manifest error detected");

      expect(errors.length).toBe(1);
      expect(errors[0].type).toBe("invalid_value");
    });

    it("can add patterns after construction", () => {
      detector.addPatterns([
        {
          pattern: /added pattern error/i,
          type: "unknown",
          severity: "info",
          description: "Added pattern",
          fixTemplate: "Fix added pattern",
        },
      ]);

      const errors = detector.detect("added pattern error");

      expect(errors.length).toBe(1);
    });
  });

  describe("pattern arrays", () => {
    it("ALL_MANIFEST_PATTERNS contains all pattern sets", () => {
      const expectedCount =
        MISSING_KEY_PATTERNS.length +
        INVALID_SYNTAX_PATTERNS.length +
        BAD_DEPENDENCY_PATTERNS.length +
        WRONG_VERSION_PATTERNS.length;

      expect(ALL_MANIFEST_PATTERNS.length).toBe(expectedCount);
    });

    it("all patterns have required fields", () => {
      for (const pattern of ALL_MANIFEST_PATTERNS) {
        expect(pattern.pattern).toBeInstanceOf(RegExp);
        expect(pattern.type).toBeTruthy();
        expect(pattern.severity).toBeTruthy();
        expect(pattern.description).toBeTruthy();
        expect(pattern.fixTemplate).toBeTruthy();
      }
    });
  });

  describe("constants", () => {
    it("REQUIRED_MANIFEST_KEYS includes essential keys", () => {
      expect(REQUIRED_MANIFEST_KEYS).toContain("name");
      expect(REQUIRED_MANIFEST_KEYS).toContain("version");
      expect(REQUIRED_MANIFEST_KEYS).toContain("depends");
    });

    it("RECOMMENDED_MANIFEST_KEYS includes common keys", () => {
      expect(RECOMMENDED_MANIFEST_KEYS).toContain("author");
      expect(RECOMMENDED_MANIFEST_KEYS).toContain("license");
    });

    it("VALID_LICENSES includes Odoo licenses", () => {
      expect(VALID_LICENSES).toContain("LGPL-3");
      expect(VALID_LICENSES).toContain("AGPL-3");
    });
  });
});
