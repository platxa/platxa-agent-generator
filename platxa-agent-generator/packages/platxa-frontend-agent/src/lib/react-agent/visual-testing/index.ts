/**
 * Visual Regression Testing Module
 *
 * Tools for visual regression testing of React components.
 *
 * @module react-agent/visual-testing
 *
 * @example
 * ```typescript
 * import {
 *   createVisualConfig,
 *   createVisualTest,
 *   generatePlaywrightConfig,
 * } from "@platxa/frontend-agent/visual-testing"
 *
 * const config = createVisualConfig({
 *   threshold: 0.01,
 *   viewports: STANDARD_VIEWPORTS,
 * })
 *
 * // Generate Playwright configuration
 * const playwrightConfig = generatePlaywrightConfig(config)
 * ```
 */

export {
  // Configuration
  createVisualConfig,
  createResponsiveConfig,
  createCIConfig,
  DEFAULT_CONFIG,
  STANDARD_VIEWPORTS,
  // Comparison
  compareImages,
  // Snapshot management
  getSnapshotName,
  getSnapshotPaths,
  // Test runner
  createVisualTest,
  summarizeResults,
  // Code generation
  generatePlaywrightConfig,
  generateVisualTestFile,
  generateHtmlReport,
  // Default export
  default,
  // Types
  type VisualTestConfig,
  type Viewport,
  type ScreenshotOptions,
  type ComparisonResult,
  type VisualTestResult,
  type VisualTestSuiteResult,
} from "./visual-regression"
