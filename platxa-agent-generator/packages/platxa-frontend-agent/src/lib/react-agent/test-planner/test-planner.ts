/**
 * Test Planner
 *
 * Generates comprehensive test plans from UI component specifications.
 * Produces Markdown test plans covering unit, integration, e2e, and
 * accessibility testing scenarios.
 */

import type {
  TestPlan,
  TestSuite,
  TestCase,
  TestCategory,
  TestPriority,
  TestPlanSummary,
  CoverageAnalysis,
  ComponentSpec,
  EventSpec,
  TestPlannerConfig,
  MarkdownOptions,
} from "./types"

import type { DesignRequirements } from "../design-analyzer"
import type { GeneratedComponent } from "../generators"

// ============================================================================
// ID Generation
// ============================================================================

let testIdCounter = 0

/**
 * Generates a unique test case ID
 */
function generateTestId(category: TestCategory): string {
  testIdCounter++
  const prefix = category.toUpperCase().substring(0, 3)
  return `${prefix}-${String(testIdCounter).padStart(3, "0")}`
}

/**
 * Resets the test ID counter (useful for testing)
 */
export function resetTestIdCounter(): void {
  testIdCounter = 0
}

// ============================================================================
// Test Case Generators
// ============================================================================

/**
 * Generates unit test cases for component props
 */
export function generatePropTests(spec: ComponentSpec): TestCase[] {
  const tests: TestCase[] = []

  if (!spec.props || spec.props.length === 0) {
    return tests
  }

  for (const prop of spec.props) {
    // Test default value
    if (prop.defaultValue !== undefined) {
      tests.push({
        id: generateTestId("unit"),
        title: `renders with default ${prop.name}`,
        description: `Verify component renders correctly with default ${prop.name} value`,
        category: "unit",
        priority: prop.required ? "high" : "medium",
        steps: [
          `Render component without passing ${prop.name} prop`,
          `Verify component uses default value: ${prop.defaultValue}`,
        ],
        expectedResult: `Component renders with ${prop.name} = ${prop.defaultValue}`,
        automatable: true,
        estimatedDuration: 1,
      })
    }

    // Test required prop
    if (prop.required) {
      tests.push({
        id: generateTestId("unit"),
        title: `requires ${prop.name} prop`,
        description: `Verify component handles required ${prop.name} prop correctly`,
        category: "unit",
        priority: "high",
        steps: [
          `Render component with valid ${prop.name}`,
          `Verify component renders without errors`,
        ],
        expectedResult: `Component renders successfully with ${prop.name}`,
        automatable: true,
        estimatedDuration: 1,
      })
    }

    // Test valid values if specified
    if (prop.validValues && prop.validValues.length > 0) {
      tests.push({
        id: generateTestId("unit"),
        title: `accepts valid ${prop.name} values`,
        description: `Verify component accepts all valid ${prop.name} values`,
        category: "unit",
        priority: "medium",
        steps: prop.validValues.map(
          (v) => `Render component with ${prop.name}="${v}"`
        ),
        expectedResult: `Component renders correctly for all valid values: ${prop.validValues.join(", ")}`,
        automatable: true,
        testData: prop.validValues,
        estimatedDuration: 2,
      })
    }

    // Test type validation
    tests.push({
      id: generateTestId("unit"),
      title: `validates ${prop.name} type (${prop.type})`,
      description: `Verify ${prop.name} prop accepts correct type`,
      category: "unit",
      priority: "medium",
      steps: [
        `Pass valid ${prop.type} value to ${prop.name}`,
        `Verify no type errors or warnings`,
      ],
      expectedResult: `Component accepts ${prop.type} for ${prop.name}`,
      automatable: true,
      estimatedDuration: 1,
    })
  }

  return tests
}

/**
 * Generates test cases for component states
 */
export function generateStateTests(spec: ComponentSpec): TestCase[] {
  const tests: TestCase[] = []

  if (!spec.states || spec.states.length === 0) {
    return tests
  }

  for (const state of spec.states) {
    tests.push({
      id: generateTestId("unit"),
      title: `handles ${state.name} state`,
      description: state.description,
      category: "unit",
      priority: "high",
      steps: [
        ...(state.triggers || [`Trigger ${state.name} state`]),
        `Verify component enters ${state.name} state`,
        ...(state.visualChanges || []).map((v) => `Verify: ${v}`),
      ],
      expectedResult: `Component displays ${state.name} state correctly`,
      automatable: true,
      estimatedDuration: 2,
    })
  }

  // Add state transition tests
  if (spec.states.length > 1) {
    tests.push({
      id: generateTestId("integration"),
      title: "handles state transitions",
      description: "Verify component transitions between states correctly",
      category: "integration",
      priority: "high",
      steps: spec.states.map(
        (s) => `Transition to ${s.name} state and verify`
      ),
      expectedResult: "All state transitions work correctly",
      automatable: true,
      estimatedDuration: 3,
    })
  }

  return tests
}

/**
 * Generates test cases for component events
 */
export function generateEventTests(spec: ComponentSpec): TestCase[] {
  const tests: TestCase[] = []

  if (!spec.events || spec.events.length === 0) {
    return tests
  }

  for (const event of spec.events) {
    tests.push({
      id: generateTestId("unit"),
      title: `fires ${event.name} event`,
      description: event.description,
      category: "unit",
      priority: "high",
      steps: [
        `Set up ${event.name} event handler`,
        event.trigger,
        `Verify ${event.name} handler is called`,
      ],
      expectedResult: event.expectedBehavior,
      automatable: true,
      estimatedDuration: 2,
    })
  }

  return tests
}

/**
 * Generates accessibility test cases
 */
export function generateAccessibilityTests(spec: ComponentSpec): TestCase[] {
  const tests: TestCase[] = []
  const a11y = spec.accessibility

  // Basic accessibility test
  tests.push({
    id: generateTestId("accessibility"),
    title: "passes axe accessibility audit",
    description: "Verify component passes automated accessibility checks",
    category: "accessibility",
    priority: "critical",
    steps: [
      "Render component with default props",
      "Run axe-core accessibility audit",
      "Verify no violations reported",
    ],
    expectedResult: "No accessibility violations detected",
    automatable: true,
    estimatedDuration: 2,
  })

  if (a11y?.role) {
    tests.push({
      id: generateTestId("accessibility"),
      title: `has correct ARIA role (${a11y.role})`,
      description: `Verify component has role="${a11y.role}"`,
      category: "accessibility",
      priority: "critical",
      steps: [
        "Render component",
        `Verify element has role="${a11y.role}"`,
      ],
      expectedResult: `Element has role="${a11y.role}"`,
      automatable: true,
      estimatedDuration: 1,
    })
  }

  if (a11y?.ariaAttributes && a11y.ariaAttributes.length > 0) {
    tests.push({
      id: generateTestId("accessibility"),
      title: "has required ARIA attributes",
      description: "Verify all required ARIA attributes are present",
      category: "accessibility",
      priority: "critical",
      steps: a11y.ariaAttributes.map(
        (attr) => `Verify ${attr} attribute is present`
      ),
      expectedResult: `All ARIA attributes present: ${a11y.ariaAttributes.join(", ")}`,
      automatable: true,
      estimatedDuration: 2,
    })
  }

  if (a11y?.keyboardInteractions && a11y.keyboardInteractions.length > 0) {
    tests.push({
      id: generateTestId("accessibility"),
      title: "supports keyboard navigation",
      description: "Verify component is fully keyboard accessible",
      category: "accessibility",
      priority: "critical",
      steps: [
        "Focus the component using Tab key",
        ...a11y.keyboardInteractions.map((k) => `Test: ${k}`),
      ],
      expectedResult: "All keyboard interactions work correctly",
      automatable: true,
      estimatedDuration: 3,
    })
  }

  if (a11y?.focusBehavior) {
    tests.push({
      id: generateTestId("accessibility"),
      title: "has visible focus indicator",
      description: "Verify focus state is clearly visible",
      category: "accessibility",
      priority: "high",
      steps: [
        "Tab to focus the component",
        "Verify focus ring is visible",
        a11y.focusBehavior,
      ],
      expectedResult: "Focus indicator meets WCAG 2.2 requirements",
      automatable: false,
      estimatedDuration: 2,
    })
  }

  if (a11y?.screenReaderExpectations && a11y.screenReaderExpectations.length > 0) {
    tests.push({
      id: generateTestId("accessibility"),
      title: "announces correctly to screen readers",
      description: "Verify screen reader announcements",
      category: "accessibility",
      priority: "high",
      steps: [
        "Enable screen reader (VoiceOver/NVDA)",
        "Navigate to component",
        ...a11y.screenReaderExpectations.map((e) => `Verify: ${e}`),
      ],
      expectedResult: "Screen reader announces component correctly",
      automatable: false,
      estimatedDuration: 5,
    })
  }

  return tests
}

/**
 * Generates visual regression test cases
 */
export function generateVisualTests(spec: ComponentSpec): TestCase[] {
  const tests: TestCase[] = []

  tests.push({
    id: generateTestId("visual"),
    title: "matches visual snapshot (default state)",
    description: "Verify component appearance matches baseline",
    category: "visual",
    priority: "medium",
    steps: [
      "Render component with default props",
      "Capture screenshot",
      "Compare against baseline snapshot",
    ],
    expectedResult: "No visual differences from baseline",
    automatable: true,
    estimatedDuration: 2,
  })

  // Visual tests for each state
  if (spec.states) {
    for (const state of spec.states) {
      tests.push({
        id: generateTestId("visual"),
        title: `matches visual snapshot (${state.name} state)`,
        description: `Verify ${state.name} state appearance`,
        category: "visual",
        priority: "medium",
        steps: [
          `Render component in ${state.name} state`,
          "Capture screenshot",
          "Compare against baseline snapshot",
        ],
        expectedResult: `${state.name} state matches baseline`,
        automatable: true,
        estimatedDuration: 2,
      })
    }
  }

  // Responsive visual tests
  tests.push({
    id: generateTestId("visual"),
    title: "renders correctly at different viewport sizes",
    description: "Verify responsive behavior",
    category: "visual",
    priority: "medium",
    steps: [
      "Render at mobile viewport (375px)",
      "Render at tablet viewport (768px)",
      "Render at desktop viewport (1280px)",
      "Compare all against baselines",
    ],
    expectedResult: "Component renders correctly at all viewport sizes",
    automatable: true,
    estimatedDuration: 5,
  })

  return tests
}

/**
 * Generates integration test cases
 */
export function generateIntegrationTests(spec: ComponentSpec): TestCase[] {
  const tests: TestCase[] = []

  tests.push({
    id: generateTestId("integration"),
    title: `${spec.name} integrates with parent component`,
    description: `Verify ${spec.name} works within parent context`,
    category: "integration",
    priority: "high",
    steps: [
      `Render ${spec.name} inside parent container`,
      "Verify proper styling inheritance",
      "Verify event bubbling works correctly",
    ],
    expectedResult: `${spec.name} integrates correctly with parent`,
    automatable: true,
    estimatedDuration: 3,
  })

  // Add form context test for input-type components
  const inputTypes = ["input", "checkbox", "radio", "select", "switch", "slider", "textarea"]
  if (inputTypes.includes(spec.type)) {
    tests.push({
      id: generateTestId("integration"),
      title: `${spec.name} works with form context`,
      description: `Verify ${spec.name} works in form scenarios`,
      category: "integration",
      priority: "high",
      steps: [
        `Render ${spec.name} inside a form`,
        "Submit the form",
        `Verify ${spec.name} value is included in form data`,
      ],
      expectedResult: `${spec.name} participates in form submission`,
      automatable: true,
      estimatedDuration: 3,
    })
  }

  // Add event handler integration tests if component has events
  if (spec.events && spec.events.length > 0) {
    tests.push({
      id: generateTestId("integration"),
      title: `${spec.name} event handlers integrate with parent`,
      description: "Verify event handlers work when component is nested",
      category: "integration",
      priority: "high",
      steps: [
        `Render ${spec.name} with event handlers from parent`,
        ...spec.events.slice(0, 3).map((e) => `Trigger ${e.name} event`),
        "Verify parent handlers receive events",
      ],
      expectedResult: "All event handlers work correctly in nested context",
      automatable: true,
      estimatedDuration: 4,
    })
  }

  // Add context provider integration test
  tests.push({
    id: generateTestId("integration"),
    title: `${spec.name} works with React context`,
    description: `Verify ${spec.name} consumes context correctly`,
    category: "integration",
    priority: "medium",
    steps: [
      "Wrap component in theme/config context provider",
      `Render ${spec.name}`,
      "Verify component responds to context values",
    ],
    expectedResult: `${spec.name} correctly consumes context values`,
    automatable: true,
    estimatedDuration: 3,
  })

  return tests
}

/**
 * Generates e2e test cases
 */
export function generateE2ETests(spec: ComponentSpec): TestCase[] {
  const tests: TestCase[] = []

  tests.push({
    id: generateTestId("e2e"),
    title: "completes user workflow",
    description: "Verify component in realistic user scenario",
    category: "e2e",
    priority: "high",
    steps: [
      "Navigate to page containing component",
      "Interact with component as user would",
      "Verify expected outcome",
    ],
    expectedResult: "User can complete intended workflow",
    automatable: true,
    estimatedDuration: 5,
  })

  if (spec.events && spec.events.length > 0) {
    tests.push({
      id: generateTestId("e2e"),
      title: "handles user interactions end-to-end",
      description: "Verify all user interactions work in production-like environment",
      category: "e2e",
      priority: "high",
      steps: [
        "Load application in browser",
        ...spec.events.map((e) => `Perform: ${e.trigger}`),
        "Verify all interactions complete successfully",
      ],
      expectedResult: "All user interactions work correctly",
      automatable: true,
      estimatedDuration: 10,
    })
  }

  return tests
}

/**
 * Generates performance test cases
 */
export function generatePerformanceTests(spec: ComponentSpec): TestCase[] {
  const tests: TestCase[] = []

  tests.push({
    id: generateTestId("performance"),
    title: `${spec.name} renders within performance budget`,
    description: `Verify ${spec.name} component renders quickly`,
    category: "performance",
    priority: "medium",
    steps: [
      `Render ${spec.name} with default props`,
      "Measure initial render time",
      "Verify render time < 16ms (60fps budget)",
    ],
    expectedResult: `${spec.name} renders within 16ms`,
    automatable: true,
    estimatedDuration: 2,
  })

  tests.push({
    id: generateTestId("performance"),
    title: `${spec.name} re-renders efficiently`,
    description: `Verify ${spec.name} doesn't have unnecessary re-renders`,
    category: "performance",
    priority: "medium",
    steps: [
      `Render ${spec.name} with React Profiler`,
      "Trigger prop change",
      "Verify minimal re-renders occur",
    ],
    expectedResult: "No unnecessary re-renders detected",
    automatable: true,
    estimatedDuration: 3,
  })

  // Add prop update performance test if component has many props
  if (spec.props && spec.props.length > 3) {
    tests.push({
      id: generateTestId("performance"),
      title: `${spec.name} handles rapid prop updates`,
      description: "Verify component handles frequent prop changes efficiently",
      category: "performance",
      priority: "low",
      steps: [
        `Render ${spec.name}`,
        "Rapidly update props in sequence",
        "Measure average update time",
      ],
      expectedResult: "Prop updates complete without frame drops",
      automatable: true,
      estimatedDuration: 3,
    })
  }

  // Add state transition performance test if component has states
  if (spec.states && spec.states.length > 2) {
    tests.push({
      id: generateTestId("performance"),
      title: `${spec.name} state transitions are performant`,
      description: "Verify state transitions don't cause jank",
      category: "performance",
      priority: "low",
      steps: [
        `Render ${spec.name}`,
        `Cycle through states: ${spec.states.map((s) => s.name).join(" → ")}`,
        "Measure transition times",
      ],
      expectedResult: "All state transitions complete smoothly",
      automatable: true,
      estimatedDuration: 4,
    })
  }

  return tests
}

// ============================================================================
// Test Plan Generation
// ============================================================================

/**
 * Generates a complete test plan from component specification
 */
export function generateTestPlan(
  spec: ComponentSpec,
  config: TestPlannerConfig = {}
): TestPlan {
  resetTestIdCounter()

  const suites: TestSuite[] = []

  // Unit tests for props
  if (config.includeUnit !== false && spec.props && spec.props.length > 0) {
    suites.push({
      name: "Props",
      description: "Tests for component props and their handling",
      category: "unit",
      testCases: generatePropTests(spec),
    })
  }

  // Unit tests for states
  if (config.includeUnit !== false && spec.states && spec.states.length > 0) {
    suites.push({
      name: "States",
      description: "Tests for component state handling",
      category: "unit",
      testCases: generateStateTests(spec),
    })
  }

  // Unit tests for events
  if (config.includeUnit !== false && spec.events && spec.events.length > 0) {
    suites.push({
      name: "Events",
      description: "Tests for component event handling",
      category: "unit",
      testCases: generateEventTests(spec),
    })
  }

  // Integration tests
  if (config.includeIntegration !== false) {
    suites.push({
      name: "Integration",
      description: "Tests for component integration scenarios",
      category: "integration",
      testCases: generateIntegrationTests(spec),
    })
  }

  // Accessibility tests
  if (config.includeAccessibility !== false) {
    suites.push({
      name: "Accessibility",
      description: "Tests for WCAG 2.2 compliance",
      category: "accessibility",
      testCases: generateAccessibilityTests(spec),
      setup: ["Import axe-core or similar a11y testing library"],
    })
  }

  // Visual tests
  if (config.includeVisual === true) {
    suites.push({
      name: "Visual Regression",
      description: "Visual snapshot tests",
      category: "visual",
      testCases: generateVisualTests(spec),
      setup: ["Configure visual regression testing tool (Percy, Chromatic, etc.)"],
    })
  }

  // E2E tests
  if (config.includeE2E === true) {
    suites.push({
      name: "End-to-End",
      description: "Full user workflow tests",
      category: "e2e",
      testCases: generateE2ETests(spec),
      setup: ["Configure Playwright or Cypress"],
    })
  }

  // Performance tests
  if (config.includePerformance === true) {
    suites.push({
      name: "Performance",
      description: "Performance and optimization tests",
      category: "performance",
      testCases: generatePerformanceTests(spec),
    })
  }

  // Filter by priority if specified
  if (config.minPriority) {
    const priorityOrder: TestPriority[] = ["critical", "high", "medium", "low"]
    const minIndex = priorityOrder.indexOf(config.minPriority)

    for (const suite of suites) {
      suite.testCases = suite.testCases.filter(
        (tc) => priorityOrder.indexOf(tc.priority) <= minIndex
      )
    }
  }

  // Remove empty suites
  const filteredSuites = suites.filter((s) => s.testCases.length > 0)

  const summary = calculateSummary(filteredSuites)
  const coverage = analyzeCoverage(spec, filteredSuites)

  return {
    title: `Test Plan: ${spec.name}`,
    componentName: spec.name,
    description: `Comprehensive test plan for the ${spec.name} component`,
    generatedAt: new Date(),
    version: "1.0.0",
    suites: filteredSuites,
    summary,
    coverage,
  }
}

/**
 * Calculates test plan summary statistics
 */
function calculateSummary(suites: TestSuite[]): TestPlanSummary {
  const allTests = suites.flatMap((s) => s.testCases)

  const byCategory: Record<TestCategory, number> = {
    unit: 0,
    integration: 0,
    e2e: 0,
    accessibility: 0,
    visual: 0,
    performance: 0,
  }

  const byPriority: Record<TestPriority, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  }

  let automatableTests = 0
  let estimatedDuration = 0

  for (const test of allTests) {
    byCategory[test.category]++
    byPriority[test.priority]++
    if (test.automatable) automatableTests++
    estimatedDuration += test.estimatedDuration || 0
  }

  return {
    totalTests: allTests.length,
    byCategory,
    byPriority,
    automatableTests,
    manualTests: allTests.length - automatableTests,
    estimatedDuration,
  }
}

/**
 * Analyzes test coverage
 */
function analyzeCoverage(
  spec: ComponentSpec,
  suites: TestSuite[]
): CoverageAnalysis {
  const coveredRequirements: string[] = []
  const uncoveredAreas: string[] = []
  const recommendations: string[] = []

  // Check prop coverage
  if (spec.props && spec.props.length > 0) {
    const testedProps = new Set<string>()
    for (const suite of suites) {
      for (const test of suite.testCases) {
        for (const prop of spec.props) {
          if (test.title.includes(prop.name)) {
            testedProps.add(prop.name)
          }
        }
      }
    }

    for (const prop of spec.props) {
      if (testedProps.has(prop.name)) {
        coveredRequirements.push(`Prop: ${prop.name}`)
      } else {
        uncoveredAreas.push(`Prop: ${prop.name} - no dedicated tests`)
      }
    }
  }

  // Check state coverage
  if (spec.states && spec.states.length > 0) {
    coveredRequirements.push(`States: ${spec.states.map((s) => s.name).join(", ")}`)
  }

  // Check event coverage
  if (spec.events && spec.events.length > 0) {
    coveredRequirements.push(`Events: ${spec.events.map((e) => e.name).join(", ")}`)
  }

  // Check accessibility coverage
  if (spec.accessibility) {
    coveredRequirements.push("Accessibility requirements")
  } else {
    uncoveredAreas.push("No accessibility spec provided")
    recommendations.push("Add accessibility specification for comprehensive a11y testing")
  }

  // General recommendations
  const summary = calculateSummary(suites)

  if (summary.byCategory.e2e === 0) {
    recommendations.push("Consider adding E2E tests for critical user flows")
  }

  if (summary.byCategory.visual === 0) {
    recommendations.push("Consider adding visual regression tests to catch UI changes")
  }

  if (summary.manualTests > summary.automatableTests) {
    recommendations.push("Review manual tests for automation opportunities")
  }

  const totalItems =
    (spec.props?.length || 0) +
    (spec.states?.length || 0) +
    (spec.events?.length || 0) +
    (spec.accessibility ? 1 : 0)

  const coveragePercent = totalItems > 0
    ? Math.round((coveredRequirements.length / totalItems) * 100)
    : 100

  return {
    coveredRequirements,
    uncoveredAreas,
    coveragePercent,
    recommendations,
  }
}

// ============================================================================
// Markdown Generation
// ============================================================================

/**
 * Converts test plan to Markdown format
 */
export function toMarkdown(
  plan: TestPlan,
  options: MarkdownOptions = {}
): string {
  const {
    includeToc = true,
    includeSummary = true,
    includeCoverage = true,
    includeCodeTemplates = false,
    headingLevel = 1,
  } = options

  const h = (level: number) => "#".repeat(headingLevel + level - 1)
  const lines: string[] = []

  // Title
  lines.push(`${h(1)} ${plan.title}`)
  lines.push("")
  lines.push(`*Generated: ${plan.generatedAt.toISOString()}*`)
  lines.push(`*Version: ${plan.version}*`)
  lines.push("")
  lines.push(plan.description)
  lines.push("")

  // Table of Contents
  if (includeToc) {
    lines.push(`${h(2)} Table of Contents`)
    lines.push("")
    if (includeSummary) lines.push("- [Summary](#summary)")
    if (includeCoverage) lines.push("- [Coverage Analysis](#coverage-analysis)")
    for (const suite of plan.suites) {
      const anchor = suite.name.toLowerCase().replace(/\s+/g, "-")
      lines.push(`- [${suite.name}](#${anchor})`)
    }
    lines.push("")
  }

  // Summary
  if (includeSummary) {
    lines.push(`${h(2)} Summary`)
    lines.push("")
    lines.push(`| Metric | Value |`)
    lines.push(`|--------|-------|`)
    lines.push(`| Total Tests | ${plan.summary.totalTests} |`)
    lines.push(`| Automatable | ${plan.summary.automatableTests} |`)
    lines.push(`| Manual | ${plan.summary.manualTests} |`)
    lines.push(`| Est. Duration | ${plan.summary.estimatedDuration} min |`)
    lines.push("")

    lines.push(`${h(3)} By Category`)
    lines.push("")
    lines.push(`| Category | Count |`)
    lines.push(`|----------|-------|`)
    for (const [category, count] of Object.entries(plan.summary.byCategory)) {
      if (count > 0) {
        lines.push(`| ${category} | ${count} |`)
      }
    }
    lines.push("")

    lines.push(`${h(3)} By Priority`)
    lines.push("")
    lines.push(`| Priority | Count |`)
    lines.push(`|----------|-------|`)
    for (const [priority, count] of Object.entries(plan.summary.byPriority)) {
      if (count > 0) {
        lines.push(`| ${priority} | ${count} |`)
      }
    }
    lines.push("")
  }

  // Coverage Analysis
  if (includeCoverage) {
    lines.push(`${h(2)} Coverage Analysis`)
    lines.push("")
    lines.push(`**Coverage: ${plan.coverage.coveragePercent}%**`)
    lines.push("")

    if (plan.coverage.coveredRequirements.length > 0) {
      lines.push(`${h(3)} Covered Requirements`)
      lines.push("")
      for (const req of plan.coverage.coveredRequirements) {
        lines.push(`- ✅ ${req}`)
      }
      lines.push("")
    }

    if (plan.coverage.uncoveredAreas.length > 0) {
      lines.push(`${h(3)} Uncovered Areas`)
      lines.push("")
      for (const area of plan.coverage.uncoveredAreas) {
        lines.push(`- ⚠️ ${area}`)
      }
      lines.push("")
    }

    if (plan.coverage.recommendations.length > 0) {
      lines.push(`${h(3)} Recommendations`)
      lines.push("")
      for (const rec of plan.coverage.recommendations) {
        lines.push(`- 💡 ${rec}`)
      }
      lines.push("")
    }
  }

  // Test Suites
  for (const suite of plan.suites) {
    lines.push(`${h(2)} ${suite.name}`)
    lines.push("")
    lines.push(suite.description)
    lines.push("")

    if (suite.setup && suite.setup.length > 0) {
      lines.push(`${h(3)} Setup`)
      lines.push("")
      for (const step of suite.setup) {
        lines.push(`- ${step}`)
      }
      lines.push("")
    }

    lines.push(`${h(3)} Test Cases`)
    lines.push("")

    for (const tc of suite.testCases) {
      lines.push(`${h(4)} ${tc.id}: ${tc.title}`)
      lines.push("")
      lines.push(`*Priority: ${tc.priority} | Automatable: ${tc.automatable ? "Yes" : "No"} | Est: ${tc.estimatedDuration || 0} min*`)
      lines.push("")
      lines.push(tc.description)
      lines.push("")

      if (tc.prerequisites && tc.prerequisites.length > 0) {
        lines.push("**Prerequisites:**")
        for (const prereq of tc.prerequisites) {
          lines.push(`- ${prereq}`)
        }
        lines.push("")
      }

      lines.push("**Steps:**")
      tc.steps.forEach((step, i) => {
        lines.push(`${i + 1}. ${step}`)
      })
      lines.push("")

      lines.push(`**Expected Result:** ${tc.expectedResult}`)
      lines.push("")

      if (tc.testData && tc.testData.length > 0) {
        lines.push(`**Test Data:** ${tc.testData.join(", ")}`)
        lines.push("")
      }

      // Code template
      if (includeCodeTemplates && tc.automatable) {
        lines.push("**Code Template:**")
        lines.push("```typescript")
        lines.push(`it("${tc.title}", () => {`)
        lines.push(`  // ${tc.description}`)
        for (const step of tc.steps) {
          lines.push(`  // ${step}`)
        }
        lines.push(`  // Assert: ${tc.expectedResult}`)
        lines.push(`})`)
        lines.push("```")
        lines.push("")
      }
    }

    if (suite.teardown && suite.teardown.length > 0) {
      lines.push(`${h(3)} Teardown`)
      lines.push("")
      for (const step of suite.teardown) {
        lines.push(`- ${step}`)
      }
      lines.push("")
    }
  }

  return lines.join("\n")
}

// ============================================================================
// Spec Extraction from Design Requirements
// ============================================================================

/**
 * Extracts component spec from design requirements
 */
export function extractSpecFromRequirements(
  requirements: DesignRequirements,
  component?: GeneratedComponent
): ComponentSpec {
  const spec: ComponentSpec = {
    name: component?.fileName.replace(/\.tsx$/, "") ||
      toPascalCase(requirements.componentType) ||
      "Component",
    type: requirements.componentType,
    designRequirements: requirements,
    generatedComponent: component,
    props: [],
    states: [],
    events: [],
    accessibility: undefined,
  }

  // Extract props from variants
  if (requirements.variant) {
    spec.props?.push({
      name: "variant",
      type: "string",
      required: false,
      defaultValue: "default",
      validValues: [requirements.variant, "default"],
    })
  }

  if (requirements.size) {
    spec.props?.push({
      name: "size",
      type: "string",
      required: false,
      defaultValue: "md",
      validValues: ["xs", "sm", "md", "lg", "xl"],
    })
  }

  // Add className prop
  spec.props?.push({
    name: "className",
    type: "string",
    required: false,
    description: "Additional CSS classes",
  })

  // Add children prop for most components
  if (!["input", "slider", "switch", "checkbox", "radio"].includes(requirements.componentType)) {
    spec.props?.push({
      name: "children",
      type: "ReactNode",
      required: false,
      description: "Child content",
    })
  }

  // Extract states from interactions
  if (requirements.interactions) {
    if (requirements.interactions.hasDisabledState) {
      spec.states?.push({
        name: "disabled",
        description: "Component is disabled",
        visualChanges: ["Reduced opacity", "Cursor: not-allowed"],
        triggers: ["disabled prop is true"],
      })
    }

    if (requirements.interactions.hasLoadingState) {
      spec.states?.push({
        name: "loading",
        description: "Component is in loading state",
        visualChanges: ["Shows loading spinner", "Content may be hidden"],
        triggers: ["isLoading prop is true"],
      })
    }

    if (requirements.interactions.hover) {
      spec.states?.push({
        name: "hover",
        description: `Hover state with ${requirements.interactions.hover.effect} effect`,
        visualChanges: [`${requirements.interactions.hover.effect} effect applied`],
        triggers: ["Mouse enters component"],
      })
    }

    if (requirements.interactions.focus) {
      spec.states?.push({
        name: "focus",
        description: "Component has keyboard focus",
        visualChanges: [
          requirements.interactions.focus.ring ? "Focus ring visible" : "Focus styles applied",
        ],
        triggers: ["Tab key focuses component"],
      })
    }
  }

  // Add events based on component type
  const eventMap: Record<string, EventSpec[]> = {
    button: [
      { name: "onClick", description: "Fired when button is clicked", trigger: "Click the button", expectedBehavior: "onClick handler is called" },
    ],
    input: [
      { name: "onChange", description: "Fired when input value changes", trigger: "Type in the input", expectedBehavior: "onChange handler receives new value" },
      { name: "onFocus", description: "Fired when input gains focus", trigger: "Focus the input", expectedBehavior: "onFocus handler is called" },
      { name: "onBlur", description: "Fired when input loses focus", trigger: "Blur the input", expectedBehavior: "onBlur handler is called" },
    ],
    checkbox: [
      { name: "onChange", description: "Fired when checkbox is toggled", trigger: "Click the checkbox", expectedBehavior: "onChange handler receives new checked state" },
    ],
    select: [
      { name: "onChange", description: "Fired when selection changes", trigger: "Select an option", expectedBehavior: "onChange handler receives selected value" },
    ],
    modal: [
      { name: "onClose", description: "Fired when modal is closed", trigger: "Click close button or backdrop", expectedBehavior: "onClose handler is called" },
    ],
  }

  spec.events = eventMap[requirements.componentType] || []

  // Extract accessibility requirements
  const a11y = requirements.accessibility
  if (a11y) {
    spec.accessibility = {
      role: getDefaultRole(requirements.componentType),
      ariaAttributes: a11y.needsAriaLabel ? ["aria-label"] : [],
      keyboardInteractions: getKeyboardInteractions(requirements.componentType),
      focusBehavior: a11y.needsFocusManagement ? "Focus trap for overlays" : "Standard focus behavior",
      screenReaderExpectations: a11y.needsAnnouncements
        ? ["State changes are announced"]
        : undefined,
    }
  } else {
    // Default accessibility
    spec.accessibility = {
      role: getDefaultRole(requirements.componentType),
      keyboardInteractions: getKeyboardInteractions(requirements.componentType),
    }
  }

  return spec
}

/**
 * Gets default ARIA role for component type
 */
function getDefaultRole(componentType: string): string | undefined {
  const roleMap: Record<string, string> = {
    button: "button",
    link: "link",
    checkbox: "checkbox",
    radio: "radio",
    switch: "switch",
    slider: "slider",
    input: "textbox",
    textarea: "textbox",
    select: "combobox",
    menu: "menu",
    menuitem: "menuitem",
    tabs: "tablist",
    tab: "tab",
    tabpanel: "tabpanel",
    dialog: "dialog",
    modal: "dialog",
    alert: "alert",
    alertdialog: "alertdialog",
    tooltip: "tooltip",
    progressbar: "progressbar",
    navigation: "navigation",
  }
  return roleMap[componentType]
}

/**
 * Gets expected keyboard interactions for component type
 */
function getKeyboardInteractions(componentType: string): string[] {
  const interactionMap: Record<string, string[]> = {
    button: ["Enter/Space activates the button"],
    checkbox: ["Space toggles the checkbox"],
    radio: ["Arrow keys navigate options", "Space selects current option"],
    switch: ["Space toggles the switch"],
    slider: ["Arrow keys adjust value"],
    select: ["Arrow keys navigate options", "Enter selects current option", "Escape closes dropdown"],
    tabs: ["Arrow keys navigate tabs", "Enter/Space activates tab"],
    menu: ["Arrow keys navigate items", "Enter activates item", "Escape closes menu"],
    dialog: ["Tab cycles through focusable elements", "Escape closes dialog"],
    modal: ["Tab cycles through focusable elements", "Escape closes modal"],
  }
  return interactionMap[componentType] || []
}

/**
 * Converts string to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("")
}
