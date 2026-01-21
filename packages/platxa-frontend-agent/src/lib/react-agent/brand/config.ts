/**
 * Brand Configuration System
 *
 * Provides configuration resolution for the opt-in brand kit system.
 * Built-in themes are the DEFAULT - brand kits only load when explicitly specified.
 *
 * Key Principles:
 * 1. Zero-config default: Works out-of-box with built-in "default" theme
 * 2. No external dependencies: Built-in presets require no additional packages
 * 3. Backward compatible: Existing projects continue to work unchanged
 * 4. Opt-in brand loading: Brand kits only loaded when brand.package specified
 *
 * @module react-agent/brand/config
 */

import {
  defaultTheme,
  blueTheme,
  greenTheme,
  violetTheme,
  getThemePresetNames,
} from "../theme/tokens"
import type { ThemeConfig } from "../theme/types"
import type {
  FrontendConfig,
  ResolvedConfig,
  ThemePresetName,
  BuiltInPreset,
  BrandKitExport,
} from "./types"

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Built-in theme presets that work without any configuration
 * Frozen at runtime to prevent accidental modification
 */
export const BUILTIN_PRESETS: readonly BuiltInPreset[] = Object.freeze([
  "default",
  "blue",
  "green",
  "violet",
] as const)

/**
 * Default configuration when no config file is provided
 */
export const DEFAULT_CONFIG: FrontendConfig = {
  theme: {
    preset: "default",
  },
  // brand is NOT specified by default - this is the key to opt-in behavior
}

// =============================================================================
// CONFIGURATION HELPER
// =============================================================================

/**
 * Type-safe configuration helper with IntelliSense support
 *
 * @example
 * ```typescript
 * // frontend.config.ts
 * import { defineFrontendConfig } from "@platxa/frontend-agent"
 *
 * export default defineFrontendConfig({
 *   // Use built-in preset (default behavior)
 *   theme: {
 *     preset: "blue",
 *   },
 * })
 * ```
 *
 * @example
 * ```typescript
 * // Opt-in to brand kit
 * export default defineFrontendConfig({
 *   brand: {
 *     package: "@platxa/brand-kit",
 *   },
 * })
 * ```
 */
export function defineFrontendConfig(config: FrontendConfig): FrontendConfig {
  return config
}

/**
 * Type-safe brand kit definition helper with IntelliSense support
 *
 * Use this when creating brand kit packages to get full TypeScript
 * support and validation of the brand kit structure.
 *
 * @example
 * ```typescript
 * // my-brand/index.ts
 * import { defineBrandKit } from "@platxa/frontend-agent"
 *
 * export default defineBrandKit({
 *   meta: {
 *     name: "my-brand",
 *     version: "1.0.0",
 *     description: "My company brand kit"
 *   },
 *   primitives: {
 *     primary: { 1: "hsl(206 100% 99%)", ... },
 *     accent: { ... },
 *     neutral: { ... }
 *   },
 *   semantics: {
 *     light: { background: "...", foreground: "...", ... },
 *     dark: { background: "...", foreground: "...", ... }
 *   }
 * })
 * ```
 */
export function defineBrandKit(brandKit: BrandKitExport): BrandKitExport {
  return brandKit
}

// =============================================================================
// PRESET RESOLUTION
// =============================================================================

/**
 * Check if a preset name is a built-in preset
 */
export function isBuiltInPreset(name: string): name is BuiltInPreset {
  return BUILTIN_PRESETS.includes(name as BuiltInPreset)
}

/**
 * Get built-in theme config by preset name
 * Returns default theme if preset is not recognized
 */
export function getBuiltInTheme(preset: ThemePresetName): ThemeConfig {
  switch (preset) {
    case "blue":
      return blueTheme
    case "green":
      return greenTheme
    case "violet":
    case "purple":
      return violetTheme
    case "default":
    default:
      // Default theme for any unrecognized preset
      // This ensures backward compatibility
      return defaultTheme
  }
}

/**
 * Get all available built-in preset names
 */
export function getBuiltInPresetNames(): readonly BuiltInPreset[] {
  return BUILTIN_PRESETS
}

/**
 * Get all available theme preset names (including extended)
 */
export function getAllPresetNames(): string[] {
  return getThemePresetNames()
}

// =============================================================================
// CONFIGURATION RESOLUTION
// =============================================================================

/**
 * Resolve configuration with all defaults applied
 *
 * Resolution order:
 * 1. If brand.package specified → mode: "brand"
 * 2. If theme.custom specified → use custom theme generation
 * 3. If theme.preset specified → use built-in preset
 * 4. Default → use "default" preset
 *
 * @param config - User configuration (may be undefined for zero-config)
 * @returns Resolved configuration with theme config
 */
export function resolveConfig(config?: FrontendConfig): ResolvedConfig {
  // Zero-config default: use DEFAULT_CONFIG when no config provided
  const userConfig = config ?? DEFAULT_CONFIG

  // Check if brand kit is specified (opt-in)
  const hasBrandPackage = Boolean(userConfig.brand?.package)

  if (hasBrandPackage) {
    // Brand kit mode - will be loaded dynamically (Feature #2, #4)
    // For now, fall back to default theme until brand is loaded
    return {
      mode: "brand",
      preset: "default",
      brandPackage: userConfig.brand!.package,
      brandOverrides: userConfig.brand?.overrides,
      themeConfig: defaultTheme,
    }
  }

  // Built-in theme mode (DEFAULT behavior)
  const preset = userConfig.theme?.preset ?? "default"
  const custom = userConfig.theme?.custom

  if (custom) {
    // Custom theme will be generated (uses theme-worker)
    return {
      mode: "builtin",
      preset: preset as ThemePresetName,
      custom,
      themeConfig: getBuiltInTheme(preset as ThemePresetName),
    }
  }

  // Use built-in preset
  return {
    mode: "builtin",
    preset: preset as ThemePresetName,
    themeConfig: getBuiltInTheme(preset as ThemePresetName),
  }
}

// =============================================================================
// CONFIGURATION VALIDATION
// =============================================================================

/**
 * Validation result
 */
export interface ConfigValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate frontend configuration
 *
 * @param config - Configuration to validate
 * @returns Validation result with errors and warnings
 */
export function validateConfig(config: FrontendConfig): ConfigValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate theme preset if specified
  if (config.theme?.preset) {
    const validPresets = [...BUILTIN_PRESETS, ...getThemePresetNames()]
    if (!validPresets.includes(config.theme.preset)) {
      errors.push(
        `Invalid theme preset "${config.theme.preset}". ` +
          `Available presets: ${BUILTIN_PRESETS.join(", ")}`
      )
    }
  }

  // Validate custom theme options
  if (config.theme?.custom) {
    const { primaryHue, saturation } = config.theme.custom

    if (typeof primaryHue !== "number" || primaryHue < 0 || primaryHue > 360) {
      errors.push("theme.custom.primaryHue must be a number between 0 and 360")
    }

    if (saturation && !["low", "medium", "high"].includes(saturation)) {
      errors.push(
        'theme.custom.saturation must be "low", "medium", or "high"'
      )
    }
  }

  // Warn about conflicting options
  if (config.theme && config.brand?.package) {
    warnings.push(
      "Both theme and brand.package specified. " +
        "Brand kit tokens will override theme preset when loaded."
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if configuration uses brand kit (opt-in)
 */
export function usesBrandKit(config?: FrontendConfig): boolean {
  return Boolean(config?.brand?.package)
}

/**
 * Check if configuration uses built-in theme (default behavior)
 */
export function usesBuiltInTheme(config?: FrontendConfig): boolean {
  return !usesBrandKit(config)
}

/**
 * Get the effective preset name from configuration
 */
export function getEffectivePreset(config?: FrontendConfig): ThemePresetName {
  return (config?.theme?.preset as ThemePresetName) ?? "default"
}

// =============================================================================
// BRAND KIT CREATION TOOLS (Feature #45)
// =============================================================================

/**
 * Options for creating a brand kit template
 */
export interface BrandKitTemplateOptions {
  /** Brand name */
  name: string
  /** Version (defaults to "1.0.0") */
  version?: string
  /** Description */
  description?: string
  /** Author name */
  author?: string
  /** Primary hue (0-360) */
  primaryHue?: number
  /** Accent hue (0-360) */
  accentHue?: number
}

/**
 * Creates a brand kit template with customizable options
 *
 * Use this to quickly scaffold a new brand kit with sensible defaults.
 * The template includes all required fields and common optional fields.
 *
 * @param options - Template customization options
 * @returns Complete BrandKitExport ready to customize
 *
 * @example Step 1: Create your brand kit file
 * ```typescript
 * // my-brand/index.ts
 * import { createBrandKitTemplate, defineBrandKit } from "@platxa/frontend-agent"
 *
 * // Generate template with your brand's primary color
 * const template = createBrandKitTemplate({
 *   name: "my-company-brand",
 *   description: "Official brand kit for My Company",
 *   primaryHue: 220,  // Blue
 *   accentHue: 340,   // Pink
 * })
 *
 * // Export with type safety
 * export default defineBrandKit(template)
 * ```
 *
 * @example Step 2: Customize colors and tokens
 * ```typescript
 * import { createBrandKitTemplate, defineBrandKit } from "@platxa/frontend-agent"
 *
 * const template = createBrandKitTemplate({ name: "acme-brand" })
 *
 * // Override specific values
 * template.semantics.light.primary = "hsl(220 90% 50%)"
 * template.semantics.light.accent = "hsl(340 80% 55%)"
 *
 * export default defineBrandKit(template)
 * ```
 *
 * @example Step 3: Use in your app
 * ```typescript
 * // platxa.config.ts
 * import { defineFrontendConfig } from "@platxa/frontend-agent"
 *
 * export default defineFrontendConfig({
 *   brand: { package: "./my-brand" }
 * })
 * ```
 */
export function createBrandKitTemplate(
  options: BrandKitTemplateOptions
): BrandKitExport {
  const {
    name,
    version = "1.0.0",
    description = `Brand kit for ${name}`,
    author,
    primaryHue = 220,
    accentHue = 280,
  } = options

  // Generate 12-step color scales
  const generateScale = (hue: number) => ({
    1: `hsl(${hue} 100% 99%)`,
    2: `hsl(${hue} 100% 98%)`,
    3: `hsl(${hue} 95% 94%)`,
    4: `hsl(${hue} 90% 88%)`,
    5: `hsl(${hue} 85% 80%)`,
    6: `hsl(${hue} 80% 70%)`,
    7: `hsl(${hue} 75% 60%)`,
    8: `hsl(${hue} 70% 50%)`,
    9: `hsl(${hue} 65% 42%)`,
    10: `hsl(${hue} 60% 35%)`,
    11: `hsl(${hue} 55% 28%)`,
    12: `hsl(${hue} 50% 15%)`,
  })

  const neutralScale = {
    1: "hsl(0 0% 99%)",
    2: "hsl(0 0% 98%)",
    3: "hsl(0 0% 94%)",
    4: "hsl(0 0% 88%)",
    5: "hsl(0 0% 80%)",
    6: "hsl(0 0% 70%)",
    7: "hsl(0 0% 55%)",
    8: "hsl(0 0% 40%)",
    9: "hsl(0 0% 30%)",
    10: "hsl(0 0% 20%)",
    11: "hsl(0 0% 12%)",
    12: "hsl(0 0% 5%)",
  }

  return {
    meta: {
      name,
      version,
      description,
      author,
    },
    primitives: {
      primary: generateScale(primaryHue),
      accent: generateScale(accentHue),
      neutral: neutralScale,
    },
    semantics: {
      light: {
        background: "hsl(0 0% 100%)",
        foreground: "hsl(0 0% 5%)",
        card: "hsl(0 0% 100%)",
        cardForeground: "hsl(0 0% 5%)",
        popover: "hsl(0 0% 100%)",
        popoverForeground: "hsl(0 0% 5%)",
        primary: `hsl(${primaryHue} 70% 50%)`,
        primaryForeground: "hsl(0 0% 100%)",
        secondary: "hsl(0 0% 96%)",
        secondaryForeground: "hsl(0 0% 10%)",
        muted: "hsl(0 0% 96%)",
        mutedForeground: "hsl(0 0% 45%)",
        accent: `hsl(${accentHue} 65% 50%)`,
        accentForeground: "hsl(0 0% 100%)",
        destructive: "hsl(0 85% 60%)",
        destructiveForeground: "hsl(0 0% 100%)",
        border: "hsl(0 0% 90%)",
        input: "hsl(0 0% 90%)",
        ring: `hsl(${primaryHue} 70% 50%)`,
      },
      dark: {
        background: "hsl(0 0% 5%)",
        foreground: "hsl(0 0% 98%)",
        card: "hsl(0 0% 8%)",
        cardForeground: "hsl(0 0% 98%)",
        popover: "hsl(0 0% 8%)",
        popoverForeground: "hsl(0 0% 98%)",
        primary: `hsl(${primaryHue} 65% 55%)`,
        primaryForeground: "hsl(0 0% 100%)",
        secondary: "hsl(0 0% 15%)",
        secondaryForeground: "hsl(0 0% 98%)",
        muted: "hsl(0 0% 15%)",
        mutedForeground: "hsl(0 0% 65%)",
        accent: `hsl(${accentHue} 60% 55%)`,
        accentForeground: "hsl(0 0% 100%)",
        destructive: "hsl(0 65% 50%)",
        destructiveForeground: "hsl(0 0% 100%)",
        border: "hsl(0 0% 18%)",
        input: "hsl(0 0% 18%)",
        ring: `hsl(${primaryHue} 65% 55%)`,
      },
    },
    typography: {
      fontSize: {
        xs: { fontSize: "0.75rem", lineHeight: "1rem" },
        sm: { fontSize: "0.875rem", lineHeight: "1.25rem" },
        base: { fontSize: "1rem", lineHeight: "1.5rem" },
        lg: { fontSize: "1.125rem", lineHeight: "1.75rem" },
        xl: { fontSize: "1.25rem", lineHeight: "1.75rem" },
        "2xl": { fontSize: "1.5rem", lineHeight: "2rem" },
        "3xl": { fontSize: "1.875rem", lineHeight: "2.25rem" },
        "4xl": { fontSize: "2.25rem", lineHeight: "2.5rem" },
      },
    },
    spacing: {
      0: "0px",
      1: "0.25rem",
      2: "0.5rem",
      3: "0.75rem",
      4: "1rem",
      5: "1.25rem",
      6: "1.5rem",
      8: "2rem",
      10: "2.5rem",
      12: "3rem",
      16: "4rem",
      20: "5rem",
      24: "6rem",
    },
    radius: {
      none: "0",
      sm: "0.125rem",
      DEFAULT: "0.25rem",
      md: "0.375rem",
      lg: "0.5rem",
      xl: "0.75rem",
      "2xl": "1rem",
      full: "9999px",
    },
    shadow: {
      sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
      DEFAULT: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
      md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
      lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
      xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    },
  }
}

/**
 * Example brand kit demonstrating all features
 *
 * This is a complete, production-ready brand kit that serves as
 * both documentation and a starting point for custom brand kits.
 *
 * @example Using as reference
 * ```typescript
 * import { EXAMPLE_BRAND_KIT } from "@platxa/frontend-agent"
 *
 * // Inspect the structure
 * console.log(EXAMPLE_BRAND_KIT.meta)
 * console.log(EXAMPLE_BRAND_KIT.semantics.light)
 * ```
 */
export const EXAMPLE_BRAND_KIT: BrandKitExport = createBrandKitTemplate({
  name: "example-brand",
  version: "1.0.0",
  description: "Example brand kit demonstrating all features",
  author: "Platxa",
  primaryHue: 250,  // Indigo
  accentHue: 330,   // Pink
})

// =============================================================================
// BRAND KIT PACKAGE TEMPLATE (Feature #46)
// =============================================================================

/**
 * Options for generating a brand kit package template
 */
export interface BrandKitPackageOptions {
  /** Package name (e.g., "@company/brand-kit") */
  packageName: string
  /** Brand display name */
  brandName: string
  /** Package version (defaults to "1.0.0") */
  version?: string
  /** Package description */
  description?: string
  /** Author name or object */
  author?: string
  /** License (defaults to "MIT") */
  license?: string
  /** Primary hue for colors (0-360) */
  primaryHue?: number
  /** Accent hue for colors (0-360) */
  accentHue?: number
}

/**
 * Generated package template files
 */
export interface BrandKitPackageTemplate {
  /** package.json content */
  "package.json": string
  /** tsconfig.json content */
  "tsconfig.json": string
  /** src/index.ts - main entry point */
  "src/index.ts": string
  /** README.md documentation */
  "README.md": string
}

/**
 * Generates a complete brand kit NPM package template
 *
 * Creates all files needed to publish a brand kit as an NPM package:
 * - package.json with proper dependencies and exports
 * - tsconfig.json for TypeScript compilation
 * - src/index.ts with the brand kit definition
 * - README.md with usage instructions
 *
 * @param options - Package customization options
 * @returns Object with file paths as keys and content as values
 *
 * @example Generate and write files
 * ```typescript
 * import { generateBrandKitPackageTemplate } from "@platxa/frontend-agent"
 * import { writeFileSync, mkdirSync } from "fs"
 *
 * const template = generateBrandKitPackageTemplate({
 *   packageName: "@acme/brand-kit",
 *   brandName: "Acme Brand",
 *   author: "Acme Inc",
 *   primaryHue: 220,
 * })
 *
 * // Create package directory
 * mkdirSync("acme-brand-kit/src", { recursive: true })
 *
 * // Write all files
 * for (const [path, content] of Object.entries(template)) {
 *   writeFileSync(\`acme-brand-kit/\${path}\`, content)
 * }
 *
 * // Then: cd acme-brand-kit && npm install && npm run build
 * ```
 *
 * @example CLI usage pattern
 * ```bash
 * # After generating files:
 * cd my-brand-kit
 * npm install
 * npm run build
 * npm publish  # or npm link for local development
 * ```
 */
export function generateBrandKitPackageTemplate(
  options: BrandKitPackageOptions
): BrandKitPackageTemplate {
  const {
    packageName,
    brandName,
    version = "1.0.0",
    description = `Brand kit for ${brandName}`,
    author = "",
    license = "MIT",
    primaryHue = 220,
    accentHue = 280,
  } = options

  // Generate package.json
  const packageJson = {
    name: packageName,
    version,
    description,
    author,
    license,
    type: "module",
    main: "./dist/index.js",
    module: "./dist/index.js",
    types: "./dist/index.d.ts",
    exports: {
      ".": {
        import: "./dist/index.js",
        types: "./dist/index.d.ts",
      },
    },
    files: ["dist"],
    scripts: {
      build: "tsc",
      prepublishOnly: "npm run build",
    },
    peerDependencies: {
      "@platxa/frontend-agent": "^1.0.0",
    },
    devDependencies: {
      "@platxa/frontend-agent": "^1.0.0",
      typescript: "^5.0.0",
    },
    keywords: ["brand-kit", "platxa", "design-tokens", "theme"],
  }

  // Generate tsconfig.json
  const tsConfig = {
    compilerOptions: {
      target: "ES2020",
      module: "ESNext",
      moduleResolution: "bundler",
      declaration: true,
      declarationMap: true,
      outDir: "./dist",
      rootDir: "./src",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist"],
  }

  // Generate src/index.ts
  const indexTs = `/**
 * ${brandName} Brand Kit
 *
 * Custom brand kit for @platxa/frontend-agent
 *
 * @example Usage
 * \`\`\`typescript
 * // platxa.config.ts
 * import { defineFrontendConfig } from "@platxa/frontend-agent"
 *
 * export default defineFrontendConfig({
 *   brand: { package: "${packageName}" }
 * })
 * \`\`\`
 *
 * @packageDocumentation
 */

import { defineBrandKit, type BrandKitExport } from "@platxa/frontend-agent"

/**
 * ${brandName} brand kit definition
 */
const brandKit: BrandKitExport = defineBrandKit({
  meta: {
    name: "${brandName.toLowerCase().replace(/\s+/g, "-")}",
    version: "${version}",
    description: "${description}",
    author: "${author}",
  },

  // Color primitives - 12-step scales for each color
  primitives: {
    primary: {
      1: "hsl(${primaryHue} 100% 99%)",
      2: "hsl(${primaryHue} 100% 98%)",
      3: "hsl(${primaryHue} 95% 94%)",
      4: "hsl(${primaryHue} 90% 88%)",
      5: "hsl(${primaryHue} 85% 80%)",
      6: "hsl(${primaryHue} 80% 70%)",
      7: "hsl(${primaryHue} 75% 60%)",
      8: "hsl(${primaryHue} 70% 50%)",
      9: "hsl(${primaryHue} 65% 42%)",
      10: "hsl(${primaryHue} 60% 35%)",
      11: "hsl(${primaryHue} 55% 28%)",
      12: "hsl(${primaryHue} 50% 15%)",
    },
    accent: {
      1: "hsl(${accentHue} 100% 99%)",
      2: "hsl(${accentHue} 100% 98%)",
      3: "hsl(${accentHue} 95% 94%)",
      4: "hsl(${accentHue} 90% 88%)",
      5: "hsl(${accentHue} 85% 80%)",
      6: "hsl(${accentHue} 80% 70%)",
      7: "hsl(${accentHue} 75% 60%)",
      8: "hsl(${accentHue} 70% 50%)",
      9: "hsl(${accentHue} 65% 42%)",
      10: "hsl(${accentHue} 60% 35%)",
      11: "hsl(${accentHue} 55% 28%)",
      12: "hsl(${accentHue} 50% 15%)",
    },
    neutral: {
      1: "hsl(0 0% 99%)",
      2: "hsl(0 0% 98%)",
      3: "hsl(0 0% 94%)",
      4: "hsl(0 0% 88%)",
      5: "hsl(0 0% 80%)",
      6: "hsl(0 0% 70%)",
      7: "hsl(0 0% 55%)",
      8: "hsl(0 0% 40%)",
      9: "hsl(0 0% 30%)",
      10: "hsl(0 0% 20%)",
      11: "hsl(0 0% 12%)",
      12: "hsl(0 0% 5%)",
    },
  },

  // Semantic colors for light and dark modes
  semantics: {
    light: {
      background: "hsl(0 0% 100%)",
      foreground: "hsl(0 0% 5%)",
      card: "hsl(0 0% 100%)",
      cardForeground: "hsl(0 0% 5%)",
      popover: "hsl(0 0% 100%)",
      popoverForeground: "hsl(0 0% 5%)",
      primary: "hsl(${primaryHue} 70% 50%)",
      primaryForeground: "hsl(0 0% 100%)",
      secondary: "hsl(0 0% 96%)",
      secondaryForeground: "hsl(0 0% 10%)",
      muted: "hsl(0 0% 96%)",
      mutedForeground: "hsl(0 0% 45%)",
      accent: "hsl(${accentHue} 65% 50%)",
      accentForeground: "hsl(0 0% 100%)",
      destructive: "hsl(0 85% 60%)",
      destructiveForeground: "hsl(0 0% 100%)",
      border: "hsl(0 0% 90%)",
      input: "hsl(0 0% 90%)",
      ring: "hsl(${primaryHue} 70% 50%)",
    },
    dark: {
      background: "hsl(0 0% 5%)",
      foreground: "hsl(0 0% 98%)",
      card: "hsl(0 0% 8%)",
      cardForeground: "hsl(0 0% 98%)",
      popover: "hsl(0 0% 8%)",
      popoverForeground: "hsl(0 0% 98%)",
      primary: "hsl(${primaryHue} 65% 55%)",
      primaryForeground: "hsl(0 0% 100%)",
      secondary: "hsl(0 0% 15%)",
      secondaryForeground: "hsl(0 0% 98%)",
      muted: "hsl(0 0% 15%)",
      mutedForeground: "hsl(0 0% 65%)",
      accent: "hsl(${accentHue} 60% 55%)",
      accentForeground: "hsl(0 0% 100%)",
      destructive: "hsl(0 65% 50%)",
      destructiveForeground: "hsl(0 0% 100%)",
      border: "hsl(0 0% 18%)",
      input: "hsl(0 0% 18%)",
      ring: "hsl(${primaryHue} 65% 55%)",
    },
  },

  // Typography scale
  typography: {
    fontSize: {
      xs: { fontSize: "0.75rem", lineHeight: "1rem" },
      sm: { fontSize: "0.875rem", lineHeight: "1.25rem" },
      base: { fontSize: "1rem", lineHeight: "1.5rem" },
      lg: { fontSize: "1.125rem", lineHeight: "1.75rem" },
      xl: { fontSize: "1.25rem", lineHeight: "1.75rem" },
      "2xl": { fontSize: "1.5rem", lineHeight: "2rem" },
      "3xl": { fontSize: "1.875rem", lineHeight: "2.25rem" },
      "4xl": { fontSize: "2.25rem", lineHeight: "2.5rem" },
    },
  },

  // Spacing scale
  spacing: {
    0: "0px",
    1: "0.25rem",
    2: "0.5rem",
    3: "0.75rem",
    4: "1rem",
    5: "1.25rem",
    6: "1.5rem",
    8: "2rem",
    10: "2.5rem",
    12: "3rem",
    16: "4rem",
  },

  // Border radius scale
  radius: {
    none: "0",
    sm: "0.125rem",
    DEFAULT: "0.25rem",
    md: "0.375rem",
    lg: "0.5rem",
    xl: "0.75rem",
    "2xl": "1rem",
    full: "9999px",
  },

  // Shadow scale
  shadow: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    DEFAULT: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  },
})

export default brandKit
`

  // Generate README.md
  const readmeMd = `# ${brandName} Brand Kit

Custom brand kit for [@platxa/frontend-agent](https://github.com/platxa/frontend-agent).

## Installation

\`\`\`bash
npm install ${packageName}
\`\`\`

## Usage

\`\`\`typescript
// platxa.config.ts
import { defineFrontendConfig } from "@platxa/frontend-agent"

export default defineFrontendConfig({
  brand: { package: "${packageName}" }
})
\`\`\`

## Customization

Edit \`src/index.ts\` to customize:

- **Colors**: Modify the \`primaryHue\` and \`accentHue\` values
- **Semantics**: Adjust light/dark mode semantic colors
- **Typography**: Customize font sizes and line heights
- **Spacing**: Modify the spacing scale
- **Radius**: Adjust border radius values
- **Shadows**: Customize shadow values

## Development

\`\`\`bash
# Install dependencies
npm install

# Build
npm run build

# Link for local development
npm link
\`\`\`

## License

${license}
`

  return {
    "package.json": JSON.stringify(packageJson, null, 2),
    "tsconfig.json": JSON.stringify(tsConfig, null, 2),
    "src/index.ts": indexTs,
    "README.md": readmeMd,
  }
}
