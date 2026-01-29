/**
 * Animation Presets
 *
 * Pre-built Framer Motion animation configurations following
 * modern micro-interaction patterns.
 */

import type {
  PresenceAnimation,
  HoverAnimation,
  TapAnimation,
  SpringConfig,
  AnimationVariants,
  StaggerConfig,
  AnimationDirection,
} from "./types"

// ============================================================================
// Spring Configurations
// ============================================================================

/**
 * Default spring for snappy interactions
 */
export const springSnappy: SpringConfig = {
  stiffness: 400,
  damping: 30,
  mass: 1,
}

/**
 * Gentle spring for smooth transitions
 */
export const springGentle: SpringConfig = {
  stiffness: 120,
  damping: 14,
  mass: 1,
}

/**
 * Bouncy spring for playful interactions
 */
export const springBouncy: SpringConfig = {
  stiffness: 300,
  damping: 10,
  mass: 1,
}

/**
 * Stiff spring for quick responses
 */
export const springStiff: SpringConfig = {
  stiffness: 700,
  damping: 30,
  mass: 1,
}

/**
 * Soft spring for subtle movements
 */
export const springSoft: SpringConfig = {
  stiffness: 100,
  damping: 20,
  mass: 1,
}

// ============================================================================
// Hover Animations
// ============================================================================

/**
 * Subtle scale up on hover
 */
export const hoverScale: HoverAnimation = {
  whileHover: { scale: 1.02 },
  transition: springSnappy,
}

/**
 * Lift effect with shadow
 */
export const hoverLift: HoverAnimation = {
  whileHover: {
    y: -4,
    boxShadow: "0 10px 20px rgba(0,0,0,0.1)",
  },
  transition: springGentle,
}

/**
 * Glow effect on hover
 */
export const hoverGlow: HoverAnimation = {
  whileHover: {
    boxShadow: "0 0 20px rgba(59, 130, 246, 0.5)",
  },
  transition: { duration: 0.2 },
}

/**
 * Brightness increase on hover
 */
export const hoverBrighten: HoverAnimation = {
  whileHover: {
    filter: "brightness(1.1)",
  },
  transition: { duration: 0.15 },
}

/**
 * Rotate slightly on hover
 */
export const hoverRotate: HoverAnimation = {
  whileHover: { rotate: 3 },
  transition: springBouncy,
}

// ============================================================================
// Tap Animations
// ============================================================================

/**
 * Scale down on tap
 */
export const tapScale: TapAnimation = {
  whileTap: { scale: 0.95 },
  transition: springStiff,
}

/**
 * Push down effect
 */
export const tapPush: TapAnimation = {
  whileTap: { y: 2 },
  transition: springStiff,
}

/**
 * Combined scale and push
 */
export const tapPress: TapAnimation = {
  whileTap: { scale: 0.97, y: 1 },
  transition: springStiff,
}

// ============================================================================
// Presence Animations (Enter/Exit)
// ============================================================================

/**
 * Fade in/out
 */
export const presenceFade: PresenceAnimation = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
}

/**
 * Scale and fade
 */
export const presenceScale: PresenceAnimation = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
  transition: springGentle,
}

/**
 * Slide from direction with fade
 */
export function presenceSlide(
  direction: AnimationDirection = "up",
  distance: number = 20
): PresenceAnimation {
  const isVertical = direction === "up" || direction === "down"
  const sign = direction === "down" || direction === "right" ? -1 : 1
  const offset = distance * sign

  if (isVertical) {
    return {
      initial: { opacity: 0, y: offset },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: offset },
      transition: springGentle,
    }
  }
  return {
    initial: { opacity: 0, x: offset },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: offset },
    transition: springGentle,
  }
}

/**
 * Bounce in effect
 */
export const presenceBounce: PresenceAnimation = {
  initial: { opacity: 0, scale: 0.3 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.3 },
  transition: springBouncy,
}

/**
 * Flip in effect
 */
export const presenceFlip: PresenceAnimation = {
  initial: { opacity: 0, rotateX: -90 },
  animate: { opacity: 1, rotateX: 0 },
  exit: { opacity: 0, rotateX: 90 },
  transition: springGentle,
}

/**
 * Zoom in from center
 */
export const presenceZoom: PresenceAnimation = {
  initial: { opacity: 0, scale: 0 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0 },
  transition: springBouncy,
}

// ============================================================================
// Attention/Emphasis Animations
// ============================================================================

/**
 * Pulse animation variants
 */
export const pulseVariants: AnimationVariants = {
  idle: { scale: 1 },
  pulse: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 0.6,
      ease: "easeInOut",
    },
  },
}

/**
 * Shake animation variants
 */
export const shakeVariants: AnimationVariants = {
  idle: { x: 0 },
  shake: {
    x: [-10, 10, -10, 10, 0],
    transition: {
      duration: 0.5,
    },
  },
}

/**
 * Wiggle animation variants
 */
export const wiggleVariants: AnimationVariants = {
  idle: { rotate: 0 },
  wiggle: {
    rotate: [-3, 3, -3, 3, 0],
    transition: {
      duration: 0.5,
    },
  },
}

/**
 * Float animation (continuous)
 */
export const floatVariants: AnimationVariants = {
  float: {
    y: [-5, 5, -5],
    transition: {
      duration: 3,
      ease: "easeInOut",
    },
  },
}

// ============================================================================
// Stagger Configurations
// ============================================================================

/**
 * Default list stagger
 */
export const staggerDefault: StaggerConfig = {
  staggerChildren: 0.05,
  delayChildren: 0.1,
}

/**
 * Fast stagger for quick lists
 */
export const staggerFast: StaggerConfig = {
  staggerChildren: 0.03,
  delayChildren: 0.05,
}

/**
 * Slow stagger for emphasis
 */
export const staggerSlow: StaggerConfig = {
  staggerChildren: 0.1,
  delayChildren: 0.2,
}

/**
 * Reverse stagger (last to first)
 */
export const staggerReverse: StaggerConfig = {
  staggerChildren: 0.05,
  staggerDirection: -1,
}

// ============================================================================
// Button Animation Presets
// ============================================================================

/**
 * Primary button animations
 */
export const buttonPrimary = {
  hover: hoverScale,
  tap: tapPress,
}

/**
 * Secondary button animations
 */
export const buttonSecondary = {
  hover: hoverBrighten,
  tap: tapScale,
}

/**
 * Ghost button animations
 */
export const buttonGhost = {
  hover: {
    whileHover: { backgroundColor: "rgba(0,0,0,0.05)" },
    transition: { duration: 0.15 },
  } as HoverAnimation,
  tap: tapScale,
}

/**
 * Icon button animations
 */
export const buttonIcon = {
  hover: hoverRotate,
  tap: tapScale,
}

// ============================================================================
// Card Animation Presets
// ============================================================================

/**
 * Interactive card animations
 */
export const cardInteractive = {
  hover: hoverLift,
  tap: tapPush,
}

/**
 * Subtle card animations
 */
export const cardSubtle = {
  hover: {
    whileHover: {
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    },
    transition: { duration: 0.2 },
  } as HoverAnimation,
}

/**
 * Card with glow on hover
 */
export const cardGlow = {
  hover: hoverGlow,
  tap: tapScale,
}

// ============================================================================
// List Item Animation Presets
// ============================================================================

/**
 * List item presence animation
 */
export const listItemVariants: AnimationVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springGentle,
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.2 },
  },
}

/**
 * List container variants with stagger
 */
export const listContainerVariants: AnimationVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.3,
      staggerChildren: staggerDefault.staggerChildren,
      delayChildren: staggerDefault.delayChildren,
    },
  },
}

// ============================================================================
// Modal Animation Presets
// ============================================================================

/**
 * Modal backdrop animation
 */
export const modalBackdrop: PresenceAnimation = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
}

/**
 * Modal content animation
 */
export const modalContent: PresenceAnimation = {
  initial: { opacity: 0, scale: 0.95, y: 20 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 20 },
  transition: springGentle,
}

/**
 * Slide-up modal (mobile style)
 */
export const modalSlideUp: PresenceAnimation = {
  initial: { opacity: 0, y: "100%" },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: "100%" },
  transition: springGentle,
}

// ============================================================================
// Toast Animation Presets
// ============================================================================

/**
 * Toast from top
 */
export const toastFromTop: PresenceAnimation = {
  initial: { opacity: 0, y: -50, scale: 0.9 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -20, scale: 0.9 },
  transition: springSnappy,
}

/**
 * Toast from bottom
 */
export const toastFromBottom: PresenceAnimation = {
  initial: { opacity: 0, y: 50, scale: 0.9 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 20, scale: 0.9 },
  transition: springSnappy,
}

/**
 * Toast from right (notification style)
 */
export const toastFromRight: PresenceAnimation = {
  initial: { opacity: 0, x: 100 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 100 },
  transition: springSnappy,
}

// ============================================================================
// Navigation Animation Presets
// ============================================================================

/**
 * Nav link hover
 */
export const navLinkHover: HoverAnimation = {
  whileHover: { x: 4 },
  transition: springSnappy,
}

/**
 * Nav indicator (underline)
 */
export const navIndicator = {
  layoutId: "nav-indicator",
  transition: springSnappy,
}

/**
 * Mobile menu animation
 */
export const mobileMenuVariants: AnimationVariants = {
  closed: {
    opacity: 0,
    height: 0,
    transition: { duration: 0.2 },
  },
  open: {
    opacity: 1,
    height: "auto",
    transition: {
      duration: 0.3,
      ...staggerDefault,
    },
  },
}

// ============================================================================
// Reduced Motion Alternatives
// ============================================================================

/**
 * Simple fade for reduced motion
 */
export const reducedMotionFade: PresenceAnimation = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15 },
}

/**
 * No animation (instant)
 */
export const reducedMotionInstant: PresenceAnimation = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0 },
}

/**
 * Get reduced motion alternative for a preset
 */
export function getReducedMotionAlternative(
  behavior: "disable" | "simplify" | "crossfade"
): PresenceAnimation {
  switch (behavior) {
    case "disable":
      return reducedMotionInstant
    case "simplify":
    case "crossfade":
    default:
      return reducedMotionFade
  }
}
