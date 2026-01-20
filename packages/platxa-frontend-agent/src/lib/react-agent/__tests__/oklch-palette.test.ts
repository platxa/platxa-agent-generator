/**
 * OKLCH Palette Module Tests
 */

import { describe, it, expect } from "vitest"
import {
  // Constants
  DEFAULT_SHADE_CONFIG,
  TAILWIND_SHADES,
  // Color conversion
  rgbToOklch,
  oklchToRgb,
  hexToOklch,
  oklchToHex,
  hslToOklch,
  oklchToHsl,
  parseColor,
  // Formatting
  formatOklch,
  formatTailwindOklch,
  // Gamut
  isInSrgbGamut,
  getMaxChroma,
  mapToGamut,
  createGamutColor,
  // Manipulation
  adjustColor,
  lighten,
  darken,
  saturate,
  desaturate,
  rotateHue,
  mixColors,
  interpolateColors,
  // Shade generation
  generateShadeScale,
  // Palette generation
  generatePalette,
  generateComplementaryPalette,
  generateAnalogousPalette,
  generateTriadicPalette,
  generateSplitComplementaryPalette,
  generateTetradicPalette,
  // Monochromatic (Feature #23)
  generateMonochromaticPalette,
  generateElegantGrayscale,
  // Accessibility
  calculateContrastRatio,
  checkContrast,
  findAccessibleColor,
  // Factory
  createPaletteGenerator,
} from "../oklch-palette"
import type { OklchColor } from "../oklch-palette"

// =============================================================================
// Constants Tests
// =============================================================================

describe("OKLCH Constants", () => {
  describe("DEFAULT_SHADE_CONFIG", () => {
    it("should have 11 shades for Tailwind scale", () => {
      expect(DEFAULT_SHADE_CONFIG.count).toBe(11)
    })

    it("should have lightness range from light to dark", () => {
      expect(DEFAULT_SHADE_CONFIG.lightnessRange[0]).toBeGreaterThan(
        DEFAULT_SHADE_CONFIG.lightnessRange[1]
      )
    })
  })

  describe("TAILWIND_SHADES", () => {
    it("should have 11 shade values", () => {
      expect(TAILWIND_SHADES).toHaveLength(11)
    })

    it("should include standard Tailwind shades", () => {
      expect(TAILWIND_SHADES).toContain(50)
      expect(TAILWIND_SHADES).toContain(500)
      expect(TAILWIND_SHADES).toContain(950)
    })

    it("should be sorted ascending", () => {
      for (let i = 1; i < TAILWIND_SHADES.length; i++) {
        expect(TAILWIND_SHADES[i]).toBeGreaterThan(TAILWIND_SHADES[i - 1])
      }
    })
  })
})

// =============================================================================
// Color Conversion Tests
// =============================================================================

describe("Color Conversion", () => {
  describe("rgbToOklch", () => {
    it("should convert white", () => {
      const result = rgbToOklch({ r: 255, g: 255, b: 255 })
      expect(result.l).toBeCloseTo(1, 1)
      expect(result.c).toBeCloseTo(0, 2)
    })

    it("should convert black", () => {
      const result = rgbToOklch({ r: 0, g: 0, b: 0 })
      expect(result.l).toBeCloseTo(0, 1)
      expect(result.c).toBeCloseTo(0, 2)
    })

    it("should convert red", () => {
      const result = rgbToOklch({ r: 255, g: 0, b: 0 })
      expect(result.l).toBeGreaterThan(0.5)
      expect(result.c).toBeGreaterThan(0.2)
      // Red hue in OKLCH is approximately 29°
      expect(result.h).toBeCloseTo(29, 0)
    })

    it("should convert green", () => {
      const result = rgbToOklch({ r: 0, g: 255, b: 0 })
      // Green hue in OKLCH is approximately 142°
      expect(result.h).toBeCloseTo(142, 0)
    })

    it("should convert blue", () => {
      const result = rgbToOklch({ r: 0, g: 0, b: 255 })
      // Blue hue in OKLCH is approximately 264°
      expect(result.h).toBeCloseTo(264, 0)
    })

    it("should preserve alpha", () => {
      const result = rgbToOklch({ r: 255, g: 0, b: 0, alpha: 0.5 })
      expect(result.alpha).toBe(0.5)
    })
  })

  describe("oklchToRgb", () => {
    it("should convert white", () => {
      const result = oklchToRgb({ l: 1, c: 0, h: 0 })
      expect(result.r).toBe(255)
      expect(result.g).toBe(255)
      expect(result.b).toBe(255)
    })

    it("should convert black", () => {
      const result = oklchToRgb({ l: 0, c: 0, h: 0 })
      expect(result.r).toBe(0)
      expect(result.g).toBe(0)
      expect(result.b).toBe(0)
    })

    it("should round-trip colors", () => {
      const original = { r: 128, g: 64, b: 192 }
      const oklch = rgbToOklch(original)
      const result = oklchToRgb(oklch)

      expect(result.r).toBeCloseTo(original.r, 0)
      expect(result.g).toBeCloseTo(original.g, 0)
      expect(result.b).toBeCloseTo(original.b, 0)
    })

    it("should preserve alpha", () => {
      const result = oklchToRgb({ l: 0.5, c: 0.1, h: 0, alpha: 0.75 })
      expect(result.alpha).toBe(0.75)
    })
  })

  describe("hexToOklch", () => {
    it("should convert hex with hash", () => {
      const result = hexToOklch("#ff0000")
      expect(result).not.toBeNull()
      expect(result?.c).toBeGreaterThan(0.2)
    })

    it("should convert hex without hash", () => {
      const result = hexToOklch("00ff00")
      expect(result).not.toBeNull()
    })

    it("should handle 8-digit hex (with alpha)", () => {
      const result = hexToOklch("#ff000080")
      expect(result).not.toBeNull()
      expect(result?.alpha).toBeCloseTo(0.5, 1)
    })

    it("should return null for invalid hex", () => {
      expect(hexToOklch("invalid")).toBeNull()
      expect(hexToOklch("#gg0000")).toBeNull()
    })
  })

  describe("oklchToHex", () => {
    it("should convert to hex", () => {
      const hex = oklchToHex({ l: 0.63, c: 0.26, h: 29 })
      expect(hex).toMatch(/^#[0-9a-f]{6}$/i)
    })

    it("should include alpha when present", () => {
      const hex = oklchToHex({ l: 0.5, c: 0.1, h: 0, alpha: 0.5 })
      expect(hex).toMatch(/^#[0-9a-f]{8}$/i)
    })

    it("should round-trip with hexToOklch", () => {
      const original = "#3366cc"
      const oklch = hexToOklch(original)
      expect(oklch).not.toBeNull()
      const result = oklchToHex(oklch!)

      // May have slight differences due to gamut mapping
      expect(result.toLowerCase()).toBe(original.toLowerCase())
    })
  })

  describe("hslToOklch", () => {
    it("should convert HSL red", () => {
      const result = hslToOklch({ h: 0, s: 100, l: 50 })
      expect(result.c).toBeGreaterThan(0.2)
    })

    it("should convert grayscale", () => {
      const result = hslToOklch({ h: 0, s: 0, l: 50 })
      expect(result.c).toBeCloseTo(0, 2)
    })

    it("should preserve alpha", () => {
      const result = hslToOklch({ h: 0, s: 100, l: 50, alpha: 0.5 })
      expect(result.alpha).toBe(0.5)
    })
  })

  describe("oklchToHsl", () => {
    it("should convert to HSL", () => {
      const hsl = oklchToHsl({ l: 0.63, c: 0.26, h: 29 })
      expect(hsl.h).toBeGreaterThanOrEqual(0)
      expect(hsl.h).toBeLessThanOrEqual(360)
      expect(hsl.s).toBeGreaterThanOrEqual(0)
      expect(hsl.s).toBeLessThanOrEqual(100)
      expect(hsl.l).toBeGreaterThanOrEqual(0)
      expect(hsl.l).toBeLessThanOrEqual(100)
    })

    it("should handle grayscale", () => {
      const hsl = oklchToHsl({ l: 0.5, c: 0, h: 0 })
      expect(hsl.s).toBe(0)
    })
  })

  describe("parseColor", () => {
    it("should parse hex colors", () => {
      const result = parseColor("#ff6600")
      expect(result.valid).toBe(true)
      expect(result.format).toBe("hex")
      expect(result.oklch).not.toBeNull()
    })

    it("should parse rgb colors", () => {
      const result = parseColor("rgb(255, 102, 0)")
      expect(result.valid).toBe(true)
      expect(result.format).toBe("rgb")
    })

    it("should parse rgba colors", () => {
      const result = parseColor("rgba(255, 102, 0, 0.5)")
      expect(result.valid).toBe(true)
      expect(result.oklch?.alpha).toBeCloseTo(0.5, 1)
    })

    it("should parse hsl colors", () => {
      const result = parseColor("hsl(24, 100%, 50%)")
      expect(result.valid).toBe(true)
      expect(result.format).toBe("hsl")
    })

    it("should parse oklch colors", () => {
      const result = parseColor("oklch(70% 0.15 50)")
      expect(result.valid).toBe(true)
      expect(result.format).toBe("oklch")
      expect(result.oklch?.l).toBeCloseTo(0.7, 1)
    })

    it("should parse oklch with alpha", () => {
      const result = parseColor("oklch(70% 0.15 50 / 0.5)")
      expect(result.valid).toBe(true)
      expect(result.oklch?.alpha).toBeCloseTo(0.5, 1)
    })

    it("should return invalid for unknown formats", () => {
      const result = parseColor("not-a-color")
      expect(result.valid).toBe(false)
      expect(result.format).toBe("unknown")
    })
  })
})

// =============================================================================
// Formatting Tests
// =============================================================================

describe("OKLCH Formatting", () => {
  describe("formatOklch", () => {
    it("should format as CSS oklch()", () => {
      const result = formatOklch({ l: 0.7, c: 0.15, h: 50 })
      expect(result).toMatch(/^oklch\(70\.\d+% 0\.\d+ 50\.\d+\)$/)
    })

    it("should include alpha when present", () => {
      const result = formatOklch({ l: 0.7, c: 0.15, h: 50, alpha: 0.5 })
      expect(result).toContain("/ 0.5")
    })

    it("should respect precision", () => {
      // 0.15.toFixed(1) = "0.1" due to floating point representation
      const result = formatOklch({ l: 0.7, c: 0.15, h: 50 }, 1)
      expect(result).toBe("oklch(70.0% 0.1 50.0)")
    })
  })

  describe("formatTailwindOklch", () => {
    it("should format for Tailwind CSS variables", () => {
      const result = formatTailwindOklch({ l: 0.7, c: 0.15, h: 50 })
      expect(result).toMatch(/^\d+\.\d+% 0\.\d+ \d+\.\d+$/)
    })

    it("should not include alpha", () => {
      const result = formatTailwindOklch({ l: 0.7, c: 0.15, h: 50, alpha: 0.5 })
      expect(result).not.toContain("/")
    })
  })
})

// =============================================================================
// Gamut Tests
// =============================================================================

describe("Gamut Mapping", () => {
  describe("isInSrgbGamut", () => {
    it("should return true for in-gamut colors", () => {
      expect(isInSrgbGamut({ l: 0.5, c: 0.1, h: 0 })).toBe(true)
      expect(isInSrgbGamut({ l: 1, c: 0, h: 0 })).toBe(true) // White
      expect(isInSrgbGamut({ l: 0, c: 0, h: 0 })).toBe(true) // Black
    })

    it("should return false for out-of-gamut colors", () => {
      // Very high chroma at certain hues can be out of gamut
      expect(isInSrgbGamut({ l: 0.5, c: 0.5, h: 150 })).toBe(false)
    })
  })

  describe("getMaxChroma", () => {
    it("should return 0 at lightness extremes", () => {
      expect(getMaxChroma(0, 0)).toBe(0) // Black
      expect(getMaxChroma(0, 1)).toBe(0) // White
    })

    it("should return higher chroma at mid lightness", () => {
      const midChroma = getMaxChroma(0, 0.5)
      const lowChroma = getMaxChroma(0, 0.1)
      expect(midChroma).toBeGreaterThan(lowChroma)
    })
  })

  describe("mapToGamut", () => {
    it("should not modify in-gamut colors", () => {
      const color: OklchColor = { l: 0.5, c: 0.1, h: 0 }
      const result = mapToGamut(color)
      expect(result.wasMapped).toBe(false)
      expect(result.mapped).toEqual(color)
    })

    it("should reduce chroma for out-of-gamut colors", () => {
      const color: OklchColor = { l: 0.5, c: 0.5, h: 150 }
      const result = mapToGamut(color)
      expect(result.wasMapped).toBe(true)
      expect(result.mapped.c).toBeLessThan(color.c)
    })

    it("should preserve hue and lightness", () => {
      const color: OklchColor = { l: 0.5, c: 0.5, h: 150 }
      const result = mapToGamut(color)
      expect(result.mapped.l).toBe(color.l)
      expect(result.mapped.h).toBe(color.h)
    })
  })

  describe("createGamutColor", () => {
    it("should create gamut color with in-gamut flag", () => {
      const result = createGamutColor({ l: 0.5, c: 0.1, h: 0 })
      expect(result.inGamut).toBe(true)
      expect(result.fallback).toBeUndefined()
    })

    it("should include fallback for out-of-gamut colors", () => {
      const result = createGamutColor({ l: 0.5, c: 0.5, h: 150 })
      expect(result.inGamut).toBe(false)
      expect(result.fallback).toBeDefined()
      expect(result.fallback).toMatch(/^#[0-9a-f]{6}$/i)
    })
  })
})

// =============================================================================
// Color Manipulation Tests
// =============================================================================

describe("Color Manipulation", () => {
  const baseColor: OklchColor = { l: 0.5, c: 0.15, h: 180 }

  describe("adjustColor", () => {
    it("should adjust lightness", () => {
      const result = adjustColor(baseColor, { lightness: 0.2 })
      expect(result.l).toBe(0.7)
    })

    it("should adjust chroma", () => {
      const result = adjustColor(baseColor, { chroma: 0.05 })
      expect(result.c).toBe(0.2)
    })

    it("should adjust hue", () => {
      const result = adjustColor(baseColor, { hue: 30 })
      expect(result.h).toBe(210)
    })

    it("should wrap hue around 360", () => {
      const result = adjustColor(baseColor, { hue: 200 })
      expect(result.h).toBe(20)
    })

    it("should clamp lightness to 0-1", () => {
      const light = adjustColor(baseColor, { lightness: 1 })
      expect(light.l).toBe(1)

      const dark = adjustColor(baseColor, { lightness: -1 })
      expect(dark.l).toBe(0)
    })
  })

  describe("lighten", () => {
    it("should increase lightness", () => {
      const result = lighten(baseColor, 0.2)
      expect(result.l).toBe(0.7)
    })
  })

  describe("darken", () => {
    it("should decrease lightness", () => {
      const result = darken(baseColor, 0.2)
      expect(result.l).toBe(0.3)
    })
  })

  describe("saturate", () => {
    it("should increase chroma", () => {
      const result = saturate(baseColor, 0.1)
      expect(result.c).toBe(0.25)
    })
  })

  describe("desaturate", () => {
    it("should decrease chroma", () => {
      const result = desaturate(baseColor, 0.1)
      // Use toBeCloseTo for floating point arithmetic (0.15 - 0.1)
      expect(result.c).toBeCloseTo(0.05, 10)
    })

    it("should not go below 0", () => {
      const result = desaturate(baseColor, 0.5)
      expect(result.c).toBe(0)
    })
  })

  describe("rotateHue", () => {
    it("should rotate hue", () => {
      const result = rotateHue(baseColor, 90)
      expect(result.h).toBe(270)
    })

    it("should wrap negative rotation", () => {
      const result = rotateHue(baseColor, -200)
      expect(result.h).toBe(340)
    })
  })

  describe("mixColors", () => {
    const color1: OklchColor = { l: 0.2, c: 0.1, h: 0 }
    const color2: OklchColor = { l: 0.8, c: 0.3, h: 180 }

    it("should mix at 50%", () => {
      const result = mixColors(color1, color2, 0.5)
      expect(result.l).toBeCloseTo(0.5, 1)
      expect(result.c).toBeCloseTo(0.2, 1)
    })

    it("should return first color at 0%", () => {
      const result = mixColors(color1, color2, 0)
      expect(result.l).toBe(color1.l)
      expect(result.c).toBe(color1.c)
    })

    it("should return second color at 100%", () => {
      const result = mixColors(color1, color2, 1)
      expect(result.l).toBe(color2.l)
      expect(result.c).toBe(color2.c)
    })

    it("should handle hue interpolation (shortest path)", () => {
      const c1: OklchColor = { l: 0.5, c: 0.1, h: 350 }
      const c2: OklchColor = { l: 0.5, c: 0.1, h: 10 }
      const result = mixColors(c1, c2, 0.5)
      // Should go through 0, not through 180
      expect(result.h).toBe(0)
    })
  })

  describe("interpolateColors", () => {
    const start: OklchColor = { l: 0.2, c: 0.1, h: 0 }
    const end: OklchColor = { l: 0.8, c: 0.2, h: 120 }

    it("should generate correct number of steps", () => {
      const result = interpolateColors(start, end, { steps: 5 })
      expect(result).toHaveLength(5)
    })

    it("should start with first color", () => {
      const result = interpolateColors(start, end, { steps: 5 })
      expect(result[0].l).toBe(start.l)
    })

    it("should end with second color", () => {
      const result = interpolateColors(start, end, { steps: 5 })
      expect(result[4].l).toBe(end.l)
    })

    it("should apply easing", () => {
      const linear = interpolateColors(start, end, { steps: 3, method: "linear" })
      const eased = interpolateColors(start, end, { steps: 3, method: "ease-in" })

      // Middle values should differ
      expect(linear[1].l).not.toEqual(eased[1].l)
    })
  })
})

// =============================================================================
// Shade Generation Tests
// =============================================================================

describe("Shade Generation", () => {
  describe("generateShadeScale", () => {
    const base: OklchColor = { l: 0.6, c: 0.2, h: 200 }

    it("should generate all 11 Tailwind shades", () => {
      const shades = generateShadeScale(base)
      expect(Object.keys(shades)).toHaveLength(11)
      expect(shades[50]).toBeDefined()
      expect(shades[950]).toBeDefined()
    })

    it("should have lighter colors at lower shade numbers", () => {
      const shades = generateShadeScale(base)
      expect(shades[50].l).toBeGreaterThan(shades[500].l)
      expect(shades[500].l).toBeGreaterThan(shades[950].l)
    })

    it("should preserve base hue", () => {
      const shades = generateShadeScale(base)
      for (const shade of TAILWIND_SHADES) {
        expect(shades[shade].h).toBeCloseTo(base.h, 0)
      }
    })

    it("should have lower chroma at extremes", () => {
      const shades = generateShadeScale(base)
      // Chroma should be lower at very light/dark ends
      expect(shades[50].c).toBeLessThan(shades[500].c)
      expect(shades[950].c).toBeLessThan(shades[500].c)
    })

    it("should respect custom lightness range", () => {
      const shades = generateShadeScale(base, {
        lightnessRange: [0.95, 0.05],
      })
      expect(shades[50].l).toBeCloseTo(0.95, 1)
      expect(shades[950].l).toBeCloseTo(0.05, 1)
    })
  })
})

// =============================================================================
// Palette Generation Tests
// =============================================================================

describe("Palette Generation", () => {
  describe("generatePalette", () => {
    it("should generate palette from hex color", () => {
      const palette = generatePalette("#3366cc", { name: "blue" })
      expect(palette.name).toBe("blue")
      expect(palette.shades).toBeDefined()
      expect(palette.css).toContain("--blue-500")
    })

    it("should generate palette from OKLCH color", () => {
      const palette = generatePalette({ l: 0.6, c: 0.2, h: 240 }, { name: "custom" })
      expect(palette.base.h).toBe(240)
    })

    it("should throw for invalid color", () => {
      expect(() => generatePalette("invalid", { name: "test" })).toThrow()
    })

    it("should boost low-chroma colors", () => {
      const palette = generatePalette({ l: 0.5, c: 0.01, h: 0 }, { name: "gray" })
      expect(palette.base.c).toBeGreaterThanOrEqual(0.1)
    })

    it("should generate CSS with custom prefix", () => {
      const palette = generatePalette("#ff6600", { name: "orange", prefix: "--color-" })
      expect(palette.css).toContain("--color-orange-500")
    })

    it("should support different output formats", () => {
      const oklchPalette = generatePalette("#ff6600", { name: "test", format: "oklch" })
      expect(oklchPalette.css).toContain("%")

      const hexPalette = generatePalette("#ff6600", { name: "test", format: "hex" })
      expect(hexPalette.css).toContain("#")
    })
  })

  describe("generateComplementaryPalette", () => {
    it("should generate two palettes", () => {
      const palette = generateComplementaryPalette("#ff6600", { name: "warm" })
      expect(palette.primary).toBeDefined()
      expect(palette.secondary).toHaveLength(1)
    })

    it("should have 180° hue difference", () => {
      const palette = generateComplementaryPalette("#ff0000", { name: "red" })
      const primaryHue = palette.primary.base.h
      const secondaryHue = palette.secondary[0].base.h
      const diff = Math.abs(primaryHue - secondaryHue)
      expect(diff).toBeCloseTo(180, 0)
    })

    it("should include combined CSS", () => {
      const palette = generateComplementaryPalette("#ff6600", { name: "test" })
      expect(palette.css).toContain("Complementary")
      expect(palette.css).toContain("primary")
      expect(palette.css).toContain("secondary")
    })
  })

  describe("generateAnalogousPalette", () => {
    it("should generate three palettes", () => {
      const palette = generateAnalogousPalette("#ff6600", { name: "warm" })
      expect(palette.secondary).toHaveLength(2)
    })

    it("should have 30° hue differences", () => {
      const palette = generateAnalogousPalette("#ff0000", { name: "red" })
      const primaryHue = palette.primary.base.h
      const sec1Hue = palette.secondary[0].base.h
      const sec2Hue = palette.secondary[1].base.h

      const diff1 = Math.abs(primaryHue - sec1Hue)
      const diff2 = Math.abs(primaryHue - sec2Hue)

      expect(Math.min(diff1, 360 - diff1)).toBeCloseTo(30, 0)
      expect(Math.min(diff2, 360 - diff2)).toBeCloseTo(30, 0)
    })
  })

  describe("generateTriadicPalette", () => {
    it("should generate three palettes with 120° spacing", () => {
      const palette = generateTriadicPalette("#ff0000", { name: "primary" })
      expect(palette.secondary).toHaveLength(2)

      const hues = [
        palette.primary.base.h,
        palette.secondary[0].base.h,
        palette.secondary[1].base.h,
      ].sort((a, b) => a - b)

      const diff1 = hues[1] - hues[0]
      const diff2 = hues[2] - hues[1]

      expect(diff1).toBeCloseTo(120, 5)
      expect(diff2).toBeCloseTo(120, 5)
    })
  })

  describe("generateSplitComplementaryPalette", () => {
    it("should generate three palettes", () => {
      const palette = generateSplitComplementaryPalette("#ff6600", { name: "test" })
      expect(palette.secondary).toHaveLength(2)
    })

    it("should have correct hue spacing", () => {
      const palette = generateSplitComplementaryPalette("#ff0000", { name: "red" })
      const primaryHue = palette.primary.base.h

      for (const sec of palette.secondary) {
        const diff = Math.abs(primaryHue - sec.base.h)
        const normalizedDiff = Math.min(diff, 360 - diff)
        // Should be around 150° or 210° from primary
        expect(normalizedDiff).toBeGreaterThanOrEqual(145)
        expect(normalizedDiff).toBeLessThanOrEqual(215)
      }
    })
  })

  describe("generateTetradicPalette", () => {
    it("should generate four palettes with 90° spacing", () => {
      const palette = generateTetradicPalette("#ff0000", { name: "test" })
      expect(palette.secondary).toHaveLength(3)
    })
  })
})

// =============================================================================
// Accessibility Tests
// =============================================================================

describe("Accessibility", () => {
  const white: OklchColor = { l: 1, c: 0, h: 0 }
  const black: OklchColor = { l: 0, c: 0, h: 0 }

  describe("calculateContrastRatio", () => {
    it("should return 21 for black on white", () => {
      const ratio = calculateContrastRatio(black, white)
      expect(ratio).toBeCloseTo(21, 0)
    })

    it("should return 1 for same colors", () => {
      const ratio = calculateContrastRatio(white, white)
      expect(ratio).toBe(1)
    })

    it("should be symmetric", () => {
      const color: OklchColor = { l: 0.5, c: 0.1, h: 200 }
      const ratio1 = calculateContrastRatio(color, white)
      const ratio2 = calculateContrastRatio(white, color)
      expect(ratio1).toBeCloseTo(ratio2, 2)
    })
  })

  describe("checkContrast", () => {
    it("should pass all WCAG levels for black on white", () => {
      const result = checkContrast(black, white)
      expect(result.wcag.aa).toBe(true)
      expect(result.wcag.aaa).toBe(true)
      expect(result.wcag.aaLarge).toBe(true)
      expect(result.wcag.aaaLarge).toBe(true)
    })

    it("should fail all for same colors", () => {
      const result = checkContrast(white, white)
      expect(result.wcag.aa).toBe(false)
      expect(result.wcag.aaa).toBe(false)
    })

    it("should return correct ratio", () => {
      const result = checkContrast(black, white)
      expect(result.ratio).toBeCloseTo(21, 0)
    })
  })

  describe("findAccessibleColor", () => {
    it("should suggest white text on dark background", () => {
      const darkBg: OklchColor = { l: 0.2, c: 0.1, h: 240 }
      const result = findAccessibleColor(darkBg)
      expect(result.adjustment).toBe("lighten")
      expect(result.suggested.l).toBe(1)
    })

    it("should suggest dark text on light background", () => {
      const lightBg: OklchColor = { l: 0.9, c: 0.05, h: 60 }
      const result = findAccessibleColor(lightBg)
      expect(result.adjustment).toBe("darken")
      expect(result.suggested.l).toBe(0)
    })

    it("should return contrast ratio", () => {
      const bg: OklchColor = { l: 0.5, c: 0.1, h: 0 }
      const result = findAccessibleColor(bg)
      expect(result.contrastRatio).toBeGreaterThan(1)
    })
  })
})

// =============================================================================
// Factory Tests
// =============================================================================

describe("Factory", () => {
  describe("createPaletteGenerator", () => {
    it("should create generator with defaults", () => {
      const generator = createPaletteGenerator()
      expect(generator.generate).toBeDefined()
      expect(generator.complementary).toBeDefined()
      expect(generator.analogous).toBeDefined()
      expect(generator.triadic).toBeDefined()
    })

    it("should use default options", () => {
      const generator = createPaletteGenerator({ prefix: "--custom-" })
      const palette = generator.generate("#ff6600", { name: "test" })
      expect(palette.css).toContain("--custom-")
    })

    it("should override default options", () => {
      const generator = createPaletteGenerator({ prefix: "--default-" })
      const palette = generator.generate("#ff6600", { name: "test", prefix: "--override-" })
      expect(palette.css).toContain("--override-")
    })

    it("should generate all harmony types", () => {
      const generator = createPaletteGenerator()

      const complementary = generator.complementary("#ff0000")
      expect(complementary.harmony).toBe("complementary")

      const analogous = generator.analogous("#ff0000")
      expect(analogous.harmony).toBe("analogous")

      const triadic = generator.triadic("#ff0000")
      expect(triadic.harmony).toBe("triadic")

      const split = generator.splitComplementary("#ff0000")
      expect(split.harmony).toBe("split-complementary")

      const tetradic = generator.tetradic("#ff0000")
      expect(tetradic.harmony).toBe("tetradic")
    })
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe("Integration", () => {
  it("should generate complete Tailwind-compatible palette", () => {
    const palette = generatePalette("#6366f1", { name: "indigo", format: "oklch" })

    // Should have all shades
    expect(palette.shades[50]).toBeDefined()
    expect(palette.shades[950]).toBeDefined()

    // CSS should be valid
    expect(palette.css).toContain("--indigo-50:")
    expect(palette.css).toContain("--indigo-500:")
    expect(palette.css).toContain("--indigo-950:")

    // Shades should progress from light to dark
    expect(palette.shades[50].l).toBeGreaterThan(palette.shades[950].l)
  })

  it("should handle brand color workflow", () => {
    // Start with brand hex
    const brandHex = "#10b981" // Emerald

    // Parse and convert
    const parsed = parseColor(brandHex)
    expect(parsed.valid).toBe(true)

    // Generate full palette
    const palette = generatePalette(brandHex, { name: "brand" })

    // Check accessibility of common combinations
    const bg = palette.shades[50]
    const text = palette.shades[900]
    const contrast = checkContrast(text, bg)

    expect(contrast.wcag.aa).toBe(true)
  })

  it("should round-trip color conversions accurately", () => {
    const original = "#7c3aed" // Violet
    const oklch = hexToOklch(original)
    expect(oklch).not.toBeNull()

    const backToHex = oklchToHex(oklch!)
    expect(backToHex.toLowerCase()).toBe(original.toLowerCase())
  })
})

// =============================================================================
// Monochromatic Palette Tests (Feature #23)
// =============================================================================

describe("Monochromatic Palette Generator", () => {
  describe("generateMonochromaticPalette", () => {
    it("should generate palette from hex color", () => {
      const palette = generateMonochromaticPalette("#3b82f6", "blue")

      expect(palette.name).toBe("blue")
      expect(palette.base).toBeDefined()
      expect(palette.variations.length).toBeGreaterThan(0)
      expect(palette.shades).toBeDefined()
    })

    it("should generate semantic color variations", () => {
      const palette = generateMonochromaticPalette("#3b82f6", "primary")

      // Check semantic names exist
      expect(palette.semantic.lightest).toBeDefined()
      expect(palette.semantic.lighter).toBeDefined()
      expect(palette.semantic.light).toBeDefined()
      expect(palette.semantic.base).toBeDefined()
      expect(palette.semantic.dark).toBeDefined()
      expect(palette.semantic.darker).toBeDefined()
      expect(palette.semantic.darkest).toBeDefined()
    })

    it("should maintain same hue across all variations", () => {
      const palette = generateMonochromaticPalette("#ef4444", "red")

      // All variations should have similar hue (within tolerance for rounding)
      const baseHue = palette.base.h
      for (const variation of palette.variations) {
        expect(variation.h).toBeCloseTo(baseHue, 1)
      }
    })

    it("should order variations from light to dark", () => {
      const palette = generateMonochromaticPalette("#8b5cf6", "violet")

      // Lightness should generally decrease through variations
      for (let i = 1; i < palette.variations.length; i++) {
        expect(palette.variations[i].l).toBeLessThanOrEqual(palette.variations[i - 1].l + 0.01)
      }
    })

    it("should reduce chroma for light variations", () => {
      const palette = generateMonochromaticPalette("#22c55e", "green", {
        lightChromaReduction: 0.5,
      })

      // Lightest should have reduced chroma
      const lightest = palette.semantic.lightest
      const base = palette.semantic.base

      expect(lightest.c).toBeLessThan(base.c)
    })

    it("should generate CSS variables", () => {
      const palette = generateMonochromaticPalette("#f59e0b", "amber")

      expect(palette.css).toContain("--amber-lightest:")
      expect(palette.css).toContain("--amber-base:")
      expect(palette.css).toContain("--amber-darkest:")
      expect(palette.css).toContain("--amber-500:")
    })

    it("should include neutrals when requested", () => {
      const palette = generateMonochromaticPalette("#06b6d4", "cyan", {
        includeNeutrals: true,
      })

      expect(palette.neutrals).toBeDefined()
      expect(palette.neutrals!.length).toBeGreaterThan(0)
      expect(palette.css).toContain("--cyan-neutral")

      // Neutrals should have very low chroma
      for (const neutral of palette.neutrals!) {
        expect(neutral.c).toBeLessThan(0.05)
      }
    })

    it("should respect custom lightness range", () => {
      const palette = generateMonochromaticPalette("#ec4899", "pink", {
        maxLightness: 0.9,
        minLightness: 0.2,
      })

      // Lightest should not exceed maxLightness
      expect(palette.semantic.lightest.l).toBeLessThanOrEqual(0.91)
      // Darkest should not go below minLightness
      expect(palette.semantic.darkest.l).toBeGreaterThanOrEqual(0.19)
    })

    it("should generate full Tailwind shade scale", () => {
      const palette = generateMonochromaticPalette("#6366f1", "indigo")

      // Check all Tailwind shades exist
      expect(palette.shades[50]).toBeDefined()
      expect(palette.shades[100]).toBeDefined()
      expect(palette.shades[500]).toBeDefined()
      expect(palette.shades[900]).toBeDefined()
      expect(palette.shades[950]).toBeDefined()
    })
  })

  describe("generateElegantGrayscale", () => {
    it("should generate neutral grayscale by default", () => {
      const gray = generateElegantGrayscale()

      expect(gray.name).toBe("gray")
      expect(gray.base.c).toBeLessThan(0.05) // Very low chroma
    })

    it("should generate warm grayscale", () => {
      const warmGray = generateElegantGrayscale({ name: "warm-gray", warmth: 0.5 })

      expect(warmGray.name).toBe("warm-gray")
      // Warm hue should be in orange/yellow range (30-60)
      expect(warmGray.base.h).toBeGreaterThanOrEqual(30)
      expect(warmGray.base.h).toBeLessThanOrEqual(60)
    })

    it("should generate cool grayscale", () => {
      const coolGray = generateElegantGrayscale({ name: "cool-gray", warmth: -0.5 })

      expect(coolGray.name).toBe("cool-gray")
      // Cool hue should be in blue range (210-240)
      expect(coolGray.base.h).toBeGreaterThanOrEqual(210)
      expect(coolGray.base.h).toBeLessThanOrEqual(240)
    })

    it("should use custom chroma for subtle tinting", () => {
      const tinted = generateElegantGrayscale({ chroma: 0.02 })

      // Should have subtle chroma
      expect(tinted.base.c).toBeCloseTo(0.02, 2)
    })

    it("should generate full shade scale", () => {
      const gray = generateElegantGrayscale()

      expect(gray.shades[50]).toBeDefined()
      expect(gray.shades[950]).toBeDefined()

      // Should span full lightness range
      expect(gray.shades[50].l).toBeGreaterThan(0.9)
      expect(gray.shades[950].l).toBeLessThan(0.2)
    })
  })

  describe("Root cause: monochromatic elegance from lightness control", () => {
    it("should maintain visual cohesion through consistent hue", () => {
      const palette = generateMonochromaticPalette("#2563eb", "royal-blue")

      // All shades should share same hue
      const shadeHues = Object.values(palette.shades).map((s) => s.h)
      const avgHue = shadeHues.reduce((a, b) => a + b, 0) / shadeHues.length

      for (const hue of shadeHues) {
        expect(Math.abs(hue - avgHue)).toBeLessThan(1)
      }
    })

    it("should create usable contrast pairs", () => {
      const palette = generateMonochromaticPalette("#059669", "emerald")

      // Light bg with dark text should have good contrast
      const contrastRatio = calculateContrastRatio(
        palette.semantic.darkest,
        palette.semantic.lightest
      )

      expect(contrastRatio).toBeGreaterThan(4.5) // WCAG AA
    })
  })
})
