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
  resolveConfig,
  validateConfig,
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
import type { FrontendConfig, BuiltInPreset } from "../brand"

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
