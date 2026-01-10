# Stagger Animation for Lists

Create sequential, choreographed animations where list items animate one after another with configurable delays.

## Overview

Stagger animations create visual flow by:
- Delaying each item's animation start
- Creating cascading reveal effects
- Drawing attention through motion
- Making lists feel dynamic and alive

## Basic Stagger with Variants

### Container + Item Pattern

```typescript
import { motion, type Variants } from "framer-motion"

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,      // Delay between each child
      delayChildren: 0.2         // Initial delay before first child
    }
  }
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24
    }
  }
}

// Usage
<motion.ul
  variants={containerVariants}
  initial="hidden"
  animate="visible"
>
  {items.map((item) => (
    <motion.li key={item.id} variants={itemVariants}>
      {item.content}
    </motion.li>
  ))}
</motion.ul>
```

## Stagger Direction

### Forward, Reverse, and From Center

```typescript
import { motion, type Variants } from "framer-motion"

// Forward stagger (default) - first to last
const forwardContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      staggerDirection: 1  // 1 = forward
    }
  }
}

// Reverse stagger - last to first
const reverseContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      staggerDirection: -1  // -1 = reverse
    }
  }
}

// From center - custom implementation
const fromCenterStagger = (itemCount: number, staggerDelay: number = 0.05) => {
  const center = Math.floor(itemCount / 2)
  return (index: number) => Math.abs(index - center) * staggerDelay
}

// Usage with custom delay function
<motion.div
  initial="hidden"
  animate="visible"
>
  {items.map((item, index) => (
    <motion.div
      key={item.id}
      variants={itemVariants}
      custom={index}
      transition={{
        delay: fromCenterStagger(items.length)(index)
      }}
    >
      {item.content}
    </motion.div>
  ))}
</motion.div>
```

## Stagger Presets

```typescript
/**
 * Pre-configured stagger animations for common patterns
 */
export const staggerPresets = {
  // Quick list reveal
  fast: {
    container: {
      hidden: {},
      visible: {
        transition: { staggerChildren: 0.03 }
      }
    },
    item: {
      hidden: { opacity: 0, y: 10 },
      visible: { opacity: 1, y: 0 }
    }
  },

  // Standard list animation
  default: {
    container: {
      hidden: {},
      visible: {
        transition: { staggerChildren: 0.08 }
      }
    },
    item: {
      hidden: { opacity: 0, y: 20 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { type: "spring", stiffness: 300, damping: 24 }
      }
    }
  },

  // Dramatic reveal
  dramatic: {
    container: {
      hidden: {},
      visible: {
        transition: { staggerChildren: 0.15, delayChildren: 0.3 }
      }
    },
    item: {
      hidden: { opacity: 0, y: 40, scale: 0.9 },
      visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { type: "spring", stiffness: 200, damping: 20 }
      }
    }
  },

  // Slide from left
  slideLeft: {
    container: {
      hidden: {},
      visible: {
        transition: { staggerChildren: 0.06 }
      }
    },
    item: {
      hidden: { opacity: 0, x: -30 },
      visible: {
        opacity: 1,
        x: 0,
        transition: { type: "spring", stiffness: 400, damping: 25 }
      }
    }
  },

  // Slide from right
  slideRight: {
    container: {
      hidden: {},
      visible: {
        transition: { staggerChildren: 0.06 }
      }
    },
    item: {
      hidden: { opacity: 0, x: 30 },
      visible: { opacity: 1, x: 0 }
    }
  },

  // Scale up
  scale: {
    container: {
      hidden: {},
      visible: {
        transition: { staggerChildren: 0.05 }
      }
    },
    item: {
      hidden: { opacity: 0, scale: 0.8 },
      visible: {
        opacity: 1,
        scale: 1,
        transition: { type: "spring", stiffness: 300, damping: 20 }
      }
    }
  },

  // Fade only (subtle)
  fade: {
    container: {
      hidden: {},
      visible: {
        transition: { staggerChildren: 0.04 }
      }
    },
    item: {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.3 } }
    }
  }
} as const

export type StaggerPreset = keyof typeof staggerPresets
```

## Stagger Components

### Generic Stagger List

```typescript
"use client"

import * as React from "react"
import { motion, AnimatePresence, type Variants } from "framer-motion"

interface StaggerListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  keyExtractor: (item: T) => string
  preset?: StaggerPreset
  className?: string
  itemClassName?: string
}

export function StaggerList<T>({
  items,
  renderItem,
  keyExtractor,
  preset = "default",
  className,
  itemClassName
}: StaggerListProps<T>) {
  const variants = staggerPresets[preset]

  return (
    <motion.div
      variants={variants.container}
      initial="hidden"
      animate="visible"
      className={className}
    >
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => (
          <motion.div
            key={keyExtractor(item)}
            variants={variants.item}
            exit={{ opacity: 0, scale: 0.9 }}
            className={itemClassName}
          >
            {renderItem(item, index)}
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  )
}
```

### Stagger Grid

```typescript
"use client"

import * as React from "react"
import { motion, type Variants } from "framer-motion"

const gridContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.1
    }
  }
}

const gridItemVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 350,
      damping: 25
    }
  }
}

interface StaggerGridProps<T> {
  items: T[]
  renderItem: (item: T) => React.ReactNode
  keyExtractor: (item: T) => string
  columns?: 2 | 3 | 4 | 5 | 6
  gap?: 2 | 3 | 4 | 6 | 8
}

export function StaggerGrid<T>({
  items,
  renderItem,
  keyExtractor,
  columns = 3,
  gap = 4
}: StaggerGridProps<T>) {
  const gridCols = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
    5: "grid-cols-5",
    6: "grid-cols-6"
  }

  const gapSize = {
    2: "gap-2",
    3: "gap-3",
    4: "gap-4",
    6: "gap-6",
    8: "gap-8"
  }

  return (
    <motion.div
      variants={gridContainerVariants}
      initial="hidden"
      animate="visible"
      className={`grid ${gridCols[columns]} ${gapSize[gap]}`}
    >
      {items.map((item) => (
        <motion.div key={keyExtractor(item)} variants={gridItemVariants}>
          {renderItem(item)}
        </motion.div>
      ))}
    </motion.div>
  )
}
```

### Stagger Text

```typescript
"use client"

import * as React from "react"
import { motion, type Variants } from "framer-motion"

const wordVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24
    }
  }
}

const charVariants: Variants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0
  }
}

interface StaggerTextProps {
  text: string
  mode?: "words" | "characters"
  staggerDelay?: number
  className?: string
  as?: "h1" | "h2" | "h3" | "p" | "span"
}

export const StaggerText = ({
  text,
  mode = "words",
  staggerDelay = 0.05,
  className,
  as: Component = "p"
}: StaggerTextProps) => {
  const items = mode === "words" ? text.split(" ") : text.split("")
  const separator = mode === "words" ? "\u00A0" : ""

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: staggerDelay
      }
    }
  }

  return (
    <motion.span
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={`inline-flex flex-wrap ${className}`}
      aria-label={text}
    >
      {items.map((item, index) => (
        <motion.span
          key={index}
          variants={mode === "words" ? wordVariants : charVariants}
          className="inline-block"
        >
          {item}
          {separator}
        </motion.span>
      ))}
    </motion.span>
  )
}

// Usage
<StaggerText
  text="Welcome to our platform"
  mode="words"
  as="h1"
  className="text-4xl font-bold"
/>
```

### Navigation Menu Stagger

```typescript
"use client"

import * as React from "react"
import { motion, AnimatePresence, type Variants } from "framer-motion"

const menuVariants: Variants = {
  closed: {
    opacity: 0,
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1  // Reverse on close
    }
  },
  open: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.1
    }
  }
}

const itemVariants: Variants = {
  closed: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.2 }
  },
  open: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25
    }
  }
}

interface MenuItem {
  id: string
  label: string
  href: string
  icon?: React.ReactNode
}

interface StaggerMenuProps {
  items: MenuItem[]
  isOpen: boolean
  onClose: () => void
}

export const StaggerMenu = ({ items, isOpen, onClose }: StaggerMenuProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Menu */}
          <motion.nav
            variants={menuVariants}
            initial="closed"
            animate="open"
            exit="closed"
            className="fixed left-0 top-0 h-full w-64 bg-background shadow-xl z-50 p-6"
          >
            <ul className="space-y-2 mt-12">
              {items.map((item) => (
                <motion.li key={item.id} variants={itemVariants}>
                  <a
                    href={item.href}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent transition-colors"
                  >
                    {item.icon}
                    <span className="font-medium">{item.label}</span>
                  </a>
                </motion.li>
              ))}
            </ul>
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  )
}
```

## In-View Stagger

### Trigger on Scroll

```typescript
"use client"

import * as React from "react"
import { motion, useInView, type Variants } from "framer-motion"

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1
    }
  }
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24
    }
  }
}

interface InViewStaggerProps<T> {
  items: T[]
  renderItem: (item: T) => React.ReactNode
  keyExtractor: (item: T) => string
  className?: string
  once?: boolean
  threshold?: number
}

export function InViewStagger<T>({
  items,
  renderItem,
  keyExtractor,
  className,
  once = true,
  threshold = 0.2
}: InViewStaggerProps<T>) {
  const ref = React.useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once, amount: threshold })

  return (
    <motion.div
      ref={ref}
      variants={containerVariants}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      className={className}
    >
      {items.map((item) => (
        <motion.div key={keyExtractor(item)} variants={itemVariants}>
          {renderItem(item)}
        </motion.div>
      ))}
    </motion.div>
  )
}
```

## Dynamic Stagger

### Based on Item Count

```typescript
"use client"

import * as React from "react"
import { motion, type Variants } from "framer-motion"

/**
 * Calculate optimal stagger delay based on item count
 * Prevents too-slow animations for small lists
 * and too-fast animations for large lists
 */
const calculateStaggerDelay = (itemCount: number): number => {
  const minDelay = 0.03  // Minimum delay per item
  const maxDelay = 0.12  // Maximum delay per item
  const targetDuration = 0.6  // Target total stagger duration

  const idealDelay = targetDuration / itemCount

  return Math.max(minDelay, Math.min(maxDelay, idealDelay))
}

interface DynamicStaggerListProps<T> {
  items: T[]
  renderItem: (item: T) => React.ReactNode
  keyExtractor: (item: T) => string
}

export function DynamicStaggerList<T>({
  items,
  renderItem,
  keyExtractor
}: DynamicStaggerListProps<T>) {
  const staggerDelay = calculateStaggerDelay(items.length)

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: staggerDelay }
    }
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {items.map((item) => (
        <motion.div key={keyExtractor(item)} variants={itemVariants}>
          {renderItem(item)}
        </motion.div>
      ))}
    </motion.div>
  )
}
```

## Reduced Motion Support

```typescript
"use client"

import * as React from "react"
import { motion, type Variants } from "framer-motion"
import { usePrefersReducedMotion } from "../accessibility/reduced-motion"

interface AccessibleStaggerListProps<T> {
  items: T[]
  renderItem: (item: T) => React.ReactNode
  keyExtractor: (item: T) => string
}

export function AccessibleStaggerList<T>({
  items,
  renderItem,
  keyExtractor
}: AccessibleStaggerListProps<T>) {
  const prefersReduced = usePrefersReducedMotion()

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: prefersReduced ? 0 : 0.08
      }
    }
  }

  const itemVariants: Variants = prefersReduced
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.15 } }
      }
    : {
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { type: "spring", stiffness: 300, damping: 24 }
        }
      }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {items.map((item) => (
        <motion.div key={keyExtractor(item)} variants={itemVariants}>
          {renderItem(item)}
        </motion.div>
      ))}
    </motion.div>
  )
}
```

## Stagger Hook

```typescript
"use client"

import * as React from "react"
import { type Variants } from "framer-motion"

interface UseStaggerOptions {
  staggerDelay?: number
  initialDelay?: number
  direction?: "forward" | "reverse"
  preset?: StaggerPreset
}

export const useStagger = (options: UseStaggerOptions = {}) => {
  const {
    staggerDelay = 0.08,
    initialDelay = 0,
    direction = "forward",
    preset
  } = options

  const variants = React.useMemo(() => {
    if (preset) {
      return staggerPresets[preset]
    }

    const container: Variants = {
      hidden: {},
      visible: {
        transition: {
          staggerChildren: staggerDelay,
          delayChildren: initialDelay,
          staggerDirection: direction === "reverse" ? -1 : 1
        }
      }
    }

    const item: Variants = {
      hidden: { opacity: 0, y: 20 },
      visible: {
        opacity: 1,
        y: 0,
        transition: {
          type: "spring",
          stiffness: 300,
          damping: 24
        }
      }
    }

    return { container, item }
  }, [staggerDelay, initialDelay, direction, preset])

  return {
    containerVariants: variants.container,
    itemVariants: variants.item
  }
}

// Usage
const MyList = () => {
  const { containerVariants, itemVariants } = useStagger({
    staggerDelay: 0.1,
    direction: "forward"
  })

  return (
    <motion.ul variants={containerVariants} initial="hidden" animate="visible">
      {items.map((item) => (
        <motion.li key={item.id} variants={itemVariants}>
          {item.content}
        </motion.li>
      ))}
    </motion.ul>
  )
}
```

## Best Practices

| Do | Don't |
|----|-------|
| Use appropriate delay for list size | Same delay for 5 vs 50 items |
| Reverse stagger on exit | Let exit be jarring |
| Support reduced motion | Ignore accessibility |
| Use spring for natural feel | Use linear timing |
| Keep stagger subtle | Make users wait too long |
| Test with varying list sizes | Only test with mock data |

## Export

```typescript
export {
  // Presets
  staggerPresets,

  // Components
  StaggerList,
  StaggerGrid,
  StaggerText,
  StaggerMenu,
  InViewStagger,
  DynamicStaggerList,
  AccessibleStaggerList,

  // Hooks
  useStagger,

  // Utilities
  calculateStaggerDelay,
  fromCenterStagger
}
export type { StaggerPreset }
```
