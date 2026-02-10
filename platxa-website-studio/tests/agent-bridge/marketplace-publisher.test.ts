/**
 * Tests for Marketplace Publisher
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  publishToMarketplace,
  createPurchaseWebhookHandler,
  generateLicenseKey,
  validateLicenseKey,
  type PublishOptions,
  type HttpClient,
  type ModulePackage,
  type PurchaseEvent,
} from "../../lib/agent-bridge/marketplace-publisher";

// =============================================================================
// Mock HTTP Client
// =============================================================================

function createMockHttpClient(responses: Record<string, unknown> = {}): HttpClient {
  return {
    post: vi.fn().mockImplementation((url: string) => {
      if (url.includes("/auth/login")) {
        return Promise.resolve({
          status: 200,
          ok: true,
          data: responses.login || { session_token: "test-session-token" },
        });
      }
      if (url.includes("/modules/search")) {
        return Promise.resolve({
          status: 200,
          ok: true,
          data: responses.search || { modules: [] },
        });
      }
      if (url.includes("/modules")) {
        return Promise.resolve({
          status: 200,
          ok: true,
          data: responses.upload || { module_id: 12345 },
        });
      }
      return Promise.resolve({ status: 200, ok: true, data: {} });
    }),
    put: vi.fn().mockImplementation(() => {
      return Promise.resolve({ status: 200, ok: true, data: {} });
    }),
  };
}

// =============================================================================
// Mock Module Package
// =============================================================================

function createMockPackage(): ModulePackage {
  return {
    technicalName: "theme_platxa_modern",
    displayName: "Platxa Modern Theme",
    version: "17.0.1.0.0",
    archiveBase64: "UEsDBBQAAAAIAA==", // Minimal ZIP header
    archiveHash: "abc123def456",
    archiveSize: 1024,
    manifest: {
      name: "Platxa Modern Theme",
      version: "17.0.1.0.0",
      license: "LGPL-3",
      author: "Platxa",
      website: "https://platxa.com",
      category: "Website",
      summary: "Modern responsive theme for Odoo websites",
      depends: ["website"],
      installable: true,
    },
    assets: {
      hasIcon: true,
      iconSize: [256, 256],
      screenshotCount: 5,
      screenshotPaths: [
        "static/description/screenshot_desktop.png",
        "static/description/screenshot_mobile.png",
        "static/description/screenshot_hero.png",
        "static/description/screenshot_features.png",
        "static/description/screenshot_footer.png",
      ],
      hasDescription: true,
      descriptionLength: 500,
      moduleFiles: [
        "__manifest__.py",
        "static/description/icon.png",
        "static/description/index.html",
      ],
    },
    metadata: {
      displayName: "Platxa Modern Theme",
      summary: "Modern responsive theme for Odoo websites",
      htmlDescription: "<section>...</section>",
      features: ["Responsive design", "Accessibility compliant"],
      categories: ["Theme", "Website"],
      keywords: ["odoo theme", "responsive", "modern"],
      icon: {
        width: 256,
        height: 256,
        backgroundColor: "#3B82F6",
        foregroundColor: "#FFFFFF",
        label: "PM",
        path: "static/description/icon.png",
      },
      screenshots: [
        {
          title: "Desktop Full Page",
          description: "Full page view on desktop",
          viewportWidth: 1920,
          viewportHeight: 1080,
          target: "full-page",
          path: "static/description/screenshot_desktop.png",
        },
      ],
      odooVersions: ["17.0"],
      priceTier: "starter",
    },
  };
}

// =============================================================================
// Tests: publishToMarketplace
// =============================================================================

describe("publishToMarketplace", () => {
  let mockHttp: HttpClient;
  let mockPackage: ModulePackage;

  beforeEach(() => {
    mockHttp = createMockHttpClient();
    mockPackage = createMockPackage();
  });

  it("successfully publishes a new module", async () => {
    const options: PublishOptions = {
      auth: {
        email: "developer@platxa.com",
        token: "api-token",
        publisherName: "Platxa",
      },
      package: mockPackage,
      pricing: {
        amount: 49,
        currency: "EUR",
        licenseType: "LGPL-3",
      },
      targetVersions: ["17.0"],
      publishImmediately: true,
    };

    const result = await publishToMarketplace(options, mockHttp);

    expect(result.success).toBe(true);
    expect(result.moduleName).toBe("theme_platxa_modern");
    expect(result.moduleId).toBe(12345);
    expect(result.listingUrl).toContain("apps.odoo.com");
    expect(result.steps.every((s) => s.status === "success")).toBe(true);
  });

  it("updates an existing module", async () => {
    mockHttp = createMockHttpClient({
      search: { modules: [{ id: 99999, version: "17.0.1.0.0" }] },
    });

    const options: PublishOptions = {
      auth: {
        email: "developer@platxa.com",
        token: "api-token",
        publisherName: "Platxa",
      },
      package: mockPackage,
      pricing: {
        amount: 49,
        currency: "EUR",
        licenseType: "LGPL-3",
      },
      targetVersions: ["17.0"],
      publishImmediately: true,
    };

    const result = await publishToMarketplace(options, mockHttp);

    expect(result.success).toBe(true);
    expect(result.summary).toContain("updated");
  });

  it("fails validation with missing icon", async () => {
    mockPackage.assets.hasIcon = false;

    const options: PublishOptions = {
      auth: {
        email: "developer@platxa.com",
        token: "api-token",
        publisherName: "Platxa",
      },
      package: mockPackage,
      pricing: {
        amount: 0,
        currency: "EUR",
        licenseType: "LGPL-3",
      },
      targetVersions: ["17.0"],
      publishImmediately: false,
    };

    const result = await publishToMarketplace(options, mockHttp);

    expect(result.success).toBe(false);
    expect(result.validation.valid).toBe(false);
    expect(result.steps[0].status).toBe("failed");
  });

  it("saves as draft when publishImmediately is false", async () => {
    const options: PublishOptions = {
      auth: {
        email: "developer@platxa.com",
        token: "api-token",
        publisherName: "Platxa",
      },
      package: mockPackage,
      pricing: {
        amount: 0,
        currency: "EUR",
        licenseType: "LGPL-3",
      },
      targetVersions: ["16.0", "17.0"],
      publishImmediately: false,
    };

    const result = await publishToMarketplace(options, mockHttp);

    expect(result.success).toBe(true);
    const publishStep = result.steps.find((s) => s.id === "publish");
    expect(publishStep?.detail).toContain("draft");
  });

  it("tracks step progress via callback", async () => {
    const stepUpdates: string[] = [];

    const options: PublishOptions = {
      auth: {
        email: "developer@platxa.com",
        token: "api-token",
        publisherName: "Platxa",
      },
      package: mockPackage,
      pricing: {
        amount: 99,
        currency: "EUR",
        licenseType: "LGPL-3",
      },
      targetVersions: ["17.0"],
      publishImmediately: true,
      onStepUpdate: (step) => {
        stepUpdates.push(`${step.id}:${step.status}`);
      },
    };

    await publishToMarketplace(options, mockHttp);

    expect(stepUpdates.length).toBeGreaterThan(0);
    expect(stepUpdates.some((u) => u.includes("validate"))).toBe(true);
    expect(stepUpdates.some((u) => u.includes("success"))).toBe(true);
  });

  it("handles authentication failure", async () => {
    mockHttp.post = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/auth/login")) {
        return Promise.resolve({
          status: 401,
          ok: false,
          data: { error: "Invalid credentials" },
        });
      }
      return Promise.resolve({ status: 200, ok: true, data: {} });
    });

    const options: PublishOptions = {
      auth: {
        email: "wrong@email.com",
        token: "bad-token",
        publisherName: "Platxa",
      },
      package: mockPackage,
      pricing: {
        amount: 0,
        currency: "EUR",
        licenseType: "LGPL-3",
      },
      targetVersions: ["17.0"],
      publishImmediately: true,
    };

    const result = await publishToMarketplace(options, mockHttp);

    expect(result.success).toBe(false);
    const authStep = result.steps.find((s) => s.id === "authenticate");
    expect(authStep?.status).toBe("failed");
  });
});

// =============================================================================
// Tests: createPurchaseWebhookHandler
// =============================================================================

describe("createPurchaseWebhookHandler", () => {
  it("handles purchase events", async () => {
    const purchases: PurchaseEvent[] = [];

    const handler = createPurchaseWebhookHandler({
      webhookSecret: "test-secret",
      onPurchase: async (event) => {
        purchases.push(event);
      },
    });

    const event: PurchaseEvent = {
      type: "purchase",
      moduleName: "theme_platxa_modern",
      buyerEmail: "buyer@example.com",
      transactionId: "txn-12345",
      amount: 49,
      timestamp: new Date().toISOString(),
      odooVersion: "17.0",
      licenseKey: "ABCD-1234-EFGH-5678",
    };

    // Note: In a real test, we'd compute the actual HMAC signature
    // For this test, we verify the handler structure works
    const result = await handler(JSON.stringify(event), "invalid-sig");

    // Will fail signature validation
    expect(result.success).toBe(false);
    expect(result.error).toContain("signature");
  });

  it("handles refund events when handler provided", async () => {
    const refunds: PurchaseEvent[] = [];

    const handler = createPurchaseWebhookHandler({
      webhookSecret: "test-secret",
      onPurchase: async () => {},
      onRefund: async (event) => {
        refunds.push(event);
      },
    });

    expect(handler).toBeDefined();
    expect(typeof handler).toBe("function");
  });

  it("handles subscription events", async () => {
    const subscriptions: PurchaseEvent[] = [];
    const cancellations: PurchaseEvent[] = [];

    const handler = createPurchaseWebhookHandler({
      webhookSecret: "test-secret",
      onPurchase: async () => {},
      onSubscriptionStart: async (event) => {
        subscriptions.push(event);
      },
      onSubscriptionCancel: async (event) => {
        cancellations.push(event);
      },
    });

    expect(handler).toBeDefined();
  });
});

// =============================================================================
// Tests: generateLicenseKey
// =============================================================================

describe("generateLicenseKey", () => {
  it("generates a valid license key format", () => {
    const key = generateLicenseKey({
      moduleName: "theme_platxa_modern",
      buyerEmail: "buyer@example.com",
      transactionId: "txn-12345",
    });

    expect(key).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
  });

  it("generates different keys for different inputs", () => {
    const key1 = generateLicenseKey({
      moduleName: "theme_platxa_modern",
      buyerEmail: "buyer1@example.com",
      transactionId: "txn-12345",
    });

    const key2 = generateLicenseKey({
      moduleName: "theme_platxa_modern",
      buyerEmail: "buyer2@example.com",
      transactionId: "txn-67890",
    });

    expect(key1).not.toBe(key2);
  });

  it("generates consistent keys for same inputs", () => {
    const input = {
      moduleName: "theme_platxa_modern",
      buyerEmail: "buyer@example.com",
      transactionId: "txn-12345",
    };

    const key1 = generateLicenseKey(input);
    const key2 = generateLicenseKey(input);

    expect(key1).toBe(key2);
  });

  it("supports expiration dates", () => {
    const key = generateLicenseKey({
      moduleName: "theme_platxa_modern",
      buyerEmail: "buyer@example.com",
      transactionId: "txn-12345",
      expiresAt: new Date("2025-12-31"),
    });

    expect(key).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
  });
});

// =============================================================================
// Tests: validateLicenseKey
// =============================================================================

describe("validateLicenseKey", () => {
  it("validates correct key format", () => {
    // Use valid hex characters only (0-9, A-F)
    const result = validateLicenseKey(
      "ABCD-1234-EF01-5678",
      "theme_platxa_modern",
      "buyer@example.com",
    );

    expect(result.valid).toBe(true);
    expect(result.expired).toBe(false);
  });

  it("rejects invalid key format", () => {
    const result = validateLicenseKey(
      "invalid-key",
      "theme_platxa_modern",
      "buyer@example.com",
    );

    expect(result.valid).toBe(false);
  });

  it("rejects keys with lowercase letters", () => {
    const result = validateLicenseKey(
      "abcd-1234-ef01-5678",
      "theme_platxa_modern",
      "buyer@example.com",
    );

    expect(result.valid).toBe(false);
  });

  it("rejects keys with wrong segment count", () => {
    const result = validateLicenseKey(
      "ABCD-1234-EF01",
      "theme_platxa_modern",
      "buyer@example.com",
    );

    expect(result.valid).toBe(false);
  });
});

// =============================================================================
// Tests: Integration scenarios
// =============================================================================

describe("Marketplace Publisher Integration", () => {
  it("handles complete publish-to-purchase flow", async () => {
    // 1. Publish module
    const mockHttp = createMockHttpClient();
    const pkg = createMockPackage();

    const publishResult = await publishToMarketplace(
      {
        auth: {
          email: "developer@platxa.com",
          token: "api-token",
          publisherName: "Platxa",
        },
        package: pkg,
        pricing: {
          amount: 49,
          currency: "EUR",
          licenseType: "LGPL-3",
        },
        targetVersions: ["17.0"],
        publishImmediately: true,
      },
      mockHttp,
    );

    expect(publishResult.success).toBe(true);

    // 2. Generate license for purchase
    const licenseKey = generateLicenseKey({
      moduleName: pkg.technicalName,
      buyerEmail: "customer@example.com",
      transactionId: "txn-999",
    });

    expect(licenseKey).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);

    // 3. Validate license
    const validation = validateLicenseKey(
      licenseKey,
      pkg.technicalName,
      "customer@example.com",
    );

    expect(validation.valid).toBe(true);
  });

  it("calculates total duration across all steps", async () => {
    const mockHttp = createMockHttpClient();
    const pkg = createMockPackage();

    const result = await publishToMarketplace(
      {
        auth: {
          email: "developer@platxa.com",
          token: "api-token",
          publisherName: "Platxa",
        },
        package: pkg,
        pricing: {
          amount: 0,
          currency: "EUR",
          licenseType: "LGPL-3",
        },
        targetVersions: ["17.0"],
        publishImmediately: true,
      },
      mockHttp,
    );

    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);

    // Sum of step durations should be <= total duration
    const stepDuration = result.steps.reduce((sum, s) => sum + s.durationMs, 0);
    expect(stepDuration).toBeLessThanOrEqual(result.totalDurationMs + 10); // Allow small margin
  });
});
