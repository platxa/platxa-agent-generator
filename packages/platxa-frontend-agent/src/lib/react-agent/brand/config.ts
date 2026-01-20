/**
 * Brand Configuration System
 *
 * Provides configuration resolution for the opt-in brand kit system.
 * Built-in themes are the DEFAULT - brand kits only load when explicitly specified.
 *
 * Key Principles:
 * 1. Zero-config default: Works out-of-box with built-in "default" theme
 * 2. No external dependencies: Built-in presets require no additional packages
 * 3. Backward compatible: Existing projects continue to work unchanged
 * 4. Opt-in brand loading: Brand kits only loaded when brand.package specified
 *
 * @module react-agent/brand/config
 */

import {
  defaultTheme,
  blueTheme,
  greenTheme,
  violetTheme,
  getThemePresetNames,
} from "../theme/tokens"
import type { ThemeConfig } from "../theme/types"
import type {
  FrontendConfig,
  ResolvedConfig,
  ThemePresetName,
  BuiltInPreset,
  BrandKitExport,
} from "./types"

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Built-in theme presets that work without any configuration
 * Frozen at runtime to prevent accidental modification
 */
export const BUILTIN_PRESETS: readonly BuiltInPreset[] = Object.freeze([
  "default",
  "blue",
  "green",
  "violet",
] as const)

/**
 * Default configuration when no config file is provided
 */
export const DEFAULT_CONFIG: FrontendConfig = {
  theme: {
    preset: "default",
  },
  // brand is NOT specified by default - this is the key to opt-in behavior
}

// =============================================================================
// CONFIGURATION HELPER
// =============================================================================

/**
 * Type-safe configuration helper with IntelliSense support
 *
 * @example
 * ```typescript
 * // frontend.config.ts
 * import { defineFrontendConfig } from "@platxa/frontend-agent"
 *
 * export default defineFrontendConfig({
 *   // Use built-in preset (default behavior)
 *   theme: {
 *     preset: "blue",
 *   },
 * })
 * ```
 *
 * @example
 * ```typescript
 * // Opt-in to brand kit
 * export default defineFrontendConfig({
 *   brand: {
 *     package: "@platxa/brand-kit",
 *   },
 * })
 * ```
 */
export function defineFrontendConfig(config: FrontendConfig): FrontendConfig {
  return config
}

/**
 * Type-safe brand kit definition helper with IntelliSense support
 *
 * Use this when creating brand kit packages to get full TypeScript
 * support and validation of the brand kit structure.
 *
 * @example
 * ```typescript
 * // my-brand/index.ts
 * import { defineBrandKit } from "@platxa/frontend-agent"
 *
 * export default defineBrandKit({
 *   meta: {
 *     name: "my-brand",
 *     version: "1.0.0",
 *     description: "My company brand kit"
 *   },
 *   primitives: {
 *     primary: { 1: "hsl(206 100% 99%)", ... },
 *     accent: { ... },
 *     neutral: { ... }
 *   },
 *   semantics: {
 *     light: { background: "...", foreground: "...", ... },
 *     dark: { background: "...", foreground: "...", ... }
 *   }
 * })
 * ```
 */
export function defineBrandKit(brandKit: BrandKitExport): BrandKitExport {
  return brandKit
}

// =============================================================================
// PRESET RESOLUTION
// =============================================================================

/**
 * Check if a preset name is a built-in preset
 */
export function isBuiltInPreset(name: string): name is BuiltInPreset {
  return BUILTIN_PRESETS.includes(name as BuiltInPreset)
}

/**
 * Get built-in theme config by preset name
 * Returns default theme if preset is not recognized
 */
export function getBuiltInTheme(preset: ThemePresetName): ThemeConfig {
  switch (preset) {
    case "blue":
      return blueTheme
    case "green":
      return greenTheme
    case "violet":
    case "purple":
      return violetTheme
    case "default":
    default:
      // Default theme for any unrecognized preset
      // This ensures backward compatibility
      return defaultTheme
  }
}

/**
 * Get all available built-in preset names
 */
export function getBuiltInPresetNames(): readonly BuiltInPreset[] {
  return BUILTIN_PRESETS
}

/**
 * Get all available theme preset names (including extended)
 */
export function getAllPresetNames(): string[] {
  return getThemePresetNames()
}

// =============================================================================
// CONFIGURATION RESOLUTION
// =============================================================================

/**
 * Resolve configuration with all defaults applied
 *
 * Resolution order:
 * 1. If brand.package specified → mode: "brand"
 * 2. If theme.custom specified → use custom theme generation
 * 3. If theme.preset specified → use built-in preset
 * 4. Default → use "default" preset
 *
 * @param config - User configuration (may be undefined for zero-config)
 * @returns Resolved configuration with theme config
 */
export function resolveConfig(config?: FrontendConfig): ResolvedConfig {
  // Zero-config default: use DEFAULT_CONFIG when no config provided
  const userConfig = config ?? DEFAULT_CONFIG

  // Check if brand kit is specified (opt-in)
  const hasBrandPackage = Boolean(userConfig.brand?.package)

  if (hasBrandPackage) {
    // Brand kit mode - will be loaded dynamically (Feature #2, #4)
    // For now, fall back to default theme until brand is loaded
    return {
      mode: "brand",
      preset: "default",
      brandPackage: userConfig.brand!.package,
      brandOverrides: userConfig.brand?.overrides,
      themeConfig: defaultTheme,
    }
  }

  // Built-in theme mode (DEFAULT behavior)
  const preset = userConfig.theme?.preset ?? "default"
  const custom = userConfig.theme?.custom

  if (custom) {
    // Custom theme will be generated (uses theme-worker)
    return {
      mode: "builtin",
      preset: preset as ThemePresetName,
      custom,
      themeConfig: getBuiltInTheme(preset as ThemePresetName),
    }
  }

  // Use built-in preset
  return {
    mode: "builtin",
    preset: preset as ThemePresetName,
    themeConfig: getBuiltInTheme(preset as ThemePresetName),
  }
}

// =============================================================================
// CONFIGURATION VALIDATION
// =============================================================================

/**
 * Validation result
 */
export interface ConfigValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate frontend configuration
 *
 * @param config - Configuration to validate
 * @returns Validation result with errors and warnings
 */
export function validateConfig(config: FrontendConfig): ConfigValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate theme preset if specified
  if (config.theme?.preset) {
    const validPresets = [...BUILTIN_PRESETS, ...getThemePresetNames()]
    if (!validPresets.includes(config.theme.preset)) {
      errors.push(
        `Invalid theme preset "${config.theme.preset}". ` +
          `Available presets: ${BUILTIN_PRESETS.join(", ")}`
      )
    }
  }

  // Validate custom theme options
  if (config.theme?.custom) {
    const { primaryHue, saturation } = config.theme.custom

    if (typeof primaryHue !== "number" || primaryHue < 0 || primaryHue > 360) {
      errors.push("theme.custom.primaryHue must be a number between 0 and 360")
    }

    if (saturation && !["low", "medium", "high"].includes(saturation)) {
      errors.push(
        'theme.custom.saturation must be "low", "medium", or "high"'
      )
    }
  }

  // Warn about conflicting options
  if (config.theme && config.brand?.package) {
    warnings.push(
      "Both theme and brand.package specified. " +
        "Brand kit tokens will override theme preset when loaded."
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if configuration uses brand kit (opt-in)
 */
export function usesBrandKit(config?: FrontendConfig): boolean {
  return Boolean(config?.brand?.package)
}

/**
 * Check if configuration uses built-in theme (default behavior)
 */
export function usesBuiltInTheme(config?: FrontendConfig): boolean {
  return !usesBrandKit(config)
}

/**
 * Get the effective preset name from configuration
 */
export function getEffectivePreset(config?: FrontendConfig): ThemePresetName {
  return (config?.theme?.preset as ThemePresetName) ?? "default"
}
