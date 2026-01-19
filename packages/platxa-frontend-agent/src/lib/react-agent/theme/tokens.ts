/**
 * Design Token Presets
 *
 * Pre-built design tokens following shadcn/ui and Tailwind v4 patterns
 * with OKLCH color support.
 */

import type {
  SemanticColors,
  ColorPalette,
  DesignTokens,
  SpacingScale,
  TypographyScale,
  FontWeightScale,
  RadiusScale,
  ShadowScale,
  ThemeConfig,
} from "./types"

// ============================================================================
// Color Palettes (Tailwind defaults in OKLCH-compatible format)
// ============================================================================

export const slatePalette: ColorPalette = {
  50: "hsl(210 40% 98%)",
  100: "hsl(210 40% 96%)",
  200: "hsl(214 32% 91%)",
  300: "hsl(213 27% 84%)",
  400: "hsl(215 20% 65%)",
  500: "hsl(215 16% 47%)",
  600: "hsl(215 19% 35%)",
  700: "hsl(215 25% 27%)",
  800: "hsl(217 33% 17%)",
  900: "hsl(222 47% 11%)",
  950: "hsl(229 84% 5%)",
}

export const zincPalette: ColorPalette = {
  50: "hsl(0 0% 98%)",
  100: "hsl(240 5% 96%)",
  200: "hsl(240 6% 90%)",
  300: "hsl(240 5% 84%)",
  400: "hsl(240 5% 65%)",
  500: "hsl(240 4% 46%)",
  600: "hsl(240 5% 34%)",
  700: "hsl(240 5% 26%)",
  800: "hsl(240 4% 16%)",
  900: "hsl(240 6% 10%)",
  950: "hsl(240 10% 4%)",
}

export const neutralPalette: ColorPalette = {
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

// ============================================================================
// Semantic Color Presets
// ============================================================================

/**
 * Default light theme colors (shadcn/ui style)
 */
export const defaultLightColors: SemanticColors = {
  background: "hsl(0 0% 100%)",
  foreground: "hsl(222 47% 11%)",
  card: "hsl(0 0% 100%)",
  cardForeground: "hsl(222 47% 11%)",
  popover: "hsl(0 0% 100%)",
  popoverForeground: "hsl(222 47% 11%)",
  primary: "hsl(222 47% 11%)",
  primaryForeground: "hsl(210 40% 98%)",
  secondary: "hsl(210 40% 96%)",
  secondaryForeground: "hsl(222 47% 11%)",
  muted: "hsl(210 40% 96%)",
  mutedForeground: "hsl(215 16% 47%)",
  accent: "hsl(210 40% 96%)",
  accentForeground: "hsl(222 47% 11%)",
  destructive: "hsl(0 84% 60%)",
  destructiveForeground: "hsl(210 40% 98%)",
  border: "hsl(214 32% 91%)",
  input: "hsl(214 32% 91%)",
  ring: "hsl(222 47% 11%)",
}

/**
 * Default dark theme colors (shadcn/ui style)
 */
export const defaultDarkColors: SemanticColors = {
  background: "hsl(222 47% 11%)",
  foreground: "hsl(210 40% 98%)",
  card: "hsl(222 47% 11%)",
  cardForeground: "hsl(210 40% 98%)",
  popover: "hsl(222 47% 11%)",
  popoverForeground: "hsl(210 40% 98%)",
  primary: "hsl(210 40% 98%)",
  primaryForeground: "hsl(222 47% 11%)",
  secondary: "hsl(217 33% 17%)",
  secondaryForeground: "hsl(210 40% 98%)",
  muted: "hsl(217 33% 17%)",
  mutedForeground: "hsl(215 20% 65%)",
  accent: "hsl(217 33% 17%)",
  accentForeground: "hsl(210 40% 98%)",
  destructive: "hsl(0 62% 30%)",
  destructiveForeground: "hsl(210 40% 98%)",
  border: "hsl(217 33% 17%)",
  input: "hsl(217 33% 17%)",
  ring: "hsl(212 95% 68%)",
}

/**
 * Blue-accented light theme
 */
export const blueLightColors: SemanticColors = {
  ...defaultLightColors,
  primary: "hsl(221 83% 53%)",
  primaryForeground: "hsl(0 0% 100%)",
  ring: "hsl(221 83% 53%)",
}

/**
 * Blue-accented dark theme
 */
export const blueDarkColors: SemanticColors = {
  ...defaultDarkColors,
  primary: "hsl(217 91% 60%)",
  primaryForeground: "hsl(222 47% 11%)",
  ring: "hsl(217 91% 60%)",
}

/**
 * Green-accented light theme
 */
export const greenLightColors: SemanticColors = {
  ...defaultLightColors,
  primary: "hsl(142 71% 45%)",
  primaryForeground: "hsl(0 0% 100%)",
  ring: "hsl(142 71% 45%)",
}

/**
 * Violet-accented light theme
 */
export const violetLightColors: SemanticColors = {
  ...defaultLightColors,
  primary: "hsl(262 83% 58%)",
  primaryForeground: "hsl(0 0% 100%)",
  ring: "hsl(262 83% 58%)",
}

// ============================================================================
// Spacing Scale (8px base grid)
// ============================================================================

export const defaultSpacing: SpacingScale = {
  px: "1px",
  0: "0px",
  0.5: "0.125rem",  // 2px
  1: "0.25rem",     // 4px
  1.5: "0.375rem",  // 6px
  2: "0.5rem",      // 8px
  2.5: "0.625rem",  // 10px
  3: "0.75rem",     // 12px
  3.5: "0.875rem",  // 14px
  4: "1rem",        // 16px
  5: "1.25rem",     // 20px
  6: "1.5rem",      // 24px
  7: "1.75rem",     // 28px
  8: "2rem",        // 32px
  9: "2.25rem",     // 36px
  10: "2.5rem",     // 40px
  11: "2.75rem",    // 44px
  12: "3rem",       // 48px
  14: "3.5rem",     // 56px
  16: "4rem",       // 64px
  20: "5rem",       // 80px
  24: "6rem",       // 96px
  28: "7rem",       // 112px
  32: "8rem",       // 128px
  36: "9rem",       // 144px
  40: "10rem",      // 160px
  44: "11rem",      // 176px
  48: "12rem",      // 192px
  52: "13rem",      // 208px
  56: "14rem",      // 224px
  60: "15rem",      // 240px
  64: "16rem",      // 256px
  72: "18rem",      // 288px
  80: "20rem",      // 320px
  96: "24rem",      // 384px
}

// ============================================================================
// Typography Scale
// ============================================================================

export const defaultTypography: TypographyScale = {
  xs: { fontSize: "0.75rem", lineHeight: "1rem" },
  sm: { fontSize: "0.875rem", lineHeight: "1.25rem" },
  base: { fontSize: "1rem", lineHeight: "1.5rem" },
  lg: { fontSize: "1.125rem", lineHeight: "1.75rem" },
  xl: { fontSize: "1.25rem", lineHeight: "1.75rem" },
  "2xl": { fontSize: "1.5rem", lineHeight: "2rem" },
  "3xl": { fontSize: "1.875rem", lineHeight: "2.25rem" },
  "4xl": { fontSize: "2.25rem", lineHeight: "2.5rem" },
  "5xl": { fontSize: "3rem", lineHeight: "1" },
  "6xl": { fontSize: "3.75rem", lineHeight: "1" },
  "7xl": { fontSize: "4.5rem", lineHeight: "1" },
  "8xl": { fontSize: "6rem", lineHeight: "1" },
  "9xl": { fontSize: "8rem", lineHeight: "1" },
}

// ============================================================================
// Font Weight Scale
// ============================================================================

export const defaultFontWeight: FontWeightScale = {
  thin: 100,
  extralight: 200,
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
}

// ============================================================================
// Border Radius Scale
// ============================================================================

export const defaultRadius: RadiusScale = {
  none: "0px",
  sm: "0.125rem",   // 2px
  default: "0.25rem", // 4px
  md: "0.375rem",   // 6px
  lg: "0.5rem",     // 8px
  xl: "0.75rem",    // 12px
  "2xl": "1rem",    // 16px
  "3xl": "1.5rem",  // 24px
  full: "9999px",
}

// ============================================================================
// Shadow Scale
// ============================================================================

export const defaultShadow: ShadowScale = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  default: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
  inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
  none: "0 0 #0000",
}

// ============================================================================
// Complete Token Sets
// ============================================================================

/**
 * Default design tokens
 */
export const defaultTokens: DesignTokens = {
  colors: defaultLightColors,
  spacing: defaultSpacing,
  typography: defaultTypography,
  fontWeight: defaultFontWeight,
  fontFamily: {
    sans: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
    serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  radius: defaultRadius,
  shadow: defaultShadow,
  duration: {
    75: "75ms",
    100: "100ms",
    150: "150ms",
    200: "200ms",
    300: "300ms",
    500: "500ms",
    700: "700ms",
    1000: "1000ms",
  },
  easing: {
    linear: "linear",
    in: "cubic-bezier(0.4, 0, 1, 1)",
    out: "cubic-bezier(0, 0, 0.2, 1)",
    inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  },
  breakpoints: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px",
  },
  zIndex: {
    0: 0,
    10: 10,
    20: 20,
    30: 30,
    40: 40,
    50: 50,
    auto: "auto",
  },
}

// ============================================================================
// Theme Presets
// ============================================================================

/**
 * Default theme configuration
 */
export const defaultTheme: ThemeConfig = {
  name: "default",
  light: defaultTokens,
  dark: defaultDarkColors,
  defaultMode: "system",
  darkModeClass: "dark",
  useColorScheme: true,
}

/**
 * Blue theme configuration
 */
export const blueTheme: ThemeConfig = {
  name: "blue",
  light: {
    ...defaultTokens,
    colors: blueLightColors,
  },
  dark: blueDarkColors,
  defaultMode: "system",
  darkModeClass: "dark",
  useColorScheme: true,
}

/**
 * Green theme configuration
 */
export const greenTheme: ThemeConfig = {
  name: "green",
  light: {
    ...defaultTokens,
    colors: greenLightColors,
  },
  dark: {
    ...defaultDarkColors,
    primary: "hsl(142 71% 45%)",
    primaryForeground: "hsl(0 0% 100%)",
    ring: "hsl(142 71% 45%)",
  },
  defaultMode: "system",
  darkModeClass: "dark",
  useColorScheme: true,
}

/**
 * Violet theme configuration
 */
export const violetTheme: ThemeConfig = {
  name: "violet",
  light: {
    ...defaultTokens,
    colors: violetLightColors,
  },
  dark: {
    ...defaultDarkColors,
    primary: "hsl(263 70% 50%)",
    primaryForeground: "hsl(0 0% 100%)",
    ring: "hsl(263 70% 50%)",
  },
  defaultMode: "system",
  darkModeClass: "dark",
  useColorScheme: true,
}

/**
 * Get theme preset by name
 */
export function getThemePreset(name: string): ThemeConfig {
  switch (name.toLowerCase()) {
    case "blue":
      return blueTheme
    case "green":
      return greenTheme
    case "violet":
    case "purple":
      return violetTheme
    default:
      return defaultTheme
  }
}

/**
 * Get all available theme preset names
 */
export function getThemePresetNames(): string[] {
  return ["default", "blue", "green", "violet"]
}
