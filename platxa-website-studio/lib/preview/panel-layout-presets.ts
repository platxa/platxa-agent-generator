/**
 * Panel Layout Presets
 *
 * Feature #122: Add panel layout presets (code-focused, preview-focused, balanced)
 * Verification: Preset buttons instantly resize panels to predefined ratios
 */

// ============================================================================
// Types
// ============================================================================

/** Preset name identifier */
export type PresetName =
  | "code-focused"
  | "preview-focused"
  | "balanced"
  | "code-only"
  | "preview-only"
  | "minimal-code"
  | "minimal-preview";

/** Panel identifier in the layout */
export type PanelId = "code" | "preview" | "sidebar" | "console" | "files";

/** Panel ratio (0-1 representing percentage of available space) */
export type PanelRatio = number;

/** Panel visibility state */
export type PanelVisibility = "visible" | "hidden" | "collapsed";

/** Layout orientation */
export type LayoutOrientation = "horizontal" | "vertical";

/** Transition style for preset changes */
export type TransitionStyle = "instant" | "smooth" | "spring";

/** Individual panel configuration */
export interface PanelConfig {
  /** Panel identifier */
  id: PanelId;
  /** Ratio of available space (0-1) */
  ratio: PanelRatio;
  /** Minimum size in pixels */
  minSize?: number;
  /** Maximum size in pixels */
  maxSize?: number;
  /** Visibility state */
  visibility: PanelVisibility;
  /** Whether panel can be resized */
  resizable?: boolean;
}

/** Complete layout preset definition */
export interface LayoutPreset {
  /** Preset name */
  name: PresetName;
  /** Human-readable label */
  label: string;
  /** Description of the preset */
  description: string;
  /** Keyboard shortcut (e.g., "Ctrl+1") */
  shortcut?: string;
  /** Icon identifier */
  icon?: string;
  /** Panel configurations */
  panels: PanelConfig[];
  /** Layout orientation */
  orientation: LayoutOrientation;
}

/** Current layout state */
export interface LayoutState {
  /** Active preset name (null if custom) */
  activePreset: PresetName | null;
  /** Current panel configurations */
  panels: Map<PanelId, PanelConfig>;
  /** Layout orientation */
  orientation: LayoutOrientation;
  /** Whether layout is transitioning */
  isTransitioning: boolean;
  /** Previous preset (for undo) */
  previousPreset: PresetName | null;
}

/** Transition options */
export interface TransitionOptions {
  /** Transition style */
  style: TransitionStyle;
  /** Duration in ms (for smooth/spring) */
  duration?: number;
  /** Callback when transition completes */
  onComplete?: () => void;
}

/** Preset change event */
export interface PresetChangeEvent {
  /** Previous preset */
  from: PresetName | null;
  /** New preset */
  to: PresetName;
  /** Transition options used */
  transition: TransitionOptions;
  /** Timestamp */
  timestamp: number;
}

/** Panel resize event */
export interface PanelResizeEvent {
  /** Panel that was resized */
  panelId: PanelId;
  /** Previous ratio */
  previousRatio: PanelRatio;
  /** New ratio */
  newRatio: PanelRatio;
  /** Whether resize was from preset or manual */
  source: "preset" | "manual";
}

/** Preset change callback */
export type PresetChangeCallback = (event: PresetChangeEvent) => void;

/** Panel resize callback */
export type PanelResizeCallback = (event: PanelResizeEvent) => void;

/** State change callback */
export type StateChangeCallback = (state: LayoutState) => void;

/** Panel layout presets options */
export interface PanelLayoutPresetsOptions {
  /** Initial preset */
  initialPreset?: PresetName;
  /** Default transition style */
  defaultTransition?: TransitionStyle;
  /** Default transition duration */
  defaultDuration?: number;
  /** Custom presets to add */
  customPresets?: LayoutPreset[];
  /** Whether to persist preference */
  persist?: boolean;
  /** Storage key for persistence */
  storageKey?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Default panel minimum sizes */
export const DEFAULT_MIN_SIZES: Record<PanelId, number> = {
  code: 200,
  preview: 200,
  sidebar: 150,
  console: 100,
  files: 150,
};

/** Default panel maximum sizes */
export const DEFAULT_MAX_SIZES: Record<PanelId, number> = {
  code: 2000,
  preview: 2000,
  sidebar: 400,
  console: 500,
  files: 400,
};

/** Built-in layout presets */
export const LAYOUT_PRESETS: Record<PresetName, LayoutPreset> = {
  "code-focused": {
    name: "code-focused",
    label: "Code Focused",
    description: "Maximize code editor with minimal preview",
    shortcut: "Ctrl+1",
    icon: "code",
    orientation: "horizontal",
    panels: [
      { id: "code", ratio: 0.7, visibility: "visible", resizable: true },
      { id: "preview", ratio: 0.3, visibility: "visible", resizable: true },
    ],
  },
  "preview-focused": {
    name: "preview-focused",
    label: "Preview Focused",
    description: "Maximize preview with minimal code editor",
    shortcut: "Ctrl+2",
    icon: "eye",
    orientation: "horizontal",
    panels: [
      { id: "code", ratio: 0.3, visibility: "visible", resizable: true },
      { id: "preview", ratio: 0.7, visibility: "visible", resizable: true },
    ],
  },
  balanced: {
    name: "balanced",
    label: "Balanced",
    description: "Equal space for code and preview",
    shortcut: "Ctrl+3",
    icon: "columns",
    orientation: "horizontal",
    panels: [
      { id: "code", ratio: 0.5, visibility: "visible", resizable: true },
      { id: "preview", ratio: 0.5, visibility: "visible", resizable: true },
    ],
  },
  "code-only": {
    name: "code-only",
    label: "Code Only",
    description: "Full screen code editor",
    shortcut: "Ctrl+4",
    icon: "maximize",
    orientation: "horizontal",
    panels: [
      { id: "code", ratio: 1.0, visibility: "visible", resizable: false },
      { id: "preview", ratio: 0, visibility: "hidden", resizable: false },
    ],
  },
  "preview-only": {
    name: "preview-only",
    label: "Preview Only",
    description: "Full screen preview",
    shortcut: "Ctrl+5",
    icon: "monitor",
    orientation: "horizontal",
    panels: [
      { id: "code", ratio: 0, visibility: "hidden", resizable: false },
      { id: "preview", ratio: 1.0, visibility: "visible", resizable: false },
    ],
  },
  "minimal-code": {
    name: "minimal-code",
    label: "Minimal Code",
    description: "Small code panel, large preview",
    shortcut: "Ctrl+6",
    icon: "sidebar",
    orientation: "horizontal",
    panels: [
      { id: "code", ratio: 0.2, visibility: "visible", resizable: true },
      { id: "preview", ratio: 0.8, visibility: "visible", resizable: true },
    ],
  },
  "minimal-preview": {
    name: "minimal-preview",
    label: "Minimal Preview",
    description: "Large code panel, small preview",
    shortcut: "Ctrl+7",
    icon: "sidebar-right",
    orientation: "horizontal",
    panels: [
      { id: "code", ratio: 0.8, visibility: "visible", resizable: true },
      { id: "preview", ratio: 0.2, visibility: "visible", resizable: true },
    ],
  },
};

/** Preset keyboard shortcuts */
export const PRESET_SHORTCUTS: Record<PresetName, string> = {
  "code-focused": "Ctrl+1",
  "preview-focused": "Ctrl+2",
  balanced: "Ctrl+3",
  "code-only": "Ctrl+4",
  "preview-only": "Ctrl+5",
  "minimal-code": "Ctrl+6",
  "minimal-preview": "Ctrl+7",
};

/** Default transition options */
export const DEFAULT_TRANSITION: TransitionOptions = {
  style: "instant",
  duration: 0,
};

/** Smooth transition options */
export const SMOOTH_TRANSITION: TransitionOptions = {
  style: "smooth",
  duration: 300,
};

/** Spring transition options */
export const SPRING_TRANSITION: TransitionOptions = {
  style: "spring",
  duration: 400,
};

/** Storage key for preset persistence */
export const STORAGE_KEY = "platxa-panel-layout-preset";

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get a preset by name
 */
export function getPreset(name: PresetName): LayoutPreset {
  return LAYOUT_PRESETS[name];
}

/**
 * Get all preset names
 */
export function getAllPresetNames(): PresetName[] {
  return Object.keys(LAYOUT_PRESETS) as PresetName[];
}

/**
 * Get all presets as array
 */
export function getAllPresets(): LayoutPreset[] {
  return Object.values(LAYOUT_PRESETS);
}

/**
 * Find preset by shortcut
 */
export function findPresetByShortcut(shortcut: string): LayoutPreset | undefined {
  return Object.values(LAYOUT_PRESETS).find((p) => p.shortcut === shortcut);
}

/**
 * Get panel ratio from preset
 */
export function getPanelRatio(preset: LayoutPreset, panelId: PanelId): PanelRatio {
  const panel = preset.panels.find((p) => p.id === panelId);
  return panel?.ratio ?? 0;
}

/**
 * Check if panel is visible in preset
 */
export function isPanelVisible(preset: LayoutPreset, panelId: PanelId): boolean {
  const panel = preset.panels.find((p) => p.id === panelId);
  return panel?.visibility === "visible";
}

/**
 * Validate panel ratios sum to 1 (or close enough)
 */
export function validateRatios(panels: PanelConfig[]): boolean {
  const visiblePanels = panels.filter((p) => p.visibility === "visible");
  const sum = visiblePanels.reduce((acc, p) => acc + p.ratio, 0);
  return Math.abs(sum - 1) < 0.01; // Allow small floating point errors
}

/**
 * Normalize ratios to sum to 1
 */
export function normalizeRatios(panels: PanelConfig[]): PanelConfig[] {
  const visiblePanels = panels.filter((p) => p.visibility === "visible");
  const sum = visiblePanels.reduce((acc, p) => acc + p.ratio, 0);

  if (sum === 0) return panels;

  return panels.map((p) => ({
    ...p,
    ratio: p.visibility === "visible" ? p.ratio / sum : 0,
  }));
}

/**
 * Calculate pixel sizes from ratios
 */
export function calculatePixelSizes(
  panels: PanelConfig[],
  availableSpace: number
): Map<PanelId, number> {
  const sizes = new Map<PanelId, number>();

  for (const panel of panels) {
    if (panel.visibility === "visible") {
      let size = Math.round(availableSpace * panel.ratio);

      // Apply min/max constraints
      if (panel.minSize !== undefined) {
        size = Math.max(size, panel.minSize);
      }
      if (panel.maxSize !== undefined) {
        size = Math.min(size, panel.maxSize);
      }

      sizes.set(panel.id, size);
    } else {
      sizes.set(panel.id, 0);
    }
  }

  return sizes;
}

/**
 * Generate CSS for panel sizes
 */
export function generatePanelCSS(
  panels: PanelConfig[],
  orientation: LayoutOrientation
): Map<PanelId, string> {
  const css = new Map<PanelId, string>();
  const property = orientation === "horizontal" ? "width" : "height";

  for (const panel of panels) {
    if (panel.visibility === "visible") {
      css.set(panel.id, `${property}: ${(panel.ratio * 100).toFixed(2)}%`);
    } else if (panel.visibility === "hidden") {
      css.set(panel.id, `${property}: 0; display: none`);
    } else {
      css.set(panel.id, `${property}: 0; overflow: hidden`);
    }
  }

  return css;
}

/**
 * Create transition CSS
 */
export function createTransitionCSS(
  options: TransitionOptions,
  orientation: LayoutOrientation
): string {
  if (options.style === "instant") {
    return "none";
  }

  const property = orientation === "horizontal" ? "width" : "height";
  const duration = options.duration ?? 300;

  if (options.style === "smooth") {
    return `${property} ${duration}ms ease-out`;
  }

  if (options.style === "spring") {
    return `${property} ${duration}ms cubic-bezier(0.68, -0.55, 0.265, 1.55)`;
  }

  return "none";
}

/**
 * Load preset from storage
 */
export function loadPersistedPreset(key: string = STORAGE_KEY): PresetName | null {
  if (typeof localStorage === "undefined") return null;

  try {
    const stored = localStorage.getItem(key);
    if (stored && stored in LAYOUT_PRESETS) {
      return stored as PresetName;
    }
  } catch {
    // Storage access may fail
  }

  return null;
}

/**
 * Save preset to storage
 */
export function persistPreset(preset: PresetName, key: string = STORAGE_KEY): boolean {
  if (typeof localStorage === "undefined") return false;

  try {
    localStorage.setItem(key, preset);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear persisted preset
 */
export function clearPersistedPreset(key: string = STORAGE_KEY): boolean {
  if (typeof localStorage === "undefined") return false;

  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// PanelLayoutPresets Class
// ============================================================================

/**
 * Panel layout presets manager
 */
export class PanelLayoutPresets {
  private state: LayoutState;
  private presets: Map<PresetName, LayoutPreset>;
  private defaultTransition: TransitionOptions;
  private persist: boolean;
  private storageKey: string;
  private presetChangeCallbacks: Set<PresetChangeCallback> = new Set();
  private resizeCallbacks: Set<PanelResizeCallback> = new Set();
  private stateChangeCallbacks: Set<StateChangeCallback> = new Set();
  private disposed = false;

  constructor(options: PanelLayoutPresetsOptions = {}) {
    // Initialize presets map with built-in presets
    this.presets = new Map(
      Object.entries(LAYOUT_PRESETS) as [PresetName, LayoutPreset][]
    );

    // Add custom presets
    if (options.customPresets) {
      for (const preset of options.customPresets) {
        this.presets.set(preset.name, preset);
      }
    }

    // Set options
    this.defaultTransition = {
      style: options.defaultTransition ?? "instant",
      duration: options.defaultDuration ?? 0,
    };
    this.persist = options.persist ?? false;
    this.storageKey = options.storageKey ?? STORAGE_KEY;

    // Determine initial preset
    let initialPreset: PresetName = options.initialPreset ?? "balanced";

    // Try to load from storage if persistence is enabled
    if (this.persist) {
      const stored = loadPersistedPreset(this.storageKey);
      if (stored) {
        initialPreset = stored;
      }
    }

    // Initialize state
    const preset = this.presets.get(initialPreset) ?? LAYOUT_PRESETS.balanced;
    this.state = {
      activePreset: initialPreset,
      panels: new Map(preset.panels.map((p) => [p.id, { ...p }])),
      orientation: preset.orientation,
      isTransitioning: false,
      previousPreset: null,
    };
  }

  /**
   * Get current state
   */
  getState(): LayoutState {
    return {
      ...this.state,
      panels: new Map(this.state.panels),
    };
  }

  /**
   * Get active preset
   */
  getActivePreset(): PresetName | null {
    return this.state.activePreset;
  }

  /**
   * Get a preset definition
   */
  getPreset(name: PresetName): LayoutPreset | undefined {
    return this.presets.get(name);
  }

  /**
   * Get all available presets
   */
  getAllPresets(): LayoutPreset[] {
    return Array.from(this.presets.values());
  }

  /**
   * Get panel configuration
   */
  getPanel(id: PanelId): PanelConfig | undefined {
    return this.state.panels.get(id);
  }

  /**
   * Get all panel configurations
   */
  getAllPanels(): PanelConfig[] {
    return Array.from(this.state.panels.values());
  }

  /**
   * Apply a preset
   */
  applyPreset(
    name: PresetName,
    transitionOptions?: Partial<TransitionOptions>
  ): boolean {
    if (this.disposed) {
      throw new Error("PanelLayoutPresets is disposed");
    }

    const preset = this.presets.get(name);
    if (!preset) return false;

    const transition: TransitionOptions = {
      ...this.defaultTransition,
      ...transitionOptions,
    };

    // Store previous preset for undo
    const previousPreset = this.state.activePreset;

    // Track resize events
    const resizeEvents: PanelResizeEvent[] = [];
    for (const panelConfig of preset.panels) {
      const currentPanel = this.state.panels.get(panelConfig.id);
      if (currentPanel && currentPanel.ratio !== panelConfig.ratio) {
        resizeEvents.push({
          panelId: panelConfig.id,
          previousRatio: currentPanel.ratio,
          newRatio: panelConfig.ratio,
          source: "preset",
        });
      }
    }

    // Update state
    this.state.activePreset = name;
    this.state.previousPreset = previousPreset;
    this.state.orientation = preset.orientation;
    this.state.panels = new Map(preset.panels.map((p) => [p.id, { ...p }]));

    // Handle transition
    if (transition.style !== "instant" && transition.duration && transition.duration > 0) {
      this.state.isTransitioning = true;
      setTimeout(() => {
        this.state.isTransitioning = false;
        this.notifyStateChange();
        transition.onComplete?.();
      }, transition.duration);
    } else {
      transition.onComplete?.();
    }

    // Persist if enabled
    if (this.persist) {
      persistPreset(name, this.storageKey);
    }

    // Notify callbacks
    this.notifyPresetChange({
      from: previousPreset,
      to: name,
      transition,
      timestamp: Date.now(),
    });

    for (const event of resizeEvents) {
      this.notifyResize(event);
    }

    this.notifyStateChange();

    return true;
  }

  /**
   * Revert to previous preset
   */
  revertToPrevious(transitionOptions?: Partial<TransitionOptions>): boolean {
    if (!this.state.previousPreset) return false;
    return this.applyPreset(this.state.previousPreset, transitionOptions);
  }

  /**
   * Resize a specific panel
   */
  resizePanel(id: PanelId, newRatio: PanelRatio): boolean {
    if (this.disposed) {
      throw new Error("PanelLayoutPresets is disposed");
    }

    const panel = this.state.panels.get(id);
    if (!panel) return false;

    // Clamp ratio
    const clampedRatio = Math.max(0, Math.min(1, newRatio));
    const previousRatio = panel.ratio;

    if (previousRatio === clampedRatio) return false;

    // Update panel
    panel.ratio = clampedRatio;

    // Mark as custom layout (no longer a preset)
    this.state.activePreset = null;

    // Notify callbacks
    this.notifyResize({
      panelId: id,
      previousRatio,
      newRatio: clampedRatio,
      source: "manual",
    });

    this.notifyStateChange();

    return true;
  }

  /**
   * Toggle panel visibility
   */
  togglePanel(id: PanelId): boolean {
    if (this.disposed) {
      throw new Error("PanelLayoutPresets is disposed");
    }

    const panel = this.state.panels.get(id);
    if (!panel) return false;

    panel.visibility = panel.visibility === "visible" ? "hidden" : "visible";

    // Mark as custom layout
    this.state.activePreset = null;

    this.notifyStateChange();

    return true;
  }

  /**
   * Set panel visibility
   */
  setPanelVisibility(id: PanelId, visibility: PanelVisibility): boolean {
    if (this.disposed) {
      throw new Error("PanelLayoutPresets is disposed");
    }

    const panel = this.state.panels.get(id);
    if (!panel) return false;

    if (panel.visibility === visibility) return false;

    panel.visibility = visibility;

    // Mark as custom layout
    this.state.activePreset = null;

    this.notifyStateChange();

    return true;
  }

  /**
   * Add a custom preset
   */
  addPreset(preset: LayoutPreset): boolean {
    if (this.disposed) {
      throw new Error("PanelLayoutPresets is disposed");
    }

    // Validate ratios
    if (!validateRatios(preset.panels)) {
      const normalized = normalizeRatios(preset.panels);
      preset = { ...preset, panels: normalized };
    }

    this.presets.set(preset.name, preset);
    return true;
  }

  /**
   * Remove a custom preset
   */
  removePreset(name: PresetName): boolean {
    // Don't allow removing built-in presets
    if (name in LAYOUT_PRESETS) return false;

    return this.presets.delete(name);
  }

  /**
   * Get CSS for current layout
   */
  getLayoutCSS(): Map<PanelId, string> {
    return generatePanelCSS(this.getAllPanels(), this.state.orientation);
  }

  /**
   * Get transition CSS
   */
  getTransitionCSS(options?: Partial<TransitionOptions>): string {
    const transition = { ...this.defaultTransition, ...options };
    return createTransitionCSS(transition, this.state.orientation);
  }

  /**
   * Check if layout matches a preset
   */
  matchesPreset(name: PresetName): boolean {
    const preset = this.presets.get(name);
    if (!preset) return false;

    for (const presetPanel of preset.panels) {
      const currentPanel = this.state.panels.get(presetPanel.id);
      if (!currentPanel) return false;
      if (Math.abs(currentPanel.ratio - presetPanel.ratio) > 0.01) return false;
      if (currentPanel.visibility !== presetPanel.visibility) return false;
    }

    return true;
  }

  /**
   * Find matching preset for current layout
   */
  findMatchingPreset(): PresetName | null {
    for (const [name] of this.presets) {
      if (this.matchesPreset(name)) {
        return name;
      }
    }
    return null;
  }

  /**
   * Subscribe to preset changes
   */
  onPresetChange(callback: PresetChangeCallback): () => void {
    if (this.disposed) {
      throw new Error("PanelLayoutPresets is disposed");
    }

    this.presetChangeCallbacks.add(callback);
    return () => {
      this.presetChangeCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to panel resize
   */
  onResize(callback: PanelResizeCallback): () => void {
    if (this.disposed) {
      throw new Error("PanelLayoutPresets is disposed");
    }

    this.resizeCallbacks.add(callback);
    return () => {
      this.resizeCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(callback: StateChangeCallback): () => void {
    if (this.disposed) {
      throw new Error("PanelLayoutPresets is disposed");
    }

    this.stateChangeCallbacks.add(callback);
    return () => {
      this.stateChangeCallbacks.delete(callback);
    };
  }

  /**
   * Notify preset change
   */
  private notifyPresetChange(event: PresetChangeEvent): void {
    for (const callback of this.presetChangeCallbacks) {
      try {
        callback(event);
      } catch (err) {
        console.error("PanelLayoutPresets preset change callback error:", err);
      }
    }
  }

  /**
   * Notify resize
   */
  private notifyResize(event: PanelResizeEvent): void {
    for (const callback of this.resizeCallbacks) {
      try {
        callback(event);
      } catch (err) {
        console.error("PanelLayoutPresets resize callback error:", err);
      }
    }
  }

  /**
   * Notify state change
   */
  private notifyStateChange(): void {
    const state = this.getState();
    for (const callback of this.stateChangeCallbacks) {
      try {
        callback(state);
      } catch (err) {
        console.error("PanelLayoutPresets state change callback error:", err);
      }
    }
  }

  /**
   * Check if disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose
   */
  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.presetChangeCallbacks.clear();
    this.resizeCallbacks.clear();
    this.stateChangeCallbacks.clear();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new PanelLayoutPresets instance
 */
export function createPanelLayoutPresets(
  options?: PanelLayoutPresetsOptions
): PanelLayoutPresets {
  return new PanelLayoutPresets(options);
}

// ============================================================================
// Preset Button Helpers
// ============================================================================

/** Button configuration for preset */
export interface PresetButtonConfig {
  /** Preset name */
  name: PresetName;
  /** Button label */
  label: string;
  /** Button tooltip */
  tooltip: string;
  /** Keyboard shortcut */
  shortcut: string;
  /** Icon name */
  icon: string;
  /** Is currently active */
  isActive: boolean;
}

/**
 * Generate button configs for all presets
 */
export function generatePresetButtons(
  activePreset: PresetName | null
): PresetButtonConfig[] {
  return getAllPresets().map((preset) => ({
    name: preset.name,
    label: preset.label,
    tooltip: preset.description,
    shortcut: preset.shortcut ?? "",
    icon: preset.icon ?? "layout",
    isActive: preset.name === activePreset,
  }));
}

/**
 * Generate HTML for preset buttons
 */
export function generatePresetButtonsHTML(
  activePreset: PresetName | null,
  className: string = "preset-btn"
): string {
  const buttons = generatePresetButtons(activePreset);

  return buttons
    .map(
      (btn) => `
    <button
      class="${className}${btn.isActive ? " active" : ""}"
      data-preset="${btn.name}"
      title="${btn.tooltip}${btn.shortcut ? ` (${btn.shortcut})` : ""}"
      aria-pressed="${btn.isActive}"
    >
      <span class="icon">${btn.icon}</span>
      <span class="label">${btn.label}</span>
    </button>
  `
    )
    .join("");
}
