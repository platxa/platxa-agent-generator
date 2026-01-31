/**
 * Color Mapper
 *
 * Bridges Odoo's 5-color palette (primary, secondary, accent, background, text)
 * to the frontend-agent's 20+ SemanticColors using OKLCH color science.
 *
 * OKLCH conversion is routed through the @platxa/frontend-agent oklch-palette
 * module for consistency with the agent pipeline. This ensures all OKLCH
 * calculations use the same implementation across the system.
 */

import type { OdooColorPalette, BrandTokenContext } from "./types";
import type { OklchColor } from "@platxa/frontend-agent/lib/react-agent/oklch-palette";

// Import OKLCH functions from frontend-agent (single source of truth)
import {
  hexToOklch as frontendAgentHexToOklch,
  oklchToHex as frontendAgentOklchToHex,
  lighten,
  darken,
  rotateHue as frontendAgentRotateHue,
  saturate,
  desaturate,
  generateShadeScale,
  calculateContrastRatio,
} from "@platxa/frontend-agent/lib/react-agent/oklch-palette";

// =============================================================================
// Re-export OKLCH functions from frontend-agent for consistency
// =============================================================================

/**
 * Converts a hex color to OKLCH color space.
 * Routed through frontend-agent's oklch-palette module.
 */
export function hexToOklch(hex: string): OklchColor | null {
  return frontendAgentHexToOklch(hex);
}

/**
 * Converts an OKLCH color back to hex format.
 * Routed through frontend-agent's oklch-palette module.
 */
export function oklchToHex(oklch: OklchColor): string {
  return frontendAgentOklchToHex(oklch);
}

// =============================================================================
// OKLCH Color Manipulation (using frontend-agent functions)
// =============================================================================

function adjustLightness(color: OklchColor, delta: number): OklchColor {
  if (delta > 0) {
    return lighten(color, delta);
  } else {
    return darken(color, Math.abs(delta));
  }
}

function rotateHue(color: OklchColor, degrees: number): OklchColor {
  return frontendAgentRotateHue(color, degrees);
}

function adjustChroma(color: OklchColor, factor: number): OklchColor {
  if (factor > 1) {
    return saturate(color, factor - 1);
  } else {
    return desaturate(color, 1 - factor);
  }
}

// =============================================================================
// Derive Semantic Colors from Accent
// =============================================================================

/**
 * Derives error/warning/success/info colors from the accent color
 * using perceptually uniform OKLCH hue rotation.
 */
function deriveSemanticColor(accent: OklchColor, targetHue: number): string {
  const derived: OklchColor = {
    l: Math.min(0.65, Math.max(0.45, accent.l)),
    c: Math.min(0.2, Math.max(0.1, accent.c)),
    h: targetHue,
  };
  return oklchToHex(derived);
}

// Standard hues for semantic colors in OKLCH space
const SEMANTIC_HUES = {
  error: 25, // Red
  warning: 75, // Orange/Yellow
  success: 145, // Green
  info: 245, // Blue
} as const;

// =============================================================================
// Main Mapper: Odoo Palette → BrandTokenContext
// =============================================================================

const FALLBACK_PALETTE: Required<OdooColorPalette> = {
  primary: "#7c3aed",
  secondary: "#6c757d",
  accent: "#ec4899",
  background: "#f8f9fa",
  text: "#212529",
};

/**
 * Maps an Odoo 5-color palette to a full BrandTokenContext with
 * derived semantic colors using OKLCH color science.
 *
 * @param palette - Odoo color palette (partial; missing colors use fallbacks)
 * @returns Complete BrandTokenContext ready for LLM prompt injection
 */
export function mapOdooPaletteToBrandTokens(
  palette: OdooColorPalette | undefined,
): BrandTokenContext {
  const p = {
    primary: palette?.primary || FALLBACK_PALETTE.primary,
    secondary: palette?.secondary || FALLBACK_PALETTE.secondary,
    accent: palette?.accent || FALLBACK_PALETTE.accent,
    background: palette?.background || FALLBACK_PALETTE.background,
    text: palette?.text || FALLBACK_PALETTE.text,
  };

  const primaryOklch = hexToOklch(p.primary) || { l: 0.5, c: 0.2, h: 280 };
  const secondaryOklch = hexToOklch(p.secondary) || { l: 0.5, c: 0.05, h: 250 };
  const accentOklch = hexToOklch(p.accent) || { l: 0.6, c: 0.2, h: 350 };

  return {
    colors: {
      primary: p.primary,
      primaryOklch,
      secondary: p.secondary,
      secondaryOklch,
      accent: p.accent,
      accentOklch,
      background: p.background,
      text: p.text,
      error: deriveSemanticColor(accentOklch, SEMANTIC_HUES.error),
      warning: deriveSemanticColor(accentOklch, SEMANTIC_HUES.warning),
      success: deriveSemanticColor(accentOklch, SEMANTIC_HUES.success),
      info: deriveSemanticColor(accentOklch, SEMANTIC_HUES.info),
    },
  };
}

/**
 * Generates a lightness scale (50-950) for a given base color.
 * Uses frontend-agent's generateShadeScale for Tailwind-compatible output.
 * Used for creating Odoo $o-color-N variable scales.
 */
export function generateLightnessScale(
  baseHex: string,
): Record<number, string> {
  const base = hexToOklch(baseHex);
  if (!base) return { 500: baseHex };

  // Use frontend-agent's shade scale generator for consistent output
  const shadeScale = generateShadeScale(base);

  // Convert TailwindShadeScale to Record<number, string>
  const scale: Record<number, string> = {};
  const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

  for (const step of steps) {
    const oklchColor = shadeScale[step];
    if (oklchColor) {
      scale[step] = oklchToHex(oklchColor);
    }
  }

  return scale;
}

/**
 * Checks whether two hex colors meet WCAG AA contrast ratio (4.5:1).
 * Uses frontend-agent's calculateContrastRatio for consistent results.
 */
export function meetsContrastAA(fg: string, bg: string): boolean {
  const fgOklch = hexToOklch(fg);
  const bgOklch = hexToOklch(bg);

  if (!fgOklch || !bgOklch) {
    return false;
  }

  const ratio = calculateContrastRatio(fgOklch, bgOklch);
  return ratio >= 4.5;
}
