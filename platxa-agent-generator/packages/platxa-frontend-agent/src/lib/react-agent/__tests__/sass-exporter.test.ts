/**
 * Sass Variable Exporter - Tests
 *
 * Tests for Sass variable generation:
 * - Variable export
 * - Maps generation
 * - Functions generation
 * - Dark mode support
 * - Sass 1.x compatibility
 */

import { describe, it, expect } from "vitest"
import {
  exportToSass,
  exportThemesToSass,
  generateThemeSwitcher,
} from "../sass"
import type { ThemeConfig, SemanticColors, DesignTokens } from "../theme/types"

// =============================================================================
// Test Fixtures - Production-grade complete theme configurations
// =============================================================================

/**
 * Create a complete SemanticColors object with all required properties
 */
function createSemanticColors(overrides: Partial<SemanticColors> = {}): SemanticColors {
  return {
    primary: "#3b82f6",
    primaryForeground: "#ffffff",
    secondary: "#64748b",
    secondaryForeground: "#ffffff",
    muted: "#f1f5f9",
    mutedForeground: "#64748b",
    accent: "#f59e0b",
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
    ring: "#3b82f6",
    ...overrides,
  }
}

/**
 * Partial design tokens for test overrides
 */
interface PartialDesignTokens {
  colors?: Partial<SemanticColors>
  spacing?: Partial<DesignTokens["spacing"]>
  typography?: Partial<DesignTokens["typography"]>
  fontWeight?: Partial<DesignTokens["fontWeight"]>
  radius?: Partial<DesignTokens["radius"]>
  shadow?: Partial<DesignTokens["shadow"]>
}

/**
 * Create a complete DesignTokens object with all required properties
 */
function createDesignTokens(overrides: PartialDesignTokens = {}): DesignTokens {
  return {
    colors: createSemanticColors(overrides.colors),
    spacing: overrides.spacing ?? {},
    typography: overrides.typography ?? {},
    fontWeight: overrides.fontWeight ?? {},
    radius: overrides.radius ?? {},
    shadow: overrides.shadow ?? {},
  }
}

/**
 * Create a complete ThemeConfig for testing
 */
function createThemeConfig(
  name: string,
  lightOverrides: PartialDesignTokens = {},
  darkOverrides?: Partial<SemanticColors>
): ThemeConfig {
  return {
    name,
    light: createDesignTokens(lightOverrides),
    dark: darkOverrides,
  }
}

const basicTheme = createThemeConfig("test-brand")

const fullTheme = createThemeConfig(
  "full-brand",
  {
    spacing: {
      1: "0.25rem",
      2: "0.5rem",
      4: "1rem",
      6: "1.5rem",
      8: "2rem",
    },
    typography: {
      sm: { fontSize: "0.875rem", lineHeight: "1.25rem" },
      base: { fontSize: "1rem", lineHeight: "1.5rem" },
      lg: { fontSize: "1.125rem", lineHeight: "1.75rem" },
    },
    radius: {
      sm: "0.25rem",
      md: "0.5rem",
      lg: "1rem",
      full: "9999px",
    },
    shadow: {
      sm: "0 1px 2px rgba(0,0,0,0.05)",
      md: "0 4px 6px rgba(0,0,0,0.1)",
      lg: "0 10px 15px rgba(0,0,0,0.1)",
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      bold: 700,
    },
  },
  {
    primary: "#60a5fa",
    secondary: "#94a3b8",
    background: "#0f172a",
    foreground: "#f8fafc",
  }
)

const multipleThemes: ThemeConfig[] = [
  createThemeConfig("light-theme", {
    colors: { primary: "#3b82f6", background: "#ffffff" },
  }),
  createThemeConfig("dark-theme", {
    colors: { primary: "#60a5fa", background: "#1e293b" },
  }),
]

// =============================================================================
// Basic Export Tests
// =============================================================================

describe("exportToSass", () => {
  it("should return all expected properties", () => {
    const result = exportToSass(basicTheme)

    expect(result).toHaveProperty("variables")
    expect(result).toHaveProperty("maps")
    expect(result).toHaveProperty("functions")
    expect(result).toHaveProperty("index")
    expect(result).toHaveProperty("files")
  })

  it("should generate correct number of files", () => {
    const result = exportToSass(basicTheme)

    // variables, maps, functions, index
    expect(result.files.length).toBe(4)
  })

  it("should use scss format by default", () => {
    const result = exportToSass(basicTheme)

    expect(result.files[0].name).toBe("_variables.scss")
    expect(result.files[1].name).toBe("_maps.scss")
  })

  it("should respect sass format option", () => {
    const result = exportToSass(basicTheme, { format: "sass" })

    expect(result.files[0].name).toBe("_variables.sass")
    expect(result.files[1].name).toBe("_maps.sass")
  })
})

// =============================================================================
// Variables Generation Tests
// =============================================================================

describe("Variables generation", () => {
  it("should generate color variables", () => {
    const result = exportToSass(basicTheme)

    expect(result.variables).toContain("$color-primary: #3b82f6")
    expect(result.variables).toContain("$color-secondary: #64748b")
    expect(result.variables).toContain("$color-background: #ffffff")
  })

  it("should use !default flag by default", () => {
    const result = exportToSass(basicTheme)

    expect(result.variables).toContain("!default")
  })

  it("should respect useDefault: false option", () => {
    const result = exportToSass(basicTheme, { useDefault: false })

    expect(result.variables).not.toContain("!default")
  })

  it("should apply variable prefix", () => {
    const result = exportToSass(basicTheme, { prefix: "brand-" })

    expect(result.variables).toContain("$brand-color-primary")
  })

  it("should convert camelCase to kebab-case", () => {
    const result = exportToSass(basicTheme)

    // primaryForeground should become primary-foreground
    expect(result.variables).toContain("$color-primary-foreground")
    expect(result.variables).toContain("$color-card-foreground")
  })

  it("should include comments when enabled", () => {
    const result = exportToSass(basicTheme, { includeComments: true })

    expect(result.variables).toContain("// Brand Token Variables")
    expect(result.variables).toContain("// Colors (Light Mode)")
  })

  it("should exclude comments when disabled", () => {
    const result = exportToSass(basicTheme, { includeComments: false })

    expect(result.variables).not.toContain("// Brand Token Variables")
  })

  it("should generate spacing variables", () => {
    const result = exportToSass(fullTheme)

    expect(result.variables).toContain("$spacing-1: 0.25rem")
    expect(result.variables).toContain("$spacing-4: 1rem")
  })

  it("should generate typography variables", () => {
    const result = exportToSass(fullTheme)

    expect(result.variables).toContain("$font-size-base: 1rem")
    expect(result.variables).toContain("$line-height-base: 1.5rem")
  })

  it("should generate radius variables", () => {
    const result = exportToSass(fullTheme)

    expect(result.variables).toContain("$radius-sm: 0.25rem")
    expect(result.variables).toContain("$radius-full: 9999px")
  })

  it("should generate shadow variables", () => {
    const result = exportToSass(fullTheme)

    expect(result.variables).toContain("$shadow-sm: 0 1px 2px rgba(0,0,0,0.05)")
    expect(result.variables).toContain("$shadow-md: 0 4px 6px rgba(0,0,0,0.1)")
  })

  it("should generate font weight variables", () => {
    const result = exportToSass(fullTheme)

    expect(result.variables).toContain("$font-weight-normal: 400")
    expect(result.variables).toContain("$font-weight-bold: 700")
  })

  it("should generate dark mode variables when enabled", () => {
    const result = exportToSass(fullTheme, { includeDarkMode: true })

    expect(result.variables).toContain("$color-primary-dark: #60a5fa")
    expect(result.variables).toContain("$color-background-dark: #0f172a")
  })

  it("should exclude dark mode variables when disabled", () => {
    const result = exportToSass(fullTheme, { includeDarkMode: false })

    expect(result.variables).not.toContain("$color-primary-dark")
  })

  it("should not use semicolons in sass format", () => {
    const result = exportToSass(basicTheme, { format: "sass" })

    // SASS indented syntax doesn't use semicolons after variable declarations
    const lines = result.variables.split("\n").filter((l) => l.startsWith("$"))
    for (const line of lines) {
      expect(line.endsWith(";")).toBe(false)
    }
  })

  it("should use semicolons in scss format", () => {
    const result = exportToSass(basicTheme, { format: "scss" })

    const lines = result.variables.split("\n").filter((l) => l.startsWith("$"))
    for (const line of lines) {
      expect(line.endsWith(";")).toBe(true)
    }
  })
})

// =============================================================================
// Maps Generation Tests
// =============================================================================

describe("Maps generation", () => {
  it("should generate maps when enabled", () => {
    const result = exportToSass(basicTheme, { includeMaps: true })

    expect(result.maps).toBeDefined()
    expect(result.maps).toContain("$colors: (")
  })

  it("should not generate maps when disabled", () => {
    const result = exportToSass(basicTheme, { includeMaps: false })

    expect(result.maps).toBeUndefined()
  })

  it("should generate colors map with all colors", () => {
    const result = exportToSass(basicTheme, { includeMaps: true })

    expect(result.maps).toContain("'primary': #3b82f6")
    expect(result.maps).toContain("'secondary': #64748b")
  })

  it("should generate spacing map", () => {
    const result = exportToSass(fullTheme, { includeMaps: true })

    expect(result.maps).toContain("$spacing: (")
    expect(result.maps).toContain("'4': 1rem")
  })

  it("should generate typography map with nested structure", () => {
    const result = exportToSass(fullTheme, { includeMaps: true })

    expect(result.maps).toContain("$typography: (")
    expect(result.maps).toContain("'base': (")
    expect(result.maps).toContain("'font-size': 1rem")
    expect(result.maps).toContain("'line-height': 1.5rem")
  })

  it("should generate radius map", () => {
    const result = exportToSass(fullTheme, { includeMaps: true })

    expect(result.maps).toContain("$radius: (")
    expect(result.maps).toContain("'full': 9999px")
  })

  it("should generate shadow map", () => {
    const result = exportToSass(fullTheme, { includeMaps: true })

    expect(result.maps).toContain("$shadow: (")
  })

  it("should generate dark colors map", () => {
    const result = exportToSass(fullTheme, { includeMaps: true, includeDarkMode: true })

    expect(result.maps).toContain("$colors-dark: (")
    expect(result.maps).toContain("'primary': #60a5fa")
  })

  it("should generate all-tokens map", () => {
    const result = exportToSass(fullTheme, { includeMaps: true })

    expect(result.maps).toContain("$tokens: (")
    expect(result.maps).toContain("'colors': $colors")
    expect(result.maps).toContain("'spacing': $spacing")
  })

  it("should apply prefix to maps", () => {
    const result = exportToSass(basicTheme, { includeMaps: true, prefix: "brand-" })

    expect(result.maps).toContain("$brand-colors: (")
  })

  it("should convert camelCase keys to kebab-case in maps", () => {
    const result = exportToSass(basicTheme, { includeMaps: true })

    expect(result.maps).toContain("'primary-foreground': #ffffff")
  })
})

// =============================================================================
// Functions Generation Tests
// =============================================================================

describe("Functions generation", () => {
  it("should generate functions when enabled", () => {
    const result = exportToSass(basicTheme, { includeFunctions: true })

    expect(result.functions).toBeDefined()
  })

  it("should not generate functions when disabled", () => {
    const result = exportToSass(basicTheme, { includeFunctions: false })

    expect(result.functions).toBeUndefined()
  })

  it("should use Sass 1.x @use syntax", () => {
    const result = exportToSass(basicTheme, { includeFunctions: true })

    expect(result.functions).toContain("@use 'sass:map'")
    expect(result.functions).toContain("@use 'sass:meta'")
  })

  it("should generate color function", () => {
    const result = exportToSass(basicTheme, { includeFunctions: true })

    expect(result.functions).toContain("@function color($name, $dark: false)")
    expect(result.functions).toContain("@return map.get($colors, $name)")
  })

  it("should generate color function with dark mode support", () => {
    const result = exportToSass(basicTheme, { includeFunctions: true })

    expect(result.functions).toContain("@if $dark and map.has-key($colors-dark, $name)")
  })

  it("should generate spacing function", () => {
    const result = exportToSass(basicTheme, { includeFunctions: true })

    expect(result.functions).toContain("@function spacing($name)")
    expect(result.functions).toContain("@return map.get($spacing, $name)")
  })

  it("should generate typography function", () => {
    const result = exportToSass(basicTheme, { includeFunctions: true })

    expect(result.functions).toContain("@function typography($name, $property: null)")
  })

  it("should generate radius function", () => {
    const result = exportToSass(basicTheme, { includeFunctions: true })

    expect(result.functions).toContain("@function radius($name)")
  })

  it("should generate shadow function", () => {
    const result = exportToSass(basicTheme, { includeFunctions: true })

    expect(result.functions).toContain("@function shadow($name)")
  })

  it("should generate token-exists function", () => {
    const result = exportToSass(basicTheme, { includeFunctions: true })

    expect(result.functions).toContain("@function token-exists($category, $name)")
  })

  it("should generate token-vars mixin", () => {
    const result = exportToSass(basicTheme, { includeFunctions: true })

    expect(result.functions).toContain("@mixin token-vars($category: null)")
    expect(result.functions).toContain("--#{$category}-#{$name}: #{$value}")
  })

  it("should generate dark-mode mixin", () => {
    const result = exportToSass(basicTheme, { includeFunctions: true })

    expect(result.functions).toContain("@mixin dark-mode")
    expect(result.functions).toContain("@each $name, $value in $colors-dark")
  })

  it("should include error handling in functions", () => {
    const result = exportToSass(basicTheme, { includeFunctions: true })

    expect(result.functions).toContain('@error "Unknown color token: #{$name}"')
    expect(result.functions).toContain('@error "Unknown spacing token: #{$name}"')
  })

  it("should apply prefix to functions", () => {
    const result = exportToSass(basicTheme, { includeFunctions: true, prefix: "brand-" })

    expect(result.functions).toContain("@function brand-color($name")
    expect(result.functions).toContain("@function brand-spacing($name)")
  })
})

// =============================================================================
// Index Generation Tests
// =============================================================================

describe("Index generation", () => {
  it("should use Sass 1.x @forward syntax", () => {
    const result = exportToSass(basicTheme)

    expect(result.index).toContain("@forward 'variables'")
    expect(result.index).toContain("@forward 'maps'")
    expect(result.index).toContain("@forward 'functions'")
  })

  it("should not include self-reference in forwards", () => {
    const result = exportToSass(basicTheme)

    expect(result.index).not.toContain("@forward 'index'")
  })

  it("should include comments when enabled", () => {
    const result = exportToSass(basicTheme, { includeComments: true })

    expect(result.index).toContain("// Brand Tokens - Main Entry Point")
  })
})

// =============================================================================
// File Info Tests
// =============================================================================

describe("File info", () => {
  it("should provide correct file names", () => {
    const result = exportToSass(basicTheme)

    const names = result.files.map((f) => f.name)
    expect(names).toContain("_variables.scss")
    expect(names).toContain("_maps.scss")
    expect(names).toContain("_functions.scss")
    expect(names).toContain("_index.scss")
  })

  it("should provide descriptions for all files", () => {
    const result = exportToSass(basicTheme)

    for (const file of result.files) {
      expect(file.description).toBeDefined()
      expect(file.description.length).toBeGreaterThan(0)
    }
  })

  it("should exclude maps file when disabled", () => {
    const result = exportToSass(basicTheme, { includeMaps: false })

    const names = result.files.map((f) => f.name)
    expect(names).not.toContain("_maps.scss")
  })

  it("should exclude functions file when disabled", () => {
    const result = exportToSass(basicTheme, { includeFunctions: false })

    const names = result.files.map((f) => f.name)
    expect(names).not.toContain("_functions.scss")
  })
})

// =============================================================================
// Batch Export Tests
// =============================================================================

describe("exportThemesToSass", () => {
  it("should export multiple themes", () => {
    const result = exportThemesToSass(multipleThemes)

    expect(result.size).toBe(2)
    expect(result.has("light-theme")).toBe(true)
    expect(result.has("dark-theme")).toBe(true)
  })

  it("should apply options to all themes", () => {
    const result = exportThemesToSass(multipleThemes, { prefix: "app-" })

    const lightExport = result.get("light-theme")
    expect(lightExport?.variables).toContain("$app-color-primary")
  })

  it("should return independent exports for each theme", () => {
    const result = exportThemesToSass(multipleThemes)

    const lightExport = result.get("light-theme")
    const darkExport = result.get("dark-theme")

    expect(lightExport?.variables).toContain("#3b82f6")
    expect(darkExport?.variables).toContain("#60a5fa")
  })
})

// =============================================================================
// Theme Switcher Tests
// =============================================================================

describe("generateThemeSwitcher", () => {
  it("should generate themes map", () => {
    const result = generateThemeSwitcher(multipleThemes)

    expect(result).toContain("$themes: (")
    expect(result).toContain("'light-theme': (")
    expect(result).toContain("'dark-theme': (")
  })

  it("should include all colors for each theme", () => {
    const result = generateThemeSwitcher(multipleThemes)

    expect(result).toContain("'primary': #3b82f6")
    expect(result).toContain("'primary': #60a5fa")
  })

  it("should generate theme mixin", () => {
    const result = generateThemeSwitcher(multipleThemes)

    expect(result).toContain("@mixin theme($name)")
    expect(result).toContain("$theme: map-get($themes, $name)")
  })

  it("should include error handling for unknown themes", () => {
    const result = generateThemeSwitcher(multipleThemes)

    expect(result).toContain('@error "Unknown theme: #{$name}"')
  })

  it("should generate CSS custom properties in mixin", () => {
    const result = generateThemeSwitcher(multipleThemes)

    expect(result).toContain("--color-#{$token}: #{$value}")
  })

  it("should include comments when enabled", () => {
    const result = generateThemeSwitcher(multipleThemes, { includeComments: true })

    expect(result).toContain("// Theme Switcher")
  })

  it("should convert camelCase keys to kebab-case", () => {
    const result = generateThemeSwitcher(multipleThemes)

    expect(result).toContain("'primary-foreground': #ffffff")
  })
})

// =============================================================================
// Edge Cases
// =============================================================================

describe("Edge cases", () => {
  it("should handle theme with only colors (no spacing, radius, etc)", () => {
    const result = exportToSass(basicTheme)

    expect(result.variables).toBeDefined()
    expect(result.variables).toContain("$color-primary")
    // Should not have spacing, radius, etc. sections since they're empty
    expect(result.variables).not.toContain("// Spacing")
    expect(result.variables).not.toContain("// Border Radius")
  })

  it("should handle theme without dark mode", () => {
    const result = exportToSass(basicTheme, { includeDarkMode: true })

    // Should not error, just skip dark mode section
    expect(result.variables).not.toContain("-dark:")
  })

  it("should handle special characters in shadow values", () => {
    const themeWithComplexShadow = createThemeConfig("test", {
      shadow: {
        md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
      },
    })
    const result = exportToSass(themeWithComplexShadow)

    expect(result.variables).toContain(
      "$shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
    )
  })

  it("should handle numeric font weights", () => {
    const result = exportToSass(fullTheme)

    // Font weights should be stringified
    expect(result.variables).toContain("$font-weight-normal: 400")
    expect(result.variables).not.toContain("$font-weight-normal: \"400\"")
  })

  it("should handle empty themes array for batch export", () => {
    const result = exportThemesToSass([])

    expect(result.size).toBe(0)
  })

  it("should handle single theme for theme switcher", () => {
    const result = generateThemeSwitcher([basicTheme])

    expect(result).toContain("'test-brand': (")
    expect(result).toContain("@mixin theme($name)")
  })

  it("should handle typography with only fontSize", () => {
    const themeWithPartialTypo = createThemeConfig("test", {
      typography: {
        // Only fontSize, no lineHeight
        xl: { fontSize: "1.25rem", lineHeight: "1.75rem" },
      },
    })
    const result = exportToSass(themeWithPartialTypo)

    expect(result.variables).toContain("$font-size-xl: 1.25rem")
    expect(result.variables).toContain("$line-height-xl: 1.75rem")
  })
})

// =============================================================================
// Options Combinations
// =============================================================================

describe("Options combinations", () => {
  it("should handle all options disabled", () => {
    const result = exportToSass(basicTheme, {
      includeMaps: false,
      includeFunctions: false,
      includeDarkMode: false,
      includeComments: false,
      useDefault: false,
    })

    // Should only have variables and index
    expect(result.files.length).toBe(2)
    expect(result.maps).toBeUndefined()
    expect(result.functions).toBeUndefined()
  })

  it("should handle all options enabled", () => {
    const result = exportToSass(fullTheme, {
      includeMaps: true,
      includeFunctions: true,
      includeDarkMode: true,
      includeComments: true,
      useDefault: true,
      prefix: "brand-",
    })

    expect(result.files.length).toBe(4)
    expect(result.variables).toContain("// Brand Token Variables")
    expect(result.variables).toContain("$brand-color-primary")
    expect(result.variables).toContain("!default")
    expect(result.variables).toContain("$brand-color-primary-dark")
    expect(result.maps).toContain("$brand-colors")
    expect(result.functions).toContain("@function brand-color")
  })

  it("should handle custom indentation", () => {
    const result = exportToSass(basicTheme, {
      includeMaps: true,
      indent: 4,
    })

    // Maps should use 4-space indentation
    expect(result.maps).toContain("    'primary':")
  })
})

// =============================================================================
// ColorValue Conversion Tests
// =============================================================================

describe("ColorValue conversion", () => {
  it("should handle OKLCH color values", () => {
    const themeWithOklch = createThemeConfig("oklch-theme", {
      colors: {
        primary: { l: 0.6, c: 0.2, h: 250 },
      },
    })
    const result = exportToSass(themeWithOklch)

    expect(result.variables).toContain("$color-primary: oklch(0.6 0.2 250)")
  })

  it("should handle HSL color values", () => {
    const themeWithHsl = createThemeConfig("hsl-theme", {
      colors: {
        primary: { h: 220, s: 90, l: 56 },
      },
    })
    const result = exportToSass(themeWithHsl)

    expect(result.variables).toContain("$color-primary: hsl(220 90% 56%)")
  })

  it("should handle RGB color values", () => {
    const themeWithRgb = createThemeConfig("rgb-theme", {
      colors: {
        primary: { r: 59, g: 130, b: 246 },
      },
    })
    const result = exportToSass(themeWithRgb)

    expect(result.variables).toContain("$color-primary: rgb(59 130 246)")
  })

  it("should handle color values with alpha", () => {
    const themeWithAlpha = createThemeConfig("alpha-theme", {
      colors: {
        primary: { r: 59, g: 130, b: 246, alpha: 0.5 },
      },
    })
    const result = exportToSass(themeWithAlpha)

    expect(result.variables).toContain("$color-primary: rgb(59 130 246 / 0.5)")
  })
})
