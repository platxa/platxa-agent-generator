// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ErrorSourceNavigator,
  createSourceNavigator,
  createSourceNavigatorWithEditor,
  createMockEditorAdapter,
  parseLocationString,
  formatLocationString,
  createSourceLocation,
  isValidLocation,
  isSameLocation,
  createNavigatorState,
  type SourceLocation,
  type EditorAdapter,
  type NavigationResult,
} from "@/lib/preview/error-source-navigator";

describe("ErrorSourceNavigator", () => {
  describe("click error → opens file in editor (Feature #158)", () => {
    it("opens file when navigating to location", async () => {
      // Feature #158: Click error → opens file in editor
      const editor = createMockEditorAdapter();
      const openFileSpy = vi.spyOn(editor, "openFile");
      const navigator = createSourceNavigatorWithEditor(editor);

      await navigator.navigateTo({
        filePath: "/app/test.ts",
        line: 10,
      });

      expect(openFileSpy).toHaveBeenCalledWith("/app/test.ts");
    });

    it("navigates to specific line", async () => {
      // Feature #158: Opens file in editor
      const editor = createMockEditorAdapter();
      const goToLineSpy = vi.spyOn(editor, "goToLine");
      const navigator = createSourceNavigatorWithEditor(editor);

      await navigator.navigateTo({
        filePath: "/app/test.ts",
        line: 42,
        column: 5,
      });

      expect(goToLineSpy).toHaveBeenCalledWith(42, 5);
    });

    it("returns success when navigation completes", async () => {
      // Feature #158: Successful navigation
      const editor = createMockEditorAdapter();
      const navigator = createSourceNavigatorWithEditor(editor);

      const result = await navigator.navigateTo({
        filePath: "/app/test.ts",
        line: 10,
      });

      expect(result.success).toBe(true);
      expect(result.location.filePath).toBe("/app/test.ts");
      expect(result.location.line).toBe(10);
    });
  });

  describe("highlights error line (Feature #158)", () => {
    it("highlights the error line after navigation", async () => {
      // Feature #158: Highlights error line
      const editor = createMockEditorAdapter();
      const highlightSpy = vi.spyOn(editor, "highlightLine");
      const navigator = createSourceNavigatorWithEditor(editor);

      const result = await navigator.navigateTo({
        filePath: "/app/test.ts",
        line: 15,
      });

      expect(highlightSpy).toHaveBeenCalledWith(15, undefined);
      expect(result.highlighted).toBe(true);
    });

    it("highlights line range when endLine provided", async () => {
      // Feature #158: Highlights error line range
      const editor = createMockEditorAdapter();
      const highlightSpy = vi.spyOn(editor, "highlightLine");
      const navigator = createSourceNavigatorWithEditor(editor);

      await navigator.navigateTo({
        filePath: "/app/test.ts",
        line: 10,
        endLine: 15,
      });

      expect(highlightSpy).toHaveBeenCalledWith(10, 15);
    });

    it("highlights precise range with columns", async () => {
      // Feature #158: Highlights error line with column precision
      const editor = createMockEditorAdapter();
      const highlightRangeSpy = vi.spyOn(editor, "highlightRange");
      const navigator = createSourceNavigatorWithEditor(editor);

      await navigator.navigateTo({
        filePath: "/app/test.ts",
        line: 10,
        column: 5,
        endLine: 10,
        endColumn: 20,
      });

      expect(highlightRangeSpy).toHaveBeenCalledWith(10, 5, 10, 20);
    });

    it("scrolls to make line visible", async () => {
      // Feature #158: Scrolls to error line
      const editor = createMockEditorAdapter();
      const scrollSpy = vi.spyOn(editor, "scrollToLine");
      const navigator = createSourceNavigatorWithEditor(editor);

      await navigator.navigateTo({
        filePath: "/app/test.ts",
        line: 100,
      });

      expect(scrollSpy).toHaveBeenCalledWith(100);
    });

    it("clears highlight after duration", async () => {
      vi.useFakeTimers();
      const editor = createMockEditorAdapter();
      const clearSpy = vi.spyOn(editor, "clearHighlights");
      const navigator = createSourceNavigatorWithEditor(editor, {
        highlightDuration: 1000,
      });

      await navigator.navigateTo({
        filePath: "/app/test.ts",
        line: 10,
      });

      expect(clearSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);

      expect(clearSpy).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe("parseLocationString", () => {
    it("parses file:line:column format", () => {
      const location = parseLocationString("/app/test.ts:42:10");

      expect(location).toEqual({
        filePath: "/app/test.ts",
        line: 42,
        column: 10,
      });
    });

    it("parses file:line format", () => {
      const location = parseLocationString("/app/test.ts:42");

      expect(location).toEqual({
        filePath: "/app/test.ts",
        line: 42,
        column: undefined,
      });
    });

    it("parses file only format", () => {
      const location = parseLocationString("/app/test.ts");

      expect(location).toEqual({
        filePath: "/app/test.ts",
        line: 1,
        column: undefined,
      });
    });

    it("handles Windows paths", () => {
      const location = parseLocationString("C:\\app\\test.ts:10");

      expect(location?.filePath).toBe("C:\\app\\test.ts");
      expect(location?.line).toBe(10);
    });

    it("returns null for empty string", () => {
      expect(parseLocationString("")).toBeNull();
    });
  });

  describe("formatLocationString", () => {
    it("formats full location", () => {
      const str = formatLocationString({
        filePath: "/app/test.ts",
        line: 42,
        column: 10,
      });

      expect(str).toBe("/app/test.ts:42:10");
    });

    it("formats without column", () => {
      const str = formatLocationString({
        filePath: "/app/test.ts",
        line: 42,
      });

      expect(str).toBe("/app/test.ts:42");
    });
  });

  describe("createSourceLocation", () => {
    it("creates location with all fields", () => {
      const location = createSourceLocation("/app/test.ts", 10, 5, 15, 20);

      expect(location).toEqual({
        filePath: "/app/test.ts",
        line: 10,
        column: 5,
        endLine: 15,
        endColumn: 20,
      });
    });

    it("creates location with minimal fields", () => {
      const location = createSourceLocation("/app/test.ts", 10);

      expect(location.filePath).toBe("/app/test.ts");
      expect(location.line).toBe(10);
      expect(location.column).toBeUndefined();
    });
  });

  describe("isValidLocation", () => {
    it("returns true for valid location", () => {
      expect(isValidLocation({ filePath: "/app/test.ts", line: 1 })).toBe(true);
      expect(isValidLocation({ filePath: "file.ts", line: 100, column: 50 })).toBe(true);
    });

    it("returns false for empty filePath", () => {
      expect(isValidLocation({ filePath: "", line: 1 })).toBe(false);
    });

    it("returns false for invalid line", () => {
      expect(isValidLocation({ filePath: "/app/test.ts", line: 0 })).toBe(false);
      expect(isValidLocation({ filePath: "/app/test.ts", line: -1 })).toBe(false);
    });

    it("returns false for invalid column", () => {
      expect(isValidLocation({ filePath: "/app/test.ts", line: 1, column: 0 })).toBe(false);
    });

    it("returns false for invalid endLine", () => {
      expect(isValidLocation({ filePath: "/app/test.ts", line: 10, endLine: 5 })).toBe(false);
    });
  });

  describe("isSameLocation", () => {
    it("returns true for same location", () => {
      const a = { filePath: "/app/test.ts", line: 10, column: 5 };
      const b = { filePath: "/app/test.ts", line: 10, column: 5 };

      expect(isSameLocation(a, b)).toBe(true);
    });

    it("returns false for different file", () => {
      const a = { filePath: "/app/test.ts", line: 10 };
      const b = { filePath: "/app/other.ts", line: 10 };

      expect(isSameLocation(a, b)).toBe(false);
    });

    it("returns false for different line", () => {
      const a = { filePath: "/app/test.ts", line: 10 };
      const b = { filePath: "/app/test.ts", line: 20 };

      expect(isSameLocation(a, b)).toBe(false);
    });
  });

  describe("ErrorSourceNavigator class", () => {
    let navigator: ErrorSourceNavigator;
    let editor: EditorAdapter;

    beforeEach(() => {
      editor = createMockEditorAdapter();
      navigator = createSourceNavigator();
      navigator.setEditor(editor);
    });

    it("fails when no editor configured", async () => {
      const nav = createSourceNavigator();

      const result = await nav.navigateTo({
        filePath: "/app/test.ts",
        line: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("No editor configured");
    });

    it("fails when editor not ready", async () => {
      const notReadyEditor = createMockEditorAdapter({ isReady: false });
      navigator.setEditor(notReadyEditor);

      const result = await navigator.navigateTo({
        filePath: "/app/test.ts",
        line: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not ready");
    });

    it("fails for invalid location", async () => {
      const result = await navigator.navigateTo({
        filePath: "",
        line: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid");
    });

    it("fails when file cannot be opened", async () => {
      const failEditor = createMockEditorAdapter({ failOpen: true });
      navigator.setEditor(failEditor);

      const result = await navigator.navigateTo({
        filePath: "/app/test.ts",
        line: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to open");
    });

    it("fails when goToLine fails", async () => {
      const failEditor = createMockEditorAdapter({ failGoTo: true });
      navigator.setEditor(failEditor);

      const result = await navigator.navigateTo({
        filePath: "/app/test.ts",
        line: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to navigate");
    });

    it("navigateToString parses and navigates", async () => {
      const result = await navigator.navigateToString("/app/test.ts:42:10");

      expect(result.success).toBe(true);
      expect(result.location.filePath).toBe("/app/test.ts");
      expect(result.location.line).toBe(42);
      expect(result.location.column).toBe(10);
    });

    it("navigateToString fails for invalid string", async () => {
      const result = await navigator.navigateToString("");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid location string");
    });

    it("navigateToPosition creates location and navigates", async () => {
      const result = await navigator.navigateToPosition("/app/test.ts", 42, 10);

      expect(result.success).toBe(true);
      expect(result.location.line).toBe(42);
    });

    it("skips openFile if same file", async () => {
      const sameFileEditor = createMockEditorAdapter({ currentFile: "/app/test.ts" });
      const openSpy = vi.spyOn(sameFileEditor, "openFile");
      navigator.setEditor(sameFileEditor);

      await navigator.navigateTo({
        filePath: "/app/test.ts",
        line: 10,
      });

      expect(openSpy).not.toHaveBeenCalled();
    });

    it("records navigation history", async () => {
      await navigator.navigateTo({ filePath: "/app/a.ts", line: 1 });
      await navigator.navigateTo({ filePath: "/app/b.ts", line: 2 });

      const history = navigator.getHistory();

      expect(history.length).toBe(2);
      expect(history[0].location.filePath).toBe("/app/a.ts");
      expect(history[1].location.filePath).toBe("/app/b.ts");
    });

    it("getLastNavigation returns most recent", async () => {
      await navigator.navigateTo({ filePath: "/app/a.ts", line: 1 });
      await navigator.navigateTo({ filePath: "/app/b.ts", line: 2 });

      const last = navigator.getLastNavigation();

      expect(last?.location.filePath).toBe("/app/b.ts");
    });

    it("clearHistory removes all history", async () => {
      await navigator.navigateTo({ filePath: "/app/a.ts", line: 1 });
      navigator.clearHistory();

      expect(navigator.getHistory().length).toBe(0);
    });

    it("clearHighlight clears editor highlights", () => {
      const clearSpy = vi.spyOn(editor, "clearHighlights");

      navigator.clearHighlight();

      expect(clearSpy).toHaveBeenCalled();
    });

    it("calls navigation callbacks", async () => {
      const callback = vi.fn();
      navigator.onNavigate(callback);

      await navigator.navigateTo({ filePath: "/app/test.ts", line: 10 });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          location: expect.objectContaining({ filePath: "/app/test.ts" }),
        })
      );
    });

    it("handles callback errors gracefully", async () => {
      navigator.onNavigate(() => {
        throw new Error("Callback error");
      });

      // Should not throw
      await expect(
        navigator.navigateTo({ filePath: "/app/test.ts", line: 10 })
      ).resolves.toBeDefined();
    });

    it("updates and gets config", () => {
      navigator.updateConfig({ autoHighlight: false });
      const config = navigator.getConfig();

      expect(config.autoHighlight).toBe(false);
    });

    it("respects autoScroll config", async () => {
      const scrollSpy = vi.spyOn(editor, "scrollToLine");
      navigator.updateConfig({ autoScroll: false });

      await navigator.navigateTo({ filePath: "/app/test.ts", line: 10 });

      expect(scrollSpy).not.toHaveBeenCalled();
    });

    it("respects autoHighlight config", async () => {
      const highlightSpy = vi.spyOn(editor, "highlightLine");
      navigator.updateConfig({ autoHighlight: false });

      const result = await navigator.navigateTo({ filePath: "/app/test.ts", line: 10 });

      expect(highlightSpy).not.toHaveBeenCalled();
      expect(result.highlighted).toBe(false);
    });
  });

  describe("createMockEditorAdapter", () => {
    it("creates adapter with default values", () => {
      const editor = createMockEditorAdapter();

      expect(editor.type).toBe("monaco");
      expect(editor.isReady()).toBe(true);
      expect(editor.getCurrentFile()).toBeNull();
    });

    it("creates adapter with custom options", () => {
      const editor = createMockEditorAdapter({
        type: "codemirror",
        currentFile: "/app/test.ts",
        isReady: false,
      });

      expect(editor.type).toBe("codemirror");
      expect(editor.isReady()).toBe(false);
      expect(editor.getCurrentFile()).toBe("/app/test.ts");
    });

    it("openFile updates current file", () => {
      const editor = createMockEditorAdapter();

      editor.openFile("/app/new.ts");

      expect(editor.getCurrentFile()).toBe("/app/new.ts");
    });

    it("openFile returns false when failOpen is true", () => {
      const editor = createMockEditorAdapter({ failOpen: true });

      expect(editor.openFile("/app/test.ts")).toBe(false);
    });

    it("goToLine returns false when failGoTo is true", () => {
      const editor = createMockEditorAdapter({ failGoTo: true });

      expect(editor.goToLine(10)).toBe(false);
    });
  });

  describe("createNavigatorState", () => {
    it("creates state object with navigator methods", () => {
      const navigator = createSourceNavigator();
      const state = createNavigatorState(navigator);

      expect(typeof state.navigateTo).toBe("function");
      expect(typeof state.navigateToString).toBe("function");
      expect(typeof state.navigateToPosition).toBe("function");
      expect(typeof state.clearHighlight).toBe("function");
      expect(typeof state.setEditor).toBe("function");
      expect(state.navigator).toBe(navigator);
    });

    it("lastResult is null initially", () => {
      const navigator = createSourceNavigator();
      const state = createNavigatorState(navigator);

      expect(state.lastResult).toBeNull();
    });
  });

  describe("factory functions", () => {
    it("createSourceNavigator creates navigator", () => {
      const navigator = createSourceNavigator();

      expect(navigator).toBeInstanceOf(ErrorSourceNavigator);
    });

    it("createSourceNavigator accepts config", () => {
      const navigator = createSourceNavigator({ autoHighlight: false });
      const config = navigator.getConfig();

      expect(config.autoHighlight).toBe(false);
    });

    it("createSourceNavigatorWithEditor creates navigator with editor", () => {
      const editor = createMockEditorAdapter();
      const navigator = createSourceNavigatorWithEditor(editor);

      expect(navigator.getEditor()).toBe(editor);
    });
  });
});
