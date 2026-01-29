/**
 * Typography Scale Types
 *
 * Types for systematic typography with clear 3-level hierarchy.
 * Supports modular scales, responsive sizing, and fluid typography.
 */

/**
 * Typography hierarchy level
 */
export type HierarchyLevel = "primary" | "secondary" | "tertiary"

/**
 * Semantic typography role
 */
export type TypographyRole =
  | "display"
  | "heading"
  | "subheading"
  | "body"
  | "caption"
  | "label"
  | "code"
  | "quote"

/**
 * Font weight names
 */
export type FontWeight =
  | "thin"
  | "extralight"
  | "light"
  | "normal"
  | "medium"
  | "semibold"
  | "bold"
  | "extrabold"
  | "black"

/**
 * Font weight numeric values
 */
export type FontWeightValue = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900

/**
 * Modular scale ratio presets
 */
export type ScaleRatio =
  | "minor-second" // 1.067
  | "major-second" // 1.125
  | "minor-third" // 1.2
  | "major-third" // 1.25
  | "perfect-fourth" // 1.333
  | "augmented-fourth" // 1.414
  | "perfect-fifth" // 1.5
  | "golden-ratio" // 1.618
  | "custom"

/**
 * Typography unit
 */
export type TypographyUnit = "px" | "rem" | "em" | "clamp"

/**
 * Single typography size definition
 */
export interface TypeSize {
  /** Font size value */
  fontSize: string
  /** Line height (unitless or with unit) */
  lineHeight: string | number
  /** Letter spacing */
  letterSpacing?: string
  /** Font weight */
  fontWeight?: FontWeight | FontWeightValue
}

/**
 * Complete typography style
 */
export interface TypeStyle extends TypeSize {
  /** Font family */
  fontFamily?: string
  /** Text transform */
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize"
  /** Font style */
  fontStyle?: "normal" | "italic"
  /** Text decoration */
  textDecoration?: "none" | "underline" | "line-through"
}

/**
 * Typography scale step
 */
export interface ScaleStep {
  /** Step name (e.g., "xs", "sm", "base", "lg") */
  name: string
  /** Step index (0 = base, positive = larger, negative = smaller) */
  index: number
  /** Computed size in pixels */
  sizePx: number
  /** Size with unit */
  size: string
  /** Recommended line height */
  lineHeight: number
  /** Recommended letter spacing */
  letterSpacing: string
}

/**
 * Complete typography scale
 */
export interface TypographyScale {
  /** Scale name */
  name: string
  /** Base size in pixels */
  baseSizePx: number
  /** Scale ratio */
  ratio: number
  /** Scale ratio name */
  ratioName: ScaleRatio
  /** Output unit */
  unit: TypographyUnit
  /** All scale steps */
  steps: ScaleStep[]
  /** Named size aliases */
  sizes: Record<string, ScaleStep>
}

/**
 * 3-level hierarchy configuration
 */
export interface HierarchyConfig {
  /** Primary level (largest - headings, titles) */
  primary: {
    /** Scale steps to use (e.g., ["4xl", "3xl", "2xl"]) */
    sizes: string[]
    /** Font weight */
    weight: FontWeight | FontWeightValue
    /** Line height multiplier */
    lineHeight: number
    /** Letter spacing */
    letterSpacing: string
  }
  /** Secondary level (medium - subheadings, emphasis) */
  secondary: {
    sizes: string[]
    weight: FontWeight | FontWeightValue
    lineHeight: number
    letterSpacing: string
  }
  /** Tertiary level (smallest - body, captions) */
  tertiary: {
    sizes: string[]
    weight: FontWeight | FontWeightValue
    lineHeight: number
    letterSpacing: string
  }
}

/**
 * Semantic typography mapping
 */
export interface SemanticTypography {
  /** Display text (hero, large headings) */
  display: TypeStyle
  /** Page headings (h1-h3) */
  h1: TypeStyle
  h2: TypeStyle
  h3: TypeStyle
  /** Subheadings (h4-h6) */
  h4: TypeStyle
  h5: TypeStyle
  h6: TypeStyle
  /** Body text */
  body: TypeStyle
  bodyLarge: TypeStyle
  bodySmall: TypeStyle
  /** Captions and labels */
  caption: TypeStyle
  label: TypeStyle
  /** Special text */
  code: TypeStyle
  quote: TypeStyle
}

/**
 * Fluid typography configuration
 */
export interface FluidConfig {
  /** Minimum viewport width (px) */
  minViewport: number
  /** Maximum viewport width (px) */
  maxViewport: number
  /** Minimum font size (px) */
  minSize: number
  /** Maximum font size (px) */
  maxSize: number
}

/**
 * Responsive breakpoint sizes
 */
export interface ResponsiveTypography {
  /** Base/mobile size */
  base: TypeStyle
  /** Small screens (sm) */
  sm?: Partial<TypeStyle>
  /** Medium screens (md) */
  md?: Partial<TypeStyle>
  /** Large screens (lg) */
  lg?: Partial<TypeStyle>
  /** Extra large screens (xl) */
  xl?: Partial<TypeStyle>
  /** 2XL screens */
  "2xl"?: Partial<TypeStyle>
}

/**
 * Typography scale generation options
 */
export interface ScaleOptions {
  /** Base font size in pixels */
  baseSizePx?: number
  /** Scale ratio or preset name */
  ratio?: ScaleRatio | number
  /** Number of steps above base */
  stepsUp?: number
  /** Number of steps below base */
  stepsDown?: number
  /** Output unit */
  unit?: TypographyUnit
  /** Custom step names */
  stepNames?: string[]
  /** Root font size for rem calculation */
  rootFontSize?: number
}

/**
 * Hierarchy generation options
 */
export interface HierarchyOptions {
  /** Typography scale to use */
  scale: TypographyScale
  /** Primary font family */
  primaryFont?: string
  /** Secondary font family */
  secondaryFont?: string
  /** Monospace font family */
  monoFont?: string
  /** Custom hierarchy config */
  config?: Partial<HierarchyConfig>
}

/**
 * CSS output for typography
 */
export interface TypographyCss {
  /** CSS custom properties */
  variables: string
  /** CSS classes */
  classes: string
  /** Tailwind config extension */
  tailwindConfig: Record<string, unknown>
}

/**
 * Font stack presets
 */
export interface FontStacks {
  /** System sans-serif */
  systemSans: string
  /** System serif */
  systemSerif: string
  /** System monospace */
  systemMono: string
  /** Custom font stacks */
  custom: Record<string, string>
}

/**
 * Typography validation result
 */
export interface TypographyValidation {
  /** Is valid */
  valid: boolean
  /** Validation errors */
  errors: string[]
  /** Warnings */
  warnings: string[]
  /** Accessibility notes */
  a11y: {
    /** Minimum size check (16px for body) */
    minSizeOk: boolean
    /** Line height check (1.5+ for body) */
    lineHeightOk: boolean
    /** Contrast hierarchy clear */
    hierarchyClear: boolean
  }
}

/**
 * Typography preset
 */
export interface TypographyPreset {
  /** Preset name */
  name: string
  /** Description */
  description: string
  /** Scale configuration */
  scale: ScaleOptions
  /** Hierarchy configuration */
  hierarchy: Partial<HierarchyConfig>
  /** Font stacks */
  fonts: Partial<FontStacks>
}

// =============================================================================
// Line Height Types (Feature #20)
// =============================================================================

/**
 * Line height calculation mode
 */
export type LineHeightMode = "auto" | "ratio" | "fixed"

/**
 * Line height configuration
 */
export interface LineHeightConfig {
  /** Calculation mode */
  mode: LineHeightMode
  /** Min ratio for ratio mode (default 1.125) */
  minRatio?: number
  /** Max ratio for ratio mode (default 1.2 for body, 1.1 for headings) */
  maxRatio?: number
  /** Fixed value for fixed mode */
  fixedValue?: number
  /** Font size threshold in px where ratio transitions from max to min */
  thresholdPx?: number
}

/**
 * Line height calculation result
 */
export interface LineHeightResult {
  /** Calculated line height value (unitless ratio) */
  value: number
  /** Line height in pixels (for reference) */
  px: number
  /** Whether value is within accessibility guidelines (≥1.5 for body text) */
  isAccessible: boolean
  /** Recommendation if not accessible */
  recommendation?: string
}

// =============================================================================
// Line Length Types (Feature #21)
// =============================================================================

/**
 * Line length validation result
 */
export interface LineLengthResult {
  /** Calculated character count per line */
  characters: number
  /** Whether within optimal range (45-75, ideal 66) */
  isOptimal: boolean
  /** Whether within acceptable range (40-80) */
  isAcceptable: boolean
  /** Deviation from ideal (66 characters) */
  deviationFromIdeal: number
  /** Specific recommendation */
  recommendation?: string
  /** Suggested container width in px for optimal line length */
  suggestedWidthPx?: number
}

/**
 * Line length configuration
 */
export interface LineLengthConfig {
  /** Minimum acceptable characters per line (default 40) */
  minChars?: number
  /** Maximum acceptable characters per line (default 80) */
  maxChars?: number
  /** Optimal minimum (default 45) */
  optimalMin?: number
  /** Optimal maximum (default 75) */
  optimalMax?: number
  /** Ideal character count (default 66) */
  idealChars?: number
  /** Average character width as fraction of font size (default 0.5 for proportional fonts) */
  avgCharWidthRatio?: number
}
