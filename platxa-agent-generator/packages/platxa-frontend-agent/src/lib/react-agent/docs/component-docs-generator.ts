/**
 * Component Documentation Generator
 *
 * Automatically generates documentation for React components:
 * - Props tables with types and descriptions
 * - Usage examples
 * - Variant documentation
 * - Accessibility notes
 *
 * @module react-agent/docs
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Parsed component information
 */
export interface ComponentInfo {
  /** Component name */
  name: string
  /** Component description from JSDoc */
  description: string
  /** File path */
  filePath: string
  /** Props definitions */
  props: PropInfo[]
  /** CVA variants */
  variants: VariantInfo[]
  /** Default variant values */
  defaultVariants: Record<string, string>
  /** Usage examples from JSDoc @example tags */
  examples: ExampleInfo[]
  /** Accessibility notes */
  accessibility: string[]
  /** Related components */
  see: string[]
  /** Since version */
  since?: string
  /** Deprecation notice */
  deprecated?: string
}

/**
 * Prop information
 */
export interface PropInfo {
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
  /** Possible values for enums */
  enumValues?: string[]
}

/**
 * Variant information
 */
export interface VariantInfo {
  /** Variant name */
  name: string
  /** Description */
  description?: string
  /** Options */
  options: VariantOption[]
  /** Default value */
  defaultValue?: string
}

/**
 * Variant option
 */
export interface VariantOption {
  /** Option name */
  name: string
  /** CSS classes or description */
  description?: string
}

/**
 * Example information
 */
export interface ExampleInfo {
  /** Example title */
  title?: string
  /** Code snippet */
  code: string
  /** Language (tsx, jsx, etc.) */
  language: string
}

/**
 * Documentation output
 */
export interface ComponentDocs {
  /** Component info */
  component: ComponentInfo
  /** Markdown content */
  markdown: string
  /** JSON metadata */
  metadata: Record<string, unknown>
}

/**
 * Generator options
 */
export interface DocsGeneratorOptions {
  /** Include source code link */
  includeSourceLink?: boolean
  /** Base URL for source links */
  sourceBaseUrl?: string
  /** Include prop defaults in table */
  includeDefaults?: boolean
  /** Include examples section */
  includeExamples?: boolean
  /** Include accessibility section */
  includeAccessibility?: boolean
  /** Output format */
  format?: "markdown" | "mdx" | "json"
  /** Custom sections to add */
  customSections?: Array<{ title: string; content: string }>
}

// =============================================================================
// PARSER
// =============================================================================

/**
 * Parse a component file and extract documentation info
 */
export function parseComponent(code: string, filePath: string): ComponentInfo {
  const name = extractComponentName(code, filePath)
  const description = extractDescription(code, name)
  const props = extractProps(code, name)
  const { variants, defaultVariants } = extractVariants(code)
  const examples = extractExamples(code)
  const accessibility = extractAccessibilityNotes(code)
  const see = extractSeeReferences(code)
  const since = extractSince(code)
  const deprecated = extractDeprecated(code)

  return {
    name,
    description,
    filePath,
    props,
    variants,
    defaultVariants,
    examples,
    accessibility,
    see,
    since,
    deprecated,
  }
}

/**
 * Extract component name
 */
function extractComponentName(code: string, filePath: string): string {
  // Try displayName
  const displayNameMatch = code.match(/(\w+)\.displayName\s*=\s*["'](\w+)["']/)
  if (displayNameMatch) {
    return displayNameMatch[2]
  }

  // Try export const/function
  const exportMatch = code.match(
    /export\s+(?:const|function)\s+([A-Z]\w*)/
  )
  if (exportMatch) {
    return exportMatch[1]
  }

  // Try forwardRef with name
  const forwardRefMatch = code.match(
    /const\s+([A-Z]\w*)\s*=\s*(?:React\.)?forwardRef/
  )
  if (forwardRefMatch) {
    return forwardRefMatch[1]
  }

  // Fall back to file name
  const fileName = filePath.split("/").pop() || ""
  const baseName = fileName.replace(/\.(tsx?|jsx?)$/, "")
  return baseName.charAt(0).toUpperCase() + baseName.slice(1).replace(/-(\w)/g, (_, c) => c.toUpperCase())
}

/**
 * Extract component description from JSDoc
 */
function extractDescription(code: string, componentName: string): string {
  // Look for JSDoc before component or variants
  const patterns = [
    // Before component declaration
    new RegExp(
      `(/\\*\\*[\\s\\S]*?\\*/)\\s*(?:export\\s+)?(?:const|function)\\s+${componentName}\\b`,
      "m"
    ),
    // Before variants
    new RegExp(
      `(/\\*\\*[\\s\\S]*?\\*/)\\s*(?:const|export const)\\s+${componentName.toLowerCase()}Variants`,
      "i"
    ),
    // Module-level JSDoc (first one)
    /^\/\*\*\s*\n\s*\*\s*([^\n@]+)/m,
  ]

  for (const pattern of patterns) {
    const match = code.match(pattern)
    if (match) {
      const jsdoc = match[1] || match[0]
      const desc = parseJSDocDescription(jsdoc)
      if (desc) return desc
    }
  }

  return `${componentName} component.`
}

/**
 * Parse JSDoc to extract description (first paragraph before tags)
 */
function parseJSDocDescription(jsdoc: string): string | null {
  const cleaned = jsdoc
    .replace(/^\/\*\*\s*/, "")
    .replace(/\s*\*\/$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, ""))
    .join("\n")

  // Get content before first @tag
  const descriptionEnd = cleaned.search(/\n\s*@/)
  const description = descriptionEnd > 0
    ? cleaned.slice(0, descriptionEnd)
    : cleaned

  const trimmed = description.trim()
  return trimmed || null
}

/**
 * Extract props from TypeScript interface
 */
function extractProps(code: string, componentName: string): PropInfo[] {
  const props: PropInfo[] = []

  // Find props interface
  const interfacePatterns = [
    new RegExp(
      `(?:export\\s+)?interface\\s+${componentName}Props[^{]*\\{([\\s\\S]*?)\\n\\}`,
      "m"
    ),
    new RegExp(
      `(?:export\\s+)?type\\s+${componentName}Props\\s*=\\s*[^{]*\\{([\\s\\S]*?)\\n\\}`,
      "m"
    ),
  ]

  let propsBody = ""
  for (const pattern of interfacePatterns) {
    const match = code.match(pattern)
    if (match) {
      propsBody = match[1]
      break
    }
  }

  if (!propsBody) {
    return []
  }

  // Parse props with JSDoc
  const propPattern = /(?:\/\*\*\s*([\s\S]*?)\s*\*\/\s*)?(\w+)(\?)?:\s*([^;\n]+)/g
  let match

  while ((match = propPattern.exec(propsBody)) !== null) {
    const [, jsdoc, name, optional, type] = match

    // Skip inherited props (from extends)
    if (name === "className" || name === "children") {
      continue
    }

    const description = jsdoc
      ? jsdoc.replace(/^\s*\*\s*/gm, "").trim()
      : undefined

    const defaultMatch = jsdoc?.match(/@default\s+(.+)/)
    const enumValues = extractEnumValues(type)

    props.push({
      name,
      type: cleanType(type),
      required: !optional,
      defaultValue: defaultMatch?.[1],
      description,
      enumValues: enumValues.length > 0 ? enumValues : undefined,
    })
  }

  return props
}

/**
 * Clean up TypeScript type for display
 */
function cleanType(type: string): string {
  return type
    .trim()
    .replace(/\s+/g, " ")
    .replace(/React\./g, "")
}

/**
 * Extract enum values from union type
 */
function extractEnumValues(type: string): string[] {
  const matches = type.match(/["']([^"']+)["']/g)
  if (matches) {
    return matches.map((m) => m.replace(/["']/g, ""))
  }
  return []
}

/**
 * Extract CVA variants
 */
function extractVariants(
  code: string
): { variants: VariantInfo[]; defaultVariants: Record<string, string> } {
  const variants: VariantInfo[] = []
  const defaultVariants: Record<string, string> = {}

  // Find cva() call
  const cvaStart = code.indexOf("cva(")
  if (cvaStart === -1) {
    return { variants, defaultVariants }
  }

  // Extract cva content
  const cvaContent = extractBalancedContent(code, cvaStart + 3, "(", ")")
  if (!cvaContent) {
    return { variants, defaultVariants }
  }

  // Find variants block
  const variantsStart = cvaContent.indexOf("variants:")
  if (variantsStart === -1) {
    return { variants, defaultVariants }
  }

  const variantsBraceStart = cvaContent.indexOf("{", variantsStart)
  if (variantsBraceStart === -1) {
    return { variants, defaultVariants }
  }

  const variantsBlock = extractBalancedContent(
    cvaContent,
    variantsBraceStart,
    "{",
    "}"
  )

  if (variantsBlock) {
    parseVariantsBlock(variantsBlock, variants)
  }

  // Find defaultVariants
  const defaultsStart = cvaContent.indexOf("defaultVariants:")
  if (defaultsStart !== -1) {
    const defaultsBraceStart = cvaContent.indexOf("{", defaultsStart)
    if (defaultsBraceStart !== -1) {
      const defaultsBlock = extractBalancedContent(
        cvaContent,
        defaultsBraceStart,
        "{",
        "}"
      )
      if (defaultsBlock) {
        const defaultsRegex = /(\w+)\s*:\s*["']([^"']+)["']/g
        let match
        while ((match = defaultsRegex.exec(defaultsBlock)) !== null) {
          defaultVariants[match[1]] = match[2]
        }
      }
    }
  }

  return { variants, defaultVariants }
}

/**
 * Extract balanced content between delimiters
 */
function extractBalancedContent(
  code: string,
  startIndex: number,
  openChar: string,
  closeChar: string
): string | null {
  let depth = 0
  let start = -1

  for (let i = startIndex; i < code.length; i++) {
    const char = code[i]

    // Skip strings
    if (char === '"' || char === "'" || char === "`") {
      const quote = char
      i++
      while (i < code.length && code[i] !== quote) {
        if (code[i] === "\\") i++
        i++
      }
      continue
    }

    if (char === openChar) {
      if (depth === 0) start = i
      depth++
    } else if (char === closeChar) {
      depth--
      if (depth === 0 && start !== -1) {
        return code.slice(start + 1, i)
      }
    }
  }

  return null
}

/**
 * Parse variants block
 */
function parseVariantsBlock(block: string, variants: VariantInfo[]): void {
  const variantNameRegex = /(\w+)\s*:\s*\{/g
  let nameMatch

  while ((nameMatch = variantNameRegex.exec(block)) !== null) {
    const variantName = nameMatch[1]
    const braceStart = nameMatch.index + nameMatch[0].length - 1
    const optionsBlock = extractBalancedContent(block, braceStart, "{", "}")

    if (!optionsBlock) continue

    const options: VariantOption[] = []
    const optionRegex = /(\w+)\s*:\s*["'`]([^"'`]*)["'`]/g
    let optionMatch

    while ((optionMatch = optionRegex.exec(optionsBlock)) !== null) {
      options.push({
        name: optionMatch[1],
        description: optionMatch[2],
      })
    }

    if (options.length > 0) {
      variants.push({
        name: variantName,
        options,
      })
    }
  }
}

/**
 * Extract @example tags
 */
function extractExamples(code: string): ExampleInfo[] {
  const examples: ExampleInfo[] = []
  const exampleRegex = /@example\s*(?:\{(\w+)\})?\s*(?:<caption>([^<]*)<\/caption>)?\s*```(\w+)?\n([\s\S]*?)```/g

  let match
  while ((match = exampleRegex.exec(code)) !== null) {
    const [, , caption, lang, exampleCode] = match
    examples.push({
      title: caption?.trim(),
      code: exampleCode.trim(),
      language: lang || "tsx",
    })
  }

  // Also try simpler @example format
  const simpleExampleRegex = /@example\s*\n\s*\*\s*```(\w+)?\n([\s\S]*?)```/g
  while ((match = simpleExampleRegex.exec(code)) !== null) {
    const [, lang, exampleCode] = match
    if (!examples.some((e) => e.code === exampleCode.trim())) {
      examples.push({
        code: exampleCode.trim(),
        language: lang || "tsx",
      })
    }
  }

  return examples
}

/**
 * Extract accessibility notes from comments
 */
function extractAccessibilityNotes(code: string): string[] {
  const notes: string[] = []

  // Look for @accessibility tags
  const a11yRegex = /@accessibility\s+([^\n@]+)/g
  let match
  while ((match = a11yRegex.exec(code)) !== null) {
    notes.push(match[1].trim())
  }

  // Check for ARIA attributes in JSX
  if (code.includes("aria-")) {
    notes.push("Uses ARIA attributes for screen reader support")
  }

  if (code.includes("role=")) {
    notes.push("Includes semantic role attributes")
  }

  if (code.includes("tabIndex") || code.includes("onKeyDown")) {
    notes.push("Keyboard accessible")
  }

  return [...new Set(notes)]
}

/**
 * Extract @see references
 */
function extractSeeReferences(code: string): string[] {
  const refs: string[] = []
  const seeRegex = /@see\s+([^\n@]+)/g
  let match
  while ((match = seeRegex.exec(code)) !== null) {
    refs.push(match[1].trim())
  }
  return refs
}

/**
 * Extract @since version
 */
function extractSince(code: string): string | undefined {
  const match = code.match(/@since\s+(\S+)/)
  return match?.[1]
}

/**
 * Extract @deprecated notice
 */
function extractDeprecated(code: string): string | undefined {
  const match = code.match(/@deprecated\s*([^\n@]*)/)
  return match ? match[1].trim() || "This component is deprecated" : undefined
}

// =============================================================================
// MARKDOWN GENERATOR
// =============================================================================

/**
 * Generate documentation for a component
 */
export function generateDocs(
  code: string,
  filePath: string,
  options: DocsGeneratorOptions = {}
): ComponentDocs {
  const component = parseComponent(code, filePath)
  const markdown = generateMarkdown(component, options)
  const metadata = generateMetadata(component)

  return {
    component,
    markdown,
    metadata,
  }
}

/**
 * Generate markdown documentation
 */
function generateMarkdown(
  component: ComponentInfo,
  options: DocsGeneratorOptions
): string {
  const {
    includeSourceLink = true,
    sourceBaseUrl = "",
    includeDefaults = true,
    includeExamples = true,
    includeAccessibility = true,
    customSections = [],
  } = options

  const sections: string[] = []

  // Title and badges
  let header = `# ${component.name}\n`
  if (component.deprecated) {
    header += `\n> ⚠️ **Deprecated:** ${component.deprecated}\n`
  }
  if (component.since) {
    header += `\n![Since ${component.since}](https://img.shields.io/badge/since-${component.since}-blue)\n`
  }
  sections.push(header)

  // Description
  sections.push(`\n${component.description}\n`)

  // Source link
  if (includeSourceLink && sourceBaseUrl) {
    sections.push(`\n[View Source](${sourceBaseUrl}/${component.filePath})\n`)
  }

  // Installation/Import
  sections.push(`
## Import

\`\`\`tsx
import { ${component.name} } from "@/components/ui/${component.name.toLowerCase()}"
\`\`\`
`)

  // Props table
  if (component.props.length > 0) {
    sections.push(generatePropsTable(component.props, includeDefaults))
  }

  // Variants
  if (component.variants.length > 0) {
    sections.push(generateVariantsSection(component.variants, component.defaultVariants))
  }

  // Examples
  if (includeExamples && component.examples.length > 0) {
    sections.push(generateExamplesSection(component.examples))
  }

  // Accessibility
  if (includeAccessibility && component.accessibility.length > 0) {
    sections.push(generateAccessibilitySection(component.accessibility))
  }

  // Related components
  if (component.see.length > 0) {
    sections.push(generateSeeAlsoSection(component.see))
  }

  // Custom sections
  for (const section of customSections) {
    sections.push(`\n## ${section.title}\n\n${section.content}\n`)
  }

  return sections.join("\n")
}

/**
 * Generate props table
 */
function generatePropsTable(props: PropInfo[], includeDefaults: boolean): string {
  let table = `
## Props

| Prop | Type | Required | Description |${includeDefaults ? " Default |" : ""}
|------|------|----------|-------------|${includeDefaults ? "---------|" : ""}
`

  for (const prop of props) {
    const typeStr = `\`${escapeMarkdown(prop.type)}\``
    const required = prop.required ? "Yes" : "No"
    const desc = prop.description || "-"
    const defaultVal = includeDefaults
      ? ` ${prop.defaultValue ? `\`${prop.defaultValue}\`` : "-"} |`
      : ""

    table += `| \`${prop.name}\` | ${typeStr} | ${required} | ${desc} |${defaultVal}\n`
  }

  return table
}

/**
 * Generate variants section
 */
function generateVariantsSection(
  variants: VariantInfo[],
  defaultVariants: Record<string, string>
): string {
  let section = "\n## Variants\n"

  for (const variant of variants) {
    section += `\n### ${capitalizeFirst(variant.name)}\n\n`

    if (variant.description) {
      section += `${variant.description}\n\n`
    }

    section += "| Value | Classes |\n|-------|--------|\n"

    for (const option of variant.options) {
      const isDefault = defaultVariants[variant.name] === option.name
      const defaultBadge = isDefault ? " *(default)*" : ""
      section += `| \`${option.name}\`${defaultBadge} | \`${escapeMarkdown(option.description || "")}\` |\n`
    }
  }

  return section
}

/**
 * Generate examples section
 */
function generateExamplesSection(examples: ExampleInfo[]): string {
  let section = "\n## Examples\n"

  for (const example of examples) {
    if (example.title) {
      section += `\n### ${example.title}\n`
    }
    section += `\n\`\`\`${example.language}\n${example.code}\n\`\`\`\n`
  }

  return section
}

/**
 * Generate accessibility section
 */
function generateAccessibilitySection(notes: string[]): string {
  let section = "\n## Accessibility\n\n"
  for (const note of notes) {
    section += `- ${note}\n`
  }
  return section
}

/**
 * Generate see also section
 */
function generateSeeAlsoSection(refs: string[]): string {
  let section = "\n## See Also\n\n"
  for (const ref of refs) {
    section += `- ${ref}\n`
  }
  return section
}

/**
 * Generate JSON metadata
 */
function generateMetadata(component: ComponentInfo): Record<string, unknown> {
  return {
    name: component.name,
    description: component.description,
    props: component.props.map((p) => ({
      name: p.name,
      type: p.type,
      required: p.required,
      default: p.defaultValue,
    })),
    variants: component.variants.map((v) => ({
      name: v.name,
      options: v.options.map((o) => o.name),
      default: component.defaultVariants[v.name],
    })),
    hasExamples: component.examples.length > 0,
    isAccessible: component.accessibility.length > 0,
    deprecated: component.deprecated,
    since: component.since,
  }
}

// =============================================================================
// BATCH GENERATION
// =============================================================================

/**
 * Generate docs for multiple components
 */
export function generateDocsForComponents(
  components: Array<{ code: string; filePath: string }>,
  options: DocsGeneratorOptions = {}
): ComponentDocs[] {
  return components.map(({ code, filePath }) =>
    generateDocs(code, filePath, options)
  )
}

/**
 * Generate index page for all components
 */
export function generateDocsIndex(
  docs: ComponentDocs[],
  title: string = "Component Library"
): string {
  let index = `# ${title}\n\n`

  // Group by category (from file path)
  const grouped = new Map<string, ComponentDocs[]>()

  for (const doc of docs) {
    const parts = doc.component.filePath.split("/")
    const category = parts.length > 1 ? capitalizeFirst(parts[parts.length - 2]) : "Components"

    if (!grouped.has(category)) {
      grouped.set(category, [])
    }
    grouped.get(category)!.push(doc)
  }

  // Generate table of contents
  index += "## Table of Contents\n\n"

  for (const [category, categoryDocs] of grouped) {
    index += `### ${category}\n\n`

    for (const doc of categoryDocs) {
      const name = doc.component.name
      const desc = doc.component.description.split("\n")[0]
      index += `- [${name}](./${name.toLowerCase()}.md) - ${desc}\n`
    }

    index += "\n"
  }

  return index
}

// =============================================================================
// UTILITIES
// =============================================================================

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function escapeMarkdown(str: string): string {
  return str.replace(/\|/g, "\\|").replace(/`/g, "\\`")
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default {
  parseComponent,
  generateDocs,
  generateDocsForComponents,
  generateDocsIndex,
}
