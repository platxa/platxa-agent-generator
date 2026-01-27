/**
 * Design Token Types — W3C DTCG (Design Tokens Community Group)
 *
 * Follows the W3C Design Tokens Format specification:
 * https://tr.designtokens.org/format/
 *
 * Each token uses `$value` and `$type` fields per the spec.
 * Groups organize tokens hierarchically with optional `$type` inheritance.
 */

import type { OklchColor } from "../agent-bridge/types";

// =============================================================================
// Core DTCG Primitives
// =============================================================================

/**
 * A single design token following W3C DTCG format.
 * `$value` holds the resolved value, `$type` identifies the token type.
 */
export interface DesignToken<T = unknown> {
  $value: T;
  $type: string;
  $description?: string;
}

/**
 * A group of design tokens. Groups can nest and inherit `$type`.
 * Per DTCG spec, a group may carry `$type` that applies to all children.
 */
export interface TokenGroup {
  $type?: string;
  $description?: string;
  [key: string]: DesignToken | TokenGroup | string | undefined;
}

// =============================================================================
// Color Tokens
// =============================================================================

/** Hex color value (e.g. "#7c3aed") */
export type ColorValue = string;

/** Color token with OKLCH metadata for perceptual manipulation */
export interface ColorTokenValue {
  hex: string;
  oklch: OklchColor;
}

/** A single step in a color scale */
export interface ColorScaleStep extends DesignToken<ColorTokenValue> {
  $type: "color";
}

/**
 * A 10-step color scale (50-950) for a single color.
 * Each step stores both hex and OKLCH for downstream use.
 */
export interface ColorScaleToken {
  $type: "color";
  $description?: string;
  "50": ColorScaleStep;
  "100": ColorScaleStep;
  "200": ColorScaleStep;
  "300": ColorScaleStep;
  "400": ColorScaleStep;
  "500": ColorScaleStep;
  "600": ColorScaleStep;
  "700": ColorScaleStep;
  "800": ColorScaleStep;
  "900": ColorScaleStep;
  "950": ColorScaleStep;
}

/** Scale step keys */
export type ColorScaleStepKey =
  | "50" | "100" | "200" | "300" | "400" | "500"
  | "600" | "700" | "800" | "900" | "950";

export const COLOR_SCALE_STEPS: readonly ColorScaleStepKey[] = [
  "50", "100", "200", "300", "400", "500",
  "600", "700", "800", "900", "950",
];

// =============================================================================
// Typography Sub-Group Keys
// =============================================================================

/** Font size level keys (xs through 4xl) */
export const FONT_SIZE_KEYS = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl"] as const;
export type FontSizeKey = (typeof FONT_SIZE_KEYS)[number];

/** Font weight keys */
export const FONT_WEIGHT_KEYS = ["light", "normal", "medium", "semibold", "bold", "extrabold"] as const;
export type FontWeightKey = (typeof FONT_WEIGHT_KEYS)[number];

/** Line height keys */
export const LINE_HEIGHT_KEYS = ["tight", "snug", "normal", "relaxed", "loose"] as const;
export type LineHeightKey = (typeof LINE_HEIGHT_KEYS)[number];

/** Letter spacing keys */
export const LETTER_SPACING_KEYS = ["tighter", "tight", "normal", "wide", "wider"] as const;
export type LetterSpacingKey = (typeof LETTER_SPACING_KEYS)[number];

// =============================================================================
// Animation Sub-Group Keys
// =============================================================================

/** Duration keys */
export const DURATION_KEYS = ["fast", "normal", "slow"] as const;
export type DurationKey = (typeof DURATION_KEYS)[number];

/** Easing keys */
export const EASING_KEYS = ["easeIn", "easeOut", "easeInOut", "spring"] as const;
export type EasingKey = (typeof EASING_KEYS)[number];

/** Color token group: palette colors + semantic colors, each with full scale */
export interface ColorTokenGroup {
  $type: "color";
  $description?: string;
  primary: ColorScaleToken;
  secondary: ColorScaleToken;
  accent: ColorScaleToken;
  background: DesignToken<ColorTokenValue>;
  text: DesignToken<ColorTokenValue>;
  // Semantic colors
  error: ColorScaleToken;
  warning: ColorScaleToken;
  success: ColorScaleToken;
  info: ColorScaleToken;
}

// =============================================================================
// Typography Tokens
// =============================================================================

/** Fluid type value with CSS clamp() */
export interface FluidTypeValue {
  min: string;   // e.g. "0.875rem"
  max: string;   // e.g. "1rem"
  clamp: string; // e.g. "clamp(0.875rem, 0.8rem + 0.2vw, 1rem)"
}

/** Font family token */
export interface FontFamilyToken extends DesignToken<string> {
  $type: "fontFamily";
}

/** Font weight token */
export interface FontWeightToken extends DesignToken<number> {
  $type: "fontWeight";
}

/** Line height token */
export interface LineHeightToken extends DesignToken<number> {
  $type: "lineHeight";
}

/** Letter spacing token */
export interface LetterSpacingToken extends DesignToken<string> {
  $type: "letterSpacing";
}

/** Fluid font size token */
export interface FluidFontSizeToken extends DesignToken<FluidTypeValue> {
  $type: "fontSize";
}

/** Typography token group */
export interface TypographyTokenGroup {
  $type: "typography";
  $description?: string;
  fontFamily: {
    $type: "fontFamily";
    heading: FontFamilyToken;
    body: FontFamilyToken;
    mono: FontFamilyToken;
  };
  fontWeight: {
    $type: "fontWeight";
    light: FontWeightToken;
    normal: FontWeightToken;
    medium: FontWeightToken;
    semibold: FontWeightToken;
    bold: FontWeightToken;
    extrabold: FontWeightToken;
  };
  fontSize: {
    $type: "fontSize";
    xs: FluidFontSizeToken;
    sm: FluidFontSizeToken;
    base: FluidFontSizeToken;
    lg: FluidFontSizeToken;
    xl: FluidFontSizeToken;
    "2xl": FluidFontSizeToken;
    "3xl": FluidFontSizeToken;
    "4xl": FluidFontSizeToken;
  };
  lineHeight: {
    $type: "lineHeight";
    tight: LineHeightToken;
    snug: LineHeightToken;
    normal: LineHeightToken;
    relaxed: LineHeightToken;
    loose: LineHeightToken;
  };
  letterSpacing: {
    $type: "letterSpacing";
    tighter: LetterSpacingToken;
    tight: LetterSpacingToken;
    normal: LetterSpacingToken;
    wide: LetterSpacingToken;
    wider: LetterSpacingToken;
  };
}

// =============================================================================
// Spacing Tokens
// =============================================================================

/** Dimension token (px, rem) */
export interface DimensionToken extends DesignToken<string> {
  $type: "dimension";
}

/** Spacing token group — 4px grid system */
export interface SpacingTokenGroup {
  $type: "dimension";
  $description?: string;
  [key: string]: DimensionToken | string | undefined;
}

// =============================================================================
// Border Radius Tokens
// =============================================================================

/** Border radius token group */
export interface BorderRadiusTokenGroup {
  $type: "dimension";
  $description?: string;
  none: DimensionToken;
  sm: DimensionToken;
  md: DimensionToken;
  lg: DimensionToken;
  xl: DimensionToken;
  "2xl": DimensionToken;
  full: DimensionToken;
}

// =============================================================================
// Shadow Tokens
// =============================================================================

/** Individual shadow layer */
export interface ShadowLayerValue {
  offsetX: string;
  offsetY: string;
  blur: string;
  spread: string;
  color: string;
}

/** Shadow token — may have multiple layers */
export interface ShadowToken extends DesignToken<ShadowLayerValue[]> {
  $type: "shadow";
}

/** Shadow elevation group */
export interface ShadowTokenGroup {
  $type: "shadow";
  $description?: string;
  xs: ShadowToken;
  sm: ShadowToken;
  md: ShadowToken;
  lg: ShadowToken;
  xl: ShadowToken;
}

// =============================================================================
// Animation Tokens
// =============================================================================

/** Duration token (ms) */
export interface DurationToken extends DesignToken<string> {
  $type: "duration";
}

/** Cubic bezier easing token */
export interface CubicBezierToken extends DesignToken<[number, number, number, number]> {
  $type: "cubicBezier";
}

/** Animation token group */
export interface AnimationTokenGroup {
  $description?: string;
  duration: {
    $type: "duration";
    fast: DurationToken;
    normal: DurationToken;
    slow: DurationToken;
  };
  easing: {
    $type: "cubicBezier";
    easeIn: CubicBezierToken;
    easeOut: CubicBezierToken;
    easeInOut: CubicBezierToken;
    spring: CubicBezierToken;
  };
}

// =============================================================================
// Breakpoint Tokens
// =============================================================================

/** Breakpoint token group */
export interface BreakpointTokenGroup {
  $type: "dimension";
  $description?: string;
  sm: DimensionToken;
  md: DimensionToken;
  lg: DimensionToken;
  xl: DimensionToken;
  "2xl": DimensionToken;
}

// =============================================================================
// Design Token Set (Root Container)
// =============================================================================

/** Metadata for a token set */
export interface DesignTokenSetMetadata {
  name: string;
  version: string;
  createdAt: string;
  industry?: string;
  designStyle?: string;
}

/**
 * Complete design token set — the canonical representation of a brand's
 * design system. Contains all token groups organized by category.
 *
 * This is the central data structure for Tier 2.
 */
export interface DesignTokenSet {
  $description?: string;
  metadata: DesignTokenSetMetadata;
  color: ColorTokenGroup;
  typography: TypographyTokenGroup;
  spacing: SpacingTokenGroup;
  borderRadius: BorderRadiusTokenGroup;
  shadow: ShadowTokenGroup;
  animation: AnimationTokenGroup;
  breakpoint: BreakpointTokenGroup;
}

// =============================================================================
// Typography Config Input (for generators)
// =============================================================================

/** Input configuration for typography token generation */
export interface TypographyConfig {
  headingFamily: string;
  bodyFamily: string;
  monoFamily?: string;
  headingWeight?: number;
  bodyWeight?: number;
  baseSize?: number;       // px, default 16
  scale?: number;          // ratio, default 1.25 (major third)
  minViewport?: number;    // px, default 320
  maxViewport?: number;    // px, default 1280
}

/** Named type scale ratios */
export const TYPE_SCALE_RATIOS = {
  "minor-second": 1.067,
  "major-second": 1.125,
  "minor-third": 1.2,
  "major-third": 1.25,
  "perfect-fourth": 1.333,
} as const;

export type TypeScaleRatio = keyof typeof TYPE_SCALE_RATIOS;
