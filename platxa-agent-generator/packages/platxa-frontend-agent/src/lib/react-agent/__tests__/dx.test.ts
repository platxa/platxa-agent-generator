/**
 * DX Module Tests
 *
 * Tests for Storybook generation, visual regression testing,
 * responsive preview, and live preview systems.
 */

import { describe, it, expect } from "vitest"
import {
  // Storybook
  DEFAULT_STORY_VARIANTS,
  generateStory,
  generateStoriesFromCode,
  // Visual Testing
  DEFAULT_VIEWPORTS,
  generateVisualTest,
  generateVisualTestsFromCode,
  // Responsive Preview
  DEFAULT_BREAKPOINTS,
  generateResponsivePreview,
  // Live Preview
  DEFAULT_LIVE_PREVIEW_CONFIG,
  generateLivePreview,
  // Factory
  createDxSystem,
  // Types
  type StoryConfig,
  type SnapshotConfig,
} from "../dx"

// =============================================================================
// Test Fixtures
// =============================================================================

const SAMPLE_COMPONENT = `
/**
 * Button Component
 *
 * A versatile button with multiple variants.
 */
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border border-input bg-background",
        ghost: "hover:bg-accent",
        destructive: "bg-destructive text-destructive-foreground",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-lg",
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
  /** Whether button is loading */
  isLoading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading ? "Loading..." : children}
    </button>
  )
)
Button.displayName = "Button"

export { Button, buttonVariants }
`

// =============================================================================
// Storybook Generator Tests (#82)
// =============================================================================

describe("Storybook Generator", () => {
  describe("DEFAULT_STORY_VARIANTS", () => {
    it("should have default variant", () => {
      expect(DEFAULT_STORY_VARIANTS).toContainEqual(
        expect.objectContaining({ name: "Default" })
      )
    })

    it("should have common interaction states", () => {
      const names = DEFAULT_STORY_VARIANTS.map((v) => v.name)
      expect(names).toContain("Disabled")
      expect(names).toContain("Loading")
    })
  })

  describe("generateStory", () => {
    const config: StoryConfig = {
      componentName: "Button",
      importPath: "./Button",
      title: "Components/Button",
      description: "A versatile button component",
      variants: [
        { name: "Default", props: {} },
        { name: "Secondary", props: { variant: "secondary" } },
        { name: "Disabled", props: { disabled: true } },
      ],
      argTypes: {
        variant: {
          control: { type: "select", options: ["default", "secondary", "outline"] },
          description: "Button variant",
        },
      },
      parameters: { layout: "centered" },
    }

    it("should generate valid story file", () => {
      const story = generateStory(config)

      expect(story.content).toContain("import type { Meta, StoryObj }")
      expect(story.content).toContain('import { Button } from "./Button"')
      expect(story.fileName).toBe("Button.stories.tsx")
      expect(story.csfVersion).toBe(3)
    })

    it("should include meta configuration", () => {
      const story = generateStory(config)

      expect(story.content).toContain('title: "Components/Button"')
      expect(story.content).toContain("component: Button")
      expect(story.content).toContain('layout: "centered"')
    })

    it("should generate story variants", () => {
      const story = generateStory(config)

      expect(story.content).toContain("export const Default: Story")
      expect(story.content).toContain("export const Secondary: Story")
      expect(story.content).toContain("export const Disabled: Story")
    })

    it("should include arg types", () => {
      const story = generateStory(config)

      expect(story.content).toContain("argTypes:")
      expect(story.content).toContain("variant:")
      expect(story.content).toContain('type: "select"')
    })

    it("should include autodocs tag", () => {
      const story = generateStory(config)

      expect(story.content).toContain('tags: ["autodocs"]')
    })

    it("should include actions", () => {
      const story = generateStory(config, { includeActions: true })

      expect(story.content).toContain('import { fn } from "@storybook/test"')
      expect(story.content).toContain("onClick: fn()")
    })

    it("should use correct file suffix", () => {
      const tsxStory = generateStory(config, { suffix: ".stories.tsx" })
      const jsStory = generateStory(config, { suffix: ".stories.js" })

      expect(tsxStory.fileName).toBe("Button.stories.tsx")
      expect(jsStory.fileName).toBe("Button.stories.js")
    })
  })

  describe("generateStoriesFromCode", () => {
    it("should extract component name", () => {
      const story = generateStoriesFromCode(SAMPLE_COMPONENT)

      expect(story.content).toContain("import { Button }")
      expect(story.content).toContain('title: "Components/Button"')
    })

    it("should generate variants from CVA", () => {
      const story = generateStoriesFromCode(SAMPLE_COMPONENT)

      // Should have variant-based stories
      expect(story.content).toContain("Secondary")
      expect(story.content).toContain("Outline")
    })

    it("should include interaction states", () => {
      const story = generateStoriesFromCode(SAMPLE_COMPONENT)

      expect(story.content).toContain("Loading")
    })

    it("should generate arg types from props", () => {
      const story = generateStoriesFromCode(SAMPLE_COMPONENT)

      expect(story.content).toContain("argTypes:")
      expect(story.content).toContain("isLoading")
    })

    it("should use TypeScript by default", () => {
      const story = generateStoriesFromCode(SAMPLE_COMPONENT)

      expect(story.fileName).toMatch(/\.tsx$/)
      expect(story.content).toContain("Meta<typeof Button>")
    })
  })
})

// =============================================================================
// Visual Regression Testing (#83)
// =============================================================================

describe("Visual Regression Testing", () => {
  describe("DEFAULT_VIEWPORTS", () => {
    it("should have mobile viewport", () => {
      const mobile = DEFAULT_VIEWPORTS.find((v) => v.name === "mobile")
      expect(mobile).toBeDefined()
      expect(mobile?.isMobile).toBe(true)
      expect(mobile?.width).toBe(375)
    })

    it("should have tablet viewport", () => {
      const tablet = DEFAULT_VIEWPORTS.find((v) => v.name === "tablet")
      expect(tablet).toBeDefined()
      expect(tablet?.width).toBe(768)
    })

    it("should have desktop viewport", () => {
      const desktop = DEFAULT_VIEWPORTS.find((v) => v.name === "desktop")
      expect(desktop).toBeDefined()
      expect(desktop?.isMobile).toBe(false)
    })

    it("should have wide viewport", () => {
      const wide = DEFAULT_VIEWPORTS.find((v) => v.name === "wide")
      expect(wide).toBeDefined()
      expect(wide?.width).toBe(1920)
    })
  })

  describe("generateVisualTest", () => {
    const config: SnapshotConfig = {
      componentName: "Button",
      scenarios: [
        { name: "Default", props: {} },
        { name: "Hover", props: {}, waitForSelector: "[data-state='hover']" },
        { name: "Disabled", props: { disabled: true } },
      ],
      viewports: [
        { name: "mobile", width: 375, height: 667, isMobile: true },
        { name: "desktop", width: 1280, height: 800, isMobile: false },
      ],
      themes: ["light", "dark"],
      threshold: 0.1,
    }

    it("should generate Playwright test by default", () => {
      const test = generateVisualTest(config)

      expect(test.content).toContain('import { test, expect } from "@playwright/test"')
      expect(test.framework).toBe("playwright")
    })

    it("should generate test for each scenario", () => {
      const test = generateVisualTest(config)

      expect(test.content).toContain('test("Default"')
      expect(test.content).toContain('test("Hover"')
      expect(test.content).toContain('test("Disabled"')
    })

    it("should include viewport tests", () => {
      const test = generateVisualTest(config)

      expect(test.content).toContain('test.describe("Responsive"')
      expect(test.content).toContain('test("mobile"')
      expect(test.content).toContain('test("desktop"')
    })

    it("should include theme tests", () => {
      const test = generateVisualTest(config)

      expect(test.content).toContain('test.describe("Themes"')
      expect(test.content).toContain('test("light theme"')
      expect(test.content).toContain('test("dark theme"')
    })

    it("should include wait for selector", () => {
      const test = generateVisualTest(config)

      expect(test.content).toContain('waitForSelector("[data-state=\'hover\']")')
    })

    it("should include threshold", () => {
      const test = generateVisualTest(config)

      expect(test.content).toContain("threshold: 0.1")
    })

    it("should generate Cypress test when specified", () => {
      const test = generateVisualTest(config, "cypress")

      expect(test.content).toContain("describe(")
      expect(test.content).toContain("cy.visit")
      expect(test.content).toContain("cy.matchImageSnapshot")
      expect(test.framework).toBe("cypress")
    })

    it("should use correct file name", () => {
      const test = generateVisualTest(config)

      expect(test.fileName).toBe("Button.visual.spec.ts")
    })
  })

  describe("generateVisualTestsFromCode", () => {
    it("should extract component name", () => {
      const test = generateVisualTestsFromCode(SAMPLE_COMPONENT)

      expect(test.content).toContain("Button Visual Tests")
    })

    it("should generate scenarios from variants", () => {
      const test = generateVisualTestsFromCode(SAMPLE_COMPONENT)

      expect(test.content).toContain("variant-secondary")
    })

    it("should include responsive tests", () => {
      const test = generateVisualTestsFromCode(SAMPLE_COMPONENT)

      expect(test.content).toContain("Responsive")
    })

    it("should include theme tests", () => {
      const test = generateVisualTestsFromCode(SAMPLE_COMPONENT)

      expect(test.content).toContain("light")
      expect(test.content).toContain("dark")
    })
  })
})

// =============================================================================
// Responsive Preview System (#84)
// =============================================================================

describe("Responsive Preview System", () => {
  describe("DEFAULT_BREAKPOINTS", () => {
    it("should have all Tailwind breakpoints", () => {
      const names = DEFAULT_BREAKPOINTS.map((b) => b.name)
      expect(names).toContain("xs")
      expect(names).toContain("sm")
      expect(names).toContain("md")
      expect(names).toContain("lg")
      expect(names).toContain("xl")
      expect(names).toContain("2xl")
    })

    it("should have correct widths", () => {
      const sm = DEFAULT_BREAKPOINTS.find((b) => b.name === "sm")
      const md = DEFAULT_BREAKPOINTS.find((b) => b.name === "md")
      const lg = DEFAULT_BREAKPOINTS.find((b) => b.name === "lg")

      expect(sm?.minWidth).toBe(640)
      expect(md?.minWidth).toBe(768)
      expect(lg?.minWidth).toBe(1024)
    })

    it("should have device names", () => {
      DEFAULT_BREAKPOINTS.forEach((bp) => {
        expect(bp.device).toBeDefined()
        expect(bp.device?.length).toBeGreaterThan(0)
      })
    })

    it("should have Tailwind prefixes", () => {
      const md = DEFAULT_BREAKPOINTS.find((b) => b.name === "md")
      expect(md?.prefix).toBe("md:")
    })
  })

  describe("generateResponsivePreview", () => {
    it("should generate preview component", () => {
      const preview = generateResponsivePreview(SAMPLE_COMPONENT)

      expect(preview.component).toContain("ResponsivePreviewProps")
      expect(preview.component).toContain("ButtonResponsivePreview")
    })

    it("should include breakpoint selector", () => {
      const preview = generateResponsivePreview(SAMPLE_COMPONENT)

      expect(preview.component).toContain("setActive")
      expect(preview.component).toContain("breakpoints.map")
    })

    it("should include view all mode", () => {
      const preview = generateResponsivePreview(SAMPLE_COMPONENT)

      expect(preview.component).toContain("showAll")
      expect(preview.component).toContain("View All")
    })

    it("should generate styles", () => {
      const preview = generateResponsivePreview(SAMPLE_COMPONENT)

      expect(preview.styles).toContain(".responsive-preview")
      expect(preview.styles).toContain(".responsive-preview-frame")
    })

    it("should generate hook script", () => {
      const preview = generateResponsivePreview(SAMPLE_COMPONENT)

      expect(preview.script).toContain("useResponsivePreview")
      expect(preview.script).toContain("activeBreakpoint")
    })

    it("should support custom breakpoints", () => {
      const customBreakpoints = [
        { name: "phone", minWidth: 320, device: "iPhone SE" },
        { name: "tablet", minWidth: 768, device: "iPad" },
      ]

      const preview = generateResponsivePreview(SAMPLE_COMPONENT, {
        breakpoints: customBreakpoints,
      })

      expect(preview.component).toContain("phone")
      expect(preview.component).toContain("tablet")
    })

    it("should support label toggle", () => {
      const withLabels = generateResponsivePreview(SAMPLE_COMPONENT, {
        breakpoints: DEFAULT_BREAKPOINTS,
        showLabels: true,
      })

      const withoutLabels = generateResponsivePreview(SAMPLE_COMPONENT, {
        breakpoints: DEFAULT_BREAKPOINTS,
        showLabels: false,
      })

      expect(withLabels.component).toContain("bg-muted")
      expect(withoutLabels.component).not.toContain("font-medium")
    })
  })
})

// =============================================================================
// Live Preview System (#85)
// =============================================================================

describe("Live Preview System", () => {
  describe("DEFAULT_LIVE_PREVIEW_CONFIG", () => {
    it("should have watch patterns", () => {
      expect(DEFAULT_LIVE_PREVIEW_CONFIG.watchPatterns).toBeDefined()
      expect(DEFAULT_LIVE_PREVIEW_CONFIG.watchPatterns.length).toBeGreaterThan(0)
    })

    it("should have debounce delay", () => {
      expect(DEFAULT_LIVE_PREVIEW_CONFIG.debounceDelay).toBe(300)
    })

    it("should enable hot reload by default", () => {
      expect(DEFAULT_LIVE_PREVIEW_CONFIG.hotReload).toBe(true)
    })

    it("should enable error overlay by default", () => {
      expect(DEFAULT_LIVE_PREVIEW_CONFIG.errorOverlay).toBe(true)
    })

    it("should have default port", () => {
      expect(DEFAULT_LIVE_PREVIEW_CONFIG.port).toBe(3333)
    })
  })

  describe("generateLivePreview", () => {
    it("should generate server code", () => {
      const preview = generateLivePreview()

      expect(preview.server).toContain('import { createServer } from "vite"')
      expect(preview.server).toContain("WebSocketServer")
      expect(preview.server).toContain("chokidar.watch")
    })

    it("should generate client code", () => {
      const preview = generateLivePreview()

      expect(preview.client).toContain("LivePreview")
      expect(preview.client).toContain("WebSocket")
      expect(preview.client).toContain("onmessage")
    })

    it("should generate websocket handler", () => {
      const preview = generateLivePreview()

      expect(preview.websocket).toContain("PreviewMessage")
      expect(preview.websocket).toContain("createPreviewWebSocket")
    })

    it("should generate config file", () => {
      const preview = generateLivePreview()

      expect(preview.config).toContain("previewConfig")
      expect(preview.config).toContain("LivePreviewConfig")
    })

    it("should use custom port", () => {
      const preview = generateLivePreview({ ...DEFAULT_LIVE_PREVIEW_CONFIG, port: 4000 })

      expect(preview.server).toContain("4000")
      expect(preview.client).toContain("4001") // WebSocket port
    })

    it("should use custom watch patterns", () => {
      const preview = generateLivePreview({
        ...DEFAULT_LIVE_PREVIEW_CONFIG,
        watchPatterns: ["src/**/*.vue"],
      })

      expect(preview.server).toContain("src/**/*.vue")
    })

    it("should use custom debounce delay", () => {
      const preview = generateLivePreview({
        ...DEFAULT_LIVE_PREVIEW_CONFIG,
        debounceDelay: 500,
      })

      expect(preview.server).toContain("500")
    })

    it("should handle error overlay option", () => {
      const withOverlay = generateLivePreview({
        ...DEFAULT_LIVE_PREVIEW_CONFIG,
        errorOverlay: true,
      })

      expect(withOverlay.client).toContain("live-preview-error")
    })

    it("should include reconnection logic", () => {
      const preview = generateLivePreview()

      expect(preview.websocket).toContain("reconnectAttempts")
      expect(preview.websocket).toContain("maxReconnects")
    })
  })
})

// =============================================================================
// Factory Tests
// =============================================================================

describe("createDxSystem", () => {
  it("should create system with all methods", () => {
    const dx = createDxSystem()

    expect(dx.generateStory).toBeDefined()
    expect(dx.generateStoriesFromCode).toBeDefined()
    expect(dx.generateVisualTest).toBeDefined()
    expect(dx.generateVisualTestsFromCode).toBeDefined()
    expect(dx.generateResponsivePreview).toBeDefined()
    expect(dx.generateLivePreview).toBeDefined()
    expect(dx.breakpoints).toBeDefined()
    expect(dx.viewports).toBeDefined()
  })

  it("should expose default breakpoints", () => {
    const dx = createDxSystem()

    expect(dx.breakpoints).toBe(DEFAULT_BREAKPOINTS)
  })

  it("should expose default viewports", () => {
    const dx = createDxSystem()

    expect(dx.viewports).toBe(DEFAULT_VIEWPORTS)
  })

  it("should use custom storybook options", () => {
    const dx = createDxSystem({
      storybook: { suffix: ".stories.js", typescript: false },
    })

    const story = dx.generateStoriesFromCode(SAMPLE_COMPONENT)
    expect(story.fileName).toMatch(/\.js$/)
  })

  it("should use custom visual test framework", () => {
    const dx = createDxSystem({
      visualTests: { framework: "cypress" },
    })

    const test = dx.generateVisualTestsFromCode(SAMPLE_COMPONENT)
    expect(test.framework).toBe("cypress")
  })

  it("should generate integrated stories", () => {
    const dx = createDxSystem()
    const story = dx.generateStoriesFromCode(SAMPLE_COMPONENT)

    expect(story.content).toContain("Button")
    expect(story.content).toContain("Meta")
    expect(story.content).toContain("StoryObj")
  })

  it("should generate integrated visual tests", () => {
    const dx = createDxSystem()
    const test = dx.generateVisualTestsFromCode(SAMPLE_COMPONENT)

    expect(test.content).toContain("Button")
    expect(test.content).toContain("toHaveScreenshot")
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe("DX Integration", () => {
  it("should generate complete DX suite for component", () => {
    const dx = createDxSystem()

    // Generate all DX artifacts
    const story = dx.generateStoriesFromCode(SAMPLE_COMPONENT)
    const visualTest = dx.generateVisualTestsFromCode(SAMPLE_COMPONENT)
    const preview = dx.generateResponsivePreview(SAMPLE_COMPONENT)
    const livePreview = dx.generateLivePreview()

    // Verify all artifacts
    expect(story.content.length).toBeGreaterThan(0)
    expect(visualTest.content.length).toBeGreaterThan(0)
    expect(preview.component.length).toBeGreaterThan(0)
    expect(livePreview.server.length).toBeGreaterThan(0)
  })

  it("should maintain component name consistency", () => {
    const dx = createDxSystem()

    const story = dx.generateStoriesFromCode(SAMPLE_COMPONENT)
    const visualTest = dx.generateVisualTestsFromCode(SAMPLE_COMPONENT)
    const preview = dx.generateResponsivePreview(SAMPLE_COMPONENT)

    // All should reference "Button"
    expect(story.content).toContain("Button")
    expect(visualTest.content).toContain("Button")
    expect(preview.component).toContain("Button")
  })

  it("should work with minimal component", () => {
    const minimalComponent = `
export function Card({ children }: { children: React.ReactNode }) {
  return <div className="card">{children}</div>
}
`

    const dx = createDxSystem()
    const story = dx.generateStoriesFromCode(minimalComponent)
    const visualTest = dx.generateVisualTestsFromCode(minimalComponent)

    expect(story.content).toContain("Card")
    expect(visualTest.content).toContain("Card")
  })

  it("should handle edge cases gracefully", () => {
    const dx = createDxSystem()

    // Empty code
    const emptyStory = dx.generateStoriesFromCode("")
    expect(emptyStory.content).toContain("Component")

    // No variants
    const noVariants = dx.generateStoriesFromCode("export const Foo = () => null")
    expect(noVariants.content).toContain("Default")
  })
})
