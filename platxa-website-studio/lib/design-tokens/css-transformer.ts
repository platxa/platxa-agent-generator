/**
 * CSS Transformer
 *
 * Transforms DesignTokenSet into CSS custom properties.
 * Supports light mode, dark mode, and combined output.
 */

import type {
  DesignTokenSet,
  ColorScaleStepKey,
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
// Main API
// =============================================================================

/**
 * Generates CSS custom properties from a DesignTokenSet.
 *
 * @param tokens - The design token set
 * @param prefix - Variable prefix (default "plt")
 * @returns CSS string with custom properties inside :root {}
 */
export function tokensToCssVariables(
  tokens: DesignTokenSet,
  prefix: string = "plt",
): string {
  const vars = buildVariableList(tokens, prefix);
  const lines = vars.map(([name, value]) => `  ${name}: ${value};`);
  return `:root {\n${lines.join("\n")}\n}`;
}

/**
 * Generates CSS custom properties with dark mode support.
 * Light tokens go in :root, dark tokens in @media (prefers-color-scheme: dark)
 * and a .dark class for manual toggling.
 *
 * @param light - Light mode tokens
 * @param dark - Dark mode tokens
 * @param prefix - Variable prefix (default "plt")
 * @returns Complete CSS string with both modes
 */
export function tokensToCssVariablesWithDarkMode(
  light: DesignTokenSet,
  dark: DesignTokenSet,
  prefix: string = "plt",
): string {
  const lightVars = buildVariableList(light, prefix);
  const darkVars = buildVariableList(dark, prefix);

  const lightLines = lightVars.map(([n, v]) => `  ${n}: ${v};`);
  const darkLines = darkVars.map(([n, v]) => `  ${n}: ${v};`);

  return [
    `/* Light mode (default) */`,
    `:root {`,
    ...lightLines,
    `}`,
    ``,
    `/* Dark mode (system preference) */`,
    `@media (prefers-color-scheme: dark) {`,
    `  :root {`,
    ...darkLines.map((l) => `  ${l}`),
    `  }`,
    `}`,
    ``,
    `/* Dark mode (manual toggle) */`,
    `.dark {`,
    ...darkLines,
    `}`,
  ].join("\n");
}

// =============================================================================
// Variable Builder
// =============================================================================

type CssVar = [name: string, value: string];

function buildVariableList(tokens: DesignTokenSet, prefix: string): CssVar[] {
  const vars: CssVar[] = [];
  const p = prefix ? `--${prefix}` : "--";

  // Colors
  addColorVars(vars, tokens, p);

  // Typography
  addTypographyVars(vars, tokens, p);

  // Spacing
  addSpacingVars(vars, tokens, p);

  // Border radius
  addBorderRadiusVars(vars, tokens, p);

  // Shadows
  addShadowVars(vars, tokens, p);

  // Animation
  addAnimationVars(vars, tokens, p);

  // Breakpoints
  addBreakpointVars(vars, tokens, p);

  return vars;
}

// =============================================================================
// Color Variables
// =============================================================================

function addColorVars(vars: CssVar[], tokens: DesignTokenSet, p: string): void {
  const { color } = tokens;

  // Palette scales
  for (const role of ["primary", "secondary", "accent", "error", "warning", "success", "info"] as const) {
    const scale = color[role];
    for (const step of COLOR_SCALE_STEPS) {
      vars.push([`${p}-color-${role}-${step}`, scale[step].$value.hex]);
    }
  }

  // Background and text (single values)
  vars.push([`${p}-color-background`, color.background.$value.hex]);
  vars.push([`${p}-color-text`, color.text.$value.hex]);
}

// =============================================================================
// Typography Variables
// =============================================================================

function addTypographyVars(vars: CssVar[], tokens: DesignTokenSet, p: string): void {
  const { typography } = tokens;

  // Font families
  vars.push([`${p}-font-heading`, `"${typography.fontFamily.heading.$value}", system-ui, sans-serif`]);
  vars.push([`${p}-font-body`, `"${typography.fontFamily.body.$value}", system-ui, sans-serif`]);
  vars.push([`${p}-font-mono`, `"${typography.fontFamily.mono.$value}", ui-monospace, monospace`]);

  // Font sizes (fluid clamp values)
  for (const level of FONT_SIZE_KEYS) {
    const val = typography.fontSize[level].$value;
    vars.push([`${p}-text-${level}`, val.clamp]);
  }

  // Font weights
  for (const name of FONT_WEIGHT_KEYS) {
    vars.push([`${p}-font-weight-${name}`, String(typography.fontWeight[name].$value)]);
  }

  // Line heights
  for (const name of LINE_HEIGHT_KEYS) {
    vars.push([`${p}-leading-${name}`, String(typography.lineHeight[name].$value)]);
  }

  // Letter spacing
  for (const name of LETTER_SPACING_KEYS) {
    vars.push([`${p}-tracking-${name}`, typography.letterSpacing[name].$value]);
  }
}

// =============================================================================
// Spacing Variables
// =============================================================================

function addSpacingVars(vars: CssVar[], tokens: DesignTokenSet, p: string): void {
  for (const [key, token] of Object.entries(tokens.spacing)) {
    if (key.startsWith("$") || !token || typeof token === "string") continue;
    const t = token as { $value: string };
    vars.push([`${p}-space-${key}`, t.$value]);
  }
}

// =============================================================================
// Border Radius Variables
// =============================================================================

function addBorderRadiusVars(vars: CssVar[], tokens: DesignTokenSet, p: string): void {
  for (const key of ["none", "sm", "md", "lg", "xl", "2xl", "full"] as const) {
    vars.push([`${p}-radius-${key}`, tokens.borderRadius[key].$value]);
  }
}

// =============================================================================
// Shadow Variables
// =============================================================================

function addShadowVars(vars: CssVar[], tokens: DesignTokenSet, p: string): void {
  for (const key of ["xs", "sm", "md", "lg", "xl"] as const) {
    const layers = tokens.shadow[key].$value;
    const css = layers
      .map((l: ShadowLayerValue) => `${l.offsetX} ${l.offsetY} ${l.blur} ${l.spread} ${l.color}`)
      .join(", ");
    vars.push([`${p}-shadow-${key}`, css]);
  }
}

// =============================================================================
// Animation Variables
// =============================================================================

function addAnimationVars(vars: CssVar[], tokens: DesignTokenSet, p: string): void {
  const { animation } = tokens;

  for (const name of DURATION_KEYS) {
    vars.push([`${p}-duration-${name}`, animation.duration[name].$value]);
  }

  for (const name of EASING_KEYS) {
    const bezier = animation.easing[name].$value;
    vars.push([`${p}-ease-${name}`, `cubic-bezier(${bezier.join(", ")})`]);
  }
}

// =============================================================================
// Breakpoint Variables
// =============================================================================

function addBreakpointVars(vars: CssVar[], tokens: DesignTokenSet, p: string): void {
  for (const key of ["sm", "md", "lg", "xl", "2xl"] as const) {
    vars.push([`${p}-screen-${key}`, tokens.breakpoint[key].$value]);
  }
}
