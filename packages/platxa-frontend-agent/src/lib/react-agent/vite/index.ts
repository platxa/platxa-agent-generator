/**
 * Vite Integration Module
 *
 * Provides Vite plugin for automatic theme integration.
 *
 * @example
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
 * @module react-agent/vite
 */

export {
  platxaTheme,
  vitePluginPlatxa,
  default,
} from "./vite-plugin"

export type { PlatxaVitePluginOptions } from "./vite-plugin"
