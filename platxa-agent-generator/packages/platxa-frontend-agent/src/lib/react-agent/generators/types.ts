/**
 * Component Generator - Type Definitions
 *
 * Types for generating React/TypeScript components following
 * shadcn/ui patterns with CVA variants.
 */

/**
 * Component variant configuration
 */
export interface VariantConfig {
  /** Variant name (e.g., "default", "destructive", "outline") */
  name: string
  /** CSS classes for this variant */
  classes: string
  /** Description for documentation */
  description?: string
}

/**
 * Size variant configuration
 */
export interface SizeConfig {
  /** Size name (e.g., "sm", "md", "lg") */
  name: string
  /** CSS classes for this size */
  classes: string
  /** Description for documentation */
  description?: string
}

/**
 * Component prop definition
 */
export interface PropDefinition {
  /** Prop name */
  name: string
  /** TypeScript type */
  type: string
  /** Whether the prop is required */
  required: boolean
  /** Default value (as string) */
  defaultValue?: string
  /** JSDoc description */
  description: string
}

/**
 * Component specification for generation
 */
export interface ComponentSpec {
  /** Component name in PascalCase */
  name: string
  /** Base HTML element or Radix primitive */
  baseElement: string
  /** Component description */
  description: string
  /** Base CSS classes applied to all variants */
  baseClasses: string[]
  /** Variant definitions */
  variants?: VariantConfig[]
  /** Size definitions */
  sizes?: SizeConfig[]
  /** Default variant */
  defaultVariant?: string
  /** Default size */
  defaultSize?: string
  /** Additional props beyond variants */
  props?: PropDefinition[]
  /** Whether to forward ref */
  forwardRef?: boolean
  /** Whether component has children */
  hasChildren?: boolean
  /** ARIA role for accessibility */
  ariaRole?: string
  /** Additional imports needed */
  imports?: string[]
  /** Whether to include loading state */
  hasLoadingState?: boolean
  /** Whether to include disabled state */
  hasDisabledState?: boolean
}

/**
 * Generated component output
 */
export interface GeneratedComponent {
  /** Component file name */
  fileName: string
  /** Full component code */
  code: string
  /** Exports from this component */
  exports: string[]
  /** Dependencies required */
  dependencies: string[]
  /** Component type (atom, molecule, organism) */
  atomicType: "atom" | "molecule" | "organism"
}

/**
 * Component template type
 */
export type ComponentTemplate =
  | "button"
  | "input"
  | "card"
  | "badge"
  | "avatar"
  | "alert"
  | "dialog"
  | "dropdown"
  | "tabs"
  | "accordion"
  | "toast"
  | "tooltip"
  | "custom"

/**
 * Pre-built component template specification
 */
export interface ComponentTemplateSpec {
  /** Template identifier */
  template: ComponentTemplate
  /** Base specification */
  spec: Partial<ComponentSpec>
  /** Common variants for this template */
  commonVariants: VariantConfig[]
  /** Common sizes for this template */
  commonSizes: SizeConfig[]
  /** Required dependencies */
  dependencies: string[]
}

/**
 * Generation options
 */
export interface GenerationOptions {
  /** Include JSDoc comments */
  includeJsDoc?: boolean
  /** Include Storybook story file */
  includeStory?: boolean
  /** Include test file */
  includeTest?: boolean
  /** Use Radix primitives */
  useRadix?: boolean
  /** Export style (named, default) */
  exportStyle?: "named" | "default"
  /** Format output with prettier */
  formatOutput?: boolean
}

/**
 * Validation result for generated component
 */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean
  /** Validation errors */
  errors: string[]
  /** Validation warnings */
  warnings: string[]
  /** Quality score (0-10) */
  score: number
  /** Detailed checks */
  checks: {
    hasForwardRef: boolean
    hasDisplayName: boolean
    hasTypeScript: boolean
    hasCvaVariants: boolean
    hasCnUtility: boolean
    hasAccessibility: boolean
    hasProperExports: boolean
  }
}
