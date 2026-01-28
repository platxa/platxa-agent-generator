import { describe, it, expect } from "vitest";
import {
  hexToRgb,
  relativeLuminance,
  contrastRatio,
  getWcagLevel,
  formatRatio,
  evaluatePair,
  generateSwatchPanel,
} from "@/lib/agent-bridge/color-swatch-panel";
import type { ColorSwatch } from "@/lib/agent-bridge/color-swatch-panel";

describe("Color Swatch Panel", () => {
  describe("hexToRgb", () => {
    it("parses 6-digit hex", () => {
      expect(hexToRgb("#ff0000")).toEqual([255, 0, 0]);
      expect(hexToRgb("#00ff00")).toEqual([0, 255, 0]);
      expect(hexToRgb("#0000ff")).toEqual([0, 0, 255]);
    });

    it("parses 3-digit hex", () => {
      expect(hexToRgb("#f00")).toEqual([255, 0, 0]);
      expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
    });

    it("handles without hash", () => {
      expect(hexToRgb("000000")).toEqual([0, 0, 0]);
    });
  });

  describe("relativeLuminance", () => {
    it("black has luminance 0", () => {
      expect(relativeLuminance("#000000")).toBeCloseTo(0, 4);
    });

    it("white has luminance 1", () => {
      expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 4);
    });

    it("mid-gray has intermediate luminance", () => {
      const lum = relativeLuminance("#808080");
      expect(lum).toBeGreaterThan(0.1);
      expect(lum).toBeLessThan(0.5);
    });
  });

  describe("contrastRatio", () => {
    it("black on white is 21:1", () => {
      expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    });

    it("same color is 1:1", () => {
      expect(contrastRatio("#336699", "#336699")).toBeCloseTo(1, 1);
    });

    it("is symmetric", () => {
      const r1 = contrastRatio("#336699", "#ffffff");
      const r2 = contrastRatio("#ffffff", "#336699");
      expect(r1).toBeCloseTo(r2, 5);
    });

    it("computes real-world contrast", () => {
      // Dark blue on white should be high contrast
      const ratio = contrastRatio("#1a237e", "#ffffff");
      expect(ratio).toBeGreaterThan(10);
    });
  });

  describe("getWcagLevel", () => {
    it("7+ is AAA for normal text", () => {
      expect(getWcagLevel(7.5, false)).toBe("AAA");
    });

    it("4.5-7 is AA for normal text", () => {
      expect(getWcagLevel(5.0, false)).toBe("AA");
    });

    it("3-4.5 is AA-large for normal text", () => {
      expect(getWcagLevel(3.5, false)).toBe("AA-large");
    });

    it("below 3 is fail for normal text", () => {
      expect(getWcagLevel(2.5, false)).toBe("fail");
    });

    it("4.5+ is AAA for large text", () => {
      expect(getWcagLevel(5.0, true)).toBe("AAA");
    });

    it("3-4.5 is AA for large text", () => {
      expect(getWcagLevel(3.5, true)).toBe("AA");
    });

    it("below 3 is fail for large text", () => {
      expect(getWcagLevel(2.0, true)).toBe("fail");
    });
  });

  describe("formatRatio", () => {
    it("formats with 2 decimal places", () => {
      expect(formatRatio(4.5)).toBe("4.50:1");
      expect(formatRatio(21)).toBe("21.00:1");
    });
  });

  describe("evaluatePair", () => {
    it("evaluates foreground on background", () => {
      const fg: ColorSwatch = { name: "text", hex: "#000000", role: "foreground" };
      const bg: ColorSwatch = { name: "surface", hex: "#ffffff", role: "background" };
      const pair = evaluatePair(fg, bg);
      expect(pair.foreground).toBe("text");
      expect(pair.background).toBe("surface");
      expect(pair.ratio).toBeCloseTo(21, 0);
      expect(pair.levelNormal).toBe("AAA");
      expect(pair.levelLarge).toBe("AAA");
      expect(pair.ratioFormatted).toContain(":1");
    });
  });

  describe("generateSwatchPanel", () => {
    it("generates panel with role-based pairs", () => {
      const swatches: ColorSwatch[] = [
        { name: "text-primary", hex: "#1a1a1a", role: "foreground" },
        { name: "text-secondary", hex: "#666666", role: "foreground" },
        { name: "bg-surface", hex: "#ffffff", role: "background" },
        { name: "bg-muted", hex: "#f5f5f5", role: "background" },
      ];
      const panel = generateSwatchPanel(swatches);
      // 2 fg × 2 bg = 4 pairs
      expect(panel.totalPairs).toBe(4);
      expect(panel.swatches).toHaveLength(4);
      expect(panel.aaPassCount).toBeGreaterThanOrEqual(0);
      expect(panel.aaaPassCount).toBeGreaterThanOrEqual(0);
    });

    it("uses all-vs-all when no role separation", () => {
      const swatches: ColorSwatch[] = [
        { name: "a", hex: "#000000", role: "accent" },
        { name: "b", hex: "#ffffff", role: "accent" },
        { name: "c", hex: "#ff0000", role: "accent" },
      ];
      const panel = generateSwatchPanel(swatches);
      // 3 × 2 = 6 pairs (all-vs-all excluding self)
      expect(panel.totalPairs).toBe(6);
    });

    it("counts AA and AAA passes correctly", () => {
      const swatches: ColorSwatch[] = [
        { name: "dark", hex: "#000000", role: "foreground" },
        { name: "white", hex: "#ffffff", role: "background" },
      ];
      const panel = generateSwatchPanel(swatches);
      expect(panel.aaPassCount).toBe(1);
      expect(panel.aaaPassCount).toBe(1);
    });

    it("handles empty swatches", () => {
      const panel = generateSwatchPanel([]);
      expect(panel.totalPairs).toBe(0);
      expect(panel.swatches).toHaveLength(0);
    });

    it("includes contrast pair details", () => {
      const swatches: ColorSwatch[] = [
        { name: "primary", hex: "#1a73e8", role: "foreground" },
        { name: "surface", hex: "#ffffff", role: "background" },
      ];
      const panel = generateSwatchPanel(swatches);
      expect(panel.contrastPairs[0].fgHex).toBe("#1a73e8");
      expect(panel.contrastPairs[0].bgHex).toBe("#ffffff");
      expect(panel.contrastPairs[0].ratio).toBeGreaterThan(1);
    });
  });
});
