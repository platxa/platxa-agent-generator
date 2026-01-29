#!/usr/bin/env node
/**
 * CLI Token Documentation Generator (Feature #80)
 *
 * Auto-generates token reference documentation from brand kits.
 *
 * @example
 * ```bash
 * npx @platxa/frontend-agent docs
 * npx @platxa/frontend-agent docs --output ./docs/tokens.md
 * npx @platxa/frontend-agent docs @acme/brand-kit --format html
 * ```
 *
 * @module cli/docs
 */

import * as fs from "node:fs"
import * as path from "node:path"

// =============================================================================
// TYPES
// =============================================================================

interface DocsOptions {
  /** Source: package name, path, or 'builtin' */
  source: string
  /** Output file path */
  output?: string
  /** Output format */
  format: "markdown" | "html" | "json"
  /** Include visual examples */
  visual: boolean
  /** Preset to use for built-in */
  preset?: string
}

interface BrandKitExport {
  meta: {
    name: string
    version: string
    description?: string
  }
  primitives: {
    primary: Record<number, string>
    accent: Record<number, string>
    neutral: Record<number, string>
  }
  semantics: {
    light: Record<string, string>
    dark: Record<string, string>
  }
  typography?: {
    fontFamily?: Record<string, string[]>
    fontSize?: Record<string, string>
    fontWeight?: Record<string, string>
    lineHeight?: Record<string, string>
  }
  spacing?: Record<string | number, string>
  radius?: Record<string, string>
  shadow?: Record<string, string>
}

// =============================================================================
// BUILT-IN TOKENS
// =============================================================================

const BUILTIN_TOKENS: BrandKitExport = {
  meta: {
    name: "@platxa/frontend-agent",
    version: "1.0.0",
    description: "Built-in design tokens",
  },
  primitives: {
    primary: {
      50: "oklch(0.97 0.02 222)",
      100: "oklch(0.93 0.04 222)",
      200: "oklch(0.86 0.08 222)",
      300: "oklch(0.76 0.12 222)",
      400: "oklch(0.66 0.16 222)",
      500: "oklch(0.55 0.18 222)",
      600: "oklch(0.47 0.17 222)",
      700: "oklch(0.40 0.15 222)",
      800: "oklch(0.33 0.12 222)",
      900: "oklch(0.27 0.09 222)",
      950: "oklch(0.20 0.06 222)",
    },
    accent: {
      50: "oklch(0.97 0.02 262)",
      100: "oklch(0.93 0.04 262)",
      200: "oklch(0.86 0.08 262)",
      300: "oklch(0.76 0.12 262)",
      400: "oklch(0.66 0.16 262)",
      500: "oklch(0.55 0.18 262)",
      600: "oklch(0.47 0.17 262)",
      700: "oklch(0.40 0.15 262)",
      800: "oklch(0.33 0.12 262)",
      900: "oklch(0.27 0.09 262)",
      950: "oklch(0.20 0.06 262)",
    },
    neutral: {
      50: "oklch(0.98 0.005 222)",
      100: "oklch(0.95 0.005 222)",
      200: "oklch(0.90 0.005 222)",
      300: "oklch(0.82 0.005 222)",
      400: "oklch(0.70 0.01 222)",
      500: "oklch(0.55 0.01 222)",
      600: "oklch(0.45 0.01 222)",
      700: "oklch(0.37 0.01 222)",
      800: "oklch(0.27 0.01 222)",
      900: "oklch(0.20 0.01 222)",
      950: "oklch(0.14 0.01 222)",
    },
  },
  semantics: {
    light: {
      background: "oklch(0.99 0.002 222)",
      foreground: "oklch(0.15 0.01 222)",
      primary: "oklch(0.47 0.17 222)",
      primaryForeground: "oklch(0.99 0 0)",
      secondary: "oklch(0.95 0.005 222)",
      secondaryForeground: "oklch(0.20 0.01 222)",
      muted: "oklch(0.95 0.005 222)",
      mutedForeground: "oklch(0.55 0.01 222)",
      accent: "oklch(0.93 0.04 262)",
      accentForeground: "oklch(0.27 0.09 262)",
      destructive: "oklch(0.55 0.22 25)",
      destructiveForeground: "oklch(0.99 0 0)",
      border: "oklch(0.90 0.005 222)",
      input: "oklch(0.90 0.005 222)",
      ring: "oklch(0.55 0.18 222)",
    },
    dark: {
      background: "oklch(0.14 0.01 222)",
      foreground: "oklch(0.95 0.005 222)",
      primary: "oklch(0.55 0.18 222)",
      primaryForeground: "oklch(0.12 0.01 222)",
      secondary: "oklch(0.27 0.01 222)",
      secondaryForeground: "oklch(0.95 0.005 222)",
      muted: "oklch(0.27 0.01 222)",
      mutedForeground: "oklch(0.70 0.01 222)",
      accent: "oklch(0.33 0.12 262)",
      accentForeground: "oklch(0.93 0.04 262)",
      destructive: "oklch(0.60 0.20 25)",
      destructiveForeground: "oklch(0.99 0 0)",
      border: "oklch(0.27 0.01 222)",
      input: "oklch(0.27 0.01 222)",
      ring: "oklch(0.66 0.16 222)",
    },
  },
  typography: {
    fontFamily: {
      sans: ["Inter", "system-ui", "sans-serif"],
      mono: ["JetBrains Mono", "Consolas", "monospace"],
    },
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem",
    },
    fontWeight: {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
    lineHeight: {
      tight: "1.25",
      normal: "1.5",
      relaxed: "1.75",
    },
  },
  spacing: {
    px: "1px",
    0: "0",
    0.5: "0.125rem",
    1: "0.25rem",
    2: "0.5rem",
    3: "0.75rem",
    4: "1rem",
    5: "1.25rem",
    6: "1.5rem",
    8: "2rem",
    10: "2.5rem",
    12: "3rem",
    16: "4rem",
    20: "5rem",
    24: "6rem",
  },
  radius: {
    none: "0",
    sm: "0.125rem",
    default: "0.25rem",
    md: "0.375rem",
    lg: "0.5rem",
    xl: "0.75rem",
    "2xl": "1rem",
    full: "9999px",
  },
  shadow: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    default: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    none: "none",
  },
}

// =============================================================================
// MARKDOWN GENERATOR
// =============================================================================

function generateMarkdown(tokens: BrandKitExport, visual: boolean): string {
  const lines: string[] = []

  // Header
  lines.push(`# ${tokens.meta.name} - Token Reference`)
  lines.push("")
  lines.push(`> ${tokens.meta.description || "Design token documentation"}`)
  lines.push("")
  lines.push(`**Version:** ${tokens.meta.version}`)
  lines.push("")
  lines.push("---")
  lines.push("")

  // Table of Contents
  lines.push("## Table of Contents")
  lines.push("")
  lines.push("- [Color Primitives](#color-primitives)")
  lines.push("  - [Primary](#primary)")
  lines.push("  - [Accent](#accent)")
  lines.push("  - [Neutral](#neutral)")
  lines.push("- [Semantic Colors](#semantic-colors)")
  lines.push("  - [Light Mode](#light-mode)")
  lines.push("  - [Dark Mode](#dark-mode)")
  if (tokens.typography) {
    lines.push("- [Typography](#typography)")
  }
  if (tokens.spacing) {
    lines.push("- [Spacing](#spacing)")
  }
  if (tokens.radius) {
    lines.push("- [Border Radius](#border-radius)")
  }
  if (tokens.shadow) {
    lines.push("- [Shadows](#shadows)")
  }
  lines.push("- [Usage Examples](#usage-examples)")
  lines.push("")
  lines.push("---")
  lines.push("")

  // Color Primitives
  lines.push("## Color Primitives")
  lines.push("")

  for (const [scaleName, scale] of Object.entries(tokens.primitives)) {
    lines.push(`### ${scaleName.charAt(0).toUpperCase() + scaleName.slice(1)}`)
    lines.push("")
    lines.push("| Step | Value | CSS Variable |")
    lines.push("|------|-------|--------------|")

    for (const [step, value] of Object.entries(scale)) {
      lines.push(
        `| \`${step}\` | \`${value}\` | \`var(--color-${scaleName}-${step})\` |`
      )
    }
    lines.push("")

    // Code snippet
    const scaleEntries = Object.entries(scale)
    const midIndex = Math.floor(scaleEntries.length / 2)
    const [midStep, midValue] = scaleEntries[midIndex] || ["500", ""]

    lines.push("**Usage:**")
    lines.push("")
    lines.push("```tsx")
    lines.push(`// Import`)
    lines.push(`import { ${scaleName} } from "${tokens.meta.name}"`)
    lines.push("")
    lines.push(`// Access`)
    lines.push(`const color = ${scaleName}[${midStep}] // "${midValue}"`)
    lines.push("```")
    lines.push("")
    lines.push("```css")
    lines.push(`/* CSS Variable */`)
    lines.push(`.element {`)
    lines.push(`  background: var(--color-${scaleName}-500);`)
    lines.push(`}`)
    lines.push("```")
    lines.push("")
  }

  // Semantic Colors
  lines.push("## Semantic Colors")
  lines.push("")

  lines.push("### Light Mode")
  lines.push("")
  lines.push("| Token | Value | CSS Variable |")
  lines.push("|-------|-------|--------------|")

  for (const [name, value] of Object.entries(tokens.semantics.light)) {
    const cssVar = name.replace(/([A-Z])/g, "-$1").toLowerCase()
    lines.push(`| \`${name}\` | \`${value}\` | \`var(--${cssVar})\` |`)
  }
  lines.push("")

  lines.push("### Dark Mode")
  lines.push("")
  lines.push("| Token | Value | CSS Variable |")
  lines.push("|-------|-------|--------------|")

  for (const [name, value] of Object.entries(tokens.semantics.dark)) {
    const cssVar = name.replace(/([A-Z])/g, "-$1").toLowerCase()
    lines.push(`| \`${name}\` | \`${value}\` | \`var(--${cssVar})\` |`)
  }
  lines.push("")

  lines.push("**Usage:**")
  lines.push("")
  lines.push("```tsx")
  lines.push(`import { semantics } from "${tokens.meta.name}"`)
  lines.push("")
  lines.push(`// Light mode`)
  lines.push(`const bg = semantics.light.background`)
  lines.push(`const fg = semantics.light.foreground`)
  lines.push("")
  lines.push(`// Dark mode`)
  lines.push(`const darkBg = semantics.dark.background`)
  lines.push("```")
  lines.push("")

  // Typography
  if (tokens.typography) {
    lines.push("## Typography")
    lines.push("")

    if (tokens.typography.fontFamily) {
      lines.push("### Font Family")
      lines.push("")
      lines.push("| Name | Stack | CSS Variable |")
      lines.push("|------|-------|--------------|")

      for (const [name, stack] of Object.entries(tokens.typography.fontFamily)) {
        const stackStr = Array.isArray(stack) ? stack.join(", ") : stack
        lines.push(
          `| \`${name}\` | \`${stackStr}\` | \`var(--font-${name})\` |`
        )
      }
      lines.push("")
    }

    if (tokens.typography.fontSize) {
      lines.push("### Font Size")
      lines.push("")
      lines.push("| Name | Size | CSS Variable | Tailwind |")
      lines.push("|------|------|--------------|----------|")

      for (const [name, size] of Object.entries(tokens.typography.fontSize)) {
        lines.push(
          `| \`${name}\` | \`${size}\` | \`var(--text-${name})\` | \`text-${name}\` |`
        )
      }
      lines.push("")
    }

    if (tokens.typography.fontWeight) {
      lines.push("### Font Weight")
      lines.push("")
      lines.push("| Name | Weight | CSS Variable | Tailwind |")
      lines.push("|------|--------|--------------|----------|")

      for (const [name, weight] of Object.entries(tokens.typography.fontWeight)) {
        lines.push(
          `| \`${name}\` | \`${weight}\` | \`var(--font-${name})\` | \`font-${name}\` |`
        )
      }
      lines.push("")
    }

    lines.push("**Usage:**")
    lines.push("")
    lines.push("```tsx")
    lines.push(`import { typography } from "${tokens.meta.name}"`)
    lines.push("")
    lines.push(`const fontFamily = typography.fontFamily.sans.join(", ")`)
    lines.push(`const fontSize = typography.fontSize.lg // "1.125rem"`)
    lines.push("```")
    lines.push("")
  }

  // Spacing
  if (tokens.spacing) {
    lines.push("## Spacing")
    lines.push("")
    lines.push("Based on an 4px/8px grid system.")
    lines.push("")
    lines.push("| Token | Size | Pixels | CSS Variable | Tailwind |")
    lines.push("|-------|------|--------|--------------|----------|")

    for (const [name, size] of Object.entries(tokens.spacing)) {
      const pixels = size === "0" ? "0" : size.includes("rem")
        ? `${parseFloat(size) * 16}px`
        : size
      lines.push(
        `| \`${name}\` | \`${size}\` | ${pixels} | \`var(--spacing-${name})\` | \`p-${name}\`, \`m-${name}\` |`
      )
    }
    lines.push("")

    lines.push("**Usage:**")
    lines.push("")
    lines.push("```tsx")
    lines.push(`import { spacing } from "${tokens.meta.name}"`)
    lines.push("")
    lines.push(`const padding = spacing[4] // "1rem" (16px)`)
    lines.push(`const margin = spacing[8] // "2rem" (32px)`)
    lines.push("```")
    lines.push("")
    lines.push("```css")
    lines.push(`.element {`)
    lines.push(`  padding: var(--spacing-4);`)
    lines.push(`  margin: var(--spacing-8);`)
    lines.push(`}`)
    lines.push("```")
    lines.push("")
  }

  // Border Radius
  if (tokens.radius) {
    lines.push("## Border Radius")
    lines.push("")
    lines.push("| Token | Size | CSS Variable | Tailwind |")
    lines.push("|-------|------|--------------|----------|")

    for (const [name, size] of Object.entries(tokens.radius)) {
      const twClass = name === "default" ? "rounded" : `rounded-${name}`
      lines.push(
        `| \`${name}\` | \`${size}\` | \`var(--radius-${name})\` | \`${twClass}\` |`
      )
    }
    lines.push("")

    lines.push("**Usage:**")
    lines.push("")
    lines.push("```tsx")
    lines.push(`import { radius } from "${tokens.meta.name}"`)
    lines.push("")
    lines.push(`const borderRadius = radius.lg // "0.5rem"`)
    lines.push("```")
    lines.push("")

    if (visual) {
      lines.push("**Visual Examples:**")
      lines.push("")
      lines.push("```")
      lines.push("┌────────┐  ╭────────╮  ╭────────╮  ●")
      lines.push("│  none  │  │   sm   │  │   lg   │  full")
      lines.push("└────────┘  ╰────────╯  ╰────────╯")
      lines.push("```")
      lines.push("")
    }
  }

  // Shadows
  if (tokens.shadow) {
    lines.push("## Shadows")
    lines.push("")
    lines.push("| Token | Value | CSS Variable | Tailwind |")
    lines.push("|-------|-------|--------------|----------|")

    for (const [name, value] of Object.entries(tokens.shadow)) {
      const twClass = name === "default" ? "shadow" : `shadow-${name}`
      const displayValue = value.length > 50 ? value.slice(0, 47) + "..." : value
      lines.push(
        `| \`${name}\` | \`${displayValue}\` | \`var(--shadow-${name})\` | \`${twClass}\` |`
      )
    }
    lines.push("")

    lines.push("**Usage:**")
    lines.push("")
    lines.push("```tsx")
    lines.push(`import { shadow } from "${tokens.meta.name}"`)
    lines.push("")
    lines.push(`const boxShadow = shadow.md`)
    lines.push("```")
    lines.push("")
    lines.push("```css")
    lines.push(`.card {`)
    lines.push(`  box-shadow: var(--shadow-md);`)
    lines.push(`}`)
    lines.push("```")
    lines.push("")
  }

  // Usage Examples
  lines.push("## Usage Examples")
  lines.push("")

  lines.push("### With BrandProvider (React)")
  lines.push("")
  lines.push("```tsx")
  lines.push('import { BrandProvider } from "@platxa/frontend-agent"')
  lines.push("")
  lines.push("function App() {")
  lines.push("  return (")
  lines.push(`    <BrandProvider brandPackage="${tokens.meta.name}">`)
  lines.push("      <YourApp />")
  lines.push("    </BrandProvider>")
  lines.push("  )")
  lines.push("}")
  lines.push("```")
  lines.push("")

  lines.push("### Direct Import")
  lines.push("")
  lines.push("```tsx")
  lines.push(`import brandKit from "${tokens.meta.name}"`)
  lines.push("")
  lines.push("// Access all tokens")
  lines.push("console.log(brandKit.primitives.primary[500])")
  lines.push("console.log(brandKit.semantics.light.background)")
  lines.push("console.log(brandKit.typography?.fontSize.lg)")
  lines.push("```")
  lines.push("")

  lines.push("### With Tailwind CSS")
  lines.push("")
  lines.push("```javascript")
  lines.push("// tailwind.config.js")
  lines.push(`import brandKit from "${tokens.meta.name}"`)
  lines.push("")
  lines.push("export default {")
  lines.push("  presets: [brandKit.tailwindPreset],")
  lines.push("}")
  lines.push("```")
  lines.push("")

  lines.push("### CSS Variables")
  lines.push("")
  lines.push("All tokens are available as CSS variables when using BrandProvider:")
  lines.push("")
  lines.push("```css")
  lines.push(".my-component {")
  lines.push("  /* Colors */")
  lines.push("  background: var(--background);")
  lines.push("  color: var(--foreground);")
  lines.push("  border-color: var(--border);")
  lines.push("")
  lines.push("  /* Primary scale */")
  lines.push("  --highlight: var(--color-primary-500);")
  lines.push("")
  lines.push("  /* Typography */")
  lines.push("  font-family: var(--font-sans);")
  lines.push("  font-size: var(--text-lg);")
  lines.push("")
  lines.push("  /* Spacing */")
  lines.push("  padding: var(--spacing-4);")
  lines.push("  margin: var(--spacing-8);")
  lines.push("")
  lines.push("  /* Radius & Shadow */")
  lines.push("  border-radius: var(--radius-lg);")
  lines.push("  box-shadow: var(--shadow-md);")
  lines.push("}")
  lines.push("```")
  lines.push("")

  lines.push("---")
  lines.push("")
  lines.push(`*Generated by @platxa/frontend-agent on ${new Date().toISOString().split("T")[0]}*`)
  lines.push("")

  return lines.join("\n")
}

// =============================================================================
// HTML GENERATOR
// =============================================================================

function generateHtml(tokens: BrandKitExport, visual: boolean): string {
  const md = generateMarkdown(tokens, visual)

  // Simple HTML wrapper with basic styling
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${tokens.meta.name} - Token Reference</title>
  <style>
    :root {
      --bg: #fafafa;
      --fg: #171717;
      --border: #e5e5e5;
      --code-bg: #f5f5f5;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #171717;
        --fg: #fafafa;
        --border: #404040;
        --code-bg: #262626;
      }
    }
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      line-height: 1.6;
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
      background: var(--bg);
      color: var(--fg);
    }
    h1, h2, h3 { margin-top: 2rem; }
    h1 { border-bottom: 2px solid var(--border); padding-bottom: 0.5rem; }
    h2 { border-bottom: 1px solid var(--border); padding-bottom: 0.25rem; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
      font-size: 0.875rem;
    }
    th, td {
      padding: 0.5rem;
      text-align: left;
      border: 1px solid var(--border);
    }
    th { background: var(--code-bg); }
    code {
      background: var(--code-bg);
      padding: 0.125rem 0.25rem;
      border-radius: 0.25rem;
      font-size: 0.875em;
    }
    pre {
      background: var(--code-bg);
      padding: 1rem;
      border-radius: 0.5rem;
      overflow-x: auto;
    }
    pre code {
      background: none;
      padding: 0;
    }
    blockquote {
      margin: 1rem 0;
      padding: 0.5rem 1rem;
      border-left: 4px solid var(--border);
      background: var(--code-bg);
    }
    a { color: #3b82f6; }
    hr { border: none; border-top: 1px solid var(--border); margin: 2rem 0; }
    ul { padding-left: 1.5rem; }
  </style>
</head>
<body>
${markdownToHtml(md)}
</body>
</html>`
}

function markdownToHtml(md: string): string {
  return md
    // Headers
    .replace(/^### (.*$)/gm, "<h3>$1</h3>")
    .replace(/^## (.*$)/gm, "<h2>$1</h2>")
    .replace(/^# (.*$)/gm, "<h1>$1</h1>")
    // Bold
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // Code blocks
    .replace(/```(\w+)?\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>")
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Blockquotes
    .replace(/^> (.*$)/gm, "<blockquote>$1</blockquote>")
    // Lists
    .replace(/^- (.*$)/gm, "<li>$1</li>")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Tables
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split("|").filter(Boolean).map((c) => c.trim())
      if (cells.every((c) => /^-+$/.test(c))) {
        return "" // Skip separator row
      }
      const tag = match.includes("---") ? "th" : "td"
      return `<tr>${cells.map((c) => `<${tag}>${c}</${tag}>`).join("")}</tr>`
    })
    // Wrap tables
    .replace(/(<tr>.*<\/tr>\n?)+/g, "<table>$&</table>")
    // Wrap lists
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    // Horizontal rules
    .replace(/^---$/gm, "<hr>")
    // Paragraphs
    .replace(/^(?!<[hupltbo]|$)(.+)$/gm, "<p>$1</p>")
    // Clean up
    .replace(/<p><\/p>/g, "")
    .replace(/\n{3,}/g, "\n\n")
}

// =============================================================================
// JSON GENERATOR
// =============================================================================

function generateJson(tokens: BrandKitExport): string {
  return JSON.stringify(
    {
      $schema: "https://platxa.com/schemas/brand-kit.json",
      meta: tokens.meta,
      tokens: {
        colors: {
          primitives: tokens.primitives,
          semantics: tokens.semantics,
        },
        typography: tokens.typography,
        spacing: tokens.spacing,
        radius: tokens.radius,
        shadow: tokens.shadow,
      },
      cssVariables: generateCssVariableMap(tokens),
    },
    null,
    2
  )
}

function generateCssVariableMap(
  tokens: BrandKitExport
): Record<string, string> {
  const vars: Record<string, string> = {}

  // Color primitives
  for (const [scale, colors] of Object.entries(tokens.primitives)) {
    for (const [step, value] of Object.entries(colors)) {
      vars[`--color-${scale}-${step}`] = value
    }
  }

  // Semantic colors
  for (const [name, value] of Object.entries(tokens.semantics.light)) {
    const cssName = name.replace(/([A-Z])/g, "-$1").toLowerCase()
    vars[`--${cssName}`] = value
  }

  // Typography
  if (tokens.typography?.fontSize) {
    for (const [name, value] of Object.entries(tokens.typography.fontSize)) {
      vars[`--text-${name}`] = value
    }
  }

  // Spacing
  if (tokens.spacing) {
    for (const [name, value] of Object.entries(tokens.spacing)) {
      vars[`--spacing-${name}`] = value
    }
  }

  // Radius
  if (tokens.radius) {
    for (const [name, value] of Object.entries(tokens.radius)) {
      vars[`--radius-${name}`] = value
    }
  }

  // Shadow
  if (tokens.shadow) {
    for (const [name, value] of Object.entries(tokens.shadow)) {
      vars[`--shadow-${name}`] = value
    }
  }

  return vars
}

// =============================================================================
// BRAND KIT LOADING
// =============================================================================

async function loadBrandKit(source: string): Promise<BrandKitExport> {
  if (source === "builtin" || source === "default") {
    return BUILTIN_TOKENS
  }

  // Check if it's a file path
  const isPath =
    source.startsWith("./") ||
    source.startsWith("/") ||
    source.startsWith("../")

  if (isPath) {
    const resolvedPath = path.resolve(process.cwd(), source)

    // Check for package.json
    const pkgJsonPath = path.join(resolvedPath, "package.json")
    if (fs.existsSync(pkgJsonPath)) {
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"))
      const main = pkgJson.main || "index.js"
      const entryPath = path.join(resolvedPath, main)

      if (fs.existsSync(entryPath)) {
        const mod = await import(entryPath)
        return mod.default || mod
      }
    }

    // Try common entry points
    for (const filename of ["index.js", "index.mjs", "dist/index.js"]) {
      const filePath = path.join(resolvedPath, filename)
      if (fs.existsSync(filePath)) {
        const mod = await import(filePath)
        return mod.default || mod
      }
    }

    throw new Error(`Could not find brand kit at: ${source}`)
  }

  // Load from npm package
  try {
    const mod = await import(source)
    return mod.default || mod
  } catch {
    throw new Error(`Could not load brand kit package: ${source}`)
  }
}

// =============================================================================
// MAIN DOCS FUNCTION
// =============================================================================

/**
 * Generate token documentation (Feature #80)
 */
export async function generateDocs(options: DocsOptions): Promise<string> {
  const tokens = await loadBrandKit(options.source)

  let content: string

  switch (options.format) {
    case "html":
      content = generateHtml(tokens, options.visual)
      break
    case "json":
      content = generateJson(tokens)
      break
    default:
      content = generateMarkdown(tokens, options.visual)
  }

  // Write to file or stdout
  if (options.output) {
    const outputPath = path.resolve(process.cwd(), options.output)
    fs.writeFileSync(outputPath, content, "utf-8")
    console.log(`\n✅ Documentation generated: ${outputPath}\n`)
  } else {
    console.log(content)
  }

  return content
}

// =============================================================================
// CLI ENTRY POINT
// =============================================================================

export async function main(): Promise<void> {
  const args = process.argv.slice(2)

  // Handle help
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: platxa-docs [source] [options]

Generate token reference documentation from a brand kit.

Arguments:
  source                Package name, path, or 'builtin' (default: builtin)

Options:
  --output, -o <file>   Output file path (stdout if not specified)
  --format, -f <type>   Output format: markdown, html, json (default: markdown)
  --no-visual           Skip visual examples
  -h, --help            Show this help

Examples:
  platxa-docs
  platxa-docs --output docs/TOKENS.md
  platxa-docs @acme/brand-kit -o tokens.html -f html
  platxa-docs ./my-brand-kit --format json
`)
    process.exit(0)
  }

  // Parse arguments
  let source = "builtin"
  let output: string | undefined
  let format: DocsOptions["format"] = "markdown"
  let visual = true

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === "--output" || arg === "-o") {
      output = args[++i]
    } else if (arg === "--format" || arg === "-f") {
      const f = args[++i]
      if (["markdown", "html", "json"].includes(f)) {
        format = f as DocsOptions["format"]
      }
    } else if (arg === "--no-visual") {
      visual = false
    } else if (!arg.startsWith("-")) {
      source = arg
    }
  }

  try {
    await generateDocs({ source, output, format, visual })
    process.exit(0)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`\n❌ Error: ${message}\n`)
    process.exit(1)
  }
}

// Run if executed directly
const isMain =
  typeof require !== "undefined"
    ? require.main === module
    : import.meta.url === `file://${process.argv[1]}`

if (isMain) {
  main().catch(console.error)
}
