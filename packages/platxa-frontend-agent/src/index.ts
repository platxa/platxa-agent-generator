// =============================================================================
// PLATXA FRONTEND AGENT - Main Entry Point
// =============================================================================

// Utilities
export {
  cn,
  formatCompact,
  generateId,
  isBrowser,
  prefersReducedMotion,
  delay,
} from "./lib/utils"

// Components
export { Button, AnimatedButton, buttonVariants } from "./components/ui/button"
export type { ButtonProps, AnimatedButtonProps } from "./components/ui/button"

// Re-export from barrel
export * from "./components/ui"

// =============================================================================
// THEME SYSTEM
// =============================================================================

// Theme worker functions
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
} from "./lib/react-agent/theme"

// Theme presets and tokens
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
} from "./lib/react-agent/theme"

// Theme types
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
} from "./lib/react-agent/theme"

// =============================================================================
// BRAND SYSTEM (Opt-In)
// =============================================================================

// Configuration helpers
export {
  defineFrontendConfig,
  resolveConfig,
  validateConfig,
  getBuiltInTheme,
  getBuiltInPresetNames,
  getAllPresetNames,
  isBuiltInPreset,
  usesBrandKit,
  usesBuiltInTheme,
  getEffectivePreset,
  BUILTIN_PRESETS,
  DEFAULT_CONFIG,
} from "./lib/react-agent/brand"

// Brand types
export type {
  BuiltInPreset,
  ThemePresetName,
  BrandKitMeta,
  BrandKitExport,
  BrandColorPrimitives,
  BrandSemanticColors,
  BrandTypography,
  BrandSpacing,
  BrandRadius,
  BrandShadow,
  FrontendConfig,
  ThemeOptions,
  BrandOptions,
  ResolvedConfig,
  ConfigLoadingState,
  ConfigState,
  ConfigValidationResult,
} from "./lib/react-agent/brand"
