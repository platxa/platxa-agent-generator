/**
 * Accessibility Auditor - Type Definitions
 *
 * Types for WCAG 2.2 compliance checking including
 * contrast ratios, ARIA validation, and keyboard navigation.
 */

/**
 * WCAG conformance levels
 */
export type WcagLevel = "A" | "AA" | "AAA"

/**
 * WCAG version
 */
export type WcagVersion = "2.0" | "2.1" | "2.2"

/**
 * Accessibility issue severity
 */
export type IssueSeverity = "error" | "warning" | "info"

/**
 * WCAG success criterion category
 */
export type WcagCategory =
  | "perceivable"
  | "operable"
  | "understandable"
  | "robust"

/**
 * Common WCAG success criteria IDs
 */
export type WcagCriterion =
  // Perceivable
  | "1.1.1" // Non-text Content
  | "1.3.1" // Info and Relationships
  | "1.3.2" // Meaningful Sequence
  | "1.3.3" // Sensory Characteristics
  | "1.4.1" // Use of Color
  | "1.4.3" // Contrast (Minimum)
  | "1.4.4" // Resize Text
  | "1.4.5" // Images of Text
  | "1.4.6" // Contrast (Enhanced)
  | "1.4.10" // Reflow
  | "1.4.11" // Non-text Contrast
  | "1.4.12" // Text Spacing
  | "1.4.13" // Content on Hover or Focus
  // Operable
  | "2.1.1" // Keyboard
  | "2.1.2" // No Keyboard Trap
  | "2.1.4" // Character Key Shortcuts
  | "2.4.1" // Bypass Blocks
  | "2.4.2" // Page Titled
  | "2.4.3" // Focus Order
  | "2.4.4" // Link Purpose
  | "2.4.6" // Headings and Labels
  | "2.4.7" // Focus Visible
  | "2.4.11" // Focus Not Obscured
  | "2.5.3" // Label in Name
  | "2.5.8" // Target Size (Minimum)
  // Understandable
  | "3.1.1" // Language of Page
  | "3.2.1" // On Focus
  | "3.2.2" // On Input
  | "3.3.1" // Error Identification
  | "3.3.2" // Labels or Instructions
  // Robust
  | "4.1.1" // Parsing
  | "4.1.2" // Name, Role, Value
  | "4.1.3" // Status Messages

/**
 * RGB color for contrast calculations
 */
export interface RgbColor {
  r: number
  g: number
  b: number
}

/**
 * Contrast ratio result
 */
export interface ContrastResult {
  /** Calculated contrast ratio (1-21) */
  ratio: number
  /** Formatted ratio string (e.g., "4.5:1") */
  ratioString: string
  /** Passes WCAG AA for normal text (4.5:1) */
  passesAA: boolean
  /** Passes WCAG AA for large text (3:1) */
  passesAALarge: boolean
  /** Passes WCAG AAA for normal text (7:1) */
  passesAAA: boolean
  /** Passes WCAG AAA for large text (4.5:1) */
  passesAAALarge: boolean
  /** Foreground color used */
  foreground: string
  /** Background color used */
  background: string
}

/**
 * ARIA role categories
 */
export type AriaRoleCategory =
  | "widget"
  | "composite"
  | "document"
  | "landmark"
  | "live"
  | "window"
  | "abstract"

/**
 * Common ARIA roles
 */
export type AriaRole =
  // Widget roles
  | "button"
  | "checkbox"
  | "gridcell"
  | "link"
  | "menuitem"
  | "menuitemcheckbox"
  | "menuitemradio"
  | "option"
  | "progressbar"
  | "radio"
  | "scrollbar"
  | "searchbox"
  | "slider"
  | "spinbutton"
  | "switch"
  | "tab"
  | "tabpanel"
  | "textbox"
  | "treeitem"
  // Composite roles
  | "combobox"
  | "grid"
  | "listbox"
  | "menu"
  | "menubar"
  | "radiogroup"
  | "tablist"
  | "tree"
  | "treegrid"
  // Document structure
  | "article"
  | "cell"
  | "columnheader"
  | "definition"
  | "directory"
  | "document"
  | "figure"
  | "group"
  | "heading"
  | "img"
  | "list"
  | "listitem"
  | "math"
  | "none"
  | "note"
  | "presentation"
  | "row"
  | "rowgroup"
  | "rowheader"
  | "separator"
  | "table"
  | "term"
  | "toolbar"
  | "tooltip"
  // Landmark roles
  | "banner"
  | "complementary"
  | "contentinfo"
  | "form"
  | "main"
  | "navigation"
  | "region"
  | "search"
  // Live region roles
  | "alert"
  | "log"
  | "marquee"
  | "status"
  | "timer"
  // Window roles
  | "alertdialog"
  | "dialog"

/**
 * Required ARIA attributes for roles
 */
export interface AriaRoleRequirements {
  /** Role name */
  role: AriaRole
  /** Required attributes */
  required: string[]
  /** Supported (optional) attributes */
  supported: string[]
  /** Implicit value attributes */
  implicit?: Record<string, string>
  /** Allowed child roles */
  allowedChildren?: AriaRole[]
  /** Required parent roles */
  requiredParent?: AriaRole[]
}

/**
 * Accessibility issue found during audit
 */
export interface AccessibilityIssue {
  /** Unique issue ID */
  id: string
  /** WCAG criterion violated */
  criterion: WcagCriterion
  /** Conformance level */
  level: WcagLevel
  /** Issue severity */
  severity: IssueSeverity
  /** Human-readable message */
  message: string
  /** Element selector or identifier */
  element?: string
  /** Suggested fix */
  suggestion?: string
  /** Additional context */
  context?: Record<string, unknown>
}

/**
 * Audit result for a component or page
 */
export interface AuditResult {
  /** Whether audit passed (no errors) */
  passed: boolean
  /** Total issues found */
  totalIssues: number
  /** Issues by severity */
  bySeverity: {
    errors: number
    warnings: number
    info: number
  }
  /** Issues by WCAG level */
  byLevel: {
    A: number
    AA: number
    AAA: number
  }
  /** Detailed issues list */
  issues: AccessibilityIssue[]
  /** Accessibility score (0-100) */
  score: number
  /** Audit timestamp */
  timestamp: Date
}

/**
 * Component accessibility requirements
 */
export interface ComponentA11yRequirements {
  /** Component type */
  component: string
  /** Required ARIA role */
  role?: AriaRole
  /** Required ARIA attributes */
  requiredAttributes?: string[]
  /** Required keyboard interactions */
  keyboardInteractions?: string[]
  /** Focus management requirements */
  focusManagement?: string[]
  /** Screen reader announcements */
  announcements?: string[]
}

/**
 * Focus indicator requirements (WCAG 2.4.7, 2.4.11)
 */
export interface FocusIndicatorRequirements {
  /** Minimum focus indicator area (px²) */
  minArea: number
  /** Minimum contrast ratio */
  minContrast: number
  /** Indicator should not be obscured */
  notObscured: boolean
  /** Recommended: two-color indicator */
  twoColorIndicator: boolean
}

/**
 * Target size requirements (WCAG 2.5.8)
 */
export interface TargetSizeRequirements {
  /** Minimum target size for AA (24x24 CSS pixels) */
  minSizeAA: number
  /** Minimum target size for AAA (44x44 CSS pixels) */
  minSizeAAA: number
  /** Minimum spacing between targets */
  minSpacing: number
}

/**
 * Audit configuration options
 */
export interface AuditConfig {
  /** WCAG level to check against */
  level?: WcagLevel
  /** WCAG version */
  version?: WcagVersion
  /** Include warnings */
  includeWarnings?: boolean
  /** Include informational issues */
  includeInfo?: boolean
  /** Specific criteria to check */
  criteria?: WcagCriterion[]
  /** Criteria to skip */
  skipCriteria?: WcagCriterion[]
}

/**
 * Color blindness simulation types
 */
export type ColorBlindnessType =
  | "protanopia"    // Red-blind
  | "deuteranopia"  // Green-blind
  | "tritanopia"    // Blue-blind
  | "achromatopsia" // Complete color blindness

/**
 * Keyboard navigation check result
 */
export interface KeyboardCheckResult {
  /** Element is focusable */
  focusable: boolean
  /** Has visible focus indicator */
  visibleFocus: boolean
  /** Not a keyboard trap */
  noTrap: boolean
  /** Logical focus order */
  logicalOrder: boolean
  /** Supports expected keyboard interactions */
  keyboardInteractions: boolean
}

/**
 * Screen reader compatibility check
 */
export interface ScreenReaderCheck {
  /** Has accessible name */
  hasAccessibleName: boolean
  /** Accessible name value */
  accessibleName?: string
  /** Has appropriate role */
  hasRole: boolean
  /** Role value */
  role?: string
  /** Has required ARIA attributes */
  hasRequiredAria: boolean
  /** Missing attributes */
  missingAttributes?: string[]
}
