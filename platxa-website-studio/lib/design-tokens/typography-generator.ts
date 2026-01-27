/**
 * Typography Generator
 *
 * Generates fluid type scales using CSS clamp() and DTCG token format.
 * Produces responsive typography that scales smoothly between viewport sizes.
 */

import type {
  TypographyConfig,
  TypographyTokenGroup,
  FluidTypeValue,
  FluidFontSizeToken,
  FontFamilyToken,
  FontWeightToken,
  LineHeightToken,
  LetterSpacingToken,
} from "./types";

// =============================================================================
// Fluid Type Scale
// =============================================================================

/** Font size level names, ordered from smallest to largest */
const FONT_SIZE_LEVELS = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl"] as const;
type FontSizeLevel = (typeof FONT_SIZE_LEVELS)[number];

/** Level index relative to "base" (base = 0, lg = +1, sm = -1, etc.) */
const LEVEL_OFFSETS: Record<FontSizeLevel, number> = {
  xs: -2,
  sm: -1,
  base: 0,
  lg: 1,
  xl: 2,
  "2xl": 3,
  "3xl": 4,
  "4xl": 5,
};

/**
 * Computes a fluid CSS clamp() value for a given type scale level.
 *
 * The formula scales font size linearly between minVw and maxVw:
 *   clamp(minSize, preferredSize, maxSize)
 *
 * Where preferredSize = minSize + (maxSize - minSize) * ((100vw - minVw) / (maxVw - minVw))
 * Simplified to: clamp(minRem, calcExpr, maxRem)
 */
function computeFluidSize(
  baseSize: number,
  scale: number,
  levelOffset: number,
  minVw: number,
  maxVw: number,
): FluidTypeValue {
  // Size at max viewport
  const maxSize = baseSize * Math.pow(scale, levelOffset);
  // Size at min viewport — use a tighter scale for small screens
  const minScale = 1 + (scale - 1) * 0.6;
  const minSize = baseSize * Math.pow(minScale, levelOffset);

  const minRem = round(minSize / 16, 4);
  const maxRem = round(maxSize / 16, 4);

  // Slope and intercept for the linear interpolation
  const slope = (maxSize - minSize) / (maxVw - minVw);
  const intercept = minSize - slope * minVw;

  const slopeVw = round(slope * 100, 4);
  const interceptRem = round(intercept / 16, 4);

  const min = `${minRem}rem`;
  const max = `${maxRem}rem`;
  const clamp = `clamp(${min}, ${interceptRem}rem + ${slopeVw}vw, ${max})`;

  return { min, max, clamp };
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

/**
 * Generates a fluid type scale with CSS clamp() values for each level.
 *
 * @param config - Typography configuration
 * @returns Map of level name to fluid type value
 */
export function generateFluidTypeScale(config: {
  baseSize?: number;
  scale?: number;
  minVw?: number;
  maxVw?: number;
}): Record<FontSizeLevel, FluidTypeValue> {
  const baseSize = config.baseSize ?? 16;
  const scale = config.scale ?? 1.25;
  const minVw = config.minVw ?? 320;
  const maxVw = config.maxVw ?? 1280;

  const result = {} as Record<FontSizeLevel, FluidTypeValue>;

  for (const level of FONT_SIZE_LEVELS) {
    result[level] = computeFluidSize(
      baseSize,
      scale,
      LEVEL_OFFSETS[level],
      minVw,
      maxVw,
    );
  }

  return result;
}

// =============================================================================
// Full Typography Token Group
// =============================================================================

const DEFAULT_CONFIG: Required<TypographyConfig> = {
  headingFamily: "Inter",
  bodyFamily: "Inter",
  monoFamily: "JetBrains Mono",
  headingWeight: 700,
  bodyWeight: 400,
  baseSize: 16,
  scale: 1.25,
  minViewport: 320,
  maxViewport: 1280,
};

/**
 * Generates a complete DTCG typography token group from configuration.
 * Includes font families, weights, fluid font sizes, line heights, and letter spacing.
 */
export function generateTypographyTokens(
  config?: Partial<TypographyConfig>,
): TypographyTokenGroup {
  const c = { ...DEFAULT_CONFIG, ...config };

  // Generate fluid scale
  const fluidScale = generateFluidTypeScale({
    baseSize: c.baseSize,
    scale: c.scale,
    minVw: c.minViewport,
    maxVw: c.maxViewport,
  });

  // Build font size tokens — explicit construction for full type safety
  const fs = (v: FluidTypeValue): FluidFontSizeToken => ({ $value: v, $type: "fontSize" });
  const fontSize: TypographyTokenGroup["fontSize"] = {
    $type: "fontSize",
    xs: fs(fluidScale.xs),
    sm: fs(fluidScale.sm),
    base: fs(fluidScale.base),
    lg: fs(fluidScale.lg),
    xl: fs(fluidScale.xl),
    "2xl": fs(fluidScale["2xl"]),
    "3xl": fs(fluidScale["3xl"]),
    "4xl": fs(fluidScale["4xl"]),
  };

  // Font families
  const fontFamily: TypographyTokenGroup["fontFamily"] = {
    $type: "fontFamily",
    heading: ff(c.headingFamily),
    body: ff(c.bodyFamily),
    mono: ff(c.monoFamily),
  };

  // Font weights
  const fontWeight: TypographyTokenGroup["fontWeight"] = {
    $type: "fontWeight",
    light: fw(300),
    normal: fw(c.bodyWeight),
    medium: fw(500),
    semibold: fw(600),
    bold: fw(c.headingWeight),
    extrabold: fw(800),
  };

  // Line heights
  const lineHeight: TypographyTokenGroup["lineHeight"] = {
    $type: "lineHeight",
    tight: lh(1.25),
    snug: lh(1.375),
    normal: lh(1.5),
    relaxed: lh(1.625),
    loose: lh(2),
  };

  // Letter spacing
  const letterSpacing: TypographyTokenGroup["letterSpacing"] = {
    $type: "letterSpacing",
    tighter: ls("-0.05em"),
    tight: ls("-0.025em"),
    normal: ls("0em"),
    wide: ls("0.025em"),
    wider: ls("0.05em"),
  };

  return {
    $type: "typography",
    $description: `Type scale: ${c.scale} (base ${c.baseSize}px), ${c.headingFamily}/${c.bodyFamily}`,
    fontFamily,
    fontWeight,
    fontSize,
    lineHeight,
    letterSpacing,
  };
}

// =============================================================================
// Token Helpers
// =============================================================================

function ff(family: string): FontFamilyToken {
  return { $value: family, $type: "fontFamily" };
}

function fw(weight: number): FontWeightToken {
  return { $value: weight, $type: "fontWeight" };
}

function lh(value: number): LineHeightToken {
  return { $value: value, $type: "lineHeight" };
}

function ls(value: string): LetterSpacingToken {
  return { $value: value, $type: "letterSpacing" };
}
