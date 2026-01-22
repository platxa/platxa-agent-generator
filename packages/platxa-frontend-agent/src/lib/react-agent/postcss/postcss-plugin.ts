/**
 * PostCSS Plugin for Platxa Brand Token Processing
 *
 * Transforms brand tokens in CSS during build time, providing:
 * - Token transformation: Convert @platxa directives to CSS custom properties
 * - Custom property injection: Auto-inject design tokens into :root
 * - Theme variant generation: Generate light/dark mode variants
 *
 * @example Basic usage in postcss.config.js
 * ```javascript
 * const { platxaTokens } = require("@platxa/frontend-agent/postcss")
 *
 * module.exports = {
 *   plugins: [
 *     platxaTokens()
 *   ]
 * }
 * ```
 *
 * @example With options
 * ```javascript
 * platxaTokens({
 *   configPath: "./brand/config.ts",
 *   injectTokens: true,
 *   generateVariants: true,
 *   prefix: "brand"
 * })
 * ```
 *
 * @module react-agent/postcss
 */

import type { Root, AtRule, Declaration, PluginCreator } from "postcss"
import { resolveConfig as resolvePlatxaConfig } from "../brand/config"
import { findAndLoadConfig } from "../brand/config-loader"
import { getThemePreset } from "../theme/tokens"
import type { FrontendConfig, ResolvedConfig } from "../brand/types"
import type { ThemeConfig, DesignTokens, SemanticColors } from "../theme/types"

// =============================================================================
// TYPES
// =============================================================================

/**
 * PostCSS plugin options
 */
export interface PlatxaPostCSSOptions {
  /**
   * Path to config file (auto-detected if not specified)
   * Supports: platxa.config.ts, platxa.config.js, platxa.config.json
   */
  configPath?: string

  /**
   * Whether to automatically inject design tokens into :root
   * @default true
   */
  injectTokens?: boolean

  /**
   * Whether to generate theme variant classes (.light, .dark)
   * @default true
   */
  generateVariants?: boolean

  /**
   * CSS custom property prefix
   * @default "" (no prefix, uses standard names like --primary)
   */
  prefix?: string

  /**
   * Dark mode strategy
   * - "class": Uses .dark class on html/body
   * - "media": Uses prefers-color-scheme media query
   * - "both": Generates both class and media query variants
   * @default "class"
   */
  darkModeStrategy?: "class" | "media" | "both"

  /**
   * Selector for dark mode class
   * @default ".dark"
   */
  darkModeSelector?: string

  /**
   * Whether to preserve @platxa at-rules in output (for debugging)
   * @default false
   */
  preserveAtRules?: boolean

  /**
   * Enable verbose logging
   * @default false
   */
  verbose?: boolean
}

/**
 * Internal plugin state
 */
interface PluginState {
  config: ResolvedConfig | null
  themeConfig: ThemeConfig | null
  initialized: boolean
  initPromise: Promise<void> | null
}

/**
 * Token transformation result
 */
interface TokenTransformResult {
  property: string
  value: string
  fallback?: string
}

// =============================================================================
// CONSTANTS
// =============================================================================

const PLUGIN_NAME = "postcss-platxa-tokens"

/**
 * Supported @platxa at-rule parameters
 */
const SUPPORTED_DIRECTIVES = [
  "tokens",      // Inject all design tokens
  "colors",      // Inject color tokens only
  "spacing",     // Inject spacing tokens only
  "typography",  // Inject typography tokens only
  "theme",       // Generate full theme (light + dark)
  "light",       // Generate light theme only
  "dark",        // Generate dark theme only
] as const

type PlatxaDirective = typeof SUPPORTED_DIRECTIVES[number]

/**
 * Semantic spacing name to numeric key mapping
 * Maps human-friendly names to the actual spacing scale values
 */
const SEMANTIC_SPACING_MAP: Record<string, string> = {
  // T-shirt sizes
  xs: "1",      // 0.25rem (4px)
  sm: "2",      // 0.5rem (8px)
  md: "4",      // 1rem (16px)
  lg: "6",      // 1.5rem (24px)
  xl: "8",      // 2rem (32px)
  "2xl": "12",  // 3rem (48px)
  "3xl": "16",  // 4rem (64px)
  "4xl": "24",  // 6rem (96px)
  // Common aliases
  none: "0",
  px: "px",
  auto: "auto",
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Convert camelCase to kebab-case
 */
function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()
}

/**
 * Generate CSS variable name with optional prefix
 */
function varName(name: string, prefix?: string): string {
  const kebab = toKebabCase(name)
  return prefix ? `--${prefix}-${kebab}` : `--${kebab}`
}

/**
 * Check if a value looks like a brand token reference
 * Matches: brand(primary), brand(spacing.md), token(color.primary)
 */
function isTokenReference(value: string): boolean {
  return /(?:brand|token|platxa)\([\w.-]+\)/.test(value)
}

/**
 * Resolve a token path to its value from design tokens
 */
function resolveTokenValue(
  path: string,
  tokens: DesignTokens,
  prefix?: string
): TokenTransformResult | null {
  const parts = path.split(".")

  // Handle direct color references (e.g., "primary", "background")
  if (parts.length === 1) {
    const colorKey = parts[0] as keyof SemanticColors
    if (tokens.colors && colorKey in tokens.colors) {
      return {
        property: varName(colorKey, prefix),
        value: tokens.colors[colorKey] as string,
      }
    }
  }

  // Handle namespaced references (e.g., "color.primary", "spacing.md")
  if (parts.length === 2) {
    const [namespace, key] = parts

    switch (namespace) {
      case "color":
      case "colors": {
        const colorKey = key as keyof SemanticColors
        if (tokens.colors && colorKey in tokens.colors) {
          return {
            property: varName(colorKey, prefix),
            value: tokens.colors[colorKey] as string,
          }
        }
        break
      }
      case "spacing": {
        // First check for semantic name mapping (sm, md, lg, etc.)
        const resolvedKey = SEMANTIC_SPACING_MAP[key] ?? key
        if (tokens.spacing && resolvedKey in tokens.spacing) {
          const spacingValue = tokens.spacing[resolvedKey as keyof typeof tokens.spacing]
          if (spacingValue) {
            return {
              property: varName(`spacing-${resolvedKey}`, prefix),
              value: spacingValue,
            }
          }
        }
        break
      }
      case "radius": {
        if (tokens.radius && key in tokens.radius) {
          return {
            property: varName(`radius-${key}`, prefix),
            value: tokens.radius[key as keyof typeof tokens.radius] ?? "",
          }
        }
        break
      }
      case "shadow": {
        if (tokens.shadow && key in tokens.shadow) {
          return {
            property: varName(`shadow-${key}`, prefix),
            value: tokens.shadow[key as keyof typeof tokens.shadow] ?? "",
          }
        }
        break
      }
      case "font":
      case "fontFamily": {
        if (tokens.fontFamily && key in tokens.fontFamily) {
          return {
            property: varName(`font-${key}`, prefix),
            value: tokens.fontFamily[key as keyof typeof tokens.fontFamily] ?? "",
          }
        }
        break
      }
    }
  }

  return null
}

// =============================================================================
// CSS GENERATION FUNCTIONS
// =============================================================================

/**
 * Generate color CSS variables from semantic colors
 */
function generateColorVariables(
  colors: SemanticColors,
  prefix?: string
): string[] {
  const lines: string[] = []

  for (const [key, value] of Object.entries(colors)) {
    if (value) {
      lines.push(`  ${varName(key, prefix)}: ${value};`)
    }
  }

  return lines
}

/**
 * Generate spacing CSS variables
 */
function generateSpacingVariables(
  spacing: DesignTokens["spacing"],
  prefix?: string
): string[] {
  const lines: string[] = []

  for (const [key, value] of Object.entries(spacing)) {
    if (value) {
      lines.push(`  ${varName(`spacing-${key}`, prefix)}: ${value};`)
    }
  }

  return lines
}

/**
 * Generate typography CSS variables
 */
function generateTypographyVariables(
  tokens: DesignTokens,
  prefix?: string
): string[] {
  const lines: string[] = []

  // Font families
  if (tokens.fontFamily) {
    for (const [key, value] of Object.entries(tokens.fontFamily)) {
      if (value) {
        lines.push(`  ${varName(`font-${key}`, prefix)}: ${value};`)
      }
    }
  }

  // Font weights
  if (tokens.fontWeight) {
    for (const [key, value] of Object.entries(tokens.fontWeight)) {
      if (value !== undefined) {
        lines.push(`  ${varName(`font-weight-${key}`, prefix)}: ${value};`)
      }
    }
  }

  return lines
}

/**
 * Generate radius CSS variables
 */
function generateRadiusVariables(
  radius: DesignTokens["radius"],
  prefix?: string
): string[] {
  const lines: string[] = []

  for (const [key, value] of Object.entries(radius)) {
    if (value) {
      lines.push(`  ${varName(`radius-${key}`, prefix)}: ${value};`)
    }
  }

  // Add common --radius alias for lg
  if (radius.lg) {
    lines.push(`  ${varName("radius", prefix)}: ${radius.lg};`)
  }

  return lines
}

/**
 * Generate shadow CSS variables
 */
function generateShadowVariables(
  shadow: DesignTokens["shadow"],
  prefix?: string
): string[] {
  const lines: string[] = []

  if (shadow) {
    for (const [key, value] of Object.entries(shadow)) {
      if (value) {
        lines.push(`  ${varName(`shadow-${key}`, prefix)}: ${value};`)
      }
    }
  }

  return lines
}

/**
 * Generate all design token CSS variables
 */
function generateAllTokenVariables(
  tokens: DesignTokens,
  prefix?: string
): string {
  const sections: string[] = []

  // Colors
  sections.push("  /* Colors */")
  sections.push(...generateColorVariables(tokens.colors, prefix))

  // Spacing
  sections.push("")
  sections.push("  /* Spacing */")
  sections.push(...generateSpacingVariables(tokens.spacing, prefix))

  // Typography
  sections.push("")
  sections.push("  /* Typography */")
  sections.push(...generateTypographyVariables(tokens, prefix))

  // Radius
  sections.push("")
  sections.push("  /* Border Radius */")
  sections.push(...generateRadiusVariables(tokens.radius, prefix))

  // Shadows
  if (tokens.shadow) {
    sections.push("")
    sections.push("  /* Shadows */")
    sections.push(...generateShadowVariables(tokens.shadow, prefix))
  }

  return sections.join("\n")
}

/**
 * Generate light theme CSS
 */
function generateLightTheme(
  tokens: DesignTokens,
  prefix?: string
): string {
  const lines: string[] = []

  lines.push(":root {")
  lines.push(generateAllTokenVariables(tokens, prefix))
  lines.push("}")

  return lines.join("\n")
}

/**
 * Generate dark theme CSS with class selector
 */
function generateDarkThemeClass(
  darkColors: Partial<SemanticColors>,
  selector: string = ".dark",
  prefix?: string
): string {
  const lines: string[] = []

  lines.push(`${selector} {`)

  for (const [key, value] of Object.entries(darkColors)) {
    if (value) {
      lines.push(`  ${varName(key, prefix)}: ${value};`)
    }
  }

  lines.push("}")

  return lines.join("\n")
}

/**
 * Generate dark theme CSS with media query
 */
function generateDarkThemeMedia(
  darkColors: Partial<SemanticColors>,
  prefix?: string
): string {
  const lines: string[] = []

  lines.push("@media (prefers-color-scheme: dark) {")
  lines.push("  :root {")

  for (const [key, value] of Object.entries(darkColors)) {
    if (value) {
      lines.push(`    ${varName(key, prefix)}: ${value};`)
    }
  }

  lines.push("  }")
  lines.push("}")

  return lines.join("\n")
}

/**
 * Generate complete theme CSS (light + dark variants)
 */
function generateCompleteTheme(
  config: ThemeConfig,
  options: PlatxaPostCSSOptions
): string {
  const { prefix, darkModeStrategy = "class", darkModeSelector = ".dark" } = options
  const sections: string[] = []

  // Header comment
  sections.push(`/**
 * Theme: ${config.name}
 * Generated by @platxa/frontend-agent PostCSS plugin
 */`)

  // Light theme (default)
  sections.push("")
  sections.push("/* Light Theme (Default) */")
  sections.push(generateLightTheme(config.light, prefix))

  // Dark theme variants
  if (config.dark) {
    sections.push("")
    sections.push("/* Dark Theme */")

    if (darkModeStrategy === "class" || darkModeStrategy === "both") {
      sections.push(generateDarkThemeClass(config.dark, darkModeSelector, prefix))
    }

    if (darkModeStrategy === "media" || darkModeStrategy === "both") {
      sections.push("")
      sections.push(generateDarkThemeMedia(config.dark, prefix))
    }
  }

  return sections.join("\n")
}

// =============================================================================
// POSTCSS PLUGIN
// =============================================================================

/**
 * PostCSS plugin for Platxa brand token processing
 *
 * Features:
 * - Transforms @platxa directives to CSS custom properties
 * - Auto-injects design tokens into :root
 * - Generates light/dark theme variants
 * - Supports token references in property values: brand(primary), token(spacing.md)
 *
 * @param options - Plugin configuration options
 * @returns PostCSS plugin instance
 *
 * @example Input CSS with @platxa directives
 * ```
 * @platxa tokens;
 * @platxa theme;
 *
 * .button {
 *   background: brand(primary);
 *   padding: token(spacing.md);
 * }
 * ```
 *
 * @example Output CSS (generated)
 * ```
 * :root {
 *   --primary: hsl(220 100% 50%);
 *   --spacing-md: 1rem;
 * }
 *
 * .dark {
 *   --primary: hsl(220 100% 60%);
 * }
 *
 * .button {
 *   background: var(--primary);
 *   padding: var(--spacing-md);
 * }
 * ```
 */
const platxaTokens: PluginCreator<PlatxaPostCSSOptions> = (options = {}) => {
  const {
    configPath,
    injectTokens = true,
    generateVariants = true,
    prefix,
    darkModeStrategy = "class",
    darkModeSelector = ".dark",
    preserveAtRules = false,
    verbose = false,
  } = options

  // Plugin state
  const state: PluginState = {
    config: null,
    themeConfig: null,
    initialized: false,
    initPromise: null,
  }

  /**
   * Load and initialize configuration
   */
  async function initialize(root: Root): Promise<void> {
    if (state.initialized) return
    if (state.initPromise) {
      await state.initPromise
      return
    }

    state.initPromise = (async () => {
      try {
        // Determine root directory from CSS file or process.cwd()
        const cssFile = root.source?.input?.file
        const rootDir = cssFile
          ? cssFile.substring(0, cssFile.lastIndexOf("/"))
          : process.cwd()

        let userConfig: FrontendConfig | null = null

        // Try custom path first
        if (configPath) {
          const fullPath = configPath.startsWith("/")
            ? configPath
            : `${rootDir}/${configPath}`
          const result = await findAndLoadConfig({ cwd: rootDir, configPath: fullPath })
          if (result.config) {
            userConfig = result.config
          }
        } else {
          // Auto-detect config file
          const result = await findAndLoadConfig({ cwd: rootDir })
          if (result.config) {
            userConfig = result.config
          }
        }

        // Resolve configuration
        state.config = resolvePlatxaConfig(userConfig ?? undefined)

        // Get theme config based on resolved config
        state.themeConfig = getThemePreset(state.config.preset)

        if (verbose) {
          console.log(`[${PLUGIN_NAME}] Loaded config:`, state.config.preset)
        }
      } catch (error) {
        if (verbose) {
          console.warn(`[${PLUGIN_NAME}] Failed to load config:`, error)
        }
        // Fall back to defaults
        state.config = resolvePlatxaConfig()
        state.themeConfig = getThemePreset("default")
      }

      state.initialized = true
    })()

    await state.initPromise
  }

  /**
   * Process @platxa at-rules
   */
  function processAtRule(atRule: AtRule, _css: Root): void {
    if (!state.themeConfig) return

    const directive = atRule.params.trim().replace(/;$/, "") as PlatxaDirective

    if (!SUPPORTED_DIRECTIVES.includes(directive)) {
      if (verbose) {
        console.warn(`[${PLUGIN_NAME}] Unknown directive: @platxa ${directive}`)
      }
      return
    }

    let generatedCss = ""

    switch (directive) {
      case "tokens":
        generatedCss = generateLightTheme(state.themeConfig.light, prefix)
        break

      case "colors":
        generatedCss = `:root {\n${generateColorVariables(state.themeConfig.light.colors, prefix).join("\n")}\n}`
        break

      case "spacing":
        generatedCss = `:root {\n${generateSpacingVariables(state.themeConfig.light.spacing, prefix).join("\n")}\n}`
        break

      case "typography":
        generatedCss = `:root {\n${generateTypographyVariables(state.themeConfig.light, prefix).join("\n")}\n}`
        break

      case "theme":
        generatedCss = generateCompleteTheme(state.themeConfig, options)
        break

      case "light":
        generatedCss = generateLightTheme(state.themeConfig.light, prefix)
        break

      case "dark":
        if (state.themeConfig.dark) {
          if (darkModeStrategy === "media") {
            generatedCss = generateDarkThemeMedia(state.themeConfig.dark, prefix)
          } else {
            generatedCss = generateDarkThemeClass(state.themeConfig.dark, darkModeSelector, prefix)
          }
        }
        break
    }

    if (generatedCss) {
      // Parse generated CSS and insert nodes
      const postcss = require("postcss")
      const parsed = postcss.parse(generatedCss)

      // Insert generated nodes before the at-rule
      parsed.nodes?.forEach((node: unknown) => {
        atRule.before(node as Parameters<typeof atRule.before>[0])
      })
    }

    // Remove the @platxa at-rule unless preserving
    if (!preserveAtRules) {
      atRule.remove()
    }
  }

  /**
   * Transform token references in declaration values
   */
  function transformDeclaration(decl: Declaration): void {
    if (!state.themeConfig || !isTokenReference(decl.value)) return

    // Replace all token references in the value
    const newValue = decl.value.replace(
      /(?:brand|token|platxa)\(([\w.-]+)\)/g,
      (match, tokenPath) => {
        const resolved = resolveTokenValue(
          tokenPath,
          state.themeConfig!.light,
          prefix
        )

        if (resolved) {
          // Return var() reference instead of raw value
          return `var(${resolved.property})`
        }

        if (verbose) {
          console.warn(`[${PLUGIN_NAME}] Unknown token: ${tokenPath}`)
        }

        // Keep original if not found
        return match
      }
    )

    if (newValue !== decl.value) {
      decl.value = newValue
    }
  }

  return {
    postcssPlugin: PLUGIN_NAME,

    async Once(root) {
      await initialize(root)

      // Auto-inject tokens if enabled and no @platxa directives found
      if (injectTokens && state.themeConfig) {
        let hasDirectives = false
        root.walkAtRules("platxa", () => {
          hasDirectives = true
        })

        if (!hasDirectives) {
          // Prepend full theme to the stylesheet
          const themeCss = generateVariants
            ? generateCompleteTheme(state.themeConfig, options)
            : generateLightTheme(state.themeConfig.light, prefix)

          const postcss = require("postcss")
          const parsed = postcss.parse(themeCss)

          // Prepend to root
          if (parsed.nodes) {
            root.prepend(...parsed.nodes)
          }
        }
      }
    },

    AtRule: {
      platxa(atRule) {
        processAtRule(atRule, atRule.root())
      },
    },

    Declaration(decl) {
      transformDeclaration(decl)
    },
  }
}

platxaTokens.postcss = true

// =============================================================================
// EXPORTS
// =============================================================================

export { platxaTokens }
export default platxaTokens

/**
 * Alias for platxaTokens
 */
export const postcssPluginPlatxa = platxaTokens
