/**
 * Spacing Generator
 *
 * Generates spacing, border radius, shadow, animation, and breakpoint tokens.
 * All values follow a 4px base grid system (Tailwind convention).
 */

import type {
  SpacingTokenGroup,
  DimensionToken,
  BorderRadiusTokenGroup,
  ShadowTokenGroup,
  ShadowToken,
  ShadowLayerValue,
  AnimationTokenGroup,
  DurationToken,
  CubicBezierToken,
  BreakpointTokenGroup,
} from "./types";

// =============================================================================
// Spacing Scale (4px grid)
// =============================================================================

/**
 * Tailwind-convention spacing multipliers.
 * Each key multiplied by baseUnit gives the px value.
 * E.g. key "4" with 4px base = 16px = 1rem.
 */
const SPACING_KEYS = [
  "0", "px", "0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4",
  "5", "6", "7", "8", "9", "10", "11", "12", "14", "16", "20", "24",
] as const;

function spacingValue(key: string, baseUnit: number): string {
  if (key === "0") return "0px";
  if (key === "px") return "1px";
  const multiplier = parseFloat(key);
  const px = multiplier * baseUnit;
  return `${px / 16}rem`;
}

/**
 * Generates a spacing scale based on a 4px grid system.
 *
 * @param baseUnit - Base unit in px (default 4, matching Tailwind)
 * @returns Spacing token group with Tailwind-convention keys
 */
export function generateSpacingScale(baseUnit: number = 4): SpacingTokenGroup {
  const tokens: SpacingTokenGroup = {
    $type: "dimension",
    $description: `${baseUnit}px grid spacing scale`,
  };

  for (const key of SPACING_KEYS) {
    tokens[key] = dim(spacingValue(key, baseUnit));
  }

  return tokens;
}

// =============================================================================
// Border Radius
// =============================================================================

type DesignStyle = "modern" | "classic" | "minimal" | "bold" | "elegant" | "playful" | "corporate";

/**
 * Base radius values per design style (in px).
 * These multiply the scale to produce the full set.
 */
const RADIUS_BASES: Record<DesignStyle, number> = {
  modern: 8,
  classic: 4,
  minimal: 2,
  bold: 12,
  elegant: 6,
  playful: 16,
  corporate: 4,
};

/**
 * Generates border radius tokens scaled to the design style.
 *
 * @param style - Design style determining base radius (default "modern")
 */
export function generateBorderRadiusTokens(
  style: string = "modern",
): BorderRadiusTokenGroup {
  const base = RADIUS_BASES[style as DesignStyle] ?? 8;

  return {
    $type: "dimension",
    $description: `Border radius for "${style}" style (base ${base}px)`,
    none: dim("0px"),
    sm: dim(`${base * 0.5}px`),
    md: dim(`${base}px`),
    lg: dim(`${base * 1.5}px`),
    xl: dim(`${base * 2}px`),
    "2xl": dim(`${base * 3}px`),
    full: dim("9999px"),
  };
}

// =============================================================================
// Shadow / Elevation
// =============================================================================

/**
 * Generates 5 elevation levels using layered shadows.
 * Shadow color uses a dark neutral with varying opacity.
 */
export function generateShadowTokens(): ShadowTokenGroup {
  return {
    $type: "shadow",
    $description: "5-level elevation system",
    xs: shadow([
      { offsetX: "0px", offsetY: "1px", blur: "2px", spread: "0px", color: "rgba(0,0,0,0.05)" },
    ]),
    sm: shadow([
      { offsetX: "0px", offsetY: "1px", blur: "3px", spread: "0px", color: "rgba(0,0,0,0.1)" },
      { offsetX: "0px", offsetY: "1px", blur: "2px", spread: "-1px", color: "rgba(0,0,0,0.1)" },
    ]),
    md: shadow([
      { offsetX: "0px", offsetY: "4px", blur: "6px", spread: "-1px", color: "rgba(0,0,0,0.1)" },
      { offsetX: "0px", offsetY: "2px", blur: "4px", spread: "-2px", color: "rgba(0,0,0,0.1)" },
    ]),
    lg: shadow([
      { offsetX: "0px", offsetY: "10px", blur: "15px", spread: "-3px", color: "rgba(0,0,0,0.1)" },
      { offsetX: "0px", offsetY: "4px", blur: "6px", spread: "-4px", color: "rgba(0,0,0,0.1)" },
    ]),
    xl: shadow([
      { offsetX: "0px", offsetY: "20px", blur: "25px", spread: "-5px", color: "rgba(0,0,0,0.1)" },
      { offsetX: "0px", offsetY: "8px", blur: "10px", spread: "-6px", color: "rgba(0,0,0,0.1)" },
    ]),
  };
}

// =============================================================================
// Animation Tokens
// =============================================================================

/**
 * Generates animation duration and easing tokens.
 */
export function generateAnimationTokens(): AnimationTokenGroup {
  return {
    $description: "Transition durations and easing curves",
    duration: {
      $type: "duration",
      fast: dur("150ms"),
      normal: dur("300ms"),
      slow: dur("500ms"),
    },
    easing: {
      $type: "cubicBezier",
      easeIn: bez([0.4, 0, 1, 1]),
      easeOut: bez([0, 0, 0.2, 1]),
      easeInOut: bez([0.4, 0, 0.2, 1]),
      spring: bez([0.175, 0.885, 0.32, 1.275]),
    },
  };
}

// =============================================================================
// Breakpoint Tokens
// =============================================================================

/**
 * Generates responsive breakpoint tokens (min-width values).
 */
export function generateBreakpointTokens(): BreakpointTokenGroup {
  return {
    $type: "dimension",
    $description: "Responsive breakpoints (min-width)",
    sm: dim("640px"),
    md: dim("768px"),
    lg: dim("1024px"),
    xl: dim("1280px"),
    "2xl": dim("1536px"),
  };
}

// =============================================================================
// Token Helpers
// =============================================================================

function dim(value: string): DimensionToken {
  return { $value: value, $type: "dimension" };
}

function shadow(layers: ShadowLayerValue[]): ShadowToken {
  return { $value: layers, $type: "shadow" };
}

function dur(value: string): DurationToken {
  return { $value: value, $type: "duration" };
}

function bez(value: [number, number, number, number]): CubicBezierToken {
  return { $value: value, $type: "cubicBezier" };
}
