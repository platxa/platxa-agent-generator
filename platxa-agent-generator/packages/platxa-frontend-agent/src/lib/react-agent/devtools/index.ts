/**
 * Browser DevTools Panel Module
 *
 * Provides tools for inspecting brand tokens in the browser.
 *
 * @module react-agent/devtools
 *
 * @example
 * ```typescript
 * import { installDevTools, createDevToolsState } from "@platxa/frontend-agent/devtools"
 *
 * // Install devtools on window for console access
 * installDevTools({ enableLogging: true })
 *
 * // Or get state programmatically
 * const state = createDevToolsState()
 * console.log(state.brand.name)
 * console.log(state.tokenGroups)
 * ```
 */

export {
  // State management
  createDevToolsState,
  refreshDevToolsState,
  filterTokens,
  // Token extraction
  extractCSSVariables,
  parseTokens,
  groupTokens,
  categorizeVariable,
  // Theme mode
  detectThemeMode,
  isDarkModeActive,
  toggleThemeMode,
  setThemeMode,
  // Brand info
  getBrandInfo,
  extractThemeConfig,
  // Utilities
  logTokensToConsole,
  copyTokensToClipboard,
  installDevTools,
  // Default export
  default,
  // Types
  type TokenCategory,
  type TokenValue,
  type TokenGroup,
  type BrandInfo,
  type DevToolsPanelState,
  type DevToolsConfig,
} from "./devtools-panel"
