# Animation Guide

Framer Motion patterns for Platxa Frontend Agent.

## Core Principles

1. **Subtle by default**: Animations enhance, not distract
2. **Respect preferences**: Always check `prefers-reduced-motion`
3. **Performance first**: Use `transform` and `opacity` only
4. **Consistent timing**: Use spring physics for natural feel

## Reduced Motion Hook

```typescript
import { useReducedMotion } from "framer-motion"

function AnimatedComponent() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
    />
  )
}
```

## Standard Animations

### Hover Effects

```typescript
// Lift on hover
<motion.div
  whileHover={{ y: -4, boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }}
  transition={{ type: "spring", stiffness: 400, damping: 25 }}
/>

// Scale on hover
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
/>
```

### Enter Animations

```typescript
// Fade up
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
}

// Stagger children
const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
}
```

### Layout Animations

```typescript
// Shared layout
<motion.div layout layoutId="unique-id" />

// Auto-animate size changes
<motion.div
  layout
  transition={{ type: "spring", stiffness: 500, damping: 30 }}
/>
```

## Animation Variants

```typescript
const variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24,
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: { duration: 0.2 },
  },
}

<motion.div
  variants={variants}
  initial="hidden"
  animate="visible"
  exit="exit"
/>
```

## Spring Presets

| Use Case | Stiffness | Damping |
|----------|-----------|---------|
| Snappy UI | 400 | 25 |
| Smooth | 300 | 30 |
| Bouncy | 500 | 15 |
| Heavy | 200 | 20 |

## AnimatePresence

For exit animations:

```typescript
import { AnimatePresence } from "framer-motion"

<AnimatePresence mode="wait">
  {isOpen && (
    <motion.div
      key="modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    />
  )}
</AnimatePresence>
```

## Performance Tips

1. Use `transform` and `opacity` - they don't trigger layout
2. Add `will-change: transform` for complex animations
3. Use `layout` prop sparingly
4. Prefer `whileHover` over CSS hover states for consistency
