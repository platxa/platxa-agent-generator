/**
 * Brand Configuration System - Tests
 *
 * Comprehensive tests for resolveConfig, validateConfig, and related utilities.
 * Tests cover all configuration scenarios including:
 * - Zero-config defaults
 * - Built-in theme presets
 * - Brand kit opt-in
 * - Environment-specific overrides
 * - Configuration validation
 * - Tree shaking support
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  resolveConfig,
  validateConfig,
  formatValidationResult,
  defineFrontendConfig,
  defineBrandKit,
  isBuiltInPreset,
  getBuiltInTheme,
  getBuiltInPresetNames,
  getAllPresetNames,
  getCurrentEnvironment,
  usesBrandKit,
  usesBuiltInTheme,
  getEffectivePreset,
  createBrandKitTemplate,
  generateBrandKitPackageTemplate,
  validateTreeShakingConfig,
  getTreeShakingBestPractices,
  BUILTIN_PRESETS,
  DEFAULT_CONFIG,
  EXAMPLE_BRAND_KIT,
  type ConfigValidationResult,
} from "../config"
import type { FrontendConfig } from "../types"

// =============================================================================
// TEST FIXTURES
// =============================================================================

const validBrandConfig: FrontendConfig = {
  brand: {
    package: "@acme/brand-kit",
  },
}

const validThemeConfig: FrontendConfig = {
  theme: {
    preset: "blue",
  },
}

const validCustomThemeConfig: FrontendConfig = {
  theme: {
    preset: "default",
    custom: {
      primaryHue: 220,
      saturation: "high",
      useOklch: true,
    },
  },
}

const configWithEnvironments: FrontendConfig = {
  brand: { package: "@acme/brand-kit" },
  environments: {
    development: {
      brand: { package: "./local-brand" },
    },
    staging: {
      brand: {
        overrides: { colors: { accent: "hsl(45 100% 50%)" } },
      },
    },
  },
}

// =============================================================================
// resolveConfig TESTS
// =============================================================================

describe("resolveConfig", () => {
  describe("zero-config defaults", () => {
    it("returns default config when no config provided", () => {
      const result = resolveConfig()

      expect(result.mode).toBe("builtin")
      expect(result.preset).toBe("default")
      expect(result.themeConfig).toBeDefined()
    })

    it("returns default config when undefined provided", () => {
      const result = resolveConfig(undefined)

      expect(result.mode).toBe("builtin")
      expect(result.preset).toBe("default")
    })

    it("returns default config when empty object provided", () => {
      const result = resolveConfig({})

      expect(result.mode).toBe("builtin")
      expect(result.preset).toBe("default")
    })
  })

  describe("built-in theme presets", () => {
    it("resolves default preset", () => {
      const result = resolveConfig({ theme: { preset: "default" } })

      expect(result.mode).toBe("builtin")
      expect(result.preset).toBe("default")
      expect(result.themeConfig).toBeDefined()
    })

    it("resolves blue preset", () => {
      const result = resolveConfig({ theme: { preset: "blue" } })

      expect(result.mode).toBe("builtin")
      expect(result.preset).toBe("blue")
      expect(result.themeConfig).toBeDefined()
    })

    it("resolves green preset", () => {
      const result = resolveConfig({ theme: { preset: "green" } })

      expect(result.mode).toBe("builtin")
      expect(result.preset).toBe("green")
    })

    it("resolves violet preset", () => {
      const result = resolveConfig({ theme: { preset: "violet" } })

      expect(result.mode).toBe("builtin")
      expect(result.preset).toBe("violet")
    })

    it("resolves purple as violet (alias)", () => {
      const result = resolveConfig({ theme: { preset: "purple" } })

      expect(result.mode).toBe("builtin")
      expect(result.preset).toBe("purple")
      // Theme should be violet theme
      expect(result.themeConfig).toBeDefined()
    })

    it("falls back to default for unrecognized preset", () => {
      const result = resolveConfig({ theme: { preset: "unknown-preset" as any } })

      expect(result.mode).toBe("builtin")
      expect(result.themeConfig).toBeDefined()
    })
  })

  describe("custom theme options", () => {
    it("resolves config with custom theme", () => {
      const result = resolveConfig(validCustomThemeConfig)

      expect(result.mode).toBe("builtin")
      expect(result.custom).toEqual({
        primaryHue: 220,
        saturation: "high",
        useOklch: true,
      })
    })

    it("includes custom options in resolved config", () => {
      const config: FrontendConfig = {
        theme: {
          preset: "default",
          custom: { primaryHue: 180 },
        },
      }
      const result = resolveConfig(config)

      expect(result.custom?.primaryHue).toBe(180)
    })
  })

  describe("brand kit mode", () => {
    it("resolves to brand mode when package specified", () => {
      const result = resolveConfig(validBrandConfig)

      expect(result.mode).toBe("brand")
      expect(result.brandPackage).toBe("@acme/brand-kit")
    })

    it("includes brand overrides in resolved config", () => {
      const config: FrontendConfig = {
        brand: {
          package: "@acme/brand-kit",
          overrides: {
            colors: { primary: "hsl(220 100% 50%)" },
          },
        },
      }
      const result = resolveConfig(config)

      expect(result.mode).toBe("brand")
      expect(result.brandOverrides).toEqual({
        colors: { primary: "hsl(220 100% 50%)" },
      })
    })

    it("falls back to default theme until brand is loaded", () => {
      const result = resolveConfig(validBrandConfig)

      expect(result.themeConfig).toBeDefined()
      expect(result.preset).toBe("default")
    })
  })

  describe("environment-specific overrides", () => {
    const originalEnv = process.env.NODE_ENV

    afterEach(() => {
      process.env.NODE_ENV = originalEnv
    })

    it("applies development override when NODE_ENV=development", () => {
      process.env.NODE_ENV = "development"

      const result = resolveConfig(configWithEnvironments)

      expect(result.mode).toBe("brand")
      expect(result.brandPackage).toBe("./local-brand")
    })

    it("applies staging override when NODE_ENV=staging", () => {
      process.env.NODE_ENV = "staging"

      const result = resolveConfig(configWithEnvironments)

      expect(result.mode).toBe("brand")
      expect(result.brandPackage).toBe("@acme/brand-kit")
      expect(result.brandOverrides?.colors?.accent).toBe("hsl(45 100% 50%)")
    })

    it("uses base config when NODE_ENV=production", () => {
      process.env.NODE_ENV = "production"

      const result = resolveConfig(configWithEnvironments)

      expect(result.mode).toBe("brand")
      expect(result.brandPackage).toBe("@acme/brand-kit")
      expect(result.brandOverrides).toBeUndefined()
    })

    it("respects options.env override", () => {
      process.env.NODE_ENV = "production"

      const result = resolveConfig(configWithEnvironments, { env: "development" })

      expect(result.brandPackage).toBe("./local-brand")
    })

    it("handles missing environment gracefully", () => {
      const config: FrontendConfig = {
        theme: { preset: "blue" },
        environments: {
          development: { theme: { preset: "green" } },
        },
      }

      const result = resolveConfig(config, { env: "production" })

      expect(result.preset).toBe("blue")
    })
  })
})

// =============================================================================
// validateConfig TESTS
// =============================================================================

describe("validateConfig", () => {
  describe("valid configurations", () => {
    it("validates empty config as valid", () => {
      const result = validateConfig({})

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.details).toHaveLength(0)
    })

    it("validates default theme preset", () => {
      const result = validateConfig({ theme: { preset: "default" } })

      expect(result.valid).toBe(true)
    })

    it("validates all built-in presets", () => {
      for (const preset of BUILTIN_PRESETS) {
        const result = validateConfig({ theme: { preset } })
        expect(result.valid).toBe(true)
      }
    })

    it("validates valid brand package", () => {
      const result = validateConfig({ brand: { package: "@acme/brand-kit" } })

      expect(result.valid).toBe(true)
    })

    it("validates relative package path", () => {
      const result = validateConfig({ brand: { package: "./my-brand" } })

      expect(result.valid).toBe(true)
    })

    it("validates absolute package path", () => {
      const result = validateConfig({ brand: { package: "/path/to/brand" } })

      expect(result.valid).toBe(true)
    })

    it("validates valid custom theme", () => {
      const result = validateConfig({
        theme: {
          preset: "default",
          custom: {
            primaryHue: 220,
            saturation: "medium",
            useOklch: true,
          },
        },
      })

      expect(result.valid).toBe(true)
    })
  })

  describe("invalid theme.preset", () => {
    it("rejects invalid preset name", () => {
      const result = validateConfig({ theme: { preset: "invalid-preset" as any } })

      expect(result.valid).toBe(false)
      expect(result.details[0].field).toBe("theme.preset")
      expect(result.details[0].message).toContain("Invalid preset")
      expect(result.details[0].suggestion).toBeDefined()
    })
  })

  describe("invalid theme.custom", () => {
    it("requires primaryHue when custom is specified", () => {
      const result = validateConfig({
        theme: { custom: {} as any },
      })

      expect(result.valid).toBe(false)
      expect(result.details[0].field).toBe("theme.custom.primaryHue")
    })

    it("rejects non-number primaryHue", () => {
      const result = validateConfig({
        theme: { custom: { primaryHue: "220" as any } },
      })

      expect(result.valid).toBe(false)
      expect(result.details[0].field).toBe("theme.custom.primaryHue")
      expect(result.details[0].message).toContain("Expected number")
    })

    it("rejects primaryHue out of range (< 0)", () => {
      const result = validateConfig({
        theme: { custom: { primaryHue: -10 } },
      })

      expect(result.valid).toBe(false)
      expect(result.details[0].message).toContain("out of range")
    })

    it("rejects primaryHue out of range (> 360)", () => {
      const result = validateConfig({
        theme: { custom: { primaryHue: 400 } },
      })

      expect(result.valid).toBe(false)
      expect(result.details[0].message).toContain("out of range")
    })

    it("rejects invalid saturation value", () => {
      const result = validateConfig({
        theme: { custom: { primaryHue: 220, saturation: "ultra" as any } },
      })

      expect(result.valid).toBe(false)
      expect(result.details[0].field).toBe("theme.custom.saturation")
    })

    it("rejects non-boolean useOklch", () => {
      const result = validateConfig({
        theme: { custom: { primaryHue: 220, useOklch: "yes" as any } },
      })

      expect(result.valid).toBe(false)
      expect(result.details[0].field).toBe("theme.custom.useOklch")
    })
  })

  describe("invalid brand.package", () => {
    it("rejects non-string package", () => {
      const result = validateConfig({
        brand: { package: 123 as any },
      })

      expect(result.valid).toBe(false)
      expect(result.details[0].field).toBe("brand.package")
    })

    it("rejects empty package name", () => {
      const result = validateConfig({
        brand: { package: "" },
      })

      expect(result.valid).toBe(false)
      expect(result.details[0].message).toContain("cannot be empty")
    })

    it("rejects whitespace-only package name", () => {
      const result = validateConfig({
        brand: { package: "   " },
      })

      expect(result.valid).toBe(false)
    })

    it("rejects package name with spaces", () => {
      const result = validateConfig({
        brand: { package: "my brand kit" },
      })

      expect(result.valid).toBe(false)
      expect(result.details[0].message).toContain("spaces")
    })
  })

  describe("invalid brand.overrides", () => {
    it("rejects non-object overrides", () => {
      const result = validateConfig({
        brand: { package: "@acme/brand", overrides: "invalid" as any },
      })

      expect(result.valid).toBe(false)
      expect(result.details[0].field).toBe("brand.overrides")
    })

    it("rejects array overrides", () => {
      const result = validateConfig({
        brand: { package: "@acme/brand", overrides: [] as any },
      })

      expect(result.valid).toBe(false)
    })
  })

  describe("invalid environments", () => {
    it("rejects non-object environments", () => {
      const result = validateConfig({
        environments: "invalid" as any,
      })

      expect(result.valid).toBe(false)
      expect(result.details[0].field).toBe("environments")
    })

    it("rejects array environments", () => {
      const result = validateConfig({
        environments: [] as any,
      })

      expect(result.valid).toBe(false)
    })

    it("rejects non-object environment config", () => {
      const result = validateConfig({
        environments: {
          development: "invalid" as any,
        },
      })

      expect(result.valid).toBe(false)
      expect(result.details[0].field).toBe("environments.development")
    })

    it("rejects nested environments", () => {
      const result = validateConfig({
        environments: {
          development: {
            environments: { staging: {} },
          } as any,
        },
      })

      expect(result.valid).toBe(false)
      expect(result.details[0].message).toContain("Nested environments")
    })
  })

  describe("warnings", () => {
    it("warns when both theme and brand.package specified", () => {
      const result = validateConfig({
        theme: { preset: "blue" },
        brand: { package: "@acme/brand-kit" },
      })

      expect(result.valid).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warningDetails[0].field).toBe("theme + brand.package")
    })

    it("warns when custom theme with brand package", () => {
      const result = validateConfig({
        theme: { custom: { primaryHue: 220 } },
        brand: { package: "@acme/brand-kit" },
      })

      expect(result.valid).toBe(true)
      expect(result.warningDetails.some((w) => w.field === "theme.custom")).toBe(true)
    })
  })

  describe("multiple errors", () => {
    it("reports all validation errors", () => {
      const result = validateConfig({
        theme: { preset: "invalid" as any, custom: { primaryHue: 500 } },
        brand: { package: "" },
      })

      expect(result.valid).toBe(false)
      expect(result.details.length).toBeGreaterThan(1)
    })
  })
})

// =============================================================================
// formatValidationResult TESTS
// =============================================================================

describe("formatValidationResult", () => {
  it("formats valid result as empty string", () => {
    const result: ConfigValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      details: [],
      warningDetails: [],
    }

    const formatted = formatValidationResult(result)

    expect(formatted).toBe("")
  })

  it("formats errors with field paths", () => {
    const result: ConfigValidationResult = {
      valid: false,
      errors: ["theme.preset: Invalid preset"],
      warnings: [],
      details: [
        {
          field: "theme.preset",
          message: 'Invalid preset "foo"',
          suggestion: "Use one of: default, blue, green, violet",
        },
      ],
      warningDetails: [],
    }

    const formatted = formatValidationResult(result)

    expect(formatted).toContain("Configuration validation failed")
    expect(formatted).toContain("theme.preset")
    expect(formatted).toContain("Invalid preset")
    expect(formatted).toContain("Suggestion")
  })

  it("formats warnings separately", () => {
    const result: ConfigValidationResult = {
      valid: true,
      errors: [],
      warnings: ["theme + brand: Both specified"],
      details: [],
      warningDetails: [
        {
          field: "theme + brand",
          message: "Both theme and brand specified",
        },
      ],
    }

    const formatted = formatValidationResult(result)

    expect(formatted).toContain("Warnings")
    expect(formatted).toContain("theme + brand")
  })
})

// =============================================================================
// HELPER FUNCTION TESTS
// =============================================================================

describe("defineFrontendConfig", () => {
  it("returns the same config object", () => {
    const config: FrontendConfig = { theme: { preset: "blue" } }
    const result = defineFrontendConfig(config)

    expect(result).toEqual(config)
  })
})

describe("defineBrandKit", () => {
  it("returns the same brand kit object", () => {
    const brandKit = EXAMPLE_BRAND_KIT
    const result = defineBrandKit(brandKit)

    expect(result).toEqual(brandKit)
  })
})

describe("isBuiltInPreset", () => {
  it("returns true for built-in presets", () => {
    expect(isBuiltInPreset("default")).toBe(true)
    expect(isBuiltInPreset("blue")).toBe(true)
    expect(isBuiltInPreset("green")).toBe(true)
    expect(isBuiltInPreset("violet")).toBe(true)
  })

  it("returns false for non-built-in presets", () => {
    expect(isBuiltInPreset("custom")).toBe(false)
    expect(isBuiltInPreset("purple")).toBe(false)
    expect(isBuiltInPreset("unknown")).toBe(false)
  })
})

describe("getBuiltInTheme", () => {
  it("returns theme config for each preset", () => {
    expect(getBuiltInTheme("default")).toBeDefined()
    expect(getBuiltInTheme("blue")).toBeDefined()
    expect(getBuiltInTheme("green")).toBeDefined()
    expect(getBuiltInTheme("violet")).toBeDefined()
  })

  it("returns violet theme for purple alias", () => {
    const violetTheme = getBuiltInTheme("violet")
    const purpleTheme = getBuiltInTheme("purple")

    expect(purpleTheme).toEqual(violetTheme)
  })

  it("returns default theme for unknown preset", () => {
    const defaultTheme = getBuiltInTheme("default")
    const unknownTheme = getBuiltInTheme("unknown" as any)

    expect(unknownTheme).toEqual(defaultTheme)
  })
})

describe("getBuiltInPresetNames", () => {
  it("returns all built-in presets", () => {
    const presets = getBuiltInPresetNames()

    expect(presets).toContain("default")
    expect(presets).toContain("blue")
    expect(presets).toContain("green")
    expect(presets).toContain("violet")
    expect(presets.length).toBe(4)
  })

  it("returns frozen array", () => {
    const presets = getBuiltInPresetNames()

    expect(Object.isFrozen(presets)).toBe(true)
  })
})

describe("getAllPresetNames", () => {
  it("returns array of preset names", () => {
    const presets = getAllPresetNames()

    expect(Array.isArray(presets)).toBe(true)
    expect(presets.length).toBeGreaterThan(0)
  })
})

describe("getCurrentEnvironment", () => {
  const originalEnv = process.env.NODE_ENV

  afterEach(() => {
    process.env.NODE_ENV = originalEnv
  })

  it("returns NODE_ENV value when set", () => {
    process.env.NODE_ENV = "development"
    expect(getCurrentEnvironment()).toBe("development")

    process.env.NODE_ENV = "production"
    expect(getCurrentEnvironment()).toBe("production")

    process.env.NODE_ENV = "staging"
    expect(getCurrentEnvironment()).toBe("staging")
  })

  it("returns production when NODE_ENV not set", () => {
    delete process.env.NODE_ENV

    expect(getCurrentEnvironment()).toBe("production")
  })
})

describe("usesBrandKit", () => {
  it("returns true when brand.package is specified", () => {
    expect(usesBrandKit({ brand: { package: "@acme/brand" } })).toBe(true)
  })

  it("returns false when brand.package is not specified", () => {
    expect(usesBrandKit({})).toBe(false)
    expect(usesBrandKit({ theme: { preset: "blue" } })).toBe(false)
    expect(usesBrandKit(undefined)).toBe(false)
  })
})

describe("usesBuiltInTheme", () => {
  it("returns true when brand.package is not specified", () => {
    expect(usesBuiltInTheme({})).toBe(true)
    expect(usesBuiltInTheme({ theme: { preset: "blue" } })).toBe(true)
    expect(usesBuiltInTheme(undefined)).toBe(true)
  })

  it("returns false when brand.package is specified", () => {
    expect(usesBuiltInTheme({ brand: { package: "@acme/brand" } })).toBe(false)
  })
})

describe("getEffectivePreset", () => {
  it("returns specified preset", () => {
    expect(getEffectivePreset({ theme: { preset: "blue" } })).toBe("blue")
    expect(getEffectivePreset({ theme: { preset: "green" } })).toBe("green")
  })

  it("returns default when no preset specified", () => {
    expect(getEffectivePreset({})).toBe("default")
    expect(getEffectivePreset(undefined)).toBe("default")
  })
})

// =============================================================================
// BRAND KIT TEMPLATE TESTS
// =============================================================================

describe("createBrandKitTemplate", () => {
  it("creates template with required name", () => {
    const template = createBrandKitTemplate({ name: "my-brand" })

    expect(template.meta.name).toBe("my-brand")
    expect(template.meta.version).toBe("1.0.0")
    expect(template.meta.description).toContain("my-brand")
  })

  it("uses provided options", () => {
    const template = createBrandKitTemplate({
      name: "acme-brand",
      version: "2.0.0",
      description: "Custom description",
      author: "John Doe",
      primaryHue: 180,
      accentHue: 45,
    })

    expect(template.meta.version).toBe("2.0.0")
    expect(template.meta.description).toBe("Custom description")
    expect(template.meta.author).toBe("John Doe")
  })

  it("generates 12-step color scales", () => {
    const template = createBrandKitTemplate({ name: "test" })

    expect(Object.keys(template.primitives.primary)).toHaveLength(12)
    expect(Object.keys(template.primitives.accent)).toHaveLength(12)
    expect(Object.keys(template.primitives.neutral)).toHaveLength(12)
  })

  it("generates light and dark semantics", () => {
    const template = createBrandKitTemplate({ name: "test" })

    expect(template.semantics.light).toBeDefined()
    expect(template.semantics.dark).toBeDefined()
    expect(template.semantics.light.background).toBeDefined()
    expect(template.semantics.dark.background).toBeDefined()
  })

  it("includes typography, spacing, radius, and shadow", () => {
    const template = createBrandKitTemplate({ name: "test" })

    expect(template.typography).toBeDefined()
    expect(template.spacing).toBeDefined()
    expect(template.radius).toBeDefined()
    expect(template.shadow).toBeDefined()
  })
})

describe("EXAMPLE_BRAND_KIT", () => {
  it("is a valid brand kit", () => {
    expect(EXAMPLE_BRAND_KIT.meta.name).toBe("example-brand")
    expect(EXAMPLE_BRAND_KIT.primitives).toBeDefined()
    expect(EXAMPLE_BRAND_KIT.semantics).toBeDefined()
  })
})

// =============================================================================
// PACKAGE TEMPLATE TESTS
// =============================================================================

describe("generateBrandKitPackageTemplate", () => {
  it("generates all required files", () => {
    const template = generateBrandKitPackageTemplate({
      packageName: "@acme/brand-kit",
      brandName: "Acme Brand",
    })

    expect(template["package.json"]).toBeDefined()
    expect(template["tsconfig.json"]).toBeDefined()
    expect(template["src/index.ts"]).toBeDefined()
    expect(template["README.md"]).toBeDefined()
  })

  it("generates valid package.json", () => {
    const template = generateBrandKitPackageTemplate({
      packageName: "@acme/brand-kit",
      brandName: "Acme Brand",
      version: "2.0.0",
      author: "John Doe",
    })

    const pkg = JSON.parse(template["package.json"])

    expect(pkg.name).toBe("@acme/brand-kit")
    expect(pkg.version).toBe("2.0.0")
    expect(pkg.author).toBe("John Doe")
    expect(pkg.type).toBe("module")
    expect(pkg.sideEffects).toBe(false)
  })

  it("includes tree shaking support in package.json", () => {
    const template = generateBrandKitPackageTemplate({
      packageName: "@acme/brand-kit",
      brandName: "Acme Brand",
    })

    const pkg = JSON.parse(template["package.json"])

    expect(pkg.sideEffects).toBe(false)
    expect(pkg.exports["."]).toBeDefined()
    expect(pkg.exports["."].import).toBeDefined()
  })

  it("generates valid tsconfig.json", () => {
    const template = generateBrandKitPackageTemplate({
      packageName: "@acme/brand-kit",
      brandName: "Acme Brand",
    })

    const tsconfig = JSON.parse(template["tsconfig.json"])

    expect(tsconfig.compilerOptions.module).toBe("ESNext")
    expect(tsconfig.compilerOptions.declaration).toBe(true)
  })

  it("generates source with brand name", () => {
    const template = generateBrandKitPackageTemplate({
      packageName: "@acme/brand-kit",
      brandName: "Acme Brand",
    })

    expect(template["src/index.ts"]).toContain("Acme Brand")
    expect(template["src/index.ts"]).toContain("@acme/brand-kit")
  })

  it("generates README with usage instructions", () => {
    const template = generateBrandKitPackageTemplate({
      packageName: "@acme/brand-kit",
      brandName: "Acme Brand",
    })

    expect(template["README.md"]).toContain("@acme/brand-kit")
    expect(template["README.md"]).toContain("npm install")
    expect(template["README.md"]).toContain("Usage")
  })
})

// =============================================================================
// TREE SHAKING VALIDATION TESTS
// =============================================================================

describe("validateTreeShakingConfig", () => {
  it("validates correct ESM package", () => {
    const pkg = {
      type: "module",
      sideEffects: false,
      module: "./dist/index.js",
      exports: {
        ".": {
          import: "./dist/index.js",
          types: "./dist/index.d.ts",
        },
      },
    }

    const result = validateTreeShakingConfig(pkg)

    expect(result.valid).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it("reports missing type: module", () => {
    const pkg = {
      sideEffects: false,
    }

    const result = validateTreeShakingConfig(pkg)

    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.includes("type"))).toBe(true)
  })

  it("reports missing sideEffects", () => {
    const pkg = {
      type: "module",
    }

    const result = validateTreeShakingConfig(pkg)

    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.includes("sideEffects"))).toBe(true)
  })

  it("reports missing module entry point", () => {
    const pkg = {
      type: "module",
      sideEffects: false,
    }

    const result = validateTreeShakingConfig(pkg)

    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.includes("module") || i.includes("exports"))).toBe(true)
  })

  it("accepts sideEffects as array", () => {
    const pkg = {
      type: "module",
      sideEffects: ["*.css"],
      module: "./dist/index.js",
    }

    const result = validateTreeShakingConfig(pkg)

    expect(result.valid).toBe(true)
  })

  it("provides recommendations", () => {
    const pkg = {}

    const result = validateTreeShakingConfig(pkg)

    expect(result.recommendations.length).toBeGreaterThan(0)
  })
})

describe("getTreeShakingBestPractices", () => {
  it("returns array of best practices", () => {
    const practices = getTreeShakingBestPractices()

    expect(Array.isArray(practices)).toBe(true)
    expect(practices.length).toBeGreaterThan(0)
  })

  it("includes sideEffects recommendation", () => {
    const practices = getTreeShakingBestPractices()

    expect(practices.some((p) => p.includes("sideEffects"))).toBe(true)
  })
})

// =============================================================================
// CONSTANTS TESTS
// =============================================================================

describe("BUILTIN_PRESETS", () => {
  it("is frozen", () => {
    expect(Object.isFrozen(BUILTIN_PRESETS)).toBe(true)
  })

  it("contains expected presets", () => {
    expect(BUILTIN_PRESETS).toContain("default")
    expect(BUILTIN_PRESETS).toContain("blue")
    expect(BUILTIN_PRESETS).toContain("green")
    expect(BUILTIN_PRESETS).toContain("violet")
  })
})

describe("DEFAULT_CONFIG", () => {
  it("has default theme preset", () => {
    expect(DEFAULT_CONFIG.theme?.preset).toBe("default")
  })

  it("does not have brand specified", () => {
    expect(DEFAULT_CONFIG.brand).toBeUndefined()
  })
})
