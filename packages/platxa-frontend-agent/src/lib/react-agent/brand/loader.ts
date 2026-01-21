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
 * ## Tree Shaking Support (Feature #69)
 *
 * This module is designed to be fully tree-shakeable:
 * - All exports are ESM-compatible with named exports
 * - No side effects at module level (sideEffects: false in package.json)
 * - Functions are pure where possible
 * - Dynamic imports prevent unused brand kits from being bundled
 *
 * ### For Brand Kit Authors
 *
 * To ensure your brand kit is tree-shakeable:
 * 1. Use named exports only (no default exports with objects)
 * 2. Add `"sideEffects": false` to your package.json
 * 3. Use `"type": "module"` for ESM output
 * 4. Avoid top-level side effects (console.log, DOM manipulation, etc.)
 *
 * @example Tree-shakeable brand kit structure
 * ```typescript
 * // Good: Named exports
 * export const meta: BrandKitMeta = { ... }
 * export const colors: BrandColorPrimitives = { ... }
 * export const tokens: DesignTokens = { ... }
 *
 * // Avoid: Default export with everything
 * // export default { meta, colors, tokens }
 * ```
 *
 * @module react-agent/brand/loader
 */

import type {
  BrandKitExport,
  BrandKitValidationResult,
  ConfigLoadingState,
  ResolvedConfig,
  BrandColorPrimitives,
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

// =============================================================================
// VERSION CHECKING (Feature #67)
// =============================================================================

/**
 * Current frontend-agent version for compatibility checking
 *
 * Brand kits declare which frontend-agent version they're compatible with.
 * This allows us to warn users when versions may be incompatible.
 */
export const FRONTEND_AGENT_VERSION = "1.0.0"

/**
 * Minimum supported brand kit schema version
 *
 * Brand kits with a version below this are considered incompatible
 * and will produce warnings or errors during loading.
 */
export const MIN_BRAND_KIT_VERSION = "1.0.0"

/**
 * Version compatibility result
 */
export interface VersionCompatibilityResult {
  /** Whether the versions are compatible */
  compatible: boolean
  /** The brand kit version */
  brandKitVersion: string
  /** The frontend-agent version */
  frontendAgentVersion: string
  /** Warning message if versions may have issues */
  warning?: string
  /** Error message if versions are incompatible */
  error?: string
}

/**
 * Parse a semver version string into components
 *
 * @param version - Version string (e.g., "1.2.3", "1.0.0-beta.1")
 * @returns Parsed version object or null if invalid
 */
export function parseVersion(version: string): {
  major: number
  minor: number
  patch: number
  prerelease?: string
} | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/)
  if (!match) return null

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
  }
}

/**
 * Compare two semver versions
 *
 * @param a - First version
 * @param b - Second version
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const parsedA = parseVersion(a)
  const parsedB = parseVersion(b)

  // Invalid versions are treated as 0.0.0
  const vA = parsedA ?? { major: 0, minor: 0, patch: 0 }
  const vB = parsedB ?? { major: 0, minor: 0, patch: 0 }

  if (vA.major !== vB.major) return vA.major < vB.major ? -1 : 1
  if (vA.minor !== vB.minor) return vA.minor < vB.minor ? -1 : 1
  if (vA.patch !== vB.patch) return vA.patch < vB.patch ? -1 : 1

  // Prerelease versions are considered less than release versions
  if (vA.prerelease && !vB.prerelease) return -1
  if (!vA.prerelease && vB.prerelease) return 1

  return 0
}

/**
 * Check if a version meets a minimum requirement
 *
 * @param version - Version to check
 * @param minVersion - Minimum required version
 * @returns true if version >= minVersion
 */
export function meetsMinimumVersion(version: string, minVersion: string): boolean {
  return compareVersions(version, minVersion) >= 0
}

/**
 * Check brand kit version compatibility with frontend-agent (Feature #67)
 *
 * Validates that a brand kit's declared version is compatible with the
 * current frontend-agent version. This helps prevent runtime issues from
 * version mismatches.
 *
 * @param brandKitVersion - Version from brand kit meta
 * @param options - Optional configuration
 * @returns Compatibility result with warnings/errors
 *
 * @example Basic usage
 * ```typescript
 * const result = checkVersionCompatibility("1.0.0")
 * if (!result.compatible) {
 *   console.error(result.error)
 * } else if (result.warning) {
 *   console.warn(result.warning)
 * }
 * ```
 *
 * @example With brand kit meta
 * ```typescript
 * const brandKit = await loadBrandKit("@acme/brand-kit")
 * if (brandKit.brandKit?.meta.version) {
 *   const compat = checkVersionCompatibility(brandKit.brandKit.meta.version)
 *   if (!compat.compatible) {
 *     throw new Error(compat.error)
 *   }
 * }
 * ```
 */
export function checkVersionCompatibility(
  brandKitVersion: string,
  options: {
    /** Custom minimum version (default: MIN_BRAND_KIT_VERSION) */
    minVersion?: string
    /** Treat warnings as errors */
    strict?: boolean
  } = {}
): VersionCompatibilityResult {
  const { minVersion = MIN_BRAND_KIT_VERSION, strict = false } = options
  const frontendAgentVersion = FRONTEND_AGENT_VERSION

  const result: VersionCompatibilityResult = {
    compatible: true,
    brandKitVersion,
    frontendAgentVersion,
  }

  // Check if version is valid
  const parsed = parseVersion(brandKitVersion)
  if (!parsed) {
    result.compatible = false
    result.error = `Invalid brand kit version format: "${brandKitVersion}". Expected semver format (e.g., "1.0.0")`
    return result
  }

  // Check minimum version requirement
  if (!meetsMinimumVersion(brandKitVersion, minVersion)) {
    result.compatible = false
    result.error = `Brand kit version ${brandKitVersion} is below minimum supported version ${minVersion}. Please upgrade your brand kit.`
    return result
  }

  // Check for major version mismatch (warning)
  const parsedAgent = parseVersion(frontendAgentVersion)
  if (parsedAgent && parsed.major !== parsedAgent.major) {
    const message = `Brand kit major version (${parsed.major}) differs from frontend-agent (${parsedAgent.major}). This may cause compatibility issues.`
    if (strict) {
      result.compatible = false
      result.error = message
    } else {
      result.warning = message
    }
    return result
  }

  // Check for minor version mismatch (warning for newer brand kit)
  if (parsedAgent && parsed.minor > parsedAgent.minor) {
    result.warning = `Brand kit version ${brandKitVersion} is newer than frontend-agent ${frontendAgentVersion}. Some features may not be supported.`
  }

  return result
}

/**
 * Validate brand kit version during loading (Feature #67)
 *
 * Called internally during brand kit loading to check version compatibility.
 * Logs warnings to console and can optionally throw on incompatibility.
 *
 * @param brandKit - Loaded brand kit
 * @param options - Validation options
 * @returns true if compatible (or no version specified)
 */
export function validateBrandKitVersion(
  brandKit: BrandKitExport,
  options: {
    /** Throw error on incompatibility (default: false, just warns) */
    throwOnIncompatible?: boolean
    /** Suppress console warnings */
    silent?: boolean
  } = {}
): boolean {
  const { throwOnIncompatible = false, silent = false } = options

  // Version is optional - if not provided, assume compatible
  const version = brandKit.meta?.version
  if (!version) {
    if (!silent) {
      console.warn(
        `[platxa-frontend-agent] Brand kit "${brandKit.meta?.name ?? "unknown"}" does not specify a version. Consider adding a version for compatibility tracking.`
      )
    }
    return true
  }

  const result = checkVersionCompatibility(version)

  if (!result.compatible) {
    if (throwOnIncompatible) {
      throw new Error(`[platxa-frontend-agent] ${result.error}`)
    }
    if (!silent) {
      console.error(`[platxa-frontend-agent] ${result.error}`)
    }
    return false
  }

  if (result.warning && !silent) {
    console.warn(`[platxa-frontend-agent] ${result.warning}`)
  }

  return true
}

/**
 * Cache entry for brand kits (Feature #66)
 *
 * Stores both the brand kit and its version for invalidation.
 */
interface BrandCacheEntry {
  /** The cached brand kit */
  brandKit: BrandKitExport
  /** Version from brand kit meta (for invalidation) */
  version: string
  /** Timestamp when cached (for potential TTL) */
  cachedAt: number
}

/**
 * Cache for loaded brand kits (Feature #66)
 *
 * Key: package name
 * Value: cache entry with brand kit and version
 *
 * The cache stores version info in each entry, allowing version validation
 * without requiring version-specific keys. Use `isCacheVersionValid()` to
 * check if cached version matches expected, and `invalidateCacheIfVersionMismatch()`
 * to conditionally clear stale entries.
 */
const brandCache = new Map<string, BrandCacheEntry>()

// =============================================================================
// BRAND LOADING STATE
// =============================================================================

/**
 * Current brand loading state
 * This is the global state that tracks whether a brand is being loaded
 */
let currentLoadingState: ConfigLoadingState = "idle"
let currentBrandKit: BrandKitExport | null = null
/** Current error message (Feature #68) */
let currentBrandError: string | null = null

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
 * Get current brand loading error (Feature #68)
 *
 * Returns the error message if brand loading failed, null otherwise.
 *
 * @returns Error message or null
 *
 * @example
 * ```typescript
 * const error = getBrandError()
 * if (error) {
 *   console.error("Failed to load brand:", error)
 * }
 * ```
 */
export function getBrandError(): string | null {
  return currentBrandError
}

/**
 * Check if brand loading resulted in an error (Feature #68)
 *
 * @returns true if there's an error state
 *
 * @example
 * ```typescript
 * if (isBrandError()) {
 *   showErrorMessage(getBrandError())
 * }
 * ```
 */
export function isBrandError(): boolean {
  return currentLoadingState === "error" && currentBrandError !== null
}

/**
 * Combined loading status for convenient access (Feature #68)
 */
export interface BrandLoadingStatus {
  /** Current loading state */
  state: ConfigLoadingState
  /** Whether currently loading */
  isLoading: boolean
  /** Whether successfully loaded */
  isLoaded: boolean
  /** Whether loading resulted in error */
  isError: boolean
  /** Whether in idle state (not started) */
  isIdle: boolean
  /** Error message if any */
  error: string | null
  /** Loaded brand kit if any */
  brandKit: BrandKitExport | null
}

/**
 * Get combined brand loading status (Feature #68)
 *
 * Returns a comprehensive status object with all loading states.
 * This is convenient for components that need multiple state checks.
 *
 * @returns Combined loading status
 *
 * @example
 * ```typescript
 * const status = getBrandLoadingStatus()
 *
 * if (status.isLoading) {
 *   return <LoadingSpinner />
 * }
 *
 * if (status.isError) {
 *   return <ErrorMessage>{status.error}</ErrorMessage>
 * }
 *
 * if (status.isLoaded && status.brandKit) {
 *   return <BrandedUI brandKit={status.brandKit} />
 * }
 * ```
 */
export function getBrandLoadingStatus(): BrandLoadingStatus {
  return {
    state: currentLoadingState,
    isLoading: currentLoadingState === "loading",
    isLoaded: currentLoadingState === "loaded" && currentBrandKit !== null,
    isError: currentLoadingState === "error",
    isIdle: currentLoadingState === "idle",
    error: currentBrandError,
    brandKit: currentBrandKit,
  }
}

/**
 * Get Tailwind v4 preset from current or provided brand kit (Feature #63)
 *
 * Returns the Tailwind preset if the brand kit provides one, or undefined
 * if no preset is available. The preset can be spread directly into
 * tailwind.config.ts.
 *
 * @param kit - Optional brand kit (uses current loaded kit if not provided)
 * @returns Tailwind v4 preset or undefined
 *
 * @example Using with current loaded brand kit
 * ```typescript
 * // After loading a brand kit
 * const preset = getTailwindPreset()
 * if (preset) {
 *   // Use in tailwind.config.ts
 * }
 * ```
 *
 * @example Using with a specific brand kit
 * ```typescript
 * import brandKit from "@acme/brand-kit"
 *
 * const preset = getTailwindPreset(brandKit)
 * // preset is typed as TailwindV4Preset | undefined
 * ```
 *
 * @example In tailwind.config.ts
 * ```typescript
 * import { getTailwindPreset } from "@platxa/frontend-agent"
 * import brandKit from "@acme/brand-kit"
 *
 * const preset = getTailwindPreset(brandKit) ?? {}
 *
 * export default {
 *   ...preset,
 *   content: ["./src/** /*.{ts,tsx}"],
 * }
 * ```
 */
export function getTailwindPreset(
  kit?: BrandKitExport | null
): BrandKitExport["tailwindPreset"] {
  const brandKit = kit ?? currentBrandKit
  return brandKit?.tailwindPreset
}

/**
 * Check if a brand kit provides a Tailwind preset (Feature #63)
 *
 * @param kit - Optional brand kit (uses current loaded kit if not provided)
 * @returns true if the brand kit has a tailwindPreset field
 */
export function hasTailwindPreset(kit?: BrandKitExport | null): boolean {
  const brandKit = kit ?? currentBrandKit
  return brandKit?.tailwindPreset !== undefined
}

// =============================================================================
// CSS FILE PATHS (Feature #64)
// =============================================================================

/**
 * Get CSS file paths from a brand kit (Feature #64)
 *
 * Returns the CSS paths object if the brand kit provides one.
 * All paths are optional within the css object.
 *
 * @param kit - Optional brand kit (uses current loaded kit if not provided)
 * @returns CSS paths object or undefined
 *
 * @example Get all CSS paths
 * ```typescript
 * const paths = getCssPaths(brandKit)
 * if (paths?.tokens) {
 *   console.log("Tokens CSS:", paths.tokens)
 * }
 * ```
 */
export function getCssPaths(
  kit?: BrandKitExport | null
): BrandKitExport["css"] {
  const brandKit = kit ?? currentBrandKit
  return brandKit?.css
}

/**
 * Get the tokens CSS file path from a brand kit (Feature #64)
 *
 * @param kit - Optional brand kit (uses current loaded kit if not provided)
 * @returns Path to tokens CSS file or undefined
 *
 * @example
 * ```typescript
 * const tokensPath = getCssTokensPath(brandKit)
 * if (tokensPath) {
 *   // Import or load the CSS file
 * }
 * ```
 */
export function getCssTokensPath(
  kit?: BrandKitExport | null
): string | undefined {
  const brandKit = kit ?? currentBrandKit
  return brandKit?.css?.tokens
}

/**
 * Get the themes CSS file path from a brand kit (Feature #64)
 *
 * @param kit - Optional brand kit (uses current loaded kit if not provided)
 * @returns Path to themes CSS file or undefined
 */
export function getCssThemesPath(
  kit?: BrandKitExport | null
): string | undefined {
  const brandKit = kit ?? currentBrandKit
  return brandKit?.css?.themes
}

/**
 * Check if a brand kit provides CSS file paths (Feature #64)
 *
 * @param kit - Optional brand kit (uses current loaded kit if not provided)
 * @returns true if the brand kit has any css paths defined
 */
export function hasCssPaths(kit?: BrandKitExport | null): boolean {
  const brandKit = kit ?? currentBrandKit
  const css = brandKit?.css
  return css !== undefined && (
    css.tokens !== undefined ||
    css.themes !== undefined ||
    css.components !== undefined ||
    css.utilities !== undefined
  )
}

/**
 * Get all available CSS file paths as an array (Feature #64)
 *
 * Useful for loading all CSS files provided by a brand kit.
 *
 * @param kit - Optional brand kit (uses current loaded kit if not provided)
 * @returns Array of CSS file paths (may be empty)
 *
 * @example Load all brand CSS files
 * ```typescript
 * const paths = getAllCssPaths(brandKit)
 * for (const path of paths) {
 *   await import(path)
 * }
 * ```
 */
export function getAllCssPaths(
  kit?: BrandKitExport | null
): string[] {
  const brandKit = kit ?? currentBrandKit
  const css = brandKit?.css
  if (!css) return []

  const paths: string[] = []
  // Order matters: tokens first, then themes, then components, then utilities
  if (css.tokens) paths.push(css.tokens)
  if (css.themes) paths.push(css.themes)
  if (css.components) paths.push(css.components)
  if (css.utilities) paths.push(css.utilities)
  return paths
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
// REACT HOOK (Feature #33)
// =============================================================================

/**
 * Brand state for React hook
 */
export interface UseBrandState {
  /** Brand name (if loaded) */
  name: string | null
  /** Brand version (if loaded) */
  version: string | null
  /** Whether brand is loaded */
  isLoaded: boolean
  /** Whether brand is loading */
  isLoading: boolean
  /** Loading state */
  status: ConfigLoadingState
  /** Full brand kit (if loaded) */
  brandKit: BrandKitExport | null
}

/** Subscribers for brand state changes */
const subscribers = new Set<() => void>()

/** Notify all subscribers of state change */
function notifySubscribers(): void {
  subscribers.forEach((callback) => callback())
}

/**
 * Subscribe to brand state changes
 * @param callback - Function to call when state changes
 * @returns Unsubscribe function
 */
export function subscribeToBrandChanges(callback: () => void): () => void {
  subscribers.add(callback)
  return () => subscribers.delete(callback)
}

/**
 * Get current brand state snapshot
 * Used by useBrand hook for synchronous state access
 */
export function getBrandStateSnapshot(): UseBrandState {
  const brandKit = currentBrandKit
  return {
    name: brandKit?.meta.name ?? null,
    version: brandKit?.meta.version ?? null,
    isLoaded: currentLoadingState === "loaded" && brandKit !== null,
    isLoading: currentLoadingState === "loading",
    status: currentLoadingState,
    brandKit,
  }
}

/**
 * React hook to access current brand information
 *
 * Returns the current brand state including name, version, and loading status.
 * Automatically updates when brand state changes.
 *
 * @returns Current brand state
 *
 * @example
 * ```tsx
 * import { useBrand } from "@platxa/frontend-agent"
 *
 * function BrandDisplay() {
 *   const { name, version, isLoaded, isLoading } = useBrand()
 *
 *   if (isLoading) return <div>Loading brand...</div>
 *   if (!isLoaded) return <div>Using default theme</div>
 *
 *   return <div>Brand: {name} v{version}</div>
 * }
 * ```
 */
export function useBrand(): UseBrandState {
  // Note: This is a simple implementation that works without React import
  // For full React integration, consumers should use useSyncExternalStore:
  //
  // import { useSyncExternalStore } from "react"
  // const state = useSyncExternalStore(
  //   subscribeToBrandChanges,
  //   getBrandStateSnapshot
  // )
  //
  // This function returns current state for simpler use cases
  return getBrandStateSnapshot()
}

// =============================================================================
// BRAND CONTEXT PROVIDER (Feature #58)
// =============================================================================

/**
 * Props for BrandProvider component
 */
export interface BrandProviderProps {
  /** Brand package to load (optional - uses default theme if not specified) */
  brandPackage?: string
  /** Children to render */
  children: React.ReactNode
  /** Loading component to show while brand loads */
  loading?: React.ReactNode
  /** Error component to show if brand fails to load */
  fallback?: React.ReactNode
  /** Whether to throw on error (default: false, shows fallback) */
  throwOnError?: boolean
}

/**
 * Brand context value type
 */
export interface BrandContextValue extends UseBrandState {
  /** Load a different brand kit */
  loadBrand: (packageName: string) => Promise<void>
  /** Clear current brand and use default theme */
  clearBrand: () => void
}

/**
 * React context for brand information
 *
 * Use this with React.createContext in your app:
 *
 * @example Creating context in your app
 * ```tsx
 * import { createContext, useContext } from "react"
 * import type { BrandContextValue } from "@platxa/frontend-agent"
 *
 * const BrandContext = createContext<BrandContextValue | null>(null)
 *
 * export function useBrandContext() {
 *   const context = useContext(BrandContext)
 *   if (!context) throw new Error("useBrandContext must be used within BrandProvider")
 *   return context
 * }
 * ```
 */
export const defaultBrandContextValue: BrandContextValue = {
  ...getBrandStateSnapshot(),
  loadBrand: async (packageName: string) => {
    await loadBrandKit(packageName)
  },
  clearBrand: () => {
    clearBrandCache()
  },
}

/**
 * Creates BrandProvider props for React component usage
 *
 * Since this library avoids direct React imports for maximum compatibility,
 * this function provides the props needed to create a BrandProvider in your app.
 *
 * @param props - Provider configuration
 * @returns Object with context value and effect handlers
 *
 * @example Creating a BrandProvider in your app
 * ```tsx
 * import { createContext, useContext, useEffect, useState } from "react"
 * import {
 *   createBrandProviderProps,
 *   subscribeToBrandChanges,
 *   getBrandStateSnapshot,
 *   type BrandContextValue,
 * } from "@platxa/frontend-agent"
 *
 * const BrandContext = createContext<BrandContextValue | null>(null)
 *
 * export function BrandProvider({ children, brandPackage }: { children: React.ReactNode, brandPackage?: string }) {
 *   const [state, setState] = useState(getBrandStateSnapshot())
 *
 *   // Subscribe to changes
 *   useEffect(() => {
 *     return subscribeToBrandChanges(() => {
 *       setState(getBrandStateSnapshot())
 *     })
 *   }, [])
 *
 *   // Load brand on mount
 *   useEffect(() => {
 *     if (brandPackage) {
 *       loadBrandKit(brandPackage)
 *     }
 *   }, [brandPackage])
 *
 *   const contextValue: BrandContextValue = {
 *     ...state,
 *     loadBrand: async (pkg) => { await loadBrandKit(pkg) },
 *     clearBrand: () => { clearBrandCache() },
 *   }
 *
 *   return (
 *     <BrandContext.Provider value={contextValue}>
 *       {children}
 *     </BrandContext.Provider>
 *   )
 * }
 *
 * export function useBrandContext() {
 *   const context = useContext(BrandContext)
 *   if (!context) throw new Error("Must be used within BrandProvider")
 *   return context
 * }
 * ```
 *
 * @example With useSyncExternalStore (React 18+)
 * ```tsx
 * import { useSyncExternalStore } from "react"
 * import { subscribeToBrandChanges, getBrandStateSnapshot } from "@platxa/frontend-agent"
 *
 * function useBrandState() {
 *   return useSyncExternalStore(
 *     subscribeToBrandChanges,
 *     getBrandStateSnapshot,
 *     getBrandStateSnapshot // SSR snapshot
 *   )
 * }
 * ```
 */
export function createBrandProviderValue(
  overrides?: Partial<BrandContextValue>
): BrandContextValue {
  return {
    ...getBrandStateSnapshot(),
    loadBrand: async (packageName: string) => {
      await loadBrandKit(packageName)
    },
    clearBrand: () => {
      clearBrandCache()
    },
    ...overrides,
  }
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

  // Check cache first (Feature #66)
  const cached = brandCache.get(packageName)
  if (cached) {
    // Return cached version
    return {
      status: "loaded",
      brandKit: cached.brandKit,
      tokens: normalizeTokens(cached.brandKit),
      themeConfig: createThemeFromBrand(cached.brandKit),
    }
  }

  // Update state
  currentLoadingState = "loading"
  notifySubscribers()

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

    // Cache the loaded brand kit with version (Feature #66)
    brandCache.set(packageName, {
      brandKit,
      version: brandKit.meta.version,
      cachedAt: Date.now(),
    })

    // Update state (Feature #68: clear error on success)
    currentLoadingState = "loaded"
    currentBrandKit = brandKit
    currentBrandError = null
    notifySubscribers()

    return {
      status: "loaded",
      brandKit,
      tokens: normalizeTokens(brandKit),
      themeConfig: createThemeFromBrand(brandKit),
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error loading brand kit"

    // Update state (Feature #68: set error)
    currentLoadingState = "error"
    currentBrandKit = null
    currentBrandError = errorMessage
    notifySubscribers()

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
 * Validates that the package name can be used with dynamic import.
 * Supports:
 * - Relative paths (./brand, ../brand)
 * - Absolute paths (/path/to/brand)
 * - Scoped npm packages (@scope/name)
 * - Regular npm packages (package-name)
 *
 * @param packageName - The package name to validate
 * @returns true if valid for dynamic import
 *
 * @example
 * ```typescript
 * isValidBrandPackageName("./my-brand")         // true (relative)
 * isValidBrandPackageName("../shared/brand")    // true (relative parent)
 * isValidBrandPackageName("/home/user/brand")   // true (absolute)
 * isValidBrandPackageName("@acme/brand-kit")    // true (scoped npm)
 * isValidBrandPackageName("brand-kit")          // true (npm package)
 * isValidBrandPackageName("")                   // false (empty)
 * ```
 */
export function isValidBrandPackageName(packageName: string): boolean {
  if (!packageName || typeof packageName !== "string") {
    return false
  }

  // Local relative paths (./brand, ../brand)
  if (packageName.startsWith("./") || packageName.startsWith("../")) {
    return true
  }

  // Absolute paths (/path/to/brand) - Feature #65
  if (packageName.startsWith("/")) {
    return true
  }

  // Scoped npm packages (@scope/name)
  if (packageName.startsWith("@")) {
    return /^@[\w-]+\/[\w-]+/.test(packageName)
  }

  // Regular npm packages
  return /^[\w-]+/.test(packageName)
}

/**
 * Check if a package name is a local file path (Feature #65)
 *
 * @param packageName - The package name to check
 * @returns true if it's a local path (relative or absolute)
 *
 * @example
 * ```typescript
 * isLocalPath("./my-brand")         // true
 * isLocalPath("../shared/brand")    // true
 * isLocalPath("/home/user/brand")   // true
 * isLocalPath("@acme/brand-kit")    // false
 * isLocalPath("package-name")       // false
 * ```
 */
export function isLocalPath(packageName: string): boolean {
  return (
    packageName.startsWith("./") ||
    packageName.startsWith("../") ||
    packageName.startsWith("/")
  )
}

/**
 * Check if a package name is an npm package (not a local path)
 *
 * @param packageName - The package name to check
 * @returns true if it's an npm package reference
 */
export function isNpmPackage(packageName: string): boolean {
  return isValidBrandPackageName(packageName) && !isLocalPath(packageName)
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

// =============================================================================
// SEMANTIC TOKEN MAPPING (Feature #71)
// =============================================================================

/**
 * Mapping rule for a single semantic token
 *
 * Defines how to derive a semantic token from primitives.
 */
export interface SemanticTokenMappingRule {
  /** Which primitive scale to use (primary, accent, neutral) */
  scale: "primary" | "accent" | "neutral"
  /** Which step in the scale (1-12) */
  step: number
  /** Optional alpha/opacity (0-1) */
  alpha?: number
}

/**
 * Complete mapping configuration for all semantic tokens
 */
export interface SemanticTokenMappingConfig {
  // Light mode mappings
  light: {
    background: SemanticTokenMappingRule
    foreground: SemanticTokenMappingRule
    primary: SemanticTokenMappingRule
    primaryForeground: SemanticTokenMappingRule
    secondary: SemanticTokenMappingRule
    secondaryForeground: SemanticTokenMappingRule
    muted: SemanticTokenMappingRule
    mutedForeground: SemanticTokenMappingRule
    accent: SemanticTokenMappingRule
    accentForeground: SemanticTokenMappingRule
    card: SemanticTokenMappingRule
    cardForeground: SemanticTokenMappingRule
    popover: SemanticTokenMappingRule
    popoverForeground: SemanticTokenMappingRule
    border: SemanticTokenMappingRule
    input: SemanticTokenMappingRule
    ring: SemanticTokenMappingRule
    destructive?: SemanticTokenMappingRule
    destructiveForeground?: SemanticTokenMappingRule
  }
  // Dark mode mappings
  dark: {
    background: SemanticTokenMappingRule
    foreground: SemanticTokenMappingRule
    primary: SemanticTokenMappingRule
    primaryForeground: SemanticTokenMappingRule
    secondary: SemanticTokenMappingRule
    secondaryForeground: SemanticTokenMappingRule
    muted: SemanticTokenMappingRule
    mutedForeground: SemanticTokenMappingRule
    accent: SemanticTokenMappingRule
    accentForeground: SemanticTokenMappingRule
    card: SemanticTokenMappingRule
    cardForeground: SemanticTokenMappingRule
    popover: SemanticTokenMappingRule
    popoverForeground: SemanticTokenMappingRule
    border: SemanticTokenMappingRule
    input: SemanticTokenMappingRule
    ring: SemanticTokenMappingRule
    destructive?: SemanticTokenMappingRule
    destructiveForeground?: SemanticTokenMappingRule
  }
}

/**
 * Default semantic token mapping rules (Feature #71)
 *
 * These rules define how to derive semantic colors from primitives
 * following Radix UI conventions (12-step color scales).
 *
 * Light mode:
 * - Backgrounds use neutral 1-2 (lightest)
 * - Foregrounds use neutral 11-12 (darkest)
 * - Primary uses primary scale step 9 (main brand color)
 * - Borders use neutral 6 (middle)
 *
 * Dark mode:
 * - Backgrounds use neutral 1-2 (now darkest due to inverted scale)
 * - Foregrounds use neutral 11-12 (now lightest)
 */
export const DEFAULT_SEMANTIC_MAPPING: SemanticTokenMappingConfig = {
  light: {
    background: { scale: "neutral", step: 1 },
    foreground: { scale: "neutral", step: 12 },
    primary: { scale: "primary", step: 9 },
    primaryForeground: { scale: "neutral", step: 1 },
    secondary: { scale: "neutral", step: 3 },
    secondaryForeground: { scale: "neutral", step: 11 },
    muted: { scale: "neutral", step: 3 },
    mutedForeground: { scale: "neutral", step: 10 },
    accent: { scale: "accent", step: 9 },
    accentForeground: { scale: "neutral", step: 1 },
    card: { scale: "neutral", step: 1 },
    cardForeground: { scale: "neutral", step: 12 },
    popover: { scale: "neutral", step: 1 },
    popoverForeground: { scale: "neutral", step: 12 },
    border: { scale: "neutral", step: 6 },
    input: { scale: "neutral", step: 6 },
    ring: { scale: "primary", step: 7 },
  },
  dark: {
    background: { scale: "neutral", step: 1 },
    foreground: { scale: "neutral", step: 12 },
    primary: { scale: "primary", step: 9 },
    primaryForeground: { scale: "neutral", step: 1 },
    secondary: { scale: "neutral", step: 3 },
    secondaryForeground: { scale: "neutral", step: 11 },
    muted: { scale: "neutral", step: 3 },
    mutedForeground: { scale: "neutral", step: 10 },
    accent: { scale: "accent", step: 9 },
    accentForeground: { scale: "neutral", step: 1 },
    card: { scale: "neutral", step: 2 },
    cardForeground: { scale: "neutral", step: 12 },
    popover: { scale: "neutral", step: 2 },
    popoverForeground: { scale: "neutral", step: 12 },
    border: { scale: "neutral", step: 6 },
    input: { scale: "neutral", step: 6 },
    ring: { scale: "primary", step: 7 },
  },
}

/**
 * Apply alpha to a color string
 */
function applyAlpha(color: string, alpha: number): string {
  // Handle HSL colors
  if (color.startsWith("hsl(")) {
    const match = color.match(/hsl\(([^)]+)\)/)
    if (match) {
      return `hsl(${match[1]} / ${alpha})`
    }
  }
  // Handle OKLCH colors
  if (color.startsWith("oklch(")) {
    const match = color.match(/oklch\(([^)]+)\)/)
    if (match) {
      return `oklch(${match[1]} / ${alpha})`
    }
  }
  return color
}

/**
 * Map primitives to a semantic color using a rule
 */
function applyMappingRule(
  primitives: BrandColorPrimitives,
  rule: SemanticTokenMappingRule
): string {
  const scale = primitives[rule.scale]
  if (!scale) {
    throw new Error(`Primitive scale "${rule.scale}" not found`)
  }

  const color = scale[rule.step]
  if (!color) {
    throw new Error(`Step ${rule.step} not found in "${rule.scale}" scale`)
  }

  if (rule.alpha !== undefined && rule.alpha < 1) {
    return applyAlpha(color, rule.alpha)
  }

  return color
}

/**
 * Generate semantic colors from primitives (Feature #71)
 *
 * Automatically maps brand primitive colors to semantic tokens using
 * configurable mapping rules. This eliminates the need to manually
 * specify each semantic color when creating brand kits.
 *
 * @param primitives - Brand color primitives (primary, accent, neutral scales)
 * @param config - Optional mapping configuration (uses defaults if not provided)
 * @returns Both light and dark semantic color sets
 *
 * @example Basic usage with defaults
 * ```typescript
 * const { light, dark } = mapPrimitivesToSemantics(brandKit.primitives)
 * // light.primary will be primitives.primary[9]
 * // light.background will be primitives.neutral[1]
 * ```
 *
 * @example Custom mapping rules
 * ```typescript
 * const config = {
 *   ...DEFAULT_SEMANTIC_MAPPING,
 *   light: {
 *     ...DEFAULT_SEMANTIC_MAPPING.light,
 *     primary: { scale: "accent", step: 8 }, // Use accent instead
 *   }
 * }
 * const { light, dark } = mapPrimitivesToSemantics(primitives, config)
 * ```
 */
export function mapPrimitivesToSemantics(
  primitives: BrandColorPrimitives,
  config: SemanticTokenMappingConfig = DEFAULT_SEMANTIC_MAPPING
): { light: SemanticColors; dark: SemanticColors } {
  const mapMode = (
    rules: SemanticTokenMappingConfig["light"] | SemanticTokenMappingConfig["dark"]
  ): SemanticColors => ({
    background: applyMappingRule(primitives, rules.background),
    foreground: applyMappingRule(primitives, rules.foreground),
    primary: applyMappingRule(primitives, rules.primary),
    primaryForeground: applyMappingRule(primitives, rules.primaryForeground),
    secondary: applyMappingRule(primitives, rules.secondary),
    secondaryForeground: applyMappingRule(primitives, rules.secondaryForeground),
    muted: applyMappingRule(primitives, rules.muted),
    mutedForeground: applyMappingRule(primitives, rules.mutedForeground),
    accent: applyMappingRule(primitives, rules.accent),
    accentForeground: applyMappingRule(primitives, rules.accentForeground),
    card: applyMappingRule(primitives, rules.card),
    cardForeground: applyMappingRule(primitives, rules.cardForeground),
    popover: applyMappingRule(primitives, rules.popover),
    popoverForeground: applyMappingRule(primitives, rules.popoverForeground),
    border: applyMappingRule(primitives, rules.border),
    input: applyMappingRule(primitives, rules.input),
    ring: applyMappingRule(primitives, rules.ring),
    // Destructive colors have sensible defaults if not mapped
    destructive: rules.destructive
      ? applyMappingRule(primitives, rules.destructive)
      : "hsl(0 84% 60%)",
    destructiveForeground: rules.destructiveForeground
      ? applyMappingRule(primitives, rules.destructiveForeground)
      : "hsl(0 0% 98%)",
  })

  return {
    light: mapMode(config.light),
    dark: mapMode(config.dark),
  }
}

/**
 * Create custom mapping configuration by overriding defaults (Feature #71)
 *
 * Utility to create a custom mapping config while keeping defaults
 * for any rules not explicitly overridden.
 *
 * @param overrides - Partial overrides for light and/or dark mode
 * @returns Complete mapping configuration
 *
 * @example Override primary color mapping
 * ```typescript
 * const config = createMappingConfig({
 *   light: { primary: { scale: "accent", step: 10 } },
 *   dark: { primary: { scale: "accent", step: 8 } }
 * })
 * ```
 */
export function createMappingConfig(
  overrides: {
    light?: Partial<SemanticTokenMappingConfig["light"]>
    dark?: Partial<SemanticTokenMappingConfig["dark"]>
  }
): SemanticTokenMappingConfig {
  return {
    light: { ...DEFAULT_SEMANTIC_MAPPING.light, ...overrides.light },
    dark: { ...DEFAULT_SEMANTIC_MAPPING.dark, ...overrides.dark },
  }
}

/**
 * Get the mapping rule for a specific semantic token
 *
 * @param token - Semantic token name
 * @param mode - Light or dark mode
 * @param config - Mapping configuration
 * @returns The mapping rule for the token
 */
export function getMappingRule(
  token: keyof SemanticTokenMappingConfig["light"],
  mode: "light" | "dark",
  config: SemanticTokenMappingConfig = DEFAULT_SEMANTIC_MAPPING
): SemanticTokenMappingRule | undefined {
  return config[mode][token]
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
    } else if (typeof colors[key] === "string") {
      // Validate CSS value for injection prevention
      const validationResult = validateCssValue(colors[key] as string)
      if (!validationResult.valid) {
        warnings.push(`semantics.${mode}.${key}: ${validationResult.reason}`)
      }
    }
  }
}

// =============================================================================
// CSS INJECTION PREVENTION (Feature #39)
// =============================================================================

/**
 * Dangerous CSS patterns that could lead to XSS
 * - expression() - IE expression (JS execution)
 * - javascript: - JS protocol in URLs
 * - -moz-binding - Firefox XBL binding (deprecated but dangerous)
 * - behavior: - IE behavior (JS execution)
 */
const DANGEROUS_CSS_PATTERNS = [
  /expression\s*\(/i,
  /javascript\s*:/i,
  /-moz-binding\s*:/i,
  /behavior\s*:/i,
  /\burl\s*\(\s*["']?\s*javascript:/i,
  /\burl\s*\(\s*["']?\s*data:\s*text\/html/i,
]

/**
 * CSS value validation result
 */
interface CssValidationResult {
  valid: boolean
  reason?: string
}

/**
 * Validate a CSS value for potential injection attacks
 *
 * Checks for dangerous patterns that could lead to XSS:
 * - expression() (IE)
 * - javascript: protocol
 * - -moz-binding (Firefox)
 * - behavior: (IE)
 * - data: URLs with HTML content
 *
 * @param value - CSS value to validate
 * @returns Validation result
 */
export function validateCssValue(value: string): CssValidationResult {
  if (typeof value !== "string") {
    return { valid: false, reason: "CSS value must be a string" }
  }

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_CSS_PATTERNS) {
    if (pattern.test(value)) {
      return {
        valid: false,
        reason: `Potentially dangerous CSS pattern detected. ` +
          `CSS values cannot contain expressions, javascript:, or other executable content.`,
      }
    }
  }

  return { valid: true }
}

/**
 * Sanitize a CSS value by removing potentially dangerous content
 *
 * This is a more aggressive sanitization that can be used when
 * you want to allow partial values while removing dangerous parts.
 *
 * @param value - CSS value to sanitize
 * @returns Sanitized CSS value
 */
export function sanitizeCssValue(value: string): string {
  if (typeof value !== "string") {
    return ""
  }

  let sanitized = value

  // Remove dangerous patterns
  for (const pattern of DANGEROUS_CSS_PATTERNS) {
    sanitized = sanitized.replace(pattern, "")
  }

  return sanitized.trim()
}

/**
 * Validate all CSS values in a brand kit
 *
 * @param brandKit - Brand kit to validate
 * @returns Array of validation warnings
 */
export function validateBrandKitCss(brandKit: BrandKitExport): string[] {
  const warnings: string[] = []

  // Validate semantic colors
  const validateColors = (colors: Record<string, unknown>, prefix: string) => {
    for (const [key, value] of Object.entries(colors)) {
      if (typeof value === "string") {
        const result = validateCssValue(value)
        if (!result.valid) {
          warnings.push(`${prefix}.${key}: ${result.reason}`)
        }
      }
    }
  }

  if (brandKit.semantics?.light) {
    validateColors(brandKit.semantics.light as unknown as Record<string, unknown>, "semantics.light")
  }
  if (brandKit.semantics?.dark) {
    validateColors(brandKit.semantics.dark as unknown as Record<string, unknown>, "semantics.dark")
  }

  return warnings
}

// =============================================================================
// CACHE MANAGEMENT (Feature #66)
// =============================================================================

/**
 * Clear the brand kit cache
 *
 * Removes all cached brand kits and resets loading state.
 */
export function clearBrandCache(): void {
  brandCache.clear()
  currentLoadingState = "idle"
  currentBrandKit = null
}

/**
 * Remove a specific brand kit from cache
 *
 * @param packageName - The package name to remove
 * @returns true if the entry was removed
 */
export function removeBrandFromCache(packageName: string): boolean {
  return brandCache.delete(packageName)
}

/**
 * Check if a brand kit is cached
 *
 * @param packageName - The package name to check
 * @returns true if the brand kit is in cache
 */
export function isBrandCached(packageName: string): boolean {
  return brandCache.has(packageName)
}

/**
 * Get cache size
 *
 * @returns Number of brand kits in cache
 */
export function getBrandCacheSize(): number {
  return brandCache.size
}

/**
 * Get cached brand kit version (Feature #66)
 *
 * @param packageName - The package name to check
 * @returns The cached version or undefined if not cached
 */
export function getCachedBrandVersion(packageName: string): string | undefined {
  const entry = brandCache.get(packageName)
  return entry?.version
}

/**
 * Check if cached brand kit matches expected version (Feature #66)
 *
 * Useful for cache invalidation checks.
 *
 * @param packageName - The package name to check
 * @param version - The expected version
 * @returns true if cached version matches
 */
export function isCacheVersionValid(packageName: string, version: string): boolean {
  const cachedVersion = getCachedBrandVersion(packageName)
  return cachedVersion === version
}

/**
 * Invalidate cache entry if version doesn't match (Feature #66)
 *
 * Call this before loading if you want to force reload on version mismatch.
 *
 * @param packageName - The package name to check
 * @param expectedVersion - The expected version
 * @returns true if cache was invalidated
 *
 * @example Force reload on version change
 * ```typescript
 * // Check if version changed and invalidate if needed
 * invalidateCacheIfVersionMismatch("@acme/brand-kit", "2.0.0")
 *
 * // Now load will fetch fresh copy if version was different
 * const result = await loadBrandKit("@acme/brand-kit")
 * ```
 */
export function invalidateCacheIfVersionMismatch(
  packageName: string,
  expectedVersion: string
): boolean {
  if (!isBrandCached(packageName)) {
    return false
  }

  if (!isCacheVersionValid(packageName, expectedVersion)) {
    removeBrandFromCache(packageName)
    return true
  }

  return false
}

/**
 * Get cache entry metadata (Feature #66)
 *
 * @param packageName - The package name
 * @returns Cache metadata or undefined if not cached
 */
export function getCacheEntryInfo(
  packageName: string
): { version: string; cachedAt: Date } | undefined {
  const entry = brandCache.get(packageName)
  if (!entry) return undefined

  return {
    version: entry.version,
    cachedAt: new Date(entry.cachedAt),
  }
}

// =============================================================================
// AI BRAND CONTEXT INJECTION (Feature #55)
// =============================================================================

/**
 * Options for generating AI brand context
 */
export interface BrandContextOptions {
  /** Include full color palette */
  includeColors?: boolean
  /** Include typography scale */
  includeTypography?: boolean
  /** Include spacing scale */
  includeSpacing?: boolean
  /** Include radius/shadow tokens */
  includeExtras?: boolean
  /** Format: "xml" for structured tags, "markdown" for readable format */
  format?: "xml" | "markdown"
}

/**
 * Generates brand context for injection into AI prompts
 *
 * This function creates a formatted context block containing the current
 * theme/brand tokens that can be included in AI system prompts. This helps
 * AI models understand the design system when generating components.
 *
 * @param tokens - Design tokens (from theme or brand kit)
 * @param options - Context generation options
 * @returns Formatted context string for AI prompt injection
 *
 * @example Inject into AI system prompt
 * ```typescript
 * import { generateBrandContext, defaultTokens } from "@platxa/frontend-agent"
 *
 * const brandContext = generateBrandContext(defaultTokens)
 *
 * const systemPrompt = `You are a UI component generator.
 *
 * ${brandContext}
 *
 * Generate components that use these design tokens.`
 * ```
 *
 * @example With brand kit tokens
 * ```typescript
 * import { loadBrandKit, generateBrandContext } from "@platxa/frontend-agent"
 *
 * const result = await loadBrandKit("@company/brand-kit")
 * if (result.tokens) {
 *   const context = generateBrandContext(result.tokens, {
 *     format: "xml",
 *     includeTypography: true,
 *   })
 *   // Use context in AI prompt
 * }
 * ```
 */
export function generateBrandContext(
  tokens: DesignTokens,
  options: BrandContextOptions = {}
): string {
  const {
    includeColors = true,
    includeTypography = true,
    includeSpacing = true,
    includeExtras = true,
    format = "xml",
  } = options

  if (format === "xml") {
    return generateXmlContext(tokens, {
      includeColors,
      includeTypography,
      includeSpacing,
      includeExtras,
    })
  }

  return generateMarkdownContext(tokens, {
    includeColors,
    includeTypography,
    includeSpacing,
    includeExtras,
  })
}

/**
 * Generate XML-formatted context (better for structured AI parsing)
 */
function generateXmlContext(
  tokens: DesignTokens,
  opts: { includeColors: boolean; includeTypography: boolean; includeSpacing: boolean; includeExtras: boolean }
): string {
  const sections: string[] = []

  sections.push("<design-system>")

  if (opts.includeColors) {
    sections.push("  <colors>")
    sections.push("    <semantic-colors>")
    for (const [key, value] of Object.entries(tokens.colors)) {
      sections.push(`      <${key}>${value}</${key}>`)
    }
    sections.push("    </semantic-colors>")
    sections.push("  </colors>")
  }

  if (opts.includeTypography && tokens.typography) {
    sections.push("  <typography>")
    for (const [key, value] of Object.entries(tokens.typography)) {
      if (typeof value === "object" && value !== null) {
        const v = value as { fontSize: string; lineHeight: string }
        sections.push(`    <${key} fontSize="${v.fontSize}" lineHeight="${v.lineHeight}" />`)
      }
    }
    sections.push("  </typography>")

    if (tokens.fontFamily) {
      sections.push("  <font-families>")
      for (const [key, value] of Object.entries(tokens.fontFamily)) {
        sections.push(`    <${key}>${value}</${key}>`)
      }
      sections.push("  </font-families>")
    }
  }

  if (opts.includeSpacing && tokens.spacing) {
    sections.push("  <spacing>")
    for (const [key, value] of Object.entries(tokens.spacing)) {
      sections.push(`    <space-${key}>${value}</space-${key}>`)
    }
    sections.push("  </spacing>")
  }

  if (opts.includeExtras) {
    if (tokens.radius) {
      sections.push("  <border-radius>")
      for (const [key, value] of Object.entries(tokens.radius)) {
        sections.push(`    <radius-${key}>${value}</radius-${key}>`)
      }
      sections.push("  </border-radius>")
    }

    if (tokens.shadow) {
      sections.push("  <shadows>")
      for (const [key, value] of Object.entries(tokens.shadow)) {
        sections.push(`    <shadow-${key}>${value}</shadow-${key}>`)
      }
      sections.push("  </shadows>")
    }
  }

  sections.push("</design-system>")

  return sections.join("\n")
}

/**
 * Generate Markdown-formatted context (more human-readable)
 */
function generateMarkdownContext(
  tokens: DesignTokens,
  opts: { includeColors: boolean; includeTypography: boolean; includeSpacing: boolean; includeExtras: boolean }
): string {
  const sections: string[] = []

  sections.push("## Design System Tokens\n")

  if (opts.includeColors) {
    sections.push("### Semantic Colors")
    sections.push("Use these color tokens for component styling:\n")
    for (const [key, value] of Object.entries(tokens.colors)) {
      sections.push(`- **${key}**: \`${value}\``)
    }
    sections.push("")
  }

  if (opts.includeTypography && tokens.typography) {
    sections.push("### Typography Scale")
    sections.push("Font sizes with line heights:\n")
    for (const [key, value] of Object.entries(tokens.typography)) {
      if (typeof value === "object" && value !== null) {
        const v = value as { fontSize: string; lineHeight: string }
        sections.push(`- **${key}**: ${v.fontSize} / ${v.lineHeight}`)
      }
    }
    sections.push("")

    if (tokens.fontFamily) {
      sections.push("### Font Families\n")
      for (const [key, value] of Object.entries(tokens.fontFamily)) {
        sections.push(`- **${key}**: \`${value}\``)
      }
      sections.push("")
    }
  }

  if (opts.includeSpacing && tokens.spacing) {
    sections.push("### Spacing Scale")
    sections.push("Use these spacing values:\n")
    const entries = Object.entries(tokens.spacing).slice(0, 12) // Limit to common values
    for (const [key, value] of entries) {
      sections.push(`- **${key}**: ${value}`)
    }
    sections.push("")
  }

  if (opts.includeExtras) {
    if (tokens.radius) {
      sections.push("### Border Radius\n")
      for (const [key, value] of Object.entries(tokens.radius)) {
        sections.push(`- **${key}**: ${value}`)
      }
      sections.push("")
    }
  }

  return sections.join("\n")
}

/**
 * Gets current brand/theme context for AI injection
 *
 * Convenience function that uses the currently loaded brand or default theme.
 *
 * @param options - Context generation options
 * @returns Formatted context string
 *
 * @example
 * ```typescript
 * import { getCurrentBrandContext } from "@platxa/frontend-agent"
 *
 * const context = getCurrentBrandContext()
 * // Includes current theme/brand tokens
 * ```
 */
export function getCurrentBrandContext(options: BrandContextOptions = {}): string {
  const brandKit = currentBrandKit

  if (brandKit) {
    const tokens = normalizeBrandTokens(brandKit)
    return generateBrandContext(tokens, options)
  }

  // Fall back to default tokens
  return generateBrandContext(defaultTokens, options)
}
