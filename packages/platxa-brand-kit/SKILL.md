---
name: platxa-brand-kit
description: Design tokens, colors, and theming for Platxa platform development
version: 1.0.0
author: DJ Patel | Founder & CEO @ Platxa
---

# Platxa Brand Kit Skill

Use this skill when generating UI components, styling, or any visual elements for the Platxa platform.

## Quick Reference

### Brand Colors (OKLCH)

| Color | Token | OKLCH | HEX | Usage |
|-------|-------|-------|-----|-------|
| **Purple** | `--purple-9` | `oklch(0.50 0.22 295)` | `#8B35A8` | Primary brand, headers, buttons |
| **Teal** | `--teal-9` | `oklch(0.72 0.14 185)` | `#2ECCC4` | Accent, CTAs, highlights |
| **Gray** | `--gray-12` | `oklch(0.12 0.006 285)` | `#1C1C21` | Text, high contrast |

### Color Application Rule (60-30-10)

- **60% Neutral (Gray)**: Backgrounds, cards, containers
- **30% Primary (Purple)**: Headers, primary buttons, navigation
- **10% Accent (Teal)**: CTAs, highlights, interactive elements

### Typography

```css
/* Primary UI font */
font-family: var(--font-sans); /* Inter */

/* Code/monospace */
font-family: var(--font-mono); /* JetBrains Mono */
```

### Spacing (8px Grid)

Use multiples of 8px: `4, 8, 12, 16, 24, 32, 48, 64, 96`

```css
padding: var(--space-4);  /* 16px */
gap: var(--space-6);      /* 24px */
margin: var(--space-8);   /* 32px */
```

## When Generating UI

### DO

1. **Use semantic tokens** for colors:
   ```css
   background: var(--background);
   color: var(--foreground);
   border-color: var(--border);
   ```

2. **Use brand colors** for emphasis:
   ```css
   /* Primary actions */
   background: var(--primary);

   /* Accent highlights */
   color: var(--accent);
   ```

3. **Follow the 60-30-10 rule**:
   - Most surfaces: `var(--gray-1)` to `var(--gray-3)`
   - Primary elements: `var(--purple-*)` scale
   - Highlights only: `var(--teal-*)` scale

4. **Maintain WCAG contrast**:
   - Text on backgrounds: 4.5:1 minimum
   - Large text: 3:1 minimum

5. **Support dark mode**:
   ```css
   /* Tokens automatically adapt */
   [data-theme="dark"] { /* values invert */ }
   ```

### DON'T

1. ❌ Use arbitrary colors - always use tokens
2. ❌ Mix brand colors randomly - follow hierarchy
3. ❌ Skip semantic tokens for raw values
4. ❌ Ignore spacing scale - use 8px grid
5. ❌ Forget dark mode considerations

## Component Examples

### Button (Primary)

```tsx
<button className="
  bg-primary hover:bg-primary-hover
  text-primary-foreground
  px-4 py-2 rounded-md
  font-medium
  transition-colors
">
  Get Started
</button>
```

### Card

```tsx
<div className="
  bg-card border border-border
  rounded-lg p-6
  shadow-sm
">
  <h3 className="text-lg font-semibold text-foreground">
    Card Title
  </h3>
  <p className="text-muted-foreground mt-2">
    Card content goes here.
  </p>
</div>
```

### Input

```tsx
<input
  className="
    w-full px-3 py-2
    bg-input border border-input-border
    rounded-md
    text-foreground placeholder:text-input-placeholder
    focus:outline-none focus:ring-2 focus:ring-ring
  "
  placeholder="Enter text..."
/>
```

## Importing Tokens

### CSS

```css
@import "@platxa/brand-kit";
@import "@platxa/brand-kit/themes";
```

### Tailwind CSS

```ts
// tailwind.config.ts
import platxaPreset from "@platxa/brand-kit/tailwind";

export default {
  presets: [platxaPreset],
};
```

## Token Reference

### Semantic Tokens

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--background` | gray-1 | gray-12 | Page background |
| `--foreground` | gray-12 | gray-1 | Primary text |
| `--primary` | purple-9 | purple-9 | Brand actions |
| `--accent` | teal-9 | teal-9 | Highlights |
| `--muted` | gray-4 | gray-10 | Subtle elements |
| `--border` | gray-6 | gray-9 | Borders |
| `--ring` | purple-7 | purple-8 | Focus rings |

### Feedback Colors

| Token | Usage |
|-------|-------|
| `--destructive` | Errors, delete actions |
| `--success` | Success states |
| `--warning` | Warnings, caution |
| `--info` | Informational |

## Brand Voice

When generating copy or microcopy:

- **Be confident**: Direct statements, clear positioning
- **Be approachable**: Avoid jargon, explain simply
- **Be action-oriented**: Active voice, verbs over nouns

### Example Phrases

✅ "Build what's next with AI-powered tools"
✅ "From idea to production in days, not months"

❌ "Leveraging synergies to optimize outcomes"
❌ "Best-in-class solutions for enterprise needs"

---

*Platxa - Build, What's Next?*
*DJ Patel | Founder & CEO @ Platxa*
*https://platxa.com*
