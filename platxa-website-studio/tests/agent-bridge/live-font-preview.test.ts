import { describe, it, expect } from "vitest";
import {
  buildGoogleFontsUrl,
  buildMultiFontUrl,
  buildLinkTag,
  createFontPreviewState,
  applyFontToken,
  markFontLoaded,
  markFontError,
  getLoadingFonts,
  getLoadedFonts,
  getCssOverrideString,
  getTrackedFamilies,
  isFontLoaded,
} from "@/lib/agent-bridge/live-font-preview";
import type { FontToken } from "@/lib/agent-bridge/live-font-preview";

describe("Live Font Preview", () => {
  describe("buildGoogleFontsUrl", () => {
    it("builds URL with default weights", () => {
      const url = buildGoogleFontsUrl("Roboto");
      expect(url).toBe("https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap");
    });

    it("encodes spaces in font name", () => {
      const url = buildGoogleFontsUrl("Open Sans");
      expect(url).toContain("family=Open+Sans");
    });

    it("sorts weights", () => {
      const url = buildGoogleFontsUrl("Roboto", [700, 300, 400]);
      expect(url).toContain("wght@300;400;700");
    });

    it("handles single weight", () => {
      const url = buildGoogleFontsUrl("Roboto", [400]);
      expect(url).toContain("wght@400");
    });
  });

  describe("buildMultiFontUrl", () => {
    it("combines multiple families", () => {
      const url = buildMultiFontUrl([
        { family: "Roboto", weights: [400, 700] },
        { family: "Open Sans", weights: [300, 600] },
      ]);
      expect(url).toContain("family=Roboto:wght@400;700");
      expect(url).toContain("family=Open+Sans:wght@300;600");
      expect(url).toContain("display=swap");
    });
  });

  describe("buildLinkTag", () => {
    it("generates link tag without id", () => {
      const tag = buildLinkTag("https://example.com/font.css");
      expect(tag).toBe('<link rel="stylesheet" href="https://example.com/font.css">');
    });

    it("generates link tag with id", () => {
      const tag = buildLinkTag("https://example.com/font.css", "font-heading");
      expect(tag).toContain('id="font-heading"');
    });
  });

  describe("applyFontToken", () => {
    const token: FontToken = {
      name: "heading",
      family: "Playfair Display",
      weights: [400, 700],
      cssVariable: "--font-heading",
    };

    it("returns link href and CSS variables", () => {
      const state = createFontPreviewState();
      const result = applyFontToken(state, token);
      expect(result.linkHref).toContain("Playfair+Display");
      expect(result.cssVariables["--font-heading"]).toBe('"Playfair Display", sans-serif');
      expect(result.alreadyLoaded).toBe(false);
    });

    it("sets font to loading status", () => {
      const state = createFontPreviewState();
      const result = applyFontToken(state, token);
      expect(result.state.fonts.get("Playfair Display")!.status).toBe("loading");
    });

    it("detects already loaded font", () => {
      let state = createFontPreviewState();
      const r1 = applyFontToken(state, token);
      state = markFontLoaded(r1.state, "Playfair Display");
      const r2 = applyFontToken(state, token);
      expect(r2.alreadyLoaded).toBe(true);
    });

    it("stores CSS override", () => {
      const state = createFontPreviewState();
      const result = applyFontToken(state, token);
      expect(result.state.cssOverrides.get("--font-heading")).toBe('"Playfair Display", sans-serif');
    });
  });

  describe("markFontLoaded / markFontError", () => {
    it("marks font as loaded", () => {
      let state = createFontPreviewState();
      const result = applyFontToken(state, {
        name: "body", family: "Roboto", weights: [400], cssVariable: "--font-body",
      });
      state = markFontLoaded(result.state, "Roboto");
      expect(state.fonts.get("Roboto")!.status).toBe("loaded");
    });

    it("marks font as error", () => {
      let state = createFontPreviewState();
      const result = applyFontToken(state, {
        name: "body", family: "Roboto", weights: [400], cssVariable: "--font-body",
      });
      state = markFontError(result.state, "Roboto", "Network error");
      expect(state.fonts.get("Roboto")!.status).toBe("error");
      expect(state.fonts.get("Roboto")!.error).toBe("Network error");
    });

    it("no-ops for unknown family", () => {
      const state = createFontPreviewState();
      const updated = markFontLoaded(state, "Unknown");
      expect(updated.fonts.size).toBe(0);
    });
  });

  describe("queries", () => {
    it("getLoadingFonts returns only loading", () => {
      let state = createFontPreviewState();
      state = applyFontToken(state, {
        name: "h", family: "Roboto", weights: [400], cssVariable: "--fh",
      }).state;
      state = applyFontToken(state, {
        name: "b", family: "Open Sans", weights: [400], cssVariable: "--fb",
      }).state;
      state = markFontLoaded(state, "Roboto");
      expect(getLoadingFonts(state)).toHaveLength(1);
      expect(getLoadingFonts(state)[0].family).toBe("Open Sans");
    });

    it("getLoadedFonts returns only loaded", () => {
      let state = createFontPreviewState();
      state = applyFontToken(state, {
        name: "h", family: "Roboto", weights: [400], cssVariable: "--fh",
      }).state;
      state = markFontLoaded(state, "Roboto");
      expect(getLoadedFonts(state)).toHaveLength(1);
    });

    it("getCssOverrideString formats variables", () => {
      let state = createFontPreviewState();
      state = applyFontToken(state, {
        name: "h", family: "Roboto", weights: [400], cssVariable: "--font-heading",
      }).state;
      const css = getCssOverrideString(state);
      expect(css).toContain("--font-heading:");
      expect(css).toContain('"Roboto"');
    });

    it("getCssOverrideString returns empty for no overrides", () => {
      expect(getCssOverrideString(createFontPreviewState())).toBe("");
    });

    it("getTrackedFamilies lists all fonts", () => {
      let state = createFontPreviewState();
      state = applyFontToken(state, {
        name: "h", family: "Roboto", weights: [400], cssVariable: "--fh",
      }).state;
      state = applyFontToken(state, {
        name: "b", family: "Lato", weights: [400], cssVariable: "--fb",
      }).state;
      expect(getTrackedFamilies(state).sort()).toEqual(["Lato", "Roboto"]);
    });

    it("isFontLoaded returns correct status", () => {
      let state = createFontPreviewState();
      state = applyFontToken(state, {
        name: "h", family: "Roboto", weights: [400], cssVariable: "--fh",
      }).state;
      expect(isFontLoaded(state, "Roboto")).toBe(false);
      state = markFontLoaded(state, "Roboto");
      expect(isFontLoaded(state, "Roboto")).toBe(true);
    });

    it("isFontLoaded returns false for unknown", () => {
      expect(isFontLoaded(createFontPreviewState(), "Unknown")).toBe(false);
    });
  });

  describe("immutability", () => {
    it("does not mutate original state", () => {
      const state = createFontPreviewState();
      const result = applyFontToken(state, {
        name: "h", family: "Roboto", weights: [400], cssVariable: "--fh",
      });
      expect(state.fonts.size).toBe(0);
      expect(result.state.fonts.size).toBe(1);
    });
  });
});
