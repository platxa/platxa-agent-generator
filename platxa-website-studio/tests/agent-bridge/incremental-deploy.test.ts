import { describe, it, expect, vi } from "vitest";
import {
  hashContent,
  buildFileEntries,
  buildManifest,
  computeDiff,
  createDeployState,
  deploy,
  getLastDeploy,
  getDeployCount,
  getSuccessRate,
} from "@/lib/agent-bridge/incremental-deploy";
import type {
  DeployConfig,
  DeployFileEntry,
  XmlRpcAdapter,
} from "@/lib/agent-bridge/incremental-deploy";

const config: DeployConfig = {
  connection: { url: "http://localhost:8069", db: "test", uid: 1, password: "admin" },
  moduleName: "theme_test",
  concurrency: 2,
};

function makeEntries(files: Array<{ path: string; content: string }>): DeployFileEntry[] {
  return buildFileEntries(files);
}

function mockAdapter(overrides: Partial<XmlRpcAdapter> = {}): XmlRpcAdapter {
  return {
    uploadFile: vi.fn().mockResolvedValue(true),
    removeFile: vi.fn().mockResolvedValue(true),
    upgradeModule: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe("Incremental Deploy", () => {
  describe("hashContent", () => {
    it("returns consistent hash", () => {
      expect(hashContent("hello")).toBe(hashContent("hello"));
    });

    it("returns different hash for different content", () => {
      expect(hashContent("hello")).not.toBe(hashContent("world"));
    });

    it("returns 8-char hex string", () => {
      expect(hashContent("test")).toMatch(/^[0-9a-f]{8}$/);
    });
  });

  describe("buildFileEntries", () => {
    it("computes hashes for entries", () => {
      const entries = makeEntries([{ path: "a.xml", content: "<t/>" }]);
      expect(entries).toHaveLength(1);
      expect(entries[0].hash).toMatch(/^[0-9a-f]{8}$/);
    });
  });

  describe("buildManifest", () => {
    it("builds manifest from entries", () => {
      const entries = makeEntries([
        { path: "a.xml", content: "<t/>" },
        { path: "b.scss", content: ".x{}" },
      ]);
      const manifest = buildManifest("theme_test", entries, 1000);
      expect(manifest.moduleName).toBe("theme_test");
      expect(Object.keys(manifest.files)).toHaveLength(2);
      expect(manifest.timestamp).toBe(1000);
    });
  });

  describe("computeDiff", () => {
    it("all files changed on first deploy", () => {
      const entries = makeEntries([{ path: "a.xml", content: "<t/>" }]);
      const manifest = buildManifest("m", entries);
      const diff = computeDiff(null, manifest);
      expect(diff.changed).toEqual(["a.xml"]);
      expect(diff.removed).toHaveLength(0);
      expect(diff.unchanged).toHaveLength(0);
    });

    it("detects unchanged files", () => {
      const entries = makeEntries([{ path: "a.xml", content: "<t/>" }]);
      const m1 = buildManifest("m", entries);
      const m2 = buildManifest("m", entries);
      const diff = computeDiff(m1, m2);
      expect(diff.changed).toHaveLength(0);
      expect(diff.unchanged).toEqual(["a.xml"]);
    });

    it("detects modified files", () => {
      const e1 = makeEntries([{ path: "a.xml", content: "<t/>" }]);
      const e2 = makeEntries([{ path: "a.xml", content: "<div/>" }]);
      const diff = computeDiff(buildManifest("m", e1), buildManifest("m", e2));
      expect(diff.changed).toEqual(["a.xml"]);
      expect(diff.unchanged).toHaveLength(0);
    });

    it("detects removed files", () => {
      const e1 = makeEntries([
        { path: "a.xml", content: "<t/>" },
        { path: "b.xml", content: "<b/>" },
      ]);
      const e2 = makeEntries([{ path: "a.xml", content: "<t/>" }]);
      const diff = computeDiff(buildManifest("m", e1), buildManifest("m", e2));
      expect(diff.removed).toEqual(["b.xml"]);
    });

    it("detects new files", () => {
      const e1 = makeEntries([{ path: "a.xml", content: "<t/>" }]);
      const e2 = makeEntries([
        { path: "a.xml", content: "<t/>" },
        { path: "c.xml", content: "<c/>" },
      ]);
      const diff = computeDiff(buildManifest("m", e1), buildManifest("m", e2));
      expect(diff.changed).toEqual(["c.xml"]);
      expect(diff.unchanged).toEqual(["a.xml"]);
    });
  });

  describe("deploy", () => {
    it("uploads all files on first deploy", async () => {
      const state = createDeployState(config);
      const adapter = mockAdapter();
      const entries = makeEntries([
        { path: "a.xml", content: "<t/>" },
        { path: "b.scss", content: ".x{}" },
      ]);
      const { result } = await deploy(state, entries, adapter);
      expect(result.success).toBe(true);
      expect(result.uploadedFiles).toHaveLength(2);
      expect(result.moduleUpgraded).toBe(true);
      expect(adapter.uploadFile).toHaveBeenCalledTimes(2);
      expect(adapter.upgradeModule).toHaveBeenCalledWith("theme_test");
    });

    it("uploads only changed files on second deploy", async () => {
      let state = createDeployState(config);
      const adapter = mockAdapter();
      const e1 = makeEntries([
        { path: "a.xml", content: "<t/>" },
        { path: "b.scss", content: ".x{}" },
      ]);
      ({ state } = await deploy(state, e1, adapter));

      const e2 = makeEntries([
        { path: "a.xml", content: "<t/>" },
        { path: "b.scss", content: ".y{}" },
      ]);
      const { result } = await deploy(state, e2, adapter);
      expect(result.uploadedFiles).toEqual(["b.scss"]);
      expect(result.unchangedFiles).toEqual(["a.xml"]);
    });

    it("removes deleted files", async () => {
      let state = createDeployState(config);
      const adapter = mockAdapter();
      const e1 = makeEntries([
        { path: "a.xml", content: "<t/>" },
        { path: "b.scss", content: ".x{}" },
      ]);
      ({ state } = await deploy(state, e1, adapter));

      const e2 = makeEntries([{ path: "a.xml", content: "<t/>" }]);
      const { result } = await deploy(state, e2, adapter);
      expect(result.removedFiles).toEqual(["b.scss"]);
      expect(adapter.removeFile).toHaveBeenCalledWith("b.scss");
    });

    it("skips upgrade when nothing changed", async () => {
      let state = createDeployState(config);
      const adapter = mockAdapter();
      const entries = makeEntries([{ path: "a.xml", content: "<t/>" }]);
      ({ state } = await deploy(state, entries, adapter));

      vi.mocked(adapter.uploadFile).mockClear();
      vi.mocked(adapter.upgradeModule).mockClear();
      const { result } = await deploy(state, entries, adapter);
      expect(result.uploadedFiles).toHaveLength(0);
      expect(result.unchangedFiles).toEqual(["a.xml"]);
      expect(adapter.uploadFile).not.toHaveBeenCalled();
      // upgrade still called as "skipped" but success
      expect(result.moduleUpgraded).toBe(true);
    });

    it("fails if upload fails", async () => {
      const state = createDeployState(config);
      const adapter = mockAdapter({ uploadFile: vi.fn().mockResolvedValue(false) });
      const entries = makeEntries([{ path: "a.xml", content: "<t/>" }]);
      const { result } = await deploy(state, entries, adapter);
      expect(result.success).toBe(false);
      expect(result.error).toContain("a.xml");
    });

    it("records history", async () => {
      const state = createDeployState(config);
      const adapter = mockAdapter();
      const entries = makeEntries([{ path: "a.xml", content: "<t/>" }]);
      const { state: newState } = await deploy(state, entries, adapter);
      expect(newState.history).toHaveLength(1);
    });

    it("updates manifest on success", async () => {
      const state = createDeployState(config);
      const adapter = mockAdapter();
      const entries = makeEntries([{ path: "a.xml", content: "<t/>" }]);
      const { state: newState } = await deploy(state, entries, adapter);
      expect(newState.currentManifest).not.toBeNull();
      expect(newState.currentManifest!.files["a.xml"]).toBeDefined();
    });

    it("does not update manifest on failure", async () => {
      const state = createDeployState(config);
      const adapter = mockAdapter({ uploadFile: vi.fn().mockResolvedValue(false) });
      const entries = makeEntries([{ path: "a.xml", content: "<t/>" }]);
      const { state: newState } = await deploy(state, entries, adapter);
      expect(newState.currentManifest).toBeNull();
    });

    it("does not mutate input state", async () => {
      const state = createDeployState(config);
      const adapter = mockAdapter();
      const entries = makeEntries([{ path: "a.xml", content: "<t/>" }]);
      await deploy(state, entries, adapter);
      expect(state.history).toHaveLength(0);
      expect(state.currentManifest).toBeNull();
    });
  });

  describe("queries", () => {
    it("getLastDeploy returns null initially", () => {
      expect(getLastDeploy(createDeployState(config))).toBeNull();
    });

    it("getLastDeploy returns last result", async () => {
      let state = createDeployState(config);
      const adapter = mockAdapter();
      ({ state } = await deploy(state, makeEntries([{ path: "a.xml", content: "1" }]), adapter));
      ({ state } = await deploy(state, makeEntries([{ path: "a.xml", content: "2" }]), adapter));
      const last = getLastDeploy(state);
      expect(last).not.toBeNull();
      expect(state.history).toHaveLength(2);
    });

    it("getDeployCount returns count", async () => {
      let state = createDeployState(config);
      const adapter = mockAdapter();
      ({ state } = await deploy(state, makeEntries([{ path: "a.xml", content: "1" }]), adapter));
      expect(getDeployCount(state)).toBe(1);
    });

    it("getSuccessRate computes correctly", async () => {
      let state = createDeployState(config);
      const goodAdapter = mockAdapter();
      const badAdapter = mockAdapter({ uploadFile: vi.fn().mockResolvedValue(false) });
      ({ state } = await deploy(state, makeEntries([{ path: "a.xml", content: "1" }]), goodAdapter));
      ({ state } = await deploy(state, makeEntries([{ path: "b.xml", content: "2" }]), badAdapter));
      expect(getSuccessRate(state)).toBe(0.5);
    });
  });
});
