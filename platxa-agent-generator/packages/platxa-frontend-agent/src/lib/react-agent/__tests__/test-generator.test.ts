/**
 * Test Generator - Unit Tests
 *
 * Tests for converting test plans to executable test code
 */

import { describe, it, expect } from "vitest"
import {
  generateTests,
  generateTestsMultiFramework,
  generateTestFile,
  generateSuiteCode,
  generateTestCaseCode,
  getFrameworkTemplates,
  parseStep,
  parseTestCase,
  type TestFramework,
  type TestGeneratorConfig,
  type ComponentContext,
} from "../test-generator"
import type { TestPlan, TestSuite, TestCase } from "../test-planner"

// ============================================================================
// Test Fixtures
// ============================================================================

const createTestCase = (overrides: Partial<TestCase> = {}): TestCase => ({
  id: "tc-001",
  title: "should render component",
  description: "Test that component renders correctly",
  steps: ["Render the component", "Verify it is visible"],
  expectedResult: "Component should be displayed",
  category: "unit",
  priority: "high",
  automatable: true,
  ...overrides,
})

const createTestSuite = (overrides: Partial<TestSuite> = {}): TestSuite => ({
  name: "Button Rendering",
  description: "Tests for Button rendering",
  category: "unit",
  testCases: [createTestCase()],
  setup: ["Import component"],
  teardown: ["Cleanup"],
  ...overrides,
})

const createTestPlan = (overrides: Partial<TestPlan> = {}): TestPlan => ({
  title: "Button Component Test Plan",
  componentName: "Button",
  description: "Comprehensive test plan for Button component",
  generatedAt: new Date("2024-01-01"),
  version: "1.0.0",
  summary: {
    totalTests: 5,
    byCategory: { unit: 3, integration: 1, e2e: 1, accessibility: 0, visual: 0, performance: 0 },
    byPriority: { critical: 1, high: 2, medium: 1, low: 1 },
    automatableTests: 4,
    manualTests: 1,
    estimatedDuration: 30,
  },
  suites: [createTestSuite()],
  coverage: {
    coveredRequirements: ["rendering", "interaction"],
    uncoveredAreas: [],
    coveragePercent: 80,
    recommendations: [],
  },
  ...overrides,
})

const createComponentContext = (overrides: Partial<ComponentContext> = {}): ComponentContext => ({
  name: "Button",
  importPath: "./Button",
  testId: "button",
  ...overrides,
})

// ============================================================================
// Framework Templates Tests
// ============================================================================

describe("Framework Templates", () => {
  describe("getFrameworkTemplates", () => {
    it("returns Playwright templates", () => {
      const templates = getFrameworkTemplates("playwright")
      expect(templates.header).toContain("@playwright/test")
      expect(templates.testCase).toBeDefined()
      expect(templates.describeBlock).toBeDefined()
    })

    it("returns Cypress templates", () => {
      const templates = getFrameworkTemplates("cypress")
      expect(templates.header).toContain("cypress")
      expect(templates.testCase).toBeDefined()
      expect(templates.describeBlock).toBeDefined()
    })

    it("returns Vitest templates", () => {
      const templates = getFrameworkTemplates("vitest")
      expect(templates.header).toContain("vitest")
      expect(templates.header).toContain("@testing-library/react")
      expect(templates.testCase).toBeDefined()
    })

    it("returns Jest templates", () => {
      const templates = getFrameworkTemplates("jest")
      expect(templates.header).toContain("@testing-library/react")
      expect(templates.header).toContain("@testing-library/jest-dom")
      expect(templates.testCase).toBeDefined()
    })

    it("defaults to Vitest for unknown framework", () => {
      const templates = getFrameworkTemplates("unknown" as TestFramework)
      expect(templates.header).toContain("vitest")
    })
  })

  describe("Playwright templates", () => {
    const templates = getFrameworkTemplates("playwright")

    it("generates async test cases", () => {
      const code = templates.testCase("test title", "    // body")
      expect(code).toContain("async ({ page })")
      expect(code).toContain("test('test title'")
    })

    it("generates describe blocks", () => {
      const code = templates.describeBlock("Suite Name", "  // content")
      expect(code).toContain("test.describe('Suite Name'")
    })

    it("generates click actions", () => {
      const code = templates.actions.click("[data-testid='btn']")
      expect(code).toContain("page.locator")
      expect(code).toContain(".click()")
    })

    it("generates visibility assertions", () => {
      const code = templates.assertions.visible("[data-testid='btn']")
      expect(code).toContain("toBeVisible")
    })

    it("generates text assertions", () => {
      const code = templates.assertions.hasText("[data-testid='btn']", "Click me")
      expect(code).toContain("toHaveText")
      expect(code).toContain("Click me")
    })

    it("generates attribute assertions with value", () => {
      const code = templates.assertions.hasAttribute("[data-testid='btn']", "aria-pressed", "true")
      expect(code).toContain("toHaveAttribute")
      expect(code).toContain("aria-pressed")
      expect(code).toContain("true")
    })

    it("generates attribute assertions without value", () => {
      const code = templates.assertions.hasAttribute("[data-testid='btn']", "disabled")
      expect(code).toContain("toHaveAttribute")
      expect(code).toContain("disabled")
      expect(code).not.toContain("undefined")
    })

    it("generates beforeEach hooks", () => {
      const code = templates.beforeEach!("    // setup")
      expect(code).toContain("test.beforeEach")
      expect(code).toContain("async ({ page })")
    })

    it("generates testId selectors", () => {
      const sel = templates.selectors.byTestId("submit-btn")
      expect(sel).toBe('[data-testid="submit-btn"]')
    })

    it("generates role selectors with name", () => {
      const sel = templates.selectors.byRole("button", { name: "Submit" })
      expect(sel).toContain("role=button")
      expect(sel).toContain("Submit")
    })
  })

  describe("Cypress templates", () => {
    const templates = getFrameworkTemplates("cypress")

    it("generates it() test cases", () => {
      const code = templates.testCase("test title", "    // body")
      expect(code).toContain("it('test title'")
      expect(code).not.toContain("async")
    })

    it("generates cy.get actions", () => {
      const code = templates.actions.click("[data-testid='btn']")
      expect(code).toContain("cy.get")
      expect(code).toContain(".click()")
    })

    it("generates should assertions", () => {
      const code = templates.assertions.visible("[data-testid='btn']")
      expect(code).toContain("should('be.visible')")
    })

    it("generates cy.visit for navigation", () => {
      const code = templates.actions.navigate("/home")
      expect(code).toContain("cy.visit('/home')")
    })

    it("generates before() hook", () => {
      const code = templates.beforeAll!("    // setup")
      expect(code).toContain("before(")
    })
  })

  describe("Vitest/RTL templates", () => {
    const templates = getFrameworkTemplates("vitest")

    it("generates async test cases with userEvent", () => {
      const code = templates.testCase("test title", "    // body")
      expect(code).toContain("async ()")
      expect(code).toContain("userEvent.setup()")
    })

    it("generates screen queries for actions", () => {
      const code = templates.actions.click("submit-btn")
      expect(code).toContain("screen.getByTestId")
      expect(code).toContain("user.click")
    })

    it("generates screen queries for assertions", () => {
      const code = templates.assertions.visible("submit-btn")
      expect(code).toContain("screen.getByTestId")
      expect(code).toContain("toBeVisible")
    })

    it("generates waitFor for async assertions", () => {
      const code = templates.actions.waitFor("loading")
      expect(code).toContain("waitFor")
      expect(code).toContain("toBeInTheDocument")
    })

    it("handles navigation gracefully", () => {
      const code = templates.actions.navigate("/home")
      expect(code).toContain("// Navigation not applicable")
    })
  })
})

// ============================================================================
// Step Parsing Tests
// ============================================================================

describe("Step Parsing", () => {
  const templates = getFrameworkTemplates("playwright")
  const context = createComponentContext()

  describe("parseStep", () => {
    describe("click actions", () => {
      it("parses click step", () => {
        const step = parseStep("Click the button", templates, context)
        expect(step.type).toBe("action")
        expect(step.code).toContain(".click()")
      })

      it("extracts selector from quoted text", () => {
        const step = parseStep("Click on '[data-testid=\"submit\"]'", templates, context)
        expect(step.code).toContain("submit")
      })
    })

    describe("type/fill actions", () => {
      it("parses type step", () => {
        const step = parseStep("Type 'hello world' into the input", templates, context)
        expect(step.type).toBe("action")
        expect(step.code).toContain(".fill(")
        expect(step.code).toContain("hello world")
      })

      it("parses fill step", () => {
        const step = parseStep("Fill the field with 'test'", templates, context)
        expect(step.type).toBe("action")
        expect(step.code).toContain(".fill(")
      })

      it("parses enter step", () => {
        const step = parseStep("Enter 'test@example.com' in the email field", templates, context)
        expect(step.type).toBe("action")
        expect(step.code).toContain(".fill(")
      })

      it("uses default text when not quoted", () => {
        const step = parseStep("Type something into the input", templates, context)
        expect(step.code).toContain("test input")
      })
    })

    describe("focus actions", () => {
      it("parses focus step", () => {
        const step = parseStep("Focus on the input element", templates, context)
        expect(step.type).toBe("action")
        expect(step.code).toContain(".focus()")
      })

      it("parses tab step", () => {
        const step = parseStep("Tab to the next element", templates, context)
        expect(step.type).toBe("action")
        expect(step.code).toContain(".focus()")
      })
    })

    describe("hover actions", () => {
      it("parses hover step", () => {
        const step = parseStep("Hover over the button", templates, context)
        expect(step.type).toBe("action")
        expect(step.code).toContain(".hover()")
      })

      it("parses mouse step", () => {
        const step = parseStep("Mouse over the element", templates, context)
        expect(step.type).toBe("action")
        expect(step.code).toContain(".hover()")
      })
    })

    describe("keyboard actions", () => {
      it("parses press Enter step", () => {
        const step = parseStep("Press Enter", templates, context)
        expect(step.type).toBe("action")
        expect(step.code).toContain("keyboard.press")
        expect(step.code).toContain("Enter")
      })

      it("parses press Escape step", () => {
        const step = parseStep("Press Escape key", templates, context)
        expect(step.code).toContain("Escape")
      })

      it("parses press Tab step", () => {
        const step = parseStep("Press Tab", templates, context)
        expect(step.code).toContain("Tab")
      })

      it("parses arrow keys", () => {
        const stepDown = parseStep("Press arrow down", templates, context)
        expect(stepDown.code).toContain("ArrowDown")

        const stepUp = parseStep("Press arrow up", templates, context)
        expect(stepUp.code).toContain("ArrowUp")
      })
    })

    describe("visibility assertions", () => {
      it("parses visible assertion", () => {
        const step = parseStep("Verify the button is visible", templates, context)
        expect(step.type).toBe("assertion")
        expect(step.code).toContain("toBeVisible")
      })

      it("parses see assertion", () => {
        const step = parseStep("You should see the modal", templates, context)
        expect(step.type).toBe("assertion")
        expect(step.code).toContain("toBeVisible")
      })

      it("parses displayed assertion", () => {
        const step = parseStep("The error message is displayed", templates, context)
        expect(step.type).toBe("assertion")
        expect(step.code).toContain("toBeVisible")
      })
    })

    describe("text assertions", () => {
      it("parses text assertion with quoted text", () => {
        const step = parseStep("Verify text contains 'Hello World'", templates, context)
        expect(step.type).toBe("assertion")
        expect(step.code).toContain("toHaveText")
        expect(step.code).toContain("Hello World")
      })

      it("parses contains assertion", () => {
        const step = parseStep("Element contains 'Submit'", templates, context)
        expect(step.type).toBe("assertion")
        expect(step.code).toContain("toHaveText")
      })
    })

    describe("state assertions", () => {
      it("parses disabled assertion", () => {
        const step = parseStep("Button should be disabled", templates, context)
        expect(step.type).toBe("assertion")
        expect(step.code).toContain("toBeDisabled")
      })

      it("parses enabled assertion", () => {
        const step = parseStep("Button should be enabled", templates, context)
        expect(step.type).toBe("assertion")
        expect(step.code).toContain("toBeEnabled")
      })

      it("parses focused assertion", () => {
        const step = parseStep("Input should be focused", templates, context)
        expect(step.type).toBe("assertion")
        expect(step.code).toContain("toBeFocused")
      })

      it("parses has focus assertion", () => {
        const step = parseStep("Input has focus", templates, context)
        expect(step.type).toBe("assertion")
        expect(step.code).toContain("toBeFocused")
      })
    })

    describe("attribute assertions", () => {
      it("parses aria attribute assertion", () => {
        const step = parseStep("Verify aria-expanded is 'true'", templates, context)
        expect(step.type).toBe("assertion")
        expect(step.code).toContain("toHaveAttribute")
        expect(step.code).toContain("aria-expanded")
      })

      it("parses generic attribute assertion", () => {
        const step = parseStep("Verify attribute type is 'submit'", templates, context)
        expect(step.type).toBe("assertion")
        expect(step.code).toContain("toHaveAttribute")
      })
    })

    describe("class assertions", () => {
      it("parses class assertion", () => {
        const step = parseStep("Element has class 'active'", templates, context)
        expect(step.type).toBe("assertion")
        expect(step.code).toContain("toHaveClass")
        expect(step.code).toContain("active")
      })
    })

    describe("wait actions", () => {
      it("parses wait step", () => {
        const step = parseStep("Wait for the loading spinner", templates, context)
        expect(step.type).toBe("wait")
        expect(step.code).toContain("waitFor")
      })
    })

    describe("navigation actions", () => {
      it("parses navigate step", () => {
        const step = parseStep("Navigate to /home", templates, context)
        expect(step.type).toBe("action")
        expect(step.code).toContain("goto")
        expect(step.code).toContain("/home")
      })

      it("parses visit step", () => {
        const step = parseStep("Visit the dashboard page", templates, context)
        expect(step.type).toBe("action")
        expect(step.code).toContain("goto")
      })

      it("parses go to step with URL", () => {
        const step = parseStep("Go to https://example.com/page", templates, context)
        expect(step.code).toContain("https://example.com/page")
      })
    })

    describe("render actions", () => {
      it("parses render step", () => {
        const step = parseStep("Render the Button component", templates, context)
        expect(step.type).toBe("action")
        expect(step.code).toContain("render(<Button")
      })
    })

    describe("unknown steps", () => {
      it("converts unknown steps to comments", () => {
        const step = parseStep("Do something magical", templates, context)
        expect(step.type).toBe("comment")
        expect(step.code).toContain("// Do something magical")
      })
    })

    describe("selector extraction", () => {
      it("extracts role from step", () => {
        const step = parseStep("Click role=button", templates, context)
        expect(step.code).toContain("role=button")
      })

      it("extracts testid from step", () => {
        const step = parseStep("Click test-id=submit-btn", templates, context)
        expect(step.code).toContain("submit-btn")
      })

      it("uses component testId as default", () => {
        const contextWithTestId = createComponentContext({ testId: "my-button" })
        const step = parseStep("Click the component", templates, contextWithTestId)
        expect(step.code).toContain("my-button")
      })

      it("uses component name when no testId", () => {
        const contextNoTestId = createComponentContext({ testId: undefined })
        const step = parseStep("Click the component", templates, contextNoTestId)
        expect(step.code).toContain("button")
      })
    })
  })
})

// ============================================================================
// Test Case Parsing Tests
// ============================================================================

describe("Test Case Parsing", () => {
  const templates = getFrameworkTemplates("playwright")
  const context = createComponentContext()

  describe("parseTestCase", () => {
    it("parses all steps in a test case", () => {
      const testCase = createTestCase({
        steps: ["Click the button", "Verify it is visible"],
      })
      const parsed = parseTestCase(testCase, templates, context)

      // 2 steps only - no extra assertion added since step 2 is already an assertion
      expect(parsed.steps).toHaveLength(2)
      expect(parsed.steps[0].type).toBe("action")
      expect(parsed.steps[1].type).toBe("assertion")
    })

    it("adds assertion for expected result if none present", () => {
      const testCase = createTestCase({
        steps: ["Click the button"],
        expectedResult: "Button renders correctly",
      })
      const parsed = parseTestCase(testCase, templates, context)

      const assertions = parsed.steps.filter((s) => s.type === "assertion" || s.type === "comment")
      expect(assertions.length).toBeGreaterThan(0)
    })

    it("does not duplicate assertions", () => {
      const testCase = createTestCase({
        steps: ["Verify button is visible"],
        expectedResult: "Button should be visible",
      })
      const parsed = parseTestCase(testCase, templates, context)

      // Should have the original assertion but not duplicate
      const assertions = parsed.steps.filter((s) => s.type === "assertion")
      expect(assertions.length).toBe(1)
    })

    it("preserves original test case", () => {
      const testCase = createTestCase()
      const parsed = parseTestCase(testCase, templates, context)

      expect(parsed.original).toBe(testCase)
    })
  })
})

// ============================================================================
// Test Code Generation Tests
// ============================================================================

describe("Test Code Generation", () => {
  const templates = getFrameworkTemplates("playwright")
  const context = createComponentContext()
  const config: TestGeneratorConfig = {
    framework: "playwright",
    includeComments: true,
    includeSetup: true,
  }

  describe("generateTestCaseCode", () => {
    it("generates test code with comments when enabled", () => {
      const testCase = createTestCase()
      const parsed = parseTestCase(testCase, templates, context)
      const code = generateTestCaseCode(parsed, templates, config)

      expect(code).toContain("// Test that component renders correctly")
      expect(code).toContain("// Priority: high")
    })

    it("generates test code without comments when disabled", () => {
      const configNoComments: TestGeneratorConfig = { ...config, includeComments: false }
      const testCase = createTestCase()
      const parsed = parseTestCase(testCase, templates, context)
      const code = generateTestCaseCode(parsed, templates, configNoComments)

      expect(code).not.toContain("// Test that component renders correctly")
    })

    it("escapes special characters in title", () => {
      const testCase = createTestCase({ title: "it's working with \"quotes\"" })
      const parsed = parseTestCase(testCase, templates, context)
      const code = generateTestCaseCode(parsed, templates, config)

      expect(code).toContain("\\'")
      expect(code).toContain('\\"')
    })
  })

  describe("generateSuiteCode", () => {
    it("generates describe block with test cases", () => {
      const suite = createTestSuite()
      const code = generateSuiteCode(suite, templates, context, config)

      expect(code).toContain("test.describe('Button Rendering'")
      expect(code).toContain("test('should render component'")
    })

    it("includes setup when configured", () => {
      const suite = createTestSuite({ setup: ["Initialize component"] })
      const code = generateSuiteCode(suite, templates, context, config)

      expect(code).toContain("beforeEach")
      expect(code).toContain("// Initialize component")
    })

    it("includes teardown when configured", () => {
      const suite = createTestSuite({ teardown: ["Cleanup resources"] })
      const code = generateSuiteCode(suite, templates, context, config)

      expect(code).toContain("afterEach")
      expect(code).toContain("// Cleanup resources")
    })

    it("filters to automatable tests when configured", () => {
      const suite = createTestSuite({
        testCases: [
          createTestCase({ id: "tc-001", automatable: true, title: "Auto test" }),
          createTestCase({ id: "tc-002", automatable: false, title: "Manual test" }),
        ],
      })
      const configAutoOnly: TestGeneratorConfig = { ...config, automatableOnly: true }
      const code = generateSuiteCode(suite, templates, context, configAutoOnly)

      expect(code).toContain("Auto test")
      expect(code).not.toContain("Manual test")
    })

    it("includes all tests when automatableOnly is false", () => {
      const suite = createTestSuite({
        testCases: [
          createTestCase({ id: "tc-001", automatable: true, title: "Auto test" }),
          createTestCase({ id: "tc-002", automatable: false, title: "Manual test" }),
        ],
      })
      const code = generateSuiteCode(suite, templates, context, config)

      expect(code).toContain("Auto test")
      expect(code).toContain("Manual test")
    })
  })
})

// ============================================================================
// File Generation Tests
// ============================================================================

describe("File Generation", () => {
  describe("generateTestFile", () => {
    it("generates Playwright test file", () => {
      const plan = createTestPlan()
      const config: TestGeneratorConfig = { framework: "playwright" }
      const file = generateTestFile(plan, config)

      expect(file.framework).toBe("playwright")
      expect(file.path).toContain(".spec.ts")
      expect(file.content).toContain("@playwright/test")
    })

    it("generates Cypress test file", () => {
      const plan = createTestPlan()
      const config: TestGeneratorConfig = { framework: "cypress" }
      const file = generateTestFile(plan, config)

      expect(file.framework).toBe("cypress")
      expect(file.path).toContain(".cy.ts")
      expect(file.content).toContain("cypress")
    })

    it("generates Vitest test file", () => {
      const plan = createTestPlan()
      const config: TestGeneratorConfig = { framework: "vitest" }
      const file = generateTestFile(plan, config)

      expect(file.framework).toBe("vitest")
      expect(file.path).toContain(".test.tsx")
      expect(file.content).toContain("vitest")
      expect(file.content).toContain("import { Button }")
    })

    it("generates Jest test file", () => {
      const plan = createTestPlan()
      const config: TestGeneratorConfig = { framework: "jest" }
      const file = generateTestFile(plan, config)

      expect(file.framework).toBe("jest")
      expect(file.path).toContain(".test.tsx")
      expect(file.content).toContain("@testing-library/jest-dom")
    })

    it("uses custom output directory", () => {
      const plan = createTestPlan()
      const config: TestGeneratorConfig = {
        framework: "vitest",
        outputDir: "src/__tests__",
      }
      const file = generateTestFile(plan, config)

      expect(file.path).toBe("src/__tests__/Button.test.tsx")
    })

    it("uses custom component path", () => {
      const plan = createTestPlan()
      const config: TestGeneratorConfig = {
        framework: "vitest",
        componentPath: "@/components/Button",
      }
      const file = generateTestFile(plan, config)

      expect(file.content).toContain("from '@/components/Button'")
    })

    it("includes custom imports", () => {
      const plan = createTestPlan()
      const config: TestGeneratorConfig = {
        framework: "vitest",
        customImports: [
          "import { ThemeProvider } from '@/theme';",
          "import { mockData } from '@/mocks';",
        ],
      }
      const file = generateTestFile(plan, config)

      expect(file.content).toContain("import { ThemeProvider }")
      expect(file.content).toContain("import { mockData }")
    })

    it("generates JavaScript files when typescript is false", () => {
      const plan = createTestPlan()
      const config: TestGeneratorConfig = {
        framework: "vitest",
        typescript: false,
      }
      const file = generateTestFile(plan, config)

      expect(file.path).toContain(".test.jsx")
    })

    it("groups tests by category when configured", () => {
      const plan = createTestPlan({
        suites: [
          createTestSuite({ name: "Unit Tests", category: "unit" }),
          createTestSuite({ name: "A11y Tests", category: "accessibility" }),
        ],
      })
      const config: TestGeneratorConfig = {
        framework: "vitest",
        groupByCategory: true,
      }
      const file = generateTestFile(plan, config)

      expect(file.content).toContain("// UNIT Tests")
      expect(file.content).toContain("// ACCESSIBILITY Tests")
    })

    it("counts tests correctly", () => {
      const plan = createTestPlan({
        suites: [
          createTestSuite({
            testCases: [
              createTestCase({ id: "tc-001" }),
              createTestCase({ id: "tc-002" }),
            ],
          }),
        ],
      })
      const config: TestGeneratorConfig = { framework: "vitest" }
      const file = generateTestFile(plan, config)

      expect(file.testCount).toBe(2)
    })

    it("records categories included", () => {
      const plan = createTestPlan({
        suites: [
          createTestSuite({ category: "unit" }),
          createTestSuite({ category: "integration" }),
        ],
      })
      const config: TestGeneratorConfig = { framework: "vitest" }
      const file = generateTestFile(plan, config)

      expect(file.categories).toContain("unit")
      expect(file.categories).toContain("integration")
    })

    it("filters suites by framework appropriateness", () => {
      const plan = createTestPlan({
        suites: [
          createTestSuite({ name: "Unit Tests", category: "unit" }),
          createTestSuite({ name: "E2E Tests", category: "e2e" }),
        ],
      })

      // Playwright should prefer e2e
      const playwrightFile = generateTestFile(plan, { framework: "playwright" })
      expect(playwrightFile.categories).toContain("e2e")

      // Vitest should prefer unit
      const vitestFile = generateTestFile(plan, { framework: "vitest" })
      expect(vitestFile.categories).toContain("unit")
    })
  })
})

// ============================================================================
// Main Generation Function Tests
// ============================================================================

describe("generateTests", () => {
  it("generates tests successfully", () => {
    const plan = createTestPlan()
    const config: TestGeneratorConfig = { framework: "vitest" }
    const result = generateTests(plan, config)

    expect(result.success).toBe(true)
    expect(result.files).toHaveLength(1)
    expect(result.errors).toHaveLength(0)
  })

  it("returns total test count", () => {
    const plan = createTestPlan({
      suites: [
        createTestSuite({
          testCases: [
            createTestCase({ id: "tc-001" }),
            createTestCase({ id: "tc-002" }),
            createTestCase({ id: "tc-003" }),
          ],
        }),
      ],
    })
    const result = generateTests(plan, { framework: "vitest" })

    expect(result.totalTests).toBe(3)
  })

  it("counts tests by framework", () => {
    const plan = createTestPlan()
    const result = generateTests(plan, { framework: "playwright" })

    expect(result.byFramework.playwright).toBeGreaterThan(0)
    expect(result.byFramework.vitest).toBe(0)
  })

  it("warns when no tests generated", () => {
    const plan = createTestPlan({
      suites: [createTestSuite({ testCases: [] })],
    })
    const result = generateTests(plan, { framework: "vitest" })

    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toContain("No tests generated")
  })

  it("warns about skipped manual tests", () => {
    const plan = createTestPlan({
      suites: [
        createTestSuite({
          testCases: [
            createTestCase({ id: "tc-001", automatable: true }),
            createTestCase({ id: "tc-002", automatable: false }),
          ],
        }),
      ],
    })
    const result = generateTests(plan, { framework: "vitest", automatableOnly: true })

    expect(result.warnings).toContain("1 manual tests were not included")
  })

  it("includes metadata", () => {
    const plan = createTestPlan()
    const result = generateTests(plan, { framework: "vitest" })

    expect(result.metadata.generatedAt).toBeInstanceOf(Date)
    expect(result.metadata.sourceTestPlan).toBe(plan.title)
    expect(result.metadata.duration).toBeGreaterThanOrEqual(0)
  })
})

// ============================================================================
// Multi-Framework Generation Tests
// ============================================================================

describe("generateTestsMultiFramework", () => {
  it("generates tests for multiple frameworks", () => {
    const plan = createTestPlan()
    const result = generateTestsMultiFramework(plan, ["playwright", "vitest"])

    expect(result.files.length).toBe(2)
    expect(result.files.map((f) => f.framework)).toContain("playwright")
    expect(result.files.map((f) => f.framework)).toContain("vitest")
  })

  it("aggregates total tests from all frameworks", () => {
    const plan = createTestPlan()
    const result = generateTestsMultiFramework(plan, ["playwright", "vitest"])

    expect(result.totalTests).toBeGreaterThan(0)
    expect(result.byFramework.playwright).toBeGreaterThan(0)
    expect(result.byFramework.vitest).toBeGreaterThan(0)
  })

  it("aggregates warnings from all frameworks", () => {
    const plan = createTestPlan({
      suites: [createTestSuite({ testCases: [] })],
    })
    const result = generateTestsMultiFramework(plan, ["playwright", "vitest"])

    expect(result.warnings.length).toBeGreaterThanOrEqual(2)
  })

  it("passes base config to all frameworks", () => {
    const plan = createTestPlan()
    const result = generateTestsMultiFramework(plan, ["vitest", "jest"], {
      outputDir: "tests",
      includeComments: true,
    })

    for (const file of result.files) {
      expect(file.path).toContain("tests/")
    }
  })

  it("generates all four framework types", () => {
    const plan = createTestPlan()
    const result = generateTestsMultiFramework(plan, [
      "playwright",
      "cypress",
      "vitest",
      "jest",
    ])

    expect(result.files).toHaveLength(4)
    expect(result.files.map((f) => f.framework).sort()).toEqual([
      "cypress",
      "jest",
      "playwright",
      "vitest",
    ])
  })

  it("records combined duration", () => {
    const plan = createTestPlan()
    const result = generateTestsMultiFramework(plan, ["playwright", "vitest"])

    expect(result.metadata.duration).toBeGreaterThanOrEqual(0)
  })
})

// ============================================================================
// Integration Tests
// ============================================================================

describe("Integration: End-to-End Generation", () => {
  it("generates complete Playwright test file", () => {
    const plan = createTestPlan({
      suites: [
        createTestSuite({
          name: "Button Clicks",
          category: "e2e",
          testCases: [
            createTestCase({
              title: "handles click events",
              steps: [
                "Navigate to /buttons",
                "Click the 'Submit' button",
                "Verify the success message is visible",
              ],
              expectedResult: "Success message appears",
            }),
          ],
        }),
      ],
    })

    const result = generateTests(plan, {
      framework: "playwright",
      baseUrl: "http://localhost:3000",
      includeComments: true,
      includeSetup: true,
    })

    expect(result.success).toBe(true)
    const content = result.files[0].content

    expect(content).toContain("@playwright/test")
    expect(content).toContain("test.describe('Button Clicks'")
    expect(content).toContain("handles click events")
    expect(content).toContain("page.goto")
    expect(content).toContain("click()")
    expect(content).toContain("toBeVisible")
  })

  it("generates complete Vitest test file", () => {
    const plan = createTestPlan({
      suites: [
        createTestSuite({
          name: "Button Rendering",
          category: "unit",
          testCases: [
            createTestCase({
              title: "renders with children",
              steps: [
                "Render the Button with text 'Click me'",
                "Verify text 'Click me' is visible",
              ],
              expectedResult: "Button displays the text",
            }),
          ],
        }),
      ],
    })

    const result = generateTests(plan, {
      framework: "vitest",
      componentPath: "@/components/Button",
      includeComments: true,
    })

    expect(result.success).toBe(true)
    const content = result.files[0].content

    expect(content).toContain("vitest")
    expect(content).toContain("@testing-library/react")
    expect(content).toContain("userEvent")
    expect(content).toContain("import { Button }")
    expect(content).toContain("renders with children")
    expect(content).toContain("render(<Button")
  })

  it("handles complex multi-suite plans", () => {
    const plan = createTestPlan({
      componentName: "Dialog",
      suites: [
        createTestSuite({ name: "Opening", category: "unit", testCases: [
          createTestCase({ id: "tc-1", title: "opens on trigger click" }),
        ]}),
        createTestSuite({ name: "Closing", category: "unit", testCases: [
          createTestCase({ id: "tc-2", title: "closes on overlay click" }),
          createTestCase({ id: "tc-3", title: "closes on escape key" }),
        ]}),
        createTestSuite({ name: "Accessibility", category: "accessibility", testCases: [
          createTestCase({ id: "tc-4", title: "traps focus" }),
        ]}),
      ],
    })

    const result = generateTests(plan, { framework: "vitest" })

    expect(result.success).toBe(true)
    expect(result.totalTests).toBe(4)

    const content = result.files[0].content
    expect(content).toContain("Dialog")
    expect(content).toContain("Opening")
    expect(content).toContain("Closing")
    expect(content).toContain("Accessibility")
  })
})
