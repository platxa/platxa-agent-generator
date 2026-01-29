#!/usr/bin/env node
/**
 * CLI Brand Validate Command (Feature #76)
 *
 * Validates brand kit structure against schema.
 *
 * @example
 * ```bash
 * npx @platxa/frontend-agent validate ./my-brand-kit
 * # or
 * platxa-validate @acme/brand-kit
 * ```
 *
 * @module cli/validate
 */

import * as fs from "node:fs"
import * as path from "node:path"

// =============================================================================
// TYPES
// =============================================================================

interface ValidationReport {
  /** Package/path being validated */
  source: string
  /** Overall validation status */
  valid: boolean
  /** Schema validation results */
  schema: {
    valid: boolean
    errors: string[]
    warnings: string[]
    missingRequired: string[]
    missingOptional: string[]
  }
  /** Color contrast validation results */
  contrast: {
    lightMode: ContrastCheckResult[]
    darkMode: ContrastCheckResult[]
    passesAA: boolean
    passesAAA: boolean
  }
  /** Summary statistics */
  summary: {
    errorCount: number
    warningCount: number
    contrastIssues: number
  }
}

interface ContrastCheckResult {
  pair: string
  ratio: number
  passesAA: boolean
  passesAAA: boolean
  recommendation?: string
}

interface BrandKitExport {
  meta: {
    name: string
    version: string
    description?: string
    author?: string
  }
  primitives: {
    primary: Record<number, string>
    accent: Record<number, string>
    neutral: Record<number, string>
  }
  semantics: {
    light: SemanticColors
    dark: SemanticColors
  }
  typography?: unknown
  spacing?: unknown
  radius?: unknown
  shadow?: unknown
  css?: string
  tailwindPreset?: unknown
}

interface SemanticColors {
  background: string
  foreground: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  destructive: string
  destructiveForeground: string
  border: string
  input: string
  ring: string
  card?: string
  cardForeground?: string
  popover?: string
  popoverForeground?: string
}

interface BrandKitValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  missingRequired: string[]
  missingOptional: string[]
}

// =============================================================================
// SCHEMA VALIDATION
// =============================================================================

/**
 * Validate semantic color object structure
 */
function validateSemanticColorsSchema(
  colors: unknown,
  mode: string,
  warnings: string[]
): void {
  if (!colors || typeof colors !== "object") return

  const c = colors as Record<string, unknown>
  const required = [
    "background",
    "foreground",
    "primary",
    "primaryForeground",
    "secondary",
    "secondaryForeground",
    "muted",
    "mutedForeground",
    "accent",
    "accentForeground",
    "destructive",
    "destructiveForeground",
    "border",
    "input",
    "ring",
  ]

  for (const key of required) {
    if (c[key] === undefined) {
      warnings.push(`semantics.${mode}.${key} is recommended`)
    }
  }
}

/**
 * Validate brand kit structure against schema
 */
function validateBrandKitSchema(brandKit: unknown): BrandKitValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const missingRequired: string[] = []
  const missingOptional: string[] = []

  // Check base type
  if (!brandKit || typeof brandKit !== "object") {
    errors.push("Brand kit must be an object")
    return { valid: false, errors, warnings, missingRequired, missingOptional }
  }

  const kit = brandKit as Record<string, unknown>

  // ==========================================================================
  // REQUIRED: meta
  // ==========================================================================
  if (!kit.meta || typeof kit.meta !== "object") {
    errors.push("Brand kit must export 'meta' object")
    missingRequired.push("meta")
  } else {
    const meta = kit.meta as Record<string, unknown>

    if (typeof meta.name !== "string" || !meta.name) {
      errors.push("meta.name is required and must be a non-empty string")
      missingRequired.push("meta.name")
    }

    if (typeof meta.version !== "string" || !meta.version) {
      errors.push("meta.version is required and must be a non-empty string")
      missingRequired.push("meta.version")
    } else if (!/^\d+\.\d+\.\d+/.test(meta.version as string)) {
      warnings.push("meta.version should follow semver format (e.g., '1.0.0')")
    }

    if (meta.description === undefined) {
      missingOptional.push("meta.description")
    }
    if (meta.author === undefined) {
      missingOptional.push("meta.author")
    }
  }

  // ==========================================================================
  // REQUIRED: primitives
  // ==========================================================================
  if (!kit.primitives || typeof kit.primitives !== "object") {
    errors.push("Brand kit must export 'primitives' object with color scales")
    missingRequired.push("primitives")
  } else {
    const primitives = kit.primitives as Record<string, unknown>

    for (const scale of ["primary", "accent", "neutral"] as const) {
      if (!primitives[scale] || typeof primitives[scale] !== "object") {
        errors.push(`primitives.${scale} is required (12-step color scale)`)
        missingRequired.push(`primitives.${scale}`)
      } else {
        const colorScale = primitives[scale] as Record<string | number, unknown>
        const steps = Object.keys(colorScale)
          .map(Number)
          .filter((n) => !isNaN(n))
        if (steps.length < 12) {
          warnings.push(
            `primitives.${scale} has ${steps.length} steps (recommended: 12)`
          )
        }
      }
    }
  }

  // ==========================================================================
  // REQUIRED: semantics
  // ==========================================================================
  if (!kit.semantics || typeof kit.semantics !== "object") {
    errors.push(
      "Brand kit must export 'semantics' object with light/dark colors"
    )
    missingRequired.push("semantics")
  } else {
    const semantics = kit.semantics as Record<string, unknown>

    if (!semantics.light || typeof semantics.light !== "object") {
      errors.push("semantics.light is required")
      missingRequired.push("semantics.light")
    } else {
      validateSemanticColorsSchema(semantics.light, "light", warnings)
    }

    if (!semantics.dark || typeof semantics.dark !== "object") {
      errors.push("semantics.dark is required")
      missingRequired.push("semantics.dark")
    } else {
      validateSemanticColorsSchema(semantics.dark, "dark", warnings)
    }
  }

  // ==========================================================================
  // OPTIONAL fields
  // ==========================================================================
  if (kit.typography === undefined) {
    missingOptional.push("typography")
  }
  if (kit.spacing === undefined) {
    missingOptional.push("spacing")
  }
  if (kit.radius === undefined) {
    missingOptional.push("radius")
  }
  if (kit.shadow === undefined) {
    missingOptional.push("shadow")
  }
  if (kit.tailwindPreset === undefined) {
    missingOptional.push("tailwindPreset")
  }
  if (kit.css === undefined) {
    missingOptional.push("css")
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    missingRequired,
    missingOptional,
  }
}

// =============================================================================
// COLOR CONTRAST VALIDATION
// =============================================================================

/**
 * Parse color string to RGB values
 */
function parseColorToRgb(
  color: string
): { r: number; g: number; b: number } | null {
  // Handle hex colors
  const hexMatch = color.match(/^#([0-9a-f]{6})$/i)
  if (hexMatch) {
    const hex = hexMatch[1]
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    }
  }

  // Handle rgb/rgba
  const rgbMatch = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    }
  }

  // Handle hsl/hsla
  const hslMatch = color.match(/^hsla?\((\d+),\s*([\d.]+)%,\s*([\d.]+)%/)
  if (hslMatch) {
    const h = parseInt(hslMatch[1], 10) / 360
    const s = parseFloat(hslMatch[2]) / 100
    const l = parseFloat(hslMatch[3]) / 100
    return hslToRgb(h, s, l)
  }

  // Handle oklch
  const oklchMatch = color.match(
    /^oklch\(([\d.]+)(?:%?)\s+([\d.]+)\s+([\d.]+)/
  )
  if (oklchMatch) {
    // Approximate OKLCH to RGB (simplified conversion)
    const L = parseFloat(oklchMatch[1])
    const lightness = L > 1 ? L / 100 : L // Handle both 0-1 and 0-100
    // Rough approximation: treat L as grayscale
    const gray = Math.round(lightness * 255)
    return { r: gray, g: gray, b: gray }
  }

  return null
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
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
 * Calculate relative luminance per WCAG 2.1
 */
function getRelativeLuminance(rgb: {
  r: number
  g: number
  b: number
}): number {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const srgb = c / 255
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Calculate contrast ratio between two colors
 */
function calculateContrastRatio(color1: string, color2: string): number | null {
  const rgb1 = parseColorToRgb(color1)
  const rgb2 = parseColorToRgb(color2)

  if (!rgb1 || !rgb2) return null

  const l1 = getRelativeLuminance(rgb1)
  const l2 = getRelativeLuminance(rgb2)

  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * WCAG contrast thresholds
 */
const WCAG_THRESHOLDS = {
  AA_NORMAL: 4.5,
  AA_LARGE: 3.0,
  AAA_NORMAL: 7.0,
  AAA_LARGE: 4.5,
}

/**
 * Check contrast for semantic color pairs
 */
function checkSemanticContrast(colors: SemanticColors): ContrastCheckResult[] {
  const pairs: Array<{
    name: string
    fg: keyof SemanticColors
    bg: keyof SemanticColors
  }> = [
    { name: "foreground/background", fg: "foreground", bg: "background" },
    {
      name: "primary/primaryForeground",
      fg: "primaryForeground",
      bg: "primary",
    },
    {
      name: "secondary/secondaryForeground",
      fg: "secondaryForeground",
      bg: "secondary",
    },
    { name: "muted/mutedForeground", fg: "mutedForeground", bg: "muted" },
    { name: "accent/accentForeground", fg: "accentForeground", bg: "accent" },
    {
      name: "destructive/destructiveForeground",
      fg: "destructiveForeground",
      bg: "destructive",
    },
  ]

  const results: ContrastCheckResult[] = []

  for (const { name, fg, bg } of pairs) {
    const fgColor = colors[fg]
    const bgColor = colors[bg]

    if (!fgColor || !bgColor) continue

    const ratio = calculateContrastRatio(fgColor, bgColor)

    if (ratio === null) {
      results.push({
        pair: name,
        ratio: 0,
        passesAA: false,
        passesAAA: false,
        recommendation: `Could not parse colors: ${fg}=${fgColor}, ${bg}=${bgColor}`,
      })
      continue
    }

    const passesAA = ratio >= WCAG_THRESHOLDS.AA_NORMAL
    const passesAAA = ratio >= WCAG_THRESHOLDS.AAA_NORMAL

    const result: ContrastCheckResult = {
      pair: name,
      ratio: Math.round(ratio * 100) / 100,
      passesAA,
      passesAAA,
    }

    if (!passesAA) {
      result.recommendation = `Increase contrast to at least ${WCAG_THRESHOLDS.AA_NORMAL}:1 for WCAG AA`
    } else if (!passesAAA) {
      result.recommendation = `Consider increasing to ${WCAG_THRESHOLDS.AAA_NORMAL}:1 for WCAG AAA`
    }

    results.push(result)
  }

  return results
}

// =============================================================================
// BRAND KIT LOADING
// =============================================================================

/**
 * Load brand kit from package name or file path
 */
async function loadBrandKit(source: string): Promise<BrandKitExport | null> {
  // Check if it's a file path
  const isPath =
    source.startsWith("./") ||
    source.startsWith("/") ||
    source.startsWith("../")

  if (isPath) {
    // Load from file path
    const resolvedPath = path.resolve(process.cwd(), source)

    // Check for package.json in directory
    const pkgJsonPath = path.join(resolvedPath, "package.json")
    if (fs.existsSync(pkgJsonPath)) {
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"))
      const main = pkgJson.main || "index.js"
      const entryPath = path.join(resolvedPath, main)

      if (fs.existsSync(entryPath)) {
        try {
          const mod = await import(entryPath)
          return mod.default || mod
        } catch {
          // Try reading as JSON
          const content = fs.readFileSync(entryPath, "utf-8")
          return JSON.parse(content)
        }
      }
    }

    // Check for index.js or brand-kit.json
    for (const filename of [
      "index.js",
      "index.mjs",
      "brand-kit.json",
      "brand.json",
    ]) {
      const filePath = path.join(resolvedPath, filename)
      if (fs.existsSync(filePath)) {
        if (filename.endsWith(".json")) {
          const content = fs.readFileSync(filePath, "utf-8")
          return JSON.parse(content)
        } else {
          const mod = await import(filePath)
          return mod.default || mod
        }
      }
    }

    // Try as direct file
    if (fs.existsSync(resolvedPath)) {
      if (resolvedPath.endsWith(".json")) {
        const content = fs.readFileSync(resolvedPath, "utf-8")
        return JSON.parse(content)
      } else {
        const mod = await import(resolvedPath)
        return mod.default || mod
      }
    }

    return null
  }

  // Load from npm package
  try {
    const mod = await import(source)
    return mod.default || mod
  } catch {
    return null
  }
}

// =============================================================================
// REPORT GENERATION
// =============================================================================

/**
 * Generate validation report
 */
function generateReport(
  source: string,
  brandKit: BrandKitExport | null,
  schemaResult: BrandKitValidationResult
): ValidationReport {
  const report: ValidationReport = {
    source,
    valid: schemaResult.valid,
    schema: schemaResult,
    contrast: {
      lightMode: [],
      darkMode: [],
      passesAA: true,
      passesAAA: true,
    },
    summary: {
      errorCount: schemaResult.errors.length,
      warningCount: schemaResult.warnings.length,
      contrastIssues: 0,
    },
  }

  // Check contrast if semantics are available
  if (brandKit?.semantics?.light) {
    report.contrast.lightMode = checkSemanticContrast(brandKit.semantics.light)
    const lightIssues = report.contrast.lightMode.filter((r) => !r.passesAA)
    report.summary.contrastIssues += lightIssues.length
    if (lightIssues.length > 0) {
      report.contrast.passesAA = false
    }
    const lightAAAIssues = report.contrast.lightMode.filter(
      (r) => !r.passesAAA
    )
    if (lightAAAIssues.length > 0) {
      report.contrast.passesAAA = false
    }
  }

  if (brandKit?.semantics?.dark) {
    report.contrast.darkMode = checkSemanticContrast(brandKit.semantics.dark)
    const darkIssues = report.contrast.darkMode.filter((r) => !r.passesAA)
    report.summary.contrastIssues += darkIssues.length
    if (darkIssues.length > 0) {
      report.contrast.passesAA = false
    }
    const darkAAAIssues = report.contrast.darkMode.filter((r) => !r.passesAAA)
    if (darkAAAIssues.length > 0) {
      report.contrast.passesAAA = false
    }
  }

  // Update overall validity
  report.valid = schemaResult.valid && report.contrast.passesAA

  return report
}

/**
 * Print report to console
 */
function printReport(report: ValidationReport, verbose: boolean): void {
  console.log("\n" + "=".repeat(60))
  console.log("Brand Kit Validation Report")
  console.log("=".repeat(60))
  console.log(`\nSource: ${report.source}`)
  console.log(
    `Status: ${report.valid ? "✅ VALID" : "❌ INVALID"}`
  )

  // Schema validation
  console.log("\n--- Schema Validation ---")
  if (report.schema.errors.length > 0) {
    console.log("\n❌ Errors:")
    report.schema.errors.forEach((e) => console.log(`   • ${e}`))
  }

  if (report.schema.warnings.length > 0) {
    console.log("\n⚠️  Warnings:")
    report.schema.warnings.forEach((w) => console.log(`   • ${w}`))
  }

  if (report.schema.missingRequired.length > 0) {
    console.log("\n🔴 Missing Required Fields:")
    report.schema.missingRequired.forEach((f) => console.log(`   • ${f}`))
  }

  if (verbose && report.schema.missingOptional.length > 0) {
    console.log("\n🔵 Missing Optional Fields:")
    report.schema.missingOptional.forEach((f) => console.log(`   • ${f}`))
  }

  // Contrast validation
  console.log("\n--- Color Contrast (WCAG 2.1) ---")
  console.log(
    `AA Compliance: ${report.contrast.passesAA ? "✅ Pass" : "❌ Fail"}`
  )
  console.log(
    `AAA Compliance: ${report.contrast.passesAAA ? "✅ Pass" : "⚠️  Fail"}`
  )

  if (report.contrast.lightMode.length > 0) {
    console.log("\n  Light Mode:")
    for (const check of report.contrast.lightMode) {
      const status = check.passesAA ? "✅" : "❌"
      console.log(`    ${status} ${check.pair}: ${check.ratio}:1`)
      if (check.recommendation && (verbose || !check.passesAA)) {
        console.log(`       → ${check.recommendation}`)
      }
    }
  }

  if (report.contrast.darkMode.length > 0) {
    console.log("\n  Dark Mode:")
    for (const check of report.contrast.darkMode) {
      const status = check.passesAA ? "✅" : "❌"
      console.log(`    ${status} ${check.pair}: ${check.ratio}:1`)
      if (check.recommendation && (verbose || !check.passesAA)) {
        console.log(`       → ${check.recommendation}`)
      }
    }
  }

  // Summary
  console.log("\n--- Summary ---")
  console.log(`Errors: ${report.summary.errorCount}`)
  console.log(`Warnings: ${report.summary.warningCount}`)
  console.log(`Contrast Issues: ${report.summary.contrastIssues}`)
  console.log("\n" + "=".repeat(60) + "\n")
}

// =============================================================================
// MAIN VALIDATE FUNCTION
// =============================================================================

/**
 * Validate a brand kit (Feature #76)
 *
 * @param source - Package name or path to brand kit
 * @param options - Validation options
 * @returns Validation report
 */
export async function validateBrandKit(
  source: string,
  options: { verbose?: boolean; json?: boolean } = {}
): Promise<ValidationReport> {
  const { verbose = false, json = false } = options

  // Load brand kit
  const brandKit = await loadBrandKit(source)

  if (!brandKit) {
    const report: ValidationReport = {
      source,
      valid: false,
      schema: {
        valid: false,
        errors: [`Could not load brand kit from: ${source}`],
        warnings: [],
        missingRequired: [],
        missingOptional: [],
      },
      contrast: {
        lightMode: [],
        darkMode: [],
        passesAA: false,
        passesAAA: false,
      },
      summary: {
        errorCount: 1,
        warningCount: 0,
        contrastIssues: 0,
      },
    }

    if (json) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      printReport(report, verbose)
    }

    return report
  }

  // Validate schema
  const schemaResult = validateBrandKitSchema(brandKit)

  // Generate report
  const report = generateReport(source, brandKit, schemaResult)

  // Output
  if (json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    printReport(report, verbose)
  }

  return report
}

// =============================================================================
// CLI ENTRY POINT
// =============================================================================

/**
 * CLI entry point
 */
export async function main(): Promise<void> {
  const args = process.argv.slice(2)

  // Handle help
  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    console.log(`
Usage: platxa-validate <source> [options]

Validate a brand kit against the Platxa schema.

Arguments:
  source               Package name or path to brand kit

Options:
  --verbose, -v        Show all details including optional fields
  --json               Output as JSON
  -h, --help           Show this help message

Examples:
  platxa-validate @acme/brand-kit
  platxa-validate ./my-brand-kit
  platxa-validate ./brand-kit.json --json
  platxa-validate @acme/brand-kit --verbose
`)
    process.exit(args.length === 0 ? 1 : 0)
  }

  // Parse arguments
  const verbose = args.includes("--verbose") || args.includes("-v")
  const json = args.includes("--json")
  const source = args.find(
    (a) => !a.startsWith("-")
  )

  if (!source) {
    console.error("Error: No source specified")
    process.exit(1)
  }

  // Run validation
  const report = await validateBrandKit(source, { verbose, json })

  process.exit(report.valid ? 0 : 1)
}

// Run if executed directly
const isMain =
  typeof require !== "undefined"
    ? require.main === module
    : import.meta.url === `file://${process.argv[1]}`

if (isMain) {
  main().catch((err) => {
    console.error("Error:", err.message)
    process.exit(1)
  })
}
