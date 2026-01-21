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
  // SSR Support (Feature #88)
  isServer,
  isBrowser,
  SSR_DEFAULT_MODE,
  getSSRSafeMode,
  generateSSRCss,
  generateSSRInitScript,
  getSSRThemeState,
  getSSRSafeThemeState,
  createSSRThemeProviderProps,
  wrapCssInStyleTag,
  wrapInScriptTag,
  generateSSRHeadContent,
  // Static Site Generation (Feature #89)
  generateStaticCss,
  generateStaticJson,
  generateStaticJs,
  generateStaticTs,
  buildStaticTheme,
  generateCriticalCss,
  getStaticTokens,
  validateStaticBuild,
  // Bundle Size Reporting (Feature #90)
  analyzeBundleSize,
  compareBundleSizes,
  formatBundleSizeReport,
  createSizeHistoryEntry,
  analyzeSizeTrend,
  // Extend Brand Helper (Feature #91)
  extendBrand,
  extendTokens,
  extendColors,
  createBrandVariant,
  composeBrandOverrides,
  pickBrandCategories,
  omitBrandCategories,
  validateExtendedBrand,
  // Brand Kit Inheritance (Feature #92)
  createBrandKitRegistry,
  resolveBrandInheritance,
  hasInheritance,
  getParentBrand,
  createChildBrand,
  flattenBrandInheritance,
  // Partial Brand Kits (Feature #93)
  validatePartialBrandKit,
  createColorOverride,
  createSpacingOverride,
  createTypographyOverride,
  isPartialBrandKit,
  mergePartialBrandKit,
  mergePartialBrandKits,
  extractPartialBrandKit,
  // Next.js Integration (Feature #94)
  generateNextMetadata,
  generateNextLayoutConfig,
  getServerThemeTokens,
  getServerThemeStyle,
  generateNextViewport,
  generateNextThemeProvider,
  generateNextRouteConfig,
  // Tailwind Plugin (Feature #95)
  generateTailwindThemeDirective,
  generateTailwindPlugin,
  generateTailwindV4Css,
  generateTailwindConfig,
  generateTailwindUtilities,
  // Monorepo Support (Feature #96)
  detectPackageManager,
  parseWorkspaceProtocol,
  createWorkspaceVersion,
  resolveMonorepoPath,
  generateMonorepoDependencies,
  generateTsConfigPaths,
  generateMonorepoConfig,
  generateBrandKitImport,
  validateMonorepoSetup,
  createBrandKitPackage,
  // Migration Guide (Feature #97)
  BREAKING_CHANGES,
  getBreakingChangesBetween,
  generateMigrationGuide,
  formatMigrationGuideMarkdown,
  detectMigrationIssues,
  generateMigrationCodemod,
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
  // SSR Support (Feature #88)
  SSRThemeConfig,
  SSRThemeState,
  // Static Site Generation (Feature #89)
  SSGOutputFormat,
  SSGConfig,
  SSGBuildResult,
  StaticTokenExport,
  // Bundle Size Reporting (Feature #90)
  ModuleSizeInfo,
  SizeHistoryEntry,
  SizeDelta,
  BundleSizeReport,
  BundleSizeConfig,
  // Extend Brand Helper (Feature #91)
  ExtendBrandOptions,
  DeepPartial,
  // Brand Kit Inheritance (Feature #92)
  BrandKitRegistry,
  ResolveInheritanceOptions,
  InheritanceResolutionResult,
  // Partial Brand Kits (Feature #93)
  PartialBrandKit,
  MergePartialOptions,
  PartialBrandKitValidation,
  // Next.js Integration (Feature #94)
  NextThemeColorEntry,
  NextThemeMetadata,
  NextIntegrationOptions,
  NextLayoutConfig,
  // Tailwind Plugin (Feature #95)
  TailwindPluginOptions,
  TailwindThemeDirective,
  TailwindPluginOutput,
  // Monorepo Support (Feature #96)
  PackageManager,
  WorkspaceConfig,
  BrandKitReference,
  MonorepoBrandConfig,
  MonorepoResolveOptions,
  // Migration Guide (Feature #97)
  BreakingChangeSeverity,
  BreakingChange,
  MigrationStep,
  VersionMigrationGuide,
  MigrationGuideOptions,
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
