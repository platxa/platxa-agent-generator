/**
 * Component Generators Module
 *
 * Provides utilities for generating React/TypeScript components
 * following shadcn/ui patterns with CVA variants.
 *
 * @example
 * ```typescript
 * import {
 *   generateComponentCode,
 *   generateFromTemplate,
 *   validateComponent,
 * } from "@/lib/react-agent/generators"
 *
 * // Generate from template
 * const button = generateFromTemplate("button", {
 *   name: "MyButton",
 * })
 *
 * // Generate from custom spec
 * const card = generateComponentCode({
 *   name: "FeatureCard",
 *   baseElement: "div",
 *   description: "A card for displaying features",
 *   baseClasses: ["rounded-lg", "border", "p-4"],
 *   hasChildren: true,
 * })
 *
 * // Validate generated code
 * const validation = validateComponent(card.code)
 * ```
 *
 * @module react-agent/generators
 */

// Main generator functions
export {
  generateComponentCode,
  generateFromTemplate,
  validateComponent,
  toPascalCase,
  toCamelCase,
} from "./component-generator"

// Templates
export {
  componentTemplates,
  getTemplate,
  getTemplateNames,
  buttonVariants,
  buttonSizes,
  badgeVariants,
  alertVariants,
  inputSizes,
  avatarSizes,
} from "./templates"

// Type exports
export type {
  ComponentSpec,
  GeneratedComponent,
  GenerationOptions,
  ValidationResult,
  VariantConfig,
  SizeConfig,
  PropDefinition,
  ComponentTemplate,
  ComponentTemplateSpec,
} from "./types"
