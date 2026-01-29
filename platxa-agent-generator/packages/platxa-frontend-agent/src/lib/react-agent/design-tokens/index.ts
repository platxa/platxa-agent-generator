/**
 * Design Tokens Module
 *
 * Tailwind v4 CSS-first theming with @theme directive support.
 * Generates design tokens, CSS variables, and theme configurations.
 */

// Types
export type {
  ColorToken,
  ColorScale,
  SemanticColors,
  ChartColors,
  SpacingScale,
  TypographyTokens,
  BorderRadiusTokens,
  ShadowTokens,
  AnimationTokens,
  BreakpointTokens,
  DesignTokens,
  ThemeDirectiveConfig,
  NamingConvention,
  GeneratedTheme,
  ThemeGenerationOptions,
  TokenValidationResult,
  ColorFormat,
  OklchColor,
  HslColor,
} from "./types"

// Default tokens
export {
  defaultLightColors,
  defaultDarkColors,
  defaultChartColors,
  defaultBorderRadius,
  createDefaultTokens,
} from "./design-tokens"

// Theme generation
export {
  generateThemeDirective,
  generateRootVariables,
  generateDarkVariables,
  generateChartVariables,
  generateTheme,
} from "./design-tokens"

// Token validation
export { validateTokens } from "./design-tokens"

// Color utilities
export {
  hexToHsl,
  hslToHex,
  toOklch,
  parseOklch,
  generateColorScale,
  detectColorFormat,
  createSemanticColorsFromPrimary,
} from "./design-tokens"
