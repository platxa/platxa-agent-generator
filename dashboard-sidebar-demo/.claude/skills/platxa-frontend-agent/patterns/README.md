# Component Patterns

Standard patterns for generating React components.

## Base Pattern

All components use this structure:

```typescript
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// 1. Define variants with CVA
const componentVariants = cva(
  // Base classes (always applied)
  ["inline-flex", "items-center", "justify-center"],
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border border-input bg-background",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

// 2. Export variant type for consumers
export type ComponentVariants = VariantProps<typeof componentVariants>

// 3. Define props interface extending HTML attributes
export interface ComponentProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ComponentVariants {
  /** Optional loading state */
  isLoading?: boolean
}

// 4. Use forwardRef for DOM access
const Component = React.forwardRef<HTMLButtonElement, ComponentProps>(
  ({ className, variant, size, isLoading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={cn(componentVariants({ variant, size }), className)}
      {...props}
    >
      {isLoading ? <LoadingSpinner /> : children}
    </button>
  )
)

// 5. Set displayName for DevTools
Component.displayName = "Component"

// 6. Export component and variants
export { Component, componentVariants }
```

## Compound Components

For complex components with multiple parts:

```typescript
// Card compound component
const Card = React.forwardRef<HTMLDivElement, CardProps>(...)
const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(...)
const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(...)
const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(...)
const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(...)
const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(...)

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
```

## Radix UI Integration

Wrapping Radix primitives:

```typescript
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"

const DropdownMenu = DropdownMenuPrimitive.Root
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName
```

## Naming Conventions

| Item | Convention | Example |
|------|------------|---------|
| Component | PascalCase | `UserProfileDropdown` |
| File | kebab-case | `user-profile-dropdown.tsx` |
| Variant key | camelCase | `defaultVariants` |
| CSS class | kebab-case | `text-primary-foreground` |
| Event handler | on + Event | `onOpenChange` |

## Required Exports

Every component file must export:

1. Main component (forwardRef'd)
2. Variants object (if using CVA)
3. Props interface
4. Any sub-components
