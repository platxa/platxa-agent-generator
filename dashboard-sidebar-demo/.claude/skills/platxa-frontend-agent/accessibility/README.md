# Accessibility Guide

WCAG 2.2 Level AA compliance for all generated components.

## Core Requirements

### Color Contrast

- **Normal text**: 4.5:1 minimum
- **Large text** (18px+ or 14px bold): 3:1 minimum
- **UI components**: 3:1 minimum

```typescript
// Use semantic color tokens that meet contrast requirements
className="text-foreground bg-background" // 4.5:1+
className="text-muted-foreground" // Ensure 4.5:1 against background
```

### Focus Indicators

All interactive elements must have visible focus:

```typescript
// Standard focus ring
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

// High contrast focus for dark backgrounds
className="focus-visible:ring-white focus-visible:ring-offset-primary"
```

### Keyboard Navigation

```typescript
// Button with proper keyboard handling
<button
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      handleClick()
    }
  }}
/>

// Tab order
tabIndex={0} // In tab order
tabIndex={-1} // Focusable but not in tab order
```

## ARIA Patterns

### Buttons

```typescript
// Icon-only button
<button aria-label="Close dialog">
  <XIcon aria-hidden="true" />
</button>

// Toggle button
<button
  aria-pressed={isPressed}
  onClick={() => setIsPressed(!isPressed)}
>
  {isPressed ? "On" : "Off"}
</button>
```

### Dialogs

```typescript
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
>
  <h2 id="dialog-title">Dialog Title</h2>
  <p id="dialog-description">Description text</p>
</div>
```

### Navigation

```typescript
<nav aria-label="Main navigation">
  <ul role="list">
    <li>
      <a href="/" aria-current={isCurrentPage ? "page" : undefined}>
        Home
      </a>
    </li>
  </ul>
</nav>
```

### Forms

```typescript
<div>
  <label htmlFor="email">Email</label>
  <input
    id="email"
    type="email"
    aria-describedby="email-error"
    aria-invalid={hasError}
  />
  {hasError && (
    <span id="email-error" role="alert">
      Please enter a valid email
    </span>
  )}
</div>
```

## Reduced Motion

Always respect user preferences:

```typescript
import { useReducedMotion } from "framer-motion"

function Component() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      animate={{
        x: shouldReduceMotion ? 0 : 100,
        opacity: 1
      }}
    />
  )
}
```

CSS fallback:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Screen Reader Support

### Hidden Decorative Elements

```typescript
<Icon aria-hidden="true" />
<span className="sr-only">Screen reader only text</span>
```

### Live Regions

```typescript
// Polite announcement
<div aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>

// Urgent announcement
<div role="alert" aria-live="assertive">
  {errorMessage}
</div>
```

## Testing Checklist

- [ ] Tab through all interactive elements
- [ ] Activate elements with Enter and Space
- [ ] Check focus visibility
- [ ] Test with screen reader (VoiceOver/NVDA)
- [ ] Verify color contrast with browser tools
- [ ] Test with `prefers-reduced-motion` enabled
- [ ] Check landmark regions
- [ ] Validate form labels and error messages
