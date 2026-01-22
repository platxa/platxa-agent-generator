/**
 * Sass Variable Exporter Module
 *
 * Exports brand tokens as Sass variables for legacy projects.
 *
 * @module react-agent/sass
 *
 * @example
 * ```typescript
 * import { exportToSass, generateThemeSwitcher } from "@platxa/frontend-agent/sass"
 *
 * const sass = exportToSass(themeConfig, {
 *   includeMaps: true,
 *   includeFunctions: true,
 * })
 *
 * // Write files
 * for (const file of sass.files) {
 *   writeFile(`tokens/${file.name}`, file.content)
 * }
 * ```
 */

export {
  // Main functions
  exportToSass,
  exportThemesToSass,
  generateThemeSwitcher,
  // Default export
  default,
  // Types
  type SassExportOptions,
  type SassExport,
  type SassFileInfo,
} from "./sass-exporter"
