"use client";

/**
 * AnimatedComponents.tsx — Production-Grade Animated UI Components
 *
 * Pre-built animated wrappers for common UI patterns using Framer Motion.
 * All components respect reduced motion preferences.
 *
 * Features:
 * - AnimatePresence wrapper for mount/unmount animations
 * - Animated list with stagger support
 * - Animated panel for sidebars and drawers
 * - Animated modal with backdrop
 * - Loading states with skeleton animations
 */

import React, { forwardRef, useId } from "react";
import {
  motion,
  AnimatePresence,
  type HTMLMotionProps,
  type Variants,
  LayoutGroup,
} from "framer-motion";
import {
  fadeVariants,
  fadeScaleVariants,
  slideLeftVariants,
  slideRightVariants,
  slideTopVariants,
  slideBottomVariants,
  modalVariants,
  overlayVariants,
  staggerContainerVariants,
  staggerItemVariants,
  toastVariants,
  springSnappy,
  springSmooth,
  prefersReducedMotion,
  getSafeVariants,
  hoverTapProps,
  buttonAnimationProps,
} from "./motion-variants";

// =============================================================================
// Types
// =============================================================================

export type AnimationDirection = "left" | "right" | "top" | "bottom";

export interface AnimatedPresenceProps {
  /** Whether to show the children */
  show: boolean;
  /** Animation direction for slide variants */
  direction?: AnimationDirection;
  /** Use fade only (no slide) */
  fadeOnly?: boolean;
  /** Use scale animation */
  withScale?: boolean;
  /** Custom variants */
  variants?: Variants;
  /** Exit before enter (mode="wait") */
  exitBeforeEnter?: boolean;
  /** Children to animate */
  children: React.ReactNode;
  /** Additional class name */
  className?: string;
}

export interface AnimatedListProps {
  /** Items to render */
  items: React.ReactNode[];
  /** Keys for each item (required for proper animations) */
  keys: string[];
  /** Custom item variants */
  itemVariants?: Variants;
  /** Stagger delay between items */
  staggerDelay?: number;
  /** Additional container class */
  className?: string;
  /** Additional item class */
  itemClassName?: string;
}

export interface AnimatedPanelProps extends HTMLMotionProps<"div"> {
  /** Whether panel is open */
  isOpen: boolean;
  /** Panel position */
  position?: "left" | "right" | "top" | "bottom";
  /** Panel width/height */
  size?: string | number;
}

export interface AnimatedModalProps {
  /** Whether modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Modal content */
  children: React.ReactNode;
  /** Show backdrop */
  showBackdrop?: boolean;
  /** Close on backdrop click */
  closeOnBackdrop?: boolean;
  /** Additional modal class */
  className?: string;
}

export interface AnimatedButtonProps extends HTMLMotionProps<"button"> {
  /** Use subtle animation */
  subtle?: boolean;
}

export interface AnimatedCardProps extends HTMLMotionProps<"div"> {
  /** Enable hover lift effect */
  hoverLift?: boolean;
}

// =============================================================================
// AnimatedPresence Component
// =============================================================================

/**
 * Wrapper for animating enter/exit of elements
 */
export function AnimatedPresenceWrapper({
  show,
  direction,
  fadeOnly = false,
  withScale = false,
  variants: customVariants,
  exitBeforeEnter = false,
  children,
  className,
}: AnimatedPresenceProps) {
  // Determine variants
  let variants: Variants;

  if (customVariants) {
    variants = customVariants;
  } else if (fadeOnly) {
    variants = fadeVariants;
  } else if (withScale) {
    variants = fadeScaleVariants;
  } else {
    // Direction-based slide variants
    switch (direction) {
      case "left":
        variants = slideLeftVariants;
        break;
      case "right":
        variants = slideRightVariants;
        break;
      case "top":
        variants = slideTopVariants;
        break;
      case "bottom":
        variants = slideBottomVariants;
        break;
      default:
        variants = fadeVariants;
    }
  }

  // Apply reduced motion if needed
  const safeVariants = getSafeVariants(variants);

  return (
    <AnimatePresence mode={exitBeforeEnter ? "wait" : "sync"}>
      {show && (
        <motion.div
          variants={safeVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// =============================================================================
// AnimatedList Component
// =============================================================================

/**
 * Animated list with staggered children
 */
export function AnimatedList({
  items,
  keys,
  itemVariants = staggerItemVariants,
  staggerDelay = 0.05,
  className,
  itemClassName,
}: AnimatedListProps) {
  const reducedMotion = prefersReducedMotion();

  const containerVariants: Variants = {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: reducedMotion ? 0 : staggerDelay,
        delayChildren: reducedMotion ? 0 : 0.1,
      },
    },
    exit: {
      opacity: 0,
      transition: {
        staggerChildren: reducedMotion ? 0 : staggerDelay * 0.5,
        staggerDirection: -1,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
    >
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => (
          <motion.div
            key={keys[index]}
            variants={itemVariants}
            layout={!reducedMotion}
            className={itemClassName}
          >
            {item}
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

// =============================================================================
// AnimatedPanel Component
// =============================================================================

/**
 * Animated panel for sidebars and drawers
 */
export const AnimatedPanel = forwardRef<HTMLDivElement, AnimatedPanelProps>(
  function AnimatedPanel(
    { isOpen, position = "left", size = 300, children, className, style, ...props },
    ref
  ) {
    const reducedMotion = prefersReducedMotion();

    // Determine animation axis and direction
    const isHorizontal = position === "left" || position === "right";
    const axis = isHorizontal ? "x" : "y";
    const sign = position === "left" || position === "top" ? -1 : 1;
    const sizeValue = typeof size === "number" ? `${size}px` : size;

    const variants: Variants = {
      closed: {
        [axis]: `${sign * 100}%`,
        opacity: reducedMotion ? 0 : 1,
        transition: reducedMotion ? { duration: 0.01 } : springSmooth,
      },
      open: {
        [axis]: 0,
        opacity: 1,
        transition: reducedMotion ? { duration: 0.01 } : springSmooth,
      },
    };

    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={ref}
            variants={variants}
            initial="closed"
            animate="open"
            exit="closed"
            className={className}
            style={{
              ...style,
              [isHorizontal ? "width" : "height"]: sizeValue,
            }}
            {...props}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);

// =============================================================================
// AnimatedModal Component
// =============================================================================

/**
 * Animated modal with optional backdrop
 */
export function AnimatedModal({
  isOpen,
  onClose,
  children,
  showBackdrop = true,
  closeOnBackdrop = true,
  className,
}: AnimatedModalProps) {
  const reducedMotion = prefersReducedMotion();
  const modalId = useId();

  const safeModalVariants = getSafeVariants(modalVariants);
  const safeOverlayVariants = getSafeVariants(overlayVariants);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          {showBackdrop && (
            <motion.div
              variants={safeOverlayVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={handleBackdropClick}
              aria-hidden="true"
            />
          )}

          {/* Modal Content */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${modalId}-title`}
            variants={safeModalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={className}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// =============================================================================
// AnimatedButton Component
// =============================================================================

/**
 * Button with hover/tap animations
 */
export const AnimatedButton = forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  function AnimatedButton({ subtle = false, children, className, ...props }, ref) {
    const reducedMotion = prefersReducedMotion();

    const animationProps = reducedMotion
      ? {}
      : subtle
        ? {
            whileHover: { scale: 1.01 },
            whileTap: { scale: 0.99 },
            transition: springSnappy,
          }
        : buttonAnimationProps;

    return (
      <motion.button ref={ref} className={className} {...animationProps} {...props}>
        {children}
      </motion.button>
    );
  }
);

// =============================================================================
// AnimatedCard Component
// =============================================================================

/**
 * Card with optional hover lift effect
 */
export const AnimatedCard = forwardRef<HTMLDivElement, AnimatedCardProps>(
  function AnimatedCard({ hoverLift = true, children, className, ...props }, ref) {
    const reducedMotion = prefersReducedMotion();

    const animationProps = reducedMotion || !hoverLift
      ? {}
      : {
          whileHover: {
            y: -2,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          },
          transition: springSnappy,
        };

    return (
      <motion.div ref={ref} className={className} {...animationProps} {...props}>
        {children}
      </motion.div>
    );
  }
);

// =============================================================================
// AnimatedToast Component
// =============================================================================

export interface AnimatedToastProps {
  /** Toast content */
  children: React.ReactNode;
  /** Whether toast is visible */
  isVisible: boolean;
  /** Position on screen */
  position?: "top" | "bottom" | "top-right" | "bottom-right";
  /** Additional class */
  className?: string;
}

/**
 * Animated toast notification
 */
export function AnimatedToast({
  children,
  isVisible,
  position = "bottom-right",
  className,
}: AnimatedToastProps) {
  const safeVariants = getSafeVariants(toastVariants);

  const positionClasses = {
    top: "top-4 left-1/2 -translate-x-1/2",
    bottom: "bottom-4 left-1/2 -translate-x-1/2",
    "top-right": "top-4 right-4",
    "bottom-right": "bottom-4 right-4",
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          role="alert"
          aria-live="polite"
          variants={safeVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className={`fixed z-50 ${positionClasses[position]} ${className || ""}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// =============================================================================
// AnimatedCollapsible Component
// =============================================================================

export interface AnimatedCollapsibleProps {
  /** Whether content is expanded */
  isExpanded: boolean;
  /** Content to show when expanded */
  children: React.ReactNode;
  /** Additional class */
  className?: string;
}

/**
 * Animated collapsible content
 */
export function AnimatedCollapsible({
  isExpanded,
  children,
  className,
}: AnimatedCollapsibleProps) {
  const reducedMotion = prefersReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{
            height: "auto",
            opacity: 1,
            transition: reducedMotion
              ? { duration: 0.01 }
              : {
                  height: springSmooth,
                  opacity: { duration: 0.2, delay: 0.1 },
                },
          }}
          exit={{
            height: 0,
            opacity: 0,
            transition: reducedMotion
              ? { duration: 0.01 }
              : {
                  height: springSmooth,
                  opacity: { duration: 0.1 },
                },
          }}
          className={`overflow-hidden ${className || ""}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// =============================================================================
// AnimatedCounter Component
// =============================================================================

export interface AnimatedCounterProps {
  /** Current value */
  value: number;
  /** Format function */
  format?: (value: number) => string;
  /** Additional class */
  className?: string;
}

/**
 * Animated number counter with layout animation
 */
export function AnimatedCounter({
  value,
  format = (v) => v.toString(),
  className,
}: AnimatedCounterProps) {
  const reducedMotion = prefersReducedMotion();

  return (
    <motion.span
      key={value}
      initial={reducedMotion ? {} : { opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? {} : { opacity: 0, y: 10 }}
      transition={reducedMotion ? { duration: 0.01 } : springSnappy}
      className={className}
    >
      {format(value)}
    </motion.span>
  );
}

// =============================================================================
// LayoutGroupProvider Component
// =============================================================================

export interface LayoutGroupProviderProps {
  /** Unique group ID */
  id?: string;
  /** Children */
  children: React.ReactNode;
}

/**
 * Provider for shared layout animations
 */
export function LayoutGroupProvider({ id, children }: LayoutGroupProviderProps) {
  return <LayoutGroup id={id}>{children}</LayoutGroup>;
}

// =============================================================================
// Export
// =============================================================================

export {
  AnimatePresence,
  motion,
  type Variants,
} from "framer-motion";
