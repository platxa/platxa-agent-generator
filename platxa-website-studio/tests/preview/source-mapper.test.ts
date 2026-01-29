import { describe, it, expect, beforeEach } from "vitest";
import {
  SourceMapper,
  createSourceMap,
  createMultiFileSourceMap,
  type ElementMapping,
  type SourceLocation,
} from "@/lib/preview/source-mapper";

describe("SourceMapper", () => {
  let mapper: SourceMapper;

  beforeEach(() => {
    mapper = new SourceMapper();
  });

  describe("annotate", () => {
    it("annotates single-line elements with data attributes", () => {
      const source = `<div class="hero">content</div>`;
      const { annotated, elementCount } = mapper.annotate(source, "test.xml");

      expect(elementCount).toBe(1);
      expect(annotated).toContain('data-element-id="el-0"');
      expect(annotated).toContain('data-source-start="1"');
    });

    it("annotates multi-line elements with start and end lines", () => {
      const source = `<section class="s_hero">
  <div class="container">
    <h1>Title</h1>
  </div>
</section>`;
      const { annotated, elementCount } = mapper.annotate(source, "hero.xml");

      expect(elementCount).toBe(3); // section, div, h1

      // Check section mapping spans lines 1-5
      const sectionLoc = mapper.getLocation("el-0");
      expect(sectionLoc?.startLine).toBe(1);
      expect(sectionLoc?.endLine).toBe(5);

      // Check nested div spans lines 2-4
      const divLoc = mapper.getLocation("el-1");
      expect(divLoc?.startLine).toBe(2);
      expect(divLoc?.endLine).toBe(4);

      // Check h1 is single line
      const h1Loc = mapper.getLocation("el-2");
      expect(h1Loc?.startLine).toBe(3);
      expect(h1Loc?.endLine).toBe(3);
    });

    it("handles self-closing tags", () => {
      const source = `<div><img src="photo.jpg" /><br/></div>`;
      const { elementCount } = mapper.annotate(source, "test.xml");

      expect(elementCount).toBe(3); // div, img, br

      const imgLoc = mapper.getLocation("el-1");
      expect(imgLoc?.startLine).toBe(1);
      expect(imgLoc?.endLine).toBe(1);
    });

    it("extracts snippet IDs from data-snippet attribute", () => {
      const source = `<section data-snippet="s_hero">content</section>`;
      mapper.annotate(source, "test.xml");

      const mapping = mapper.getMapping("el-0");
      expect(mapping?.snippetId).toBe("s_hero");
    });

    it("extracts snippet IDs from class names", () => {
      const source = `<section class="s_features pt-5">content</section>`;
      mapper.annotate(source, "test.xml");

      const mapping = mapper.getMapping("el-0");
      expect(mapping?.snippetId).toBe("s_features");
    });

    it("tracks element tag names", () => {
      const source = `<div><span>text</span></div>`;
      mapper.annotate(source, "test.xml");

      expect(mapper.getMapping("el-0")?.tagName).toBe("div");
      expect(mapper.getMapping("el-1")?.tagName).toBe("span");
    });

    it("uses custom ID prefix", () => {
      const customMapper = new SourceMapper({ idPrefix: "src" });
      customMapper.annotate(`<div>test</div>`, "test.xml");

      expect(customMapper.has("src-0")).toBe(true);
      expect(customMapper.has("el-0")).toBe(false);
    });

    it("tracks classes when enabled", () => {
      const classMapper = new SourceMapper({ trackClasses: true });
      classMapper.annotate(`<div class="foo bar baz">test</div>`, "test.xml");

      const mapping = classMapper.getMapping("el-0");
      expect(mapping?.classes).toEqual(["foo", "bar", "baz"]);
    });

    it("handles empty source", () => {
      const { annotated, elementCount } = mapper.annotate("", "empty.xml");
      expect(annotated).toBe("");
      expect(elementCount).toBe(0);
    });

    it("handles source with no HTML tags", () => {
      const { annotated, elementCount } = mapper.annotate("plain text only", "text.xml");
      expect(annotated).toBe("plain text only");
      expect(elementCount).toBe(0);
    });
  });

  describe("forward lookup: getLocation", () => {
    beforeEach(() => {
      mapper.annotate(`<div><span>test</span></div>`, "test.xml");
    });

    it("returns location for valid element ID", () => {
      const loc = mapper.getLocation("el-0");
      expect(loc).toEqual({
        path: "test.xml",
        startLine: 1,
        endLine: 1,
      });
    });

    it("returns undefined for invalid element ID", () => {
      expect(mapper.getLocation("nonexistent")).toBeUndefined();
    });

    it("returns correct path, startLine, endLine structure", () => {
      const multiLine = `<section>
  <div>content</div>
</section>`;
      const mapper2 = new SourceMapper();
      mapper2.annotate(multiLine, "multi.xml");

      const loc = mapper2.getLocation("el-0");
      expect(loc).toHaveProperty("path", "multi.xml");
      expect(loc).toHaveProperty("startLine", 1);
      expect(loc).toHaveProperty("endLine", 3);
    });
  });

  describe("forward lookup: getMapping", () => {
    it("returns full mapping entry", () => {
      mapper.annotate(`<section class="s_hero">content</section>`, "hero.xml");

      const mapping = mapper.getMapping("el-0");
      expect(mapping).toMatchObject({
        elementId: "el-0",
        tagName: "section",
        snippetId: "s_hero",
        location: {
          path: "hero.xml",
          startLine: 1,
          endLine: 1,
        },
      });
    });
  });

  describe("reverse lookup: getElementsAtLine", () => {
    beforeEach(() => {
      const source = `<section>
  <div>
    <span>text</span>
  </div>
</section>`;
      mapper.annotate(source, "test.xml");
    });

    it("returns elements starting at a specific line", () => {
      const elements = mapper.getElementsAtLine("test.xml", 1);
      expect(elements).toContain("el-0"); // section starts at line 1
    });

    it("returns elements spanning a line with includeSpanning option", () => {
      // Line 3 has span, but section and div also span it
      const spanning = mapper.getElementsAtLine("test.xml", 3, { includeSpanning: true });
      expect(spanning).toContain("el-0"); // section spans 1-5
      expect(spanning).toContain("el-1"); // div spans 2-4
      expect(spanning).toContain("el-2"); // span at line 3
    });

    it("returns only elements starting at line without includeSpanning", () => {
      const starting = mapper.getElementsAtLine("test.xml", 3);
      expect(starting).toContain("el-2"); // span starts at 3
      expect(starting).not.toContain("el-0"); // section starts at 1
    });

    it("returns empty array for line with no elements", () => {
      const elements = mapper.getElementsAtLine("test.xml", 100);
      expect(elements).toEqual([]);
    });

    it("returns empty array for unknown file", () => {
      const elements = mapper.getElementsAtLine("unknown.xml", 1);
      expect(elements).toEqual([]);
    });
  });

  describe("reverse lookup: getElementsInRange", () => {
    beforeEach(() => {
      const source = `<header>header</header>
<main>
  <section>section</section>
</main>
<footer>footer</footer>`;
      mapper.annotate(source, "page.xml");
    });

    it("returns elements within line range", () => {
      const elements = mapper.getElementsInRange("page.xml", 2, 4);

      // Should include main (2-4) and section (3)
      expect(elements.length).toBeGreaterThanOrEqual(2);
    });

    it("returns empty array for range with no elements", () => {
      const elements = mapper.getElementsInRange("page.xml", 100, 200);
      expect(elements).toEqual([]);
    });
  });

  describe("reverse lookup: getElementsBySnippet", () => {
    it("returns elements by snippet ID", () => {
      const source = `<section class="s_hero">hero</section>
<section class="s_features">features</section>
<section class="s_hero">another hero</section>`;
      mapper.annotate(source, "test.xml");

      const heroElements = mapper.getElementsBySnippet("s_hero");
      expect(heroElements).toHaveLength(2);
      expect(heroElements).toContain("el-0");
      expect(heroElements).toContain("el-2");
    });

    it("returns empty array for unknown snippet", () => {
      mapper.annotate(`<div>no snippets</div>`, "test.xml");
      expect(mapper.getElementsBySnippet("s_unknown")).toEqual([]);
    });
  });

  describe("bidirectional consistency", () => {
    it("forward and reverse lookups are consistent", () => {
      const source = `<div id="outer">
  <span id="inner">text</span>
</div>`;
      mapper.annotate(source, "test.xml");

      // Get all mappings
      const allMappings = mapper.getAllMappings();

      for (const mapping of allMappings) {
        // Forward: id → location
        const loc = mapper.getLocation(mapping.elementId);
        expect(loc).toBeDefined();

        // Reverse: location → should include this id
        const elementsAtStart = mapper.getElementsAtLine(
          mapping.location.path,
          mapping.location.startLine,
        );
        expect(elementsAtStart).toContain(mapping.elementId);

        // Reverse with spanning: any line in range should include this id
        for (let line = loc!.startLine; line <= loc!.endLine; line++) {
          const spanning = mapper.getElementsAtLine(
            mapping.location.path,
            line,
            { includeSpanning: true },
          );
          expect(spanning).toContain(mapping.elementId);
        }
      }
    });
  });

  describe("bulk operations", () => {
    it("getAllMappings returns all entries", () => {
      mapper.annotate(`<div><span>a</span><span>b</span></div>`, "test.xml");

      const all = mapper.getAllMappings();
      expect(all).toHaveLength(3);
    });

    it("size returns correct count", () => {
      mapper.annotate(`<div><span>text</span></div>`, "test.xml");
      expect(mapper.size).toBe(2);
    });

    it("clear removes all mappings", () => {
      mapper.annotate(`<div>test</div>`, "test.xml");
      expect(mapper.size).toBe(1);

      mapper.clear();
      expect(mapper.size).toBe(0);
      expect(mapper.getLocation("el-0")).toBeUndefined();
    });

    it("has checks element existence", () => {
      mapper.annotate(`<div>test</div>`, "test.xml");

      expect(mapper.has("el-0")).toBe(true);
      expect(mapper.has("el-999")).toBe(false);
    });
  });

  describe("merge", () => {
    it("merges mappings from another SourceMapper", () => {
      mapper.annotate(`<div>file1</div>`, "file1.xml");

      const other = new SourceMapper();
      other.annotate(`<span>file2</span>`, "file2.xml");

      mapper.merge(other);

      // Original mapping preserved
      expect(mapper.getLocation("el-0")?.path).toBe("file1.xml");

      // Merged mapping added with new ID
      expect(mapper.size).toBe(2);

      // Can find elements from both files
      expect(mapper.getElementsAtLine("file1.xml", 1)).toHaveLength(1);
      expect(mapper.getElementsAtLine("file2.xml", 1)).toHaveLength(1);
    });
  });

  describe("serialization", () => {
    it("toJSON exports elementId → location map", () => {
      mapper.annotate(`<section>
  <div>content</div>
</section>`, "test.xml");

      const json = mapper.toJSON();

      expect(json["el-0"]).toEqual({
        path: "test.xml",
        startLine: 1,
        endLine: 3,
      });
      expect(json["el-1"]).toEqual({
        path: "test.xml",
        startLine: 2,
        endLine: 2,
      });
    });

    it("fromJSON recreates mapper from exported data", () => {
      const data = {
        "el-0": { path: "test.xml", startLine: 1, endLine: 5 },
        "el-1": { path: "test.xml", startLine: 2, endLine: 4 },
      };

      const restored = SourceMapper.fromJSON(data);

      expect(restored.getLocation("el-0")).toEqual({
        path: "test.xml",
        startLine: 1,
        endLine: 5,
      });

      // Reverse lookup works
      const spanning = restored.getElementsAtLine("test.xml", 3, { includeSpanning: true });
      expect(spanning).toContain("el-0");
      expect(spanning).toContain("el-1");
    });

    it("round-trips through JSON correctly", () => {
      mapper.annotate(`<div><span>test</span></div>`, "test.xml");

      const json = mapper.toJSON();
      const restored = SourceMapper.fromJSON(json);

      expect(restored.size).toBe(mapper.size);

      for (const id of Object.keys(json)) {
        expect(restored.getLocation(id)).toEqual(mapper.getLocation(id));
      }
    });
  });
});

describe("createSourceMap", () => {
  it("creates mapper and annotates in one step", () => {
    const { mapper, annotated } = createSourceMap(
      `<div>test</div>`,
      "test.xml",
    );

    expect(mapper.size).toBe(1);
    expect(annotated).toContain("data-element-id");
  });

  it("accepts options", () => {
    const { mapper } = createSourceMap(
      `<div>test</div>`,
      "test.xml",
      { idPrefix: "custom" },
    );

    expect(mapper.has("custom-0")).toBe(true);
  });
});

describe("createMultiFileSourceMap", () => {
  it("creates single mapper for multiple files", () => {
    const { mapper, annotatedFiles } = createMultiFileSourceMap([
      { source: `<header>header</header>`, path: "header.xml" },
      { source: `<main>main</main>`, path: "main.xml" },
      { source: `<footer>footer</footer>`, path: "footer.xml" },
    ]);

    expect(mapper.size).toBe(3);
    expect(annotatedFiles).toHaveLength(3);

    // Can query across all files
    expect(mapper.getElementsAtLine("header.xml", 1)).toHaveLength(1);
    expect(mapper.getElementsAtLine("main.xml", 1)).toHaveLength(1);
    expect(mapper.getElementsAtLine("footer.xml", 1)).toHaveLength(1);
  });

  it("preserves file paths in locations", () => {
    const { mapper } = createMultiFileSourceMap([
      { source: `<div>a</div>`, path: "a.xml" },
      { source: `<div>b</div>`, path: "b.xml" },
    ]);

    const allMappings = mapper.getAllMappings();
    const paths = new Set(allMappings.map((m) => m.location.path));

    expect(paths.has("a.xml")).toBe(true);
    expect(paths.has("b.xml")).toBe(true);
  });
});

describe("edge cases", () => {
  let mapper: SourceMapper;

  beforeEach(() => {
    mapper = new SourceMapper();
  });

  it("handles deeply nested elements", () => {
    const source = `<a><b><c><d><e>deep</e></d></c></b></a>`;
    mapper.annotate(source, "deep.xml");

    expect(mapper.size).toBe(5);

    // All elements on same line
    const elements = mapper.getElementsAtLine("deep.xml", 1);
    expect(elements).toHaveLength(5);
  });

  it("handles unclosed tags gracefully", () => {
    const source = `<div>
  <span>unclosed
</div>`;
    // Should not throw
    expect(() => mapper.annotate(source, "test.xml")).not.toThrow();
    expect(mapper.size).toBeGreaterThan(0);
  });

  it("handles mixed content and tags", () => {
    const source = `text before <div>inside</div> text after`;
    mapper.annotate(source, "test.xml");

    expect(mapper.size).toBe(1);
  });

  it("handles attributes with special characters", () => {
    const source = `<div class="foo's &quot;bar&quot;" data-value="<test>">content</div>`;
    expect(() => mapper.annotate(source, "test.xml")).not.toThrow();
  });

  it("handles QWeb t- directives", () => {
    const source = `<t t-if="condition">
  <div t-foreach="items" t-as="item">
    <span t-esc="item.name"/>
  </div>
</t>`;
    mapper.annotate(source, "qweb.xml");

    // t elements should be tracked
    expect(mapper.size).toBeGreaterThanOrEqual(3);
  });

  it("handles HTML5 void elements correctly", () => {
    const source = `<div>
  <input type="text">
  <img src="photo.jpg">
  <br>
  <hr>
</div>`;
    mapper.annotate(source, "test.xml");

    // All void elements tracked as single-line
    const inputLoc = mapper.getLocation("el-1");
    expect(inputLoc?.startLine).toBe(inputLoc?.endLine);
  });
});
