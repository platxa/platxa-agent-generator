/**
 * PostCSS Plugin for Platxa Brand Token Processing
 *
 * @module react-agent/postcss
 *
 * @example Basic usage
 * ```javascript
 * // postcss.config.js
 * const { platxaTokens } = require("@platxa/frontend-agent/postcss")
 *
 * module.exports = {
 *   plugins: [
 *     platxaTokens()
 *   ]
 * }
 * ```
 *
 * @example With Tailwind CSS
 * ```javascript
 * // postcss.config.js
 * const { platxaTokens } = require("@platxa/frontend-agent/postcss")
 *
 * module.exports = {
 *   plugins: [
 *     platxaTokens({ injectTokens: true }),
 *     require("tailwindcss"),
 *     require("autoprefixer")
 *   ]
 * }
 * ```
 *
 * @example Using directives in CSS
 * ```
 * @platxa tokens;
 * @platxa colors;
 * @platxa spacing;
 * @platxa typography;
 * @platxa theme;
 *
 * .button {
 *   background: brand(primary);
 *   color: brand(primaryForeground);
 *   padding: token(spacing.md) token(spacing.lg);
 *   border-radius: token(radius.md);
 * }
 * ```
 */

export {
  platxaTokens,
  postcssPluginPlatxa,
  default as default,
  type PlatxaPostCSSOptions,
} from "./postcss-plugin"
