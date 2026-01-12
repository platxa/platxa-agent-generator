/**
 * Configuration Loader
 *
 * Loads and merges configuration from multiple sources:
 * 1. Built-in defaults
 * 2. Project config (.claude/debug-agent.json or .platxa-debug/config.json)
 * 3. User home config (~/.platxa-debug/config.json)
 * 4. Environment variables
 * 5. CLI flags (highest priority)
 *
 * @module config-loader
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Language } from '../core/types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Analysis configuration options
 */
export interface AnalysisConfig {
  /** Maximum depth for RCA analysis */
  rcaDepth: number;
  /** Number of hypotheses to generate */
  hypothesisCount: number;
  /** Enable parallel analysis */
  parallelAnalysis: boolean;
  /** Timeout for analysis operations (ms) */
  timeout: number;
}

/**
 * Fix configuration options
 */
export interface FixConfig {
  /** Enable automatic fix application */
  autoFix: boolean;
  /** Run validation after applying fix */
  validateAfterFix: boolean;
  /** Create backup before applying fix */
  createBackup: boolean;
  /** Maximum fixes to suggest */
  maxSuggestions: number;
}

/**
 * Output configuration options
 */
export interface OutputConfig {
  /** Default output format */
  format: 'text' | 'json' | 'markdown' | 'html';
  /** Enable colored output */
  color: boolean;
  /** Verbosity level */
  verbose: boolean;
  /** Show progress indicators */
  showProgress: boolean;
}

/**
 * Log watching configuration
 */
export interface WatchConfig {
  /** File patterns to watch */
  patterns: string[];
  /** Debounce interval (ms) */
  debounceMs: number;
  /** Maximum file size to process (bytes) */
  maxFileSize: number;
}

/**
 * CI/CD integration configuration
 */
export interface CICDConfig {
  /** Enable CI/CD integration */
  enabled: boolean;
  /** Fail build on error */
  failOnError: boolean;
  /** Report format */
  reportFormat: 'sarif' | 'json' | 'junit';
  /** Output path for reports */
  reportPath: string;
}

/**
 * IDE integration configuration
 */
export interface IDEConfig {
  /** Enable VSCode integration */
  vscode: boolean;
  /** Real-time diagnostics */
  realTimeDiagnostics: boolean;
  /** Quick fix suggestions */
  quickFixes: boolean;
}

/**
 * Complete debug agent configuration
 */
export interface DebugAgentConfig {
  /** Config version */
  version: string;
  /** Enabled languages */
  languages: Language[];
  /** Analysis options */
  analysis: AnalysisConfig;
  /** Fix options */
  fix: FixConfig;
  /** Output options */
  output: OutputConfig;
  /** Watch options */
  watch: WatchConfig;
  /** CI/CD options */
  cicd: CICDConfig;
  /** IDE options */
  ide: IDEConfig;
}

/**
 * Partial configuration for merging
 */
export type PartialDebugAgentConfig = {
  [K in keyof DebugAgentConfig]?: DebugAgentConfig[K] extends object
    ? Partial<DebugAgentConfig[K]>
    : DebugAgentConfig[K];
};

/**
 * CLI flags that can override config
 */
export interface CLIFlags {
  language?: string;
  output?: string;
  verbose?: boolean;
  color?: boolean;
  depth?: string;
  timeout?: string;
  autoFix?: boolean;
  dryRun?: boolean;
}

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: DebugAgentConfig = {
  version: '1.0',
  languages: ['python', 'javascript', 'typescript'],
  analysis: {
    rcaDepth: 3,
    hypothesisCount: 5,
    parallelAnalysis: true,
    timeout: 30000,
  },
  fix: {
    autoFix: false,
    validateAfterFix: true,
    createBackup: true,
    maxSuggestions: 5,
  },
  output: {
    format: 'text',
    color: true,
    verbose: false,
    showProgress: true,
  },
  watch: {
    patterns: ['**/*.log', '**/logs/**'],
    debounceMs: 500,
    maxFileSize: 10 * 1024 * 1024, // 10MB
  },
  cicd: {
    enabled: false,
    failOnError: false,
    reportFormat: 'sarif',
    reportPath: './reports',
  },
  ide: {
    vscode: true,
    realTimeDiagnostics: true,
    quickFixes: true,
  },
};

// =============================================================================
// Config File Paths
// =============================================================================

/**
 * Possible config file locations in order of priority (lower index = higher priority)
 */
const CONFIG_FILE_NAMES = [
  '.claude/debug-agent.json',
  '.platxa-debug/config.json',
  'platxa-debug.config.json',
];

/**
 * Environment variable prefix
 */
const ENV_PREFIX = 'PLATXA_DEBUG_';

// =============================================================================
// ConfigLoader Class
// =============================================================================

/**
 * Configuration loader that merges settings from multiple sources
 */
export class ConfigLoader {
  private projectRoot: string;
  private cachedConfig: DebugAgentConfig | null = null;
  private configPath: string | null = null;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Load configuration from all sources and merge
   */
  load(cliFlags: CLIFlags = {}): DebugAgentConfig {
    if (this.cachedConfig && Object.keys(cliFlags).length === 0) {
      return this.cachedConfig;
    }

    // Start with defaults
    let config = this.deepClone(DEFAULT_CONFIG);

    // Merge user home config
    const userConfig = this.loadUserConfig();
    if (userConfig) {
      config = this.mergeConfigs(config, userConfig);
    }

    // Merge project config (higher priority)
    const projectConfig = this.loadProjectConfig();
    if (projectConfig) {
      config = this.mergeConfigs(config, projectConfig);
    }

    // Merge environment variables
    config = this.mergeEnvVariables(config);

    // Merge CLI flags (highest priority)
    config = this.mergeCLIFlags(config, cliFlags);

    // Cache if no CLI flags (CLI flags make config request-specific)
    if (Object.keys(cliFlags).length === 0) {
      this.cachedConfig = config;
    }

    return config;
  }

  /**
   * Get the path to the loaded config file (if any)
   */
  getConfigPath(): string | null {
    return this.configPath;
  }

  /**
   * Check if a project config file exists
   */
  hasProjectConfig(): boolean {
    return this.findProjectConfigPath() !== null;
  }

  /**
   * Get a specific config value by path (e.g., 'analysis.rcaDepth')
   */
  get<T = unknown>(path: string, cliFlags: CLIFlags = {}): T | undefined {
    const config = this.load(cliFlags);
    return this.getValueByPath(config as unknown as Record<string, unknown>, path) as T | undefined;
  }

  /**
   * Invalidate cached configuration
   */
  invalidateCache(): void {
    this.cachedConfig = null;
    this.configPath = null;
  }

  /**
   * Get effective config with explanations of where each value came from
   */
  getConfigSources(cliFlags: CLIFlags = {}): Map<string, string> {
    const sources = new Map<string, string>();

    const defaults = DEFAULT_CONFIG;
    const user = this.loadUserConfig();
    const project = this.loadProjectConfig();

    // Track sources for each path
    this.trackSources(sources, '', defaults as unknown as Record<string, unknown>, 'default');
    if (user) {
      this.trackSources(sources, '', user as unknown as Record<string, unknown>, 'user');
    }
    if (project) {
      this.trackSources(sources, '', project as unknown as Record<string, unknown>, 'project');
    }
    this.trackEnvSources(sources);
    this.trackCLISources(sources, cliFlags);

    return sources;
  }

  // ===========================================================================
  // Private Methods - Loading
  // ===========================================================================

  /**
   * Load configuration from user's home directory
   */
  private loadUserConfig(): PartialDebugAgentConfig | null {
    const userConfigPath = join(homedir(), '.platxa-debug', 'config.json');
    return this.loadConfigFile(userConfigPath);
  }

  /**
   * Load configuration from project directory
   */
  private loadProjectConfig(): PartialDebugAgentConfig | null {
    const configPath = this.findProjectConfigPath();
    if (!configPath) {
      return null;
    }
    this.configPath = configPath;
    return this.loadConfigFile(configPath);
  }

  /**
   * Find the project config file path
   */
  private findProjectConfigPath(): string | null {
    for (const fileName of CONFIG_FILE_NAMES) {
      const fullPath = join(this.projectRoot, fileName);
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }
    return null;
  }

  /**
   * Load and parse a config file
   */
  private loadConfigFile(filePath: string): PartialDebugAgentConfig | null {
    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content) as PartialDebugAgentConfig;

      // Handle legacy config format
      return this.normalizeConfig(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Warning: Failed to parse config file ${filePath}: ${message}`);
      return null;
    }
  }

  /**
   * Normalize legacy config formats to current schema
   */
  private normalizeConfig(config: Record<string, unknown>): PartialDebugAgentConfig {
    const normalized: PartialDebugAgentConfig = {};

    // Handle direct properties
    if (config.version) normalized.version = String(config.version);
    if (config.languages) normalized.languages = config.languages as Language[];

    // Handle nested objects
    if (config.analysis) {
      normalized.analysis = config.analysis as Partial<AnalysisConfig>;
    }
    if (config.fix) {
      normalized.fix = config.fix as Partial<FixConfig>;
    }
    if (config.output) {
      normalized.output = config.output as Partial<OutputConfig>;
    }
    if (config.watch) {
      normalized.watch = config.watch as Partial<WatchConfig>;
    }

    // Handle legacy 'cicd' format
    if (config.cicd) {
      normalized.cicd = config.cicd as Partial<CICDConfig>;
    }

    // Handle legacy 'vscode' format -> ide
    if (config.vscode) {
      const vsConfig = config.vscode as Record<string, unknown>;
      normalized.ide = {
        vscode: vsConfig.enabled as boolean ?? true,
        realTimeDiagnostics: vsConfig.realTimeDiagnostics as boolean ?? true,
        quickFixes: true,
      };
    }
    if (config.ide) {
      normalized.ide = config.ide as Partial<IDEConfig>;
    }

    // Handle legacy flat properties
    if (config.autoFix !== undefined) {
      normalized.fix = normalized.fix ?? {};
      normalized.fix.autoFix = config.autoFix as boolean;
    }
    if (config.logPatterns) {
      normalized.watch = normalized.watch ?? {};
      normalized.watch.patterns = config.logPatterns as string[];
    }

    return normalized;
  }

  // ===========================================================================
  // Private Methods - Merging
  // ===========================================================================

  /**
   * Deep merge two configs
   */
  private mergeConfigs(
    base: DebugAgentConfig,
    override: PartialDebugAgentConfig
  ): DebugAgentConfig {
    const result = this.deepClone(base);

    for (const key of Object.keys(override) as (keyof PartialDebugAgentConfig)[]) {
      const overrideValue = override[key];
      if (overrideValue === undefined) continue;

      if (typeof overrideValue === 'object' && !Array.isArray(overrideValue) && overrideValue !== null) {
        // Deep merge objects
        const baseValue = result[key];
        if (typeof baseValue === 'object' && !Array.isArray(baseValue)) {
          (result as unknown as Record<string, unknown>)[key] = {
            ...(baseValue as unknown as Record<string, unknown>),
            ...(overrideValue as unknown as Record<string, unknown>),
          };
        }
      } else {
        // Direct assignment for primitives and arrays
        (result as unknown as Record<string, unknown>)[key] = overrideValue;
      }
    }

    return result;
  }

  /**
   * Merge environment variables into config
   */
  private mergeEnvVariables(config: DebugAgentConfig): DebugAgentConfig {
    const result = this.deepClone(config);

    // PLATXA_DEBUG_LANGUAGES
    const languages = process.env[`${ENV_PREFIX}LANGUAGES`];
    if (languages) {
      result.languages = languages.split(',').map(l => l.trim()) as Language[];
    }

    // PLATXA_DEBUG_VERBOSE
    const verbose = process.env[`${ENV_PREFIX}VERBOSE`];
    if (verbose) {
      result.output.verbose = verbose === 'true' || verbose === '1';
    }

    // PLATXA_DEBUG_COLOR
    const color = process.env[`${ENV_PREFIX}COLOR`];
    if (color) {
      result.output.color = color !== 'false' && color !== '0';
    }

    // PLATXA_DEBUG_FORMAT
    const format = process.env[`${ENV_PREFIX}FORMAT`];
    if (format && ['text', 'json', 'markdown', 'html'].includes(format)) {
      result.output.format = format as OutputConfig['format'];
    }

    // PLATXA_DEBUG_AUTO_FIX
    const autoFix = process.env[`${ENV_PREFIX}AUTO_FIX`];
    if (autoFix) {
      result.fix.autoFix = autoFix === 'true' || autoFix === '1';
    }

    // PLATXA_DEBUG_TIMEOUT
    const timeout = process.env[`${ENV_PREFIX}TIMEOUT`];
    if (timeout) {
      const parsed = parseInt(timeout, 10);
      if (!isNaN(parsed) && parsed > 0) {
        result.analysis.timeout = parsed;
      }
    }

    // PLATXA_DEBUG_RCA_DEPTH
    const rcaDepth = process.env[`${ENV_PREFIX}RCA_DEPTH`];
    if (rcaDepth) {
      const parsed = parseInt(rcaDepth, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
        result.analysis.rcaDepth = parsed;
      }
    }

    return result;
  }

  /**
   * Merge CLI flags into config (highest priority)
   */
  private mergeCLIFlags(config: DebugAgentConfig, flags: CLIFlags): DebugAgentConfig {
    const result = this.deepClone(config);

    if (flags.language) {
      result.languages = [flags.language as Language];
    }

    if (flags.output && ['text', 'json', 'markdown', 'html'].includes(flags.output)) {
      result.output.format = flags.output as OutputConfig['format'];
    }

    if (flags.verbose !== undefined) {
      result.output.verbose = flags.verbose;
    }

    if (flags.color !== undefined) {
      result.output.color = flags.color;
    }

    if (flags.depth) {
      const parsed = parseInt(flags.depth, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
        result.analysis.rcaDepth = parsed;
      }
    }

    if (flags.timeout) {
      const parsed = parseInt(flags.timeout, 10);
      if (!isNaN(parsed) && parsed > 0) {
        result.analysis.timeout = parsed;
      }
    }

    if (flags.autoFix !== undefined) {
      result.fix.autoFix = flags.autoFix;
    }

    if (flags.dryRun) {
      // Dry run disables auto-fix
      result.fix.autoFix = false;
    }

    return result;
  }

  // ===========================================================================
  // Private Methods - Utilities
  // ===========================================================================

  /**
   * Deep clone an object
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj)) as T;
  }

  /**
   * Get a value by dot-notation path
   */
  private getValueByPath(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Track config value sources
   */
  private trackSources(
    sources: Map<string, string>,
    prefix: string,
    config: PartialDebugAgentConfig | Record<string, unknown>,
    source: string
  ): void {
    for (const [key, value] of Object.entries(config)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value !== undefined) {
        if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
          this.trackSources(sources, path, value as Record<string, unknown>, source);
        } else {
          sources.set(path, source);
        }
      }
    }
  }

  /**
   * Track environment variable sources
   */
  private trackEnvSources(sources: Map<string, string>): void {
    const envMappings: Record<string, string> = {
      [`${ENV_PREFIX}LANGUAGES`]: 'languages',
      [`${ENV_PREFIX}VERBOSE`]: 'output.verbose',
      [`${ENV_PREFIX}COLOR`]: 'output.color',
      [`${ENV_PREFIX}FORMAT`]: 'output.format',
      [`${ENV_PREFIX}AUTO_FIX`]: 'fix.autoFix',
      [`${ENV_PREFIX}TIMEOUT`]: 'analysis.timeout',
      [`${ENV_PREFIX}RCA_DEPTH`]: 'analysis.rcaDepth',
    };

    for (const [envVar, path] of Object.entries(envMappings)) {
      if (process.env[envVar]) {
        sources.set(path, `env:${envVar}`);
      }
    }
  }

  /**
   * Track CLI flag sources
   */
  private trackCLISources(sources: Map<string, string>, flags: CLIFlags): void {
    const flagMappings: Record<keyof CLIFlags, string> = {
      language: 'languages',
      output: 'output.format',
      verbose: 'output.verbose',
      color: 'output.color',
      depth: 'analysis.rcaDepth',
      timeout: 'analysis.timeout',
      autoFix: 'fix.autoFix',
      dryRun: 'fix.autoFix',
    };

    for (const [flag, path] of Object.entries(flagMappings)) {
      if (flags[flag as keyof CLIFlags] !== undefined) {
        sources.set(path, `cli:--${flag}`);
      }
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a config loader instance
 */
export function createConfigLoader(projectRoot?: string): ConfigLoader {
  return new ConfigLoader(projectRoot);
}

/**
 * Load configuration with defaults (convenience function)
 */
export function loadConfig(cliFlags: CLIFlags = {}): DebugAgentConfig {
  const loader = new ConfigLoader();
  return loader.load(cliFlags);
}

/**
 * Get shared config loader instance (singleton)
 */
let sharedLoader: ConfigLoader | null = null;

export function getSharedConfigLoader(): ConfigLoader {
  if (!sharedLoader) {
    sharedLoader = new ConfigLoader();
  }
  return sharedLoader;
}
