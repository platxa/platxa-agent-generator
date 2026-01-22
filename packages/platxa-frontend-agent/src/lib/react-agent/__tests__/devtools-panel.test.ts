/**
 * Browser DevTools Panel - Tests
 *
 * Tests for brand inspection devtools:
 * - Token extraction
 * - Token categorization and grouping
 * - Theme mode detection and toggle
 * - Brand info extraction
 * - DevTools state management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  extractCSSVariables,
  categorizeVariable,
  parseTokens,
  groupTokens,
  detectThemeMode,
  isDarkModeActive,
  toggleThemeMode,
  setThemeMode,
  getBrandInfo,
  createDevToolsState,
  filterTokens,
  refreshDevToolsState,
  installDevTools,
  type DevToolsPanelState,
} from "../devtools"

// =============================================================================
// Mock Setup
// =============================================================================

/**
 * Create mock document with CSS variables
 */
function createMockDocument(
  variables: Record<string, string> = {},
  options: {
    darkClass?: boolean
    themeAttr?: string
    brandMeta?: string
  } = {}
) {
  const cssVariables = Object.entries(variables)
  const computedStyle = {
    length: cssVariables.length,
    getPropertyValue: (prop: string) => variables[prop] || "",
    [Symbol.iterator]: function* () {
      for (const [key] of cssVariables) {
        yield key
      }
    },
  }

  // Make it array-like for iteration
  cssVariables.forEach(([key], index) => {
    ;(computedStyle as unknown as Record<number, string>)[index] = key
  })

  const classList = {
    _classes: new Set<string>(options.darkClass ? ["dark"] : []),
    contains: function (className: string) {
      return this._classes.has(className)
    },
    add: function (className: string) {
      this._classes.add(className)
    },
    remove: function (className: string) {
      this._classes.delete(className)
    },
  }

  const documentElement = {
    classList,
    getAttribute: (attr: string) =>
      attr === "data-theme" ? options.themeAttr || null : null,
    setAttribute: vi.fn(),
    removeAttribute: vi.fn(),
  }

  const body = {
    classList: {
      contains: () => false,
    },
    getAttribute: () => null,
  }

  const metaElement = options.brandMeta
    ? {
        getAttribute: (attr: string) =>
          attr === "content" ? options.brandMeta : null,
      }
    : null

  return {
    documentElement,
    body,
    querySelector: (selector: string) => {
      if (selector === ":root") return documentElement
      if (selector === 'meta[name="brand"]') return metaElement
      return null
    },
  }
}

/**
 * Create mock window with media query
 */
function createMockWindow(prefersDark: boolean = false) {
  return {
    matchMedia: (query: string) => ({
      matches: query.includes("dark") && prefersDark,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
    dispatchEvent: vi.fn(),
    CustomEvent: class CustomEvent extends Event {
      detail: unknown
      constructor(type: string, options?: { detail?: unknown }) {
        super(type)
        this.detail = options?.detail
      }
    },
  }
}

/**
 * Create mock getComputedStyle
 */
function mockGetComputedStyle(variables: Record<string, string>) {
  const cssVariables = Object.entries(variables)

  return (): CSSStyleDeclaration => {
    const style: Record<string | number, unknown> = {
      length: cssVariables.length,
      getPropertyValue: (prop: string) => variables[prop] || "",
    }

    cssVariables.forEach(([key], index) => {
      style[index] = key
    })

    // Test mock provides only the properties needed by extractCSSVariables
    return style as unknown as CSSStyleDeclaration
  }
}

// Store original globals
let originalDocument: typeof globalThis.document
let originalWindow: typeof globalThis.window
let originalGetComputedStyle: typeof globalThis.getComputedStyle

beforeEach(() => {
  originalDocument = globalThis.document
  originalWindow = globalThis.window
  originalGetComputedStyle = globalThis.getComputedStyle
})

afterEach(() => {
  globalThis.document = originalDocument
  globalThis.window = originalWindow
  globalThis.getComputedStyle = originalGetComputedStyle
  vi.restoreAllMocks()
})

// =============================================================================
// Variable Categorization Tests
// =============================================================================

describe("categorizeVariable", () => {
  it("should categorize color variables", () => {
    expect(categorizeVariable("--color-primary")).toBe("colors")
    expect(categorizeVariable("--color-background")).toBe("colors")
    expect(categorizeVariable("--bg-surface")).toBe("colors")
    expect(categorizeVariable("--text-muted")).toBe("colors")
  })

  it("should categorize spacing variables", () => {
    expect(categorizeVariable("--spacing-4")).toBe("spacing")
    expect(categorizeVariable("--space-md")).toBe("spacing")
    expect(categorizeVariable("--gap-lg")).toBe("spacing")
  })

  it("should categorize typography variables", () => {
    expect(categorizeVariable("--font-size-base")).toBe("typography")
    expect(categorizeVariable("--line-height-tight")).toBe("typography")
    expect(categorizeVariable("--letter-spacing-wide")).toBe("typography")
  })

  it("should categorize radius variables", () => {
    expect(categorizeVariable("--radius-md")).toBe("radius")
    expect(categorizeVariable("--rounded-lg")).toBe("radius")
    expect(categorizeVariable("--border-radius-full")).toBe("radius")
  })

  it("should categorize shadow variables", () => {
    expect(categorizeVariable("--shadow-sm")).toBe("shadow")
    expect(categorizeVariable("--box-shadow-lg")).toBe("shadow")
  })

  it("should categorize font weight variables", () => {
    expect(categorizeVariable("--font-weight-bold")).toBe("fontWeight")
    expect(categorizeVariable("--weight-medium")).toBe("fontWeight")
  })

  it("should return null for uncategorized variables", () => {
    expect(categorizeVariable("--custom-var")).toBeNull()
    expect(categorizeVariable("--animation-duration")).toBeNull()
  })

  it("should detect foreground colors", () => {
    expect(categorizeVariable("--primary-foreground")).toBe("colors")
    expect(categorizeVariable("--card-foreground")).toBe("colors")
  })
})

// =============================================================================
// Token Extraction Tests
// =============================================================================

describe("extractCSSVariables", () => {
  it("should extract CSS variables from document", () => {
    const variables = {
      "--color-primary": "#3b82f6",
      "--spacing-4": "1rem",
      "--radius-md": "0.5rem",
    }

    globalThis.document = createMockDocument(variables) as unknown as Document
    globalThis.getComputedStyle = mockGetComputedStyle(variables)

    const result = extractCSSVariables()

    expect(result.size).toBe(3)
    expect(result.get("--color-primary")).toBe("#3b82f6")
    expect(result.get("--spacing-4")).toBe("1rem")
  })

  it("should return empty map when no document", () => {
    globalThis.document = undefined as unknown as Document

    const result = extractCSSVariables()

    expect(result.size).toBe(0)
  })

  it("should return empty map when root not found", () => {
    globalThis.document = {
      querySelector: () => null,
    } as unknown as Document

    const result = extractCSSVariables()

    expect(result.size).toBe(0)
  })

  it("should respect custom root selector", () => {
    const variables = { "--color-primary": "#3b82f6" }
    const mockDoc = {
      querySelector: (selector: string) =>
        selector === ".theme-root" ? {} : null,
    }
    globalThis.document = mockDoc as unknown as Document
    globalThis.getComputedStyle = mockGetComputedStyle(variables)

    const result = extractCSSVariables({ rootSelector: ".theme-root" })

    expect(result.size).toBe(1)
  })
})

// =============================================================================
// Token Parsing Tests
// =============================================================================

describe("parseTokens", () => {
  it("should parse tokens from CSS variables", () => {
    const variables = new Map([
      ["--color-primary", "#3b82f6"],
      ["--color-secondary", "#64748b"],
      ["--spacing-4", "1rem"],
    ])

    const tokens = parseTokens(variables)

    expect(tokens.length).toBe(3)
    expect(tokens.find((t) => t.cssVar === "--color-primary")).toBeDefined()
    expect(tokens.find((t) => t.cssVar === "--spacing-4")).toBeDefined()
  })

  it("should set category correctly", () => {
    const variables = new Map([
      ["--color-primary", "#3b82f6"],
      ["--spacing-4", "1rem"],
      ["--radius-md", "0.5rem"],
    ])

    const tokens = parseTokens(variables)

    expect(tokens.find((t) => t.cssVar === "--color-primary")?.category).toBe(
      "colors"
    )
    expect(tokens.find((t) => t.cssVar === "--spacing-4")?.category).toBe(
      "spacing"
    )
    expect(tokens.find((t) => t.cssVar === "--radius-md")?.category).toBe(
      "radius"
    )
  })

  it("should detect dark mode tokens", () => {
    const variables = new Map([
      ["--color-primary", "#3b82f6"],
      ["--color-primary-dark", "#60a5fa"],
    ])

    const tokens = parseTokens(variables)

    expect(tokens.find((t) => t.cssVar === "--color-primary")?.isDarkMode).toBe(
      false
    )
    expect(
      tokens.find((t) => t.cssVar === "--color-primary-dark")?.isDarkMode
    ).toBe(true)
  })

  it("should format token names", () => {
    const variables = new Map([["--color-primary-foreground", "#ffffff"]])

    const tokens = parseTokens(variables)

    expect(tokens[0].name).toBe("Color Primary Foreground")
  })

  it("should skip uncategorized variables", () => {
    const variables = new Map([
      ["--color-primary", "#3b82f6"],
      ["--custom-unknown", "value"],
    ])

    const tokens = parseTokens(variables)

    expect(tokens.length).toBe(1)
    expect(tokens[0].cssVar).toBe("--color-primary")
  })
})

// =============================================================================
// Token Grouping Tests
// =============================================================================

describe("groupTokens", () => {
  it("should group tokens by category", () => {
    const tokens = [
      {
        name: "Primary",
        cssVar: "--color-primary",
        value: "#3b82f6",
        category: "colors" as const,
      },
      {
        name: "Secondary",
        cssVar: "--color-secondary",
        value: "#64748b",
        category: "colors" as const,
      },
      {
        name: "Spacing 4",
        cssVar: "--spacing-4",
        value: "1rem",
        category: "spacing" as const,
      },
    ]

    const groups = groupTokens(tokens)

    expect(groups.length).toBe(2)

    const colorGroup = groups.find((g) => g.category === "colors")
    expect(colorGroup).toBeDefined()
    expect(colorGroup?.count).toBe(2)
    expect(colorGroup?.label).toBe("Colors")

    const spacingGroup = groups.find((g) => g.category === "spacing")
    expect(spacingGroup).toBeDefined()
    expect(spacingGroup?.count).toBe(1)
  })

  it("should sort tokens within groups", () => {
    const tokens = [
      {
        name: "Secondary",
        cssVar: "--color-secondary",
        value: "#64748b",
        category: "colors" as const,
      },
      {
        name: "Primary",
        cssVar: "--color-primary",
        value: "#3b82f6",
        category: "colors" as const,
      },
    ]

    const groups = groupTokens(tokens)
    const colorGroup = groups.find((g) => g.category === "colors")

    expect(colorGroup?.tokens[0].name).toBe("Primary")
    expect(colorGroup?.tokens[1].name).toBe("Secondary")
  })
})

// =============================================================================
// Theme Mode Detection Tests
// =============================================================================

describe("detectThemeMode", () => {
  it("should detect dark mode from class", () => {
    globalThis.document = createMockDocument(
      {},
      { darkClass: true }
    ) as unknown as Document

    expect(detectThemeMode()).toBe("dark")
  })

  it("should detect dark mode from attribute", () => {
    globalThis.document = createMockDocument(
      {},
      { themeAttr: "dark" }
    ) as unknown as Document

    expect(detectThemeMode()).toBe("dark")
  })

  it("should detect light mode from attribute", () => {
    globalThis.document = createMockDocument(
      {},
      { themeAttr: "light" }
    ) as unknown as Document

    expect(detectThemeMode()).toBe("light")
  })

  it("should return system when using media query", () => {
    globalThis.document = createMockDocument() as unknown as Document
    globalThis.window = createMockWindow(true) as unknown as Window &
      typeof globalThis

    expect(detectThemeMode()).toBe("system")
  })

  it("should return light as default", () => {
    globalThis.document = createMockDocument() as unknown as Document
    globalThis.window = createMockWindow(false) as unknown as Window &
      typeof globalThis

    expect(detectThemeMode()).toBe("light")
  })

  it("should return system when no document", () => {
    globalThis.document = undefined as unknown as Document

    expect(detectThemeMode()).toBe("system")
  })
})

describe("isDarkModeActive", () => {
  it("should return true when dark mode is active", () => {
    globalThis.document = createMockDocument(
      {},
      { darkClass: true }
    ) as unknown as Document

    expect(isDarkModeActive()).toBe(true)
  })

  it("should return true when system prefers dark", () => {
    globalThis.document = createMockDocument() as unknown as Document
    globalThis.window = createMockWindow(true) as unknown as Window &
      typeof globalThis

    expect(isDarkModeActive()).toBe(true)
  })

  it("should return false for light mode", () => {
    globalThis.document = createMockDocument(
      {},
      { themeAttr: "light" }
    ) as unknown as Document

    expect(isDarkModeActive()).toBe(false)
  })
})

// =============================================================================
// Theme Mode Toggle Tests
// =============================================================================

describe("toggleThemeMode", () => {
  it("should toggle from light to dark", () => {
    const mockDoc = createMockDocument({}, { themeAttr: "light" })
    globalThis.document = mockDoc as unknown as Document
    globalThis.window = createMockWindow() as unknown as Window &
      typeof globalThis

    const result = toggleThemeMode()

    expect(result).toBe("dark")
    expect(mockDoc.documentElement.classList._classes.has("dark")).toBe(true)
    expect(mockDoc.documentElement.setAttribute).toHaveBeenCalledWith(
      "data-theme",
      "dark"
    )
  })

  it("should toggle from dark to light", () => {
    const mockDoc = createMockDocument({}, { darkClass: true })
    globalThis.document = mockDoc as unknown as Document
    globalThis.window = createMockWindow() as unknown as Window &
      typeof globalThis

    const result = toggleThemeMode()

    expect(result).toBe("light")
    expect(mockDoc.documentElement.classList._classes.has("dark")).toBe(false)
  })

  it("should dispatch theme-mode-change event", () => {
    const mockDoc = createMockDocument()
    const mockWin = createMockWindow()
    globalThis.document = mockDoc as unknown as Document
    globalThis.window = mockWin as unknown as Window & typeof globalThis

    toggleThemeMode()

    expect(mockWin.dispatchEvent).toHaveBeenCalled()
  })

  it("should return light when no document", () => {
    globalThis.document = undefined as unknown as Document

    expect(toggleThemeMode()).toBe("light")
  })
})

describe("setThemeMode", () => {
  it("should set dark mode", () => {
    const mockDoc = createMockDocument()
    globalThis.document = mockDoc as unknown as Document
    globalThis.window = createMockWindow() as unknown as Window &
      typeof globalThis

    setThemeMode("dark")

    expect(mockDoc.documentElement.classList._classes.has("dark")).toBe(true)
    expect(mockDoc.documentElement.setAttribute).toHaveBeenCalledWith(
      "data-theme",
      "dark"
    )
  })

  it("should set light mode", () => {
    const mockDoc = createMockDocument({}, { darkClass: true })
    globalThis.document = mockDoc as unknown as Document
    globalThis.window = createMockWindow() as unknown as Window &
      typeof globalThis

    setThemeMode("light")

    expect(mockDoc.documentElement.classList._classes.has("dark")).toBe(false)
    expect(mockDoc.documentElement.setAttribute).toHaveBeenCalledWith(
      "data-theme",
      "light"
    )
  })

  it("should set system mode (remove explicit mode)", () => {
    const mockDoc = createMockDocument({}, { darkClass: true })
    globalThis.document = mockDoc as unknown as Document
    globalThis.window = createMockWindow() as unknown as Window &
      typeof globalThis

    setThemeMode("system")

    expect(mockDoc.documentElement.classList._classes.has("dark")).toBe(false)
    expect(mockDoc.documentElement.removeAttribute).toHaveBeenCalledWith(
      "data-theme"
    )
  })
})

// =============================================================================
// Brand Info Tests
// =============================================================================

describe("getBrandInfo", () => {
  it("should extract brand info", () => {
    const variables = {
      "--color-primary": "#3b82f6",
      "--spacing-4": "1rem",
    }
    globalThis.document = createMockDocument(variables, {
      brandMeta: "Test Brand",
    }) as unknown as Document
    globalThis.getComputedStyle = mockGetComputedStyle(variables)
    globalThis.window = createMockWindow() as unknown as Window &
      typeof globalThis

    const info = getBrandInfo()

    expect(info.name).toBe("Test Brand")
    expect(info.tokenCount).toBe(2)
    expect(info.mode).toBe("light")
    expect(info.isDarkModeActive).toBe(false)
    expect(info.lastUpdated).toBeDefined()
  })

  it("should return Unknown Brand when no meta", () => {
    const variables = { "--color-primary": "#3b82f6" }
    globalThis.document = createMockDocument(variables) as unknown as Document
    globalThis.getComputedStyle = mockGetComputedStyle(variables)
    globalThis.window = createMockWindow() as unknown as Window &
      typeof globalThis

    const info = getBrandInfo()

    expect(info.name).toBe("Unknown Brand")
  })

  it("should detect dark mode", () => {
    const variables = { "--color-primary": "#3b82f6" }
    globalThis.document = createMockDocument(variables, {
      darkClass: true,
    }) as unknown as Document
    globalThis.getComputedStyle = mockGetComputedStyle(variables)

    const info = getBrandInfo()

    expect(info.mode).toBe("dark")
    expect(info.isDarkModeActive).toBe(true)
  })
})

// =============================================================================
// DevTools State Tests
// =============================================================================

describe("createDevToolsState", () => {
  it("should create complete state", () => {
    const variables = {
      "--color-primary": "#3b82f6",
      "--color-secondary": "#64748b",
      "--spacing-4": "1rem",
      "--radius-md": "0.5rem",
    }
    globalThis.document = createMockDocument(variables) as unknown as Document
    globalThis.getComputedStyle = mockGetComputedStyle(variables)
    globalThis.window = createMockWindow() as unknown as Window &
      typeof globalThis

    const state = createDevToolsState()

    expect(state.brand).toBeDefined()
    expect(state.allTokens.length).toBe(4)
    expect(state.tokenGroups.length).toBe(3) // colors, spacing, radius
    expect(state.selectedCategory).toBe("all")
    expect(state.searchQuery).toBe("")
    expect(state.isExpanded).toBe(true)
  })

  it("should handle empty variables", () => {
    globalThis.document = createMockDocument({}) as unknown as Document
    globalThis.getComputedStyle = mockGetComputedStyle({})
    globalThis.window = createMockWindow() as unknown as Window &
      typeof globalThis

    const state = createDevToolsState()

    expect(state.allTokens.length).toBe(0)
    expect(state.tokenGroups.length).toBe(0)
    expect(state.brand.tokenCount).toBe(0)
  })
})

describe("filterTokens", () => {
  const createTestState = (): DevToolsPanelState => ({
    brand: {
      name: "Test",
      mode: "light",
      isDarkModeActive: false,
      tokenCount: 4,
      lastUpdated: new Date().toISOString(),
    },
    tokenGroups: [],
    allTokens: [
      {
        name: "Primary",
        cssVar: "--color-primary",
        value: "#3b82f6",
        category: "colors",
      },
      {
        name: "Secondary",
        cssVar: "--color-secondary",
        value: "#64748b",
        category: "colors",
      },
      {
        name: "Spacing 4",
        cssVar: "--spacing-4",
        value: "1rem",
        category: "spacing",
      },
      {
        name: "Radius Md",
        cssVar: "--radius-md",
        value: "0.5rem",
        category: "radius",
      },
    ],
    selectedCategory: "all",
    searchQuery: "",
    isExpanded: true,
  })

  it("should filter by category", () => {
    const state = createTestState()

    const filtered = filterTokens(state, "colors", "")

    expect(filtered.length).toBe(2)
    expect(filtered.every((t) => t.category === "colors")).toBe(true)
  })

  it("should filter by search query", () => {
    const state = createTestState()

    const filtered = filterTokens(state, "all", "primary")

    expect(filtered.length).toBe(1)
    expect(filtered[0].name).toBe("Primary")
  })

  it("should combine category and search filters", () => {
    const state = createTestState()

    const filtered = filterTokens(state, "colors", "secondary")

    expect(filtered.length).toBe(1)
    expect(filtered[0].name).toBe("Secondary")
  })

  it("should return all when no filters", () => {
    const state = createTestState()

    const filtered = filterTokens(state, "all", "")

    expect(filtered.length).toBe(4)
  })

  it("should search in value", () => {
    const state = createTestState()

    const filtered = filterTokens(state, "all", "3b82f6")

    expect(filtered.length).toBe(1)
    expect(filtered[0].cssVar).toBe("--color-primary")
  })

  it("should search in cssVar", () => {
    const state = createTestState()

    const filtered = filterTokens(state, "all", "radius-md")

    expect(filtered.length).toBe(1)
    expect(filtered[0].category).toBe("radius")
  })
})

describe("refreshDevToolsState", () => {
  it("should preserve user selections", () => {
    const variables = {
      "--color-primary": "#3b82f6",
      "--spacing-4": "1rem",
    }
    globalThis.document = createMockDocument(variables) as unknown as Document
    globalThis.getComputedStyle = mockGetComputedStyle(variables)
    globalThis.window = createMockWindow() as unknown as Window &
      typeof globalThis

    const currentState: DevToolsPanelState = {
      brand: { name: "Old", mode: "light", isDarkModeActive: false, tokenCount: 0, lastUpdated: "" },
      tokenGroups: [],
      allTokens: [],
      selectedCategory: "colors",
      searchQuery: "test",
      isExpanded: false,
    }

    const newState = refreshDevToolsState(currentState)

    expect(newState.selectedCategory).toBe("colors")
    expect(newState.searchQuery).toBe("test")
    expect(newState.isExpanded).toBe(false)
    expect(newState.allTokens.length).toBe(2) // Updated tokens
  })
})

// =============================================================================
// Window Integration Tests
// =============================================================================

describe("installDevTools", () => {
  it("should install devtools on window", () => {
    const variables = { "--color-primary": "#3b82f6" }
    globalThis.document = createMockDocument(variables) as unknown as Document
    globalThis.getComputedStyle = mockGetComputedStyle(variables)
    globalThis.window = createMockWindow() as unknown as Window &
      typeof globalThis

    installDevTools()

    const devTools = (
      globalThis.window as unknown as Record<string, unknown>
    ).__BRAND_DEVTOOLS__ as Record<string, unknown>
    expect(devTools).toBeDefined()
    expect(typeof devTools.getState).toBe("function")
    expect(typeof devTools.toggleTheme).toBe("function")
    expect(typeof devTools.setTheme).toBe("function")
  })

  it("should handle missing window", () => {
    globalThis.window = undefined as unknown as Window & typeof globalThis

    // Should not throw
    expect(() => installDevTools()).not.toThrow()
  })

  it("should provide working methods", () => {
    const variables = { "--color-primary": "#3b82f6" }
    globalThis.document = createMockDocument(variables) as unknown as Document
    globalThis.getComputedStyle = mockGetComputedStyle(variables)
    globalThis.window = createMockWindow() as unknown as Window &
      typeof globalThis

    installDevTools()

    const devTools = (
      globalThis.window as unknown as Record<string, unknown>
    ).__BRAND_DEVTOOLS__ as {
      getState: () => DevToolsPanelState
      getBrandInfo: () => unknown
    }

    const state = devTools.getState()
    expect(state.allTokens.length).toBe(1)

    const brandInfo = devTools.getBrandInfo()
    expect(brandInfo).toBeDefined()
  })
})

// =============================================================================
// Configuration Tests
// =============================================================================

describe("Configuration options", () => {
  it("should respect custom variable prefix", () => {
    const variables = {
      "--brand-color-primary": "#3b82f6",
      "--color-secondary": "#64748b",
    }
    globalThis.document = createMockDocument(variables) as unknown as Document
    globalThis.getComputedStyle = mockGetComputedStyle(variables)

    const result = extractCSSVariables({ variablePrefix: "--brand-" })

    // Should only extract variables matching the prefix
    expect(result.size).toBe(1)
    expect(result.get("--brand-color-primary")).toBe("#3b82f6")
    expect(result.has("--color-secondary")).toBe(false)
  })

  it("should respect custom dark mode class", () => {
    const mockDoc = createMockDocument()
    mockDoc.documentElement.classList._classes.add("dark-theme")
    globalThis.document = mockDoc as unknown as Document

    const mode = detectThemeMode({ darkModeClass: "dark-theme" })

    expect(mode).toBe("dark")
  })

  it("should respect custom dark mode attribute", () => {
    const mockDoc = {
      documentElement: {
        classList: { contains: () => false },
        getAttribute: (attr: string) =>
          attr === "data-mode" ? "dark" : null,
      },
      body: {
        classList: { contains: () => false },
        getAttribute: () => null,
      },
      querySelector: () => null,
    }
    globalThis.document = mockDoc as unknown as Document

    const mode = detectThemeMode({ darkModeAttribute: "data-mode" })

    expect(mode).toBe("dark")
  })
})

// =============================================================================
// Edge Cases
// =============================================================================

describe("Edge cases", () => {
  it("should handle empty CSS variable value", () => {
    const variables = new Map([
      ["--color-primary", ""],
      ["--spacing-4", "1rem"],
    ])

    const tokens = parseTokens(variables)

    expect(tokens.find((t) => t.cssVar === "--color-primary")?.value).toBe("")
  })

  it("should handle special characters in values", () => {
    const variables = new Map([
      [
        "--shadow-complex",
        "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
      ],
    ])

    const tokens = parseTokens(variables)

    expect(tokens[0].value).toContain("rgba")
  })

  it("should handle case sensitivity in search", () => {
    const state: DevToolsPanelState = {
      brand: { name: "Test", mode: "light", isDarkModeActive: false, tokenCount: 1, lastUpdated: "" },
      tokenGroups: [],
      allTokens: [
        {
          name: "PRIMARY Color",
          cssVar: "--color-PRIMARY",
          value: "#3B82F6",
          category: "colors",
        },
      ],
      selectedCategory: "all",
      searchQuery: "",
      isExpanded: true,
    }

    // Should match case-insensitively
    expect(filterTokens(state, "all", "primary").length).toBe(1)
    expect(filterTokens(state, "all", "PRIMARY").length).toBe(1)
    expect(filterTokens(state, "all", "3b82f6").length).toBe(1)
  })
})
