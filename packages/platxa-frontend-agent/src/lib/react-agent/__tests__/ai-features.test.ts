/**
 * AI Features Module Tests
 *
 * Tests for mockup-to-code, design critique, similarity search,
 * AutoFix, and context window management.
 */

import { describe, it, expect } from "vitest"
import {
  // Mockup analyzer
  DEFAULT_MOCKUP_CONFIG,
  analyzeMockupDescription,
  generateCodeFromAnalysis,
  // Design critique
  DEFAULT_CRITIQUE_CONFIG,
  generateDesignCritique,
  // Similarity search
  SHADCN_LIBRARY,
  extractComponentSignature,
  searchSimilarComponents,
  // AutoFix
  DEFAULT_AUTOFIX_CONFIG,
  applyAutoFix,
  // Context management
  DEFAULT_CONTEXT_CONFIG,
  estimateTokens,
  createContextItem,
  createContextWindow,
  addToContext,
  optimizeContext,
  compressContent,
  // Factory
  createAIFeaturesSystem,
} from "../ai-features"

// =============================================================================
// Test Fixtures
// =============================================================================

const SAMPLE_COMPONENT = `
import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva("px-4 py-2 rounded-md", {
  variants: {
    variant: {
      default: "bg-primary text-white",
      secondary: "bg-gray-100 text-gray-900",
    },
  },
})

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant }), className)}
      aria-label="Button"
      {...props}
    />
  )
)
Button.displayName = "Button"

export { Button }
`

const BAD_COMPONENT = `
const BadComponent = (props: any) => {
  return (
    <div style={{ color: "#ff0000", padding: "15px" }}>
      <button onClick={() => {}}>
        <svg />
      </button>
    </div>
  )
}
export default BadComponent
`

// =============================================================================
// Mockup-to-Code Analyzer Tests (#69)
// =============================================================================

describe("Mockup-to-Code Analyzer", () => {
  describe("DEFAULT_MOCKUP_CONFIG", () => {
    it("should have default values", () => {
      expect(DEFAULT_MOCKUP_CONFIG.minConfidence).toBe(0.7)
      expect(DEFAULT_MOCKUP_CONFIG.extractColors).toBe(true)
      expect(DEFAULT_MOCKUP_CONFIG.detectTypography).toBe(true)
    })
  })

  describe("analyzeMockupDescription", () => {
    it("should detect UI elements from description", () => {
      const analysis = analyzeMockupDescription("A card with a button and input field")

      expect(analysis.elements.length).toBeGreaterThan(0)
      expect(analysis.elements.map(e => e.type)).toContain("card")
      expect(analysis.elements.map(e => e.type)).toContain("button")
      expect(analysis.elements.map(e => e.type)).toContain("input")
    })

    it("should extract colors from description", () => {
      const analysis = analyzeMockupDescription("A blue primary button on white background")

      expect(analysis.colors.length).toBeGreaterThan(0)
      expect(analysis.colors.some(c => c.semantic === "primary")).toBe(true)
      expect(analysis.colors.some(c => c.semantic === "background")).toBe(true)
    })

    it("should detect layout type", () => {
      const dashboardAnalysis = analyzeMockupDescription("A dashboard with sidebar navigation")
      expect(dashboardAnalysis.layout.type).toBe("dashboard")

      const singleColumnAnalysis = analyzeMockupDescription("A simple form with inputs")
      expect(singleColumnAnalysis.layout.type).toBe("single-column")
    })

    it("should generate component suggestions", () => {
      const analysis = analyzeMockupDescription("A modal dialog with form inputs and buttons")

      expect(analysis.componentSuggestions).toContain("Modal")
      expect(analysis.componentSuggestions).toContain("Form")
      expect(analysis.componentSuggestions).toContain("Button")
    })

    it("should include typography info when enabled", () => {
      const analysis = analyzeMockupDescription("A heading with text", { detectTypography: true })

      expect(analysis.typography.headingFont).toBeDefined()
      expect(analysis.typography.sizes.length).toBeGreaterThan(0)
    })

    it("should have confidence score", () => {
      const analysis = analyzeMockupDescription("A button")

      expect(analysis.confidence).toBeGreaterThan(0)
      expect(analysis.confidence).toBeLessThanOrEqual(1)
    })
  })

  describe("generateCodeFromAnalysis", () => {
    it("should generate React component code", () => {
      const analysis = analyzeMockupDescription("A card with a button")
      const code = generateCodeFromAnalysis(analysis)

      expect(code).toContain("import * as React")
      expect(code).toContain("export function GeneratedComponent")
      expect(code).toContain("return")
    })

    it("should include detected elements", () => {
      const analysis = analyzeMockupDescription("A form with input and submit button")
      const code = generateCodeFromAnalysis(analysis)

      expect(code).toContain("<button")
      expect(code).toContain("<input")
    })

    it("should use Tailwind classes", () => {
      const analysis = analyzeMockupDescription("A card")
      const code = generateCodeFromAnalysis(analysis)

      expect(code).toMatch(/className="[^"]*p-\d/)
    })
  })
})

// =============================================================================
// Design Critique System Tests (#70)
// =============================================================================

describe("Design Critique System", () => {
  describe("DEFAULT_CRITIQUE_CONFIG", () => {
    it("should have all categories", () => {
      expect(DEFAULT_CRITIQUE_CONFIG.categories).toContain("layout")
      expect(DEFAULT_CRITIQUE_CONFIG.categories).toContain("accessibility")
      expect(DEFAULT_CRITIQUE_CONFIG.categories).toContain("color")
    })
  })

  describe("generateDesignCritique", () => {
    it("should generate critique with score", () => {
      const critique = generateDesignCritique(SAMPLE_COMPONENT)

      expect(critique.score).toBeGreaterThanOrEqual(0)
      expect(critique.score).toBeLessThanOrEqual(10)
    })

    it("should categorize issues by severity", () => {
      const critique = generateDesignCritique(BAD_COMPONENT)

      expect(critique.critical).toBeDefined()
      expect(critique.major).toBeDefined()
      expect(critique.minor).toBeDefined()
      expect(critique.suggestions).toBeDefined()
    })

    it("should detect hardcoded colors", () => {
      const critique = generateDesignCritique(BAD_COMPONENT)

      expect(critique.items.some(i => i.category === "color")).toBe(true)
    })

    it("should detect accessibility issues", () => {
      const critique = generateDesignCritique(BAD_COMPONENT)

      // Icon-only button without aria-label
      expect(critique.items.some(i => i.category === "accessibility")).toBe(true)
    })

    it("should provide suggestions for issues", () => {
      const critique = generateDesignCritique(BAD_COMPONENT)

      for (const item of critique.items) {
        expect(item.suggestion).toBeDefined()
        expect(item.suggestion.length).toBeGreaterThan(0)
      }
    })

    it("should generate summary", () => {
      const critique = generateDesignCritique(SAMPLE_COMPONENT)

      expect(critique.summary).toBeDefined()
      expect(critique.summary.length).toBeGreaterThan(0)
    })

    it("should provide top improvements", () => {
      const critique = generateDesignCritique(BAD_COMPONENT)

      expect(critique.topImprovements.length).toBeLessThanOrEqual(3)
    })

    it("should filter by category", () => {
      const critique = generateDesignCritique(BAD_COMPONENT, {
        categories: ["color"],
      })

      expect(critique.items.every(i => i.category === "color")).toBe(true)
    })
  })
})

// =============================================================================
// Component Similarity Search Tests (#71)
// =============================================================================

describe("Component Similarity Search", () => {
  describe("SHADCN_LIBRARY", () => {
    it("should have common components", () => {
      const names = SHADCN_LIBRARY.components.map(c => c.name)

      expect(names).toContain("Button")
      expect(names).toContain("Input")
      expect(names).toContain("Card")
      expect(names).toContain("Dialog")
    })

    it("should have component signatures", () => {
      const button = SHADCN_LIBRARY.components.find(c => c.name === "Button")

      expect(button?.props).toContain("variant")
      expect(button?.hasVariants).toBe(true)
      expect(button?.usesForwardRef).toBe(true)
    })
  })

  describe("extractComponentSignature", () => {
    it("should extract component name", () => {
      const sig = extractComponentSignature(SAMPLE_COMPONENT)

      expect(sig.name).toBe("Button")
    })

    it("should extract props", () => {
      const sig = extractComponentSignature(SAMPLE_COMPONENT)

      expect(sig.props).toContain("variant")
    })

    it("should detect forwardRef usage", () => {
      const sig = extractComponentSignature(SAMPLE_COMPONENT)

      expect(sig.usesForwardRef).toBe(true)
    })

    it("should detect variants", () => {
      const sig = extractComponentSignature(SAMPLE_COMPONENT)

      expect(sig.hasVariants).toBe(true)
    })

    it("should detect accessibility features", () => {
      const sig = extractComponentSignature(SAMPLE_COMPONENT)

      expect(sig.hasA11y).toBe(true)
    })

    it("should estimate complexity", () => {
      const sig = extractComponentSignature(SAMPLE_COMPONENT)

      expect(sig.complexity).toBeGreaterThanOrEqual(1)
      expect(sig.complexity).toBeLessThanOrEqual(10)
    })
  })

  describe("searchSimilarComponents", () => {
    it("should find similar components", () => {
      const result = searchSimilarComponents(SAMPLE_COMPONENT)

      expect(result.matches.length).toBeGreaterThan(0)
      expect(result.bestMatch).toBeDefined()
    })

    it("should return match scores", () => {
      const result = searchSimilarComponents(SAMPLE_COMPONENT)

      for (const match of result.matches) {
        expect(match.score).toBeGreaterThan(0)
        expect(match.score).toBeLessThanOrEqual(1)
      }
    })

    it("should provide match reasons", () => {
      const result = searchSimilarComponents(SAMPLE_COMPONENT)

      expect(result.bestMatch?.matchReasons.length).toBeGreaterThan(0)
    })

    it("should suggest adaptations", () => {
      const result = searchSimilarComponents(SAMPLE_COMPONENT)

      expect(result.bestMatch?.adaptations).toBeDefined()
    })

    it("should match Button component highly", () => {
      const result = searchSimilarComponents(SAMPLE_COMPONENT)

      expect(result.bestMatch?.name).toBe("Button")
      expect(result.bestMatch?.score).toBeGreaterThan(0.5)
    })
  })
})

// =============================================================================
// AutoFix Post-Processor Tests (#72)
// =============================================================================

describe("AutoFix Post-Processor", () => {
  describe("DEFAULT_AUTOFIX_CONFIG", () => {
    it("should have default rules", () => {
      expect(DEFAULT_AUTOFIX_CONFIG.rules).toContain("add-display-name")
      expect(DEFAULT_AUTOFIX_CONFIG.rules).toContain("fix-any-types")
    })
  })

  describe("applyAutoFix", () => {
    it("should fix any types", () => {
      const code = "const fn = (x: any) => x"
      const result = applyAutoFix(code, { rules: ["fix-any-types"] })

      expect(result.fixed).toContain("unknown")
      expect(result.appliedFixes.length).toBeGreaterThan(0)
    })

    it("should add displayName", () => {
      const code = `const Button = React.forwardRef((props, ref) => <button ref={ref} />)`
      const result = applyAutoFix(code, { rules: ["add-display-name"] })

      expect(result.fixed).toContain('displayName = "Button"')
    })

    it("should not modify code in dry run", () => {
      const code = "const fn = (x: any) => x"
      const result = applyAutoFix(code, { rules: ["fix-any-types"], dryRun: true })

      expect(result.fixed).toBe(code)
      expect(result.appliedFixes.length).toBeGreaterThan(0)
    })

    it("should skip specified rules", () => {
      const code = "const fn = (x: any) => x"
      const result = applyAutoFix(code, {
        rules: ["fix-any-types"],
        skipRules: ["fix-any-types"],
      })

      expect(result.fixed).toBe(code)
      expect(result.skippedFixes.length).toBeGreaterThan(0)
    })

    it("should report change count", () => {
      const code = "const fn = (x: any, y: any) => x + y"
      const result = applyAutoFix(code, { rules: ["fix-any-types"] })

      expect(result.changeCount).toBeGreaterThan(0)
    })

    it("should add React import if missing", () => {
      const code = "const Component = React.forwardRef(() => null)"
      const result = applyAutoFix(code, { rules: ["fix-imports"] })

      expect(result.fixed).toContain('import * as React from "react"')
    })
  })
})

// =============================================================================
// Context Window Management Tests (#73)
// =============================================================================

describe("Context Window Management", () => {
  describe("DEFAULT_CONTEXT_CONFIG", () => {
    it("should have default values", () => {
      expect(DEFAULT_CONTEXT_CONFIG.maxTokens).toBe(100000)
      expect(DEFAULT_CONTEXT_CONFIG.reservedTokens).toBe(20000)
    })

    it("should have type weights", () => {
      expect(DEFAULT_CONTEXT_CONFIG.typeWeights?.component).toBe(1.0)
      expect(DEFAULT_CONTEXT_CONFIG.typeWeights?.documentation).toBe(0.3)
    })
  })

  describe("estimateTokens", () => {
    it("should estimate token count", () => {
      const text = "Hello world" // 11 chars
      const tokens = estimateTokens(text)

      expect(tokens).toBeGreaterThan(0)
      expect(tokens).toBeLessThan(text.length)
    })

    it("should scale with text length", () => {
      const short = estimateTokens("Hi")
      const long = estimateTokens("This is a much longer piece of text")

      expect(long).toBeGreaterThan(short)
    })
  })

  describe("createContextItem", () => {
    it("should create context item", () => {
      const item = createContextItem("/path/file.ts", "const x = 1", "component", 0.8)

      expect(item.id).toBe("/path/file.ts")
      expect(item.type).toBe("component")
      expect(item.content).toBe("const x = 1")
      expect(item.priority).toBe(0.8)
      expect(item.tokens).toBeGreaterThan(0)
    })
  })

  describe("createContextWindow", () => {
    it("should create empty context window", () => {
      const window = createContextWindow()

      expect(window.maxTokens).toBe(100000)
      expect(window.usedTokens).toBe(0)
      expect(window.items).toHaveLength(0)
    })

    it("should calculate available tokens", () => {
      const window = createContextWindow({ maxTokens: 100000, reservedTokens: 20000 })

      expect(window.availableTokens).toBe(80000)
    })
  })

  describe("addToContext", () => {
    it("should add item to context", () => {
      const window = createContextWindow()
      const item = createContextItem("/file.ts", "code", "component")

      const updated = addToContext(window, item)

      expect(updated.items).toContain(item)
      expect(updated.usedTokens).toBeGreaterThan(0)
    })

    it("should update utilization", () => {
      const window = createContextWindow()
      const item = createContextItem("/file.ts", "x".repeat(1000), "component")

      const updated = addToContext(window, item)

      expect(updated.utilization).toBeGreaterThan(0)
    })
  })

  describe("optimizeContext", () => {
    it("should remove low-priority items", () => {
      const config = { maxTokens: 5000, reservedTokens: 0 }
      let window = createContextWindow(config)

      // Each item is 2000 chars = 500 tokens, target is 600, so only one fits
      const highPriority = createContextItem("/high.ts", "x".repeat(2000), "component", 1.0)
      const lowPriority = createContextItem("/low.ts", "x".repeat(2000), "documentation", 0.1)

      window = addToContext(window, highPriority, config)
      window = addToContext(window, lowPriority, config)

      const result = optimizeContext(window, 600, config)

      expect(result.optimized).toContain(highPriority)
      expect(result.removed).toContain(lowPriority)
    })

    it("should report tokens saved", () => {
      const config = { maxTokens: 5000, reservedTokens: 0 }
      let window = createContextWindow(config)
      // Each item is 2000 chars = 500 tokens, total 1000 tokens, target 600
      window = addToContext(window, createContextItem("/a.ts", "x".repeat(2000), "component"), config)
      window = addToContext(window, createContextItem("/b.ts", "x".repeat(2000), "documentation"), config)

      const result = optimizeContext(window, 600, config)

      expect(result.tokensSaved).toBeGreaterThan(0)
    })
  })

  describe("compressContent", () => {
    it("should remove comments", () => {
      const code = "const x = 1 // comment\n/* block */\nconst y = 2"
      const compressed = compressContent(code)

      expect(compressed).not.toContain("comment")
      expect(compressed).not.toContain("block")
    })

    it("should remove empty lines", () => {
      const code = "const x = 1\n\n\nconst y = 2"
      const compressed = compressContent(code)

      expect(compressed).not.toMatch(/\n{2,}/)
    })
  })
})

// =============================================================================
// Factory Tests
// =============================================================================

describe("createAIFeaturesSystem", () => {
  it("should create system with all methods", () => {
    const ai = createAIFeaturesSystem()

    expect(ai.analyzeMockup).toBeDefined()
    expect(ai.generateFromAnalysis).toBeDefined()
    expect(ai.critique).toBeDefined()
    expect(ai.extractSignature).toBeDefined()
    expect(ai.searchSimilar).toBeDefined()
    expect(ai.autofix).toBeDefined()
    expect(ai.createContext).toBeDefined()
  })

  it("should expose shadcn library", () => {
    const ai = createAIFeaturesSystem()

    expect(ai.shadcnLibrary).toBe(SHADCN_LIBRARY)
  })

  it("should integrate all features", () => {
    const ai = createAIFeaturesSystem()

    // Analyze mockup
    const analysis = ai.analyzeMockup("A button component")
    expect(analysis.elements.length).toBeGreaterThan(0)

    // Generate code
    const code = ai.generateFromAnalysis(analysis)
    expect(code).toContain("button")

    // Critique
    const critique = ai.critique(SAMPLE_COMPONENT)
    expect(critique.score).toBeGreaterThan(0)

    // Find similar
    const similar = ai.searchSimilar(SAMPLE_COMPONENT)
    expect(similar.matches.length).toBeGreaterThan(0)

    // AutoFix
    const fixed = ai.autofix(BAD_COMPONENT)
    expect(fixed.changeCount).toBeGreaterThanOrEqual(0)
  })
})
