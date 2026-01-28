import { describe, it, expect } from "vitest";
import {
  toPythonClass,
  isValidHex,
  validateConfig,
  generateWizard,
  DEFAULT_PALETTES,
  DEFAULT_FONTS,
  DEFAULT_LAYOUTS,
} from "@/lib/agent-bridge/theme-config-wizard";
import type { WizardConfig } from "@/lib/agent-bridge/theme-config-wizard";

const validConfig: WizardConfig = {
  moduleName: "theme_starter",
  moduleTitle: "Starter Theme",
  palettes: DEFAULT_PALETTES,
  fonts: DEFAULT_FONTS,
  layouts: DEFAULT_LAYOUTS,
};

describe("Theme Config Wizard", () => {
  describe("toPythonClass", () => {
    it("converts snake_case to PascalCase", () => {
      expect(toPythonClass("theme_starter")).toBe("ThemeStarter");
    });

    it("handles single word", () => {
      expect(toPythonClass("theme")).toBe("Theme");
    });

    it("handles multiple segments", () => {
      expect(toPythonClass("my_cool_theme")).toBe("MyCoolTheme");
    });
  });

  describe("isValidHex", () => {
    it("accepts 6-digit hex", () => {
      expect(isValidHex("#1a73e8")).toBe(true);
    });

    it("accepts 3-digit hex", () => {
      expect(isValidHex("#fff")).toBe(true);
    });

    it("rejects without hash", () => {
      expect(isValidHex("1a73e8")).toBe(false);
    });

    it("rejects invalid chars", () => {
      expect(isValidHex("#gggggg")).toBe(false);
    });

    it("rejects wrong length", () => {
      expect(isValidHex("#1234")).toBe(false);
    });
  });

  describe("validateConfig", () => {
    it("returns no errors for valid config", () => {
      expect(validateConfig(validConfig)).toHaveLength(0);
    });

    it("requires moduleName", () => {
      const errors = validateConfig({ ...validConfig, moduleName: "" });
      expect(errors).toContain("moduleName is required");
    });

    it("requires moduleTitle", () => {
      const errors = validateConfig({ ...validConfig, moduleTitle: "" });
      expect(errors).toContain("moduleTitle is required");
    });

    it("requires at least one palette", () => {
      const errors = validateConfig({ ...validConfig, palettes: [] });
      expect(errors.some((e) => e.includes("palette"))).toBe(true);
    });

    it("requires at least one font", () => {
      const errors = validateConfig({ ...validConfig, fonts: [] });
      expect(errors.some((e) => e.includes("font"))).toBe(true);
    });

    it("requires at least one layout", () => {
      const errors = validateConfig({ ...validConfig, layouts: [] });
      expect(errors.some((e) => e.includes("layout"))).toBe(true);
    });

    it("validates palette colors are valid hex", () => {
      const bad = {
        ...validConfig,
        palettes: [{ id: "bad", name: "Bad", colors: ["#fff", "invalid", "#000", "#111", "#222"] as [string, string, string, string, string] }],
      };
      const errors = validateConfig(bad);
      expect(errors.some((e) => e.includes("invalid hex"))).toBe(true);
    });

    it("validates palette has exactly 5 colors", () => {
      const bad = {
        ...validConfig,
        palettes: [{ id: "bad", name: "Bad", colors: ["#fff", "#000", "#111"] as unknown as [string, string, string, string, string] }],
      };
      const errors = validateConfig(bad);
      expect(errors.some((e) => e.includes("exactly 5"))).toBe(true);
    });

    it("validates font has headingFont", () => {
      const bad = {
        ...validConfig,
        fonts: [{ id: "bad", name: "Bad", headingFont: "", bodyFont: "sans", googleFonts: [] }],
      };
      const errors = validateConfig(bad);
      expect(errors.some((e) => e.includes("headingFont"))).toBe(true);
    });
  });

  describe("generateWizard", () => {
    const output = generateWizard(validConfig);

    describe("settingsModel", () => {
      it("generates Python model file", () => {
        expect(output.settingsModel.path).toBe("models/res_config_settings.py");
      });

      it("inherits res.config.settings", () => {
        expect(output.settingsModel.content).toContain("_inherit = 'res.config.settings'");
      });

      it("contains color palette Selection field", () => {
        expect(output.settingsModel.content).toContain("theme_color_palette = fields.Selection");
      });

      it("contains font preset Selection field", () => {
        expect(output.settingsModel.content).toContain("theme_font_preset = fields.Selection");
      });

      it("contains layout style Selection field", () => {
        expect(output.settingsModel.content).toContain("theme_layout_style = fields.Selection");
      });

      it("contains custom primary color Char field", () => {
        expect(output.settingsModel.content).toContain("theme_primary_color = fields.Char");
      });

      it("contains custom font Char fields", () => {
        expect(output.settingsModel.content).toContain("theme_custom_heading_font = fields.Char");
        expect(output.settingsModel.content).toContain("theme_custom_body_font = fields.Char");
      });

      it("uses config_parameter for all fields", () => {
        expect(output.settingsModel.content).toContain("config_parameter='theme_starter.color_palette'");
        expect(output.settingsModel.content).toContain("config_parameter='theme_starter.font_preset'");
      });

      it("includes palette selection options", () => {
        expect(output.settingsModel.content).toContain("'modern', 'Modern Blue'");
        expect(output.settingsModel.content).toContain("'nature', 'Nature Green'");
      });

      it("includes get_color_palette_values method", () => {
        expect(output.settingsModel.content).toContain("def get_color_palette_values");
      });

      it("includes set_values and get_values methods", () => {
        expect(output.settingsModel.content).toContain("def set_values(self):");
        expect(output.settingsModel.content).toContain("def get_values(self):");
      });

      it("uses PascalCase class name", () => {
        expect(output.settingsModel.content).toContain("class ThemeStarterConfigSettings");
      });
    });

    describe("settingsView", () => {
      it("generates XML view file", () => {
        expect(output.settingsView.path).toBe("views/res_config_settings_views.xml");
      });

      it("inherits base settings form", () => {
        expect(output.settingsView.content).toContain('ref="base.res_config_settings_view_form"');
      });

      it("contains color palette field", () => {
        expect(output.settingsView.content).toContain('name="theme_color_palette"');
      });

      it("contains font preset field", () => {
        expect(output.settingsView.content).toContain('name="theme_font_preset"');
      });

      it("contains layout style field", () => {
        expect(output.settingsView.content).toContain('name="theme_layout_style"');
      });

      it("uses radio widget for selection fields", () => {
        expect(output.settingsView.content).toContain('widget="radio"');
      });

      it("includes section headings", () => {
        expect(output.settingsView.content).toContain("Theme Appearance");
        expect(output.settingsView.content).toContain("Typography");
        expect(output.settingsView.content).toContain("Layout");
      });

      it("sets data-key to module name", () => {
        expect(output.settingsView.content).toContain('data-key="theme_starter"');
      });
    });

    describe("defaultData", () => {
      it("generates XML data file", () => {
        expect(output.defaultData.path).toBe("data/theme_defaults.xml");
      });

      it("sets noupdate=1", () => {
        expect(output.defaultData.content).toContain('noupdate="1"');
      });

      it("sets default palette parameter", () => {
        expect(output.defaultData.content).toContain("theme_starter.color_palette");
        expect(output.defaultData.content).toContain(">modern<");
      });

      it("sets default font parameter", () => {
        expect(output.defaultData.content).toContain("theme_starter.font_preset");
        expect(output.defaultData.content).toContain(">inter<");
      });

      it("sets default layout parameter", () => {
        expect(output.defaultData.content).toContain("theme_starter.layout_style");
        expect(output.defaultData.content).toContain(">standard<");
      });
    });
  });

  describe("DEFAULT_PALETTES", () => {
    it("has at least 3 palettes", () => {
      expect(DEFAULT_PALETTES.length).toBeGreaterThanOrEqual(3);
    });

    it("all palettes have 5 valid hex colors", () => {
      for (const p of DEFAULT_PALETTES) {
        expect(p.colors).toHaveLength(5);
        for (const c of p.colors) {
          expect(isValidHex(c)).toBe(true);
        }
      }
    });
  });

  describe("DEFAULT_FONTS", () => {
    it("has at least 3 font options", () => {
      expect(DEFAULT_FONTS.length).toBeGreaterThanOrEqual(3);
    });

    it("all fonts have heading and body families", () => {
      for (const f of DEFAULT_FONTS) {
        expect(f.headingFont.length).toBeGreaterThan(0);
        expect(f.bodyFont.length).toBeGreaterThan(0);
      }
    });
  });
});
