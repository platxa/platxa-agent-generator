/**
 * Test Generator Module
 *
 * Converts test plans into executable test code for various frameworks:
 * - Playwright (e2e testing)
 * - Cypress (e2e testing)
 * - Vitest + React Testing Library (unit/integration)
 * - Jest + React Testing Library (unit/integration)
 */

// Types
export type {
  TestFramework,
  GeneratedTestFile,
  TestGenerationResult,
  TestGeneratorConfig,
  FrameworkTemplates,
  AssertionTemplates,
  ActionTemplates,
  SelectorTemplates,
  TestStep,
  ParsedTestCase,
  ComponentContext,
} from "./types"

// Core functions
export {
  generateTests,
  generateTestsMultiFramework,
  generateTestFile,
  generateSuiteCode,
  generateTestCaseCode,
  getFrameworkTemplates,
  parseStep,
  parseTestCase,
} from "./test-generator"
