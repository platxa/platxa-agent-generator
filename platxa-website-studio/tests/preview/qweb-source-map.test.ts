import { describe, it, expect } from "vitest";
import {
  annotateTemplateSource,
  buildSourceMap,
  SOURCE_MAP_CLICK_SCRIPT,
} from "@/lib/preview/qweb-source-map";

describe("QWeb Source Map", () => {
  describe("annotateTemplateSource", () => {
    it("adds data-source-line to opening tags", () => {
      const source = `<section class="s_hero">
  <div class="container">
    <h1>Hello</h1>
  </div>
</section>`;

      const { annotated, entries } = annotateTemplateSource(source, "hero.xml");

      expect(annotated).toContain('data-source-line="1"');
      expect(annotated).toContain('data-source-line="2"');
      expect(annotated).toContain('data-source-line="3"');
      expect(entries.length).toBeGreaterThanOrEqual(3);
    });

    it("includes file path in data-source-file", () => {
      const { annotated } = annotateTemplateSource(
        '<div class="test">content</div>',
        "views/page.xml",
      );
      expect(annotated).toContain('data-source-file="views/page.xml"');
    });

    it("assigns unique data-source-id to each element", () => {
      const source = `<div>
  <span>a</span>
  <span>b</span>
</div>`;
      const { annotated } = annotateTemplateSource(source, "test.xml");
      expect(annotated).toContain('data-source-id="src-0"');
      expect(annotated).toContain('data-source-id="src-1"');
      expect(annotated).toContain('data-source-id="src-2"');
    });

    it("detects snippet IDs from data-snippet attribute", () => {
      const source = '<section data-snippet="s_hero" class="pt32">';
      const { entries } = annotateTemplateSource(source, "page.xml");
      expect(entries[0].snippetId).toBe("s_hero");
    });

    it("detects snippet IDs from s_ class", () => {
      const source = '<section class="s_features pt48">';
      const { entries } = annotateTemplateSource(source, "page.xml");
      expect(entries[0].snippetId).toBe("s_features");
    });

    it("records tag names", () => {
      const source = `<section>
  <div>
    <h1>Title</h1>
  </div>
</section>`;
      const { entries } = annotateTemplateSource(source, "test.xml");
      expect(entries.map((e) => e.tagName)).toEqual(["section", "div", "h1"]);
    });

    it("preserves non-tag lines unchanged", () => {
      const source = `<!-- comment -->
some text
<div>content</div>`;
      const { annotated } = annotateTemplateSource(source, "test.xml");
      expect(annotated).toContain("<!-- comment -->");
      expect(annotated).toContain("some text");
    });
  });

  describe("buildSourceMap", () => {
    it("provides DOM→source lookup", () => {
      const { entries } = annotateTemplateSource(
        '<section class="s_hero">\n  <h1>Title</h1>\n</section>',
        "hero.xml",
      );
      const map = buildSourceMap(entries);

      const source = map.findSource('[data-source-id="src-0"]');
      expect(source).toBeDefined();
      expect(source!.file).toBe("hero.xml");
      expect(source!.line).toBe(1);
      expect(source!.tagName).toBe("section");
    });

    it("provides source→DOM lookup", () => {
      const { entries } = annotateTemplateSource(
        '<div>\n  <span>text</span>\n</div>',
        "test.xml",
      );
      const map = buildSourceMap(entries);

      const domEntries = map.findDom("test.xml", 2);
      expect(domEntries).toHaveLength(1);
      expect(domEntries[0].tagName).toBe("span");
    });

    it("returns empty array for non-existent source line", () => {
      const map = buildSourceMap([]);
      expect(map.findDom("none.xml", 99)).toEqual([]);
    });

    it("returns undefined for non-existent DOM selector", () => {
      const map = buildSourceMap([]);
      expect(map.findSource('[data-source-id="nope"]')).toBeUndefined();
    });
  });

  describe("SOURCE_MAP_CLICK_SCRIPT", () => {
    it("contains dblclick listener for source navigation", () => {
      expect(SOURCE_MAP_CLICK_SCRIPT).toContain("dblclick");
      expect(SOURCE_MAP_CLICK_SCRIPT).toContain("platxa:source-navigate");
    });

    it("listens for highlight-element messages from parent", () => {
      expect(SOURCE_MAP_CLICK_SCRIPT).toContain("platxa:highlight-element");
      expect(SOURCE_MAP_CLICK_SCRIPT).toContain("data-source-highlight");
    });

    it("scrolls highlighted element into view", () => {
      expect(SOURCE_MAP_CLICK_SCRIPT).toContain("scrollIntoView");
    });
  });
});
