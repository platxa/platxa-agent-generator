/**
 * Test Planner Tests
 *
 * Tests for generating test plans from UI component specifications.
 */

import { describe, it, expect, beforeEach } from "vitest"
import {
  generateTestPlan,
  toMarkdown,
  extractSpecFromRequirements,
  resetTestIdCounter,
  generatePropTests,
  generateStateTests,
  generateEventTests,
  generateAccessibilityTests,
  generateVisualTests,
  generateIntegrationTests,
  generateE2ETests,
  generatePerformanceTests,
  type ComponentSpec,
  type TestPlannerConfig,
} from "../test-planner"

import type { DesignRequirements } from "../design-analyzer"

// ============================================================================
// Test Fixtures
// ============================================================================

const createButtonSpec = (): ComponentSpec => ({
  name: "Button",
  type: "button",
  props: [
    { name: "variant", type: "string", required: false, defaultValue: "default", validValues: ["default", "primary", "destructive"] },
    { name: "size", type: "string", required: false, defaultValue: "md", validValues: ["sm", "md", "lg"] },
    { name: "disabled", type: "boolean", required: false, defaultValue: "false" },
    { name: "children", type: "ReactNode", required: true },
  ],
  states: [
    { name: "hover", description: "Hover state", visualChanges: ["Background darkens"], triggers: ["Mouse enters button"] },
    { name: "focus", description: "Focus state", visualChanges: ["Focus ring appears"], triggers: ["Tab focuses button"] },
    { name: "disabled", description: "Disabled state", visualChanges: ["Opacity reduced"], triggers: ["disabled prop is true"] },
    { name: "loading", description: "Loading state", visualChanges: ["Spinner shown"], triggers: ["isLoading prop is true"] },
  ],
  events: [
    { name: "onClick", description: "Click handler", trigger: "Click the button", expectedBehavior: "onClick handler is called" },
    { name: "onFocus", description: "Focus handler", trigger: "Focus the button", expectedBehavior: "onFocus handler is called" },
  ],
  accessibility: {
    role: "button",
    ariaAttributes: ["aria-disabled", "aria-busy"],
    keyboardInteractions: ["Enter activates button", "Space activates button"],
    focusBehavior: "Standard focus with visible ring",
    screenReaderExpectations: ["Button label is announced", "Disabled state is announced"],
  },
})

const createInputSpec = (): ComponentSpec => ({
  name: "Input",
  type: "input",
  props: [
    { name: "value", type: "string", required: false },
    { name: "placeholder", type: "string", required: false },
    { name: "disabled", type: "boolean", required: false },
    { name: "type", type: "string", required: false, defaultValue: "text", validValues: ["text", "email", "password"] },
  ],
  states: [
    { name: "focus", description: "Focused state", visualChanges: ["Border color changes"] },
    { name: "error", description: "Error state", visualChanges: ["Red border", "Error message shown"] },
  ],
  events: [
    { name: "onChange", description: "Value change", trigger: "Type in input", expectedBehavior: "onChange receives new value" },
    { name: "onBlur", description: "Blur event", trigger: "Click away", expectedBehavior: "onBlur is called" },
  ],
  accessibility: {
    role: "textbox",
    ariaAttributes: ["aria-invalid", "aria-describedby"],
    keyboardInteractions: ["Tab moves to next field"],
  },
})

// ============================================================================
// Prop Test Generation
// ============================================================================

describe("Prop Test Generation", () => {
  beforeEach(() => {
    resetTestIdCounter()
  })

  describe("generatePropTests", () => {
    it("generates tests for props with default values", () => {
      const spec = createButtonSpec()
      const tests = generatePropTests(spec)

      const defaultTests = tests.filter((t) => t.title.includes("default"))
      expect(defaultTests.length).toBeGreaterThan(0)
    })

    it("generates tests for required props", () => {
      const spec = createButtonSpec()
      const tests = generatePropTests(spec)

      const requiredTest = tests.find((t) => t.title.includes("requires children"))
      expect(requiredTest).toBeDefined()
      expect(requiredTest!.priority).toBe("high")
    })

    it("generates tests for valid values", () => {
      const spec = createButtonSpec()
      const tests = generatePropTests(spec)

      const validValuesTest = tests.find((t) => t.title.includes("accepts valid variant"))
      expect(validValuesTest).toBeDefined()
      expect(validValuesTest!.testData).toEqual(["default", "primary", "destructive"])
    })

    it("generates type validation tests", () => {
      const spec = createButtonSpec()
      const tests = generatePropTests(spec)

      const typeTests = tests.filter((t) => t.title.includes("validates") && t.title.includes("type"))
      expect(typeTests.length).toBeGreaterThan(0)
    })

    it("returns empty array for spec without props", () => {
      const spec: ComponentSpec = { name: "Test", type: "test" }
      const tests = generatePropTests(spec)
      expect(tests).toEqual([])
    })

    it("generates unique test IDs", () => {
      const spec = createButtonSpec()
      const tests = generatePropTests(spec)

      const ids = tests.map((t) => t.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it("marks all prop tests as automatable", () => {
      const spec = createButtonSpec()
      const tests = generatePropTests(spec)

      for (const test of tests) {
        expect(test.automatable).toBe(true)
      }
    })
  })
})

// ============================================================================
// State Test Generation
// ============================================================================

describe("State Test Generation", () => {
  beforeEach(() => {
    resetTestIdCounter()
  })

  describe("generateStateTests", () => {
    it("generates tests for each state", () => {
      const spec = createButtonSpec()
      const tests = generateStateTests(spec)

      const stateNames = ["hover", "focus", "disabled", "loading"]
      for (const stateName of stateNames) {
        const test = tests.find((t) => t.title.includes(stateName))
        expect(test).toBeDefined()
      }
    })

    it("includes visual changes in steps", () => {
      const spec = createButtonSpec()
      const tests = generateStateTests(spec)

      const hoverTest = tests.find((t) => t.title.includes("hover"))
      expect(hoverTest!.steps.some((s) => s.includes("Background darkens"))).toBe(true)
    })

    it("generates state transition test for multiple states", () => {
      const spec = createButtonSpec()
      const tests = generateStateTests(spec)

      const transitionTest = tests.find((t) => t.title === "handles state transitions")
      expect(transitionTest).toBeDefined()
      expect(transitionTest!.category).toBe("integration")
    })

    it("returns empty array for spec without states", () => {
      const spec: ComponentSpec = { name: "Test", type: "test" }
      const tests = generateStateTests(spec)
      expect(tests).toEqual([])
    })

    it("sets high priority for state tests", () => {
      const spec = createButtonSpec()
      const tests = generateStateTests(spec)

      const stateTest = tests.find((t) => t.title.includes("hover"))
      expect(stateTest!.priority).toBe("high")
    })
  })
})

// ============================================================================
// Event Test Generation
// ============================================================================

describe("Event Test Generation", () => {
  beforeEach(() => {
    resetTestIdCounter()
  })

  describe("generateEventTests", () => {
    it("generates tests for each event", () => {
      const spec = createButtonSpec()
      const tests = generateEventTests(spec)

      expect(tests.length).toBe(2)
      expect(tests.some((t) => t.title.includes("onClick"))).toBe(true)
      expect(tests.some((t) => t.title.includes("onFocus"))).toBe(true)
    })

    it("includes trigger in steps", () => {
      const spec = createButtonSpec()
      const tests = generateEventTests(spec)

      const clickTest = tests.find((t) => t.title.includes("onClick"))
      expect(clickTest!.steps).toContain("Click the button")
    })

    it("sets expected behavior as expectedResult", () => {
      const spec = createButtonSpec()
      const tests = generateEventTests(spec)

      const clickTest = tests.find((t) => t.title.includes("onClick"))
      expect(clickTest!.expectedResult).toBe("onClick handler is called")
    })

    it("returns empty array for spec without events", () => {
      const spec: ComponentSpec = { name: "Test", type: "test" }
      const tests = generateEventTests(spec)
      expect(tests).toEqual([])
    })

    it("sets high priority for event tests", () => {
      const spec = createButtonSpec()
      const tests = generateEventTests(spec)

      for (const test of tests) {
        expect(test.priority).toBe("high")
      }
    })
  })
})

// ============================================================================
// Accessibility Test Generation
// ============================================================================

describe("Accessibility Test Generation", () => {
  beforeEach(() => {
    resetTestIdCounter()
  })

  describe("generateAccessibilityTests", () => {
    it("always generates axe audit test", () => {
      const spec = createButtonSpec()
      const tests = generateAccessibilityTests(spec)

      const axeTest = tests.find((t) => t.title.includes("axe accessibility audit"))
      expect(axeTest).toBeDefined()
      expect(axeTest!.priority).toBe("critical")
    })

    it("generates role test when role specified", () => {
      const spec = createButtonSpec()
      const tests = generateAccessibilityTests(spec)

      const roleTest = tests.find((t) => t.title.includes("ARIA role"))
      expect(roleTest).toBeDefined()
      expect(roleTest!.title).toContain("button")
    })

    it("generates ARIA attributes test", () => {
      const spec = createButtonSpec()
      const tests = generateAccessibilityTests(spec)

      const ariaTest = tests.find((t) => t.title.includes("required ARIA attributes"))
      expect(ariaTest).toBeDefined()
      expect(ariaTest!.steps.length).toBe(2) // aria-disabled, aria-busy
    })

    it("generates keyboard navigation test", () => {
      const spec = createButtonSpec()
      const tests = generateAccessibilityTests(spec)

      const keyboardTest = tests.find((t) => t.title.includes("keyboard navigation"))
      expect(keyboardTest).toBeDefined()
      expect(keyboardTest!.steps.some((s) => s.includes("Enter"))).toBe(true)
    })

    it("generates focus indicator test", () => {
      const spec = createButtonSpec()
      const tests = generateAccessibilityTests(spec)

      const focusTest = tests.find((t) => t.title.includes("focus indicator"))
      expect(focusTest).toBeDefined()
      expect(focusTest!.automatable).toBe(false) // Visual check
    })

    it("generates screen reader test", () => {
      const spec = createButtonSpec()
      const tests = generateAccessibilityTests(spec)

      const srTest = tests.find((t) => t.title.includes("screen readers"))
      expect(srTest).toBeDefined()
      expect(srTest!.automatable).toBe(false) // Manual test
    })

    it("sets critical priority for role and ARIA tests", () => {
      const spec = createButtonSpec()
      const tests = generateAccessibilityTests(spec)

      const roleTest = tests.find((t) => t.title.includes("ARIA role"))
      const ariaTest = tests.find((t) => t.title.includes("required ARIA"))
      const keyboardTest = tests.find((t) => t.title.includes("keyboard navigation"))

      expect(roleTest!.priority).toBe("critical")
      expect(ariaTest!.priority).toBe("critical")
      expect(keyboardTest!.priority).toBe("critical")
    })
  })
})

// ============================================================================
// Visual Test Generation
// ============================================================================

describe("Visual Test Generation", () => {
  beforeEach(() => {
    resetTestIdCounter()
  })

  describe("generateVisualTests", () => {
    it("generates default state snapshot test", () => {
      const spec = createButtonSpec()
      const tests = generateVisualTests(spec)

      const defaultTest = tests.find((t) => t.title.includes("default state"))
      expect(defaultTest).toBeDefined()
      expect(defaultTest!.category).toBe("visual")
    })

    it("generates snapshot tests for each state", () => {
      const spec = createButtonSpec()
      const tests = generateVisualTests(spec)

      const stateTests = tests.filter((t) =>
        t.title.includes("snapshot") && !t.title.includes("default")
      )
      expect(stateTests.length).toBe(4) // hover, focus, disabled, loading
    })

    it("generates responsive viewport test", () => {
      const spec = createButtonSpec()
      const tests = generateVisualTests(spec)

      const responsiveTest = tests.find((t) => t.title.includes("viewport sizes"))
      expect(responsiveTest).toBeDefined()
      expect(responsiveTest!.steps).toContain("Render at mobile viewport (375px)")
    })

    it("marks all visual tests as automatable", () => {
      const spec = createButtonSpec()
      const tests = generateVisualTests(spec)

      for (const test of tests) {
        expect(test.automatable).toBe(true)
      }
    })
  })
})

// ============================================================================
// Integration Test Generation
// ============================================================================

describe("Integration Test Generation", () => {
  beforeEach(() => {
    resetTestIdCounter()
  })

  describe("generateIntegrationTests", () => {
    it("generates parent component integration test", () => {
      const spec = createButtonSpec()
      const tests = generateIntegrationTests(spec)

      const parentTest = tests.find((t) => t.title.includes("parent component"))
      expect(parentTest).toBeDefined()
      expect(parentTest!.category).toBe("integration")
    })

    it("generates form context test for input components", () => {
      const spec = createInputSpec()
      const tests = generateIntegrationTests(spec)

      const formTest = tests.find((t) => t.title.includes("form context"))
      expect(formTest).toBeDefined()
      expect(formTest!.priority).toBe("high")
    })

    it("skips form context test for non-input components", () => {
      const spec = createButtonSpec()
      const tests = generateIntegrationTests(spec)

      const formTest = tests.find((t) => t.title.includes("form context"))
      expect(formTest).toBeUndefined()
    })

    it("generates event handler integration test when events exist", () => {
      const spec = createButtonSpec()
      const tests = generateIntegrationTests(spec)

      const eventTest = tests.find((t) => t.title.includes("event handlers integrate"))
      expect(eventTest).toBeDefined()
    })

    it("generates context provider integration test", () => {
      const spec = createButtonSpec()
      const tests = generateIntegrationTests(spec)

      const contextTest = tests.find((t) => t.title.includes("React context"))
      expect(contextTest).toBeDefined()
    })

    it("sets high priority for parent integration test", () => {
      const spec = createButtonSpec()
      const tests = generateIntegrationTests(spec)

      const parentTest = tests.find((t) => t.title.includes("parent"))
      expect(parentTest!.priority).toBe("high")
    })
  })
})

// ============================================================================
// E2E Test Generation
// ============================================================================

describe("E2E Test Generation", () => {
  beforeEach(() => {
    resetTestIdCounter()
  })

  describe("generateE2ETests", () => {
    it("generates user workflow test", () => {
      const spec = createButtonSpec()
      const tests = generateE2ETests(spec)

      const workflowTest = tests.find((t) => t.title.includes("user workflow"))
      expect(workflowTest).toBeDefined()
      expect(workflowTest!.category).toBe("e2e")
    })

    it("generates interaction test when events exist", () => {
      const spec = createButtonSpec()
      const tests = generateE2ETests(spec)

      const interactionTest = tests.find((t) => t.title.includes("user interactions"))
      expect(interactionTest).toBeDefined()
      expect(interactionTest!.steps.some((s) => s.includes("Click"))).toBe(true)
    })

    it("sets longer duration for e2e tests", () => {
      const spec = createButtonSpec()
      const tests = generateE2ETests(spec)

      for (const test of tests) {
        expect(test.estimatedDuration).toBeGreaterThanOrEqual(5)
      }
    })
  })
})

// ============================================================================
// Performance Test Generation
// ============================================================================

describe("Performance Test Generation", () => {
  beforeEach(() => {
    resetTestIdCounter()
  })

  describe("generatePerformanceTests", () => {
    it("generates render performance test", () => {
      const spec = createButtonSpec()
      const tests = generatePerformanceTests(spec)

      const renderTest = tests.find((t) => t.title.includes("performance budget"))
      expect(renderTest).toBeDefined()
      expect(renderTest!.category).toBe("performance")
    })

    it("generates re-render efficiency test", () => {
      const spec = createButtonSpec()
      const tests = generatePerformanceTests(spec)

      const rerenderTest = tests.find((t) => t.title.includes("re-renders"))
      expect(rerenderTest).toBeDefined()
    })

    it("sets appropriate priority for performance tests", () => {
      const spec = createButtonSpec()
      const tests = generatePerformanceTests(spec)

      // Core performance tests are medium priority
      const renderTest = tests.find((t) => t.title.includes("performance budget"))
      const rerenderTest = tests.find((t) => t.title.includes("re-renders"))
      expect(renderTest!.priority).toBe("medium")
      expect(rerenderTest!.priority).toBe("medium")

      // Additional tests (rapid updates, state transitions) are low priority
      const additionalTests = tests.filter((t) =>
        t.title.includes("rapid prop") || t.title.includes("state transitions")
      )
      for (const test of additionalTests) {
        expect(test.priority).toBe("low")
      }
    })
  })
})

// ============================================================================
// Test Plan Generation
// ============================================================================

describe("Test Plan Generation", () => {
  beforeEach(() => {
    resetTestIdCounter()
  })

  describe("generateTestPlan", () => {
    it("generates complete test plan", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec)

      expect(plan.title).toBe("Test Plan: Button")
      expect(plan.componentName).toBe("Button")
      expect(plan.version).toBe("1.0.0")
      expect(plan.generatedAt).toBeInstanceOf(Date)
    })

    it("includes all default test suites", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec)

      const suiteNames = plan.suites.map((s) => s.name)
      expect(suiteNames).toContain("Props")
      expect(suiteNames).toContain("States")
      expect(suiteNames).toContain("Events")
      expect(suiteNames).toContain("Integration")
      expect(suiteNames).toContain("Accessibility")
    })

    it("excludes visual tests by default", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec)

      const hasVisual = plan.suites.some((s) => s.name === "Visual Regression")
      expect(hasVisual).toBe(false)
    })

    it("includes visual tests when configured", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec, { includeVisual: true })

      const hasVisual = plan.suites.some((s) => s.name === "Visual Regression")
      expect(hasVisual).toBe(true)
    })

    it("includes e2e tests when configured", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec, { includeE2E: true })

      const hasE2E = plan.suites.some((s) => s.name === "End-to-End")
      expect(hasE2E).toBe(true)
    })

    it("includes performance tests when configured", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec, { includePerformance: true })

      const hasPerf = plan.suites.some((s) => s.name === "Performance")
      expect(hasPerf).toBe(true)
    })

    it("excludes suites when configured", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec, {
        includeUnit: false,
        includeAccessibility: false,
      })

      const suiteNames = plan.suites.map((s) => s.name)
      expect(suiteNames).not.toContain("Props")
      expect(suiteNames).not.toContain("States")
      expect(suiteNames).not.toContain("Events")
      expect(suiteNames).not.toContain("Accessibility")
    })

    it("filters by minimum priority", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec, { minPriority: "high" })

      const allTests = plan.suites.flatMap((s) => s.testCases)
      const lowPriorityTests = allTests.filter((t) => t.priority === "low")
      expect(lowPriorityTests.length).toBe(0)
    })

    it("calculates summary statistics", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec)

      expect(plan.summary.totalTests).toBeGreaterThan(0)
      expect(plan.summary.automatableTests).toBeGreaterThan(0)
      expect(plan.summary.estimatedDuration).toBeGreaterThan(0)
    })

    it("calculates tests by category", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec)

      expect(plan.summary.byCategory.unit).toBeGreaterThan(0)
      expect(plan.summary.byCategory.integration).toBeGreaterThan(0)
      expect(plan.summary.byCategory.accessibility).toBeGreaterThan(0)
    })

    it("calculates tests by priority", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec)

      expect(plan.summary.byPriority.high).toBeGreaterThan(0)
      expect(plan.summary.byPriority.critical).toBeGreaterThan(0)
    })

    it("includes coverage analysis", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec)

      expect(plan.coverage.coveragePercent).toBeGreaterThan(0)
      expect(plan.coverage.coveredRequirements.length).toBeGreaterThan(0)
    })

    it("provides recommendations", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec)

      // Should recommend e2e and visual tests since not included by default
      expect(plan.coverage.recommendations.length).toBeGreaterThan(0)
    })
  })
})

// ============================================================================
// Markdown Generation
// ============================================================================

describe("Markdown Generation", () => {
  beforeEach(() => {
    resetTestIdCounter()
  })

  describe("toMarkdown", () => {
    it("generates markdown with title", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec)
      const md = toMarkdown(plan)

      expect(md).toContain("# Test Plan: Button")
    })

    it("includes generated timestamp", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec)
      const md = toMarkdown(plan)

      expect(md).toContain("*Generated:")
    })

    it("includes table of contents by default", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec)
      const md = toMarkdown(plan)

      expect(md).toContain("## Table of Contents")
      expect(md).toContain("- [Summary]")
    })

    it("excludes table of contents when disabled", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec)
      const md = toMarkdown(plan, { includeToc: false })

      expect(md).not.toContain("## Table of Contents")
    })

    it("includes summary section by default", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec)
      const md = toMarkdown(plan)

      expect(md).toContain("## Summary")
      expect(md).toContain("| Total Tests |")
    })

    it("includes by category table", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec)
      const md = toMarkdown(plan)

      expect(md).toContain("### By Category")
      expect(md).toContain("| unit |")
    })

    it("includes by priority table", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec)
      const md = toMarkdown(plan)

      expect(md).toContain("### By Priority")
      expect(md).toContain("| high |")
    })

    it("includes coverage analysis by default", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec)
      const md = toMarkdown(plan)

      expect(md).toContain("## Coverage Analysis")
      expect(md).toContain("**Coverage:")
    })

    it("includes covered requirements", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec)
      const md = toMarkdown(plan)

      expect(md).toContain("### Covered Requirements")
      expect(md).toContain("- ✅")
    })

    it("includes recommendations", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec)
      const md = toMarkdown(plan)

      expect(md).toContain("### Recommendations")
      expect(md).toContain("- 💡")
    })

    it("includes test suites", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec)
      const md = toMarkdown(plan)

      expect(md).toContain("## Props")
      expect(md).toContain("## States")
      expect(md).toContain("## Accessibility")
    })

    it("includes test case details", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec)
      const md = toMarkdown(plan)

      expect(md).toContain("*Priority:")
      expect(md).toContain("**Steps:**")
      expect(md).toContain("**Expected Result:**")
    })

    it("includes code templates when requested", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec)
      const md = toMarkdown(plan, { includeCodeTemplates: true })

      expect(md).toContain("**Code Template:**")
      expect(md).toContain("```typescript")
      expect(md).toContain("it(\"")
    })

    it("respects custom heading level", () => {
      const spec = createButtonSpec()
      const plan = generateTestPlan(spec)
      const md = toMarkdown(plan, { headingLevel: 2 })

      expect(md).toContain("## Test Plan: Button")
      expect(md).toContain("### Summary")
    })
  })
})

// ============================================================================
// Spec Extraction from Design Requirements
// ============================================================================

describe("Spec Extraction", () => {
  beforeEach(() => {
    resetTestIdCounter()
  })

  describe("extractSpecFromRequirements", () => {
    it("extracts component name from type", () => {
      const requirements: DesignRequirements = {
        componentType: "button",
        category: "action",
        confidence: 0.9,
        keywords: ["button"],
        originalDescription: "A button",
      }

      const spec = extractSpecFromRequirements(requirements)
      expect(spec.name).toBe("Button")
      expect(spec.type).toBe("button")
    })

    it("extracts variant as prop", () => {
      const requirements: DesignRequirements = {
        componentType: "button",
        category: "action",
        confidence: 0.9,
        keywords: [],
        originalDescription: "A button",
        variant: "primary",
      }

      const spec = extractSpecFromRequirements(requirements)
      const variantProp = spec.props?.find((p) => p.name === "variant")
      expect(variantProp).toBeDefined()
      expect(variantProp!.validValues).toContain("primary")
    })

    it("extracts size as prop", () => {
      const requirements: DesignRequirements = {
        componentType: "button",
        category: "action",
        confidence: 0.9,
        keywords: [],
        originalDescription: "A button",
        size: "lg",
      }

      const spec = extractSpecFromRequirements(requirements)
      const sizeProp = spec.props?.find((p) => p.name === "size")
      expect(sizeProp).toBeDefined()
      expect(sizeProp!.validValues).toContain("lg")
    })

    it("extracts disabled state from interactions", () => {
      const requirements: DesignRequirements = {
        componentType: "button",
        category: "action",
        confidence: 0.9,
        keywords: [],
        originalDescription: "A button",
        interactions: {
          hasDisabledState: true,
        },
      }

      const spec = extractSpecFromRequirements(requirements)
      const disabledState = spec.states?.find((s) => s.name === "disabled")
      expect(disabledState).toBeDefined()
    })

    it("extracts loading state from interactions", () => {
      const requirements: DesignRequirements = {
        componentType: "button",
        category: "action",
        confidence: 0.9,
        keywords: [],
        originalDescription: "A button",
        interactions: {
          hasLoadingState: true,
        },
      }

      const spec = extractSpecFromRequirements(requirements)
      const loadingState = spec.states?.find((s) => s.name === "loading")
      expect(loadingState).toBeDefined()
    })

    it("extracts hover state from interactions", () => {
      const requirements: DesignRequirements = {
        componentType: "button",
        category: "action",
        confidence: 0.9,
        keywords: [],
        originalDescription: "A button",
        interactions: {
          hover: { effect: "scale", intensity: "subtle" },
        },
      }

      const spec = extractSpecFromRequirements(requirements)
      const hoverState = spec.states?.find((s) => s.name === "hover")
      expect(hoverState).toBeDefined()
      expect(hoverState!.description).toContain("scale")
    })

    it("adds default events for component type", () => {
      const requirements: DesignRequirements = {
        componentType: "button",
        category: "action",
        confidence: 0.9,
        keywords: [],
        originalDescription: "A button",
      }

      const spec = extractSpecFromRequirements(requirements)
      const clickEvent = spec.events?.find((e) => e.name === "onClick")
      expect(clickEvent).toBeDefined()
    })

    it("adds default accessibility for component type", () => {
      const requirements: DesignRequirements = {
        componentType: "button",
        category: "action",
        confidence: 0.9,
        keywords: [],
        originalDescription: "A button",
      }

      const spec = extractSpecFromRequirements(requirements)
      expect(spec.accessibility?.role).toBe("button")
      expect(spec.accessibility?.keyboardInteractions).toContain("Enter/Space activates the button")
    })

    it("includes ARIA label from accessibility requirements", () => {
      const requirements: DesignRequirements = {
        componentType: "button",
        category: "action",
        confidence: 0.9,
        keywords: [],
        originalDescription: "A button",
        accessibility: {
          needsAriaLabel: true,
        },
      }

      const spec = extractSpecFromRequirements(requirements)
      expect(spec.accessibility?.ariaAttributes).toContain("aria-label")
    })
  })
})

// ============================================================================
// Integration Tests
// ============================================================================

describe("Integration Tests", () => {
  beforeEach(() => {
    resetTestIdCounter()
  })

  it("generates complete test plan from design requirements", () => {
    const requirements: DesignRequirements = {
      componentType: "button",
      category: "action",
      confidence: 0.95,
      keywords: ["button", "primary", "large"],
      originalDescription: "A large primary button with hover effect",
      variant: "primary",
      size: "lg",
      interactions: {
        hover: { effect: "scale", intensity: "subtle" },
        hasDisabledState: true,
        hasLoadingState: true,
      },
      accessibility: {
        needsAriaLabel: true,
        needsKeyboardSupport: true,
      },
    }

    const spec = extractSpecFromRequirements(requirements)
    const plan = generateTestPlan(spec, {
      includeVisual: true,
      includeE2E: true,
    })
    const markdown = toMarkdown(plan, { includeCodeTemplates: true })

    // Verify plan structure
    expect(plan.suites.length).toBeGreaterThan(5)
    expect(plan.summary.totalTests).toBeGreaterThan(20)

    // Verify markdown output
    expect(markdown).toContain("# Test Plan: Button")
    expect(markdown).toContain("## Accessibility")
    expect(markdown).toContain("## Visual Regression")
    expect(markdown).toContain("## End-to-End")
    expect(markdown).toContain("```typescript")
  })

  it("generates input component test plan", () => {
    const spec = createInputSpec()
    const plan = generateTestPlan(spec, {
      includeAccessibility: true,
    })

    expect(plan.componentName).toBe("Input")
    expect(plan.suites.some((s) => s.name === "Accessibility")).toBe(true)

    const a11ySuite = plan.suites.find((s) => s.name === "Accessibility")
    const roleTest = a11ySuite?.testCases.find((t) => t.title.includes("role"))
    expect(roleTest?.title).toContain("textbox")
  })

  it("produces valid markdown for all configurations", () => {
    const spec = createButtonSpec()

    const configs: TestPlannerConfig[] = [
      {},
      { includeUnit: false },
      { includeAccessibility: false },
      { includeVisual: true, includeE2E: true, includePerformance: true },
      { minPriority: "critical" },
    ]

    for (const config of configs) {
      const plan = generateTestPlan(spec, config)
      const markdown = toMarkdown(plan)

      // Should always have title
      expect(markdown).toContain("# Test Plan")

      // Each suite in the plan should have test cases (empty suites are filtered out)
      for (const suite of plan.suites) {
        expect(suite.testCases.length).toBeGreaterThan(0)
        // Suite name should appear in markdown
        expect(markdown).toContain(`## ${suite.name}`)
      }

      // Should have valid structure
      expect(markdown).toContain("## Summary")
      expect(markdown).toContain("| Metric | Value |")
    }
  })
})
