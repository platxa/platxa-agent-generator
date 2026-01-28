/**
 * Color Swatch Panel — Token Visualization with WCAG Contrast Ratings
 *
 * Generates swatch data from color tokens with pairwise WCAG contrast
 * ratio calculations and AA/AAA compliance ratings.
 */

// =============================================================================
// Types
// =============================================================================

/** WCAG compliance level */
export type WcagLevel = "AAA" | "AA" | "AA-large" | "fail";

/** A color token swatch */
export interface ColorSwatch {
  /** Token name (e.g. "primary", "bg-surface") */
  name: string;
  /** Hex color value */
  hex: string;
  /** Optional label for display */
  label?: string;
  /** Whether this is a foreground or background token */
  role: "foreground" | "background" | "accent" | "neutral";
}

/** Contrast result for a pair of colors */
export interface ContrastPair {
  /** Foreground swatch name */
  foreground: string;
  /** Background swatch name */
  background: string;
  /** Foreground hex */
  fgHex: string;
  /** Background hex */
  bgHex: string;
  /** Computed contrast ratio (1:1 to 21:1) */
  ratio: number;
  /** Formatted ratio string (e.g. "4.52:1") */
  ratioFormatted: string;
  /** WCAG level for normal text */
  levelNormal: WcagLevel;
  /** WCAG level for large text (18pt+ or 14pt bold) */
  levelLarge: WcagLevel;
}

/** Full panel data */
export interface SwatchPanelData {
  /** All color swatches */
  swatches: ColorSwatch[];
  /** Contrast pairs for relevant combinations */
  contrastPairs: ContrastPair[];
  /** Number of pairs passing AA for normal text */
  aaPassCount: number;
  /** Number of pairs passing AAA for normal text */
  aaaPassCount: number;
  /** Total evaluated pairs */
  totalPairs: number;
}

// =============================================================================
// Luminance & Contrast (WCAG 2.1)
// =============================================================================

/**
 * Parses a hex color string to RGB [0-255].
 */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace(/^#/, "");
  let r: number, g: number, b: number;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else {
    r = parseInt(clean.substring(0, 2), 16);
    g = parseInt(clean.substring(2, 4), 16);
    b = parseInt(clean.substring(4, 6), 16);
  }
  return [r, g, b];
}

/**
 * Computes relative luminance per WCAG 2.1 definition.
 * Returns value in [0, 1].
 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Computes the WCAG contrast ratio between two hex colors.
 * Returns ratio in [1, 21].
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Determines WCAG level for a given contrast ratio.
 */
export function getWcagLevel(ratio: number, isLargeText: boolean): WcagLevel {
  if (isLargeText) {
    if (ratio >= 4.5) return "AAA";
    if (ratio >= 3) return "AA";
    return "fail";
  }
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA-large";
  return "fail";
}

/**
 * Formats a contrast ratio to a string like "4.52:1".
 */
export function formatRatio(ratio: number): string {
  return `${ratio.toFixed(2)}:1`;
}

// =============================================================================
// Panel Generation
// =============================================================================

/**
 * Evaluates the contrast between two swatches.
 */
export function evaluatePair(fg: ColorSwatch, bg: ColorSwatch): ContrastPair {
  const ratio = contrastRatio(fg.hex, bg.hex);
  return {
    foreground: fg.name,
    background: bg.name,
    fgHex: fg.hex,
    bgHex: bg.hex,
    ratio,
    ratioFormatted: formatRatio(ratio),
    levelNormal: getWcagLevel(ratio, false),
    levelLarge: getWcagLevel(ratio, true),
  };
}

/**
 * Generates the full swatch panel with all foreground-on-background pairs.
 * Evaluates every foreground token against every background token.
 */
export function generateSwatchPanel(swatches: ColorSwatch[]): SwatchPanelData {
  const fgSwatches = swatches.filter((s) => s.role === "foreground" || s.role === "accent");
  const bgSwatches = swatches.filter((s) => s.role === "background" || s.role === "neutral");

  // If no role-based separation, evaluate all pairs
  const hasSeparation = fgSwatches.length > 0 && bgSwatches.length > 0;
  const contrastPairs: ContrastPair[] = [];

  if (hasSeparation) {
    for (const fg of fgSwatches) {
      for (const bg of bgSwatches) {
        contrastPairs.push(evaluatePair(fg, bg));
      }
    }
  } else {
    // All-vs-all (excluding self)
    for (let i = 0; i < swatches.length; i++) {
      for (let j = 0; j < swatches.length; j++) {
        if (i !== j) {
          contrastPairs.push(evaluatePair(swatches[i], swatches[j]));
        }
      }
    }
  }

  const aaPassCount = contrastPairs.filter(
    (p) => p.levelNormal === "AA" || p.levelNormal === "AAA",
  ).length;
  const aaaPassCount = contrastPairs.filter((p) => p.levelNormal === "AAA").length;

  return {
    swatches,
    contrastPairs,
    aaPassCount,
    aaaPassCount,
    totalPairs: contrastPairs.length,
  };
}
