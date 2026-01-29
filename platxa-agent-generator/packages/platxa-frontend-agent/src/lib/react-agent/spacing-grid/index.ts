/**
 * Spacing Grid Module
 *
 * 8px/4px grid-based spacing system for consistent, harmonious layouts.
 * All spacing values are multiples of the base unit.
 */

// Types
export type {
  SpacingUnit,
  SpacingMultiplier,
  SemanticSpacing,
  SpacingOutputUnit,
  SpacingValue,
  SpacingScale,
  SemanticSpacingTokens,
  ComponentSpacing,
  LayoutSpacing,
  SpacingGridConfig,
  SpacingValidation,
  SpacingCss,
  SpacingPreset,
  BoxSpacing,
  InsetSpacing,
} from "./types"

// Constants
export {
  DEFAULT_GRID_CONFIG,
  SPACING_MULTIPLIERS,
  DEFAULT_SEMANTIC_MAPPING,
} from "./spacing-grid"

// Core functions
export {
  createSpacingValue,
  spacing,
  pxToUnits,
  unitsToPx,
  isOnGrid,
  snapToGrid,
  floorToGrid,
  ceilToGrid,
} from "./spacing-grid"

// Scale generation
export {
  generateSpacingScale,
  generateSemanticSpacing,
  generateComponentSpacing,
  generateLayoutSpacing,
} from "./spacing-grid"

// Validation
export {
  validateSpacing,
  validateSpacingValues,
  allOnGrid,
} from "./spacing-grid"

// Box spacing utilities
export {
  boxSpacing,
  boxSpacingXY,
  boxSpacingTRBL,
  formatBoxSpacing,
} from "./spacing-grid"

// CSS generation
export { generateSpacingCss } from "./spacing-grid"

// Presets
export {
  PRESET_4PX,
  PRESET_8PX,
  PRESET_COMPACT,
  SPACING_PRESETS,
} from "./spacing-grid"

// Factory
export { createSpacingSystem } from "./spacing-grid"
