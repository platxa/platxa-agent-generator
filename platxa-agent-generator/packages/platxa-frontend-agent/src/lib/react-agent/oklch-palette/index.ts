/**
 * OKLCH Palette Module
 *
 * Tailwind v4 compatible OKLCH color palette generation
 * with P3 wide gamut support.
 */

// Types
export type {
  OklchColor,
  RgbColor,
  HslColor,
  ColorGamut,
  GamutColor,
  PaletteMode,
  ShadeConfig,
  TailwindShadeScale,
  ColorPalette,
  HarmonyPalette,
  PaletteOptions,
  SemanticPalette,
  OklchThemeConfig,
  ContrastPair,
  ColorAdjustment,
  InterpolationOptions,
  ParsedColor,
  GamutMapResult,
  AccessibleColorSuggestion,
} from "./types"

// Constants
export { DEFAULT_SHADE_CONFIG, TAILWIND_SHADES } from "./oklch-palette"

// Color conversion
export {
  rgbToOklch,
  oklchToRgb,
  hexToOklch,
  oklchToHex,
  hslToOklch,
  oklchToHsl,
  parseColor,
} from "./oklch-palette"

// OKLCH formatting
export { formatOklch, formatTailwindOklch } from "./oklch-palette"

// Gamut mapping
export {
  isInSrgbGamut,
  getMaxChroma,
  mapToGamut,
  createGamutColor,
} from "./oklch-palette"

// Color manipulation
export {
  adjustColor,
  lighten,
  darken,
  saturate,
  desaturate,
  rotateHue,
  mixColors,
  interpolateColors,
} from "./oklch-palette"

// Shade generation
export { generateShadeScale } from "./oklch-palette"

// Palette generation
export {
  generatePalette,
  generateComplementaryPalette,
  generateAnalogousPalette,
  generateTriadicPalette,
  generateSplitComplementaryPalette,
  generateTetradicPalette,
} from "./oklch-palette"

// Monochromatic palette (Feature #23)
export type {
  MonochromaticConfig,
  MonochromaticPalette,
} from "./oklch-palette"

export {
  generateMonochromaticPalette,
  generateElegantGrayscale,
} from "./oklch-palette"

// Accessibility
export {
  calculateContrastRatio,
  checkContrast,
  findAccessibleColor,
} from "./oklch-palette"

// Factory
export { createPaletteGenerator } from "./oklch-palette"
