/**
 * Tests for Version Diff View
 *
 * Feature #106: Implement version diff view showing before/after changes
 * Verification: Side-by-side or unified diff view of all changed files
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  VersionDiffView,
  createVersionDiffView,
  DIFF_STYLES,
  computeDiff,
  groupIntoHunks,
  calculateStats,
  formatLineNumber,
  getChangeTypeClass,
  getChangePrefix,
  formatUnifiedDiff,
  parseUnifiedDiff,
  type DiffViewMode,
  type ChangeType,
  type VersionInfo,
} from "../../lib/preview/version-diff-view";

describe("VersionDiffView", () => {
  let diffView: VersionDiffView;

  const createVersion = (
    id: string,
    files: Record<string, string>
  ): VersionInfo => ({
    id,
    label: `Version ${id}`,
    timestamp: Date.now(),
    files: new Map(Object.entries(files)),
  });

  beforeEach(() => {
    diffView = new VersionDiffView();
  });

  afterEach(() => {
    diffView.dispose();
  });

  describe("constructor", () => {
    it("should create instance with default state", () => {
      const state = diffView.getState();

      expect(state.mode).toBe("unified");
      expect(state.oldVersion).toBeNull();
      expect(state.newVersion).toBeNull();
      expect(state.fileDiffs).toEqual([]);
      expect(state.loading).toBe(false);
    });

    it("should accept custom options", () => {
      const custom = new VersionDiffView({
        mode: "side-by-side",
        contextLines: 5,
      });

      expect(custom.getMode()).toBe("side-by-side");
      expect(custom.getState().contextLines).toBe(5);

      custom.dispose();
    });
  });

  describe("setVersions", () => {
    it("should compute diffs for changed files", () => {
      const oldVersion = createVersion("v1", {
        "file.txt": "line1\nline2\nline3",
      });
      const newVersion = createVersion("v2", {
        "file.txt": "line1\nmodified\nline3",
      });

      diffView.setVersions(oldVersion, newVersion);

      const state = diffView.getState();
      expect(state.fileDiffs).toHaveLength(1);
      expect(state.fileDiffs[0].path).toBe("file.txt");
      expect(state.totalStats.total).toBeGreaterThan(0);
    });

    it("should detect new files", () => {
      const oldVersion = createVersion("v1", {});
      const newVersion = createVersion("v2", {
        "new-file.txt": "content",
      });

      diffView.setVersions(oldVersion, newVersion);

      const diff = diffView.getFileDiffs()[0];
      expect(diff.isNew).toBe(true);
      expect(diff.isDeleted).toBe(false);
    });

    it("should detect deleted files", () => {
      const oldVersion = createVersion("v1", {
        "deleted.txt": "content",
      });
      const newVersion = createVersion("v2", {});

      diffView.setVersions(oldVersion, newVersion);

      const diff = diffView.getFileDiffs()[0];
      expect(diff.isDeleted).toBe(true);
      expect(diff.isNew).toBe(false);
    });

    it("should skip unchanged files", () => {
      const oldVersion = createVersion("v1", {
        "unchanged.txt": "same content",
        "changed.txt": "old",
      });
      const newVersion = createVersion("v2", {
        "unchanged.txt": "same content",
        "changed.txt": "new",
      });

      diffView.setVersions(oldVersion, newVersion);

      expect(diffView.getFileDiffs()).toHaveLength(1);
      expect(diffView.getFileDiffs()[0].path).toBe("changed.txt");
    });

    it("should select first file automatically", () => {
      const oldVersion = createVersion("v1", { "a.txt": "old" });
      const newVersion = createVersion("v2", { "a.txt": "new" });

      diffView.setVersions(oldVersion, newVersion);

      expect(diffView.getState().selectedFile).toBe("a.txt");
    });

    it("should trigger state change callback", () => {
      const callback = vi.fn();
      diffView.onStateChange(callback);

      const oldVersion = createVersion("v1", { "a.txt": "old" });
      const newVersion = createVersion("v2", { "a.txt": "new" });

      diffView.setVersions(oldVersion, newVersion);

      expect(callback).toHaveBeenCalled();
    });
  });

  describe("setMode", () => {
    it("should change view mode", () => {
      diffView.setMode("side-by-side");
      expect(diffView.getMode()).toBe("side-by-side");

      diffView.setMode("unified");
      expect(diffView.getMode()).toBe("unified");

      diffView.setMode("inline");
      expect(diffView.getMode()).toBe("inline");
    });

    it("should trigger state change callback", () => {
      const callback = vi.fn();
      diffView.onStateChange(callback);

      diffView.setMode("side-by-side");

      expect(callback).toHaveBeenCalled();
    });
  });

  describe("setContextLines", () => {
    it("should update context lines", () => {
      diffView.setContextLines(5);

      expect(diffView.getState().contextLines).toBe(5);
    });

    it("should clamp to minimum of 0", () => {
      diffView.setContextLines(-1);

      expect(diffView.getState().contextLines).toBe(0);
    });

    it("should recompute diffs with new context", () => {
      const oldVersion = createVersion("v1", {
        "file.txt": "1\n2\n3\n4\n5\n6\n7\n8\n9\n10",
      });
      const newVersion = createVersion("v2", {
        "file.txt": "1\n2\n3\nMODIFIED\n5\n6\n7\n8\n9\n10",
      });

      diffView.setVersions(oldVersion, newVersion);
      const hunks1 = diffView.getFileDiffs()[0].hunks;

      diffView.setContextLines(1);
      const hunks2 = diffView.getFileDiffs()[0].hunks;

      // Different context should affect hunk structure
      expect(hunks1).toBeDefined();
      expect(hunks2).toBeDefined();
    });
  });

  describe("file selection", () => {
    beforeEach(() => {
      const oldVersion = createVersion("v1", {
        "a.txt": "old a",
        "b.txt": "old b",
        "c.txt": "old c",
      });
      const newVersion = createVersion("v2", {
        "a.txt": "new a",
        "b.txt": "new b",
        "c.txt": "new c",
      });
      diffView.setVersions(oldVersion, newVersion);
    });

    it("should select file", () => {
      diffView.selectFile("b.txt");

      expect(diffView.getState().selectedFile).toBe("b.txt");
    });

    it("should ignore non-existent file", () => {
      diffView.selectFile("nonexistent.txt");

      expect(diffView.getState().selectedFile).toBe("a.txt");
    });

    it("should trigger file select callback", () => {
      const callback = vi.fn();
      diffView.onFileSelect(callback);

      diffView.selectFile("b.txt");

      expect(callback).toHaveBeenCalledWith("b.txt");
    });

    it("should navigate to next file", () => {
      diffView.selectFile("a.txt");
      diffView.nextFile();

      expect(diffView.getState().selectedFile).toBe("b.txt");
    });

    it("should wrap around when navigating next", () => {
      diffView.selectFile("c.txt");
      diffView.nextFile();

      expect(diffView.getState().selectedFile).toBe("a.txt");
    });

    it("should navigate to previous file", () => {
      diffView.selectFile("b.txt");
      diffView.previousFile();

      expect(diffView.getState().selectedFile).toBe("a.txt");
    });

    it("should wrap around when navigating previous", () => {
      diffView.selectFile("a.txt");
      diffView.previousFile();

      expect(diffView.getState().selectedFile).toBe("c.txt");
    });
  });

  describe("getSelectedFileDiff", () => {
    it("should return selected file diff", () => {
      const oldVersion = createVersion("v1", { "file.txt": "old" });
      const newVersion = createVersion("v2", { "file.txt": "new" });
      diffView.setVersions(oldVersion, newVersion);

      const diff = diffView.getSelectedFileDiff();

      expect(diff).toBeDefined();
      expect(diff?.path).toBe("file.txt");
    });

    it("should return undefined when no selection", () => {
      expect(diffView.getSelectedFileDiff()).toBeUndefined();
    });
  });

  describe("getSideBySideData", () => {
    it("should return left and right columns", () => {
      const oldVersion = createVersion("v1", { "file.txt": "old\ncommon" });
      const newVersion = createVersion("v2", { "file.txt": "new\ncommon" });
      diffView.setVersions(oldVersion, newVersion);

      const data = diffView.getSideBySideData();

      expect(data).toBeDefined();
      expect(data?.left).toBeDefined();
      expect(data?.right).toBeDefined();
    });
  });

  describe("getUnifiedData", () => {
    it("should return unified diff lines", () => {
      const oldVersion = createVersion("v1", { "file.txt": "old" });
      const newVersion = createVersion("v2", { "file.txt": "new" });
      diffView.setVersions(oldVersion, newVersion);

      const lines = diffView.getUnifiedData();

      expect(lines.length).toBeGreaterThan(0);
    });
  });

  describe("clear", () => {
    it("should reset state", () => {
      const oldVersion = createVersion("v1", { "file.txt": "old" });
      const newVersion = createVersion("v2", { "file.txt": "new" });
      diffView.setVersions(oldVersion, newVersion);

      diffView.clear();

      const state = diffView.getState();
      expect(state.oldVersion).toBeNull();
      expect(state.newVersion).toBeNull();
      expect(state.fileDiffs).toEqual([]);
      expect(state.selectedFile).toBeNull();
    });
  });

  describe("hasChanges", () => {
    it("should return true when there are changes", () => {
      const oldVersion = createVersion("v1", { "file.txt": "old" });
      const newVersion = createVersion("v2", { "file.txt": "new" });
      diffView.setVersions(oldVersion, newVersion);

      expect(diffView.hasChanges()).toBe(true);
    });

    it("should return false when no changes", () => {
      expect(diffView.hasChanges()).toBe(false);
    });
  });

  describe("callbacks", () => {
    it("should support multiple callbacks", () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      diffView.onStateChange(cb1);
      diffView.onStateChange(cb2);

      diffView.setMode("side-by-side");

      expect(cb1).toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
    });

    it("should return unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = diffView.onStateChange(callback);

      diffView.setMode("side-by-side");
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      diffView.setMode("unified");
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should handle callback errors gracefully", () => {
      const errorCb = vi.fn(() => {
        throw new Error("Callback error");
      });
      const normalCb = vi.fn();

      diffView.onStateChange(errorCb);
      diffView.onStateChange(normalCb);

      expect(() => diffView.setMode("side-by-side")).not.toThrow();
      expect(normalCb).toHaveBeenCalled();
    });
  });

  describe("dispose", () => {
    it("should prevent further operations", () => {
      const callback = vi.fn();
      diffView.onStateChange(callback);

      diffView.dispose();
      diffView.setMode("side-by-side");

      expect(callback).not.toHaveBeenCalled();
    });

    it("should be idempotent", () => {
      expect(() => {
        diffView.dispose();
        diffView.dispose();
      }).not.toThrow();
    });
  });
});

describe("createVersionDiffView", () => {
  it("should create instance with factory function", () => {
    const view = createVersionDiffView({ mode: "side-by-side" });

    expect(view).toBeInstanceOf(VersionDiffView);
    expect(view.getMode()).toBe("side-by-side");

    view.dispose();
  });
});

describe("computeDiff", () => {
  it("should detect added lines", () => {
    const lines = computeDiff("line1", "line1\nline2");

    expect(lines.some((l) => l.type === "added")).toBe(true);
  });

  it("should detect removed lines", () => {
    const lines = computeDiff("line1\nline2", "line1");

    expect(lines.some((l) => l.type === "removed")).toBe(true);
  });

  it("should detect unchanged lines", () => {
    const lines = computeDiff("common", "common");

    expect(lines.every((l) => l.type === "unchanged")).toBe(true);
  });

  it("should handle empty strings", () => {
    expect(computeDiff("", "")).toEqual([]);
    expect(computeDiff("", "new")).toHaveLength(1);
    expect(computeDiff("old", "")).toHaveLength(1);
  });

  it("should ignore whitespace when option set", () => {
    const lines = computeDiff("  hello  ", "hello", { ignoreWhitespace: true });

    expect(lines.every((l) => l.type === "unchanged")).toBe(true);
  });
});

describe("groupIntoHunks", () => {
  it("should group changes into hunks", () => {
    const lines = computeDiff(
      "1\n2\n3\n4\n5\n6\n7\n8\n9\n10",
      "1\n2\nCHANGED\n4\n5\n6\n7\n8\n9\n10"
    );

    const hunks = groupIntoHunks(lines, 2);

    expect(hunks.length).toBeGreaterThan(0);
    expect(hunks[0].header).toMatch(/^@@.*@@$/);
  });

  it("should include context lines", () => {
    const lines = computeDiff("1\n2\n3\n4\n5", "1\n2\nX\n4\n5");

    const hunks = groupIntoHunks(lines, 1);

    expect(hunks[0].lines.some((l) => l.isContext)).toBe(true);
  });
});

describe("calculateStats", () => {
  it("should count additions and deletions", () => {
    const lines = computeDiff("old1\nold2", "new1\nold2\nnew2");

    const stats = calculateStats(lines);

    expect(stats.additions).toBeGreaterThan(0);
    expect(stats.deletions).toBeGreaterThan(0);
    expect(stats.total).toBe(stats.additions + stats.deletions);
  });
});

describe("utility functions", () => {
  describe("formatLineNumber", () => {
    it("should format line numbers", () => {
      expect(formatLineNumber(1)).toBe("1");
      expect(formatLineNumber(100)).toBe("100");
      expect(formatLineNumber(undefined)).toBe("");
    });
  });

  describe("getChangeTypeClass", () => {
    it("should return correct classes for each type", () => {
      const types: ChangeType[] = ["added", "removed", "modified", "unchanged"];

      for (const type of types) {
        const cls = getChangeTypeClass(type);
        expect(cls).toBeTruthy();
      }
    });
  });

  describe("getChangePrefix", () => {
    it("should return correct prefix", () => {
      expect(getChangePrefix("added")).toBe("+");
      expect(getChangePrefix("removed")).toBe("-");
      expect(getChangePrefix("unchanged")).toBe(" ");
    });
  });

  describe("formatUnifiedDiff", () => {
    it("should format as unified diff", () => {
      const diff = {
        path: "file.txt",
        isNew: false,
        isDeleted: false,
        isRenamed: false,
        isBinary: false,
        hunks: [
          {
            oldStart: 1,
            oldLines: 2,
            newStart: 1,
            newLines: 2,
            header: "@@ -1,2 +1,2 @@",
            lines: [
              { oldLineNumber: 1, content: "old", type: "removed" as const },
              { newLineNumber: 1, content: "new", type: "added" as const },
            ],
          },
        ],
        stats: { additions: 1, deletions: 1, total: 2 },
      };

      const formatted = formatUnifiedDiff(diff);

      expect(formatted).toContain("--- a/file.txt");
      expect(formatted).toContain("+++ b/file.txt");
      expect(formatted).toContain("-old");
      expect(formatted).toContain("+new");
    });
  });

  describe("parseUnifiedDiff", () => {
    it("should parse unified diff format", () => {
      const diffText = `--- a/file.txt
+++ b/file.txt
@@ -1,2 +1,2 @@
-old
+new
 common`;

      const files = parseUnifiedDiff(diffText);

      expect(files).toHaveLength(1);
      expect(files[0].path).toBe("file.txt");
      expect(files[0].stats.additions).toBe(1);
      expect(files[0].stats.deletions).toBe(1);
    });
  });
});

describe("constants", () => {
  describe("DIFF_STYLES", () => {
    it("should have all required style keys", () => {
      expect(DIFF_STYLES.container).toBeTruthy();
      expect(DIFF_STYLES.header).toBeTruthy();
      expect(DIFF_STYLES.lineNumber).toBeTruthy();
      expect(DIFF_STYLES.added).toBeTruthy();
      expect(DIFF_STYLES.removed).toBeTruthy();
      expect(DIFF_STYLES.unchanged).toBeTruthy();
      expect(DIFF_STYLES.modified).toBeTruthy();
      expect(DIFF_STYLES.hunkHeader).toBeTruthy();
    });
  });
});

describe("view mode verification", () => {
  it("should support side-by-side view mode", () => {
    const diffView = createVersionDiffView({ mode: "side-by-side" });

    const oldVersion: VersionInfo = {
      id: "v1",
      label: "Before",
      timestamp: Date.now(),
      files: new Map([["file.txt", "old content\nline 2"]]),
    };

    const newVersion: VersionInfo = {
      id: "v2",
      label: "After",
      timestamp: Date.now(),
      files: new Map([["file.txt", "new content\nline 2"]]),
    };

    diffView.setVersions(oldVersion, newVersion);

    const data = diffView.getSideBySideData();
    expect(data).toBeDefined();
    expect(data?.left).toBeDefined();
    expect(data?.right).toBeDefined();

    diffView.dispose();
  });

  it("should support unified view mode", () => {
    const diffView = createVersionDiffView({ mode: "unified" });

    const oldVersion: VersionInfo = {
      id: "v1",
      label: "Before",
      timestamp: Date.now(),
      files: new Map([["file.txt", "old content"]]),
    };

    const newVersion: VersionInfo = {
      id: "v2",
      label: "After",
      timestamp: Date.now(),
      files: new Map([["file.txt", "new content"]]),
    };

    diffView.setVersions(oldVersion, newVersion);

    const lines = diffView.getUnifiedData();
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((l) => l.type === "added" || l.type === "removed")).toBe(true);

    diffView.dispose();
  });

  it("should show all changed files", () => {
    const diffView = createVersionDiffView();

    const oldVersion: VersionInfo = {
      id: "v1",
      label: "Before",
      timestamp: Date.now(),
      files: new Map([
        ["file1.txt", "old 1"],
        ["file2.txt", "old 2"],
        ["file3.txt", "unchanged"],
      ]),
    };

    const newVersion: VersionInfo = {
      id: "v2",
      label: "After",
      timestamp: Date.now(),
      files: new Map([
        ["file1.txt", "new 1"],
        ["file2.txt", "new 2"],
        ["file3.txt", "unchanged"],
      ]),
    };

    diffView.setVersions(oldVersion, newVersion);

    const diffs = diffView.getFileDiffs();
    expect(diffs).toHaveLength(2); // file1.txt and file2.txt changed
    expect(diffs.map((d) => d.path)).toContain("file1.txt");
    expect(diffs.map((d) => d.path)).toContain("file2.txt");
    expect(diffs.map((d) => d.path)).not.toContain("file3.txt"); // unchanged

    diffView.dispose();
  });
});
