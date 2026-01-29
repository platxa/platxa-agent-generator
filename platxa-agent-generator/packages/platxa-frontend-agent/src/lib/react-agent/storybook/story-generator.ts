/**
 * Storybook Story Generator
 *
 * Automatically generates Storybook stories from React components.
 * Analyzes component files to extract:
 * - Props and their types
 * - CVA variants
 * - Default values
 * - JSDoc documentation
 *
 * @module react-agent/storybook
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Component analysis result
 */
export interface ComponentAnalysis {
  /** Component name */
  name: string
  /** File path */
  filePath: string
  /** Component description from JSDoc */
  description: string
  /** Props interface */
  props: PropDefinition[]
  /** CVA variants if present */
  variants: VariantDefinition[]
  /** Default variant values */
  defaultVariants: Record<string, string>
  /** Whether component uses forwardRef */
  usesForwardRef: boolean
  /** Import path for the component */
  importPath: string
}

/**
 * Prop definition
 */
export interface PropDefinition {
  /** Prop name */
  name: string
  /** TypeScript type */
  type: string
  /** Whether prop is required */
  required: boolean
  /** Default value if any */
  defaultValue?: string
  /** JSDoc description */
  description?: string
  /** Possible values for enums/unions */
  options?: string[]
}

/**
 * CVA variant definition
 */
export interface VariantDefinition {
  /** Variant name (e.g., "variant", "size") */
  name: string
  /** Available options */
  options: string[]
  /** Default value */
  defaultValue?: string
}

/**
 * Generated story
 */
export interface GeneratedStory {
  /** Story name */
  name: string
  /** Story code */
  code: string
  /** Args for this story */
  args: Record<string, unknown>
}

/**
 * Story file output
 */
export interface StoryFile {
  /** File name */
  fileName: string
  /** Full story file content */
  content: string
  /** Component being documented */
  componentName: string
}

/**
 * Generator options
 */
export interface StoryGeneratorOptions {
  /** Include interaction tests */
  includeInteractions?: boolean
  /** Include accessibility addon config */
  includeA11y?: boolean
  /** Story format: CSF2 or CSF3 */
  format?: "csf2" | "csf3"
  /** Include dark mode story */
  includeDarkMode?: boolean
  /** Custom decorator imports */
  decoratorImports?: string[]
}

// =============================================================================
// COMPONENT ANALYZER
// =============================================================================

/**
 * Analyze a component file to extract props, variants, and metadata
 */
export function analyzeComponent(
  code: string,
  filePath: string
): ComponentAnalysis {
  const name = extractComponentName(code, filePath)
  const description = extractJSDocDescription(code, name)
  const props = extractProps(code, name)
  const { variants, defaultVariants } = extractCVAVariants(code)
  const usesForwardRef = code.includes("forwardRef")
  const importPath = deriveImportPath(filePath)

  return {
    name,
    filePath,
    description,
    props,
    variants,
    defaultVariants,
    usesForwardRef,
    importPath,
  }
}

/**
 * Extract component name from code or file path
 */
function extractComponentName(code: string, filePath: string): string {
  // Try to find exported component name
  const exportMatch = code.match(
    /export\s+(?:const|function)\s+(\w+)|export\s*{\s*(\w+)\s*}/
  )
  if (exportMatch) {
    return exportMatch[1] || exportMatch[2]
  }

  // Try displayName
  const displayNameMatch = code.match(/(\w+)\.displayName\s*=\s*["'](\w+)["']/)
  if (displayNameMatch) {
    return displayNameMatch[2]
  }

  // Fall back to file name
  const fileName = filePath.split("/").pop() || ""
  return fileName.replace(/\.(tsx?|jsx?)$/, "").replace(/-(\w)/g, (_, c) =>
    c.toUpperCase()
  )
}

/**
 * Extract JSDoc description for a component
 */
function extractJSDocDescription(code: string, componentName: string): string {
  // Strategy 1: Look for JSDoc before component declaration
  const directPatterns = [
    new RegExp(
      `(/\\*\\*[\\s\\S]*?\\*/)\\s*(?:export\\s+)?(?:const|function)\\s+${componentName}`,
      "m"
    ),
    new RegExp(
      `(/\\*\\*[\\s\\S]*?\\*/)\\s*(?:export\\s+)?interface\\s+${componentName}Props`,
      "m"
    ),
  ]

  for (const pattern of directPatterns) {
    const match = code.match(pattern)
    if (match && match[1]) {
      const desc = parseJSDocDescription(match[1])
      if (desc) return desc
    }
  }

  // Strategy 2: Look for JSDoc before componentVariants (common CVA pattern)
  const variantsPattern = new RegExp(
    `(/\\*\\*[\\s\\S]*?\\*/)\\s*(?:export\\s+)?const\\s+${componentName.toLowerCase()}Variants`,
    "i"
  )
  const variantsMatch = code.match(variantsPattern)
  if (variantsMatch && variantsMatch[1]) {
    const desc = parseJSDocDescription(variantsMatch[1])
    if (desc) return desc
  }

  // Strategy 3: Find the first substantial JSDoc in the file (likely describes the main component)
  const firstJSDoc = code.match(/\/\*\*\s*\n\s*\*\s*([A-Z][^*\n]+)/m)
  if (firstJSDoc && firstJSDoc[1]) {
    return firstJSDoc[1].trim()
  }

  return `${componentName} component`
}

/**
 * Parse description from JSDoc comment
 */
function parseJSDocDescription(jsdoc: string): string | null {
  // Remove /** and */ and extract first line of description
  const lines = jsdoc
    .replace(/^\/\*\*\s*/, "")
    .replace(/\s*\*\/$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .filter((line) => line && !line.startsWith("@"))

  if (lines.length > 0) {
    return lines.join(" ").trim()
  }
  return null
}

/**
 * Extract props from TypeScript interface
 */
function extractProps(code: string, componentName: string): PropDefinition[] {
  const props: PropDefinition[] = []

  // Find props interface
  const interfacePatterns = [
    new RegExp(
      `interface\\s+${componentName}Props[^{]*\\{([^}]+)\\}`,
      "s"
    ),
    new RegExp(
      `type\\s+${componentName}Props\\s*=\\s*[^{]*\\{([^}]+)\\}`,
      "s"
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
    return getDefaultProps()
  }

  // Parse individual props
  const propRegex =
    /(?:\/\*\*[\s\S]*?\*\/\s*)?(\w+)(\?)?:\s*([^;\n]+)/g
  let propMatch

  while ((propMatch = propRegex.exec(propsBody)) !== null) {
    const [fullMatch, name, optional, type] = propMatch
    const description = extractPropDescription(fullMatch)
    const options = extractTypeOptions(type)

    props.push({
      name,
      type: type.trim(),
      required: !optional,
      description,
      options: options.length > 0 ? options : undefined,
    })
  }

  return props.length > 0 ? props : getDefaultProps()
}

/**
 * Extract description from prop JSDoc
 */
function extractPropDescription(propCode: string): string | undefined {
  const jsdocMatch = propCode.match(/\/\*\*\s*([\s\S]*?)\s*\*\//)
  if (jsdocMatch) {
    return jsdocMatch[1].replace(/^\s*\*\s*/gm, "").trim()
  }
  return undefined
}

/**
 * Extract options from union types
 */
function extractTypeOptions(type: string): string[] {
  // Handle string literal unions: "primary" | "secondary" | "ghost"
  const literalUnion = type.match(/["']([^"']+)["']/g)
  if (literalUnion) {
    return literalUnion.map((s) => s.replace(/["']/g, ""))
  }

  return []
}

/**
 * Get default props for components without explicit interface
 */
function getDefaultProps(): PropDefinition[] {
  return [
    {
      name: "children",
      type: "React.ReactNode",
      required: false,
      description: "Content to render inside the component",
    },
    {
      name: "className",
      type: "string",
      required: false,
      description: "Additional CSS classes",
    },
  ]
}

/**
 * Extract CVA variants from component code
 */
function extractCVAVariants(
  code: string
): { variants: VariantDefinition[]; defaultVariants: Record<string, string> } {
  const variants: VariantDefinition[] = []
  const defaultVariants: Record<string, string> = {}

  // Find cva() call - locate the start
  const cvaStart = code.indexOf("cva(")
  if (cvaStart === -1) {
    return { variants, defaultVariants }
  }

  // Find the configuration object within cva()
  // Extract content between cva( and its closing )
  const cvaContent = extractBalancedContent(code, cvaStart + 3, "(", ")")
  if (!cvaContent) {
    return { variants, defaultVariants }
  }

  // Find variants block
  const variantsStart = cvaContent.indexOf("variants:")
  if (variantsStart === -1) {
    return { variants, defaultVariants }
  }

  // Find the opening brace after "variants:"
  const variantsBraceStart = cvaContent.indexOf("{", variantsStart)
  if (variantsBraceStart === -1) {
    return { variants, defaultVariants }
  }

  // Extract the variants object with balanced braces
  const variantsBlock = extractBalancedContent(
    cvaContent,
    variantsBraceStart,
    "{",
    "}"
  )
  if (variantsBlock) {
    parseVariantsBlock(variantsBlock, variants)
  }

  // Find defaultVariants block
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
        // Parse default variants
        const defaultsRegex = /(\w+)\s*:\s*["']([^"']+)["']/g
        let defaultMatch
        while ((defaultMatch = defaultsRegex.exec(defaultsBlock)) !== null) {
          defaultVariants[defaultMatch[1]] = defaultMatch[2]
        }
      }
    }
  }

  return { variants, defaultVariants }
}

/**
 * Extract content between balanced delimiters (handles nesting)
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

    // Skip strings to avoid counting braces inside strings
    if (char === '"' || char === "'" || char === "`") {
      const quote = char
      i++
      while (i < code.length && code[i] !== quote) {
        if (code[i] === "\\") i++ // Skip escaped characters
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
 * Parse variants block from CVA
 */
function parseVariantsBlock(
  block: string,
  variants: VariantDefinition[]
): void {
  // Find each variant group by looking for "name: {" pattern
  const variantNameRegex = /(\w+)\s*:\s*\{/g
  let nameMatch

  while ((nameMatch = variantNameRegex.exec(block)) !== null) {
    const variantName = nameMatch[1]
    const braceStart = nameMatch.index + nameMatch[0].length - 1

    // Extract the variant options object
    const optionsBlock = extractBalancedContent(block, braceStart, "{", "}")
    if (!optionsBlock) continue

    const options: string[] = []

    // Extract option names (keys before colons)
    const optionRegex = /(\w+)\s*:/g
    let optionMatch
    while ((optionMatch = optionRegex.exec(optionsBlock)) !== null) {
      options.push(optionMatch[1])
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
 * Derive import path from file path
 */
function deriveImportPath(filePath: string): string {
  // Convert absolute path to relative import
  const parts = filePath.split("/")
  const srcIndex = parts.findIndex((p) => p === "src")

  if (srcIndex >= 0) {
    const relativeParts = parts.slice(srcIndex + 1)
    const importPath = relativeParts.join("/").replace(/\.(tsx?|jsx?)$/, "")
    return `@/${importPath}`
  }

  // Fallback: use file name
  const fileName = parts.pop() || ""
  return `./${fileName.replace(/\.(tsx?|jsx?)$/, "")}`
}

// =============================================================================
// STORY GENERATOR
// =============================================================================

/**
 * Generate a complete Storybook story file for a component
 */
export function generateStoryFile(
  analysis: ComponentAnalysis,
  options: StoryGeneratorOptions = {}
): StoryFile {
  const {
    includeInteractions = false,
    includeA11y = true,
    format = "csf3",
    includeDarkMode = true,
    decoratorImports = [],
  } = options

  const stories = generateStories(analysis, options)
  const content = format === "csf3"
    ? generateCSF3File(analysis, stories, {
        includeInteractions,
        includeA11y,
        includeDarkMode,
        decoratorImports,
      })
    : generateCSF2File(analysis, stories)

  return {
    fileName: `${analysis.name}.stories.tsx`,
    content,
    componentName: analysis.name,
  }
}

/**
 * Generate individual stories for a component
 */
function generateStories(
  analysis: ComponentAnalysis,
  _options: StoryGeneratorOptions
): GeneratedStory[] {
  const stories: GeneratedStory[] = []

  // Default story
  stories.push({
    name: "Default",
    code: "",
    args: getDefaultArgs(analysis),
  })

  // Generate variant stories
  for (const variant of analysis.variants) {
    for (const option of variant.options) {
      // Skip if this is the default
      if (analysis.defaultVariants[variant.name] === option) continue

      const storyName = capitalizeFirst(option)
      stories.push({
        name: storyName,
        code: "",
        args: {
          ...getDefaultArgs(analysis),
          [variant.name]: option,
        },
      })
    }
  }

  // Add size variants if present
  const sizeVariant = analysis.variants.find((v) => v.name === "size")
  if (sizeVariant && sizeVariant.options.length > 1) {
    stories.push({
      name: "AllSizes",
      code: generateAllSizesStory(analysis, sizeVariant),
      args: {},
    })
  }

  return stories
}

/**
 * Get default args for a component
 */
function getDefaultArgs(analysis: ComponentAnalysis): Record<string, unknown> {
  const args: Record<string, unknown> = {}

  // Add children if component likely needs it
  const needsChildren = analysis.props.some(
    (p) => p.name === "children" && p.type.includes("ReactNode")
  )
  if (needsChildren) {
    args.children = analysis.name
  }

  // Add default variants
  for (const [key, value] of Object.entries(analysis.defaultVariants)) {
    args[key] = value
  }

  return args
}

/**
 * Generate story showing all sizes
 */
function generateAllSizesStory(
  analysis: ComponentAnalysis,
  sizeVariant: VariantDefinition
): string {
  const sizes = sizeVariant.options
  return `
  render: () => (
    <div className="flex items-center gap-4">
      ${sizes.map((size) => `<${analysis.name} size="${size}">${capitalizeFirst(size)}</${analysis.name}>`).join("\n      ")}
    </div>
  ),`
}

/**
 * Generate CSF3 format story file
 */
function generateCSF3File(
  analysis: ComponentAnalysis,
  stories: GeneratedStory[],
  options: {
    includeInteractions: boolean
    includeA11y: boolean
    includeDarkMode: boolean
    decoratorImports: string[]
  }
): string {
  const imports = generateImports(analysis, options)
  const meta = generateMeta(analysis, options)
  const storyExports = stories.map((s) => generateCSF3Story(s)).join("\n\n")
  const darkModeStory = options.includeDarkMode
    ? generateDarkModeStory(analysis)
    : ""

  return `${imports}

${meta}

${storyExports}
${darkModeStory}`
}

/**
 * Generate imports section
 */
function generateImports(
  analysis: ComponentAnalysis,
  options: {
    includeInteractions: boolean
    includeA11y: boolean
    decoratorImports: string[]
  }
): string {
  const lines = [
    `import type { Meta, StoryObj } from "@storybook/react"`,
  ]

  if (options.includeInteractions) {
    lines.push(
      `import { within, userEvent, expect } from "@storybook/test"`
    )
  }

  // Component import
  lines.push(`import { ${analysis.name} } from "${analysis.importPath}"`)

  // Custom decorators
  for (const decorator of options.decoratorImports) {
    lines.push(decorator)
  }

  return lines.join("\n")
}

/**
 * Generate meta export
 */
function generateMeta(
  analysis: ComponentAnalysis,
  options: { includeA11y: boolean }
): string {
  const argTypes = generateArgTypes(analysis)
  const a11yParams = options.includeA11y
    ? `
    a11y: {
      config: {
        rules: [
          { id: "color-contrast", enabled: true },
        ],
      },
    },`
    : ""

  return `const meta: Meta<typeof ${analysis.name}> = {
  title: "Components/${analysis.name}",
  component: ${analysis.name},
  tags: ["autodocs"],
  parameters: {
    layout: "centered",${a11yParams}
    docs: {
      description: {
        component: "${escapeString(analysis.description)}",
      },
    },
  },
  argTypes: {
${argTypes}
  },
}

export default meta
type Story = StoryObj<typeof meta>`
}

/**
 * Generate argTypes from props and variants
 */
function generateArgTypes(analysis: ComponentAnalysis): string {
  const lines: string[] = []

  // Add variant argTypes
  for (const variant of analysis.variants) {
    lines.push(`    ${variant.name}: {
      control: "select",
      options: [${variant.options.map((o) => `"${o}"`).join(", ")}],
      description: "${capitalizeFirst(variant.name)} variant",
    },`)
  }

  // Add prop argTypes
  for (const prop of analysis.props) {
    if (analysis.variants.some((v) => v.name === prop.name)) continue

    const control = getControlForType(prop.type, prop.options)
    const description = prop.description
      ? `description: "${escapeString(prop.description)}",`
      : ""

    lines.push(`    ${prop.name}: {
      ${control}
      ${description}
    },`)
  }

  return lines.join("\n")
}

/**
 * Get Storybook control type for a TypeScript type
 */
function getControlForType(
  type: string,
  options?: string[]
): string {
  if (options && options.length > 0) {
    return `control: "select",
      options: [${options.map((o) => `"${o}"`).join(", ")}],`
  }

  if (type.includes("boolean")) {
    return `control: "boolean",`
  }

  if (type.includes("number")) {
    return `control: "number",`
  }

  if (type.includes("ReactNode") || type.includes("children")) {
    return `control: "text",`
  }

  if (type.includes("string")) {
    return `control: "text",`
  }

  return `control: false,`
}

/**
 * Generate a single CSF3 story
 */
function generateCSF3Story(story: GeneratedStory): string {
  const argsStr = Object.keys(story.args).length > 0
    ? `\n  args: ${JSON.stringify(story.args, null, 4).replace(/\n/g, "\n  ")},`
    : ""

  const renderStr = story.code ? `\n  ${story.code.trim()}` : ""

  return `export const ${story.name}: Story = {${argsStr}${renderStr}
}`
}

/**
 * Generate dark mode story
 */
function generateDarkModeStory(analysis: ComponentAnalysis): string {
  return `
export const DarkMode: Story = {
  args: {
    children: "${analysis.name}",
  },
  decorators: [
    (Story) => (
      <div className="dark bg-background p-8 rounded-lg">
        <Story />
      </div>
    ),
  ],
}`
}

/**
 * Generate CSF2 format (legacy)
 */
function generateCSF2File(
  analysis: ComponentAnalysis,
  stories: GeneratedStory[]
): string {
  const imports = `import React from "react"
import { ${analysis.name} } from "${analysis.importPath}"`

  const meta = `export default {
  title: "Components/${analysis.name}",
  component: ${analysis.name},
}`

  const storyExports = stories
    .map(
      (s) => `
export const ${s.name} = () => <${analysis.name} ${formatArgs(s.args)}>${s.args.children || ""}</${analysis.name}>`
    )
    .join("\n")

  return `${imports}

${meta}
${storyExports}
`
}

/**
 * Format args as JSX attributes
 */
function formatArgs(args: Record<string, unknown>): string {
  return Object.entries(args)
    .filter(([key]) => key !== "children")
    .map(([key, value]) => {
      if (typeof value === "string") {
        return `${key}="${value}"`
      }
      return `${key}={${JSON.stringify(value)}}`
    })
    .join(" ")
}

// =============================================================================
// BATCH GENERATION
// =============================================================================

/**
 * Generate stories for multiple components
 */
export function generateStoriesForComponents(
  components: Array<{ code: string; filePath: string }>,
  options: StoryGeneratorOptions = {}
): StoryFile[] {
  return components.map(({ code, filePath }) => {
    const analysis = analyzeComponent(code, filePath)
    return generateStoryFile(analysis, options)
  })
}

// =============================================================================
// UTILITIES
// =============================================================================

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function escapeString(str: string): string {
  return str.replace(/"/g, '\\"').replace(/\n/g, "\\n")
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default {
  analyzeComponent,
  generateStoryFile,
  generateStoriesForComponents,
}
