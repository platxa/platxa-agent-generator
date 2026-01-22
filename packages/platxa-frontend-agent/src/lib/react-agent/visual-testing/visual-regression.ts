/**
 * Visual Regression Testing Utilities
 *
 * Provides tools for visual regression testing of React components:
 * - Snapshot comparison with configurable thresholds
 * - Screenshot capture configuration
 * - Diff image generation
 * - Multi-viewport testing
 *
 * @module react-agent/visual-testing
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Visual test configuration
 */
export interface VisualTestConfig {
  /** Base directory for snapshots */
  snapshotDir: string
  /** Directory for diff images */
  diffDir: string
  /** Threshold for pixel difference (0-1) */
  threshold: number
  /** Anti-aliasing detection */
  antialiasing: boolean
  /** Viewports to test */
  viewports: Viewport[]
  /** Update snapshots instead of comparing */
  updateSnapshots: boolean
  /** Fail on missing baseline */
  failOnMissingBaseline: boolean
}

/**
 * Viewport configuration
 */
export interface Viewport {
  /** Viewport name */
  name: string
  /** Width in pixels */
  width: number
  /** Height in pixels */
  height: number
  /** Device scale factor */
  deviceScaleFactor?: number
  /** Is mobile viewport */
  isMobile?: boolean
}

/**
 * Screenshot options
 */
export interface ScreenshotOptions {
  /** Element selector to capture (full page if not specified) */
  selector?: string
  /** Padding around element */
  padding?: number
  /** Wait for animations to complete */
  waitForAnimations?: boolean
  /** Animation timeout in ms */
  animationTimeout?: number
  /** Mask selectors (elements to hide) */
  maskSelectors?: string[]
  /** Custom styles to inject before capture */
  injectStyles?: string
  /** Wait for specific selector before capture */
  waitForSelector?: string
}

/**
 * Comparison result
 */
export interface ComparisonResult {
  /** Whether images match within threshold */
  passed: boolean
  /** Pixel difference count */
  diffPixels: number
  /** Percentage of different pixels */
  diffPercentage: number
  /** Path to diff image (if generated) */
  diffImagePath?: string
  /** Path to baseline image */
  baselinePath: string
  /** Path to actual image */
  actualPath: string
  /** Error message if comparison failed */
  error?: string
}

/**
 * Visual test result
 */
export interface VisualTestResult {
  /** Test name */
  name: string
  /** Component being tested */
  component: string
  /** Viewport used */
  viewport: Viewport
  /** Comparison result */
  comparison: ComparisonResult
  /** Duration in ms */
  duration: number
  /** Timestamp */
  timestamp: string
}

/**
 * Visual test suite result
 */
export interface VisualTestSuiteResult {
  /** Suite name */
  name: string
  /** All test results */
  results: VisualTestResult[]
  /** Number of passed tests */
  passed: number
  /** Number of failed tests */
  failed: number
  /** Total duration */
  duration: number
  /** Summary message */
  summary: string
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

/**
 * Standard viewports for responsive testing
 */
export const STANDARD_VIEWPORTS: Viewport[] = [
  { name: "mobile", width: 375, height: 667, isMobile: true },
  { name: "tablet", width: 768, height: 1024, isMobile: false },
  { name: "desktop", width: 1280, height: 800, isMobile: false },
  { name: "wide", width: 1920, height: 1080, isMobile: false },
]

/**
 * Default visual test configuration
 */
export const DEFAULT_CONFIG: VisualTestConfig = {
  snapshotDir: "__snapshots__",
  diffDir: "__diffs__",
  threshold: 0.01, // 1% difference allowed
  antialiasing: true,
  viewports: [STANDARD_VIEWPORTS[2]], // desktop only by default
  updateSnapshots: false,
  failOnMissingBaseline: true,
}

// =============================================================================
// CONFIGURATION BUILDER
// =============================================================================

/**
 * Create visual test configuration with overrides
 */
export function createVisualConfig(
  overrides: Partial<VisualTestConfig> = {}
): VisualTestConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    viewports: overrides.viewports || DEFAULT_CONFIG.viewports,
  }
}

/**
 * Create configuration for full responsive testing
 */
export function createResponsiveConfig(
  overrides: Partial<VisualTestConfig> = {}
): VisualTestConfig {
  return createVisualConfig({
    ...overrides,
    viewports: STANDARD_VIEWPORTS,
  })
}

/**
 * Create configuration for CI environment
 */
export function createCIConfig(
  overrides: Partial<VisualTestConfig> = {}
): VisualTestConfig {
  return createVisualConfig({
    threshold: 0.005, // Stricter threshold for CI
    failOnMissingBaseline: true,
    updateSnapshots: false,
    ...overrides,
  })
}

// =============================================================================
// PIXEL COMPARISON
// =============================================================================

/**
 * Compare two image buffers and return difference metrics
 */
export function compareImages(
  baseline: Uint8Array,
  actual: Uint8Array,
  width: number,
  height: number,
  options: { threshold: number; antialiasing: boolean } = {
    threshold: 0.01,
    antialiasing: true,
  }
): { diffPixels: number; diffPercentage: number; diffBuffer: Uint8Array } {
  const totalPixels = width * height
  let diffPixels = 0
  const diffBuffer = new Uint8Array(baseline.length)

  // Copy baseline as starting point for diff
  diffBuffer.set(baseline)

  for (let i = 0; i < baseline.length; i += 4) {
    const rDiff = Math.abs(baseline[i] - actual[i])
    const gDiff = Math.abs(baseline[i + 1] - actual[i + 1])
    const bDiff = Math.abs(baseline[i + 2] - actual[i + 2])
    const aDiff = Math.abs(baseline[i + 3] - actual[i + 3])

    // Calculate color distance
    const colorDiff = Math.sqrt(
      rDiff * rDiff + gDiff * gDiff + bDiff * bDiff + aDiff * aDiff
    )
    const maxDiff = Math.sqrt(255 * 255 * 4) // Max possible difference

    // Check if difference exceeds threshold
    if (colorDiff / maxDiff > options.threshold) {
      // Check for anti-aliasing if enabled
      if (options.antialiasing && isAntialiasedPixel(baseline, actual, i, width)) {
        continue
      }

      diffPixels++

      // Mark difference in red
      diffBuffer[i] = 255 // R
      diffBuffer[i + 1] = 0 // G
      diffBuffer[i + 2] = 0 // B
      diffBuffer[i + 3] = 255 // A
    }
  }

  return {
    diffPixels,
    diffPercentage: (diffPixels / totalPixels) * 100,
    diffBuffer,
  }
}

/**
 * Check if a pixel difference is likely due to anti-aliasing
 */
function isAntialiasedPixel(
  baseline: Uint8Array,
  actual: Uint8Array,
  index: number,
  width: number
): boolean {
  // Check neighboring pixels for smooth color transitions
  const neighbors = [
    index - 4, // left
    index + 4, // right
    index - width * 4, // top
    index + width * 4, // bottom
  ]

  let smoothTransitions = 0

  for (const neighborIndex of neighbors) {
    if (neighborIndex < 0 || neighborIndex >= baseline.length) continue

    const baselineDiff = getColorDifference(baseline, index, baseline, neighborIndex)
    const actualDiff = getColorDifference(actual, index, actual, neighborIndex)

    // If both baseline and actual have similar gradients, likely anti-aliasing
    if (Math.abs(baselineDiff - actualDiff) < 50) {
      smoothTransitions++
    }
  }

  return smoothTransitions >= 2
}

/**
 * Calculate color difference between two pixels
 */
function getColorDifference(
  buffer1: Uint8Array,
  index1: number,
  buffer2: Uint8Array,
  index2: number
): number {
  const rDiff = buffer1[index1] - buffer2[index2]
  const gDiff = buffer1[index1 + 1] - buffer2[index2 + 1]
  const bDiff = buffer1[index1 + 2] - buffer2[index2 + 2]

  return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff)
}

// =============================================================================
// SNAPSHOT MANAGEMENT
// =============================================================================

/**
 * Generate snapshot file name
 * @throws Error if component name is empty after sanitization
 */
export function getSnapshotName(
  component: string,
  testName: string,
  viewport: Viewport
): string {
  const sanitizedComponent = sanitizeFileName(component)
  const sanitizedTest = sanitizeFileName(testName)

  // Validate: component name is required
  if (!sanitizedComponent) {
    throw new Error(
      "Component name is required for snapshot naming. Received empty or invalid component name."
    )
  }

  // Use "default" for empty test name
  const finalTestName = sanitizedTest || "default"

  return `${sanitizedComponent}-${finalTestName}-${viewport.name}.png`
}

/**
 * Sanitize string for use in file names
 */
function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

/**
 * Generate snapshot paths
 */
export function getSnapshotPaths(
  config: VisualTestConfig,
  component: string,
  testName: string,
  viewport: Viewport
): { baseline: string; actual: string; diff: string } {
  const snapshotName = getSnapshotName(component, testName, viewport)

  return {
    baseline: `${config.snapshotDir}/${snapshotName}`,
    actual: `${config.snapshotDir}/.actual/${snapshotName}`,
    diff: `${config.diffDir}/${snapshotName}`,
  }
}

// =============================================================================
// TEST RUNNER HELPERS
// =============================================================================

/**
 * Create a visual test function for use with test frameworks
 */
export function createVisualTest(config: VisualTestConfig) {
  return async function visualTest(
    name: string,
    component: string,
    captureScreenshot: (viewport: Viewport) => Promise<Uint8Array>,
    loadBaseline: (path: string) => Promise<Uint8Array | null>,
    saveImage: (path: string, data: Uint8Array) => Promise<void>,
    getImageDimensions: (data: Uint8Array) => { width: number; height: number }
  ): Promise<VisualTestResult[]> {
    const results: VisualTestResult[] = []

    for (const viewport of config.viewports) {
      const startTime = Date.now()
      const paths = getSnapshotPaths(config, component, name, viewport)

      try {
        // Capture screenshot
        const actual = await captureScreenshot(viewport)
        const { width, height } = getImageDimensions(actual)

        // Save actual screenshot
        await saveImage(paths.actual, actual)

        // Load baseline
        const baseline = await loadBaseline(paths.baseline)

        if (!baseline) {
          if (config.updateSnapshots) {
            // Create new baseline
            await saveImage(paths.baseline, actual)
            results.push({
              name,
              component,
              viewport,
              comparison: {
                passed: true,
                diffPixels: 0,
                diffPercentage: 0,
                baselinePath: paths.baseline,
                actualPath: paths.actual,
              },
              duration: Date.now() - startTime,
              timestamp: new Date().toISOString(),
            })
          } else if (config.failOnMissingBaseline) {
            results.push({
              name,
              component,
              viewport,
              comparison: {
                passed: false,
                diffPixels: 0,
                diffPercentage: 0,
                baselinePath: paths.baseline,
                actualPath: paths.actual,
                error: `Missing baseline image: ${paths.baseline}`,
              },
              duration: Date.now() - startTime,
              timestamp: new Date().toISOString(),
            })
          }
          continue
        }

        // Compare images
        const { diffPixels, diffPercentage, diffBuffer } = compareImages(
          baseline,
          actual,
          width,
          height,
          { threshold: config.threshold, antialiasing: config.antialiasing }
        )

        const passed = diffPercentage <= config.threshold * 100

        // Save diff image if failed
        let diffImagePath: string | undefined
        if (!passed) {
          await saveImage(paths.diff, diffBuffer)
          diffImagePath = paths.diff
        }

        results.push({
          name,
          component,
          viewport,
          comparison: {
            passed,
            diffPixels,
            diffPercentage,
            diffImagePath,
            baselinePath: paths.baseline,
            actualPath: paths.actual,
          },
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        })
      } catch (error) {
        results.push({
          name,
          component,
          viewport,
          comparison: {
            passed: false,
            diffPixels: 0,
            diffPercentage: 0,
            baselinePath: paths.baseline,
            actualPath: paths.actual,
            error: error instanceof Error ? error.message : String(error),
          },
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        })
      }
    }

    return results
  }
}

/**
 * Summarize test suite results
 */
export function summarizeResults(
  name: string,
  results: VisualTestResult[]
): VisualTestSuiteResult {
  const passed = results.filter((r) => r.comparison.passed).length
  const failed = results.length - passed
  const duration = results.reduce((sum, r) => sum + r.duration, 0)

  let summary: string
  if (failed === 0) {
    summary = `✓ All ${passed} visual tests passed`
  } else {
    summary = `✗ ${failed} of ${results.length} visual tests failed`
  }

  return {
    name,
    results,
    passed,
    failed,
    duration,
    summary,
  }
}

// =============================================================================
// PLAYWRIGHT INTEGRATION HELPERS
// =============================================================================

/**
 * Generate Playwright test configuration for visual testing
 */
export function generatePlaywrightConfig(config: VisualTestConfig): string {
  return `import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/visual",
  snapshotDir: "${config.snapshotDir}",

  expect: {
    toHaveScreenshot: {
      threshold: ${config.threshold},
      animations: "disabled",
    },
  },

  use: {
    baseURL: "http://localhost:6006", // Storybook URL
    trace: "on-first-retry",
  },

  projects: [
${config.viewports
  .map(
    (vp) => `    {
      name: "${vp.name}",
      use: {
        viewport: { width: ${vp.width}, height: ${vp.height} },
        ${vp.isMobile ? 'isMobile: true,' : ''}
        ${vp.deviceScaleFactor ? `deviceScaleFactor: ${vp.deviceScaleFactor},` : ''}
      },
    },`
  )
  .join("\n")}
  ],

  webServer: {
    command: "npm run storybook",
    url: "http://localhost:6006",
    reuseExistingServer: !process.env.CI,
  },
})
`
}

/**
 * Generate a visual test file for a component
 */
export function generateVisualTestFile(
  component: string,
  stories: string[],
  options: ScreenshotOptions = {}
): string {
  const waitCode = options.waitForAnimations
    ? `await page.waitForTimeout(${options.animationTimeout || 300})`
    : ""

  const maskCode = options.maskSelectors?.length
    ? `mask: [${options.maskSelectors.map((s) => `page.locator("${s}")`).join(", ")}],`
    : ""

  const styleCode = options.injectStyles
    ? `await page.addStyleTag({ content: \`${options.injectStyles}\` })`
    : ""

  return `import { test, expect } from "@playwright/test"

test.describe("${component} Visual Tests", () => {
${stories
  .map(
    (story) => `  test("${story}", async ({ page }) => {
    await page.goto("/iframe.html?id=${component.toLowerCase()}--${story.toLowerCase()}")
    ${options.waitForSelector ? `await page.waitForSelector("${options.waitForSelector}")` : ""}
    ${styleCode}
    ${waitCode}

    await expect(page${options.selector ? `.locator("${options.selector}")` : ""}).toHaveScreenshot({
      ${maskCode}
      ${options.padding ? `padding: ${options.padding},` : ""}
    })
  })
`
  )
  .join("\n")}
})
`
}

// =============================================================================
// REPORTING
// =============================================================================

/**
 * Generate HTML report for visual test results
 */
export function generateHtmlReport(suiteResult: VisualTestSuiteResult): string {
  const failedTests = suiteResult.results.filter((r) => !r.comparison.passed)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Visual Regression Report - ${suiteResult.name}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    .summary { padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .summary.pass { background: #d4edda; }
    .summary.fail { background: #f8d7da; }
    .test { border: 1px solid #ddd; border-radius: 8px; margin-bottom: 20px; overflow: hidden; }
    .test-header { padding: 15px; background: #f5f5f5; display: flex; justify-content: space-between; }
    .test-header.fail { background: #f8d7da; }
    .test-body { padding: 15px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
    .test-body img { max-width: 100%; border: 1px solid #ddd; }
    .label { font-size: 12px; color: #666; margin-bottom: 5px; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
    .badge.pass { background: #28a745; color: white; }
    .badge.fail { background: #dc3545; color: white; }
  </style>
</head>
<body>
  <h1>Visual Regression Report</h1>
  <div class="summary ${suiteResult.failed > 0 ? "fail" : "pass"}">
    <h2>${suiteResult.summary}</h2>
    <p>Duration: ${suiteResult.duration}ms</p>
  </div>

  ${
    failedTests.length > 0
      ? `<h2>Failed Tests</h2>
  ${failedTests
    .map(
      (test) => `
    <div class="test">
      <div class="test-header fail">
        <span><strong>${test.component}</strong> - ${test.name} (${test.viewport.name})</span>
        <span class="badge fail">${test.comparison.diffPercentage.toFixed(2)}% diff</span>
      </div>
      <div class="test-body">
        <div>
          <div class="label">Baseline</div>
          <img src="${test.comparison.baselinePath}" alt="Baseline">
        </div>
        <div>
          <div class="label">Actual</div>
          <img src="${test.comparison.actualPath}" alt="Actual">
        </div>
        <div>
          <div class="label">Diff</div>
          <img src="${test.comparison.diffImagePath || ""}" alt="Diff">
        </div>
      </div>
    </div>
  `
    )
    .join("")}`
      : ""
  }

  <h2>All Tests</h2>
  <table style="width: 100%; border-collapse: collapse;">
    <thead>
      <tr style="background: #f5f5f5;">
        <th style="padding: 10px; text-align: left;">Component</th>
        <th style="padding: 10px; text-align: left;">Test</th>
        <th style="padding: 10px; text-align: left;">Viewport</th>
        <th style="padding: 10px; text-align: left;">Status</th>
        <th style="padding: 10px; text-align: right;">Diff %</th>
      </tr>
    </thead>
    <tbody>
      ${suiteResult.results
        .map(
          (test) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #ddd;">${test.component}</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd;">${test.name}</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd;">${test.viewport.name}</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd;">
            <span class="badge ${test.comparison.passed ? "pass" : "fail"}">
              ${test.comparison.passed ? "PASS" : "FAIL"}
            </span>
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">
            ${test.comparison.diffPercentage.toFixed(4)}%
          </td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>
</body>
</html>
`
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default {
  createVisualConfig,
  createResponsiveConfig,
  createCIConfig,
  createVisualTest,
  compareImages,
  getSnapshotName,
  getSnapshotPaths,
  summarizeResults,
  generatePlaywrightConfig,
  generateVisualTestFile,
  generateHtmlReport,
  STANDARD_VIEWPORTS,
  DEFAULT_CONFIG,
}
