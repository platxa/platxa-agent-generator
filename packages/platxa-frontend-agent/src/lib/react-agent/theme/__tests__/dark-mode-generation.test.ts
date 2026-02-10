/**
 * Dark Mode CSS Generation Tests (Feature #27)
 *
 * Tests for dark mode CSS override generation from brand themes.
 * Verification criteria:
 * - .dark selector generated
 * - All colors overridden for dark mode
 * - Media query fallback available
 */

import { describe, it, expect } from "vitest"
import {
  generateDarkModeCss,
  generateDarkModeMediaQuery,
  generateCompleteDarkMode,
} from "../theme-worker"
import type { SemanticColors } from "../types"

// =============================================================================
// TEST FIXTURES
// =============================================================================

const testDarkColors: Partial<SemanticColors> = {
  background: "hsl(222.2 84% 4.9%)",
  foreground: "hsl(210 40% 98%)",
  card: "hsl(222.2 84% 4.9%)",
  cardForeground: "hsl(210 40% 98%)",
  primary: "hsl(210 40% 98%)",
  primaryForeground: "hsl(222.2 47.4% 11.2%)",
  secondary: "hsl(217.2 32.6% 17.5%)",
  secondaryForeground: "hsl(210 40% 98%)",
  muted: "hsl(217.2 32.6% 17.5%)",
  mutedForeground: "hsl(215 20.2% 65.1%)",
  accent: "hsl(217.2 32.6% 17.5%)",
  accentForeground: "hsl(210 40% 98%)",
  destructive: "hsl(0 62.8% 30.6%)",
  destructiveForeground: "hsl(210 40% 98%)",
  border: "hsl(217.2 32.6% 17.5%)",
  input: "hsl(217.2 32.6% 17.5%)",
  ring: "hsl(212.7 26.8% 83.9%)",
}

// =============================================================================
// generateDarkModeCss
// =============================================================================

describe("generateDarkModeCss (Feature #27)", () => {
  describe(".dark selector generation", () => {
    it("should generate .dark selector by default", () => {
      const result = generateDarkModeCss(testDarkColors)

      expect(result).toContain(".dark {")
      expect(result).toContain("}")
    })

    it("should support custom selector", () => {
      const result = generateDarkModeCss(testDarkColors, "[data-theme='dark']")

      expect(result).toContain("[data-theme='dark'] {")
      expect(result).not.toContain(".dark {")
    })

    it("should support :root.dark selector", () => {
      const result = generateDarkModeCss(testDarkColors, ":root.dark")

      expect(result).toContain(":root.dark {")
    })
  })

  describe("color overrides", () => {
    it("should override all semantic colors", () => {
      const result = generateDarkModeCss(testDarkColors)

      expect(result).toContain("--background: hsl(222.2 84% 4.9%);")
      expect(result).toContain("--foreground: hsl(210 40% 98%);")
      expect(result).toContain("--primary: hsl(210 40% 98%);")
      expect(result).toContain("--secondary: hsl(217.2 32.6% 17.5%);")
      expect(result).toContain("--destructive: hsl(0 62.8% 30.6%);")
    })

    it("should convert camelCase to kebab-case", () => {
      const result = generateDarkModeCss(testDarkColors)

      expect(result).toContain("--card-foreground:")
      expect(result).toContain("--primary-foreground:")
      expect(result).toContain("--muted-foreground:")
    })

    it("should skip undefined values", () => {
      const partial: Partial<SemanticColors> = {
        background: "hsl(0 0% 0%)",
        foreground: undefined,
      }
      const result = generateDarkModeCss(partial)

      expect(result).toContain("--background: hsl(0 0% 0%);")
      expect(result).not.toContain("--foreground:")
    })
  })

  describe("CSS validity", () => {
    it("should generate valid CSS syntax", () => {
      const result = generateDarkModeCss(testDarkColors)

      // Should start with selector and end with closing brace
      expect(result.trim().startsWith(".dark {")).toBe(true)
      expect(result.trim().endsWith("}")).toBe(true)

      // Each property line should have proper syntax
      const lines = result.split("\n")
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith(".") && trimmed !== "}") {
          expect(trimmed).toMatch(/^--[\w-]+:\s*.+;$/)
        }
      }
    })
  })
})

// =============================================================================
// generateDarkModeMediaQuery
// =============================================================================

describe("generateDarkModeMediaQuery (Feature #27)", () => {
  describe("media query generation", () => {
    it("should generate prefers-color-scheme media query", () => {
      const result = generateDarkModeMediaQuery(testDarkColors)

      expect(result).toContain("@media (prefers-color-scheme: dark)")
    })

    it("should use :root:not(.light) by default", () => {
      const result = generateDarkModeMediaQuery(testDarkColors)

      expect(result).toContain(":root:not(.light)")
    })

    it("should support custom exclude selector", () => {
      const result = generateDarkModeMediaQuery(testDarkColors, "[data-theme='light']")

      expect(result).toContain(":root:not([data-theme='light'])")
      expect(result).not.toContain(":root:not(.light)")
    })
  })

  describe("color overrides in media query", () => {
    it("should include all dark colors", () => {
      const result = generateDarkModeMediaQuery(testDarkColors)

      expect(result).toContain("--background: hsl(222.2 84% 4.9%);")
      expect(result).toContain("--foreground: hsl(210 40% 98%);")
      expect(result).toContain("--primary: hsl(210 40% 98%);")
    })

    it("should skip undefined values", () => {
      const partial: Partial<SemanticColors> = {
        background: "hsl(0 0% 0%)",
      }
      const result = generateDarkModeMediaQuery(partial)

      expect(result).toContain("--background: hsl(0 0% 0%);")
      expect(result).not.toContain("--foreground:")
    })

    it("should return empty string for empty colors", () => {
      const result = generateDarkModeMediaQuery({})

      expect(result).toBe("")
    })
  })

  describe("CSS validity", () => {
    it("should generate valid nested CSS", () => {
      const result = generateDarkModeMediaQuery(testDarkColors)

      // Should have proper structure
      expect(result).toContain("@media (prefers-color-scheme: dark) {")
      expect(result).toContain(":root:not(.light) {")

      // Count braces - should be balanced
      const openBraces = (result.match(/{/g) || []).length
      const closeBraces = (result.match(/}/g) || []).length
      expect(openBraces).toBe(closeBraces)
    })
  })
})

// =============================================================================
// generateCompleteDarkMode
// =============================================================================

describe("generateCompleteDarkMode (Feature #27)", () => {
  describe("complete dark mode output", () => {
    it("should include both class selector and media query", () => {
      const result = generateCompleteDarkMode(testDarkColors)

      // Should have class-based toggle
      expect(result).toContain("/* Dark Mode (Class Toggle) */")
      expect(result).toContain(".dark {")

      // Should have media query fallback
      expect(result).toContain("/* Dark Mode (System Preference) */")
      expect(result).toContain("@media (prefers-color-scheme: dark)")
    })

    it("should allow disabling media query", () => {
      const result = generateCompleteDarkMode(testDarkColors, {
        includeMediaQuery: false,
      })

      expect(result).toContain(".dark {")
      expect(result).not.toContain("@media (prefers-color-scheme: dark)")
    })
  })

  describe("custom options", () => {
    it("should support custom selector", () => {
      const result = generateCompleteDarkMode(testDarkColors, {
        selector: "[data-mode='dark']",
      })

      expect(result).toContain("[data-mode='dark'] {")
      expect(result).not.toContain(".dark {")
    })

    it("should support custom exclude selector", () => {
      const result = generateCompleteDarkMode(testDarkColors, {
        excludeSelector: "[data-mode='light']",
      })

      expect(result).toContain(":root:not([data-mode='light'])")
    })

    it("should support all options together", () => {
      const result = generateCompleteDarkMode(testDarkColors, {
        selector: ".theme-dark",
        excludeSelector: ".theme-light",
        includeMediaQuery: true,
      })

      expect(result).toContain(".theme-dark {")
      expect(result).toContain(":root:not(.theme-light)")
    })
  })

  describe("color consistency", () => {
    it("should have same colors in both sections", () => {
      const result = generateCompleteDarkMode(testDarkColors)

      // Count occurrences of background color
      const bgMatches = result.match(/--background: hsl\(222\.2 84% 4\.9%\);/g)
      expect(bgMatches?.length).toBe(2) // Once in .dark, once in media query
    })
  })

  describe("default options", () => {
    it("should use .dark selector by default", () => {
      const result = generateCompleteDarkMode(testDarkColors)
      expect(result).toContain(".dark {")
    })

    it("should include media query by default", () => {
      const result = generateCompleteDarkMode(testDarkColors)
      expect(result).toContain("@media (prefers-color-scheme: dark)")
    })

    it("should use .light as exclude selector by default", () => {
      const result = generateCompleteDarkMode(testDarkColors)
      expect(result).toContain(":root:not(.light)")
    })
  })
})

// =============================================================================
// Integration
// =============================================================================

describe("Dark Mode Integration", () => {
  it("should work with partial color sets", () => {
    const partialColors: Partial<SemanticColors> = {
      background: "hsl(0 0% 5%)",
      foreground: "hsl(0 0% 95%)",
      primary: "hsl(200 100% 50%)",
    }

    const classCss = generateDarkModeCss(partialColors)
    const mediaCss = generateDarkModeMediaQuery(partialColors)
    const completeCss = generateCompleteDarkMode(partialColors)

    // All should contain the three colors
    expect(classCss).toContain("--background:")
    expect(classCss).toContain("--foreground:")
    expect(classCss).toContain("--primary:")

    expect(mediaCss).toContain("--background:")
    expect(completeCss).toContain("--background:")
  })

  it("should handle empty color set gracefully", () => {
    const emptyColors: Partial<SemanticColors> = {}

    const classCss = generateDarkModeCss(emptyColors)
    const mediaCss = generateDarkModeMediaQuery(emptyColors)

    // Class CSS should still have the wrapper
    expect(classCss).toContain(".dark {")
    expect(classCss).toContain("}")

    // Media query should be empty
    expect(mediaCss).toBe("")
  })
})
