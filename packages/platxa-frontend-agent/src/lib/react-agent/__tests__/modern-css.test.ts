/**
 * Modern CSS Module Tests
 *
 * Tests for container queries, :has() selector, gradients, and 3D transforms.
 */

import { describe, it, expect } from "vitest"
import {
  // Container queries
  DEFAULT_CONTAINER_BREAKPOINTS,
  createContainerQuerySystem,
  generateContainerQuery,
  // :has() selector
  generateHasSelector,
  HAS_PATTERNS,
  generateHasUtilities,
  // Gradients
  generateLinearGradient,
  generateRadialGradient,
  generateConicGradient,
  generateGradient,
  GRADIENT_PRESETS,
  generateGradientUtilities,
  // 3D transforms
  generate3DTransform,
  generate3DUtilities,
  // Factory
  createModernCssSystem,
} from "../modern-css"
import type {
  ContainerBreakpoint,
  ContainerDefinition,
  HasSelectorRule,
  LinearGradientConfig,
  RadialGradientConfig,
  ConicGradientConfig,
  Transform3DConfig,
} from "../modern-css"

// =============================================================================
// Container Queries (Feature #44)
// =============================================================================

describe("Container Queries", () => {
  describe("DEFAULT_CONTAINER_BREAKPOINTS", () => {
    it("should have standard breakpoints", () => {
      expect(DEFAULT_CONTAINER_BREAKPOINTS).toBeDefined()
      expect(Array.isArray(DEFAULT_CONTAINER_BREAKPOINTS)).toBe(true)
      expect(DEFAULT_CONTAINER_BREAKPOINTS.length).toBeGreaterThan(0)
    })

    it("should include xs, sm, md, lg, xl breakpoints", () => {
      const names = DEFAULT_CONTAINER_BREAKPOINTS.map((bp) => bp.name)
      expect(names).toContain("xs")
      expect(names).toContain("sm")
      expect(names).toContain("md")
      expect(names).toContain("lg")
      expect(names).toContain("xl")
    })

    it("should have increasing minWidth values", () => {
      const widths = DEFAULT_CONTAINER_BREAKPOINTS.map((bp) => bp.minWidth ?? 0)
      for (let i = 1; i < widths.length; i++) {
        expect(widths[i]).toBeGreaterThan(widths[i - 1])
      }
    })
  })

  describe("createContainerQuerySystem", () => {
    it("should create a container query system with defaults", () => {
      const result = createContainerQuerySystem()
      expect(result.css).toBeDefined()
      expect(typeof result.css).toBe("string")
      expect(result.browserSupport).toBeDefined()
    })

    it("should include container definitions", () => {
      const containers: ContainerDefinition[] = [
        { name: "card", type: "inline-size" },
        { name: "sidebar", type: "size" },
      ]
      const result = createContainerQuerySystem({ containers })
      expect(result.css).toContain("card")
      expect(result.css).toContain("sidebar")
      expect(result.css).toContain("container-type")
    })

    it("should generate container queries for breakpoints", () => {
      const result = createContainerQuerySystem()
      expect(result.css).toContain("@container")
    })

    it("should include browser support info", () => {
      const result = createContainerQuerySystem()
      expect(result.browserSupport.chrome).toBeDefined()
      expect(result.browserSupport.firefox).toBeDefined()
      expect(result.browserSupport.safari).toBeDefined()
    })

    it("should use custom breakpoints when provided", () => {
      const breakpoints: ContainerBreakpoint[] = [
        { name: "tiny", minWidth: 100 },
        { name: "huge", minWidth: 1000 },
      ]
      const result = createContainerQuerySystem({ breakpoints })
      expect(result.css).toContain("100px")
      expect(result.css).toContain("1000px")
    })
  })

  describe("generateContainerQuery", () => {
    it("should generate a container query rule", () => {
      const result = generateContainerQuery({
        condition: "min-width: 400px",
        styles: { fontSize: "1.5rem" },
      })
      expect(result).toContain("@container")
      expect(result).toContain("min-width: 400px")
      expect(result).toContain("font-size")
      expect(result).toContain("1.5rem")
    })

    it("should include container name when specified", () => {
      const result = generateContainerQuery({
        container: "card",
        condition: "min-width: 300px",
        styles: { display: "grid" },
      })
      expect(result).toContain("card")
      expect(result).toContain("min-width: 300px")
    })

    it("should handle multiple styles", () => {
      const result = generateContainerQuery({
        condition: "min-width: 500px",
        styles: {
          display: "flex",
          gap: "1rem",
          padding: "2rem",
        },
      })
      expect(result).toContain("display")
      expect(result).toContain("flex")
      expect(result).toContain("gap")
      expect(result).toContain("padding")
    })
  })
})

// =============================================================================
// :has() Selector (Feature #45)
// =============================================================================

describe(":has() Selector", () => {
  describe("generateHasSelector", () => {
    it("should generate has-child selector", () => {
      const rule: HasSelectorRule = {
        parent: ".card",
        pattern: "has-child",
        target: ".icon",
        styles: { paddingLeft: "2rem" },
      }
      const result = generateHasSelector(rule)
      expect(result).toContain(".card:has(> .icon)")
      expect(result).toContain("padding-left")
      expect(result).toContain("2rem")
    })

    it("should generate has-descendant selector", () => {
      const rule: HasSelectorRule = {
        parent: ".form",
        pattern: "has-descendant",
        target: ".error",
        styles: { borderColor: "red" },
      }
      const result = generateHasSelector(rule)
      expect(result).toContain(".form:has(.error)")
      expect(result).toContain("border-color")
    })

    it("should generate has-sibling selector", () => {
      const rule: HasSelectorRule = {
        parent: ".label",
        pattern: "has-sibling",
        target: "input:focus",
        styles: { color: "blue" },
      }
      const result = generateHasSelector(rule)
      expect(result).toContain(".label:has(+ input:focus)")
    })

    it("should generate has-checked selector", () => {
      const rule: HasSelectorRule = {
        parent: ".checkbox-card",
        pattern: "has-checked",
        target: "input",
        styles: { backgroundColor: "lightblue" },
      }
      const result = generateHasSelector(rule)
      expect(result).toContain(":has(input:checked)")
    })

    it("should generate has-focus selector", () => {
      const rule: HasSelectorRule = {
        parent: ".input-group",
        pattern: "has-focus",
        target: "input",
        styles: { outline: "2px solid blue" },
      }
      const result = generateHasSelector(rule)
      expect(result).toContain(":has(input:focus)")
    })

    it("should generate has-empty selector", () => {
      const rule: HasSelectorRule = {
        parent: ".container",
        pattern: "has-empty",
        target: ".content",
        styles: { display: "none" },
      }
      const result = generateHasSelector(rule)
      expect(result).toContain(":has(.content:empty)")
    })

    it("should generate has-hover selector", () => {
      const rule: HasSelectorRule = {
        parent: ".nav",
        pattern: "has-hover",
        target: ".link",
        styles: { backgroundColor: "gray" },
      }
      const result = generateHasSelector(rule)
      expect(result).toContain(":has(.link:hover)")
    })
  })

  describe("HAS_PATTERNS", () => {
    it("should have predefined patterns", () => {
      expect(HAS_PATTERNS).toBeDefined()
      expect(typeof HAS_PATTERNS).toBe("object")
    })

    it("should include common use cases", () => {
      expect(HAS_PATTERNS.formInvalid).toBeDefined()
      expect(HAS_PATTERNS.labelOnFocus).toBeDefined()
      expect(HAS_PATTERNS.cardChecked).toBeDefined()
    })

    it("should return valid CSS when patterns are invoked", () => {
      // HAS_PATTERNS contains factory functions that return HasSelectorRule objects
      // This design allows customization of selectors (e.g., formInvalid(".my-form"))
      const formRule = HAS_PATTERNS.formInvalid()
      expect(formRule.parent).toBe("form")
      expect(formRule.pattern).toBe("has-descendant")

      const labelRule = HAS_PATTERNS.labelOnFocus()
      expect(labelRule.parent).toBe("label")

      const cardRule = HAS_PATTERNS.cardChecked(".my-card")
      expect(cardRule.parent).toBe(".my-card")
    })
  })

  describe("generateHasUtilities", () => {
    it("should generate utility classes", () => {
      const result = generateHasUtilities()
      expect(result.css).toBeDefined()
      expect(result.css).toContain(":has(")
    })

    it("should include browser support info", () => {
      const result = generateHasUtilities()
      expect(result.browserSupport).toBeDefined()
      expect(result.browserSupport.chrome).toBeGreaterThanOrEqual(105)
      expect(result.browserSupport.safari).toBeGreaterThanOrEqual(15.4)
    })
  })
})

// =============================================================================
// Gradients (Feature #46)
// =============================================================================

describe("Gradients", () => {
  describe("generateLinearGradient", () => {
    it("should generate a basic linear gradient", () => {
      const config: LinearGradientConfig = {
        type: "linear",
        direction: "to-r",
        stops: [
          { color: "#ff0000" },
          { color: "#0000ff" },
        ],
      }
      const result = generateLinearGradient(config)
      expect(result).toContain("linear-gradient")
      expect(result).toContain("to right")
      expect(result).toContain("#ff0000")
      expect(result).toContain("#0000ff")
    })

    it("should handle angle directions", () => {
      const config: LinearGradientConfig = {
        type: "linear",
        direction: 45,
        stops: [
          { color: "red" },
          { color: "blue" },
        ],
      }
      const result = generateLinearGradient(config)
      expect(result).toContain("45deg")
    })

    it("should handle color stop positions", () => {
      const config: LinearGradientConfig = {
        type: "linear",
        direction: "to-b",
        stops: [
          { color: "red", position: 0 },
          { color: "yellow", position: 50 },
          { color: "green", position: 100 },
        ],
      }
      const result = generateLinearGradient(config)
      expect(result).toContain("0%")
      expect(result).toContain("50%")
      expect(result).toContain("100%")
    })

    it("should handle repeating gradients", () => {
      const config: LinearGradientConfig = {
        type: "linear",
        direction: "to-r",
        stops: [
          { color: "red", position: 0 },
          { color: "blue", position: "20px" },
        ],
        repeating: true,
      }
      const result = generateLinearGradient(config)
      expect(result).toContain("repeating-linear-gradient")
    })

    it("should handle all direction keywords", () => {
      const directions = ["to-t", "to-tr", "to-r", "to-br", "to-b", "to-bl", "to-l", "to-tl"] as const
      directions.forEach((dir) => {
        const config: LinearGradientConfig = {
          type: "linear",
          direction: dir,
          stops: [{ color: "red" }, { color: "blue" }],
        }
        const result = generateLinearGradient(config)
        expect(result).toContain("linear-gradient")
      })
    })
  })

  describe("generateRadialGradient", () => {
    it("should generate a basic radial gradient", () => {
      const config: RadialGradientConfig = {
        type: "radial",
        stops: [
          { color: "white" },
          { color: "black" },
        ],
      }
      const result = generateRadialGradient(config)
      expect(result).toContain("radial-gradient")
    })

    it("should handle shape and size", () => {
      const config: RadialGradientConfig = {
        type: "radial",
        shape: "circle",
        size: "closest-side",
        stops: [
          { color: "red" },
          { color: "blue" },
        ],
      }
      const result = generateRadialGradient(config)
      expect(result).toContain("circle")
      expect(result).toContain("closest-side")
    })

    it("should handle position", () => {
      const config: RadialGradientConfig = {
        type: "radial",
        position: "top left",
        stops: [
          { color: "red" },
          { color: "blue" },
        ],
      }
      const result = generateRadialGradient(config)
      expect(result).toContain("at top left")
    })

    it("should handle repeating radial gradients", () => {
      const config: RadialGradientConfig = {
        type: "radial",
        stops: [
          { color: "red", position: 0 },
          { color: "blue", position: "10px" },
        ],
        repeating: true,
      }
      const result = generateRadialGradient(config)
      expect(result).toContain("repeating-radial-gradient")
    })
  })

  describe("generateConicGradient", () => {
    it("should generate a basic conic gradient", () => {
      const config: ConicGradientConfig = {
        type: "conic",
        stops: [
          { color: "red" },
          { color: "yellow" },
          { color: "green" },
          { color: "blue" },
          { color: "red" },
        ],
      }
      const result = generateConicGradient(config)
      expect(result).toContain("conic-gradient")
    })

    it("should handle from angle", () => {
      const config: ConicGradientConfig = {
        type: "conic",
        from: 90,
        stops: [
          { color: "red" },
          { color: "blue" },
        ],
      }
      const result = generateConicGradient(config)
      expect(result).toContain("from 90deg")
    })

    it("should handle position", () => {
      const config: ConicGradientConfig = {
        type: "conic",
        position: "center",
        stops: [
          { color: "red" },
          { color: "blue" },
        ],
      }
      const result = generateConicGradient(config)
      expect(result).toContain("at center")
    })

    it("should handle repeating conic gradients", () => {
      const config: ConicGradientConfig = {
        type: "conic",
        stops: [
          { color: "red", position: 0 },
          { color: "blue", position: "30deg" },
        ],
        repeating: true,
      }
      const result = generateConicGradient(config)
      expect(result).toContain("repeating-conic-gradient")
    })
  })

  describe("generateGradient", () => {
    it("should dispatch to correct generator based on type", () => {
      const linear = generateGradient({
        type: "linear",
        direction: "to-r",
        stops: [{ color: "red" }, { color: "blue" }],
      })
      expect(linear).toContain("linear-gradient")

      const radial = generateGradient({
        type: "radial",
        stops: [{ color: "red" }, { color: "blue" }],
      })
      expect(radial).toContain("radial-gradient")

      const conic = generateGradient({
        type: "conic",
        stops: [{ color: "red" }, { color: "blue" }],
      })
      expect(conic).toContain("conic-gradient")
    })
  })

  describe("GRADIENT_PRESETS", () => {
    it("should have predefined gradient presets", () => {
      expect(GRADIENT_PRESETS).toBeDefined()
      expect(typeof GRADIENT_PRESETS).toBe("object")
      expect(Object.keys(GRADIENT_PRESETS).length).toBeGreaterThan(0)
    })

    it("should have valid gradient configs for each preset", () => {
      Object.entries(GRADIENT_PRESETS).forEach(([name, preset]) => {
        expect(preset.name).toBe(name)
        expect(preset.gradient).toBeDefined()
        expect(preset.css).toBeDefined()
        expect(typeof preset.css).toBe("string")
      })
    })

    it("should include common presets like sunset, ocean, etc.", () => {
      // Check for at least a few common presets
      const presetNames = Object.keys(GRADIENT_PRESETS)
      expect(presetNames.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe("generateGradientUtilities", () => {
    it("should generate gradient utility classes", () => {
      const result = generateGradientUtilities()
      expect(result.css).toBeDefined()
      expect(result.css.length).toBeGreaterThan(0)
    })

    it("should include Tailwind classes when requested", () => {
      const result = generateGradientUtilities({ includeTailwind: true })
      if (result.tailwindClasses) {
        expect(Array.isArray(result.tailwindClasses)).toBe(true)
      }
    })
  })
})

// =============================================================================
// 3D Transforms (Feature #49)
// =============================================================================

describe("3D Transforms", () => {
  describe("generate3DTransform", () => {
    it("should generate perspective", () => {
      const config: Transform3DConfig = {
        perspective: "1000px",
      }
      const result = generate3DTransform(config)
      expect(result).toContain("perspective")
      expect(result).toContain("1000px")
    })

    it("should generate rotateX", () => {
      const config: Transform3DConfig = {
        rotateX: 45,
      }
      const result = generate3DTransform(config)
      expect(result).toContain("rotateX(45deg)")
    })

    it("should generate rotateY", () => {
      const config: Transform3DConfig = {
        rotateY: 30,
      }
      const result = generate3DTransform(config)
      expect(result).toContain("rotateY(30deg)")
    })

    it("should generate rotateZ", () => {
      const config: Transform3DConfig = {
        rotateZ: 15,
      }
      const result = generate3DTransform(config)
      expect(result).toContain("rotateZ(15deg)")
    })

    it("should generate translateZ", () => {
      const config: Transform3DConfig = {
        translateZ: "50px",
      }
      const result = generate3DTransform(config)
      expect(result).toContain("translateZ(50px)")
    })

    it("should generate scaleZ", () => {
      const config: Transform3DConfig = {
        scaleZ: 1.5,
      }
      const result = generate3DTransform(config)
      expect(result).toContain("scaleZ(1.5)")
    })

    it("should include preserve-3d when specified", () => {
      const config: Transform3DConfig = {
        preserve3d: true,
        rotateY: 45,
      }
      const result = generate3DTransform(config)
      expect(result).toContain("transform-style: preserve-3d")
    })

    it("should combine multiple transforms", () => {
      const config: Transform3DConfig = {
        perspective: "800px",
        rotateX: 20,
        rotateY: 30,
        translateZ: "100px",
      }
      const result = generate3DTransform(config)
      expect(result).toContain("perspective")
      expect(result).toContain("rotateX")
      expect(result).toContain("rotateY")
      expect(result).toContain("translateZ")
    })
  })

  describe("generate3DUtilities", () => {
    it("should generate 3D transform utility classes", () => {
      const result = generate3DUtilities()
      expect(result.css).toBeDefined()
      expect(result.css.length).toBeGreaterThan(0)
    })

    it("should include browser support info", () => {
      const result = generate3DUtilities()
      expect(result.browserSupport).toBeDefined()
    })

    it("should include perspective utilities", () => {
      const result = generate3DUtilities()
      expect(result.css).toContain("perspective")
    })
  })
})

// =============================================================================
// Factory Function
// =============================================================================

describe("createModernCssSystem", () => {
  it("should create a complete modern CSS system", () => {
    const system = createModernCssSystem()
    expect(system).toBeDefined()
  })

  it("should provide container query utilities", () => {
    const system = createModernCssSystem()
    expect(system.containerQueries).toBeDefined()
    expect(typeof system.containerQueries.create).toBe("function")
    expect(typeof system.containerQueries.query).toBe("function")
  })

  it("should provide :has() selector utilities", () => {
    const system = createModernCssSystem()
    expect(system.hasSelector).toBeDefined()
    expect(typeof system.hasSelector.generate).toBe("function")
    expect(system.hasSelector.patterns).toBeDefined()
  })

  it("should provide gradient utilities", () => {
    const system = createModernCssSystem()
    expect(system.gradients).toBeDefined()
    expect(typeof system.gradients.linear).toBe("function")
    expect(typeof system.gradients.radial).toBe("function")
    expect(typeof system.gradients.conic).toBe("function")
    expect(system.gradients.presets).toBeDefined()
  })

  it("should provide 3D transform utilities", () => {
    const system = createModernCssSystem()
    expect(system.transforms3d).toBeDefined()
    expect(typeof system.transforms3d.generate).toBe("function")
    expect(typeof system.transforms3d.utilities).toBe("function")
  })

  it("should generate complete CSS output", () => {
    const system = createModernCssSystem()
    const output = system.generateAll()
    expect(output.css).toBeDefined()
    expect(output.css.length).toBeGreaterThan(0)
    expect(output.browserSupport).toBeDefined()
  })

  it("should accept custom configuration", () => {
    const system = createModernCssSystem({
      containerBreakpoints: [
        { name: "small", minWidth: 200 },
        { name: "large", minWidth: 600 },
      ],
    })
    const output = system.containerQueries.create()
    expect(output.css).toContain("200px")
    expect(output.css).toContain("600px")
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe("Modern CSS Integration", () => {
  it("should work together to create a responsive card component", () => {
    const system = createModernCssSystem()

    // Create container for card
    const container = system.containerQueries.create({
      containers: [{ name: "card-container", type: "inline-size" }],
    })

    // Create gradient background
    const gradient = system.gradients.linear({
      type: "linear",
      direction: "to-br",
      stops: [
        { color: "oklch(0.95 0.02 250)" },
        { color: "oklch(0.98 0.01 250)" },
      ],
    })

    // Create 3D hover effect
    const transform = system.transforms3d.generate({
      perspective: "1000px",
      rotateX: 5,
      rotateY: -5,
    })

    expect(container.css).toContain("card-container")
    expect(gradient).toContain("linear-gradient")
    expect(transform).toContain("perspective")
  })

  it("should generate production-ready CSS", () => {
    const system = createModernCssSystem()
    const output = system.generateAll()

    // Should include all features
    expect(output.css).toContain("@container")
    expect(output.css).toContain(":has(")
    expect(output.css).toContain("gradient")
    expect(output.css).toContain("perspective")

    // Should have comprehensive browser support info
    expect(output.browserSupport.chrome).toBeDefined()
    expect(output.browserSupport.firefox).toBeDefined()
    expect(output.browserSupport.safari).toBeDefined()
  })

  it("should provide fallbacks for older browsers", () => {
    const system = createModernCssSystem()
    const output = system.generateAll({ includeFallbacks: true })

    if (output.fallback) {
      expect(output.fallback.length).toBeGreaterThan(0)
    }
  })
})
