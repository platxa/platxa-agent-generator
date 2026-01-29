import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  RegenerateSectionController,
  createRegenerateSection,
  extractSectionHtml,
  extractRegenerateContext,
  REGENERATE_SECTION_SCRIPT,
  type RegenerateRequest,
  type RegenerateResult,
  type RegenerateSectionContext,
} from "@/lib/preview/regenerate-section";
import type { SelectedElement } from "@/lib/preview/select-mode";

describe("RegenerateSectionController", () => {
  let controller: RegenerateSectionController;

  beforeEach(() => {
    controller = new RegenerateSectionController();
  });

  describe("state management", () => {
    it("starts enabled by default", () => {
      expect(controller.isEnabled()).toBe(true);
    });

    it("disables regeneration", () => {
      controller.disable();
      expect(controller.isEnabled()).toBe(false);
    });

    it("enables regeneration", () => {
      controller.disable();
      controller.enable();
      expect(controller.isEnabled()).toBe(true);
    });

    it("tracks no pending requests initially", () => {
      expect(controller.hasPendingRequests()).toBe(false);
      expect(controller.getPendingCount()).toBe(0);
    });
  });

  describe("trigger", () => {
    const mockElement: SelectedElement = {
      snippetId: "snippet-0",
      elementId: "el-0",
      tagName: "section",
      classes: ["s_banner", "pt-5"],
      bounds: new DOMRect(0, 0, 800, 400),
      selector: '[data-snippet-id="snippet-0"]',
    };

    it("triggers regeneration for selected element", () => {
      const callback = vi.fn();
      controller.onRegenerate(callback);

      const requestId = controller.trigger(mockElement);

      expect(requestId).not.toBeNull();
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId,
          context: expect.objectContaining({
            snippetId: "snippet-0",
            snippetType: "s_banner",
          }),
        })
      );
    });

    it("returns null when disabled", () => {
      controller.disable();
      const requestId = controller.trigger(mockElement);
      expect(requestId).toBeNull();
    });

    it("returns null when element has no snippetId", () => {
      const noSnippetElement: SelectedElement = {
        ...mockElement,
        snippetId: null,
      };
      const requestId = controller.trigger(noSnippetElement);
      expect(requestId).toBeNull();
    });

    it("includes HTML when provided", () => {
      const callback = vi.fn();
      controller.onRegenerate(callback);

      controller.trigger(mockElement, "<section>Test HTML</section>");

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            currentHtml: "<section>Test HTML</section>",
          }),
        })
      );
    });

    it("includes instruction when provided", () => {
      const callback = vi.fn();
      controller.onRegenerate(callback);

      controller.trigger(mockElement, undefined, "Make it more colorful");

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            instruction: "Make it more colorful",
          }),
        })
      );
    });

    it("tracks pending request", () => {
      controller.trigger(mockElement);
      expect(controller.hasPendingRequests()).toBe(true);
      expect(controller.getPendingCount()).toBe(1);
    });

    it("generates unique request IDs", () => {
      const id1 = controller.trigger(mockElement);
      const id2 = controller.trigger(mockElement);

      expect(id1).not.toBe(id2);
    });
  });

  describe("triggerWithContext", () => {
    const mockContext: RegenerateSectionContext = {
      snippetId: "snippet-5",
      snippetType: "s_features",
      currentHtml: "<section>Features</section>",
      bounds: { top: 100, left: 0, width: 1200, height: 600 },
      selector: '[data-snippet-id="snippet-5"]',
    };

    it("triggers with pre-built context", () => {
      const callback = vi.fn();
      controller.onRegenerate(callback);

      const requestId = controller.triggerWithContext(mockContext);

      expect(requestId).not.toBeNull();
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          context: mockContext,
        })
      );
    });

    it("adds instruction to context", () => {
      const callback = vi.fn();
      controller.onRegenerate(callback);

      controller.triggerWithContext(mockContext, "Add more icons");

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            ...mockContext,
            instruction: "Add more icons",
          }),
        })
      );
    });
  });

  describe("complete", () => {
    const mockElement: SelectedElement = {
      snippetId: "snippet-1",
      elementId: null,
      tagName: "section",
      classes: ["s_text_block"],
      bounds: new DOMRect(0, 500, 800, 200),
      selector: '[data-snippet-id="snippet-1"]',
    };

    it("completes a pending request with success", () => {
      const resultCallback = vi.fn();
      controller.onResult(resultCallback);

      const requestId = controller.trigger(mockElement)!;
      controller.complete(requestId, {
        success: true,
        newHtml: "<section>New Content</section>",
      });

      expect(resultCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          newHtml: "<section>New Content</section>",
          requestId,
          durationMs: expect.any(Number),
        })
      );
    });

    it("completes a pending request with error", () => {
      const resultCallback = vi.fn();
      controller.onResult(resultCallback);

      const requestId = controller.trigger(mockElement)!;
      controller.complete(requestId, {
        success: false,
        error: "Agent failed",
      });

      expect(resultCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "Agent failed",
          requestId,
        })
      );
    });

    it("removes request from pending after completion", () => {
      const requestId = controller.trigger(mockElement)!;
      expect(controller.hasPendingRequests()).toBe(true);

      controller.complete(requestId, { success: true });
      expect(controller.hasPendingRequests()).toBe(false);
    });

    it("ignores unknown request IDs", () => {
      const resultCallback = vi.fn();
      controller.onResult(resultCallback);

      controller.complete("unknown-id", { success: true });

      expect(resultCallback).not.toHaveBeenCalled();
    });
  });

  describe("cancel", () => {
    const mockElement: SelectedElement = {
      snippetId: "snippet-2",
      elementId: null,
      tagName: "section",
      classes: ["s_cover"],
      bounds: new DOMRect(0, 0, 1920, 1080),
      selector: '[data-snippet-id="snippet-2"]',
    };

    it("cancels a pending request", () => {
      const resultCallback = vi.fn();
      controller.onResult(resultCallback);

      const requestId = controller.trigger(mockElement)!;
      controller.cancel(requestId);

      expect(resultCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "Cancelled",
          requestId,
        })
      );
    });

    it("removes cancelled request from pending", () => {
      const requestId = controller.trigger(mockElement)!;
      controller.cancel(requestId);

      expect(controller.hasPendingRequests()).toBe(false);
    });

    it("cancelAll cancels all pending requests", () => {
      controller.trigger(mockElement);
      controller.trigger(mockElement);
      controller.trigger(mockElement);

      expect(controller.getPendingCount()).toBe(3);

      controller.cancelAll();

      expect(controller.getPendingCount()).toBe(0);
    });
  });

  describe("callbacks", () => {
    const mockElement: SelectedElement = {
      snippetId: "snippet-3",
      elementId: null,
      tagName: "section",
      classes: ["s_gallery"],
      bounds: new DOMRect(0, 800, 800, 600),
      selector: '[data-snippet-id="snippet-3"]',
    };

    it("allows unsubscribing from regenerate callbacks", () => {
      const callback = vi.fn();
      const unsubscribe = controller.onRegenerate(callback);

      unsubscribe();
      controller.trigger(mockElement);

      expect(callback).not.toHaveBeenCalled();
    });

    it("allows unsubscribing from result callbacks", () => {
      const callback = vi.fn();
      const unsubscribe = controller.onResult(callback);

      unsubscribe();
      const requestId = controller.trigger(mockElement)!;
      controller.complete(requestId, { success: true });

      expect(callback).not.toHaveBeenCalled();
    });

    it("handles callback errors gracefully", () => {
      const errorCallback = vi.fn(() => {
        throw new Error("Callback error");
      });
      const normalCallback = vi.fn();

      controller.onRegenerate(errorCallback);
      controller.onRegenerate(normalCallback);

      expect(() => controller.trigger(mockElement)).not.toThrow();
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe("configuration", () => {
    it("uses default options", () => {
      expect(controller.getMessageType()).toBe("platxa:regenerate-section");
      expect(controller.shouldExtractHtml()).toBe(true);
      expect(controller.getMaxHtmlLength()).toBe(50000);
    });

    it("accepts custom options", () => {
      const custom = new RegenerateSectionController({
        messageType: "custom:regenerate",
        extractHtml: false,
        maxHtmlLength: 10000,
      });

      expect(custom.getMessageType()).toBe("custom:regenerate");
      expect(custom.shouldExtractHtml()).toBe(false);
      expect(custom.getMaxHtmlLength()).toBe(10000);
    });
  });
});

describe("createRegenerateSection", () => {
  it("creates a controller with default options", () => {
    const controller = createRegenerateSection();
    expect(controller.isEnabled()).toBe(true);
  });

  it("creates a disabled controller when specified", () => {
    const controller = createRegenerateSection({ initiallyEnabled: false });
    expect(controller.isEnabled()).toBe(false);
  });

  it("accepts custom options", () => {
    const controller = createRegenerateSection({
      maxHtmlLength: 25000,
    });

    expect(controller.getMaxHtmlLength()).toBe(25000);
  });
});

describe("extractSectionHtml", () => {
  it("extracts HTML from element", () => {
    const el = document.createElement("section");
    el.innerHTML = "<h1>Title</h1><p>Content</p>";

    const html = extractSectionHtml(el);

    expect(html).toContain("<section>");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("</section>");
  });

  it("truncates HTML exceeding max length", () => {
    const el = document.createElement("section");
    el.innerHTML = "x".repeat(1000);

    const html = extractSectionHtml(el, 100);

    expect(html.length).toBeLessThanOrEqual(120); // 100 + truncation comment
    expect(html).toContain("<!-- truncated -->");
  });

  it("does not truncate HTML within max length", () => {
    const el = document.createElement("section");
    el.innerHTML = "<p>Short content</p>";

    const html = extractSectionHtml(el, 1000);

    expect(html).not.toContain("<!-- truncated -->");
  });
});

describe("extractRegenerateContext", () => {
  it("extracts context from element with snippet ID", () => {
    const el = document.createElement("section");
    el.setAttribute("data-snippet-id", "snippet-10");
    el.setAttribute("data-snippet", "s_banner");
    el.className = "s_banner pt-5 pb-5";
    el.innerHTML = "<h1>Banner</h1>";
    document.body.appendChild(el);

    const context = extractRegenerateContext(el);

    expect(context).not.toBeNull();
    expect(context!.snippetId).toBe("snippet-10");
    expect(context!.snippetType).toBe("s_banner");
    expect(context!.currentHtml).toContain("<section");
    expect(context!.selector).toBe('[data-snippet-id="snippet-10"]');
    expect(context!.bounds).toHaveProperty("top");
    expect(context!.bounds).toHaveProperty("width");

    document.body.removeChild(el);
  });

  it("returns null for element without snippet ID", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    const context = extractRegenerateContext(el);

    expect(context).toBeNull();

    document.body.removeChild(el);
  });

  it("includes instruction when provided", () => {
    const el = document.createElement("section");
    el.setAttribute("data-snippet-id", "snippet-11");
    document.body.appendChild(el);

    const context = extractRegenerateContext(el, {
      instruction: "Make it bold",
    });

    expect(context!.instruction).toBe("Make it bold");

    document.body.removeChild(el);
  });

  it("respects maxHtmlLength option", () => {
    const el = document.createElement("section");
    el.setAttribute("data-snippet-id", "snippet-12");
    el.innerHTML = "x".repeat(1000);
    document.body.appendChild(el);

    const context = extractRegenerateContext(el, {
      maxHtmlLength: 100,
    });

    expect(context!.currentHtml).toContain("<!-- truncated -->");

    document.body.removeChild(el);
  });
});

describe("REGENERATE_SECTION_SCRIPT", () => {
  it("contains script tags", () => {
    expect(REGENERATE_SECTION_SCRIPT).toContain("<script>");
    expect(REGENERATE_SECTION_SCRIPT).toContain("</script>");
  });

  it("handles extract request", () => {
    expect(REGENERATE_SECTION_SCRIPT).toContain("platxa:regenerate-extract");
  });

  it("posts context to parent", () => {
    expect(REGENERATE_SECTION_SCRIPT).toContain("platxa:regenerate-context");
    expect(REGENERATE_SECTION_SCRIPT).toContain("postMessage");
  });

  it("handles configuration", () => {
    expect(REGENERATE_SECTION_SCRIPT).toContain("platxa:regenerate-config");
    expect(REGENERATE_SECTION_SCRIPT).toContain("maxHtmlLength");
  });

  it("sends ready message", () => {
    expect(REGENERATE_SECTION_SCRIPT).toContain("platxa:regenerate-ready");
  });

  it("extracts snippet type from classes", () => {
    expect(REGENERATE_SECTION_SCRIPT).toContain("startsWith('s_')");
  });
});

describe("verification: button triggers agent with context for selected section", () => {
  it("trigger provides context with snippetId and bounds", () => {
    const controller = createRegenerateSection();
    const requests: RegenerateRequest[] = [];

    controller.onRegenerate((req) => { requests.push(req); });

    const mockElement: SelectedElement = {
      snippetId: "snippet-verify",
      elementId: null,
      tagName: "section",
      classes: ["s_banner"],
      bounds: new DOMRect(0, 100, 800, 400),
      selector: '[data-snippet-id="snippet-verify"]',
    };

    controller.trigger(mockElement, "<section>Current HTML</section>");

    expect(requests).toHaveLength(1);

    const context = requests[0].context;
    expect(context.snippetId).toBe("snippet-verify");
    expect(context.snippetType).toBe("s_banner");
    expect(context.currentHtml).toBe("<section>Current HTML</section>");
    expect(context.bounds).toEqual({
      top: 100,
      left: 0,
      width: 800,
      height: 400,
    });
    expect(context.selector).toBe('[data-snippet-id="snippet-verify"]');
  });

  it("agent can complete regeneration with new HTML", () => {
    const controller = createRegenerateSection();
    const results: RegenerateResult[] = [];

    controller.onResult((res) => results.push(res));

    const mockElement: SelectedElement = {
      snippetId: "snippet-complete",
      elementId: null,
      tagName: "section",
      classes: ["s_features"],
      bounds: new DOMRect(0, 500, 800, 300),
      selector: '[data-snippet-id="snippet-complete"]',
    };

    const requestId = controller.trigger(mockElement)!;

    // Simulate agent completing the regeneration
    controller.complete(requestId, {
      success: true,
      newHtml: "<section>Regenerated Content</section>",
    });

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].newHtml).toBe("<section>Regenerated Content</section>");
    expect(results[0].requestId).toBe(requestId);
  });
});
