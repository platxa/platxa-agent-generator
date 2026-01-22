/**
 * Tests for Custom Adapters
 *
 * @module react-agent/theme/adapters.test
 */

import { describe, it, expect, beforeEach } from "vitest"
import {
  // Types
  type BrandKitAdapter,
  type AdapterInput,
  type AdapterResult,
  // Registration
  registerAdapter,
  unregisterAdapter,
  getAdapter,
  getAdapters,
  setDefaultAdapter,
  getDefaultAdapter,
  clearAdapters,
  // Transformation
  findAdapter,
  transformWithAdapter,
  transformWithSpecificAdapter,
  // Initialization
  initializeDefaultAdapters,
  // Built-in adapters
  defaultAdapter,
  figmaTokensAdapter,
  styleDictionaryAdapter,
} from "../theme/adapters"

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createTestAdapter(overrides: Partial<BrandKitAdapter> = {}): BrandKitAdapter {
  return {
    id: "test-adapter",
    name: "Test Adapter",
    description: "A test adapter",
    priority: 50,
    canHandle: (input: AdapterInput) => input.format === "test",
    transform: (input: AdapterInput): AdapterResult => ({
      success: true,
      config: {
        name: String(input.name || "Test Brand"),
        light: {
          colors: {
            primary: "#000000",
            primaryForeground: "#ffffff",
            secondary: "#333333",
            secondaryForeground: "#ffffff",
            muted: "#f0f0f0",
            mutedForeground: "#666666",
            accent: "#ff6600",
            accentForeground: "#ffffff",
            destructive: "#ff0000",
            destructiveForeground: "#ffffff",
            background: "#ffffff",
            foreground: "#000000",
            card: "#ffffff",
            cardForeground: "#000000",
            popover: "#ffffff",
            popoverForeground: "#000000",
            border: "#e0e0e0",
            input: "#e0e0e0",
            ring: "#0066ff",
          },
          spacing: {},
          typography: {},
          radius: {},
          shadow: {},
          fontWeight: {},
        },
      },
    }),
    ...overrides,
  }
}

// =============================================================================
// ADAPTER REGISTRATION TESTS
// =============================================================================

describe("Adapter Registration", () => {
  beforeEach(() => {
    // Reset to clean state before each test
    initializeDefaultAdapters()
  })

  it("should register a valid adapter", () => {
    const adapter = createTestAdapter()
    registerAdapter(adapter)

    const retrieved = getAdapter("test-adapter")
    expect(retrieved).toBeDefined()
    expect(retrieved?.id).toBe("test-adapter")
    expect(retrieved?.name).toBe("Test Adapter")
  })

  it("should throw when adapter has no id", () => {
    const adapter = createTestAdapter({ id: "" })

    expect(() => registerAdapter(adapter)).toThrow("Adapter must have an id")
  })

  it("should throw when adapter has no canHandle method", () => {
    const adapter = createTestAdapter()
    // Remove canHandle method
    ;(adapter as unknown as Record<string, unknown>).canHandle = null

    expect(() => registerAdapter(adapter)).toThrow(
      "Adapter must implement canHandle method"
    )
  })

  it("should throw when adapter has no transform method", () => {
    const adapter = createTestAdapter()
    // Remove transform method
    ;(adapter as unknown as Record<string, unknown>).transform = null

    expect(() => registerAdapter(adapter)).toThrow(
      "Adapter must implement transform method"
    )
  })

  it("should throw on duplicate ID without override option", () => {
    const adapter1 = createTestAdapter()
    const adapter2 = createTestAdapter({ name: "Test Adapter 2" })

    registerAdapter(adapter1)

    expect(() => registerAdapter(adapter2)).toThrow(
      'Adapter with id "test-adapter" already exists'
    )
  })

  it("should allow override with option", () => {
    const adapter1 = createTestAdapter()
    const adapter2 = createTestAdapter({ name: "Test Adapter 2" })

    registerAdapter(adapter1)
    registerAdapter(adapter2, { override: true })

    const retrieved = getAdapter("test-adapter")
    expect(retrieved?.name).toBe("Test Adapter 2")
  })
})

// =============================================================================
// UNREGISTER ADAPTER TESTS
// =============================================================================

describe("Adapter Unregistration", () => {
  beforeEach(() => {
    initializeDefaultAdapters()
  })

  it("should return true when adapter is removed", () => {
    const adapter = createTestAdapter()
    registerAdapter(adapter)

    const result = unregisterAdapter("test-adapter")

    expect(result).toBe(true)
    expect(getAdapter("test-adapter")).toBeUndefined()
  })

  it("should return false when adapter not found", () => {
    const result = unregisterAdapter("non-existent")

    expect(result).toBe(false)
  })

  it("should clear default adapter if it was unregistered", () => {
    const adapter = createTestAdapter()
    registerAdapter(adapter)
    setDefaultAdapter("test-adapter")

    unregisterAdapter("test-adapter")

    // Default should now fall back to undefined
    const defaultAdapterResult = getDefaultAdapter()
    expect(defaultAdapterResult).toBeUndefined()
  })
})

// =============================================================================
// GET ADAPTERS TESTS
// =============================================================================

describe("Get Adapters", () => {
  beforeEach(() => {
    initializeDefaultAdapters()
  })

  it("should return all registered adapters", () => {
    const adapters = getAdapters()

    // Should have the 3 default adapters
    expect(adapters.length).toBe(3)

    const ids = adapters.map((a) => a.id)
    expect(ids).toContain("default")
    expect(ids).toContain("figma-tokens")
    expect(ids).toContain("style-dictionary")
  })

  it("should include newly registered adapters", () => {
    const adapter = createTestAdapter()
    registerAdapter(adapter)

    const adapters = getAdapters()

    expect(adapters.length).toBe(4)
    expect(adapters.map((a) => a.id)).toContain("test-adapter")
  })
})

// =============================================================================
// DEFAULT ADAPTER TESTS
// =============================================================================

describe("Default Adapter", () => {
  beforeEach(() => {
    initializeDefaultAdapters()
  })

  it("should return the default adapter", () => {
    const defaultAdapterResult = getDefaultAdapter()

    expect(defaultAdapterResult).toBeDefined()
    expect(defaultAdapterResult?.id).toBe("default")
  })

  it("should throw when setting non-existent adapter as default", () => {
    expect(() => setDefaultAdapter("non-existent")).toThrow(
      'Adapter "non-existent" not found'
    )
  })

  it("should update default adapter", () => {
    const adapter = createTestAdapter()
    registerAdapter(adapter)
    setDefaultAdapter("test-adapter")

    const defaultAdapterResult = getDefaultAdapter()
    expect(defaultAdapterResult?.id).toBe("test-adapter")
  })
})

// =============================================================================
// FIND ADAPTER TESTS
// =============================================================================

describe("Find Adapter", () => {
  beforeEach(() => {
    initializeDefaultAdapters()
  })

  it("should find adapter by priority (highest first)", () => {
    const lowPriority = createTestAdapter({
      id: "low-priority",
      priority: 10,
      canHandle: () => true,
    })
    const highPriority = createTestAdapter({
      id: "high-priority",
      priority: 100,
      canHandle: () => true,
    })

    registerAdapter(lowPriority)
    registerAdapter(highPriority)

    const found = findAdapter({ any: "input" })

    expect(found?.id).toBe("high-priority")
  })

  it("should return undefined when no adapter matches", () => {
    // Clear all adapters so none can match
    clearAdapters()

    // Register only adapters that can't handle this input
    const adapter = createTestAdapter({
      canHandle: () => false,
    })
    registerAdapter(adapter)

    const found = findAdapter({ format: "unknown" })

    // No adapter can handle this input
    expect(found).toBeUndefined()
  })

  it("should skip adapters that cannot handle input", () => {
    const nonMatching = createTestAdapter({
      id: "non-matching",
      priority: 100,
      canHandle: () => false,
    })
    const matching = createTestAdapter({
      id: "matching",
      priority: 90, // Higher than figma-tokens (80)
      canHandle: () => true,
    })

    registerAdapter(nonMatching)
    registerAdapter(matching)

    const found = findAdapter({ any: "input" })

    // Should find highest priority that CAN handle
    // non-matching (100) can't handle, so matching (90) is found
    expect(found?.id).toBe("matching")
  })
})

// =============================================================================
// TRANSFORM WITH ADAPTER TESTS
// =============================================================================

describe("Transform With Adapter", () => {
  beforeEach(() => {
    initializeDefaultAdapters()
  })

  it("should use auto-detected adapter", () => {
    const adapter = createTestAdapter({
      id: "custom",
      priority: 100,
      canHandle: (input) => input.format === "custom",
      transform: () => ({
        success: true,
        config: {
          name: "Custom Transformed",
          light: {
            colors: {
              primary: "#custom",
              primaryForeground: "#ffffff",
              secondary: "#333333",
              secondaryForeground: "#ffffff",
              muted: "#f0f0f0",
              mutedForeground: "#666666",
              accent: "#ff6600",
              accentForeground: "#ffffff",
              destructive: "#ff0000",
              destructiveForeground: "#ffffff",
              background: "#ffffff",
              foreground: "#000000",
              card: "#ffffff",
              cardForeground: "#000000",
              popover: "#ffffff",
              popoverForeground: "#000000",
              border: "#e0e0e0",
              input: "#e0e0e0",
              ring: "#0066ff",
            },
            spacing: {},
            typography: {},
            radius: {},
            shadow: {},
            fontWeight: {},
          },
        },
      }),
    })
    registerAdapter(adapter)

    const result = transformWithAdapter({ format: "custom" })

    expect(result.success).toBe(true)
    expect(result.config?.name).toBe("Custom Transformed")
    expect(result.config?.light.colors.primary).toBe("#custom")
  })

  it("should fall back to default adapter", () => {
    const result = transformWithAdapter({
      name: "Fallback Brand",
      colors: { primary: "#fallback" },
    })

    expect(result.success).toBe(true)
    expect(result.config?.name).toBe("Fallback Brand")
    expect(result.config?.light.colors.primary).toBe("#fallback")
  })

  it("should return error when no adapter matches", () => {
    // Clear all adapters
    clearAdapters()

    const result = transformWithAdapter({ unknown: "format" })

    expect(result.success).toBe(false)
    expect(result.error).toBe("No adapter found that can handle this input format")
  })
})

// =============================================================================
// TRANSFORM WITH SPECIFIC ADAPTER TESTS
// =============================================================================

describe("Transform With Specific Adapter", () => {
  beforeEach(() => {
    initializeDefaultAdapters()
  })

  it("should use specified adapter", () => {
    const result = transformWithSpecificAdapter("default", {
      name: "Specific Brand",
      colors: { primary: "#specific" },
    })

    expect(result.success).toBe(true)
    expect(result.config?.name).toBe("Specific Brand")
  })

  it("should return error when adapter not found", () => {
    const result = transformWithSpecificAdapter("non-existent", { any: "input" })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Adapter "non-existent" not found')
  })

  it("should pass options to adapter", () => {
    const result = transformWithSpecificAdapter(
      "default",
      { colors: { primary: "#test" } },
      { name: "Options Override" }
    )

    expect(result.success).toBe(true)
    expect(result.config?.name).toBe("Options Override")
  })
})

// =============================================================================
// DEFAULT ADAPTER (BUILT-IN) TESTS
// =============================================================================

describe("Default Adapter (Built-in)", () => {
  it("should have correct metadata", () => {
    expect(defaultAdapter.id).toBe("default")
    expect(defaultAdapter.name).toBe("Default Adapter")
    expect(defaultAdapter.priority).toBe(0) // Lowest priority
  })

  it("should handle input with name", () => {
    expect(defaultAdapter.canHandle({ name: "My Brand" })).toBe(true)
  })

  it("should handle input with colors", () => {
    expect(defaultAdapter.canHandle({ colors: { primary: "#000" } })).toBe(true)
  })

  it("should not handle empty input", () => {
    expect(defaultAdapter.canHandle({})).toBe(false)
  })

  it("should transform standard format", () => {
    const result = defaultAdapter.transform({
      name: "Standard Brand",
      colors: {
        primary: "#0066cc",
        secondary: "#666666",
      },
    })

    expect(result.success).toBe(true)
    expect(result.config?.name).toBe("Standard Brand")
    expect(result.config?.light.colors.primary).toBe("#0066cc")
    expect(result.config?.light.colors.secondary).toBe("#666666")
  })

  it("should extract dark mode colors", () => {
    const result = defaultAdapter.transform({
      name: "Dark Brand",
      colors: { primary: "#0066cc" },
      dark: {
        primary: "#88ccff",
        background: "#111111",
      },
    })

    expect(result.success).toBe(true)
    expect(result.config?.dark?.primary).toBe("#88ccff")
    expect(result.config?.dark?.background).toBe("#111111")
  })

  it("should handle nested light.colors structure", () => {
    const result = defaultAdapter.transform({
      name: "Nested Brand",
      light: {
        colors: {
          primary: "#nested",
        },
        spacing: {
          sm: "0.5rem",
        },
      },
    })

    expect(result.success).toBe(true)
    expect(result.config?.light.colors.primary).toBe("#nested")
    expect(result.config?.light.spacing.sm).toBe("0.5rem")
  })

  it("should use fallback colors when not provided", () => {
    const result = defaultAdapter.transform({ name: "Minimal" })

    expect(result.success).toBe(true)
    expect(result.config?.light.colors.primary).toBe("#3b82f6") // Default blue
    expect(result.config?.light.colors.background).toBe("#ffffff")
  })

  it("should use name from options over input", () => {
    const result = defaultAdapter.transform(
      { name: "Input Name" },
      { name: "Options Name" }
    )

    expect(result.config?.name).toBe("Options Name")
  })
})

// =============================================================================
// FIGMA TOKENS ADAPTER TESTS
// =============================================================================

describe("Figma Tokens Adapter", () => {
  it("should have correct metadata", () => {
    expect(figmaTokensAdapter.id).toBe("figma-tokens")
    expect(figmaTokensAdapter.name).toBe("Figma Tokens")
    expect(figmaTokensAdapter.priority).toBe(80)
  })

  it("should detect Figma format with $type fields", () => {
    const input = {
      colors: {
        primary: { $type: "color", $value: "#0066cc" },
      },
    }

    expect(figmaTokensAdapter.canHandle(input)).toBe(true)
  })

  it("should detect Figma format with $value fields", () => {
    const input = {
      spacing: {
        sm: { $value: "8px" },
      },
    }

    expect(figmaTokensAdapter.canHandle(input)).toBe(true)
  })

  it("should detect Figma format with tokenSets key", () => {
    const input = {
      tokenSets: {
        core: {},
      },
    }

    expect(figmaTokensAdapter.canHandle(input)).toBe(true)
  })

  it("should not detect standard format", () => {
    const input = {
      name: "Standard",
      colors: { primary: "#000" },
    }

    expect(figmaTokensAdapter.canHandle(input)).toBe(false)
  })

  it("should transform Figma tokens format", () => {
    const input = {
      primary: { $type: "color", $value: "#figma-primary" },
      secondary: { $type: "color", $value: "#figma-secondary" },
      "spacing-sm": { $type: "spacing", $value: "8px" },
      "radius-md": { $type: "borderRadius", $value: "4px" },
    }

    const result = figmaTokensAdapter.transform(input)

    expect(result.success).toBe(true)
    expect(result.config?.name).toBe("Figma Brand")
    expect(result.config?.light.spacing["spacing-sm"]).toBe("8px")
    expect(result.config?.light.radius["radius-md"]).toBe("4px")
  })

  it("should handle nested Figma tokens", () => {
    const input = {
      colors: {
        brand: {
          primary: { $type: "color", $value: "#nested-primary" },
        },
      },
    }

    const result = figmaTokensAdapter.transform(input)

    expect(result.success).toBe(true)
    // Nested tokens are prefixed
    expect(result.config?.light.colors.primary).toBeDefined()
  })

  it("should use name from options", () => {
    const result = figmaTokensAdapter.transform(
      { primary: { $type: "color", $value: "#000" } },
      { name: "Custom Figma Brand" }
    )

    expect(result.config?.name).toBe("Custom Figma Brand")
  })
})

// =============================================================================
// STYLE DICTIONARY ADAPTER TESTS
// =============================================================================

describe("Style Dictionary Adapter", () => {
  it("should have correct metadata", () => {
    expect(styleDictionaryAdapter.id).toBe("style-dictionary")
    expect(styleDictionaryAdapter.name).toBe("Style Dictionary")
    expect(styleDictionaryAdapter.priority).toBe(70)
  })

  it("should detect Style Dictionary format with value field", () => {
    const input = {
      color: {
        primary: { value: "#0066cc" },
      },
    }

    expect(styleDictionaryAdapter.canHandle(input)).toBe(true)
  })

  it("should not detect Figma format (with $value)", () => {
    const input = {
      color: {
        primary: { $value: "#0066cc" },
      },
    }

    expect(styleDictionaryAdapter.canHandle(input)).toBe(false)
  })

  it("should not detect standard format", () => {
    const input = {
      name: "Standard",
      colors: { primary: "#000" },
    }

    expect(styleDictionaryAdapter.canHandle(input)).toBe(false)
  })

  it("should transform Style Dictionary format", () => {
    const input = {
      color: {
        primary: { value: "#sd-primary", type: "color" },
        secondary: { value: "#sd-secondary" },
      },
      spacing: {
        sm: { value: "8px", type: "size" },
      },
      radius: {
        md: { value: "4px", type: "borderRadius" },
      },
    }

    const result = styleDictionaryAdapter.transform(input)

    expect(result.success).toBe(true)
    expect(result.config?.name).toBe("Style Dictionary Brand")
    expect(result.config?.light.spacing["spacing-sm"]).toBe("8px")
    expect(result.config?.light.radius["radius-md"]).toBe("4px")
  })

  it("should detect colors by value pattern", () => {
    const input = {
      brand: {
        background: { value: "#ffffff" },
        highlight: { value: "rgb(255, 0, 0)" },
      },
    }

    const result = styleDictionaryAdapter.transform(input)

    expect(result.success).toBe(true)
    // Colors detected by # or rgb prefix
  })

  it("should handle deeply nested tokens", () => {
    const input = {
      core: {
        color: {
          brand: {
            primary: { value: "#deep-primary", type: "color" },
          },
        },
      },
    }

    const result = styleDictionaryAdapter.transform(input)

    expect(result.success).toBe(true)
  })

  it("should use name from options", () => {
    const result = styleDictionaryAdapter.transform(
      { primary: { value: "#000" } },
      { name: "Custom SD Brand" }
    )

    expect(result.config?.name).toBe("Custom SD Brand")
  })
})

// =============================================================================
// INITIALIZATION TESTS
// =============================================================================

describe("Initialization", () => {
  it("should register all default adapters on init", () => {
    clearAdapters()
    expect(getAdapters().length).toBe(0)

    initializeDefaultAdapters()

    const adapters = getAdapters()
    expect(adapters.length).toBe(3)
    expect(adapters.map((a) => a.id)).toContain("default")
    expect(adapters.map((a) => a.id)).toContain("figma-tokens")
    expect(adapters.map((a) => a.id)).toContain("style-dictionary")
  })

  it("should set default adapter on init", () => {
    clearAdapters()
    expect(getDefaultAdapter()).toBeUndefined()

    initializeDefaultAdapters()

    const defaultAdapterResult = getDefaultAdapter()
    expect(defaultAdapterResult?.id).toBe("default")
  })

  it("should clear existing adapters on re-init", () => {
    const custom = createTestAdapter({ id: "custom" })
    registerAdapter(custom)
    expect(getAdapters().length).toBe(4)

    initializeDefaultAdapters()

    expect(getAdapters().length).toBe(3)
    expect(getAdapter("custom")).toBeUndefined()
  })
})

// =============================================================================
// CLEAR ADAPTERS TESTS
// =============================================================================

describe("Clear Adapters", () => {
  beforeEach(() => {
    initializeDefaultAdapters()
  })

  it("should remove all adapters", () => {
    expect(getAdapters().length).toBe(3)

    clearAdapters()

    expect(getAdapters().length).toBe(0)
  })

  it("should clear default adapter", () => {
    expect(getDefaultAdapter()).toBeDefined()

    clearAdapters()

    expect(getDefaultAdapter()).toBeUndefined()
  })
})
