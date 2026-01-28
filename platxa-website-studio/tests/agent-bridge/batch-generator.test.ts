import { describe, it, expect } from "vitest";
import {
  DEFAULT_BATCH_CONFIG,
  createBatchState,
  generateBrandScss,
  generateBrandContext,
  generatePageTemplate,
  generatePageScss,
  generateSnippetTemplate,
  generateSnippetScss,
  runWithConcurrency,
  runBatch,
  runBatchSync,
} from "@/lib/agent-bridge/batch-generator";
import type {
  BrandContext,
  PageSpec,
  SnippetSpec,
  BatchRequest,
} from "@/lib/agent-bridge/batch-generator";

const brand: BrandContext = {
  name: "Acme Corp",
  primaryColor: "#3b82f6",
  secondaryColor: "#10b981",
  fontFamily: "Inter",
  industry: "Technology",
  tone: "professional",
};

function makePage(id: string, type: string, sections: string[]): PageSpec {
  return { id, type, title: `${type} Page`, sections };
}

function makeSnippet(id: string, type: string, variant?: string): SnippetSpec {
  return { id, type, name: `${type} Snippet`, variant };
}

function makeRequest(
  pages: PageSpec[],
  snippets: SnippetSpec[] = [],
): BatchRequest {
  return { brand, pages, snippets };
}

describe("Batch Generator", () => {
  describe("createBatchState", () => {
    it("creates idle state with defaults", () => {
      const state = createBatchState(brand);
      expect(state.status).toBe("idle");
      expect(state.pages).toHaveLength(0);
      expect(state.config.concurrency).toBe(4);
    });

    it("accepts custom config", () => {
      const state = createBatchState(brand, { concurrency: 8 });
      expect(state.config.concurrency).toBe(8);
      expect(state.config.continueOnError).toBe(true);
    });
  });

  describe("generateBrandScss", () => {
    it("produces SCSS variables from brand", () => {
      const scss = generateBrandScss(brand);
      expect(scss).toContain("$brand-primary: #3b82f6");
      expect(scss).toContain("$brand-secondary: #10b981");
      expect(scss).toContain("$brand-font: 'Inter'");
    });
  });

  describe("generateBrandContext", () => {
    it("produces QWeb context variables", () => {
      const ctx = generateBrandContext(brand);
      expect(ctx.brand_name).toBe("Acme Corp");
      expect(ctx.brand_primary).toBe("#3b82f6");
      expect(ctx.brand_industry).toBe("Technology");
    });
  });

  describe("generatePageTemplate", () => {
    it("generates QWeb template with sections", () => {
      const spec = makePage("home", "home", ["hero", "features"]);
      const qweb = generatePageTemplate(spec, brand);
      expect(qweb).toContain('id="page_home"');
      expect(qweb).toContain("t-call=\"website.layout\"");
      expect(qweb).toContain('class="s_hero"');
      expect(qweb).toContain('class="s_features"');
      expect(qweb).toContain("Inter");
    });

    it("capitalizes section headings", () => {
      const spec = makePage("p1", "about", ["team"]);
      const qweb = generatePageTemplate(spec, brand);
      expect(qweb).toContain("<h2>Team</h2>");
    });
  });

  describe("generatePageScss", () => {
    it("generates SCSS with brand colors", () => {
      const spec = makePage("p1", "home", ["hero"]);
      const scss = generatePageScss(spec, brand);
      expect(scss).toContain(".page-home");
      expect(scss).toContain(".s_hero");
      expect(scss).toContain(brand.primaryColor);
    });
  });

  describe("generateSnippetTemplate", () => {
    it("generates snippet QWeb with variant", () => {
      const spec = makeSnippet("s1", "cta", "centered");
      const qweb = generateSnippetTemplate(spec, brand);
      expect(qweb).toContain('id="snippet_s1"');
      expect(qweb).toContain("s_cta_centered");
      expect(qweb).toContain(brand.primaryColor);
    });

    it("uses default variant when none specified", () => {
      const spec = makeSnippet("s2", "hero");
      const qweb = generateSnippetTemplate(spec, brand);
      expect(qweb).toContain("s_hero_default");
    });
  });

  describe("generateSnippetScss", () => {
    it("generates SCSS with variant class", () => {
      const spec = makeSnippet("s1", "pricing", "minimal");
      const scss = generateSnippetScss(spec, brand);
      expect(scss).toContain(".s_pricing_minimal");
      expect(scss).toContain(brand.primaryColor);
    });
  });

  describe("runWithConcurrency", () => {
    it("processes all items", async () => {
      const items = [1, 2, 3, 4, 5];
      const results = await runWithConcurrency(
        items,
        async (n) => n * 2,
        2,
      );
      expect(results).toEqual([2, 4, 6, 8, 10]);
    });

    it("preserves order", async () => {
      const items = [30, 10, 20];
      const results = await runWithConcurrency(
        items,
        async (n) => {
          await new Promise((r) => setTimeout(r, n));
          return n;
        },
        3,
      );
      expect(results).toEqual([30, 10, 20]);
    });

    it("handles empty input", async () => {
      const results = await runWithConcurrency([], async (n: number) => n, 4);
      expect(results).toEqual([]);
    });

    it("limits concurrency", async () => {
      let running = 0;
      let maxRunning = 0;
      const items = [1, 2, 3, 4, 5, 6];
      await runWithConcurrency(
        items,
        async () => {
          running++;
          maxRunning = Math.max(maxRunning, running);
          await new Promise((r) => setTimeout(r, 10));
          running--;
        },
        2,
      );
      expect(maxRunning).toBeLessThanOrEqual(2);
    });
  });

  describe("runBatch", () => {
    it("generates pages and snippets with custom generators", async () => {
      const request = makeRequest(
        [makePage("home", "home", ["hero"])],
        [makeSnippet("s1", "cta")],
      );

      const result = await runBatch(
        request,
        async (spec, b) => ({
          qweb: generatePageTemplate(spec, b),
          scss: generatePageScss(spec, b),
        }),
        async (spec, b) => ({
          qweb: generateSnippetTemplate(spec, b),
          scss: generateSnippetScss(spec, b),
        }),
      );

      expect(result.pages).toHaveLength(1);
      expect(result.snippets).toHaveLength(1);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.totalItems).toBe(2);
    });

    it("handles generator failures with continueOnError", async () => {
      const request = makeRequest(
        [makePage("p1", "home", ["hero"]), makePage("p2", "about", ["team"])],
        [],
      );

      const result = await runBatch(
        request,
        async (spec) => {
          if (spec.id === "p2") throw new Error("gen failed");
          return { qweb: "<t/>", scss: "" };
        },
        async () => ({ qweb: "", scss: "" }),
      );

      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(result.pages[1].error).toBe("gen failed");
    });

    it("generates 5+ pages with shared brand", async () => {
      const pages = [
        makePage("home", "home", ["hero", "features"]),
        makePage("about", "about", ["team", "story"]),
        makePage("contact", "contact", ["form", "map"]),
        makePage("blog", "blog", ["posts", "sidebar"]),
        makePage("products", "product", ["catalog", "filters"]),
      ];
      const request = makeRequest(pages);

      const result = await runBatch(
        request,
        async (spec, b) => ({
          qweb: generatePageTemplate(spec, b),
          scss: generatePageScss(spec, b),
        }),
        async () => ({ qweb: "", scss: "" }),
      );

      expect(result.pages).toHaveLength(5);
      expect(result.successCount).toBe(5);
      // All pages share brand context
      for (const page of result.pages) {
        expect(page.qweb).toContain("Inter");
      }
    });
  });

  describe("runBatchSync", () => {
    it("generates all pages and snippets synchronously", () => {
      const request = makeRequest(
        [
          makePage("home", "home", ["hero", "features", "cta"]),
          makePage("about", "about", ["team"]),
          makePage("contact", "contact", ["form"]),
          makePage("blog", "blog", ["posts"]),
          makePage("products", "product", ["catalog"]),
        ],
        [makeSnippet("s1", "hero"), makeSnippet("s2", "cta", "centered")],
      );

      const result = runBatchSync(request);

      expect(result.pages).toHaveLength(5);
      expect(result.snippets).toHaveLength(2);
      expect(result.successCount).toBe(7);
      expect(result.failureCount).toBe(0);
      expect(result.totalItems).toBe(7);
    });

    it("all pages contain shared brand", () => {
      const request = makeRequest([
        makePage("p1", "home", ["hero"]),
        makePage("p2", "about", ["team"]),
      ]);

      const result = runBatchSync(request);
      for (const page of result.pages) {
        expect(page.qweb).toContain(brand.fontFamily);
        expect(page.scss).toContain(brand.primaryColor);
      }
    });

    it("reports timing metrics", () => {
      const request = makeRequest(
        [makePage("p1", "home", ["hero"])],
        [makeSnippet("s1", "cta")],
      );
      const result = runBatchSync(request);
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.totalItems).toBe(2);
    });
  });

  describe("DEFAULT_BATCH_CONFIG", () => {
    it("has expected defaults", () => {
      expect(DEFAULT_BATCH_CONFIG.concurrency).toBe(4);
      expect(DEFAULT_BATCH_CONFIG.continueOnError).toBe(true);
      expect(DEFAULT_BATCH_CONFIG.pageTimeoutMs).toBe(30000);
    });
  });
});
