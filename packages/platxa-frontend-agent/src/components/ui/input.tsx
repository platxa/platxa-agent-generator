import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// =============================================================================
// INPUT VARIANTS
// =============================================================================

const inputVariants = cva(
  [
    // Base styles
    "flex w-full rounded-md border bg-transparent px-3 py-2",
    "text-base md:text-sm",
    "transition-colors",
    // Placeholder
    "placeholder:text-muted-foreground",
    // Focus styles (two-color pattern for WCAG 2.2)
    "focus-visible:outline-none",
    "focus-visible:ring-2 focus-visible:ring-ring",
    "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    // Disabled state
    "disabled:cursor-not-allowed disabled:opacity-50",
    // File input styles
    "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
  ],
  {
    variants: {
      variant: {
        default: "border-input bg-background",
        error: "border-destructive focus-visible:ring-destructive",
      },
      inputSize: {
        default: "h-10",
        sm: "h-9 px-2 text-sm",
        lg: "h-12 px-4",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "default",
    },
  }
)

// =============================================================================
// INPUT PROPS
// =============================================================================

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  /**
   * Error message to display
   */
  error?: string
  /**
   * Left icon/element to display inside the input
   */
  leftElement?: React.ReactNode
  /**
   * Right icon/element to display inside the input
   */
  rightElement?: React.ReactNode
}

// =============================================================================
// INPUT COMPONENT
// =============================================================================

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      variant,
      inputSize,
      error,
      leftElement,
      rightElement,
      "aria-invalid": ariaInvalid,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const hasError = !!error || ariaInvalid === true || ariaInvalid === "true"

    // Simple input without wrapper elements
    if (!leftElement && !rightElement) {
      return (
        <input
          type={type}
          className={cn(
            inputVariants({
              variant: hasError ? "error" : variant,
              inputSize,
            }),
            className
          )}
          ref={ref}
          aria-invalid={hasError || undefined}
          aria-describedby={ariaDescribedBy}
          {...props}
        />
      )
    }

    // Input with wrapper for left/right elements
    return (
      <div className="relative flex items-center">
        {leftElement && (
          <div className="absolute left-3 flex items-center text-muted-foreground">
            {leftElement}
          </div>
        )}
        <input
          type={type}
          className={cn(
            inputVariants({
              variant: hasError ? "error" : variant,
              inputSize,
            }),
            leftElement && "pl-10",
            rightElement && "pr-10",
            className
          )}
          ref={ref}
          aria-invalid={hasError || undefined}
          aria-describedby={ariaDescribedBy}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-3 flex items-center">
            {rightElement}
          </div>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

// =============================================================================
// EXPORTS
// =============================================================================

export { Input, inputVariants }
