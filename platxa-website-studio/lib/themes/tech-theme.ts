/**
 * Tech Theme
 *
 * A dark, sophisticated theme with accent colors and mono fonts.
 * Perfect for developer tools, SaaS platforms, and tech companies.
 *
 * Characteristics:
 * - Dark backgrounds with high contrast
 * - Neon accent colors (cyan, purple, green)
 * - Monospace typography emphasis
 * - Sharp, precise design elements
 * - Terminal-inspired aesthetics
 * - Subtle glow effects
 *
 * Feature #64: Theme System - Tech theme template
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
  surfaceActive: string;
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
  code: string;
  codeBackground: string;
}

/** Typography settings */
export interface ThemeTypography {
  fontFamily: string;
  fontFamilyHeading: string;
  fontFamilyMono: string;
  fontSize: Record<string, string>;
  fontWeight: Record<string, number>;
  lineHeight: Record<string, number>;
  letterSpacing: Record<string, string>;
}

/** Border radius settings */
export interface ThemeBorderRadius {
  none: string;
  sm: string;
  default: string;
  md: string;
  lg: string;
  xl: string;
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
  glow: string;
  glowPrimary: string;
  glowAccent: string;
  inset: string;
}

/** Animation settings */
export interface ThemeAnimations {
  duration: Record<string, string>;
  easing: Record<string, string>;
  keyframes: Record<string, Record<string, Record<string, string>>>;
}

/** Component styles */
export interface ThemeComponents {
  button: ComponentStyle;
  input: ComponentStyle;
  card: ComponentStyle;
  badge: ComponentStyle;
  code: ComponentStyle;
  terminal: ComponentStyle;
  tooltip: ComponentStyle;
}

/** Component style definition */
export interface ComponentStyle {
  base: string;
  variants: Record<string, string>;
  sizes: Record<string, string>;
  states: Record<string, string>;
}

/** Complete theme */
export interface TechTheme {
  name: string;
  description: string;
  version: string;
  colors: ThemeColors;
  colorsLight: ThemeColors;
  colorsDark: ThemeColors;
  typography: ThemeTypography;
  borderRadius: ThemeBorderRadius;
  shadows: ThemeShadows;
  animations: ThemeAnimations;
  components: ThemeComponents;
}

// =============================================================================
// Theme Definition
// =============================================================================

/** Dark mode colors (primary mode for tech theme) */
const colorsDark: ThemeColors = {
  primary: "#00D9FF",          // Electric cyan
  primaryLight: "#5CEBFF",
  primaryDark: "#00A8C6",
  secondary: "#A855F7",        // Vibrant purple
  secondaryLight: "#C084FC",
  secondaryDark: "#7C3AED",
  accent: "#10B981",           // Terminal green
  accentLight: "#34D399",
  background: "#0A0A0F",       // Near black
  backgroundAlt: "#12121A",
  surface: "#1A1A24",
  surfaceHover: "#24242F",
  surfaceActive: "#2D2D3A",
  text: "#E4E4E7",
  textMuted: "#71717A",
  textOnPrimary: "#0A0A0F",
  textOnSecondary: "#FFFFFF",
  border: "#27272A",
  borderFocus: "#00D9FF",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
  code: "#10B981",
  codeBackground: "#0D1117",
};

/** Light mode colors (alternative) */
const colorsLight: ThemeColors = {
  primary: "#0891B2",          // Darker cyan for light bg
  primaryLight: "#22D3EE",
  primaryDark: "#0E7490",
  secondary: "#7C3AED",        // Purple
  secondaryLight: "#A78BFA",
  secondaryDark: "#6D28D9",
  accent: "#059669",           // Green
  accentLight: "#10B981",
  background: "#FAFAFA",
  backgroundAlt: "#F4F4F5",
  surface: "#FFFFFF",
  surfaceHover: "#F4F4F5",
  surfaceActive: "#E4E4E7",
  text: "#18181B",
  textMuted: "#71717A",
  textOnPrimary: "#FFFFFF",
  textOnSecondary: "#FFFFFF",
  border: "#E4E4E7",
  borderFocus: "#0891B2",
  success: "#059669",
  warning: "#D97706",
  error: "#DC2626",
  info: "#2563EB",
  code: "#059669",
  codeBackground: "#F4F4F5",
};

/** Typography - mono-focused */
const typography: ThemeTypography = {
  fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
  fontFamilyHeading: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
  fontFamilyMono: "'JetBrains Mono', 'Fira Code', 'SF Mono', 'Menlo', monospace",
  fontSize: {
    xs: "0.75rem",     // 12px
    sm: "0.8125rem",   // 13px
    base: "0.875rem",  // 14px - slightly smaller for tech feel
    lg: "1rem",        // 16px
    xl: "1.125rem",    // 18px
    "2xl": "1.25rem",  // 20px
    "3xl": "1.5rem",   // 24px
    "4xl": "2rem",     // 32px
    "5xl": "2.5rem",   // 40px
    "6xl": "3rem",     // 48px
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
    code: 1.6,
  },
  letterSpacing: {
    tighter: "-0.05em",
    tight: "-0.025em",
    normal: "0",
    wide: "0.025em",
    wider: "0.05em",
    mono: "0.02em",
  },
};

/** Border radius - sharp/minimal */
const borderRadius: ThemeBorderRadius = {
  none: "0",
  sm: "0.125rem",    // 2px
  default: "0.25rem", // 4px
  md: "0.375rem",    // 6px
  lg: "0.5rem",      // 8px
  xl: "0.75rem",     // 12px
  full: "9999px",
};

/** Shadows - subtle with glows */
const shadows: ThemeShadows = {
  none: "none",
  sm: "0 1px 2px rgba(0, 0, 0, 0.5)",
  default: "0 2px 4px rgba(0, 0, 0, 0.5)",
  md: "0 4px 8px rgba(0, 0, 0, 0.5)",
  lg: "0 8px 16px rgba(0, 0, 0, 0.5)",
  xl: "0 16px 32px rgba(0, 0, 0, 0.5)",
  glow: "0 0 20px rgba(0, 217, 255, 0.3)",
  glowPrimary: "0 0 30px rgba(0, 217, 255, 0.4)",
  glowAccent: "0 0 20px rgba(16, 185, 129, 0.4)",
  inset: "inset 0 1px 2px rgba(0, 0, 0, 0.5)",
};

/** Animations - subtle, precise */
const animations: ThemeAnimations = {
  duration: {
    instant: "50ms",
    fast: "100ms",
    normal: "200ms",
    slow: "300ms",
  },
  easing: {
    default: "cubic-bezier(0.4, 0, 0.2, 1)",
    in: "cubic-bezier(0.4, 0, 1, 1)",
    out: "cubic-bezier(0, 0, 0.2, 1)",
    inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
    sharp: "cubic-bezier(0.4, 0, 0.6, 1)",
  },
  keyframes: {
    pulse: {
      "0%, 100%": { opacity: "1" },
      "50%": { opacity: "0.5" },
    },
    blink: {
      "0%, 100%": { opacity: "1" },
      "50%": { opacity: "0" },
    },
    scanline: {
      "0%": { transform: "translateY(-100%)" },
      "100%": { transform: "translateY(100%)" },
    },
    typing: {
      "0%": { width: "0" },
      "100%": { width: "100%" },
    },
    glow: {
      "0%, 100%": { boxShadow: "0 0 5px var(--color-primary)" },
      "50%": { boxShadow: "0 0 20px var(--color-primary), 0 0 30px var(--color-primary)" },
    },
  },
};

/** Component styles */
const components: ThemeComponents = {
  button: {
    base: `
      font-family: var(--font-mono);
      font-weight: 500;
      font-size: var(--text-sm);
      border-radius: var(--radius-default);
      transition: all var(--duration-fast) var(--easing-sharp);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
      border: 1px solid transparent;
    `,
    variants: {
      primary: `
        background: var(--color-primary);
        color: var(--color-text-on-primary);
        border-color: var(--color-primary);
      `,
      secondary: `
        background: transparent;
        color: var(--color-primary);
        border-color: var(--color-primary);
      `,
      ghost: `
        background: transparent;
        color: var(--color-text);
        border-color: var(--color-border);
      `,
      danger: `
        background: var(--color-error);
        color: white;
        border-color: var(--color-error);
      `,
      terminal: `
        background: var(--color-code-background);
        color: var(--color-accent);
        border-color: var(--color-accent);
        font-family: var(--font-mono);
      `,
    },
    sizes: {
      xs: "padding: 0.25rem 0.5rem; font-size: var(--text-xs);",
      sm: "padding: 0.375rem 0.75rem; font-size: var(--text-xs);",
      md: "padding: 0.5rem 1rem; font-size: var(--text-sm);",
      lg: "padding: 0.625rem 1.25rem; font-size: var(--text-base);",
    },
    states: {
      hover: `
        filter: brightness(1.1);
        box-shadow: var(--shadow-glow);
      `,
      active: `
        filter: brightness(0.9);
        transform: translateY(1px);
      `,
      disabled: `
        opacity: 0.5;
        cursor: not-allowed;
      `,
      focus: `
        outline: none;
        box-shadow: 0 0 0 2px var(--color-background), 0 0 0 4px var(--color-primary);
      `,
    },
  },
  input: {
    base: `
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      border-radius: var(--radius-default);
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text);
      padding: 0.5rem 0.75rem;
      transition: all var(--duration-fast) var(--easing-default);
    `,
    variants: {
      default: "",
      terminal: `
        background: var(--color-code-background);
        color: var(--color-accent);
        border-color: var(--color-border);
        font-family: var(--font-mono);
      `,
    },
    sizes: {
      sm: "padding: 0.375rem 0.5rem; font-size: var(--text-xs);",
      md: "padding: 0.5rem 0.75rem; font-size: var(--text-sm);",
      lg: "padding: 0.625rem 1rem; font-size: var(--text-base);",
    },
    states: {
      focus: `
        border-color: var(--color-primary);
        box-shadow: 0 0 0 1px var(--color-primary), var(--shadow-glow);
        outline: none;
      `,
      error: `
        border-color: var(--color-error);
        box-shadow: 0 0 0 1px var(--color-error);
      `,
    },
  },
  card: {
    base: `
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      overflow: hidden;
      transition: all var(--duration-normal) var(--easing-default);
    `,
    variants: {
      default: "",
      elevated: `
        box-shadow: var(--shadow-lg);
        border-color: transparent;
      `,
      terminal: `
        background: var(--color-code-background);
        border-color: var(--color-border);
        font-family: var(--font-mono);
      `,
      glass: `
        background: rgba(26, 26, 36, 0.8);
        backdrop-filter: blur(12px);
        border-color: rgba(255, 255, 255, 0.1);
      `,
    },
    sizes: {
      sm: "padding: 0.75rem;",
      md: "padding: 1rem;",
      lg: "padding: 1.5rem;",
    },
    states: {
      hover: `
        border-color: var(--color-primary);
        box-shadow: var(--shadow-glow);
      `,
    },
  },
  badge: {
    base: `
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
      padding: 0.125rem 0.5rem;
      border-radius: var(--radius-sm);
      border: 1px solid;
    `,
    variants: {
      default: "background: var(--color-surface); color: var(--color-text); border-color: var(--color-border);",
      primary: "background: rgba(0, 217, 255, 0.15); color: var(--color-primary); border-color: var(--color-primary);",
      secondary: "background: rgba(168, 85, 247, 0.15); color: var(--color-secondary); border-color: var(--color-secondary);",
      success: "background: rgba(16, 185, 129, 0.15); color: var(--color-success); border-color: var(--color-success);",
      warning: "background: rgba(245, 158, 11, 0.15); color: var(--color-warning); border-color: var(--color-warning);",
      error: "background: rgba(239, 68, 68, 0.15); color: var(--color-error); border-color: var(--color-error);",
    },
    sizes: {
      sm: "padding: 0.0625rem 0.375rem; font-size: 0.625rem;",
      md: "padding: 0.125rem 0.5rem; font-size: var(--text-xs);",
      lg: "padding: 0.25rem 0.625rem; font-size: var(--text-sm);",
    },
    states: {},
  },
  code: {
    base: `
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      line-height: var(--leading-code);
      background: var(--color-code-background);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-default);
      padding: 0.125rem 0.375rem;
      color: var(--color-code);
    `,
    variants: {
      inline: "display: inline; padding: 0.125rem 0.375rem;",
      block: `
        display: block;
        padding: 1rem;
        overflow-x: auto;
        white-space: pre;
      `,
    },
    sizes: {},
    states: {},
  },
  terminal: {
    base: `
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      line-height: var(--leading-code);
      background: var(--color-code-background);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      color: var(--color-accent);
      overflow: hidden;
    `,
    variants: {
      default: "",
      withHeader: `
        &::before {
          content: '';
          display: flex;
          align-items: center;
          padding: 0.5rem 1rem;
          background: var(--color-surface);
          border-bottom: 1px solid var(--color-border);
        }
      `,
    },
    sizes: {
      sm: "min-height: 200px;",
      md: "min-height: 300px;",
      lg: "min-height: 400px;",
      full: "height: 100%;",
    },
    states: {},
  },
  tooltip: {
    base: `
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      background: var(--color-surface);
      color: var(--color-text);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-default);
      padding: 0.375rem 0.625rem;
      box-shadow: var(--shadow-md);
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
 * Tech Theme
 *
 * A dark, sophisticated theme for developer tools and tech products.
 */
export const techTheme: TechTheme = {
  name: "Tech",
  description: "Dark mode, accent colors, and mono fonts for a technical feel",
  version: "1.0.0",
  colors: colorsDark, // Dark is the primary mode
  colorsLight,
  colorsDark,
  typography,
  borderRadius,
  shadows,
  animations,
  components,
};

/**
 * Generate CSS custom properties from theme
 */
export function generateCssVariables(theme: TechTheme, mode: "light" | "dark" = "dark"): string {
  const colors = mode === "dark" ? theme.colorsDark : theme.colorsLight;

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
  --color-surface-active: ${colors.surfaceActive};
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
  --color-code: ${colors.code};
  --color-code-background: ${colors.codeBackground};

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
  --text-6xl: ${theme.typography.fontSize["6xl"]};
  --tracking-tighter: ${theme.typography.letterSpacing.tighter};
  --tracking-tight: ${theme.typography.letterSpacing.tight};
  --tracking-normal: ${theme.typography.letterSpacing.normal};
  --tracking-wide: ${theme.typography.letterSpacing.wide};
  --tracking-wider: ${theme.typography.letterSpacing.wider};
  --tracking-mono: ${theme.typography.letterSpacing.mono};
  --leading-tight: ${theme.typography.lineHeight.tight};
  --leading-normal: ${theme.typography.lineHeight.normal};
  --leading-relaxed: ${theme.typography.lineHeight.relaxed};
  --leading-code: ${theme.typography.lineHeight.code};

  /* Border Radius */
  --radius-none: ${theme.borderRadius.none};
  --radius-sm: ${theme.borderRadius.sm};
  --radius-default: ${theme.borderRadius.default};
  --radius-md: ${theme.borderRadius.md};
  --radius-lg: ${theme.borderRadius.lg};
  --radius-xl: ${theme.borderRadius.xl};
  --radius-full: ${theme.borderRadius.full};

  /* Shadows */
  --shadow-sm: ${theme.shadows.sm};
  --shadow-default: ${theme.shadows.default};
  --shadow-md: ${theme.shadows.md};
  --shadow-lg: ${theme.shadows.lg};
  --shadow-xl: ${theme.shadows.xl};
  --shadow-glow: ${theme.shadows.glow};
  --shadow-glow-primary: ${theme.shadows.glowPrimary};
  --shadow-glow-accent: ${theme.shadows.glowAccent};
  --shadow-inset: ${theme.shadows.inset};

  /* Animation */
  --duration-instant: ${theme.animations.duration.instant};
  --duration-fast: ${theme.animations.duration.fast};
  --duration-normal: ${theme.animations.duration.normal};
  --duration-slow: ${theme.animations.duration.slow};
  --easing-default: ${theme.animations.easing.default};
  --easing-sharp: ${theme.animations.easing.sharp};
}
`.trim();
}

/**
 * Get theme colors for mode
 */
export function getThemeColors(mode: "light" | "dark"): ThemeColors {
  return mode === "dark" ? colorsDark : colorsLight;
}

/**
 * Get syntax highlighting colors for code blocks
 */
export function getSyntaxColors(): Record<string, string> {
  return {
    comment: "#6A737D",
    keyword: "#FF7B72",
    string: "#A5D6FF",
    number: "#79C0FF",
    function: "#D2A8FF",
    variable: "#FFA657",
    operator: "#FF7B72",
    punctuation: "#8B949E",
    property: "#79C0FF",
    class: "#FFA657",
    constant: "#79C0FF",
    boolean: "#FF7B72",
    null: "#FF7B72",
    tag: "#7EE787",
    attribute: "#79C0FF",
  };
}

export default techTheme;
