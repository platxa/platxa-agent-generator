/**
 * Brand Guidelines Generator - Tests
 *
 * Tests the AI-powered brand guidelines generation:
 * - Color analysis utilities
 * - Guidelines generation
 * - Markdown output
 */

import { describe, it, expect } from "vitest"
import {
  generateBrandGuidelines,
  guidelinesToMarkdown,
  isLightColor,
  getColorCategory,
} from "../guidelines"
import type { ThemeConfig } from "../theme/types"

// =============================================================================
// Test Fixtures
// =============================================================================

const mockBrandKit: ThemeConfig = {
  name: "test-brand",
  light: {
    colors: {
      primary: "#6366f1",
      primaryForeground: "#ffffff",
      secondary: "#f1f5f9",
      secondaryForeground: "#0f172a",
      muted: "#f1f5f9",
      mutedForeground: "#64748b",
      accent: "#22c55e",
      accentForeground: "#ffffff",
      destructive: "#ef4444",
      destructiveForeground: "#ffffff",
      background: "#ffffff",
      foreground: "#0f172a",
      card: "#ffffff",
      cardForeground: "#0f172a",
      popover: "#ffffff",
      popoverForeground: "#0f172a",
      border: "#e2e8f0",
      input: "#e2e8f0",
      ring: "#6366f1",
    },
    spacing: {
      1: "0.25rem",
      2: "0.5rem",
      4: "1rem",
    },
    typography: {
      sm: { fontSize: "0.875rem", lineHeight: "1.25rem" },
      base: { fontSize: "1rem", lineHeight: "1.5rem" },
    },
    radius: {
      sm: "0.25rem",
      md: "0.375rem",
    },
    shadow: {},
    fontWeight: {},
  },
  dark: {
    primary: "#818cf8",
    background: "#0f172a",
    foreground: "#f8fafc",
  },
}

// =============================================================================
// Color Utility Tests
// =============================================================================

describe("isLightColor", () => {
  it("should identify white as light", () => {
    expect(isLightColor("#ffffff")).toBe(true)
    expect(isLightColor("#fff")).toBe(true)
  })

  it("should identify black as dark", () => {
    expect(isLightColor("#000000")).toBe(false)
    expect(isLightColor("#000")).toBe(false)
  })

  it("should identify light gray as light", () => {
    expect(isLightColor("#f1f5f9")).toBe(true)
    expect(isLightColor("#e2e8f0")).toBe(true)
  })

  it("should identify dark colors as dark", () => {
    expect(isLightColor("#0f172a")).toBe(false)
    expect(isLightColor("#1e293b")).toBe(false)
  })

  it("should handle invalid colors gracefully", () => {
    expect(isLightColor("invalid")).toBe(true) // default to light
    expect(isLightColor("")).toBe(true)
  })
})

describe("getColorCategory", () => {
  it("should categorize blue colors", () => {
    expect(getColorCategory("#3b82f6")).toBe("blue")
    expect(getColorCategory("#6366f1")).toBe("blue")
  })

  it("should categorize red colors", () => {
    expect(getColorCategory("#ef4444")).toBe("red")
    expect(getColorCategory("#dc2626")).toBe("red")
  })

  it("should categorize green colors", () => {
    expect(getColorCategory("#22c55e")).toBe("green")
    expect(getColorCategory("#16a34a")).toBe("green")
  })

  it("should categorize neutral colors", () => {
    expect(getColorCategory("#ffffff")).toBe("light neutral")
    expect(getColorCategory("#000000")).toBe("dark neutral")
    expect(getColorCategory("#64748b")).toBe("neutral")
  })

  it("should categorize purple colors", () => {
    expect(getColorCategory("#a855f7")).toBe("purple")
    expect(getColorCategory("#8b5cf6")).toBe("purple")
  })

  it("should categorize orange colors", () => {
    expect(getColorCategory("#f97316")).toBe("orange")
  })

  it("should categorize yellow colors", () => {
    expect(getColorCategory("#eab308")).toBe("yellow")
  })
})

// =============================================================================
// Guidelines Generation Tests
// =============================================================================

describe("generateBrandGuidelines", () => {
  it("should generate guidelines with correct brand name", () => {
    const guidelines = generateBrandGuidelines(mockBrandKit)
    expect(guidelines.brandName).toBe("test-brand")
  })

  it("should include generation timestamp", () => {
    const guidelines = generateBrandGuidelines(mockBrandKit)
    expect(guidelines.generatedAt).toBeDefined()
    expect(new Date(guidelines.generatedAt).getTime()).not.toBeNaN()
  })

  it("should generate overview section", () => {
    const guidelines = generateBrandGuidelines(mockBrandKit)

    expect(guidelines.overview.description).toContain("test-brand")
    expect(guidelines.overview.principles).toHaveLength(4)
    expect(guidelines.overview.personality).toHaveLength(4)
    expect(guidelines.overview.audience).toBeDefined()
  })

  it("should generate color guidelines", () => {
    const guidelines = generateBrandGuidelines(mockBrandKit)

    expect(guidelines.colors.primary.value).toBe("#6366f1")
    expect(guidelines.colors.primary.usage.length).toBeGreaterThan(0)
    expect(guidelines.colors.primary.avoid.length).toBeGreaterThan(0)
    expect(guidelines.colors.primary.a11y).toContain("primaryForeground")
  })

  it("should generate background pairs", () => {
    const guidelines = generateBrandGuidelines(mockBrandKit)

    expect(guidelines.colors.backgrounds.length).toBeGreaterThanOrEqual(3)

    const defaultBg = guidelines.colors.backgrounds.find((b) => b.name === "Default")
    expect(defaultBg).toBeDefined()
    expect(defaultBg?.background).toBe("#ffffff")
    expect(defaultBg?.foreground).toBe("#0f172a")
  })

  it("should generate typography guidelines", () => {
    const guidelines = generateBrandGuidelines(mockBrandKit)

    expect(guidelines.typography.fontFamilies.length).toBeGreaterThan(0)
    expect(guidelines.typography.sizeScale.length).toBeGreaterThan(0)
    expect(guidelines.typography.rules.length).toBeGreaterThan(0)
  })

  it("should generate spacing guidelines", () => {
    const guidelines = generateBrandGuidelines(mockBrandKit)

    expect(guidelines.spacing.baseUnit).toBeDefined()
    expect(guidelines.spacing.scale.length).toBeGreaterThan(0)
    expect(guidelines.spacing.rules.length).toBeGreaterThan(0)
  })

  it("should generate component guidelines", () => {
    const guidelines = generateBrandGuidelines(mockBrandKit)

    expect(guidelines.components.buttons.length).toBeGreaterThan(0)
    expect(guidelines.components.forms.length).toBeGreaterThan(0)
    expect(guidelines.components.cards.length).toBeGreaterThan(0)
    expect(guidelines.components.navigation.length).toBeGreaterThan(0)
  })

  it("should generate do's and don'ts", () => {
    const guidelines = generateBrandGuidelines(mockBrandKit)

    expect(guidelines.dosAndDonts.dos.length).toBeGreaterThan(0)
    expect(guidelines.dosAndDonts.donts.length).toBeGreaterThan(0)

    // Check priorities are set
    const highPriorityDos = guidelines.dosAndDonts.dos.filter(
      (d) => d.priority === "high"
    )
    expect(highPriorityDos.length).toBeGreaterThan(0)
  })

  it("should generate example applications", () => {
    const guidelines = generateBrandGuidelines(mockBrandKit)

    expect(guidelines.examples.length).toBeGreaterThan(0)

    const loginExample = guidelines.examples.find((e) => e.name === "Login Form")
    expect(loginExample).toBeDefined()
    expect(loginExample?.tokensUsed.length).toBeGreaterThan(0)
    expect(loginExample?.code).toBeTruthy()
  })

  it("should generate accessibility guidelines", () => {
    const guidelines = generateBrandGuidelines(mockBrandKit)

    expect(guidelines.accessibility.contrast.length).toBeGreaterThan(0)
    expect(guidelines.accessibility.focus.length).toBeGreaterThan(0)
    expect(guidelines.accessibility.motion.length).toBeGreaterThan(0)
    expect(guidelines.accessibility.general.length).toBeGreaterThan(0)
  })
})

// =============================================================================
// Options Tests
// =============================================================================

describe("generateBrandGuidelines options", () => {
  it("should exclude code examples when disabled", () => {
    const guidelines = generateBrandGuidelines(mockBrandKit, {
      includeCodeExamples: false,
    })

    // Component examples should not have code
    expect(guidelines.components.buttons[0].example).toBeUndefined()

    // Application examples should have empty code
    expect(guidelines.examples[0].code).toBe("")
  })

  it("should use minimal verbosity", () => {
    const guidelines = generateBrandGuidelines(mockBrandKit, {
      verbosity: "minimal",
    })

    // Semantic colors should be empty in minimal mode
    expect(guidelines.colors.semantic).toHaveLength(0)

    // Typography weights should be empty
    expect(guidelines.typography.weights).toHaveLength(0)

    // Spacing patterns should be empty
    expect(guidelines.spacing.patterns).toHaveLength(0)
  })

  it("should use custom brand description", () => {
    const customDesc = "This is a custom brand description"
    const guidelines = generateBrandGuidelines(mockBrandKit, {
      brandDescription: customDesc,
    })

    expect(guidelines.overview.description).toBe(customDesc)
  })
})

// =============================================================================
// Markdown Output Tests
// =============================================================================

describe("guidelinesToMarkdown", () => {
  it("should generate valid markdown", () => {
    const guidelines = generateBrandGuidelines(mockBrandKit)
    const markdown = guidelinesToMarkdown(guidelines)

    expect(markdown).toContain("# test-brand Brand Guidelines")
    expect(markdown).toContain("## Overview")
    expect(markdown).toContain("## Color Guidelines")
    expect(markdown).toContain("## Do's and Don'ts")
    expect(markdown).toContain("## Example Applications")
    expect(markdown).toContain("## Accessibility")
  })

  it("should include code blocks for examples", () => {
    const guidelines = generateBrandGuidelines(mockBrandKit)
    const markdown = guidelinesToMarkdown(guidelines)

    expect(markdown).toContain("```tsx")
    expect(markdown).toContain("```")
  })

  it("should include priority markers for guidelines", () => {
    const guidelines = generateBrandGuidelines(mockBrandKit)
    const markdown = guidelinesToMarkdown(guidelines)

    expect(markdown).toContain("[HIGH]")
    expect(markdown).toContain("[MEDIUM]")
  })

  it("should format color values as code", () => {
    const guidelines = generateBrandGuidelines(mockBrandKit)
    const markdown = guidelinesToMarkdown(guidelines)

    expect(markdown).toContain("`#6366f1`")
  })
})

// =============================================================================
// Edge Cases
// =============================================================================

describe("Edge cases", () => {
  it("should handle minimal brand kit", () => {
    const minimalKit: ThemeConfig = {
      name: "minimal",
      light: {
        colors: {
          primary: "#000000",
        } as any,
        spacing: {},
        typography: {},
        radius: {},
        shadow: {},
        fontWeight: {},
      },
    }

    const guidelines = generateBrandGuidelines(minimalKit)

    expect(guidelines.brandName).toBe("minimal")
    expect(guidelines.colors.primary.value).toBe("#000000")
    // Should use defaults for missing colors
    expect(guidelines.colors.secondary.value).toBe("#f1f5f9")
  })

  it("should handle brand kit without dark mode", () => {
    const noDarkKit: ThemeConfig = {
      name: "light-only",
      light: {
        colors: mockBrandKit.light.colors,
        spacing: {},
        typography: {},
        radius: {},
        shadow: {},
        fontWeight: {},
      },
    }

    const guidelines = generateBrandGuidelines(noDarkKit)

    expect(guidelines.brandName).toBe("light-only")
    // Should still generate guidelines without errors
    expect(guidelines.colors.primary).toBeDefined()
  })
})
