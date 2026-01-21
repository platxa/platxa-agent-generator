/**
 * Vite Plugin for Platxa Frontend Agent
 *
 * Provides automatic brand kit resolution and CSS injection for Vite projects.
 * Supports HMR for development and static CSS generation for production.
 *
 * @example Basic usage
 * ```typescript
 * // vite.config.ts
 * import { defineConfig } from "vite"
 * import { platxaTheme } from "@platxa/frontend-agent/vite"
 *
 * export default defineConfig({
 *   plugins: [platxaTheme()]
 * })
 * ```
 *
 * @example With custom config path
 * ```typescript
 * import { platxaTheme } from "@platxa/frontend-agent/vite"
 *
 * export default defineConfig({
 *   plugins: [platxaTheme({ configPath: "./brand/config.ts" })]
 * })
 * ```
 *
 * @module react-agent/vite
 */

import type { Plugin, ViteDevServer, ResolvedConfig } from "vite"
import { resolveConfig as resolvePlatxaConfig } from "../brand/config"
import { findAndLoadConfig, CONFIG_FILE_NAMES } from "../brand/config-loader"
import {
  generateStaticStylesheet,
  processThemeForBuild,
} from "../theme/theme-worker"
import { getThemePreset } from "../theme/tokens"
import type { FrontendConfig, ResolvedConfig as PlatxaResolvedConfig } from "../brand/types"
import type { ThemeConfig } from "../theme/types"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Vite plugin options
 */
export interface PlatxaVitePluginOptions {
  /**
   * Path to config file (auto-detected if not specified)
   * Supports: platxa.config.ts, platxa.config.js, platxa.config.json
   */
  configPath?: string

  /**
   * Virtual module ID for importing generated CSS
   * @default "virtual:platxa-theme"
   */
  virtualModuleId?: string

  /**
   * Whether to inject CSS into the head automatically
   * @default true
   */
  injectCss?: boolean

  /**
   * CSS file name for build output
   * @default "platxa-theme.css"
   */
  cssFileName?: string

  /**
   * Enable HMR for theme changes
   * @default true
   */
  hmr?: boolean
}

/**
 * Internal plugin state
 */
interface PluginState {
  config: PlatxaResolvedConfig | null
  themeConfig: ThemeConfig | null
  cssContent: string
  configPath: string | null
  viteConfig: ResolvedConfig | null
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_VIRTUAL_MODULE_ID = "virtual:platxa-theme"

// =============================================================================
// VITE PLUGIN
// =============================================================================

/**
 * Vite plugin for Platxa theme integration
 *
 * Features:
 * - Auto-loads platxa.config.ts/js/json from project root
 * - Generates CSS from theme configuration
 * - Provides virtual module for importing theme CSS
 * - Supports HMR for instant theme updates during development
 * - Emits static CSS file during build
 *
 * @param options - Plugin configuration options
 * @returns Vite plugin instance
 *
 * @example Auto-detect config
 * ```typescript
 * // vite.config.ts
 * import { defineConfig } from "vite"
 * import { platxaTheme } from "@platxa/frontend-agent/vite"
 *
 * export default defineConfig({
 *   plugins: [platxaTheme()]
 * })
 * ```
 *
 * @example Import generated CSS in your app
 * ```typescript
 * // main.tsx
 * import "virtual:platxa-theme.css"
 * ```
 *
 * @example Access theme config in code
 * ```typescript
 * // Component.tsx
 * import { themeConfig } from "virtual:platxa-theme"
 * console.log(themeConfig.name)
 * ```
 */
export function platxaTheme(options: PlatxaVitePluginOptions = {}): Plugin {
  const {
    configPath: customConfigPath,
    virtualModuleId = DEFAULT_VIRTUAL_MODULE_ID,
    injectCss = true,
    cssFileName = "platxa-theme.css",
    hmr = true,
  } = options

  const resolvedVirtualModuleId = "\0" + virtualModuleId
  const cssVirtualModuleId = virtualModuleId + ".css"
  const resolvedCssVirtualModuleId = "\0" + cssVirtualModuleId

  // Plugin state
  const state: PluginState = {
    config: null,
    themeConfig: null,
    cssContent: "",
    configPath: null,
    viteConfig: null,
  }

  // Server reference for HMR
  let server: ViteDevServer | null = null

  /**
   * Load and process configuration
   */
  async function loadConfig(rootDir: string): Promise<void> {
    try {
      let userConfig: FrontendConfig | null = null

      // Try custom path first
      if (customConfigPath) {
        const fullPath = customConfigPath.startsWith("/")
          ? customConfigPath
          : `${rootDir}/${customConfigPath}`
        const result = await findAndLoadConfig({ cwd: rootDir, configPath: fullPath })
        if (result.config) {
          userConfig = result.config
          state.configPath = fullPath
        }
      } else {
        // Auto-detect config file
        const result = await findAndLoadConfig({ cwd: rootDir })
        if (result.config) {
          userConfig = result.config
          state.configPath = result.path ?? null
        }
      }

      // Resolve configuration
      state.config = resolvePlatxaConfig(userConfig ?? undefined)

      // Get theme config based on resolved config
      const themeConfig = getThemePreset(state.config.preset)
      state.themeConfig = themeConfig

      // Generate CSS
      state.cssContent = generateStaticStylesheet(themeConfig)
    } catch (error) {
      console.warn("[platxa] Failed to load config:", error)
      // Fall back to defaults
      state.config = resolvePlatxaConfig()
      const defaultThemeConfig = getThemePreset("default")
      state.themeConfig = defaultThemeConfig
      state.cssContent = generateStaticStylesheet(defaultThemeConfig)
    }
  }

  /**
   * Trigger HMR update
   */
  function triggerHmrUpdate(): void {
    if (!server || !hmr) return

    const cssModule = server.moduleGraph.getModuleById(resolvedCssVirtualModuleId)
    const jsModule = server.moduleGraph.getModuleById(resolvedVirtualModuleId)

    if (cssModule) {
      server.moduleGraph.invalidateModule(cssModule)
      server.ws.send({
        type: "update",
        updates: [
          {
            type: "js-update",
            path: cssVirtualModuleId,
            acceptedPath: cssVirtualModuleId,
            timestamp: Date.now(),
          },
        ],
      })
    }

    if (jsModule) {
      server.moduleGraph.invalidateModule(jsModule)
    }

    // Full page reload for CSS changes
    server.ws.send({ type: "full-reload" })
  }

  return {
    name: "platxa-theme",
    enforce: "pre",

    /**
     * Store Vite config
     */
    configResolved(resolvedConfig) {
      state.viteConfig = resolvedConfig
    },

    /**
     * Load config on build start
     */
    async buildStart() {
      if (state.viteConfig) {
        await loadConfig(state.viteConfig.root)
      }
    },

    /**
     * Configure dev server for HMR
     */
    configureServer(devServer) {
      server = devServer

      // Watch config files for changes
      if (hmr && state.viteConfig) {
        const root = state.viteConfig.root
        const watchPaths = CONFIG_FILE_NAMES.map((name) => `${root}/${name}`)

        devServer.watcher.add(watchPaths)

        devServer.watcher.on("change", async (path) => {
          const isConfigFile = CONFIG_FILE_NAMES.some((name) => path.endsWith(name))
          if (isConfigFile || path === state.configPath) {
            console.log("[platxa] Config changed, reloading...")
            await loadConfig(root)
            triggerHmrUpdate()
          }
        })
      }
    },

    /**
     * Resolve virtual module IDs
     */
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId
      }
      if (id === cssVirtualModuleId) {
        return resolvedCssVirtualModuleId
      }
      return null
    },

    /**
     * Load virtual module content
     */
    load(id) {
      // CSS virtual module
      if (id === resolvedCssVirtualModuleId) {
        return state.cssContent
      }

      // JS virtual module with theme config
      if (id === resolvedVirtualModuleId) {
        const buildOutput = state.themeConfig
          ? processThemeForBuild(state.themeConfig)
          : null

        return `
// Generated by @platxa/frontend-agent
export const themeConfig = ${JSON.stringify(state.themeConfig, null, 2)};
export const platxaConfig = ${JSON.stringify(state.config, null, 2)};
export const cssVariables = ${JSON.stringify(buildOutput?.cssVariables ?? {}, null, 2)};
export const css = ${JSON.stringify(state.cssContent)};

// Auto-inject CSS if enabled
${injectCss ? `
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.setAttribute("data-platxa-theme", "");
  style.textContent = css;
  document.head.appendChild(style);
}
` : ""}

// HMR support
if (import.meta.hot) {
  import.meta.hot.accept();
}
`
      }

      return null
    },

    /**
     * Emit CSS file during build
     */
    generateBundle() {
      if (state.cssContent) {
        this.emitFile({
          type: "asset",
          fileName: cssFileName,
          source: state.cssContent,
        })
      }
    },

    /**
     * Transform HTML to inject CSS link (optional)
     */
    transformIndexHtml(html) {
      if (!injectCss) return html

      // Inject CSS link in head
      return html.replace(
        "</head>",
        `  <link rel="stylesheet" href="/${cssFileName}">\n  </head>`
      )
    },
  }
}

/**
 * Alias for platxaTheme
 */
export const vitePluginPlatxa = platxaTheme

export default platxaTheme
