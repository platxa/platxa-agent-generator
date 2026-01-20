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
} from "./config"

export type { ConfigValidationResult } from "./config"

// Types
export type {
  // Preset types
  BuiltInPreset,
  ThemePresetName,
  // Brand kit interface
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
  DefineFrontendConfigReturn,
} from "./types"
