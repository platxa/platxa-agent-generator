# Tap Animations with Framer Motion

Tap animations provide immediate tactile feedback when users click or touch interactive elements. The `whileTap` prop creates a pressed state that makes interfaces feel responsive and satisfying.

## Core Concept

```typescript
import { motion } from "framer-motion"

// Basic tap animation - scale down on press
<motion.button
  whileTap={{ scale: 0.95 }}
  transition={{ type: "spring", stiffness: 400, damping: 17 }}
>
  Press me
</motion.button>
```

## Why Tap Feedback Matters

| Without Tap Feedback | With Tap Feedback |
|---------------------|-------------------|
| Click feels unresponsive | Immediate visual response |
| User unsure if click registered | Confirmation of interaction |
| Flat, static interface | Physical, tangible feel |
| No tactile satisfaction | Satisfying micro-interaction |

## Tap Animation Patterns

### Scale Down (Standard)

The most common pattern—mimics physical button depression:

```typescript
const Button = ({ children }: { children: React.ReactNode }) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.95 }}
    transition={{ type: "spring", stiffness: 400, damping: 17 }}
    className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
  >
    {children}
  </motion.button>
)
```

### Scale + Y Translation

Button presses down into the surface:

```typescript
const ButtonPress = ({ children }: { children: React.ReactNode }) => (
  <motion.button
    whileHover={{ y: -2 }}
    whileTap={{ scale: 0.98, y: 0 }}
    transition={{ type: "spring", stiffness: 400, damping: 17 }}
    className="px-4 py-2 bg-primary text-primary-foreground rounded-md shadow-md hover:shadow-lg"
  >
    {children}
  </motion.button>
)
```

### Scale + Brightness

Visual feedback through both size and color:

```typescript
const ButtonBright = ({ children }: { children: React.ReactNode }) => (
  <motion.button
    whileHover={{ filter: "brightness(1.1)" }}
    whileTap={{ scale: 0.95, filter: "brightness(0.9)" }}
    transition={{ duration: 0.1 }}
    className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
  >
    {children}
  </motion.button>
)
```

### Shadow Reduction

Simulate physical depth change:

```typescript
const ButtonDepth = ({ children }: { children: React.ReactNode }) => (
  <motion.button
    initial={{ boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)" }}
    whileHover={{ boxShadow: "0 8px 12px rgba(0, 0, 0, 0.15)" }}
    whileTap={{
      scale: 0.98,
      boxShadow: "0 2px 3px rgba(0, 0, 0, 0.1)"
    }}
    transition={{ type: "spring", stiffness: 400, damping: 17 }}
    className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
  >
    {children}
  </motion.button>
)
```

## Button Variants

### Primary Button

```typescript
const PrimaryButton = ({ children, ...props }: ButtonProps) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.95 }}
    transition={{ type: "spring", stiffness: 400, damping: 17 }}
    className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium"
    {...props}
  >
    {children}
  </motion.button>
)
```

### Secondary Button

```typescript
const SecondaryButton = ({ children, ...props }: ButtonProps) => (
  <motion.button
    whileHover={{ backgroundColor: "var(--secondary)" }}
    whileTap={{ scale: 0.97 }}
    transition={{ type: "spring", stiffness: 400, damping: 17 }}
    className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md font-medium"
    {...props}
  >
    {children}
  </motion.button>
)
```

### Ghost Button

```typescript
const GhostButton = ({ children, ...props }: ButtonProps) => (
  <motion.button
    whileHover={{ backgroundColor: "var(--accent)" }}
    whileTap={{ scale: 0.95, backgroundColor: "var(--accent)" }}
    transition={{ type: "spring", stiffness: 400, damping: 17 }}
    className="px-4 py-2 rounded-md font-medium text-foreground"
    {...props}
  >
    {children}
  </motion.button>
)
```

### Destructive Button

```typescript
const DestructiveButton = ({ children, ...props }: ButtonProps) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.95 }}
    transition={{ type: "spring", stiffness: 500, damping: 25 }}
    className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md font-medium"
    {...props}
  >
    {children}
  </motion.button>
)
```

### Icon Button

```typescript
const IconButton = ({ icon, label, ...props }: IconButtonProps) => (
  <motion.button
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.9 }}
    transition={{ type: "spring", stiffness: 400, damping: 17 }}
    aria-label={label}
    className="p-2 rounded-md hover:bg-accent"
    {...props}
  >
    <span aria-hidden="true">{icon}</span>
  </motion.button>
)
```

## Interactive Element Patterns

### Clickable Card

```typescript
const ClickableCard = ({ onClick, children }: ClickableCardProps) => (
  <motion.div
    whileHover={{ y: -4, boxShadow: "0 10px 30px rgba(0, 0, 0, 0.1)" }}
    whileTap={{ scale: 0.98, y: 0 }}
    transition={{ type: "spring", stiffness: 300, damping: 20 }}
    onClick={onClick}
    role="button"
    tabIndex={0}
    className="p-6 bg-card rounded-lg border cursor-pointer"
  >
    {children}
  </motion.div>
)
```

### List Item

```typescript
const ListItemTap = ({ onClick, children }: ListItemProps) => (
  <motion.li
    whileHover={{ x: 4, backgroundColor: "var(--accent)" }}
    whileTap={{ scale: 0.98, x: 0 }}
    transition={{ type: "spring", stiffness: 400, damping: 20 }}
    onClick={onClick}
    className="px-4 py-3 rounded-md cursor-pointer"
  >
    {children}
  </motion.li>
)
```

### Checkbox

```typescript
const AnimatedCheckbox = ({ checked, onChange }: CheckboxProps) => (
  <motion.button
    whileTap={{ scale: 0.9 }}
    transition={{ type: "spring", stiffness: 500, damping: 25 }}
    onClick={() => onChange(!checked)}
    role="checkbox"
    aria-checked={checked}
    className={cn(
      "h-5 w-5 rounded border-2",
      checked ? "bg-primary border-primary" : "border-input"
    )}
  >
    {checked && (
      <motion.svg
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="h-full w-full text-primary-foreground"
        viewBox="0 0 24 24"
      >
        <path
          fill="currentColor"
          d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
        />
      </motion.svg>
    )}
  </motion.button>
)
```

### Toggle/Switch

```typescript
const AnimatedSwitch = ({ checked, onChange }: SwitchProps) => (
  <motion.button
    whileTap={{ scale: 0.95 }}
    onClick={() => onChange(!checked)}
    role="switch"
    aria-checked={checked}
    className={cn(
      "relative w-11 h-6 rounded-full transition-colors",
      checked ? "bg-primary" : "bg-input"
    )}
  >
    <motion.span
      animate={{ x: checked ? 20 : 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="absolute top-0.5 left-0.5 w-5 h-5 bg-background rounded-full shadow"
    />
  </motion.button>
)
```

### Tab

```typescript
const AnimatedTab = ({ isActive, onClick, children }: TabProps) => (
  <motion.button
    whileTap={{ scale: 0.95 }}
    transition={{ type: "spring", stiffness: 400, damping: 17 }}
    onClick={onClick}
    role="tab"
    aria-selected={isActive}
    className={cn(
      "px-4 py-2 text-sm font-medium rounded-md",
      isActive
        ? "bg-background text-foreground shadow"
        : "text-muted-foreground hover:text-foreground"
    )}
  >
    {children}
  </motion.button>
)
```

## Tap Variants System

### Predefined Tap Presets

```typescript
export const tapVariants = {
  // Standard button tap
  button: {
    whileTap: { scale: 0.95 },
    transition: { type: "spring", stiffness: 400, damping: 17 }
  },

  // Subtle tap for smaller elements
  subtle: {
    whileTap: { scale: 0.97 },
    transition: { type: "spring", stiffness: 400, damping: 17 }
  },

  // Strong tap for large buttons
  strong: {
    whileTap: { scale: 0.9 },
    transition: { type: "spring", stiffness: 500, damping: 25 }
  },

  // Icon button tap
  icon: {
    whileTap: { scale: 0.85 },
    transition: { type: "spring", stiffness: 400, damping: 17 }
  },

  // Card tap
  card: {
    whileTap: { scale: 0.98 },
    transition: { type: "spring", stiffness: 300, damping: 20 }
  },

  // Quick tap (faster response)
  quick: {
    whileTap: { scale: 0.95 },
    transition: { type: "spring", stiffness: 600, damping: 30 }
  },

  // Bouncy tap
  bouncy: {
    whileTap: { scale: 0.9 },
    transition: { type: "spring", stiffness: 400, damping: 10 }
  },

  // Press down
  press: {
    whileTap: { scale: 0.98, y: 2 },
    transition: { type: "spring", stiffness: 400, damping: 17 }
  }
}

// Usage
<motion.button {...tapVariants.button}>Standard</motion.button>
<motion.button {...tapVariants.icon}>Icon</motion.button>
<motion.div {...tapVariants.card}>Card</motion.div>
```

### Combined Hover + Tap

```typescript
export const interactionVariants = {
  // Standard button
  button: {
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.95 },
    transition: { type: "spring", stiffness: 400, damping: 17 }
  },

  // Lift button
  lift: {
    whileHover: { y: -2 },
    whileTap: { scale: 0.98, y: 0 },
    transition: { type: "spring", stiffness: 400, damping: 17 }
  },

  // Glow button
  glow: {
    whileHover: { boxShadow: "0 0 20px rgba(var(--primary-rgb), 0.3)" },
    whileTap: { scale: 0.95, boxShadow: "0 0 10px rgba(var(--primary-rgb), 0.2)" },
    transition: { type: "spring", stiffness: 400, damping: 17 }
  },

  // Icon
  icon: {
    whileHover: { scale: 1.1 },
    whileTap: { scale: 0.9 },
    transition: { type: "spring", stiffness: 400, damping: 17 }
  },

  // Card
  card: {
    whileHover: { y: -4, boxShadow: "0 10px 30px rgba(0, 0, 0, 0.1)" },
    whileTap: { scale: 0.98, y: 0 },
    transition: { type: "spring", stiffness: 300, damping: 20 }
  },

  // List item
  listItem: {
    whileHover: { x: 4, backgroundColor: "var(--accent)" },
    whileTap: { scale: 0.98 },
    transition: { type: "spring", stiffness: 400, damping: 20 }
  }
}
```

## Disabled State

Never animate disabled elements:

```typescript
interface ButtonProps {
  disabled?: boolean
  children: React.ReactNode
}

const Button = ({ disabled, children }: ButtonProps) => (
  <motion.button
    whileHover={disabled ? {} : { scale: 1.02 }}
    whileTap={disabled ? {} : { scale: 0.95 }}
    transition={{ type: "spring", stiffness: 400, damping: 17 }}
    disabled={disabled}
    className={cn(
      "px-4 py-2 bg-primary text-primary-foreground rounded-md",
      disabled && "opacity-50 cursor-not-allowed"
    )}
  >
    {children}
  </motion.button>
)
```

## Loading State

Replace tap with loading indicator:

```typescript
const LoadingButton = ({ isLoading, children }: LoadingButtonProps) => (
  <motion.button
    whileHover={isLoading ? {} : { scale: 1.02 }}
    whileTap={isLoading ? {} : { scale: 0.95 }}
    disabled={isLoading}
    className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
  >
    {isLoading ? (
      <motion.span
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="inline-block"
      >
        ⟳
      </motion.span>
    ) : (
      children
    )}
  </motion.button>
)
```

## Reduced Motion Support

```typescript
import { useReducedMotion } from "framer-motion"

const AccessibleButton = ({ children }: { children: React.ReactNode }) => {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.button
      whileHover={shouldReduceMotion ? {} : { scale: 1.02 }}
      whileTap={shouldReduceMotion ? {} : { scale: 0.95 }}
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

## Mobile Touch Considerations

### Touch Delay

```typescript
// Ensure no 300ms tap delay
<motion.button
  style={{ touchAction: "manipulation" }}
  whileTap={{ scale: 0.95 }}
>
  Fast Touch
</motion.button>
```

### Larger Touch Targets

```typescript
// Minimum 44x44px touch target
const TouchButton = ({ children }: { children: React.ReactNode }) => (
  <motion.button
    whileTap={{ scale: 0.95 }}
    className="min-h-[44px] min-w-[44px] px-4 py-2"
  >
    {children}
  </motion.button>
)
```

## Scale Value Guidelines

| Element Type | Scale Value | Rationale |
|--------------|-------------|-----------|
| Large button | 0.95 | Noticeable but not jarring |
| Small button | 0.97 | Subtle, proportional |
| Icon button | 0.85-0.9 | More dramatic for small targets |
| Card | 0.98 | Minimal for large surfaces |
| Checkbox/Toggle | 0.9 | Clear feedback for small controls |
| List item | 0.98 | Subtle for repeated elements |

## Quick Reference

### Standard Button

```typescript
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.95 }}
  transition={{ type: "spring", stiffness: 400, damping: 17 }}
>
```

### Icon Button

```typescript
<motion.button
  whileHover={{ scale: 1.1 }}
  whileTap={{ scale: 0.9 }}
  transition={{ type: "spring", stiffness: 400, damping: 17 }}
>
```

### Card

```typescript
<motion.div
  whileHover={{ y: -4 }}
  whileTap={{ scale: 0.98 }}
  transition={{ type: "spring", stiffness: 300, damping: 20 }}
>
```

### Checkbox

```typescript
<motion.button
  whileTap={{ scale: 0.9 }}
  transition={{ type: "spring", stiffness: 500, damping: 25 }}
>
```

## Best Practices

| Do | Don't |
|----|-------|
| Scale down (0.9-0.98) | Scale up on tap |
| Use quick spring transitions | Use slow, lingering transitions |
| Pair with whileHover | Use whileTap alone |
| Disable animations when disabled | Animate disabled buttons |
| Use larger scale change for small elements | Use same scale for all sizes |
| Test on touch devices | Only test with mouse |
| Respect reduced motion preference | Ignore accessibility settings |
| Keep tap duration short (<200ms) | Create long tap animations |
