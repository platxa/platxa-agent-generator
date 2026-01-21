/**
 * Theme Worker - Type Definitions
 *
 * Types for design token management following Tailwind v4 CSS-first
 * theming with OKLCH colors and semantic tokens.
 */

/**
 * Color format types
 */
export type ColorFormat = "hex" | "rgb" | "hsl" | "oklch"

/**
 * OKLCH color representation
 * L: Lightness (0-1), C: Chroma (0-0.4+), H: Hue (0-360)
 */
export interface OklchColor {
  l: number
  c: number
  h: number
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
 * RGB color representation
 */
export interface RgbColor {
  r: number
  g: number
  b: number
  alpha?: number
}

/**
 * Color value - can be string or structured
 */
export type ColorValue = string | OklchColor | HslColor | RgbColor

/**
 * Semantic color roles
 */
export interface SemanticColors {
  /** Primary brand color */
  primary: ColorValue
  /** Primary foreground (text on primary) */
  primaryForeground: ColorValue
  /** Secondary color */
  secondary: ColorValue
  /** Secondary foreground */
  secondaryForeground: ColorValue
  /** Muted backgrounds */
  muted: ColorValue
  /** Muted foreground */
  mutedForeground: ColorValue
  /** Accent color for highlights */
  accent: ColorValue
  /** Accent foreground */
  accentForeground: ColorValue
  /** Destructive/error color */
  destructive: ColorValue
  /** Destructive foreground */
  destructiveForeground: ColorValue
  /** Default background */
  background: ColorValue
  /** Default foreground */
  foreground: ColorValue
  /** Card background */
  card: ColorValue
  /** Card foreground */
  cardForeground: ColorValue
  /** Popover background */
  popover: ColorValue
  /** Popover foreground */
  popoverForeground: ColorValue
  /** Border color */
  border: ColorValue
  /** Input border */
  input: ColorValue
  /** Focus ring color */
  ring: ColorValue
}

/**
 * Color palette with shades
 */
export interface ColorPalette {
  50: ColorValue
  100: ColorValue
  200: ColorValue
  300: ColorValue
  400: ColorValue
  500: ColorValue
  600: ColorValue
  700: ColorValue
  800: ColorValue
  900: ColorValue
  950: ColorValue
}

/**
 * Spacing scale values
 */
export interface SpacingScale {
  px: string
  0: string
  0.5: string
  1: string
  1.5: string
  2: string
  2.5: string
  3: string
  3.5: string
  4: string
  5: string
  6: string
  7: string
  8: string
  9: string
  10: string
  11: string
  12: string
  14: string
  16: string
  20: string
  24: string
  28: string
  32: string
  36: string
  40: string
  44: string
  48: string
  52: string
  56: string
  60: string
  64: string
  72: string
  80: string
  96: string
}

/**
 * Typography scale
 */
export interface TypographyScale {
  xs: { fontSize: string; lineHeight: string }
  sm: { fontSize: string; lineHeight: string }
  base: { fontSize: string; lineHeight: string }
  lg: { fontSize: string; lineHeight: string }
  xl: { fontSize: string; lineHeight: string }
  "2xl": { fontSize: string; lineHeight: string }
  "3xl": { fontSize: string; lineHeight: string }
  "4xl": { fontSize: string; lineHeight: string }
  "5xl": { fontSize: string; lineHeight: string }
  "6xl": { fontSize: string; lineHeight: string }
  "7xl": { fontSize: string; lineHeight: string }
  "8xl": { fontSize: string; lineHeight: string }
  "9xl": { fontSize: string; lineHeight: string }
}

/**
 * Font weight scale
 */
export interface FontWeightScale {
  thin: number
  extralight: number
  light: number
  normal: number
  medium: number
  semibold: number
  bold: number
  extrabold: number
  black: number
}

/**
 * Border radius scale
 */
export interface RadiusScale {
  none: string
  sm: string
  default: string
  md: string
  lg: string
  xl: string
  "2xl": string
  "3xl": string
  full: string
}

/**
 * Shadow scale
 */
export interface ShadowScale {
  sm: string
  default: string
  md: string
  lg: string
  xl: string
  "2xl": string
  inner: string
  none: string
}

/**
 * Animation/transition durations
 */
export interface DurationScale {
  75: string
  100: string
  150: string
  200: string
  300: string
  500: string
  700: string
  1000: string
}

/**
 * Easing functions
 */
export interface EasingScale {
  linear: string
  in: string
  out: string
  inOut: string
}

/**
 * Breakpoint definitions
 */
export interface Breakpoints {
  sm: string
  md: string
  lg: string
  xl: string
  "2xl": string
}

/**
 * Z-index scale
 */
export interface ZIndexScale {
  0: number
  10: number
  20: number
  30: number
  40: number
  50: number
  auto: string
}

/**
 * Complete design token set
 */
export interface DesignTokens {
  /** Semantic color tokens */
  colors: SemanticColors
  /** Named color palettes */
  palettes?: Record<string, ColorPalette>
  /** Spacing scale */
  spacing: Partial<SpacingScale>
  /** Typography scale */
  typography: Partial<TypographyScale>
  /** Font weights */
  fontWeight: Partial<FontWeightScale>
  /** Font families */
  fontFamily?: {
    sans?: string
    serif?: string
    mono?: string
  }
  /** Border radius */
  radius: Partial<RadiusScale>
  /** Box shadows */
  shadow: Partial<ShadowScale>
  /** Transition durations */
  duration?: Partial<DurationScale>
  /** Easing functions */
  easing?: Partial<EasingScale>
  /** Breakpoints */
  breakpoints?: Partial<Breakpoints>
  /** Z-index */
  zIndex?: Partial<ZIndexScale>
}

/**
 * Theme mode
 */
export type ThemeMode = "light" | "dark" | "system"

/**
 * Theme configuration
 */
export interface ThemeConfig {
  /** Theme name */
  name: string
  /** Light mode tokens */
  light: DesignTokens
  /** Dark mode tokens (colors only, other values inherited) */
  dark?: Partial<SemanticColors>
  /** Default mode */
  defaultMode?: ThemeMode
  /** CSS class for dark mode */
  darkModeClass?: string
  /** Use CSS color-scheme */
  useColorScheme?: boolean
  /**
   * Parent brand kit to extend from
   *
   * When specified, this brand kit inherits all tokens from the parent.
   * Tokens defined in this config override the parent's tokens.
   * Can be a ThemeConfig object or a string name that will be resolved
   * from a registry.
   *
   * @example
   * ```typescript
   * const childBrand: ThemeConfig = {
   *   name: "child-brand",
   *   extends: parentBrand, // or "parent-brand" for registry lookup
   *   light: {
   *     colors: { primary: "purple" }, // overrides parent's primary
   *     // spacing, typography, etc. inherited from parent
   *   },
   * }
   * ```
   */
  extends?: ThemeConfig | string
}

/**
 * Generated CSS output
 */
export interface GeneratedTheme {
  /** CSS content */
  css: string
  /** Tailwind v4 @theme block */
  tailwindTheme: string
  /** CSS variables map */
  cssVariables: Record<string, string>
  /** Dark mode CSS */
  darkModeCss?: string
  /** JavaScript theme object */
  jsTheme?: string
}

/**
 * Color generation options
 */
export interface ColorGenerationOptions {
  /** Base hue (0-360) */
  hue: number
  /** Saturation/chroma level */
  saturation?: "low" | "medium" | "high"
  /** Generate as OKLCH */
  useOklch?: boolean
  /** Include alpha channel */
  includeAlpha?: boolean
}

/**
 * Palette generation options
 */
export interface PaletteGenerationOptions {
  /** Base color */
  baseColor: ColorValue
  /** Number of shades */
  shades?: number
  /** Output format */
  format?: ColorFormat
}

/**
 * Theme preset names
 */
export type ThemePreset =
  | "default"
  | "slate"
  | "zinc"
  | "neutral"
  | "stone"
  | "red"
  | "orange"
  | "amber"
  | "yellow"
  | "lime"
  | "green"
  | "emerald"
  | "teal"
  | "cyan"
  | "sky"
  | "blue"
  | "indigo"
  | "violet"
  | "purple"
  | "fuchsia"
  | "pink"
  | "rose"
