/**
 * Brand Kit Loader
 *
 * Implements opt-in brand loading - brand kits are ONLY loaded when
 * explicitly specified via brand.package in configuration.
 *
 * Key Principles:
 * 1. No imports/network requests unless brand.package is specified
 * 2. Lazy loading via dynamic import() to avoid bundle bloat
 * 3. Graceful error handling with fallback to default theme
 * 4. Clear loading states (idle, loading, loaded, error)
 *
 * @module react-agent/brand/loader
 */

import type {
  BrandKitExport,
  BrandKitValidationResult,
  ConfigLoadingState,
  ResolvedConfig,
} from "./types"
import type { DesignTokens, ThemeConfig } from "../theme/types"
import { defaultTheme, defaultTokens } from "../theme/tokens"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Brand loading result
 */
export interface BrandLoadResult {
  /** Loading status */
  status: ConfigLoadingState
  /** Loaded brand kit (when status is "loaded") */
  brandKit: BrandKitExport | null
  /** Normalized tokens (when status is "loaded") */
  tokens: DesignTokens | null
  /** Theme config (always available - falls back to default) */
  themeConfig: ThemeConfig
  /** Error message (when status is "error") */
  error?: string
}

/**
 * Brand loader options
 */
export interface BrandLoaderOptions {
  /** Timeout for loading (ms) */
  timeout?: number
  /** Whether to throw on error (default: false - falls back to default) */
  throwOnError?: boolean
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default loading timeout (10 seconds) */
const DEFAULT_TIMEOUT = 10000

/** Cache for loaded brand kits */
const brandCache = new Map<string, BrandKitExport>()

// =============================================================================
// BRAND LOADING STATE
// =============================================================================

/**
 * Current brand loading state
 * This is the global state that tracks whether a brand is being loaded
 */
let currentLoadingState: ConfigLoadingState = "idle"
let currentBrandKit: BrandKitExport | null = null

/**
 * Get current brand loading state
 */
export function getBrandLoadingState(): ConfigLoadingState {
  return currentLoadingState
}

/**
 * Get currently loaded brand kit (if any)
 */
export function getCurrentBrandKit(): BrandKitExport | null {
  return currentBrandKit
}

/**
 * Check if a brand kit is currently loaded
 */
export function isBrandLoaded(): boolean {
  return currentLoadingState === "loaded" && currentBrandKit !== null
}

/**
 * Check if brand loading is in progress
 */
export function isBrandLoading(): boolean {
  return currentLoadingState === "loading"
}

// =============================================================================
// BRAND LOADING
// =============================================================================

/**
 * Load a brand kit by package name
 *
 * This function ONLY performs loading when called - it does NOT
 * automatically load anything. The calling code must explicitly
 * decide to load a brand kit.
 *
 * @param packageName - NPM package name or local path
 * @param options - Loading options
 * @returns Promise resolving to load result
 *
 * @example
 * ```typescript
 * // Only load when explicitly configured
 * const config = resolveConfig(userConfig)
 * if (config.mode === "brand" && config.brandPackage) {
 *   const result = await loadBrandKit(config.brandPackage)
 *   if (result.status === "loaded") {
 *     // Use brand tokens
 *   }
 * }
 * ```
 */
export async function loadBrandKit(
  packageName: string,
  options: BrandLoaderOptions = {}
): Promise<BrandLoadResult> {
  const { timeout = DEFAULT_TIMEOUT, throwOnError = false } = options

  // Check cache first
  const cached = brandCache.get(packageName)
  if (cached) {
    return {
      status: "loaded",
      brandKit: cached,
      tokens: normalizeTokens(cached),
      themeConfig: createThemeFromBrand(cached),
    }
  }

  // Update state
  currentLoadingState = "loading"

  try {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Brand kit loading timed out after ${timeout}ms`))
      }, timeout)
    })

    // Dynamic import with timeout
    const loadPromise = dynamicImportBrand(packageName)
    const brandKit = await Promise.race([loadPromise, timeoutPromise])

    // Validate brand kit structure
    const validationError = validateBrandKitExport(brandKit)
    if (validationError) {
      throw new Error(validationError)
    }

    // Cache the loaded brand kit
    brandCache.set(packageName, brandKit)

    // Update state
    currentLoadingState = "loaded"
    currentBrandKit = brandKit

    return {
      status: "loaded",
      brandKit,
      tokens: normalizeTokens(brandKit),
      themeConfig: createThemeFromBrand(brandKit),
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error loading brand kit"

    // Update state
    currentLoadingState = "error"
    currentBrandKit = null

    if (throwOnError) {
      throw error
    }

    // Graceful fallback to default theme
    console.error(`[brand-loader] Failed to load brand kit: ${errorMessage}`)
    console.error(`[brand-loader] Falling back to default theme`)

    return {
      status: "error",
      brandKit: null,
      tokens: null,
      themeConfig: defaultTheme,
      error: errorMessage,
    }
  }
}

// =============================================================================
// DYNAMIC IMPORT SYSTEM (Feature #4)
// =============================================================================
// Key Design Decisions:
// 1. Uses dynamic import() for lazy loading - brand kit code is NOT in main bundle
// 2. @vite-ignore comment prevents Vite from analyzing/bundling the import path
// 3. Bundler creates separate chunks for each dynamically imported brand kit
// 4. Supports both npm packages (@scope/name) and local paths (./my-brand)
// =============================================================================

/**
 * Dynamic import wrapper for brand kits
 *
 * This is the ONLY place where brand kit code is imported.
 * Uses dynamic import() to ensure brand kits are:
 * - NOT included in the main application bundle
 * - Loaded lazily at runtime only when needed
 * - Split into separate chunks by the bundler
 *
 * @param packageName - NPM package name or local path
 * @returns Promise resolving to the brand kit export
 *
 * @example
 * ```typescript
 * // NPM package - creates separate chunk
 * const brandKit = await dynamicImportBrand("@company/brand-kit")
 *
 * // Local path - creates separate chunk
 * const localBrand = await dynamicImportBrand("./brands/my-brand")
 * ```
 *
 * @internal This function is internal. Use loadBrandKit() instead.
 */
async function dynamicImportBrand(packageName: string): Promise<BrandKitExport> {
  // The @vite-ignore comment is CRITICAL:
  // - Prevents Vite from statically analyzing the import path
  // - Ensures the import is resolved at RUNTIME, not build time
  // - Results in brand kit code NOT being in the main bundle
  //
  // Without @vite-ignore, Vite would try to resolve the path at build time
  // and either fail (for npm packages) or bundle the code (for local paths)
  const module = await import(/* @vite-ignore */ packageName)

  // Brand kits can export in multiple ways:
  // 1. export default brandKit (preferred)
  // 2. export { brandKit }
  // 3. module.exports = brandKit (CommonJS)
  return module.default || module.brandKit || module
}

/**
 * Check if a package name is a valid import specifier
 *
 * @param packageName - The package name to validate
 * @returns true if valid for dynamic import
 */
export function isValidBrandPackageName(packageName: string): boolean {
  if (!packageName || typeof packageName !== "string") {
    return false
  }

  // Local paths
  if (packageName.startsWith("./") || packageName.startsWith("../")) {
    return true
  }

  // Scoped npm packages (@scope/name)
  if (packageName.startsWith("@")) {
    return /^@[\w-]+\/[\w-]+/.test(packageName)
  }

  // Regular npm packages
  return /^[\w-]+/.test(packageName)
}

// =============================================================================
// BRAND RESOLUTION
// =============================================================================

/**
 * Resolve brand from configuration
 *
 * This is the main entry point for brand resolution. It:
 * 1. Checks if brand loading is needed (only when brand.package specified)
 * 2. Returns immediately with default theme if no brand specified
 * 3. Loads brand kit only when explicitly configured
 *
 * @param config - Resolved configuration
 * @param options - Loading options
 * @returns Promise resolving to load result
 */
export async function resolveBrand(
  config: ResolvedConfig,
  options: BrandLoaderOptions = {}
): Promise<BrandLoadResult> {
  // NO brand loading if mode is "builtin"
  // This is the key to opt-in behavior
  if (config.mode === "builtin") {
    return {
      status: "loaded",
      brandKit: null,
      tokens: config.themeConfig.light,
      themeConfig: config.themeConfig,
    }
  }

  // Brand mode - load the specified package
  if (config.brandPackage) {
    const result = await loadBrandKit(config.brandPackage, options)

    // Apply overrides if specified
    if (result.status === "loaded" && config.brandOverrides && result.tokens) {
      result.tokens = mergeTokens(result.tokens, config.brandOverrides)
    }

    return result
  }

  // No brand package specified - use default
  return {
    status: "loaded",
    brandKit: null,
    tokens: defaultTokens,
    themeConfig: defaultTheme,
  }
}

// =============================================================================
// TOKEN NORMALIZATION
// =============================================================================

/**
 * Normalize brand kit tokens to internal DesignTokens format
 */
function normalizeTokens(brandKit: BrandKitExport): DesignTokens {
  return {
    colors: brandKit.semantics.light,
    spacing: brandKit.spacing || defaultTokens.spacing,
    typography: brandKit.typography?.fontSize || defaultTokens.typography,
    fontWeight: brandKit.typography?.fontWeight || defaultTokens.fontWeight,
    fontFamily: brandKit.typography?.fontFamily || defaultTokens.fontFamily,
    radius: brandKit.radius || defaultTokens.radius,
    shadow: brandKit.shadow || defaultTokens.shadow,
    duration: defaultTokens.duration,
    easing: defaultTokens.easing,
    breakpoints: defaultTokens.breakpoints,
    zIndex: defaultTokens.zIndex,
  }
}

/**
 * Merge tokens with overrides
 */
function mergeTokens(
  base: DesignTokens,
  overrides: Partial<DesignTokens>
): DesignTokens {
  return {
    ...base,
    ...overrides,
    colors: {
      ...base.colors,
      ...(overrides.colors || {}),
    },
  }
}

/**
 * Create ThemeConfig from brand kit
 */
function createThemeFromBrand(brandKit: BrandKitExport): ThemeConfig {
  return {
    name: brandKit.meta.name,
    light: normalizeTokens(brandKit),
    dark: brandKit.semantics.dark,
    defaultMode: "system",
    darkModeClass: "dark",
    useColorScheme: true,
  }
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate brand kit export structure (internal - returns first error)
 * Returns error message if invalid, undefined if valid
 */
function validateBrandKitExport(brandKit: unknown): string | undefined {
  const result = validateBrandKit(brandKit)
  return result.errors[0]
}

/**
 * Comprehensive brand kit validation
 *
 * Validates a brand kit object against the BrandKitExport interface.
 * Use this for detailed validation feedback during development.
 *
 * @param brandKit - Object to validate
 * @returns Detailed validation result
 *
 * @example
 * ```typescript
 * import { validateBrandKit } from "@platxa/frontend-agent"
 *
 * const result = validateBrandKit(myBrandKit)
 * if (!result.valid) {
 *   console.error("Validation errors:", result.errors)
 *   console.warn("Missing required:", result.missingRequired)
 * }
 * ```
 */
export function validateBrandKit(brandKit: unknown): BrandKitValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const missingRequired: string[] = []
  const missingOptional: string[] = []

  // Check base type
  if (!brandKit || typeof brandKit !== "object") {
    errors.push("Brand kit must be an object")
    return { valid: false, errors, warnings, missingRequired, missingOptional }
  }

  const kit = brandKit as Record<string, unknown>

  // ==========================================================================
  // REQUIRED: meta
  // ==========================================================================
  if (!kit.meta || typeof kit.meta !== "object") {
    errors.push("Brand kit must export 'meta' object")
    missingRequired.push("meta")
  } else {
    const meta = kit.meta as Record<string, unknown>

    if (typeof meta.name !== "string" || !meta.name) {
      errors.push("meta.name is required and must be a non-empty string")
      missingRequired.push("meta.name")
    }

    if (typeof meta.version !== "string" || !meta.version) {
      errors.push("meta.version is required and must be a non-empty string")
      missingRequired.push("meta.version")
    } else if (!/^\d+\.\d+\.\d+/.test(meta.version as string)) {
      warnings.push("meta.version should follow semver format (e.g., '1.0.0')")
    }

    if (meta.description === undefined) {
      missingOptional.push("meta.description")
    }
    if (meta.author === undefined) {
      missingOptional.push("meta.author")
    }
  }

  // ==========================================================================
  // REQUIRED: primitives
  // ==========================================================================
  if (!kit.primitives || typeof kit.primitives !== "object") {
    errors.push("Brand kit must export 'primitives' object with color scales")
    missingRequired.push("primitives")
  } else {
    const primitives = kit.primitives as Record<string, unknown>

    for (const scale of ["primary", "accent", "neutral"] as const) {
      if (!primitives[scale] || typeof primitives[scale] !== "object") {
        errors.push(`primitives.${scale} is required (12-step color scale)`)
        missingRequired.push(`primitives.${scale}`)
      } else {
        const colorScale = primitives[scale] as Record<string | number, unknown>
        const steps = Object.keys(colorScale).map(Number).filter(n => !isNaN(n))
        if (steps.length < 12) {
          warnings.push(
            `primitives.${scale} has ${steps.length} steps (recommended: 12)`
          )
        }
      }
    }
  }

  // ==========================================================================
  // REQUIRED: semantics
  // ==========================================================================
  if (!kit.semantics || typeof kit.semantics !== "object") {
    errors.push("Brand kit must export 'semantics' object with light/dark colors")
    missingRequired.push("semantics")
  } else {
    const semantics = kit.semantics as Record<string, unknown>

    if (!semantics.light || typeof semantics.light !== "object") {
      errors.push("semantics.light is required")
      missingRequired.push("semantics.light")
    } else {
      validateSemanticColors(semantics.light as Record<string, unknown>, "light", warnings)
    }

    if (!semantics.dark || typeof semantics.dark !== "object") {
      errors.push("semantics.dark is required")
      missingRequired.push("semantics.dark")
    } else {
      validateSemanticColors(semantics.dark as Record<string, unknown>, "dark", warnings)
    }
  }

  // ==========================================================================
  // OPTIONAL fields
  // ==========================================================================
  if (kit.typography === undefined) {
    missingOptional.push("typography")
  }
  if (kit.spacing === undefined) {
    missingOptional.push("spacing")
  }
  if (kit.radius === undefined) {
    missingOptional.push("radius")
  }
  if (kit.shadow === undefined) {
    missingOptional.push("shadow")
  }
  if (kit.tailwindPreset === undefined) {
    missingOptional.push("tailwindPreset")
  }
  if (kit.css === undefined) {
    missingOptional.push("css")
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    missingRequired,
    missingOptional,
  }
}

/**
 * Validate semantic colors have expected keys
 */
function validateSemanticColors(
  colors: Record<string, unknown>,
  mode: "light" | "dark",
  warnings: string[]
): void {
  const expectedKeys = [
    "background",
    "foreground",
    "primary",
    "primaryForeground",
    "secondary",
    "secondaryForeground",
    "muted",
    "mutedForeground",
    "accent",
    "accentForeground",
    "destructive",
    "destructiveForeground",
    "border",
    "input",
    "ring",
  ]

  for (const key of expectedKeys) {
    if (colors[key] === undefined) {
      warnings.push(`semantics.${mode}.${key} is recommended for full compatibility`)
    }
  }
}

// =============================================================================
// CACHE MANAGEMENT
// =============================================================================

/**
 * Clear the brand kit cache
 */
export function clearBrandCache(): void {
  brandCache.clear()
  currentLoadingState = "idle"
  currentBrandKit = null
}

/**
 * Remove a specific brand kit from cache
 */
export function removeBrandFromCache(packageName: string): boolean {
  return brandCache.delete(packageName)
}

/**
 * Check if a brand kit is cached
 */
export function isBrandCached(packageName: string): boolean {
  return brandCache.has(packageName)
}

/**
 * Get cache size
 */
export function getBrandCacheSize(): number {
  return brandCache.size
}
