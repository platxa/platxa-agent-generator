/**
 * Accessibility Testing Utilities (Feature #22)
 *
 * Provides utilities for WCAG 2.2 accessibility testing using axe-core.
 *
 * @example
 * ```tsx
 * import { checkA11y, formatA11yViolations } from "@/test/utils/a11y"
 *
 * test("component is accessible", async () => {
 *   const { container } = render(<MyComponent />)
 *   const results = await checkA11y(container)
 *   expect(results.violations).toHaveLength(0)
 * })
 * ```
 *
 * @module test/utils/a11y
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Accessibility violation from axe-core
 */
export interface A11yViolation {
  id: string
  impact: "minor" | "moderate" | "serious" | "critical"
  description: string
  help: string
  helpUrl: string
  nodes: Array<{
    html: string
    target: string[]
    failureSummary?: string
  }>
}

/**
 * Accessibility check results
 */
export interface A11yResults {
  violations: A11yViolation[]
  passes: Array<{ id: string; description: string }>
  incomplete: Array<{ id: string; description: string }>
  inapplicable: Array<{ id: string; description: string }>
}

/**
 * Options for accessibility checks
 */
export interface A11yOptions {
  /**
   * WCAG rules to include (defaults to WCAG 2.2 AA)
   */
  rules?: string[]
  /**
   * Rules to exclude from checks
   */
  exclude?: string[]
  /**
   * Include elements matching these selectors
   */
  include?: string[]
  /**
   * Exclude elements matching these selectors
   */
  excludeSelectors?: string[]
}

// =============================================================================
// MOCK AXE-CORE (for when axe-core is not installed)
// =============================================================================

/**
 * Simple accessibility checker that validates common issues
 * without requiring axe-core dependency
 */
async function simpleA11yCheck(
  container: Element,
  _options?: A11yOptions
): Promise<A11yResults> {
  const violations: A11yViolation[] = []

  // Check for images without alt text
  const imagesWithoutAlt = container.querySelectorAll("img:not([alt])")
  if (imagesWithoutAlt.length > 0) {
    violations.push({
      id: "image-alt",
      impact: "critical",
      description: "Images must have alternate text",
      help: "Images must have an alt attribute",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.7/image-alt",
      nodes: Array.from(imagesWithoutAlt).map((node) => ({
        html: node.outerHTML.slice(0, 100),
        target: [node.tagName.toLowerCase()],
        failureSummary: "Add alt attribute to image",
      })),
    })
  }

  // Check for buttons without accessible names
  const buttonsWithoutName = container.querySelectorAll(
    "button:not([aria-label]):not([aria-labelledby])"
  )
  buttonsWithoutName.forEach((button) => {
    if (!button.textContent?.trim()) {
      violations.push({
        id: "button-name",
        impact: "critical",
        description: "Buttons must have discernible text",
        help: "Button elements must have accessible names",
        helpUrl: "https://dequeuniversity.com/rules/axe/4.7/button-name",
        nodes: [
          {
            html: button.outerHTML.slice(0, 100),
            target: ["button"],
            failureSummary: "Add text content or aria-label to button",
          },
        ],
      })
    }
  })

  // Check for inputs without labels
  const inputsWithoutLabels = container.querySelectorAll(
    "input:not([type='hidden']):not([type='submit']):not([type='button']):not([aria-label]):not([aria-labelledby])"
  )
  inputsWithoutLabels.forEach((input) => {
    const id = input.getAttribute("id")
    const hasAssociatedLabel = id && container.querySelector(`label[for="${id}"]`)
    if (!hasAssociatedLabel) {
      violations.push({
        id: "label",
        impact: "critical",
        description: "Form elements must have labels",
        help: "Form <input> elements must have labels",
        helpUrl: "https://dequeuniversity.com/rules/axe/4.7/label",
        nodes: [
          {
            html: input.outerHTML.slice(0, 100),
            target: ["input"],
            failureSummary: "Add label element or aria-label",
          },
        ],
      })
    }
  })

  // Check for links without accessible names
  const linksWithoutName = container.querySelectorAll(
    "a:not([aria-label]):not([aria-labelledby])"
  )
  linksWithoutName.forEach((link) => {
    if (!link.textContent?.trim()) {
      violations.push({
        id: "link-name",
        impact: "serious",
        description: "Links must have discernible text",
        help: "Links must have accessible names",
        helpUrl: "https://dequeuniversity.com/rules/axe/4.7/link-name",
        nodes: [
          {
            html: link.outerHTML.slice(0, 100),
            target: ["a"],
            failureSummary: "Add text content or aria-label to link",
          },
        ],
      })
    }
  })

  // Check for missing document language (only for full document)
  if (container === document.documentElement || container === document.body) {
    if (!document.documentElement.getAttribute("lang")) {
      violations.push({
        id: "html-has-lang",
        impact: "serious",
        description: "html element must have a lang attribute",
        help: "<html> element must have a lang attribute",
        helpUrl: "https://dequeuniversity.com/rules/axe/4.7/html-has-lang",
        nodes: [
          {
            html: "<html>",
            target: ["html"],
            failureSummary: "Add lang attribute to html element",
          },
        ],
      })
    }
  }

  // Check for color contrast issues (simplified check)
  // Note: Real contrast checking requires computed styles
  const elementsWithInlineColor = container.querySelectorAll("[style*='color']")
  elementsWithInlineColor.forEach((el) => {
    const style = el.getAttribute("style") || ""
    // Very basic check - flag if using very light colors on white
    if (style.includes("color: #fff") || style.includes("color: white")) {
      violations.push({
        id: "color-contrast",
        impact: "serious",
        description: "Elements must have sufficient color contrast",
        help: "Ensure text has sufficient color contrast",
        helpUrl: "https://dequeuniversity.com/rules/axe/4.7/color-contrast",
        nodes: [
          {
            html: el.outerHTML.slice(0, 100),
            target: [el.tagName.toLowerCase()],
            failureSummary: "Increase color contrast ratio",
          },
        ],
      })
    }
  })

  // Check for focus indicators (elements with tabindex but no focus styles)
  const focusableElements = container.querySelectorAll(
    "[tabindex]:not([tabindex='-1'])"
  )
  focusableElements.forEach((el) => {
    const style = el.getAttribute("style") || ""
    if (style.includes("outline: none") || style.includes("outline:none")) {
      violations.push({
        id: "focus-visible",
        impact: "serious",
        description: "Elements must have visible focus indicators",
        help: "Focusable elements should have visible focus styles",
        helpUrl: "https://dequeuniversity.com/rules/axe/4.7/focus-visible",
        nodes: [
          {
            html: el.outerHTML.slice(0, 100),
            target: [el.tagName.toLowerCase()],
            failureSummary: "Add visible focus indicator",
          },
        ],
      })
    }
  })

  return {
    violations,
    passes: [],
    incomplete: [],
    inapplicable: [],
  }
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Check accessibility of a rendered component
 *
 * @param container - DOM element to check
 * @param options - Accessibility check options
 * @returns Accessibility results
 *
 * @example
 * ```tsx
 * const { container } = render(<MyComponent />)
 * const results = await checkA11y(container)
 *
 * if (results.violations.length > 0) {
 *   console.log(formatA11yViolations(results.violations))
 * }
 *
 * expect(results.violations).toHaveLength(0)
 * ```
 */
/**
 * Axe-core result item interface (subset of axe.Result)
 */
interface AxeResultItem {
  id: string
  description: string
}

export async function checkA11y(
  container: Element,
  options?: A11yOptions
): Promise<A11yResults> {
  // Try to use axe-core if available
  try {
    // Dynamic import with type assertion for optional dependency
    const axeModule = await import("axe-core" as string) as {
      default: {
        run: (
          context: HTMLElement,
          options?: Record<string, unknown>
        ) => Promise<{
          violations: A11yViolation[]
          passes: AxeResultItem[]
          incomplete: AxeResultItem[]
          inapplicable: AxeResultItem[]
        }>
      }
    }

    const results = await axeModule.default.run(container as HTMLElement, {
      rules: options?.rules?.reduce(
        (acc, rule) => ({ ...acc, [rule]: { enabled: true } }),
        {} as Record<string, { enabled: boolean }>
      ),
    })

    return {
      violations: results.violations,
      passes: results.passes.map((p: AxeResultItem) => ({ id: p.id, description: p.description })),
      incomplete: results.incomplete.map((i: AxeResultItem) => ({
        id: i.id,
        description: i.description,
      })),
      inapplicable: results.inapplicable.map((i: AxeResultItem) => ({
        id: i.id,
        description: i.description,
      })),
    }
  } catch {
    // Fall back to simple checker if axe-core is not installed
    return simpleA11yCheck(container, options)
  }
}

/**
 * Format accessibility violations for console output
 *
 * @param violations - Array of violations to format
 * @returns Formatted string for logging
 */
export function formatA11yViolations(violations: A11yViolation[]): string {
  if (violations.length === 0) {
    return "No accessibility violations found"
  }

  const lines = [
    `Found ${violations.length} accessibility violation(s):`,
    "",
  ]

  violations.forEach((violation, index) => {
    lines.push(`${index + 1}. [${violation.impact.toUpperCase()}] ${violation.id}`)
    lines.push(`   ${violation.description}`)
    lines.push(`   Help: ${violation.help}`)
    lines.push(`   URL: ${violation.helpUrl}`)
    lines.push(`   Affected elements:`)

    violation.nodes.forEach((node) => {
      lines.push(`   - ${node.html}`)
      if (node.failureSummary) {
        lines.push(`     Fix: ${node.failureSummary}`)
      }
    })

    lines.push("")
  })

  return lines.join("\n")
}

/**
 * Jest/Vitest matcher for accessibility
 *
 * @example
 * ```tsx
 * expect(container).toBeAccessible()
 * ```
 */
export function toBeAccessible(container: Element): {
  pass: boolean
  message: () => string
} {
  // Synchronous basic checks for matcher
  const violations: string[] = []

  // Check images without alt
  if (container.querySelectorAll("img:not([alt])").length > 0) {
    violations.push("Images missing alt attribute")
  }

  // Check buttons without names
  const buttons = container.querySelectorAll("button")
  buttons.forEach((btn) => {
    if (
      !btn.textContent?.trim() &&
      !btn.getAttribute("aria-label") &&
      !btn.getAttribute("aria-labelledby")
    ) {
      violations.push("Button missing accessible name")
    }
  })

  // Check inputs without labels
  const inputs = container.querySelectorAll(
    "input:not([type='hidden']):not([type='submit']):not([type='button'])"
  )
  inputs.forEach((input) => {
    const id = input.getAttribute("id")
    const hasLabel =
      (id && container.querySelector(`label[for="${id}"]`)) ||
      input.getAttribute("aria-label") ||
      input.getAttribute("aria-labelledby")
    if (!hasLabel) {
      violations.push("Input missing label")
    }
  })

  const pass = violations.length === 0

  return {
    pass,
    message: () =>
      pass
        ? "Expected element to have accessibility violations"
        : `Accessibility violations found:\n${violations.map((v) => `  - ${v}`).join("\n")}`,
  }
}

/**
 * Create custom matchers for Vitest/Jest
 */
export function createA11yMatchers() {
  return {
    toBeAccessible,
  }
}

// =============================================================================
// WCAG RULE SETS
// =============================================================================

/**
 * WCAG 2.2 Level A rules
 */
export const WCAG_2_2_A_RULES = [
  "image-alt",
  "button-name",
  "link-name",
  "label",
  "html-has-lang",
  "valid-lang",
  "area-alt",
  "input-button-name",
  "input-image-alt",
  "object-alt",
  "role-img-alt",
  "svg-img-alt",
  "video-caption",
]

/**
 * WCAG 2.2 Level AA rules (includes Level A)
 */
export const WCAG_2_2_AA_RULES = [
  ...WCAG_2_2_A_RULES,
  "color-contrast",
  "focus-visible",
  "heading-order",
  "landmark-one-main",
  "page-has-heading-one",
  "region",
  "skip-link",
  "tabindex",
  "target-size",
]

/**
 * WCAG 2.2 Level AAA rules (includes Level A and AA)
 */
export const WCAG_2_2_AAA_RULES = [
  ...WCAG_2_2_AA_RULES,
  "color-contrast-enhanced",
  "identical-links-same-purpose",
  "link-in-text-block",
]

// =============================================================================
// EXPORTS
// =============================================================================

export { simpleA11yCheck }
