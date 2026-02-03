/**
 * Tests for PostDeployVerifier
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  PostDeployVerifier,
  createPostDeployVerifier,
  createMockPostDeployVerifier,
  createMockFetch,
  verifyPostDeploy,
  generateRequestId,
  delay,
  createTimeoutController,
  createPassedCheck,
  createFailedCheck,
  createWarningCheck,
  createSkippedCheck,
  type VerificationRequest,
  type VerificationResult,
  type VerificationEvent,
  type VerificationCheck,
} from "@/lib/preview/post-deploy-verifier";
import { LogInspector } from "@/lib/preview/log-inspector";

describe("PostDeployVerifier", () => {
  describe("Utility Functions", () => {
    it("generates unique request IDs", () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();

      expect(id1).toMatch(/^verify-\d+-[a-z0-9]+$/);
      expect(id2).toMatch(/^verify-\d+-[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it("delay waits for specified time", async () => {
      const start = Date.now();
      await delay(50);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(45);
      expect(elapsed).toBeLessThan(100);
    });

    it("createTimeoutController aborts after timeout", async () => {
      const { controller, timeoutId } = createTimeoutController(50);

      expect(controller.signal.aborted).toBe(false);
      await delay(60);
      expect(controller.signal.aborted).toBe(true);

      clearTimeout(timeoutId);
    });

    it("createPassedCheck creates correct structure", () => {
      const check = createPassedCheck(
        "module_installed",
        "Module Installed",
        "Module installed successfully",
        100,
        { version: "1.0.0" }
      );

      expect(check.type).toBe("module_installed");
      expect(check.name).toBe("Module Installed");
      expect(check.status).toBe("passed");
      expect(check.message).toBe("Module installed successfully");
      expect(check.duration).toBe(100);
      expect(check.details).toEqual({ version: "1.0.0" });
      expect(check.timestamp).toBeDefined();
    });

    it("createFailedCheck creates correct structure", () => {
      const check = createFailedCheck(
        "render_page",
        "Render Page",
        "Render failed",
        200
      );

      expect(check.status).toBe("failed");
      expect(check.message).toBe("Render failed");
    });

    it("createWarningCheck creates correct structure", () => {
      const check = createWarningCheck(
        "log_warnings",
        "Log Warnings",
        "Found 3 warnings",
        50
      );

      expect(check.status).toBe("warning");
    });

    it("createSkippedCheck creates correct structure", () => {
      const check = createSkippedCheck(
        "dependencies",
        "Dependencies",
        "No log inspector"
      );

      expect(check.status).toBe("skipped");
      expect(check.duration).toBe(0);
    });
  });

  describe("Mock Fetch", () => {
    it("returns installed module info by default", async () => {
      const mockFetch = createMockFetch();
      const response = await mockFetch("http://localhost:8069/api/modules/info/test", {
        method: "GET",
        headers: {},
      });

      expect(response.ok).toBe(true);
      const data = await response.json() as { state?: string };
      expect(data.state).toBe("installed");
    });

    it("returns 404 when module not installed", async () => {
      const mockFetch = createMockFetch({ moduleInstalled: false });
      const response = await mockFetch("http://localhost:8069/api/modules/info/test", {
        method: "GET",
        headers: {},
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });

    it("returns render success by default", async () => {
      const mockFetch = createMockFetch();
      const response = await mockFetch("http://localhost:8069/api/preview/render", {
        method: "POST",
        headers: {},
      });

      expect(response.ok).toBe(true);
      const data = await response.json() as { html?: string };
      expect(data.html).toContain("Sample Page");
    });

    it("returns render failure when configured", async () => {
      const mockFetch = createMockFetch({ renderError: "Template not found" });
      const response = await mockFetch("http://localhost:8069/api/preview/render", {
        method: "POST",
        headers: {},
      });

      expect(response.ok).toBe(false);
      const data = await response.json();
      expect(data.error).toBe("Template not found");
    });

    it("simulates transient failures", async () => {
      const mockFetch = createMockFetch({ failCount: 2 });

      // First two calls fail
      const response1 = await mockFetch("http://localhost:8069/api/modules/info/test", {
        method: "GET",
        headers: {},
      });
      expect(response1.ok).toBe(false);

      const response2 = await mockFetch("http://localhost:8069/api/modules/info/test", {
        method: "GET",
        headers: {},
      });
      expect(response2.ok).toBe(false);

      // Third call succeeds
      const response3 = await mockFetch("http://localhost:8069/api/modules/info/test", {
        method: "GET",
        headers: {},
      });
      expect(response3.ok).toBe(true);
    });
  });

  describe("Basic Verification", () => {
    let verifier: PostDeployVerifier;

    beforeEach(() => {
      verifier = createMockPostDeployVerifier();
    });

    it("verifies a successfully deployed module", async () => {
      const result = await verifier.verify({
        moduleName: "test_module",
        checkLogs: false,
      });

      expect(result.success).toBe(true);
      expect(result.moduleName).toBe("test_module");
      expect(result.checks.length).toBeGreaterThan(0);
      expect(result.summary.failed).toBe(0);
    });

    it("fails when module is not installed", async () => {
      verifier = createMockPostDeployVerifier({}, { moduleInstalled: false });

      const result = await verifier.verify({
        moduleName: "missing_module",
        checkLogs: false,
      });

      expect(result.success).toBe(false);
      expect(result.summary.failed).toBeGreaterThan(0);

      const installCheck = result.checks.find((c) => c.type === "module_installed");
      expect(installCheck?.status).toBe("failed");
    });

    it("fails when module state is not installed", async () => {
      verifier = createMockPostDeployVerifier({}, { moduleState: "uninstalled" });

      const result = await verifier.verify({
        moduleName: "test_module",
        checkLogs: false,
      });

      expect(result.success).toBe(false);

      const stateCheck = result.checks.find((c) => c.type === "module_state");
      expect(stateCheck?.status).toBe("failed");
    });

    it("warns when module state is pending", async () => {
      verifier = createMockPostDeployVerifier({}, { moduleState: "to upgrade" });

      const result = await verifier.verify({
        moduleName: "test_module",
        checkLogs: false,
      });

      // Still passes but with warning
      expect(result.success).toBe(true);
      expect(result.summary.warnings).toBeGreaterThan(0);

      const stateCheck = result.checks.find((c) => c.type === "module_state");
      expect(stateCheck?.status).toBe("warning");
    });

    it("fails when page render fails", async () => {
      verifier = createMockPostDeployVerifier({}, { renderError: "500 Internal Error" });

      const result = await verifier.verify({
        moduleName: "test_module",
        checkLogs: false,
      });

      expect(result.success).toBe(false);

      const renderCheck = result.checks.find((c) => c.type === "render_page");
      expect(renderCheck?.status).toBe("failed");
    });
  });

  describe("Quick Verification", () => {
    it("performs minimal checks", async () => {
      const verifier = createMockPostDeployVerifier();

      const result = await verifier.quickVerify("test_module");

      expect(result.success).toBe(true);
      // Quick verify skips: dependencies, log_errors, log_warnings, render_template
      const checkTypes = result.checks.map((c) => c.type);
      expect(checkTypes).not.toContain("dependencies");
      expect(checkTypes).not.toContain("log_errors");
      expect(checkTypes).not.toContain("log_warnings");
    });

    it("accepts custom page URL", async () => {
      const verifier = createMockPostDeployVerifier();

      const result = await verifier.quickVerify("test_module", "/custom-page");

      expect(result.success).toBe(true);
      const renderCheck = result.checks.find((c) => c.type === "render_page");
      expect(renderCheck?.details?.pageUrl).toBe("/custom-page");
    });
  });

  describe("Dependency Checking", () => {
    it("passes when all dependencies are installed", async () => {
      const verifier = createMockPostDeployVerifier(
        {},
        { moduleDependencies: ["base", "website"] }
      );

      const result = await verifier.verify({
        moduleName: "test_module",
        checkLogs: false,
      });

      expect(result.success).toBe(true);

      const depsCheck = result.checks.find((c) => c.type === "dependencies");
      expect(depsCheck?.status).toBe("passed");
    });

    it("passes with no dependencies", async () => {
      const verifier = createMockPostDeployVerifier(
        {},
        { moduleDependencies: [] }
      );

      const result = await verifier.verify({
        moduleName: "test_module",
        checkLogs: false,
      });

      const depsCheck = result.checks.find((c) => c.type === "dependencies");
      expect(depsCheck?.status).toBe("passed");
      expect(depsCheck?.message).toContain("No dependencies");
    });
  });

  describe("Template Rendering", () => {
    it("renders sample template when specified", async () => {
      const verifier = createMockPostDeployVerifier();

      const result = await verifier.verify({
        moduleName: "test_module",
        sampleTemplate: "website.layout",
        checkLogs: false,
      });

      expect(result.success).toBe(true);

      const templateCheck = result.checks.find((c) => c.type === "render_template");
      expect(templateCheck).toBeDefined();
      expect(templateCheck?.status).toBe("passed");
    });

    it("skips template check when not specified", async () => {
      const verifier = createMockPostDeployVerifier();

      const result = await verifier.verify({
        moduleName: "test_module",
        checkLogs: false,
      });

      const templateCheck = result.checks.find((c) => c.type === "render_template");
      expect(templateCheck).toBeUndefined();
    });
  });

  describe("Log Checking", () => {
    let verifier: PostDeployVerifier;
    let logInspector: LogInspector;

    beforeEach(() => {
      logInspector = new LogInspector();
      verifier = createMockPostDeployVerifier({}, {}, logInspector);
    });

    it("passes when no errors in logs", async () => {
      const result = await verifier.verify({
        moduleName: "test_module",
        checkLogs: true,
      });

      const logCheck = result.checks.find((c) => c.type === "log_errors");
      expect(logCheck?.status).toBe("passed");
    });

    it("fails when errors exceed threshold", async () => {
      // Add errors to log inspector
      logInspector.addOdooError("Database connection failed");

      const result = await verifier.verify({
        moduleName: "test_module",
        checkLogs: true,
        logTimeWindow: 60000,
      });

      const logCheck = result.checks.find((c) => c.type === "log_errors");
      expect(logCheck?.status).toBe("failed");
      expect(logCheck?.details?.errorCount).toBe(1);
    });

    it("warns when warnings exceed threshold", async () => {
      // Add warnings - they will be captured by the time window
      // which looks backward from deployStartTime
      for (let i = 0; i < 6; i++) {
        logInspector.addQwebWarning(`Warning ${i}`);
      }

      const result = await verifier.verify({
        moduleName: "test_module",
        checkLogs: true,
        logTimeWindow: 60000, // 1 minute window looking backward captures the warnings
      });

      const warningCheck = result.checks.find((c) => c.type === "log_warnings");
      expect(warningCheck?.status).toBe("warning");
      expect(warningCheck?.details?.warningCount).toBe(6);
    });

    it("adds skipped log checks when no inspector configured", async () => {
      verifier = createMockPostDeployVerifier(); // No log inspector

      const result = await verifier.verify({
        moduleName: "test_module",
        checkLogs: true,
      });

      // When no log inspector, log checks are added as "skipped" for audit trail
      const logErrorCheck = result.checks.find((c) => c.type === "log_errors");
      const logWarningCheck = result.checks.find((c) => c.type === "log_warnings");
      expect(logErrorCheck?.status).toBe("skipped");
      expect(logErrorCheck?.message).toBe("No log inspector configured");
      expect(logWarningCheck?.status).toBe("skipped");
      expect(logWarningCheck?.message).toBe("No log inspector configured");
    });

    it("respects custom log sources", async () => {
      logInspector.add({
        severity: "error",
        source: "scss",
        message: "SCSS error",
      });

      // Only check odoo source, should not see scss error
      const result = await verifier.verify({
        moduleName: "test_module",
        checkLogs: true,
        logSources: ["odoo"],
        logTimeWindow: 60000,
      });

      const logCheck = result.checks.find((c) => c.type === "log_errors");
      expect(logCheck?.status).toBe("passed");
    });
  });

  describe("Skip Checks", () => {
    it("skips specified checks", async () => {
      const verifier = createMockPostDeployVerifier();

      const result = await verifier.verify({
        moduleName: "test_module",
        skipChecks: ["module_state", "dependencies", "render_page"],
        checkLogs: false,
      });

      const checkTypes = result.checks.map((c) => c.type);
      expect(checkTypes).not.toContain("module_state");
      expect(checkTypes).not.toContain("dependencies");
      expect(checkTypes).not.toContain("render_page");
      expect(checkTypes).toContain("module_installed");
    });
  });

  describe("Events", () => {
    it("emits verification:start event", async () => {
      const verifier = createMockPostDeployVerifier();
      const events: VerificationEvent[] = [];

      verifier.onEvent((event) => events.push(event));

      await verifier.verify({
        moduleName: "test_module",
        checkLogs: false,
      });

      const startEvent = events.find((e) => e.type === "verification:start");
      expect(startEvent).toBeDefined();
      expect(startEvent?.request.moduleName).toBe("test_module");
    });

    it("emits check:start and check:complete events", async () => {
      const verifier = createMockPostDeployVerifier();
      const events: VerificationEvent[] = [];

      verifier.onEvent((event) => events.push(event));

      await verifier.verify({
        moduleName: "test_module",
        checkLogs: false,
      });

      const checkStartEvents = events.filter((e) => e.type === "check:start");
      const checkCompleteEvents = events.filter((e) => e.type === "check:complete");

      expect(checkStartEvents.length).toBeGreaterThan(0);
      expect(checkCompleteEvents.length).toBeGreaterThan(0);
      expect(checkStartEvents.length).toBe(checkCompleteEvents.length);
    });

    it("emits verification:complete event", async () => {
      const verifier = createMockPostDeployVerifier();
      const events: VerificationEvent[] = [];

      verifier.onEvent((event) => events.push(event));

      await verifier.verify({
        moduleName: "test_module",
        checkLogs: false,
      });

      const completeEvent = events.find((e) => e.type === "verification:complete");
      expect(completeEvent).toBeDefined();
      expect(completeEvent?.result).toBeDefined();
      expect(completeEvent?.result?.success).toBe(true);
    });

    it("can unsubscribe from events", async () => {
      const verifier = createMockPostDeployVerifier();
      const events: VerificationEvent[] = [];

      const callback = (event: VerificationEvent) => events.push(event);
      verifier.onEvent(callback);
      verifier.offEvent(callback);

      await verifier.verify({
        moduleName: "test_module",
        checkLogs: false,
      });

      expect(events.length).toBe(0);
    });
  });

  describe("Configuration", () => {
    it("uses default configuration", () => {
      const verifier = createPostDeployVerifier();
      const config = verifier.getConfig();

      expect(config.sidecarUrl).toBe("http://localhost:8069");
      expect(config.timeout).toBe(30000);
      expect(config.maxLogErrors).toBe(0);
    });

    it("accepts custom configuration", () => {
      const verifier = createPostDeployVerifier({
        sidecarUrl: "http://custom:8080",
        timeout: 60000,
        maxLogErrors: 5,
      });

      const config = verifier.getConfig();
      expect(config.sidecarUrl).toBe("http://custom:8080");
      expect(config.timeout).toBe(60000);
      expect(config.maxLogErrors).toBe(5);
    });

    it("can update configuration", () => {
      const verifier = createPostDeployVerifier();

      verifier.updateConfig({ timeout: 45000 });

      const config = verifier.getConfig();
      expect(config.timeout).toBe(45000);
    });

    it("can set log inspector after creation", async () => {
      const verifier = createMockPostDeployVerifier();
      const logInspector = new LogInspector();

      verifier.setLogInspector(logInspector);
      logInspector.addOdooError("Test error");

      const result = await verifier.verify({
        moduleName: "test_module",
        checkLogs: true,
        logTimeWindow: 60000,
      });

      const logCheck = result.checks.find((c) => c.type === "log_errors");
      expect(logCheck?.status).toBe("failed");
    });
  });

  describe("Result Summary", () => {
    it("calculates correct summary counts", async () => {
      const verifier = createMockPostDeployVerifier();

      const result = await verifier.verify({
        moduleName: "test_module",
        checkLogs: false,
      });

      expect(result.summary.total).toBe(result.checks.length);
      expect(result.summary.passed + result.summary.failed + result.summary.warnings + result.summary.skipped)
        .toBe(result.summary.total);
    });

    it("includes duration in result", async () => {
      const verifier = createMockPostDeployVerifier();

      const result = await verifier.verify({
        moduleName: "test_module",
        checkLogs: false,
      });

      expect(result.duration).toBeGreaterThan(0);
    });

    it("includes timestamp in result", async () => {
      const verifier = createMockPostDeployVerifier();
      const before = Date.now();

      const result = await verifier.verify({
        moduleName: "test_module",
        checkLogs: false,
      });

      const after = Date.now();
      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe("Retry Logic", () => {
    it("retries on transient failures", async () => {
      // Configure to fail first 2 times, succeed on 3rd
      const verifier = createMockPostDeployVerifier(
        { maxRetries: 2 },
        { failCount: 2 }
      );

      const result = await verifier.verify({
        moduleName: "test_module",
        checkLogs: false,
      });

      // Should eventually succeed
      expect(result.success).toBe(true);
    });

    it("fails after max retries exceeded", async () => {
      // Configure to fail 5 times, but only retry 2 times
      const verifier = createMockPostDeployVerifier(
        { maxRetries: 2, retryDelay: 10 },
        { failCount: 5 }
      );

      const result = await verifier.verify({
        moduleName: "test_module",
        checkLogs: false,
      });

      expect(result.success).toBe(false);
    });
  });

  describe("verifyPostDeploy convenience function", () => {
    it("returns success result for valid module", async () => {
      // Mock global fetch to handle multiple endpoints
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/modules/info")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              name: "test_module",
              state: "installed",
              version: "1.0.0",
              dependencies: [],
            }),
          });
        }
        if (url.includes("/api/preview/render")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              html: "<html><body>Test Page</body></html>",
              render_time: 50,
            }),
          });
        }
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: "Unknown endpoint" }),
        });
      });

      vi.stubGlobal("fetch", mockFetch);

      const result = await verifyPostDeploy("test_module");

      expect(result.success).toBe(true);
      expect(result.message).toContain("verified successfully");

      vi.unstubAllGlobals();
    });

    it("returns failure result with error message", async () => {
      // Mock fetch to return module not found for all requests
      const mockFetch = vi.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: "Module not found" }),
        });
      });

      vi.stubGlobal("fetch", mockFetch);

      const result = await verifyPostDeploy("missing_module");

      expect(result.success).toBe(false);
      expect(result.message).toContain("verification failed");

      vi.unstubAllGlobals();
    });
  });

  describe("Edge Cases", () => {
    it("handles empty HTML in render response", async () => {
      const verifier = createMockPostDeployVerifier({}, { renderHtml: "" });

      const result = await verifier.verify({
        moduleName: "test_module",
        checkLogs: false,
      });

      const renderCheck = result.checks.find((c) => c.type === "render_page");
      expect(renderCheck?.status).toBe("failed");
      expect(renderCheck?.message).toContain("empty content");
    });

    it("warns on unusual HTML content", async () => {
      // HTML without typical structure
      const verifier = createMockPostDeployVerifier({}, { renderHtml: "Just some text" });

      const result = await verifier.verify({
        moduleName: "test_module",
        checkLogs: false,
      });

      const renderCheck = result.checks.find((c) => c.type === "render_page");
      expect(renderCheck?.status).toBe("warning");
      expect(renderCheck?.message).toContain("unusual");
    });

    it("uses request ID if provided", async () => {
      const verifier = createMockPostDeployVerifier();

      const result = await verifier.verify({
        moduleName: "test_module",
        requestId: "custom-request-123",
        checkLogs: false,
      });

      expect(result.requestId).toBe("custom-request-123");
    });

    it("generates request ID if not provided", async () => {
      const verifier = createMockPostDeployVerifier();

      const result = await verifier.verify({
        moduleName: "test_module",
        checkLogs: false,
      });

      expect(result.requestId).toMatch(/^verify-\d+-[a-z0-9]+$/);
    });
  });
});
