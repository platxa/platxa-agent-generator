# Hover Animations with Framer Motion

Subtle hover animations provide visual feedback and make interfaces feel responsive. Use `whileHover` for declarative hover states with smooth spring-based transitions.

## Core Concepts

### whileHover Prop

```typescript
import { motion } from "framer-motion"

// Basic hover animation
<motion.button
  whileHover={{ scale: 1.05 }}
  transition={{ type: "spring", stiffness: 300, damping: 20 }}
>
  Hover me
</motion.button>
```

### Animation Properties

| Property | Description | Typical Values |
|----------|-------------|----------------|
| `scale` | Size change | 1.02 - 1.1 |
| `y` | Vertical lift | -2 to -8 |
| `rotate` | Rotation | 1 - 5 degrees |
| `opacity` | Transparency | 0.8 - 1 |
| `boxShadow` | Shadow depth | Subtle to elevated |
| `backgroundColor` | Color change | Semantic tokens |
| `filter` | CSS filters | brightness, blur |

## Button Hover Patterns

### Scale Effect (Most Common)

```typescript
const ButtonScale = ({ children }: { children: React.ReactNode }) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    transition={{ type: "spring", stiffness: 400, damping: 17 }}
    className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
  >
    {children}
  </motion.button>
)
```

### Lift Effect (Y Translation)

```typescript
const ButtonLift = ({ children }: { children: React.ReactNode }) => (
  <motion.button
    whileHover={{ y: -2 }}
    whileTap={{ y: 0 }}
    transition={{ type: "spring", stiffness: 400, damping: 17 }}
    className="px-4 py-2 bg-primary text-primary-foreground rounded-md shadow-sm hover:shadow-md"
  >
    {children}
  </motion.button>
)
```

### Glow Effect

```typescript
const ButtonGlow = ({ children }: { children: React.ReactNode }) => (
  <motion.button
    whileHover={{
      boxShadow: "0 0 20px rgba(var(--primary), 0.4)"
    }}
    transition={{ duration: 0.2 }}
    className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
  >
    {children}
  </motion.button>
)
```

### Combined Effects

```typescript
const ButtonComplete = ({ children }: { children: React.ReactNode }) => (
  <motion.button
    whileHover={{
      scale: 1.02,
      y: -2,
      boxShadow: "0 10px 20px rgba(0, 0, 0, 0.1)"
    }}
    whileTap={{
      scale: 0.98,
      y: 0,
      boxShadow: "0 2px 5px rgba(0, 0, 0, 0.1)"
    }}
    transition={{ type: "spring", stiffness: 400, damping: 17 }}
    className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
  >
    {children}
  </motion.button>
)
```

## Card Hover Patterns

### Lift and Shadow

```typescript
const CardLift = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    whileHover={{
      y: -8,
      boxShadow: "0 20px 40px rgba(0, 0, 0, 0.15)"
    }}
    transition={{ type: "spring", stiffness: 300, damping: 20 }}
    className="p-6 bg-card rounded-lg border shadow-sm"
  >
    {children}
  </motion.div>
)
```

### Scale with Border Glow

```typescript
const CardGlow = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    whileHover={{
      scale: 1.02,
      boxShadow: "0 0 0 2px var(--primary), 0 10px 30px rgba(0, 0, 0, 0.1)"
    }}
    transition={{ type: "spring", stiffness: 300, damping: 20 }}
    className="p-6 bg-card rounded-lg border"
  >
    {children}
  </motion.div>
)
```

### Tilt Effect (3D)

```typescript
const CardTilt = ({ children }: { children: React.ReactNode }) => {
  const [rotateX, setRotateX] = React.useState(0)
  const [rotateY, setRotateY] = React.useState(0)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    setRotateX((y - centerY) / 10)
    setRotateY((centerX - x) / 10)
  }

  const handleMouseLeave = () => {
    setRotateX(0)
    setRotateY(0)
  }

  return (
    <motion.div
      style={{ perspective: 1000 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        animate={{ rotateX, rotateY }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="p-6 bg-card rounded-lg border shadow-lg"
        style={{ transformStyle: "preserve-3d" }}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}
```

### Content Reveal

```typescript
const CardReveal = ({ title, description, children }: CardRevealProps) => (
  <motion.div
    whileHover="hovered"
    initial="initial"
    className="relative p-6 bg-card rounded-lg border overflow-hidden"
  >
    <motion.div
      variants={{
        initial: { opacity: 1 },
        hovered: { opacity: 0.7 }
      }}
    >
      {children}
    </motion.div>

    <motion.div
      variants={{
        initial: { y: "100%", opacity: 0 },
        hovered: { y: 0, opacity: 1 }
      }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-sm"
    >
      <div className="text-center p-4">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </motion.div>
  </motion.div>
)
```

## Interactive Elements

### Icon Button

```typescript
const IconButtonAnimated = ({ icon, label }: IconButtonProps) => (
  <motion.button
    whileHover={{ scale: 1.1, rotate: 5 }}
    whileTap={{ scale: 0.95 }}
    transition={{ type: "spring", stiffness: 400, damping: 17 }}
    aria-label={label}
    className="p-2 rounded-md hover:bg-accent"
  >
    {icon}
  </motion.button>
)
```

### Link with Underline

```typescript
const AnimatedLink = ({ href, children }: AnimatedLinkProps) => (
  <motion.a
    href={href}
    whileHover="hovered"
    className="relative text-primary"
  >
    {children}
    <motion.span
      variants={{
        initial: { scaleX: 0, originX: 0 },
        hovered: { scaleX: 1 }
      }}
      transition={{ duration: 0.2 }}
      className="absolute left-0 right-0 bottom-0 h-0.5 bg-primary"
    />
  </motion.a>
)
```

### Navigation Item

```typescript
const NavItem = ({ href, children, isActive }: NavItemProps) => (
  <motion.a
    href={href}
    whileHover={{ backgroundColor: "var(--accent)" }}
    transition={{ duration: 0.15 }}
    className={cn(
      "px-4 py-2 rounded-md text-sm font-medium",
      isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
    )}
  >
    {children}
  </motion.a>
)
```

### List Item

```typescript
const ListItem = ({ children, onClick }: ListItemProps) => (
  <motion.li
    whileHover={{
      x: 4,
      backgroundColor: "var(--accent)"
    }}
    transition={{ type: "spring", stiffness: 300, damping: 20 }}
    onClick={onClick}
    className="px-4 py-3 rounded-md cursor-pointer"
  >
    {children}
  </motion.li>
)
```

## Hover Variants System

### Predefined Hover Presets

```typescript
export const hoverVariants = {
  // Subtle scale
  scale: {
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.98 },
    transition: { type: "spring", stiffness: 400, damping: 17 }
  },

  // Lift effect
  lift: {
    whileHover: { y: -4 },
    whileTap: { y: 0 },
    transition: { type: "spring", stiffness: 400, damping: 17 }
  },

  // Scale and lift
  scaleLift: {
    whileHover: { scale: 1.02, y: -4 },
    whileTap: { scale: 0.98, y: 0 },
    transition: { type: "spring", stiffness: 400, damping: 17 }
  },

  // Glow effect
  glow: {
    whileHover: { boxShadow: "0 0 20px rgba(var(--primary-rgb), 0.3)" },
    transition: { duration: 0.2 }
  },

  // Card lift with shadow
  cardLift: {
    whileHover: {
      y: -8,
      boxShadow: "0 20px 40px rgba(0, 0, 0, 0.12)"
    },
    transition: { type: "spring", stiffness: 300, damping: 20 }
  },

  // Brightness increase
  brighten: {
    whileHover: { filter: "brightness(1.1)" },
    transition: { duration: 0.2 }
  },

  // Icon rotate
  iconSpin: {
    whileHover: { rotate: 180 },
    transition: { type: "spring", stiffness: 200, damping: 15 }
  },

  // Bounce
  bounce: {
    whileHover: { y: -4 },
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 10  // Lower damping = more bounce
    }
  }
}

// Usage
<motion.button {...hoverVariants.scale}>
  Scale Button
</motion.button>

<motion.div {...hoverVariants.cardLift}>
  Card content
</motion.div>
```

### Custom Hook

```typescript
interface UseHoverAnimationOptions {
  scale?: number
  y?: number
  rotate?: number
  shadow?: string
  stiffness?: number
  damping?: number
}

function useHoverAnimation({
  scale = 1,
  y = 0,
  rotate = 0,
  shadow,
  stiffness = 400,
  damping = 17
}: UseHoverAnimationOptions = {}) {
  return {
    whileHover: {
      scale,
      y,
      rotate,
      ...(shadow && { boxShadow: shadow })
    },
    whileTap: {
      scale: scale > 1 ? 0.98 : scale,
      y: 0
    },
    transition: {
      type: "spring",
      stiffness,
      damping
    }
  }
}

// Usage
const buttonAnimation = useHoverAnimation({ scale: 1.02, y: -2 })
<motion.button {...buttonAnimation}>Animated Button</motion.button>
```

## Group Hover Animations

### Parent-Child Coordination

```typescript
const CardWithIcon = ({ icon, title, description }: CardWithIconProps) => (
  <motion.div
    whileHover="hovered"
    initial="initial"
    className="p-6 bg-card rounded-lg border"
  >
    <motion.div
      variants={{
        initial: { scale: 1, rotate: 0 },
        hovered: { scale: 1.1, rotate: 5 }
      }}
      className="mb-4 text-primary"
    >
      {icon}
    </motion.div>

    <motion.h3
      variants={{
        initial: { x: 0 },
        hovered: { x: 4 }
      }}
      className="font-semibold mb-2"
    >
      {title}
    </motion.h3>

    <motion.p
      variants={{
        initial: { opacity: 0.7 },
        hovered: { opacity: 1 }
      }}
      className="text-sm text-muted-foreground"
    >
      {description}
    </motion.p>
  </motion.div>
)
```

### Staggered Children

```typescript
const CardGrid = ({ items }: { items: CardItem[] }) => (
  <motion.div
    whileHover="hovered"
    initial="initial"
    className="grid grid-cols-3 gap-4 p-6 bg-muted rounded-lg"
  >
    {items.map((item, index) => (
      <motion.div
        key={item.id}
        variants={{
          initial: { y: 0 },
          hovered: { y: -4 }
        }}
        transition={{ delay: index * 0.05 }}
        className="p-4 bg-card rounded-md"
      >
        {item.content}
      </motion.div>
    ))}
  </motion.div>
)
```

## Reduced Motion Support

Always respect user preferences:

```typescript
import { useReducedMotion } from "framer-motion"

const AccessibleButton = ({ children }: { children: React.ReactNode }) => {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.button
      whileHover={shouldReduceMotion ? {} : { scale: 1.02, y: -2 }}
      whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 400, damping: 17 }
      }
      className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
    >
      {children}
    </motion.button>
  )
}
```

### Global Motion Wrapper

```typescript
const MotionConfig = ({ children }: { children: React.ReactNode }) => {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      style={{
        ["--motion-scale" as string]: shouldReduceMotion ? 1 : 1.02,
        ["--motion-y" as string]: shouldReduceMotion ? 0 : -4
      }}
    >
      {children}
    </motion.div>
  )
}
```

## Performance Best Practices

### Use transform Properties

```typescript
// ✅ GOOD: Uses GPU-accelerated transforms
<motion.div
  whileHover={{
    scale: 1.02,     // transform: scale()
    y: -4,           // transform: translateY()
    rotate: 5        // transform: rotate()
  }}
/>

// ❌ AVOID: Causes layout recalculation
<motion.div
  whileHover={{
    width: "110%",   // Triggers layout
    height: "110%",  // Triggers layout
    marginTop: -4    // Triggers layout
  }}
/>
```

### Optimize Shadow Animations

```typescript
// Use CSS transitions for shadows when possible
<motion.div
  whileHover={{ y: -4 }}
  className="shadow-sm hover:shadow-lg transition-shadow"
/>

// Only animate shadow in Framer when needed for complex effects
<motion.div
  whileHover={{
    y: -4,
    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.15)"
  }}
/>
```

### Avoid Layout Animations on Lists

```typescript
// ❌ Can cause performance issues on large lists
{items.map(item => (
  <motion.div
    key={item.id}
    whileHover={{ scale: 1.02 }}  // Each item animates
  />
))}

// ✅ Use CSS for simple effects on list items
{items.map(item => (
  <div
    key={item.id}
    className="hover:scale-[1.02] transition-transform"
  />
))}
```

## Transition Presets

```typescript
export const transitions = {
  // Quick, snappy response
  snappy: {
    type: "spring",
    stiffness: 500,
    damping: 30
  },

  // Default, balanced feel
  default: {
    type: "spring",
    stiffness: 400,
    damping: 17
  },

  // Gentle, floaty feel
  gentle: {
    type: "spring",
    stiffness: 300,
    damping: 20
  },

  // Bouncy, playful feel
  bouncy: {
    type: "spring",
    stiffness: 400,
    damping: 10
  },

  // Smooth, eased
  smooth: {
    type: "tween",
    duration: 0.2,
    ease: "easeOut"
  }
}

// Usage
<motion.button
  whileHover={{ scale: 1.02 }}
  transition={transitions.snappy}
/>
```

## Quick Reference

### Button Hover

```typescript
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  transition={{ type: "spring", stiffness: 400, damping: 17 }}
>
```

### Card Hover

```typescript
<motion.div
  whileHover={{ y: -8, boxShadow: "0 20px 40px rgba(0,0,0,0.12)" }}
  transition={{ type: "spring", stiffness: 300, damping: 20 }}
>
```

### Icon Hover

```typescript
<motion.button
  whileHover={{ scale: 1.1, rotate: 5 }}
  whileTap={{ scale: 0.95 }}
  transition={{ type: "spring", stiffness: 400, damping: 17 }}
>
```

### Link Underline

```typescript
<motion.a whileHover="hovered">
  Link
  <motion.span
    variants={{ initial: { scaleX: 0 }, hovered: { scaleX: 1 } }}
    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary origin-left"
  />
</motion.a>
```

## Best Practices

| Do | Don't |
|----|-------|
| Use subtle animations (scale 1.02-1.05) | Use dramatic animations (scale 1.2+) |
| Pair whileHover with whileTap | Leave tap state undefined |
| Use spring transitions | Use linear transitions |
| Respect reduced motion | Ignore accessibility |
| Animate transforms only | Animate layout properties |
| Use CSS for simple hovers | Over-engineer simple effects |
| Keep transitions under 300ms | Use slow, lingering animations |
