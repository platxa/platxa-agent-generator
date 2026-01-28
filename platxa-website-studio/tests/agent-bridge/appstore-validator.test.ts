import { describe, it, expect } from "vitest";
import {
  validateLicense,
  validateVersion,
  validateMetadata,
  validateDependencies,
  validateIcon,
  validateScreenshots,
  validateDescription,
  validatePricing,
  validateSubmission,
  VALID_LICENSES,
  VALID_CATEGORIES,
} from "@/lib/agent-bridge/appstore-validator";
import type { ManifestData, SubmissionAssets } from "@/lib/agent-bridge/appstore-validator";

const validManifest: ManifestData = {
  name: "Theme Starter",
  version: "17.0.1.0.0",
  license: "LGPL-3",
  author: "Platxa",
  website: "https://platxa.com",
  category: "Website",
  summary: "A beautiful starter theme",
  depends: ["website"],
  installable: true,
};

const validAssets: SubmissionAssets = {
  hasIcon: true,
  iconSize: [256, 256],
  screenshotCount: 4,
  screenshotPaths: ["s1.png", "s2.png", "s3.png", "s4.png"],
  hasDescription: true,
  descriptionLength: 500,
  moduleFiles: ["__manifest__.py", "models/theme.py"],
};

describe("App Store Validator", () => {
  describe("validateLicense", () => {
    it("passes for valid license", () => {
      expect(validateLicense({ license: "LGPL-3" })).toHaveLength(0);
    });

    it("errors for missing license", () => {
      const issues = validateLicense({});
      expect(issues[0].rule).toBe("license-required");
      expect(issues[0].severity).toBe("error");
    });

    it("errors for invalid license", () => {
      const issues = validateLicense({ license: "MIT" });
      expect(issues[0].rule).toBe("license-valid");
    });

    it("accepts all valid licenses", () => {
      for (const lic of VALID_LICENSES) {
        expect(validateLicense({ license: lic })).toHaveLength(0);
      }
    });
  });

  describe("validateVersion", () => {
    it("passes for 5-segment version", () => {
      expect(validateVersion({ version: "17.0.1.0.0" })).toHaveLength(0);
    });

    it("errors for missing version", () => {
      expect(validateVersion({})[0].rule).toBe("version-required");
    });

    it("errors for semver format", () => {
      const issues = validateVersion({ version: "1.0.0" });
      expect(issues[0].rule).toBe("version-format");
    });

    it("errors for 4-segment version", () => {
      expect(validateVersion({ version: "17.0.1.0" })).toHaveLength(1);
    });
  });

  describe("validateMetadata", () => {
    it("passes for complete metadata", () => {
      expect(validateMetadata(validManifest)).toHaveLength(0);
    });

    it("errors for missing name", () => {
      const issues = validateMetadata({ ...validManifest, name: undefined });
      expect(issues.some((i) => i.rule === "name-required")).toBe(true);
    });

    it("errors for missing author", () => {
      const issues = validateMetadata({ ...validManifest, author: undefined });
      expect(issues.some((i) => i.rule === "author-required")).toBe(true);
    });

    it("warns for missing summary", () => {
      const issues = validateMetadata({ ...validManifest, summary: undefined });
      expect(issues.some((i) => i.rule === "summary-required" && i.severity === "warning")).toBe(true);
    });

    it("warns for long summary", () => {
      const issues = validateMetadata({ ...validManifest, summary: "x".repeat(200) });
      expect(issues.some((i) => i.rule === "summary-length")).toBe(true);
    });

    it("warns for invalid category", () => {
      const issues = validateMetadata({ ...validManifest, category: "Invalid" });
      expect(issues.some((i) => i.rule === "category-valid")).toBe(true);
    });

    it("info for missing website", () => {
      const issues = validateMetadata({ ...validManifest, website: undefined });
      expect(issues.some((i) => i.severity === "info")).toBe(true);
    });

    it("errors for installable=false", () => {
      const issues = validateMetadata({ ...validManifest, installable: false });
      expect(issues.some((i) => i.rule === "installable-true")).toBe(true);
    });
  });

  describe("validateDependencies", () => {
    it("passes for valid depends", () => {
      expect(validateDependencies({ depends: ["website"] })).toHaveLength(0);
    });

    it("errors for empty depends", () => {
      expect(validateDependencies({ depends: [] })[0].rule).toBe("depends-required");
    });

    it("errors for missing depends", () => {
      expect(validateDependencies({})[0].rule).toBe("depends-required");
    });

    it("warns for forbidden dependency", () => {
      const issues = validateDependencies({ depends: ["website", "base_setup"] });
      expect(issues.some((i) => i.rule === "depends-forbidden")).toBe(true);
    });
  });

  describe("validateIcon", () => {
    it("passes for valid icon", () => {
      expect(validateIcon({ ...validAssets })).toHaveLength(0);
    });

    it("errors for missing icon", () => {
      expect(validateIcon({ ...validAssets, hasIcon: false })[0].rule).toBe("icon-required");
    });

    it("errors for small icon", () => {
      const issues = validateIcon({ ...validAssets, iconSize: [50, 50] });
      expect(issues[0].rule).toBe("icon-size");
    });
  });

  describe("validateScreenshots", () => {
    it("passes for enough screenshots", () => {
      expect(validateScreenshots({ ...validAssets, screenshotCount: 3 })).toHaveLength(0);
    });

    it("errors for too few screenshots", () => {
      const issues = validateScreenshots({ ...validAssets, screenshotCount: 2 });
      expect(issues[0].rule).toBe("screenshots-minimum");
    });
  });

  describe("validateDescription", () => {
    it("passes for adequate description", () => {
      expect(validateDescription(validAssets)).toHaveLength(0);
    });

    it("errors for missing description", () => {
      expect(validateDescription({ ...validAssets, hasDescription: false })[0].rule).toBe("description-required");
    });

    it("errors for short description", () => {
      const issues = validateDescription({ ...validAssets, descriptionLength: 50 });
      expect(issues[0].rule).toBe("description-length");
    });
  });

  describe("validatePricing", () => {
    it("passes for free module", () => {
      expect(validatePricing({})).toHaveLength(0);
    });

    it("errors for price without currency", () => {
      const issues = validatePricing({ price: 99 });
      expect(issues[0].rule).toBe("currency-required");
    });

    it("warns for non-EUR currency", () => {
      const issues = validatePricing({ price: 99, currency: "USD" });
      expect(issues[0].rule).toBe("currency-eur");
      expect(issues[0].severity).toBe("warning");
    });

    it("passes for EUR pricing", () => {
      expect(validatePricing({ price: 99, currency: "EUR" })).toHaveLength(0);
    });
  });

  describe("validateSubmission", () => {
    it("returns valid for complete submission", () => {
      const result = validateSubmission(validManifest, validAssets);
      expect(result.valid).toBe(true);
      expect(result.errorCount).toBe(0);
      expect(result.passed.length).toBeGreaterThan(0);
    });

    it("returns invalid when errors present", () => {
      const result = validateSubmission({}, { ...validAssets, hasIcon: false });
      expect(result.valid).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
    });

    it("counts warnings separately", () => {
      const manifest = { ...validManifest, summary: undefined, category: undefined };
      const result = validateSubmission(manifest, validAssets);
      expect(result.warningCount).toBeGreaterThan(0);
    });

    it("tracks passed checks", () => {
      const result = validateSubmission(validManifest, validAssets);
      expect(result.passed).toContain("license");
      expect(result.passed).toContain("version");
      expect(result.passed).toContain("icon");
    });

    it("issueCount equals errors + warnings + info", () => {
      const result = validateSubmission(validManifest, validAssets);
      expect(result.issueCount).toBe(result.issues.length);
    });
  });

  describe("VALID_CATEGORIES", () => {
    it("includes Website", () => {
      expect(VALID_CATEGORIES).toContain("Website");
    });

    it("has at least 10 categories", () => {
      expect(VALID_CATEGORIES.length).toBeGreaterThanOrEqual(10);
    });
  });
});
