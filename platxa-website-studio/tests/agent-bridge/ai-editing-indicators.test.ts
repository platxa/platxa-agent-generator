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
