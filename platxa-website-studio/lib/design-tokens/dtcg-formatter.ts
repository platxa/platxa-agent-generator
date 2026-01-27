/**
 * DTCG Formatter
 *
 * Serializes/deserializes DesignTokenSet to/from W3C DTCG JSON format.
 * The DTCG format uses `$value` and `$type` fields at each token node.
 *
 * Output example:
 * {
 *   "color": {
 *     "$type": "color",
 *     "primary": {
 *       "50": { "$value": "#f5f3ff", "$type": "color" },
 *       "100": { "$value": "#ede9fe", "$type": "color" },
 *       ...
 *     }
 *   },
 *   "typography": { ... }
 * }
 */

import type {
  DesignTokenSet,
  DesignTokenSetMetadata,
  ColorTokenGroup,
  ColorScaleToken,
  ColorScaleStepKey,
  ColorTokenValue,
  TypographyTokenGroup,
  FluidTypeValue,
  SpacingTokenGroup,
  BorderRadiusTokenGroup,
  ShadowTokenGroup,
  ShadowLayerValue,
  AnimationTokenGroup,
  BreakpointTokenGroup,
  DesignToken,
  DimensionToken,
} from "./types";
import {
  COLOR_SCALE_STEPS,
  FONT_SIZE_KEYS,
  FONT_WEIGHT_KEYS,
  LINE_HEIGHT_KEYS,
  LETTER_SPACING_KEYS,
} from "./types";
import { hexToOklch } from "../agent-bridge/color-mapper";

// =============================================================================
// Serialize to DTCG JSON
// =============================================================================

interface DtcgColorValue {
  $value: string;
  $type: "color";
  $description?: string;
}

interface DtcgScaleGroup {
  $type: "color";
  [step: string]: DtcgColorValue | string | undefined;
}

/**
 * Serializes a DesignTokenSet to W3C DTCG JSON format.
 * Color tokens emit hex-only `$value` (OKLCH is internal).
 * Typography fontSize tokens emit the clamp() string.
 */
export function toDtcgJson(tokens: DesignTokenSet): Record<string, unknown> {
  return {
    $description: tokens.$description,
    metadata: tokens.metadata,
    color: serializeColorGroup(tokens.color),
    typography: serializeTypographyGroup(tokens.typography),
    spacing: serializeSpacingGroup(tokens.spacing),
    borderRadius: serializeBorderRadiusGroup(tokens.borderRadius),
    shadow: serializeShadowGroup(tokens.shadow),
    animation: serializeAnimationGroup(tokens.animation),
    breakpoint: serializeBreakpointGroup(tokens.breakpoint),
  };
}

/**
 * Serializes a DesignTokenSet to a JSON string.
 */
export function toDtcgJsonString(tokens: DesignTokenSet, pretty: boolean = true): string {
  return JSON.stringify(toDtcgJson(tokens), null, pretty ? 2 : undefined);
}

// =============================================================================
// Deserialize from DTCG JSON
// =============================================================================

/**
 * Deserializes a DTCG JSON object back to a DesignTokenSet.
 * Reconstructs OKLCH values from hex colors.
 */
export function fromDtcgJson(json: Record<string, unknown>): DesignTokenSet {
  const raw = json as Record<string, Record<string, unknown>>;

  return {
    $description: (json.$description as string) || undefined,
    metadata: (json.metadata as DesignTokenSetMetadata) || {
      name: "imported",
      version: "1.0.0",
      createdAt: new Date().toISOString(),
    },
    color: deserializeColorGroup(raw.color || {}),
    typography: deserializeTypographyGroup(raw.typography || {}),
    spacing: deserializeSpacingGroup(raw.spacing || {}),
    borderRadius: deserializeBorderRadiusGroup(raw.borderRadius || {}),
    shadow: deserializeShadowGroup(raw.shadow || {}),
    animation: deserializeAnimationGroup(raw.animation || {}),
    breakpoint: deserializeBreakpointGroup(raw.breakpoint || {}),
  };
}

// =============================================================================
// Color Serialization
// =============================================================================

function serializeColorScale(scale: ColorScaleToken): DtcgScaleGroup {
  const group: DtcgScaleGroup = { $type: "color" };
  for (const step of COLOR_SCALE_STEPS) {
    const token = scale[step];
    if (token) {
      group[step] = { $value: token.$value.hex, $type: "color" };
    }
  }
  return group;
}

function serializeColorGroup(color: ColorTokenGroup): Record<string, unknown> {
  return {
    $type: "color",
    $description: color.$description,
    primary: serializeColorScale(color.primary),
    secondary: serializeColorScale(color.secondary),
    accent: serializeColorScale(color.accent),
    background: { $value: color.background.$value.hex, $type: "color" },
    text: { $value: color.text.$value.hex, $type: "color" },
    error: serializeColorScale(color.error),
    warning: serializeColorScale(color.warning),
    success: serializeColorScale(color.success),
    info: serializeColorScale(color.info),
  };
}

function deserializeColorScale(raw: Record<string, unknown>): ColorScaleToken {
  const scale: Record<string, unknown> = { $type: "color" as const };
  for (const step of COLOR_SCALE_STEPS) {
    const entry = raw[step] as { $value?: string } | undefined;
    const hex = entry?.$value || "#000000";
    scale[step] = {
      $value: { hex, oklch: hexToOklch(hex) || { l: 0, c: 0, h: 0 } },
      $type: "color",
    };
  }
  return scale as unknown as ColorScaleToken;
}

function deserializeColorToken(raw: unknown): DesignToken<ColorTokenValue> {
  const entry = raw as { $value?: string } | undefined;
  const hex = entry?.$value || "#000000";
  return {
    $value: { hex, oklch: hexToOklch(hex) || { l: 0, c: 0, h: 0 } },
    $type: "color",
  };
}

function deserializeColorGroup(raw: Record<string, unknown>): ColorTokenGroup {
  return {
    $type: "color",
    $description: raw.$description as string | undefined,
    primary: deserializeColorScale((raw.primary || {}) as Record<string, unknown>),
    secondary: deserializeColorScale((raw.secondary || {}) as Record<string, unknown>),
    accent: deserializeColorScale((raw.accent || {}) as Record<string, unknown>),
    background: deserializeColorToken(raw.background),
    text: deserializeColorToken(raw.text),
    error: deserializeColorScale((raw.error || {}) as Record<string, unknown>),
    warning: deserializeColorScale((raw.warning || {}) as Record<string, unknown>),
    success: deserializeColorScale((raw.success || {}) as Record<string, unknown>),
    info: deserializeColorScale((raw.info || {}) as Record<string, unknown>),
  };
}

// =============================================================================
// Typography Serialization
// =============================================================================

function serializeTypographyGroup(typo: TypographyTokenGroup): Record<string, unknown> {
  // Font sizes — iterate explicit keys
  const fontSizes: Record<string, unknown> = { $type: "fontSize" };
  for (const key of FONT_SIZE_KEYS) {
    fontSizes[key] = { $value: typo.fontSize[key].$value.clamp, $type: "fontSize" };
  }

  // Font weights — iterate explicit keys
  const fontWeights: Record<string, unknown> = { $type: "fontWeight" };
  for (const key of FONT_WEIGHT_KEYS) {
    fontWeights[key] = { $value: typo.fontWeight[key].$value, $type: "fontWeight" };
  }

  // Line heights — iterate explicit keys
  const lineHeights: Record<string, unknown> = { $type: "lineHeight" };
  for (const key of LINE_HEIGHT_KEYS) {
    lineHeights[key] = { $value: typo.lineHeight[key].$value, $type: "lineHeight" };
  }

  // Letter spacings — iterate explicit keys
  const letterSpacings: Record<string, unknown> = { $type: "letterSpacing" };
  for (const key of LETTER_SPACING_KEYS) {
    letterSpacings[key] = { $value: typo.letterSpacing[key].$value, $type: "letterSpacing" };
  }

  return {
    $type: "typography",
    $description: typo.$description,
    fontFamily: {
      $type: "fontFamily",
      heading: { $value: typo.fontFamily.heading.$value, $type: "fontFamily" },
      body: { $value: typo.fontFamily.body.$value, $type: "fontFamily" },
      mono: { $value: typo.fontFamily.mono.$value, $type: "fontFamily" },
    },
    fontWeight: fontWeights,
    fontSize: fontSizes,
    lineHeight: lineHeights,
    letterSpacing: letterSpacings,
  };
}

function deserializeTypographyGroup(raw: Record<string, unknown>): TypographyTokenGroup {
  const fontFamily = raw.fontFamily as Record<string, Record<string, string>> | undefined;
  const fontWeight = raw.fontWeight as Record<string, Record<string, unknown>> | undefined;
  const fontSize = raw.fontSize as Record<string, Record<string, string>> | undefined;
  const lineHeight = raw.lineHeight as Record<string, Record<string, unknown>> | undefined;
  const letterSpacing = raw.letterSpacing as Record<string, Record<string, string>> | undefined;

  // For fontSize, reconstruct FluidTypeValue from clamp string
  const fontSizeGroup: Record<string, unknown> = { $type: "fontSize" };
  if (fontSize) {
    for (const [key, val] of Object.entries(fontSize)) {
      if (key.startsWith("$")) continue;
      const clamp = val.$value || "1rem";
      fontSizeGroup[key] = {
        $value: { min: clamp, max: clamp, clamp },
        $type: "fontSize",
      };
    }
  }

  return {
    $type: "typography",
    $description: (raw.$description as string) || undefined,
    fontFamily: {
      $type: "fontFamily",
      heading: { $value: fontFamily?.heading?.$value || "Inter", $type: "fontFamily" },
      body: { $value: fontFamily?.body?.$value || "Inter", $type: "fontFamily" },
      mono: { $value: fontFamily?.mono?.$value || "JetBrains Mono", $type: "fontFamily" },
    },
    fontWeight: {
      $type: "fontWeight",
      light: { $value: numVal(fontWeight, "light", 300), $type: "fontWeight" },
      normal: { $value: numVal(fontWeight, "normal", 400), $type: "fontWeight" },
      medium: { $value: numVal(fontWeight, "medium", 500), $type: "fontWeight" },
      semibold: { $value: numVal(fontWeight, "semibold", 600), $type: "fontWeight" },
      bold: { $value: numVal(fontWeight, "bold", 700), $type: "fontWeight" },
      extrabold: { $value: numVal(fontWeight, "extrabold", 800), $type: "fontWeight" },
    },
    fontSize: fontSizeGroup as TypographyTokenGroup["fontSize"],
    lineHeight: {
      $type: "lineHeight",
      tight: { $value: numVal(lineHeight, "tight", 1.25), $type: "lineHeight" },
      snug: { $value: numVal(lineHeight, "snug", 1.375), $type: "lineHeight" },
      normal: { $value: numVal(lineHeight, "normal", 1.5), $type: "lineHeight" },
      relaxed: { $value: numVal(lineHeight, "relaxed", 1.625), $type: "lineHeight" },
      loose: { $value: numVal(lineHeight, "loose", 2), $type: "lineHeight" },
    },
    letterSpacing: {
      $type: "letterSpacing",
      tighter: { $value: strVal(letterSpacing, "tighter", "-0.05em"), $type: "letterSpacing" },
      tight: { $value: strVal(letterSpacing, "tight", "-0.025em"), $type: "letterSpacing" },
      normal: { $value: strVal(letterSpacing, "normal", "0em"), $type: "letterSpacing" },
      wide: { $value: strVal(letterSpacing, "wide", "0.025em"), $type: "letterSpacing" },
      wider: { $value: strVal(letterSpacing, "wider", "0.05em"), $type: "letterSpacing" },
    },
  };
}

// =============================================================================
// Spacing / BorderRadius / Breakpoint Serialization
// =============================================================================

function serializeDimensionGroup(group: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { $type: "dimension" };
  for (const [key, token] of Object.entries(group)) {
    if (key.startsWith("$")) {
      result[key] = token;
      continue;
    }
    const t = token as DimensionToken;
    result[key] = { $value: t.$value, $type: "dimension" };
  }
  return result;
}

function deserializeDimensionGroup<T>(
  raw: Record<string, unknown>,
  keys: string[],
  defaults: Record<string, string>,
): T {
  const result: Record<string, unknown> = {
    $type: "dimension",
    $description: raw.$description as string | undefined,
  };
  for (const key of keys) {
    const entry = raw[key] as { $value?: string } | undefined;
    result[key] = { $value: entry?.$value || defaults[key] || "0px", $type: "dimension" };
  }
  return result as T;
}

function serializeSpacingGroup(spacing: SpacingTokenGroup): Record<string, unknown> {
  return serializeDimensionGroup(spacing as unknown as Record<string, unknown>);
}

function deserializeSpacingGroup(raw: Record<string, unknown>): SpacingTokenGroup {
  const result: SpacingTokenGroup = {
    $type: "dimension",
    $description: raw.$description as string | undefined,
  };
  for (const [key, val] of Object.entries(raw)) {
    if (key.startsWith("$")) continue;
    const entry = val as { $value?: string } | undefined;
    result[key] = { $value: entry?.$value || "0px", $type: "dimension" };
  }
  return result;
}

function serializeBorderRadiusGroup(br: BorderRadiusTokenGroup): Record<string, unknown> {
  return serializeDimensionGroup(br as unknown as Record<string, unknown>);
}

function deserializeBorderRadiusGroup(raw: Record<string, unknown>): BorderRadiusTokenGroup {
  return deserializeDimensionGroup<BorderRadiusTokenGroup>(
    raw,
    ["none", "sm", "md", "lg", "xl", "2xl", "full"],
    { none: "0px", sm: "4px", md: "8px", lg: "12px", xl: "16px", "2xl": "24px", full: "9999px" },
  );
}

function serializeBreakpointGroup(bp: BreakpointTokenGroup): Record<string, unknown> {
  return serializeDimensionGroup(bp as unknown as Record<string, unknown>);
}

function deserializeBreakpointGroup(raw: Record<string, unknown>): BreakpointTokenGroup {
  return deserializeDimensionGroup<BreakpointTokenGroup>(
    raw,
    ["sm", "md", "lg", "xl", "2xl"],
    { sm: "640px", md: "768px", lg: "1024px", xl: "1280px", "2xl": "1536px" },
  );
}

// =============================================================================
// Shadow Serialization
// =============================================================================

function serializeShadowGroup(shadow: ShadowTokenGroup): Record<string, unknown> {
  const result: Record<string, unknown> = {
    $type: "shadow",
    $description: shadow.$description,
  };
  for (const key of ["xs", "sm", "md", "lg", "xl"] as const) {
    const token = shadow[key];
    result[key] = { $value: token.$value, $type: "shadow" };
  }
  return result;
}

function deserializeShadowGroup(raw: Record<string, unknown>): ShadowTokenGroup {
  const defaultLayer: ShadowLayerValue[] = [
    { offsetX: "0px", offsetY: "0px", blur: "0px", spread: "0px", color: "rgba(0,0,0,0)" },
  ];
  const result: Record<string, unknown> = {
    $type: "shadow",
    $description: raw.$description as string | undefined,
  };
  for (const key of ["xs", "sm", "md", "lg", "xl"]) {
    const entry = raw[key] as { $value?: ShadowLayerValue[] } | undefined;
    result[key] = { $value: entry?.$value || defaultLayer, $type: "shadow" };
  }
  return result as unknown as ShadowTokenGroup;
}

// =============================================================================
// Animation Serialization
// =============================================================================

function serializeAnimationGroup(anim: AnimationTokenGroup): Record<string, unknown> {
  return {
    $description: anim.$description,
    duration: {
      $type: "duration",
      fast: { $value: anim.duration.fast.$value, $type: "duration" },
      normal: { $value: anim.duration.normal.$value, $type: "duration" },
      slow: { $value: anim.duration.slow.$value, $type: "duration" },
    },
    easing: {
      $type: "cubicBezier",
      easeIn: { $value: anim.easing.easeIn.$value, $type: "cubicBezier" },
      easeOut: { $value: anim.easing.easeOut.$value, $type: "cubicBezier" },
      easeInOut: { $value: anim.easing.easeInOut.$value, $type: "cubicBezier" },
      spring: { $value: anim.easing.spring.$value, $type: "cubicBezier" },
    },
  };
}

function deserializeAnimationGroup(raw: Record<string, unknown>): AnimationTokenGroup {
  const duration = raw.duration as Record<string, Record<string, string>> | undefined;
  const easing = raw.easing as Record<string, Record<string, unknown>> | undefined;

  return {
    $description: (raw.$description as string) || undefined,
    duration: {
      $type: "duration",
      fast: { $value: duration?.fast?.$value || "150ms", $type: "duration" },
      normal: { $value: duration?.normal?.$value || "300ms", $type: "duration" },
      slow: { $value: duration?.slow?.$value || "500ms", $type: "duration" },
    },
    easing: {
      $type: "cubicBezier",
      easeIn: { $value: (easing?.easeIn?.$value || [0.4, 0, 1, 1]) as [number, number, number, number], $type: "cubicBezier" },
      easeOut: { $value: (easing?.easeOut?.$value || [0, 0, 0.2, 1]) as [number, number, number, number], $type: "cubicBezier" },
      easeInOut: { $value: (easing?.easeInOut?.$value || [0.4, 0, 0.2, 1]) as [number, number, number, number], $type: "cubicBezier" },
      spring: { $value: (easing?.spring?.$value || [0.175, 0.885, 0.32, 1.275]) as [number, number, number, number], $type: "cubicBezier" },
    },
  };
}

// =============================================================================
// Helpers
// =============================================================================

function numVal(
  group: Record<string, Record<string, unknown>> | undefined,
  key: string,
  fallback: number,
): number {
  const val = group?.[key]?.$value;
  return typeof val === "number" ? val : fallback;
}

function strVal(
  group: Record<string, Record<string, string>> | undefined,
  key: string,
  fallback: string,
): string {
  return group?.[key]?.$value || fallback;
}
