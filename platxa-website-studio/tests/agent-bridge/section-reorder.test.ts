import { describe, it, expect } from "vitest";
import {
  normalizeSections,
  moveSection,
  getDragFeedback,
  swapSections,
  extractQWebSections,
  reorderQWebTemplate,
} from "@/lib/agent-bridge/section-reorder";
import type { PageSection } from "@/lib/agent-bridge/section-reorder";

function makeSections(ids: string[]): PageSection[] {
  return ids.map((id, i) => ({ id, type: id.replace("s_", ""), label: id, position: i }));
}

describe("Section Reorder", () => {
  describe("normalizeSections", () => {
    it("assigns sequential positions", () => {
      const sections = makeSections(["s_hero", "s_features", "s_cta"]);
      sections[0].position = 5;
      const result = normalizeSections(sections);
      expect(result.map((s) => s.position)).toEqual([0, 1, 2]);
    });

    it("clears isDragging flags", () => {
      const sections = makeSections(["s_hero"]);
      sections[0].isDragging = true;
      const result = normalizeSections(sections);
      expect(result[0].isDragging).toBe(false);
    });
  });

  describe("moveSection", () => {
    it("moves section forward", () => {
      const sections = makeSections(["s_hero", "s_features", "s_cta"]);
      const result = moveSection(sections, 0, 2);
      expect(result.changed).toBe(true);
      expect(result.sections.map((s) => s.id)).toEqual(["s_features", "s_cta", "s_hero"]);
      expect(result.movedSectionId).toBe("s_hero");
    });

    it("moves section backward", () => {
      const sections = makeSections(["s_hero", "s_features", "s_cta"]);
      const result = moveSection(sections, 2, 0);
      expect(result.sections.map((s) => s.id)).toEqual(["s_cta", "s_hero", "s_features"]);
    });

    it("returns changed=false for same position", () => {
      const sections = makeSections(["s_hero", "s_features"]);
      const result = moveSection(sections, 1, 1);
      expect(result.changed).toBe(false);
    });

    it("returns changed=false for out of bounds", () => {
      const sections = makeSections(["s_hero"]);
      const result = moveSection(sections, 0, 5);
      expect(result.changed).toBe(false);
    });

    it("normalizes positions after move", () => {
      const sections = makeSections(["s_a", "s_b", "s_c"]);
      const result = moveSection(sections, 0, 1);
      expect(result.sections.map((s) => s.position)).toEqual([0, 1, 2]);
    });
  });

  describe("getDragFeedback", () => {
    it("returns down direction when dragging lower", () => {
      const sections = makeSections(["s_hero", "s_features", "s_cta"]);
      const feedback = getDragFeedback(sections, "s_hero", 2);
      expect(feedback.direction).toBe("down");
    });

    it("returns up direction when dragging higher", () => {
      const sections = makeSections(["s_hero", "s_features", "s_cta"]);
      const feedback = getDragFeedback(sections, "s_cta", 0);
      expect(feedback.direction).toBe("up");
    });

    it("returns none for same position", () => {
      const sections = makeSections(["s_hero", "s_features"]);
      const feedback = getDragFeedback(sections, "s_hero", 0);
      expect(feedback.direction).toBe("none");
    });

    it("returns preview order", () => {
      const sections = makeSections(["s_hero", "s_features", "s_cta"]);
      const feedback = getDragFeedback(sections, "s_hero", 2);
      expect(feedback.previewOrder).toEqual(["s_features", "s_cta", "s_hero"]);
    });

    it("handles unknown dragged ID gracefully", () => {
      const sections = makeSections(["s_hero"]);
      const feedback = getDragFeedback(sections, "s_unknown", 0);
      expect(feedback.direction).toBe("none");
    });
  });

  describe("swapSections", () => {
    it("swaps section up", () => {
      const sections = makeSections(["s_hero", "s_features", "s_cta"]);
      const result = swapSections(sections, 1, "up");
      expect(result.sections.map((s) => s.id)).toEqual(["s_features", "s_hero", "s_cta"]);
    });

    it("swaps section down", () => {
      const sections = makeSections(["s_hero", "s_features", "s_cta"]);
      const result = swapSections(sections, 1, "down");
      expect(result.sections.map((s) => s.id)).toEqual(["s_hero", "s_cta", "s_features"]);
    });

    it("returns changed=false for up at top", () => {
      const sections = makeSections(["s_hero", "s_features"]);
      const result = swapSections(sections, 0, "up");
      expect(result.changed).toBe(false);
    });

    it("returns changed=false for down at bottom", () => {
      const sections = makeSections(["s_hero", "s_features"]);
      const result = swapSections(sections, 1, "down");
      expect(result.changed).toBe(false);
    });
  });

  describe("extractQWebSections", () => {
    it("extracts data-snippet sections", () => {
      const tpl = `<section data-snippet="s_hero">content</section><section data-snippet="s_features">more</section>`;
      const refs = extractQWebSections(tpl);
      expect(refs).toHaveLength(2);
      expect(refs[0].snippetId).toBe("s_hero");
      expect(refs[1].snippetId).toBe("s_features");
    });

    it("extracts t-call sections", () => {
      const tpl = `<t t-call="website.s_hero"/><t t-call="website.s_cta"/>`;
      const refs = extractQWebSections(tpl);
      expect(refs).toHaveLength(2);
      expect(refs[0].snippetId).toBe("website.s_hero");
    });

    it("returns empty for no sections", () => {
      expect(extractQWebSections("<div>hello</div>")).toHaveLength(0);
    });
  });

  describe("reorderQWebTemplate", () => {
    it("reorders sections in template", () => {
      const tpl = `<header>H</header>\n<section data-snippet="s_hero">Hero</section>\n<section data-snippet="s_features">Feat</section>\n<footer>F</footer>`;
      const result = reorderQWebTemplate(tpl, ["s_features", "s_hero"]);
      const featIdx = result.indexOf("s_features");
      const heroIdx = result.indexOf("s_hero");
      expect(featIdx).toBeLessThan(heroIdx);
    });

    it("preserves non-section content", () => {
      const tpl = `<header>H</header>\n<section data-snippet="s_hero">Hero</section>\n<footer>F</footer>`;
      const result = reorderQWebTemplate(tpl, ["s_hero"]);
      expect(result).toContain("<header>H</header>");
      expect(result).toContain("<footer>F</footer>");
    });

    it("returns unchanged template when no sections found", () => {
      const tpl = `<div>No sections</div>`;
      expect(reorderQWebTemplate(tpl, [])).toBe(tpl);
    });

    it("preserves section content after reorder", () => {
      const tpl = `<section data-snippet="s_a"><h1>A</h1></section>\n<section data-snippet="s_b"><h2>B</h2></section>`;
      const result = reorderQWebTemplate(tpl, ["s_b", "s_a"]);
      expect(result).toContain("<h1>A</h1>");
      expect(result).toContain("<h2>B</h2>");
    });
  });
});
