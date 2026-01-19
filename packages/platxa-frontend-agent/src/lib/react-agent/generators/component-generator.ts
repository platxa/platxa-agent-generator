/**
 * Component Generator
 *
 * Generates React/TypeScript components following shadcn/ui patterns
 * with CVA variants and proper TypeScript types.
 */

import type {
  ComponentSpec,
  GeneratedComponent,
  GenerationOptions,
  ValidationResult,
} from "./types"
import { getTemplate, componentTemplates } from "./templates"

// ============================================================================
// Code Generation Utilities
// ============================================================================

/**
 * Converts a string to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^(.)/, (c) => c.toUpperCase())
}

/**
 * Converts a string to camelCase
 */
function toCamelCase(str: string): string {
  const pascal = toPascalCase(str)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

/**
 * Generates import statements
 */
function generateImports(
  spec: ComponentSpec,
  _options: GenerationOptions
): string {
  const imports: string[] = []

  // React import
  imports.push('import * as React from "react"')

  // CVA import if variants exist
  if (
    (spec.variants && spec.variants.length > 0) ||
    (spec.sizes && spec.sizes.length > 0)
  ) {
    imports.push('import { cva, type VariantProps } from "class-variance-authority"')
  }

  // cn utility import
  imports.push('import { cn } from "@/lib/utils"')

  // Additional custom imports
  if (spec.imports) {
    imports.push(...spec.imports.map((i) => `import ${i}`))
  }

  return imports.join("\n")
}

/**
 * Generates CVA variants definition
 */
function generateCvaDefinition(
  name: string,
  spec: ComponentSpec
): string {
  const variantName = `${toCamelCase(name)}Variants`
  const baseClasses = spec.baseClasses.join(" ")

  const hasVariants = spec.variants && spec.variants.length > 0
  const hasSizes = spec.sizes && spec.sizes.length > 0

  if (!hasVariants && !hasSizes) {
    return ""
  }

  let code = `const ${variantName} = cva(\n`
  code += `  "${baseClasses}",\n`
  code += `  {\n`
  code += `    variants: {\n`

  // Add variant options
  if (hasVariants) {
    code += `      variant: {\n`
    for (const variant of spec.variants!) {
      code += `        ${variant.name}: "${variant.classes}",\n`
    }
    code += `      },\n`
  }

  // Add size options
  if (hasSizes) {
    code += `      size: {\n`
    for (const size of spec.sizes!) {
      code += `        ${size.name}: "${size.classes}",\n`
    }
    code += `      },\n`
    }

  code += `    },\n`
  code += `    defaultVariants: {\n`

  if (hasVariants) {
    code += `      variant: "${spec.defaultVariant || spec.variants![0].name}",\n`
  }
  if (hasSizes) {
    code += `      size: "${spec.defaultSize || spec.sizes![0].name}",\n`
  }

  code += `    },\n`
  code += `  }\n`
  code += `)\n`

  return code
}

/**
 * Generates the props interface
 */
function generatePropsInterface(
  name: string,
  spec: ComponentSpec
): string {
  const propsName = `${name}Props`
  const variantName = `${toCamelCase(name)}Variants`
  const hasVariants =
    (spec.variants && spec.variants.length > 0) ||
    (spec.sizes && spec.sizes.length > 0)

  const baseProps = spec.baseElement === "button"
    ? "React.ButtonHTMLAttributes<HTMLButtonElement>"
    : spec.baseElement === "input"
    ? "React.InputHTMLAttributes<HTMLInputElement>"
    : spec.baseElement === "a"
    ? "React.AnchorHTMLAttributes<HTMLAnchorElement>"
    : `React.HTMLAttributes<HTMLDivElement>`

  let code = `export interface ${propsName}\n`
  code += `  extends ${baseProps}`

  if (hasVariants) {
    code += `,\n    VariantProps<typeof ${variantName}>`
  }

  code += ` {\n`

  // Add loading state prop if needed
  if (spec.hasLoadingState) {
    code += `  /** Whether the component is in a loading state */\n`
    code += `  isLoading?: boolean\n`
  }

  // Add custom props
  if (spec.props) {
    for (const prop of spec.props) {
      code += `  /** ${prop.description} */\n`
      code += `  ${prop.name}${prop.required ? "" : "?"}: ${prop.type}\n`
    }
  }

  code += `}\n`

  return code
}

/**
 * Generates the component implementation
 */
function generateComponent(
  name: string,
  spec: ComponentSpec,
  options: GenerationOptions
): string {
  const propsName = `${name}Props`
  const variantName = `${toCamelCase(name)}Variants`
  const hasVariants =
    (spec.variants && spec.variants.length > 0) ||
    (spec.sizes && spec.sizes.length > 0)

  const elementType = spec.baseElement === "button"
    ? "HTMLButtonElement"
    : spec.baseElement === "input"
    ? "HTMLInputElement"
    : spec.baseElement === "a"
    ? "HTMLAnchorElement"
    : "HTMLDivElement"

  // Build destructured props
  const propsToDestructure: string[] = ["className"]
  if (hasVariants && spec.variants && spec.variants.length > 0) {
    propsToDestructure.push("variant")
  }
  if (hasVariants && spec.sizes && spec.sizes.length > 0) {
    propsToDestructure.push("size")
  }
  if (spec.hasLoadingState) {
    propsToDestructure.push("isLoading")
  }
  if (spec.hasChildren) {
    propsToDestructure.push("children")
  }
  if (spec.hasDisabledState && spec.baseElement === "button") {
    propsToDestructure.push("disabled")
  }

  const jsDoc = options.includeJsDoc
    ? `/**\n * ${spec.description}\n */\n`
    : ""

  let code = jsDoc
  code += `const ${name} = React.forwardRef<${elementType}, ${propsName}>(\n`
  code += `  ({ ${propsToDestructure.join(", ")}, ...props }, ref) => {\n`

  // Loading state handling
  if (spec.hasLoadingState) {
    code += `    if (isLoading) {\n`
    code += `      return (\n`
    code += `        <${spec.baseElement}\n`
    code += `          ref={ref}\n`
    code += `          className={cn(\n`
    if (hasVariants) {
      code += `            ${variantName}({ variant, size }),\n`
    } else {
      code += `            "${spec.baseClasses.join(" ")}",\n`
    }
    code += `            "cursor-wait",\n`
    code += `            className\n`
    code += `          )}\n`
    if (spec.baseElement === "button") {
      code += `          disabled\n`
    }
    code += `          {...props}\n`
    code += `        >\n`
    code += `          <span className="opacity-0">{children}</span>\n`
    code += `          <span className="absolute inset-0 flex items-center justify-center">\n`
    code += `            <svg\n`
    code += `              className="h-4 w-4 animate-spin"\n`
    code += `              xmlns="http://www.w3.org/2000/svg"\n`
    code += `              fill="none"\n`
    code += `              viewBox="0 0 24 24"\n`
    code += `            >\n`
    code += `              <circle\n`
    code += `                className="opacity-25"\n`
    code += `                cx="12"\n`
    code += `                cy="12"\n`
    code += `                r="10"\n`
    code += `                stroke="currentColor"\n`
    code += `                strokeWidth="4"\n`
    code += `              />\n`
    code += `              <path\n`
    code += `                className="opacity-75"\n`
    code += `                fill="currentColor"\n`
    code += `                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"\n`
    code += `              />\n`
    code += `            </svg>\n`
    code += `          </span>\n`
    code += `        </${spec.baseElement}>\n`
    code += `      )\n`
    code += `    }\n\n`
  }

  code += `    return (\n`
  code += `      <${spec.baseElement}\n`
  code += `        ref={ref}\n`

  // Add className with cn utility
  code += `        className={cn(\n`
  if (hasVariants) {
    code += `          ${variantName}({ variant, size }),\n`
  } else {
    code += `          "${spec.baseClasses.join(" ")}",\n`
  }
  code += `          className\n`
  code += `        )}\n`

  // Add ARIA role if specified
  if (spec.ariaRole) {
    code += `        role="${spec.ariaRole}"\n`
  }

  // Add disabled prop for buttons
  if (spec.hasDisabledState && spec.baseElement === "button") {
    code += `        disabled={disabled}\n`
  }

  code += `        {...props}\n`
  code += `      `

  if (spec.hasChildren) {
    code += `>\n`
    code += `        {children}\n`
    code += `      </${spec.baseElement}>\n`
  } else {
    code += `/>\n`
  }

  code += `    )\n`
  code += `  }\n`
  code += `)\n`
  code += `${name}.displayName = "${name}"\n`

  return code
}

/**
 * Generates export statements
 */
function generateExports(
  name: string,
  spec: ComponentSpec
): { code: string; exports: string[] } {
  const exports: string[] = [name, `${name}Props`]
  const variantName = `${toCamelCase(name)}Variants`

  const hasVariants =
    (spec.variants && spec.variants.length > 0) ||
    (spec.sizes && spec.sizes.length > 0)

  if (hasVariants) {
    exports.push(variantName)
  }

  const code = `export { ${name}, ${variantName ? `${variantName}` : ""} }`

  return { code, exports }
}

// ============================================================================
// Main Generator Function
// ============================================================================

/**
 * Generates a complete React component from a specification
 */
export function generateComponentCode(
  spec: ComponentSpec,
  options: GenerationOptions = {}
): GeneratedComponent {
  const defaultOptions: GenerationOptions = {
    includeJsDoc: true,
    includeStory: false,
    includeTest: false,
    useRadix: false,
    exportStyle: "named",
    formatOutput: false,
    ...options,
  }

  const name = toPascalCase(spec.name)
  const fileName = `${name}.tsx`

  // Build the complete component code
  const parts: string[] = []

  // File header comment
  parts.push(`/**`)
  parts.push(` * ${name} Component`)
  parts.push(` *`)
  parts.push(` * ${spec.description}`)
  parts.push(` */`)
  parts.push("")

  // Imports
  parts.push(generateImports(spec, defaultOptions))
  parts.push("")

  // CVA variants
  const cvaCode = generateCvaDefinition(name, spec)
  if (cvaCode) {
    parts.push(cvaCode)
  }

  // Props interface
  parts.push(generatePropsInterface(name, spec))
  parts.push("")

  // Component implementation
  parts.push(generateComponent(name, spec, defaultOptions))
  parts.push("")

  // Exports
  const { code: exportCode, exports } = generateExports(name, spec)
  parts.push(exportCode)
  parts.push("")

  const code = parts.join("\n")

  // Determine dependencies
  const dependencies: string[] = ["react", "@/lib/utils"]
  if (
    (spec.variants && spec.variants.length > 0) ||
    (spec.sizes && spec.sizes.length > 0)
  ) {
    dependencies.push("class-variance-authority")
  }

  // Determine atomic type
  const atomicType: "atom" | "molecule" | "organism" =
    spec.baseElement === "button" ||
    spec.baseElement === "input" ||
    spec.baseElement === "span"
      ? "atom"
      : spec.hasChildren === false
      ? "atom"
      : "molecule"

  return {
    fileName,
    code,
    exports,
    dependencies,
    atomicType,
  }
}

/**
 * Generates a component from a template
 */
export function generateFromTemplate(
  templateName: string,
  customSpec: Partial<ComponentSpec> = {},
  options: GenerationOptions = {}
): GeneratedComponent {
  const template = getTemplate(templateName)

  if (!template) {
    throw new Error(`Template "${templateName}" not found. Available templates: ${Object.keys(componentTemplates).join(", ")}`)
  }

  // Merge template spec with custom spec
  const spec: ComponentSpec = {
    name: customSpec.name || toPascalCase(templateName),
    baseElement: customSpec.baseElement || template.spec.baseElement || "div",
    description: customSpec.description || template.spec.description || "",
    baseClasses: customSpec.baseClasses || template.spec.baseClasses || [],
    variants: customSpec.variants || template.commonVariants,
    sizes: customSpec.sizes || template.commonSizes,
    defaultVariant: customSpec.defaultVariant || template.spec.defaultVariant,
    defaultSize: customSpec.defaultSize || template.spec.defaultSize,
    props: customSpec.props || template.spec.props,
    forwardRef: customSpec.forwardRef ?? template.spec.forwardRef ?? true,
    hasChildren: customSpec.hasChildren ?? template.spec.hasChildren ?? true,
    ariaRole: customSpec.ariaRole || template.spec.ariaRole,
    imports: customSpec.imports || template.spec.imports,
    hasLoadingState: customSpec.hasLoadingState ?? template.spec.hasLoadingState,
    hasDisabledState: customSpec.hasDisabledState ?? template.spec.hasDisabledState,
  }

  return generateComponentCode(spec, options)
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validates generated component code
 */
export function validateComponent(code: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const checks = {
    hasForwardRef: code.includes("React.forwardRef"),
    hasDisplayName: code.includes(".displayName"),
    hasTypeScript: code.includes("interface") || code.includes(": React."),
    hasCvaVariants: code.includes("cva("),
    hasCnUtility: code.includes("cn("),
    hasAccessibility: code.includes("role=") || code.includes("aria-"),
    hasProperExports: code.includes("export {") || code.includes("export const"),
  }

  // Check for required patterns
  if (!checks.hasForwardRef) {
    warnings.push("Component does not use forwardRef - may not work with form libraries")
  }

  if (!checks.hasDisplayName) {
    errors.push("Component missing displayName - affects React DevTools")
  }

  if (!checks.hasTypeScript) {
    errors.push("Component missing TypeScript types")
  }

  if (!checks.hasCnUtility) {
    warnings.push("Component does not use cn() utility - may have class conflicts")
  }

  if (!checks.hasProperExports) {
    errors.push("Component missing exports")
  }

  // Calculate score
  let score = 10
  score -= errors.length * 2
  score -= warnings.length * 0.5

  // Bonus points for good patterns
  if (checks.hasForwardRef) score += 0.5
  if (checks.hasCvaVariants) score += 0.5
  if (checks.hasAccessibility) score += 0.5

  score = Math.max(0, Math.min(10, score))

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    score,
    checks,
  }
}

// ============================================================================
// Exports
// ============================================================================

export {
  toPascalCase,
  toCamelCase,
  generateImports,
  generateCvaDefinition,
  generatePropsInterface,
  generateComponent,
}
