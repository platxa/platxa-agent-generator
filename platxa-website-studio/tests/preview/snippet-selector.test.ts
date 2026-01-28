import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SNIPPET_SELECT_SCRIPT } from "@/components/preview/SnippetSelector";

describe("SnippetSelector", () => {
  describe("SNIPPET_SELECT_SCRIPT", () => {
    it("contains a script tag with snippet detection logic", () => {
      expect(SNIPPET_SELECT_SCRIPT).toContain("<script>");
      expect(SNIPPET_SELECT_SCRIPT).toContain("</script>");
      expect(SNIPPET_SELECT_SCRIPT).toContain("platxa:snippet-select");
    });

    it("detects data-snippet attribute", () => {
      expect(SNIPPET_SELECT_SCRIPT).toContain("dataset.snippet");
    });

    it("detects s_ class prefix pattern", () => {
      expect(SNIPPET_SELECT_SCRIPT).toContain("s_[a-z]");
    });

    it("includes highlight styling", () => {
      expect(SNIPPET_SELECT_SCRIPT).toContain("data-platxa-selected");
      expect(SNIPPET_SELECT_SCRIPT).toContain("outline");
      expect(SNIPPET_SELECT_SCRIPT).toContain("#7c3aed");
    });

    it("posts message to parent window", () => {
      expect(SNIPPET_SELECT_SCRIPT).toContain("window.parent.postMessage");
    });
  });

  describe("postMessage protocol", () => {
    let handler: ((event: MessageEvent) => void) | null = null;

    beforeEach(() => {
      handler = null;
    });

    afterEach(() => {
      if (handler) {
        window.removeEventListener("message", handler);
      }
    });

    it("receives snippet-select messages with correct shape", async () => {
      const received = vi.fn();
      handler = (event: MessageEvent) => {
        if (event.data?.type === "platxa:snippet-select") {
          received(event.data);
        }
      };
      window.addEventListener("message", handler);

      // Simulate iframe posting a message
      window.postMessage(
        {
          type: "platxa:snippet-select",
          snippetId: "s_hero",
          element: "section.s_hero.pt48.pb32",
        },
        "*",
      );

      // postMessage is async
      await new Promise((r) => setTimeout(r, 50));

      expect(received).toHaveBeenCalledWith({
        type: "platxa:snippet-select",
        snippetId: "s_hero",
        element: "section.s_hero.pt48.pb32",
      });
    });

    it("handles deselection (empty snippetId)", async () => {
      const received = vi.fn();
      handler = (event: MessageEvent) => {
        if (event.data?.type === "platxa:snippet-select") {
          received(event.data);
        }
      };
      window.addEventListener("message", handler);

      window.postMessage(
        { type: "platxa:snippet-select", snippetId: "", element: "" },
        "*",
      );

      await new Promise((r) => setTimeout(r, 50));

      expect(received).toHaveBeenCalledWith({
        type: "platxa:snippet-select",
        snippetId: "",
        element: "",
      });
    });
  });
});
