# Theming Guide

Design token management with Tailwind CSS v4 and @platxa/brand-kit.

## Token Structure

### Color Tokens (OKLCH)

```css
@theme {
  /* Primary palette */
  --color-primary: oklch(0.7 0.15 250);
  --color-primary-foreground: oklch(0.98 0.01 250);

  /* Secondary palette */
  --color-secondary: oklch(0.85 0.03 250);
  --color-secondary-foreground: oklch(0.2 0.02 250);

  /* Semantic colors */
  --color-background: oklch(0.99 0.005 250);
  --color-foreground: oklch(0.15 0.02 250);
  --color-muted: oklch(0.95 0.01 250);
  --color-muted-foreground: oklch(0.45 0.02 250);

  /* State colors */
  --color-destructive: oklch(0.55 0.25 25);
  --color-success: oklch(0.65 0.2 145);
  --color-warning: oklch(0.75 0.15 85);
}
```

### Typography Tokens

```css
@theme {
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;

  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;
  --text-4xl: 2.25rem;

  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;
}
```

### Spacing Tokens

```css
@theme {
  --spacing-0: 0;
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-3: 0.75rem;
  --spacing-4: 1rem;
  --spacing-5: 1.25rem;
  --spacing-6: 1.5rem;
  --spacing-8: 2rem;
  --spacing-10: 2.5rem;
  --spacing-12: 3rem;
  --spacing-16: 4rem;
}
```

### Border Radius

```css
@theme {
  --radius-none: 0;
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  --radius-2xl: 1rem;
  --radius-full: 9999px;
}
```

## Dark Mode

Use CSS custom properties with dark mode override:

```css
@theme {
  --color-background: oklch(0.99 0.005 250);
  --color-foreground: oklch(0.15 0.02 250);
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-background: oklch(0.15 0.02 250);
    --color-foreground: oklch(0.95 0.01 250);
  }
}

/* Class-based dark mode */
.dark {
  --color-background: oklch(0.15 0.02 250);
  --color-foreground: oklch(0.95 0.01 250);
}
```

## Brand Kit Integration

```typescript
// frontend.config.ts
import { defineFrontendConfig } from "@platxa/frontend-agent"

export default defineFrontendConfig({
  brand: {
    package: "@platxa/brand-kit",
    autoSync: true,
  },
  theme: {
    tokens: {
      colors: {
        primary: "var(--brand-primary)",
        secondary: "var(--brand-secondary)",
      },
    },
  },
})
```

## Using Tokens in Components

```typescript
// Use Tailwind classes that reference tokens
<div className="bg-background text-foreground">
  <h1 className="text-2xl font-bold text-primary">
    Heading
  </h1>
  <p className="text-muted-foreground">
    Body text
  </p>
</div>
```

## Token Naming Convention

| Token Type | Prefix | Example |
|------------|--------|---------|
| Color | `--color-` | `--color-primary` |
| Typography | `--font-`, `--text-` | `--font-sans`, `--text-lg` |
| Spacing | `--spacing-` | `--spacing-4` |
| Radius | `--radius-` | `--radius-md` |
| Shadow | `--shadow-` | `--shadow-lg` |
| Animation | `--animate-` | `--animate-fade-in` |
