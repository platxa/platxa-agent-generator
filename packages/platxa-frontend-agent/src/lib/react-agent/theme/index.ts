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
  // Color Format Conversion (Feature #70)
  parseRgb,
  parseOklch,
  parseHex,
  rgbToString,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  rgbToOklch,
  oklchToRgb,
  oklchToHsl,
  isInGamut,
  mapToGamut,
  convertColor,
  // Contrast Ratio Validation (Feature #73)
  WCAG_THRESHOLDS,
  getRelativeLuminance,
  calculateContrastRatio,
  meetsWcagContrast,
  validateContrast,
  validateSemanticContrasts,
  suggestContrastAdjustment,
  // Color Format Validation (Feature #81)
  validateHex,
  validateRgb,
  validateHsl,
  validateOklch,
  validateColor,
  validateColorObject,
  // WCAG Contrast Check (Feature #82)
  checkWcagContrast,
  checkSemanticWcagContrast,
  generateWcagReport,
  passesWcagAA,
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
  // React Hook (Feature #34)
  useTheme,
  subscribeToThemeChanges,
  getThemeStateSnapshot,
  setThemeMode,
  getThemeMode,
  setThemeConfig,
  // Build-Time Processing (Feature #43)
  generateStaticStylesheet,
  processThemeForBuild,
  processPresetForBuild,
  // Size Limit Check (Feature #83)
  DEFAULT_SIZE_THRESHOLDS,
  formatBytes,
  calculateJsonSize,
  getSizeBreakdown,
  checkSizeLimit,
  isUnderSizeLimit,
  validateBrandKitSize,
  // Circular Reference Check (Feature #84)
  extractTokenReferences,
  buildDependencyGraph,
  checkCircularReferences,
  flattenTokens,
  checkBrandKitCircularReferences,
  validateCircularReferences,
  // Safe Dynamic Import (Feature #85)
  DEFAULT_ALLOWED_PACKAGES,
  matchesPattern,
  validatePackage,
  validatePackages,
  createSafeImport,
  validateBrandKitPackages,
  formatPackageValidationReport,
  // Minimal Re-renders (Feature #86)
  shallowEqual,
  createThemeSelector,
  themeSelectors,
  getSelectedSnapshot,
  createSelectiveSubscription,
  createMemoizedContextValue,
  createRenderTracker,
  // Token Memoization (Feature #87)
  createTokenCache,
  tokenCache,
  memoizeTokenComputation,
  createMemoizedTokenResolver,
  batchMemoize,
  clearTokenCaches,
  getTokenCacheStats,
} from "./theme-worker"

export type {
  UseThemeState,
  BuildOutput,
  // Contrast Ratio Validation (Feature #73)
  WcagLevel,
  TextSize,
  ContrastResult,
  // Color Format Validation (Feature #81)
  ColorValidationResult,
  // WCAG Contrast Check (Feature #82)
  WcagComplianceLevel,
  WcagCheckResult,
  WcagComplianceReport,
  // Size Limit Check (Feature #83)
  SizeLimitConfig,
  SectionSize,
  SizeBreakdown,
  SizeSeverity,
  SizeLimitResult,
  // Circular Reference Check (Feature #84)
  CircularReference,
  CircularReferenceResult,
  // Safe Dynamic Import (Feature #85)
  PackageStatus,
  PackageAllowlistConfig,
  PackageValidationResult,
  PackageValidationReport,
  // Minimal Re-renders (Feature #86)
  ThemeSelector,
  RenderTrackingConfig,
  // Token Memoization (Feature #87)
  TokenCacheConfig,
  CacheStats,
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
