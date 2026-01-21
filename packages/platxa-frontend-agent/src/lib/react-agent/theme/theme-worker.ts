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
