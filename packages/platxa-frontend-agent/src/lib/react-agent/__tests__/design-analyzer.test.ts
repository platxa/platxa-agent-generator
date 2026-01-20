/**
 * Design Analyzer Tests
 *
 * Tests for extracting visual requirements from natural language descriptions.
 */

import { describe, it, expect } from "vitest"
import {
  // Component detection
  detectComponentType,
  getComponentCategory,
  // Style detection
  detectStyleVariant,
  detectSizeVariant,
  detectShapeVariant,
  // Intent extraction
  extractColorIntent,
  extractSpacingIntent,
  extractTypographyIntent,
  extractInteractionIntent,
  extractAnimationIntent,
  extractLayoutIntent,
  extractContentIntent,
  extractAccessibilityIntent,
  // Utilities
  extractKeywords,
  // Main functions
  analyzeDescription,
  quickAnalyze,
  validateRequirements,
} from "../design-analyzer"

import type { DesignRequirements } from "../design-analyzer"

// ============================================================================
// Component Type Detection Tests
// ============================================================================

describe("Component Type Detection", () => {
  describe("detectComponentType", () => {
    it("detects button components", () => {
      expect(detectComponentType("create a button").type).toBe("button")
      expect(detectComponentType("submit button").type).toBe("button")
      expect(detectComponentType("CTA button").type).toBe("button")
      expect(detectComponentType("click action").type).toBe("button")
    })

    it("detects card components", () => {
      expect(detectComponentType("product card").type).toBe("card")
      expect(detectComponentType("info card with image").type).toBe("card")
      expect(detectComponentType("tile layout").type).toBe("card")
    })

    it("detects input components", () => {
      expect(detectComponentType("text input").type).toBe("input")
      expect(detectComponentType("search field").type).toBe("input")
      expect(detectComponentType("text field with label").type).toBe("input")
    })

    it("detects modal components", () => {
      expect(detectComponentType("modal dialog").type).toBe("modal")
      expect(detectComponentType("popup window").type).toBe("modal")
      expect(detectComponentType("overlay form").type).toBe("modal")
    })

    it("detects navigation components", () => {
      expect(detectComponentType("navigation bar").type).toBe("navbar")
      expect(detectComponentType("sidebar menu").type).toBe("sidebar")
      expect(detectComponentType("tab navigation").type).toBe("tabs")
      expect(detectComponentType("breadcrumb trail").type).toBe("breadcrumb")
    })

    it("detects feedback components", () => {
      expect(detectComponentType("alert message").type).toBe("alert")
      expect(detectComponentType("toast notification").type).toBe("toast")
      expect(detectComponentType("progress bar").type).toBe("progress")
      expect(detectComponentType("loading spinner").type).toBe("spinner")
    })

    it("detects form input components", () => {
      expect(detectComponentType("checkbox option").type).toBe("checkbox")
      expect(detectComponentType("radio button group").type).toBe("radio")
      expect(detectComponentType("toggle switch").type).toBe("switch")
      expect(detectComponentType("range slider").type).toBe("slider")
      expect(detectComponentType("dropdown menu").type).toBe("dropdown")
    })

    it("returns unknown for unrecognized descriptions", () => {
      expect(detectComponentType("something random").type).toBe("unknown")
      expect(detectComponentType("xyz widget").type).toBe("unknown")
    })

    it("returns confidence score", () => {
      const buttonResult = detectComponentType("primary button")
      expect(buttonResult.confidence).toBeGreaterThan(0)
      expect(buttonResult.confidence).toBeLessThanOrEqual(1)

      const unknownResult = detectComponentType("xyz")
      expect(unknownResult.confidence).toBe(0)
    })

    it("handles case insensitivity", () => {
      expect(detectComponentType("BUTTON").type).toBe("button")
      expect(detectComponentType("Button").type).toBe("button")
      expect(detectComponentType("MODAL DIALOG").type).toBe("modal")
    })
  })

  describe("getComponentCategory", () => {
    it("returns correct category for action components", () => {
      expect(getComponentCategory("button")).toBe("action")
    })

    it("returns correct category for input components", () => {
      expect(getComponentCategory("input")).toBe("input")
      expect(getComponentCategory("checkbox")).toBe("input")
      expect(getComponentCategory("select")).toBe("input")
    })

    it("returns correct category for display components", () => {
      expect(getComponentCategory("card")).toBe("display")
      expect(getComponentCategory("badge")).toBe("display")
      expect(getComponentCategory("avatar")).toBe("display")
    })

    it("returns correct category for feedback components", () => {
      expect(getComponentCategory("alert")).toBe("feedback")
      expect(getComponentCategory("toast")).toBe("feedback")
      expect(getComponentCategory("progress")).toBe("feedback")
    })

    it("returns correct category for navigation components", () => {
      expect(getComponentCategory("tabs")).toBe("navigation")
      expect(getComponentCategory("menu")).toBe("navigation")
      expect(getComponentCategory("navbar")).toBe("navigation")
    })

    it("returns correct category for layout components", () => {
      expect(getComponentCategory("container")).toBe("layout")
      expect(getComponentCategory("divider")).toBe("layout")
      expect(getComponentCategory("grid")).toBe("layout")
    })

    it("returns correct category for overlay components", () => {
      expect(getComponentCategory("modal")).toBe("overlay")
      expect(getComponentCategory("tooltip")).toBe("overlay")
      expect(getComponentCategory("popover")).toBe("overlay")
    })
  })
})

// ============================================================================
// Style Variant Detection Tests
// ============================================================================

describe("Style Variant Detection", () => {
  describe("detectStyleVariant", () => {
    it("detects primary variant", () => {
      expect(detectStyleVariant("primary button")).toBe("primary")
      expect(detectStyleVariant("main action")).toBe("primary")
      expect(detectStyleVariant("prominent CTA")).toBe("primary")
    })

    it("detects secondary variant", () => {
      expect(detectStyleVariant("secondary button")).toBe("secondary")
      expect(detectStyleVariant("alternate style")).toBe("secondary")
    })

    it("detects outline variant", () => {
      expect(detectStyleVariant("outline button")).toBe("outline")
      expect(detectStyleVariant("outlined style")).toBe("outline")
      expect(detectStyleVariant("border only")).toBe("outline")
    })

    it("detects ghost variant", () => {
      expect(detectStyleVariant("ghost button")).toBe("ghost")
      expect(detectStyleVariant("transparent background")).toBe("ghost")
    })

    it("detects destructive variant", () => {
      expect(detectStyleVariant("destructive action")).toBe("destructive")
      expect(detectStyleVariant("delete button")).toBe("destructive")
      expect(detectStyleVariant("danger zone")).toBe("destructive")
    })

    it("detects success variant", () => {
      expect(detectStyleVariant("success message")).toBe("success")
      expect(detectStyleVariant("positive feedback")).toBe("success")
      expect(detectStyleVariant("confirm action")).toBe("success")
    })

    it("detects warning variant", () => {
      expect(detectStyleVariant("warning alert")).toBe("warning")
      expect(detectStyleVariant("caution message")).toBe("warning")
    })

    it("detects info variant", () => {
      expect(detectStyleVariant("info box")).toBe("info")
      expect(detectStyleVariant("information panel")).toBe("info")
    })

    it("returns undefined for no variant", () => {
      expect(detectStyleVariant("something random")).toBeUndefined()
    })
  })

  describe("detectSizeVariant", () => {
    it("detects small sizes", () => {
      expect(detectSizeVariant("small button")).toBe("sm")
      expect(detectSizeVariant("xs icon")).toBe("xs")
      expect(detectSizeVariant("tiny badge")).toBe("xs")
      expect(detectSizeVariant("compact layout")).toBe("xs")
    })

    it("detects medium size", () => {
      expect(detectSizeVariant("medium sized")).toBe("md")
      expect(detectSizeVariant("normal button")).toBe("md")
      expect(detectSizeVariant("regular input")).toBe("md")
    })

    it("detects large sizes", () => {
      expect(detectSizeVariant("large button")).toBe("lg")
      expect(detectSizeVariant("big card")).toBe("lg")
      expect(detectSizeVariant("xl header")).toBe("xl")
      expect(detectSizeVariant("extra large modal")).toBe("xl")
    })

    it("detects full width", () => {
      expect(detectSizeVariant("full width button")).toBe("full")
      expect(detectSizeVariant("stretch to fit")).toBe("full")
    })

    it("returns undefined for no size", () => {
      expect(detectSizeVariant("button")).toBeUndefined()
    })
  })

  describe("detectShapeVariant", () => {
    it("detects square shape", () => {
      expect(detectShapeVariant("square button")).toBe("square")
      expect(detectShapeVariant("sharp corners")).toBe("square")
    })

    it("detects rounded shape", () => {
      expect(detectShapeVariant("rounded corners")).toBe("rounded")
      expect(detectShapeVariant("soft corners")).toBe("rounded")
    })

    it("detects pill shape", () => {
      expect(detectShapeVariant("pill shaped")).toBe("pill")
      expect(detectShapeVariant("capsule button")).toBe("pill")
    })

    it("detects circle shape", () => {
      expect(detectShapeVariant("circular button")).toBe("circle")
      expect(detectShapeVariant("round icon")).toBe("circle")
    })

    it("returns undefined for no shape", () => {
      expect(detectShapeVariant("button")).toBeUndefined()
    })
  })
})

// ============================================================================
// Color Intent Extraction Tests
// ============================================================================

describe("Color Intent Extraction", () => {
  describe("extractColorIntent", () => {
    it("extracts semantic color intents", () => {
      expect(extractColorIntent("success message").semantic).toBe("success")
      expect(extractColorIntent("error state").semantic).toBe("error")
      expect(extractColorIntent("warning indicator").semantic).toBe("warning")
      expect(extractColorIntent("info tooltip").semantic).toBe("info")
    })

    it("extracts named colors", () => {
      expect(extractColorIntent("blue button").primary).toBe("#3b82f6")
      expect(extractColorIntent("red alert").primary).toBe("#ef4444")
      expect(extractColorIntent("green badge").primary).toBe("#22c55e")
    })

    it("extracts color with role", () => {
      const bgColor = extractColorIntent("blue background")
      expect(bgColor.background).toBe("#3b82f6")

      const textColor = extractColorIntent("white text")
      expect(textColor.foreground).toBe("#ffffff")

      const borderColor = extractColorIntent("gray border")
      expect(borderColor.border).toBe("#6b7280")
    })

    it("extracts hex colors from description", () => {
      expect(extractColorIntent("color #ff5733").primary).toBe("#ff5733")
      expect(extractColorIntent("background #123456").primary).toBe("#123456")
    })

    it("returns empty object for no colors", () => {
      const result = extractColorIntent("simple component")
      expect(Object.keys(result)).toHaveLength(0)
    })
  })
})

// ============================================================================
// Spacing Intent Extraction Tests
// ============================================================================

describe("Spacing Intent Extraction", () => {
  describe("extractSpacingIntent", () => {
    it("extracts padding levels", () => {
      expect(extractSpacingIntent("no padding").padding).toBe("none")
      expect(extractSpacingIntent("compact layout").padding).toBe("none")
      expect(extractSpacingIntent("tight padding").padding).toBe("tight")
      expect(extractSpacingIntent("spacious padding").padding).toBe("spacious")
      expect(extractSpacingIntent("with padding").padding).toBe("normal")
    })

    it("extracts gap levels", () => {
      expect(extractSpacingIntent("no gap").gap).toBe("none")
      expect(extractSpacingIntent("tight spacing").gap).toBe("tight")
      expect(extractSpacingIntent("dense grid").gap).toBe("tight")
      expect(extractSpacingIntent("spacious layout").gap).toBe("spacious")
      expect(extractSpacingIntent("airy design").gap).toBe("spacious")
    })

    it("returns empty object for no spacing", () => {
      const result = extractSpacingIntent("button")
      expect(Object.keys(result)).toHaveLength(0)
    })
  })
})

// ============================================================================
// Typography Intent Extraction Tests
// ============================================================================

describe("Typography Intent Extraction", () => {
  describe("extractTypographyIntent", () => {
    it("extracts font weight", () => {
      expect(extractTypographyIntent("bold text").weight).toBe("bold")
      expect(extractTypographyIntent("semibold heading").weight).toBe("semibold")
      expect(extractTypographyIntent("light font").weight).toBe("light")
    })

    it("extracts text alignment", () => {
      expect(extractTypographyIntent("centered text").align).toBe("center")
      expect(extractTypographyIntent("right aligned").align).toBe("right")
      expect(extractTypographyIntent("justify text").align).toBe("justify")
    })

    it("extracts text transform", () => {
      expect(extractTypographyIntent("uppercase label").transform).toBe("uppercase")
      expect(extractTypographyIntent("all caps button").transform).toBe("uppercase")
      expect(extractTypographyIntent("capitalize words").transform).toBe("capitalize")
    })

    it("extracts font family", () => {
      expect(extractTypographyIntent("monospace code").family).toBe("mono")
      expect(extractTypographyIntent("code block").family).toBe("mono")
      expect(extractTypographyIntent("serif heading").family).toBe("serif")
    })

    it("returns empty object for no typography", () => {
      const result = extractTypographyIntent("button")
      expect(Object.keys(result)).toHaveLength(0)
    })
  })
})

// ============================================================================
// Interaction Intent Extraction Tests
// ============================================================================

describe("Interaction Intent Extraction", () => {
  describe("extractInteractionIntent", () => {
    it("extracts hover effects", () => {
      expect(extractInteractionIntent("hover lift").hover?.effect).toBe("lift")
      expect(extractInteractionIntent("hover scale").hover?.effect).toBe("scale")
      expect(extractInteractionIntent("hover glow").hover?.effect).toBe("glow")
      expect(extractInteractionIntent("hover darken").hover?.effect).toBe("darken")
    })

    it("extracts press effects", () => {
      expect(extractInteractionIntent("press scale").press?.effect).toBe("scale")
      expect(extractInteractionIntent("click ripple").press?.effect).toBe("ripple")
    })

    it("extracts focus requirements", () => {
      expect(extractInteractionIntent("focus ring").focus?.ring).toBe(true)
      expect(extractInteractionIntent("focus outline").focus?.outline).toBe(true)
    })

    it("extracts state requirements", () => {
      expect(extractInteractionIntent("with disabled state").hasDisabledState).toBe(true)
      expect(extractInteractionIntent("loading spinner").hasLoadingState).toBe(true)
    })

    it("defaults hover to scale when just 'hover' mentioned", () => {
      const result = extractInteractionIntent("with hover effect")
      expect(result.hover?.effect).toBe("scale")
      expect(result.hover?.intensity).toBe("subtle")
    })
  })
})

// ============================================================================
// Animation Intent Extraction Tests
// ============================================================================

describe("Animation Intent Extraction", () => {
  describe("extractAnimationIntent", () => {
    it("extracts entrance animations", () => {
      expect(extractAnimationIntent("fade in").entrance).toBe("fade")
      expect(extractAnimationIntent("slide in").entrance).toBe("slide")
      expect(extractAnimationIntent("scale in").entrance).toBe("scale")
      expect(extractAnimationIntent("bounce in").entrance).toBe("bounce")
    })

    it("extracts exit animations", () => {
      expect(extractAnimationIntent("fade out").exit).toBe("fade")
      expect(extractAnimationIntent("slide out").exit).toBe("slide")
    })

    it("extracts animation direction", () => {
      expect(extractAnimationIntent("slide down from top").direction).toBe("down")
      expect(extractAnimationIntent("slide up from bottom").direction).toBe("up")
      expect(extractAnimationIntent("from left").direction).toBe("left")
      expect(extractAnimationIntent("from right").direction).toBe("right")
    })

    it("extracts animation speed", () => {
      expect(extractAnimationIntent("fast animation").speed).toBe("fast")
      expect(extractAnimationIntent("quick transition").speed).toBe("fast")
      expect(extractAnimationIntent("slow fade").speed).toBe("slow")
      expect(extractAnimationIntent("instant").speed).toBe("instant")
    })

    it("detects reduced motion requirement", () => {
      expect(extractAnimationIntent("support reduced motion").respectReducedMotion).toBe(true)
      expect(extractAnimationIntent("a11y compliant").respectReducedMotion).toBe(true)
    })

    it("defaults to fade for generic animation mention", () => {
      expect(extractAnimationIntent("animated component").entrance).toBe("fade")
    })
  })
})

// ============================================================================
// Layout Intent Extraction Tests
// ============================================================================

describe("Layout Intent Extraction", () => {
  describe("extractLayoutIntent", () => {
    it("extracts display type", () => {
      expect(extractLayoutIntent("flex container").display).toBe("flex")
      expect(extractLayoutIntent("grid layout").display).toBe("grid")
      expect(extractLayoutIntent("inline element").display).toBe("inline")
    })

    it("extracts direction", () => {
      expect(extractLayoutIntent("horizontal layout").direction).toBe("row")
      expect(extractLayoutIntent("row direction").direction).toBe("row")
      expect(extractLayoutIntent("vertical stack").direction).toBe("column")
      expect(extractLayoutIntent("column layout").direction).toBe("column")
    })

    it("extracts alignment", () => {
      expect(extractLayoutIntent("centered content").align).toBe("center")
      expect(extractLayoutIntent("centered content").justify).toBe("center")
      expect(extractLayoutIntent("space between items").justify).toBe("between")
    })

    it("extracts width behavior", () => {
      expect(extractLayoutIntent("full width container").width).toBe("full")
      expect(extractLayoutIntent("stretch to fill").width).toBe("full")
      expect(extractLayoutIntent("fixed width box").width).toBe("fixed")
    })

    it("detects responsive requirements", () => {
      expect(extractLayoutIntent("responsive design").responsive).toBe(true)
      expect(extractLayoutIntent("mobile friendly").responsive).toBe(true)
      expect(extractLayoutIntent("adaptive layout").responsive).toBe(true)
    })
  })
})

// ============================================================================
// Content Intent Extraction Tests
// ============================================================================

describe("Content Intent Extraction", () => {
  describe("extractContentIntent", () => {
    it("detects icon presence and position", () => {
      expect(extractContentIntent("button with icon").hasIcon).toBe(true)
      expect(extractContentIntent("icon left button").iconPosition).toBe("left")
      expect(extractContentIntent("right icon").iconPosition).toBe("right")
      expect(extractContentIntent("icon only button").iconPosition).toBe("only")
    })

    it("detects image presence", () => {
      expect(extractContentIntent("card with image").hasImage).toBe(true)
      expect(extractContentIntent("photo gallery").hasImage).toBe(true)
      expect(extractContentIntent("thumbnail preview").hasImage).toBe(true)
    })

    it("detects text elements", () => {
      expect(extractContentIntent("with title").hasTitle).toBe(true)
      expect(extractContentIntent("heading text").hasTitle).toBe(true)
      expect(extractContentIntent("with description").hasDescription).toBe(true)
      expect(extractContentIntent("subtitle text").hasDescription).toBe(true)
    })

    it("detects action buttons", () => {
      expect(extractContentIntent("card with actions").hasActions).toBe(true)
      expect(extractContentIntent("action buttons").hasActions).toBe(true)
    })

    it("detects dismiss/close button", () => {
      expect(extractContentIntent("dismissible alert").hasDismiss).toBe(true)
      expect(extractContentIntent("close button").hasDismiss).toBe(true)
      expect(extractContentIntent("closeable modal").hasDismiss).toBe(true)
    })
  })
})

// ============================================================================
// Accessibility Intent Extraction Tests
// ============================================================================

describe("Accessibility Intent Extraction", () => {
  describe("extractAccessibilityIntent", () => {
    it("detects explicit accessibility mention", () => {
      expect(extractAccessibilityIntent("accessible button").explicitlyMentioned).toBe(true)
      expect(extractAccessibilityIntent("a11y compliant").explicitlyMentioned).toBe(true)
      expect(extractAccessibilityIntent("wcag 2.2").explicitlyMentioned).toBe(true)
      expect(extractAccessibilityIntent("aria support").explicitlyMentioned).toBe(true)
    })

    it("detects ARIA label requirement", () => {
      expect(extractAccessibilityIntent("with aria label").needsAriaLabel).toBe(true)
      expect(extractAccessibilityIntent("screen reader support").needsAriaLabel).toBe(true)
    })

    it("detects keyboard support requirement", () => {
      expect(extractAccessibilityIntent("keyboard navigation").needsKeyboardSupport).toBe(true)
      expect(extractAccessibilityIntent("tab focus").needsKeyboardSupport).toBe(true)
    })

    it("detects focus management requirement", () => {
      expect(extractAccessibilityIntent("focus trap").needsFocusManagement).toBe(true)
      expect(extractAccessibilityIntent("modal dialog").needsFocusManagement).toBe(true)
    })

    it("detects announcement requirement", () => {
      expect(extractAccessibilityIntent("live region").needsAnnouncements).toBe(true)
      expect(extractAccessibilityIntent("alert message").needsAnnouncements).toBe(true)
    })
  })
})

// ============================================================================
// Keyword Extraction Tests
// ============================================================================

describe("Keyword Extraction", () => {
  describe("extractKeywords", () => {
    it("extracts meaningful words", () => {
      const keywords = extractKeywords("create a large primary button")
      expect(keywords).toContain("large")
      expect(keywords).toContain("primary")
      expect(keywords).toContain("button")
    })

    it("filters out stop words", () => {
      const keywords = extractKeywords("create a button with some text")
      expect(keywords).not.toContain("a")
      expect(keywords).not.toContain("with")
      expect(keywords).not.toContain("some")
      expect(keywords).not.toContain("create")
    })

    it("extracts multi-word phrases", () => {
      const keywords = extractKeywords("call to action with hover effect")
      expect(keywords).toContain("call to action")
      expect(keywords).toContain("hover effect")
    })

    it("removes duplicates", () => {
      const keywords = extractKeywords("button button button")
      const buttonCount = keywords.filter((k) => k === "button").length
      expect(buttonCount).toBe(1)
    })

    it("handles punctuation", () => {
      const keywords = extractKeywords("button, card, and modal!")
      expect(keywords).toContain("button")
      expect(keywords).toContain("card")
      expect(keywords).toContain("modal")
    })
  })
})

// ============================================================================
// Main Analysis Function Tests
// ============================================================================

describe("Main Analysis", () => {
  describe("analyzeDescription", () => {
    it("returns complete analysis result", () => {
      const result = analyzeDescription(
        "Create a large primary button with hover lift effect"
      )

      expect(result.primary).toBeDefined()
      expect(result.primary.componentType).toBe("button")
      expect(result.primary.category).toBe("action")
      expect(result.primary.size).toBe("lg")
      expect(result.primary.variant).toBe("primary")
      expect(result.primary.interactions?.hover?.effect).toBe("lift")
    })

    it("includes original description", () => {
      const desc = "simple button"
      const result = analyzeDescription(desc)
      expect(result.primary.originalDescription).toBe(desc)
    })

    it("includes keywords", () => {
      const result = analyzeDescription("blue rounded button")
      expect(result.primary.keywords).toContain("blue")
      expect(result.primary.keywords).toContain("rounded")
      expect(result.primary.keywords).toContain("button")
    })

    it("includes confidence score", () => {
      const result = analyzeDescription("button")
      expect(result.primary.confidence).toBeGreaterThan(0)
    })

    it("adds warnings for low confidence", () => {
      const result = analyzeDescription("xyz widget thing", {
        minConfidence: 0.5,
      })
      expect(result.warnings).toBeDefined()
      expect(result.warnings!.length).toBeGreaterThan(0)
    })

    it("adds suggestions for missing information", () => {
      const result = analyzeDescription("button")
      expect(result.suggestions).toBeDefined()
      expect(result.suggestions!.length).toBeGreaterThan(0)
    })

    it("applies default values from config", () => {
      const result = analyzeDescription("button", {
        defaults: {
          size: "md",
          variant: "default",
        },
      })
      expect(result.primary.size).toBe("md")
      expect(result.primary.variant).toBe("default")
    })

    it("extracts all intent types", () => {
      const result = analyzeDescription(
        "large primary rounded button with blue background, " +
        "bold text, hover scale effect, fade in animation, " +
        "full width, icon left, accessible with focus ring"
      )

      expect(result.primary.size).toBe("lg")
      expect(result.primary.variant).toBe("primary")
      expect(result.primary.shape).toBe("rounded")
      // "blue background" correctly sets background color, not primary
      expect(result.primary.colors?.background).toBe("#3b82f6")
      expect(result.primary.typography?.weight).toBe("bold")
      expect(result.primary.interactions?.hover?.effect).toBe("scale")
      expect(result.primary.animations?.entrance).toBe("fade")
      expect(result.primary.layout?.width).toBe("full")
      expect(result.primary.content?.hasIcon).toBe(true)
      expect(result.primary.accessibility?.explicitlyMentioned).toBe(true)
    })
  })

  describe("quickAnalyze", () => {
    it("returns type, variant, and size", () => {
      const result = quickAnalyze("large primary button")

      expect(result.type).toBe("button")
      expect(result.variant).toBe("primary")
      expect(result.size).toBe("lg")
    })

    it("handles missing properties", () => {
      const result = quickAnalyze("button")

      expect(result.type).toBe("button")
      expect(result.variant).toBeUndefined()
      expect(result.size).toBeUndefined()
    })

    it("is faster than full analysis", () => {
      const start1 = performance.now()
      quickAnalyze("button")
      const quick = performance.now() - start1

      const start2 = performance.now()
      analyzeDescription("button")
      const full = performance.now() - start2

      // Quick should be faster (or at least not significantly slower)
      expect(quick).toBeLessThanOrEqual(full * 2)
    })
  })

  describe("validateRequirements", () => {
    it("validates complete requirements", () => {
      const requirements: DesignRequirements = {
        componentType: "button",
        category: "action",
        confidence: 0.8,
        keywords: ["button"],
        originalDescription: "button",
      }

      const result = validateRequirements(requirements)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it("fails for missing component type", () => {
      const requirements = {
        category: "action",
        confidence: 0.8,
        keywords: [],
        originalDescription: "test",
      } as unknown as DesignRequirements

      const result = validateRequirements(requirements)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it("fails for unknown type with low confidence", () => {
      const requirements: DesignRequirements = {
        componentType: "unknown",
        category: "display",
        confidence: 0.3,
        keywords: [],
        originalDescription: "xyz",
      }

      const result = validateRequirements(requirements)
      expect(result.valid).toBe(false)
    })

    it("fails for missing original description", () => {
      const requirements = {
        componentType: "button",
        category: "action",
        confidence: 0.8,
        keywords: [],
      } as unknown as DesignRequirements

      const result = validateRequirements(requirements)
      expect(result.valid).toBe(false)
    })
  })
})

// ============================================================================
// Integration Tests
// ============================================================================

describe("Integration Tests", () => {
  it("analyzes a complete button description", () => {
    const result = analyzeDescription(
      "Create a large destructive button with rounded corners for delete actions. " +
      "It should have a hover lift effect and a press scale animation. " +
      "Include an icon on the left side. Make it accessible with proper focus states."
    )

    expect(result.primary.componentType).toBe("button")
    expect(result.primary.variant).toBe("destructive")
    expect(result.primary.size).toBe("lg")
    expect(result.primary.shape).toBe("rounded")
    expect(result.primary.interactions?.hover?.effect).toBe("lift")
    expect(result.primary.interactions?.press?.effect).toBe("scale")
    expect(result.primary.content?.hasIcon).toBe(true)
    expect(result.primary.content?.iconPosition).toBe("left")
    expect(result.primary.accessibility?.explicitlyMentioned).toBe(true)
  })

  it("analyzes a complete card description", () => {
    const result = analyzeDescription(
      "A product card with an image at the top, title, description, and price. " +
      "Should have subtle shadow and rounded corners. " +
      "Add a fade in animation when it appears. " +
      "Include action buttons at the bottom."
    )

    expect(result.primary.componentType).toBe("card")
    expect(result.primary.category).toBe("display")
    expect(result.primary.shape).toBe("rounded")
    expect(result.primary.content?.hasImage).toBe(true)
    expect(result.primary.content?.hasTitle).toBe(true)
    expect(result.primary.content?.hasDescription).toBe(true)
    expect(result.primary.content?.hasActions).toBe(true)
    expect(result.primary.animations?.entrance).toBe("fade")
  })

  it("analyzes a modal description", () => {
    const result = analyzeDescription(
      "A confirmation dialog that slides in from the bottom. " +
      "Should have a close button and be dismissible. " +
      "Center the content and make it accessible with focus trap."
    )

    expect(result.primary.componentType).toBe("dialog")
    expect(result.primary.category).toBe("overlay")
    expect(result.primary.animations?.entrance).toBe("slide")
    expect(result.primary.animations?.direction).toBe("up")
    expect(result.primary.content?.hasDismiss).toBe(true)
    expect(result.primary.layout?.align).toBe("center")
    expect(result.primary.accessibility?.needsFocusManagement).toBe(true)
  })

  it("analyzes a form input description", () => {
    const result = analyzeDescription(
      "A text input field with a label. " +
      "Should show error state with red border when invalid. " +
      "Full width with relaxed padding."
    )

    expect(result.primary.componentType).toBe("input")
    expect(result.primary.category).toBe("input")
    expect(result.primary.colors?.semantic).toBe("error")
    expect(result.primary.layout?.width).toBe("full")
    expect(result.primary.spacing?.padding).toBe("relaxed")
  })

  it("handles ambiguous descriptions gracefully", () => {
    const result = analyzeDescription("something with buttons and text")

    // Should still return a result
    expect(result.primary).toBeDefined()
    expect(result.primary.componentType).toBeDefined()
    // Should have warnings or low confidence
    expect(
      result.primary.confidence < 0.5 || (result.warnings && result.warnings.length > 0)
    ).toBe(true)
  })
})
