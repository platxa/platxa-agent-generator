import { describe, it, expect } from "vitest";
import {
  validateFont,
  validateFontPair,
  getAvailableFonts,
  getFontsByCategory,
} from "@/lib/agent-bridge/font-validator";

describe("Font Validator", () => {
  describe("validateFont", () => {
    it("validates a known Google Font", () => {
      const result = validateFont("Inter");
      expect(result.isValid).toBe(true);
      expect(result.resolved).toBe("Inter");
      expect(result.category).toBe("sans-serif");
    });

    it("resolves case-insensitive names", () => {
      const result = validateFont("inter");
      expect(result.isValid).toBe(true);
      expect(result.resolved).toBe("Inter");
    });

    it("resolves multi-word fonts case-insensitively", () => {
      const result = validateFont("playfair display");
      expect(result.isValid).toBe(true);
      expect(result.resolved).toBe("Playfair Display");
      expect(result.category).toBe("serif");
    });

    it("marks unknown fonts as invalid", () => {
      const result = validateFont("NonExistentFont");
      expect(result.isValid).toBe(false);
      expect(result.importUrl).toBeNull();
    });

    it("generates import URL for valid fonts", () => {
      const result = validateFont("Montserrat");
      expect(result.importUrl).toContain("fonts.googleapis.com");
      expect(result.importUrl).toContain("Montserrat");
    });

    it("generates no import URL for invalid fonts", () => {
      const result = validateFont("FakeFont");
      expect(result.importUrl).toBeNull();
    });

    it("includes generic family in fallback chain for sans-serif", () => {
      const result = validateFont("Inter");
      expect(result.fallbackChain).toContain("sans-serif");
      expect(result.fallbackChain).toContain("Arial");
    });

    it("includes generic family in fallback chain for serif", () => {
      const result = validateFont("Merriweather");
      expect(result.fallbackChain).toContain("serif");
      expect(result.fallbackChain).toContain("Georgia");
    });

    it("includes generic family in fallback chain for monospace", () => {
      const result = validateFont("Fira Code");
      expect(result.fallbackChain).toContain("monospace");
      expect(result.fallbackChain).toContain("Consolas");
    });

    it("quotes multi-word font names in fallback chain", () => {
      const result = validateFont("Playfair Display");
      expect(result.fallbackChain).toMatch(/"Playfair Display"/);
    });

    it("preserves requested name", () => {
      const result = validateFont("INTER");
      expect(result.requested).toBe("INTER");
      expect(result.resolved).toBe("Inter");
    });

    it("guesses serif category for unknown serif-named fonts", () => {
      const result = validateFont("Custom Serif Pro");
      expect(result.category).toBe("serif");
    });

    it("guesses monospace category for code-named fonts", () => {
      const result = validateFont("My Code Font");
      expect(result.category).toBe("monospace");
    });

    it("defaults to sans-serif for unknown fonts", () => {
      const result = validateFont("SomeRandomFont");
      expect(result.category).toBe("sans-serif");
    });

    it("still generates fallback chain for invalid fonts", () => {
      const result = validateFont("Unknown");
      expect(result.fallbackChain).toContain("Unknown");
      expect(result.fallbackChain).toContain("sans-serif");
    });
  });

  describe("validateFontPair", () => {
    it("validates both heading and body fonts", () => {
      const result = validateFontPair("Playfair Display", "Inter");
      expect(result.heading.isValid).toBe(true);
      expect(result.body.isValid).toBe(true);
      expect(result.allValid).toBe(true);
    });

    it("reports allValid false when heading is invalid", () => {
      const result = validateFontPair("FakeFont", "Inter");
      expect(result.allValid).toBe(false);
    });

    it("reports allValid false when body is invalid", () => {
      const result = validateFontPair("Inter", "FakeFont");
      expect(result.allValid).toBe(false);
    });

    it("generates combined import URL", () => {
      const result = validateFontPair("Playfair Display", "Inter");
      expect(result.combinedImportUrl).toContain("Playfair+Display");
      expect(result.combinedImportUrl).toContain("Inter");
      expect(result.combinedImportUrl).toContain("display=swap");
    });

    it("generates empty import URL when both fonts are invalid", () => {
      const result = validateFontPair("Fake1", "Fake2");
      expect(result.combinedImportUrl).toBe("");
    });

    it("deduplicates import URLs when same font used for both", () => {
      const result = validateFontPair("Inter", "Inter");
      const familyMatches = result.combinedImportUrl.match(/family=/g);
      expect(familyMatches).toHaveLength(1);
    });
  });

  describe("getAvailableFonts", () => {
    it("returns a non-empty list", () => {
      const fonts = getAvailableFonts();
      expect(fonts.length).toBeGreaterThan(20);
    });

    it("includes well-known fonts", () => {
      const fonts = getAvailableFonts();
      expect(fonts).toContain("Inter");
      expect(fonts).toContain("Roboto");
      expect(fonts).toContain("Playfair Display");
    });
  });

  describe("getFontsByCategory", () => {
    it("returns serif fonts", () => {
      const fonts = getFontsByCategory("serif");
      expect(fonts).toContain("Playfair Display");
      expect(fonts).toContain("Merriweather");
      expect(fonts.every((f) => !["Inter", "Roboto"].includes(f))).toBe(true);
    });

    it("returns sans-serif fonts", () => {
      const fonts = getFontsByCategory("sans-serif");
      expect(fonts).toContain("Inter");
      expect(fonts).toContain("Roboto");
    });

    it("returns monospace fonts", () => {
      const fonts = getFontsByCategory("monospace");
      expect(fonts).toContain("Fira Code");
    });

    it("returns empty array for category with no matches if applicable", () => {
      const fonts = getFontsByCategory("display");
      expect(fonts.length).toBeGreaterThan(0);
    });
  });
});
