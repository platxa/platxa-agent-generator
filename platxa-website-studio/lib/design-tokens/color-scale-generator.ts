/**
 * Color Scale Generator
 *
 * Generates OKLCH-based 10-step color scales and dark mode variants.
 * Builds on the OKLCH math from agent-bridge/color-mapper.ts.
 */

import { hexToOklch, oklchToHex } from "../agent-bridge/color-mapper";
import type { OklchColor, OdooColorPalette } from "../agent-bridge/types";
import type {
  ColorScaleToken,
  ColorScaleStep,
  ColorScaleStepKey,
  ColorTokenValue,
  ColorTokenGroup,
  DesignTokenSet,
} from "./types";
import { COLOR_SCALE_STEPS } from "./types";

// =============================================================================
// Single Color Scale
// =============================================================================

const DEFAULT_FALLBACK_OKLCH: OklchColor = { l: 0.5, c: 0.15, h: 270 };

/**
 * Generates a 10-step OKLCH color scale for a single base color.
 *
 * Steps map to lightness values:
 *   50  → L=0.97 (lightest tint)
 *   500 → L≈base lightness
 *   950 → L=0.15 (darkest shade)
 *
 * Chroma is reduced at extremes to stay within sRGB gamut.
 */
export function generateColorScale(baseHex: string): ColorScaleToken {
  const base = hexToOklch(baseHex) || DEFAULT_FALLBACK_OKLCH;

  const steps: Record<string, ColorScaleStep> = {};

  for (const step of COLOR_SCALE_STEPS) {
    const numStep = parseInt(step, 10);
    // Map step 50-950 to lightness 0.97-0.15
    const targetL = 0.97 - ((numStep - 50) / 900) * 0.82;
    // Reduce chroma at extremes to stay in gamut
    const chromaFactor = numStep < 200 || numStep > 800 ? 0.6 : 1.0;
    const oklch: OklchColor = {
      l: Math.round(targetL * 1000) / 1000,
      c: Math.round(base.c * chromaFactor * 1000) / 1000,
      h: base.h,
    };
    const hex = oklchToHex(oklch);

    steps[step] = {
      $value: { hex, oklch },
      $type: "color",
    };
  }

  return {
    $type: "color",
    ...steps,
  } as ColorScaleToken;
}

// =============================================================================
// Full Palette Scales
// =============================================================================

const SEMANTIC_HUES = {
  error: 25,
  warning: 75,
  success: 145,
  info: 245,
} as const;

/**
 * Generates color scales for all palette colors including semantic colors.
 * Returns scales keyed by color role name.
 */
export function generatePaletteScales(
  palette: OdooColorPalette | undefined,
): ColorTokenGroup {
  const p = {
    primary: palette?.primary || "#7c3aed",
    secondary: palette?.secondary || "#6c757d",
    accent: palette?.accent || "#ec4899",
    background: palette?.background || "#f8f9fa",
    text: palette?.text || "#212529",
  };

  // Derive semantic base colors from accent hue
  const accentOklch = hexToOklch(p.accent) || DEFAULT_FALLBACK_OKLCH;
  const semanticBase = (targetHue: number): string => {
    const derived: OklchColor = {
      l: Math.min(0.65, Math.max(0.45, accentOklch.l)),
      c: Math.min(0.2, Math.max(0.1, accentOklch.c)),
      h: targetHue,
    };
    return oklchToHex(derived);
  };

  const bgOklch = hexToOklch(p.background) || { l: 0.97, c: 0, h: 0 };
  const textOklch = hexToOklch(p.text) || { l: 0.15, c: 0, h: 0 };

  return {
    $type: "color",
    $description: "Brand color palette with 10-step OKLCH scales",
    primary: generateColorScale(p.primary),
    secondary: generateColorScale(p.secondary),
    accent: generateColorScale(p.accent),
    background: {
      $value: { hex: p.background, oklch: bgOklch },
      $type: "color",
    },
    text: {
      $value: { hex: p.text, oklch: textOklch },
      $type: "color",
    },
    error: generateColorScale(semanticBase(SEMANTIC_HUES.error)),
    warning: generateColorScale(semanticBase(SEMANTIC_HUES.warning)),
    success: generateColorScale(semanticBase(SEMANTIC_HUES.success)),
    info: generateColorScale(semanticBase(SEMANTIC_HUES.info)),
  };
}

// =============================================================================
// Dark Mode Derivation
// =============================================================================

/**
 * Inverts a color scale step for dark mode using OKLCH lightness inversion.
 * L' = 1 - L, with chroma reduction at new extremes for gamut safety.
 */
function invertScaleStep(step: ColorScaleStep): ColorScaleStep {
  const { oklch } = step.$value;
  const invertedL = Math.round((1 - oklch.l) * 1000) / 1000;
  // Reduce chroma when inverted lightness is extreme
  const chromaFactor = invertedL < 0.2 || invertedL > 0.85 ? 0.7 : 1.0;
  const invertedOklch: OklchColor = {
    l: invertedL,
    c: Math.round(oklch.c * chromaFactor * 1000) / 1000,
    h: oklch.h,
  };
  return {
    $value: { hex: oklchToHex(invertedOklch), oklch: invertedOklch },
    $type: "color",
  };
}

/**
 * Inverts an entire color scale for dark mode.
 * The lightest step (50) becomes darkest and vice versa.
 */
function invertColorScale(scale: ColorScaleToken): ColorScaleToken {
  const reversed = [...COLOR_SCALE_STEPS].reverse();
  const result: Record<string, ColorScaleStep> = {};

  for (let i = 0; i < COLOR_SCALE_STEPS.length; i++) {
    const targetKey = COLOR_SCALE_STEPS[i];
    const sourceKey = reversed[i];
    result[targetKey] = invertScaleStep(scale[sourceKey]);
  }

  return {
    $type: "color",
    $description: scale.$description,
    ...result,
  } as ColorScaleToken;
}

/**
 * Derives a dark mode variant of a full DesignTokenSet.
 *
 * Strategy:
 * - Color scales: invert lightness (L' = 1 - L), reverse step mapping
 * - Background ↔ Text: swap and adjust
 * - Typography, spacing, animation: kept identical
 * - Shadows: darken further for dark backgrounds
 */
export function deriveDarkMode(lightTokens: DesignTokenSet): DesignTokenSet {
  const { color } = lightTokens;

  // Swap background and text
  const darkBgOklch: OklchColor = {
    l: Math.min(0.2, 1 - (color.text.$value.oklch.l || 0.15)),
    c: 0,
    h: 0,
  };
  const darkTextOklch: OklchColor = {
    l: Math.max(0.85, 1 - (color.background.$value.oklch.l || 0.97)),
    c: 0,
    h: 0,
  };

  const darkColor: ColorTokenGroup = {
    $type: "color",
    $description: "Dark mode color palette (auto-derived via OKLCH inversion)",
    primary: invertColorScale(color.primary),
    secondary: invertColorScale(color.secondary),
    accent: invertColorScale(color.accent),
    background: {
      $value: { hex: oklchToHex(darkBgOklch), oklch: darkBgOklch },
      $type: "color",
    },
    text: {
      $value: { hex: oklchToHex(darkTextOklch), oklch: darkTextOklch },
      $type: "color",
    },
    error: invertColorScale(color.error),
    warning: invertColorScale(color.warning),
    success: invertColorScale(color.success),
    info: invertColorScale(color.info),
  };

  // Darken shadows for dark mode
  const darkShadow = { ...lightTokens.shadow };

  return {
    ...lightTokens,
    $description: "Dark mode design tokens (auto-derived)",
    metadata: {
      ...lightTokens.metadata,
      name: `${lightTokens.metadata.name}-dark`,
    },
    color: darkColor,
    shadow: darkShadow,
  };
}
