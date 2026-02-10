# AI Website Generator Design Research Report
## Comprehensive Analysis for Building Premium Odoo Website Themes

*Research Date: February 2026*

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Lovable.dev Analysis](#lovabledev-analysis)
3. [Competitor Analysis](#competitor-analysis)
4. [Web Design Trends 2025-2026](#web-design-trends-2025-2026)
5. [Premium Website Characteristics](#premium-website-characteristics)
6. [Technical Implementation Guide](#technical-implementation-guide)
7. [Component Design Patterns](#component-design-patterns)
8. [Code Examples & Templates](#code-examples--templates)
9. [Recommendations for Odoo Theme Generator](#recommendations-for-odoo-theme-generator)

---

## Executive Summary

### Key Findings

1. **Design Convergence**: All major AI website builders (Lovable.dev, v0.dev, Bolt.new, Framer) converge on a React + Tailwind CSS + shadcn/ui stack with CSS variables for theming.

2. **2026 Differentiator**: The key to standing out in 2026 is moving beyond "AI-generated sameness" through:
   - Video backgrounds and shader/interactive elements
   - Constrained layouts with generous whitespace (not edge-to-edge)
   - Custom typography choices (avoid Inter/Roboto defaults)
   - Subtle glassmorphism and layered shadows

3. **Technical Excellence**: Premium websites share common technical traits:
   - LCP under 2.5 seconds
   - Mobile-first responsive design
   - WCAG 4.5:1 contrast compliance
   - CSS variables for consistent theming

---

## Lovable.dev Analysis

### Design System Architecture

Lovable.dev uses a structured design system approach with the following folder organization:

```
.lovable/
  system.md              # Core instructions (max 500 lines)
  rules/
    components/          # button.md, input.md, modal.md, etc.
    patterns/            # forms.md, navigation.md
    styling/
      colors.md          # Color token documentation
      typography.md      # Font specifications
```

### Key Design Principles from Lovable

1. **Component-First Architecture**: All UI elements are React components with documented usage patterns
2. **Token-Based Styling**: Colors, spacing, and typography defined as design tokens
3. **Tailwind Configuration**: Global variables stored in `tailwind.config.ts`
4. **CSS Variables**: Theme tokens imported via `index.css` or `App.tsx`

### What Makes Lovable Outputs Look Premium

- **Consistent Design Language**: Single source of truth for all styling decisions
- **shadcn/ui Foundation**: Leverages well-designed, accessible component primitives
- **Smart Defaults**: AI trained on high-quality design patterns
- **Responsive by Default**: All components scale properly across devices

---

## Competitor Analysis

### v0.dev by Vercel

**Stack**: React + Tailwind CSS + shadcn/ui

**Key Features**:
- Uses frontier LLM with retrieval for UI-specific patterns
- "AutoFix" streaming post-processor for code quality
- Design mode for adjusting layout, typography without re-prompting
- Custom design token mapping to `globals.css`

**Design Philosophy**:
- Mobile-friendly by default using Tailwind responsive utilities
- shadcn/ui as default component library for consistent patterns
- Atomic design concepts: tokens -> atoms -> molecules

**Strengths**:
- Cost-efficient for frontend prototypes
- Tight Next.js integration
- Real-time design adjustments

### Framer AI

**Key Features**:
- Wireframer: Generates responsive layouts from prompts
- Workshop: Custom component/animation generation
- AI Plugins: Integration with OpenAI, Anthropic, Gemini
- Auto-breakpoints for responsive design

**Design Patterns**:
- Focus on hierarchy and flow
- Template-based starting points
- Direct layout customization + AI section additions
- $100M Series D at $2B valuation (Aug 2025)

**Market Position**: 171,000+ live websites built with Framer

### Bolt.new by StackBlitz

**Stack**: Full-stack (Node.js, npm, various frameworks)

**Key Features**:
- WebContainers for in-browser development
- Claude model selection (Opus, Sonnet, Haiku)
- Full filesystem, server, and terminal control
- One-click deployment

**2026 Design Recommendations**:
- Video backgrounds in hero sections
- Shaders/interactive backgrounds to differentiate
- Constrained layouts with padding (not edge-to-edge)
- Avoid Inter/Roboto - use bold, unconventional fonts

**Glass Button CSS Example from Bolt**:
```css
.glass-button {
  background: linear-gradient(-75deg,
    rgba(194, 157, 148, 0.35),
    rgba(194, 157, 148, 0.55),
    rgba(194, 157, 148, 0.35));
  backdrop-filter: blur(clamp(1px, 0.125em, 4px));
  border-radius: 9999px;
  transition: all 400ms cubic-bezier(0.25, 1, 0.5, 1);
}

.glass-button:hover {
  transform: scale(0.975);
  backdrop-filter: blur(0.01em);
}
```

### Webflow

**Key Patterns for 2026**:
- Guided scrolling with progress indicators
- Proprietary visual effects and brand-specific animations
- Component libraries with style guides
- Interaction patterns with consistent hover states

**Template Best Practices**:
- Lightweight builds for fast loading
- Modular components that adapt
- CMS support for dynamic content
- Seamless responsive experience

---

## Web Design Trends 2025-2026

### 1. Modern CSS Features

#### Container Queries (41% adoption in 2025)
```css
.card {
  container-type: inline-size;
  container-name: card;
}

@container card (min-width: 400px) {
  .card-content {
    display: grid;
    grid-template-columns: 1fr 2fr;
  }
}
```

#### CSS Subgrid (97% browser support)
```css
.grid-parent {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.grid-child {
  display: grid;
  grid-template-columns: subgrid;
  grid-column: span 3;
}
```

#### The :has() Selector
```css
/* Style parent based on child state */
.card:has(img) {
  grid-template-rows: auto 1fr;
}

.form-field:has(input:invalid) {
  border-color: var(--destructive);
}
```

### 2. Animation Trends

#### Scroll-Driven Animations
```css
@keyframes reveal {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-on-scroll {
  animation: reveal linear;
  animation-timeline: view();
  animation-range: entry 0% entry 100%;
}
```

#### Micro-Interactions
- Button hover state changes
- Form submission feedback
- Loading indicator animations
- Toggle switch transitions
- Heart/like icon animations

**Performance Best Practices**:
- Use GPU-accelerated properties (transform, opacity)
- Avoid animating layout properties (width, height, position)
- Implement throttling/debouncing for scroll events
- Always provide `prefers-reduced-motion` alternatives

### 3. Color & Visual Trends

#### Glassmorphism (Apple "Liquid Glass" 2025)
```css
.glass-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

/* Fallback for unsupported browsers */
@supports not (backdrop-filter: blur(10px)) {
  .glass-card {
    background: rgba(255, 255, 255, 0.85);
  }
}
```

#### Neubrutalism
- Bold, high-contrast color palettes
- Sharp geometric forms
- Utilitarian layouts
- Thick borders and outlines
- Vintage/saturated colors

**Best for**: Creative agencies, fashion brands, portfolio sites
**Avoid for**: Finance, healthcare, corporate

#### Gradient Trends
```css
/* Modern multi-color gradient */
.gradient-bg {
  background: linear-gradient(
    135deg,
    oklch(0.7 0.15 250) 0%,
    oklch(0.6 0.2 300) 50%,
    oklch(0.5 0.18 330) 100%
  );
}

/* Mesh gradient effect */
.mesh-gradient {
  background:
    radial-gradient(at 40% 20%, oklch(0.8 0.12 250) 0px, transparent 50%),
    radial-gradient(at 80% 0%, oklch(0.7 0.15 300) 0px, transparent 50%),
    radial-gradient(at 0% 50%, oklch(0.6 0.1 200) 0px, transparent 50%),
    radial-gradient(at 80% 50%, oklch(0.75 0.14 280) 0px, transparent 50%),
    radial-gradient(at 0% 100%, oklch(0.65 0.18 320) 0px, transparent 50%);
}
```

### 4. Typography Trends

#### Variable Fonts
```css
@font-face {
  font-family: 'InterVariable';
  src: url('/fonts/Inter-Variable.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

body {
  font-family: 'InterVariable', system-ui, sans-serif;
  font-optical-sizing: auto;
}

/* Responsive fluid typography */
h1 {
  font-size: clamp(2rem, 5vw + 1rem, 4rem);
  font-weight: 700;
  letter-spacing: -0.02em;
}
```

#### Key Typography Trends
- **Serif Revival**: Warmth and authenticity over neutral sans-serifs
- **Art Deco**: Geometric, elongated, luxurious forms
- **3D/Inflated Fonts**: Playful, balloon-like typography
- **Condensed Brutalist**: Bold, functional, intentional
- **Kinetic Typography**: Scroll-triggered text animations

---

## Premium Website Characteristics

### What Makes a Website Look $10,000+

#### 1. Generous Whitespace
```css
.section {
  padding: clamp(4rem, 10vw, 8rem) clamp(1rem, 5vw, 4rem);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}
```

#### 2. Refined Typography
- Serif fonts: Bodoni, Didot, custom brand typefaces
- Light font weights
- Wide letter-spacing
- Strong type hierarchy

#### 3. Restrained Color Palette
- Black, white, gold, deep navy
- Neutral tones: summer/fall-inspired
- Color restraint signals confidence
- Maximum 3-4 colors per palette

#### 4. Layered Shadows for Depth
```css
.premium-card {
  /* Contact shadow - anchors to surface */
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.07),
    0 2px 4px rgba(0, 0, 0, 0.07),
    /* Ambient shadow - soft halo */
    0 4px 8px rgba(0, 0, 0, 0.07),
    0 8px 16px rgba(0, 0, 0, 0.07),
    0 16px 32px rgba(0, 0, 0, 0.07);
}

/* Elevation levels */
.elevation-1 { box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24); }
.elevation-2 { box-shadow: 0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23); }
.elevation-3 { box-shadow: 0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23); }
.elevation-4 { box-shadow: 0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22); }
.elevation-5 { box-shadow: 0 19px 38px rgba(0,0,0,0.30), 0 15px 12px rgba(0,0,0,0.22); }
```

#### 5. High-Quality Imagery
- Professional, high-resolution photography
- Oversized hero images
- Asymmetrical compositions
- One focal point per screen

#### 6. Smooth Animations
- Subtle parallax effects
- Elegant page transitions
- Refined hover states
- Cinematic reveals

---

## Component Design Patterns

### Hero Section Best Practices

#### Essential Components
1. **Headline**: Business promise in 5-10 words
2. **Subheading**: Supporting detail (1-2 lines)
3. **Hero Visual**: Image, video, or animation
4. **Single CTA**: Clear next step

#### Recommended Sizes
- Desktop: 1920 x 1080px
- Mobile: 800 x 1200px
- Image format: WebP, compressed under 500KB

#### Hero Section Pattern
```html
<section class="hero">
  <div class="hero-content">
    <h1 class="hero-headline">Financial infrastructure for the internet</h1>
    <p class="hero-subtext">Millions of companies use Stripe to accept payments</p>
    <div class="hero-cta">
      <button class="btn-primary">Start now</button>
      <button class="btn-secondary">Contact sales</button>
    </div>
  </div>
  <div class="hero-visual">
    <!-- Animated product UI or video -->
  </div>
</section>
```

```css
.hero {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: 4rem;
  padding: 2rem clamp(1rem, 5vw, 4rem);
}

.hero-headline {
  font-size: clamp(2.5rem, 5vw + 1rem, 4.5rem);
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.02em;
}

.hero-subtext {
  font-size: clamp(1.125rem, 2vw, 1.5rem);
  color: var(--muted-foreground);
  max-width: 50ch;
  margin-top: 1.5rem;
}

.hero-cta {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

@media (max-width: 768px) {
  .hero {
    grid-template-columns: 1fr;
    text-align: center;
  }

  .hero-cta {
    flex-direction: column;
  }
}
```

### Card Design Patterns

#### Card Anatomy
```html
<div class="card">
  <div class="card-header">
    <img src="thumbnail.jpg" alt="" class="card-image" />
  </div>
  <div class="card-body">
    <span class="card-badge">Featured</span>
    <h3 class="card-title">Card Title</h3>
    <p class="card-description">Brief description text</p>
  </div>
  <div class="card-footer">
    <button class="card-action">Learn more</button>
  </div>
</div>
```

```css
.card {
  --card-padding: 1.5rem;
  --card-radius: 1rem;

  display: flex;
  flex-direction: column;
  background: var(--card);
  border-radius: var(--card-radius);
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -2px rgba(0, 0, 0, 0.1);
}

.card-image {
  width: 100%;
  aspect-ratio: 16/9;
  object-fit: cover;
}

.card-body {
  padding: var(--card-padding);
  flex: 1;
}

.card-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.card-description {
  color: var(--muted-foreground);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-footer {
  padding: 0 var(--card-padding) var(--card-padding);
}
```

### CTA Section Patterns

#### High-Converting CTA Structure
```html
<section class="cta-section">
  <div class="cta-content">
    <h2 class="cta-headline">Ready to get started?</h2>
    <p class="cta-subtext">Join thousands of companies already using our platform</p>
    <div class="cta-actions">
      <button class="btn-primary btn-lg">Start free trial</button>
      <span class="cta-note">No credit card required</span>
    </div>
  </div>
</section>
```

```css
.cta-section {
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  padding: clamp(4rem, 10vw, 8rem) clamp(1rem, 5vw, 4rem);
  text-align: center;
  color: var(--primary-foreground);
}

.cta-headline {
  font-size: clamp(2rem, 4vw + 1rem, 3.5rem);
  font-weight: 700;
  margin-bottom: 1rem;
}

.cta-subtext {
  font-size: 1.25rem;
  opacity: 0.9;
  max-width: 50ch;
  margin: 0 auto 2rem;
}

.btn-lg {
  padding: 1rem 2rem;
  font-size: 1.125rem;
}

.cta-note {
  display: block;
  margin-top: 1rem;
  font-size: 0.875rem;
  opacity: 0.8;
}
```

### Footer Design Patterns

#### Types of Footers

1. **Utility-Only**: Minimal with legal links (landing pages)
2. **Marketing CTA**: Newsletter signup or demo CTA
3. **Secondary-Task Hub**: Careers, Press, Investors links

#### Modern Footer Structure
```html
<footer class="footer">
  <div class="footer-cta">
    <h3>Stay in the loop</h3>
    <form class="newsletter-form">
      <input type="email" placeholder="Enter your email" />
      <button type="submit">Subscribe</button>
    </form>
  </div>

  <div class="footer-nav">
    <div class="footer-column">
      <h4>Product</h4>
      <ul>
        <li><a href="#">Features</a></li>
        <li><a href="#">Pricing</a></li>
        <li><a href="#">Security</a></li>
      </ul>
    </div>
    <!-- More columns -->
  </div>

  <div class="footer-bottom">
    <p>2026 Company Name. All rights reserved.</p>
    <div class="footer-legal">
      <a href="#">Privacy</a>
      <a href="#">Terms</a>
    </div>
    <div class="footer-social">
      <!-- Social icons -->
    </div>
  </div>
</footer>
```

---

## Technical Implementation Guide

### shadcn/ui CSS Variables Structure

```css
@layer base {
  :root {
    /* Background colors */
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;

    /* Card surfaces */
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;

    /* Popover surfaces */
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;

    /* Primary brand color */
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;

    /* Secondary color */
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;

    /* Muted/subtle elements */
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;

    /* Accent highlights */
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;

    /* Destructive/error states */
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;

    /* Border and input colors */
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;

    /* Border radius */
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;

    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;

    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;

    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;

    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;

    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;

    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;

    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;

    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}
```

### OKLCH Color Format (Modern Standard)

```css
:root {
  /* Modern OKLCH format for vibrant colors */
  --primary: oklch(0.21 0.03 265);
  --primary-foreground: oklch(0.98 0.01 265);

  --accent: oklch(0.84 0.16 84);
  --accent-foreground: oklch(0.28 0.07 46);

  /* Gradient-friendly colors */
  --gradient-start: oklch(0.7 0.15 250);
  --gradient-end: oklch(0.6 0.2 300);
}

/* Using in gradients */
.gradient-bg {
  background: linear-gradient(
    135deg,
    var(--gradient-start),
    var(--gradient-end)
  );
}
```

### Mobile-First Responsive Pattern

```css
/* Base styles (mobile) */
.container {
  width: 100%;
  padding: 0 1rem;
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

/* Tablet and up */
@media (min-width: 768px) {
  .container {
    padding: 0 2rem;
  }

  .grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 2rem;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 4rem;
  }

  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* Large desktop */
@media (min-width: 1440px) {
  .container {
    max-width: 1400px;
  }
}
```

### Common Breakpoints

| Name | Min-width | Target |
|------|-----------|--------|
| sm | 640px | Large phones |
| md | 768px | Tablets |
| lg | 1024px | Small laptops |
| xl | 1280px | Desktops |
| 2xl | 1536px | Large monitors |

---

## Recommendations for Odoo Theme Generator

### 1. Design System Architecture

Create a token-based system similar to Lovable.dev:

```
odoo_theme/
  static/src/
    scss/
      tokens/
        _colors.scss       # Color variables
        _typography.scss   # Font definitions
        _spacing.scss      # Spacing scale
        _shadows.scss      # Shadow presets
        _radius.scss       # Border radius
      components/
        _buttons.scss
        _cards.scss
        _forms.scss
        _navigation.scss
      sections/
        _hero.scss
        _features.scss
        _testimonials.scss
        _cta.scss
        _footer.scss
      main.scss            # Imports all partials
```

### 2. Color Token System

```scss
// tokens/_colors.scss
:root {
  // Semantic colors
  --color-background: hsl(0 0% 100%);
  --color-foreground: hsl(222.2 84% 4.9%);
  --color-primary: hsl(222.2 47.4% 11.2%);
  --color-primary-foreground: hsl(210 40% 98%);
  --color-secondary: hsl(210 40% 96.1%);
  --color-muted: hsl(210 40% 96.1%);
  --color-muted-foreground: hsl(215.4 16.3% 46.9%);
  --color-accent: hsl(210 40% 96.1%);
  --color-destructive: hsl(0 84.2% 60.2%);
  --color-border: hsl(214.3 31.8% 91.4%);

  // Brand colors (customizable per theme)
  --color-brand-50: hsl(214 100% 97%);
  --color-brand-100: hsl(214 95% 93%);
  --color-brand-200: hsl(213 97% 87%);
  --color-brand-300: hsl(212 96% 78%);
  --color-brand-400: hsl(213 94% 68%);
  --color-brand-500: hsl(217 91% 60%);
  --color-brand-600: hsl(221 83% 53%);
  --color-brand-700: hsl(224 76% 48%);
  --color-brand-800: hsl(226 71% 40%);
  --color-brand-900: hsl(224 64% 33%);
}

.dark {
  --color-background: hsl(222.2 84% 4.9%);
  --color-foreground: hsl(210 40% 98%);
  // ... dark mode overrides
}
```

### 3. Premium Component Presets

#### Buttons
```scss
// components/_buttons.scss
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25rem;
  border-radius: var(--radius);
  transition: all 0.2s ease;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--color-ring);
    outline-offset: 2px;
  }
}

.btn-primary {
  background: var(--color-primary);
  color: var(--color-primary-foreground);

  &:hover {
    background: hsl(from var(--color-primary) h s calc(l - 5%));
  }
}

.btn-secondary {
  background: var(--color-secondary);
  color: var(--color-secondary-foreground);

  &:hover {
    background: hsl(from var(--color-secondary) h s calc(l - 5%));
  }
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-foreground);

  &:hover {
    background: var(--color-accent);
  }
}

.btn-ghost {
  background: transparent;
  color: var(--color-foreground);

  &:hover {
    background: var(--color-accent);
  }
}

// Sizes
.btn-sm { padding: 0.375rem 0.75rem; font-size: 0.75rem; }
.btn-lg { padding: 0.75rem 1.5rem; font-size: 1rem; }
.btn-xl { padding: 1rem 2rem; font-size: 1.125rem; }
```

#### Cards
```scss
// components/_cards.scss
.card {
  background: var(--color-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.card-elevated {
  border: none;
  box-shadow:
    0 1px 3px 0 rgb(0 0 0 / 0.1),
    0 1px 2px -1px rgb(0 0 0 / 0.1);

  &:hover {
    transform: translateY(-2px);
    box-shadow:
      0 10px 15px -3px rgb(0 0 0 / 0.1),
      0 4px 6px -4px rgb(0 0 0 / 0.1);
  }
}

.card-glass {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.card-header {
  padding: 1.5rem 1.5rem 0;
}

.card-body {
  padding: 1.5rem;
}

.card-footer {
  padding: 0 1.5rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
```

### 4. Section Templates

#### Hero Variants
```scss
// sections/_hero.scss

// Centered hero
.hero-centered {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 4rem 1rem;

  .hero-content {
    max-width: 800px;
  }
}

// Split hero
.hero-split {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1fr;

  @media (min-width: 1024px) {
    grid-template-columns: 1fr 1fr;
  }

  .hero-content {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 4rem clamp(1rem, 5vw, 4rem);
  }

  .hero-visual {
    position: relative;
    min-height: 400px;

    img, video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
}

// Video background hero
.hero-video {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;

  .hero-video-bg {
    position: absolute;
    inset: 0;

    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
    }
  }

  .hero-content {
    position: relative;
    z-index: 1;
    color: white;
    text-align: center;
    max-width: 800px;
    padding: 2rem;
  }
}
```

### 5. Animation Utilities

```scss
// utilities/_animations.scss

// Fade animations
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// Scale animations
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

// Utility classes
.animate-fade-in {
  animation: fadeIn 0.5s ease forwards;
}

.animate-fade-in-up {
  animation: fadeInUp 0.5s ease forwards;
}

.animate-fade-in-down {
  animation: fadeInDown 0.5s ease forwards;
}

.animate-scale-in {
  animation: scaleIn 0.3s ease forwards;
}

// Animation delays
@for $i from 1 through 10 {
  .delay-#{$i * 100} {
    animation-delay: #{$i * 100}ms;
  }
}

// Reduced motion
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

### 6. Theme Presets

Create multiple premium theme presets:

```scss
// themes/_modern.scss (Default)
:root {
  --radius: 0.5rem;
  --radius-sm: 0.25rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-full: 9999px;
}

// themes/_sharp.scss (Neubrutalism-inspired)
:root {
  --radius: 0;
  --radius-sm: 0;
  --radius-lg: 0;
  --color-border: hsl(0 0% 0%);
  --shadow-card: 4px 4px 0 0 hsl(0 0% 0%);
}

// themes/_soft.scss (Neumorphism-inspired)
:root {
  --radius: 1rem;
  --radius-lg: 1.5rem;
  --shadow-card:
    8px 8px 16px hsl(0 0% 85%),
    -8px -8px 16px hsl(0 0% 100%);
}

// themes/_glass.scss (Glassmorphism)
:root {
  --card-background: rgba(255, 255, 255, 0.1);
  --card-backdrop: blur(16px) saturate(180%);
  --card-border: 1px solid rgba(255, 255, 255, 0.2);
}
```

### 7. Performance Checklist

- [ ] LCP under 2.5 seconds
- [ ] Images in WebP format with fallbacks
- [ ] Lazy loading for below-fold images
- [ ] Variable fonts for typography flexibility
- [ ] CSS minification in production
- [ ] Critical CSS inlined
- [ ] prefers-reduced-motion support
- [ ] Dark mode with system preference detection

### 8. Accessibility Checklist

- [ ] WCAG 4.5:1 contrast ratio for text
- [ ] WCAG 3:1 contrast for UI components
- [ ] Focus visible states on all interactive elements
- [ ] Keyboard navigation support
- [ ] Screen reader-friendly markup
- [ ] Alt text for all images
- [ ] Proper heading hierarchy

---

## Conclusion

The key to building an AI website generator that produces Lovable.dev-quality output lies in:

1. **Strong Design System Foundation**: Token-based styling with CSS variables
2. **Premium Defaults**: Layered shadows, generous whitespace, refined typography
3. **Modern CSS Techniques**: Container queries, subgrid, scroll-driven animations
4. **Performance Focus**: Mobile-first, optimized assets, fast loading
5. **Accessibility First**: WCAG compliance built into every component
6. **Theme Flexibility**: Multiple visual styles while maintaining consistency

By implementing these patterns in your Odoo theme generator, you can produce websites that rival the output of leading AI website builders while maintaining the flexibility and power of the Odoo ecosystem.

---

## Sources

### AI Website Builders
- [Lovable.dev - Build Apps & Websites with AI](https://lovable.dev/)
- [Lovable Design Systems Documentation](https://docs.lovable.dev/features/design-systems)
- [v0.dev by Vercel](https://v0.app/)
- [Framer AI](https://www.framer.com/ai/)
- [Bolt.new - AI Web App Builder](https://bolt.new/)

### Design Trends & Techniques
- [Lovable - Website Design Trends 2026](https://lovable.dev/guides/website-design-trends-2026)
- [Bolt - Create Stunning Websites in 2026](https://bolt.new/blog/2026-create-stunning-websites-bolt)
- [Webflow - Web Design Trends 2026](https://webflow.com/blog/web-design-trends-2026)
- [Framer - Web Design Trends](https://www.framer.com/blog/web-design-trends/)

### CSS & Technical Resources
- [Modern CSS Trends 2025 - Container Queries, Subgrid](https://medium.com/@mernstackdevbykevin/modern-css-trends-2025-container-queries-subgrid-cascade-layers-real-use-cases-tips-733af70eb5fb)
- [CSS Scroll-Driven Animations - MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations)
- [Josh W. Comeau - Designing Beautiful Shadows](https://www.joshwcomeau.com/css/designing-shadows/)
- [Josh W. Comeau - Make Beautiful Gradients](https://www.joshwcomeau.com/css/make-beautiful-gradients/)
- [Josh W. Comeau - Backdrop Filter](https://www.joshwcomeau.com/css/backdrop-filter/)

### shadcn/ui & Tailwind
- [shadcn/ui Official](https://ui.shadcn.com/)
- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming)
- [Shadcn Studio](https://shadcnstudio.com/)
- [ShadcnBlocks](https://www.shadcnblocks.com/)
- [Tailwind Plus](https://tailwindcss.com/plus)

### Design Patterns
- [Hero Section Best Practices 2026](https://www.perfectafternoon.com/2025/hero-section-design/)
- [Card UI Design Examples](https://bricxlabs.com/blogs/card-ui-design-examples)
- [Footer UX Patterns](https://www.eleken.co/blog-posts/footer-ux)
- [CTA Section Examples](https://embedsocial.com/blog/ai-cta-examples/)
- [Landing Page Anatomy](https://www.growform.co/anatomy-of-a-landing-page/)

### Premium Design
- [Luxury Website Design Examples - HubSpot](https://blog.hubspot.com/website/luxury-websites)
- [Premium Websites - 99designs](https://99designs.com/inspiration/websites/premium)
- [Best Luxury Website Designs - DesignRush](https://www.designrush.com/best-designs/websites/trends/best-luxury-website-designs)

### Typography
- [Top Typography Trends 2025 - Fontfabric](https://www.fontfabric.com/blog/top-typography-trends-2025/)
- [Typography Trends 2026 - Creative Bloq](https://www.creativebloq.com/design/fonts-typography/breaking-rules-and-bringing-joy-top-typography-trends-for-2026)
- [Variable Fonts & Responsive Typography](https://fontsarena.com/blog/design-trends-2025-variable-fonts-responsive-typography-studio-workflows/)

### Colors & Visual Effects
- [Glassmorphism CSS Generator](https://ui.glass/generator/)
- [uiGradients](https://uigradients.com/)
- [WebGradients](https://webgradients.com/)
- [UI Design Trends - Glassmorphism vs Neubrutalism](https://www.cccreative.design/blogs/differences-in-ui-design-trends-neumorphism-glassmorphism-and-neubrutalism)

### Responsive Design
- [Responsive Design Best Practices 2025](https://www.adicator.com/post/responsive-design-best-practices)
- [Mobile-First CSS Design Principles](https://allthingsprogramming.com/mobile-first-css-design-principles/)
- [Complete Responsive Web Design Guide 2025](https://ui-deploy.com/blog/complete-responsive-web-design-guide-mobile-first-development-and-breakpoint-strategies-2025)
