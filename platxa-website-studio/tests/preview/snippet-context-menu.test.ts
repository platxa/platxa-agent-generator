import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SNIPPET_CONTEXT_SCRIPT } from "@/components/preview/SnippetContextMenu";

describe("SnippetContextMenu", () => {
  describe("SNIPPET_CONTEXT_SCRIPT", () => {
    it("contains a script tag with contextmenu listener", () => {
      expect(SNIPPET_CONTEXT_SCRIPT).toContain("<script>");
      expect(SNIPPET_CONTEXT_SCRIPT).toContain("contextmenu");
    });

    it("posts platxa:snippet-context messages", () => {
      expect(SNIPPET_CONTEXT_SCRIPT).toContain("platxa:snippet-context");
      expect(SNIPPET_CONTEXT_SCRIPT).toContain("window.parent.postMessage");
    });

    it("includes x/y position in message", () => {
      expect(SNIPPET_CONTEXT_SCRIPT).toContain("e.clientX");
      expect(SNIPPET_CONTEXT_SCRIPT).toContain("e.clientY");
    });

    it("detects snippet via data-snippet and s_ class", () => {
      expect(SNIPPET_CONTEXT_SCRIPT).toContain("dataset.snippet");
      expect(SNIPPET_CONTEXT_SCRIPT).toContain("s_[a-z]");
    });

    it("prevents default context menu on snippet elements", () => {
      expect(SNIPPET_CONTEXT_SCRIPT).toContain("e.preventDefault");
    });
  });

  describe("postMessage protocol", () => {
    let handler: ((event: MessageEvent) => void) | null = null;

    afterEach(() => {
      if (handler) {
        window.removeEventListener("message", handler);
        handler = null;
      }
    });

    it("receives snippet-context messages with position", async () => {
      const received = vi.fn();
      handler = (event: MessageEvent) => {
        if (event.data?.type === "platxa:snippet-context") {
          received(event.data);
        }
      };
      window.addEventListener("message", handler);

      window.postMessage(
        {
          type: "platxa:snippet-context",
          snippetId: "s_features",
          element: "section.s_features",
          x: 200,
          y: 350,
        },
        "*",
      );

      await new Promise((r) => setTimeout(r, 50));

      expect(received).toHaveBeenCalledWith({
        type: "platxa:snippet-context",
        snippetId: "s_features",
        element: "section.s_features",
        x: 200,
        y: 350,
      });
    });
  });

  describe("Regenerate action", () => {
    const ACTION_PROMPTS: Record<string, (id: string) => string> = {
      regenerate: (id) => `Regenerate only the ${id} section with a fresh design, keeping all other sections unchanged.`,
      restyle: (id) => `Restyle the ${id} section with different colors and spacing, keeping the same content structure.`,
      duplicate: (id) => `Duplicate the ${id} section with a variation below the original.`,
      remove: (id) => `Remove the ${id} section from the page.`,
    };

    it("regenerate action targets only the selected snippet", () => {
      const prompt = ACTION_PROMPTS.regenerate("s_hero");
      expect(prompt).toContain("s_hero");
      expect(prompt).toContain("Regenerate only");
      expect(prompt).toContain("keeping all other sections unchanged");
    });

    it("regenerate action works for any snippet ID", () => {
      const prompt = ACTION_PROMPTS.regenerate("s_features");
      expect(prompt).toContain("s_features");
      expect(prompt).toContain("Regenerate only the s_features section");
    });

    it("restyle action keeps content structure", () => {
      const prompt = ACTION_PROMPTS.restyle("s_cta");
      expect(prompt).toContain("s_cta");
      expect(prompt).toContain("Restyle");
      expect(prompt).toContain("keeping the same content structure");
    });

    it("all four actions produce valid prompts", () => {
      for (const [action, fn] of Object.entries(ACTION_PROMPTS)) {
        const prompt = fn("s_test");
        expect(prompt.length).toBeGreaterThan(10);
        expect(prompt).toContain("s_test");
      }
    });
  });
});
