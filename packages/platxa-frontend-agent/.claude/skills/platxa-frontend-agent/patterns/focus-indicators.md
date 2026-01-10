# Focus Indicator System

WCAG 2.4.7 requires visible focus indicators for keyboard navigation. The two-color pattern ensures visibility on any background color.

## WCAG Requirements

| Criterion | Requirement | Level |
|-----------|-------------|-------|
| 2.4.7 Focus Visible | Focus indicator must be visible | AA |
| 2.4.11 Focus Not Obscured | Focus not hidden by other content | AA |
| 2.4.12 Focus Not Obscured (Enhanced) | Fully visible, not partially hidden | AAA |
| 1.4.11 Non-text Contrast | 3:1 contrast for UI components | AA |

## The Two-Color Pattern

A single-color focus ring fails on backgrounds of similar color. The two-color pattern creates an inner and outer ring that contrasts with ANY background.

```
┌─────────────────────────────────────────────────────────────┐
│ Single Color Problem                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Light Background:     Dark Background:      Blue Background:│
│  ┌────────────┐        ┌────────────┐        ┌────────────┐ │
│  │ ▓▓▓▓▓▓▓▓▓▓ │        │            │        │            │ │
│  │ ▓ Button ▓ │ ✓      │   Button   │ ✗      │   Button   │ ✗│
│  │ ▓▓▓▓▓▓▓▓▓▓ │        │            │        │            │ │
│  └────────────┘        └────────────┘        └────────────┘ │
│    Blue ring visible   Blue ring invisible   Ring blends in │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Two-Color Solution                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Light Background:     Dark Background:      Blue Background:│
│  ┌────────────┐        ┌────────────┐        ┌────────────┐ │
│  │ ░▓▓▓▓▓▓▓▓░ │        │ ░▓▓▓▓▓▓▓▓░ │        │ ░▓▓▓▓▓▓▓▓░ │ │
│  │ ▓ Button ▓ │ ✓      │ ▓ Button ▓ │ ✓      │ ▓ Button ▓ │ ✓│
│  │ ░▓▓▓▓▓▓▓▓░ │        │ ░▓▓▓▓▓▓▓▓░ │        │ ░▓▓▓▓▓▓▓▓░ │ │
│  └────────────┘        └────────────┘        └────────────┘ │
│    White outer + Blue   White outer visible   White visible │
│                                                             │
└─────────────────────────────────────────────────────────────┘
░ = white/light outer ring (2px)
▓ = brand/dark inner ring (2px)
```

## Implementation

### CSS Custom Properties

```css
:root {
  /* Focus ring colors */
  --ring: oklch(0.6 0.2 250);           /* Primary color for inner ring */
  --ring-offset: oklch(0.98 0 0);       /* White/light for outer ring */
  --ring-offset-width: 2px;              /* Offset/outer ring width */
  --ring-width: 2px;                     /* Inner ring width */
}

.dark {
  --ring: oklch(0.70 0.18 250);         /* Lighter primary for dark mode */
  --ring-offset: oklch(0.12 0.02 250);  /* Dark offset for dark mode */
}
```

### Tailwind Focus Classes

```css
/* Base focus-visible styles */
.focus-ring {
  @apply focus-visible:outline-none;
  @apply focus-visible:ring-2;
  @apply focus-visible:ring-ring;
  @apply focus-visible:ring-offset-2;
  @apply focus-visible:ring-offset-background;
}

/* Alternative: Using box-shadow for more control */
.focus-ring-shadow {
  @apply focus-visible:outline-none;
  @apply focus-visible:shadow-[0_0_0_2px_var(--ring-offset),0_0_0_4px_var(--ring)];
}
```

### Component Pattern

```typescript
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-md",
        "bg-primary text-primary-foreground",
        // Two-color focus pattern
        "focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
      {...props}
    />
  )
)
```

## Focus Variants

### Standard Focus Ring (Most Common)

```typescript
// For buttons, links, inputs
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
```

**Visual:**
```
┌──────────────────┐
│ ░░░░░░░░░░░░░░░░ │  ← 2px offset (background color)
│ ░ ▓▓▓▓▓▓▓▓▓▓▓▓ ░ │  ← 2px ring (ring color)
│ ░ ▓  Button  ▓ ░ │
│ ░ ▓▓▓▓▓▓▓▓▓▓▓▓ ░ │
│ ░░░░░░░░░░░░░░░░ │
└──────────────────┘
```

### Inset Focus Ring

```typescript
// For inputs and text areas
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
```

**Visual:**
```
┌──────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  ← Ring inside border
│ ▓              ▓ │
│ ▓  Input text  ▓ │
│ ▓              ▓ │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
└──────────────────┘
```

### High Contrast Focus

```typescript
// For critical actions or when extra visibility needed
className="focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
```

### No Offset Focus (Tight Spaces)

```typescript
// When offset would cause layout issues
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
```

## Component Examples

### Button

```typescript
const buttonFocusClasses = cn(
  "focus-visible:outline-none",
  "focus-visible:ring-2",
  "focus-visible:ring-ring",
  "focus-visible:ring-offset-2",
  "focus-visible:ring-offset-background"
)

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        buttonVariants({ variant }),
        buttonFocusClasses,
        className
      )}
      {...props}
    />
  )
)
```

### Input

```typescript
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2",
        "text-sm placeholder:text-muted-foreground",
        // Focus ring
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-ring",
        "focus-visible:ring-offset-2",
        "focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
)
```

### Card (Clickable)

```typescript
const ClickableCard = React.forwardRef<HTMLDivElement, ClickableCardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      tabIndex={0}
      role="button"
      className={cn(
        "rounded-lg border bg-card p-6 cursor-pointer",
        "transition-colors hover:bg-accent",
        // Focus ring
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-ring",
        "focus-visible:ring-offset-2",
        "focus-visible:ring-offset-background",
        className
      )}
      {...props}
    />
  )
)
```

### Link

```typescript
const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ className, ...props }, ref) => (
    <a
      ref={ref}
      className={cn(
        "text-primary underline-offset-4 hover:underline",
        // Rounded focus ring for inline links
        "rounded-sm",
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-ring",
        "focus-visible:ring-offset-2",
        "focus-visible:ring-offset-background",
        className
      )}
      {...props}
    />
  )
)
```

### Icon Button

```typescript
const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-md",
        "text-muted-foreground hover:text-foreground",
        "hover:bg-accent",
        // Focus ring
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-ring",
        "focus-visible:ring-offset-2",
        "focus-visible:ring-offset-background",
        className
      )}
      {...props}
    />
  )
)
```

## Special Cases

### Focus Within (Container Focus)

```typescript
// Container that shows focus when children are focused
<div className="focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
  <Input />
</div>
```

### Focus on Dark Backgrounds

```typescript
// When element is on a dark/colored background
<div className="bg-primary p-4">
  <button className={cn(
    "bg-primary-foreground text-primary",
    "focus-visible:outline-none",
    "focus-visible:ring-2",
    "focus-visible:ring-primary-foreground",  // Light ring
    "focus-visible:ring-offset-2",
    "focus-visible:ring-offset-primary"        // Primary as offset
  )}>
    Button on Primary
  </button>
</div>
```

### Complex Components (Dialog, Popover)

```typescript
// Focus trap indicator for modals
<Dialog.Content className={cn(
  "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
  "bg-background rounded-lg shadow-xl",
  // Subtle focus ring for the entire dialog
  "focus:outline-none",
  "focus-visible:ring-2",
  "focus-visible:ring-ring/50"  // Semi-transparent
)}>
```

## Validation

### Focus Indicator Checker

```typescript
interface FocusIndicatorCheck {
  element: string
  hasFocusVisible: boolean
  hasRing: boolean
  hasOffset: boolean
  hasOutlineNone: boolean
  issues: string[]
  passes: boolean
}

function validateFocusIndicators(component: string): FocusIndicatorCheck[] {
  const results: FocusIndicatorCheck[] = []

  // Find interactive elements
  const interactivePatterns = [
    /<button/g,
    /<a\s/g,
    /<input/g,
    /<select/g,
    /<textarea/g,
    /role="button"/g,
    /tabIndex={0}/g,
    /tabIndex="0"/g
  ]

  for (const pattern of interactivePatterns) {
    const matches = component.matchAll(pattern)

    for (const match of matches) {
      // Find the className for this element
      const elementStart = match.index ?? 0
      const elementEnd = component.indexOf('>', elementStart)
      const elementStr = component.slice(elementStart, elementEnd)

      const classMatch = elementStr.match(/className="([^"]+)"/)
      const classes = classMatch ? classMatch[1] : ""

      const check: FocusIndicatorCheck = {
        element: elementStr.slice(0, 50),
        hasFocusVisible: classes.includes("focus-visible:"),
        hasRing: classes.includes("ring-"),
        hasOffset: classes.includes("ring-offset"),
        hasOutlineNone: classes.includes("outline-none"),
        issues: [],
        passes: true
      }

      // Validate
      if (!check.hasFocusVisible) {
        check.issues.push("Missing focus-visible: styles")
        check.passes = false
      }

      if (!check.hasOutlineNone && check.hasRing) {
        check.issues.push("Has ring but missing outline-none")
      }

      if (check.hasRing && !check.hasOffset) {
        check.issues.push("Consider adding ring-offset for two-color pattern")
      }

      results.push(check)
    }
  }

  return results
}
```

### Contrast Validation

```typescript
function validateFocusContrast(
  ringColor: string,
  backgroundColor: string
): { passes: boolean; ratio: number; required: number } {
  const ratio = calculateContrastRatio(ringColor, backgroundColor)

  return {
    passes: ratio >= 3,  // UI component contrast requirement
    ratio: Math.round(ratio * 100) / 100,
    required: 3
  }
}
```

## CSS Utility Classes

### Reusable Focus Classes

```css
/* globals.css */
@layer utilities {
  /* Standard focus ring */
  .focus-ring {
    @apply focus-visible:outline-none;
    @apply focus-visible:ring-2;
    @apply focus-visible:ring-ring;
    @apply focus-visible:ring-offset-2;
    @apply focus-visible:ring-offset-background;
  }

  /* Inset focus ring (for inputs) */
  .focus-ring-inset {
    @apply focus-visible:outline-none;
    @apply focus-visible:ring-2;
    @apply focus-visible:ring-ring;
    @apply focus-visible:ring-inset;
  }

  /* High contrast focus */
  .focus-ring-prominent {
    @apply focus-visible:outline-none;
    @apply focus-visible:ring-4;
    @apply focus-visible:ring-ring;
    @apply focus-visible:ring-offset-4;
    @apply focus-visible:ring-offset-background;
  }

  /* Focus within container */
  .focus-within-ring {
    @apply focus-within:ring-2;
    @apply focus-within:ring-ring;
    @apply focus-within:ring-offset-2;
    @apply focus-within:ring-offset-background;
  }
}
```

### Usage

```typescript
<Button className="focus-ring">Standard</Button>
<Input className="focus-ring-inset" />
<Button className="focus-ring-prominent">Important</Button>
<div className="focus-within-ring">
  <Input />
</div>
```

## Best Practices

| Do | Don't |
|----|-------|
| Use `focus-visible` (not `focus`) | Show focus on mouse click |
| Include `outline-none` with custom ring | Leave browser outline AND custom ring |
| Use two-color pattern (ring + offset) | Single color that blends with backgrounds |
| Test on light, dark, and colored backgrounds | Test only on default background |
| Use `ring-offset-background` token | Hardcode offset color |
| Maintain 3:1 minimum contrast | Use low-contrast focus indicators |
| Apply to ALL interactive elements | Skip focus on buttons or links |
| Use consistent focus style across app | Different focus styles per component |

## Quick Reference

```typescript
// Standard (buttons, links)
"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

// Inputs
"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

// Inset (tight containers)
"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"

// High contrast
"focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"

// On colored background
"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
```
