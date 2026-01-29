import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// =============================================================================
// LABEL VARIANTS
// =============================================================================

const labelVariants = cva(
  [
    "text-sm font-medium leading-none",
    "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
  ],
  {
    variants: {
      variant: {
        default: "text-foreground",
        muted: "text-muted-foreground",
        error: "text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// =============================================================================
// LABEL PROPS
// =============================================================================

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement>,
    VariantProps<typeof labelVariants> {
  /**
   * Whether the associated field is required
   */
  required?: boolean
}

// =============================================================================
// LABEL COMPONENT
// =============================================================================

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, variant, required, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(labelVariants({ variant }), className)}
      {...props}
    >
      {children}
      {required && (
        <span className="ml-1 text-destructive" aria-hidden="true">
          *
        </span>
      )}
    </label>
  )
)
Label.displayName = "Label"

// =============================================================================
// EXPORTS
// =============================================================================

export { Label, labelVariants }
