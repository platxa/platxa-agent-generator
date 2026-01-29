// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  OdooPreviewRenderer,
  createPreviewRenderer,
  createMockPreviewRenderer,
  createMockFetch,
  generateRequestId,
  createCacheKey,
  type RenderRequest,
  type RenderResult,
  type RenderEvent,
  type RendererConfig,
} from "@/lib/preview/odoo-preview-renderer";

describe("OdooPreviewRenderer", () => {
  describe("preview fetches rendered HTML from sidecar's Odoo instance (Feature #173)", () => {
    it("fetches rendered HTML from sidecar", async () => {
      // Feature #173: Preview fetches rendered HTML from sidecar's Odoo instance
      const renderer = createMockPreviewRenderer(
        { enableCache: false },
        { html: "<div class='rendered'>Odoo Content</div>" }
      );

      const result = await renderer.render({ template: "website.page" });

      expect(result.success).toBe(true);
      expect(result.html).toContain("Odoo Content");
    });

    it("sends render request to sidecar endpoint", async () => {
      // Feature #173: Communicates with sidecar
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ html: "<div>Test</div>", render_time: 100 }),
      });

      const renderer = createPreviewRenderer({ enableCache: false }, fetchMock);

      await renderer.render({
        template: "website.homepage",
        context: { page_id: 1 },
      });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/preview/render"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("website.homepage"),
        })
      );
    });

    it("renders full page by URL", async () => {
      // Feature #173: Page rendering
      const renderer = createMockPreviewRenderer(
        { enableCache: false },
        { html: "<html><body>Full Page</body></html>" }
      );

      const result = await renderer.renderPage("/contactus");

      expect(result.success).toBe(true);
      expect(result.html).toContain("Full Page");
    });

    it("renders QWeb template with context", async () => {
      // Feature #173: Template rendering
      const renderer = createMockPreviewRenderer(
        { enableCache: false },
        { html: "<section>Template Output</section>" }
      );

      const result = await renderer.renderTemplate(
        "website.s_banner",
        { title: "Hello" }
      );

      expect(result.success).toBe(true);
      expect(result.html).toContain("Template Output");
    });

    it("includes asset URLs in result", async () => {
      // Feature #173: Asset handling
      const renderer = createMockPreviewRenderer(
        { enableCache: false },
        {
          html: "<div>Content</div>",
          cssUrls: ["/web/assets/main.css"],
          jsUrls: ["/web/assets/main.js"],
        }
      );

      const result = await renderer.render({
        template: "test",
        includeAssets: true,
      });

      expect(result.assets).toBeDefined();
      expect(result.assets?.css).toContain("/web/assets/main.css");
      expect(result.assets?.js).toContain("/web/assets/main.js");
    });
  });

  describe("generateRequestId", () => {
    it("generates unique IDs", () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^req-\d+-[a-z0-9]+$/);
    });
  });

  describe("createCacheKey", () => {
    it("creates consistent key for same request", () => {
      const request: RenderRequest = {
        template: "test.template",
        context: { id: 1 },
      };

      const key1 = createCacheKey(request);
      const key2 = createCacheKey(request);

      expect(key1).toBe(key2);
    });

    it("creates different keys for different templates", () => {
      const key1 = createCacheKey({ template: "template.a" });
      const key2 = createCacheKey({ template: "template.b" });

      expect(key1).not.toBe(key2);
    });

    it("creates different keys for different contexts", () => {
      const key1 = createCacheKey({ template: "t", context: { a: 1 } });
      const key2 = createCacheKey({ template: "t", context: { a: 2 } });

      expect(key1).not.toBe(key2);
    });

    it("includes pageUrl in key", () => {
      const key1 = createCacheKey({ template: "t", pageUrl: "/page1" });
      const key2 = createCacheKey({ template: "t", pageUrl: "/page2" });

      expect(key1).not.toBe(key2);
    });
  });

  describe("createMockFetch", () => {
    it("returns successful response by default", async () => {
      const fetch = createMockFetch();
      const response = await fetch("http://test", {
        method: "POST",
        headers: {},
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.html).toBeDefined();
    });

    it("returns custom HTML", async () => {
      const fetch = createMockFetch({ html: "<custom>HTML</custom>" });
      const response = await fetch("http://test", {
        method: "POST",
        headers: {},
      });

      const data = await response.json();
      expect(data.html).toBe("<custom>HTML</custom>");
    });

    it("returns error when configured", async () => {
      const fetch = createMockFetch({ error: "Render failed" });
      const response = await fetch("http://test", {
        method: "POST",
        headers: {},
      });

      expect(response.ok).toBe(false);
      const data = await response.json();
      expect(data.error).toBe("Render failed");
    });

    it("fails for specified count then succeeds", async () => {
      const fetch = createMockFetch({ failCount: 2 });

      const r1 = await fetch("http://test", { method: "POST", headers: {} });
      const r2 = await fetch("http://test", { method: "POST", headers: {} });
      const r3 = await fetch("http://test", { method: "POST", headers: {} });

      expect(r1.ok).toBe(false);
      expect(r2.ok).toBe(false);
      expect(r3.ok).toBe(true);
    });
  });

  describe("OdooPreviewRenderer class", () => {
    let renderer: OdooPreviewRenderer;

    beforeEach(() => {
      renderer = createMockPreviewRenderer(
        { enableCache: false },
        { html: "<div>Test</div>" }
      );
    });

    describe("render", () => {
      it("returns rendered HTML", async () => {
        const result = await renderer.render({ template: "test" });

        expect(result.success).toBe(true);
        expect(result.html).toBe("<div>Test</div>");
      });

      it("includes render time", async () => {
        const result = await renderer.render({ template: "test" });

        expect(result.renderTime).toBeGreaterThan(0);
      });

      it("includes request ID", async () => {
        const result = await renderer.render({
          template: "test",
          requestId: "custom-id",
        });

        expect(result.requestId).toBe("custom-id");
      });

      it("generates request ID if not provided", async () => {
        const result = await renderer.render({ template: "test" });

        expect(result.requestId).toMatch(/^req-/);
      });

      it("emits render:start event", async () => {
        const events: RenderEvent[] = [];
        renderer.onEvent((e) => events.push(e));

        await renderer.render({ template: "test" });

        expect(events.some((e) => e.type === "render:start")).toBe(true);
      });

      it("emits render:success event", async () => {
        const events: RenderEvent[] = [];
        renderer.onEvent((e) => events.push(e));

        await renderer.render({ template: "test" });

        expect(events.some((e) => e.type === "render:success")).toBe(true);
      });

      it("emits render:failure event on error", async () => {
        renderer = createMockPreviewRenderer(
          { enableCache: false, retryOnError: false },
          { error: "Render failed" }
        );
        const events: RenderEvent[] = [];
        renderer.onEvent((e) => events.push(e));

        await renderer.render({ template: "test" });

        expect(events.some((e) => e.type === "render:failure")).toBe(true);
      });

      it("returns error result on failure", async () => {
        renderer = createMockPreviewRenderer(
          { enableCache: false, retryOnError: false },
          { error: "Render failed" }
        );

        const result = await renderer.render({ template: "test" });

        expect(result.success).toBe(false);
        expect(result.error).toBe("Render failed");
        expect(result.html).toBe("");
      });
    });

    describe("caching", () => {
      beforeEach(() => {
        renderer = createMockPreviewRenderer(
          { enableCache: true, cacheTTL: 60000 },
          { html: "<div>Cached</div>" }
        );
      });

      it("caches successful renders", async () => {
        const events: RenderEvent[] = [];
        renderer.onEvent((e) => events.push(e));

        await renderer.render({ template: "test" });
        await renderer.render({ template: "test" });

        expect(events.filter((e) => e.type === "cache:hit").length).toBe(1);
      });

      it("returns cached result", async () => {
        const result1 = await renderer.render({ template: "test" });
        const result2 = await renderer.render({ template: "test" });

        expect(result2.cached).toBe(true);
        expect(result2.html).toBe(result1.html);
      });

      it("emits cache:miss on first request", async () => {
        const events: RenderEvent[] = [];
        renderer.onEvent((e) => events.push(e));

        await renderer.render({ template: "test" });

        expect(events.some((e) => e.type === "cache:miss")).toBe(true);
      });

      it("emits render:cached when serving from cache", async () => {
        const events: RenderEvent[] = [];
        renderer.onEvent((e) => events.push(e));

        await renderer.render({ template: "test" });
        await renderer.render({ template: "test" });

        expect(events.some((e) => e.type === "render:cached")).toBe(true);
      });

      it("clearCache removes all entries", async () => {
        await renderer.render({ template: "test" });
        renderer.clearCache();

        const events: RenderEvent[] = [];
        renderer.onEvent((e) => events.push(e));
        await renderer.render({ template: "test" });

        expect(events.some((e) => e.type === "cache:miss")).toBe(true);
      });

      it("invalidateTemplate removes matching entries", async () => {
        await renderer.render({ template: "test.a" });
        await renderer.render({ template: "test.b" });

        renderer.invalidateTemplate("test.a");

        const events: RenderEvent[] = [];
        renderer.onEvent((e) => events.push(e));

        await renderer.render({ template: "test.a" });
        await renderer.render({ template: "test.b" });

        const misses = events.filter((e) => e.type === "cache:miss");
        const hits = events.filter((e) => e.type === "cache:hit");

        expect(misses.length).toBe(1);
        expect(hits.length).toBe(1);
      });

      it("respects maxCacheSize", async () => {
        renderer = createMockPreviewRenderer(
          { enableCache: true, maxCacheSize: 2 },
          { html: "<div>Test</div>" }
        );

        await renderer.render({ template: "a" });
        await renderer.render({ template: "b" });
        await renderer.render({ template: "c" });

        const stats = renderer.getCacheStats();
        expect(stats.size).toBeLessThanOrEqual(2);
      });
    });

    describe("retry logic", () => {
      it("retries on failure", async () => {
        renderer = createMockPreviewRenderer(
          { enableCache: false, retryOnError: true, maxRetries: 2, retryDelay: 10 },
          { failCount: 1 }
        );

        const result = await renderer.render({ template: "test" });

        expect(result.success).toBe(true);
      });

      it("respects maxRetries", async () => {
        renderer = createMockPreviewRenderer(
          { enableCache: false, retryOnError: true, maxRetries: 1, retryDelay: 10 },
          { failCount: 5 }
        );

        const result = await renderer.render({ template: "test" });

        expect(result.success).toBe(false);
      });

      it("does not retry when disabled", async () => {
        const fetchMock = vi.fn()
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => ({ error: "Error" }),
          })
          .mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ html: "<div>OK</div>" }),
          });

        renderer = createPreviewRenderer(
          { enableCache: false, retryOnError: false },
          fetchMock
        );

        const result = await renderer.render({ template: "test" });

        expect(result.success).toBe(false);
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });
    });

    describe("renderPage", () => {
      it("renders page by URL", async () => {
        const result = await renderer.renderPage("/contactus");

        expect(result.success).toBe(true);
        expect(result.template).toBe("page");
      });

      it("passes options through", async () => {
        const result = await renderer.renderPage("/test", {
          includeAssets: false,
          requestId: "page-request",
        });

        expect(result.requestId).toBe("page-request");
      });
    });

    describe("renderTemplate", () => {
      it("renders template with context", async () => {
        const result = await renderer.renderTemplate(
          "website.s_banner",
          { title: "Hello" }
        );

        expect(result.success).toBe(true);
        expect(result.template).toBe("website.s_banner");
      });
    });

    describe("renderSnippet", () => {
      it("renders snippet by XML ID", async () => {
        const result = await renderer.renderSnippet("website.s_cover");

        expect(result.success).toBe(true);
        expect(result.template).toBe("snippet:website.s_cover");
      });
    });

    describe("event callbacks", () => {
      it("registers callback", async () => {
        const callback = vi.fn();
        renderer.onEvent(callback);

        await renderer.render({ template: "test" });

        expect(callback).toHaveBeenCalled();
      });

      it("removes callback", async () => {
        const callback = vi.fn();
        renderer.onEvent(callback);
        renderer.offEvent(callback);

        await renderer.render({ template: "test" });

        expect(callback).not.toHaveBeenCalled();
      });

      it("handles callback errors gracefully", async () => {
        renderer.onEvent(() => {
          throw new Error("Callback error");
        });

        await expect(renderer.render({ template: "test" })).resolves.not.toThrow();
      });
    });

    describe("config management", () => {
      it("updates configuration", () => {
        renderer.updateConfig({ timeout: 20000 });

        const config = renderer.getConfig();
        expect(config.timeout).toBe(20000);
      });

      it("returns config copy", () => {
        const config1 = renderer.getConfig();
        const config2 = renderer.getConfig();

        expect(config1).not.toBe(config2);
      });
    });

    describe("isReady", () => {
      it("returns true when sidecar responds", async () => {
        renderer = createMockPreviewRenderer({}, { html: "<ok>" });

        const ready = await renderer.isReady();

        expect(ready).toBe(true);
      });

      it("returns false when sidecar fails", async () => {
        renderer = createMockPreviewRenderer(
          { retryOnError: false },
          { error: "Not available" }
        );

        const ready = await renderer.isReady();

        expect(ready).toBe(false);
      });
    });

    describe("deduplication", () => {
      it("deduplicates concurrent requests for same template", async () => {
        const fetchMock = vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return {
            ok: true,
            status: 200,
            json: async () => ({ html: "<div>Test</div>" }),
          };
        });

        renderer = createPreviewRenderer({ enableCache: false }, fetchMock);

        // Make concurrent requests
        const [result1, result2] = await Promise.all([
          renderer.render({ template: "test" }),
          renderer.render({ template: "test" }),
        ]);

        // Both should succeed
        expect(result1.success).toBe(true);
        expect(result2.success).toBe(true);

        // But only one fetch should have been made
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("factory functions", () => {
    it("createPreviewRenderer creates instance", () => {
      const renderer = createPreviewRenderer();

      expect(renderer).toBeInstanceOf(OdooPreviewRenderer);
    });

    it("createMockPreviewRenderer creates instance with mock fetch", async () => {
      const renderer = createMockPreviewRenderer({}, { html: "<mock>" });

      const result = await renderer.render({ template: "test" });

      expect(result.html).toBe("<mock>");
    });
  });
});
