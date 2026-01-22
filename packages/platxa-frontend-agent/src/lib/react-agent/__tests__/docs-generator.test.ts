/**
 * Component Documentation Generator - Tests
 *
 * Tests for automatic documentation generation:
 * - Component parsing
 * - Props extraction
 * - Markdown generation
 * - Batch processing
 */

import { describe, it, expect } from "vitest"
import {
  parseComponent,
  generateDocs,
  generateDocsForComponents,
  generateDocsIndex,
} from "../docs"

// =============================================================================
// Test Fixtures
// =============================================================================

const buttonComponent = `
/**
 * A versatile button component with multiple variants and sizes.
 *
 * Supports all standard button attributes and custom styling.
 *
 * @example
 * \`\`\`tsx
 * <Button variant="primary">Click me</Button>
 * \`\`\`
 *
 * @since 1.0.0
 * @see ButtonGroup
 * @accessibility Supports keyboard navigation
 */
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  ["inline-flex items-center justify-center font-medium"],
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "border border-input bg-background",
        ghost: "hover:bg-accent",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-10 px-4",
        lg: "h-11 px-8 text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Whether the button is in a loading state */
  isLoading?: boolean
  /** Icon to display before the button text */
  leftIcon?: React.ReactNode
  /** @default false */
  disabled?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, leftIcon, ...props }, ref) => (
    <button
      ref={ref}
      className={buttonVariants({ variant, size, className })}
      aria-busy={isLoading}
      {...props}
    />
  )
)
Button.displayName = "Button"

export { Button, buttonVariants }
`

const cardComponent = `
/**
 * Card container for grouping related content.
 */
import * as React from "react"

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Card visual style */
  variant?: "default" | "bordered" | "elevated"
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "default", ...props }, ref) => (
    <div ref={ref} role="region" {...props} />
  )
)
Card.displayName = "Card"

export { Card }
`

const deprecatedComponent = `
/**
 * Old button component.
 *
 * @deprecated Use Button instead
 */
export const OldButton = () => <button />
`

// =============================================================================
// Parser Tests
// =============================================================================

describe("parseComponent", () => {
  it("should extract component name from displayName", () => {
    const info = parseComponent(buttonComponent, "Button.tsx")
    expect(info.name).toBe("Button")
  })

  it("should extract component name from export", () => {
    const info = parseComponent(cardComponent, "Card.tsx")
    expect(info.name).toBe("Card")
  })

  it("should extract description from JSDoc", () => {
    const info = parseComponent(buttonComponent, "Button.tsx")
    expect(info.description).toContain("versatile button component")
  })

  it("should extract @since version", () => {
    const info = parseComponent(buttonComponent, "Button.tsx")
    expect(info.since).toBe("1.0.0")
  })

  it("should extract @deprecated notice", () => {
    const info = parseComponent(deprecatedComponent, "OldButton.tsx")
    expect(info.deprecated).toContain("Use Button instead")
  })

  it("should extract @see references", () => {
    const info = parseComponent(buttonComponent, "Button.tsx")
    expect(info.see).toContain("ButtonGroup")
  })

  it("should extract accessibility notes", () => {
    const info = parseComponent(buttonComponent, "Button.tsx")
    expect(info.accessibility).toContain("Supports keyboard navigation")
  })

  it("should detect ARIA usage", () => {
    const info = parseComponent(buttonComponent, "Button.tsx")
    expect(info.accessibility.some((n) => n.includes("ARIA"))).toBe(true)
  })

  it("should store file path", () => {
    const info = parseComponent(buttonComponent, "src/components/Button.tsx")
    expect(info.filePath).toBe("src/components/Button.tsx")
  })
})

// =============================================================================
// Props Extraction Tests
// =============================================================================

describe("Props extraction", () => {
  it("should extract props from interface", () => {
    const info = parseComponent(buttonComponent, "Button.tsx")

    const loadingProp = info.props.find((p) => p.name === "isLoading")
    expect(loadingProp).toBeDefined()
    expect(loadingProp?.type).toContain("boolean")
    expect(loadingProp?.required).toBe(false)
  })

  it("should extract prop descriptions", () => {
    const info = parseComponent(buttonComponent, "Button.tsx")

    const loadingProp = info.props.find((p) => p.name === "isLoading")
    expect(loadingProp?.description).toBe("Whether the button is in a loading state")
  })

  it("should extract @default values", () => {
    const info = parseComponent(buttonComponent, "Button.tsx")

    const disabledProp = info.props.find((p) => p.name === "disabled")
    expect(disabledProp?.defaultValue).toBe("false")
  })

  it("should extract enum values from union types", () => {
    const info = parseComponent(cardComponent, "Card.tsx")

    const variantProp = info.props.find((p) => p.name === "variant")
    expect(variantProp?.enumValues).toContain("default")
    expect(variantProp?.enumValues).toContain("bordered")
    expect(variantProp?.enumValues).toContain("elevated")
  })

  it("should skip inherited props like className", () => {
    const info = parseComponent(buttonComponent, "Button.tsx")

    const classNameProp = info.props.find((p) => p.name === "className")
    expect(classNameProp).toBeUndefined()
  })
})

// =============================================================================
// Variants Extraction Tests
// =============================================================================

describe("Variants extraction", () => {
  it("should extract CVA variants", () => {
    const info = parseComponent(buttonComponent, "Button.tsx")

    expect(info.variants.length).toBe(2)

    const variantDef = info.variants.find((v) => v.name === "variant")
    expect(variantDef).toBeDefined()
    expect(variantDef?.options.map((o) => o.name)).toContain("default")
    expect(variantDef?.options.map((o) => o.name)).toContain("destructive")
  })

  it("should extract size variants", () => {
    const info = parseComponent(buttonComponent, "Button.tsx")

    const sizeDef = info.variants.find((v) => v.name === "size")
    expect(sizeDef).toBeDefined()
    expect(sizeDef?.options.map((o) => o.name)).toContain("sm")
    expect(sizeDef?.options.map((o) => o.name)).toContain("md")
    expect(sizeDef?.options.map((o) => o.name)).toContain("lg")
  })

  it("should extract default variants", () => {
    const info = parseComponent(buttonComponent, "Button.tsx")

    expect(info.defaultVariants).toEqual({
      variant: "default",
      size: "md",
    })
  })

  it("should include variant CSS classes", () => {
    const info = parseComponent(buttonComponent, "Button.tsx")

    const variantDef = info.variants.find((v) => v.name === "variant")
    const defaultOption = variantDef?.options.find((o) => o.name === "default")
    expect(defaultOption?.description).toContain("bg-primary")
  })
})

// =============================================================================
// Examples Extraction Tests
// =============================================================================

describe("Examples extraction", () => {
  it("should extract @example code blocks", () => {
    const info = parseComponent(buttonComponent, "Button.tsx")

    expect(info.examples.length).toBeGreaterThan(0)
    expect(info.examples[0].code).toContain("<Button")
    expect(info.examples[0].language).toBe("tsx")
  })
})

// =============================================================================
// Markdown Generation Tests
// =============================================================================

describe("generateDocs", () => {
  it("should generate markdown with component name as title", () => {
    const docs = generateDocs(buttonComponent, "Button.tsx")

    expect(docs.markdown).toContain("# Button")
  })

  it("should include description", () => {
    const docs = generateDocs(buttonComponent, "Button.tsx")

    expect(docs.markdown).toContain("versatile button component")
  })

  it("should include import statement", () => {
    const docs = generateDocs(buttonComponent, "Button.tsx")

    expect(docs.markdown).toContain("## Import")
    expect(docs.markdown).toContain('import { Button }')
  })

  it("should generate props table", () => {
    const docs = generateDocs(buttonComponent, "Button.tsx")

    expect(docs.markdown).toContain("## Props")
    expect(docs.markdown).toContain("| Prop | Type |")
    expect(docs.markdown).toContain("`isLoading`")
  })

  it("should generate variants section", () => {
    const docs = generateDocs(buttonComponent, "Button.tsx")

    expect(docs.markdown).toContain("## Variants")
    expect(docs.markdown).toContain("### Variant")
    expect(docs.markdown).toContain("*(default)*")
  })

  it("should include deprecation warning", () => {
    const docs = generateDocs(deprecatedComponent, "OldButton.tsx")

    expect(docs.markdown).toContain("⚠️ **Deprecated:**")
    expect(docs.markdown).toContain("Use Button instead")
  })

  it("should include since badge", () => {
    const docs = generateDocs(buttonComponent, "Button.tsx")

    expect(docs.markdown).toContain("since-1.0.0")
  })

  it("should include examples section", () => {
    const docs = generateDocs(buttonComponent, "Button.tsx", {
      includeExamples: true,
    })

    expect(docs.markdown).toContain("## Examples")
    expect(docs.markdown).toContain("```tsx")
  })

  it("should include accessibility section", () => {
    const docs = generateDocs(buttonComponent, "Button.tsx", {
      includeAccessibility: true,
    })

    expect(docs.markdown).toContain("## Accessibility")
  })

  it("should include see also section", () => {
    const docs = generateDocs(buttonComponent, "Button.tsx")

    expect(docs.markdown).toContain("## See Also")
    expect(docs.markdown).toContain("ButtonGroup")
  })

  it("should respect includeDefaults option", () => {
    const withDefaults = generateDocs(buttonComponent, "Button.tsx", {
      includeDefaults: true,
    })
    const withoutDefaults = generateDocs(buttonComponent, "Button.tsx", {
      includeDefaults: false,
    })

    expect(withDefaults.markdown).toContain("Default |")
    expect(withoutDefaults.markdown).not.toContain("Default |")
  })

  it("should add source link when configured", () => {
    const docs = generateDocs(buttonComponent, "Button.tsx", {
      includeSourceLink: true,
      sourceBaseUrl: "https://github.com/org/repo/blob/main",
    })

    expect(docs.markdown).toContain("[View Source]")
    expect(docs.markdown).toContain("https://github.com")
  })

  it("should add custom sections", () => {
    const docs = generateDocs(buttonComponent, "Button.tsx", {
      customSections: [
        { title: "Migration Guide", content: "Steps to migrate..." },
      ],
    })

    expect(docs.markdown).toContain("## Migration Guide")
    expect(docs.markdown).toContain("Steps to migrate")
  })
})

// =============================================================================
// Metadata Generation Tests
// =============================================================================

describe("Metadata generation", () => {
  it("should generate JSON metadata", () => {
    const docs = generateDocs(buttonComponent, "Button.tsx")

    expect(docs.metadata.name).toBe("Button")
    expect(docs.metadata.since).toBe("1.0.0")
    expect(Array.isArray(docs.metadata.props)).toBe(true)
    expect(Array.isArray(docs.metadata.variants)).toBe(true)
  })

  it("should include prop metadata", () => {
    const docs = generateDocs(buttonComponent, "Button.tsx")
    const props = docs.metadata.props as Array<{ name: string }>

    expect(props.some((p) => p.name === "isLoading")).toBe(true)
  })

  it("should include variant metadata", () => {
    const docs = generateDocs(buttonComponent, "Button.tsx")
    const variants = docs.metadata.variants as Array<{ name: string; options: string[] }>

    const variantMeta = variants.find((v) => v.name === "variant")
    expect(variantMeta?.options).toContain("default")
    expect(variantMeta?.options).toContain("destructive")
  })
})

// =============================================================================
// Batch Generation Tests
// =============================================================================

describe("generateDocsForComponents", () => {
  it("should generate docs for multiple components", () => {
    const docs = generateDocsForComponents([
      { code: buttonComponent, filePath: "Button.tsx" },
      { code: cardComponent, filePath: "Card.tsx" },
    ])

    expect(docs.length).toBe(2)
    expect(docs[0].component.name).toBe("Button")
    expect(docs[1].component.name).toBe("Card")
  })

  it("should apply options to all components", () => {
    const docs = generateDocsForComponents(
      [
        { code: buttonComponent, filePath: "Button.tsx" },
        { code: cardComponent, filePath: "Card.tsx" },
      ],
      { includeDefaults: false }
    )

    for (const doc of docs) {
      expect(doc.markdown).not.toContain("Default |")
    }
  })
})

describe("generateDocsIndex", () => {
  it("should generate index with table of contents", () => {
    const docs = generateDocsForComponents([
      { code: buttonComponent, filePath: "ui/Button.tsx" },
      { code: cardComponent, filePath: "ui/Card.tsx" },
    ])

    const index = generateDocsIndex(docs, "My Components")

    expect(index).toContain("# My Components")
    expect(index).toContain("## Table of Contents")
    expect(index).toContain("[Button]")
    expect(index).toContain("[Card]")
  })

  it("should group components by category", () => {
    const docs = generateDocsForComponents([
      { code: buttonComponent, filePath: "buttons/Button.tsx" },
      { code: cardComponent, filePath: "layout/Card.tsx" },
    ])

    const index = generateDocsIndex(docs)

    expect(index).toContain("### Buttons")
    expect(index).toContain("### Layout")
  })

  it("should include component descriptions", () => {
    const docs = generateDocsForComponents([
      { code: buttonComponent, filePath: "Button.tsx" },
    ])

    const index = generateDocsIndex(docs)

    expect(index).toContain("versatile button component")
  })
})

// =============================================================================
// Edge Cases
// =============================================================================

describe("Edge cases", () => {
  it("should handle component without JSDoc", () => {
    const noJsdoc = `
export const Simple = () => <div />
`
    const info = parseComponent(noJsdoc, "Simple.tsx")

    expect(info.name).toBe("Simple")
    expect(info.description).toContain("Simple component")
  })

  it("should handle component without props interface", () => {
    const noProps = `
export const NoProps = () => <div />
`
    const info = parseComponent(noProps, "NoProps.tsx")

    expect(info.props).toEqual([])
  })

  it("should handle component without variants", () => {
    const info = parseComponent(cardComponent, "Card.tsx")

    expect(info.variants).toEqual([])
    expect(info.defaultVariants).toEqual({})
  })

  it("should escape markdown special characters in types", () => {
    const withPipe = `
export interface TestProps {
  /** Union type */
  value: "a" | "b" | "c"
}
export const Test = () => <div />
`
    const docs = generateDocs(withPipe, "Test.tsx")

    // Should escape pipe characters in table
    expect(docs.markdown).toContain("\\|")
  })
})
