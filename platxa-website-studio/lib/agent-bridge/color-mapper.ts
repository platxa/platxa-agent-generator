/**
 * Color Mapper
 *
 * Bridges Odoo's 5-color palette (primary, secondary, accent, background, text)
 * to the frontend-agent's 20+ SemanticColors using OKLCH color science.
 *
 * OKLCH conversion math is implemented locally to avoid requiring the
 * frontend-agent package at build time. The algorithms follow the CSS Color
 * Level 4 specification for sRGB ↔ OKLCH conversion.
 */

import type { OklchColor, OdooColorPalette, BrandTokenContext } from "./types";

// =============================================================================
// sRGB ↔ Linear RGB
// =============================================================================

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308
    ? 12.92 * c
    : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

// =============================================================================
// Linear RGB ↔ OKLab (via LMS)
// =============================================================================

function linearRgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const l_ = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m_ = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s_ = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l = Math.cbrt(l_);
  const m = Math.cbrt(m_);
  const s = Math.cbrt(s_);

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinearRgb(L: number, a: number, b: number): [number, number, number] {
  const l = L + 0.3963377774 * a + 0.2158037573 * b;
  const m = L - 0.1055613458 * a - 0.0638541728 * b;
  const s = L - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l * l * l;
  const m3 = m * m * m;
  const s3 = s * s * s;

  return [
    +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ];
}

// =============================================================================
// Hex ↔ OKLCH Public API
// =============================================================================

export function hexToOklch(hex: string): OklchColor | null {
  const cleaned = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(cleaned)) return null;

  const r = srgbToLinear(parseInt(cleaned.slice(0, 2), 16) / 255);
  const g = srgbToLinear(parseInt(cleaned.slice(2, 4), 16) / 255);
  const b = srgbToLinear(parseInt(cleaned.slice(4, 6), 16) / 255);

  const [L, a, bVal] = linearRgbToOklab(r, g, b);
  const c = Math.sqrt(a * a + bVal * bVal);
  const h = (Math.atan2(bVal, a) * 180) / Math.PI;

  return {
    l: Math.round(L * 1000) / 1000,
    c: Math.round(c * 1000) / 1000,
    h: Math.round(((h + 360) % 360) * 10) / 10,
  };
}

export function oklchToHex(oklch: OklchColor): string {
  const hRad = (oklch.h * Math.PI) / 180;
  const a = oklch.c * Math.cos(hRad);
  const b = oklch.c * Math.sin(hRad);

  const [rLin, gLin, bLin] = oklabToLinearRgb(oklch.l, a, b);

  const r = Math.round(Math.min(1, Math.max(0, linearToSrgb(rLin))) * 255);
  const g = Math.round(Math.min(1, Math.max(0, linearToSrgb(gLin))) * 255);
  const bv = Math.round(Math.min(1, Math.max(0, linearToSrgb(bLin))) * 255);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bv.toString(16).padStart(2, "0")}`;
}

// =============================================================================
// OKLCH Color Manipulation
// =============================================================================

function adjustLightness(color: OklchColor, delta: number): OklchColor {
  return {
    ...color,
    l: Math.min(1, Math.max(0, color.l + delta)),
  };
}

function rotateHue(color: OklchColor, degrees: number): OklchColor {
  return {
    ...color,
    h: (color.h + degrees + 360) % 360,
  };
}

function adjustChroma(color: OklchColor, factor: number): OklchColor {
  return {
    ...color,
    c: Math.min(0.4, Math.max(0, color.c * factor)),
  };
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
 * Used for creating Odoo $o-color-N variable scales.
 */
export function generateLightnessScale(
  baseHex: string,
): Record<number, string> {
  const base = hexToOklch(baseHex);
  if (!base) return { 500: baseHex };

  const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  const scale: Record<number, string> = {};

  for (const step of steps) {
    // Map step 50-950 to lightness 0.97-0.15
    const targetL = 0.97 - ((step - 50) / 900) * 0.82;
    // Reduce chroma at extremes to stay in gamut
    const chromaFactor = step < 200 || step > 800 ? 0.6 : 1.0;
    scale[step] = oklchToHex({
      l: targetL,
      c: base.c * chromaFactor,
      h: base.h,
    });
  }

  return scale;
}

/**
 * Checks whether two hex colors meet WCAG AA contrast ratio (4.5:1).
 * Uses relative luminance calculation per WCAG 2.1.
 */
export function meetsContrastAA(fg: string, bg: string): boolean {
  const lum = (hex: string): number => {
    const cleaned = hex.replace(/^#/, "");
    const r = srgbToLinear(parseInt(cleaned.slice(0, 2), 16) / 255);
    const g = srgbToLinear(parseInt(cleaned.slice(2, 4), 16) / 255);
    const b = srgbToLinear(parseInt(cleaned.slice(4, 6), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const l1 = lum(fg);
  const l2 = lum(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05) >= 4.5;
}
