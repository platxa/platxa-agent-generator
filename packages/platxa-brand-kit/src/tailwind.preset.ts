/**
 * Platxa Tailwind CSS v4 Preset
 *
 * Integrates Platxa design tokens with Tailwind CSS v4.
 * Provides theme configuration for colors, typography, and spacing.
 *
 * Usage:
 * ```ts
 * // tailwind.config.ts
 * import platxaPreset from "@platxa/brand-kit/tailwind";
 *
 * export default {
 *   presets: [platxaPreset],
 *   // ...
 * };
 * ```
 *
 * @platxa/brand-kit
 * DJ Patel | Founder & CEO @ Platxa
 */

import type { Config } from "tailwindcss";

/**
 * Platxa color palette with 12-step scales
 */
const colors = {
  // Purple - Primary brand color
  purple: {
    1: "var(--purple-1)",
    2: "var(--purple-2)",
    3: "var(--purple-3)",
    4: "var(--purple-4)",
    5: "var(--purple-5)",
    6: "var(--purple-6)",
    7: "var(--purple-7)",
    8: "var(--purple-8)",
    9: "var(--purple-9)",
    10: "var(--purple-10)",
    11: "var(--purple-11)",
    12: "var(--purple-12)",
  },

  // Teal - Accent brand color
  teal: {
    1: "var(--teal-1)",
    2: "var(--teal-2)",
    3: "var(--teal-3)",
    4: "var(--teal-4)",
    5: "var(--teal-5)",
    6: "var(--teal-6)",
    7: "var(--teal-7)",
    8: "var(--teal-8)",
    9: "var(--teal-9)",
    10: "var(--teal-10)",
    11: "var(--teal-11)",
    12: "var(--teal-12)",
  },

  // Gray - Neutral with purple tint
  gray: {
    1: "var(--gray-1)",
    2: "var(--gray-2)",
    3: "var(--gray-3)",
    4: "var(--gray-4)",
    5: "var(--gray-5)",
    6: "var(--gray-6)",
    7: "var(--gray-7)",
    8: "var(--gray-8)",
    9: "var(--gray-9)",
    10: "var(--gray-10)",
    11: "var(--gray-11)",
    12: "var(--gray-12)",
  },

  // Semantic colors
  background: "var(--background)",
  foreground: "var(--foreground)",
  primary: {
    DEFAULT: "var(--primary)",
    hover: "var(--primary-hover)",
    active: "var(--primary-active)",
    foreground: "var(--primary-foreground)",
    subtle: "var(--primary-subtle)",
    muted: "var(--primary-muted)",
  },
  accent: {
    DEFAULT: "var(--accent)",
    hover: "var(--accent-hover)",
    active: "var(--accent-active)",
    foreground: "var(--accent-foreground)",
    subtle: "var(--accent-subtle)",
    muted: "var(--accent-muted)",
  },
  muted: {
    DEFAULT: "var(--muted)",
    hover: "var(--muted-hover)",
    foreground: "var(--muted-foreground)",
  },
  card: {
    DEFAULT: "var(--card)",
    hover: "var(--card-hover)",
    foreground: "var(--card-foreground)",
  },
  popover: {
    DEFAULT: "var(--popover)",
    foreground: "var(--popover-foreground)",
  },
  border: "var(--border)",
  input: "var(--input)",
  ring: "var(--ring)",

  // Feedback colors
  destructive: {
    DEFAULT: "var(--destructive)",
    hover: "var(--destructive-hover)",
    foreground: "var(--destructive-foreground)",
  },
  success: {
    DEFAULT: "var(--success)",
    hover: "var(--success-hover)",
    foreground: "var(--success-foreground)",
  },
  warning: {
    DEFAULT: "var(--warning)",
    hover: "var(--warning-hover)",
    foreground: "var(--warning-foreground)",
  },
  info: {
    DEFAULT: "var(--info)",
    hover: "var(--info-hover)",
    foreground: "var(--info-foreground)",
  },
};

/**
 * Typography configuration
 */
const fontFamily = {
  sans: "var(--font-sans)",
  mono: "var(--font-mono)",
  display: "var(--font-display)",
};

const fontSize = {
  xs: ["var(--text-xs)", { lineHeight: "var(--leading-normal)" }],
  sm: ["var(--text-sm)", { lineHeight: "var(--leading-normal)" }],
  base: ["var(--text-base)", { lineHeight: "var(--leading-normal)" }],
  lg: ["var(--text-lg)", { lineHeight: "var(--leading-relaxed)" }],
  xl: ["var(--text-xl)", { lineHeight: "var(--leading-snug)" }],
  "2xl": ["var(--text-2xl)", { lineHeight: "var(--leading-snug)" }],
  "3xl": ["var(--text-3xl)", { lineHeight: "var(--leading-tight)" }],
  "4xl": ["var(--text-4xl)", { lineHeight: "var(--leading-tight)" }],
  "5xl": ["var(--text-5xl)", { lineHeight: "var(--leading-tight)" }],
  "6xl": ["var(--text-6xl)", { lineHeight: "var(--leading-none)" }],
  "7xl": ["var(--text-7xl)", { lineHeight: "var(--leading-none)" }],
} as const;

/**
 * Spacing scale (8px grid)
 */
const spacing = {
  px: "1px",
  0: "0",
  0.5: "var(--space-0-5)",
  1: "var(--space-1)",
  1.5: "var(--space-1-5)",
  2: "var(--space-2)",
  2.5: "var(--space-2-5)",
  3: "var(--space-3)",
  3.5: "var(--space-3-5)",
  4: "var(--space-4)",
  5: "var(--space-5)",
  6: "var(--space-6)",
  7: "var(--space-7)",
  8: "var(--space-8)",
  9: "var(--space-9)",
  10: "var(--space-10)",
  11: "var(--space-11)",
  12: "var(--space-12)",
  14: "var(--space-14)",
  16: "var(--space-16)",
  20: "var(--space-20)",
  24: "var(--space-24)",
  28: "var(--space-28)",
  32: "var(--space-32)",
  36: "var(--space-36)",
  40: "var(--space-40)",
  44: "var(--space-44)",
  48: "var(--space-48)",
  52: "var(--space-52)",
  56: "var(--space-56)",
  60: "var(--space-60)",
  64: "var(--space-64)",
  72: "var(--space-72)",
  80: "var(--space-80)",
  96: "var(--space-96)",
};

/**
 * Border radius
 */
const borderRadius = {
  none: "var(--radius-none)",
  sm: "var(--radius-sm)",
  DEFAULT: "var(--radius-default)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  xl: "var(--radius-xl)",
  "2xl": "var(--radius-2xl)",
  "3xl": "var(--radius-3xl)",
  full: "var(--radius-full)",
};

/**
 * Container max-widths
 */
const containers = {
  sm: "var(--container-sm)",
  md: "var(--container-md)",
  lg: "var(--container-lg)",
  xl: "var(--container-xl)",
  "2xl": "var(--container-2xl)",
};

/**
 * Platxa Tailwind CSS Preset
 */
const platxaPreset: Partial<Config> = {
  theme: {
    colors,
    fontFamily,
    fontSize,
    spacing,
    borderRadius,
    container: {
      center: true,
      padding: {
        DEFAULT: "var(--container-padding-sm)",
        sm: "var(--container-padding-sm)",
        lg: "var(--container-padding-md)",
        xl: "var(--container-padding-lg)",
      },
      screens: containers,
    },
    extend: {
      // Ring configuration for focus states
      ringColor: {
        DEFAULT: "var(--ring)",
      },
      ringOffsetColor: {
        DEFAULT: "var(--ring-offset)",
      },

      // Animation durations
      transitionDuration: {
        fast: "150ms",
        normal: "200ms",
        slow: "300ms",
      },

      // Prose max-width
      maxWidth: {
        prose: "var(--prose-width)",
        "prose-wide": "var(--prose-width-wide)",
      },

      // Z-index scale
      zIndex: {
        dropdown: "1000",
        sticky: "1100",
        fixed: "1200",
        "modal-backdrop": "1300",
        modal: "1400",
        popover: "1500",
        tooltip: "1600",
      },
    },
  },
};

export default platxaPreset;

// Named export for ESM compatibility
export { platxaPreset };
