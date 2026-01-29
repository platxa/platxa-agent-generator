/**
 * Color Rule - 60-30-10 Rule Enforcement
 *
 * Analyzes and enforces the 60-30-10 color balance rule for creating
 * visually harmonious and balanced designs.
 */

import type {
  ColorRole,
  ColorUsageCategory,
  ColorEntry,
  ColorDistribution,
  RuleTolerance,
  ColorBalanceResult,
  ColorSuggestion,
  ColorPalette,
  ElementColorMap,
  WeightMultipliers,
  ComponentColorAnalysis,
  LayoutColorAnalysis,
  ColorRuleConfig,
  ColorHarmony,
  ColorHarmonyResult,
  StyleColorExtract,
  ColorConversion,
  ContrastResult,
} from "./types"

// =============================================================================
// Constants
// =============================================================================

/** Default 60-30-10 distribution */
export const DEFAULT_DISTRIBUTION: ColorDistribution = {
  dominant: 60,
  secondary: 30,
  accent: 10,
}

/** Default tolerance settings */
export const DEFAULT_TOLERANCE: RuleTolerance = {
  dominant: 10,
  secondary: 10,
  accent: 5,
}

/** Default weight multipliers */
export const DEFAULT_WEIGHTS: WeightMultipliers = {
  background: 50,
  surface: 20,
  text: 15,
  border: 5,
  interactive: 7,
  decorative: 3,
}

/** Default element to role mapping */
export const DEFAULT_ELEMENT_MAPPING: ElementColorMap = {
  background: "dominant",
  surface: "dominant",
  primaryText: "dominant",
  secondaryText: "secondary",
  border: "secondary",
  primaryButton: "accent",
  secondaryButton: "secondary",
  link: "accent",
  focusRing: "accent",
  icon: "secondary",
}

// =============================================================================
// Color Conversion Utilities
// =============================================================================

/**
 * Parse hex color to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return null
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  }
}

/**
 * Convert RGB to hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((x) => {
        const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16)
        return hex.length === 1 ? "0" + hex : hex
      })
      .join("")
  )
}

/**
 * Convert RGB to HSL
 */
export function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

/**
 * Convert HSL to RGB
 */
export function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  h /= 360
  s /= 100
  l /= 100

  let r: number, g: number, b: number

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  }
}

/**
 * Convert any color format to full conversion object
 */
export function convertColor(color: string): ColorConversion | null {
  let rgb: { r: number; g: number; b: number } | null = null

  // Handle hex
  if (color.startsWith("#")) {
    rgb = hexToRgb(color)
  }
  // Handle rgb/rgba
  else if (color.startsWith("rgb")) {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (match) {
      rgb = {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3]),
      }
    }
  }
  // Handle hsl/hsla
  else if (color.startsWith("hsl")) {
    const match = color.match(/hsla?\((\d+),\s*(\d+)%?,\s*(\d+)%?/)
    if (match) {
      rgb = hslToRgb(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]))
    }
  }
  // Handle shadcn HSL format (e.g., "240 10% 3.9%")
  else if (/^\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/.test(color)) {
    const parts = color.split(/\s+/)
    const h = parseFloat(parts[0])
    const s = parseFloat(parts[1])
    const l = parseFloat(parts[2])
    rgb = hslToRgb(h, s, l)
  }

  if (!rgb) return null

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)

  return {
    hex: rgbToHex(rgb.r, rgb.g, rgb.b),
    rgb,
    hsl,
    oklch: {
      l: hsl.l / 100,
      c: (hsl.s / 100) * 0.4,
      h: hsl.h,
    },
  }
}

/**
 * Get relative luminance for contrast calculation
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c /= 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Calculate contrast ratio between two colors
 */
export function calculateContrast(color1: string, color2: string): ContrastResult {
  const c1 = convertColor(color1)
  const c2 = convertColor(color2)

  if (!c1 || !c2) {
    return {
      ratio: 1,
      wcagAA: false,
      wcagAALarge: false,
      wcagAAA: false,
      wcagAAALarge: false,
    }
  }

  const l1 = getRelativeLuminance(c1.rgb.r, c1.rgb.g, c1.rgb.b)
  const l2 = getRelativeLuminance(c2.rgb.r, c2.rgb.g, c2.rgb.b)

  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  const ratio = (lighter + 0.05) / (darker + 0.05)

  return {
    ratio: Math.round(ratio * 100) / 100,
    wcagAA: ratio >= 4.5,
    wcagAALarge: ratio >= 3,
    wcagAAA: ratio >= 7,
    wcagAAALarge: ratio >= 4.5,
  }
}

// =============================================================================
// Color Analysis
// =============================================================================

/**
 * Categorize a color's usage based on context
 */
export function categorizeColorUsage(context: string): ColorUsageCategory {
  const ctx = context.toLowerCase()
  if (ctx.includes("background") || ctx.includes("bg-")) return "background"
  if (ctx.includes("surface") || ctx.includes("card")) return "surface"
  if (ctx.includes("text") || ctx.includes("foreground")) return "text"
  if (ctx.includes("border") || ctx.includes("outline")) return "border"
  if (ctx.includes("button") || ctx.includes("link") || ctx.includes("interactive"))
    return "interactive"
  if (ctx.includes("error") || ctx.includes("success") || ctx.includes("warning"))
    return "feedback"
  return "decorative"
}

/**
 * Assign role based on element mapping and context
 */
export function assignColorRole(
  category: ColorUsageCategory,
  mapping: ElementColorMap = DEFAULT_ELEMENT_MAPPING
): ColorRole {
  switch (category) {
    case "background":
      return mapping.background
    case "surface":
      return mapping.surface
    case "text":
      return mapping.primaryText
    case "border":
      return mapping.border
    case "interactive":
      return mapping.primaryButton
    case "feedback":
      return "accent"
    case "decorative":
      return "secondary"
    default:
      return "dominant"
  }
}

/**
 * Calculate weight for a color based on its category
 */
export function calculateColorWeight(
  category: ColorUsageCategory,
  weights: WeightMultipliers = DEFAULT_WEIGHTS
): number {
  switch (category) {
    case "background":
      return weights.background
    case "surface":
      return weights.surface
    case "text":
      return weights.text
    case "border":
      return weights.border
    case "interactive":
      return weights.interactive
    case "feedback":
    case "decorative":
      return weights.decorative
    default:
      return 5
  }
}

/**
 * Create a color entry from value and context
 */
export function createColorEntry(
  value: string,
  context: string,
  config?: ColorRuleConfig
): ColorEntry {
  const category = categorizeColorUsage(context)
  const role = assignColorRole(category, config?.elementMapping as ElementColorMap)
  const weight = calculateColorWeight(category, config?.weights as WeightMultipliers)

  return {
    value,
    role,
    category,
    weight,
    context,
  }
}

/**
 * Extract colors from CSS style object
 */
export function extractColorsFromStyles(styles: Record<string, string>): StyleColorExtract {
  const result: StyleColorExtract = {
    backgrounds: [],
    foregrounds: [],
    borders: [],
    shadows: [],
    accents: [],
  }

  for (const [prop, value] of Object.entries(styles)) {
    if (!value || typeof value !== "string") continue

    const propLower = prop.toLowerCase()

    // Check more specific patterns BEFORE generic "color" pattern
    // e.g., "borderColor" contains both "border" and "color" - check border first
    if (propLower.includes("background") || propLower === "bg") {
      result.backgrounds.push(value)
    } else if (propLower.includes("border")) {
      result.borders.push(value)
    } else if (propLower.includes("shadow")) {
      result.shadows.push(value)
    } else if (propLower.includes("accent") || propLower.includes("highlight")) {
      result.accents.push(value)
    } else if (
      propLower.includes("color") ||
      propLower.includes("foreground") ||
      propLower === "fill"
    ) {
      // Generic "color" check last - catches "color", "textColor", "foreground", "fill"
      result.foregrounds.push(value)
    }
  }

  return result
}

// =============================================================================
// Distribution Analysis
// =============================================================================

/**
 * Calculate distribution from color entries
 */
export function calculateDistribution(entries: ColorEntry[]): ColorDistribution {
  if (entries.length === 0) {
    return { dominant: 0, secondary: 0, accent: 0 }
  }

  const totals = { dominant: 0, secondary: 0, accent: 0 }
  let totalWeight = 0

  for (const entry of entries) {
    totals[entry.role] += entry.weight
    totalWeight += entry.weight
  }

  if (totalWeight === 0) {
    return { dominant: 0, secondary: 0, accent: 0 }
  }

  return {
    dominant: Math.round((totals.dominant / totalWeight) * 100),
    secondary: Math.round((totals.secondary / totalWeight) * 100),
    accent: Math.round((totals.accent / totalWeight) * 100),
  }
}

/**
 * Check if distribution is within tolerance
 */
export function isWithinTolerance(
  distribution: ColorDistribution,
  target: ColorDistribution = DEFAULT_DISTRIBUTION,
  tolerance: RuleTolerance = DEFAULT_TOLERANCE
): { dominant: boolean; secondary: boolean; accent: boolean } {
  return {
    dominant: Math.abs(distribution.dominant - target.dominant) <= tolerance.dominant,
    secondary: Math.abs(distribution.secondary - target.secondary) <= tolerance.secondary,
    accent: Math.abs(distribution.accent - target.accent) <= tolerance.accent,
  }
}

/**
 * Calculate deviation from target
 */
export function calculateDeviation(
  distribution: ColorDistribution,
  target: ColorDistribution = DEFAULT_DISTRIBUTION
): { dominant: number; secondary: number; accent: number } {
  return {
    dominant: distribution.dominant - target.dominant,
    secondary: distribution.secondary - target.secondary,
    accent: distribution.accent - target.accent,
  }
}

/**
 * Generate suggestions for improving balance
 */
export function generateSuggestions(
  distribution: ColorDistribution,
  target: ColorDistribution = DEFAULT_DISTRIBUTION,
  tolerance: RuleTolerance = DEFAULT_TOLERANCE
): ColorSuggestion[] {
  const suggestions: ColorSuggestion[] = []
  const deviation = calculateDeviation(distribution, target)

  const roles: ColorRole[] = ["dominant", "secondary", "accent"]

  for (const role of roles) {
    const dev = deviation[role]
    const tol = tolerance[role]

    if (Math.abs(dev) > tol) {
      const type = dev > 0 ? "decrease" : "increase"
      const priority = role === "accent" ? 2 : role === "secondary" ? 3 : 4

      suggestions.push({
        type,
        role,
        current: distribution[role],
        target: target[role],
        message: `${type === "increase" ? "Increase" : "Decrease"} ${role} color usage from ${distribution[role]}% to closer to ${target[role]}%`,
        priority,
      })
    }
  }

  // Sort by priority
  suggestions.sort((a, b) => a.priority - b.priority)

  return suggestions
}

/**
 * Calculate overall balance score (0-100)
 */
export function calculateBalanceScore(
  distribution: ColorDistribution,
  target: ColorDistribution = DEFAULT_DISTRIBUTION
): number {
  const deviation = calculateDeviation(distribution, target)

  // Calculate total deviation (max possible is 200 if completely off)
  const totalDeviation =
    Math.abs(deviation.dominant) +
    Math.abs(deviation.secondary) +
    Math.abs(deviation.accent)

  // Convert to score (0-100)
  const score = Math.max(0, 100 - totalDeviation)

  return Math.round(score)
}

// =============================================================================
// Balance Analysis
// =============================================================================

/**
 * Analyze color balance for a set of entries
 */
export function analyzeColorBalance(
  entries: ColorEntry[],
  config?: ColorRuleConfig
): ColorBalanceResult {
  const target = {
    ...DEFAULT_DISTRIBUTION,
    ...config?.targetDistribution,
  }

  const tolerance = config?.strict
    ? { dominant: 0, secondary: 0, accent: 0 }
    : { ...DEFAULT_TOLERANCE, ...config?.tolerance }

  const distribution = calculateDistribution(entries)
  const compliance = isWithinTolerance(distribution, target, tolerance)
  const isBalanced = compliance.dominant && compliance.secondary && compliance.accent
  const deviation = calculateDeviation(distribution, target)
  const suggestions = generateSuggestions(distribution, target, tolerance)
  const score = calculateBalanceScore(distribution, target)

  return {
    distribution,
    isBalanced,
    compliance,
    deviation,
    suggestions,
    score,
  }
}

/**
 * Analyze a single component's colors
 */
export function analyzeComponent(
  componentName: string,
  colors: Array<{ value: string; context: string }>,
  config?: ColorRuleConfig
): ComponentColorAnalysis {
  const entries = colors.map(({ value, context }) =>
    createColorEntry(value, context, config)
  )

  const balance = analyzeColorBalance(entries, config)

  return {
    component: componentName,
    colors: entries,
    distribution: balance.distribution,
    recommendations: balance.suggestions,
  }
}

/**
 * Analyze full layout/page colors
 */
export function analyzeLayout(
  components: Array<{
    name: string
    colors: Array<{ value: string; context: string }>
  }>,
  config?: ColorRuleConfig
): LayoutColorAnalysis {
  const componentAnalyses = components.map(({ name, colors }) =>
    analyzeComponent(name, colors, config)
  )

  // Aggregate all color entries
  const allEntries = componentAnalyses.flatMap((c) => c.colors)
  const balance = analyzeColorBalance(allEntries, config)

  // Extract palette
  const palette = extractPalette(allEntries)

  return {
    components: componentAnalyses,
    totalDistribution: balance.distribution,
    balance,
    palette,
  }
}

/**
 * Extract palette from color entries
 */
export function extractPalette(entries: ColorEntry[]): ColorPalette {
  const palette: ColorPalette = {
    dominant: [],
    secondary: [],
    accent: [],
  }

  for (const entry of entries) {
    if (!palette[entry.role].includes(entry.value)) {
      palette[entry.role].push(entry.value)
    }
  }

  return palette
}

// =============================================================================
// Color Harmony
// =============================================================================

/**
 * Get hue difference between two colors
 */
function getHueDifference(h1: number, h2: number): number {
  const diff = Math.abs(h1 - h2)
  return Math.min(diff, 360 - diff)
}

/**
 * Check if colors form a specific harmony
 */
function checkHarmony(hues: number[], targetDiffs: number[], tolerance: number = 15): boolean {
  if (hues.length < 2) return false

  for (let i = 0; i < hues.length - 1; i++) {
    const diff = getHueDifference(hues[i], hues[i + 1])
    const matchesAnyTarget = targetDiffs.some((t) => Math.abs(diff - t) <= tolerance)
    if (!matchesAnyTarget) return false
  }

  return true
}

/**
 * Detect harmony type from colors
 */
export function detectHarmony(colors: string[]): ColorHarmony | "none" {
  const hues: number[] = []

  for (const color of colors) {
    const converted = convertColor(color)
    if (converted) {
      hues.push(converted.hsl.h)
    }
  }

  if (hues.length < 2) return "none"

  // Sort hues
  hues.sort((a, b) => a - b)

  // Check monochromatic (all similar hues)
  const hueRange = hues[hues.length - 1] - hues[0]
  if (hueRange <= 30 || hueRange >= 330) return "monochromatic"

  // Check complementary (180° apart)
  if (hues.length === 2 && checkHarmony(hues, [180], 20)) return "complementary"

  // Check analogous (30° apart)
  if (checkHarmony(hues, [30], 15)) return "analogous"

  // Check triadic (120° apart)
  if (hues.length === 3 && checkHarmony(hues, [120], 20)) return "triadic"

  // Check split-complementary
  if (hues.length === 3) {
    const diff1 = getHueDifference(hues[0], hues[1])
    const diff2 = getHueDifference(hues[1], hues[2])
    if (Math.abs(diff1 - 150) <= 20 && Math.abs(diff2 - 150) <= 20) {
      return "split-complementary"
    }
  }

  // Check tetradic (90° apart)
  if (hues.length === 4 && checkHarmony(hues, [90], 20)) return "tetradic"

  return "none"
}

/**
 * Analyze color harmony in a palette
 */
export function analyzeHarmony(colors: string[]): ColorHarmonyResult {
  const harmony = detectHarmony(colors)
  const harmonicColors: string[] = []
  const discordantColors: string[] = []
  const suggestions: string[] = []

  // Find colors that fit the harmony
  if (harmony !== "none" && colors.length >= 2) {
    const baseColor = convertColor(colors[0])
    if (baseColor) {
      const baseHue = baseColor.hsl.h

      for (const color of colors) {
        const converted = convertColor(color)
        if (converted) {
          const hueDiff = getHueDifference(converted.hsl.h, baseHue)

          // Check if this color fits the detected harmony
          let fits = false
          switch (harmony) {
            case "monochromatic":
              fits = hueDiff <= 30
              break
            case "complementary":
              fits = hueDiff <= 20 || Math.abs(hueDiff - 180) <= 20
              break
            case "analogous":
              fits = hueDiff <= 60
              break
            case "triadic":
              fits = hueDiff <= 20 || Math.abs(hueDiff - 120) <= 20 || Math.abs(hueDiff - 240) <= 20
              break
            case "split-complementary":
              fits = hueDiff <= 20 || Math.abs(hueDiff - 150) <= 20 || Math.abs(hueDiff - 210) <= 20
              break
            case "tetradic":
              fits =
                hueDiff <= 20 ||
                Math.abs(hueDiff - 90) <= 20 ||
                Math.abs(hueDiff - 180) <= 20 ||
                Math.abs(hueDiff - 270) <= 20
              break
          }

          if (fits) {
            harmonicColors.push(color)
          } else {
            discordantColors.push(color)
          }
        }
      }
    }
  }

  // Calculate score
  const score =
    harmony === "none"
      ? 0
      : Math.round((harmonicColors.length / Math.max(1, colors.length)) * 100)

  // Generate suggestions
  if (harmony === "none") {
    suggestions.push("Consider using a defined color harmony for better visual cohesion")
  }
  if (discordantColors.length > 0) {
    suggestions.push(
      `${discordantColors.length} color(s) don't fit the ${harmony} harmony pattern`
    )
  }

  return {
    harmony,
    score,
    harmonicColors,
    discordantColors,
    suggestions,
  }
}

// =============================================================================
// Enforcement Utilities
// =============================================================================

/**
 * Suggest role reassignment to improve balance
 */
export function suggestRoleReassignment(
  entries: ColorEntry[],
  config?: ColorRuleConfig
): Array<{ entry: ColorEntry; suggestedRole: ColorRole; reason: string }> {
  const balance = analyzeColorBalance(entries, config)
  const suggestions: Array<{ entry: ColorEntry; suggestedRole: ColorRole; reason: string }> =
    []

  if (balance.isBalanced) return suggestions

  const { deviation } = balance

  // Find entries that could be reassigned
  for (const entry of entries) {
    // If we have too much of a role, suggest reassigning some entries
    if (deviation[entry.role] > 10) {
      // Find the role that needs more
      const needsMore: ColorRole | null =
        deviation.dominant < -10
          ? "dominant"
          : deviation.secondary < -10
            ? "secondary"
            : deviation.accent < -10
              ? "accent"
              : null

      if (needsMore) {
        suggestions.push({
          entry,
          suggestedRole: needsMore,
          reason: `Reassigning from ${entry.role} (${balance.distribution[entry.role]}%) to ${needsMore} (${balance.distribution[needsMore]}%) would improve balance`,
        })
      }
    }
  }

  return suggestions
}

/**
 * Create a balanced color configuration from palette
 */
export function createBalancedConfig(
  palette: ColorPalette,
  config?: ColorRuleConfig
): ColorEntry[] {
  const entries: ColorEntry[] = []
  const target = { ...DEFAULT_DISTRIBUTION, ...config?.targetDistribution }

  // Add dominant colors with appropriate weight
  for (const color of palette.dominant) {
    entries.push({
      value: color,
      role: "dominant",
      category: "background",
      weight: target.dominant / Math.max(1, palette.dominant.length),
    })
  }

  // Add secondary colors
  for (const color of palette.secondary) {
    entries.push({
      value: color,
      role: "secondary",
      category: "surface",
      weight: target.secondary / Math.max(1, palette.secondary.length),
    })
  }

  // Add accent colors
  for (const color of palette.accent) {
    entries.push({
      value: color,
      role: "accent",
      category: "interactive",
      weight: target.accent / Math.max(1, palette.accent.length),
    })
  }

  return entries
}

/**
 * Validate a color palette against the 60-30-10 rule
 */
export function validatePalette(
  palette: ColorPalette,
  config?: ColorRuleConfig
): ColorBalanceResult {
  const entries = createBalancedConfig(palette, config)
  return analyzeColorBalance(entries, config)
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create color rule analyzer with custom config
 */
export function createColorRuleAnalyzer(config?: ColorRuleConfig) {
  return {
    analyzeBalance: (entries: ColorEntry[]) => analyzeColorBalance(entries, config),
    analyzeComponent: (name: string, colors: Array<{ value: string; context: string }>) =>
      analyzeComponent(name, colors, config),
    analyzeLayout: (
      components: Array<{ name: string; colors: Array<{ value: string; context: string }> }>
    ) => analyzeLayout(components, config),
    validatePalette: (palette: ColorPalette) => validatePalette(palette, config),
    suggestReassignment: (entries: ColorEntry[]) => suggestRoleReassignment(entries, config),
  }
}
