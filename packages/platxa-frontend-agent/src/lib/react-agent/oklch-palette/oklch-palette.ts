/**
 * OKLCH Palette Generator
 *
 * Generates Tailwind v4 compatible color palettes using OKLCH color space.
 * Supports P3 wide gamut colors with sRGB fallbacks.
 */

import type {
  OklchColor,
  RgbColor,
  HslColor,
  ColorGamut,
  GamutColor,
  ShadeConfig,
  TailwindShadeScale,
  ColorPalette,
  HarmonyPalette,
  PaletteOptions,
  ColorAdjustment,
  InterpolationOptions,
  ParsedColor,
  GamutMapResult,
  AccessibleColorSuggestion,
  ContrastPair,
} from "./types"

// =============================================================================
// Constants
// =============================================================================

/** Default shade configuration for Tailwind-style scales */
export const DEFAULT_SHADE_CONFIG: ShadeConfig = {
  count: 11,
  lightnessRange: [0.98, 0.1],
  chromaCurve: "ease",
  hueShift: 0,
}

/** Tailwind shade keys */
export const TAILWIND_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

/** Maximum chroma for common hues in sRGB gamut (approximate) */
const SRGB_MAX_CHROMA: Record<number, number> = {
  0: 0.25, // Red
  30: 0.22, // Orange
  60: 0.2, // Yellow
  90: 0.18, // Yellow-green
  120: 0.2, // Green
  150: 0.18, // Cyan-green
  180: 0.15, // Cyan
  210: 0.18, // Blue-cyan
  240: 0.25, // Blue
  270: 0.28, // Purple
  300: 0.28, // Magenta
  330: 0.27, // Pink
}

// =============================================================================
// Color Conversion: Linear RGB / sRGB
// =============================================================================

/**
 * Convert sRGB component to linear RGB
 */
function srgbToLinear(c: number): number {
  c = c / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/**
 * Convert linear RGB component to sRGB
 */
function linearToSrgb(c: number): number {
  const srgb = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
  return Math.round(Math.max(0, Math.min(255, srgb * 255)))
}

// =============================================================================
// Color Conversion: RGB <-> OKLab <-> OKLCH
// =============================================================================

/**
 * Convert linear RGB to OKLab
 */
function linearRgbToOklab(r: number, g: number, b: number): { L: number; a: number; b: number } {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b

  const lRoot = Math.cbrt(l)
  const mRoot = Math.cbrt(m)
  const sRoot = Math.cbrt(s)

  return {
    L: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  }
}

/**
 * Convert OKLab to linear RGB
 */
function oklabToLinearRgb(L: number, a: number, b: number): { r: number; g: number; b: number } {
  const lRoot = L + 0.3963377774 * a + 0.2158037573 * b
  const mRoot = L - 0.1055613458 * a - 0.0638541728 * b
  const sRoot = L - 0.0894841775 * a - 1.291485548 * b

  const l = lRoot * lRoot * lRoot
  const m = mRoot * mRoot * mRoot
  const s = sRoot * sRoot * sRoot

  return {
    r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  }
}

/**
 * Convert OKLab to OKLCH
 */
function oklabToOklch(L: number, a: number, b: number): OklchColor {
  const c = Math.sqrt(a * a + b * b)
  let h = Math.atan2(b, a) * (180 / Math.PI)
  if (h < 0) h += 360

  return { l: L, c, h }
}

/**
 * Convert OKLCH to OKLab
 */
function oklchToOklab(l: number, c: number, h: number): { L: number; a: number; b: number } {
  const hRad = (h * Math.PI) / 180
  return {
    L: l,
    a: c * Math.cos(hRad),
    b: c * Math.sin(hRad),
  }
}

// =============================================================================
// Public Conversion Functions
// =============================================================================

/**
 * Convert RGB to OKLCH
 */
export function rgbToOklch(rgb: RgbColor): OklchColor {
  const lr = srgbToLinear(rgb.r)
  const lg = srgbToLinear(rgb.g)
  const lb = srgbToLinear(rgb.b)

  const oklab = linearRgbToOklab(lr, lg, lb)
  const oklch = oklabToOklch(oklab.L, oklab.a, oklab.b)

  return {
    ...oklch,
    alpha: rgb.alpha,
  }
}

/**
 * Convert OKLCH to RGB
 */
export function oklchToRgb(oklch: OklchColor): RgbColor {
  const oklab = oklchToOklab(oklch.l, oklch.c, oklch.h)
  const linear = oklabToLinearRgb(oklab.L, oklab.a, oklab.b)

  return {
    r: linearToSrgb(linear.r),
    g: linearToSrgb(linear.g),
    b: linearToSrgb(linear.b),
    alpha: oklch.alpha,
  }
}

/**
 * Convert hex to OKLCH
 */
export function hexToOklch(hex: string): OklchColor | null {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(hex)
  if (!match) return null

  const rgb: RgbColor = {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
    alpha: match[4] ? parseInt(match[4], 16) / 255 : undefined,
  }

  return rgbToOklch(rgb)
}

/**
 * Convert OKLCH to hex
 */
export function oklchToHex(oklch: OklchColor): string {
  const rgb = oklchToRgb(oklch)
  const r = rgb.r.toString(16).padStart(2, "0")
  const g = rgb.g.toString(16).padStart(2, "0")
  const b = rgb.b.toString(16).padStart(2, "0")

  if (oklch.alpha !== undefined && oklch.alpha < 1) {
    const a = Math.round(oklch.alpha * 255)
      .toString(16)
      .padStart(2, "0")
    return `#${r}${g}${b}${a}`
  }

  return `#${r}${g}${b}`
}

/**
 * Convert HSL to OKLCH
 */
export function hslToOklch(hsl: HslColor): OklchColor {
  // Convert HSL to RGB first
  const h = hsl.h / 360
  const s = hsl.s / 100
  const l = hsl.l / 100

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

  return rgbToOklch({
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
    alpha: hsl.alpha,
  })
}

/**
 * Convert OKLCH to HSL
 */
export function oklchToHsl(oklch: OklchColor): HslColor {
  const rgb = oklchToRgb(oklch)
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255

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
    alpha: oklch.alpha,
  }
}

/**
 * Parse any color string to OKLCH
 */
export function parseColor(color: string): ParsedColor {
  const trimmed = color.trim().toLowerCase()

  // Hex format
  if (trimmed.startsWith("#")) {
    const oklch = hexToOklch(trimmed)
    return {
      original: color,
      format: "hex",
      oklch,
      valid: oklch !== null,
    }
  }

  // OKLCH format: oklch(L C H) or oklch(L C H / alpha)
  // Capture % with the number so we can check if it's a percentage
  const oklchMatch = trimmed.match(/oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)/)
  if (oklchMatch) {
    const lStr = oklchMatch[1]
    const l = parseFloat(lStr) / (lStr.includes("%") ? 100 : 1)
    const c = parseFloat(oklchMatch[2])
    const h = parseFloat(oklchMatch[3])
    const alpha = oklchMatch[4]
      ? parseFloat(oklchMatch[4]) / (oklchMatch[4].includes("%") ? 100 : 1)
      : undefined

    return {
      original: color,
      format: "oklch",
      oklch: { l: Math.min(1, l), c, h, alpha },
      valid: true,
    }
  }

  // RGB format
  const rgbMatch = trimmed.match(/rgba?\(\s*(\d+)\s*,?\s*(\d+)\s*,?\s*(\d+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/)
  if (rgbMatch) {
    const alpha = rgbMatch[4]
      ? parseFloat(rgbMatch[4]) / (rgbMatch[4].includes("%") ? 100 : 1)
      : undefined

    const oklch = rgbToOklch({
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3]),
      alpha,
    })

    return {
      original: color,
      format: "rgb",
      oklch,
      valid: true,
    }
  }

  // HSL format
  const hslMatch = trimmed.match(/hsla?\(\s*(\d+)\s*,?\s*(\d+)%\s*,?\s*(\d+)%(?:\s*[,/]\s*([\d.]+%?))?\s*\)/)
  if (hslMatch) {
    const alpha = hslMatch[4]
      ? parseFloat(hslMatch[4]) / (hslMatch[4].includes("%") ? 100 : 1)
      : undefined

    const oklch = hslToOklch({
      h: parseInt(hslMatch[1]),
      s: parseInt(hslMatch[2]),
      l: parseInt(hslMatch[3]),
      alpha,
    })

    return {
      original: color,
      format: "hsl",
      oklch,
      valid: true,
    }
  }

  return {
    original: color,
    format: "unknown",
    oklch: null,
    valid: false,
  }
}

// =============================================================================
// OKLCH String Formatting
// =============================================================================

/**
 * Format OKLCH color as CSS string
 */
export function formatOklch(color: OklchColor, precision: number = 3): string {
  const l = (color.l * 100).toFixed(precision)
  const c = color.c.toFixed(precision)
  const h = color.h.toFixed(precision)

  if (color.alpha !== undefined && color.alpha < 1) {
    return `oklch(${l}% ${c} ${h} / ${color.alpha.toFixed(precision)})`
  }

  return `oklch(${l}% ${c} ${h})`
}

/**
 * Format color for Tailwind CSS variable (space-separated)
 */
export function formatTailwindOklch(color: OklchColor, precision: number = 3): string {
  const l = (color.l * 100).toFixed(precision)
  const c = color.c.toFixed(precision)
  const h = color.h.toFixed(precision)

  return `${l}% ${c} ${h}`
}

// =============================================================================
// Gamut Mapping
// =============================================================================

/**
 * Get unclamped linear RGB values (for gamut checking)
 */
function getLinearRgb(oklch: OklchColor): { r: number; g: number; b: number } {
  const oklab = oklchToOklab(oklch.l, oklch.c, oklch.h)
  return oklabToLinearRgb(oklab.L, oklab.a, oklab.b)
}

/**
 * Check if color is within sRGB gamut
 * Uses unclamped linear RGB to detect out-of-gamut colors
 */
export function isInSrgbGamut(oklch: OklchColor): boolean {
  const linear = getLinearRgb(oklch)
  // Check if linear RGB values are in valid range [0, 1] before gamma correction
  return linear.r >= 0 && linear.r <= 1 && linear.g >= 0 && linear.g <= 1 && linear.b >= 0 && linear.b <= 1
}

/**
 * Get approximate maximum chroma for a hue in sRGB
 */
export function getMaxChroma(hue: number, lightness: number): number {
  // Chroma depends on both hue and lightness
  // At L=0 or L=1, chroma must be 0
  const lightnessMultiplier = 4 * lightness * (1 - lightness)

  // Get base chroma for hue (interpolate between known values)
  const hueNormalized = ((hue % 360) + 360) % 360
  const hueIndex = Math.floor(hueNormalized / 30) * 30
  const nextHueIndex = (hueIndex + 30) % 360
  const hueFraction = (hueNormalized - hueIndex) / 30

  const baseChroma =
    (SRGB_MAX_CHROMA[hueIndex] || 0.2) * (1 - hueFraction) +
    (SRGB_MAX_CHROMA[nextHueIndex] || 0.2) * hueFraction

  return baseChroma * lightnessMultiplier
}

/**
 * Map color to sRGB gamut
 */
export function mapToGamut(oklch: OklchColor, gamut: ColorGamut = "srgb"): GamutMapResult {
  if (gamut === "srgb" && isInSrgbGamut(oklch)) {
    return {
      original: oklch,
      mapped: oklch,
      wasMapped: false,
    }
  }

  // Binary search for maximum in-gamut chroma
  let low = 0
  let high = oklch.c
  let mapped = { ...oklch, c: 0 }

  while (high - low > 0.001) {
    const mid = (low + high) / 2
    const test = { ...oklch, c: mid }

    if (isInSrgbGamut(test)) {
      low = mid
      mapped = test
    } else {
      high = mid
    }
  }

  return {
    original: oklch,
    mapped,
    wasMapped: true,
    deltaE: oklch.c - mapped.c,
  }
}

/**
 * Create gamut-aware color
 */
export function createGamutColor(oklch: OklchColor, gamut: ColorGamut = "srgb"): GamutColor {
  const inGamut = gamut === "srgb" ? isInSrgbGamut(oklch) : true

  return {
    ...oklch,
    gamut,
    inGamut,
    fallback: inGamut ? undefined : oklchToHex(mapToGamut(oklch).mapped),
  }
}

// =============================================================================
// Color Manipulation
// =============================================================================

/**
 * Adjust color properties
 */
export function adjustColor(color: OklchColor, adjustment: ColorAdjustment): OklchColor {
  return {
    l: Math.max(0, Math.min(1, color.l + (adjustment.lightness || 0))),
    c: Math.max(0, color.c + (adjustment.chroma || 0)),
    h: ((color.h + (adjustment.hue || 0)) % 360 + 360) % 360,
    alpha:
      adjustment.alpha !== undefined
        ? Math.max(0, Math.min(1, (color.alpha || 1) + adjustment.alpha))
        : color.alpha,
  }
}

/**
 * Lighten a color
 */
export function lighten(color: OklchColor, amount: number): OklchColor {
  return adjustColor(color, { lightness: amount })
}

/**
 * Darken a color
 */
export function darken(color: OklchColor, amount: number): OklchColor {
  return adjustColor(color, { lightness: -amount })
}

/**
 * Saturate (increase chroma)
 */
export function saturate(color: OklchColor, amount: number): OklchColor {
  return adjustColor(color, { chroma: amount })
}

/**
 * Desaturate (decrease chroma)
 */
export function desaturate(color: OklchColor, amount: number): OklchColor {
  return adjustColor(color, { chroma: -amount })
}

/**
 * Rotate hue
 */
export function rotateHue(color: OklchColor, degrees: number): OklchColor {
  return adjustColor(color, { hue: degrees })
}

/**
 * Mix two colors
 */
export function mixColors(color1: OklchColor, color2: OklchColor, ratio: number = 0.5): OklchColor {
  const r = Math.max(0, Math.min(1, ratio))

  // Handle hue interpolation (shortest path)
  let h1 = color1.h
  let h2 = color2.h
  const hueDiff = h2 - h1

  if (Math.abs(hueDiff) > 180) {
    if (hueDiff > 0) {
      h1 += 360
    } else {
      h2 += 360
    }
  }

  const mixedHue = ((h1 * (1 - r) + h2 * r) % 360 + 360) % 360

  return {
    l: color1.l * (1 - r) + color2.l * r,
    c: color1.c * (1 - r) + color2.c * r,
    h: mixedHue,
    alpha:
      color1.alpha !== undefined || color2.alpha !== undefined
        ? (color1.alpha || 1) * (1 - r) + (color2.alpha || 1) * r
        : undefined,
  }
}

/**
 * Interpolate between colors
 */
export function interpolateColors(
  color1: OklchColor,
  color2: OklchColor,
  options: InterpolationOptions
): OklchColor[] {
  const { steps, method = "linear" } = options
  const result: OklchColor[] = []

  for (let i = 0; i < steps; i++) {
    let t = i / (steps - 1)

    // Apply easing
    switch (method) {
      case "ease":
        t = t * t * (3 - 2 * t)
        break
      case "ease-in":
        t = t * t
        break
      case "ease-out":
        t = t * (2 - t)
        break
      case "ease-in-out":
        t = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
        break
    }

    result.push(mixColors(color1, color2, t))
  }

  return result
}

// =============================================================================
// Shade Generation
// =============================================================================

/**
 * Generate shade scale from base color
 */
export function generateShadeScale(
  baseColor: OklchColor,
  config: Partial<ShadeConfig> = {}
): TailwindShadeScale {
  const { lightnessRange = [0.98, 0.1], chromaCurve = "ease", hueShift = 0 } = config

  const shades: Partial<TailwindShadeScale> = {}
  const [lightMax, lightMin] = lightnessRange

  for (let i = 0; i < TAILWIND_SHADES.length; i++) {
    const shade = TAILWIND_SHADES[i]
    let t = i / (TAILWIND_SHADES.length - 1)

    // Apply curve
    switch (chromaCurve) {
      case "ease":
        t = t * t * (3 - 2 * t)
        break
      case "ease-in":
        t = t * t
        break
      case "ease-out":
        t = t * (2 - t)
        break
    }

    const lightness = lightMax - t * (lightMax - lightMin)

    // Chroma peaks around middle lightness values
    const chromaMultiplier = 4 * lightness * (1 - lightness)
    const chroma = baseColor.c * chromaMultiplier * 1.5

    // Slight hue shift for more natural palettes
    const hue = (baseColor.h + hueShift * (t - 0.5)) % 360

    shades[shade] = {
      l: lightness,
      c: Math.max(0, chroma),
      h: hue < 0 ? hue + 360 : hue,
    }
  }

  return shades as TailwindShadeScale
}

// =============================================================================
// Palette Generation
// =============================================================================

/**
 * Generate CSS for a color palette
 */
function generatePaletteCss(
  name: string,
  shades: TailwindShadeScale,
  options: PaletteOptions
): string {
  const { prefix = "--", format = "oklch" } = options
  const lines: string[] = []

  for (const shade of TAILWIND_SHADES) {
    const color = shades[shade]
    let value: string

    switch (format) {
      case "hsl": {
        const hsl = oklchToHsl(color)
        value = `${hsl.h} ${hsl.s}% ${hsl.l}%`
        break
      }
      case "rgb": {
        const rgb = oklchToRgb(color)
        value = `${rgb.r} ${rgb.g} ${rgb.b}`
        break
      }
      case "hex":
        value = oklchToHex(color)
        break
      default:
        value = formatTailwindOklch(color)
    }

    lines.push(`${prefix}${name}-${shade}: ${value};`)
  }

  return lines.join("\n")
}

/**
 * Generate a color palette from any color input
 */
export function generatePalette(
  color: string | OklchColor,
  options: PaletteOptions
): ColorPalette {
  let baseColor: OklchColor

  if (typeof color === "string") {
    const parsed = parseColor(color)
    if (!parsed.valid || !parsed.oklch) {
      throw new Error(`Invalid color: ${color}`)
    }
    baseColor = parsed.oklch
  } else {
    baseColor = color
  }

  // Ensure base color is vivid enough for palette generation
  if (baseColor.c < 0.05) {
    baseColor = { ...baseColor, c: 0.1 }
  }

  const shades = generateShadeScale(baseColor, options.shades)
  const css = generatePaletteCss(options.name, shades, options)

  return {
    name: options.name,
    base: baseColor,
    shades,
    mode: options.mode || "monochromatic",
    css,
  }
}

/**
 * Generate complementary palette (180° apart)
 */
export function generateComplementaryPalette(
  color: string | OklchColor,
  options: PaletteOptions
): HarmonyPalette {
  const primary = generatePalette(color, { ...options, name: `${options.name}-primary` })
  const complement = rotateHue(primary.base, 180)
  const secondary = generatePalette(complement, { ...options, name: `${options.name}-secondary` })

  return {
    name: options.name,
    harmony: "complementary",
    primary,
    secondary: [secondary],
    css: `/* ${options.name} Complementary Palette */\n${primary.css}\n\n${secondary.css}`,
  }
}

/**
 * Generate analogous palette (30° apart)
 */
export function generateAnalogousPalette(
  color: string | OklchColor,
  options: PaletteOptions
): HarmonyPalette {
  const primary = generatePalette(color, { ...options, name: `${options.name}-primary` })

  const analog1 = rotateHue(primary.base, -30)
  const analog2 = rotateHue(primary.base, 30)

  const secondary1 = generatePalette(analog1, { ...options, name: `${options.name}-secondary-1` })
  const secondary2 = generatePalette(analog2, { ...options, name: `${options.name}-secondary-2` })

  return {
    name: options.name,
    harmony: "analogous",
    primary,
    secondary: [secondary1, secondary2],
    css: `/* ${options.name} Analogous Palette */\n${primary.css}\n\n${secondary1.css}\n\n${secondary2.css}`,
  }
}

/**
 * Generate triadic palette (120° apart)
 */
export function generateTriadicPalette(
  color: string | OklchColor,
  options: PaletteOptions
): HarmonyPalette {
  const primary = generatePalette(color, { ...options, name: `${options.name}-primary` })

  const triad1 = rotateHue(primary.base, 120)
  const triad2 = rotateHue(primary.base, 240)

  const secondary1 = generatePalette(triad1, { ...options, name: `${options.name}-secondary-1` })
  const secondary2 = generatePalette(triad2, { ...options, name: `${options.name}-secondary-2` })

  return {
    name: options.name,
    harmony: "triadic",
    primary,
    secondary: [secondary1, secondary2],
    css: `/* ${options.name} Triadic Palette */\n${primary.css}\n\n${secondary1.css}\n\n${secondary2.css}`,
  }
}

/**
 * Generate split-complementary palette
 */
export function generateSplitComplementaryPalette(
  color: string | OklchColor,
  options: PaletteOptions
): HarmonyPalette {
  const primary = generatePalette(color, { ...options, name: `${options.name}-primary` })

  const split1 = rotateHue(primary.base, 150)
  const split2 = rotateHue(primary.base, 210)

  const secondary1 = generatePalette(split1, { ...options, name: `${options.name}-secondary-1` })
  const secondary2 = generatePalette(split2, { ...options, name: `${options.name}-secondary-2` })

  return {
    name: options.name,
    harmony: "split-complementary",
    primary,
    secondary: [secondary1, secondary2],
    css: `/* ${options.name} Split-Complementary Palette */\n${primary.css}\n\n${secondary1.css}\n\n${secondary2.css}`,
  }
}

/**
 * Generate tetradic palette (90° apart)
 */
export function generateTetradicPalette(
  color: string | OklchColor,
  options: PaletteOptions
): HarmonyPalette {
  const primary = generatePalette(color, { ...options, name: `${options.name}-primary` })

  const tetra1 = rotateHue(primary.base, 90)
  const tetra2 = rotateHue(primary.base, 180)
  const tetra3 = rotateHue(primary.base, 270)

  const secondary1 = generatePalette(tetra1, { ...options, name: `${options.name}-secondary-1` })
  const secondary2 = generatePalette(tetra2, { ...options, name: `${options.name}-secondary-2` })
  const secondary3 = generatePalette(tetra3, { ...options, name: `${options.name}-secondary-3` })

  return {
    name: options.name,
    harmony: "tetradic",
    primary,
    secondary: [secondary1, secondary2, secondary3],
    css: `/* ${options.name} Tetradic Palette */\n${primary.css}\n\n${secondary1.css}\n\n${secondary2.css}\n\n${secondary3.css}`,
  }
}

// =============================================================================
// Accessibility
// =============================================================================

/**
 * Calculate contrast ratio between two OKLCH colors
 */
export function calculateContrastRatio(color1: OklchColor, color2: OklchColor): number {
  const rgb1 = oklchToRgb(color1)
  const rgb2 = oklchToRgb(color2)

  const luminance = (r: number, g: number, b: number): number => {
    const [rs, gs, bs] = [r, g, b].map((c) => {
      c /= 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
  }

  const l1 = luminance(rgb1.r, rgb1.g, rgb1.b)
  const l2 = luminance(rgb2.r, rgb2.g, rgb2.b)

  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Check WCAG contrast compliance
 */
export function checkContrast(foreground: OklchColor, background: OklchColor): ContrastPair {
  const ratio = calculateContrastRatio(foreground, background)

  return {
    foreground,
    background,
    ratio: Math.round(ratio * 100) / 100,
    wcag: {
      aa: ratio >= 4.5,
      aaLarge: ratio >= 3,
      aaa: ratio >= 7,
      aaaLarge: ratio >= 4.5,
    },
  }
}

/**
 * Find accessible foreground color
 */
export function findAccessibleColor(
  background: OklchColor,
  targetRatio: number = 4.5
): AccessibleColorSuggestion {
  // Try light text first
  const lightText: OklchColor = { l: 1, c: 0, h: 0 }
  const lightRatio = calculateContrastRatio(lightText, background)

  if (lightRatio >= targetRatio) {
    return {
      original: background,
      suggested: lightText,
      contrastRatio: lightRatio,
      adjustment: "lighten",
    }
  }

  // Try dark text
  const darkText: OklchColor = { l: 0, c: 0, h: 0 }
  const darkRatio = calculateContrastRatio(darkText, background)

  if (darkRatio >= targetRatio) {
    return {
      original: background,
      suggested: darkText,
      contrastRatio: darkRatio,
      adjustment: "darken",
    }
  }

  // Return the better option even if not meeting target
  if (lightRatio > darkRatio) {
    return {
      original: background,
      suggested: lightText,
      contrastRatio: lightRatio,
      adjustment: "lighten",
    }
  }

  return {
    original: background,
    suggested: darkText,
    contrastRatio: darkRatio,
    adjustment: "darken",
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create palette generator with default options
 */
export function createPaletteGenerator(defaultOptions: Partial<PaletteOptions> = {}) {
  return {
    generate: (color: string | OklchColor, options: Partial<PaletteOptions> = {}) =>
      generatePalette(color, { name: "color", ...defaultOptions, ...options }),

    complementary: (color: string | OklchColor, options: Partial<PaletteOptions> = {}) =>
      generateComplementaryPalette(color, { name: "palette", ...defaultOptions, ...options }),

    analogous: (color: string | OklchColor, options: Partial<PaletteOptions> = {}) =>
      generateAnalogousPalette(color, { name: "palette", ...defaultOptions, ...options }),

    triadic: (color: string | OklchColor, options: Partial<PaletteOptions> = {}) =>
      generateTriadicPalette(color, { name: "palette", ...defaultOptions, ...options }),

    splitComplementary: (color: string | OklchColor, options: Partial<PaletteOptions> = {}) =>
      generateSplitComplementaryPalette(color, { name: "palette", ...defaultOptions, ...options }),

    tetradic: (color: string | OklchColor, options: Partial<PaletteOptions> = {}) =>
      generateTetradicPalette(color, { name: "palette", ...defaultOptions, ...options }),
  }
}
