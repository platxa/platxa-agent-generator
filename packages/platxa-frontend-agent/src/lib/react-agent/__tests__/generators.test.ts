/**
 * Component Generator - Tests
 *
 * Tests the component generation system:
 * - Template-based generation
 * - Custom spec generation
 * - CVA variants
 * - Validation
 */

import { describe, it, expect } from "vitest"
import {
  generateComponentCode,
  generateFromTemplate,
  validateComponent,
  toPascalCase,
  toCamelCase,
  getTemplate,
  getTemplateNames,
  buttonVariants,
  buttonSizes,
  type ComponentSpec,
} from "../generators"

// ============================================================================
// Utility Function Tests
// ============================================================================

describe("Utility Functions", () => {
  describe("toPascalCase", () => {
    it("should convert kebab-case to PascalCase", () => {
      expect(toPascalCase("my-component")).toBe("MyComponent")
    })

    it("should convert snake_case to PascalCase", () => {
      expect(toPascalCase("my_component")).toBe("MyComponent")
    })

    it("should convert space-separated to PascalCase", () => {
      expect(toPascalCase("my component")).toBe("MyComponent")
    })

    it("should handle already PascalCase", () => {
      expect(toPascalCase("MyComponent")).toBe("MyComponent")
    })

    it("should handle single word", () => {
      expect(toPascalCase("button")).toBe("Button")
    })
  })

  describe("toCamelCase", () => {
    it("should convert kebab-case to camelCase", () => {
      expect(toCamelCase("my-component")).toBe("myComponent")
    })

    it("should convert PascalCase to camelCase", () => {
      expect(toCamelCase("MyComponent")).toBe("myComponent")
    })

    it("should handle single word", () => {
      expect(toCamelCase("button")).toBe("button")
    })
  })
})

// ============================================================================
// Template Tests
// ============================================================================

describe("Templates", () => {
  describe("getTemplateNames", () => {
    it("should return all available template names", () => {
      const names = getTemplateNames()
      expect(names).toContain("button")
      expect(names).toContain("input")
      expect(names).toContain("card")
      expect(names).toContain("badge")
      expect(names).toContain("alert")
      expect(names.length).toBeGreaterThan(5)
    })
  })

  describe("getTemplate", () => {
    it("should return button template", () => {
      const template = getTemplate("button")
      expect(template).toBeDefined()
      expect(template?.template).toBe("button")
      expect(template?.commonVariants).toHaveLength(6)
      expect(template?.commonSizes).toHaveLength(4)
    })

    it("should return undefined for unknown template", () => {
      const template = getTemplate("unknown-template")
      expect(template).toBeUndefined()
    })

    it("should be case-insensitive", () => {
      const template1 = getTemplate("Button")
      const template2 = getTemplate("BUTTON")
      const template3 = getTemplate("button")
      expect(template1).toBeDefined()
      expect(template2).toBeDefined()
      expect(template1?.template).toBe("button")
      expect(template2?.template).toBe("button")
      expect(template3?.template).toBe("button")
    })
  })

  describe("buttonVariants", () => {
    it("should have all standard button variants", () => {
      const variantNames = buttonVariants.map((v) => v.name)
      expect(variantNames).toContain("default")
      expect(variantNames).toContain("destructive")
      expect(variantNames).toContain("outline")
      expect(variantNames).toContain("secondary")
      expect(variantNames).toContain("ghost")
      expect(variantNames).toContain("link")
    })

    it("should have CSS classes for each variant", () => {
      for (const variant of buttonVariants) {
        expect(variant.classes).toBeDefined()
        expect(variant.classes.length).toBeGreaterThan(0)
      }
    })
  })

  describe("buttonSizes", () => {
    it("should have all standard button sizes", () => {
      const sizeNames = buttonSizes.map((s) => s.name)
      expect(sizeNames).toContain("default")
      expect(sizeNames).toContain("sm")
      expect(sizeNames).toContain("lg")
      expect(sizeNames).toContain("icon")
    })
  })
})

// ============================================================================
// Component Generation Tests
// ============================================================================

describe("generateComponentCode", () => {
  const basicSpec: ComponentSpec = {
    name: "TestButton",
    baseElement: "button",
    description: "A test button component",
    baseClasses: ["inline-flex", "items-center"],
    hasChildren: true,
    forwardRef: true,
  }

  it("should generate valid component code", () => {
    const result = generateComponentCode(basicSpec)

    expect(result.fileName).toBe("TestButton.tsx")
    expect(result.code).toContain("import * as React")
    expect(result.code).toContain("TestButton")
    expect(result.exports).toContain("TestButton")
    expect(result.exports).toContain("TestButtonProps")
  })

  it("should include React import", () => {
    const result = generateComponentCode(basicSpec)
    expect(result.code).toContain('import * as React from "react"')
  })

  it("should include cn utility import", () => {
    const result = generateComponentCode(basicSpec)
    expect(result.code).toContain('import { cn } from "@/lib/utils"')
  })

  it("should generate forwardRef component", () => {
    const result = generateComponentCode(basicSpec)
    expect(result.code).toContain("React.forwardRef")
  })

  it("should include displayName", () => {
    const result = generateComponentCode(basicSpec)
    expect(result.code).toContain('TestButton.displayName = "TestButton"')
  })

  it("should generate props interface", () => {
    const result = generateComponentCode(basicSpec)
    expect(result.code).toContain("export interface TestButtonProps")
    expect(result.code).toContain("React.ButtonHTMLAttributes<HTMLButtonElement>")
  })

  it("should use cn utility for className", () => {
    const result = generateComponentCode(basicSpec)
    expect(result.code).toContain("className={cn(")
  })

  describe("with variants", () => {
    const specWithVariants: ComponentSpec = {
      ...basicSpec,
      variants: [
        { name: "default", classes: "bg-primary" },
        { name: "secondary", classes: "bg-secondary" },
      ],
      defaultVariant: "default",
    }

    it("should import CVA", () => {
      const result = generateComponentCode(specWithVariants)
      expect(result.code).toContain("import { cva, type VariantProps }")
    })

    it("should generate CVA definition", () => {
      const result = generateComponentCode(specWithVariants)
      expect(result.code).toContain("const testButtonVariants = cva(")
      expect(result.code).toContain("variant: {")
      expect(result.code).toContain('default: "bg-primary"')
      expect(result.code).toContain('secondary: "bg-secondary"')
    })

    it("should include VariantProps in interface", () => {
      const result = generateComponentCode(specWithVariants)
      expect(result.code).toContain("VariantProps<typeof testButtonVariants>")
    })

    it("should set default variant", () => {
      const result = generateComponentCode(specWithVariants)
      expect(result.code).toContain('variant: "default"')
    })

    it("should export variants", () => {
      const result = generateComponentCode(specWithVariants)
      expect(result.exports).toContain("testButtonVariants")
    })
  })

  describe("with sizes", () => {
    const specWithSizes: ComponentSpec = {
      ...basicSpec,
      sizes: [
        { name: "sm", classes: "h-8 px-2" },
        { name: "md", classes: "h-10 px-4" },
        { name: "lg", classes: "h-12 px-6" },
      ],
      defaultSize: "md",
    }

    it("should generate size variants", () => {
      const result = generateComponentCode(specWithSizes)
      expect(result.code).toContain("size: {")
      expect(result.code).toContain('sm: "h-8 px-2"')
      expect(result.code).toContain('md: "h-10 px-4"')
      expect(result.code).toContain('lg: "h-12 px-6"')
    })

    it("should set default size", () => {
      const result = generateComponentCode(specWithSizes)
      expect(result.code).toContain('size: "md"')
    })
  })

  describe("with loading state", () => {
    const specWithLoading: ComponentSpec = {
      ...basicSpec,
      hasLoadingState: true,
    }

    it("should include isLoading prop", () => {
      const result = generateComponentCode(specWithLoading)
      expect(result.code).toContain("isLoading?: boolean")
    })

    it("should render loading spinner when loading", () => {
      const result = generateComponentCode(specWithLoading)
      expect(result.code).toContain("if (isLoading)")
      expect(result.code).toContain("animate-spin")
    })
  })

  describe("with ARIA role", () => {
    const specWithRole: ComponentSpec = {
      ...basicSpec,
      ariaRole: "alert",
    }

    it("should include role attribute", () => {
      const result = generateComponentCode(specWithRole)
      expect(result.code).toContain('role="alert"')
    })
  })

  describe("atomic type detection", () => {
    it("should classify button as atom", () => {
      const result = generateComponentCode(basicSpec)
      expect(result.atomicType).toBe("atom")
    })

    it("should classify input as atom", () => {
      const inputSpec: ComponentSpec = {
        ...basicSpec,
        name: "TextInput",
        baseElement: "input",
        hasChildren: false,
      }
      const result = generateComponentCode(inputSpec)
      expect(result.atomicType).toBe("atom")
    })

    it("should classify card as molecule", () => {
      const cardSpec: ComponentSpec = {
        ...basicSpec,
        name: "Card",
        baseElement: "div",
        hasChildren: true,
      }
      const result = generateComponentCode(cardSpec)
      expect(result.atomicType).toBe("molecule")
    })
  })
})

// ============================================================================
// Template Generation Tests
// ============================================================================

describe("generateFromTemplate", () => {
  it("should generate button from template", () => {
    const result = generateFromTemplate("button")

    expect(result.fileName).toBe("Button.tsx")
    expect(result.code).toContain("React.forwardRef")
    expect(result.code).toContain("buttonVariants")
    expect(result.code).toContain("cva(")
  })

  it("should allow custom name", () => {
    const result = generateFromTemplate("button", { name: "PrimaryButton" })

    expect(result.fileName).toBe("PrimaryButton.tsx")
    expect(result.code).toContain("PrimaryButton")
    expect(result.code).toContain("primaryButtonVariants")
  })

  it("should generate input from template", () => {
    const result = generateFromTemplate("input")

    expect(result.fileName).toBe("Input.tsx")
    expect(result.code).toContain("InputProps")
    expect(result.code).toContain("React.InputHTMLAttributes<HTMLInputElement>")
  })

  it("should generate card from template", () => {
    const result = generateFromTemplate("card")

    expect(result.fileName).toBe("Card.tsx")
    expect(result.code).toContain("CardProps")
    expect(result.code).toContain("rounded-lg")
    expect(result.code).toContain("border")
  })

  it("should generate badge from template", () => {
    const result = generateFromTemplate("badge")

    expect(result.fileName).toBe("Badge.tsx")
    expect(result.code).toContain("badgeVariants")
    expect(result.code).toContain("destructive")
    expect(result.code).toContain("outline")
  })

  it("should generate alert from template", () => {
    const result = generateFromTemplate("alert")

    expect(result.fileName).toBe("Alert.tsx")
    expect(result.code).toContain('role="alert"')
    expect(result.code).toContain("alertVariants")
  })

  it("should throw error for unknown template", () => {
    expect(() => generateFromTemplate("unknown")).toThrow(
      'Template "unknown" not found'
    )
  })

  it("should allow overriding template properties", () => {
    const result = generateFromTemplate("button", {
      description: "Custom button description",
      hasLoadingState: true,
    })

    expect(result.code).toContain("Custom button description")
    expect(result.code).toContain("isLoading")
  })
})

// ============================================================================
// Validation Tests
// ============================================================================

describe("validateComponent", () => {
  it("should validate valid component code", () => {
    const result = generateFromTemplate("button")
    const validation = validateComponent(result.code)

    expect(validation.isValid).toBe(true)
    expect(validation.errors).toHaveLength(0)
    expect(validation.score).toBeGreaterThanOrEqual(8)
  })

  it("should check for forwardRef", () => {
    const result = generateFromTemplate("button")
    const validation = validateComponent(result.code)

    expect(validation.checks.hasForwardRef).toBe(true)
  })

  it("should check for displayName", () => {
    const result = generateFromTemplate("button")
    const validation = validateComponent(result.code)

    expect(validation.checks.hasDisplayName).toBe(true)
  })

  it("should check for TypeScript", () => {
    const result = generateFromTemplate("button")
    const validation = validateComponent(result.code)

    expect(validation.checks.hasTypeScript).toBe(true)
  })

  it("should check for CVA variants", () => {
    const result = generateFromTemplate("button")
    const validation = validateComponent(result.code)

    expect(validation.checks.hasCvaVariants).toBe(true)
  })

  it("should check for cn utility", () => {
    const result = generateFromTemplate("button")
    const validation = validateComponent(result.code)

    expect(validation.checks.hasCnUtility).toBe(true)
  })

  it("should detect missing displayName", () => {
    const codeWithoutDisplayName = `
      import * as React from "react"
      const Button = React.forwardRef(() => <button />)
      export { Button }
    `
    const validation = validateComponent(codeWithoutDisplayName)

    expect(validation.checks.hasDisplayName).toBe(false)
    expect(validation.errors).toContain("Component missing displayName - affects React DevTools")
  })

  it("should warn about missing forwardRef", () => {
    const codeWithoutForwardRef = `
      import * as React from "react"
      const Button = () => <button />
      Button.displayName = "Button"
      export { Button }
    `
    const validation = validateComponent(codeWithoutForwardRef)

    expect(validation.checks.hasForwardRef).toBe(false)
    expect(validation.warnings).toContain(
      "Component does not use forwardRef - may not work with form libraries"
    )
  })

  it("should calculate score correctly", () => {
    const result = generateFromTemplate("button")
    const validation = validateComponent(result.code)

    // Good component should score 8+
    expect(validation.score).toBeGreaterThanOrEqual(8)
    expect(validation.score).toBeLessThanOrEqual(10)
  })
})

// ============================================================================
// Integration Tests
// ============================================================================

describe("Component Generator Integration", () => {
  it("should generate all template components successfully", () => {
    const templates = getTemplateNames()

    for (const templateName of templates) {
      const result = generateFromTemplate(templateName)
      const validation = validateComponent(result.code)

      expect(result.code.length).toBeGreaterThan(100)
      expect(result.exports.length).toBeGreaterThanOrEqual(1)
      expect(validation.errors).toHaveLength(0)
    }
  })

  it("should generate components that import correctly", () => {
    const result = generateFromTemplate("button")

    // Check all necessary imports are present
    expect(result.code).toContain('import * as React from "react"')
    expect(result.code).toContain("import { cva")
    expect(result.code).toContain('import { cn }')
  })

  it("should generate consistent component structure", () => {
    const templates = ["button", "badge", "alert"]

    for (const templateName of templates) {
      const result = generateFromTemplate(templateName)

      // All should have these patterns
      expect(result.code).toContain("React.forwardRef")
      expect(result.code).toContain(".displayName")
      expect(result.code).toContain("export interface")
      expect(result.code).toContain("className={cn(")
    }
  })

  it("should properly handle dependencies", () => {
    const buttonResult = generateFromTemplate("button")
    const cardResult = generateFromTemplate("card")

    // Button has variants, so needs CVA
    expect(buttonResult.dependencies).toContain("class-variance-authority")

    // Card doesn't have variants in template
    // Both need react and utils
    expect(buttonResult.dependencies).toContain("react")
    expect(cardResult.dependencies).toContain("react")
    expect(buttonResult.dependencies).toContain("@/lib/utils")
    expect(cardResult.dependencies).toContain("@/lib/utils")
  })
})
