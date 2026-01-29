/**
 * Visual Regression Testing - Tests
 *
 * Tests for visual regression testing utilities:
 * - Configuration creation
 * - Image comparison
 * - Snapshot management
 * - Code generation
 */

import { describe, it, expect } from "vitest"
import {
  createVisualConfig,
  createResponsiveConfig,
  createCIConfig,
  compareImages,
  getSnapshotName,
  getSnapshotPaths,
  createVisualTest,
  summarizeResults,
  generatePlaywrightConfig,
  generateVisualTestFile,
  generateHtmlReport,
  STANDARD_VIEWPORTS,
  type VisualTestResult,
  type Viewport,
} from "../visual-testing"

// =============================================================================
// Configuration Tests
// =============================================================================

describe("Configuration", () => {
  describe("createVisualConfig", () => {
    it("should return default config when no overrides", () => {
      const config = createVisualConfig()

      expect(config.snapshotDir).toBe("__snapshots__")
      expect(config.diffDir).toBe("__diffs__")
      expect(config.threshold).toBe(0.01)
      expect(config.antialiasing).toBe(true)
      expect(config.updateSnapshots).toBe(false)
    })

    it("should apply overrides", () => {
      const config = createVisualConfig({
        threshold: 0.05,
        snapshotDir: "custom-snapshots",
      })

      expect(config.threshold).toBe(0.05)
      expect(config.snapshotDir).toBe("custom-snapshots")
      expect(config.diffDir).toBe("__diffs__") // unchanged
    })

    it("should allow custom viewports", () => {
      const customViewports: Viewport[] = [
        { name: "custom", width: 1000, height: 600 },
      ]

      const config = createVisualConfig({ viewports: customViewports })

      expect(config.viewports).toEqual(customViewports)
    })
  })

  describe("createResponsiveConfig", () => {
    it("should include all standard viewports", () => {
      const config = createResponsiveConfig()

      expect(config.viewports).toEqual(STANDARD_VIEWPORTS)
      expect(config.viewports.length).toBe(4)
    })

    it("should still allow other overrides", () => {
      const config = createResponsiveConfig({ threshold: 0.02 })

      expect(config.threshold).toBe(0.02)
      expect(config.viewports).toEqual(STANDARD_VIEWPORTS)
    })
  })

  describe("createCIConfig", () => {
    it("should use stricter threshold", () => {
      const config = createCIConfig()

      expect(config.threshold).toBe(0.005)
      expect(config.failOnMissingBaseline).toBe(true)
      expect(config.updateSnapshots).toBe(false)
    })

    it("should allow overrides", () => {
      const config = createCIConfig({ threshold: 0.001 })

      expect(config.threshold).toBe(0.001)
    })
  })

  describe("STANDARD_VIEWPORTS", () => {
    it("should have mobile, tablet, desktop, and wide viewports", () => {
      const names = STANDARD_VIEWPORTS.map((v) => v.name)

      expect(names).toContain("mobile")
      expect(names).toContain("tablet")
      expect(names).toContain("desktop")
      expect(names).toContain("wide")
    })

    it("should mark mobile viewport as mobile", () => {
      const mobile = STANDARD_VIEWPORTS.find((v) => v.name === "mobile")

      expect(mobile?.isMobile).toBe(true)
      expect(mobile?.width).toBe(375)
    })

    it("should have reasonable desktop dimensions", () => {
      const desktop = STANDARD_VIEWPORTS.find((v) => v.name === "desktop")

      expect(desktop?.width).toBe(1280)
      expect(desktop?.height).toBe(800)
    })
  })
})

// =============================================================================
// Image Comparison Tests
// =============================================================================

describe("compareImages", () => {
  it("should report 0% diff for identical images", () => {
    const width = 2
    const height = 2
    // 2x2 red image (RGBA)
    const image = new Uint8Array([
      255, 0, 0, 255, 255, 0, 0, 255,
      255, 0, 0, 255, 255, 0, 0, 255,
    ])

    const result = compareImages(image, image, width, height)

    expect(result.diffPixels).toBe(0)
    expect(result.diffPercentage).toBe(0)
  })

  it("should detect completely different images", () => {
    const width = 2
    const height = 2
    // Red image
    const baseline = new Uint8Array([
      255, 0, 0, 255, 255, 0, 0, 255,
      255, 0, 0, 255, 255, 0, 0, 255,
    ])
    // Blue image
    const actual = new Uint8Array([
      0, 0, 255, 255, 0, 0, 255, 255,
      0, 0, 255, 255, 0, 0, 255, 255,
    ])

    const result = compareImages(baseline, actual, width, height, {
      threshold: 0.01,
      antialiasing: false,
    })

    expect(result.diffPixels).toBe(4) // All pixels different
    expect(result.diffPercentage).toBe(100)
  })

  it("should respect threshold for minor differences", () => {
    const width = 2
    const height = 2
    // Slightly different shades
    const baseline = new Uint8Array([
      100, 100, 100, 255, 100, 100, 100, 255,
      100, 100, 100, 255, 100, 100, 100, 255,
    ])
    const actual = new Uint8Array([
      102, 102, 102, 255, 102, 102, 102, 255,
      102, 102, 102, 255, 102, 102, 102, 255,
    ])

    // With high threshold, should pass
    const highThreshold = compareImages(baseline, actual, width, height, {
      threshold: 0.1,
      antialiasing: false,
    })
    expect(highThreshold.diffPixels).toBe(0)

    // With very low threshold, should fail
    const lowThreshold = compareImages(baseline, actual, width, height, {
      threshold: 0.001,
      antialiasing: false,
    })
    expect(lowThreshold.diffPixels).toBeGreaterThan(0)
  })

  it("should generate diff buffer with red pixels for differences", () => {
    const width = 2
    const height = 1
    const baseline = new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255])
    const actual = new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255])

    const result = compareImages(baseline, actual, width, height, {
      threshold: 0.01,
      antialiasing: false,
    })

    // First pixel should be marked red in diff
    expect(result.diffBuffer[0]).toBe(255) // R
    expect(result.diffBuffer[1]).toBe(0) // G
    expect(result.diffBuffer[2]).toBe(0) // B
  })
})

// =============================================================================
// Snapshot Management Tests
// =============================================================================

describe("Snapshot Management", () => {
  describe("getSnapshotName", () => {
    it("should generate valid file name", () => {
      const name = getSnapshotName("Button", "default state", {
        name: "desktop",
        width: 1280,
        height: 800,
      })

      expect(name).toBe("button-default-state-desktop.png")
    })

    it("should sanitize special characters", () => {
      const name = getSnapshotName("My/Component", "test@#$%", {
        name: "mobile",
        width: 375,
        height: 667,
      })

      expect(name).toBe("my-component-test-mobile.png")
      expect(name).not.toContain("/")
      expect(name).not.toContain("@")
    })

    it("should throw error for empty component name", () => {
      expect(() =>
        getSnapshotName("", "test", {
          name: "desktop",
          width: 1280,
          height: 800,
        })
      ).toThrow("Component name is required")
    })

    it("should use 'default' for empty test name", () => {
      const name = getSnapshotName("Button", "", {
        name: "desktop",
        width: 1280,
        height: 800,
      })

      expect(name).toBe("button-default-desktop.png")
    })
  })

  describe("getSnapshotPaths", () => {
    it("should generate correct paths", () => {
      const config = createVisualConfig({
        snapshotDir: "snapshots",
        diffDir: "diffs",
      })

      const paths = getSnapshotPaths(config, "Button", "hover", {
        name: "desktop",
        width: 1280,
        height: 800,
      })

      expect(paths.baseline).toBe("snapshots/button-hover-desktop.png")
      expect(paths.actual).toBe("snapshots/.actual/button-hover-desktop.png")
      expect(paths.diff).toBe("diffs/button-hover-desktop.png")
    })
  })
})

// =============================================================================
// Test Runner Tests
// =============================================================================

describe("createVisualTest", () => {
  it("should create a test function", () => {
    const config = createVisualConfig()
    const visualTest = createVisualTest(config)

    expect(typeof visualTest).toBe("function")
  })

  it("should handle missing baseline when updateSnapshots is true", async () => {
    const config = createVisualConfig({
      updateSnapshots: true,
      viewports: [{ name: "desktop", width: 1280, height: 800 }],
    })

    const visualTest = createVisualTest(config)
    const savedPaths: string[] = []

    const results = await visualTest(
      "test",
      "Component",
      async () => new Uint8Array([255, 0, 0, 255]),
      async () => null, // No baseline
      async (path) => {
        savedPaths.push(path)
      },
      () => ({ width: 1, height: 1 })
    )

    expect(results.length).toBe(1)
    expect(results[0].comparison.passed).toBe(true)
    // Should save both actual and baseline
    expect(savedPaths.length).toBe(2)
  })

  it("should fail when baseline missing and failOnMissingBaseline is true", async () => {
    const config = createVisualConfig({
      updateSnapshots: false,
      failOnMissingBaseline: true,
      viewports: [{ name: "desktop", width: 1280, height: 800 }],
    })

    const visualTest = createVisualTest(config)

    const results = await visualTest(
      "test",
      "Component",
      async () => new Uint8Array([255, 0, 0, 255]),
      async () => null, // No baseline
      async () => {},
      () => ({ width: 1, height: 1 })
    )

    expect(results.length).toBe(1)
    expect(results[0].comparison.passed).toBe(false)
    expect(results[0].comparison.error).toContain("Missing baseline")
  })
})

describe("summarizeResults", () => {
  const createResult = (passed: boolean): VisualTestResult => ({
    name: "test",
    component: "Component",
    viewport: { name: "desktop", width: 1280, height: 800 },
    comparison: {
      passed,
      diffPixels: passed ? 0 : 100,
      diffPercentage: passed ? 0 : 5,
      baselinePath: "baseline.png",
      actualPath: "actual.png",
    },
    duration: 100,
    timestamp: new Date().toISOString(),
  })

  it("should summarize all passing tests", () => {
    const results = [createResult(true), createResult(true)]
    const summary = summarizeResults("Suite", results)

    expect(summary.passed).toBe(2)
    expect(summary.failed).toBe(0)
    expect(summary.summary).toContain("All 2 visual tests passed")
  })

  it("should summarize mixed results", () => {
    const results = [createResult(true), createResult(false)]
    const summary = summarizeResults("Suite", results)

    expect(summary.passed).toBe(1)
    expect(summary.failed).toBe(1)
    expect(summary.summary).toContain("1 of 2 visual tests failed")
  })

  it("should calculate total duration", () => {
    const results = [createResult(true), createResult(true)]
    const summary = summarizeResults("Suite", results)

    expect(summary.duration).toBe(200)
  })
})

// =============================================================================
// Code Generation Tests
// =============================================================================

describe("generatePlaywrightConfig", () => {
  it("should generate valid Playwright config", () => {
    const config = createVisualConfig({
      snapshotDir: "snapshots",
      threshold: 0.01,
    })

    const playwrightConfig = generatePlaywrightConfig(config)

    expect(playwrightConfig).toContain('import { defineConfig')
    expect(playwrightConfig).toContain('snapshotDir: "snapshots"')
    expect(playwrightConfig).toContain("threshold: 0.01")
    expect(playwrightConfig).toContain("projects:")
  })

  it("should include all viewports as projects", () => {
    const config = createResponsiveConfig()
    const playwrightConfig = generatePlaywrightConfig(config)

    expect(playwrightConfig).toContain('name: "mobile"')
    expect(playwrightConfig).toContain('name: "tablet"')
    expect(playwrightConfig).toContain('name: "desktop"')
    expect(playwrightConfig).toContain('name: "wide"')
  })

  it("should mark mobile viewports correctly", () => {
    const config = createResponsiveConfig()
    const playwrightConfig = generatePlaywrightConfig(config)

    expect(playwrightConfig).toContain("isMobile: true")
  })

  it("should include Storybook webServer config", () => {
    const config = createVisualConfig()
    const playwrightConfig = generatePlaywrightConfig(config)

    expect(playwrightConfig).toContain("webServer:")
    expect(playwrightConfig).toContain("npm run storybook")
    expect(playwrightConfig).toContain("http://localhost:6006")
  })
})

describe("generateVisualTestFile", () => {
  it("should generate test file with stories", () => {
    const testFile = generateVisualTestFile("Button", ["Default", "Disabled"])

    expect(testFile).toContain('test.describe("Button Visual Tests"')
    expect(testFile).toContain('test("Default"')
    expect(testFile).toContain('test("Disabled"')
  })

  it("should include correct Storybook URL", () => {
    const testFile = generateVisualTestFile("Card", ["Default"])

    expect(testFile).toContain("iframe.html?id=card--default")
  })

  it("should handle screenshot options", () => {
    const testFile = generateVisualTestFile("Modal", ["Open"], {
      waitForAnimations: true,
      animationTimeout: 500,
      selector: ".modal-content",
    })

    expect(testFile).toContain("waitForTimeout(500)")
    expect(testFile).toContain('.locator(".modal-content")')
  })

  it("should include mask selectors when provided", () => {
    const testFile = generateVisualTestFile("Dashboard", ["Default"], {
      maskSelectors: [".timestamp", ".avatar"],
    })

    expect(testFile).toContain('mask: [page.locator(".timestamp")')
    expect(testFile).toContain('page.locator(".avatar")')
  })
})

describe("generateHtmlReport", () => {
  it("should generate valid HTML", () => {
    const suiteResult = summarizeResults("Test Suite", [
      {
        name: "test",
        component: "Button",
        viewport: { name: "desktop", width: 1280, height: 800 },
        comparison: {
          passed: true,
          diffPixels: 0,
          diffPercentage: 0,
          baselinePath: "baseline.png",
          actualPath: "actual.png",
        },
        duration: 100,
        timestamp: new Date().toISOString(),
      },
    ])

    const html = generateHtmlReport(suiteResult)

    expect(html).toContain("<!DOCTYPE html>")
    expect(html).toContain("<html")
    expect(html).toContain("Visual Regression Report")
    expect(html).toContain("Test Suite")
  })

  it("should show failed tests section when there are failures", () => {
    const suiteResult = summarizeResults("Suite", [
      {
        name: "failing test",
        component: "Button",
        viewport: { name: "desktop", width: 1280, height: 800 },
        comparison: {
          passed: false,
          diffPixels: 100,
          diffPercentage: 5.5,
          baselinePath: "baseline.png",
          actualPath: "actual.png",
          diffImagePath: "diff.png",
        },
        duration: 100,
        timestamp: new Date().toISOString(),
      },
    ])

    const html = generateHtmlReport(suiteResult)

    expect(html).toContain("Failed Tests")
    expect(html).toContain("5.50% diff")
    expect(html).toContain("diff.png")
  })

  it("should use appropriate styling for pass/fail", () => {
    const passingResult = summarizeResults("Suite", [
      {
        name: "test",
        component: "Button",
        viewport: { name: "desktop", width: 1280, height: 800 },
        comparison: {
          passed: true,
          diffPixels: 0,
          diffPercentage: 0,
          baselinePath: "b.png",
          actualPath: "a.png",
        },
        duration: 100,
        timestamp: new Date().toISOString(),
      },
    ])

    const html = generateHtmlReport(passingResult)

    expect(html).toContain('class="summary pass"')
    expect(html).toContain('class="badge pass"')
  })
})

// =============================================================================
// Edge Cases
// =============================================================================

describe("Edge Cases", () => {
  it("should handle empty viewport array", () => {
    const config = createVisualConfig({ viewports: [] })

    expect(config.viewports).toEqual([])
  })

  it("should handle very long component names", () => {
    const longName = "A".repeat(200)
    const snapshotName = getSnapshotName(longName, "test", {
      name: "desktop",
      width: 1280,
      height: 800,
    })

    expect(snapshotName).toContain(".png")
    expect(snapshotName.length).toBeLessThan(300)
  })

  it("should handle empty test results for summary", () => {
    const summary = summarizeResults("Empty Suite", [])

    expect(summary.passed).toBe(0)
    expect(summary.failed).toBe(0)
    expect(summary.duration).toBe(0)
  })
})
