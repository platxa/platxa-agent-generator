/**
 * ESLint Plugin for Platxa Brand Token Usage
 *
 * @module react-agent/eslint
 *
 * @example Flat config (ESLint 9+)
 * ```javascript
 * import platxaPlugin from "@platxa/frontend-agent/eslint"
 *
 * export default [
 *   {
 *     plugins: { platxa: platxaPlugin },
 *     rules: {
 *       "platxa/no-hardcoded-colors": "warn",
 *       "platxa/prefer-brand-token": "warn",
 *     },
 *   },
 * ]
 * ```
 *
 * @example Using presets
 * ```javascript
 * import { flatConfigRecommended } from "@platxa/frontend-agent/eslint"
 *
 * export default [
 *   flatConfigRecommended,
 *   // your other config...
 * ]
 * ```
 *
 * @example Legacy config (.eslintrc)
 * ```json
 * {
 *   "plugins": ["@platxa/frontend-agent"],
 *   "extends": ["plugin:@platxa/frontend-agent/recommended"]
 * }
 * ```
 */

export {
  plugin,
  flatConfigRecommended,
  flatConfigStrict,
  default as default,
  // Utility exports for custom rule development
  isColorValue,
  isColorProperty,
  extractColorsFromValue,
  suggestTokenForColor,
  COLOR_PATTERNS,
  COLOR_PROPERTIES,
  NAMED_COLORS,
  DEFAULT_ALLOWED_COLORS,
  // Types
  type NoHardcodedColorsOptions,
  type PreferBrandTokenOptions,
} from "./eslint-plugin"
