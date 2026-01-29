# Animation Propagation Pattern

Coordinate parent-child animations where parent state changes cascade to child elements using variants and custom properties.

## Overview

Propagation patterns enable:
- Parent hover affecting child elements
- Staggered child animations on parent mount
- Coordinated state transitions
- Complex choreographed sequences

## Variant Propagation

### Basic Concept

```typescript
import { motion, type Variants } from "framer-motion"

// Parent variants define states
const parentVariants: Variants = {
  initial: {},
  hover: {}
}

// Child variants respond to parent state changes
const childVariants: Variants = {
  initial: { opacity: 0.7, y: 0 },
  hover: { opacity: 1, y: -4 }
}

// Variants propagate automatically to children with matching state names
<motion.div variants={parentVariants} initial="initial" whileHover="hover">
  <motion.span variants={childVariants}>
    This animates when parent is hovered
  </motion.span>
</motion.div>
```

## Card Hover Effects

### Interactive Card

```typescript
"use client"

import * as React from "react"
import { motion, type Variants } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

const cardVariants: Variants = {
  initial: {
    scale: 1,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
  },
  hover: {
    scale: 1.02,
    boxShadow: "0 10px 40px rgba(0,0,0,0.15)"
  }
}

const imageVariants: Variants = {
  initial: { scale: 1 },
  hover: { scale: 1.1 }
}

const titleVariants: Variants = {
  initial: { x: 0 },
  hover: { x: 4 }
}

const arrowVariants: Variants = {
  initial: { x: 0, opacity: 0 },
  hover: { x: 8, opacity: 1 }
}

const overlayVariants: Variants = {
  initial: { opacity: 0 },
  hover: { opacity: 1 }
}

interface HoverCardProps {
  title: string
  description: string
  image: string
  href: string
}

export const HoverCard = ({
  title,
  description,
  image,
  href
}: HoverCardProps) => {
  return (
    <motion.a
      href={href}
      variants={cardVariants}
      initial="initial"
      whileHover="hover"
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="block rounded-xl border bg-card overflow-hidden"
    >
      {/* Image with zoom */}
      <div className="relative h-48 overflow-hidden">
        <motion.img
          variants={imageVariants}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          src={image}
          alt={title}
          className="w-full h-full object-cover"
        />
        <motion.div
          variants={overlayVariants}
          className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"
        />
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="flex items-center gap-2">
          <motion.h3
            variants={titleVariants}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="text-lg font-semibold"
          >
            {title}
          </motion.h3>
          <motion.span
            variants={arrowVariants}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <ArrowRight className="h-4 w-4" />
          </motion.span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
    </motion.a>
  )
}
```

### Feature Card with Icon Animation

```typescript
"use client"

import * as React from "react"
import { motion, type Variants } from "framer-motion"
import { type LucideIcon } from "lucide-react"

const containerVariants: Variants = {
  initial: {},
  hover: {}
}

const iconContainerVariants: Variants = {
  initial: {
    backgroundColor: "hsl(var(--muted))",
    scale: 1
  },
  hover: {
    backgroundColor: "hsl(var(--primary))",
    scale: 1.1
  }
}

const iconVariants: Variants = {
  initial: {
    rotate: 0,
    color: "hsl(var(--muted-foreground))"
  },
  hover: {
    rotate: [0, -10, 10, 0],
    color: "hsl(var(--primary-foreground))"
  }
}

const textVariants: Variants = {
  initial: { y: 0 },
  hover: { y: -2 }
}

interface FeatureCardProps {
  icon: LucideIcon
  title: string
  description: string
}

export const FeatureCard = ({
  icon: Icon,
  title,
  description
}: FeatureCardProps) => {
  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      whileHover="hover"
      className="rounded-xl border bg-card p-6 cursor-pointer"
    >
      <motion.div
        variants={iconContainerVariants}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="w-12 h-12 rounded-lg flex items-center justify-center"
      >
        <motion.div variants={iconVariants}>
          <Icon className="h-6 w-6" />
        </motion.div>
      </motion.div>

      <motion.h3
        variants={textVariants}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="mt-4 text-lg font-semibold"
      >
        {title}
      </motion.h3>

      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </motion.div>
  )
}
```

## Staggered Children

### Stagger on Mount

```typescript
"use client"

import * as React from "react"
import { motion, type Variants } from "framer-motion"

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
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

interface StaggeredListProps {
  items: React.ReactNode[]
}

export const StaggeredList = ({ items }: StaggeredListProps) => {
  return (
    <motion.ul
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-3"
    >
      {items.map((item, index) => (
        <motion.li key={index} variants={itemVariants}>
          {item}
        </motion.li>
      ))}
    </motion.ul>
  )
}
```

### Stagger on Hover

```typescript
"use client"

import * as React from "react"
import { motion, type Variants } from "framer-motion"

const menuVariants: Variants = {
  closed: {},
  open: {
    transition: {
      staggerChildren: 0.05,
      staggerDirection: 1
    }
  }
}

const itemVariants: Variants = {
  closed: { x: -20, opacity: 0 },
  open: {
    x: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25
    }
  }
}

interface DropdownMenuProps {
  items: { label: string; href: string }[]
  isOpen: boolean
}

export const AnimatedDropdown = ({ items, isOpen }: DropdownMenuProps) => {
  return (
    <motion.div
      variants={menuVariants}
      initial="closed"
      animate={isOpen ? "open" : "closed"}
      className="absolute top-full mt-2 w-48 rounded-lg border bg-popover shadow-lg overflow-hidden"
    >
      {items.map((item) => (
        <motion.a
          key={item.href}
          href={item.href}
          variants={itemVariants}
          className="block px-4 py-2 text-sm hover:bg-accent"
        >
          {item.label}
        </motion.a>
      ))}
    </motion.div>
  )
}
```

## Custom Properties

### Using Custom Prop

```typescript
"use client"

import * as React from "react"
import { motion, type Variants } from "framer-motion"

// Child variants can access custom prop from parent
const dotVariants: Variants = {
  initial: (i: number) => ({
    scale: 0,
    opacity: 0
  }),
  animate: (i: number) => ({
    scale: 1,
    opacity: 1,
    transition: {
      delay: i * 0.1,
      type: "spring",
      stiffness: 400,
      damping: 20
    }
  })
}

interface LoadingDotsProps {
  count?: number
}

export const LoadingDots = ({ count = 3 }: LoadingDotsProps) => {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      className="flex gap-1"
    >
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          custom={i}
          variants={dotVariants}
          className="w-2 h-2 rounded-full bg-primary"
        />
      ))}
    </motion.div>
  )
}
```

### Propagating Hover State to Distant Children

```typescript
"use client"

import * as React from "react"
import { motion, type Variants } from "framer-motion"

const cardVariants: Variants = {
  rest: {},
  hover: {}
}

// Button slides in from bottom
const buttonVariants: Variants = {
  rest: { y: 20, opacity: 0 },
  hover: { y: 0, opacity: 1 }
}

// Badge pulses
const badgeVariants: Variants = {
  rest: { scale: 1 },
  hover: {
    scale: [1, 1.1, 1],
    transition: { repeat: Infinity, duration: 1 }
  }
}

// Price emphasizes
const priceVariants: Variants = {
  rest: { scale: 1, color: "hsl(var(--foreground))" },
  hover: { scale: 1.1, color: "hsl(var(--primary))" }
}

interface ProductCardProps {
  name: string
  price: number
  image: string
  badge?: string
}

export const ProductCard = ({
  name,
  price,
  image,
  badge
}: ProductCardProps) => {
  return (
    <motion.div
      variants={cardVariants}
      initial="rest"
      whileHover="hover"
      className="relative rounded-xl border bg-card overflow-hidden group"
    >
      {/* Badge */}
      {badge && (
        <motion.span
          variants={badgeVariants}
          className="absolute top-3 left-3 z-10 px-2 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium"
        >
          {badge}
        </motion.span>
      )}

      <img
        src={image}
        alt={name}
        className="w-full h-48 object-cover"
      />

      <div className="p-4">
        <h3 className="font-semibold">{name}</h3>
        <motion.span
          variants={priceVariants}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="text-lg font-bold"
        >
          ${price}
        </motion.span>
      </div>

      {/* Add to cart button - slides in */}
      <motion.div
        variants={buttonVariants}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="absolute bottom-4 left-4 right-4"
      >
        <button className="w-full py-2 rounded-lg bg-primary text-primary-foreground font-medium">
          Add to Cart
        </button>
      </motion.div>
    </motion.div>
  )
}
```

## Nested Propagation

### Multi-Level Hierarchy

```typescript
"use client"

import * as React from "react"
import { motion, type Variants } from "framer-motion"

const level1Variants: Variants = {
  collapsed: {},
  expanded: {}
}

const level2Variants: Variants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: {
    height: "auto",
    opacity: 1,
    transition: {
      height: { type: "spring", stiffness: 300, damping: 30 },
      opacity: { duration: 0.2 },
      staggerChildren: 0.05,
      delayChildren: 0.1
    }
  }
}

const level3Variants: Variants = {
  collapsed: { x: -10, opacity: 0 },
  expanded: { x: 0, opacity: 1 }
}

interface TreeNode {
  id: string
  label: string
  children?: TreeNode[]
}

interface TreeItemProps {
  node: TreeNode
  level?: number
}

const TreeItem = ({ node, level = 0 }: TreeItemProps) => {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const hasChildren = node.children && node.children.length > 0

  return (
    <motion.div
      variants={level === 0 ? level1Variants : level3Variants}
      animate={isExpanded ? "expanded" : "collapsed"}
      className="ml-4"
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 py-1 hover:text-primary"
      >
        {hasChildren && (
          <motion.span
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            ▶
          </motion.span>
        )}
        {node.label}
      </button>

      {hasChildren && (
        <motion.div
          variants={level2Variants}
          initial="collapsed"
          animate={isExpanded ? "expanded" : "collapsed"}
        >
          {node.children!.map((child) => (
            <TreeItem key={child.id} node={child} level={level + 1} />
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}

export const AnimatedTree = ({ data }: { data: TreeNode[] }) => (
  <div className="py-2">
    {data.map((node) => (
      <TreeItem key={node.id} node={node} />
    ))}
  </div>
)
```

## Context-Based Propagation

### Hover Context

```typescript
"use client"

import * as React from "react"
import { motion } from "framer-motion"

interface HoverContextValue {
  isHovered: boolean
}

const HoverContext = React.createContext<HoverContextValue>({
  isHovered: false
})

export const useHoverContext = () => React.useContext(HoverContext)

interface HoverProviderProps {
  children: React.ReactNode
  className?: string
}

export const HoverProvider = ({ children, className }: HoverProviderProps) => {
  const [isHovered, setIsHovered] = React.useState(false)

  return (
    <HoverContext.Provider value={{ isHovered }}>
      <motion.div
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        className={className}
      >
        {children}
      </motion.div>
    </HoverContext.Provider>
  )
}

// Consumer components
export const HoverScale = ({
  children,
  scale = 1.05
}: {
  children: React.ReactNode
  scale?: number
}) => {
  const { isHovered } = useHoverContext()

  return (
    <motion.div animate={{ scale: isHovered ? scale : 1 }}>
      {children}
    </motion.div>
  )
}

export const HoverReveal = ({ children }: { children: React.ReactNode }) => {
  const { isHovered } = useHoverContext()

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{
        opacity: isHovered ? 1 : 0,
        y: isHovered ? 0 : 10
      }}
    >
      {children}
    </motion.div>
  )
}

// Usage
<HoverProvider className="rounded-xl border p-4">
  <HoverScale>
    <img src="..." alt="..." />
  </HoverScale>
  <h3>Title</h3>
  <HoverReveal>
    <button>Action</button>
  </HoverReveal>
</HoverProvider>
```

## Orchestration Pattern

### Complex Choreography

```typescript
"use client"

import * as React from "react"
import { motion, type Variants, useAnimation } from "framer-motion"

const orchestratedVariants = {
  container: {
    hidden: {},
    visible: {
      transition: {
        delayChildren: 0.3,
        staggerChildren: 0.2
      }
    }
  },
  image: {
    hidden: { scale: 1.2, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  },
  title: {
    hidden: { y: 40, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 100, damping: 15 }
    }
  },
  description: {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.4 }
    }
  },
  cta: {
    hidden: { scale: 0.8, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: { type: "spring", stiffness: 300, damping: 20 }
    }
  }
}

interface HeroSectionProps {
  title: string
  description: string
  image: string
  ctaText: string
  onCtaClick: () => void
}

export const OrchestratedHero = ({
  title,
  description,
  image,
  ctaText,
  onCtaClick
}: HeroSectionProps) => {
  return (
    <motion.section
      variants={orchestratedVariants.container}
      initial="hidden"
      animate="visible"
      className="relative min-h-[600px] flex items-center"
    >
      {/* Background Image */}
      <motion.div
        variants={orchestratedVariants.image}
        className="absolute inset-0 overflow-hidden"
      >
        <img
          src={image}
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/50" />
      </motion.div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4">
        <motion.h1
          variants={orchestratedVariants.title}
          className="text-5xl font-bold text-white max-w-2xl"
        >
          {title}
        </motion.h1>

        <motion.p
          variants={orchestratedVariants.description}
          className="mt-6 text-xl text-white/80 max-w-xl"
        >
          {description}
        </motion.p>

        <motion.button
          variants={orchestratedVariants.cta}
          onClick={onCtaClick}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="mt-8 px-8 py-3 rounded-lg bg-white text-black font-semibold"
        >
          {ctaText}
        </motion.button>
      </div>
    </motion.section>
  )
}
```

## Best Practices

| Do | Don't |
|----|-------|
| Use matching variant names | Mix arbitrary animate props |
| Define clear state hierarchy | Overcomplicate propagation |
| Use custom for dynamic values | Hardcode delays in variants |
| Leverage staggerChildren | Manually stagger each child |
| Keep transitions consistent | Mix different easing per child |

## Export

```typescript
export {
  // Components
  HoverCard,
  FeatureCard,
  StaggeredList,
  AnimatedDropdown,
  LoadingDots,
  ProductCard,
  AnimatedTree,
  OrchestratedHero,

  // Context
  HoverProvider,
  HoverContext,
  useHoverContext,
  HoverScale,
  HoverReveal,

  // Variant presets
  cardVariants,
  itemVariants,
  containerVariants
}
```
