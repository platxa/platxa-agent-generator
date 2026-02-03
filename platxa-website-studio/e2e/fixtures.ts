import { test as base, expect } from "@playwright/test";

/**
 * Extended test fixtures for Platxa Website Studio E2E tests
 */

// Custom fixture types
interface PlatxaFixtures {
  /** Wait for app to be fully loaded */
  waitForAppReady: () => Promise<void>;
  /** Navigate to studio and wait for load */
  openStudio: () => Promise<void>;
  /** Type a message in the chat panel */
  sendChatMessage: (message: string) => Promise<void>;
  /** Wait for AI response in chat */
  waitForAIResponse: () => Promise<void>;
  /** Get the current file content from editor */
  getEditorContent: () => Promise<string>;
  /** Select a file in the file tree */
  selectFile: (filename: string) => Promise<void>;
  /** Change preview device */
  setPreviewDevice: (device: "mobile" | "tablet" | "desktop") => Promise<void>;
}

export const test = base.extend<PlatxaFixtures>({
  waitForAppReady: async ({ page }, use) => {
    await use(async () => {
      // Wait for Next.js hydration
      await page.waitForLoadState("networkidle");
      // Wait for main layout to be visible
      await page.waitForSelector('[data-testid="studio-layout"]', {
        state: "visible",
        timeout: 15000,
      }).catch(() => {
        // Fallback: wait for any main content
        return page.waitForSelector("main", { state: "visible" });
      });
    });
  },

  openStudio: async ({ page, waitForAppReady }, use) => {
    await use(async () => {
      await page.goto("/");
      await waitForAppReady();
    });
  },

  sendChatMessage: async ({ page }, use) => {
    await use(async (message: string) => {
      const chatInput = page.locator('[data-testid="chat-input"]').or(
        page.locator('textarea[placeholder*="message"]')
      ).or(
        page.locator('input[placeholder*="message"]')
      );
      await chatInput.fill(message);

      const sendButton = page.locator('[data-testid="chat-send"]').or(
        page.locator('button[type="submit"]')
      );
      await sendButton.click();
    });
  },

  waitForAIResponse: async ({ page }, use) => {
    await use(async () => {
      // Wait for loading indicator to appear and disappear
      const loadingIndicator = page.locator('[data-testid="chat-loading"]').or(
        page.locator('[data-loading="true"]')
      );

      // Wait for loading to start (with short timeout - it might be fast)
      await loadingIndicator.waitFor({ state: "visible", timeout: 2000 }).catch(() => {});

      // Wait for loading to finish
      await loadingIndicator.waitFor({ state: "hidden", timeout: 60000 }).catch(() => {});

      // Wait for AI message to appear
      await page.waitForSelector('[data-testid="ai-message"]', {
        state: "visible",
        timeout: 60000,
      }).catch(() => {
        // Fallback: wait for any new content
        return page.waitForTimeout(1000);
      });
    });
  },

  getEditorContent: async ({ page }, use) => {
    await use(async () => {
      // Monaco editor stores content in a specific way
      const editorContent = await page.evaluate(() => {
        // Try to get Monaco editor instance
        const monacoEditor = (window as unknown as { monaco?: { editor?: { getModels?: () => Array<{ getValue: () => string }> } } }).monaco?.editor?.getModels?.();
        if (monacoEditor && monacoEditor.length > 0) {
          return monacoEditor[0].getValue();
        }
        // Fallback: try to get content from textarea
        const textarea = document.querySelector("textarea");
        return textarea?.value || "";
      });
      return editorContent;
    });
  },

  selectFile: async ({ page }, use) => {
    await use(async (filename: string) => {
      const fileItem = page.locator(`[data-testid="file-${filename}"]`).or(
        page.locator(`[data-filename="${filename}"]`)
      ).or(
        page.locator(`text=${filename}`)
      );
      await fileItem.click();
      // Wait for editor to load file
      await page.waitForTimeout(500);
    });
  },

  setPreviewDevice: async ({ page }, use) => {
    await use(async (device: "mobile" | "tablet" | "desktop") => {
      const deviceButton = page.locator(`[data-testid="device-${device}"]`).or(
        page.locator(`button[aria-label*="${device}"]`)
      );
      await deviceButton.click();
      // Wait for preview to update
      await page.waitForTimeout(300);
    });
  },
});

export { expect };

/**
 * Test data generators
 */
export const testData = {
  /** Sample prompts for testing AI generation */
  prompts: {
    simple: "Create a simple landing page with a hero section",
    withNav: "Add a navigation bar with Home, About, and Contact links",
    withForm: "Add a contact form with name, email, and message fields",
    styling: "Make the hero section have a gradient background",
  },

  /** Expected file patterns */
  expectedFiles: {
    template: /.*\.xml$/,
    styles: /.*\.(css|scss)$/,
    manifest: /__manifest__\.py$/,
  },
};

/**
 * Accessibility testing helpers
 */
export async function checkA11y(page: import("@playwright/test").Page) {
  // Basic accessibility checks
  const violations: string[] = [];

  // Check for images without alt text
  const imagesWithoutAlt = await page.locator("img:not([alt])").count();
  if (imagesWithoutAlt > 0) {
    violations.push(`${imagesWithoutAlt} images missing alt text`);
  }

  // Check for buttons without accessible names
  const buttonsWithoutName = await page.locator("button:not([aria-label]):not(:has-text(*))").count();
  if (buttonsWithoutName > 0) {
    violations.push(`${buttonsWithoutName} buttons without accessible names`);
  }

  // Check for form inputs without labels
  const inputsWithoutLabels = await page.locator("input:not([aria-label]):not([id])").count();
  if (inputsWithoutLabels > 0) {
    violations.push(`${inputsWithoutLabels} inputs without labels`);
  }

  return {
    violations,
    passed: violations.length === 0,
  };
}
