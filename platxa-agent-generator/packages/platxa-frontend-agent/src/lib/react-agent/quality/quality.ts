/**
 * Quality Module
 *
 * Component quality scoring, design system consistency checking,
 * TypeScript validation, and documentation generation.
 */

import type {
  QualityCategory,
  CheckSeverity,
  QualityCheck,
  QualityScoreBreakdown,
  QualityReport,
  QualityScoringConfig,
  TokenUsage,
  ConsistencyResult,
  DesignSystemRules,
  TypeScriptCheckType,
  TypeScriptIssue,
  TypeScriptValidation,
  PropDoc,
  ComponentDoc,
  DocGenerationOptions,
} from "./types"

// =============================================================================
// Quality Scoring System (#78)
// =============================================================================

/**
 * Default quality weights
 */
export const DEFAULT_QUALITY_WEIGHTS: QualityScoreBreakdown = {
  accessibility: 0.20,
  design: 0.15,
  code: 0.25,
  typescript: 0.20,
  performance: 0.10,
  documentation: 0.10,
}

/**
 * Create a quality check result
 */
export function createCheck(
  id: string,
  category: QualityCategory,
  name: string,
  passed: boolean,
  severity: CheckSeverity,
  message: string,
  options?: { line?: number; suggestion?: string }
): QualityCheck {
  return {
    id,
    category,
    name,
    passed,
    severity,
    message,
    ...options,
  }
}

/**
 * Accessibility checks
 */
function runAccessibilityChecks(code: string): QualityCheck[] {
  const checks: QualityCheck[] = []

  // Check for ARIA labels on interactive elements
  const hasAriaLabels = /aria-label|aria-labelledby|aria-describedby/.test(code)
  checks.push(createCheck(
    "a11y-aria-labels",
    "accessibility",
    "ARIA Labels",
    hasAriaLabels || !/button|input|select/.test(code),
    "warning",
    hasAriaLabels ? "ARIA labels present" : "Consider adding ARIA labels for accessibility",
    { suggestion: "Add aria-label or aria-labelledby to interactive elements" }
  ))

  // Check for role attributes
  const hasRoles = /role=["']/.test(code)
  const needsRoles = /dialog|modal|menu|tab/.test(code.toLowerCase())
  checks.push(createCheck(
    "a11y-roles",
    "accessibility",
    "ARIA Roles",
    hasRoles || !needsRoles,
    "warning",
    hasRoles ? "ARIA roles defined" : "Consider adding ARIA roles for complex components",
    { suggestion: "Add appropriate role attributes (e.g., role=\"dialog\")" }
  ))

  // Check for keyboard navigation
  const hasKeyboardHandlers = /onKeyDown|onKeyUp|onKeyPress|tabIndex/.test(code)
  const isInteractive = /onClick|button|input|select|a href/.test(code)
  checks.push(createCheck(
    "a11y-keyboard",
    "accessibility",
    "Keyboard Navigation",
    hasKeyboardHandlers || !isInteractive,
    "warning",
    hasKeyboardHandlers ? "Keyboard handlers present" : "Ensure keyboard navigation is supported",
    { suggestion: "Add onKeyDown handlers for keyboard accessibility" }
  ))

  // Check for focus management
  const hasFocusManagement = /focus\(|autoFocus|tabIndex|focus-visible|focus:/.test(code)
  checks.push(createCheck(
    "a11y-focus",
    "accessibility",
    "Focus Management",
    hasFocusManagement,
    "info",
    hasFocusManagement ? "Focus management present" : "Consider adding focus indicators",
    { suggestion: "Add focus-visible styles for keyboard users" }
  ))

  // Check for reduced motion support
  const hasReducedMotion = /prefers-reduced-motion|reducedMotion/.test(code)
  const hasAnimations = /animate|transition|motion/.test(code)
  checks.push(createCheck(
    "a11y-reduced-motion",
    "accessibility",
    "Reduced Motion",
    hasReducedMotion || !hasAnimations,
    "info",
    hasReducedMotion ? "Reduced motion supported" : "Consider supporting prefers-reduced-motion",
    { suggestion: "Add @media (prefers-reduced-motion: reduce) styles" }
  ))

  return checks
}

/**
 * Code quality checks
 */
function runCodeChecks(code: string): QualityCheck[] {
  const checks: QualityCheck[] = []

  // Check for forwardRef
  const hasForwardRef = /React\.forwardRef|forwardRef/.test(code)
  checks.push(createCheck(
    "code-forward-ref",
    "code",
    "Forward Ref",
    hasForwardRef,
    "warning",
    hasForwardRef ? "Uses forwardRef pattern" : "Consider using forwardRef for DOM access",
    { suggestion: "Wrap component with React.forwardRef" }
  ))

  // Check for displayName
  const hasDisplayName = /\.displayName\s*=/.test(code)
  checks.push(createCheck(
    "code-display-name",
    "code",
    "Display Name",
    hasDisplayName,
    "error",
    hasDisplayName ? "Has displayName" : "Missing displayName - affects React DevTools",
    { suggestion: "Add ComponentName.displayName = \"ComponentName\"" }
  ))

  // Check for cn utility usage
  const hasCnUtility = /cn\(/.test(code)
  const hasClassName = /className/.test(code)
  checks.push(createCheck(
    "code-cn-utility",
    "code",
    "CN Utility",
    hasCnUtility || !hasClassName,
    "warning",
    hasCnUtility ? "Uses cn() utility" : "Consider using cn() for class merging",
    { suggestion: "Use cn() from @/lib/utils for className composition" }
  ))

  // Check for proper exports
  const hasNamedExport = /export\s+(const|function|interface|type|{)/.test(code)
  checks.push(createCheck(
    "code-exports",
    "code",
    "Proper Exports",
    hasNamedExport,
    "error",
    hasNamedExport ? "Has proper exports" : "Missing exports",
    { suggestion: "Export the component and its types" }
  ))

  // Check for error boundaries consideration
  const hasErrorHandling = /try|catch|ErrorBoundary|onError/.test(code)
  checks.push(createCheck(
    "code-error-handling",
    "code",
    "Error Handling",
    hasErrorHandling,
    "info",
    hasErrorHandling ? "Has error handling" : "Consider error handling for robustness",
    { suggestion: "Wrap with ErrorBoundary or add try-catch blocks" }
  ))

  return checks
}

/**
 * TypeScript checks
 */
function runTypeScriptChecks(code: string): QualityCheck[] {
  const checks: QualityCheck[] = []

  // Check for 'any' type usage
  const anyMatches = code.match(/:\s*any\b/g) || []
  checks.push(createCheck(
    "ts-no-any",
    "typescript",
    "No Any Type",
    anyMatches.length === 0,
    "error",
    anyMatches.length === 0 ? "No 'any' types found" : `Found ${anyMatches.length} 'any' type(s)`,
    { suggestion: "Replace 'any' with proper types or 'unknown'" }
  ))

  // Check for interface/type definitions
  const hasTypes = /interface\s+\w+|type\s+\w+\s*=/.test(code)
  checks.push(createCheck(
    "ts-type-definitions",
    "typescript",
    "Type Definitions",
    hasTypes,
    "warning",
    hasTypes ? "Has type definitions" : "Consider adding interface/type definitions",
    { suggestion: "Define interfaces for props and state" }
  ))

  // Check for Props interface
  const hasPropsInterface = /interface\s+\w*Props/.test(code)
  const isComponent = /function\s+\w+|const\s+\w+\s*=/.test(code)
  checks.push(createCheck(
    "ts-props-interface",
    "typescript",
    "Props Interface",
    hasPropsInterface || !isComponent,
    "warning",
    hasPropsInterface ? "Has Props interface" : "Define a Props interface for the component",
    { suggestion: "Create an interface like: interface ComponentProps { ... }" }
  ))

  // Check for proper generic usage
  const hasGenerics = /<\w+>/.test(code)
  const usesForwardRef = /forwardRef/.test(code)
  checks.push(createCheck(
    "ts-generics",
    "typescript",
    "Generic Types",
    hasGenerics || !usesForwardRef,
    "info",
    hasGenerics ? "Uses generic types" : "Consider using generics for type safety",
    { suggestion: "Use generics like forwardRef<HTMLDivElement, Props>" }
  ))

  // Check for explicit return types
  const hasReturnTypes = /\):\s*(React\.ReactNode|JSX\.Element|ReactElement)/.test(code)
  checks.push(createCheck(
    "ts-return-types",
    "typescript",
    "Return Types",
    hasReturnTypes,
    "info",
    hasReturnTypes ? "Has explicit return types" : "Consider adding explicit return types",
    { suggestion: "Add return type annotation: ): React.ReactNode" }
  ))

  return checks
}

/**
 * Design checks
 */
function runDesignChecks(code: string): QualityCheck[] {
  const checks: QualityCheck[] = []

  // Check for CVA usage
  const hasCva = /cva\(/.test(code)
  const hasVariants = /variant|size/.test(code)
  checks.push(createCheck(
    "design-cva",
    "design",
    "CVA Variants",
    hasCva || !hasVariants,
    "info",
    hasCva ? "Uses CVA for variants" : "Consider using CVA for variant management",
    { suggestion: "Use class-variance-authority for variant styling" }
  ))

  // Check for design tokens (CSS variables)
  const hasTokens = /var\(--/.test(code)
  checks.push(createCheck(
    "design-tokens",
    "design",
    "Design Tokens",
    hasTokens,
    "warning",
    hasTokens ? "Uses CSS variables/tokens" : "Consider using design tokens",
    { suggestion: "Use CSS variables like var(--primary) instead of hardcoded colors" }
  ))

  // Check for responsive classes
  const hasResponsive = /sm:|md:|lg:|xl:|@/.test(code)
  checks.push(createCheck(
    "design-responsive",
    "design",
    "Responsive Design",
    hasResponsive,
    "info",
    hasResponsive ? "Has responsive classes" : "Consider adding responsive breakpoints",
    { suggestion: "Add responsive classes like md:flex lg:grid" }
  ))

  // Check for consistent spacing
  const hasSpacing = /p-\d|m-\d|gap-\d|space-/.test(code)
  checks.push(createCheck(
    "design-spacing",
    "design",
    "Consistent Spacing",
    hasSpacing,
    "info",
    hasSpacing ? "Uses spacing utilities" : "Consider using spacing utilities",
    { suggestion: "Use Tailwind spacing utilities for consistent spacing" }
  ))

  return checks
}

/**
 * Performance checks
 */
function runPerformanceChecks(code: string): QualityCheck[] {
  const checks: QualityCheck[] = []

  // Memo check - React Compiler handles this automatically in React 19+
  checks.push(createCheck(
    "perf-memoization",
    "performance",
    "Memoization",
    true, // Always pass - React Compiler handles this now
    "info",
    "Memoization handled by React Compiler (React 19+)",
    { suggestion: "React Compiler auto-memoizes; manual memo rarely needed" }
  ))

  // Check for lazy loading hints
  const hasLazyHints = /lazy|Suspense|loading="lazy"/.test(code)
  const hasImages = /img|Image/.test(code)
  checks.push(createCheck(
    "perf-lazy-loading",
    "performance",
    "Lazy Loading",
    hasLazyHints || !hasImages,
    "info",
    hasLazyHints ? "Uses lazy loading" : "Consider lazy loading for images/components",
    { suggestion: "Add loading=\"lazy\" to images or use React.lazy for components" }
  ))

  // Check for event handler creation in render
  const inlineHandlers = (code.match(/onClick=\{\(\)\s*=>/g) || []).length
  checks.push(createCheck(
    "perf-inline-handlers",
    "performance",
    "Event Handlers",
    inlineHandlers < 3,
    "info",
    inlineHandlers < 3 ? "Reasonable inline handlers" : `${inlineHandlers} inline handlers - consider extracting`,
    { suggestion: "Extract frequently-used handlers to useCallback" }
  ))

  return checks
}

/**
 * Documentation checks
 */
function runDocumentationChecks(code: string): QualityCheck[] {
  const checks: QualityCheck[] = []

  // Check for JSDoc comments
  const hasJsDoc = /\/\*\*[\s\S]*?\*\//.test(code)
  checks.push(createCheck(
    "doc-jsdoc",
    "documentation",
    "JSDoc Comments",
    hasJsDoc,
    "info",
    hasJsDoc ? "Has JSDoc comments" : "Consider adding JSDoc comments",
    { suggestion: "Add /** ... */ comments for components and props" }
  ))

  // Check for prop descriptions
  const propComments = (code.match(/\/\*\*[^*]*\*\/\s*\n\s*\w+[?]?:/g) || []).length
  const propCount = (code.match(/\w+[?]?:\s*\w+/g) || []).length
  const hasGoodCoverage = propComments >= propCount * 0.5
  checks.push(createCheck(
    "doc-prop-comments",
    "documentation",
    "Prop Documentation",
    hasGoodCoverage,
    "info",
    hasGoodCoverage ? "Props are documented" : "Consider documenting props",
    { suggestion: "Add /** description */ above each prop" }
  ))

  // Check for file header
  const hasFileHeader = /^\/\*\*[\s\S]*?\*\//.test(code.trim())
  checks.push(createCheck(
    "doc-file-header",
    "documentation",
    "File Header",
    hasFileHeader,
    "info",
    hasFileHeader ? "Has file header comment" : "Consider adding a file header",
    { suggestion: "Add a file header describing the component" }
  ))

  return checks
}

/**
 * Calculate category score from checks
 */
function calculateCategoryScore(checks: QualityCheck[]): number {
  if (checks.length === 0) return 10

  let score = 10
  for (const check of checks) {
    if (!check.passed) {
      switch (check.severity) {
        case "error":
          score -= 2.5
          break
        case "warning":
          score -= 1.5
          break
        case "info":
          score -= 0.5
          break
      }
    }
  }

  return Math.max(0, Math.min(10, score))
}

/**
 * Generate comprehensive quality report
 */
export function generateQualityReport(
  code: string,
  config: QualityScoringConfig = {}
): QualityReport {
  const minScore = config.minScore ?? 7.0
  const weights = { ...DEFAULT_QUALITY_WEIGHTS, ...config.weights }
  const skipChecks = new Set(config.skipChecks || [])

  // Run all checks
  const allChecks: QualityCheck[] = [
    ...runAccessibilityChecks(code),
    ...runCodeChecks(code),
    ...runTypeScriptChecks(code),
    ...runDesignChecks(code),
    ...runPerformanceChecks(code),
    ...runDocumentationChecks(code),
  ].filter((check) => !skipChecks.has(check.id))

  // In strict mode, warnings become errors
  if (config.strict) {
    allChecks.forEach((check) => {
      if (check.severity === "warning") {
        check.severity = "error"
      }
    })
  }

  // Categorize checks
  const errors = allChecks.filter((c) => !c.passed && c.severity === "error")
  const warnings = allChecks.filter((c) => !c.passed && c.severity === "warning")
  const info = allChecks.filter((c) => !c.passed && c.severity === "info")

  // Calculate breakdown
  const byCategory = (cat: QualityCategory) => allChecks.filter((c) => c.category === cat)
  const breakdown: QualityScoreBreakdown = {
    accessibility: calculateCategoryScore(byCategory("accessibility")),
    design: calculateCategoryScore(byCategory("design")),
    code: calculateCategoryScore(byCategory("code")),
    typescript: calculateCategoryScore(byCategory("typescript")),
    performance: calculateCategoryScore(byCategory("performance")),
    documentation: calculateCategoryScore(byCategory("documentation")),
  }

  // Calculate weighted overall score
  const score = Math.round((
    breakdown.accessibility * weights.accessibility +
    breakdown.design * weights.design +
    breakdown.code * weights.code +
    breakdown.typescript * weights.typescript +
    breakdown.performance * weights.performance +
    breakdown.documentation * weights.documentation
  ) * 10) / 10

  const passed = score >= minScore && errors.length === 0

  // Generate summary
  let summary: string
  if (passed) {
    summary = `Quality score ${score}/10 - Passed! ${errors.length} errors, ${warnings.length} warnings.`
  } else if (errors.length > 0) {
    summary = `Quality score ${score}/10 - Failed. ${errors.length} error(s) must be fixed.`
  } else {
    summary = `Quality score ${score}/10 - Below threshold (${minScore}). Address warnings to improve.`
  }

  return {
    score,
    breakdown,
    checks: allChecks,
    errors,
    warnings,
    info,
    summary,
    passed,
    threshold: minScore,
  }
}

// =============================================================================
// Design System Consistency (#79)
// =============================================================================

/**
 * Default design system rules based on Tailwind
 */
export const DEFAULT_DESIGN_RULES: DesignSystemRules = {
  spacing: ["0", "0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4", "5", "6", "7", "8", "9", "10", "11", "12", "14", "16", "20", "24", "28", "32", "36", "40", "44", "48", "52", "56", "60", "64", "72", "80", "96"],
  colors: ["primary", "secondary", "destructive", "muted", "accent", "card", "popover", "background", "foreground", "border", "input", "ring"],
  fontSizes: ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl"],
  borderRadii: ["none", "sm", "md", "lg", "xl", "2xl", "3xl", "full"],
}

/**
 * Check for raw color values
 */
function findRawColors(code: string): TokenUsage[] {
  const issues: TokenUsage[] = []

  // Hex colors
  const hexPattern = /#[0-9a-fA-F]{3,8}\b/g
  let match: RegExpExecArray | null
  while ((match = hexPattern.exec(code)) !== null) {
    const lines = code.substring(0, match.index).split("\n")
    issues.push({
      type: "color",
      rawValue: match[0],
      suggestedToken: "var(--primary) or bg-primary",
      line: lines.length,
    })
  }

  // RGB/RGBA colors
  const rgbPattern = /rgba?\([^)]+\)/g
  while ((match = rgbPattern.exec(code)) !== null) {
    const lines = code.substring(0, match.index).split("\n")
    issues.push({
      type: "color",
      rawValue: match[0],
      suggestedToken: "var(--color) or bg-color",
      line: lines.length,
    })
  }

  // HSL colors (but not CSS variables)
  const hslPattern = /(?<!var\([^)]*)\bhsla?\([^)]+\)/g
  while ((match = hslPattern.exec(code)) !== null) {
    const lines = code.substring(0, match.index).split("\n")
    issues.push({
      type: "color",
      rawValue: match[0],
      suggestedToken: "var(--color) or semantic color class",
      line: lines.length,
    })
  }

  return issues
}

/**
 * Check for raw spacing values
 */
function findRawSpacing(code: string): TokenUsage[] {
  const issues: TokenUsage[] = []

  // Pixel values in styles (but allow common exceptions)
  const pxPattern = /(?<!border-|outline-|ring-)(\d+)px/g
  let match: RegExpExecArray | null
  while ((match = pxPattern.exec(code)) !== null) {
    const value = parseInt(match[1])
    // Skip 1px (borders), 2px (focus rings), and common icon sizes
    if (value !== 1 && value !== 2 && value % 4 !== 0 && value > 2) {
      const lines = code.substring(0, match.index).split("\n")
      issues.push({
        type: "spacing",
        rawValue: match[0],
        suggestedToken: `p-${value / 4} or m-${value / 4}`,
        line: lines.length,
      })
    }
  }

  return issues
}

/**
 * Check design system consistency
 */
export function checkDesignConsistency(
  code: string,
  _rules: DesignSystemRules = DEFAULT_DESIGN_RULES
): ConsistencyResult {
  const colorIssues = findRawColors(code)
  const spacingIssues = findRawSpacing(code)
  const allIssues = [...colorIssues, ...spacingIssues]

  // Count tokenized vs raw usage
  const tokenizedColors = (code.match(/var\(--\w+\)|bg-\w+|text-\w+|border-\w+/g) || []).length
  const tokenizedSpacing = (code.match(/[pm][trblxy]?-\d+|gap-\d+|space-[xy]-\d+/g) || []).length

  const usageByType: ConsistencyResult["usageByType"] = {
    color: {
      tokenized: tokenizedColors,
      raw: colorIssues.length,
      total: tokenizedColors + colorIssues.length,
    },
    spacing: {
      tokenized: tokenizedSpacing,
      raw: spacingIssues.length,
      total: tokenizedSpacing + spacingIssues.length,
    },
    fontSize: { tokenized: 0, raw: 0, total: 0 },
    fontWeight: { tokenized: 0, raw: 0, total: 0 },
    borderRadius: { tokenized: 0, raw: 0, total: 0 },
    shadow: { tokenized: 0, raw: 0, total: 0 },
    zIndex: { tokenized: 0, raw: 0, total: 0 },
    animation: { tokenized: 0, raw: 0, total: 0 },
  }

  // Calculate consistency score
  const totalTokenized = tokenizedColors + tokenizedSpacing
  const totalRaw = allIssues.length
  const total = totalTokenized + totalRaw
  const score = total > 0 ? Math.round((totalTokenized / total) * 100) : 100

  // Generate recommendations
  const recommendations: string[] = []
  if (colorIssues.length > 0) {
    recommendations.push(`Replace ${colorIssues.length} hardcoded color(s) with design tokens`)
  }
  if (spacingIssues.length > 0) {
    recommendations.push(`Replace ${spacingIssues.length} raw spacing value(s) with Tailwind utilities`)
  }
  if (score < 80) {
    recommendations.push("Consider auditing all styles for design system compliance")
  }

  return {
    isConsistent: allIssues.length === 0,
    score,
    issues: allIssues,
    usageByType,
    recommendations,
  }
}

// =============================================================================
// TypeScript Validation (#80)
// =============================================================================

/**
 * Validate TypeScript strict mode compliance
 */
export function validateTypeScript(code: string): TypeScriptValidation {
  const issues: TypeScriptIssue[] = []
  const passed: TypeScriptCheckType[] = []
  const failed: TypeScriptCheckType[] = []

  // Check for 'any' type
  const anyMatches = [...code.matchAll(/:\s*any\b/g)]
  if (anyMatches.length === 0) {
    passed.push("no-any")
  } else {
    failed.push("no-any")
    anyMatches.forEach((match) => {
      const lines = code.substring(0, match.index).split("\n")
      issues.push({
        type: "no-any",
        message: "Avoid using 'any' type - use 'unknown' or proper types",
        line: lines.length,
        snippet: code.split("\n")[lines.length - 1]?.trim(),
        fix: "Replace 'any' with a specific type or 'unknown'",
      })
    })
  }

  // Check for type assertions (as Type)
  const assertionMatches = [...code.matchAll(/\bas\s+\w+/g)]
  if (assertionMatches.length < 3) {
    passed.push("no-type-assertions")
  } else {
    failed.push("no-type-assertions")
    issues.push({
      type: "no-type-assertions",
      message: `Found ${assertionMatches.length} type assertions - consider type guards instead`,
      line: 0,
      fix: "Use type guards or proper type narrowing instead of 'as' assertions",
    })
  }

  // Check for explicit return types on functions
  const funcWithoutReturn = code.match(/(?:function|const)\s+\w+\s*=?\s*\([^)]*\)\s*(?:=>)?\s*{/g) || []
  const funcWithReturn = code.match(/\):\s*\w+[\w<>,\s|]*(?:\s*=>)?\s*{/g) || []
  if (funcWithReturn.length >= funcWithoutReturn.length * 0.5) {
    passed.push("explicit-return-types")
  } else {
    failed.push("explicit-return-types")
    issues.push({
      type: "explicit-return-types",
      message: "Consider adding explicit return types to functions",
      line: 0,
      fix: "Add return type annotation: ): ReturnType => { ... }",
    })
  }

  // Check for proper generics
  if (/forwardRef<\w+/.test(code) || !/forwardRef/.test(code)) {
    passed.push("proper-generics")
  } else {
    failed.push("proper-generics")
    issues.push({
      type: "proper-generics",
      message: "forwardRef should have explicit generic types",
      line: 0,
      fix: "Use forwardRef<HTMLElement, Props>(...)",
    })
  }

  // Calculate score
  const totalChecks = passed.length + failed.length
  const score = totalChecks > 0 ? Math.round((passed.length / totalChecks) * 10 * 10) / 10 : 10
  const isStrict = failed.length === 0 || (failed.length === 1 && failed[0] === "explicit-return-types")

  return {
    isStrict,
    score,
    issues,
    passed,
    failed,
  }
}

// =============================================================================
// Documentation Generation (#81)
// =============================================================================

/**
 * Extract props from TypeScript interface
 */
function extractProps(code: string): PropDoc[] {
  const props: PropDoc[] = []

  // Find Props interface
  const interfaceMatch = code.match(/interface\s+(\w*Props)[^{]*{([^}]+)}/s)
  if (!interfaceMatch) return props

  const interfaceBody = interfaceMatch[2]

  // Parse each prop
  const propPattern = /(?:\/\*\*\s*([^*]*)\s*\*\/\s*)?(\w+)(\?)?:\s*([^;\n]+)/g
  let match: RegExpExecArray | null

  while ((match = propPattern.exec(interfaceBody)) !== null) {
    const description = match[1]?.trim() || ""
    const name = match[2]
    const required = !match[3]
    const type = match[4].trim()

    props.push({
      name,
      type,
      required,
      description: description || `The ${name} prop`,
    })
  }

  return props
}

/**
 * Generate component documentation
 */
export function generateComponentDoc(
  code: string,
  options: DocGenerationOptions = {}
): ComponentDoc {
  // Note: options.format reserved for future multi-format support (markdown, json, html)

  // Extract component name - prioritize actual React components over utility functions
  // 1. Check for forwardRef component (most reliable for React components)
  // 2. Check for displayName assignment
  // 3. Check for PascalCase const/function (React naming convention)
  // 4. Fall back to first export
  const forwardRefMatch = code.match(/const\s+([A-Z]\w+)\s*=\s*(?:React\.)?forwardRef/)
  const displayNameMatch = code.match(/(\w+)\.displayName\s*=/)
  const pascalMatch = code.match(/(?:export\s+)?(?:function|const)\s+([A-Z][a-z]\w+)\s*[=:]/)
  const nameMatch = forwardRefMatch || displayNameMatch || pascalMatch ||
    code.match(/(?:function|const)\s+(\w+)/)
  const name = nameMatch?.[1] || "Component"

  // Extract description from file header
  const headerMatch = code.match(/^\/\*\*\s*\n\s*\*\s*(.+?)(?:\n\s*\*\s*\n|\n\s*\*\/)/s)
  const description = headerMatch?.[1]?.trim() || `${name} component`

  // Extract props
  const props = extractProps(code)

  // Generate examples
  const examples: ComponentDoc["examples"] = []
  if (options.includeExamples !== false) {
    // Basic usage
    const propsString = props
      .filter((p) => p.required)
      .map((p) => `${p.name}={${p.type === "string" ? '"value"' : "value"}}`)
      .join(" ")

    examples.push({
      title: "Basic Usage",
      code: `<${name}${propsString ? " " + propsString : ""} />`,
      description: `Basic ${name} component usage`,
    })

    // With all props
    if (props.length > 0) {
      const allPropsString = props
        .map((p) => `${p.name}={${p.type === "string" ? '"value"' : "value"}}`)
        .join("\n  ")

      examples.push({
        title: "With All Props",
        code: `<${name}\n  ${allPropsString}\n/>`,
        description: `${name} with all available props`,
      })
    }
  }

  // Accessibility notes
  const a11yNotes: string[] = []
  if (options.includeA11y !== false) {
    if (/aria-/.test(code)) {
      a11yNotes.push("Component includes ARIA attributes for screen reader support")
    }
    if (/role=/.test(code)) {
      a11yNotes.push("Component defines appropriate ARIA role")
    }
    if (/tabIndex|onKeyDown/.test(code)) {
      a11yNotes.push("Component supports keyboard navigation")
    }
    if (/focus-visible|:focus/.test(code)) {
      a11yNotes.push("Component has visible focus indicators")
    }
  }

  return {
    name,
    description,
    props,
    examples,
    a11yNotes: a11yNotes.length > 0 ? a11yNotes : undefined,
  }
}

/**
 * Format documentation as markdown
 */
export function formatDocAsMarkdown(doc: ComponentDoc): string {
  const lines: string[] = []

  lines.push(`# ${doc.name}`)
  lines.push("")
  lines.push(doc.description)
  lines.push("")

  // Props table
  if (doc.props.length > 0) {
    lines.push("## Props")
    lines.push("")
    lines.push("| Prop | Type | Required | Description |")
    lines.push("|------|------|----------|-------------|")
    for (const prop of doc.props) {
      lines.push(`| \`${prop.name}\` | \`${prop.type}\` | ${prop.required ? "Yes" : "No"} | ${prop.description} |`)
    }
    lines.push("")
  }

  // Examples
  if (doc.examples.length > 0) {
    lines.push("## Examples")
    lines.push("")
    for (const example of doc.examples) {
      lines.push(`### ${example.title}`)
      lines.push("")
      if (example.description) {
        lines.push(example.description)
        lines.push("")
      }
      lines.push("```tsx")
      lines.push(example.code)
      lines.push("```")
      lines.push("")
    }
  }

  // Accessibility
  if (doc.a11yNotes && doc.a11yNotes.length > 0) {
    lines.push("## Accessibility")
    lines.push("")
    for (const note of doc.a11yNotes) {
      lines.push(`- ${note}`)
    }
    lines.push("")
  }

  return lines.join("\n")
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create quality system
 */
export function createQualitySystem(config?: QualityScoringConfig) {
  return {
    /**
     * Generate full quality report
     */
    analyze: (code: string) => generateQualityReport(code, config),

    /**
     * Check design system consistency
     */
    checkConsistency: (code: string, rules?: DesignSystemRules) =>
      checkDesignConsistency(code, rules),

    /**
     * Validate TypeScript
     */
    validateTypeScript: (code: string) => validateTypeScript(code),

    /**
     * Generate documentation
     */
    generateDocs: (code: string, options?: DocGenerationOptions) =>
      generateComponentDoc(code, options),

    /**
     * Format documentation as markdown
     */
    formatDocs: (doc: ComponentDoc) => formatDocAsMarkdown(doc),

    /**
     * Quick pass/fail check
     */
    quickCheck: (code: string): { passed: boolean; score: number; summary: string } => {
      const report = generateQualityReport(code, config)
      return {
        passed: report.passed,
        score: report.score,
        summary: report.summary,
      }
    },
  }
}
