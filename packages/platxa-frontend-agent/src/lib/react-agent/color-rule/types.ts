/**
 * Color Rule Types - 60-30-10 Rule Enforcement
 *
 * Types for analyzing and enforcing the 60-30-10 color balance rule
 * which creates visually harmonious and balanced designs.
 *
 * 60% - Dominant color (backgrounds, large areas)
 * 30% - Secondary color (supporting elements)
 * 10% - Accent color (calls-to-action, highlights)
 */

/**
 * Color role in the 60-30-10 system
 */
export type ColorRole = "dominant" | "secondary" | "accent"

/**
 * Color usage category for UI elements
 */
export type ColorUsageCategory =
  | "background"
  | "surface"
  | "text"
  | "border"
  | "interactive"
  | "feedback"
  | "decorative"

/**
 * Individual color entry with usage metadata
 */
export interface ColorEntry {
  /** Color value (hex, rgb, hsl, oklch) */
  value: string
  /** Assigned role in 60-30-10 system */
  role: ColorRole
  /** Usage category */
  category: ColorUsageCategory
  /** Estimated visual weight (0-100) */
  weight: number
  /** CSS property or context where used */
  context?: string
}

/**
 * Color distribution across UI
 */
export interface ColorDistribution {
  /** Dominant color percentage (target: 60%) */
  dominant: number
  /** Secondary color percentage (target: 30%) */
  secondary: number
  /** Accent color percentage (target: 10%) */
  accent: number
}

/**
 * Tolerance settings for rule enforcement
 */
export interface RuleTolerance {
  /** Allowed deviation for dominant (default: 10) */
  dominant: number
  /** Allowed deviation for secondary (default: 10) */
  secondary: number
  /** Allowed deviation for accent (default: 5) */
  accent: number
}

/**
 * Color balance analysis result
 */
export interface ColorBalanceResult {
  /** Current distribution */
  distribution: ColorDistribution
  /** Is within tolerance */
  isBalanced: boolean
  /** Individual role compliance */
  compliance: {
    dominant: boolean
    secondary: boolean
    accent: boolean
  }
  /** Deviation from ideal */
  deviation: {
    dominant: number
    secondary: number
    accent: number
  }
  /** Suggestions for improvement */
  suggestions: ColorSuggestion[]
  /** Overall balance score (0-100) */
  score: number
}

/**
 * Suggestion for improving color balance
 */
export interface ColorSuggestion {
  /** Type of suggestion */
  type: "increase" | "decrease" | "reassign" | "add" | "remove"
  /** Affected role */
  role: ColorRole
  /** Current value */
  current: number
  /** Target value */
  target: number
  /** Human-readable message */
  message: string
  /** Priority (1-5, 1 being highest) */
  priority: number
}

/**
 * Color palette configuration
 */
export interface ColorPalette {
  /** Dominant colors (should cover ~60% of UI) */
  dominant: string[]
  /** Secondary colors (should cover ~30% of UI) */
  secondary: string[]
  /** Accent colors (should cover ~10% of UI) */
  accent: string[]
}

/**
 * Element color mapping
 */
export interface ElementColorMap {
  /** Background color role */
  background: ColorRole
  /** Surface/card color role */
  surface: ColorRole
  /** Primary text color role */
  primaryText: ColorRole
  /** Secondary text color role */
  secondaryText: ColorRole
  /** Border color role */
  border: ColorRole
  /** Primary button color role */
  primaryButton: ColorRole
  /** Secondary button color role */
  secondaryButton: ColorRole
  /** Link color role */
  link: ColorRole
  /** Focus ring color role */
  focusRing: ColorRole
  /** Icon color role */
  icon: ColorRole
}

/**
 * Weight multipliers for different element types
 */
export interface WeightMultipliers {
  /** Background weight (default: 50) */
  background: number
  /** Surface/card weight (default: 20) */
  surface: number
  /** Text weight (default: 15) */
  text: number
  /** Border weight (default: 5) */
  border: number
  /** Interactive elements weight (default: 7) */
  interactive: number
  /** Icons/decorative weight (default: 3) */
  decorative: number
}

/**
 * Analyzed component color data
 */
export interface ComponentColorAnalysis {
  /** Component name or identifier */
  component: string
  /** Colors found in component */
  colors: ColorEntry[]
  /** Calculated distribution */
  distribution: ColorDistribution
  /** Recommendations */
  recommendations: ColorSuggestion[]
}

/**
 * Full page/layout color analysis
 */
export interface LayoutColorAnalysis {
  /** Individual component analyses */
  components: ComponentColorAnalysis[]
  /** Aggregate distribution */
  totalDistribution: ColorDistribution
  /** Overall balance result */
  balance: ColorBalanceResult
  /** Color palette used */
  palette: ColorPalette
}

/**
 * Color rule configuration options
 */
export interface ColorRuleConfig {
  /** Target distribution (defaults to 60-30-10) */
  targetDistribution?: Partial<ColorDistribution>
  /** Tolerance settings */
  tolerance?: Partial<RuleTolerance>
  /** Weight multipliers */
  weights?: Partial<WeightMultipliers>
  /** Element to role mapping */
  elementMapping?: Partial<ElementColorMap>
  /** Strict mode (no tolerance) */
  strict?: boolean
}

/**
 * Color harmony type
 */
export type ColorHarmony =
  | "complementary"
  | "analogous"
  | "triadic"
  | "split-complementary"
  | "tetradic"
  | "monochromatic"

/**
 * Color harmony analysis
 */
export interface ColorHarmonyResult {
  /** Detected harmony type */
  harmony: ColorHarmony | "none"
  /** Harmony score (0-100) */
  score: number
  /** Colors in harmony relationship */
  harmonicColors: string[]
  /** Colors breaking harmony */
  discordantColors: string[]
  /** Suggestions for better harmony */
  suggestions: string[]
}

/**
 * CSS style object for color extraction
 */
export interface StyleColorExtract {
  /** Background colors */
  backgrounds: string[]
  /** Text/foreground colors */
  foregrounds: string[]
  /** Border colors */
  borders: string[]
  /** Shadow colors */
  shadows: string[]
  /** Accent/highlight colors */
  accents: string[]
}

/**
 * Color conversion result
 */
export interface ColorConversion {
  hex: string
  rgb: { r: number; g: number; b: number }
  hsl: { h: number; s: number; l: number }
  oklch: { l: number; c: number; h: number }
}

/**
 * Color contrast result
 */
export interface ContrastResult {
  /** Contrast ratio (1-21) */
  ratio: number
  /** WCAG AA compliance for normal text (4.5:1) */
  wcagAA: boolean
  /** WCAG AA compliance for large text (3:1) */
  wcagAALarge: boolean
  /** WCAG AAA compliance for normal text (7:1) */
  wcagAAA: boolean
  /** WCAG AAA compliance for large text (4.5:1) */
  wcagAAALarge: boolean
}
