/**
 * Browser DevTools Panel for Brand Inspection
 *
 * Provides a devtools panel for inspecting brand tokens:
 * - Brand information display
 * - Token explorer (colors, spacing, typography, etc.)
 * - Theme mode toggle (light/dark)
 *
 * @module react-agent/devtools
 */

import type { ThemeConfig, SemanticColors } from "../theme/types"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Token category for organization
 */
export type TokenCategory =
  | "colors"
  | "spacing"
  | "typography"
  | "radius"
  | "shadow"
  | "fontWeight"

/**
 * Individual token value
 */
export interface TokenValue {
  /** Token name */
  name: string
  /** CSS variable name */
  cssVar: string
  /** Current computed value */
  value: string
  /** Category */
  category: TokenCategory
  /** Whether this is a dark mode token */
  isDarkMode?: boolean
}

/**
 * Token group (category)
 */
export interface TokenGroup {
  /** Category name */
  category: TokenCategory
  /** Display label */
  label: string
  /** Tokens in this category */
  tokens: TokenValue[]
  /** Number of tokens */
  count: number
}

/**
 * Brand information
 */
export interface BrandInfo {
  /** Brand/theme name */
  name: string
  /** Current theme mode */
  mode: "light" | "dark" | "system"
  /** Whether dark mode is active */
  isDarkModeActive: boolean
  /** CSS custom properties count */
  tokenCount: number
  /** Last updated timestamp */
  lastUpdated: string
}

/**
 * DevTools panel state
 */
export interface DevToolsPanelState {
  /** Brand information */
  brand: BrandInfo
  /** Grouped tokens */
  tokenGroups: TokenGroup[]
  /** All tokens flat */
  allTokens: TokenValue[]
  /** Selected category filter */
  selectedCategory: TokenCategory | "all"
  /** Search filter */
  searchQuery: string
  /** Is panel expanded */
  isExpanded: boolean
}

/**
 * DevTools panel configuration
 */
export interface DevToolsConfig {
  /** Root element selector to inspect */
  rootSelector?: string
  /** Custom CSS variable prefix */
  variablePrefix?: string
  /** Dark mode class name */
  darkModeClass?: string
  /** Dark mode attribute */
  darkModeAttribute?: string
  /** Enable console logging */
  enableLogging?: boolean
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_CONFIG: Required<DevToolsConfig> = {
  rootSelector: ":root",
  variablePrefix: "--",
  darkModeClass: "dark",
  darkModeAttribute: "data-theme",
  enableLogging: false,
}

const CATEGORY_LABELS: Record<TokenCategory, string> = {
  colors: "Colors",
  spacing: "Spacing",
  typography: "Typography",
  radius: "Border Radius",
  shadow: "Shadows",
  fontWeight: "Font Weights",
}

const CATEGORY_PREFIXES: Record<TokenCategory, string[]> = {
  colors: ["color-", "bg-", "text-", "border-color-"],
  spacing: ["spacing-", "space-", "gap-", "padding-", "margin-"],
  typography: ["font-size-", "line-height-", "letter-spacing-", "text-"],
  radius: ["radius-", "rounded-", "border-radius-"],
  shadow: ["shadow-", "box-shadow-"],
  fontWeight: ["font-weight-", "weight-"],
}

// =============================================================================
// TOKEN EXTRACTION
// =============================================================================

/**
 * Extract CSS custom properties from the document
 */
export function extractCSSVariables(
  config: DevToolsConfig = {}
): Map<string, string> {
  const opts = { ...DEFAULT_CONFIG, ...config }
  const variables = new Map<string, string>()

  if (typeof document === "undefined") {
    return variables
  }

  const root = document.querySelector(opts.rootSelector)
  if (!root) {
    return variables
  }

  const styles = getComputedStyle(root)

  // Get all CSS properties
  for (let i = 0; i < styles.length; i++) {
    const prop = styles[i]
    if (prop.startsWith(opts.variablePrefix)) {
      const value = styles.getPropertyValue(prop).trim()
      variables.set(prop, value)
    }
  }

  return variables
}

/**
 * Categorize a CSS variable name
 */
export function categorizeVariable(name: string): TokenCategory | null {
  const cleanName = name.replace(/^--/, "").toLowerCase()

  for (const [category, prefixes] of Object.entries(CATEGORY_PREFIXES)) {
    for (const prefix of prefixes) {
      if (cleanName.startsWith(prefix)) {
        return category as TokenCategory
      }
    }
  }

  // Default categorization based on common patterns
  if (cleanName.includes("color") || /^[a-z]+-foreground$/.test(cleanName)) {
    return "colors"
  }

  return null
}

/**
 * Parse tokens from CSS variables
 */
export function parseTokens(variables: Map<string, string>): TokenValue[] {
  const tokens: TokenValue[] = []

  for (const [cssVar, value] of variables) {
    const category = categorizeVariable(cssVar)
    if (!category) continue

    const name = cssVar
      .replace(/^--/, "")
      .replace(/-dark$/, "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())

    const isDarkMode = cssVar.endsWith("-dark")

    tokens.push({
      name,
      cssVar,
      value,
      category,
      isDarkMode,
    })
  }

  return tokens
}

/**
 * Group tokens by category
 */
export function groupTokens(tokens: TokenValue[]): TokenGroup[] {
  const groups = new Map<TokenCategory, TokenValue[]>()

  for (const token of tokens) {
    const existing = groups.get(token.category) || []
    existing.push(token)
    groups.set(token.category, existing)
  }

  return Array.from(groups.entries()).map(([category, categoryTokens]) => ({
    category,
    label: CATEGORY_LABELS[category],
    tokens: categoryTokens.sort((a, b) => a.name.localeCompare(b.name)),
    count: categoryTokens.length,
  }))
}

// =============================================================================
// THEME MODE DETECTION
// =============================================================================

/**
 * Detect current theme mode
 */
export function detectThemeMode(
  config: DevToolsConfig = {}
): "light" | "dark" | "system" {
  const opts = { ...DEFAULT_CONFIG, ...config }

  if (typeof document === "undefined") {
    return "system"
  }

  // Check for dark class on html/body
  const html = document.documentElement
  const body = document.body

  if (
    html.classList.contains(opts.darkModeClass) ||
    body?.classList.contains(opts.darkModeClass)
  ) {
    return "dark"
  }

  // Check for data-theme attribute
  const themeAttr =
    html.getAttribute(opts.darkModeAttribute) ||
    body?.getAttribute(opts.darkModeAttribute)

  if (themeAttr === "dark") {
    return "dark"
  }

  if (themeAttr === "light") {
    return "light"
  }

  // Check media query preference
  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  ) {
    return "system"
  }

  return "light"
}

/**
 * Check if dark mode is currently active
 */
export function isDarkModeActive(config: DevToolsConfig = {}): boolean {
  const mode = detectThemeMode(config)

  if (mode === "dark") {
    return true
  }

  if (mode === "system" && typeof window !== "undefined") {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false
  }

  return false
}

// =============================================================================
// THEME MODE TOGGLE
// =============================================================================

/**
 * Toggle theme mode
 */
export function toggleThemeMode(
  config: DevToolsConfig = {}
): "light" | "dark" {
  const opts = { ...DEFAULT_CONFIG, ...config }

  if (typeof document === "undefined") {
    return "light"
  }

  const html = document.documentElement
  const currentMode = detectThemeMode(opts)
  const newMode = currentMode === "dark" ? "light" : "dark"

  // Update class
  if (newMode === "dark") {
    html.classList.add(opts.darkModeClass)
  } else {
    html.classList.remove(opts.darkModeClass)
  }

  // Update attribute
  html.setAttribute(opts.darkModeAttribute, newMode)

  // Dispatch event for listeners
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("theme-mode-change", {
        detail: { mode: newMode, isDark: newMode === "dark" },
      })
    )
  }

  if (opts.enableLogging) {
    console.log(`[DevTools] Theme mode changed to: ${newMode}`)
  }

  return newMode
}

/**
 * Set theme mode explicitly
 */
export function setThemeMode(
  mode: "light" | "dark" | "system",
  config: DevToolsConfig = {}
): void {
  const opts = { ...DEFAULT_CONFIG, ...config }

  if (typeof document === "undefined") {
    return
  }

  const html = document.documentElement

  if (mode === "system") {
    // Remove explicit mode, let system preference take over
    html.classList.remove(opts.darkModeClass)
    html.removeAttribute(opts.darkModeAttribute)
  } else if (mode === "dark") {
    html.classList.add(opts.darkModeClass)
    html.setAttribute(opts.darkModeAttribute, "dark")
  } else {
    html.classList.remove(opts.darkModeClass)
    html.setAttribute(opts.darkModeAttribute, "light")
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("theme-mode-change", {
        detail: { mode, isDark: mode === "dark" },
      })
    )
  }

  if (opts.enableLogging) {
    console.log(`[DevTools] Theme mode set to: ${mode}`)
  }
}

// =============================================================================
// BRAND INFO
// =============================================================================

/**
 * Get brand information from the page
 */
export function getBrandInfo(config: DevToolsConfig = {}): BrandInfo {
  const variables = extractCSSVariables(config)
  const mode = detectThemeMode(config)

  // Try to extract brand name from meta or CSS variable
  let name = "Unknown Brand"

  if (typeof document !== "undefined") {
    const metaBrand = document.querySelector('meta[name="brand"]')
    if (metaBrand) {
      name = metaBrand.getAttribute("content") || name
    }

    // Check for --brand-name variable
    const brandNameVar = variables.get("--brand-name")
    if (brandNameVar) {
      name = brandNameVar.replace(/["']/g, "")
    }
  }

  return {
    name,
    mode,
    isDarkModeActive: isDarkModeActive(config),
    tokenCount: variables.size,
    lastUpdated: new Date().toISOString(),
  }
}

// =============================================================================
// DEVTOOLS PANEL STATE
// =============================================================================

/**
 * Create initial DevTools panel state
 */
export function createDevToolsState(
  config: DevToolsConfig = {}
): DevToolsPanelState {
  const variables = extractCSSVariables(config)
  const allTokens = parseTokens(variables)
  const tokenGroups = groupTokens(allTokens)
  const brand = getBrandInfo(config)

  return {
    brand,
    tokenGroups,
    allTokens,
    selectedCategory: "all",
    searchQuery: "",
    isExpanded: true,
  }
}

/**
 * Filter tokens by category and search query
 */
export function filterTokens(
  state: DevToolsPanelState,
  category: TokenCategory | "all",
  searchQuery: string
): TokenValue[] {
  let filtered = state.allTokens

  // Filter by category
  if (category !== "all") {
    filtered = filtered.filter((t) => t.category === category)
  }

  // Filter by search query
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase()
    filtered = filtered.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.cssVar.toLowerCase().includes(query) ||
        t.value.toLowerCase().includes(query)
    )
  }

  return filtered
}

/**
 * Refresh DevTools state
 */
export function refreshDevToolsState(
  currentState: DevToolsPanelState,
  config: DevToolsConfig = {}
): DevToolsPanelState {
  const newState = createDevToolsState(config)

  return {
    ...newState,
    selectedCategory: currentState.selectedCategory,
    searchQuery: currentState.searchQuery,
    isExpanded: currentState.isExpanded,
  }
}

// =============================================================================
// CONSOLE UTILITIES
// =============================================================================

/**
 * Log brand tokens to console in a formatted way
 */
export function logTokensToConsole(config: DevToolsConfig = {}): void {
  const state = createDevToolsState(config)

  console.group("🎨 Brand Tokens")
  console.log(`Brand: ${state.brand.name}`)
  console.log(`Mode: ${state.brand.mode}`)
  console.log(`Total Tokens: ${state.brand.tokenCount}`)
  console.log("")

  for (const group of state.tokenGroups) {
    console.group(`${group.label} (${group.count})`)
    console.table(
      group.tokens.map((t) => ({
        Name: t.name,
        Variable: t.cssVar,
        Value: t.value,
      }))
    )
    console.groupEnd()
  }

  console.groupEnd()
}

/**
 * Copy tokens to clipboard as JSON
 */
export async function copyTokensToClipboard(
  config: DevToolsConfig = {}
): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return false
  }

  const state = createDevToolsState(config)
  const data = {
    brand: state.brand,
    tokens: state.tokenGroups.reduce(
      (acc, group) => {
        acc[group.category] = group.tokens.reduce(
          (tokens, t) => {
            tokens[t.cssVar] = t.value
            return tokens
          },
          {} as Record<string, string>
        )
        return acc
      },
      {} as Record<string, Record<string, string>>
    ),
  }

  try {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    return true
  } catch {
    return false
  }
}

// =============================================================================
// THEME CONFIG EXTRACTION
// =============================================================================

/**
 * Extract theme config from CSS variables
 */
export function extractThemeConfig(
  config: DevToolsConfig = {}
): Partial<ThemeConfig> {
  const variables = extractCSSVariables(config)
  const tokens = parseTokens(variables)
  const brand = getBrandInfo(config)

  const colors: Partial<SemanticColors> = {}
  const spacing: Record<string, string> = {}
  const typography: Record<string, { fontSize?: string; lineHeight?: string }> =
    {}
  const radius: Record<string, string> = {}
  const shadow: Record<string, string> = {}
  const fontWeight: Record<string, number> = {}

  for (const token of tokens) {
    if (token.isDarkMode) continue // Skip dark mode variants for base config

    const key = token.cssVar
      .replace(/^--/, "")
      .replace(/-([a-z])/g, (_, c) => c.toUpperCase())

    switch (token.category) {
      case "colors": {
        const colorKey = key
          .replace(/^color/, "")
          .replace(/^[A-Z]/, (c) => c.toLowerCase())
        if (colorKey) {
          ;(colors as Record<string, string>)[colorKey] = token.value
        }
        break
      }
      case "spacing": {
        const spacingKey = key.replace(/^spacing/, "")
        if (spacingKey) {
          spacing[spacingKey] = token.value
        }
        break
      }
      case "typography": {
        if (key.startsWith("fontSize")) {
          const typoKey = key.replace(/^fontSize/, "").toLowerCase() || "base"
          typography[typoKey] = typography[typoKey] || {}
          typography[typoKey].fontSize = token.value
        } else if (key.startsWith("lineHeight")) {
          const typoKey =
            key.replace(/^lineHeight/, "").toLowerCase() || "base"
          typography[typoKey] = typography[typoKey] || {}
          typography[typoKey].lineHeight = token.value
        }
        break
      }
      case "radius": {
        const radiusKey = key.replace(/^radius/, "").toLowerCase() || "default"
        radius[radiusKey] = token.value
        break
      }
      case "shadow": {
        const shadowKey = key.replace(/^shadow/, "").toLowerCase() || "default"
        shadow[shadowKey] = token.value
        break
      }
      case "fontWeight": {
        const weightKey =
          key.replace(/^fontWeight/, "").toLowerCase() || "normal"
        const weightValue = parseInt(token.value, 10)
        if (!isNaN(weightValue)) {
          fontWeight[weightKey] = weightValue
        }
        break
      }
    }
  }

  return {
    name: brand.name,
    light: {
      colors: colors as SemanticColors,
      spacing,
      typography,
      radius,
      shadow,
      fontWeight,
    },
  }
}

// =============================================================================
// WINDOW INTEGRATION
// =============================================================================

/**
 * Install DevTools panel on window for console access
 */
export function installDevTools(config: DevToolsConfig = {}): void {
  if (typeof window === "undefined") {
    return
  }

  const devTools = {
    getState: () => createDevToolsState(config),
    getBrandInfo: () => getBrandInfo(config),
    getTokens: () => parseTokens(extractCSSVariables(config)),
    toggleTheme: () => toggleThemeMode(config),
    setTheme: (mode: "light" | "dark" | "system") => setThemeMode(mode, config),
    logTokens: () => logTokensToConsole(config),
    copyTokens: () => copyTokensToClipboard(config),
    extractConfig: () => extractThemeConfig(config),
    refresh: () => createDevToolsState(config),
  }

  // Install on window
  ;(window as unknown as Record<string, unknown>).__BRAND_DEVTOOLS__ = devTools

  if (config.enableLogging ?? DEFAULT_CONFIG.enableLogging) {
    console.log(
      "[DevTools] Brand DevTools installed. Access via window.__BRAND_DEVTOOLS__"
    )
    console.log("Available methods:")
    console.log("  - getState(): Get full panel state")
    console.log("  - getBrandInfo(): Get brand information")
    console.log("  - getTokens(): Get all tokens")
    console.log("  - toggleTheme(): Toggle light/dark mode")
    console.log("  - setTheme(mode): Set theme mode")
    console.log("  - logTokens(): Log tokens to console")
    console.log("  - copyTokens(): Copy tokens to clipboard")
    console.log("  - extractConfig(): Extract ThemeConfig object")
    console.log("  - refresh(): Refresh state")
  }
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default {
  // State
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
}
