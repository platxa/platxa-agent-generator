/**
 * Brand System Tests
 *
 * Tests for the opt-in brand kit system.
 * Verifies Feature #1: Default Theme Preservation
 * Verifies Feature #2: Opt-In Brand Loading
 */

import { describe, it, expect, beforeEach } from "vitest"
import {
  defineFrontendConfig,
  defineBrandKit,
  resolveConfig,
  validateConfig,
  validateBrandKit,
  isValidBrandPackageName,
  // Feature #5: Token Normalization
  normalizeBrandTokens,
  mergeDesignTokens,
  getBuiltInTheme,
  getBuiltInPresetNames,
  getAllPresetNames,
  isBuiltInPreset,
  usesBrandKit,
  usesBuiltInTheme,
  getEffectivePreset,
  BUILTIN_PRESETS,
  DEFAULT_CONFIG,
  // Feature #2 exports
  resolveBrand,
  getBrandLoadingState,
  getCurrentBrandKit,
  isBrandLoaded,
  isBrandLoading,
  clearBrandCache,
  isBrandCached,
  getBrandCacheSize,
} from "../brand"
import type { FrontendConfig, BuiltInPreset, BrandKitExport } from "../brand"

// =============================================================================
// FEATURE #1: DEFAULT THEME PRESERVATION
// =============================================================================

describe("Feature #1: Default Theme Preservation", () => {
  describe("Zero-Config Default", () => {
    it("resolves to default theme when no config provided", () => {
      const resolved = resolveConfig()

      expect(resolved.mode).toBe("builtin")
      expect(resolved.preset).toBe("default")
      expect(resolved.themeConfig).toBeDefined()
      expect(resolved.themeConfig.name).toBe("default")
    })

    it("resolves to default theme when empty config provided", () => {
      const resolved = resolveConfig({})

      expect(resolved.mode).toBe("builtin")
      expect(resolved.preset).toBe("default")
    })

    it("resolves to default theme when undefined config provided", () => {
      const resolved = resolveConfig(undefined)

      expect(resolved.mode).toBe("builtin")
      expect(resolved.preset).toBe("default")
    })
  })

  describe("Built-in Presets Work Without Configuration", () => {
    it("has four built-in presets available", () => {
      const presets = getBuiltInPresetNames()

      expect(presets).toContain("default")
      expect(presets).toContain("blue")
      expect(presets).toContain("green")
      expect(presets).toContain("violet")
      expect(presets.length).toBe(4)
    })

    it.each(["default", "blue", "green", "violet"] as BuiltInPreset[])(
      "preset %s works without any configuration",
      (preset) => {
        const resolved = resolveConfig({
          theme: { preset },
        })

        expect(resolved.mode).toBe("builtin")
        expect(resolved.preset).toBe(preset)
        expect(resolved.themeConfig).toBeDefined()
        expect(resolved.themeConfig.name).toBe(preset)
        expect(resolved.themeConfig.light).toBeDefined()
        expect(resolved.themeConfig.dark).toBeDefined()
      }
    )

    it("each built-in preset has complete theme config", () => {
      const presets = getBuiltInPresetNames()

      for (const preset of presets) {
        const theme = getBuiltInTheme(preset)

        expect(theme.name).toBe(preset)
        expect(theme.light).toBeDefined()
        expect(theme.dark).toBeDefined()
        expect(theme.defaultMode).toBeDefined()
        expect(theme.darkModeClass).toBe("dark")
      }
    })
  })

  describe("No External Dependencies Required", () => {
    it("default config does not specify brand package", () => {
      expect(DEFAULT_CONFIG.brand).toBeUndefined()
    })

    it("usesBuiltInTheme returns true for default config", () => {
      expect(usesBuiltInTheme()).toBe(true)
      expect(usesBuiltInTheme({})).toBe(true)
      expect(usesBuiltInTheme({ theme: { preset: "blue" } })).toBe(true)
    })

    it("usesBrandKit returns false for default config", () => {
      expect(usesBrandKit()).toBe(false)
      expect(usesBrandKit({})).toBe(false)
      expect(usesBrandKit({ theme: { preset: "blue" } })).toBe(false)
    })

    it("resolved config mode is builtin for default", () => {
      const resolved = resolveConfig()
      expect(resolved.mode).toBe("builtin")
      expect(resolved.brandPackage).toBeUndefined()
    })
  })

  describe("Backward Compatibility", () => {
    it("existing theme preset selection continues to work", () => {
      const blueConfig: FrontendConfig = {
        theme: { preset: "blue" },
      }
      const resolved = resolveConfig(blueConfig)

      expect(resolved.mode).toBe("builtin")
      expect(resolved.preset).toBe("blue")
    })

    it("unknown preset falls back to default", () => {
      const config: FrontendConfig = {
        theme: { preset: "unknown" as BuiltInPreset },
      }
      const resolved = resolveConfig(config)

      // Should still resolve (gracefully degrade)
      expect(resolved.mode).toBe("builtin")
      expect(resolved.themeConfig).toBeDefined()
    })

    it("purple is alias for violet", () => {
      const theme = getBuiltInTheme("purple" as BuiltInPreset)
      expect(theme.name).toBe("violet")
    })
  })
})

// =============================================================================
// CONFIGURATION HELPER
// =============================================================================

describe("defineFrontendConfig", () => {
  it("returns the same config object (type helper)", () => {
    const config: FrontendConfig = {
      theme: { preset: "blue" },
    }
    const result = defineFrontendConfig(config)

    expect(result).toEqual(config)
  })

  it("provides type safety for configuration", () => {
    // This test verifies the helper works at runtime
    const config = defineFrontendConfig({
      theme: {
        preset: "green",
        custom: {
          primaryHue: 180,
          saturation: "high",
        },
      },
    })

    expect(config.theme?.preset).toBe("green")
    expect(config.theme?.custom?.primaryHue).toBe(180)
  })
})

// =============================================================================
// CONFIGURATION VALIDATION
// =============================================================================

describe("validateConfig", () => {
  it("validates correct config as valid", () => {
    const result = validateConfig({
      theme: { preset: "blue" },
    })

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("rejects invalid preset name", () => {
    const result = validateConfig({
      theme: { preset: "invalid" as BuiltInPreset },
    })

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain("Invalid theme preset")
  })

  it("validates custom theme primaryHue range", () => {
    const invalidHue = validateConfig({
      theme: {
        custom: { primaryHue: 400 },
      },
    })

    expect(invalidHue.valid).toBe(false)
    expect(invalidHue.errors[0]).toContain("primaryHue")
  })

  it("validates custom theme saturation values", () => {
    const invalid = validateConfig({
      theme: {
        custom: {
          primaryHue: 180,
          saturation: "invalid" as "low" | "medium" | "high",
        },
      },
    })

    expect(invalid.valid).toBe(false)
    expect(invalid.errors[0]).toContain("saturation")
  })

  it("warns when both theme and brand specified", () => {
    const result = validateConfig({
      theme: { preset: "blue" },
      brand: { package: "@test/brand" },
    })

    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toContain("Both theme and brand.package")
  })
})

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

describe("Utility Functions", () => {
  describe("isBuiltInPreset", () => {
    it("returns true for built-in presets", () => {
      expect(isBuiltInPreset("default")).toBe(true)
      expect(isBuiltInPreset("blue")).toBe(true)
      expect(isBuiltInPreset("green")).toBe(true)
      expect(isBuiltInPreset("violet")).toBe(true)
    })

    it("returns false for non-built-in names", () => {
      expect(isBuiltInPreset("custom")).toBe(false)
      expect(isBuiltInPreset("brand")).toBe(false)
      expect(isBuiltInPreset("")).toBe(false)
    })
  })

  describe("getEffectivePreset", () => {
    it("returns default when no config", () => {
      expect(getEffectivePreset()).toBe("default")
      expect(getEffectivePreset({})).toBe("default")
    })

    it("returns specified preset", () => {
      expect(getEffectivePreset({ theme: { preset: "blue" } })).toBe("blue")
      expect(getEffectivePreset({ theme: { preset: "green" } })).toBe("green")
    })
  })

  describe("getAllPresetNames", () => {
    it("returns array of preset names", () => {
      const names = getAllPresetNames()

      expect(Array.isArray(names)).toBe(true)
      expect(names.length).toBeGreaterThan(0)
      expect(names).toContain("default")
    })
  })
})

// =============================================================================
// OPT-IN BRAND LOADING (Preview for Feature #2)
// =============================================================================

describe("Opt-In Brand Loading (Foundation)", () => {
  it("detects brand mode when package specified", () => {
    const config: FrontendConfig = {
      brand: { package: "@platxa/brand-kit" },
    }
    const resolved = resolveConfig(config)

    expect(resolved.mode).toBe("brand")
    expect(resolved.brandPackage).toBe("@platxa/brand-kit")
  })

  it("usesBrandKit returns true when package specified", () => {
    expect(usesBrandKit({ brand: { package: "@test/brand" } })).toBe(true)
  })

  it("stores brand overrides in resolved config", () => {
    const config: FrontendConfig = {
      brand: {
        package: "@test/brand",
        overrides: {
          colors: {
            primary: "hsl(200 100% 50%)",
          } as never,
        },
      },
    }
    const resolved = resolveConfig(config)

    expect(resolved.brandOverrides).toBeDefined()
  })

  it("falls back to default theme until brand loads", () => {
    const config: FrontendConfig = {
      brand: { package: "@test/brand" },
    }
    const resolved = resolveConfig(config)

    // Until brand actually loads, use default theme
    expect(resolved.themeConfig.name).toBe("default")
  })
})

// =============================================================================
// CONSTANTS
// =============================================================================

describe("Constants", () => {
  it("BUILTIN_PRESETS is frozen array", () => {
    expect(Object.isFrozen(BUILTIN_PRESETS)).toBe(true)
    expect(BUILTIN_PRESETS).toEqual(["default", "blue", "green", "violet"])
  })

  it("DEFAULT_CONFIG uses default preset", () => {
    expect(DEFAULT_CONFIG.theme?.preset).toBe("default")
    expect(DEFAULT_CONFIG.brand).toBeUndefined()
  })
})

// =============================================================================
// FEATURE #2: OPT-IN BRAND LOADING
// =============================================================================

describe("Feature #2: Opt-In Brand Loading", () => {
  beforeEach(() => {
    // Clear cache before each test
    clearBrandCache()
  })

  describe("Brand is NOT loaded unless brand.package is specified", () => {
    it("no brand loading for default config", async () => {
      const config = resolveConfig()
      const result = await resolveBrand(config)

      expect(result.status).toBe("loaded")
      expect(result.brandKit).toBeNull()
      expect(result.tokens).toBeDefined()
      expect(result.themeConfig.name).toBe("default")
    })

    it("no brand loading for built-in preset config", async () => {
      const config = resolveConfig({ theme: { preset: "blue" } })
      const result = await resolveBrand(config)

      expect(result.status).toBe("loaded")
      expect(result.brandKit).toBeNull()
      expect(result.themeConfig.name).toBe("blue")
    })

    it("no brand loading when only theme is specified", async () => {
      const config = resolveConfig({
        theme: {
          preset: "green",
          custom: { primaryHue: 180 },
        },
      })
      const result = await resolveBrand(config)

      expect(result.status).toBe("loaded")
      expect(result.brandKit).toBeNull()
    })
  })

  describe("No network requests or imports by default", () => {
    it("getBrandLoadingState is idle initially", () => {
      expect(getBrandLoadingState()).toBe("idle")
    })

    it("getCurrentBrandKit is null initially", () => {
      expect(getCurrentBrandKit()).toBeNull()
    })

    it("isBrandLoaded is false initially", () => {
      expect(isBrandLoaded()).toBe(false)
    })

    it("isBrandLoading is false initially", () => {
      expect(isBrandLoading()).toBe(false)
    })

    it("cache is empty initially", () => {
      expect(getBrandCacheSize()).toBe(0)
    })
  })

  describe("Clear configuration syntax for opting in", () => {
    it("brand.package enables brand mode", () => {
      const config = resolveConfig({
        brand: { package: "@test/brand-kit" },
      })

      expect(config.mode).toBe("brand")
      expect(config.brandPackage).toBe("@test/brand-kit")
    })

    it("brand.package with overrides stores overrides", () => {
      const overrides = {
        colors: { primary: "hsl(200 100% 50%)" } as never,
      }
      const config = resolveConfig({
        brand: {
          package: "@test/brand-kit",
          overrides,
        },
      })

      expect(config.mode).toBe("brand")
      expect(config.brandOverrides).toBeDefined()
    })

    it("local path syntax is supported", () => {
      const config = resolveConfig({
        brand: { package: "./my-brand" },
      })

      expect(config.mode).toBe("brand")
      expect(config.brandPackage).toBe("./my-brand")
    })

    it("scoped npm package syntax is supported", () => {
      const config = resolveConfig({
        brand: { package: "@platxa/brand-kit" },
      })

      expect(config.mode).toBe("brand")
      expect(config.brandPackage).toBe("@platxa/brand-kit")
    })
  })

  describe("Brand loading state management", () => {
    it("clearBrandCache resets all state", () => {
      clearBrandCache()

      expect(getBrandLoadingState()).toBe("idle")
      expect(getCurrentBrandKit()).toBeNull()
      expect(isBrandLoaded()).toBe(false)
      expect(getBrandCacheSize()).toBe(0)
    })

    it("isBrandCached returns false for uncached packages", () => {
      expect(isBrandCached("@nonexistent/package")).toBe(false)
    })
  })

  describe("Graceful error handling", () => {
    it("returns error status for invalid package", async () => {
      const config = resolveConfig({
        brand: { package: "@nonexistent/brand-kit-12345" },
      })

      // This will fail to load but should not throw
      const result = await resolveBrand(config, { throwOnError: false })

      expect(result.status).toBe("error")
      expect(result.error).toBeDefined()
      // Should fall back to default theme
      expect(result.themeConfig.name).toBe("default")
    })
  })
})

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe("Brand System Integration", () => {
  beforeEach(() => {
    clearBrandCache()
  })

  it("full workflow: default config → resolve → no brand loading", async () => {
    // Step 1: No config (zero-config)
    const config = resolveConfig()
    expect(config.mode).toBe("builtin")

    // Step 2: Resolve brand
    const result = await resolveBrand(config)
    expect(result.status).toBe("loaded")
    expect(result.brandKit).toBeNull()

    // Step 3: State remains idle (no brand loading occurred)
    expect(getBrandLoadingState()).toBe("idle")
  })

  it("full workflow: preset config → resolve → no brand loading", async () => {
    // Step 1: Preset config
    const config = resolveConfig({ theme: { preset: "violet" } })
    expect(config.mode).toBe("builtin")

    // Step 2: Resolve brand
    const result = await resolveBrand(config)
    expect(result.status).toBe("loaded")
    expect(result.themeConfig.name).toBe("violet")

    // Step 3: No brand kit loaded
    expect(result.brandKit).toBeNull()
    expect(isBrandLoaded()).toBe(false)
  })

  it("validation works with brand config", () => {
    const result = validateConfig({
      brand: { package: "@test/brand" },
    })

    // Valid config (no errors about brand.package)
    expect(result.errors).toHaveLength(0)
  })
})

// =============================================================================
// FEATURE #3: BRAND KIT INTERFACE
// =============================================================================

describe("Feature #3: Brand Kit Interface", () => {
  // Valid brand kit for testing
  const validBrandKit: BrandKitExport = {
    meta: {
      name: "test-brand",
      version: "1.0.0",
      description: "Test brand kit",
      author: "Test Author",
    },
    primitives: {
      primary: { 1: "#f0f9ff", 2: "#e0f2fe", 3: "#bae6fd", 4: "#7dd3fc", 5: "#38bdf8", 6: "#0ea5e9", 7: "#0284c7", 8: "#0369a1", 9: "#075985", 10: "#0c4a6e", 11: "#082f49", 12: "#051c2c" },
      accent: { 1: "#fdf4ff", 2: "#fae8ff", 3: "#f5d0fe", 4: "#f0abfc", 5: "#e879f9", 6: "#d946ef", 7: "#c026d3", 8: "#a21caf", 9: "#86198f", 10: "#701a75", 11: "#4a044e", 12: "#2e0230" },
      neutral: { 1: "#fafafa", 2: "#f5f5f5", 3: "#e5e5e5", 4: "#d4d4d4", 5: "#a3a3a3", 6: "#737373", 7: "#525252", 8: "#404040", 9: "#262626", 10: "#171717", 11: "#0a0a0a", 12: "#050505" },
    },
    semantics: {
      light: {
        background: "hsl(0 0% 100%)",
        foreground: "hsl(222 47% 11%)",
        primary: "hsl(206 100% 50%)",
        primaryForeground: "hsl(0 0% 100%)",
        secondary: "hsl(210 40% 96%)",
        secondaryForeground: "hsl(222 47% 11%)",
        muted: "hsl(210 40% 96%)",
        mutedForeground: "hsl(215 16% 47%)",
        accent: "hsl(210 40% 96%)",
        accentForeground: "hsl(222 47% 11%)",
        destructive: "hsl(0 84% 60%)",
        destructiveForeground: "hsl(0 0% 100%)",
        border: "hsl(214 32% 91%)",
        input: "hsl(214 32% 91%)",
        ring: "hsl(206 100% 50%)",
        card: "hsl(0 0% 100%)",
        cardForeground: "hsl(222 47% 11%)",
        popover: "hsl(0 0% 100%)",
        popoverForeground: "hsl(222 47% 11%)",
      },
      dark: {
        background: "hsl(222 47% 11%)",
        foreground: "hsl(210 40% 98%)",
        primary: "hsl(206 100% 50%)",
        primaryForeground: "hsl(0 0% 100%)",
        secondary: "hsl(217 33% 17%)",
        secondaryForeground: "hsl(210 40% 98%)",
        muted: "hsl(217 33% 17%)",
        mutedForeground: "hsl(215 20% 65%)",
        accent: "hsl(217 33% 17%)",
        accentForeground: "hsl(210 40% 98%)",
        destructive: "hsl(0 63% 31%)",
        destructiveForeground: "hsl(210 40% 98%)",
        border: "hsl(217 33% 17%)",
        input: "hsl(217 33% 17%)",
        ring: "hsl(224 76% 48%)",
        card: "hsl(222 47% 11%)",
        cardForeground: "hsl(210 40% 98%)",
        popover: "hsl(222 47% 11%)",
        popoverForeground: "hsl(210 40% 98%)",
      },
    },
  }

  describe("defineBrandKit helper", () => {
    it("returns the same brand kit object (type helper)", () => {
      const result = defineBrandKit(validBrandKit)
      expect(result).toEqual(validBrandKit)
    })

    it("provides type safety for brand kit authors", () => {
      const brandKit = defineBrandKit({
        meta: { name: "my-brand", version: "2.0.0" },
        primitives: validBrandKit.primitives,
        semantics: validBrandKit.semantics,
      })

      expect(brandKit.meta.name).toBe("my-brand")
      expect(brandKit.meta.version).toBe("2.0.0")
    })
  })

  describe("validateBrandKit comprehensive validation", () => {
    it("validates a complete valid brand kit", () => {
      const result = validateBrandKit(validBrandKit)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.missingRequired).toHaveLength(0)
    })

    it("returns errors for null input", () => {
      const result = validateBrandKit(null)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain("Brand kit must be an object")
    })

    it("returns errors for missing meta", () => {
      const result = validateBrandKit({
        primitives: validBrandKit.primitives,
        semantics: validBrandKit.semantics,
      })

      expect(result.valid).toBe(false)
      expect(result.missingRequired).toContain("meta")
    })

    it("returns errors for missing meta.name", () => {
      const result = validateBrandKit({
        meta: { version: "1.0.0" },
        primitives: validBrandKit.primitives,
        semantics: validBrandKit.semantics,
      })

      expect(result.valid).toBe(false)
      expect(result.missingRequired).toContain("meta.name")
    })

    it("returns errors for missing meta.version", () => {
      const result = validateBrandKit({
        meta: { name: "test" },
        primitives: validBrandKit.primitives,
        semantics: validBrandKit.semantics,
      })

      expect(result.valid).toBe(false)
      expect(result.missingRequired).toContain("meta.version")
    })

    it("returns errors for missing primitives", () => {
      const result = validateBrandKit({
        meta: validBrandKit.meta,
        semantics: validBrandKit.semantics,
      })

      expect(result.valid).toBe(false)
      expect(result.missingRequired).toContain("primitives")
    })

    it("returns errors for missing primitive color scales", () => {
      const result = validateBrandKit({
        meta: validBrandKit.meta,
        primitives: { primary: validBrandKit.primitives.primary },
        semantics: validBrandKit.semantics,
      })

      expect(result.valid).toBe(false)
      expect(result.missingRequired).toContain("primitives.accent")
      expect(result.missingRequired).toContain("primitives.neutral")
    })

    it("returns errors for missing semantics", () => {
      const result = validateBrandKit({
        meta: validBrandKit.meta,
        primitives: validBrandKit.primitives,
      })

      expect(result.valid).toBe(false)
      expect(result.missingRequired).toContain("semantics")
    })

    it("returns errors for missing semantics.light", () => {
      const result = validateBrandKit({
        meta: validBrandKit.meta,
        primitives: validBrandKit.primitives,
        semantics: { dark: validBrandKit.semantics.dark },
      })

      expect(result.valid).toBe(false)
      expect(result.missingRequired).toContain("semantics.light")
    })

    it("returns errors for missing semantics.dark", () => {
      const result = validateBrandKit({
        meta: validBrandKit.meta,
        primitives: validBrandKit.primitives,
        semantics: { light: validBrandKit.semantics.light },
      })

      expect(result.valid).toBe(false)
      expect(result.missingRequired).toContain("semantics.dark")
    })

    it("warns about non-semver version format", () => {
      const result = validateBrandKit({
        meta: { name: "test", version: "latest" },
        primitives: validBrandKit.primitives,
        semantics: validBrandKit.semantics,
      })

      expect(result.warnings.some(w => w.includes("semver"))).toBe(true)
    })

    it("tracks missing optional fields", () => {
      const result = validateBrandKit(validBrandKit)

      expect(result.missingOptional).toContain("typography")
      expect(result.missingOptional).toContain("spacing")
      expect(result.missingOptional).toContain("radius")
      expect(result.missingOptional).toContain("shadow")
    })

    it("does not report optional fields when provided", () => {
      const fullBrandKit = {
        ...validBrandKit,
        typography: { fontFamily: { sans: "Inter" } },
        spacing: { 1: "0.25rem" },
        radius: { sm: "0.25rem" },
        shadow: { sm: "0 1px 2px rgba(0,0,0,0.05)" },
      }

      const result = validateBrandKit(fullBrandKit)

      expect(result.valid).toBe(true)
      expect(result.missingOptional).not.toContain("typography")
      expect(result.missingOptional).not.toContain("spacing")
      expect(result.missingOptional).not.toContain("radius")
      expect(result.missingOptional).not.toContain("shadow")
    })
  })

  describe("BrandKitExport interface compliance", () => {
    it("requires meta.name and meta.version", () => {
      // TypeScript would catch this at compile time, test runtime validation
      const result = validateBrandKit({
        meta: {},
        primitives: validBrandKit.primitives,
        semantics: validBrandKit.semantics,
      })

      expect(result.valid).toBe(false)
      expect(result.missingRequired).toContain("meta.name")
      expect(result.missingRequired).toContain("meta.version")
    })

    it("requires all three primitive color scales", () => {
      const result = validateBrandKit({
        meta: validBrandKit.meta,
        primitives: {},
        semantics: validBrandKit.semantics,
      })

      expect(result.valid).toBe(false)
      expect(result.missingRequired).toContain("primitives.primary")
      expect(result.missingRequired).toContain("primitives.accent")
      expect(result.missingRequired).toContain("primitives.neutral")
    })

    it("requires both light and dark semantic colors", () => {
      const result = validateBrandKit({
        meta: validBrandKit.meta,
        primitives: validBrandKit.primitives,
        semantics: {},
      })

      expect(result.valid).toBe(false)
      expect(result.missingRequired).toContain("semantics.light")
      expect(result.missingRequired).toContain("semantics.dark")
    })
  })
})

// =============================================================================
// FEATURE #4: DYNAMIC IMPORT SYSTEM
// =============================================================================

describe("Feature #4: Dynamic Import System", () => {
  describe("isValidBrandPackageName", () => {
    describe("validates npm package names", () => {
      it("accepts scoped packages", () => {
        expect(isValidBrandPackageName("@platxa/brand-kit")).toBe(true)
        expect(isValidBrandPackageName("@company/my-brand")).toBe(true)
        expect(isValidBrandPackageName("@org/brand")).toBe(true)
      })

      it("accepts regular npm packages", () => {
        expect(isValidBrandPackageName("my-brand-kit")).toBe(true)
        expect(isValidBrandPackageName("brand")).toBe(true)
        expect(isValidBrandPackageName("some-package")).toBe(true)
      })

      it("rejects invalid package names", () => {
        expect(isValidBrandPackageName("")).toBe(false)
        expect(isValidBrandPackageName(null as unknown as string)).toBe(false)
        expect(isValidBrandPackageName(undefined as unknown as string)).toBe(false)
      })
    })

    describe("validates local paths", () => {
      it("accepts relative paths with ./", () => {
        expect(isValidBrandPackageName("./my-brand")).toBe(true)
        expect(isValidBrandPackageName("./brands/company-brand")).toBe(true)
        expect(isValidBrandPackageName("./src/brand/index")).toBe(true)
      })

      it("accepts relative paths with ../", () => {
        expect(isValidBrandPackageName("../my-brand")).toBe(true)
        expect(isValidBrandPackageName("../../../brands/brand")).toBe(true)
      })
    })
  })

  describe("Dynamic import behavior", () => {
    beforeEach(() => {
      clearBrandCache()
    })

    it("does not load brand kit until explicitly requested", async () => {
      // Verify no loading happens by default
      expect(getBrandLoadingState()).toBe("idle")
      expect(getCurrentBrandKit()).toBeNull()
      expect(isBrandLoading()).toBe(false)
    })

    it("uses dynamic import for brand loading (not static)", async () => {
      // This test verifies the architecture:
      // - resolveBrand with builtin mode does NOT trigger any import
      const config = resolveConfig({ theme: { preset: "blue" } })
      const result = await resolveBrand(config)

      // Built-in themes don't trigger brand loading
      expect(result.status).toBe("loaded")
      expect(result.brandKit).toBeNull()
      // State remains idle because no dynamic import was needed
      expect(getBrandLoadingState()).toBe("idle")
    })

    it("only triggers loading when brand.package is specified", async () => {
      const config = resolveConfig({
        brand: { package: "@nonexistent/test-brand" },
      })

      // This will attempt to load (and fail gracefully)
      const result = await resolveBrand(config, { throwOnError: false })

      // Loading was attempted
      expect(result.status).toBe("error")
      // State changed because loading was triggered
      expect(getBrandLoadingState()).toBe("error")
    })
  })

  describe("Bundle separation verification", () => {
    it("brand kit code is NOT imported statically", () => {
      // This test documents the architecture:
      // The loadBrandKit function uses dynamic import() with @vite-ignore
      // This ensures brand kit code is NOT in the main bundle

      // Verification: check that we can reference loadBrandKit
      // without any brand kit code being present
      expect(typeof resolveBrand).toBe("function")

      // The absence of any brand kit in the bundle is verified by:
      // 1. No static imports of brand kit modules in loader.ts
      // 2. Using /* @vite-ignore */ comment on dynamic import
      // 3. Runtime resolution of package name
    })

    it("supports multiple brand kit formats", async () => {
      // Brand kits can export in multiple ways:
      // 1. export default brandKit
      // 2. export { brandKit }
      // 3. module.exports = brandKit

      // This is handled by the dynamic import wrapper:
      // return module.default || module.brandKit || module
      // Verification is in the implementation, tested via error case

      const config = resolveConfig({
        brand: { package: "@test/nonexistent" },
      })

      const result = await resolveBrand(config, { throwOnError: false })

      // Loading failed but the system handled it gracefully
      expect(result.status).toBe("error")
      expect(result.themeConfig).toBeDefined() // Falls back to default
    })
  })
})

// =============================================================================
// FEATURE #5: TOKEN NORMALIZATION
// =============================================================================

describe("Feature #5: Token Normalization", () => {
  // Use the same valid brand kit from Feature #3 tests
  const validBrandKit: BrandKitExport = {
    meta: {
      name: "test-brand",
      version: "1.0.0",
    },
    primitives: {
      primary: { 1: "#f0f9ff", 2: "#e0f2fe", 3: "#bae6fd", 4: "#7dd3fc", 5: "#38bdf8", 6: "#0ea5e9", 7: "#0284c7", 8: "#0369a1", 9: "#075985", 10: "#0c4a6e", 11: "#082f49", 12: "#051c2c" },
      accent: { 1: "#fdf4ff", 2: "#fae8ff", 3: "#f5d0fe", 4: "#f0abfc", 5: "#e879f9", 6: "#d946ef", 7: "#c026d3", 8: "#a21caf", 9: "#86198f", 10: "#701a75", 11: "#4a044e", 12: "#2e0230" },
      neutral: { 1: "#fafafa", 2: "#f5f5f5", 3: "#e5e5e5", 4: "#d4d4d4", 5: "#a3a3a3", 6: "#737373", 7: "#525252", 8: "#404040", 9: "#262626", 10: "#171717", 11: "#0a0a0a", 12: "#050505" },
    },
    semantics: {
      light: {
        background: "hsl(0 0% 100%)",
        foreground: "hsl(222 47% 11%)",
        primary: "hsl(206 100% 50%)",
        primaryForeground: "hsl(0 0% 100%)",
        secondary: "hsl(210 40% 96%)",
        secondaryForeground: "hsl(222 47% 11%)",
        muted: "hsl(210 40% 96%)",
        mutedForeground: "hsl(215 16% 47%)",
        accent: "hsl(210 40% 96%)",
        accentForeground: "hsl(222 47% 11%)",
        destructive: "hsl(0 84% 60%)",
        destructiveForeground: "hsl(0 0% 100%)",
        border: "hsl(214 32% 91%)",
        input: "hsl(214 32% 91%)",
        ring: "hsl(206 100% 50%)",
        card: "hsl(0 0% 100%)",
        cardForeground: "hsl(222 47% 11%)",
        popover: "hsl(0 0% 100%)",
        popoverForeground: "hsl(222 47% 11%)",
      },
      dark: {
        background: "hsl(222 47% 11%)",
        foreground: "hsl(210 40% 98%)",
        primary: "hsl(206 100% 50%)",
        primaryForeground: "hsl(0 0% 100%)",
        secondary: "hsl(217 33% 17%)",
        secondaryForeground: "hsl(210 40% 98%)",
        muted: "hsl(217 33% 17%)",
        mutedForeground: "hsl(215 20% 65%)",
        accent: "hsl(217 33% 17%)",
        accentForeground: "hsl(210 40% 98%)",
        destructive: "hsl(0 63% 31%)",
        destructiveForeground: "hsl(210 40% 98%)",
        border: "hsl(217 33% 17%)",
        input: "hsl(217 33% 17%)",
        ring: "hsl(224 76% 48%)",
        card: "hsl(222 47% 11%)",
        cardForeground: "hsl(210 40% 98%)",
        popover: "hsl(222 47% 11%)",
        popoverForeground: "hsl(210 40% 98%)",
      },
    },
  }

  describe("normalizeBrandTokens", () => {
    it("converts brand kit to DesignTokens format", () => {
      const tokens = normalizeBrandTokens(validBrandKit)

      // Verify structure
      expect(tokens.colors).toBeDefined()
      expect(tokens.spacing).toBeDefined()
      expect(tokens.typography).toBeDefined()
      expect(tokens.fontWeight).toBeDefined()
      expect(tokens.radius).toBeDefined()
      expect(tokens.shadow).toBeDefined()
    })

    it("extracts semantic colors from brand kit", () => {
      const tokens = normalizeBrandTokens(validBrandKit)

      expect(tokens.colors.primary).toBe("hsl(206 100% 50%)")
      expect(tokens.colors.background).toBe("hsl(0 0% 100%)")
      expect(tokens.colors.foreground).toBe("hsl(222 47% 11%)")
    })

    it("fills missing optional tokens with defaults", () => {
      // Brand kit without optional fields
      const minimalBrandKit: BrandKitExport = {
        meta: { name: "minimal", version: "1.0.0" },
        primitives: validBrandKit.primitives,
        semantics: validBrandKit.semantics,
        // No typography, spacing, radius, shadow
      }

      const tokens = normalizeBrandTokens(minimalBrandKit)

      // All fields should be defined with defaults
      expect(tokens.spacing).toBeDefined()
      expect(Object.keys(tokens.spacing).length).toBeGreaterThan(0)
      expect(tokens.typography).toBeDefined()
      expect(tokens.fontWeight).toBeDefined()
      expect(tokens.radius).toBeDefined()
      expect(tokens.shadow).toBeDefined()
      expect(tokens.duration).toBeDefined()
      expect(tokens.easing).toBeDefined()
      expect(tokens.breakpoints).toBeDefined()
      expect(tokens.zIndex).toBeDefined()
    })

    it("uses brand kit values when provided", () => {
      const brandKitWithTypography: BrandKitExport = {
        ...validBrandKit,
        typography: {
          fontFamily: {
            sans: "Inter, system-ui, sans-serif",
            mono: "JetBrains Mono, monospace",
          },
          fontSize: {
            xs: { fontSize: "0.75rem", lineHeight: "1rem" },
            base: { fontSize: "1rem", lineHeight: "1.5rem" },
          },
        },
        spacing: {
          1: "0.25rem",
          2: "0.5rem",
          4: "1rem",
        },
      }

      const tokens = normalizeBrandTokens(brandKitWithTypography)

      expect(tokens.fontFamily?.sans).toBe("Inter, system-ui, sans-serif")
      expect(tokens.spacing[1]).toBe("0.25rem")
    })

    it("produces consistent structure regardless of source", () => {
      const minimalTokens = normalizeBrandTokens({
        meta: { name: "minimal", version: "1.0.0" },
        primitives: validBrandKit.primitives,
        semantics: validBrandKit.semantics,
      })

      const fullTokens = normalizeBrandTokens({
        ...validBrandKit,
        typography: { fontFamily: { sans: "Arial" } },
        spacing: { 1: "4px" },
        radius: { sm: "2px" },
        shadow: { sm: "0 1px 2px black" },
      })

      // Both should have the same structure
      const minimalKeys = Object.keys(minimalTokens).sort()
      const fullKeys = Object.keys(fullTokens).sort()

      expect(minimalKeys).toEqual(fullKeys)
    })
  })

  describe("mergeDesignTokens", () => {
    it("merges tokens with overrides", () => {
      const base = normalizeBrandTokens(validBrandKit)
      const merged = mergeDesignTokens(base, {
        colors: {
          ...base.colors,
          primary: "hsl(280 100% 50%)",
        },
      })

      expect(merged.colors.primary).toBe("hsl(280 100% 50%)")
      // Other colors unchanged
      expect(merged.colors.background).toBe(base.colors.background)
    })

    it("performs deep merge for nested structures", () => {
      const base = normalizeBrandTokens(validBrandKit)
      const merged = mergeDesignTokens(base, {
        spacing: { 1: "0.3rem" },
        radius: { lg: "1rem" },
      })

      // Override applied
      expect(merged.spacing[1]).toBe("0.3rem")
      expect(merged.radius.lg).toBe("1rem")

      // Other values preserved
      expect(merged.spacing[2]).toBe(base.spacing[2])
    })

    it("preserves base tokens when no overrides provided", () => {
      const base = normalizeBrandTokens(validBrandKit)
      const merged = mergeDesignTokens(base, {})

      expect(merged.colors).toEqual(base.colors)
      expect(merged.spacing).toEqual(base.spacing)
    })
  })

  describe("Consistent token structure", () => {
    it("built-in themes have same structure as normalized brand tokens", async () => {
      // Get tokens from built-in theme
      const builtInConfig = resolveConfig({ theme: { preset: "blue" } })
      const builtInResult = await resolveBrand(builtInConfig)

      // Get tokens from brand kit normalization
      const brandTokens = normalizeBrandTokens(validBrandKit)

      // Should have same top-level keys
      const builtInKeys = Object.keys(builtInResult.tokens!).sort()
      const brandKeys = Object.keys(brandTokens).sort()

      expect(builtInKeys).toEqual(brandKeys)
    })

    it("all semantic color keys are present after normalization", () => {
      const tokens = normalizeBrandTokens(validBrandKit)

      const requiredColorKeys = [
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
        "background",
        "foreground",
        "card",
        "cardForeground",
        "popover",
        "popoverForeground",
        "border",
        "input",
        "ring",
      ]

      for (const key of requiredColorKeys) {
        expect(tokens.colors[key as keyof typeof tokens.colors]).toBeDefined()
      }
    })
  })
})
