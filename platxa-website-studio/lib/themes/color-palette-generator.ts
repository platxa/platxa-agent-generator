/**
 * Color Palette Generator
 *
 * Generates complete color palettes from a single base color with
 * AI-suggested complementary colors and WCAG contrast compliance.
 *
 * Feature #69: Theme System - Color palette generator
 */

// =============================================================================
// Types
// =============================================================================

/** RGB color representation */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** HSL color representation */
export interface HSL {
  h: number;
  s: number;
  l: number;
}

/** OKLCH color representation (perceptually uniform) */
export interface OKLCH {
  l: number; // Lightness 0-1
  c: number; // Chroma 0-0.4+
  h: number; // Hue 0-360
}

/** Generated color with metadata */
export interface GeneratedColor {
  /** Hex color value */
  hex: string;
  /** RGB values */
  rgb: RGB;
  /** HSL values */
  hsl: HSL;
  /** Semantic role */
  role: string;
  /** Contrast ratio against white */
  contrastOnWhite: number;
  /** Contrast ratio against black */
  contrastOnBlack: number;
  /** WCAG AA compliant for normal text on white */
  wcagAAOnWhite: boolean;
  /** WCAG AA compliant for normal text on black */
  wcagAAOnBlack: boolean;
}

/** Color palette configuration */
export interface PaletteConfig {
  /** Primary brand color (hex) */
  primary: string;
  /** Palette style */
  style?: "vibrant" | "muted" | "pastel" | "dark" | "monochromatic";
  /** Color harmony type */
  harmony?: "complementary" | "analogous" | "triadic" | "split-complementary" | "tetradic";
  /** Target contrast ratio for text */
  targetContrast?: number;
  /** Generate dark mode variant */
  includeDarkMode?: boolean;
}

/** Complete generated palette */
export interface GeneratedPalette {
  /** Light mode colors */
  light: {
    primary: GeneratedColor;
    secondary: GeneratedColor;
    accent: GeneratedColor;
    background: GeneratedColor;
    surface: GeneratedColor;
    text: GeneratedColor;
    textMuted: GeneratedColor;
    border: GeneratedColor;
    success: GeneratedColor;
    warning: GeneratedColor;
    error: GeneratedColor;
  };
  /** Dark mode colors (if requested) */
  dark?: {
    primary: GeneratedColor;
    secondary: GeneratedColor;
    accent: GeneratedColor;
    background: GeneratedColor;
    surface: GeneratedColor;
    text: GeneratedColor;
    textMuted: GeneratedColor;
    border: GeneratedColor;
    success: GeneratedColor;
    warning: GeneratedColor;
    error: GeneratedColor;
  };
  /** Color shades (50-950) */
  shades: Record<string, GeneratedColor>;
  /** Harmony colors */
  harmonyColors: GeneratedColor[];
  /** Palette metadata */
  meta: {
    baseColor: string;
    style: string;
    harmony: string;
    generatedAt: Date;
  };
}

// =============================================================================
// Color Conversion Utilities
// =============================================================================

/**
 * Parse hex color to RGB
 */
export function hexToRgb(hex: string): RGB {
  const cleaned = hex.replace("#", "");
  const expanded =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;

  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

/**
 * Convert RGB to hex
 */
export function rgbToHex(rgb: RGB): string {
  const toHex = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Convert RGB to HSL
 */
export function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: l * 100 };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    case b:
      h = ((r - g) / d + 4) / 6;
      break;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to RGB
 */
export function hslToRgb(hsl: HSL): RGB {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  if (s === 0) {
    const gray = Math.round(l * 255);
    return { r: gray, g: gray, b: gray };
  }

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

  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

/**
 * Convert hex to HSL
 */
export function hexToHsl(hex: string): HSL {
  return rgbToHsl(hexToRgb(hex));
}

/**
 * Convert HSL to hex
 */
export function hslToHex(hsl: HSL): string {
  return rgbToHex(hslToRgb(hsl));
}

// =============================================================================
// Contrast & Accessibility
// =============================================================================

/**
 * Calculate relative luminance (WCAG 2.1)
 */
export function getRelativeLuminance(rgb: RGB): number {
  const [rs, gs, bs] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const l1 = getRelativeLuminance(hexToRgb(color1));
  const l2 = getRelativeLuminance(hexToRgb(color2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check WCAG AA compliance (4.5:1 for normal text)
 */
export function isWCAGAACompliant(
  foreground: string,
  background: string
): boolean {
  return getContrastRatio(foreground, background) >= 4.5;
}

/**
 * Check WCAG AAA compliance (7:1 for normal text)
 */
export function isWCAGAAACompliant(
  foreground: string,
  background: string
): boolean {
  return getContrastRatio(foreground, background) >= 7;
}

/**
 * Find best text color (black or white) for given background
 */
export function getBestTextColor(background: string): string {
  const luminance = getRelativeLuminance(hexToRgb(background));
  return luminance > 0.179 ? "#000000" : "#ffffff";
}

// =============================================================================
// Color Harmony Generation
// =============================================================================

/**
 * Generate complementary color (opposite on color wheel)
 */
function getComplementary(hsl: HSL): HSL {
  return { ...hsl, h: (hsl.h + 180) % 360 };
}

/**
 * Generate analogous colors (adjacent on color wheel)
 */
function getAnalogous(hsl: HSL): HSL[] {
  return [
    { ...hsl, h: (hsl.h - 30 + 360) % 360 },
    { ...hsl, h: (hsl.h + 30) % 360 },
  ];
}

/**
 * Generate triadic colors (evenly spaced on color wheel)
 */
function getTriadic(hsl: HSL): HSL[] {
  return [
    { ...hsl, h: (hsl.h + 120) % 360 },
    { ...hsl, h: (hsl.h + 240) % 360 },
  ];
}

/**
 * Generate split-complementary colors
 */
function getSplitComplementary(hsl: HSL): HSL[] {
  return [
    { ...hsl, h: (hsl.h + 150) % 360 },
    { ...hsl, h: (hsl.h + 210) % 360 },
  ];
}

/**
 * Generate tetradic colors (rectangle on color wheel)
 */
function getTetradic(hsl: HSL): HSL[] {
  return [
    { ...hsl, h: (hsl.h + 60) % 360 },
    { ...hsl, h: (hsl.h + 180) % 360 },
    { ...hsl, h: (hsl.h + 240) % 360 },
  ];
}

/**
 * Generate harmony colors based on type
 */
function generateHarmonyColors(
  baseHsl: HSL,
  harmony: PaletteConfig["harmony"]
): HSL[] {
  switch (harmony) {
    case "complementary":
      return [getComplementary(baseHsl)];
    case "analogous":
      return getAnalogous(baseHsl);
    case "triadic":
      return getTriadic(baseHsl);
    case "split-complementary":
      return getSplitComplementary(baseHsl);
    case "tetradic":
      return getTetradic(baseHsl);
    default:
      return [getComplementary(baseHsl)];
  }
}

// =============================================================================
// Shade Generation
// =============================================================================

/**
 * Generate color shades (50-950 scale like Tailwind)
 */
function generateShades(baseHex: string): Record<string, string> {
  const hsl = hexToHsl(baseHex);

  // Adjust lightness for each shade level
  const shadeConfig = [
    { name: "50", l: 97 },
    { name: "100", l: 94 },
    { name: "200", l: 86 },
    { name: "300", l: 76 },
    { name: "400", l: 64 },
    { name: "500", l: 50 },
    { name: "600", l: 42 },
    { name: "700", l: 34 },
    { name: "800", l: 26 },
    { name: "900", l: 18 },
    { name: "950", l: 10 },
  ];

  const shades: Record<string, string> = {};

  for (const { name, l } of shadeConfig) {
    // Adjust saturation based on lightness (less saturated at extremes)
    let adjustedS = hsl.s;
    if (l > 80) {
      adjustedS = Math.max(0, hsl.s - (l - 80) * 0.5);
    } else if (l < 30) {
      adjustedS = Math.max(0, hsl.s - (30 - l) * 0.3);
    }

    shades[name] = hslToHex({ h: hsl.h, s: adjustedS, l });
  }

  return shades;
}

// =============================================================================
// Style Adjustments
// =============================================================================

/**
 * Apply style adjustments to HSL color
 */
function applyStyle(hsl: HSL, style: PaletteConfig["style"]): HSL {
  switch (style) {
    case "vibrant":
      return { ...hsl, s: Math.min(100, hsl.s * 1.2) };
    case "muted":
      return { ...hsl, s: hsl.s * 0.6 };
    case "pastel":
      return { ...hsl, s: Math.min(50, hsl.s * 0.5), l: Math.max(75, hsl.l) };
    case "dark":
      return { ...hsl, l: Math.min(40, hsl.l * 0.7) };
    case "monochromatic":
      return { ...hsl, s: hsl.s * 0.3 };
    default:
      return hsl;
  }
}

// =============================================================================
// Color Generation with Metadata
// =============================================================================

/**
 * Create a GeneratedColor with full metadata
 */
function createGeneratedColor(hex: string, role: string): GeneratedColor {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb);
  const contrastOnWhite = getContrastRatio(hex, "#ffffff");
  const contrastOnBlack = getContrastRatio(hex, "#000000");

  return {
    hex,
    rgb,
    hsl,
    role,
    contrastOnWhite,
    contrastOnBlack,
    wcagAAOnWhite: contrastOnWhite >= 4.5,
    wcagAAOnBlack: contrastOnBlack >= 4.5,
  };
}

// =============================================================================
// Main Palette Generator
// =============================================================================

/**
 * Generate a complete color palette from a single base color
 *
 * @example
 * ```typescript
 * const palette = generatePalette({
 *   primary: "#3b82f6",
 *   style: "vibrant",
 *   harmony: "triadic",
 *   includeDarkMode: true,
 * });
 *
 * console.log(palette.light.primary.hex); // "#3b82f6"
 * console.log(palette.light.secondary.hex); // Generated complementary
 * ```
 */
export function generatePalette(config: PaletteConfig): GeneratedPalette {
  const {
    primary,
    style = "vibrant",
    harmony = "complementary",
    includeDarkMode = true,
  } = config;

  // Parse base color
  const baseHsl = hexToHsl(primary);
  const styledHsl = applyStyle(baseHsl, style);

  // Generate harmony colors
  const harmonyHsls = generateHarmonyColors(styledHsl, harmony);
  const harmonyColors = harmonyHsls.map((hsl, i) =>
    createGeneratedColor(hslToHex(applyStyle(hsl, style)), `harmony-${i + 1}`)
  );

  // Select secondary and accent from harmony
  const secondaryHsl = harmonyHsls[0] || getComplementary(styledHsl);
  const accentHsl =
    harmonyHsls[1] || { ...styledHsl, h: (styledHsl.h + 60) % 360 };

  // Generate light mode palette
  const light = {
    primary: createGeneratedColor(hslToHex(styledHsl), "primary"),
    secondary: createGeneratedColor(
      hslToHex(applyStyle(secondaryHsl, style)),
      "secondary"
    ),
    accent: createGeneratedColor(
      hslToHex(applyStyle(accentHsl, style)),
      "accent"
    ),
    background: createGeneratedColor("#ffffff", "background"),
    surface: createGeneratedColor("#f8fafc", "surface"),
    text: createGeneratedColor("#1e293b", "text"),
    textMuted: createGeneratedColor("#64748b", "textMuted"),
    border: createGeneratedColor("#e2e8f0", "border"),
    success: createGeneratedColor("#22c55e", "success"),
    warning: createGeneratedColor("#f59e0b", "warning"),
    error: createGeneratedColor("#ef4444", "error"),
  };

  // Generate dark mode palette
  let dark: GeneratedPalette["dark"];
  if (includeDarkMode) {
    // Adjust primary for dark mode (slightly lighter)
    const darkPrimaryHsl = { ...styledHsl, l: Math.min(70, styledHsl.l + 10) };
    const darkSecondaryHsl = {
      ...secondaryHsl,
      l: Math.min(70, secondaryHsl.l + 10),
    };
    const darkAccentHsl = { ...accentHsl, l: Math.min(70, accentHsl.l + 10) };

    dark = {
      primary: createGeneratedColor(hslToHex(darkPrimaryHsl), "primary"),
      secondary: createGeneratedColor(
        hslToHex(applyStyle(darkSecondaryHsl, style)),
        "secondary"
      ),
      accent: createGeneratedColor(
        hslToHex(applyStyle(darkAccentHsl, style)),
        "accent"
      ),
      background: createGeneratedColor("#0f172a", "background"),
      surface: createGeneratedColor("#1e293b", "surface"),
      text: createGeneratedColor("#f1f5f9", "text"),
      textMuted: createGeneratedColor("#94a3b8", "textMuted"),
      border: createGeneratedColor("#334155", "border"),
      success: createGeneratedColor("#34d399", "success"),
      warning: createGeneratedColor("#fbbf24", "warning"),
      error: createGeneratedColor("#f87171", "error"),
    };
  }

  // Generate shades
  const shadesHex = generateShades(primary);
  const shades: Record<string, GeneratedColor> = {};
  for (const [name, hex] of Object.entries(shadesHex)) {
    shades[name] = createGeneratedColor(hex, `shade-${name}`);
  }

  return {
    light,
    dark,
    shades,
    harmonyColors,
    meta: {
      baseColor: primary,
      style,
      harmony,
      generatedAt: new Date(),
    },
  };
}

// =============================================================================
// AI-Suggested Palettes
// =============================================================================

/** Palette suggestion based on industry/mood */
export interface PaletteSuggestion {
  name: string;
  description: string;
  config: PaletteConfig;
  tags: string[];
}

/**
 * Get AI-suggested palette configurations based on keywords
 */
export function suggestPalettes(keywords: string[]): PaletteSuggestion[] {
  const suggestions: PaletteSuggestion[] = [];
  const keywordsLower = keywords.map((k) => k.toLowerCase());

  // Tech/Software
  if (
    keywordsLower.some((k) =>
      ["tech", "software", "digital", "modern", "startup"].includes(k)
    )
  ) {
    suggestions.push({
      name: "Tech Blue",
      description: "Clean, professional blue palette for tech products",
      config: {
        primary: "#3b82f6",
        style: "vibrant",
        harmony: "analogous",
        includeDarkMode: true,
      },
      tags: ["tech", "professional", "modern"],
    });
  }

  // Creative/Design
  if (
    keywordsLower.some((k) =>
      ["creative", "design", "artistic", "bold", "agency"].includes(k)
    )
  ) {
    suggestions.push({
      name: "Creative Purple",
      description: "Bold, creative palette with vibrant purples",
      config: {
        primary: "#8b5cf6",
        style: "vibrant",
        harmony: "triadic",
        includeDarkMode: true,
      },
      tags: ["creative", "bold", "artistic"],
    });
  }

  // Nature/Organic
  if (
    keywordsLower.some((k) =>
      ["nature", "organic", "eco", "green", "wellness"].includes(k)
    )
  ) {
    suggestions.push({
      name: "Nature Green",
      description: "Fresh, organic palette inspired by nature",
      config: {
        primary: "#22c55e",
        style: "muted",
        harmony: "analogous",
        includeDarkMode: true,
      },
      tags: ["nature", "organic", "calm"],
    });
  }

  // Luxury/Premium
  if (
    keywordsLower.some((k) =>
      ["luxury", "premium", "elegant", "sophisticated", "gold"].includes(k)
    )
  ) {
    suggestions.push({
      name: "Luxury Gold",
      description: "Sophisticated palette with gold accents",
      config: {
        primary: "#d4af37",
        style: "muted",
        harmony: "complementary",
        includeDarkMode: true,
      },
      tags: ["luxury", "elegant", "premium"],
    });
  }

  // Playful/Fun
  if (
    keywordsLower.some((k) =>
      ["playful", "fun", "young", "vibrant", "energetic"].includes(k)
    )
  ) {
    suggestions.push({
      name: "Playful Pink",
      description: "Fun, energetic palette with bright pinks",
      config: {
        primary: "#ec4899",
        style: "vibrant",
        harmony: "split-complementary",
        includeDarkMode: true,
      },
      tags: ["playful", "fun", "energetic"],
    });
  }

  // Minimal/Clean
  if (
    keywordsLower.some((k) =>
      ["minimal", "clean", "simple", "monochrome", "neutral"].includes(k)
    )
  ) {
    suggestions.push({
      name: "Minimal Slate",
      description: "Clean, minimal palette with neutral tones",
      config: {
        primary: "#64748b",
        style: "monochromatic",
        harmony: "analogous",
        includeDarkMode: true,
      },
      tags: ["minimal", "clean", "neutral"],
    });
  }

  // Corporate/Business
  if (
    keywordsLower.some((k) =>
      ["corporate", "business", "professional", "trust", "enterprise"].includes(
        k
      )
    )
  ) {
    suggestions.push({
      name: "Corporate Navy",
      description: "Trustworthy, professional navy blue palette",
      config: {
        primary: "#1e40af",
        style: "muted",
        harmony: "complementary",
        includeDarkMode: true,
      },
      tags: ["corporate", "professional", "trust"],
    });
  }

  // Default suggestion if none match
  if (suggestions.length === 0) {
    suggestions.push({
      name: "Universal Blue",
      description: "Versatile blue palette suitable for most applications",
      config: {
        primary: "#2563eb",
        style: "vibrant",
        harmony: "complementary",
        includeDarkMode: true,
      },
      tags: ["versatile", "modern", "balanced"],
    });
  }

  return suggestions;
}

// =============================================================================
// Palette Export Utilities
// =============================================================================

/**
 * Export palette to CSS variables
 */
export function paletteToCSSVariables(
  palette: GeneratedPalette,
  prefix = "color"
): string {
  const lines: string[] = [":root {"];

  // Light mode colors
  for (const [key, color] of Object.entries(palette.light)) {
    lines.push(`  --${prefix}-${key}: ${color.hex};`);
  }

  // Shades
  for (const [shade, color] of Object.entries(palette.shades)) {
    lines.push(`  --${prefix}-primary-${shade}: ${color.hex};`);
  }

  lines.push("}");

  // Dark mode
  if (palette.dark) {
    lines.push("");
    lines.push("@media (prefers-color-scheme: dark) {");
    lines.push("  :root {");
    for (const [key, color] of Object.entries(palette.dark)) {
      lines.push(`    --${prefix}-${key}: ${color.hex};`);
    }
    lines.push("  }");
    lines.push("}");
  }

  return lines.join("\n");
}

/**
 * Export palette to Tailwind config format
 */
export function paletteToTailwindConfig(
  palette: GeneratedPalette
): Record<string, Record<string, string>> {
  const config: Record<string, Record<string, string>> = {
    primary: {},
    secondary: {},
    accent: {},
  };

  // Add shades to primary
  for (const [shade, color] of Object.entries(palette.shades)) {
    config.primary[shade] = color.hex;
  }

  // Add DEFAULT values
  config.primary.DEFAULT = palette.light.primary.hex;
  config.secondary.DEFAULT = palette.light.secondary.hex;
  config.accent.DEFAULT = palette.light.accent.hex;

  return config;
}

// =============================================================================
// Export
// =============================================================================

export default {
  generatePalette,
  suggestPalettes,
  paletteToCSSVariables,
  paletteToTailwindConfig,
  hexToRgb,
  rgbToHex,
  hexToHsl,
  hslToHex,
  getContrastRatio,
  isWCAGAACompliant,
  isWCAGAAACompliant,
  getBestTextColor,
};
