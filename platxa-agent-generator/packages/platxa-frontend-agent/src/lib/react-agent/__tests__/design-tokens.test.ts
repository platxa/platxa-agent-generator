/**
 * Design Tokens - Unit Tests
 *
 * Tests for Tailwind v4 @theme directive and CSS variable generation
 */

import { describe, it, expect } from "vitest"
import {
  generateThemeDirective,
  generateRootVariables,
  generateDarkVariables,
  generateChartVariables,
  generateTheme,
  validateTokens,
  hexToHsl,
  hslToHex,
  toOklch,
  parseOklch,
  generateColorScale,
  detectColorFormat,
  createSemanticColorsFromPrimary,
  createDefaultTokens,
  defaultLightColors,
  defaultDarkColors,
  defaultChartColors,
  type DesignTokens,
  type SemanticColors,
  type OklchColor,
} from "../design-tokens"

// ============================================================================
// Test Fixtures
// ============================================================================

const createTokens = (overrides: Partial<DesignTokens> = {}): DesignTokens => ({
  colors: {
    light: defaultLightColors,
    dark: defaultDarkColors,
  },
  ...overrides,
})

// ============================================================================
// Default Tokens Tests
// ============================================================================

describe("Default Tokens", () => {
  describe("defaultLightColors", () => {
    it("has all required semantic colors", () => {
      expect(defaultLightColors.background).toBeDefined()
      expect(defaultLightColors.foreground).toBeDefined()
      expect(defaultLightColors.primary).toBeDefined()
      expect(defaultLightColors.secondary).toBeDefined()
      expect(defaultLightColors.muted).toBeDefined()
      expect(defaultLightColors.accent).toBeDefined()
      expect(defaultLightColors.destructive).toBeDefined()
      expect(defaultLightColors.border).toBeDefined()
      expect(defaultLightColors.input).toBeDefined()
      expect(defaultLightColors.ring).toBeDefined()
    })

    it("has card colors", () => {
      expect(defaultLightColors.card).toBeDefined()
      expect(defaultLightColors.cardForeground).toBeDefined()
    })

    it("has popover colors", () => {
      expect(defaultLightColors.popover).toBeDefined()
      expect(defaultLightColors.popoverForeground).toBeDefined()
    })
  })

  describe("defaultDarkColors", () => {
    it("has all required semantic colors", () => {
      expect(defaultDarkColors.background).toBeDefined()
      expect(defaultDarkColors.foreground).toBeDefined()
      expect(defaultDarkColors.primary).toBeDefined()
    })

    it("inverts light/dark appropriately", () => {
      // Dark mode background should be dark
      expect(defaultDarkColors.background).toContain("3.9%")
      // Dark mode foreground should be light
      expect(defaultDarkColors.foreground).toContain("98%")
    })
  })

  describe("defaultChartColors", () => {
    it("has 5 chart colors", () => {
      expect(defaultChartColors.chart1).toBeDefined()
      expect(defaultChartColors.chart2).toBeDefined()
      expect(defaultChartColors.chart3).toBeDefined()
      expect(defaultChartColors.chart4).toBeDefined()
      expect(defaultChartColors.chart5).toBeDefined()
    })
  })

  describe("createDefaultTokens", () => {
    it("returns complete token set", () => {
      const tokens = createDefaultTokens()

      expect(tokens.colors).toBeDefined()
      expect(tokens.colors.light).toBeDefined()
      expect(tokens.colors.dark).toBeDefined()
      expect(tokens.colors.chart).toBeDefined()
      expect(tokens.borderRadius).toBeDefined()
    })
  })
})

// ============================================================================
// @theme Directive Tests
// ============================================================================

describe("@theme Directive Generation", () => {
  describe("generateThemeDirective", () => {
    it("generates @theme block", () => {
      const tokens = createTokens()
      const result = generateThemeDirective(tokens)

      expect(result).toContain("@theme {")
      expect(result).toContain("}")
    })

    it("includes color scales when provided", () => {
      const tokens = createTokens({
        colors: {
          light: defaultLightColors,
          dark: defaultDarkColors,
          scales: {
            blue: {
              50: "214 100% 97%",
              500: "214 100% 50%",
              900: "214 100% 20%",
            },
          },
        },
      })
      const result = generateThemeDirective(tokens)

      expect(result).toContain("--color-blue-50")
      expect(result).toContain("--color-blue-500")
      expect(result).toContain("--color-blue-900")
    })

    it("includes spacing when provided", () => {
      const tokens = createTokens({
        spacing: {
          0: "0",
          1: "0.25rem",
          2: "0.5rem",
          4: "1rem",
        },
      })
      const result = generateThemeDirective(tokens)

      expect(result).toContain("/* Spacing */")
      expect(result).toContain("--spacing-0: 0")
      expect(result).toContain("--spacing-1: 0.25rem")
    })

    it("includes typography when provided", () => {
      const tokens = createTokens({
        typography: {
          fontFamily: {
            sans: ["Inter", "sans-serif"],
            serif: ["Georgia", "serif"],
            mono: ["Fira Code", "monospace"],
          },
        },
      })
      const result = generateThemeDirective(tokens)

      expect(result).toContain("/* Font Families */")
      expect(result).toContain("--font-sans")
      expect(result).toContain("Inter")
    })

    it("includes border radius when provided", () => {
      const tokens = createTokens({
        borderRadius: {
          sm: "0.25rem",
          md: "0.375rem",
          lg: "0.5rem",
        },
      })
      const result = generateThemeDirective(tokens)

      expect(result).toContain("/* Border Radius */")
      expect(result).toContain("--radius-sm: 0.25rem")
    })

    it("includes shadows when provided", () => {
      const tokens = createTokens({
        shadows: {
          sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
          md: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
        },
      })
      const result = generateThemeDirective(tokens)

      expect(result).toContain("/* Shadows */")
      expect(result).toContain("--shadow-sm")
    })

    it("includes breakpoints when provided", () => {
      const tokens = createTokens({
        breakpoints: {
          sm: "640px",
          md: "768px",
          lg: "1024px",
        },
      })
      const result = generateThemeDirective(tokens)

      expect(result).toContain("/* Breakpoints */")
      expect(result).toContain("--breakpoint-sm: 640px")
    })

    it("uses custom prefix when provided", () => {
      const tokens = createTokens({
        spacing: { 1: "0.25rem" },
      })
      const result = generateThemeDirective(tokens, { prefix: "tw" })

      expect(result).toContain("--tw-spacing-1")
    })

    it("uses camelCase naming when specified", () => {
      const tokens = createTokens({
        borderRadius: { lg: "0.5rem" },
      })
      const result = generateThemeDirective(tokens, { naming: "camelCase" })

      expect(result).toContain("--radiusLg")
    })

    it("uses snake_case naming when specified", () => {
      const tokens = createTokens({
        borderRadius: { lg: "0.5rem" },
      })
      const result = generateThemeDirective(tokens, { naming: "snake_case" })

      expect(result).toContain("--radius_lg")
    })
  })
})

// ============================================================================
// CSS Variables Tests
// ============================================================================

describe("CSS Variables Generation", () => {
  describe("generateRootVariables", () => {
    it("generates :root block", () => {
      const result = generateRootVariables(defaultLightColors)

      expect(result).toContain(":root {")
      expect(result).toContain("}")
    })

    it("includes all semantic colors", () => {
      const result = generateRootVariables(defaultLightColors)

      expect(result).toContain("--background")
      expect(result).toContain("--foreground")
      expect(result).toContain("--primary")
      expect(result).toContain("--secondary")
      expect(result).toContain("--muted")
      expect(result).toContain("--accent")
      expect(result).toContain("--destructive")
      expect(result).toContain("--border")
      expect(result).toContain("--ring")
    })

    it("uses custom prefix", () => {
      const result = generateRootVariables(defaultLightColors, { prefix: "ui" })

      expect(result).toContain("--ui-background")
      expect(result).toContain("--ui-primary")
    })
  })

  describe("generateDarkVariables", () => {
    it("generates .dark block", () => {
      const result = generateDarkVariables(defaultDarkColors)

      expect(result).toContain(".dark {")
      expect(result).toContain("}")
    })

    it("includes all semantic colors", () => {
      const result = generateDarkVariables(defaultDarkColors)

      expect(result).toContain("--background")
      expect(result).toContain("--foreground")
      expect(result).toContain("--primary")
    })
  })

  describe("generateChartVariables", () => {
    it("generates chart color variables", () => {
      const result = generateChartVariables(defaultChartColors)

      expect(result).toContain("--chart-1")
      expect(result).toContain("--chart-2")
      expect(result).toContain("--chart-3")
      expect(result).toContain("--chart-4")
      expect(result).toContain("--chart-5")
    })
  })
})

// ============================================================================
// Complete Theme Generation Tests
// ============================================================================

describe("Complete Theme Generation", () => {
  describe("generateTheme", () => {
    it("generates complete CSS output", () => {
      const tokens = createDefaultTokens()
      const result = generateTheme(tokens)

      expect(result.css).toContain('@import "tailwindcss"')
      expect(result.css).toContain("@theme {")
      expect(result.css).toContain(":root {")
      expect(result.css).toContain(".dark {")
      expect(result.css).toContain("@layer base")
    })

    it("includes theme directive when enabled", () => {
      const tokens = createDefaultTokens()
      const result = generateTheme(tokens, { includeThemeDirective: true })

      expect(result.themeDirective).toContain("@theme {")
    })

    it("excludes theme directive when disabled", () => {
      const tokens = createDefaultTokens()
      const result = generateTheme(tokens, { includeThemeDirective: false })

      expect(result.themeDirective).toBe("")
    })

    it("includes dark mode when enabled", () => {
      const tokens = createDefaultTokens()
      const result = generateTheme(tokens, { includeDarkMode: true })

      expect(result.darkVariables).toContain(".dark {")
      expect(result.css).toContain(".dark {")
    })

    it("excludes dark mode when disabled", () => {
      const tokens = createDefaultTokens()
      const result = generateTheme(tokens, { includeDarkMode: false })

      expect(result.darkVariables).toBe("")
    })

    it("minifies output when enabled", () => {
      const tokens = createDefaultTokens()
      const result = generateTheme(tokens, { minify: true })

      // Minified CSS should not have newlines between properties
      expect(result.css).not.toMatch(/\n\s+--/)
    })

    it("includes metadata", () => {
      const tokens = createDefaultTokens()
      const result = generateTheme(tokens)

      expect(result.metadata.tokenCount).toBeGreaterThan(0)
      expect(result.metadata.colorCount).toBeGreaterThan(0)
      expect(result.metadata.generatedAt).toBeInstanceOf(Date)
    })

    it("includes global base styles", () => {
      const tokens = createDefaultTokens()
      const result = generateTheme(tokens)

      expect(result.css).toContain("@apply border-border")
      expect(result.css).toContain("@apply bg-background text-foreground")
    })
  })
})

// ============================================================================
// Token Validation Tests
// ============================================================================

describe("Token Validation", () => {
  describe("validateTokens", () => {
    it("validates complete token set", () => {
      const tokens = createDefaultTokens()
      const result = validateTokens(tokens)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it("reports missing colors", () => {
      const tokens = {} as DesignTokens
      const result = validateTokens(tokens)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain("Missing colors configuration")
    })

    it("reports missing light mode colors", () => {
      const tokens = {
        colors: {
          dark: defaultDarkColors,
        },
      } as DesignTokens
      const result = validateTokens(tokens)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes("light mode"))).toBe(true)
    })

    it("warns about missing dark mode", () => {
      const tokens = {
        colors: {
          light: defaultLightColors,
        },
      } as DesignTokens
      const result = validateTokens(tokens)

      expect(result.warnings.some((w) => w.includes("dark mode"))).toBe(true)
    })

    it("validates required semantic colors", () => {
      const tokens = {
        colors: {
          light: {
            background: "0 0% 100%",
          } as SemanticColors,
          dark: defaultDarkColors,
        },
      }
      const result = validateTokens(tokens)

      expect(result.errors.some((e) => e.includes("foreground"))).toBe(true)
    })

    it("validates color scale values", () => {
      const tokens = createTokens({
        colors: {
          light: defaultLightColors,
          dark: defaultDarkColors,
          scales: {
            invalid: {
              500: "not-a-color",
            },
          },
        },
      })
      const result = validateTokens(tokens)

      expect(result.errors.some((e) => e.includes("Invalid color"))).toBe(true)
    })

    it("accepts valid hex colors in scales", () => {
      const tokens = createTokens({
        colors: {
          light: defaultLightColors,
          dark: defaultDarkColors,
          scales: {
            blue: {
              500: "#3b82f6",
            },
          },
        },
      })
      const result = validateTokens(tokens)

      expect(result.errors.filter((e) => e.includes("blue-500"))).toHaveLength(0)
    })

    it("accepts valid oklch colors in scales", () => {
      const tokens = createTokens({
        colors: {
          light: defaultLightColors,
          dark: defaultDarkColors,
          scales: {
            blue: {
              500: "oklch(0.6 0.2 250)",
            },
          },
        },
      })
      const result = validateTokens(tokens)

      expect(result.errors.filter((e) => e.includes("blue-500"))).toHaveLength(0)
    })
  })
})

// ============================================================================
// Color Utilities Tests
// ============================================================================

describe("Color Utilities", () => {
  describe("hexToHsl", () => {
    it("converts white", () => {
      const result = hexToHsl("#ffffff")
      expect(result).toContain("0")
      expect(result).toContain("0%")
      expect(result).toContain("100%")
    })

    it("converts black", () => {
      const result = hexToHsl("#000000")
      expect(result).toContain("0%")
    })

    it("converts blue", () => {
      const result = hexToHsl("#0000ff")
      expect(result).toContain("240")
      expect(result).toContain("100%")
      expect(result).toContain("50%")
    })

    it("converts red", () => {
      const result = hexToHsl("#ff0000")
      expect(result).toContain("0 ")
      expect(result).toContain("100%")
      expect(result).toContain("50%")
    })

    it("handles 3-character hex", () => {
      const result = hexToHsl("#fff")
      // Should handle gracefully even if not converted
      expect(result).toBeDefined()
    })

    it("handles hex without #", () => {
      const result = hexToHsl("ffffff")
      expect(result).toContain("100%")
    })
  })

  describe("hslToHex", () => {
    it("converts white HSL to hex", () => {
      const result = hslToHex(0, 0, 100)
      expect(result.toLowerCase()).toBe("#ffffff")
    })

    it("converts black HSL to hex", () => {
      const result = hslToHex(0, 0, 0)
      expect(result.toLowerCase()).toBe("#000000")
    })

    it("converts blue HSL to hex", () => {
      const result = hslToHex(240, 100, 50)
      expect(result.toLowerCase()).toBe("#0000ff")
    })

    it("converts red HSL to hex", () => {
      const result = hslToHex(0, 100, 50)
      expect(result.toLowerCase()).toBe("#ff0000")
    })

    it("converts green HSL to hex", () => {
      const result = hslToHex(120, 100, 50)
      expect(result.toLowerCase()).toBe("#00ff00")
    })
  })

  describe("toOklch", () => {
    it("generates oklch string", () => {
      const color: OklchColor = { l: 0.6, c: 0.2, h: 250 }
      const result = toOklch(color)

      expect(result).toBe("oklch(0.6 0.2 250)")
    })

    it("includes alpha when provided", () => {
      const color: OklchColor = { l: 0.6, c: 0.2, h: 250, alpha: 0.5 }
      const result = toOklch(color)

      expect(result).toBe("oklch(0.6 0.2 250 / 0.5)")
    })

    it("omits alpha when 1", () => {
      const color: OklchColor = { l: 0.6, c: 0.2, h: 250, alpha: 1 }
      const result = toOklch(color)

      expect(result).not.toContain("/")
    })
  })

  describe("parseOklch", () => {
    it("parses oklch string", () => {
      const result = parseOklch("oklch(0.6 0.2 250)")

      expect(result).not.toBeNull()
      expect(result?.l).toBe(0.6)
      expect(result?.c).toBe(0.2)
      expect(result?.h).toBe(250)
    })

    it("parses oklch with alpha", () => {
      const result = parseOklch("oklch(0.6 0.2 250 / 0.5)")

      expect(result?.alpha).toBe(0.5)
    })

    it("returns null for invalid string", () => {
      const result = parseOklch("rgb(255, 0, 0)")

      expect(result).toBeNull()
    })
  })

  describe("generateColorScale", () => {
    it("generates scale with all shades", () => {
      const scale = generateColorScale(220) // Blue hue

      expect(scale[50]).toBeDefined()
      expect(scale[100]).toBeDefined()
      expect(scale[200]).toBeDefined()
      expect(scale[500]).toBeDefined()
      expect(scale[900]).toBeDefined()
      expect(scale[950]).toBeDefined()
    })

    it("lighter shades have higher lightness", () => {
      const scale = generateColorScale(220)

      // Extract lightness from HSL string
      const getLightness = (hsl: string) => {
        const match = hsl.match(/(\d+)%$/)
        return match ? parseInt(match[1]) : 0
      }

      expect(getLightness(scale[50]!)).toBeGreaterThan(getLightness(scale[500]!))
      expect(getLightness(scale[500]!)).toBeGreaterThan(getLightness(scale[900]!))
    })

    it("uses custom saturation", () => {
      const scale = generateColorScale(220, 50)

      expect(scale[500]).toContain("50%")
    })
  })

  describe("detectColorFormat", () => {
    it("detects hex format", () => {
      expect(detectColorFormat("#ff0000")).toBe("hex")
      expect(detectColorFormat("#f00")).toBe("hex")
    })

    it("detects rgb format", () => {
      expect(detectColorFormat("rgb(255, 0, 0)")).toBe("rgb")
      expect(detectColorFormat("rgba(255, 0, 0, 0.5)")).toBe("rgb")
    })

    it("detects hsl format", () => {
      expect(detectColorFormat("hsl(0, 100%, 50%)")).toBe("hsl")
      expect(detectColorFormat("hsla(0, 100%, 50%, 0.5)")).toBe("hsl")
    })

    it("detects oklch format", () => {
      expect(detectColorFormat("oklch(0.6 0.2 250)")).toBe("oklch")
    })

    it("detects shadcn HSL format", () => {
      expect(detectColorFormat("240 10% 3.9%")).toBe("hsl")
      expect(detectColorFormat("0 0% 100%")).toBe("hsl")
    })
  })

  describe("createSemanticColorsFromPrimary", () => {
    it("creates colors with custom primary", () => {
      const result = createSemanticColorsFromPrimary("220 90% 50%", "light")

      expect(result.primary).toBe("220 90% 50%")
      expect(result.ring).toBe("220 90% 50%")
    })

    it("preserves other colors from defaults", () => {
      const result = createSemanticColorsFromPrimary("220 90% 50%", "light")

      expect(result.background).toBe(defaultLightColors.background)
      expect(result.secondary).toBe(defaultLightColors.secondary)
    })

    it("uses dark mode defaults when specified", () => {
      const result = createSemanticColorsFromPrimary("220 90% 50%", "dark")

      expect(result.background).toBe(defaultDarkColors.background)
    })
  })
})

// ============================================================================
// Integration Tests
// ============================================================================

describe("Integration: Full Theme Workflow", () => {
  it("generates theme from custom primary color", () => {
    const primaryColor = "220 90% 50%" // Blue
    const lightColors = createSemanticColorsFromPrimary(primaryColor, "light")
    const darkColors = createSemanticColorsFromPrimary(primaryColor, "dark")

    const tokens: DesignTokens = {
      colors: {
        light: lightColors,
        dark: darkColors,
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.25rem",
      },
    }

    // Validate
    const validation = validateTokens(tokens)
    expect(validation.valid).toBe(true)

    // Generate
    const theme = generateTheme(tokens)
    expect(theme.css).toContain("220 90% 50%")
    expect(theme.css).toContain("--radius-lg: 0.75rem")
  })

  it("generates theme with color scales", () => {
    const blueScale = generateColorScale(220, 80)

    const tokens: DesignTokens = {
      colors: {
        light: defaultLightColors,
        dark: defaultDarkColors,
        scales: {
          blue: blueScale,
        },
      },
    }

    const theme = generateTheme(tokens)
    expect(theme.css).toContain("--color-blue-50")
    expect(theme.css).toContain("--color-blue-500")
    expect(theme.css).toContain("--color-blue-900")
  })

  it("generates complete shadcn-style theme", () => {
    const tokens = createDefaultTokens()
    const theme = generateTheme(tokens, {
      includeThemeDirective: true,
      includeCssVariables: true,
      includeDarkMode: true,
    })

    // Check structure
    expect(theme.css).toContain('@import "tailwindcss"')
    expect(theme.css).toContain("@theme {")
    expect(theme.css).toContain(":root {")
    expect(theme.css).toContain(".dark {")
    expect(theme.css).toContain("@layer base")

    // Check semantic colors
    expect(theme.css).toContain("--background")
    expect(theme.css).toContain("--primary")
    expect(theme.css).toContain("--destructive")

    // Check base styles
    expect(theme.css).toContain("bg-background")
    expect(theme.css).toContain("text-foreground")
    expect(theme.css).toContain("border-border")
  })
})
