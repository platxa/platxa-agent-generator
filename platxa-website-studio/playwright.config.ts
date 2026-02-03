import { defineConfig, devices } from "@playwright/test";
import path from "path";

/**
 * Playwright E2E Test Configuration
 *
 * @see https://playwright.dev/docs/test-configuration
 */

const AUTH_FILE = path.join(__dirname, "e2e/.auth/user.json");

export default defineConfig({
  // Test directory
  testDir: "./e2e",

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ...(process.env.CI ? [["github", {}] as const] : []),
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",

    // Collect trace when retrying the failed test
    trace: "on-first-retry",

    // Take screenshots on failure
    screenshot: "only-on-failure",

    // Record video on failure
    video: "on-first-retry",

    // Maximum time each action such as `click()` can take
    actionTimeout: 10000,

    // Maximum time each navigation can take
    navigationTimeout: 30000,
  },

  // Configure projects for major browsers
  projects: [
    // Authentication setup - runs first and creates session
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },

    // Desktop browsers - depend on setup
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: AUTH_FILE,
      },
      dependencies: ["setup"],
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        storageState: AUTH_FILE,
      },
      dependencies: ["setup"],
    },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        storageState: AUTH_FILE,
      },
      dependencies: ["setup"],
    },
    // Mobile viewports - depend on setup
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 5"],
        storageState: AUTH_FILE,
      },
      dependencies: ["setup"],
    },
    {
      name: "mobile-safari",
      use: {
        ...devices["iPhone 12"],
        storageState: AUTH_FILE,
      },
      dependencies: ["setup"],
    },
  ],

  // Run local dev server before starting the tests
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      // Enable E2E test mode to seed test user
      PLAYWRIGHT_TEST: "true",
    },
  },

  // Global timeout for tests
  timeout: 30000,

  // Expect timeout
  expect: {
    timeout: 5000,
  },
});
