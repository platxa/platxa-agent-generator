/**
 * Development Mode — Hot-Reload Orchestrator
 *
 * Coordinates hot-reload across website-studio, editor-sync, and
 * frontend-agent. Watches for file changes and triggers rebuilds.
 */

// =============================================================================
// Types
// =============================================================================

/** A monitored system in the dev environment */
export interface DevSystem {
  /** System identifier */
  id: "website-studio" | "editor-sync" | "frontend-agent";
  /** Display name */
  name: string;
  /** Root directory path */
  rootDir: string;
  /** Glob patterns to watch */
  watchPatterns: string[];
  /** Glob patterns to ignore */
  ignorePatterns: string[];
  /** Port the system runs on (if applicable) */
  port?: number;
  /** Build command */
  buildCommand: string;
  /** Dev server command */
  devCommand: string;
}

export type SystemStatus = "stopped" | "starting" | "running" | "rebuilding" | "error";

export interface SystemState {
  system: DevSystem;
  status: SystemStatus;
  lastBuild: number | null;
  buildCount: number;
  errors: string[];
}

export interface FileChangeEvent {
  /** File path relative to system root */
  path: string;
  /** Change type */
  type: "add" | "change" | "delete";
  /** Timestamp */
  timestamp: number;
  /** Which system owns this file */
  systemId: string;
}

export interface ReloadAction {
  /** System to reload */
  systemId: string;
  /** Type of reload */
  type: "hot" | "full" | "build";
  /** Reason for reload */
  reason: string;
  /** Files that triggered this reload */
  triggerFiles: string[];
}

export interface DevModeState {
  /** Status of each system */
  systems: Map<string, SystemState>;
  /** Pending reload actions */
  pendingReloads: ReloadAction[];
  /** Whether dev mode is active */
  active: boolean;
  /** Total file changes processed */
  totalChanges: number;
  /** Debounce interval in ms */
  debounceMs: number;
}

export interface DevModeConfig {
  /** Systems to monitor */
  systems: DevSystem[];
  /** Debounce interval for file changes (ms) */
  debounceMs: number;
  /** Whether to open browser on start */
  openBrowser: boolean;
  /** Port for the dev proxy (aggregates all systems) */
  proxyPort: number;
}

// =============================================================================
// Default Systems
// =============================================================================

export const WEBSITE_STUDIO: DevSystem = {
  id: "website-studio",
  name: "Website Studio",
  rootDir: "./platxa-website-studio",
  watchPatterns: ["lib/**/*.ts", "app/**/*.tsx", "components/**/*.tsx"],
  ignorePatterns: ["node_modules/**", ".next/**", "dist/**"],
  port: 3000,
  buildCommand: "npm run build",
  devCommand: "npm run dev",
};

export const EDITOR_SYNC: DevSystem = {
  id: "editor-sync",
  name: "Editor Sync",
  rootDir: "./platxa-editor-sync",
  watchPatterns: ["src/**/*.ts", "src/**/*.tsx"],
  ignorePatterns: ["node_modules/**", "dist/**"],
  port: 3001,
  buildCommand: "npm run build",
  devCommand: "npm run dev",
};

export const FRONTEND_AGENT: DevSystem = {
  id: "frontend-agent",
  name: "Frontend Agent",
  rootDir: "./platxa-frontend-agent",
  watchPatterns: ["src/**/*.ts", "src/**/*.py", "prompts/**/*.md"],
  ignorePatterns: ["node_modules/**", "__pycache__/**", "dist/**"],
  port: 3002,
  buildCommand: "npm run build",
  devCommand: "npm run dev",
};

export const DEFAULT_SYSTEMS: DevSystem[] = [WEBSITE_STUDIO, EDITOR_SYNC, FRONTEND_AGENT];

export const DEFAULT_DEV_CONFIG: DevModeConfig = {
  systems: DEFAULT_SYSTEMS,
  debounceMs: 300,
  openBrowser: true,
  proxyPort: 4000,
};

// =============================================================================
// Reload Strategy
// =============================================================================

/** File extension to reload type mapping */
const RELOAD_RULES: Record<string, ReloadAction["type"]> = {
  ".ts": "hot",
  ".tsx": "hot",
  ".css": "hot",
  ".scss": "hot",
  ".json": "full",
  ".py": "full",
  ".md": "build",
  ".xml": "full",
  ".html": "full",
};

/**
 * Determines the reload action for a file change.
 */
export function classifyReload(event: FileChangeEvent): ReloadAction["type"] {
  const ext = event.path.includes(".")
    ? "." + event.path.split(".").pop()!
    : "";

  // Config file changes always need full reload
  if (
    event.path.includes("config") ||
    event.path.endsWith("package.json") ||
    event.path.endsWith("tsconfig.json")
  ) {
    return "full";
  }

  return RELOAD_RULES[ext] ?? "full";
}

/**
 * Creates a reload action from a batch of file changes.
 * Uses the most aggressive reload type needed.
 */
export function createReloadAction(
  systemId: string,
  events: FileChangeEvent[],
): ReloadAction {
  const types = events.map(classifyReload);

  // Priority: full > build > hot
  let type: ReloadAction["type"] = "hot";
  if (types.includes("full")) type = "full";
  else if (types.includes("build")) type = "build";

  return {
    systemId,
    type,
    reason: `${events.length} file(s) changed`,
    triggerFiles: events.map((e) => e.path),
  };
}

// =============================================================================
// Cross-System Dependencies
// =============================================================================

/** Dependency map: when system X changes, also reload system Y */
const CROSS_DEPS: Record<string, string[]> = {
  "editor-sync": ["website-studio"],
  "frontend-agent": ["website-studio"],
};

/**
 * Returns additional systems that should reload when the given system changes.
 */
export function getCrossDependencies(systemId: string): string[] {
  return CROSS_DEPS[systemId] ?? [];
}

/**
 * Expands a reload action to include cross-system dependencies.
 */
export function expandReloads(action: ReloadAction): ReloadAction[] {
  const result = [action];
  const deps = getCrossDependencies(action.systemId);
  for (const depId of deps) {
    result.push({
      systemId: depId,
      type: "hot",
      reason: `Dependency ${action.systemId} changed`,
      triggerFiles: action.triggerFiles,
    });
  }
  return result;
}

// =============================================================================
// State Management
// =============================================================================

/** Creates initial dev mode state. */
export function createDevState(config: DevModeConfig): DevModeState {
  const systems = new Map<string, SystemState>();
  for (const sys of config.systems) {
    systems.set(sys.id, {
      system: sys,
      status: "stopped",
      lastBuild: null,
      buildCount: 0,
      errors: [],
    });
  }
  return {
    systems,
    pendingReloads: [],
    active: false,
    totalChanges: 0,
    debounceMs: config.debounceMs,
  };
}

/** Starts dev mode. */
export function startDevMode(state: DevModeState): DevModeState {
  const systems = new Map(state.systems);
  for (const [id, sys] of systems) {
    systems.set(id, { ...sys, status: "starting" });
  }
  return { ...state, systems, active: true };
}

/** Marks a system as running. */
export function markRunning(state: DevModeState, systemId: string): DevModeState {
  const systems = new Map(state.systems);
  const sys = systems.get(systemId);
  if (sys) {
    systems.set(systemId, { ...sys, status: "running" });
  }
  return { ...state, systems };
}

/** Records a file change and queues reload actions. */
export function recordChange(
  state: DevModeState,
  event: FileChangeEvent,
): DevModeState {
  const action = createReloadAction(event.systemId, [event]);
  const expanded = expandReloads(action);

  // Mark affected systems as rebuilding
  const systems = new Map(state.systems);
  for (const reload of expanded) {
    const sys = systems.get(reload.systemId);
    if (sys) {
      systems.set(reload.systemId, { ...sys, status: "rebuilding" });
    }
  }

  return {
    ...state,
    systems,
    pendingReloads: [...state.pendingReloads, ...expanded],
    totalChanges: state.totalChanges + 1,
  };
}

/** Completes a reload action for a system. */
export function completeReload(
  state: DevModeState,
  systemId: string,
  success: boolean,
  error?: string,
): DevModeState {
  const systems = new Map(state.systems);
  const sys = systems.get(systemId);
  if (sys) {
    systems.set(systemId, {
      ...sys,
      status: success ? "running" : "error",
      lastBuild: Date.now(),
      buildCount: sys.buildCount + 1,
      errors: error ? [...sys.errors, error] : sys.errors,
    });
  }

  const pendingReloads = state.pendingReloads.filter(
    (r) => r.systemId !== systemId,
  );

  return { ...state, systems, pendingReloads };
}

/** Stops dev mode. */
export function stopDevMode(state: DevModeState): DevModeState {
  const systems = new Map(state.systems);
  for (const [id, sys] of systems) {
    systems.set(id, { ...sys, status: "stopped" });
  }
  return { ...state, systems, active: false, pendingReloads: [] };
}

/** Gets a summary of all system statuses. */
export function getDevSummary(state: DevModeState): Record<string, SystemStatus> {
  const summary: Record<string, SystemStatus> = {};
  for (const [id, sys] of state.systems) {
    summary[id] = sys.status;
  }
  return summary;
}

/** Returns systems that have errors. */
export function getErrorSystems(state: DevModeState): SystemState[] {
  const result: SystemState[] = [];
  for (const sys of state.systems.values()) {
    if (sys.status === "error" || sys.errors.length > 0) {
      result.push(sys);
    }
  }
  return result;
}

/** Checks if all systems are running. */
export function allRunning(state: DevModeState): boolean {
  for (const sys of state.systems.values()) {
    if (sys.status !== "running") return false;
  }
  return true;
}
