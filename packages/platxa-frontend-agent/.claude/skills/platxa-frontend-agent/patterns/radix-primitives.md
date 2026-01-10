# Radix UI Primitive Integration

Patterns for integrating Radix UI primitives into generated components. Radix provides unstyled, accessible primitives that handle complex behavior while allowing full styling control.

## Why Radix Primitives?

| Aspect | Custom Implementation | Radix Primitive |
|--------|----------------------|-----------------|
| Accessibility | Manual ARIA, testing | Built-in, tested |
| Keyboard Nav | Custom handlers | Automatic |
| Focus Trapping | Complex logic | One prop |
| Development Time | Days | Hours |
| Edge Cases | Easy to miss | Already handled |

## Primitive Categories

### Dialog/Modal

```typescript
import * as Dialog from "@radix-ui/react-dialog"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ModalProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
  title: string
  description?: string
  children: React.ReactNode
}

export function Modal({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}

      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            {/* Overlay */}
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>

            {/* Content */}
            <Dialog.Content asChild>
              <motion.div
                className={cn(
                  "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
                  "w-full max-w-md rounded-lg bg-background p-6 shadow-xl",
                  "focus:outline-none"
                )}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <Dialog.Title className="text-lg font-semibold">
                  {title}
                </Dialog.Title>

                {description && (
                  <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                    {description}
                  </Dialog.Description>
                )}

                <div className="mt-4">{children}</div>

                <Dialog.Close asChild>
                  <button
                    className={cn(
                      "absolute right-4 top-4 rounded-sm opacity-70",
                      "hover:opacity-100 focus:outline-none focus:ring-2",
                      "focus:ring-ring focus:ring-offset-2"
                    )}
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
```

**Key Features:**
- `Dialog.Root`: Manages open state
- `Dialog.Portal`: Renders outside DOM hierarchy
- `Dialog.Overlay`: Click-outside handling
- `Dialog.Content`: Focus trap, Escape to close
- `Dialog.Close`: Auto-closes dialog

---

### Dropdown Menu

```typescript
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { motion } from "framer-motion"
import { Check, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

const menuVariants = {
  hidden: { opacity: 0, scale: 0.95, y: -10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", stiffness: 400, damping: 25 }
  },
  exit: { opacity: 0, scale: 0.95, y: -10 }
}

export function Dropdown({ trigger, children }: DropdownProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content asChild sideOffset={8}>
          <motion.div
            className={cn(
              "min-w-[180px] rounded-md border bg-popover p-1",
              "shadow-md"
            )}
            variants={menuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {children}
          </motion.div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

// Menu Items
export const DropdownItem = React.forwardRef<
  HTMLDivElement,
  DropdownMenu.DropdownMenuItemProps
>(({ className, children, ...props }, ref) => (
  <DropdownMenu.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center",
      "rounded-sm px-2 py-1.5 text-sm outline-none",
      "focus:bg-accent focus:text-accent-foreground",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    {children}
  </DropdownMenu.Item>
))

// Checkbox Item
export const DropdownCheckboxItem = React.forwardRef<
  HTMLDivElement,
  DropdownMenu.DropdownMenuCheckboxItemProps
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenu.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center",
      "rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
      "focus:bg-accent focus:text-accent-foreground",
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenu.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenu.ItemIndicator>
    </span>
    {children}
  </DropdownMenu.CheckboxItem>
))

// Submenu
export function DropdownSubmenu({ trigger, children }: SubmenuProps) {
  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger
        className={cn(
          "flex cursor-pointer select-none items-center",
          "rounded-sm px-2 py-1.5 text-sm outline-none",
          "focus:bg-accent data-[state=open]:bg-accent"
        )}
      >
        {trigger}
        <ChevronRight className="ml-auto h-4 w-4" />
      </DropdownMenu.SubTrigger>

      <DropdownMenu.Portal>
        <DropdownMenu.SubContent
          className={cn(
            "min-w-[180px] rounded-md border bg-popover p-1",
            "shadow-md"
          )}
          sideOffset={4}
        >
          {children}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  )
}
```

**Key Features:**
- Arrow key navigation
- Typeahead search
- Nested submenus
- Checkbox/Radio items
- Auto positioning

---

### Tabs

```typescript
import * as Tabs from "@radix-ui/react-tabs"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface TabsProps {
  tabs: Array<{
    id: string
    label: string
    content: React.ReactNode
  }>
  defaultValue?: string
}

export function AnimatedTabs({ tabs, defaultValue }: TabsProps) {
  const [activeTab, setActiveTab] = React.useState(defaultValue ?? tabs[0].id)

  return (
    <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
      <Tabs.List
        className={cn(
          "relative flex border-b",
          "before:absolute before:bottom-0 before:left-0",
          "before:h-px before:w-full before:bg-border"
        )}
      >
        {tabs.map((tab) => (
          <Tabs.Trigger
            key={tab.id}
            value={tab.id}
            className={cn(
              "relative px-4 py-2 text-sm font-medium",
              "text-muted-foreground hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2",
              "focus-visible:ring-ring focus-visible:ring-offset-2",
              "data-[state=active]:text-foreground"
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {tabs.map((tab) => (
        <Tabs.Content
          key={tab.id}
          value={tab.id}
          className="mt-4 focus:outline-none"
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {tab.content}
          </motion.div>
        </Tabs.Content>
      ))}
    </Tabs.Root>
  )
}
```

**Key Features:**
- Automatic ARIA roles
- Arrow key navigation
- Shared layout animation
- Focus management

---

### Accordion

```typescript
import * as Accordion from "@radix-ui/react-accordion"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface AccordionProps {
  items: Array<{
    id: string
    title: string
    content: React.ReactNode
  }>
  type?: "single" | "multiple"
  defaultValue?: string[]
}

export function AnimatedAccordion({
  items,
  type = "single",
  defaultValue
}: AccordionProps) {
  return (
    <Accordion.Root
      type={type}
      defaultValue={defaultValue}
      className="divide-y divide-border rounded-lg border"
    >
      {items.map((item) => (
        <Accordion.Item key={item.id} value={item.id}>
          <Accordion.Header>
            <Accordion.Trigger
              className={cn(
                "flex w-full items-center justify-between",
                "px-4 py-3 text-sm font-medium",
                "hover:bg-muted/50 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-ring focus-visible:ring-inset",
                "[&[data-state=open]>svg]:rotate-180"
              )}
            >
              {item.title}
              <ChevronDown className="h-4 w-4 transition-transform duration-200" />
            </Accordion.Trigger>
          </Accordion.Header>

          <Accordion.Content
            className={cn(
              "overflow-hidden",
              "data-[state=open]:animate-accordion-down",
              "data-[state=closed]:animate-accordion-up"
            )}
          >
            <div className="px-4 pb-3 text-sm text-muted-foreground">
              {item.content}
            </div>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  )
}

// Add to globals.css
/*
@keyframes accordion-down {
  from { height: 0; }
  to { height: var(--radix-accordion-content-height); }
}

@keyframes accordion-up {
  from { height: var(--radix-accordion-content-height); }
  to { height: 0; }
}

.animate-accordion-down {
  animation: accordion-down 200ms ease-out;
}

.animate-accordion-up {
  animation: accordion-up 200ms ease-out;
}
*/
```

**Key Features:**
- Single or multiple expansion
- CSS variable for height animation
- Proper heading structure
- Keyboard navigation

---

### Tooltip

```typescript
import * as Tooltip from "@radix-ui/react-tooltip"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
  delayDuration?: number
}

export function AnimatedTooltip({
  content,
  children,
  side = "top",
  delayDuration = 300
}: TooltipProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Tooltip.Provider delayDuration={delayDuration}>
      <Tooltip.Root open={open} onOpenChange={setOpen}>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>

        <AnimatePresence>
          {open && (
            <Tooltip.Portal forceMount>
              <Tooltip.Content
                side={side}
                sideOffset={4}
                asChild
              >
                <motion.div
                  className={cn(
                    "z-50 rounded-md bg-primary px-3 py-1.5",
                    "text-xs text-primary-foreground shadow-md"
                  )}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.1 }}
                >
                  {content}
                  <Tooltip.Arrow className="fill-primary" />
                </motion.div>
              </Tooltip.Content>
            </Tooltip.Portal>
          )}
        </AnimatePresence>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
```

---

### Select

```typescript
import * as Select from "@radix-ui/react-select"
import { motion } from "framer-motion"
import { Check, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface SelectProps {
  options: Array<{ value: string; label: string; disabled?: boolean }>
  placeholder?: string
  value?: string
  onValueChange?: (value: string) => void
}

export function AnimatedSelect({
  options,
  placeholder = "Select...",
  value,
  onValueChange
}: SelectProps) {
  return (
    <Select.Root value={value} onValueChange={onValueChange}>
      <Select.Trigger
        className={cn(
          "flex h-10 w-full items-center justify-between",
          "rounded-md border border-input bg-background px-3 py-2",
          "text-sm ring-offset-background placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className={cn(
            "relative z-50 min-w-[8rem] overflow-hidden",
            "rounded-md border bg-popover text-popover-foreground shadow-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2",
            "data-[side=top]:slide-in-from-bottom-2"
          )}
          position="popper"
          sideOffset={4}
        >
          <Select.ScrollUpButton className="flex cursor-default items-center justify-center py-1">
            <ChevronUp className="h-4 w-4" />
          </Select.ScrollUpButton>

          <Select.Viewport className="p-1">
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  "relative flex w-full cursor-pointer select-none items-center",
                  "rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
                  "focus:bg-accent focus:text-accent-foreground",
                  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                )}
              >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  <Select.ItemIndicator>
                    <Check className="h-4 w-4" />
                  </Select.ItemIndicator>
                </span>
                <Select.ItemText>{option.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>

          <Select.ScrollDownButton className="flex cursor-default items-center justify-center py-1">
            <ChevronDown className="h-4 w-4" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
```

---

### Popover

```typescript
import * as Popover from "@radix-ui/react-popover"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface PopoverProps {
  trigger: React.ReactNode
  children: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
}

export function AnimatedPopover({
  trigger,
  children,
  side = "bottom"
}: PopoverProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>

      <AnimatePresence>
        {open && (
          <Popover.Portal forceMount>
            <Popover.Content
              side={side}
              sideOffset={8}
              asChild
            >
              <motion.div
                className={cn(
                  "z-50 w-72 rounded-md border bg-popover p-4",
                  "text-popover-foreground shadow-md outline-none"
                )}
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                {children}
                <Popover.Close
                  className={cn(
                    "absolute right-2 top-2 rounded-sm opacity-70",
                    "hover:opacity-100 focus:outline-none focus:ring-2",
                    "focus:ring-ring"
                  )}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </Popover.Close>
                <Popover.Arrow className="fill-popover" />
              </motion.div>
            </Popover.Content>
          </Popover.Portal>
        )}
      </AnimatePresence>
    </Popover.Root>
  )
}
```

---

## Primitive Selection Guide

| Component Need | Radix Primitive | Key Props |
|----------------|-----------------|-----------|
| Modal/Dialog | Dialog | open, onOpenChange, modal |
| Menu | DropdownMenu | - |
| Context Menu | ContextMenu | - |
| Select dropdown | Select | value, onValueChange |
| Autocomplete | Combobox | - |
| Tabs | Tabs | value, onValueChange |
| Accordion | Accordion | type, value |
| Tooltip | Tooltip | delayDuration |
| Popover | Popover | - |
| Toast | Toast | type, duration |
| Slider | Slider | value, onValueChange, step |
| Switch | Switch | checked, onCheckedChange |
| Checkbox | Checkbox | checked, onCheckedChange |
| Radio Group | RadioGroup | value, onValueChange |
| Toggle | Toggle | pressed, onPressedChange |
| Toggle Group | ToggleGroup | type, value |
| Progress | Progress | value, max |
| Scroll Area | ScrollArea | - |
| Separator | Separator | orientation |
| Avatar | Avatar | - |
| Aspect Ratio | AspectRatio | ratio |
| Collapsible | Collapsible | open, onOpenChange |
| Hover Card | HoverCard | openDelay |
| Navigation Menu | NavigationMenu | - |
| Alert Dialog | AlertDialog | - |

---

## Integration Patterns

### asChild Pattern

Use `asChild` to render as a different element while keeping Radix behavior:

```typescript
// Render trigger as custom button
<Dialog.Trigger asChild>
  <Button variant="outline">Open Dialog</Button>
</Dialog.Trigger>

// Render content with motion
<Dialog.Content asChild>
  <motion.div animate={{ opacity: 1 }}>
    Content here
  </motion.div>
</Dialog.Content>
```

### forceMount for Animations

Use `forceMount` to control mounting with AnimatePresence:

```typescript
<AnimatePresence>
  {open && (
    <Dialog.Portal forceMount>
      <Dialog.Overlay forceMount asChild>
        <motion.div exit={{ opacity: 0 }} />
      </Dialog.Overlay>
    </Dialog.Portal>
  )}
</AnimatePresence>
```

### Data Attributes for Styling

Radix exposes state via data attributes:

```css
/* Style based on state */
[data-state="open"] { /* open state styles */ }
[data-state="closed"] { /* closed state styles */ }
[data-disabled] { /* disabled styles */ }
[data-highlighted] { /* keyboard focus styles */ }
```

---

## Component Generator Integration

The component-generator uses these patterns when complexity requires primitives:

```typescript
function selectPrimitive(spec: ComponentSpec): RadixPrimitive | null {
  const primitiveMap = {
    modal: "Dialog",
    dropdown: "DropdownMenu",
    select: "Select",
    tabs: "Tabs",
    accordion: "Accordion",
    tooltip: "Tooltip",
    popover: "Popover"
  }

  return primitiveMap[spec.type] ?? null
}
```
