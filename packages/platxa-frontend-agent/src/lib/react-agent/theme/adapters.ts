/**
 * Custom Adapters for Non-Standard Brand Kits
 *
 * Allows custom adapters for transforming external brand kit formats
 * into ThemeConfig. Supports registration, lookup, and fallback.
 *
 * @module react-agent/theme/adapters
 */

import type { SemanticColors, TypographyScale } from "./types"

// =============================================================================
// ADAPTER-SPECIFIC TYPES
// =============================================================================

/**
 * Flexible design tokens for adapter results.
 * Unlike DesignTokens, uses Record<string, string> for spacing/radius
 * to support arbitrary keys from external formats (Figma, Style Dictionary, etc.)
 */
export interface AdapterDesignTokens {
  /** Semantic color tokens */
  colors: SemanticColors
  /** Spacing values - flexible keys from external formats */
  spacing: Record<string, string>
  /** Typography scale */
  typography: Partial<TypographyScale>
  /** Border radius - flexible keys from external formats */
  radius: Record<string, string>
  /** Box shadows - flexible keys from external formats */
  shadow: Record<string, string>
  /** Font weights */
  fontWeight: Record<string, number>
}

/**
 * Flexible theme config for adapter results.
 * Uses AdapterDesignTokens to support arbitrary keys from external formats.
 */
export interface AdapterThemeConfig {
  /** Theme name */
  name: string
  /** Light mode tokens */
  light: AdapterDesignTokens
  /** Dark mode tokens (colors only) */
  dark?: Partial<SemanticColors>
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * Input data that adapters transform
 */
export type AdapterInput = Record<string, unknown>

/**
 * Adapter transformation result
 */
export interface AdapterResult {
  /** Whether the transformation succeeded */
  success: boolean
  /** The transformed config (if successful) */
  config?: AdapterThemeConfig
  /** Error message (if failed) */
  error?: string
  /** Warnings during transformation */
  warnings?: string[]
}

/**
 * Adapter interface for transforming brand kit formats
 */
export interface BrandKitAdapter {
  /** Unique adapter identifier */
  id: string
  /** Human-readable adapter name */
  name: string
  /** Description of what formats this adapter handles */
  description: string
  /** Priority for auto-detection (higher = checked first) */
  priority: number
  /**
   * Check if this adapter can handle the input
   * @param input Raw input data
   * @returns true if this adapter can transform the input
   */
  canHandle(input: AdapterInput): boolean
  /**
   * Transform input into ThemeConfig
   * @param input Raw input data
   * @param options Transformation options
   * @returns Transformation result
   */
  transform(input: AdapterInput, options?: AdapterOptions): AdapterResult
}

/**
 * Options for adapter transformation
 */
export interface AdapterOptions {
  /** Theme name override */
  name?: string
  /** Strict mode - fail on missing required fields */
  strict?: boolean
  /** Include warnings in result */
  includeWarnings?: boolean
  /** Custom color mapping */
  colorMapping?: Record<string, keyof SemanticColors>
  /** Custom spacing scale mapping */
  spacingMapping?: Record<string, string>
}

/**
 * Adapter registration options
 */
export interface AdapterRegistrationOptions {
  /** Override existing adapter with same ID */
  override?: boolean
}

/**
 * Adapter registry state
 */
interface AdapterRegistryState {
  adapters: Map<string, BrandKitAdapter>
  defaultAdapterId: string | null
}

// =============================================================================
// ADAPTER REGISTRY
// =============================================================================

const state: AdapterRegistryState = {
  adapters: new Map(),
  defaultAdapterId: null,
}

/**
 * Register a custom adapter
 * @param adapter The adapter to register
 * @param options Registration options
 * @throws Error if adapter ID already exists and override is false
 */
export function registerAdapter(
  adapter: BrandKitAdapter,
  options: AdapterRegistrationOptions = {}
): void {
  if (!adapter.id) {
    throw new Error("Adapter must have an id")
  }

  if (!adapter.canHandle || typeof adapter.canHandle !== "function") {
    throw new Error("Adapter must implement canHandle method")
  }

  if (!adapter.transform || typeof adapter.transform !== "function") {
    throw new Error("Adapter must implement transform method")
  }

  if (state.adapters.has(adapter.id) && !options.override) {
    throw new Error(
      `Adapter with id "${adapter.id}" already exists. Use override: true to replace.`
    )
  }

  state.adapters.set(adapter.id, adapter)
}

/**
 * Unregister an adapter
 * @param adapterId The adapter ID to remove
 * @returns true if adapter was removed, false if not found
 */
export function unregisterAdapter(adapterId: string): boolean {
  const existed = state.adapters.has(adapterId)
  state.adapters.delete(adapterId)

  if (state.defaultAdapterId === adapterId) {
    state.defaultAdapterId = null
  }

  return existed
}

/**
 * Get an adapter by ID
 * @param adapterId The adapter ID
 * @returns The adapter or undefined
 */
export function getAdapter(adapterId: string): BrandKitAdapter | undefined {
  return state.adapters.get(adapterId)
}

/**
 * Get all registered adapters
 * @returns Array of all registered adapters
 */
export function getAdapters(): BrandKitAdapter[] {
  return Array.from(state.adapters.values())
}

/**
 * Set the default adapter for fallback
 * @param adapterId The adapter ID to use as default
 * @throws Error if adapter not found
 */
export function setDefaultAdapter(adapterId: string): void {
  if (!state.adapters.has(adapterId)) {
    throw new Error(`Adapter "${adapterId}" not found`)
  }
  state.defaultAdapterId = adapterId
}

/**
 * Get the default adapter
 * @returns The default adapter or undefined
 */
export function getDefaultAdapter(): BrandKitAdapter | undefined {
  if (state.defaultAdapterId) {
    return state.adapters.get(state.defaultAdapterId)
  }
  return undefined
}

/**
 * Find an adapter that can handle the input
 * @param input Raw input data
 * @returns The matching adapter or undefined
 */
export function findAdapter(input: AdapterInput): BrandKitAdapter | undefined {
  // Sort by priority (descending) and check each adapter
  const sortedAdapters = Array.from(state.adapters.values()).sort(
    (a, b) => b.priority - a.priority
  )

  for (const adapter of sortedAdapters) {
    if (adapter.canHandle(input)) {
      return adapter
    }
  }

  return undefined
}

/**
 * Transform input using auto-detected or default adapter
 * @param input Raw input data
 * @param options Transformation options
 * @returns Transformation result
 */
export function transformWithAdapter(
  input: AdapterInput,
  options?: AdapterOptions
): AdapterResult {
  // Try to find a matching adapter
  const adapter = findAdapter(input)

  if (adapter) {
    return adapter.transform(input, options)
  }

  // Fall back to default adapter
  const defaultAdapter = getDefaultAdapter()

  if (defaultAdapter) {
    return defaultAdapter.transform(input, options)
  }

  return {
    success: false,
    error: "No adapter found that can handle this input format",
  }
}

/**
 * Transform input using a specific adapter
 * @param adapterId The adapter ID to use
 * @param input Raw input data
 * @param options Transformation options
 * @returns Transformation result
 */
export function transformWithSpecificAdapter(
  adapterId: string,
  input: AdapterInput,
  options?: AdapterOptions
): AdapterResult {
  const adapter = state.adapters.get(adapterId)

  if (!adapter) {
    return {
      success: false,
      error: `Adapter "${adapterId}" not found`,
    }
  }

  return adapter.transform(input, options)
}

/**
 * Clear all registered adapters
 */
export function clearAdapters(): void {
  state.adapters.clear()
  state.defaultAdapterId = null
}

// =============================================================================
// DEFAULT ADAPTER
// =============================================================================

/**
 * Create default semantic colors with fallbacks
 */
function createDefaultColors(
  colors: Record<string, unknown>
): SemanticColors {
  const getColor = (key: string, fallback: string): string => {
    const value = colors[key]
    if (typeof value === "string") return value
    return fallback
  }

  return {
    primary: getColor("primary", "#3b82f6"),
    primaryForeground: getColor("primaryForeground", "#ffffff"),
    secondary: getColor("secondary", "#64748b"),
    secondaryForeground: getColor("secondaryForeground", "#ffffff"),
    muted: getColor("muted", "#f1f5f9"),
    mutedForeground: getColor("mutedForeground", "#64748b"),
    accent: getColor("accent", "#f59e0b"),
    accentForeground: getColor("accentForeground", "#ffffff"),
    destructive: getColor("destructive", "#ef4444"),
    destructiveForeground: getColor("destructiveForeground", "#ffffff"),
    background: getColor("background", "#ffffff"),
    foreground: getColor("foreground", "#0f172a"),
    card: getColor("card", "#ffffff"),
    cardForeground: getColor("cardForeground", "#0f172a"),
    popover: getColor("popover", "#ffffff"),
    popoverForeground: getColor("popoverForeground", "#0f172a"),
    border: getColor("border", "#e2e8f0"),
    input: getColor("input", "#e2e8f0"),
    ring: getColor("ring", "#3b82f6"),
  }
}

/**
 * Default adapter for simple/standard format
 */
export const defaultAdapter: BrandKitAdapter = {
  id: "default",
  name: "Default Adapter",
  description: "Handles standard ThemeConfig-like format with fallbacks",
  priority: 0, // Lowest priority - used as fallback

  canHandle(input: AdapterInput): boolean {
    // Can handle any object with at least a name or colors
    return (
      typeof input === "object" &&
      input !== null &&
      (typeof input.name === "string" || typeof input.colors === "object")
    )
  },

  transform(input: AdapterInput, options?: AdapterOptions): AdapterResult {
    const warnings: string[] = []

    try {
      const name =
        options?.name ||
        (typeof input.name === "string" ? input.name : "Untitled Brand")

      // Extract colors
      const inputColors =
        typeof input.colors === "object" && input.colors !== null
          ? (input.colors as Record<string, unknown>)
          : {}

      // Also check for nested light.colors structure
      const lightInput = input.light as Record<string, unknown> | undefined
      const lightColors =
        lightInput?.colors && typeof lightInput.colors === "object"
          ? (lightInput.colors as Record<string, unknown>)
          : {}

      const mergedColors = { ...inputColors, ...lightColors }
      const colors = createDefaultColors(mergedColors)

      // Extract other tokens
      const spacing =
        (lightInput?.spacing as Record<string, string>) ||
        (input.spacing as Record<string, string>) ||
        {}

      const typography =
        (lightInput?.typography as Partial<TypographyScale>) ||
        (input.typography as Partial<TypographyScale>) ||
        {}

      const radius =
        (lightInput?.radius as Record<string, string>) ||
        (input.radius as Record<string, string>) ||
        {}

      const shadow =
        (lightInput?.shadow as Record<string, string>) ||
        (input.shadow as Record<string, string>) ||
        {}

      const fontWeight =
        (lightInput?.fontWeight as Record<string, number>) ||
        (input.fontWeight as Record<string, number>) ||
        {}

      // Extract dark mode colors
      const darkInput = input.dark as Record<string, unknown> | undefined
      const dark = darkInput
        ? (Object.fromEntries(
            Object.entries(darkInput).filter(
              ([, v]) => typeof v === "string"
            )
          ) as Partial<SemanticColors>)
        : undefined

      const config: AdapterThemeConfig = {
        name,
        light: {
          colors,
          spacing,
          typography,
          radius,
          shadow,
          fontWeight,
        },
        dark,
      }

      return {
        success: true,
        config,
        warnings: options?.includeWarnings ? warnings : undefined,
      }
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error ? err.message : "Unknown transformation error",
      }
    }
  },
}

// =============================================================================
// FIGMA TOKENS ADAPTER
// =============================================================================

/**
 * Adapter for Figma Tokens plugin format
 */
export const figmaTokensAdapter: BrandKitAdapter = {
  id: "figma-tokens",
  name: "Figma Tokens",
  description: "Handles Figma Tokens plugin export format",
  priority: 80,

  canHandle(input: AdapterInput): boolean {
    // Figma Tokens format typically has $type fields
    return (
      typeof input === "object" &&
      input !== null &&
      (hasTypeFields(input) || hasTokenSetsKey(input))
    )
  },

  transform(input: AdapterInput, options?: AdapterOptions): AdapterResult {
    const warnings: string[] = []

    try {
      const name = options?.name || "Figma Brand"

      // Extract tokens from Figma format
      const colors: Record<string, string> = {}
      const spacing: Record<string, string> = {}
      const radius: Record<string, string> = {}

      // Handle token sets format
      const tokenSets = input.tokenSets || input

      for (const [key, value] of Object.entries(tokenSets)) {
        if (typeof value !== "object" || value === null) continue

        const tokenValue = value as Record<string, unknown>

        // Check for $value (Figma Tokens format)
        if (tokenValue.$value !== undefined) {
          const category = tokenValue.$type as string
          const resolvedValue = String(tokenValue.$value)

          if (category === "color") {
            colors[key] = resolvedValue
          } else if (category === "dimension" || category === "spacing") {
            spacing[key] = resolvedValue
          } else if (category === "borderRadius") {
            radius[key] = resolvedValue
          }
        }

        // Recursively check nested objects
        if (!tokenValue.$value) {
          extractFigmaTokens(
            tokenValue,
            key,
            colors,
            spacing,
            radius,
            warnings
          )
        }
      }

      const config: AdapterThemeConfig = {
        name,
        light: {
          colors: createDefaultColors(colors),
          spacing,
          typography: {},
          radius,
          shadow: {},
          fontWeight: {},
        },
      }

      return {
        success: true,
        config,
        warnings: options?.includeWarnings ? warnings : undefined,
      }
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error ? err.message : "Unknown transformation error",
      }
    }
  },
}

/**
 * Helper to check for $type fields (Figma Tokens format)
 * Recursively checks all nested objects for $type or $value fields
 */
function hasTypeFields(obj: AdapterInput): boolean {
  for (const value of Object.values(obj)) {
    if (typeof value === "object" && value !== null) {
      if ("$type" in value || "$value" in value) {
        return true
      }
      // Recursively check nested objects
      if (hasTypeFields(value as AdapterInput)) {
        return true
      }
    }
  }
  return false
}

/**
 * Helper to check for tokenSets key (Figma Tokens format)
 */
function hasTokenSetsKey(obj: AdapterInput): boolean {
  return "tokenSets" in obj
}

/**
 * Recursively extract Figma tokens
 */
function extractFigmaTokens(
  obj: Record<string, unknown>,
  prefix: string,
  colors: Record<string, string>,
  spacing: Record<string, string>,
  radius: Record<string, string>,
  warnings: string[]
): void {
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value !== "object" || value === null) continue

    const tokenValue = value as Record<string, unknown>
    const fullKey = prefix ? `${prefix}-${key}` : key

    if (tokenValue.$value !== undefined) {
      const category = tokenValue.$type as string
      const resolvedValue = String(tokenValue.$value)

      if (category === "color") {
        colors[fullKey] = resolvedValue
      } else if (category === "dimension" || category === "spacing") {
        spacing[fullKey] = resolvedValue
      } else if (category === "borderRadius") {
        radius[fullKey] = resolvedValue
      }
    } else {
      extractFigmaTokens(tokenValue, fullKey, colors, spacing, radius, warnings)
    }
  }
}

// =============================================================================
// STYLE DICTIONARY ADAPTER
// =============================================================================

/**
 * Adapter for Style Dictionary format
 */
export const styleDictionaryAdapter: BrandKitAdapter = {
  id: "style-dictionary",
  name: "Style Dictionary",
  description: "Handles Style Dictionary / Design Tokens format",
  priority: 70,

  canHandle(input: AdapterInput): boolean {
    // Style Dictionary has 'value' fields (not $value like Figma)
    return (
      typeof input === "object" &&
      input !== null &&
      hasStyleDictionaryStructure(input)
    )
  },

  transform(input: AdapterInput, options?: AdapterOptions): AdapterResult {
    const warnings: string[] = []

    try {
      const name = options?.name || "Style Dictionary Brand"

      const colors: Record<string, string> = {}
      const spacing: Record<string, string> = {}
      const radius: Record<string, string> = {}

      extractStyleDictionaryTokens(
        input,
        "",
        colors,
        spacing,
        radius,
        warnings
      )

      const config: AdapterThemeConfig = {
        name,
        light: {
          colors: createDefaultColors(colors),
          spacing,
          typography: {},
          radius,
          shadow: {},
          fontWeight: {},
        },
      }

      return {
        success: true,
        config,
        warnings: options?.includeWarnings ? warnings : undefined,
      }
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error ? err.message : "Unknown transformation error",
      }
    }
  },
}

/**
 * Check for Style Dictionary structure
 */
function hasStyleDictionaryStructure(obj: AdapterInput): boolean {
  for (const value of Object.values(obj)) {
    if (typeof value === "object" && value !== null) {
      // Style Dictionary uses 'value' without $ prefix
      if (
        "value" in value &&
        !("$value" in value) &&
        typeof (value as Record<string, unknown>).value !== "object"
      ) {
        return true
      }

      // Check nested objects
      if (hasStyleDictionaryStructure(value as AdapterInput)) {
        return true
      }
    }
  }
  return false
}

/**
 * Extract Style Dictionary tokens recursively
 */
function extractStyleDictionaryTokens(
  obj: AdapterInput,
  prefix: string,
  colors: Record<string, string>,
  spacing: Record<string, string>,
  radius: Record<string, string>,
  warnings: string[]
): void {
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value !== "object" || value === null) continue

    const tokenValue = value as Record<string, unknown>
    const fullKey = prefix ? `${prefix}-${key}` : key

    // Check for leaf token with value
    if (
      "value" in tokenValue &&
      typeof tokenValue.value !== "object"
    ) {
      const resolvedValue = String(tokenValue.value)
      const category =
        (tokenValue.type as string) ||
        (tokenValue.attributes as Record<string, string>)?.category

      if (
        category === "color" ||
        fullKey.includes("color") ||
        resolvedValue.startsWith("#") ||
        resolvedValue.startsWith("rgb")
      ) {
        colors[fullKey] = resolvedValue
      } else if (
        category === "size" ||
        category === "spacing" ||
        fullKey.includes("spacing")
      ) {
        spacing[fullKey] = resolvedValue
      } else if (
        category === "borderRadius" ||
        fullKey.includes("radius")
      ) {
        radius[fullKey] = resolvedValue
      }
    } else {
      // Recurse into nested objects
      extractStyleDictionaryTokens(
        tokenValue,
        fullKey,
        colors,
        spacing,
        radius,
        warnings
      )
    }
  }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize default adapters
 */
export function initializeDefaultAdapters(): void {
  // Clear existing
  clearAdapters()

  // Register built-in adapters
  registerAdapter(defaultAdapter)
  registerAdapter(figmaTokensAdapter)
  registerAdapter(styleDictionaryAdapter)

  // Set default fallback
  setDefaultAdapter("default")
}

// Initialize on module load
initializeDefaultAdapters()

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default {
  // Registration
  registerAdapter,
  unregisterAdapter,
  getAdapter,
  getAdapters,
  setDefaultAdapter,
  getDefaultAdapter,
  clearAdapters,
  // Transformation
  findAdapter,
  transformWithAdapter,
  transformWithSpecificAdapter,
  // Initialization
  initializeDefaultAdapters,
  // Built-in adapters
  defaultAdapter,
  figmaTokensAdapter,
  styleDictionaryAdapter,
}
