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
    // Focus ring (two-color pattern for WCAG 2.2)
    "focus-visible:outline-none",
    "focus-visible:ring-2 focus-visible:ring-ring",
    "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    // Disabled state
    "disabled:pointer-events-none disabled:opacity-50",
    // Icon sizing
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
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
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

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

    // When asChild is true, render children directly without wrapper
    // Slot component passes props to the child element, so we can't wrap in Fragment
    const renderContent = () => {
      if (asChild) {
        return children
      }
      if (isLoading) {
        return (
          <>
            <LoadingSpinner className="mr-2" />
            {children}
          </>
        )
      }
      return (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {renderContent()}
      </Comp>
    )
  }
)
Button.displayName = "Button"

// =============================================================================
// ANIMATED BUTTON PROPS
// =============================================================================

export interface AnimatedButtonProps
  extends Omit<HTMLMotionProps<"button">, "ref">,
    VariantProps<typeof buttonVariants> {
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
// ANIMATED BUTTON COMPONENT
// =============================================================================

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
    const isDisabled = disabled || isLoading

    return (
      <motion.button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={isDisabled}
        aria-busy={isLoading || undefined}
        whileHover={{ scale: isDisabled ? 1 : 1.02 }}
        whileTap={{ scale: isDisabled ? 1 : 0.98 }}
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

// =============================================================================
// EXPORTS
// =============================================================================

export { Button, AnimatedButton, buttonVariants }
