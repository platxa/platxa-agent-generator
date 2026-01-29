import { describe, it, expect } from "vitest";
import {
  annotateTemplateSource,
  buildSourceMap,
  getSourceLocation,
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

  describe("endLine tracking", () => {
    it("tracks endLine for elements with closing tags", () => {
      const source = `<section>
  <div>content</div>
</section>`;
      const { entries } = annotateTemplateSource(source, "test.xml");

      // section: line 1-3, div: line 2-2
      expect(entries[0].endLine).toBe(3); // section closes on line 3
      expect(entries[1].endLine).toBe(2); // div closes on line 2
    });

    it("sets endLine to startLine for self-closing tags", () => {
      const source = '<img src="test.png" />';
      const { entries } = annotateTemplateSource(source, "test.xml");

      expect(entries[0].line).toBe(1);
      expect(entries[0].endLine).toBe(1);
    });

    it("handles nested elements correctly", () => {
      const source = `<div>
  <ul>
    <li>Item 1</li>
    <li>Item 2</li>
  </ul>
</div>`;
      const { entries } = annotateTemplateSource(source, "test.xml");

      // div: 1-6, ul: 2-5, li: 3-3, li: 4-4
      expect(entries[0].endLine).toBe(6); // div
      expect(entries[1].endLine).toBe(5); // ul
      expect(entries[2].endLine).toBe(3); // first li
      expect(entries[3].endLine).toBe(4); // second li
    });
  });

  describe("getSourceLocation (Feature #69)", () => {
    it("returns { path, startLine, endLine } for valid elementId", () => {
      const source = `<section class="hero">
  <h1>Title</h1>
</section>`;
      const { entries } = annotateTemplateSource(source, "template.xml");
      const map = buildSourceMap(entries);

      const location = getSourceLocation("src-0", map);

      expect(location).toEqual({
        path: "template.xml",
        startLine: 1,
        endLine: 3,
      });
    });

    it("returns correct location for nested element", () => {
      const source = `<div>
  <span>text</span>
</div>`;
      const { entries } = annotateTemplateSource(source, "page.xml");
      const map = buildSourceMap(entries);

      const location = getSourceLocation("src-1", map);

      expect(location).toEqual({
        path: "page.xml",
        startLine: 2,
        endLine: 2,
      });
    });

    it("returns null for non-existent elementId", () => {
      const { entries } = annotateTemplateSource("<div></div>", "test.xml");
      const map = buildSourceMap(entries);

      const location = getSourceLocation("src-999", map);

      expect(location).toBeNull();
    });

    it("handles self-closing tags", () => {
      const source = '<input type="text" />';
      const { entries } = annotateTemplateSource(source, "form.xml");
      const map = buildSourceMap(entries);

      const location = getSourceLocation("src-0", map);

      expect(location).toEqual({
        path: "form.xml",
        startLine: 1,
        endLine: 1,
      });
    });

    it("clicking element reveals exact line numbers in source file", () => {
      // Feature #69 verification test
      const source = `<section data-snippet="s_hero">
  <div class="container">
    <h1>Welcome</h1>
    <p>Description</p>
  </div>
</section>`;
      const { entries } = annotateTemplateSource(source, "hero.xml");
      const map = buildSourceMap(entries);

      // Simulate clicking on h1 element (src-2)
      const h1Location = getSourceLocation("src-2", map);

      expect(h1Location).not.toBeNull();
      expect(h1Location!.path).toBe("hero.xml");
      expect(h1Location!.startLine).toBe(3);
      expect(h1Location!.endLine).toBe(3);

      // Simulate clicking on section element (src-0)
      const sectionLocation = getSourceLocation("src-0", map);

      expect(sectionLocation).not.toBeNull();
      expect(sectionLocation!.path).toBe("hero.xml");
      expect(sectionLocation!.startLine).toBe(1);
      expect(sectionLocation!.endLine).toBe(6);
    });
  });
});
