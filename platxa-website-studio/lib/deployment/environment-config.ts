/**
 * Environment Configuration
 *
 * Manages environment configurations for dev/staging/production deployments.
 * Supports switching between environments and environment-specific settings.
 *
 * Feature #85: Deployment - Environment configuration
 */

// =============================================================================
// Types
// =============================================================================

export type EnvironmentName = "development" | "staging" | "production" | "local" | string;

export type EnvironmentStatus = "active" | "inactive" | "maintenance" | "deploying";

export interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  user: string;
  password?: string;
  ssl: boolean;
  poolSize?: number;
  connectionString?: string;
}

export interface OdooConfig {
  url: string;
  database: string;
  username?: string;
  apiKey?: string;
  version: string;
  timeout?: number;
}

export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  rateLimit?: {
    requests: number;
    windowMs: number;
  };
}

export interface AuthConfig {
  jwtSecret?: string;
  jwtExpiry: string;
  refreshTokenExpiry: string;
  providers: {
    google?: { clientId: string; clientSecret?: string };
    github?: { clientId: string; clientSecret?: string };
  };
}

export interface StorageConfig {
  provider: "local" | "s3" | "gcs" | "azure";
  bucket?: string;
  region?: string;
  endpoint?: string;
  accessKey?: string;
  secretKey?: string;
  publicUrl?: string;
}

export interface CacheConfig {
  provider: "memory" | "redis" | "memcached";
  host?: string;
  port?: number;
  password?: string;
  ttl: number;
  prefix: string;
}

export interface LoggingConfig {
  level: "debug" | "info" | "warn" | "error";
  format: "json" | "pretty";
  destination: "console" | "file" | "remote";
  remoteUrl?: string;
  sampleRate?: number;
}

export interface FeatureFlags {
  [key: string]: boolean | string | number;
}

export interface EnvironmentVariables {
  [key: string]: string | undefined;
}

export interface EnvironmentConfig {
  /** Environment name/identifier */
  name: EnvironmentName;
  /** Display label */
  label: string;
  /** Environment description */
  description?: string;
  /** Current status */
  status: EnvironmentStatus;
  /** Is this the default environment */
  isDefault: boolean;
  /** Is production environment */
  isProduction: boolean;
  /** Base URL for the environment */
  baseUrl: string;
  /** API configuration */
  api: ApiConfig;
  /** Database configuration */
  database?: DatabaseConfig;
  /** Odoo connection configuration */
  odoo?: OdooConfig;
  /** Authentication configuration */
  auth?: AuthConfig;
  /** Storage configuration */
  storage?: StorageConfig;
  /** Cache configuration */
  cache?: CacheConfig;
  /** Logging configuration */
  logging: LoggingConfig;
  /** Feature flags */
  features: FeatureFlags;
  /** Environment variables */
  variables: EnvironmentVariables;
  /** Deployment metadata */
  deployment?: {
    version?: string;
    commit?: string;
    branch?: string;
    deployedAt?: Date;
    deployedBy?: string;
  };
  /** Created timestamp */
  createdAt: Date;
  /** Last updated */
  updatedAt: Date;
}

export interface EnvironmentOverride {
  /** Config key path (dot notation) */
  path: string;
  /** Override value */
  value: unknown;
  /** Override reason/description */
  reason?: string;
}

// =============================================================================
// Default Configurations
// =============================================================================

const DEFAULT_API_CONFIG: ApiConfig = {
  baseUrl: "http://localhost:3000",
  timeout: 30000,
  retries: 3,
};

const DEFAULT_LOGGING_CONFIG: LoggingConfig = {
  level: "info",
  format: "json",
  destination: "console",
};

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  provider: "memory",
  ttl: 3600,
  prefix: "platxa:",
};

/**
 * Get default environment configuration
 */
function getDefaultConfig(name: EnvironmentName): Partial<EnvironmentConfig> {
  const configs: Record<string, Partial<EnvironmentConfig>> = {
    local: {
      label: "Local",
      description: "Local development environment",
      isProduction: false,
      baseUrl: "http://localhost:3000",
      api: { ...DEFAULT_API_CONFIG },
      logging: { ...DEFAULT_LOGGING_CONFIG, level: "debug", format: "pretty" },
      cache: { ...DEFAULT_CACHE_CONFIG },
      features: { debugMode: true, mockData: true },
    },
    development: {
      label: "Development",
      description: "Shared development environment",
      isProduction: false,
      baseUrl: "https://dev.platxa.app",
      api: { ...DEFAULT_API_CONFIG, baseUrl: "https://api.dev.platxa.app" },
      logging: { ...DEFAULT_LOGGING_CONFIG, level: "debug" },
      cache: { ...DEFAULT_CACHE_CONFIG, provider: "redis" },
      features: { debugMode: true, betaFeatures: true },
    },
    staging: {
      label: "Staging",
      description: "Pre-production staging environment",
      isProduction: false,
      baseUrl: "https://staging.platxa.app",
      api: { ...DEFAULT_API_CONFIG, baseUrl: "https://api.staging.platxa.app" },
      logging: { ...DEFAULT_LOGGING_CONFIG, level: "info" },
      cache: { ...DEFAULT_CACHE_CONFIG, provider: "redis" },
      features: { betaFeatures: true },
    },
    production: {
      label: "Production",
      description: "Live production environment",
      isProduction: true,
      baseUrl: "https://platxa.app",
      api: { ...DEFAULT_API_CONFIG, baseUrl: "https://api.platxa.app", retries: 5 },
      logging: { ...DEFAULT_LOGGING_CONFIG, level: "warn", destination: "remote" },
      cache: { ...DEFAULT_CACHE_CONFIG, provider: "redis", ttl: 7200 },
      features: {},
    },
  };

  return configs[name] || configs.development;
}

// =============================================================================
// Environment Manager
// =============================================================================

export class EnvironmentManager {
  private environments: Map<string, EnvironmentConfig> = new Map();
  private currentEnvironment: EnvironmentName = "development";
  private overrides: Map<string, EnvironmentOverride[]> = new Map();
  private listeners: ((env: EnvironmentConfig) => void)[] = [];

  constructor() {
    // Initialize default environments
    this.initializeDefaults();
  }

  /**
   * Initialize default environments
   */
  private initializeDefaults(): void {
    const defaultEnvs: EnvironmentName[] = ["local", "development", "staging", "production"];

    for (const name of defaultEnvs) {
      const defaults = getDefaultConfig(name);
      this.environments.set(name, {
        name,
        label: defaults.label || name,
        description: defaults.description,
        status: "active",
        isDefault: name === "development",
        isProduction: defaults.isProduction || false,
        baseUrl: defaults.baseUrl || "",
        api: defaults.api || DEFAULT_API_CONFIG,
        logging: defaults.logging || DEFAULT_LOGGING_CONFIG,
        cache: defaults.cache,
        features: defaults.features || {},
        variables: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Environment CRUD
  // ---------------------------------------------------------------------------

  /**
   * Get all environments
   */
  getAll(): EnvironmentConfig[] {
    return Array.from(this.environments.values());
  }

  /**
   * Get environment by name
   */
  get(name: EnvironmentName): EnvironmentConfig | null {
    return this.environments.get(name) || null;
  }

  /**
   * Get current environment
   */
  getCurrent(): EnvironmentConfig {
    return this.environments.get(this.currentEnvironment)!;
  }

  /**
   * Get current environment name
   */
  getCurrentName(): EnvironmentName {
    return this.currentEnvironment;
  }

  /**
   * Create or update an environment
   */
  set(name: EnvironmentName, config: Partial<EnvironmentConfig>): EnvironmentConfig {
    const existing = this.environments.get(name);
    const defaults = getDefaultConfig(name);

    const environment: EnvironmentConfig = {
      name,
      label: config.label || existing?.label || defaults.label || name,
      description: config.description || existing?.description || defaults.description,
      status: config.status || existing?.status || "active",
      isDefault: config.isDefault ?? existing?.isDefault ?? false,
      isProduction: config.isProduction ?? existing?.isProduction ?? defaults.isProduction ?? false,
      baseUrl: config.baseUrl || existing?.baseUrl || defaults.baseUrl || "",
      api: { ...DEFAULT_API_CONFIG, ...existing?.api, ...config.api },
      database: config.database || existing?.database,
      odoo: config.odoo || existing?.odoo,
      auth: config.auth || existing?.auth,
      storage: config.storage || existing?.storage,
      cache: config.cache || existing?.cache || defaults.cache,
      logging: { ...DEFAULT_LOGGING_CONFIG, ...existing?.logging, ...config.logging },
      features: { ...existing?.features, ...config.features },
      variables: { ...existing?.variables, ...config.variables },
      deployment: config.deployment || existing?.deployment,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    this.environments.set(name, environment);

    // If setting as default, unset others
    if (environment.isDefault) {
      for (const [key, env] of this.environments) {
        if (key !== name && env.isDefault) {
          env.isDefault = false;
        }
      }
    }

    return environment;
  }

  /**
   * Delete an environment
   */
  delete(name: EnvironmentName): boolean {
    if (name === this.currentEnvironment) {
      throw new Error("Cannot delete the current environment");
    }

    const env = this.environments.get(name);
    if (env?.isProduction) {
      throw new Error("Cannot delete production environment");
    }

    return this.environments.delete(name);
  }

  /**
   * Clone an environment
   */
  clone(sourceName: EnvironmentName, newName: EnvironmentName): EnvironmentConfig {
    const source = this.environments.get(sourceName);
    if (!source) {
      throw new Error(`Environment '${sourceName}' not found`);
    }

    return this.set(newName, {
      ...source,
      name: newName,
      label: `${source.label} (Copy)`,
      isDefault: false,
      isProduction: false,
      deployment: undefined,
    });
  }

  // ---------------------------------------------------------------------------
  // Environment Switching
  // ---------------------------------------------------------------------------

  /**
   * Switch to a different environment
   */
  switchTo(name: EnvironmentName): EnvironmentConfig {
    const env = this.environments.get(name);
    if (!env) {
      throw new Error(`Environment '${name}' not found`);
    }

    if (env.status === "maintenance") {
      throw new Error(`Environment '${name}' is under maintenance`);
    }

    this.currentEnvironment = name;

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(env);
      } catch (error) {
        console.error("Environment switch listener error:", error);
      }
    }

    return env;
  }

  /**
   * Subscribe to environment changes
   */
  onSwitch(callback: (env: EnvironmentConfig) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Configuration Access
  // ---------------------------------------------------------------------------

  /**
   * Get a specific config value from current environment
   */
  getConfig<T = unknown>(path: string, defaultValue?: T): T {
    const env = this.getCurrent();
    const value = getNestedValue(env, path);

    // Check for overrides
    const envOverrides = this.overrides.get(this.currentEnvironment) || [];
    const override = envOverrides.find((o) => o.path === path);
    if (override) {
      return override.value as T;
    }

    return (value as T) ?? (defaultValue as T);
  }

  /**
   * Set a config override for current environment
   */
  setOverride(path: string, value: unknown, reason?: string): void {
    const overrides = this.overrides.get(this.currentEnvironment) || [];
    const existing = overrides.findIndex((o) => o.path === path);

    if (existing !== -1) {
      overrides[existing] = { path, value, reason };
    } else {
      overrides.push({ path, value, reason });
    }

    this.overrides.set(this.currentEnvironment, overrides);
  }

  /**
   * Clear config overrides
   */
  clearOverrides(envName?: EnvironmentName): void {
    if (envName) {
      this.overrides.delete(envName);
    } else {
      this.overrides.clear();
    }
  }

  /**
   * Get all overrides for an environment
   */
  getOverrides(envName?: EnvironmentName): EnvironmentOverride[] {
    return this.overrides.get(envName || this.currentEnvironment) || [];
  }

  // ---------------------------------------------------------------------------
  // Feature Flags
  // ---------------------------------------------------------------------------

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(featureKey: string): boolean {
    const env = this.getCurrent();
    return !!env.features[featureKey];
  }

  /**
   * Get feature flag value
   */
  getFeature<T = boolean | string | number>(featureKey: string, defaultValue?: T): T {
    const env = this.getCurrent();
    return (env.features[featureKey] as T) ?? (defaultValue as T);
  }

  /**
   * Set feature flag
   */
  setFeature(featureKey: string, value: boolean | string | number): void {
    const env = this.getCurrent();
    env.features[featureKey] = value;
    env.updatedAt = new Date();
  }

  // ---------------------------------------------------------------------------
  // Environment Variables
  // ---------------------------------------------------------------------------

  /**
   * Get environment variable
   */
  getVariable(key: string, defaultValue?: string): string | undefined {
    const env = this.getCurrent();
    return env.variables[key] ?? process.env[key] ?? defaultValue;
  }

  /**
   * Set environment variable
   */
  setVariable(key: string, value: string): void {
    const env = this.getCurrent();
    env.variables[key] = value;
    env.updatedAt = new Date();
  }

  // ---------------------------------------------------------------------------
  // Status Management
  // ---------------------------------------------------------------------------

  /**
   * Set environment status
   */
  setStatus(name: EnvironmentName, status: EnvironmentStatus): void {
    const env = this.environments.get(name);
    if (!env) {
      throw new Error(`Environment '${name}' not found`);
    }

    env.status = status;
    env.updatedAt = new Date();
  }

  /**
   * Set deployment info
   */
  setDeployment(
    name: EnvironmentName,
    deployment: EnvironmentConfig["deployment"]
  ): void {
    const env = this.environments.get(name);
    if (!env) {
      throw new Error(`Environment '${name}' not found`);
    }

    env.deployment = {
      ...env.deployment,
      ...deployment,
      deployedAt: new Date(),
    };
    env.updatedAt = new Date();
  }

  // ---------------------------------------------------------------------------
  // Export/Import
  // ---------------------------------------------------------------------------

  /**
   * Export environment configuration
   */
  export(name: EnvironmentName, includeSecrets: boolean = false): string {
    const env = this.environments.get(name);
    if (!env) {
      throw new Error(`Environment '${name}' not found`);
    }

    const exported = { ...env };

    // Remove secrets if not included
    if (!includeSecrets) {
      if (exported.database) {
        exported.database = { ...exported.database, password: undefined };
      }
      if (exported.auth) {
        exported.auth = {
          ...exported.auth,
          jwtSecret: undefined,
          providers: {},
        };
      }
      if (exported.storage) {
        exported.storage = {
          ...exported.storage,
          accessKey: undefined,
          secretKey: undefined,
        };
      }
      if (exported.cache) {
        exported.cache = { ...exported.cache, password: undefined };
      }
    }

    return JSON.stringify(exported, null, 2);
  }

  /**
   * Import environment configuration
   */
  import(json: string, newName?: EnvironmentName): EnvironmentConfig {
    const config = JSON.parse(json) as EnvironmentConfig;
    const name = newName || config.name;

    return this.set(name, {
      ...config,
      name,
      isDefault: false,
      createdAt: new Date(),
    });
  }
}

// =============================================================================
// Utilities
// =============================================================================

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

// =============================================================================
// Singleton
// =============================================================================

let environmentManager: EnvironmentManager | null = null;

/**
 * Get the singleton EnvironmentManager instance
 */
export function getEnvironmentManager(): EnvironmentManager {
  if (!environmentManager) {
    environmentManager = new EnvironmentManager();
  }
  return environmentManager;
}

/**
 * Create a new EnvironmentManager instance
 */
export function createEnvironmentManager(): EnvironmentManager {
  return new EnvironmentManager();
}

/**
 * Get current environment config (convenience function)
 */
export function getCurrentEnvironment(): EnvironmentConfig {
  return getEnvironmentManager().getCurrent();
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return getEnvironmentManager().getCurrent().isProduction;
}

/**
 * Check if a feature is enabled (convenience function)
 */
export function isFeatureEnabled(featureKey: string): boolean {
  return getEnvironmentManager().isFeatureEnabled(featureKey);
}

// =============================================================================
// Export
// =============================================================================

export default EnvironmentManager;
