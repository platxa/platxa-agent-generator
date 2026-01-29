# cn() Utility Integration

The `cn()` utility is the foundation of class composition in generated components. It combines clsx for conditional classes with tailwind-merge for intelligent class deduplication.

## Implementation

```typescript
// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### Dependencies

```json
{
  "dependencies": {
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  }
}
```

## Why cn()?

### The Problem

Without cn(), Tailwind classes conflict:

```typescript
// ❌ Problem: Both padding classes render
<div className={`p-4 ${className}`}>
  {/* If className="p-8", output is "p-4 p-8" - unpredictable */}
</div>

// ❌ Problem: Conditional classes are verbose
<div className={`btn ${variant === 'primary' ? 'bg-primary' : ''} ${size === 'lg' ? 'text-lg' : ''}`}>
```

### The Solution

With cn(), classes merge intelligently:

```typescript
// ✅ Solution: Later classes win
<div className={cn("p-4", className)}>
  {/* If className="p-8", output is "p-8" - predictable */}
</div>

// ✅ Solution: Clean conditional syntax
<div className={cn(
  "btn",
  variant === 'primary' && "bg-primary",
  size === 'lg' && "text-lg"
)}>
```

## Usage Patterns

### Pattern 1: Base + Overrides

Every component should accept and merge className:

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        // Base styles (always applied)
        "inline-flex items-center justify-center rounded-md",
        "text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2",

        // Variant styles
        variant === "default" && "bg-primary text-primary-foreground",
        variant === "outline" && "border border-input bg-background",

        // User overrides (last, wins conflicts)
        className
      )}
      {...props}
    />
  )
)
```

### Pattern 2: CVA Integration

cn() wraps CVA variants for override capability:

```typescript
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  // Base styles
  "inline-flex items-center justify-center rounded-md text-sm font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "border border-input bg-background hover:bg-accent",
        secondary: "bg-secondary text-secondary-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline"
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

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
)
```

### Pattern 3: Conditional Classes

cn() supports multiple conditional syntaxes:

```typescript
// Boolean conditions
cn(
  "base-class",
  isActive && "active-class",
  isDisabled && "opacity-50 cursor-not-allowed"
)

// Ternary for either/or
cn(
  "base-class",
  isExpanded ? "h-auto" : "h-0"
)

// Object syntax (from clsx)
cn({
  "bg-primary": variant === "primary",
  "bg-secondary": variant === "secondary",
  "opacity-50": disabled
})

// Array syntax
cn([
  "base-class",
  condition && "conditional-class"
])

// Mixed syntax
cn(
  "always-applied",
  condition && "if-true",
  { "object-conditional": anotherCondition },
  ["array", "of", "classes"]
)
```

### Pattern 4: Component Composition

Pass cn() result to child components:

```typescript
interface CardProps {
  className?: string
  headerClassName?: string
  contentClassName?: string
  children: React.ReactNode
}

function Card({
  className,
  headerClassName,
  contentClassName,
  children
}: CardProps) {
  return (
    <div className={cn("rounded-lg border bg-card shadow-sm", className)}>
      <div className={cn("border-b px-6 py-4", headerClassName)}>
        {/* Header content */}
      </div>
      <div className={cn("p-6", contentClassName)}>
        {children}
      </div>
    </div>
  )
}

// Usage: Override specific parts
<Card
  className="w-full max-w-md"
  headerClassName="bg-muted"
  contentClassName="space-y-4"
>
  Content here
</Card>
```

### Pattern 5: State-Based Styling

Combine state with cn() for dynamic styles:

```typescript
function Input({ error, success, className, ...props }) {
  return (
    <input
      className={cn(
        // Base
        "flex h-10 w-full rounded-md border px-3 py-2",
        "text-sm placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2",

        // State variants
        !error && !success && "border-input focus-visible:ring-ring",
        error && "border-destructive focus-visible:ring-destructive",
        success && "border-green-500 focus-visible:ring-green-500",

        // Disabled
        props.disabled && "cursor-not-allowed opacity-50",

        // Overrides
        className
      )}
      {...props}
    />
  )
}
```

### Pattern 6: Responsive Utilities

cn() preserves responsive prefixes:

```typescript
<div className={cn(
  // Mobile first
  "flex flex-col gap-4",

  // Tablet
  "md:flex-row md:gap-6",

  // Desktop
  "lg:gap-8",

  // User can override specific breakpoints
  className
)}>
```

### Pattern 7: Data Attribute Styling

Combine cn() with Radix data attributes:

```typescript
<Accordion.Trigger
  className={cn(
    "flex w-full items-center justify-between py-4",
    "font-medium transition-all hover:underline",

    // Radix data attributes
    "[&[data-state=open]>svg]:rotate-180",

    className
  )}
>
```

## Tailwind-Merge Behavior

### Class Conflict Resolution

tailwind-merge intelligently resolves conflicts:

```typescript
// Padding: later wins
cn("p-4", "p-8")           // → "p-8"
cn("px-4 py-2", "p-8")     // → "p-8"
cn("p-8", "px-4")          // → "p-8 px-4" (different axes)

// Colors: later wins
cn("text-red-500", "text-blue-500")  // → "text-blue-500"
cn("bg-white", "bg-black")           // → "bg-black"

// Display: later wins
cn("flex", "block")        // → "block"
cn("hidden", "flex")       // → "flex"

// Sizing: later wins
cn("w-4", "w-8")           // → "w-8"
cn("h-full", "h-screen")   // → "h-screen"

// Non-conflicting: both kept
cn("p-4", "m-4")           // → "p-4 m-4"
cn("text-sm", "font-bold") // → "text-sm font-bold"
```

### Arbitrary Values

tailwind-merge handles arbitrary values:

```typescript
cn("p-[13px]", "p-4")      // → "p-4"
cn("bg-[#123456]", "bg-primary")  // → "bg-primary"
cn("w-[200px]", "w-full")  // → "w-full"
```

### Important Modifier

The ! modifier is preserved:

```typescript
cn("p-4", "!p-8")          // → "!p-8"
cn("!text-red-500", "text-blue-500")  // → "!text-red-500" (important wins)
```

## Component Generator Integration

### Rule: All className Props Must Use cn()

The component-generator enforces cn() usage:

```typescript
// ❌ Generated code should NEVER do this
<div className={`base-class ${className}`}>

// ✅ Generated code ALWAYS does this
<div className={cn("base-class", className)}>
```

### Template Pattern

```typescript
// Standard component template
const ${ComponentName} = React.forwardRef<
  HTML${Element}Element,
  ${ComponentName}Props
>(({ className, ...props }, ref) => (
  <${element}
    ref={ref}
    className={cn(
      "${baseClasses}",
      className
    )}
    {...props}
  />
))
${ComponentName}.displayName = "${ComponentName}"
```

### Validation Rules

The generator validates:

1. **Import Present**: `import { cn } from "@/lib/utils"` exists
2. **className Prop**: Components accepting className use cn()
3. **Override Position**: className is last argument to cn()
4. **No String Concatenation**: No `${className}` patterns

```typescript
function validateCnUsage(code: string): ValidationResult {
  const issues: string[] = []

  // Check import
  if (!code.includes('import { cn }')) {
    issues.push("Missing cn import from @/lib/utils")
  }

  // Check for string concatenation
  if (code.match(/className=\{`[^`]*\$\{className\}/)) {
    issues.push("Use cn() instead of template literal for className")
  }

  // Check className is last in cn()
  const cnCalls = code.matchAll(/cn\(([^)]+)\)/g)
  for (const match of cnCalls) {
    const args = match[1]
    if (args.includes('className') && !args.trim().endsWith('className')) {
      issues.push("className should be last argument in cn()")
    }
  }

  return {
    valid: issues.length === 0,
    issues
  }
}
```

## Examples

### Complete Button Component

```typescript
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-md text-sm font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
  ),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline"
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

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

### Complete Card Component

```typescript
import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
```

## Best Practices

| Do | Don't |
|----|-------|
| `cn("base", className)` | `\`base ${className}\`` |
| Put className last | Put className first in cn() |
| Use cn() for all dynamic classes | Mix cn() with manual concatenation |
| Import from @/lib/utils | Redefine cn() in components |
| Use CVA for variant systems | Write manual variant conditions |
