/**
 * Tailwind @theme Generation Tests (Feature #26)
 *
 * Tests for Tailwind v4 @theme directive generation from brand tokens.
 * Verification criteria:
 * - @theme block generated
 * - Colors mapped to Tailwind format (--color-*)
 * - Compatible with Tailwind v4
 */

import { describe, it, expect } from "vitest"
import { generateTailwindTheme } from "../theme-worker"
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
  1: "0.25rem",
  2: "0.5rem",
  4: "1rem",
  8: "2rem",
}

const testTypography = {
  xs: { fontSize: "0.75rem", lineHeight: "1rem" },
  sm: { fontSize: "0.875rem", lineHeight: "1.25rem" },
  base: { fontSize: "1rem", lineHeight: "1.5rem" },
  lg: { fontSize: "1.125rem", lineHeight: "1.75rem" },
}

const testFontFamily = {
  sans: "Inter, system-ui, sans-serif",
  serif: "Georgia, serif",
  mono: "Fira Code, monospace",
}

const testFontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
}

const testRadius = {
  none: "0px",
  sm: "0.125rem",
  md: "0.375rem",
  lg: "0.5rem",
}

const testShadow = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  default: "0 1px 3px 0 rgb(0 0 0 / 0.1)",
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
// generateTailwindTheme (Feature #26)
// =============================================================================

describe("generateTailwindTheme (Feature #26)", () => {
  describe("@theme block structure", () => {
    it("should generate valid @theme block", () => {
      const tokens = createTestTokens()
      const result = generateTailwindTheme(tokens)

      expect(result).toContain("@theme {")
      expect(result).toContain("}")
      // Verify proper closing
      expect(result.trim().endsWith("}")).toBe(true)
    })

    it("should include section comments", () => {
      const tokens = createTestTokens()
      const result = generateTailwindTheme(tokens)

      expect(result).toContain("/* Semantic Colors */")
      expect(result).toContain("/* Spacing Scale */")
      expect(result).toContain("/* Typography Scale */")
      expect(result).toContain("/* Font Families */")
      expect(result).toContain("/* Font Weights */")
      expect(result).toContain("/* Border Radius */")
      expect(result).toContain("/* Shadows */")
    })
  })

  describe("Colors (--color-*)", () => {
    it("should map colors to Tailwind format with --color- prefix", () => {
      const tokens = createTestTokens()
      const result = generateTailwindTheme(tokens)

      // Tailwind v4 requires --color- prefix
      expect(result).toContain("--color-background: hsl(0 0% 100%);")
      expect(result).toContain("--color-foreground: hsl(222.2 84% 4.9%);")
      expect(result).toContain("--color-primary: hsl(222.2 47.4% 11.2%);")
      expect(result).toContain("--color-secondary: hsl(210 40% 96.1%);")
    })

    it("should convert camelCase to kebab-case with color prefix", () => {
      const tokens = createTestTokens()
      const result = generateTailwindTheme(tokens)

      expect(result).toContain("--color-primary-foreground:")
      expect(result).toContain("--color-secondary-foreground:")
      expect(result).toContain("--color-muted-foreground:")
    })
  })

  describe("Spacing (--spacing-*)", () => {
    it("should include spacing variables", () => {
      const tokens = createTestTokens()
      const result = generateTailwindTheme(tokens)

      expect(result).toContain("--spacing-0: 0px;")
      expect(result).toContain("--spacing-1: 0.25rem;")
      expect(result).toContain("--spacing-2: 0.5rem;")
      expect(result).toContain("--spacing-4: 1rem;")
      expect(result).toContain("--spacing-8: 2rem;")
    })

    it("should skip spacing section when empty", () => {
      const tokens: DesignTokens = {
        ...createTestTokens(),
        spacing: {},
      }
      const result = generateTailwindTheme(tokens)

      expect(result).not.toContain("/* Spacing Scale */")
    })
  })

  describe("Typography (--text-*)", () => {
    it("should include typography with Tailwind v4 --text- prefix", () => {
      const tokens = createTestTokens()
      const result = generateTailwindTheme(tokens)

      // Tailwind v4 uses --text-{size} for font sizes
      expect(result).toContain("--text-xs: 0.75rem;")
      expect(result).toContain("--text-sm: 0.875rem;")
      expect(result).toContain("--text-base: 1rem;")
      expect(result).toContain("--text-lg: 1.125rem;")
    })

    it("should include line heights with --text-{size}--line-height format", () => {
      const tokens = createTestTokens()
      const result = generateTailwindTheme(tokens)

      // Tailwind v4 uses --text-{size}--line-height for line heights
      expect(result).toContain("--text-xs--line-height: 1rem;")
      expect(result).toContain("--text-sm--line-height: 1.25rem;")
      expect(result).toContain("--text-base--line-height: 1.5rem;")
      expect(result).toContain("--text-lg--line-height: 1.75rem;")
    })

    it("should skip typography section when empty", () => {
      const tokens: DesignTokens = {
        ...createTestTokens(),
        typography: {},
      }
      const result = generateTailwindTheme(tokens)

      expect(result).not.toContain("/* Typography Scale */")
    })
  })

  describe("Font Families (--font-*)", () => {
    it("should include font family variables", () => {
      const tokens = createTestTokens()
      const result = generateTailwindTheme(tokens)

      expect(result).toContain("--font-sans: Inter, system-ui, sans-serif;")
      expect(result).toContain("--font-serif: Georgia, serif;")
      expect(result).toContain("--font-mono: Fira Code, monospace;")
    })

    it("should skip font families section when undefined", () => {
      const tokens: DesignTokens = {
        ...createTestTokens(),
        fontFamily: undefined,
      }
      const result = generateTailwindTheme(tokens)

      expect(result).not.toContain("/* Font Families */")
    })
  })

  describe("Font Weights (--font-weight-*)", () => {
    it("should include font weight variables", () => {
      const tokens = createTestTokens()
      const result = generateTailwindTheme(tokens)

      expect(result).toContain("--font-weight-normal: 400;")
      expect(result).toContain("--font-weight-medium: 500;")
      expect(result).toContain("--font-weight-semibold: 600;")
      expect(result).toContain("--font-weight-bold: 700;")
    })

    it("should skip font weights section when empty", () => {
      const tokens: DesignTokens = {
        ...createTestTokens(),
        fontWeight: {},
      }
      const result = generateTailwindTheme(tokens)

      expect(result).not.toContain("/* Font Weights */")
    })
  })

  describe("Border Radius (--radius-*)", () => {
    it("should include radius variables", () => {
      const tokens = createTestTokens()
      const result = generateTailwindTheme(tokens)

      expect(result).toContain("--radius-none: 0px;")
      expect(result).toContain("--radius-sm: 0.125rem;")
      expect(result).toContain("--radius-md: 0.375rem;")
      expect(result).toContain("--radius-lg: 0.5rem;")
    })
  })

  describe("Shadows (--shadow-*)", () => {
    it("should include shadow variables", () => {
      const tokens = createTestTokens()
      const result = generateTailwindTheme(tokens)

      expect(result).toContain("--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);")
      expect(result).toContain("--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);")
    })

    it("should convert 'default' key to 'DEFAULT'", () => {
      const tokens = createTestTokens()
      const result = generateTailwindTheme(tokens)

      expect(result).toContain("--shadow-DEFAULT: 0 1px 3px 0 rgb(0 0 0 / 0.1);")
      expect(result).not.toContain("--shadow-default:")
    })

    it("should skip shadows section when undefined", () => {
      const tokens: DesignTokens = {
        ...createTestTokens(),
        shadow: {},
      }
      const result = generateTailwindTheme(tokens)

      expect(result).not.toContain("/* Shadows */")
    })
  })

  describe("Tailwind v4 Compatibility", () => {
    it("should generate valid CSS that can be parsed", () => {
      const tokens = createTestTokens()
      const result = generateTailwindTheme(tokens)

      // Check that all lines have proper CSS syntax
      const lines = result.split("\n")
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith("/*") && !trimmed.startsWith("@") && trimmed !== "}") {
          // Property lines should have : and end with ;
          expect(trimmed).toMatch(/^--[\w-]+:\s*.+;$/)
        }
      }
    })

    it("should use consistent naming conventions", () => {
      const tokens = createTestTokens()
      const result = generateTailwindTheme(tokens)

      // Verify Tailwind v4 naming conventions:
      // - Colors use --color-*
      // - Spacing uses --spacing-*
      // - Typography uses --text-* and --text-*--line-height
      // - Font families use --font-*
      // - Font weights use --font-weight-*
      // - Radius uses --radius-*
      // - Shadows use --shadow-*

      expect(result).toMatch(/--color-\w+:/)
      expect(result).toMatch(/--spacing-\d+:/)
      expect(result).toMatch(/--text-\w+:/)
      expect(result).toMatch(/--text-\w+--line-height:/)
      expect(result).toMatch(/--font-\w+:/)
      expect(result).toMatch(/--font-weight-\w+:/)
      expect(result).toMatch(/--radius-\w+:/)
      expect(result).toMatch(/--shadow-\w+:/)
    })

    it("should be importable in Tailwind v4 CSS files", () => {
      const tokens = createTestTokens()
      const result = generateTailwindTheme(tokens)

      // The @theme block should be valid for Tailwind v4
      // It should start with @theme { and end with }
      expect(result.trim().startsWith("@theme {")).toBe(true)
      expect(result.trim().endsWith("}")).toBe(true)
    })
  })
})
