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
// This section defines the standard interface that ALL brand kits must implement.
// Brand kit authors should use `BrandKitExport` as the primary interface.
//
// REQUIRED FIELDS (must be present):
//   - meta: { name, version }
//   - primitives: { primary, accent, neutral }
//   - semantics: { light, dark }
//
// OPTIONAL FIELDS (have sensible defaults):
//   - meta.description, meta.author
//   - typography, spacing, radius, shadow
//   - tailwindPreset, css
// =============================================================================

/**
 * Brand kit metadata (REQUIRED)
 *
 * Every brand kit must provide metadata identifying itself.
 *
 * @example
 * ```typescript
 * const meta: BrandKitMeta = {
 *   name: "my-brand",
 *   version: "1.0.0",
 *   description: "My company brand kit",
 *   author: "Design Team"
 * }
 * ```
 */
export interface BrandKitMeta {
  /**
   * Brand kit name (REQUIRED)
   * Used for identification and caching
   */
  name: string

  /**
   * Version following semver (REQUIRED)
   * @example "1.0.0", "2.1.3-beta"
   */
  version: string

  /**
   * Human-readable description (optional)
   */
  description?: string

  /**
   * Author or team name (optional)
   */
  author?: string
}

/**
 * Brand kit color primitives (REQUIRED)
 *
 * 12-step color scales following Radix UI conventions.
 * Steps 1-12 go from lightest to darkest.
 *
 * @example
 * ```typescript
 * const primitives: BrandColorPrimitives = {
 *   primary: {
 *     1: "hsl(206 100% 99%)",
 *     2: "hsl(206 100% 98%)",
 *     // ... steps 3-11
 *     12: "hsl(206 100% 10%)"
 *   },
 *   accent: { ... },
 *   neutral: { ... }
 * }
 * ```
 */
export interface BrandColorPrimitives {
  /**
   * Primary brand color scale (REQUIRED)
   * 12 steps from lightest (1) to darkest (12)
   */
  primary: Record<number, string>

  /**
   * Accent/secondary color scale (REQUIRED)
   * 12 steps for CTAs, highlights, and interactive elements
   */
  accent: Record<number, string>

  /**
   * Neutral gray scale (REQUIRED)
   * 12 steps for text, backgrounds, and borders
   */
  neutral: Record<number, string>
}

/**
 * Brand kit semantic colors (REQUIRED)
 *
 * Maps primitive colors to semantic meanings for both light and dark modes.
 * These are the colors actually used by components.
 *
 * @example
 * ```typescript
 * const semantics: BrandSemanticColors = {
 *   light: {
 *     background: "hsl(0 0% 100%)",
 *     foreground: "hsl(206 100% 10%)",
 *     primary: "hsl(206 100% 50%)",
 *     // ... other semantic colors
 *   },
 *   dark: {
 *     background: "hsl(206 100% 5%)",
 *     foreground: "hsl(0 0% 98%)",
 *     // ... other semantic colors
 *   }
 * }
 * ```
 */
export interface BrandSemanticColors {
  /**
   * Light mode semantic colors (REQUIRED)
   * Used when system/user prefers light mode
   */
  light: SemanticColors

  /**
   * Dark mode semantic colors (REQUIRED)
   * Used when system/user prefers dark mode
   */
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
 * Complete Brand Kit Export Interface
 *
 * This is the PRIMARY interface that ALL brand kits must implement.
 * Brand kit authors should use this as the return type of their default export.
 *
 * ## Required Fields
 * - `meta` - Package metadata (name, version)
 * - `primitives` - 12-step color scales (primary, accent, neutral)
 * - `semantics` - Light/dark mode semantic colors
 *
 * ## Optional Fields (use platform defaults if omitted)
 * - `typography` - Font families, sizes, weights
 * - `spacing` - Spacing scale
 * - `radius` - Border radius scale
 * - `shadow` - Shadow scale
 * - `tailwindPreset` - Pre-built Tailwind v4 preset
 * - `css` - Paths to pre-built CSS files
 *
 * @example
 * ```typescript
 * // my-brand/index.ts
 * import type { BrandKitExport } from "@platxa/frontend-agent"
 *
 * const brandKit: BrandKitExport = {
 *   meta: {
 *     name: "my-brand",
 *     version: "1.0.0"
 *   },
 *   primitives: {
 *     primary: { 1: "...", 2: "...", ... },
 *     accent: { ... },
 *     neutral: { ... }
 *   },
 *   semantics: {
 *     light: { background: "...", foreground: "...", ... },
 *     dark: { background: "...", foreground: "...", ... }
 *   },
 *   // Optional: override defaults
 *   typography: { ... },
 *   spacing: { ... }
 * }
 *
 * export default brandKit
 * ```
 */
export interface BrandKitExport {
  /**
   * Brand metadata (REQUIRED)
   * Must include name and version
   */
  meta: BrandKitMeta

  /**
   * Color primitives (REQUIRED)
   * 12-step scales for primary, accent, and neutral colors
   */
  primitives: BrandColorPrimitives

  /**
   * Semantic colors (REQUIRED)
   * Light and dark mode color mappings
   */
  semantics: BrandSemanticColors

  /**
   * Typography configuration (optional)
   * Falls back to platform defaults if not provided
   */
  typography?: BrandTypography

  /**
   * Spacing scale (optional)
   * Falls back to platform defaults if not provided
   */
  spacing?: BrandSpacing

  /**
   * Border radius scale (optional)
   * Falls back to platform defaults if not provided
   */
  radius?: BrandRadius

  /**
   * Shadow scale (optional)
   * Falls back to platform defaults if not provided
   */
  shadow?: BrandShadow

  /**
   * Pre-built Tailwind v4 preset (optional)
   * For advanced integration with Tailwind CSS
   */
  tailwindPreset?: Record<string, unknown>

  /**
   * Paths to pre-built CSS files (optional)
   * Useful for CDN or static file serving
   */
  css?: {
    /** Path to CSS custom properties file */
    tokens?: string
    /** Path to theme CSS file */
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
 * Environment name for configuration selection
 *
 * Standard environments:
 * - "development" - Local development (default when NODE_ENV is "development")
 * - "staging" - Pre-production testing
 * - "production" - Production deployment (default when NODE_ENV is "production")
 *
 * Custom environments are also supported for advanced use cases.
 */
export type EnvironmentName = "development" | "staging" | "production" | string

/**
 * Environment-specific configuration overrides (Feature #60)
 *
 * Allows different configurations per environment. Overrides are
 * deep-merged with the base configuration.
 *
 * @example
 * ```typescript
 * const config = defineFrontendConfig({
 *   brand: { package: "@acme/brand-kit" },
 *   environments: {
 *     development: {
 *       brand: { package: "@acme/brand-kit-dev" }
 *     },
 *     staging: {
 *       brand: {
 *         overrides: { colors: { accent: "hsl(45 100% 50%)" } }
 *       }
 *     }
 *   }
 * })
 * ```
 */
export interface EnvironmentOverrides {
  [env: string]: Partial<Omit<FrontendConfig, "environments">>
}

/**
 * Frontend configuration
 *
 * ## Configuration Precedence (Feature #60)
 *
 * When resolving configuration, values are merged in this order:
 * 1. Base configuration (theme, brand)
 * 2. Environment-specific overrides (if current env matches)
 * 3. Explicit overrides passed to resolveConfig
 *
 * Environment detection:
 * - Uses `process.env.NODE_ENV` when available
 * - Falls back to "production" if not set
 * - Can be overridden via `resolveConfig(config, { env: "staging" })`
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
  /**
   * Environment-specific configuration overrides (Feature #60)
   *
   * Keys are environment names, values are partial configs to merge.
   * Current environment is determined by NODE_ENV or explicit option.
   *
   * @example
   * ```typescript
   * {
   *   environments: {
   *     development: { brand: { package: "./local-brand" } },
   *     production: { brand: { package: "@acme/brand-kit" } }
   *   }
   * }
   * ```
   */
  environments?: EnvironmentOverrides
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
// HELPER TYPES
// =============================================================================

/**
 * Type-safe configuration helper return type
 */
export type DefineFrontendConfigReturn = FrontendConfig

/**
 * Type-safe brand kit definition helper
 *
 * Use this to define brand kits with full TypeScript IntelliSense support.
 *
 * @example
 * ```typescript
 * import { defineBrandKit } from "@platxa/frontend-agent"
 *
 * export default defineBrandKit({
 *   meta: { name: "my-brand", version: "1.0.0" },
 *   primitives: { ... },
 *   semantics: { ... }
 * })
 * ```
 */
export type DefineBrandKitReturn = BrandKitExport

// =============================================================================
// VALIDATION TYPES
// =============================================================================

/**
 * Brand kit validation result
 */
export interface BrandKitValidationResult {
  /** Whether the brand kit is valid */
  valid: boolean
  /** Validation errors (critical issues) */
  errors: string[]
  /** Validation warnings (non-critical issues) */
  warnings: string[]
  /** Missing required fields */
  missingRequired: string[]
  /** Missing optional fields (informational) */
  missingOptional: string[]
}
