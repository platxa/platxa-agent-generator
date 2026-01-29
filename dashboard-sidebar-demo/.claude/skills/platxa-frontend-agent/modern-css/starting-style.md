# @starting-style Entry Animations

CSS-only entry animations without JavaScript using @starting-style.

## Overview

`@starting-style` enables:
1. Animate elements from initial state on first display
2. CSS-only entry animations (no JS required)
3. Works with `display: none` transitions
4. Smooth dialog and popover appearances
5. List item entry animations

## Browser Support

```typescript
// Feature detection
const supportsStartingStyle = CSS.supports('selector(:popover-open)');

// Fallback for unsupported browsers
@supports not (selector(:popover-open)) {
  .animate-entry {
    animation: fadeIn 0.3s ease-out;
  }
}
```

## Basic Syntax

```css
/* Element starts invisible, animates to visible */
.fade-in-element {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.3s, transform 0.3s;

  @starting-style {
    opacity: 0;
    transform: translateY(20px);
  }
}

/* Alternative nested syntax */
@starting-style {
  .fade-in-element {
    opacity: 0;
    transform: translateY(20px);
  }
}
```

## Entry Animation Patterns

### Fade In

```css
.fade-in {
  opacity: 1;
  transition: opacity 0.3s ease-out;

  @starting-style {
    opacity: 0;
  }
}

/* Tailwind-style utility */
.animate-fade-in {
  --tw-enter-opacity: 0;
  opacity: 1;
  transition: opacity 0.3s ease-out;

  @starting-style {
    opacity: var(--tw-enter-opacity);
  }
}
```

### Slide In Variations

```css
/* Slide from bottom */
.slide-in-bottom {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.3s, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);

  @starting-style {
    opacity: 0;
    transform: translateY(20px);
  }
}

/* Slide from top */
.slide-in-top {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.3s, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);

  @starting-style {
    opacity: 0;
    transform: translateY(-20px);
  }
}

/* Slide from left */
.slide-in-left {
  opacity: 1;
  transform: translateX(0);
  transition: opacity 0.3s, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);

  @starting-style {
    opacity: 0;
    transform: translateX(-20px);
  }
}

/* Slide from right */
.slide-in-right {
  opacity: 1;
  transform: translateX(0);
  transition: opacity 0.3s, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);

  @starting-style {
    opacity: 0;
    transform: translateX(20px);
  }
}
```

### Scale In

```css
.scale-in {
  opacity: 1;
  transform: scale(1);
  transition: opacity 0.2s, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  @starting-style {
    opacity: 0;
    transform: scale(0.95);
  }
}

/* Scale from center with bounce */
.scale-in-bounce {
  opacity: 1;
  transform: scale(1);
  transition: opacity 0.3s, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);

  @starting-style {
    opacity: 0;
    transform: scale(0.9);
  }
}
```

## Dialog and Popover Animations

### Native Dialog

```css
dialog {
  opacity: 1;
  transform: scale(1) translateY(0);
  transition:
    opacity 0.3s,
    transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    display 0.3s allow-discrete,
    overlay 0.3s allow-discrete;

  @starting-style {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
}

/* Closed state (for exit animation) */
dialog:not([open]) {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
}

/* Backdrop animation */
dialog::backdrop {
  background-color: rgb(0 0 0 / 0.5);
  transition:
    background-color 0.3s,
    display 0.3s allow-discrete,
    overlay 0.3s allow-discrete;

  @starting-style {
    background-color: rgb(0 0 0 / 0);
  }
}
```

### Popover API

```css
[popover] {
  opacity: 1;
  transform: translateY(0);
  transition:
    opacity 0.2s,
    transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    display 0.2s allow-discrete,
    overlay 0.2s allow-discrete;

  @starting-style {
    opacity: 0;
    transform: translateY(-8px);
  }
}

/* Closed state */
[popover]:not(:popover-open) {
  opacity: 0;
  transform: translateY(-8px);
}

/* Position-aware animations */
[popover][data-position="bottom"] {
  @starting-style {
    transform: translateY(-8px);
  }
}

[popover][data-position="top"] {
  @starting-style {
    transform: translateY(8px);
  }
}

[popover][data-position="left"] {
  @starting-style {
    transform: translateX(8px);
  }
}

[popover][data-position="right"] {
  @starting-style {
    transform: translateX(-8px);
  }
}
```

## Dropdown Menu Animation

```css
.dropdown-menu {
  opacity: 1;
  transform: scale(1);
  transform-origin: var(--radix-dropdown-menu-content-transform-origin);
  transition:
    opacity 0.15s,
    transform 0.15s cubic-bezier(0.16, 1, 0.3, 1),
    display 0.15s allow-discrete;

  @starting-style {
    opacity: 0;
    transform: scale(0.95);
  }
}

/* Exit animation */
.dropdown-menu[data-state="closed"] {
  opacity: 0;
  transform: scale(0.95);
}
```

## List Item Stagger Animation

```css
/* Container */
.stagger-list {
  --stagger-delay: 50ms;
}

/* List items with staggered entry */
.stagger-list > * {
  opacity: 1;
  transform: translateY(0);
  transition:
    opacity 0.3s ease-out,
    transform 0.3s ease-out;
  transition-delay: calc(var(--index, 0) * var(--stagger-delay));

  @starting-style {
    opacity: 0;
    transform: translateY(10px);
  }
}

/* Set index via inline style or CSS custom property */
.stagger-list > *:nth-child(1) { --index: 0; }
.stagger-list > *:nth-child(2) { --index: 1; }
.stagger-list > *:nth-child(3) { --index: 2; }
.stagger-list > *:nth-child(4) { --index: 3; }
.stagger-list > *:nth-child(5) { --index: 4; }
/* ... continue as needed */
```

## Toast Notification Animation

```css
.toast {
  opacity: 1;
  transform: translateX(0);
  transition:
    opacity 0.3s ease-out,
    transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);

  @starting-style {
    opacity: 0;
    transform: translateX(100%);
  }
}

/* Exit animation (use data attribute or class) */
.toast[data-state="closed"],
.toast.exiting {
  opacity: 0;
  transform: translateX(100%);
}

/* Different positions */
.toast[data-position="top-right"] {
  @starting-style {
    transform: translateX(100%);
  }
}

.toast[data-position="top-left"] {
  @starting-style {
    transform: translateX(-100%);
  }
}

.toast[data-position="bottom-center"] {
  @starting-style {
    transform: translateY(100%);
  }
}
```

## Modal Sheet Animation

```css
/* Bottom sheet */
.sheet-bottom {
  opacity: 1;
  transform: translateY(0);
  transition:
    opacity 0.3s,
    transform 0.3s cubic-bezier(0.32, 0.72, 0, 1),
    display 0.3s allow-discrete;

  @starting-style {
    opacity: 0;
    transform: translateY(100%);
  }
}

/* Side sheet */
.sheet-right {
  opacity: 1;
  transform: translateX(0);
  transition:
    opacity 0.3s,
    transform 0.3s cubic-bezier(0.32, 0.72, 0, 1),
    display 0.3s allow-discrete;

  @starting-style {
    opacity: 0;
    transform: translateX(100%);
  }
}
```

## React Component Examples

### Animated Card

```typescript
const AnimatedCard = ({ children, className }: CardProps) => (
  <div
    className={cn(
      // Base styles
      'rounded-lg border bg-card p-6 shadow-sm',
      // Entry animation with @starting-style
      '[opacity:1] [transform:translateY(0)]',
      'transition-[opacity,transform] duration-300 ease-out',
      // Starting style via Tailwind arbitrary
      'starting:opacity-0 starting:translate-y-4',
      className
    )}
  >
    {children}
  </div>
);

/* CSS for starting: variant (add to Tailwind config) */
/*
@layer utilities {
  @starting-style {
    .starting\:opacity-0 { opacity: 0; }
    .starting\:translate-y-4 { transform: translateY(1rem); }
  }
}
*/
```

### Animated List

```typescript
interface AnimatedListProps {
  items: React.ReactNode[];
  staggerDelay?: number;
}

const AnimatedList = ({ items, staggerDelay = 50 }: AnimatedListProps) => (
  <ul
    className="space-y-2"
    style={{ '--stagger-delay': `${staggerDelay}ms` } as React.CSSProperties}
  >
    {items.map((item, index) => (
      <li
        key={index}
        className={cn(
          'rounded-lg border bg-background p-4',
          'opacity-100 translate-y-0',
          'transition-[opacity,transform] duration-300 ease-out',
          'starting:opacity-0 starting:translate-y-2'
        )}
        style={{ '--index': index } as React.CSSProperties}
      >
        {item}
      </li>
    ))}
  </ul>
);
```

### Animated Dialog

```typescript
const AnimatedDialog = ({ open, onOpenChange, children }: DialogProps) => (
  <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay
        className={cn(
          'fixed inset-0 bg-black/50',
          'transition-[opacity,display] duration-300',
          'data-[state=closed]:opacity-0',
          'starting:opacity-0'
        )}
      />
      <Dialog.Content
        className={cn(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          'w-full max-w-md rounded-lg bg-background p-6 shadow-lg',
          'opacity-100 scale-100',
          'transition-[opacity,transform,display] duration-300',
          'data-[state=closed]:opacity-0 data-[state=closed]:scale-95',
          'starting:opacity-0 starting:scale-95'
        )}
      >
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);
```

## Tailwind Plugin

```typescript
// tailwind.config.ts
import plugin from 'tailwindcss/plugin';

export default {
  plugins: [
    plugin(({ addVariant, addUtilities }) => {
      // Add @starting-style variant
      addVariant('starting', '@starting-style');

      // Add entry animation utilities
      addUtilities({
        '.animate-enter': {
          opacity: '1',
          transform: 'translateY(0) scale(1)',
          transition: 'opacity 0.3s, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          '@starting-style': {
            opacity: '0',
            transform: 'translateY(10px) scale(0.98)',
          },
        },
        '.animate-enter-fade': {
          opacity: '1',
          transition: 'opacity 0.3s ease-out',
          '@starting-style': {
            opacity: '0',
          },
        },
        '.animate-enter-slide-up': {
          opacity: '1',
          transform: 'translateY(0)',
          transition: 'opacity 0.3s, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          '@starting-style': {
            opacity: '0',
            transform: 'translateY(20px)',
          },
        },
        '.animate-enter-scale': {
          opacity: '1',
          transform: 'scale(1)',
          transition: 'opacity 0.2s, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          '@starting-style': {
            opacity: '0',
            transform: 'scale(0.95)',
          },
        },
      });
    }),
  ],
};
```

## CSS Custom Properties

```css
:root {
  --enter-duration: 0.3s;
  --enter-easing: cubic-bezier(0.16, 1, 0.3, 1);
  --enter-translate-y: 10px;
  --enter-scale: 0.98;
}

/* Reusable entry animation */
.entry-animation {
  opacity: 1;
  transform: translateY(0) scale(1);
  transition:
    opacity var(--enter-duration) ease-out,
    transform var(--enter-duration) var(--enter-easing);

  @starting-style {
    opacity: 0;
    transform:
      translateY(var(--enter-translate-y))
      scale(var(--enter-scale));
  }
}

/* Override custom properties for variations */
.entry-animation-subtle {
  --enter-translate-y: 5px;
  --enter-scale: 0.99;
}

.entry-animation-dramatic {
  --enter-translate-y: 30px;
  --enter-scale: 0.9;
  --enter-duration: 0.5s;
}
```

## Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .entry-animation,
  .animate-enter,
  .animate-enter-fade,
  .animate-enter-slide-up,
  .animate-enter-scale {
    transition: none;

    @starting-style {
      opacity: 1;
      transform: none;
    }
  }
}
```

## Key Takeaways

1. **CSS-Only**: No JavaScript required for entry animations
2. **@starting-style**: Defines initial state before first render
3. **allow-discrete**: Required for animating `display` property
4. **Dialog/Popover**: Native elements animate smoothly
5. **Stagger Effect**: Use CSS custom properties and nth-child
6. **Tailwind Plugin**: Create `starting:` variant for utilities
7. **Reduced Motion**: Always respect user preferences
8. **Exit Animations**: Combine with `:not([open])` or `[data-state]`
