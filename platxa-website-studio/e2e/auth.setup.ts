import { test as setup, expect } from "@playwright/test";

/**
 * E2E Test user credentials
 * Must match E2E_TEST_USER in lib/auth/env.ts
 */
const TEST_USER = {
  email: "e2e-test@platxa.dev",
  password: "E2ETestPassword123!",
  name: "E2E Test User",
};

const AUTH_FILE = "e2e/.auth/user.json";

/**
 * Global authentication setup for E2E tests
 *
 * This setup runs before all test projects and:
 * 1. Attempts to log in with the seeded test user
 * 2. Falls back to signup if login fails (first run scenario)
 * 3. Stores authenticated session state for reuse across all tests
 *
 * Prerequisites:
 * - Server must be running with E2E_TEST_MODE=true or PLAYWRIGHT_TEST=true
 * - This seeds the test user automatically on server startup
 */
setup("authenticate", async ({ page }) => {
  // Navigate to login page
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  // Wait for login form
  await expect(page.locator("h1")).toContainText("Welcome Back", { timeout: 10000 });

  // Fill login form - note: field is "credential" not "password" per actual implementation
  await page.locator("#email").fill(TEST_USER.email);
  await page.locator("#credential").fill(TEST_USER.password);

  // Submit login
  await page.locator('button[type="submit"]').click();

  // Wait for navigation - should redirect to "/" on success
  const loginResult = await Promise.race([
    page.waitForURL("/", { timeout: 10000 }).then(() => "success" as const),
    page.waitForSelector(".text-red-400", { timeout: 10000 }).then(() => "error" as const),
  ]).catch(() => "timeout" as const);

  if (loginResult === "error" || loginResult === "timeout") {
    // Login failed - try signup (user might not exist yet)
    console.log("[E2E Auth] Login failed, attempting signup...");

    await page.goto("/signup");
    await page.waitForLoadState("networkidle");

    // Wait for signup form
    await expect(page.locator("h1")).toContainText("Create Account", { timeout: 10000 });

    // Fill signup form
    await page.locator("#name").fill(TEST_USER.name);
    await page.locator("#email").fill(TEST_USER.email);
    await page.locator("#credential").fill(TEST_USER.password);
    await page.locator("#confirmCredential").fill(TEST_USER.password);

    // Submit signup
    await page.locator('button[type="submit"]').click();

    // Wait for redirect to studio
    await page.waitForURL("/", { timeout: 15000 });
  }

  // Verify we're authenticated and on the studio page
  await expect(page).toHaveURL("/");

  // Wait for studio layout to be visible (confirms auth worked)
  await page.waitForSelector('[data-testid="studio-layout"], main', {
    state: "visible",
    timeout: 15000,
  });

  console.log("[E2E Auth] Authentication successful, saving session state...");

  // Save storage state for reuse in all tests
  await page.context().storageState({ path: AUTH_FILE });
});

export { TEST_USER };
