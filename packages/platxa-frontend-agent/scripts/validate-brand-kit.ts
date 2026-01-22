#!/usr/bin/env npx tsx
/**
 * Brand Kit Validation Script
 *
 * Validates brand kit configurations for:
 * - Schema compliance (required tokens, valid values)
 * - Color accessibility (WCAG 2.1 contrast ratios)
 * - Token completeness (all semantic colors defined)
 * - Dark mode consistency (proper overrides)
 *
 * @example
 * ```bash
 * # Run locally with verbose output
 * npx tsx scripts/validate-brand-kit.ts --verbose
 *
 * # Run in CI mode (machine-readable output)
 * npx tsx scripts/validate-brand-kit.ts --ci
 *
 * # Validate specific file
 * npx tsx scripts/validate-brand-kit.ts --file ./brand-kit.json
 * ```
 *
 * @module scripts/validate-brand-kit
 */

import * as fs from "fs"
import * as path from "path"
import { glob } from "glob"

// =============================================================================
// TYPES
// =============================================================================

interface ValidationResult {
  file: string
  passed: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  score: number
  details: ValidationDetails
}

interface ValidationError {
  code: string
  message: string
  path?: string
  severity: "error"
}

interface ValidationWarning {
  code: string
  message: string
  path?: string
  severity: "warning"
}

interface ValidationDetails {
  schemaValid: boolean
  colorsValid: boolean
  accessibilityScore: number
  completenessScore: number
  darkModeValid: boolean
}

interface ColorValue {
  r: number
  g: number
  b: number
}

interface ThemeConfig {
  name: string
  light: {
    colors: Record<string, string>
    spacing?: Record<string, string>
    typography?: Record<string, unknown>
    radius?: Record<string, string>
    shadow?: Record<string, string>
  }
  dark?: Record<string, string>
  extends?: string | ThemeConfig
}

// =============================================================================
// CONSTANTS
// =============================================================================

const REQUIRED_SEMANTIC_COLORS = [
  "primary",
  "primaryForeground",
  "secondary",
  "secondaryForeground",
  "background",
  "foreground",
  "muted",
  "mutedForeground",
  "accent",
  "accentForeground",
  "destructive",
  "destructiveForeground",
  "border",
  "input",
  "ring",
  "card",
  "cardForeground",
  "popover",
  "popoverForeground",
]

const WCAG_CONTRAST_RATIOS = {
  AA_LARGE: 3.0,
  AA_NORMAL: 4.5,
  AAA_LARGE: 4.5,
  AAA_NORMAL: 7.0,
}

// Foreground/background pairs to check for contrast
const CONTRAST_PAIRS = [
  ["foreground", "background"],
  ["primaryForeground", "primary"],
  ["secondaryForeground", "secondary"],
  ["mutedForeground", "muted"],
  ["accentForeground", "accent"],
  ["destructiveForeground", "destructive"],
  ["cardForeground", "card"],
  ["popoverForeground", "popover"],
]

// =============================================================================
// COLOR UTILITIES
// =============================================================================

/**
 * Parse a color string to RGB values
 */
function parseColor(color: string): ColorValue | null {
  const trimmed = color.trim().toLowerCase()

  // Hex color
  const hexMatch = trimmed.match(/^#([0-9a-f]{3,8})$/i)
  if (hexMatch) {
    const hex = hexMatch[1]
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      }
    }
    if (hex.length >= 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      }
    }
  }

  // RGB/RGBA
  const rgbMatch = trimmed.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/
  )
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    }
  }

  // HSL (basic conversion)
  const hslMatch = trimmed.match(
    /^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/
  )
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]) / 360
    const s = parseFloat(hslMatch[2]) / 100
    const l = parseFloat(hslMatch[3]) / 100
    return hslToRgb(h, s, l)
  }

  // OKLCH (approximate conversion)
  const oklchMatch = trimmed.match(
    /^oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/
  )
  if (oklchMatch) {
    const L = parseFloat(oklchMatch[1])
    const normalizedL = L > 1 ? L / 100 : L
    // Simplified OKLCH to RGB (approximate)
    const gray = Math.round(normalizedL * 255)
    return { r: gray, g: gray, b: gray }
  }

  return null
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): ColorValue {
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
  }
}

/**
 * Calculate relative luminance (WCAG 2.1)
 */
function getLuminance(color: ColorValue): number {
  const rsRGB = color.r / 255
  const gsRGB = color.g / 255
  const bsRGB = color.b / 255

  const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4)
  const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4)
  const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4)

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Calculate contrast ratio between two colors
 */
function getContrastRatio(color1: ColorValue, color2: ColorValue): number {
  const l1 = getLuminance(color1)
  const l2 = getLuminance(color2)

  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  return (lighter + 0.05) / (darker + 0.05)
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate schema compliance
 */
function validateSchema(config: unknown): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = []

  if (typeof config !== "object" || config === null) {
    errors.push({
      code: "INVALID_CONFIG",
      message: "Configuration must be an object",
      severity: "error",
    })
    return { valid: false, errors }
  }

  const cfg = config as Record<string, unknown>

  // Check required fields
  if (typeof cfg.name !== "string" || cfg.name.length === 0) {
    errors.push({
      code: "MISSING_NAME",
      message: "Theme name is required",
      path: "name",
      severity: "error",
    })
  }

  if (typeof cfg.light !== "object" || cfg.light === null) {
    errors.push({
      code: "MISSING_LIGHT",
      message: "Light theme configuration is required",
      path: "light",
      severity: "error",
    })
    return { valid: false, errors }
  }

  const light = cfg.light as Record<string, unknown>

  if (typeof light.colors !== "object" || light.colors === null) {
    errors.push({
      code: "MISSING_COLORS",
      message: "Light theme colors are required",
      path: "light.colors",
      severity: "error",
    })
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validate color completeness
 */
function validateColorCompleteness(
  colors: Record<string, string>
): { score: number; errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  let definedCount = 0

  for (const colorName of REQUIRED_SEMANTIC_COLORS) {
    if (colors[colorName]) {
      definedCount++
    } else {
      // Core colors are errors, others are warnings
      const isCoreColor = [
        "primary",
        "background",
        "foreground",
        "border",
      ].includes(colorName)

      if (isCoreColor) {
        errors.push({
          code: "MISSING_COLOR",
          message: `Required color "${colorName}" is not defined`,
          path: `light.colors.${colorName}`,
          severity: "error",
        })
      } else {
        warnings.push({
          code: "MISSING_COLOR",
          message: `Recommended color "${colorName}" is not defined`,
          path: `light.colors.${colorName}`,
          severity: "warning",
        })
      }
    }
  }

  const score = (definedCount / REQUIRED_SEMANTIC_COLORS.length) * 100
  return { score, errors, warnings }
}

/**
 * Validate color accessibility
 */
function validateAccessibility(
  colors: Record<string, string>
): { score: number; errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  let passedChecks = 0
  let totalChecks = 0

  for (const [fgName, bgName] of CONTRAST_PAIRS) {
    const fgColor = colors[fgName]
    const bgColor = colors[bgName]

    if (!fgColor || !bgColor) {
      continue
    }

    totalChecks++
    const fg = parseColor(fgColor)
    const bg = parseColor(bgColor)

    if (!fg || !bg) {
      warnings.push({
        code: "UNPARSEABLE_COLOR",
        message: `Could not parse color for contrast check: ${fgName}/${bgName}`,
        severity: "warning",
      })
      continue
    }

    const ratio = getContrastRatio(fg, bg)

    if (ratio >= WCAG_CONTRAST_RATIOS.AA_NORMAL) {
      passedChecks++
    } else if (ratio >= WCAG_CONTRAST_RATIOS.AA_LARGE) {
      warnings.push({
        code: "LOW_CONTRAST",
        message: `Contrast ratio ${ratio.toFixed(2)}:1 for ${fgName}/${bgName} only meets AA for large text`,
        path: `light.colors.${fgName}`,
        severity: "warning",
      })
      passedChecks += 0.5
    } else {
      errors.push({
        code: "INSUFFICIENT_CONTRAST",
        message: `Contrast ratio ${ratio.toFixed(2)}:1 for ${fgName}/${bgName} fails WCAG AA (needs 4.5:1)`,
        path: `light.colors.${fgName}`,
        severity: "error",
      })
    }
  }

  const score = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 100
  return { score, errors, warnings }
}

/**
 * Validate dark mode configuration
 */
function validateDarkMode(
  config: ThemeConfig
): { valid: boolean; warnings: ValidationWarning[] } {
  const warnings: ValidationWarning[] = []

  if (!config.dark) {
    warnings.push({
      code: "NO_DARK_MODE",
      message: "No dark mode configuration provided",
      severity: "warning",
    })
    return { valid: true, warnings }
  }

  // Check that dark mode overrides key colors
  const darkColors = Object.keys(config.dark)
  const keyColors = ["background", "foreground", "primary", "card"]

  for (const color of keyColors) {
    if (!darkColors.includes(color)) {
      warnings.push({
        code: "MISSING_DARK_COLOR",
        message: `Dark mode should override "${color}" for proper theming`,
        path: `dark.${color}`,
        severity: "warning",
      })
    }
  }

  return { valid: true, warnings }
}

/**
 * Validate a single brand kit configuration
 */
function validateBrandKit(config: unknown, filePath: string): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  // Schema validation
  const schemaResult = validateSchema(config)
  errors.push(...schemaResult.errors)

  if (!schemaResult.valid) {
    return {
      file: filePath,
      passed: false,
      errors,
      warnings,
      score: 0,
      details: {
        schemaValid: false,
        colorsValid: false,
        accessibilityScore: 0,
        completenessScore: 0,
        darkModeValid: false,
      },
    }
  }

  const themeConfig = config as ThemeConfig
  const colors = themeConfig.light.colors

  // Color completeness
  const completenessResult = validateColorCompleteness(colors)
  errors.push(...completenessResult.errors)
  warnings.push(...completenessResult.warnings)

  // Accessibility
  const accessibilityResult = validateAccessibility(colors)
  errors.push(...accessibilityResult.errors)
  warnings.push(...accessibilityResult.warnings)

  // Dark mode
  const darkModeResult = validateDarkMode(themeConfig)
  warnings.push(...darkModeResult.warnings)

  // Calculate overall score
  const errorPenalty = errors.length * 10
  const warningPenalty = warnings.length * 2
  const baseScore =
    (completenessResult.score * 0.4) +
    (accessibilityResult.score * 0.4) +
    (darkModeResult.valid ? 20 : 0)
  const finalScore = Math.max(0, baseScore - errorPenalty - warningPenalty)

  return {
    file: filePath,
    passed: errors.length === 0 && finalScore >= 70,
    errors,
    warnings,
    score: Math.round(finalScore),
    details: {
      schemaValid: schemaResult.valid,
      colorsValid: completenessResult.errors.length === 0,
      accessibilityScore: Math.round(accessibilityResult.score),
      completenessScore: Math.round(completenessResult.score),
      darkModeValid: darkModeResult.valid,
    },
  }
}

// =============================================================================
// CLI
// =============================================================================

interface CLIOptions {
  verbose: boolean
  ci: boolean
  file?: string
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2)
  return {
    verbose: args.includes("--verbose") || args.includes("-v"),
    ci: args.includes("--ci"),
    file: args.find((a) => a.startsWith("--file="))?.split("=")[1],
  }
}

async function findBrandKitFiles(): Promise<string[]> {
  const patterns = [
    "**/brand-kit*.json",
    "**/theme*.json",
    "**/tokens*.json",
    "**/*.brand.json",
    "**/*.theme.json",
  ]

  const files: string[] = []

  for (const pattern of patterns) {
    const matches = await glob(pattern, {
      cwd: process.cwd(),
      ignore: ["**/node_modules/**", "**/dist/**", "**/build/**"],
    })
    files.push(...matches)
  }

  return [...new Set(files)]
}

function printResult(result: ValidationResult, verbose: boolean): void {
  const status = result.passed ? "✓" : "✗"
  const statusColor = result.passed ? "\x1b[32m" : "\x1b[31m"
  const reset = "\x1b[0m"

  console.log(`${statusColor}${status}${reset} ${result.file} (Score: ${result.score}/100)`)

  if (verbose || !result.passed) {
    if (result.errors.length > 0) {
      console.log("  Errors:")
      for (const error of result.errors) {
        console.log(`    ✗ [${error.code}] ${error.message}`)
        if (error.path) {
          console.log(`      at: ${error.path}`)
        }
      }
    }

    if (result.warnings.length > 0 && verbose) {
      console.log("  Warnings:")
      for (const warning of result.warnings) {
        console.log(`    ⚠ [${warning.code}] ${warning.message}`)
        if (warning.path) {
          console.log(`      at: ${warning.path}`)
        }
      }
    }

    if (verbose) {
      console.log("  Details:")
      console.log(`    Schema valid:       ${result.details.schemaValid ? "Yes" : "No"}`)
      console.log(`    Colors valid:       ${result.details.colorsValid ? "Yes" : "No"}`)
      console.log(`    Accessibility:      ${result.details.accessibilityScore}%`)
      console.log(`    Completeness:       ${result.details.completenessScore}%`)
      console.log(`    Dark mode valid:    ${result.details.darkModeValid ? "Yes" : "No"}`)
    }
  }
}

function printCIOutput(results: ValidationResult[]): void {
  const output = {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results: results.map((r) => ({
      file: r.file,
      passed: r.passed,
      score: r.score,
      errorCount: r.errors.length,
      warningCount: r.warnings.length,
    })),
  }

  console.log(JSON.stringify(output, null, 2))
}

async function main(): Promise<void> {
  const options = parseArgs()

  console.log("╔══════════════════════════════════════════════════════════════════╗")
  console.log("║  Platxa Brand Kit Validator                                      ║")
  console.log("╚══════════════════════════════════════════════════════════════════╝")
  console.log("")

  // Find files to validate
  let files: string[]

  if (options.file) {
    files = [options.file]
  } else {
    files = await findBrandKitFiles()
  }

  if (files.length === 0) {
    console.log("No brand kit files found to validate.")
    console.log("Looking for: **/brand-kit*.json, **/theme*.json, **/tokens*.json")
    console.log("")
    console.log("To create a brand kit, create a JSON file with ThemeConfig schema.")
    process.exit(0)
  }

  console.log(`Found ${files.length} brand kit file(s) to validate\n`)

  // Validate each file
  const results: ValidationResult[] = []

  for (const file of files) {
    const filePath = path.resolve(process.cwd(), file)

    try {
      const content = fs.readFileSync(filePath, "utf-8")
      const config = JSON.parse(content)
      const result = validateBrandKit(config, file)
      results.push(result)

      if (!options.ci) {
        printResult(result, options.verbose)
        console.log("")
      }
    } catch (error) {
      const result: ValidationResult = {
        file,
        passed: false,
        errors: [
          {
            code: "PARSE_ERROR",
            message: error instanceof Error ? error.message : "Failed to parse file",
            severity: "error",
          },
        ],
        warnings: [],
        score: 0,
        details: {
          schemaValid: false,
          colorsValid: false,
          accessibilityScore: 0,
          completenessScore: 0,
          darkModeValid: false,
        },
      }
      results.push(result)

      if (!options.ci) {
        printResult(result, options.verbose)
        console.log("")
      }
    }
  }

  // Print CI output
  if (options.ci) {
    printCIOutput(results)
  }

  // Summary
  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length

  if (!options.ci) {
    console.log("═══════════════════════════════════════════════════════════════════")
    console.log("Summary")
    console.log("───────────────────────────────────────────────────────────────────")
    console.log(`  Total:         ${results.length}`)
    console.log(`  Passed:        \x1b[32m${passed}\x1b[0m`)
    console.log(`  Failed:        \x1b[31m${failed}\x1b[0m`)
    console.log(`  Average Score: ${Math.round(avgScore)}/100`)
    console.log("")
  }

  // Exit with error if any failed
  if (failed > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error("Validation failed:", error)
  process.exit(1)
})
