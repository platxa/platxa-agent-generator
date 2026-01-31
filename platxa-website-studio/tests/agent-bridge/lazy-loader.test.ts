import { describe, it, expect } from 'vitest';
import {
  MONACO_EDITOR_CONFIG,
  DEVICE_FRAMES_CONFIG,
  DIFF_VIEWER_CONFIG,
  DEFAULT_COMPONENT_CONFIGS,
  createLazyLoaderState,
  getComponentState,
  isComponentLoaded,
  isComponentLoading,
  getLoadedComponents,
  queueLoad,
  startLoad,
  completeLoad,
  failLoad,
  resetComponent,
  getNextToLoad,
  processQueue,
  getPreloadCandidates,
  triggerPreload,
  getIdlePrefetchCandidates,
  getAllDependencies,
  getLoadOrder,
  computeMetrics,
  formatComponentState,
  formatMetrics,
  formatLoadQueue,
  isMonacoLoaded,
  isDeviceFramesLoaded,
  isDiffViewerLoaded,
  queueMonacoLoad,
  queueDeviceFramesLoad,
  queueDiffViewerLoad,
  checkTimeouts,
} from '@/lib/agent-bridge/lazy-loader';

describe('Lazy Loader', () => {
  // ===========================================================================
  // Verification: Monaco editor, device frames, diff viewer lazy loaded
  // ===========================================================================

  describe('Verification: Required Components', () => {
    it('has Monaco editor configuration', () => {
      expect(MONACO_EDITOR_CONFIG).toBeDefined();
      expect(MONACO_EDITOR_CONFIG.id).toBe('monaco-editor');
      expect(MONACO_EDITOR_CONFIG.name).toBe('Monaco Code Editor');
      expect(MONACO_EDITOR_CONFIG.estimatedSizeKB).toBeGreaterThan(0);
    });

    it('has device frames configuration', () => {
      expect(DEVICE_FRAMES_CONFIG).toBeDefined();
      expect(DEVICE_FRAMES_CONFIG.id).toBe('device-frames');
      expect(DEVICE_FRAMES_CONFIG.name).toBe('Device Preview Frames');
      expect(DEVICE_FRAMES_CONFIG.estimatedSizeKB).toBeGreaterThan(0);
    });

    it('has diff viewer configuration', () => {
      expect(DIFF_VIEWER_CONFIG).toBeDefined();
      expect(DIFF_VIEWER_CONFIG.id).toBe('diff-viewer');
      expect(DIFF_VIEWER_CONFIG.name).toBe('Code Diff Viewer');
      expect(DIFF_VIEWER_CONFIG.estimatedSizeKB).toBeGreaterThan(0);
    });

    it('diff viewer depends on Monaco editor', () => {
      expect(DIFF_VIEWER_CONFIG.dependencies).toContain('monaco-editor');
    });

    it('can queue and load Monaco editor', () => {
      let state = createLazyLoaderState();
      expect(isMonacoLoaded(state)).toBe(false);

      state = queueMonacoLoad(state);
      expect(state.loadQueue).toContain('monaco-editor');

      state = startLoad(state, 'monaco-editor');
      expect(isComponentLoading(state, 'monaco-editor')).toBe(true);

      state = completeLoad(state, 'monaco-editor');
      expect(isMonacoLoaded(state)).toBe(true);
    });

    it('can queue and load device frames', () => {
      let state = createLazyLoaderState();
      expect(isDeviceFramesLoaded(state)).toBe(false);

      state = queueDeviceFramesLoad(state);
      expect(state.loadQueue).toContain('device-frames');

      state = startLoad(state, 'device-frames');
      state = completeLoad(state, 'device-frames');
      expect(isDeviceFramesLoaded(state)).toBe(true);
    });

    it('can queue and load diff viewer with dependency', () => {
      let state = createLazyLoaderState();
      expect(isDiffViewerLoaded(state)).toBe(false);

      // Queue diff viewer - should also queue monaco dependency
      state = queueDiffViewerLoad(state);
      expect(state.loadQueue).toContain('monaco-editor');
      expect(state.loadQueue).toContain('diff-viewer');

      // Monaco should be before diff-viewer
      const monacoIndex = state.loadQueue.indexOf('monaco-editor');
      const diffIndex = state.loadQueue.indexOf('diff-viewer');
      expect(monacoIndex).toBeLessThan(diffIndex);
    });
  });

  // ===========================================================================
  // Configuration
  // ===========================================================================

  describe('Default Configurations', () => {
    it('includes all required components', () => {
      const ids = DEFAULT_COMPONENT_CONFIGS.map((c) => c.id);
      expect(ids).toContain('monaco-editor');
      expect(ids).toContain('device-frames');
      expect(ids).toContain('diff-viewer');
    });

    it('each config has required fields', () => {
      for (const config of DEFAULT_COMPONENT_CONFIGS) {
        expect(config.id).toBeTruthy();
        expect(config.name).toBeTruthy();
        expect(config.estimatedSizeKB).toBeGreaterThan(0);
        expect(Array.isArray(config.dependencies)).toBe(true);
        expect(Array.isArray(config.preloadOn)).toBe(true);
        expect(typeof config.prefetchOnIdle).toBe('boolean');
        expect(config.timeoutMs).toBeGreaterThan(0);
      }
    });

    it('dependencies reference valid components', () => {
      const validIds = new Set(DEFAULT_COMPONENT_CONFIGS.map((c) => c.id));
      for (const config of DEFAULT_COMPONENT_CONFIGS) {
        for (const dep of config.dependencies) {
          expect(validIds.has(dep), `${config.id} has invalid dep: ${dep}`).toBe(true);
        }
      }
    });
  });

  // ===========================================================================
  // State Management
  // ===========================================================================

  describe('createLazyLoaderState', () => {
    it('creates state with default configs', () => {
      const state = createLazyLoaderState();
      expect(state.components.size).toBe(DEFAULT_COMPONENT_CONFIGS.length);
      expect(state.loadQueue).toHaveLength(0);
      expect(state.loading.size).toBe(0);
      expect(state.maxConcurrent).toBe(2);
    });

    it('creates state with custom configs', () => {
      const state = createLazyLoaderState([MONACO_EDITOR_CONFIG]);
      expect(state.components.size).toBe(1);
      expect(state.components.has('monaco-editor')).toBe(true);
    });

    it('creates state with custom max concurrent', () => {
      const state = createLazyLoaderState(DEFAULT_COMPONENT_CONFIGS, 4);
      expect(state.maxConcurrent).toBe(4);
    });

    it('initializes all components as idle', () => {
      const state = createLazyLoaderState();
      for (const [, component] of state.components) {
        expect(component.status).toBe('idle');
        expect(component.attempts).toBe(0);
      }
    });
  });

  describe('getComponentState', () => {
    it('returns component state', () => {
      const state = createLazyLoaderState();
      const component = getComponentState(state, 'monaco-editor');
      expect(component).toBeDefined();
      expect(component?.config.id).toBe('monaco-editor');
    });

    it('returns undefined for unknown component', () => {
      const state = createLazyLoaderState();
      const component = getComponentState(state, 'nonexistent' as any);
      expect(component).toBeUndefined();
    });
  });

  describe('isComponentLoaded', () => {
    it('returns false for idle component', () => {
      const state = createLazyLoaderState();
      expect(isComponentLoaded(state, 'monaco-editor')).toBe(false);
    });

    it('returns true for loaded component', () => {
      let state = createLazyLoaderState();
      state = startLoad(state, 'monaco-editor');
      state = completeLoad(state, 'monaco-editor');
      expect(isComponentLoaded(state, 'monaco-editor')).toBe(true);
    });
  });

  describe('isComponentLoading', () => {
    it('returns false for idle component', () => {
      const state = createLazyLoaderState();
      expect(isComponentLoading(state, 'monaco-editor')).toBe(false);
    });

    it('returns true for loading component', () => {
      let state = createLazyLoaderState();
      state = startLoad(state, 'monaco-editor');
      expect(isComponentLoading(state, 'monaco-editor')).toBe(true);
    });
  });

  describe('getLoadedComponents', () => {
    it('returns empty array initially', () => {
      const state = createLazyLoaderState();
      expect(getLoadedComponents(state)).toHaveLength(0);
    });

    it('returns loaded components', () => {
      let state = createLazyLoaderState();
      state = startLoad(state, 'monaco-editor');
      state = completeLoad(state, 'monaco-editor');
      state = startLoad(state, 'device-frames');
      state = completeLoad(state, 'device-frames');

      const loaded = getLoadedComponents(state);
      expect(loaded).toContain('monaco-editor');
      expect(loaded).toContain('device-frames');
    });
  });

  // ===========================================================================
  // Loading Operations
  // ===========================================================================

  describe('queueLoad', () => {
    it('adds component to queue', () => {
      let state = createLazyLoaderState();
      state = queueLoad(state, 'monaco-editor');
      expect(state.loadQueue).toContain('monaco-editor');
    });

    it('does not duplicate in queue', () => {
      let state = createLazyLoaderState();
      state = queueLoad(state, 'monaco-editor');
      state = queueLoad(state, 'monaco-editor');
      expect(state.loadQueue.filter((id) => id === 'monaco-editor')).toHaveLength(1);
    });

    it('skips already loaded components', () => {
      let state = createLazyLoaderState();
      state = startLoad(state, 'monaco-editor');
      state = completeLoad(state, 'monaco-editor');
      state = queueLoad(state, 'monaco-editor');
      expect(state.loadQueue).not.toContain('monaco-editor');
    });

    it('queues dependencies first', () => {
      let state = createLazyLoaderState();
      state = queueLoad(state, 'diff-viewer');

      const monacoIndex = state.loadQueue.indexOf('monaco-editor');
      const diffIndex = state.loadQueue.indexOf('diff-viewer');
      expect(monacoIndex).toBeLessThan(diffIndex);
    });
  });

  describe('startLoad', () => {
    it('sets status to loading', () => {
      let state = createLazyLoaderState();
      state = startLoad(state, 'monaco-editor', 1000);

      const component = getComponentState(state, 'monaco-editor');
      expect(component?.status).toBe('loading');
      expect(component?.loadStartTime).toBe(1000);
      expect(component?.attempts).toBe(1);
    });

    it('adds to loading set', () => {
      let state = createLazyLoaderState();
      state = startLoad(state, 'monaco-editor');
      expect(state.loading.has('monaco-editor')).toBe(true);
    });

    it('removes from queue', () => {
      let state = createLazyLoaderState();
      state = queueLoad(state, 'monaco-editor');
      state = startLoad(state, 'monaco-editor');
      expect(state.loadQueue).not.toContain('monaco-editor');
    });

    it('increments attempts', () => {
      let state = createLazyLoaderState();
      state = startLoad(state, 'monaco-editor');
      state = failLoad(state, 'monaco-editor', 'error');
      state = resetComponent(state, 'monaco-editor');
      state = startLoad(state, 'monaco-editor');

      const component = getComponentState(state, 'monaco-editor');
      expect(component?.attempts).toBe(2);
    });
  });

  describe('completeLoad', () => {
    it('sets status to loaded', () => {
      let state = createLazyLoaderState();
      state = startLoad(state, 'monaco-editor', 1000);
      state = completeLoad(state, 'monaco-editor', 2000);

      const component = getComponentState(state, 'monaco-editor');
      expect(component?.status).toBe('loaded');
      expect(component?.loadEndTime).toBe(2000);
    });

    it('removes from loading set', () => {
      let state = createLazyLoaderState();
      state = startLoad(state, 'monaco-editor');
      state = completeLoad(state, 'monaco-editor');
      expect(state.loading.has('monaco-editor')).toBe(false);
    });

    it('clears error', () => {
      let state = createLazyLoaderState();
      state = startLoad(state, 'monaco-editor');
      state = failLoad(state, 'monaco-editor', 'error');
      state = resetComponent(state, 'monaco-editor');
      state = startLoad(state, 'monaco-editor');
      state = completeLoad(state, 'monaco-editor');

      const component = getComponentState(state, 'monaco-editor');
      expect(component?.error).toBeUndefined();
    });
  });

  describe('failLoad', () => {
    it('sets status to error', () => {
      let state = createLazyLoaderState();
      state = startLoad(state, 'monaco-editor', 1000);
      state = failLoad(state, 'monaco-editor', 'Network error', 2000);

      const component = getComponentState(state, 'monaco-editor');
      expect(component?.status).toBe('error');
      expect(component?.error).toBe('Network error');
      expect(component?.loadEndTime).toBe(2000);
    });

    it('removes from loading set', () => {
      let state = createLazyLoaderState();
      state = startLoad(state, 'monaco-editor');
      state = failLoad(state, 'monaco-editor', 'error');
      expect(state.loading.has('monaco-editor')).toBe(false);
    });
  });

  describe('resetComponent', () => {
    it('resets to idle status', () => {
      let state = createLazyLoaderState();
      state = startLoad(state, 'monaco-editor');
      state = failLoad(state, 'monaco-editor', 'error');
      state = resetComponent(state, 'monaco-editor');

      const component = getComponentState(state, 'monaco-editor');
      expect(component?.status).toBe('idle');
      expect(component?.error).toBeUndefined();
      expect(component?.loadStartTime).toBeUndefined();
      expect(component?.loadEndTime).toBeUndefined();
    });
  });

  // ===========================================================================
  // Queue Processing
  // ===========================================================================

  describe('getNextToLoad', () => {
    it('returns null when queue is empty', () => {
      const state = createLazyLoaderState();
      expect(getNextToLoad(state)).toBeNull();
    });

    it('returns null when at max concurrent', () => {
      let state = createLazyLoaderState(DEFAULT_COMPONENT_CONFIGS, 1);
      state = queueLoad(state, 'monaco-editor');
      state = queueLoad(state, 'device-frames');
      state = startLoad(state, 'monaco-editor');

      expect(getNextToLoad(state)).toBeNull();
    });

    it('returns next component with dependencies met', () => {
      let state = createLazyLoaderState();
      state = queueLoad(state, 'diff-viewer'); // Queues monaco first

      // Monaco has no deps, should be next
      expect(getNextToLoad(state)).toBe('monaco-editor');
    });

    it('skips components with unmet dependencies', () => {
      let state = createLazyLoaderState();
      state = queueLoad(state, 'diff-viewer');
      state = startLoad(state, 'monaco-editor');

      // Diff viewer depends on monaco which is loading, not loaded
      expect(getNextToLoad(state)).toBeNull();
    });
  });

  describe('processQueue', () => {
    it('starts loads up to max concurrent', () => {
      let state = createLazyLoaderState(DEFAULT_COMPONENT_CONFIGS, 2);
      state = queueLoad(state, 'monaco-editor');
      state = queueLoad(state, 'device-frames');
      state = queueLoad(state, 'chart-library');

      const { state: newState, started } = processQueue(state);
      expect(started).toHaveLength(2);
      expect(newState.loading.size).toBe(2);
    });

    it('respects dependency order', () => {
      let state = createLazyLoaderState();
      state = queueLoad(state, 'diff-viewer');

      const { started } = processQueue(state);
      // Should start monaco first (diff-viewer's dependency)
      expect(started[0]).toBe('monaco-editor');
    });
  });

  // ===========================================================================
  // Preloading
  // ===========================================================================

  describe('getPreloadCandidates', () => {
    it('returns components matching trigger', () => {
      const state = createLazyLoaderState();
      const candidates = getPreloadCandidates(state, 'hover');
      expect(candidates.length).toBeGreaterThan(0);
    });

    it('excludes already loaded components', () => {
      let state = createLazyLoaderState();
      state = startLoad(state, 'monaco-editor');
      state = completeLoad(state, 'monaco-editor');

      const candidates = getPreloadCandidates(state, 'hover');
      expect(candidates).not.toContain('monaco-editor');
    });
  });

  describe('triggerPreload', () => {
    it('queues matching components', () => {
      let state = createLazyLoaderState();
      state = triggerPreload(state, 'visible');
      expect(state.loadQueue.length).toBeGreaterThan(0);
    });
  });

  describe('getIdlePrefetchCandidates', () => {
    it('returns components with prefetchOnIdle true', () => {
      const state = createLazyLoaderState();
      const candidates = getIdlePrefetchCandidates(state);
      expect(candidates.length).toBeGreaterThan(0);

      for (const id of candidates) {
        const component = getComponentState(state, id);
        expect(component?.config.prefetchOnIdle).toBe(true);
      }
    });

    it('sorts by size (smallest first)', () => {
      const state = createLazyLoaderState();
      const candidates = getIdlePrefetchCandidates(state);

      if (candidates.length >= 2) {
        const size0 = getComponentState(state, candidates[0])?.config.estimatedSizeKB ?? 0;
        const size1 = getComponentState(state, candidates[1])?.config.estimatedSizeKB ?? 0;
        expect(size0).toBeLessThanOrEqual(size1);
      }
    });
  });

  // ===========================================================================
  // Dependency Resolution
  // ===========================================================================

  describe('getAllDependencies', () => {
    it('returns empty for component with no deps', () => {
      const state = createLazyLoaderState();
      const deps = getAllDependencies(state, 'monaco-editor');
      expect(deps).toHaveLength(0);
    });

    it('returns direct dependencies', () => {
      const state = createLazyLoaderState();
      const deps = getAllDependencies(state, 'diff-viewer');
      expect(deps).toContain('monaco-editor');
    });
  });

  describe('getLoadOrder', () => {
    it('returns topologically sorted order', () => {
      const state = createLazyLoaderState();
      const order = getLoadOrder(state, ['diff-viewer']);

      const monacoIndex = order.indexOf('monaco-editor');
      const diffIndex = order.indexOf('diff-viewer');
      expect(monacoIndex).toBeLessThan(diffIndex);
    });

    it('includes all dependencies', () => {
      const state = createLazyLoaderState();
      const order = getLoadOrder(state, ['diff-viewer']);
      expect(order).toContain('monaco-editor');
      expect(order).toContain('diff-viewer');
    });
  });

  // ===========================================================================
  // Metrics
  // ===========================================================================

  describe('computeMetrics', () => {
    it('returns total components', () => {
      const state = createLazyLoaderState();
      const metrics = computeMetrics(state);
      expect(metrics.totalComponents).toBe(DEFAULT_COMPONENT_CONFIGS.length);
    });

    it('counts by status', () => {
      let state = createLazyLoaderState();
      state = startLoad(state, 'monaco-editor');
      state = completeLoad(state, 'monaco-editor');
      state = startLoad(state, 'device-frames');

      const metrics = computeMetrics(state);
      expect(metrics.byStatus.loaded).toBe(1);
      expect(metrics.byStatus.loading).toBe(1);
      expect(metrics.byStatus.idle).toBe(state.components.size - 2);
    });

    it('calculates loaded size', () => {
      let state = createLazyLoaderState();
      state = startLoad(state, 'monaco-editor');
      state = completeLoad(state, 'monaco-editor');

      const metrics = computeMetrics(state);
      expect(metrics.loadedSizeKB).toBe(MONACO_EDITOR_CONFIG.estimatedSizeKB);
    });

    it('calculates average load time', () => {
      let state = createLazyLoaderState();
      state = startLoad(state, 'monaco-editor', 1000);
      state = completeLoad(state, 'monaco-editor', 2000);
      state = startLoad(state, 'device-frames', 2000);
      state = completeLoad(state, 'device-frames', 2500);

      const metrics = computeMetrics(state);
      // (1000 + 500) / 2 = 750
      expect(metrics.averageLoadTimeMs).toBe(750);
    });
  });

  // ===========================================================================
  // Formatting
  // ===========================================================================

  describe('formatComponentState', () => {
    it('shows status icon', () => {
      let state = createLazyLoaderState();
      const idle = formatComponentState(getComponentState(state, 'monaco-editor')!);
      expect(idle).toContain('○');

      state = startLoad(state, 'monaco-editor');
      const loading = formatComponentState(getComponentState(state, 'monaco-editor')!);
      expect(loading).toContain('◐');

      state = completeLoad(state, 'monaco-editor');
      const loaded = formatComponentState(getComponentState(state, 'monaco-editor')!);
      expect(loaded).toContain('✓');
    });

    it('includes component name', () => {
      const state = createLazyLoaderState();
      const formatted = formatComponentState(getComponentState(state, 'monaco-editor')!);
      expect(formatted).toContain('Monaco Code Editor');
    });

    it('includes size', () => {
      const state = createLazyLoaderState();
      const formatted = formatComponentState(getComponentState(state, 'monaco-editor')!);
      expect(formatted).toContain('KB');
    });

    it('includes duration when loaded', () => {
      let state = createLazyLoaderState();
      state = startLoad(state, 'monaco-editor', 1000);
      state = completeLoad(state, 'monaco-editor', 2000);

      const formatted = formatComponentState(getComponentState(state, 'monaco-editor')!);
      expect(formatted).toContain('1000ms');
    });
  });

  describe('formatMetrics', () => {
    it('includes component counts', () => {
      const state = createLazyLoaderState();
      const metrics = computeMetrics(state);
      const formatted = formatMetrics(metrics);

      expect(formatted).toContain('COMPONENTS');
      expect(formatted).toContain(`Total: ${metrics.totalComponents}`);
    });

    it('includes size info', () => {
      const state = createLazyLoaderState();
      const metrics = computeMetrics(state);
      const formatted = formatMetrics(metrics);

      expect(formatted).toContain('SIZE');
      expect(formatted).toContain('KB');
    });

    it('includes performance info', () => {
      const state = createLazyLoaderState();
      const metrics = computeMetrics(state);
      const formatted = formatMetrics(metrics);

      expect(formatted).toContain('PERFORMANCE');
      expect(formatted).toContain('Avg Load Time');
    });
  });

  describe('formatLoadQueue', () => {
    it('shows empty when no items', () => {
      const state = createLazyLoaderState();
      const formatted = formatLoadQueue(state);
      expect(formatted).toContain('Empty');
    });

    it('shows loading items', () => {
      let state = createLazyLoaderState();
      state = startLoad(state, 'monaco-editor');

      const formatted = formatLoadQueue(state);
      expect(formatted).toContain('Loading');
      expect(formatted).toContain('Monaco');
    });

    it('shows pending items', () => {
      let state = createLazyLoaderState();
      state = queueLoad(state, 'monaco-editor');

      const formatted = formatLoadQueue(state);
      expect(formatted).toContain('Pending');
    });
  });

  // ===========================================================================
  // Timeout Handling
  // ===========================================================================

  describe('checkTimeouts', () => {
    it('returns empty when no timeouts', () => {
      let state = createLazyLoaderState();
      state = startLoad(state, 'monaco-editor', 1000);

      const { timedOut } = checkTimeouts(state, 2000);
      expect(timedOut).toHaveLength(0);
    });

    it('detects timed out loads', () => {
      let state = createLazyLoaderState();
      state = startLoad(state, 'monaco-editor', 1000);

      // Monaco timeout is 30000ms, check at 1000 + 31000
      const { state: newState, timedOut } = checkTimeouts(state, 32000);
      expect(timedOut).toContain('monaco-editor');
      expect(getComponentState(newState, 'monaco-editor')?.status).toBe('error');
      expect(getComponentState(newState, 'monaco-editor')?.error).toBe('Load timeout');
    });
  });
});
