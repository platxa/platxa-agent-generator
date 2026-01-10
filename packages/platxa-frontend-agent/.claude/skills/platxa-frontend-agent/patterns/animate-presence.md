# AnimatePresence for Mount/Unmount Transitions

AnimatePresence enables exit animations when components are removed from the React tree. Without it, elements disappear instantly. With it, they can fade out, slide away, or perform any exit animation.

## Core Concept

```typescript
import { motion, AnimatePresence } from "framer-motion"

// Without AnimatePresence - element disappears instantly
{isVisible && <motion.div exit={{ opacity: 0 }} />}  // exit never runs

// With AnimatePresence - exit animation plays before removal
<AnimatePresence>
  {isVisible && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    />
  )}
</AnimatePresence>
```

## Basic Usage

### Fade In/Out

```typescript
const FadeComponent = ({ isVisible }: { isVisible: boolean }) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="p-4 bg-card rounded-lg"
      >
        Content fades in and out
      </motion.div>
    )}
  </AnimatePresence>
)
```

### Slide In/Out

```typescript
const SlideComponent = ({ isVisible }: { isVisible: boolean }) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 20, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="p-4 bg-card rounded-lg"
      >
        Content slides in from left, out to right
      </motion.div>
    )}
  </AnimatePresence>
)
```

### Scale In/Out

```typescript
const ScaleComponent = ({ isVisible }: { isVisible: boolean }) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="p-4 bg-card rounded-lg"
      >
        Content scales in and out
      </motion.div>
    )}
  </AnimatePresence>
)
```

## Animation Presets

### Transition Variants

```typescript
export const presenceVariants = {
  // Fade
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 }
  },

  // Fade up
  fadeUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { type: "spring", stiffness: 300, damping: 25 }
  },

  // Fade down
  fadeDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
    transition: { type: "spring", stiffness: 300, damping: 25 }
  },

  // Slide right
  slideRight: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
    transition: { type: "spring", stiffness: 300, damping: 25 }
  },

  // Slide left
  slideLeft: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: { type: "spring", stiffness: 300, damping: 25 }
  },

  // Scale
  scale: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
    transition: { type: "spring", stiffness: 300, damping: 25 }
  },

  // Scale from center
  scaleCenter: {
    initial: { opacity: 0, scale: 0 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0 },
    transition: { type: "spring", stiffness: 400, damping: 25 }
  },

  // Expand
  expand: {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: "auto" },
    exit: { opacity: 0, height: 0 },
    transition: { duration: 0.2 }
  }
}

// Usage
<motion.div {...presenceVariants.fadeUp} />
```

## Common UI Patterns

### Modal/Dialog

```typescript
interface DialogProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

const Dialog = ({ open, onClose, children }: DialogProps) => (
  <AnimatePresence>
    {open && (
      <>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 z-40"
        />

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
        >
          <div className="bg-background rounded-lg shadow-xl max-w-md w-full p-6">
            {children}
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
)
```

### Toast/Notification

```typescript
interface Toast {
  id: string
  message: string
  type: "success" | "error" | "info"
}

const ToastContainer = ({ toasts }: { toasts: Toast[] }) => (
  <div className="fixed bottom-4 right-4 space-y-2 z-50">
    <AnimatePresence>
      {toasts.map(toast => (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, x: 100, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 100, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className={cn(
            "px-4 py-3 rounded-lg shadow-lg",
            toast.type === "success" && "bg-green-500 text-white",
            toast.type === "error" && "bg-destructive text-destructive-foreground",
            toast.type === "info" && "bg-primary text-primary-foreground"
          )}
        >
          {toast.message}
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
)
```

### Dropdown Menu

```typescript
const Dropdown = ({ isOpen, children }: DropdownProps) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="absolute top-full mt-1 py-1 bg-popover rounded-md shadow-lg border"
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
)
```

### Tooltip

```typescript
const Tooltip = ({ isVisible, content, children }: TooltipProps) => (
  <div className="relative inline-block">
    {children}
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 5, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 5, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-foreground text-background text-sm rounded"
        >
          {content}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
)
```

### Sidebar/Drawer

```typescript
const Sidebar = ({ isOpen, onClose, children }: SidebarProps) => (
  <AnimatePresence>
    {isOpen && (
      <>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 z-40"
        />

        {/* Sidebar */}
        <motion.aside
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed left-0 top-0 bottom-0 w-80 bg-background z-50 shadow-xl"
        >
          {children}
        </motion.aside>
      </>
    )}
  </AnimatePresence>
)
```

### Accordion/Collapse

```typescript
const Accordion = ({ isExpanded, children }: AccordionProps) => (
  <AnimatePresence initial={false}>
    {isExpanded && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="overflow-hidden"
      >
        <div className="py-4">{children}</div>
      </motion.div>
    )}
  </AnimatePresence>
)
```

### Tab Content

```typescript
const TabContent = ({ activeTab, tabs }: TabContentProps) => (
  <AnimatePresence mode="wait">
    <motion.div
      key={activeTab}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
    >
      {tabs.find(t => t.id === activeTab)?.content}
    </motion.div>
  </AnimatePresence>
)
```

## AnimatePresence Props

### mode

Controls how multiple children animate:

```typescript
// "sync" (default) - All children animate simultaneously
<AnimatePresence mode="sync">
  {items.map(item => <motion.div key={item.id} />)}
</AnimatePresence>

// "wait" - Wait for exit to complete before entering
<AnimatePresence mode="wait">
  <motion.div key={currentPage} />
</AnimatePresence>

// "popLayout" - Exiting elements pop out of layout flow
<AnimatePresence mode="popLayout">
  {items.map(item => <motion.div key={item.id} />)}
</AnimatePresence>
```

### initial

Skip initial animation on first render:

```typescript
// With initial={false}, no animation on mount
<AnimatePresence initial={false}>
  {isVisible && (
    <motion.div
      initial={{ opacity: 0 }}  // Skipped on first render
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    />
  )}
</AnimatePresence>
```

### onExitComplete

Callback when all exit animations complete:

```typescript
<AnimatePresence onExitComplete={() => console.log("Exit complete")}>
  {isVisible && <motion.div exit={{ opacity: 0 }} />}
</AnimatePresence>
```

## List Animations

### Animated List

```typescript
interface Item {
  id: string
  content: string
}

const AnimatedList = ({ items }: { items: Item[] }) => (
  <ul className="space-y-2">
    <AnimatePresence>
      {items.map((item, index) => (
        <motion.li
          key={item.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ delay: index * 0.05 }}
          className="p-4 bg-card rounded-lg"
        >
          {item.content}
        </motion.li>
      ))}
    </AnimatePresence>
  </ul>
)
```

### Reorderable List

```typescript
import { Reorder, AnimatePresence } from "framer-motion"

const ReorderableList = ({ items, setItems }: ReorderableListProps) => (
  <Reorder.Group values={items} onReorder={setItems} className="space-y-2">
    <AnimatePresence>
      {items.map(item => (
        <Reorder.Item
          key={item.id}
          value={item}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="p-4 bg-card rounded-lg cursor-grab"
        >
          {item.content}
        </Reorder.Item>
      ))}
    </AnimatePresence>
  </Reorder.Group>
)
```

## Page Transitions

### Route Transitions

```typescript
// With React Router
const PageTransition = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

// Usage
<PageTransition>
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/about" element={<About />} />
  </Routes>
</PageTransition>
```

### Crossfade Pages

```typescript
const CrossfadeTransition = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
```

## Radix UI Integration

Use `forceMount` with Radix primitives for AnimatePresence:

```typescript
import * as Dialog from "@radix-ui/react-dialog"

const AnimatedDialog = ({ open, onOpenChange, children }: AnimatedDialogProps) => (
  <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <AnimatePresence>
      {open && (
        <Dialog.Portal forceMount>
          <Dialog.Overlay asChild>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50"
            />
          </Dialog.Overlay>

          <Dialog.Content asChild>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 flex items-center justify-center"
            >
              <div className="bg-background rounded-lg p-6">
                {children}
              </div>
            </motion.div>
          </Dialog.Content>
        </Dialog.Portal>
      )}
    </AnimatePresence>
  </Dialog.Root>
)
```

## Reduced Motion Support

```typescript
import { useReducedMotion } from "framer-motion"

const AccessiblePresence = ({ isVisible, children }: AccessiblePresenceProps) => {
  const shouldReduceMotion = useReducedMotion()

  const variants = shouldReduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 }
      }
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -20 }
      }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          {...variants}
          transition={shouldReduceMotion ? { duration: 0.1 } : { type: "spring", stiffness: 300, damping: 25 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

## Quick Reference

### Basic Pattern

```typescript
<AnimatePresence>
  {condition && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    />
  )}
</AnimatePresence>
```

### With Key for Swap

```typescript
<AnimatePresence mode="wait">
  <motion.div
    key={uniqueKey}  // Required for swapping content
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  />
</AnimatePresence>
```

### List

```typescript
<AnimatePresence>
  {items.map(item => (
    <motion.div
      key={item.id}  // Required for each item
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    />
  ))}
</AnimatePresence>
```

## Best Practices

| Do | Don't |
|----|-------|
| Always use unique `key` props | Rely on array index as key |
| Use `mode="wait"` for page transitions | Stack multiple pages |
| Keep exit animations short (<300ms) | Create long exit delays |
| Match initial and exit states | Have asymmetric animations |
| Use `forceMount` with Radix | Let Radix unmount before exit |
| Test with reduced motion | Ignore accessibility |
| Use `initial={false}` for accordions | Animate on first mount unnecessarily |
