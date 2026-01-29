/**
 * Animation Worker
 *
 * Generates Framer Motion animation code for React components
 * with reduced motion support and spring physics.
 */

import type {
  AnimationPreset,
  AnimationPresetType,
  ComponentAnimation,
  GeneratedAnimation,
  AnimationComposerOptions,
  PresenceAnimation,
  HoverAnimation,
  TapAnimation,
  SpringConfig,
  ReducedMotionConfig,
  AnimationProps,
} from "./types"

import {
  presenceFade,
  presenceScale,
  presenceSlide,
  presenceBounce,
  presenceFlip,
  hoverScale,
  hoverLift,
  hoverGlow,
  tapScale,
  tapPress,
  springGentle,
  springBouncy,
  getReducedMotionAlternative,
} from "./presets"

// ============================================================================
// Preset Resolution
// ============================================================================

/**
 * Resolves a preset type to its animation configuration
 */
export function resolvePreset(preset: AnimationPreset): PresenceAnimation {
  const { type, direction = "up", distance = 20 } = preset

  switch (type) {
    case "fadeIn":
    case "fadeOut":
      return presenceFade

    case "slideIn":
    case "slideOut":
      return presenceSlide(direction, distance)

    case "scaleIn":
    case "scaleOut":
      return presenceScale

    case "bounceIn":
    case "bounceOut":
      return presenceBounce

    case "rotateIn":
    case "flip":
      return presenceFlip

    case "pulse":
      return {
        initial: { scale: 1 },
        animate: { scale: [1, 1.05, 1] },
        exit: { scale: 1 },
        transition: { duration: 0.6, ease: "easeInOut" },
      }

    case "shake":
      return {
        initial: { x: 0 },
        animate: { x: [-10, 10, -10, 10, 0] },
        exit: { x: 0 },
        transition: { duration: 0.5 },
      }

    case "wiggle":
      return {
        initial: { rotate: 0 },
        animate: { rotate: [-3, 3, -3, 3, 0] },
        exit: { rotate: 0 },
        transition: { duration: 0.5 },
      }

    case "float":
      return {
        initial: { y: 0 },
        animate: { y: [-5, 5, -5] },
        exit: { y: 0 },
        transition: { duration: 3, ease: "easeInOut", repeat: Infinity },
      }

    case "glow":
      return {
        initial: { boxShadow: "0 0 0 rgba(59, 130, 246, 0)" },
        animate: { boxShadow: "0 0 20px rgba(59, 130, 246, 0.5)" },
        exit: { boxShadow: "0 0 0 rgba(59, 130, 246, 0)" },
        transition: { duration: 0.3 },
      }

    default:
      return presenceFade
  }
}

/**
 * Gets hover animation for a preset type
 */
export function getHoverForPreset(type: AnimationPresetType): HoverAnimation | undefined {
  switch (type) {
    case "scaleIn":
    case "scaleOut":
      return hoverScale
    case "glow":
      return hoverGlow
    case "bounceIn":
      return hoverLift
    default:
      return undefined
  }
}

/**
 * Gets tap animation for a preset type
 */
export function getTapForPreset(type: AnimationPresetType): TapAnimation | undefined {
  switch (type) {
    case "scaleIn":
    case "bounceIn":
      return tapPress
    default:
      return tapScale
  }
}

// ============================================================================
// Animation Composition
// ============================================================================

/**
 * Composes multiple animation configurations into one
 */
export function composeAnimations(
  options: AnimationComposerOptions
): ComponentAnimation {
  const { presets = [], custom = {}, respectReducedMotion = true } = options

  const result: ComponentAnimation = {
    reducedMotion: respectReducedMotion ? "user" : "never",
  }

  // Apply presets in order
  for (const preset of presets) {
    const presence = resolvePreset(preset)
    const hover = getHoverForPreset(preset.type)
    const tap = getTapForPreset(preset.type)

    // Override spring config if specified
    if (preset.spring && preset.springConfig) {
      presence.transition = preset.springConfig
    }

    // Override duration if specified
    if (preset.duration !== undefined) {
      presence.transition = {
        ...presence.transition,
        duration: preset.duration,
      }
    }

    // Override delay if specified
    if (preset.delay !== undefined) {
      presence.transition = {
        ...presence.transition,
        delay: preset.delay,
      }
    }

    result.presence = presence
    if (hover) result.hover = hover
    if (tap) result.tap = tap
  }

  // Apply custom overrides
  if (custom.presence) result.presence = { ...result.presence, ...custom.presence }
  if (custom.hover) result.hover = { ...result.hover, ...custom.hover }
  if (custom.tap) result.tap = { ...result.tap, ...custom.tap }
  if (custom.focus) result.focus = custom.focus
  if (custom.variants) result.variants = custom.variants
  if (custom.layout !== undefined) result.layout = custom.layout
  if (custom.layoutId) result.layoutId = custom.layoutId
  if (custom.stagger) result.stagger = custom.stagger

  return result
}

// ============================================================================
// Code Generation
// ============================================================================

/**
 * Converts animation props to code string
 */
function propsToCode(props: AnimationProps, indent: number = 0): string {
  const spaces = "  ".repeat(indent)
  const entries = Object.entries(props)
    .filter(([_, v]) => v !== undefined)
    .map(([key, value]) => {
      if (typeof value === "object" && !Array.isArray(value)) {
        return `${spaces}${key}: ${propsToCode(value as AnimationProps, 0)}`
      }
      if (typeof value === "string") {
        return `${spaces}${key}: "${value}"`
      }
      if (Array.isArray(value)) {
        return `${spaces}${key}: [${value.join(", ")}]`
      }
      return `${spaces}${key}: ${value}`
    })

  if (indent === 0) {
    return `{ ${entries.join(", ")} }`
  }
  return `{\n${entries.join(",\n")}\n${"  ".repeat(indent - 1)}}`
}

/**
 * Generates spring config code
 */
function springToCode(spring: SpringConfig): string {
  const parts: string[] = ["type: \"spring\""]
  if (spring.stiffness) parts.push(`stiffness: ${spring.stiffness}`)
  if (spring.damping) parts.push(`damping: ${spring.damping}`)
  if (spring.mass) parts.push(`mass: ${spring.mass}`)
  return `{ ${parts.join(", ")} }`
}

/**
 * Generates Framer Motion code from animation configuration
 */
export function generateAnimationCode(
  animation: ComponentAnimation,
  componentName: string = "Component"
): GeneratedAnimation {
  const imports: string[] = ["motion"]
  const motionPropsLines: string[] = []
  let hookCode: string | undefined
  let variantsCode: string | undefined
  let needsAnimatePresence = false
  const dependencies = ["framer-motion"]

  // Presence animations
  if (animation.presence) {
    needsAnimatePresence = true
    imports.push("AnimatePresence")

    const { initial, animate, exit, transition } = animation.presence
    motionPropsLines.push(`initial={${propsToCode(initial)}}`)
    motionPropsLines.push(`animate={${propsToCode(animate)}}`)
    motionPropsLines.push(`exit={${propsToCode(exit)}}`)

    if (transition) {
      if ("stiffness" in transition) {
        motionPropsLines.push(`transition={${springToCode(transition as SpringConfig)}}`)
      } else {
        motionPropsLines.push(`transition={${JSON.stringify(transition)}}`)
      }
    }
  }

  // Hover animation
  if (animation.hover) {
    motionPropsLines.push(`whileHover={${propsToCode(animation.hover.whileHover)}}`)
  }

  // Tap animation
  if (animation.tap) {
    motionPropsLines.push(`whileTap={${propsToCode(animation.tap.whileTap)}}`)
  }

  // Focus animation
  if (animation.focus) {
    motionPropsLines.push(`whileFocus={${propsToCode(animation.focus.whileFocus)}}`)
  }

  // Layout animation
  if (animation.layout) {
    if (animation.layout === true) {
      motionPropsLines.push("layout")
    } else {
      motionPropsLines.push(`layout="${animation.layout}"`)
    }
    imports.push("LayoutGroup")
  }

  // Layout ID
  if (animation.layoutId) {
    motionPropsLines.push(`layoutId="${animation.layoutId}"`)
  }

  // Variants
  if (animation.variants) {
    const variantName = `${componentName.toLowerCase()}Variants`
    variantsCode = `const ${variantName} = ${JSON.stringify(animation.variants, null, 2)}`
    motionPropsLines.push(`variants={${variantName}}`)
  }

  // Reduced motion support
  if (animation.reducedMotion === "user") {
    imports.push("useReducedMotion")
    hookCode = `const shouldReduceMotion = useReducedMotion()`
  }

  return {
    imports,
    motionProps: motionPropsLines.join("\n      "),
    hookCode,
    variantsCode,
    needsAnimatePresence,
    dependencies,
  }
}

/**
 * Generates complete animation component wrapper
 */
export function generateAnimatedComponent(
  animation: ComponentAnimation,
  componentName: string,
  baseElement: string = "div"
): string {
  const generated = generateAnimationCode(animation, componentName)

  const importLine = `import { ${generated.imports.join(", ")} } from "framer-motion"`

  let code = `${importLine}\n\n`

  if (generated.variantsCode) {
    code += `${generated.variantsCode}\n\n`
  }

  code += `export function Animated${componentName}({ children, ...props }) {\n`

  if (generated.hookCode) {
    code += `  ${generated.hookCode}\n\n`
  }

  code += `  return (\n`

  if (generated.needsAnimatePresence) {
    code += `    <AnimatePresence mode="wait">\n`
    code += `      <motion.${baseElement}\n`
    code += `        ${generated.motionProps}\n`
    code += `        {...props}\n`
    code += `      >\n`
    code += `        {children}\n`
    code += `      </motion.${baseElement}>\n`
    code += `    </AnimatePresence>\n`
  } else {
    code += `    <motion.${baseElement}\n`
    code += `      ${generated.motionProps}\n`
    code += `      {...props}\n`
    code += `    >\n`
    code += `      {children}\n`
    code += `    </motion.${baseElement}>\n`
  }

  code += `  )\n`
  code += `}\n`

  return code
}

// ============================================================================
// Preset Selectors
// ============================================================================

/**
 * Get animation preset for component type
 */
export function getAnimationForComponent(
  componentType: "button" | "card" | "modal" | "toast" | "list" | "nav" | "input"
): ComponentAnimation {
  switch (componentType) {
    case "button":
      return {
        hover: hoverScale,
        tap: tapPress,
        reducedMotion: "user",
      }

    case "card":
      return {
        hover: hoverLift,
        tap: { whileTap: { scale: 0.98 }, transition: springGentle },
        presence: presenceScale,
        reducedMotion: "user",
      }

    case "modal":
      return {
        presence: {
          initial: { opacity: 0, scale: 0.95, y: 20 },
          animate: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0, scale: 0.95, y: 20 },
          transition: springGentle,
        },
        reducedMotion: "user",
      }

    case "toast":
      return {
        presence: {
          initial: { opacity: 0, y: -50, scale: 0.9 },
          animate: { opacity: 1, y: 0, scale: 1 },
          exit: { opacity: 0, y: -20, scale: 0.9 },
          transition: springBouncy,
        },
        reducedMotion: "user",
      }

    case "list":
      return {
        presence: presenceSlide("up", 10),
        stagger: {
          staggerChildren: 0.05,
          delayChildren: 0.1,
        },
        reducedMotion: "user",
      }

    case "nav":
      return {
        hover: { whileHover: { x: 4 }, transition: springGentle },
        layout: true,
        reducedMotion: "user",
      }

    case "input":
      return {
        focus: {
          whileFocus: { scale: 1.01 },
          transition: springGentle,
        },
        reducedMotion: "user",
      }

    default:
      return {
        presence: presenceFade,
        reducedMotion: "user",
      }
  }
}

/**
 * Creates animation with reduced motion support
 */
export function withReducedMotion(
  animation: ComponentAnimation,
  config: ReducedMotionConfig
): ComponentAnimation {
  const fallback = getReducedMotionAlternative(config.behavior)

  return {
    ...animation,
    reducedMotion: "user",
    variants: {
      ...animation.variants,
      reducedMotionFallback: fallback.animate,
    },
  }
}
