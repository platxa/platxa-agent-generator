/**
 * Sass Variable Exporter
 *
 * Exports brand tokens as Sass variables for legacy projects.
 * Generates:
 * - Sass variables ($color-primary, $spacing-md, etc.)
 * - Sass maps for grouped tokens
 * - Helper functions for token access
 * - Dark mode variant support
 *
 * Compatible with Sass 1.x (Dart Sass)
 *
 * @module react-agent/sass
 */

import type { ThemeConfig, ColorValue, SemanticColors } from "../theme/types"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Sass export options
 */
export interface SassExportOptions {
  /** Include Sass maps for grouped access */
  includeMaps?: boolean
  /** Include helper functions */
  includeFunctions?: boolean
  /** Include dark mode variables */
  includeDarkMode?: boolean
  /** Variable prefix (default: none) */
  prefix?: string
  /** Use !default flag for overridability */
  useDefault?: boolean
  /** Include comments */
  includeComments?: boolean
  /** Output format */
  format?: "scss" | "sass"
  /** Indentation (spaces) */
  indent?: number
}

/**
 * Exported Sass content
 */
export interface SassExport {
  /** Main variables file content */
  variables: string
  /** Maps file content (if includeMaps) */
  maps?: string
  /** Functions file content (if includeFunctions) */
  functions?: string
  /** Index file that imports all */
  index: string
  /** File names for each export */
  files: SassFileInfo[]
}

/**
 * File information
 */
export interface SassFileInfo {
  /** File name */
  name: string
  /** File content */
  content: string
  /** Description */
  description: string
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Convert a ColorValue to a CSS string
 */
function colorValueToString(value: ColorValue): string {
  if (typeof value === "string") {
    return value
  }
  // Handle OKLCH
  if ("l" in value && "c" in value && "h" in value) {
    const alpha = value.alpha !== undefined ? ` / ${value.alpha}` : ""
    return `oklch(${value.l} ${value.c} ${value.h}${alpha})`
  }
  // Handle HSL
  if ("h" in value && "s" in value && "l" in value) {
    const alpha = value.alpha !== undefined ? ` / ${value.alpha}` : ""
    return `hsl(${value.h} ${value.s}% ${value.l}%${alpha})`
  }
  // Handle RGB
  if ("r" in value && "g" in value && "b" in value) {
    const alpha = value.alpha !== undefined ? ` / ${value.alpha}` : ""
    return `rgb(${value.r} ${value.g} ${value.b}${alpha})`
  }
  return String(value)
}

/**
 * Convert SemanticColors to a plain record
 */
function colorsToRecord(colors: SemanticColors): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(colors)) {
    result[key] = colorValueToString(value as ColorValue)
  }
  return result
}

/**
 * Convert partial SemanticColors (dark mode) to a plain record
 */
function partialColorsToRecord(
  colors: Partial<SemanticColors> | undefined
): Record<string, string> {
  if (!colors) return {}
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(colors)) {
    if (value !== undefined) {
      result[key] = colorValueToString(value as ColorValue)
    }
  }
  return result
}

// =============================================================================
// DEFAULT OPTIONS
// =============================================================================

const DEFAULT_OPTIONS: Required<SassExportOptions> = {
  includeMaps: true,
  includeFunctions: true,
  includeDarkMode: true,
  prefix: "",
  useDefault: true,
  includeComments: true,
  format: "scss",
  indent: 2,
}

// =============================================================================
// MAIN EXPORTER
// =============================================================================

/**
 * Export theme configuration as Sass variables
 */
export function exportToSass(
  config: ThemeConfig,
  options: SassExportOptions = {}
): SassExport {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const files: SassFileInfo[] = []

  // Generate variables
  const variables = generateVariables(config, opts)
  files.push({
    name: `_variables.${opts.format}`,
    content: variables,
    description: "Brand token variables",
  })

  // Generate maps
  let maps: string | undefined
  if (opts.includeMaps) {
    maps = generateMaps(config, opts)
    files.push({
      name: `_maps.${opts.format}`,
      content: maps,
      description: "Token maps for grouped access",
    })
  }

  // Generate functions
  let functions: string | undefined
  if (opts.includeFunctions) {
    functions = generateFunctions(opts)
    files.push({
      name: `_functions.${opts.format}`,
      content: functions,
      description: "Helper functions for token access",
    })
  }

  // Generate index
  const index = generateIndex(files, opts)
  files.push({
    name: `_index.${opts.format}`,
    content: index,
    description: "Main entry point",
  })

  return {
    variables,
    maps,
    functions,
    index,
    files,
  }
}

// =============================================================================
// VARIABLES GENERATOR
// =============================================================================

/**
 * Generate Sass variables from theme config
 */
function generateVariables(
  config: ThemeConfig,
  opts: Required<SassExportOptions>
): string {
  const lines: string[] = []
  const { prefix, useDefault, includeComments, includeDarkMode } = opts

  // Header
  if (includeComments) {
    lines.push(formatComment("Brand Token Variables", opts))
    lines.push(formatComment(`Generated from: ${config.name}`, opts))
    lines.push(formatComment(`Sass 1.x compatible`, opts))
    lines.push("")
  }

  // Light mode colors
  if (includeComments) {
    lines.push(formatComment("Colors (Light Mode)", opts))
  }

  const colors = colorsToRecord(config.light.colors)
  for (const [key, value] of Object.entries(colors)) {
    const varName = formatVarName("color", key, prefix)
    lines.push(formatVariable(varName, value, useDefault, opts))
  }
  lines.push("")

  // Spacing
  if (config.light.spacing && Object.keys(config.light.spacing).length > 0) {
    if (includeComments) {
      lines.push(formatComment("Spacing", opts))
    }
    for (const [key, value] of Object.entries(config.light.spacing)) {
      const varName = formatVarName("spacing", key, prefix)
      lines.push(formatVariable(varName, value, useDefault, opts))
    }
    lines.push("")
  }

  // Typography
  if (config.light.typography && Object.keys(config.light.typography).length > 0) {
    if (includeComments) {
      lines.push(formatComment("Typography", opts))
    }
    for (const [key, value] of Object.entries(config.light.typography)) {
      const typo = value as { fontSize?: string; lineHeight?: string }
      if (typo.fontSize) {
        const varName = formatVarName("font-size", key, prefix)
        lines.push(formatVariable(varName, typo.fontSize, useDefault, opts))
      }
      if (typo.lineHeight) {
        const varName = formatVarName("line-height", key, prefix)
        lines.push(formatVariable(varName, typo.lineHeight, useDefault, opts))
      }
    }
    lines.push("")
  }

  // Border radius
  if (config.light.radius && Object.keys(config.light.radius).length > 0) {
    if (includeComments) {
      lines.push(formatComment("Border Radius", opts))
    }
    for (const [key, value] of Object.entries(config.light.radius)) {
      const varName = formatVarName("radius", key, prefix)
      lines.push(formatVariable(varName, value, useDefault, opts))
    }
    lines.push("")
  }

  // Shadow
  if (config.light.shadow && Object.keys(config.light.shadow).length > 0) {
    if (includeComments) {
      lines.push(formatComment("Shadows", opts))
    }
    for (const [key, value] of Object.entries(config.light.shadow)) {
      const varName = formatVarName("shadow", key, prefix)
      lines.push(formatVariable(varName, value, useDefault, opts))
    }
    lines.push("")
  }

  // Font weights
  if (config.light.fontWeight && Object.keys(config.light.fontWeight).length > 0) {
    if (includeComments) {
      lines.push(formatComment("Font Weights", opts))
    }
    for (const [key, value] of Object.entries(config.light.fontWeight)) {
      const varName = formatVarName("font-weight", key, prefix)
      lines.push(formatVariable(varName, String(value), useDefault, opts))
    }
    lines.push("")
  }

  // Dark mode colors
  if (includeDarkMode && config.dark) {
    if (includeComments) {
      lines.push(formatComment("Colors (Dark Mode)", opts))
    }
    const darkColors = partialColorsToRecord(config.dark)
    for (const [key, value] of Object.entries(darkColors)) {
      const varName = formatVarName("color", `${key}-dark`, prefix)
      lines.push(formatVariable(varName, value, useDefault, opts))
    }
    lines.push("")
  }

  return lines.join("\n")
}

// =============================================================================
// MAPS GENERATOR
// =============================================================================

/**
 * Generate Sass maps from theme config
 */
function generateMaps(
  config: ThemeConfig,
  opts: Required<SassExportOptions>
): string {
  const lines: string[] = []
  const { prefix, includeComments, includeDarkMode } = opts
  const ind = " ".repeat(opts.indent)

  // Header
  if (includeComments) {
    lines.push(formatComment("Token Maps", opts))
    lines.push(formatComment("Use map-get($colors, 'primary') or color('primary')", opts))
    lines.push("")
  }

  // Colors map
  const colors = colorsToRecord(config.light.colors)
  lines.push(`$${prefix}colors: (`)
  for (const [key, value] of Object.entries(colors)) {
    lines.push(`${ind}'${camelToKebab(key)}': ${value},`)
  }
  lines.push(`)${opts.useDefault ? " !default" : ""};`)
  lines.push("")

  // Spacing map
  if (config.light.spacing && Object.keys(config.light.spacing).length > 0) {
    lines.push(`$${prefix}spacing: (`)
    for (const [key, value] of Object.entries(config.light.spacing)) {
      lines.push(`${ind}'${key}': ${value},`)
    }
    lines.push(`)${opts.useDefault ? " !default" : ""};`)
    lines.push("")
  }

  // Typography map
  if (config.light.typography && Object.keys(config.light.typography).length > 0) {
    lines.push(`$${prefix}typography: (`)
    for (const [key, value] of Object.entries(config.light.typography)) {
      const typo = value as { fontSize?: string; lineHeight?: string }
      lines.push(`${ind}'${key}': (`)
      if (typo.fontSize) {
        lines.push(`${ind}${ind}'font-size': ${typo.fontSize},`)
      }
      if (typo.lineHeight) {
        lines.push(`${ind}${ind}'line-height': ${typo.lineHeight},`)
      }
      lines.push(`${ind}),`)
    }
    lines.push(`)${opts.useDefault ? " !default" : ""};`)
    lines.push("")
  }

  // Radius map
  if (config.light.radius && Object.keys(config.light.radius).length > 0) {
    lines.push(`$${prefix}radius: (`)
    for (const [key, value] of Object.entries(config.light.radius)) {
      lines.push(`${ind}'${key}': ${value},`)
    }
    lines.push(`)${opts.useDefault ? " !default" : ""};`)
    lines.push("")
  }

  // Shadow map
  if (config.light.shadow && Object.keys(config.light.shadow).length > 0) {
    lines.push(`$${prefix}shadow: (`)
    for (const [key, value] of Object.entries(config.light.shadow)) {
      lines.push(`${ind}'${key}': ${value},`)
    }
    lines.push(`)${opts.useDefault ? " !default" : ""};`)
    lines.push("")
  }

  // Dark colors map
  if (includeDarkMode && config.dark) {
    const darkColors = partialColorsToRecord(config.dark)
    lines.push(`$${prefix}colors-dark: (`)
    for (const [key, value] of Object.entries(darkColors)) {
      lines.push(`${ind}'${camelToKebab(key)}': ${value},`)
    }
    lines.push(`)${opts.useDefault ? " !default" : ""};`)
    lines.push("")
  }

  // All tokens map (for iteration)
  lines.push(formatComment("All token categories", opts))
  lines.push(`$${prefix}tokens: (`)
  lines.push(`${ind}'colors': $${prefix}colors,`)
  if (config.light.spacing && Object.keys(config.light.spacing).length > 0) {
    lines.push(`${ind}'spacing': $${prefix}spacing,`)
  }
  if (config.light.typography && Object.keys(config.light.typography).length > 0) {
    lines.push(`${ind}'typography': $${prefix}typography,`)
  }
  if (config.light.radius && Object.keys(config.light.radius).length > 0) {
    lines.push(`${ind}'radius': $${prefix}radius,`)
  }
  if (config.light.shadow && Object.keys(config.light.shadow).length > 0) {
    lines.push(`${ind}'shadow': $${prefix}shadow,`)
  }
  lines.push(`)${opts.useDefault ? " !default" : ""};`)

  return lines.join("\n")
}

// =============================================================================
// FUNCTIONS GENERATOR
// =============================================================================

/**
 * Generate Sass helper functions
 */
function generateFunctions(opts: Required<SassExportOptions>): string {
  const lines: string[] = []
  const { prefix, includeComments } = opts

  // Header
  if (includeComments) {
    lines.push(formatComment("Token Access Functions", opts))
    lines.push(formatComment("Sass 1.x compatible helper functions", opts))
    lines.push("")
  }

  // Requires maps
  lines.push(`@use 'sass:map';`)
  lines.push(`@use 'sass:meta';`)
  lines.push("")

  // Color function
  lines.push(formatComment("Get a color token", opts))
  lines.push(`@function ${prefix}color($name, $dark: false) {`)
  lines.push(`  @if $dark and map.has-key($${prefix}colors-dark, $name) {`)
  lines.push(`    @return map.get($${prefix}colors-dark, $name);`)
  lines.push(`  }`)
  lines.push(`  @if not map.has-key($${prefix}colors, $name) {`)
  lines.push(`    @error "Unknown color token: #{$name}";`)
  lines.push(`  }`)
  lines.push(`  @return map.get($${prefix}colors, $name);`)
  lines.push(`}`)
  lines.push("")

  // Spacing function
  lines.push(formatComment("Get a spacing token", opts))
  lines.push(`@function ${prefix}spacing($name) {`)
  lines.push(`  @if not map.has-key($${prefix}spacing, $name) {`)
  lines.push(`    @error "Unknown spacing token: #{$name}";`)
  lines.push(`  }`)
  lines.push(`  @return map.get($${prefix}spacing, $name);`)
  lines.push(`}`)
  lines.push("")

  // Typography function
  lines.push(formatComment("Get typography properties", opts))
  lines.push(`@function ${prefix}typography($name, $property: null) {`)
  lines.push(`  @if not map.has-key($${prefix}typography, $name) {`)
  lines.push(`    @error "Unknown typography token: #{$name}";`)
  lines.push(`  }`)
  lines.push(`  $typo: map.get($${prefix}typography, $name);`)
  lines.push(`  @if $property {`)
  lines.push(`    @return map.get($typo, $property);`)
  lines.push(`  }`)
  lines.push(`  @return $typo;`)
  lines.push(`}`)
  lines.push("")

  // Radius function
  lines.push(formatComment("Get a radius token", opts))
  lines.push(`@function ${prefix}radius($name) {`)
  lines.push(`  @if not map.has-key($${prefix}radius, $name) {`)
  lines.push(`    @error "Unknown radius token: #{$name}";`)
  lines.push(`  }`)
  lines.push(`  @return map.get($${prefix}radius, $name);`)
  lines.push(`}`)
  lines.push("")

  // Shadow function
  lines.push(formatComment("Get a shadow token", opts))
  lines.push(`@function ${prefix}shadow($name) {`)
  lines.push(`  @if not map.has-key($${prefix}shadow, $name) {`)
  lines.push(`    @error "Unknown shadow token: #{$name}";`)
  lines.push(`  }`)
  lines.push(`  @return map.get($${prefix}shadow, $name);`)
  lines.push(`}`)
  lines.push("")

  // Token exists function
  lines.push(formatComment("Check if a token exists in a category", opts))
  lines.push(`@function ${prefix}token-exists($category, $name) {`)
  lines.push(`  @if not map.has-key($${prefix}tokens, $category) {`)
  lines.push(`    @return false;`)
  lines.push(`  }`)
  lines.push(`  @return map.has-key(map.get($${prefix}tokens, $category), $name);`)
  lines.push(`}`)
  lines.push("")

  // Token mixin for CSS custom properties
  lines.push(formatComment("Output all tokens as CSS custom properties", opts))
  lines.push(`@mixin ${prefix}token-vars($category: null) {`)
  lines.push(`  @if $category {`)
  lines.push(`    $cat-map: map.get($${prefix}tokens, $category);`)
  lines.push(`    @each $name, $value in $cat-map {`)
  lines.push(`      --#{$category}-#{$name}: #{$value};`)
  lines.push(`    }`)
  lines.push(`  } @else {`)
  lines.push(`    @each $category, $cat-map in $${prefix}tokens {`)
  lines.push(`      @if meta.type-of($cat-map) == map {`)
  lines.push(`        @each $name, $value in $cat-map {`)
  lines.push(`          @if meta.type-of($value) != map {`)
  lines.push(`            --#{$category}-#{$name}: #{$value};`)
  lines.push(`          }`)
  lines.push(`        }`)
  lines.push(`      }`)
  lines.push(`    }`)
  lines.push(`  }`)
  lines.push(`}`)
  lines.push("")

  // Dark mode mixin
  lines.push(formatComment("Apply dark mode colors", opts))
  lines.push(`@mixin ${prefix}dark-mode {`)
  lines.push(`  @each $name, $value in $${prefix}colors-dark {`)
  lines.push(`    --color-#{$name}: #{$value};`)
  lines.push(`  }`)
  lines.push(`}`)

  return lines.join("\n")
}

// =============================================================================
// INDEX GENERATOR
// =============================================================================

/**
 * Generate index file that imports all modules
 */
function generateIndex(
  files: SassFileInfo[],
  opts: Required<SassExportOptions>
): string {
  const lines: string[] = []

  if (opts.includeComments) {
    lines.push(formatComment("Brand Tokens - Main Entry Point", opts))
    lines.push(formatComment("Import this file to get all tokens", opts))
    lines.push("")
  }

  // Forward all modules (Sass 1.x @use/@forward)
  for (const file of files) {
    if (file.name.startsWith("_index")) continue
    const moduleName = file.name.replace(/^_/, "").replace(/\.s[ac]ss$/, "")
    lines.push(`@forward '${moduleName}';`)
  }

  return lines.join("\n")
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Format a Sass variable declaration
 */
function formatVariable(
  name: string,
  value: string,
  useDefault: boolean,
  opts: Required<SassExportOptions>
): string {
  const defaultFlag = useDefault ? " !default" : ""
  // SASS indented syntax doesn't use semicolons
  const terminator = opts.format === "sass" ? "" : ";"
  return `$${name}: ${value}${defaultFlag}${terminator}`
}

/**
 * Format a variable name
 */
function formatVarName(category: string, key: string, prefix: string): string {
  const kebabKey = camelToKebab(key)
  return `${prefix}${category}-${kebabKey}`
}

/**
 * Format a comment
 */
function formatComment(text: string, opts: Required<SassExportOptions>): string {
  if (opts.format === "sass") {
    return `// ${text}`
  }
  return `// ${text}`
}

/**
 * Convert camelCase to kebab-case
 */
function camelToKebab(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()
}

// =============================================================================
// BATCH EXPORT
// =============================================================================

/**
 * Export multiple themes to Sass
 */
export function exportThemesToSass(
  themes: ThemeConfig[],
  options: SassExportOptions = {}
): Map<string, SassExport> {
  const exports = new Map<string, SassExport>()

  for (const theme of themes) {
    exports.set(theme.name, exportToSass(theme, options))
  }

  return exports
}

/**
 * Generate a combined Sass file with theme switching support
 */
export function generateThemeSwitcher(
  themes: ThemeConfig[],
  options: SassExportOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const lines: string[] = []

  if (opts.includeComments) {
    lines.push(formatComment("Theme Switcher", opts))
    lines.push(formatComment("Supports multiple theme configurations", opts))
    lines.push("")
  }

  // Theme map
  lines.push(`$themes: (`)
  for (const theme of themes) {
    const colors = colorsToRecord(theme.light.colors)
    lines.push(`  '${theme.name}': (`)
    for (const [key, value] of Object.entries(colors)) {
      lines.push(`    '${camelToKebab(key)}': ${value},`)
    }
    lines.push(`  ),`)
  }
  lines.push(`);`)
  lines.push("")

  // Theme mixin
  lines.push(`@mixin theme($name) {`)
  lines.push(`  $theme: map-get($themes, $name);`)
  lines.push(`  @if not $theme {`)
  lines.push(`    @error "Unknown theme: #{$name}";`)
  lines.push(`  }`)
  lines.push(`  @each $token, $value in $theme {`)
  lines.push(`    --color-#{$token}: #{$value};`)
  lines.push(`  }`)
  lines.push(`}`)

  return lines.join("\n")
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default {
  exportToSass,
  exportThemesToSass,
  generateThemeSwitcher,
}
