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
import type { DesignTokens, SemanticColors, ThemeConfig } from "../theme/types"
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
// TOKEN NORMALIZATION (Feature #5)
// =============================================================================
// Key Design Decisions:
// 1. Brand kit tokens are converted to internal DesignTokens format
// 2. Missing optional tokens are filled with platform defaults
// 3. Consistent token structure regardless of source (brand kit or built-in)
// 4. Deep merge for nested structures (colors, spacing, etc.)
// =============================================================================

/**
 * Normalize brand kit tokens to internal DesignTokens format
 *
 * This adapter layer converts brand kit tokens to the internal format:
 * - Extracts semantic colors from brand kit's light/dark semantics
 * - Maps brand typography to internal typography scale
 * - Fills missing optional tokens with platform defaults
 * - Ensures consistent structure for all downstream consumers
 *
 * @param brandKit - The brand kit to normalize
 * @returns Normalized DesignTokens
 *
 * @example
 * ```typescript
 * import { normalizeBrandTokens } from "@platxa/frontend-agent"
 *
 * const tokens = normalizeBrandTokens(brandKit)
 * // tokens has consistent structure with all fields populated
 * ```
 */
export function normalizeBrandTokens(brandKit: BrandKitExport): DesignTokens {
  return {
    // Colors from brand kit semantics (required field)
    colors: normalizeSemanticColors(brandKit.semantics.light),

    // Spacing: use brand kit's or fall back to defaults
    spacing: normalizeSpacing(brandKit.spacing),

    // Typography: extract fontSize from brand kit's typography
    typography: normalizeTypography(brandKit.typography?.fontSize),

    // Font weights: extract from brand kit's typography
    fontWeight: normalizeFontWeight(brandKit.typography?.fontWeight),

    // Font families: extract from brand kit's typography
    fontFamily: normalizeFontFamily(brandKit.typography?.fontFamily),

    // Border radius: use brand kit's or fall back to defaults
    radius: normalizeRadius(brandKit.radius),

    // Shadows: use brand kit's or fall back to defaults
    shadow: normalizeShadow(brandKit.shadow),

    // Animation durations: always use platform defaults
    // (brand kits typically don't customize these)
    duration: defaultTokens.duration,

    // Easing functions: always use platform defaults
    easing: defaultTokens.easing,

    // Breakpoints: always use platform defaults
    // (responsive design should be consistent)
    breakpoints: defaultTokens.breakpoints,

    // Z-index: always use platform defaults
    // (stacking context should be consistent)
    zIndex: defaultTokens.zIndex,
  }
}

// Internal alias for backward compatibility
function normalizeTokens(brandKit: BrandKitExport): DesignTokens {
  return normalizeBrandTokens(brandKit)
}

/**
 * Normalize semantic colors, filling missing values with defaults
 *
 * Accepts SemanticColors from brand kit and ensures all required
 * color tokens are present, using platform defaults for any missing values.
 */
function normalizeSemanticColors(colors: SemanticColors): SemanticColors {
  const defaults = defaultTokens.colors

  return {
    primary: colors.primary || defaults.primary,
    primaryForeground: colors.primaryForeground || defaults.primaryForeground,
    secondary: colors.secondary || defaults.secondary,
    secondaryForeground: colors.secondaryForeground || defaults.secondaryForeground,
    muted: colors.muted || defaults.muted,
    mutedForeground: colors.mutedForeground || defaults.mutedForeground,
    accent: colors.accent || defaults.accent,
    accentForeground: colors.accentForeground || defaults.accentForeground,
    destructive: colors.destructive || defaults.destructive,
    destructiveForeground: colors.destructiveForeground || defaults.destructiveForeground,
    background: colors.background || defaults.background,
    foreground: colors.foreground || defaults.foreground,
    card: colors.card || defaults.card,
    cardForeground: colors.cardForeground || defaults.cardForeground,
    popover: colors.popover || defaults.popover,
    popoverForeground: colors.popoverForeground || defaults.popoverForeground,
    border: colors.border || defaults.border,
    input: colors.input || defaults.input,
    ring: colors.ring || defaults.ring,
  }
}

/**
 * Normalize spacing scale
 */
function normalizeSpacing(
  spacing?: Record<string | number, string>
): DesignTokens["spacing"] {
  if (!spacing) {
    return defaultTokens.spacing
  }

  return {
    ...defaultTokens.spacing,
    ...spacing,
  }
}

/**
 * Normalize typography scale
 */
function normalizeTypography(
  typography?: Record<string, { fontSize: string; lineHeight: string }>
): DesignTokens["typography"] {
  if (!typography) {
    return defaultTokens.typography
  }

  return {
    ...defaultTokens.typography,
    ...typography,
  }
}

/**
 * Normalize font weight scale
 */
function normalizeFontWeight(
  fontWeight?: Record<string, number>
): DesignTokens["fontWeight"] {
  if (!fontWeight) {
    return defaultTokens.fontWeight
  }

  return {
    ...defaultTokens.fontWeight,
    ...fontWeight,
  }
}

/**
 * Normalize font family
 */
function normalizeFontFamily(
  fontFamily?: { sans?: string; serif?: string; mono?: string }
): DesignTokens["fontFamily"] {
  if (!fontFamily) {
    return defaultTokens.fontFamily
  }

  return {
    ...defaultTokens.fontFamily,
    ...fontFamily,
  }
}

/**
 * Normalize border radius scale
 */
function normalizeRadius(
  radius?: Record<string, string>
): DesignTokens["radius"] {
  if (!radius) {
    return defaultTokens.radius
  }

  return {
    ...defaultTokens.radius,
    ...radius,
  }
}

/**
 * Normalize shadow scale
 */
function normalizeShadow(
  shadow?: Record<string, string>
): DesignTokens["shadow"] {
  if (!shadow) {
    return defaultTokens.shadow
  }

  return {
    ...defaultTokens.shadow,
    ...shadow,
  }
}

/**
 * Merge base tokens with overrides
 *
 * Performs a deep merge of token structures, allowing partial
 * overrides of specific token categories.
 *
 * @param base - Base tokens
 * @param overrides - Partial overrides to apply
 * @returns Merged tokens
 *
 * @example
 * ```typescript
 * const customized = mergeDesignTokens(baseTokens, {
 *   colors: { primary: "hsl(220 100% 50%)" }
 * })
 * ```
 */
export function mergeDesignTokens(
  base: DesignTokens,
  overrides: Partial<DesignTokens>
): DesignTokens {
  return {
    colors: {
      ...base.colors,
      ...(overrides.colors || {}),
    },
    spacing: {
      ...base.spacing,
      ...(overrides.spacing || {}),
    },
    typography: {
      ...base.typography,
      ...(overrides.typography || {}),
    },
    fontWeight: {
      ...base.fontWeight,
      ...(overrides.fontWeight || {}),
    },
    fontFamily: {
      ...base.fontFamily,
      ...(overrides.fontFamily || {}),
    },
    radius: {
      ...base.radius,
      ...(overrides.radius || {}),
    },
    shadow: {
      ...base.shadow,
      ...(overrides.shadow || {}),
    },
    duration: {
      ...base.duration,
      ...(overrides.duration || {}),
    },
    easing: {
      ...base.easing,
      ...(overrides.easing || {}),
    },
    breakpoints: {
      ...base.breakpoints,
      ...(overrides.breakpoints || {}),
    },
    zIndex: {
      ...base.zIndex,
      ...(overrides.zIndex || {}),
    },
  }
}

// Internal alias for backward compatibility
function mergeTokens(
  base: DesignTokens,
  overrides: Partial<DesignTokens>
): DesignTokens {
  return mergeDesignTokens(base, overrides)
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
