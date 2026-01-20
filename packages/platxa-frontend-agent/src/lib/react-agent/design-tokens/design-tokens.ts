/**
 * Design Tokens Module
 *
 * Implements Tailwind v4 CSS-first theming with @theme directive.
 * Generates design tokens, CSS variables, and theme configurations.
 */

import type {
  DesignTokens,
  SemanticColors,
  GeneratedTheme,
  ThemeGenerationOptions,
  TokenValidationResult,
  ColorScale,
  OklchColor,
  ColorFormat,
  NamingConvention,
  ChartColors,
} from "./types"

// ============================================================================
// Default Tokens
// ============================================================================

/**
 * Default semantic colors (shadcn/ui style)
 */
export const defaultLightColors: SemanticColors = {
  background: "0 0% 100%",
  foreground: "240 10% 3.9%",
  card: "0 0% 100%",
  cardForeground: "240 10% 3.9%",
  popover: "0 0% 100%",
  popoverForeground: "240 10% 3.9%",
  primary: "240 5.9% 10%",
  primaryForeground: "0 0% 98%",
  secondary: "240 4.8% 95.9%",
  secondaryForeground: "240 5.9% 10%",
  muted: "240 4.8% 95.9%",
  mutedForeground: "240 3.8% 46.1%",
  accent: "240 4.8% 95.9%",
  accentForeground: "240 5.9% 10%",
  destructive: "0 84.2% 60.2%",
  destructiveForeground: "0 0% 98%",
  border: "240 5.9% 90%",
  input: "240 5.9% 90%",
  ring: "240 5.9% 10%",
}

/**
 * Default dark mode colors
 */
export const defaultDarkColors: SemanticColors = {
  background: "240 10% 3.9%",
  foreground: "0 0% 98%",
  card: "240 10% 3.9%",
  cardForeground: "0 0% 98%",
  popover: "240 10% 3.9%",
  popoverForeground: "0 0% 98%",
  primary: "0 0% 98%",
  primaryForeground: "240 5.9% 10%",
  secondary: "240 3.7% 15.9%",
  secondaryForeground: "0 0% 98%",
  muted: "240 3.7% 15.9%",
  mutedForeground: "240 5% 64.9%",
  accent: "240 3.7% 15.9%",
  accentForeground: "0 0% 98%",
  destructive: "0 62.8% 30.6%",
  destructiveForeground: "0 0% 98%",
  border: "240 3.7% 15.9%",
  input: "240 3.7% 15.9%",
  ring: "240 4.9% 83.9%",
}

/**
 * Default chart colors
 */
export const defaultChartColors: ChartColors = {
  chart1: "12 76% 61%",
  chart2: "173 58% 39%",
  chart3: "197 37% 24%",
  chart4: "43 74% 66%",
  chart5: "27 87% 67%",
}

/**
 * Default border radius
 */
export const defaultBorderRadius = {
  lg: "0.5rem",
  md: "calc(0.5rem - 2px)",
  sm: "calc(0.5rem - 4px)",
}

// ============================================================================
// @theme Directive Generation
// ============================================================================

/**
 * Generates Tailwind v4 @theme directive CSS
 */
export function generateThemeDirective(
  tokens: DesignTokens,
  options: ThemeGenerationOptions = {}
): string {
  const lines: string[] = []
  const { naming = "kebab-case", prefix = "" } = options

  lines.push("@theme {")

  // Colors
  if (tokens.colors) {
    lines.push("  /* Colors */")

    // Add color scales if present
    if (tokens.colors.scales) {
      for (const [name, scale] of Object.entries(tokens.colors.scales)) {
        for (const [shade, value] of Object.entries(scale)) {
          const varName = formatVariableName(`color-${name}-${shade}`, naming, prefix)
          lines.push(`  --${varName}: ${value};`)
        }
      }
    }
  }

  // Spacing
  if (tokens.spacing) {
    lines.push("")
    lines.push("  /* Spacing */")
    for (const [key, value] of Object.entries(tokens.spacing)) {
      const varName = formatVariableName(`spacing-${key}`, naming, prefix)
      lines.push(`  --${varName}: ${value};`)
    }
  }

  // Typography
  if (tokens.typography?.fontFamily) {
    lines.push("")
    lines.push("  /* Font Families */")
    for (const [key, value] of Object.entries(tokens.typography.fontFamily)) {
      const varName = formatVariableName(`font-${key}`, naming, prefix)
      const fontValue = Array.isArray(value) ? value.join(", ") : value
      lines.push(`  --${varName}: ${fontValue};`)
    }
  }

  // Border Radius
  if (tokens.borderRadius) {
    lines.push("")
    lines.push("  /* Border Radius */")
    for (const [key, value] of Object.entries(tokens.borderRadius)) {
      const varName = formatVariableName(`radius-${key === "DEFAULT" ? "" : key}`, naming, prefix)
      lines.push(`  --${varName.replace(/-$/, "")}: ${value};`)
    }
  }

  // Shadows
  if (tokens.shadows) {
    lines.push("")
    lines.push("  /* Shadows */")
    for (const [key, value] of Object.entries(tokens.shadows)) {
      const varName = formatVariableName(`shadow-${key === "DEFAULT" ? "" : key}`, naming, prefix)
      lines.push(`  --${varName.replace(/-$/, "")}: ${value};`)
    }
  }

  // Breakpoints
  if (tokens.breakpoints) {
    lines.push("")
    lines.push("  /* Breakpoints */")
    for (const [key, value] of Object.entries(tokens.breakpoints)) {
      const varName = formatVariableName(`breakpoint-${key}`, naming, prefix)
      lines.push(`  --${varName}: ${value};`)
    }
  }

  lines.push("}")

  return lines.join("\n")
}

// ============================================================================
// CSS Variables Generation
// ============================================================================

/**
 * Generates CSS variables for :root (light mode)
 */
export function generateRootVariables(
  colors: SemanticColors,
  options: ThemeGenerationOptions = {}
): string {
  const { naming = "kebab-case", prefix = "" } = options
  const lines: string[] = []

  lines.push(":root {")

  for (const [key, value] of Object.entries(colors)) {
    const varName = formatVariableName(key, naming, prefix)
    lines.push(`  --${varName}: ${value};`)
  }

  lines.push("}")

  return lines.join("\n")
}

/**
 * Generates CSS variables for .dark mode
 */
export function generateDarkVariables(
  colors: SemanticColors,
  options: ThemeGenerationOptions = {}
): string {
  const { naming = "kebab-case", prefix = "" } = options
  const lines: string[] = []

  lines.push(".dark {")

  for (const [key, value] of Object.entries(colors)) {
    const varName = formatVariableName(key, naming, prefix)
    lines.push(`  --${varName}: ${value};`)
  }

  lines.push("}")

  return lines.join("\n")
}

/**
 * Generates chart color variables
 */
export function generateChartVariables(
  colors: ChartColors,
  options: ThemeGenerationOptions = {}
): string {
  const { naming = "kebab-case", prefix = "" } = options
  const lines: string[] = []

  for (const [key, value] of Object.entries(colors)) {
    const varName = formatVariableName(key, naming, prefix)
    lines.push(`  --${varName}: ${value};`)
  }

  return lines.join("\n")
}

// ============================================================================
// Complete Theme Generation
// ============================================================================

/**
 * Generates complete theme CSS
 */
export function generateTheme(
  tokens: DesignTokens,
  options: ThemeGenerationOptions = {}
): GeneratedTheme {
  const {
    includeThemeDirective = true,
    includeCssVariables = true,
    includeDarkMode = true,
    minify = false,
  } = options

  const parts: string[] = []

  // Tailwind imports
  parts.push('@import "tailwindcss";')
  parts.push("")

  // @theme directive
  let themeDirective = ""
  if (includeThemeDirective) {
    themeDirective = generateThemeDirective(tokens, options)
    parts.push(themeDirective)
    parts.push("")
  }

  // CSS variables
  let rootVariables = ""
  let darkVariables = ""

  if (includeCssVariables) {
    // Base layer for variables
    parts.push("@layer base {")

    // Root variables (light mode)
    rootVariables = generateRootVariables(tokens.colors.light, options)
    parts.push(rootVariables)

    // Chart colors in root
    if (tokens.colors.chart) {
      const rootLines = rootVariables.split("\n")
      const chartVars = generateChartVariables(tokens.colors.chart, options)
      // Insert before closing brace
      rootLines.splice(-1, 0, chartVars)
      rootVariables = rootLines.join("\n")
    }

    // Dark mode variables
    if (includeDarkMode) {
      parts.push("")
      darkVariables = generateDarkVariables(tokens.colors.dark, options)
      parts.push(darkVariables)
    }

    parts.push("}")
  }

  // Global styles
  parts.push("")
  parts.push("@layer base {")
  parts.push("  * {")
  parts.push("    @apply border-border;")
  parts.push("  }")
  parts.push("  body {")
  parts.push("    @apply bg-background text-foreground;")
  parts.push("  }")
  parts.push("}")

  let css = parts.join("\n")

  if (minify) {
    css = minifyCss(css)
  }

  // Count tokens
  let tokenCount = 0
  let colorCount = 0

  if (tokens.colors) {
    colorCount = Object.keys(tokens.colors.light).length
    if (tokens.colors.chart) {
      colorCount += Object.keys(tokens.colors.chart).length
    }
    tokenCount += colorCount * 2 // light + dark
  }
  if (tokens.spacing) tokenCount += Object.keys(tokens.spacing).length
  if (tokens.borderRadius) tokenCount += Object.keys(tokens.borderRadius).length
  if (tokens.shadows) tokenCount += Object.keys(tokens.shadows).length

  return {
    themeDirective,
    rootVariables,
    darkVariables,
    css,
    metadata: {
      tokenCount,
      colorCount,
      generatedAt: new Date(),
    },
  }
}

/**
 * Creates default design tokens
 */
export function createDefaultTokens(): DesignTokens {
  return {
    colors: {
      light: defaultLightColors,
      dark: defaultDarkColors,
      chart: defaultChartColors,
    },
    borderRadius: defaultBorderRadius,
  }
}

// ============================================================================
// Token Validation
// ============================================================================

/**
 * Validates design tokens
 */
export function validateTokens(tokens: DesignTokens): TokenValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check required colors
  if (!tokens.colors) {
    errors.push("Missing colors configuration")
  } else {
    if (!tokens.colors.light) {
      errors.push("Missing light mode colors")
    } else {
      validateSemanticColors(tokens.colors.light, "light", errors, warnings)
    }

    if (!tokens.colors.dark) {
      warnings.push("Missing dark mode colors - will use light mode")
    } else {
      validateSemanticColors(tokens.colors.dark, "dark", errors, warnings)
    }
  }

  // Validate color values
  if (tokens.colors?.scales) {
    for (const [name, scale] of Object.entries(tokens.colors.scales)) {
      for (const [shade, value] of Object.entries(scale)) {
        if (!isValidColorValue(value)) {
          errors.push(`Invalid color value for ${name}-${shade}: ${value}`)
        }
      }
    }
  }

  // Validate spacing values
  if (tokens.spacing) {
    for (const [key, value] of Object.entries(tokens.spacing)) {
      if (!isValidSpacingValue(value)) {
        warnings.push(`Unusual spacing value for ${key}: ${value}`)
      }
    }
  }

  // Validate border radius
  if (tokens.borderRadius) {
    for (const [key, value] of Object.entries(tokens.borderRadius)) {
      if (!isValidSizeValue(value)) {
        warnings.push(`Unusual border-radius value for ${key}: ${value}`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Validates semantic color set
 */
function validateSemanticColors(
  colors: SemanticColors,
  mode: string,
  errors: string[],
  warnings: string[]
): void {
  const requiredKeys: (keyof SemanticColors)[] = [
    "background",
    "foreground",
    "primary",
    "secondary",
    "border",
  ]

  for (const key of requiredKeys) {
    if (!colors[key]) {
      errors.push(`Missing required color '${key}' in ${mode} mode`)
    }
  }

  // Check for valid HSL format
  for (const [key, value] of Object.entries(colors)) {
    if (!isValidHslString(value)) {
      warnings.push(`Color '${key}' in ${mode} mode may not be valid HSL: ${value}`)
    }
  }
}

// ============================================================================
// Color Utilities
// ============================================================================

/**
 * Converts hex color to HSL string
 */
export function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return hex

  let r = parseInt(result[1], 16) / 255
  let g = parseInt(result[2], 16) / 255
  let b = parseInt(result[3], 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

/**
 * Converts HSL to hex color
 */
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2

  let r = 0, g = 0, b = 0

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x
  }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16)
    return hex.length === 1 ? "0" + hex : hex
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Generates OKLCH color string
 */
export function toOklch(color: OklchColor): string {
  const { l, c, h, alpha } = color
  if (alpha !== undefined && alpha < 1) {
    return `oklch(${l} ${c} ${h} / ${alpha})`
  }
  return `oklch(${l} ${c} ${h})`
}

/**
 * Parses OKLCH color string
 */
export function parseOklch(str: string): OklchColor | null {
  const match = str.match(/oklch\(([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+))?\)/)
  if (!match) return null

  return {
    l: parseFloat(match[1]),
    c: parseFloat(match[2]),
    h: parseFloat(match[3]),
    alpha: match[4] ? parseFloat(match[4]) : undefined,
  }
}

/**
 * Generates color scale from base color
 */
export function generateColorScale(baseHue: number, baseSaturation: number = 70): Partial<ColorScale> {
  const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const
  const scale: Partial<ColorScale> = {}

  for (const shade of shades) {
    // Calculate lightness based on shade
    // 50 = lightest (95%), 950 = darkest (10%)
    const lightness = 100 - (shade / 10)
    // Adjust saturation (lower for very light/dark shades)
    const saturation = shade <= 100 || shade >= 900
      ? baseSaturation * 0.5
      : baseSaturation

    scale[shade] = `${baseHue} ${Math.round(saturation)}% ${Math.round(lightness)}%`
  }

  return scale
}

/**
 * Detects color format
 */
export function detectColorFormat(color: string): ColorFormat {
  if (color.startsWith("#")) return "hex"
  if (color.startsWith("rgb")) return "rgb"
  if (color.startsWith("hsl")) return "hsl"
  if (color.startsWith("oklch")) return "oklch"
  // Check for HSL values without function (shadcn format: "240 10% 3.9%")
  // Pattern: hue (0-360) + space + saturation% + space + lightness%
  // Each number can have decimals
  if (/^\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/.test(color)) return "hsl"
  return "hex"
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Formats variable name according to naming convention
 */
function formatVariableName(
  name: string,
  convention: NamingConvention,
  prefix: string
): string {
  // Convert camelCase to words and separate letters from trailing digits
  // e.g., "chart1" -> "chart-1", "primaryColor" -> "primary-color"
  const words = name
    .replace(/([A-Z])/g, "-$1")        // Split on uppercase: primaryColor -> primary-Color
    .replace(/([a-zA-Z])(\d)/g, "$1-$2") // Split letters from digits: chart1 -> chart-1
    .toLowerCase()
    .split("-")
    .filter(Boolean)

  let formatted: string
  switch (convention) {
    case "camelCase":
      formatted = words
        .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
        .join("")
      break
    case "snake_case":
      formatted = words.join("_")
      break
    case "kebab-case":
    default:
      formatted = words.join("-")
  }

  return prefix ? `${prefix}-${formatted}` : formatted
}

/**
 * Minifies CSS
 */
function minifyCss(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "") // Remove comments
    .replace(/\s+/g, " ") // Collapse whitespace
    .replace(/\s*([{}:;,])\s*/g, "$1") // Remove spaces around punctuation
    .replace(/;}/g, "}") // Remove trailing semicolons
    .trim()
}

/**
 * Validates color value
 */
function isValidColorValue(value: string): boolean {
  // Hex
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return true
  // RGB/RGBA
  if (/^rgba?\([\d\s,%.]+\)$/.test(value)) return true
  // HSL/HSLA
  if (/^hsla?\([\d\s,%.]+\)$/.test(value)) return true
  // OKLCH
  if (/^oklch\([\d\s./%]+\)$/.test(value)) return true
  // HSL values (shadcn format)
  if (/^\d+(\.\d+)?\s+\d+(\.\d+)?%?\s+\d+(\.\d+)?%?$/.test(value)) return true

  return false
}

/**
 * Validates HSL string format
 */
function isValidHslString(value: string): boolean {
  // Full HSL function
  if (/^hsl\([\d\s,%.]+\)$/.test(value)) return true
  // Short HSL values (shadcn format: "240 10% 3.9%")
  if (/^\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/.test(value)) return true
  return false
}

/**
 * Validates spacing value
 */
function isValidSpacingValue(value: string): boolean {
  // Standard units
  return /^\d+(\.\d+)?(px|rem|em|%|vh|vw)?$/.test(value) || value === "0"
}

/**
 * Validates size value
 */
function isValidSizeValue(value: string): boolean {
  // Standard units or calc
  return /^\d+(\.\d+)?(px|rem|em|%)?$/.test(value) ||
    /^calc\(.+\)$/.test(value) ||
    value === "0"
}

/**
 * Creates semantic colors from a primary color
 */
export function createSemanticColorsFromPrimary(
  primaryHsl: string,
  mode: "light" | "dark" = "light"
): SemanticColors {
  const base = mode === "light" ? defaultLightColors : defaultDarkColors
  return {
    ...base,
    primary: primaryHsl,
    ring: primaryHsl,
  }
}
