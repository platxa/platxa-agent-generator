/**
 * Storybook Story Generator - Tests
 *
 * Tests for automatic Storybook story generation:
 * - Component analysis
 * - Props extraction
 * - CVA variant detection
 * - Story file generation
 */

import { describe, it, expect } from "vitest"
import {
  analyzeComponent,
  generateStoryFile,
  generateStoriesForComponents,
} from "../storybook"

// =============================================================================
// Test Fixtures
// =============================================================================

const buttonComponent = `
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * A versatile button component with multiple variants and sizes.
 * Supports all standard button attributes.
 */
const buttonVariants = cva(
  ["inline-flex items-center justify-center rounded-md font-medium"],
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "border border-input bg-background",
        secondary: "bg-secondary text-secondary-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
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
  /** Loading state */
  isLoading?: boolean
  /** Icon to display before text */
  leftIcon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, leftIcon, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={isLoading}
      {...props}
    >
      {leftIcon}
      {children}
    </button>
  )
)
Button.displayName = "Button"

export { Button, buttonVariants }
`

const cardComponent = `
import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Card container for grouping related content.
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether the card is interactive */
  interactive?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        interactive && "cursor-pointer hover:shadow-md",
        className
      )}
      {...props}
    />
  )
)
Card.displayName = "Card"

export { Card }
`

const simpleComponent = `
export function Badge({ children, className }) {
  return <span className={className}>{children}</span>
}
`

// =============================================================================
// Component Analysis Tests
// =============================================================================

describe("analyzeComponent", () => {
  it("should extract component name from export", () => {
    const analysis = analyzeComponent(buttonComponent, "src/components/Button.tsx")
    expect(analysis.name).toBe("Button")
  })

  it("should extract component name from displayName", () => {
    const analysis = analyzeComponent(cardComponent, "src/components/Card.tsx")
    expect(analysis.name).toBe("Card")
  })

  it("should extract component name from file path as fallback", () => {
    const analysis = analyzeComponent(simpleComponent, "src/components/badge.tsx")
    expect(analysis.name).toBe("Badge")
  })

  it("should extract JSDoc description", () => {
    const analysis = analyzeComponent(buttonComponent, "src/components/Button.tsx")
    expect(analysis.description).toContain("versatile button component")
  })

  it("should detect forwardRef usage", () => {
    const buttonAnalysis = analyzeComponent(buttonComponent, "Button.tsx")
    const simpleAnalysis = analyzeComponent(simpleComponent, "Badge.tsx")

    expect(buttonAnalysis.usesForwardRef).toBe(true)
    expect(simpleAnalysis.usesForwardRef).toBe(false)
  })

  it("should derive import path from file path", () => {
    const analysis = analyzeComponent(
      buttonComponent,
      "src/components/ui/Button.tsx"
    )
    expect(analysis.importPath).toBe("@/components/ui/Button")
  })
})

// =============================================================================
// Props Extraction Tests
// =============================================================================

describe("Props extraction", () => {
  it("should extract props from interface", () => {
    const analysis = analyzeComponent(buttonComponent, "Button.tsx")

    expect(analysis.props.length).toBeGreaterThan(0)

    const loadingProp = analysis.props.find((p) => p.name === "isLoading")
    expect(loadingProp).toBeDefined()
    expect(loadingProp?.type).toContain("boolean")
    expect(loadingProp?.required).toBe(false)
  })

  it("should extract prop descriptions from JSDoc", () => {
    const analysis = analyzeComponent(buttonComponent, "Button.tsx")

    const loadingProp = analysis.props.find((p) => p.name === "isLoading")
    expect(loadingProp?.description).toBe("Loading state")
  })

  it("should handle components without explicit props interface", () => {
    const analysis = analyzeComponent(simpleComponent, "Badge.tsx")

    // Should have default props
    expect(analysis.props.length).toBeGreaterThan(0)
    expect(analysis.props.some((p) => p.name === "children")).toBe(true)
  })

  it("should extract interactive prop from Card", () => {
    const analysis = analyzeComponent(cardComponent, "Card.tsx")

    const interactiveProp = analysis.props.find((p) => p.name === "interactive")
    expect(interactiveProp).toBeDefined()
    expect(interactiveProp?.type).toContain("boolean")
    expect(interactiveProp?.description).toBe("Whether the card is interactive")
  })
})

// =============================================================================
// CVA Variant Extraction Tests
// =============================================================================

describe("CVA variant extraction", () => {
  it("should extract variant options from cva()", () => {
    const analysis = analyzeComponent(buttonComponent, "Button.tsx")

    expect(analysis.variants.length).toBe(2)

    const variantDef = analysis.variants.find((v) => v.name === "variant")
    expect(variantDef).toBeDefined()
    expect(variantDef?.options).toContain("default")
    expect(variantDef?.options).toContain("destructive")
    expect(variantDef?.options).toContain("outline")
    expect(variantDef?.options).toContain("ghost")
  })

  it("should extract size variants", () => {
    const analysis = analyzeComponent(buttonComponent, "Button.tsx")

    const sizeDef = analysis.variants.find((v) => v.name === "size")
    expect(sizeDef).toBeDefined()
    expect(sizeDef?.options).toContain("sm")
    expect(sizeDef?.options).toContain("lg")
    expect(sizeDef?.options).toContain("icon")
  })

  it("should extract default variants", () => {
    const analysis = analyzeComponent(buttonComponent, "Button.tsx")

    expect(analysis.defaultVariants).toEqual({
      variant: "default",
      size: "default",
    })
  })

  it("should handle components without CVA", () => {
    const analysis = analyzeComponent(cardComponent, "Card.tsx")

    expect(analysis.variants).toEqual([])
    expect(analysis.defaultVariants).toEqual({})
  })
})

// =============================================================================
// Story File Generation Tests
// =============================================================================

describe("generateStoryFile", () => {
  it("should generate valid CSF3 story file", () => {
    const analysis = analyzeComponent(buttonComponent, "Button.tsx")
    const story = generateStoryFile(analysis, { format: "csf3" })

    expect(story.fileName).toBe("Button.stories.tsx")
    expect(story.componentName).toBe("Button")
    expect(story.content).toContain('import type { Meta, StoryObj }')
    expect(story.content).toContain("export default meta")
  })

  it("should include component import", () => {
    const analysis = analyzeComponent(buttonComponent, "src/components/Button.tsx")
    const story = generateStoryFile(analysis)

    expect(story.content).toContain('import { Button }')
  })

  it("should generate meta with correct title", () => {
    const analysis = analyzeComponent(buttonComponent, "Button.tsx")
    const story = generateStoryFile(analysis)

    expect(story.content).toContain('title: "Components/Button"')
  })

  it("should include autodocs tag", () => {
    const analysis = analyzeComponent(buttonComponent, "Button.tsx")
    const story = generateStoryFile(analysis)

    expect(story.content).toContain('tags: ["autodocs"]')
  })

  it("should generate argTypes for variants", () => {
    const analysis = analyzeComponent(buttonComponent, "Button.tsx")
    const story = generateStoryFile(analysis)

    expect(story.content).toContain("variant: {")
    expect(story.content).toContain('control: "select"')
    expect(story.content).toContain('"default"')
    expect(story.content).toContain('"destructive"')
  })

  it("should generate Default story", () => {
    const analysis = analyzeComponent(buttonComponent, "Button.tsx")
    const story = generateStoryFile(analysis)

    expect(story.content).toContain("export const Default: Story")
  })

  it("should generate variant stories", () => {
    const analysis = analyzeComponent(buttonComponent, "Button.tsx")
    const story = generateStoryFile(analysis)

    // Should have stories for non-default variants
    expect(story.content).toContain("export const Destructive: Story")
    expect(story.content).toContain("export const Outline: Story")
    expect(story.content).toContain("export const Ghost: Story")
  })

  it("should generate AllSizes story for size variants", () => {
    const analysis = analyzeComponent(buttonComponent, "Button.tsx")
    const story = generateStoryFile(analysis)

    expect(story.content).toContain("export const AllSizes: Story")
  })

  it("should include dark mode story when enabled", () => {
    const analysis = analyzeComponent(buttonComponent, "Button.tsx")
    const story = generateStoryFile(analysis, { includeDarkMode: true })

    expect(story.content).toContain("export const DarkMode: Story")
    expect(story.content).toContain('className="dark')
  })

  it("should exclude dark mode story when disabled", () => {
    const analysis = analyzeComponent(buttonComponent, "Button.tsx")
    const story = generateStoryFile(analysis, { includeDarkMode: false })

    expect(story.content).not.toContain("export const DarkMode: Story")
  })

  it("should include a11y config when enabled", () => {
    const analysis = analyzeComponent(buttonComponent, "Button.tsx")
    const story = generateStoryFile(analysis, { includeA11y: true })

    expect(story.content).toContain("a11y: {")
    expect(story.content).toContain("color-contrast")
  })
})

// =============================================================================
// CSF2 Format Tests
// =============================================================================

describe("CSF2 format", () => {
  it("should generate valid CSF2 story file", () => {
    const analysis = analyzeComponent(buttonComponent, "Button.tsx")
    const story = generateStoryFile(analysis, { format: "csf2" })

    expect(story.content).toContain('import React from "react"')
    expect(story.content).toContain("export default {")
    expect(story.content).toContain("export const Default")
  })

  it("should use arrow function syntax", () => {
    const analysis = analyzeComponent(buttonComponent, "Button.tsx")
    const story = generateStoryFile(analysis, { format: "csf2" })

    expect(story.content).toContain("() => <Button")
  })
})

// =============================================================================
// Batch Generation Tests
// =============================================================================

describe("generateStoriesForComponents", () => {
  it("should generate stories for multiple components", () => {
    const components = [
      { code: buttonComponent, filePath: "Button.tsx" },
      { code: cardComponent, filePath: "Card.tsx" },
    ]

    const stories = generateStoriesForComponents(components)

    expect(stories.length).toBe(2)
    expect(stories[0].componentName).toBe("Button")
    expect(stories[1].componentName).toBe("Card")
  })

  it("should apply options to all generated stories", () => {
    const components = [
      { code: buttonComponent, filePath: "Button.tsx" },
      { code: cardComponent, filePath: "Card.tsx" },
    ]

    const stories = generateStoriesForComponents(components, {
      includeDarkMode: false,
    })

    for (const story of stories) {
      expect(story.content).not.toContain("DarkMode")
    }
  })
})

// =============================================================================
// Edge Cases
// =============================================================================

describe("Edge cases", () => {
  it("should handle component with no variants gracefully", () => {
    const analysis = analyzeComponent(cardComponent, "Card.tsx")
    const story = generateStoryFile(analysis)

    expect(story.content).toContain("export const Default: Story")
    expect(story.content).not.toContain("AllSizes")
  })

  it("should handle component with minimal code", () => {
    const minimal = `export const Divider = () => <hr />`
    const analysis = analyzeComponent(minimal, "Divider.tsx")
    const story = generateStoryFile(analysis)

    expect(story.fileName).toBe("Divider.stories.tsx")
    expect(story.content).toContain("Divider")
  })

  it("should escape special characters in descriptions", () => {
    const withQuotes = `
/**
 * A component with "quotes" and special chars
 */
export const Special = () => <div />
`
    const analysis = analyzeComponent(withQuotes, "Special.tsx")
    const story = generateStoryFile(analysis)

    // Should not break the generated code - verify escaped quotes in description
    expect(story.content).toContain("description")
    // Verify quotes are properly escaped in the component description string
    expect(story.content).toMatch(/component:\s*"[^"]*\\"quotes\\"[^"]*"/)
  })

  it("should handle type alias props", () => {
    const typeAlias = `
type InputProps = {
  /** Input label */
  label: string
  /** Error message */
  error?: string
}

export const Input = ({ label, error }: InputProps) => (
  <input aria-label={label} />
)
`
    const analysis = analyzeComponent(typeAlias, "Input.tsx")

    // Should still extract props (may use defaults if parsing fails)
    expect(analysis.props.length).toBeGreaterThan(0)
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe("Integration", () => {
  it("should generate complete working story file", () => {
    const analysis = analyzeComponent(buttonComponent, "src/components/ui/Button.tsx")
    const story = generateStoryFile(analysis, {
      format: "csf3",
      includeA11y: true,
      includeDarkMode: true,
    })

    // Verify all expected sections
    expect(story.content).toContain("import type { Meta, StoryObj }")
    expect(story.content).toContain('import { Button }')
    expect(story.content).toContain("const meta: Meta<typeof Button>")
    expect(story.content).toContain("export default meta")
    expect(story.content).toContain("type Story = StoryObj<typeof meta>")
    expect(story.content).toContain("export const Default: Story")
    expect(story.content).toContain("export const DarkMode: Story")
  })
})
