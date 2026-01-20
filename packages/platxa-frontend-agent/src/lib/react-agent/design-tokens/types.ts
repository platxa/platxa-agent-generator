/**
 * Design Tokens - Type Definitions
 *
 * Types for Tailwind v4 CSS-first theming with @theme directive.
 * Supports design token management for colors, spacing, typography, etc.
 */

/**
 * Color token with optional opacity
 */
export interface ColorToken {
  /** Color value (hex, rgb, hsl, oklch) */
  value: string
  /** Optional opacity (0-1) */
  opacity?: number
  /** Description */
  description?: string
}

/**
 * Color scale (50-950)
 */
export interface ColorScale {
  50: string
  100: string
  200: string
  300: string
  400: string
  500: string
  600: string
  700: string
  800: string
  900: string
  950: string
}

/**
 * Semantic color tokens
 */
export interface SemanticColors {
  /** Background colors */
  background: string
  /** Foreground/text colors */
  foreground: string
  /** Card background */
  card: string
  /** Card foreground */
  cardForeground: string
  /** Popover background */
  popover: string
  /** Popover foreground */
  popoverForeground: string
  /** Primary brand color */
  primary: string
  /** Primary foreground */
  primaryForeground: string
  /** Secondary color */
  secondary: string
  /** Secondary foreground */
  secondaryForeground: string
  /** Muted backgrounds */
  muted: string
  /** Muted foreground */
  mutedForeground: string
  /** Accent color */
  accent: string
  /** Accent foreground */
  accentForeground: string
  /** Destructive/error color */
  destructive: string
  /** Destructive foreground */
  destructiveForeground: string
  /** Border color */
  border: string
  /** Input border */
  input: string
  /** Focus ring */
  ring: string
}

/**
 * Chart colors for data visualization
 */
export interface ChartColors {
  chart1: string
  chart2: string
  chart3: string
  chart4: string
  chart5: string
}

/**
 * Spacing scale
 */
export interface SpacingScale {
  0: string
  px: string
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
 * Typography tokens
 */
export interface TypographyTokens {
  /** Font families */
  fontFamily: {
    sans: string[]
    serif: string[]
    mono: string[]
  }
  /** Font sizes */
  fontSize: {
    xs: [string, { lineHeight: string }]
    sm: [string, { lineHeight: string }]
    base: [string, { lineHeight: string }]
    lg: [string, { lineHeight: string }]
    xl: [string, { lineHeight: string }]
    "2xl": [string, { lineHeight: string }]
    "3xl": [string, { lineHeight: string }]
    "4xl": [string, { lineHeight: string }]
    "5xl": [string, { lineHeight: string }]
    "6xl": [string, { lineHeight: string }]
    "7xl": [string, { lineHeight: string }]
    "8xl": [string, { lineHeight: string }]
    "9xl": [string, { lineHeight: string }]
  }
  /** Font weights */
  fontWeight: {
    thin: string
    extralight: string
    light: string
    normal: string
    medium: string
    semibold: string
    bold: string
    extrabold: string
    black: string
  }
  /** Letter spacing */
  letterSpacing: {
    tighter: string
    tight: string
    normal: string
    wide: string
    wider: string
    widest: string
  }
  /** Line heights */
  lineHeight: {
    none: string
    tight: string
    snug: string
    normal: string
    relaxed: string
    loose: string
  }
}

/**
 * Border radius tokens
 */
export interface BorderRadiusTokens {
  none: string
  sm: string
  DEFAULT: string
  md: string
  lg: string
  xl: string
  "2xl": string
  "3xl": string
  full: string
}

/**
 * Shadow tokens
 */
export interface ShadowTokens {
  sm: string
  DEFAULT: string
  md: string
  lg: string
  xl: string
  "2xl": string
  inner: string
  none: string
}

/**
 * Animation tokens
 */
export interface AnimationTokens {
  /** Transition durations */
  transitionDuration: {
    75: string
    100: string
    150: string
    200: string
    300: string
    500: string
    700: string
    1000: string
  }
  /** Transition timing functions */
  transitionTimingFunction: {
    DEFAULT: string
    linear: string
    in: string
    out: string
    "in-out": string
  }
  /** Keyframe animations */
  animation: {
    none: string
    spin: string
    ping: string
    pulse: string
    bounce: string
  }
}

/**
 * Breakpoint tokens
 */
export interface BreakpointTokens {
  sm: string
  md: string
  lg: string
  xl: string
  "2xl": string
}

/**
 * Complete design token set
 */
export interface DesignTokens {
  /** Color palette */
  colors: {
    /** Semantic colors for light mode */
    light: SemanticColors
    /** Semantic colors for dark mode */
    dark: SemanticColors
    /** Chart colors */
    chart?: ChartColors
    /** Custom color scales */
    scales?: Record<string, Partial<ColorScale>>
  }
  /** Spacing scale */
  spacing?: Partial<SpacingScale>
  /** Typography */
  typography?: Partial<TypographyTokens>
  /** Border radius */
  borderRadius?: Partial<BorderRadiusTokens>
  /** Shadows */
  shadows?: Partial<ShadowTokens>
  /** Animations */
  animations?: Partial<AnimationTokens>
  /** Breakpoints */
  breakpoints?: Partial<BreakpointTokens>
}

/**
 * @theme directive configuration
 */
export interface ThemeDirectiveConfig {
  /** Include inline in CSS */
  inline?: boolean
  /** Layer name */
  layer?: string
  /** Reference existing theme */
  reference?: string
}

/**
 * CSS variable naming convention
 */
export type NamingConvention = "kebab-case" | "camelCase" | "snake_case"

/**
 * Generated theme output
 */
export interface GeneratedTheme {
  /** @theme CSS block */
  themeDirective: string
  /** CSS variables for :root */
  rootVariables: string
  /** CSS variables for .dark */
  darkVariables: string
  /** Complete CSS output */
  css: string
  /** Token metadata */
  metadata: {
    tokenCount: number
    colorCount: number
    generatedAt: Date
  }
}

/**
 * Theme generation options
 */
export interface ThemeGenerationOptions {
  /** Naming convention for variables */
  naming?: NamingConvention
  /** Include @theme directive */
  includeThemeDirective?: boolean
  /** Include CSS variables */
  includeCssVariables?: boolean
  /** Include dark mode */
  includeDarkMode?: boolean
  /** Prefix for variables */
  prefix?: string
  /** Output format */
  format?: "css" | "scss" | "less"
  /** Minify output */
  minify?: boolean
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  /** Is valid */
  valid: boolean
  /** Validation errors */
  errors: string[]
  /** Validation warnings */
  warnings: string[]
}

/**
 * Color format
 */
export type ColorFormat = "hex" | "rgb" | "hsl" | "oklch"

/**
 * OKLCH color components
 */
export interface OklchColor {
  /** Lightness (0-1) */
  l: number
  /** Chroma (0-0.4) */
  c: number
  /** Hue (0-360) */
  h: number
  /** Alpha (0-1) */
  alpha?: number
}

/**
 * HSL color components
 */
export interface HslColor {
  /** Hue (0-360) */
  h: number
  /** Saturation (0-100) */
  s: number
  /** Lightness (0-100) */
  l: number
  /** Alpha (0-1) */
  alpha?: number
}
