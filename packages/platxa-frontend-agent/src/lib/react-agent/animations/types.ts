/**
 * Animation Worker - Type Definitions
 *
 * Types for Framer Motion animations following modern patterns
 * with reduced motion support and spring physics.
 */

/**
 * Keyframe value - single value or array for keyframe animations
 */
export type KeyframeValue<T> = T | T[]

/**
 * Animation timing configuration
 */
export interface AnimationTiming {
  /** Duration in seconds */
  duration?: number
  /** Delay before animation starts */
  delay?: number
  /** Easing function or cubic bezier */
  ease?: string | number[]
  /** Repeat count (Infinity for infinite) */
  repeat?: number
  /** Repeat type */
  repeatType?: "loop" | "reverse" | "mirror"
  /** Repeat delay */
  repeatDelay?: number
}

/**
 * Spring physics configuration
 */
export interface SpringConfig {
  /** Type identifier for spring */
  type?: "spring"
  /** Spring stiffness (default: 100) */
  stiffness?: number
  /** Damping ratio (default: 10) */
  damping?: number
  /** Mass of the object (default: 1) */
  mass?: number
  /** Velocity at start */
  velocity?: number
  /** Rest speed threshold */
  restSpeed?: number
  /** Rest delta threshold */
  restDelta?: number
}

/**
 * Combined transition configuration
 */
export type TransitionConfig = AnimationTiming | SpringConfig

/**
 * Transform properties for animations (supports keyframes)
 */
export interface TransformProps {
  x?: KeyframeValue<number | string>
  y?: KeyframeValue<number | string>
  z?: KeyframeValue<number | string>
  rotate?: KeyframeValue<number>
  rotateX?: KeyframeValue<number>
  rotateY?: KeyframeValue<number>
  rotateZ?: KeyframeValue<number>
  scale?: KeyframeValue<number>
  scaleX?: KeyframeValue<number>
  scaleY?: KeyframeValue<number>
  skew?: KeyframeValue<number>
  skewX?: KeyframeValue<number>
  skewY?: KeyframeValue<number>
}

/**
 * Style properties for animations (supports keyframes)
 */
export interface StyleProps {
  opacity?: KeyframeValue<number>
  backgroundColor?: KeyframeValue<string>
  color?: KeyframeValue<string>
  borderColor?: KeyframeValue<string>
  borderRadius?: KeyframeValue<number | string>
  boxShadow?: KeyframeValue<string>
  filter?: KeyframeValue<string>
  width?: KeyframeValue<number | string>
  height?: KeyframeValue<number | string>
  padding?: KeyframeValue<number | string>
  margin?: KeyframeValue<number | string>
}

/**
 * Combined animation properties
 */
export type AnimationProps = TransformProps & StyleProps

/**
 * Animation state (initial, animate, exit, etc.)
 */
export interface AnimationState {
  /** Properties for this state */
  props: AnimationProps
  /** Transition configuration */
  transition?: TransitionConfig
}

/**
 * Hover animation configuration
 */
export interface HoverAnimation {
  /** Properties when hovered */
  whileHover: AnimationProps
  /** Transition for hover */
  transition?: TransitionConfig
}

/**
 * Tap/press animation configuration
 */
export interface TapAnimation {
  /** Properties when pressed */
  whileTap: AnimationProps
  /** Transition for tap */
  transition?: TransitionConfig
}

/**
 * Focus animation configuration
 */
export interface FocusAnimation {
  /** Properties when focused */
  whileFocus: AnimationProps
  /** Transition for focus */
  transition?: TransitionConfig
}

/**
 * Enter/exit animation configuration
 */
export interface PresenceAnimation {
  /** Initial state (before enter) */
  initial: AnimationProps
  /** Animated state (after enter) */
  animate: AnimationProps
  /** Exit state (before unmount) */
  exit: AnimationProps
  /** Transition configuration */
  transition?: TransitionConfig
}

/**
 * Animation variant for state machines
 */
export interface AnimationVariant {
  /** Variant name */
  name: string
  /** Properties for this variant */
  props: AnimationProps
  /** Transition for this variant */
  transition?: TransitionConfig
}

/**
 * Stagger configuration for list animations
 */
export interface StaggerConfig {
  /** Delay between each child */
  staggerChildren?: number
  /** Delay before first child */
  delayChildren?: number
  /** Reverse stagger direction */
  staggerDirection?: 1 | -1
  /** Animate children when parent is in view */
  when?: "beforeChildren" | "afterChildren"
}

/**
 * Variant transition with stagger support
 */
export interface VariantTransition extends AnimationTiming {
  /** Stagger configuration */
  staggerChildren?: number
  delayChildren?: number
  staggerDirection?: 1 | -1
  when?: "beforeChildren" | "afterChildren"
}

/**
 * Animation variants map
 */
export interface AnimationVariants {
  [key: string]: AnimationProps & {
    transition?: TransitionConfig | VariantTransition
  }
}

/**
 * Animation preset types
 */
export type AnimationPresetType =
  | "fadeIn"
  | "fadeOut"
  | "slideIn"
  | "slideOut"
  | "scaleIn"
  | "scaleOut"
  | "bounceIn"
  | "bounceOut"
  | "rotateIn"
  | "flip"
  | "pulse"
  | "shake"
  | "wiggle"
  | "float"
  | "glow"

/**
 * Direction for directional animations
 */
export type AnimationDirection = "up" | "down" | "left" | "right"

/**
 * Animation preset configuration
 */
export interface AnimationPreset {
  /** Preset identifier */
  type: AnimationPresetType
  /** Optional direction */
  direction?: AnimationDirection
  /** Custom duration override */
  duration?: number
  /** Custom delay */
  delay?: number
  /** Distance for slide animations */
  distance?: number
  /** Use spring physics */
  spring?: boolean
  /** Spring configuration if spring is true */
  springConfig?: SpringConfig
}

/**
 * Complete animation configuration for a component
 */
export interface ComponentAnimation {
  /** Presence animations (enter/exit) */
  presence?: PresenceAnimation
  /** Hover animation */
  hover?: HoverAnimation
  /** Tap animation */
  tap?: TapAnimation
  /** Focus animation */
  focus?: FocusAnimation
  /** Animation variants */
  variants?: AnimationVariants
  /** Layout animation */
  layout?: boolean | "position" | "size" | "preserve-aspect"
  /** Layout ID for shared animations */
  layoutId?: string
  /** Stagger configuration for children */
  stagger?: StaggerConfig
  /** Respect reduced motion preference */
  reducedMotion?: "always" | "never" | "user"
}

/**
 * Generated animation code output
 */
export interface GeneratedAnimation {
  /** Import statements needed */
  imports: string[]
  /** Props to spread on motion component */
  motionProps: string
  /** Hook code if needed (e.g., useReducedMotion) */
  hookCode?: string
  /** Variants object code */
  variantsCode?: string
  /** Whether AnimatePresence wrapper is needed */
  needsAnimatePresence: boolean
  /** Dependencies required */
  dependencies: string[]
}

/**
 * Animation composition options
 */
export interface AnimationComposerOptions {
  /** Combine multiple presets */
  presets?: AnimationPreset[]
  /** Custom overrides */
  custom?: Partial<ComponentAnimation>
  /** Enable reduced motion support */
  respectReducedMotion?: boolean
  /** Generate as variants object */
  asVariants?: boolean
}

/**
 * Reduced motion configuration
 */
export interface ReducedMotionConfig {
  /** Behavior when user prefers reduced motion */
  behavior: "disable" | "simplify" | "crossfade"
  /** Fallback animation for simplify mode */
  fallback?: AnimationProps
}
