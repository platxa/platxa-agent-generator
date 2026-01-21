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
  CONFIG_FILE_NAME,
  CONFIG_FILE_NAMES,
  SUPPORTED_EXTENSIONS,
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
  // Token Normalization (Feature #5)
  normalizeBrandTokens,
  mergeDesignTokens,
  // State Management
  getBrandLoadingState,
  getCurrentBrandKit,
  isBrandLoaded,
  isBrandLoading,
  clearBrandCache,
  removeBrandFromCache,
  isBrandCached,
  getBrandCacheSize,
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
