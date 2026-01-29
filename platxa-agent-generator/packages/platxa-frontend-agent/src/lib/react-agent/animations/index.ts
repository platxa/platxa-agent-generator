/**
 * Animation Worker Module
 *
 * Provides Framer Motion animation utilities for React components
 * with pre-built presets and reduced motion support.
 *
 * @example
 * ```typescript
 * import {
 *   getAnimationForComponent,
 *   composeAnimations,
 *   generateAnimatedComponent,
 * } from "@/lib/react-agent/animations"
 *
 * // Get preset animations for a button
 * const buttonAnimation = getAnimationForComponent("button")
 *
 * // Compose custom animations
 * const custom = composeAnimations({
 *   presets: [{ type: "slideIn", direction: "up" }],
 *   custom: { hover: hoverScale },
 * })
 *
 * // Generate component code
 * const code = generateAnimatedComponent(custom, "Card", "div")
 * ```
 *
 * @module react-agent/animations
 */

// Main worker functions
export {
  resolvePreset,
  getHoverForPreset,
  getTapForPreset,
  composeAnimations,
  generateAnimationCode,
  generateAnimatedComponent,
  getAnimationForComponent,
  withReducedMotion,
} from "./animation-worker"

// Presets - Springs
export {
  springSnappy,
  springGentle,
  springBouncy,
  springStiff,
  springSoft,
} from "./presets"

// Presets - Hover
export {
  hoverScale,
  hoverLift,
  hoverGlow,
  hoverBrighten,
  hoverRotate,
} from "./presets"

// Presets - Tap
export {
  tapScale,
  tapPush,
  tapPress,
} from "./presets"

// Presets - Presence
export {
  presenceFade,
  presenceScale,
  presenceSlide,
  presenceBounce,
  presenceFlip,
  presenceZoom,
} from "./presets"

// Presets - Variants
export {
  pulseVariants,
  shakeVariants,
  wiggleVariants,
  floatVariants,
  listItemVariants,
  listContainerVariants,
  mobileMenuVariants,
} from "./presets"

// Presets - Stagger
export {
  staggerDefault,
  staggerFast,
  staggerSlow,
  staggerReverse,
} from "./presets"

// Presets - Component-specific
export {
  buttonPrimary,
  buttonSecondary,
  buttonGhost,
  buttonIcon,
  cardInteractive,
  cardSubtle,
  cardGlow,
  modalBackdrop,
  modalContent,
  modalSlideUp,
  toastFromTop,
  toastFromBottom,
  toastFromRight,
  navLinkHover,
  navIndicator,
} from "./presets"

// Presets - Reduced Motion
export {
  reducedMotionFade,
  reducedMotionInstant,
  getReducedMotionAlternative,
} from "./presets"

// Type exports
export type {
  KeyframeValue,
  AnimationTiming,
  SpringConfig,
  TransitionConfig,
  TransformProps,
  StyleProps,
  AnimationProps,
  AnimationState,
  HoverAnimation,
  TapAnimation,
  FocusAnimation,
  PresenceAnimation,
  AnimationVariant,
  AnimationVariants,
  StaggerConfig,
  VariantTransition,
  AnimationPresetType,
  AnimationDirection,
  AnimationPreset,
  ComponentAnimation,
  GeneratedAnimation,
  AnimationComposerOptions,
  ReducedMotionConfig,
} from "./types"
