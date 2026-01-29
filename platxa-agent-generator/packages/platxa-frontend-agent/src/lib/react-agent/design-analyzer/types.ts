/**
 * Design Analyzer - Type Definitions
 *
 * Types for extracting visual requirements from natural language
 * descriptions and mapping them to component specifications.
 */

/**
 * Detected component types
 */
export type ComponentType =
  | "button"
  | "card"
  | "input"
  | "form"
  | "modal"
  | "dialog"
  | "dropdown"
  | "select"
  | "checkbox"
  | "radio"
  | "switch"
  | "slider"
  | "tabs"
  | "accordion"
  | "menu"
  | "navbar"
  | "sidebar"
  | "footer"
  | "header"
  | "hero"
  | "banner"
  | "alert"
  | "toast"
  | "tooltip"
  | "popover"
  | "badge"
  | "avatar"
  | "table"
  | "list"
  | "grid"
  | "carousel"
  | "pagination"
  | "breadcrumb"
  | "progress"
  | "skeleton"
  | "spinner"
  | "divider"
  | "container"
  | "section"
  | "unknown"

/**
 * Component category for grouping
 */
export type ComponentCategory =
  | "action"      // buttons, links
  | "input"       // form inputs
  | "display"     // cards, badges, avatars
  | "feedback"    // alerts, toasts, progress
  | "navigation"  // menus, tabs, breadcrumbs
  | "layout"      // containers, grids, dividers
  | "overlay"     // modals, popovers, tooltips

/**
 * Visual style variants
 */
export type StyleVariant =
  | "default"
  | "primary"
  | "secondary"
  | "tertiary"
  | "ghost"
  | "outline"
  | "link"
  | "destructive"
  | "success"
  | "warning"
  | "info"

/**
 * Size variants
 */
export type SizeVariant =
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "full"

/**
 * Shape variants
 */
export type ShapeVariant =
  | "square"
  | "rounded"
  | "pill"
  | "circle"

/**
 * Detected color intent
 */
export interface ColorIntent {
  /** Primary color keyword or hex */
  primary?: string
  /** Secondary color */
  secondary?: string
  /** Accent color */
  accent?: string
  /** Background color */
  background?: string
  /** Text/foreground color */
  foreground?: string
  /** Border color */
  border?: string
  /** Semantic intent */
  semantic?: "success" | "warning" | "error" | "info" | "neutral"
}

/**
 * Detected spacing requirements
 */
export interface SpacingIntent {
  /** Padding level */
  padding?: "none" | "tight" | "normal" | "relaxed" | "spacious"
  /** Margin/gap level */
  gap?: "none" | "tight" | "normal" | "relaxed" | "spacious"
  /** Specific padding values */
  paddingX?: string
  paddingY?: string
  /** Specific margin values */
  marginX?: string
  marginY?: string
}

/**
 * Detected typography requirements
 */
export interface TypographyIntent {
  /** Font size */
  size?: SizeVariant
  /** Font weight */
  weight?: "thin" | "light" | "normal" | "medium" | "semibold" | "bold" | "extrabold"
  /** Text alignment */
  align?: "left" | "center" | "right" | "justify"
  /** Text transform */
  transform?: "none" | "uppercase" | "lowercase" | "capitalize"
  /** Font family */
  family?: "sans" | "serif" | "mono"
}

/**
 * Detected interaction patterns
 */
export interface InteractionIntent {
  /** Hover effects */
  hover?: {
    effect: "lift" | "scale" | "glow" | "darken" | "lighten" | "none"
    intensity?: "subtle" | "moderate" | "strong"
  }
  /** Click/press effects */
  press?: {
    effect: "scale" | "push" | "ripple" | "none"
  }
  /** Focus styles */
  focus?: {
    ring?: boolean
    outline?: boolean
  }
  /** Disabled state mentioned */
  hasDisabledState?: boolean
  /** Loading state mentioned */
  hasLoadingState?: boolean
}

/**
 * Detected animation requirements
 */
export interface AnimationIntent {
  /** Entry animation */
  entrance?: "fade" | "slide" | "scale" | "bounce" | "none"
  /** Exit animation */
  exit?: "fade" | "slide" | "scale" | "none"
  /** Direction for slide */
  direction?: "up" | "down" | "left" | "right"
  /** Animation speed */
  speed?: "instant" | "fast" | "normal" | "slow"
  /** Should support reduced motion */
  respectReducedMotion?: boolean
}

/**
 * Detected layout requirements
 */
export interface LayoutIntent {
  /** Display type */
  display?: "block" | "inline" | "flex" | "grid"
  /** Flex direction */
  direction?: "row" | "column"
  /** Alignment */
  align?: "start" | "center" | "end" | "stretch" | "between"
  /** Justify */
  justify?: "start" | "center" | "end" | "between" | "around"
  /** Width behavior */
  width?: "auto" | "full" | "fixed"
  /** Responsive requirements */
  responsive?: boolean
}

/**
 * Detected content elements
 */
export interface ContentIntent {
  /** Has icon */
  hasIcon?: boolean
  /** Icon position */
  iconPosition?: "left" | "right" | "only"
  /** Has image */
  hasImage?: boolean
  /** Has text content */
  hasText?: boolean
  /** Has title/heading */
  hasTitle?: boolean
  /** Has description */
  hasDescription?: boolean
  /** Has action buttons */
  hasActions?: boolean
  /** Has close/dismiss button */
  hasDismiss?: boolean
}

/**
 * Detected accessibility requirements
 */
export interface AccessibilityIntent {
  /** Needs ARIA label */
  needsAriaLabel?: boolean
  /** Needs keyboard support */
  needsKeyboardSupport?: boolean
  /** Needs focus management */
  needsFocusManagement?: boolean
  /** Needs screen reader announcements */
  needsAnnouncements?: boolean
  /** Mentioned a11y explicitly */
  explicitlyMentioned?: boolean
}

/**
 * Complete extracted design requirements
 */
export interface DesignRequirements {
  /** Detected component type */
  componentType: ComponentType
  /** Component category */
  category: ComponentCategory
  /** Confidence score 0-1 */
  confidence: number
  /** Style variant */
  variant?: StyleVariant
  /** Size */
  size?: SizeVariant
  /** Shape */
  shape?: ShapeVariant
  /** Color requirements */
  colors?: ColorIntent
  /** Spacing requirements */
  spacing?: SpacingIntent
  /** Typography requirements */
  typography?: TypographyIntent
  /** Interaction patterns */
  interactions?: InteractionIntent
  /** Animation requirements */
  animations?: AnimationIntent
  /** Layout requirements */
  layout?: LayoutIntent
  /** Content elements */
  content?: ContentIntent
  /** Accessibility requirements */
  accessibility?: AccessibilityIntent
  /** Raw keywords extracted */
  keywords: string[]
  /** Original description */
  originalDescription: string
}

/**
 * Pattern match result
 */
export interface PatternMatch {
  /** Pattern name */
  pattern: string
  /** Matched keywords */
  matches: string[]
  /** Match confidence 0-1 */
  confidence: number
  /** Extracted value if any */
  value?: string
}

/**
 * Analysis result with multiple possible interpretations
 */
export interface AnalysisResult {
  /** Primary interpretation */
  primary: DesignRequirements
  /** Alternative interpretations if ambiguous */
  alternatives?: DesignRequirements[]
  /** Warnings or suggestions */
  warnings?: string[]
  /** Missing information that could improve generation */
  suggestions?: string[]
}

/**
 * Keyword patterns for detection
 */
export interface KeywordPattern {
  /** Pattern ID */
  id: string
  /** Keywords that match this pattern */
  keywords: string[]
  /** Regex patterns */
  patterns?: RegExp[]
  /** What this pattern indicates */
  indicates: Partial<DesignRequirements>
  /** Priority (higher = more specific) */
  priority: number
}

/**
 * Analyzer configuration
 */
export interface AnalyzerConfig {
  /** Enable fuzzy matching */
  fuzzyMatch?: boolean
  /** Minimum confidence threshold */
  minConfidence?: number
  /** Include alternative interpretations */
  includeAlternatives?: boolean
  /** Default values for missing requirements */
  defaults?: Partial<DesignRequirements>
}
