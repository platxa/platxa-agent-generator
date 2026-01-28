import { describe, it, expect } from "vitest";
import {
  extractColorPalette,
  updateColorVariable,
  resolveColorToPalette,
  applyColorChange,
  ODOO_COLOR_VAR_PREFIX,
  CSS_VAR_TO_PALETTE,
} from "@/lib/preview/scss-color-updater";

const SAMPLE_SCSS = `$o-color-1: #7c3aed;
$o-color-2: #6c757d;
$o-color-3: #ec4899;
$o-color-4: #f8f9fa;
$o-color-5: #212529;

.s_hero {
  background: $o-color-4;
  color: $o-color-5;
}`;

describe("SCSS Color Updater", () => {
  describe("extractColorPalette", () => {
    it("extracts all 5 Odoo color variables", () => {
      const palette = extractColorPalette(SAMPLE_SCSS);
      expect(palette[1]).toBe("#7c3aed");
      expect(palette[2]).toBe("#6c757d");
      expect(palette[3]).toBe("#ec4899");
      expect(palette[4]).toBe("#f8f9fa");
      expect(palette[5]).toBe("#212529");
    });

    it("returns empty object for SCSS without palette vars", () => {
      const palette = extractColorPalette(".test { color: red; }");
      expect(Object.keys(palette)).toHaveLength(0);
    });

    it("handles extra whitespace around values", () => {
      const palette = extractColorPalette("$o-color-1:   #aabbcc  ;");
      expect(palette[1]).toBe("#aabbcc");
    });
  });

  describe("updateColorVariable", () => {
    it("updates an existing color variable", () => {
      const result = updateColorVariable(SAMPLE_SCSS, 1, "#ff0000");
      expect(result.changed).toBe(true);
      expect(result.previousValue).toBe("#7c3aed");
      expect(result.newValue).toBe("#ff0000");
      expect(result.updatedSource).toContain("$o-color-1: #ff0000;");
      expect(result.updatedSource).not.toContain("#7c3aed");
    });

    it("does not change source if value is the same", () => {
      const result = updateColorVariable(SAMPLE_SCSS, 1, "#7c3aed");
      expect(result.changed).toBe(false);
      expect(result.updatedSource).toBe(SAMPLE_SCSS);
    });

    it("prepends variable if it does not exist", () => {
      const result = updateColorVariable(".test { }", 1, "#abcdef");
      expect(result.changed).toBe(true);
      expect(result.previousValue).toBeNull();
      expect(result.updatedSource.startsWith("$o-color-1: #abcdef;")).toBe(true);
    });

    it("preserves other variables when updating one", () => {
      const result = updateColorVariable(SAMPLE_SCSS, 3, "#00ff00");
      expect(result.updatedSource).toContain("$o-color-1: #7c3aed;");
      expect(result.updatedSource).toContain("$o-color-2: #6c757d;");
      expect(result.updatedSource).toContain("$o-color-3: #00ff00;");
      expect(result.updatedSource).toContain("$o-color-4: #f8f9fa;");
    });
  });

  describe("resolveColorToPalette", () => {
    it("maps var(--o-color-N) to palette index", () => {
      const result = resolveColorToPalette("var(--o-color-1)");
      expect(result).not.toBeNull();
      expect(result!.paletteIndex).toBe(1);
    });

    it("maps all 5 palette CSS vars", () => {
      for (const [cssVar, index] of Object.entries(CSS_VAR_TO_PALETTE)) {
        const result = resolveColorToPalette(cssVar);
        expect(result).not.toBeNull();
        expect(result!.paletteIndex).toBe(index);
      }
    });

    it("returns null for plain hex values", () => {
      expect(resolveColorToPalette("#ff0000")).toBeNull();
    });

    it("returns null for unrecognized values", () => {
      expect(resolveColorToPalette("rgb(255,0,0)")).toBeNull();
    });
  });

  describe("applyColorChange", () => {
    it("updates the correct SCSS file", () => {
      const files: Record<string, string> = {
        "views/page.xml": "<div>html</div>",
        "static/src/scss/theme.scss": SAMPLE_SCSS,
      };
      const result = applyColorChange(files, 1, "#ff0000");
      expect(result).not.toBeNull();
      expect(result!.path).toBe("static/src/scss/theme.scss");
      expect(result!.result.changed).toBe(true);
      expect(result!.result.updatedSource).toContain("#ff0000");
    });

    it("returns null if no SCSS files exist", () => {
      const files = { "page.xml": "<div/>" };
      expect(applyColorChange(files, 1, "#fff")).toBeNull();
    });

    it("prepends variable to first SCSS file if var not found", () => {
      const files = {
        "theme.scss": ".test { color: red; }",
      };
      const result = applyColorChange(files, 1, "#abcdef");
      expect(result).not.toBeNull();
      expect(result!.result.previousValue).toBeNull();
      expect(result!.result.updatedSource).toContain("$o-color-1: #abcdef;");
    });
  });

  describe("constants", () => {
    it("ODOO_COLOR_VAR_PREFIX is $o-color-", () => {
      expect(ODOO_COLOR_VAR_PREFIX).toBe("$o-color-");
    });
  });
});
