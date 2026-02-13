/**
 * Parser Odoo 18 Compatibility Tests
 *
 * Validates the critical Odoo 18 asset-bundle-aware behavior in:
 * - SCSS file consolidation (preserving primary_variables.scss and bootstrap_overridden.scss)
 * - Manifest generation (correct asset bundle routing and category)
 * - Industry auto-detection from user messages
 *
 * These behaviors prevent Odoo 18 installation failures caused by SCSS files
 * being placed in the wrong asset bundle.
 */

import { describe, it, expect } from "vitest";
import {
  consolidateExportFiles,
  generateManifest,
  extractManifestFields,
  ensureRequiredFiles,
  getBasename,
  type ParsedFile,
} from "../lib/ai/parser";

// ---------------------------------------------------------------------------
// Helpers to build ParsedFile fixtures
// ---------------------------------------------------------------------------

function makeScssFile(
  filename: string,
  content: string = `/* ${filename} */\nbody { color: red; }`,
  dir: string = "theme_generated/static/src/scss"
): ParsedFile {
  return {
    path: `${dir}/${filename}`,
    content,
    language: "scss",
    action: "create",
  };
}

function makeXmlFile(
  filename: string,
  content: string,
  dir: string = "theme_generated/views"
): ParsedFile {
  return {
    path: `${dir}/${filename}`,
    content,
    language: "xml",
    action: "create",
  };
}

// ---------------------------------------------------------------------------
// consolidateExportFiles -- SCSS consolidation
// ---------------------------------------------------------------------------

describe("consolidateExportFiles", () => {
  describe("Odoo 18 SCSS file preservation", () => {
    it("preserves primary_variables.scss as a separate file", () => {
      const files: ParsedFile[] = [
        makeScssFile("primary_variables.scss", "$o-color-1: #6c757d;"),
        makeScssFile("theme.scss", "body { font-family: sans-serif; }"),
      ];

      const result = consolidateExportFiles(files);
      const primaryVars = result.find((f) =>
        f.path.includes("primary_variables.scss")
      );

      expect(primaryVars).toBeDefined();
      expect(primaryVars!.path).toContain("primary_variables.scss");
      expect(primaryVars!.content).toContain("$o-color-1");
    });

    it("preserves bootstrap_overridden.scss as a separate file", () => {
      const files: ParsedFile[] = [
        makeScssFile(
          "bootstrap_overridden.scss",
          "$btn-border-radius: 0.5rem;"
        ),
        makeScssFile("theme.scss", "body { font-family: sans-serif; }"),
      ];

      const result = consolidateExportFiles(files);
      const bootstrapOverrides = result.find((f) =>
        f.path.includes("bootstrap_overridden.scss")
      );

      expect(bootstrapOverrides).toBeDefined();
      expect(bootstrapOverrides!.path).toContain("bootstrap_overridden.scss");
      expect(bootstrapOverrides!.content).toContain("$btn-border-radius");
    });

    it("does not merge primary_variables.scss into theme.scss when consolidating", () => {
      const files: ParsedFile[] = [
        makeScssFile("primary_variables.scss", "$o-color-1: #6c757d;"),
        makeScssFile("style.scss", ".header { padding: 10px; }"),
        makeScssFile("custom.scss", ".footer { margin: 20px; }"),
      ];

      const result = consolidateExportFiles(files);

      // primary_variables.scss must remain separate
      const primaryVars = result.find((f) =>
        f.path.includes("primary_variables.scss")
      );
      expect(primaryVars).toBeDefined();

      // The two generic SCSS files should be consolidated into theme.scss
      const themeScss = result.find(
        (f) => f.path.includes("theme.scss") && !f.path.includes("primary_")
      );
      expect(themeScss).toBeDefined();

      // theme.scss must NOT contain primary_variables content
      expect(themeScss!.content).not.toContain("$o-color-1");
    });

    it("does not merge bootstrap_overridden.scss into theme.scss when consolidating", () => {
      const files: ParsedFile[] = [
        makeScssFile(
          "bootstrap_overridden.scss",
          "$btn-border-radius: 0.5rem;"
        ),
        makeScssFile("style.scss", ".header { padding: 10px; }"),
        makeScssFile("custom.scss", ".footer { margin: 20px; }"),
      ];

      const result = consolidateExportFiles(files);

      const bootstrapOverrides = result.find((f) =>
        f.path.includes("bootstrap_overridden.scss")
      );
      expect(bootstrapOverrides).toBeDefined();

      const themeScss = result.find(
        (f) =>
          f.path.includes("theme.scss") && !f.path.includes("bootstrap_")
      );
      expect(themeScss).toBeDefined();

      // theme.scss must NOT contain bootstrap_overridden content
      expect(themeScss!.content).not.toContain("$btn-border-radius");
    });

    it("preserves both Odoo SCSS files when all three categories are present", () => {
      const files: ParsedFile[] = [
        makeScssFile("primary_variables.scss", "$o-color-1: #ff5722;"),
        makeScssFile(
          "bootstrap_overridden.scss",
          "$btn-border-radius: 0.25rem;"
        ),
        makeScssFile("style.scss", ".hero { background: #fff; }"),
        makeScssFile("animations.scss", "@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }"),
      ];

      const result = consolidateExportFiles(files);

      const scssFiles = result.filter(
        (f) => f.path.endsWith(".scss") || f.path.endsWith(".css")
      );

      // Should have exactly 3 SCSS outputs:
      //   primary_variables.scss, bootstrap_overridden.scss, theme.scss (merged from style + animations)
      expect(scssFiles).toHaveLength(3);

      const filenames = scssFiles.map(
        (f) => f.path.split("/").pop() as string
      );
      expect(filenames).toContain("primary_variables.scss");
      expect(filenames).toContain("bootstrap_overridden.scss");
      expect(filenames).toContain("theme.scss");
    });
  });

  describe("generic SCSS consolidation", () => {
    it("consolidates multiple generic SCSS files into theme.scss", () => {
      const files: ParsedFile[] = [
        makeScssFile("style.scss", ".header { padding: 10px; }"),
        makeScssFile("custom.scss", ".footer { margin: 20px; }"),
      ];

      const result = consolidateExportFiles(files);

      const scssFiles = result.filter(
        (f) => f.path.endsWith(".scss") || f.path.endsWith(".css")
      );

      // Two generic files should become one theme.scss
      expect(scssFiles).toHaveLength(1);
      expect(scssFiles[0].path).toContain("theme.scss");
      expect(scssFiles[0].content).toContain(".header");
      expect(scssFiles[0].content).toContain(".footer");
    });

    it("normalizes a single generic SCSS file name to theme.scss", () => {
      const files: ParsedFile[] = [
        makeScssFile(
          "la_bella_cucina.scss",
          ".restaurant { background: #f5f5dc; }"
        ),
      ];

      const result = consolidateExportFiles(files);

      const scssFiles = result.filter(
        (f) => f.path.endsWith(".scss") || f.path.endsWith(".css")
      );

      expect(scssFiles).toHaveLength(1);
      expect(scssFiles[0].path).toContain("theme.scss");
      expect(scssFiles[0].content).toContain(".restaurant");
    });

    it("passes through a single theme.scss without renaming", () => {
      const files: ParsedFile[] = [
        makeScssFile("theme.scss", ".site { max-width: 1200px; }"),
      ];

      const result = consolidateExportFiles(files);

      const scssFiles = result.filter(
        (f) => f.path.endsWith(".scss") || f.path.endsWith(".css")
      );

      expect(scssFiles).toHaveLength(1);
      expect(scssFiles[0].path).toContain("theme.scss");
    });
  });

  describe("non-SCSS file handling", () => {
    it("preserves non-SCSS files unchanged", () => {
      const pyFile: ParsedFile = {
        path: "theme_generated/__manifest__.py",
        content: "{}",
        language: "python",
        action: "create",
      };

      const files: ParsedFile[] = [
        pyFile,
        makeScssFile("theme.scss", "body {}"),
      ];

      const result = consolidateExportFiles(files);
      const resultPy = result.find((f) => f.path.endsWith(".py"));

      expect(resultPy).toBeDefined();
      expect(resultPy!.content).toBe("{}");
    });

    it("consolidates multiple XML view files into templates.xml", () => {
      const files: ParsedFile[] = [
        makeXmlFile(
          "pages.xml",
          `<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <template id="page_home" name="Home Page">
    <div>Home</div>
  </template>
</odoo>`
        ),
        makeXmlFile(
          "snippets.xml",
          `<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <template id="snippet_hero" name="Hero">
    <section>Hero</section>
  </template>
</odoo>`
        ),
      ];

      const result = consolidateExportFiles(files);
      const xmlFiles = result.filter((f) => f.path.endsWith(".xml"));

      expect(xmlFiles).toHaveLength(1);
      expect(xmlFiles[0].path).toContain("templates.xml");
      expect(xmlFiles[0].content).toContain("page_home");
      expect(xmlFiles[0].content).toContain("snippet_hero");
    });
  });
});

// ---------------------------------------------------------------------------
// generateManifest -- Odoo 18 manifest generation
// ---------------------------------------------------------------------------

describe("generateManifest", () => {
  describe("category", () => {
    it("uses 'Website/Theme' as the module category", () => {
      const files: ParsedFile[] = [];
      const manifest = generateManifest("My Theme", files);

      expect(manifest).toContain("'category': 'Website/Theme'");
    });

    it("does not use the old 'Theme/Creative' category", () => {
      const files: ParsedFile[] = [];
      const manifest = generateManifest("My Theme", files);

      expect(manifest).not.toContain("Theme/Creative");
    });
  });

  describe("Odoo 18 asset bundle routing", () => {
    const themeFiles: ParsedFile[] = [
      makeScssFile("primary_variables.scss", "$o-color-1: #6c757d;"),
      makeScssFile("bootstrap_overridden.scss", "$btn-border-radius: 0.5rem;"),
      makeScssFile("theme.scss", "body { font-family: sans-serif; }"),
    ];

    it("routes primary_variables.scss to web._assets_primary_variables bundle", () => {
      const manifest = generateManifest("Test Theme", themeFiles);

      expect(manifest).toContain("web._assets_primary_variables");
      expect(manifest).toContain("primary_variables.scss");
    });

    it("routes bootstrap_overridden.scss to web._assets_frontend_helpers bundle", () => {
      const manifest = generateManifest("Test Theme", themeFiles);

      expect(manifest).toContain("web._assets_frontend_helpers");
      expect(manifest).toContain("bootstrap_overridden.scss");
    });

    it("routes generic SCSS files to web.assets_frontend bundle", () => {
      const manifest = generateManifest("Test Theme", themeFiles);

      expect(manifest).toContain("web.assets_frontend");
      // theme.scss goes to assets_frontend, not to the special bundles
      expect(manifest).toMatch(
        /web\.assets_frontend[\s\S]*?theme\.scss/
      );
    });

    it("uses ('prepend', ...) tuple for primary_variables.scss", () => {
      const manifest = generateManifest("Test Theme", themeFiles);

      // Match the ('prepend', '...primary_variables.scss') tuple pattern
      expect(manifest).toMatch(
        /\('prepend',\s*'[^']*primary_variables\.scss'\)/
      );
    });

    it("uses ('prepend', ...) tuple for bootstrap_overridden.scss", () => {
      const manifest = generateManifest("Test Theme", themeFiles);

      expect(manifest).toMatch(
        /\('prepend',\s*'[^']*bootstrap_overridden\.scss'\)/
      );
    });

    it("does not use ('prepend', ...) for generic SCSS like theme.scss", () => {
      const manifest = generateManifest("Test Theme", themeFiles);

      // theme.scss should appear as a plain string path, not in a prepend tuple
      expect(manifest).not.toMatch(
        /\('prepend',\s*'[^']*theme\.scss'\)/
      );
    });
  });

  describe("asset path prefixing", () => {
    it("prefixes asset paths with the module name", () => {
      const files: ParsedFile[] = [
        makeScssFile("theme.scss", "body {}"),
      ];

      const manifest = generateManifest(
        "Test Theme",
        files,
        "theme_restaurant"
      );

      expect(manifest).toContain("theme_restaurant/static/src/scss/theme.scss");
    });

    it("defaults module name to theme_generated", () => {
      const files: ParsedFile[] = [
        makeScssFile("theme.scss", "body {}"),
      ];

      const manifest = generateManifest("Test Theme", files);

      expect(manifest).toContain("theme_generated/static/src/scss/theme.scss");
    });

    it("strips theme_generated prefix from file paths before re-prefixing with moduleName", () => {
      const files: ParsedFile[] = [
        {
          path: "theme_generated/static/src/scss/theme.scss",
          content: "body {}",
          language: "scss",
          action: "create",
        },
      ];

      const manifest = generateManifest(
        "Test Theme",
        files,
        "theme_custom"
      );

      // Should contain theme_custom/static/... not theme_generated/theme_custom/static/...
      expect(manifest).toContain("theme_custom/static/src/scss/theme.scss");
      expect(manifest).not.toContain("theme_generated/theme_custom");
    });
  });

  describe("XML data files", () => {
    it("includes XML files in the 'data' section", () => {
      const files: ParsedFile[] = [
        makeXmlFile("templates.xml", "<odoo></odoo>"),
      ];

      const manifest = generateManifest("Test Theme", files);

      expect(manifest).toContain("'data':");
      expect(manifest).toContain("views/templates.xml");
    });

    it("deduplicates identical XML paths", () => {
      const files: ParsedFile[] = [
        makeXmlFile("templates.xml", "<odoo></odoo>"),
        makeXmlFile("templates.xml", "<odoo></odoo>"),
      ];

      const manifest = generateManifest("Test Theme", files);

      // Count occurrences of the path -- should appear exactly once
      const matches = manifest.match(/views\/templates\.xml/g);
      expect(matches).toHaveLength(1);
    });
  });

  describe("JS files", () => {
    it("routes JS files to web.assets_frontend bundle", () => {
      const files: ParsedFile[] = [
        {
          path: "theme_generated/static/src/js/theme.js",
          content: "console.log('hello');",
          language: "javascript",
          action: "create",
        },
      ];

      const manifest = generateManifest("Test Theme", files);

      expect(manifest).toContain("web.assets_frontend");
      expect(manifest).toContain("theme_generated/static/src/js/theme.js");
    });
  });

  describe("manifest metadata", () => {
    it("includes the theme name", () => {
      const manifest = generateManifest("Bella Cucina", []);

      expect(manifest).toContain("'name': 'Bella Cucina'");
    });

    it("specifies Odoo 18 version", () => {
      const manifest = generateManifest("Test", []);

      expect(manifest).toContain("'version': '18.0.1.0.0'");
    });

    it("depends on website module", () => {
      const manifest = generateManifest("Test", []);

      expect(manifest).toContain("'depends': ['website']");
    });

    it("is marked installable but not auto_install", () => {
      const manifest = generateManifest("Test", []);

      expect(manifest).toContain("'installable': True");
      expect(manifest).toContain("'auto_install': False");
    });
  });

  describe("complete manifest with all Odoo 18 bundles", () => {
    it("produces a manifest with three separate asset bundles when all SCSS types present", () => {
      const files: ParsedFile[] = [
        makeScssFile("primary_variables.scss", "$o-color-1: #ff5722;"),
        makeScssFile(
          "bootstrap_overridden.scss",
          "$btn-border-radius: 0.25rem;"
        ),
        makeScssFile("theme.scss", "body { font-family: sans-serif; }"),
        {
          path: "theme_generated/static/src/js/theme.js",
          content: "console.log('init');",
          language: "javascript",
          action: "create",
        },
        makeXmlFile("templates.xml", "<odoo></odoo>"),
      ];

      const manifest = generateManifest(
        "Restaurant Theme",
        files,
        "theme_restaurant"
      );

      // All three bundles must be present
      expect(manifest).toContain("web._assets_primary_variables");
      expect(manifest).toContain("web._assets_frontend_helpers");
      expect(manifest).toContain("web.assets_frontend");

      // Prepend tuples for the special SCSS files
      expect(manifest).toContain(
        "('prepend', 'theme_restaurant/static/src/scss/primary_variables.scss')"
      );
      expect(manifest).toContain(
        "('prepend', 'theme_restaurant/static/src/scss/bootstrap_overridden.scss')"
      );

      // Generic assets in frontend bundle as plain paths
      expect(manifest).toContain(
        "'theme_restaurant/static/src/scss/theme.scss'"
      );
      expect(manifest).toContain(
        "'theme_restaurant/static/src/js/theme.js'"
      );

      // Metadata
      expect(manifest).toContain("'category': 'Website/Theme'");
      expect(manifest).toContain("'name': 'Restaurant Theme'");
    });
  });
});

// ---------------------------------------------------------------------------
// detectIndustryFromMessage -- industry auto-detection
//
// This function is private within the route module, so we replicate its logic
// here to validate the expected keyword-to-industry mapping contract.
// If the implementation changes, this test serves as a specification anchor.
// ---------------------------------------------------------------------------

describe("detectIndustryFromMessage (specification test)", () => {
  // Replicate the detection logic identically from app/api/chat/route.ts
  function detectIndustryFromMessage(message: string): string | undefined {
    if (!message) return undefined;
    const lower = message.toLowerCase();

    const industryKeywords: Record<string, string[]> = {
      restaurant: [
        "restaurant",
        "cafe",
        "bistro",
        "pizzeria",
        "food",
        "dining",
        "kitchen",
        "bakery",
        "catering",
      ],
      technology: [
        "tech",
        "saas",
        "software",
        "startup",
        "app",
        "digital",
        "ai",
        "cloud",
      ],
      legal: ["law firm", "lawyer", "attorney", "legal", "law office"],
      healthcare: [
        "hospital",
        "clinic",
        "medical",
        "healthcare",
        "doctor",
        "dental",
        "pharmacy",
      ],
      ecommerce: [
        "e-commerce",
        "ecommerce",
        "online store",
        "shop",
        "retail",
        "marketplace",
      ],
    };

    for (const [industry, keywords] of Object.entries(industryKeywords)) {
      if (keywords.some((kw) => lower.includes(kw))) {
        return industry;
      }
    }
    return undefined;
  }

  it("detects restaurant industry from 'restaurant' keyword", () => {
    expect(
      detectIndustryFromMessage("Build a restaurant website for La Bella")
    ).toBe("restaurant");
  });

  it("detects restaurant industry from 'cafe' keyword", () => {
    expect(
      detectIndustryFromMessage("I need a website for my cafe")
    ).toBe("restaurant");
  });

  it("detects restaurant industry from 'bakery' keyword", () => {
    expect(
      detectIndustryFromMessage("Create a modern bakery website")
    ).toBe("restaurant");
  });

  it("detects technology industry from 'saas' keyword", () => {
    expect(
      detectIndustryFromMessage("Design a SaaS landing page")
    ).toBe("technology");
  });

  it("detects technology industry from 'startup' keyword", () => {
    expect(
      detectIndustryFromMessage("Build a startup website")
    ).toBe("technology");
  });

  it("detects legal industry from 'law firm' keyword", () => {
    expect(
      detectIndustryFromMessage("I need a professional law firm site")
    ).toBe("legal");
  });

  it("detects healthcare industry from 'clinic' keyword", () => {
    expect(
      detectIndustryFromMessage("Create a website for a dental clinic")
    ).toBe("healthcare");
  });

  it("detects ecommerce industry from 'online store' keyword", () => {
    expect(
      detectIndustryFromMessage("I want to build an online store")
    ).toBe("ecommerce");
  });

  it("returns undefined when no industry keywords match", () => {
    expect(
      detectIndustryFromMessage("Make me a beautiful website")
    ).toBeUndefined();
  });

  it("returns undefined for empty message", () => {
    expect(detectIndustryFromMessage("")).toBeUndefined();
  });

  it("is case-insensitive", () => {
    expect(
      detectIndustryFromMessage("Build a RESTAURANT website")
    ).toBe("restaurant");
  });
});

// ---------------------------------------------------------------------------
// extractManifestFields -- AI manifest field extraction
// ---------------------------------------------------------------------------

describe("extractManifestFields", () => {
  const sampleManifest = `# -*- coding: utf-8 -*-
{
    'name': 'Theme Oceanview',
    'version': '18.0.1.0.0',
    'category': 'Theme/Creative',
    'summary': 'A modern ocean-inspired theme',
    'description': '''
        Stunning ocean-inspired theme with wave animations
        and aquatic color palettes.
    ''',
    'author': 'Custom Studio',
    'website': 'https://example.com',
    'license': 'LGPL-3',
    'depends': ['website', 'website_blog'],
    'data': [],
}`;

  it("extracts summary from AI manifest", () => {
    const fields = extractManifestFields(sampleManifest);
    expect(fields.summary).toBe("A modern ocean-inspired theme");
  });

  it("extracts description from AI manifest", () => {
    const fields = extractManifestFields(sampleManifest);
    expect(fields.description).toContain("ocean-inspired theme");
    expect(fields.description).toContain("aquatic color palettes");
  });

  it("extracts author from AI manifest", () => {
    const fields = extractManifestFields(sampleManifest);
    expect(fields.author).toBe("Custom Studio");
  });

  it("extracts website from AI manifest", () => {
    const fields = extractManifestFields(sampleManifest);
    expect(fields.website).toBe("https://example.com");
  });

  it("extracts extra depends beyond website", () => {
    const fields = extractManifestFields(sampleManifest);
    expect(fields.extraDepends).toEqual(["website_blog"]);
  });

  it("returns empty overrides for minimal manifest", () => {
    const minimal = `{ 'name': 'Theme Test', 'depends': ['website'] }`;
    const fields = extractManifestFields(minimal);
    expect(fields.extraDepends).toBeUndefined();
    expect(fields.description).toBeUndefined();
  });

  it("does not extract category (always regenerated)", () => {
    const fields = extractManifestFields(sampleManifest);
    expect(fields).not.toHaveProperty("category");
  });
});

// ---------------------------------------------------------------------------
// generateManifest -- merge overrides
// ---------------------------------------------------------------------------

describe("generateManifest with overrides", () => {
  const baseFiles: ParsedFile[] = [
    makeXmlFile("layout.xml", "<odoo><template id='layout'>test</template></odoo>"),
    makeScssFile("theme.scss", "body { color: red; }"),
  ];

  it("uses default values when no overrides provided", () => {
    const manifest = generateManifest("Test Theme", baseFiles, "theme_test");
    expect(manifest).toContain("'summary': 'AI-generated Odoo website theme'");
    expect(manifest).toContain("'author': 'Platxa Studio'");
    expect(manifest).toContain("'depends': ['website']");
  });

  it("merges AI summary into generated manifest", () => {
    const manifest = generateManifest("Test Theme", baseFiles, "theme_test", {
      summary: "Beautiful restaurant theme",
    });
    expect(manifest).toContain("'summary': 'Beautiful restaurant theme'");
  });

  it("merges AI author and website", () => {
    const manifest = generateManifest("Test Theme", baseFiles, "theme_test", {
      author: "My Studio",
      website: "https://mystudio.dev",
    });
    expect(manifest).toContain("'author': 'My Studio'");
    expect(manifest).toContain("'website': 'https://mystudio.dev'");
  });

  it("merges extra depends while keeping website", () => {
    const manifest = generateManifest("Test Theme", baseFiles, "theme_test", {
      extraDepends: ["website_blog", "website_sale"],
    });
    expect(manifest).toContain("'depends': ['website', 'website_blog', 'website_sale']");
  });

  it("always uses correct category regardless of overrides", () => {
    const manifest = generateManifest("Test Theme", baseFiles, "theme_test", {
      summary: "Custom summary",
    });
    expect(manifest).toContain("'category': 'Website/Theme'");
  });

  it("always uses correct version regardless of overrides", () => {
    const manifest = generateManifest("Test Theme", baseFiles, "theme_test", {
      summary: "Custom summary",
    });
    expect(manifest).toContain("'version': '18.0.1.0.0'");
  });
});

// ---------------------------------------------------------------------------
// ensureRequiredFiles -- manifest merge integration
// ---------------------------------------------------------------------------

describe("ensureRequiredFiles manifest merge", () => {
  it("merges AI manifest fields when AI provides a manifest", () => {
    const aiManifest: ParsedFile = {
      path: "theme_generated/__manifest__.py",
      content: `{
    'name': 'Theme Oceanview',
    'summary': 'Ocean-inspired modern theme',
    'author': 'Riya Studio',
    'depends': ['website', 'website_blog'],
}`,
      language: "python",
      action: "create",
    };
    const xmlFile = makeXmlFile("layout.xml", "<odoo><template id='t'>test</template></odoo>");

    const result = ensureRequiredFiles([aiManifest, xmlFile], "Theme Oceanview");
    const manifest = result.find(f => f.path.includes("__manifest__"));

    expect(manifest).toBeDefined();
    expect(manifest!.content).toContain("'summary': 'Ocean-inspired modern theme'");
    expect(manifest!.content).toContain("'author': 'Riya Studio'");
    expect(manifest!.content).toContain("'website_blog'");
    // Critical fields still correct
    expect(manifest!.content).toContain("'category': 'Website/Theme'");
    expect(manifest!.content).toContain("'version': '18.0.1.0.0'");
  });

  it("uses defaults when AI provides no manifest", () => {
    const xmlFile = makeXmlFile("layout.xml", "<odoo><template id='t'>test</template></odoo>");

    const result = ensureRequiredFiles([xmlFile], "Theme Simple");
    const manifest = result.find(f => f.path.includes("__manifest__"));

    expect(manifest).toBeDefined();
    expect(manifest!.content).toContain("'summary': 'AI-generated Odoo website theme'");
    expect(manifest!.content).toContain("'author': 'Platxa Studio'");
  });
});

// ---------------------------------------------------------------------------
// getBasename -- exact filename extraction (Fix 4)
// ---------------------------------------------------------------------------

describe("getBasename", () => {
  it("extracts filename from a full path", () => {
    expect(getBasename("theme_generated/static/src/scss/primary_variables.scss")).toBe("primary_variables.scss");
  });

  it("returns the string itself when no slashes", () => {
    expect(getBasename("theme.scss")).toBe("theme.scss");
  });

  it("returns empty string for empty input", () => {
    expect(getBasename("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// generateManifest -- exact basename matching (Fix 4)
// ---------------------------------------------------------------------------

describe("generateManifest exact basename matching (Fix 4)", () => {
  it("routes primary_variables.scss to primary_variables bundle", () => {
    const files: ParsedFile[] = [
      makeScssFile("primary_variables.scss", "$o-color-1: #000;"),
    ];
    const manifest = generateManifest("Test", files, "theme_test");
    expect(manifest).toContain("web._assets_primary_variables");
    expect(manifest).toContain("primary_variables.scss");
  });

  it("does NOT misroute my_primary_variables_helper.scss to primary_variables bundle", () => {
    const files: ParsedFile[] = [{
      path: "theme_generated/static/src/scss/my_primary_variables_helper.scss",
      content: "body { color: red; }",
      language: "scss",
      action: "create",
    }];
    const manifest = generateManifest("Test", files, "theme_test");
    // Should go to web.assets_frontend, NOT web._assets_primary_variables
    expect(manifest).not.toContain("web._assets_primary_variables");
    expect(manifest).toContain("web.assets_frontend");
    expect(manifest).toContain("my_primary_variables_helper.scss");
  });

  it("does NOT misroute custom_bootstrap_overridden_utils.scss to frontend_helpers bundle", () => {
    const files: ParsedFile[] = [{
      path: "theme_generated/static/src/scss/custom_bootstrap_overridden_utils.scss",
      content: "body { font-size: 16px; }",
      language: "scss",
      action: "create",
    }];
    const manifest = generateManifest("Test", files, "theme_test");
    // Should go to web.assets_frontend, NOT web._assets_frontend_helpers
    expect(manifest).not.toContain("web._assets_frontend_helpers");
    expect(manifest).toContain("web.assets_frontend");
  });

  it("correctly routes all three SCSS types with exact matching", () => {
    const files: ParsedFile[] = [
      makeScssFile("primary_variables.scss", "$o-color-1: #000;"),
      makeScssFile("bootstrap_overridden.scss", "$border-radius: 0;"),
      makeScssFile("theme.scss", "body { color: red; }"),
      // Edge case: file whose name contains "primary_variables" as substring
      {
        path: "theme_generated/static/src/scss/not_primary_variables_at_all.scss",
        content: ".custom { display: flex; }",
        language: "scss",
        action: "create",
      },
    ];
    const manifest = generateManifest("Test", files, "theme_test");

    // primary_variables.scss -> prepend bundle
    expect(manifest).toMatch(/web\._assets_primary_variables[\s\S]*?primary_variables\.scss/);
    // bootstrap_overridden.scss -> helpers bundle
    expect(manifest).toMatch(/web\._assets_frontend_helpers[\s\S]*?bootstrap_overridden\.scss/);
    // theme.scss + not_primary_variables_at_all.scss -> frontend bundle
    expect(manifest).toMatch(/web\.assets_frontend[\s\S]*?theme\.scss/);
    expect(manifest).toMatch(/web\.assets_frontend[\s\S]*?not_primary_variables_at_all\.scss/);
  });
});
