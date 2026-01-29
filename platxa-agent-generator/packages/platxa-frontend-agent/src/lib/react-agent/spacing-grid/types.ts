/**
 * Spacing Grid Types
 *
 * Types for 8px/4px spacing grid system.
 * Creates consistent, harmonious spacing throughout UI.
 */

/**
 * Spacing base unit
 */
export type SpacingUnit = 4 | 8

/**
 * Spacing scale multiplier
 */
export type SpacingMultiplier = 0 | 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 14 | 16 | 20 | 24 | 28 | 32 | 36 | 40 | 44 | 48 | 52 | 56 | 60 | 64 | 72 | 80 | 96

/**
 * Semantic spacing size
 */
export type SemanticSpacing =
  | "none"
  | "px"
  | "0.5"
  | "1"
  | "1.5"
  | "2"
  | "2.5"
  | "3"
  | "3.5"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "11"
  | "12"
  | "14"
  | "16"
  | "20"
  | "24"
  | "28"
  | "32"
  | "36"
  | "40"
  | "44"
  | "48"
  | "52"
  | "56"
  | "60"
  | "64"
  | "72"
  | "80"
  | "96"

/**
 * Spacing output unit
 */
export type SpacingOutputUnit = "px" | "rem" | "em"

/**
 * Single spacing value
 */
export interface SpacingValue {
  /** Numeric value in base units */
  value: number
  /** Value in pixels */
  px: number
  /** Value in rem */
  rem: string
  /** CSS value string */
  css: string
}

/**
 * Spacing scale (Tailwind-compatible)
 */
export interface SpacingScale {
  0: SpacingValue
  px: SpacingValue
  0.5: SpacingValue
  1: SpacingValue
  1.5: SpacingValue
  2: SpacingValue
  2.5: SpacingValue
  3: SpacingValue
  3.5: SpacingValue
  4: SpacingValue
  5: SpacingValue
  6: SpacingValue
  7: SpacingValue
  8: SpacingValue
  9: SpacingValue
  10: SpacingValue
  11: SpacingValue
  12: SpacingValue
  14: SpacingValue
  16: SpacingValue
  20: SpacingValue
  24: SpacingValue
  28: SpacingValue
  32: SpacingValue
  36: SpacingValue
  40: SpacingValue
  44: SpacingValue
  48: SpacingValue
  52: SpacingValue
  56: SpacingValue
  60: SpacingValue
  64: SpacingValue
  72: SpacingValue
  80: SpacingValue
  96: SpacingValue
}

/**
 * Semantic spacing tokens
 */
export interface SemanticSpacingTokens {
  /** No spacing */
  none: SpacingValue
  /** Extra extra small (4px) */
  "2xs": SpacingValue
  /** Extra small (8px) */
  xs: SpacingValue
  /** Small (12px) */
  sm: SpacingValue
  /** Medium (16px) */
  md: SpacingValue
  /** Large (24px) */
  lg: SpacingValue
  /** Extra large (32px) */
  xl: SpacingValue
  /** 2x large (48px) */
  "2xl": SpacingValue
  /** 3x large (64px) */
  "3xl": SpacingValue
  /** 4x large (96px) */
  "4xl": SpacingValue
}

/**
 * Component-specific spacing
 */
export interface ComponentSpacing {
  /** Inline padding (horizontal) */
  paddingInline: SpacingValue
  /** Block padding (vertical) */
  paddingBlock: SpacingValue
  /** Gap between items */
  gap: SpacingValue
  /** Margin around component */
  margin: SpacingValue
}

/**
 * Layout spacing configuration
 */
export interface LayoutSpacing {
  /** Page margins */
  pageMargin: SpacingValue
  /** Section spacing */
  sectionGap: SpacingValue
  /** Content max width */
  contentMaxWidth: string
  /** Sidebar width */
  sidebarWidth: string
  /** Header height */
  headerHeight: SpacingValue
  /** Footer height */
  footerHeight: SpacingValue
}

/**
 * Spacing grid configuration
 */
export interface SpacingGridConfig {
  /** Base unit (4 or 8) */
  baseUnit: SpacingUnit
  /** Root font size for rem calculation */
  rootFontSize: number
  /** Output unit preference */
  outputUnit: SpacingOutputUnit
  /** Include half steps (e.g., 0.5, 1.5) */
  includeHalfSteps: boolean
}

/**
 * Spacing validation result
 */
export interface SpacingValidation {
  /** Value being validated */
  value: number
  /** Is on grid */
  isOnGrid: boolean
  /** Nearest grid value */
  nearestGridValue: number
  /** Deviation from grid */
  deviation: number
  /** Suggestion message */
  suggestion?: string
}

/**
 * Spacing CSS output
 */
export interface SpacingCss {
  /** CSS custom properties */
  variables: string
  /** Utility classes */
  classes: string
  /** Tailwind config */
  tailwindConfig: Record<string, unknown>
}

/**
 * Spacing preset
 */
export interface SpacingPreset {
  /** Preset name */
  name: string
  /** Description */
  description: string
  /** Grid configuration */
  config: SpacingGridConfig
  /** Semantic token mappings */
  semanticMapping: Record<keyof SemanticSpacingTokens, number>
}

/**
 * Box spacing (padding/margin shorthand)
 */
export interface BoxSpacing {
  top: SpacingValue
  right: SpacingValue
  bottom: SpacingValue
  left: SpacingValue
}

/**
 * Inset spacing
 */
export interface InsetSpacing {
  inset: SpacingValue | BoxSpacing
  insetInline: SpacingValue | { start: SpacingValue; end: SpacingValue }
  insetBlock: SpacingValue | { start: SpacingValue; end: SpacingValue }
}
