/**
 * OKLCH Palette Types
 *
 * Types for OKLCH color space operations and palette generation.
 * OKLCH is a perceptually uniform color space used by Tailwind v4
 * for consistent, vibrant colors with P3 wide gamut support.
 *
 * OKLCH Components:
 * - L (Lightness): 0-1 (0 = black, 1 = white)
 * - C (Chroma): 0-0.4+ (0 = gray, higher = more saturated)
 * - H (Hue): 0-360 degrees
 */

/**
 * OKLCH color representation
 */
export interface OklchColor {
  /** Lightness (0-1) */
  l: number
  /** Chroma (0-0.4+, theoretical max varies by hue) */
  c: number
  /** Hue angle in degrees (0-360) */
  h: number
  /** Optional alpha/opacity (0-1) */
  alpha?: number
}

/**
 * RGB color representation
 */
export interface RgbColor {
  r: number
  g: number
  b: number
  alpha?: number
}

/**
 * HSL color representation
 */
export interface HslColor {
  h: number
  s: number
  l: number
  alpha?: number
}

/**
 * Color gamut type
 */
export type ColorGamut = "srgb" | "display-p3" | "rec2020"

/**
 * Color with gamut information
 */
export interface GamutColor extends OklchColor {
  /** Target color gamut */
  gamut: ColorGamut
  /** Whether color is in gamut */
  inGamut: boolean
  /** Fallback sRGB color if out of gamut */
  fallback?: string
}

/**
 * Palette generation mode
 */
export type PaletteMode =
  | "monochromatic"
  | "complementary"
  | "analogous"
  | "triadic"
  | "tetradic"
  | "split-complementary"
  | "custom"

/**
 * Shade generation configuration
 */
export interface ShadeConfig {
  /** Number of shades to generate */
  count: number
  /** Lightness range [min, max] */
  lightnessRange: [number, number]
  /** Chroma adjustment curve */
  chromaCurve?: "linear" | "ease" | "ease-in" | "ease-out"
  /** Hue shift per shade (for more natural palettes) */
  hueShift?: number
}

/**
 * Standard Tailwind shade scale (50-950)
 */
export interface TailwindShadeScale {
  50: OklchColor
  100: OklchColor
  200: OklchColor
  300: OklchColor
  400: OklchColor
  500: OklchColor
  600: OklchColor
  700: OklchColor
  800: OklchColor
  900: OklchColor
  950: OklchColor
}

/**
 * Generated color palette
 */
export interface ColorPalette {
  /** Palette name */
  name: string
  /** Base/primary color */
  base: OklchColor
  /** Generated shades */
  shades: TailwindShadeScale
  /** Palette mode used */
  mode: PaletteMode
  /** CSS output */
  css: string
}

/**
 * Multi-color palette (for complementary, triadic, etc.)
 */
export interface HarmonyPalette {
  /** Palette name */
  name: string
  /** Harmony type */
  harmony: PaletteMode
  /** Primary color palette */
  primary: ColorPalette
  /** Secondary color palettes */
  secondary: ColorPalette[]
  /** Combined CSS output */
  css: string
}

/**
 * Palette generation options
 */
export interface PaletteOptions {
  /** Palette name (used in CSS variable names) */
  name: string
  /** Generation mode */
  mode?: PaletteMode
  /** Shade configuration */
  shades?: Partial<ShadeConfig>
  /** Target gamut */
  gamut?: ColorGamut
  /** Include fallbacks for out-of-gamut colors */
  includeFallbacks?: boolean
  /** CSS variable prefix */
  prefix?: string
  /** Output format */
  format?: "oklch" | "hsl" | "rgb" | "hex"
}

/**
 * Semantic color mapping
 */
export interface SemanticPalette {
  /** Primary brand color */
  primary: ColorPalette
  /** Secondary color */
  secondary?: ColorPalette
  /** Accent color */
  accent?: ColorPalette
  /** Neutral/gray scale */
  neutral: ColorPalette
  /** Success state */
  success?: ColorPalette
  /** Warning state */
  warning?: ColorPalette
  /** Error/destructive state */
  error?: ColorPalette
  /** Info state */
  info?: ColorPalette
}

/**
 * Theme configuration using OKLCH
 */
export interface OklchThemeConfig {
  /** Light mode colors */
  light: SemanticPalette
  /** Dark mode colors */
  dark: SemanticPalette
  /** Shared color scales */
  scales?: Record<string, ColorPalette>
}

/**
 * Color contrast pair
 */
export interface ContrastPair {
  /** Foreground color */
  foreground: OklchColor
  /** Background color */
  background: OklchColor
  /** Contrast ratio */
  ratio: number
  /** WCAG compliance */
  wcag: {
    aa: boolean
    aaLarge: boolean
    aaa: boolean
    aaaLarge: boolean
  }
}

/**
 * Color manipulation options
 */
export interface ColorAdjustment {
  /** Lightness adjustment (-1 to 1) */
  lightness?: number
  /** Chroma adjustment (-1 to 1) */
  chroma?: number
  /** Hue rotation (degrees) */
  hue?: number
  /** Alpha adjustment (-1 to 1) */
  alpha?: number
}

/**
 * Interpolation options
 */
export interface InterpolationOptions {
  /** Number of steps */
  steps: number
  /** Interpolation method */
  method?: "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out"
  /** Color space for interpolation */
  space?: "oklch" | "oklab" | "srgb"
}

/**
 * Parsed CSS color
 */
export interface ParsedColor {
  /** Original input string */
  original: string
  /** Color format detected */
  format: "hex" | "rgb" | "hsl" | "oklch" | "named" | "unknown"
  /** Converted OKLCH */
  oklch: OklchColor | null
  /** Is valid color */
  valid: boolean
}

/**
 * Gamut mapping result
 */
export interface GamutMapResult {
  /** Original color */
  original: OklchColor
  /** Mapped color (in gamut) */
  mapped: OklchColor
  /** Was mapping needed */
  wasMapped: boolean
  /** Perceptual difference (delta E) */
  deltaE?: number
}

/**
 * Accessible color suggestion
 */
export interface AccessibleColorSuggestion {
  /** Original color */
  original: OklchColor
  /** Suggested accessible color */
  suggested: OklchColor
  /** Target contrast ratio achieved */
  contrastRatio: number
  /** Adjustment made */
  adjustment: "lighten" | "darken" | "none"
}
