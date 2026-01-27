/**
 * Tailwind Transformer
 *
 * Transforms DesignTokenSet into Tailwind CSS configuration.
 * Supports both Tailwind v3 (theme.extend object) and v4 (@theme CSS block).
 */

import type {
  DesignTokenSet,
  ColorScaleToken,
  FluidTypeValue,
  ShadowLayerValue,
} from "./types";
import {
  COLOR_SCALE_STEPS,
  FONT_SIZE_KEYS,
  FONT_WEIGHT_KEYS,
  LINE_HEIGHT_KEYS,
  LETTER_SPACING_KEYS,
  DURATION_KEYS,
  EASING_KEYS,
} from "./types";

// =============================================================================
// Tailwind v3: theme.extend Object
// =============================================================================

/**
 * Generates a Tailwind v3 `theme.extend` configuration object from tokens.
 * This can be spread into tailwind.config.ts.
 *
 * @example
 * ```ts
 * // tailwind.config.ts
 * import { tokensToTailwindTheme } from "./lib/design-tokens";
 * export default {
 *   theme: { extend: tokensToTailwindTheme(tokens) }
 * }
 * ```
 */
export function tokensToTailwindTheme(tokens: DesignTokenSet): Record<string, unknown> {
  return {
    colors: buildTailwindColors(tokens),
    fontFamily: buildTailwindFontFamily(tokens),
    fontSize: buildTailwindFontSize(tokens),
    fontWeight: buildTailwindFontWeight(tokens),
    lineHeight: buildTailwindLineHeight(tokens),
    letterSpacing: buildTailwindLetterSpacing(tokens),
    spacing: buildTailwindSpacing(tokens),
    borderRadius: buildTailwindBorderRadius(tokens),
    boxShadow: buildTailwindBoxShadow(tokens),
    transitionDuration: buildTailwindDuration(tokens),
    transitionTimingFunction: buildTailwindEasing(tokens),
    screens: buildTailwindScreens(tokens),
  };
}

// =============================================================================
// Tailwind v4: @theme CSS Block
// =============================================================================

/**
 * Generates a Tailwind v4 `@theme` CSS block from tokens.
 * Tailwind v4 uses CSS-first configuration with @theme directive.
 *
 * @example
 * ```css
 * @theme {
 *   --color-primary-500: #7c3aed;
 *   --font-family-heading: "Inter", system-ui, sans-serif;
 *   ...
 * }
 * ```
 */
export function tokensToTailwindCss(tokens: DesignTokenSet): string {
  const lines: string[] = [];

  // Colors
  for (const role of ["primary", "secondary", "accent", "error", "warning", "success", "info"] as const) {
    const scale = tokens.color[role];
    for (const step of COLOR_SCALE_STEPS) {
      lines.push(`  --color-${role}-${step}: ${scale[step].$value.hex};`);
    }
  }
  lines.push(`  --color-background: ${tokens.color.background.$value.hex};`);
  lines.push(`  --color-text: ${tokens.color.text.$value.hex};`);
  lines.push("");

  // Font families
  const { fontFamily } = tokens.typography;
  lines.push(`  --font-heading: "${fontFamily.heading.$value}", system-ui, sans-serif;`);
  lines.push(`  --font-body: "${fontFamily.body.$value}", system-ui, sans-serif;`);
  lines.push(`  --font-mono: "${fontFamily.mono.$value}", ui-monospace, monospace;`);
  lines.push("");

  // Font sizes (fluid)
  for (const level of ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl"] as const) {
    const val = tokens.typography.fontSize[level].$value as FluidTypeValue;
    lines.push(`  --text-${level}: ${val.clamp};`);
  }
  lines.push("");

  // Spacing
  for (const [key, token] of Object.entries(tokens.spacing)) {
    if (key.startsWith("$") || !token || typeof token === "string") continue;
    const t = token as { $value: string };
    lines.push(`  --spacing-${key}: ${t.$value};`);
  }
  lines.push("");

  // Border radius
  for (const key of ["none", "sm", "md", "lg", "xl", "2xl", "full"] as const) {
    lines.push(`  --radius-${key}: ${tokens.borderRadius[key].$value};`);
  }
  lines.push("");

  // Shadows
  for (const key of ["xs", "sm", "md", "lg", "xl"] as const) {
    const layers = tokens.shadow[key].$value;
    const css = layers
      .map((l: ShadowLayerValue) => `${l.offsetX} ${l.offsetY} ${l.blur} ${l.spread} ${l.color}`)
      .join(", ");
    lines.push(`  --shadow-${key}: ${css};`);
  }
  lines.push("");

  // Breakpoints
  for (const key of ["sm", "md", "lg", "xl", "2xl"] as const) {
    lines.push(`  --breakpoint-${key}: ${tokens.breakpoint[key].$value};`);
  }

  return `@theme {\n${lines.join("\n")}\n}`;
}

// =============================================================================
// Tailwind v3 Builders
// =============================================================================

function buildTailwindColors(tokens: DesignTokenSet): Record<string, unknown> {
  const colors: Record<string, unknown> = {};

  for (const role of ["primary", "secondary", "accent", "error", "warning", "success", "info"] as const) {
    const scale: Record<string, string> = {};
    const colorScale = tokens.color[role] as ColorScaleToken;
    for (const step of COLOR_SCALE_STEPS) {
      scale[step] = colorScale[step].$value.hex;
    }
    // Also add DEFAULT pointing to 500
    scale.DEFAULT = colorScale["500"].$value.hex;
    colors[role] = scale;
  }

  colors.background = tokens.color.background.$value.hex;
  colors.foreground = tokens.color.text.$value.hex;

  return colors;
}

function buildTailwindFontFamily(tokens: DesignTokenSet): Record<string, string[]> {
  const { fontFamily } = tokens.typography;
  return {
    heading: [fontFamily.heading.$value, "system-ui", "sans-serif"],
    body: [fontFamily.body.$value, "system-ui", "sans-serif"],
    mono: [fontFamily.mono.$value, "ui-monospace", "monospace"],
  };
}

function buildTailwindFontSize(tokens: DesignTokenSet): Record<string, string> {
  const sizes: Record<string, string> = {};
  for (const level of FONT_SIZE_KEYS) {
    sizes[level] = tokens.typography.fontSize[level].$value.clamp;
  }
  return sizes;
}

function buildTailwindFontWeight(tokens: DesignTokenSet): Record<string, string> {
  const weights: Record<string, string> = {};
  for (const name of FONT_WEIGHT_KEYS) {
    weights[name] = String(tokens.typography.fontWeight[name].$value);
  }
  return weights;
}

function buildTailwindLineHeight(tokens: DesignTokenSet): Record<string, string> {
  const lh: Record<string, string> = {};
  for (const name of LINE_HEIGHT_KEYS) {
    lh[name] = String(tokens.typography.lineHeight[name].$value);
  }
  return lh;
}

function buildTailwindLetterSpacing(tokens: DesignTokenSet): Record<string, string> {
  const ls: Record<string, string> = {};
  for (const name of LETTER_SPACING_KEYS) {
    ls[name] = tokens.typography.letterSpacing[name].$value;
  }
  return ls;
}

function buildTailwindSpacing(tokens: DesignTokenSet): Record<string, string> {
  const spacing: Record<string, string> = {};
  for (const [key, token] of Object.entries(tokens.spacing)) {
    if (key.startsWith("$") || !token || typeof token === "string") continue;
    spacing[key] = (token as { $value: string }).$value;
  }
  return spacing;
}

function buildTailwindBorderRadius(tokens: DesignTokenSet): Record<string, string> {
  const radius: Record<string, string> = {};
  for (const key of ["none", "sm", "md", "lg", "xl", "2xl", "full"] as const) {
    // Map to Tailwind naming: md → DEFAULT
    const twKey = key === "md" ? "DEFAULT" : key;
    radius[twKey] = tokens.borderRadius[key].$value;
  }
  return radius;
}

function buildTailwindBoxShadow(tokens: DesignTokenSet): Record<string, string> {
  const shadows: Record<string, string> = {};
  for (const key of ["xs", "sm", "md", "lg", "xl"] as const) {
    const layers = tokens.shadow[key].$value;
    const twKey = key === "md" ? "DEFAULT" : key;
    shadows[twKey] = layers
      .map((l: ShadowLayerValue) => `${l.offsetX} ${l.offsetY} ${l.blur} ${l.spread} ${l.color}`)
      .join(", ");
  }
  return shadows;
}

function buildTailwindDuration(tokens: DesignTokenSet): Record<string, string> {
  const durations: Record<string, string> = {};
  for (const name of DURATION_KEYS) {
    // Tailwind expects numeric ms string without "ms" suffix
    durations[name] = tokens.animation.duration[name].$value.replace("ms", "");
  }
  return durations;
}

function buildTailwindEasing(tokens: DesignTokenSet): Record<string, string> {
  const easings: Record<string, string> = {};
  for (const name of EASING_KEYS) {
    const bezier = tokens.animation.easing[name].$value;
    easings[name] = `cubic-bezier(${bezier.join(", ")})`;
  }
  return easings;
}

function buildTailwindScreens(tokens: DesignTokenSet): Record<string, string> {
  const screens: Record<string, string> = {};
  for (const key of ["sm", "md", "lg", "xl", "2xl"] as const) {
    screens[key] = tokens.breakpoint[key].$value;
  }
  return screens;
}
