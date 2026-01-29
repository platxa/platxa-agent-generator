# Tailwind CSS v4 @theme Directive

Tailwind v4 introduces CSS-first configuration using the `@theme` directive. Design tokens are defined directly in CSS and automatically available as utility classes.

## Overview

```css
@import "tailwindcss";

@theme {
  --color-primary: oklch(0.6 0.2 250);
  --spacing-18: 4.5rem;
  --font-display: "Cal Sans", sans-serif;
}
```

Generates utilities:
- `bg-primary`, `text-primary`, `border-primary`
- `p-18`, `m-18`, `gap-18`
- `font-display`

## Theme Namespaces

### Colors (`--color-*`)

```css
@theme {
  /* Semantic colors */
  --color-background: oklch(0.98 0 0);
  --color-foreground: oklch(0.15 0.02 250);
  --color-primary: oklch(0.6 0.2 250);
  --color-primary-foreground: oklch(0.98 0 0);
  --color-secondary: oklch(0.95 0.02 250);
  --color-secondary-foreground: oklch(0.15 0.02 250);
  --color-muted: oklch(0.95 0.01 250);
  --color-muted-foreground: oklch(0.45 0.02 250);
  --color-accent: oklch(0.95 0.02 250);
  --color-accent-foreground: oklch(0.15 0.02 250);
  --color-destructive: oklch(0.55 0.22 25);
  --color-destructive-foreground: oklch(0.98 0 0);

  /* UI colors */
  --color-border: oklch(0.90 0.01 250);
  --color-input: oklch(0.90 0.01 250);
  --color-ring: oklch(0.6 0.2 250);
  --color-card: oklch(0.99 0 0);
  --color-card-foreground: oklch(0.15 0.02 250);
  --color-popover: oklch(0.99 0 0);
  --color-popover-foreground: oklch(0.15 0.02 250);

  /* Status colors */
  --color-success: oklch(0.65 0.2 145);
  --color-success-foreground: oklch(0.98 0 0);
  --color-warning: oklch(0.75 0.18 85);
  --color-warning-foreground: oklch(0.15 0.02 85);
  --color-info: oklch(0.65 0.15 230);
  --color-info-foreground: oklch(0.98 0 0);
}
```

**Generated Utilities:**
```html
<div class="bg-primary text-primary-foreground">
<div class="border-border hover:border-ring">
<span class="text-muted-foreground">
```

### Color Scales

```css
@theme {
  /* Gray scale */
  --color-gray-50: oklch(0.98 0.005 250);
  --color-gray-100: oklch(0.96 0.005 250);
  --color-gray-200: oklch(0.92 0.005 250);
  --color-gray-300: oklch(0.87 0.005 250);
  --color-gray-400: oklch(0.71 0.01 250);
  --color-gray-500: oklch(0.55 0.01 250);
  --color-gray-600: oklch(0.45 0.01 250);
  --color-gray-700: oklch(0.37 0.01 250);
  --color-gray-800: oklch(0.27 0.01 250);
  --color-gray-900: oklch(0.20 0.01 250);
  --color-gray-950: oklch(0.13 0.01 250);

  /* Primary scale */
  --color-primary-50: oklch(0.97 0.02 250);
  --color-primary-100: oklch(0.94 0.04 250);
  --color-primary-200: oklch(0.88 0.08 250);
  --color-primary-300: oklch(0.80 0.12 250);
  --color-primary-400: oklch(0.70 0.16 250);
  --color-primary-500: oklch(0.60 0.20 250);
  --color-primary-600: oklch(0.52 0.18 250);
  --color-primary-700: oklch(0.44 0.16 250);
  --color-primary-800: oklch(0.36 0.14 250);
  --color-primary-900: oklch(0.28 0.12 250);
  --color-primary-950: oklch(0.20 0.10 250);
}
```

### Spacing (`--spacing-*`)

```css
@theme {
  /* Base spacing (8px grid) */
  --spacing-0: 0;
  --spacing-px: 1px;
  --spacing-0_5: 0.125rem;  /* 2px */
  --spacing-1: 0.25rem;     /* 4px */
  --spacing-1_5: 0.375rem;  /* 6px */
  --spacing-2: 0.5rem;      /* 8px */
  --spacing-2_5: 0.625rem;  /* 10px */
  --spacing-3: 0.75rem;     /* 12px */
  --spacing-3_5: 0.875rem;  /* 14px */
  --spacing-4: 1rem;        /* 16px */
  --spacing-5: 1.25rem;     /* 20px */
  --spacing-6: 1.5rem;      /* 24px */
  --spacing-7: 1.75rem;     /* 28px */
  --spacing-8: 2rem;        /* 32px */
  --spacing-9: 2.25rem;     /* 36px */
  --spacing-10: 2.5rem;     /* 40px */
  --spacing-11: 2.75rem;    /* 44px */
  --spacing-12: 3rem;       /* 48px */
  --spacing-14: 3.5rem;     /* 56px */
  --spacing-16: 4rem;       /* 64px */
  --spacing-20: 5rem;       /* 80px */
  --spacing-24: 6rem;       /* 96px */
  --spacing-28: 7rem;       /* 112px */
  --spacing-32: 8rem;       /* 128px */
  --spacing-36: 9rem;       /* 144px */
  --spacing-40: 10rem;      /* 160px */
  --spacing-44: 11rem;      /* 176px */
  --spacing-48: 12rem;      /* 192px */
  --spacing-52: 13rem;      /* 208px */
  --spacing-56: 14rem;      /* 224px */
  --spacing-60: 15rem;      /* 240px */
  --spacing-64: 16rem;      /* 256px */
  --spacing-72: 18rem;      /* 288px */
  --spacing-80: 20rem;      /* 320px */
  --spacing-96: 24rem;      /* 384px */

  /* Custom spacing */
  --spacing-18: 4.5rem;     /* 72px */
  --spacing-22: 5.5rem;     /* 88px */
}
```

**Generated Utilities:**
```html
<div class="p-4 m-8 gap-6">
<div class="w-64 h-96 max-w-screen">
<div class="inset-0 top-4 left-8">
```

### Typography (`--font-*`, `--text-*`, `--leading-*`, `--tracking-*`)

```css
@theme {
  /* Font families */
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-serif: "Merriweather", ui-serif, Georgia, serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
  --font-display: "Cal Sans", "Inter", sans-serif;

  /* Font sizes */
  --text-xs: 0.75rem;       /* 12px */
  --text-sm: 0.875rem;      /* 14px */
  --text-base: 1rem;        /* 16px */
  --text-lg: 1.125rem;      /* 18px */
  --text-xl: 1.25rem;       /* 20px */
  --text-2xl: 1.5rem;       /* 24px */
  --text-3xl: 1.875rem;     /* 30px */
  --text-4xl: 2.25rem;      /* 36px */
  --text-5xl: 3rem;         /* 48px */
  --text-6xl: 3.75rem;      /* 60px */
  --text-7xl: 4.5rem;       /* 72px */
  --text-8xl: 6rem;         /* 96px */
  --text-9xl: 8rem;         /* 128px */

  /* Line heights */
  --leading-none: 1;
  --leading-tight: 1.25;
  --leading-snug: 1.375;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;
  --leading-loose: 2;
  --leading-3: 0.75rem;
  --leading-4: 1rem;
  --leading-5: 1.25rem;
  --leading-6: 1.5rem;
  --leading-7: 1.75rem;
  --leading-8: 2rem;
  --leading-9: 2.25rem;
  --leading-10: 2.5rem;

  /* Letter spacing */
  --tracking-tighter: -0.05em;
  --tracking-tight: -0.025em;
  --tracking-normal: 0;
  --tracking-wide: 0.025em;
  --tracking-wider: 0.05em;
  --tracking-widest: 0.1em;

  /* Font weights */
  --font-weight-thin: 100;
  --font-weight-extralight: 200;
  --font-weight-light: 300;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --font-weight-extrabold: 800;
  --font-weight-black: 900;
}
```

**Generated Utilities:**
```html
<h1 class="font-display text-4xl font-bold tracking-tight">
<p class="font-sans text-base leading-relaxed">
<code class="font-mono text-sm">
```

### Border Radius (`--radius-*`)

```css
@theme {
  --radius-none: 0;
  --radius-sm: 0.125rem;    /* 2px */
  --radius-default: 0.25rem; /* 4px */
  --radius-md: 0.375rem;    /* 6px */
  --radius-lg: 0.5rem;      /* 8px */
  --radius-xl: 0.75rem;     /* 12px */
  --radius-2xl: 1rem;       /* 16px */
  --radius-3xl: 1.5rem;     /* 24px */
  --radius-full: 9999px;
}
```

**Generated Utilities:**
```html
<div class="rounded-lg">
<button class="rounded-md">
<span class="rounded-full">
```

### Shadows (`--shadow-*`)

```css
@theme {
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-default: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
  --shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25);
  --shadow-inner: inset 0 2px 4px 0 rgb(0 0 0 / 0.05);
  --shadow-none: 0 0 #0000;

  /* Colored shadows */
  --shadow-primary: 0 4px 14px -3px oklch(0.6 0.2 250 / 0.4);
  --shadow-destructive: 0 4px 14px -3px oklch(0.55 0.22 25 / 0.4);
}
```

### Animations (`--animate-*`)

```css
@theme {
  --animate-spin: spin 1s linear infinite;
  --animate-ping: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
  --animate-pulse: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  --animate-bounce: bounce 1s infinite;

  /* Custom animations */
  --animate-accordion-down: accordion-down 200ms ease-out;
  --animate-accordion-up: accordion-up 200ms ease-out;
  --animate-fade-in: fade-in 200ms ease-out;
  --animate-fade-out: fade-out 200ms ease-out;
  --animate-slide-in-from-top: slide-in-from-top 200ms ease-out;
  --animate-slide-in-from-bottom: slide-in-from-bottom 200ms ease-out;
  --animate-slide-in-from-left: slide-in-from-left 200ms ease-out;
  --animate-slide-in-from-right: slide-in-from-right 200ms ease-out;
}

@keyframes accordion-down {
  from { height: 0; }
  to { height: var(--radix-accordion-content-height); }
}

@keyframes accordion-up {
  from { height: var(--radix-accordion-content-height); }
  to { height: 0; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes slide-in-from-top {
  from { transform: translateY(-100%); }
  to { transform: translateY(0); }
}

@keyframes slide-in-from-bottom {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@keyframes slide-in-from-left {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

@keyframes slide-in-from-right {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
```

### Transitions (`--transition-*`, `--duration-*`, `--ease-*`)

```css
@theme {
  /* Durations */
  --duration-75: 75ms;
  --duration-100: 100ms;
  --duration-150: 150ms;
  --duration-200: 200ms;
  --duration-300: 300ms;
  --duration-500: 500ms;
  --duration-700: 700ms;
  --duration-1000: 1000ms;

  /* Timing functions */
  --ease-linear: linear;
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);

  /* Transition properties */
  --transition-none: none;
  --transition-all: all var(--duration-150) var(--ease-in-out);
  --transition-default: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter var(--duration-150) var(--ease-in-out);
  --transition-colors: color, background-color, border-color, text-decoration-color, fill, stroke var(--duration-150) var(--ease-in-out);
  --transition-opacity: opacity var(--duration-150) var(--ease-in-out);
  --transition-shadow: box-shadow var(--duration-150) var(--ease-in-out);
  --transition-transform: transform var(--duration-150) var(--ease-in-out);
}
```

### Z-Index (`--z-*`)

```css
@theme {
  --z-0: 0;
  --z-10: 10;
  --z-20: 20;
  --z-30: 30;
  --z-40: 40;
  --z-50: 50;

  /* Semantic z-index */
  --z-dropdown: 1000;
  --z-sticky: 1020;
  --z-fixed: 1030;
  --z-modal-backdrop: 1040;
  --z-modal: 1050;
  --z-popover: 1060;
  --z-tooltip: 1070;
  --z-toast: 1080;
}
```

## Dark Mode with @theme

### Strategy 1: CSS Variables (Recommended)

```css
/* Base layer - define CSS variables */
@layer base {
  :root {
    --background: oklch(0.98 0 0);
    --foreground: oklch(0.15 0.02 250);
    --primary: oklch(0.6 0.2 250);
    --primary-foreground: oklch(0.98 0 0);
    /* ... more tokens */
  }

  .dark {
    --background: oklch(0.12 0.02 250);
    --foreground: oklch(0.95 0 0);
    --primary: oklch(0.70 0.18 250);
    --primary-foreground: oklch(0.10 0.02 250);
    /* ... more tokens */
  }
}

/* Theme layer - reference variables */
@theme {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
}
```

### Strategy 2: @theme inline

```css
@theme {
  --color-background: light-dark(oklch(0.98 0 0), oklch(0.12 0.02 250));
  --color-foreground: light-dark(oklch(0.15 0.02 250), oklch(0.95 0 0));
}
```

## Complete Theme File

```css
/* src/styles/globals.css */
@import "tailwindcss";

/* ============================================
   CSS VARIABLES (for dark mode switching)
   ============================================ */
@layer base {
  :root {
    --background: oklch(0.98 0 0);
    --foreground: oklch(0.15 0.02 250);

    --card: oklch(0.99 0 0);
    --card-foreground: oklch(0.15 0.02 250);

    --popover: oklch(0.99 0 0);
    --popover-foreground: oklch(0.15 0.02 250);

    --primary: oklch(0.6 0.2 250);
    --primary-foreground: oklch(0.98 0 0);

    --secondary: oklch(0.95 0.02 250);
    --secondary-foreground: oklch(0.15 0.02 250);

    --muted: oklch(0.95 0.01 250);
    --muted-foreground: oklch(0.45 0.02 250);

    --accent: oklch(0.95 0.02 250);
    --accent-foreground: oklch(0.15 0.02 250);

    --destructive: oklch(0.55 0.22 25);
    --destructive-foreground: oklch(0.98 0 0);

    --border: oklch(0.90 0.01 250);
    --input: oklch(0.90 0.01 250);
    --ring: oklch(0.6 0.2 250);

    --radius: 0.5rem;
  }

  .dark {
    --background: oklch(0.12 0.02 250);
    --foreground: oklch(0.95 0 0);

    --card: oklch(0.15 0.02 250);
    --card-foreground: oklch(0.95 0 0);

    --popover: oklch(0.15 0.02 250);
    --popover-foreground: oklch(0.95 0 0);

    --primary: oklch(0.70 0.18 250);
    --primary-foreground: oklch(0.10 0.02 250);

    --secondary: oklch(0.22 0.03 250);
    --secondary-foreground: oklch(0.95 0 0);

    --muted: oklch(0.22 0.02 250);
    --muted-foreground: oklch(0.65 0.02 250);

    --accent: oklch(0.22 0.03 250);
    --accent-foreground: oklch(0.95 0 0);

    --destructive: oklch(0.50 0.20 25);
    --destructive-foreground: oklch(0.98 0 0);

    --border: oklch(0.25 0.02 250);
    --input: oklch(0.25 0.02 250);
    --ring: oklch(0.70 0.18 250);
  }
}

/* ============================================
   @THEME DIRECTIVE (Tailwind v4)
   ============================================ */
@theme {
  /* Colors - reference CSS variables */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  /* Typography */
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  /* Border radius */
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  /* Animations */
  --animate-accordion-down: accordion-down 200ms ease-out;
  --animate-accordion-up: accordion-up 200ms ease-out;
}

/* ============================================
   KEYFRAMES
   ============================================ */
@keyframes accordion-down {
  from { height: 0; }
  to { height: var(--radix-accordion-content-height); }
}

@keyframes accordion-up {
  from { height: var(--radix-accordion-content-height); }
  to { height: 0; }
}

/* ============================================
   BASE STYLES
   ============================================ */
@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}
```

## Theme Worker Integration

The theme-worker generates @theme configurations:

```typescript
interface ThemeConfig {
  colors: Record<string, string>
  spacing?: Record<string, string>
  fonts?: Record<string, string>
  radii?: Record<string, string>
  shadows?: Record<string, string>
  darkMode: boolean
}

function generateThemeCSS(config: ThemeConfig): string {
  const lines: string[] = ['@theme {']

  // Colors
  for (const [name, value] of Object.entries(config.colors)) {
    lines.push(`  --color-${name}: ${value};`)
  }

  // Spacing
  if (config.spacing) {
    for (const [name, value] of Object.entries(config.spacing)) {
      lines.push(`  --spacing-${name}: ${value};`)
    }
  }

  // Fonts
  if (config.fonts) {
    for (const [name, value] of Object.entries(config.fonts)) {
      lines.push(`  --font-${name}: ${value};`)
    }
  }

  lines.push('}')
  return lines.join('\n')
}
```

## Migration from Tailwind v3

| v3 (tailwind.config.js) | v4 (@theme in CSS) |
|------------------------|-------------------|
| `colors: { primary: '#...' }` | `--color-primary: #...;` |
| `spacing: { '18': '4.5rem' }` | `--spacing-18: 4.5rem;` |
| `fontFamily: { sans: [...] }` | `--font-sans: ...;` |
| `borderRadius: { lg: '...' }` | `--radius-lg: ...;` |
| `boxShadow: { md: '...' }` | `--shadow-md: ...;` |

## Best Practices

| Do | Don't |
|----|-------|
| Use semantic token names | Use arbitrary color codes |
| Define in @theme for utilities | Hardcode values in components |
| Use CSS variables for dark mode | Duplicate tokens for each mode |
| Follow naming conventions | Create custom namespace prefixes |
| Keep related tokens together | Scatter tokens across files |
