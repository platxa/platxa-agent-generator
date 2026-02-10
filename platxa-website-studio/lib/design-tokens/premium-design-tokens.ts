/**
 * Premium Design Tokens 2026
 *
 * Production-grade visual design patterns for AI-generated websites.
 * These tokens provide ready-to-use CSS snippets that make sites look
 * like they cost $10,000+ to design.
 *
 * @module @platxa/design-tokens/premium
 */

// =============================================================================
// PREMIUM COLOR PALETTES
// =============================================================================

export const PREMIUM_COLORS = {
  // Vibrant Purple Palette (Primary)
  purple: {
    50: '#f5f3ff',
    100: '#ede9fe',
    200: '#ddd6fe',
    300: '#c4b5fd',
    400: '#a78bfa',
    500: '#8b5cf6',
    600: '#7c3aed',
    700: '#6d28d9',
    800: '#5b21b6',
    900: '#4c1d95',
    950: '#2e1065',
  },

  // Accent Pink
  pink: {
    50: '#fdf2f8',
    100: '#fce7f3',
    200: '#fbcfe8',
    300: '#f9a8d4',
    400: '#f472b6',
    500: '#ec4899',
    600: '#db2777',
    700: '#be185d',
    800: '#9d174d',
    900: '#831843',
  },

  // Dark Backgrounds
  dark: {
    900: '#0f0f1a',
    850: '#141428',
    800: '#1a1a3e',
    750: '#1e1e4a',
    700: '#252560',
    base: '#0a0a0f',
    surface: '#18181b',
    elevated: '#27272a',
  },
} as const;

// =============================================================================
// PREMIUM GRADIENTS
// =============================================================================

export const PREMIUM_GRADIENTS = {
  // Hero Section Backgrounds
  hero: {
    /** Dark sophisticated background */
    dark: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a3e 50%, #0f0f1a 100%)',
    /** Midnight with subtle purple */
    midnight: 'linear-gradient(to bottom right, #0c0c1d 0%, #1a1a2e 25%, #16213e 50%, #0f0f23 100%)',
    /** Cosmic purple hues */
    cosmic: 'linear-gradient(135deg, #0f0f1a 0%, #1a0a2e 30%, #2d1b4e 60%, #0f0f1a 100%)',
    /** Clean dark to darker */
    cleanDark: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)',
  },

  // Mesh Gradient Overlays (Layered on top of hero backgrounds)
  mesh: {
    /** Purple/Pink/Blue orbs */
    standard: `
      radial-gradient(at 20% 30%, rgba(139, 92, 246, 0.3) 0%, transparent 50%),
      radial-gradient(at 80% 20%, rgba(236, 72, 153, 0.2) 0%, transparent 50%),
      radial-gradient(at 40% 80%, rgba(59, 130, 246, 0.2) 0%, transparent 50%)
    `.replace(/\s+/g, ' ').trim(),

    /** Warm orange/red/amber */
    warm: `
      radial-gradient(at 0% 0%, rgba(249, 115, 22, 0.2) 0%, transparent 50%),
      radial-gradient(at 100% 0%, rgba(239, 68, 68, 0.15) 0%, transparent 50%),
      radial-gradient(at 50% 100%, rgba(245, 158, 11, 0.2) 0%, transparent 50%)
    `.replace(/\s+/g, ' ').trim(),

    /** Cool blue/cyan */
    cool: `
      radial-gradient(at 0% 50%, rgba(59, 130, 246, 0.25) 0%, transparent 50%),
      radial-gradient(at 100% 50%, rgba(6, 182, 212, 0.2) 0%, transparent 50%),
      radial-gradient(at 50% 100%, rgba(139, 92, 246, 0.15) 0%, transparent 50%)
    `.replace(/\s+/g, ' ').trim(),

    /** Subtle single orb */
    subtle: 'radial-gradient(at 50% 0%, rgba(139, 92, 246, 0.15) 0%, transparent 60%)',
  },

  // CTA Button Gradients
  cta: {
    /** Primary purple to pink */
    primary: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
    /** Extended purple-pink */
    extended: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #ec4899 100%)',
    /** Warm orange to pink */
    warm: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
    /** Cool cyan to blue */
    cool: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
    /** Success green */
    success: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    /** Dark elegant */
    dark: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
  },

  // Text Gradients (Apply with background-clip: text)
  text: {
    primary: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
    gold: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)',
    cool: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
    fire: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
  },

  // Card Background Gradients
  card: {
    purple: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    yellow: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    green: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
    blue: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
    pink: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
    gray: 'linear-gradient(135deg, #f4f4f5 0%, #e4e4e7 100%)',
  },
} as const;

// =============================================================================
// PREMIUM SHADOWS
// =============================================================================

export const PREMIUM_SHADOWS = {
  // Standard Shadows (Utility)
  standard: {
    xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  },

  // Premium Multi-Layer Shadows (Dribbble-worthy)
  premium: {
    /** Subtle elevation - inputs, small elements */
    sm: `
      0 1px 2px rgba(0, 0, 0, 0.04),
      0 2px 4px rgba(0, 0, 0, 0.04),
      0 4px 8px rgba(0, 0, 0, 0.04)
    `.replace(/\s+/g, ' ').trim(),

    /** Card elevation */
    md: `
      0 1px 2px rgba(0, 0, 0, 0.04),
      0 2px 4px rgba(0, 0, 0, 0.04),
      0 4px 8px rgba(0, 0, 0, 0.04),
      0 8px 16px rgba(0, 0, 0, 0.04)
    `.replace(/\s+/g, ' ').trim(),

    /** Elevated card */
    lg: `
      0 1px 2px rgba(0, 0, 0, 0.07),
      0 2px 4px rgba(0, 0, 0, 0.07),
      0 4px 8px rgba(0, 0, 0, 0.07),
      0 8px 16px rgba(0, 0, 0, 0.07),
      0 16px 32px rgba(0, 0, 0, 0.07)
    `.replace(/\s+/g, ' ').trim(),

    /** Hero images, prominent cards */
    xl: `
      0 2px 4px rgba(0, 0, 0, 0.03),
      0 4px 8px rgba(0, 0, 0, 0.04),
      0 8px 16px rgba(0, 0, 0, 0.05),
      0 16px 32px rgba(0, 0, 0, 0.06),
      0 32px 64px rgba(0, 0, 0, 0.07)
    `.replace(/\s+/g, ' ').trim(),
  },

  // Colored Shadows (For CTAs, interactive elements)
  colored: {
    primary: '0 10px 40px -10px rgba(139, 92, 246, 0.4)',
    primaryHover: '0 20px 50px -10px rgba(139, 92, 246, 0.6)',
    pink: '0 10px 40px -10px rgba(236, 72, 153, 0.4)',
    success: '0 10px 40px -10px rgba(16, 185, 129, 0.4)',
    warning: '0 10px 40px -10px rgba(245, 158, 11, 0.4)',
    error: '0 10px 40px -10px rgba(239, 68, 68, 0.4)',
    blue: '0 10px 40px -10px rgba(59, 130, 246, 0.4)',
  },

  // Glow Effects
  glow: {
    primary: '0 0 20px rgba(139, 92, 246, 0.3), 0 0 40px rgba(139, 92, 246, 0.1)',
    pink: '0 0 20px rgba(236, 72, 153, 0.3), 0 0 40px rgba(236, 72, 153, 0.1)',
    blue: '0 0 20px rgba(59, 130, 246, 0.3), 0 0 40px rgba(59, 130, 246, 0.1)',
  },
} as const;

// =============================================================================
// PREMIUM ANIMATIONS & EASING
// =============================================================================

export const PREMIUM_EASING = {
  // Standard
  linear: 'linear',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',

  // Premium (Apple-inspired)
  spring: 'cubic-bezier(0.25, 1, 0.5, 1)',
  bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  smooth: 'cubic-bezier(0.16, 1, 0.3, 1)',

  // Specific Use Cases
  button: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  card: 'cubic-bezier(0.23, 1, 0.32, 1)',
  modal: 'cubic-bezier(0.33, 1, 0.68, 1)',
} as const;

export const PREMIUM_DURATION = {
  instant: '50ms',
  fast: '100ms',
  normal: '200ms',
  slow: '300ms',
  slower: '500ms',
  slowest: '700ms',
} as const;

// =============================================================================
// PREMIUM GLASSMORPHISM
// =============================================================================

export const PREMIUM_GLASS = {
  // Light Mode Glass
  light: {
    background: 'rgba(255, 255, 255, 0.7)',
    backgroundStrong: 'rgba(255, 255, 255, 0.9)',
    border: 'rgba(255, 255, 255, 0.3)',
    borderSubtle: 'rgba(0, 0, 0, 0.05)',
    backdropBlur: 'blur(12px)',
    backdropBlurStrong: 'blur(24px)',
  },

  // Dark Mode Glass
  dark: {
    background: 'rgba(10, 10, 11, 0.8)',
    backgroundStrong: 'rgba(10, 10, 11, 0.95)',
    backgroundSubtle: 'rgba(255, 255, 255, 0.05)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.15)',
    backdropBlur: 'blur(12px)',
    backdropBlurStrong: 'blur(24px)',
  },

  // Card Glass (On dark backgrounds)
  card: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'rgba(255, 255, 255, 0.2)',
    backdrop: 'blur(16px) saturate(180%)',
  },

  // Badge Glass
  badge: {
    background: 'rgba(139, 92, 246, 0.15)',
    border: 'rgba(139, 92, 246, 0.3)',
    text: '#a78bfa',
  },
} as const;

// =============================================================================
// PREMIUM TYPOGRAPHY
// =============================================================================

export const PREMIUM_TYPOGRAPHY = {
  // Fluid Font Sizes
  fontSize: {
    xs: 'clamp(0.75rem, 0.7rem + 0.25vw, 0.8125rem)',
    sm: 'clamp(0.8125rem, 0.75rem + 0.3vw, 0.9375rem)',
    base: 'clamp(1rem, 0.9rem + 0.5vw, 1.125rem)',
    lg: 'clamp(1.125rem, 1rem + 0.6vw, 1.25rem)',
    xl: 'clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem)',
    '2xl': 'clamp(1.5rem, 1.25rem + 1.25vw, 2rem)',
    '3xl': 'clamp(1.875rem, 1.5rem + 1.875vw, 2.5rem)',
    '4xl': 'clamp(2.25rem, 1.75rem + 2.5vw, 3rem)',
    '5xl': 'clamp(3rem, 2rem + 5vw, 4.5rem)',
    '6xl': 'clamp(3.75rem, 2.5rem + 6.25vw, 6rem)',
  },

  // Font Weights
  fontWeight: {
    thin: 100,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },

  // Line Heights
  lineHeight: {
    none: '1',
    tight: '1.1',
    snug: '1.25',
    normal: '1.5',
    relaxed: '1.625',
    loose: '1.8',
  },

  // Letter Spacing
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },

  // Font Stacks
  fontFamily: {
    sans: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
    serif: "'Playfair Display', 'Merriweather', Georgia, 'Times New Roman', serif",
    display: "'Clash Display', 'Cabinet Grotesk', 'Satoshi', var(--font-sans)",
    mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', ui-monospace, monospace",
  },
} as const;

// =============================================================================
// PREMIUM SPACING
// =============================================================================

export const PREMIUM_SPACING = {
  // Base Scale (Tailwind-compatible)
  scale: {
    0: '0',
    px: '1px',
    0.5: '0.125rem',
    1: '0.25rem',
    1.5: '0.375rem',
    2: '0.5rem',
    2.5: '0.625rem',
    3: '0.75rem',
    3.5: '0.875rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    7: '1.75rem',
    8: '2rem',
    9: '2.25rem',
    10: '2.5rem',
    12: '3rem',
    14: '3.5rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
    28: '7rem',
    32: '8rem',
    36: '9rem',
    40: '10rem',
    48: '12rem',
    56: '14rem',
    64: '16rem',
    72: '18rem',
    80: '20rem',
    96: '24rem',
  },

  // Section Spacing
  section: {
    sm: '4rem',    // 64px
    md: '6rem',    // 96px
    lg: '8rem',    // 128px
    xl: '10rem',   // 160px
  },

  // Container
  container: {
    maxWidth: '1200px',
    maxWidthNarrow: '800px',
    maxWidthWide: '1400px',
    padding: '1.5rem',
  },
} as const;

// =============================================================================
// PREMIUM BORDER RADIUS
// =============================================================================

export const PREMIUM_RADIUS = {
  none: '0',
  sm: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  '2xl': '1rem',
  '3xl': '1.5rem',
  '4xl': '2rem',
  full: '9999px',

  // Semantic
  button: '0.75rem',      // xl
  buttonPill: '9999px',
  card: '1rem',           // 2xl
  cardLarge: '1.5rem',    // 3xl
  input: '0.5rem',        // lg
  badge: '9999px',
  modal: '1.5rem',
} as const;

// =============================================================================
// CSS SNIPPET GENERATORS
// =============================================================================

/**
 * Generate CSS for a premium hero section
 */
export function generateHeroCSS(options?: {
  gradient?: keyof typeof PREMIUM_GRADIENTS.hero;
  mesh?: keyof typeof PREMIUM_GRADIENTS.mesh;
}): string {
  const { gradient = 'dark', mesh = 'standard' } = options || {};

  return `
/* Premium Hero Section */
.hero-premium {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  overflow: hidden;
}

.hero-premium::before {
  content: '';
  position: absolute;
  inset: 0;
  background: ${PREMIUM_GRADIENTS.hero[gradient]};
  z-index: 0;
}

.hero-premium::after {
  content: '';
  position: absolute;
  inset: 0;
  background: ${PREMIUM_GRADIENTS.mesh[mesh]};
  z-index: 1;
  pointer-events: none;
}

.hero-content {
  position: relative;
  z-index: 2;
  max-width: ${PREMIUM_SPACING.container.maxWidth};
  margin: 0 auto;
  padding: 0 ${PREMIUM_SPACING.container.padding};
}

.hero-headline {
  font-size: ${PREMIUM_TYPOGRAPHY.fontSize['6xl']};
  font-weight: ${PREMIUM_TYPOGRAPHY.fontWeight.extrabold};
  line-height: ${PREMIUM_TYPOGRAPHY.lineHeight.tight};
  letter-spacing: ${PREMIUM_TYPOGRAPHY.letterSpacing.tighter};
  color: #ffffff;
}

.hero-subheadline {
  font-size: ${PREMIUM_TYPOGRAPHY.fontSize.xl};
  line-height: ${PREMIUM_TYPOGRAPHY.lineHeight.loose};
  color: rgba(255, 255, 255, 0.7);
  max-width: 520px;
}
`.trim();
}

/**
 * Generate CSS for premium card styles
 */
export function generateCardCSS(options?: {
  variant?: 'light' | 'dark' | 'glass' | 'gradient';
  gradientKey?: keyof typeof PREMIUM_GRADIENTS.card;
}): string {
  const { variant = 'light', gradientKey = 'purple' } = options || {};

  const baseStyles = `
.card-premium {
  border-radius: ${PREMIUM_RADIUS.card};
  padding: 2rem;
  transition: all ${PREMIUM_DURATION.slow} ${PREMIUM_EASING.card};
}

.card-premium:hover {
  transform: translateY(-8px);
}
`;

  const variantStyles = {
    light: `
.card-premium {
  background: #ffffff;
  box-shadow: ${PREMIUM_SHADOWS.premium.md};
}

.card-premium:hover {
  box-shadow: ${PREMIUM_SHADOWS.premium.xl};
}
`,
    dark: `
.card-premium {
  background: ${PREMIUM_COLORS.dark.surface};
  color: #ffffff;
  box-shadow: ${PREMIUM_SHADOWS.standard.lg};
}
`,
    glass: `
.card-premium {
  background: ${PREMIUM_GLASS.card.background};
  backdrop-filter: ${PREMIUM_GLASS.card.backdrop};
  -webkit-backdrop-filter: ${PREMIUM_GLASS.card.backdrop};
  border: 1px solid ${PREMIUM_GLASS.card.border};
  color: #ffffff;
}

.card-premium:hover {
  background: rgba(255, 255, 255, 0.15);
}
`,
    gradient: `
.card-premium {
  background: ${PREMIUM_GRADIENTS.card[gradientKey]};
  box-shadow: ${PREMIUM_SHADOWS.standard.md};
}
`,
  };

  return (baseStyles + variantStyles[variant]).trim();
}

/**
 * Generate CSS for premium button styles
 */
export function generateButtonCSS(options?: {
  variant?: 'gradient' | 'glass' | 'solid';
  gradientKey?: keyof typeof PREMIUM_GRADIENTS.cta;
}): string {
  const { variant = 'gradient', gradientKey = 'primary' } = options || {};

  const baseStyles = `
.btn-premium {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem 2rem;
  font-weight: ${PREMIUM_TYPOGRAPHY.fontWeight.semibold};
  border: none;
  border-radius: ${PREMIUM_RADIUS.buttonPill};
  cursor: pointer;
  transition: all ${PREMIUM_DURATION.slow} ${PREMIUM_EASING.spring};
}

.btn-premium:active {
  transform: scale(0.96);
}
`;

  const variantStyles = {
    gradient: `
.btn-premium {
  background: ${PREMIUM_GRADIENTS.cta[gradientKey]};
  color: #ffffff;
  box-shadow: ${PREMIUM_SHADOWS.colored.primary};
}

.btn-premium:hover {
  transform: translateY(-2px) scale(0.98);
  box-shadow: ${PREMIUM_SHADOWS.colored.primaryHover};
}
`,
    glass: `
.btn-premium {
  background: ${PREMIUM_GLASS.dark.backgroundSubtle};
  backdrop-filter: ${PREMIUM_GLASS.dark.backdropBlur};
  -webkit-backdrop-filter: ${PREMIUM_GLASS.dark.backdropBlur};
  border: 1px solid ${PREMIUM_GLASS.dark.border};
  color: #ffffff;
}

.btn-premium:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: ${PREMIUM_GLASS.dark.borderStrong};
}
`,
    solid: `
.btn-premium {
  background: ${PREMIUM_COLORS.purple[600]};
  color: #ffffff;
  box-shadow: ${PREMIUM_SHADOWS.standard.md};
}

.btn-premium:hover {
  background: ${PREMIUM_COLORS.purple[700]};
  box-shadow: ${PREMIUM_SHADOWS.standard.lg};
  transform: translateY(-2px);
}
`,
  };

  return (baseStyles + variantStyles[variant]).trim();
}

/**
 * Generate CSS for glass badge
 */
export function generateBadgeCSS(): string {
  return `
.badge-glass {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: ${PREMIUM_GLASS.badge.background};
  border: 1px solid ${PREMIUM_GLASS.badge.border};
  border-radius: ${PREMIUM_RADIUS.badge};
  color: ${PREMIUM_GLASS.badge.text};
  font-size: ${PREMIUM_TYPOGRAPHY.fontSize.sm};
  font-weight: ${PREMIUM_TYPOGRAPHY.fontWeight.medium};
  letter-spacing: ${PREMIUM_TYPOGRAPHY.letterSpacing.wide};
}

.badge-glass-dot {
  width: 6px;
  height: 6px;
  background: currentColor;
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
`.trim();
}

/**
 * Generate CSS for gradient text
 */
export function generateGradientTextCSS(): string {
  return `
.gradient-text {
  background: ${PREMIUM_GRADIENTS.text.primary};
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.gradient-text-gold {
  background: ${PREMIUM_GRADIENTS.text.gold};
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.gradient-text-cool {
  background: ${PREMIUM_GRADIENTS.text.cool};
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
`.trim();
}

/**
 * Generate animation keyframes
 */
export function generateAnimationKeyframes(): string {
  return `
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
  animation: fadeInUp 0.6s ${PREMIUM_EASING.smooth} forwards;
  opacity: 0;
}

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
  animation: scaleIn 0.4s ${PREMIUM_EASING.spring} forwards;
}

/* Float */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.animate-float {
  animation: float 6s ease-in-out infinite;
}

/* Staggered Children */
.stagger-children > * {
  opacity: 0;
  animation: fadeInUp 0.5s ${PREMIUM_EASING.smooth} forwards;
}

.stagger-children > *:nth-child(1) { animation-delay: 0.1s; }
.stagger-children > *:nth-child(2) { animation-delay: 0.2s; }
.stagger-children > *:nth-child(3) { animation-delay: 0.3s; }
.stagger-children > *:nth-child(4) { animation-delay: 0.4s; }
.stagger-children > *:nth-child(5) { animation-delay: 0.5s; }
.stagger-children > *:nth-child(6) { animation-delay: 0.6s; }
`.trim();
}

/**
 * Generate complete premium CSS utilities
 */
export function generatePremiumUtilitiesCSS(): string {
  return [
    generateGradientTextCSS(),
    generateBadgeCSS(),
    generateAnimationKeyframes(),
    `
/* Card Lift Effect */
.card-lift {
  transition: transform ${PREMIUM_DURATION.slow} ${PREMIUM_EASING.card}, box-shadow ${PREMIUM_DURATION.slow} ${PREMIUM_EASING.card};
}

.card-lift:hover {
  transform: translateY(-8px);
}

/* Image Zoom Container */
.img-zoom-container {
  overflow: hidden;
  border-radius: ${PREMIUM_RADIUS.cardLarge};
}

.img-zoom {
  transition: transform ${PREMIUM_DURATION.slower} ${PREMIUM_EASING.smooth};
}

.img-zoom-container:hover .img-zoom {
  transform: scale(1.05);
}

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
  transition: width ${PREMIUM_DURATION.normal} ${PREMIUM_EASING.smooth};
}

.link-animated:hover::after {
  width: 100%;
}
`.trim(),
  ].join('\n\n');
}

// =============================================================================
// INLINE STYLE GENERATORS
// =============================================================================

/**
 * Get inline styles for a premium card (for Bootstrap/Odoo templates)
 */
export function getCardInlineStyles(variant: 'light' | 'dark' | 'glass' = 'light'): string {
  const base = `border-radius: ${PREMIUM_RADIUS.cardLarge}; padding: 2rem; transition: all ${PREMIUM_DURATION.slow} ${PREMIUM_EASING.card}`;

  if (variant === 'light') {
    return `${base}; background: #ffffff; box-shadow: ${PREMIUM_SHADOWS.premium.md}`;
  }
  if (variant === 'dark') {
    return `${base}; background: ${PREMIUM_COLORS.dark.surface}; color: #ffffff`;
  }
  // glass
  return `${base}; background: ${PREMIUM_GLASS.card.background}; backdrop-filter: ${PREMIUM_GLASS.card.backdrop}; -webkit-backdrop-filter: ${PREMIUM_GLASS.card.backdrop}; border: 1px solid ${PREMIUM_GLASS.card.border}; color: #ffffff`;
}

/**
 * Get inline styles for a gradient CTA button
 */
export function getButtonInlineStyles(
  gradient: keyof typeof PREMIUM_GRADIENTS.cta = 'primary'
): string {
  return `display: inline-flex; align-items: center; gap: 0.5rem; padding: 1rem 2rem; background: ${PREMIUM_GRADIENTS.cta[gradient]}; color: #ffffff; font-weight: ${PREMIUM_TYPOGRAPHY.fontWeight.semibold}; border: none; border-radius: ${PREMIUM_RADIUS.buttonPill}; cursor: pointer; box-shadow: ${PREMIUM_SHADOWS.colored.primary}; transition: all ${PREMIUM_DURATION.slow} ${PREMIUM_EASING.spring}`;
}

/**
 * Get inline styles for a glass button
 */
export function getGlassButtonInlineStyles(): string {
  return `display: inline-flex; align-items: center; gap: 0.5rem; padding: 1rem 1.5rem; background: ${PREMIUM_GLASS.dark.backgroundSubtle}; backdrop-filter: ${PREMIUM_GLASS.dark.backdropBlur}; -webkit-backdrop-filter: ${PREMIUM_GLASS.dark.backdropBlur}; border: 1px solid ${PREMIUM_GLASS.dark.border}; border-radius: ${PREMIUM_RADIUS.buttonPill}; color: #ffffff; font-weight: ${PREMIUM_TYPOGRAPHY.fontWeight.medium}; cursor: pointer; transition: all ${PREMIUM_DURATION.normal} ease`;
}

/**
 * Get inline styles for hero headline
 */
export function getHeadlineInlineStyles(): string {
  return `font-size: ${PREMIUM_TYPOGRAPHY.fontSize['6xl']}; font-weight: ${PREMIUM_TYPOGRAPHY.fontWeight.extrabold}; line-height: ${PREMIUM_TYPOGRAPHY.lineHeight.tight}; letter-spacing: ${PREMIUM_TYPOGRAPHY.letterSpacing.tighter}`;
}

/**
 * Get inline styles for hero section background
 */
export function getHeroBackgroundInlineStyles(
  gradient: keyof typeof PREMIUM_GRADIENTS.hero = 'dark'
): string {
  return `min-height: 100vh; background: ${PREMIUM_GRADIENTS.hero[gradient]}; position: relative; overflow: hidden`;
}

/**
 * Get inline styles for mesh overlay
 */
export function getMeshOverlayInlineStyles(
  mesh: keyof typeof PREMIUM_GRADIENTS.mesh = 'standard'
): string {
  return `position: absolute; inset: 0; background: ${PREMIUM_GRADIENTS.mesh[mesh]}; pointer-events: none`;
}

// =============================================================================
// EXPORTS
// =============================================================================

export const PREMIUM_TOKENS = {
  colors: PREMIUM_COLORS,
  gradients: PREMIUM_GRADIENTS,
  shadows: PREMIUM_SHADOWS,
  glass: PREMIUM_GLASS,
  typography: PREMIUM_TYPOGRAPHY,
  spacing: PREMIUM_SPACING,
  radius: PREMIUM_RADIUS,
  easing: PREMIUM_EASING,
  duration: PREMIUM_DURATION,
} as const;

export default PREMIUM_TOKENS;
