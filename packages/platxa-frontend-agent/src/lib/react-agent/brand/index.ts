/**
 * Brand System Module
 *
 * Opt-in brand kit system for platxa-frontend-agent.
 * Built-in themes are the DEFAULT - brand kits only load when explicitly specified.
 *
 * @example
 * ```typescript
 * import {
 *   defineFrontendConfig,
 *   resolveConfig,
 *   getBuiltInPresetNames,
 * } from "@platxa/frontend-agent"
 *
 * // Zero-config: uses default theme automatically
 * const config = resolveConfig()
 * console.log(config.mode) // "builtin"
 * console.log(config.preset) // "default"
 *
 * // Use built-in preset
 * const blueConfig = resolveConfig({
 *   theme: { preset: "blue" }
 * })
 *
 * // Opt-in to brand kit (explicit)
 * const brandConfig = resolveConfig({
 *   brand: { package: "@platxa/brand-kit" }
 * })
 * console.log(brandConfig.mode) // "brand"
 * ```
 *
 * @module react-agent/brand
 */

// Configuration
export {
  defineFrontendConfig,
  defineBrandKit,
  resolveConfig,
  validateConfig,
  // Config Validation (Feature #61)
  formatValidationResult,
  getBuiltInTheme,
  getBuiltInPresetNames,
  getAllPresetNames,
  isBuiltInPreset,
  usesBrandKit,
  usesBuiltInTheme,
  getEffectivePreset,
  BUILTIN_PRESETS,
  DEFAULT_CONFIG,
  // Brand Kit Creation Tools (Feature #45)
  createBrandKitTemplate,
  EXAMPLE_BRAND_KIT,
  // Brand Kit Package Template (Feature #46)
  generateBrandKitPackageTemplate,
  // Environment Detection (Feature #60)
  getCurrentEnvironment,
} from "./config"

export type {
  ConfigValidationResult,
  // Config Validation (Feature #61)
  ConfigValidationError,
  ConfigValidationWarning,
  BrandKitTemplateOptions,
  BrandKitPackageOptions,
  BrandKitPackageTemplate,
  // Environment Detection (Feature #60)
  ResolveConfigOptions,
} from "./config"

// Config File Loader (Feature #7)
export {
  loadConfigFile,
  findAndLoadConfig,
  validateLoadedConfig,
  isSupportedExtension,
  getConfigExtension,
  isConfigFileName,
  getConfigFilePaths,
  getConfigFormatDescription,
  isConfigLoadingSupported,
  // Config Auto-Discovery (Feature #62)
  getAllConfigSearchPaths,
  CONFIG_FILE_NAME,
  CONFIG_FILE_NAMES,
  SUPPORTED_EXTENSIONS,
  CONFIG_SEARCH_DIRS,
} from "./config-loader"

export type {
  ConfigFileExtension,
  ConfigFileResult,
  ConfigLoaderOptions,
} from "./config-loader"

// Brand Loader (Opt-In)
export {
  loadBrandKit,
  resolveBrand,
  validateBrandKit,
  isValidBrandPackageName,
  // Local Path Loading (Feature #65)
  isLocalPath,
  isNpmPackage,
  // Token Normalization (Feature #5)
  normalizeBrandTokens,
  mergeDesignTokens,
  // State Management
  getBrandLoadingState,
  getCurrentBrandKit,
  isBrandLoaded,
  isBrandLoading,
  // Loading States (Feature #68)
  getBrandError,
  isBrandError,
  getBrandLoadingStatus,
  clearBrandCache,
  removeBrandFromCache,
  isBrandCached,
  getBrandCacheSize,
  // Version-Aware Caching (Feature #66)
  getCachedBrandVersion,
  isCacheVersionValid,
  invalidateCacheIfVersionMismatch,
  getCacheEntryInfo,
  // Version Checking (Feature #67)
  FRONTEND_AGENT_VERSION,
  MIN_BRAND_KIT_VERSION,
  parseVersion,
  compareVersions,
  meetsMinimumVersion,
  checkVersionCompatibility,
  validateBrandKitVersion,
  // Tailwind Preset (Feature #63)
  getTailwindPreset,
  hasTailwindPreset,
  // CSS File Paths (Feature #64)
  getCssPaths,
  getCssTokensPath,
  getCssThemesPath,
  hasCssPaths,
  getAllCssPaths,
  // React Hook (Feature #33)
  useBrand,
  subscribeToBrandChanges,
  getBrandStateSnapshot,
  // CSS Injection Prevention (Feature #39)
  validateCssValue,
  sanitizeCssValue,
  validateBrandKitCss,
  // AI Brand Context Injection (Feature #55)
  generateBrandContext,
  getCurrentBrandContext,
  // Brand Context Provider (Feature #58)
  defaultBrandContextValue,
  createBrandProviderValue,
} from "./loader"

export type {
  BrandLoadResult,
  BrandLoaderOptions,
  UseBrandState,
  BrandContextOptions,
  // Brand Context Provider (Feature #58)
  BrandProviderProps,
  BrandContextValue,
  // Version Checking (Feature #67)
  VersionCompatibilityResult,
  // Loading States (Feature #68)
  BrandLoadingStatus,
} from "./loader"

// Types
export type {
  // Preset types
  BuiltInPreset,
  ThemePresetName,
  // Brand kit interface (for brand kit authors)
  BrandKitMeta,
  BrandKitExport,
  BrandColorPrimitives,
  BrandSemanticColors,
  BrandTypography,
  BrandSpacing,
  BrandRadius,
  BrandShadow,
  // Tailwind v4 Preset (Feature #63)
  TailwindV4Preset,
  TailwindV4ThemeExtend,
  // CSS File Paths (Feature #64)
  BrandKitCssPaths,
  // Configuration types
  FrontendConfig,
  ThemeOptions,
  BrandOptions,
  ResolvedConfig,
  ConfigLoadingState,
  ConfigState,
  // Environment types (Feature #60)
  EnvironmentName,
  EnvironmentOverrides,
  // Helper types
  DefineFrontendConfigReturn,
  DefineBrandKitReturn,
  // Validation types
  BrandKitValidationResult,
} from "./types"
