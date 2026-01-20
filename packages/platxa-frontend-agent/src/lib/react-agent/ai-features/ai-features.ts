/**
 * AI Features Module
 *
 * Mockup-to-code analysis, design critique, similarity search,
 * AutoFix post-processing, and context window management.
 */

import type {
  DetectedElement,
  ExtractedColor,
  MockupAnalysis,
  MockupAnalyzerConfig,
  CritiqueCategory,
  CritiqueSeverity,
  CritiqueItem,
  DesignCritique,
  CritiqueConfig,
  ComponentSignature,
  SimilarityMatch,
  SimilaritySearchResult,
  ComponentLibrary,
  AutoFixRule,
  AutoFixResult,
  AutoFixConfig,
  ContextItemType,
  ContextItem,
  ContextWindow,
  ContextOptimization,
  ContextManagerConfig,
  AIFeaturesConfig,
} from "./types"

// =============================================================================
// Mockup-to-Code Image Analyzer (#69)
// =============================================================================

/**
 * Default mockup analyzer configuration
 */
export const DEFAULT_MOCKUP_CONFIG: MockupAnalyzerConfig = {
  minConfidence: 0.7,
  extractColors: true,
  detectTypography: true,
  maxElements: 50,
}

/**
 * Analyze mockup description and generate component structure
 * Note: In real implementation, this would use vision AI
 */
export function analyzeMockupDescription(
  description: string,
  config: MockupAnalyzerConfig = DEFAULT_MOCKUP_CONFIG
): MockupAnalysis {
  const elements: DetectedElement[] = []
  const colors: ExtractedColor[] = []
  const componentSuggestions: string[] = []

  // Parse description for UI elements
  const elementPatterns: Array<{ pattern: RegExp; type: DetectedElement["type"] }> = [
    { pattern: /button|btn|cta/gi, type: "button" },
    { pattern: /input|field|textbox/gi, type: "input" },
    { pattern: /card|panel|box/gi, type: "card" },
    { pattern: /image|img|photo|icon/gi, type: "image" },
    { pattern: /text|label|heading|title|paragraph/gi, type: "text" },
    { pattern: /container|wrapper|section|div/gi, type: "container" },
    { pattern: /list|items|menu/gi, type: "list" },
    { pattern: /nav|navigation|header/gi, type: "nav" },
    { pattern: /form|login|signup|contact/gi, type: "form" },
    { pattern: /modal|dialog|popup|overlay/gi, type: "modal" },
  ]

  let yPosition = 0
  for (const { pattern, type } of elementPatterns) {
    const matches = description.match(pattern)
    if (matches) {
      for (const match of matches.slice(0, 3)) {
        elements.push({
          type,
          bounds: { x: 0, y: yPosition, width: 300, height: 50 },
          confidence: 0.8 + Math.random() * 0.2,
          text: match,
        })
        yPosition += 60

        // Suggest component based on type
        if (!componentSuggestions.includes(type)) {
          componentSuggestions.push(capitalizeFirst(type))
        }
      }
    }
  }

  // Extract colors from description
  if (config.extractColors) {
    const colorPatterns = [
      { pattern: /blue|primary/gi, hex: "#3b82f6", semantic: "primary" as const },
      { pattern: /gray|grey|neutral/gi, hex: "#6b7280", semantic: "muted" as const },
      { pattern: /white|light/gi, hex: "#ffffff", semantic: "background" as const },
      { pattern: /black|dark/gi, hex: "#1f2937", semantic: "foreground" as const },
      { pattern: /red|error|danger/gi, hex: "#ef4444", semantic: "accent" as const },
      { pattern: /green|success/gi, hex: "#22c55e", semantic: "secondary" as const },
    ]

    for (const { pattern, hex, semantic } of colorPatterns) {
      if (pattern.test(description)) {
        colors.push({
          hex,
          rgb: hexToRgb(hex),
          frequency: 0.1 + Math.random() * 0.3,
          semantic,
        })
      }
    }

    // Default colors if none detected
    if (colors.length === 0) {
      colors.push(
        { hex: "#3b82f6", rgb: { r: 59, g: 130, b: 246 }, frequency: 0.3, semantic: "primary" },
        { hex: "#f3f4f6", rgb: { r: 243, g: 244, b: 246 }, frequency: 0.4, semantic: "background" },
        { hex: "#1f2937", rgb: { r: 31, g: 41, b: 55 }, frequency: 0.3, semantic: "foreground" }
      )
    }
  }

  // Detect layout type
  const layoutType = detectLayoutType(description)

  // Detect typography
  const typography = config.detectTypography ? {
    headingFont: "Inter",
    bodyFont: "Inter",
    sizes: ["text-sm", "text-base", "text-lg", "text-xl", "text-2xl"],
  } : { sizes: [] }

  return {
    elements: elements.slice(0, config.maxElements || 50),
    colors,
    typography,
    layout: {
      type: layoutType,
      spacing: "gap-4",
      maxWidth: layoutType === "single-column" ? "max-w-2xl" : "max-w-7xl",
    },
    componentSuggestions,
    confidence: elements.length > 0 ? 0.75 : 0.5,
  }
}

/**
 * Generate component code from mockup analysis
 */
export function generateCodeFromAnalysis(analysis: MockupAnalysis): string {
  const lines: string[] = []

  lines.push(`import * as React from "react"`)
  lines.push(``)
  lines.push(`export function GeneratedComponent() {`)
  lines.push(`  return (`)
  lines.push(`    <div className="flex flex-col ${analysis.layout.spacing} ${analysis.layout.maxWidth} mx-auto p-4">`)

  for (const element of analysis.elements) {
    const indent = "      "
    switch (element.type) {
      case "button":
        lines.push(`${indent}<button className="px-4 py-2 bg-primary text-primary-foreground rounded-md">`)
        lines.push(`${indent}  ${element.text || "Button"}`)
        lines.push(`${indent}</button>`)
        break
      case "input":
        lines.push(`${indent}<input`)
        lines.push(`${indent}  type="text"`)
        lines.push(`${indent}  placeholder="${element.text || "Enter text..."}"`)
        lines.push(`${indent}  className="px-3 py-2 border rounded-md"`)
        lines.push(`${indent}/>`)
        break
      case "card":
        lines.push(`${indent}<div className="p-4 border rounded-lg shadow-sm">`)
        lines.push(`${indent}  ${element.text || "Card content"}`)
        lines.push(`${indent}</div>`)
        break
      case "text":
        lines.push(`${indent}<p className="text-base">${element.text || "Text content"}</p>`)
        break
      case "image":
        lines.push(`${indent}<img src="/placeholder.svg" alt="${element.text || "Image"}" className="w-full h-48 object-cover rounded-md" />`)
        break
      case "container":
        lines.push(`${indent}<div className="p-4">${element.text || ""}</div>`)
        break
      default:
        lines.push(`${indent}<div>${element.text || element.type}</div>`)
    }
  }

  lines.push(`    </div>`)
  lines.push(`  )`)
  lines.push(`}`)

  return lines.join("\n")
}

// =============================================================================
// Design Critique System (#70)
// =============================================================================

/**
 * Default critique configuration
 */
export const DEFAULT_CRITIQUE_CONFIG: CritiqueConfig = {
  categories: ["layout", "typography", "color", "spacing", "accessibility", "consistency"],
  minSeverity: "minor",
  includeSuggestions: true,
}

/**
 * Critique rules
 */
const CRITIQUE_RULES: Array<{
  id: string
  category: CritiqueCategory
  check: (code: string) => { issue: string; suggestion: string } | null
  severity: CritiqueSeverity
}> = [
  // Layout critiques
  {
    id: "layout-max-width",
    category: "layout",
    severity: "minor",
    check: (code) => {
      if (!/max-w-/.test(code) && /container|wrapper|section/i.test(code)) {
        return {
          issue: "Container lacks max-width constraint",
          suggestion: "Add max-w-7xl or similar to prevent content from stretching too wide",
        }
      }
      return null
    },
  },
  {
    id: "layout-responsive",
    category: "layout",
    severity: "major",
    check: (code) => {
      if (!/sm:|md:|lg:|xl:/.test(code) && /grid|flex/.test(code)) {
        return {
          issue: "Layout may not be responsive",
          suggestion: "Add responsive breakpoint classes (sm:, md:, lg:) for better mobile experience",
        }
      }
      return null
    },
  },
  // Typography critiques
  {
    id: "typography-hierarchy",
    category: "typography",
    severity: "minor",
    check: (code) => {
      const hasH1 = /<h1|text-4xl|text-5xl/.test(code)
      const hasSmaller = /text-base|text-sm|text-lg/.test(code)
      if (hasSmaller && !hasH1) {
        return {
          issue: "Missing clear heading hierarchy",
          suggestion: "Consider adding a prominent heading (h1 with text-3xl or larger) for visual hierarchy",
        }
      }
      return null
    },
  },
  {
    id: "typography-line-height",
    category: "typography",
    severity: "suggestion",
    check: (code) => {
      if (/text-sm|text-xs/.test(code) && !/leading-/.test(code)) {
        return {
          issue: "Small text may need adjusted line height",
          suggestion: "Add leading-relaxed or leading-normal to improve readability of small text",
        }
      }
      return null
    },
  },
  // Color critiques
  {
    id: "color-hardcoded",
    category: "color",
    severity: "major",
    check: (code) => {
      if (/#[0-9a-fA-F]{3,8}/.test(code)) {
        return {
          issue: "Hardcoded color values detected",
          suggestion: "Use semantic color tokens (bg-primary, text-foreground) instead of hex values",
        }
      }
      return null
    },
  },
  {
    id: "color-contrast",
    category: "color",
    severity: "critical",
    check: (code) => {
      if (/text-gray-400|text-slate-400/.test(code) && /bg-gray-100|bg-slate-100/.test(code)) {
        return {
          issue: "Potential low contrast text",
          suggestion: "Use darker text colors (text-gray-700) on light backgrounds for better readability",
        }
      }
      return null
    },
  },
  // Spacing critiques
  {
    id: "spacing-inconsistent",
    category: "spacing",
    severity: "minor",
    check: (code) => {
      const spacings = code.match(/[pm][trblxy]?-\d+/g) || []
      const uniqueSpacings = new Set(spacings.map((s) => s.match(/\d+/)?.[0]))
      if (uniqueSpacings.size > 6) {
        return {
          issue: "Too many different spacing values",
          suggestion: "Consolidate spacing to 4-6 values for visual consistency (e.g., 2, 4, 6, 8, 12)",
        }
      }
      return null
    },
  },
  // Accessibility critiques
  {
    id: "a11y-button-text",
    category: "accessibility",
    severity: "critical",
    check: (code) => {
      if (/<button[^>]*>[\s]*<(?:svg|img|Icon)/.test(code) && !/aria-label/.test(code)) {
        return {
          issue: "Icon-only button missing accessible label",
          suggestion: "Add aria-label to buttons that only contain icons",
        }
      }
      return null
    },
  },
  {
    id: "a11y-focus",
    category: "accessibility",
    severity: "major",
    check: (code) => {
      if (/button|input|select|a href/.test(code) && !/focus:|focus-visible:/.test(code)) {
        return {
          issue: "Interactive elements may lack focus styles",
          suggestion: "Add focus-visible:ring-2 focus-visible:ring-primary for keyboard navigation",
        }
      }
      return null
    },
  },
  // Consistency critiques
  {
    id: "consistency-border-radius",
    category: "consistency",
    severity: "minor",
    check: (code) => {
      const radii = code.match(/rounded-\w+/g) || []
      const uniqueRadii = new Set(radii)
      if (uniqueRadii.size > 3) {
        return {
          issue: "Multiple border radius values",
          suggestion: "Standardize to 2-3 border radius values (e.g., rounded-md, rounded-lg, rounded-full)",
        }
      }
      return null
    },
  },
]

/**
 * Generate design critique for component code
 */
export function generateDesignCritique(
  code: string,
  config: CritiqueConfig = DEFAULT_CRITIQUE_CONFIG
): DesignCritique {
  const items: CritiqueItem[] = []
  const severityOrder: CritiqueSeverity[] = ["critical", "major", "minor", "suggestion"]
  const minSeverityIndex = severityOrder.indexOf(config.minSeverity || "suggestion")

  // Run all critique rules
  for (const rule of CRITIQUE_RULES) {
    // Filter by category
    if (config.categories && !config.categories.includes(rule.category)) {
      continue
    }

    // Filter by severity
    const severityIndex = severityOrder.indexOf(rule.severity)
    if (severityIndex > minSeverityIndex) {
      continue
    }

    const result = rule.check(code)
    if (result) {
      items.push({
        id: rule.id,
        category: rule.category,
        severity: rule.severity,
        issue: result.issue,
        suggestion: result.suggestion,
      })
    }
  }

  // Categorize by severity
  const critical = items.filter((i) => i.severity === "critical")
  const major = items.filter((i) => i.severity === "major")
  const minor = items.filter((i) => i.severity === "minor")
  const suggestions = items.filter((i) => i.severity === "suggestion")

  // Calculate score (10 - deductions)
  let score = 10
  score -= critical.length * 2
  score -= major.length * 1
  score -= minor.length * 0.5
  score -= suggestions.length * 0.1
  score = Math.max(0, Math.min(10, Math.round(score * 10) / 10))

  // Generate summary
  const summary = generateCritiqueSummary(score, critical.length, major.length, minor.length)

  // Top improvements
  const topImprovements = items
    .sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity))
    .slice(0, 3)
    .map((i) => i.suggestion)

  return {
    score,
    items,
    critical,
    major,
    minor,
    suggestions,
    summary,
    topImprovements,
  }
}

// =============================================================================
// Component Similarity Search (#71)
// =============================================================================

/**
 * Default component library (shadcn/ui inspired)
 */
export const SHADCN_LIBRARY: ComponentLibrary = {
  name: "shadcn/ui",
  components: [
    { name: "Button", props: ["variant", "size", "disabled", "asChild"], hasVariants: true, variants: ["default", "secondary", "outline", "ghost", "link", "destructive"], usesForwardRef: true, hasA11y: true, complexity: 3, tags: ["action", "interactive", "cta"] },
    { name: "Input", props: ["type", "placeholder", "disabled", "value", "onChange"], hasVariants: false, usesForwardRef: true, hasA11y: true, complexity: 2, tags: ["form", "input", "text"] },
    { name: "Card", props: ["className"], hasVariants: false, usesForwardRef: true, hasA11y: false, complexity: 2, tags: ["container", "layout", "content"] },
    { name: "Dialog", props: ["open", "onOpenChange"], hasVariants: false, usesForwardRef: false, hasA11y: true, complexity: 5, tags: ["modal", "overlay", "popup"] },
    { name: "Select", props: ["value", "onValueChange", "disabled"], hasVariants: false, usesForwardRef: false, hasA11y: true, complexity: 4, tags: ["form", "dropdown", "select"] },
    { name: "Tabs", props: ["value", "onValueChange", "defaultValue"], hasVariants: false, usesForwardRef: false, hasA11y: true, complexity: 4, tags: ["navigation", "tabs", "content"] },
    { name: "Alert", props: ["variant"], hasVariants: true, variants: ["default", "destructive"], usesForwardRef: true, hasA11y: true, complexity: 2, tags: ["feedback", "message", "notification"] },
    { name: "Avatar", props: ["src", "alt", "fallback"], hasVariants: false, usesForwardRef: true, hasA11y: true, complexity: 2, tags: ["user", "image", "profile"] },
    { name: "Badge", props: ["variant"], hasVariants: true, variants: ["default", "secondary", "outline", "destructive"], usesForwardRef: true, hasA11y: false, complexity: 1, tags: ["label", "tag", "status"] },
    { name: "Checkbox", props: ["checked", "onCheckedChange", "disabled"], hasVariants: false, usesForwardRef: true, hasA11y: true, complexity: 3, tags: ["form", "input", "toggle"] },
    { name: "Dropdown", props: ["open", "onOpenChange"], hasVariants: false, usesForwardRef: false, hasA11y: true, complexity: 5, tags: ["menu", "action", "navigation"] },
    { name: "Toast", props: ["variant", "title", "description"], hasVariants: true, variants: ["default", "destructive"], usesForwardRef: false, hasA11y: true, complexity: 4, tags: ["feedback", "notification", "message"] },
    { name: "Tooltip", props: ["content", "side", "align"], hasVariants: false, usesForwardRef: false, hasA11y: true, complexity: 3, tags: ["help", "hint", "overlay"] },
    { name: "Accordion", props: ["type", "value", "onValueChange"], hasVariants: false, usesForwardRef: false, hasA11y: true, complexity: 4, tags: ["disclosure", "content", "expand"] },
    { name: "Table", props: ["className"], hasVariants: false, usesForwardRef: true, hasA11y: true, complexity: 3, tags: ["data", "list", "grid"] },
  ],
}

/**
 * Extract component signature from code
 */
export function extractComponentSignature(code: string): ComponentSignature {
  // Extract name
  const nameMatch = code.match(/const\s+([A-Z]\w+)\s*=\s*(?:React\.)?forwardRef/) ||
    code.match(/function\s+([A-Z]\w+)/) ||
    code.match(/export\s+(?:const|function)\s+([A-Z]\w+)/)
  const name = nameMatch?.[1] || "Unknown"

  // Extract props
  const propsMatch = code.match(/interface\s+\w*Props[^{]*{([^}]+)}/s)
  const props: string[] = []
  if (propsMatch) {
    const propPattern = /(\w+)[?]?:/g
    let match: RegExpExecArray | null
    while ((match = propPattern.exec(propsMatch[1])) !== null) {
      props.push(match[1])
    }
  }

  // Check for variants
  const hasVariants = /cva\(|variants:/.test(code)
  const variants: string[] = []
  if (hasVariants) {
    const variantMatch = code.match(/variant:\s*{([^}]+)}/s)
    if (variantMatch) {
      const variantPattern = /(\w+):/g
      let match: RegExpExecArray | null
      while ((match = variantPattern.exec(variantMatch[1])) !== null) {
        variants.push(match[1])
      }
    }
  }

  // Other checks
  const usesForwardRef = /forwardRef/.test(code)
  const hasA11y = /aria-|role=/.test(code)

  // Estimate complexity
  const lines = code.split("\n").length
  const complexity = Math.min(10, Math.max(1, Math.floor(lines / 20)))

  // Generate tags
  const tags: string[] = []
  if (/button/i.test(name)) tags.push("action", "interactive")
  if (/input|field/i.test(name)) tags.push("form", "input")
  if (/card|panel/i.test(name)) tags.push("container", "layout")
  if (/modal|dialog/i.test(name)) tags.push("modal", "overlay")
  if (/nav|menu/i.test(name)) tags.push("navigation")

  return {
    name,
    props,
    hasVariants,
    variants: variants.length > 0 ? variants : undefined,
    usesForwardRef,
    hasA11y,
    complexity,
    tags,
  }
}

/**
 * Calculate similarity between two component signatures
 */
function calculateSimilarity(a: ComponentSignature, b: ComponentSignature): number {
  let score = 0
  let total = 0

  // Name similarity (fuzzy match)
  total += 2
  if (a.name.toLowerCase() === b.name.toLowerCase()) {
    score += 2
  } else if (a.name.toLowerCase().includes(b.name.toLowerCase()) ||
             b.name.toLowerCase().includes(a.name.toLowerCase())) {
    score += 1
  }

  // Props overlap
  total += 3
  const commonProps = a.props.filter((p) => b.props.includes(p))
  score += (commonProps.length / Math.max(a.props.length, b.props.length, 1)) * 3

  // Variant similarity
  total += 1
  if (a.hasVariants === b.hasVariants) score += 1

  // Tag overlap
  total += 3
  const commonTags = a.tags.filter((t) => b.tags.includes(t))
  score += (commonTags.length / Math.max(a.tags.length, b.tags.length, 1)) * 3

  // Complexity similarity
  total += 1
  if (Math.abs(a.complexity - b.complexity) <= 2) score += 1

  return score / total
}

/**
 * Search for similar components
 */
export function searchSimilarComponents(
  query: string | ComponentSignature,
  library: ComponentLibrary = SHADCN_LIBRARY
): SimilaritySearchResult {
  const querySignature = typeof query === "string"
    ? extractComponentSignature(query)
    : query

  const matches: SimilarityMatch[] = []

  for (const component of library.components) {
    const score = calculateSimilarity(querySignature, component)

    if (score > 0.3) {
      const matchReasons: string[] = []

      if (querySignature.name.toLowerCase().includes(component.name.toLowerCase())) {
        matchReasons.push("Similar name")
      }

      const commonProps = querySignature.props.filter((p) => component.props.includes(p))
      if (commonProps.length > 0) {
        matchReasons.push(`Shared props: ${commonProps.join(", ")}`)
      }

      const commonTags = querySignature.tags.filter((t) => component.tags.includes(t))
      if (commonTags.length > 0) {
        matchReasons.push(`Related: ${commonTags.join(", ")}`)
      }

      matches.push({
        name: component.name,
        score,
        matchReasons,
        source: "shadcn",
        importPath: `@/components/ui/${component.name.toLowerCase()}`,
        adaptations: generateAdaptations(querySignature, component),
      })
    }
  }

  // Sort by score
  matches.sort((a, b) => b.score - a.score)

  return {
    query: querySignature.name,
    matches: matches.slice(0, 5),
    bestMatch: matches[0],
    confidence: matches[0]?.score || 0,
  }
}

// =============================================================================
// AutoFix Post-Processor (#72)
// =============================================================================

/**
 * Default AutoFix configuration
 */
export const DEFAULT_AUTOFIX_CONFIG: AutoFixConfig = {
  rules: [
    "add-display-name",
    "add-forward-ref",
    "fix-any-types",
    "add-aria-labels",
    "fix-imports",
  ],
  dryRun: false,
  format: true,
}

/**
 * AutoFix rule implementations
 */
const AUTOFIX_RULES: Record<AutoFixRule, (code: string) => { code: string; applied: boolean; description: string }> = {
  "add-display-name": (code) => {
    const match = code.match(/const\s+([A-Z]\w+)\s*=\s*(?:React\.)?forwardRef/)
    if (match && !code.includes(`${match[1]}.displayName`)) {
      const insertPos = code.lastIndexOf("}")
      const newCode = code.slice(0, insertPos + 1) + `\n${match[1]}.displayName = "${match[1]}"\n` + code.slice(insertPos + 1)
      return { code: newCode, applied: true, description: `Added displayName to ${match[1]}` }
    }
    return { code, applied: false, description: "" }
  },

  "add-forward-ref": (code) => {
    // Check if it's a function component without forwardRef
    const funcMatch = code.match(/(?:export\s+)?function\s+([A-Z]\w+)\s*\(([^)]*)\)/)
    if (funcMatch && !code.includes("forwardRef") && code.includes("ref")) {
      // This is complex - just flag it
      return { code, applied: false, description: "Component uses ref but doesn't use forwardRef" }
    }
    return { code, applied: false, description: "" }
  },

  "fix-any-types": (code) => {
    const anyCount = (code.match(/:\s*any\b/g) || []).length
    if (anyCount > 0) {
      const newCode = code.replace(/:\s*any\b/g, ": unknown")
      return { code: newCode, applied: true, description: `Replaced ${anyCount} 'any' type(s) with 'unknown'` }
    }
    return { code, applied: false, description: "" }
  },

  "add-aria-labels": (code) => {
    // Find icon-only buttons
    const iconButtonPattern = /<button([^>]*)>[\s]*<(?:svg|Icon)/g
    let newCode = code
    let count = 0

    newCode = newCode.replace(iconButtonPattern, (match, attrs) => {
      if (!attrs.includes("aria-label")) {
        count++
        return `<button${attrs} aria-label="Button"><`
      }
      return match
    })

    if (count > 0) {
      return { code: newCode, applied: true, description: `Added ${count} aria-label(s) to icon buttons` }
    }
    return { code, applied: false, description: "" }
  },

  "fix-imports": (code) => {
    let newCode = code
    let applied = false

    // Fix React import if using JSX without import
    if (!code.includes("import * as React") && !code.includes('import React') && !code.includes("from 'react'")) {
      if (/React\.|forwardRef|useState|useEffect/.test(code)) {
        newCode = `import * as React from "react"\n` + newCode
        applied = true
      }
    }

    return { code: newCode, applied, description: applied ? "Added missing React import" : "" }
  },

  "format-code": (code) => {
    // Basic formatting - fix double newlines, trailing spaces
    const newCode = code
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+$/gm, "")
      .replace(/\n+$/, "\n")

    return { code: newCode, applied: newCode !== code, description: "Formatted code" }
  },

  "add-use-client": (code) => {
    if (!code.startsWith('"use client"') && !code.startsWith("'use client'")) {
      if (/useState|useEffect|useRef|onClick|onChange/.test(code)) {
        const newCode = '"use client"\n\n' + code
        return { code: newCode, applied: true, description: "Added 'use client' directive" }
      }
    }
    return { code, applied: false, description: "" }
  },

  "fix-key-props": (code) => {
    // This would require AST parsing for accurate fix
    return { code, applied: false, description: "" }
  },

  "add-error-boundary": (code) => {
    // Just suggest, don't auto-add
    return { code, applied: false, description: "" }
  },
}

/**
 * Apply AutoFix rules to code
 */
export function applyAutoFix(
  code: string,
  config: AutoFixConfig = DEFAULT_AUTOFIX_CONFIG
): AutoFixResult {
  let currentCode = code
  const appliedFixes: AutoFixResult["appliedFixes"] = []
  const skippedFixes: AutoFixResult["skippedFixes"] = []

  const rules = config.rules || Object.keys(AUTOFIX_RULES) as AutoFixRule[]
  const skipRules = new Set(config.skipRules || [])

  for (const rule of rules) {
    if (skipRules.has(rule)) {
      skippedFixes.push({ rule, reason: "Skipped by configuration" })
      continue
    }

    const ruleFn = AUTOFIX_RULES[rule]
    if (!ruleFn) continue

    const result = ruleFn(currentCode)

    if (result.applied) {
      if (!config.dryRun) {
        currentCode = result.code
      }
      appliedFixes.push({ rule, description: result.description })
    }
  }

  return {
    original: code,
    fixed: currentCode,
    appliedFixes,
    skippedFixes,
    changeCount: appliedFixes.length,
  }
}

// =============================================================================
// Context Window Management (#73)
// =============================================================================

/**
 * Default context manager configuration
 */
export const DEFAULT_CONTEXT_CONFIG: ContextManagerConfig = {
  maxTokens: 100000,
  reservedTokens: 20000,
  typeWeights: {
    component: 1.0,
    type: 0.9,
    utility: 0.8,
    style: 0.6,
    config: 0.5,
    test: 0.4,
    documentation: 0.3,
  },
  enableCompression: true,
}

/**
 * Estimate token count for text
 */
export function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token
  return Math.ceil(text.length / 4)
}

/**
 * Create a context item
 */
export function createContextItem(
  path: string,
  content: string,
  type: ContextItemType,
  priority: number = 0.5
): ContextItem {
  return {
    id: path,
    type,
    path,
    content,
    tokens: estimateTokens(content),
    priority,
    lastAccessed: Date.now(),
  }
}

/**
 * Create context window
 */
export function createContextWindow(
  config: ContextManagerConfig = DEFAULT_CONTEXT_CONFIG
): ContextWindow {
  const maxTokens = config.maxTokens || 100000
  const reserved = config.reservedTokens || 20000
  const available = maxTokens - reserved

  return {
    maxTokens,
    usedTokens: 0,
    items: [],
    availableTokens: available,
    utilization: 0,
  }
}

/**
 * Add item to context window
 */
export function addToContext(
  window: ContextWindow,
  item: ContextItem,
  config: ContextManagerConfig = DEFAULT_CONTEXT_CONFIG
): ContextWindow {
  const reserved = config.reservedTokens ?? DEFAULT_CONTEXT_CONFIG.reservedTokens ?? 20000
  const available = window.maxTokens - reserved

  // Check if item fits
  if (window.usedTokens + item.tokens > available) {
    // Need to evict items
    const result = optimizeContext(
      { ...window, items: [...window.items, item] },
      available,
      config
    )
    return result.optimized.includes(item)
      ? createWindowFromItems(result.optimized, window.maxTokens, config)
      : window
  }

  const newItems = [...window.items, item]
  const usedTokens = newItems.reduce((sum, i) => sum + i.tokens, 0)

  return {
    ...window,
    items: newItems,
    usedTokens,
    availableTokens: available - usedTokens,
    utilization: usedTokens / available,
  }
}

/**
 * Optimize context to fit within token limit
 */
export function optimizeContext(
  window: ContextWindow,
  targetTokens: number,
  config: ContextManagerConfig = DEFAULT_CONTEXT_CONFIG
): ContextOptimization {
  const weights = config.typeWeights || DEFAULT_CONTEXT_CONFIG.typeWeights!

  // Score each item
  const scoredItems = window.items.map((item) => ({
    item,
    score: item.priority * (weights[item.type] || 0.5) * (item.lastAccessed ? 1 + (Date.now() - item.lastAccessed) / 1000000 : 1),
  }))

  // Sort by score (highest first)
  scoredItems.sort((a, b) => b.score - a.score)

  // Select items that fit
  const optimized: ContextItem[] = []
  let currentTokens = 0

  for (const { item } of scoredItems) {
    if (currentTokens + item.tokens <= targetTokens) {
      optimized.push(item)
      currentTokens += item.tokens
    }
  }

  const removed = window.items.filter((i) => !optimized.includes(i))
  const originalTokens = window.items.reduce((sum, i) => sum + i.tokens, 0)

  return {
    original: window.items,
    optimized,
    removed,
    tokensSaved: originalTokens - currentTokens,
    compressionRatio: originalTokens > 0 ? currentTokens / originalTokens : 1,
  }
}

/**
 * Compress context item content
 */
export function compressContent(content: string): string {
  return content
    // Remove comments
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    // Remove empty lines
    .replace(/^\s*\n/gm, "")
    // Compress whitespace
    .replace(/\s{2,}/g, " ")
    // Remove leading/trailing whitespace per line
    .replace(/^\s+|\s+$/gm, "")
}

// =============================================================================
// Helper Functions
// =============================================================================

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 }
}

function detectLayoutType(description: string): MockupAnalysis["layout"]["type"] {
  if (/dashboard|admin|panel/i.test(description)) return "dashboard"
  if (/sidebar|side bar/i.test(description)) return "sidebar"
  if (/grid|cards|gallery/i.test(description)) return "grid"
  if (/two.?column|split/i.test(description)) return "two-column"
  return "single-column"
}

function generateCritiqueSummary(score: number, _critical: number, _major: number, _minor: number): string {
  if (score >= 9) return "Excellent design quality with minimal issues"
  if (score >= 7) return "Good design quality with room for improvement"
  if (score >= 5) return "Moderate design quality - several issues should be addressed"
  return "Design needs significant improvement"
}

function generateAdaptations(query: ComponentSignature, target: ComponentSignature): string[] {
  const adaptations: string[] = []

  if (query.hasVariants && !target.hasVariants) {
    adaptations.push("Add CVA variants to match your variant requirements")
  }

  if (query.props.length > target.props.length) {
    const extraProps = query.props.filter((p) => !target.props.includes(p))
    if (extraProps.length > 0) {
      adaptations.push(`Add custom props: ${extraProps.join(", ")}`)
    }
  }

  if (!target.hasA11y && query.hasA11y) {
    adaptations.push("Add ARIA attributes for accessibility")
  }

  return adaptations
}

function createWindowFromItems(
  items: ContextItem[],
  maxTokens: number,
  config: ContextManagerConfig
): ContextWindow {
  const reserved = config.reservedTokens || 20000
  const usedTokens = items.reduce((sum, i) => sum + i.tokens, 0)
  const available = maxTokens - reserved

  return {
    maxTokens,
    usedTokens,
    items,
    availableTokens: available - usedTokens,
    utilization: usedTokens / available,
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create AI features system
 */
export function createAIFeaturesSystem(config?: AIFeaturesConfig) {
  return {
    // Mockup analyzer
    analyzeMockup: (description: string) =>
      analyzeMockupDescription(description, config?.mockup),
    generateFromAnalysis: generateCodeFromAnalysis,

    // Design critique
    critique: (code: string) =>
      generateDesignCritique(code, config?.critique),

    // Similarity search
    extractSignature: extractComponentSignature,
    searchSimilar: (query: string | ComponentSignature, library?: ComponentLibrary) =>
      searchSimilarComponents(query, library),
    shadcnLibrary: SHADCN_LIBRARY,

    // AutoFix
    autofix: (code: string) =>
      applyAutoFix(code, config?.autofix),

    // Context management
    createContext: () => createContextWindow(config?.context),
    addToContext: (window: ContextWindow, item: ContextItem) =>
      addToContext(window, item, config?.context),
    optimizeContext: (window: ContextWindow, targetTokens: number) =>
      optimizeContext(window, targetTokens, config?.context),
    estimateTokens,
    createContextItem,
    compressContent,
  }
}
