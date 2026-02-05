/**
 * Theme System
 *
 * Pre-built themes and theme management for Odoo websites.
 */

export {
  ThemeTemplateRegistry,
  createThemeRegistry,
  getThemeRegistry,
  type ThemeCategory,
  type ColorScheme,
  type Typography,
  type Spacing,
  type LayoutOptions,
  type ThemeTemplate,
  type ThemeFilterOptions,
  type AppliedTheme,
} from "./theme-registry";

// Theme Templates
export {
  minimalTheme,
  minimalLightColors,
  minimalDarkColors,
  minimalTypography,
  minimalSpacing,
  minimalLayout,
  generateMinimalSCSS,
  generateMinimalCSSVariables,
  generateMinimalManifest,
} from "./templates/minimal";

export {
  corporateTheme,
  corporateColors,
  corporateDarkColors,
  corporateTypography,
  corporateSpacing,
  corporateLayout,
  generateCorporateSCSS,
  generateCorporateCSSVariables,
  generateCorporateManifest,
} from "./templates/corporate";

export {
  odooDefaultTheme,
  odooDefaultColors,
  odooDefaultTypography,
  odooDefaultSpacing,
  odooDefaultLayout,
  odooBrandColors,
  odooGrayscale,
  odooBreakpoints,
  generateOdooDefaultSCSS,
  generateOdooDefaultCSSVariables,
  generateOdooDefaultManifest,
} from "./templates/odoo-default";

// SCSS Exporter
export {
  exportThemeToOdooSCSS,
  exportThemeSCSS,
  exportThemeVariables,
  extractGoogleFonts,
  generateGoogleFontsImport,
  getBootstrapVersion,
  type OdooVersion,
  type OdooSCSSExportOptions,
  type OdooSCSSExport,
} from "./odoo-scss-exporter";

// CSS Import
export {
  importCSSTheme,
  importCSSFromFile,
  mergeWithExistingTheme,
  type ExtractedColor,
  type ExtractedFont,
  type ExtractedSpacing,
  type CSSImportResult,
  type CSSImportOptions,
} from "./css-import";
