import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AutoSnapshotService,
  createAutoSnapshotService,
  shouldCaptureSnapshot,
  generateSnapshotLabel,
  DEFAULT_AUTO_SNAPSHOT_CONFIG,
  SNAPSHOT_METHOD_LABELS,
  type GenerationResult,
  type AutoSnapshotConfig,
  type GitServiceInterface,
} from "@/lib/agent-bridge/auto-snapshot";
import { createTimeline } from "@/lib/agent-bridge/snapshot-timeline";

describe("AutoSnapshotService", () => {
  describe("automatic snapshot capture after successful generation (Feature #103)", () => {
    it("captures file snapshot after agent completes successfully", () => {
      // Feature #103: File snapshot created after agent completes successfully
      const service = createAutoSnapshotService({ method: "file" });
      const timeline = createTimeline();

      const result: GenerationResult = {
        success: true,
        html: "<div>Generated content</div>",
        scss: ".test { color: red; }",
        label: "Initial generation",
      };

      const { autoResult, updatedTimeline } = service.captureAfterGeneration(
        result,
        timeline
      );

      expect(autoResult.success).toBe(true);
      expect(autoResult.fileSnapshot).toBeDefined();
      expect(updatedTimeline.snapshots.length).toBe(1);
    });

    it("creates git commit after successful generation when configured", () => {
      // Feature #103: Git commit created after agent completes successfully
      const mockGitService: GitServiceInterface = {
        saveChanges: vi.fn().mockReturnValue({
          success: true,
          message: "Committed",
          data: {
            commit: {
              hash: "abc123def456",
              shortHash: "abc123d",
              message: "feat(auto): Test generation",
              author: "Test",
              email: "test@test.com",
              timestamp: new Date(),
              files: ["views/snippets.xml", "static/src/scss/theme.scss"],
            },
          },
        }),
        getHistory: vi.fn().mockReturnValue([]),
      };

      const service = createAutoSnapshotService({ method: "git" }, mockGitService);
      const timeline = createTimeline();

      const result: GenerationResult = {
        success: true,
        html: "<div>Content</div>",
        scss: ".css {}",
        label: "Test generation",
      };

      const { autoResult } = service.captureAfterGeneration(result, timeline);

      expect(autoResult.success).toBe(true);
      expect(autoResult.gitCommit).toBeDefined();
      expect(mockGitService.saveChanges).toHaveBeenCalled();
    });

    it("does not capture snapshot when generation fails", () => {
      // Feature #103: No snapshot when generation fails
      const service = createAutoSnapshotService();
      const timeline = createTimeline();

      const result: GenerationResult = {
        success: false,
        html: "",
        scss: "",
        label: "Failed generation",
      };

      const { autoResult, updatedTimeline } = service.captureAfterGeneration(
        result,
        timeline
      );

      expect(autoResult.success).toBe(false);
      expect(autoResult.error).toContain("not successful");
      expect(updatedTimeline.snapshots.length).toBe(0);
    });
  });

  describe("configuration", () => {
    it("uses default configuration", () => {
      const service = createAutoSnapshotService();
      const config = service.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.method).toBe("both");
      expect(config.maxSnapshots).toBe(50);
    });

    it("accepts custom configuration", () => {
      const service = createAutoSnapshotService({
        enabled: false,
        method: "git",
        maxSnapshots: 100,
      });

      const config = service.getConfig();

      expect(config.enabled).toBe(false);
      expect(config.method).toBe("git");
      expect(config.maxSnapshots).toBe(100);
    });

    it("can enable and disable auto-snapshot", () => {
      const service = createAutoSnapshotService();

      service.disable();
      expect(service.isEnabled()).toBe(false);

      service.enable();
      expect(service.isEnabled()).toBe(true);
    });

    it("can change snapshot method", () => {
      const service = createAutoSnapshotService();

      service.setMethod("file");
      expect(service.getMethod()).toBe("file");

      service.setMethod("git");
      expect(service.getMethod()).toBe("git");
    });
  });

  describe("capture count tracking", () => {
    it("tracks total captures", () => {
      const service = createAutoSnapshotService({ method: "file" });

      expect(service.getCaptureCount()).toBe(0);

      const result: GenerationResult = {
        success: true,
        html: "<div/>",
        scss: ".a {}",
        label: "Gen 1",
      };

      service.captureAfterGeneration(result, createTimeline());
      expect(service.getCaptureCount()).toBe(1);

      service.captureAfterGeneration(result, createTimeline());
      expect(service.getCaptureCount()).toBe(2);
    });

    it("can reset capture count", () => {
      const service = createAutoSnapshotService({ method: "file" });

      service.captureAfterGeneration(
        { success: true, html: "", scss: "", label: "" },
        createTimeline()
      );

      service.resetCaptureCount();
      expect(service.getCaptureCount()).toBe(0);
    });
  });

  describe("disabled state", () => {
    it("does not capture when disabled", () => {
      const service = createAutoSnapshotService({ enabled: false });
      const timeline = createTimeline();

      const result: GenerationResult = {
        success: true,
        html: "<div/>",
        scss: ".a {}",
        label: "Test",
      };

      const { autoResult, updatedTimeline } = service.captureAfterGeneration(
        result,
        timeline
      );

      expect(autoResult.success).toBe(false);
      expect(autoResult.error).toContain("disabled");
      expect(updatedTimeline.snapshots.length).toBe(0);
    });
  });
});

describe("DEFAULT_AUTO_SNAPSHOT_CONFIG", () => {
  it("has sensible defaults", () => {
    expect(DEFAULT_AUTO_SNAPSHOT_CONFIG.enabled).toBe(true);
    expect(DEFAULT_AUTO_SNAPSHOT_CONFIG.method).toBe("both");
    expect(DEFAULT_AUTO_SNAPSHOT_CONFIG.captureThumbnail).toBe(true);
    expect(DEFAULT_AUTO_SNAPSHOT_CONFIG.maxSnapshots).toBe(50);
    expect(DEFAULT_AUTO_SNAPSHOT_CONFIG.commitPrefix).toBe("auto");
  });
});

describe("SNAPSHOT_METHOD_LABELS", () => {
  it("provides labels for all methods", () => {
    expect(SNAPSHOT_METHOD_LABELS.git).toBe("Git Commit");
    expect(SNAPSHOT_METHOD_LABELS.file).toBe("File Snapshot");
    expect(SNAPSHOT_METHOD_LABELS.both).toBe("Git + File Snapshot");
  });
});

describe("shouldCaptureSnapshot", () => {
  it("returns true for successful generation when enabled", () => {
    const result: GenerationResult = {
      success: true,
      html: "",
      scss: "",
      label: "",
    };
    const config: AutoSnapshotConfig = {
      ...DEFAULT_AUTO_SNAPSHOT_CONFIG,
      enabled: true,
    };

    expect(shouldCaptureSnapshot(result, config)).toBe(true);
  });

  it("returns false for failed generation", () => {
    const result: GenerationResult = {
      success: false,
      html: "",
      scss: "",
      label: "",
    };
    const config: AutoSnapshotConfig = {
      ...DEFAULT_AUTO_SNAPSHOT_CONFIG,
      enabled: true,
    };

    expect(shouldCaptureSnapshot(result, config)).toBe(false);
  });

  it("returns false when disabled", () => {
    const result: GenerationResult = {
      success: true,
      html: "",
      scss: "",
      label: "",
    };
    const config: AutoSnapshotConfig = {
      ...DEFAULT_AUTO_SNAPSHOT_CONFIG,
      enabled: false,
    };

    expect(shouldCaptureSnapshot(result, config)).toBe(false);
  });
});

describe("generateSnapshotLabel", () => {
  it("generates label with step number", () => {
    expect(generateSnapshotLabel(1)).toBe("Generation #1");
    expect(generateSnapshotLabel(5)).toBe("Generation #5");
  });

  it("includes description when provided", () => {
    expect(generateSnapshotLabel(1, "Hero section added")).toBe(
      "Generation #1: Hero section added"
    );
  });
});
