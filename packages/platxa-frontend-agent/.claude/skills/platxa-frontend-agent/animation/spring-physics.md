# Spring Physics for Natural Motion

Implement physics-based spring animations for natural, organic motion that responds to user interaction.

## Overview

Spring animations simulate real-world physics:
- Objects have mass and momentum
- Motion overshoots and settles naturally
- Velocity carries between interactions
- No fixed duration - settles when energy dissipates

## Why Springs Over Easing

| Easing (CSS) | Spring (Physics) |
|--------------|------------------|
| Fixed duration | Natural settling |
| Feels mechanical | Feels organic |
| No momentum | Velocity preserved |
| Abrupt interrupts | Smooth interrupts |
| Limited expressiveness | Highly tunable |

## Framer Motion Spring Basics

### Spring Parameters

```typescript
import { type Spring } from "framer-motion"

interface SpringConfig {
  /**
   * Stiffness of the spring
   * Higher = faster, snappier
   * @default 100
   */
  stiffness: number

  /**
   * Resistance to motion
   * Higher = less oscillation
   * @default 10
   */
  damping: number

  /**
   * Mass of the object
   * Higher = more inertia, slower
   * @default 1
   */
  mass: number

  /**
   * Initial velocity (units/second)
   * @default 0
   */
  velocity: number

  /**
   * End animation when velocity is below this
   * @default 0.01
   */
  restDelta: number

  /**
   * End animation when speed is below this
   * @default 0.01
   */
  restSpeed: number
}
```

### Spring Types

```typescript
// Quick and snappy (UI feedback)
const snappySpring: Spring = {
  type: "spring",
  stiffness: 400,
  damping: 30
}

// Smooth and gentle (page transitions)
const smoothSpring: Spring = {
  type: "spring",
  stiffness: 100,
  damping: 20
}

// Bouncy (playful elements)
const bouncySpring: Spring = {
  type: "spring",
  stiffness: 300,
  damping: 10
}

// Slow and heavy (modals, drawers)
const heavySpring: Spring = {
  type: "spring",
  stiffness: 200,
  damping: 30,
  mass: 1.5
}
```

## Spring Presets

```typescript
/**
 * Curated spring presets for common use cases
 */
export const springPresets = {
  // UI Interactions
  button: { type: "spring", stiffness: 400, damping: 25 },
  toggle: { type: "spring", stiffness: 500, damping: 30 },
  switch: { type: "spring", stiffness: 700, damping: 35 },

  // Reveals and appearances
  fadeIn: { type: "spring", stiffness: 300, damping: 30 },
  slideIn: { type: "spring", stiffness: 400, damping: 35 },
  scaleIn: { type: "spring", stiffness: 350, damping: 25 },

  // Overlays
  modal: { type: "spring", stiffness: 300, damping: 30 },
  drawer: { type: "spring", stiffness: 400, damping: 40 },
  dropdown: { type: "spring", stiffness: 500, damping: 30 },
  tooltip: { type: "spring", stiffness: 600, damping: 35 },

  // Feedback
  error: { type: "spring", stiffness: 600, damping: 15 }, // Shaky
  success: { type: "spring", stiffness: 400, damping: 20 },

  // Drag and drop
  dragRelease: { type: "spring", stiffness: 500, damping: 30 },
  snapBack: { type: "spring", stiffness: 600, damping: 35 },

  // Slow and cinematic
  hero: { type: "spring", stiffness: 100, damping: 20 },
  parallax: { type: "spring", stiffness: 50, damping: 15 },

  // Micro-interactions
  hover: { type: "spring", stiffness: 400, damping: 17 },
  press: { type: "spring", stiffness: 600, damping: 30 },
  focus: { type: "spring", stiffness: 450, damping: 25 }
} as const

export type SpringPreset = keyof typeof springPresets
```

## Spring Hook

```typescript
"use client"

import * as React from "react"
import { useSpring, animated, type SpringConfig } from "@react-spring/web"

/**
 * Custom hook for spring animations with presets
 */
export const useSpringPreset = (
  preset: SpringPreset,
  from: Record<string, number>,
  to: Record<string, number>
) => {
  const config = springPresets[preset]

  return useSpring({
    from,
    to,
    config: {
      tension: config.stiffness,
      friction: config.damping
    }
  })
}

// Framer Motion version
import { useSpring as useFramerSpring, type MotionValue } from "framer-motion"

export const useMotionSpring = (
  value: MotionValue<number>,
  preset: SpringPreset = "button"
) => {
  const config = springPresets[preset]

  return useFramerSpring(value, {
    stiffness: config.stiffness,
    damping: config.damping
  })
}
```

## Spring Components

### Spring-Animated Button

```typescript
"use client"

import * as React from "react"
import { motion, useSpring, useTransform } from "framer-motion"
import { cn } from "@/lib/utils"

interface SpringButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  variant?: "default" | "bouncy" | "snappy"
}

export const SpringButton = React.forwardRef<HTMLButtonElement, SpringButtonProps>(
  ({ children, className, variant = "default", ...props }, ref) => {
    const scale = useSpring(1, springPresets[
      variant === "bouncy" ? "hover" : variant === "snappy" ? "press" : "button"
    ])

    return (
      <motion.button
        ref={ref}
        className={cn(
          "rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          className
        )}
        style={{ scale }}
        onHoverStart={() => scale.set(1.02)}
        onHoverEnd={() => scale.set(1)}
        onTapStart={() => scale.set(0.98)}
        onTap={() => scale.set(1)}
        onTapCancel={() => scale.set(1)}
        {...props}
      >
        {children}
      </motion.button>
    )
  }
)
SpringButton.displayName = "SpringButton"
```

### Spring Card Hover

```typescript
"use client"

import * as React from "react"
import { motion, useSpring, useMotionValue, useTransform } from "framer-motion"

interface SpringCardProps {
  children: React.ReactNode
  className?: string
}

export const SpringCard = ({ children, className }: SpringCardProps) => {
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  // Spring-based rotation following mouse
  const rotateX = useSpring(useTransform(y, [-100, 100], [10, -10]), {
    stiffness: 300,
    damping: 30
  })
  const rotateY = useSpring(useTransform(x, [-100, 100], [-10, 10]), {
    stiffness: 300,
    damping: 30
  })

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    x.set(event.clientX - centerX)
    y.set(event.clientY - centerY)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      className={cn("rounded-lg border bg-card p-6 shadow-sm", className)}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d"
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </motion.div>
  )
}
```

### Spring Modal

```typescript
"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"

interface SpringModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

export const SpringModal = ({ open, onClose, children }: SpringModalProps) => {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Content with spring animation */}
          <motion.div
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={springPresets.modal}
          >
            <div className="rounded-lg bg-background p-6 shadow-xl">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

### Spring Drawer

```typescript
"use client"

import * as React from "react"
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion"

interface SpringDrawerProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  side?: "left" | "right"
}

export const SpringDrawer = ({
  open,
  onClose,
  children,
  side = "right"
}: SpringDrawerProps) => {
  const isRight = side === "right"

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className={cn(
              "fixed top-0 z-50 h-full w-80 bg-background shadow-xl",
              isRight ? "right-0" : "left-0"
            )}
            initial={{ x: isRight ? "100%" : "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: isRight ? "100%" : "-100%" }}
            transition={springPresets.drawer}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

## Spring Gestures

### Drag with Spring Release

```typescript
"use client"

import * as React from "react"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"

interface DraggableCardProps {
  children: React.ReactNode
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
}

export const DraggableCard = ({
  children,
  onSwipeLeft,
  onSwipeRight
}: DraggableCardProps) => {
  const x = useMotionValue(0)

  // Spring-smoothed values
  const springX = useSpring(x, springPresets.dragRelease)
  const rotate = useTransform(springX, [-200, 200], [-15, 15])
  const opacity = useTransform(springX, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5])

  const handleDragEnd = () => {
    const xVal = x.get()
    if (xVal > 100) {
      onSwipeRight?.()
    } else if (xVal < -100) {
      onSwipeLeft?.()
    }
  }

  return (
    <motion.div
      className="cursor-grab active:cursor-grabbing"
      style={{ x: springX, rotate, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
    >
      <div className="rounded-lg border bg-card p-6 shadow-lg">
        {children}
      </div>
    </motion.div>
  )
}
```

### Pull-to-Refresh

```typescript
"use client"

import * as React from "react"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"

interface PullToRefreshProps {
  children: React.ReactNode
  onRefresh: () => Promise<void>
}

export const PullToRefresh = ({ children, onRefresh }: PullToRefreshProps) => {
  const y = useMotionValue(0)
  const springY = useSpring(y, springPresets.snapBack)
  const [isRefreshing, setIsRefreshing] = React.useState(false)

  const pullProgress = useTransform(springY, [0, 80], [0, 1])
  const spinnerRotate = useTransform(springY, [0, 80], [0, 360])

  const handleDragEnd = async () => {
    if (y.get() > 80 && !isRefreshing) {
      setIsRefreshing(true)
      await onRefresh()
      setIsRefreshing(false)
    }
  }

  return (
    <div className="overflow-hidden">
      {/* Pull indicator */}
      <motion.div
        className="flex justify-center py-2"
        style={{ opacity: pullProgress }}
      >
        <motion.div
          className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent"
          style={{ rotate: spinnerRotate }}
          animate={isRefreshing ? { rotate: 360 } : {}}
          transition={isRefreshing ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
        />
      </motion.div>

      {/* Content */}
      <motion.div
        style={{ y: springY }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.5, bottom: 0 }}
        onDragEnd={handleDragEnd}
      >
        {children}
      </motion.div>
    </div>
  )
}
```

## Spring Lists

### Staggered Spring List

```typescript
"use client"

import * as React from "react"
import { motion } from "framer-motion"

interface StaggeredListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  keyExtractor: (item: T) => string
}

export function StaggeredSpringList<T>({
  items,
  renderItem,
  keyExtractor
}: StaggeredListProps<T>) {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: springPresets.slideIn
    }
  }

  return (
    <motion.ul
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-2"
    >
      {items.map((data, index) => (
        <motion.li key={keyExtractor(data)} variants={item}>
          {renderItem(data, index)}
        </motion.li>
      ))}
    </motion.ul>
  )
}
```

## Spring Value Animation

### Animated Counter

```typescript
"use client"

import * as React from "react"
import { motion, useSpring, useTransform } from "framer-motion"

interface SpringCounterProps {
  value: number
  className?: string
}

export const SpringCounter = ({ value, className }: SpringCounterProps) => {
  const spring = useSpring(0, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  })

  React.useEffect(() => {
    spring.set(value)
  }, [spring, value])

  const display = useTransform(spring, (current) =>
    Math.round(current).toLocaleString()
  )

  return (
    <motion.span className={className}>
      {display}
    </motion.span>
  )
}

// Usage
<SpringCounter value={1234567} className="text-4xl font-bold" />
```

### Progress Bar

```typescript
"use client"

import * as React from "react"
import { motion, useSpring } from "framer-motion"

interface SpringProgressProps {
  value: number // 0-100
  className?: string
}

export const SpringProgress = ({ value, className }: SpringProgressProps) => {
  const width = useSpring(0, {
    stiffness: 100,
    damping: 20
  })

  React.useEffect(() => {
    width.set(value)
  }, [width, value])

  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <motion.div
        className="h-full rounded-full bg-primary"
        style={{ width: useTransform(width, (v) => `${v}%`) }}
      />
    </div>
  )
}
```

## Spring Configuration Guide

### Tuning Springs

```typescript
/**
 * Spring tuning guide:
 *
 * STIFFNESS (tension)
 * - Low (50-150): Slow, floaty motion
 * - Medium (200-400): Balanced, natural
 * - High (500+): Quick, snappy
 *
 * DAMPING (friction)
 * - Low (5-15): More oscillation, bouncy
 * - Medium (20-30): Slight overshoot
 * - High (35+): No overshoot, direct
 *
 * MASS
 * - Low (0.5): Light, responsive
 * - Default (1): Normal
 * - High (1.5+): Heavy, sluggish
 *
 * Common combinations:
 * - Snappy UI: high stiffness, high damping
 * - Bouncy: medium stiffness, low damping
 * - Smooth: low stiffness, medium damping
 * - Heavy: any stiffness, high mass
 */

// Interactive spring tuner for development
export const useSpringTuner = () => {
  const [config, setConfig] = React.useState({
    stiffness: 300,
    damping: 30,
    mass: 1
  })

  const DevPanel = () => (
    <div className="fixed bottom-4 right-4 rounded-lg bg-card p-4 shadow-lg">
      <h3 className="font-semibold mb-2">Spring Tuner</h3>
      <label className="block text-sm">
        Stiffness: {config.stiffness}
        <input
          type="range"
          min="50"
          max="700"
          value={config.stiffness}
          onChange={(e) => setConfig(c => ({ ...c, stiffness: +e.target.value }))}
          className="w-full"
        />
      </label>
      <label className="block text-sm mt-2">
        Damping: {config.damping}
        <input
          type="range"
          min="5"
          max="50"
          value={config.damping}
          onChange={(e) => setConfig(c => ({ ...c, damping: +e.target.value }))}
          className="w-full"
        />
      </label>
      <label className="block text-sm mt-2">
        Mass: {config.mass}
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.1"
          value={config.mass}
          onChange={(e) => setConfig(c => ({ ...c, mass: +e.target.value }))}
          className="w-full"
        />
      </label>
      <code className="block mt-2 text-xs bg-muted p-2 rounded">
        {JSON.stringify({ type: "spring", ...config })}
      </code>
    </div>
  )

  return { config, DevPanel }
}
```

## Best Practices

| Do | Don't |
|----|-------|
| Use springs for interactive elements | Use linear timing |
| Match spring feel to content | One spring for everything |
| Interrupt animations smoothly | Let animations fight |
| Test on low-power devices | Assume 60fps everywhere |
| Reduce motion when requested | Ignore accessibility |
| Use presets for consistency | Random spring values |

## Export

```typescript
export {
  // Presets
  springPresets,

  // Hooks
  useSpringPreset,
  useMotionSpring,
  useSpringTuner,

  // Components
  SpringButton,
  SpringCard,
  SpringModal,
  SpringDrawer,
  DraggableCard,
  PullToRefresh,
  StaggeredSpringList,
  SpringCounter,
  SpringProgress
}
export type { SpringPreset, SpringConfig }
```
