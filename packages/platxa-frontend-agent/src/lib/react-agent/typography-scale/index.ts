/**
 * Typography Scale Module
 *
 * Modular typography system with 3-level hierarchy
 * for clear, consistent visual hierarchy.
 */

// Types
export type {
  HierarchyLevel,
  TypographyRole,
  FontWeight,
  FontWeightValue,
  ScaleRatio,
  TypographyUnit,
  TypeSize,
  TypeStyle,
  ScaleStep,
  TypographyScale,
  HierarchyConfig,
  SemanticTypography,
  FluidConfig,
  ResponsiveTypography,
  ScaleOptions,
  HierarchyOptions,
  TypographyCss,
  FontStacks,
  TypographyValidation,
  TypographyPreset,
} from "./types"

// Constants
export {
  SCALE_RATIOS,
  FONT_WEIGHTS,
  DEFAULT_STEP_NAMES,
  DEFAULT_FONT_STACKS,
  DEFAULT_HIERARCHY_CONFIG,
  DEFAULT_SCALE_OPTIONS,
} from "./typography-scale"

// Scale utilities
export {
  getRatioValue,
  getFontWeightValue,
  calculateLineHeight,
  calculateLetterSpacing,
  convertToUnit,
} from "./typography-scale"

// Scale generation
export {
  generateScale,
  getScaleStep,
  getStepAtIndex,
} from "./typography-scale"

// Hierarchy generation
export { generateSemanticTypography } from "./typography-scale"

// Fluid typography
export { generateFluidSize, generateFluidScale } from "./typography-scale"

// CSS generation
export { generateTypographyCss } from "./typography-scale"

// Validation
export { validateTypography } from "./typography-scale"

// Presets
export {
  PRESET_MODERN,
  PRESET_EDITORIAL,
  PRESET_COMPACT,
  TYPOGRAPHY_PRESETS,
} from "./typography-scale"

// Factory
export { createTypographySystem } from "./typography-scale"
