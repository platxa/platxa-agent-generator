/**
 * Brand System Types
 *
 * Type definitions for the opt-in brand kit system.
 * The system uses built-in themes by DEFAULT and only loads
 * brand kits when explicitly specified in configuration.
 *
 * @module react-agent/brand/types
 */

import type { DesignTokens, SemanticColors, ThemeConfig } from "../theme/types"

// =============================================================================
// THEME PRESET TYPES
// =============================================================================

/**
 * Built-in theme preset names
 * These are always available without any external dependencies
 */
export type BuiltInPreset = "default" | "blue" | "green" | "violet"

/**
 * Extended preset names including Tailwind colors
 */
export type ThemePresetName =
  | BuiltInPreset
  | "slate"
  | "zinc"
  | "neutral"
  | "stone"
  | "red"
  | "orange"
  | "amber"
  | "yellow"
  | "lime"
  | "emerald"
  | "teal"
  | "cyan"
  | "sky"
  | "indigo"
  | "purple"
  | "fuchsia"
  | "pink"
  | "rose"

// =============================================================================
// BRAND KIT INTERFACE
// =============================================================================

/**
 * Brand kit metadata
 */
export interface BrandKitMeta {
  /** Brand kit name */
  name: string
  /** Version (semver) */
  version: string
  /** Optional description */
  description?: string
  /** Optional author */
  author?: string
}

/**
 * Brand kit color primitives (12-step scale)
 */
export interface BrandColorPrimitives {
  /** Primary color scale (12 steps) */
  primary: Record<number, string>
  /** Accent color scale (12 steps) */
  accent: Record<number, string>
  /** Neutral color scale (12 steps) */
  neutral: Record<number, string>
}

/**
 * Brand kit semantic colors for light/dark modes
 */
export interface BrandSemanticColors {
  /** Light mode semantic colors */
  light: SemanticColors
  /** Dark mode semantic colors */
  dark: SemanticColors
}

/**
 * Brand kit typography configuration
 */
export interface BrandTypography {
  /** Font families */
  fontFamily?: {
    sans?: string
    serif?: string
    mono?: string
    display?: string
  }
  /** Font sizes (xs to 9xl) */
  fontSize?: Record<string, { fontSize: string; lineHeight: string }>
  /** Font weights */
  fontWeight?: Record<string, number>
}

/**
 * Brand kit spacing scale
 */
export type BrandSpacing = Record<string | number, string>

/**
 * Brand kit border radius scale
 */
export type BrandRadius = Record<string, string>

/**
 * Brand kit shadow scale
 */
export type BrandShadow = Record<string, string>

/**
 * Complete brand kit export interface
 * All brand kits must implement this interface
 */
export interface BrandKitExport {
  /** Brand metadata (required) */
  meta: BrandKitMeta
  /** Color primitives (required) */
  primitives: BrandColorPrimitives
  /** Semantic colors (required) */
  semantics: BrandSemanticColors
  /** Typography (optional) */
  typography?: BrandTypography
  /** Spacing scale (optional) */
  spacing?: BrandSpacing
  /** Border radius (optional) */
  radius?: BrandRadius
  /** Shadows (optional) */
  shadow?: BrandShadow
  /** Optional Tailwind v4 preset */
  tailwindPreset?: Record<string, unknown>
  /** Optional pre-built CSS paths */
  css?: {
    tokens?: string
    themes?: string
  }
}

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

/**
 * Theme configuration options
 */
export interface ThemeOptions {
  /**
   * Built-in preset name
   * @default "default"
   */
  preset?: ThemePresetName
  /**
   * Custom theme options (creates theme from hue/saturation)
   */
  custom?: {
    /** Primary hue (0-360) */
    primaryHue: number
    /** Saturation level */
    saturation?: "low" | "medium" | "high"
    /** Use OKLCH color space */
    useOklch?: boolean
  }
}

/**
 * Brand configuration options
 * Only used when opting into external brand kits
 */
export interface BrandOptions {
  /**
   * NPM package name or local path to brand kit
   * @example "@platxa/brand-kit" or "./my-brand"
   */
  package?: string
  /**
   * Token overrides to apply on top of brand kit
   */
  overrides?: Partial<DesignTokens>
}

/**
 * Frontend configuration
 */
export interface FrontendConfig {
  /**
   * Theme configuration (built-in presets)
   * Used when NOT opting into a brand kit
   */
  theme?: ThemeOptions
  /**
   * Brand kit configuration (opt-in)
   * When specified, brand kit tokens override theme preset
   */
  brand?: BrandOptions
}

/**
 * Resolved configuration with all defaults applied
 */
export interface ResolvedConfig {
  /** Whether using a brand kit or built-in theme */
  mode: "builtin" | "brand"
  /** Theme preset name (when mode is "builtin") */
  preset: ThemePresetName
  /** Custom theme options (when using custom) */
  custom?: ThemeOptions["custom"]
  /** Brand package (when mode is "brand") */
  brandPackage?: string
  /** Brand overrides */
  brandOverrides?: Partial<DesignTokens>
  /** Resolved theme configuration */
  themeConfig: ThemeConfig
}

// =============================================================================
// CONFIGURATION STATE
// =============================================================================

/**
 * Configuration loading state
 */
export type ConfigLoadingState = "idle" | "loading" | "loaded" | "error"

/**
 * Configuration state with loading information
 */
export interface ConfigState {
  /** Current loading state */
  status: ConfigLoadingState
  /** Resolved configuration (when loaded) */
  config: ResolvedConfig | null
  /** Error message (when status is "error") */
  error?: string
}

// =============================================================================
// HELPER TYPE
// =============================================================================

/**
 * Type-safe configuration helper return type
 */
export type DefineFrontendConfigReturn = FrontendConfig
