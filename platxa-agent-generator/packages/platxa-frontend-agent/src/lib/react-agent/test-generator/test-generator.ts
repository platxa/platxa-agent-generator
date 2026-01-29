/**
 * Test Generator
 *
 * Converts test plans into executable test code for various frameworks:
 * - Playwright (e2e)
 * - Cypress (e2e)
 * - Vitest + React Testing Library (unit/integration)
 * - Jest + React Testing Library (unit/integration)
 */

import type {
  TestFramework,
  GeneratedTestFile,
  TestGenerationResult,
  TestGeneratorConfig,
  FrameworkTemplates,
  SelectorTemplates,
  TestStep,
  ParsedTestCase,
  ComponentContext,
} from "./types"

import type { TestPlan, TestCase, TestSuite, TestCategory } from "../test-planner"

// ============================================================================
// Framework Templates
// ============================================================================

/**
 * Playwright test templates
 */
const playwrightTemplates: FrameworkTemplates = {
  header: `import { test, expect } from '@playwright/test';
`,
  describeBlock: (name, content) => `test.describe('${name}', () => {
${content}
});
`,
  testCase: (title, body) => `  test('${title}', async ({ page }) => {
${body}
  });
`,
  beforeEach: (body) => `  test.beforeEach(async ({ page }) => {
${body}
  });
`,
  afterEach: (body) => `  test.afterEach(async ({ page }) => {
${body}
  });
`,
  beforeAll: (body) => `  test.beforeAll(async () => {
${body}
  });
`,
  afterAll: (body) => `  test.afterAll(async () => {
${body}
  });
`,
  assertions: {
    exists: (sel) => `    await expect(page.locator('${sel}')).toBeAttached();`,
    visible: (sel) => `    await expect(page.locator('${sel}')).toBeVisible();`,
    hasText: (sel, text) => `    await expect(page.locator('${sel}')).toHaveText('${text}');`,
    hasAttribute: (sel, attr, val) => val
      ? `    await expect(page.locator('${sel}')).toHaveAttribute('${attr}', '${val}');`
      : `    await expect(page.locator('${sel}')).toHaveAttribute('${attr}');`,
    hasClass: (sel, cls) => `    await expect(page.locator('${sel}')).toHaveClass(/${cls}/);`,
    isDisabled: (sel) => `    await expect(page.locator('${sel}')).toBeDisabled();`,
    isEnabled: (sel) => `    await expect(page.locator('${sel}')).toBeEnabled();`,
    isFocused: (sel) => `    await expect(page.locator('${sel}')).toBeFocused();`,
    hasCount: (sel, count) => `    await expect(page.locator('${sel}')).toHaveCount(${count});`,
    custom: (code) => `    ${code}`,
  },
  actions: {
    click: (sel) => `    await page.locator('${sel}').click();`,
    type: (sel, text) => `    await page.locator('${sel}').fill('${text}');`,
    clear: (sel) => `    await page.locator('${sel}').clear();`,
    focus: (sel) => `    await page.locator('${sel}').focus();`,
    blur: (sel) => `    await page.locator('${sel}').blur();`,
    pressKey: (key) => `    await page.keyboard.press('${key}');`,
    hover: (sel) => `    await page.locator('${sel}').hover();`,
    select: (sel, val) => `    await page.locator('${sel}').selectOption('${val}');`,
    check: (sel) => `    await page.locator('${sel}').check();`,
    uncheck: (sel) => `    await page.locator('${sel}').uncheck();`,
    waitFor: (sel) => `    await page.locator('${sel}').waitFor();`,
    navigate: (url) => `    await page.goto('${url}');`,
    custom: (code) => `    ${code}`,
  },
  selectors: {
    byTestId: (id) => `[data-testid="${id}"]`,
    byRole: (role, opts) => opts?.name
      ? `role=${role}[name="${opts.name}"]`
      : `role=${role}`,
    byText: (text) => `text=${text}`,
    byLabel: (label) => `label=${label}`,
    byPlaceholder: (ph) => `[placeholder="${ph}"]`,
    byCss: (sel) => sel,
  },
}

/**
 * Cypress test templates
 */
const cypressTemplates: FrameworkTemplates = {
  header: `/// <reference types="cypress" />
`,
  describeBlock: (name, content) => `describe('${name}', () => {
${content}
});
`,
  testCase: (title, body) => `  it('${title}', () => {
${body}
  });
`,
  beforeEach: (body) => `  beforeEach(() => {
${body}
  });
`,
  afterEach: (body) => `  afterEach(() => {
${body}
  });
`,
  beforeAll: (body) => `  before(() => {
${body}
  });
`,
  afterAll: (body) => `  after(() => {
${body}
  });
`,
  assertions: {
    exists: (sel) => `    cy.get('${sel}').should('exist');`,
    visible: (sel) => `    cy.get('${sel}').should('be.visible');`,
    hasText: (sel, text) => `    cy.get('${sel}').should('have.text', '${text}');`,
    hasAttribute: (sel, attr, val) => val
      ? `    cy.get('${sel}').should('have.attr', '${attr}', '${val}');`
      : `    cy.get('${sel}').should('have.attr', '${attr}');`,
    hasClass: (sel, cls) => `    cy.get('${sel}').should('have.class', '${cls}');`,
    isDisabled: (sel) => `    cy.get('${sel}').should('be.disabled');`,
    isEnabled: (sel) => `    cy.get('${sel}').should('be.enabled');`,
    isFocused: (sel) => `    cy.get('${sel}').should('have.focus');`,
    hasCount: (sel, count) => `    cy.get('${sel}').should('have.length', ${count});`,
    custom: (code) => `    ${code}`,
  },
  actions: {
    click: (sel) => `    cy.get('${sel}').click();`,
    type: (sel, text) => `    cy.get('${sel}').type('${text}');`,
    clear: (sel) => `    cy.get('${sel}').clear();`,
    focus: (sel) => `    cy.get('${sel}').focus();`,
    blur: (sel) => `    cy.get('${sel}').blur();`,
    pressKey: (key) => `    cy.get('body').type('{${key.toLowerCase()}}');`,
    hover: (sel) => `    cy.get('${sel}').trigger('mouseover');`,
    select: (sel, val) => `    cy.get('${sel}').select('${val}');`,
    check: (sel) => `    cy.get('${sel}').check();`,
    uncheck: (sel) => `    cy.get('${sel}').uncheck();`,
    waitFor: (sel) => `    cy.get('${sel}').should('exist');`,
    navigate: (url) => `    cy.visit('${url}');`,
    custom: (code) => `    ${code}`,
  },
  selectors: {
    byTestId: (id) => `[data-testid="${id}"]`,
    byRole: (role, opts) => opts?.name
      ? `[role="${role}"][aria-label="${opts.name}"]`
      : `[role="${role}"]`,
    byText: (text) => `:contains("${text}")`,
    byLabel: (label) => `[aria-label="${label}"]`,
    byPlaceholder: (ph) => `[placeholder="${ph}"]`,
    byCss: (sel) => sel,
  },
}

/**
 * Vitest + React Testing Library templates
 */
const vitestRtlTemplates: FrameworkTemplates = {
  header: `import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
`,
  describeBlock: (name, content) => `describe('${name}', () => {
${content}
});
`,
  testCase: (title, body) => `  it('${title}', async () => {
    const user = userEvent.setup();
${body}
  });
`,
  beforeEach: (body) => `  beforeEach(() => {
${body}
  });
`,
  afterEach: (body) => `  afterEach(() => {
${body}
  });
`,
  assertions: {
    exists: (sel) => `    expect(screen.getByTestId('${sel}')).toBeInTheDocument();`,
    visible: (sel) => `    expect(screen.getByTestId('${sel}')).toBeVisible();`,
    hasText: (sel, text) => `    expect(screen.getByTestId('${sel}')).toHaveTextContent('${text}');`,
    hasAttribute: (sel, attr, val) => val
      ? `    expect(screen.getByTestId('${sel}')).toHaveAttribute('${attr}', '${val}');`
      : `    expect(screen.getByTestId('${sel}')).toHaveAttribute('${attr}');`,
    hasClass: (sel, cls) => `    expect(screen.getByTestId('${sel}')).toHaveClass('${cls}');`,
    isDisabled: (sel) => `    expect(screen.getByTestId('${sel}')).toBeDisabled();`,
    isEnabled: (sel) => `    expect(screen.getByTestId('${sel}')).toBeEnabled();`,
    isFocused: (sel) => `    expect(screen.getByTestId('${sel}')).toHaveFocus();`,
    hasCount: (sel, count) => `    expect(screen.getAllByTestId('${sel}')).toHaveLength(${count});`,
    custom: (code) => `    ${code}`,
  },
  actions: {
    click: (sel) => `    await user.click(screen.getByTestId('${sel}'));`,
    type: (sel, text) => `    await user.type(screen.getByTestId('${sel}'), '${text}');`,
    clear: (sel) => `    await user.clear(screen.getByTestId('${sel}'));`,
    focus: (sel) => `    screen.getByTestId('${sel}').focus();`,
    blur: (sel) => `    screen.getByTestId('${sel}').blur();`,
    pressKey: (key) => `    await user.keyboard('{${key}}');`,
    hover: (sel) => `    await user.hover(screen.getByTestId('${sel}'));`,
    select: (sel, val) => `    await user.selectOptions(screen.getByTestId('${sel}'), '${val}');`,
    check: (sel) => `    await user.click(screen.getByTestId('${sel}'));`,
    uncheck: (sel) => `    await user.click(screen.getByTestId('${sel}'));`,
    waitFor: (sel) => `    await waitFor(() => expect(screen.getByTestId('${sel}')).toBeInTheDocument());`,
    navigate: (_url) => `    // Navigation not applicable for unit tests`,
    custom: (code) => `    ${code}`,
  },
  selectors: {
    byTestId: (id) => id,
    byRole: (role, opts) => opts?.name ? `${role}-${opts.name}` : role,
    byText: (text) => text,
    byLabel: (label) => label,
    byPlaceholder: (ph) => ph,
    byCss: (sel) => sel,
  },
}

/**
 * Jest + React Testing Library templates (similar to Vitest)
 */
const jestRtlTemplates: FrameworkTemplates = {
  ...vitestRtlTemplates,
  header: `import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
`,
}

/**
 * Gets templates for a framework
 */
export function getFrameworkTemplates(framework: TestFramework): FrameworkTemplates {
  switch (framework) {
    case "playwright":
      return playwrightTemplates
    case "cypress":
      return cypressTemplates
    case "vitest":
      return vitestRtlTemplates
    case "jest":
      return jestRtlTemplates
    default:
      return vitestRtlTemplates
  }
}

// ============================================================================
// Step Parsing
// ============================================================================

/**
 * Determines if a step is an assertion based on intent keywords
 */
function isAssertionIntent(stepLower: string): boolean {
  // Assertion intent patterns - check these first to determine intent
  const assertionPatterns = [
    /^verify\b/,
    /^expect\b/,
    /^assert\b/,
    /^check\b/,
    /^confirm\b/,
    /^ensure\b/,
    /\bshould\s+(be|have|contain|display|show|see|match)\b/,
    /\bis\s+(visible|displayed|enabled|disabled|focused|checked|selected)\b/,
    /\bhas\s+(text|class|attribute|focus|value)\b/,
    /\bmust\s+(be|have|contain)\b/,
    /\bcontains\b/,  // "contains" alone indicates assertion
    /\byou\s+should\s+see\b/,  // "you should see" pattern
  ]

  return assertionPatterns.some((pattern) => pattern.test(stepLower))
}

/**
 * Parses an assertion step into code
 */
function parseAssertion(
  step: string,
  stepLower: string,
  templates: FrameworkTemplates,
  context: ComponentContext
): TestStep {
  const selector = extractSelector(step, templates.selectors, context)

  // Visibility assertions
  if (stepLower.includes("visible") || stepLower.includes("displayed") || stepLower.includes("see")) {
    return {
      type: "assertion",
      description: step,
      code: templates.assertions.visible(selector),
    }
  }

  // Disabled state
  if (stepLower.includes("disabled")) {
    return {
      type: "assertion",
      description: step,
      code: templates.assertions.isDisabled(selector),
    }
  }

  // Enabled state
  if (stepLower.includes("enabled")) {
    return {
      type: "assertion",
      description: step,
      code: templates.assertions.isEnabled(selector),
    }
  }

  // Focused state - check before generic "focus" to handle "has focus"
  if (stepLower.includes("focused") || stepLower.includes("has focus")) {
    return {
      type: "assertion",
      description: step,
      code: templates.assertions.isFocused(selector),
    }
  }

  // Attribute assertions - including aria attributes
  if (stepLower.includes("attribute") || stepLower.includes("aria-")) {
    const attr = extractAttribute(step)
    const val = extractQuotedText(step)
    return {
      type: "assertion",
      description: step,
      code: templates.assertions.hasAttribute(selector, attr, val),
    }
  }

  // Class assertions
  if (stepLower.includes("class")) {
    const className = extractQuotedText(step) || "active"
    return {
      type: "assertion",
      description: step,
      code: templates.assertions.hasClass(selector, className),
    }
  }

  // Text content assertions
  if (stepLower.includes("text") || stepLower.includes("contains") || stepLower.includes("content")) {
    const text = extractQuotedText(step) || context.name
    return {
      type: "assertion",
      description: step,
      code: templates.assertions.hasText(selector, text),
    }
  }

  // Element exists
  if (stepLower.includes("exists") || stepLower.includes("present")) {
    return {
      type: "assertion",
      description: step,
      code: templates.assertions.exists(selector),
    }
  }

  // Count assertions
  if (stepLower.includes("count") || stepLower.includes("length")) {
    const countMatch = step.match(/(\d+)/)
    const count = countMatch ? parseInt(countMatch[1], 10) : 1
    return {
      type: "assertion",
      description: step,
      code: templates.assertions.hasCount(selector, count),
    }
  }

  // Default assertion - visibility
  return {
    type: "assertion",
    description: step,
    code: templates.assertions.visible(selector),
  }
}

/**
 * Removes quoted strings from text to avoid matching keywords inside quotes
 */
function removeQuotedText(text: string): string {
  return text.replace(/'[^']*'|"[^"]*"/g, "")
}

/**
 * Parses an action step into code
 */
function parseAction(
  step: string,
  stepLower: string,
  templates: FrameworkTemplates,
  context: ComponentContext
): TestStep {
  const selector = extractSelector(step, templates.selectors, context)
  // Remove quoted text to avoid matching keywords inside quotes like "'Click me'"
  const stepWithoutQuotes = removeQuotedText(stepLower)

  // Click actions - only match "click" outside of quotes
  if (stepWithoutQuotes.includes("click")) {
    return {
      type: "action",
      description: step,
      code: templates.actions.click(selector),
    }
  }

  // Type/fill actions - but not "type" as attribute (use stepWithoutQuotes to avoid matching quoted text)
  if (
    (stepWithoutQuotes.includes("type") && !stepWithoutQuotes.includes("attribute")) ||
    stepWithoutQuotes.includes("fill") ||
    (stepWithoutQuotes.includes("enter") && !stepWithoutQuotes.includes("press enter"))
  ) {
    const text = extractQuotedText(step) || "test input"
    return {
      type: "action",
      description: step,
      code: templates.actions.type(selector, text),
    }
  }

  // Focus actions - but only for imperative "focus on", not state assertions
  if (stepWithoutQuotes.includes("focus on") || (stepWithoutQuotes.includes("focus") && stepWithoutQuotes.includes("the"))) {
    return {
      type: "action",
      description: step,
      code: templates.actions.focus(selector),
    }
  }

  // Tab navigation
  if (stepWithoutQuotes.includes("tab to") || stepWithoutQuotes.includes("tab into")) {
    return {
      type: "action",
      description: step,
      code: templates.actions.focus(selector),
    }
  }

  // Hover actions
  if (stepWithoutQuotes.includes("hover") || stepWithoutQuotes.includes("mouse over")) {
    return {
      type: "action",
      description: step,
      code: templates.actions.hover(selector),
    }
  }

  // Key press actions
  if (stepWithoutQuotes.includes("press") || stepWithoutQuotes.includes("keyboard") || stepWithoutQuotes.includes("hit")) {
    const key = extractKey(step)
    return {
      type: "action",
      description: step,
      code: templates.actions.pressKey(key),
    }
  }

  // Clear input
  if (stepWithoutQuotes.includes("clear")) {
    return {
      type: "action",
      description: step,
      code: templates.actions.clear(selector),
    }
  }

  // Check/uncheck
  if (stepWithoutQuotes.includes("check") && !stepWithoutQuotes.includes("uncheck")) {
    return {
      type: "action",
      description: step,
      code: templates.actions.check(selector),
    }
  }
  if (stepWithoutQuotes.includes("uncheck")) {
    return {
      type: "action",
      description: step,
      code: templates.actions.uncheck(selector),
    }
  }

  // Select option
  if (stepWithoutQuotes.includes("select")) {
    const value = extractQuotedText(step) || "option"
    return {
      type: "action",
      description: step,
      code: templates.actions.select(selector, value),
    }
  }

  // Wait actions
  if (stepWithoutQuotes.includes("wait")) {
    return {
      type: "wait",
      description: step,
      code: templates.actions.waitFor(selector),
    }
  }

  // Navigation
  if (stepWithoutQuotes.includes("navigate") || stepWithoutQuotes.includes("visit") || stepWithoutQuotes.includes("go to")) {
    const url = extractUrl(step)
    return {
      type: "action",
      description: step,
      code: templates.actions.navigate(url),
    }
  }

  // Render component (for unit tests)
  if (stepWithoutQuotes.includes("render")) {
    return {
      type: "action",
      description: step,
      code: `    render(<${context.name} />);`,
    }
  }

  // Default: comment for unrecognized action
  return {
    type: "comment",
    description: step,
    code: `    // ${step}`,
  }
}

/**
 * Parses natural language step into code
 *
 * Uses intent-based parsing:
 * 1. First determine if the step is an assertion or action based on keywords
 * 2. Then parse the specific type within that category
 *
 * This prevents keyword conflicts (e.g., "has focus" being parsed as "focus" action)
 */
export function parseStep(
  step: string,
  templates: FrameworkTemplates,
  context: ComponentContext
): TestStep {
  const stepLower = step.toLowerCase()

  // Determine intent first - is this an assertion or an action?
  if (isAssertionIntent(stepLower)) {
    return parseAssertion(step, stepLower, templates, context)
  }

  // Parse as action
  return parseAction(step, stepLower, templates, context)
}

/**
 * Extracts selector from step description
 */
function extractSelector(
  step: string,
  selectors: SelectorTemplates,
  context: ComponentContext
): string {
  // Look for quoted selectors
  const quotedMatch = step.match(/'([^']+)'|"([^"]+)"/)
  if (quotedMatch) {
    return selectors.byCss(quotedMatch[1] || quotedMatch[2])
  }

  // Look for role mentions
  const roleMatch = step.match(/role[=:]?\s*["']?(\w+)["']?/i)
  if (roleMatch) {
    return selectors.byRole(roleMatch[1])
  }

  // Look for testid mentions
  const testIdMatch = step.match(/test-?id[=:]?\s*["']?([^"'\s]+)["']?/i)
  if (testIdMatch) {
    return selectors.byTestId(testIdMatch[1])
  }

  // Default to component's test ID or name
  return context.testId
    ? selectors.byTestId(context.testId)
    : selectors.byTestId(context.name.toLowerCase())
}

/**
 * Extracts quoted text from step
 */
function extractQuotedText(step: string): string | undefined {
  const match = step.match(/'([^']+)'|"([^"]+)"/)
  return match ? (match[1] || match[2]) : undefined
}

/**
 * Extracts keyboard key from step
 */
function extractKey(step: string): string {
  const stepLower = step.toLowerCase()

  // Check for arrow keys first (multi-word patterns like "arrow down")
  if (stepLower.includes("arrow")) {
    if (stepLower.includes("up")) return "ArrowUp"
    if (stepLower.includes("down")) return "ArrowDown"
    if (stepLower.includes("left")) return "ArrowLeft"
    if (stepLower.includes("right")) return "ArrowRight"
    return "ArrowDown" // default arrow direction
  }

  // Check for common keys
  if (stepLower.includes("enter")) return "Enter"
  if (stepLower.includes("escape") || stepLower.includes("esc")) return "Escape"
  if (stepLower.includes("tab")) return "Tab"
  if (stepLower.includes("space")) return "Space"
  if (stepLower.includes("backspace")) return "Backspace"
  if (stepLower.includes("delete")) return "Delete"

  // Fall back to extracting single word after "press" or "key"
  const keyMatch = step.match(/(?:press|key)\s+['"]?(\w+)['"]?/i)
  if (keyMatch) {
    // Capitalize first letter for key names
    const key = keyMatch[1]
    return key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()
  }

  return "Enter"
}

/**
 * Extracts attribute name from step
 */
function extractAttribute(step: string): string {
  const ariaMatch = step.match(/(aria-\w+)/i)
  if (ariaMatch) return ariaMatch[1].toLowerCase()

  const attrMatch = step.match(/attribute\s+['"]?(\w+)['"]?/i)
  if (attrMatch) return attrMatch[1]

  return "aria-label"
}

/**
 * Extracts URL from step
 */
function extractUrl(step: string): string {
  const urlMatch = step.match(/(?:https?:\/\/[^\s]+|\/[^\s]+)/)
  return urlMatch ? urlMatch[0] : "/"
}

// ============================================================================
// Test Case Generation
// ============================================================================

/**
 * Parses a test case into steps
 */
export function parseTestCase(
  testCase: TestCase,
  templates: FrameworkTemplates,
  context: ComponentContext
): ParsedTestCase {
  const steps: TestStep[] = []

  for (const step of testCase.steps) {
    steps.push(parseStep(step, templates, context))
  }

  // Add expected result as final assertion if not already covered
  const expectedLower = testCase.expectedResult.toLowerCase()
  const hasAssertion = steps.some((s) => s.type === "assertion")

  if (!hasAssertion) {
    if (expectedLower.includes("render") || expectedLower.includes("display")) {
      steps.push({
        type: "assertion",
        description: testCase.expectedResult,
        code: templates.assertions.visible(
          context.testId
            ? templates.selectors.byTestId(context.testId)
            : templates.selectors.byTestId(context.name.toLowerCase())
        ),
      })
    } else {
      steps.push({
        type: "comment",
        description: `Expected: ${testCase.expectedResult}`,
        code: `    // Assert: ${testCase.expectedResult}`,
      })
    }
  }

  return {
    original: testCase,
    steps,
  }
}

/**
 * Generates code for a single test case
 */
export function generateTestCaseCode(
  parsedTest: ParsedTestCase,
  templates: FrameworkTemplates,
  config: TestGeneratorConfig
): string {
  const lines: string[] = []

  if (config.includeComments) {
    lines.push(`    // ${parsedTest.original.description}`)
    lines.push(`    // Priority: ${parsedTest.original.priority}`)
  }

  for (const step of parsedTest.steps) {
    lines.push(step.code)
  }

  return templates.testCase(
    escapeString(parsedTest.original.title),
    lines.join("\n")
  )
}

/**
 * Escapes string for use in code
 */
function escapeString(str: string): string {
  return str.replace(/'/g, "\\'").replace(/"/g, '\\"')
}

// ============================================================================
// Suite Generation
// ============================================================================

/**
 * Generates code for a test suite
 */
export function generateSuiteCode(
  suite: TestSuite,
  templates: FrameworkTemplates,
  context: ComponentContext,
  config: TestGeneratorConfig
): string {
  const testCodes: string[] = []

  // Filter to automatable tests if configured
  const testCases = config.automatableOnly
    ? suite.testCases.filter((tc) => tc.automatable)
    : suite.testCases

  // Setup
  if (config.includeSetup && suite.setup && suite.setup.length > 0) {
    const setupCode = suite.setup
      .map((s) => `    // ${s}`)
      .join("\n")
    if (templates.beforeEach) {
      testCodes.push(templates.beforeEach(setupCode))
    }
  }

  // Test cases
  for (const testCase of testCases) {
    const parsed = parseTestCase(testCase, templates, context)
    testCodes.push(generateTestCaseCode(parsed, templates, config))
  }

  // Teardown
  if (config.includeSetup && suite.teardown && suite.teardown.length > 0) {
    const teardownCode = suite.teardown
      .map((s) => `    // ${s}`)
      .join("\n")
    if (templates.afterEach) {
      testCodes.push(templates.afterEach(teardownCode))
    }
  }

  return templates.describeBlock(
    escapeString(suite.name),
    testCodes.join("\n")
  )
}

// ============================================================================
// File Generation
// ============================================================================

/**
 * Generates a complete test file
 */
export function generateTestFile(
  plan: TestPlan,
  config: TestGeneratorConfig
): GeneratedTestFile {
  const templates = getFrameworkTemplates(config.framework)
  const context: ComponentContext = {
    name: plan.componentName,
    importPath: config.componentPath || `./${plan.componentName}`,
    testId: plan.componentName.toLowerCase(),
  }

  const lines: string[] = []

  // Header
  lines.push(templates.header)

  // Component import for unit test frameworks
  if (config.framework === "vitest" || config.framework === "jest") {
    lines.push(`import { ${plan.componentName} } from '${context.importPath}';`)
    lines.push("")
  }

  // Custom imports
  if (config.customImports && config.customImports.length > 0) {
    for (const imp of config.customImports) {
      lines.push(imp)
    }
    lines.push("")
  }

  // Filter suites by category for framework
  const e2eCategories: TestCategory[] = ["e2e", "visual"]
  const unitCategories: TestCategory[] = ["unit", "integration", "accessibility"]

  let suitesToGenerate = plan.suites
  if (config.framework === "playwright" || config.framework === "cypress") {
    // E2E frameworks get e2e and visual tests
    suitesToGenerate = plan.suites.filter(
      (s) => e2eCategories.includes(s.category) || s.category === "performance"
    )
    // Also include integration tests that can be adapted
    if (suitesToGenerate.length === 0) {
      suitesToGenerate = plan.suites.filter((s) => s.category === "integration")
    }
  } else {
    // Unit test frameworks get unit, integration, accessibility tests
    suitesToGenerate = plan.suites.filter((s) => unitCategories.includes(s.category))
  }

  // If still no suites, use all
  if (suitesToGenerate.length === 0) {
    suitesToGenerate = plan.suites
  }

  // Group by category or generate flat
  if (config.groupByCategory) {
    const byCategory = new Map<TestCategory, TestSuite[]>()
    for (const suite of suitesToGenerate) {
      const existing = byCategory.get(suite.category) || []
      existing.push(suite)
      byCategory.set(suite.category, existing)
    }

    for (const [category, suites] of byCategory) {
      lines.push(`// ${category.toUpperCase()} Tests`)
      for (const suite of suites) {
        lines.push(generateSuiteCode(suite, templates, context, config))
      }
      lines.push("")
    }
  } else {
    // Wrap all in component describe block
    const suitesCodes = suitesToGenerate
      .map((suite) => generateSuiteCode(suite, templates, context, config))
      .join("\n")

    lines.push(templates.describeBlock(plan.componentName, suitesCodes))
  }

  const content = lines.join("\n")
  const testCount = suitesToGenerate.reduce(
    (sum, s) => sum + (config.automatableOnly
      ? s.testCases.filter((tc) => tc.automatable).length
      : s.testCases.length),
    0
  )

  // Determine file extension and path
  const ext = config.typescript !== false ? "ts" : "js"
  const suffix = config.framework === "playwright"
    ? `.spec.${ext}`
    : config.framework === "cypress"
      ? `.cy.${ext}`
      : `.test.${ext}x`

  const fileName = `${plan.componentName}${suffix}`
  const filePath = config.outputDir
    ? `${config.outputDir}/${fileName}`
    : fileName

  return {
    path: filePath,
    content,
    framework: config.framework,
    testCount,
    categories: suitesToGenerate.map((s) => s.category),
  }
}

// ============================================================================
// Main Generation Function
// ============================================================================

/**
 * Generates test code from a test plan
 */
export function generateTests(
  plan: TestPlan,
  config: TestGeneratorConfig
): TestGenerationResult {
  const startTime = Date.now()
  const files: GeneratedTestFile[] = []
  const warnings: string[] = []
  const errors: string[] = []

  try {
    const file = generateTestFile(plan, config)
    files.push(file)

    if (file.testCount === 0) {
      warnings.push(`No tests generated for ${plan.componentName}`)
    }

    // Check for non-automatable tests that were skipped
    if (config.automatableOnly) {
      const manualTests = plan.suites.reduce(
        (sum, s) => sum + s.testCases.filter((tc) => !tc.automatable).length,
        0
      )
      if (manualTests > 0) {
        warnings.push(`${manualTests} manual tests were not included`)
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))
  }

  const totalTests = files.reduce((sum, f) => sum + f.testCount, 0)
  const byFramework: Record<TestFramework, number> = {
    playwright: 0,
    cypress: 0,
    vitest: 0,
    jest: 0,
  }

  for (const file of files) {
    byFramework[file.framework] += file.testCount
  }

  return {
    success: errors.length === 0,
    files,
    totalTests,
    byFramework,
    warnings,
    errors,
    metadata: {
      generatedAt: new Date(),
      sourceTestPlan: plan.title,
      duration: Date.now() - startTime,
    },
  }
}

/**
 * Generates tests for multiple frameworks
 */
export function generateTestsMultiFramework(
  plan: TestPlan,
  frameworks: TestFramework[],
  baseConfig: Omit<TestGeneratorConfig, "framework"> = {}
): TestGenerationResult {
  const startTime = Date.now()
  const allFiles: GeneratedTestFile[] = []
  const allWarnings: string[] = []
  const allErrors: string[] = []

  for (const framework of frameworks) {
    const result = generateTests(plan, { ...baseConfig, framework })
    allFiles.push(...result.files)
    allWarnings.push(...result.warnings)
    allErrors.push(...result.errors)
  }

  const totalTests = allFiles.reduce((sum, f) => sum + f.testCount, 0)
  const byFramework: Record<TestFramework, number> = {
    playwright: 0,
    cypress: 0,
    vitest: 0,
    jest: 0,
  }

  for (const file of allFiles) {
    byFramework[file.framework] += file.testCount
  }

  return {
    success: allErrors.length === 0,
    files: allFiles,
    totalTests,
    byFramework,
    warnings: allWarnings,
    errors: allErrors,
    metadata: {
      generatedAt: new Date(),
      sourceTestPlan: plan.title,
      duration: Date.now() - startTime,
    },
  }
}
