/**
 * Stylelint Plugin Module
 *
 * Provides Stylelint rules for enforcing brand CSS conventions.
 *
 * @module react-agent/stylelint
 *
 * @example
 * ```typescript
 * import stylelintPlugin from "@platxa/frontend-agent/stylelint"
 *
 * export default {
 *   plugins: [stylelintPlugin],
 *   rules: {
 *     "platxa/enforce-css-variables": true,
 *     "platxa/color-format": ["oklch", { severity: "warning" }],
 *     "platxa/naming-convention": [true, { customPropertyPrefix: "--brand-" }],
 *   },
 * }
 * ```
 */

export {
  // Plugin
  default,
  createStylelintPlugin,
  rules,
  configs,
  // Rules
  createEnforceCSSVariablesRule,
  createColorFormatRule,
  createNamingConventionRule,
  // Utilities
  isCSSVariable,
  isHardcodedColor,
  detectColorFormat,
  isColorProperty,
  extractColors,
  validateCustomPropertyName,
  validateSelectorName,
  // Constants
  COLOR_FORMAT_PATTERNS,
  TOKEN_PROPERTIES,
  NAMED_COLORS,
  DEFAULT_ALLOWED_VALUES,
  NAMESPACE,
  // Types
  type StylelintRule,
  type StylelintPlugin,
  type StylelintResult,
  type StylelintWarnOptions,
  type CSSNode,
  type EnforceCSSVariablesOptions,
  type ColorFormatOptions,
  type NamingConventionOptions,
} from "./stylelint-plugin"
