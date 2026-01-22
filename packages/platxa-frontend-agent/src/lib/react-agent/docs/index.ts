/**
 * Component Documentation Generator Module
 *
 * Automatically generates documentation for React components.
 *
 * @module react-agent/docs
 *
 * @example
 * ```typescript
 * import { generateDocs, generateDocsIndex } from "@platxa/frontend-agent/docs"
 *
 * const docs = generateDocs(componentCode, "Button.tsx", {
 *   includeExamples: true,
 *   includeAccessibility: true,
 * })
 *
 * console.log(docs.markdown)
 * ```
 */

export {
  // Parser
  parseComponent,
  // Generator
  generateDocs,
  generateDocsForComponents,
  generateDocsIndex,
  // Default export
  default,
  // Types
  type ComponentInfo,
  type PropInfo,
  type VariantInfo,
  type VariantOption,
  type ExampleInfo,
  type ComponentDocs,
  type DocsGeneratorOptions,
} from "./component-docs-generator"
