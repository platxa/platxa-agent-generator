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
