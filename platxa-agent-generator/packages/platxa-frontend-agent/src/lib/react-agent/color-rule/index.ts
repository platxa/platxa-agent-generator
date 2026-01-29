/**
 * Color Rule Module - 60-30-10 Rule Enforcement
 *
 * Analyzes and enforces the 60-30-10 color balance rule
 * for creating visually harmonious and balanced designs.
 */

// Types
export type {
  ColorRole,
  ColorUsageCategory,
  ColorEntry,
  ColorDistribution,
  RuleTolerance,
  ColorBalanceResult,
  ColorSuggestion,
  ColorPalette,
  ElementColorMap,
  WeightMultipliers,
  ComponentColorAnalysis,
  LayoutColorAnalysis,
  ColorRuleConfig,
  ColorHarmony,
  ColorHarmonyResult,
  StyleColorExtract,
  ColorConversion,
  ContrastResult,
} from "./types"

// Constants
export {
  DEFAULT_DISTRIBUTION,
  DEFAULT_TOLERANCE,
  DEFAULT_WEIGHTS,
  DEFAULT_ELEMENT_MAPPING,
} from "./color-rule"

// Color conversion utilities
export {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  convertColor,
  getRelativeLuminance,
  calculateContrast,
} from "./color-rule"

// Color analysis
export {
  categorizeColorUsage,
  assignColorRole,
  calculateColorWeight,
  createColorEntry,
  extractColorsFromStyles,
} from "./color-rule"

// Distribution analysis
export {
  calculateDistribution,
  isWithinTolerance,
  calculateDeviation,
  generateSuggestions,
  calculateBalanceScore,
} from "./color-rule"

// Balance analysis
export {
  analyzeColorBalance,
  analyzeComponent,
  analyzeLayout,
  extractPalette,
} from "./color-rule"

// Color harmony
export { detectHarmony, analyzeHarmony } from "./color-rule"

// Enforcement utilities
export {
  suggestRoleReassignment,
  createBalancedConfig,
  validatePalette,
} from "./color-rule"

// Factory
export { createColorRuleAnalyzer } from "./color-rule"
