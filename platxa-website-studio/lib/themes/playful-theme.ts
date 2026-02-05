/**
 * Playful Theme
 *
 * A bright, energetic theme with vibrant colors, rounded corners, and fun typography.
 * Perfect for creative brands, kids' products, games, and entertainment websites.
 *
 * Characteristics:
 * - Bright, saturated colors (pinks, yellows, teals)
 * - Large rounded corners and pill shapes
 * - Playful, bouncy animations
 * - Fun, friendly typography
 * - Soft shadows and gradients
 * - Emoji-friendly design
 *
 * Feature #63: Theme System - Playful theme template
 */

// =============================================================================
// Types
// =============================================================================

/** Theme color palette */
export interface ThemeColors {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  secondaryLight: string;
  secondaryDark: string;
  accent: string;
  accentLight: string;
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceHover: string;
  text: string;
  textMuted: string;
  textOnPrimary: string;
  textOnSecondary: string;
  border: string;
  borderFocus: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

/** Typography settings */
export interface ThemeTypography {
  fontFamily: string;
  fontFamilyHeading: string;
  fontFamilyMono: string;
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    "2xl": string;
    "3xl": string;
    "4xl": string;
    "5xl": string;
  };
  fontWeight: {
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
    extrabold: number;
  };
  lineHeight: {
    tight: number;
    normal: number;
    relaxed: number;
  };
  letterSpacing: {
    tight: string;
    normal: string;
    wide: string;
  };
}

/** Spacing scale */
export interface ThemeSpacing {
  px: string;
  0: string;
  1: string;
  2: string;
  3: string;
  4: string;
  5: string;
  6: string;
  8: string;
  10: string;
  12: string;
  16: string;
  20: string;
  24: string;
  32: string;
  40: string;
  48: string;
  64: string;
}

/** Border radius settings */
export interface ThemeBorderRadius {
  none: string;
  sm: string;
  default: string;
  md: string;
  lg: string;
  xl: string;
  "2xl": string;
  "3xl": string;
  full: string;
}

/** Shadow definitions */
export interface ThemeShadows {
  none: string;
  sm: string;
  default: string;
  md: string;
  lg: string;
  xl: string;
  "2xl": string;
  inner: string;
  glow: string;
  glowPrimary: string;
  glowSecondary: string;
}

/** Animation settings */
export interface ThemeAnimations {
  duration: {
    fast: string;
    normal: string;
    slow: string;
  };
  easing: {
    default: string;
    in: string;
    out: string;
    inOut: string;
    bounce: string;
    elastic: string;
  };
  keyframes: Record<string, Record<string, Record<string, string>>>;
}

/** Complete theme definition */
export interface PlayfulTheme {
  name: string;
  description: string;
  version: string;
  colors: ThemeColors;
  colorsLight: ThemeColors;
  colorsDark: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  borderRadius: ThemeBorderRadius;
  shadows: ThemeShadows;
  animations: ThemeAnimations;
  components: ThemeComponents;
}

/** Component-specific styles */
export interface ThemeComponents {
  button: ComponentStyle;
  input: ComponentStyle;
  card: ComponentStyle;
  badge: ComponentStyle;
  alert: ComponentStyle;
  modal: ComponentStyle;
  tooltip: ComponentStyle;
  dropdown: ComponentStyle;
}

/** Component style definition */
export interface ComponentStyle {
  base: string;
  variants: Record<string, string>;
  sizes: Record<string, string>;
  states: Record<string, string>;
}

// =============================================================================
// Theme Definition
// =============================================================================

/** Light mode colors */
const colorsLight: ThemeColors = {
  primary: "#FF6B9D",          // Bright pink
  primaryLight: "#FF9EC4",
  primaryDark: "#E84A7F",
  secondary: "#00D4AA",        // Vibrant teal
  secondaryLight: "#4DFFDB",
  secondaryDark: "#00A888",
  accent: "#FFD93D",           // Sunny yellow
  accentLight: "#FFE87A",
  background: "#FFFBF5",       // Warm cream
  backgroundAlt: "#FFF5EB",
  surface: "#FFFFFF",
  surfaceHover: "#FFF0E6",
  text: "#2D3436",
  textMuted: "#636E72",
  textOnPrimary: "#FFFFFF",
  textOnSecondary: "#FFFFFF",
  border: "#FFE0CC",
  borderFocus: "#FF6B9D",
  success: "#00B894",
  warning: "#FDCB6E",
  error: "#FF7675",
  info: "#74B9FF",
};

/** Dark mode colors */
const colorsDark: ThemeColors = {
  primary: "#FF8FB4",          // Softer pink for dark mode
  primaryLight: "#FFADC9",
  primaryDark: "#FF6B9D",
  secondary: "#2EE5BC",        // Brighter teal
  secondaryLight: "#6DFFE0",
  secondaryDark: "#00D4AA",
  accent: "#FFE066",           // Softer yellow
  accentLight: "#FFEB99",
  background: "#1A1625",       // Deep purple-black
  backgroundAlt: "#252033",
  surface: "#2D2640",
  surfaceHover: "#3D3455",
  text: "#F8F9FA",
  textMuted: "#B2BEC3",
  textOnPrimary: "#1A1625",
  textOnSecondary: "#1A1625",
  border: "#4A4260",
  borderFocus: "#FF8FB4",
  success: "#55EFC4",
  warning: "#FFEAA7",
  error: "#FF8B8B",
  info: "#A3D8FF",
};

/** Typography configuration */
const typography: ThemeTypography = {
  fontFamily: "'Nunito', 'Comic Neue', 'Quicksand', system-ui, sans-serif",
  fontFamilyHeading: "'Baloo 2', 'Fredoka One', 'Nunito', sans-serif",
  fontFamilyMono: "'JetBrains Mono', 'Fira Code', monospace",
  fontSize: {
    xs: "0.75rem",     // 12px
    sm: "0.875rem",    // 14px
    base: "1rem",      // 16px
    lg: "1.125rem",    // 18px
    xl: "1.25rem",     // 20px
    "2xl": "1.5rem",   // 24px
    "3xl": "2rem",     // 32px
    "4xl": "2.5rem",   // 40px
    "5xl": "3.5rem",   // 56px
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.6,
    relaxed: 1.8,
  },
  letterSpacing: {
    tight: "-0.02em",
    normal: "0",
    wide: "0.02em",
  },
};

/** Spacing scale */
const spacing: ThemeSpacing = {
  px: "1px",
  0: "0",
  1: "0.25rem",   // 4px
  2: "0.5rem",    // 8px
  3: "0.75rem",   // 12px
  4: "1rem",      // 16px
  5: "1.25rem",   // 20px
  6: "1.5rem",    // 24px
  8: "2rem",      // 32px
  10: "2.5rem",   // 40px
  12: "3rem",     // 48px
  16: "4rem",     // 64px
  20: "5rem",     // 80px
  24: "6rem",     // 96px
  32: "8rem",     // 128px
  40: "10rem",    // 160px
  48: "12rem",    // 192px
  64: "16rem",    // 256px
};

/** Border radius - extra rounded for playful feel */
const borderRadius: ThemeBorderRadius = {
  none: "0",
  sm: "0.5rem",     // 8px - more rounded than typical
  default: "0.75rem", // 12px
  md: "1rem",       // 16px
  lg: "1.5rem",     // 24px
  xl: "2rem",       // 32px
  "2xl": "2.5rem",  // 40px
  "3xl": "3rem",    // 48px
  full: "9999px",   // Pill shape
};

/** Shadow definitions - soft, colorful glows */
const shadows: ThemeShadows = {
  none: "none",
  sm: "0 2px 8px rgba(255, 107, 157, 0.1)",
  default: "0 4px 12px rgba(255, 107, 157, 0.15)",
  md: "0 6px 20px rgba(255, 107, 157, 0.2)",
  lg: "0 10px 30px rgba(255, 107, 157, 0.25)",
  xl: "0 20px 50px rgba(255, 107, 157, 0.3)",
  "2xl": "0 25px 60px rgba(255, 107, 157, 0.35)",
  inner: "inset 0 2px 8px rgba(0, 0, 0, 0.1)",
  glow: "0 0 20px rgba(255, 217, 61, 0.5)",
  glowPrimary: "0 0 25px rgba(255, 107, 157, 0.6)",
  glowSecondary: "0 0 25px rgba(0, 212, 170, 0.6)",
};

/** Animation settings - bouncy and fun */
const animations: ThemeAnimations = {
  duration: {
    fast: "150ms",
    normal: "300ms",
    slow: "500ms",
  },
  easing: {
    default: "cubic-bezier(0.4, 0, 0.2, 1)",
    in: "cubic-bezier(0.4, 0, 1, 1)",
    out: "cubic-bezier(0, 0, 0.2, 1)",
    inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
    bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
    elastic: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
  },
  keyframes: {
    bounce: {
      "0%, 100%": { transform: "translateY(0)" },
      "50%": { transform: "translateY(-10px)" },
    },
    wiggle: {
      "0%, 100%": { transform: "rotate(-3deg)" },
      "50%": { transform: "rotate(3deg)" },
    },
    pop: {
      "0%": { transform: "scale(0.95)" },
      "50%": { transform: "scale(1.05)" },
      "100%": { transform: "scale(1)" },
    },
    float: {
      "0%, 100%": { transform: "translateY(0)" },
      "50%": { transform: "translateY(-5px)" },
    },
    shimmer: {
      "0%": { backgroundPosition: "-200% 0" },
      "100%": { backgroundPosition: "200% 0" },
    },
    confetti: {
      "0%": { transform: "translateY(0) rotate(0deg)", opacity: "1" },
      "100%": { transform: "translateY(100vh) rotate(720deg)", opacity: "0" },
    },
  },
};

/** Component-specific styles */
const components: ThemeComponents = {
  button: {
    base: `
      font-family: var(--font-heading);
      font-weight: 700;
      border-radius: var(--radius-full);
      transition: all var(--duration-normal) var(--easing-bounce);
      text-transform: none;
      letter-spacing: 0.02em;
    `,
    variants: {
      primary: `
        background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
        color: var(--color-text-on-primary);
        box-shadow: var(--shadow-md), 0 4px 0 var(--color-primary-dark);
      `,
      secondary: `
        background: linear-gradient(135deg, var(--color-secondary) 0%, var(--color-secondary-dark) 100%);
        color: var(--color-text-on-secondary);
        box-shadow: var(--shadow-md), 0 4px 0 var(--color-secondary-dark);
      `,
      outline: `
        background: transparent;
        border: 3px solid var(--color-primary);
        color: var(--color-primary);
      `,
      ghost: `
        background: transparent;
        color: var(--color-primary);
      `,
    },
    sizes: {
      sm: "padding: 0.5rem 1.25rem; font-size: var(--text-sm);",
      md: "padding: 0.75rem 1.75rem; font-size: var(--text-base);",
      lg: "padding: 1rem 2.5rem; font-size: var(--text-lg);",
      xl: "padding: 1.25rem 3rem; font-size: var(--text-xl);",
    },
    states: {
      hover: `
        transform: translateY(-3px);
        box-shadow: var(--shadow-lg), 0 6px 0 var(--color-primary-dark);
      `,
      active: `
        transform: translateY(0);
        box-shadow: var(--shadow-sm), 0 2px 0 var(--color-primary-dark);
      `,
      disabled: `
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      `,
    },
  },
  input: {
    base: `
      font-family: var(--font-body);
      border-radius: var(--radius-xl);
      border: 3px solid var(--color-border);
      background: var(--color-surface);
      padding: 0.875rem 1.25rem;
      transition: all var(--duration-normal) var(--easing-bounce);
    `,
    variants: {
      default: "",
      filled: `
        background: var(--color-background-alt);
        border-color: transparent;
      `,
    },
    sizes: {
      sm: "padding: 0.5rem 1rem; font-size: var(--text-sm);",
      md: "padding: 0.875rem 1.25rem; font-size: var(--text-base);",
      lg: "padding: 1rem 1.5rem; font-size: var(--text-lg);",
    },
    states: {
      focus: `
        border-color: var(--color-primary);
        box-shadow: 0 0 0 4px rgba(255, 107, 157, 0.2);
        outline: none;
      `,
      error: `
        border-color: var(--color-error);
        box-shadow: 0 0 0 4px rgba(255, 118, 117, 0.2);
      `,
    },
  },
  card: {
    base: `
      background: var(--color-surface);
      border-radius: var(--radius-2xl);
      border: 3px solid var(--color-border);
      box-shadow: var(--shadow-md);
      overflow: hidden;
      transition: all var(--duration-normal) var(--easing-bounce);
    `,
    variants: {
      default: "",
      elevated: `
        border: none;
        box-shadow: var(--shadow-lg);
      `,
      gradient: `
        background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-background-alt) 100%);
      `,
    },
    sizes: {
      sm: "padding: 1rem;",
      md: "padding: 1.5rem;",
      lg: "padding: 2rem;",
    },
    states: {
      hover: `
        transform: translateY(-5px) rotate(-1deg);
        box-shadow: var(--shadow-xl);
      `,
    },
  },
  badge: {
    base: `
      font-family: var(--font-heading);
      font-weight: 700;
      border-radius: var(--radius-full);
      padding: 0.25rem 0.875rem;
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    `,
    variants: {
      primary: "background: var(--color-primary); color: var(--color-text-on-primary);",
      secondary: "background: var(--color-secondary); color: var(--color-text-on-secondary);",
      accent: "background: var(--color-accent); color: var(--color-text);",
      success: "background: var(--color-success); color: white;",
      warning: "background: var(--color-warning); color: var(--color-text);",
      error: "background: var(--color-error); color: white;",
    },
    sizes: {
      sm: "padding: 0.125rem 0.5rem; font-size: 0.625rem;",
      md: "padding: 0.25rem 0.875rem; font-size: var(--text-xs);",
      lg: "padding: 0.375rem 1rem; font-size: var(--text-sm);",
    },
    states: {},
  },
  alert: {
    base: `
      border-radius: var(--radius-xl);
      padding: 1rem 1.5rem;
      border: 3px solid;
      display: flex;
      align-items: center;
      gap: 1rem;
    `,
    variants: {
      info: "background: rgba(116, 185, 255, 0.15); border-color: var(--color-info); color: var(--color-info);",
      success: "background: rgba(0, 184, 148, 0.15); border-color: var(--color-success); color: var(--color-success);",
      warning: "background: rgba(253, 203, 110, 0.15); border-color: var(--color-warning); color: var(--color-text);",
      error: "background: rgba(255, 118, 117, 0.15); border-color: var(--color-error); color: var(--color-error);",
    },
    sizes: {},
    states: {},
  },
  modal: {
    base: `
      background: var(--color-surface);
      border-radius: var(--radius-3xl);
      box-shadow: var(--shadow-2xl);
      padding: 2rem;
      max-width: 90vw;
      animation: pop var(--duration-normal) var(--easing-bounce);
    `,
    variants: {},
    sizes: {
      sm: "width: 400px;",
      md: "width: 560px;",
      lg: "width: 720px;",
      xl: "width: 900px;",
    },
    states: {},
  },
  tooltip: {
    base: `
      background: var(--color-text);
      color: var(--color-surface);
      border-radius: var(--radius-lg);
      padding: 0.5rem 1rem;
      font-size: var(--text-sm);
      font-weight: 600;
      box-shadow: var(--shadow-lg);
    `,
    variants: {},
    sizes: {},
    states: {},
  },
  dropdown: {
    base: `
      background: var(--color-surface);
      border-radius: var(--radius-xl);
      border: 3px solid var(--color-border);
      box-shadow: var(--shadow-xl);
      padding: 0.5rem;
      overflow: hidden;
      animation: pop var(--duration-fast) var(--easing-bounce);
    `,
    variants: {},
    sizes: {},
    states: {},
  },
};

// =============================================================================
// Theme Export
// =============================================================================

/**
 * Playful Theme
 *
 * A bright, energetic theme perfect for creative and fun applications.
 */
export const playfulTheme: PlayfulTheme = {
  name: "Playful",
  description: "Bright colors, rounded corners, and fun typography for an energetic feel",
  version: "1.0.0",
  colors: colorsLight,
  colorsLight,
  colorsDark,
  typography,
  spacing,
  borderRadius,
  shadows,
  animations,
  components,
};

/**
 * Generate CSS custom properties from theme
 */
export function generateCssVariables(theme: PlayfulTheme, mode: "light" | "dark" = "light"): string {
  const colors = mode === "light" ? theme.colorsLight : theme.colorsDark;

  return `
:root {
  /* Colors */
  --color-primary: ${colors.primary};
  --color-primary-light: ${colors.primaryLight};
  --color-primary-dark: ${colors.primaryDark};
  --color-secondary: ${colors.secondary};
  --color-secondary-light: ${colors.secondaryLight};
  --color-secondary-dark: ${colors.secondaryDark};
  --color-accent: ${colors.accent};
  --color-accent-light: ${colors.accentLight};
  --color-background: ${colors.background};
  --color-background-alt: ${colors.backgroundAlt};
  --color-surface: ${colors.surface};
  --color-surface-hover: ${colors.surfaceHover};
  --color-text: ${colors.text};
  --color-text-muted: ${colors.textMuted};
  --color-text-on-primary: ${colors.textOnPrimary};
  --color-text-on-secondary: ${colors.textOnSecondary};
  --color-border: ${colors.border};
  --color-border-focus: ${colors.borderFocus};
  --color-success: ${colors.success};
  --color-warning: ${colors.warning};
  --color-error: ${colors.error};
  --color-info: ${colors.info};

  /* Typography */
  --font-body: ${theme.typography.fontFamily};
  --font-heading: ${theme.typography.fontFamilyHeading};
  --font-mono: ${theme.typography.fontFamilyMono};
  --text-xs: ${theme.typography.fontSize.xs};
  --text-sm: ${theme.typography.fontSize.sm};
  --text-base: ${theme.typography.fontSize.base};
  --text-lg: ${theme.typography.fontSize.lg};
  --text-xl: ${theme.typography.fontSize.xl};
  --text-2xl: ${theme.typography.fontSize["2xl"]};
  --text-3xl: ${theme.typography.fontSize["3xl"]};
  --text-4xl: ${theme.typography.fontSize["4xl"]};
  --text-5xl: ${theme.typography.fontSize["5xl"]};

  /* Border Radius */
  --radius-none: ${theme.borderRadius.none};
  --radius-sm: ${theme.borderRadius.sm};
  --radius-default: ${theme.borderRadius.default};
  --radius-md: ${theme.borderRadius.md};
  --radius-lg: ${theme.borderRadius.lg};
  --radius-xl: ${theme.borderRadius.xl};
  --radius-2xl: ${theme.borderRadius["2xl"]};
  --radius-3xl: ${theme.borderRadius["3xl"]};
  --radius-full: ${theme.borderRadius.full};

  /* Shadows */
  --shadow-sm: ${theme.shadows.sm};
  --shadow-default: ${theme.shadows.default};
  --shadow-md: ${theme.shadows.md};
  --shadow-lg: ${theme.shadows.lg};
  --shadow-xl: ${theme.shadows.xl};
  --shadow-2xl: ${theme.shadows["2xl"]};
  --shadow-glow: ${theme.shadows.glow};
  --shadow-glow-primary: ${theme.shadows.glowPrimary};
  --shadow-glow-secondary: ${theme.shadows.glowSecondary};

  /* Animation */
  --duration-fast: ${theme.animations.duration.fast};
  --duration-normal: ${theme.animations.duration.normal};
  --duration-slow: ${theme.animations.duration.slow};
  --easing-default: ${theme.animations.easing.default};
  --easing-bounce: ${theme.animations.easing.bounce};
  --easing-elastic: ${theme.animations.easing.elastic};
}
`.trim();
}

/**
 * Get theme for mode
 */
export function getThemeColors(mode: "light" | "dark"): ThemeColors {
  return mode === "light" ? colorsLight : colorsDark;
}

export default playfulTheme;
