/**
 * Tests for File Diff Display
 *
 * Feature #116: Add file diff inline display in chat messages
 * Verification: Diff blocks show added/removed lines with color coding
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  FileDiffDisplay,
  createFileDiffDisplay,
  DEFAULT_COLORS,
  LIGHT_COLORS,
  LINE_PREFIXES,
  CSS_CLASSES,
  parseUnifiedDiff,
  createDiff,
  groupIntoHunks,
  renderLineText,
  renderLineHtml,
  escapeHtml,
  getLineColor,
  formatDiffStats,
  type DiffLine,
  type FileDiff,
} from "../../lib/preview/file-diff-display";

describe("FileDiffDisplay", () => {
  let display: FileDiffDisplay;

  beforeEach(() => {
    display = createFileDiffDisplay();
  });

  afterEach(() => {
    display.dispose();
  });

  describe("utility functions", () => {
    describe("escapeHtml", () => {
      it("should escape HTML special characters", () => {
        expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
        expect(escapeHtml("a & b")).toBe("a &amp; b");
        expect(escapeHtml('"test"')).toBe("&quot;test&quot;");
        expect(escapeHtml("'test'")).toBe("&#039;test&#039;");
      });

      it("should handle empty string", () => {
        expect(escapeHtml("")).toBe("");
      });
    });

    describe("formatDiffStats", () => {
      it("should format additions only", () => {
        expect(formatDiffStats(5, 0)).toBe("+5");
      });

      it("should format deletions only", () => {
        expect(formatDiffStats(0, 3)).toBe("-3");
      });

      it("should format both", () => {
        expect(formatDiffStats(5, 3)).toBe("+5 -3");
      });

      it("should handle no changes", () => {
        expect(formatDiffStats(0, 0)).toBe("no changes");
      });
    });

    describe("getLineColor", () => {
      it("should return green for added lines", () => {
        const { color, background } = getLineColor("added");
        expect(color).toBe(DEFAULT_COLORS.added);
        expect(background).toBe(DEFAULT_COLORS.addedBackground);
      });

      it("should return red for removed lines", () => {
        const { color, background } = getLineColor("removed");
        expect(color).toBe(DEFAULT_COLORS.removed);
        expect(background).toBe(DEFAULT_COLORS.removedBackground);
      });

      it("should return gray for unchanged lines", () => {
        const { color, background } = getLineColor("unchanged");
        expect(color).toBe(DEFAULT_COLORS.unchanged);
        expect(background).toBe(DEFAULT_COLORS.unchangedBackground);
      });

      it("should use custom colors", () => {
        const customColors = { ...DEFAULT_COLORS, added: "#00ff00" };
        const { color } = getLineColor("added", customColors);
        expect(color).toBe("#00ff00");
      });
    });

    describe("renderLineText", () => {
      it("should render added line with + prefix", () => {
        const line: DiffLine = { content: "new line", type: "added" };
        expect(renderLineText(line)).toBe("+new line");
      });

      it("should render removed line with - prefix", () => {
        const line: DiffLine = { content: "old line", type: "removed" };
        expect(renderLineText(line)).toBe("-old line");
      });

      it("should render unchanged line with space prefix", () => {
        const line: DiffLine = { content: "same line", type: "unchanged" };
        expect(renderLineText(line)).toBe(" same line");
      });
    });

    describe("renderLineHtml", () => {
      it("should render HTML with color styling", () => {
        const line: DiffLine = {
          content: "new line",
          type: "added",
          newLineNumber: 1,
        };
        const html = renderLineHtml(line);

        expect(html).toContain("diff-line-added");
        expect(html).toContain(DEFAULT_COLORS.added);
        expect(html).toContain("+");
        expect(html).toContain("new line");
      });

      it("should include line numbers when enabled", () => {
        const line: DiffLine = {
          content: "test",
          type: "unchanged",
          oldLineNumber: 5,
          newLineNumber: 7,
        };
        const html = renderLineHtml(line, DEFAULT_COLORS, true);

        expect(html).toContain("5");
        expect(html).toContain("7");
      });

      it("should escape HTML in content", () => {
        const line: DiffLine = { content: "<script>", type: "added" };
        const html = renderLineHtml(line);

        expect(html).toContain("&lt;script&gt;");
        expect(html).not.toContain("<script>");
      });
    });
  });

  describe("createDiff", () => {
    it("should create diff from old and new content", () => {
      const oldContent = "line1\nline2\nline3";
      const newContent = "line1\nmodified\nline3";

      const diff = createDiff("test.txt", oldContent, newContent);

      expect(diff.filePath).toBe("test.txt");
      expect(diff.additions).toBe(1);
      expect(diff.deletions).toBe(1);
    });

    it("should detect new file", () => {
      const diff = createDiff("new.txt", "", "content");

      expect(diff.isNew).toBe(true);
      expect(diff.additions).toBe(1);
    });

    it("should detect deleted file", () => {
      const diff = createDiff("deleted.txt", "content", "");

      expect(diff.isDeleted).toBe(true);
      expect(diff.deletions).toBe(1);
    });

    it("should handle empty to empty", () => {
      const diff = createDiff("empty.txt", "", "");

      expect(diff.additions).toBe(0);
      expect(diff.deletions).toBe(0);
      expect(diff.hunks).toHaveLength(0);
    });

    it("should create hunks with changes", () => {
      const oldContent = "a\nb\nc";
      const newContent = "a\nx\nc";

      const diff = createDiff("test.txt", oldContent, newContent);

      expect(diff.hunks.length).toBeGreaterThan(0);
    });
  });

  describe("parseUnifiedDiff", () => {
    it("should parse basic unified diff", () => {
      const diffText = `diff --git a/file.txt b/file.txt
--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,3 @@
 line1
-old line
+new line
 line3`;

      const diffs = parseUnifiedDiff(diffText);

      expect(diffs).toHaveLength(1);
      expect(diffs[0].filePath).toBe("file.txt");
      expect(diffs[0].additions).toBe(1);
      expect(diffs[0].deletions).toBe(1);
    });

    it("should parse new file", () => {
      const diffText = `diff --git a/new.txt b/new.txt
new file mode 100644
--- /dev/null
+++ b/new.txt
@@ -0,0 +1,2 @@
+line1
+line2`;

      const diffs = parseUnifiedDiff(diffText);

      expect(diffs[0].isNew).toBe(true);
      expect(diffs[0].additions).toBe(2);
    });

    it("should parse deleted file", () => {
      const diffText = `diff --git a/old.txt b/old.txt
deleted file mode 100644
--- a/old.txt
+++ /dev/null
@@ -1,2 +0,0 @@
-line1
-line2`;

      const diffs = parseUnifiedDiff(diffText);

      expect(diffs[0].isDeleted).toBe(true);
      expect(diffs[0].deletions).toBe(2);
    });

    it("should parse rename", () => {
      const diffText = `diff --git a/old.txt b/new.txt
--- a/old.txt
+++ b/new.txt
@@ -1,1 +1,1 @@
 content`;

      const diffs = parseUnifiedDiff(diffText);

      expect(diffs[0].isRename).toBe(true);
      expect(diffs[0].oldFilePath).toBe("old.txt");
      expect(diffs[0].filePath).toBe("new.txt");
    });

    it("should parse multiple files", () => {
      const diffText = `diff --git a/file1.txt b/file1.txt
--- a/file1.txt
+++ b/file1.txt
@@ -1,1 +1,1 @@
-old
+new
diff --git a/file2.txt b/file2.txt
--- a/file2.txt
+++ b/file2.txt
@@ -1,1 +1,1 @@
-foo
+bar`;

      const diffs = parseUnifiedDiff(diffText);

      expect(diffs).toHaveLength(2);
      expect(diffs[0].filePath).toBe("file1.txt");
      expect(diffs[1].filePath).toBe("file2.txt");
    });
  });

  describe("groupIntoHunks", () => {
    it("should group changes into hunks", () => {
      const lines: DiffLine[] = [
        { content: "a", type: "unchanged", oldLineNumber: 1, newLineNumber: 1 },
        { content: "b", type: "removed", oldLineNumber: 2 },
        { content: "c", type: "added", newLineNumber: 2 },
        { content: "d", type: "unchanged", oldLineNumber: 3, newLineNumber: 3 },
      ];

      const hunks = groupIntoHunks(lines);

      expect(hunks.length).toBeGreaterThan(0);
      expect(hunks[0].lines.length).toBeGreaterThan(0);
    });

    it("should return empty for no lines", () => {
      expect(groupIntoHunks([])).toEqual([]);
    });
  });

  describe("addDiff", () => {
    it("should add a diff", () => {
      const diff = createDiff("test.txt", "old", "new");
      display.addDiff(diff);

      expect(display.getDiff("test.txt")).toEqual(diff);
    });

    it("should expand file by default", () => {
      const diff = createDiff("test.txt", "old", "new");
      display.addDiff(diff);

      expect(display.isFileExpanded("test.txt")).toBe(true);
    });

    it("should throw if disposed", () => {
      display.dispose();
      const diff = createDiff("test.txt", "old", "new");

      expect(() => display.addDiff(diff)).toThrow("FileDiffDisplay is disposed");
    });
  });

  describe("createAndAddDiff", () => {
    it("should create diff from content and add it", () => {
      const diff = display.createAndAddDiff("test.txt", "old", "new");

      expect(diff.filePath).toBe("test.txt");
      expect(display.getDiff("test.txt")).toEqual(diff);
    });
  });

  describe("parseAndAddDiffs", () => {
    it("should parse unified diff and add diffs", () => {
      const diffText = `diff --git a/file.txt b/file.txt
--- a/file.txt
+++ b/file.txt
@@ -1,1 +1,1 @@
-old
+new`;

      const diffs = display.parseAndAddDiffs(diffText);

      expect(diffs).toHaveLength(1);
      expect(display.getDiff("file.txt")).toBeDefined();
    });
  });

  describe("removeDiff", () => {
    it("should remove a diff", () => {
      display.createAndAddDiff("test.txt", "old", "new");
      expect(display.removeDiff("test.txt")).toBe(true);
      expect(display.getDiff("test.txt")).toBeUndefined();
    });

    it("should return false for non-existent", () => {
      expect(display.removeDiff("missing.txt")).toBe(false);
    });
  });

  describe("clearDiffs", () => {
    it("should clear all diffs", () => {
      display.createAndAddDiff("file1.txt", "a", "b");
      display.createAndAddDiff("file2.txt", "c", "d");
      display.clearDiffs();

      expect(display.getAllDiffs()).toHaveLength(0);
    });
  });

  describe("toggleFileExpanded", () => {
    it("should toggle expansion state", () => {
      display.createAndAddDiff("test.txt", "old", "new");

      expect(display.isFileExpanded("test.txt")).toBe(true);
      display.toggleFileExpanded("test.txt");
      expect(display.isFileExpanded("test.txt")).toBe(false);
      display.toggleFileExpanded("test.txt");
      expect(display.isFileExpanded("test.txt")).toBe(true);
    });
  });

  describe("renderDiff", () => {
    it("should render diff with colored lines", () => {
      display.createAndAddDiff("test.txt", "old line", "new line");

      const rendered = display.renderDiff("test.txt");

      expect(rendered).not.toBeNull();
      expect(rendered!.filePath).toBe("test.txt");
      expect(rendered!.lines.length).toBeGreaterThan(0);
      expect(rendered!.html).toContain("diff-line");
    });

    it("should include statistics", () => {
      display.createAndAddDiff("test.txt", "a\nb", "a\nc\nd");

      const rendered = display.renderDiff("test.txt");

      expect(rendered!.stats.additions).toBeGreaterThan(0);
    });

    it("should return null for non-existent file", () => {
      expect(display.renderDiff("missing.txt")).toBeNull();
    });
  });

  describe("renderAllDiffs", () => {
    it("should render all diffs", () => {
      display.createAndAddDiff("file1.txt", "a", "b");
      display.createAndAddDiff("file2.txt", "c", "d");

      const rendered = display.renderAllDiffs();

      expect(rendered).toHaveLength(2);
    });
  });

  describe("getStats", () => {
    it("should return combined statistics", () => {
      display.createAndAddDiff("file1.txt", "a", "b");
      display.createAndAddDiff("file2.txt", "c\nd", "e");

      const stats = display.getStats();

      expect(stats.files).toBe(2);
      expect(stats.additions).toBeGreaterThan(0);
      expect(stats.deletions).toBeGreaterThan(0);
    });
  });

  describe("colors", () => {
    it("should allow setting custom colors", () => {
      display.setColors({ added: "#00ff00" });

      const colors = display.getColors();
      expect(colors.added).toBe("#00ff00");
    });

    it("should throw if disposed", () => {
      display.dispose();
      expect(() => display.setColors({ added: "#00ff00" })).toThrow(
        "FileDiffDisplay is disposed"
      );
    });
  });

  describe("subscribe", () => {
    it("should call callback on changes", () => {
      const callback = vi.fn();
      display.subscribe(callback);

      display.createAndAddDiff("test.txt", "old", "new");

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          diffs: expect.any(Array),
        })
      );
    });

    it("should allow unsubscribing", () => {
      const callback = vi.fn();
      const unsubscribe = display.subscribe(callback);

      display.createAndAddDiff("file1.txt", "a", "b");
      unsubscribe();
      display.createAndAddDiff("file2.txt", "c", "d");

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should throw if disposed", () => {
      display.dispose();
      expect(() => display.subscribe(() => {})).toThrow(
        "FileDiffDisplay is disposed"
      );
    });

    it("should handle callback errors gracefully", () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const errorCallback = vi.fn(() => {
        throw new Error("Callback error");
      });

      display.subscribe(errorCallback);

      expect(() =>
        display.createAndAddDiff("test.txt", "old", "new")
      ).not.toThrow();

      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe("dispose", () => {
    it("should mark as disposed", () => {
      expect(display.isDisposed()).toBe(false);
      display.dispose();
      expect(display.isDisposed()).toBe(true);
    });

    it("should be idempotent", () => {
      display.dispose();
      expect(() => display.dispose()).not.toThrow();
    });

    it("should clear all data", () => {
      display.createAndAddDiff("test.txt", "old", "new");
      display.dispose();

      expect(display.getAllDiffs()).toHaveLength(0);
    });
  });
});

describe("constants", () => {
  it("should have line prefixes for all types", () => {
    expect(LINE_PREFIXES.added).toBe("+");
    expect(LINE_PREFIXES.removed).toBe("-");
    expect(LINE_PREFIXES.unchanged).toBe(" ");
    expect(LINE_PREFIXES.context).toBe(" ");
  });

  it("should have CSS classes for all types", () => {
    expect(CSS_CLASSES.added).toBe("diff-line-added");
    expect(CSS_CLASSES.removed).toBe("diff-line-removed");
    expect(CSS_CLASSES.unchanged).toBe("diff-line-unchanged");
  });

  it("should have default colors", () => {
    expect(DEFAULT_COLORS.added).toBeDefined();
    expect(DEFAULT_COLORS.removed).toBeDefined();
    expect(DEFAULT_COLORS.unchanged).toBeDefined();
  });

  it("should have light theme colors", () => {
    expect(LIGHT_COLORS.added).toBeDefined();
    expect(LIGHT_COLORS.removed).toBeDefined();
  });
});

describe("verification tests", () => {
  it("should show added lines with green color coding", () => {
    const display = createFileDiffDisplay();
    display.createAndAddDiff("test.txt", "", "new line");

    const rendered = display.renderDiff("test.txt");
    const addedLine = rendered!.lines.find((l) => l.type === "added");

    expect(addedLine).toBeDefined();
    expect(addedLine!.styles.color).toBe(DEFAULT_COLORS.added);
    expect(addedLine!.classes).toContain("diff-line-added");
    expect(addedLine!.text).toContain("+");

    display.dispose();
  });

  it("should show removed lines with red color coding", () => {
    const display = createFileDiffDisplay();
    display.createAndAddDiff("test.txt", "old line", "");

    const rendered = display.renderDiff("test.txt");
    const removedLine = rendered!.lines.find((l) => l.type === "removed");

    expect(removedLine).toBeDefined();
    expect(removedLine!.styles.color).toBe(DEFAULT_COLORS.removed);
    expect(removedLine!.classes).toContain("diff-line-removed");
    expect(removedLine!.text).toContain("-");

    display.dispose();
  });

  it("should render diff blocks with color coding for added/removed lines", () => {
    const display = createFileDiffDisplay();
    display.createAndAddDiff(
      "example.js",
      "const x = 1;\nconst y = 2;",
      "const x = 1;\nconst z = 3;"
    );

    const rendered = display.renderDiff("example.js");

    // Check HTML contains color-coded diff classes
    expect(rendered!.html).toContain("diff-line-added");
    expect(rendered!.html).toContain("diff-line-removed");
    expect(rendered!.html).toContain(DEFAULT_COLORS.added);
    expect(rendered!.html).toContain(DEFAULT_COLORS.removed);

    // Check lines have correct types
    const addedLines = rendered!.lines.filter((l) => l.type === "added");
    const removedLines = rendered!.lines.filter((l) => l.type === "removed");

    expect(addedLines.length).toBeGreaterThan(0);
    expect(removedLines.length).toBeGreaterThan(0);

    display.dispose();
  });
});
