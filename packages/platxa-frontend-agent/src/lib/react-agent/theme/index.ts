/**
 * Theme Worker Module
 *
 * Provides design token management and CSS generation
 * following Tailwind v4 patterns with OKLCH color support.
 *
 * @example
 * ```typescript
 * import {
 *   generateTheme,
 *   createTheme,
 *   getThemePreset,
 * } from "@/lib/react-agent/theme"
 *
 * // Generate from preset
 * const blueTheme = generateThemeFromPreset("blue")
 *
 * // Create custom theme
 * const custom = createTheme("custom", {
 *   primaryHue: 262,
 *   saturation: "high",
 * })
 * const generated = generateTheme(custom)
 * ```
 *
 * @module react-agent/theme
 */

// Main worker functions
export {
  parseHsl,
  hslToString,
  hslToOklch,
  oklchToString,
  lighten,
  darken,
  saturate,
  generatePalette,
  generateSemanticColors,
  generateColorVariables,
  generateCss,
  generateDarkModeCss,
  generateTailwindTheme,
  generateThemeScript,
  generateTheme,
  generateThemeFromPreset,
  createTheme,
  validateTheme,
} from "./theme-worker"

// Token presets
export {
  slatePalette,
  zincPalette,
  neutralPalette,
  defaultLightColors,
  defaultDarkColors,
  blueLightColors,
  blueDarkColors,
  greenLightColors,
  violetLightColors,
  defaultSpacing,
  defaultTypography,
  defaultFontWeight,
  defaultRadius,
  defaultShadow,
  defaultTokens,
  defaultTheme,
  blueTheme,
  greenTheme,
  violetTheme,
  getThemePreset,
  getThemePresetNames,
} from "./tokens"

// Type exports
export type {
  ColorFormat,
  OklchColor,
  HslColor,
  RgbColor,
  ColorValue,
  SemanticColors,
  ColorPalette,
  SpacingScale,
  TypographyScale,
  FontWeightScale,
  RadiusScale,
  ShadowScale,
  DurationScale,
  EasingScale,
  Breakpoints,
  ZIndexScale,
  DesignTokens,
  ThemeMode,
  ThemeConfig,
  GeneratedTheme,
  ColorGenerationOptions,
  PaletteGenerationOptions,
  ThemePreset,
} from "./types"
