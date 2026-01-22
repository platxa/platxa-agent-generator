/**
 * PostCSS Plugin - Tests
 *
 * Tests the PostCSS plugin for brand token processing:
 * - Token transformation
 * - Custom property injection
 * - Theme variant generation
 * - @platxa directive handling
 */

import { describe, it, expect, vi } from "vitest"
import postcss from "postcss"
import {
  platxaTokens,
  postcssPluginPlatxa,
  type PlatxaPostCSSOptions,
} from "../postcss"

// Mock the config loader to avoid file system dependencies
vi.mock("../brand/config-loader", () => ({
  findAndLoadConfig: vi.fn().mockResolvedValue({ config: null, path: null }),
}))

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Process CSS with the plugin
 */
async function process(
  css: string,
  options: PlatxaPostCSSOptions = {}
): Promise<string> {
  const result = await postcss([platxaTokens(options)]).process(css, {
    from: undefined,
  })
  return result.css
}

/**
 * Check if output contains expected CSS variable
 */
function containsVar(css: string, varName: string): boolean {
  return css.includes(`--${varName}:`) || css.includes(`var(--${varName})`)
}

// ============================================================================
// Plugin Export Tests
// ============================================================================

describe("PostCSS Plugin Exports", () => {
  it("should export platxaTokens function", () => {
    expect(typeof platxaTokens).toBe("function")
  })

  it("should export postcssPluginPlatxa alias", () => {
    expect(postcssPluginPlatxa).toBe(platxaTokens)
  })

  it("should have postcss property set to true", () => {
    expect(platxaTokens.postcss).toBe(true)
  })

  it("should return a valid PostCSS plugin", () => {
    const plugin = platxaTokens() as { postcssPlugin: string }
    expect(plugin.postcssPlugin).toBe("postcss-platxa-tokens")
  })
})

// ============================================================================
// Token Injection Tests
// ============================================================================

describe("Token Injection", () => {
  it("should inject tokens when injectTokens is true (default)", async () => {
    const css = ".button { color: red; }"
    const result = await process(css, { injectTokens: true })

    // Should contain :root with CSS variables
    expect(result).toContain(":root")
    expect(containsVar(result, "primary")).toBe(true)
    expect(containsVar(result, "background")).toBe(true)
  })

  it("should not inject tokens when injectTokens is false", async () => {
    const css = ".button { color: red; }"
    const result = await process(css, { injectTokens: false })

    // Should only contain the original CSS
    expect(result).toBe(css)
  })

  it("should apply prefix to CSS variables when specified", async () => {
    const css = ".button { color: red; }"
    const result = await process(css, {
      injectTokens: true,
      prefix: "brand",
    })

    // Should contain prefixed variables
    expect(containsVar(result, "brand-primary")).toBe(true)
    expect(containsVar(result, "brand-background")).toBe(true)
  })
})

// ============================================================================
// Theme Variant Generation Tests
// ============================================================================

describe("Theme Variant Generation", () => {
  it("should generate dark mode class variant by default", async () => {
    const css = ".button { color: red; }"
    const result = await process(css, {
      injectTokens: true,
      generateVariants: true,
      darkModeStrategy: "class",
    })

    // Should contain .dark selector
    expect(result).toContain(".dark")
  })

  it("should generate dark mode media query when strategy is media", async () => {
    const css = ".button { color: red; }"
    const result = await process(css, {
      injectTokens: true,
      generateVariants: true,
      darkModeStrategy: "media",
    })

    // Should contain prefers-color-scheme media query
    expect(result).toContain("@media (prefers-color-scheme: dark)")
  })

  it("should generate both class and media when strategy is both", async () => {
    const css = ".button { color: red; }"
    const result = await process(css, {
      injectTokens: true,
      generateVariants: true,
      darkModeStrategy: "both",
    })

    // Should contain both
    expect(result).toContain(".dark")
    expect(result).toContain("@media (prefers-color-scheme: dark)")
  })

  it("should use custom dark mode selector", async () => {
    const css = ".button { color: red; }"
    const result = await process(css, {
      injectTokens: true,
      generateVariants: true,
      darkModeStrategy: "class",
      darkModeSelector: "[data-theme='dark']",
    })

    // Should contain custom selector
    expect(result).toContain("[data-theme='dark']")
  })

  it("should not generate variants when generateVariants is false", async () => {
    const css = ".button { color: red; }"
    const result = await process(css, {
      injectTokens: true,
      generateVariants: false,
    })

    // Should not contain .dark or media query
    expect(result).not.toContain(".dark {")
    expect(result).not.toContain("@media (prefers-color-scheme: dark)")
  })
})

// ============================================================================
// @platxa Directive Tests
// ============================================================================

describe("@platxa Directive Processing", () => {
  it("should process @platxa tokens directive", async () => {
    const css = "@platxa tokens;\n.button { color: red; }"
    const result = await process(css, { injectTokens: false })

    // Should replace directive with CSS variables
    expect(result).toContain(":root")
    expect(containsVar(result, "primary")).toBe(true)
    expect(result).not.toContain("@platxa tokens")
  })

  it("should process @platxa theme directive", async () => {
    const css = "@platxa theme;\n.button { color: red; }"
    const result = await process(css, { injectTokens: false })

    // Should contain full theme including light and dark
    expect(result).toContain(":root")
    expect(result).toContain(".dark")
    expect(result).not.toContain("@platxa theme")
  })

  it("should process @platxa colors directive", async () => {
    const css = "@platxa colors;\n.button { color: red; }"
    const result = await process(css, { injectTokens: false })

    // Should only contain color variables
    expect(result).toContain(":root")
    expect(containsVar(result, "primary")).toBe(true)
    expect(result).not.toContain("@platxa colors")
  })

  it("should process @platxa spacing directive", async () => {
    const css = "@platxa spacing;\n.button { color: red; }"
    const result = await process(css, { injectTokens: false })

    // Should only contain spacing variables
    expect(result).toContain(":root")
    expect(result).not.toContain("@platxa spacing")
  })

  it("should process @platxa typography directive", async () => {
    const css = "@platxa typography;\n.button { color: red; }"
    const result = await process(css, { injectTokens: false })

    // Should only contain typography variables
    expect(result).toContain(":root")
    expect(result).not.toContain("@platxa typography")
  })

  it("should process @platxa light directive", async () => {
    const css = "@platxa light;\n.button { color: red; }"
    const result = await process(css, { injectTokens: false })

    // Should only generate light theme
    expect(result).toContain(":root")
    expect(result).not.toContain(".dark")
    expect(result).not.toContain("@platxa light")
  })

  it("should process @platxa dark directive", async () => {
    const css = "@platxa dark;\n.button { color: red; }"
    const result = await process(css, { injectTokens: false })

    // Should only generate dark theme
    expect(result).toContain(".dark")
    expect(result).not.toContain("@platxa dark")
  })

  it("should preserve @platxa directive when preserveAtRules is true", async () => {
    const css = "@platxa tokens;\n.button { color: red; }"
    const result = await process(css, {
      injectTokens: false,
      preserveAtRules: true,
    })

    // Should still have the at-rule (commented or preserved)
    expect(result).toContain(":root")
  })
})

// ============================================================================
// Token Reference Transformation Tests
// ============================================================================

describe("Token Reference Transformation", () => {
  it("should transform brand() references to CSS var()", async () => {
    const css = ".button { background: brand(primary); }"
    const result = await process(css, { injectTokens: false })

    // Should transform to var(--primary)
    expect(result).toContain("var(--primary)")
    expect(result).not.toContain("brand(primary)")
  })

  it("should transform token() references to CSS var()", async () => {
    const css = ".button { color: token(foreground); }"
    const result = await process(css, { injectTokens: false })

    // Should transform to var(--foreground)
    expect(result).toContain("var(--foreground)")
    expect(result).not.toContain("token(foreground)")
  })

  it("should transform platxa() references to CSS var()", async () => {
    const css = ".button { border-color: platxa(border); }"
    const result = await process(css, { injectTokens: false })

    // Should transform to var(--border)
    expect(result).toContain("var(--border)")
    expect(result).not.toContain("platxa(border)")
  })

  it("should transform namespaced token references", async () => {
    const css = ".button { padding: token(spacing.md); }"
    const result = await process(css, { injectTokens: false })

    // md maps to spacing scale 4, so output is var(--spacing-4)
    expect(result).toContain("var(--spacing-4)")
  })

  it("should apply prefix to transformed references", async () => {
    const css = ".button { background: brand(primary); }"
    const result = await process(css, {
      injectTokens: false,
      prefix: "brand",
    })

    // Should use prefixed variable
    expect(result).toContain("var(--brand-primary)")
  })

  it("should transform multiple references in one value", async () => {
    const css = ".box { padding: token(spacing.sm) token(spacing.md); }"
    const result = await process(css, { injectTokens: false })

    // sm maps to 2, md maps to 4
    expect(result).toContain("var(--spacing-2)")
    expect(result).toContain("var(--spacing-4)")
  })

  it("should keep unknown token references unchanged", async () => {
    const css = ".button { color: brand(unknownToken); }"
    const result = await process(css, { injectTokens: false, verbose: false })

    // Should keep the original (since token doesn't exist)
    expect(result).toContain("brand(unknownToken)")
  })
})

// ============================================================================
// CSS Variable Generation Tests
// ============================================================================

describe("CSS Variable Generation", () => {
  it("should generate semantic color variables", async () => {
    const css = "@platxa colors;"
    const result = await process(css, { injectTokens: false })

    // Check for key semantic colors
    expect(containsVar(result, "primary")).toBe(true)
    expect(containsVar(result, "secondary")).toBe(true)
    expect(containsVar(result, "background")).toBe(true)
    expect(containsVar(result, "foreground")).toBe(true)
    expect(containsVar(result, "muted")).toBe(true)
    expect(containsVar(result, "accent")).toBe(true)
    expect(containsVar(result, "destructive")).toBe(true)
    expect(containsVar(result, "border")).toBe(true)
  })

  it("should generate spacing variables", async () => {
    const css = "@platxa spacing;"
    const result = await process(css, { injectTokens: false })

    // Check for spacing scale
    expect(containsVar(result, "spacing-0")).toBe(true)
    expect(containsVar(result, "spacing-1")).toBe(true)
    expect(containsVar(result, "spacing-2")).toBe(true)
    expect(containsVar(result, "spacing-4")).toBe(true)
  })

  it("should generate typography variables", async () => {
    const css = "@platxa typography;"
    const result = await process(css, { injectTokens: false })

    // Check for font variables
    expect(containsVar(result, "font-sans")).toBe(true)
  })

  it("should generate radius variable", async () => {
    const css = "@platxa tokens;"
    const result = await process(css, { injectTokens: false })

    // Check for radius
    expect(containsVar(result, "radius")).toBe(true)
  })
})

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe("Edge Cases", () => {
  it("should handle empty CSS input", async () => {
    const css = ""
    const result = await process(css, { injectTokens: false })
    expect(result).toBe("")
  })

  it("should handle CSS without any token references", async () => {
    const css = ".button { color: red; padding: 10px; }"
    const result = await process(css, { injectTokens: false })
    expect(result).toBe(css)
  })

  it("should handle multiple @platxa directives", async () => {
    const css = "@platxa colors;\n@platxa spacing;\n.button { color: red; }"
    const result = await process(css, { injectTokens: false })

    // Should process both directives
    expect(containsVar(result, "primary")).toBe(true)
    expect(containsVar(result, "spacing-1")).toBe(true)
  })

  it("should not break on malformed token references", async () => {
    const css = ".button { color: brand(); }"
    const result = await process(css, { injectTokens: false })

    // Should keep original (malformed reference)
    expect(result).toContain("brand()")
  })

  it("should handle CSS comments around directives", async () => {
    const css = "/* Theme tokens */\n@platxa tokens;\n/* Button styles */\n.button { color: red; }"
    const result = await process(css, { injectTokens: false })

    // Should preserve comments and process directive
    expect(result).toContain("/* Theme tokens */")
    expect(result).toContain("/* Button styles */")
    expect(result).toContain(":root")
  })
})

// ============================================================================
// Integration Tests
// ============================================================================

describe("Integration", () => {
  it("should work with complex real-world CSS", async () => {
    const css = `
@platxa theme;

.card {
  background: brand(card);
  color: brand(cardForeground);
  border: 1px solid brand(border);
  border-radius: token(radius.lg);
  padding: token(spacing.4);
}

.card-header {
  border-bottom: 1px solid brand(border);
  padding-bottom: token(spacing.2);
}

.btn-primary {
  background: brand(primary);
  color: brand(primaryForeground);
}

.btn-primary:hover {
  opacity: 0.9;
}
`
    const result = await process(css, { injectTokens: false })

    // Should have theme CSS
    expect(result).toContain(":root")
    expect(result).toContain(".dark")

    // Should transform all references
    expect(result).toContain("var(--card)")
    expect(result).toContain("var(--card-foreground)")
    expect(result).toContain("var(--border)")
    expect(result).toContain("var(--primary)")
    expect(result).toContain("var(--primary-foreground)")

    // Should preserve non-token CSS
    expect(result).toContain(".btn-primary:hover")
    expect(result).toContain("opacity: 0.9")
  })

  it("should work with Tailwind-style utility classes", async () => {
    const css = `
@platxa tokens;

@layer utilities {
  .text-primary {
    color: brand(primary);
  }

  .bg-background {
    background-color: brand(background);
  }
}
`
    const result = await process(css, { injectTokens: false })

    // Should process tokens within @layer
    expect(result).toContain("var(--primary)")
    expect(result).toContain("var(--background)")
    expect(result).toContain("@layer utilities")
  })
})
