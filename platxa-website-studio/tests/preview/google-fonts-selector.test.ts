/**
 * Tests for GoogleFontsSelector — Font selector with live Google Fonts preview.
 *
 * Feature #80: Add font selector with live Google Fonts preview
 * Verification: Dropdown lists available fonts; selection updates typography instantly
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  GoogleFontsSelector,
  createFontSelector,
  GOOGLE_FONTS_CATALOG,
  GOOGLE_FONTS_SCRIPT,
  getFontsByCategory,
  getPopularFonts,
  findFont,
  getAllFontFamilies,
  buildFontUrl,
  buildCombinedFontUrl,
  type GoogleFont,
  type FontCategory,
  type FontWeight,
} from "../../lib/preview/google-fonts-selector";

// =============================================================================
// Helper: Mock iframe with postMessage
// =============================================================================

interface MockIframe extends HTMLIFrameElement {
  messages: unknown[];
  simulateFontLoaded: (family: string) => void;
  simulateFontError: (family: string, error: string) => void;
}

function createMockIframe(autoRespond = false): MockIframe {
  const messages: unknown[] = [];

  const iframe = {
    messages,
    contentWindow: {
      postMessage: vi.fn((message: unknown) => {
        messages.push(message);

        // Auto-respond to font load requests
        if (autoRespond && (message as any)?.type === "platxa:load-font") {
          const family = (message as any).family;
          // Simulate async response
          setTimeout(() => {
            window.dispatchEvent(
              new MessageEvent("message", {
                data: { type: "platxa:font-loaded", family },
              })
            );
          }, 0);
        }
      }),
    },
    simulateFontLoaded: (family: string) => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "platxa:font-loaded", family },
        })
      );
    },
    simulateFontError: (family: string, error: string) => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "platxa:font-error", family, error },
        })
      );
    },
  } as unknown as MockIframe;

  return iframe;
}

// =============================================================================
// Test: Font Catalog Functions
// =============================================================================

describe("GoogleFontsSelector — Font Catalog", () => {
  describe("GOOGLE_FONTS_CATALOG", () => {
    it("contains fonts", () => {
      expect(GOOGLE_FONTS_CATALOG.length).toBeGreaterThan(30);
    });

    it("has fonts in all categories", () => {
      const categories = new Set(GOOGLE_FONTS_CATALOG.map((f) => f.category));
      expect(categories).toContain("sans-serif");
      expect(categories).toContain("serif");
      expect(categories).toContain("display");
      expect(categories).toContain("handwriting");
      expect(categories).toContain("monospace");
    });

    it("includes popular fonts", () => {
      const popular = GOOGLE_FONTS_CATALOG.filter((f) => f.popular);
      expect(popular.length).toBeGreaterThan(5);
    });

    it("fonts have valid structure", () => {
      for (const font of GOOGLE_FONTS_CATALOG) {
        expect(font.family).toBeDefined();
        expect(typeof font.family).toBe("string");
        expect(font.category).toBeDefined();
        expect(font.weights).toBeDefined();
        expect(Array.isArray(font.weights)).toBe(true);
        expect(font.weights.length).toBeGreaterThan(0);
      }
    });
  });

  describe("getFontsByCategory", () => {
    it("returns fonts for sans-serif", () => {
      const fonts = getFontsByCategory("sans-serif");
      expect(fonts.length).toBeGreaterThan(0);
      expect(fonts.every((f) => f.category === "sans-serif")).toBe(true);
    });

    it("returns fonts for serif", () => {
      const fonts = getFontsByCategory("serif");
      expect(fonts.length).toBeGreaterThan(0);
      expect(fonts.every((f) => f.category === "serif")).toBe(true);
    });

    it("returns fonts for monospace", () => {
      const fonts = getFontsByCategory("monospace");
      expect(fonts.length).toBeGreaterThan(0);
      expect(fonts.every((f) => f.category === "monospace")).toBe(true);
    });
  });

  describe("getPopularFonts", () => {
    it("returns only popular fonts", () => {
      const popular = getPopularFonts();
      expect(popular.every((f) => f.popular === true)).toBe(true);
    });

    it("includes Inter and Roboto", () => {
      const popular = getPopularFonts();
      const families = popular.map((f) => f.family);
      expect(families).toContain("Inter");
      expect(families).toContain("Roboto");
    });
  });

  describe("findFont", () => {
    it("finds font by exact name", () => {
      const font = findFont("Inter");
      expect(font).toBeDefined();
      expect(font?.family).toBe("Inter");
    });

    it("finds font case-insensitively", () => {
      const font = findFont("INTER");
      expect(font).toBeDefined();
      expect(font?.family).toBe("Inter");
    });

    it("returns undefined for unknown font", () => {
      const font = findFont("NotARealFont");
      expect(font).toBeUndefined();
    });

    it("finds fonts with spaces in name", () => {
      const font = findFont("Open Sans");
      expect(font).toBeDefined();
      expect(font?.family).toBe("Open Sans");
    });
  });

  describe("getAllFontFamilies", () => {
    it("returns all font family names", () => {
      const families = getAllFontFamilies();
      expect(families.length).toBe(GOOGLE_FONTS_CATALOG.length);
      expect(families).toContain("Inter");
      expect(families).toContain("Playfair Display");
    });
  });
});

// =============================================================================
// Test: URL Builder Functions
// =============================================================================

describe("GoogleFontsSelector — URL Builder", () => {
  describe("buildFontUrl", () => {
    it("builds URL for single font", () => {
      const url = buildFontUrl("Inter", [400, 700]);
      expect(url).toBe(
        "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap"
      );
    });

    it("encodes spaces in font names", () => {
      const url = buildFontUrl("Open Sans", [400]);
      expect(url).toContain("Open+Sans");
    });

    it("sorts weights", () => {
      const url = buildFontUrl("Inter", [700, 400, 300]);
      expect(url).toContain("wght@300;400;700");
    });

    it("uses default weights when not specified", () => {
      const url = buildFontUrl("Inter");
      expect(url).toContain("wght@400;700");
    });
  });

  describe("buildCombinedFontUrl", () => {
    it("builds URL for multiple fonts", () => {
      const url = buildCombinedFontUrl([
        { family: "Inter", weights: [400, 700] },
        { family: "Playfair Display", weights: [400, 600] },
      ]);

      expect(url).toContain("family=Inter:wght@400;700");
      expect(url).toContain("family=Playfair+Display:wght@400;600");
      expect(url).toContain("&display=swap");
    });

    it("handles single font", () => {
      const url = buildCombinedFontUrl([{ family: "Inter", weights: [400] }]);
      expect(url).toContain("family=Inter:wght@400");
    });
  });
});

// =============================================================================
// Test: GoogleFontsSelector Class
// =============================================================================

describe("GoogleFontsSelector — Class", () => {
  let selector: GoogleFontsSelector;
  let iframe: MockIframe;

  beforeEach(() => {
    selector = new GoogleFontsSelector();
    iframe = createMockIframe(true); // Auto-respond to font loads
  });

  afterEach(() => {
    selector.dispose();
  });

  describe("constructor", () => {
    it("creates with default options", () => {
      const s = new GoogleFontsSelector();
      expect(s.getHeadingFont().family).toBe("Playfair Display");
      expect(s.getBodyFont().family).toBe("Inter");
      s.dispose();
    });

    it("creates with custom initial fonts", () => {
      const s = new GoogleFontsSelector({
        headingFont: "Montserrat",
        bodyFont: "Roboto",
      });
      expect(s.getHeadingFont().family).toBe("Montserrat");
      expect(s.getBodyFont().family).toBe("Roboto");
      s.dispose();
    });
  });

  describe("connect/disconnect", () => {
    it("connects to iframe", () => {
      selector.connect(iframe);
      expect(selector.isConnected()).toBe(true);
    });

    it("disconnects from iframe", () => {
      selector.connect(iframe);
      selector.disconnect();
      expect(selector.isConnected()).toBe(false);
    });

    it("throws if disposed and connecting", () => {
      selector.dispose();
      expect(() => selector.connect(iframe)).toThrow("has been disposed");
    });
  });

  describe("getFontList", () => {
    it("returns default catalog", () => {
      const fonts = selector.getFontList();
      expect(fonts.length).toBe(GOOGLE_FONTS_CATALOG.length);
    });

    it("filters by categories", () => {
      const s = new GoogleFontsSelector({
        categories: ["serif"],
      });
      const fonts = s.getFontList();
      expect(fonts.every((f) => f.category === "serif")).toBe(true);
      s.dispose();
    });

    it("uses custom fonts if provided", () => {
      const customFonts: GoogleFont[] = [
        { family: "Custom Font", category: "sans-serif", weights: [400] },
      ];
      const s = new GoogleFontsSelector({ customFonts });
      const fonts = s.getFontList();
      expect(fonts).toEqual(customFonts);
      s.dispose();
    });
  });

  describe("getFontsByCategory", () => {
    it("returns fonts grouped by category", () => {
      const grouped = selector.getFontsByCategory();
      expect(grouped["sans-serif"]).toBeDefined();
      expect(grouped["serif"]).toBeDefined();
      expect(grouped["monospace"]).toBeDefined();
    });
  });

  describe("searchFonts", () => {
    it("finds fonts by partial name", () => {
      const results = selector.searchFonts("inter");
      expect(results.some((f) => f.family === "Inter")).toBe(true);
    });

    it("returns empty for no match", () => {
      const results = selector.searchFonts("xyznotafont");
      expect(results.length).toBe(0);
    });

    it("is case-insensitive", () => {
      const results = selector.searchFonts("ROBOTO");
      expect(results.some((f) => f.family === "Roboto")).toBe(true);
    });
  });

  describe("selectHeadingFont", () => {
    it("updates heading font selection", async () => {
      const result = await selector.selectHeadingFont("Montserrat");
      expect(selector.getHeadingFont().family).toBe("Montserrat");
      expect(result.success).toBe(true);
    });

    it("uses font catalog weights by default", async () => {
      await selector.selectHeadingFont("Inter");
      const selection = selector.getHeadingFont();
      expect(selection.weights).toEqual([300, 400, 500, 600, 700]);
    });

    it("accepts custom weights", async () => {
      await selector.selectHeadingFont("Inter", [400, 700]);
      const selection = selector.getHeadingFont();
      expect(selection.weights).toEqual([400, 700]);
    });

    it("sends load message to iframe", async () => {
      selector.connect(iframe);
      await selector.selectHeadingFont("Montserrat");

      // Find the load message for Montserrat (not the initial fonts)
      const loadMsg = iframe.messages.find(
        (m: any) => m.type === "platxa:load-font" && m.family === "Montserrat"
      );
      expect(loadMsg).toBeDefined();
      expect((loadMsg as any).family).toBe("Montserrat");
    });
  });

  describe("selectBodyFont", () => {
    it("updates body font selection", async () => {
      const result = await selector.selectBodyFont("Roboto");
      expect(selector.getBodyFont().family).toBe("Roboto");
      expect(result.success).toBe(true);
    });

    it("sets role to body", async () => {
      await selector.selectBodyFont("Lato");
      expect(selector.getBodyFont().role).toBe("body");
    });
  });

  describe("state management", () => {
    it("tracks loading state during font load", async () => {
      // Use non-auto-responding iframe to test loading state
      const manualIframe = createMockIframe(false);
      selector.connect(manualIframe);

      // Start loading a font
      const loadPromise = selector.selectHeadingFont("Bebas Neue");

      // Check loading state immediately (before response)
      expect(selector.isLoading("Bebas Neue")).toBe(true);

      // Simulate font loaded response
      manualIframe.simulateFontLoaded("Bebas Neue");

      await loadPromise;

      // After load, no longer loading
      expect(selector.isLoading("Bebas Neue")).toBe(false);
      expect(selector.isLoaded("Bebas Neue")).toBe(true);
    });

    it("getState returns copy of state", () => {
      const state = selector.getState();
      expect(state.headingFont).toBeDefined();
      expect(state.bodyFont).toBeDefined();
      expect(state.loadingFonts).toBeInstanceOf(Set);
      expect(state.loadedFonts).toBeInstanceOf(Set);
      expect(state.loadErrors).toBeInstanceOf(Map);
    });
  });

  describe("callbacks", () => {
    it("calls selection change callback", async () => {
      const callback = vi.fn();
      selector.onSelectionChange(callback);

      await selector.selectHeadingFont("Anton");

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].family).toBe("Anton");
      expect(callback.mock.calls[0][0].role).toBe("heading");
    });

    it("unsubscribes from selection callback", async () => {
      const callback = vi.fn();
      const unsubscribe = selector.onSelectionChange(callback);

      unsubscribe();

      await selector.selectHeadingFont("Anton");

      expect(callback).not.toHaveBeenCalled();
    });

    it("calls load callback on success", async () => {
      const callback = vi.fn();
      selector.onFontLoad(callback);

      // Without iframe, fonts are tracked as loaded immediately
      await selector.selectHeadingFont("Lobster");

      expect(callback).toHaveBeenCalledWith("Lobster", true, undefined);
    });
  });

  describe("dispose", () => {
    it("disposes cleanly", () => {
      selector.connect(iframe);
      selector.dispose();

      expect(selector.isConnected()).toBe(false);
    });

    it("is idempotent", () => {
      selector.dispose();
      selector.dispose(); // Should not throw
    });
  });
});

// =============================================================================
// Test: Factory Function
// =============================================================================

describe("GoogleFontsSelector — Factory", () => {
  it("creates instance with createFontSelector", () => {
    const selector = createFontSelector();
    expect(selector).toBeInstanceOf(GoogleFontsSelector);
    selector.dispose();
  });

  it("passes options to constructor", () => {
    const selector = createFontSelector({
      headingFont: "Bebas Neue",
      bodyFont: "Lato",
    });
    expect(selector.getHeadingFont().family).toBe("Bebas Neue");
    expect(selector.getBodyFont().family).toBe("Lato");
    selector.dispose();
  });
});

// =============================================================================
// Test: Iframe Script
// =============================================================================

describe("GoogleFontsSelector — Iframe Script", () => {
  it("contains script tag", () => {
    expect(GOOGLE_FONTS_SCRIPT).toContain("<script>");
    expect(GOOGLE_FONTS_SCRIPT).toContain("</script>");
  });

  it("handles platxa:load-font message", () => {
    expect(GOOGLE_FONTS_SCRIPT).toContain("platxa:load-font");
  });

  it("handles platxa:apply-font-variables message", () => {
    expect(GOOGLE_FONTS_SCRIPT).toContain("platxa:apply-font-variables");
  });

  it("sends platxa:font-loaded response", () => {
    expect(GOOGLE_FONTS_SCRIPT).toContain("platxa:font-loaded");
  });

  it("sends platxa:font-error response", () => {
    expect(GOOGLE_FONTS_SCRIPT).toContain("platxa:font-error");
  });

  it("sends platxa:font-script-ready on init", () => {
    expect(GOOGLE_FONTS_SCRIPT).toContain("platxa:font-script-ready");
  });

  it("creates link elements for fonts", () => {
    expect(GOOGLE_FONTS_SCRIPT).toContain("createElement('link')");
    expect(GOOGLE_FONTS_SCRIPT).toContain("rel = 'stylesheet'");
  });

  it("applies CSS variables to root", () => {
    expect(GOOGLE_FONTS_SCRIPT).toContain("document.documentElement");
    expect(GOOGLE_FONTS_SCRIPT).toContain("setProperty");
  });
});

// =============================================================================
// Test: CSS Variable Application
// =============================================================================

describe("GoogleFontsSelector — CSS Variables", () => {
  let selector: GoogleFontsSelector;
  let iframe: MockIframe;

  beforeEach(() => {
    selector = new GoogleFontsSelector();
    iframe = createMockIframe(true); // Auto-respond to font loads
  });

  afterEach(() => {
    selector.dispose();
  });

  it("sends font variables to iframe on heading selection", async () => {
    selector.connect(iframe);
    await selector.selectHeadingFont("Montserrat");

    // Find variable message containing Montserrat (not the initial fonts)
    const varMsg = iframe.messages.find(
      (m: any) =>
        m.type === "platxa:apply-font-variables" &&
        m.variables?.["--font-heading"]?.includes("Montserrat")
    );
    expect(varMsg).toBeDefined();
    expect((varMsg as any).variables["--font-heading"]).toContain("Montserrat");
  });

  it("sends font variables to iframe on body selection", async () => {
    selector.connect(iframe);
    await selector.selectBodyFont("Roboto");

    // Find variable message containing Roboto (not the initial fonts)
    const varMsg = iframe.messages.find(
      (m: any) =>
        m.type === "platxa:apply-font-variables" &&
        m.variables?.["--font-body"]?.includes("Roboto")
    );
    expect(varMsg).toBeDefined();
    expect((varMsg as any).variables["--font-body"]).toContain("Roboto");
  });

  it("includes fallback fonts in variable", async () => {
    selector.connect(iframe);
    await selector.selectHeadingFont("Playfair Display");

    const varMsg = iframe.messages.find(
      (m: any) => m.type === "platxa:apply-font-variables"
    );
    // Playfair Display is serif, should have Georgia fallback
    expect((varMsg as any).variables["--font-heading"]).toContain("Georgia");
  });

  it("uses sans-serif fallback for sans fonts", async () => {
    selector.connect(iframe);
    await selector.selectBodyFont("Inter");

    const varMsg = iframe.messages.find(
      (m: any) => m.type === "platxa:apply-font-variables"
    );
    expect((varMsg as any).variables["--font-body"]).toContain("system-ui");
  });

  it("uses monospace fallback for mono fonts", async () => {
    selector.connect(iframe);
    await selector.selectBodyFont("Fira Code");

    // Find variable message containing Fira Code
    const varMsg = iframe.messages.find(
      (m: any) =>
        m.type === "platxa:apply-font-variables" &&
        m.variables?.["--font-body"]?.includes("Fira Code")
    );
    expect(varMsg).toBeDefined();
    expect((varMsg as any).variables["--font-body"]).toContain("Monaco");
  });
});

// =============================================================================
// Test: Font Caching
// =============================================================================

describe("GoogleFontsSelector — Font Caching", () => {
  let selector: GoogleFontsSelector;

  beforeEach(() => {
    selector = new GoogleFontsSelector();
  });

  afterEach(() => {
    selector.dispose();
  });

  it("marks font as cached on second selection", async () => {
    // First selection loads the font
    const result1 = await selector.selectHeadingFont("Anton");
    expect(result1.cached).toBe(false);

    // Second selection uses cached font
    const result2 = await selector.selectHeadingFont("Anton");
    expect(result2.cached).toBe(true);
  });

  it("isLoaded returns true after successful load", async () => {
    expect(selector.isLoaded("Anton")).toBe(false);

    await selector.selectHeadingFont("Anton");

    expect(selector.isLoaded("Anton")).toBe(true);
  });
});

// =============================================================================
// Test: Error Handling
// =============================================================================

describe("GoogleFontsSelector — Error Handling", () => {
  let selector: GoogleFontsSelector;
  let iframe: MockIframe;

  beforeEach(() => {
    selector = new GoogleFontsSelector();
    iframe = createMockIframe(false); // Manual response for error testing
  });

  afterEach(() => {
    selector.dispose();
  });

  it("handles font load error from iframe", async () => {
    selector.connect(iframe);

    const loadPromise = selector.selectHeadingFont("Roboto");

    // Simulate error response from iframe
    iframe.simulateFontError("Roboto", "Network error");

    const result = await loadPromise;
    expect(result.success).toBe(false);
  });

  it("stores error in state on failure", async () => {
    selector.connect(iframe);

    const loadPromise = selector.selectHeadingFont("Roboto");

    // Simulate error response
    iframe.simulateFontError("Roboto", "Failed to fetch font");

    await loadPromise;

    const error = selector.getLoadError("Roboto");
    expect(error).toContain("Failed to fetch font");
  });

  it("calls load callback with error on failure", async () => {
    selector.connect(iframe);

    const callback = vi.fn();
    selector.onFontLoad(callback);

    const loadPromise = selector.selectHeadingFont("Lato");

    // Simulate error
    iframe.simulateFontError("Lato", "Load failed");

    await loadPromise;

    expect(callback).toHaveBeenCalledWith("Lato", false, expect.any(String));
  });

  it("handles unknown fonts gracefully", async () => {
    const result = await selector.selectHeadingFont("NotARealFont", [400]);
    // Should succeed (no iframe to wait for)
    expect(result.success).toBe(true);
    expect(selector.getHeadingFont().family).toBe("NotARealFont");
  });

  it("handles timeout when iframe doesn't respond", async () => {
    vi.useFakeTimers();
    selector.connect(iframe);

    const loadPromise = selector.selectHeadingFont("Roboto");

    // Advance past 10s timeout
    vi.advanceTimersByTime(11000);

    const result = await loadPromise;
    expect(result.success).toBe(false);

    const error = selector.getLoadError("Roboto");
    expect(error).toContain("timeout");

    vi.useRealTimers();
  });
});

// =============================================================================
// Test: Integration Scenarios
// =============================================================================

describe("GoogleFontsSelector — Integration", () => {
  it("dropdown lists available fonts", () => {
    const selector = createFontSelector();
    const fonts = selector.getFontList();

    // Verification: Dropdown lists available fonts
    expect(fonts.length).toBeGreaterThan(30);
    expect(fonts.some((f) => f.family === "Inter")).toBe(true);
    expect(fonts.some((f) => f.family === "Playfair Display")).toBe(true);

    selector.dispose();
  });

  it("selection updates typography instantly", async () => {
    const selector = createFontSelector();
    const iframe = createMockIframe(true); // Auto-respond

    selector.connect(iframe);

    // Select a font
    await selector.selectHeadingFont("Bebas Neue");

    // Verification: selection updates typography instantly
    // Find messages for the newly selected font (not initial fonts)
    const loadMsg = iframe.messages.find(
      (m: any) => m.type === "platxa:load-font" && m.family === "Bebas Neue"
    );
    const varMsg = iframe.messages.find(
      (m: any) =>
        m.type === "platxa:apply-font-variables" &&
        m.variables?.["--font-heading"]?.includes("Bebas Neue")
    );

    expect(loadMsg).toBeDefined();
    expect(varMsg).toBeDefined();
    expect((varMsg as any).variables["--font-heading"]).toContain("Bebas Neue");

    selector.dispose();
  });

  it("supports full font selection workflow", async () => {
    const selector = createFontSelector();
    const iframe = createMockIframe(true); // Auto-respond

    // 1. Get font list for dropdown
    const fonts = selector.getFontList();
    expect(fonts.length).toBeGreaterThan(0);

    // 2. Search for a font
    const searchResults = selector.searchFonts("mon");
    expect(searchResults.some((f) => f.family === "Montserrat")).toBe(true);

    // 3. Get fonts by category
    const serifFonts = selector.getFontsByCategory()["serif"];
    expect(serifFonts.length).toBeGreaterThan(0);

    // 4. Connect and select fonts
    selector.connect(iframe);

    await selector.selectHeadingFont("Montserrat");
    await selector.selectBodyFont("Open Sans");

    // 5. Verify state
    expect(selector.getHeadingFont().family).toBe("Montserrat");
    expect(selector.getBodyFont().family).toBe("Open Sans");

    selector.dispose();
  });
});
