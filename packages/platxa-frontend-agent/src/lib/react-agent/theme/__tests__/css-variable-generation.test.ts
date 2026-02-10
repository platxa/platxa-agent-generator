/**
 * CSS Variable Generation Tests (Feature #25)
 *
 * Tests for comprehensive CSS custom property generation from brand tokens.
 * Verification criteria:
 * - All semantic colors as CSS vars
 * - Spacing as CSS vars
 * - Typography as CSS vars
 */

import { describe, it, expect } from "vitest"
import {
  generateColorVariables,
  generateSpacingVariables,
  generateTypographyVariables,
  generateFontFamilyVariables,
  generateFontWeightVariables,
  generateRadiusVariables,
  generateShadowVariables,
  generateAllCssVariables,
  generateCss,
} from "../theme-worker"
import type { DesignTokens, SemanticColors } from "../types"

// =============================================================================
// TEST FIXTURES
// =============================================================================

const testSemanticColors: SemanticColors = {
  background: "hsl(0 0% 100%)",
  foreground: "hsl(222.2 84% 4.9%)",
  card: "hsl(0 0% 100%)",
  cardForeground: "hsl(222.2 84% 4.9%)",
  popover: "hsl(0 0% 100%)",
  popoverForeground: "hsl(222.2 84% 4.9%)",
  primary: "hsl(222.2 47.4% 11.2%)",
  primaryForeground: "hsl(210 40% 98%)",
  secondary: "hsl(210 40% 96.1%)",
  secondaryForeground: "hsl(222.2 47.4% 11.2%)",
  muted: "hsl(210 40% 96.1%)",
  mutedForeground: "hsl(215.4 16.3% 46.9%)",
  accent: "hsl(210 40% 96.1%)",
  accentForeground: "hsl(222.2 47.4% 11.2%)",
  destructive: "hsl(0 84.2% 60.2%)",
  destructiveForeground: "hsl(210 40% 98%)",
  border: "hsl(214.3 31.8% 91.4%)",
  input: "hsl(214.3 31.8% 91.4%)",
  ring: "hsl(222.2 84% 4.9%)",
}

const testSpacing = {
  0: "0px",
  0.5: "0.125rem",
  1: "0.25rem",
  2: "0.5rem",
  4: "1rem",
  8: "2rem",
  16: "4rem",
}

const testTypography = {
  xs: { fontSize: "0.75rem", lineHeight: "1rem" },
  sm: { fontSize: "0.875rem", lineHeight: "1.25rem" },
  base: { fontSize: "1rem", lineHeight: "1.5rem" },
  lg: { fontSize: "1.125rem", lineHeight: "1.75rem" },
  xl: { fontSize: "1.25rem", lineHeight: "1.75rem" },
  "2xl": { fontSize: "1.5rem", lineHeight: "2rem" },
}

const testFontFamily = {
  sans: "Inter, system-ui, sans-serif",
  serif: "Georgia, serif",
  mono: "Fira Code, monospace",
}

const testFontWeight = {
  thin: 100,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
}

const testRadius = {
  none: "0px",
  sm: "0.125rem",
  default: "0.25rem",
  md: "0.375rem",
  lg: "0.5rem",
  xl: "0.75rem",
  full: "9999px",
}

const testShadow = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  default: "0 1px 3px 0 rgb(0 0 0 / 0.1)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
}

const createTestTokens = (): DesignTokens => ({
  colors: testSemanticColors,
  spacing: testSpacing,
  typography: testTypography,
  fontFamily: testFontFamily,
  fontWeight: testFontWeight,
  radius: testRadius,
  shadow: testShadow,
})

// =============================================================================
// generateColorVariables
// =============================================================================

describe("generateColorVariables", () => {
  it("should generate CSS variables for all semantic colors", () => {
    const result = generateColorVariables(testSemanticColors)

    expect(result["--background"]).toBe("hsl(0 0% 100%)")
    expect(result["--foreground"]).toBe("hsl(222.2 84% 4.9%)")
    expect(result["--primary"]).toBe("hsl(222.2 47.4% 11.2%)")
    expect(result["--secondary"]).toBe("hsl(210 40% 96.1%)")
    expect(result["--destructive"]).toBe("hsl(0 84.2% 60.2%)")
  })

  it("should convert camelCase to kebab-case", () => {
    const result = generateColorVariables(testSemanticColors)

    expect(result["--primary-foreground"]).toBe("hsl(210 40% 98%)")
    expect(result["--secondary-foreground"]).toBe("hsl(222.2 47.4% 11.2%)")
    expect(result["--muted-foreground"]).toBe("hsl(215.4 16.3% 46.9%)")
    expect(result["--card-foreground"]).toBe("hsl(222.2 84% 4.9%)")
  })

  it("should support custom prefix", () => {
    const result = generateColorVariables(testSemanticColors, "color")

    expect(result["--color-background"]).toBe("hsl(0 0% 100%)")
    expect(result["--color-primary"]).toBe("hsl(222.2 47.4% 11.2%)")
  })
})

// =============================================================================
// generateSpacingVariables (Feature #25)
// =============================================================================

describe("generateSpacingVariables (Feature #25)", () => {
  it("should generate CSS variables for spacing values", () => {
    const result = generateSpacingVariables(testSpacing)

    expect(result["--spacing-0"]).toBe("0px")
    expect(result["--spacing-1"]).toBe("0.25rem")
    expect(result["--spacing-2"]).toBe("0.5rem")
    expect(result["--spacing-4"]).toBe("1rem")
    expect(result["--spacing-8"]).toBe("2rem")
  })

  it("should handle decimal keys by replacing dots with underscores", () => {
    const result = generateSpacingVariables(testSpacing)

    // 0.5 becomes 0_5
    expect(result["--spacing-0_5"]).toBe("0.125rem")
  })

  it("should skip undefined values", () => {
    const result = generateSpacingVariables({ 1: "0.25rem", 2: undefined })

    expect(result["--spacing-1"]).toBe("0.25rem")
    expect(result["--spacing-2"]).toBeUndefined()
  })

  it("should return empty object for empty input", () => {
    const result = generateSpacingVariables({})

    expect(Object.keys(result)).toHaveLength(0)
  })
})

// =============================================================================
// generateTypographyVariables (Feature #25)
// =============================================================================

describe("generateTypographyVariables (Feature #25)", () => {
  it("should generate font-size CSS variables", () => {
    const result = generateTypographyVariables(testTypography)

    expect(result["--font-size-xs"]).toBe("0.75rem")
    expect(result["--font-size-sm"]).toBe("0.875rem")
    expect(result["--font-size-base"]).toBe("1rem")
    expect(result["--font-size-lg"]).toBe("1.125rem")
    expect(result["--font-size-xl"]).toBe("1.25rem")
    expect(result["--font-size-2xl"]).toBe("1.5rem")
  })

  it("should generate line-height CSS variables", () => {
    const result = generateTypographyVariables(testTypography)

    expect(result["--line-height-xs"]).toBe("1rem")
    expect(result["--line-height-sm"]).toBe("1.25rem")
    expect(result["--line-height-base"]).toBe("1.5rem")
    expect(result["--line-height-lg"]).toBe("1.75rem")
  })

  it("should handle partial typography objects", () => {
    const partial = {
      base: { fontSize: "1rem", lineHeight: "1.5rem" },
    }
    const result = generateTypographyVariables(partial)

    expect(result["--font-size-base"]).toBe("1rem")
    expect(result["--line-height-base"]).toBe("1.5rem")
    expect(Object.keys(result)).toHaveLength(2)
  })

  it("should return empty object for empty input", () => {
    const result = generateTypographyVariables({})

    expect(Object.keys(result)).toHaveLength(0)
  })
})

// =============================================================================
// generateFontFamilyVariables (Feature #25)
// =============================================================================

describe("generateFontFamilyVariables (Feature #25)", () => {
  it("should generate font family CSS variables", () => {
    const result = generateFontFamilyVariables(testFontFamily)

    expect(result["--font-sans"]).toBe("Inter, system-ui, sans-serif")
    expect(result["--font-serif"]).toBe("Georgia, serif")
    expect(result["--font-mono"]).toBe("Fira Code, monospace")
  })

  it("should skip undefined values", () => {
    const result = generateFontFamilyVariables({ sans: "Inter", serif: undefined })

    expect(result["--font-sans"]).toBe("Inter")
    expect(result["--font-serif"]).toBeUndefined()
  })

  it("should return empty object for undefined input", () => {
    const result = generateFontFamilyVariables(undefined)

    expect(Object.keys(result)).toHaveLength(0)
  })
})

// =============================================================================
// generateFontWeightVariables (Feature #25)
// =============================================================================

describe("generateFontWeightVariables (Feature #25)", () => {
  it("should generate font weight CSS variables", () => {
    const result = generateFontWeightVariables(testFontWeight)

    expect(result["--font-weight-thin"]).toBe("100")
    expect(result["--font-weight-normal"]).toBe("400")
    expect(result["--font-weight-medium"]).toBe("500")
    expect(result["--font-weight-semibold"]).toBe("600")
    expect(result["--font-weight-bold"]).toBe("700")
  })

  it("should convert numeric values to strings", () => {
    const result = generateFontWeightVariables({ normal: 400 })

    expect(typeof result["--font-weight-normal"]).toBe("string")
    expect(result["--font-weight-normal"]).toBe("400")
  })

  it("should return empty object for empty input", () => {
    const result = generateFontWeightVariables({})

    expect(Object.keys(result)).toHaveLength(0)
  })
})

// =============================================================================
// generateRadiusVariables (Feature #25)
// =============================================================================

describe("generateRadiusVariables (Feature #25)", () => {
  it("should generate border radius CSS variables", () => {
    const result = generateRadiusVariables(testRadius)

    expect(result["--radius-none"]).toBe("0px")
    expect(result["--radius-sm"]).toBe("0.125rem")
    expect(result["--radius-default"]).toBe("0.25rem")
    expect(result["--radius-md"]).toBe("0.375rem")
    expect(result["--radius-lg"]).toBe("0.5rem")
    expect(result["--radius-xl"]).toBe("0.75rem")
    expect(result["--radius-full"]).toBe("9999px")
  })

  it("should skip undefined values", () => {
    const result = generateRadiusVariables({ sm: "0.125rem", md: undefined })

    expect(result["--radius-sm"]).toBe("0.125rem")
    expect(result["--radius-md"]).toBeUndefined()
  })
})

// =============================================================================
// generateShadowVariables (Feature #25)
// =============================================================================

describe("generateShadowVariables (Feature #25)", () => {
  it("should generate box shadow CSS variables", () => {
    const result = generateShadowVariables(testShadow)

    expect(result["--shadow-sm"]).toBe("0 1px 2px 0 rgb(0 0 0 / 0.05)")
    expect(result["--shadow-md"]).toBe("0 4px 6px -1px rgb(0 0 0 / 0.1)")
    expect(result["--shadow-lg"]).toBe("0 10px 15px -3px rgb(0 0 0 / 0.1)")
  })

  it("should convert 'default' key to 'DEFAULT'", () => {
    const result = generateShadowVariables(testShadow)

    expect(result["--shadow-DEFAULT"]).toBe("0 1px 3px 0 rgb(0 0 0 / 0.1)")
    expect(result["--shadow-default"]).toBeUndefined()
  })

  it("should skip undefined values", () => {
    const result = generateShadowVariables({ sm: "shadow", lg: undefined })

    expect(result["--shadow-sm"]).toBe("shadow")
    expect(result["--shadow-lg"]).toBeUndefined()
  })
})

// =============================================================================
// generateAllCssVariables (Feature #25)
// =============================================================================

describe("generateAllCssVariables (Feature #25)", () => {
  it("should combine all token categories into one object", () => {
    const tokens = createTestTokens()
    const result = generateAllCssVariables(tokens)

    // Should include colors
    expect(result["--background"]).toBeDefined()
    expect(result["--primary"]).toBeDefined()

    // Should include spacing
    expect(result["--spacing-1"]).toBeDefined()
    expect(result["--spacing-4"]).toBeDefined()

    // Should include typography
    expect(result["--font-size-base"]).toBeDefined()
    expect(result["--line-height-base"]).toBeDefined()

    // Should include font family
    expect(result["--font-sans"]).toBeDefined()
    expect(result["--font-mono"]).toBeDefined()

    // Should include font weights
    expect(result["--font-weight-normal"]).toBeDefined()
    expect(result["--font-weight-bold"]).toBeDefined()

    // Should include radius
    expect(result["--radius-sm"]).toBeDefined()
    expect(result["--radius-lg"]).toBeDefined()

    // Should include shadows
    expect(result["--shadow-sm"]).toBeDefined()
    expect(result["--shadow-lg"]).toBeDefined()
  })
})

// =============================================================================
// generateCss (Feature #25 Enhancement)
// =============================================================================

describe("generateCss (Feature #25 Enhancement)", () => {
  it("should generate complete CSS with all token categories", () => {
    const tokens = createTestTokens()
    const css = generateCss(tokens)

    // Should have :root selector
    expect(css).toContain(":root {")
    expect(css).toContain("}")

    // Should have section comments
    expect(css).toContain("/* Semantic Colors */")
    expect(css).toContain("/* Spacing Scale */")
    expect(css).toContain("/* Typography Scale */")
    expect(css).toContain("/* Font Families */")
    expect(css).toContain("/* Font Weights */")
    expect(css).toContain("/* Border Radius */")
    expect(css).toContain("/* Box Shadows */")
  })

  it("should include semantic color variables", () => {
    const tokens = createTestTokens()
    const css = generateCss(tokens)

    expect(css).toContain("--background: hsl(0 0% 100%);")
    expect(css).toContain("--primary: hsl(222.2 47.4% 11.2%);")
    expect(css).toContain("--secondary: hsl(210 40% 96.1%);")
  })

  it("should include spacing variables", () => {
    const tokens = createTestTokens()
    const css = generateCss(tokens)

    expect(css).toContain("--spacing-1: 0.25rem;")
    expect(css).toContain("--spacing-4: 1rem;")
    expect(css).toContain("--spacing-8: 2rem;")
  })

  it("should include typography variables", () => {
    const tokens = createTestTokens()
    const css = generateCss(tokens)

    expect(css).toContain("--font-size-base: 1rem;")
    expect(css).toContain("--line-height-base: 1.5rem;")
    expect(css).toContain("--font-size-lg: 1.125rem;")
  })

  it("should include font family variables", () => {
    const tokens = createTestTokens()
    const css = generateCss(tokens)

    expect(css).toContain("--font-sans: Inter, system-ui, sans-serif;")
    expect(css).toContain("--font-serif: Georgia, serif;")
    expect(css).toContain("--font-mono: Fira Code, monospace;")
  })

  it("should include font weight variables", () => {
    const tokens = createTestTokens()
    const css = generateCss(tokens)

    expect(css).toContain("--font-weight-normal: 400;")
    expect(css).toContain("--font-weight-bold: 700;")
  })

  it("should include radius variables and --radius shorthand", () => {
    const tokens = createTestTokens()
    const css = generateCss(tokens)

    expect(css).toContain("--radius-sm: 0.125rem;")
    expect(css).toContain("--radius-lg: 0.5rem;")
    expect(css).toContain("--radius: 0.5rem;") // Shorthand from lg
  })

  it("should include shadow variables", () => {
    const tokens = createTestTokens()
    const css = generateCss(tokens)

    expect(css).toContain("--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);")
    expect(css).toContain("--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);")
  })

  it("should support custom selector", () => {
    const tokens = createTestTokens()
    const css = generateCss(tokens, ".custom-theme")

    expect(css).toContain(".custom-theme {")
    expect(css).not.toContain(":root {")
  })

  it("should skip sections with empty values", () => {
    const tokens: DesignTokens = {
      colors: testSemanticColors,
      spacing: {},
      typography: {},
      fontWeight: {},
      radius: {},
      shadow: {},
    }
    const css = generateCss(tokens)

    expect(css).toContain("/* Semantic Colors */")
    expect(css).not.toContain("/* Spacing Scale */")
    expect(css).not.toContain("/* Typography Scale */")
    expect(css).not.toContain("/* Font Families */")
    expect(css).not.toContain("/* Font Weights */")
    expect(css).not.toContain("/* Border Radius */")
    expect(css).not.toContain("/* Box Shadows */")
  })
})
