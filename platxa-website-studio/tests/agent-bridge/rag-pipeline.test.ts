import { describe, it, expect } from "vitest";
import {
  tokenize,
  chunkFile,
  indexProject,
  queryIndex,
  createRAGPipeline,
} from "@/lib/agent-bridge/rag-pipeline";

describe("RAG Pipeline", () => {
  describe("tokenize", () => {
    it("splits text into lowercase tokens", () => {
      const tokens = tokenize("Hello World");
      expect(tokens).toContain("hello");
      expect(tokens).toContain("world");
    });

    it("splits camelCase identifiers", () => {
      const tokens = tokenize("myVariableName");
      expect(tokens).toContain("my");
      expect(tokens).toContain("variable");
      expect(tokens).toContain("name");
    });

    it("splits snake_case identifiers", () => {
      const tokens = tokenize("my_variable_name");
      expect(tokens).toContain("my_variable_name");
      expect(tokens).toContain("my");
      expect(tokens).toContain("variable");
      expect(tokens).toContain("name");
    });

    it("filters stop words", () => {
      const tokens = tokenize("the function is not defined");
      expect(tokens).not.toContain("the");
      expect(tokens).not.toContain("function");
      expect(tokens).not.toContain("is");
      expect(tokens).not.toContain("not");
      expect(tokens).toContain("defined");
    });

    it("removes short tokens", () => {
      const tokens = tokenize("a b cc dd");
      expect(tokens).not.toContain("a");
      expect(tokens).not.toContain("b");
      expect(tokens).toContain("cc");
      expect(tokens).toContain("dd");
    });

    it("deduplicates tokens", () => {
      const tokens = tokenize("foo foo foo");
      expect(tokens.filter((t) => t === "foo")).toHaveLength(1);
    });
  });

  describe("chunkFile", () => {
    it("splits content into chunks of specified size", () => {
      const lines = Array.from({ length: 60 }, (_, i) => `line ${i}`).join("\n");
      const chunks = chunkFile(lines, "test.xml", { chunkSize: 30, chunkOverlap: 5 });
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].startLine).toBe(1);
      expect(chunks[0].endLine).toBe(30);
    });

    it("detects language from extension", () => {
      expect(chunkFile("x\ny", "file.py")[0].language).toBe("python");
      expect(chunkFile("x\ny", "file.js")[0].language).toBe("javascript");
      expect(chunkFile("x\ny", "file.scss")[0].language).toBe("scss");
      expect(chunkFile("x\ny", "file.xml")[0].language).toBe("xml");
    });

    it("detects snippet IDs from data-snippet attribute", () => {
      const html = '<section data-snippet="s_hero">content</section>';
      const chunks = chunkFile(html, "template.xml");
      expect(chunks[0].snippetId).toBe("s_hero");
    });

    it("detects snippet IDs from s_ class prefix", () => {
      const html = '<section class="s_features oe_structure">content</section>';
      const chunks = chunkFile(html, "template.xml");
      expect(chunks[0].snippetId).toBe("s_features");
    });

    it("tokenizes chunk content", () => {
      const chunks = chunkFile("padding margin border", "style.scss");
      expect(chunks[0].tokens).toContain("padding");
      expect(chunks[0].tokens).toContain("margin");
      expect(chunks[0].tokens).toContain("border");
    });

    it("handles single-line files", () => {
      const chunks = chunkFile("single line", "f.xml");
      expect(chunks).toHaveLength(1);
      expect(chunks[0].startLine).toBe(1);
      expect(chunks[0].endLine).toBe(1);
    });
  });

  describe("indexProject", () => {
    it("indexes files with matching extensions", () => {
      const files = {
        "header.xml": "<header>test</header>",
        "style.scss": ".header { color: red; }",
        "readme.md": "# Readme",
      };
      const chunks = indexProject(files);
      const indexedFiles = [...new Set(chunks.map((c) => c.file))];
      expect(indexedFiles).toContain("header.xml");
      expect(indexedFiles).toContain("style.scss");
      expect(indexedFiles).not.toContain("readme.md");
    });

    it("skips empty files", () => {
      const files = { "empty.xml": "", "full.xml": "<div>content</div>" };
      const chunks = indexProject(files);
      expect(chunks.every((c) => c.file === "full.xml")).toBe(true);
    });

    it("respects custom extensions", () => {
      const files = { "file.ts": "const x = 1;", "file.xml": "<div/>" };
      const chunks = indexProject(files, { extensions: ["ts"] });
      expect(chunks.every((c) => c.file === "file.ts")).toBe(true);
    });
  });

  describe("queryIndex", () => {
    const files: Record<string, string> = {
      "header.xml": '<section data-snippet="s_header"><h1>Welcome</h1></section>',
      "footer.xml": '<footer class="s_footer"><p>Copyright</p></footer>',
      "style.scss": ".s_header { background: blue; }\n.s_footer { padding: 1rem; }",
    };
    const chunks = indexProject(files);

    it("retrieves relevant chunks for a query", () => {
      const result = queryIndex("header snippet", chunks);
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].score).toBeGreaterThan(0);
    });

    it("ranks snippet ID matches higher", () => {
      const result = queryIndex("s_header", chunks);
      expect(result.results.length).toBeGreaterThan(0);
      const topFile = result.results[0].chunk.file;
      expect(topFile).toBe("header.xml");
    });

    it("returns matched tokens", () => {
      const result = queryIndex("welcome", chunks);
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].matchedTokens.length).toBeGreaterThan(0);
    });

    it("returns empty results for unmatched query", () => {
      const result = queryIndex("xyznonexistent", chunks);
      expect(result.results).toHaveLength(0);
    });

    it("respects topK limit", () => {
      const result = queryIndex("section", chunks, 1);
      expect(result.results.length).toBeLessThanOrEqual(1);
    });

    it("reports total chunks searched", () => {
      const result = queryIndex("header", chunks);
      expect(result.totalChunksSearched).toBe(chunks.length);
    });

    it("reports duration", () => {
      const result = queryIndex("header", chunks);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("createRAGPipeline", () => {
    it("creates a queryable pipeline", () => {
      const pipeline = createRAGPipeline({
        "test.xml": '<section data-snippet="s_hero">Hero</section>',
      });
      expect(pipeline.chunkCount).toBeGreaterThan(0);
      const result = pipeline.query("hero");
      expect(result.results.length).toBeGreaterThan(0);
    });

    it("supports reindexing", () => {
      const pipeline = createRAGPipeline({ "a.xml": "<div>old</div>" });
      const before = pipeline.chunkCount;
      pipeline.reindex({
        "a.xml": "<div>new</div>",
        "b.xml": "<div>extra</div>",
      });
      expect(pipeline.chunkCount).toBeGreaterThanOrEqual(before);
    });

    it("retrieves existing header snippet with correct ranking", () => {
      const pipeline = createRAGPipeline({
        "header.xml": '<header data-snippet="s_header"><nav>Main Nav</nav></header>',
        "footer.xml": '<footer class="s_footer">Footer</footer>',
        "about.xml": '<section class="s_about">About us</section>',
      });
      const result = pipeline.query("existing header snippet");
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].chunk.file).toBe("header.xml");
    });
  });
});
