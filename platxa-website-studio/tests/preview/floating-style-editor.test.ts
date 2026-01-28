import { describe, it, expect } from "vitest";
import {
  COLOR_PRESETS,
  FONT_PRESETS,
  SPACING_PRESETS,
  type StyleEdit,
  type ColorPreset,
  type FontPreset,
  type SpacingPreset,
} from "@/components/preview/FloatingStyleEditor";

describe("FloatingStyleEditor", () => {
  describe("COLOR_PRESETS", () => {
    it("provides at least 5 Odoo color presets", () => {
      expect(COLOR_PRESETS.length).toBeGreaterThanOrEqual(5);
    });

    it("includes Odoo CSS variable references", () => {
      const odooVars = COLOR_PRESETS.filter((p) => p.cssVar.startsWith("var(--o-color"));
      expect(odooVars.length).toBeGreaterThanOrEqual(5);
    });

    it("each preset has name, value, and cssVar", () => {
      for (const preset of COLOR_PRESETS) {
        expect(preset.name).toBeTruthy();
        expect(preset.value).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(preset.cssVar).toBeTruthy();
      }
    });
  });

  describe("FONT_PRESETS", () => {
    it("provides multiple font options", () => {
      expect(FONT_PRESETS.length).toBeGreaterThanOrEqual(5);
    });

    it("includes serif and sans-serif options", () => {
      const hasSerif = FONT_PRESETS.some((f) => f.value.includes("serif") && !f.value.includes("sans-serif"));
      const hasSansSerif = FONT_PRESETS.some((f) => f.value.includes("sans-serif"));
      expect(hasSerif).toBe(true);
      expect(hasSansSerif).toBe(true);
    });

    it("each preset has label and value", () => {
      for (const font of FONT_PRESETS) {
        expect(font.label).toBeTruthy();
        expect(font.value).toBeTruthy();
      }
    });
  });

  describe("SPACING_PRESETS", () => {
    it("provides spacing options from none to XXL", () => {
      expect(SPACING_PRESETS.length).toBeGreaterThanOrEqual(4);
      expect(SPACING_PRESETS[0].label).toBe("None");
      expect(SPACING_PRESETS[0].value).toBe("0");
    });

    it("includes Odoo padding classes", () => {
      const withClasses = SPACING_PRESETS.filter((s) => s.cssClass.includes("pt"));
      expect(withClasses.length).toBeGreaterThanOrEqual(3);
    });

    it("each preset has label, cssClass, and value", () => {
      for (const spacing of SPACING_PRESETS) {
        expect(spacing.label).toBeTruthy();
        expect(spacing.cssClass).toBeDefined();
        expect(spacing.value).toBeDefined();
      }
    });
  });

  describe("StyleEdit type", () => {
    it("captures snippet-scoped style changes", () => {
      const edit: StyleEdit = {
        snippetId: "s_hero",
        property: "background-color",
        value: "var(--o-color-1)",
      };
      expect(edit.snippetId).toBe("s_hero");
      expect(edit.property).toBe("background-color");
      expect(edit.value).toContain("var(--o-color-1)");
    });

    it("supports font-family edits", () => {
      const edit: StyleEdit = {
        snippetId: "s_features",
        property: "font-family",
        value: "'Inter', sans-serif",
      };
      expect(edit.property).toBe("font-family");
    });

    it("supports spacing edits", () => {
      const edit: StyleEdit = {
        snippetId: "s_cta",
        property: "padding",
        value: "3rem",
      };
      expect(edit.property).toBe("padding");
      expect(edit.value).toBe("3rem");
    });
  });
});
