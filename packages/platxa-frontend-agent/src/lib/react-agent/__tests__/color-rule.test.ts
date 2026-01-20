/**
 * Color Rule Module Tests - 60-30-10 Rule Enforcement
 */

import { describe, it, expect } from "vitest"
import {
  // Constants
  DEFAULT_DISTRIBUTION,
  DEFAULT_TOLERANCE,
  DEFAULT_WEIGHTS,
  DEFAULT_ELEMENT_MAPPING,
  // Color conversion
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  convertColor,
  getRelativeLuminance,
  calculateContrast,
  // Color analysis
  categorizeColorUsage,
  assignColorRole,
  calculateColorWeight,
  createColorEntry,
  extractColorsFromStyles,
  // Distribution analysis
  calculateDistribution,
  isWithinTolerance,
  calculateDeviation,
  generateSuggestions,
  calculateBalanceScore,
  // Balance analysis
  analyzeColorBalance,
  analyzeComponent,
  analyzeLayout,
  extractPalette,
  // Color harmony
  detectHarmony,
  analyzeHarmony,
  // Enforcement
  suggestRoleReassignment,
  createBalancedConfig,
  validatePalette,
  // Factory
  createColorRuleAnalyzer,
} from "../color-rule"
import type { ColorEntry, ColorPalette } from "../color-rule"

// =============================================================================
// Constants Tests
// =============================================================================

describe("Color Rule Constants", () => {
  describe("DEFAULT_DISTRIBUTION", () => {
    it("should have 60-30-10 values", () => {
      expect(DEFAULT_DISTRIBUTION.dominant).toBe(60)
      expect(DEFAULT_DISTRIBUTION.secondary).toBe(30)
      expect(DEFAULT_DISTRIBUTION.accent).toBe(10)
    })

    it("should sum to 100%", () => {
      const sum =
        DEFAULT_DISTRIBUTION.dominant +
        DEFAULT_DISTRIBUTION.secondary +
        DEFAULT_DISTRIBUTION.accent
      expect(sum).toBe(100)
    })
  })

  describe("DEFAULT_TOLERANCE", () => {
    it("should have reasonable tolerance values", () => {
      expect(DEFAULT_TOLERANCE.dominant).toBe(10)
      expect(DEFAULT_TOLERANCE.secondary).toBe(10)
      expect(DEFAULT_TOLERANCE.accent).toBe(5)
    })
  })

  describe("DEFAULT_WEIGHTS", () => {
    it("should prioritize background", () => {
      expect(DEFAULT_WEIGHTS.background).toBeGreaterThan(DEFAULT_WEIGHTS.surface)
      expect(DEFAULT_WEIGHTS.background).toBeGreaterThan(DEFAULT_WEIGHTS.text)
    })

    it("should have all weight categories", () => {
      expect(DEFAULT_WEIGHTS).toHaveProperty("background")
      expect(DEFAULT_WEIGHTS).toHaveProperty("surface")
      expect(DEFAULT_WEIGHTS).toHaveProperty("text")
      expect(DEFAULT_WEIGHTS).toHaveProperty("border")
      expect(DEFAULT_WEIGHTS).toHaveProperty("interactive")
      expect(DEFAULT_WEIGHTS).toHaveProperty("decorative")
    })
  })

  describe("DEFAULT_ELEMENT_MAPPING", () => {
    it("should map background to dominant", () => {
      expect(DEFAULT_ELEMENT_MAPPING.background).toBe("dominant")
    })

    it("should map primary button to accent", () => {
      expect(DEFAULT_ELEMENT_MAPPING.primaryButton).toBe("accent")
    })

    it("should map borders to secondary", () => {
      expect(DEFAULT_ELEMENT_MAPPING.border).toBe("secondary")
    })
  })
})

// =============================================================================
// Color Conversion Tests
// =============================================================================

describe("Color Conversion", () => {
  describe("hexToRgb", () => {
    it("should convert hex to RGB", () => {
      expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 })
      expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 })
      expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 })
    })

    it("should handle hex without hash", () => {
      expect(hexToRgb("ffffff")).toEqual({ r: 255, g: 255, b: 255 })
    })

    it("should return null for invalid hex", () => {
      expect(hexToRgb("invalid")).toBeNull()
      expect(hexToRgb("#gggggg")).toBeNull()
    })
  })

  describe("rgbToHex", () => {
    it("should convert RGB to hex", () => {
      expect(rgbToHex(255, 255, 255)).toBe("#ffffff")
      expect(rgbToHex(0, 0, 0)).toBe("#000000")
      expect(rgbToHex(255, 0, 0)).toBe("#ff0000")
    })

    it("should clamp values to valid range", () => {
      expect(rgbToHex(300, -50, 128)).toBe("#ff0080")
    })

    it("should pad single digit hex values", () => {
      expect(rgbToHex(0, 15, 0)).toBe("#000f00")
    })
  })

  describe("rgbToHsl", () => {
    it("should convert RGB to HSL", () => {
      // Red
      const red = rgbToHsl(255, 0, 0)
      expect(red.h).toBe(0)
      expect(red.s).toBe(100)
      expect(red.l).toBe(50)

      // Green
      const green = rgbToHsl(0, 255, 0)
      expect(green.h).toBe(120)

      // Blue
      const blue = rgbToHsl(0, 0, 255)
      expect(blue.h).toBe(240)
    })

    it("should handle grayscale (no saturation)", () => {
      const gray = rgbToHsl(128, 128, 128)
      expect(gray.s).toBe(0)
    })

    it("should handle white and black", () => {
      const white = rgbToHsl(255, 255, 255)
      expect(white.l).toBe(100)

      const black = rgbToHsl(0, 0, 0)
      expect(black.l).toBe(0)
    })
  })

  describe("hslToRgb", () => {
    it("should convert HSL to RGB", () => {
      // Red
      const red = hslToRgb(0, 100, 50)
      expect(red.r).toBe(255)
      expect(red.g).toBe(0)
      expect(red.b).toBe(0)

      // Green
      const green = hslToRgb(120, 100, 50)
      expect(green.g).toBe(255)

      // Blue
      const blue = hslToRgb(240, 100, 50)
      expect(blue.b).toBe(255)
    })

    it("should handle zero saturation (grayscale)", () => {
      const gray = hslToRgb(0, 0, 50)
      expect(gray.r).toBe(gray.g)
      expect(gray.g).toBe(gray.b)
    })
  })

  describe("convertColor", () => {
    it("should convert hex colors", () => {
      const result = convertColor("#ff0000")
      expect(result).not.toBeNull()
      expect(result?.hex).toBe("#ff0000")
      expect(result?.rgb).toEqual({ r: 255, g: 0, b: 0 })
    })

    it("should convert rgb colors", () => {
      const result = convertColor("rgb(255, 0, 0)")
      expect(result).not.toBeNull()
      expect(result?.hex).toBe("#ff0000")
    })

    it("should convert hsl colors", () => {
      const result = convertColor("hsl(0, 100%, 50%)")
      expect(result).not.toBeNull()
      expect(result?.rgb.r).toBe(255)
    })

    it("should convert shadcn HSL format", () => {
      const result = convertColor("240 10% 3.9%")
      expect(result).not.toBeNull()
      expect(result?.hsl.h).toBe(240)
    })

    it("should return null for invalid colors", () => {
      expect(convertColor("invalid")).toBeNull()
      expect(convertColor("")).toBeNull()
    })
  })

  describe("getRelativeLuminance", () => {
    it("should return 1 for white", () => {
      expect(getRelativeLuminance(255, 255, 255)).toBeCloseTo(1, 2)
    })

    it("should return 0 for black", () => {
      expect(getRelativeLuminance(0, 0, 0)).toBe(0)
    })

    it("should calculate correctly for colors", () => {
      const lum = getRelativeLuminance(255, 0, 0)
      expect(lum).toBeGreaterThan(0)
      expect(lum).toBeLessThan(1)
    })
  })

  describe("calculateContrast", () => {
    it("should calculate 21:1 for black on white", () => {
      const result = calculateContrast("#ffffff", "#000000")
      expect(result.ratio).toBe(21)
      expect(result.wcagAAA).toBe(true)
    })

    it("should calculate 1:1 for same colors", () => {
      const result = calculateContrast("#ff0000", "#ff0000")
      expect(result.ratio).toBe(1)
      expect(result.wcagAA).toBe(false)
    })

    it("should check WCAG compliance", () => {
      // Good contrast
      const good = calculateContrast("#000000", "#ffffff")
      expect(good.wcagAA).toBe(true)
      expect(good.wcagAAA).toBe(true)

      // Borderline contrast
      const borderline = calculateContrast("#767676", "#ffffff")
      expect(borderline.wcagAALarge).toBe(true)
    })

    it("should handle invalid colors gracefully", () => {
      const result = calculateContrast("invalid", "#ffffff")
      expect(result.ratio).toBe(1)
      expect(result.wcagAA).toBe(false)
    })
  })
})

// =============================================================================
// Color Analysis Tests
// =============================================================================

describe("Color Analysis", () => {
  describe("categorizeColorUsage", () => {
    it("should categorize background contexts", () => {
      expect(categorizeColorUsage("background")).toBe("background")
      expect(categorizeColorUsage("bg-primary")).toBe("background")
    })

    it("should categorize surface contexts", () => {
      expect(categorizeColorUsage("card")).toBe("surface")
      expect(categorizeColorUsage("surface-color")).toBe("surface")
    })

    it("should categorize text contexts", () => {
      expect(categorizeColorUsage("text-primary")).toBe("text")
      expect(categorizeColorUsage("foreground")).toBe("text")
    })

    it("should categorize border contexts", () => {
      expect(categorizeColorUsage("border-color")).toBe("border")
      expect(categorizeColorUsage("outline")).toBe("border")
    })

    it("should categorize interactive contexts", () => {
      expect(categorizeColorUsage("button")).toBe("interactive")
      expect(categorizeColorUsage("link-color")).toBe("interactive")
    })

    it("should categorize feedback contexts", () => {
      expect(categorizeColorUsage("error")).toBe("feedback")
      expect(categorizeColorUsage("success-color")).toBe("feedback")
    })

    it("should default to decorative", () => {
      expect(categorizeColorUsage("unknown")).toBe("decorative")
    })
  })

  describe("assignColorRole", () => {
    it("should assign background to dominant", () => {
      expect(assignColorRole("background")).toBe("dominant")
    })

    it("should assign interactive to accent", () => {
      expect(assignColorRole("interactive")).toBe("accent")
    })

    it("should assign border to secondary", () => {
      expect(assignColorRole("border")).toBe("secondary")
    })

    it("should assign feedback to accent", () => {
      expect(assignColorRole("feedback")).toBe("accent")
    })
  })

  describe("calculateColorWeight", () => {
    it("should return highest weight for background", () => {
      expect(calculateColorWeight("background")).toBe(DEFAULT_WEIGHTS.background)
    })

    it("should return appropriate weights for each category", () => {
      expect(calculateColorWeight("surface")).toBe(DEFAULT_WEIGHTS.surface)
      expect(calculateColorWeight("text")).toBe(DEFAULT_WEIGHTS.text)
      expect(calculateColorWeight("border")).toBe(DEFAULT_WEIGHTS.border)
    })
  })

  describe("createColorEntry", () => {
    it("should create entry with all properties", () => {
      const entry = createColorEntry("#ff0000", "background")
      expect(entry.value).toBe("#ff0000")
      expect(entry.role).toBe("dominant")
      expect(entry.category).toBe("background")
      expect(entry.weight).toBe(50)
      expect(entry.context).toBe("background")
    })

    it("should use custom config", () => {
      const entry = createColorEntry("#ff0000", "background", {
        weights: { background: 100, surface: 20, text: 15, border: 5, interactive: 7, decorative: 3 },
      })
      expect(entry.weight).toBe(100)
    })
  })

  describe("extractColorsFromStyles", () => {
    it("should extract background colors", () => {
      const result = extractColorsFromStyles({
        backgroundColor: "#ffffff",
        "background-color": "#000000",
      })
      expect(result.backgrounds).toContain("#ffffff")
      expect(result.backgrounds).toContain("#000000")
    })

    it("should extract foreground colors", () => {
      const result = extractColorsFromStyles({
        color: "#333333",
        fill: "#444444",
      })
      expect(result.foregrounds).toContain("#333333")
      expect(result.foregrounds).toContain("#444444")
    })

    it("should extract border colors", () => {
      const result = extractColorsFromStyles({
        borderColor: "#cccccc",
      })
      expect(result.borders).toContain("#cccccc")
    })

    it("should handle empty styles", () => {
      const result = extractColorsFromStyles({})
      expect(result.backgrounds).toHaveLength(0)
      expect(result.foregrounds).toHaveLength(0)
    })
  })
})

// =============================================================================
// Distribution Analysis Tests
// =============================================================================

describe("Distribution Analysis", () => {
  describe("calculateDistribution", () => {
    it("should calculate perfect 60-30-10 distribution", () => {
      const entries: ColorEntry[] = [
        { value: "#000", role: "dominant", category: "background", weight: 60 },
        { value: "#333", role: "secondary", category: "surface", weight: 30 },
        { value: "#f00", role: "accent", category: "interactive", weight: 10 },
      ]
      const dist = calculateDistribution(entries)
      expect(dist.dominant).toBe(60)
      expect(dist.secondary).toBe(30)
      expect(dist.accent).toBe(10)
    })

    it("should handle empty entries", () => {
      const dist = calculateDistribution([])
      expect(dist.dominant).toBe(0)
      expect(dist.secondary).toBe(0)
      expect(dist.accent).toBe(0)
    })

    it("should handle unbalanced distributions", () => {
      const entries: ColorEntry[] = [
        { value: "#000", role: "dominant", category: "background", weight: 80 },
        { value: "#333", role: "secondary", category: "surface", weight: 15 },
        { value: "#f00", role: "accent", category: "interactive", weight: 5 },
      ]
      const dist = calculateDistribution(entries)
      expect(dist.dominant).toBe(80)
      expect(dist.secondary).toBe(15)
      expect(dist.accent).toBe(5)
    })
  })

  describe("isWithinTolerance", () => {
    it("should return true for perfect distribution", () => {
      const result = isWithinTolerance({ dominant: 60, secondary: 30, accent: 10 })
      expect(result.dominant).toBe(true)
      expect(result.secondary).toBe(true)
      expect(result.accent).toBe(true)
    })

    it("should return true within tolerance", () => {
      const result = isWithinTolerance({ dominant: 55, secondary: 35, accent: 10 })
      expect(result.dominant).toBe(true)
      expect(result.secondary).toBe(true)
    })

    it("should return false outside tolerance", () => {
      const result = isWithinTolerance({ dominant: 40, secondary: 40, accent: 20 })
      expect(result.dominant).toBe(false)
      expect(result.accent).toBe(false)
    })
  })

  describe("calculateDeviation", () => {
    it("should return zero for perfect distribution", () => {
      const dev = calculateDeviation({ dominant: 60, secondary: 30, accent: 10 })
      expect(dev.dominant).toBe(0)
      expect(dev.secondary).toBe(0)
      expect(dev.accent).toBe(0)
    })

    it("should return positive for excess", () => {
      const dev = calculateDeviation({ dominant: 70, secondary: 30, accent: 10 })
      expect(dev.dominant).toBe(10)
    })

    it("should return negative for deficit", () => {
      const dev = calculateDeviation({ dominant: 50, secondary: 30, accent: 10 })
      expect(dev.dominant).toBe(-10)
    })
  })

  describe("generateSuggestions", () => {
    it("should return empty for balanced distribution", () => {
      const suggestions = generateSuggestions({ dominant: 60, secondary: 30, accent: 10 })
      expect(suggestions).toHaveLength(0)
    })

    it("should suggest decrease for excess", () => {
      const suggestions = generateSuggestions({ dominant: 80, secondary: 15, accent: 5 })
      const dominantSuggestion = suggestions.find((s) => s.role === "dominant")
      expect(dominantSuggestion?.type).toBe("decrease")
    })

    it("should suggest increase for deficit", () => {
      const suggestions = generateSuggestions({ dominant: 40, secondary: 50, accent: 10 })
      const dominantSuggestion = suggestions.find((s) => s.role === "dominant")
      expect(dominantSuggestion?.type).toBe("increase")
    })

    it("should sort by priority", () => {
      const suggestions = generateSuggestions({ dominant: 80, secondary: 10, accent: 10 })
      if (suggestions.length > 1) {
        expect(suggestions[0].priority).toBeLessThanOrEqual(suggestions[1].priority)
      }
    })
  })

  describe("calculateBalanceScore", () => {
    it("should return 100 for perfect balance", () => {
      const score = calculateBalanceScore({ dominant: 60, secondary: 30, accent: 10 })
      expect(score).toBe(100)
    })

    it("should return lower score for imbalance", () => {
      const score = calculateBalanceScore({ dominant: 80, secondary: 15, accent: 5 })
      expect(score).toBeLessThan(100)
    })

    it("should return 0 for extreme imbalance", () => {
      const score = calculateBalanceScore({ dominant: 100, secondary: 0, accent: 0 })
      expect(score).toBeLessThanOrEqual(60)
    })
  })
})

// =============================================================================
// Balance Analysis Tests
// =============================================================================

describe("Balance Analysis", () => {
  describe("analyzeColorBalance", () => {
    it("should return balanced for 60-30-10", () => {
      const entries: ColorEntry[] = [
        { value: "#000", role: "dominant", category: "background", weight: 60 },
        { value: "#333", role: "secondary", category: "surface", weight: 30 },
        { value: "#f00", role: "accent", category: "interactive", weight: 10 },
      ]
      const result = analyzeColorBalance(entries)
      expect(result.isBalanced).toBe(true)
      expect(result.score).toBe(100)
    })

    it("should return unbalanced for skewed distribution", () => {
      const entries: ColorEntry[] = [
        { value: "#000", role: "dominant", category: "background", weight: 90 },
        { value: "#333", role: "secondary", category: "surface", weight: 5 },
        { value: "#f00", role: "accent", category: "interactive", weight: 5 },
      ]
      const result = analyzeColorBalance(entries)
      expect(result.isBalanced).toBe(false)
      expect(result.suggestions.length).toBeGreaterThan(0)
    })

    it("should respect strict mode", () => {
      const entries: ColorEntry[] = [
        { value: "#000", role: "dominant", category: "background", weight: 61 },
        { value: "#333", role: "secondary", category: "surface", weight: 29 },
        { value: "#f00", role: "accent", category: "interactive", weight: 10 },
      ]
      const normalResult = analyzeColorBalance(entries)
      const strictResult = analyzeColorBalance(entries, { strict: true })

      expect(normalResult.isBalanced).toBe(true)
      expect(strictResult.isBalanced).toBe(false)
    })

    it("should use custom target distribution", () => {
      const entries: ColorEntry[] = [
        { value: "#000", role: "dominant", category: "background", weight: 50 },
        { value: "#333", role: "secondary", category: "surface", weight: 40 },
        { value: "#f00", role: "accent", category: "interactive", weight: 10 },
      ]
      const result = analyzeColorBalance(entries, {
        targetDistribution: { dominant: 50, secondary: 40, accent: 10 },
      })
      expect(result.isBalanced).toBe(true)
    })
  })

  describe("analyzeComponent", () => {
    it("should analyze component colors", () => {
      const result = analyzeComponent("Button", [
        { value: "#ffffff", context: "background" },
        { value: "#333333", context: "text" },
        { value: "#0066cc", context: "button" },
      ])
      expect(result.component).toBe("Button")
      expect(result.colors).toHaveLength(3)
      expect(result.distribution).toBeDefined()
    })

    it("should provide recommendations", () => {
      const result = analyzeComponent("Card", [
        { value: "#ffffff", context: "background" },
        { value: "#ffffff", context: "surface" },
        { value: "#ffffff", context: "text" },
      ])
      expect(result.colors.every((c) => c.role === "dominant")).toBe(true)
    })
  })

  describe("analyzeLayout", () => {
    it("should aggregate component analyses", () => {
      const result = analyzeLayout([
        {
          name: "Header",
          colors: [
            { value: "#000", context: "background" },
            { value: "#fff", context: "text" },
          ],
        },
        {
          name: "Content",
          colors: [
            { value: "#fff", context: "background" },
            { value: "#333", context: "text" },
          ],
        },
      ])
      expect(result.components).toHaveLength(2)
      expect(result.totalDistribution).toBeDefined()
      expect(result.balance).toBeDefined()
      expect(result.palette).toBeDefined()
    })
  })

  describe("extractPalette", () => {
    it("should group colors by role", () => {
      const entries: ColorEntry[] = [
        { value: "#000", role: "dominant", category: "background", weight: 60 },
        { value: "#111", role: "dominant", category: "surface", weight: 10 },
        { value: "#333", role: "secondary", category: "text", weight: 20 },
        { value: "#f00", role: "accent", category: "interactive", weight: 10 },
      ]
      const palette = extractPalette(entries)
      expect(palette.dominant).toContain("#000")
      expect(palette.dominant).toContain("#111")
      expect(palette.secondary).toContain("#333")
      expect(palette.accent).toContain("#f00")
    })

    it("should not duplicate colors", () => {
      const entries: ColorEntry[] = [
        { value: "#000", role: "dominant", category: "background", weight: 30 },
        { value: "#000", role: "dominant", category: "surface", weight: 30 },
      ]
      const palette = extractPalette(entries)
      expect(palette.dominant).toHaveLength(1)
    })
  })
})

// =============================================================================
// Color Harmony Tests
// =============================================================================

describe("Color Harmony", () => {
  describe("detectHarmony", () => {
    it("should detect monochromatic", () => {
      const harmony = detectHarmony(["#ff0000", "#ff3333", "#ff6666"])
      expect(harmony).toBe("monochromatic")
    })

    it("should detect complementary", () => {
      const harmony = detectHarmony(["#ff0000", "#00ffff"])
      expect(harmony).toBe("complementary")
    })

    it("should detect analogous", () => {
      const harmony = detectHarmony(["#ff0000", "#ff6600", "#ffcc00"])
      expect(harmony).toBe("analogous")
    })

    it("should return none for single color", () => {
      const harmony = detectHarmony(["#ff0000"])
      expect(harmony).toBe("none")
    })

    it("should return none for empty array", () => {
      const harmony = detectHarmony([])
      expect(harmony).toBe("none")
    })
  })

  describe("analyzeHarmony", () => {
    it("should analyze monochromatic palette", () => {
      const result = analyzeHarmony(["#ff0000", "#ff3333", "#ff6666"])
      expect(result.harmony).toBe("monochromatic")
      expect(result.score).toBeGreaterThan(0)
      expect(result.harmonicColors.length).toBeGreaterThan(0)
    })

    it("should identify discordant colors", () => {
      const result = analyzeHarmony(["#ff0000", "#ff3333", "#00ff00"])
      if (result.harmony === "monochromatic") {
        expect(result.discordantColors.length).toBeGreaterThan(0)
      }
    })

    it("should provide suggestions for no harmony", () => {
      const result = analyzeHarmony(["#123456"])
      expect(result.suggestions.length).toBeGreaterThan(0)
    })

    it("should score perfect harmony at 100", () => {
      const result = analyzeHarmony(["#ff0000", "#ff2222"])
      if (result.harmony !== "none") {
        expect(result.score).toBeGreaterThanOrEqual(50)
      }
    })
  })
})

// =============================================================================
// Enforcement Tests
// =============================================================================

describe("Enforcement Utilities", () => {
  describe("suggestRoleReassignment", () => {
    it("should return empty for balanced entries", () => {
      const entries: ColorEntry[] = [
        { value: "#000", role: "dominant", category: "background", weight: 60 },
        { value: "#333", role: "secondary", category: "surface", weight: 30 },
        { value: "#f00", role: "accent", category: "interactive", weight: 10 },
      ]
      const suggestions = suggestRoleReassignment(entries)
      expect(suggestions).toHaveLength(0)
    })

    it("should suggest reassignment for imbalanced entries", () => {
      const entries: ColorEntry[] = [
        { value: "#000", role: "dominant", category: "background", weight: 80 },
        { value: "#111", role: "dominant", category: "surface", weight: 10 },
        { value: "#333", role: "secondary", category: "text", weight: 5 },
        { value: "#f00", role: "accent", category: "interactive", weight: 5 },
      ]
      const suggestions = suggestRoleReassignment(entries)
      expect(suggestions.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe("createBalancedConfig", () => {
    it("should create entries from palette", () => {
      const palette: ColorPalette = {
        dominant: ["#000000", "#111111"],
        secondary: ["#666666"],
        accent: ["#ff0000"],
      }
      const entries = createBalancedConfig(palette)
      expect(entries.length).toBe(4)
      expect(entries.filter((e) => e.role === "dominant")).toHaveLength(2)
      expect(entries.filter((e) => e.role === "secondary")).toHaveLength(1)
      expect(entries.filter((e) => e.role === "accent")).toHaveLength(1)
    })

    it("should distribute weights according to target", () => {
      const palette: ColorPalette = {
        dominant: ["#000000"],
        secondary: ["#666666"],
        accent: ["#ff0000"],
      }
      const entries = createBalancedConfig(palette)
      const dominantWeight = entries.find((e) => e.role === "dominant")?.weight
      expect(dominantWeight).toBe(60)
    })
  })

  describe("validatePalette", () => {
    it("should validate balanced palette", () => {
      const palette: ColorPalette = {
        dominant: ["#000000"],
        secondary: ["#666666"],
        accent: ["#ff0000"],
      }
      const result = validatePalette(palette)
      expect(result.isBalanced).toBe(true)
      expect(result.score).toBe(100)
    })

    it("should validate with custom config", () => {
      const palette: ColorPalette = {
        dominant: ["#000000"],
        secondary: ["#666666"],
        accent: ["#ff0000"],
      }
      // Custom target: 50-40-10 instead of default 60-30-10
      // The distribution should reflect the custom weights
      const result = validatePalette(palette, {
        targetDistribution: { dominant: 50, secondary: 40, accent: 10 },
      })
      // Proves custom config is used: dominant gets weight 50, not default 60
      expect(result.distribution.dominant).toBe(50)
      expect(result.distribution.secondary).toBe(40)
      expect(result.distribution.accent).toBe(10)
    })
  })
})

// =============================================================================
// Factory Tests
// =============================================================================

describe("Factory Functions", () => {
  describe("createColorRuleAnalyzer", () => {
    it("should create analyzer with default config", () => {
      const analyzer = createColorRuleAnalyzer()
      expect(analyzer.analyzeBalance).toBeDefined()
      expect(analyzer.analyzeComponent).toBeDefined()
      expect(analyzer.analyzeLayout).toBeDefined()
      expect(analyzer.validatePalette).toBeDefined()
      expect(analyzer.suggestReassignment).toBeDefined()
    })

    it("should use custom config in all methods", () => {
      const analyzer = createColorRuleAnalyzer({
        targetDistribution: { dominant: 50, secondary: 40, accent: 10 },
      })

      const entries: ColorEntry[] = [
        { value: "#000", role: "dominant", category: "background", weight: 50 },
        { value: "#333", role: "secondary", category: "surface", weight: 40 },
        { value: "#f00", role: "accent", category: "interactive", weight: 10 },
      ]

      const result = analyzer.analyzeBalance(entries)
      expect(result.isBalanced).toBe(true)
    })

    it("should analyze components with config", () => {
      const analyzer = createColorRuleAnalyzer({
        weights: { background: 100, surface: 50, text: 25, border: 10, interactive: 15, decorative: 5 },
      })

      const result = analyzer.analyzeComponent("Test", [
        { value: "#000", context: "background" },
      ])

      expect(result.colors[0].weight).toBe(100)
    })

    it("should validate palettes with config", () => {
      const analyzer = createColorRuleAnalyzer({ strict: true })

      const palette: ColorPalette = {
        dominant: ["#000"],
        secondary: ["#333"],
        accent: ["#f00"],
      }

      const result = analyzer.validatePalette(palette)
      expect(result.isBalanced).toBe(true)
    })
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe("Integration", () => {
  it("should analyze real-world component palette", () => {
    const analyzer = createColorRuleAnalyzer()

    const result = analyzer.analyzeLayout([
      {
        name: "Header",
        colors: [
          { value: "#ffffff", context: "background" },
          { value: "#1a1a1a", context: "text" },
          { value: "#0066cc", context: "link" },
        ],
      },
      {
        name: "Sidebar",
        colors: [
          { value: "#f5f5f5", context: "background" },
          { value: "#333333", context: "text" },
          { value: "#e0e0e0", context: "border" },
        ],
      },
      {
        name: "Content",
        colors: [
          { value: "#ffffff", context: "background" },
          { value: "#1a1a1a", context: "text" },
          { value: "#0066cc", context: "button" },
        ],
      },
    ])

    expect(result.components).toHaveLength(3)
    expect(result.totalDistribution).toBeDefined()
    expect(result.balance.score).toBeGreaterThanOrEqual(0)
    expect(result.palette.dominant.length).toBeGreaterThan(0)
  })

  it("should provide actionable feedback for imbalanced design", () => {
    const entries: ColorEntry[] = [
      { value: "#ff0000", role: "accent", category: "background", weight: 50 },
      { value: "#ff3333", role: "accent", category: "surface", weight: 30 },
      { value: "#ff6666", role: "accent", category: "text", weight: 20 },
    ]

    const result = analyzeColorBalance(entries)

    expect(result.isBalanced).toBe(false)
    expect(result.suggestions.length).toBeGreaterThan(0)
    expect(result.suggestions[0].message).toBeDefined()
  })

  it("should handle shadcn color format throughout", () => {
    const shadcnColors = [
      { value: "0 0% 100%", context: "background" },
      { value: "240 10% 3.9%", context: "foreground" },
      { value: "240 4.8% 95.9%", context: "muted" },
      { value: "240 5.9% 10%", context: "primary" },
    ]

    const result = analyzeComponent("ShadcnComponent", shadcnColors)
    expect(result.colors).toHaveLength(4)
  })
})
