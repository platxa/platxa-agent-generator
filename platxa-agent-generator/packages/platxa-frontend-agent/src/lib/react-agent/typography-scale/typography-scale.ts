/**
 * Typography Scale System
 *
 * Implements modular typography scales with 3-level hierarchy
 * for clear, consistent visual hierarchy in UIs.
 */

import type {
  ScaleRatio,
  TypographyUnit,
  ScaleStep,
  TypographyScale,
  HierarchyConfig,
  SemanticTypography,
  TypeStyle,
  FluidConfig,
  ScaleOptions,
  HierarchyOptions,
  TypographyCss,
  FontStacks,
  TypographyValidation,
  TypographyPreset,
  FontWeight,
  FontWeightValue,
} from "./types"

// =============================================================================
// Constants
// =============================================================================

/** Scale ratio values */
export const SCALE_RATIOS: Record<Exclude<ScaleRatio, "custom">, number> = {
  "minor-second": 1.067,
  "major-second": 1.125,
  "minor-third": 1.2,
  "major-third": 1.25,
  "perfect-fourth": 1.333,
  "augmented-fourth": 1.414,
  "perfect-fifth": 1.5,
  "golden-ratio": 1.618,
}

/** Font weight values */
export const FONT_WEIGHTS: Record<FontWeight, FontWeightValue> = {
  thin: 100,
  extralight: 200,
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
}

/** Default step names (Tailwind convention) */
export const DEFAULT_STEP_NAMES = [
  "xs",
  "sm",
  "base",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
  "7xl",
  "8xl",
  "9xl",
]

/** Default font stacks */
export const DEFAULT_FONT_STACKS: FontStacks = {
  systemSans:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  systemSerif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  systemMono:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  custom: {},
}

/** Default hierarchy configuration */
export const DEFAULT_HIERARCHY_CONFIG: HierarchyConfig = {
  primary: {
    sizes: ["4xl", "3xl", "2xl"],
    weight: "bold",
    lineHeight: 1.1,
    letterSpacing: "-0.02em",
  },
  secondary: {
    sizes: ["xl", "lg", "base"],
    weight: "semibold",
    lineHeight: 1.3,
    letterSpacing: "-0.01em",
  },
  tertiary: {
    sizes: ["base", "sm", "xs"],
    weight: "normal",
    lineHeight: 1.5,
    letterSpacing: "0",
  },
}

/** Default scale options */
export const DEFAULT_SCALE_OPTIONS: Required<ScaleOptions> = {
  baseSizePx: 16,
  ratio: "perfect-fourth",
  stepsUp: 6,
  stepsDown: 2,
  unit: "rem",
  stepNames: DEFAULT_STEP_NAMES,
  rootFontSize: 16,
}

// =============================================================================
// Scale Generation
// =============================================================================

/**
 * Get ratio value from name or number
 */
export function getRatioValue(ratio: ScaleRatio | number): number {
  if (typeof ratio === "number") return ratio
  if (ratio === "custom") return 1.25 // Default for custom
  return SCALE_RATIOS[ratio]
}

/**
 * Get font weight value
 */
export function getFontWeightValue(weight: FontWeight | FontWeightValue): FontWeightValue {
  if (typeof weight === "number") return weight
  return FONT_WEIGHTS[weight]
}

/**
 * Calculate line height for a given font size
 * Larger text needs tighter line height
 */
export function calculateLineHeight(sizePx: number): number {
  if (sizePx >= 48) return 1.1
  if (sizePx >= 36) return 1.15
  if (sizePx >= 24) return 1.25
  if (sizePx >= 18) return 1.4
  return 1.5
}

// =============================================================================
// Line Height Calculator (Feature #20)
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

/**
 * Calculate optimal line height based on font size and mode
 *
 * For body text (≤18px): Uses maxRatio (1.5-1.6 recommended for readability)
 * For headings (>18px): Scales from maxRatio to minRatio as size increases
 *
 * The 1.125-1.2x range is optimal for headings/display text.
 * Body text should use 1.4-1.6x for readability.
 */
export function calculateOptimalLineHeight(
  fontSizePx: number,
  config: Partial<LineHeightConfig> = {}
): LineHeightResult {
  const {
    mode = "auto",
    minRatio = 1.125,
    maxRatio = 1.5,
    fixedValue = 1.5,
    thresholdPx = 48,
  } = config

  let value: number

  switch (mode) {
    case "fixed":
      value = fixedValue
      break

    case "ratio":
      // Linear interpolation between maxRatio (small text) and minRatio (large text)
      // Root cause consideration: Use actual font size to interpolate, not just breakpoints
      if (fontSizePx <= 16) {
        value = maxRatio
      } else if (fontSizePx >= thresholdPx) {
        value = minRatio
      } else {
        // Interpolate between 16px and threshold
        const t = (fontSizePx - 16) / (thresholdPx - 16)
        value = maxRatio - t * (maxRatio - minRatio)
      }
      break

    case "auto":
    default:
      // Use existing breakpoint-based calculation
      value = calculateLineHeight(fontSizePx)
      break
  }

  const px = fontSizePx * value
  // WCAG recommends 1.5 for body text (≤18px or ≤14px bold)
  const isBodyText = fontSizePx <= 18
  const isAccessible = isBodyText ? value >= 1.5 : value >= 1.1

  let recommendation: string | undefined
  if (!isAccessible) {
    if (isBodyText) {
      recommendation = `Body text at ${fontSizePx}px should have line-height ≥1.5 for readability (current: ${value.toFixed(3)})`
    } else {
      recommendation = `Heading at ${fontSizePx}px should have line-height ≥1.1 (current: ${value.toFixed(3)})`
    }
  }

  return {
    value: Math.round(value * 1000) / 1000, // 3 decimal precision
    px: Math.round(px * 100) / 100,
    isAccessible,
    recommendation,
  }
}

/**
 * Generate line heights for a typography scale
 */
export function generateScaleLineHeights(
  scale: TypographyScale,
  config: Partial<LineHeightConfig> = {}
): Map<string, LineHeightResult> {
  const results = new Map<string, LineHeightResult>()

  for (const step of scale.steps) {
    results.set(step.name, calculateOptimalLineHeight(step.sizePx, config))
  }

  return results
}

// =============================================================================
// Line Length Validator (Feature #21)
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

/**
 * Calculate approximate characters per line for given container and font
 *
 * Formula: characters ≈ containerWidth / (fontSize * avgCharWidthRatio)
 *
 * Root cause: Use actual character width ratio based on font metrics,
 * not arbitrary fixed values. Default 0.5 is average for proportional fonts.
 */
export function calculateLineLength(
  containerWidthPx: number,
  fontSizePx: number,
  config: Partial<LineLengthConfig> = {}
): LineLengthResult {
  const {
    minChars = 40,
    maxChars = 80,
    optimalMin = 45,
    optimalMax = 75,
    idealChars = 66,
    avgCharWidthRatio = 0.5,
  } = config

  // Character width approximation
  // Root cause: avgCharWidthRatio varies by font
  // - Monospace: ~0.6
  // - Sans-serif (like Inter): ~0.45-0.5
  // - Serif (like Georgia): ~0.48-0.52
  const avgCharWidth = fontSizePx * avgCharWidthRatio
  const characters = Math.round(containerWidthPx / avgCharWidth)

  const isOptimal = characters >= optimalMin && characters <= optimalMax
  const isAcceptable = characters >= minChars && characters <= maxChars
  const deviationFromIdeal = characters - idealChars

  let recommendation: string | undefined
  let suggestedWidthPx: number | undefined

  if (!isAcceptable) {
    const idealWidth = idealChars * avgCharWidth
    suggestedWidthPx = Math.round(idealWidth)

    if (characters < minChars) {
      recommendation = `Line length (~${characters} chars) is too short. Consider widening container to ~${suggestedWidthPx}px for ${idealChars} chars.`
    } else {
      recommendation = `Line length (~${characters} chars) is too long. Consider narrowing container to ~${suggestedWidthPx}px for ${idealChars} chars.`
    }
  } else if (!isOptimal) {
    const idealWidth = idealChars * avgCharWidth
    suggestedWidthPx = Math.round(idealWidth)

    if (characters < optimalMin) {
      recommendation = `Line length (~${characters} chars) is acceptable but short. Optimal is ${optimalMin}-${optimalMax} chars.`
    } else {
      recommendation = `Line length (~${characters} chars) is acceptable but long. Optimal is ${optimalMin}-${optimalMax} chars.`
    }
  }

  return {
    characters,
    isOptimal,
    isAcceptable,
    deviationFromIdeal,
    recommendation,
    suggestedWidthPx,
  }
}

/**
 * Calculate optimal container width for given font size and target characters
 */
export function calculateOptimalContainerWidth(
  fontSizePx: number,
  targetChars: number = 66,
  avgCharWidthRatio: number = 0.5
): number {
  return Math.round(fontSizePx * avgCharWidthRatio * targetChars)
}

/**
 * Validate line length for a container width at multiple font sizes
 */
export function validateLineLengths(
  containerWidthPx: number,
  fontSizes: number[],
  config: Partial<LineLengthConfig> = {}
): Map<number, LineLengthResult> {
  const results = new Map<number, LineLengthResult>()

  for (const fontSize of fontSizes) {
    results.set(fontSize, calculateLineLength(containerWidthPx, fontSize, config))
  }

  return results
}

/**
 * Calculate letter spacing for a given font size
 * Larger text benefits from tighter tracking
 */
export function calculateLetterSpacing(sizePx: number): string {
  if (sizePx >= 48) return "-0.025em"
  if (sizePx >= 36) return "-0.02em"
  if (sizePx >= 24) return "-0.015em"
  if (sizePx >= 18) return "-0.01em"
  return "0"
}

/**
 * Convert pixels to specified unit
 */
export function convertToUnit(
  sizePx: number,
  unit: TypographyUnit,
  rootFontSize: number = 16
): string {
  switch (unit) {
    case "px":
      return `${Math.round(sizePx)}px`
    case "rem":
      return `${(sizePx / rootFontSize).toFixed(3).replace(/\.?0+$/, "")}rem`
    case "em":
      return `${(sizePx / rootFontSize).toFixed(3).replace(/\.?0+$/, "")}em`
    case "clamp":
      // Will be handled separately in fluid typography
      return `${sizePx}px`
    default:
      return `${sizePx}px`
  }
}

/**
 * Generate a typography scale
 */
export function generateScale(options: ScaleOptions = {}): TypographyScale {
  const config = { ...DEFAULT_SCALE_OPTIONS, ...options }
  const ratio = getRatioValue(config.ratio)
  const ratioName: ScaleRatio = typeof config.ratio === "string" ? config.ratio : "custom"

  const steps: ScaleStep[] = []
  const sizes: Record<string, ScaleStep> = {}

  // Calculate total steps
  const totalSteps = config.stepsDown + 1 + config.stepsUp
  const baseIndex = config.stepsDown

  for (let i = 0; i < totalSteps; i++) {
    const stepIndex = i - baseIndex
    const sizePx = config.baseSizePx * Math.pow(ratio, stepIndex)
    const name = config.stepNames[i] || `step-${stepIndex}`

    const step: ScaleStep = {
      name,
      index: stepIndex,
      sizePx: Math.round(sizePx * 100) / 100,
      size: convertToUnit(sizePx, config.unit, config.rootFontSize),
      lineHeight: calculateLineHeight(sizePx),
      letterSpacing: calculateLetterSpacing(sizePx),
    }

    steps.push(step)
    sizes[name] = step
  }

  return {
    name: `scale-${ratioName}`,
    baseSizePx: config.baseSizePx,
    ratio,
    ratioName,
    unit: config.unit,
    steps,
    sizes,
  }
}

/**
 * Get a scale step by name
 */
export function getScaleStep(scale: TypographyScale, name: string): ScaleStep | undefined {
  return scale.sizes[name]
}

/**
 * Get step at index (0 = base)
 */
export function getStepAtIndex(scale: TypographyScale, index: number): ScaleStep | undefined {
  return scale.steps.find((s) => s.index === index)
}

// =============================================================================
// Hierarchy Generation
// =============================================================================

/**
 * Create type style from scale step and config
 */
function createTypeStyle(
  step: ScaleStep,
  weight: FontWeight | FontWeightValue,
  lineHeight: number,
  letterSpacing: string,
  fontFamily?: string
): TypeStyle {
  return {
    fontSize: step.size,
    lineHeight,
    letterSpacing,
    fontWeight: weight,
    fontFamily,
  }
}

/**
 * Generate semantic typography from scale and hierarchy
 */
export function generateSemanticTypography(options: HierarchyOptions): SemanticTypography {
  const { scale, primaryFont, secondaryFont, monoFont } = options
  const config = { ...DEFAULT_HIERARCHY_CONFIG, ...options.config }

  // Helper to get size or fallback
  const getSize = (sizes: string[], index: number): ScaleStep => {
    const name = sizes[index] || sizes[sizes.length - 1] || "base"
    return scale.sizes[name] || scale.steps.find((s) => s.index === 0)!
  }

  const { primary, secondary, tertiary } = config

  return {
    // Display - largest primary
    display: createTypeStyle(
      getSize(primary.sizes, 0),
      primary.weight,
      primary.lineHeight,
      primary.letterSpacing,
      primaryFont
    ),

    // Headings - primary hierarchy
    h1: createTypeStyle(
      getSize(primary.sizes, 0),
      primary.weight,
      primary.lineHeight,
      primary.letterSpacing,
      primaryFont
    ),
    h2: createTypeStyle(
      getSize(primary.sizes, 1),
      primary.weight,
      primary.lineHeight,
      primary.letterSpacing,
      primaryFont
    ),
    h3: createTypeStyle(
      getSize(primary.sizes, 2),
      primary.weight,
      primary.lineHeight,
      primary.letterSpacing,
      primaryFont
    ),

    // Subheadings - secondary hierarchy
    h4: createTypeStyle(
      getSize(secondary.sizes, 0),
      secondary.weight,
      secondary.lineHeight,
      secondary.letterSpacing,
      primaryFont
    ),
    h5: createTypeStyle(
      getSize(secondary.sizes, 1),
      secondary.weight,
      secondary.lineHeight,
      secondary.letterSpacing,
      primaryFont
    ),
    h6: createTypeStyle(
      getSize(secondary.sizes, 2),
      secondary.weight,
      secondary.lineHeight,
      secondary.letterSpacing,
      primaryFont
    ),

    // Body - tertiary hierarchy
    body: createTypeStyle(
      getSize(tertiary.sizes, 0),
      tertiary.weight,
      tertiary.lineHeight,
      tertiary.letterSpacing,
      secondaryFont || primaryFont
    ),
    bodyLarge: createTypeStyle(
      getSize(secondary.sizes, 1),
      tertiary.weight,
      tertiary.lineHeight,
      tertiary.letterSpacing,
      secondaryFont || primaryFont
    ),
    bodySmall: createTypeStyle(
      getSize(tertiary.sizes, 1),
      tertiary.weight,
      tertiary.lineHeight,
      tertiary.letterSpacing,
      secondaryFont || primaryFont
    ),

    // Captions and labels
    caption: createTypeStyle(
      getSize(tertiary.sizes, 2),
      tertiary.weight,
      tertiary.lineHeight,
      "0.02em",
      secondaryFont || primaryFont
    ),
    label: createTypeStyle(
      getSize(tertiary.sizes, 1),
      "medium",
      tertiary.lineHeight,
      "0.02em",
      secondaryFont || primaryFont
    ),

    // Special text
    code: createTypeStyle(getSize(tertiary.sizes, 1), "normal", 1.6, "0", monoFont),
    quote: {
      ...createTypeStyle(
        getSize(secondary.sizes, 1),
        tertiary.weight,
        1.6,
        tertiary.letterSpacing,
        secondaryFont || primaryFont
      ),
      fontStyle: "italic",
    },
  }
}

// =============================================================================
// Fluid Typography
// =============================================================================

/**
 * Generate fluid clamp value for responsive typography
 */
export function generateFluidSize(config: FluidConfig): string {
  const { minViewport, maxViewport, minSize, maxSize } = config

  // Calculate preferred value (viewport-relative)
  const slope = (maxSize - minSize) / (maxViewport - minViewport)
  const yIntercept = minSize - slope * minViewport

  // Convert to viewport width units
  const preferredVw = (slope * 100).toFixed(4)
  const preferredRem = (yIntercept / 16).toFixed(4)

  // Strip trailing zeros for cleaner output (same as convertToUnit)
  const minRem = (minSize / 16).toFixed(3).replace(/\.?0+$/, "")
  const maxRem = (maxSize / 16).toFixed(3).replace(/\.?0+$/, "")

  return `clamp(${minRem}rem, ${preferredRem}rem + ${preferredVw}vw, ${maxRem}rem)`
}

/**
 * Generate fluid scale
 */
export function generateFluidScale(
  baseOptions: ScaleOptions,
  viewportConfig: { min: number; max: number } = { min: 320, max: 1200 }
): TypographyScale {
  const baseScale = generateScale({ ...baseOptions, unit: "px" })
  const scaleFactor = 0.85 // Reduce sizes by 15% at minimum viewport

  const fluidSteps = baseScale.steps.map((step) => ({
    ...step,
    size: generateFluidSize({
      minViewport: viewportConfig.min,
      maxViewport: viewportConfig.max,
      minSize: step.sizePx * scaleFactor,
      maxSize: step.sizePx,
    }),
  }))

  const fluidSizes: Record<string, ScaleStep> = {}
  fluidSteps.forEach((step) => {
    fluidSizes[step.name] = step
  })

  return {
    ...baseScale,
    unit: "clamp",
    steps: fluidSteps,
    sizes: fluidSizes,
  }
}

// =============================================================================
// CSS Generation
// =============================================================================

/**
 * Generate CSS custom properties for typography
 */
export function generateTypographyCss(
  scale: TypographyScale,
  semantic: SemanticTypography,
  options: { prefix?: string } = {}
): TypographyCss {
  const { prefix = "--" } = options

  // Generate scale variables
  const scaleVars = scale.steps
    .map((step) => `${prefix}font-size-${step.name}: ${step.size};`)
    .join("\n  ")

  // Generate semantic variables
  const semanticEntries = Object.entries(semantic)
  const semanticVars = semanticEntries
    .map(([name, style]) => {
      const kebabName = name.replace(/([A-Z])/g, "-$1").toLowerCase()
      return `${prefix}text-${kebabName}: ${style.fontSize};`
    })
    .join("\n  ")

  const variables = `:root {
  /* Typography Scale */
  ${scaleVars}

  /* Semantic Typography */
  ${semanticVars}
}`

  // Generate utility classes
  const scaleClasses = scale.steps
    .map(
      (step) => `.text-${step.name} {
  font-size: ${step.size};
  line-height: ${step.lineHeight};
  letter-spacing: ${step.letterSpacing};
}`
    )
    .join("\n\n")

  const semanticClasses = semanticEntries
    .map(([name, style]) => {
      const kebabName = name.replace(/([A-Z])/g, "-$1").toLowerCase()
      const weightValue = style.fontWeight
        ? typeof style.fontWeight === "number"
          ? style.fontWeight
          : FONT_WEIGHTS[style.fontWeight as FontWeight]
        : 400
      return `.text-${kebabName} {
  font-size: ${style.fontSize};
  line-height: ${style.lineHeight};
  letter-spacing: ${style.letterSpacing || "normal"};
  font-weight: ${weightValue};${style.fontFamily ? `\n  font-family: ${style.fontFamily};` : ""}${style.fontStyle ? `\n  font-style: ${style.fontStyle};` : ""}
}`
    })
    .join("\n\n")

  const classes = `/* Scale Classes */\n${scaleClasses}\n\n/* Semantic Classes */\n${semanticClasses}`

  // Tailwind config
  const tailwindFontSize: Record<string, [string, { lineHeight: string; letterSpacing: string }]> =
    {}
  scale.steps.forEach((step) => {
    tailwindFontSize[step.name] = [
      step.size,
      { lineHeight: String(step.lineHeight), letterSpacing: step.letterSpacing },
    ]
  })

  return {
    variables,
    classes,
    tailwindConfig: {
      theme: {
        extend: {
          fontSize: tailwindFontSize,
        },
      },
    },
  }
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate typography configuration
 */
export function validateTypography(
  scale: TypographyScale,
  semantic: SemanticTypography
): TypographyValidation {
  const errors: string[] = []
  const warnings: string[] = []

  // Check minimum body size (accessibility)
  // Convert rem/em to px for proper comparison (assuming 16px root)
  const bodySizeValue = parseFloat(semantic.body.fontSize)
  const bodySizeUnit = semantic.body.fontSize.replace(/[\d.]/g, "").trim()
  const bodySizePx =
    bodySizeUnit === "rem" || bodySizeUnit === "em" ? bodySizeValue * 16 : bodySizeValue
  const minSizeOk = bodySizePx >= 16

  if (!minSizeOk && bodySizePx < 14) {
    errors.push(`Body text size (${semantic.body.fontSize}) may be too small for accessibility`)
  } else if (!minSizeOk) {
    warnings.push(`Consider using at least 16px for body text`)
  }

  // Check line height (accessibility)
  const bodyLineHeight =
    typeof semantic.body.lineHeight === "number"
      ? semantic.body.lineHeight
      : parseFloat(semantic.body.lineHeight)
  const lineHeightOk = bodyLineHeight >= 1.4

  if (!lineHeightOk) {
    warnings.push(`Body line height (${bodyLineHeight}) should be at least 1.5 for readability`)
  }

  // Check hierarchy is clear (distinct size differences)
  // Helper to convert any size to px for consistent comparison
  const toPx = (fontSize: string): number => {
    const value = parseFloat(fontSize)
    const unit = fontSize.replace(/[\d.]/g, "").trim()
    return unit === "rem" || unit === "em" ? value * 16 : value
  }

  const h1SizePx = toPx(semantic.h1.fontSize)
  const h2SizePx = toPx(semantic.h2.fontSize)
  const h3SizePx = toPx(semantic.h3.fontSize)

  const hierarchyClear = h1SizePx > h2SizePx && h2SizePx > h3SizePx && h3SizePx > bodySizePx

  if (!hierarchyClear) {
    warnings.push("Heading sizes should decrease progressively (h1 > h2 > h3 > body)")
  }

  // Check scale has enough steps
  if (scale.steps.length < 5) {
    warnings.push("Scale has fewer than 5 steps, which may limit design flexibility")
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    a11y: {
      minSizeOk,
      lineHeightOk,
      hierarchyClear,
    },
  }
}

// =============================================================================
// Presets
// =============================================================================

/** Modern clean preset */
export const PRESET_MODERN: TypographyPreset = {
  name: "modern",
  description: "Clean, minimal typography with perfect fourth scale",
  scale: {
    baseSizePx: 16,
    ratio: "perfect-fourth",
    stepsUp: 6,
    stepsDown: 2,
  },
  hierarchy: {
    primary: {
      sizes: ["4xl", "3xl", "2xl"],
      weight: "bold",
      lineHeight: 1.1,
      letterSpacing: "-0.02em",
    },
    secondary: {
      sizes: ["xl", "lg", "base"],
      weight: "semibold",
      lineHeight: 1.3,
      letterSpacing: "-0.01em",
    },
    tertiary: {
      sizes: ["base", "sm", "xs"],
      weight: "normal",
      lineHeight: 1.5,
      letterSpacing: "0",
    },
  },
  fonts: {
    systemSans: DEFAULT_FONT_STACKS.systemSans,
  },
}

/** Traditional editorial preset */
export const PRESET_EDITORIAL: TypographyPreset = {
  name: "editorial",
  description: "Classic editorial typography with major third scale",
  scale: {
    baseSizePx: 18,
    ratio: "major-third",
    stepsUp: 5,
    stepsDown: 2,
  },
  hierarchy: {
    primary: {
      sizes: ["3xl", "2xl", "xl"],
      weight: "bold",
      lineHeight: 1.15,
      letterSpacing: "-0.015em",
    },
    secondary: {
      sizes: ["lg", "base", "sm"],
      weight: "semibold",
      lineHeight: 1.35,
      letterSpacing: "0",
    },
    tertiary: {
      sizes: ["base", "sm", "xs"],
      weight: "normal",
      lineHeight: 1.6,
      letterSpacing: "0.01em",
    },
  },
  fonts: {
    systemSerif: DEFAULT_FONT_STACKS.systemSerif,
  },
}

/** Compact UI preset */
export const PRESET_COMPACT: TypographyPreset = {
  name: "compact",
  description: "Space-efficient typography for dense UIs",
  scale: {
    baseSizePx: 14,
    ratio: "major-second",
    stepsUp: 5,
    stepsDown: 1,
  },
  hierarchy: {
    primary: {
      sizes: ["3xl", "2xl", "xl"],
      weight: "semibold",
      lineHeight: 1.2,
      letterSpacing: "-0.01em",
    },
    secondary: {
      sizes: ["lg", "base", "sm"],
      weight: "medium",
      lineHeight: 1.3,
      letterSpacing: "0",
    },
    tertiary: {
      sizes: ["sm", "xs", "xs"],
      weight: "normal",
      lineHeight: 1.4,
      letterSpacing: "0",
    },
  },
  fonts: {
    systemSans: DEFAULT_FONT_STACKS.systemSans,
  },
}

/** All presets */
export const TYPOGRAPHY_PRESETS: Record<string, TypographyPreset> = {
  modern: PRESET_MODERN,
  editorial: PRESET_EDITORIAL,
  compact: PRESET_COMPACT,
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create complete typography system from preset or options
 */
export function createTypographySystem(
  presetOrOptions: string | TypographyPreset | ScaleOptions
): {
  scale: TypographyScale
  semantic: SemanticTypography
  css: TypographyCss
  validation: TypographyValidation
} {
  let scaleOptions: ScaleOptions
  let hierarchyConfig: Partial<HierarchyConfig> | undefined
  let fonts: Partial<FontStacks> | undefined

  if (typeof presetOrOptions === "string") {
    const preset = TYPOGRAPHY_PRESETS[presetOrOptions]
    if (!preset) {
      throw new Error(`Unknown preset: ${presetOrOptions}`)
    }
    scaleOptions = preset.scale
    hierarchyConfig = preset.hierarchy
    fonts = preset.fonts
  } else if ("name" in presetOrOptions && "scale" in presetOrOptions) {
    // It's a preset
    scaleOptions = presetOrOptions.scale
    hierarchyConfig = presetOrOptions.hierarchy
    fonts = presetOrOptions.fonts
  } else {
    // It's scale options
    scaleOptions = presetOrOptions
  }

  const scale = generateScale(scaleOptions)
  const semantic = generateSemanticTypography({
    scale,
    primaryFont: fonts?.systemSans || fonts?.systemSerif,
    monoFont: fonts?.systemMono,
    config: hierarchyConfig,
  })
  const css = generateTypographyCss(scale, semantic)
  const validation = validateTypography(scale, semantic)

  return { scale, semantic, css, validation }
}
