# Keyboard Navigation System

All interactive elements must be fully operable via keyboard. This ensures accessibility for users who cannot use a mouse, including screen reader users and those with motor impairments.

## WCAG Requirements

| Criterion | Requirement | Level |
|-----------|-------------|-------|
| 2.1.1 Keyboard | All functionality available via keyboard | A |
| 2.1.2 No Keyboard Trap | Users can navigate away from any element | A |
| 2.4.3 Focus Order | Logical, meaningful focus sequence | A |
| 2.4.7 Focus Visible | Focus indicator always visible | AA |
| 2.1.4 Character Key Shortcuts | Can remap single-key shortcuts | A |

## Core Keyboard Interactions

### Standard Keys

| Key | Action |
|-----|--------|
| `Tab` | Move to next focusable element |
| `Shift+Tab` | Move to previous focusable element |
| `Enter` | Activate button/link |
| `Space` | Activate button, toggle checkbox/switch |
| `Escape` | Close modal/popover, cancel operation |
| `Arrow keys` | Navigate within composite widgets |
| `Home/End` | Jump to first/last item in list |

### Focus Order

Focus order must follow visual layout (left-to-right, top-to-bottom in LTR):

```
┌─────────────────────────────────────────────────────────────┐
│ [1] Logo    [2] Nav Link    [3] Nav Link    [4] Search [5]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [6] Sidebar Item                                           │
│  [7] Sidebar Item         [8] Main Content                  │
│  [9] Sidebar Item         [10] Button [11] Button           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ [12] Footer Link   [13] Footer Link   [14] Footer Link      │
└─────────────────────────────────────────────────────────────┘
```

## Focusable Elements

### Natively Focusable

```html
<!-- These are focusable by default -->
<a href="...">Link</a>
<button>Button</button>
<input type="text" />
<select>...</select>
<textarea></textarea>
<details><summary>...</summary></details>
```

### Making Elements Focusable

```typescript
// Add to tab order (avoid positive values)
<div tabIndex={0}>Focusable div</div>

// Remove from tab order (focusable programmatically only)
<button tabIndex={-1}>Skip in tab order</button>

// NEVER use positive tabindex values
<button tabIndex={5}>BAD - Creates confusing order</button>
```

### Interactive Custom Elements

```typescript
// Custom interactive element must have:
// 1. tabIndex={0}
// 2. role attribute
// 3. Keyboard handlers

const ClickableCard = React.forwardRef<HTMLDivElement, ClickableCardProps>(
  ({ onClick, onKeyDown, children, ...props }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        onClick?.(e as any)
      }
      onKeyDown?.(e)
    }

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "cursor-pointer",
          "focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring",
          "focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
```

## Roving Tabindex Pattern

For composite widgets (toolbars, menus, tabs), use roving tabindex so only one item is in the tab order at a time:

```typescript
interface RovingTabindexOptions {
  items: HTMLElement[]
  currentIndex: number
  orientation?: "horizontal" | "vertical" | "both"
  loop?: boolean
}

function useRovingTabindex({
  items,
  currentIndex,
  orientation = "horizontal",
  loop = true
}: RovingTabindexOptions) {
  const [focusedIndex, setFocusedIndex] = React.useState(currentIndex)

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      const isHorizontal = orientation === "horizontal" || orientation === "both"
      const isVertical = orientation === "vertical" || orientation === "both"

      let nextIndex = focusedIndex

      switch (e.key) {
        case "ArrowRight":
          if (isHorizontal) {
            e.preventDefault()
            nextIndex = focusedIndex + 1
          }
          break
        case "ArrowLeft":
          if (isHorizontal) {
            e.preventDefault()
            nextIndex = focusedIndex - 1
          }
          break
        case "ArrowDown":
          if (isVertical) {
            e.preventDefault()
            nextIndex = focusedIndex + 1
          }
          break
        case "ArrowUp":
          if (isVertical) {
            e.preventDefault()
            nextIndex = focusedIndex - 1
          }
          break
        case "Home":
          e.preventDefault()
          nextIndex = 0
          break
        case "End":
          e.preventDefault()
          nextIndex = items.length - 1
          break
      }

      // Handle looping or clamping
      if (loop) {
        nextIndex = (nextIndex + items.length) % items.length
      } else {
        nextIndex = Math.max(0, Math.min(items.length - 1, nextIndex))
      }

      if (nextIndex !== focusedIndex) {
        setFocusedIndex(nextIndex)
        items[nextIndex]?.focus()
      }
    },
    [focusedIndex, items, orientation, loop]
  )

  return {
    focusedIndex,
    setFocusedIndex,
    handleKeyDown,
    getTabIndex: (index: number) => (index === focusedIndex ? 0 : -1)
  }
}
```

### Usage Example: Tabs

```typescript
const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ tabs, activeTab, onChange, ...props }, ref) => {
    const tabRefs = React.useRef<HTMLButtonElement[]>([])

    const { focusedIndex, handleKeyDown, getTabIndex } = useRovingTabindex({
      items: tabRefs.current,
      currentIndex: tabs.findIndex(t => t.id === activeTab),
      orientation: "horizontal"
    })

    return (
      <div ref={ref} role="tablist" onKeyDown={handleKeyDown} {...props}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={el => { if (el) tabRefs.current[index] = el }}
            role="tab"
            tabIndex={getTabIndex(index)}
            aria-selected={tab.id === activeTab}
            aria-controls={`panel-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium",
              "focus-visible:outline-none focus-visible:ring-2",
              tab.id === activeTab
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    )
  }
)
```

### Usage Example: Toolbar

```typescript
const Toolbar = React.forwardRef<HTMLDivElement, ToolbarProps>(
  ({ children, ...props }, ref) => {
    const itemRefs = React.useRef<HTMLButtonElement[]>([])
    const [items, setItems] = React.useState<HTMLButtonElement[]>([])

    React.useEffect(() => {
      setItems(itemRefs.current.filter(Boolean))
    }, [children])

    const { handleKeyDown, getTabIndex } = useRovingTabindex({
      items,
      currentIndex: 0,
      orientation: "horizontal"
    })

    return (
      <div
        ref={ref}
        role="toolbar"
        aria-label="Formatting options"
        onKeyDown={handleKeyDown}
        className="flex items-center gap-1 p-1 border rounded-md"
        {...props}
      >
        {React.Children.map(children, (child, index) =>
          React.isValidElement(child)
            ? React.cloneElement(child as React.ReactElement, {
                ref: (el: HTMLButtonElement) => { itemRefs.current[index] = el },
                tabIndex: getTabIndex(index)
              })
            : child
        )}
      </div>
    )
  }
)
```

## Focus Management

### Focus Trap (Modals/Dialogs)

```typescript
function useFocusTrap(containerRef: React.RefObject<HTMLElement>) {
  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(', ')

    const getFocusableElements = () => {
      return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector))
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return

      const focusable = getFocusableElements()
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }

    // Store previous focus
    const previouslyFocused = document.activeElement as HTMLElement

    // Focus first focusable element
    const focusable = getFocusableElements()
    focusable[0]?.focus()

    container.addEventListener("keydown", handleKeyDown)

    return () => {
      container.removeEventListener("keydown", handleKeyDown)
      // Restore focus
      previouslyFocused?.focus()
    }
  }, [containerRef])
}
```

### Usage in Dialog

```typescript
const Dialog = React.forwardRef<HTMLDivElement, DialogProps>(
  ({ open, onClose, children, ...props }, ref) => {
    const contentRef = React.useRef<HTMLDivElement>(null)

    useFocusTrap(contentRef)

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    if (!open) return null

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        onKeyDown={handleKeyDown}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Content */}
        <div
          ref={contentRef}
          role="dialog"
          aria-modal="true"
          className={cn(
            "relative z-10 bg-background rounded-lg shadow-xl",
            "focus:outline-none"
          )}
          {...props}
        >
          {children}
        </div>
      </div>
    )
  }
)
```

### Focus Restoration

```typescript
function useFocusOnMount(ref: React.RefObject<HTMLElement>) {
  const previousFocusRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    // Store current focus
    previousFocusRef.current = document.activeElement as HTMLElement

    // Focus the element
    ref.current?.focus()

    return () => {
      // Restore focus on unmount
      previousFocusRef.current?.focus()
    }
  }, [ref])
}
```

## Skip Links

Allow keyboard users to skip repetitive navigation:

```typescript
const SkipLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a
    href={href}
    className={cn(
      "sr-only focus:not-sr-only",
      "focus:absolute focus:top-4 focus:left-4 focus:z-50",
      "focus:px-4 focus:py-2 focus:bg-background focus:text-foreground",
      "focus:ring-2 focus:ring-ring focus:rounded-md",
      "focus:shadow-lg"
    )}
  >
    {children}
  </a>
)

// Usage in layout
const Layout = ({ children }: { children: React.ReactNode }) => (
  <>
    <SkipLink href="#main-content">Skip to main content</SkipLink>
    <SkipLink href="#main-navigation">Skip to navigation</SkipLink>
    <header>
      <nav id="main-navigation">...</nav>
    </header>
    <main id="main-content" tabIndex={-1}>
      {children}
    </main>
  </>
)
```

## Keyboard Shortcuts

### Shortcut Hook

```typescript
interface ShortcutConfig {
  key: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  meta?: boolean
  handler: () => void
  description?: string
}

function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return
      }

      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()
        const ctrlMatch = !!shortcut.ctrl === (e.ctrlKey || e.metaKey)
        const altMatch = !!shortcut.alt === e.altKey
        const shiftMatch = !!shortcut.shift === e.shiftKey

        if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
          e.preventDefault()
          shortcut.handler()
          return
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [shortcuts])
}
```

### Usage

```typescript
function App() {
  const [searchOpen, setSearchOpen] = React.useState(false)

  useKeyboardShortcuts([
    {
      key: "k",
      ctrl: true,
      handler: () => setSearchOpen(true),
      description: "Open search"
    },
    {
      key: "/",
      handler: () => setSearchOpen(true),
      description: "Open search"
    },
    {
      key: "Escape",
      handler: () => setSearchOpen(false),
      description: "Close search"
    }
  ])

  return (
    <div>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
```

### Shortcut Hints

```typescript
const KeyboardShortcut = ({ keys }: { keys: string[] }) => (
  <kbd className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-muted rounded">
    {keys.map((key, i) => (
      <React.Fragment key={key}>
        {i > 0 && <span className="text-muted-foreground">+</span>}
        <span>{key}</span>
      </React.Fragment>
    ))}
  </kbd>
)

// Usage
<button className="flex items-center gap-2">
  Search
  <KeyboardShortcut keys={["⌘", "K"]} />
</button>
```

## Component Patterns

### Button

```typescript
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ onClick, onKeyDown, disabled, ...props }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      // Enter and Space both trigger onClick for buttons
      // Browser handles this natively, but custom handlers may need it
      onKeyDown?.(e)
    }

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring",
          "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
        {...props}
      />
    )
  }
)
```

### Dropdown Menu

```typescript
const DropdownMenu = ({ trigger, items }: DropdownMenuProps) => {
  const [open, setOpen] = React.useState(false)
  const [focusedIndex, setFocusedIndex] = React.useState(0)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const itemRefs = React.useRef<HTMLButtonElement[]>([])

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "Enter":
      case " ":
      case "ArrowDown":
        e.preventDefault()
        setOpen(true)
        setFocusedIndex(0)
        break
      case "ArrowUp":
        e.preventDefault()
        setOpen(true)
        setFocusedIndex(items.length - 1)
        break
    }
  }

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setFocusedIndex(i => (i + 1) % items.length)
        break
      case "ArrowUp":
        e.preventDefault()
        setFocusedIndex(i => (i - 1 + items.length) % items.length)
        break
      case "Home":
        e.preventDefault()
        setFocusedIndex(0)
        break
      case "End":
        e.preventDefault()
        setFocusedIndex(items.length - 1)
        break
      case "Escape":
        e.preventDefault()
        setOpen(false)
        break
      case "Enter":
      case " ":
        e.preventDefault()
        items[focusedIndex]?.onSelect()
        setOpen(false)
        break
    }
  }

  React.useEffect(() => {
    if (open) {
      itemRefs.current[focusedIndex]?.focus()
    }
  }, [open, focusedIndex])

  return (
    <div className="relative">
      <button
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={handleTriggerKeyDown}
      >
        {trigger}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          onKeyDown={handleMenuKeyDown}
          className="absolute top-full mt-1 py-1 bg-popover rounded-md shadow-lg"
        >
          {items.map((item, index) => (
            <button
              key={item.id}
              ref={el => { if (el) itemRefs.current[index] = el }}
              role="menuitem"
              tabIndex={index === focusedIndex ? 0 : -1}
              onClick={() => {
                item.onSelect()
                setOpen(false)
              }}
              className={cn(
                "w-full px-4 py-2 text-left text-sm",
                "hover:bg-accent focus:bg-accent focus:outline-none",
                index === focusedIndex && "bg-accent"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

### Accordion

```typescript
const Accordion = ({ items }: AccordionProps) => {
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null)

  const handleKeyDown = (index: number) => (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        const nextIndex = (index + 1) % items.length
        document.getElementById(`accordion-trigger-${nextIndex}`)?.focus()
        break
      case "ArrowUp":
        e.preventDefault()
        const prevIndex = (index - 1 + items.length) % items.length
        document.getElementById(`accordion-trigger-${prevIndex}`)?.focus()
        break
      case "Home":
        e.preventDefault()
        document.getElementById(`accordion-trigger-0`)?.focus()
        break
      case "End":
        e.preventDefault()
        document.getElementById(`accordion-trigger-${items.length - 1}`)?.focus()
        break
    }
  }

  return (
    <div className="divide-y">
      {items.map((item, index) => (
        <div key={item.id}>
          <button
            id={`accordion-trigger-${index}`}
            aria-expanded={expandedIndex === index}
            aria-controls={`accordion-panel-${index}`}
            onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
            onKeyDown={handleKeyDown(index)}
            className={cn(
              "flex w-full items-center justify-between py-4",
              "text-left font-medium",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            {item.title}
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                expandedIndex === index && "rotate-180"
              )}
            />
          </button>

          <div
            id={`accordion-panel-${index}`}
            role="region"
            aria-labelledby={`accordion-trigger-${index}`}
            hidden={expandedIndex !== index}
            className="pb-4"
          >
            {item.content}
          </div>
        </div>
      ))}
    </div>
  )
}
```

## Validation

### Keyboard Navigation Checker

```typescript
interface KeyboardAccessibilityCheck {
  element: string
  hasFocusIndicator: boolean
  isInTabOrder: boolean
  hasKeyboardHandler: boolean
  issues: string[]
  passes: boolean
}

function validateKeyboardAccessibility(component: string): KeyboardAccessibilityCheck[] {
  const results: KeyboardAccessibilityCheck[] = []

  // Check for interactive elements
  const interactivePatterns = [
    { pattern: /<button/g, type: "button" },
    { pattern: /<a\s/g, type: "link" },
    { pattern: /role="button"/g, type: "custom button" },
    { pattern: /onClick/g, type: "click handler" },
    { pattern: /tabIndex={0}/g, type: "focusable" }
  ]

  for (const { pattern, type } of interactivePatterns) {
    const matches = component.matchAll(pattern)

    for (const match of matches) {
      const start = match.index ?? 0
      const end = component.indexOf(">", start)
      const elementStr = component.slice(start, end)

      const check: KeyboardAccessibilityCheck = {
        element: `${type}: ${elementStr.slice(0, 50)}...`,
        hasFocusIndicator: elementStr.includes("focus-visible:") || elementStr.includes("focus:"),
        isInTabOrder: !elementStr.includes('tabIndex={-1}'),
        hasKeyboardHandler: elementStr.includes("onKeyDown") || elementStr.includes("onKeyUp") || type === "button" || type === "link",
        issues: [],
        passes: true
      }

      // Validate
      if (!check.hasFocusIndicator && type !== "link") {
        check.issues.push("Missing focus indicator styles")
        check.passes = false
      }

      if (type === "click handler" && !check.hasKeyboardHandler) {
        check.issues.push("Has onClick but no keyboard handler")
        check.passes = false
      }

      if (type === "custom button" && !elementStr.includes("tabIndex")) {
        check.issues.push("Custom button missing tabIndex")
        check.passes = false
      }

      results.push(check)
    }
  }

  return results
}
```

## Best Practices

| Do | Don't |
|----|-------|
| Use native HTML elements when possible | Reinvent button/link behavior |
| Provide visible focus indicators | Remove focus outline without replacement |
| Follow logical tab order (DOM order) | Use positive tabIndex values |
| Trap focus in modals | Allow focus to escape modal |
| Restore focus after modal closes | Leave focus in closed modal area |
| Support arrow keys in composite widgets | Require Tab within toolbar/menu |
| Provide skip links | Force users through all nav items |
| Allow Escape to close overlays | Trap users in popovers |
| Test with keyboard only | Only test with mouse |

## Quick Reference

### Focus Classes

```typescript
// Standard focus ring
"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

// Skip link (visually hidden until focused)
"sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
```

### Key Handlers

```typescript
// Button: Enter + Space activate (native)
// Link: Enter activates (native)
// Custom interactive: Add both Enter + Space

const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault()
    handleClick()
  }
}
```

### Tab Management

```typescript
// In tab order (default for buttons, links, inputs)
tabIndex={0}

// Programmatically focusable only
tabIndex={-1}

// NEVER use positive values
tabIndex={5}  // ❌ BAD
```
