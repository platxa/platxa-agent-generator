/**
 * Theme Worker
 *
 * Generates CSS variables and Tailwind v4 theme configuration
 * from design tokens with dark mode support.
 */

import type {
  SemanticColors,
  ColorPalette,
  DesignTokens,
  ThemeConfig,
  GeneratedTheme,
  OklchColor,
  HslColor,
  ColorGenerationOptions,
  PaletteGenerationOptions,
} from "./types"

import {
  defaultTokens,
  defaultDarkColors,
  getThemePreset,
} from "./tokens"

// ============================================================================
// Color Utilities
// ============================================================================

/**
 * Converts HSL string to components
 */
export function parseHsl(hsl: string): HslColor | null {
  const match = hsl.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%(?:\s*\/\s*([\d.]+))?\)/)
  if (!match) return null
  return {
    h: parseInt(match[1], 10),
    s: parseInt(match[2], 10),
    l: parseInt(match[3], 10),
    alpha: match[4] ? parseFloat(match[4]) : undefined,
  }
}

/**
 * Converts HSL components to string
 */
export function hslToString(color: HslColor): string {
  if (color.alpha !== undefined && color.alpha < 1) {
    return `hsl(${color.h} ${color.s}% ${color.l}% / ${color.alpha})`
  }
  return `hsl(${color.h} ${color.s}% ${color.l}%)`
}

/**
 * Converts HSL to OKLCH (approximate conversion)
 */
export function hslToOklch(hsl: HslColor): OklchColor {
  // Approximate conversion - for precise conversion use a color library
  const l = hsl.l / 100
  const s = hsl.s / 100

  // OKLCH lightness is similar but not identical to HSL lightness
  const oklchL = l
  // Chroma is derived from saturation and lightness
  const oklchC = s * Math.min(l, 1 - l) * 0.4
  // Hue is the same
  const oklchH = hsl.h

  return {
    l: Math.round(oklchL * 1000) / 1000,
    c: Math.round(oklchC * 1000) / 1000,
    h: oklchH,
    alpha: hsl.alpha,
  }
}

/**
 * Converts OKLCH to string
 */
export function oklchToString(color: OklchColor): string {
  if (color.alpha !== undefined && color.alpha < 1) {
    return `oklch(${color.l} ${color.c} ${color.h} / ${color.alpha})`
  }
  return `oklch(${color.l} ${color.c} ${color.h})`
}

/**
 * Lightens a color by percentage
 */
export function lighten(color: string, amount: number): string {
  const hsl = parseHsl(color)
  if (!hsl) return color

  const newL = Math.min(100, hsl.l + amount)
  return hslToString({ ...hsl, l: newL })
}

/**
 * Darkens a color by percentage
 */
export function darken(color: string, amount: number): string {
  const hsl = parseHsl(color)
  if (!hsl) return color

  const newL = Math.max(0, hsl.l - amount)
  return hslToString({ ...hsl, l: newL })
}

/**
 * Adjusts color saturation
 */
export function saturate(color: string, amount: number): string {
  const hsl = parseHsl(color)
  if (!hsl) return color

  const newS = Math.min(100, Math.max(0, hsl.s + amount))
  return hslToString({ ...hsl, s: newS })
}

/**
 * Generates a color palette from a base color
 */
export function generatePalette(options: PaletteGenerationOptions): ColorPalette {
  const { baseColor, format = "hsl" } = options

  // Parse base color
  const base = typeof baseColor === "string" ? parseHsl(baseColor) : null
  if (!base) {
    // Return default gray palette if parsing fails
    return {
      50: "hsl(0 0% 98%)",
      100: "hsl(0 0% 96%)",
      200: "hsl(0 0% 90%)",
      300: "hsl(0 0% 83%)",
      400: "hsl(0 0% 64%)",
      500: "hsl(0 0% 45%)",
      600: "hsl(0 0% 32%)",
      700: "hsl(0 0% 25%)",
      800: "hsl(0 0% 15%)",
      900: "hsl(0 0% 9%)",
      950: "hsl(0 0% 4%)",
    }
  }

  // Generate shades by adjusting lightness
  const shades: [keyof ColorPalette, number][] = [
    [50, 97],
    [100, 94],
    [200, 86],
    [300, 77],
    [400, 66],
    [500, 50],
    [600, 40],
    [700, 32],
    [800, 24],
    [900, 15],
    [950, 8],
  ]

  const palette: Partial<ColorPalette> = {}

  for (const [shade, lightness] of shades) {
    const color: HslColor = {
      h: base.h,
      s: base.s,
      l: lightness,
    }

    if (format === "oklch") {
      palette[shade] = oklchToString(hslToOklch(color))
    } else {
      palette[shade] = hslToString(color)
    }
  }

  return palette as ColorPalette
}

/**
 * Generates semantic colors from a primary hue
 */
export function generateSemanticColors(options: ColorGenerationOptions): SemanticColors {
  const { hue, saturation = "medium", useOklch = false } = options

  const satMap = { low: 30, medium: 50, high: 70 }
  const sat = satMap[saturation]

  const toColor = (h: number, s: number, l: number): string => {
    const hsl: HslColor = { h, s, l }
    return useOklch ? oklchToString(hslToOklch(hsl)) : hslToString(hsl)
  }

  return {
    background: toColor(0, 0, 100),
    foreground: toColor(hue, sat, 10),
    card: toColor(0, 0, 100),
    cardForeground: toColor(hue, sat, 10),
    popover: toColor(0, 0, 100),
    popoverForeground: toColor(hue, sat, 10),
    primary: toColor(hue, sat + 20, 50),
    primaryForeground: toColor(0, 0, 100),
    secondary: toColor(hue, sat - 20, 96),
    secondaryForeground: toColor(hue, sat, 10),
    muted: toColor(hue, sat - 30, 96),
    mutedForeground: toColor(hue, sat - 20, 45),
    accent: toColor(hue, sat - 20, 96),
    accentForeground: toColor(hue, sat, 10),
    destructive: toColor(0, 84, 60),
    destructiveForeground: toColor(0, 0, 100),
    border: toColor(hue, sat - 30, 90),
    input: toColor(hue, sat - 30, 90),
    ring: toColor(hue, sat + 20, 50),
  }
}

// ============================================================================
// CSS Generation
// ============================================================================

/**
 * Converts camelCase to kebab-case
 */
function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()
}

/**
 * Generates CSS variables from semantic colors
 */
export function generateColorVariables(
  colors: SemanticColors,
  prefix: string = ""
): Record<string, string> {
  const variables: Record<string, string> = {}
  const p = prefix ? `${prefix}-` : ""

  for (const [key, value] of Object.entries(colors)) {
    const varName = `--${p}${toKebabCase(key)}`
    variables[varName] = typeof value === "string" ? value : ""
  }

  return variables
}

/**
 * Generates CSS from design tokens
 */
export function generateCss(
  tokens: DesignTokens,
  selector: string = ":root"
): string {
  const lines: string[] = []

  lines.push(`${selector} {`)

  // Color variables
  const colorVars = generateColorVariables(tokens.colors)
  for (const [name, value] of Object.entries(colorVars)) {
    lines.push(`  ${name}: ${value};`)
  }

  // Radius variable (commonly used)
  if (tokens.radius.lg) {
    lines.push(`  --radius: ${tokens.radius.lg};`)
  }

  lines.push("}")

  return lines.join("\n")
}

/**
 * Generates dark mode CSS
 */
export function generateDarkModeCss(
  darkColors: Partial<SemanticColors>,
  selector: string = ".dark"
): string {
  const lines: string[] = []

  lines.push(`${selector} {`)

  for (const [key, value] of Object.entries(darkColors)) {
    if (value) {
      const varName = `--${toKebabCase(key)}`
      lines.push(`  ${varName}: ${typeof value === "string" ? value : ""};`)
    }
  }

  lines.push("}")

  return lines.join("\n")
}

/**
 * Generates Tailwind v4 @theme block
 */
export function generateTailwindTheme(tokens: DesignTokens): string {
  const lines: string[] = []

  lines.push("@theme {")

  // Colors
  lines.push("  /* Semantic Colors */")
  const colorVars = generateColorVariables(tokens.colors)
  for (const [name, value] of Object.entries(colorVars)) {
    const tailwindName = name.replace("--", "--color-")
    lines.push(`  ${tailwindName}: ${value};`)
  }

  // Radius
  lines.push("")
  lines.push("  /* Border Radius */")
  for (const [key, value] of Object.entries(tokens.radius)) {
    if (value) {
      lines.push(`  --radius-${key}: ${value};`)
    }
  }

  // Shadows
  if (tokens.shadow) {
    lines.push("")
    lines.push("  /* Shadows */")
    for (const [key, value] of Object.entries(tokens.shadow)) {
      if (value) {
        const shadowKey = key === "default" ? "DEFAULT" : key
        lines.push(`  --shadow-${shadowKey}: ${value};`)
      }
    }
  }

  // Font families
  if (tokens.fontFamily) {
    lines.push("")
    lines.push("  /* Font Families */")
    for (const [key, value] of Object.entries(tokens.fontFamily)) {
      if (value) {
        lines.push(`  --font-${key}: ${value};`)
      }
    }
  }

  lines.push("}")

  return lines.join("\n")
}

/**
 * Generates theme switching JavaScript
 */
export function generateThemeScript(config: ThemeConfig): string {
  return `// Theme initialization script
(function() {
  const storageKey = 'theme-mode';
  const darkClass = '${config.darkModeClass || "dark"}';

  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function getStoredTheme() {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }

  function setTheme(theme) {
    const root = document.documentElement;
    const isDark = theme === 'dark' || (theme === 'system' && getSystemTheme() === 'dark');

    root.classList.toggle(darkClass, isDark);
    ${config.useColorScheme ? "root.style.colorScheme = isDark ? 'dark' : 'light';" : ""}
  }

  // Initialize
  const stored = getStoredTheme();
  const initial = stored || '${config.defaultMode || "system"}';
  setTheme(initial);

  // Listen for system changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!getStoredTheme() || getStoredTheme() === 'system') {
      setTheme('system');
    }
  });

  // Expose API
  window.setTheme = function(theme) {
    try {
      localStorage.setItem(storageKey, theme);
    } catch {}
    setTheme(theme);
  };
})();`
}

// ============================================================================
// Main Theme Generation
// ============================================================================

/**
 * Generates complete theme output from configuration
 */
export function generateTheme(config: ThemeConfig): GeneratedTheme {
  const cssVariables = generateColorVariables(config.light.colors)

  // Generate base CSS
  const css = generateCss(config.light)

  // Generate Tailwind theme
  const tailwindTheme = generateTailwindTheme(config.light)

  // Generate dark mode CSS
  let darkModeCss: string | undefined
  if (config.dark) {
    darkModeCss = generateDarkModeCss(config.dark, `.${config.darkModeClass || "dark"}`)
  }

  // Generate theme script
  const jsTheme = generateThemeScript(config)

  return {
    css,
    tailwindTheme,
    cssVariables,
    darkModeCss,
    jsTheme,
  }
}

/**
 * Generates theme from preset name
 */
export function generateThemeFromPreset(presetName: string): GeneratedTheme {
  const config = getThemePreset(presetName)
  return generateTheme(config)
}

/**
 * Creates a custom theme configuration
 */
export function createTheme(
  name: string,
  options: {
    primaryHue?: number
    saturation?: "low" | "medium" | "high"
    useOklch?: boolean
    darkMode?: boolean
  } = {}
): ThemeConfig {
  const { primaryHue = 220, saturation = "medium", useOklch = false, darkMode = true } = options

  const lightColors = generateSemanticColors({
    hue: primaryHue,
    saturation,
    useOklch,
  })

  const config: ThemeConfig = {
    name,
    light: {
      ...defaultTokens,
      colors: lightColors,
    },
    defaultMode: "system",
    darkModeClass: "dark",
    useColorScheme: true,
  }

  if (darkMode) {
    // Generate dark colors based on default dark colors
    config.dark = {
      ...defaultDarkColors,
    }
  }

  return config
}

/**
 * Validates a theme configuration
 */
export function validateTheme(config: ThemeConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!config.name) {
    errors.push("Theme name is required")
  }

  if (!config.light?.colors) {
    errors.push("Light mode colors are required")
  } else {
    const requiredColors: (keyof SemanticColors)[] = [
      "background",
      "foreground",
      "primary",
      "primaryForeground",
    ]

    for (const color of requiredColors) {
      if (!config.light.colors[color]) {
        errors.push(`Missing required color: ${color}`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
