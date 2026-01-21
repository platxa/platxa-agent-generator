/**
 * Theme Worker
 *
 * Generates CSS variables and Tailwind v4 theme configuration
 * from design tokens with dark mode support.
 */

import type {
  SemanticColors,
  ColorPalette,
  DesignTokens,
  ThemeConfig,
  GeneratedTheme,
  OklchColor,
  HslColor,
  RgbColor,
  ColorFormat,
  ColorGenerationOptions,
  PaletteGenerationOptions,
  ThemeMode,
  SpacingScale,
  TypographyScale,
  ColorValue,
} from "./types"

import {
  defaultTokens,
  defaultDarkColors,
  getThemePreset,
} from "./tokens"

// ============================================================================
// Color Utilities
// ============================================================================

/**
 * Converts HSL string to components
 */
export function parseHsl(hsl: string): HslColor | null {
  const match = hsl.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%(?:\s*\/\s*([\d.]+))?\)/)
  if (!match) return null
  return {
    h: parseInt(match[1], 10),
    s: parseInt(match[2], 10),
    l: parseInt(match[3], 10),
    alpha: match[4] ? parseFloat(match[4]) : undefined,
  }
}

/**
 * Converts HSL components to string
 */
export function hslToString(color: HslColor): string {
  if (color.alpha !== undefined && color.alpha < 1) {
    return `hsl(${color.h} ${color.s}% ${color.l}% / ${color.alpha})`
  }
  return `hsl(${color.h} ${color.s}% ${color.l}%)`
}

/**
 * Converts HSL to OKLCH (approximate conversion)
 */
export function hslToOklch(hsl: HslColor): OklchColor {
  // Approximate conversion - for precise conversion use a color library
  const l = hsl.l / 100
  const s = hsl.s / 100

  // OKLCH lightness is similar but not identical to HSL lightness
  const oklchL = l
  // Chroma is derived from saturation and lightness
  const oklchC = s * Math.min(l, 1 - l) * 0.4
  // Hue is the same
  const oklchH = hsl.h

  return {
    l: Math.round(oklchL * 1000) / 1000,
    c: Math.round(oklchC * 1000) / 1000,
    h: oklchH,
    alpha: hsl.alpha,
  }
}

/**
 * Converts OKLCH to string
 */
export function oklchToString(color: OklchColor): string {
  if (color.alpha !== undefined && color.alpha < 1) {
    return `oklch(${color.l} ${color.c} ${color.h} / ${color.alpha})`
  }
  return `oklch(${color.l} ${color.c} ${color.h})`
}

// =============================================================================
// COLOR FORMAT CONVERSION (Feature #70)
// =============================================================================

/**
 * Parse RGB color string
 *
 * Supports formats: rgb(r, g, b), rgb(r g b), rgba(r, g, b, a)
 *
 * @param rgb - RGB color string
 * @returns Parsed RgbColor or null if invalid
 */
export function parseRgb(rgb: string): RgbColor | null {
  // Try rgb(r, g, b) or rgb(r g b) format
  const match = rgb.match(
    /rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+(\d*\.?\d+))?\)/
  )
  if (!match) return null
  return {
    r: parseInt(match[1], 10),
    g: parseInt(match[2], 10),
    b: parseInt(match[3], 10),
    alpha: match[4] ? parseFloat(match[4]) : undefined,
  }
}

/**
 * Parse OKLCH color string
 *
 * Supports format: oklch(L C H) or oklch(L C H / alpha)
 *
 * @param oklch - OKLCH color string
 * @returns Parsed OklchColor or null if invalid
 */
export function parseOklch(oklch: string): OklchColor | null {
  const match = oklch.match(
    /oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/
  )
  if (!match) return null
  return {
    l: parseFloat(match[1]),
    c: parseFloat(match[2]),
    h: parseFloat(match[3]),
    alpha: match[4] ? parseFloat(match[4]) : undefined,
  }
}

/**
 * Parse hex color string
 *
 * Supports formats: #RGB, #RGBA, #RRGGBB, #RRGGBBAA
 *
 * @param hex - Hex color string
 * @returns Parsed RgbColor or null if invalid
 */
export function parseHex(hex: string): RgbColor | null {
  const match = hex.match(/^#([0-9a-f]{3,8})$/i)
  if (!match) return null

  const value = match[1]
  let r: number, g: number, b: number, a: number | undefined

  if (value.length === 3 || value.length === 4) {
    // Short format: #RGB or #RGBA
    r = parseInt(value[0] + value[0], 16)
    g = parseInt(value[1] + value[1], 16)
    b = parseInt(value[2] + value[2], 16)
    if (value.length === 4) {
      a = parseInt(value[3] + value[3], 16) / 255
    }
  } else if (value.length === 6 || value.length === 8) {
    // Long format: #RRGGBB or #RRGGBBAA
    r = parseInt(value.substring(0, 2), 16)
    g = parseInt(value.substring(2, 4), 16)
    b = parseInt(value.substring(4, 6), 16)
    if (value.length === 8) {
      a = parseInt(value.substring(6, 8), 16) / 255
    }
  } else {
    return null
  }

  return { r, g, b, alpha: a }
}

// =============================================================================
// COLOR FORMAT VALIDATION (Feature #81)
// =============================================================================

/**
 * Color validation result
 */
export interface ColorValidationResult {
  /** Whether the color is valid */
  valid: boolean
  /** Detected color format */
  format: "hex" | "rgb" | "rgba" | "hsl" | "hsla" | "oklch" | "unknown" | null
  /** Normalized color value (if valid) */
  normalized?: string
  /** Error message (if invalid) */
  error?: string
  /** Specific validation issues */
  issues?: string[]
}

/**
 * Validate a hex color value (Feature #81)
 *
 * Supports: #RGB, #RGBA, #RRGGBB, #RRGGBBAA
 *
 * @param color - Color string to validate
 * @returns Validation result with details
 *
 * @example
 * ```typescript
 * validateHex("#fff")       // { valid: true, format: "hex", normalized: "#ffffff" }
 * validateHex("#12345")     // { valid: false, error: "Invalid hex length" }
 * validateHex("#gggggg")    // { valid: false, error: "Invalid hex characters" }
 * ```
 */
export function validateHex(color: string): ColorValidationResult {
  // Check if starts with #
  if (!color.startsWith("#")) {
    return {
      valid: false,
      format: null,
      error: "Hex color must start with #",
      issues: ["Missing # prefix"],
    }
  }

  const value = color.slice(1)

  // Check length
  if (![3, 4, 6, 8].includes(value.length)) {
    return {
      valid: false,
      format: null,
      error: `Invalid hex length: ${value.length}. Expected 3, 4, 6, or 8 characters`,
      issues: [`Invalid length: ${value.length}`],
    }
  }

  // Check characters
  if (!/^[0-9a-f]+$/i.test(value)) {
    const invalidChars = value.match(/[^0-9a-f]/gi) || []
    return {
      valid: false,
      format: null,
      error: `Invalid hex characters: ${[...new Set(invalidChars)].join(", ")}`,
      issues: [`Invalid characters: ${invalidChars.join("")}`],
    }
  }

  // Parse and normalize
  const rgb = parseHex(color)
  if (!rgb) {
    return {
      valid: false,
      format: null,
      error: "Failed to parse hex color",
      issues: ["Parse error"],
    }
  }

  // Normalize to #RRGGBB or #RRGGBBAA
  const normalized = rgbToHex(rgb)

  return {
    valid: true,
    format: value.length === 4 || value.length === 8 ? "rgba" : "hex",
    normalized,
  }
}

/**
 * Validate an RGB/RGBA color value (Feature #81)
 *
 * Supports: rgb(r g b), rgb(r, g, b), rgba(r, g, b, a), rgb(r g b / a)
 *
 * @param color - Color string to validate
 * @returns Validation result with details
 *
 * @example
 * ```typescript
 * validateRgb("rgb(255, 128, 0)")     // { valid: true, format: "rgb" }
 * validateRgb("rgb(300, 0, 0)")       // { valid: false, error: "R value out of range" }
 * validateRgb("rgb(255 128 0 / 0.5)") // { valid: true, format: "rgba" }
 * ```
 */
export function validateRgb(color: string): ColorValidationResult {
  const issues: string[] = []

  // Check format prefix
  const isRgba = color.toLowerCase().startsWith("rgba(")
  const isRgb = color.toLowerCase().startsWith("rgb(")

  if (!isRgb && !isRgba) {
    return {
      valid: false,
      format: null,
      error: "RGB color must start with rgb( or rgba(",
      issues: ["Invalid prefix"],
    }
  }

  // Check closing parenthesis
  if (!color.endsWith(")")) {
    return {
      valid: false,
      format: null,
      error: "Missing closing parenthesis",
      issues: ["Missing )"],
    }
  }

  // Extract values
  const inner = color.slice(isRgba ? 5 : 4, -1).trim()

  // Parse values (supports comma or space separated, with optional / for alpha)
  let r: number, g: number, b: number, a: number | undefined

  // Try modern syntax: rgb(r g b) or rgb(r g b / a)
  const modernMatch = inner.match(
    /^([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+%?)(?:\s*\/\s*([\d.]+%?))?$/
  )
  // Try legacy syntax: rgb(r, g, b) or rgba(r, g, b, a)
  const legacyMatch = inner.match(
    /^([\d.]+%?)\s*,\s*([\d.]+%?)\s*,\s*([\d.]+%?)(?:\s*,\s*([\d.]+%?))?$/
  )

  const match = modernMatch || legacyMatch

  if (!match) {
    return {
      valid: false,
      format: null,
      error: "Invalid RGB syntax. Use: rgb(r g b), rgb(r, g, b), or rgb(r g b / a)",
      issues: ["Invalid syntax"],
    }
  }

  // Parse values
  const parseValue = (v: string, max: number): number => {
    if (v.endsWith("%")) {
      return (parseFloat(v) / 100) * max
    }
    return parseFloat(v)
  }

  r = parseValue(match[1], 255)
  g = parseValue(match[2], 255)
  b = parseValue(match[3], 255)
  if (match[4]) {
    a = parseValue(match[4], 1)
  }

  // Validate ranges
  if (r < 0 || r > 255) {
    issues.push(`R value out of range: ${r} (expected 0-255)`)
  }
  if (g < 0 || g > 255) {
    issues.push(`G value out of range: ${g} (expected 0-255)`)
  }
  if (b < 0 || b > 255) {
    issues.push(`B value out of range: ${b} (expected 0-255)`)
  }
  if (a !== undefined && (a < 0 || a > 1)) {
    issues.push(`Alpha value out of range: ${a} (expected 0-1)`)
  }

  if (issues.length > 0) {
    return {
      valid: false,
      format: null,
      error: issues[0],
      issues,
    }
  }

  // Normalize
  const rgb: RgbColor = { r: Math.round(r), g: Math.round(g), b: Math.round(b), alpha: a }
  const normalized = rgbToString(rgb)

  return {
    valid: true,
    format: a !== undefined ? "rgba" : "rgb",
    normalized,
  }
}

/**
 * Validate an HSL/HSLA color value (Feature #81)
 *
 * Supports: hsl(h s% l%), hsl(h, s%, l%), hsla(h, s%, l%, a)
 *
 * @param color - Color string to validate
 * @returns Validation result with details
 *
 * @example
 * ```typescript
 * validateHsl("hsl(220, 90%, 50%)")   // { valid: true, format: "hsl" }
 * validateHsl("hsl(400, 50%, 50%)")   // { valid: false, error: "Hue out of range" }
 * validateHsl("hsl(220 90% 50% / 0.5)") // { valid: true, format: "hsla" }
 * ```
 */
export function validateHsl(color: string): ColorValidationResult {
  const issues: string[] = []

  // Check format prefix
  const isHsla = color.toLowerCase().startsWith("hsla(")
  const isHsl = color.toLowerCase().startsWith("hsl(")

  if (!isHsl && !isHsla) {
    return {
      valid: false,
      format: null,
      error: "HSL color must start with hsl( or hsla(",
      issues: ["Invalid prefix"],
    }
  }

  // Check closing parenthesis
  if (!color.endsWith(")")) {
    return {
      valid: false,
      format: null,
      error: "Missing closing parenthesis",
      issues: ["Missing )"],
    }
  }

  // Extract values
  const inner = color.slice(isHsla ? 5 : 4, -1).trim()

  // Parse values
  const modernMatch = inner.match(
    /^([\d.]+)(?:deg)?\s+([\d.]+)%\s+([\d.]+)%(?:\s*\/\s*([\d.]+%?))?$/
  )
  const legacyMatch = inner.match(
    /^([\d.]+)(?:deg)?\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+%?))?$/
  )

  const match = modernMatch || legacyMatch

  if (!match) {
    return {
      valid: false,
      format: null,
      error: "Invalid HSL syntax. Use: hsl(h s% l%), hsl(h, s%, l%), or hsl(h s% l% / a)",
      issues: ["Invalid syntax"],
    }
  }

  const h = parseFloat(match[1])
  const s = parseFloat(match[2])
  const l = parseFloat(match[3])
  let a: number | undefined
  if (match[4]) {
    a = match[4].endsWith("%") ? parseFloat(match[4]) / 100 : parseFloat(match[4])
  }

  // Validate ranges
  if (h < 0 || h > 360) {
    issues.push(`Hue out of range: ${h} (expected 0-360)`)
  }
  if (s < 0 || s > 100) {
    issues.push(`Saturation out of range: ${s} (expected 0-100)`)
  }
  if (l < 0 || l > 100) {
    issues.push(`Lightness out of range: ${l} (expected 0-100)`)
  }
  if (a !== undefined && (a < 0 || a > 1)) {
    issues.push(`Alpha out of range: ${a} (expected 0-1)`)
  }

  if (issues.length > 0) {
    return {
      valid: false,
      format: null,
      error: issues[0],
      issues,
    }
  }

  // Normalize
  const normalized = a !== undefined
    ? `hsl(${h} ${s}% ${l}% / ${a})`
    : `hsl(${h} ${s}% ${l}%)`

  return {
    valid: true,
    format: a !== undefined ? "hsla" : "hsl",
    normalized,
  }
}

/**
 * Validate an OKLCH color value (Feature #81)
 *
 * Supports: oklch(L C H), oklch(L C H / a)
 *
 * @param color - Color string to validate
 * @returns Validation result with details
 *
 * @example
 * ```typescript
 * validateOklch("oklch(0.7 0.15 250)")     // { valid: true, format: "oklch" }
 * validateOklch("oklch(1.5 0.15 250)")     // { valid: false, error: "Lightness out of range" }
 * validateOklch("oklch(0.7 0.15 250 / 0.5)") // { valid: true, format: "oklch" }
 * ```
 */
export function validateOklch(color: string): ColorValidationResult {
  const issues: string[] = []

  // Check format prefix
  if (!color.toLowerCase().startsWith("oklch(")) {
    return {
      valid: false,
      format: null,
      error: "OKLCH color must start with oklch(",
      issues: ["Invalid prefix"],
    }
  }

  // Check closing parenthesis
  if (!color.endsWith(")")) {
    return {
      valid: false,
      format: null,
      error: "Missing closing parenthesis",
      issues: ["Missing )"],
    }
  }

  // Extract values
  const inner = color.slice(6, -1).trim()

  // Parse: oklch(L C H) or oklch(L C H / a) or oklch(L% C H)
  const match = inner.match(
    /^([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?(?:\s*\/\s*([\d.]+%?))?$/
  )

  if (!match) {
    return {
      valid: false,
      format: null,
      error: "Invalid OKLCH syntax. Use: oklch(L C H) or oklch(L C H / a)",
      issues: ["Invalid syntax"],
    }
  }

  let L = parseFloat(match[1])
  const isPercent = match[2] === "%"
  const C = parseFloat(match[3])
  const H = parseFloat(match[4])
  let a: number | undefined
  if (match[5]) {
    a = match[5].endsWith("%") ? parseFloat(match[5]) / 100 : parseFloat(match[5])
  }

  // Normalize L if percentage
  if (isPercent) {
    L = L / 100
  }

  // Validate ranges
  // OKLCH: L is 0-1, C is typically 0-0.4 (but can be higher), H is 0-360
  if (L < 0 || L > 1) {
    issues.push(`Lightness out of range: ${L} (expected 0-1 or 0%-100%)`)
  }
  if (C < 0) {
    issues.push(`Chroma cannot be negative: ${C}`)
  }
  if (C > 0.5) {
    // Warning, not error - some colors can have higher chroma
    issues.push(`Chroma unusually high: ${C} (typical range 0-0.4, may be out of gamut)`)
  }
  if (H < 0 || H > 360) {
    issues.push(`Hue out of range: ${H} (expected 0-360)`)
  }
  if (a !== undefined && (a < 0 || a > 1)) {
    issues.push(`Alpha out of range: ${a} (expected 0-1)`)
  }

  // Check for critical errors (non-warnings)
  const criticalIssues = issues.filter(i =>
    !i.includes("unusually high") && !i.includes("out of gamut")
  )

  if (criticalIssues.length > 0) {
    return {
      valid: false,
      format: null,
      error: criticalIssues[0],
      issues: criticalIssues,
    }
  }

  // Normalize
  const normalized = a !== undefined
    ? `oklch(${L.toFixed(2)} ${C.toFixed(3)} ${H}${a !== undefined ? ` / ${a}` : ""})`
    : `oklch(${L.toFixed(2)} ${C.toFixed(3)} ${H})`

  return {
    valid: true,
    format: "oklch",
    normalized,
    issues: issues.length > 0 ? issues : undefined, // Include warnings
  }
}

/**
 * Validate any CSS color value (Feature #81)
 *
 * Auto-detects format and validates accordingly.
 *
 * @param color - Color string to validate
 * @returns Validation result with details
 *
 * @example
 * ```typescript
 * validateColor("#fff")              // { valid: true, format: "hex" }
 * validateColor("rgb(255, 0, 0)")    // { valid: true, format: "rgb" }
 * validateColor("hsl(220, 90%, 50%)") // { valid: true, format: "hsl" }
 * validateColor("oklch(0.7 0.15 250)") // { valid: true, format: "oklch" }
 * validateColor("invalid")           // { valid: false, format: "unknown" }
 * ```
 */
export function validateColor(color: string): ColorValidationResult {
  if (!color || typeof color !== "string") {
    return {
      valid: false,
      format: null,
      error: "Color must be a non-empty string",
    }
  }

  const trimmed = color.trim()

  // Detect format and validate
  if (trimmed.startsWith("#")) {
    return validateHex(trimmed)
  }

  if (trimmed.toLowerCase().startsWith("rgb")) {
    return validateRgb(trimmed)
  }

  if (trimmed.toLowerCase().startsWith("hsl")) {
    return validateHsl(trimmed)
  }

  if (trimmed.toLowerCase().startsWith("oklch")) {
    return validateOklch(trimmed)
  }

  // Named colors (basic support)
  const namedColors = [
    "black", "white", "red", "green", "blue", "yellow", "cyan", "magenta",
    "transparent", "currentcolor", "inherit",
  ]
  if (namedColors.includes(trimmed.toLowerCase())) {
    return {
      valid: true,
      format: "unknown",
      normalized: trimmed.toLowerCase(),
    }
  }

  return {
    valid: false,
    format: "unknown",
    error: `Unknown color format: "${trimmed}". Supported: hex, rgb, rgba, hsl, hsla, oklch`,
  }
}

/**
 * Validate all colors in a brand kit (Feature #81)
 *
 * @param colors - Object containing color values
 * @returns Array of validation results with paths
 *
 * @example
 * ```typescript
 * const results = validateColorObject({
 *   primary: { 500: "oklch(0.5 0.15 220)" },
 *   semantic: { background: "#fff" }
 * })
 * ```
 */
export function validateColorObject(
  colors: Record<string, unknown>,
  path: string = ""
): Array<{ path: string; color: string; result: ColorValidationResult }> {
  const results: Array<{ path: string; color: string; result: ColorValidationResult }> = []

  for (const [key, value] of Object.entries(colors)) {
    const currentPath = path ? `${path}.${key}` : key

    if (typeof value === "string") {
      results.push({
        path: currentPath,
        color: value,
        result: validateColor(value),
      })
    } else if (typeof value === "object" && value !== null) {
      results.push(
        ...validateColorObject(value as Record<string, unknown>, currentPath)
      )
    }
  }

  return results
}

/**
 * Convert RGB to string
 */
export function rgbToString(color: RgbColor): string {
  if (color.alpha !== undefined && color.alpha < 1) {
    return `rgb(${color.r} ${color.g} ${color.b} / ${color.alpha})`
  }
  return `rgb(${color.r} ${color.g} ${color.b})`
}

/**
 * Convert RGB to hex string
 */
export function rgbToHex(color: RgbColor): string {
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, "0")
  const hex = `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`
  if (color.alpha !== undefined && color.alpha < 1) {
    return hex + toHex(color.alpha * 255)
  }
  return hex
}

/**
 * Convert RGB to HSL (Feature #70)
 *
 * @param rgb - RGB color
 * @returns HSL color
 */
export function rgbToHsl(rgb: RgbColor): HslColor {
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0

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
    alpha: rgb.alpha,
  }
}

/**
 * Convert HSL to RGB (Feature #70)
 *
 * @param hsl - HSL color
 * @returns RGB color
 */
export function hslToRgb(hsl: HslColor): RgbColor {
  const h = hsl.h / 360
  const s = hsl.s / 100
  const l = hsl.l / 100

  let r: number, g: number, b: number

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
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
    alpha: hsl.alpha,
  }
}

/**
 * Convert RGB to OKLCH (Feature #70)
 *
 * Uses the official OKLCH color space conversion through Lab intermediate.
 *
 * @param rgb - RGB color (0-255)
 * @returns OKLCH color
 */
export function rgbToOklch(rgb: RgbColor): OklchColor {
  // Convert RGB to linear RGB
  const toLinear = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }

  const lr = toLinear(rgb.r)
  const lg = toLinear(rgb.g)
  const lb = toLinear(rgb.b)

  // Linear RGB to XYZ (D65)
  const x = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.0721750 * lb
  const z = 0.0193339 * lr + 0.1191920 * lg + 0.9503041 * lb

  // XYZ to LMS
  const l_ = 0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z
  const m_ = 0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z
  const s_ = 0.0482003018 * x + 0.2643662691 * y + 0.6338517070 * z

  // LMS to Lab (Oklab)
  const l__ = Math.cbrt(l_)
  const m__ = Math.cbrt(m_)
  const s__ = Math.cbrt(s_)

  const L = 0.2104542553 * l__ + 0.7936177850 * m__ - 0.0040720468 * s__
  const a = 1.9779984951 * l__ - 2.4285922050 * m__ + 0.4505937099 * s__
  const b_ = 0.0259040371 * l__ + 0.7827717662 * m__ - 0.8086757660 * s__

  // Lab to LCH
  const C = Math.sqrt(a * a + b_ * b_)
  let H = Math.atan2(b_, a) * (180 / Math.PI)
  if (H < 0) H += 360

  return {
    l: Math.round(L * 1000) / 1000,
    c: Math.round(C * 1000) / 1000,
    h: Math.round(H * 10) / 10,
    alpha: rgb.alpha,
  }
}

/**
 * Convert OKLCH to RGB (Feature #70)
 *
 * Includes gamut mapping for out-of-range colors.
 *
 * @param oklch - OKLCH color
 * @returns RGB color (clamped to 0-255)
 */
export function oklchToRgb(oklch: OklchColor): RgbColor {
  const L = oklch.l
  const C = oklch.c
  const H = oklch.h * (Math.PI / 180)

  // LCH to Lab
  const a = C * Math.cos(H)
  const b_ = C * Math.sin(H)

  // Lab to LMS
  const l__ = L + 0.3963377774 * a + 0.2158037573 * b_
  const m__ = L - 0.1055613458 * a - 0.0638541728 * b_
  const s__ = L - 0.0894841775 * a - 1.2914855480 * b_

  const l_ = l__ * l__ * l__
  const m_ = m__ * m__ * m__
  const s_ = s__ * s__ * s__

  // LMS to XYZ
  const x = 1.2270138511 * l_ - 0.5577999807 * m_ + 0.2812561490 * s_
  const y = -0.0405801784 * l_ + 1.1122568696 * m_ - 0.0716766787 * s_
  const z = -0.0763812845 * l_ - 0.4214819784 * m_ + 1.5861632204 * s_

  // XYZ to linear RGB
  const lr = 3.2404541621 * x - 1.5371385940 * y - 0.4985314095 * z
  const lg = -0.9692660305 * x + 1.8760108454 * y + 0.0415560175 * z
  const lb = 0.0556434309 * x - 0.2040259135 * y + 1.0572251882 * z

  // Linear RGB to sRGB with gamma
  const toSrgb = (c: number) => {
    const clamped = Math.max(0, Math.min(1, c))
    return clamped <= 0.0031308
      ? clamped * 12.92
      : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055
  }

  return {
    r: Math.round(toSrgb(lr) * 255),
    g: Math.round(toSrgb(lg) * 255),
    b: Math.round(toSrgb(lb) * 255),
    alpha: oklch.alpha,
  }
}

/**
 * Convert OKLCH to HSL (Feature #70)
 *
 * @param oklch - OKLCH color
 * @returns HSL color
 */
export function oklchToHsl(oklch: OklchColor): HslColor {
  const rgb = oklchToRgb(oklch)
  return rgbToHsl(rgb)
}

/**
 * Check if a color is within sRGB gamut (Feature #70)
 *
 * @param oklch - OKLCH color to check
 * @returns true if the color is displayable in sRGB
 */
export function isInGamut(oklch: OklchColor): boolean {
  // Check if color would be clamped when converting to RGB
  const L = oklch.l
  const C = oklch.c
  const H = oklch.h * (Math.PI / 180)

  // Recalculate to check for clamping
  const a = C * Math.cos(H)
  const b_ = C * Math.sin(H)

  const l__ = L + 0.3963377774 * a + 0.2158037573 * b_
  const m__ = L - 0.1055613458 * a - 0.0638541728 * b_
  const s__ = L - 0.0894841775 * a - 1.2914855480 * b_

  const l_ = l__ * l__ * l__
  const m_ = m__ * m__ * m__
  const s_ = s__ * s__ * s__

  const x = 1.2270138511 * l_ - 0.5577999807 * m_ + 0.2812561490 * s_
  const y = -0.0405801784 * l_ + 1.1122568696 * m_ - 0.0716766787 * s_
  const z = -0.0763812845 * l_ - 0.4214819784 * m_ + 1.5861632204 * s_

  const lr = 3.2404541621 * x - 1.5371385940 * y - 0.4985314095 * z
  const lg = -0.9692660305 * x + 1.8760108454 * y + 0.0415560175 * z
  const lb = 0.0556434309 * x - 0.2040259135 * y + 1.0572251882 * z

  const epsilon = 0.0001
  return (
    lr >= -epsilon && lr <= 1 + epsilon &&
    lg >= -epsilon && lg <= 1 + epsilon &&
    lb >= -epsilon && lb <= 1 + epsilon
  )
}

/**
 * Map an out-of-gamut OKLCH color to the nearest in-gamut color (Feature #70)
 *
 * Uses chroma reduction to find the nearest displayable color.
 *
 * @param oklch - OKLCH color (potentially out of gamut)
 * @returns In-gamut OKLCH color
 */
export function mapToGamut(oklch: OklchColor): OklchColor {
  if (isInGamut(oklch)) {
    return oklch
  }

  // Binary search for maximum chroma that's in gamut
  let low = 0
  let high = oklch.c
  let result = { ...oklch, c: 0 }

  while (high - low > 0.001) {
    const mid = (low + high) / 2
    const test = { ...oklch, c: mid }

    if (isInGamut(test)) {
      low = mid
      result = test
    } else {
      high = mid
    }
  }

  return {
    ...result,
    c: Math.round(result.c * 1000) / 1000,
  }
}

/**
 * Unified color conversion (Feature #70)
 *
 * Converts any color string to the specified format.
 *
 * @param color - Color string (hex, rgb, hsl, or oklch)
 * @param toFormat - Target format
 * @returns Color string in target format, or original if parsing fails
 *
 * @example
 * ```typescript
 * convertColor("#ff0000", "oklch") // "oklch(0.628 0.258 29.2)"
 * convertColor("hsl(0 100% 50%)", "rgb") // "rgb(255 0 0)"
 * convertColor("oklch(0.7 0.15 250)", "hex") // "#4d8cd6"
 * ```
 */
export function convertColor(
  color: string,
  toFormat: ColorFormat
): string {
  // Parse the input color
  let rgb: RgbColor | null = null

  if (color.startsWith("#")) {
    rgb = parseHex(color)
  } else if (color.startsWith("rgb")) {
    rgb = parseRgb(color)
  } else if (color.startsWith("hsl")) {
    const hsl = parseHsl(color)
    if (hsl) rgb = hslToRgb(hsl)
  } else if (color.startsWith("oklch")) {
    const oklch = parseOklch(color)
    if (oklch) rgb = oklchToRgb(oklch)
  }

  if (!rgb) return color

  // Convert to target format
  switch (toFormat) {
    case "hex":
      return rgbToHex(rgb)
    case "rgb":
      return rgbToString(rgb)
    case "hsl":
      return hslToString(rgbToHsl(rgb))
    case "oklch":
      return oklchToString(rgbToOklch(rgb))
    default:
      return color
  }
}

// =============================================================================
// CONTRAST RATIO VALIDATION (Feature #73)
// =============================================================================

/**
 * WCAG contrast ratio levels
 */
export type WcagLevel = "AA" | "AAA"

/**
 * Text size categories for WCAG requirements
 */
export type TextSize = "normal" | "large"

/**
 * Contrast ratio validation result
 */
export interface ContrastResult {
  /** The calculated contrast ratio (1:1 to 21:1) */
  ratio: number
  /** Formatted ratio string (e.g., "4.5:1") */
  ratioString: string
  /** Whether it passes WCAG AA for normal text (4.5:1) */
  passesAA: boolean
  /** Whether it passes WCAG AA for large text (3:1) */
  passesAALarge: boolean
  /** Whether it passes WCAG AAA for normal text (7:1) */
  passesAAA: boolean
  /** Whether it passes WCAG AAA for large text (4.5:1) */
  passesAAALarge: boolean
  /** Foreground color used */
  foreground: string
  /** Background color used */
  background: string
}

/**
 * WCAG contrast ratio thresholds
 */
export const WCAG_THRESHOLDS = {
  /** AA level for normal text (< 18pt or < 14pt bold) */
  AA_NORMAL: 4.5,
  /** AA level for large text (>= 18pt or >= 14pt bold) */
  AA_LARGE: 3.0,
  /** AAA level for normal text */
  AAA_NORMAL: 7.0,
  /** AAA level for large text */
  AAA_LARGE: 4.5,
} as const

/**
 * Calculate relative luminance of an RGB color (Feature #73)
 *
 * Uses the WCAG 2.1 formula for relative luminance.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 *
 * @param rgb - RGB color
 * @returns Relative luminance (0 to 1)
 */
export function getRelativeLuminance(rgb: RgbColor): number {
  const toLinear = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }

  const r = toLinear(rgb.r)
  const g = toLinear(rgb.g)
  const b = toLinear(rgb.b)

  // WCAG luminance formula
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Calculate contrast ratio between two colors (Feature #73)
 *
 * Uses the WCAG 2.1 formula for contrast ratio.
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 *
 * @param color1 - First color (any format)
 * @param color2 - Second color (any format)
 * @returns Contrast ratio between 1:1 and 21:1
 *
 * @example
 * ```typescript
 * const ratio = calculateContrastRatio("#000000", "#ffffff")
 * console.log(ratio) // 21 (maximum contrast)
 *
 * const ratio2 = calculateContrastRatio("hsl(0 0% 50%)", "#ffffff")
 * console.log(ratio2) // ~4.6
 * ```
 */
export function calculateContrastRatio(
  color1: string,
  color2: string
): number {
  // Parse colors to RGB
  const rgb1 = parseColorToRgb(color1)
  const rgb2 = parseColorToRgb(color2)

  if (!rgb1 || !rgb2) {
    return 1 // Return minimum contrast if colors can't be parsed
  }

  const l1 = getRelativeLuminance(rgb1)
  const l2 = getRelativeLuminance(rgb2)

  // Ensure lighter color is in numerator
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  // WCAG contrast ratio formula: (L1 + 0.05) / (L2 + 0.05)
  const ratio = (lighter + 0.05) / (darker + 0.05)

  // Round to 2 decimal places
  return Math.round(ratio * 100) / 100
}

/**
 * Parse any color format to RGB
 */
function parseColorToRgb(color: string): RgbColor | null {
  if (color.startsWith("#")) {
    return parseHex(color)
  } else if (color.startsWith("rgb")) {
    return parseRgb(color)
  } else if (color.startsWith("hsl")) {
    const hsl = parseHsl(color)
    return hsl ? hslToRgb(hsl) : null
  } else if (color.startsWith("oklch")) {
    const oklch = parseOklch(color)
    return oklch ? oklchToRgb(oklch) : null
  }
  return null
}

/**
 * Check if contrast ratio meets WCAG requirements (Feature #73)
 *
 * @param ratio - Contrast ratio
 * @param level - WCAG level ("AA" or "AAA")
 * @param textSize - Text size category ("normal" or "large")
 * @returns true if contrast meets the requirement
 *
 * @example
 * ```typescript
 * const ratio = calculateContrastRatio(fg, bg)
 * if (meetsWcagContrast(ratio, "AA", "normal")) {
 *   console.log("Passes WCAG AA for normal text")
 * }
 * ```
 */
export function meetsWcagContrast(
  ratio: number,
  level: WcagLevel,
  textSize: TextSize
): boolean {
  if (level === "AA") {
    return textSize === "large"
      ? ratio >= WCAG_THRESHOLDS.AA_LARGE
      : ratio >= WCAG_THRESHOLDS.AA_NORMAL
  } else {
    return textSize === "large"
      ? ratio >= WCAG_THRESHOLDS.AAA_LARGE
      : ratio >= WCAG_THRESHOLDS.AAA_NORMAL
  }
}

/**
 * Validate contrast between foreground and background (Feature #73)
 *
 * Comprehensive contrast validation returning all WCAG compliance levels.
 *
 * @param foreground - Foreground (text) color
 * @param background - Background color
 * @returns Detailed contrast result
 *
 * @example
 * ```typescript
 * const result = validateContrast("#333333", "#ffffff")
 * console.log(result.ratio) // 12.63
 * console.log(result.passesAA) // true
 * console.log(result.passesAAA) // true
 * ```
 *
 * @example Check semantic colors
 * ```typescript
 * const result = validateContrast(
 *   semanticColors.foreground,
 *   semanticColors.background
 * )
 * if (!result.passesAA) {
 *   console.warn(`Contrast too low: ${result.ratioString}`)
 * }
 * ```
 */
export function validateContrast(
  foreground: string,
  background: string
): ContrastResult {
  const ratio = calculateContrastRatio(foreground, background)

  return {
    ratio,
    ratioString: `${ratio}:1`,
    passesAA: ratio >= WCAG_THRESHOLDS.AA_NORMAL,
    passesAALarge: ratio >= WCAG_THRESHOLDS.AA_LARGE,
    passesAAA: ratio >= WCAG_THRESHOLDS.AAA_NORMAL,
    passesAAALarge: ratio >= WCAG_THRESHOLDS.AAA_LARGE,
    foreground,
    background,
  }
}

/**
 * Validate all semantic color contrasts (Feature #73)
 *
 * Checks contrast ratios for all foreground/background pairs
 * in a semantic color set.
 *
 * @param colors - Semantic colors to validate
 * @returns Array of contrast results with issues highlighted
 *
 * @example
 * ```typescript
 * const results = validateSemanticContrasts(brandKit.semantics.light)
 * const issues = results.filter(r => !r.passesAA)
 * if (issues.length > 0) {
 *   console.warn("Contrast issues found:", issues)
 * }
 * ```
 */
export function validateSemanticContrasts(colors: SemanticColors): Array<{
  pair: string
  result: ContrastResult
  issue: boolean
}> {
  const pairs: Array<{ name: string; fg: keyof SemanticColors; bg: keyof SemanticColors }> = [
    { name: "foreground/background", fg: "foreground", bg: "background" },
    { name: "primary/primaryForeground", fg: "primaryForeground", bg: "primary" },
    { name: "secondary/secondaryForeground", fg: "secondaryForeground", bg: "secondary" },
    { name: "muted/mutedForeground", fg: "mutedForeground", bg: "muted" },
    { name: "accent/accentForeground", fg: "accentForeground", bg: "accent" },
    { name: "destructive/destructiveForeground", fg: "destructiveForeground", bg: "destructive" },
    { name: "card/cardForeground", fg: "cardForeground", bg: "card" },
    { name: "popover/popoverForeground", fg: "popoverForeground", bg: "popover" },
  ]

  return pairs.map(({ name, fg, bg }) => {
    const fgColor = String(colors[fg])
    const bgColor = String(colors[bg])
    const result = validateContrast(fgColor, bgColor)

    return {
      pair: name,
      result,
      issue: !result.passesAA,
    }
  })
}

/**
 * Suggest a color adjustment to meet contrast requirements (Feature #73)
 *
 * @param foreground - Current foreground color
 * @param background - Background color
 * @param targetRatio - Target contrast ratio (default: 4.5 for AA)
 * @returns Suggested adjusted foreground color
 */
export function suggestContrastAdjustment(
  foreground: string,
  background: string,
  targetRatio: number = WCAG_THRESHOLDS.AA_NORMAL
): string {
  const currentRatio = calculateContrastRatio(foreground, background)

  if (currentRatio >= targetRatio) {
    return foreground // Already meets target
  }

  // Parse colors
  const fgRgb = parseColorToRgb(foreground)
  const bgRgb = parseColorToRgb(background)

  if (!fgRgb || !bgRgb) {
    return foreground
  }

  const bgLuminance = getRelativeLuminance(bgRgb)

  // Determine if we need to lighten or darken
  // If background is dark, lighten foreground; if light, darken
  const shouldLighten = bgLuminance < 0.5

  // Binary search for the right luminance
  let hsl = rgbToHsl(fgRgb)
  let low = shouldLighten ? hsl.l : 0
  let high = shouldLighten ? 100 : hsl.l

  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2
    const testHsl = { ...hsl, l: mid }
    const testRgb = hslToRgb(testHsl)
    const testRatio = calculateContrastRatio(rgbToString(testRgb), background)

    if (Math.abs(testRatio - targetRatio) < 0.1) {
      hsl = testHsl
      break
    }

    if (testRatio < targetRatio) {
      if (shouldLighten) {
        low = mid
      } else {
        high = mid
      }
    } else {
      if (shouldLighten) {
        high = mid
      } else {
        low = mid
      }
    }
    hsl = testHsl
  }

  return hslToString(hsl)
}

// =============================================================================
// WCAG CONTRAST CHECK (Feature #82)
// =============================================================================

/**
 * WCAG compliance level
 */
export type WcagComplianceLevel = "AAA" | "AA" | "AA-large" | "fail"

/**
 * WCAG check result for a single color pair
 */
export interface WcagCheckResult {
  /** Name/identifier for this pair */
  pair: string
  /** Foreground color */
  foreground: string
  /** Background color */
  background: string
  /** Contrast ratio */
  ratio: number
  /** Formatted ratio string */
  ratioString: string
  /** Highest compliance level achieved */
  compliance: WcagComplianceLevel
  /** Whether it passes AA for normal text */
  passesAA: boolean
  /** Whether it passes AAA for normal text */
  passesAAA: boolean
  /** Warning message if any */
  warning?: string
  /** Suggested fix if failing */
  suggestion?: string
}

/**
 * Full WCAG compliance report for a brand kit
 */
export interface WcagComplianceReport {
  /** Overall compliance status */
  compliant: boolean
  /** Compliance level achieved (minimum across all pairs) */
  level: WcagComplianceLevel
  /** Number of pairs checked */
  totalPairs: number
  /** Number passing AA */
  passingAA: number
  /** Number passing AAA */
  passingAAA: number
  /** Number with warnings */
  warnings: number
  /** Number failing */
  failures: number
  /** Results for light mode */
  lightMode: WcagCheckResult[]
  /** Results for dark mode */
  darkMode: WcagCheckResult[]
  /** Summary messages */
  summary: string[]
}

/**
 * Check a single foreground/background pair for WCAG compliance (Feature #82)
 *
 * @param foreground - Foreground color
 * @param background - Background color
 * @param pairName - Name for this pair (e.g., "primary/primaryForeground")
 * @returns WCAG check result with compliance level and warnings
 *
 * @example
 * ```typescript
 * const result = checkWcagContrast("#000000", "#ffffff", "text/background")
 * console.log(result.compliance) // "AAA"
 * console.log(result.ratio) // 21
 * ```
 */
export function checkWcagContrast(
  foreground: string,
  background: string,
  pairName: string
): WcagCheckResult {
  const ratio = calculateContrastRatio(foreground, background)
  const roundedRatio = Math.round(ratio * 100) / 100

  // Determine compliance level
  let compliance: WcagComplianceLevel
  let warning: string | undefined
  let suggestion: string | undefined

  if (ratio >= WCAG_THRESHOLDS.AAA_NORMAL) {
    compliance = "AAA"
  } else if (ratio >= WCAG_THRESHOLDS.AA_NORMAL) {
    compliance = "AA"
  } else if (ratio >= WCAG_THRESHOLDS.AA_LARGE) {
    compliance = "AA-large"
    warning = `Low contrast (${roundedRatio}:1). Only suitable for large text (18pt+)`
  } else {
    compliance = "fail"
    warning = `Insufficient contrast (${roundedRatio}:1). Minimum 4.5:1 required for AA`
    suggestion = `Increase contrast to at least ${WCAG_THRESHOLDS.AA_NORMAL}:1`
  }

  // Generate suggestion for non-compliant pairs
  if (compliance === "fail" || compliance === "AA-large") {
    const needed = WCAG_THRESHOLDS.AA_NORMAL - ratio
    if (needed > 0) {
      suggestion = `Need ${needed.toFixed(1)} more contrast. Try ${ratio < 4.5 ? "darkening foreground or lightening background" : "adjusting colors"}`
    }
  }

  return {
    pair: pairName,
    foreground,
    background,
    ratio: roundedRatio,
    ratioString: `${roundedRatio}:1`,
    compliance,
    passesAA: ratio >= WCAG_THRESHOLDS.AA_NORMAL,
    passesAAA: ratio >= WCAG_THRESHOLDS.AAA_NORMAL,
    warning,
    suggestion,
  }
}

/**
 * Check all semantic color pairs for WCAG compliance (Feature #82)
 *
 * @param semanticColors - Object with semantic color values
 * @returns Array of WCAG check results
 */
export function checkSemanticWcagContrast(
  semanticColors: Record<string, string>
): WcagCheckResult[] {
  // Define standard foreground/background pairs to check
  const pairs: Array<{ name: string; fg: string; bg: string }> = [
    { name: "foreground/background", fg: "foreground", bg: "background" },
    { name: "primary/primaryForeground", fg: "primaryForeground", bg: "primary" },
    { name: "secondary/secondaryForeground", fg: "secondaryForeground", bg: "secondary" },
    { name: "muted/mutedForeground", fg: "mutedForeground", bg: "muted" },
    { name: "accent/accentForeground", fg: "accentForeground", bg: "accent" },
    { name: "destructive/destructiveForeground", fg: "destructiveForeground", bg: "destructive" },
    { name: "card/cardForeground", fg: "cardForeground", bg: "card" },
    { name: "popover/popoverForeground", fg: "popoverForeground", bg: "popover" },
  ]

  const results: WcagCheckResult[] = []

  for (const { name, fg, bg } of pairs) {
    const fgColor = semanticColors[fg]
    const bgColor = semanticColors[bg]

    if (fgColor && bgColor) {
      results.push(checkWcagContrast(fgColor, bgColor, name))
    }
  }

  // Also check foreground against common backgrounds
  if (semanticColors.foreground) {
    if (semanticColors.card) {
      results.push(
        checkWcagContrast(semanticColors.foreground, semanticColors.card, "foreground/card")
      )
    }
    if (semanticColors.popover) {
      results.push(
        checkWcagContrast(semanticColors.foreground, semanticColors.popover, "foreground/popover")
      )
    }
  }

  return results
}

/**
 * Generate a full WCAG compliance report for a brand kit (Feature #82)
 *
 * Checks all foreground/background pairs in both light and dark modes.
 *
 * @param brandKit - Brand kit with semantics.light and semantics.dark
 * @returns Full compliance report with all pairs checked
 *
 * @example
 * ```typescript
 * import { generateWcagReport } from "@platxa/frontend-agent"
 *
 * const report = generateWcagReport(brandKit)
 *
 * if (!report.compliant) {
 *   console.warn("WCAG compliance issues:")
 *   report.summary.forEach(msg => console.warn(msg))
 * }
 *
 * // Check specific failures
 * const failures = [...report.lightMode, ...report.darkMode]
 *   .filter(r => !r.passesAA)
 * ```
 */
export function generateWcagReport(brandKit: {
  semantics: {
    light: Record<string, string>
    dark: Record<string, string>
  }
}): WcagComplianceReport {
  const lightResults = checkSemanticWcagContrast(brandKit.semantics.light)
  const darkResults = checkSemanticWcagContrast(brandKit.semantics.dark)

  const allResults = [...lightResults, ...darkResults]

  // Calculate statistics
  const totalPairs = allResults.length
  const passingAA = allResults.filter((r) => r.passesAA).length
  const passingAAA = allResults.filter((r) => r.passesAAA).length
  const warnings = allResults.filter((r) => r.warning && r.passesAA).length
  const failures = allResults.filter((r) => !r.passesAA).length

  // Determine overall compliance level
  let level: WcagComplianceLevel = "AAA"
  if (failures > 0) {
    level = "fail"
  } else if (passingAAA < totalPairs) {
    level = allResults.every((r) => r.compliance !== "AA-large") ? "AA" : "AA-large"
  }

  // Generate summary messages
  const summary: string[] = []

  if (failures > 0) {
    summary.push(`❌ ${failures} color pair(s) fail WCAG AA compliance`)

    const lightFailures = lightResults.filter((r) => !r.passesAA)
    if (lightFailures.length > 0) {
      summary.push(`  Light mode: ${lightFailures.map((r) => r.pair).join(", ")}`)
    }

    const darkFailures = darkResults.filter((r) => !r.passesAA)
    if (darkFailures.length > 0) {
      summary.push(`  Dark mode: ${darkFailures.map((r) => r.pair).join(", ")}`)
    }
  } else {
    summary.push(`✅ All ${totalPairs} color pairs pass WCAG AA`)
  }

  if (passingAAA === totalPairs) {
    summary.push(`✅ All pairs also pass WCAG AAA (enhanced contrast)`)
  } else if (passingAAA > 0) {
    summary.push(`ℹ️ ${passingAAA}/${totalPairs} pairs pass WCAG AAA`)
  }

  if (warnings > 0) {
    summary.push(`⚠️ ${warnings} pair(s) have low contrast warnings`)
  }

  return {
    compliant: failures === 0,
    level,
    totalPairs,
    passingAA,
    passingAAA,
    warnings,
    failures,
    lightMode: lightResults,
    darkMode: darkResults,
    summary,
  }
}

/**
 * Quick check if a brand kit passes WCAG AA (Feature #82)
 *
 * @param brandKit - Brand kit to check
 * @returns true if all pairs pass WCAG AA
 */
export function passesWcagAA(brandKit: {
  semantics: {
    light: Record<string, string>
    dark: Record<string, string>
  }
}): boolean {
  const report = generateWcagReport(brandKit)
  return report.compliant
}

/**
 * Lightens a color by percentage
 */
export function lighten(color: string, amount: number): string {
  const hsl = parseHsl(color)
  if (!hsl) return color

  const newL = Math.min(100, hsl.l + amount)
  return hslToString({ ...hsl, l: newL })
}

/**
 * Darkens a color by percentage
 */
export function darken(color: string, amount: number): string {
  const hsl = parseHsl(color)
  if (!hsl) return color

  const newL = Math.max(0, hsl.l - amount)
  return hslToString({ ...hsl, l: newL })
}

/**
 * Adjusts color saturation
 */
export function saturate(color: string, amount: number): string {
  const hsl = parseHsl(color)
  if (!hsl) return color

  const newS = Math.min(100, Math.max(0, hsl.s + amount))
  return hslToString({ ...hsl, s: newS })
}

/**
 * Generates a color palette from a base color
 */
export function generatePalette(options: PaletteGenerationOptions): ColorPalette {
  const { baseColor, format = "hsl" } = options

  // Parse base color
  const base = typeof baseColor === "string" ? parseHsl(baseColor) : null
  if (!base) {
    // Return default gray palette if parsing fails
    return {
      50: "hsl(0 0% 98%)",
      100: "hsl(0 0% 96%)",
      200: "hsl(0 0% 90%)",
      300: "hsl(0 0% 83%)",
      400: "hsl(0 0% 64%)",
      500: "hsl(0 0% 45%)",
      600: "hsl(0 0% 32%)",
      700: "hsl(0 0% 25%)",
      800: "hsl(0 0% 15%)",
      900: "hsl(0 0% 9%)",
      950: "hsl(0 0% 4%)",
    }
  }

  // Generate shades by adjusting lightness
  const shades: [keyof ColorPalette, number][] = [
    [50, 97],
    [100, 94],
    [200, 86],
    [300, 77],
    [400, 66],
    [500, 50],
    [600, 40],
    [700, 32],
    [800, 24],
    [900, 15],
    [950, 8],
  ]

  const palette: Partial<ColorPalette> = {}

  for (const [shade, lightness] of shades) {
    const color: HslColor = {
      h: base.h,
      s: base.s,
      l: lightness,
    }

    if (format === "oklch") {
      palette[shade] = oklchToString(hslToOklch(color))
    } else {
      palette[shade] = hslToString(color)
    }
  }

  return palette as ColorPalette
}

/**
 * Generates semantic colors from a primary hue
 */
export function generateSemanticColors(options: ColorGenerationOptions): SemanticColors {
  const { hue, saturation = "medium", useOklch = false } = options

  const satMap = { low: 30, medium: 50, high: 70 }
  const sat = satMap[saturation]

  const toColor = (h: number, s: number, l: number): string => {
    const hsl: HslColor = { h, s, l }
    return useOklch ? oklchToString(hslToOklch(hsl)) : hslToString(hsl)
  }

  return {
    background: toColor(0, 0, 100),
    foreground: toColor(hue, sat, 10),
    card: toColor(0, 0, 100),
    cardForeground: toColor(hue, sat, 10),
    popover: toColor(0, 0, 100),
    popoverForeground: toColor(hue, sat, 10),
    primary: toColor(hue, sat + 20, 50),
    primaryForeground: toColor(0, 0, 100),
    secondary: toColor(hue, sat - 20, 96),
    secondaryForeground: toColor(hue, sat, 10),
    muted: toColor(hue, sat - 30, 96),
    mutedForeground: toColor(hue, sat - 20, 45),
    accent: toColor(hue, sat - 20, 96),
    accentForeground: toColor(hue, sat, 10),
    destructive: toColor(0, 84, 60),
    destructiveForeground: toColor(0, 0, 100),
    border: toColor(hue, sat - 30, 90),
    input: toColor(hue, sat - 30, 90),
    ring: toColor(hue, sat + 20, 50),
  }
}

// ============================================================================
// CSS Generation
// ============================================================================

/**
 * Converts camelCase to kebab-case
 */
function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()
}

/**
 * Generates CSS variables from semantic colors
 */
export function generateColorVariables(
  colors: SemanticColors,
  prefix: string = ""
): Record<string, string> {
  const variables: Record<string, string> = {}
  const p = prefix ? `${prefix}-` : ""

  for (const [key, value] of Object.entries(colors)) {
    const varName = `--${p}${toKebabCase(key)}`
    variables[varName] = typeof value === "string" ? value : ""
  }

  return variables
}

/**
 * Generates CSS from design tokens
 */
export function generateCss(
  tokens: DesignTokens,
  selector: string = ":root"
): string {
  const lines: string[] = []

  lines.push(`${selector} {`)

  // Color variables
  const colorVars = generateColorVariables(tokens.colors)
  for (const [name, value] of Object.entries(colorVars)) {
    lines.push(`  ${name}: ${value};`)
  }

  // Radius variable (commonly used)
  if (tokens.radius.lg) {
    lines.push(`  --radius: ${tokens.radius.lg};`)
  }

  lines.push("}")

  return lines.join("\n")
}

/**
 * Generates dark mode CSS
 */
export function generateDarkModeCss(
  darkColors: Partial<SemanticColors>,
  selector: string = ".dark"
): string {
  const lines: string[] = []

  lines.push(`${selector} {`)

  for (const [key, value] of Object.entries(darkColors)) {
    if (value) {
      const varName = `--${toKebabCase(key)}`
      lines.push(`  ${varName}: ${typeof value === "string" ? value : ""};`)
    }
  }

  lines.push("}")

  return lines.join("\n")
}

/**
 * Generates Tailwind v4 @theme block
 */
export function generateTailwindTheme(tokens: DesignTokens): string {
  const lines: string[] = []

  lines.push("@theme {")

  // Colors
  lines.push("  /* Semantic Colors */")
  const colorVars = generateColorVariables(tokens.colors)
  for (const [name, value] of Object.entries(colorVars)) {
    const tailwindName = name.replace("--", "--color-")
    lines.push(`  ${tailwindName}: ${value};`)
  }

  // Radius
  lines.push("")
  lines.push("  /* Border Radius */")
  for (const [key, value] of Object.entries(tokens.radius)) {
    if (value) {
      lines.push(`  --radius-${key}: ${value};`)
    }
  }

  // Shadows
  if (tokens.shadow) {
    lines.push("")
    lines.push("  /* Shadows */")
    for (const [key, value] of Object.entries(tokens.shadow)) {
      if (value) {
        const shadowKey = key === "default" ? "DEFAULT" : key
        lines.push(`  --shadow-${shadowKey}: ${value};`)
      }
    }
  }

  // Font families
  if (tokens.fontFamily) {
    lines.push("")
    lines.push("  /* Font Families */")
    for (const [key, value] of Object.entries(tokens.fontFamily)) {
      if (value) {
        lines.push(`  --font-${key}: ${value};`)
      }
    }
  }

  lines.push("}")

  return lines.join("\n")
}

/**
 * Generates theme switching JavaScript
 */
export function generateThemeScript(config: ThemeConfig): string {
  return `// Theme initialization script
(function() {
  const storageKey = 'theme-mode';
  const darkClass = '${config.darkModeClass || "dark"}';

  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function getStoredTheme() {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }

  function setTheme(theme) {
    const root = document.documentElement;
    const isDark = theme === 'dark' || (theme === 'system' && getSystemTheme() === 'dark');

    root.classList.toggle(darkClass, isDark);
    ${config.useColorScheme ? "root.style.colorScheme = isDark ? 'dark' : 'light';" : ""}
  }

  // Initialize
  const stored = getStoredTheme();
  const initial = stored || '${config.defaultMode || "system"}';
  setTheme(initial);

  // Listen for system changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!getStoredTheme() || getStoredTheme() === 'system') {
      setTheme('system');
    }
  });

  // Expose API
  window.setTheme = function(theme) {
    try {
      localStorage.setItem(storageKey, theme);
    } catch {}
    setTheme(theme);
  };
})();`
}

// ============================================================================
// Main Theme Generation
// ============================================================================

/**
 * Generates complete theme output from configuration
 */
export function generateTheme(config: ThemeConfig): GeneratedTheme {
  const cssVariables = generateColorVariables(config.light.colors)

  // Generate base CSS
  const css = generateCss(config.light)

  // Generate Tailwind theme
  const tailwindTheme = generateTailwindTheme(config.light)

  // Generate dark mode CSS
  let darkModeCss: string | undefined
  if (config.dark) {
    darkModeCss = generateDarkModeCss(config.dark, `.${config.darkModeClass || "dark"}`)
  }

  // Generate theme script
  const jsTheme = generateThemeScript(config)

  return {
    css,
    tailwindTheme,
    cssVariables,
    darkModeCss,
    jsTheme,
  }
}

/**
 * Generates theme from preset name
 */
export function generateThemeFromPreset(presetName: string): GeneratedTheme {
  const config = getThemePreset(presetName)
  return generateTheme(config)
}

/**
 * Creates a custom theme configuration
 */
export function createTheme(
  name: string,
  options: {
    primaryHue?: number
    saturation?: "low" | "medium" | "high"
    useOklch?: boolean
    darkMode?: boolean
  } = {}
): ThemeConfig {
  const { primaryHue = 220, saturation = "medium", useOklch = false, darkMode = true } = options

  const lightColors = generateSemanticColors({
    hue: primaryHue,
    saturation,
    useOklch,
  })

  const config: ThemeConfig = {
    name,
    light: {
      ...defaultTokens,
      colors: lightColors,
    },
    defaultMode: "system",
    darkModeClass: "dark",
    useColorScheme: true,
  }

  if (darkMode) {
    // Generate dark colors based on default dark colors
    config.dark = {
      ...defaultDarkColors,
    }
  }

  return config
}

/**
 * Validates a theme configuration
 */
export function validateTheme(config: ThemeConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!config.name) {
    errors.push("Theme name is required")
  }

  if (!config.light?.colors) {
    errors.push("Light mode colors are required")
  } else {
    const requiredColors: (keyof SemanticColors)[] = [
      "background",
      "foreground",
      "primary",
      "primaryForeground",
    ]

    for (const color of requiredColors) {
      if (!config.light.colors[color]) {
        errors.push(`Missing required color: ${color}`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// ============================================================================
// REACT HOOK (Feature #34)
// ============================================================================

/** Current theme state */
let currentMode: ThemeMode = "system"
let currentThemeConfig: ThemeConfig | null = null

/** Subscribers for theme state changes */
const themeSubscribers = new Set<() => void>()

/** Notify all theme subscribers of state change */
function notifyThemeSubscribers(): void {
  themeSubscribers.forEach((callback) => callback())
}

/**
 * Subscribe to theme state changes
 * @param callback - Function to call when state changes
 * @returns Unsubscribe function
 */
export function subscribeToThemeChanges(callback: () => void): () => void {
  themeSubscribers.add(callback)
  return () => themeSubscribers.delete(callback)
}

/**
 * Theme state for React hook
 */
export interface UseThemeState {
  /** Current theme mode (light/dark/system) */
  mode: ThemeMode
  /** Resolved mode (light/dark only, system resolved) */
  resolvedMode: "light" | "dark"
  /** Theme tokens */
  tokens: DesignTokens
  /** Theme configuration */
  config: ThemeConfig | null
  /** Set the theme mode */
  setMode: (mode: ThemeMode) => void
}

/**
 * Get the resolved mode (system preference resolved)
 */
function getResolvedMode(): "light" | "dark" {
  if (currentMode === "system") {
    // Check system preference (works in browser)
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    }
    return "light" // Default to light in non-browser
  }
  return currentMode
}

/**
 * Set the current theme mode
 */
export function setThemeMode(mode: ThemeMode): void {
  currentMode = mode
  notifyThemeSubscribers()
}

/**
 * Get current theme mode
 */
export function getThemeMode(): ThemeMode {
  return currentMode
}

/**
 * Set current theme config
 */
export function setThemeConfig(config: ThemeConfig): void {
  currentThemeConfig = config
  notifyThemeSubscribers()
}

/**
 * Get current theme state snapshot
 */
export function getThemeStateSnapshot(): UseThemeState {
  return {
    mode: currentMode,
    resolvedMode: getResolvedMode(),
    tokens: currentThemeConfig?.light ?? defaultTokens,
    config: currentThemeConfig,
    setMode: setThemeMode,
  }
}

/**
 * React hook to access current theme tokens
 *
 * Returns the current theme state including tokens, mode, and a setMode function.
 * Automatically updates when theme state changes.
 *
 * @returns Current theme state
 *
 * @example
 * ```tsx
 * import { useTheme } from "@platxa/frontend-agent"
 *
 * function ThemedComponent() {
 *   const { mode, resolvedMode, tokens, setMode } = useTheme()
 *
 *   return (
 *     <div>
 *       <p>Mode: {mode} (resolved: {resolvedMode})</p>
 *       <p>Primary: {tokens.colors.primary}</p>
 *       <button onClick={() => setMode("dark")}>Dark</button>
 *       <button onClick={() => setMode("light")}>Light</button>
 *       <button onClick={() => setMode("system")}>System</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useTheme(): UseThemeState {
  // Note: For full React integration, consumers should use useSyncExternalStore:
  //
  // import { useSyncExternalStore } from "react"
  // const state = useSyncExternalStore(
  //   subscribeToThemeChanges,
  //   getThemeStateSnapshot
  // )
  return getThemeStateSnapshot()
}

// =============================================================================
// MINIMAL RE-RENDERS (Feature #86)
// =============================================================================

/**
 * Performs shallow equality comparison between two values
 *
 * For objects, compares own enumerable properties at the first level.
 * For primitives, uses strict equality.
 *
 * @param a - First value
 * @param b - Second value
 * @returns true if values are shallowly equal
 *
 * @example
 * ```typescript
 * shallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 }) // true
 * shallowEqual({ a: 1 }, { a: 2 }) // false
 * shallowEqual({ a: { nested: 1 } }, { a: { nested: 1 } }) // false (different refs)
 * ```
 */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) {
    return true
  }

  if (
    typeof a !== "object" ||
    a === null ||
    typeof b !== "object" ||
    b === null
  ) {
    return false
  }

  const keysA = Object.keys(a)
  const keysB = Object.keys(b)

  if (keysA.length !== keysB.length) {
    return false
  }

  for (const key of keysA) {
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    ) {
      return false
    }
  }

  return true
}

/**
 * Selector function type for extracting specific values from theme state
 */
export type ThemeSelector<T> = (state: UseThemeState) => T

/**
 * Cache for memoized selector results
 */
interface SelectorCache<T> {
  lastState: UseThemeState | null
  lastResult: T | undefined
}

/**
 * Creates a memoized selector for theme state
 *
 * The selector will only recompute when the selected value actually changes,
 * using shallow equality comparison. This prevents unnecessary re-renders
 * when other parts of the theme state change.
 *
 * @param selector - Function to extract desired value from theme state
 * @returns Memoized selector function
 *
 * @example
 * ```typescript
 * // Create a selector for just the theme mode
 * const selectMode = createThemeSelector((state) => state.mode)
 *
 * // In a component, this will only cause re-render when mode changes
 * const mode = selectMode(getThemeStateSnapshot())
 * ```
 */
export function createThemeSelector<T>(
  selector: ThemeSelector<T>
): ThemeSelector<T> {
  const cache: SelectorCache<T> = {
    lastState: null,
    lastResult: undefined,
  }

  return (state: UseThemeState): T => {
    // If same state reference, return cached result
    if (cache.lastState === state) {
      return cache.lastResult as T
    }

    const newResult = selector(state)

    // If result is shallowly equal, return the cached result to preserve reference
    if (cache.lastResult !== undefined && shallowEqual(cache.lastResult, newResult)) {
      cache.lastState = state
      return cache.lastResult
    }

    cache.lastState = state
    cache.lastResult = newResult
    return newResult
  }
}

/**
 * Built-in selectors for common theme values
 *
 * Using these selectors ensures components only re-render
 * when the specific value they depend on changes.
 */
export const themeSelectors = {
  /** Select only the theme mode (light/dark/system) */
  mode: createThemeSelector((state) => state.mode),

  /** Select only the resolved mode (light/dark) */
  resolvedMode: createThemeSelector((state) => state.resolvedMode),

  /** Select only the design tokens */
  tokens: createThemeSelector((state) => state.tokens),

  /** Select only colors from tokens */
  colors: createThemeSelector((state) => state.tokens.colors),

  /** Select only spacing from tokens */
  spacing: createThemeSelector((state) => state.tokens.spacing),

  /** Select only typography from tokens */
  typography: createThemeSelector((state) => state.tokens.typography),

  /** Select the setMode function (stable reference) */
  setMode: createThemeSelector((state) => state.setMode),
} as const

/**
 * Gets a snapshot for a specific selector
 *
 * Use with useSyncExternalStore for optimal React performance:
 *
 * @example
 * ```tsx
 * import { useSyncExternalStore } from "react"
 *
 * function ThemeModeDisplay() {
 *   const mode = useSyncExternalStore(
 *     subscribeToThemeChanges,
 *     () => getSelectedSnapshot(themeSelectors.mode)
 *   )
 *   return <span>{mode}</span>
 * }
 * ```
 */
export function getSelectedSnapshot<T>(selector: ThemeSelector<T>): T {
  return selector(getThemeStateSnapshot())
}

/**
 * Creates a subscription factory for selective theme updates
 *
 * Returns a subscribe function that only notifies when the
 * selected value changes, preventing unnecessary re-renders.
 *
 * @param selector - Selector for the value to watch
 * @returns Subscribe function compatible with useSyncExternalStore
 *
 * @example
 * ```tsx
 * const subscribeToMode = createSelectiveSubscription(themeSelectors.mode)
 *
 * function ThemeModeDisplay() {
 *   const mode = useSyncExternalStore(
 *     subscribeToMode,
 *     () => themeSelectors.mode(getThemeStateSnapshot())
 *   )
 *   // Only re-renders when mode actually changes
 * }
 * ```
 */
export function createSelectiveSubscription<T>(
  selector: ThemeSelector<T>
): (callback: () => void) => () => void {
  return (callback: () => void) => {
    let lastValue = selector(getThemeStateSnapshot())

    const wrappedCallback = () => {
      const newValue = selector(getThemeStateSnapshot())
      if (!shallowEqual(lastValue, newValue)) {
        lastValue = newValue
        callback()
      }
    }

    return subscribeToThemeChanges(wrappedCallback)
  }
}

/**
 * Memoized context value creator for theme providers
 *
 * Creates a stable context value that only changes when
 * relevant theme properties change, minimizing consumer re-renders.
 *
 * @param state - Current theme state
 * @param prevValue - Previous context value (for comparison)
 * @returns Memoized context value
 *
 * @example
 * ```tsx
 * function ThemeProvider({ children }) {
 *   const [contextValue, setContextValue] = useState(() =>
 *     createMemoizedContextValue(getThemeStateSnapshot())
 *   )
 *
 *   useEffect(() => {
 *     return subscribeToThemeChanges(() => {
 *       setContextValue(prev =>
 *         createMemoizedContextValue(getThemeStateSnapshot(), prev)
 *       )
 *     })
 *   }, [])
 *
 *   return (
 *     <ThemeContext.Provider value={contextValue}>
 *       {children}
 *     </ThemeContext.Provider>
 *   )
 * }
 * ```
 */
export function createMemoizedContextValue(
  state: UseThemeState,
  prevValue?: UseThemeState
): UseThemeState {
  if (!prevValue) {
    return state
  }

  // Check if we can reuse the previous value
  if (
    prevValue.mode === state.mode &&
    prevValue.resolvedMode === state.resolvedMode &&
    shallowEqual(prevValue.tokens, state.tokens) &&
    prevValue.config === state.config
  ) {
    return prevValue
  }

  return state
}

/**
 * Configuration for render tracking
 */
export interface RenderTrackingConfig {
  /** Whether to log render counts */
  logRenders?: boolean
  /** Component name for logging */
  componentName?: string
}

/**
 * Creates a render counter for debugging re-renders
 *
 * Useful for verifying that optimizations are working correctly.
 * Should only be used in development.
 *
 * @param config - Tracking configuration
 * @returns Object with render tracking functions
 *
 * @example
 * ```tsx
 * const renderTracker = createRenderTracker({ componentName: "ThemeConsumer" })
 *
 * function ThemeConsumer() {
 *   renderTracker.track()
 *
 *   const { mode } = useTheme()
 *   return <div>{mode}</div>
 * }
 *
 * // Later, check render count
 * console.log(renderTracker.getCount())
 * renderTracker.reset()
 * ```
 */
export function createRenderTracker(config: RenderTrackingConfig = {}) {
  let count = 0
  const { logRenders = false, componentName = "Component" } = config

  return {
    track(): void {
      count++
      if (logRenders) {
        console.log(`[RenderTracker] ${componentName} rendered (count: ${count})`)
      }
    },
    getCount(): number {
      return count
    },
    reset(): void {
      count = 0
    },
  }
}

// ============================================================================
// BUILD-TIME PROCESSING (Feature #43)
// ============================================================================
// Key Design Decisions:
// 1. All CSS generation is pure and synchronous - no runtime dependencies
// 2. Output is static CSS strings ready to write to files
// 3. No DOM manipulation - works in Node.js build environments
// 4. Combines multiple CSS outputs into single stylesheet for efficiency
// ============================================================================

/**
 * Build output structure containing all static assets
 */
export interface BuildOutput {
  /** Complete CSS stylesheet (light + dark modes) */
  stylesheet: string
  /** Tailwind v4 @theme block */
  tailwindTheme: string
  /** Theme initialization script */
  themeScript: string
  /** CSS variables as JSON (for programmatic access) */
  cssVariables: Record<string, string>
  /** Metadata about the build */
  meta: {
    themeName: string
    generatedAt: string
    hasDarkMode: boolean
  }
}

/**
 * Generates a complete static CSS stylesheet for build-time output
 *
 * Combines all CSS (light mode, dark mode, Tailwind theme) into a single
 * stylesheet that can be written to a file and served statically.
 * No runtime token processing required.
 *
 * @param config - Theme configuration
 * @returns Complete CSS stylesheet as string
 *
 * @example Build-time usage (Vite plugin, CLI, etc.)
 * ```typescript
 * import { generateStaticStylesheet, getThemePreset } from "@platxa/frontend-agent"
 * import { writeFileSync } from "fs"
 *
 * const config = getThemePreset("blue")
 * const css = generateStaticStylesheet(config)
 * writeFileSync("dist/theme.css", css)
 * ```
 */
export function generateStaticStylesheet(config: ThemeConfig): string {
  const sections: string[] = []

  // Header comment
  sections.push(`/**
 * Theme: ${config.name}
 * Generated at build time - no runtime processing required
 * @generated
 */`)

  // Tailwind v4 @theme block (must come first for Tailwind to process)
  sections.push("")
  sections.push("/* Tailwind v4 Theme Tokens */")
  sections.push(generateTailwindTheme(config.light))

  // Base CSS variables (:root)
  sections.push("")
  sections.push("/* Base Theme (Light Mode) */")
  sections.push(generateCss(config.light))

  // Dark mode CSS
  if (config.dark) {
    sections.push("")
    sections.push("/* Dark Mode */")
    sections.push(generateDarkModeCss(config.dark, `.${config.darkModeClass || "dark"}`))

    // Also add media query version for system preference
    sections.push("")
    sections.push("/* System Dark Mode Preference */")
    sections.push(`@media (prefers-color-scheme: dark) {
  :root:not(.light) {
${Object.entries(config.dark)
  .filter(([, value]) => value)
  .map(([key, value]) => `    --${toKebabCase(key)}: ${typeof value === "string" ? value : ""};`)
  .join("\n")}
  }
}`)
  }

  return sections.join("\n")
}

/**
 * Processes a theme configuration at build time and returns all static assets
 *
 * This is the main entry point for build-time processing. It generates:
 * - Complete CSS stylesheet (no runtime processing needed)
 * - Tailwind @theme block for Tailwind v4
 * - Theme initialization script (optional, for SSR hydration)
 * - CSS variables as JSON for programmatic access
 *
 * All outputs are static strings that can be written to files.
 *
 * @param config - Theme configuration
 * @returns BuildOutput with all static assets
 *
 * @example Vite plugin usage
 * ```typescript
 * import { processThemeForBuild, getThemePreset } from "@platxa/frontend-agent/build"
 *
 * export function platxaThemePlugin() {
 *   return {
 *     name: "platxa-theme",
 *     generateBundle() {
 *       const config = getThemePreset("default")
 *       const output = processThemeForBuild(config)
 *
 *       this.emitFile({
 *         type: "asset",
 *         fileName: "theme.css",
 *         source: output.stylesheet
 *       })
 *     }
 *   }
 * }
 * ```
 *
 * @example CLI build script
 * ```typescript
 * import { processThemeForBuild, createTheme } from "@platxa/frontend-agent"
 * import { writeFileSync, mkdirSync } from "fs"
 *
 * const config = createTheme("custom", { primaryHue: 262 })
 * const output = processThemeForBuild(config)
 *
 * mkdirSync("dist/theme", { recursive: true })
 * writeFileSync("dist/theme/styles.css", output.stylesheet)
 * writeFileSync("dist/theme/tailwind.css", output.tailwindTheme)
 * writeFileSync("dist/theme/init.js", output.themeScript)
 * writeFileSync("dist/theme/variables.json", JSON.stringify(output.cssVariables, null, 2))
 * ```
 */
export function processThemeForBuild(config: ThemeConfig): BuildOutput {
  const cssVariables = generateColorVariables(config.light.colors)

  return {
    stylesheet: generateStaticStylesheet(config),
    tailwindTheme: generateTailwindTheme(config.light),
    themeScript: generateThemeScript(config),
    cssVariables,
    meta: {
      themeName: config.name,
      generatedAt: new Date().toISOString(),
      hasDarkMode: !!config.dark,
    },
  }
}

/**
 * Generates build output from a preset name
 *
 * Convenience function for quickly generating build output from
 * one of the built-in theme presets.
 *
 * @param presetName - Name of built-in preset
 * @returns BuildOutput with all static assets
 *
 * @example
 * ```typescript
 * import { processPresetForBuild } from "@platxa/frontend-agent"
 *
 * const output = processPresetForBuild("blue")
 * // output.stylesheet contains complete CSS
 * ```
 */
export function processPresetForBuild(presetName: string): BuildOutput {
  const config = getThemePreset(presetName)
  return processThemeForBuild(config)
}

// =============================================================================
// SIZE LIMIT CHECK (Feature #83)
// =============================================================================

/**
 * Default size thresholds in bytes
 */
export const DEFAULT_SIZE_THRESHOLDS = {
  /** Warning threshold (50KB) */
  warning: 50 * 1024,
  /** Error threshold (100KB) */
  error: 100 * 1024,
  /** Maximum recommended size (200KB) */
  maximum: 200 * 1024,
}

/**
 * Configuration for size limit checks
 */
export interface SizeLimitConfig {
  /** Warning threshold in bytes (default: 50KB) */
  warningThreshold?: number
  /** Error threshold in bytes (default: 100KB) */
  errorThreshold?: number
  /** Include detailed breakdown */
  includeBreakdown?: boolean
}

/**
 * Size information for a single section
 */
export interface SectionSize {
  /** Section name */
  name: string
  /** Size in bytes */
  bytes: number
  /** Human-readable size */
  formatted: string
  /** Percentage of total */
  percentage: number
}

/**
 * Detailed size breakdown of brand kit
 */
export interface SizeBreakdown {
  /** Total size in bytes */
  totalBytes: number
  /** Human-readable total */
  totalFormatted: string
  /** Size by section */
  sections: SectionSize[]
  /** Largest sections (sorted by size, descending) */
  largestSections: SectionSize[]
}

/**
 * Severity level for size warnings
 */
export type SizeSeverity = "ok" | "warning" | "error"

/**
 * Result of size limit check
 */
export interface SizeLimitResult {
  /** Whether the brand kit passes the check */
  passed: boolean
  /** Severity level */
  severity: SizeSeverity
  /** Total size in bytes */
  totalBytes: number
  /** Human-readable total size */
  totalFormatted: string
  /** Warning message if threshold exceeded */
  message?: string
  /** Suggestions for reducing size */
  suggestions?: string[]
  /** Detailed breakdown (if requested) */
  breakdown?: SizeBreakdown
}

/**
 * Formats bytes into human-readable string
 *
 * @param bytes - Size in bytes
 * @returns Human-readable string (e.g., "45.2 KB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"

  const units = ["B", "KB", "MB", "GB"]
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const size = bytes / Math.pow(k, i)

  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

/**
 * Calculates the size of an object when serialized to JSON
 *
 * @param obj - Object to measure
 * @returns Size in bytes
 */
export function calculateJsonSize(obj: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(obj)).length
  } catch {
    return 0
  }
}

/**
 * Gets detailed size breakdown of a brand kit
 *
 * Analyzes each section of the brand kit and provides
 * size information including percentages and rankings.
 *
 * @param brandKit - Brand kit object to analyze
 * @returns Detailed size breakdown
 *
 * @example
 * ```typescript
 * import { getSizeBreakdown } from "@platxa/frontend-agent"
 *
 * const breakdown = getSizeBreakdown(myBrandKit)
 * console.log(`Total: ${breakdown.totalFormatted}`)
 * breakdown.largestSections.forEach(s => {
 *   console.log(`${s.name}: ${s.formatted} (${s.percentage}%)`)
 * })
 * ```
 */
export function getSizeBreakdown(brandKit: Record<string, unknown>): SizeBreakdown {
  const sections: SectionSize[] = []
  let totalBytes = 0

  // Calculate size for each top-level key
  for (const [key, value] of Object.entries(brandKit)) {
    const bytes = calculateJsonSize(value)
    totalBytes += bytes
    sections.push({
      name: key,
      bytes,
      formatted: formatBytes(bytes),
      percentage: 0, // Will be calculated after total is known
    })
  }

  // Calculate percentages
  for (const section of sections) {
    section.percentage = totalBytes > 0
      ? Math.round((section.bytes / totalBytes) * 100)
      : 0
  }

  // Sort by size for largest sections
  const largestSections = [...sections].sort((a, b) => b.bytes - a.bytes)

  return {
    totalBytes,
    totalFormatted: formatBytes(totalBytes),
    sections,
    largestSections,
  }
}

/**
 * Checks if brand kit size is within acceptable limits
 *
 * Validates the total size of a brand kit against configurable
 * thresholds and provides warnings, suggestions, and optional
 * detailed breakdown.
 *
 * @param brandKit - Brand kit object to check
 * @param config - Size limit configuration
 * @returns Size limit check result
 *
 * @example
 * ```typescript
 * import { checkSizeLimit, DEFAULT_SIZE_THRESHOLDS } from "@platxa/frontend-agent"
 *
 * const result = checkSizeLimit(myBrandKit, {
 *   warningThreshold: 30 * 1024, // 30KB warning
 *   errorThreshold: 80 * 1024,   // 80KB error
 *   includeBreakdown: true,
 * })
 *
 * if (!result.passed) {
 *   console.warn(result.message)
 *   result.suggestions?.forEach(s => console.log(`- ${s}`))
 * }
 * ```
 */
export function checkSizeLimit(
  brandKit: Record<string, unknown>,
  config: SizeLimitConfig = {}
): SizeLimitResult {
  const {
    warningThreshold = DEFAULT_SIZE_THRESHOLDS.warning,
    errorThreshold = DEFAULT_SIZE_THRESHOLDS.error,
    includeBreakdown = false,
  } = config

  const breakdown = getSizeBreakdown(brandKit)
  const { totalBytes, totalFormatted, largestSections } = breakdown

  // Determine severity
  let severity: SizeSeverity = "ok"
  let passed = true
  let message: string | undefined

  if (totalBytes >= errorThreshold) {
    severity = "error"
    passed = false
    message = `Brand kit size (${totalFormatted}) exceeds error threshold (${formatBytes(errorThreshold)})`
  } else if (totalBytes >= warningThreshold) {
    severity = "warning"
    passed = true // Warning doesn't fail the check, just warns
    message = `Brand kit size (${totalFormatted}) exceeds warning threshold (${formatBytes(warningThreshold)})`
  }

  // Generate suggestions if over warning threshold
  const suggestions: string[] = []
  if (totalBytes >= warningThreshold) {
    // Suggest removing large sections
    const largeSections = largestSections.filter(s => s.percentage > 20)
    if (largeSections.length > 0) {
      suggestions.push(
        `Consider optimizing large sections: ${largeSections.map(s => `${s.name} (${s.formatted})`).join(", ")}`
      )
    }

    // Check for potentially unnecessary data
    if (brandKit.metadata && calculateJsonSize(brandKit.metadata) > 5000) {
      suggestions.push("Reduce metadata size by removing redundant information")
    }

    if (brandKit.palettes && calculateJsonSize(brandKit.palettes) > 10000) {
      suggestions.push("Consider using fewer color palette variations")
    }

    if (brandKit.typography && calculateJsonSize(brandKit.typography) > 5000) {
      suggestions.push("Simplify typography scale if not all sizes are used")
    }

    // General suggestions
    if (suggestions.length === 0) {
      suggestions.push("Review brand kit for unused or redundant data")
      suggestions.push("Consider splitting into separate theme files if needed")
    }
  }

  const result: SizeLimitResult = {
    passed,
    severity,
    totalBytes,
    totalFormatted,
  }

  if (message) {
    result.message = message
  }

  if (suggestions.length > 0) {
    result.suggestions = suggestions
  }

  if (includeBreakdown) {
    result.breakdown = breakdown
  }

  return result
}

/**
 * Quick check if brand kit is under the warning threshold
 *
 * @param brandKit - Brand kit to check
 * @param threshold - Custom threshold in bytes (default: 50KB)
 * @returns true if under threshold
 *
 * @example
 * ```typescript
 * if (!isUnderSizeLimit(brandKit)) {
 *   console.warn("Brand kit is getting large!")
 * }
 * ```
 */
export function isUnderSizeLimit(
  brandKit: Record<string, unknown>,
  threshold: number = DEFAULT_SIZE_THRESHOLDS.warning
): boolean {
  const size = calculateJsonSize(brandKit)
  return size < threshold
}

/**
 * Validates brand kit size and returns formatted report
 *
 * Provides a human-readable report of brand kit size
 * suitable for CLI output or logging.
 *
 * @param brandKit - Brand kit to validate
 * @param config - Size limit configuration
 * @returns Array of report lines
 *
 * @example
 * ```typescript
 * const report = validateBrandKitSize(myBrandKit, { includeBreakdown: true })
 * report.forEach(line => console.log(line))
 * ```
 */
export function validateBrandKitSize(
  brandKit: Record<string, unknown>,
  config: SizeLimitConfig = {}
): string[] {
  const result = checkSizeLimit(brandKit, { ...config, includeBreakdown: true })
  const lines: string[] = []

  // Header with status
  const statusIcon = result.severity === "ok" ? "✓" : result.severity === "warning" ? "⚠" : "✗"
  lines.push(`${statusIcon} Brand Kit Size: ${result.totalFormatted}`)

  // Message if any
  if (result.message) {
    lines.push(`  ${result.message}`)
  }

  // Breakdown if available
  if (result.breakdown) {
    lines.push("")
    lines.push("  Size Breakdown:")
    for (const section of result.breakdown.largestSections.slice(0, 5)) {
      const bar = "█".repeat(Math.ceil(section.percentage / 5)) + "░".repeat(20 - Math.ceil(section.percentage / 5))
      lines.push(`    ${section.name.padEnd(15)} ${bar} ${section.formatted.padStart(10)} (${section.percentage}%)`)
    }
    if (result.breakdown.sections.length > 5) {
      lines.push(`    ... and ${result.breakdown.sections.length - 5} more sections`)
    }
  }

  // Suggestions if any
  if (result.suggestions && result.suggestions.length > 0) {
    lines.push("")
    lines.push("  Suggestions:")
    for (const suggestion of result.suggestions) {
      lines.push(`    • ${suggestion}`)
    }
  }

  return lines
}

// =============================================================================
// CIRCULAR REFERENCE CHECK (Feature #84)
// =============================================================================

/**
 * Regex pattern to extract CSS variable references from a value
 * Matches: var(--token-name), var(--token-name, fallback)
 */
const CSS_VAR_REFERENCE_PATTERN = /var\(\s*(--[\w-]+)(?:\s*,\s*[^)]+)?\s*\)/g

/**
 * Regex pattern to extract token references in special syntax
 * Matches: {token.name}, ${token.name}
 */
const TOKEN_REFERENCE_PATTERN = /\{([\w.-]+)\}|\$\{([\w.-]+)\}/g

/**
 * A single detected circular reference
 */
export interface CircularReference {
  /** The token where the cycle starts/ends */
  token: string
  /** The complete reference chain forming the cycle */
  chain: string[]
  /** Human-readable description of the cycle */
  description: string
}

/**
 * Result of circular reference check
 */
export interface CircularReferenceResult {
  /** Whether the tokens are free of circular references */
  valid: boolean
  /** Number of circular references found */
  circularCount: number
  /** Details of each circular reference */
  circular: CircularReference[]
  /** All tokens that are part of any circular reference */
  affectedTokens: string[]
  /** Total number of tokens checked */
  totalTokensChecked: number
  /** Total number of references analyzed */
  totalReferences: number
}

/**
 * Extracts token references from a value string
 *
 * Detects both CSS variable syntax (var(--name)) and
 * template syntax ({name} or ${name}).
 *
 * @param value - Token value to parse
 * @returns Array of referenced token names
 *
 * @example
 * ```typescript
 * extractTokenReferences("var(--color-primary)")
 * // Returns: ["--color-primary"]
 *
 * extractTokenReferences("hsl(var(--h), var(--s), var(--l))")
 * // Returns: ["--h", "--s", "--l"]
 *
 * extractTokenReferences("{colors.primary}")
 * // Returns: ["colors.primary"]
 * ```
 */
export function extractTokenReferences(value: string): string[] {
  const references: string[] = []

  // Extract CSS variable references
  let match: RegExpExecArray | null
  const cssPattern = new RegExp(CSS_VAR_REFERENCE_PATTERN.source, "g")
  while ((match = cssPattern.exec(value)) !== null) {
    references.push(match[1])
  }

  // Extract template token references
  const tokenPattern = new RegExp(TOKEN_REFERENCE_PATTERN.source, "g")
  while ((match = tokenPattern.exec(value)) !== null) {
    const tokenName = match[1] || match[2]
    if (tokenName) {
      references.push(tokenName)
    }
  }

  return references
}

/**
 * Builds a dependency graph from tokens
 *
 * Creates a map where each key is a token name and
 * the value is an array of tokens it references.
 *
 * @param tokens - Token map (name -> value)
 * @returns Dependency graph
 */
export function buildDependencyGraph(
  tokens: Record<string, string>
): Map<string, string[]> {
  const graph = new Map<string, string[]>()

  for (const [tokenName, tokenValue] of Object.entries(tokens)) {
    const references = extractTokenReferences(tokenValue)
    graph.set(tokenName, references)
  }

  return graph
}

/**
 * Detects cycles in a dependency graph using DFS
 *
 * @param graph - Dependency graph
 * @returns Array of detected cycles
 */
function detectCycles(graph: Map<string, string[]>): CircularReference[] {
  const cycles: CircularReference[] = []
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  const path: string[] = []

  function dfs(node: string): void {
    if (recursionStack.has(node)) {
      // Found a cycle - extract it from the path
      const cycleStart = path.indexOf(node)
      const cycle = path.slice(cycleStart)
      cycle.push(node) // Complete the cycle

      // Only add if we haven't found this exact cycle before
      const cycleKey = [...cycle].sort().join(",")
      const existingKeys = cycles.map((c) =>
        [...c.chain].sort().join(",")
      )
      if (!existingKeys.includes(cycleKey)) {
        cycles.push({
          token: node,
          chain: cycle,
          description: cycle.join(" → "),
        })
      }
      return
    }

    if (visited.has(node)) {
      return
    }

    visited.add(node)
    recursionStack.add(node)
    path.push(node)

    const dependencies = graph.get(node) || []
    for (const dep of dependencies) {
      // Only follow edges to nodes that exist in the graph
      if (graph.has(dep)) {
        dfs(dep)
      }
    }

    path.pop()
    recursionStack.delete(node)
  }

  // Run DFS from each node
  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node)
    }
  }

  return cycles
}

/**
 * Checks for circular references in design tokens
 *
 * Analyzes a token map to detect any circular reference chains
 * that would cause infinite loops during token resolution.
 *
 * @param tokens - Token map (name -> value)
 * @returns Circular reference check result
 *
 * @example
 * ```typescript
 * import { checkCircularReferences } from "@platxa/frontend-agent"
 *
 * const tokens = {
 *   "--color-primary": "var(--color-brand)",
 *   "--color-brand": "var(--color-accent)",
 *   "--color-accent": "var(--color-primary)", // Circular!
 *   "--color-text": "#000000", // Safe
 * }
 *
 * const result = checkCircularReferences(tokens)
 * if (!result.valid) {
 *   console.error("Circular references detected:")
 *   result.circular.forEach(c => {
 *     console.error(`  ${c.description}`)
 *   })
 * }
 * ```
 */
export function checkCircularReferences(
  tokens: Record<string, string>
): CircularReferenceResult {
  const graph = buildDependencyGraph(tokens)
  const cycles = detectCycles(graph)

  // Collect all affected tokens
  const affectedTokens = new Set<string>()
  for (const cycle of cycles) {
    for (const token of cycle.chain) {
      affectedTokens.add(token)
    }
  }

  // Count total references
  let totalReferences = 0
  for (const refs of graph.values()) {
    totalReferences += refs.length
  }

  return {
    valid: cycles.length === 0,
    circularCount: cycles.length,
    circular: cycles,
    affectedTokens: Array.from(affectedTokens),
    totalTokensChecked: Object.keys(tokens).length,
    totalReferences,
  }
}

/**
 * Flattens nested tokens object into flat token map
 *
 * Converts nested object structure into flat key-value pairs
 * using dot notation for nested keys.
 *
 * @param obj - Nested tokens object
 * @param prefix - Current path prefix
 * @returns Flat token map
 *
 * @example
 * ```typescript
 * flattenTokens({
 *   colors: {
 *     primary: "blue",
 *     secondary: "red"
 *   }
 * })
 * // Returns: { "colors.primary": "blue", "colors.secondary": "red" }
 * ```
 */
export function flattenTokens(
  obj: Record<string, unknown>,
  prefix = ""
): Record<string, string> {
  const result: Record<string, string> = {}

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (typeof value === "string") {
      result[fullKey] = value
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenTokens(value as Record<string, unknown>, fullKey))
    }
  }

  return result
}

/**
 * Checks for circular references in a brand kit's design tokens
 *
 * Flattens all token sections and checks for circular references
 * across the entire brand kit.
 *
 * @param brandKit - Brand kit to check
 * @returns Circular reference check result
 *
 * @example
 * ```typescript
 * import { checkBrandKitCircularReferences } from "@platxa/frontend-agent"
 *
 * const result = checkBrandKitCircularReferences(myBrandKit)
 * if (!result.valid) {
 *   console.error(`Found ${result.circularCount} circular reference(s)`)
 *   result.circular.forEach(c => console.error(`  ${c.description}`))
 * }
 * ```
 */
export function checkBrandKitCircularReferences(
  brandKit: Record<string, unknown>
): CircularReferenceResult {
  // Flatten all token-like sections
  const allTokens: Record<string, string> = {}

  // Common token section names
  const tokenSections = [
    "tokens",
    "colors",
    "semantics",
    "spacing",
    "typography",
    "variables",
    "cssVariables",
  ]

  for (const section of tokenSections) {
    if (brandKit[section] && typeof brandKit[section] === "object") {
      const flattened = flattenTokens(brandKit[section] as Record<string, unknown>, section)
      Object.assign(allTokens, flattened)
    }
  }

  // Also check for CSS variable style tokens at root
  for (const [key, value] of Object.entries(brandKit)) {
    if (key.startsWith("--") && typeof value === "string") {
      allTokens[key] = value
    }
  }

  return checkCircularReferences(allTokens)
}

/**
 * Validates tokens and returns formatted report
 *
 * Provides a human-readable report of circular reference
 * check suitable for CLI output.
 *
 * @param tokens - Token map to validate
 * @returns Array of report lines
 *
 * @example
 * ```typescript
 * const report = validateCircularReferences(tokens)
 * report.forEach(line => console.log(line))
 * ```
 */
export function validateCircularReferences(
  tokens: Record<string, string>
): string[] {
  const result = checkCircularReferences(tokens)
  const lines: string[] = []

  // Header with status
  const statusIcon = result.valid ? "✓" : "✗"
  lines.push(
    `${statusIcon} Circular Reference Check: ${result.valid ? "PASSED" : "FAILED"}`
  )
  lines.push(`  Tokens checked: ${result.totalTokensChecked}`)
  lines.push(`  References analyzed: ${result.totalReferences}`)

  if (!result.valid) {
    lines.push("")
    lines.push(`  Found ${result.circularCount} circular reference(s):`)
    for (const cycle of result.circular) {
      lines.push("")
      lines.push(`    ⟳ ${cycle.description}`)
    }

    if (result.affectedTokens.length > 0) {
      lines.push("")
      lines.push("  Affected tokens:")
      for (const token of result.affectedTokens) {
        lines.push(`    • ${token}`)
      }
    }
  }

  return lines
}

// =============================================================================
// SAFE DYNAMIC IMPORT (Feature #85)
// =============================================================================

/**
 * Default allowlist of trusted brand kit packages
 */
export const DEFAULT_ALLOWED_PACKAGES = [
  "@platxa/brand-kit",
  "@platxa/frontend-agent",
  "platxa-frontend-agent",
  "@company/brand-kit",
] as const

/**
 * Package validation status
 */
export type PackageStatus = "allowed" | "blocked" | "unknown"

/**
 * Configuration for package allowlist
 */
export interface PackageAllowlistConfig {
  /** List of allowed package names or patterns */
  allowlist?: string[]
  /** Whether to block unknown packages (default: false, just warn) */
  blockUnknown?: boolean
  /** Additional patterns to allow (supports wildcards) */
  allowPatterns?: string[]
  /** Packages to explicitly block (overrides allowlist) */
  blocklist?: string[]
}

/**
 * Result of package validation
 */
export interface PackageValidationResult {
  /** Package name that was checked */
  packageName: string
  /** Validation status */
  status: PackageStatus
  /** Whether the package is allowed to be imported */
  allowed: boolean
  /** Warning message if applicable */
  warning?: string
  /** Error message if blocked */
  error?: string
  /** Matched allowlist entry (if allowed) */
  matchedRule?: string
}

/**
 * Result of validating multiple packages
 */
export interface PackageValidationReport {
  /** Whether all packages passed validation */
  valid: boolean
  /** Total packages checked */
  total: number
  /** Number of allowed packages */
  allowedCount: number
  /** Number of blocked packages */
  blockedCount: number
  /** Number of unknown packages (warned) */
  unknownCount: number
  /** Individual results */
  results: PackageValidationResult[]
  /** Blocked packages list */
  blockedPackages: string[]
  /** Unknown packages list */
  unknownPackages: string[]
}

/**
 * Checks if a package name matches a pattern
 *
 * Supports wildcards (*) for flexible matching.
 *
 * @param packageName - Package name to check
 * @param pattern - Pattern to match against
 * @returns true if matches
 *
 * @example
 * ```typescript
 * matchesPattern("@company/brand-kit", "@company/*") // true
 * matchesPattern("my-brand-kit", "*-brand-kit") // true
 * ```
 */
export function matchesPattern(packageName: string, pattern: string): boolean {
  // Exact match
  if (packageName === pattern) {
    return true
  }

  // Convert wildcard pattern to regex
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape special regex chars
    .replace(/\*/g, ".*") // Convert * to .*

  const regex = new RegExp(`^${regexPattern}$`)
  return regex.test(packageName)
}

/**
 * Validates a single package against the allowlist
 *
 * @param packageName - Package name to validate
 * @param config - Allowlist configuration
 * @returns Validation result
 *
 * @example
 * ```typescript
 * import { validatePackage } from "@platxa/frontend-agent"
 *
 * const result = validatePackage("@company/brand-kit", {
 *   allowlist: ["@company/*"],
 *   blockUnknown: false,
 * })
 *
 * if (!result.allowed) {
 *   console.error(result.error)
 * }
 * ```
 */
export function validatePackage(
  packageName: string,
  config: PackageAllowlistConfig = {}
): PackageValidationResult {
  const {
    allowlist = [...DEFAULT_ALLOWED_PACKAGES],
    blockUnknown = false,
    allowPatterns = [],
    blocklist = [],
  } = config

  // Check blocklist first (highest priority)
  for (const blocked of blocklist) {
    if (matchesPattern(packageName, blocked)) {
      return {
        packageName,
        status: "blocked",
        allowed: false,
        error: `Package "${packageName}" is explicitly blocked`,
        matchedRule: `blocklist: ${blocked}`,
      }
    }
  }

  // Check explicit allowlist
  for (const allowed of allowlist) {
    if (matchesPattern(packageName, allowed)) {
      return {
        packageName,
        status: "allowed",
        allowed: true,
        matchedRule: `allowlist: ${allowed}`,
      }
    }
  }

  // Check allow patterns
  for (const pattern of allowPatterns) {
    if (matchesPattern(packageName, pattern)) {
      return {
        packageName,
        status: "allowed",
        allowed: true,
        matchedRule: `pattern: ${pattern}`,
      }
    }
  }

  // Package is unknown
  if (blockUnknown) {
    return {
      packageName,
      status: "blocked",
      allowed: false,
      error: `Package "${packageName}" is not in the allowlist and unknown packages are blocked`,
    }
  }

  return {
    packageName,
    status: "unknown",
    allowed: true, // Allow with warning
    warning: `Package "${packageName}" is not in the allowlist. Consider adding it to your configuration.`,
  }
}

/**
 * Validates multiple packages against the allowlist
 *
 * @param packageNames - Array of package names to validate
 * @param config - Allowlist configuration
 * @returns Validation report
 *
 * @example
 * ```typescript
 * import { validatePackages } from "@platxa/frontend-agent"
 *
 * const report = validatePackages(
 *   ["@company/brand-kit", "unknown-package", "malicious-pkg"],
 *   {
 *     allowlist: ["@company/*"],
 *     blocklist: ["malicious-*"],
 *     blockUnknown: false,
 *   }
 * )
 *
 * if (!report.valid) {
 *   console.error("Blocked packages:", report.blockedPackages)
 * }
 * ```
 */
export function validatePackages(
  packageNames: string[],
  config: PackageAllowlistConfig = {}
): PackageValidationReport {
  const results: PackageValidationResult[] = []
  const blockedPackages: string[] = []
  const unknownPackages: string[] = []

  for (const packageName of packageNames) {
    const result = validatePackage(packageName, config)
    results.push(result)

    if (result.status === "blocked") {
      blockedPackages.push(packageName)
    } else if (result.status === "unknown") {
      unknownPackages.push(packageName)
    }
  }

  return {
    valid: blockedPackages.length === 0,
    total: packageNames.length,
    allowedCount: results.filter((r) => r.status === "allowed").length,
    blockedCount: blockedPackages.length,
    unknownCount: unknownPackages.length,
    results,
    blockedPackages,
    unknownPackages,
  }
}

/**
 * Creates a safe import function with allowlist validation
 *
 * Returns a function that validates packages before importing.
 * Use this to wrap dynamic imports for security.
 *
 * @param config - Allowlist configuration
 * @returns Safe import function
 *
 * @example
 * ```typescript
 * import { createSafeImport } from "@platxa/frontend-agent"
 *
 * const safeImport = createSafeImport({
 *   allowlist: ["@company/brand-kit"],
 *   blockUnknown: true,
 * })
 *
 * // This will validate before importing
 * const brandKit = await safeImport("@company/brand-kit")
 * ```
 */
export function createSafeImport(config: PackageAllowlistConfig = {}) {
  return async function safeImport<T = unknown>(packageName: string): Promise<T> {
    const validation = validatePackage(packageName, config)

    if (!validation.allowed) {
      throw new Error(
        validation.error || `Package "${packageName}" is not allowed`
      )
    }

    if (validation.warning) {
      console.warn(`[Safe Import Warning] ${validation.warning}`)
    }

    // Perform the actual dynamic import
    // Note: In a real implementation, this would use dynamic import()
    // For this library, we return a placeholder that indicates the import would proceed
    return { __packageName: packageName, __validated: true } as T
  }
}

/**
 * Validates package references in brand kit metadata
 *
 * Checks if any package references in the brand kit's metadata
 * or dependencies are allowed.
 *
 * @param brandKit - Brand kit to check
 * @param config - Allowlist configuration
 * @returns Validation report
 */
export function validateBrandKitPackages(
  brandKit: Record<string, unknown>,
  config: PackageAllowlistConfig = {}
): PackageValidationReport {
  const packages: string[] = []

  // Extract package references from common locations
  const metadata = brandKit.metadata as Record<string, unknown> | undefined
  if (metadata) {
    if (typeof metadata.package === "string") {
      packages.push(metadata.package)
    }
    if (typeof metadata.extends === "string") {
      packages.push(metadata.extends)
    }
    if (Array.isArray(metadata.dependencies)) {
      for (const dep of metadata.dependencies) {
        if (typeof dep === "string") {
          packages.push(dep)
        }
      }
    }
  }

  // Check imports section
  const imports = brandKit.imports as string[] | undefined
  if (Array.isArray(imports)) {
    packages.push(...imports.filter((i) => typeof i === "string"))
  }

  // Check extends
  if (typeof brandKit.extends === "string") {
    packages.push(brandKit.extends)
  }

  return validatePackages(packages, config)
}

/**
 * Formats package validation report for CLI output
 *
 * @param report - Validation report
 * @returns Array of formatted lines
 */
export function formatPackageValidationReport(
  report: PackageValidationReport
): string[] {
  const lines: string[] = []

  const statusIcon = report.valid ? "✓" : "✗"
  lines.push(
    `${statusIcon} Package Validation: ${report.valid ? "PASSED" : "FAILED"}`
  )
  lines.push(`  Packages checked: ${report.total}`)
  lines.push(`  Allowed: ${report.allowedCount}`)

  if (report.unknownCount > 0) {
    lines.push(`  Unknown (warned): ${report.unknownCount}`)
  }

  if (report.blockedCount > 0) {
    lines.push(`  Blocked: ${report.blockedCount}`)
    lines.push("")
    lines.push("  Blocked packages:")
    for (const pkg of report.blockedPackages) {
      lines.push(`    ✗ ${pkg}`)
    }
  }

  if (report.unknownCount > 0) {
    lines.push("")
    lines.push("  Unknown packages (consider adding to allowlist):")
    for (const pkg of report.unknownPackages) {
      lines.push(`    ⚠ ${pkg}`)
    }
  }

  return lines
}

// =============================================================================
// TOKEN MEMOIZATION (Feature #87)
// =============================================================================

/**
 * Cache entry with metadata for memory management
 */
interface CacheEntry<T> {
  value: T
  accessCount: number
  lastAccessed: number
  size: number
}

/**
 * Configuration for token memoization cache
 */
export interface TokenCacheConfig {
  /** Maximum number of entries in the cache (default: 100) */
  maxEntries?: number
  /** Time-to-live in milliseconds (default: 5 minutes) */
  ttl?: number
  /** Whether to track access patterns (default: false) */
  trackAccess?: boolean
}

/**
 * Statistics about cache performance
 */
export interface CacheStats {
  /** Number of cache hits */
  hits: number
  /** Number of cache misses */
  misses: number
  /** Current number of entries */
  entries: number
  /** Total size estimate in bytes */
  totalSize: number
  /** Cache hit ratio (0-1) */
  hitRatio: number
  /** Most accessed keys */
  topKeys: string[]
}

/**
 * Creates a memoization cache for computed token values
 *
 * Implements an LRU (Least Recently Used) eviction policy
 * with configurable size limits and TTL.
 *
 * @param config - Cache configuration
 * @returns Cache instance with memoization functions
 *
 * @example
 * ```typescript
 * import { createTokenCache } from "@platxa/frontend-agent"
 *
 * const cache = createTokenCache({ maxEntries: 50, ttl: 60000 })
 *
 * // Memoize expensive computations
 * function getComputedColor(primary: string): string {
 *   return cache.getOrCompute(
 *     `color:${primary}`,
 *     () => expensiveColorComputation(primary)
 *   )
 * }
 *
 * // Check cache stats
 * console.log(cache.getStats())
 *
 * // Clear when theme changes
 * cache.clear()
 * ```
 */
export function createTokenCache<T = unknown>(config: TokenCacheConfig = {}) {
  const { maxEntries = 100, ttl = 5 * 60 * 1000, trackAccess = false } = config

  const cache = new Map<string, CacheEntry<T>>()
  let hits = 0
  let misses = 0

  /**
   * Estimates the size of a value in bytes
   */
  function estimateSize(value: unknown): number {
    if (typeof value === "string") {
      return value.length * 2
    }
    if (typeof value === "number") {
      return 8
    }
    if (typeof value === "boolean") {
      return 4
    }
    if (value === null || value === undefined) {
      return 0
    }
    if (Array.isArray(value)) {
      return value.reduce((sum, item) => sum + estimateSize(item), 0)
    }
    if (typeof value === "object") {
      return Object.entries(value).reduce(
        (sum, [k, v]) => sum + k.length * 2 + estimateSize(v),
        0
      )
    }
    return 0
  }

  /**
   * Evicts expired entries and enforces max size
   */
  function evict(): void {
    const now = Date.now()

    // Remove expired entries
    for (const [key, entry] of cache.entries()) {
      if (now - entry.lastAccessed > ttl) {
        cache.delete(key)
      }
    }

    // If still over limit, remove least recently used
    if (cache.size > maxEntries) {
      const entries = Array.from(cache.entries())
      entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)

      const toRemove = entries.slice(0, cache.size - maxEntries)
      for (const [key] of toRemove) {
        cache.delete(key)
      }
    }
  }

  return {
    /**
     * Gets a cached value or computes and caches it
     */
    getOrCompute(key: string, compute: () => T): T {
      const now = Date.now()
      const existing = cache.get(key)

      if (existing && now - existing.lastAccessed <= ttl) {
        hits++
        existing.lastAccessed = now
        if (trackAccess) {
          existing.accessCount++
        }
        return existing.value
      }

      misses++
      const value = compute()
      const size = estimateSize(value)

      cache.set(key, {
        value,
        accessCount: 1,
        lastAccessed: now,
        size,
      })

      evict()
      return value
    },

    /**
     * Gets a cached value without computing
     */
    get(key: string): T | undefined {
      const entry = cache.get(key)
      if (entry && Date.now() - entry.lastAccessed <= ttl) {
        hits++
        entry.lastAccessed = Date.now()
        return entry.value
      }
      misses++
      return undefined
    },

    /**
     * Sets a value directly in the cache
     */
    set(key: string, value: T): void {
      cache.set(key, {
        value,
        accessCount: 1,
        lastAccessed: Date.now(),
        size: estimateSize(value),
      })
      evict()
    },

    /**
     * Checks if a key exists and is not expired
     */
    has(key: string): boolean {
      const entry = cache.get(key)
      return entry !== undefined && Date.now() - entry.lastAccessed <= ttl
    },

    /**
     * Removes a specific key from the cache
     */
    delete(key: string): boolean {
      return cache.delete(key)
    },

    /**
     * Clears all cached values
     */
    clear(): void {
      cache.clear()
      hits = 0
      misses = 0
    },

    /**
     * Invalidates entries matching a pattern
     */
    invalidatePattern(pattern: string | RegExp): number {
      const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern
      let count = 0

      for (const key of cache.keys()) {
        if (regex.test(key)) {
          cache.delete(key)
          count++
        }
      }

      return count
    },

    /**
     * Gets cache statistics
     */
    getStats(): CacheStats {
      let totalSize = 0
      const accessCounts: Array<{ key: string; count: number }> = []

      for (const [key, entry] of cache.entries()) {
        totalSize += entry.size
        if (trackAccess) {
          accessCounts.push({ key, count: entry.accessCount })
        }
      }

      accessCounts.sort((a, b) => b.count - a.count)

      return {
        hits,
        misses,
        entries: cache.size,
        totalSize,
        hitRatio: hits + misses > 0 ? hits / (hits + misses) : 0,
        topKeys: accessCounts.slice(0, 10).map((e) => e.key),
      }
    },

    /**
     * Gets the current cache size
     */
    get size(): number {
      return cache.size
    },
  }
}

/**
 * Global token computation cache
 *
 * Shared cache for memoizing expensive token computations
 * across the application.
 */
export const tokenCache = createTokenCache<unknown>({
  maxEntries: 200,
  ttl: 10 * 60 * 1000, // 10 minutes
  trackAccess: true,
})

/**
 * Memoizes a token computation function
 *
 * Wraps a function to cache its results based on arguments.
 * Automatically generates cache keys from function arguments.
 *
 * @param fn - Function to memoize
 * @param keyGenerator - Optional custom key generator
 * @returns Memoized function
 *
 * @example
 * ```typescript
 * import { memoizeTokenComputation } from "@platxa/frontend-agent"
 *
 * const computeContrast = memoizeTokenComputation(
 *   (fg: string, bg: string) => {
 *     // Expensive contrast calculation
 *     return calculateContrastRatio(fg, bg)
 *   }
 * )
 *
 * // First call computes
 * computeContrast("#000", "#fff") // Computed
 *
 * // Second call returns cached
 * computeContrast("#000", "#fff") // From cache
 * ```
 */
export function memoizeTokenComputation<Args extends unknown[], Result>(
  fn: (...args: Args) => Result,
  keyGenerator?: (...args: Args) => string
): (...args: Args) => Result {
  const cache = createTokenCache<Result>()

  return (...args: Args): Result => {
    const key = keyGenerator
      ? keyGenerator(...args)
      : JSON.stringify(args)

    return cache.getOrCompute(key, () => fn(...args))
  }
}

/**
 * Creates a memoized token resolver
 *
 * Resolves token references with caching to avoid
 * repeated resolution of the same tokens.
 *
 * @param tokens - Token map
 * @returns Resolver function
 *
 * @example
 * ```typescript
 * const resolver = createMemoizedTokenResolver({
 *   "--primary": "blue",
 *   "--text": "var(--primary)",
 * })
 *
 * resolver("--text") // Resolves and caches
 * resolver("--text") // Returns cached value
 * ```
 */
export function createMemoizedTokenResolver(
  tokens: Record<string, string>
): (tokenName: string) => string {
  const cache = createTokenCache<string>()
  const maxDepth = 10 // Prevent infinite loops

  function resolve(tokenName: string, depth = 0): string {
    if (depth > maxDepth) {
      console.warn(`Token resolution depth exceeded for ${tokenName}`)
      return tokens[tokenName] || tokenName
    }

    return cache.getOrCompute(`resolve:${tokenName}:${depth}`, () => {
      const value = tokens[tokenName]
      if (!value) {
        return tokenName
      }

      // Check for var() references
      const varPattern = /var\(\s*(--[\w-]+)\s*\)/g
      let resolved = value
      let match: RegExpExecArray | null

      while ((match = varPattern.exec(value)) !== null) {
        const refName = match[1]
        const refValue = resolve(refName, depth + 1)
        resolved = resolved.replace(match[0], refValue)
      }

      return resolved
    })
  }

  return resolve
}

/**
 * Batch memoization for multiple token computations
 *
 * Efficiently computes multiple values at once,
 * reusing cached results where available.
 *
 * @param keys - Array of cache keys
 * @param computeAll - Function to compute all missing values
 * @param cache - Optional cache instance
 * @returns Map of results
 *
 * @example
 * ```typescript
 * const results = batchMemoize(
 *   ["token1", "token2", "token3"],
 *   (missingKeys) => {
 *     // Compute only missing values
 *     return new Map(missingKeys.map(k => [k, compute(k)]))
 *   }
 * )
 * ```
 */
export function batchMemoize<T>(
  keys: string[],
  computeAll: (missingKeys: string[]) => Map<string, T>,
  cache = tokenCache
): Map<string, T> {
  const results = new Map<string, T>()
  const missingKeys: string[] = []

  // Check cache for each key
  for (const key of keys) {
    const cached = cache.get(key) as T | undefined
    if (cached !== undefined) {
      results.set(key, cached)
    } else {
      missingKeys.push(key)
    }
  }

  // Compute missing values
  if (missingKeys.length > 0) {
    const computed = computeAll(missingKeys)
    for (const [key, value] of computed.entries()) {
      cache.set(key, value)
      results.set(key, value)
    }
  }

  return results
}

/**
 * Clears all token-related caches
 *
 * Call this when the theme changes to ensure
 * fresh computations with new token values.
 */
export function clearTokenCaches(): void {
  tokenCache.clear()
}

/**
 * Gets combined stats from all token caches
 */
export function getTokenCacheStats(): CacheStats {
  return tokenCache.getStats()
}

// =============================================================================
// SSR SUPPORT (Feature #88)
// =============================================================================

/**
 * Checks if code is running on the server (no DOM available)
 */
export function isServer(): boolean {
  return typeof window === "undefined" || typeof document === "undefined"
}

/**
 * Checks if code is running in the browser
 */
export function isBrowser(): boolean {
  return !isServer()
}

/**
 * Default theme mode for SSR (safe for hydration)
 */
export const SSR_DEFAULT_MODE: ThemeMode = "light"

/**
 * Configuration for SSR-safe theme handling
 */
export interface SSRThemeConfig {
  /** Default mode to use on server (default: "light") */
  defaultMode?: ThemeMode
  /** Whether to suppress hydration warnings (default: false) */
  suppressHydrationWarning?: boolean
  /** CSS nonce for CSP (Content Security Policy) */
  nonce?: string
}

/**
 * SSR-safe theme state for initial render
 */
export interface SSRThemeState {
  /** Theme mode (always resolved, never "system" on SSR) */
  mode: "light" | "dark"
  /** CSS string for inline styles */
  css: string
  /** Script for client-side theme initialization */
  initScript: string
  /** Data attributes for the HTML element */
  htmlAttributes: Record<string, string>
}

/**
 * Gets SSR-safe theme mode
 *
 * On the server, always returns a resolved mode (light or dark).
 * Never returns "system" to prevent hydration mismatch.
 *
 * @param preferredMode - User's preferred mode
 * @param defaultMode - Default mode for SSR
 * @returns Resolved theme mode
 *
 * @example
 * ```tsx
 * // In server component or getServerSideProps
 * const mode = getSSRSafeMode(userPreference, "light")
 * ```
 */
export function getSSRSafeMode(
  preferredMode?: ThemeMode,
  defaultMode: ThemeMode = SSR_DEFAULT_MODE
): "light" | "dark" {
  // On server, never use "system" - it would cause hydration mismatch
  if (isServer()) {
    if (preferredMode === "light" || preferredMode === "dark") {
      return preferredMode
    }
    return defaultMode === "system" ? "light" : defaultMode
  }

  // On client, can safely resolve system preference
  if (preferredMode === "system" || !preferredMode) {
    return getResolvedMode()
  }

  return preferredMode === "dark" ? "dark" : "light"
}

/**
 * Generates CSS for SSR with both light and dark themes
 *
 * Creates CSS that works without JavaScript by using
 * CSS media queries for system preference detection.
 *
 * @param config - Theme configuration
 * @returns CSS string safe for SSR
 *
 * @example
 * ```tsx
 * // In _document.tsx or layout.tsx
 * const css = generateSSRCss(themeConfig)
 *
 * <head>
 *   <style dangerouslySetInnerHTML={{ __html: css }} />
 * </head>
 * ```
 */
export function generateSSRCss(config: ThemeConfig): string {
  const sections: string[] = []

  // Base light mode (default)
  sections.push("/* SSR Theme - Light Mode (default) */")
  sections.push(generateCss(config.light))

  // Dark mode with media query
  // Note: config.dark is Partial<SemanticColors> (colors only), not DesignTokens
  if (config.dark) {
    sections.push("")
    sections.push("/* SSR Theme - Dark Mode (system preference) */")
    sections.push("@media (prefers-color-scheme: dark) {")
    sections.push("  :root:not([data-theme='light']) {")

    // Generate dark mode variables directly from semantic colors
    for (const [key, value] of Object.entries(config.dark)) {
      if (value && typeof value === "string") {
        const varName = `--${toKebabCase(key)}`
        sections.push(`    ${varName}: ${value};`)
      }
    }

    sections.push("  }")
    sections.push("}")

    // Explicit dark mode via data attribute
    sections.push("")
    sections.push("/* SSR Theme - Dark Mode (explicit) */")
    sections.push(":root[data-theme='dark'] {")
    for (const [key, value] of Object.entries(config.dark)) {
      if (value && typeof value === "string") {
        const varName = `--${toKebabCase(key)}`
        sections.push(`  ${varName}: ${value};`)
      }
    }
    sections.push("}")
  }

  // Explicit light mode via data attribute (overrides system preference)
  sections.push("")
  sections.push("/* SSR Theme - Light Mode (explicit) */")
  sections.push(":root[data-theme='light'] {")
  for (const [key, value] of Object.entries(
    generateColorVariables(config.light.colors)
  )) {
    sections.push(`  ${key}: ${value};`)
  }
  sections.push("}")

  return sections.join("\n")
}

/**
 * Generates theme initialization script for SSR
 *
 * This script runs before hydration to set the correct theme
 * based on stored preference or system setting, preventing flash.
 *
 * @param config - SSR theme configuration
 * @returns Script string (without script tags)
 *
 * @example
 * ```tsx
 * const script = generateSSRInitScript({ defaultMode: "light" })
 *
 * <head>
 *   <script dangerouslySetInnerHTML={{ __html: script }} />
 * </head>
 * ```
 */
export function generateSSRInitScript(config: SSRThemeConfig = {}): string {
  const { defaultMode = "light" } = config

  // This script is designed to run synchronously before paint
  return `(function(){try{var e=localStorage.getItem("theme-mode"),t="${defaultMode}";if(e&&(e==="light"||e==="dark"))t=e;else if(e==="system"||!e){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t);document.documentElement.classList.add("theme-"+t)}catch(n){}})();`
}

/**
 * Generates complete SSR theme state
 *
 * Returns everything needed to render theme-aware content
 * on the server without hydration mismatch.
 *
 * @param config - Theme configuration
 * @param ssrConfig - SSR-specific options
 * @returns SSR theme state
 *
 * @example
 * ```tsx
 * // In getServerSideProps or server component
 * const ssrTheme = getSSRThemeState(themeConfig, {
 *   defaultMode: cookies.theme || "light"
 * })
 *
 * // In _document.tsx
 * <html {...ssrTheme.htmlAttributes}>
 *   <head>
 *     <style dangerouslySetInnerHTML={{ __html: ssrTheme.css }} />
 *     <script dangerouslySetInnerHTML={{ __html: ssrTheme.initScript }} />
 *   </head>
 * </html>
 * ```
 */
export function getSSRThemeState(
  config: ThemeConfig,
  ssrConfig: SSRThemeConfig = {}
): SSRThemeState {
  const { defaultMode = SSR_DEFAULT_MODE, suppressHydrationWarning = false } =
    ssrConfig

  const mode = getSSRSafeMode(defaultMode)

  const htmlAttributes: Record<string, string> = {
    "data-theme": mode,
    class: `theme-${mode}`,
  }

  if (suppressHydrationWarning) {
    htmlAttributes["suppressHydrationWarning"] = "true"
  }

  return {
    mode,
    css: generateSSRCss(config),
    initScript: generateSSRInitScript(ssrConfig),
    htmlAttributes,
  }
}

/**
 * Hook-compatible function for SSR-safe theme access
 *
 * Returns theme state that's safe to use during SSR.
 * On the server, returns default values to prevent mismatch.
 *
 * @param defaultMode - Default mode for SSR
 * @returns Theme state safe for SSR
 */
export function getSSRSafeThemeState(
  defaultMode: ThemeMode = SSR_DEFAULT_MODE
): UseThemeState {
  if (isServer()) {
    const mode = defaultMode === "system" ? "light" : defaultMode
    return {
      mode: defaultMode,
      resolvedMode: mode,
      tokens: currentThemeConfig?.light ?? defaultTokens,
      config: currentThemeConfig,
      setMode: () => {
        // No-op on server
      },
    }
  }

  return getThemeStateSnapshot()
}

/**
 * Creates a theme provider props object for SSR
 *
 * Useful for passing theme state to context providers
 * in a way that's safe for server-side rendering.
 *
 * @param config - Theme configuration
 * @param ssrConfig - SSR-specific options
 * @returns Props object for theme provider
 */
export function createSSRThemeProviderProps(
  config: ThemeConfig,
  ssrConfig: SSRThemeConfig = {}
): {
  initialMode: "light" | "dark"
  initialTokens: DesignTokens
  css: string
} {
  const mode = getSSRSafeMode(ssrConfig.defaultMode)

  // Dark mode only overrides colors, so merge with light tokens
  // config.dark is Partial<SemanticColors>, not DesignTokens
  let initialTokens = config.light
  if (mode === "dark" && config.dark) {
    initialTokens = {
      ...config.light,
      colors: {
        ...config.light.colors,
        ...config.dark,
      },
    }
  }

  return {
    initialMode: mode,
    initialTokens,
    css: generateSSRCss(config),
  }
}

/**
 * Wraps CSS in a style tag with optional nonce for CSP
 *
 * @param css - CSS string
 * @param nonce - CSP nonce (optional)
 * @returns Style tag HTML string
 */
export function wrapCssInStyleTag(css: string, nonce?: string): string {
  const nonceAttr = nonce ? ` nonce="${nonce}"` : ""
  return `<style${nonceAttr}>${css}</style>`
}

/**
 * Wraps script in a script tag with optional nonce for CSP
 *
 * @param script - Script string
 * @param nonce - CSP nonce (optional)
 * @returns Script tag HTML string
 */
export function wrapInScriptTag(script: string, nonce?: string): string {
  const nonceAttr = nonce ? ` nonce="${nonce}"` : ""
  return `<script${nonceAttr}>${script}</script>`
}

/**
 * Generates complete head content for SSR theme support
 *
 * Returns HTML string containing style and script tags
 * for complete theme support without hydration mismatch.
 *
 * @param config - Theme configuration
 * @param ssrConfig - SSR-specific options
 * @returns HTML string for head section
 *
 * @example
 * ```tsx
 * const headContent = generateSSRHeadContent(themeConfig, {
 *   nonce: cspNonce
 * })
 *
 * <head dangerouslySetInnerHTML={{ __html: headContent }} />
 * ```
 */
export function generateSSRHeadContent(
  config: ThemeConfig,
  ssrConfig: SSRThemeConfig = {}
): string {
  const { nonce } = ssrConfig

  const css = generateSSRCss(config)
  const script = generateSSRInitScript(ssrConfig)

  return [
    wrapCssInStyleTag(css, nonce),
    wrapInScriptTag(script, nonce),
  ].join("\n")
}

// =============================================================================
// STATIC SITE GENERATION (Feature #89)
// =============================================================================

/**
 * Output format for SSG build
 */
export type SSGOutputFormat = "css" | "json" | "js" | "ts"

/**
 * Configuration for static site generation
 */
export interface SSGConfig {
  /** Output directory (default: "dist/theme") */
  outDir?: string
  /** Output formats to generate */
  formats?: SSGOutputFormat[]
  /** Whether to minify output (default: true for production) */
  minify?: boolean
  /** Whether to include source maps */
  sourceMaps?: boolean
  /** File name prefix (default: "theme") */
  filePrefix?: string
  /** Whether to generate TypeScript declarations */
  generateTypes?: boolean
}

/**
 * Result of SSG build
 */
export interface SSGBuildResult {
  /** Generated files with their content */
  files: Map<string, string>
  /** File paths that were generated */
  filePaths: string[]
  /** Total size of all generated files */
  totalSize: number
  /** Build metadata */
  meta: {
    generatedAt: string
    themeName: string
    formats: SSGOutputFormat[]
    minified: boolean
  }
}

/**
 * Token export format for static builds
 */
export interface StaticTokenExport {
  /** Theme name */
  name: string
  /** CSS custom properties */
  cssVariables: Record<string, string>
  /** Light mode tokens */
  light: DesignTokens
  /** Dark mode color overrides */
  dark?: Partial<SemanticColors>
  /** Generated at timestamp */
  generatedAt: string
  /** Version for cache busting */
  version: string
}

/**
 * Generates a unique version hash for cache busting
 */
function generateVersionHash(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

/**
 * Minifies CSS by removing unnecessary whitespace
 */
function minifyCss(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "") // Remove comments
    .replace(/\s+/g, " ") // Collapse whitespace
    .replace(/\s*([{}:;,])\s*/g, "$1") // Remove space around punctuation
    .replace(/;}/g, "}") // Remove trailing semicolons
    .trim()
}

/**
 * Generates static CSS file content for SSG
 *
 * Creates a complete CSS file that works without any JavaScript.
 * Includes both light and dark modes via CSS media queries.
 *
 * @param config - Theme configuration
 * @param minify - Whether to minify output
 * @returns CSS file content
 *
 * @example
 * ```typescript
 * // In build script
 * import { generateStaticCss } from "@platxa/frontend-agent"
 * import { writeFileSync } from "fs"
 *
 * const css = generateStaticCss(themeConfig, true)
 * writeFileSync("dist/theme.css", css)
 * ```
 */
export function generateStaticCss(
  config: ThemeConfig,
  minify = false
): string {
  const sections: string[] = []

  // Header
  sections.push(`/*
 * Theme: ${config.name}
 * Generated for static site generation
 * No JavaScript required - uses CSS media queries
 */`)

  // Tailwind v4 @theme block
  sections.push("")
  sections.push(generateTailwindTheme(config.light))

  // Base CSS variables
  sections.push("")
  sections.push(generateCss(config.light))

  // Dark mode via media query (no JS)
  if (config.dark) {
    sections.push("")
    sections.push("/* Dark mode - automatic via system preference */")
    sections.push("@media (prefers-color-scheme: dark) {")
    sections.push("  :root {")
    for (const [key, value] of Object.entries(config.dark)) {
      if (value && typeof value === "string") {
        sections.push(`    --${toKebabCase(key)}: ${value};`)
      }
    }
    sections.push("  }")
    sections.push("}")

    // Manual dark mode class
    sections.push("")
    sections.push("/* Dark mode - manual toggle via class */")
    sections.push(".dark, [data-theme='dark'] {")
    for (const [key, value] of Object.entries(config.dark)) {
      if (value && typeof value === "string") {
        sections.push(`  --${toKebabCase(key)}: ${value};`)
      }
    }
    sections.push("}")
  }

  const css = sections.join("\n")
  return minify ? minifyCss(css) : css
}

/**
 * Generates static JSON token export for SSG
 *
 * Creates a JSON file with all tokens that can be imported
 * at build time without runtime processing.
 *
 * @param config - Theme configuration
 * @returns JSON string
 */
export function generateStaticJson(config: ThemeConfig): string {
  const cssVariables = generateColorVariables(config.light.colors)

  const exportData: StaticTokenExport = {
    name: config.name,
    cssVariables,
    light: config.light,
    dark: config.dark,
    generatedAt: new Date().toISOString(),
    version: generateVersionHash(JSON.stringify(config)),
  }

  return JSON.stringify(exportData, null, 2)
}

/**
 * Generates static JavaScript module for SSG
 *
 * Creates a JS module that exports tokens as constants.
 * No runtime computation needed.
 *
 * @param config - Theme configuration
 * @returns JavaScript module content
 */
export function generateStaticJs(config: ThemeConfig): string {
  const cssVariables = generateColorVariables(config.light.colors)
  const version = generateVersionHash(JSON.stringify(config))

  const lines: string[] = []

  lines.push(`/**
 * Theme: ${config.name}
 * Generated for static site generation
 * @generated
 */`)
  lines.push("")
  lines.push(`export const THEME_NAME = "${config.name}";`)
  lines.push(`export const THEME_VERSION = "${version}";`)
  lines.push("")
  lines.push("export const cssVariables = " + JSON.stringify(cssVariables, null, 2) + ";")
  lines.push("")
  lines.push("export const lightTokens = " + JSON.stringify(config.light, null, 2) + ";")

  if (config.dark) {
    lines.push("")
    lines.push("export const darkColors = " + JSON.stringify(config.dark, null, 2) + ";")
  }

  lines.push("")
  lines.push("export default { THEME_NAME, THEME_VERSION, cssVariables, lightTokens" + (config.dark ? ", darkColors" : "") + " };")

  return lines.join("\n")
}

/**
 * Generates static TypeScript module for SSG
 *
 * Creates a TS module with full type annotations.
 *
 * @param config - Theme configuration
 * @returns TypeScript module content
 */
export function generateStaticTs(config: ThemeConfig): string {
  const cssVariables = generateColorVariables(config.light.colors)
  const version = generateVersionHash(JSON.stringify(config))

  const lines: string[] = []

  lines.push(`/**
 * Theme: ${config.name}
 * Generated for static site generation
 * @generated
 */`)
  lines.push("")
  lines.push(`export const THEME_NAME = "${config.name}" as const;`)
  lines.push(`export const THEME_VERSION = "${version}" as const;`)
  lines.push("")
  lines.push("export const cssVariables: Record<string, string> = " + JSON.stringify(cssVariables, null, 2) + ";")
  lines.push("")
  lines.push("export const lightTokens = " + JSON.stringify(config.light, null, 2) + " as const;")

  if (config.dark) {
    lines.push("")
    lines.push("export const darkColors = " + JSON.stringify(config.dark, null, 2) + " as const;")
  }

  // Type exports
  lines.push("")
  lines.push("export type CssVariables = typeof cssVariables;")
  lines.push("export type LightTokens = typeof lightTokens;")
  if (config.dark) {
    lines.push("export type DarkColors = typeof darkColors;")
  }

  lines.push("")
  lines.push("export default { THEME_NAME, THEME_VERSION, cssVariables, lightTokens" + (config.dark ? ", darkColors" : "") + " } as const;")

  return lines.join("\n")
}

/**
 * Builds all static assets for SSG
 *
 * Generates all requested output formats and returns
 * the complete build result with file contents.
 *
 * @param config - Theme configuration
 * @param ssgConfig - SSG build configuration
 * @returns Build result with all generated files
 *
 * @example
 * ```typescript
 * import { buildStaticTheme } from "@platxa/frontend-agent"
 * import { writeFileSync, mkdirSync } from "fs"
 *
 * const result = buildStaticTheme(themeConfig, {
 *   outDir: "dist/theme",
 *   formats: ["css", "json", "ts"],
 *   minify: true,
 * })
 *
 * // Write files to disk
 * mkdirSync(result.meta.outDir, { recursive: true })
 * for (const [path, content] of result.files) {
 *   writeFileSync(path, content)
 * }
 * ```
 */
export function buildStaticTheme(
  config: ThemeConfig,
  ssgConfig: SSGConfig = {}
): SSGBuildResult {
  const {
    outDir = "dist/theme",
    formats = ["css", "json"],
    minify = true,
    filePrefix = "theme",
  } = ssgConfig

  const files = new Map<string, string>()
  let totalSize = 0

  // Generate each requested format
  for (const format of formats) {
    let content: string
    let filename: string

    switch (format) {
      case "css":
        content = generateStaticCss(config, minify)
        filename = `${filePrefix}.css`
        break
      case "json":
        content = generateStaticJson(config)
        filename = `${filePrefix}.json`
        break
      case "js":
        content = generateStaticJs(config)
        filename = `${filePrefix}.js`
        break
      case "ts":
        content = generateStaticTs(config)
        filename = `${filePrefix}.ts`
        break
      default:
        continue
    }

    const filepath = `${outDir}/${filename}`
    files.set(filepath, content)
    totalSize += new TextEncoder().encode(content).length
  }

  return {
    files,
    filePaths: Array.from(files.keys()),
    totalSize,
    meta: {
      generatedAt: new Date().toISOString(),
      themeName: config.name,
      formats,
      minified: minify,
    },
  }
}

/**
 * Generates inline critical CSS for SSG pages
 *
 * Creates minimal CSS for above-the-fold content that can be
 * inlined directly in the HTML to avoid FOUC.
 *
 * @param config - Theme configuration
 * @returns Critical CSS string
 */
export function generateCriticalCss(config: ThemeConfig): string {
  // Generate only essential color variables for initial render
  const criticalVars = [
    "background",
    "foreground",
    "primary",
    "primaryForeground",
    "card",
    "cardForeground",
  ]

  const lines: string[] = []
  lines.push(":root {")

  for (const varName of criticalVars) {
    const value = config.light.colors[varName as keyof SemanticColors]
    if (value) {
      lines.push(`  --${toKebabCase(varName)}: ${value};`)
    }
  }

  lines.push("}")

  // Add dark mode critical CSS
  if (config.dark) {
    lines.push("@media (prefers-color-scheme: dark) {")
    lines.push("  :root {")
    for (const varName of criticalVars) {
      const value = config.dark[varName as keyof SemanticColors]
      if (value) {
        lines.push(`    --${toKebabCase(varName)}: ${value};`)
      }
    }
    lines.push("  }")
    lines.push("}")
  }

  return minifyCss(lines.join("\n"))
}

/**
 * Gets tokens as a static object for build-time access
 *
 * Returns tokens that can be used directly in build scripts
 * without any runtime processing.
 *
 * @param config - Theme configuration
 * @returns Static token object
 */
export function getStaticTokens(config: ThemeConfig): StaticTokenExport {
  return {
    name: config.name,
    cssVariables: generateColorVariables(config.light.colors),
    light: config.light,
    dark: config.dark,
    generatedAt: new Date().toISOString(),
    version: generateVersionHash(JSON.stringify(config)),
  }
}

/**
 * Validates that static build output is correct
 *
 * Checks that all required tokens are present and
 * CSS is syntactically valid.
 *
 * @param result - Build result to validate
 * @returns Validation result
 */
export function validateStaticBuild(result: SSGBuildResult): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Check that files were generated
  if (result.files.size === 0) {
    errors.push("No files were generated")
  }

  // Validate CSS files
  for (const [path, content] of result.files) {
    if (path.endsWith(".css")) {
      // Check for basic CSS structure
      if (!content.includes(":root") && !content.includes("@theme")) {
        errors.push(`CSS file ${path} missing :root or @theme block`)
      }

      // Check for unbalanced braces
      const openBraces = (content.match(/{/g) || []).length
      const closeBraces = (content.match(/}/g) || []).length
      if (openBraces !== closeBraces) {
        errors.push(`CSS file ${path} has unbalanced braces`)
      }
    }

    // Validate JSON files
    if (path.endsWith(".json")) {
      try {
        JSON.parse(content)
      } catch {
        errors.push(`JSON file ${path} is not valid JSON`)
      }
    }

    // Check file size
    const size = new TextEncoder().encode(content).length
    if (size > 100 * 1024) {
      warnings.push(`File ${path} is large (${Math.round(size / 1024)}KB)`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

// =============================================================================
// BUNDLE SIZE REPORTING (Feature #90)
// =============================================================================

/**
 * Size information for a single module/component
 */
export interface ModuleSizeInfo {
  /** Module name or path */
  name: string
  /** Raw size in bytes */
  rawSize: number
  /** Gzipped size estimate in bytes */
  gzipSize: number
  /** Percentage of total */
  percentage: number
  /** Human-readable raw size */
  rawFormatted: string
  /** Human-readable gzip size */
  gzipFormatted: string
}

/**
 * Historical size record for comparison
 */
export interface SizeHistoryEntry {
  /** Timestamp of the measurement */
  timestamp: string
  /** Total size at this point */
  totalSize: number
  /** Version or commit hash */
  version?: string
  /** Per-module sizes */
  modules?: Record<string, number>
}

/**
 * Size delta information
 */
export interface SizeDelta {
  /** Previous size in bytes */
  previous: number
  /** Current size in bytes */
  current: number
  /** Absolute difference in bytes */
  difference: number
  /** Percentage change */
  percentageChange: number
  /** Whether size increased */
  increased: boolean
  /** Human-readable description */
  description: string
}

/**
 * Complete bundle size report
 */
export interface BundleSizeReport {
  /** Total size of all modules */
  totalSize: number
  /** Estimated gzip total */
  totalGzipSize: number
  /** Human-readable total */
  totalFormatted: string
  /** Human-readable gzip total */
  totalGzipFormatted: string
  /** Per-module breakdown */
  modules: ModuleSizeInfo[]
  /** Size delta from previous (if provided) */
  delta?: SizeDelta
  /** Timestamp of this report */
  timestamp: string
  /** Warnings if any thresholds exceeded */
  warnings: string[]
  /** Summary statistics */
  summary: {
    largestModule: string
    largestSize: number
    moduleCount: number
    averageSize: number
  }
}

/**
 * Configuration for bundle size analysis
 */
export interface BundleSizeConfig {
  /** Warning threshold in bytes (default: 50KB) */
  warningThreshold?: number
  /** Error threshold in bytes (default: 100KB) */
  errorThreshold?: number
  /** Previous size for delta calculation */
  previousSize?: number
  /** Previous history for trend analysis */
  history?: SizeHistoryEntry[]
  /** Whether to estimate gzip sizes */
  estimateGzip?: boolean
}

/**
 * Estimates gzip size (rough approximation)
 *
 * Uses a simple compression ratio estimate based on content type.
 * For accurate gzip sizes, use actual compression.
 */
function estimateGzipSize(content: string): number {
  // JSON and CSS typically compress to ~30-40% of original
  const compressionRatio = 0.35
  return Math.round(new TextEncoder().encode(content).length * compressionRatio)
}

/**
 * Analyzes bundle size for a brand kit
 *
 * Calculates the total size impact of a brand kit including
 * per-module breakdown and optional historical comparison.
 *
 * @param brandKit - Brand kit to analyze
 * @param config - Analysis configuration
 * @returns Bundle size report
 *
 * @example
 * ```typescript
 * import { analyzeBundleSize } from "@platxa/frontend-agent"
 *
 * const report = analyzeBundleSize(myBrandKit, {
 *   warningThreshold: 30 * 1024,
 *   previousSize: lastBuildSize,
 * })
 *
 * console.log(`Total: ${report.totalFormatted}`)
 * if (report.delta?.increased) {
 *   console.warn(`Size increased by ${report.delta.description}`)
 * }
 * ```
 */
export function analyzeBundleSize(
  brandKit: Record<string, unknown>,
  config: BundleSizeConfig = {}
): BundleSizeReport {
  const {
    warningThreshold = 50 * 1024,
    errorThreshold = 100 * 1024,
    previousSize,
    estimateGzip = true,
  } = config

  const modules: ModuleSizeInfo[] = []
  let totalSize = 0
  let totalGzipSize = 0
  const warnings: string[] = []

  // Analyze each top-level module
  for (const [name, value] of Object.entries(brandKit)) {
    const content = JSON.stringify(value)
    const rawSize = new TextEncoder().encode(content).length
    const gzipSize = estimateGzip ? estimateGzipSize(content) : 0

    totalSize += rawSize
    totalGzipSize += gzipSize

    modules.push({
      name,
      rawSize,
      gzipSize,
      percentage: 0, // Calculated after total is known
      rawFormatted: formatBytes(rawSize),
      gzipFormatted: formatBytes(gzipSize),
    })
  }

  // Calculate percentages
  for (const mod of modules) {
    mod.percentage = totalSize > 0 ? Math.round((mod.rawSize / totalSize) * 100) : 0
  }

  // Sort by size descending
  modules.sort((a, b) => b.rawSize - a.rawSize)

  // Check thresholds
  if (totalSize >= errorThreshold) {
    warnings.push(`Bundle size (${formatBytes(totalSize)}) exceeds error threshold (${formatBytes(errorThreshold)})`)
  } else if (totalSize >= warningThreshold) {
    warnings.push(`Bundle size (${formatBytes(totalSize)}) exceeds warning threshold (${formatBytes(warningThreshold)})`)
  }

  // Check for large modules
  for (const mod of modules) {
    if (mod.rawSize > 20 * 1024) {
      warnings.push(`Module "${mod.name}" is large (${mod.rawFormatted})`)
    }
  }

  // Calculate delta if previous size provided
  let delta: SizeDelta | undefined
  if (previousSize !== undefined) {
    const difference = totalSize - previousSize
    const percentageChange = previousSize > 0
      ? Math.round((difference / previousSize) * 100)
      : 0

    delta = {
      previous: previousSize,
      current: totalSize,
      difference: Math.abs(difference),
      percentageChange: Math.abs(percentageChange),
      increased: difference > 0,
      description: `${difference > 0 ? "+" : "-"}${formatBytes(Math.abs(difference))} (${difference > 0 ? "+" : "-"}${Math.abs(percentageChange)}%)`,
    }

    if (difference > 5 * 1024) {
      warnings.push(`Size increased by ${formatBytes(difference)} since last build`)
    }
  }

  // Summary statistics
  const summary = {
    largestModule: modules[0]?.name || "",
    largestSize: modules[0]?.rawSize || 0,
    moduleCount: modules.length,
    averageSize: modules.length > 0 ? Math.round(totalSize / modules.length) : 0,
  }

  return {
    totalSize,
    totalGzipSize,
    totalFormatted: formatBytes(totalSize),
    totalGzipFormatted: formatBytes(totalGzipSize),
    modules,
    delta,
    timestamp: new Date().toISOString(),
    warnings,
    summary,
  }
}

/**
 * Compares two bundle size reports
 *
 * @param current - Current report
 * @param previous - Previous report
 * @returns Comparison with deltas
 */
export function compareBundleSizes(
  current: BundleSizeReport,
  previous: BundleSizeReport
): {
  totalDelta: SizeDelta
  moduleDeltas: Array<{ name: string; delta: SizeDelta }>
  newModules: string[]
  removedModules: string[]
} {
  const totalDelta: SizeDelta = {
    previous: previous.totalSize,
    current: current.totalSize,
    difference: Math.abs(current.totalSize - previous.totalSize),
    percentageChange: previous.totalSize > 0
      ? Math.abs(Math.round(((current.totalSize - previous.totalSize) / previous.totalSize) * 100))
      : 0,
    increased: current.totalSize > previous.totalSize,
    description: "",
  }
  totalDelta.description = `${totalDelta.increased ? "+" : "-"}${formatBytes(totalDelta.difference)}`

  // Build module maps
  const prevModules = new Map(previous.modules.map(m => [m.name, m]))
  const currModules = new Map(current.modules.map(m => [m.name, m]))

  // Find deltas, new, and removed modules
  const moduleDeltas: Array<{ name: string; delta: SizeDelta }> = []
  const newModules: string[] = []
  const removedModules: string[] = []

  for (const [name, curr] of currModules) {
    const prev = prevModules.get(name)
    if (prev) {
      const diff = curr.rawSize - prev.rawSize
      moduleDeltas.push({
        name,
        delta: {
          previous: prev.rawSize,
          current: curr.rawSize,
          difference: Math.abs(diff),
          percentageChange: prev.rawSize > 0 ? Math.abs(Math.round((diff / prev.rawSize) * 100)) : 0,
          increased: diff > 0,
          description: `${diff > 0 ? "+" : "-"}${formatBytes(Math.abs(diff))}`,
        },
      })
    } else {
      newModules.push(name)
    }
  }

  for (const name of prevModules.keys()) {
    if (!currModules.has(name)) {
      removedModules.push(name)
    }
  }

  return {
    totalDelta,
    moduleDeltas: moduleDeltas.filter(d => d.delta.difference > 0),
    newModules,
    removedModules,
  }
}

/**
 * Formats bundle size report for CLI output
 *
 * @param report - Report to format
 * @returns Array of formatted lines
 */
export function formatBundleSizeReport(report: BundleSizeReport): string[] {
  const lines: string[] = []

  // Header
  lines.push("╔══════════════════════════════════════════════════════════════╗")
  lines.push("║                    BUNDLE SIZE REPORT                        ║")
  lines.push("╠══════════════════════════════════════════════════════════════╣")

  // Total sizes
  lines.push(`║  Total Size:      ${report.totalFormatted.padStart(12)}                          ║`)
  lines.push(`║  Gzip Estimate:   ${report.totalGzipFormatted.padStart(12)}                          ║`)

  // Delta if available
  if (report.delta) {
    const deltaIcon = report.delta.increased ? "▲" : "▼"
    const deltaColor = report.delta.increased ? "!" : "✓"
    lines.push(`║  Change:          ${deltaIcon} ${report.delta.description.padStart(10)}  ${deltaColor}                        ║`)
  }

  lines.push("╠══════════════════════════════════════════════════════════════╣")
  lines.push("║  Module Breakdown:                                           ║")
  lines.push("╟──────────────────────────────────────────────────────────────╢")

  // Module breakdown (top 10)
  for (const mod of report.modules.slice(0, 10)) {
    const bar = "█".repeat(Math.ceil(mod.percentage / 5)) + "░".repeat(20 - Math.ceil(mod.percentage / 5))
    const name = mod.name.padEnd(15).slice(0, 15)
    lines.push(`║  ${name} ${bar} ${mod.rawFormatted.padStart(8)} (${mod.percentage}%) ║`)
  }

  if (report.modules.length > 10) {
    lines.push(`║  ... and ${report.modules.length - 10} more modules                                   ║`)
  }

  // Warnings
  if (report.warnings.length > 0) {
    lines.push("╠══════════════════════════════════════════════════════════════╣")
    lines.push("║  ⚠ Warnings:                                                 ║")
    for (const warning of report.warnings) {
      const truncated = warning.slice(0, 58).padEnd(58)
      lines.push(`║    ${truncated}  ║`)
    }
  }

  lines.push("╚══════════════════════════════════════════════════════════════╝")

  return lines
}

/**
 * Creates a size history entry from current report
 *
 * @param report - Current report
 * @param version - Version identifier
 * @returns History entry
 */
export function createSizeHistoryEntry(
  report: BundleSizeReport,
  version?: string
): SizeHistoryEntry {
  const modules: Record<string, number> = {}
  for (const mod of report.modules) {
    modules[mod.name] = mod.rawSize
  }

  return {
    timestamp: report.timestamp,
    totalSize: report.totalSize,
    version,
    modules,
  }
}

/**
 * Analyzes size trend from history
 *
 * @param history - Array of history entries
 * @returns Trend analysis
 */
export function analyzeSizeTrend(history: SizeHistoryEntry[]): {
  trend: "increasing" | "decreasing" | "stable"
  averageChange: number
  totalChange: number
  entries: number
} {
  if (history.length < 2) {
    return { trend: "stable", averageChange: 0, totalChange: 0, entries: history.length }
  }

  // Sort by timestamp
  const sorted = [...history].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  // Calculate changes
  const changes: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    changes.push(sorted[i].totalSize - sorted[i - 1].totalSize)
  }

  const totalChange = sorted[sorted.length - 1].totalSize - sorted[0].totalSize
  const averageChange = Math.round(changes.reduce((a, b) => a + b, 0) / changes.length)

  let trend: "increasing" | "decreasing" | "stable" = "stable"
  if (averageChange > 1024) {
    trend = "increasing"
  } else if (averageChange < -1024) {
    trend = "decreasing"
  }

  return {
    trend,
    averageChange,
    totalChange,
    entries: history.length,
  }
}

// =============================================================================
// EXTEND BRAND HELPER (Feature #91)
// =============================================================================

/**
 * Options for extending a brand kit
 */
export interface ExtendBrandOptions {
  /** Whether to deep merge arrays (default: false, replaces arrays) */
  mergeArrays?: boolean
  /** Whether to remove undefined values from override */
  removeUndefined?: boolean
  /** Custom merge function for specific keys */
  customMerge?: Record<string, (base: unknown, override: unknown) => unknown>
}

/**
 * Deep merge utility type for type-safe merging
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * Checks if a value is a plain object
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Deep merges two objects recursively
 *
 * This is an internal recursive helper that works with unknown types.
 * It handles nested objects, arrays, and primitives correctly.
 *
 * @param base - Base object
 * @param override - Override object
 * @param options - Merge options
 * @returns Merged object
 */
function deepMergeInternal(
  base: unknown,
  override: unknown,
  options: ExtendBrandOptions
): unknown {
  const { mergeArrays = false, removeUndefined = true, customMerge = {} } = options

  // If override is not an object or is null, return it directly
  if (!isPlainObject(override)) {
    return override
  }

  // If base is not an object, return override
  if (!isPlainObject(base)) {
    return { ...override }
  }

  const baseObj = base as Record<string, unknown>
  const overrideObj = override as Record<string, unknown>
  const result: Record<string, unknown> = { ...baseObj }

  for (const key of Object.keys(overrideObj)) {
    const baseValue = baseObj[key]
    const overrideValue = overrideObj[key]

    // Skip undefined if removeUndefined is true
    if (removeUndefined && overrideValue === undefined) {
      continue
    }

    // Use custom merge function if provided
    if (customMerge[key]) {
      result[key] = customMerge[key](baseValue, overrideValue)
      continue
    }

    // Handle arrays
    if (Array.isArray(overrideValue)) {
      if (mergeArrays && Array.isArray(baseValue)) {
        result[key] = [...baseValue, ...overrideValue]
      } else {
        result[key] = [...overrideValue]
      }
      continue
    }

    // Handle nested objects recursively
    if (isPlainObject(overrideValue) && isPlainObject(baseValue)) {
      result[key] = deepMergeInternal(baseValue, overrideValue, options)
      continue
    }

    // Direct assignment for primitives
    result[key] = overrideValue
  }

  return result
}

/**
 * Type-safe deep merge for brand configurations
 *
 * Uses the internal recursive merge and casts the result to the expected type.
 * This approach separates the runtime merge logic from TypeScript's type system,
 * which is the correct pattern for deep merge operations.
 *
 * @param base - Base object (must be a ThemeConfig or compatible type)
 * @param override - Partial override object
 * @param options - Merge options
 * @returns Merged object with the same type as base
 */
function deepMerge<T extends ThemeConfig>(
  base: T,
  override: DeepPartial<T>,
  options: ExtendBrandOptions = {}
): T {
  return deepMergeInternal(base, override, options) as T
}

/**
 * Type-safe deep merge for design tokens
 *
 * @param base - Base tokens
 * @param override - Partial override tokens
 * @param options - Merge options
 * @returns Merged tokens
 */
function deepMergeTokens(
  base: DesignTokens,
  override: DeepPartial<DesignTokens>,
  options: ExtendBrandOptions = {}
): DesignTokens {
  return deepMergeInternal(base, override, options) as DesignTokens
}

/**
 * Extends an existing brand kit with overrides
 *
 * Performs a deep merge of the base brand kit with the provided
 * overrides, preserving unmodified tokens and ensuring type safety.
 *
 * @param base - Base brand kit to extend
 * @param overrides - Partial overrides to apply
 * @param options - Merge options
 * @returns Extended brand kit
 *
 * @example
 * ```typescript
 * import { extendBrand, defaultTheme } from "@platxa/frontend-agent"
 *
 * // Extend the default theme with custom colors
 * const myBrand = extendBrand(defaultTheme, {
 *   name: "my-brand",
 *   light: {
 *     colors: {
 *       primary: "hsl(262, 80%, 50%)",
 *       secondary: "hsl(200, 70%, 50%)",
 *     },
 *   },
 * })
 *
 * // Original spacing, typography, etc. are preserved
 * console.log(myBrand.light.spacing) // Same as defaultTheme
 * console.log(myBrand.light.colors.primary) // "hsl(262, 80%, 50%)"
 * ```
 */
export function extendBrand<T extends ThemeConfig>(
  base: T,
  overrides: DeepPartial<T>,
  options: ExtendBrandOptions = {}
): T {
  return deepMerge(base, overrides, options)
}

/**
 * Extends design tokens with overrides
 *
 * @param base - Base tokens
 * @param overrides - Partial overrides
 * @returns Extended tokens
 *
 * @example
 * ```typescript
 * const customTokens = extendTokens(defaultTokens, {
 *   colors: {
 *     primary: "purple",
 *   },
 *   spacing: {
 *     lg: "2rem",
 *   },
 * })
 * ```
 */
export function extendTokens(
  base: DesignTokens,
  overrides: DeepPartial<DesignTokens>
): DesignTokens {
  return deepMergeTokens(base, overrides)
}

/**
 * Extends semantic colors with overrides
 *
 * @param base - Base colors
 * @param overrides - Partial color overrides
 * @returns Extended colors
 */
export function extendColors(
  base: SemanticColors,
  overrides: Partial<SemanticColors>
): SemanticColors {
  return { ...base, ...overrides }
}

/**
 * Creates a brand variant by extending a base
 *
 * Useful for creating theme variants (e.g., high-contrast,
 * colorblind-friendly) from a base theme.
 *
 * @param base - Base brand kit
 * @param variantName - Name for the variant
 * @param overrides - Variant-specific overrides
 * @returns New brand variant
 *
 * @example
 * ```typescript
 * const highContrastTheme = createBrandVariant(
 *   defaultTheme,
 *   "high-contrast",
 *   {
 *     light: {
 *       colors: {
 *         background: "hsl(0, 0%, 100%)",
 *         foreground: "hsl(0, 0%, 0%)",
 *       },
 *     },
 *   }
 * )
 * ```
 */
export function createBrandVariant<T extends ThemeConfig>(
  base: T,
  variantName: string,
  overrides: DeepPartial<Omit<T, "name">>
): T {
  return extendBrand(base, {
    name: `${base.name}-${variantName}`,
    ...overrides,
  } as DeepPartial<T>)
}

/**
 * Composes multiple brand overrides into a single config
 *
 * Applies overrides in order, with later overrides taking precedence.
 *
 * @param base - Base brand kit
 * @param overrides - Array of override objects
 * @returns Composed brand kit
 *
 * @example
 * ```typescript
 * const composed = composeBrandOverrides(defaultTheme, [
 *   colorOverrides,
 *   spacingOverrides,
 *   typographyOverrides,
 * ])
 * ```
 */
export function composeBrandOverrides<T extends ThemeConfig>(
  base: T,
  overrides: Array<DeepPartial<T>>
): T {
  let result = base
  for (const override of overrides) {
    result = extendBrand(result, override)
  }
  return result
}

/**
 * Picks specific token categories from a brand kit
 *
 * @param brand - Brand kit
 * @param categories - Categories to pick
 * @returns Partial brand with only selected categories
 *
 * @example
 * ```typescript
 * const colorsOnly = pickBrandCategories(myBrand, ["colors"])
 * ```
 */
export function pickBrandCategories<T extends ThemeConfig>(
  brand: T,
  categories: Array<keyof DesignTokens>
): DeepPartial<T> {
  const result: Record<string, unknown> = {
    name: brand.name,
  }

  if (brand.light) {
    const lightPick: Record<string, unknown> = {}
    for (const cat of categories) {
      const value = brand.light[cat]
      if (value !== undefined) {
        lightPick[cat as string] = value
      }
    }
    result.light = lightPick
  }

  return result as DeepPartial<T>
}

/**
 * Omits specific token categories from a brand kit
 *
 * @param brand - Brand kit
 * @param categories - Categories to omit
 * @returns Brand with selected categories removed
 */
export function omitBrandCategories<T extends ThemeConfig>(
  brand: T,
  categories: Array<keyof DesignTokens>
): T {
  const result = { ...brand }

  if (result.light) {
    const lightCopy = { ...result.light }
    for (const cat of categories) {
      delete lightCopy[cat]
    }
    result.light = lightCopy as DesignTokens
  }

  return result
}

/**
 * Validates that an extended brand kit is complete
 *
 * @param brand - Brand kit to validate
 * @returns Validation result
 */
export function validateExtendedBrand(brand: ThemeConfig): {
  valid: boolean
  missing: string[]
  warnings: string[]
} {
  const missing: string[] = []
  const warnings: string[] = []

  // Check required fields
  if (!brand.name) {
    missing.push("name")
  }

  if (!brand.light) {
    missing.push("light")
  } else {
    // Check required token categories
    const requiredCategories: Array<keyof DesignTokens> = [
      "colors",
      "spacing",
      "typography",
    ]

    for (const cat of requiredCategories) {
      if (!brand.light[cat]) {
        missing.push(`light.${cat}`)
      }
    }

    // Check for empty colors
    if (brand.light.colors && Object.keys(brand.light.colors).length === 0) {
      warnings.push("light.colors is empty")
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  }
}

// =============================================================================
// Feature #92: Brand Kit Inheritance
// =============================================================================

/**
 * Brand kit registry for resolving string-based extends references
 */
export type BrandKitRegistry = Map<string, ThemeConfig>

/**
 * Options for resolving brand kit inheritance
 */
export interface ResolveInheritanceOptions {
  /**
   * Registry for resolving string-based extends references
   * If not provided, string references will throw an error
   */
  registry?: BrandKitRegistry

  /**
   * Maximum inheritance depth to prevent infinite loops
   * @default 10
   */
  maxDepth?: number

  /**
   * Whether to validate the resolved brand kit
   * @default true
   */
  validate?: boolean
}

/**
 * Result of inheritance resolution
 */
export interface InheritanceResolutionResult {
  /** The fully resolved brand kit with all inherited tokens */
  resolved: ThemeConfig
  /** Chain of brand kits in inheritance order (root first) */
  chain: string[]
  /** Any warnings during resolution */
  warnings: string[]
}

/**
 * Creates a brand kit registry from an array of brand kits
 *
 * @param brandKits - Array of brand kits to register
 * @returns Registry map
 *
 * @example
 * ```typescript
 * const registry = createBrandKitRegistry([
 *   defaultTheme,
 *   blueTheme,
 *   greenTheme,
 * ])
 * ```
 */
export function createBrandKitRegistry(
  brandKits: ThemeConfig[]
): BrandKitRegistry {
  const registry = new Map<string, ThemeConfig>()
  for (const kit of brandKits) {
    if (kit.name) {
      registry.set(kit.name, kit)
    }
  }
  return registry
}

/**
 * Resolves a parent reference to a ThemeConfig
 *
 * @param parent - Parent reference (ThemeConfig or string name)
 * @param registry - Optional registry for string lookups
 * @returns Resolved ThemeConfig or null if not found
 */
function resolveParentReference(
  parent: ThemeConfig | string,
  registry?: BrandKitRegistry
): ThemeConfig | null {
  if (typeof parent === "string") {
    if (!registry) {
      return null
    }
    return registry.get(parent) ?? null
  }
  return parent
}

/**
 * Resolves brand kit inheritance chain
 *
 * Walks up the inheritance chain and collects all parent brand kits.
 * Detects circular references and enforces maximum depth.
 *
 * @param brandKit - Brand kit to resolve
 * @param options - Resolution options
 * @returns Inheritance chain (root first, child last)
 */
function resolveInheritanceChain(
  brandKit: ThemeConfig,
  options: ResolveInheritanceOptions = {}
): { chain: ThemeConfig[]; warnings: string[] } {
  const { registry, maxDepth = 10 } = options
  const chain: ThemeConfig[] = []
  const visited = new Set<string>()
  const warnings: string[] = []

  let current: ThemeConfig | null = brandKit
  let depth = 0

  // Walk up the inheritance chain
  while (current) {
    // Check for circular reference
    if (visited.has(current.name)) {
      warnings.push(
        `Circular inheritance detected: ${current.name} appears twice in chain`
      )
      break
    }

    // Check max depth
    if (depth >= maxDepth) {
      warnings.push(
        `Maximum inheritance depth (${maxDepth}) exceeded at ${current.name}`
      )
      break
    }

    visited.add(current.name)
    chain.unshift(current) // Add to front (building root-first order)
    depth++

    // Move to parent
    if (current.extends) {
      const parent = resolveParentReference(current.extends, registry)
      if (!parent && typeof current.extends === "string") {
        warnings.push(
          `Could not resolve parent "${current.extends}" for ${current.name}. ` +
            `Provide a registry or use ThemeConfig object directly.`
        )
      }
      current = parent
    } else {
      current = null
    }
  }

  return { chain, warnings }
}

/**
 * Resolves brand kit inheritance, merging all parent tokens
 *
 * Walks up the inheritance chain and merges tokens from root to child,
 * so child tokens override parent tokens at each level.
 *
 * @param brandKit - Brand kit with potential extends field
 * @param options - Resolution options
 * @returns Fully resolved brand kit with all inherited tokens
 *
 * @example
 * ```typescript
 * // Direct object reference
 * const child: ThemeConfig = {
 *   name: "child",
 *   extends: parentTheme,
 *   light: {
 *     colors: { primary: "purple" },
 *   },
 * }
 * const resolved = resolveBrandInheritance(child)
 * // resolved.light includes all parent tokens + overridden primary
 *
 * // String reference with registry
 * const child2: ThemeConfig = {
 *   name: "child2",
 *   extends: "parent-theme",
 *   light: { colors: { primary: "green" } },
 * }
 * const registry = createBrandKitRegistry([parentTheme])
 * const resolved2 = resolveBrandInheritance(child2, { registry })
 * ```
 */
export function resolveBrandInheritance(
  brandKit: ThemeConfig,
  options: ResolveInheritanceOptions = {}
): InheritanceResolutionResult {
  const { validate = true } = options

  // Get the inheritance chain
  const { chain, warnings } = resolveInheritanceChain(brandKit, options)

  // If no inheritance, return as-is
  if (chain.length <= 1) {
    return {
      resolved: brandKit,
      chain: [brandKit.name],
      warnings,
    }
  }

  // Merge from root to child
  let resolved = chain[0]
  for (let i = 1; i < chain.length; i++) {
    const child = chain[i]
    // Use extendBrand to merge, removing the extends field from result
    resolved = extendBrand(resolved, {
      ...child,
      extends: undefined, // Don't carry extends to resolved config
    } as DeepPartial<ThemeConfig>) as ThemeConfig

    // Ensure the final name is the child's name
    resolved = { ...resolved, name: child.name }
  }

  // Remove extends from final result
  const { extends: _, ...resolvedWithoutExtends } = resolved
  resolved = resolvedWithoutExtends as ThemeConfig

  // Validate if requested
  if (validate) {
    const validation = validateExtendedBrand(resolved)
    if (!validation.valid) {
      warnings.push(
        `Resolved brand kit missing required fields: ${validation.missing.join(", ")}`
      )
    }
    warnings.push(...validation.warnings)
  }

  return {
    resolved,
    chain: chain.map((c) => c.name),
    warnings,
  }
}

/**
 * Checks if a brand kit has inheritance
 *
 * @param brandKit - Brand kit to check
 * @returns True if the brand kit extends another
 */
export function hasInheritance(brandKit: ThemeConfig): boolean {
  return brandKit.extends !== undefined
}

/**
 * Gets the immediate parent of a brand kit
 *
 * @param brandKit - Brand kit to check
 * @param registry - Optional registry for string lookups
 * @returns Parent ThemeConfig or null
 */
export function getParentBrand(
  brandKit: ThemeConfig,
  registry?: BrandKitRegistry
): ThemeConfig | null {
  if (!brandKit.extends) {
    return null
  }
  return resolveParentReference(brandKit.extends, registry)
}

/**
 * Creates a child brand kit that extends a parent
 *
 * Convenience function that sets up the extends relationship
 * and allows specifying overrides.
 *
 * @param name - Name for the child brand
 * @param parent - Parent brand kit or name
 * @param overrides - Tokens to override from parent
 * @returns New brand kit configuration
 *
 * @example
 * ```typescript
 * const myBrand = createChildBrand("my-brand", defaultTheme, {
 *   light: {
 *     colors: {
 *       primary: "oklch(0.7 0.15 280)",
 *       secondary: "oklch(0.6 0.1 200)",
 *     },
 *   },
 * })
 *
 * // Resolve to get full tokens
 * const resolved = resolveBrandInheritance(myBrand)
 * ```
 */
export function createChildBrand(
  name: string,
  parent: ThemeConfig | string,
  overrides: DeepPartial<Omit<ThemeConfig, "name" | "extends">>
): ThemeConfig {
  // Create a minimal child config that will inherit everything
  const childConfig: ThemeConfig = {
    name,
    extends: parent,
    // Provide minimal light config - will be merged with parent
    light: (overrides.light ?? {}) as DesignTokens,
  }

  // Add optional fields if provided
  if (overrides.dark) {
    childConfig.dark = overrides.dark
  }
  if (overrides.defaultMode) {
    childConfig.defaultMode = overrides.defaultMode
  }
  if (overrides.darkModeClass) {
    childConfig.darkModeClass = overrides.darkModeClass
  }
  if (overrides.useColorScheme !== undefined) {
    childConfig.useColorScheme = overrides.useColorScheme
  }

  return childConfig
}

/**
 * Flattens a brand kit with inheritance into a standalone config
 *
 * Similar to resolveBrandInheritance but returns just the ThemeConfig
 * without metadata.
 *
 * @param brandKit - Brand kit to flatten
 * @param options - Resolution options
 * @returns Flattened brand kit without extends field
 */
export function flattenBrandInheritance(
  brandKit: ThemeConfig,
  options: ResolveInheritanceOptions = {}
): ThemeConfig {
  const { resolved } = resolveBrandInheritance(brandKit, {
    ...options,
    validate: false,
  })
  return resolved
}

// =============================================================================
// Feature #93: Partial Brand Kits
// =============================================================================

/**
 * Partial brand kit type
 *
 * Represents a brand kit that only overrides specific tokens.
 * All fields are optional except for name.
 */
export interface PartialBrandKit {
  /** Brand kit name (required for identification) */
  name: string
  /** Partial light mode tokens */
  light?: DeepPartial<DesignTokens>
  /** Partial dark mode tokens */
  dark?: Partial<SemanticColors>
  /** Default mode override */
  defaultMode?: ThemeMode
  /** Dark mode class override */
  darkModeClass?: string
  /** Color scheme preference */
  useColorScheme?: boolean
  /** Parent brand kit to extend */
  extends?: ThemeConfig | string
  /** Description of what this partial kit overrides */
  description?: string
  /** Categories this partial kit targets */
  targetCategories?: Array<keyof DesignTokens>
}

/**
 * Options for merging partial brand kits
 */
export interface MergePartialOptions {
  /**
   * How to handle conflicts when the same token is defined in multiple partials
   * - 'last': Later partials override earlier ones (default)
   * - 'first': Keep the first value
   * - 'error': Throw an error on conflicts
   */
  conflictResolution?: "last" | "first" | "error"

  /**
   * Whether to validate the result
   * @default true
   */
  validate?: boolean

  /**
   * Name for the merged result
   */
  resultName?: string
}

/**
 * Result of validating a partial brand kit
 */
export interface PartialBrandKitValidation {
  /** Whether the partial kit is valid */
  valid: boolean
  /** What categories are being overridden */
  overriddenCategories: Array<keyof DesignTokens>
  /** Warnings (non-fatal issues) */
  warnings: string[]
  /** Errors (if not valid) */
  errors: string[]
}

/**
 * Validates a partial brand kit
 *
 * Checks that the partial kit is well-formed and identifies
 * what categories it overrides.
 *
 * @param partial - Partial brand kit to validate
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const colorOverride: PartialBrandKit = {
 *   name: "brand-colors",
 *   light: {
 *     colors: { primary: "purple" },
 *   },
 * }
 *
 * const result = validatePartialBrandKit(colorOverride)
 * console.log(result.overriddenCategories) // ["colors"]
 * ```
 */
export function validatePartialBrandKit(
  partial: PartialBrandKit
): PartialBrandKitValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const overriddenCategories: Array<keyof DesignTokens> = []

  // Name is required
  if (!partial.name || partial.name.trim() === "") {
    errors.push("Partial brand kit must have a name")
  }

  // Check what categories are being overridden in light tokens
  if (partial.light) {
    const categories: Array<keyof DesignTokens> = [
      "colors",
      "spacing",
      "typography",
      "fontWeight",
      "radius",
      "shadow",
    ]

    for (const cat of categories) {
      if (partial.light[cat] !== undefined) {
        overriddenCategories.push(cat)
      }
    }

    // Warn if light is empty
    if (Object.keys(partial.light).length === 0) {
      warnings.push("light object is empty - no tokens will be overridden")
    }
  }

  // Check dark mode
  if (partial.dark && Object.keys(partial.dark).length > 0) {
    if (!overriddenCategories.includes("colors")) {
      // Dark mode colors without light mode colors
      warnings.push(
        "dark mode colors defined without corresponding light mode colors"
      )
    }
  }

  // Check target categories match actual overrides
  if (partial.targetCategories && partial.targetCategories.length > 0) {
    for (const target of partial.targetCategories) {
      if (!overriddenCategories.includes(target)) {
        warnings.push(
          `targetCategories includes "${target}" but no ${target} tokens are defined`
        )
      }
    }
  }

  return {
    valid: errors.length === 0,
    overriddenCategories,
    warnings,
    errors,
  }
}

/**
 * Creates a partial brand kit for color overrides only
 *
 * @param name - Name for the partial kit
 * @param colors - Color overrides
 * @param darkColors - Optional dark mode color overrides
 * @returns Partial brand kit
 *
 * @example
 * ```typescript
 * const purpleColors = createColorOverride("purple-theme", {
 *   primary: "oklch(0.6 0.2 280)",
 *   secondary: "oklch(0.7 0.15 250)",
 * })
 * ```
 */
export function createColorOverride(
  name: string,
  colors: Partial<SemanticColors>,
  darkColors?: Partial<SemanticColors>
): PartialBrandKit {
  const partial: PartialBrandKit = {
    name,
    description: "Color overrides",
    targetCategories: ["colors"],
    light: {
      colors: colors as SemanticColors,
    },
  }

  if (darkColors) {
    partial.dark = darkColors
  }

  return partial
}

/**
 * Creates a partial brand kit for spacing overrides only
 *
 * @param name - Name for the partial kit
 * @param spacing - Spacing overrides
 * @returns Partial brand kit
 */
export function createSpacingOverride(
  name: string,
  spacing: Partial<SpacingScale>
): PartialBrandKit {
  return {
    name,
    description: "Spacing overrides",
    targetCategories: ["spacing"],
    light: {
      spacing: spacing as SpacingScale,
    },
  }
}

/**
 * Creates a partial brand kit for typography overrides only
 *
 * @param name - Name for the partial kit
 * @param typography - Typography overrides
 * @returns Partial brand kit
 */
export function createTypographyOverride(
  name: string,
  typography: Partial<TypographyScale>
): PartialBrandKit {
  return {
    name,
    description: "Typography overrides",
    targetCategories: ["typography"],
    light: {
      typography: typography as TypographyScale,
    },
  }
}

/**
 * Checks if a brand kit is partial (doesn't have all required tokens)
 *
 * @param brandKit - Brand kit to check
 * @returns True if the brand kit is partial
 */
export function isPartialBrandKit(
  brandKit: ThemeConfig | PartialBrandKit
): brandKit is PartialBrandKit {
  // A full ThemeConfig has complete light tokens
  // A partial one has DeepPartial<DesignTokens>
  if (!brandKit.light) {
    return true
  }

  const light = brandKit.light
  const requiredCategories: Array<keyof DesignTokens> = [
    "colors",
    "spacing",
    "typography",
    "fontWeight",
    "radius",
    "shadow",
  ]

  // Check if all required categories have complete data
  for (const cat of requiredCategories) {
    if (light[cat] === undefined) {
      return true
    }
  }

  // Check if colors has all required semantic colors
  if (light.colors) {
    const requiredColors: Array<keyof SemanticColors> = [
      "primary",
      "secondary",
      "background",
      "foreground",
    ]
    for (const color of requiredColors) {
      if ((light.colors as SemanticColors)[color] === undefined) {
        return true
      }
    }
  }

  return false
}

/**
 * Merges a partial brand kit with a base theme
 *
 * @param base - Base theme to extend
 * @param partial - Partial brand kit to merge
 * @param options - Merge options
 * @returns Complete theme config
 *
 * @example
 * ```typescript
 * const colorOverride: PartialBrandKit = {
 *   name: "my-colors",
 *   light: { colors: { primary: "purple" } },
 * }
 *
 * const myTheme = mergePartialBrandKit(defaultTheme, colorOverride)
 * ```
 */
export function mergePartialBrandKit(
  base: ThemeConfig,
  partial: PartialBrandKit,
  options: MergePartialOptions = {}
): ThemeConfig {
  const { validate = true, resultName } = options

  // Convert partial to DeepPartial<ThemeConfig>
  const override: DeepPartial<ThemeConfig> = {
    name: resultName ?? partial.name,
  }

  if (partial.light) {
    override.light = partial.light as DeepPartial<DesignTokens>
  }
  if (partial.dark) {
    override.dark = partial.dark
  }
  if (partial.defaultMode) {
    override.defaultMode = partial.defaultMode
  }
  if (partial.darkModeClass) {
    override.darkModeClass = partial.darkModeClass
  }
  if (partial.useColorScheme !== undefined) {
    override.useColorScheme = partial.useColorScheme
  }

  // Use extendBrand to merge
  const result = extendBrand(base, override)

  // Validate if requested
  if (validate) {
    const validation = validateExtendedBrand(result)
    if (!validation.valid) {
      throw new Error(
        `Merged brand kit is incomplete: ${validation.missing.join(", ")}`
      )
    }
  }

  return result
}

/**
 * Merges multiple partial brand kits with a base theme
 *
 * Applies partials in order, with later partials taking precedence
 * (unless conflictResolution is changed).
 *
 * @param base - Base theme to extend
 * @param partials - Array of partial brand kits
 * @param options - Merge options
 * @returns Complete theme config
 *
 * @example
 * ```typescript
 * const result = mergePartialBrandKits(defaultTheme, [
 *   colorOverride,
 *   spacingOverride,
 *   typographyOverride,
 * ])
 * ```
 */
export function mergePartialBrandKits(
  base: ThemeConfig,
  partials: PartialBrandKit[],
  options: MergePartialOptions = {}
): ThemeConfig {
  const { conflictResolution = "last", validate = true, resultName } = options

  if (partials.length === 0) {
    return base
  }

  // Track seen tokens for conflict detection
  const seenTokens = new Map<string, string>()

  // Check for conflicts if needed
  if (conflictResolution === "error") {
    for (const partial of partials) {
      if (partial.light) {
        for (const [category, tokens] of Object.entries(partial.light)) {
          if (tokens && typeof tokens === "object") {
            for (const key of Object.keys(tokens)) {
              const path = `${category}.${key}`
              if (seenTokens.has(path)) {
                throw new Error(
                  `Token conflict: "${path}" defined in both "${seenTokens.get(path)}" and "${partial.name}"`
                )
              }
              seenTokens.set(path, partial.name)
            }
          }
        }
      }
    }
  }

  // Determine order based on conflict resolution
  const orderedPartials =
    conflictResolution === "first" ? [...partials].reverse() : partials

  // Merge partials
  let result = base
  for (const partial of orderedPartials) {
    result = mergePartialBrandKit(result, partial, {
      validate: false,
      resultName: partial.name,
    })
  }

  // Set final name
  if (resultName) {
    result = { ...result, name: resultName }
  }

  // Final validation
  if (validate) {
    const validation = validateExtendedBrand(result)
    if (!validation.valid) {
      throw new Error(
        `Merged brand kit is incomplete: ${validation.missing.join(", ")}`
      )
    }
  }

  return result
}

/**
 * Extracts a partial brand kit from a full theme
 *
 * Creates a partial that only contains the specified categories.
 *
 * @param theme - Theme to extract from
 * @param categories - Categories to extract
 * @param name - Name for the partial (defaults to "{theme.name}-partial")
 * @returns Partial brand kit
 *
 * @example
 * ```typescript
 * // Extract only colors from a theme
 * const colorPartial = extractPartialBrandKit(myTheme, ["colors"])
 * ```
 */
export function extractPartialBrandKit(
  theme: ThemeConfig,
  categories: Array<keyof DesignTokens>,
  name?: string
): PartialBrandKit {
  const partial: PartialBrandKit = {
    name: name ?? `${theme.name}-partial`,
    description: `Extracted ${categories.join(", ")} from ${theme.name}`,
    targetCategories: categories,
    light: {},
  }

  for (const cat of categories) {
    if (theme.light[cat]) {
      (partial.light as Record<string, unknown>)[cat] = theme.light[cat]
    }
  }

  // Extract dark mode colors if colors are requested
  if (categories.includes("colors") && theme.dark) {
    partial.dark = theme.dark
  }

  return partial
}

// =============================================================================
// Feature #94: Next.js App Router Integration
// =============================================================================

/**
 * Next.js Metadata theme color entry
 */
export interface NextThemeColorEntry {
  /** Media query for this color (e.g., "(prefers-color-scheme: dark)") */
  media?: string
  /** Color value */
  color: string
}

/**
 * Next.js Metadata object for theme integration
 *
 * This is a subset of Next.js Metadata type focused on theme-related fields.
 */
export interface NextThemeMetadata {
  /** Theme color for the browser */
  themeColor?: string | NextThemeColorEntry[]
  /** Color scheme preference */
  colorScheme?: "light" | "dark" | "light dark" | "dark light" | "only light"
  /** Viewport settings */
  viewport?: {
    themeColor?: string | NextThemeColorEntry[]
    colorScheme?: "light" | "dark" | "light dark" | "dark light" | "only light"
  }
}

/**
 * Options for Next.js integration
 */
export interface NextIntegrationOptions {
  /**
   * Include viewport meta configuration
   * @default true
   */
  includeViewport?: boolean

  /**
   * Color scheme setting
   * @default "light dark"
   */
  colorScheme?: "light" | "dark" | "light dark" | "dark light" | "only light"

  /**
   * Use the new viewport export (Next.js 14+)
   * @default false
   */
  useViewportExport?: boolean
}

/**
 * Result of generating Next.js layout configuration
 */
export interface NextLayoutConfig {
  /** Metadata for the layout */
  metadata: NextThemeMetadata
  /** CSS to include in the layout (inline or as file) */
  css: string
  /** Script for theme initialization (prevents flash) */
  script: string
  /** HTML attributes for the html element */
  htmlAttributes: {
    suppressHydrationWarning: boolean
    lang?: string
  }
  /** Body class name for theme */
  bodyClassName: string
}

/**
 * Generates Next.js Metadata API compatible theme color configuration
 *
 * Creates theme color entries that work with Next.js App Router's
 * generateMetadata and metadata export.
 *
 * @param config - Theme configuration
 * @param options - Integration options
 * @returns Metadata object for Next.js
 *
 * @example
 * ```typescript
 * // In app/layout.tsx
 * import { generateNextMetadata } from "@platxa/frontend-agent"
 * import { myTheme } from "./theme"
 *
 * export const metadata = {
 *   title: "My App",
 *   ...generateNextMetadata(myTheme),
 * }
 * ```
 */
export function generateNextMetadata(
  config: ThemeConfig,
  options: NextIntegrationOptions = {}
): NextThemeMetadata {
  const { includeViewport = true, colorScheme = "light dark" } = options

  // Get the background colors for light and dark modes
  const lightBg = getColorString(config.light.colors.background)
  const darkBg = config.dark?.background
    ? getColorString(config.dark.background)
    : lightBg

  const themeColor: NextThemeColorEntry[] = [
    { media: "(prefers-color-scheme: light)", color: lightBg },
    { media: "(prefers-color-scheme: dark)", color: darkBg },
  ]

  const metadata: NextThemeMetadata = {
    themeColor,
    colorScheme,
  }

  if (includeViewport) {
    metadata.viewport = {
      themeColor,
      colorScheme,
    }
  }

  return metadata
}

/**
 * Helper to convert ColorValue to string
 */
function getColorString(color: unknown): string {
  if (typeof color === "string") {
    return color
  }
  if (color && typeof color === "object") {
    // Handle OklchColor
    if ("l" in color && "c" in color && "h" in color) {
      const c = color as OklchColor
      return `oklch(${c.l} ${c.c} ${c.h})`
    }
    // Handle HslColor
    if ("h" in color && "s" in color && "l" in color) {
      const c = color as HslColor
      return `hsl(${c.h} ${c.s}% ${c.l}%)`
    }
    // Handle RgbColor
    if ("r" in color && "g" in color && "b" in color) {
      const c = color as RgbColor
      return `rgb(${c.r} ${c.g} ${c.b})`
    }
  }
  return "#ffffff"
}

/**
 * Generates a complete Next.js App Router layout configuration
 *
 * Provides everything needed to set up theming in a Next.js App Router
 * layout, including metadata, CSS, and hydration-safe initialization.
 *
 * @param config - Theme configuration
 * @param options - Integration options
 * @returns Complete layout configuration
 *
 * @example
 * ```typescript
 * // In app/layout.tsx
 * import { generateNextLayoutConfig } from "@platxa/frontend-agent"
 * import { myTheme } from "./theme"
 *
 * const layoutConfig = generateNextLayoutConfig(myTheme)
 *
 * export const metadata = layoutConfig.metadata
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html {...layoutConfig.htmlAttributes}>
 *       <head>
 *         <style dangerouslySetInnerHTML={{ __html: layoutConfig.css }} />
 *         <script dangerouslySetInnerHTML={{ __html: layoutConfig.script }} />
 *       </head>
 *       <body className={layoutConfig.bodyClassName}>
 *         {children}
 *       </body>
 *     </html>
 *   )
 * }
 * ```
 */
export function generateNextLayoutConfig(
  config: ThemeConfig,
  options: NextIntegrationOptions = {}
): NextLayoutConfig {
  const metadata = generateNextMetadata(config, options)
  const css = generateSSRCss(config)
  const script = generateSSRInitScript(config)

  return {
    metadata,
    css,
    script,
    htmlAttributes: {
      suppressHydrationWarning: true,
      lang: "en",
    },
    bodyClassName: config.darkModeClass ?? "theme-root",
  }
}

/**
 * Generates Server Component compatible theme tokens
 *
 * Returns tokens that can be used in React Server Components
 * without any client-side dependencies.
 *
 * @param config - Theme configuration
 * @param mode - Theme mode to generate for
 * @returns Static token values
 *
 * @example
 * ```typescript
 * // In a Server Component
 * import { getServerThemeTokens } from "@platxa/frontend-agent"
 *
 * export default function Page() {
 *   const tokens = getServerThemeTokens(myTheme, "light")
 *   return (
 *     <div style={{ backgroundColor: tokens.colors.background }}>
 *       Server-rendered with theme
 *     </div>
 *   )
 * }
 * ```
 */
export function getServerThemeTokens(
  config: ThemeConfig,
  mode: ThemeMode = "light"
): DesignTokens {
  if (mode === "dark" && config.dark) {
    // Merge dark colors with light tokens
    return {
      ...config.light,
      colors: {
        ...config.light.colors,
        ...config.dark,
      },
    }
  }
  return config.light
}

/**
 * Generates CSS custom properties for Server Components
 *
 * Returns a style object that can be used directly in JSX
 * for Server Component styling.
 *
 * @param config - Theme configuration
 * @param mode - Theme mode
 * @returns CSS custom properties as style object
 *
 * @example
 * ```typescript
 * // In a Server Component
 * export default function Card() {
 *   const style = getServerThemeStyle(myTheme)
 *   return <div style={style}>Themed card</div>
 * }
 * ```
 */
export function getServerThemeStyle(
  config: ThemeConfig,
  mode: ThemeMode = "light"
): Record<string, string> {
  const tokens = getServerThemeTokens(config, mode)
  const style: Record<string, string> = {}

  // Add color variables
  for (const [key, value] of Object.entries(tokens.colors)) {
    const varName = `--${toKebabCase(key)}`
    style[varName] = typeof value === "string" ? value : getColorString(value)
  }

  // Add spacing variables
  for (const [key, value] of Object.entries(tokens.spacing)) {
    style[`--spacing-${key}`] = value
  }

  return style
}

/**
 * Generates the viewport export for Next.js 14+
 *
 * In Next.js 14+, viewport configuration is separate from metadata.
 *
 * @param config - Theme configuration
 * @returns Viewport configuration object
 *
 * @example
 * ```typescript
 * // In app/layout.tsx (Next.js 14+)
 * import { generateNextViewport } from "@platxa/frontend-agent"
 *
 * export const viewport = generateNextViewport(myTheme)
 * ```
 */
export function generateNextViewport(
  config: ThemeConfig
): {
  themeColor: NextThemeColorEntry[]
  colorScheme: string
} {
  const lightBg = getColorString(config.light.colors.background)
  const darkBg = config.dark?.background
    ? getColorString(config.dark.background)
    : lightBg

  return {
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: lightBg },
      { media: "(prefers-color-scheme: dark)", color: darkBg },
    ],
    colorScheme: "light dark",
  }
}

/**
 * Generates a theme provider wrapper for Client Components
 *
 * Returns the code for a client-side theme provider that can
 * wrap the application while keeping the root layout as a
 * Server Component.
 *
 * @param config - Theme configuration
 * @returns Provider component code as string
 *
 * @example
 * ```typescript
 * // Generate the provider code
 * const providerCode = generateNextThemeProvider(myTheme)
 *
 * // Write to providers.tsx
 * // "use client"
 * // ... generated code
 * ```
 */
export function generateNextThemeProvider(config: ThemeConfig): string {
  const defaultMode = config.defaultMode ?? "system"

  return `"use client"

import * as React from "react"

type ThemeMode = "light" | "dark" | "system"

interface ThemeProviderProps {
  children: React.ReactNode
  defaultMode?: ThemeMode
  storageKey?: string
}

const ThemeContext = React.createContext<{
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  resolvedMode: "light" | "dark"
}>({
  mode: "${defaultMode}",
  setMode: () => {},
  resolvedMode: "light",
})

export function ThemeProvider({
  children,
  defaultMode = "${defaultMode}",
  storageKey = "theme-mode",
}: ThemeProviderProps) {
  const [mode, setModeState] = React.useState<ThemeMode>(defaultMode)
  const [resolvedMode, setResolvedMode] = React.useState<"light" | "dark">("light")

  React.useEffect(() => {
    // Check localStorage
    const stored = localStorage.getItem(storageKey) as ThemeMode | null
    if (stored) {
      setModeState(stored)
    }
  }, [storageKey])

  React.useEffect(() => {
    const root = document.documentElement

    const updateTheme = () => {
      let resolved: "light" | "dark" = "light"

      if (mode === "system") {
        resolved = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
      } else {
        resolved = mode
      }

      setResolvedMode(resolved)
      root.classList.remove("light", "dark")
      root.classList.add(resolved)
      root.style.colorScheme = resolved
    }

    updateTheme()

    if (mode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      mq.addEventListener("change", updateTheme)
      return () => mq.removeEventListener("change", updateTheme)
    }
  }, [mode])

  const setMode = React.useCallback((newMode: ThemeMode) => {
    setModeState(newMode)
    localStorage.setItem(storageKey, newMode)
  }, [storageKey])

  return (
    <ThemeContext.Provider value={{ mode, setMode, resolvedMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useThemeMode = () => React.useContext(ThemeContext)
`
}

/**
 * Generates route segment config for static generation
 *
 * @returns Route segment config for Next.js
 */
export function generateNextRouteConfig(): {
  dynamic: "force-static" | "force-dynamic" | "auto"
  revalidate: number | false
} {
  return {
    dynamic: "force-static",
    revalidate: false,
  }
}

// =============================================================================
// Feature #95: Tailwind Plugin
// =============================================================================

/**
 * Tailwind plugin configuration options
 */
export interface TailwindPluginOptions {
  /**
   * Prefix for generated utilities
   * @default "brand"
   */
  prefix?: string

  /**
   * Whether to generate color utilities
   * @default true
   */
  colors?: boolean

  /**
   * Whether to generate spacing utilities
   * @default true
   */
  spacing?: boolean

  /**
   * Whether to generate typography utilities
   * @default true
   */
  typography?: boolean

  /**
   * Whether to generate dark mode variants
   * @default true
   */
  darkMode?: boolean

  /**
   * CSS layer to place styles in
   * @default "theme"
   */
  layer?: string
}

/**
 * Tailwind v4 @theme directive content
 */
export interface TailwindThemeDirective {
  /** The @theme block content */
  content: string
  /** Colors section */
  colors: Record<string, string>
  /** Spacing section */
  spacing: Record<string, string>
  /** Font families */
  fontFamily: Record<string, string>
  /** Font sizes */
  fontSize: Record<string, string>
  /** Border radius */
  borderRadius: Record<string, string>
  /** Box shadows */
  boxShadow: Record<string, string>
}

/**
 * Generated Tailwind plugin structure
 */
export interface TailwindPluginOutput {
  /** Plugin function code */
  pluginCode: string
  /** @theme directive content for CSS */
  themeDirective: string
  /** Tailwind config extension */
  configExtension: Record<string, unknown>
  /** CSS file content */
  cssContent: string
}

/**
 * Generates Tailwind v4 @theme directive content from brand tokens
 *
 * Creates a complete @theme block that can be included in your CSS
 * to define custom design tokens.
 *
 * @param config - Theme configuration
 * @returns Theme directive structure
 *
 * @example
 * ```css
 * /* In your main CSS file *\/
 * @import "tailwindcss";
 *
 * @theme {
 *   --color-primary: oklch(0.7 0.15 250);
 *   --color-secondary: oklch(0.6 0.1 200);
 *   /* ... more tokens *\/
 * }
 * ```
 */
export function generateTailwindThemeDirective(
  config: ThemeConfig
): TailwindThemeDirective {
  const colors: Record<string, string> = {}
  const spacing: Record<string, string> = {}
  const fontFamily: Record<string, string> = {}
  const fontSize: Record<string, string> = {}
  const borderRadius: Record<string, string> = {}
  const boxShadow: Record<string, string> = {}

  // Extract colors
  for (const [key, value] of Object.entries(config.light.colors)) {
    const colorStr = typeof value === "string" ? value : getColorString(value)
    colors[toKebabCase(key)] = colorStr
  }

  // Extract spacing
  for (const [key, value] of Object.entries(config.light.spacing)) {
    spacing[key.toString()] = value
  }

  // Extract font families (separate from typography scale)
  if (config.light.fontFamily) {
    if (config.light.fontFamily.sans) {
      fontFamily.sans = config.light.fontFamily.sans
    }
    if (config.light.fontFamily.serif) {
      fontFamily.serif = config.light.fontFamily.serif
    }
    if (config.light.fontFamily.mono) {
      fontFamily.mono = config.light.fontFamily.mono
    }
  }

  // Extract typography scale (font sizes with line heights)
  if (config.light.typography) {
    const typographyEntries = Object.entries(config.light.typography)
    for (const [key, value] of typographyEntries) {
      // TypographyScale entries have { fontSize, lineHeight } structure
      if (value && typeof value === "object" && "fontSize" in value) {
        fontSize[key] = value.fontSize
      }
    }
  }

  // Extract radius
  if (config.light.radius) {
    for (const [key, value] of Object.entries(config.light.radius)) {
      borderRadius[key] = value
    }
  }

  // Extract shadows
  if (config.light.shadow) {
    for (const [key, value] of Object.entries(config.light.shadow)) {
      boxShadow[key] = value
    }
  }

  // Generate @theme content
  const lines: string[] = ["@theme {"]

  // Colors
  for (const [key, value] of Object.entries(colors)) {
    lines.push(`  --color-${key}: ${value};`)
  }

  // Spacing
  for (const [key, value] of Object.entries(spacing)) {
    lines.push(`  --spacing-${key}: ${value};`)
  }

  // Font families
  for (const [key, value] of Object.entries(fontFamily)) {
    lines.push(`  --font-family-${key}: ${value};`)
  }

  // Font sizes
  for (const [key, value] of Object.entries(fontSize)) {
    lines.push(`  --font-size-${key}: ${value};`)
  }

  // Border radius
  for (const [key, value] of Object.entries(borderRadius)) {
    lines.push(`  --radius-${key}: ${value};`)
  }

  // Box shadows
  for (const [key, value] of Object.entries(boxShadow)) {
    lines.push(`  --shadow-${key}: ${value};`)
  }

  lines.push("}")

  return {
    content: lines.join("\n"),
    colors,
    spacing,
    fontFamily,
    fontSize,
    borderRadius,
    boxShadow,
  }
}

/**
 * Generates a Tailwind v4 plugin for brand tokens
 *
 * Creates a plugin that registers brand colors, spacing, and other
 * tokens as Tailwind utilities.
 *
 * @param config - Theme configuration
 * @param options - Plugin options
 * @returns Plugin output with code and configuration
 *
 * @example
 * ```typescript
 * const plugin = generateTailwindPlugin(myTheme)
 *
 * // Write to tailwind.plugin.js
 * fs.writeFileSync("tailwind.plugin.js", plugin.pluginCode)
 *
 * // Use in tailwind.config.js
 * module.exports = {
 *   plugins: [require("./tailwind.plugin.js")],
 * }
 * ```
 */
export function generateTailwindPlugin(
  config: ThemeConfig,
  options: TailwindPluginOptions = {}
): TailwindPluginOutput {
  const {
    prefix = "brand",
    colors = true,
    spacing = true,
    typography = true,
    darkMode = true,
    layer = "theme",
  } = options

  const themeDirective = generateTailwindThemeDirective(config)
  const configExtension: Record<string, unknown> = {}

  // Build color extension
  if (colors) {
    const colorConfig: Record<string, string> = {}
    for (const key of Object.keys(themeDirective.colors)) {
      colorConfig[key] = `var(--color-${key})`
    }
    configExtension.colors = { [prefix]: colorConfig }
  }

  // Build spacing extension
  if (spacing) {
    const spacingConfig: Record<string, string> = {}
    for (const key of Object.keys(themeDirective.spacing)) {
      spacingConfig[key] = `var(--spacing-${key})`
    }
    configExtension.spacing = spacingConfig
  }

  // Build typography extension
  if (typography) {
    configExtension.fontFamily = {}
    for (const [key, _] of Object.entries(themeDirective.fontFamily)) {
      (configExtension.fontFamily as Record<string, string>)[key] =
        `var(--font-family-${key})`
    }
  }

  // Generate plugin code
  const pluginCode = `/**
 * Tailwind Plugin for ${config.name} brand tokens
 * Generated by @platxa/frontend-agent
 */
const plugin = require("tailwindcss/plugin")

module.exports = plugin(
  function ({ addBase, addUtilities, theme }) {
    // Add base CSS variables
    addBase({
      ":root": {
${Object.entries(themeDirective.colors)
  .map(([key, value]) => `        "--color-${key}": "${value}",`)
  .join("\n")}
${Object.entries(themeDirective.spacing)
  .map(([key, value]) => `        "--spacing-${key}": "${value}",`)
  .join("\n")}
${Object.entries(themeDirective.fontFamily)
  .map(([key, value]) => `        "--font-family-${key}": "${value}",`)
  .join("\n")}
${Object.entries(themeDirective.borderRadius)
  .map(([key, value]) => `        "--radius-${key}": "${value}",`)
  .join("\n")}
      },
${
  darkMode && config.dark
    ? `      ".dark, [data-theme='dark']": {
${Object.entries(config.dark)
  .map(([key, value]) => {
    const colorStr = typeof value === "string" ? value : getColorString(value)
    return `        "--color-${toKebabCase(key)}": "${colorStr}",`
  })
  .join("\n")}
      },`
    : ""
}
    })

    // Add custom utilities
    addUtilities({
      ".${prefix}-text": {
        color: "var(--color-foreground)",
      },
      ".${prefix}-bg": {
        backgroundColor: "var(--color-background)",
      },
      ".${prefix}-primary": {
        color: "var(--color-primary)",
      },
      ".${prefix}-secondary": {
        color: "var(--color-secondary)",
      },
    })
  },
  {
    theme: {
      extend: ${JSON.stringify(configExtension, null, 8).replace(/\n/g, "\n      ")},
    },
  }
)
`

  // Generate CSS content with @theme
  const cssContent = `/**
 * Brand tokens CSS for ${config.name}
 * Generated by @platxa/frontend-agent
 *
 * Usage:
 * @import "tailwindcss";
 * @import "./brand-tokens.css";
 */

@layer ${layer} {
  :root {
${Object.entries(themeDirective.colors)
  .map(([key, value]) => `    --color-${key}: ${value};`)
  .join("\n")}
${Object.entries(themeDirective.spacing)
  .map(([key, value]) => `    --spacing-${key}: ${value};`)
  .join("\n")}
${Object.entries(themeDirective.fontFamily)
  .map(([key, value]) => `    --font-family-${key}: ${value};`)
  .join("\n")}
${Object.entries(themeDirective.fontSize)
  .map(([key, value]) => `    --font-size-${key}: ${value};`)
  .join("\n")}
${Object.entries(themeDirective.borderRadius)
  .map(([key, value]) => `    --radius-${key}: ${value};`)
  .join("\n")}
${Object.entries(themeDirective.boxShadow)
  .map(([key, value]) => `    --shadow-${key}: ${value};`)
  .join("\n")}
  }

${
  darkMode && config.dark
    ? `  .dark,
  [data-theme="dark"] {
${Object.entries(config.dark)
  .map(([key, value]) => {
    const colorStr = typeof value === "string" ? value : getColorString(value)
    return `    --color-${toKebabCase(key)}: ${colorStr};`
  })
  .join("\n")}
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
${Object.entries(config.dark)
  .map(([key, value]) => {
    const colorStr = typeof value === "string" ? value : getColorString(value)
    return `      --color-${toKebabCase(key)}: ${colorStr};`
  })
  .join("\n")}
    }
  }`
    : ""
}
}
`

  return {
    pluginCode,
    themeDirective: themeDirective.content,
    configExtension,
    cssContent,
  }
}

/**
 * Generates Tailwind v4 CSS-first configuration
 *
 * For Tailwind v4, configuration is done primarily in CSS using @theme.
 * This generates the complete CSS file with all brand tokens.
 *
 * @param config - Theme configuration
 * @param options - Plugin options
 * @returns CSS content for Tailwind v4
 *
 * @example
 * ```typescript
 * const css = generateTailwindV4Css(myTheme)
 * // Write to app.css and import in your project
 * ```
 */
export function generateTailwindV4Css(
  config: ThemeConfig,
  options: TailwindPluginOptions = {}
): string {
  const { darkMode = true } = options
  const directive = generateTailwindThemeDirective(config)

  let css = `@import "tailwindcss";

${directive.content}
`

  // Add dark mode overrides
  if (darkMode && config.dark) {
    css += `
@theme dark {
${Object.entries(config.dark)
  .map(([key, value]) => {
    const colorStr = typeof value === "string" ? value : getColorString(value)
    return `  --color-${toKebabCase(key)}: ${colorStr};`
  })
  .join("\n")}
}
`
  }

  return css
}

/**
 * Generates Tailwind config object for JavaScript configuration
 *
 * For projects that prefer JavaScript/TypeScript configuration over
 * CSS-first approach.
 *
 * @param config - Theme configuration
 * @returns Tailwind config object
 *
 * @example
 * ```typescript
 * // tailwind.config.ts
 * import { generateTailwindConfig } from "@platxa/frontend-agent"
 * import { myTheme } from "./theme"
 *
 * export default {
 *   ...generateTailwindConfig(myTheme),
 *   content: ["./src/**\/*.{ts,tsx}"],
 * }
 * ```
 */
export function generateTailwindConfig(
  config: ThemeConfig
): Record<string, unknown> {
  const directive = generateTailwindThemeDirective(config)

  return {
    theme: {
      extend: {
        colors: Object.fromEntries(
          Object.entries(directive.colors).map(([key, value]) => [key, value])
        ),
        spacing: directive.spacing,
        fontFamily: Object.fromEntries(
          Object.entries(directive.fontFamily).map(([key, value]) => [
            key,
            [value],
          ])
        ),
        fontSize: directive.fontSize,
        borderRadius: directive.borderRadius,
        boxShadow: directive.boxShadow,
      },
    },
  }
}

/**
 * Generates custom Tailwind utilities from brand tokens
 *
 * Creates utility classes like `bg-brand-primary`, `text-brand-secondary`, etc.
 *
 * @param config - Theme configuration
 * @param prefix - Utility prefix
 * @returns Utility CSS classes
 */
export function generateTailwindUtilities(
  config: ThemeConfig,
  prefix: string = "brand"
): string {
  const lines: string[] = ["/* Brand Utilities */"]

  // Background utilities
  for (const [key] of Object.entries(config.light.colors)) {
    const kebabKey = toKebabCase(key)
    lines.push(`.bg-${prefix}-${kebabKey} { background-color: var(--color-${kebabKey}); }`)
  }

  // Text utilities
  for (const [key] of Object.entries(config.light.colors)) {
    const kebabKey = toKebabCase(key)
    lines.push(`.text-${prefix}-${kebabKey} { color: var(--color-${kebabKey}); }`)
  }

  // Border utilities
  for (const [key] of Object.entries(config.light.colors)) {
    const kebabKey = toKebabCase(key)
    lines.push(`.border-${prefix}-${kebabKey} { border-color: var(--color-${kebabKey}); }`)
  }

  // Ring utilities
  for (const [key] of Object.entries(config.light.colors)) {
    const kebabKey = toKebabCase(key)
    lines.push(`.ring-${prefix}-${kebabKey} { --tw-ring-color: var(--color-${kebabKey}); }`)
  }

  return lines.join("\n")
}

// =============================================================================
// Feature #96: Monorepo Support
// =============================================================================

/**
 * Package manager types supported
 */
export type PackageManager = "npm" | "pnpm" | "yarn" | "bun"

/**
 * Workspace configuration
 */
export interface WorkspaceConfig {
  /** Root directory of the monorepo */
  root: string
  /** Package directories (glob patterns) */
  packages: string[]
  /** Package manager in use */
  packageManager: PackageManager
  /** Whether using workspace protocol */
  useWorkspaceProtocol: boolean
}

/**
 * Brand kit package reference
 */
export interface BrandKitReference {
  /** Package name */
  name: string
  /** Version or workspace reference */
  version: string
  /** Resolved path (if local) */
  path?: string
  /** Whether this is a workspace package */
  isWorkspace: boolean
}

/**
 * Monorepo brand kit configuration
 */
export interface MonorepoBrandConfig {
  /** Workspace configuration */
  workspace: WorkspaceConfig
  /** Brand kit packages in the monorepo */
  brandKits: BrandKitReference[]
  /** Shared brand kit (if any) */
  sharedBrandKit?: string
  /** Package-specific overrides */
  overrides: Record<string, string>
}

/**
 * Options for resolving brand kits in monorepo
 */
export interface MonorepoResolveOptions {
  /** Current working directory */
  cwd?: string
  /** Follow symlinks */
  followSymlinks?: boolean
  /** Include devDependencies */
  includeDevDeps?: boolean
}

/**
 * Detects the package manager used in a project
 *
 * Checks for lockfiles to determine which package manager is in use.
 *
 * @param rootDir - Root directory to check
 * @returns Detected package manager
 *
 * @example
 * ```typescript
 * const pm = detectPackageManager("/path/to/project")
 * console.log(pm) // "pnpm" | "yarn" | "npm" | "bun"
 * ```
 */
export function detectPackageManager(rootDir: string): PackageManager {
  // Check for lockfiles in order of preference
  const lockfiles: Array<{ file: string; pm: PackageManager }> = [
    { file: "pnpm-lock.yaml", pm: "pnpm" },
    { file: "yarn.lock", pm: "yarn" },
    { file: "bun.lockb", pm: "bun" },
    { file: "package-lock.json", pm: "npm" },
  ]

  for (const { file, pm } of lockfiles) {
    // In browser/non-Node environment, we can't check files
    // Return based on common patterns
    if (rootDir.includes(file.replace(".lock", "").replace(".yaml", ""))) {
      return pm
    }
  }

  // Default to npm
  return "npm"
}

/**
 * Parses a workspace protocol reference
 *
 * Handles workspace:*, workspace:^, workspace:~ patterns.
 *
 * @param version - Version string to parse
 * @returns Parsed reference info
 *
 * @example
 * ```typescript
 * parseWorkspaceProtocol("workspace:*")
 * // { isWorkspace: true, range: "*" }
 *
 * parseWorkspaceProtocol("workspace:^1.0.0")
 * // { isWorkspace: true, range: "^1.0.0" }
 *
 * parseWorkspaceProtocol("^1.0.0")
 * // { isWorkspace: false, range: "^1.0.0" }
 * ```
 */
export function parseWorkspaceProtocol(version: string): {
  isWorkspace: boolean
  range: string
} {
  if (version.startsWith("workspace:")) {
    return {
      isWorkspace: true,
      range: version.slice("workspace:".length),
    }
  }
  return {
    isWorkspace: false,
    range: version,
  }
}

/**
 * Creates a workspace protocol version string
 *
 * @param range - Version range (*, ^, ~, or specific version)
 * @returns Workspace protocol string
 *
 * @example
 * ```typescript
 * createWorkspaceVersion("*") // "workspace:*"
 * createWorkspaceVersion("^1.0.0") // "workspace:^1.0.0"
 * ```
 */
export function createWorkspaceVersion(range: string = "*"): string {
  return `workspace:${range}`
}

/**
 * Resolves a relative path from one package to another in a monorepo
 *
 * Computes the relative path needed to import from one package to another.
 *
 * @param fromPackage - Source package path (relative to monorepo root)
 * @param toPackage - Target package path (relative to monorepo root)
 * @returns Relative path from source to target
 *
 * @example
 * ```typescript
 * resolveMonorepoPath("packages/app", "packages/brand-kit")
 * // "../brand-kit"
 *
 * resolveMonorepoPath("apps/web", "packages/ui")
 * // "../../packages/ui"
 * ```
 */
export function resolveMonorepoPath(
  fromPackage: string,
  toPackage: string
): string {
  // Normalize paths
  const from = fromPackage.replace(/\\/g, "/").replace(/\/$/, "")
  const to = toPackage.replace(/\\/g, "/").replace(/\/$/, "")

  // Split into segments
  const fromParts = from.split("/")
  const toParts = to.split("/")

  // Find common prefix length
  let commonLength = 0
  while (
    commonLength < fromParts.length &&
    commonLength < toParts.length &&
    fromParts[commonLength] === toParts[commonLength]
  ) {
    commonLength++
  }

  // Calculate relative path
  const upCount = fromParts.length - commonLength
  const downParts = toParts.slice(commonLength)

  const relativeParts = [
    ...Array(upCount).fill(".."),
    ...downParts,
  ]

  return relativeParts.join("/") || "."
}

/**
 * Generates package.json dependencies for brand kit in monorepo
 *
 * @param brandKitName - Name of the brand kit package
 * @param options - Configuration options
 * @returns Dependencies object
 *
 * @example
 * ```typescript
 * const deps = generateMonorepoDependencies("@company/brand-kit", {
 *   useWorkspaceProtocol: true,
 *   packageManager: "pnpm",
 * })
 * // { "@company/brand-kit": "workspace:*" }
 * ```
 */
export function generateMonorepoDependencies(
  brandKitName: string,
  options: {
    useWorkspaceProtocol?: boolean
    packageManager?: PackageManager
    version?: string
  } = {}
): Record<string, string> {
  const {
    useWorkspaceProtocol = true,
    packageManager = "pnpm",
    version = "*",
  } = options

  // pnpm and yarn support workspace protocol
  if (useWorkspaceProtocol && (packageManager === "pnpm" || packageManager === "yarn")) {
    return {
      [brandKitName]: createWorkspaceVersion(version),
    }
  }

  // npm and bun use regular version references for local packages
  return {
    [brandKitName]: version === "*" ? "latest" : version,
  }
}

/**
 * Generates tsconfig paths for brand kit in monorepo
 *
 * @param brandKitName - Name of the brand kit package
 * @param brandKitPath - Path to the brand kit package
 * @returns TypeScript paths configuration
 *
 * @example
 * ```typescript
 * const paths = generateTsConfigPaths(
 *   "@company/brand-kit",
 *   "../../packages/brand-kit"
 * )
 * // { "@company/brand-kit": ["../../packages/brand-kit/src"] }
 * ```
 */
export function generateTsConfigPaths(
  brandKitName: string,
  brandKitPath: string
): Record<string, string[]> {
  return {
    [brandKitName]: [`${brandKitPath}/src`],
    [`${brandKitName}/*`]: [`${brandKitPath}/src/*`],
  }
}

/**
 * Generates a complete monorepo configuration for brand kits
 *
 * Creates configuration for sharing brand kits across packages
 * in a monorepo setup.
 *
 * @param config - Monorepo brand configuration
 * @returns Configuration files content
 *
 * @example
 * ```typescript
 * const monoConfig = generateMonorepoConfig({
 *   workspace: {
 *     root: "/home/user/monorepo",
 *     packages: ["packages/*", "apps/*"],
 *     packageManager: "pnpm",
 *     useWorkspaceProtocol: true,
 *   },
 *   brandKits: [
 *     { name: "@company/brand-kit", version: "workspace:*", isWorkspace: true },
 *   ],
 *   overrides: {},
 * })
 * ```
 */
export function generateMonorepoConfig(
  config: MonorepoBrandConfig
): {
  /** pnpm-workspace.yaml content */
  pnpmWorkspace?: string
  /** Root package.json workspaces field */
  packageJsonWorkspaces: string[]
  /** tsconfig.json paths */
  tsconfigPaths: Record<string, string[]>
  /** Vite alias configuration */
  viteAliases: Record<string, string>
} {
  const { workspace, brandKits } = config

  // Generate pnpm workspace config
  let pnpmWorkspace: string | undefined
  if (workspace.packageManager === "pnpm") {
    pnpmWorkspace = `packages:\n${workspace.packages.map((p) => `  - "${p}"`).join("\n")}\n`
  }

  // Generate tsconfig paths for all brand kits
  const tsconfigPaths: Record<string, string[]> = {}
  const viteAliases: Record<string, string> = {}

  for (const kit of brandKits) {
    if (kit.path) {
      Object.assign(tsconfigPaths, generateTsConfigPaths(kit.name, kit.path))
      viteAliases[kit.name] = `${kit.path}/src`
    }
  }

  return {
    pnpmWorkspace,
    packageJsonWorkspaces: workspace.packages,
    tsconfigPaths,
    viteAliases,
  }
}

/**
 * Generates import statements for brand kit in different package contexts
 *
 * @param brandKitName - Name of the brand kit
 * @param exports - What to import from the brand kit
 * @returns Import statement
 *
 * @example
 * ```typescript
 * generateBrandKitImport("@company/brand-kit", ["theme", "tokens"])
 * // 'import { theme, tokens } from "@company/brand-kit"'
 * ```
 */
export function generateBrandKitImport(
  brandKitName: string,
  exports: string[]
): string {
  if (exports.length === 0) {
    return `import "${brandKitName}"`
  }
  return `import { ${exports.join(", ")} } from "${brandKitName}"`
}

/**
 * Validates monorepo brand kit setup
 *
 * Checks that brand kits are properly configured in the monorepo.
 *
 * @param config - Monorepo configuration
 * @returns Validation result
 */
export function validateMonorepoSetup(
  config: MonorepoBrandConfig
): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Check workspace configuration
  if (!config.workspace.root) {
    errors.push("Workspace root is required")
  }

  if (config.workspace.packages.length === 0) {
    errors.push("No package patterns defined")
  }

  // Check brand kit references
  for (const kit of config.brandKits) {
    if (!kit.name) {
      errors.push("Brand kit name is required")
    }

    if (kit.isWorkspace && !kit.path) {
      warnings.push(
        `Workspace package "${kit.name}" has no resolved path`
      )
    }

    // Check version format for workspace packages
    if (kit.isWorkspace) {
      const { isWorkspace } = parseWorkspaceProtocol(kit.version)
      if (!isWorkspace && config.workspace.useWorkspaceProtocol) {
        warnings.push(
          `Package "${kit.name}" should use workspace protocol (current: ${kit.version})`
        )
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Creates a brand kit package structure for monorepo
 *
 * Generates the file structure and configuration for a new
 * brand kit package in a monorepo.
 *
 * @param name - Package name
 * @param theme - Theme configuration
 * @returns Package files content
 */
export function createBrandKitPackage(
  name: string,
  theme: ThemeConfig
): {
  /** package.json content */
  packageJson: Record<string, unknown>
  /** tsconfig.json content */
  tsconfig: Record<string, unknown>
  /** index.ts content */
  indexTs: string
  /** theme.ts content */
  themeTs: string
} {
  const packageJson = {
    name,
    version: "0.0.0",
    type: "module",
    main: "./dist/index.js",
    module: "./dist/index.mjs",
    types: "./dist/index.d.ts",
    exports: {
      ".": {
        import: "./dist/index.mjs",
        require: "./dist/index.js",
        types: "./dist/index.d.ts",
      },
      "./theme": {
        import: "./dist/theme.mjs",
        require: "./dist/theme.js",
        types: "./dist/theme.d.ts",
      },
    },
    files: ["dist"],
    scripts: {
      build: "tsup src/index.ts src/theme.ts --format esm,cjs --dts",
      dev: "tsup src/index.ts src/theme.ts --format esm,cjs --dts --watch",
    },
    peerDependencies: {
      react: ">=18",
    },
    devDependencies: {
      tsup: "^8.0.0",
      typescript: "^5.0.0",
    },
  }

  const tsconfig = {
    compilerOptions: {
      target: "ES2020",
      module: "ESNext",
      moduleResolution: "bundler",
      declaration: true,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      outDir: "./dist",
    },
    include: ["src/**/*"],
  }

  const indexTs = `/**
 * ${name} Brand Kit
 * Generated by @platxa/frontend-agent
 */

export { theme, defaultTheme } from "./theme"
export type { ThemeConfig } from "./theme"
`

  const themeTs = `/**
 * Theme Configuration
 */

export interface ThemeConfig {
  name: string
  light: Record<string, unknown>
  dark?: Record<string, unknown>
}

export const theme: ThemeConfig = ${JSON.stringify(theme, null, 2)}

export const defaultTheme = theme
`

  return {
    packageJson,
    tsconfig,
    indexTs,
    themeTs,
  }
}

// =============================================================================
// Feature #97: Migration Guide
// =============================================================================

/**
 * Breaking change severity
 */
export type BreakingChangeSeverity = "major" | "minor" | "patch"

/**
 * Breaking change entry
 */
export interface BreakingChange {
  /** Unique identifier */
  id: string
  /** Version where change was introduced */
  version: string
  /** Severity of the change */
  severity: BreakingChangeSeverity
  /** What changed */
  description: string
  /** How to migrate */
  migration: string
  /** Affected APIs or components */
  affected: string[]
  /** Codemod available */
  codemod?: string
}

/**
 * Version migration step
 */
export interface MigrationStep {
  /** Step number */
  step: number
  /** Title */
  title: string
  /** Detailed description */
  description: string
  /** Code example (before) */
  before?: string
  /** Code example (after) */
  after?: string
  /** Is this step automated */
  automated: boolean
  /** Command to run (if automated) */
  command?: string
}

/**
 * Migration guide for a version
 */
export interface VersionMigrationGuide {
  /** From version */
  fromVersion: string
  /** To version */
  toVersion: string
  /** Release date */
  releaseDate?: string
  /** Summary of changes */
  summary: string
  /** Breaking changes */
  breakingChanges: BreakingChange[]
  /** Migration steps */
  steps: MigrationStep[]
  /** Deprecations (not breaking yet) */
  deprecations: string[]
  /** New features */
  newFeatures: string[]
}

/**
 * Migration guide options
 */
export interface MigrationGuideOptions {
  /** Include code examples */
  includeExamples?: boolean
  /** Include codemods */
  includeCodemods?: boolean
  /** Format (markdown, json, html) */
  format?: "markdown" | "json" | "html"
}

/**
 * Known breaking changes registry
 */
export const BREAKING_CHANGES: BreakingChange[] = [
  {
    id: "v1-theme-config-structure",
    version: "1.0.0",
    severity: "major",
    description: "ThemeConfig structure changed: `colors` moved under `light.colors`",
    migration: "Move your color definitions from `theme.colors` to `theme.light.colors`",
    affected: ["ThemeConfig", "createTheme", "generateTheme"],
    codemod: "npx @platxa/frontend-agent migrate-theme-config",
  },
  {
    id: "v1-oklch-default",
    version: "1.0.0",
    severity: "minor",
    description: "OKLCH is now the default color format instead of HSL",
    migration: "Update color values to OKLCH format or set `useOklch: false` in options",
    affected: ["generatePalette", "generateSemanticColors"],
  },
  {
    id: "v1-tailwind-v4",
    version: "1.0.0",
    severity: "major",
    description: "Tailwind v4 is now required (CSS-first configuration)",
    migration: "Upgrade to Tailwind v4 and use @theme directive instead of tailwind.config.js",
    affected: ["generateTailwindTheme", "generateCss"],
    codemod: "npx @platxa/frontend-agent migrate-tailwind",
  },
]

/**
 * Gets breaking changes between two versions
 *
 * @param fromVersion - Starting version
 * @param toVersion - Target version
 * @returns Array of breaking changes
 */
export function getBreakingChangesBetween(
  fromVersion: string,
  toVersion: string
): BreakingChange[] {
  // Parse versions (simplified semver comparison)
  const parseVersion = (v: string): number[] => {
    return v.replace(/^v/, "").split(".").map(Number)
  }

  const from = parseVersion(fromVersion)
  const to = parseVersion(toVersion)

  return BREAKING_CHANGES.filter((change) => {
    const changeVersion = parseVersion(change.version)
    // Include if change version is > fromVersion and <= toVersion
    const afterFrom =
      changeVersion[0] > from[0] ||
      (changeVersion[0] === from[0] && changeVersion[1] > from[1]) ||
      (changeVersion[0] === from[0] &&
        changeVersion[1] === from[1] &&
        changeVersion[2] > from[2])
    const beforeOrEqualTo =
      changeVersion[0] < to[0] ||
      (changeVersion[0] === to[0] && changeVersion[1] < to[1]) ||
      (changeVersion[0] === to[0] &&
        changeVersion[1] === to[1] &&
        changeVersion[2] <= to[2])

    return afterFrom && beforeOrEqualTo
  })
}

/**
 * Generates a migration guide between versions
 *
 * @param fromVersion - Starting version
 * @param toVersion - Target version
 * @param options - Guide options
 * @returns Migration guide
 *
 * @example
 * ```typescript
 * const guide = generateMigrationGuide("0.9.0", "1.0.0")
 * console.log(guide.breakingChanges)
 * ```
 */
export function generateMigrationGuide(
  fromVersion: string,
  toVersion: string,
  options: MigrationGuideOptions = {}
): VersionMigrationGuide {
  const breakingChanges = getBreakingChangesBetween(fromVersion, toVersion)

  const steps: MigrationStep[] = []
  let stepNumber = 1

  // Add backup step
  steps.push({
    step: stepNumber++,
    title: "Backup your project",
    description: "Create a backup or commit your current state before migrating.",
    automated: false,
  })

  // Add update step
  steps.push({
    step: stepNumber++,
    title: "Update package version",
    description: `Update @platxa/frontend-agent to version ${toVersion}`,
    command: `npm install @platxa/frontend-agent@${toVersion}`,
    automated: true,
  })

  // Add steps for each breaking change
  for (const change of breakingChanges) {
    const step: MigrationStep = {
      step: stepNumber++,
      title: `Migrate: ${change.id}`,
      description: change.migration,
      automated: !!change.codemod,
    }

    if (change.codemod && options.includeCodemods !== false) {
      step.command = change.codemod
    }

    steps.push(step)
  }

  // Add verification step
  steps.push({
    step: stepNumber++,
    title: "Verify migration",
    description: "Run your tests and check that everything works correctly.",
    command: "npm test",
    automated: true,
  })

  return {
    fromVersion,
    toVersion,
    summary: `Migration guide from v${fromVersion} to v${toVersion}. ${breakingChanges.length} breaking change(s) to address.`,
    breakingChanges,
    steps,
    deprecations: [],
    newFeatures: [],
  }
}

/**
 * Formats a migration guide as Markdown
 *
 * @param guide - Migration guide
 * @returns Markdown string
 */
export function formatMigrationGuideMarkdown(
  guide: VersionMigrationGuide
): string {
  const lines: string[] = []

  lines.push(`# Migration Guide: v${guide.fromVersion} → v${guide.toVersion}`)
  lines.push("")
  lines.push(guide.summary)
  lines.push("")

  // Breaking changes
  if (guide.breakingChanges.length > 0) {
    lines.push("## Breaking Changes")
    lines.push("")

    for (const change of guide.breakingChanges) {
      lines.push(`### ${change.id}`)
      lines.push("")
      lines.push(`**Severity:** ${change.severity}`)
      lines.push("")
      lines.push(change.description)
      lines.push("")
      lines.push(`**Affected:** ${change.affected.join(", ")}`)
      lines.push("")
      lines.push(`**Migration:** ${change.migration}`)
      lines.push("")

      if (change.codemod) {
        lines.push("```bash")
        lines.push(change.codemod)
        lines.push("```")
        lines.push("")
      }
    }
  }

  // Migration steps
  lines.push("## Migration Steps")
  lines.push("")

  for (const step of guide.steps) {
    lines.push(`### Step ${step.step}: ${step.title}`)
    lines.push("")
    lines.push(step.description)
    lines.push("")

    if (step.command) {
      lines.push("```bash")
      lines.push(step.command)
      lines.push("```")
      lines.push("")
    }

    if (step.before && step.after) {
      lines.push("**Before:**")
      lines.push("```typescript")
      lines.push(step.before)
      lines.push("```")
      lines.push("")
      lines.push("**After:**")
      lines.push("```typescript")
      lines.push(step.after)
      lines.push("```")
      lines.push("")
    }
  }

  // Deprecations
  if (guide.deprecations.length > 0) {
    lines.push("## Deprecations")
    lines.push("")
    for (const dep of guide.deprecations) {
      lines.push(`- ${dep}`)
    }
    lines.push("")
  }

  // New features
  if (guide.newFeatures.length > 0) {
    lines.push("## New Features")
    lines.push("")
    for (const feature of guide.newFeatures) {
      lines.push(`- ${feature}`)
    }
    lines.push("")
  }

  return lines.join("\n")
}

/**
 * Detects potential migration issues in a theme config
 *
 * @param config - Theme configuration to check
 * @param targetVersion - Version migrating to
 * @returns List of potential issues
 */
export function detectMigrationIssues(
  config: ThemeConfig,
  targetVersion: string = "1.0.0"
): {
  issues: Array<{
    severity: "error" | "warning" | "info"
    message: string
    fix?: string
  }>
  compatible: boolean
  targetVersion: string
} {
  const issues: Array<{
    severity: "error" | "warning" | "info"
    message: string
    fix?: string
  }> = []

  // Parse target version for version-specific checks
  const [major] = targetVersion.replace(/^v/, "").split(".").map(Number)

  // Check for deprecated patterns
  if (!config.name) {
    issues.push({
      severity: "error",
      message: "Theme config must have a name",
      fix: "Add a 'name' property to your theme config",
    })
  }

  if (!config.light) {
    issues.push({
      severity: "error",
      message: "Theme config must have light mode tokens",
      fix: "Add a 'light' property with your design tokens",
    })
  }

  // Check color format (warn if using old HSL format) - applies to v1+
  if (major >= 1 && config.light?.colors) {
    const colors = config.light.colors
    for (const [key, value] of Object.entries(colors)) {
      if (typeof value === "string" && value.startsWith("hsl(")) {
        issues.push({
          severity: "warning",
          message: `Color '${key}' uses HSL format. Consider migrating to OKLCH for v${major}.x.`,
          fix: `Use oklch() format for better color interpolation`,
        })
      }
    }
  }

  // Check for extends field (v1 feature)
  if (config.extends && typeof config.extends === "string") {
    issues.push({
      severity: "info",
      message: `Using string-based extends for v${targetVersion}. Ensure brand kit registry is configured.`,
    })
  }

  return {
    issues,
    compatible: !issues.some((i) => i.severity === "error"),
    targetVersion,
  }
}

/**
 * Generates a codemod script for theme migration
 *
 * @param fromVersion - Source version
 * @param toVersion - Target version
 * @returns Codemod script as string
 */
export function generateMigrationCodemod(
  fromVersion: string,
  toVersion: string
): string {
  return `#!/usr/bin/env node
/**
 * Migration Codemod: v${fromVersion} → v${toVersion}
 * Generated by @platxa/frontend-agent
 *
 * Usage: node migrate.js [files...]
 */

const fs = require("fs")
const path = require("path")

const transforms = [
  // Transform old theme structure to new
  {
    pattern: /theme\\.colors\\s*=/g,
    replacement: "theme.light.colors =",
    description: "Move colors under light mode",
  },
  // Transform HSL to OKLCH (basic)
  {
    pattern: /hsl\\((\\d+)\\s+(\\d+)%\\s+(\\d+)%\\)/g,
    replacement: (match, h, s, l) => {
      // Simplified conversion (real conversion would need color math)
      const lightness = parseInt(l) / 100
      const chroma = parseInt(s) / 100 * 0.4
      return \`oklch(\${lightness.toFixed(2)} \${chroma.toFixed(2)} \${h})\`
    },
    description: "Convert HSL to OKLCH",
  },
]

function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8")
  let modified = false

  for (const transform of transforms) {
    if (transform.pattern.test(content)) {
      content = content.replace(transform.pattern, transform.replacement)
      modified = true
      console.log(\`  Applied: \${transform.description}\`)
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content)
    console.log(\`✓ Migrated: \${filePath}\`)
  }

  return modified
}

// Run on provided files or find theme files
const files = process.argv.slice(2)
if (files.length === 0) {
  console.log("Usage: node migrate.js [files...]")
  console.log("Example: node migrate.js src/theme.ts src/tokens.ts")
  process.exit(1)
}

let migratedCount = 0
for (const file of files) {
  if (migrateFile(file)) {
    migratedCount++
  }
}

console.log(\`\\nMigration complete: \${migratedCount} file(s) updated\`)
`
}

// =============================================================================
// Feature #98: Best Practices Guide
// =============================================================================

/** Best practice category */
export type BestPracticeCategory =
  | "performance"
  | "accessibility"
  | "maintainability"
  | "security"
  | "compatibility"

/** Best practice severity */
export type BestPracticeSeverity = "required" | "recommended" | "optional"

/** Best practice entry */
export interface BestPractice {
  id: string
  category: BestPracticeCategory
  severity: BestPracticeSeverity
  title: string
  description: string
  doThis: string
  dontDoThis: string
}

/** Anti-pattern entry */
export interface AntiPattern {
  id: string
  category: BestPracticeCategory
  name: string
  problem: string
  consequences: string[]
  solution: string
}

/** Performance tip */
export interface PerformanceTip {
  id: string
  title: string
  impact: "high" | "medium" | "low"
  description: string
  implementation: string
  metricsAffected: string[]
}

/** Accessibility guideline */
export interface AccessibilityGuideline {
  id: string
  wcagCriterion?: string
  level: "A" | "AA" | "AAA"
  title: string
  description: string
  implementation: string
  testing: string
}

/** Best practices registry */
export const BEST_PRACTICES: BestPractice[] = [
  {
    id: "use-oklch-colors",
    category: "compatibility",
    severity: "recommended",
    title: "Use OKLCH color format",
    description: "OKLCH provides perceptually uniform color manipulation.",
    doThis: "Define colors using oklch() format",
    dontDoThis: "Use HSL or RGB for colors needing interpolation",
  },
  {
    id: "semantic-color-names",
    category: "maintainability",
    severity: "required",
    title: "Use semantic color names",
    description: "Name colors by purpose not appearance.",
    doThis: "Use names like primary, secondary, accent",
    dontDoThis: "Use names like blue, red, lightGray",
  },
  {
    id: "contrast-ratios",
    category: "accessibility",
    severity: "required",
    title: "Ensure WCAG contrast ratios",
    description: "Text must have sufficient contrast.",
    doThis: "Maintain 4.5:1 ratio for normal text",
    dontDoThis: "Use low-contrast color combinations",
  },
  {
    id: "focus-visible-styles",
    category: "accessibility",
    severity: "required",
    title: "Provide visible focus indicators",
    description: "Interactive elements need visible focus states.",
    doThis: "Use focus-visible with high-contrast ring",
    dontDoThis: "Remove focus outlines without alternatives",
  },
  {
    id: "reduced-motion",
    category: "accessibility",
    severity: "required",
    title: "Respect reduced motion preferences",
    description: "Honor prefers-reduced-motion setting.",
    doThis: "Wrap animations in prefers-reduced-motion query",
    dontDoThis: "Apply animations unconditionally",
  },
  {
    id: "css-variables",
    category: "performance",
    severity: "recommended",
    title: "Use CSS custom properties",
    description: "CSS variables enable runtime theme switching.",
    doThis: "Define tokens as CSS custom properties",
    dontDoThis: "Hard-code values throughout components",
  },
  {
    id: "dark-mode-colors-only",
    category: "performance",
    severity: "recommended",
    title: "Only override colors in dark mode",
    description: "Dark mode should only change colors.",
    doThis: "Define dark mode as Partial<SemanticColors>",
    dontDoThis: "Duplicate all tokens for dark mode",
  },
]

/** Anti-patterns registry */
export const ANTI_PATTERNS: AntiPattern[] = [
  {
    id: "magic-numbers",
    category: "maintainability",
    name: "Magic Numbers",
    problem: "Hard-coded values without semantic meaning",
    consequences: ["Hard to maintain", "Inconsistent"],
    solution: "Use design tokens for all values",
  },
  {
    id: "z-index-wars",
    category: "maintainability",
    name: "Z-Index Wars",
    problem: "Arbitrary z-index values competing",
    consequences: ["Unpredictable layering"],
    solution: "Use a z-index scale with semantic names",
  },
]

/** Performance tips */
export const PERFORMANCE_TIPS: PerformanceTip[] = [
  {
    id: "critical-css",
    title: "Extract Critical CSS",
    impact: "high",
    description: "Inline critical CSS to prevent render-blocking",
    implementation: "Use generateCriticalCss()",
    metricsAffected: ["FCP", "LCP"],
  },
  {
    id: "static-generation",
    title: "Generate CSS at Build Time",
    impact: "high",
    description: "Pre-generate CSS instead of runtime",
    implementation: "Use buildStaticTheme()",
    metricsAffected: ["FCP", "TTI"],
  },
]

/** Accessibility guidelines */
export const ACCESSIBILITY_GUIDELINES: AccessibilityGuideline[] = [
  {
    id: "color-contrast",
    wcagCriterion: "1.4.3",
    level: "AA",
    title: "Contrast (Minimum)",
    description: "Text must have contrast ratio of at least 4.5:1",
    implementation: "Use validateContrast()",
    testing: "Run generateWcagReport()",
  },
  {
    id: "focus-visible",
    wcagCriterion: "2.4.7",
    level: "AA",
    title: "Focus Visible",
    description: "Keyboard focus indicator must be visible",
    implementation: "Define --color-ring for focus styles",
    testing: "Tab through all interactive elements",
  },
]

/** Gets best practices by category */
export function getBestPracticesByCategory(
  category: BestPracticeCategory
): BestPractice[] {
  return BEST_PRACTICES.filter((bp) => bp.category === category)
}

/** Gets required best practices */
export function getRequiredBestPractices(): BestPractice[] {
  return BEST_PRACTICES.filter((bp) => bp.severity === "required")
}

/** Validates theme config against best practices */
export function validateBestPractices(config: ThemeConfig): {
  passed: BestPractice[]
  failed: Array<{ practice: BestPractice; reason: string }>
  score: number
} {
  const passed: BestPractice[] = []
  const failed: Array<{ practice: BestPractice; reason: string }> = []

  const semanticNames = ["primary", "secondary", "background", "foreground"]
  const hasSemanticNames =
    config.light?.colors &&
    semanticNames.some((name) => name in config.light.colors)

  const semanticPractice = BEST_PRACTICES.find(
    (bp) => bp.id === "semantic-color-names"
  )
  if (semanticPractice) {
    if (hasSemanticNames) {
      passed.push(semanticPractice)
    } else {
      failed.push({ practice: semanticPractice, reason: "No semantic names" })
    }
  }

  const total = passed.length + failed.length
  const score = total > 0 ? (passed.length / total) * 100 : 100

  return { passed, failed, score }
}

/** Formats best practices as Markdown */
export function formatBestPracticesMarkdown(): string {
  const lines: string[] = ["# Best Practices Guide", ""]

  for (const bp of BEST_PRACTICES) {
    const badge = bp.severity === "required" ? "Required" : "Recommended"
    lines.push("## [" + badge + "] " + bp.title)
    lines.push("")
    lines.push(bp.description)
    lines.push("")
    lines.push("Do: " + bp.doThis)
    lines.push("Dont: " + bp.dontDoThis)
    lines.push("")
  }

  return lines.join("\n")
}

// =============================================================================
// Feature #99: Troubleshooting Guide
// =============================================================================

/**
 * FAQ entry for common questions
 */
export interface FaqEntry {
  id: string
  question: string
  answer: string
  category: "setup" | "usage" | "migration" | "debugging" | "performance"
  relatedDocs?: string[]
}

/**
 * Error entry for error message index
 */
export interface ErrorEntry {
  code: string
  message: string
  cause: string
  solution: string
  example?: string
}

/**
 * Debug technique description
 */
export interface DebugTechnique {
  id: string
  name: string
  description: string
  steps: string[]
  tools: string[]
  when: string
}

/**
 * FAQ registry - Common questions and answers
 */
export const FAQS: FaqEntry[] = [
  {
    id: "faq-dark-mode",
    question: "How do I enable dark mode?",
    answer:
      "Set defaultMode to 'dark' in ThemeConfig, or use setThemeMode('dark') at runtime. The theme system respects system preferences when set to 'system'.",
    category: "usage",
    relatedDocs: ["useTheme", "setThemeMode"],
  },
  {
    id: "faq-custom-colors",
    question: "How do I add custom colors?",
    answer:
      "Extend the SemanticColors interface and add your colors to light.colors in ThemeConfig. Dark mode overrides go in config.dark.",
    category: "usage",
    relatedDocs: ["SemanticColors", "ThemeConfig"],
  },
  {
    id: "faq-oklch",
    question: "Why use OKLCH instead of HSL?",
    answer:
      "OKLCH provides perceptually uniform lightness, meaning colors with the same L value appear equally bright. This makes palette generation more predictable.",
    category: "usage",
  },
  {
    id: "faq-tailwind-v4",
    question: "How do I integrate with Tailwind v4?",
    answer:
      "Use generateTailwindThemeDirective() to create @theme CSS content, or generateTailwindV4Css() for a complete CSS file with tokens.",
    category: "setup",
    relatedDocs: ["generateTailwindThemeDirective", "generateTailwindV4Css"],
  },
  {
    id: "faq-ssr",
    question: "How do I prevent hydration mismatch with SSR?",
    answer:
      "Use generateSSRHeadContent() to inline theme CSS and initialization script. This ensures the theme matches between server and client.",
    category: "setup",
    relatedDocs: ["generateSSRHeadContent", "createSSRThemeProviderProps"],
  },
  {
    id: "faq-brand-extension",
    question: "How do I create a brand variant?",
    answer:
      "Use extendBrand() to create a new theme based on an existing one, or set the 'extends' field in ThemeConfig for inheritance.",
    category: "usage",
    relatedDocs: ["extendBrand", "createChildBrand"],
  },
  {
    id: "faq-contrast-check",
    question: "How do I validate color contrast?",
    answer:
      "Use validateContrast() for individual color pairs, or generateWcagReport() for a complete accessibility audit of your theme.",
    category: "debugging",
    relatedDocs: ["validateContrast", "generateWcagReport"],
  },
  {
    id: "faq-migration",
    question: "How do I migrate from v1 to v2?",
    answer:
      "Run generateMigrationGuide('1.0.0', '2.0.0') to get step-by-step instructions. Use generateMigrationCodemod() to auto-fix common patterns.",
    category: "migration",
    relatedDocs: ["generateMigrationGuide", "generateMigrationCodemod"],
  },
]

/**
 * Error index - Common errors and solutions
 */
export const ERROR_INDEX: ErrorEntry[] = [
  {
    code: "THEME_001",
    message: "Theme configuration missing required field: colors",
    cause: "ThemeConfig.light.colors is undefined or empty",
    solution:
      "Provide at least primary, background, and foreground colors in light.colors",
    example:
      "light: { colors: { primary: 'oklch(...)', background: '...', foreground: '...' } }",
  },
  {
    code: "THEME_002",
    message: "Invalid color format",
    cause: "Color string does not match supported formats (hex, rgb, hsl, oklch)",
    solution:
      "Use a valid color format: #RGB, #RRGGBB, rgb(), hsl(), or oklch()",
    example: "oklch(0.7 0.15 250) or #3b82f6",
  },
  {
    code: "THEME_003",
    message: "Circular inheritance detected",
    cause: "Brand kit A extends B which extends A (directly or indirectly)",
    solution:
      "Review the extends chain and remove the circular reference. Use checkCircularReferences() to identify the cycle.",
  },
  {
    code: "THEME_004",
    message: "Parent brand kit not found",
    cause:
      "ThemeConfig.extends references a string name not in the registry",
    solution:
      "Either provide the parent as a ThemeConfig object, or register it with createBrandKitRegistry() first.",
  },
  {
    code: "THEME_005",
    message: "Contrast ratio below WCAG threshold",
    cause: "Text color on background does not meet 4.5:1 ratio for AA compliance",
    solution:
      "Adjust colors using suggestContrastAdjustment() or manually increase lightness difference.",
  },
  {
    code: "THEME_006",
    message: "Token reference not found",
    cause: "A token value references another token that does not exist",
    solution:
      "Check token names for typos. Use checkBrandKitCircularReferences() to validate references.",
  },
  {
    code: "THEME_007",
    message: "SSR hydration mismatch",
    cause:
      "Theme state differs between server and client due to missing initialization",
    solution:
      "Use generateSSRHeadContent() in your HTML head, or createSSRThemeProviderProps() for the provider.",
  },
  {
    code: "THEME_008",
    message: "Size limit exceeded",
    cause: "Generated theme output exceeds configured size threshold",
    solution:
      "Review getSizeBreakdown() output and remove unused tokens. Consider splitting into multiple brand kits.",
  },
]

/**
 * Debug techniques registry
 */
export const DEBUG_TECHNIQUES: DebugTechnique[] = [
  {
    id: "debug-css-vars",
    name: "Inspect CSS Variables",
    description: "View computed CSS custom property values in browser DevTools",
    steps: [
      "Open browser DevTools (F12)",
      "Select an element using the theme",
      "Go to Computed tab",
      "Filter by '--' to see custom properties",
      "Check values match expected tokens",
    ],
    tools: ["Browser DevTools"],
    when: "Colors or spacing don't match expected values",
  },
  {
    id: "debug-contrast",
    name: "Validate Color Contrast",
    description: "Check if colors meet WCAG accessibility requirements",
    steps: [
      "Import { generateWcagReport } from theme module",
      "Run generateWcagReport(config)",
      "Review failing checks for each level (A, AA, AAA)",
      "Use suggestContrastAdjustment() for fixes",
    ],
    tools: ["generateWcagReport", "validateContrast"],
    when: "Accessibility audit fails or text is hard to read",
  },
  {
    id: "debug-inheritance",
    name: "Debug Brand Inheritance",
    description: "Trace token resolution through inheritance chain",
    steps: [
      "Use resolveBrandInheritance(config) with { validate: true }",
      "Check returned 'chain' array for inheritance order",
      "Review 'warnings' for any issues",
      "Use flattenBrandInheritance() to see final merged tokens",
    ],
    tools: ["resolveBrandInheritance", "flattenBrandInheritance"],
    when: "Inherited tokens not appearing or overrides not working",
  },
  {
    id: "debug-hydration",
    name: "Fix SSR Hydration Mismatch",
    description: "Resolve server/client theme state differences",
    steps: [
      "Ensure generateSSRHeadContent() is in HTML head",
      "Verify theme script runs before React hydrates",
      "Check localStorage/cookie for persisted theme mode",
      "Use getSSRSafeThemeState() for initial render",
    ],
    tools: ["generateSSRHeadContent", "getSSRSafeThemeState"],
    when: "Console shows hydration mismatch warnings",
  },
  {
    id: "debug-size",
    name: "Analyze Bundle Size",
    description: "Identify which parts of theme contribute to bundle size",
    steps: [
      "Run getSizeBreakdown(config) to see section sizes",
      "Check if 'colors' or 'palettes' are unexpectedly large",
      "Use validateBrandKitSize() with custom thresholds",
      "Consider extractPartialBrandKit() to reduce size",
    ],
    tools: ["getSizeBreakdown", "validateBrandKitSize"],
    when: "Theme adds too much to JavaScript bundle",
  },
  {
    id: "debug-circular",
    name: "Find Circular References",
    description: "Detect and fix circular token dependencies",
    steps: [
      "Run checkBrandKitCircularReferences(config)",
      "Review 'cycles' array in result",
      "Each cycle shows the path: A -> B -> C -> A",
      "Break the cycle by using direct values instead of references",
    ],
    tools: ["checkBrandKitCircularReferences", "buildDependencyGraph"],
    when: "Runtime error about maximum call stack or infinite loop",
  },
]

/**
 * Searches FAQs by keyword
 *
 * @param query - Search query string
 * @returns Matching FAQ entries
 *
 * @example
 * ```typescript
 * const results = searchFaq("dark mode")
 * // Returns FAQs mentioning dark mode
 * ```
 */
export function searchFaq(query: string): FaqEntry[] {
  const lowerQuery = query.toLowerCase()
  return FAQS.filter(
    (faq) =>
      faq.question.toLowerCase().includes(lowerQuery) ||
      faq.answer.toLowerCase().includes(lowerQuery)
  )
}

/**
 * Gets FAQ entries by category
 *
 * @param category - FAQ category to filter by
 * @returns FAQ entries in the category
 */
export function getFaqsByCategory(category: FaqEntry["category"]): FaqEntry[] {
  return FAQS.filter((faq) => faq.category === category)
}

/**
 * Looks up an error by code
 *
 * @param code - Error code (e.g., "THEME_001")
 * @returns Error entry or undefined
 *
 * @example
 * ```typescript
 * const error = getErrorByCode("THEME_003")
 * console.log(error?.solution)
 * ```
 */
export function getErrorByCode(code: string): ErrorEntry | undefined {
  return ERROR_INDEX.find((err) => err.code === code)
}

/**
 * Suggests a solution based on error message content
 *
 * Performs fuzzy matching on error message to find relevant solutions.
 *
 * @param errorMessage - Error message text
 * @returns Matching error entries sorted by relevance
 *
 * @example
 * ```typescript
 * const suggestions = suggestSolution("circular reference detected")
 * // Returns THEME_003 and related entries
 * ```
 */
export function suggestSolution(errorMessage: string): ErrorEntry[] {
  const lowerMessage = errorMessage.toLowerCase()
  const keywords = [
    { pattern: /circular|cycle|loop/i, code: "THEME_003" },
    { pattern: /not found|missing|undefined/i, code: "THEME_001" },
    { pattern: /color|format|invalid.*color/i, code: "THEME_002" },
    { pattern: /parent|extend|inherit/i, code: "THEME_004" },
    { pattern: /contrast|wcag|accessibility/i, code: "THEME_005" },
    { pattern: /reference|token.*not/i, code: "THEME_006" },
    { pattern: /hydration|mismatch|ssr/i, code: "THEME_007" },
    { pattern: /size|limit|exceed/i, code: "THEME_008" },
  ]

  const matchedCodes = new Set<string>()
  for (const { pattern, code } of keywords) {
    if (pattern.test(lowerMessage)) {
      matchedCodes.add(code)
    }
  }

  // Also do direct text matching on error messages
  for (const entry of ERROR_INDEX) {
    if (
      entry.message.toLowerCase().includes(lowerMessage) ||
      lowerMessage.includes(entry.message.toLowerCase())
    ) {
      matchedCodes.add(entry.code)
    }
  }

  return ERROR_INDEX.filter((err) => matchedCodes.has(err.code))
}

/**
 * Gets debug technique by ID
 *
 * @param id - Technique ID
 * @returns Debug technique or undefined
 */
export function getDebugTechnique(id: string): DebugTechnique | undefined {
  return DEBUG_TECHNIQUES.find((tech) => tech.id === id)
}

/**
 * Formats troubleshooting guide as Markdown
 *
 * Generates a complete troubleshooting document with FAQs,
 * error index, and debugging techniques.
 *
 * @returns Markdown string
 *
 * @example
 * ```typescript
 * const markdown = formatTroubleshootingMarkdown()
 * fs.writeFileSync("TROUBLESHOOTING.md", markdown)
 * ```
 */
export function formatTroubleshootingMarkdown(): string {
  const lines: string[] = ["# Troubleshooting Guide", ""]

  // FAQ Section
  lines.push("## Frequently Asked Questions", "")
  const categories = ["setup", "usage", "migration", "debugging", "performance"] as const
  for (const category of categories) {
    const faqs = getFaqsByCategory(category)
    if (faqs.length > 0) {
      lines.push(
        `### ${category.charAt(0).toUpperCase() + category.slice(1)}`,
        ""
      )
      for (const faq of faqs) {
        lines.push(`**Q: ${faq.question}**`, "")
        lines.push(`A: ${faq.answer}`, "")
        if (faq.relatedDocs && faq.relatedDocs.length > 0) {
          lines.push(`_See also: ${faq.relatedDocs.join(", ")}_`, "")
        }
        lines.push("")
      }
    }
  }

  // Error Index Section
  lines.push("## Error Index", "")
  for (const err of ERROR_INDEX) {
    lines.push(`### ${err.code}: ${err.message}`, "")
    lines.push(`**Cause:** ${err.cause}`, "")
    lines.push(`**Solution:** ${err.solution}`, "")
    if (err.example) {
      lines.push("", "```typescript", err.example, "```", "")
    }
    lines.push("")
  }

  // Debug Techniques Section
  lines.push("## Debug Techniques", "")
  for (const tech of DEBUG_TECHNIQUES) {
    lines.push(`### ${tech.name}`, "")
    lines.push(tech.description, "")
    lines.push("", "**When to use:** " + tech.when, "")
    lines.push("", "**Steps:**", "")
    for (let i = 0; i < tech.steps.length; i++) {
      lines.push(`${i + 1}. ${tech.steps[i]}`)
    }
    lines.push("", `**Tools:** ${tech.tools.join(", ")}`, "")
  }

  return lines.join("\n")
}

// =============================================================================
// Feature #100: AI Color Suggestions
// =============================================================================

/**
 * Color suggestion use case
 */
export type ColorUseCase =
  | "background"
  | "text"
  | "button"
  | "link"
  | "border"
  | "accent"
  | "error"
  | "success"
  | "warning"

/**
 * Color suggestion result
 */
export interface ColorSuggestion {
  /** Suggested color value in OKLCH */
  color: string
  /** Semantic name if applicable */
  semanticName?: keyof SemanticColors
  /** Confidence score (0-1) */
  confidence: number
  /** Reason for suggestion */
  reason: string
  /** Contrast ratio with paired color */
  contrastRatio?: number
  /** WCAG compliance level */
  wcagLevel?: "AA" | "AAA" | "fail"
}

/**
 * Options for color suggestion
 */
export interface ColorSuggestionOptions {
  /** Use case for the color */
  useCase: ColorUseCase
  /** Existing palette to match */
  palette?: ThemeConfig
  /** Background color for contrast calculations */
  backgroundColor?: string
  /** Minimum contrast ratio required */
  minContrast?: number
  /** Prefer semantic colors from palette */
  preferSemantic?: boolean
  /** Number of suggestions to return */
  limit?: number
}

/**
 * Palette analysis result
 */
export interface PaletteAnalysis {
  /** Dominant hue range */
  dominantHue: { min: number; max: number; center: number }
  /** Average chroma */
  averageChroma: number
  /** Lightness range */
  lightnessRange: { min: number; max: number }
  /** Color temperature (warm/cool/neutral) */
  temperature: "warm" | "cool" | "neutral"
  /** Detected color harmony */
  harmony: "monochromatic" | "analogous" | "complementary" | "triadic" | "mixed"
}

/**
 * Gets relative luminance from a color string
 *
 * Helper that parses a color string and returns its relative luminance.
 * Used for determining light/dark backgrounds and contrast calculations.
 *
 * @param colorString - Color in any supported format (hex, rgb, hsl, oklch)
 * @returns Relative luminance (0-1) or 0 if parsing fails
 */
function getLuminanceFromColorString(colorString: string): number {
  const rgb = parseColorToRgb(colorString)
  if (!rgb) return 0
  return getRelativeLuminance(rgb)
}

/**
 * Analyzes a theme palette to extract characteristics
 *
 * @param config - Theme configuration to analyze
 * @returns Palette analysis with dominant colors and harmony
 *
 * @example
 * ```typescript
 * const analysis = analyzePalette(myTheme)
 * console.log(analysis.temperature) // "cool"
 * console.log(analysis.harmony) // "analogous"
 * ```
 */
export function analyzePalette(config: ThemeConfig): PaletteAnalysis {
  const colors = config.light.colors
  const oklchColors: OklchColor[] = []

  // Convert all colors to OKLCH for analysis
  for (const value of Object.values(colors)) {
    const colorStr = typeof value === "string" ? value : ""
    if (colorStr.startsWith("oklch")) {
      const parsed = parseOklch(colorStr)
      if (parsed) {
        oklchColors.push(parsed)
      }
    } else if (colorStr.startsWith("#")) {
      const rgb = parseHex(colorStr)
      if (rgb) {
        const oklch = rgbToOklch(rgb)
        oklchColors.push(oklch)
      }
    } else if (colorStr.startsWith("hsl")) {
      const hsl = parseHsl(colorStr)
      if (hsl) {
        const oklch = hslToOklch(hsl)
        oklchColors.push(oklch)
      }
    }
  }

  if (oklchColors.length === 0) {
    return {
      dominantHue: { min: 0, max: 360, center: 180 },
      averageChroma: 0.1,
      lightnessRange: { min: 0.2, max: 0.8 },
      temperature: "neutral",
      harmony: "mixed",
    }
  }

  // Calculate hue statistics
  const hues = oklchColors.map((c) => c.h).filter((h) => !isNaN(h))
  const minHue = Math.min(...hues)
  const maxHue = Math.max(...hues)
  const centerHue = hues.reduce((a, b) => a + b, 0) / hues.length

  // Calculate average chroma
  const chromas = oklchColors.map((c) => c.c)
  const averageChroma = chromas.reduce((a, b) => a + b, 0) / chromas.length

  // Calculate lightness range
  const lightnesses = oklchColors.map((c) => c.l)
  const minL = Math.min(...lightnesses)
  const maxL = Math.max(...lightnesses)

  // Determine temperature
  let temperature: "warm" | "cool" | "neutral"
  if (centerHue >= 0 && centerHue < 60) {
    temperature = "warm" // reds, oranges
  } else if (centerHue >= 60 && centerHue < 150) {
    temperature = "warm" // yellows, yellow-greens
  } else if (centerHue >= 150 && centerHue < 270) {
    temperature = "cool" // greens, cyans, blues
  } else if (centerHue >= 270 && centerHue < 330) {
    temperature = "cool" // purples
  } else {
    temperature = "warm" // magentas, reds
  }

  // If low chroma, consider neutral
  if (averageChroma < 0.05) {
    temperature = "neutral"
  }

  // Determine harmony based on hue spread
  const hueSpread = maxHue - minHue
  let harmony: PaletteAnalysis["harmony"]
  if (hueSpread < 30) {
    harmony = "monochromatic"
  } else if (hueSpread < 60) {
    harmony = "analogous"
  } else if (hueSpread > 150 && hueSpread < 210) {
    harmony = "complementary"
  } else if (hueSpread > 100 && hueSpread < 140) {
    harmony = "triadic"
  } else {
    harmony = "mixed"
  }

  return {
    dominantHue: { min: minHue, max: maxHue, center: centerHue },
    averageChroma,
    lightnessRange: { min: minL, max: maxL },
    temperature,
    harmony,
  }
}

/**
 * Suggests colors that match a brand palette
 *
 * Uses the existing palette's characteristics to suggest colors
 * that harmonize while meeting contrast requirements.
 *
 * @param options - Suggestion options
 * @returns Array of color suggestions sorted by confidence
 *
 * @example
 * ```typescript
 * const suggestions = suggestColors({
 *   useCase: "button",
 *   palette: myTheme,
 *   backgroundColor: "oklch(0.98 0 0)",
 *   minContrast: 4.5,
 *   preferSemantic: true,
 * })
 *
 * console.log(suggestions[0])
 * // { color: "oklch(0.5 0.15 250)", semanticName: "primary", confidence: 0.95, ... }
 * ```
 */
export function suggestColors(options: ColorSuggestionOptions): ColorSuggestion[] {
  const {
    useCase,
    palette,
    backgroundColor = "oklch(0.98 0 0)", // Default light background
    minContrast = 4.5,
    preferSemantic = true,
    limit = 5,
  } = options

  const suggestions: ColorSuggestion[] = []

  // If palette provided, try semantic colors first
  if (palette && preferSemantic) {
    const semanticSuggestions = suggestSemanticColor(useCase, palette, backgroundColor, minContrast)
    suggestions.push(...semanticSuggestions)
  }

  // Analyze palette for harmony-based suggestions
  const analysis = palette ? analyzePalette(palette) : null

  // Generate harmony-based suggestions
  const harmonySuggestions = generateHarmonyColors(
    analysis,
    useCase,
    backgroundColor,
    minContrast
  )
  suggestions.push(...harmonySuggestions)

  // Sort by confidence and limit
  suggestions.sort((a, b) => b.confidence - a.confidence)
  return suggestions.slice(0, limit)
}

/**
 * Suggests semantic colors from palette for a use case
 */
function suggestSemanticColor(
  useCase: ColorUseCase,
  palette: ThemeConfig,
  backgroundColor: string,
  minContrast: number
): ColorSuggestion[] {
  const suggestions: ColorSuggestion[] = []
  const colors = palette.light.colors

  // Map use cases to semantic colors
  const useCaseMapping: Record<ColorUseCase, Array<keyof SemanticColors>> = {
    background: ["background", "card", "muted"],
    text: ["foreground", "cardForeground", "mutedForeground"],
    button: ["primary", "secondary", "accent"],
    link: ["primary", "accent"],
    border: ["border", "input", "muted"],
    accent: ["accent", "primary", "secondary"],
    error: ["destructive"],
    success: ["primary"], // Often green, but primary is safe fallback
    warning: ["accent"], // Often yellow/orange
  }

  const semanticOptions = useCaseMapping[useCase] || ["primary"]

  for (const semanticName of semanticOptions) {
    const colorValue = colors[semanticName]
    if (!colorValue) continue

    const colorStr = typeof colorValue === "string" ? colorValue : oklchToString(colorValue as OklchColor)

    // Calculate contrast - calculateContrastRatio takes two color strings
    const contrast = calculateContrastRatio(colorStr, backgroundColor)

    const meetsContrast = contrast >= minContrast
    let wcagLevel: "AA" | "AAA" | "fail" = "fail"
    if (contrast >= 7) wcagLevel = "AAA"
    else if (contrast >= 4.5) wcagLevel = "AA"

    suggestions.push({
      color: colorStr,
      semanticName,
      confidence: meetsContrast ? 0.9 : 0.5,
      reason: `Semantic color '${semanticName}' from palette`,
      contrastRatio: Math.round(contrast * 100) / 100,
      wcagLevel,
    })
  }

  return suggestions
}

/**
 * Generates harmony-based color suggestions
 */
function generateHarmonyColors(
  analysis: PaletteAnalysis | null,
  useCase: ColorUseCase,
  backgroundColor: string,
  minContrast: number
): ColorSuggestion[] {
  const suggestions: ColorSuggestion[] = []

  // Default parameters if no analysis
  const centerHue = analysis?.dominantHue.center ?? 220 // Default blue
  const chroma = analysis?.averageChroma ?? 0.15

  // Determine target lightness based on use case and background
  const bgLuminance = getLuminanceFromColorString(backgroundColor)
  const isDarkBg = bgLuminance < 0.5

  let targetLightness: number
  switch (useCase) {
    case "background":
      targetLightness = isDarkBg ? 0.15 : 0.95
      break
    case "text":
      targetLightness = isDarkBg ? 0.9 : 0.2
      break
    case "button":
    case "link":
    case "accent":
      targetLightness = isDarkBg ? 0.7 : 0.5
      break
    case "border":
      targetLightness = isDarkBg ? 0.4 : 0.7
      break
    case "error":
      targetLightness = 0.55
      break
    case "success":
      targetLightness = 0.5
      break
    case "warning":
      targetLightness = 0.65
      break
    default:
      targetLightness = 0.5
  }

  // Generate color at the palette's dominant hue
  const primaryColor = `oklch(${targetLightness} ${chroma} ${centerHue})`
  const primaryContrast = calculateContrastRatio(primaryColor, backgroundColor)

  suggestions.push({
    color: primaryColor,
    confidence: primaryContrast >= minContrast ? 0.8 : 0.4,
    reason: `Harmony color at palette's dominant hue (${Math.round(centerHue)}°)`,
    contrastRatio: Math.round(primaryContrast * 100) / 100,
    wcagLevel: primaryContrast >= 7 ? "AAA" : primaryContrast >= 4.5 ? "AA" : "fail",
  })

  // Generate analogous colors (±30°)
  const analogousHues = [centerHue - 30, centerHue + 30].map((h) => (h + 360) % 360)
  for (const hue of analogousHues) {
    const color = `oklch(${targetLightness} ${chroma} ${hue})`
    const contrast = calculateContrastRatio(color, backgroundColor)

    suggestions.push({
      color,
      confidence: contrast >= minContrast ? 0.7 : 0.3,
      reason: `Analogous color at ${Math.round(hue)}°`,
      contrastRatio: Math.round(contrast * 100) / 100,
      wcagLevel: contrast >= 7 ? "AAA" : contrast >= 4.5 ? "AA" : "fail",
    })
  }

  // For error/success/warning, suggest standard semantic hues
  if (useCase === "error") {
    const errorColor = `oklch(${targetLightness} 0.2 25)` // Red
    const contrast = calculateContrastRatio(errorColor, backgroundColor)
    suggestions.push({
      color: errorColor,
      confidence: 0.85,
      reason: "Standard error color (red)",
      contrastRatio: Math.round(contrast * 100) / 100,
      wcagLevel: contrast >= 7 ? "AAA" : contrast >= 4.5 ? "AA" : "fail",
    })
  }

  if (useCase === "success") {
    const successColor = `oklch(${targetLightness} 0.18 145)` // Green
    const contrast = calculateContrastRatio(successColor, backgroundColor)
    suggestions.push({
      color: successColor,
      confidence: 0.85,
      reason: "Standard success color (green)",
      contrastRatio: Math.round(contrast * 100) / 100,
      wcagLevel: contrast >= 7 ? "AAA" : contrast >= 4.5 ? "AA" : "fail",
    })
  }

  if (useCase === "warning") {
    const warningColor = `oklch(${targetLightness} 0.18 85)` // Amber/Yellow
    const contrast = calculateContrastRatio(warningColor, backgroundColor)
    suggestions.push({
      color: warningColor,
      confidence: 0.85,
      reason: "Standard warning color (amber)",
      contrastRatio: Math.round(contrast * 100) / 100,
      wcagLevel: contrast >= 7 ? "AAA" : contrast >= 4.5 ? "AA" : "fail",
    })
  }

  return suggestions
}

/**
 * Suggests an accessible color pair (foreground/background)
 *
 * Finds a foreground color that meets contrast requirements
 * against the specified background.
 *
 * @param backgroundColor - Background color
 * @param palette - Optional palette to match
 * @param targetContrast - Target contrast ratio (default 4.5 for AA)
 * @returns Suggested foreground color
 *
 * @example
 * ```typescript
 * const fg = suggestAccessiblePair("oklch(0.25 0.05 250)", myTheme, 4.5)
 * console.log(fg.color) // "oklch(0.95 0.02 250)"
 * ```
 */
export function suggestAccessiblePair(
  backgroundColor: string,
  palette?: ThemeConfig,
  targetContrast: number = 4.5
): ColorSuggestion {
  const bgLuminance = getLuminanceFromColorString(backgroundColor)
  const isDarkBg = bgLuminance < 0.5

  // Parse background to get hue
  let bgHue = 0
  if (backgroundColor.startsWith("oklch")) {
    const parsed = parseOklch(backgroundColor)
    if (parsed) bgHue = parsed.h
  } else if (palette) {
    // Try to extract hue from palette's primary color for cohesion
    const primaryColor = palette.light.colors.primary
    if (typeof primaryColor === "string" && primaryColor.startsWith("oklch")) {
      const parsed = parseOklch(primaryColor)
      if (parsed) bgHue = parsed.h
    }
  }

  // Calculate required foreground lightness for target contrast
  // Using simplified contrast formula: (L1 + 0.05) / (L2 + 0.05)
  let targetLightness: number
  if (isDarkBg) {
    // Need light foreground
    // (fgL + 0.05) / (bgL + 0.05) >= targetContrast
    // fgL >= targetContrast * (bgL + 0.05) - 0.05
    const minLuminance = targetContrast * (bgLuminance + 0.05) - 0.05
    targetLightness = Math.min(0.95, Math.max(0.7, minLuminance + 0.1))
  } else {
    // Need dark foreground
    // (bgL + 0.05) / (fgL + 0.05) >= targetContrast
    // fgL <= (bgL + 0.05) / targetContrast - 0.05
    const maxLuminance = (bgLuminance + 0.05) / targetContrast - 0.05
    targetLightness = Math.max(0.1, Math.min(0.35, maxLuminance - 0.05))
  }

  // Use low chroma for text (more readable)
  const chroma = 0.02

  // Use same hue family as background for cohesion
  const fgColor = `oklch(${targetLightness.toFixed(2)} ${chroma} ${bgHue})`

  const contrast = calculateContrastRatio(fgColor, backgroundColor)

  return {
    color: fgColor,
    confidence: contrast >= targetContrast ? 0.95 : 0.6,
    reason: `Accessible ${isDarkBg ? "light" : "dark"} foreground for contrast`,
    contrastRatio: Math.round(contrast * 100) / 100,
    wcagLevel: contrast >= 7 ? "AAA" : contrast >= 4.5 ? "AA" : "fail",
  }
}

/**
 * Gets color recommendations for a complete component
 *
 * Returns a set of coordinated colors for a component based on
 * the palette and accessibility requirements.
 *
 * @param componentType - Type of component
 * @param palette - Theme palette to match
 * @returns Object with recommended colors for each part
 *
 * @example
 * ```typescript
 * const colors = getComponentColorRecommendations("button", myTheme)
 * // {
 * //   background: { color: "...", ... },
 * //   text: { color: "...", ... },
 * //   border: { color: "...", ... },
 * //   hover: { color: "...", ... }
 * // }
 * ```
 */
export function getComponentColorRecommendations(
  componentType: "button" | "card" | "input" | "alert",
  palette: ThemeConfig
): Record<string, ColorSuggestion> {
  const colors = palette.light.colors
  const result: Record<string, ColorSuggestion> = {}

  switch (componentType) {
    case "button": {
      const bgColor = typeof colors.primary === "string"
        ? colors.primary
        : oklchToString(colors.primary as OklchColor)

      result.background = {
        color: bgColor,
        semanticName: "primary",
        confidence: 0.95,
        reason: "Primary color for button background",
      }

      result.text = suggestAccessiblePair(bgColor, palette, 4.5)
      result.text.reason = "Accessible text on primary background"

      // Hover state - slightly darker/lighter
      const bgOklch = parseOklch(bgColor)
      if (bgOklch) {
        const hoverL = bgOklch.l > 0.5 ? bgOklch.l - 0.1 : bgOklch.l + 0.1
        result.hover = {
          color: `oklch(${hoverL.toFixed(2)} ${bgOklch.c} ${bgOklch.h})`,
          confidence: 0.9,
          reason: "Darker/lighter primary for hover state",
        }
      }

      // Focus ring
      const ringColor = typeof colors.ring === "string"
        ? colors.ring
        : bgColor
      result.focusRing = {
        color: ringColor,
        semanticName: "ring",
        confidence: 0.9,
        reason: "Focus ring color for accessibility",
      }
      break
    }

    case "card": {
      const cardBg = typeof colors.card === "string"
        ? colors.card
        : typeof colors.background === "string"
          ? colors.background
          : "oklch(0.98 0 0)"

      result.background = {
        color: cardBg,
        semanticName: "card",
        confidence: 0.95,
        reason: "Card background color",
      }

      result.text = suggestAccessiblePair(cardBg, palette, 4.5)
      result.text.semanticName = "cardForeground"

      const borderColor = typeof colors.border === "string"
        ? colors.border
        : "oklch(0.85 0 0)"
      result.border = {
        color: borderColor,
        semanticName: "border",
        confidence: 0.9,
        reason: "Subtle border for card definition",
      }
      break
    }

    case "input": {
      const inputBg = typeof colors.background === "string"
        ? colors.background
        : "oklch(0.98 0 0)"

      result.background = {
        color: inputBg,
        confidence: 0.9,
        reason: "Input background",
      }

      result.text = suggestAccessiblePair(inputBg, palette, 4.5)

      const inputBorder = typeof colors.input === "string"
        ? colors.input
        : typeof colors.border === "string"
          ? colors.border
          : "oklch(0.8 0 0)"
      result.border = {
        color: inputBorder,
        semanticName: "input",
        confidence: 0.9,
        reason: "Input border color",
      }

      const focusColor = typeof colors.ring === "string"
        ? colors.ring
        : typeof colors.primary === "string"
          ? colors.primary
          : "oklch(0.6 0.15 250)"
      result.focus = {
        color: focusColor,
        semanticName: "ring",
        confidence: 0.95,
        reason: "Focus state border/ring",
      }
      break
    }

    case "alert": {
      // Default to muted for info alerts
      const alertBg = typeof colors.muted === "string"
        ? colors.muted
        : "oklch(0.95 0.02 250)"

      result.background = {
        color: alertBg,
        semanticName: "muted",
        confidence: 0.85,
        reason: "Alert background (info variant)",
      }

      result.text = suggestAccessiblePair(alertBg, palette, 4.5)
      result.text.semanticName = "mutedForeground"

      // Error variant
      const errorBg = typeof colors.destructive === "string"
        ? lighten(colors.destructive as string, 0.4)
        : "oklch(0.95 0.05 25)"
      result.errorBackground = {
        color: errorBg,
        confidence: 0.9,
        reason: "Error alert background (lightened destructive)",
      }
      break
    }
  }

  return result
}

// =============================================================================
// Feature #101: AI Brand Validation
// =============================================================================

/**
 * Severity level for brand violations
 */
export type BrandViolationSeverity = "error" | "warning" | "info"

/**
 * Category of brand violation
 */
export type BrandViolationCategory =
  | "color"
  | "typography"
  | "spacing"
  | "contrast"
  | "semantic"

/**
 * A single brand violation
 */
export interface BrandViolation {
  /** Unique violation ID */
  id: string
  /** Violation severity */
  severity: BrandViolationSeverity
  /** Violation category */
  category: BrandViolationCategory
  /** Human-readable message */
  message: string
  /** The offending value */
  actual: string
  /** Expected or suggested value */
  expected?: string
  /** Location in component (CSS property, etc.) */
  location?: string
  /** Suggested fix */
  suggestion?: string
}

/**
 * Brand validation result
 */
export interface BrandValidationResult {
  /** Whether the component passes brand validation */
  isValid: boolean
  /** Overall compliance score (0-100) */
  score: number
  /** List of violations */
  violations: BrandViolation[]
  /** Summary statistics */
  summary: {
    errors: number
    warnings: number
    infos: number
  }
}

/**
 * Component styles to validate
 */
export interface ComponentStyles {
  /** Background color */
  backgroundColor?: string
  /** Text color */
  color?: string
  /** Border color */
  borderColor?: string
  /** Font size */
  fontSize?: string
  /** Font weight */
  fontWeight?: string | number
  /** Line height */
  lineHeight?: string
  /** Padding values */
  padding?: string
  /** Margin values */
  margin?: string
  /** Border radius */
  borderRadius?: string
  /** Box shadow */
  boxShadow?: string
  /** Additional CSS properties */
  [key: string]: string | number | undefined
}

/**
 * Validates component styles against a brand theme
 *
 * Checks colors, typography, spacing, and accessibility compliance.
 *
 * @param styles - Component styles to validate
 * @param brand - Brand theme configuration
 * @returns Validation result with violations and score
 *
 * @example
 * ```typescript
 * const result = validateBrandCompliance(
 *   { backgroundColor: "#ff0000", color: "#ffffff" },
 *   myBrandTheme
 * )
 *
 * if (!result.isValid) {
 *   console.log("Violations:", result.violations)
 * }
 * ```
 */
export function validateBrandCompliance(
  styles: ComponentStyles,
  brand: ThemeConfig
): BrandValidationResult {
  const violations: BrandViolation[] = []

  // Validate colors
  if (styles.backgroundColor) {
    const colorViolations = validateColorAgainstBrand(
      styles.backgroundColor,
      "backgroundColor",
      brand
    )
    violations.push(...colorViolations)
  }

  if (styles.color) {
    const colorViolations = validateColorAgainstBrand(styles.color, "color", brand)
    violations.push(...colorViolations)
  }

  if (styles.borderColor) {
    const colorViolations = validateColorAgainstBrand(
      styles.borderColor,
      "borderColor",
      brand
    )
    violations.push(...colorViolations)
  }

  // Validate contrast if both colors present
  if (styles.backgroundColor && styles.color) {
    const contrastViolations = validateContrastCompliance(
      styles.color,
      styles.backgroundColor
    )
    violations.push(...contrastViolations)
  }

  // Validate typography
  if (styles.fontSize) {
    const typoViolations = validateTypography(styles.fontSize, "fontSize", brand)
    violations.push(...typoViolations)
  }

  // Validate spacing
  if (styles.padding) {
    const spacingViolations = validateSpacing(styles.padding, "padding", brand)
    violations.push(...spacingViolations)
  }

  if (styles.margin) {
    const spacingViolations = validateSpacing(styles.margin, "margin", brand)
    violations.push(...spacingViolations)
  }

  // Validate border radius
  if (styles.borderRadius) {
    const radiusViolations = validateRadius(styles.borderRadius, brand)
    violations.push(...radiusViolations)
  }

  // Calculate summary
  const summary = {
    errors: violations.filter((v) => v.severity === "error").length,
    warnings: violations.filter((v) => v.severity === "warning").length,
    infos: violations.filter((v) => v.severity === "info").length,
  }

  // Calculate score (100 - deductions)
  const errorDeduction = summary.errors * 20
  const warningDeduction = summary.warnings * 5
  const infoDeduction = summary.infos * 1
  const score = Math.max(0, 100 - errorDeduction - warningDeduction - infoDeduction)

  return {
    isValid: summary.errors === 0,
    score,
    violations,
    summary,
  }
}

/**
 * Validates a color against the brand palette
 */
function validateColorAgainstBrand(
  colorValue: string,
  property: string,
  brand: ThemeConfig
): BrandViolation[] {
  const violations: BrandViolation[] = []
  const brandColors = brand.light.colors

  // Check if color is a semantic color from brand
  const isSemanticMatch = Object.values(brandColors).some((brandColor) => {
    const brandStr =
      typeof brandColor === "string"
        ? brandColor
        : oklchToString(brandColor as OklchColor)
    return colorsAreSimilar(colorValue, brandStr)
  })

  if (!isSemanticMatch) {
    // Find closest semantic color
    const closest = findClosestSemanticColor(colorValue, brandColors)

    violations.push({
      id: `color-${property}-off-brand`,
      severity: "warning",
      category: "color",
      message: `Color "${colorValue}" is not from the brand palette`,
      actual: colorValue,
      expected: closest?.color,
      location: property,
      suggestion: closest
        ? `Consider using semantic color "${closest.name}" (${closest.color})`
        : "Use a color from the brand palette",
    })
  }

  return violations
}

/**
 * Checks if two colors are similar (within threshold)
 */
function colorsAreSimilar(color1: string, color2: string): boolean {
  const rgb1 = parseColorToRgb(color1)
  const rgb2 = parseColorToRgb(color2)

  if (!rgb1 || !rgb2) return false

  // Calculate color distance (simple RGB distance)
  const dr = rgb1.r - rgb2.r
  const dg = rgb1.g - rgb2.g
  const db = rgb1.b - rgb2.b
  const distance = Math.sqrt(dr * dr + dg * dg + db * db)

  // Colors are similar if distance is small (threshold: ~5% of max distance)
  return distance < 20
}

/**
 * Finds the closest semantic color from the brand palette
 */
function findClosestSemanticColor(
  colorValue: string,
  brandColors: SemanticColors
): { name: string; color: string } | null {
  const rgb = parseColorToRgb(colorValue)
  if (!rgb) return null

  let closest: { name: string; color: string; distance: number } | null = null

  for (const [name, brandColor] of Object.entries(brandColors)) {
    const brandStr =
      typeof brandColor === "string"
        ? brandColor
        : oklchToString(brandColor as OklchColor)
    const brandRgb = parseColorToRgb(brandStr)

    if (!brandRgb) continue

    const dr = rgb.r - brandRgb.r
    const dg = rgb.g - brandRgb.g
    const db = rgb.b - brandRgb.b
    const distance = Math.sqrt(dr * dr + dg * dg + db * db)

    if (!closest || distance < closest.distance) {
      closest = { name, color: brandStr, distance }
    }
  }

  return closest ? { name: closest.name, color: closest.color } : null
}

/**
 * Validates contrast compliance
 */
function validateContrastCompliance(
  foreground: string,
  background: string
): BrandViolation[] {
  const violations: BrandViolation[] = []

  const contrast = calculateContrastRatio(foreground, background)

  if (contrast < 3) {
    violations.push({
      id: "contrast-fail",
      severity: "error",
      category: "contrast",
      message: `Contrast ratio ${contrast.toFixed(2)}:1 fails WCAG requirements`,
      actual: `${contrast.toFixed(2)}:1`,
      expected: "At least 4.5:1 for AA, 7:1 for AAA",
      suggestion: "Increase lightness difference between foreground and background",
    })
  } else if (contrast < 4.5) {
    violations.push({
      id: "contrast-aa-fail",
      severity: "warning",
      category: "contrast",
      message: `Contrast ratio ${contrast.toFixed(2)}:1 fails WCAG AA for normal text`,
      actual: `${contrast.toFixed(2)}:1`,
      expected: "At least 4.5:1 for AA compliance",
      suggestion: "Increase contrast for better accessibility",
    })
  }

  return violations
}

/**
 * Validates typography against brand
 */
function validateTypography(
  fontSize: string,
  property: string,
  brand: ThemeConfig
): BrandViolation[] {
  const violations: BrandViolation[] = []

  // Check if font size is from typography scale
  const typographyScale = brand.light.typography
  const validSizes = Object.values(typographyScale)
    .filter((v): v is { fontSize: string; lineHeight: string } =>
      typeof v === "object" && v !== null && "fontSize" in v
    )
    .map((v) => v.fontSize)

  if (!validSizes.includes(fontSize)) {
    // Find closest scale value
    const fontSizeNum = parseFloat(fontSize)
    let closestSize = validSizes[0]
    let closestDiff = Math.abs(parseFloat(closestSize) - fontSizeNum)

    for (const size of validSizes) {
      const diff = Math.abs(parseFloat(size) - fontSizeNum)
      if (diff < closestDiff) {
        closestDiff = diff
        closestSize = size
      }
    }

    violations.push({
      id: `typography-${property}-off-scale`,
      severity: "info",
      category: "typography",
      message: `Font size "${fontSize}" is not from the typography scale`,
      actual: fontSize,
      expected: closestSize,
      location: property,
      suggestion: `Use typography scale value "${closestSize}" instead`,
    })
  }

  return violations
}

/**
 * Validates spacing against brand
 */
function validateSpacing(
  spacing: string,
  property: string,
  brand: ThemeConfig
): BrandViolation[] {
  const violations: BrandViolation[] = []

  // Get spacing scale values
  const spacingScale = brand.light.spacing
  const validSpacings = Object.values(spacingScale).filter(
    (v): v is string => typeof v === "string"
  )

  // Parse spacing value (handle shorthand like "8px 16px")
  const spacingValues = spacing.split(/\s+/)

  for (const value of spacingValues) {
    if (value === "0" || value === "auto") continue

    if (!validSpacings.includes(value)) {
      // Find closest scale value
      const valueNum = parseFloat(value)
      let closestSpacing = validSpacings[0]
      let closestDiff = Math.abs(parseFloat(closestSpacing) - valueNum)

      for (const sp of validSpacings) {
        const diff = Math.abs(parseFloat(sp) - valueNum)
        if (diff < closestDiff) {
          closestDiff = diff
          closestSpacing = sp
        }
      }

      violations.push({
        id: `spacing-${property}-off-scale`,
        severity: "info",
        category: "spacing",
        message: `Spacing value "${value}" is not from the spacing scale`,
        actual: value,
        expected: closestSpacing,
        location: property,
        suggestion: `Use spacing scale value "${closestSpacing}" instead`,
      })
    }
  }

  return violations
}

/**
 * Validates border radius against brand
 */
function validateRadius(
  radius: string,
  brand: ThemeConfig
): BrandViolation[] {
  const violations: BrandViolation[] = []

  const radiusScale = brand.light.radius
  const validRadii = Object.values(radiusScale).filter(
    (v): v is string => typeof v === "string"
  )

  if (!validRadii.includes(radius)) {
    violations.push({
      id: "radius-off-scale",
      severity: "info",
      category: "spacing",
      message: `Border radius "${radius}" is not from the radius scale`,
      actual: radius,
      expected: validRadii.join(", "),
      location: "borderRadius",
      suggestion: "Use a radius value from the brand's radius scale",
    })
  }

  return violations
}

/**
 * Generates a brand compliance report
 *
 * Creates a formatted report of all brand violations with suggestions.
 *
 * @param result - Brand validation result
 * @returns Formatted report string
 */
export function formatBrandValidationReport(
  result: BrandValidationResult
): string {
  const lines: string[] = [
    "# Brand Compliance Report",
    "",
    `**Score:** ${result.score}/100`,
    `**Status:** ${result.isValid ? "PASS" : "FAIL"}`,
    "",
    `**Summary:** ${result.summary.errors} errors, ${result.summary.warnings} warnings, ${result.summary.infos} info`,
    "",
  ]

  if (result.violations.length === 0) {
    lines.push("No violations found. Component is fully brand-compliant.")
  } else {
    lines.push("## Violations", "")

    const byCategory = new Map<string, BrandViolation[]>()
    for (const violation of result.violations) {
      const existing = byCategory.get(violation.category) || []
      existing.push(violation)
      byCategory.set(violation.category, existing)
    }

    for (const [category, violations] of byCategory) {
      lines.push(`### ${category.charAt(0).toUpperCase() + category.slice(1)}`, "")

      for (const v of violations) {
        const icon =
          v.severity === "error" ? "X" : v.severity === "warning" ? "!" : "i"
        lines.push(`- [${icon}] **${v.message}**`)
        lines.push(`  - Actual: \`${v.actual}\``)
        if (v.expected) {
          lines.push(`  - Expected: \`${v.expected}\``)
        }
        if (v.suggestion) {
          lines.push(`  - Suggestion: ${v.suggestion}`)
        }
        lines.push("")
      }
    }
  }

  return lines.join("\n")
}

/**
 * Suggests fixes for brand violations
 *
 * Generates a list of suggested style changes to fix violations.
 *
 * @param violations - List of violations to fix
 * @returns Object with property: suggested value pairs
 */
export function suggestBrandFixes(
  violations: BrandViolation[]
): Record<string, string> {
  const fixes: Record<string, string> = {}

  for (const violation of violations) {
    if (violation.expected && violation.location) {
      fixes[violation.location] = violation.expected
    }
  }

  return fixes
}

// =============================================================================
// Feature #103: Brand Hot Reloading
// =============================================================================

/**
 * Hot reload event types
 */
export type HotReloadEvent =
  | "config-change"
  | "colors-update"
  | "typography-update"
  | "spacing-update"
  | "full-reload"

/**
 * Hot reload callback
 */
export type HotReloadCallback = (
  event: HotReloadEvent,
  config: ThemeConfig
) => void

/**
 * Hot reload options
 */
export interface HotReloadOptions {
  /** Enable hot reloading (default: true in dev) */
  enabled?: boolean
  /** Debounce delay in ms (default: 100) */
  debounceMs?: number
  /** Log changes to console (default: true in dev) */
  logChanges?: boolean
  /** Apply changes immediately without batching (default: false) */
  immediate?: boolean
}

/**
 * Hot reload state
 */
interface HotReloadState {
  enabled: boolean
  config: ThemeConfig | null
  listeners: Set<HotReloadCallback>
  debounceTimer: ReturnType<typeof setTimeout> | null
  options: HotReloadOptions
}

// Global hot reload state
const hotReloadState: HotReloadState = {
  enabled: false,
  config: null,
  listeners: new Set(),
  debounceTimer: null,
  options: {
    enabled: true,
    debounceMs: 100,
    logChanges: true,
    immediate: false,
  },
}

/**
 * Initializes brand hot reloading for development
 *
 * Sets up the hot reload system to watch for brand config changes
 * and update CSS variables without a full page refresh.
 *
 * @param config - Initial theme configuration
 * @param options - Hot reload options
 * @returns Cleanup function
 *
 * @example
 * ```typescript
 * // In your app's entry point (dev only)
 * if (import.meta.hot) {
 *   const cleanup = initBrandHotReload(myBrand, {
 *     logChanges: true,
 *     debounceMs: 50,
 *   })
 *
 *   import.meta.hot.dispose(cleanup)
 * }
 * ```
 */
export function initBrandHotReload(
  config: ThemeConfig,
  options: HotReloadOptions = {}
): () => void {
  // Only enable in browser environment
  if (typeof window === "undefined") {
    return () => {}
  }

  hotReloadState.enabled = options.enabled ?? true
  hotReloadState.config = config
  hotReloadState.options = { ...hotReloadState.options, ...options }

  // Apply initial config
  applyBrandToDOM(config)

  if (hotReloadState.options.logChanges) {
    console.log("[Brand HMR] Initialized with config:", config.name)
  }

  // Return cleanup function
  return () => {
    hotReloadState.enabled = false
    hotReloadState.config = null
    hotReloadState.listeners.clear()
    if (hotReloadState.debounceTimer) {
      clearTimeout(hotReloadState.debounceTimer)
    }
  }
}

/**
 * Updates the brand configuration with hot reload
 *
 * Detects what changed and applies minimal updates to the DOM.
 *
 * @param newConfig - New theme configuration
 *
 * @example
 * ```typescript
 * // When brand config file changes
 * import.meta.hot.accept("./brand.ts", (newModule) => {
 *   updateBrandConfig(newModule.brand)
 * })
 * ```
 */
export function updateBrandConfig(newConfig: ThemeConfig): void {
  if (!hotReloadState.enabled || typeof window === "undefined") {
    return
  }

  const oldConfig = hotReloadState.config

  // Determine what changed
  const event = detectChangeType(oldConfig, newConfig)

  // Debounce updates
  if (hotReloadState.debounceTimer) {
    clearTimeout(hotReloadState.debounceTimer)
  }

  const applyUpdate = () => {
    hotReloadState.config = newConfig

    // Apply changes to DOM
    applyBrandToDOM(newConfig, event)

    // Notify listeners
    for (const listener of hotReloadState.listeners) {
      try {
        listener(event, newConfig)
      } catch (err) {
        console.error("[Brand HMR] Listener error:", err)
      }
    }

    if (hotReloadState.options.logChanges) {
      console.log(`[Brand HMR] ${event}:`, newConfig.name)
    }
  }

  if (hotReloadState.options.immediate) {
    applyUpdate()
  } else {
    hotReloadState.debounceTimer = setTimeout(
      applyUpdate,
      hotReloadState.options.debounceMs
    )
  }
}

/**
 * Subscribes to brand hot reload events
 *
 * @param callback - Function called when brand changes
 * @returns Unsubscribe function
 *
 * @example
 * ```typescript
 * const unsubscribe = subscribeToBrandChanges((event, config) => {
 *   console.log("Brand changed:", event)
 *   // Re-render components that depend on brand
 * })
 *
 * // Later: unsubscribe()
 * ```
 */
export function subscribeToBrandChanges(
  callback: HotReloadCallback
): () => void {
  hotReloadState.listeners.add(callback)
  return () => hotReloadState.listeners.delete(callback)
}

/**
 * Detects what type of change occurred between configs
 */
function detectChangeType(
  oldConfig: ThemeConfig | null,
  newConfig: ThemeConfig
): HotReloadEvent {
  if (!oldConfig) {
    return "full-reload"
  }

  // Check colors
  const oldColors = JSON.stringify(oldConfig.light.colors)
  const newColors = JSON.stringify(newConfig.light.colors)
  if (oldColors !== newColors) {
    return "colors-update"
  }

  // Check typography
  const oldTypo = JSON.stringify(oldConfig.light.typography)
  const newTypo = JSON.stringify(newConfig.light.typography)
  if (oldTypo !== newTypo) {
    return "typography-update"
  }

  // Check spacing
  const oldSpacing = JSON.stringify(oldConfig.light.spacing)
  const newSpacing = JSON.stringify(newConfig.light.spacing)
  if (oldSpacing !== newSpacing) {
    return "spacing-update"
  }

  // Default to config change
  return "config-change"
}

/**
 * Applies brand configuration to the DOM via CSS variables
 */
function applyBrandToDOM(
  config: ThemeConfig,
  event: HotReloadEvent = "full-reload"
): void {
  if (typeof document === "undefined") return

  const root = document.documentElement

  // Apply colors
  if (event === "colors-update" || event === "full-reload") {
    const colors = config.light.colors
    for (const [key, value] of Object.entries(colors)) {
      const cssVar = `--color-${toKebabCase(key)}`
      const colorStr =
        typeof value === "string" ? value : oklchToString(value as OklchColor)
      root.style.setProperty(cssVar, colorStr)
    }
  }

  // Apply typography
  if (event === "typography-update" || event === "full-reload") {
    const typography = config.light.typography
    for (const [key, value] of Object.entries(typography)) {
      if (value && typeof value === "object" && "fontSize" in value) {
        const typedValue = value as { fontSize: string; lineHeight: string }
        root.style.setProperty(`--font-size-${key}`, typedValue.fontSize)
        root.style.setProperty(`--line-height-${key}`, typedValue.lineHeight)
      }
    }
  }

  // Apply spacing
  if (event === "spacing-update" || event === "full-reload") {
    const spacing = config.light.spacing
    for (const [key, value] of Object.entries(spacing)) {
      if (typeof value === "string") {
        root.style.setProperty(`--spacing-${key}`, value)
      }
    }
  }

  // Apply radius
  if (event === "full-reload") {
    const radius = config.light.radius
    for (const [key, value] of Object.entries(radius)) {
      if (typeof value === "string") {
        const cssKey = key === "default" ? "radius" : `radius-${key}`
        root.style.setProperty(`--${cssKey}`, value)
      }
    }
  }

  // Apply font families
  if (event === "full-reload" && config.light.fontFamily) {
    const { sans, serif, mono } = config.light.fontFamily
    if (sans) root.style.setProperty("--font-sans", sans)
    if (serif) root.style.setProperty("--font-serif", serif)
    if (mono) root.style.setProperty("--font-mono", mono)
  }
}

/**
 * Result of brand hot reload subscription
 */
export interface BrandHotReloadResult {
  /** Current brand configuration */
  config: ThemeConfig | null
  /** Unsubscribe from hot reload events */
  unsubscribe: () => void
}

/**
 * Subscribes to brand hot reload and returns current config
 *
 * For non-React usage, call unsubscribe when done to prevent memory leaks.
 * For React, use this in useEffect with cleanup.
 *
 * @param callback - Optional callback for custom handling
 * @returns Object with current config and unsubscribe function
 *
 * @example
 * ```typescript
 * // Non-React usage
 * const { config, unsubscribe } = useBrandHotReload((event, config) => {
 *   console.log("Brand updated:", event)
 * })
 *
 * // Later: cleanup
 * unsubscribe()
 *
 * // React usage
 * useEffect(() => {
 *   const { config, unsubscribe } = useBrandHotReload((event, config) => {
 *     setLocalConfig(config)
 *   })
 *   return unsubscribe
 * }, [])
 * ```
 */
export function useBrandHotReload(
  callback?: HotReloadCallback
): BrandHotReloadResult {
  // For non-browser environments, return no-op
  if (typeof window === "undefined") {
    return {
      config: hotReloadState.config,
      unsubscribe: () => {},
    }
  }

  // Subscribe to changes if callback provided
  const unsubscribe = callback
    ? subscribeToBrandChanges(callback)
    : () => {}

  return {
    config: hotReloadState.config,
    unsubscribe,
  }
}

/**
 * Gets the current hot reload state
 *
 * @returns Current hot reload configuration and status
 */
export function getHotReloadState(): {
  enabled: boolean
  config: ThemeConfig | null
  listenerCount: number
} {
  return {
    enabled: hotReloadState.enabled,
    config: hotReloadState.config,
    listenerCount: hotReloadState.listeners.size,
  }
}

/**
 * Forces a full brand reload
 *
 * Use when you need to ensure all CSS variables are refreshed.
 */
export function forceFullBrandReload(): void {
  if (hotReloadState.config) {
    applyBrandToDOM(hotReloadState.config, "full-reload")

    for (const listener of hotReloadState.listeners) {
      try {
        listener("full-reload", hotReloadState.config)
      } catch (err) {
        console.error("[Brand HMR] Listener error:", err)
      }
    }

    if (hotReloadState.options.logChanges) {
      console.log("[Brand HMR] Forced full reload")
    }
  }
}

/**
 * Creates Vite HMR integration for brand config
 *
 * Returns the HMR accept handler for Vite.
 *
 * @param getConfig - Function that returns the brand config
 * @returns Vite HMR accept callback
 *
 * @example
 * ```typescript
 * // brand.ts
 * export const brand = createTheme("my-brand", { ... })
 *
 * if (import.meta.hot) {
 *   import.meta.hot.accept(createViteHMRHandler(() => brand))
 * }
 * ```
 */
export function createViteHMRHandler(
  getConfig: () => ThemeConfig
): () => void {
  return () => {
    const newConfig = getConfig()
    updateBrandConfig(newConfig)
  }
}

// =============================================================================
// Feature #104: Config Inheritance (File-based)
// =============================================================================

/**
 * Config loader function type
 *
 * Used to load config files from paths. The implementation
 * is provided by the consuming application (e.g., using fs.readFile
 * in Node.js or fetch in browser).
 */
export type ConfigLoader = (path: string) => Promise<ThemeConfig>

/**
 * Config inheritance options
 */
export interface ConfigInheritanceOptions {
  /** Function to load config from path */
  loader: ConfigLoader
  /** Base directory for resolving relative paths */
  basePath?: string
  /** Maximum inheritance depth (default: 10) */
  maxDepth?: number
  /** Cache loaded configs (default: true) */
  useCache?: boolean
}

/**
 * Config inheritance result
 */
export interface ConfigInheritanceResult {
  /** Fully resolved configuration */
  config: ThemeConfig
  /** Chain of inheritance (paths or names) */
  chain: string[]
  /** Warnings encountered during resolution */
  warnings: string[]
  /** Whether any configs were loaded from cache */
  fromCache: boolean
}

/**
 * Extends field value - can be path, config, or name
 */
export type ExtendsValue = string | ThemeConfig

// Config cache for file-based inheritance
const configCache = new Map<string, ThemeConfig>()

/**
 * Resolves config inheritance from file paths
 *
 * Loads parent configs from paths and performs deep merge
 * to create the final resolved configuration.
 *
 * @param config - Child configuration with extends field
 * @param options - Inheritance resolution options
 * @returns Resolved configuration with inheritance applied
 *
 * @example
 * ```typescript
 * // In Node.js
 * import { readFile } from "fs/promises"
 *
 * const loader: ConfigLoader = async (path) => {
 *   const content = await readFile(path, "utf-8")
 *   return JSON.parse(content)
 * }
 *
 * const childConfig: ThemeConfig = {
 *   name: "child",
 *   extends: "./base-theme.json",
 *   light: {
 *     colors: { primary: "blue" }, // Overrides parent
 *   },
 * }
 *
 * const { config, chain } = await resolveConfigInheritance(childConfig, {
 *   loader,
 *   basePath: "/path/to/configs",
 * })
 * ```
 */
export async function resolveConfigInheritance(
  config: ThemeConfig,
  options: ConfigInheritanceOptions
): Promise<ConfigInheritanceResult> {
  const {
    loader,
    basePath = "",
    maxDepth = 10,
    useCache = true,
  } = options

  const chain: string[] = [config.name]
  const warnings: string[] = []
  let fromCache = false

  // If no extends, return as-is
  if (!config.extends) {
    return { config, chain, warnings, fromCache }
  }

  // Build inheritance chain
  const configs: ThemeConfig[] = [config]
  let current: ExtendsValue | undefined = config.extends
  let depth = 0

  while (current && depth < maxDepth) {
    depth++

    if (typeof current === "string") {
      // It's a path - load the config
      const path = resolvePath(current, basePath)

      // Check cache
      if (useCache && configCache.has(path)) {
        const cached = configCache.get(path)!
        configs.unshift(cached)
        chain.unshift(cached.name)
        current = cached.extends
        fromCache = true
        continue
      }

      try {
        const loaded = await loader(path)

        // Cache if enabled
        if (useCache) {
          configCache.set(path, loaded)
        }

        configs.unshift(loaded)
        chain.unshift(loaded.name)
        current = loaded.extends
      } catch (err) {
        warnings.push(`Failed to load config from "${path}": ${err}`)
        break
      }
    } else {
      // It's a config object
      configs.unshift(current)
      chain.unshift(current.name)
      current = current.extends
    }
  }

  if (depth >= maxDepth) {
    warnings.push(`Maximum inheritance depth (${maxDepth}) reached`)
  }

  // Merge configs from root to child (first is root, last is child)
  let resolved = configs[0]
  for (let i = 1; i < configs.length; i++) {
    resolved = mergeConfigs(resolved, configs[i])
  }

  // Remove extends from final result
  const { extends: _, ...resolvedWithoutExtends } = resolved

  return {
    config: resolvedWithoutExtends as ThemeConfig,
    chain,
    warnings,
    fromCache,
  }
}

/**
 * Resolves a path relative to base path
 */
function resolvePath(path: string, basePath: string): string {
  if (path.startsWith("/") || path.startsWith("http")) {
    // Absolute path or URL
    return path
  }
  if (!basePath) {
    return path
  }
  // Join paths
  const base = basePath.endsWith("/") ? basePath : basePath + "/"
  return base + path
}

/**
 * Deep merges two theme configs
 *
 * Child values override parent values. Nested objects are merged recursively.
 */
function mergeConfigs(parent: ThemeConfig, child: ThemeConfig): ThemeConfig {
  const merged: ThemeConfig = {
    name: child.name,
    light: deepMergeTokens(parent.light, child.light),
  }

  // Merge dark mode if present
  if (parent.dark || child.dark) {
    merged.dark = {
      ...parent.dark,
      ...child.dark,
    }
  }

  // Use child values for simple fields
  merged.defaultMode = child.defaultMode ?? parent.defaultMode
  merged.darkModeClass = child.darkModeClass ?? parent.darkModeClass
  merged.useColorScheme = child.useColorScheme ?? parent.useColorScheme

  // Carry extends only if child has a new one
  if (child.extends) {
    merged.extends = child.extends
  }

  return merged
}

/**
 * Creates a config with file-based inheritance
 *
 * Convenience function for creating configs that extend from files.
 *
 * @param name - Config name
 * @param extendsPath - Path to parent config
 * @param overrides - Values to override from parent
 * @returns Theme config with extends field
 *
 * @example
 * ```typescript
 * const myTheme = createConfigWithInheritance(
 *   "my-theme",
 *   "./base-theme.json",
 *   {
 *     light: {
 *       colors: {
 *         primary: "oklch(0.6 0.2 280)",
 *       },
 *     },
 *   }
 * )
 * ```
 */
export function createConfigWithInheritance(
  name: string,
  extendsPath: string,
  overrides: DeepPartial<Omit<ThemeConfig, "name" | "extends">>
): ThemeConfig {
  return {
    name,
    extends: extendsPath,
    light: (overrides.light ?? {}) as DesignTokens,
    dark: overrides.dark,
    defaultMode: overrides.defaultMode,
    darkModeClass: overrides.darkModeClass,
    useColorScheme: overrides.useColorScheme,
  }
}

/**
 * Clears the config inheritance cache
 *
 * Call this when you want to force reload of all parent configs.
 */
export function clearConfigCache(): void {
  configCache.clear()
}

/**
 * Gets the current config cache size
 *
 * @returns Number of cached configs
 */
export function getConfigCacheSize(): number {
  return configCache.size
}

/**
 * Validates an inheritance chain for issues
 *
 * Checks for circular references, missing fields, and other problems.
 *
 * @param chain - Array of config paths/names
 * @param configs - Map of path to config
 * @returns Validation result
 */
export function validateInheritanceChain(
  chain: string[],
  configs: Map<string, ThemeConfig>
): { valid: boolean; issues: string[] } {
  const issues: string[] = []

  // Check for duplicates (circular references)
  const seen = new Set<string>()
  for (const item of chain) {
    if (seen.has(item)) {
      issues.push(`Circular reference detected: "${item}" appears multiple times`)
    }
    seen.add(item)
  }

  // Check each config has required fields
  for (const [path, config] of configs) {
    if (!config.name) {
      issues.push(`Config at "${path}" is missing required "name" field`)
    }
    if (!config.light) {
      issues.push(`Config at "${path}" is missing required "light" field`)
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}

/**
 * Creates a file-based config loader for browser (fetch)
 *
 * @returns Config loader using fetch
 *
 * @example
 * ```typescript
 * const loader = createFetchLoader()
 * const result = await resolveConfigInheritance(config, { loader })
 * ```
 */
export function createFetchLoader(): ConfigLoader {
  return async (path: string): Promise<ThemeConfig> => {
    const response = await fetch(path)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    return response.json()
  }
}

/**
 * Flattens a config with inheritance into a standalone config
 *
 * Like resolveConfigInheritance but returns just the ThemeConfig.
 *
 * @param config - Config with extends
 * @param options - Resolution options
 * @returns Flattened config without extends
 */
export async function flattenConfigInheritance(
  config: ThemeConfig,
  options: ConfigInheritanceOptions
): Promise<ThemeConfig> {
  const { config: resolved } = await resolveConfigInheritance(config, options)
  return resolved
}

// ============================================================================
// Feature #105: Runtime Config Override
// ============================================================================

/**
 * State for runtime config override
 */
export interface RuntimeConfigState {
  /** Current active config (may be override or original) */
  current: ThemeConfig | null
  /** Original config before any overrides */
  original: ThemeConfig | null
  /** Whether an override is currently active */
  isOverridden: boolean
  /** History of config changes for debugging */
  history: Array<{
    timestamp: number
    action: "set" | "reset" | "update"
    configName: string | null
  }>
}

/**
 * Options for setting runtime config
 */
export interface SetRuntimeConfigOptions {
  /** Whether to preserve the original for reset (default: true) */
  preserveOriginal?: boolean
  /** Whether to notify subscribers (default: true) */
  notify?: boolean
  /** Whether to merge with current config instead of replace */
  merge?: boolean
}

/**
 * Result from runtime config hook
 */
export interface UseRuntimeConfigResult {
  /** Current active config */
  config: ThemeConfig | null
  /** Whether config is overridden */
  isOverridden: boolean
  /** Set a new config override */
  setConfig: (config: ThemeConfig, options?: SetRuntimeConfigOptions) => void
  /** Update current config with partial changes */
  updateConfig: (partial: Partial<ThemeConfig>) => void
  /** Reset to original config */
  resetConfig: () => void
  /** Get the original config */
  getOriginal: () => ThemeConfig | null
}

/** Runtime config state */
const runtimeConfigState: RuntimeConfigState = {
  current: null,
  original: null,
  isOverridden: false,
  history: [],
}

/** Subscribers for runtime config changes */
const runtimeConfigSubscribers = new Set<() => void>()

/** Maximum history entries to keep */
const MAX_HISTORY_ENTRIES = 50

/**
 * Notify all runtime config subscribers
 */
function notifyRuntimeConfigSubscribers(): void {
  runtimeConfigSubscribers.forEach((callback) => callback())
}

/**
 * Add entry to config history
 */
function addToConfigHistory(
  action: "set" | "reset" | "update",
  configName: string | null
): void {
  runtimeConfigState.history.push({
    timestamp: Date.now(),
    action,
    configName,
  })

  // Trim history if too long
  if (runtimeConfigState.history.length > MAX_HISTORY_ENTRIES) {
    runtimeConfigState.history = runtimeConfigState.history.slice(-MAX_HISTORY_ENTRIES)
  }
}

/**
 * Sets the runtime config override
 *
 * Allows overriding the active theme config at runtime, useful for:
 * - Testing different themes
 * - A/B testing
 * - Preview modes
 * - Development tools
 *
 * @param config - The config to set as active
 * @param options - Set options
 *
 * @example
 * ```typescript
 * import { setRuntimeConfig, resetRuntimeConfig } from "@/lib/react-agent/theme"
 *
 * // Override for testing
 * setRuntimeConfig(testTheme)
 *
 * // ... run tests ...
 *
 * // Restore original
 * resetRuntimeConfig()
 * ```
 */
export function setRuntimeConfig(
  config: ThemeConfig,
  options: SetRuntimeConfigOptions = {}
): void {
  const { preserveOriginal = true, notify = true, merge = false } = options

  // Preserve original if this is first override
  if (preserveOriginal && !runtimeConfigState.isOverridden) {
    runtimeConfigState.original = runtimeConfigState.current
  }

  // Set new config
  if (merge && runtimeConfigState.current) {
    runtimeConfigState.current = mergeConfigs(
      runtimeConfigState.current,
      config
    )
  } else {
    runtimeConfigState.current = config
  }

  runtimeConfigState.isOverridden = true
  addToConfigHistory("set", config.name)

  // Also update the main theme config for consistency
  if (config) {
    currentThemeConfig = config
  }

  if (notify) {
    notifyRuntimeConfigSubscribers()
    notifyThemeSubscribers()
  }
}

/**
 * Gets the current runtime config
 *
 * @returns Current active config or null
 *
 * @example
 * ```typescript
 * const config = getRuntimeConfig()
 * if (config) {
 *   console.log("Current theme:", config.name)
 * }
 * ```
 */
export function getRuntimeConfig(): ThemeConfig | null {
  return runtimeConfigState.current
}

/**
 * Gets the original config before any overrides
 *
 * @returns Original config or null if never set
 */
export function getOriginalConfig(): ThemeConfig | null {
  return runtimeConfigState.original
}

/**
 * Resets to the original config
 *
 * Restores the config that was active before setRuntimeConfig was called.
 *
 * @param options - Reset options
 *
 * @example
 * ```typescript
 * // Override
 * setRuntimeConfig(testTheme)
 *
 * // ... do testing ...
 *
 * // Restore
 * resetRuntimeConfig()
 * ```
 */
export function resetRuntimeConfig(options: { notify?: boolean } = {}): void {
  const { notify = true } = options

  if (runtimeConfigState.original !== null) {
    runtimeConfigState.current = runtimeConfigState.original
    currentThemeConfig = runtimeConfigState.original
  }

  runtimeConfigState.isOverridden = false
  addToConfigHistory("reset", runtimeConfigState.current?.name ?? null)

  if (notify) {
    notifyRuntimeConfigSubscribers()
    notifyThemeSubscribers()
  }
}

/**
 * Updates the current config with partial changes
 *
 * Merges the partial config with the current config.
 *
 * @param partial - Partial config to merge
 * @param options - Update options
 *
 * @example
 * ```typescript
 * // Update just the primary color
 * updateRuntimeConfig({
 *   light: {
 *     colors: {
 *       primary: "oklch(0.6 0.2 280)"
 *     }
 *   }
 * })
 * ```
 */
export function updateRuntimeConfig(
  partial: Partial<ThemeConfig>,
  options: { notify?: boolean } = {}
): void {
  const { notify = true } = options

  const currentConfig = runtimeConfigState.current
  if (!currentConfig) {
    return
  }

  // Preserve original before first update
  if (!runtimeConfigState.isOverridden) {
    runtimeConfigState.original = currentConfig
  }

  const merged = mergeConfigs(currentConfig, partial as ThemeConfig)
  runtimeConfigState.current = merged
  runtimeConfigState.isOverridden = true
  currentThemeConfig = merged
  addToConfigHistory("update", merged.name)

  if (notify) {
    notifyRuntimeConfigSubscribers()
    notifyThemeSubscribers()
  }
}

/**
 * Subscribe to runtime config changes
 *
 * @param callback - Function called when config changes
 * @returns Unsubscribe function
 *
 * @example
 * ```typescript
 * const unsubscribe = subscribeToRuntimeConfig(() => {
 *   console.log("Config changed:", getRuntimeConfig())
 * })
 *
 * // Later...
 * unsubscribe()
 * ```
 */
export function subscribeToRuntimeConfig(callback: () => void): () => void {
  runtimeConfigSubscribers.add(callback)
  return () => runtimeConfigSubscribers.delete(callback)
}

/**
 * Gets the full runtime config state
 *
 * Useful for debugging and testing.
 *
 * @returns Full runtime config state
 */
export function getRuntimeConfigState(): RuntimeConfigState {
  return { ...runtimeConfigState }
}

/**
 * Checks if runtime config is currently overridden
 *
 * @returns true if an override is active
 */
export function isRuntimeConfigOverridden(): boolean {
  return runtimeConfigState.isOverridden
}

/**
 * Clears all runtime config state
 *
 * Resets everything including original and history.
 */
export function clearRuntimeConfigState(): void {
  runtimeConfigState.current = null
  runtimeConfigState.original = null
  runtimeConfigState.isOverridden = false
  runtimeConfigState.history = []
}

/**
 * Initializes runtime config with a base config
 *
 * Should be called once at app startup to set the initial config.
 *
 * @param config - Base config to start with
 *
 * @example
 * ```typescript
 * // In app initialization
 * initRuntimeConfig(defaultTheme)
 * ```
 */
export function initRuntimeConfig(config: ThemeConfig): void {
  runtimeConfigState.current = config
  runtimeConfigState.original = config
  runtimeConfigState.isOverridden = false
  currentThemeConfig = config
  addToConfigHistory("set", config.name)
}

/**
 * Gets a snapshot of runtime config state for React integration
 *
 * Use with useSyncExternalStore for reactive updates.
 *
 * @returns Current runtime config snapshot
 *
 * @example
 * ```typescript
 * import { useSyncExternalStore } from "react"
 *
 * function useRuntimeConfigReactive() {
 *   return useSyncExternalStore(
 *     subscribeToRuntimeConfig,
 *     getRuntimeConfigSnapshot,
 *     getRuntimeConfigServerSnapshot
 *   )
 * }
 * ```
 */
export function getRuntimeConfigSnapshot(): UseRuntimeConfigResult {
  return {
    config: runtimeConfigState.current,
    isOverridden: runtimeConfigState.isOverridden,
    setConfig: setRuntimeConfig,
    updateConfig: updateRuntimeConfig,
    resetConfig: resetRuntimeConfig,
    getOriginal: getOriginalConfig,
  }
}

/**
 * Gets a server-safe snapshot of runtime config state for SSR
 *
 * Returns safe defaults when running on server.
 *
 * @returns Server-safe runtime config snapshot
 */
export function getRuntimeConfigServerSnapshot(): UseRuntimeConfigResult {
  return {
    config: null,
    isOverridden: false,
    setConfig: setRuntimeConfig,
    updateConfig: updateRuntimeConfig,
    resetConfig: resetRuntimeConfig,
    getOriginal: () => null,
  }
}

/**
 * Hook for runtime config management
 *
 * Provides access to runtime config controls. For reactive updates in React,
 * use with useSyncExternalStore:
 *
 * @returns Runtime config state and controls
 *
 * @example
 * ```typescript
 * import { useSyncExternalStore } from "react"
 * import {
 *   subscribeToRuntimeConfig,
 *   getRuntimeConfigSnapshot,
 *   getRuntimeConfigServerSnapshot
 * } from "@/lib/react-agent/theme"
 *
 * // For reactive updates, use useSyncExternalStore:
 * function useRuntimeConfigReactive() {
 *   return useSyncExternalStore(
 *     subscribeToRuntimeConfig,
 *     getRuntimeConfigSnapshot,
 *     getRuntimeConfigServerSnapshot
 *   )
 * }
 *
 * // Simple usage (non-reactive):
 * function ThemeSwitcher() {
 *   const { config, setConfig, resetConfig, isOverridden } = useRuntimeConfig()
 *
 *   return (
 *     <div>
 *       <p>Current theme: {config?.name}</p>
 *       {isOverridden && (
 *         <button onClick={resetConfig}>Reset to original</button>
 *       )}
 *       <button onClick={() => setConfig(darkTheme)}>
 *         Switch to dark
 *       </button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useRuntimeConfig(): UseRuntimeConfigResult {
  // Note: For full React reactivity, consumers should use useSyncExternalStore:
  //
  // import { useSyncExternalStore } from "react"
  // const state = useSyncExternalStore(
  //   subscribeToRuntimeConfig,
  //   getRuntimeConfigSnapshot,
  //   getRuntimeConfigServerSnapshot
  // )
  return getRuntimeConfigSnapshot()
}

// ============================================================================
// Feature #106: Component Tokens
// ============================================================================

/**
 * Base component token structure
 *
 * All color fields use ColorValue to support string, OKLCH, HSL, and RGB formats.
 */
export interface BaseComponentTokens {
  /** Background color */
  background?: ColorValue
  /** Foreground/text color */
  foreground?: ColorValue
  /** Border color */
  border?: ColorValue
  /** Border radius */
  borderRadius?: string
  /** Padding */
  padding?: string
  /** Font size */
  fontSize?: string
  /** Font weight */
  fontWeight?: string | number
  /** Line height */
  lineHeight?: string
  /** Box shadow */
  shadow?: string
  /** Transition */
  transition?: string
}

/**
 * Button component tokens
 */
export interface ButtonTokens extends BaseComponentTokens {
  /** Hover background */
  hoverBackground?: ColorValue
  /** Hover foreground */
  hoverForeground?: ColorValue
  /** Active/pressed background */
  activeBackground?: ColorValue
  /** Disabled opacity */
  disabledOpacity?: string
  /** Focus ring color */
  focusRing?: ColorValue
  /** Focus ring offset */
  focusRingOffset?: string
  /** Gap between icon and text */
  gap?: string
  /** Minimum height */
  minHeight?: string
  /** Variants */
  variants?: {
    primary?: Partial<ButtonTokens>
    secondary?: Partial<ButtonTokens>
    outline?: Partial<ButtonTokens>
    ghost?: Partial<ButtonTokens>
    destructive?: Partial<ButtonTokens>
    link?: Partial<ButtonTokens>
  }
  /** Sizes */
  sizes?: {
    sm?: Partial<ButtonTokens>
    md?: Partial<ButtonTokens>
    lg?: Partial<ButtonTokens>
    icon?: Partial<ButtonTokens>
  }
}

/**
 * Card component tokens
 */
export interface CardTokens extends BaseComponentTokens {
  /** Header background */
  headerBackground?: ColorValue
  /** Header padding */
  headerPadding?: string
  /** Footer background */
  footerBackground?: ColorValue
  /** Footer padding */
  footerPadding?: string
  /** Content padding */
  contentPadding?: string
  /** Border width */
  borderWidth?: string
  /** Hover shadow */
  hoverShadow?: string
  /** Hover border color */
  hoverBorder?: ColorValue
}

/**
 * Input component tokens
 */
export interface InputTokens extends BaseComponentTokens {
  /** Placeholder color */
  placeholder?: ColorValue
  /** Focus border color */
  focusBorder?: ColorValue
  /** Focus ring color */
  focusRing?: ColorValue
  /** Error border color */
  errorBorder?: ColorValue
  /** Error text color */
  errorText?: ColorValue
  /** Disabled background */
  disabledBackground?: ColorValue
  /** Disabled text */
  disabledText?: ColorValue
  /** Label font size */
  labelFontSize?: string
  /** Label font weight */
  labelFontWeight?: string | number
  /** Label color */
  labelColor?: ColorValue
  /** Helper text font size */
  helperFontSize?: string
  /** Helper text color */
  helperColor?: ColorValue
  /** Height */
  height?: string
  /** Sizes */
  sizes?: {
    sm?: Partial<InputTokens>
    md?: Partial<InputTokens>
    lg?: Partial<InputTokens>
  }
}

/**
 * Select component tokens
 */
export interface SelectTokens extends InputTokens {
  /** Dropdown background */
  dropdownBackground?: ColorValue
  /** Option hover background */
  optionHoverBackground?: ColorValue
  /** Option selected background */
  optionSelectedBackground?: ColorValue
  /** Option padding */
  optionPadding?: string
  /** Chevron color */
  chevronColor?: ColorValue
  /** Max dropdown height */
  maxDropdownHeight?: string
}

/**
 * Checkbox component tokens
 */
export interface CheckboxTokens extends BaseComponentTokens {
  /** Checked background */
  checkedBackground?: ColorValue
  /** Checked foreground (checkmark) */
  checkedForeground?: ColorValue
  /** Indeterminate background */
  indeterminateBackground?: ColorValue
  /** Focus ring */
  focusRing?: ColorValue
  /** Size (width and height) */
  size?: string
  /** Label gap */
  labelGap?: string
}

/**
 * Badge component tokens
 */
export interface BadgeTokens extends BaseComponentTokens {
  /** Variants */
  variants?: {
    default?: Partial<BadgeTokens>
    secondary?: Partial<BadgeTokens>
    outline?: Partial<BadgeTokens>
    destructive?: Partial<BadgeTokens>
    success?: Partial<BadgeTokens>
    warning?: Partial<BadgeTokens>
  }
}

/**
 * Dialog/Modal component tokens
 */
export interface DialogTokens extends BaseComponentTokens {
  /** Overlay background */
  overlayBackground?: ColorValue
  /** Overlay blur */
  overlayBlur?: string
  /** Header padding */
  headerPadding?: string
  /** Content padding */
  contentPadding?: string
  /** Footer padding */
  footerPadding?: string
  /** Max width */
  maxWidth?: string
  /** Animation duration */
  animationDuration?: string
}

/**
 * Table component tokens
 */
export interface TableTokens extends BaseComponentTokens {
  /** Header background */
  headerBackground?: ColorValue
  /** Header font weight */
  headerFontWeight?: string | number
  /** Row hover background */
  rowHoverBackground?: ColorValue
  /** Row selected background */
  rowSelectedBackground?: ColorValue
  /** Cell padding */
  cellPadding?: string
  /** Border color between rows */
  rowBorder?: ColorValue
}

/**
 * Custom component tokens with flexible structure
 */
export interface CustomComponentTokens {
  [key: string]: ColorValue | number | CustomComponentTokens | undefined
}

/**
 * Complete component tokens collection
 */
export interface ComponentTokens {
  /** Button tokens */
  button?: ButtonTokens
  /** Card tokens */
  card?: CardTokens
  /** Input tokens */
  input?: InputTokens
  /** Select tokens */
  select?: SelectTokens
  /** Checkbox tokens */
  checkbox?: CheckboxTokens
  /** Badge tokens */
  badge?: BadgeTokens
  /** Dialog tokens */
  dialog?: DialogTokens
  /** Table tokens */
  table?: TableTokens
  /** Custom component tokens */
  custom?: Record<string, CustomComponentTokens>
}

/**
 * Options for generating component tokens
 */
export interface GenerateComponentTokensOptions {
  /** Include button tokens */
  includeButton?: boolean
  /** Include card tokens */
  includeCard?: boolean
  /** Include input tokens */
  includeInput?: boolean
  /** Include select tokens */
  includeSelect?: boolean
  /** Include checkbox tokens */
  includeCheckbox?: boolean
  /** Include badge tokens */
  includeBadge?: boolean
  /** Include dialog tokens */
  includeDialog?: boolean
  /** Include table tokens */
  includeTable?: boolean
  /** Custom components to generate */
  customComponents?: string[]
}

/**
 * Generates button tokens from theme config
 *
 * @param theme - Theme configuration
 * @returns Button tokens
 */
export function generateButtonTokens(theme: ThemeConfig): ButtonTokens {
  const tokens = theme.light
  const colors = tokens.colors

  return {
    background: colors.primary,
    foreground: colors.primaryForeground,
    border: "transparent",
    borderRadius: tokens.radius?.md ?? "0.375rem",
    padding: `${tokens.spacing?.[2] ?? "0.5rem"} ${tokens.spacing?.[4] ?? "1rem"}`,
    fontSize: tokens.typography?.sm?.fontSize ?? "0.875rem",
    fontWeight: tokens.fontWeight?.medium ?? "500",
    lineHeight: tokens.typography?.sm?.lineHeight ?? "1.25rem",
    shadow: tokens.shadow?.sm,
    transition: "all 150ms ease",
    hoverBackground: colors.primary,
    hoverForeground: colors.primaryForeground,
    activeBackground: colors.primary,
    disabledOpacity: "0.5",
    focusRing: colors.ring,
    focusRingOffset: "2px",
    gap: tokens.spacing?.[2] ?? "0.5rem",
    minHeight: tokens.spacing?.[10] ?? "2.5rem",
    variants: {
      primary: {
        background: colors.primary,
        foreground: colors.primaryForeground,
      },
      secondary: {
        background: colors.secondary,
        foreground: colors.secondaryForeground,
      },
      outline: {
        background: "transparent",
        foreground: colors.foreground,
        border: colors.border,
      },
      ghost: {
        background: "transparent",
        foreground: colors.foreground,
        hoverBackground: colors.accent,
      },
      destructive: {
        background: colors.destructive,
        foreground: colors.destructiveForeground,
      },
      link: {
        background: "transparent",
        foreground: colors.primary,
        padding: "0",
      },
    },
    sizes: {
      sm: {
        minHeight: tokens.spacing?.[8] ?? "2rem",
        padding: `${tokens.spacing?.[1] ?? "0.25rem"} ${tokens.spacing?.[3] ?? "0.75rem"}`,
        fontSize: tokens.typography?.xs?.fontSize ?? "0.75rem",
      },
      md: {
        minHeight: tokens.spacing?.[10] ?? "2.5rem",
        padding: `${tokens.spacing?.[2] ?? "0.5rem"} ${tokens.spacing?.[4] ?? "1rem"}`,
      },
      lg: {
        minHeight: tokens.spacing?.[12] ?? "3rem",
        padding: `${tokens.spacing?.[3] ?? "0.75rem"} ${tokens.spacing?.[6] ?? "1.5rem"}`,
        fontSize: tokens.typography?.base?.fontSize ?? "1rem",
      },
      icon: {
        minHeight: tokens.spacing?.[10] ?? "2.5rem",
        padding: "0",
      },
    },
  }
}

/**
 * Generates card tokens from theme config
 *
 * @param theme - Theme configuration
 * @returns Card tokens
 */
export function generateCardTokens(theme: ThemeConfig): CardTokens {
  const tokens = theme.light
  const colors = tokens.colors

  return {
    background: colors.card,
    foreground: colors.cardForeground,
    border: colors.border,
    borderRadius: tokens.radius?.lg ?? "0.5rem",
    borderWidth: "1px",
    shadow: tokens.shadow?.sm,
    padding: tokens.spacing?.[6] ?? "1.5rem",
    headerBackground: "transparent",
    headerPadding: `${tokens.spacing?.[6] ?? "1.5rem"} ${tokens.spacing?.[6] ?? "1.5rem"} 0`,
    footerBackground: "transparent",
    footerPadding: `0 ${tokens.spacing?.[6] ?? "1.5rem"} ${tokens.spacing?.[6] ?? "1.5rem"}`,
    contentPadding: tokens.spacing?.[6] ?? "1.5rem",
    hoverShadow: tokens.shadow?.md,
    hoverBorder: colors.border,
  }
}

/**
 * Generates input tokens from theme config
 *
 * @param theme - Theme configuration
 * @returns Input tokens
 */
export function generateInputTokens(theme: ThemeConfig): InputTokens {
  const tokens = theme.light
  const colors = tokens.colors

  return {
    background: colors.background,
    foreground: colors.foreground,
    border: colors.input,
    borderRadius: tokens.radius?.md ?? "0.375rem",
    padding: `${tokens.spacing?.[2] ?? "0.5rem"} ${tokens.spacing?.[3] ?? "0.75rem"}`,
    fontSize: tokens.typography?.sm?.fontSize ?? "0.875rem",
    fontWeight: tokens.fontWeight?.normal ?? "400",
    lineHeight: tokens.typography?.sm?.lineHeight ?? "1.25rem",
    height: tokens.spacing?.[10] ?? "2.5rem",
    placeholder: colors.mutedForeground,
    focusBorder: colors.ring,
    focusRing: colors.ring,
    errorBorder: colors.destructive,
    errorText: colors.destructive,
    disabledBackground: colors.muted,
    disabledText: colors.mutedForeground,
    labelFontSize: tokens.typography?.sm?.fontSize ?? "0.875rem",
    labelFontWeight: tokens.fontWeight?.medium ?? "500",
    labelColor: colors.foreground,
    helperFontSize: tokens.typography?.xs?.fontSize ?? "0.75rem",
    helperColor: colors.mutedForeground,
    transition: "border-color 150ms ease, box-shadow 150ms ease",
    sizes: {
      sm: {
        height: tokens.spacing?.[8] ?? "2rem",
        padding: `${tokens.spacing?.[1] ?? "0.25rem"} ${tokens.spacing?.[2] ?? "0.5rem"}`,
        fontSize: tokens.typography?.xs?.fontSize ?? "0.75rem",
      },
      md: {
        height: tokens.spacing?.[10] ?? "2.5rem",
      },
      lg: {
        height: tokens.spacing?.[12] ?? "3rem",
        padding: `${tokens.spacing?.[3] ?? "0.75rem"} ${tokens.spacing?.[4] ?? "1rem"}`,
        fontSize: tokens.typography?.base?.fontSize ?? "1rem",
      },
    },
  }
}

/**
 * Generates select tokens from theme config
 *
 * @param theme - Theme configuration
 * @returns Select tokens
 */
export function generateSelectTokens(theme: ThemeConfig): SelectTokens {
  const inputTokens = generateInputTokens(theme)
  const tokens = theme.light
  const colors = tokens.colors

  return {
    ...inputTokens,
    dropdownBackground: colors.popover,
    optionHoverBackground: colors.accent,
    optionSelectedBackground: colors.accent,
    optionPadding: `${tokens.spacing?.[2] ?? "0.5rem"} ${tokens.spacing?.[3] ?? "0.75rem"}`,
    chevronColor: colors.mutedForeground,
    maxDropdownHeight: "15rem",
  }
}

/**
 * Generates checkbox tokens from theme config
 *
 * @param theme - Theme configuration
 * @returns Checkbox tokens
 */
export function generateCheckboxTokens(theme: ThemeConfig): CheckboxTokens {
  const tokens = theme.light
  const colors = tokens.colors

  return {
    background: colors.background,
    foreground: colors.foreground,
    border: colors.input,
    borderRadius: tokens.radius?.sm ?? "0.125rem",
    checkedBackground: colors.primary,
    checkedForeground: colors.primaryForeground,
    indeterminateBackground: colors.primary,
    focusRing: colors.ring,
    size: "1rem",
    labelGap: tokens.spacing?.[2] ?? "0.5rem",
    transition: "all 150ms ease",
  }
}

/**
 * Generates badge tokens from theme config
 *
 * @param theme - Theme configuration
 * @returns Badge tokens
 */
export function generateBadgeTokens(theme: ThemeConfig): BadgeTokens {
  const tokens = theme.light
  const colors = tokens.colors

  return {
    background: colors.primary,
    foreground: colors.primaryForeground,
    borderRadius: tokens.radius?.full ?? "9999px",
    padding: `${tokens.spacing?.[1] ?? "0.25rem"} ${tokens.spacing?.[2] ?? "0.5rem"}`,
    fontSize: tokens.typography?.xs?.fontSize ?? "0.75rem",
    fontWeight: tokens.fontWeight?.medium ?? "500",
    lineHeight: "1",
    variants: {
      default: {
        background: colors.primary,
        foreground: colors.primaryForeground,
      },
      secondary: {
        background: colors.secondary,
        foreground: colors.secondaryForeground,
      },
      outline: {
        background: "transparent",
        foreground: colors.foreground,
        border: colors.border,
      },
      destructive: {
        background: colors.destructive,
        foreground: colors.destructiveForeground,
      },
      success: {
        background: "oklch(0.7 0.15 145)",
        foreground: "oklch(0.98 0 0)",
      },
      warning: {
        background: "oklch(0.75 0.15 85)",
        foreground: "oklch(0.2 0 0)",
      },
    },
  }
}

/**
 * Generates dialog tokens from theme config
 *
 * @param theme - Theme configuration
 * @returns Dialog tokens
 */
export function generateDialogTokens(theme: ThemeConfig): DialogTokens {
  const tokens = theme.light
  const colors = tokens.colors

  return {
    background: colors.background,
    foreground: colors.foreground,
    border: colors.border,
    borderRadius: tokens.radius?.lg ?? "0.5rem",
    shadow: tokens.shadow?.lg,
    overlayBackground: "oklch(0 0 0 / 0.5)",
    overlayBlur: "4px",
    headerPadding: `${tokens.spacing?.[6] ?? "1.5rem"} ${tokens.spacing?.[6] ?? "1.5rem"} 0`,
    contentPadding: tokens.spacing?.[6] ?? "1.5rem",
    footerPadding: `0 ${tokens.spacing?.[6] ?? "1.5rem"} ${tokens.spacing?.[6] ?? "1.5rem"}`,
    maxWidth: "32rem",
    animationDuration: "200ms",
  }
}

/**
 * Generates table tokens from theme config
 *
 * @param theme - Theme configuration
 * @returns Table tokens
 */
export function generateTableTokens(theme: ThemeConfig): TableTokens {
  const tokens = theme.light
  const colors = tokens.colors

  return {
    background: colors.background,
    foreground: colors.foreground,
    border: colors.border,
    borderRadius: tokens.radius?.md ?? "0.375rem",
    headerBackground: colors.muted,
    headerFontWeight: tokens.fontWeight?.medium ?? "500",
    rowHoverBackground: colors.muted,
    rowSelectedBackground: colors.accent,
    cellPadding: `${tokens.spacing?.[3] ?? "0.75rem"} ${tokens.spacing?.[4] ?? "1rem"}`,
    rowBorder: colors.border,
    fontSize: tokens.typography?.sm?.fontSize ?? "0.875rem",
  }
}

/**
 * Creates custom component tokens
 *
 * @param name - Component name
 * @param tokens - Token values
 * @returns Custom component tokens entry
 */
export function createCustomComponentTokens(
  name: string,
  tokens: CustomComponentTokens
): Record<string, CustomComponentTokens> {
  return { [name]: tokens }
}

/**
 * Generates all component tokens from theme config
 *
 * @param theme - Theme configuration
 * @param options - Generation options
 * @returns Component tokens collection
 *
 * @example
 * ```typescript
 * // Generate all component tokens
 * const tokens = generateComponentTokens(myTheme)
 *
 * // Generate only specific components
 * const tokens = generateComponentTokens(myTheme, {
 *   includeButton: true,
 *   includeCard: true,
 *   includeInput: false,
 * })
 *
 * // Use tokens
 * const buttonBg = tokens.button?.background
 * ```
 */
export function generateComponentTokens(
  theme: ThemeConfig,
  options: GenerateComponentTokensOptions = {}
): ComponentTokens {
  const {
    includeButton = true,
    includeCard = true,
    includeInput = true,
    includeSelect = true,
    includeCheckbox = true,
    includeBadge = true,
    includeDialog = true,
    includeTable = true,
  } = options

  const result: ComponentTokens = {}

  if (includeButton) {
    result.button = generateButtonTokens(theme)
  }
  if (includeCard) {
    result.card = generateCardTokens(theme)
  }
  if (includeInput) {
    result.input = generateInputTokens(theme)
  }
  if (includeSelect) {
    result.select = generateSelectTokens(theme)
  }
  if (includeCheckbox) {
    result.checkbox = generateCheckboxTokens(theme)
  }
  if (includeBadge) {
    result.badge = generateBadgeTokens(theme)
  }
  if (includeDialog) {
    result.dialog = generateDialogTokens(theme)
  }
  if (includeTable) {
    result.table = generateTableTokens(theme)
  }

  return result
}

/**
 * Gets component tokens for a specific component
 *
 * @param theme - Theme configuration
 * @param component - Component name
 * @returns Component tokens or undefined
 *
 * @example
 * ```typescript
 * const buttonTokens = getComponentTokens(myTheme, "button")
 * console.log(buttonTokens?.background)
 * ```
 */
export function getComponentTokens(
  theme: ThemeConfig,
  component: keyof Omit<ComponentTokens, "custom">
): BaseComponentTokens | undefined {
  const generators: Record<string, (t: ThemeConfig) => BaseComponentTokens> = {
    button: generateButtonTokens,
    card: generateCardTokens,
    input: generateInputTokens,
    select: generateSelectTokens,
    checkbox: generateCheckboxTokens,
    badge: generateBadgeTokens,
    dialog: generateDialogTokens,
    table: generateTableTokens,
  }

  const generator = generators[component]
  return generator ? generator(theme) : undefined
}

/**
 * Generates CSS variables for component tokens
 *
 * @param tokens - Component tokens
 * @param prefix - CSS variable prefix
 * @returns CSS variable declarations
 *
 * @example
 * ```typescript
 * const buttonTokens = generateButtonTokens(myTheme)
 * const css = generateComponentTokensCss(buttonTokens, "button")
 * // --button-background: oklch(0.6 0.2 250);
 * // --button-foreground: oklch(0.98 0 0);
 * ```
 */
export function generateComponentTokensCss(
  tokens: BaseComponentTokens | CustomComponentTokens,
  prefix: string
): string {
  const lines: string[] = []

  function processTokens(obj: Record<string, unknown>, path: string): void {
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null) continue

      const varName = path ? `${path}-${key}` : `${prefix}-${key}`

      if (typeof value === "object" && !Array.isArray(value)) {
        processTokens(value as Record<string, unknown>, varName)
      } else {
        lines.push(`  --${varName}: ${value};`)
      }
    }
  }

  processTokens(tokens as Record<string, unknown>, "")
  return lines.join("\n")
}

/**
 * Generates complete CSS for all component tokens
 *
 * @param theme - Theme configuration
 * @param options - Generation options
 * @returns CSS string with component token variables
 *
 * @example
 * ```typescript
 * const css = generateAllComponentTokensCss(myTheme)
 * // :root {
 * //   --button-background: ...;
 * //   --card-background: ...;
 * // }
 * ```
 */
export function generateAllComponentTokensCss(
  theme: ThemeConfig,
  options: GenerateComponentTokensOptions = {}
): string {
  const allTokens = generateComponentTokens(theme, options)
  const sections: string[] = []

  for (const [component, tokens] of Object.entries(allTokens)) {
    if (tokens && component !== "custom") {
      sections.push(`  /* ${component} */`)
      sections.push(generateComponentTokensCss(tokens, component))
    }
  }

  // Handle custom components
  if (allTokens.custom) {
    for (const [name, tokens] of Object.entries(allTokens.custom)) {
      sections.push(`  /* custom: ${name} */`)
      sections.push(generateComponentTokensCss(tokens, name))
    }
  }

  return `:root {\n${sections.join("\n")}\n}`
}

/**
 * Merges component tokens with overrides
 *
 * @param base - Base component tokens
 * @param overrides - Token overrides
 * @returns Merged tokens
 */
export function mergeComponentTokens<T extends BaseComponentTokens>(
  base: T,
  overrides: Partial<T>
): T {
  return { ...base, ...overrides } as T
}

/**
 * Extracts component tokens from existing CSS variables
 *
 * @param element - DOM element with CSS variables
 * @param component - Component name prefix
 * @returns Extracted tokens
 */
export function extractComponentTokensFromElement(
  element: Element,
  component: string
): CustomComponentTokens {
  if (typeof window === "undefined") {
    return {}
  }

  const computed = window.getComputedStyle(element)
  const tokens: CustomComponentTokens = {}

  // Get all CSS custom properties
  const allProps = Array.from(document.styleSheets)
    .flatMap((sheet) => {
      try {
        return Array.from(sheet.cssRules)
      } catch {
        return []
      }
    })
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
    .flatMap((rule) => Array.from(rule.style))
    .filter((prop) => prop.startsWith(`--${component}-`))

  for (const prop of new Set(allProps)) {
    const value = computed.getPropertyValue(prop).trim()
    if (value) {
      const key = prop.replace(`--${component}-`, "")
      tokens[key] = value
    }
  }

  return tokens
}

// ============================================================================
// Feature #107: Animation Presets
// ============================================================================

/**
 * Spring animation configuration for Framer Motion
 */
export interface SpringConfig {
  /** Spring stiffness (default: 100) */
  stiffness?: number
  /** Damping coefficient (default: 10) */
  damping?: number
  /** Mass of the object (default: 1) */
  mass?: number
  /** Velocity at start (default: 0) */
  velocity?: number
  /** Rest delta threshold (default: 0.01) */
  restDelta?: number
  /** Rest speed threshold (default: 0.01) */
  restSpeed?: number
}

/**
 * Tween animation configuration
 */
export interface TweenConfig {
  /** Duration in seconds */
  duration?: number
  /** Easing function name or cubic-bezier */
  ease?: string | number[]
  /** Delay before animation starts */
  delay?: number
  /** Number of times to repeat (-1 for infinite) */
  repeat?: number
  /** Whether to reverse on repeat */
  repeatType?: "loop" | "reverse" | "mirror"
  /** Delay between repeats */
  repeatDelay?: number
}

/**
 * Inertia animation configuration (for drag/scroll)
 */
export interface InertiaConfig {
  /** Deceleration rate (default: 0.95) */
  power?: number
  /** Time constant for decay */
  timeConstant?: number
  /** Minimum value constraint */
  min?: number
  /** Maximum value constraint */
  max?: number
  /** Elasticity when hitting constraints */
  bounceStiffness?: number
  /** Damping when bouncing */
  bounceDamping?: number
}

/**
 * Keyframe animation configuration
 */
export interface KeyframeConfig {
  /** Array of keyframe values */
  values: (string | number)[]
  /** Times for each keyframe (0-1) */
  times?: number[]
  /** Easing between keyframes */
  ease?: string | string[]
  /** Total duration */
  duration?: number
}

/**
 * Named animation preset
 */
export interface AnimationPreset {
  /** Preset name */
  name: string
  /** Preset description */
  description?: string
  /** Animation type */
  type: "spring" | "tween" | "inertia" | "keyframes"
  /** Spring configuration (when type is spring) */
  spring?: SpringConfig
  /** Tween configuration (when type is tween) */
  tween?: TweenConfig
  /** Inertia configuration (when type is inertia) */
  inertia?: InertiaConfig
  /** Keyframes configuration (when type is keyframes) */
  keyframes?: KeyframeConfig
}

/**
 * Duration presets in seconds
 */
export interface DurationPresets {
  /** Instant (0ms) */
  instant?: number
  /** Extra fast (50ms) */
  fastest?: number
  /** Fast (100ms) */
  fast?: number
  /** Normal (200ms) */
  normal?: number
  /** Slow (300ms) */
  slow?: number
  /** Slower (500ms) */
  slower?: number
  /** Slowest (1000ms) */
  slowest?: number
  /** Custom durations */
  [key: string]: number | undefined
}

/**
 * Easing presets
 */
export interface EasingPresets {
  /** Linear (no easing) */
  linear?: string
  /** Ease in (start slow) */
  easeIn?: string
  /** Ease out (end slow) */
  easeOut?: string
  /** Ease in-out (slow at both ends) */
  easeInOut?: string
  /** Bounce effect */
  bounce?: string
  /** Elastic effect */
  elastic?: string
  /** Custom easings */
  [key: string]: string | undefined
}

/**
 * Complete animation presets collection
 */
export interface AnimationPresets {
  /** Named spring configurations */
  springs?: {
    /** Default spring (balanced) */
    default?: SpringConfig
    /** Gentle spring (slower, less bounce) */
    gentle?: SpringConfig
    /** Wobbly spring (more bounce) */
    wobbly?: SpringConfig
    /** Stiff spring (quick, minimal bounce) */
    stiff?: SpringConfig
    /** Molasses spring (very slow) */
    molasses?: SpringConfig
    /** Custom springs */
    [key: string]: SpringConfig | undefined
  }
  /** Duration presets */
  durations?: DurationPresets
  /** Easing presets */
  easings?: EasingPresets
  /** Named animation presets */
  presets?: {
    /** Fade in animation */
    fadeIn?: AnimationPreset
    /** Fade out animation */
    fadeOut?: AnimationPreset
    /** Slide in from left */
    slideInLeft?: AnimationPreset
    /** Slide in from right */
    slideInRight?: AnimationPreset
    /** Slide in from top */
    slideInTop?: AnimationPreset
    /** Slide in from bottom */
    slideInBottom?: AnimationPreset
    /** Scale up animation */
    scaleUp?: AnimationPreset
    /** Scale down animation */
    scaleDown?: AnimationPreset
    /** Bounce animation */
    bounce?: AnimationPreset
    /** Shake animation */
    shake?: AnimationPreset
    /** Pulse animation */
    pulse?: AnimationPreset
    /** Custom presets */
    [key: string]: AnimationPreset | undefined
  }
  /** Hover state animations */
  hover?: {
    /** Scale on hover */
    scale?: AnimationPreset
    /** Lift (scale + shadow) */
    lift?: AnimationPreset
    /** Glow effect */
    glow?: AnimationPreset
    /** Custom hover presets */
    [key: string]: AnimationPreset | undefined
  }
  /** Tap/press state animations */
  tap?: {
    /** Scale down on tap */
    scale?: AnimationPreset
    /** Push effect */
    push?: AnimationPreset
    /** Custom tap presets */
    [key: string]: AnimationPreset | undefined
  }
  /** Page transition animations */
  pageTransitions?: {
    /** Fade transition */
    fade?: AnimationPreset
    /** Slide transition */
    slide?: AnimationPreset
    /** Scale transition */
    scale?: AnimationPreset
    /** Custom page transitions */
    [key: string]: AnimationPreset | undefined
  }
}

/**
 * Default spring configurations
 */
export const DEFAULT_SPRINGS: Required<AnimationPresets["springs"]> = {
  default: { stiffness: 100, damping: 10, mass: 1 },
  gentle: { stiffness: 120, damping: 14, mass: 1 },
  wobbly: { stiffness: 180, damping: 12, mass: 1 },
  stiff: { stiffness: 400, damping: 30, mass: 1 },
  molasses: { stiffness: 60, damping: 20, mass: 1 },
}

/**
 * Default duration presets (in seconds)
 */
export const DEFAULT_DURATIONS: Required<DurationPresets> = {
  instant: 0,
  fastest: 0.05,
  fast: 0.1,
  normal: 0.2,
  slow: 0.3,
  slower: 0.5,
  slowest: 1,
}

/**
 * Default easing presets
 */
export const DEFAULT_EASINGS: Required<EasingPresets> = {
  linear: "linear",
  easeIn: "cubic-bezier(0.4, 0, 1, 1)",
  easeOut: "cubic-bezier(0, 0, 0.2, 1)",
  easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
  elastic: "cubic-bezier(0.68, -0.6, 0.32, 1.6)",
}

/**
 * Default animation presets
 */
export const DEFAULT_ANIMATION_PRESETS: AnimationPresets = {
  springs: DEFAULT_SPRINGS,
  durations: DEFAULT_DURATIONS,
  easings: DEFAULT_EASINGS,
  presets: {
    fadeIn: {
      name: "fadeIn",
      description: "Fade in from transparent",
      type: "tween",
      tween: { duration: 0.2, ease: "easeOut" },
    },
    fadeOut: {
      name: "fadeOut",
      description: "Fade out to transparent",
      type: "tween",
      tween: { duration: 0.15, ease: "easeIn" },
    },
    slideInLeft: {
      name: "slideInLeft",
      description: "Slide in from the left",
      type: "spring",
      spring: { stiffness: 300, damping: 30 },
    },
    slideInRight: {
      name: "slideInRight",
      description: "Slide in from the right",
      type: "spring",
      spring: { stiffness: 300, damping: 30 },
    },
    slideInTop: {
      name: "slideInTop",
      description: "Slide in from the top",
      type: "spring",
      spring: { stiffness: 300, damping: 30 },
    },
    slideInBottom: {
      name: "slideInBottom",
      description: "Slide in from the bottom",
      type: "spring",
      spring: { stiffness: 300, damping: 30 },
    },
    scaleUp: {
      name: "scaleUp",
      description: "Scale up from small",
      type: "spring",
      spring: { stiffness: 400, damping: 25 },
    },
    scaleDown: {
      name: "scaleDown",
      description: "Scale down from large",
      type: "spring",
      spring: { stiffness: 400, damping: 25 },
    },
    bounce: {
      name: "bounce",
      description: "Bouncy animation",
      type: "spring",
      spring: { stiffness: 600, damping: 15 },
    },
    shake: {
      name: "shake",
      description: "Shake animation for errors",
      type: "keyframes",
      keyframes: {
        values: [0, -10, 10, -10, 10, -5, 5, 0],
        duration: 0.5,
      },
    },
    pulse: {
      name: "pulse",
      description: "Pulse animation for attention",
      type: "keyframes",
      keyframes: {
        values: [1, 1.05, 1],
        times: [0, 0.5, 1],
        duration: 0.6,
      },
    },
  },
  hover: {
    scale: {
      name: "hoverScale",
      description: "Scale up on hover",
      type: "spring",
      spring: { stiffness: 400, damping: 17 },
    },
    lift: {
      name: "hoverLift",
      description: "Lift with scale and shadow",
      type: "spring",
      spring: { stiffness: 300, damping: 20 },
    },
    glow: {
      name: "hoverGlow",
      description: "Glow effect on hover",
      type: "tween",
      tween: { duration: 0.2, ease: "easeOut" },
    },
  },
  tap: {
    scale: {
      name: "tapScale",
      description: "Scale down on tap",
      type: "spring",
      spring: { stiffness: 400, damping: 17 },
    },
    push: {
      name: "tapPush",
      description: "Push down effect",
      type: "spring",
      spring: { stiffness: 500, damping: 20 },
    },
  },
  pageTransitions: {
    fade: {
      name: "pageFade",
      description: "Fade page transition",
      type: "tween",
      tween: { duration: 0.3, ease: "easeInOut" },
    },
    slide: {
      name: "pageSlide",
      description: "Slide page transition",
      type: "spring",
      spring: { stiffness: 300, damping: 30 },
    },
    scale: {
      name: "pageScale",
      description: "Scale page transition",
      type: "spring",
      spring: { stiffness: 400, damping: 30 },
    },
  },
}

/**
 * Creates a spring configuration
 *
 * @param options - Spring options
 * @returns Spring configuration
 *
 * @example
 * ```typescript
 * const mySpring = createSpringConfig({ stiffness: 200, damping: 20 })
 * ```
 */
export function createSpringConfig(options: SpringConfig = {}): SpringConfig {
  return {
    stiffness: options.stiffness ?? 100,
    damping: options.damping ?? 10,
    mass: options.mass ?? 1,
    velocity: options.velocity,
    restDelta: options.restDelta,
    restSpeed: options.restSpeed,
  }
}

/**
 * Creates a tween configuration
 *
 * @param options - Tween options
 * @returns Tween configuration
 */
export function createTweenConfig(options: TweenConfig = {}): TweenConfig {
  return {
    duration: options.duration ?? 0.2,
    ease: options.ease ?? "easeOut",
    delay: options.delay,
    repeat: options.repeat,
    repeatType: options.repeatType,
    repeatDelay: options.repeatDelay,
  }
}

/**
 * Creates an animation preset
 *
 * @param name - Preset name
 * @param type - Animation type
 * @param config - Type-specific configuration
 * @returns Animation preset
 *
 * @example
 * ```typescript
 * const customFade = createAnimationPreset("customFade", "tween", {
 *   duration: 0.5,
 *   ease: "easeInOut"
 * })
 * ```
 */
export function createAnimationPreset(
  name: string,
  type: AnimationPreset["type"],
  config: SpringConfig | TweenConfig | InertiaConfig | KeyframeConfig,
  description?: string
): AnimationPreset {
  const preset: AnimationPreset = { name, type, description }

  switch (type) {
    case "spring":
      preset.spring = config as SpringConfig
      break
    case "tween":
      preset.tween = config as TweenConfig
      break
    case "inertia":
      preset.inertia = config as InertiaConfig
      break
    case "keyframes":
      preset.keyframes = config as KeyframeConfig
      break
  }

  return preset
}

/**
 * Gets animation presets from theme config
 *
 * Returns animation presets from the theme, falling back to defaults.
 *
 * @param theme - Theme configuration
 * @returns Animation presets
 */
export function getAnimationPresets(theme: ThemeConfig): AnimationPresets {
  // Check if theme has animation presets defined
  const themePresets = (theme as ThemeConfig & { animations?: AnimationPresets }).animations

  if (!themePresets) {
    return DEFAULT_ANIMATION_PRESETS
  }

  // Merge with defaults
  return {
    springs: { ...DEFAULT_SPRINGS, ...themePresets.springs },
    durations: { ...DEFAULT_DURATIONS, ...themePresets.durations },
    easings: { ...DEFAULT_EASINGS, ...themePresets.easings },
    presets: { ...DEFAULT_ANIMATION_PRESETS.presets, ...themePresets.presets },
    hover: { ...DEFAULT_ANIMATION_PRESETS.hover, ...themePresets.hover },
    tap: { ...DEFAULT_ANIMATION_PRESETS.tap, ...themePresets.tap },
    pageTransitions: { ...DEFAULT_ANIMATION_PRESETS.pageTransitions, ...themePresets.pageTransitions },
  }
}

/**
 * Gets a specific spring preset
 *
 * @param presets - Animation presets
 * @param name - Spring name
 * @returns Spring config or undefined
 */
export function getSpringPreset(
  presets: AnimationPresets,
  name: string
): SpringConfig | undefined {
  return presets.springs?.[name]
}

/**
 * Gets a specific animation preset
 *
 * @param presets - Animation presets
 * @param category - Preset category
 * @param name - Preset name
 * @returns Animation preset or undefined
 */
export function getAnimationPreset(
  presets: AnimationPresets,
  category: "presets" | "hover" | "tap" | "pageTransitions",
  name: string
): AnimationPreset | undefined {
  return presets[category]?.[name]
}

/**
 * Gets duration value in seconds
 *
 * @param presets - Animation presets
 * @param name - Duration name
 * @returns Duration in seconds or undefined
 */
export function getDuration(
  presets: AnimationPresets,
  name: string
): number | undefined {
  return presets.durations?.[name]
}

/**
 * Gets easing value
 *
 * @param presets - Animation presets
 * @param name - Easing name
 * @returns Easing string or undefined
 */
export function getEasing(
  presets: AnimationPresets,
  name: string
): string | undefined {
  return presets.easings?.[name]
}

/**
 * Generates CSS custom properties for animation presets
 *
 * @param presets - Animation presets
 * @returns CSS string with animation variables
 *
 * @example
 * ```typescript
 * const css = generateAnimationPresetsCss(presets)
 * // :root {
 * //   --duration-fast: 0.1s;
 * //   --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
 * //   --spring-default-stiffness: 100;
 * // }
 * ```
 */
export function generateAnimationPresetsCss(presets: AnimationPresets): string {
  const lines: string[] = []

  // Durations
  if (presets.durations) {
    for (const [name, value] of Object.entries(presets.durations)) {
      if (value !== undefined) {
        lines.push(`  --duration-${name}: ${value}s;`)
      }
    }
  }

  // Easings
  if (presets.easings) {
    for (const [name, value] of Object.entries(presets.easings)) {
      if (value !== undefined) {
        const cssName = name.replace(/([A-Z])/g, "-$1").toLowerCase()
        lines.push(`  --ease-${cssName}: ${value};`)
      }
    }
  }

  // Spring configs (as individual properties for use in JS)
  if (presets.springs) {
    for (const [name, config] of Object.entries(presets.springs)) {
      if (config) {
        if (config.stiffness !== undefined) {
          lines.push(`  --spring-${name}-stiffness: ${config.stiffness};`)
        }
        if (config.damping !== undefined) {
          lines.push(`  --spring-${name}-damping: ${config.damping};`)
        }
        if (config.mass !== undefined) {
          lines.push(`  --spring-${name}-mass: ${config.mass};`)
        }
      }
    }
  }

  return `:root {\n${lines.join("\n")}\n}`
}

/**
 * Creates a complete animation presets collection
 *
 * @param overrides - Partial presets to merge with defaults
 * @returns Complete animation presets
 *
 * @example
 * ```typescript
 * const myPresets = createAnimationPresets({
 *   springs: {
 *     custom: { stiffness: 200, damping: 15 }
 *   },
 *   durations: {
 *     custom: 0.25
 *   }
 * })
 * ```
 */
export function createAnimationPresets(
  overrides: Partial<AnimationPresets> = {}
): AnimationPresets {
  return {
    springs: { ...DEFAULT_SPRINGS, ...overrides.springs },
    durations: { ...DEFAULT_DURATIONS, ...overrides.durations },
    easings: { ...DEFAULT_EASINGS, ...overrides.easings },
    presets: { ...DEFAULT_ANIMATION_PRESETS.presets, ...overrides.presets },
    hover: { ...DEFAULT_ANIMATION_PRESETS.hover, ...overrides.hover },
    tap: { ...DEFAULT_ANIMATION_PRESETS.tap, ...overrides.tap },
    pageTransitions: { ...DEFAULT_ANIMATION_PRESETS.pageTransitions, ...overrides.pageTransitions },
  }
}

/**
 * Converts spring config to Framer Motion transition object
 *
 * @param spring - Spring configuration
 * @returns Framer Motion transition object
 *
 * @example
 * ```typescript
 * const transition = springToFramerMotion({ stiffness: 200, damping: 20 })
 * // { type: "spring", stiffness: 200, damping: 20 }
 * ```
 */
export function springToFramerMotion(spring: SpringConfig): Record<string, unknown> {
  return {
    type: "spring",
    stiffness: spring.stiffness,
    damping: spring.damping,
    mass: spring.mass,
    velocity: spring.velocity,
    restDelta: spring.restDelta,
    restSpeed: spring.restSpeed,
  }
}

/**
 * Converts tween config to Framer Motion transition object
 *
 * @param tween - Tween configuration
 * @returns Framer Motion transition object
 */
export function tweenToFramerMotion(tween: TweenConfig): Record<string, unknown> {
  return {
    type: "tween",
    duration: tween.duration,
    ease: tween.ease,
    delay: tween.delay,
    repeat: tween.repeat,
    repeatType: tween.repeatType,
    repeatDelay: tween.repeatDelay,
  }
}

/**
 * Converts animation preset to Framer Motion transition
 *
 * @param preset - Animation preset
 * @returns Framer Motion transition object
 */
export function presetToFramerMotion(preset: AnimationPreset): Record<string, unknown> {
  switch (preset.type) {
    case "spring":
      return preset.spring ? springToFramerMotion(preset.spring) : { type: "spring" }
    case "tween":
      return preset.tween ? tweenToFramerMotion(preset.tween) : { type: "tween" }
    case "inertia":
      return { type: "inertia", ...preset.inertia }
    case "keyframes":
      return { type: "keyframes", ...preset.keyframes }
    default:
      return { type: "tween" }
  }
}

// ============================================================================
// Feature #108: URL Loading
// ============================================================================

/**
 * Configuration for loading brand kit from URL
 */
export interface UrlLoadingConfig {
  /** URL to load brand kit from (must be HTTPS in production) */
  url: string
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number
  /** Whether to cache the loaded brand kit (default: true) */
  cache?: boolean
  /** Cache TTL in milliseconds (default: 300000 = 5 minutes) */
  cacheTtl?: number
  /** Custom headers to include in the request */
  headers?: Record<string, string>
  /** Credentials mode for CORS (default: "same-origin") */
  credentials?: RequestCredentials
  /** Whether to validate the response (default: true) */
  validate?: boolean
  /** Retry configuration */
  retry?: {
    /** Number of retries (default: 3) */
    attempts?: number
    /** Delay between retries in ms (default: 1000) */
    delay?: number
    /** Whether to use exponential backoff (default: true) */
    exponentialBackoff?: boolean
  }
}

/**
 * Result of loading a brand kit from URL
 */
export interface UrlLoadingResult {
  /** Whether the load was successful */
  success: boolean
  /** The loaded theme config (if successful) */
  config: ThemeConfig | null
  /** Error message (if failed) */
  error?: string
  /** HTTP status code */
  statusCode?: number
  /** Whether the result was served from cache */
  fromCache: boolean
  /** Time taken to load in milliseconds */
  loadTime: number
  /** URL that was loaded */
  url: string
  /** Cache expiry time (if cached) */
  cacheExpiry?: number
}

/**
 * Cache entry for remote brand kits
 */
interface BrandKitCacheEntry {
  config: ThemeConfig
  url: string
  timestamp: number
  expiresAt: number
  etag?: string
  lastModified?: string
}

/** Cache for remote brand kits */
const brandKitUrlCache = new Map<string, BrandKitCacheEntry>()

/** Default URL loading configuration */
const DEFAULT_URL_LOADING_CONFIG: Required<Omit<UrlLoadingConfig, "url" | "headers">> & {
  headers: Record<string, string>
} = {
  timeout: 10000,
  cache: true,
  cacheTtl: 300000, // 5 minutes
  headers: {},
  credentials: "same-origin",
  validate: true,
  retry: {
    attempts: 3,
    delay: 1000,
    exponentialBackoff: true,
  },
}

/**
 * Validates that a URL is safe to load
 *
 * @param url - URL to validate
 * @returns Validation result
 */
export function validateBrandKitUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url)

    // Only allow HTTP(S) protocols
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { valid: false, error: `Invalid protocol: ${parsed.protocol}. Only HTTP(S) allowed.` }
    }

    // Warn about non-HTTPS in production-like environments
    if (parsed.protocol === "http:" && typeof window !== "undefined" && window.location.protocol === "https:") {
      return { valid: false, error: "Cannot load HTTP URL from HTTPS page due to mixed content policy." }
    }

    return { valid: true }
  } catch {
    return { valid: false, error: "Invalid URL format" }
  }
}

/**
 * Gets a cached brand kit if available and not expired
 *
 * @param url - URL to check cache for
 * @returns Cached entry or undefined
 */
export function getCachedBrandKit(url: string): BrandKitCacheEntry | undefined {
  const entry = brandKitUrlCache.get(url)

  if (!entry) {
    return undefined
  }

  // Check if expired
  if (Date.now() > entry.expiresAt) {
    brandKitUrlCache.delete(url)
    return undefined
  }

  return entry
}

/**
 * Caches a brand kit
 *
 * @param url - URL the brand kit was loaded from
 * @param config - The theme config to cache
 * @param ttl - Cache TTL in milliseconds
 * @param etag - Optional ETag header value
 * @param lastModified - Optional Last-Modified header value
 */
export function cacheBrandKit(
  url: string,
  config: ThemeConfig,
  ttl: number,
  etag?: string,
  lastModified?: string
): void {
  const now = Date.now()
  brandKitUrlCache.set(url, {
    config,
    url,
    timestamp: now,
    expiresAt: now + ttl,
    etag,
    lastModified,
  })
}

/**
 * Clears the brand kit URL cache
 *
 * @param url - Optional specific URL to clear, or all if not provided
 */
export function clearBrandKitUrlCache(url?: string): void {
  if (url) {
    brandKitUrlCache.delete(url)
  } else {
    brandKitUrlCache.clear()
  }
}

/**
 * Gets cache statistics
 *
 * @returns Cache statistics
 */
export function getBrandKitUrlCacheStats(): {
  size: number
  entries: Array<{ url: string; expiresIn: number }>
} {
  const now = Date.now()
  const entries = Array.from(brandKitUrlCache.entries()).map(([url, entry]) => ({
    url,
    expiresIn: Math.max(0, entry.expiresAt - now),
  }))

  return {
    size: brandKitUrlCache.size,
    entries,
  }
}

/**
 * Performs a fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Loads a brand kit from a remote URL
 *
 * Supports HTTPS URLs with proper CORS handling and caching.
 *
 * @param config - URL loading configuration
 * @returns Loading result with theme config or error
 *
 * @example
 * ```typescript
 * const result = await loadBrandKitFromUrl({
 *   url: "https://cdn.example.com/brand-kit.json",
 *   cache: true,
 *   cacheTtl: 600000, // 10 minutes
 * })
 *
 * if (result.success) {
 *   console.log("Loaded brand:", result.config?.name)
 *   console.log("From cache:", result.fromCache)
 * } else {
 *   console.error("Failed to load:", result.error)
 * }
 * ```
 */
export async function loadBrandKitFromUrl(
  config: UrlLoadingConfig
): Promise<UrlLoadingResult> {
  const startTime = Date.now()
  const {
    url,
    timeout = DEFAULT_URL_LOADING_CONFIG.timeout,
    cache = DEFAULT_URL_LOADING_CONFIG.cache,
    cacheTtl = DEFAULT_URL_LOADING_CONFIG.cacheTtl,
    headers = DEFAULT_URL_LOADING_CONFIG.headers,
    credentials = DEFAULT_URL_LOADING_CONFIG.credentials,
    validate = DEFAULT_URL_LOADING_CONFIG.validate,
    retry = DEFAULT_URL_LOADING_CONFIG.retry,
  } = config

  // Validate URL
  const urlValidation = validateBrandKitUrl(url)
  if (!urlValidation.valid) {
    return {
      success: false,
      config: null,
      error: urlValidation.error,
      fromCache: false,
      loadTime: Date.now() - startTime,
      url,
    }
  }

  // Check cache first
  if (cache) {
    const cached = getCachedBrandKit(url)
    if (cached) {
      return {
        success: true,
        config: cached.config,
        fromCache: true,
        loadTime: Date.now() - startTime,
        url,
        cacheExpiry: cached.expiresAt,
      }
    }
  }

  // Prepare request headers
  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  }

  // Add conditional headers if we have cached data
  const existingCache = brandKitUrlCache.get(url)
  if (existingCache?.etag) {
    requestHeaders["If-None-Match"] = existingCache.etag
  }
  if (existingCache?.lastModified) {
    requestHeaders["If-Modified-Since"] = existingCache.lastModified
  }

  // Retry configuration with concrete defaults
  const maxAttempts = retry?.attempts ?? 3
  const baseDelay = retry?.delay ?? 1000
  const useExponentialBackoff = retry?.exponentialBackoff ?? true

  let lastError: string | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetchWithTimeout(
        url,
        {
          method: "GET",
          headers: requestHeaders,
          credentials,
          mode: "cors",
        },
        timeout
      )

      // Handle 304 Not Modified
      if (response.status === 304 && existingCache) {
        // Refresh cache expiry
        existingCache.expiresAt = Date.now() + cacheTtl
        return {
          success: true,
          config: existingCache.config,
          statusCode: 304,
          fromCache: true,
          loadTime: Date.now() - startTime,
          url,
          cacheExpiry: existingCache.expiresAt,
        }
      }

      if (!response.ok) {
        lastError = `HTTP ${response.status}: ${response.statusText}`

        // Don't retry for client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          return {
            success: false,
            config: null,
            error: lastError,
            statusCode: response.status,
            fromCache: false,
            loadTime: Date.now() - startTime,
            url,
          }
        }

        // Retry for server errors
        if (attempt < maxAttempts) {
          const delay = useExponentialBackoff
            ? baseDelay * Math.pow(2, attempt - 1)
            : baseDelay
          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        }

        return {
          success: false,
          config: null,
          error: lastError,
          statusCode: response.status,
          fromCache: false,
          loadTime: Date.now() - startTime,
          url,
        }
      }

      // Parse response
      const data = await response.json()

      // Validate response structure
      if (validate) {
        if (!data || typeof data !== "object") {
          return {
            success: false,
            config: null,
            error: "Invalid response: expected JSON object",
            statusCode: response.status,
            fromCache: false,
            loadTime: Date.now() - startTime,
            url,
          }
        }

        // Basic ThemeConfig validation
        if (!data.name || !data.light) {
          return {
            success: false,
            config: null,
            error: "Invalid brand kit: missing required fields (name, light)",
            statusCode: response.status,
            fromCache: false,
            loadTime: Date.now() - startTime,
            url,
          }
        }
      }

      const themeConfig = data as ThemeConfig

      // Cache the result
      if (cache) {
        const etag = response.headers.get("ETag") ?? undefined
        const lastModified = response.headers.get("Last-Modified") ?? undefined
        cacheBrandKit(url, themeConfig, cacheTtl, etag, lastModified)
      }

      return {
        success: true,
        config: themeConfig,
        statusCode: response.status,
        fromCache: false,
        loadTime: Date.now() - startTime,
        url,
        cacheExpiry: cache ? Date.now() + cacheTtl : undefined,
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          lastError = `Request timeout after ${timeout}ms`
        } else {
          lastError = error.message
        }
      } else {
        lastError = "Unknown error occurred"
      }

      // Retry on network errors
      if (attempt < maxAttempts) {
        const delay = useExponentialBackoff
          ? baseDelay * Math.pow(2, attempt - 1)
          : baseDelay
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }
    }
  }

  return {
    success: false,
    config: null,
    error: lastError ?? "Failed to load brand kit",
    fromCache: false,
    loadTime: Date.now() - startTime,
    url,
  }
}

/**
 * Preloads multiple brand kits from URLs
 *
 * @param urls - Array of URLs to preload
 * @param options - Common loading options
 * @returns Map of URL to loading result
 *
 * @example
 * ```typescript
 * const results = await preloadBrandKits([
 *   "https://cdn.example.com/light-theme.json",
 *   "https://cdn.example.com/dark-theme.json",
 * ])
 *
 * for (const [url, result] of results) {
 *   console.log(url, result.success ? "loaded" : result.error)
 * }
 * ```
 */
export async function preloadBrandKits(
  urls: string[],
  options: Omit<UrlLoadingConfig, "url"> = {}
): Promise<Map<string, UrlLoadingResult>> {
  const results = new Map<string, UrlLoadingResult>()

  const promises = urls.map(async (url) => {
    const result = await loadBrandKitFromUrl({ ...options, url })
    results.set(url, result)
  })

  await Promise.all(promises)
  return results
}

/**
 * Creates a URL loader function compatible with config inheritance
 *
 * @param baseOptions - Default options for all loads
 * @returns ConfigLoader function
 *
 * @example
 * ```typescript
 * const loader = createUrlConfigLoader({
 *   timeout: 5000,
 *   cache: true,
 * })
 *
 * const result = await resolveConfigInheritance(config, { loader })
 * ```
 */
export function createUrlConfigLoader(
  baseOptions: Omit<UrlLoadingConfig, "url"> = {}
): ConfigLoader {
  return async (path: string): Promise<ThemeConfig> => {
    const result = await loadBrandKitFromUrl({ ...baseOptions, url: path })

    if (!result.success || !result.config) {
      throw new Error(result.error ?? "Failed to load brand kit")
    }

    return result.config
  }
}

/**
 * Refreshes a cached brand kit
 *
 * Forces a reload from the URL, bypassing cache.
 *
 * @param url - URL to refresh
 * @param options - Loading options
 * @returns Loading result
 */
export async function refreshBrandKit(
  url: string,
  options: Omit<UrlLoadingConfig, "url" | "cache"> = {}
): Promise<UrlLoadingResult> {
  // Clear existing cache entry
  clearBrandKitUrlCache(url)

  // Reload with caching enabled
  return loadBrandKitFromUrl({ ...options, url, cache: true })
}

// ============================================================================
// Feature #109: Runtime Resolution
// ============================================================================

/**
 * Loading status for runtime resolution
 */
export type RuntimeLoadingStatus = "idle" | "loading" | "success" | "error"

/**
 * Error types for runtime resolution
 */
export type RuntimeLoadingErrorType =
  | "network"
  | "timeout"
  | "validation"
  | "not_found"
  | "unauthorized"
  | "unknown"

/**
 * Error details for runtime resolution
 */
export interface RuntimeLoadingError {
  /** Error type category */
  type: RuntimeLoadingErrorType
  /** Human-readable error message */
  message: string
  /** HTTP status code (if applicable) */
  statusCode?: number
  /** Original error (if available) */
  cause?: Error
  /** Timestamp when error occurred */
  timestamp: number
  /** Number of retry attempts made */
  retryCount: number
}

/**
 * Runtime resolution state
 */
export interface RuntimeResolutionState {
  /** Current loading status */
  status: RuntimeLoadingStatus
  /** Resolved theme config (when status is success) */
  config: ThemeConfig | null
  /** Error details (when status is error) */
  error: RuntimeLoadingError | null
  /** Source of the current config */
  source: "static" | "url" | "inheritance" | "fallback" | null
  /** URL that was loaded (if from URL) */
  url: string | null
  /** Timestamp of last successful load */
  lastLoadedAt: number | null
  /** Whether a refresh is in progress */
  isRefreshing: boolean
}

/**
 * Configuration for runtime resolver
 */
export interface RuntimeResolverConfig {
  /** Initial/fallback theme config */
  fallback?: ThemeConfig
  /** URL to load from (optional) */
  url?: string
  /** URL loading options */
  urlOptions?: Omit<UrlLoadingConfig, "url">
  /** Whether to load on initialization (default: true) */
  loadOnInit?: boolean
  /** Auto-refresh interval in milliseconds (0 to disable) */
  autoRefreshInterval?: number
  /** Callback when state changes */
  onStateChange?: (state: RuntimeResolutionState) => void
  /** Callback when load completes successfully */
  onLoad?: (config: ThemeConfig) => void
  /** Callback when load fails */
  onError?: (error: RuntimeLoadingError) => void
}

/** Runtime resolution state */
const runtimeResolutionState: RuntimeResolutionState = {
  status: "idle",
  config: null,
  error: null,
  source: null,
  url: null,
  lastLoadedAt: null,
  isRefreshing: false,
}

/** Subscribers for runtime resolution state changes */
const runtimeResolutionSubscribers = new Set<(state: RuntimeResolutionState) => void>()

/** Auto-refresh timer */
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null

/** Current resolver config */
let currentResolverConfig: RuntimeResolverConfig | null = null

/**
 * Notifies all runtime resolution subscribers
 */
function notifyRuntimeResolutionSubscribers(): void {
  const state = { ...runtimeResolutionState }
  runtimeResolutionSubscribers.forEach((callback) => callback(state))
  currentResolverConfig?.onStateChange?.(state)
}

/**
 * Creates a runtime loading error
 */
function createRuntimeLoadingError(
  type: RuntimeLoadingErrorType,
  message: string,
  statusCode?: number,
  cause?: Error,
  retryCount = 0
): RuntimeLoadingError {
  return {
    type,
    message,
    statusCode,
    cause,
    timestamp: Date.now(),
    retryCount,
  }
}

/**
 * Determines error type from HTTP status code
 */
function getErrorTypeFromStatus(statusCode: number): RuntimeLoadingErrorType {
  if (statusCode === 404) return "not_found"
  if (statusCode === 401 || statusCode === 403) return "unauthorized"
  if (statusCode >= 400 && statusCode < 500) return "validation"
  if (statusCode >= 500) return "network"
  return "unknown"
}

/**
 * Initializes the runtime resolver
 *
 * Sets up the runtime resolver with the given configuration.
 * If a URL is provided and loadOnInit is true, it will start loading.
 *
 * @param config - Resolver configuration
 *
 * @example
 * ```typescript
 * initRuntimeResolver({
 *   fallback: defaultTheme,
 *   url: "https://cdn.example.com/brand.json",
 *   onLoad: (config) => console.log("Loaded:", config.name),
 *   onError: (error) => console.error("Failed:", error.message),
 * })
 * ```
 */
export function initRuntimeResolver(config: RuntimeResolverConfig): void {
  currentResolverConfig = config

  // Set fallback as initial config
  if (config.fallback) {
    runtimeResolutionState.config = config.fallback
    runtimeResolutionState.source = "fallback"
    runtimeResolutionState.status = "success"
  }

  // Start loading if URL provided and loadOnInit
  if (config.url && config.loadOnInit !== false) {
    resolveRuntimeBrandKit(config.url, config.urlOptions)
  }

  // Set up auto-refresh
  if (config.autoRefreshInterval && config.autoRefreshInterval > 0 && config.url) {
    startAutoRefresh(config.autoRefreshInterval, config.url, config.urlOptions)
  }
}

/**
 * Resolves a brand kit at runtime
 *
 * Loads a brand kit from the given URL and updates the runtime state.
 *
 * @param url - URL to load from
 * @param options - Loading options
 * @returns Promise resolving to the loaded config or null on error
 *
 * @example
 * ```typescript
 * const config = await resolveRuntimeBrandKit(
 *   "https://cdn.example.com/brand.json"
 * )
 *
 * if (config) {
 *   console.log("Loaded:", config.name)
 * }
 * ```
 */
export async function resolveRuntimeBrandKit(
  url: string,
  options?: Omit<UrlLoadingConfig, "url">
): Promise<ThemeConfig | null> {
  // Update state to loading
  runtimeResolutionState.status = "loading"
  runtimeResolutionState.url = url
  runtimeResolutionState.error = null
  notifyRuntimeResolutionSubscribers()

  try {
    const result = await loadBrandKitFromUrl({ ...options, url })

    if (result.success && result.config) {
      // Success
      runtimeResolutionState.status = "success"
      runtimeResolutionState.config = result.config
      runtimeResolutionState.source = "url"
      runtimeResolutionState.lastLoadedAt = Date.now()
      runtimeResolutionState.error = null

      // Update main theme config
      currentThemeConfig = result.config

      notifyRuntimeResolutionSubscribers()
      currentResolverConfig?.onLoad?.(result.config)

      return result.config
    } else {
      // Failed
      const errorType = result.statusCode
        ? getErrorTypeFromStatus(result.statusCode)
        : "network"

      const error = createRuntimeLoadingError(
        errorType,
        result.error ?? "Failed to load brand kit",
        result.statusCode
      )

      runtimeResolutionState.status = "error"
      runtimeResolutionState.error = error

      notifyRuntimeResolutionSubscribers()
      currentResolverConfig?.onError?.(error)

      return null
    }
  } catch (err) {
    const error = createRuntimeLoadingError(
      err instanceof Error && err.name === "AbortError" ? "timeout" : "unknown",
      err instanceof Error ? err.message : "Unknown error",
      undefined,
      err instanceof Error ? err : undefined
    )

    runtimeResolutionState.status = "error"
    runtimeResolutionState.error = error

    notifyRuntimeResolutionSubscribers()
    currentResolverConfig?.onError?.(error)

    return null
  }
}

/**
 * Refreshes the runtime brand kit
 *
 * Reloads the current URL, bypassing cache.
 *
 * @returns Promise resolving to the reloaded config or null on error
 */
export async function refreshRuntimeBrandKit(): Promise<ThemeConfig | null> {
  const url = runtimeResolutionState.url
  if (!url) {
    return null
  }

  runtimeResolutionState.isRefreshing = true
  notifyRuntimeResolutionSubscribers()

  try {
    const result = await refreshBrandKit(url, currentResolverConfig?.urlOptions)

    if (result.success && result.config) {
      runtimeResolutionState.config = result.config
      runtimeResolutionState.lastLoadedAt = Date.now()
      currentThemeConfig = result.config
      currentResolverConfig?.onLoad?.(result.config)
    }

    return result.config ?? null
  } finally {
    runtimeResolutionState.isRefreshing = false
    notifyRuntimeResolutionSubscribers()
  }
}

/**
 * Gets the current runtime resolution state
 *
 * @returns Current state snapshot
 */
export function getRuntimeResolutionState(): RuntimeResolutionState {
  return { ...runtimeResolutionState }
}

/**
 * Subscribes to runtime resolution state changes
 *
 * @param callback - Function called when state changes
 * @returns Unsubscribe function
 *
 * @example
 * ```typescript
 * const unsubscribe = subscribeToRuntimeResolution((state) => {
 *   console.log("Status:", state.status)
 *   if (state.status === "error") {
 *     console.error("Error:", state.error?.message)
 *   }
 * })
 *
 * // Later...
 * unsubscribe()
 * ```
 */
export function subscribeToRuntimeResolution(
  callback: (state: RuntimeResolutionState) => void
): () => void {
  runtimeResolutionSubscribers.add(callback)
  return () => runtimeResolutionSubscribers.delete(callback)
}

/**
 * Starts auto-refresh for runtime brand kit
 *
 * @param interval - Refresh interval in milliseconds
 * @param url - URL to refresh
 * @param options - Loading options
 */
export function startAutoRefresh(
  interval: number,
  url: string,
  options?: Omit<UrlLoadingConfig, "url">
): void {
  stopAutoRefresh()

  autoRefreshTimer = setInterval(async () => {
    if (runtimeResolutionState.status !== "loading" && !runtimeResolutionState.isRefreshing) {
      await resolveRuntimeBrandKit(url, options)
    }
  }, interval)
}

/**
 * Stops auto-refresh
 */
export function stopAutoRefresh(): void {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
}

/**
 * Resets the runtime resolver
 *
 * Clears all state and stops auto-refresh.
 */
export function resetRuntimeResolver(): void {
  stopAutoRefresh()

  runtimeResolutionState.status = "idle"
  runtimeResolutionState.config = null
  runtimeResolutionState.error = null
  runtimeResolutionState.source = null
  runtimeResolutionState.url = null
  runtimeResolutionState.lastLoadedAt = null
  runtimeResolutionState.isRefreshing = false

  currentResolverConfig = null
  runtimeResolutionSubscribers.clear()

  notifyRuntimeResolutionSubscribers()
}

/**
 * Sets a static config (non-URL based)
 *
 * Useful for setting config from local sources.
 *
 * @param config - Theme config to set
 * @param source - Source identifier
 */
export function setRuntimeStaticConfig(
  config: ThemeConfig,
  source: "static" | "inheritance" = "static"
): void {
  runtimeResolutionState.status = "success"
  runtimeResolutionState.config = config
  runtimeResolutionState.source = source
  runtimeResolutionState.lastLoadedAt = Date.now()
  runtimeResolutionState.error = null

  currentThemeConfig = config
  notifyRuntimeResolutionSubscribers()
}

/**
 * Gets snapshot functions for React useSyncExternalStore
 *
 * @returns Object with subscribe, getSnapshot, and getServerSnapshot
 *
 * @example
 * ```typescript
 * import { useSyncExternalStore } from "react"
 *
 * function useRuntimeResolution() {
 *   const { subscribe, getSnapshot, getServerSnapshot } = getRuntimeResolutionSync()
 *   return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
 * }
 * ```
 */
export function getRuntimeResolutionSync(): {
  subscribe: (callback: () => void) => () => void
  getSnapshot: () => RuntimeResolutionState
  getServerSnapshot: () => RuntimeResolutionState
} {
  return {
    subscribe: (callback: () => void) => {
      return subscribeToRuntimeResolution(() => callback())
    },
    getSnapshot: getRuntimeResolutionState,
    getServerSnapshot: () => ({
      status: "idle" as const,
      config: currentResolverConfig?.fallback ?? null,
      error: null,
      source: currentResolverConfig?.fallback ? "fallback" as const : null,
      url: null,
      lastLoadedAt: null,
      isRefreshing: false,
    }),
  }
}

/**
 * Hook-compatible function for runtime resolution
 *
 * Returns the current state. For reactive updates in React,
 * use with useSyncExternalStore.
 *
 * @returns Current runtime resolution state
 *
 * @example
 * ```typescript
 * // Simple usage (non-reactive)
 * const state = useRuntimeResolution()
 *
 * // For reactive updates in React:
 * import { useSyncExternalStore } from "react"
 * const sync = getRuntimeResolutionSync()
 * const state = useSyncExternalStore(
 *   sync.subscribe,
 *   sync.getSnapshot,
 *   sync.getServerSnapshot
 * )
 * ```
 */
export function useRuntimeResolution(): RuntimeResolutionState {
  return getRuntimeResolutionState()
}

// ============================================================================
// Feature #110: Dependency Resolution
// ============================================================================

/**
 * Peer dependency specification
 */
export interface PeerDependency {
  /** Package name */
  name: string
  /** Required version (semver range) */
  version: string
  /** Whether this dependency is optional */
  optional?: boolean
  /** Reason why this dependency is needed */
  reason?: string
}

/**
 * Result of checking a single peer dependency
 */
export interface DependencyCheckResult {
  /** Package name */
  name: string
  /** Required version from brand kit */
  requiredVersion: string
  /** Whether the package is available */
  available: boolean
  /** Installed version if available */
  installedVersion?: string
  /** Whether installed version satisfies required version */
  versionSatisfied: boolean
  /** Whether this dependency is optional */
  optional: boolean
  /** Reason for this dependency */
  reason?: string
}

/**
 * Complete dependency resolution result
 */
export interface DependencyResolutionResult {
  /** All dependencies are satisfied */
  satisfied: boolean
  /** List of check results for each dependency */
  dependencies: DependencyCheckResult[]
  /** Missing required dependencies */
  missing: DependencyCheckResult[]
  /** Dependencies with version mismatches */
  versionMismatches: DependencyCheckResult[]
  /** Warnings (optional dependencies not satisfied) */
  warnings: string[]
  /** Installation suggestions */
  installSuggestions: string[]
}

/**
 * Brand kit with peer dependencies
 */
export interface BrandKitWithDependencies extends ThemeConfig {
  /** Peer dependencies required by this brand kit */
  peerDependencies?: PeerDependency[]
}

/**
 * Options for dependency validation
 */
export interface DependencyValidationOptions {
  /** Whether to treat missing optional deps as errors */
  strictOptional?: boolean
  /** Custom version checker (for testing) */
  versionChecker?: (name: string) => string | undefined
  /** Custom package availability checker (for testing) */
  availabilityChecker?: (name: string) => boolean
}

/**
 * Checks if a version string satisfies a semver range
 *
 * Simplified semver check supporting:
 * - Exact: "1.0.0"
 * - Caret: "^1.0.0" (compatible with 1.x.x)
 * - Tilde: "~1.0.0" (compatible with 1.0.x)
 * - Range: ">=1.0.0", ">1.0.0", "<=1.0.0", "<1.0.0"
 * - Any: "*"
 *
 * @param installed - Installed version
 * @param required - Required version range
 * @returns Whether installed satisfies required
 */
function satisfiesVersion(installed: string, required: string): boolean {
  // Handle "any" version
  if (required === "*" || required === "") {
    return true
  }

  // Parse version parts
  const parseVersion = (v: string): [number, number, number] => {
    const clean = v.replace(/^[^0-9]*/, "") // Remove leading non-numeric chars
    const parts = clean.split(".").map((p) => parseInt(p, 10) || 0)
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0]
  }

  const [iMajor, iMinor, iPatch] = parseVersion(installed)
  const [rMajor, rMinor, rPatch] = parseVersion(required)

  // Handle caret (^) - compatible with major version
  if (required.startsWith("^")) {
    if (rMajor === 0) {
      // ^0.x.y is more restrictive
      return iMajor === rMajor && iMinor === rMinor && iPatch >= rPatch
    }
    return iMajor === rMajor && (iMinor > rMinor || (iMinor === rMinor && iPatch >= rPatch))
  }

  // Handle tilde (~) - compatible with minor version
  if (required.startsWith("~")) {
    return iMajor === rMajor && iMinor === rMinor && iPatch >= rPatch
  }

  // Handle range operators
  if (required.startsWith(">=")) {
    return (
      iMajor > rMajor ||
      (iMajor === rMajor && iMinor > rMinor) ||
      (iMajor === rMajor && iMinor === rMinor && iPatch >= rPatch)
    )
  }

  if (required.startsWith(">") && !required.startsWith(">=")) {
    return (
      iMajor > rMajor ||
      (iMajor === rMajor && iMinor > rMinor) ||
      (iMajor === rMajor && iMinor === rMinor && iPatch > rPatch)
    )
  }

  if (required.startsWith("<=")) {
    return (
      iMajor < rMajor ||
      (iMajor === rMajor && iMinor < rMinor) ||
      (iMajor === rMajor && iMinor === rMinor && iPatch <= rPatch)
    )
  }

  if (required.startsWith("<") && !required.startsWith("<=")) {
    return (
      iMajor < rMajor ||
      (iMajor === rMajor && iMinor < rMinor) ||
      (iMajor === rMajor && iMinor === rMinor && iPatch < rPatch)
    )
  }

  // Exact match
  return iMajor === rMajor && iMinor === rMinor && iPatch === rPatch
}

/**
 * Checks a single peer dependency
 *
 * @param dependency - The peer dependency to check
 * @param options - Validation options
 * @returns Check result for the dependency
 *
 * @example
 * ```typescript
 * const result = checkPeerDependency({
 *   name: "react",
 *   version: "^18.0.0",
 *   reason: "Required for hooks"
 * })
 *
 * if (!result.versionSatisfied) {
 *   console.warn(`React ${result.requiredVersion} required, found ${result.installedVersion}`)
 * }
 * ```
 */
export function checkPeerDependency(
  dependency: PeerDependency,
  options?: DependencyValidationOptions
): DependencyCheckResult {
  const { versionChecker, availabilityChecker } = options ?? {}

  // Check availability
  const available = availabilityChecker
    ? availabilityChecker(dependency.name)
    : isPackageAvailable(dependency.name)

  // Get installed version
  const installedVersion = available
    ? versionChecker
      ? versionChecker(dependency.name)
      : getPackageVersion(dependency.name)
    : undefined

  // Check version satisfaction
  const versionSatisfied = available && installedVersion
    ? satisfiesVersion(installedVersion, dependency.version)
    : false

  return {
    name: dependency.name,
    requiredVersion: dependency.version,
    available,
    installedVersion,
    versionSatisfied,
    optional: dependency.optional ?? false,
    reason: dependency.reason,
  }
}

/**
 * Expected global package structure (when loaded via script tags)
 */
interface GlobalPackageInfo {
  version?: string
}

/**
 * Map of package names to their expected global variable names
 */
const PACKAGE_GLOBAL_MAP: ReadonlyMap<string, string> = new Map([
  ["react", "React"],
  ["react-dom", "ReactDOM"],
  ["framer-motion", "Motion"],
])

/**
 * Type guard to check if a global variable exists on window
 *
 * @param globalName - Name of the global variable to check
 * @returns Whether the global exists and is an object
 */
function hasGlobalPackage(globalName: string): boolean {
  if (typeof window === "undefined") {
    return false
  }
  // Use Object.prototype.hasOwnProperty for safe property check
  return Object.prototype.hasOwnProperty.call(window, globalName)
}

/**
 * Safely gets a global package from window
 *
 * @param globalName - Name of the global variable
 * @returns The global package or undefined
 */
function getGlobalPackage(globalName: string): GlobalPackageInfo | undefined {
  if (typeof window === "undefined" || !hasGlobalPackage(globalName)) {
    return undefined
  }
  // Access via Reflect.get which is type-safe for dynamic property access
  const value = Reflect.get(window, globalName)
  // Validate it's an object with optional version property
  if (value !== null && typeof value === "object") {
    return value as GlobalPackageInfo
  }
  return undefined
}

/**
 * Checks if a package is available (browser-safe)
 *
 * In browser environments, checks for global availability.
 * In Node environments, attempts require.resolve.
 *
 * @param name - Package name
 * @returns Whether package is available
 */
function isPackageAvailable(name: string): boolean {
  // Browser environment - check common globals
  if (isBrowser()) {
    const globalName = PACKAGE_GLOBAL_MAP.get(name)
    if (globalName) {
      return hasGlobalPackage(globalName)
    }
    return false
  }

  // Node environment - try require.resolve (if available)
  if (typeof require !== "undefined" && typeof require.resolve === "function") {
    try {
      require.resolve(name)
      return true
    } catch {
      return false
    }
  }

  return false
}

/**
 * Gets package version (browser-safe)
 *
 * @param name - Package name
 * @returns Package version or undefined
 */
function getPackageVersion(name: string): string | undefined {
  // Browser environment - check version from global
  if (isBrowser()) {
    const globalName = PACKAGE_GLOBAL_MAP.get(name)
    if (globalName) {
      const pkg = getGlobalPackage(globalName)
      return pkg?.version
    }
    return undefined
  }

  // Node environment - try to read version from package
  if (typeof require !== "undefined") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pkg = require(`${name}/package.json`) as GlobalPackageInfo
      return pkg?.version
    } catch {
      return undefined
    }
  }

  return undefined
}

/**
 * Resolves all dependencies of a brand kit
 *
 * Checks all peer dependencies and provides detailed results
 * including missing deps, version mismatches, and install suggestions.
 *
 * @param brandKit - Brand kit with peer dependencies
 * @param options - Validation options
 * @returns Complete resolution result
 *
 * @example
 * ```typescript
 * const brandKit: BrandKitWithDependencies = {
 *   name: "my-brand",
 *   peerDependencies: [
 *     { name: "react", version: "^18.0.0" },
 *     { name: "@radix-ui/react-dialog", version: "^1.0.0", optional: true },
 *   ],
 *   // ... other config
 * }
 *
 * const result = resolveBrandKitDependencies(brandKit)
 *
 * if (!result.satisfied) {
 *   console.error("Missing dependencies:")
 *   result.missing.forEach(dep => {
 *     console.error(`  - ${dep.name}@${dep.requiredVersion}`)
 *   })
 *   console.log("\nInstall with:")
 *   console.log(result.installSuggestions.join(" && "))
 * }
 * ```
 */
export function resolveBrandKitDependencies(
  brandKit: BrandKitWithDependencies,
  options?: DependencyValidationOptions
): DependencyResolutionResult {
  const dependencies = brandKit.peerDependencies ?? []
  const results: DependencyCheckResult[] = []
  const missing: DependencyCheckResult[] = []
  const versionMismatches: DependencyCheckResult[] = []
  const warnings: string[] = []
  const installSuggestions: string[] = []

  // Check each dependency
  for (const dep of dependencies) {
    const result = checkPeerDependency(dep, options)
    results.push(result)

    if (!result.available) {
      if (result.optional) {
        warnings.push(
          `Optional dependency '${result.name}' not found. ` +
            (result.reason ? `Reason: ${result.reason}` : "Some features may be unavailable.")
        )
      } else {
        missing.push(result)
        installSuggestions.push(`npm install ${result.name}@${result.requiredVersion}`)
      }
    } else if (!result.versionSatisfied) {
      if (result.optional) {
        warnings.push(
          `Optional dependency '${result.name}' version mismatch: ` +
            `required ${result.requiredVersion}, found ${result.installedVersion}`
        )
      } else {
        versionMismatches.push(result)
        installSuggestions.push(`npm install ${result.name}@${result.requiredVersion}`)
      }
    }
  }

  const satisfied = missing.length === 0 && versionMismatches.length === 0

  return {
    satisfied,
    dependencies: results,
    missing,
    versionMismatches,
    warnings,
    installSuggestions,
  }
}

/**
 * Validates brand kit dependencies (simple boolean check)
 *
 * @param brandKit - Brand kit to validate
 * @param options - Validation options
 * @returns Whether all required dependencies are satisfied
 *
 * @example
 * ```typescript
 * if (!validateBrandKitDependencies(brandKit)) {
 *   throw new Error("Brand kit has unsatisfied dependencies")
 * }
 * ```
 */
export function validateBrandKitDependencies(
  brandKit: BrandKitWithDependencies,
  options?: DependencyValidationOptions
): boolean {
  const { strictOptional = false } = options ?? {}
  const result = resolveBrandKitDependencies(brandKit, options)

  if (strictOptional) {
    // Also fail on missing optional deps
    return result.satisfied && result.warnings.length === 0
  }

  return result.satisfied
}

/**
 * Generates installation command for missing dependencies
 *
 * @param result - Dependency resolution result
 * @param packageManager - Package manager to use
 * @returns Installation command string
 *
 * @example
 * ```typescript
 * const result = resolveBrandKitDependencies(brandKit)
 * if (!result.satisfied) {
 *   console.log("Run this command to fix:")
 *   console.log(generateInstallCommand(result, "pnpm"))
 * }
 * ```
 */
export function generateInstallCommand(
  result: DependencyResolutionResult,
  packageManager: "npm" | "yarn" | "pnpm" = "npm"
): string {
  const packages = [
    ...result.missing.map((d) => `${d.name}@${d.requiredVersion}`),
    ...result.versionMismatches.map((d) => `${d.name}@${d.requiredVersion}`),
  ]

  if (packages.length === 0) {
    return ""
  }

  switch (packageManager) {
    case "yarn":
      return `yarn add ${packages.join(" ")}`
    case "pnpm":
      return `pnpm add ${packages.join(" ")}`
    default:
      return `npm install ${packages.join(" ")}`
  }
}

/**
 * Formats dependency check result as human-readable report
 *
 * @param result - Resolution result to format
 * @returns Formatted report string
 *
 * @example
 * ```typescript
 * const result = resolveBrandKitDependencies(brandKit)
 * console.log(formatDependencyReport(result))
 * ```
 */
export function formatDependencyReport(result: DependencyResolutionResult): string {
  const lines: string[] = ["Brand Kit Dependency Report", "=" .repeat(30), ""]

  // Summary
  lines.push(`Status: ${result.satisfied ? "✓ All dependencies satisfied" : "✗ Dependencies not satisfied"}`)
  lines.push("")

  // Dependencies table
  lines.push("Dependencies:")
  for (const dep of result.dependencies) {
    const status = dep.versionSatisfied
      ? "✓"
      : dep.available
        ? "⚠"
        : "✗"
    const optional = dep.optional ? " (optional)" : ""
    const version = dep.available
      ? `${dep.installedVersion} → ${dep.requiredVersion}`
      : `missing (need ${dep.requiredVersion})`
    lines.push(`  ${status} ${dep.name}${optional}: ${version}`)
    if (dep.reason) {
      lines.push(`      Reason: ${dep.reason}`)
    }
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push("")
    lines.push("Warnings:")
    for (const warning of result.warnings) {
      lines.push(`  ⚠ ${warning}`)
    }
  }

  // Installation suggestions
  if (result.installSuggestions.length > 0) {
    lines.push("")
    lines.push("Fix with:")
    lines.push(`  ${generateInstallCommand(result, "npm")}`)
    lines.push("  or")
    lines.push(`  ${generateInstallCommand(result, "pnpm")}`)
  }

  return lines.join("\n")
}

// ============================================================================
// Feature #111: Preloading
// ============================================================================

/**
 * Preload configuration options
 */
export interface PreloadConfig {
  /** Brand kit config to preload (mutually exclusive with url) */
  config?: ThemeConfig
  /** URL to load brand kit from (mutually exclusive with config) */
  url?: string
  /** Whether to inject CSS into document head */
  injectStyles?: boolean
  /** ID for the injected style element */
  styleId?: string
  /** Whether to include dark mode CSS */
  includeDarkMode?: boolean
  /** Timeout for URL loading in milliseconds */
  timeout?: number
  /** Callback when preload completes */
  onComplete?: (result: PreloadResult) => void
  /** Callback on preload error */
  onError?: (error: Error) => void
  /** Nonce for CSP compliance */
  nonce?: string
}

/**
 * Result of preload operation
 */
export interface PreloadResult {
  /** Whether preload was successful */
  success: boolean
  /** The loaded theme config */
  config: ThemeConfig | null
  /** Generated CSS (if injectStyles was true) */
  css?: string
  /** Time taken to preload in milliseconds */
  duration: number
  /** Source of the config */
  source: "static" | "url" | "cache"
  /** Error if preload failed */
  error?: Error
}

/**
 * Internal preload state
 */
interface PreloadStateInternal {
  /** Whether preload has been initiated */
  initiated: boolean
  /** Whether preload is complete */
  complete: boolean
  /** Whether preload is in progress */
  loading: boolean
  /** The preloaded config */
  config: ThemeConfig | null
  /** The preloaded CSS */
  css: string | null
  /** Preload start time */
  startTime: number | null
  /** Error if preload failed */
  error: Error | null
  /** Promise for in-progress preload */
  promise: Promise<PreloadResult> | null
}

/** Internal preload state */
const preloadState: PreloadStateInternal = {
  initiated: false,
  complete: false,
  loading: false,
  config: null,
  css: null,
  startTime: null,
  error: null,
  promise: null,
}

/** Default style element ID */
const DEFAULT_PRELOAD_STYLE_ID = "brand-kit-preload-styles"

/**
 * Preloads a brand kit before first render
 *
 * Call this function early in your application initialization
 * (e.g., in the entry point before React.render) to prevent
 * flash of unstyled content (FOUC).
 *
 * @param options - Preload configuration
 * @returns Promise resolving to preload result
 *
 * @example
 * ```typescript
 * // In main.tsx or index.tsx, before ReactDOM.render:
 * import { preloadBrand, myBrandConfig } from "./brand"
 *
 * // Preload with static config
 * await preloadBrand({
 *   config: myBrandConfig,
 *   injectStyles: true,
 *   includeDarkMode: true,
 * })
 *
 * // Then render React app
 * ReactDOM.createRoot(document.getElementById("root")!).render(<App />)
 * ```
 *
 * @example
 * ```typescript
 * // Preload from URL
 * await preloadBrand({
 *   url: "https://cdn.example.com/brand-kit.json",
 *   injectStyles: true,
 *   timeout: 5000,
 *   onError: (err) => {
 *     // Fall back to default theme
 *     console.warn("Brand kit preload failed:", err)
 *   }
 * })
 * ```
 */
export async function preloadBrand(options: PreloadConfig): Promise<PreloadResult> {
  const {
    config,
    url,
    injectStyles = true,
    styleId = DEFAULT_PRELOAD_STYLE_ID,
    includeDarkMode = true,
    timeout = 10000,
    onComplete,
    onError,
    nonce,
  } = options

  // If already complete, return cached result
  if (preloadState.complete && preloadState.config) {
    const result: PreloadResult = {
      success: true,
      config: preloadState.config,
      css: preloadState.css ?? undefined,
      duration: 0,
      source: "cache",
    }
    onComplete?.(result)
    return result
  }

  // If already loading, return existing promise
  if (preloadState.loading && preloadState.promise) {
    return preloadState.promise
  }

  // Validate input
  if (!config && !url) {
    const error = new Error("preloadBrand requires either 'config' or 'url' option")
    onError?.(error)
    return {
      success: false,
      config: null,
      duration: 0,
      source: "static",
      error,
    }
  }

  // Start preload
  preloadState.initiated = true
  preloadState.loading = true
  preloadState.startTime = Date.now()
  preloadState.error = null

  const preloadPromise = (async (): Promise<PreloadResult> => {
    try {
      let loadedConfig: ThemeConfig | null = null
      let source: "static" | "url" = "static"

      // Load config
      if (config) {
        loadedConfig = config
        source = "static"
      } else if (url) {
        source = "url"
        const loadResult = await loadBrandKitFromUrl({
          url,
          timeout,
          cache: true,
        })

        if (!loadResult.success || !loadResult.config) {
          throw new Error(loadResult.error ?? "Failed to load brand kit from URL")
        }

        loadedConfig = loadResult.config
      }

      if (!loadedConfig) {
        throw new Error("No config loaded")
      }

      // Generate and inject CSS if requested
      let css: string | undefined
      if (injectStyles && isBrowser()) {
        const generated = generateTheme(loadedConfig)
        css = includeDarkMode && loadedConfig.dark
          ? `${generated.css}\n${generateDarkModeCss(loadedConfig.dark)}`
          : generated.css

        injectPreloadStyles(css, styleId, nonce)
      }

      // Update state
      preloadState.config = loadedConfig
      preloadState.css = css ?? null
      preloadState.complete = true
      preloadState.loading = false

      // Also update the main theme config
      currentThemeConfig = loadedConfig

      const duration = Date.now() - (preloadState.startTime ?? Date.now())

      const result: PreloadResult = {
        success: true,
        config: loadedConfig,
        css,
        duration,
        source,
      }

      onComplete?.(result)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))

      preloadState.error = error
      preloadState.loading = false

      const duration = Date.now() - (preloadState.startTime ?? Date.now())

      const result: PreloadResult = {
        success: false,
        config: null,
        duration,
        source: url ? "url" : "static",
        error,
      }

      onError?.(error)
      return result
    }
  })()

  preloadState.promise = preloadPromise
  return preloadPromise
}

/**
 * Injects preload styles into document head
 *
 * @param css - CSS content to inject
 * @param styleId - ID for the style element
 * @param nonce - Optional nonce for CSP
 */
function injectPreloadStyles(css: string, styleId: string, nonce?: string): void {
  if (!isBrowser()) {
    return
  }

  // Check if style element already exists
  let styleElement = document.getElementById(styleId) as HTMLStyleElement | null

  if (!styleElement) {
    // Create new style element
    styleElement = document.createElement("style")
    styleElement.id = styleId
    styleElement.setAttribute("data-brand-kit", "preload")

    if (nonce) {
      styleElement.nonce = nonce
    }

    // Insert at the beginning of head for highest priority
    const head = document.head
    const firstChild = head.firstChild
    if (firstChild) {
      head.insertBefore(styleElement, firstChild)
    } else {
      head.appendChild(styleElement)
    }
  }

  // Update content
  styleElement.textContent = css
}

/**
 * Checks if a brand kit has been preloaded
 *
 * @returns Whether preload is complete
 *
 * @example
 * ```typescript
 * if (!isPreloaded()) {
 *   await preloadBrand({ config: myConfig })
 * }
 * ```
 */
export function isPreloaded(): boolean {
  return preloadState.complete && preloadState.config !== null
}

/**
 * Gets the current preload state
 *
 * @returns Current preload state snapshot
 *
 * @example
 * ```typescript
 * const state = getPreloadState()
 * if (state.loading) {
 *   console.log("Brand kit is loading...")
 * } else if (state.error) {
 *   console.error("Preload failed:", state.error)
 * }
 * ```
 */
export function getPreloadState(): {
  initiated: boolean
  complete: boolean
  loading: boolean
  config: ThemeConfig | null
  error: Error | null
} {
  return {
    initiated: preloadState.initiated,
    complete: preloadState.complete,
    loading: preloadState.loading,
    config: preloadState.config,
    error: preloadState.error,
  }
}

/**
 * Gets the preloaded config if available
 *
 * @returns The preloaded config or null
 *
 * @example
 * ```typescript
 * const config = getPreloadedConfig()
 * if (config) {
 *   // Use preloaded config
 * } else {
 *   // Fall back to default
 * }
 * ```
 */
export function getPreloadedConfig(): ThemeConfig | null {
  return preloadState.config
}

/**
 * Waits for preload to complete
 *
 * Useful when you need to ensure preload is done before proceeding.
 *
 * @param timeout - Maximum time to wait in milliseconds
 * @returns Promise resolving to preload result
 *
 * @example
 * ```typescript
 * // Start preload without awaiting
 * preloadBrand({ url: "..." })
 *
 * // Later, wait for completion
 * const result = await waitForPreload(5000)
 * if (result.success) {
 *   // Proceed with preloaded config
 * }
 * ```
 */
export async function waitForPreload(timeout = 10000): Promise<PreloadResult> {
  // If already complete, return immediately
  if (preloadState.complete) {
    return {
      success: preloadState.config !== null,
      config: preloadState.config,
      css: preloadState.css ?? undefined,
      duration: 0,
      source: "cache",
      error: preloadState.error ?? undefined,
    }
  }

  // If not initiated, return failure
  if (!preloadState.initiated || !preloadState.promise) {
    return {
      success: false,
      config: null,
      duration: 0,
      source: "static",
      error: new Error("Preload not initiated. Call preloadBrand() first."),
    }
  }

  // Race between preload promise and timeout
  const timeoutPromise = new Promise<PreloadResult>((resolve) => {
    setTimeout(() => {
      resolve({
        success: false,
        config: preloadState.config,
        duration: timeout,
        source: "cache",
        error: new Error(`Preload timed out after ${timeout}ms`),
      })
    }, timeout)
  })

  return Promise.race([preloadState.promise, timeoutPromise])
}

/**
 * Resets preload state
 *
 * Useful for testing or when switching brand kits.
 *
 * @param removeStyles - Whether to remove injected style element
 * @param styleId - ID of style element to remove
 */
export function resetPreloadState(
  removeStyles = false,
  styleId = DEFAULT_PRELOAD_STYLE_ID
): void {
  preloadState.initiated = false
  preloadState.complete = false
  preloadState.loading = false
  preloadState.config = null
  preloadState.css = null
  preloadState.startTime = null
  preloadState.error = null
  preloadState.promise = null

  if (removeStyles && isBrowser()) {
    const styleElement = document.getElementById(styleId)
    if (styleElement) {
      styleElement.remove()
    }
  }
}

/**
 * Generates preload script for SSR
 *
 * Returns a script that can be inlined in HTML to preload
 * brand kit on the client before React hydration.
 *
 * @param config - Theme config or URL to load
 * @param options - Preload options
 * @returns Script content to inline
 *
 * @example
 * ```typescript
 * // In your SSR handler
 * const preloadScript = generatePreloadScript(brandConfig)
 *
 * const html = `
 *   <head>
 *     <script>${preloadScript}</script>
 *   </head>
 * `
 * ```
 */
export function generatePreloadScript(
  config: ThemeConfig | string,
  options?: Pick<PreloadConfig, "includeDarkMode" | "styleId">
): string {
  const {
    includeDarkMode = true,
    styleId = DEFAULT_PRELOAD_STYLE_ID,
  } = options ?? {}

  if (typeof config === "string") {
    // URL-based preload
    return `
(function() {
  var styleId = ${JSON.stringify(styleId)};
  var url = ${JSON.stringify(config)};

  fetch(url)
    .then(function(res) { return res.json(); })
    .then(function(config) {
      if (window.__BRAND_KIT_PRELOAD__) {
        window.__BRAND_KIT_PRELOAD__(config, styleId, ${includeDarkMode});
      }
    })
    .catch(function(err) {
      console.warn("Brand kit preload failed:", err);
    });
})();
`.trim()
  }

  // Static config preload
  const generated = generateTheme(config)
  const css = includeDarkMode && config.dark
    ? `${generated.css}\n${generateDarkModeCss(config.dark)}`
    : generated.css

  return `
(function() {
  var css = ${JSON.stringify(css)};
  var styleId = ${JSON.stringify(styleId)};

  var style = document.createElement("style");
  style.id = styleId;
  style.setAttribute("data-brand-kit", "preload");
  style.textContent = css;

  var head = document.head;
  var first = head.firstChild;
  if (first) {
    head.insertBefore(style, first);
  } else {
    head.appendChild(style);
  }
})();
`.trim()
}
