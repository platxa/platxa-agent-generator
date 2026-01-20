/**
 * Spacing Grid System
 *
 * 8px/4px grid-based spacing system for consistent, harmonious layouts.
 * All spacing values are multiples of the base unit.
 */

import type {
  SpacingUnit,
  SpacingOutputUnit,
  SpacingValue,
  SpacingScale,
  SemanticSpacingTokens,
  ComponentSpacing,
  LayoutSpacing,
  SpacingGridConfig,
  SpacingValidation,
  SpacingCss,
  SpacingPreset,
  BoxSpacing,
} from "./types"

// =============================================================================
// Constants
// =============================================================================

/** Default grid configuration */
export const DEFAULT_GRID_CONFIG: SpacingGridConfig = {
  baseUnit: 4,
  rootFontSize: 16,
  outputUnit: "rem",
  includeHalfSteps: true,
}

/** Tailwind spacing scale multipliers */
export const SPACING_MULTIPLIERS = [
  0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24,
  28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96,
] as const

/** Semantic spacing mappings (in base units) */
export const DEFAULT_SEMANTIC_MAPPING: Record<keyof SemanticSpacingTokens, number> = {
  none: 0,
  "2xs": 1, // 4px
  xs: 2, // 8px
  sm: 3, // 12px
  md: 4, // 16px
  lg: 6, // 24px
  xl: 8, // 32px
  "2xl": 12, // 48px
  "3xl": 16, // 64px
  "4xl": 24, // 96px
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Create spacing value from pixels
 */
export function createSpacingValue(
  px: number,
  config: SpacingGridConfig = DEFAULT_GRID_CONFIG
): SpacingValue {
  const rem = px / config.rootFontSize
  const remStr = rem === 0 ? "0" : `${rem.toFixed(4).replace(/\.?0+$/, "")}rem`

  let css: string
  switch (config.outputUnit) {
    case "px":
      css = px === 0 ? "0" : `${px}px`
      break
    case "em":
      css = rem === 0 ? "0" : `${rem.toFixed(4).replace(/\.?0+$/, "")}em`
      break
    default:
      css = remStr
  }

  return {
    value: px / config.baseUnit,
    px,
    rem: remStr,
    css,
  }
}

/**
 * Calculate spacing from multiplier
 */
export function spacing(
  multiplier: number,
  config: SpacingGridConfig = DEFAULT_GRID_CONFIG
): SpacingValue {
  const px = multiplier * config.baseUnit
  return createSpacingValue(px, config)
}

/**
 * Convert pixels to grid units
 */
export function pxToUnits(px: number, baseUnit: SpacingUnit = 4): number {
  return px / baseUnit
}

/**
 * Convert grid units to pixels
 */
export function unitsToPx(units: number, baseUnit: SpacingUnit = 4): number {
  return units * baseUnit
}

/**
 * Check if value is on grid
 */
export function isOnGrid(px: number, baseUnit: SpacingUnit = 4): boolean {
  return px % baseUnit === 0
}

/**
 * Snap value to nearest grid point
 */
export function snapToGrid(px: number, baseUnit: SpacingUnit = 4): number {
  return Math.round(px / baseUnit) * baseUnit
}

/**
 * Get nearest grid value (floor)
 */
export function floorToGrid(px: number, baseUnit: SpacingUnit = 4): number {
  return Math.floor(px / baseUnit) * baseUnit
}

/**
 * Get nearest grid value (ceil)
 */
export function ceilToGrid(px: number, baseUnit: SpacingUnit = 4): number {
  return Math.ceil(px / baseUnit) * baseUnit
}

// =============================================================================
// Scale Generation
// =============================================================================

/**
 * Generate full spacing scale
 */
export function generateSpacingScale(
  config: SpacingGridConfig = DEFAULT_GRID_CONFIG
): SpacingScale {
  const scale: Partial<SpacingScale> = {}

  // Add px (1px) - always outputs "1px" regardless of outputUnit config
  // This is a special case for fine details like borders (matches Tailwind behavior)
  scale.px = {
    value: 1 / config.baseUnit,
    px: 1,
    rem: "0.0625rem",
    css: "1px",
  }

  // Add all multipliers
  for (const mult of SPACING_MULTIPLIERS) {
    const key = mult as keyof SpacingScale
    if (key !== "px") {
      scale[key] = spacing(mult, config)
    }
  }

  return scale as SpacingScale
}

/**
 * Generate semantic spacing tokens
 */
export function generateSemanticSpacing(
  config: SpacingGridConfig = DEFAULT_GRID_CONFIG,
  mapping: Record<keyof SemanticSpacingTokens, number> = DEFAULT_SEMANTIC_MAPPING
): SemanticSpacingTokens {
  const tokens: Partial<SemanticSpacingTokens> = {}

  for (const [key, multiplier] of Object.entries(mapping)) {
    tokens[key as keyof SemanticSpacingTokens] = spacing(multiplier, config)
  }

  return tokens as SemanticSpacingTokens
}

/**
 * Generate component spacing configuration
 */
export function generateComponentSpacing(
  paddingInline: number,
  paddingBlock: number,
  gap: number,
  margin: number = 0,
  config: SpacingGridConfig = DEFAULT_GRID_CONFIG
): ComponentSpacing {
  return {
    paddingInline: spacing(paddingInline, config),
    paddingBlock: spacing(paddingBlock, config),
    gap: spacing(gap, config),
    margin: spacing(margin, config),
  }
}

/**
 * Generate layout spacing configuration
 */
export function generateLayoutSpacing(
  options: {
    pageMargin?: number
    sectionGap?: number
    headerHeight?: number
    footerHeight?: number
    contentMaxWidth?: string
    sidebarWidth?: string
  } = {},
  config: SpacingGridConfig = DEFAULT_GRID_CONFIG
): LayoutSpacing {
  const {
    pageMargin = 4,
    sectionGap = 16,
    headerHeight = 16,
    footerHeight = 12,
    contentMaxWidth = "80rem",
    sidebarWidth = "16rem",
  } = options

  return {
    pageMargin: spacing(pageMargin, config),
    sectionGap: spacing(sectionGap, config),
    contentMaxWidth,
    sidebarWidth,
    headerHeight: spacing(headerHeight, config),
    footerHeight: spacing(footerHeight, config),
  }
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate spacing value against grid
 */
export function validateSpacing(
  px: number,
  config: SpacingGridConfig = DEFAULT_GRID_CONFIG
): SpacingValidation {
  const { baseUnit } = config
  const onGrid = isOnGrid(px, baseUnit)
  const nearest = snapToGrid(px, baseUnit)
  const deviation = Math.abs(px - nearest)

  let suggestion: string | undefined
  if (!onGrid) {
    suggestion = `Value ${px}px is not on the ${baseUnit}px grid. Consider using ${nearest}px instead.`
  }

  return {
    value: px,
    isOnGrid: onGrid,
    nearestGridValue: nearest,
    deviation,
    suggestion,
  }
}

/**
 * Validate multiple spacing values
 */
export function validateSpacingValues(
  values: number[],
  config: SpacingGridConfig = DEFAULT_GRID_CONFIG
): SpacingValidation[] {
  return values.map((v) => validateSpacing(v, config))
}

/**
 * Check if all values are on grid
 */
export function allOnGrid(
  values: number[],
  config: SpacingGridConfig = DEFAULT_GRID_CONFIG
): boolean {
  return values.every((v) => isOnGrid(v, config.baseUnit))
}

// =============================================================================
// Box Spacing Utilities
// =============================================================================

/**
 * Create uniform box spacing
 */
export function boxSpacing(
  all: number,
  config: SpacingGridConfig = DEFAULT_GRID_CONFIG
): BoxSpacing {
  const value = spacing(all, config)
  return {
    top: value,
    right: value,
    bottom: value,
    left: value,
  }
}

/**
 * Create box spacing with vertical/horizontal values
 */
export function boxSpacingXY(
  vertical: number,
  horizontal: number,
  config: SpacingGridConfig = DEFAULT_GRID_CONFIG
): BoxSpacing {
  const v = spacing(vertical, config)
  const h = spacing(horizontal, config)
  return {
    top: v,
    right: h,
    bottom: v,
    left: h,
  }
}

/**
 * Create box spacing with all four values
 */
export function boxSpacingTRBL(
  top: number,
  right: number,
  bottom: number,
  left: number,
  config: SpacingGridConfig = DEFAULT_GRID_CONFIG
): BoxSpacing {
  return {
    top: spacing(top, config),
    right: spacing(right, config),
    bottom: spacing(bottom, config),
    left: spacing(left, config),
  }
}

/**
 * Format box spacing as CSS shorthand
 */
export function formatBoxSpacing(box: BoxSpacing): string {
  const { top, right, bottom, left } = box

  // All same
  if (top.css === right.css && right.css === bottom.css && bottom.css === left.css) {
    return top.css
  }

  // Vertical/horizontal same
  if (top.css === bottom.css && right.css === left.css) {
    return `${top.css} ${right.css}`
  }

  // Left/right same
  if (right.css === left.css) {
    return `${top.css} ${right.css} ${bottom.css}`
  }

  // All different
  return `${top.css} ${right.css} ${bottom.css} ${left.css}`
}

// =============================================================================
// CSS Generation
// =============================================================================

/**
 * Generate CSS custom properties
 */
export function generateSpacingCss(
  config: SpacingGridConfig = DEFAULT_GRID_CONFIG
): SpacingCss {
  const scale = generateSpacingScale(config)
  const semantic = generateSemanticSpacing(config)

  // CSS variables
  const scaleVars = SPACING_MULTIPLIERS.map((mult) => {
    const key = mult as keyof SpacingScale
    const value = scale[key]
    const varName = String(mult).replace(".", "\\.")
    return `--spacing-${varName}: ${value.css};`
  }).join("\n  ")

  const semanticVars = Object.entries(semantic)
    .map(([key, value]) => `--space-${key}: ${value.css};`)
    .join("\n  ")

  const variables = `:root {
  /* Spacing Scale */
  --spacing-px: 1px;
  ${scaleVars}

  /* Semantic Spacing */
  ${semanticVars}
}`

  // Utility classes for margin and padding
  const directions = ["", "t", "r", "b", "l", "x", "y"] as const
  const properties = ["m", "p"] as const

  const classLines: string[] = []

  for (const prop of properties) {
    const cssProp = prop === "m" ? "margin" : "padding"

    for (const dir of directions) {
      for (const mult of SPACING_MULTIPLIERS) {
        const key = mult as keyof SpacingScale
        const value = scale[key]
        const className = `.${prop}${dir}-${String(mult).replace(".", "\\.")}`

        let cssProps: string
        switch (dir) {
          case "t":
            cssProps = `${cssProp}-top: ${value.css};`
            break
          case "r":
            cssProps = `${cssProp}-right: ${value.css};`
            break
          case "b":
            cssProps = `${cssProp}-bottom: ${value.css};`
            break
          case "l":
            cssProps = `${cssProp}-left: ${value.css};`
            break
          case "x":
            cssProps = `${cssProp}-left: ${value.css}; ${cssProp}-right: ${value.css};`
            break
          case "y":
            cssProps = `${cssProp}-top: ${value.css}; ${cssProp}-bottom: ${value.css};`
            break
          default:
            cssProps = `${cssProp}: ${value.css};`
        }

        classLines.push(`${className} { ${cssProps} }`)
      }
    }
  }

  // Gap utilities
  for (const mult of SPACING_MULTIPLIERS) {
    const key = mult as keyof SpacingScale
    const value = scale[key]
    classLines.push(`.gap-${String(mult).replace(".", "\\.")} { gap: ${value.css}; }`)
  }

  const classes = classLines.join("\n")

  // Tailwind config
  const tailwindSpacing: Record<string, string> = { px: "1px" }
  for (const mult of SPACING_MULTIPLIERS) {
    const key = mult as keyof SpacingScale
    tailwindSpacing[String(mult)] = scale[key].css
  }

  return {
    variables,
    classes,
    tailwindConfig: {
      theme: {
        spacing: tailwindSpacing,
      },
    },
  }
}

// =============================================================================
// Presets
// =============================================================================

/** Standard 4px grid preset */
export const PRESET_4PX: SpacingPreset = {
  name: "4px-grid",
  description: "Standard 4px base unit grid (Tailwind default)",
  config: {
    baseUnit: 4,
    rootFontSize: 16,
    outputUnit: "rem",
    includeHalfSteps: true,
  },
  semanticMapping: DEFAULT_SEMANTIC_MAPPING,
}

/** 8px grid preset */
export const PRESET_8PX: SpacingPreset = {
  name: "8px-grid",
  description: "8px base unit grid for larger spacing increments",
  config: {
    baseUnit: 8,
    rootFontSize: 16,
    outputUnit: "rem",
    includeHalfSteps: true,
  },
  semanticMapping: {
    none: 0,
    "2xs": 0.5, // 4px
    xs: 1, // 8px
    sm: 1.5, // 12px
    md: 2, // 16px
    lg: 3, // 24px
    xl: 4, // 32px
    "2xl": 6, // 48px
    "3xl": 8, // 64px
    "4xl": 12, // 96px
  },
}

/** Compact UI preset */
export const PRESET_COMPACT: SpacingPreset = {
  name: "compact",
  description: "Tighter spacing for dense UIs",
  config: {
    baseUnit: 4,
    rootFontSize: 16,
    outputUnit: "rem",
    includeHalfSteps: true,
  },
  semanticMapping: {
    none: 0,
    "2xs": 0.5, // 2px
    xs: 1, // 4px
    sm: 2, // 8px
    md: 3, // 12px
    lg: 4, // 16px
    xl: 6, // 24px
    "2xl": 8, // 32px
    "3xl": 12, // 48px
    "4xl": 16, // 64px
  },
}

/** All presets */
export const SPACING_PRESETS: Record<string, SpacingPreset> = {
  "4px-grid": PRESET_4PX,
  "8px-grid": PRESET_8PX,
  compact: PRESET_COMPACT,
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create spacing system from preset or config
 */
export function createSpacingSystem(
  presetOrConfig: string | SpacingPreset | SpacingGridConfig = DEFAULT_GRID_CONFIG
): {
  config: SpacingGridConfig
  scale: SpacingScale
  semantic: SemanticSpacingTokens
  css: SpacingCss
  spacing: (multiplier: number) => SpacingValue
  validate: (px: number) => SpacingValidation
} {
  let config: SpacingGridConfig
  let semanticMapping = DEFAULT_SEMANTIC_MAPPING

  if (typeof presetOrConfig === "string") {
    const preset = SPACING_PRESETS[presetOrConfig]
    if (!preset) {
      throw new Error(`Unknown preset: ${presetOrConfig}`)
    }
    config = preset.config
    semanticMapping = preset.semanticMapping
  } else if ("name" in presetOrConfig && "config" in presetOrConfig) {
    config = presetOrConfig.config
    semanticMapping = presetOrConfig.semanticMapping
  } else {
    config = presetOrConfig
  }

  const scale = generateSpacingScale(config)
  const semantic = generateSemanticSpacing(config, semanticMapping)
  const css = generateSpacingCss(config)

  return {
    config,
    scale,
    semantic,
    css,
    spacing: (multiplier: number) => spacing(multiplier, config),
    validate: (px: number) => validateSpacing(px, config),
  }
}
