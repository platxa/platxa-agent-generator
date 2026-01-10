# Input Component Generator

Complete input component with validation states, icons, and form integration patterns.

## Generated Component

```typescript
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// =============================================================================
// INPUT VARIANTS
// =============================================================================

const inputVariants = cva(
  [
    // Base styles
    "flex w-full rounded-md border bg-background px-3 py-2",
    "text-base md:text-sm",
    "ring-offset-background",
    "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
    "placeholder:text-muted-foreground",
    // Focus ring (two-color pattern)
    "focus-visible:outline-none",
    "focus-visible:ring-2 focus-visible:ring-ring",
    "focus-visible:ring-offset-2",
    // Disabled state
    "disabled:cursor-not-allowed disabled:opacity-50"
  ],
  {
    variants: {
      variant: {
        default: "border-input",
        error: "border-destructive focus-visible:ring-destructive",
        success: "border-green-500 focus-visible:ring-green-500"
      },
      inputSize: {
        default: "h-10",
        sm: "h-9 px-2.5 text-sm",
        lg: "h-12 px-4 text-base"
      }
    },
    defaultVariants: {
      variant: "default",
      inputSize: "default"
    }
  }
)

// =============================================================================
// INPUT PROPS
// =============================================================================

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  /**
   * Error message to display below input
   */
  error?: string
  /**
   * Success message to display below input
   */
  success?: string
  /**
   * Helper text to display below input
   */
  helperText?: string
  /**
   * Icon to display at the start of the input
   */
  startIcon?: React.ReactNode
  /**
   * Icon to display at the end of the input
   */
  endIcon?: React.ReactNode
  /**
   * Additional content at the end (e.g., button)
   */
  endAdornment?: React.ReactNode
}

// =============================================================================
// INPUT COMPONENT
// =============================================================================

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = "text",
      variant,
      inputSize,
      error,
      success,
      helperText,
      startIcon,
      endIcon,
      endAdornment,
      disabled,
      "aria-invalid": ariaInvalid,
      "aria-describedby": ariaDescribedby,
      ...props
    },
    ref
  ) => {
    // Determine variant from error/success props
    const computedVariant = error ? "error" : success ? "success" : variant

    // Generate unique IDs for accessibility
    const inputId = React.useId()
    const errorId = `${inputId}-error`
    const successId = `${inputId}-success`
    const helperId = `${inputId}-helper`

    // Build aria-describedby
    const describedBy = [
      ariaDescribedby,
      error && errorId,
      success && successId,
      helperText && helperId
    ]
      .filter(Boolean)
      .join(" ") || undefined

    // Has icons or adornments
    const hasStartIcon = !!startIcon
    const hasEndContent = !!endIcon || !!endAdornment

    if (hasStartIcon || hasEndContent) {
      return (
        <div className="space-y-1.5">
          <div className="relative">
            {/* Start Icon */}
            {hasStartIcon && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {startIcon}
              </div>
            )}

            {/* Input */}
            <input
              type={type}
              className={cn(
                inputVariants({ variant: computedVariant, inputSize }),
                hasStartIcon && "pl-10",
                hasEndContent && "pr-10",
                className
              )}
              ref={ref}
              disabled={disabled}
              aria-invalid={error ? true : ariaInvalid}
              aria-describedby={describedBy}
              {...props}
            />

            {/* End Icon/Adornment */}
            {hasEndContent && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {endIcon || endAdornment}
              </div>
            )}
          </div>

          {/* Messages */}
          <InputMessages
            error={error}
            success={success}
            helperText={helperText}
            errorId={errorId}
            successId={successId}
            helperId={helperId}
          />
        </div>
      )
    }

    return (
      <div className="space-y-1.5">
        <input
          type={type}
          className={cn(
            inputVariants({ variant: computedVariant, inputSize }),
            className
          )}
          ref={ref}
          disabled={disabled}
          aria-invalid={error ? true : ariaInvalid}
          aria-describedby={describedBy}
          {...props}
        />

        <InputMessages
          error={error}
          success={success}
          helperText={helperText}
          errorId={errorId}
          successId={successId}
          helperId={helperId}
        />
      </div>
    )
  }
)
Input.displayName = "Input"

// =============================================================================
// INPUT MESSAGES
// =============================================================================

interface InputMessagesProps {
  error?: string
  success?: string
  helperText?: string
  errorId: string
  successId: string
  helperId: string
}

const InputMessages = ({
  error,
  success,
  helperText,
  errorId,
  successId,
  helperId
}: InputMessagesProps) => {
  if (!error && !success && !helperText) return null

  return (
    <div className="space-y-1">
      {error && (
        <p
          id={errorId}
          className="text-sm text-destructive flex items-center gap-1.5"
          role="alert"
        >
          <AlertCircleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {success && !error && (
        <p
          id={successId}
          className="text-sm text-green-600 dark:text-green-500 flex items-center gap-1.5"
        >
          <CheckCircleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {success}
        </p>
      )}

      {helperText && !error && !success && (
        <p id={helperId} className="text-sm text-muted-foreground">
          {helperText}
        </p>
      )}
    </div>
  )
}

// =============================================================================
// ICONS (inline for simplicity)
// =============================================================================

const AlertCircleIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
)

const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
)

export { Input, inputVariants }
export type { InputProps }
```

## Form Field Component

Complete field with label:

```typescript
// =============================================================================
// FORM FIELD
// =============================================================================

export interface FormFieldProps extends InputProps {
  /**
   * Label text
   */
  label: string
  /**
   * Whether the field is required
   */
  required?: boolean
  /**
   * Label position
   */
  labelPosition?: "top" | "left"
}

const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  (
    {
      label,
      required,
      labelPosition = "top",
      id,
      className,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId()
    const inputId = id || generatedId

    if (labelPosition === "left") {
      return (
        <div className={cn("grid grid-cols-[auto_1fr] gap-4 items-start", className)}>
          <Label htmlFor={inputId} required={required} className="pt-2.5">
            {label}
          </Label>
          <Input ref={ref} id={inputId} {...props} />
        </div>
      )
    }

    return (
      <div className={cn("space-y-2", className)}>
        <Label htmlFor={inputId} required={required}>
          {label}
        </Label>
        <Input ref={ref} id={inputId} {...props} />
      </div>
    )
  }
)
FormField.displayName = "FormField"

// =============================================================================
// LABEL COMPONENT
// =============================================================================

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-sm font-medium leading-none",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    >
      {children}
      {required && (
        <span className="text-destructive ml-1" aria-hidden="true">
          *
        </span>
      )}
    </label>
  )
)
Label.displayName = "Label"

export { FormField, Label }
```

## State Examples

### Default State

```typescript
<Input placeholder="Enter your email" />
```

### Error State

```typescript
<Input
  placeholder="Enter your email"
  error="Please enter a valid email address"
  defaultValue="invalid-email"
/>
```

**Appearance:**
- Border: Destructive/red color
- Focus ring: Red color
- Error message: Red text with alert icon

### Success State

```typescript
<Input
  placeholder="Enter your email"
  success="Email is available"
  defaultValue="valid@email.com"
/>
```

**Appearance:**
- Border: Green color
- Focus ring: Green color
- Success message: Green text with check icon

### Disabled State

```typescript
<Input
  placeholder="Cannot edit"
  disabled
  defaultValue="Disabled value"
/>
```

**Appearance:**
- Opacity: 50%
- Cursor: not-allowed
- No interaction

### With Helper Text

```typescript
<Input
  placeholder="Enter your username"
  helperText="Username must be 3-20 characters"
/>
```

## Icon Examples

### Start Icon

```typescript
<Input
  placeholder="Search..."
  startIcon={<SearchIcon className="h-4 w-4" />}
/>
```

### End Icon

```typescript
<Input
  type="email"
  placeholder="Email"
  endIcon={<MailIcon className="h-4 w-4" />}
/>
```

### Password Toggle

```typescript
const PasswordInput = () => {
  const [showPassword, setShowPassword] = React.useState(false)

  return (
    <Input
      type={showPassword ? "text" : "password"}
      placeholder="Enter password"
      endAdornment={
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="text-muted-foreground hover:text-foreground"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <EyeOffIcon className="h-4 w-4" />
          ) : (
            <EyeIcon className="h-4 w-4" />
          )}
        </button>
      }
    />
  )
}
```

### Clearable Input

```typescript
const ClearableInput = () => {
  const [value, setValue] = React.useState("")

  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Type something..."
      endAdornment={
        value && (
          <button
            type="button"
            onClick={() => setValue("")}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Clear input"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )
      }
    />
  )
}
```

## Size Examples

```typescript
// Small
<Input inputSize="sm" placeholder="Small input" />

// Default
<Input inputSize="default" placeholder="Default input" />

// Large
<Input inputSize="lg" placeholder="Large input" />
```

**Size Specifications:**

| Size | Height | Padding | Font |
|------|--------|---------|------|
| sm | 36px (h-9) | 10px (px-2.5) | 14px |
| default | 40px (h-10) | 12px (px-3) | 14px (16px mobile) |
| lg | 48px (h-12) | 16px (px-4) | 16px |

## Input Types

### Text Input

```typescript
<FormField
  label="Full Name"
  type="text"
  placeholder="John Doe"
  required
/>
```

### Email Input

```typescript
<FormField
  label="Email Address"
  type="email"
  placeholder="john@example.com"
  required
  startIcon={<MailIcon className="h-4 w-4" />}
/>
```

### Password Input

```typescript
<FormField
  label="Password"
  type="password"
  placeholder="••••••••"
  required
  helperText="Minimum 8 characters"
/>
```

### Number Input

```typescript
<FormField
  label="Quantity"
  type="number"
  min={1}
  max={100}
  defaultValue={1}
/>
```

### Tel Input

```typescript
<FormField
  label="Phone Number"
  type="tel"
  placeholder="+1 (555) 000-0000"
  startIcon={<PhoneIcon className="h-4 w-4" />}
/>
```

### URL Input

```typescript
<FormField
  label="Website"
  type="url"
  placeholder="https://example.com"
  startIcon={<GlobeIcon className="h-4 w-4" />}
/>
```

### Search Input

```typescript
<Input
  type="search"
  placeholder="Search..."
  startIcon={<SearchIcon className="h-4 w-4" />}
/>
```

### Date Input

```typescript
<FormField
  label="Date of Birth"
  type="date"
/>
```

### File Input

```typescript
<FormField
  label="Upload Document"
  type="file"
  accept=".pdf,.doc,.docx"
  helperText="PDF or Word documents only"
/>
```

## Form Integration

### With React Hook Form

```typescript
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const schema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters")
})

type FormData = z.infer<typeof schema>

const LoginForm = () => {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(schema)
  })

  const onSubmit = (data: FormData) => {
    console.log(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField
        label="Email"
        type="email"
        placeholder="Enter your email"
        error={errors.email?.message}
        {...register("email")}
      />

      <FormField
        label="Password"
        type="password"
        placeholder="Enter your password"
        error={errors.password?.message}
        {...register("password")}
      />

      <Button type="submit" className="w-full">
        Sign In
      </Button>
    </form>
  )
}
```

### Controlled Input

```typescript
const ControlledInput = () => {
  const [value, setValue] = React.useState("")
  const [error, setError] = React.useState<string | undefined>()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setValue(newValue)

    // Validate
    if (newValue.length < 3) {
      setError("Must be at least 3 characters")
    } else {
      setError(undefined)
    }
  }

  return (
    <Input
      value={value}
      onChange={handleChange}
      error={error}
      placeholder="Enter at least 3 characters"
    />
  )
}
```

## Accessibility Checklist

| Requirement | Implementation |
|-------------|----------------|
| Labels | `<label>` with `htmlFor` |
| Required fields | `required` attribute + visual indicator |
| Error messages | `aria-invalid`, `aria-describedby`, `role="alert"` |
| Focus visible | Two-color focus ring |
| Disabled state | `disabled` attribute + visual indication |
| Touch target | Minimum h-10 (40px) |
| Contrast | 4.5:1 text contrast |
| Autocomplete | Native `autocomplete` attributes |

## CSS Variables

```css
/* For custom theming */
:root {
  --input: oklch(0.90 0.01 250);
  --ring: oklch(0.6 0.2 250);
  --destructive: oklch(0.55 0.22 25);
}

.dark {
  --input: oklch(0.25 0.02 250);
  --ring: oklch(0.70 0.18 250);
  --destructive: oklch(0.50 0.20 25);
}
```

## Export

```typescript
// components/ui/input.tsx
export { Input, inputVariants, FormField, Label }
export type { InputProps, FormFieldProps, LabelProps }
```
