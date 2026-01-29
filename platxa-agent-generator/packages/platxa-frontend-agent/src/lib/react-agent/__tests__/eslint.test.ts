/**
 * ESLint Plugin - Tests
 *
 * Tests the ESLint rules for brand token usage:
 * - Color detection utilities
 * - no-hardcoded-colors rule
 * - prefer-brand-token rule
 */

import { describe, it, expect } from "vitest"
import {
  plugin,
  flatConfigRecommended,
  flatConfigStrict,
  isColorValue,
  isColorProperty,
  extractColorsFromValue,
  suggestTokenForColor,
  COLOR_PATTERNS,
  COLOR_PROPERTIES,
  NAMED_COLORS,
  DEFAULT_ALLOWED_COLORS,
} from "../eslint"

// ============================================================================
// Plugin Export Tests
// ============================================================================

describe("ESLint Plugin Exports", () => {
  it("should export plugin with correct metadata", () => {
    expect(plugin.meta?.name).toBe("@platxa/eslint-plugin")
    expect(plugin.meta?.version).toBe("1.0.0")
  })

  it("should export both rules", () => {
    expect(plugin.rules).toHaveProperty("no-hardcoded-colors")
    expect(plugin.rules).toHaveProperty("prefer-brand-token")
  })

  it("should export recommended config", () => {
    expect(plugin.configs?.recommended).toBeDefined()
    expect(plugin.configs?.recommended.rules).toHaveProperty(
      "@platxa/frontend-agent/no-hardcoded-colors"
    )
  })

  it("should export strict config", () => {
    expect(plugin.configs?.strict).toBeDefined()
    expect(plugin.configs?.strict.rules).toHaveProperty(
      "@platxa/frontend-agent/no-hardcoded-colors",
      "error"
    )
  })

  it("should export flat config presets", () => {
    expect(flatConfigRecommended.plugins).toHaveProperty("platxa")
    expect(flatConfigRecommended.rules).toHaveProperty("platxa/no-hardcoded-colors", "warn")

    expect(flatConfigStrict.plugins).toHaveProperty("platxa")
    expect(flatConfigStrict.rules).toHaveProperty("platxa/no-hardcoded-colors", "error")
  })
})

// ============================================================================
// Color Pattern Tests
// ============================================================================

describe("COLOR_PATTERNS", () => {
  describe("hex pattern", () => {
    it("should match 3-digit hex colors", () => {
      expect(COLOR_PATTERNS.hex.test("#fff")).toBe(true)
      expect(COLOR_PATTERNS.hex.test("#FFF")).toBe(true)
      expect(COLOR_PATTERNS.hex.test("#123")).toBe(true)
    })

    it("should match 4-digit hex colors (with alpha)", () => {
      expect(COLOR_PATTERNS.hex.test("#fffa")).toBe(true)
      expect(COLOR_PATTERNS.hex.test("#1234")).toBe(true)
    })

    it("should match 6-digit hex colors", () => {
      expect(COLOR_PATTERNS.hex.test("#ffffff")).toBe(true)
      expect(COLOR_PATTERNS.hex.test("#FFFFFF")).toBe(true)
      expect(COLOR_PATTERNS.hex.test("#123456")).toBe(true)
    })

    it("should match 8-digit hex colors (with alpha)", () => {
      expect(COLOR_PATTERNS.hex.test("#ffffffff")).toBe(true)
      expect(COLOR_PATTERNS.hex.test("#12345678")).toBe(true)
    })

    it("should not match invalid hex colors", () => {
      expect(COLOR_PATTERNS.hex.test("#ff")).toBe(false)
      expect(COLOR_PATTERNS.hex.test("#fffff")).toBe(false)
      expect(COLOR_PATTERNS.hex.test("#gggggg")).toBe(false)
      expect(COLOR_PATTERNS.hex.test("ffffff")).toBe(false)
    })
  })

  describe("rgb pattern", () => {
    it("should match rgb() with commas", () => {
      expect(COLOR_PATTERNS.rgb.test("rgb(255, 128, 0)")).toBe(true)
      expect(COLOR_PATTERNS.rgb.test("rgb(0, 0, 0)")).toBe(true)
    })

    it("should match rgb() with spaces", () => {
      expect(COLOR_PATTERNS.rgb.test("rgb(255 128 0)")).toBe(true)
    })

    it("should match rgba() with alpha", () => {
      expect(COLOR_PATTERNS.rgb.test("rgba(255, 128, 0, 0.5)")).toBe(true)
      expect(COLOR_PATTERNS.rgb.test("rgb(255 128 0 / 0.5)")).toBe(true)
    })

    it("should match rgb() with percentages", () => {
      expect(COLOR_PATTERNS.rgb.test("rgb(100%, 50%, 0%)")).toBe(true)
    })
  })

  describe("hsl pattern", () => {
    it("should match hsl() with commas", () => {
      expect(COLOR_PATTERNS.hsl.test("hsl(220, 50%, 50%)")).toBe(true)
    })

    it("should match hsl() with spaces", () => {
      expect(COLOR_PATTERNS.hsl.test("hsl(220 50% 50%)")).toBe(true)
    })

    it("should match hsla() with alpha", () => {
      expect(COLOR_PATTERNS.hsl.test("hsla(220, 50%, 50%, 0.5)")).toBe(true)
      expect(COLOR_PATTERNS.hsl.test("hsl(220 50% 50% / 0.5)")).toBe(true)
    })

    it("should match hsl() with angle units", () => {
      expect(COLOR_PATTERNS.hsl.test("hsl(220deg, 50%, 50%)")).toBe(true)
      expect(COLOR_PATTERNS.hsl.test("hsl(3.14rad 50% 50%)")).toBe(true)
    })
  })

  describe("oklch pattern", () => {
    it("should match oklch() format", () => {
      expect(COLOR_PATTERNS.oklch.test("oklch(0.7 0.15 220)")).toBe(true)
      expect(COLOR_PATTERNS.oklch.test("oklch(70% 0.15 220)")).toBe(true)
    })

    it("should match oklch() with alpha", () => {
      expect(COLOR_PATTERNS.oklch.test("oklch(0.7 0.15 220 / 0.5)")).toBe(true)
    })
  })
})

// ============================================================================
// Color Detection Utility Tests
// ============================================================================

describe("isColorValue", () => {
  const allowedColors = DEFAULT_ALLOWED_COLORS

  it("should detect hex colors", () => {
    expect(isColorValue("#fff", allowedColors)).toBe(true)
    expect(isColorValue("#ffffff", allowedColors)).toBe(true)
    expect(isColorValue("#12345678", allowedColors)).toBe(true)
  })

  it("should detect rgb colors", () => {
    expect(isColorValue("rgb(255, 128, 0)", allowedColors)).toBe(true)
    expect(isColorValue("rgba(255, 128, 0, 0.5)", allowedColors)).toBe(true)
  })

  it("should detect hsl colors", () => {
    expect(isColorValue("hsl(220, 50%, 50%)", allowedColors)).toBe(true)
    expect(isColorValue("hsla(220, 50%, 50%, 0.5)", allowedColors)).toBe(true)
  })

  it("should detect named colors", () => {
    expect(isColorValue("red", allowedColors)).toBe(true)
    expect(isColorValue("blue", allowedColors)).toBe(true)
    expect(isColorValue("cornflowerblue", allowedColors)).toBe(true)
  })

  it("should not detect allowed colors", () => {
    expect(isColorValue("transparent", allowedColors)).toBe(false)
    expect(isColorValue("inherit", allowedColors)).toBe(false)
    expect(isColorValue("currentColor", allowedColors)).toBe(false)
    expect(isColorValue("none", allowedColors)).toBe(false)
  })

  it("should not detect token references", () => {
    expect(isColorValue("brand(primary)", allowedColors)).toBe(false)
    expect(isColorValue("token(primary)", allowedColors)).toBe(false)
    expect(isColorValue("var(--primary)", allowedColors)).toBe(false)
  })

  it("should not detect non-color values", () => {
    expect(isColorValue("10px", allowedColors)).toBe(false)
    expect(isColorValue("solid", allowedColors)).toBe(false)
    expect(isColorValue("auto", allowedColors)).toBe(false)
  })
})

describe("isColorProperty", () => {
  it("should identify color properties", () => {
    expect(isColorProperty("color")).toBe(true)
    expect(isColorProperty("backgroundColor")).toBe(true)
    expect(isColorProperty("borderColor")).toBe(true)
    expect(isColorProperty("fill")).toBe(true)
    expect(isColorProperty("stroke")).toBe(true)
  })

  it("should identify kebab-case color properties", () => {
    expect(isColorProperty("background-color")).toBe(true)
    expect(isColorProperty("border-color")).toBe(true)
  })

  it("should not identify non-color properties", () => {
    expect(isColorProperty("width")).toBe(false)
    expect(isColorProperty("padding")).toBe(false)
    expect(isColorProperty("margin")).toBe(false)
    expect(isColorProperty("display")).toBe(false)
  })
})

describe("extractColorsFromValue", () => {
  it("should extract single hex color", () => {
    const colors = extractColorsFromValue("#ff5500")
    expect(colors).toContain("#ff5500")
  })

  it("should extract multiple hex colors", () => {
    const colors = extractColorsFromValue("linear-gradient(#fff, #000)")
    expect(colors).toContain("#fff")
    expect(colors).toContain("#000")
  })

  it("should extract functional color notations", () => {
    const colors = extractColorsFromValue("rgb(255, 128, 0)")
    expect(colors).toContain("rgb(255, 128, 0)")
  })

  it("should extract named colors", () => {
    const colors = extractColorsFromValue("1px solid red")
    expect(colors).toContain("red")
  })

  it("should extract colors from complex values", () => {
    const colors = extractColorsFromValue(
      "0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px #00000020"
    )
    expect(colors).toContain("rgba(0, 0, 0, 0.1)")
    expect(colors).toContain("#00000020")
  })
})

describe("suggestTokenForColor", () => {
  it("should suggest background for white colors", () => {
    expect(suggestTokenForColor("#fff")).toBe("background")
    expect(suggestTokenForColor("#ffffff")).toBe("background")
    expect(suggestTokenForColor("white")).toBe("background")
  })

  it("should suggest foreground for black colors", () => {
    expect(suggestTokenForColor("#000")).toBe("foreground")
    expect(suggestTokenForColor("#000000")).toBe("foreground")
    expect(suggestTokenForColor("black")).toBe("foreground")
  })

  it("should suggest primary for other colors", () => {
    expect(suggestTokenForColor("#ff5500")).toBe("primary")
    expect(suggestTokenForColor("rgb(255, 128, 0)")).toBe("primary")
  })

  it("should use custom color map when provided", () => {
    const colorMap = { "#ff5500": "accent", "#00ff00": "success" }
    expect(suggestTokenForColor("#ff5500", colorMap)).toBe("accent")
    expect(suggestTokenForColor("#00ff00", colorMap)).toBe("success")
  })
})

// ============================================================================
// Constants Tests
// ============================================================================

describe("Constants", () => {
  it("should have comprehensive color properties list", () => {
    expect(COLOR_PROPERTIES).toContain("color")
    expect(COLOR_PROPERTIES).toContain("backgroundColor")
    expect(COLOR_PROPERTIES).toContain("borderColor")
    expect(COLOR_PROPERTIES).toContain("fill")
    expect(COLOR_PROPERTIES).toContain("stroke")
    expect(COLOR_PROPERTIES).toContain("outlineColor")
    expect(COLOR_PROPERTIES).toContain("boxShadow")
    expect(COLOR_PROPERTIES.length).toBeGreaterThan(15)
  })

  it("should have comprehensive named colors set", () => {
    expect(NAMED_COLORS.has("red")).toBe(true)
    expect(NAMED_COLORS.has("blue")).toBe(true)
    expect(NAMED_COLORS.has("cornflowerblue")).toBe(true)
    expect(NAMED_COLORS.has("rebeccapurple")).toBe(false) // Ensure not everything
    expect(NAMED_COLORS.size).toBeGreaterThan(100)
  })

  it("should have sensible default allowed colors", () => {
    expect(DEFAULT_ALLOWED_COLORS).toContain("transparent")
    expect(DEFAULT_ALLOWED_COLORS).toContain("inherit")
    expect(DEFAULT_ALLOWED_COLORS).toContain("currentColor")
    expect(DEFAULT_ALLOWED_COLORS).toContain("none")
  })
})

// ============================================================================
// Rule Structure Tests
// ============================================================================

describe("Rule: no-hardcoded-colors", () => {
  // Assert rules exist - this is a precondition for all tests in this block
  if (!plugin.rules) {
    throw new Error("plugin.rules must be defined")
  }
  const rule = plugin.rules["no-hardcoded-colors"]

  it("should have correct meta information", () => {
    expect(rule.meta?.type).toBe("suggestion")
    expect(rule.meta?.docs?.description).toContain("hardcoded color")
    expect(rule.meta?.hasSuggestions).toBe(true)
  })

  it("should have valid schema", () => {
    expect(rule.meta?.schema).toBeDefined()
    expect(Array.isArray(rule.meta?.schema)).toBe(true)
  })

  it("should have message IDs", () => {
    expect(rule.meta?.messages).toHaveProperty("hardcodedColor")
    expect(rule.meta?.messages).toHaveProperty("suggestToken")
    expect(rule.meta?.messages).toHaveProperty("suggestVar")
  })

  it("should have a create function", () => {
    expect(typeof rule.create).toBe("function")
  })
})

describe("Rule: prefer-brand-token", () => {
  // Assert rules exist - this is a precondition for all tests in this block
  if (!plugin.rules) {
    throw new Error("plugin.rules must be defined")
  }
  const rule = plugin.rules["prefer-brand-token"]

  it("should have correct meta information", () => {
    expect(rule.meta?.type).toBe("suggestion")
    expect(rule.meta?.docs?.description).toContain("brand token")
    expect(rule.meta?.hasSuggestions).toBe(true)
  })

  it("should have valid schema", () => {
    expect(rule.meta?.schema).toBeDefined()
    expect(Array.isArray(rule.meta?.schema)).toBe(true)
  })

  it("should have message IDs", () => {
    expect(rule.meta?.messages).toHaveProperty("preferToken")
    expect(rule.meta?.messages).toHaveProperty("useToken")
  })

  it("should have a create function", () => {
    expect(typeof rule.create).toBe("function")
  })
})
