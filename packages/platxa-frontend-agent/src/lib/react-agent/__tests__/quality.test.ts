/**
 * Quality Module Tests
 *
 * Tests for quality scoring, design consistency,
 * TypeScript validation, and documentation generation.
 */

import { describe, it, expect } from "vitest"
import {
  DEFAULT_QUALITY_WEIGHTS,
  generateQualityReport,
  DEFAULT_DESIGN_RULES,
  checkDesignConsistency,
  validateTypeScript,
  generateComponentDoc,
  formatDocAsMarkdown,
  createQualitySystem,
} from "../quality"

// =============================================================================
// Test Fixtures
// =============================================================================

const GOOD_COMPONENT = `/**
 * Button Component
 *
 * A clickable button with variants.
 */

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Whether the button is in a loading state */
  isLoading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
`

const BAD_COMPONENT = `
import React from "react"

function BadComponent(props: any) {
  return (
    <div style={{ color: "#ff0000", padding: "15px" }} onClick={() => console.log("click")}>
      {props.children}
    </div>
  )
}

export default BadComponent
`

const MEDIUM_COMPONENT = `
import * as React from "react"
import { cn } from "@/lib/utils"

interface CardProps {
  children: React.ReactNode
  className?: string
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("rounded-lg border bg-card p-4", className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
Card.displayName = "Card"

export { Card }
`

// =============================================================================
// Quality Scoring (#78)
// =============================================================================

describe("Quality Scoring", () => {
  describe("DEFAULT_QUALITY_WEIGHTS", () => {
    it("should have all categories", () => {
      expect(DEFAULT_QUALITY_WEIGHTS.accessibility).toBeDefined()
      expect(DEFAULT_QUALITY_WEIGHTS.design).toBeDefined()
      expect(DEFAULT_QUALITY_WEIGHTS.code).toBeDefined()
      expect(DEFAULT_QUALITY_WEIGHTS.typescript).toBeDefined()
      expect(DEFAULT_QUALITY_WEIGHTS.performance).toBeDefined()
      expect(DEFAULT_QUALITY_WEIGHTS.documentation).toBeDefined()
    })

    it("should sum to approximately 1.0", () => {
      const sum = Object.values(DEFAULT_QUALITY_WEIGHTS).reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(1.0, 2)
    })
  })

  describe("generateQualityReport", () => {
    it("should generate report for good component", () => {
      const report = generateQualityReport(GOOD_COMPONENT)

      expect(report.score).toBeGreaterThan(7)
      expect(report.passed).toBe(true)
      expect(report.checks.length).toBeGreaterThan(0)
      expect(report.breakdown).toBeDefined()
    })

    it("should generate lower score for bad component", () => {
      const report = generateQualityReport(BAD_COMPONENT)

      expect(report.score).toBeLessThan(7)
      expect(report.errors.length).toBeGreaterThan(0)
    })

    it("should generate medium score for medium component", () => {
      const report = generateQualityReport(MEDIUM_COMPONENT)

      expect(report.score).toBeGreaterThan(5)
      expect(report.score).toBeLessThan(10)
    })

    it("should respect custom threshold", () => {
      const report = generateQualityReport(MEDIUM_COMPONENT, { minScore: 9 })

      expect(report.threshold).toBe(9)
      // May or may not pass depending on score
    })

    it("should allow skipping checks", () => {
      const reportWithSkip = generateQualityReport(BAD_COMPONENT, {
        skipChecks: ["ts-no-any", "code-display-name"],
      })
      const reportWithoutSkip = generateQualityReport(BAD_COMPONENT)

      expect(reportWithSkip.checks.length).toBeLessThan(reportWithoutSkip.checks.length)
    })

    it("should apply strict mode", () => {
      const strictReport = generateQualityReport(MEDIUM_COMPONENT, { strict: true })
      const normalReport = generateQualityReport(MEDIUM_COMPONENT, { strict: false })

      // In strict mode, warnings become errors
      expect(strictReport.errors.length).toBeGreaterThanOrEqual(normalReport.errors.length)
    })

    it("should categorize checks correctly", () => {
      const report = generateQualityReport(GOOD_COMPONENT)

      const categories = new Set(report.checks.map((c) => c.category))
      expect(categories.has("accessibility")).toBe(true)
      expect(categories.has("code")).toBe(true)
      expect(categories.has("typescript")).toBe(true)
    })

    it("should provide suggestions for failed checks", () => {
      const report = generateQualityReport(BAD_COMPONENT)

      const failedWithSuggestions = report.checks.filter(
        (c) => !c.passed && c.suggestion
      )
      expect(failedWithSuggestions.length).toBeGreaterThan(0)
    })

    it("should generate summary message", () => {
      const goodReport = generateQualityReport(GOOD_COMPONENT)
      const badReport = generateQualityReport(BAD_COMPONENT)

      expect(goodReport.summary).toContain("Passed")
      expect(badReport.summary).toContain("error")
    })
  })
})

// =============================================================================
// Design Consistency (#79)
// =============================================================================

describe("Design Consistency", () => {
  describe("DEFAULT_DESIGN_RULES", () => {
    it("should have spacing values", () => {
      expect(DEFAULT_DESIGN_RULES.spacing).toBeDefined()
      expect(DEFAULT_DESIGN_RULES.spacing!.length).toBeGreaterThan(0)
    })

    it("should have color tokens", () => {
      expect(DEFAULT_DESIGN_RULES.colors).toBeDefined()
      expect(DEFAULT_DESIGN_RULES.colors).toContain("primary")
    })
  })

  describe("checkDesignConsistency", () => {
    it("should detect raw hex colors", () => {
      const code = `const style = { color: "#ff0000" }`
      const result = checkDesignConsistency(code)

      expect(result.isConsistent).toBe(false)
      expect(result.issues.some((i) => i.type === "color")).toBe(true)
    })

    it("should detect raw RGB colors", () => {
      const code = `const style = { background: "rgb(255, 0, 0)" }`
      const result = checkDesignConsistency(code)

      expect(result.issues.some((i) => i.rawValue.includes("rgb"))).toBe(true)
    })

    it("should allow CSS variables", () => {
      const code = `const style = { color: "var(--primary)" }`
      const result = checkDesignConsistency(code)

      expect(result.issues.filter((i) => i.type === "color").length).toBe(0)
    })

    it("should detect raw spacing values", () => {
      const code = `const style = { padding: "15px" }`
      const result = checkDesignConsistency(code)

      expect(result.issues.some((i) => i.type === "spacing")).toBe(true)
    })

    it("should allow standard spacing (multiples of 4)", () => {
      const code = `const style = { padding: "16px" }`
      const result = checkDesignConsistency(code)

      // 16px is 4 * 4, should be allowed
      expect(result.issues.filter((i) => i.rawValue === "16px").length).toBe(0)
    })

    it("should calculate consistency score", () => {
      const goodCode = `className="bg-primary text-foreground p-4 m-2"`
      const badCode = `style={{ color: "#ff0000", padding: "15px" }}`

      const goodResult = checkDesignConsistency(goodCode)
      const badResult = checkDesignConsistency(badCode)

      expect(goodResult.score).toBeGreaterThan(badResult.score)
    })

    it("should track usage by type", () => {
      const code = `className="bg-primary p-4" style={{ color: "#000" }}`
      const result = checkDesignConsistency(code)

      expect(result.usageByType.color).toBeDefined()
      expect(result.usageByType.spacing).toBeDefined()
    })

    it("should provide recommendations", () => {
      const code = `style={{ color: "#ff0000" }}`
      const result = checkDesignConsistency(code)

      expect(result.recommendations.length).toBeGreaterThan(0)
    })

    it("should return 100% for fully tokenized code", () => {
      const code = `className="bg-primary text-foreground p-4 m-2 rounded-lg"`
      const result = checkDesignConsistency(code)

      expect(result.isConsistent).toBe(true)
      expect(result.score).toBe(100)
    })
  })
})

// =============================================================================
// TypeScript Validation (#80)
// =============================================================================

describe("TypeScript Validation", () => {
  describe("validateTypeScript", () => {
    it("should detect any type usage", () => {
      const code = `function foo(x: any): any { return x }`
      const result = validateTypeScript(code)

      expect(result.failed).toContain("no-any")
      expect(result.issues.some((i) => i.type === "no-any")).toBe(true)
    })

    it("should pass when no any types", () => {
      const code = `function foo(x: string): string { return x }`
      const result = validateTypeScript(code)

      expect(result.passed).toContain("no-any")
    })

    it("should detect excessive type assertions", () => {
      const code = `
        const a = x as string
        const b = y as number
        const c = z as boolean
        const d = w as object
      `
      const result = validateTypeScript(code)

      expect(result.failed).toContain("no-type-assertions")
    })

    it("should check for proper generics in forwardRef", () => {
      const goodCode = `React.forwardRef<HTMLDivElement, Props>((props, ref) => {})`
      const badCode = `React.forwardRef((props, ref) => {})`

      const goodResult = validateTypeScript(goodCode)
      const badResult = validateTypeScript(badCode)

      expect(goodResult.passed).toContain("proper-generics")
      expect(badResult.failed).toContain("proper-generics")
    })

    it("should calculate TypeScript score", () => {
      const goodCode = GOOD_COMPONENT
      const badCode = `function bad(x: any): any { return x as string }`

      const goodResult = validateTypeScript(goodCode)
      const badResult = validateTypeScript(badCode)

      expect(goodResult.score).toBeGreaterThan(badResult.score)
    })

    it("should determine strict mode compliance", () => {
      const strictCode = GOOD_COMPONENT
      const nonStrictCode = BAD_COMPONENT

      const strictResult = validateTypeScript(strictCode)
      const nonStrictResult = validateTypeScript(nonStrictCode)

      expect(strictResult.isStrict).toBe(true)
      expect(nonStrictResult.isStrict).toBe(false)
    })

    it("should provide fixes for issues", () => {
      const code = `function foo(x: any) {}`
      const result = validateTypeScript(code)

      const anyIssue = result.issues.find((i) => i.type === "no-any")
      expect(anyIssue?.fix).toBeDefined()
    })
  })
})

// =============================================================================
// Documentation Generation (#81)
// =============================================================================

describe("Documentation Generation", () => {
  describe("generateComponentDoc", () => {
    it("should extract component name", () => {
      const doc = generateComponentDoc(GOOD_COMPONENT)

      expect(doc.name).toBe("Button")
    })

    it("should extract description from header", () => {
      const doc = generateComponentDoc(GOOD_COMPONENT)

      expect(doc.description).toContain("Button")
    })

    it("should extract props", () => {
      const doc = generateComponentDoc(GOOD_COMPONENT)

      expect(doc.props.length).toBeGreaterThan(0)
      expect(doc.props.some((p) => p.name === "isLoading")).toBe(true)
    })

    it("should identify required vs optional props", () => {
      const doc = generateComponentDoc(GOOD_COMPONENT)

      const loadingProp = doc.props.find((p) => p.name === "isLoading")
      expect(loadingProp?.required).toBe(false)
    })

    it("should generate examples", () => {
      const doc = generateComponentDoc(GOOD_COMPONENT, { includeExamples: true })

      expect(doc.examples.length).toBeGreaterThan(0)
      expect(doc.examples[0].code).toContain("Button")
    })

    it("should include accessibility notes", () => {
      const doc = generateComponentDoc(GOOD_COMPONENT, { includeA11y: true })

      // Good component has aria-busy
      expect(doc.a11yNotes).toBeDefined()
    })

    it("should handle components without props interface", () => {
      const simpleCode = `
        function Simple() {
          return <div>Hello</div>
        }
        Simple.displayName = "Simple"
      `
      const doc = generateComponentDoc(simpleCode)

      expect(doc.name).toBe("Simple")
      expect(doc.props).toEqual([])
    })
  })

  describe("formatDocAsMarkdown", () => {
    it("should format documentation as markdown", () => {
      const doc = generateComponentDoc(GOOD_COMPONENT)
      const markdown = formatDocAsMarkdown(doc)

      expect(markdown).toContain("# Button")
      expect(markdown).toContain("## Props")
      expect(markdown).toContain("|")
    })

    it("should include props table", () => {
      const doc = generateComponentDoc(GOOD_COMPONENT)
      const markdown = formatDocAsMarkdown(doc)

      expect(markdown).toContain("| Prop |")
      expect(markdown).toContain("| Type |")
      expect(markdown).toContain("isLoading")
    })

    it("should include examples section", () => {
      const doc = generateComponentDoc(GOOD_COMPONENT, { includeExamples: true })
      const markdown = formatDocAsMarkdown(doc)

      expect(markdown).toContain("## Examples")
      expect(markdown).toContain("```tsx")
    })

    it("should include accessibility section when notes exist", () => {
      const doc = generateComponentDoc(GOOD_COMPONENT, { includeA11y: true })
      const markdown = formatDocAsMarkdown(doc)

      if (doc.a11yNotes && doc.a11yNotes.length > 0) {
        expect(markdown).toContain("## Accessibility")
      }
    })
  })
})

// =============================================================================
// Factory Function
// =============================================================================

describe("createQualitySystem", () => {
  it("should create quality system with all methods", () => {
    const system = createQualitySystem()

    expect(typeof system.analyze).toBe("function")
    expect(typeof system.checkConsistency).toBe("function")
    expect(typeof system.validateTypeScript).toBe("function")
    expect(typeof system.generateDocs).toBe("function")
    expect(typeof system.formatDocs).toBe("function")
    expect(typeof system.quickCheck).toBe("function")
  })

  it("should use custom config", () => {
    const system = createQualitySystem({ minScore: 9.0 })
    const report = system.analyze(MEDIUM_COMPONENT)

    expect(report.threshold).toBe(9.0)
  })

  it("should provide quick check", () => {
    const system = createQualitySystem()
    const result = system.quickCheck(GOOD_COMPONENT)

    expect(result.passed).toBeDefined()
    expect(result.score).toBeDefined()
    expect(result.summary).toBeDefined()
  })

  it("should integrate all quality checks", () => {
    const system = createQualitySystem()

    const report = system.analyze(GOOD_COMPONENT)
    const consistency = system.checkConsistency(GOOD_COMPONENT)
    const typescript = system.validateTypeScript(GOOD_COMPONENT)
    const docs = system.generateDocs(GOOD_COMPONENT)
    const markdown = system.formatDocs(docs)

    expect(report.score).toBeGreaterThan(0)
    expect(consistency.score).toBeGreaterThanOrEqual(0)
    expect(typescript.score).toBeGreaterThan(0)
    expect(docs.name).toBe("Button")
    expect(markdown).toContain("# Button")
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe("Quality Integration", () => {
  it("should provide comprehensive analysis", () => {
    const system = createQualitySystem({ minScore: 7.0 })

    const report = system.analyze(GOOD_COMPONENT)
    const consistency = system.checkConsistency(GOOD_COMPONENT)
    const typescript = system.validateTypeScript(GOOD_COMPONENT)

    // Good component should pass all checks
    expect(report.passed).toBe(true)
    expect(consistency.isConsistent).toBe(true)
    expect(typescript.isStrict).toBe(true)
  })

  it("should identify issues in bad component", () => {
    const system = createQualitySystem()

    const report = system.analyze(BAD_COMPONENT)
    const consistency = system.checkConsistency(BAD_COMPONENT)
    const typescript = system.validateTypeScript(BAD_COMPONENT)

    expect(report.errors.length).toBeGreaterThan(0)
    expect(consistency.issues.length).toBeGreaterThan(0)
    expect(typescript.failed.length).toBeGreaterThan(0)
  })

  it("should generate useful documentation", () => {
    const system = createQualitySystem()
    const docs = system.generateDocs(GOOD_COMPONENT, {
      includeExamples: true,
      includeA11y: true,
    })
    const markdown = system.formatDocs(docs)

    // Should have all sections
    expect(markdown).toContain("# Button")
    expect(markdown).toContain("## Props")
    expect(markdown).toContain("## Examples")
  })

  it("should handle edge cases gracefully", () => {
    const system = createQualitySystem()

    // Empty code
    const emptyReport = system.analyze("")
    expect(emptyReport.score).toBeDefined()

    // Minimal code
    const minimalReport = system.analyze("const x = 1")
    expect(minimalReport.score).toBeDefined()
  })
})
