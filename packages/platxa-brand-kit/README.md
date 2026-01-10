# @platxa/brand-kit

Design tokens, OKLCH colors, and Tailwind CSS v4 theming for Platxa platform development.

> **Build, What's Next?**

## Installation

```bash
npm install @platxa/brand-kit
# or
pnpm add @platxa/brand-kit
# or
yarn add @platxa/brand-kit
```

## Quick Start

### CSS Import

```css
/* Import all tokens */
@import "@platxa/brand-kit";

/* Import themes (light + dark with auto-detection) */
@import "@platxa/brand-kit/themes";
```

### Tailwind CSS v4

```ts
// tailwind.config.ts
import platxaPreset from "@platxa/brand-kit/tailwind";

export default {
  presets: [platxaPreset],
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
};
```

### Individual Imports

```css
/* Primitives only */
@import "@platxa/brand-kit/tokens/primitives";

/* Semantic tokens */
@import "@platxa/brand-kit/tokens/semantic";

/* Typography */
@import "@platxa/brand-kit/tokens/typography";

/* Spacing */
@import "@platxa/brand-kit/tokens/spacing";

/* Light theme only */
@import "@platxa/brand-kit/themes/light";

/* Dark theme only */
@import "@platxa/brand-kit/themes/dark";
```

## Features

- **OKLCH Color Space**: Perceptually uniform colors with P3 wide gamut support
- **12-Step Color Scales**: Purple (primary), Teal (accent), Gray (neutral)
- **Semantic Tokens**: Purpose-based naming (background, foreground, primary, accent)
- **shadcn/ui Compatible**: Works seamlessly with shadcn/ui components
- **Dark Mode**: Automatic via `prefers-color-scheme` or manual via `data-theme`
- **8px Grid System**: Consistent spacing scale
- **Tailwind v4 Preset**: CSS-first configuration with @theme directive
- **Type-Safe**: Full TypeScript support

## Brand Colors

| Color | OKLCH | HEX | Usage |
|-------|-------|-----|-------|
| Purple | `oklch(0.50 0.22 295)` | `#8B35A8` | Primary brand |
| Teal | `oklch(0.72 0.14 185)` | `#2ECCC4` | Accent |
| Gray | `oklch(0.12 0.006 285)` | `#1C1C21` | Text |

### 60-30-10 Rule

- **60% Neutral**: Backgrounds, cards (`--gray-*`)
- **30% Primary**: Headers, buttons (`--purple-*`)
- **10% Accent**: CTAs, highlights (`--teal-*`)

## Usage Examples

### CSS Custom Properties

```css
.button {
  background: var(--primary);
  color: var(--primary-foreground);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
}

.button:hover {
  background: var(--primary-hover);
}
```

### Tailwind Classes

```html
<button class="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary-hover">
  Get Started
</button>

<div class="bg-card border border-border rounded-lg p-6">
  <h3 class="text-lg font-semibold text-foreground">Card Title</h3>
  <p class="text-muted-foreground">Card content</p>
</div>
```

## Theme Switching

### Automatic (System Preference)

The dark theme automatically applies when the user's system prefers dark mode.

### Manual Toggle

```html
<!-- Force light theme -->
<html data-theme="light">

<!-- Force dark theme -->
<html data-theme="dark">
```

```js
// Toggle theme
function toggleTheme() {
  const current = document.documentElement.dataset.theme;
  document.documentElement.dataset.theme = current === 'dark' ? 'light' : 'dark';
}
```

## Token Reference

### Semantic Tokens

| Token | Description |
|-------|-------------|
| `--background` | Page background |
| `--foreground` | Primary text |
| `--primary` | Primary brand color |
| `--primary-foreground` | Text on primary |
| `--accent` | Accent/highlight color |
| `--muted` | Subtle backgrounds |
| `--muted-foreground` | Secondary text |
| `--card` | Card backgrounds |
| `--border` | Border color |
| `--input` | Input backgrounds |
| `--ring` | Focus ring color |

### Feedback Colors

| Token | Description |
|-------|-------------|
| `--destructive` | Error/delete actions |
| `--success` | Success states |
| `--warning` | Warning states |
| `--info` | Informational |

## Typography

```css
/* Fonts */
--font-sans: Inter, system-ui, sans-serif;
--font-mono: JetBrains Mono, monospace;

/* Sizes */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */
```

## Spacing (8px Grid)

```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-24: 6rem;     /* 96px */
```

## Browser Support

- **OKLCH**: Chrome 111+, Safari 15.4+, Firefox 113+
- **Fallbacks**: HEX colors for older browsers via `@supports`

## File Structure

```
@platxa/brand-kit/
├── src/
│   ├── tokens/
│   │   ├── index.css        # All tokens
│   │   ├── primitives.css   # Color scales
│   │   ├── semantic.css     # Semantic mappings
│   │   ├── typography.css   # Fonts & sizes
│   │   └── spacing.css      # 8px grid
│   ├── themes/
│   │   ├── index.css        # All themes
│   │   ├── light.css        # Light theme
│   │   └── dark.css         # Dark theme
│   └── tailwind.preset.ts   # Tailwind v4 preset
├── assets/logos/            # Logo files
├── BRAND.md                 # Brand guidelines
├── SKILL.md                 # AI agent skill
└── README.md                # This file
```

## License

MIT

---

**Platxa** - AI Research & Product Development Company

*DJ Patel | Founder & CEO*

[https://platxa.com](https://platxa.com)
