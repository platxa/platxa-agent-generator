import { describe, it, expect } from "vitest";
import {
  validateAssetBundles,
  validateManifest,
  extractDictBlock,
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

// =============================================================================
// extractDictBlock (Fix 5)
// =============================================================================

describe("extractDictBlock", () => {
  it("extracts assets block with 4-space indent", () => {
    const content = `{
    'assets': {
        'web.assets_frontend': [
            'theme_test/static/src/scss/theme.scss',
        ],
    },
}`;
    const result = extractDictBlock(content, "assets");
    expect(result).not.toBeNull();
    expect(result).toContain("web.assets_frontend");
    expect(result).toContain("theme.scss");
  });

  it("extracts assets block with 2-space indent", () => {
    const content = `{
  'assets': {
    'web.assets_frontend': [
      'theme/static/src/scss/theme.scss',
    ],
  },
}`;
    const result = extractDictBlock(content, "assets");
    expect(result).not.toBeNull();
    expect(result).toContain("web.assets_frontend");
  });

  it("extracts assets block with tab indent", () => {
    const content = `{
\t'assets': {
\t\t'web.assets_frontend': [
\t\t\t'theme/static/src/scss/theme.scss',
\t\t],
\t},
}`;
    const result = extractDictBlock(content, "assets");
    expect(result).not.toBeNull();
    expect(result).toContain("web.assets_frontend");
  });

  it("extracts assets block with 8-space indent", () => {
    const content = `{
        'assets': {
                'web.assets_frontend': [
                        'theme/static/src/scss/theme.scss',
                ],
        },
}`;
    const result = extractDictBlock(content, "assets");
    expect(result).not.toBeNull();
    expect(result).toContain("web.assets_frontend");
  });

  it("extracts minified assets block", () => {
    const content = `{'assets':{'web.assets_frontend':['theme/static/theme.scss']}}`;
    const result = extractDictBlock(content, "assets");
    expect(result).not.toBeNull();
    expect(result).toContain("web.assets_frontend");
  });

  it("handles mixed indentation styles", () => {
    const content = `{
  'assets': {
      'web.assets_frontend': [
            'theme/static/src/scss/theme.scss',
      ],
  },
}`;
    const result = extractDictBlock(content, "assets");
    expect(result).not.toBeNull();
    expect(result).toContain("web.assets_frontend");
  });

  it("returns null for unbalanced braces (unclosed inner dict)", () => {
    // The assets block has an inner { that is never closed — depth never returns to 0
    const content = `{
    'assets': {
        'web.assets_frontend': {
            'theme.scss',
`;
    const result = extractDictBlock(content, "assets");
    expect(result).toBeNull();
  });

  it("returns null when key is missing", () => {
    const content = `{
    'data': ['views/templates.xml'],
}`;
    const result = extractDictBlock(content, "assets");
    expect(result).toBeNull();
  });

  it("skips braces inside string literals", () => {
    const content = `{
    'assets': {
        'web.assets_frontend': [
            'theme/static/src/scss/{theme}.scss',
        ],
    },
}`;
    const result = extractDictBlock(content, "assets");
    expect(result).not.toBeNull();
    expect(result).toContain("{theme}");
  });

  it("handles triple-quoted strings with braces", () => {
    const content = `{
    'description': '''This theme uses {curly} braces in docs''',
    'assets': {
        'web.assets_frontend': ['theme.scss'],
    },
}`;
    const result = extractDictBlock(content, "assets");
    expect(result).not.toBeNull();
    expect(result).toContain("web.assets_frontend");
  });

  it("extracts nested dict correctly stopping at matching brace", () => {
    const content = `{
    'assets': {
        'web._assets_primary_variables': [
            ('prepend', 'primary_variables.scss'),
        ],
        'web.assets_frontend': [
            'theme.scss',
        ],
    },
    'data': ['views/templates.xml'],
}`;
    const result = extractDictBlock(content, "assets");
    expect(result).not.toBeNull();
    expect(result).toContain("web._assets_primary_variables");
    expect(result).toContain("web.assets_frontend");
    // Should NOT contain the 'data' key — that's outside the assets block
    expect(result).not.toContain("'data'");
  });
});

// =============================================================================
// validateAssetBundles with different indentation (Fix 5 integration)
// =============================================================================

describe("validateAssetBundles with varied indentation (Fix 5)", () => {
  it("validates 2-space indented manifests", () => {
    const manifest = `{
  'name': 'Theme Test',
  'version': '18.0.1.0.0',
  'category': 'Website/Theme',
  'depends': ['website'],
  'license': 'LGPL-3',
  'assets': {
    'web.assets_frontend': [
      'theme_test/static/src/scss/theme.scss',
    ],
  },
}`;
    const issues = validateAssetBundles(manifest, FILE);
    // Should find the bundle and not error — previously would return [] (no match)
    const unknownBundleIssues = issues.filter(i => i.code === "MANIFEST007");
    expect(unknownBundleIssues).toHaveLength(0);
  });

  it("validates tab-indented manifests", () => {
    const manifest = `{
\t'name': 'Theme Test',
\t'assets': {
\t\t'web.assets_fronted': [
\t\t\t'theme_test/static/src/scss/theme.scss',
\t\t],
\t},
}`;
    const issues = validateAssetBundles(manifest, FILE);
    // Should detect the typo even with tabs
    const typoIssue = issues.find(i => i.message.includes("web.assets_fronted"));
    expect(typoIssue).toBeDefined();
  });
});
