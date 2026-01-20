/**
 * Atomic Design - Type Definitions
 *
 * Types for organizing components using Atomic Design methodology:
 * - Atoms: Basic building blocks (buttons, inputs, labels)
 * - Molecules: Combinations of atoms (form fields, search bars)
 * - Organisms: Complex sections combining molecules (headers, footers)
 * - Templates: Page-level layouts
 * - Pages: Specific instances with real content
 */

/**
 * Atomic design levels
 */
export type AtomicLevel = "atom" | "molecule" | "organism" | "template" | "page"

/**
 * Component complexity indicators
 */
export interface ComplexityIndicators {
  /** Number of child components */
  childCount: number
  /** Number of props */
  propCount: number
  /** Has internal state */
  hasState: boolean
  /** Uses context */
  usesContext: boolean
  /** Number of event handlers */
  eventHandlers: number
  /** Contains other custom components */
  composesComponents: boolean
  /** Is a layout component */
  isLayout: boolean
  /** Has data fetching */
  hasDataFetching: boolean
}

/**
 * Classification result
 */
export interface AtomicClassification {
  /** Determined atomic level */
  level: AtomicLevel
  /** Confidence score (0-1) */
  confidence: number
  /** Reasoning for classification */
  reasoning: string[]
  /** Suggested directory path */
  suggestedPath: string
  /** Alternative classifications considered */
  alternatives?: Array<{
    level: AtomicLevel
    confidence: number
    reason: string
  }>
}

/**
 * Component metadata for classification
 */
export interface ComponentMetadata {
  /** Component name */
  name: string
  /** Component type hint */
  type?: string
  /** Description */
  description?: string
  /** Props list */
  props?: string[]
  /** Children components used */
  children?: string[]
  /** Imports from other components */
  imports?: string[]
  /** Has slots/composition patterns */
  hasSlots?: boolean
  /** Is primarily for layout */
  isLayoutComponent?: boolean
  /** Contains multiple sections */
  hasSections?: boolean
}

/**
 * Atom template configuration
 */
export interface AtomTemplate {
  /** Component name */
  name: string
  /** Component category */
  category: AtomCategory
  /** Base element type */
  baseElement: string
  /** Props to include */
  props: PropDefinition[]
  /** Variants */
  variants?: VariantDefinition[]
  /** Default styles */
  baseStyles: string[]
  /** Accessibility requirements */
  accessibility?: AccessibilityConfig
}

/**
 * Atom categories
 */
export type AtomCategory =
  | "button"
  | "input"
  | "text"
  | "icon"
  | "image"
  | "badge"
  | "label"
  | "link"
  | "divider"
  | "spinner"
  | "avatar"
  | "checkbox"
  | "radio"
  | "switch"
  | "slider"
  | "progress"

/**
 * Molecule template configuration
 */
export interface MoleculeTemplate {
  /** Component name */
  name: string
  /** Component category */
  category: MoleculeCategory
  /** Atoms used */
  atoms: string[]
  /** Props to include */
  props: PropDefinition[]
  /** Layout pattern */
  layout: "horizontal" | "vertical" | "grid" | "stack"
  /** Interaction pattern */
  interaction?: InteractionPattern
}

/**
 * Molecule categories
 */
export type MoleculeCategory =
  | "form-field"
  | "search-bar"
  | "media-object"
  | "card-header"
  | "nav-item"
  | "button-group"
  | "input-group"
  | "stat-item"
  | "list-item"
  | "breadcrumb-item"
  | "pagination-item"
  | "menu-item"
  | "alert"
  | "tag-group"

/**
 * Organism template configuration
 */
export interface OrganismTemplate {
  /** Component name */
  name: string
  /** Component category */
  category: OrganismCategory
  /** Molecules used */
  molecules: string[]
  /** Atoms used directly */
  atoms?: string[]
  /** Layout structure */
  structure: StructureDefinition
  /** State management */
  stateManagement?: StateConfig
  /** Data requirements */
  dataRequirements?: DataRequirement[]
}

/**
 * Organism categories
 */
export type OrganismCategory =
  | "header"
  | "footer"
  | "sidebar"
  | "navigation"
  | "hero"
  | "card"
  | "form"
  | "table"
  | "modal"
  | "dropdown"
  | "tabs"
  | "accordion"
  | "carousel"
  | "data-grid"
  | "comment-section"
  | "pricing-card"
  | "feature-section"
  | "testimonial"

/**
 * Template configuration
 */
export interface TemplateConfig {
  /** Template name */
  name: string
  /** Template category */
  category: TemplateCategory
  /** Organisms used */
  organisms: string[]
  /** Layout definition */
  layout: LayoutDefinition
  /** Responsive breakpoints */
  breakpoints?: BreakpointConfig
  /** Content slots */
  slots: SlotDefinition[]
}

/**
 * Template categories
 */
export type TemplateCategory =
  | "landing"
  | "dashboard"
  | "auth"
  | "profile"
  | "settings"
  | "blog"
  | "product"
  | "checkout"
  | "error"
  | "empty-state"

/**
 * Page configuration
 */
export interface PageConfig {
  /** Page name */
  name: string
  /** Template used */
  template: string
  /** Content mapping */
  content: Record<string, unknown>
  /** Meta information */
  meta: PageMeta
  /** Route configuration */
  route: RouteConfig
}

/**
 * Prop definition
 */
export interface PropDefinition {
  /** Prop name */
  name: string
  /** TypeScript type */
  type: string
  /** Is required */
  required: boolean
  /** Default value */
  defaultValue?: string
  /** Description */
  description?: string
}

/**
 * Variant definition
 */
export interface VariantDefinition {
  /** Variant name */
  name: string
  /** Variant values */
  values: Array<{
    value: string
    styles: string[]
  }>
  /** Default value */
  defaultValue: string
}

/**
 * Accessibility configuration
 */
export interface AccessibilityConfig {
  /** ARIA role */
  role?: string
  /** Required ARIA attributes */
  ariaAttributes?: string[]
  /** Keyboard interactions */
  keyboardInteractions?: string[]
  /** Focus behavior */
  focusBehavior?: string
}

/**
 * Interaction pattern
 */
export interface InteractionPattern {
  /** Primary action */
  primaryAction?: string
  /** Secondary actions */
  secondaryActions?: string[]
  /** Keyboard shortcuts */
  shortcuts?: string[]
}

/**
 * Structure definition for organisms
 */
export interface StructureDefinition {
  /** Layout type */
  type: "flex" | "grid" | "stack"
  /** Direction */
  direction?: "row" | "column"
  /** Gap */
  gap?: string
  /** Sections */
  sections?: string[]
}

/**
 * State configuration
 */
export interface StateConfig {
  /** Local state variables */
  localState?: string[]
  /** Context providers used */
  contexts?: string[]
  /** External store */
  store?: string
}

/**
 * Data requirement
 */
export interface DataRequirement {
  /** Field name */
  field: string
  /** Data type */
  type: string
  /** Is required */
  required: boolean
  /** Source */
  source?: "props" | "api" | "context" | "store"
}

/**
 * Layout definition
 */
export interface LayoutDefinition {
  /** Layout type */
  type: "single-column" | "two-column" | "three-column" | "sidebar" | "full-width"
  /** Header present */
  hasHeader: boolean
  /** Footer present */
  hasFooter: boolean
  /** Sidebar present */
  hasSidebar: boolean
  /** Sidebar position */
  sidebarPosition?: "left" | "right"
}

/**
 * Breakpoint configuration
 */
export interface BreakpointConfig {
  /** Mobile layout */
  mobile?: Partial<LayoutDefinition>
  /** Tablet layout */
  tablet?: Partial<LayoutDefinition>
  /** Desktop layout */
  desktop?: Partial<LayoutDefinition>
}

/**
 * Slot definition
 */
export interface SlotDefinition {
  /** Slot name */
  name: string
  /** Slot description */
  description: string
  /** Required */
  required: boolean
  /** Allowed component types */
  allowedTypes?: AtomicLevel[]
}

/**
 * Page meta information
 */
export interface PageMeta {
  /** Page title */
  title: string
  /** Meta description */
  description?: string
  /** Keywords */
  keywords?: string[]
  /** Open Graph data */
  og?: Record<string, string>
}

/**
 * Route configuration
 */
export interface RouteConfig {
  /** Route path */
  path: string
  /** Is dynamic route */
  isDynamic: boolean
  /** Route parameters */
  params?: string[]
  /** Required auth */
  requiresAuth?: boolean
}

/**
 * Folder structure for atomic design
 */
export interface AtomicFolderStructure {
  /** Base directory */
  baseDir: string
  /** Atoms directory */
  atoms: string
  /** Molecules directory */
  molecules: string
  /** Organisms directory */
  organisms: string
  /** Templates directory */
  templates: string
  /** Pages directory */
  pages: string
  /** Shared utilities */
  shared?: string
}

/**
 * Generation options
 */
export interface AtomicGenerationOptions {
  /** Include tests */
  includeTests?: boolean
  /** Include stories */
  includeStories?: boolean
  /** Include documentation */
  includeDocs?: boolean
  /** TypeScript mode */
  typescript?: boolean
  /** Style approach */
  styling?: "tailwind" | "css-modules" | "styled-components"
  /** Folder structure */
  folderStructure?: AtomicFolderStructure
}
