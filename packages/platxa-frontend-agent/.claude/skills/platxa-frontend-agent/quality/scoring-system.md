# Quality Scoring System

Comprehensive quality assessment for generated frontend components across accessibility, design, and code quality dimensions.

## Overview

Every generated component receives a quality score from 0-10 based on weighted criteria. Components must achieve a minimum score of 7.0 to pass validation.

## Score Calculation

```
Total Score = (Accessibility × 0.30) + (Design × 0.30) + (Code × 0.25) + (Performance × 0.15)
```

| Category | Weight | Description |
|----------|--------|-------------|
| Accessibility | 30% | WCAG compliance, semantic HTML, ARIA |
| Design | 30% | Visual consistency, spacing, typography |
| Code Quality | 25% | TypeScript, patterns, maintainability |
| Performance | 15% | Bundle size, render efficiency |

## Quality Report Schema

```typescript
interface QualityReport {
  /**
   * Overall score (0-10)
   */
  score: number

  /**
   * Pass/fail status (score >= 7.0)
   */
  passed: boolean

  /**
   * Individual category scores
   */
  categories: {
    accessibility: CategoryScore
    design: CategoryScore
    codeQuality: CategoryScore
    performance: CategoryScore
  }

  /**
   * All identified issues
   */
  issues: QualityIssue[]

  /**
   * Improvement suggestions
   */
  suggestions: string[]

  /**
   * Component metadata
   */
  metadata: {
    componentName: string
    linesOfCode: number
    dependencies: string[]
    analyzedAt: string
  }
}

interface CategoryScore {
  score: number
  weight: number
  weightedScore: number
  checks: CheckResult[]
}

interface CheckResult {
  name: string
  passed: boolean
  score: number
  maxScore: number
  message?: string
}

interface QualityIssue {
  severity: "error" | "warning" | "info"
  category: "accessibility" | "design" | "code" | "performance"
  rule: string
  message: string
  line?: number
  suggestion?: string
}
```

## Accessibility Scoring (30%)

### Checks Performed

| Check | Points | Criteria |
|-------|--------|----------|
| Semantic HTML | 2 | Uses appropriate elements (button, nav, main, etc.) |
| ARIA Labels | 2 | Interactive elements have accessible names |
| Focus Management | 2 | Visible focus indicators, logical tab order |
| Color Contrast | 1.5 | Text meets 4.5:1 ratio |
| Keyboard Navigation | 1.5 | All interactions keyboard accessible |
| Screen Reader | 1 | Proper announcements, live regions |

### Implementation

```typescript
const accessibilityChecks = {
  semanticHTML: {
    maxScore: 2,
    check: (ast: ComponentAST) => {
      const issues: QualityIssue[] = []
      let score = 2

      // Check for div soup
      const divCount = countElements(ast, "div")
      const semanticCount = countElements(ast, [
        "main", "nav", "header", "footer", "section", "article", "aside"
      ])

      if (divCount > 10 && semanticCount === 0) {
        score -= 1
        issues.push({
          severity: "warning",
          category: "accessibility",
          rule: "semantic-html",
          message: "Consider using semantic HTML elements instead of divs",
          suggestion: "Replace container divs with <main>, <section>, <article>"
        })
      }

      // Check buttons vs div onClick
      const divWithOnClick = findElements(ast, {
        tag: "div",
        hasAttribute: "onClick"
      })

      if (divWithOnClick.length > 0) {
        score -= 0.5
        issues.push({
          severity: "error",
          category: "accessibility",
          rule: "button-role",
          message: `Found ${divWithOnClick.length} clickable divs without button role`,
          suggestion: "Use <button> or add role='button' and keyboard handlers"
        })
      }

      return { score, issues }
    }
  },

  ariaLabels: {
    maxScore: 2,
    check: (ast: ComponentAST) => {
      const issues: QualityIssue[] = []
      let score = 2

      // Check icon buttons
      const iconButtons = findElements(ast, {
        tag: "Button",
        hasChild: { tag: /Icon$/ },
        noChild: { type: "text" }
      })

      const unlabeledButtons = iconButtons.filter(
        btn => !btn.props["aria-label"] && !btn.props["aria-labelledby"]
      )

      if (unlabeledButtons.length > 0) {
        score -= 1
        issues.push({
          severity: "error",
          category: "accessibility",
          rule: "button-label",
          message: `${unlabeledButtons.length} icon buttons missing accessible labels`,
          suggestion: "Add aria-label to describe button action"
        })
      }

      // Check images
      const images = findElements(ast, { tag: "img" })
      const missingAlt = images.filter(img => !img.props.alt)

      if (missingAlt.length > 0) {
        score -= 0.5
        issues.push({
          severity: "error",
          category: "accessibility",
          rule: "img-alt",
          message: `${missingAlt.length} images missing alt text`,
          suggestion: "Add descriptive alt text or alt='' for decorative images"
        })
      }

      return { score, issues }
    }
  },

  focusManagement: {
    maxScore: 2,
    check: (ast: ComponentAST, styles: StyleAnalysis) => {
      const issues: QualityIssue[] = []
      let score = 2

      // Check for focus-visible styles
      const hasFocusStyles = styles.classes.some(
        c => c.includes("focus-visible:") || c.includes("focus:")
      )

      if (!hasFocusStyles) {
        score -= 1
        issues.push({
          severity: "warning",
          category: "accessibility",
          rule: "focus-visible",
          message: "No visible focus indicators detected",
          suggestion: "Add focus-visible:ring-2 focus-visible:ring-ring classes"
        })
      }

      // Check tabIndex usage
      const negativeTabIndex = findElements(ast, {
        hasAttribute: "tabIndex",
        attributeValue: { tabIndex: (v: number) => v < -1 }
      })

      if (negativeTabIndex.length > 0) {
        score -= 0.5
        issues.push({
          severity: "warning",
          category: "accessibility",
          rule: "tabindex",
          message: "Avoid tabIndex values less than -1",
          suggestion: "Use tabIndex={0} for focusable or tabIndex={-1} for programmatic focus"
        })
      }

      return { score, issues }
    }
  },

  colorContrast: {
    maxScore: 1.5,
    check: (styles: StyleAnalysis) => {
      const issues: QualityIssue[] = []
      let score = 1.5

      // Check for semantic color tokens
      const usesSemanticColors = styles.colors.every(
        c => c.startsWith("text-") || c.startsWith("bg-") || c.includes("foreground") || c.includes("muted")
      )

      if (!usesSemanticColors) {
        score -= 0.5
        issues.push({
          severity: "info",
          category: "accessibility",
          rule: "semantic-colors",
          message: "Use semantic color tokens for consistent contrast",
          suggestion: "Replace hardcoded colors with text-foreground, text-muted-foreground"
        })
      }

      return { score, issues }
    }
  },

  keyboardNavigation: {
    maxScore: 1.5,
    check: (ast: ComponentAST) => {
      const issues: QualityIssue[] = []
      let score = 1.5

      // Check onClick without onKeyDown
      const clickableElements = findElements(ast, {
        hasAttribute: "onClick",
        notTag: ["button", "a", "input", "select", "textarea"]
      })

      const missingKeyboard = clickableElements.filter(
        el => !el.props.onKeyDown && !el.props.onKeyUp && el.props.role !== "button"
      )

      if (missingKeyboard.length > 0) {
        score -= 1
        issues.push({
          severity: "error",
          category: "accessibility",
          rule: "keyboard-handler",
          message: `${missingKeyboard.length} clickable elements lack keyboard handlers`,
          suggestion: "Add onKeyDown handler for Enter/Space or use semantic elements"
        })
      }

      return { score, issues }
    }
  },

  screenReader: {
    maxScore: 1,
    check: (ast: ComponentAST) => {
      const issues: QualityIssue[] = []
      let score = 1

      // Check for sr-only text where needed
      const iconOnlyElements = findElements(ast, {
        hasChild: { tag: /Icon$/ },
        noChild: { type: "text" },
        noAttribute: ["aria-label", "aria-labelledby"]
      })

      // Check for live regions in dynamic content
      const dynamicContent = findElements(ast, {
        hasAttribute: ["useState", "loading", "error"]
      })

      const hasLiveRegion = findElements(ast, {
        hasAttribute: ["aria-live", "role"]
      }).some(el => el.props.role === "alert" || el.props.role === "status")

      if (dynamicContent.length > 0 && !hasLiveRegion) {
        score -= 0.5
        issues.push({
          severity: "info",
          category: "accessibility",
          rule: "live-region",
          message: "Dynamic content may need aria-live announcements",
          suggestion: "Add aria-live='polite' or role='status' for updates"
        })
      }

      return { score, issues }
    }
  }
}
```

## Design Scoring (30%)

### Checks Performed

| Check | Points | Criteria |
|-------|--------|----------|
| Spacing Consistency | 2 | Uses 8px grid, consistent gaps |
| Typography Hierarchy | 2 | Proper heading levels, readable sizes |
| Color Usage | 2 | Follows 60-30-10 rule, semantic tokens |
| Component Consistency | 2 | Uses design system components |
| Responsive Design | 2 | Mobile-first, breakpoint handling |

### Implementation

```typescript
const designChecks = {
  spacingConsistency: {
    maxScore: 2,
    check: (styles: StyleAnalysis) => {
      const issues: QualityIssue[] = []
      let score = 2

      // Check for 8px grid compliance
      const spacingValues = styles.spacing.map(extractPixelValue)
      const offGridValues = spacingValues.filter(v => v % 4 !== 0)

      if (offGridValues.length > 0) {
        score -= 0.5
        issues.push({
          severity: "info",
          category: "design",
          rule: "spacing-grid",
          message: "Some spacing values not on 4px/8px grid",
          suggestion: "Use Tailwind spacing scale: gap-2, p-4, m-6, etc."
        })
      }

      // Check for consistent gap usage
      const gapClasses = styles.classes.filter(c => c.startsWith("gap-"))
      const uniqueGaps = new Set(gapClasses)

      if (uniqueGaps.size > 3) {
        score -= 0.5
        issues.push({
          severity: "warning",
          category: "design",
          rule: "gap-consistency",
          message: "Too many different gap values used",
          suggestion: "Standardize on 2-3 gap values (e.g., gap-4, gap-6, gap-8)"
        })
      }

      return { score, issues }
    }
  },

  typographyHierarchy: {
    maxScore: 2,
    check: (ast: ComponentAST, styles: StyleAnalysis) => {
      const issues: QualityIssue[] = []
      let score = 2

      // Check heading order
      const headings = findElements(ast, { tag: /^h[1-6]$/ })
      const levels = headings.map(h => parseInt(h.tag[1]))

      for (let i = 1; i < levels.length; i++) {
        if (levels[i] - levels[i - 1] > 1) {
          score -= 0.5
          issues.push({
            severity: "warning",
            category: "design",
            rule: "heading-order",
            message: `Heading level skipped: h${levels[i - 1]} to h${levels[i]}`,
            suggestion: "Maintain sequential heading hierarchy"
          })
          break
        }
      }

      // Check for text size variety
      const textSizes = styles.classes.filter(c => c.startsWith("text-"))
      const uniqueSizes = new Set(textSizes.filter(c => /text-(xs|sm|base|lg|xl|[2-9]xl)/.test(c)))

      if (uniqueSizes.size > 5) {
        score -= 0.5
        issues.push({
          severity: "info",
          category: "design",
          rule: "text-sizes",
          message: "Many different text sizes used",
          suggestion: "Limit to 3-4 distinct text sizes for consistency"
        })
      }

      return { score, issues }
    }
  },

  colorUsage: {
    maxScore: 2,
    check: (styles: StyleAnalysis) => {
      const issues: QualityIssue[] = []
      let score = 2

      // Check for hardcoded colors
      const hardcodedColors = styles.colors.filter(
        c => c.startsWith("#") || c.startsWith("rgb") || c.startsWith("hsl")
      )

      if (hardcodedColors.length > 2) {
        score -= 1
        issues.push({
          severity: "warning",
          category: "design",
          rule: "hardcoded-colors",
          message: `${hardcodedColors.length} hardcoded color values found`,
          suggestion: "Use CSS variables: bg-primary, text-foreground, etc."
        })
      }

      // Check for semantic color usage
      const semanticColors = ["primary", "secondary", "accent", "muted", "destructive"]
      const usedSemanticColors = semanticColors.filter(
        color => styles.classes.some(c => c.includes(color))
      )

      if (usedSemanticColors.length < 2) {
        score -= 0.5
        issues.push({
          severity: "info",
          category: "design",
          rule: "semantic-colors",
          message: "Limited use of semantic color tokens",
          suggestion: "Use primary, secondary, muted, accent for theming support"
        })
      }

      return { score, issues }
    }
  },

  componentConsistency: {
    maxScore: 2,
    check: (ast: ComponentAST) => {
      const issues: QualityIssue[] = []
      let score = 2

      // Check for shadcn/ui component usage
      const shadcnComponents = [
        "Button", "Input", "Card", "Dialog", "Select",
        "Checkbox", "RadioGroup", "Switch", "Tabs", "Badge"
      ]

      const usedComponents = findImports(ast, "@/components/ui/")
      const customDivButtons = findElements(ast, {
        tag: "div",
        hasAttribute: "onClick",
        className: /btn|button/i
      })

      if (customDivButtons.length > 0 && !usedComponents.includes("Button")) {
        score -= 1
        issues.push({
          severity: "warning",
          category: "design",
          rule: "use-design-system",
          message: "Custom button implementations found",
          suggestion: "Use Button component from @/components/ui/button"
        })
      }

      return { score, issues }
    }
  },

  responsiveDesign: {
    maxScore: 2,
    check: (styles: StyleAnalysis) => {
      const issues: QualityIssue[] = []
      let score = 2

      // Check for responsive classes
      const breakpointPrefixes = ["sm:", "md:", "lg:", "xl:", "2xl:"]
      const responsiveClasses = styles.classes.filter(
        c => breakpointPrefixes.some(bp => c.startsWith(bp))
      )

      if (responsiveClasses.length === 0) {
        score -= 1
        issues.push({
          severity: "warning",
          category: "design",
          rule: "responsive-classes",
          message: "No responsive breakpoint classes found",
          suggestion: "Add md: and lg: variants for responsive layouts"
        })
      }

      // Check for mobile-first approach
      const lgOnlyPatterns = styles.classes.filter(
        c => c.startsWith("lg:") && !styles.classes.some(
          base => c.replace("lg:", "") === base
        )
      )

      if (lgOnlyPatterns.length > 5) {
        score -= 0.5
        issues.push({
          severity: "info",
          category: "design",
          rule: "mobile-first",
          message: "Consider mobile-first approach",
          suggestion: "Define base styles for mobile, add breakpoints for larger screens"
        })
      }

      return { score, issues }
    }
  }
}
```

## Code Quality Scoring (25%)

### Checks Performed

| Check | Points | Criteria |
|-------|--------|----------|
| TypeScript Usage | 2.5 | Proper types, no `any` |
| Component Structure | 2.5 | Clean patterns, SRP |
| Naming Conventions | 2 | Descriptive, consistent |
| Error Handling | 1.5 | Boundaries, loading states |
| Best Practices | 1.5 | Hooks rules, key props |

### Implementation

```typescript
const codeQualityChecks = {
  typescriptUsage: {
    maxScore: 2.5,
    check: (code: string, ast: ComponentAST) => {
      const issues: QualityIssue[] = []
      let score = 2.5

      // Check for any types
      const anyMatches = code.match(/:\s*any\b/g)
      if (anyMatches && anyMatches.length > 0) {
        score -= 1
        issues.push({
          severity: "error",
          category: "code",
          rule: "no-any",
          message: `${anyMatches.length} uses of 'any' type found`,
          suggestion: "Replace 'any' with specific types or 'unknown'"
        })
      }

      // Check for proper prop types
      const hasPropsInterface = /interface\s+\w+Props/.test(code)
      if (!hasPropsInterface) {
        score -= 0.5
        issues.push({
          severity: "warning",
          category: "code",
          rule: "props-interface",
          message: "No Props interface defined",
          suggestion: "Define interface ComponentNameProps for type safety"
        })
      }

      // Check for React.FC (discouraged)
      if (/React\.FC|React\.FunctionComponent/.test(code)) {
        score -= 0.5
        issues.push({
          severity: "info",
          category: "code",
          rule: "no-react-fc",
          message: "React.FC is discouraged",
          suggestion: "Use explicit return type or inference"
        })
      }

      return { score, issues }
    }
  },

  componentStructure: {
    maxScore: 2.5,
    check: (ast: ComponentAST, code: string) => {
      const issues: QualityIssue[] = []
      let score = 2.5

      // Check component size
      const lines = code.split("\n").length
      if (lines > 200) {
        score -= 1
        issues.push({
          severity: "warning",
          category: "code",
          rule: "component-size",
          message: `Component has ${lines} lines (recommended: <200)`,
          suggestion: "Split into smaller, focused components"
        })
      }

      // Check for forwardRef usage on interactive components
      const hasRef = /forwardRef/.test(code)
      const isInteractive = findElements(ast, {
        tag: ["input", "button", "select", "textarea"]
      }).length > 0

      if (isInteractive && !hasRef && /export (default )?function/.test(code)) {
        score -= 0.5
        issues.push({
          severity: "info",
          category: "code",
          rule: "forward-ref",
          message: "Interactive component should support ref forwarding",
          suggestion: "Wrap with React.forwardRef for ref support"
        })
      }

      return { score, issues }
    }
  },

  namingConventions: {
    maxScore: 2,
    check: (code: string) => {
      const issues: QualityIssue[] = []
      let score = 2

      // Check component naming (PascalCase)
      const componentMatch = code.match(/export\s+(default\s+)?function\s+(\w+)/)
      if (componentMatch) {
        const name = componentMatch[2]
        if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
          score -= 0.5
          issues.push({
            severity: "warning",
            category: "code",
            rule: "component-naming",
            message: `Component name '${name}' should be PascalCase`,
            suggestion: "Use PascalCase for component names"
          })
        }
      }

      // Check handler naming (handleX or onX)
      const handlers = code.match(/const\s+(\w+)\s*=\s*\([^)]*\)\s*=>/g) || []
      const badHandlers = handlers.filter(h => {
        const name = h.match(/const\s+(\w+)/)?.[1]
        return name && /click|submit|change/i.test(name) && !/^(handle|on)[A-Z]/.test(name)
      })

      if (badHandlers.length > 0) {
        score -= 0.5
        issues.push({
          severity: "info",
          category: "code",
          rule: "handler-naming",
          message: "Event handlers should use handleX or onX naming",
          suggestion: "Rename to handleClick, handleSubmit, onChange, etc."
        })
      }

      return { score, issues }
    }
  },

  errorHandling: {
    maxScore: 1.5,
    check: (ast: ComponentAST, code: string) => {
      const issues: QualityIssue[] = []
      let score = 1.5

      // Check for loading states
      const hasAsync = /async|await|fetch|axios/.test(code)
      const hasLoading = /loading|isLoading|pending/.test(code)

      if (hasAsync && !hasLoading) {
        score -= 0.5
        issues.push({
          severity: "warning",
          category: "code",
          rule: "loading-state",
          message: "Async operations should have loading states",
          suggestion: "Add loading state and show indicator during fetch"
        })
      }

      // Check for error handling
      const hasError = /error|isError|catch/.test(code)
      if (hasAsync && !hasError) {
        score -= 0.5
        issues.push({
          severity: "warning",
          category: "code",
          rule: "error-handling",
          message: "Async operations should handle errors",
          suggestion: "Add try/catch or error state handling"
        })
      }

      return { score, issues }
    }
  },

  bestPractices: {
    maxScore: 1.5,
    check: (ast: ComponentAST, code: string) => {
      const issues: QualityIssue[] = []
      let score = 1.5

      // Check for key props in lists
      const maps = code.match(/\.map\([^)]+\)/g) || []
      const missingKeys = maps.filter(m => !m.includes("key=") && !m.includes("key:"))

      if (missingKeys.length > 0) {
        score -= 0.5
        issues.push({
          severity: "error",
          category: "code",
          rule: "list-keys",
          message: "List items should have unique key props",
          suggestion: "Add key={item.id} or key={index} to mapped elements"
        })
      }

      // Check for useEffect dependencies
      const useEffects = code.match(/useEffect\([^)]+,\s*\[\s*\]\s*\)/g) || []
      const emptyDeps = useEffects.filter(e => /,\s*\[\s*\]/.test(e))

      // Check useCallback/useMemo for functions passed to children
      const inlineHandlers = findElements(ast, {
        hasAttribute: "onClick",
        attributeValue: { onClick: /^\(\) =>/ }
      })

      if (inlineHandlers.length > 3) {
        score -= 0.5
        issues.push({
          severity: "info",
          category: "code",
          rule: "memoize-handlers",
          message: "Consider memoizing inline handlers",
          suggestion: "Use useCallback for handlers passed to child components"
        })
      }

      return { score, issues }
    }
  }
}
```

## Performance Scoring (15%)

### Checks Performed

| Check | Points | Criteria |
|-------|--------|----------|
| Bundle Impact | 3 | Import sizes, tree-shaking |
| Render Efficiency | 4 | Memoization, re-renders |
| Asset Optimization | 3 | Image loading, lazy imports |

### Implementation

```typescript
const performanceChecks = {
  bundleImpact: {
    maxScore: 3,
    check: (imports: ImportAnalysis) => {
      const issues: QualityIssue[] = []
      let score = 3

      // Check for barrel imports
      const barrelImports = imports.filter(
        i => i.from.endsWith("/index") || (!i.named && !i.from.includes("/"))
      )

      if (barrelImports.length > 3) {
        score -= 1
        issues.push({
          severity: "warning",
          category: "performance",
          rule: "barrel-imports",
          message: "Barrel imports may increase bundle size",
          suggestion: "Import directly from specific files"
        })
      }

      // Check for heavy dependencies
      const heavyDeps = ["moment", "lodash", "date-fns"]
      const usedHeavy = imports.filter(i => heavyDeps.some(d => i.from.includes(d)))

      if (usedHeavy.length > 0) {
        score -= 1
        issues.push({
          severity: "info",
          category: "performance",
          rule: "heavy-deps",
          message: `Heavy dependencies detected: ${usedHeavy.map(i => i.from).join(", ")}`,
          suggestion: "Consider lighter alternatives or import specific functions"
        })
      }

      return { score, issues }
    }
  },

  renderEfficiency: {
    maxScore: 4,
    check: (code: string, ast: ComponentAST) => {
      const issues: QualityIssue[] = []
      let score = 4

      // Check for inline object/array creation in JSX
      const inlineObjects = code.match(/style=\{\{[^}]+\}\}/g) || []
      if (inlineObjects.length > 2) {
        score -= 1
        issues.push({
          severity: "warning",
          category: "performance",
          rule: "inline-styles",
          message: "Inline style objects cause re-renders",
          suggestion: "Move styles to className or useMemo"
        })
      }

      // Check for useMemo on expensive computations
      const complexFilters = code.match(/\.filter\([^)]+\)\.map\([^)]+\)/g) || []
      const hasMemo = /useMemo/.test(code)

      if (complexFilters.length > 0 && !hasMemo) {
        score -= 1
        issues.push({
          severity: "info",
          category: "performance",
          rule: "memoize-computation",
          message: "Complex data transformations should be memoized",
          suggestion: "Wrap filter/map chains in useMemo"
        })
      }

      return { score, issues }
    }
  },

  assetOptimization: {
    maxScore: 3,
    check: (ast: ComponentAST) => {
      const issues: QualityIssue[] = []
      let score = 3

      // Check for Next.js Image component
      const imgElements = findElements(ast, { tag: "img" })
      const nextImages = findElements(ast, { tag: "Image" })

      if (imgElements.length > 0 && nextImages.length === 0) {
        score -= 1
        issues.push({
          severity: "warning",
          category: "performance",
          rule: "next-image",
          message: "Use Next.js Image component for optimization",
          suggestion: "Replace <img> with <Image> from next/image"
        })
      }

      // Check for lazy loading
      const heavyImports = findImports(ast, ["framer-motion", "recharts", "@radix-ui"])
      const hasDynamic = /dynamic\(/.test(ast.code)

      if (heavyImports.length > 2 && !hasDynamic) {
        score -= 1
        issues.push({
          severity: "info",
          category: "performance",
          rule: "lazy-loading",
          message: "Consider lazy loading heavy components",
          suggestion: "Use next/dynamic or React.lazy for code splitting"
        })
      }

      return { score, issues }
    }
  }
}
```

## Score Report Example

```json
{
  "score": 8.2,
  "passed": true,
  "categories": {
    "accessibility": {
      "score": 8.5,
      "weight": 0.30,
      "weightedScore": 2.55,
      "checks": [
        { "name": "semanticHTML", "passed": true, "score": 2, "maxScore": 2 },
        { "name": "ariaLabels", "passed": true, "score": 1.5, "maxScore": 2, "message": "1 icon button missing label" },
        { "name": "focusManagement", "passed": true, "score": 2, "maxScore": 2 },
        { "name": "colorContrast", "passed": true, "score": 1.5, "maxScore": 1.5 },
        { "name": "keyboardNavigation", "passed": true, "score": 1.5, "maxScore": 1.5 }
      ]
    },
    "design": {
      "score": 8.0,
      "weight": 0.30,
      "weightedScore": 2.40,
      "checks": [
        { "name": "spacingConsistency", "passed": true, "score": 2, "maxScore": 2 },
        { "name": "typographyHierarchy", "passed": true, "score": 2, "maxScore": 2 },
        { "name": "colorUsage", "passed": true, "score": 1.5, "maxScore": 2, "message": "Limited semantic colors" },
        { "name": "componentConsistency", "passed": true, "score": 2, "maxScore": 2 },
        { "name": "responsiveDesign", "passed": false, "score": 0.5, "maxScore": 2, "message": "Missing responsive classes" }
      ]
    },
    "codeQuality": {
      "score": 9.0,
      "weight": 0.25,
      "weightedScore": 2.25,
      "checks": [
        { "name": "typescriptUsage", "passed": true, "score": 2.5, "maxScore": 2.5 },
        { "name": "componentStructure", "passed": true, "score": 2.5, "maxScore": 2.5 },
        { "name": "namingConventions", "passed": true, "score": 2, "maxScore": 2 },
        { "name": "errorHandling", "passed": true, "score": 1, "maxScore": 1.5, "message": "Missing loading state" },
        { "name": "bestPractices", "passed": true, "score": 1, "maxScore": 1.5 }
      ]
    },
    "performance": {
      "score": 7.0,
      "weight": 0.15,
      "weightedScore": 1.05,
      "checks": [
        { "name": "bundleImpact", "passed": true, "score": 2, "maxScore": 3, "message": "Heavy import detected" },
        { "name": "renderEfficiency", "passed": true, "score": 3, "maxScore": 4, "message": "Inline objects found" },
        { "name": "assetOptimization", "passed": true, "score": 2, "maxScore": 3 }
      ]
    }
  },
  "issues": [
    {
      "severity": "warning",
      "category": "accessibility",
      "rule": "button-label",
      "message": "1 icon button missing accessible label",
      "suggestion": "Add aria-label to describe button action"
    },
    {
      "severity": "warning",
      "category": "design",
      "rule": "responsive-classes",
      "message": "No responsive breakpoint classes found",
      "suggestion": "Add md: and lg: variants for responsive layouts"
    }
  ],
  "suggestions": [
    "Add aria-label to icon-only buttons",
    "Add responsive breakpoint classes for mobile support",
    "Consider memoizing inline handlers with useCallback"
  ],
  "metadata": {
    "componentName": "FeatureCard",
    "linesOfCode": 87,
    "dependencies": ["react", "framer-motion", "@/components/ui/card"],
    "analyzedAt": "2024-01-10T12:00:00Z"
  }
}
```

## Integration

The quality scoring system integrates with the `accessibility-auditor` worker agent and is invoked automatically after component generation.

```typescript
// In component-generator worker
const generatedCode = await generateComponent(analysis)

// Score the generated component
const qualityReport = await scoreComponent(generatedCode)

if (!qualityReport.passed) {
  // Iterate to improve score
  const improvedCode = await improveComponent(generatedCode, qualityReport.issues)
  return improvedCode
}

return generatedCode
```

## Export

```typescript
export {
  scoreComponent,
  generateQualityReport,
  accessibilityChecks,
  designChecks,
  codeQualityChecks,
  performanceChecks
}
export type { QualityReport, CategoryScore, QualityIssue }
```
