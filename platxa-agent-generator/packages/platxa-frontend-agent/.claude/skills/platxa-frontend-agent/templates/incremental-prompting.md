# Incremental Prompting Strategy

Break complex components into sequential generation steps for better quality output. Research shows iterative prompting yields significantly better results than all-at-once generation.

## Core Principle

Instead of generating a complete component in one prompt, break it into focused phases:

```
Phase 1: Skeleton  →  Phase 2: State  →  Phase 3: Styling  →  Phase 4: Polish
   ↓                     ↓                   ↓                    ↓
Structure            Logic/Data          Visual Design        Animation/A11y
```

## The Four Phases

### Phase 1: Skeleton (Structure)

Generate the component's HTML structure and TypeScript interface.

**Focus:**
- Component hierarchy
- Props interface
- Ref forwarding
- Basic HTML elements
- Children placement

**Output Example:**
```typescript
import * as React from "react"

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional header content */
  header?: React.ReactNode
  /** Optional footer content */
  footer?: React.ReactNode
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ header, footer, children, ...props }, ref) => {
    return (
      <div ref={ref} {...props}>
        {header && <div>{header}</div>}
        <div>{children}</div>
        {footer && <div>{footer}</div>}
      </div>
    )
  }
)
Card.displayName = "Card"

export { Card }
```

**Prompt Template:**
```xml
<phase name="skeleton">
  <instruction>
    Generate ONLY the component structure. Do not add:
    - Styling (no className)
    - State management
    - Event handlers (except required ones)
    - Animations
  </instruction>

  <deliverables>
    - TypeScript interface with JSDoc comments
    - React.forwardRef wrapper
    - Basic HTML structure
    - Children/slot placement
    - displayName assignment
  </deliverables>
</phase>
```

---

### Phase 2: State (Logic & Data)

Add state management, event handlers, and data flow.

**Focus:**
- useState/useReducer
- Event handlers
- Controlled/uncontrolled patterns
- Context integration
- Side effects (useEffect)

**Output Example:**
```typescript
import * as React from "react"

export interface AccordionProps {
  /** Items to render */
  items: AccordionItem[]
  /** Allow multiple open items */
  multiple?: boolean
  /** Default open item IDs */
  defaultOpen?: string[]
  /** Controlled open state */
  open?: string[]
  /** Called when open state changes */
  onOpenChange?: (open: string[]) => void
}

const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(
  ({ items, multiple = false, defaultOpen = [], open, onOpenChange, ...props }, ref) => {
    // Internal state for uncontrolled mode
    const [internalOpen, setInternalOpen] = React.useState<string[]>(defaultOpen)

    // Use controlled or uncontrolled state
    const openItems = open ?? internalOpen
    const setOpenItems = onOpenChange ?? setInternalOpen

    const toggleItem = React.useCallback((id: string) => {
      setOpenItems(prev => {
        if (prev.includes(id)) {
          return prev.filter(item => item !== id)
        }
        return multiple ? [...prev, id] : [id]
      })
    }, [multiple, setOpenItems])

    return (
      <div ref={ref} {...props}>
        {items.map(item => (
          <div key={item.id}>
            <button onClick={() => toggleItem(item.id)}>
              {item.title}
            </button>
            {openItems.includes(item.id) && (
              <div>{item.content}</div>
            )}
          </div>
        ))}
      </div>
    )
  }
)
```

**Prompt Template:**
```xml
<phase name="state">
  <instruction>
    Add state management to the skeleton. Focus on:
    - Internal state with useState
    - Controlled/uncontrolled pattern
    - Event handlers with useCallback
    - Derived state with useMemo if needed
  </instruction>

  <patterns>
    - Controlled: Props override internal state
    - Callbacks: Memoized with useCallback
    - Derived: Computed with useMemo
  </patterns>

  <do_not_add>
    - Styling (still no className)
    - Animations
    - Accessibility attributes (next phase)
  </do_not_add>
</phase>
```

---

### Phase 3: Styling (Visual Design)

Apply Tailwind classes, CVA variants, and visual styling.

**Focus:**
- CVA variant definitions
- Tailwind classes
- cn() utility usage
- Responsive design
- Dark mode support

**Output Example:**
```typescript
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const accordionVariants = cva(
  "divide-y divide-border rounded-lg border",
  {
    variants: {
      variant: {
        default: "bg-background",
        filled: "bg-muted/50",
        ghost: "border-none divide-none"
      },
      size: {
        sm: "text-sm",
        default: "text-base",
        lg: "text-lg"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)

const accordionItemVariants = cva(
  "transition-colors",
  {
    variants: {
      variant: {
        default: "hover:bg-muted/50",
        filled: "hover:bg-muted",
        ghost: "hover:bg-muted/30 rounded-md"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
)

const Accordion = React.forwardRef<
  HTMLDivElement,
  AccordionProps & VariantProps<typeof accordionVariants>
>(({ items, variant, size, className, ...props }, ref) => {
  // ... state logic from Phase 2 ...

  return (
    <div
      ref={ref}
      className={cn(accordionVariants({ variant, size }), className)}
      {...props}
    >
      {items.map(item => (
        <div key={item.id} className={cn(accordionItemVariants({ variant }))}>
          <button className="flex w-full items-center justify-between px-4 py-3 font-medium">
            {item.title}
            <ChevronDown className={cn(
              "h-4 w-4 transition-transform",
              openItems.includes(item.id) && "rotate-180"
            )} />
          </button>
          {openItems.includes(item.id) && (
            <div className="px-4 pb-3 text-muted-foreground">
              {item.content}
            </div>
          )}
        </div>
      ))}
    </div>
  )
})
```

**Prompt Template:**
```xml
<phase name="styling">
  <instruction>
    Apply visual styling using Tailwind and CVA.

    Requirements:
    - Define CVA variants for customization
    - Use cn() for all className props
    - Apply consistent spacing (8px grid)
    - Include hover and focus states
    - Support dark mode via CSS variables
  </instruction>

  <patterns>
    <cva>Define base + variants + defaultVariants</cva>
    <cn>Always wrap className with cn()</cn>
    <responsive>Mobile-first with md: and lg: prefixes</responsive>
  </patterns>
</phase>
```

---

### Phase 4: Polish (Animation & Accessibility)

Add animations, ARIA attributes, and final refinements.

**Focus:**
- Framer Motion animations
- ARIA attributes
- Keyboard navigation
- Focus management
- Reduced motion support

**Output Example:**
```typescript
import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

// ... CVA variants from Phase 3 ...

const Accordion = React.forwardRef<
  HTMLDivElement,
  AccordionProps & VariantProps<typeof accordionVariants>
>(({ items, variant, size, className, ...props }, ref) => {
  // ... state logic from Phase 2 ...

  return (
    <div
      ref={ref}
      role="region"
      className={cn(accordionVariants({ variant, size }), className)}
      {...props}
    >
      {items.map((item, index) => (
        <div key={item.id}>
          <h3>
            <button
              id={`accordion-trigger-${item.id}`}
              aria-expanded={openItems.includes(item.id)}
              aria-controls={`accordion-content-${item.id}`}
              onClick={() => toggleItem(item.id)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  // Focus next item
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  // Focus previous item
                }
              }}
              className={cn(
                accordionItemVariants({ variant }),
                "flex w-full items-center justify-between px-4 py-3 font-medium",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              {item.title}
              <motion.div
                animate={{ rotate: openItems.includes(item.id) ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              >
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </motion.div>
            </button>
          </h3>

          <AnimatePresence initial={false}>
            {openItems.includes(item.id) && (
              <motion.div
                id={`accordion-content-${item.id}`}
                role="region"
                aria-labelledby={`accordion-trigger-${item.id}`}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-3 text-muted-foreground">
                  {item.content}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
})
Accordion.displayName = "Accordion"

export { Accordion, accordionVariants }
```

**Prompt Template:**
```xml
<phase name="polish">
  <instruction>
    Add animations and accessibility.

    Animation requirements:
    - Framer Motion for mount/unmount
    - Spring physics for natural motion
    - Respect prefers-reduced-motion

    Accessibility requirements:
    - Appropriate ARIA roles and attributes
    - Keyboard navigation (arrows, Enter, Escape)
    - Focus management
    - Screen reader announcements
  </instruction>

  <checklist>
    - [ ] AnimatePresence for conditional rendering
    - [ ] Spring transitions (not linear)
    - [ ] aria-expanded, aria-controls, aria-labelledby
    - [ ] Keyboard handlers for arrows
    - [ ] Focus ring on interactive elements
    - [ ] Reduced motion check
  </checklist>
</phase>
```

---

## Phase Selection Logic

Not all components need all phases. Select based on complexity:

| Complexity | Phases | Example |
|------------|--------|---------|
| Simple | 1 → 3 | Badge, Avatar |
| Standard | 1 → 2 → 3 | Button, Input |
| Complex | 1 → 2 → 3 → 4 | Accordion, Modal, Tabs |
| Interactive | 2 → 3 → 4 | Form (with existing skeleton) |

### Decision Tree

```
Is it a new component?
├─ Yes: Start at Phase 1 (Skeleton)
└─ No: Start at the phase that needs work

Does it have internal state?
├─ Yes: Include Phase 2 (State)
└─ No: Skip to Phase 3 (Styling)

Does it need variants?
├─ Yes: Include Phase 3 with CVA
└─ No: Basic Tailwind classes only

Does it animate or need ARIA?
├─ Yes: Include Phase 4 (Polish)
└─ No: Component is complete
```

---

## Orchestrator Integration

The orchestrator should decompose complex components:

```typescript
function planIncrementalGeneration(component: ComponentSpec): Phase[] {
  const phases: Phase[] = []

  // Always start with skeleton for new components
  if (!component.existingSkeleton) {
    phases.push({
      name: "skeleton",
      focus: ["interface", "structure", "ref-forwarding"],
      prompt: buildSkeletonPrompt(component)
    })
  }

  // Add state phase if component has interactivity
  if (component.hasState || component.isControlled) {
    phases.push({
      name: "state",
      focus: ["useState", "handlers", "controlled-pattern"],
      prompt: buildStatePrompt(component),
      dependsOn: ["skeleton"]
    })
  }

  // Always include styling
  phases.push({
    name: "styling",
    focus: ["cva", "tailwind", "variants"],
    prompt: buildStylingPrompt(component),
    dependsOn: ["skeleton", "state"].filter(p => phases.some(ph => ph.name === p))
  })

  // Add polish for complex components
  if (component.hasAnimation || component.needsA11y) {
    phases.push({
      name: "polish",
      focus: ["framer-motion", "aria", "keyboard"],
      prompt: buildPolishPrompt(component),
      dependsOn: ["styling"]
    })
  }

  return phases
}
```

---

## Benefits of Incremental Approach

| Benefit | Description |
|---------|-------------|
| **Higher Quality** | Each phase focuses on one concern |
| **Easier Debugging** | Issues isolated to specific phase |
| **Better Types** | Interface defined before implementation |
| **Flexible** | Can skip phases for simple components |
| **Reviewable** | Each phase output can be validated |
| **Composable** | Phases can be reused across components |

---

## Anti-Patterns to Avoid

**❌ All-at-once prompting:**
```
"Create a complete accordion component with variants, animations,
state management, and full accessibility support"
```

**✅ Phased prompting:**
```
Phase 1: "Create accordion skeleton with props interface"
Phase 2: "Add open/close state management"
Phase 3: "Apply CVA variants and Tailwind styling"
Phase 4: "Add Framer Motion animations and ARIA"
```

**❌ Mixing concerns:**
```
"Add a useState hook and also make it animate and also add hover styles"
```

**✅ Focused phases:**
```
"Add controlled/uncontrolled state pattern with useCallback handlers"
```
