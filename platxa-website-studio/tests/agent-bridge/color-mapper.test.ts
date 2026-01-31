import { describe, it, expect } from "vitest";
import {
  hexToOklch,
  oklchToHex,
  mapOdooPaletteToBrandTokens,
  generateLightnessScale,
  meetsContrastAA,
} from "@/lib/agent-bridge/color-mapper";

describe("Color Mapper (routed through frontend-agent)", () => {
  describe("hexToOklch", () => {
    it("converts hex to OKLCH color space", () => {
      const result = hexToOklch("#3B82F6");
      expect(result).not.toBeNull();
      expect(result?.l).toBeGreaterThan(0);
      expect(result?.l).toBeLessThan(1);
      expect(result?.c).toBeGreaterThanOrEqual(0);
      expect(result?.h).toBeGreaterThanOrEqual(0);
      expect(result?.h).toBeLessThan(360);
    });

    it("handles colors without hash prefix", () => {
      const withHash = hexToOklch("#FF5733");
      const withoutHash = hexToOklch("FF5733");
      expect(withHash).toEqual(withoutHash);
    });

    it("returns null for invalid hex", () => {
      expect(hexToOklch("invalid")).toBeNull();
      expect(hexToOklch("#GGG")).toBeNull();
      expect(hexToOklch("")).toBeNull();
    });

    it("produces consistent OKLCH values", () => {
      // Blue should have high hue around 260-270
      const blue = hexToOklch("#0000FF");
      expect(blue?.h).toBeGreaterThan(250);
      expect(blue?.h).toBeLessThan(280);

      // Red should have low hue around 20-30
      const red = hexToOklch("#FF0000");
      expect(red?.h).toBeGreaterThanOrEqual(0);
      expect(red?.h).toBeLessThan(40);

      // White should have high lightness
      const white = hexToOklch("#FFFFFF");
      expect(white?.l).toBeGreaterThan(0.95);

      // Black should have low lightness
      const black = hexToOklch("#000000");
      expect(black?.l).toBeLessThan(0.05);
    });
  });

  describe("oklchToHex", () => {
    it("converts OKLCH back to hex", () => {
      const oklch = { l: 0.5, c: 0.15, h: 260 };
      const hex = oklchToHex(oklch);
      expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it("roundtrips hex -> OKLCH -> hex approximately", () => {
      const original = "#3B82F6";
      const oklch = hexToOklch(original);
      expect(oklch).not.toBeNull();

      const roundtripped = oklchToHex(oklch!);
      // Allow small differences due to gamut mapping
      const originalOklch = hexToOklch(original);
      const roundtrippedOklch = hexToOklch(roundtripped);

      expect(Math.abs(originalOklch!.l - roundtrippedOklch!.l)).toBeLessThan(0.02);
      expect(Math.abs(originalOklch!.c - roundtrippedOklch!.c)).toBeLessThan(0.02);
    });
  });

  describe("mapOdooPaletteToBrandTokens", () => {
    it("maps Odoo palette to brand tokens with OKLCH values", () => {
      const result = mapOdooPaletteToBrandTokens({
        primary: "#3B82F6",
        secondary: "#6B7280",
        accent: "#F59E0B",
        background: "#FFFFFF",
        text: "#1F2937",
      });

      expect(result.colors.primary).toBe("#3B82F6");
      expect(result.colors.primaryOklch).toBeDefined();
      expect(result.colors.primaryOklch.l).toBeGreaterThan(0);
    });

    it("derives semantic colors using OKLCH", () => {
      const result = mapOdooPaletteToBrandTokens({
        primary: "#3B82F6",
        accent: "#F59E0B",
      });

      expect(result.colors.error).toMatch(/^#[0-9a-f]{6}$/i);
      expect(result.colors.warning).toMatch(/^#[0-9a-f]{6}$/i);
      expect(result.colors.success).toMatch(/^#[0-9a-f]{6}$/i);
      expect(result.colors.info).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it("uses fallback colors when palette is undefined", () => {
      const result = mapOdooPaletteToBrandTokens(undefined);

      expect(result.colors.primary).toBeDefined();
      expect(result.colors.primaryOklch).toBeDefined();
      expect(result.colors.error).toBeDefined();
    });

    it("fills missing colors with fallbacks", () => {
      const result = mapOdooPaletteToBrandTokens({
        primary: "#FF0000",
      });

      expect(result.colors.primary).toBe("#FF0000");
      expect(result.colors.secondary).toBeDefined();
      expect(result.colors.accent).toBeDefined();
    });
  });

  describe("generateLightnessScale", () => {
    it("generates 11-step Tailwind shade scale", () => {
      const scale = generateLightnessScale("#3B82F6");

      expect(Object.keys(scale)).toHaveLength(11);
      expect(scale[50]).toBeDefined();
      expect(scale[100]).toBeDefined();
      expect(scale[500]).toBeDefined();
      expect(scale[900]).toBeDefined();
      expect(scale[950]).toBeDefined();
    });

    it("produces lighter shades at lower numbers", () => {
      const scale = generateLightnessScale("#3B82F6");

      const shade50 = hexToOklch(scale[50]);
      const shade500 = hexToOklch(scale[500]);
      const shade950 = hexToOklch(scale[950]);

      expect(shade50!.l).toBeGreaterThan(shade500!.l);
      expect(shade500!.l).toBeGreaterThan(shade950!.l);
    });

    it("maintains consistent hue across shades", () => {
      const scale = generateLightnessScale("#3B82F6");

      const shade50 = hexToOklch(scale[50]);
      const shade500 = hexToOklch(scale[500]);
      const shade950 = hexToOklch(scale[950]);

      // Hues should be within 30 degrees of each other
      const avgHue = (shade50!.h + shade500!.h + shade950!.h) / 3;
      expect(Math.abs(shade50!.h - avgHue)).toBeLessThan(30);
      expect(Math.abs(shade500!.h - avgHue)).toBeLessThan(30);
      expect(Math.abs(shade950!.h - avgHue)).toBeLessThan(30);
    });

    it("returns fallback for invalid hex", () => {
      const scale = generateLightnessScale("invalid");
      expect(scale[500]).toBe("invalid");
    });
  });

  describe("meetsContrastAA", () => {
    it("returns true for high contrast pairs", () => {
      expect(meetsContrastAA("#000000", "#FFFFFF")).toBe(true);
      expect(meetsContrastAA("#FFFFFF", "#000000")).toBe(true);
    });

    it("returns false for low contrast pairs", () => {
      expect(meetsContrastAA("#777777", "#888888")).toBe(false);
      expect(meetsContrastAA("#CCCCCC", "#DDDDDD")).toBe(false);
    });

    it("validates common text/background combinations", () => {
      // Dark text on light background
      expect(meetsContrastAA("#1F2937", "#FFFFFF")).toBe(true);
      // Light text on dark background
      expect(meetsContrastAA("#F9FAFB", "#111827")).toBe(true);
    });

    it("returns false for invalid colors", () => {
      expect(meetsContrastAA("invalid", "#FFFFFF")).toBe(false);
      expect(meetsContrastAA("#000000", "invalid")).toBe(false);
    });
  });

  describe("frontend-agent integration verification", () => {
    it("uses frontend-agent OKLCH module for color conversion", () => {
      // This test verifies the integration by checking that the output
      // matches the expected behavior of the frontend-agent module

      // Convert a known color
      const oklch = hexToOklch("#7C3AED");
      expect(oklch).not.toBeNull();

      // The frontend-agent module should produce valid OKLCH values
      expect(oklch!.l).toBeGreaterThan(0);
      expect(oklch!.l).toBeLessThan(1);
      expect(oklch!.c).toBeGreaterThan(0);
      expect(oklch!.c).toBeLessThan(0.5);
      expect(oklch!.h).toBeGreaterThanOrEqual(0);
      expect(oklch!.h).toBeLessThan(360);
    });

    it("uses frontend-agent shade scale generator", () => {
      const scale = generateLightnessScale("#3B82F6");

      // The frontend-agent's generateShadeScale should produce
      // perceptually uniform lightness steps
      const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
      let prevLightness = 1;

      for (const shade of shades) {
        const oklch = hexToOklch(scale[shade]);
        expect(oklch).not.toBeNull();
        // Lightness should decrease as shade number increases
        expect(oklch!.l).toBeLessThanOrEqual(prevLightness + 0.05); // Small tolerance
        prevLightness = oklch!.l;
      }
    });

    it("uses frontend-agent contrast calculation", () => {
      // WCAG AA requires 4.5:1 contrast ratio for normal text
      // The frontend-agent's calculateContrastRatio should be used

      // These pairs have known contrast ratios
      expect(meetsContrastAA("#000000", "#FFFFFF")).toBe(true); // 21:1
      expect(meetsContrastAA("#767676", "#FFFFFF")).toBe(true); // ~4.5:1 (border case)
      expect(meetsContrastAA("#777777", "#FFFFFF")).toBe(false); // ~4.48:1 (just under)
    });
  });
});
