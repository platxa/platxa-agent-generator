# Focus Trap for Modals and Dialogs

Implement keyboard focus management that traps focus within modal dialogs for WCAG 2.2 compliance.

## Overview

Focus trapping ensures:
- Focus moves to modal when opened
- Tab/Shift+Tab cycles within modal bounds
- Focus returns to trigger when closed
- Screen readers announce modal properly

## WCAG Requirements

| Criterion | Requirement |
|-----------|-------------|
| 2.1.2 No Keyboard Trap | User can navigate away (via close) |
| 2.4.3 Focus Order | Logical tab order within modal |
| 2.4.7 Focus Visible | Clear focus indicator on all elements |
| 4.1.2 Name, Role, Value | Proper ARIA roles and labels |

## Focusable Elements Query

```typescript
/**
 * CSS selector for all focusable elements
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable]',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

/**
 * Get all focusable elements within a container
 */
const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
  const elements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  return Array.from(elements).filter(el => {
    // Filter out hidden elements
    return el.offsetParent !== null && !el.hidden
  })
}

/**
 * Get first and last focusable elements
 */
const getFocusBoundaries = (container: HTMLElement) => {
  const elements = getFocusableElements(container)
  return {
    first: elements[0] ?? null,
    last: elements[elements.length - 1] ?? null,
    all: elements
  }
}
```

## Core Focus Trap Hook

```typescript
"use client"

import * as React from "react"

interface UseFocusTrapOptions {
  /**
   * Whether the trap is active
   */
  enabled?: boolean
  /**
   * Element to focus when trap activates
   * @default "first" - first focusable element
   */
  initialFocus?: "first" | "container" | HTMLElement | null
  /**
   * Element to focus when trap deactivates
   */
  returnFocus?: HTMLElement | null
  /**
   * Allow focus to escape (for non-modal dialogs)
   */
  allowOutsideClick?: boolean
  /**
   * Callback when escape is pressed
   */
  onEscape?: () => void
}

/**
 * Focus trap hook for modal dialogs
 */
export const useFocusTrap = <T extends HTMLElement = HTMLDivElement>(
  options: UseFocusTrapOptions = {}
): React.RefObject<T> => {
  const {
    enabled = true,
    initialFocus = "first",
    returnFocus,
    allowOutsideClick = false,
    onEscape
  } = options

  const containerRef = React.useRef<T>(null)
  const previousActiveElement = React.useRef<HTMLElement | null>(null)

  // Store the element that had focus before trap activated
  React.useEffect(() => {
    if (enabled) {
      previousActiveElement.current = document.activeElement as HTMLElement
    }
  }, [enabled])

  // Handle initial focus
  React.useEffect(() => {
    if (!enabled || !containerRef.current) return

    const container = containerRef.current

    // Delay to ensure DOM is ready
    requestAnimationFrame(() => {
      if (initialFocus === "first") {
        const { first } = getFocusBoundaries(container)
        first?.focus()
      } else if (initialFocus === "container") {
        container.focus()
      } else if (initialFocus instanceof HTMLElement) {
        initialFocus.focus()
      }
    })
  }, [enabled, initialFocus])

  // Handle keyboard navigation
  React.useEffect(() => {
    if (!enabled || !containerRef.current) return

    const container = containerRef.current

    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle Escape
      if (event.key === "Escape") {
        event.preventDefault()
        onEscape?.()
        return
      }

      // Handle Tab
      if (event.key !== "Tab") return

      const { first, last } = getFocusBoundaries(container)
      if (!first || !last) return

      // Shift + Tab on first element -> go to last
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      }
      // Tab on last element -> go to first
      else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    container.addEventListener("keydown", handleKeyDown)
    return () => container.removeEventListener("keydown", handleKeyDown)
  }, [enabled, onEscape])

  // Handle outside click
  React.useEffect(() => {
    if (!enabled || allowOutsideClick || !containerRef.current) return

    const handleFocusOut = (event: FocusEvent) => {
      const container = containerRef.current
      if (!container) return

      const relatedTarget = event.relatedTarget as HTMLElement | null

      // If focus is moving outside container, bring it back
      if (relatedTarget && !container.contains(relatedTarget)) {
        event.preventDefault()
        const { first } = getFocusBoundaries(container)
        first?.focus()
      }
    }

    const container = containerRef.current
    container.addEventListener("focusout", handleFocusOut)
    return () => container.removeEventListener("focusout", handleFocusOut)
  }, [enabled, allowOutsideClick])

  // Return focus on deactivation
  React.useEffect(() => {
    return () => {
      const target = returnFocus ?? previousActiveElement.current
      target?.focus()
    }
  }, [returnFocus])

  return containerRef
}
```

## FocusTrap Component

```typescript
"use client"

import * as React from "react"

interface FocusTrapProps {
  children: React.ReactNode
  /**
   * Whether the trap is active
   */
  active?: boolean
  /**
   * Where to set initial focus
   */
  initialFocus?: "first" | "container" | React.RefObject<HTMLElement>
  /**
   * Called when Escape is pressed
   */
  onEscape?: () => void
  /**
   * Called when click outside (if not prevented)
   */
  onClickOutside?: () => void
  /**
   * Allow clicks outside to pass through
   */
  allowOutsideClick?: boolean
  /**
   * CSS class for the container
   */
  className?: string
}

export const FocusTrap = React.forwardRef<HTMLDivElement, FocusTrapProps>(
  (
    {
      children,
      active = true,
      initialFocus = "first",
      onEscape,
      onClickOutside,
      allowOutsideClick = false,
      className
    },
    forwardedRef
  ) => {
    const internalRef = React.useRef<HTMLDivElement>(null)
    const ref = (forwardedRef as React.RefObject<HTMLDivElement>) ?? internalRef
    const previousActiveElement = React.useRef<HTMLElement | null>(null)

    // Store previous focus
    React.useEffect(() => {
      if (active) {
        previousActiveElement.current = document.activeElement as HTMLElement
      }
    }, [active])

    // Initial focus
    React.useEffect(() => {
      if (!active || !ref.current) return

      requestAnimationFrame(() => {
        const container = ref.current
        if (!container) return

        if (initialFocus === "first") {
          const { first } = getFocusBoundaries(container)
          first?.focus()
        } else if (initialFocus === "container") {
          container.focus()
        } else if (initialFocus?.current) {
          initialFocus.current.focus()
        }
      })
    }, [active, initialFocus, ref])

    // Keyboard handling
    React.useEffect(() => {
      if (!active || !ref.current) return

      const container = ref.current

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          event.preventDefault()
          onEscape?.()
          return
        }

        if (event.key !== "Tab") return

        const { first, last } = getFocusBoundaries(container)
        if (!first || !last) return

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }

      container.addEventListener("keydown", handleKeyDown)
      return () => container.removeEventListener("keydown", handleKeyDown)
    }, [active, onEscape, ref])

    // Outside click
    React.useEffect(() => {
      if (!active) return

      const handleMouseDown = (event: MouseEvent) => {
        const container = ref.current
        if (!container) return

        if (!container.contains(event.target as Node)) {
          if (!allowOutsideClick) {
            event.preventDefault()
            event.stopPropagation()
          }
          onClickOutside?.()
        }
      }

      document.addEventListener("mousedown", handleMouseDown, true)
      return () => document.removeEventListener("mousedown", handleMouseDown, true)
    }, [active, allowOutsideClick, onClickOutside, ref])

    // Return focus
    React.useEffect(() => {
      return () => {
        if (previousActiveElement.current) {
          previousActiveElement.current.focus()
        }
      }
    }, [])

    return (
      <div
        ref={ref}
        className={className}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    )
  }
)
FocusTrap.displayName = "FocusTrap"
```

## Modal Dialog Implementation

```typescript
"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  description?: string
  className?: string
}

export const Modal = ({
  open,
  onClose,
  children,
  title,
  description,
  className
}: ModalProps) => {
  const contentRef = React.useRef<HTMLDivElement>(null)
  const previousActiveElement = React.useRef<HTMLElement | null>(null)

  // Lock body scroll
  React.useEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement as HTMLElement
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }

    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  // Focus management
  React.useEffect(() => {
    if (!open || !contentRef.current) return

    // Focus first focusable or the close button
    requestAnimationFrame(() => {
      const { first } = getFocusBoundaries(contentRef.current!)
      first?.focus()
    })
  }, [open])

  // Return focus on close
  React.useEffect(() => {
    if (!open && previousActiveElement.current) {
      previousActiveElement.current.focus()
    }
  }, [open])

  // Keyboard handling
  React.useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== "Tab" || !contentRef.current) return

      const { first, last } = getFocusBoundaries(contentRef.current)
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  const titleId = React.useId()
  const descriptionId = React.useId()

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            ref={contentRef}
            className={cn(
              "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2",
              "rounded-lg bg-background p-6 shadow-lg",
              "focus:outline-none",
              className
            )}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
          >
            {/* Close button */}
            <button
              className={cn(
                "absolute right-4 top-4 rounded-sm opacity-70",
                "ring-offset-background transition-opacity",
                "hover:opacity-100",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              )}
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Title */}
            {title && (
              <h2
                id={titleId}
                className="text-lg font-semibold leading-none tracking-tight"
              >
                {title}
              </h2>
            )}

            {/* Description */}
            {description && (
              <p
                id={descriptionId}
                className="mt-2 text-sm text-muted-foreground"
              >
                {description}
              </p>
            )}

            {/* Content */}
            <div className="mt-4">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

## Focus Sentinel Pattern

For complex modals where trap boundaries need explicit markers:

```typescript
interface FocusSentinelProps {
  onFocus: () => void
}

/**
 * Invisible element that catches focus at boundaries
 */
const FocusSentinel = ({ onFocus }: FocusSentinelProps) => (
  <div
    tabIndex={0}
    onFocus={onFocus}
    style={{
      position: "absolute",
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: "hidden",
      clip: "rect(0, 0, 0, 0)",
      whiteSpace: "nowrap",
      border: 0
    }}
    aria-hidden="true"
  />
)

/**
 * Focus trap with sentinel elements at boundaries
 */
export const FocusTrapWithSentinels = ({
  children,
  active = true
}: {
  children: React.ReactNode
  active?: boolean
}) => {
  const contentRef = React.useRef<HTMLDivElement>(null)

  const focusFirst = React.useCallback(() => {
    if (!contentRef.current) return
    const { first } = getFocusBoundaries(contentRef.current)
    first?.focus()
  }, [])

  const focusLast = React.useCallback(() => {
    if (!contentRef.current) return
    const { last } = getFocusBoundaries(contentRef.current)
    last?.focus()
  }, [])

  if (!active) return <>{children}</>

  return (
    <>
      {/* Start sentinel - when focused (shift+tab from first), go to last */}
      <FocusSentinel onFocus={focusLast} />

      <div ref={contentRef}>{children}</div>

      {/* End sentinel - when focused (tab from last), go to first */}
      <FocusSentinel onFocus={focusFirst} />
    </>
  )
}
```

## Radix UI Integration

For shadcn/ui dialogs using Radix primitives:

```typescript
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

// Radix Dialog already includes focus trap!
// Just ensure proper composition:

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/50",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 w-full max-w-lg",
        "-translate-x-1/2 -translate-y-1/2",
        "rounded-lg bg-background p-6 shadow-lg",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className
      )}
      // Radix handles focus trap internally!
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className={cn(
          "absolute right-4 top-4 rounded-sm opacity-70",
          "ring-offset-background transition-opacity",
          "hover:opacity-100",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        )}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

export { Dialog, DialogTrigger, DialogContent, DialogOverlay }
```

## Focus Lock Hook

Alternative approach using `react-focus-lock`:

```typescript
import FocusLock from "react-focus-lock"

interface FocusLockWrapperProps {
  children: React.ReactNode
  active?: boolean
  returnFocus?: boolean
  autoFocus?: boolean
}

/**
 * Wrapper using react-focus-lock library
 * npm install react-focus-lock
 */
export const FocusLockWrapper = ({
  children,
  active = true,
  returnFocus = true,
  autoFocus = true
}: FocusLockWrapperProps) => (
  <FocusLock
    disabled={!active}
    returnFocus={returnFocus}
    autoFocus={autoFocus}
  >
    {children}
  </FocusLock>
)
```

## Nested Focus Traps

For dialogs that open other dialogs:

```typescript
"use client"

import * as React from "react"

interface FocusTrapStackItem {
  id: string
  returnTo: HTMLElement | null
}

const FocusTrapStackContext = React.createContext<{
  push: (id: string) => void
  pop: (id: string) => void
  isTop: (id: string) => boolean
}>({
  push: () => {},
  pop: () => {},
  isTop: () => false
})

export const FocusTrapStackProvider = ({
  children
}: {
  children: React.ReactNode
}) => {
  const stackRef = React.useRef<FocusTrapStackItem[]>([])

  const push = React.useCallback((id: string) => {
    stackRef.current.push({
      id,
      returnTo: document.activeElement as HTMLElement
    })
  }, [])

  const pop = React.useCallback((id: string) => {
    const index = stackRef.current.findIndex(item => item.id === id)
    if (index !== -1) {
      const item = stackRef.current.splice(index, 1)[0]
      // Return focus
      requestAnimationFrame(() => {
        item.returnTo?.focus()
      })
    }
  }, [])

  const isTop = React.useCallback((id: string) => {
    const stack = stackRef.current
    return stack.length > 0 && stack[stack.length - 1].id === id
  }, [])

  return (
    <FocusTrapStackContext.Provider value={{ push, pop, isTop }}>
      {children}
    </FocusTrapStackContext.Provider>
  )
}

/**
 * Hook for managing nested focus traps
 */
export const useNestedFocusTrap = (id: string, active: boolean) => {
  const { push, pop, isTop } = React.useContext(FocusTrapStackContext)

  React.useEffect(() => {
    if (active) {
      push(id)
    }

    return () => {
      pop(id)
    }
  }, [active, id, push, pop])

  return { isTopTrap: isTop(id) }
}
```

## Accessibility Testing

```typescript
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

describe("FocusTrap", () => {
  it("traps focus within container", async () => {
    const user = userEvent.setup()

    render(
      <FocusTrap active>
        <button>First</button>
        <button>Middle</button>
        <button>Last</button>
      </FocusTrap>
    )

    // Focus should start on first button
    expect(screen.getByText("First")).toHaveFocus()

    // Tab to last
    await user.tab()
    await user.tab()
    expect(screen.getByText("Last")).toHaveFocus()

    // Tab should wrap to first
    await user.tab()
    expect(screen.getByText("First")).toHaveFocus()

    // Shift+Tab should wrap to last
    await user.tab({ shift: true })
    expect(screen.getByText("Last")).toHaveFocus()
  })

  it("returns focus on close", async () => {
    const user = userEvent.setup()

    const Wrapper = () => {
      const [open, setOpen] = React.useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          {open && (
            <FocusTrap active onEscape={() => setOpen(false)}>
              <button>Inside</button>
            </FocusTrap>
          )}
        </>
      )
    }

    render(<Wrapper />)

    const openButton = screen.getByText("Open")
    await user.click(openButton)

    // Focus should be inside modal
    expect(screen.getByText("Inside")).toHaveFocus()

    // Press Escape
    await user.keyboard("{Escape}")

    // Focus should return to trigger
    expect(openButton).toHaveFocus()
  })

  it("calls onEscape when Escape pressed", async () => {
    const user = userEvent.setup()
    const onEscape = jest.fn()

    render(
      <FocusTrap active onEscape={onEscape}>
        <button>Button</button>
      </FocusTrap>
    )

    await user.keyboard("{Escape}")
    expect(onEscape).toHaveBeenCalledTimes(1)
  })
})
```

## Best Practices

| Do | Don't |
|----|-------|
| Return focus to trigger on close | Leave focus stranded |
| Include visible close button | Rely only on Escape key |
| Use proper ARIA roles | Skip role="dialog" |
| Handle Escape key | Ignore keyboard dismissal |
| Lock body scroll | Allow background scroll |
| Focus first interactive element | Focus the container |
| Support nested traps | Break when dialogs stack |

## Export

```typescript
export {
  // Core
  useFocusTrap,
  FocusTrap,
  getFocusableElements,
  getFocusBoundaries,
  FOCUSABLE_SELECTOR,

  // Patterns
  FocusSentinel,
  FocusTrapWithSentinels,
  FocusLockWrapper,

  // Nested
  FocusTrapStackProvider,
  useNestedFocusTrap,

  // Components
  Modal,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogOverlay
}
export type { UseFocusTrapOptions, FocusTrapProps, ModalProps }
```
