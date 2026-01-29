# Dialog/Modal Component Generator

Complete dialog component built on Radix UI with focus trap, backdrop, and Framer Motion animations.

## Generated Component

```typescript
"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

// =============================================================================
// DIALOG ROOT & TRIGGER
// =============================================================================

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

// =============================================================================
// DIALOG OVERLAY (BACKDROP)
// =============================================================================

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

// =============================================================================
// DIALOG CONTENT
// =============================================================================

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /**
   * Show close button in top-right corner
   */
  showCloseButton?: boolean
  /**
   * Size variant
   */
  size?: "sm" | "default" | "lg" | "xl" | "full"
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, showCloseButton = true, size = "default", ...props }, ref) => {
  const sizeClasses = {
    sm: "max-w-sm",
    default: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]"
  }

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          // Positioning
          "fixed left-[50%] top-[50%] z-50",
          "translate-x-[-50%] translate-y-[-50%]",
          // Size
          "w-full",
          sizeClasses[size],
          // Styling
          "rounded-lg border bg-background p-6 shadow-lg",
          // Animation
          "duration-200",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
          "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            className={cn(
              "absolute right-4 top-4",
              "rounded-sm opacity-70 ring-offset-background",
              "transition-opacity hover:opacity-100",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              "disabled:pointer-events-none",
              "data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
            )}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

// =============================================================================
// DIALOG HEADER
// =============================================================================

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

// =============================================================================
// DIALOG FOOTER
// =============================================================================

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

// =============================================================================
// DIALOG TITLE
// =============================================================================

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

// =============================================================================
// DIALOG DESCRIPTION
// =============================================================================

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription
}
```

## Animated Dialog (Framer Motion)

Enhanced animations with AnimatePresence:

```typescript
"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

// =============================================================================
// ANIMATED DIALOG CONTENT
// =============================================================================

interface AnimatedDialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  showCloseButton?: boolean
  size?: "sm" | "default" | "lg" | "xl" | "full"
}

const AnimatedDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  AnimatedDialogContentProps
>(({ className, children, showCloseButton = true, size = "default", ...props }, ref) => {
  const sizeClasses = {
    sm: "max-w-sm",
    default: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]"
  }

  return (
    <DialogPortal forceMount>
      <AnimatePresence>
        {/* Backdrop */}
        <DialogPrimitive.Overlay asChild>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/80"
          />
        </DialogPrimitive.Overlay>

        {/* Content */}
        <DialogPrimitive.Content asChild ref={ref} {...props}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={cn(
              "fixed left-[50%] top-[50%] z-50",
              "translate-x-[-50%] translate-y-[-50%]",
              "w-full",
              sizeClasses[size],
              "rounded-lg border bg-background p-6 shadow-lg",
              className
            )}
          >
            {children}
            {showCloseButton && (
              <DialogPrimitive.Close
                className={cn(
                  "absolute right-4 top-4",
                  "rounded-sm opacity-70 ring-offset-background",
                  "transition-opacity hover:opacity-100",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                )}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            )}
          </motion.div>
        </DialogPrimitive.Content>
      </AnimatePresence>
    </DialogPortal>
  )
})
AnimatedDialogContent.displayName = "AnimatedDialogContent"

export { AnimatedDialogContent }
```

## Basic Usage

### Simple Dialog

```typescript
<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>
        This is a dialog description that explains the purpose.
      </DialogDescription>
    </DialogHeader>
    <div className="py-4">
      <p>Dialog content goes here.</p>
    </div>
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="outline">Cancel</Button>
      </DialogClose>
      <Button>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Controlled Dialog

```typescript
const ControlledDialog = () => {
  const [open, setOpen] = React.useState(false)

  const handleConfirm = () => {
    // Do something
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Open Controlled</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Controlled Dialog</DialogTitle>
        </DialogHeader>
        <p>This dialog is controlled programmatically.</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

## Size Variants

### Small Dialog

```typescript
<DialogContent size="sm">
  <DialogHeader>
    <DialogTitle>Small Dialog</DialogTitle>
  </DialogHeader>
  <p>Compact dialog for simple confirmations.</p>
</DialogContent>
```

### Large Dialog

```typescript
<DialogContent size="lg">
  <DialogHeader>
    <DialogTitle>Large Dialog</DialogTitle>
  </DialogHeader>
  <p>More space for complex content.</p>
</DialogContent>
```

### Full Screen Dialog

```typescript
<DialogContent size="full" className="h-full overflow-y-auto">
  <DialogHeader>
    <DialogTitle>Full Screen Dialog</DialogTitle>
  </DialogHeader>
  <div className="flex-1">
    {/* Lots of content */}
  </div>
</DialogContent>
```

## Common Patterns

### Confirmation Dialog

```typescript
interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  variant?: "default" | "destructive"
}

const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  variant = "default"
}: ConfirmDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent size="sm" showCloseButton={false}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </Button>
        <Button
          variant={variant === "destructive" ? "destructive" : "default"}
          onClick={() => {
            onConfirm()
            onOpenChange(false)
          }}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)

// Usage
<ConfirmDialog
  open={showDeleteConfirm}
  onOpenChange={setShowDeleteConfirm}
  title="Delete Item?"
  description="This action cannot be undone."
  confirmLabel="Delete"
  variant="destructive"
  onConfirm={handleDelete}
/>
```

### Form Dialog

```typescript
const FormDialog = () => {
  const [open, setOpen] = React.useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle form submission
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create New</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Item</DialogTitle>
            <DialogDescription>
              Fill in the details below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <FormField label="Name" required>
              <Input placeholder="Enter name" />
            </FormField>
            <FormField label="Description">
              <Textarea placeholder="Enter description" />
            </FormField>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

### Alert Dialog (Destructive)

```typescript
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"

const AlertDialog = AlertDialogPrimitive.Root
const AlertDialogTrigger = AlertDialogPrimitive.Trigger

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Portal>
    <AlertDialogPrimitive.Overlay
      className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out"
    />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
        "w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        className
      )}
      {...props}
    />
  </AlertDialogPrimitive.Portal>
))

// Usage
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Delete Account</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
      <AlertDialogDescription>
        This will permanently delete your account and all associated data.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction className="bg-destructive text-destructive-foreground">
        Delete Account
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Image Preview Dialog

```typescript
const ImagePreviewDialog = ({ src, alt }: { src: string; alt: string }) => (
  <Dialog>
    <DialogTrigger asChild>
      <button className="cursor-zoom-in">
        <img src={src} alt={alt} className="rounded-lg" />
      </button>
    </DialogTrigger>
    <DialogContent size="xl" className="p-0 overflow-hidden">
      <img src={src} alt={alt} className="w-full h-auto" />
    </DialogContent>
  </Dialog>
)
```

### Scrollable Content Dialog

```typescript
<DialogContent className="max-h-[85vh]">
  <DialogHeader>
    <DialogTitle>Terms of Service</DialogTitle>
  </DialogHeader>
  <div className="overflow-y-auto max-h-[60vh] pr-4">
    {/* Long content */}
    <p>Lorem ipsum dolor sit amet...</p>
    {/* More paragraphs */}
  </div>
  <DialogFooter>
    <Button>I Accept</Button>
  </DialogFooter>
</DialogContent>
```

## Focus Management

Radix UI handles focus management automatically:

1. **Focus trap**: Focus stays within dialog while open
2. **Initial focus**: First focusable element receives focus
3. **Return focus**: Focus returns to trigger when closed

### Custom Initial Focus

```typescript
const DialogWithInitialFocus = () => {
  const inputRef = React.useRef<HTMLInputElement>(null)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open</Button>
      </DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          inputRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>Search</DialogTitle>
        </DialogHeader>
        <Input ref={inputRef} placeholder="Search..." />
      </DialogContent>
    </Dialog>
  )
}
```

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `Escape` | Close dialog |
| `Tab` | Move to next focusable element |
| `Shift+Tab` | Move to previous focusable element |
| `Enter` | Activate focused button |

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Focus trap | Automatic via Radix |
| `role="dialog"` | Automatic via Radix |
| `aria-modal="true"` | Automatic via Radix |
| `aria-labelledby` | Linked to DialogTitle |
| `aria-describedby` | Linked to DialogDescription |
| Close button | Has `sr-only` label |
| Escape closes | Automatic via Radix |
| Return focus | Automatic via Radix |

## CSS Animations

```css
/* For non-Framer-Motion usage */
@keyframes dialog-overlay-show {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes dialog-overlay-hide {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes dialog-content-show {
  from {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes dialog-content-hide {
  from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.96);
  }
}
```

## Best Practices

| Do | Don't |
|----|-------|
| Use for important interactions | Use for minor content |
| Keep content focused and brief | Overload with too much info |
| Provide clear actions (Confirm/Cancel) | Have ambiguous buttons |
| Use `size="sm"` for confirmations | Use full-size for simple confirmations |
| Close on successful action | Leave dialog open after success |
| Use AlertDialog for destructive | Use regular Dialog for destructive |
| Show loading state on actions | Block UI without feedback |

## Export

```typescript
// components/ui/dialog.tsx
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  AnimatedDialogContent
}
```
