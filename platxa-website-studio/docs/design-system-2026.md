# Production-Grade Website Design System 2026

## Executive Summary

This document provides comprehensive design patterns, CSS code examples, and design token recommendations for generating production-grade websites that look like they cost $10,000+ to design. These patterns are optimized for AI-powered generation and rapid development cycles.

---

## 1. Visual Design Excellence

### 1.1 Modern Color Palette Strategies

#### OKLCH Color Space (Perceptually Uniform)

OKLCH provides more vibrant gradients and consistent lightness perception across hues:

```css
:root {
  /* OKLCH Primary Palette - More vibrant than sRGB */
  --primary-50: oklch(97% 0.02 260);
  --primary-100: oklch(94% 0.04 260);
  --primary-200: oklch(88% 0.08 260);
  --primary-300: oklch(78% 0.12 260);
  --primary-400: oklch(68% 0.16 260);
  --primary-500: oklch(58% 0.18 260);  /* Main brand */
  --primary-600: oklch(48% 0.16 260);
  --primary-700: oklch(40% 0.14 260);
  --primary-800: oklch(32% 0.12 260);
  --primary-900: oklch(24% 0.08 260);
  --primary-950: oklch(16% 0.06 260);

  /* OKLCH enables vibrant gradients that sRGB cannot achieve */
  --gradient-vibrant: linear-gradient(
    135deg,
    oklch(65% 0.25 280) 0%,
    oklch(60% 0.28 330) 50%,
    oklch(55% 0.25 20) 100%
  );
}
```

#### CSS Custom Properties Design Tokens

```css
:root {
  /* === SEMANTIC COLOR TOKENS === */

  /* Background Layers */
  --color-bg-base: #fafafa;
  --color-bg-elevated: #ffffff;
  --color-bg-sunken: #f4f4f5;
  --color-bg-overlay: rgba(0, 0, 0, 0.5);

  /* Surface Colors (Cards, Panels) */
  --color-surface-default: #ffffff;
  --color-surface-muted: #f9fafb;
  --color-surface-emphasis: #f3f4f6;
  --color-surface-inverse: #18181b;

  /* Text Colors */
  --color-text-primary: #18181b;
  --color-text-secondary: #52525b;
  --color-text-tertiary: #a1a1aa;
  --color-text-inverse: #fafafa;
  --color-text-link: #2563eb;
  --color-text-link-hover: #1d4ed8;

  /* Border Colors */
  --color-border-default: #e4e4e7;
  --color-border-muted: #f4f4f5;
  --color-border-emphasis: #d4d4d8;
  --color-border-focus: #3b82f6;

  /* Status Colors */
  --color-success: #10b981;
  --color-success-subtle: #ecfdf5;
  --color-warning: #f59e0b;
  --color-warning-subtle: #fffbeb;
  --color-error: #ef4444;
  --color-error-subtle: #fef2f2;
  --color-info: #3b82f6;
  --color-info-subtle: #eff6ff;
}

/* Dark Mode Tokens */
.dark {
  --color-bg-base: #09090b;
  --color-bg-elevated: #18181b;
  --color-bg-sunken: #09090b;
  --color-surface-default: #18181b;
  --color-surface-muted: #27272a;
  --color-text-primary: #fafafa;
  --color-text-secondary: #a1a1aa;
  --color-border-default: #27272a;
}
```

#### Premium Gradient Library

```css
:root {
  /* Hero Gradients - Dark, Sophisticated */
  --gradient-hero-dark: linear-gradient(
    135deg,
    #0f0f1a 0%,
    #1a1a3e 50%,
    #0f0f1a 100%
  );

  --gradient-hero-midnight: linear-gradient(
    to bottom right,
    #0c0c1d 0%,
    #1a1a2e 25%,
    #16213e 50%,
    #0f0f23 100%
  );

  /* Mesh Gradient Overlays */
  --gradient-mesh-purple:
    radial-gradient(at 20% 30%, rgba(139, 92, 246, 0.3) 0%, transparent 50%),
    radial-gradient(at 80% 20%, rgba(236, 72, 153, 0.2) 0%, transparent 50%),
    radial-gradient(at 40% 80%, rgba(59, 130, 246, 0.2) 0%, transparent 50%);

  /* CTA Gradients */
  --gradient-cta-primary: linear-gradient(
    135deg,
    #667eea 0%,
    #764ba2 50%,
    #ec4899 100%
  );

  --gradient-cta-warm: linear-gradient(
    135deg,
    #f97316 0%,
    #ec4899 100%
  );

  --gradient-cta-cool: linear-gradient(
    135deg,
    #06b6d4 0%,
    #3b82f6 100%
  );

  /* Text Gradients */
  --gradient-text-primary: linear-gradient(
    135deg,
    #8b5cf6 0%,
    #ec4899 100%
  );

  --gradient-text-gold: linear-gradient(
    135deg,
    #fbbf24 0%,
    #f59e0b 50%,
    #d97706 100%
  );
}

/* Gradient Text Utility */
.gradient-text {
  background: var(--gradient-text-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### 1.2 Typography Hierarchies

#### Professional Type Scale (Fluid Typography)

```css
:root {
  /* Base font size for calculations */
  --text-base: 1rem;

  /* Fluid Type Scale using clamp() */
  --text-xs: clamp(0.75rem, 0.7rem + 0.25vw, 0.8125rem);    /* 12-13px */
  --text-sm: clamp(0.8125rem, 0.75rem + 0.3vw, 0.9375rem);  /* 13-15px */
  --text-base: clamp(1rem, 0.9rem + 0.5vw, 1.125rem);       /* 16-18px */
  --text-lg: clamp(1.125rem, 1rem + 0.6vw, 1.25rem);        /* 18-20px */
  --text-xl: clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem);       /* 20-24px */
  --text-2xl: clamp(1.5rem, 1.25rem + 1.25vw, 2rem);        /* 24-32px */
  --text-3xl: clamp(1.875rem, 1.5rem + 1.875vw, 2.5rem);    /* 30-40px */
  --text-4xl: clamp(2.25rem, 1.75rem + 2.5vw, 3rem);        /* 36-48px */
  --text-5xl: clamp(3rem, 2rem + 5vw, 4.5rem);              /* 48-72px */
  --text-6xl: clamp(3.75rem, 2.5rem + 6.25vw, 6rem);        /* 60-96px */

  /* Line Heights */
  --leading-none: 1;
  --leading-tight: 1.1;
  --leading-snug: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;
  --leading-loose: 1.8;

  /* Letter Spacing */
  --tracking-tighter: -0.05em;
  --tracking-tight: -0.025em;
  --tracking-normal: 0;
  --tracking-wide: 0.025em;
  --tracking-wider: 0.05em;
  --tracking-widest: 0.1em;

  /* Font Weights */
  --font-thin: 100;
  --font-light: 300;
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
  --font-extrabold: 800;
  --font-black: 900;
}

/* Typography Utility Classes */

/* Display - For hero headlines, make a statement */
.text-display {
  font-size: var(--text-6xl);
  font-weight: var(--font-extrabold);
  line-height: var(--leading-tight);
  letter-spacing: var(--tracking-tighter);
}

/* Headline - Page titles */
.text-headline {
  font-size: var(--text-4xl);
  font-weight: var(--font-bold);
  line-height: var(--leading-tight);
  letter-spacing: var(--tracking-tight);
}

/* Title - Section headers */
.text-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  line-height: var(--leading-snug);
  letter-spacing: var(--tracking-tight);
}

/* Subtitle - Supporting headers */
.text-subtitle {
  font-size: var(--text-xl);
  font-weight: var(--font-medium);
  line-height: var(--leading-snug);
}

/* Body - Default reading text */
.text-body {
  font-size: var(--text-base);
  font-weight: var(--font-normal);
  line-height: var(--leading-relaxed);
}

/* Body Large - Intro paragraphs */
.text-body-lg {
  font-size: var(--text-lg);
  font-weight: var(--font-normal);
  line-height: var(--leading-loose);
}

/* Caption - Small supporting text */
.text-caption {
  font-size: var(--text-sm);
  font-weight: var(--font-normal);
  line-height: var(--leading-normal);
  color: var(--color-text-secondary);
}

/* Overline - Labels, categories */
.text-overline {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  line-height: var(--leading-normal);
  letter-spacing: var(--tracking-widest);
  text-transform: uppercase;
}
```

#### Premium Font Stacks

```css
:root {
  /* Sans-serif - Modern, clean */
  --font-sans: 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont,
               'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;

  /* Serif - Elegant, editorial */
  --font-serif: 'Playfair Display', 'Merriweather', Georgia,
                'Times New Roman', serif;

  /* Display - Headlines with character */
  --font-display: 'Clash Display', 'Cabinet Grotesk', 'Satoshi',
                  var(--font-sans);

  /* Mono - Code, technical */
  --font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono',
               ui-monospace, monospace;
}

/* Font feature settings for professional typography */
body {
  font-family: var(--font-sans);
  font-feature-settings:
    "cv02",  /* Stylistic alternates */
    "cv03",
    "cv04",
    "cv11",
    "ss01";  /* Stylistic set */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
```

### 1.3 Spacing System (8px Grid)

```css
:root {
  /* === SPACING SCALE (4px base, 8px grid) === */
  --space-0: 0;
  --space-px: 1px;
  --space-0.5: 0.125rem;  /* 2px */
  --space-1: 0.25rem;     /* 4px */
  --space-1.5: 0.375rem;  /* 6px */
  --space-2: 0.5rem;      /* 8px */
  --space-2.5: 0.625rem;  /* 10px */
  --space-3: 0.75rem;     /* 12px */
  --space-3.5: 0.875rem;  /* 14px */
  --space-4: 1rem;        /* 16px */
  --space-5: 1.25rem;     /* 20px */
  --space-6: 1.5rem;      /* 24px */
  --space-7: 1.75rem;     /* 28px */
  --space-8: 2rem;        /* 32px */
  --space-9: 2.25rem;     /* 36px */
  --space-10: 2.5rem;     /* 40px */
  --space-11: 2.75rem;    /* 44px */
  --space-12: 3rem;       /* 48px */
  --space-14: 3.5rem;     /* 56px */
  --space-16: 4rem;       /* 64px */
  --space-20: 5rem;       /* 80px */
  --space-24: 6rem;       /* 96px */
  --space-28: 7rem;       /* 112px */
  --space-32: 8rem;       /* 128px */
  --space-36: 9rem;       /* 144px */
  --space-40: 10rem;      /* 160px */
  --space-44: 11rem;      /* 176px */
  --space-48: 12rem;      /* 192px */
  --space-52: 13rem;      /* 208px */
  --space-56: 14rem;      /* 224px */
  --space-60: 15rem;      /* 240px */
  --space-64: 16rem;      /* 256px */
  --space-72: 18rem;      /* 288px */
  --space-80: 20rem;      /* 320px */
  --space-96: 24rem;      /* 384px */

  /* === SEMANTIC SPACING === */

  /* Component Internal Spacing */
  --spacing-button-x: var(--space-5);
  --spacing-button-y: var(--space-3);
  --spacing-input-x: var(--space-4);
  --spacing-input-y: var(--space-3);
  --spacing-card: var(--space-6);

  /* Section Spacing */
  --spacing-section-sm: var(--space-16);
  --spacing-section-md: var(--space-24);
  --spacing-section-lg: var(--space-32);
  --spacing-section-xl: var(--space-40);

  /* Container Max Widths */
  --container-xs: 20rem;   /* 320px */
  --container-sm: 24rem;   /* 384px */
  --container-md: 28rem;   /* 448px */
  --container-lg: 32rem;   /* 512px */
  --container-xl: 36rem;   /* 576px */
  --container-2xl: 42rem;  /* 672px */
  --container-3xl: 48rem;  /* 768px */
  --container-4xl: 56rem;  /* 896px */
  --container-5xl: 64rem;  /* 1024px */
  --container-6xl: 72rem;  /* 1152px */
  --container-7xl: 80rem;  /* 1280px */
}
```

### 1.4 Shadow and Elevation System

```css
:root {
  /* === PREMIUM LAYERED SHADOWS === */

  /* Minimal - Subtle lift */
  --shadow-xs:
    0 1px 2px 0 rgb(0 0 0 / 0.05);

  /* Small - Cards, buttons */
  --shadow-sm:
    0 1px 3px 0 rgb(0 0 0 / 0.1),
    0 1px 2px -1px rgb(0 0 0 / 0.1);

  /* Medium - Elevated cards */
  --shadow-md:
    0 4px 6px -1px rgb(0 0 0 / 0.1),
    0 2px 4px -2px rgb(0 0 0 / 0.1);

  /* Large - Dropdowns, popovers */
  --shadow-lg:
    0 10px 15px -3px rgb(0 0 0 / 0.1),
    0 4px 6px -4px rgb(0 0 0 / 0.1);

  /* Extra Large - Modals */
  --shadow-xl:
    0 20px 25px -5px rgb(0 0 0 / 0.1),
    0 8px 10px -6px rgb(0 0 0 / 0.1);

  /* 2XL - Hero images, feature cards */
  --shadow-2xl:
    0 25px 50px -12px rgb(0 0 0 / 0.25);

  /* === PREMIUM MULTI-LAYER SHADOWS (Dribbble-worthy) === */

  --shadow-premium-sm:
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 2px 4px rgba(0, 0, 0, 0.04),
    0 4px 8px rgba(0, 0, 0, 0.04);

  --shadow-premium-md:
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 2px 4px rgba(0, 0, 0, 0.04),
    0 4px 8px rgba(0, 0, 0, 0.04),
    0 8px 16px rgba(0, 0, 0, 0.04);

  --shadow-premium-lg:
    0 1px 2px rgba(0, 0, 0, 0.07),
    0 2px 4px rgba(0, 0, 0, 0.07),
    0 4px 8px rgba(0, 0, 0, 0.07),
    0 8px 16px rgba(0, 0, 0, 0.07),
    0 16px 32px rgba(0, 0, 0, 0.07);

  --shadow-premium-xl:
    0 2px 4px rgba(0, 0, 0, 0.03),
    0 4px 8px rgba(0, 0, 0, 0.04),
    0 8px 16px rgba(0, 0, 0, 0.05),
    0 16px 32px rgba(0, 0, 0, 0.06),
    0 32px 64px rgba(0, 0, 0, 0.07);

  /* === COLORED SHADOWS (For CTAs) === */

  --shadow-primary:
    0 10px 40px -10px rgba(139, 92, 246, 0.4);

  --shadow-success:
    0 10px 40px -10px rgba(16, 185, 129, 0.4);

  --shadow-warning:
    0 10px 40px -10px rgba(245, 158, 11, 0.4);

  --shadow-error:
    0 10px 40px -10px rgba(239, 68, 68, 0.4);

  /* === INNER SHADOWS (Inset, Input fields) === */

  --shadow-inner-sm:
    inset 0 1px 2px 0 rgb(0 0 0 / 0.05);

  --shadow-inner:
    inset 0 2px 4px 0 rgb(0 0 0 / 0.05);

  /* === GLOW EFFECTS === */

  --glow-primary:
    0 0 20px rgba(139, 92, 246, 0.3),
    0 0 40px rgba(139, 92, 246, 0.1);

  --glow-accent:
    0 0 20px rgba(236, 72, 153, 0.3),
    0 0 40px rgba(236, 72, 153, 0.1);
}
```

### 1.5 Border Radius Consistency

```css
:root {
  /* === BORDER RADIUS SCALE === */
  --radius-none: 0;
  --radius-sm: 0.25rem;    /* 4px - Buttons, inputs */
  --radius-md: 0.375rem;   /* 6px */
  --radius-lg: 0.5rem;     /* 8px - Cards */
  --radius-xl: 0.75rem;    /* 12px */
  --radius-2xl: 1rem;      /* 16px - Premium cards */
  --radius-3xl: 1.5rem;    /* 24px - Large cards, sections */
  --radius-4xl: 2rem;      /* 32px - Hero elements */
  --radius-full: 9999px;   /* Pills, avatars */

  /* === SEMANTIC RADIUS === */
  --radius-button: var(--radius-xl);
  --radius-button-sm: var(--radius-md);
  --radius-button-pill: var(--radius-full);

  --radius-input: var(--radius-lg);
  --radius-card: var(--radius-2xl);
  --radius-card-lg: var(--radius-3xl);
  --radius-modal: var(--radius-3xl);
  --radius-badge: var(--radius-full);
  --radius-avatar: var(--radius-full);
  --radius-icon: var(--radius-lg);
}
```

---

## 2. Component Design Patterns

### 2.1 Hero Section - Premium Dark

```html
<!-- Premium Hero with Mesh Gradient -->
<section class="hero-premium">
  <!-- Background layers -->
  <div class="hero-bg-base"></div>
  <div class="hero-mesh-overlay"></div>
  <div class="hero-noise-overlay"></div>

  <div class="hero-container">
    <div class="hero-content">
      <!-- Badge -->
      <span class="hero-badge">
        <span class="hero-badge-dot"></span>
        Introducing v2.0
      </span>

      <!-- Headline -->
      <h1 class="hero-headline">
        Build websites that
        <span class="gradient-text">convert visitors</span>
        into customers
      </h1>

      <!-- Subheadline -->
      <p class="hero-subheadline">
        Professional website builder powered by AI. Create stunning,
        high-converting websites in minutes, not months.
      </p>

      <!-- CTAs -->
      <div class="hero-cta-group">
        <a href="#" class="btn-primary-gradient">
          Start Free Trial
          <svg><!-- Arrow icon --></svg>
        </a>
        <a href="#" class="btn-glass">
          <svg><!-- Play icon --></svg>
          Watch Demo
        </a>
      </div>

      <!-- Trust indicators -->
      <div class="hero-trust">
        <div class="hero-avatars">
          <img src="..." alt="User" class="hero-avatar" />
          <img src="..." alt="User" class="hero-avatar" />
          <img src="..." alt="User" class="hero-avatar" />
        </div>
        <div class="hero-stats">
          <span class="hero-stat-number">2,500+</span>
          <span class="hero-stat-label">Happy customers</span>
        </div>
        <div class="hero-rating">
          <div class="hero-stars"><!-- 5 stars --></div>
          <span>4.9/5 rating</span>
        </div>
      </div>
    </div>

    <!-- Hero Visual -->
    <div class="hero-visual">
      <div class="hero-image-frame">
        <img src="..." alt="Product" class="hero-image" />
      </div>
      <!-- Floating elements -->
      <div class="hero-float hero-float-1">
        <div class="metric-card">
          <span class="metric-up">+127%</span>
          <span class="metric-label">Conversion</span>
        </div>
      </div>
    </div>
  </div>
</section>
```

```css
/* Premium Hero Styles */
.hero-premium {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  overflow: hidden;
}

.hero-bg-base {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    #0f0f1a 0%,
    #1a1a3e 50%,
    #0f0f1a 100%
  );
}

.hero-mesh-overlay {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(at 20% 30%, rgba(139, 92, 246, 0.3) 0%, transparent 50%),
    radial-gradient(at 80% 20%, rgba(236, 72, 153, 0.2) 0%, transparent 50%),
    radial-gradient(at 40% 80%, rgba(59, 130, 246, 0.2) 0%, transparent 50%);
}

.hero-noise-overlay {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  opacity: 0.03;
  pointer-events: none;
}

.hero-container {
  position: relative;
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-6);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-12);
  align-items: center;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: rgba(139, 92, 246, 0.15);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: var(--radius-full);
  color: #a78bfa;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  letter-spacing: var(--tracking-wide);
  margin-bottom: var(--space-6);
}

.hero-badge-dot {
  width: 6px;
  height: 6px;
  background: #a78bfa;
  border-radius: var(--radius-full);
  animation: pulse 2s ease-in-out infinite;
}

.hero-headline {
  font-size: var(--text-6xl);
  font-weight: var(--font-extrabold);
  line-height: var(--leading-tight);
  letter-spacing: var(--tracking-tighter);
  color: #ffffff;
  margin-bottom: var(--space-6);
}

.hero-subheadline {
  font-size: var(--text-xl);
  line-height: var(--leading-relaxed);
  color: rgba(255, 255, 255, 0.7);
  max-width: 520px;
  margin-bottom: var(--space-8);
}

.hero-cta-group {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-10);
}

/* Primary CTA Button */
.btn-primary-gradient {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-8);
  background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);
  color: #ffffff;
  font-weight: var(--font-semibold);
  border-radius: var(--radius-full);
  border: none;
  cursor: pointer;
  box-shadow: 0 10px 40px -10px rgba(139, 92, 246, 0.5);
  transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
}

.btn-primary-gradient:hover {
  transform: translateY(-2px) scale(0.98);
  box-shadow: 0 20px 50px -10px rgba(139, 92, 246, 0.6);
}

/* Glass CTA Button */
.btn-glass {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-6);
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-full);
  color: #ffffff;
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-glass:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

/* Hero Image */
.hero-image-frame {
  position: relative;
  border-radius: var(--radius-3xl);
  overflow: hidden;
  box-shadow: var(--shadow-2xl);
  transform: perspective(1000px) rotateY(-5deg) rotateX(2deg);
}

.hero-image {
  width: 100%;
  height: auto;
  display: block;
}

/* Floating Metrics */
.hero-float {
  position: absolute;
  animation: float 6s ease-in-out infinite;
}

.hero-float-1 {
  top: 10%;
  right: -5%;
}

.metric-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-premium-lg);
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Mobile Responsive */
@media (max-width: 1024px) {
  .hero-container {
    grid-template-columns: 1fr;
    text-align: center;
  }

  .hero-headline {
    font-size: var(--text-4xl);
  }

  .hero-subheadline {
    margin-left: auto;
    margin-right: auto;
  }

  .hero-cta-group {
    justify-content: center;
    flex-wrap: wrap;
  }

  .hero-visual {
    display: none;
  }
}
```

### 2.2 Premium Feature Cards (Bento Grid)

```html
<!-- Bento Grid Features -->
<section class="features-section">
  <div class="features-container">
    <!-- Section Header -->
    <div class="features-header">
      <span class="section-badge">Features</span>
      <h2 class="section-title">Everything you need to succeed</h2>
      <p class="section-description">
        Powerful tools designed to help you build, launch, and grow.
      </p>
    </div>

    <!-- Bento Grid -->
    <div class="bento-grid">
      <!-- Large Card -->
      <div class="bento-card bento-card-large gradient-card-purple">
        <div class="bento-badge">Most Popular</div>
        <h3 class="bento-title">AI-Powered Generation</h3>
        <p class="bento-description">
          Describe your vision and watch it come to life with our
          intelligent generation system.
        </p>
        <div class="bento-visual">
          <!-- Visual/illustration -->
        </div>
      </div>

      <!-- Medium Card -->
      <div class="bento-card bento-card-medium dark-card">
        <div class="bento-icon">
          <svg><!-- Lightning icon --></svg>
        </div>
        <h3 class="bento-title">Lightning Fast</h3>
        <p class="bento-description">
          Generate complete websites in under 60 seconds.
        </p>
      </div>

      <!-- Small Cards -->
      <div class="bento-card bento-card-small gradient-card-yellow">
        <div class="bento-icon">
          <svg><!-- Chart icon --></svg>
        </div>
        <h3 class="bento-title">Analytics</h3>
        <p class="bento-description">Real-time insights</p>
      </div>

      <div class="bento-card bento-card-small gradient-card-green">
        <div class="bento-icon">
          <svg><!-- Shield icon --></svg>
        </div>
        <h3 class="bento-title">Secure</h3>
        <p class="bento-description">Enterprise-grade</p>
      </div>

      <div class="bento-card bento-card-small gradient-card-blue">
        <div class="bento-icon">
          <svg><!-- Users icon --></svg>
        </div>
        <h3 class="bento-title">Team</h3>
        <p class="bento-description">Collaborate easily</p>
      </div>
    </div>
  </div>
</section>
```

```css
/* Bento Grid Styles */
.features-section {
  padding: var(--space-24) 0;
  background: linear-gradient(180deg, #fafafa 0%, #ffffff 100%);
}

.features-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-6);
}

.features-header {
  text-align: center;
  margin-bottom: var(--space-16);
}

.section-badge {
  display: inline-block;
  padding: var(--space-2) var(--space-4);
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  border-radius: var(--radius-full);
  margin-bottom: var(--space-4);
}

.section-title {
  font-size: var(--text-4xl);
  font-weight: var(--font-bold);
  letter-spacing: var(--tracking-tight);
  color: var(--color-text-primary);
  margin-bottom: var(--space-4);
}

.section-description {
  font-size: var(--text-lg);
  color: var(--color-text-secondary);
  max-width: 600px;
  margin: 0 auto;
}

/* Bento Grid Layout */
.bento-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: auto auto;
  gap: var(--space-4);
}

.bento-card {
  border-radius: var(--radius-3xl);
  padding: var(--space-8);
  transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
}

.bento-card:hover {
  transform: translateY(-4px);
}

/* Card Sizes */
.bento-card-large {
  grid-column: span 2;
  grid-row: span 2;
}

.bento-card-medium {
  grid-column: span 2;
}

.bento-card-small {
  grid-column: span 1;
}

/* Card Variants */
.gradient-card-purple {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
}

.gradient-card-yellow {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #92400e;
}

.gradient-card-green {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  color: #166534;
}

.gradient-card-blue {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  color: #1e40af;
}

.dark-card {
  background: #18181b;
  color: #ffffff;
}

.dark-card .bento-description {
  color: rgba(255, 255, 255, 0.7);
}

/* Card Content */
.bento-badge {
  display: inline-block;
  padding: var(--space-1) var(--space-3);
  background: rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  margin-bottom: var(--space-4);
}

.bento-icon {
  width: 48px;
  height: 48px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-4);
}

.dark-card .bento-icon {
  background: rgba(139, 92, 246, 0.2);
}

.bento-title {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  margin-bottom: var(--space-2);
}

.bento-card-large .bento-title {
  font-size: var(--text-2xl);
}

.bento-description {
  font-size: var(--text-base);
  line-height: var(--leading-relaxed);
  opacity: 0.9;
}

/* Mobile */
@media (max-width: 768px) {
  .bento-grid {
    grid-template-columns: 1fr;
  }

  .bento-card-large,
  .bento-card-medium,
  .bento-card-small {
    grid-column: span 1;
    grid-row: span 1;
  }
}
```

### 2.3 Modern Navigation

```html
<nav class="nav-modern">
  <div class="nav-container">
    <!-- Logo -->
    <a href="/" class="nav-logo">
      <svg class="nav-logo-icon"><!-- Logo SVG --></svg>
      <span class="nav-logo-text">Brand</span>
    </a>

    <!-- Navigation Links -->
    <div class="nav-links">
      <a href="#features" class="nav-link">Features</a>
      <a href="#pricing" class="nav-link">Pricing</a>
      <a href="#about" class="nav-link">About</a>
      <div class="nav-dropdown">
        <button class="nav-link nav-dropdown-trigger">
          Resources
          <svg class="nav-chevron"><!-- Chevron --></svg>
        </button>
        <div class="nav-dropdown-menu">
          <a href="#" class="nav-dropdown-item">Documentation</a>
          <a href="#" class="nav-dropdown-item">Blog</a>
          <a href="#" class="nav-dropdown-item">Support</a>
        </div>
      </div>
    </div>

    <!-- CTA -->
    <div class="nav-cta">
      <a href="/login" class="nav-link-cta">Log in</a>
      <a href="/signup" class="btn-nav-primary">Get Started</a>
    </div>

    <!-- Mobile Menu -->
    <button class="nav-mobile-toggle">
      <span></span>
      <span></span>
      <span></span>
    </button>
  </div>
</nav>
```

```css
.nav-modern {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  padding: var(--space-4) 0;
  transition: all 0.3s ease;
}

.nav-modern.scrolled {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  padding: var(--space-3) 0;
}

.nav-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 var(--space-6);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-logo {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  text-decoration: none;
}

.nav-logo-icon {
  width: 32px;
  height: 32px;
}

.nav-logo-text {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: var(--color-text-primary);
}

.nav-links {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.nav-link {
  padding: var(--space-2) var(--space-4);
  color: var(--color-text-secondary);
  font-weight: var(--font-medium);
  border-radius: var(--radius-lg);
  text-decoration: none;
  transition: all 0.2s ease;
}

.nav-link:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-sunken);
}

.nav-dropdown {
  position: relative;
}

.nav-dropdown-menu {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(8px);
  min-width: 200px;
  background: var(--color-surface-default);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-2xl);
  padding: var(--space-2);
  box-shadow: var(--shadow-xl);
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s ease;
}

.nav-dropdown:hover .nav-dropdown-menu {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}

.nav-dropdown-item {
  display: block;
  padding: var(--space-3) var(--space-4);
  color: var(--color-text-secondary);
  text-decoration: none;
  border-radius: var(--radius-lg);
  transition: all 0.15s ease;
}

.nav-dropdown-item:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-sunken);
}

.btn-nav-primary {
  padding: var(--space-2) var(--space-5);
  background: var(--color-text-primary);
  color: var(--color-text-inverse);
  font-weight: var(--font-semibold);
  border-radius: var(--radius-full);
  text-decoration: none;
  transition: all 0.2s ease;
}

.btn-nav-primary:hover {
  transform: scale(0.98);
  box-shadow: var(--shadow-lg);
}
```

### 2.4 Testimonials with Glass Cards

```html
<section class="testimonials-section">
  <div class="testimonials-container">
    <div class="testimonials-header">
      <span class="section-badge-dark">Testimonials</span>
      <h2 class="section-title-light">Loved by thousands</h2>
    </div>

    <div class="testimonials-grid">
      <div class="testimonial-card-glass">
        <div class="testimonial-rating">
          <!-- 5 stars -->
        </div>
        <blockquote class="testimonial-quote">
          "This transformed our business. The results speak for themselves."
        </blockquote>
        <div class="testimonial-author">
          <img src="..." alt="Sarah" class="testimonial-avatar" />
          <div class="testimonial-info">
            <span class="testimonial-name">Sarah Johnson</span>
            <span class="testimonial-role">CEO, TechStart</span>
          </div>
        </div>
      </div>
      <!-- More cards... -->
    </div>
  </div>
</section>
```

```css
.testimonials-section {
  padding: var(--space-24) 0;
  background: #0f0f1a;
}

.testimonials-header {
  text-align: center;
  margin-bottom: var(--space-16);
}

.section-badge-dark {
  display: inline-block;
  padding: var(--space-2) var(--space-4);
  background: rgba(236, 72, 153, 0.15);
  color: #f472b6;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  border-radius: var(--radius-full);
  margin-bottom: var(--space-4);
}

.section-title-light {
  font-size: var(--text-4xl);
  font-weight: var(--font-bold);
  color: #ffffff;
}

.testimonials-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-6);
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-6);
}

.testimonial-card-glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-3xl);
  padding: var(--space-8);
  transition: all 0.3s ease;
}

.testimonial-card-glass:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-4px);
}

.testimonial-rating {
  display: flex;
  gap: 2px;
  margin-bottom: var(--space-4);
  color: #fbbf24;
}

.testimonial-quote {
  font-size: var(--text-lg);
  line-height: var(--leading-relaxed);
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: var(--space-6);
}

.testimonial-author {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.testimonial-avatar {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  object-fit: cover;
}

.testimonial-name {
  display: block;
  font-weight: var(--font-semibold);
  color: #ffffff;
}

.testimonial-role {
  display: block;
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.5);
}

@media (max-width: 768px) {
  .testimonials-grid {
    grid-template-columns: 1fr;
  }
}
```

### 2.5 Premium Footer

```css
.footer-premium {
  background: #0a0a0f;
  padding: var(--space-20) 0 var(--space-8);
}

.footer-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-6);
}

.footer-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: var(--space-12);
  margin-bottom: var(--space-16);
}

.footer-brand {
  max-width: 300px;
}

.footer-logo {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: #ffffff;
  margin-bottom: var(--space-4);
}

.footer-description {
  color: rgba(255, 255, 255, 0.5);
  line-height: var(--leading-relaxed);
  margin-bottom: var(--space-6);
}

.footer-social {
  display: flex;
  gap: var(--space-3);
}

.footer-social-link {
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  transition: all 0.2s ease;
}

.footer-social-link:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.footer-column-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  margin-bottom: var(--space-4);
}

.footer-link {
  display: block;
  color: rgba(255, 255, 255, 0.5);
  text-decoration: none;
  padding: var(--space-2) 0;
  transition: color 0.2s ease;
}

.footer-link:hover {
  color: #ffffff;
}

.footer-bottom {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: var(--space-8);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-copyright {
  color: rgba(255, 255, 255, 0.4);
  font-size: var(--text-sm);
}

@media (max-width: 768px) {
  .footer-grid {
    grid-template-columns: 1fr 1fr;
  }

  .footer-brand {
    grid-column: span 2;
  }
}
```

---

## 3. Animation and Micro-interactions

### 3.1 Premium Easing Functions

```css
:root {
  /* Standard Easings */
  --ease-linear: linear;
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

  /* Premium Easings (Apple-inspired) */
  --ease-spring: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-smooth: cubic-bezier(0.16, 1, 0.3, 1);

  /* Micro-interaction Easings */
  --ease-button: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --ease-card: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-modal: cubic-bezier(0.33, 1, 0.68, 1);

  /* Duration Scale */
  --duration-instant: 50ms;
  --duration-fast: 100ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --duration-slower: 500ms;
  --duration-slowest: 700ms;
}
```

### 3.2 Hover Effects

```css
/* Premium Button Hover */
.btn-premium {
  position: relative;
  overflow: hidden;
  transition: all var(--duration-slow) var(--ease-spring);
}

.btn-premium::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.2) 0%,
    rgba(255, 255, 255, 0) 50%
  );
  transform: translateX(-100%);
  transition: transform var(--duration-slow) var(--ease-smooth);
}

.btn-premium:hover {
  transform: translateY(-2px) scale(0.98);
  box-shadow: var(--shadow-xl);
}

.btn-premium:hover::before {
  transform: translateX(100%);
}

.btn-premium:active {
  transform: translateY(0) scale(0.96);
}

/* Card Lift Effect */
.card-lift {
  transition:
    transform var(--duration-slow) var(--ease-card),
    box-shadow var(--duration-slow) var(--ease-card);
}

.card-lift:hover {
  transform: translateY(-8px);
  box-shadow: var(--shadow-premium-xl);
}

/* Magnetic Button Effect */
.btn-magnetic {
  transition: transform var(--duration-fast) var(--ease-smooth);
}

/* Applied via JavaScript:
element.addEventListener('mousemove', (e) => {
  const rect = element.getBoundingClientRect();
  const x = e.clientX - rect.left - rect.width / 2;
  const y = e.clientY - rect.top - rect.height / 2;
  element.style.transform = `translate(${x * 0.1}px, ${y * 0.1}px)`;
});
*/

/* Link Underline Animation */
.link-animated {
  position: relative;
  text-decoration: none;
}

.link-animated::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 2px;
  background: currentColor;
  transition: width var(--duration-normal) var(--ease-smooth);
}

.link-animated:hover::after {
  width: 100%;
}

/* Image Zoom on Hover */
.img-zoom-container {
  overflow: hidden;
  border-radius: var(--radius-2xl);
}

.img-zoom {
  transition: transform var(--duration-slower) var(--ease-smooth);
}

.img-zoom-container:hover .img-zoom {
  transform: scale(1.05);
}
```

### 3.3 Page Load Animations

```css
/* Fade In Up */
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

.animate-fade-in-up {
  animation: fadeInUp 0.6s var(--ease-smooth) forwards;
  opacity: 0;
}

/* Staggered Children */
.stagger-children > * {
  opacity: 0;
  animation: fadeInUp 0.5s var(--ease-smooth) forwards;
}

.stagger-children > *:nth-child(1) { animation-delay: 0.1s; }
.stagger-children > *:nth-child(2) { animation-delay: 0.2s; }
.stagger-children > *:nth-child(3) { animation-delay: 0.3s; }
.stagger-children > *:nth-child(4) { animation-delay: 0.4s; }
.stagger-children > *:nth-child(5) { animation-delay: 0.5s; }

/* Scale In */
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

.animate-scale-in {
  animation: scaleIn 0.4s var(--ease-spring) forwards;
}

/* Slide In From Left/Right */
@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Blur In */
@keyframes blurIn {
  from {
    opacity: 0;
    filter: blur(10px);
  }
  to {
    opacity: 1;
    filter: blur(0);
  }
}

.animate-blur-in {
  animation: blurIn 0.8s var(--ease-smooth) forwards;
}
```

### 3.4 Scroll-Triggered Animations

```css
/* CSS-only scroll animations using scroll-driven animations */
@supports (animation-timeline: scroll()) {
  .scroll-fade-in {
    animation: scrollFadeIn linear;
    animation-timeline: view();
    animation-range: entry 0% entry 50%;
  }

  @keyframes scrollFadeIn {
    from {
      opacity: 0;
      transform: translateY(50px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
}

/* Fallback with Intersection Observer (via JS) */
.reveal {
  opacity: 0;
  transform: translateY(30px);
  transition:
    opacity 0.6s var(--ease-smooth),
    transform 0.6s var(--ease-smooth);
}

.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

/* Parallax Effect */
.parallax-container {
  overflow: hidden;
}

.parallax-element {
  will-change: transform;
}

/* Counter Animation */
@keyframes countUp {
  from { --num: 0; }
  to { --num: var(--target); }
}

.counter {
  animation: countUp 2s var(--ease-smooth) forwards;
  counter-reset: num var(--num);
}

.counter::after {
  content: counter(num);
}
```

---

## 4. Responsive Design

### 4.1 Breakpoint System

```css
:root {
  /* Breakpoint Values */
  --bp-xs: 320px;
  --bp-sm: 640px;
  --bp-md: 768px;
  --bp-lg: 1024px;
  --bp-xl: 1280px;
  --bp-2xl: 1536px;
}

/* Mobile-First Media Queries */
/* xs: 0-639px (default styles) */

/* sm: 640px+ */
@media (min-width: 640px) {
  .container { padding: 0 var(--space-8); }
}

/* md: 768px+ */
@media (min-width: 768px) {
  .hero-headline { font-size: var(--text-5xl); }
  .grid-cols-md-2 { grid-template-columns: repeat(2, 1fr); }
}

/* lg: 1024px+ */
@media (min-width: 1024px) {
  .hero-headline { font-size: var(--text-6xl); }
  .grid-cols-lg-3 { grid-template-columns: repeat(3, 1fr); }
  .nav-mobile { display: none; }
  .nav-desktop { display: flex; }
}

/* xl: 1280px+ */
@media (min-width: 1280px) {
  .container { max-width: 1200px; }
  .grid-cols-xl-4 { grid-template-columns: repeat(4, 1fr); }
}

/* 2xl: 1536px+ */
@media (min-width: 1536px) {
  .container { max-width: 1400px; }
}
```

### 4.2 Container Queries

```css
/* Container Query Setup */
.card-container {
  container-type: inline-size;
  container-name: card;
}

@container card (min-width: 400px) {
  .card-content {
    display: flex;
    gap: var(--space-4);
  }

  .card-image {
    flex: 0 0 40%;
  }
}

@container card (min-width: 600px) {
  .card-title {
    font-size: var(--text-2xl);
  }
}
```

### 4.3 Touch-Friendly Interactions

```css
/* Minimum Touch Target Size (48x48px recommended) */
.touch-target {
  min-width: 48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Increased Tap Areas */
.btn-touch {
  padding: var(--space-4) var(--space-6);
  min-height: 52px;
}

/* Remove Hover on Touch Devices */
@media (hover: none) {
  .card-lift:hover {
    transform: none;
    box-shadow: var(--shadow-sm);
  }

  .btn-premium:hover {
    transform: none;
  }
}

/* Active States for Touch */
@media (hover: none) {
  .btn-premium:active {
    transform: scale(0.98);
    opacity: 0.9;
  }
}

/* Safe Area Insets (for notched devices) */
.footer {
  padding-bottom: calc(var(--space-8) + env(safe-area-inset-bottom));
}

.nav-mobile {
  padding-top: env(safe-area-inset-top);
}

/* Disable Text Selection on Interactive Elements */
.btn, .nav-link, .card {
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

/* Scroll Snap for Carousels */
.carousel {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.carousel::-webkit-scrollbar {
  display: none;
}

.carousel-item {
  scroll-snap-align: start;
  flex: 0 0 85%;
  margin-right: var(--space-4);
}

@media (min-width: 768px) {
  .carousel-item {
    flex: 0 0 45%;
  }
}
```

---

## 5. Implementation Recommendations

### 5.1 Design Tokens for System Prompts

When generating websites, inject these design tokens:

```javascript
const DESIGN_TOKENS = {
  // Colors
  colors: {
    primary: '#8b5cf6',
    primaryDark: '#7c3aed',
    secondary: '#ec4899',
    background: {
      light: '#fafafa',
      dark: '#0f0f1a',
    },
    text: {
      primary: '#18181b',
      secondary: '#52525b',
      inverse: '#fafafa',
    },
  },

  // Typography
  typography: {
    fontFamily: "'Inter', system-ui, sans-serif",
    headline: {
      size: 'clamp(2.5rem, 5vw + 1rem, 4.5rem)',
      weight: 800,
      letterSpacing: '-0.03em',
      lineHeight: 1.1,
    },
    body: {
      size: 'clamp(1rem, 1.5vw, 1.125rem)',
      weight: 400,
      lineHeight: 1.6,
    },
  },

  // Spacing
  spacing: {
    section: {
      sm: '4rem',
      md: '6rem',
      lg: '8rem',
    },
    container: {
      maxWidth: '1200px',
      padding: '1.5rem',
    },
  },

  // Effects
  effects: {
    shadow: {
      card: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      premium: '0 1px 2px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.04), 0 8px 16px rgba(0,0,0,0.04)',
    },
    radius: {
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
      full: '9999px',
    },
    transition: {
      fast: '150ms cubic-bezier(0.25, 1, 0.5, 1)',
      normal: '300ms cubic-bezier(0.25, 1, 0.5, 1)',
      slow: '500ms cubic-bezier(0.25, 1, 0.5, 1)',
    },
  },

  // Gradients
  gradients: {
    heroDark: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a3e 50%, #0f0f1a 100%)',
    mesh: 'radial-gradient(at 20% 30%, rgba(139,92,246,0.3) 0%, transparent 50%), radial-gradient(at 80% 20%, rgba(236,72,153,0.2) 0%, transparent 50%)',
    cta: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #ec4899 100%)',
  },
};
```

### 5.2 Quality Checklist for Generated Sites

1. **Visual Hierarchy**
   - [ ] Clear headline hierarchy (h1 > h2 > h3)
   - [ ] Consistent spacing between sections
   - [ ] Readable body text (16px+, 1.6 line-height)

2. **Layout**
   - [ ] Constrained container (max-width: 1200px)
   - [ ] NOT edge-to-edge layouts
   - [ ] Generous whitespace

3. **Effects**
   - [ ] Layered shadows (4+ layers)
   - [ ] Glassmorphism where appropriate
   - [ ] Smooth transitions (cubic-bezier)

4. **Responsiveness**
   - [ ] Mobile-first styles
   - [ ] Touch-friendly tap targets (48px+)
   - [ ] Fluid typography (clamp)

5. **Polish**
   - [ ] Hover states on all interactive elements
   - [ ] Focus states for accessibility
   - [ ] Loading/empty states considered

---

## 6. Quick Reference - CSS Snippets

### Hero Section (Copy-Paste Ready)

```css
/* Premium Dark Hero */
.hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, #0f0f1a 0%, #1a1a3e 50%, #0f0f1a 100%);
}

.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(at 20% 30%, rgba(139,92,246,0.3) 0%, transparent 50%),
    radial-gradient(at 80% 20%, rgba(236,72,153,0.2) 0%, transparent 50%);
  pointer-events: none;
}

.hero-content {
  position: relative;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.hero h1 {
  font-size: clamp(2.5rem, 5vw + 1rem, 4.5rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
  color: #fff;
}

.hero p {
  font-size: clamp(1rem, 1.5vw, 1.25rem);
  line-height: 1.8;
  color: rgba(255,255,255,0.7);
  max-width: 500px;
}
```

### Premium Card

```css
.card-premium {
  background: #fff;
  border-radius: 1.5rem;
  padding: 2rem;
  box-shadow:
    0 1px 2px rgba(0,0,0,0.04),
    0 2px 4px rgba(0,0,0,0.04),
    0 4px 8px rgba(0,0,0,0.04),
    0 8px 16px rgba(0,0,0,0.04);
  transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
}

.card-premium:hover {
  transform: translateY(-8px);
  box-shadow:
    0 2px 4px rgba(0,0,0,0.03),
    0 4px 8px rgba(0,0,0,0.04),
    0 8px 16px rgba(0,0,0,0.05),
    0 16px 32px rgba(0,0,0,0.06),
    0 32px 64px rgba(0,0,0,0.07);
}
```

### Glass Card

```css
.card-glass {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 1.5rem;
  padding: 2rem;
}
```

### Gradient CTA Button

```css
.btn-gradient {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 2rem;
  background: linear-gradient(135deg, #8b5cf6, #ec4899);
  color: #fff;
  font-weight: 600;
  border: none;
  border-radius: 9999px;
  cursor: pointer;
  box-shadow: 0 10px 40px -10px rgba(139, 92, 246, 0.5);
  transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
}

.btn-gradient:hover {
  transform: translateY(-2px) scale(0.98);
  box-shadow: 0 20px 50px -10px rgba(139, 92, 246, 0.6);
}
```

---

This design system provides the foundation for generating production-grade websites that meet the quality standards of premium design agencies. All patterns are optimized for:

1. **AI generation** - Clear, unambiguous patterns
2. **Rapid development** - Copy-paste ready code
3. **Visual impact** - Premium aesthetic quality
4. **Performance** - Efficient CSS, no heavy dependencies
5. **Accessibility** - WCAG-compliant foundations
