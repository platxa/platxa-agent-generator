/**
 * Test Generator - Type Definitions
 *
 * Types for generating executable test code from test plans.
 */

import type { TestCategory, TestCase } from "../test-planner"

/**
 * Supported test frameworks
 */
export type TestFramework =
  | "playwright"
  | "cypress"
  | "vitest"
  | "jest"

/**
 * Test runner/assertion library pairing
 */
export type TestRunner =
  | "playwright-test"
  | "cypress"
  | "vitest-rtl"
  | "jest-rtl"

/**
 * Generated test file
 */
export interface GeneratedTestFile {
  /** File path (relative) */
  path: string
  /** File content */
  content: string
  /** Test framework */
  framework: TestFramework
  /** Number of test cases */
  testCount: number
  /** Test categories included */
  categories: TestCategory[]
}

/**
 * Test generation result
 */
export interface TestGenerationResult {
  /** Whether generation succeeded */
  success: boolean
  /** Generated test files */
  files: GeneratedTestFile[]
  /** Total tests generated */
  totalTests: number
  /** Tests by framework */
  byFramework: Record<TestFramework, number>
  /** Generation warnings */
  warnings: string[]
  /** Generation errors */
  errors: string[]
  /** Metadata */
  metadata: {
    generatedAt: Date
    sourceTestPlan: string
    duration: number
  }
}

/**
 * Test generator configuration
 */
export interface TestGeneratorConfig {
  /** Target framework */
  framework: TestFramework
  /** Component import path */
  componentPath?: string
  /** Test file output directory */
  outputDir?: string
  /** Include setup/teardown */
  includeSetup?: boolean
  /** Include comments */
  includeComments?: boolean
  /** Group tests by category */
  groupByCategory?: boolean
  /** Generate only automatable tests */
  automatableOnly?: boolean
  /** TypeScript mode */
  typescript?: boolean
  /** Base URL for e2e tests */
  baseUrl?: string
  /** Custom imports to add */
  customImports?: string[]
  /** Test timeout (ms) */
  timeout?: number
}

/**
 * Framework-specific code templates
 */
export interface FrameworkTemplates {
  /** File header/imports */
  header: string
  /** Describe block wrapper */
  describeBlock: (name: string, content: string) => string
  /** Individual test */
  testCase: (title: string, body: string) => string
  /** BeforeEach hook */
  beforeEach?: (body: string) => string
  /** AfterEach hook */
  afterEach?: (body: string) => string
  /** BeforeAll hook */
  beforeAll?: (body: string) => string
  /** AfterAll hook */
  afterAll?: (body: string) => string
  /** Assertion helpers */
  assertions: AssertionTemplates
  /** Action helpers */
  actions: ActionTemplates
  /** Selector helpers */
  selectors: SelectorTemplates
}

/**
 * Assertion code templates
 */
export interface AssertionTemplates {
  /** Element exists */
  exists: (selector: string) => string
  /** Element visible */
  visible: (selector: string) => string
  /** Element has text */
  hasText: (selector: string, text: string) => string
  /** Element has attribute */
  hasAttribute: (selector: string, attr: string, value?: string) => string
  /** Element has class */
  hasClass: (selector: string, className: string) => string
  /** Element is disabled */
  isDisabled: (selector: string) => string
  /** Element is enabled */
  isEnabled: (selector: string) => string
  /** Element is focused */
  isFocused: (selector: string) => string
  /** Element count */
  hasCount: (selector: string, count: number) => string
  /** Custom assertion */
  custom: (code: string) => string
}

/**
 * Action code templates
 */
export interface ActionTemplates {
  /** Click element */
  click: (selector: string) => string
  /** Type text */
  type: (selector: string, text: string) => string
  /** Clear input */
  clear: (selector: string) => string
  /** Focus element */
  focus: (selector: string) => string
  /** Blur element */
  blur: (selector: string) => string
  /** Press key */
  pressKey: (key: string) => string
  /** Hover element */
  hover: (selector: string) => string
  /** Select option */
  select: (selector: string, value: string) => string
  /** Check checkbox */
  check: (selector: string) => string
  /** Uncheck checkbox */
  uncheck: (selector: string) => string
  /** Wait for element */
  waitFor: (selector: string) => string
  /** Navigate to URL */
  navigate: (url: string) => string
  /** Custom action */
  custom: (code: string) => string
}

/**
 * Selector generation templates
 */
export interface SelectorTemplates {
  /** By test ID */
  byTestId: (id: string) => string
  /** By role */
  byRole: (role: string, options?: { name?: string }) => string
  /** By text */
  byText: (text: string) => string
  /** By label */
  byLabel: (label: string) => string
  /** By placeholder */
  byPlaceholder: (placeholder: string) => string
  /** By CSS selector */
  byCss: (selector: string) => string
}

/**
 * Test step for code generation
 */
export interface TestStep {
  /** Step type */
  type: "action" | "assertion" | "wait" | "comment"
  /** Step description */
  description: string
  /** Generated code */
  code: string
}

/**
 * Parsed test case ready for code generation
 */
export interface ParsedTestCase {
  /** Original test case */
  original: TestCase
  /** Parsed steps */
  steps: TestStep[]
  /** Setup code */
  setup?: string
  /** Teardown code */
  teardown?: string
}

/**
 * Component context for test generation
 */
export interface ComponentContext {
  /** Component name */
  name: string
  /** Component import path */
  importPath: string
  /** Available props */
  props?: string[]
  /** Available variants */
  variants?: string[]
  /** Default test ID */
  testId?: string
}
