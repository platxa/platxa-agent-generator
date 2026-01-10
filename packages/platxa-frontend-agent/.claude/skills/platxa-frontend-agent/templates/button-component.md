# Button Component Generator

Complete button component with all standard variants, sizes, states, and accessibility features.

## Generated Component

```typescript
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { motion, type HTMLMotionProps } from "framer-motion"

import { cn } from "@/lib/utils"

// =============================================================================
// BUTTON VARIANTS
// =============================================================================

const buttonVariants = cva(
  [
    // Base styles
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-md text-sm font-medium",
    "transition-colors",
    // Focus ring (two-color pattern)
    "focus-visible:outline-none",
    "focus-visible:ring-2 focus-visible:ring-ring",
    "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    // Disabled state
    "disabled:pointer-events-none disabled:opacity-50",
    // Icon sizing
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
  ],
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground",
        link:
          "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)

// =============================================================================
// BUTTON PROPS
// =============================================================================

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * Render as child component (Radix Slot pattern)
   * Useful for rendering as <a> or other elements
   */
  asChild?: boolean
  /**
   * Show loading spinner and disable interaction
   */
  isLoading?: boolean
  /**
   * Icon to display before children
   */
  leftIcon?: React.ReactNode
  /**
   * Icon to display after children
   */
  rightIcon?: React.ReactNode
}

// =============================================================================
// BUTTON COMPONENT
// =============================================================================

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <LoadingSpinner className="mr-2" />
            {children}
          </>
        ) : (
          <>
            {leftIcon}
            {children}
            {rightIcon}
          </>
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

// =============================================================================
// LOADING SPINNER
// =============================================================================

const LoadingSpinner = ({ className }: { className?: string }) => (
  <svg
    className={cn("h-4 w-4 animate-spin", className)}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
)

export { Button, buttonVariants }
```

## Animated Button Variant

With Framer Motion for hover/tap animations:

```typescript
// =============================================================================
// ANIMATED BUTTON
// =============================================================================

export interface AnimatedButtonProps
  extends Omit<HTMLMotionProps<"button">, "ref">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const AnimatedButton = React.forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  (
    {
      className,
      variant,
      size,
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || isLoading}
        whileHover={{ scale: disabled || isLoading ? 1 : 1.02 }}
        whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        {...props}
      >
        {isLoading ? (
          <>
            <LoadingSpinner className="mr-2" />
            {children}
          </>
        ) : (
          <>
            {leftIcon}
            {children}
            {rightIcon}
          </>
        )}
      </motion.button>
    )
  }
)
AnimatedButton.displayName = "AnimatedButton"

export { AnimatedButton }
```

## Variant Examples

### Default (Primary)

```typescript
<Button>Primary Action</Button>
<Button variant="default">Explicit Primary</Button>
```

**Appearance:**
- Background: Primary color
- Text: Primary foreground (usually white)
- Shadow: Small drop shadow
- Hover: Slightly transparent (90% opacity)

### Secondary

```typescript
<Button variant="secondary">Secondary Action</Button>
```

**Appearance:**
- Background: Secondary/muted color
- Text: Secondary foreground
- Shadow: Small shadow
- Hover: Slightly darker (80% opacity)

### Outline

```typescript
<Button variant="outline">Outline Button</Button>
```

**Appearance:**
- Background: Transparent
- Border: Input border color
- Text: Foreground color
- Hover: Accent background, accent text

### Ghost

```typescript
<Button variant="ghost">Ghost Button</Button>
```

**Appearance:**
- Background: Transparent
- Border: None
- Text: Foreground color
- Hover: Accent background, accent text

### Destructive

```typescript
<Button variant="destructive">Delete Item</Button>
```

**Appearance:**
- Background: Destructive/red color
- Text: White
- Shadow: Small shadow
- Hover: Slightly transparent (90% opacity)

### Link

```typescript
<Button variant="link">Learn More</Button>
```

**Appearance:**
- Background: None
- Text: Primary color
- Hover: Underline appears

## Size Examples

```typescript
// Small - compact spaces, secondary actions
<Button size="sm">Small</Button>

// Default - primary actions
<Button size="default">Default</Button>

// Large - hero sections, prominent CTAs
<Button size="lg">Large</Button>

// Icon - toolbar buttons, icon-only actions
<Button size="icon" aria-label="Settings">
  <SettingsIcon />
</Button>
```

**Size Specifications:**

| Size | Height | Padding | Font |
|------|--------|---------|------|
| sm | 36px (h-9) | 12px (px-3) | 14px |
| default | 40px (h-10) | 16px (px-4) | 14px |
| lg | 44px (h-11) | 32px (px-8) | 14px |
| icon | 40x40px | - | - |

## State Examples

### Loading State

```typescript
<Button isLoading>Processing...</Button>
<Button isLoading variant="secondary">Saving</Button>
```

### Disabled State

```typescript
<Button disabled>Disabled</Button>
<Button disabled variant="outline">Can't Click</Button>
```

### With Icons

```typescript
// Left icon
<Button leftIcon={<PlusIcon />}>Add Item</Button>

// Right icon
<Button rightIcon={<ArrowRightIcon />}>Next Step</Button>

// Both icons
<Button leftIcon={<MailIcon />} rightIcon={<SendIcon />}>
  Send Email
</Button>

// Icon only
<Button size="icon" aria-label="Delete">
  <TrashIcon />
</Button>
```

## Advanced Patterns

### As Link (asChild)

```typescript
import Link from "next/link"

<Button asChild>
  <Link href="/dashboard">Go to Dashboard</Link>
</Button>

<Button asChild variant="outline">
  <a href="https://example.com" target="_blank" rel="noopener">
    External Link
  </a>
</Button>
```

### Button Group

```typescript
const ButtonGroup = ({ children }: { children: React.ReactNode }) => (
  <div className="flex -space-x-px">
    {React.Children.map(children, (child, index) => {
      if (!React.isValidElement(child)) return child

      const isFirst = index === 0
      const isLast = index === React.Children.count(children) - 1

      return React.cloneElement(child as React.ReactElement, {
        className: cn(
          child.props.className,
          "rounded-none",
          isFirst && "rounded-l-md",
          isLast && "rounded-r-md"
        )
      })
    })}
  </div>
)

// Usage
<ButtonGroup>
  <Button variant="outline">Left</Button>
  <Button variant="outline">Center</Button>
  <Button variant="outline">Right</Button>
</ButtonGroup>
```

### Icon Button with Tooltip

```typescript
import * as Tooltip from "@radix-ui/react-tooltip"

const IconButtonWithTooltip = ({
  icon,
  label,
  ...props
}: IconButtonProps) => (
  <Tooltip.Provider>
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <Button size="icon" variant="ghost" aria-label={label} {...props}>
          {icon}
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="px-2 py-1 bg-foreground text-background text-sm rounded"
          sideOffset={5}
        >
          {label}
          <Tooltip.Arrow className="fill-foreground" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>
)
```

### Toggle Button

```typescript
const ToggleButton = ({
  pressed,
  onPressedChange,
  children,
  ...props
}: ToggleButtonProps) => (
  <Button
    variant={pressed ? "default" : "outline"}
    aria-pressed={pressed}
    onClick={() => onPressedChange(!pressed)}
    {...props}
  >
    {children}
  </Button>
)
```

### Split Button

```typescript
const SplitButton = ({
  label,
  onClick,
  menuItems
}: SplitButtonProps) => (
  <div className="flex">
    <Button className="rounded-r-none" onClick={onClick}>
      {label}
    </Button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="default"
          size="icon"
          className="rounded-l-none border-l border-primary-foreground/20"
        >
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {menuItems.map(item => (
          <DropdownMenuItem key={item.id} onClick={item.onClick}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
)
```

## Accessibility Checklist

| Requirement | Implementation |
|-------------|----------------|
| Keyboard accessible | Native `<button>` element |
| Focus visible | Two-color focus ring |
| Disabled state | `disabled` attribute + reduced opacity |
| Loading state | Spinner + disabled interaction |
| Icon buttons | `aria-label` required |
| Contrast | 4.5:1 text contrast |
| Touch target | Minimum 44x44px (h-10 = 40px, acceptable) |

## Usage Guidelines

### When to Use Each Variant

| Variant | Use Case |
|---------|----------|
| **default** | Primary action, form submit, main CTA |
| **secondary** | Secondary actions alongside primary |
| **outline** | Alternative actions, less emphasis |
| **ghost** | Tertiary actions, toolbars, icon buttons |
| **destructive** | Delete, remove, destructive actions |
| **link** | Navigation, inline actions, "Learn more" |

### Button Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│ Primary (default)  > Secondary  > Outline  > Ghost  > Link  │
│ ████████████████     ▓▓▓▓▓▓▓▓▓    ░░░░░░░░    ·····    ____  │
│ Most prominent                              Least prominent │
└─────────────────────────────────────────────────────────────┘
```

### Common Patterns

```typescript
// Form actions
<div className="flex justify-end gap-3">
  <Button variant="outline">Cancel</Button>
  <Button>Save Changes</Button>
</div>

// Destructive confirmation
<div className="flex justify-end gap-3">
  <Button variant="ghost">Cancel</Button>
  <Button variant="destructive">Delete Account</Button>
</div>

// Hero CTA
<div className="flex gap-4">
  <Button size="lg">Get Started</Button>
  <Button size="lg" variant="outline">Learn More</Button>
</div>

// Toolbar
<div className="flex gap-1">
  <Button size="icon" variant="ghost" aria-label="Bold">
    <BoldIcon />
  </Button>
  <Button size="icon" variant="ghost" aria-label="Italic">
    <ItalicIcon />
  </Button>
  <Button size="icon" variant="ghost" aria-label="Underline">
    <UnderlineIcon />
  </Button>
</div>
```

## Customization

### Custom Colors

```typescript
// Extend buttonVariants for custom variants
const buttonVariants = cva(
  // ... base styles
  {
    variants: {
      variant: {
        // ... existing variants
        success:
          "bg-green-600 text-white shadow hover:bg-green-700",
        warning:
          "bg-amber-500 text-white shadow hover:bg-amber-600"
      }
    }
  }
)
```

### Custom Sizes

```typescript
const buttonVariants = cva(
  // ... base styles
  {
    variants: {
      size: {
        // ... existing sizes
        xs: "h-7 rounded px-2 text-xs",
        xl: "h-14 rounded-lg px-10 text-lg"
      }
    }
  }
)
```

## Export

```typescript
// components/ui/button.tsx
export { Button, AnimatedButton, buttonVariants }
export type { ButtonProps, AnimatedButtonProps }
```
