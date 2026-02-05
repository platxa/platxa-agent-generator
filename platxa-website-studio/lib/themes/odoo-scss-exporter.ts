/**
 * Odoo SCSS Variables Exporter
 *
 * Converts theme configurations to Odoo-compatible SCSS variable format.
 * Generates SCSS files that integrate with Odoo's website theming system.
 *
 * Features:
 * - Bootstrap 5 variable mapping for Odoo 16/17
 * - Legacy Bootstrap 4 support for Odoo 14/15
 * - CSS custom properties generation
 * - Font imports and Google Fonts integration
 * - Responsive breakpoint configuration
 *
 * Feature #68: Theme System - Odoo SCSS Export
 */

import type { ThemeTemplate, ColorScheme, Typography, Spacing, LayoutOptions } from "./theme-registry";

// =============================================================================
// Types
// =============================================================================

/** Odoo version targeting */
export type OdooVersion = "14.0" | "15.0" | "16.0" | "17.0";

/** Export options for SCSS generation */
export interface OdooSCSSExportOptions {
  /** Target Odoo version (affects Bootstrap version) */
  odooVersion: OdooVersion;
  /** Include CSS custom properties */
  includeCssVariables?: boolean;
  /** Include Google Fonts import */
  includeGoogleFonts?: boolean;
  /** Theme module name for asset paths */
  moduleName?: string;
  /** Generate minified output */
  minify?: boolean;
  /** Include comments and documentation */
  includeComments?: boolean;
  /** Dark mode variant */
  darkMode?: boolean;
}

/** Exported SCSS structure */
export interface OdooSCSSExport {
  /** Main variables file content */
  variables: string;
  /** Primary colors SCSS */
  colors: string;
  /** Typography SCSS */
  typography: string;
  /** Spacing and layout SCSS */
  spacing: string;
  /** Component overrides SCSS */
  components: string;
  /** Combined full SCSS */
  full: string;
  /** Odoo manifest data section */
  manifestAssets: Record<string, string[]>;
}

// =============================================================================
// Bootstrap Variable Mappings
// =============================================================================

/** Bootstrap 5 variable names (Odoo 16/17) */
const BOOTSTRAP5_COLOR_VARS: Record<keyof ColorScheme, string> = {
  primary: "$primary",
  secondary: "$secondary",
  background: "$body-bg",
  surface: "$card-bg",
  text: "$body-color",
  textMuted: "$text-muted",
  border: "$border-color",
  success: "$success",
  warning: "$warning",
  error: "$danger",
};

/** Bootstrap 4 variable names (Odoo 14/15) */
const BOOTSTRAP4_COLOR_VARS: Record<keyof ColorScheme, string> = {
  primary: "$primary",
  secondary: "$secondary",
  background: "$body-bg",
  surface: "$card-bg",
  text: "$body-color",
  textMuted: "$text-muted",
  border: "$border-color",
  success: "$success",
  warning: "$warning",
  error: "$danger",
};

/** Typography variable mappings */
const TYPOGRAPHY_VARS = {
  headingFont: "$headings-font-family",
  bodyFont: "$font-family-base",
  baseFontSize: "$font-size-base",
  lineHeight: "$line-height-base",
  headingWeight: "$headings-font-weight",
};

/** Spacing variable mappings */
const SPACING_VARS = {
  containerWidth: "$container-max-width",
  gap: "$spacer",
  borderRadius: "$border-radius",
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Detect Google Fonts from font stack
 */
function extractGoogleFonts(fontStack: string): string[] {
  const googleFonts: string[] = [];
  const knownGoogleFonts = [
    "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins",
    "Source Sans Pro", "Nunito", "Raleway", "Playfair Display", "Merriweather",
    "PT Sans", "Oswald", "Quicksand", "Work Sans", "Fira Sans", "Rubik",
    "Noto Sans", "Ubuntu", "Mulish", "Georgia", "Source Serif Pro",
  ];

  for (const font of knownGoogleFonts) {
    if (fontStack.includes(font)) {
      googleFonts.push(font);
    }
  }

  return googleFonts;
}

/**
 * Generate Google Fonts import URL
 */
function generateGoogleFontsImport(fonts: string[], weights: string[] = ["400", "500", "600", "700"]): string {
  if (fonts.length === 0) return "";

  const fontParams = fonts.map(font => {
    const encodedFont = font.replace(/ /g, "+");
    return `family=${encodedFont}:wght@${weights.join(";")}`;
  }).join("&");

  return `@import url('https://fonts.googleapis.com/css2?${fontParams}&display=swap');`;
}

/**
 * Convert hex color to SCSS variable assignment
 */
function colorToScss(varName: string, value: string, comment?: string): string {
  const commentStr = comment ? ` // ${comment}` : "";
  return `${varName}: ${value} !default;${commentStr}`;
}

/**
 * Get Bootstrap version for Odoo version
 */
function getBootstrapVersion(odooVersion: OdooVersion): "4" | "5" {
  return odooVersion === "14.0" || odooVersion === "15.0" ? "4" : "5";
}

// =============================================================================
// SCSS Generators
// =============================================================================

/**
 * Generate color variables SCSS
 */
function generateColorsSCSS(
  colors: ColorScheme,
  options: OdooSCSSExportOptions
): string {
  const bootstrapVersion = getBootstrapVersion(options.odooVersion);
  const colorVars = bootstrapVersion === "5" ? BOOTSTRAP5_COLOR_VARS : BOOTSTRAP4_COLOR_VARS;
  const lines: string[] = [];

  if (options.includeComments !== false) {
    lines.push("// =============================================================================");
    lines.push("// Color Variables");
    lines.push("// =============================================================================");
    lines.push("");
  }

  // Primary palette
  lines.push(colorToScss(colorVars.primary, colors.primary, "Primary brand color"));
  lines.push(colorToScss(colorVars.secondary, colors.secondary, "Secondary color"));
  lines.push("");

  // Background colors
  lines.push(colorToScss(colorVars.background, colors.background, "Page background"));
  lines.push(colorToScss(colorVars.surface, colors.surface, "Card/surface background"));
  lines.push("");

  // Text colors
  lines.push(colorToScss(colorVars.text, colors.text, "Primary text color"));
  lines.push(colorToScss(colorVars.textMuted, colors.textMuted, "Muted/secondary text"));
  lines.push("");

  // Border
  lines.push(colorToScss(colorVars.border, colors.border, "Border color"));
  lines.push("");

  // State colors
  lines.push(colorToScss(colorVars.success, colors.success, "Success state"));
  lines.push(colorToScss(colorVars.warning, colors.warning, "Warning state"));
  lines.push(colorToScss(colorVars.error, colors.error, "Error/danger state"));

  // Odoo-specific color variables
  if (options.includeComments !== false) {
    lines.push("");
    lines.push("// Odoo-specific color mappings");
  }
  lines.push(`$o-brand-primary: ${colors.primary} !default;`);
  lines.push(`$o-brand-secondary: ${colors.secondary} !default;`);

  return lines.join("\n");
}

/**
 * Generate typography SCSS
 */
function generateTypographySCSS(
  typography: Typography,
  options: OdooSCSSExportOptions
): string {
  const lines: string[] = [];

  // Google Fonts import
  if (options.includeGoogleFonts !== false) {
    const googleFonts = [
      ...extractGoogleFonts(typography.headingFont),
      ...extractGoogleFonts(typography.bodyFont),
    ];
    const uniqueFonts = [...new Set(googleFonts)];

    if (uniqueFonts.length > 0) {
      lines.push(generateGoogleFontsImport(uniqueFonts));
      lines.push("");
    }
  }

  if (options.includeComments !== false) {
    lines.push("// =============================================================================");
    lines.push("// Typography Variables");
    lines.push("// =============================================================================");
    lines.push("");
  }

  // Font families
  lines.push(`${TYPOGRAPHY_VARS.bodyFont}: ${typography.bodyFont} !default;`);
  lines.push(`${TYPOGRAPHY_VARS.headingFont}: ${typography.headingFont} !default;`);
  lines.push("");

  // Font sizes
  lines.push(`${TYPOGRAPHY_VARS.baseFontSize}: ${typography.baseFontSize} !default;`);
  lines.push(`${TYPOGRAPHY_VARS.lineHeight}: ${typography.lineHeight} !default;`);
  lines.push(`${TYPOGRAPHY_VARS.headingWeight}: ${typography.headingWeight} !default;`);

  // Heading sizes (responsive)
  if (options.includeComments !== false) {
    lines.push("");
    lines.push("// Heading sizes");
  }
  lines.push("$h1-font-size: 2.5rem !default;");
  lines.push("$h2-font-size: 2rem !default;");
  lines.push("$h3-font-size: 1.75rem !default;");
  lines.push("$h4-font-size: 1.5rem !default;");
  lines.push("$h5-font-size: 1.25rem !default;");
  lines.push("$h6-font-size: 1rem !default;");

  return lines.join("\n");
}

/**
 * Generate spacing and layout SCSS
 */
function generateSpacingSCSS(
  spacing: Spacing,
  layout: LayoutOptions,
  options: OdooSCSSExportOptions
): string {
  const lines: string[] = [];

  if (options.includeComments !== false) {
    lines.push("// =============================================================================");
    lines.push("// Spacing & Layout Variables");
    lines.push("// =============================================================================");
    lines.push("");
  }

  // Container
  lines.push(`${SPACING_VARS.containerWidth}: ${spacing.containerWidth} !default;`);
  lines.push("");

  // Spacer base (used for margins/padding utilities)
  lines.push(`${SPACING_VARS.gap}: ${spacing.gap} !default;`);
  lines.push("");

  // Border radius
  lines.push(`${SPACING_VARS.borderRadius}: ${spacing.borderRadius} !default;`);
  lines.push("$border-radius-sm: calc(#{$border-radius} * 0.5) !default;");
  lines.push("$border-radius-lg: calc(#{$border-radius} * 1.5) !default;");
  lines.push("$border-radius-xl: calc(#{$border-radius} * 2) !default;");
  lines.push("");

  // Section padding (Odoo-specific)
  if (options.includeComments !== false) {
    lines.push("// Section padding for website blocks");
  }
  lines.push(`$o-section-padding-y: ${spacing.sectionPadding} !default;`);
  lines.push(`$o-section-padding-y-sm: calc(#{$o-section-padding-y} / 2) !default;`);

  // Breakpoints
  if (options.includeComments !== false) {
    lines.push("");
    lines.push("// Responsive breakpoints");
  }
  lines.push("$grid-breakpoints: (");
  lines.push("  xs: 0,");
  lines.push("  sm: 576px,");
  lines.push("  md: 768px,");
  lines.push("  lg: 992px,");
  lines.push("  xl: 1200px,");
  if (getBootstrapVersion(options.odooVersion) === "5") {
    lines.push("  xxl: 1400px,");
  }
  lines.push(") !default;");

  return lines.join("\n");
}

/**
 * Generate component overrides SCSS
 */
function generateComponentsSCSS(
  theme: ThemeTemplate,
  options: OdooSCSSExportOptions
): string {
  const lines: string[] = [];
  const moduleName = options.moduleName || `theme_${theme.id.replace(/-/g, "_")}`;

  if (options.includeComments !== false) {
    lines.push("// =============================================================================");
    lines.push("// Component Overrides");
    lines.push("// =============================================================================");
    lines.push("");
  }

  // Card component
  lines.push(".card {");
  lines.push("  border-radius: $border-radius;");
  lines.push("  border-color: $border-color;");
  lines.push("  background-color: $card-bg;");
  lines.push("}");
  lines.push("");

  // Button overrides
  lines.push(".btn {");
  lines.push("  border-radius: $border-radius;");
  lines.push("  font-weight: 500;");
  lines.push("  transition: all 0.2s ease;");
  lines.push("}");
  lines.push("");

  // Navbar/header styles based on layout
  if (theme.layout.headerStyle === "sticky") {
    lines.push(".o_header_standard {");
    lines.push("  position: sticky;");
    lines.push("  top: 0;");
    lines.push("  z-index: 1020;");
    lines.push("}");
    lines.push("");
  } else if (theme.layout.headerStyle === "floating") {
    lines.push(".o_header_standard {");
    lines.push("  position: absolute;");
    lines.push("  top: 0;");
    lines.push("  left: 0;");
    lines.push("  right: 0;");
    lines.push("  z-index: 1020;");
    lines.push("  background: transparent;");
    lines.push("}");
    lines.push("");
  }

  // Section styling
  lines.push("section, .s_section {");
  lines.push("  padding-top: $o-section-padding-y;");
  lines.push("  padding-bottom: $o-section-padding-y;");
  lines.push("");
  lines.push("  @media (max-width: map-get($grid-breakpoints, md)) {");
  lines.push("    padding-top: $o-section-padding-y-sm;");
  lines.push("    padding-bottom: $o-section-padding-y-sm;");
  lines.push("  }");
  lines.push("}");
  lines.push("");

  // Link styling
  lines.push("a {");
  lines.push("  color: $primary;");
  lines.push("  text-decoration: none;");
  lines.push("  transition: color 0.2s ease;");
  lines.push("");
  lines.push("  &:hover {");
  lines.push("    color: darken($primary, 10%);");
  lines.push("  }");
  lines.push("}");

  return lines.join("\n");
}

/**
 * Generate CSS custom properties
 */
function generateCSSVariables(
  theme: ThemeTemplate,
  options: OdooSCSSExportOptions
): string {
  const lines: string[] = [];

  if (options.includeComments !== false) {
    lines.push("// =============================================================================");
    lines.push("// CSS Custom Properties");
    lines.push("// =============================================================================");
    lines.push("");
  }

  lines.push(":root {");

  // Colors
  lines.push("  // Colors");
  lines.push(`  --theme-primary: #{$primary};`);
  lines.push(`  --theme-secondary: #{$secondary};`);
  lines.push(`  --theme-background: #{$body-bg};`);
  lines.push(`  --theme-surface: #{$card-bg};`);
  lines.push(`  --theme-text: #{$body-color};`);
  lines.push(`  --theme-text-muted: #{$text-muted};`);
  lines.push(`  --theme-border: #{$border-color};`);
  lines.push(`  --theme-success: #{$success};`);
  lines.push(`  --theme-warning: #{$warning};`);
  lines.push(`  --theme-error: #{$danger};`);
  lines.push("");

  // Typography
  lines.push("  // Typography");
  lines.push(`  --theme-font-family: #{$font-family-base};`);
  lines.push(`  --theme-font-heading: #{$headings-font-family};`);
  lines.push(`  --theme-font-size: #{$font-size-base};`);
  lines.push(`  --theme-line-height: #{$line-height-base};`);
  lines.push("");

  // Spacing
  lines.push("  // Spacing");
  lines.push(`  --theme-radius: #{$border-radius};`);
  lines.push(`  --theme-gap: #{$spacer};`);
  lines.push(`  --theme-section-padding: #{$o-section-padding-y};`);

  lines.push("}");

  return lines.join("\n");
}

// =============================================================================
// Main Export Function
// =============================================================================

/**
 * Export theme to Odoo SCSS format
 */
export function exportThemeToOdooSCSS(
  theme: ThemeTemplate,
  options: OdooSCSSExportOptions
): OdooSCSSExport {
  const moduleName = options.moduleName || `theme_${theme.id.replace(/-/g, "_")}`;

  // Generate individual sections
  const colors = generateColorsSCSS(theme.colors, options);
  const typography = generateTypographySCSS(theme.typography, options);
  const spacing = generateSpacingSCSS(theme.spacing, theme.layout, options);
  const components = generateComponentsSCSS(theme, options);

  // Generate variables file (combines colors, typography, spacing)
  const variablesLines: string[] = [];

  if (options.includeComments !== false) {
    variablesLines.push(`// ${theme.name} - Odoo ${options.odooVersion} Theme Variables`);
    variablesLines.push(`// Generated by Platxa Studio`);
    variablesLines.push(`// Version: ${theme.version}`);
    variablesLines.push("");
  }

  variablesLines.push(colors);
  variablesLines.push("");
  variablesLines.push(typography);
  variablesLines.push("");
  variablesLines.push(spacing);

  const variables = variablesLines.join("\n");

  // Generate full combined SCSS
  const fullLines: string[] = [];

  if (options.includeComments !== false) {
    fullLines.push("// =============================================================================");
    fullLines.push(`// ${theme.name}`);
    fullLines.push(`// ${theme.description}`);
    fullLines.push("// =============================================================================");
    fullLines.push(`// Odoo Version: ${options.odooVersion}`);
    fullLines.push(`// Bootstrap: ${getBootstrapVersion(options.odooVersion)}`);
    fullLines.push(`// Generated: ${new Date().toISOString()}`);
    fullLines.push("// =============================================================================");
    fullLines.push("");
  }

  fullLines.push(variables);
  fullLines.push("");
  fullLines.push(components);

  if (options.includeCssVariables !== false) {
    fullLines.push("");
    fullLines.push(generateCSSVariables(theme, options));
  }

  const full = fullLines.join("\n");

  // Generate manifest assets section
  const manifestAssets: Record<string, string[]> = {
    "web.assets_frontend": [
      `/${moduleName}/static/src/scss/variables.scss`,
      `/${moduleName}/static/src/scss/theme.scss`,
    ],
  };

  return {
    variables,
    colors,
    typography,
    spacing,
    components,
    full,
    manifestAssets,
  };
}

/**
 * Quick export for simple use cases
 */
export function exportThemeSCSS(
  theme: ThemeTemplate,
  odooVersion: OdooVersion = "17.0"
): string {
  const result = exportThemeToOdooSCSS(theme, {
    odooVersion,
    includeCssVariables: true,
    includeGoogleFonts: true,
    includeComments: true,
  });
  return result.full;
}

/**
 * Export theme variables only (for customization)
 */
export function exportThemeVariables(
  theme: ThemeTemplate,
  odooVersion: OdooVersion = "17.0"
): string {
  const result = exportThemeToOdooSCSS(theme, {
    odooVersion,
    includeCssVariables: false,
    includeGoogleFonts: true,
    includeComments: true,
  });
  return result.variables;
}

// =============================================================================
// Exports
// =============================================================================

export {
  extractGoogleFonts,
  generateGoogleFontsImport,
  getBootstrapVersion,
};
