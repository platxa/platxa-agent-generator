import { describe, it, expect } from "vitest";
import {
  hexToHsl,
  hslToHex,
  validateHarmony,
  generateHarmoniousPalette,
} from "@/lib/agent-bridge/color-harmony";

describe("Color Harmony", () => {
  describe("hexToHsl", () => {
    it("converts pure red", () => {
      const hsl = hexToHsl("#FF0000");
      expect(hsl.h).toBe(0);
      expect(hsl.s).toBe(100);
      expect(hsl.l).toBe(50);
    });

    it("converts pure green", () => {
      const hsl = hexToHsl("#00FF00");
      expect(hsl.h).toBe(120);
    });

    it("converts pure blue", () => {
      const hsl = hexToHsl("#0000FF");
      expect(hsl.h).toBe(240);
    });

    it("converts white", () => {
      const hsl = hexToHsl("#FFFFFF");
      expect(hsl.l).toBe(100);
      expect(hsl.s).toBe(0);
    });

    it("converts black", () => {
      const hsl = hexToHsl("#000000");
      expect(hsl.l).toBe(0);
    });
  });

  describe("hslToHex", () => {
    it("converts red HSL to hex", () => {
      expect(hslToHex({ h: 0, s: 100, l: 50 })).toBe("#FF0000");
    });

    it("converts gray", () => {
      const hex = hslToHex({ h: 0, s: 0, l: 50 });
      expect(hex).toBe("#808080");
    });

    it("roundtrips hex -> hsl -> hex", () => {
      const original = "#3B82F6";
      const hsl = hexToHsl(original);
      const back = hslToHex(hsl);
      // Allow small rounding differences
      expect(hexToHsl(back).h).toBeCloseTo(hsl.h, 0);
    });
  });

  describe("validateHarmony", () => {
    it("detects complementary colors", () => {
      // Red and cyan (0° and 180°)
      const result = validateHarmony(["#FF0000", "#00FFFF"]);
      expect(result.detectedHarmony).toBe("complementary");
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("detects analogous colors", () => {
      // Red, orange-red, orange (close hues)
      const result = validateHarmony(["#FF0000", "#FF4400", "#FF8800"]);
      expect(result.detectedHarmony).toBe("analogous");
    });

    it("detects triadic colors", () => {
      // Red, green, blue (120° apart)
      const result = validateHarmony(["#FF0000", "#00FF00", "#0000FF"]);
      expect(result.detectedHarmony).toBe("triadic");
    });

    it("detects monochromatic palette", () => {
      // Same hue, different lightness
      const result = validateHarmony(["#003366", "#004488", "#0055AA"]);
      expect(result.detectedHarmony).toBe("monochromatic");
    });

    it("flags disharmonious combinations", () => {
      // 0° and ~70° — in the dead zone
      const result = validateHarmony(["#FF0000", "#AAFF00"]);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it("provides suggestions for disharmonious pairs", () => {
      const result = validateHarmony(["#FF0000", "#AAFF00"]);
      const issue = result.issues.find((i) => i.suggestions.length > 0);
      expect(issue).toBeTruthy();
      expect(issue!.suggestions[0]).toMatch(/^#[0-9A-F]{6}$/);
    });

    it("flags nearly identical colors", () => {
      const result = validateHarmony(["#3B82F6", "#3B83F7"]);
      const dupeIssue = result.issues.find((i) => i.message.includes("nearly identical"));
      expect(dupeIssue).toBeTruthy();
    });

    it("flags large saturation spread", () => {
      // One fully saturated, one nearly gray
      const result = validateHarmony(["#FF0000", "#808888"]);
      const satIssue = result.issues.find((i) => i.message.includes("saturation"));
      expect(satIssue).toBeTruthy();
    });

    it("reports isHarmonious true for clean complementary pair", () => {
      const result = validateHarmony(["#FF0000", "#00FFFF"]);
      expect(result.isHarmonious).toBe(true);
    });

    it("returns hslColors for all inputs", () => {
      const result = validateHarmony(["#FF0000", "#00FF00", "#0000FF"]);
      expect(result.hslColors).toHaveLength(3);
    });

    it("handles single color gracefully", () => {
      const result = validateHarmony(["#FF0000"]);
      expect(result.isHarmonious).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe("generateHarmoniousPalette", () => {
    it("generates complementary pair", () => {
      const palette = generateHarmoniousPalette("#FF0000", "complementary");
      expect(palette).toHaveLength(2);
      const h2 = hexToHsl(palette[1]).h;
      expect(h2).toBeCloseTo(180, -1);
    });

    it("generates triadic palette", () => {
      const palette = generateHarmoniousPalette("#FF0000", "triadic");
      expect(palette).toHaveLength(3);
    });

    it("generates analogous palette with specified count", () => {
      const palette = generateHarmoniousPalette("#FF0000", "analogous", 5);
      expect(palette).toHaveLength(5);
      // All hues should be within a range
      const hues = palette.map((h) => hexToHsl(h).h);
      for (let i = 1; i < hues.length; i++) {
        // Circular hue distance (wraps at 360°)
        const raw = Math.abs(hues[i] - hues[i - 1]) % 360;
        const diff = raw > 180 ? 360 - raw : raw;
        expect(diff).toBeLessThanOrEqual(40);
      }
    });

    it("generates split-complementary palette", () => {
      const palette = generateHarmoniousPalette("#FF0000", "split-complementary");
      expect(palette).toHaveLength(3);
    });

    it("generates monochromatic palette", () => {
      const palette = generateHarmoniousPalette("#3B82F6", "monochromatic", 4);
      expect(palette).toHaveLength(4);
      // All should have similar hue
      const hues = palette.map((h) => hexToHsl(h).h);
      const base = hues[0];
      for (const h of hues) {
        expect(Math.abs(h - base)).toBeLessThanOrEqual(2);
      }
    });

    it("returns valid hex strings", () => {
      const palette = generateHarmoniousPalette("#3B82F6", "triadic");
      for (const color of palette) {
        expect(color).toMatch(/^#[0-9A-F]{6}$/);
      }
    });

    it("generated palette validates as harmonious", () => {
      const palette = generateHarmoniousPalette("#FF0000", "triadic");
      const result = validateHarmony(palette);
      expect(result.detectedHarmony).toBe("triadic");
    });
  });
});
