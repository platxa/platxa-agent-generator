import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

// =============================================================================
// CHECKBOX VARIANTS
// =============================================================================

const checkboxVariants = cva(
  [
    // Base styles
    "peer shrink-0 rounded border",
    "transition-colors",
    // Focus styles (two-color pattern for WCAG 2.2)
    "focus-visible:outline-none",
    "focus-visible:ring-2 focus-visible:ring-ring",
    "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    // Disabled state
    "disabled:cursor-not-allowed disabled:opacity-50",
    // Checked state
    "data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground",
  ],
  {
    variants: {
      size: {
        default: "h-4 w-4",
        sm: "h-3.5 w-3.5",
        lg: "h-5 w-5",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

// =============================================================================
// CHECKBOX PROPS
// =============================================================================

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size">,
    VariantProps<typeof checkboxVariants> {
  /**
   * Controlled checked state
   */
  checked?: boolean
  /**
   * Default checked state for uncontrolled usage
   */
  defaultChecked?: boolean
  /**
   * Callback when checked state changes
   */
  onCheckedChange?: (checked: boolean) => void
}

// =============================================================================
// CHECKBOX COMPONENT
// =============================================================================

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      className,
      size,
      checked,
      defaultChecked,
      onCheckedChange,
      onChange,
      ...props
    },
    ref
  ) => {
    const [internalChecked, setInternalChecked] = React.useState(
      defaultChecked ?? false
    )

    const isControlled = checked !== undefined
    const isChecked = isControlled ? checked : internalChecked

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newChecked = event.target.checked

      if (!isControlled) {
        setInternalChecked(newChecked)
      }

      onCheckedChange?.(newChecked)
      onChange?.(event)
    }

    return (
      <div className="relative inline-flex items-center">
        <input
          type="checkbox"
          ref={ref}
          checked={isChecked}
          onChange={handleChange}
          className="sr-only peer"
          {...props}
        />
        <div
          data-state={isChecked ? "checked" : "unchecked"}
          className={cn(
            checkboxVariants({ size }),
            "border-input bg-background",
            "flex items-center justify-center",
            className
          )}
          aria-hidden="true"
        >
          {isChecked && (
            <Check
              className={cn(
                "text-current",
                size === "sm" && "h-2.5 w-2.5",
                size === "lg" && "h-4 w-4",
                (!size || size === "default") && "h-3 w-3"
              )}
              strokeWidth={3}
            />
          )}
        </div>
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

// =============================================================================
// EXPORTS
// =============================================================================

export { Checkbox, checkboxVariants }
