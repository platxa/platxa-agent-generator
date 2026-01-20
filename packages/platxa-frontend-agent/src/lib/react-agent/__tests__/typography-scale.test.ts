/**
 * Typography Scale Module Tests
 */

import { describe, it, expect } from "vitest"
import {
  // Constants
  SCALE_RATIOS,
  FONT_WEIGHTS,
  DEFAULT_STEP_NAMES,
  DEFAULT_FONT_STACKS,
  DEFAULT_HIERARCHY_CONFIG,
  // Utilities
  getRatioValue,
  getFontWeightValue,
  calculateLineHeight,
  calculateLetterSpacing,
  convertToUnit,
  // Scale generation
  generateScale,
  getScaleStep,
  getStepAtIndex,
  // Hierarchy
  generateSemanticTypography,
  // Fluid
  generateFluidSize,
  generateFluidScale,
  // CSS
  generateTypographyCss,
  // Validation
  validateTypography,
  // Presets
  PRESET_MODERN,
  PRESET_EDITORIAL,
  PRESET_COMPACT,
  TYPOGRAPHY_PRESETS,
  // Factory
  createTypographySystem,
} from "../typography-scale"

// =============================================================================
// Constants Tests
// =============================================================================

describe("Typography Constants", () => {
  describe("SCALE_RATIOS", () => {
    it("should have all standard ratios", () => {
      expect(SCALE_RATIOS["minor-second"]).toBeCloseTo(1.067, 2)
      expect(SCALE_RATIOS["major-second"]).toBeCloseTo(1.125, 2)
      expect(SCALE_RATIOS["minor-third"]).toBeCloseTo(1.2, 2)
      expect(SCALE_RATIOS["major-third"]).toBeCloseTo(1.25, 2)
      expect(SCALE_RATIOS["perfect-fourth"]).toBeCloseTo(1.333, 2)
      expect(SCALE_RATIOS["golden-ratio"]).toBeCloseTo(1.618, 2)
    })

    it("should have ratios greater than 1", () => {
      Object.values(SCALE_RATIOS).forEach((ratio) => {
        expect(ratio).toBeGreaterThan(1)
      })
    })
  })

  describe("FONT_WEIGHTS", () => {
    it("should have all weight names", () => {
      expect(FONT_WEIGHTS.thin).toBe(100)
      expect(FONT_WEIGHTS.normal).toBe(400)
      expect(FONT_WEIGHTS.bold).toBe(700)
      expect(FONT_WEIGHTS.black).toBe(900)
    })

    it("should have weights in increments of 100", () => {
      const weights = Object.values(FONT_WEIGHTS)
      weights.forEach((w) => {
        expect(w % 100).toBe(0)
        expect(w).toBeGreaterThanOrEqual(100)
        expect(w).toBeLessThanOrEqual(900)
      })
    })
  })

  describe("DEFAULT_STEP_NAMES", () => {
    it("should include standard Tailwind sizes", () => {
      expect(DEFAULT_STEP_NAMES).toContain("xs")
      expect(DEFAULT_STEP_NAMES).toContain("sm")
      expect(DEFAULT_STEP_NAMES).toContain("base")
      expect(DEFAULT_STEP_NAMES).toContain("lg")
      expect(DEFAULT_STEP_NAMES).toContain("xl")
    })

    it("should have enough names for typical scales", () => {
      expect(DEFAULT_STEP_NAMES.length).toBeGreaterThanOrEqual(9)
    })
  })

  describe("DEFAULT_FONT_STACKS", () => {
    it("should have system font stacks", () => {
      expect(DEFAULT_FONT_STACKS.systemSans).toContain("system-ui")
      expect(DEFAULT_FONT_STACKS.systemSerif).toContain("Georgia")
      expect(DEFAULT_FONT_STACKS.systemMono).toContain("monospace")
    })
  })

  describe("DEFAULT_HIERARCHY_CONFIG", () => {
    it("should have three hierarchy levels", () => {
      expect(DEFAULT_HIERARCHY_CONFIG.primary).toBeDefined()
      expect(DEFAULT_HIERARCHY_CONFIG.secondary).toBeDefined()
      expect(DEFAULT_HIERARCHY_CONFIG.tertiary).toBeDefined()
    })

    it("should have decreasing size order", () => {
      // Primary should reference larger sizes than secondary
      expect(DEFAULT_HIERARCHY_CONFIG.primary.sizes[0]).toContain("4xl")
      expect(DEFAULT_HIERARCHY_CONFIG.tertiary.sizes[0]).toBe("base")
    })
  })
})

// =============================================================================
// Utility Tests
// =============================================================================

describe("Typography Utilities", () => {
  describe("getRatioValue", () => {
    it("should return number for numeric input", () => {
      expect(getRatioValue(1.5)).toBe(1.5)
    })

    it("should return ratio value for named ratio", () => {
      expect(getRatioValue("perfect-fourth")).toBeCloseTo(1.333, 2)
      expect(getRatioValue("golden-ratio")).toBeCloseTo(1.618, 2)
    })

    it("should return default for custom", () => {
      expect(getRatioValue("custom")).toBe(1.25)
    })
  })

  describe("getFontWeightValue", () => {
    it("should return number for numeric input", () => {
      expect(getFontWeightValue(500)).toBe(500)
    })

    it("should return weight value for named weight", () => {
      expect(getFontWeightValue("bold")).toBe(700)
      expect(getFontWeightValue("normal")).toBe(400)
    })
  })

  describe("calculateLineHeight", () => {
    it("should return tighter line height for larger text", () => {
      const large = calculateLineHeight(48)
      const medium = calculateLineHeight(24)
      const small = calculateLineHeight(14)

      expect(large).toBeLessThan(medium)
      expect(medium).toBeLessThan(small)
    })

    it("should return 1.5 for body text", () => {
      expect(calculateLineHeight(16)).toBe(1.5)
    })

    it("should return around 1.1 for display text", () => {
      expect(calculateLineHeight(64)).toBe(1.1)
    })
  })

  describe("calculateLetterSpacing", () => {
    it("should return tighter tracking for larger text", () => {
      const large = calculateLetterSpacing(48)
      const small = calculateLetterSpacing(14)

      expect(large).toContain("-")
      expect(small).toBe("0")
    })
  })

  describe("convertToUnit", () => {
    it("should convert to px", () => {
      expect(convertToUnit(16, "px")).toBe("16px")
      expect(convertToUnit(24.5, "px")).toBe("25px")
    })

    it("should convert to rem", () => {
      expect(convertToUnit(16, "rem")).toBe("1rem")
      expect(convertToUnit(24, "rem")).toBe("1.5rem")
    })

    it("should use custom root font size", () => {
      expect(convertToUnit(18, "rem", 18)).toBe("1rem")
    })

    it("should convert to em", () => {
      expect(convertToUnit(32, "em")).toBe("2em")
    })
  })
})

// =============================================================================
// Scale Generation Tests
// =============================================================================

describe("Scale Generation", () => {
  describe("generateScale", () => {
    it("should generate scale with default options", () => {
      const scale = generateScale()
      expect(scale.baseSizePx).toBe(16)
      expect(scale.ratio).toBeCloseTo(1.333, 2)
      expect(scale.steps.length).toBeGreaterThan(0)
    })

    it("should generate correct number of steps", () => {
      const scale = generateScale({ stepsUp: 4, stepsDown: 2 })
      expect(scale.steps.length).toBe(7) // 2 down + 1 base + 4 up
    })

    it("should have base size at index 0", () => {
      const scale = generateScale({ baseSizePx: 18 })
      const baseStep = scale.steps.find((s) => s.index === 0)
      expect(baseStep).toBeDefined()
      expect(baseStep?.sizePx).toBeCloseTo(18, 0)
    })

    it("should use specified ratio", () => {
      const scale = generateScale({ ratio: "major-second", baseSizePx: 16 })
      const step1 = scale.steps.find((s) => s.index === 1)
      expect(step1?.sizePx).toBeCloseTo(18, 0) // 16 * 1.125
    })

    it("should create named sizes", () => {
      const scale = generateScale()
      expect(scale.sizes["base"]).toBeDefined()
      expect(scale.sizes["lg"]).toBeDefined()
    })

    it("should output specified unit", () => {
      const pxScale = generateScale({ unit: "px" })
      expect(pxScale.steps[0].size).toContain("px")

      const remScale = generateScale({ unit: "rem" })
      expect(remScale.steps[0].size).toContain("rem")
    })
  })

  describe("getScaleStep", () => {
    const scale = generateScale()

    it("should get step by name", () => {
      const step = getScaleStep(scale, "base")
      expect(step).toBeDefined()
      expect(step?.index).toBe(0)
    })

    it("should return undefined for unknown name", () => {
      const step = getScaleStep(scale, "unknown")
      expect(step).toBeUndefined()
    })
  })

  describe("getStepAtIndex", () => {
    const scale = generateScale()

    it("should get step at index 0", () => {
      const step = getStepAtIndex(scale, 0)
      expect(step).toBeDefined()
      expect(step?.name).toBe("base")
    })

    it("should get step at positive index", () => {
      const step = getStepAtIndex(scale, 1)
      expect(step).toBeDefined()
      expect(step?.sizePx).toBeGreaterThan(16)
    })

    it("should get step at negative index", () => {
      const step = getStepAtIndex(scale, -1)
      expect(step).toBeDefined()
      expect(step?.sizePx).toBeLessThan(16)
    })
  })
})

// =============================================================================
// Hierarchy Tests
// =============================================================================

describe("Hierarchy Generation", () => {
  describe("generateSemanticTypography", () => {
    const scale = generateScale()

    it("should generate all semantic styles", () => {
      const semantic = generateSemanticTypography({ scale })

      expect(semantic.display).toBeDefined()
      expect(semantic.h1).toBeDefined()
      expect(semantic.h2).toBeDefined()
      expect(semantic.h3).toBeDefined()
      expect(semantic.body).toBeDefined()
      expect(semantic.caption).toBeDefined()
      expect(semantic.code).toBeDefined()
    })

    it("should have decreasing heading sizes", () => {
      const semantic = generateSemanticTypography({ scale })

      const h1Size = parseFloat(semantic.h1.fontSize)
      const h2Size = parseFloat(semantic.h2.fontSize)
      const h3Size = parseFloat(semantic.h3.fontSize)

      expect(h1Size).toBeGreaterThan(h2Size)
      expect(h2Size).toBeGreaterThan(h3Size)
    })

    it("should apply font weights from hierarchy", () => {
      const semantic = generateSemanticTypography({ scale })

      expect(semantic.h1.fontWeight).toBe("bold")
      expect(semantic.body.fontWeight).toBe("normal")
    })

    it("should use custom fonts when provided", () => {
      const semantic = generateSemanticTypography({
        scale,
        primaryFont: "Inter, sans-serif",
        monoFont: "Fira Code, monospace",
      })

      expect(semantic.h1.fontFamily).toBe("Inter, sans-serif")
      expect(semantic.code.fontFamily).toBe("Fira Code, monospace")
    })

    it("should apply custom hierarchy config", () => {
      const semantic = generateSemanticTypography({
        scale,
        config: {
          primary: {
            sizes: ["3xl", "2xl", "xl"],
            weight: "extrabold",
            lineHeight: 1.0,
            letterSpacing: "-0.03em",
          },
        },
      })

      expect(semantic.h1.fontWeight).toBe("extrabold")
      expect(semantic.h1.lineHeight).toBe(1.0)
    })
  })
})

// =============================================================================
// Fluid Typography Tests
// =============================================================================

describe("Fluid Typography", () => {
  describe("generateFluidSize", () => {
    it("should generate clamp function", () => {
      const fluid = generateFluidSize({
        minViewport: 320,
        maxViewport: 1200,
        minSize: 16,
        maxSize: 24,
      })

      expect(fluid).toContain("clamp(")
      expect(fluid).toContain("rem")
      expect(fluid).toContain("vw")
    })

    it("should have correct min and max values", () => {
      const fluid = generateFluidSize({
        minViewport: 320,
        maxViewport: 1200,
        minSize: 16,
        maxSize: 24,
      })

      expect(fluid).toContain("1rem") // 16/16 = 1
      expect(fluid).toContain("1.5rem") // 24/16 = 1.5
    })
  })

  describe("generateFluidScale", () => {
    it("should generate scale with clamp values", () => {
      const scale = generateFluidScale({ baseSizePx: 16 })

      expect(scale.unit).toBe("clamp")
      scale.steps.forEach((step) => {
        expect(step.size).toContain("clamp(")
      })
    })

    it("should maintain step relationships", () => {
      const scale = generateFluidScale({ baseSizePx: 16 })
      const base = scale.steps.find((s) => s.index === 0)
      const lg = scale.steps.find((s) => s.index === 1)

      expect(lg?.sizePx).toBeGreaterThan(base?.sizePx || 0)
    })
  })
})

// =============================================================================
// CSS Generation Tests
// =============================================================================

describe("CSS Generation", () => {
  describe("generateTypographyCss", () => {
    const scale = generateScale()
    const semantic = generateSemanticTypography({ scale })

    it("should generate CSS variables", () => {
      const css = generateTypographyCss(scale, semantic)

      expect(css.variables).toContain(":root")
      expect(css.variables).toContain("--font-size-base")
      expect(css.variables).toContain("--text-h1")
    })

    it("should generate CSS classes", () => {
      const css = generateTypographyCss(scale, semantic)

      expect(css.classes).toContain(".text-base")
      expect(css.classes).toContain(".text-h1")
      expect(css.classes).toContain("font-size:")
      expect(css.classes).toContain("line-height:")
    })

    it("should generate Tailwind config", () => {
      const css = generateTypographyCss(scale, semantic)

      expect(css.tailwindConfig.theme).toBeDefined()
      expect((css.tailwindConfig.theme as Record<string, unknown>).extend).toBeDefined()
    })

    it("should use custom prefix", () => {
      const css = generateTypographyCss(scale, semantic, { prefix: "--custom-" })

      expect(css.variables).toContain("--custom-font-size")
    })
  })
})

// =============================================================================
// Validation Tests
// =============================================================================

describe("Validation", () => {
  describe("validateTypography", () => {
    it("should pass valid typography", () => {
      const scale = generateScale()
      const semantic = generateSemanticTypography({ scale })
      const result = validateTypography(scale, semantic)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it("should check minimum body size", () => {
      const scale = generateScale({ baseSizePx: 10 })
      const semantic = generateSemanticTypography({ scale })
      const result = validateTypography(scale, semantic)

      expect(result.a11y.minSizeOk).toBe(false)
    })

    it("should check line height", () => {
      const scale = generateScale()
      const semantic = generateSemanticTypography({
        scale,
        config: {
          tertiary: {
            sizes: ["base", "sm", "xs"],
            weight: "normal",
            lineHeight: 1.2, // Too tight for body
            letterSpacing: "0",
          },
        },
      })
      const result = validateTypography(scale, semantic)

      expect(result.a11y.lineHeightOk).toBe(false)
    })

    it("should check hierarchy clarity", () => {
      const scale = generateScale()
      const semantic = generateSemanticTypography({ scale })
      const result = validateTypography(scale, semantic)

      expect(result.a11y.hierarchyClear).toBe(true)
    })

    it("should warn about small scales", () => {
      const scale = generateScale({ stepsUp: 2, stepsDown: 1 })
      const semantic = generateSemanticTypography({ scale })
      const result = validateTypography(scale, semantic)

      expect(result.warnings.some((w) => w.includes("fewer than 5 steps"))).toBe(true)
    })
  })
})

// =============================================================================
// Presets Tests
// =============================================================================

describe("Presets", () => {
  describe("PRESET_MODERN", () => {
    it("should have modern configuration", () => {
      expect(PRESET_MODERN.name).toBe("modern")
      expect(PRESET_MODERN.scale.ratio).toBe("perfect-fourth")
      expect(PRESET_MODERN.scale.baseSizePx).toBe(16)
    })
  })

  describe("PRESET_EDITORIAL", () => {
    it("should have larger base for reading", () => {
      expect(PRESET_EDITORIAL.scale.baseSizePx).toBe(18)
      expect(PRESET_EDITORIAL.scale.ratio).toBe("major-third")
    })
  })

  describe("PRESET_COMPACT", () => {
    it("should have smaller base for dense UI", () => {
      expect(PRESET_COMPACT.scale.baseSizePx).toBe(14)
      expect(PRESET_COMPACT.scale.ratio).toBe("major-second")
    })
  })

  describe("TYPOGRAPHY_PRESETS", () => {
    it("should contain all presets", () => {
      expect(TYPOGRAPHY_PRESETS.modern).toBe(PRESET_MODERN)
      expect(TYPOGRAPHY_PRESETS.editorial).toBe(PRESET_EDITORIAL)
      expect(TYPOGRAPHY_PRESETS.compact).toBe(PRESET_COMPACT)
    })
  })
})

// =============================================================================
// Factory Tests
// =============================================================================

describe("Factory", () => {
  describe("createTypographySystem", () => {
    it("should create system from preset name", () => {
      const system = createTypographySystem("modern")

      expect(system.scale).toBeDefined()
      expect(system.semantic).toBeDefined()
      expect(system.css).toBeDefined()
      expect(system.validation).toBeDefined()
    })

    it("should create system from preset object", () => {
      const system = createTypographySystem(PRESET_EDITORIAL)

      expect(system.scale.baseSizePx).toBe(18)
    })

    it("should create system from scale options", () => {
      const system = createTypographySystem({
        baseSizePx: 20,
        ratio: "golden-ratio",
      })

      expect(system.scale.baseSizePx).toBe(20)
      expect(system.scale.ratio).toBeCloseTo(1.618, 2)
    })

    it("should throw for unknown preset", () => {
      expect(() => createTypographySystem("unknown")).toThrow()
    })

    it("should return valid typography", () => {
      const system = createTypographySystem("modern")

      expect(system.validation.valid).toBe(true)
    })

    it("should generate complete CSS", () => {
      const system = createTypographySystem("modern")

      expect(system.css.variables).toContain(":root")
      expect(system.css.classes).toContain(".text-")
      expect(system.css.tailwindConfig).toBeDefined()
    })
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe("Integration", () => {
  it("should create complete typography workflow", () => {
    // 1. Generate scale
    const scale = generateScale({
      baseSizePx: 16,
      ratio: "perfect-fourth",
      stepsUp: 6,
      stepsDown: 2,
    })

    // 2. Generate semantic typography
    const semantic = generateSemanticTypography({
      scale,
      primaryFont: "Inter, sans-serif",
    })

    // 3. Validate
    const validation = validateTypography(scale, semantic)
    expect(validation.valid).toBe(true)

    // 4. Generate CSS
    const css = generateTypographyCss(scale, semantic)
    expect(css.variables).toBeDefined()
    expect(css.classes).toBeDefined()
  })

  it("should support 3-level hierarchy clearly", () => {
    const system = createTypographySystem("modern")

    // Primary level (headings)
    const h1 = parseFloat(system.semantic.h1.fontSize)
    const h3 = parseFloat(system.semantic.h3.fontSize)

    // Secondary level (subheadings)
    const h4 = parseFloat(system.semantic.h4.fontSize)

    // Tertiary level (body)
    const body = parseFloat(system.semantic.body.fontSize)
    const caption = parseFloat(system.semantic.caption.fontSize)

    // Clear hierarchy
    expect(h1).toBeGreaterThan(h3)
    expect(h3).toBeGreaterThan(h4)
    expect(h4).toBeGreaterThan(body)
    expect(body).toBeGreaterThan(caption)
  })

  it("should work with fluid typography", () => {
    const fluidScale = generateFluidScale({
      baseSizePx: 16,
      ratio: "major-third",
    })

    const semantic = generateSemanticTypography({ scale: fluidScale })

    // All sizes should use clamp
    expect(semantic.h1.fontSize).toContain("clamp(")
    expect(semantic.body.fontSize).toContain("clamp(")
  })
})
