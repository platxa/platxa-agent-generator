/**
 * motion-variants.ts — Production-Grade Framer Motion Variants
 *
 * Centralized animation definitions for consistent, performant animations.
 * All variants respect reduced motion preferences and use GPU-accelerated properties.
 *
 * Features:
 * - Spring physics for natural motion
 * - Staggered children animations
 * - Layout animations
 * - Reduced motion support
 * - Optimized for 60fps
 */

import type { Variants, Transition, TargetAndTransition } from "framer-motion";

// =============================================================================
// Transitions
// =============================================================================

/** Snappy spring for UI interactions */
export const springSnappy: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 30,
  mass: 1,
};

/** Smooth spring for panel animations */
export const springSmooth: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
  mass: 1,
};

/** Gentle spring for content reveals */
export const springGentle: Transition = {
  type: "spring",
  stiffness: 200,
  damping: 25,
  mass: 1,
};

/** Fast tween for micro-interactions */
export const tweenFast: Transition = {
  type: "tween",
  duration: 0.15,
  ease: [0.25, 0.1, 0.25, 1],
};

/** Standard tween for most animations */
export const tweenStandard: Transition = {
  type: "tween",
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1],
};

/** Slow tween for emphasis */
export const tweenSlow: Transition = {
  type: "tween",
  duration: 0.35,
  ease: [0.25, 0.1, 0.25, 1],
};

// =============================================================================
// Fade Variants
// =============================================================================

/** Simple fade in/out */
export const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: tweenStandard },
  exit: { opacity: 0, transition: tweenFast },
};

/** Fade with slight scale */
export const fadeScaleVariants: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: springSnappy,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: tweenFast,
  },
};

// =============================================================================
// Slide Variants
// =============================================================================

/** Slide from left */
export const slideLeftVariants: Variants = {
  initial: { x: -20, opacity: 0 },
  animate: { x: 0, opacity: 1, transition: springSmooth },
  exit: { x: -20, opacity: 0, transition: tweenFast },
};

/** Slide from right */
export const slideRightVariants: Variants = {
  initial: { x: 20, opacity: 0 },
  animate: { x: 0, opacity: 1, transition: springSmooth },
  exit: { x: 20, opacity: 0, transition: tweenFast },
};

/** Slide from top */
export const slideTopVariants: Variants = {
  initial: { y: -20, opacity: 0 },
  animate: { y: 0, opacity: 1, transition: springSmooth },
  exit: { y: -20, opacity: 0, transition: tweenFast },
};

/** Slide from bottom */
export const slideBottomVariants: Variants = {
  initial: { y: 20, opacity: 0 },
  animate: { y: 0, opacity: 1, transition: springSmooth },
  exit: { y: 20, opacity: 0, transition: tweenFast },
};

// =============================================================================
// Panel Variants
// =============================================================================

/** Sidebar slide animation */
export const sidebarVariants: Variants = {
  collapsed: {
    width: 0,
    opacity: 0,
    transition: { ...tweenStandard, opacity: { duration: 0.1 } },
  },
  expanded: {
    width: "auto",
    opacity: 1,
    transition: springSmooth,
  },
};

/** Collapsible panel animation */
export const collapsibleVariants: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: { ...tweenStandard, opacity: { duration: 0.1 } },
  },
  expanded: {
    height: "auto",
    opacity: 1,
    transition: springSmooth,
  },
};

/** Modal/dialog animation */
export const modalVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.9,
    y: 20,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springSnappy,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: tweenFast,
  },
};

/** Overlay backdrop animation */
export const overlayVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

// =============================================================================
// List & Stagger Variants
// =============================================================================

/** Container for staggered children */
export const staggerContainerVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

/** Fast stagger for quick lists */
export const staggerFastContainerVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.02,
      staggerDirection: -1,
    },
  },
};

/** Individual stagger item */
export const staggerItemVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: springSnappy,
  },
  exit: {
    opacity: 0,
    y: -5,
    transition: tweenFast,
  },
};

/** Stagger item with scale */
export const staggerScaleItemVariants: Variants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: springSnappy,
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: tweenFast,
  },
};

// =============================================================================
// Chat Message Variants
// =============================================================================

/** User message animation (from right) */
export const userMessageVariants: Variants = {
  initial: { opacity: 0, x: 20, scale: 0.95 },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: springSnappy,
  },
  exit: {
    opacity: 0,
    x: 10,
    transition: tweenFast,
  },
};

/** Assistant message animation (from left) */
export const assistantMessageVariants: Variants = {
  initial: { opacity: 0, x: -20, scale: 0.95 },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: springSnappy,
  },
  exit: {
    opacity: 0,
    x: -10,
    transition: tweenFast,
  },
};

/** Typing indicator pulse */
export const typingDotVariants: Variants = {
  initial: { scale: 0.8, opacity: 0.5 },
  animate: {
    scale: [0.8, 1.2, 0.8],
    opacity: [0.5, 1, 0.5],
    transition: {
      duration: 1.2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

// =============================================================================
// Drag & Drop Variants
// =============================================================================

/** Draggable item */
export const draggableVariants: Variants = {
  idle: {
    scale: 1,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    zIndex: 0,
  },
  dragging: {
    scale: 1.02,
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
    zIndex: 50,
    transition: springSnappy,
  },
};

/** Drop zone highlight */
export const dropZoneVariants: Variants = {
  idle: {
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
  active: {
    backgroundColor: "rgba(var(--primary-rgb), 0.1)",
    borderColor: "rgba(var(--primary-rgb), 0.5)",
    transition: tweenFast,
  },
};

// =============================================================================
// Notification Variants
// =============================================================================

/** Toast notification animation */
export const toastVariants: Variants = {
  initial: {
    opacity: 0,
    y: 50,
    scale: 0.9,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springSnappy,
  },
  exit: {
    opacity: 0,
    y: 20,
    scale: 0.95,
    transition: tweenFast,
  },
};

/** Badge/pill animation */
export const badgeVariants: Variants = {
  initial: { opacity: 0, scale: 0 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: springSnappy,
  },
  exit: {
    opacity: 0,
    scale: 0,
    transition: tweenFast,
  },
};

// =============================================================================
// Loading Variants
// =============================================================================

/** Skeleton shimmer (use with pseudo-element) */
export const skeletonVariants: Variants = {
  initial: { opacity: 0.5 },
  animate: {
    opacity: [0.5, 0.8, 0.5],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

/** Spinner rotation */
export const spinnerVariants: Variants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: "linear",
    },
  },
};

/** Progress bar fill */
export const progressVariants: Variants = {
  initial: { scaleX: 0, originX: 0 },
  animate: (progress: number) => ({
    scaleX: progress,
    transition: springSmooth,
  }),
};

// =============================================================================
// Interactive Variants
// =============================================================================

/** Button press effect */
export const buttonPressVariants: Variants = {
  idle: { scale: 1 },
  hover: { scale: 1.02 },
  tap: { scale: 0.98 },
};

/** Card hover effect */
export const cardHoverVariants: Variants = {
  idle: {
    y: 0,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  hover: {
    y: -2,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    transition: springSnappy,
  },
};

/** Icon bounce on action */
export const iconBounceVariants: Variants = {
  idle: { scale: 1 },
  bounce: {
    scale: [1, 1.2, 0.9, 1.1, 1],
    transition: {
      duration: 0.4,
      times: [0, 0.2, 0.4, 0.6, 1],
    },
  },
};

// =============================================================================
// Reduced Motion Support
// =============================================================================

/** Check if user prefers reduced motion */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Get safe variants (respects reduced motion) */
export function getSafeVariants(variants: Variants): Variants {
  if (prefersReducedMotion()) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.01 } },
      exit: { opacity: 0, transition: { duration: 0.01 } },
    };
  }
  return variants;
}

/** Create custom transition with reduced motion support */
export function createSafeTransition(transition: Transition): Transition {
  if (prefersReducedMotion()) {
    return { duration: 0.01 };
  }
  return transition;
}

// =============================================================================
// Utility Functions
// =============================================================================

/** Create stagger delay for index */
export function getStaggerDelay(index: number, baseDelay = 0.05): number {
  return index * baseDelay;
}

/** Create custom slide variant */
export function createSlideVariant(
  direction: "left" | "right" | "top" | "bottom",
  distance = 20
): Variants {
  const axis = direction === "left" || direction === "right" ? "x" : "y";
  const sign = direction === "left" || direction === "top" ? -1 : 1;

  return {
    initial: { [axis]: distance * sign, opacity: 0 },
    animate: { [axis]: 0, opacity: 1, transition: springSmooth },
    exit: { [axis]: distance * sign * 0.5, opacity: 0, transition: tweenFast },
  };
}

/** Create custom scale variant */
export function createScaleVariant(
  initialScale = 0.95,
  exitScale = 0.98
): Variants {
  return {
    initial: { opacity: 0, scale: initialScale },
    animate: { opacity: 1, scale: 1, transition: springSnappy },
    exit: { opacity: 0, scale: exitScale, transition: tweenFast },
  };
}

// =============================================================================
// Hover/Tap Props Helpers
// =============================================================================

/** Standard hover/tap animation props */
export const hoverTapProps = {
  whileHover: { scale: 1.02 } as TargetAndTransition,
  whileTap: { scale: 0.98 } as TargetAndTransition,
  transition: springSnappy,
};

/** Subtle hover/tap animation props */
export const subtleHoverTapProps = {
  whileHover: { scale: 1.01 } as TargetAndTransition,
  whileTap: { scale: 0.99 } as TargetAndTransition,
  transition: springSnappy,
};

/** Button-specific animation props */
export const buttonAnimationProps = {
  whileHover: { scale: 1.02, y: -1 } as TargetAndTransition,
  whileTap: { scale: 0.98, y: 0 } as TargetAndTransition,
  transition: springSnappy,
};

// =============================================================================
// Export
// =============================================================================

export const motionVariants = {
  // Fade
  fade: fadeVariants,
  fadeScale: fadeScaleVariants,

  // Slide
  slideLeft: slideLeftVariants,
  slideRight: slideRightVariants,
  slideTop: slideTopVariants,
  slideBottom: slideBottomVariants,

  // Panels
  sidebar: sidebarVariants,
  collapsible: collapsibleVariants,
  modal: modalVariants,
  overlay: overlayVariants,

  // Lists
  staggerContainer: staggerContainerVariants,
  staggerFastContainer: staggerFastContainerVariants,
  staggerItem: staggerItemVariants,
  staggerScaleItem: staggerScaleItemVariants,

  // Chat
  userMessage: userMessageVariants,
  assistantMessage: assistantMessageVariants,
  typingDot: typingDotVariants,

  // Drag & Drop
  draggable: draggableVariants,
  dropZone: dropZoneVariants,

  // Notifications
  toast: toastVariants,
  badge: badgeVariants,

  // Loading
  skeleton: skeletonVariants,
  spinner: spinnerVariants,
  progress: progressVariants,

  // Interactive
  buttonPress: buttonPressVariants,
  cardHover: cardHoverVariants,
  iconBounce: iconBounceVariants,
};

export default motionVariants;
