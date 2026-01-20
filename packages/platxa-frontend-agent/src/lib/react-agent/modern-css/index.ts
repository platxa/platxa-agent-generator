/**
 * Modern CSS Module
 *
 * Utilities for modern CSS features including container queries,
 * :has() selector, gradients, and 3D transforms.
 */

// Types
export type {
  ContainerType,
  ContainerBreakpoint,
  ContainerDefinition,
  ContainerQueryRule,
  ContainerQueryConfig,
  HasPattern,
  HasSelectorRule,
  HasUseCases,
  GradientType,
  GradientDirection,
  RadialShape,
  RadialSize,
  GradientStop,
  LinearGradientConfig,
  RadialGradientConfig,
  ConicGradientConfig,
  GradientConfig,
  GradientPreset,
  ViewTransitionName,
  ViewTransitionConfig,
  Transform3DConfig,
  ModernCssOutput,
} from "./types"

// Container Queries (Feature #44)
export {
  DEFAULT_CONTAINER_BREAKPOINTS,
  createContainerQuerySystem,
  generateContainerQuery,
} from "./modern-css"

// :has() Selector (Feature #45)
export {
  generateHasSelector,
  HAS_PATTERNS,
  generateHasUtilities,
} from "./modern-css"

// Gradients (Feature #46)
export {
  generateLinearGradient,
  generateRadialGradient,
  generateConicGradient,
  generateGradient,
  GRADIENT_PRESETS,
  generateGradientUtilities,
} from "./modern-css"

// 3D Transforms (Feature #49)
export {
  generate3DTransform,
  generate3DUtilities,
} from "./modern-css"

// Factory
export {
  createModernCssSystem,
  type ModernCssSystemConfig,
  type ModernCssSystem,
} from "./modern-css"
