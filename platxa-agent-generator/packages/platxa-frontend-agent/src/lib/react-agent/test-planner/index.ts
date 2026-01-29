/**
 * Test Planner Module
 *
 * Generates comprehensive test plans from UI component specifications.
 *
 * @example
 * ```typescript
 * import {
 *   generateTestPlan,
 *   toMarkdown,
 *   extractSpecFromRequirements,
 * } from "@/lib/react-agent/test-planner"
 *
 * // From component spec
 * const spec: ComponentSpec = {
 *   name: "Button",
 *   type: "button",
 *   props: [
 *     { name: "variant", type: "string", required: false, validValues: ["primary", "secondary"] },
 *     { name: "size", type: "string", required: false, defaultValue: "md" },
 *   ],
 *   states: [
 *     { name: "hover", description: "Hover state", visualChanges: ["Background darkens"] },
 *     { name: "disabled", description: "Disabled state", visualChanges: ["Opacity reduced"] },
 *   ],
 *   events: [
 *     { name: "onClick", description: "Click event", trigger: "Click", expectedBehavior: "Handler called" },
 *   ],
 *   accessibility: {
 *     role: "button",
 *     keyboardInteractions: ["Enter/Space activates"],
 *   },
 * }
 *
 * const plan = generateTestPlan(spec, {
 *   includeAccessibility: true,
 *   includeVisual: true,
 * })
 *
 * const markdown = toMarkdown(plan, {
 *   includeToc: true,
 *   includeCodeTemplates: true,
 * })
 *
 * console.log(markdown)
 * ```
 *
 * @module react-agent/test-planner
 */

// Main functions
export {
  generateTestPlan,
  toMarkdown,
  extractSpecFromRequirements,
  resetTestIdCounter,
  // Individual test generators
  generatePropTests,
  generateStateTests,
  generateEventTests,
  generateAccessibilityTests,
  generateVisualTests,
  generateIntegrationTests,
  generateE2ETests,
  generatePerformanceTests,
} from "./test-planner"

// Type exports
export type {
  TestPlan,
  TestSuite,
  TestCase,
  TestCategory,
  TestPriority,
  TestPlanSummary,
  CoverageAnalysis,
  ComponentSpec,
  PropSpec,
  StateSpec,
  EventSpec,
  AccessibilitySpec,
  TestPlannerConfig,
  MarkdownOptions,
} from "./types"
