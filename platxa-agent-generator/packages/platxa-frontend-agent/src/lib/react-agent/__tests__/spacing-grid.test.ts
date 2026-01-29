/**
 * Spacing Grid Tests
 *
 * Tests for 8px/4px spacing grid system.
 */

import { describe, it, expect } from "vitest"
import {
  // Constants
  DEFAULT_GRID_CONFIG,
  SPACING_MULTIPLIERS,
  DEFAULT_SEMANTIC_MAPPING,
  // Core functions
  createSpacingValue,
  spacing,
  pxToUnits,
  unitsToPx,
  isOnGrid,
  snapToGrid,
  floorToGrid,
  ceilToGrid,
  // Scale generation
  generateSpacingScale,
  generateSemanticSpacing,
  generateComponentSpacing,
  generateLayoutSpacing,
  // Validation
  validateSpacing,
  validateSpacingValues,
  allOnGrid,
  // Box spacing
  boxSpacing,
  boxSpacingXY,
  boxSpacingTRBL,
  formatBoxSpacing,
  // CSS generation
  generateSpacingCss,
  // Presets
  PRESET_4PX,
  PRESET_8PX,
  PRESET_COMPACT,
  SPACING_PRESETS,
  // Factory
  createSpacingSystem,
} from "../spacing-grid"

// =============================================================================
// Constants Tests
// =============================================================================

describe("Spacing Grid Constants", () => {
  describe("DEFAULT_GRID_CONFIG", () => {
    it("has correct default values", () => {
      expect(DEFAULT_GRID_CONFIG.baseUnit).toBe(4)
      expect(DEFAULT_GRID_CONFIG.rootFontSize).toBe(16)
      expect(DEFAULT_GRID_CONFIG.outputUnit).toBe("rem")
      expect(DEFAULT_GRID_CONFIG.includeHalfSteps).toBe(true)
    })
  })

  describe("SPACING_MULTIPLIERS", () => {
    it("includes all Tailwind spacing values", () => {
      expect(SPACING_MULTIPLIERS).toContain(0)
      expect(SPACING_MULTIPLIERS).toContain(0.5)
      expect(SPACING_MULTIPLIERS).toContain(1)
      expect(SPACING_MULTIPLIERS).toContain(4)
      expect(SPACING_MULTIPLIERS).toContain(96)
    })

    it("is sorted in ascending order", () => {
      for (let i = 1; i < SPACING_MULTIPLIERS.length; i++) {
        expect(SPACING_MULTIPLIERS[i]).toBeGreaterThan(SPACING_MULTIPLIERS[i - 1])
      }
    })
  })

  describe("DEFAULT_SEMANTIC_MAPPING", () => {
    it("has all semantic sizes", () => {
      expect(DEFAULT_SEMANTIC_MAPPING.none).toBe(0)
      expect(DEFAULT_SEMANTIC_MAPPING["2xs"]).toBe(1) // 4px
      expect(DEFAULT_SEMANTIC_MAPPING.xs).toBe(2) // 8px
      expect(DEFAULT_SEMANTIC_MAPPING.sm).toBe(3) // 12px
      expect(DEFAULT_SEMANTIC_MAPPING.md).toBe(4) // 16px
      expect(DEFAULT_SEMANTIC_MAPPING.lg).toBe(6) // 24px
      expect(DEFAULT_SEMANTIC_MAPPING.xl).toBe(8) // 32px
      expect(DEFAULT_SEMANTIC_MAPPING["2xl"]).toBe(12) // 48px
      expect(DEFAULT_SEMANTIC_MAPPING["3xl"]).toBe(16) // 64px
      expect(DEFAULT_SEMANTIC_MAPPING["4xl"]).toBe(24) // 96px
    })
  })
})

// =============================================================================
// Core Functions Tests
// =============================================================================

describe("Core Spacing Functions", () => {
  describe("createSpacingValue", () => {
    it("creates value from pixels with default config", () => {
      const value = createSpacingValue(16)
      expect(value.px).toBe(16)
      expect(value.value).toBe(4) // 16px / 4 base unit
      expect(value.rem).toBe("1rem")
      expect(value.css).toBe("1rem")
    })

    it("handles zero", () => {
      const value = createSpacingValue(0)
      expect(value.px).toBe(0)
      expect(value.value).toBe(0)
      expect(value.rem).toBe("0")
      expect(value.css).toBe("0")
    })

    it("formats rem without trailing zeros", () => {
      const value = createSpacingValue(8)
      expect(value.rem).toBe("0.5rem")
    })

    it("uses px output unit when configured", () => {
      const config = { ...DEFAULT_GRID_CONFIG, outputUnit: "px" as const }
      const value = createSpacingValue(16, config)
      expect(value.css).toBe("16px")
    })

    it("uses em output unit when configured", () => {
      const config = { ...DEFAULT_GRID_CONFIG, outputUnit: "em" as const }
      const value = createSpacingValue(16, config)
      expect(value.css).toBe("1em")
    })
  })

  describe("spacing", () => {
    it("calculates spacing from multiplier", () => {
      const value = spacing(4)
      expect(value.px).toBe(16) // 4 * 4px base
      expect(value.rem).toBe("1rem")
    })

    it("handles half-step multipliers", () => {
      const value = spacing(0.5)
      expect(value.px).toBe(2) // 0.5 * 4px
    })

    it("handles large multipliers", () => {
      const value = spacing(96)
      expect(value.px).toBe(384) // 96 * 4px
      expect(value.rem).toBe("24rem")
    })

    it("uses 8px base unit when configured", () => {
      const config = { ...DEFAULT_GRID_CONFIG, baseUnit: 8 as const }
      const value = spacing(4, config)
      expect(value.px).toBe(32) // 4 * 8px
    })
  })

  describe("pxToUnits", () => {
    it("converts pixels to grid units with 4px base", () => {
      expect(pxToUnits(16, 4)).toBe(4)
      expect(pxToUnits(8, 4)).toBe(2)
      expect(pxToUnits(4, 4)).toBe(1)
    })

    it("converts pixels to grid units with 8px base", () => {
      expect(pxToUnits(16, 8)).toBe(2)
      expect(pxToUnits(24, 8)).toBe(3)
    })

    it("handles fractional results", () => {
      expect(pxToUnits(6, 4)).toBe(1.5)
    })
  })

  describe("unitsToPx", () => {
    it("converts grid units to pixels with 4px base", () => {
      expect(unitsToPx(4, 4)).toBe(16)
      expect(unitsToPx(2, 4)).toBe(8)
      expect(unitsToPx(1, 4)).toBe(4)
    })

    it("converts grid units to pixels with 8px base", () => {
      expect(unitsToPx(2, 8)).toBe(16)
      expect(unitsToPx(3, 8)).toBe(24)
    })
  })

  describe("isOnGrid", () => {
    it("returns true for values on 4px grid", () => {
      expect(isOnGrid(0, 4)).toBe(true)
      expect(isOnGrid(4, 4)).toBe(true)
      expect(isOnGrid(8, 4)).toBe(true)
      expect(isOnGrid(16, 4)).toBe(true)
    })

    it("returns false for values off 4px grid", () => {
      expect(isOnGrid(1, 4)).toBe(false)
      expect(isOnGrid(3, 4)).toBe(false)
      expect(isOnGrid(5, 4)).toBe(false)
      expect(isOnGrid(7, 4)).toBe(false)
    })

    it("returns true for values on 8px grid", () => {
      expect(isOnGrid(0, 8)).toBe(true)
      expect(isOnGrid(8, 8)).toBe(true)
      expect(isOnGrid(16, 8)).toBe(true)
      expect(isOnGrid(24, 8)).toBe(true)
    })

    it("returns false for values off 8px grid", () => {
      expect(isOnGrid(4, 8)).toBe(false)
      expect(isOnGrid(12, 8)).toBe(false)
    })
  })

  describe("snapToGrid", () => {
    it("snaps to nearest grid point", () => {
      expect(snapToGrid(5, 4)).toBe(4) // 5 rounds down to 4
      expect(snapToGrid(6, 4)).toBe(8) // 6 rounds up to 8
      expect(snapToGrid(7, 4)).toBe(8)
      expect(snapToGrid(3, 4)).toBe(4)
    })

    it("returns same value when on grid", () => {
      expect(snapToGrid(4, 4)).toBe(4)
      expect(snapToGrid(8, 4)).toBe(8)
    })
  })

  describe("floorToGrid", () => {
    it("floors to nearest grid point", () => {
      expect(floorToGrid(5, 4)).toBe(4)
      expect(floorToGrid(6, 4)).toBe(4)
      expect(floorToGrid(7, 4)).toBe(4)
      expect(floorToGrid(9, 4)).toBe(8)
    })
  })

  describe("ceilToGrid", () => {
    it("ceils to nearest grid point", () => {
      expect(ceilToGrid(1, 4)).toBe(4)
      expect(ceilToGrid(5, 4)).toBe(8)
      expect(ceilToGrid(6, 4)).toBe(8)
      expect(ceilToGrid(9, 4)).toBe(12)
    })
  })
})

// =============================================================================
// Scale Generation Tests
// =============================================================================

describe("Scale Generation", () => {
  describe("generateSpacingScale", () => {
    it("generates complete spacing scale", () => {
      const scale = generateSpacingScale()

      // Check specific values
      expect(scale[0].px).toBe(0)
      expect(scale[1].px).toBe(4)
      expect(scale[2].px).toBe(8)
      expect(scale[4].px).toBe(16)
      expect(scale[8].px).toBe(32)
      expect(scale[96].px).toBe(384)
    })

    it("includes 1px value", () => {
      const scale = generateSpacingScale()
      expect(scale.px.px).toBe(1)
      // px is special case - always outputs "1px" regardless of config (for borders, fine details)
      expect(scale.px.css).toBe("1px")
      expect(scale.px.rem).toBe("0.0625rem")
    })

    it("includes half-step values", () => {
      const scale = generateSpacingScale()
      expect(scale[0.5].px).toBe(2)
      expect(scale[1.5].px).toBe(6)
      expect(scale[2.5].px).toBe(10)
    })

    it("uses config for output unit", () => {
      const config = { ...DEFAULT_GRID_CONFIG, outputUnit: "px" as const }
      const scale = generateSpacingScale(config)
      expect(scale[4].css).toBe("16px")
    })
  })

  describe("generateSemanticSpacing", () => {
    it("generates semantic spacing tokens", () => {
      const semantic = generateSemanticSpacing()

      expect(semantic.none.px).toBe(0)
      expect(semantic["2xs"].px).toBe(4)
      expect(semantic.xs.px).toBe(8)
      expect(semantic.sm.px).toBe(12)
      expect(semantic.md.px).toBe(16)
      expect(semantic.lg.px).toBe(24)
      expect(semantic.xl.px).toBe(32)
      expect(semantic["2xl"].px).toBe(48)
      expect(semantic["3xl"].px).toBe(64)
      expect(semantic["4xl"].px).toBe(96)
    })

    it("uses custom mapping", () => {
      const customMapping = {
        none: 0,
        "2xs": 0.5,
        xs: 1,
        sm: 2,
        md: 3,
        lg: 4,
        xl: 6,
        "2xl": 8,
        "3xl": 12,
        "4xl": 16,
      }
      const semantic = generateSemanticSpacing(DEFAULT_GRID_CONFIG, customMapping)
      expect(semantic.xs.px).toBe(4) // 1 * 4px
      expect(semantic.sm.px).toBe(8) // 2 * 4px
    })
  })

  describe("generateComponentSpacing", () => {
    it("generates component spacing configuration", () => {
      const componentSpacing = generateComponentSpacing(4, 2, 2, 0)

      expect(componentSpacing.paddingInline.px).toBe(16) // 4 * 4px
      expect(componentSpacing.paddingBlock.px).toBe(8) // 2 * 4px
      expect(componentSpacing.gap.px).toBe(8) // 2 * 4px
      expect(componentSpacing.margin.px).toBe(0)
    })

    it("uses custom config", () => {
      const config = { ...DEFAULT_GRID_CONFIG, baseUnit: 8 as const }
      const componentSpacing = generateComponentSpacing(2, 1, 1, 0, config)

      expect(componentSpacing.paddingInline.px).toBe(16) // 2 * 8px
      expect(componentSpacing.paddingBlock.px).toBe(8) // 1 * 8px
    })
  })

  describe("generateLayoutSpacing", () => {
    it("generates layout spacing with defaults", () => {
      const layout = generateLayoutSpacing()

      expect(layout.pageMargin.px).toBe(16) // 4 * 4px
      expect(layout.sectionGap.px).toBe(64) // 16 * 4px
      expect(layout.headerHeight.px).toBe(64) // 16 * 4px
      expect(layout.footerHeight.px).toBe(48) // 12 * 4px
      expect(layout.contentMaxWidth).toBe("80rem")
      expect(layout.sidebarWidth).toBe("16rem")
    })

    it("uses custom options", () => {
      const layout = generateLayoutSpacing({
        pageMargin: 8,
        sectionGap: 24,
        contentMaxWidth: "100rem",
      })

      expect(layout.pageMargin.px).toBe(32) // 8 * 4px
      expect(layout.sectionGap.px).toBe(96) // 24 * 4px
      expect(layout.contentMaxWidth).toBe("100rem")
    })
  })
})

// =============================================================================
// Validation Tests
// =============================================================================

describe("Spacing Validation", () => {
  describe("validateSpacing", () => {
    it("validates value on grid", () => {
      const result = validateSpacing(16)

      expect(result.value).toBe(16)
      expect(result.isOnGrid).toBe(true)
      expect(result.nearestGridValue).toBe(16)
      expect(result.deviation).toBe(0)
      expect(result.suggestion).toBeUndefined()
    })

    it("validates value off grid", () => {
      const result = validateSpacing(15)

      expect(result.value).toBe(15)
      expect(result.isOnGrid).toBe(false)
      expect(result.nearestGridValue).toBe(16)
      expect(result.deviation).toBe(1)
      expect(result.suggestion).toContain("15px is not on the 4px grid")
      expect(result.suggestion).toContain("16px")
    })

    it("validates with 8px base unit", () => {
      const config = { ...DEFAULT_GRID_CONFIG, baseUnit: 8 as const }
      const result = validateSpacing(12, config)

      expect(result.isOnGrid).toBe(false)
      // 12px rounds to 16 on 8px grid: Math.round(12/8)*8 = Math.round(1.5)*8 = 2*8 = 16
      expect(result.nearestGridValue).toBe(16)
    })
  })

  describe("validateSpacingValues", () => {
    it("validates multiple values", () => {
      const results = validateSpacingValues([4, 7, 12, 15])

      expect(results).toHaveLength(4)
      expect(results[0].isOnGrid).toBe(true) // 4
      expect(results[1].isOnGrid).toBe(false) // 7
      expect(results[2].isOnGrid).toBe(true) // 12
      expect(results[3].isOnGrid).toBe(false) // 15
    })
  })

  describe("allOnGrid", () => {
    it("returns true when all values on grid", () => {
      expect(allOnGrid([0, 4, 8, 12, 16])).toBe(true)
    })

    it("returns false when any value off grid", () => {
      expect(allOnGrid([0, 4, 7, 12])).toBe(false)
    })

    it("returns true for empty array", () => {
      expect(allOnGrid([])).toBe(true)
    })
  })
})

// =============================================================================
// Box Spacing Tests
// =============================================================================

describe("Box Spacing Utilities", () => {
  describe("boxSpacing", () => {
    it("creates uniform box spacing", () => {
      const box = boxSpacing(4)

      expect(box.top.px).toBe(16)
      expect(box.right.px).toBe(16)
      expect(box.bottom.px).toBe(16)
      expect(box.left.px).toBe(16)
    })
  })

  describe("boxSpacingXY", () => {
    it("creates vertical/horizontal box spacing", () => {
      const box = boxSpacingXY(2, 4)

      expect(box.top.px).toBe(8) // vertical
      expect(box.bottom.px).toBe(8) // vertical
      expect(box.right.px).toBe(16) // horizontal
      expect(box.left.px).toBe(16) // horizontal
    })
  })

  describe("boxSpacingTRBL", () => {
    it("creates box spacing with all four values", () => {
      const box = boxSpacingTRBL(1, 2, 3, 4)

      expect(box.top.px).toBe(4) // 1 * 4px
      expect(box.right.px).toBe(8) // 2 * 4px
      expect(box.bottom.px).toBe(12) // 3 * 4px
      expect(box.left.px).toBe(16) // 4 * 4px
    })
  })

  describe("formatBoxSpacing", () => {
    it("formats uniform spacing as single value", () => {
      const box = boxSpacing(4)
      expect(formatBoxSpacing(box)).toBe("1rem")
    })

    it("formats vertical/horizontal as two values", () => {
      const box = boxSpacingXY(2, 4)
      expect(formatBoxSpacing(box)).toBe("0.5rem 1rem")
    })

    it("formats three values when left equals right", () => {
      const box = boxSpacingTRBL(1, 2, 3, 2)
      expect(formatBoxSpacing(box)).toBe("0.25rem 0.5rem 0.75rem")
    })

    it("formats all four values when all different", () => {
      const box = boxSpacingTRBL(1, 2, 3, 4)
      expect(formatBoxSpacing(box)).toBe("0.25rem 0.5rem 0.75rem 1rem")
    })
  })
})

// =============================================================================
// CSS Generation Tests
// =============================================================================

describe("CSS Generation", () => {
  describe("generateSpacingCss", () => {
    it("generates CSS custom properties", () => {
      const css = generateSpacingCss()

      expect(css.variables).toContain(":root {")
      expect(css.variables).toContain("--spacing-0: 0;")
      expect(css.variables).toContain("--spacing-1: 0.25rem;")
      expect(css.variables).toContain("--spacing-4: 1rem;")
      expect(css.variables).toContain("--spacing-px: 1px;")
    })

    it("generates semantic spacing variables", () => {
      const css = generateSpacingCss()

      expect(css.variables).toContain("--space-none: 0;")
      expect(css.variables).toContain("--space-xs:")
      expect(css.variables).toContain("--space-md:")
      expect(css.variables).toContain("--space-xl:")
    })

    it("generates utility classes", () => {
      const css = generateSpacingCss()

      // Margin classes
      expect(css.classes).toContain(".m-0 { margin: 0; }")
      expect(css.classes).toContain(".m-4 { margin: 1rem; }")
      expect(css.classes).toContain(".mt-4 { margin-top: 1rem; }")
      expect(css.classes).toContain(".mx-4 { margin-left: 1rem; margin-right: 1rem; }")

      // Padding classes
      expect(css.classes).toContain(".p-0 { padding: 0; }")
      expect(css.classes).toContain(".p-4 { padding: 1rem; }")
      expect(css.classes).toContain(".py-4 { padding-top: 1rem; padding-bottom: 1rem; }")

      // Gap classes
      expect(css.classes).toContain(".gap-4 { gap: 1rem; }")
    })

    it("generates Tailwind config", () => {
      const css = generateSpacingCss()

      expect(css.tailwindConfig).toHaveProperty("theme")
      expect(css.tailwindConfig.theme).toHaveProperty("spacing")

      const spacing = (css.tailwindConfig.theme as { spacing: Record<string, string> }).spacing
      expect(spacing["0"]).toBe("0")
      expect(spacing["1"]).toBe("0.25rem")
      expect(spacing["4"]).toBe("1rem")
      expect(spacing.px).toBe("1px")
    })

    it("uses config for output", () => {
      const config = { ...DEFAULT_GRID_CONFIG, outputUnit: "px" as const }
      const css = generateSpacingCss(config)

      expect(css.variables).toContain("--spacing-4: 16px;")
    })
  })
})

// =============================================================================
// Presets Tests
// =============================================================================

describe("Spacing Presets", () => {
  describe("PRESET_4PX", () => {
    it("has correct configuration", () => {
      expect(PRESET_4PX.name).toBe("4px-grid")
      expect(PRESET_4PX.config.baseUnit).toBe(4)
      expect(PRESET_4PX.semanticMapping).toEqual(DEFAULT_SEMANTIC_MAPPING)
    })
  })

  describe("PRESET_8PX", () => {
    it("has correct configuration", () => {
      expect(PRESET_8PX.name).toBe("8px-grid")
      expect(PRESET_8PX.config.baseUnit).toBe(8)
      expect(PRESET_8PX.semanticMapping.xs).toBe(1) // 8px
      expect(PRESET_8PX.semanticMapping.md).toBe(2) // 16px
    })
  })

  describe("PRESET_COMPACT", () => {
    it("has tighter spacing values", () => {
      expect(PRESET_COMPACT.name).toBe("compact")
      expect(PRESET_COMPACT.semanticMapping.md).toBe(3) // 12px instead of 16px
      expect(PRESET_COMPACT.semanticMapping.lg).toBe(4) // 16px instead of 24px
    })
  })

  describe("SPACING_PRESETS", () => {
    it("contains all presets", () => {
      expect(SPACING_PRESETS["4px-grid"]).toBe(PRESET_4PX)
      expect(SPACING_PRESETS["8px-grid"]).toBe(PRESET_8PX)
      expect(SPACING_PRESETS.compact).toBe(PRESET_COMPACT)
    })
  })
})

// =============================================================================
// Factory Tests
// =============================================================================

describe("createSpacingSystem", () => {
  it("creates system with default config", () => {
    const system = createSpacingSystem()

    expect(system.config).toEqual(DEFAULT_GRID_CONFIG)
    expect(system.scale[4].px).toBe(16)
    expect(system.semantic.md.px).toBe(16)
  })

  it("creates system from preset name", () => {
    const system = createSpacingSystem("8px-grid")

    expect(system.config.baseUnit).toBe(8)
    expect(system.scale[4].px).toBe(32) // 4 * 8px
  })

  it("creates system from preset object", () => {
    const system = createSpacingSystem(PRESET_COMPACT)

    expect(system.semantic.md.px).toBe(12) // compact mapping
  })

  it("creates system from custom config", () => {
    const customConfig = {
      baseUnit: 8 as const,
      rootFontSize: 16,
      outputUnit: "px" as const,
      includeHalfSteps: true,
    }
    const system = createSpacingSystem(customConfig)

    expect(system.config).toEqual(customConfig)
    expect(system.scale[4].css).toBe("32px")
  })

  it("provides spacing function", () => {
    const system = createSpacingSystem()
    const value = system.spacing(4)

    expect(value.px).toBe(16)
  })

  it("provides validate function", () => {
    const system = createSpacingSystem()
    const result = system.validate(15)

    expect(result.isOnGrid).toBe(false)
    expect(result.nearestGridValue).toBe(16)
  })

  it("throws error for unknown preset", () => {
    expect(() => createSpacingSystem("unknown-preset")).toThrow("Unknown preset: unknown-preset")
  })

  it("generates correct CSS output", () => {
    const system = createSpacingSystem()

    expect(system.css.variables).toContain("--spacing-")
    expect(system.css.classes).toContain(".p-4")
    expect(system.css.tailwindConfig).toHaveProperty("theme")
  })
})

// =============================================================================
// Edge Cases and Root Cause Tests
// =============================================================================

describe("Edge Cases", () => {
  describe("negative values", () => {
    it("handles negative multipliers", () => {
      // Negative values might be used for negative margins
      const value = spacing(-2)
      expect(value.px).toBe(-8)
    })
  })

  describe("large values", () => {
    it("handles very large multipliers", () => {
      const value = spacing(1000)
      expect(value.px).toBe(4000)
      expect(value.rem).toBe("250rem")
    })
  })

  describe("decimal precision", () => {
    it("handles floating point precision", () => {
      // 0.5 * 4 = 2px = 0.125rem
      const value = spacing(0.5)
      expect(value.rem).toBe("0.125rem")
    })

    it("strips trailing zeros consistently", () => {
      const value1 = spacing(4) // 16px = 1rem
      const value2 = spacing(8) // 32px = 2rem

      expect(value1.rem).toBe("1rem")
      expect(value2.rem).toBe("2rem")
    })
  })

  describe("root cause: grid validation with different base units", () => {
    it("correctly validates 4px values against 8px grid", () => {
      const config = { ...DEFAULT_GRID_CONFIG, baseUnit: 8 as const }

      // 4px is NOT on 8px grid
      expect(validateSpacing(4, config).isOnGrid).toBe(false)
      // 8px IS on 8px grid
      expect(validateSpacing(8, config).isOnGrid).toBe(true)
      // 16px IS on 8px grid
      expect(validateSpacing(16, config).isOnGrid).toBe(true)
    })
  })

  describe("root cause: CSS escaping for decimal class names", () => {
    it("escapes dots in class names for half-step values", () => {
      const css = generateSpacingCss()

      // Should escape the dot in 0.5
      expect(css.classes).toContain(".p-0\\.5")
      expect(css.classes).toContain(".m-1\\.5")
    })

    it("escapes dots in CSS variable names", () => {
      const css = generateSpacingCss()

      // Should escape the dot in variable names
      expect(css.variables).toContain("--spacing-0\\.5:")
    })
  })

  describe("root cause: rem calculation precision", () => {
    it("calculates rem correctly for various px values", () => {
      // 1px = 0.0625rem
      const v1 = createSpacingValue(1)
      expect(v1.rem).toBe("0.0625rem")

      // 2px = 0.125rem
      const v2 = createSpacingValue(2)
      expect(v2.rem).toBe("0.125rem")

      // 6px = 0.375rem
      const v6 = createSpacingValue(6)
      expect(v6.rem).toBe("0.375rem")
    })

    it("uses custom root font size for rem calculation", () => {
      const config = { ...DEFAULT_GRID_CONFIG, rootFontSize: 10 }
      const value = createSpacingValue(10, config)

      // 10px / 10 = 1rem
      expect(value.rem).toBe("1rem")
    })
  })
})
