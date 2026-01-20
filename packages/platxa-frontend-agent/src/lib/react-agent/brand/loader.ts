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

/**
 * Dynamic import wrapper for brand kits
 *
 * This is the ONLY place where brand kit code is imported.
 * It uses dynamic import() to ensure the brand kit is not
 * bundled with the main application code.
 */
async function dynamicImportBrand(packageName: string): Promise<BrandKitExport> {
  // Handle local paths vs npm packages
  const importPath = packageName.startsWith(".")
    ? packageName
    : packageName

  // Dynamic import - this is lazy loaded at runtime
  // The brand kit code is NOT included in the main bundle
  const module = await import(/* @vite-ignore */ importPath)

  // Brand kits should export default or named 'brandKit'
  return module.default || module.brandKit || module
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
 * Validate brand kit export structure
 * Returns error message if invalid, undefined if valid
 */
function validateBrandKitExport(brandKit: unknown): string | undefined {
  if (!brandKit || typeof brandKit !== "object") {
    return "Brand kit must be an object"
  }

  const kit = brandKit as Record<string, unknown>

  // Required: meta
  if (!kit.meta || typeof kit.meta !== "object") {
    return "Brand kit must export 'meta' object with name and version"
  }

  const meta = kit.meta as Record<string, unknown>
  if (typeof meta.name !== "string" || !meta.name) {
    return "Brand kit meta.name is required"
  }
  if (typeof meta.version !== "string" || !meta.version) {
    return "Brand kit meta.version is required"
  }

  // Required: semantics
  if (!kit.semantics || typeof kit.semantics !== "object") {
    return "Brand kit must export 'semantics' object with light and dark colors"
  }

  const semantics = kit.semantics as Record<string, unknown>
  if (!semantics.light || typeof semantics.light !== "object") {
    return "Brand kit semantics.light is required"
  }
  if (!semantics.dark || typeof semantics.dark !== "object") {
    return "Brand kit semantics.dark is required"
  }

  return undefined
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
