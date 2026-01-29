# Form Component Generator

Complete form system with React Hook Form, Zod validation, and composable form field components.

## Dependencies

```bash
npm install react-hook-form @hookform/resolvers zod
```

## Generated Components

### Form Provider

```typescript
"use client"

import * as React from "react"
import {
  useForm,
  FormProvider,
  useFormContext,
  type UseFormReturn,
  type FieldValues,
  type FieldPath,
  type ControllerProps,
  Controller
} from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { z } from "zod"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

// =============================================================================
// FORM COMPONENT
// =============================================================================

interface FormProps<TSchema extends z.ZodType>
  extends Omit<React.FormHTMLAttributes<HTMLFormElement>, "onSubmit"> {
  schema: TSchema
  defaultValues?: z.infer<TSchema>
  onSubmit: (data: z.infer<TSchema>) => void | Promise<void>
  children: React.ReactNode | ((form: UseFormReturn<z.infer<TSchema>>) => React.ReactNode)
}

function Form<TSchema extends z.ZodType>({
  schema,
  defaultValues,
  onSubmit,
  children,
  className,
  ...props
}: FormProps<TSchema>) {
  const form = useForm<z.infer<TSchema>>({
    resolver: zodResolver(schema),
    defaultValues
  })

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn("space-y-6", className)}
        {...props}
      >
        {typeof children === "function" ? children(form) : children}
      </form>
    </FormProvider>
  )
}

// =============================================================================
// FORM FIELD CONTEXT
// =============================================================================

interface FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue | null>(null)

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState, formState } = useFormContext()

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>")
  }

  const fieldState = getFieldState(fieldContext.name, formState)

  const { id } = itemContext || {}

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState
  }
}

// =============================================================================
// FORM FIELD
// =============================================================================

interface FormFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> extends ControllerProps<TFieldValues, TName> {}

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  ...props
}: FormFieldProps<TFieldValues, TName>) => (
  <FormFieldContext.Provider value={{ name: props.name }}>
    <Controller {...props} />
  </FormFieldContext.Provider>
)

// =============================================================================
// FORM ITEM CONTEXT
// =============================================================================

interface FormItemContextValue {
  id: string
}

const FormItemContext = React.createContext<FormItemContextValue | null>(null)

// =============================================================================
// FORM ITEM
// =============================================================================

const FormItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const id = React.useId()

  return (
    <FormItemContext.Provider value={{ id }}>
      <div ref={ref} className={cn("space-y-2", className)} {...props} />
    </FormItemContext.Provider>
  )
})
FormItem.displayName = "FormItem"

// =============================================================================
// FORM LABEL
// =============================================================================

interface FormLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
}

const FormLabel = React.forwardRef<HTMLLabelElement, FormLabelProps>(
  ({ className, required, children, ...props }, ref) => {
    const { error, formItemId } = useFormField()

    return (
      <Label
        ref={ref}
        className={cn(error && "text-destructive", className)}
        htmlFor={formItemId}
        {...props}
      >
        {children}
        {required && (
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
        )}
      </Label>
    )
  }
)
FormLabel.displayName = "FormLabel"

// =============================================================================
// FORM CONTROL
// =============================================================================

const FormControl = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ ...props }, ref) => {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()

  return (
    <div
      ref={ref}
      id={formItemId}
      aria-describedby={
        !error
          ? formDescriptionId
          : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  )
})
FormControl.displayName = "FormControl"

// =============================================================================
// FORM DESCRIPTION
// =============================================================================

const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { formDescriptionId } = useFormField()

  return (
    <p
      ref={ref}
      id={formDescriptionId}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
})
FormDescription.displayName = "FormDescription"

// =============================================================================
// FORM MESSAGE (Error)
// =============================================================================

const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error?.message) : children

  if (!body) {
    return null
  }

  return (
    <p
      ref={ref}
      id={formMessageId}
      className={cn(
        "text-sm font-medium text-destructive flex items-center gap-1.5",
        className
      )}
      role="alert"
      {...props}
    >
      <AlertCircleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {body}
    </p>
  )
})
FormMessage.displayName = "FormMessage"

// =============================================================================
// ALERT ICON
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

export {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  useFormField
}
```

## Complete Form Example

### Contact Form

```typescript
"use client"

import { z } from "zod"
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

// =============================================================================
// SCHEMA
// =============================================================================

const contactSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters"),
  email: z
    .string()
    .email("Please enter a valid email address"),
  subject: z
    .string()
    .min(5, "Subject must be at least 5 characters")
    .max(100, "Subject must be less than 100 characters"),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(1000, "Message must be less than 1000 characters")
})

type ContactFormData = z.infer<typeof contactSchema>

// =============================================================================
// FORM COMPONENT
// =============================================================================

const ContactForm = () => {
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true)
    try {
      // API call
      await fetch("/api/contact", {
        method: "POST",
        body: JSON.stringify(data)
      })
      // Success handling
    } catch (error) {
      // Error handling
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form
      schema={contactSchema}
      defaultValues={{
        name: "",
        email: "",
        subject: "",
        message: ""
      }}
      onSubmit={handleSubmit}
    >
      {(form) => (
        <>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Name</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="john@example.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="subject"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Subject</FormLabel>
                <FormControl>
                  <Input placeholder="How can we help?" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Message</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Tell us more..."
                    rows={5}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Please provide as much detail as possible.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Send Message"}
          </Button>
        </>
      )}
    </Form>
  )
}
```

## Common Zod Schemas

### User Registration

```typescript
const registrationSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be less than 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z
    .string()
    .email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
})
```

### Login Form

```typescript
const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional()
})
```

### Profile Update

```typescript
const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  dateOfBirth: z.string().optional()
})
```

### Payment Form

```typescript
const paymentSchema = z.object({
  cardNumber: z
    .string()
    .regex(/^\d{16}$/, "Card number must be 16 digits"),
  cardHolder: z.string().min(1, "Cardholder name is required"),
  expiryDate: z
    .string()
    .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Invalid expiry date (MM/YY)"),
  cvv: z
    .string()
    .regex(/^\d{3,4}$/, "CVV must be 3 or 4 digits")
})
```

## Field Types

### Select Field

```typescript
<FormField
  control={form.control}
  name="country"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Country</FormLabel>
      <Select onValueChange={field.onChange} defaultValue={field.value}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Select a country" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="us">United States</SelectItem>
          <SelectItem value="uk">United Kingdom</SelectItem>
          <SelectItem value="ca">Canada</SelectItem>
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Checkbox Field

```typescript
<FormField
  control={form.control}
  name="acceptTerms"
  render={({ field }) => (
    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
      <FormControl>
        <Checkbox
          checked={field.value}
          onCheckedChange={field.onChange}
        />
      </FormControl>
      <div className="space-y-1 leading-none">
        <FormLabel>Accept terms and conditions</FormLabel>
        <FormDescription>
          You agree to our Terms of Service and Privacy Policy.
        </FormDescription>
      </div>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Radio Group Field

```typescript
<FormField
  control={form.control}
  name="plan"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Select Plan</FormLabel>
      <FormControl>
        <RadioGroup
          onValueChange={field.onChange}
          defaultValue={field.value}
          className="flex flex-col space-y-2"
        >
          <FormItem className="flex items-center space-x-3 space-y-0">
            <FormControl>
              <RadioGroupItem value="free" />
            </FormControl>
            <FormLabel className="font-normal">Free</FormLabel>
          </FormItem>
          <FormItem className="flex items-center space-x-3 space-y-0">
            <FormControl>
              <RadioGroupItem value="pro" />
            </FormControl>
            <FormLabel className="font-normal">Pro ($10/month)</FormLabel>
          </FormItem>
        </RadioGroup>
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Date Picker Field

```typescript
<FormField
  control={form.control}
  name="dateOfBirth"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Date of Birth</FormLabel>
      <FormControl>
        <Input type="date" {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### File Upload Field

```typescript
<FormField
  control={form.control}
  name="avatar"
  render={({ field: { value, onChange, ...field } }) => (
    <FormItem>
      <FormLabel>Profile Picture</FormLabel>
      <FormControl>
        <Input
          type="file"
          accept="image/*"
          onChange={(e) => onChange(e.target.files?.[0])}
          {...field}
        />
      </FormControl>
      <FormDescription>Max file size: 5MB</FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

## Advanced Patterns

### Async Validation

```typescript
const usernameSchema = z.object({
  username: z
    .string()
    .min(3)
    .refine(async (username) => {
      const response = await fetch(`/api/check-username?u=${username}`)
      const { available } = await response.json()
      return available
    }, "Username is already taken")
})
```

### Conditional Fields

```typescript
const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("individual"),
    firstName: z.string().min(1),
    lastName: z.string().min(1)
  }),
  z.object({
    type: z.literal("company"),
    companyName: z.string().min(1),
    taxId: z.string().min(1)
  })
])

// In form
const type = form.watch("type")

{type === "individual" && (
  <>
    <FormField name="firstName" ... />
    <FormField name="lastName" ... />
  </>
)}

{type === "company" && (
  <>
    <FormField name="companyName" ... />
    <FormField name="taxId" ... />
  </>
)}
```

### Array Fields

```typescript
import { useFieldArray } from "react-hook-form"

const schema = z.object({
  emails: z.array(
    z.object({
      value: z.string().email()
    })
  ).min(1, "At least one email is required")
})

const EmailListForm = () => {
  const form = useForm({ resolver: zodResolver(schema) })
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "emails"
  })

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {fields.map((field, index) => (
        <div key={field.id} className="flex gap-2">
          <Input {...form.register(`emails.${index}.value`)} />
          <Button type="button" onClick={() => remove(index)}>
            Remove
          </Button>
        </div>
      ))}
      <Button type="button" onClick={() => append({ value: "" })}>
        Add Email
      </Button>
    </form>
  )
}
```

## Form States

### Loading/Submitting

```typescript
{(form) => (
  <>
    {/* Fields */}
    <Button type="submit" disabled={form.formState.isSubmitting}>
      {form.formState.isSubmitting ? (
        <>
          <Spinner className="mr-2 h-4 w-4 animate-spin" />
          Submitting...
        </>
      ) : (
        "Submit"
      )}
    </Button>
  </>
)}
```

### Reset Form

```typescript
<Button
  type="button"
  variant="outline"
  onClick={() => form.reset()}
>
  Reset
</Button>
```

### Dirty Check

```typescript
{form.formState.isDirty && (
  <p className="text-sm text-muted-foreground">
    You have unsaved changes
  </p>
)}
```

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Labels | `FormLabel` with `htmlFor` linked to input |
| Required fields | Visual indicator + validation |
| Error messages | `role="alert"`, `aria-describedby` |
| Focus management | Focus first error on submit |
| Descriptions | `FormDescription` linked via `aria-describedby` |

## Best Practices

| Do | Don't |
|----|-------|
| Validate on blur and submit | Validate on every keystroke |
| Show errors inline near fields | Show all errors at top only |
| Use clear error messages | Use technical jargon |
| Mark required fields | Leave users guessing |
| Disable submit while submitting | Allow double submission |
| Preserve form data on error | Clear form on failed submit |
| Use appropriate input types | Use text for everything |

## Export

```typescript
// components/ui/form.tsx
export {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  useFormField
}
```
