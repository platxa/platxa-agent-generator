/**
 * Lazy Loading for Heavy UI Components
 *
 * Provides lazy loading utilities for heavy components like Monaco editor,
 * device frames, and diff viewer to improve initial page load performance.
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Lazy loading status.
 */
export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Component identifier for lazy loading.
 */
export type LazyComponentId =
  | 'monaco-editor'
  | 'device-frames'
  | 'diff-viewer'
  | 'code-preview'
  | 'image-editor'
  | 'chart-library';

/**
 * Configuration for a lazy-loaded component.
 */
export interface LazyComponentConfig {
  /** Component identifier */
  id: LazyComponentId;
  /** Display name */
  name: string;
  /** Estimated size in KB */
  estimatedSizeKB: number;
  /** Dependencies that must be loaded first */
  dependencies: LazyComponentId[];
  /** Preload conditions */
  preloadOn: PreloadTrigger[];
  /** Whether to prefetch on idle */
  prefetchOnIdle: boolean;
  /** Timeout in milliseconds */
  timeoutMs: number;
}

/**
 * Preload trigger conditions.
 */
export type PreloadTrigger =
  | 'hover'
  | 'visible'
  | 'idle'
  | 'route-match'
  | 'user-interaction';

/**
 * State of a lazy-loaded component.
 */
export interface LazyComponentState {
  /** Component config */
  config: LazyComponentConfig;
  /** Current load status */
  status: LoadStatus;
  /** Load start timestamp */
  loadStartTime?: number;
  /** Load end timestamp */
  loadEndTime?: number;
  /** Error if loading failed */
  error?: string;
  /** Number of load attempts */
  attempts: number;
}

/**
 * Lazy loader state.
 */
export interface LazyLoaderState {
  /** Component states by ID */
  components: Map<LazyComponentId, LazyComponentState>;
  /** Global loading queue */
  loadQueue: LazyComponentId[];
  /** Currently loading components */
  loading: Set<LazyComponentId>;
  /** Maximum concurrent loads */
  maxConcurrent: number;
}

/**
 * Load result.
 */
export interface LoadResult {
  /** Component ID */
  id: LazyComponentId;
  /** Whether load succeeded */
  success: boolean;
  /** Load duration in ms */
  durationMs: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Lazy loader metrics.
 */
export interface LazyLoaderMetrics {
  /** Total components registered */
  totalComponents: number;
  /** Components loaded */
  loadedComponents: number;
  /** Components with errors */
  errorComponents: number;
  /** Total estimated size KB */
  totalEstimatedSizeKB: number;
  /** Loaded size KB */
  loadedSizeKB: number;
  /** Average load time ms */
  averageLoadTimeMs: number;
  /** Components by status */
  byStatus: Record<LoadStatus, number>;
}

// =============================================================================
// Default Component Configurations
// =============================================================================

/**
 * Monaco Editor configuration.
 */
export const MONACO_EDITOR_CONFIG: LazyComponentConfig = {
  id: 'monaco-editor',
  name: 'Monaco Code Editor',
  estimatedSizeKB: 2500,
  dependencies: [],
  preloadOn: ['hover', 'route-match'],
  prefetchOnIdle: true,
  timeoutMs: 30000,
};

/**
 * Device Frames configuration.
 */
export const DEVICE_FRAMES_CONFIG: LazyComponentConfig = {
  id: 'device-frames',
  name: 'Device Preview Frames',
  estimatedSizeKB: 500,
  dependencies: [],
  preloadOn: ['visible', 'route-match'],
  prefetchOnIdle: true,
  timeoutMs: 15000,
};

/**
 * Diff Viewer configuration.
 */
export const DIFF_VIEWER_CONFIG: LazyComponentConfig = {
  id: 'diff-viewer',
  name: 'Code Diff Viewer',
  estimatedSizeKB: 800,
  dependencies: ['monaco-editor'],
  preloadOn: ['hover', 'user-interaction'],
  prefetchOnIdle: false,
  timeoutMs: 20000,
};

/**
 * Code Preview configuration.
 */
export const CODE_PREVIEW_CONFIG: LazyComponentConfig = {
  id: 'code-preview',
  name: 'Live Code Preview',
  estimatedSizeKB: 1200,
  dependencies: [],
  preloadOn: ['visible'],
  prefetchOnIdle: true,
  timeoutMs: 20000,
};

/**
 * Image Editor configuration.
 */
export const IMAGE_EDITOR_CONFIG: LazyComponentConfig = {
  id: 'image-editor',
  name: 'Image Editor',
  estimatedSizeKB: 1500,
  dependencies: [],
  preloadOn: ['user-interaction'],
  prefetchOnIdle: false,
  timeoutMs: 25000,
};

/**
 * Chart Library configuration.
 */
export const CHART_LIBRARY_CONFIG: LazyComponentConfig = {
  id: 'chart-library',
  name: 'Chart Library',
  estimatedSizeKB: 600,
  dependencies: [],
  preloadOn: ['visible', 'route-match'],
  prefetchOnIdle: true,
  timeoutMs: 15000,
};

/**
 * All default component configurations.
 */
export const DEFAULT_COMPONENT_CONFIGS: LazyComponentConfig[] = [
  MONACO_EDITOR_CONFIG,
  DEVICE_FRAMES_CONFIG,
  DIFF_VIEWER_CONFIG,
  CODE_PREVIEW_CONFIG,
  IMAGE_EDITOR_CONFIG,
  CHART_LIBRARY_CONFIG,
];

// =============================================================================
// State Management
// =============================================================================

/**
 * Creates initial lazy loader state.
 */
export function createLazyLoaderState(
  configs: LazyComponentConfig[] = DEFAULT_COMPONENT_CONFIGS,
  maxConcurrent: number = 2,
): LazyLoaderState {
  const components = new Map<LazyComponentId, LazyComponentState>();

  for (const config of configs) {
    components.set(config.id, {
      config,
      status: 'idle',
      attempts: 0,
    });
  }

  return {
    components,
    loadQueue: [],
    loading: new Set(),
    maxConcurrent,
  };
}

/**
 * Gets component state.
 */
export function getComponentState(
  state: LazyLoaderState,
  id: LazyComponentId,
): LazyComponentState | undefined {
  return state.components.get(id);
}

/**
 * Checks if a component is loaded.
 */
export function isComponentLoaded(
  state: LazyLoaderState,
  id: LazyComponentId,
): boolean {
  const component = state.components.get(id);
  return component?.status === 'loaded';
}

/**
 * Checks if a component is loading.
 */
export function isComponentLoading(
  state: LazyLoaderState,
  id: LazyComponentId,
): boolean {
  const component = state.components.get(id);
  return component?.status === 'loading';
}

/**
 * Gets all loaded components.
 */
export function getLoadedComponents(state: LazyLoaderState): LazyComponentId[] {
  const loaded: LazyComponentId[] = [];
  for (const [id, component] of state.components) {
    if (component.status === 'loaded') {
      loaded.push(id);
    }
  }
  return loaded;
}

// =============================================================================
// Loading Operations
// =============================================================================

/**
 * Queues a component for loading.
 */
export function queueLoad(
  state: LazyLoaderState,
  id: LazyComponentId,
): LazyLoaderState {
  const component = state.components.get(id);
  if (!component) return state;

  // Skip if already loaded or loading
  if (component.status === 'loaded' || component.status === 'loading') {
    return state;
  }

  // Skip if already in queue
  if (state.loadQueue.includes(id)) {
    return state;
  }

  // Queue dependencies first
  const newQueue = [...state.loadQueue];
  for (const depId of component.config.dependencies) {
    const dep = state.components.get(depId);
    if (dep && dep.status !== 'loaded' && !newQueue.includes(depId)) {
      newQueue.push(depId);
    }
  }

  // Add component to queue
  newQueue.push(id);

  return { ...state, loadQueue: newQueue };
}

/**
 * Starts loading a component.
 */
export function startLoad(
  state: LazyLoaderState,
  id: LazyComponentId,
  now: number = Date.now(),
): LazyLoaderState {
  const component = state.components.get(id);
  if (!component) return state;

  const updatedComponents = new Map(state.components);
  updatedComponents.set(id, {
    ...component,
    status: 'loading',
    loadStartTime: now,
    attempts: component.attempts + 1,
  });

  const loading = new Set(state.loading);
  loading.add(id);

  const loadQueue = state.loadQueue.filter((qid) => qid !== id);

  return {
    ...state,
    components: updatedComponents,
    loading,
    loadQueue,
  };
}

/**
 * Marks a component as loaded.
 */
export function completeLoad(
  state: LazyLoaderState,
  id: LazyComponentId,
  now: number = Date.now(),
): LazyLoaderState {
  const component = state.components.get(id);
  if (!component) return state;

  const updatedComponents = new Map(state.components);
  updatedComponents.set(id, {
    ...component,
    status: 'loaded',
    loadEndTime: now,
    error: undefined,
  });

  const loading = new Set(state.loading);
  loading.delete(id);

  return {
    ...state,
    components: updatedComponents,
    loading,
  };
}

/**
 * Marks a component load as failed.
 */
export function failLoad(
  state: LazyLoaderState,
  id: LazyComponentId,
  error: string,
  now: number = Date.now(),
): LazyLoaderState {
  const component = state.components.get(id);
  if (!component) return state;

  const updatedComponents = new Map(state.components);
  updatedComponents.set(id, {
    ...component,
    status: 'error',
    loadEndTime: now,
    error,
  });

  const loading = new Set(state.loading);
  loading.delete(id);

  return {
    ...state,
    components: updatedComponents,
    loading,
  };
}

/**
 * Resets a component to idle state for retry.
 */
export function resetComponent(
  state: LazyLoaderState,
  id: LazyComponentId,
): LazyLoaderState {
  const component = state.components.get(id);
  if (!component) return state;

  const updatedComponents = new Map(state.components);
  updatedComponents.set(id, {
    ...component,
    status: 'idle',
    loadStartTime: undefined,
    loadEndTime: undefined,
    error: undefined,
  });

  return {
    ...state,
    components: updatedComponents,
  };
}

// =============================================================================
// Queue Processing
// =============================================================================

/**
 * Gets the next component to load from the queue.
 */
export function getNextToLoad(state: LazyLoaderState): LazyComponentId | null {
  // Check if we can load more
  if (state.loading.size >= state.maxConcurrent) {
    return null;
  }

  // Find next component with all dependencies loaded
  for (const id of state.loadQueue) {
    const component = state.components.get(id);
    if (!component) continue;

    const depsLoaded = component.config.dependencies.every((depId) => {
      const dep = state.components.get(depId);
      return dep?.status === 'loaded';
    });

    if (depsLoaded) {
      return id;
    }
  }

  return null;
}

/**
 * Processes the load queue, starting loads as capacity allows.
 */
export function processQueue(
  state: LazyLoaderState,
  now: number = Date.now(),
): { state: LazyLoaderState; started: LazyComponentId[] } {
  const started: LazyComponentId[] = [];
  let currentState = state;

  while (currentState.loading.size < currentState.maxConcurrent) {
    const next = getNextToLoad(currentState);
    if (!next) break;

    currentState = startLoad(currentState, next, now);
    started.push(next);
  }

  return { state: currentState, started };
}

// =============================================================================
// Preloading
// =============================================================================

/**
 * Gets components that should preload on a trigger.
 */
export function getPreloadCandidates(
  state: LazyLoaderState,
  trigger: PreloadTrigger,
): LazyComponentId[] {
  const candidates: LazyComponentId[] = [];

  for (const [id, component] of state.components) {
    if (component.status !== 'idle') continue;
    if (component.config.preloadOn.includes(trigger)) {
      candidates.push(id);
    }
  }

  return candidates;
}

/**
 * Queues components for preloading based on trigger.
 */
export function triggerPreload(
  state: LazyLoaderState,
  trigger: PreloadTrigger,
): LazyLoaderState {
  const candidates = getPreloadCandidates(state, trigger);
  let currentState = state;

  for (const id of candidates) {
    currentState = queueLoad(currentState, id);
  }

  return currentState;
}

/**
 * Gets components that should prefetch on idle.
 */
export function getIdlePrefetchCandidates(state: LazyLoaderState): LazyComponentId[] {
  const candidates: LazyComponentId[] = [];

  for (const [id, component] of state.components) {
    if (component.status !== 'idle') continue;
    if (component.config.prefetchOnIdle) {
      candidates.push(id);
    }
  }

  // Sort by estimated size (smallest first)
  candidates.sort((a, b) => {
    const sizeA = state.components.get(a)?.config.estimatedSizeKB ?? 0;
    const sizeB = state.components.get(b)?.config.estimatedSizeKB ?? 0;
    return sizeA - sizeB;
  });

  return candidates;
}

// =============================================================================
// Dependency Resolution
// =============================================================================

/**
 * Gets all dependencies for a component (recursive).
 */
export function getAllDependencies(
  state: LazyLoaderState,
  id: LazyComponentId,
  visited: Set<LazyComponentId> = new Set(),
): LazyComponentId[] {
  if (visited.has(id)) return [];
  visited.add(id);

  const component = state.components.get(id);
  if (!component) return [];

  const deps: LazyComponentId[] = [];
  for (const depId of component.config.dependencies) {
    deps.push(depId);
    deps.push(...getAllDependencies(state, depId, visited));
  }

  return [...new Set(deps)];
}

/**
 * Gets load order respecting dependencies.
 */
export function getLoadOrder(
  state: LazyLoaderState,
  ids: LazyComponentId[],
): LazyComponentId[] {
  const allDeps = new Set<LazyComponentId>();
  for (const id of ids) {
    allDeps.add(id);
    for (const dep of getAllDependencies(state, id)) {
      allDeps.add(dep);
    }
  }

  // Topological sort
  const order: LazyComponentId[] = [];
  const pending = new Set(allDeps);

  while (pending.size > 0) {
    let foundOne = false;

    for (const id of pending) {
      const component = state.components.get(id);
      if (!component) {
        pending.delete(id);
        continue;
      }

      const depsResolved = component.config.dependencies.every(
        (depId) => !pending.has(depId),
      );

      if (depsResolved) {
        order.push(id);
        pending.delete(id);
        foundOne = true;
      }
    }

    // Circular dependency - just add remaining
    if (!foundOne && pending.size > 0) {
      order.push(...pending);
      break;
    }
  }

  return order;
}

// =============================================================================
// Metrics
// =============================================================================

/**
 * Computes lazy loader metrics.
 */
export function computeMetrics(state: LazyLoaderState): LazyLoaderMetrics {
  const byStatus: Record<LoadStatus, number> = {
    idle: 0,
    loading: 0,
    loaded: 0,
    error: 0,
  };

  let totalEstimatedSizeKB = 0;
  let loadedSizeKB = 0;
  let totalLoadTime = 0;
  let loadedCount = 0;

  for (const [, component] of state.components) {
    byStatus[component.status]++;
    totalEstimatedSizeKB += component.config.estimatedSizeKB;

    if (component.status === 'loaded') {
      loadedSizeKB += component.config.estimatedSizeKB;
      if (component.loadStartTime && component.loadEndTime) {
        totalLoadTime += component.loadEndTime - component.loadStartTime;
        loadedCount++;
      }
    }
  }

  return {
    totalComponents: state.components.size,
    loadedComponents: byStatus.loaded,
    errorComponents: byStatus.error,
    totalEstimatedSizeKB,
    loadedSizeKB,
    averageLoadTimeMs: loadedCount > 0 ? Math.round(totalLoadTime / loadedCount) : 0,
    byStatus,
  };
}

// =============================================================================
// Formatting
// =============================================================================

/**
 * Formats component state as string.
 */
export function formatComponentState(component: LazyComponentState): string {
  const statusIcon = {
    idle: '○',
    loading: '◐',
    loaded: '✓',
    error: '✗',
  };

  const icon = statusIcon[component.status];
  const size = `${component.config.estimatedSizeKB}KB`;
  let duration = '';

  if (component.loadStartTime && component.loadEndTime) {
    const ms = component.loadEndTime - component.loadStartTime;
    duration = ` (${ms}ms)`;
  }

  return `${icon} ${component.config.name} [${size}]${duration}`;
}

/**
 * Formats metrics as string.
 */
export function formatMetrics(metrics: LazyLoaderMetrics): string {
  const lines = [
    '═══════════════════════════════════════════════════════════',
    '  LAZY LOADER STATUS',
    '═══════════════════════════════════════════════════════════',
    '',
    '📦 COMPONENTS',
    `  Total: ${metrics.totalComponents}`,
    `  Loaded: ${metrics.loadedComponents}`,
    `  Loading: ${metrics.byStatus.loading}`,
    `  Idle: ${metrics.byStatus.idle}`,
    `  Errors: ${metrics.errorComponents}`,
    '',
    '📊 SIZE',
    `  Total: ${metrics.totalEstimatedSizeKB}KB`,
    `  Loaded: ${metrics.loadedSizeKB}KB`,
    `  Progress: ${Math.round((metrics.loadedSizeKB / metrics.totalEstimatedSizeKB) * 100)}%`,
    '',
    '⏱️  PERFORMANCE',
    `  Avg Load Time: ${metrics.averageLoadTimeMs}ms`,
    '═══════════════════════════════════════════════════════════',
  ];

  return lines.join('\n');
}

/**
 * Formats load queue as string.
 */
export function formatLoadQueue(state: LazyLoaderState): string {
  if (state.loadQueue.length === 0 && state.loading.size === 0) {
    return 'Queue: Empty';
  }

  const lines = ['Queue:'];

  for (const id of state.loading) {
    const component = state.components.get(id);
    if (component) {
      lines.push(`  ◐ Loading: ${component.config.name}`);
    }
  }

  for (const id of state.loadQueue) {
    const component = state.components.get(id);
    if (component) {
      lines.push(`  ○ Pending: ${component.config.name}`);
    }
  }

  return lines.join('\n');
}

// =============================================================================
// Component-Specific Helpers
// =============================================================================

/**
 * Checks if Monaco editor is loaded.
 */
export function isMonacoLoaded(state: LazyLoaderState): boolean {
  return isComponentLoaded(state, 'monaco-editor');
}

/**
 * Checks if device frames are loaded.
 */
export function isDeviceFramesLoaded(state: LazyLoaderState): boolean {
  return isComponentLoaded(state, 'device-frames');
}

/**
 * Checks if diff viewer is loaded.
 */
export function isDiffViewerLoaded(state: LazyLoaderState): boolean {
  return isComponentLoaded(state, 'diff-viewer');
}

/**
 * Queues Monaco editor for loading.
 */
export function queueMonacoLoad(state: LazyLoaderState): LazyLoaderState {
  return queueLoad(state, 'monaco-editor');
}

/**
 * Queues device frames for loading.
 */
export function queueDeviceFramesLoad(state: LazyLoaderState): LazyLoaderState {
  return queueLoad(state, 'device-frames');
}

/**
 * Queues diff viewer for loading.
 */
export function queueDiffViewerLoad(state: LazyLoaderState): LazyLoaderState {
  return queueLoad(state, 'diff-viewer');
}

// =============================================================================
// Timeout Handling
// =============================================================================

/**
 * Checks for timed out loads.
 */
export function checkTimeouts(
  state: LazyLoaderState,
  now: number = Date.now(),
): { state: LazyLoaderState; timedOut: LazyComponentId[] } {
  const timedOut: LazyComponentId[] = [];
  let currentState = state;

  for (const id of state.loading) {
    const component = state.components.get(id);
    if (!component || !component.loadStartTime) continue;

    const elapsed = now - component.loadStartTime;
    if (elapsed > component.config.timeoutMs) {
      currentState = failLoad(currentState, id, 'Load timeout', now);
      timedOut.push(id);
    }
  }

  return { state: currentState, timedOut };
}
