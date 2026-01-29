// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ModuleInstallationTester,
  createInstallationTester,
  createMockInstallationTester,
  createMockFetch,
  generateRequestId,
  createSuccessResult,
  createFailureResult,
  testOdooInstall,
  type InstallRequest,
  type InstallResult,
  type InstallEvent,
  type TesterConfig,
} from "@/lib/preview/module-installation-tester";

describe("ModuleInstallationTester", () => {
  describe("test_odoo tool installs module on sidecar (Feature #174)", () => {
    it("installs module via sidecar", async () => {
      // Feature #174: test_odoo tool installs module on sidecar
      const tester = createMockInstallationTester(
        { retryOnError: false },
        { success: true, installedModules: ["website"] }
      );

      const result = await tester.installModule({ moduleName: "website" });

      expect(result.success).toBe(true);
      expect(result.status).toBe("installed");
      expect(result.moduleName).toBe("website");
    });

    it("reports success with installed modules list", async () => {
      // Feature #174: Reports success
      const tester = createMockInstallationTester(
        { retryOnError: false },
        { success: true, installedModules: ["website", "website_sale"] }
      );

      const result = await tester.installModule({ moduleName: "website" });

      expect(result.success).toBe(true);
      expect(result.installedModules).toContain("website");
      expect(result.installedModules).toContain("website_sale");
    });

    it("reports failure with error message", async () => {
      // Feature #174: Reports failure
      const tester = createMockInstallationTester(
        { retryOnError: false },
        { success: false, error: "Module not found" }
      );

      const result = await tester.installModule({ moduleName: "invalid_module" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Module not found");
    });

    it("reports failure with error details", async () => {
      // Feature #174: Reports failure details
      const tester = createMockInstallationTester(
        { retryOnError: false },
        {
          success: false,
          error: "Installation failed",
          errorDetails: "Traceback: ...",
        }
      );

      const result = await tester.installModule({ moduleName: "broken_module" });

      expect(result.success).toBe(false);
      expect(result.errorDetails).toBe("Traceback: ...");
    });

    it("testOdooInstall convenience function works", async () => {
      // Feature #174: test_odoo tool
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          installed_modules: ["test_module"],
          duration_ms: 500,
        }),
      });

      const originalFetch = global.fetch;
      global.fetch = mockFetch as typeof fetch;

      try {
        // This will use the real fetch, but we've mocked it
        const result = await testOdooInstall("test_module");

        expect(result.success).toBe(true);
        expect(result.message).toContain("installed successfully");
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("generateRequestId", () => {
    it("generates unique IDs", () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^install-\d+-[a-z0-9]+$/);
    });
  });

  describe("createSuccessResult", () => {
    it("creates success result", () => {
      const request: InstallRequest = { moduleName: "test" };
      const result = createSuccessResult(request, 1000, ["test"], ["Warning"]);

      expect(result.success).toBe(true);
      expect(result.status).toBe("installed");
      expect(result.duration).toBe(1000);
      expect(result.installedModules).toContain("test");
      expect(result.warnings).toContain("Warning");
    });
  });

  describe("createFailureResult", () => {
    it("creates failure result", () => {
      const request: InstallRequest = { moduleName: "test" };
      const result = createFailureResult(request, "Error", 500, "Details");

      expect(result.success).toBe(false);
      expect(result.status).toBe("failed");
      expect(result.error).toBe("Error");
      expect(result.errorDetails).toBe("Details");
    });
  });

  describe("createMockFetch", () => {
    it("returns success by default", async () => {
      const fetch = createMockFetch();
      const response = await fetch("http://test", {
        method: "POST",
        headers: {},
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it("returns failure when configured", async () => {
      const fetch = createMockFetch({ success: false, error: "Failed" });
      const response = await fetch("http://test", {
        method: "POST",
        headers: {},
      });

      expect(response.ok).toBe(false);
      const data = await response.json();
      expect(data.error).toBe("Failed");
    });

    it("fails for specified count then succeeds", async () => {
      const fetch = createMockFetch({ failCount: 2 });

      const r1 = await fetch("http://test", { method: "POST", headers: {} });
      const r2 = await fetch("http://test", { method: "POST", headers: {} });
      const r3 = await fetch("http://test", { method: "POST", headers: {} });

      expect(r1.ok).toBe(false);
      expect(r2.ok).toBe(false);
      expect(r3.ok).toBe(true);
    });
  });

  describe("ModuleInstallationTester class", () => {
    let tester: ModuleInstallationTester;

    beforeEach(() => {
      tester = createMockInstallationTester(
        { retryOnError: false },
        { success: true }
      );
    });

    describe("installModule", () => {
      it("returns success result", async () => {
        const result = await tester.installModule({ moduleName: "test" });

        expect(result.success).toBe(true);
        expect(result.moduleName).toBe("test");
      });

      it("includes request ID", async () => {
        const result = await tester.installModule({
          moduleName: "test",
          requestId: "custom-id",
        });

        expect(result.requestId).toBe("custom-id");
      });

      it("generates request ID if not provided", async () => {
        const result = await tester.installModule({ moduleName: "test" });

        expect(result.requestId).toMatch(/^install-/);
      });

      it("includes duration", async () => {
        const result = await tester.installModule({ moduleName: "test" });

        expect(result.duration).toBeGreaterThan(0);
      });

      it("emits install:start event", async () => {
        const events: InstallEvent[] = [];
        tester.onEvent((e) => events.push(e));

        await tester.installModule({ moduleName: "test" });

        expect(events.some((e) => e.type === "install:start")).toBe(true);
      });

      it("emits install:success event", async () => {
        const events: InstallEvent[] = [];
        tester.onEvent((e) => events.push(e));

        await tester.installModule({ moduleName: "test" });

        expect(events.some((e) => e.type === "install:success")).toBe(true);
      });

      it("emits install:failure event on error", async () => {
        tester = createMockInstallationTester(
          { retryOnError: false },
          { success: false, error: "Failed" }
        );
        const events: InstallEvent[] = [];
        tester.onEvent((e) => events.push(e));

        await tester.installModule({ moduleName: "test" });

        expect(events.some((e) => e.type === "install:failure")).toBe(true);
      });

      it("returns error result on failure", async () => {
        tester = createMockInstallationTester(
          { retryOnError: false },
          { success: false, error: "Installation error" }
        );

        const result = await tester.installModule({ moduleName: "test" });

        expect(result.success).toBe(false);
        expect(result.error).toBe("Installation error");
      });
    });

    describe("testInstall", () => {
      it("is convenience method for installModule", async () => {
        const result = await tester.testInstall("my_module");

        expect(result.success).toBe(true);
        expect(result.moduleName).toBe("my_module");
      });
    });

    describe("retry logic", () => {
      it("retries on failure", async () => {
        tester = createMockInstallationTester(
          { retryOnError: true, maxRetries: 2, retryDelay: 10 },
          { failCount: 1 }
        );

        const result = await tester.installModule({ moduleName: "test" });

        expect(result.success).toBe(true);
      });

      it("respects maxRetries", async () => {
        tester = createMockInstallationTester(
          { retryOnError: true, maxRetries: 1, retryDelay: 10 },
          { failCount: 5 }
        );

        const result = await tester.installModule({ moduleName: "test" });

        expect(result.success).toBe(false);
      });

      it("emits progress events during retry", async () => {
        tester = createMockInstallationTester(
          { retryOnError: true, maxRetries: 2, retryDelay: 10 },
          { failCount: 1 }
        );
        const events: InstallEvent[] = [];
        tester.onEvent((e) => events.push(e));

        await tester.installModule({ moduleName: "test" });

        expect(events.some((e) => e.type === "install:progress")).toBe(true);
      });
    });

    describe("cancelInstall", () => {
      it("cancels active installation", async () => {
        // Use a slow mock to give time to cancel
        const slowFetch = vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true }),
          };
        });

        tester = createInstallationTester({ retryOnError: false }, slowFetch);

        const installPromise = tester.installModule({
          moduleName: "test",
          requestId: "cancel-test",
        });

        // Cancel after short delay
        await new Promise((resolve) => setTimeout(resolve, 50));
        const cancelled = tester.cancelInstall("cancel-test");

        expect(cancelled).toBe(true);

        const result = await installPromise;
        expect(result.status).toBe("cancelled");
      });

      it("returns false for unknown request", () => {
        const cancelled = tester.cancelInstall("unknown-id");

        expect(cancelled).toBe(false);
      });

      it("emits install:cancelled event", async () => {
        const slowFetch = vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return { ok: true, status: 200, json: async () => ({ success: true }) };
        });

        tester = createInstallationTester({ retryOnError: false }, slowFetch);
        const events: InstallEvent[] = [];
        tester.onEvent((e) => events.push(e));

        const installPromise = tester.installModule({
          moduleName: "test",
          requestId: "cancel-event-test",
        });

        await new Promise((resolve) => setTimeout(resolve, 50));
        tester.cancelInstall("cancel-event-test");

        await installPromise;

        expect(events.some((e) => e.type === "install:cancelled")).toBe(true);
      });
    });

    describe("getActiveInstalls", () => {
      it("returns empty array when no installs", () => {
        expect(tester.getActiveInstalls()).toEqual([]);
      });

      it("returns active install IDs", async () => {
        const slowFetch = vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return { ok: true, status: 200, json: async () => ({ success: true }) };
        });

        tester = createInstallationTester({ retryOnError: false }, slowFetch);

        const promise1 = tester.installModule({
          moduleName: "test1",
          requestId: "active-1",
        });
        const promise2 = tester.installModule({
          moduleName: "test2",
          requestId: "active-2",
        });

        await new Promise((resolve) => setTimeout(resolve, 50));
        const active = tester.getActiveInstalls();

        expect(active).toContain("active-1");
        expect(active).toContain("active-2");

        // Clean up
        tester.cancelInstall("active-1");
        tester.cancelInstall("active-2");
        await Promise.all([promise1, promise2]);
      });
    });

    describe("getModuleInfo", () => {
      it("returns module info", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            display_name: "Website",
            version: "16.0.1.0.0",
            state: "installed",
            dependencies: ["base", "web"],
          }),
        });

        tester = createInstallationTester({}, mockFetch);

        const info = await tester.getModuleInfo("website");

        expect(info).not.toBeNull();
        expect(info?.name).toBe("website");
        expect(info?.displayName).toBe("Website");
        expect(info?.state).toBe("installed");
      });

      it("returns null on error", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: async () => ({ error: "Not found" }),
        });

        tester = createInstallationTester({}, mockFetch);

        const info = await tester.getModuleInfo("nonexistent");

        expect(info).toBeNull();
      });
    });

    describe("isModuleInstalled", () => {
      it("returns true when installed", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ state: "installed" }),
        });

        tester = createInstallationTester({}, mockFetch);

        const installed = await tester.isModuleInstalled("website");

        expect(installed).toBe(true);
      });

      it("returns false when not installed", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ state: "uninstalled" }),
        });

        tester = createInstallationTester({}, mockFetch);

        const installed = await tester.isModuleInstalled("website");

        expect(installed).toBe(false);
      });
    });

    describe("event callbacks", () => {
      it("registers callback", async () => {
        const callback = vi.fn();
        tester.onEvent(callback);

        await tester.installModule({ moduleName: "test" });

        expect(callback).toHaveBeenCalled();
      });

      it("removes callback", async () => {
        const callback = vi.fn();
        tester.onEvent(callback);
        tester.offEvent(callback);

        await tester.installModule({ moduleName: "test" });

        expect(callback).not.toHaveBeenCalled();
      });

      it("handles callback errors gracefully", async () => {
        tester.onEvent(() => {
          throw new Error("Callback error");
        });

        await expect(
          tester.installModule({ moduleName: "test" })
        ).resolves.not.toThrow();
      });
    });

    describe("config management", () => {
      it("updates configuration", () => {
        tester.updateConfig({ timeout: 60000 });

        const config = tester.getConfig();
        expect(config.timeout).toBe(60000);
      });

      it("returns config copy", () => {
        const config1 = tester.getConfig();
        const config2 = tester.getConfig();

        expect(config1).not.toBe(config2);
      });
    });
  });

  describe("factory functions", () => {
    it("createInstallationTester creates instance", () => {
      const tester = createInstallationTester();

      expect(tester).toBeInstanceOf(ModuleInstallationTester);
    });

    it("createMockInstallationTester creates instance with mock", async () => {
      const tester = createMockInstallationTester({}, { success: true });

      const result = await tester.installModule({ moduleName: "test" });

      expect(result.success).toBe(true);
    });
  });
});
