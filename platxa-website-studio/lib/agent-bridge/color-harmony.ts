/**
 * Color Harmony Validator
 *
 * Validates color palettes against harmony rules (complementary, analogous,
 * triadic, split-complementary, monochromatic). Flags disharmonious
 * combinations and suggests corrections.
 */

// =============================================================================
// Types
// =============================================================================

/** Supported harmony types */
export type HarmonyType =
  | "complementary"
  | "analogous"
  | "triadic"
  | "split-complementary"
  | "monochromatic"
  | "custom";

/** HSL color representation */
export interface HslColor {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

/** A harmony issue found in the palette */
export interface HarmonyIssue {
  /** Description of the issue */
  message: string;
  /** Severity: low, medium, high */
  severity: "low" | "medium" | "high";
  /** Indices of the colors involved */
  colorIndices: number[];
  /** Suggested fix hex values */
  suggestions: string[];
}

/** Result of harmony validation */
export interface HarmonyResult {
  /** Detected harmony type */
  detectedHarmony: HarmonyType;
  /** Confidence in detected harmony (0-1) */
  confidence: number;
  /** Whether the palette is harmonious */
  isHarmonious: boolean;
  /** Issues found */
  issues: HarmonyIssue[];
  /** Input colors as HSL */
  hslColors: HslColor[];
}

// =============================================================================
// Hex <-> HSL Conversion
// =============================================================================

/**
 * Converts a hex color string to HSL.
 */
export function hexToHsl(hex: string): HslColor {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Converts HSL to hex string.
 */
export function hslToHex(hsl: HslColor): string {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (v: number) => {
    const hex = Math.round(v * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// =============================================================================
// Angle Utilities
// =============================================================================

/** Smallest angle between two hues on the color wheel */
function hueDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Normalize hue to 0-360 */
function normalizeHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

// =============================================================================
// Harmony Detection
// =============================================================================

const COMPLEMENTARY_TOLERANCE = 30;  // ±30° from 180°
const ANALOGOUS_TOLERANCE = 40;      // within 40° of each other
const TRIADIC_TOLERANCE = 30;        // ±30° from 120° intervals
const SPLIT_COMP_TOLERANCE = 30;     // ±30° from 150°/210°
const MONO_SATURATION_RANGE = 20;    // saturation within 20 pts

/**
 * Detects the harmony type from an array of hues.
 */
function detectHarmonyType(hslColors: HslColor[]): { type: HarmonyType; confidence: number } {
  if (hslColors.length < 2) return { type: "custom", confidence: 0 };

  const hues = hslColors.map((c) => c.h);

  // Monochromatic: all hues within tight range
  const hueSpread = Math.max(...hues.map((h) => hueDiff(h, hues[0])));
  if (hueSpread <= 15) {
    return { type: "monochromatic", confidence: 1 - hueSpread / 15 };
  }

  if (hslColors.length === 2) {
    const diff = hueDiff(hues[0], hues[1]);
    if (Math.abs(diff - 180) <= COMPLEMENTARY_TOLERANCE) {
      return { type: "complementary", confidence: 1 - Math.abs(diff - 180) / COMPLEMENTARY_TOLERANCE };
    }
    if (diff <= ANALOGOUS_TOLERANCE) {
      return { type: "analogous", confidence: 1 - diff / ANALOGOUS_TOLERANCE };
    }
  }

  if (hslColors.length >= 3) {
    // Sort hues
    const sorted = [...hues].sort((a, b) => a - b);

    // Check triadic (120° apart)
    if (sorted.length === 3) {
      const d01 = hueDiff(sorted[0], sorted[1]);
      const d12 = hueDiff(sorted[1], sorted[2]);
      const d20 = hueDiff(sorted[2], sorted[0]);
      const triadicError = Math.abs(d01 - 120) + Math.abs(d12 - 120) + Math.abs(d20 - 120);
      if (triadicError <= TRIADIC_TOLERANCE * 3) {
        return { type: "triadic", confidence: 1 - triadicError / (TRIADIC_TOLERANCE * 3) };
      }
    }

    // Check analogous (all within range)
    const allAnalogous = hues.every((h, i) =>
      hues.every((h2, j) => i === j || hueDiff(h, h2) <= ANALOGOUS_TOLERANCE)
    );
    if (allAnalogous) {
      const maxDiff = Math.max(...hues.flatMap((h, i) =>
        hues.filter((_, j) => j !== i).map((h2) => hueDiff(h, h2))
      ));
      return { type: "analogous", confidence: 1 - maxDiff / ANALOGOUS_TOLERANCE };
    }

    // Check split-complementary
    if (sorted.length === 3) {
      const base = sorted[0];
      const d1 = hueDiff(base, sorted[1]);
      const d2 = hueDiff(base, sorted[2]);
      if (Math.abs(d1 - 150) <= SPLIT_COMP_TOLERANCE && Math.abs(d2 - 210) <= SPLIT_COMP_TOLERANCE) {
        return { type: "split-complementary", confidence: 0.7 };
      }
    }
  }

  return { type: "custom", confidence: 0 };
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validates a color palette for harmony.
 * @param hexColors Array of hex color strings (e.g. ["#FF0000", "#00FF00"])
 */
export function validateHarmony(hexColors: string[]): HarmonyResult {
  const hslColors = hexColors.map(hexToHsl);
  const { type, confidence } = detectHarmonyType(hslColors);
  const issues: HarmonyIssue[] = [];

  if (hslColors.length < 2) {
    return { detectedHarmony: type, confidence: 0, isHarmonious: true, issues: [], hslColors };
  }

  // Check for clashing hues (not fitting any standard harmony)
  if (type === "custom") {
    const hues = hslColors.map((c) => c.h);
    for (let i = 0; i < hues.length; i++) {
      for (let j = i + 1; j < hues.length; j++) {
        const diff = hueDiff(hues[i], hues[j]);
        // "Dead zone" — not close enough for analogous, not far enough for complementary
        if (diff > ANALOGOUS_TOLERANCE && Math.abs(diff - 180) > COMPLEMENTARY_TOLERANCE) {
          const compHue = normalizeHue(hues[i] + 180);
          issues.push({
            message: `Colors at indices ${i} and ${j} (${diff}° apart) don't follow a standard harmony pattern`,
            severity: "medium",
            colorIndices: [i, j],
            suggestions: [
              hslToHex({ ...hslColors[j], h: normalizeHue(hues[i] + 30) }),  // analogous
              hslToHex({ ...hslColors[j], h: compHue }),                      // complementary
            ],
          });
        }
      }
    }
  }

  // Check saturation balance
  const saturations = hslColors.map((c) => c.s);
  const satRange = Math.max(...saturations) - Math.min(...saturations);
  if (satRange > 60) {
    issues.push({
      message: `Large saturation spread (${satRange}%) may create visual imbalance`,
      severity: "low",
      colorIndices: hslColors.map((_, i) => i),
      suggestions: [],
    });
  }

  // Check for very similar colors (almost duplicates)
  for (let i = 0; i < hslColors.length; i++) {
    for (let j = i + 1; j < hslColors.length; j++) {
      const hDiff = hueDiff(hslColors[i].h, hslColors[j].h);
      const sDiff = Math.abs(hslColors[i].s - hslColors[j].s);
      const lDiff = Math.abs(hslColors[i].l - hslColors[j].l);
      if (hDiff < 5 && sDiff < 5 && lDiff < 5) {
        issues.push({
          message: `Colors at indices ${i} and ${j} are nearly identical — consider more contrast`,
          severity: "medium",
          colorIndices: [i, j],
          suggestions: [
            hslToHex({ ...hslColors[j], l: Math.min(100, hslColors[j].l + 20) }),
          ],
        });
      }
    }
  }

  const isHarmonious = issues.filter((i) => i.severity !== "low").length === 0;

  return { detectedHarmony: type, confidence, isHarmonious, issues, hslColors };
}

/**
 * Generates a harmonious palette from a base color.
 */
export function generateHarmoniousPalette(
  baseHex: string,
  harmonyType: HarmonyType,
  count: number = 3,
): string[] {
  const base = hexToHsl(baseHex);

  switch (harmonyType) {
    case "complementary":
      return [baseHex, hslToHex({ ...base, h: normalizeHue(base.h + 180) })];

    case "analogous": {
      const step = 30;
      const result: string[] = [];
      const start = base.h - step * Math.floor(count / 2);
      for (let i = 0; i < count; i++) {
        result.push(hslToHex({ ...base, h: normalizeHue(start + step * i) }));
      }
      return result;
    }

    case "triadic":
      return [
        baseHex,
        hslToHex({ ...base, h: normalizeHue(base.h + 120) }),
        hslToHex({ ...base, h: normalizeHue(base.h + 240) }),
      ];

    case "split-complementary":
      return [
        baseHex,
        hslToHex({ ...base, h: normalizeHue(base.h + 150) }),
        hslToHex({ ...base, h: normalizeHue(base.h + 210) }),
      ];

    case "monochromatic": {
      const result: string[] = [];
      const lStep = 60 / (count - 1 || 1);
      for (let i = 0; i < count; i++) {
        result.push(hslToHex({ ...base, l: Math.round(20 + lStep * i) }));
      }
      return result;
    }

    default:
      return [baseHex];
  }
}
