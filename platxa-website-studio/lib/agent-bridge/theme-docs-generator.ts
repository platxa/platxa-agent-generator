/**
 * Theme Documentation Generator
 *
 * Produces README.md, CHANGELOG.md, screenshot annotations,
 * and customization guides for Odoo themes.
 */

// =============================================================================
// Types
// =============================================================================

export interface ThemeMeta {
  /** Theme technical name */
  name: string;
  /** Display name */
  displayName: string;
  /** Version */
  version: string;
  /** Author */
  author: string;
  /** Description */
  description: string;
  /** License */
  license: string;
  /** Odoo version */
  odooVersion: string;
  /** Category */
  category: string;
  /** Website URL */
  website?: string;
}

export interface ThemePage {
  /** Page name */
  name: string;
  /** Template path */
  templatePath: string;
  /** Description */
  description: string;
}

export interface ThemeSnippet {
  /** Snippet name */
  name: string;
  /** Category (e.g. "structure", "content", "feature") */
  category: string;
  /** Description */
  description: string;
}

export interface ThemeColorEntry {
  /** CSS variable name */
  variable: string;
  /** Default value */
  value: string;
  /** Description */
  description: string;
}

export interface ScreenshotAnnotation {
  /** Screenshot filename */
  filename: string;
  /** Alt text */
  alt: string;
  /** Caption */
  caption: string;
  /** Page or snippet it documents */
  target: string;
}

export interface ChangelogEntry {
  /** Version */
  version: string;
  /** Release date (YYYY-MM-DD) */
  date: string;
  /** Changes grouped by type */
  changes: { type: "added" | "changed" | "fixed" | "removed"; description: string }[];
}

export interface ThemeDocsInput {
  meta: ThemeMeta;
  pages: ThemePage[];
  snippets: ThemeSnippet[];
  colors: ThemeColorEntry[];
  screenshots: ScreenshotAnnotation[];
  changelog: ChangelogEntry[];
}

export interface GeneratedDoc {
  /** Filename */
  filename: string;
  /** Content */
  content: string;
}

export interface DocsResult {
  docs: GeneratedDoc[];
}

// =============================================================================
// README Generator
// =============================================================================

export function generateReadme(input: ThemeDocsInput): string {
  const { meta, pages, snippets, colors, screenshots } = input;
  const lines: string[] = [];

  lines.push(`# ${meta.displayName}`);
  lines.push("");
  lines.push(meta.description);
  lines.push("");

  // Badges
  lines.push(`![Version](https://img.shields.io/badge/version-${meta.version}-blue)`);
  lines.push(`![Odoo](https://img.shields.io/badge/odoo-${meta.odooVersion}-purple)`);
  lines.push(`![License](https://img.shields.io/badge/license-${meta.license}-green)`);
  lines.push("");

  // Screenshots
  if (screenshots.length > 0) {
    lines.push("## Screenshots");
    lines.push("");
    for (const s of screenshots) {
      lines.push(`### ${s.caption}`);
      lines.push("");
      lines.push(`![${s.alt}](screenshots/${s.filename})`);
      lines.push("");
    }
  }

  // Installation
  lines.push("## Installation");
  lines.push("");
  lines.push(`1. Copy \`${meta.name}\` to your Odoo addons directory`);
  lines.push("2. Update the app list in Odoo");
  lines.push(`3. Install **${meta.displayName}** from the Apps menu`);
  lines.push("");

  // Pages
  if (pages.length > 0) {
    lines.push("## Pages");
    lines.push("");
    lines.push("| Page | Template | Description |");
    lines.push("|------|----------|-------------|");
    for (const p of pages) {
      lines.push(`| ${p.name} | \`${p.templatePath}\` | ${p.description} |`);
    }
    lines.push("");
  }

  // Snippets
  if (snippets.length > 0) {
    lines.push("## Snippets");
    lines.push("");
    lines.push("| Snippet | Category | Description |");
    lines.push("|---------|----------|-------------|");
    for (const s of snippets) {
      lines.push(`| ${s.name} | ${s.category} | ${s.description} |`);
    }
    lines.push("");
  }

  // Colors
  if (colors.length > 0) {
    lines.push("## Color Palette");
    lines.push("");
    lines.push("| Variable | Default | Description |");
    lines.push("|----------|---------|-------------|");
    for (const c of colors) {
      lines.push(`| \`${c.variable}\` | \`${c.value}\` | ${c.description} |`);
    }
    lines.push("");
  }

  // Footer
  lines.push("## Author");
  lines.push("");
  lines.push(`${meta.author}${meta.website ? ` - [${meta.website}](${meta.website})` : ""}`);
  lines.push("");
  lines.push(`## License`);
  lines.push("");
  lines.push(`This theme is licensed under ${meta.license}.`);
  lines.push("");

  return lines.join("\n");
}

// =============================================================================
// CHANGELOG Generator
// =============================================================================

export function generateChangelog(changelog: ChangelogEntry[]): string {
  const lines: string[] = [];
  lines.push("# Changelog");
  lines.push("");
  lines.push("All notable changes to this theme will be documented in this file.");
  lines.push("");

  const sorted = [...changelog].sort((a, b) => b.date.localeCompare(a.date));

  for (const entry of sorted) {
    lines.push(`## [${entry.version}] - ${entry.date}`);
    lines.push("");

    const grouped: Record<string, string[]> = {};
    for (const c of entry.changes) {
      if (!grouped[c.type]) grouped[c.type] = [];
      grouped[c.type].push(c.description);
    }

    const typeLabels: Record<string, string> = {
      added: "Added",
      changed: "Changed",
      fixed: "Fixed",
      removed: "Removed",
    };

    for (const type of ["added", "changed", "fixed", "removed"]) {
      if (grouped[type]) {
        lines.push(`### ${typeLabels[type]}`);
        lines.push("");
        for (const desc of grouped[type]) {
          lines.push(`- ${desc}`);
        }
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}

// =============================================================================
// Customization Guide
// =============================================================================

export function generateCustomizationGuide(input: ThemeDocsInput): string {
  const { meta, colors, snippets } = input;
  const lines: string[] = [];

  lines.push(`# Customization Guide - ${meta.displayName}`);
  lines.push("");
  lines.push("This guide explains how to customize the theme to match your brand.");
  lines.push("");

  // Colors
  lines.push("## Changing Colors");
  lines.push("");
  lines.push("Override these SCSS variables in your custom stylesheet:");
  lines.push("");
  lines.push("```scss");
  for (const c of colors) {
    lines.push(`${c.variable}: ${c.value}; // ${c.description}`);
  }
  lines.push("```");
  lines.push("");

  // Snippets
  if (snippets.length > 0) {
    lines.push("## Available Snippets");
    lines.push("");
    lines.push("Drag and drop these snippets from the Website Builder:");
    lines.push("");
    const categories = [...new Set(snippets.map((s) => s.category))];
    for (const cat of categories) {
      lines.push(`### ${cat.charAt(0).toUpperCase() + cat.slice(1)}`);
      lines.push("");
      for (const s of snippets.filter((sn) => sn.category === cat)) {
        lines.push(`- **${s.name}**: ${s.description}`);
      }
      lines.push("");
    }
  }

  // Advanced
  lines.push("## Advanced Customization");
  lines.push("");
  lines.push("For advanced customization, create a child theme:");
  lines.push("");
  lines.push("```python");
  lines.push(`# __manifest__.py`);
  lines.push(`{`);
  lines.push(`    "name": "My Custom Theme",`);
  lines.push(`    "depends": ["${meta.name}"],`);
  lines.push(`    "data": ["views/custom_templates.xml"],`);
  lines.push(`}`);
  lines.push("```");
  lines.push("");

  return lines.join("\n");
}

// =============================================================================
// Screenshot Index
// =============================================================================

export function generateScreenshotIndex(screenshots: ScreenshotAnnotation[]): string {
  const lines: string[] = [];
  lines.push("# Screenshots");
  lines.push("");

  for (const s of screenshots) {
    lines.push(`## ${s.caption}`);
    lines.push("");
    lines.push(`**Target:** ${s.target}`);
    lines.push("");
    lines.push(`![${s.alt}](${s.filename})`);
    lines.push("");
  }

  return lines.join("\n");
}

// =============================================================================
// Main Generator
// =============================================================================

export function generateThemeDocs(input: ThemeDocsInput): DocsResult {
  const docs: GeneratedDoc[] = [];

  docs.push({ filename: "README.md", content: generateReadme(input) });
  docs.push({ filename: "CHANGELOG.md", content: generateChangelog(input.changelog) });
  docs.push({ filename: "CUSTOMIZATION.md", content: generateCustomizationGuide(input) });

  if (input.screenshots.length > 0) {
    docs.push({ filename: "screenshots/INDEX.md", content: generateScreenshotIndex(input.screenshots) });
  }

  return { docs };
}
