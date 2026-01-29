/**
 * Modern CSS Types
 *
 * Types for modern CSS features including container queries,
 * :has() selector, gradients, and view transitions.
 */

// =============================================================================
// Container Queries (Feature #44)
// =============================================================================

/**
 * Container type
 */
export type ContainerType = "inline-size" | "size" | "normal"

/**
 * Container query breakpoint
 */
export interface ContainerBreakpoint {
  /** Breakpoint name */
  name: string
  /** Min width in pixels */
  minWidth?: number
  /** Max width in pixels */
  maxWidth?: number
  /** Min height in pixels */
  minHeight?: number
  /** Max height in pixels */
  maxHeight?: number
}

/**
 * Container definition
 */
export interface ContainerDefinition {
  /** Container name */
  name: string
  /** Container type */
  type: ContainerType
  /** Custom breakpoints */
  breakpoints?: ContainerBreakpoint[]
}

/**
 * Container query rule
 */
export interface ContainerQueryRule {
  /** Container name (optional, queries nearest container if omitted) */
  container?: string
  /** Query condition */
  condition: string
  /** CSS properties to apply */
  styles: Record<string, string>
}

/**
 * Container query config
 */
export interface ContainerQueryConfig {
  /** Container definitions */
  containers: ContainerDefinition[]
  /** Default breakpoints */
  defaultBreakpoints: ContainerBreakpoint[]
}

// =============================================================================
// :has() Selector (Feature #45)
// =============================================================================

/**
 * Has selector pattern
 */
export type HasPattern =
  | "has-child" // :has(> child)
  | "has-descendant" // :has(descendant)
  | "has-sibling" // :has(+ sibling)
  | "has-checked" // :has(input:checked)
  | "has-focus" // :has(:focus)
  | "has-empty" // :has(:empty)
  | "has-hover" // :has(:hover)

/**
 * Has selector rule
 */
export interface HasSelectorRule {
  /** Parent selector */
  parent: string
  /** Has pattern */
  pattern: HasPattern
  /** Target selector within :has() */
  target: string
  /** Styles to apply to parent when condition matches */
  styles: Record<string, string>
}

/**
 * Common :has() use cases
 */
export interface HasUseCases {
  /** Style parent based on form validity */
  formValidity: HasSelectorRule
  /** Style container based on empty state */
  emptyState: HasSelectorRule
  /** Style label when input is focused */
  inputFocus: HasSelectorRule
  /** Style card when checkbox is checked */
  checkedState: HasSelectorRule
}

// =============================================================================
// Gradients (Feature #46)
// =============================================================================

/**
 * Gradient type
 */
export type GradientType = "linear" | "radial" | "conic"

/**
 * Gradient direction for linear gradients
 */
export type GradientDirection =
  | "to-t"
  | "to-tr"
  | "to-r"
  | "to-br"
  | "to-b"
  | "to-bl"
  | "to-l"
  | "to-tl"
  | number // Angle in degrees

/**
 * Radial gradient shape
 */
export type RadialShape = "circle" | "ellipse"

/**
 * Radial gradient size
 */
export type RadialSize =
  | "closest-side"
  | "closest-corner"
  | "farthest-side"
  | "farthest-corner"

/**
 * Gradient color stop
 */
export interface GradientStop {
  /** Color value */
  color: string
  /** Position (0-100 or CSS value) */
  position?: number | string
}

/**
 * Linear gradient config
 */
export interface LinearGradientConfig {
  type: "linear"
  /** Direction or angle */
  direction: GradientDirection
  /** Color stops */
  stops: GradientStop[]
  /** Repeating gradient */
  repeating?: boolean
}

/**
 * Radial gradient config
 */
export interface RadialGradientConfig {
  type: "radial"
  /** Shape */
  shape?: RadialShape
  /** Size */
  size?: RadialSize
  /** Position (e.g., "center", "top left", "50% 50%") */
  position?: string
  /** Color stops */
  stops: GradientStop[]
  /** Repeating gradient */
  repeating?: boolean
}

/**
 * Conic gradient config
 */
export interface ConicGradientConfig {
  type: "conic"
  /** Starting angle in degrees */
  from?: number
  /** Position */
  position?: string
  /** Color stops */
  stops: GradientStop[]
  /** Repeating gradient */
  repeating?: boolean
}

/**
 * Any gradient config
 */
export type GradientConfig =
  | LinearGradientConfig
  | RadialGradientConfig
  | ConicGradientConfig

/**
 * Gradient preset
 */
export interface GradientPreset {
  /** Preset name */
  name: string
  /** Description */
  description: string
  /** Gradient config */
  gradient: GradientConfig
  /** CSS output */
  css: string
}

// =============================================================================
// View Transitions (Feature #48)
// =============================================================================

/**
 * View transition name
 */
export interface ViewTransitionName {
  /** Element identifier */
  element: string
  /** Transition name */
  name: string
}

/**
 * View transition config
 */
export interface ViewTransitionConfig {
  /** Named elements */
  names: ViewTransitionName[]
  /** Default duration */
  duration?: string
  /** Default easing */
  easing?: string
}

// =============================================================================
// 3D Transforms (Feature #49)
// =============================================================================

/**
 * 3D transform config
 */
export interface Transform3DConfig {
  /** Perspective value */
  perspective?: string
  /** Preserve 3D */
  preserve3d?: boolean
  /** Rotate X */
  rotateX?: number
  /** Rotate Y */
  rotateY?: number
  /** Rotate Z */
  rotateZ?: number
  /** Translate Z */
  translateZ?: string
  /** Scale Z */
  scaleZ?: number
}

// =============================================================================
// CSS Output
// =============================================================================

/**
 * Modern CSS output
 */
export interface ModernCssOutput {
  /** CSS content */
  css: string
  /** Tailwind classes */
  tailwindClasses?: string[]
  /** Required browser support */
  browserSupport: {
    /** Chrome version */
    chrome?: number
    /** Firefox version */
    firefox?: number
    /** Safari version */
    safari?: number
    /** Edge version */
    edge?: number
  }
  /** Fallback CSS for older browsers */
  fallback?: string
}
