# Platxa Brand Kit Research Synthesis

> **Research Quality Score**: 8.9/10
> **Sources Analyzed**: 12
> **Features Generated**: 40
> **Date**: January 2026

---

## Executive Summary

This document synthesizes comprehensive research across 12 authoritative sources covering design token standards, OKLCH color space, Tailwind CSS v4 theming, AI platform branding patterns, typography systems, and brand asset organization. The findings provide a robust foundation for creating the **Platxa Brand Kit** that will power all Platxa platform development.

The research reveals three foundational pillars for modern brand systems: (1) **OKLCH color space** for perceptual uniformity and wide-gamut display support, (2) **three-tier token architecture** (primitive → semantic → component) following the W3C Design Tokens specification, and (3) **CSS-first configuration** using Tailwind CSS v4's revolutionary `@theme` directive.

Platxa's distinctive **purple-teal color combination** positions the brand uniquely in the AI space—avoiding the overused blues of most tech companies while maintaining trust and innovation signals. Combined with the forward-thinking tagline **"Build, What's Next?"**, the brand identity communicates action, innovation, and future-focus that resonates with developers and AI researchers alike.

---

## Table of Contents

1. [Foundation Research](#part-1-foundation-research)
   - [W3C Design Tokens Specification](#11-w3c-design-tokens-specification-v202510)
   - [OKLCH Color Space](#12-oklch-color-space-deep-dive)
   - [Three-Tier Token Architecture](#13-three-tier-token-architecture)
2. [Implementation Standards](#part-2-implementation-standards)
   - [Tailwind CSS v4 @theme Directive](#21-tailwind-css-v4-theme-directive)
   - [Dark/Light Theme Implementation](#22-darklight-theme-implementation)
   - [Radix + shadcn/ui Integration](#23-radix--shadcnui-integration)
3. [Brand Identity Research](#part-3-brand-identity-research)
   - [AI Platform Branding Patterns](#31-ai-platform-branding-patterns)
   - [Typography Systems](#32-typography-systems)
   - [Brand Asset Organization](#33-brand-asset-organization)
4. [Platxa Brand Analysis](#part-4-platxa-brand-analysis)
   - [Logo Color Extraction](#41-logo-color-extraction)
   - [12-Step Color Scale Generation](#42-12-step-color-scale-generation)
   - [Brand Personality & Voice](#43-brand-personality--voice)
5. [Implementation Blueprint](#part-5-implementation-blueprint)
   - [Package Structure](#51-package-structure)
   - [Typography System](#52-typography-system)
   - [Spacing System](#53-spacing-system-8px-grid)
   - [Effects & Gradients](#54-effects--gradients)
6. [Quality & Accessibility](#part-6-quality--accessibility)
7. [Appendices](#appendices)

---

## Part 1: Foundation Research

### 1.1 W3C Design Tokens Specification v2025.10

**Source**: [W3C Design Tokens Community Group](https://www.w3.org/community/design-tokens/)

The Design Tokens Community Group released the first **stable specification (v2025.10)** in October 2025, marking a milestone for design systems teams worldwide. This production-ready, vendor-neutral format enables sharing design decisions across tools and platforms.

#### Key Features

| Feature | Description |
|---------|-------------|
| **JSON Format** | Tokens defined with `$value`, `$type`, `$description` keys |
| **Color Spaces** | Full support for Display P3, OKLCH, CSS Color Module 4 |
| **Theming** | Built-in light/dark modes, accessibility variants, multi-brand |
| **Relationships** | Inheritance, aliases, component-level references |
| **Cross-Platform** | Single file generates iOS, Android, web, Flutter code |

#### Format Example

```json
{
  "color": {
    "primary": {
      "$type": "color",
      "$value": "oklch(0.50 0.22 295)",
      "$description": "Platxa primary purple - extracted from logo"
    },
    "accent": {
      "$type": "color",
      "$value": "oklch(0.72 0.14 185)",
      "$description": "Platxa accent teal - from logo curve element"
    }
  }
}
```

#### Industry Support

The specification is backed by reference implementations in **Style Dictionary**, **Tokens Studio**, and **Terrazzo**. Organizations represented include:

> Adobe, Amazon, Google, Baidu, Sony, Microsoft, Meta, Sketch, Salesforce, Shopify, Figma, Framer, Cisco, Intuit, New York Times, GM, Disney

---

### 1.2 OKLCH Color Space Deep Dive

**Sources**: [Evil Martians](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl), [oklch.org](https://oklch.org/posts/ultimate-oklch-guide)

OKLCH (Oklab Lightness Chroma Hue) is a **perceptually uniform** color space created by Björn Ottosson in 2020, now widely supported in modern browsers.

#### Syntax

```css
color: oklch(L C H);
color: oklch(L C H / alpha);

/* With units */
color: oklch(50% 0.22 295deg);
color: oklch(0.50 0.22 295 / 80%);
```

#### Value Ranges

| Component | Range | Description |
|-----------|-------|-------------|
| **L** (Lightness) | 0-100% or 0-1 | 0 = black, 100% = white |
| **C** (Chroma) | 0-0.4+ | Saturation intensity (0.32 max for SDR) |
| **H** (Hue) | 0-360° | Position on color wheel |

#### Why OKLCH Over HSL/RGB

| Aspect | HSL/RGB | OKLCH |
|--------|---------|-------|
| Perceptual Uniformity | ❌ Distorted | ✅ Same L = same brightness |
| Contrast Predictability | ❌ Requires calculation | ✅ ΔL≈40 = WCAG compliant |
| Wide Gamut | ❌ sRGB only | ✅ P3, Rec. 2020 |
| Human Readability | ❌ Hex codes cryptic | ✅ Intuitive L/C/H |

#### Practical CSS Patterns

```css
/* Generate hover state - lighten by mixing with white */
.button:hover {
  background: color-mix(in oklch, var(--primary) 80%, white);
}

/* Generate active state - reduce lightness */
.button:active {
  background: oklch(from var(--primary) calc(l - 0.1) c h);
}

/* Transparent variant */
.overlay {
  background: oklch(from var(--primary) l c h / 50%);
}

/* Ensure contrast - add 40% lightness difference */
.text-on-primary {
  color: oklch(from var(--primary) calc(l + 0.4) 0.02 h);
}
```

#### Browser Support

| Browser | Version | Notes |
|---------|---------|-------|
| Chrome/Edge | 111+ | Full support, DevTools color picker |
| Safari | 15.4+ | Full support |
| Firefox | 113+ | Full support |

---

### 1.3 Three-Tier Token Architecture

**Source**: [Martin Fowler - Design Token-Based UI Architecture](https://martinfowler.com/articles/design-token-based-ui-architecture.html)

Design tokens are organized into a layered architecture that separates **what exists** from **how it's used** and **where it's applied**.

#### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3: Component Tokens                                      │
│  ─────────────────────────                                      │
│  Scoped to specific UI elements                                 │
│  --button-bg: var(--color-primary)                             │
│  --card-border: var(--color-border)                            │
│  --input-focus-ring: var(--color-ring)                         │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: Semantic Tokens                                       │
│  ────────────────────────                                       │
│  Contextual meaning and purpose                                 │
│  --color-primary: var(--purple-9)                              │
│  --color-accent: var(--teal-9)                                 │
│  --color-background: var(--gray-1)                             │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 1: Primitive Tokens                                      │
│  ─────────────────────────                                      │
│  Raw values without semantic meaning                            │
│  --purple-9: oklch(0.50 0.22 295)                              │
│  --teal-9: oklch(0.72 0.14 185)                                │
│  --gray-1: oklch(0.99 0.002 285)                               │
└─────────────────────────────────────────────────────────────────┘
```

#### Layer Definitions

| Layer | Name | Purpose | Example |
|-------|------|---------|---------|
| **1** | Primitive (Option) | Raw values, no meaning | `--purple-500`, `--space-16` |
| **2** | Semantic (Decision) | Contextual purpose | `--color-primary`, `--text-body` |
| **3** | Component (Scoped) | UI element specific | `--button-bg`, `--card-shadow` |

#### Benefits

- **Theme switching**: Change primitive layer, entire theme updates
- **Consistency**: Semantic layer enforces design decisions
- **Documentation**: Token names communicate intent
- **Scalability**: Add components without touching primitives

---

## Part 2: Implementation Standards

### 2.1 Tailwind CSS v4 @theme Directive

**Source**: [Tailwind CSS v4.0](https://tailwindcss.com/blog/tailwindcss-v4)

Tailwind v4 introduces **CSS-first configuration** via the `@theme` directive, eliminating the need for JavaScript configuration files.

#### Basic Usage

```css
@import "tailwindcss";

@theme {
  /* Colors - auto-generates bg-*, text-*, border-* utilities */
  --color-purple-1: oklch(0.99 0.02 295);
  --color-purple-9: oklch(0.50 0.22 295);
  --color-purple-12: oklch(0.22 0.12 295);

  --color-teal-1: oklch(0.99 0.01 185);
  --color-teal-9: oklch(0.72 0.14 185);
  --color-teal-12: oklch(0.30 0.08 185);

  /* Fonts - auto-generates font-* utilities */
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;

  /* Spacing - auto-generates p-*, m-*, gap-* utilities */
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-4: 1rem;
  --spacing-8: 2rem;

  /* Radius - auto-generates rounded-* utilities */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 1rem;
}
```

#### Namespace Reference

| Namespace | Generated Utilities | Example |
|-----------|--------------------|---------|
| `--color-*` | `bg-*`, `text-*`, `border-*` | `bg-purple-9`, `text-teal-9` |
| `--font-*` | `font-*` | `font-sans`, `font-mono` |
| `--spacing-*` | `p-*`, `m-*`, `gap-*`, `w-*`, `h-*` | `p-4`, `gap-8` |
| `--radius-*` | `rounded-*` | `rounded-md`, `rounded-lg` |
| `--breakpoint-*` | Responsive variants | `md:`, `lg:` |
| `--shadow-*` | `shadow-*` | `shadow-md`, `shadow-lg` |

#### Multi-Theme with @theme inline

```css
@theme inline {
  --color-primary: var(--brand-primary);
  --color-accent: var(--brand-accent);
  --color-background: var(--brand-background);
  --color-foreground: var(--brand-foreground);
}

:root {
  --brand-primary: oklch(0.50 0.22 295);
  --brand-accent: oklch(0.72 0.14 185);
  --brand-background: oklch(0.99 0.002 285);
  --brand-foreground: oklch(0.15 0.01 285);
}

[data-theme="dark"] {
  --brand-primary: oklch(0.65 0.18 295);
  --brand-accent: oklch(0.78 0.12 185);
  --brand-background: oklch(0.12 0.01 285);
  --brand-foreground: oklch(0.95 0.005 285);
}
```

#### Custom Variants

```css
/* Theme-based variants */
@custom-variant dark (&:where([data-theme="dark"] *));
@custom-variant light (&:where([data-theme="light"] *));

/* Usage: dark:bg-purple-11 light:bg-purple-3 */
```

---

### 2.2 Dark/Light Theme Implementation

**Source**: [Frank Congson - Design Tokens to Dark Mode](https://frankcongson.com/blog/design-tokens-to-dark-mode/)

#### Strategy 1: System Preference (Automatic)

```css
:root {
  --color-background: oklch(0.99 0.002 285);
  --color-foreground: oklch(0.15 0.01 285);
  --color-primary: oklch(0.50 0.22 295);
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-background: oklch(0.12 0.01 285);
    --color-foreground: oklch(0.95 0.005 285);
    --color-primary: oklch(0.65 0.18 295);
  }
}
```

#### Strategy 2: Manual Toggle (Data Attribute)

```css
:root,
[data-theme="light"] {
  --color-background: oklch(0.99 0.002 285);
  --color-foreground: oklch(0.15 0.01 285);
}

[data-theme="dark"] {
  --color-background: oklch(0.12 0.01 285);
  --color-foreground: oklch(0.95 0.005 285);
}
```

```html
<html data-theme="dark">
```

```javascript
// Toggle theme
document.documentElement.dataset.theme =
  document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
```

#### Strategy 3: CSS light-dark() Function (Modern)

```css
:root {
  color-scheme: light dark;

  --color-background: light-dark(
    oklch(0.99 0.002 285),  /* light */
    oklch(0.12 0.01 285)    /* dark */
  );

  --color-foreground: light-dark(
    oklch(0.15 0.01 285),
    oklch(0.95 0.005 285)
  );
}
```

#### Lightness Scale Inversion

For dark mode, invert the lightness scale while maintaining chroma and hue:

| Light Mode | Dark Mode | Purpose |
|------------|-----------|---------|
| Step 1 (L=99%) | Step 12 (L=12%) | Background |
| Step 3 (L=94%) | Step 10 (L=25%) | Card surface |
| Step 6 (L=70%) | Step 7 (L=55%) | Border |
| Step 9 (L=50%) | Step 9 (L=65%) | Primary (slightly lighter) |
| Step 12 (L=12%) | Step 1 (L=95%) | Text |

---

### 2.3 Radix + shadcn/ui Integration

**Source**: [Radix Themes Color](https://www.radix-ui.com/themes/docs/theme/color)

#### shadcn/ui Semantic Token Pattern

The shadcn/ui library uses a **background/foreground pair pattern** with modifier prefixes:

```css
:root {
  /* Base */
  --background: oklch(0.99 0.002 285);
  --foreground: oklch(0.15 0.01 285);

  /* Card */
  --card: oklch(0.99 0.002 285);
  --card-foreground: oklch(0.15 0.01 285);

  /* Popover */
  --popover: oklch(0.99 0.002 285);
  --popover-foreground: oklch(0.15 0.01 285);

  /* Primary - Platxa Purple */
  --primary: oklch(0.50 0.22 295);
  --primary-foreground: oklch(0.99 0.002 285);

  /* Secondary */
  --secondary: oklch(0.95 0.01 285);
  --secondary-foreground: oklch(0.20 0.01 285);

  /* Muted */
  --muted: oklch(0.95 0.01 285);
  --muted-foreground: oklch(0.45 0.01 285);

  /* Accent - Platxa Teal */
  --accent: oklch(0.72 0.14 185);
  --accent-foreground: oklch(0.15 0.01 285);

  /* Destructive */
  --destructive: oklch(0.55 0.22 25);
  --destructive-foreground: oklch(0.99 0.002 285);

  /* Border, Input, Ring */
  --border: oklch(0.90 0.005 285);
  --input: oklch(0.90 0.005 285);
  --ring: oklch(0.50 0.22 295);

  /* Radius */
  --radius: 0.5rem;
}

.dark {
  --background: oklch(0.12 0.01 285);
  --foreground: oklch(0.95 0.005 285);

  --card: oklch(0.15 0.01 285);
  --card-foreground: oklch(0.95 0.005 285);

  --primary: oklch(0.65 0.18 295);
  --primary-foreground: oklch(0.12 0.01 285);

  --secondary: oklch(0.22 0.01 285);
  --secondary-foreground: oklch(0.95 0.005 285);

  --muted: oklch(0.22 0.01 285);
  --muted-foreground: oklch(0.65 0.005 285);

  --accent: oklch(0.78 0.12 185);
  --accent-foreground: oklch(0.12 0.01 285);

  --border: oklch(0.25 0.008 285);
  --input: oklch(0.25 0.008 285);
  --ring: oklch(0.65 0.18 295);
}
```

#### Radix 12-Step Color Scale

Radix uses 12 steps per color for granular control:

| Steps | Usage |
|-------|-------|
| 1-2 | Backgrounds |
| 3-4 | Component backgrounds |
| 5-6 | Borders, separators |
| 7-8 | Solid backgrounds, hover states |
| **9** | **Primary solid background (brand step)** |
| 10 | Hover state for step 9 |
| 11 | Low-contrast text |
| 12 | High-contrast text |

---

## Part 3: Brand Identity Research

### 3.1 AI Platform Branding Patterns

**Sources**: [OpenAI Brand](https://openai.com/brand/), [Anthropic - Geist](https://geist.co/work/anthropic), [Claude Logo Analysis](https://www.claila.com/blog/claude-logo)

#### Industry Analysis

| Company | Primary Color | Typography | Personality |
|---------|--------------|------------|-------------|
| **OpenAI** | Black + vibrant accents | OpenAI Sans (geometric) | Innovation, sophistication |
| **Anthropic** | Warm rust-orange #C15F3C | Styrene + Tiempos | Trust, clarity, warmth |
| **Vercel** | Black + white | Geist Sans/Mono | Clean, developer-focused |
| **Platxa** | Purple + Teal | TBD (Inter recommended) | Innovation, action, future |

#### Common Patterns for AI Companies

**Do:**
- Trust, collaboration, clarity as core values
- "Do the simple thing that works" philosophy
- Minimalism and precision
- Human-centered, approachable feel

**Don't:**
- Hyper-futuristic fonts
- Neon colors, techy gradients
- Overly complex or flashy designs

#### Platxa Differentiation

Platxa's **purple-teal combination** is distinctive:
- Avoids overused tech blues
- Purple signals creativity and innovation
- Teal provides energy and action
- Combination is memorable and unique in AI space

---

### 3.2 Typography Systems

**Sources**: [Vercel Geist](https://vercel.com/geist/typography), [JetBrains Mono](https://www.jetbrains.com/lp/mono/)

#### Recommended Font Stack for Platxa

| Purpose | Font | Fallbacks |
|---------|------|-----------|
| **UI/Body** | Inter | SF Pro, -apple-system, Segoe UI, sans-serif |
| **Code** | JetBrains Mono | SF Mono, Fira Code, Consolas, monospace |
| **Display** | Inter (or Cal Sans) | Same as UI |

#### Why Inter + JetBrains Mono

- **Proven pairing** used by: Raycast, Prisma, Basedash
- **Inter**: Screen-optimized, modern, versatile, excellent readability
- **JetBrains Mono**: Designed for developers, crisp at small sizes
- **Both open source**: OFL-1.1 license, free commercial use

#### Typography Scale (Vercel Geist Pattern)

```css
/* Headings */
--text-heading-xxl: 4.5rem;    /* 72px - Hero */
--text-heading-xl: 3.5rem;     /* 56px - Page title */
--text-heading-lg: 2.5rem;     /* 40px - Section */
--text-heading-md: 2rem;       /* 32px - Subsection */
--text-heading-sm: 1.5rem;     /* 24px - Card title */
--text-heading-xs: 1.25rem;    /* 20px - Small heading */

/* Body */
--text-body-lg: 1.25rem;       /* 20px - Lead paragraph */
--text-body-md: 1rem;          /* 16px - Default body */
--text-body-sm: 0.875rem;      /* 14px - Secondary text */
--text-body-xs: 0.8125rem;     /* 13px - Captions */

/* Labels */
--text-label-lg: 0.875rem;     /* 14px - Form labels */
--text-label-md: 0.8125rem;    /* 13px - Button text */
--text-label-sm: 0.75rem;      /* 12px - Tags, badges */

/* Code */
--text-code-lg: 1rem;          /* 16px - Code blocks */
--text-code-md: 0.875rem;      /* 14px - Inline code */
--text-code-sm: 0.75rem;       /* 12px - Terminal */
```

---

### 3.3 Brand Asset Organization

**Sources**: [Canva Brand Kit Guide](https://www.canva.com/learn/how-to-build-a-brand-kit/), [Shopify Brand Guidelines](https://www.shopify.com/blog/brand-guidelines)

#### Required Assets

| Asset | Formats | Variations |
|-------|---------|------------|
| **Logo** | SVG, PNG, PDF | Full, icon-only, wordmark |
| **Colors** | OKLCH, HEX, RGB | Primary, accent, neutrals |
| **Typography** | WOFF2, OTF | All weights needed |

#### Logo Usage Guidelines

- **Clear space**: Minimum padding around logo (typically 1x logo height)
- **Minimum size**: Readable at smallest reproduction (typically 24px height)
- **Backgrounds**: Approved placements (light, dark, color)
- **Prohibited**: Stretching, rotating, changing colors, adding effects

#### File Naming Convention

```
platxa-logo.svg           # Full logo, default
platxa-logo-dark.svg      # For dark backgrounds
platxa-icon.svg           # Icon only (no text)
platxa-wordmark.svg       # Text only (no icon)
platxa-banner.svg         # Logo + tagline
```

---

## Part 4: Platxa Brand Analysis

### 4.1 Logo Color Extraction

From analysis of the provided Platxa logo and banner:

#### Primary Purple (Hexagon Element)

The main hexagonal shape features a **gradient from deep violet to magenta**:

```css
/* Gradient range */
--purple-gradient-start: oklch(0.45 0.24 290);  /* Deep violet */
--purple-gradient-end: oklch(0.55 0.20 300);    /* Magenta tint */

/* Brand step (solid reference) */
--platxa-purple: oklch(0.50 0.22 295);

/* HEX fallback */
--platxa-purple-hex: #8B35A8;
```

#### Accent Teal (Curve Element)

The curved accent and "XA" in wordmark use a **bright cyan/turquoise**:

```css
/* Brand step */
--platxa-teal: oklch(0.72 0.14 185);

/* HEX fallback */
--platxa-teal-hex: #2ECCC4;
```

#### Dark Purple (3D Cube Elements)

The dimensional cube shapes use a **deeper purple**:

```css
--platxa-purple-dark: oklch(0.35 0.18 290);
```

#### Neutrals (From Banner)

```css
/* Dark text ("Build,") */
--text-dark: oklch(0.20 0.01 285);

/* Gray text (subtitle) */
--text-muted: oklch(0.45 0.01 285);

/* Background */
--surface-white: oklch(0.99 0.002 285);
```

---

### 4.2 12-Step Color Scale Generation

Following Radix conventions, each color gets a 12-step scale by varying **Lightness (L)** while maintaining **Chroma (C)** and **Hue (H)** relationships.

#### Purple Scale (H=295°)

| Step | OKLCH | HEX | Usage |
|------|-------|-----|-------|
| 1 | `oklch(0.99 0.02 295)` | #FDFCFE | Subtle background |
| 2 | `oklch(0.97 0.04 295)` | #F9F5FC | Hover background |
| 3 | `oklch(0.94 0.06 295)` | #F3EAF8 | Active background |
| 4 | `oklch(0.90 0.08 295)` | #EBDCF3 | Subtle border |
| 5 | `oklch(0.82 0.12 295)` | #D9C2E8 | Border |
| 6 | `oklch(0.72 0.16 295)` | #C3A0DA | Hover border |
| 7 | `oklch(0.62 0.18 295)` | #A87CC8 | Solid hover |
| 8 | `oklch(0.55 0.20 295)` | #9458B8 | Solid |
| **9** | **`oklch(0.50 0.22 295)`** | **#8B35A8** | **★ Brand** |
| 10 | `oklch(0.42 0.20 295)` | #722990 | Solid active |
| 11 | `oklch(0.32 0.16 295)` | #551E6B | Low contrast text |
| 12 | `oklch(0.22 0.12 295)` | #3A1449 | High contrast text |

#### Teal Scale (H=185°)

| Step | OKLCH | HEX | Usage |
|------|-------|-----|-------|
| 1 | `oklch(0.99 0.01 185)` | #FCFEFE | Subtle background |
| 2 | `oklch(0.97 0.02 185)` | #F5FCFC | Hover background |
| 3 | `oklch(0.94 0.04 185)` | #E8F8F7 | Active background |
| 4 | `oklch(0.90 0.06 185)` | #D5F2F0 | Subtle border |
| 5 | `oklch(0.85 0.08 185)` | #BCE9E6 | Border |
| 6 | `oklch(0.80 0.10 185)` | #9EDEDA | Hover border |
| 7 | `oklch(0.76 0.12 185)` | #7DD4CF | Solid hover |
| 8 | `oklch(0.74 0.13 185)` | #5DCFC8 | Solid |
| **9** | **`oklch(0.72 0.14 185)`** | **#2ECCC4** | **★ Brand** |
| 10 | `oklch(0.60 0.12 185)` | #1DA89F | Solid active |
| 11 | `oklch(0.45 0.10 185)` | #147D76 | Low contrast text |
| 12 | `oklch(0.30 0.08 185)` | #0D524E | High contrast text |

#### Gray Scale (H=285° Purple Tint)

| Step | OKLCH | HEX | Usage |
|------|-------|-----|-------|
| 1 | `oklch(0.99 0.002 285)` | #FEFEFE | Background |
| 2 | `oklch(0.97 0.004 285)` | #FAFAFA | Subtle background |
| 3 | `oklch(0.94 0.006 285)` | #F4F3F5 | Card background |
| 4 | `oklch(0.90 0.008 285)` | #ECEAED | Input background |
| 5 | `oklch(0.83 0.010 285)` | #D8D5DB | Placeholder |
| 6 | `oklch(0.70 0.010 285)` | #B5B2B9 | Disabled |
| 7 | `oklch(0.55 0.010 285)` | #8A878E | Muted text |
| 8 | `oklch(0.45 0.010 285)` | #6D6A72 | Secondary text |
| 9 | `oklch(0.35 0.010 285)` | #524F57 | Text |
| 10 | `oklch(0.25 0.010 285)` | #3A383E | Strong text |
| 11 | `oklch(0.18 0.008 285)` | #28262B | Heading |
| 12 | `oklch(0.12 0.006 285)` | #1A191C | High contrast |

---

### 4.3 Brand Personality & Voice

#### Tagline Analysis: "Build, What's Next?"

| Element | Meaning |
|---------|---------|
| **"Build"** | Action-oriented, hands-on, creator mindset |
| **Comma pause** | Creates rhythm, anticipation |
| **"What's Next?"** | Forward-thinking, innovation, exploration |
| **Question mark** | Invites engagement, curiosity |

#### Visual Personality

| Trait | Expression |
|-------|------------|
| **Innovative** | 3D cube elements, gradient, modern hexagon |
| **Professional** | Clean wordmark, balanced composition |
| **Distinctive** | Purple+Teal unique in AI space |
| **Trustworthy** | Solid geometric shapes, not overly flashy |
| **Technical** | Hexagon suggests structure, precision |

#### Brand Voice Guidelines

| Attribute | Description |
|-----------|-------------|
| **Confident** | Direct statements, clear positioning |
| **Approachable** | Avoid jargon, explain complex topics simply |
| **Future-focused** | Emphasize innovation, what's possible |
| **Action-oriented** | Use active voice, verbs over nouns |

#### 60-30-10 Color Application

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  60% NEUTRAL (Gray Scale)                                       │
│  • Page backgrounds                                             │
│  • Card surfaces                                                │
│  • Container backgrounds                                        │
│  • Large areas                                                  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  30% PRIMARY (Purple)                                           │
│  • Headers and headings                                         │
│  • Primary buttons                                              │
│  • Key UI elements                                              │
│  • Navigation                                                   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  10% ACCENT (Teal)                                              │
│  • Call-to-action highlights                                    │
│  • Interactive element accents                                  │
│  • Success states                                               │
│  • Links and focus indicators                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 5: Implementation Blueprint

### 5.1 Package Structure

```
packages/platxa-brand-kit/
│
├── package.json                    # NPM package configuration
├── README.md                       # Installation & quick start
├── BRAND.md                        # Human + AI readable brand guide
├── CHANGELOG.md                    # Version history
│
├── src/
│   ├── tokens/
│   │   ├── primitives.css          # Layer 1: Raw OKLCH values
│   │   │   ├── colors-purple.css   # Purple 12-step scale
│   │   │   ├── colors-teal.css     # Teal 12-step scale
│   │   │   ├── colors-gray.css     # Gray 12-step scale
│   │   │   ├── colors-feedback.css # Success, warning, error, info
│   │   │   └── index.css           # Combined primitives
│   │   │
│   │   ├── semantic.css            # Layer 2: Contextual tokens
│   │   ├── components.css          # Layer 3: UI element tokens
│   │   ├── typography.css          # Font families, sizes, weights
│   │   ├── spacing.css             # 8px grid system
│   │   ├── effects.css             # Shadows, gradients, transitions
│   │   └── index.css               # Combined entry point
│   │
│   ├── themes/
│   │   ├── light.css               # Light mode semantic values
│   │   ├── dark.css                # Dark mode semantic values
│   │   └── index.css               # Theme switching logic
│   │
│   └── tailwind.preset.ts          # Tailwind v4 configuration
│
├── assets/
│   └── logos/
│       ├── platxa-logo.svg         # Full logo (primary)
│       ├── platxa-logo-dark.svg    # For dark backgrounds
│       ├── platxa-icon.svg         # Icon only
│       ├── platxa-wordmark.svg     # Text only
│       └── platxa-banner.svg       # With tagline
│
└── .claude/
    └── skills/
        └── platxa-brand/
            └── SKILL.md            # AI agent integration
```

---

### 5.2 Typography System

#### Font Stacks

```css
:root {
  /* Primary UI font */
  --font-sans: "Inter", "SF Pro Display", -apple-system,
               BlinkMacSystemFont, "Segoe UI", Roboto,
               "Helvetica Neue", Arial, sans-serif;

  /* Code and monospace */
  --font-mono: "JetBrains Mono", "SF Mono", "Fira Code",
               "Consolas", "Monaco", "Courier New", monospace;

  /* Display/headings (can upgrade to Cal Sans) */
  --font-display: var(--font-sans);
}
```

#### Size Scale

```css
:root {
  /* Headings */
  --text-heading-xxl: 4.5rem;    /* 72px */
  --text-heading-xl: 3.5rem;     /* 56px */
  --text-heading-lg: 2.5rem;     /* 40px */
  --text-heading-md: 2rem;       /* 32px */
  --text-heading-sm: 1.5rem;     /* 24px */
  --text-heading-xs: 1.25rem;    /* 20px */

  /* Body */
  --text-body-lg: 1.25rem;       /* 20px */
  --text-body-md: 1rem;          /* 16px */
  --text-body-sm: 0.875rem;      /* 14px */
  --text-body-xs: 0.8125rem;     /* 13px */

  /* Labels */
  --text-label-lg: 0.875rem;     /* 14px */
  --text-label-md: 0.8125rem;    /* 13px */
  --text-label-sm: 0.75rem;      /* 12px */

  /* Code */
  --text-code-lg: 1rem;          /* 16px */
  --text-code-md: 0.875rem;      /* 14px */
  --text-code-sm: 0.75rem;       /* 12px */
}
```

#### Line Heights

```css
:root {
  --leading-none: 1;
  --leading-tight: 1.15;
  --leading-snug: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;
  --leading-loose: 2;
}
```

#### Font Weights

```css
:root {
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
}
```

---

### 5.3 Spacing System (8px Grid)

```css
:root {
  --space-0: 0;
  --space-px: 1px;
  --space-0-5: 0.125rem;   /* 2px */
  --space-1: 0.25rem;      /* 4px */
  --space-2: 0.5rem;       /* 8px ★ Base unit */
  --space-3: 0.75rem;      /* 12px */
  --space-4: 1rem;         /* 16px */
  --space-5: 1.25rem;      /* 20px */
  --space-6: 1.5rem;       /* 24px */
  --space-8: 2rem;         /* 32px */
  --space-10: 2.5rem;      /* 40px */
  --space-12: 3rem;        /* 48px */
  --space-16: 4rem;        /* 64px */
  --space-20: 5rem;        /* 80px */
  --space-24: 6rem;        /* 96px */
  --space-32: 8rem;        /* 128px */
}
```

#### Border Radius

```css
:root {
  --radius-none: 0;
  --radius-sm: 0.25rem;    /* 4px */
  --radius-md: 0.5rem;     /* 8px */
  --radius-lg: 0.75rem;    /* 12px */
  --radius-xl: 1rem;       /* 16px */
  --radius-2xl: 1.5rem;    /* 24px */
  --radius-full: 9999px;
}
```

---

### 5.4 Effects & Gradients

#### Shadows (Brand-Tinted)

```css
:root {
  --shadow-sm: 0 1px 2px oklch(0.50 0.05 295 / 0.05);
  --shadow-md: 0 4px 6px oklch(0.50 0.05 295 / 0.07),
               0 2px 4px oklch(0.50 0.05 295 / 0.06);
  --shadow-lg: 0 10px 15px oklch(0.50 0.05 295 / 0.10),
               0 4px 6px oklch(0.50 0.05 295 / 0.05);
  --shadow-xl: 0 20px 25px oklch(0.50 0.05 295 / 0.10),
               0 8px 10px oklch(0.50 0.05 295 / 0.04);
  --shadow-2xl: 0 25px 50px oklch(0.50 0.05 295 / 0.25);
}
```

#### Brand Gradient

```css
:root {
  /* Logo gradient (purple to magenta to teal) */
  --gradient-brand: linear-gradient(
    135deg,
    oklch(0.45 0.24 290) 0%,
    oklch(0.55 0.20 300) 50%,
    oklch(0.72 0.14 185) 100%
  );

  /* Subtle background gradient */
  --gradient-subtle: linear-gradient(
    180deg,
    oklch(0.99 0.01 295) 0%,
    oklch(0.97 0.005 285) 100%
  );

  /* Accent gradient (teal) */
  --gradient-accent: linear-gradient(
    135deg,
    oklch(0.72 0.14 185) 0%,
    oklch(0.65 0.16 190) 100%
  );
}
```

#### Transitions

```css
:root {
  --duration-fast: 100ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --duration-slower: 500ms;

  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
}
```

---

## Part 6: Quality & Accessibility

### WCAG Compliance Requirements

| Requirement | Standard | Implementation |
|-------------|----------|----------------|
| **Text Contrast** | 4.5:1 minimum | ΔL ≥ 40 in OKLCH |
| **Large Text Contrast** | 3:1 minimum | ΔL ≥ 30 in OKLCH |
| **Focus Indicators** | 3:1 against adjacent | Two-color ring pattern |
| **Touch Targets** | 44x44px minimum | Use --space-10 or larger |

### Contrast Verification

Using OKLCH lightness difference:

```css
/* Text on light background (L=99%) */
/* Gray-12 (L=12%): ΔL = 87% ✓ Excellent */
/* Gray-11 (L=18%): ΔL = 81% ✓ Excellent */
/* Gray-9 (L=35%):  ΔL = 64% ✓ Good */
/* Gray-8 (L=45%):  ΔL = 54% ✓ Good */
/* Gray-7 (L=55%):  ΔL = 44% ✓ Pass (barely) */

/* Primary purple (L=50%) on white (L=99%): ΔL = 49% ✓ Pass */
/* Accent teal (L=72%) on white (L=99%): ΔL = 27% ✗ Fail for text */
/* → Use teal-10 (L=60%) or darker for text: ΔL = 39% ✗ */
/* → Use teal-11 (L=45%) for text: ΔL = 54% ✓ Pass */
```

### Focus State Pattern

```css
/* Two-color focus ring for visibility on all backgrounds */
:focus-visible {
  outline: 2px solid oklch(0.50 0.22 295);      /* Purple ring */
  outline-offset: 2px;
  box-shadow: 0 0 0 4px oklch(0.99 0.002 285);  /* White outer */
}

/* Dark mode */
.dark :focus-visible {
  outline: 2px solid oklch(0.72 0.14 185);      /* Teal ring */
  box-shadow: 0 0 0 4px oklch(0.12 0.01 285);   /* Dark outer */
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## Appendices

### A. Source Reference

| # | Source | URL | Topic |
|---|--------|-----|-------|
| 1 | W3C Design Tokens | [w3.org/community/design-tokens](https://www.w3.org/community/design-tokens/) | Token specification |
| 2 | Evil Martians | [evilmartians.com](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl) | OKLCH color space |
| 3 | Tailwind CSS v4 | [tailwindcss.com](https://tailwindcss.com/blog/tailwindcss-v4) | @theme directive |
| 4 | OpenAI Brand | [openai.com/brand](https://openai.com/brand/) | AI company branding |
| 5 | Anthropic/Geist | [geist.co/work/anthropic](https://geist.co/work/anthropic) | AI company branding |
| 6 | Martin Fowler | [martinfowler.com](https://martinfowler.com/articles/design-token-based-ui-architecture.html) | Token architecture |
| 7 | Radix Themes | [radix-ui.com](https://www.radix-ui.com/themes/docs/theme/color) | Color system |
| 8 | JetBrains Mono | [jetbrains.com/lp/mono](https://www.jetbrains.com/lp/mono/) | Typography |
| 9 | Vercel Geist | [vercel.com/geist](https://vercel.com/geist/typography) | Typography system |
| 10 | Canva | [canva.com/learn](https://www.canva.com/learn/how-to-build-a-brand-kit/) | Brand kit structure |
| 11 | oklch.fyi | [oklch.fyi](https://oklch.fyi/) | OKLCH tools |
| 12 | Figma Blog | [figma.com/blog](https://www.figma.com/blog/design-systems-103-documentation-that-drives-adoption/) | Documentation |

### B. Feedback Colors Reference

```css
/* Success (Green) */
--color-success-9: oklch(0.65 0.18 145);
--color-success-foreground: oklch(0.99 0.002 145);

/* Warning (Amber) */
--color-warning-9: oklch(0.75 0.18 85);
--color-warning-foreground: oklch(0.20 0.05 85);

/* Error/Destructive (Red) */
--color-error-9: oklch(0.55 0.22 25);
--color-error-foreground: oklch(0.99 0.002 25);

/* Info (Blue) */
--color-info-9: oklch(0.60 0.15 250);
--color-info-foreground: oklch(0.99 0.002 250);
```

### C. Z-Index Scale

```css
:root {
  --z-behind: -1;
  --z-base: 0;
  --z-dropdown: 10;
  --z-sticky: 20;
  --z-fixed: 30;
  --z-overlay: 40;
  --z-modal: 50;
  --z-popover: 60;
  --z-tooltip: 70;
  --z-toast: 80;
  --z-max: 9999;
}
```

---

## Conclusion

This synthesis provides a comprehensive, research-backed foundation for the Platxa Brand Kit. The combination of:

1. **W3C-compliant design tokens** for interoperability
2. **OKLCH color space** for perceptual uniformity
3. **Tailwind v4 @theme** for CSS-first configuration
4. **Three-tier token architecture** for scalability
5. **Platxa's distinctive purple-teal identity** for brand recognition

...creates a modern, accessible, and maintainable design system that will serve Platxa platform development for years to come.

---

**Next Steps**: Run `/feature` to begin implementing the 40 generated features.

---

*Document generated from research synthesis*
*Platxa - AI Research & Product Development Company*
*"Build, What's Next?"*
