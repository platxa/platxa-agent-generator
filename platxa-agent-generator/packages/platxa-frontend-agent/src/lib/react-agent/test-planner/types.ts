/**
 * Test Planner - Type Definitions
 *
 * Types for generating test plans from UI component specifications.
 */

import type { DesignRequirements } from "../design-analyzer"
import type { GeneratedComponent } from "../generators"

/**
 * Test category types
 */
export type TestCategory =
  | "unit"
  | "integration"
  | "e2e"
  | "accessibility"
  | "visual"
  | "performance"

/**
 * Test priority levels
 */
export type TestPriority = "critical" | "high" | "medium" | "low"

/**
 * Individual test case
 */
export interface TestCase {
  /** Unique identifier */
  id: string
  /** Test title */
  title: string
  /** Test description */
  description: string
  /** Test category */
  category: TestCategory
  /** Priority level */
  priority: TestPriority
  /** Steps to execute */
  steps: string[]
  /** Expected result */
  expectedResult: string
  /** Prerequisites */
  prerequisites?: string[]
  /** Related requirements */
  relatedRequirements?: string[]
  /** Estimated duration (minutes) */
  estimatedDuration?: number
  /** Whether test is automatable */
  automatable: boolean
  /** Test data requirements */
  testData?: string[]
}

/**
 * Test suite grouping related tests
 */
export interface TestSuite {
  /** Suite name */
  name: string
  /** Suite description */
  description: string
  /** Test category */
  category: TestCategory
  /** Test cases in this suite */
  testCases: TestCase[]
  /** Setup instructions */
  setup?: string[]
  /** Teardown instructions */
  teardown?: string[]
}

/**
 * Complete test plan
 */
export interface TestPlan {
  /** Plan title */
  title: string
  /** Component being tested */
  componentName: string
  /** Plan description */
  description: string
  /** Generated timestamp */
  generatedAt: Date
  /** Version */
  version: string
  /** Test suites */
  suites: TestSuite[]
  /** Summary statistics */
  summary: TestPlanSummary
  /** Coverage analysis */
  coverage: CoverageAnalysis
}

/**
 * Test plan summary statistics
 */
export interface TestPlanSummary {
  /** Total test cases */
  totalTests: number
  /** Tests by category */
  byCategory: Record<TestCategory, number>
  /** Tests by priority */
  byPriority: Record<TestPriority, number>
  /** Automatable tests count */
  automatableTests: number
  /** Manual tests count */
  manualTests: number
  /** Estimated total duration (minutes) */
  estimatedDuration: number
}

/**
 * Coverage analysis
 */
export interface CoverageAnalysis {
  /** Covered requirements */
  coveredRequirements: string[]
  /** Uncovered areas */
  uncoveredAreas: string[]
  /** Coverage percentage */
  coveragePercent: number
  /** Recommendations */
  recommendations: string[]
}

/**
 * Component specification for test planning
 */
export interface ComponentSpec {
  /** Component name */
  name: string
  /** Component type */
  type: string
  /** Props/API */
  props?: PropSpec[]
  /** States */
  states?: StateSpec[]
  /** Events */
  events?: EventSpec[]
  /** Accessibility requirements */
  accessibility?: AccessibilitySpec
  /** Design requirements */
  designRequirements?: DesignRequirements
  /** Generated component info */
  generatedComponent?: GeneratedComponent
}

/**
 * Prop specification
 */
export interface PropSpec {
  /** Prop name */
  name: string
  /** Prop type */
  type: string
  /** Is required */
  required: boolean
  /** Default value */
  defaultValue?: string
  /** Description */
  description?: string
  /** Valid values */
  validValues?: string[]
}

/**
 * State specification
 */
export interface StateSpec {
  /** State name */
  name: string
  /** State description */
  description: string
  /** Visual changes */
  visualChanges?: string[]
  /** Triggering conditions */
  triggers?: string[]
}

/**
 * Event specification
 */
export interface EventSpec {
  /** Event name */
  name: string
  /** Event description */
  description: string
  /** Trigger action */
  trigger: string
  /** Expected behavior */
  expectedBehavior: string
}

/**
 * Accessibility specification
 */
export interface AccessibilitySpec {
  /** ARIA role */
  role?: string
  /** Required ARIA attributes */
  ariaAttributes?: string[]
  /** Keyboard interactions */
  keyboardInteractions?: string[]
  /** Focus behavior */
  focusBehavior?: string
  /** Screen reader expectations */
  screenReaderExpectations?: string[]
}

/**
 * Test planner configuration
 */
export interface TestPlannerConfig {
  /** Include unit tests */
  includeUnit?: boolean
  /** Include integration tests */
  includeIntegration?: boolean
  /** Include e2e tests */
  includeE2E?: boolean
  /** Include accessibility tests */
  includeAccessibility?: boolean
  /** Include visual tests */
  includeVisual?: boolean
  /** Include performance tests */
  includePerformance?: boolean
  /** Minimum priority to include */
  minPriority?: TestPriority
  /** Output format */
  outputFormat?: "markdown" | "json" | "html"
  /** Include test code templates */
  includeCodeTemplates?: boolean
}

/**
 * Markdown output options
 */
export interface MarkdownOptions {
  /** Include table of contents */
  includeToc?: boolean
  /** Include summary section */
  includeSummary?: boolean
  /** Include coverage analysis */
  includeCoverage?: boolean
  /** Include code templates */
  includeCodeTemplates?: boolean
  /** Section heading level (1-6) */
  headingLevel?: number
}
