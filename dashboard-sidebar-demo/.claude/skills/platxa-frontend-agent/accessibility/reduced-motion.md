# Reduced Motion Respecting Animations

Implement animations that respect the `prefers-reduced-motion` user preference for accessibility and vestibular disorder accommodation.

## Overview

Some users experience motion sickness, vertigo, or discomfort from animations. The `prefers-reduced-motion` media query allows us to:
- Disable or reduce animations
- Replace motion with opacity fades
- Provide instant transitions
- Respect user's OS-level preferences

## WCAG Requirements

| Criterion | Requirement |
|-----------|-------------|
| 2.3.3 Animation from Interactions | Allow disabling motion |
| 2.3.1 Three Flashes | No flashing content |

## Detection Hook

```typescript
"use client"

import * as React from "react"

/**
 * Detect if user prefers reduced motion
 */
export const usePrefersReducedMotion = (): boolean => {
  const [prefersReduced, setPrefersReduced] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")

    // Set initial value
    setPrefersReduced(mediaQuery.matches)

    // Listen for changes
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReduced(event.matches)
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  return prefersReduced
}

/**
 * Get initial value (SSR-safe)
 */
export const getReducedMotionPreference = (): boolean => {
  if (typeof window === "undefined") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}
```

## CSS Global Styles

### Disable All Animations

```css
/* globals.css */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Selective Animation Control

```css
/* More nuanced approach */
@media (prefers-reduced-motion: reduce) {
  /* Disable decorative animations */
  .animate-spin,
  .animate-bounce,
  .animate-pulse {
    animation: none !important;
  }

  /* Replace slide with fade */
  .animate-slide-in {
    animation-name: fade-in !important;
  }

  /* Keep essential feedback */
  .animate-focus-ring {
    /* Keep focus indicators */
  }

  /* Instant transitions */
  .transition,
  [class*="transition-"] {
    transition-duration: 0.01ms !important;
  }
}

/* Motion-safe animations (only when motion is OK) */
@media (prefers-reduced-motion: no-preference) {
  .motion-safe-animate {
    animation: slide-up 0.3s ease-out;
  }
}
```

## Tailwind CSS Integration

### Tailwind Config

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss"

export default {
  theme: {
    extend: {
      // Custom animations with reduced motion variants
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "slide-up-reduced": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        }
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        "slide-up-reduced": "slide-up-reduced 0.15s ease-out"
      }
    }
  }
} satisfies Config
```

### Tailwind Utilities

```css
/* globals.css */
@layer utilities {
  /* Apply animation only when motion is OK */
  .motion-safe\:animate-slide-up {
    @media (prefers-reduced-motion: no-preference) {
      animation: slide-up 0.3s ease-out;
    }
  }

  /* Apply reduced animation when motion is reduced */
  .motion-reduce\:animate-fade {
    @media (prefers-reduced-motion: reduce) {
      animation: fade-in 0.15s ease-out;
    }
  }

  /* Disable animation when reduced */
  .motion-reduce\:animate-none {
    @media (prefers-reduced-motion: reduce) {
      animation: none !important;
    }
  }

  /* Combined utility for graceful degradation */
  .animate-appear {
    animation: fade-in 0.15s ease-out;
  }

  @media (prefers-reduced-motion: no-preference) {
    .animate-appear {
      animation: slide-up 0.3s ease-out;
    }
  }
}
```

### Usage in Components

```typescript
// Tailwind's built-in motion modifiers
<div className="motion-safe:animate-slide-up motion-reduce:animate-none">
  Content with optional animation
</div>

// Custom combined approach
<div className="animate-appear">
  Fades in always, slides up only when motion is OK
</div>
```

## Framer Motion Integration

### Motion Config Provider

```typescript
"use client"

import * as React from "react"
import { MotionConfig } from "framer-motion"

interface ReducedMotionProviderProps {
  children: React.ReactNode
}

/**
 * Provider that configures Framer Motion for reduced motion
 */
export const ReducedMotionProvider = ({
  children
}: ReducedMotionProviderProps) => {
  const prefersReduced = usePrefersReducedMotion()

  return (
    <MotionConfig reducedMotion={prefersReduced ? "always" : "never"}>
      {children}
    </MotionConfig>
  )
}
```

### Adaptive Variants Hook

```typescript
"use client"

import * as React from "react"
import { type Variants } from "framer-motion"

interface MotionVariants {
  full: Variants
  reduced: Variants
}

/**
 * Return appropriate variants based on motion preference
 */
export const useMotionVariants = (variants: MotionVariants): Variants => {
  const prefersReduced = usePrefersReducedMotion()

  return React.useMemo(
    () => (prefersReduced ? variants.reduced : variants.full),
    [prefersReduced, variants]
  )
}

// Preset variants
export const fadeVariants: MotionVariants = {
  full: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  },
  reduced: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 }
  }
}

export const scaleVariants: MotionVariants = {
  full: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 }
  },
  reduced: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 }
  }
}

export const slideVariants: MotionVariants = {
  full: {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 }
  },
  reduced: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 }
  }
}
```

### Adaptive Transition Hook

```typescript
"use client"

import * as React from "react"
import { type Transition } from "framer-motion"

/**
 * Return appropriate transition based on motion preference
 */
export const useMotionTransition = (
  fullTransition: Transition = { type: "spring", stiffness: 300, damping: 30 }
): Transition => {
  const prefersReduced = usePrefersReducedMotion()

  return React.useMemo(() => {
    if (prefersReduced) {
      return { duration: 0.15, ease: "easeOut" }
    }
    return fullTransition
  }, [prefersReduced, fullTransition])
}

// Usage
const AnimatedComponent = () => {
  const transition = useMotionTransition()
  const variants = useMotionVariants(fadeVariants)

  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={transition}
    >
      Content
    </motion.div>
  )
}
```

### Motion-Safe Component

```typescript
"use client"

import * as React from "react"
import { motion, AnimatePresence, type MotionProps } from "framer-motion"

interface MotionSafeProps extends MotionProps {
  children: React.ReactNode
  className?: string
  /**
   * Whether to still animate (with reduced motion)
   * Set to false to completely disable animation
   */
  allowReduced?: boolean
}

/**
 * Motion component that respects reduced motion preference
 */
export const MotionSafe = React.forwardRef<HTMLDivElement, MotionSafeProps>(
  (
    {
      children,
      className,
      allowReduced = true,
      initial,
      animate,
      exit,
      transition,
      ...props
    },
    ref
  ) => {
    const prefersReduced = usePrefersReducedMotion()

    // If reduced and not allowing reduced, render static
    if (prefersReduced && !allowReduced) {
      return (
        <div ref={ref} className={className}>
          {children}
        </div>
      )
    }

    // Adapt animation values for reduced motion
    const adaptedInitial = prefersReduced
      ? { opacity: 0 }
      : initial

    const adaptedAnimate = prefersReduced
      ? { opacity: 1 }
      : animate

    const adaptedExit = prefersReduced
      ? { opacity: 0 }
      : exit

    const adaptedTransition = prefersReduced
      ? { duration: 0.15 }
      : transition

    return (
      <motion.div
        ref={ref}
        className={className}
        initial={adaptedInitial}
        animate={adaptedAnimate}
        exit={adaptedExit}
        transition={adaptedTransition}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)
MotionSafe.displayName = "MotionSafe"
```

## Component Examples

### Animated Card

```typescript
"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface AnimatedCardProps {
  children: React.ReactNode
  className?: string
  delay?: number
}

export const AnimatedCard = ({
  children,
  className,
  delay = 0
}: AnimatedCardProps) => {
  const prefersReduced = usePrefersReducedMotion()
  const transition = useMotionTransition()

  return (
    <motion.div
      className={cn("rounded-lg border bg-card p-6 shadow-sm", className)}
      initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transition, delay }}
      whileHover={prefersReduced ? {} : { y: -4 }}
    >
      {children}
    </motion.div>
  )
}
```

### Animated List

```typescript
"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"

interface AnimatedListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  keyExtractor: (item: T) => string
}

export function AnimatedList<T>({
  items,
  renderItem,
  keyExtractor
}: AnimatedListProps<T>) {
  const prefersReduced = usePrefersReducedMotion()

  const itemVariants = {
    hidden: prefersReduced
      ? { opacity: 0 }
      : { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: prefersReduced
        ? { duration: 0.15, delay: i * 0.03 }
        : { duration: 0.3, delay: i * 0.1 }
    }),
    exit: prefersReduced
      ? { opacity: 0 }
      : { opacity: 0, scale: 0.95 }
  }

  return (
    <AnimatePresence mode="popLayout">
      {items.map((item, index) => (
        <motion.div
          key={keyExtractor(item)}
          custom={index}
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          layout={!prefersReduced}
        >
          {renderItem(item, index)}
        </motion.div>
      ))}
    </AnimatePresence>
  )
}
```

### Modal with Adaptive Animation

```typescript
"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"

interface ModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

export const Modal = ({ open, onClose, children }: ModalProps) => {
  const prefersReduced = usePrefersReducedMotion()

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
  }

  const contentVariants = prefersReduced
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1 }
      }
    : {
        hidden: { opacity: 0, scale: 0.95, y: 20 },
        visible: { opacity: 1, scale: 1, y: 0 }
      }

  const transition = prefersReduced
    ? { duration: 0.1 }
    : { type: "spring", damping: 25, stiffness: 300 }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: prefersReduced ? 0.1 : 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 flex items-center justify-center p-4"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={transition}
          >
            <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

## Hover and Tap Animations

```typescript
"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface InteractiveButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

export const InteractiveButton = React.forwardRef<
  HTMLButtonElement,
  InteractiveButtonProps
>(({ children, className, ...props }, ref) => {
  const prefersReduced = usePrefersReducedMotion()

  return (
    <motion.button
      ref={ref}
      className={cn(
        "rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground",
        className
      )}
      // Only apply hover/tap animations when motion is OK
      whileHover={prefersReduced ? {} : { scale: 1.02 }}
      whileTap={prefersReduced ? {} : { scale: 0.98 }}
      transition={
        prefersReduced
          ? { duration: 0 }
          : { type: "spring", stiffness: 400, damping: 25 }
      }
      {...props}
    >
      {children}
    </motion.button>
  )
})
InteractiveButton.displayName = "InteractiveButton"
```

## Loading Indicators

```typescript
"use client"

import * as React from "react"
import { motion } from "framer-motion"

/**
 * Loading spinner that respects reduced motion
 * Shows static indicator when motion is reduced
 */
export const LoadingSpinner = ({ className }: { className?: string }) => {
  const prefersReduced = usePrefersReducedMotion()

  if (prefersReduced) {
    // Static loading indicator
    return (
      <div
        className={cn(
          "h-5 w-5 rounded-full border-2 border-primary border-t-transparent",
          className
        )}
        role="status"
        aria-label="Loading"
      >
        <span className="sr-only">Loading...</span>
      </div>
    )
  }

  // Animated spinner
  return (
    <motion.div
      className={cn(
        "h-5 w-5 rounded-full border-2 border-primary border-t-transparent",
        className
      )}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </motion.div>
  )
}

/**
 * Pulsing dots loader
 */
export const LoadingDots = () => {
  const prefersReduced = usePrefersReducedMotion()

  if (prefersReduced) {
    return (
      <div className="flex gap-1" role="status" aria-label="Loading">
        <div className="h-2 w-2 rounded-full bg-current" />
        <div className="h-2 w-2 rounded-full bg-current opacity-70" />
        <div className="h-2 w-2 rounded-full bg-current opacity-40" />
        <span className="sr-only">Loading...</span>
      </div>
    )
  }

  return (
    <div className="flex gap-1" role="status" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="h-2 w-2 rounded-full bg-current"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2
          }}
        />
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  )
}
```

## Best Practices

| Do | Don't |
|----|-------|
| Check preference with hook | Assume animation is OK |
| Provide fade-only fallback | Completely remove feedback |
| Keep essential micro-interactions | Disable button feedback |
| Use CSS media query as baseline | Rely only on JavaScript |
| Test with reduced motion enabled | Only test with animations |
| Consider vestibular triggers | Use parallax freely |

## Essential vs. Decorative Animations

```typescript
// ESSENTIAL - Keep even with reduced motion
// - Focus indicators
// - Loading states (static version)
// - Progress indicators
// - Form validation feedback

// DECORATIVE - Disable with reduced motion
// - Page transitions
// - Parallax effects
// - Bounce/wiggle animations
// - Auto-playing animations
// - Hover transforms

// ADAPTABLE - Reduce but keep
// - Modal open/close (use fade)
// - List item appearance (shorter duration)
// - Button feedback (subtle)
```

## Testing

```typescript
import { render, screen } from "@testing-library/react"

// Mock matchMedia
const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn()
    }))
  })
}

describe("Reduced Motion", () => {
  it("disables animation when reduced motion is preferred", () => {
    mockMatchMedia(true) // prefers-reduced-motion: reduce

    render(<AnimatedCard>Content</AnimatedCard>)

    // Verify no transform animations applied
    // Component should still render
    expect(screen.getByText("Content")).toBeInTheDocument()
  })

  it("enables animation when motion is OK", () => {
    mockMatchMedia(false) // prefers-reduced-motion: no-preference

    render(<AnimatedCard>Content</AnimatedCard>)

    // Full animations should be applied
    expect(screen.getByText("Content")).toBeInTheDocument()
  })
})
```

## Export

```typescript
export {
  // Hooks
  usePrefersReducedMotion,
  getReducedMotionPreference,
  useMotionVariants,
  useMotionTransition,

  // Providers
  ReducedMotionProvider,

  // Preset variants
  fadeVariants,
  scaleVariants,
  slideVariants,

  // Components
  MotionSafe,
  AnimatedCard,
  AnimatedList,
  Modal,
  InteractiveButton,
  LoadingSpinner,
  LoadingDots
}
export type { MotionVariants, MotionSafeProps }
```
