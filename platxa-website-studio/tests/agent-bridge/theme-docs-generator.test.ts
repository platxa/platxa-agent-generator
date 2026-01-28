import { describe, it, expect } from "vitest";
import {
  generateReadme,
  generateChangelog,
  generateCustomizationGuide,
  generateScreenshotIndex,
  generateThemeDocs,
} from "@/lib/agent-bridge/theme-docs-generator";
import type { ThemeDocsInput } from "@/lib/agent-bridge/theme-docs-generator";

function makeInput(overrides: Partial<ThemeDocsInput> = {}): ThemeDocsInput {
  return {
    meta: {
      name: "theme_starter",
      displayName: "Starter Theme",
      version: "1.0.0",
      author: "Platxa",
      description: "A starter theme for Odoo.",
      license: "LGPL-3",
      odooVersion: "17.0",
      category: "Theme",
      website: "https://platxa.com",
    },
    pages: [
      { name: "Home", templatePath: "views/home.xml", description: "Homepage" },
      { name: "About", templatePath: "views/about.xml", description: "About page" },
    ],
    snippets: [
      { name: "Hero Banner", category: "structure", description: "Full-width hero" },
      { name: "Feature Grid", category: "content", description: "3-col features" },
    ],
    colors: [
      { variable: "$o-color-1", value: "#714B67", description: "Primary" },
      { variable: "$o-color-2", value: "#017E84", description: "Secondary" },
    ],
    screenshots: [
      { filename: "home.png", alt: "Homepage", caption: "Homepage Preview", target: "Home" },
    ],
    changelog: [
      {
        version: "1.0.0",
        date: "2025-01-01",
        changes: [
          { type: "added", description: "Initial release" },
          { type: "added", description: "Hero snippet" },
        ],
      },
    ],
    ...overrides,
  };
}

describe("Theme Docs Generator", () => {
  describe("generateReadme", () => {
    it("includes theme display name as title", () => {
      const md = generateReadme(makeInput());
      expect(md).toContain("# Starter Theme");
    });

    it("includes description", () => {
      const md = generateReadme(makeInput());
      expect(md).toContain("A starter theme for Odoo.");
    });

    it("includes version badge", () => {
      const md = generateReadme(makeInput());
      expect(md).toContain("version-1.0.0");
    });

    it("includes odoo version badge", () => {
      const md = generateReadme(makeInput());
      expect(md).toContain("odoo-17.0");
    });

    it("includes installation steps", () => {
      const md = generateReadme(makeInput());
      expect(md).toContain("## Installation");
      expect(md).toContain("theme_starter");
    });

    it("includes pages table", () => {
      const md = generateReadme(makeInput());
      expect(md).toContain("## Pages");
      expect(md).toContain("| Home |");
      expect(md).toContain("| About |");
    });

    it("includes snippets table", () => {
      const md = generateReadme(makeInput());
      expect(md).toContain("## Snippets");
      expect(md).toContain("| Hero Banner |");
    });

    it("includes color palette table", () => {
      const md = generateReadme(makeInput());
      expect(md).toContain("## Color Palette");
      expect(md).toContain("`$o-color-1`");
    });

    it("includes screenshots section", () => {
      const md = generateReadme(makeInput());
      expect(md).toContain("## Screenshots");
      expect(md).toContain("![Homepage](screenshots/home.png)");
    });

    it("omits screenshots section when empty", () => {
      const md = generateReadme(makeInput({ screenshots: [] }));
      expect(md).not.toContain("## Screenshots");
    });

    it("includes author and website", () => {
      const md = generateReadme(makeInput());
      expect(md).toContain("Platxa");
      expect(md).toContain("https://platxa.com");
    });

    it("handles author without website", () => {
      const input = makeInput();
      input.meta.website = undefined;
      const md = generateReadme(input);
      expect(md).toContain("Platxa");
      expect(md).not.toContain("[undefined]");
    });
  });

  describe("generateChangelog", () => {
    it("includes header", () => {
      const md = generateChangelog(makeInput().changelog);
      expect(md).toContain("# Changelog");
    });

    it("includes version and date", () => {
      const md = generateChangelog(makeInput().changelog);
      expect(md).toContain("## [1.0.0] - 2025-01-01");
    });

    it("groups changes by type", () => {
      const md = generateChangelog(makeInput().changelog);
      expect(md).toContain("### Added");
      expect(md).toContain("- Initial release");
      expect(md).toContain("- Hero snippet");
    });

    it("sorts entries newest first", () => {
      const changelog = [
        { version: "1.0.0", date: "2025-01-01", changes: [{ type: "added" as const, description: "First" }] },
        { version: "2.0.0", date: "2025-06-01", changes: [{ type: "added" as const, description: "Second" }] },
      ];
      const md = generateChangelog(changelog);
      const idx1 = md.indexOf("2.0.0");
      const idx2 = md.indexOf("1.0.0");
      expect(idx1).toBeLessThan(idx2);
    });

    it("handles multiple change types", () => {
      const changelog = [
        {
          version: "1.1.0",
          date: "2025-02-01",
          changes: [
            { type: "added" as const, description: "New feature" },
            { type: "fixed" as const, description: "Bug fix" },
            { type: "removed" as const, description: "Old code" },
          ],
        },
      ];
      const md = generateChangelog(changelog);
      expect(md).toContain("### Added");
      expect(md).toContain("### Fixed");
      expect(md).toContain("### Removed");
    });
  });

  describe("generateCustomizationGuide", () => {
    it("includes title", () => {
      const md = generateCustomizationGuide(makeInput());
      expect(md).toContain("# Customization Guide - Starter Theme");
    });

    it("includes color variables in SCSS block", () => {
      const md = generateCustomizationGuide(makeInput());
      expect(md).toContain("$o-color-1: #714B67;");
    });

    it("groups snippets by category", () => {
      const md = generateCustomizationGuide(makeInput());
      expect(md).toContain("### Structure");
      expect(md).toContain("### Content");
    });

    it("includes child theme example", () => {
      const md = generateCustomizationGuide(makeInput());
      expect(md).toContain('"depends": ["theme_starter"]');
    });
  });

  describe("generateScreenshotIndex", () => {
    it("lists screenshots with captions", () => {
      const md = generateScreenshotIndex(makeInput().screenshots);
      expect(md).toContain("## Homepage Preview");
      expect(md).toContain("**Target:** Home");
      expect(md).toContain("![Homepage](home.png)");
    });
  });

  describe("generateThemeDocs", () => {
    it("generates all doc files", () => {
      const result = generateThemeDocs(makeInput());
      const filenames = result.docs.map((d) => d.filename);
      expect(filenames).toContain("README.md");
      expect(filenames).toContain("CHANGELOG.md");
      expect(filenames).toContain("CUSTOMIZATION.md");
      expect(filenames).toContain("screenshots/INDEX.md");
    });

    it("omits screenshot index when no screenshots", () => {
      const result = generateThemeDocs(makeInput({ screenshots: [] }));
      const filenames = result.docs.map((d) => d.filename);
      expect(filenames).not.toContain("screenshots/INDEX.md");
    });

    it("all docs have non-empty content", () => {
      const result = generateThemeDocs(makeInput());
      for (const doc of result.docs) {
        expect(doc.content.length).toBeGreaterThan(0);
      }
    });
  });
});
