import { describe, it, expect } from "vitest";
import {
  validateAssetBundles,
  validateManifest,
  VALID_ASSET_BUNDLES,
  PREPEND_ONLY_BUNDLES,
} from "@/lib/odoo-skills/validator";

// =============================================================================
// Constants
// =============================================================================

describe("VALID_ASSET_BUNDLES", () => {
  it("includes the three core theme bundles", () => {
    expect(VALID_ASSET_BUNDLES).toContain("web.assets_frontend");
    expect(VALID_ASSET_BUNDLES).toContain("web._assets_primary_variables");
    expect(VALID_ASSET_BUNDLES).toContain("web._assets_frontend_helpers");
  });
});

describe("PREPEND_ONLY_BUNDLES", () => {
  it("includes primary_variables and frontend_helpers", () => {
    expect(PREPEND_ONLY_BUNDLES).toContain("web._assets_primary_variables");
    expect(PREPEND_ONLY_BUNDLES).toContain("web._assets_frontend_helpers");
  });

  it("does NOT include web.assets_frontend", () => {
    expect(PREPEND_ONLY_BUNDLES).not.toContain("web.assets_frontend");
  });
});

// =============================================================================
// validateAssetBundles
// =============================================================================

const FILE = "__manifest__.py";

function makeManifest(assetsBlock: string): string {
  return `{
    'name': 'Theme Test',
    'version': '18.0.1.0.0',
    'category': 'Website/Theme',
    'depends': ['website'],
    'license': 'LGPL-3',
    'assets': {
${assetsBlock}
    },
}`;
}

describe("validateAssetBundles", () => {
  it("passes for valid bundle names", () => {
    const manifest = makeManifest(`
        'web.assets_frontend': [
            'theme_test/static/src/scss/theme.scss',
        ],
        'web._assets_primary_variables': [
            ('prepend', 'theme_test/static/src/scss/primary_variables.scss'),
        ],
    `);
    const issues = validateAssetBundles(manifest, FILE);
    expect(issues).toHaveLength(0);
  });

  it("warns on unknown bundle names (typos)", () => {
    const manifest = makeManifest(`
        'web.assets_fronted': [
            'theme_test/static/src/scss/theme.scss',
        ],
    `);
    const issues = validateAssetBundles(manifest, FILE);
    expect(issues.length).toBeGreaterThan(0);
    const typoIssue = issues.find(i => i.message.includes("web.assets_fronted"));
    expect(typoIssue).toBeDefined();
    expect(typoIssue!.code).toBe("MANIFEST007");
    expect(typoIssue!.severity).toBe("warning");
  });

  it("errors when prepend-only bundle uses plain string format", () => {
    const manifest = makeManifest(`
        'web._assets_primary_variables': [
            'theme_test/static/src/scss/primary_variables.scss',
        ],
    `);
    const issues = validateAssetBundles(manifest, FILE);
    const prependIssue = issues.find(i => i.code === "MANIFEST008");
    expect(prependIssue).toBeDefined();
    expect(prependIssue!.severity).toBe("error");
    expect(prependIssue!.message).toContain("prepend");
  });

  it("passes when prepend-only bundle uses tuple format", () => {
    const manifest = makeManifest(`
        'web._assets_primary_variables': [
            ('prepend', 'theme_test/static/src/scss/primary_variables.scss'),
        ],
    `);
    const issues = validateAssetBundles(manifest, FILE);
    const prependIssues = issues.filter(i => i.code === "MANIFEST008");
    expect(prependIssues).toHaveLength(0);
  });

  it("returns empty array when no assets block present", () => {
    const manifest = `{
    'name': 'Theme Test',
    'version': '18.0.1.0.0',
}`;
    const issues = validateAssetBundles(manifest, FILE);
    expect(issues).toHaveLength(0);
  });

  it("detects multiple typos in one manifest", () => {
    const manifest = makeManifest(`
        'web.assets_fronted': [
            'theme_test/static/src/scss/theme.scss',
        ],
        'web.asset_frontend_helpers': [
            ('prepend', 'theme_test/static/src/scss/helpers.scss'),
        ],
    `);
    const issues = validateAssetBundles(manifest, FILE);
    const warnings = issues.filter(i => i.code === "MANIFEST007");
    expect(warnings.length).toBe(2);
  });
});

// =============================================================================
// Integration: validateManifest calls validateAssetBundles
// =============================================================================

describe("validateManifest integration with asset bundles", () => {
  it("reports asset bundle issues through validateManifest", () => {
    const manifest = makeManifest(`
        'web.assets_fronted': [
            'theme_test/static/src/scss/theme.scss',
        ],
    `);
    const issues = validateManifest(manifest, FILE);
    const bundleIssue = issues.find(i => i.code === "MANIFEST007");
    expect(bundleIssue).toBeDefined();
  });

  it("reports no bundle issues for correct manifests", () => {
    const manifest = makeManifest(`
        'web.assets_frontend': [
            'theme_test/static/src/scss/theme.scss',
        ],
        'web._assets_primary_variables': [
            ('prepend', 'theme_test/static/src/scss/primary_variables.scss'),
        ],
    `);
    const issues = validateManifest(manifest, FILE);
    const bundleIssues = issues.filter(i => i.code === "MANIFEST007" || i.code === "MANIFEST008");
    expect(bundleIssues).toHaveLength(0);
  });
});
