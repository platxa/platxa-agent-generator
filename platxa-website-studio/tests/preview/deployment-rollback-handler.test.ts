/**
 * Tests for DeploymentRollbackHandler
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  DeploymentRollbackHandler,
  createRollbackHandler,
  createMockRollbackHandler,
  createMockFetch,
  generateSnapshotId,
  generateDeployId,
  delay,
  createTimeoutController,
  hashContent,
  type DeploymentSnapshot,
  type DeploymentContext,
  type RollbackRequest,
  type RollbackResult,
  type RollbackEvent,
  type ModuleFile,
} from "@/lib/preview/deployment-rollback-handler";

describe("DeploymentRollbackHandler", () => {
  describe("Utility Functions", () => {
    it("generates unique snapshot IDs", () => {
      const id1 = generateSnapshotId();
      const id2 = generateSnapshotId();

      expect(id1).toMatch(/^snap-\d+-[a-z0-9]+$/);
      expect(id2).toMatch(/^snap-\d+-[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it("generates unique deploy IDs", () => {
      const id1 = generateDeployId();
      const id2 = generateDeployId();

      expect(id1).toMatch(/^deploy-\d+-[a-z0-9]+$/);
      expect(id2).toMatch(/^deploy-\d+-[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it("delay waits for specified time", async () => {
      const start = Date.now();
      await delay(50);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(45);
      expect(elapsed).toBeLessThan(150);
    });

    it("createTimeoutController aborts after timeout", async () => {
      const { controller, timeoutId } = createTimeoutController(50);

      expect(controller.signal.aborted).toBe(false);
      await delay(60);
      expect(controller.signal.aborted).toBe(true);

      clearTimeout(timeoutId);
    });

    it("hashContent generates consistent hashes", () => {
      const content = "test content";
      const hash1 = hashContent(content);
      const hash2 = hashContent(content);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBeGreaterThan(0);
    });

    it("hashContent generates different hashes for different content", () => {
      const hash1 = hashContent("content1");
      const hash2 = hashContent("content2");

      expect(hash1).not.toBe(hash2);
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
      const data = await response.json();
      expect(data.state).toBe("installed");
    });

    it("returns uninstalled state when configured", async () => {
      const mockFetch = createMockFetch({ moduleInstalled: false });
      const response = await mockFetch("http://localhost:8069/api/modules/info/test", {
        method: "GET",
        headers: {},
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.state).toBe("uninstalled");
    });

    it("returns uninstall success by default", async () => {
      const mockFetch = createMockFetch();
      const response = await mockFetch("http://localhost:8069/api/modules/uninstall", {
        method: "POST",
        headers: {},
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it("returns uninstall failure when configured", async () => {
      const mockFetch = createMockFetch({ uninstallSuccess: false });
      const response = await mockFetch("http://localhost:8069/api/modules/uninstall", {
        method: "POST",
        headers: {},
      });

      expect(response.ok).toBe(false);
      const data = await response.json();
      expect(data.error).toBe("Uninstall failed");
    });

    it("handles file write endpoint", async () => {
      const mockFetch = createMockFetch();
      const response = await mockFetch("http://localhost:8069/files/module/test.py", {
        method: "PUT",
        headers: {},
        body: "content",
      });

      expect(response.ok).toBe(true);
    });

    it("simulates transient failures", async () => {
      const mockFetch = createMockFetch({ failCount: 2 });

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

      const response3 = await mockFetch("http://localhost:8069/api/modules/info/test", {
        method: "GET",
        headers: {},
      });
      expect(response3.ok).toBe(true);
    });
  });

  describe("Snapshot Management", () => {
    let handler: DeploymentRollbackHandler;

    beforeEach(() => {
      handler = createMockRollbackHandler();
    });

    it("creates pre-deploy snapshot", async () => {
      const snapshot = await handler.createPreDeploySnapshot("test_module");

      expect(snapshot.id).toMatch(/^snap-\d+-[a-z0-9]+$/);
      expect(snapshot.moduleName).toBe("test_module");
      expect(snapshot.previousVersion).toBe("1.0.0"); // From mock
      expect(snapshot.timestamp).toBeDefined();
    });

    it("creates snapshot with files", async () => {
      const files: ModuleFile[] = [
        { path: "models/test.py", content: "# test", hash: "abc123" },
        { path: "views/test.xml", content: "<xml/>", hash: "def456" },
      ];

      const snapshot = await handler.createPreDeploySnapshot("test_module", files);

      expect(snapshot.files).toHaveLength(2);
      expect(snapshot.files?.[0].path).toBe("models/test.py");
    });

    it("retrieves snapshot by ID", async () => {
      const created = await handler.createPreDeploySnapshot("test_module");
      const retrieved = handler.getSnapshot(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
    });

    it("returns null for non-existent snapshot", () => {
      const snapshot = handler.getSnapshot("non-existent-id");
      expect(snapshot).toBeNull();
    });

    it("gets latest snapshot for module", async () => {
      await handler.createPreDeploySnapshot("test_module");
      await delay(10);
      const latest = await handler.createPreDeploySnapshot("test_module");

      const retrieved = handler.getLatestSnapshot("test_module");

      expect(retrieved?.id).toBe(latest.id);
    });

    it("returns null when no snapshots for module", () => {
      const snapshot = handler.getLatestSnapshot("unknown_module");
      expect(snapshot).toBeNull();
    });

    it("prunes old snapshots when limit exceeded", async () => {
      handler = createMockRollbackHandler({ maxSnapshots: 3 });

      await handler.createPreDeploySnapshot("module1");
      await handler.createPreDeploySnapshot("module2");
      await handler.createPreDeploySnapshot("module3");
      await handler.createPreDeploySnapshot("module4");

      const snapshots = handler.getSnapshots();
      expect(snapshots.length).toBe(3);
    });

    it("clears all snapshots", async () => {
      await handler.createPreDeploySnapshot("test_module");
      await handler.createPreDeploySnapshot("test_module");

      handler.clearSnapshots();

      expect(handler.getSnapshots()).toHaveLength(0);
    });
  });

  describe("Rollback Execution", () => {
    let handler: DeploymentRollbackHandler;

    beforeEach(() => {
      handler = createMockRollbackHandler();
    });

    it("executes successful rollback with uninstall only", async () => {
      const context: DeploymentContext = {
        moduleName: "test_module",
        target: "preview",
        deployId: "deploy-123",
        startTime: Date.now(),
        snapshot: null,
        gitAvailable: false,
      };

      const result = await handler.rollback({
        context,
        error: "Deployment verification failed",
        failedPhase: "verify",
        affectedComponents: ["test_module"],
        hasPartialDeployment: true,
      });

      expect(result.success).toBe(true);
      expect(result.moduleState).toBe("uninstalled");
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it("executes rollback with snapshot restore", async () => {
      const files: ModuleFile[] = [
        { path: "models/test.py", content: "# test", hash: "abc123" },
      ];

      const snapshot = await handler.createPreDeploySnapshot("test_module", files);

      const context: DeploymentContext = {
        moduleName: "test_module",
        target: "preview",
        deployId: "deploy-123",
        startTime: Date.now(),
        snapshot,
        gitAvailable: false,
      };

      const result = await handler.rollback({
        context,
        error: "Module load failed",
        failedPhase: "install",
        affectedComponents: ["test_module"],
        hasPartialDeployment: true,
      });

      expect(result.success).toBe(true);
      expect(result.strategyUsed).toBe("snapshot");
      expect(result.restoredVersion).toBe("1.0.0");
    });

    it("fails rollback when uninstall fails", async () => {
      handler = createMockRollbackHandler({}, { uninstallSuccess: false });

      const context: DeploymentContext = {
        moduleName: "test_module",
        target: "preview",
        deployId: "deploy-123",
        startTime: Date.now(),
        snapshot: null,
        gitAvailable: false,
      };

      const result = await handler.rollback({
        context,
        error: "Test error",
        failedPhase: "verify",
        affectedComponents: ["test_module"],
        hasPartialDeployment: false,
      });

      expect(result.success).toBe(false);
      expect(result.moduleState).toBe("failed");
      expect(result.error).toContain("Uninstall failed");
    });

    it("uses fallback strategy when primary fails", async () => {
      handler = createMockRollbackHandler({}, { uninstallSuccess: false });

      const context: DeploymentContext = {
        moduleName: "test_module",
        target: "preview",
        deployId: "deploy-123",
        startTime: Date.now(),
        snapshot: null,
        gitAvailable: true,
      };

      const result = await handler.rollback({
        context,
        error: "Test error",
        failedPhase: "verify",
        affectedComponents: ["test_module"],
        hasPartialDeployment: false,
      });

      // Should try fallback (git or manual)
      expect(result.usedFallback).toBe(true);
    });
  });

  describe("Quick Rollback", () => {
    it("performs quick rollback using latest snapshot", async () => {
      const handler = createMockRollbackHandler();

      const files: ModuleFile[] = [
        { path: "test.py", content: "# test", hash: "abc" },
      ];
      await handler.createPreDeploySnapshot("test_module", files);

      const result = await handler.quickRollback("test_module", "Deployment failed");

      expect(result.success).toBe(true);
      expect(result.strategyUsed).toBe("snapshot");
    });

    it("performs quick rollback without snapshot", async () => {
      const handler = createMockRollbackHandler();

      const result = await handler.quickRollback("test_module", "Deployment failed");

      expect(result.success).toBe(true);
      expect(result.moduleState).toBe("uninstalled");
    });
  });

  describe("Strategy Selection", () => {
    it("selects retry strategy for low severity first attempt", async () => {
      const handler = createMockRollbackHandler();

      const context: DeploymentContext = {
        moduleName: "test_module",
        target: "preview",
        deployId: "deploy-123",
        startTime: Date.now(),
        snapshot: null,
        gitAvailable: false,
      };

      // First attempt with single affected component
      const result = await handler.rollback({
        context,
        error: "Minor error",
        failedPhase: "verify",
        affectedComponents: ["test_module"],
        hasPartialDeployment: true,
      });

      expect(result.strategyUsed).toBe("retry");
    });

    it("selects snapshot strategy when available", async () => {
      const handler = createMockRollbackHandler();

      const files: ModuleFile[] = [
        { path: "test.py", content: "# test", hash: "abc" },
      ];
      const snapshot = await handler.createPreDeploySnapshot("test_module", files);

      // Trigger first rollback to increment retry count
      await handler.quickRollback("test_module", "First error");

      const context: DeploymentContext = {
        moduleName: "test_module",
        target: "preview",
        deployId: "deploy-456",
        startTime: Date.now(),
        snapshot,
        gitAvailable: false,
      };

      const result = await handler.rollback({
        context,
        error: "Second error",
        failedPhase: "verify",
        affectedComponents: ["test_module"],
        hasPartialDeployment: false,
      });

      expect(result.strategyUsed).toBe("snapshot");
    });

    it("selects manual strategy when no recovery options", async () => {
      const handler = createMockRollbackHandler({ maxRetries: 0 });

      const context: DeploymentContext = {
        moduleName: "test_module",
        target: "preview",
        deployId: "deploy-123",
        startTime: Date.now(),
        snapshot: null,
        gitAvailable: false,
      };

      const result = await handler.rollback({
        context,
        error: "Critical failure",
        failedPhase: "verify",
        affectedComponents: ["a", "b", "c", "d"], // Many affected = critical
        hasPartialDeployment: false,
      });

      expect(result.strategyUsed).toBe("manual");
      expect(result.success).toBe(false);
    });
  });

  describe("Events", () => {
    it("emits snapshot:created event", async () => {
      const handler = createMockRollbackHandler();
      const events: RollbackEvent[] = [];

      handler.onEvent((event) => events.push(event));

      await handler.createPreDeploySnapshot("test_module");

      const snapshotEvent = events.find((e) => e.type === "snapshot:created");
      expect(snapshotEvent).toBeDefined();
      expect(snapshotEvent?.context.moduleName).toBe("test_module");
    });

    it("emits rollback:start event", async () => {
      const handler = createMockRollbackHandler();
      const events: RollbackEvent[] = [];

      handler.onEvent((event) => events.push(event));

      await handler.quickRollback("test_module", "Error");

      const startEvent = events.find((e) => e.type === "rollback:start");
      expect(startEvent).toBeDefined();
    });

    it("emits rollback:step events", async () => {
      const handler = createMockRollbackHandler();
      const events: RollbackEvent[] = [];

      handler.onEvent((event) => events.push(event));

      await handler.quickRollback("test_module", "Error");

      const stepEvents = events.filter((e) => e.type === "rollback:step");
      expect(stepEvents.length).toBeGreaterThan(0);
    });

    it("emits rollback:success on successful rollback", async () => {
      const handler = createMockRollbackHandler();
      const events: RollbackEvent[] = [];

      handler.onEvent((event) => events.push(event));

      await handler.quickRollback("test_module", "Error");

      const successEvent = events.find((e) => e.type === "rollback:success");
      expect(successEvent).toBeDefined();
      expect(successEvent?.result?.success).toBe(true);
    });

    it("emits rollback:failed on failed rollback", async () => {
      const handler = createMockRollbackHandler({}, { uninstallSuccess: false });
      const events: RollbackEvent[] = [];

      handler.onEvent((event) => events.push(event));

      await handler.quickRollback("test_module", "Error");

      const failedEvent = events.find((e) => e.type === "rollback:failed");
      expect(failedEvent).toBeDefined();
    });

    it("emits uninstall events", async () => {
      const handler = createMockRollbackHandler();
      const events: RollbackEvent[] = [];

      handler.onEvent((event) => events.push(event));

      await handler.quickRollback("test_module", "Error");

      const uninstallStart = events.find((e) => e.type === "uninstall:start");
      const uninstallSuccess = events.find((e) => e.type === "uninstall:success");

      expect(uninstallStart).toBeDefined();
      expect(uninstallSuccess).toBeDefined();
    });

    it("can unsubscribe from events", async () => {
      const handler = createMockRollbackHandler();
      const events: RollbackEvent[] = [];

      const callback = (event: RollbackEvent) => events.push(event);
      handler.onEvent(callback);
      handler.offEvent(callback);

      await handler.quickRollback("test_module", "Error");

      expect(events.length).toBe(0);
    });
  });

  describe("State Management", () => {
    it("tracks rollback state", async () => {
      const handler = createMockRollbackHandler();

      await handler.quickRollback("test_module", "Error 1");
      await handler.quickRollback("test_module", "Error 2");

      const state = handler.getRollbackState();

      expect(state.attempts).toHaveLength(2);
    });

    it("records attempt details", async () => {
      const handler = createMockRollbackHandler();

      await handler.quickRollback("test_module", "Test error");

      const state = handler.getRollbackState();
      const attempt = state.attempts[0];

      expect(attempt.context.error).toBe("Test error");
      expect(attempt.plan).toBeDefined();
      expect(attempt.result).toBeDefined();
      expect(attempt.timestamp).toBeDefined();
    });

    it("tracks last good state", async () => {
      const handler = createMockRollbackHandler();

      await handler.createPreDeploySnapshot("test_module");

      const state = handler.getRollbackState();

      expect(state.lastGoodStateId).toBeDefined();
      expect(state.lastGoodStrategy).toBe("snapshot");
    });
  });

  describe("Configuration", () => {
    it("uses default configuration", () => {
      const handler = createRollbackHandler();
      const config = handler.getConfig();

      expect(config.sidecarUrl).toBe("http://localhost:8069");
      expect(config.timeout).toBe(60000);
      expect(config.maxRetries).toBe(2);
    });

    it("accepts custom configuration", () => {
      const handler = createRollbackHandler({
        sidecarUrl: "http://custom:8080",
        timeout: 30000,
        maxRetries: 5,
      });

      const config = handler.getConfig();

      expect(config.sidecarUrl).toBe("http://custom:8080");
      expect(config.timeout).toBe(30000);
      expect(config.maxRetries).toBe(5);
    });

    it("can update configuration", () => {
      const handler = createRollbackHandler();

      handler.updateConfig({ timeout: 45000 });

      const config = handler.getConfig();
      expect(config.timeout).toBe(45000);
    });
  });

  describe("File Restoration", () => {
    it("restores files from snapshot", async () => {
      const handler = createMockRollbackHandler();

      const files: ModuleFile[] = [
        { path: "models/model.py", content: "class Model: pass", hash: "abc" },
        { path: "views/view.xml", content: "<xml/>", hash: "def" },
        { path: "__manifest__.py", content: "{}", hash: "ghi" },
      ];

      const snapshot = await handler.createPreDeploySnapshot("test_module", files);

      const context: DeploymentContext = {
        moduleName: "test_module",
        target: "preview",
        deployId: "deploy-123",
        startTime: Date.now(),
        snapshot,
        gitAvailable: false,
      };

      const result = await handler.rollback({
        context,
        error: "Deployment failed",
        failedPhase: "install",
        affectedComponents: ["test_module"],
        hasPartialDeployment: true,
      });

      expect(result.success).toBe(true);
      expect(result.strategyUsed).toBe("snapshot");

      // Find restore step
      const restoreStep = result.steps.find((s) => s.name === "restore_files");
      expect(restoreStep?.success).toBe(true);
      expect(restoreStep?.message).toContain("3 files");
    });

    it("handles file write failures gracefully", async () => {
      const handler = createMockRollbackHandler({}, { fileWriteSuccess: false });

      const files: ModuleFile[] = [
        { path: "test.py", content: "# test", hash: "abc" },
      ];

      const snapshot = await handler.createPreDeploySnapshot("test_module", files);

      const context: DeploymentContext = {
        moduleName: "test_module",
        target: "preview",
        deployId: "deploy-123",
        startTime: Date.now(),
        snapshot,
        gitAvailable: false,
      };

      const result = await handler.rollback({
        context,
        error: "Deployment failed",
        failedPhase: "install",
        affectedComponents: ["test_module"],
        hasPartialDeployment: true,
      });

      expect(result.success).toBe(false);
      expect(result.moduleState).toBe("uninstalled");

      const restoreStep = result.steps.find((s) => s.name === "restore_files");
      expect(restoreStep?.success).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("handles empty module name", async () => {
      const handler = createMockRollbackHandler();

      const result = await handler.quickRollback("", "Error");

      // Should still attempt rollback
      expect(result).toBeDefined();
    });

    it("handles concurrent rollbacks", async () => {
      const handler = createMockRollbackHandler();

      const [result1, result2] = await Promise.all([
        handler.quickRollback("module1", "Error 1"),
        handler.quickRollback("module2", "Error 2"),
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it("tracks duration correctly", async () => {
      const handler = createMockRollbackHandler();

      const result = await handler.quickRollback("test_module", "Error");

      expect(result.duration).toBeGreaterThan(0);
    });

    it("handles missing previous version", async () => {
      const handler = createMockRollbackHandler({}, { moduleInstalled: false });

      const snapshot = await handler.createPreDeploySnapshot("new_module");

      expect(snapshot.previousVersion).toBeNull();
    });
  });
});
