/**
 * Theme Worker - Tests
 *
 * Tests the theme system:
 * - Color utilities
 * - Palette generation
 * - CSS generation
 * - Dark mode support
 */

import { describe, it, expect } from "vitest"
import {
  // Color utilities
  parseHsl,
  hslToString,
  hslToOklch,
  oklchToString,
  lighten,
  darken,
  saturate,
  generatePalette,
  generateSemanticColors,
  // CSS generation
  generateColorVariables,
  generateCss,
  generateDarkModeCss,
  generateTailwindTheme,
  generateThemeScript,
  generateTheme,
  generateThemeFromPreset,
  createTheme,
  validateTheme,
  // Token presets
  slatePalette,
  zincPalette,
  defaultLightColors,
  defaultDarkColors,
  defaultSpacing,
  defaultTypography,
  defaultRadius,
  defaultShadow,
  defaultTokens,
  defaultTheme,
  blueTheme,
  greenTheme,
  violetTheme,
  getThemePreset,
  getThemePresetNames,
  // Types
  type HslColor,
  type ThemeConfig,
} from "../theme"

// ============================================================================
// Color Utility Tests
// ============================================================================

describe("Color Utilities", () => {
  describe("parseHsl", () => {
    it("should parse valid HSL string", () => {
      const result = parseHsl("hsl(220 50% 50%)")
      expect(result).toEqual({ h: 220, s: 50, l: 50 })
    })

    it("should parse HSL with alpha", () => {
      const result = parseHsl("hsl(220 50% 50% / 0.5)")
      expect(result).toEqual({ h: 220, s: 50, l: 50, alpha: 0.5 })
    })

    it("should return null for invalid string", () => {
      const result = parseHsl("invalid")
      expect(result).toBeNull()
    })

    it("should return null for hex color", () => {
      const result = parseHsl("#ff0000")
      expect(result).toBeNull()
    })
  })

  describe("hslToString", () => {
    it("should convert HSL to string", () => {
      const color: HslColor = { h: 220, s: 50, l: 50 }
      const result = hslToString(color)
      expect(result).toBe("hsl(220 50% 50%)")
    })

    it("should include alpha when present", () => {
      const color: HslColor = { h: 220, s: 50, l: 50, alpha: 0.5 }
      const result = hslToString(color)
      expect(result).toBe("hsl(220 50% 50% / 0.5)")
    })

    it("should not include alpha when 1", () => {
      const color: HslColor = { h: 220, s: 50, l: 50, alpha: 1 }
      const result = hslToString(color)
      expect(result).toBe("hsl(220 50% 50%)")
    })
  })

  describe("hslToOklch", () => {
    it("should convert HSL to OKLCH", () => {
      const hsl: HslColor = { h: 220, s: 50, l: 50 }
      const result = hslToOklch(hsl)

      expect(result.h).toBe(220)
      expect(result.l).toBeGreaterThan(0)
      expect(result.l).toBeLessThanOrEqual(1)
      expect(result.c).toBeGreaterThanOrEqual(0)
    })

    it("should preserve alpha", () => {
      const hsl: HslColor = { h: 220, s: 50, l: 50, alpha: 0.8 }
      const result = hslToOklch(hsl)
      expect(result.alpha).toBe(0.8)
    })
  })

  describe("oklchToString", () => {
    it("should convert OKLCH to string", () => {
      const result = oklchToString({ l: 0.5, c: 0.1, h: 220 })
      expect(result).toBe("oklch(0.5 0.1 220)")
    })

    it("should include alpha when present", () => {
      const result = oklchToString({ l: 0.5, c: 0.1, h: 220, alpha: 0.5 })
      expect(result).toBe("oklch(0.5 0.1 220 / 0.5)")
    })
  })

  describe("lighten", () => {
    it("should lighten a color", () => {
      const result = lighten("hsl(220 50% 50%)", 10)
      expect(result).toBe("hsl(220 50% 60%)")
    })

    it("should cap at 100%", () => {
      const result = lighten("hsl(220 50% 95%)", 20)
      expect(result).toBe("hsl(220 50% 100%)")
    })

    it("should return original if invalid", () => {
      const result = lighten("invalid", 10)
      expect(result).toBe("invalid")
    })
  })

  describe("darken", () => {
    it("should darken a color", () => {
      const result = darken("hsl(220 50% 50%)", 10)
      expect(result).toBe("hsl(220 50% 40%)")
    })

    it("should not go below 0%", () => {
      const result = darken("hsl(220 50% 5%)", 20)
      expect(result).toBe("hsl(220 50% 0%)")
    })
  })

  describe("saturate", () => {
    it("should increase saturation", () => {
      const result = saturate("hsl(220 50% 50%)", 10)
      expect(result).toBe("hsl(220 60% 50%)")
    })

    it("should decrease saturation with negative value", () => {
      const result = saturate("hsl(220 50% 50%)", -20)
      expect(result).toBe("hsl(220 30% 50%)")
    })
  })
})

// ============================================================================
// Palette Generation Tests
// ============================================================================

describe("Palette Generation", () => {
  describe("generatePalette", () => {
    it("should generate palette from base color", () => {
      const palette = generatePalette({
        baseColor: "hsl(220 50% 50%)",
      })

      expect(palette[50]).toBeDefined()
      expect(palette[500]).toBeDefined()
      expect(palette[950]).toBeDefined()
    })

    it("should generate all 11 shades", () => {
      const palette = generatePalette({
        baseColor: "hsl(220 50% 50%)",
      })

      const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
      for (const shade of shades) {
        expect(palette[shade as keyof typeof palette]).toBeDefined()
      }
    })

    it("should return gray palette for invalid color", () => {
      const palette = generatePalette({
        baseColor: "invalid",
      })

      expect(palette[500]).toContain("hsl")
    })

    it("should generate OKLCH format when specified", () => {
      const palette = generatePalette({
        baseColor: "hsl(220 50% 50%)",
        format: "oklch",
      })

      expect(palette[500]).toContain("oklch")
    })
  })

  describe("generateSemanticColors", () => {
    it("should generate all semantic colors", () => {
      const colors = generateSemanticColors({ hue: 220 })

      expect(colors.primary).toBeDefined()
      expect(colors.background).toBeDefined()
      expect(colors.foreground).toBeDefined()
      expect(colors.destructive).toBeDefined()
    })

    it("should use specified hue for primary", () => {
      const colors = generateSemanticColors({ hue: 120 })
      const parsed = parseHsl(colors.primary as string)

      expect(parsed?.h).toBe(120)
    })

    it("should adjust saturation based on option", () => {
      const low = generateSemanticColors({ hue: 220, saturation: "low" })
      const high = generateSemanticColors({ hue: 220, saturation: "high" })

      const lowParsed = parseHsl(low.primary as string)
      const highParsed = parseHsl(high.primary as string)

      expect(highParsed!.s).toBeGreaterThan(lowParsed!.s)
    })

    it("should generate OKLCH when specified", () => {
      const colors = generateSemanticColors({ hue: 220, useOklch: true })

      expect(colors.primary).toContain("oklch")
    })
  })
})

// ============================================================================
// Token Preset Tests
// ============================================================================

describe("Token Presets", () => {
  describe("Color Palettes", () => {
    it("should have complete slate palette", () => {
      expect(slatePalette[50]).toBeDefined()
      expect(slatePalette[950]).toBeDefined()
    })

    it("should have complete zinc palette", () => {
      expect(zincPalette[50]).toBeDefined()
      expect(zincPalette[950]).toBeDefined()
    })
  })

  describe("Semantic Colors", () => {
    it("should have all light mode colors", () => {
      expect(defaultLightColors.primary).toBeDefined()
      expect(defaultLightColors.background).toBeDefined()
      expect(defaultLightColors.destructive).toBeDefined()
      expect(defaultLightColors.ring).toBeDefined()
    })

    it("should have all dark mode colors", () => {
      expect(defaultDarkColors.primary).toBeDefined()
      expect(defaultDarkColors.background).toBeDefined()
    })
  })

  describe("Spacing Scale", () => {
    it("should have common spacing values", () => {
      expect(defaultSpacing[0]).toBe("0px")
      expect(defaultSpacing[4]).toBe("1rem")
      expect(defaultSpacing[8]).toBe("2rem")
    })
  })

  describe("Typography Scale", () => {
    it("should have common sizes", () => {
      expect(defaultTypography.sm).toBeDefined()
      expect(defaultTypography.base).toBeDefined()
      expect(defaultTypography.lg).toBeDefined()
    })

    it("should include fontSize and lineHeight", () => {
      expect(defaultTypography.base.fontSize).toBe("1rem")
      expect(defaultTypography.base.lineHeight).toBe("1.5rem")
    })
  })

  describe("Radius Scale", () => {
    it("should have standard radius values", () => {
      expect(defaultRadius.none).toBe("0px")
      expect(defaultRadius.sm).toBeDefined()
      expect(defaultRadius.lg).toBeDefined()
      expect(defaultRadius.full).toBe("9999px")
    })
  })

  describe("Shadow Scale", () => {
    it("should have standard shadow values", () => {
      expect(defaultShadow.sm).toBeDefined()
      expect(defaultShadow.lg).toBeDefined()
      expect(defaultShadow.none).toBe("0 0 #0000")
    })
  })

  describe("Default Tokens", () => {
    it("should include all token categories", () => {
      expect(defaultTokens.colors).toBeDefined()
      expect(defaultTokens.spacing).toBeDefined()
      expect(defaultTokens.typography).toBeDefined()
      expect(defaultTokens.radius).toBeDefined()
      expect(defaultTokens.shadow).toBeDefined()
    })
  })
})

// ============================================================================
// Theme Preset Tests
// ============================================================================

describe("Theme Presets", () => {
  describe("getThemePreset", () => {
    it("should return default theme", () => {
      const theme = getThemePreset("default")
      expect(theme.name).toBe("default")
    })

    it("should return blue theme", () => {
      const theme = getThemePreset("blue")
      expect(theme.name).toBe("blue")
    })

    it("should return green theme", () => {
      const theme = getThemePreset("green")
      expect(theme.name).toBe("green")
    })

    it("should return violet theme", () => {
      const theme = getThemePreset("violet")
      expect(theme.name).toBe("violet")
    })

    it("should be case-insensitive", () => {
      const theme = getThemePreset("BLUE")
      expect(theme.name).toBe("blue")
    })

    it("should return default for unknown preset", () => {
      const theme = getThemePreset("unknown")
      expect(theme.name).toBe("default")
    })
  })

  describe("getThemePresetNames", () => {
    it("should return all preset names", () => {
      const names = getThemePresetNames()

      expect(names).toContain("default")
      expect(names).toContain("blue")
      expect(names).toContain("green")
      expect(names).toContain("violet")
    })
  })

  describe("Theme Configurations", () => {
    it("default theme should have dark mode", () => {
      expect(defaultTheme.dark).toBeDefined()
      expect(defaultTheme.darkModeClass).toBe("dark")
    })

    it("blue theme should have blue primary", () => {
      const primary = blueTheme.light.colors.primary as string
      expect(primary).toContain("221") // Blue hue
    })

    it("green theme should have green primary", () => {
      const primary = greenTheme.light.colors.primary as string
      expect(primary).toContain("142") // Green hue
    })

    it("violet theme should have violet primary", () => {
      const primary = violetTheme.light.colors.primary as string
      expect(primary).toContain("262") // Violet hue
    })
  })
})

// ============================================================================
// CSS Generation Tests
// ============================================================================

describe("CSS Generation", () => {
  describe("generateColorVariables", () => {
    it("should generate CSS variable map", () => {
      const vars = generateColorVariables(defaultLightColors)

      expect(vars["--primary"]).toBeDefined()
      expect(vars["--background"]).toBeDefined()
      expect(vars["--foreground"]).toBeDefined()
    })

    it("should convert camelCase to kebab-case", () => {
      const vars = generateColorVariables(defaultLightColors)

      expect(vars["--primary-foreground"]).toBeDefined()
      expect(vars["--card-foreground"]).toBeDefined()
    })

    it("should support prefix", () => {
      const vars = generateColorVariables(defaultLightColors, "color")

      expect(vars["--color-primary"]).toBeDefined()
    })
  })

  describe("generateCss", () => {
    it("should generate valid CSS", () => {
      const css = generateCss(defaultTokens)

      expect(css).toContain(":root {")
      expect(css).toContain("--primary:")
      expect(css).toContain("--background:")
      expect(css).toContain("}")
    })

    it("should include radius variable", () => {
      const css = generateCss(defaultTokens)

      expect(css).toContain("--radius:")
    })

    it("should use custom selector", () => {
      const css = generateCss(defaultTokens, ".theme")

      expect(css).toContain(".theme {")
    })
  })

  describe("generateDarkModeCss", () => {
    it("should generate dark mode CSS", () => {
      const css = generateDarkModeCss(defaultDarkColors)

      expect(css).toContain(".dark {")
      expect(css).toContain("--primary:")
      expect(css).toContain("--background:")
    })

    it("should use custom selector", () => {
      const css = generateDarkModeCss(defaultDarkColors, "[data-theme='dark']")

      expect(css).toContain("[data-theme='dark'] {")
    })
  })

  describe("generateTailwindTheme", () => {
    it("should generate @theme block", () => {
      const theme = generateTailwindTheme(defaultTokens)

      expect(theme).toContain("@theme {")
      expect(theme).toContain("}")
    })

    it("should include color variables", () => {
      const theme = generateTailwindTheme(defaultTokens)

      expect(theme).toContain("--color-primary:")
      expect(theme).toContain("--color-background:")
    })

    it("should include radius variables", () => {
      const theme = generateTailwindTheme(defaultTokens)

      expect(theme).toContain("--radius-")
    })

    it("should include shadow variables", () => {
      const theme = generateTailwindTheme(defaultTokens)

      expect(theme).toContain("--shadow-")
    })
  })

  describe("generateThemeScript", () => {
    it("should generate valid JavaScript", () => {
      const script = generateThemeScript(defaultTheme)

      expect(script).toContain("function")
      expect(script).toContain("localStorage")
      expect(script).toContain("prefers-color-scheme")
    })

    it("should use configured dark class", () => {
      const script = generateThemeScript(defaultTheme)

      expect(script).toContain("'dark'")
    })

    it("should include color-scheme when enabled", () => {
      const script = generateThemeScript(defaultTheme)

      expect(script).toContain("colorScheme")
    })
  })
})

// ============================================================================
// Theme Generation Tests
// ============================================================================

describe("Theme Generation", () => {
  describe("generateTheme", () => {
    it("should generate complete theme output", () => {
      const result = generateTheme(defaultTheme)

      expect(result.css).toBeDefined()
      expect(result.tailwindTheme).toBeDefined()
      expect(result.cssVariables).toBeDefined()
      expect(result.darkModeCss).toBeDefined()
      expect(result.jsTheme).toBeDefined()
    })

    it("should include all CSS variables", () => {
      const result = generateTheme(defaultTheme)

      expect(result.cssVariables["--primary"]).toBeDefined()
      expect(result.cssVariables["--background"]).toBeDefined()
    })
  })

  describe("generateThemeFromPreset", () => {
    it("should generate from preset name", () => {
      const result = generateThemeFromPreset("blue")

      expect(result.css).toContain("--primary:")
    })

    it("should work with default preset", () => {
      const result = generateThemeFromPreset("default")

      expect(result.css).toBeDefined()
      expect(result.tailwindTheme).toBeDefined()
    })
  })

  describe("createTheme", () => {
    it("should create custom theme", () => {
      const config = createTheme("custom", { primaryHue: 180 })

      expect(config.name).toBe("custom")
      expect(config.light.colors.primary).toBeDefined()
    })

    it("should use specified hue", () => {
      const config = createTheme("teal", { primaryHue: 180 })
      const primary = config.light.colors.primary as string
      const parsed = parseHsl(primary)

      expect(parsed?.h).toBe(180)
    })

    it("should include dark mode by default", () => {
      const config = createTheme("custom", { primaryHue: 220 })

      expect(config.dark).toBeDefined()
    })

    it("should exclude dark mode when disabled", () => {
      const config = createTheme("custom", { primaryHue: 220, darkMode: false })

      expect(config.dark).toBeUndefined()
    })

    it("should support OKLCH format", () => {
      const config = createTheme("custom", { primaryHue: 220, useOklch: true })
      const primary = config.light.colors.primary as string

      expect(primary).toContain("oklch")
    })
  })

  describe("validateTheme", () => {
    it("should validate valid theme", () => {
      const result = validateTheme(defaultTheme)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it("should reject theme without name", () => {
      const invalid: ThemeConfig = {
        name: "",
        light: defaultTokens,
      }
      const result = validateTheme(invalid)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain("Theme name is required")
    })

    it("should reject theme without colors", () => {
      const invalid = {
        name: "test",
        light: {} as any,
      }
      const result = validateTheme(invalid)

      expect(result.valid).toBe(false)
    })

    it("should check for required colors", () => {
      const invalid: ThemeConfig = {
        name: "test",
        light: {
          ...defaultTokens,
          colors: {
            ...defaultLightColors,
            primary: "",
          },
        },
      }
      const result = validateTheme(invalid)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes("primary"))).toBe(true)
    })
  })
})

// ============================================================================
// Integration Tests
// ============================================================================

describe("Theme Worker Integration", () => {
  it("should generate consistent themes across presets", () => {
    const presets = getThemePresetNames()

    for (const preset of presets) {
      const theme = generateThemeFromPreset(preset)

      expect(theme.css).toContain(":root")
      expect(theme.tailwindTheme).toContain("@theme")
      expect(Object.keys(theme.cssVariables).length).toBeGreaterThan(10)
    }
  })

  it("should create valid custom theme", () => {
    const config = createTheme("my-theme", {
      primaryHue: 280,
      saturation: "high",
    })
    const validation = validateTheme(config)

    expect(validation.valid).toBe(true)

    const generated = generateTheme(config)
    expect(generated.css).toBeDefined()
    expect(generated.darkModeCss).toBeDefined()
  })

  it("should handle full theme workflow", () => {
    // 1. Get preset
    const preset = getThemePreset("blue")

    // 2. Validate
    const validation = validateTheme(preset)
    expect(validation.valid).toBe(true)

    // 3. Generate
    const generated = generateTheme(preset)

    // 4. Verify output
    expect(generated.css).toContain("--primary")
    expect(generated.darkModeCss).toContain("--primary")
    expect(generated.tailwindTheme).toContain("@theme")
    expect(generated.jsTheme).toContain("setTheme")
  })
})
