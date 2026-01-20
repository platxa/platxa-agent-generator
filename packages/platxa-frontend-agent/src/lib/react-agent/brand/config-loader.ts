/**
 * Configuration File Loader
 *
 * Loads frontend configuration from various file formats:
 * - frontend.config.ts (TypeScript)
 * - frontend.config.js (JavaScript)
 * - frontend.config.mjs (ESM)
 * - frontend.config.json (JSON)
 *
 * @module react-agent/brand/config-loader
 */

import type { FrontendConfig } from "./types"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Supported config file extensions
 */
export type ConfigFileExtension = ".ts" | ".js" | ".mjs" | ".json"

/**
 * Config file search result
 */
export interface ConfigFileResult {
  /** Whether a config file was found */
  found: boolean
  /** Path to the found config file */
  path?: string
  /** File extension */
  extension?: ConfigFileExtension
  /** Loaded configuration */
  config?: FrontendConfig
  /** Error message if loading failed */
  error?: string
}

/**
 * Config loader options
 */
export interface ConfigLoaderOptions {
  /** Base directory to search from (default: process.cwd()) */
  cwd?: string
  /** Custom config file path (skips search) */
  configPath?: string
  /** Throw on error instead of returning error result */
  throwOnError?: boolean
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Config file base name
 */
export const CONFIG_FILE_NAME = "frontend.config"

/**
 * Supported extensions in priority order
 */
export const SUPPORTED_EXTENSIONS: readonly ConfigFileExtension[] = Object.freeze([
  ".ts",
  ".mjs",
  ".js",
  ".json",
] as const)

/**
 * Full config file names in search order
 */
export const CONFIG_FILE_NAMES: readonly string[] = Object.freeze(
  SUPPORTED_EXTENSIONS.map((ext) => `${CONFIG_FILE_NAME}${ext}`)
)

// =============================================================================
// CONFIG FILE DETECTION
// =============================================================================

/**
 * Check if a file extension is supported
 */
export function isSupportedExtension(ext: string): ext is ConfigFileExtension {
  return SUPPORTED_EXTENSIONS.includes(ext as ConfigFileExtension)
}

/**
 * Get the extension from a file path
 */
export function getConfigExtension(filePath: string): ConfigFileExtension | null {
  for (const ext of SUPPORTED_EXTENSIONS) {
    if (filePath.endsWith(ext)) {
      return ext
    }
  }
  return null
}

/**
 * Check if a path is a valid config file name
 */
export function isConfigFileName(fileName: string): boolean {
  return CONFIG_FILE_NAMES.includes(fileName)
}

/**
 * Get all possible config file paths for a directory
 */
export function getConfigFilePaths(directory: string): string[] {
  return CONFIG_FILE_NAMES.map((name) => `${directory}/${name}`)
}

// =============================================================================
// CONFIG LOADING
// =============================================================================

/**
 * Load configuration from a specific file path
 *
 * Supports:
 * - .ts files (via dynamic import with bundler support)
 * - .js files (via dynamic import)
 * - .mjs files (via dynamic import)
 * - .json files (via dynamic import or JSON.parse)
 *
 * @param filePath - Path to the config file
 * @param options - Loader options
 * @returns Config file result
 *
 * @example
 * ```typescript
 * const result = await loadConfigFile("./frontend.config.ts")
 * if (result.found && result.config) {
 *   console.log("Config loaded:", result.config)
 * }
 * ```
 */
export async function loadConfigFile(
  filePath: string,
  options: ConfigLoaderOptions = {}
): Promise<ConfigFileResult> {
  const { throwOnError = false } = options

  const extension = getConfigExtension(filePath)
  if (!extension) {
    const error = `Unsupported config file extension. Supported: ${SUPPORTED_EXTENSIONS.join(", ")}`
    if (throwOnError) {
      throw new Error(error)
    }
    return { found: false, error }
  }

  try {
    const config = await importConfigFile(filePath)

    // Validate that we got a valid config object
    if (!config || typeof config !== "object") {
      const error = "Config file must export a valid configuration object"
      if (throwOnError) {
        throw new Error(error)
      }
      return { found: true, path: filePath, extension, error }
    }

    return {
      found: true,
      path: filePath,
      extension,
      config: config as FrontendConfig,
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error loading config"
    if (throwOnError) {
      throw err
    }
    return { found: false, path: filePath, extension, error }
  }
}

/**
 * Import a config file using dynamic import
 *
 * All supported formats (.ts, .js, .mjs, .json) use dynamic import:
 * - Bundlers (Vite, esbuild) handle .ts transpilation
 * - Node.js handles .js, .mjs, .json natively
 */
async function importConfigFile(filePath: string): Promise<unknown> {
  const module = await import(/* @vite-ignore */ filePath)

  // Handle different export styles
  // 1. export default config
  // 2. export { config }
  // 3. module.exports = config (CommonJS)
  return module.default || module.config || module
}

/**
 * Search for and load a config file
 *
 * Searches for config files in the following order:
 * 1. frontend.config.ts
 * 2. frontend.config.mjs
 * 3. frontend.config.js
 * 4. frontend.config.json
 *
 * @param options - Loader options
 * @returns Config file result
 *
 * @example
 * ```typescript
 * // Search in current directory
 * const result = await findAndLoadConfig()
 *
 * // Search in specific directory
 * const result = await findAndLoadConfig({ cwd: "/path/to/project" })
 *
 * // Load specific file
 * const result = await findAndLoadConfig({ configPath: "./my-config.ts" })
 * ```
 */
export async function findAndLoadConfig(
  options: ConfigLoaderOptions = {}
): Promise<ConfigFileResult> {
  const { cwd = ".", configPath, throwOnError = false } = options

  // If a specific path is provided, load it directly
  if (configPath) {
    return loadConfigFile(configPath, { throwOnError })
  }

  // Search for config files in priority order
  for (const fileName of CONFIG_FILE_NAMES) {
    const filePath = `${cwd}/${fileName}`

    try {
      // Try to load the file
      const result = await loadConfigFile(filePath, { throwOnError: false })
      if (result.found && result.config) {
        return result
      }
    } catch {
      // File doesn't exist or couldn't be loaded, try next
      continue
    }
  }

  // No config file found - this is not an error, use defaults
  return {
    found: false,
  }
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate a loaded config object
 *
 * @param config - The config object to validate
 * @returns Validation result
 */
export function validateLoadedConfig(config: unknown): {
  valid: boolean
  config?: FrontendConfig
  error?: string
} {
  // Reject null, undefined, primitives, and arrays
  // Arrays pass typeof === 'object' check, so explicit Array.isArray check needed
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { valid: false, error: "Config must be a plain object" }
  }

  const cfg = config as Record<string, unknown>

  // Check theme if present
  if (cfg.theme !== undefined) {
    if (typeof cfg.theme !== "object") {
      return { valid: false, error: "config.theme must be an object" }
    }
  }

  // Check brand if present
  if (cfg.brand !== undefined) {
    if (typeof cfg.brand !== "object") {
      return { valid: false, error: "config.brand must be an object" }
    }
  }

  return { valid: true, config: cfg as FrontendConfig }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get the config file format description
 */
export function getConfigFormatDescription(extension: ConfigFileExtension): string {
  switch (extension) {
    case ".ts":
      return "TypeScript"
    case ".js":
      return "JavaScript (CommonJS)"
    case ".mjs":
      return "JavaScript (ESM)"
    case ".json":
      return "JSON"
  }
}

/**
 * Check if running in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined"
}

/**
 * Config loading is only available in Node.js environment
 */
export function isConfigLoadingSupported(): boolean {
  return !isBrowser()
}
