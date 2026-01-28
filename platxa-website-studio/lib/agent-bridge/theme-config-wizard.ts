/**
 * Theme Configuration Wizard
 *
 * Generates Odoo res.config.settings extension with color palette
 * selector and font options for theme installation.
 */

// =============================================================================
// Types
// =============================================================================

/** A selectable color palette preset */
export interface ColorPalette {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Odoo color slots (o-color-1 through o-color-5) */
  colors: [string, string, string, string, string];
}

/** A selectable font option */
export interface FontOption {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Heading font family */
  headingFont: string;
  /** Body font family */
  bodyFont: string;
  /** Google Fonts families to load */
  googleFonts: string[];
}

/** Layout option for the theme */
export interface LayoutOption {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Header style */
  headerStyle: "standard" | "transparent" | "sidebar";
  /** Footer columns count */
  footerColumns: number;
}

/** Full wizard configuration */
export interface WizardConfig {
  /** Module technical name */
  moduleName: string;
  /** Module display name */
  moduleTitle: string;
  /** Available color palettes */
  palettes: ColorPalette[];
  /** Available font options */
  fonts: FontOption[];
  /** Available layout options */
  layouts: LayoutOption[];
}

/** Generated wizard files */
export interface WizardOutput {
  /** Python model file for res.config.settings extension */
  settingsModel: GeneratedFile;
  /** XML view file for the settings form */
  settingsView: GeneratedFile;
  /** XML data file with default values */
  defaultData: GeneratedFile;
}

export interface GeneratedFile {
  /** Path relative to module root */
  path: string;
  /** File content */
  content: string;
}

// =============================================================================
// Default Presets
// =============================================================================

export const DEFAULT_PALETTES: ColorPalette[] = [
  {
    id: "modern",
    name: "Modern Blue",
    colors: ["#1a73e8", "#fbbc04", "#333333", "#ffffff", "#f5f5f5"],
  },
  {
    id: "nature",
    name: "Nature Green",
    colors: ["#2d6a4f", "#95d5b2", "#1b4332", "#ffffff", "#f0f7f4"],
  },
  {
    id: "elegant",
    name: "Elegant Dark",
    colors: ["#6c63ff", "#ff6584", "#2d2d2d", "#ffffff", "#f8f9fa"],
  },
];

export const DEFAULT_FONTS: FontOption[] = [
  {
    id: "inter",
    name: "Modern Sans",
    headingFont: "'Inter', sans-serif",
    bodyFont: "'Inter', sans-serif",
    googleFonts: ["Inter:wght@400;500;600;700"],
  },
  {
    id: "playfair",
    name: "Classic Serif",
    headingFont: "'Playfair Display', serif",
    bodyFont: "'Source Sans 3', sans-serif",
    googleFonts: ["Playfair+Display:wght@400;700", "Source+Sans+3:wght@400;600"],
  },
  {
    id: "poppins",
    name: "Friendly Round",
    headingFont: "'Poppins', sans-serif",
    bodyFont: "'Poppins', sans-serif",
    googleFonts: ["Poppins:wght@400;500;600;700"],
  },
];

export const DEFAULT_LAYOUTS: LayoutOption[] = [
  { id: "standard", name: "Standard", headerStyle: "standard", footerColumns: 4 },
  { id: "transparent", name: "Transparent Header", headerStyle: "transparent", footerColumns: 3 },
  { id: "sidebar", name: "Sidebar Navigation", headerStyle: "sidebar", footerColumns: 2 },
];

// =============================================================================
// Python Model Generator
// =============================================================================

function generateSettingsModel(config: WizardConfig): string {
  const cls = toPythonClass(config.moduleName);
  const paletteIds = config.palettes.map((p) => `('${p.id}', '${p.name}')`).join(",\n        ");
  const fontIds = config.fonts.map((f) => `('${f.id}', '${f.name}')`).join(",\n        ");
  const layoutIds = config.layouts.map((l) => `('${l.id}', '${l.name}')`).join(",\n        ");

  return `# -*- coding: utf-8 -*-
from odoo import api, fields, models


class ${cls}ConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    # ── Color Palette ────────────────────────────────────────────────
    theme_color_palette = fields.Selection(
        selection=[
        ${paletteIds}
        ],
        string="Color Palette",
        default='${config.palettes[0]?.id ?? "modern"}',
        config_parameter='${config.moduleName}.color_palette',
    )

    # ── Font Selection ───────────────────────────────────────────────
    theme_font_preset = fields.Selection(
        selection=[
        ${fontIds}
        ],
        string="Font Preset",
        default='${config.fonts[0]?.id ?? "inter"}',
        config_parameter='${config.moduleName}.font_preset',
    )

    # ── Layout Option ────────────────────────────────────────────────
    theme_layout_style = fields.Selection(
        selection=[
        ${layoutIds}
        ],
        string="Layout Style",
        default='${config.layouts[0]?.id ?? "standard"}',
        config_parameter='${config.moduleName}.layout_style',
    )

    # ── Custom Primary Color ─────────────────────────────────────────
    theme_primary_color = fields.Char(
        string="Primary Color",
        config_parameter='${config.moduleName}.primary_color',
        help="Override primary color (hex). Leave empty to use palette default.",
    )

    # ── Custom Font Family ───────────────────────────────────────────
    theme_custom_heading_font = fields.Char(
        string="Custom Heading Font",
        config_parameter='${config.moduleName}.custom_heading_font',
        help="Override heading font family. Leave empty to use preset default.",
    )

    theme_custom_body_font = fields.Char(
        string="Custom Body Font",
        config_parameter='${config.moduleName}.custom_body_font',
        help="Override body font family. Leave empty to use preset default.",
    )

    @api.model
    def get_color_palette_values(self, palette_id):
        """Return the color values for a given palette ID."""
        palettes = {
${config.palettes.map((p) => `            '${p.id}': ${JSON.stringify(p.colors)},`).join("\n")}
        }
        return palettes.get(palette_id, [])

    @api.model
    def get_font_values(self, font_id):
        """Return the font families for a given font preset ID."""
        fonts = {
${config.fonts.map((f) => `            '${f.id}': {'heading': "${f.headingFont}", 'body': "${f.bodyFont}"},`).join("\n")}
        }
        return fonts.get(font_id, {})

    def set_values(self):
        super().set_values()
        # Apply color palette to website
        palette_id = self.theme_color_palette
        colors = self.get_color_palette_values(palette_id)
        if colors:
            website = self.env['website'].get_current_website()
            for i, color in enumerate(colors, 1):
                website.write({f'color_{i}': color})

    def get_values(self):
        res = super().get_values()
        ICP = self.env['ir.config_parameter'].sudo()
        res.update(
            theme_color_palette=ICP.get_param('${config.moduleName}.color_palette', '${config.palettes[0]?.id ?? "modern"}'),
            theme_font_preset=ICP.get_param('${config.moduleName}.font_preset', '${config.fonts[0]?.id ?? "inter"}'),
            theme_layout_style=ICP.get_param('${config.moduleName}.layout_style', '${config.layouts[0]?.id ?? "standard"}'),
            theme_primary_color=ICP.get_param('${config.moduleName}.primary_color', ''),
            theme_custom_heading_font=ICP.get_param('${config.moduleName}.custom_heading_font', ''),
            theme_custom_body_font=ICP.get_param('${config.moduleName}.custom_body_font', ''),
        )
        return res
`;
}

// =============================================================================
// XML View Generator
// =============================================================================

function generateSettingsView(config: WizardConfig): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <record id="res_config_settings_view_form_${config.moduleName}" model="ir.ui.view">
        <field name="name">${config.moduleName}.res.config.settings</field>
        <field name="model">res.config.settings</field>
        <field name="inherit_id" ref="base.res_config_settings_view_form"/>
        <field name="arch" type="xml">
            <xpath expr="//div[hasclass('settings')]" position="inside">
                <div class="app_settings_block" data-string="${config.moduleTitle}" data-key="${config.moduleName}">
                    <h2>Theme Appearance</h2>

                    <!-- Color Palette -->
                    <div class="row mt16 o_settings_container">
                        <div class="col-12 col-lg-6 o_setting_box">
                            <div class="o_setting_left_pane"/>
                            <div class="o_setting_right_pane">
                                <label for="theme_color_palette"/>
                                <div class="text-muted">
                                    Choose a color palette for your website theme
                                </div>
                                <div class="content-group">
                                    <field name="theme_color_palette" widget="radio"/>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Custom Primary Color -->
                    <div class="row mt16 o_settings_container">
                        <div class="col-12 col-lg-6 o_setting_box">
                            <div class="o_setting_left_pane"/>
                            <div class="o_setting_right_pane">
                                <label for="theme_primary_color"/>
                                <div class="text-muted">
                                    Override the primary color with a custom hex value
                                </div>
                                <div class="content-group">
                                    <field name="theme_primary_color" placeholder="#1a73e8"/>
                                </div>
                            </div>
                        </div>
                    </div>

                    <h2>Typography</h2>

                    <!-- Font Preset -->
                    <div class="row mt16 o_settings_container">
                        <div class="col-12 col-lg-6 o_setting_box">
                            <div class="o_setting_left_pane"/>
                            <div class="o_setting_right_pane">
                                <label for="theme_font_preset"/>
                                <div class="text-muted">
                                    Select a font combination for headings and body text
                                </div>
                                <div class="content-group">
                                    <field name="theme_font_preset" widget="radio"/>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Custom Fonts -->
                    <div class="row mt16 o_settings_container">
                        <div class="col-12 col-lg-6 o_setting_box">
                            <div class="o_setting_left_pane"/>
                            <div class="o_setting_right_pane">
                                <label for="theme_custom_heading_font"/>
                                <div class="text-muted">
                                    Override with custom Google Font families
                                </div>
                                <div class="content-group">
                                    <field name="theme_custom_heading_font" placeholder="'Roboto', sans-serif"/>
                                    <field name="theme_custom_body_font" placeholder="'Open Sans', sans-serif"/>
                                </div>
                            </div>
                        </div>
                    </div>

                    <h2>Layout</h2>

                    <!-- Layout Style -->
                    <div class="row mt16 o_settings_container">
                        <div class="col-12 col-lg-6 o_setting_box">
                            <div class="o_setting_left_pane"/>
                            <div class="o_setting_right_pane">
                                <label for="theme_layout_style"/>
                                <div class="text-muted">
                                    Choose the page layout structure
                                </div>
                                <div class="content-group">
                                    <field name="theme_layout_style" widget="radio"/>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </xpath>
        </field>
    </record>
</odoo>
`;
}

// =============================================================================
// Default Data Generator
// =============================================================================

function generateDefaultData(config: WizardConfig): string {
  const defaultPalette = config.palettes[0]?.id ?? "modern";
  const defaultFont = config.fonts[0]?.id ?? "inter";
  const defaultLayout = config.layouts[0]?.id ?? "standard";

  return `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <data noupdate="1">
        <record id="config_default_color_palette" model="ir.config_parameter">
            <field name="key">${config.moduleName}.color_palette</field>
            <field name="value">${defaultPalette}</field>
        </record>
        <record id="config_default_font_preset" model="ir.config_parameter">
            <field name="key">${config.moduleName}.font_preset</field>
            <field name="value">${defaultFont}</field>
        </record>
        <record id="config_default_layout_style" model="ir.config_parameter">
            <field name="key">${config.moduleName}.layout_style</field>
            <field name="value">${defaultLayout}</field>
        </record>
    </data>
</odoo>
`;
}

// =============================================================================
// Utilities
// =============================================================================

/** Convert module name to Python class name: theme_starter → ThemeStarter */
export function toPythonClass(moduleName: string): string {
  return moduleName
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

/** Validates a hex color string */
export function isValidHex(color: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color);
}

/** Validates a WizardConfig */
export function validateConfig(config: WizardConfig): string[] {
  const errors: string[] = [];
  if (!config.moduleName) errors.push("moduleName is required");
  if (!config.moduleTitle) errors.push("moduleTitle is required");
  if (config.palettes.length === 0) errors.push("At least one color palette is required");
  if (config.fonts.length === 0) errors.push("At least one font option is required");
  if (config.layouts.length === 0) errors.push("At least one layout option is required");

  for (const p of config.palettes) {
    if (p.colors.length !== 5) errors.push(`Palette ${p.id}: must have exactly 5 colors`);
    for (const c of p.colors) {
      if (!isValidHex(c)) errors.push(`Palette ${p.id}: invalid hex color ${c}`);
    }
  }

  for (const f of config.fonts) {
    if (!f.headingFont) errors.push(`Font ${f.id}: headingFont is required`);
    if (!f.bodyFont) errors.push(`Font ${f.id}: bodyFont is required`);
  }

  return errors;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Generates all wizard files for theme configuration.
 */
export function generateWizard(config: WizardConfig): WizardOutput {
  return {
    settingsModel: {
      path: `models/res_config_settings.py`,
      content: generateSettingsModel(config),
    },
    settingsView: {
      path: `views/res_config_settings_views.xml`,
      content: generateSettingsView(config),
    },
    defaultData: {
      path: `data/theme_defaults.xml`,
      content: generateDefaultData(config),
    },
  };
}
