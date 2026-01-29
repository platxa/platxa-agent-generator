# Ref Forwarding Pattern

Standard pattern for forwarding refs in all components to enable form library integration, focus management, and imperative APIs.

## Overview

All interactive components must support ref forwarding to:
- Integrate with form libraries (React Hook Form, Formik)
- Enable programmatic focus management
- Support measurement and positioning (tooltips, popovers)
- Allow parent components to access DOM nodes

## Basic Pattern

```typescript
import * as React from "react"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant }), className)}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
```

## Component Categories

### 1. Form Input Components

All form inputs MUST forward refs for form library integration.

```typescript
// Input
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn("input-base", className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

// Textarea
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn("textarea-base", className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

// Select
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        className={cn("select-base", className)}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    )
  }
)
Select.displayName = "Select"
```

### 2. Interactive Components

Buttons, links, and clickable elements need refs for focus management.

```typescript
// Button with variants
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

// Link component
const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ className, href, children, ...props }, ref) => {
    return (
      <a
        ref={ref}
        href={href}
        className={cn("link-base", className)}
        {...props}
      >
        {children}
      </a>
    )
  }
)
Link.displayName = "Link"
```

### 3. Container Components

Cards, dialogs, and containers need refs for positioning and measurement.

```typescript
// Card
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("card-base", className)}
      {...props}
    />
  )
)
Card.displayName = "Card"

// Dialog Content
const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, ...props }, ref) => (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dialog-overlay" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn("dialog-content", className)}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
)
DialogContent.displayName = DialogPrimitive.Content.displayName
```

## TypeScript Patterns

### Generic Ref Type

```typescript
// For HTMLElement refs
const Component = React.forwardRef<HTMLDivElement, Props>((props, ref) => ...)

// For specific element types
const Input = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => ...)
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => ...)
const Anchor = React.forwardRef<HTMLAnchorElement, AnchorProps>((props, ref) => ...)

// For SVG elements
const Icon = React.forwardRef<SVGSVGElement, IconProps>((props, ref) => ...)
```

### Props with Ref

```typescript
// Extend HTML attributes for proper typing
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
  label?: string
}

// The ref is handled by forwardRef, not in props
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ error, label, ...props }, ref) => {
    return (
      <div>
        {label && <label>{label}</label>}
        <input ref={ref} {...props} />
        {error && <span className="error">{error}</span>}
      </div>
    )
  }
)
```

### ComponentPropsWithRef

```typescript
// Get props type including ref
type ButtonPropsWithRef = React.ComponentPropsWithRef<typeof Button>

// Get props type without ref
type ButtonPropsWithoutRef = React.ComponentPropsWithoutRef<typeof Button>

// Extract ref type
type ButtonRef = React.ComponentRef<typeof Button>
```

## Polymorphic Components

For components that can render as different elements:

```typescript
type AsProp<C extends React.ElementType> = {
  as?: C
}

type PropsToOmit<C extends React.ElementType, P> = keyof (AsProp<C> & P)

type PolymorphicComponentProp<
  C extends React.ElementType,
  Props = {}
> = React.PropsWithChildren<Props & AsProp<C>> &
  Omit<React.ComponentPropsWithoutRef<C>, PropsToOmit<C, Props>>

type PolymorphicRef<C extends React.ElementType> =
  React.ComponentPropsWithRef<C>["ref"]

type PolymorphicComponentPropWithRef<
  C extends React.ElementType,
  Props = {}
> = PolymorphicComponentProp<C, Props> & { ref?: PolymorphicRef<C> }

// Usage
interface BoxProps {
  color?: string
}

type BoxComponent = <C extends React.ElementType = "div">(
  props: PolymorphicComponentPropWithRef<C, BoxProps>
) => React.ReactElement | null

const Box: BoxComponent = React.forwardRef(
  <C extends React.ElementType = "div">(
    { as, color, children, ...props }: PolymorphicComponentProp<C, BoxProps>,
    ref?: PolymorphicRef<C>
  ) => {
    const Component = as || "div"
    return (
      <Component ref={ref} style={{ color }} {...props}>
        {children}
      </Component>
    )
  }
)
```

## Imperative Handle

For exposing custom methods via ref:

```typescript
interface InputHandle {
  focus: () => void
  blur: () => void
  clear: () => void
  getValue: () => string
  setValue: (value: string) => void
}

interface InputProps {
  defaultValue?: string
  onChange?: (value: string) => void
}

const Input = React.forwardRef<InputHandle, InputProps>(
  ({ defaultValue, onChange }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null)

    React.useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
      clear: () => {
        if (inputRef.current) {
          inputRef.current.value = ""
          onChange?.("")
        }
      },
      getValue: () => inputRef.current?.value ?? "",
      setValue: (value: string) => {
        if (inputRef.current) {
          inputRef.current.value = value
          onChange?.(value)
        }
      }
    }))

    return (
      <input
        ref={inputRef}
        defaultValue={defaultValue}
        onChange={(e) => onChange?.(e.target.value)}
      />
    )
  }
)
Input.displayName = "Input"

// Usage
const formRef = React.useRef<InputHandle>(null)

// Later
formRef.current?.focus()
formRef.current?.clear()
const value = formRef.current?.getValue()
```

## Form Library Integration

### React Hook Form

```typescript
import { useForm } from "react-hook-form"

// Component with forwardRef works seamlessly
const MyForm = () => {
  const { register, handleSubmit } = useForm()

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* register returns ref and other props */}
      <Input {...register("email")} />
      <Input {...register("password")} type="password" />
      <Button type="submit">Submit</Button>
    </form>
  )
}
```

### Formik

```typescript
import { useFormik } from "formik"

const MyForm = () => {
  const formik = useFormik({
    initialValues: { email: "" },
    onSubmit: values => console.log(values)
  })

  const inputRef = React.useRef<HTMLInputElement>(null)

  // Can access DOM node for focus, etc.
  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <form onSubmit={formik.handleSubmit}>
      <Input
        ref={inputRef}
        name="email"
        value={formik.values.email}
        onChange={formik.handleChange}
      />
    </form>
  )
}
```

## Compound Components with Refs

```typescript
// Parent component
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("card", className)} {...props} />
  )
)
Card.displayName = "Card"

// Sub-components
const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("card-header", className)} {...props} />
  )
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("card-title", className)} {...props} />
  )
)
CardTitle.displayName = "CardTitle"

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("card-content", className)} {...props} />
  )
)
CardContent.displayName = "CardContent"

// Export all
export { Card, CardHeader, CardTitle, CardContent }
```

## Radix UI Integration

Radix primitives already support refs. Wrap them properly:

```typescript
import * as DialogPrimitive from "@radix-ui/react-dialog"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger

// Wrap Content with additional styling
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="overlay" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn("dialog-content", className)}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="close-button">
        <X className="h-4 w-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName
```

## Callback Refs

For complex ref scenarios:

```typescript
const MeasuredComponent = () => {
  const [height, setHeight] = React.useState(0)

  const measuredRef = React.useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      setHeight(node.getBoundingClientRect().height)
    }
  }, [])

  return (
    <div ref={measuredRef}>
      Content height: {height}px
    </div>
  )
}
```

## Merging Refs

When you need to use both a forwarded ref and an internal ref:

```typescript
import { useMergeRefs } from "@floating-ui/react"

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (props, forwardedRef) => {
    const internalRef = React.useRef<HTMLInputElement>(null)
    const ref = useMergeRefs([forwardedRef, internalRef])

    // Can use internalRef for internal logic
    React.useEffect(() => {
      console.log(internalRef.current?.value)
    }, [])

    return <input ref={ref} {...props} />
  }
)

// Or manual merge
function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (node: T) => {
    refs.forEach((ref) => {
      if (typeof ref === "function") {
        ref(node)
      } else if (ref != null) {
        (ref as React.MutableRefObject<T>).current = node
      }
    })
  }
}
```

## Validation Checklist

Before component generation is complete:

- [ ] Component uses `React.forwardRef`
- [ ] Ref type matches the root element type
- [ ] `displayName` is set for debugging
- [ ] Props extend appropriate HTML attributes
- [ ] Ref is passed to correct element
- [ ] TypeScript types are correct
- [ ] Works with React Hook Form
- [ ] Focus management functions correctly

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Forgetting displayName | Add `Component.displayName = "Component"` |
| Wrong ref element type | Match ref type to actual DOM element |
| Not spreading props | Include `{...props}` for HTML attributes |
| Breaking ref chain in wrappers | Use ref merging utilities |
| Missing in compound components | Add forwardRef to all sub-components |

## Export

```typescript
export { Button, Input, Textarea, Select, Card }
export type { ButtonProps, InputProps, TextareaProps }
```
