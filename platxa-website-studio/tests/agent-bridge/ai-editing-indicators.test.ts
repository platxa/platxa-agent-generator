import { describe, it, expect } from "vitest";
import {
  DEFAULT_CLASSES,
  PULSE_KEYFRAMES,
  COMPLETE_KEYFRAMES,
  ERROR_KEYFRAMES,
  generateIndicatorCSS,
  createIndicatorManager,
  markEditing,
  markCompleted,
  markError,
  markIdle,
  removeIndicator,
  resetAll,
  clearAll,
  getIndicator,
  getIndicatorClass,
  getEditingSections,
  getCompletedSections,
  getErrorSections,
  getIndicatorSummary,
  // Line-level indicators
  LINE_INDICATOR_CLASSES,
  LINE_PULSE_KEYFRAMES,
  LINE_COMPLETE_KEYFRAMES,
  LINE_ERROR_KEYFRAMES,
  generateLineIndicatorCSS,
  createLineIndicatorManager,
  markLinesEditing,
  markLineRangeEditing,
  markLinesCompleted,
  markLinesError,
  clearFileLineIndicators,
  clearLineIndicators,
  clearAllLineIndicators,
  getMonacoDecorations,
  getEditingLines,
  getLineIndicatorSummary,
} from "@/lib/agent-bridge/ai-editing-indicators";

describe("AI Editing Indicators", () => {
  describe("constants", () => {
    it("has default CSS classes", () => {
      expect(DEFAULT_CLASSES.editing).toBe("ai-indicator--editing");
      expect(DEFAULT_CLASSES.completed).toBe("ai-indicator--completed");
      expect(DEFAULT_CLASSES.error).toBe("ai-indicator--error");
      expect(DEFAULT_CLASSES.idle).toBe("ai-indicator--idle");
    });

    it("has pulse keyframes for editing state", () => {
      expect(PULSE_KEYFRAMES.name).toBe("ai-pulse");
      expect(PULSE_KEYFRAMES.css).toContain("@keyframes ai-pulse");
      expect(PULSE_KEYFRAMES.css).toContain("box-shadow");
    });

    it("has green flash keyframes for completed state", () => {
      expect(COMPLETE_KEYFRAMES.name).toBe("ai-complete-flash");
      expect(COMPLETE_KEYFRAMES.css).toContain("rgba(34, 197, 94");
    });

    it("has error keyframes", () => {
      expect(ERROR_KEYFRAMES.name).toBe("ai-error-flash");
      expect(ERROR_KEYFRAMES.css).toContain("rgba(239, 68, 68");
    });
  });

  describe("generateIndicatorCSS", () => {
    it("generates CSS with all keyframes and classes", () => {
      const css = generateIndicatorCSS();
      expect(css).toContain("@keyframes ai-pulse");
      expect(css).toContain("@keyframes ai-complete-flash");
      expect(css).toContain("@keyframes ai-error-flash");
      expect(css).toContain(".ai-indicator--editing");
      expect(css).toContain(".ai-indicator--completed");
      expect(css).toContain("animation:");
    });

    it("uses custom classes", () => {
      const css = generateIndicatorCSS({
        idle: "custom-idle",
        editing: "custom-edit",
        completed: "custom-done",
        error: "custom-err",
      });
      expect(css).toContain(".custom-edit");
      expect(css).toContain(".custom-done");
    });
  });

  describe("createIndicatorManager", () => {
    it("creates empty manager", () => {
      const mgr = createIndicatorManager();
      expect(mgr.sections.size).toBe(0);
      expect(mgr.classes).toEqual(DEFAULT_CLASSES);
    });
  });

  describe("state transitions", () => {
    it("markEditing sets section to editing with pulse", () => {
      let mgr = createIndicatorManager();
      mgr = markEditing(mgr, "s_hero", "Updating hero section");
      const ind = getIndicator(mgr, "s_hero");
      expect(ind).not.toBeNull();
      expect(ind!.state).toBe("editing");
      expect(ind!.message).toBe("Updating hero section");
    });

    it("markCompleted sets section to completed (green flash)", () => {
      let mgr = createIndicatorManager();
      mgr = markEditing(mgr, "s_hero");
      mgr = markCompleted(mgr, "s_hero", "Done");
      expect(getIndicator(mgr, "s_hero")!.state).toBe("completed");
    });

    it("markError sets section to error", () => {
      let mgr = createIndicatorManager();
      mgr = markError(mgr, "s_hero", "Generation failed");
      expect(getIndicator(mgr, "s_hero")!.state).toBe("error");
      expect(getIndicator(mgr, "s_hero")!.message).toBe("Generation failed");
    });

    it("markIdle resets to idle", () => {
      let mgr = createIndicatorManager();
      mgr = markEditing(mgr, "s_hero");
      mgr = markIdle(mgr, "s_hero");
      expect(getIndicator(mgr, "s_hero")!.state).toBe("idle");
    });

    it("removeIndicator removes tracking", () => {
      let mgr = createIndicatorManager();
      mgr = markEditing(mgr, "s_hero");
      mgr = removeIndicator(mgr, "s_hero");
      expect(getIndicator(mgr, "s_hero")).toBeNull();
    });

    it("resetAll sets all to idle", () => {
      let mgr = createIndicatorManager();
      mgr = markEditing(mgr, "s_hero");
      mgr = markCompleted(mgr, "s_features");
      mgr = markError(mgr, "s_cta");
      mgr = resetAll(mgr);
      expect(getIndicator(mgr, "s_hero")!.state).toBe("idle");
      expect(getIndicator(mgr, "s_features")!.state).toBe("idle");
      expect(getIndicator(mgr, "s_cta")!.state).toBe("idle");
    });

    it("clearAll removes all sections", () => {
      let mgr = createIndicatorManager();
      mgr = markEditing(mgr, "s_hero");
      mgr = markEditing(mgr, "s_features");
      mgr = clearAll(mgr);
      expect(mgr.sections.size).toBe(0);
    });
  });

  describe("queries", () => {
    it("getIndicatorClass returns editing class", () => {
      let mgr = createIndicatorManager();
      mgr = markEditing(mgr, "s_hero");
      expect(getIndicatorClass(mgr, "s_hero")).toBe("ai-indicator--editing");
    });

    it("getIndicatorClass returns idle for unknown section", () => {
      const mgr = createIndicatorManager();
      expect(getIndicatorClass(mgr, "s_unknown")).toBe("ai-indicator--idle");
    });

    it("getEditingSections returns only editing", () => {
      let mgr = createIndicatorManager();
      mgr = markEditing(mgr, "s_hero");
      mgr = markCompleted(mgr, "s_features");
      mgr = markEditing(mgr, "s_cta");
      const editing = getEditingSections(mgr);
      expect(editing).toHaveLength(2);
      expect(editing.map((s) => s.sectionId).sort()).toEqual(["s_cta", "s_hero"]);
    });

    it("getCompletedSections returns only completed", () => {
      let mgr = createIndicatorManager();
      mgr = markEditing(mgr, "s_hero");
      mgr = markCompleted(mgr, "s_features");
      expect(getCompletedSections(mgr)).toHaveLength(1);
      expect(getCompletedSections(mgr)[0].sectionId).toBe("s_features");
    });

    it("getErrorSections returns only errors", () => {
      let mgr = createIndicatorManager();
      mgr = markError(mgr, "s_hero");
      mgr = markCompleted(mgr, "s_features");
      expect(getErrorSections(mgr)).toHaveLength(1);
    });

    it("getIndicatorSummary returns all with classNames", () => {
      let mgr = createIndicatorManager();
      mgr = markEditing(mgr, "s_hero", "Working...");
      mgr = markCompleted(mgr, "s_features");
      const summary = getIndicatorSummary(mgr);
      expect(summary).toHaveLength(2);
      const hero = summary.find((s) => s.sectionId === "s_hero")!;
      expect(hero.state).toBe("editing");
      expect(hero.className).toBe("ai-indicator--editing");
      expect(hero.message).toBe("Working...");
      const feat = summary.find((s) => s.sectionId === "s_features")!;
      expect(feat.state).toBe("completed");
      expect(feat.className).toBe("ai-indicator--completed");
    });
  });

  describe("immutability", () => {
    it("does not mutate original state", () => {
      const mgr = createIndicatorManager();
      const updated = markEditing(mgr, "s_hero");
      expect(mgr.sections.size).toBe(0);
      expect(updated.sections.size).toBe(1);
    });
  });
});

// =============================================================================
// Line-Level Indicators (Monaco Editor Integration)
// =============================================================================

describe("Line-Level AI Editing Indicators", () => {
  describe("constants", () => {
    it("has line indicator CSS classes", () => {
      expect(LINE_INDICATOR_CLASSES.editing).toBe("ai-line-editing");
      expect(LINE_INDICATOR_CLASSES.completed).toBe("ai-line-completed");
      expect(LINE_INDICATOR_CLASSES.error).toBe("ai-line-error");
      expect(LINE_INDICATOR_CLASSES.glyph).toBe("ai-line-glyph");
    });

    it("has line pulse keyframes for editing state", () => {
      expect(LINE_PULSE_KEYFRAMES.name).toBe("ai-line-pulse");
      expect(LINE_PULSE_KEYFRAMES.css).toContain("@keyframes ai-line-pulse");
      expect(LINE_PULSE_KEYFRAMES.css).toContain("background-color");
      expect(LINE_PULSE_KEYFRAMES.css).toContain("rgba(59, 130, 246");
    });

    it("has line complete keyframes for completed state", () => {
      expect(LINE_COMPLETE_KEYFRAMES.name).toBe("ai-line-complete");
      expect(LINE_COMPLETE_KEYFRAMES.css).toContain("rgba(34, 197, 94");
    });

    it("has line error keyframes for error state", () => {
      expect(LINE_ERROR_KEYFRAMES.name).toBe("ai-line-error");
      expect(LINE_ERROR_KEYFRAMES.css).toContain("rgba(239, 68, 68");
    });
  });

  describe("generateLineIndicatorCSS", () => {
    it("generates CSS with all line keyframes and classes", () => {
      const css = generateLineIndicatorCSS();
      expect(css).toContain("@keyframes ai-line-pulse");
      expect(css).toContain("@keyframes ai-line-complete");
      expect(css).toContain("@keyframes ai-line-error");
      expect(css).toContain(".ai-line-editing");
      expect(css).toContain(".ai-line-completed");
      expect(css).toContain(".ai-line-error");
      expect(css).toContain(".ai-line-glyph");
      expect(css).toContain("animation:");
    });

    it("includes glyph margin styling", () => {
      const css = generateLineIndicatorCSS();
      expect(css).toContain("width: 4px");
      expect(css).toContain("border-radius: 2px");
    });
  });

  describe("createLineIndicatorManager", () => {
    it("creates empty line indicator manager", () => {
      const mgr = createLineIndicatorManager();
      expect(mgr.lines.size).toBe(0);
    });
  });

  describe("markLinesEditing", () => {
    it("marks single line as editing", () => {
      let mgr = createLineIndicatorManager();
      mgr = markLinesEditing(mgr, "/src/App.tsx", [10]);

      const fileLines = mgr.lines.get("/src/App.tsx");
      expect(fileLines).toBeDefined();
      expect(fileLines!.size).toBe(1);
      expect(fileLines!.get(10)?.state).toBe("editing");
    });

    it("marks multiple lines as editing", () => {
      let mgr = createLineIndicatorManager();
      mgr = markLinesEditing(mgr, "/src/App.tsx", [10, 11, 12], "Updating component");

      const fileLines = mgr.lines.get("/src/App.tsx");
      expect(fileLines!.size).toBe(3);
      expect(fileLines!.get(10)?.message).toBe("Updating component");
      expect(fileLines!.get(11)?.message).toBe("Updating component");
      expect(fileLines!.get(12)?.message).toBe("Updating component");
    });

    it("tracks lines per file separately", () => {
      let mgr = createLineIndicatorManager();
      mgr = markLinesEditing(mgr, "/src/App.tsx", [10, 11]);
      mgr = markLinesEditing(mgr, "/src/Button.tsx", [5, 6, 7]);

      expect(mgr.lines.size).toBe(2);
      expect(mgr.lines.get("/src/App.tsx")!.size).toBe(2);
      expect(mgr.lines.get("/src/Button.tsx")!.size).toBe(3);
    });
  });

  describe("markLineRangeEditing", () => {
    it("marks a range of lines as editing", () => {
      let mgr = createLineIndicatorManager();
      mgr = markLineRangeEditing(mgr, "/src/App.tsx", { startLine: 10, endLine: 15 });

      const fileLines = mgr.lines.get("/src/App.tsx");
      expect(fileLines!.size).toBe(6);
      for (let i = 10; i <= 15; i++) {
        expect(fileLines!.get(i)?.state).toBe("editing");
      }
    });

    it("includes message on all lines in range", () => {
      let mgr = createLineIndicatorManager();
      mgr = markLineRangeEditing(mgr, "/src/App.tsx", { startLine: 5, endLine: 7 }, "Refactoring");

      const fileLines = mgr.lines.get("/src/App.tsx");
      expect(fileLines!.get(5)?.message).toBe("Refactoring");
      expect(fileLines!.get(6)?.message).toBe("Refactoring");
      expect(fileLines!.get(7)?.message).toBe("Refactoring");
    });
  });

  describe("markLinesCompleted", () => {
    it("marks lines as completed (green flash)", () => {
      let mgr = createLineIndicatorManager();
      mgr = markLinesEditing(mgr, "/src/App.tsx", [10, 11, 12]);
      mgr = markLinesCompleted(mgr, "/src/App.tsx", [10, 11], "Done");

      const fileLines = mgr.lines.get("/src/App.tsx");
      expect(fileLines!.get(10)?.state).toBe("completed");
      expect(fileLines!.get(11)?.state).toBe("completed");
      expect(fileLines!.get(12)?.state).toBe("editing");
    });
  });

  describe("markLinesError", () => {
    it("marks lines as error (red flash)", () => {
      let mgr = createLineIndicatorManager();
      mgr = markLinesEditing(mgr, "/src/App.tsx", [10, 11]);
      mgr = markLinesError(mgr, "/src/App.tsx", [10], "Syntax error");

      const fileLines = mgr.lines.get("/src/App.tsx");
      expect(fileLines!.get(10)?.state).toBe("error");
      expect(fileLines!.get(10)?.message).toBe("Syntax error");
      expect(fileLines!.get(11)?.state).toBe("editing");
    });
  });

  describe("clearFileLineIndicators", () => {
    it("clears all indicators for a file", () => {
      let mgr = createLineIndicatorManager();
      mgr = markLinesEditing(mgr, "/src/App.tsx", [10, 11, 12]);
      mgr = markLinesEditing(mgr, "/src/Button.tsx", [5, 6]);
      mgr = clearFileLineIndicators(mgr, "/src/App.tsx");

      expect(mgr.lines.has("/src/App.tsx")).toBe(false);
      expect(mgr.lines.has("/src/Button.tsx")).toBe(true);
      expect(mgr.lines.get("/src/Button.tsx")!.size).toBe(2);
    });
  });

  describe("clearLineIndicators", () => {
    it("clears specific lines from a file", () => {
      let mgr = createLineIndicatorManager();
      mgr = markLinesEditing(mgr, "/src/App.tsx", [10, 11, 12, 13]);
      mgr = clearLineIndicators(mgr, "/src/App.tsx", [11, 12]);

      const fileLines = mgr.lines.get("/src/App.tsx");
      expect(fileLines!.size).toBe(2);
      expect(fileLines!.has(10)).toBe(true);
      expect(fileLines!.has(11)).toBe(false);
      expect(fileLines!.has(12)).toBe(false);
      expect(fileLines!.has(13)).toBe(true);
    });

    it("removes file entry when all lines cleared", () => {
      let mgr = createLineIndicatorManager();
      mgr = markLinesEditing(mgr, "/src/App.tsx", [10, 11]);
      mgr = clearLineIndicators(mgr, "/src/App.tsx", [10, 11]);

      expect(mgr.lines.has("/src/App.tsx")).toBe(false);
    });
  });

  describe("clearAllLineIndicators", () => {
    it("clears all line indicators across all files", () => {
      let mgr = createLineIndicatorManager();
      mgr = markLinesEditing(mgr, "/src/App.tsx", [10, 11]);
      mgr = markLinesEditing(mgr, "/src/Button.tsx", [5, 6]);
      mgr = markLinesCompleted(mgr, "/src/Card.tsx", [1, 2, 3]);
      mgr = clearAllLineIndicators(mgr);

      expect(mgr.lines.size).toBe(0);
    });
  });

  describe("getMonacoDecorations", () => {
    it("generates Monaco decorations for editing lines", () => {
      let mgr = createLineIndicatorManager();
      mgr = markLinesEditing(mgr, "/src/App.tsx", [10, 11]);

      const decorations = getMonacoDecorations(mgr, "/src/App.tsx");
      expect(decorations).toHaveLength(2);

      const dec = decorations[0];
      expect(dec.range.startLineNumber).toBe(10);
      expect(dec.range.endLineNumber).toBe(10);
      expect(dec.range.startColumn).toBe(1);
      expect(dec.range.endColumn).toBe(1);
      expect(dec.options.isWholeLine).toBe(true);
      expect(dec.options.className).toBe("ai-line-editing");
      expect(dec.options.glyphMarginClassName).toBe("ai-line-glyph");
    });

    it("generates decorations with correct classes for each state", () => {
      let mgr = createLineIndicatorManager();
      mgr = markLinesEditing(mgr, "/src/App.tsx", [10]);
      mgr = markLinesCompleted(mgr, "/src/App.tsx", [11]);
      mgr = markLinesError(mgr, "/src/App.tsx", [12]);

      const decorations = getMonacoDecorations(mgr, "/src/App.tsx");

      const editingDec = decorations.find(d => d.range.startLineNumber === 10);
      expect(editingDec?.options.className).toBe("ai-line-editing");
      expect(editingDec?.options.glyphMarginClassName).toBe("ai-line-glyph");

      const completedDec = decorations.find(d => d.range.startLineNumber === 11);
      expect(completedDec?.options.className).toBe("ai-line-completed");
      expect(completedDec?.options.glyphMarginClassName).toBe("ai-line-glyph completed");

      const errorDec = decorations.find(d => d.range.startLineNumber === 12);
      expect(errorDec?.options.className).toBe("ai-line-error");
      expect(errorDec?.options.glyphMarginClassName).toBe("ai-line-glyph error");
    });

    it("returns empty array for unknown file", () => {
      const mgr = createLineIndicatorManager();
      const decorations = getMonacoDecorations(mgr, "/unknown/file.tsx");
      expect(decorations).toHaveLength(0);
    });
  });

  describe("getEditingLines", () => {
    it("returns only editing line numbers", () => {
      let mgr = createLineIndicatorManager();
      mgr = markLinesEditing(mgr, "/src/App.tsx", [10, 11, 12]);
      mgr = markLinesCompleted(mgr, "/src/App.tsx", [11]);
      mgr = markLinesError(mgr, "/src/App.tsx", [12]);

      const editing = getEditingLines(mgr, "/src/App.tsx");
      expect(editing).toHaveLength(1);
      expect(editing).toContain(10);
    });

    it("returns empty array for unknown file", () => {
      const mgr = createLineIndicatorManager();
      expect(getEditingLines(mgr, "/unknown/file.tsx")).toHaveLength(0);
    });
  });

  describe("getLineIndicatorSummary", () => {
    it("returns all line indicators for a file", () => {
      let mgr = createLineIndicatorManager();
      mgr = markLinesEditing(mgr, "/src/App.tsx", [10], "Editing");
      mgr = markLinesCompleted(mgr, "/src/App.tsx", [11], "Done");
      mgr = markLinesError(mgr, "/src/App.tsx", [12], "Failed");

      const summary = getLineIndicatorSummary(mgr, "/src/App.tsx");
      expect(summary).toHaveLength(3);

      const editing = summary.find(s => s.lineNumber === 10);
      expect(editing?.state).toBe("editing");
      expect(editing?.message).toBe("Editing");

      const completed = summary.find(s => s.lineNumber === 11);
      expect(completed?.state).toBe("completed");

      const error = summary.find(s => s.lineNumber === 12);
      expect(error?.state).toBe("error");
      expect(error?.message).toBe("Failed");
    });

    it("returns empty array for unknown file", () => {
      const mgr = createLineIndicatorManager();
      expect(getLineIndicatorSummary(mgr, "/unknown/file.tsx")).toHaveLength(0);
    });
  });

  describe("immutability", () => {
    it("does not mutate original line indicator state", () => {
      const mgr = createLineIndicatorManager();
      const updated = markLinesEditing(mgr, "/src/App.tsx", [10, 11]);
      expect(mgr.lines.size).toBe(0);
      expect(updated.lines.size).toBe(1);
    });

    it("does not mutate when clearing lines", () => {
      let mgr = createLineIndicatorManager();
      mgr = markLinesEditing(mgr, "/src/App.tsx", [10, 11, 12]);
      const original = mgr;
      const cleared = clearLineIndicators(mgr, "/src/App.tsx", [11]);

      expect(original.lines.get("/src/App.tsx")!.size).toBe(3);
      expect(cleared.lines.get("/src/App.tsx")!.size).toBe(2);
    });
  });
});
