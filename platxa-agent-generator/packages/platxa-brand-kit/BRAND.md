# Platxa Brand Kit

> **Build, What's Next?**

---

## Company Information

| Attribute | Value |
|-----------|-------|
| **Company Name** | Platxa |
| **Full Name** | Platxa - AI Research & Product Development Company |
| **Tagline** | Build, What's Next? |
| **Website** | [https://platxa.com](https://platxa.com) |
| **Founded By** | DJ Patel |
| **Role** | Founder & CEO |

---

## Mission Statement

Platxa is an AI Research & Product Development Company dedicated to building the next generation of intelligent tools and platforms. We combine cutting-edge AI research with practical product development to create solutions that empower developers, designers, and businesses to build what's next.

---

## Brand Identity

### Logo

The Platxa logo features a **hexagonal design** with 3D cube elements, representing:
- **Innovation**: Modern geometric shapes
- **Depth**: Three-dimensional perspective
- **Structure**: Hexagonal foundation (stability, efficiency)
- **Forward Motion**: Curved accent element

### Primary Colors

| Color | OKLCH | HEX | Usage |
|-------|-------|-----|-------|
| **Purple** | `oklch(0.50 0.22 295)` | `#8B35A8` | Primary brand, headers, key UI |
| **Teal** | `oklch(0.72 0.14 185)` | `#2ECCC4` | Accent, CTAs, highlights |

### Color Application (60-30-10 Rule)

- **60% Neutral** (Gray): Backgrounds, cards, containers
- **30% Primary** (Purple): Headers, primary buttons, navigation
- **10% Accent** (Teal): Call-to-actions, highlights, interactive elements

### Typography

| Purpose | Font | Fallbacks |
|---------|------|-----------|
| **UI/Body** | Inter | SF Pro, -apple-system, sans-serif |
| **Code** | JetBrains Mono | SF Mono, Consolas, monospace |

---

## Brand Voice

### Personality Traits

| Trait | Description |
|-------|-------------|
| **Confident** | Direct statements, clear positioning |
| **Approachable** | Avoid jargon, explain simply |
| **Future-focused** | Emphasize innovation, what's possible |
| **Action-oriented** | Active voice, verbs over nouns |

### Tone Guidelines

- **Do**: Be clear, be bold, inspire action
- **Don't**: Be vague, use buzzwords, overcomplicate

### Example Phrases

✅ "Build what's next with AI-powered tools"
✅ "From idea to production in days, not months"
✅ "Your vision, amplified by AI"

❌ "Leveraging synergies to optimize outcomes"
❌ "Best-in-class solutions for enterprise needs"

---

## Logo Usage Guidelines

### Clear Space

Maintain minimum padding equal to the height of the "P" in PLATXA around all sides of the logo.

### Minimum Size

- **Digital**: 24px height minimum
- **Print**: 0.5 inch height minimum

### Approved Backgrounds

| Background | Logo Version |
|------------|--------------|
| White/Light | Default (full color) |
| Dark/Black | Light version |
| Purple | White/Light version |
| Teal | Dark version |

### Prohibited Uses

- ❌ Do not stretch or distort
- ❌ Do not rotate
- ❌ Do not change colors arbitrarily
- ❌ Do not add effects (shadows, glows)
- ❌ Do not place on busy backgrounds

---

## Design Tokens Quick Reference

### Colors (OKLCH)

```css
/* Primary Purple Scale */
--purple-9: oklch(0.50 0.22 295);  /* Brand color */

/* Accent Teal Scale */
--teal-9: oklch(0.72 0.14 185);    /* Brand accent */

/* Neutral Gray (purple-tinted) */
--gray-1: oklch(0.99 0.002 285);   /* Background */
--gray-12: oklch(0.12 0.006 285);  /* Text */
```

### Spacing (8px Grid)

```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px - base */
--space-4: 1rem;      /* 16px */
--space-8: 2rem;      /* 32px */
```

### Typography Scale

```css
--text-heading-xl: 3.5rem;  /* 56px */
--text-heading-md: 2rem;    /* 32px */
--text-body-md: 1rem;       /* 16px */
--text-body-sm: 0.875rem;   /* 14px */
```

---

## For AI Agents

When generating UI for Platxa:

1. **Use brand colors**: Purple for primary elements, Teal for accents
2. **Follow 60-30-10**: Mostly neutral, purple for emphasis, teal sparingly
3. **Typography**: Inter for UI, JetBrains Mono for code
4. **Spacing**: Stick to 8px grid (4, 8, 16, 24, 32, 48, 64)
5. **Tone**: Confident, clear, action-oriented
6. **Dark mode**: Invert lightness, maintain brand colors

### Import Tokens

```css
@import "@platxa/brand-kit";
```

### Tailwind Integration

```ts
// tailwind.config.ts
import platxaPreset from "@platxa/brand-kit/tailwind";

export default {
  presets: [platxaPreset],
  // ...
};
```

---

## File Structure

```
@platxa/brand-kit/
├── src/
│   ├── tokens/           # Design tokens (CSS)
│   │   ├── primitives.css
│   │   ├── semantic.css
│   │   ├── typography.css
│   │   └── index.css
│   ├── themes/           # Light/Dark themes
│   │   ├── light.css
│   │   └── dark.css
│   └── tailwind.preset.ts
├── assets/logos/         # Logo files
├── BRAND.md              # This file
└── README.md             # Installation guide
```

---

## Attribution

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DJ Patel | Founder & CEO @ Platxa
  AI Research & Product Development Company
  https://platxa.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

*Last Updated: January 2026*
*Version: 1.0.0*
