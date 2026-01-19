/**
 * Animation Worker - Tests
 *
 * Tests the animation system:
 * - Preset resolution
 * - Animation composition
 * - Code generation
 * - Reduced motion support
 */

import { describe, it, expect } from "vitest"
import {
  // Worker functions
  resolvePreset,
  getHoverForPreset,
  getTapForPreset,
  composeAnimations,
  generateAnimationCode,
  generateAnimatedComponent,
  getAnimationForComponent,
  withReducedMotion,
  // Spring presets
  springSnappy,
  springGentle,
  springBouncy,
  // Hover presets
  hoverScale,
  hoverLift,
  hoverGlow,
  // Tap presets
  tapScale,
  tapPress,
  // Presence presets
  presenceFade,
  presenceScale,
  presenceSlide,
  presenceBounce,
  // Variant presets
  pulseVariants,
  shakeVariants,
  listItemVariants,
  // Stagger presets
  staggerDefault,
  staggerFast,
  // Component presets
  buttonPrimary,
  cardInteractive,
  modalContent,
  toastFromTop,
  // Reduced motion
  reducedMotionFade,
  getReducedMotionAlternative,
  // Types
  type AnimationPreset,
  type ComponentAnimation,
} from "../animations"

// ============================================================================
// Spring Configuration Tests
// ============================================================================

describe("Spring Configurations", () => {
  it("should have snappy spring with high stiffness", () => {
    expect(springSnappy.stiffness).toBe(400)
    expect(springSnappy.damping).toBe(30)
  })

  it("should have gentle spring for smooth transitions", () => {
    expect(springGentle.stiffness).toBe(120)
    expect(springGentle.damping).toBe(14)
  })

  it("should have bouncy spring for playful effects", () => {
    expect(springBouncy.stiffness).toBe(300)
    expect(springBouncy.damping).toBe(10)
  })
})

// ============================================================================
// Hover Animation Tests
// ============================================================================

describe("Hover Animations", () => {
  it("should have scale hover effect", () => {
    expect(hoverScale.whileHover.scale).toBe(1.02)
  })

  it("should have lift hover with shadow", () => {
    expect(hoverLift.whileHover.y).toBe(-4)
    expect(hoverLift.whileHover.boxShadow).toContain("rgba")
  })

  it("should have glow hover effect", () => {
    expect(hoverGlow.whileHover.boxShadow).toContain("rgba")
  })
})

// ============================================================================
// Tap Animation Tests
// ============================================================================

describe("Tap Animations", () => {
  it("should have scale tap effect", () => {
    expect(tapScale.whileTap.scale).toBe(0.95)
  })

  it("should have press tap with scale and translate", () => {
    expect(tapPress.whileTap.scale).toBe(0.97)
    expect(tapPress.whileTap.y).toBe(1)
  })
})

// ============================================================================
// Presence Animation Tests
// ============================================================================

describe("Presence Animations", () => {
  describe("presenceFade", () => {
    it("should fade from 0 to 1 opacity", () => {
      expect(presenceFade.initial.opacity).toBe(0)
      expect(presenceFade.animate.opacity).toBe(1)
      expect(presenceFade.exit.opacity).toBe(0)
    })
  })

  describe("presenceScale", () => {
    it("should scale and fade in", () => {
      expect(presenceScale.initial.opacity).toBe(0)
      expect(presenceScale.initial.scale).toBe(0.9)
      expect(presenceScale.animate.scale).toBe(1)
    })
  })

  describe("presenceSlide", () => {
    it("should slide from up by default", () => {
      const slide = presenceSlide()
      expect(slide.initial.y).toBe(20)
      expect(slide.animate.y).toBe(0)
    })

    it("should slide from down with negative offset", () => {
      const slide = presenceSlide("down", 30)
      expect(slide.initial.y).toBe(-30)
    })

    it("should slide from left", () => {
      const slide = presenceSlide("left", 40)
      expect(slide.initial.x).toBe(40)
    })

    it("should slide from right with negative offset", () => {
      const slide = presenceSlide("right", 50)
      expect(slide.initial.x).toBe(-50)
    })
  })

  describe("presenceBounce", () => {
    it("should start small and bounce in", () => {
      expect(presenceBounce.initial.scale).toBe(0.3)
      expect(presenceBounce.animate.scale).toBe(1)
      expect(presenceBounce.transition).toEqual(springBouncy)
    })
  })
})

// ============================================================================
// Variant Animation Tests
// ============================================================================

describe("Variant Animations", () => {
  it("should have pulse variants with scale keyframes", () => {
    expect(pulseVariants.idle.scale).toBe(1)
    expect(pulseVariants.pulse.scale).toEqual([1, 1.05, 1])
  })

  it("should have shake variants with x keyframes", () => {
    expect(shakeVariants.idle.x).toBe(0)
    expect(shakeVariants.shake.x).toEqual([-10, 10, -10, 10, 0])
  })

  it("should have list item variants for stagger", () => {
    expect(listItemVariants.hidden.opacity).toBe(0)
    expect(listItemVariants.hidden.y).toBe(20)
    expect(listItemVariants.visible.opacity).toBe(1)
  })
})

// ============================================================================
// Stagger Configuration Tests
// ============================================================================

describe("Stagger Configurations", () => {
  it("should have default stagger timing", () => {
    expect(staggerDefault.staggerChildren).toBe(0.05)
    expect(staggerDefault.delayChildren).toBe(0.1)
  })

  it("should have fast stagger for quick lists", () => {
    expect(staggerFast.staggerChildren).toBe(0.03)
    expect(staggerFast.delayChildren).toBe(0.05)
  })
})

// ============================================================================
// Component Preset Tests
// ============================================================================

describe("Component Presets", () => {
  describe("Button presets", () => {
    it("should have hover and tap for primary button", () => {
      expect(buttonPrimary.hover).toEqual(hoverScale)
      expect(buttonPrimary.tap).toEqual(tapPress)
    })
  })

  describe("Card presets", () => {
    it("should have lift hover for interactive card", () => {
      expect(cardInteractive.hover).toEqual(hoverLift)
    })
  })

  describe("Modal presets", () => {
    it("should have scale and translate animation", () => {
      expect(modalContent.initial.scale).toBe(0.95)
      expect(modalContent.initial.y).toBe(20)
      expect(modalContent.animate.scale).toBe(1)
    })
  })

  describe("Toast presets", () => {
    it("should slide from top", () => {
      expect(toastFromTop.initial.y).toBe(-50)
      expect(toastFromTop.animate.y).toBe(0)
    })
  })
})

// ============================================================================
// Preset Resolution Tests
// ============================================================================

describe("resolvePreset", () => {
  it("should resolve fadeIn preset", () => {
    const preset: AnimationPreset = { type: "fadeIn" }
    const result = resolvePreset(preset)
    expect(result).toEqual(presenceFade)
  })

  it("should resolve slideIn with direction", () => {
    const preset: AnimationPreset = { type: "slideIn", direction: "left", distance: 30 }
    const result = resolvePreset(preset)
    expect(result.initial.x).toBe(30)
  })

  it("should resolve scaleIn preset", () => {
    const preset: AnimationPreset = { type: "scaleIn" }
    const result = resolvePreset(preset)
    expect(result).toEqual(presenceScale)
  })

  it("should resolve bounceIn preset", () => {
    const preset: AnimationPreset = { type: "bounceIn" }
    const result = resolvePreset(preset)
    expect(result).toEqual(presenceBounce)
  })

  it("should resolve pulse preset with keyframes", () => {
    const preset: AnimationPreset = { type: "pulse" }
    const result = resolvePreset(preset)
    expect(result.animate.scale).toEqual([1, 1.05, 1])
  })

  it("should resolve shake preset with keyframes", () => {
    const preset: AnimationPreset = { type: "shake" }
    const result = resolvePreset(preset)
    expect(result.animate.x).toEqual([-10, 10, -10, 10, 0])
  })
})

describe("getHoverForPreset", () => {
  it("should return hoverScale for scaleIn", () => {
    expect(getHoverForPreset("scaleIn")).toEqual(hoverScale)
  })

  it("should return hoverGlow for glow", () => {
    expect(getHoverForPreset("glow")).toEqual(hoverGlow)
  })

  it("should return hoverLift for bounceIn", () => {
    expect(getHoverForPreset("bounceIn")).toEqual(hoverLift)
  })

  it("should return undefined for fadeIn", () => {
    expect(getHoverForPreset("fadeIn")).toBeUndefined()
  })
})

describe("getTapForPreset", () => {
  it("should return tapPress for scaleIn", () => {
    expect(getTapForPreset("scaleIn")).toEqual(tapPress)
  })

  it("should return tapScale for fadeIn", () => {
    expect(getTapForPreset("fadeIn")).toEqual(tapScale)
  })
})

// ============================================================================
// Animation Composition Tests
// ============================================================================

describe("composeAnimations", () => {
  it("should compose single preset", () => {
    const result = composeAnimations({
      presets: [{ type: "fadeIn" }],
    })

    expect(result.presence).toEqual(presenceFade)
    expect(result.reducedMotion).toBe("user")
  })

  it("should compose multiple presets (last wins)", () => {
    const result = composeAnimations({
      presets: [
        { type: "fadeIn" },
        { type: "scaleIn" },
      ],
    })

    expect(result.presence).toEqual(presenceScale)
    expect(result.hover).toEqual(hoverScale)
  })

  it("should apply custom overrides", () => {
    const customHover = { whileHover: { scale: 1.5 }, transition: { duration: 0.3 } }
    const result = composeAnimations({
      presets: [{ type: "scaleIn" }],
      custom: { hover: customHover },
    })

    expect(result.hover?.whileHover.scale).toBe(1.5)
  })

  it("should apply custom duration override", () => {
    const result = composeAnimations({
      presets: [{ type: "fadeIn", duration: 0.5 }],
    })

    expect(result.presence?.transition).toMatchObject({ duration: 0.5 })
  })

  it("should apply custom delay", () => {
    const result = composeAnimations({
      presets: [{ type: "fadeIn", delay: 0.2 }],
    })

    expect(result.presence?.transition).toMatchObject({ delay: 0.2 })
  })

  it("should apply spring config when specified", () => {
    const result = composeAnimations({
      presets: [{
        type: "scaleIn",
        spring: true,
        springConfig: { stiffness: 500, damping: 25 }
      }],
    })

    expect(result.presence?.transition).toMatchObject({ stiffness: 500, damping: 25 })
  })

  it("should disable reduced motion when specified", () => {
    const result = composeAnimations({
      presets: [{ type: "fadeIn" }],
      respectReducedMotion: false,
    })

    expect(result.reducedMotion).toBe("never")
  })

  it("should include layout and layoutId from custom", () => {
    const result = composeAnimations({
      presets: [{ type: "fadeIn" }],
      custom: { layout: true, layoutId: "test-id" },
    })

    expect(result.layout).toBe(true)
    expect(result.layoutId).toBe("test-id")
  })

  it("should include stagger from custom", () => {
    const result = composeAnimations({
      presets: [{ type: "fadeIn" }],
      custom: { stagger: staggerDefault },
    })

    expect(result.stagger).toEqual(staggerDefault)
  })
})

// ============================================================================
// Code Generation Tests
// ============================================================================

describe("generateAnimationCode", () => {
  it("should generate imports for motion", () => {
    const animation: ComponentAnimation = {
      hover: hoverScale,
    }
    const result = generateAnimationCode(animation)

    expect(result.imports).toContain("motion")
    expect(result.dependencies).toContain("framer-motion")
  })

  it("should include AnimatePresence for presence animations", () => {
    const animation: ComponentAnimation = {
      presence: presenceFade,
    }
    const result = generateAnimationCode(animation)

    expect(result.imports).toContain("AnimatePresence")
    expect(result.needsAnimatePresence).toBe(true)
  })

  it("should generate whileHover props", () => {
    const animation: ComponentAnimation = {
      hover: hoverScale,
    }
    const result = generateAnimationCode(animation)

    expect(result.motionProps).toContain("whileHover")
    expect(result.motionProps).toContain("scale")
  })

  it("should generate whileTap props", () => {
    const animation: ComponentAnimation = {
      tap: tapScale,
    }
    const result = generateAnimationCode(animation)

    expect(result.motionProps).toContain("whileTap")
  })

  it("should generate initial/animate/exit for presence", () => {
    const animation: ComponentAnimation = {
      presence: presenceFade,
    }
    const result = generateAnimationCode(animation)

    expect(result.motionProps).toContain("initial")
    expect(result.motionProps).toContain("animate")
    expect(result.motionProps).toContain("exit")
  })

  it("should generate layout prop", () => {
    const animation: ComponentAnimation = {
      layout: true,
    }
    const result = generateAnimationCode(animation)

    expect(result.motionProps).toContain("layout")
    expect(result.imports).toContain("LayoutGroup")
  })

  it("should generate layoutId prop", () => {
    const animation: ComponentAnimation = {
      layoutId: "card-expand",
    }
    const result = generateAnimationCode(animation)

    expect(result.motionProps).toContain('layoutId="card-expand"')
  })

  it("should generate useReducedMotion hook code", () => {
    const animation: ComponentAnimation = {
      presence: presenceFade,
      reducedMotion: "user",
    }
    const result = generateAnimationCode(animation)

    expect(result.imports).toContain("useReducedMotion")
    expect(result.hookCode).toContain("useReducedMotion")
  })

  it("should generate variants code when provided", () => {
    const animation: ComponentAnimation = {
      variants: pulseVariants,
    }
    const result = generateAnimationCode(animation, "Button")

    expect(result.variantsCode).toContain("buttonVariants")
    expect(result.motionProps).toContain("variants={buttonVariants}")
  })
})

describe("generateAnimatedComponent", () => {
  it("should generate complete component code", () => {
    const animation: ComponentAnimation = {
      hover: hoverScale,
      tap: tapScale,
    }
    const code = generateAnimatedComponent(animation, "Button", "button")

    expect(code).toContain("import { motion")
    expect(code).toContain("export function AnimatedButton")
    expect(code).toContain("motion.button")
    expect(code).toContain("whileHover")
    expect(code).toContain("whileTap")
  })

  it("should wrap with AnimatePresence for presence animations", () => {
    const animation: ComponentAnimation = {
      presence: presenceFade,
    }
    const code = generateAnimatedComponent(animation, "Card", "div")

    expect(code).toContain("AnimatePresence")
    expect(code).toContain('mode="wait"')
    expect(code).toContain("motion.div")
  })

  it("should include hook code for reduced motion", () => {
    const animation: ComponentAnimation = {
      presence: presenceFade,
      reducedMotion: "user",
    }
    const code = generateAnimatedComponent(animation, "Modal", "div")

    expect(code).toContain("useReducedMotion")
    expect(code).toContain("shouldReduceMotion")
  })
})

// ============================================================================
// Component Animation Selector Tests
// ============================================================================

describe("getAnimationForComponent", () => {
  it("should return button animations", () => {
    const result = getAnimationForComponent("button")

    expect(result.hover).toEqual(hoverScale)
    expect(result.tap).toEqual(tapPress)
    expect(result.reducedMotion).toBe("user")
  })

  it("should return card animations with presence", () => {
    const result = getAnimationForComponent("card")

    expect(result.hover).toEqual(hoverLift)
    expect(result.presence).toEqual(presenceScale)
  })

  it("should return modal animations", () => {
    const result = getAnimationForComponent("modal")

    expect(result.presence?.initial.scale).toBe(0.95)
    expect(result.presence?.initial.y).toBe(20)
  })

  it("should return toast animations", () => {
    const result = getAnimationForComponent("toast")

    expect(result.presence?.initial.y).toBe(-50)
  })

  it("should return list animations with stagger", () => {
    const result = getAnimationForComponent("list")

    expect(result.stagger).toBeDefined()
    expect(result.stagger?.staggerChildren).toBe(0.05)
  })

  it("should return nav animations with layout", () => {
    const result = getAnimationForComponent("nav")

    expect(result.layout).toBe(true)
    expect(result.hover?.whileHover.x).toBe(4)
  })

  it("should return input animations with focus", () => {
    const result = getAnimationForComponent("input")

    expect(result.focus?.whileFocus.scale).toBe(1.01)
  })
})

// ============================================================================
// Reduced Motion Tests
// ============================================================================

describe("Reduced Motion Support", () => {
  describe("reducedMotionFade", () => {
    it("should have simple fade animation", () => {
      expect(reducedMotionFade.initial.opacity).toBe(0)
      expect(reducedMotionFade.animate.opacity).toBe(1)
      expect(reducedMotionFade.transition).toMatchObject({ duration: 0.15 })
    })
  })

  describe("getReducedMotionAlternative", () => {
    it("should return instant for disable behavior", () => {
      const result = getReducedMotionAlternative("disable")
      expect(result.transition).toMatchObject({ duration: 0 })
    })

    it("should return fade for simplify behavior", () => {
      const result = getReducedMotionAlternative("simplify")
      expect(result).toEqual(reducedMotionFade)
    })

    it("should return fade for crossfade behavior", () => {
      const result = getReducedMotionAlternative("crossfade")
      expect(result).toEqual(reducedMotionFade)
    })
  })

  describe("withReducedMotion", () => {
    it("should add reduced motion config to animation", () => {
      const animation: ComponentAnimation = {
        presence: presenceScale,
      }
      const result = withReducedMotion(animation, { behavior: "simplify" })

      expect(result.reducedMotion).toBe("user")
      expect(result.variants?.reducedMotionFallback).toBeDefined()
    })
  })
})

// ============================================================================
// Integration Tests
// ============================================================================

describe("Animation Worker Integration", () => {
  it("should generate complete button animation code", () => {
    const animation = getAnimationForComponent("button")
    const code = generateAnimatedComponent(animation, "Button", "button")

    expect(code).toContain("motion.button")
    expect(code).toContain("whileHover")
    expect(code).toContain("whileTap")
  })

  it("should compose and generate card animation", () => {
    const animation = composeAnimations({
      presets: [
        { type: "scaleIn", duration: 0.3 },
      ],
      custom: {
        hover: hoverLift,
        layout: true,
      },
    })

    const generated = generateAnimationCode(animation)

    expect(generated.needsAnimatePresence).toBe(true)
    expect(generated.motionProps).toContain("layout")
    expect(generated.imports).toContain("LayoutGroup")
  })

  it("should handle all preset types without error", () => {
    const presetTypes = [
      "fadeIn", "fadeOut", "slideIn", "slideOut",
      "scaleIn", "scaleOut", "bounceIn", "bounceOut",
      "rotateIn", "flip", "pulse", "shake", "wiggle",
      "float", "glow",
    ] as const

    for (const type of presetTypes) {
      const preset: AnimationPreset = { type }
      expect(() => resolvePreset(preset)).not.toThrow()
    }
  })

  it("should handle all component types without error", () => {
    const componentTypes = [
      "button", "card", "modal", "toast", "list", "nav", "input",
    ] as const

    for (const type of componentTypes) {
      const animation = getAnimationForComponent(type)
      expect(animation.reducedMotion).toBe("user")
      expect(() => generateAnimationCode(animation)).not.toThrow()
    }
  })
})
