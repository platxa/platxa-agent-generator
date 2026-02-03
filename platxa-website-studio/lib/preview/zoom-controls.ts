/**
 * ZoomControls — Zoom controls for preview panel (25%-200%).
 *
 * Feature #88: Create zoom controls for preview panel (25%-200%)
 * Verification: Slider or buttons adjust preview scale; shows current percentage
 *
 * Provides zoom control functionality with slider, preset buttons, and keyboard
 * shortcuts for adjusting the preview panel scale between 25% and 200%.
 *
 * @module lib/preview/zoom-controls
 */

// =============================================================================
// Types
// =============================================================================

/** Zoom preset levels */
export type ZoomPreset = 25 | 50 | 75 | 100 | 125 | 150 | 175 | 200;

/** Zoom control mode */
export type ZoomControlMode = "slider" | "buttons" | "both";

/** Zoom change source */
export type ZoomChangeSource =
  | "slider"
  | "button"
  | "preset"
  | "keyboard"
  | "wheel"
  | "fit"
  | "api";

/** Zoom change event */
export interface ZoomChangeEvent {
  /** Previous zoom percentage */
  previousZoom: number;
  /** New zoom percentage */
  zoom: number;
  /** Scale value (zoom / 100) */
  scale: number;
  /** Source of the change */
  source: ZoomChangeSource;
  /** Timestamp */
  timestamp: number;
}

/** Zoom controls state */
export interface ZoomControlsState {
  /** Current zoom percentage (25-200) */
  zoom: number;
  /** Equivalent scale (0.25-2.0) */
  scale: number;
  /** Minimum zoom percentage */
  minZoom: number;
  /** Maximum zoom percentage */
  maxZoom: number;
  /** Zoom step for buttons */
  step: number;
  /** Whether controls are disabled */
  disabled: boolean;
  /** Control mode */
  mode: ZoomControlMode;
}

/** Zoom controls options */
export interface ZoomControlsOptions {
  /** Initial zoom percentage (default: 100) */
  initialZoom?: number;
  /** Minimum zoom percentage (default: 25) */
  minZoom?: number;
  /** Maximum zoom percentage (default: 200) */
  maxZoom?: number;
  /** Zoom step for buttons (default: 25) */
  step?: number;
  /** Control mode (default: "both") */
  mode?: ZoomControlMode;
  /** Enable keyboard shortcuts (default: true) */
  enableKeyboard?: boolean;
  /** Enable mouse wheel zoom (default: true) */
  enableWheel?: boolean;
  /** Container element for keyboard/wheel events */
  container?: HTMLElement | null;
}

/** Callback for zoom changes */
export type ZoomChangeCallback = (event: ZoomChangeEvent) => void;

/** Callback for state changes */
export type StateChangeCallback = (state: ZoomControlsState) => void;

/** Slider configuration for UI rendering */
export interface SliderConfig {
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Step value */
  step: number;
  /** Current value */
  value: number;
  /** Formatted display value */
  displayValue: string;
  /** Aria label */
  ariaLabel: string;
}

/** Button configuration for UI rendering */
export interface ButtonConfig {
  /** Button type */
  type: "zoomIn" | "zoomOut" | "reset" | "fit";
  /** Button label */
  label: string;
  /** Icon name/identifier */
  icon: string;
  /** Whether button is disabled */
  disabled: boolean;
  /** Keyboard shortcut */
  shortcut?: string;
  /** Tooltip text */
  tooltip: string;
}

/** Preset button configuration */
export interface PresetButtonConfig {
  /** Zoom percentage */
  zoom: ZoomPreset;
  /** Whether this is currently active */
  active: boolean;
  /** Display label */
  label: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Default options */
const DEFAULT_OPTIONS: Required<Omit<ZoomControlsOptions, "container">> = {
  initialZoom: 100,
  minZoom: 25,
  maxZoom: 200,
  step: 25,
  mode: "both",
  enableKeyboard: true,
  enableWheel: true,
};

/** Available zoom presets */
export const ZOOM_PRESETS: ZoomPreset[] = [25, 50, 75, 100, 125, 150, 175, 200];

/** Keyboard shortcuts */
export const KEYBOARD_SHORTCUTS: {
  zoomIn: readonly string[];
  zoomOut: readonly string[];
  reset: readonly string[];
  fit: readonly string[];
} = {
  zoomIn: ["=", "+", "NumpadAdd"],
  zoomOut: ["-", "_", "NumpadSubtract"],
  reset: ["0", "Numpad0"],
  fit: ["f", "F"],
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Clamps a value between min and max.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Rounds zoom to nearest step.
 */
function roundToStep(zoom: number, step: number): number {
  return Math.round(zoom / step) * step;
}

/**
 * Converts zoom percentage to scale.
 */
export function zoomToScale(zoom: number): number {
  return zoom / 100;
}

/**
 * Converts scale to zoom percentage.
 */
export function scaleToZoom(scale: number): number {
  return scale * 100;
}

/**
 * Formats zoom as percentage string.
 */
export function formatZoom(zoom: number): string {
  return `${Math.round(zoom)}%`;
}

/**
 * Gets the closest zoom preset to a given zoom level.
 */
export function getClosestPreset(zoom: number): ZoomPreset {
  let closest: ZoomPreset = 100;
  let minDiff = Infinity;

  for (const preset of ZOOM_PRESETS) {
    const diff = Math.abs(preset - zoom);
    if (diff < minDiff) {
      minDiff = diff;
      closest = preset;
    }
  }

  return closest;
}

/**
 * Checks if a zoom level matches a preset.
 */
export function isPreset(zoom: number): zoom is ZoomPreset {
  return ZOOM_PRESETS.includes(zoom as ZoomPreset);
}

// =============================================================================
// ZoomControls Class
// =============================================================================

/**
 * ZoomControls — Manages zoom level for preview panel.
 *
 * Provides zoom control functionality with:
 * - Slider control (25%-200%)
 * - Zoom in/out buttons
 * - Preset buttons (25%, 50%, 75%, 100%, etc.)
 * - Keyboard shortcuts (Ctrl/Cmd + +/-)
 * - Mouse wheel zoom (with Ctrl/Cmd)
 * - Fit to container
 *
 * @example
 * ```typescript
 * const zoom = new ZoomControls({
 *   initialZoom: 100,
 *   minZoom: 25,
 *   maxZoom: 200,
 *   step: 25,
 * });
 *
 * // Listen for changes
 * zoom.onChange((event) => {
 *   console.log(`Zoom: ${event.zoom}%`);
 *   applyScale(event.scale);
 * });
 *
 * // Zoom in/out
 * zoom.zoomIn();
 * zoom.zoomOut();
 *
 * // Set specific zoom
 * zoom.setZoom(150);
 *
 * // Get UI configurations
 * const slider = zoom.getSliderConfig();
 * const buttons = zoom.getButtonConfigs();
 * const presets = zoom.getPresetConfigs();
 * ```
 */
export class ZoomControls {
  private state: ZoomControlsState;
  private options: Required<Omit<ZoomControlsOptions, "container">>;
  private container: HTMLElement | null;
  private changeCallbacks = new Set<ZoomChangeCallback>();
  private stateCallbacks = new Set<StateChangeCallback>();
  private disposed = false;

  // Event handlers (bound for cleanup)
  private handleKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private handleWheel: ((e: WheelEvent) => void) | null = null;

  constructor(options: ZoomControlsOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.container = options.container ?? null;

    const initialZoom = clamp(
      this.options.initialZoom,
      this.options.minZoom,
      this.options.maxZoom
    );

    this.state = {
      zoom: initialZoom,
      scale: zoomToScale(initialZoom),
      minZoom: this.options.minZoom,
      maxZoom: this.options.maxZoom,
      step: this.options.step,
      disabled: false,
      mode: this.options.mode,
    };

    this.setupEventListeners();
  }

  // ---------------------------------------------------------------------------
  // Event Listeners
  // ---------------------------------------------------------------------------

  private setupEventListeners(): void {
    if (this.options.enableKeyboard) {
      this.handleKeyDown = this.onKeyDown.bind(this);
      const target = this.container ?? document;
      target.addEventListener("keydown", this.handleKeyDown as EventListener);
    }

    if (this.options.enableWheel && this.container) {
      this.handleWheel = this.onWheel.bind(this);
      this.container.addEventListener("wheel", this.handleWheel, { passive: false });
    }
  }

  private removeEventListeners(): void {
    if (this.handleKeyDown) {
      const target = this.container ?? document;
      target.removeEventListener("keydown", this.handleKeyDown as EventListener);
      this.handleKeyDown = null;
    }

    if (this.handleWheel && this.container) {
      this.container.removeEventListener("wheel", this.handleWheel);
      this.handleWheel = null;
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (this.state.disabled) return;

    // Require Ctrl/Cmd for zoom shortcuts (except fit)
    const hasModifier = e.ctrlKey || e.metaKey;

    if (hasModifier && KEYBOARD_SHORTCUTS.zoomIn.includes(e.key)) {
      e.preventDefault();
      this.zoomIn("keyboard");
    } else if (hasModifier && KEYBOARD_SHORTCUTS.zoomOut.includes(e.key)) {
      e.preventDefault();
      this.zoomOut("keyboard");
    } else if (hasModifier && KEYBOARD_SHORTCUTS.reset.includes(e.key)) {
      e.preventDefault();
      this.reset("keyboard");
    } else if (hasModifier && KEYBOARD_SHORTCUTS.fit.includes(e.key)) {
      e.preventDefault();
      // Fit requires container dimensions, emit event for handler
      this.notifyChange(this.state.zoom, this.state.zoom, "fit");
    }
  }

  private onWheel(e: WheelEvent): void {
    if (this.state.disabled) return;

    // Require Ctrl/Cmd for wheel zoom
    if (!e.ctrlKey && !e.metaKey) return;

    e.preventDefault();

    const delta = e.deltaY > 0 ? -this.state.step : this.state.step;
    const newZoom = clamp(
      this.state.zoom + delta,
      this.state.minZoom,
      this.state.maxZoom
    );

    if (newZoom !== this.state.zoom) {
      this.setZoomInternal(newZoom, "wheel");
    }
  }

  // ---------------------------------------------------------------------------
  // Zoom Control Methods
  // ---------------------------------------------------------------------------

  /**
   * Sets the zoom level.
   */
  setZoom(zoom: number, source: ZoomChangeSource = "api"): void {
    const clampedZoom = clamp(zoom, this.state.minZoom, this.state.maxZoom);
    this.setZoomInternal(clampedZoom, source);
  }

  /**
   * Sets the scale (converts to zoom).
   */
  setScale(scale: number, source: ZoomChangeSource = "api"): void {
    this.setZoom(scaleToZoom(scale), source);
  }

  /**
   * Zooms in by one step.
   */
  zoomIn(source: ZoomChangeSource = "button"): void {
    const newZoom = Math.min(this.state.zoom + this.state.step, this.state.maxZoom);
    this.setZoomInternal(newZoom, source);
  }

  /**
   * Zooms out by one step.
   */
  zoomOut(source: ZoomChangeSource = "button"): void {
    const newZoom = Math.max(this.state.zoom - this.state.step, this.state.minZoom);
    this.setZoomInternal(newZoom, source);
  }

  /**
   * Resets zoom to 100%.
   */
  reset(source: ZoomChangeSource = "button"): void {
    this.setZoomInternal(100, source);
  }

  /**
   * Sets zoom to a preset value.
   */
  setPreset(preset: ZoomPreset, source: ZoomChangeSource = "preset"): void {
    this.setZoomInternal(preset, source);
  }

  /**
   * Fits zoom to container dimensions.
   */
  fitToContainer(
    contentWidth: number,
    contentHeight: number,
    containerWidth: number,
    containerHeight: number,
    padding = 40
  ): void {
    const availableWidth = containerWidth - padding * 2;
    const availableHeight = containerHeight - padding * 2;

    const scaleX = availableWidth / contentWidth;
    const scaleY = availableHeight / contentHeight;
    const scale = Math.min(scaleX, scaleY);

    // Convert to zoom and clamp
    const zoom = clamp(
      roundToStep(scaleToZoom(scale), this.state.step),
      this.state.minZoom,
      this.state.maxZoom
    );

    this.setZoomInternal(zoom, "fit");
  }

  private setZoomInternal(zoom: number, source: ZoomChangeSource): void {
    if (this.disposed) return;

    const previousZoom = this.state.zoom;
    if (zoom === previousZoom) return;

    this.state.zoom = zoom;
    this.state.scale = zoomToScale(zoom);

    this.notifyChange(previousZoom, zoom, source);
    this.notifyStateChange();
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  /**
   * Gets current zoom percentage.
   */
  getZoom(): number {
    return this.state.zoom;
  }

  /**
   * Gets current scale.
   */
  getScale(): number {
    return this.state.scale;
  }

  /**
   * Gets formatted zoom string.
   */
  getZoomFormatted(): string {
    return formatZoom(this.state.zoom);
  }

  /**
   * Gets full state.
   */
  getState(): ZoomControlsState {
    return { ...this.state };
  }

  /**
   * Checks if can zoom in.
   */
  canZoomIn(): boolean {
    return this.state.zoom < this.state.maxZoom;
  }

  /**
   * Checks if can zoom out.
   */
  canZoomOut(): boolean {
    return this.state.zoom > this.state.minZoom;
  }

  // ---------------------------------------------------------------------------
  // UI Configuration Helpers
  // ---------------------------------------------------------------------------

  /**
   * Gets slider configuration for UI rendering.
   */
  getSliderConfig(): SliderConfig {
    return {
      min: this.state.minZoom,
      max: this.state.maxZoom,
      step: this.state.step,
      value: this.state.zoom,
      displayValue: this.getZoomFormatted(),
      ariaLabel: `Zoom level: ${this.getZoomFormatted()}`,
    };
  }

  /**
   * Gets button configurations for UI rendering.
   */
  getButtonConfigs(): ButtonConfig[] {
    return [
      {
        type: "zoomOut",
        label: "Zoom Out",
        icon: "minus",
        disabled: !this.canZoomOut() || this.state.disabled,
        shortcut: "Ctrl+-",
        tooltip: `Zoom out (${this.state.step}%)`,
      },
      {
        type: "zoomIn",
        label: "Zoom In",
        icon: "plus",
        disabled: !this.canZoomIn() || this.state.disabled,
        shortcut: "Ctrl++",
        tooltip: `Zoom in (${this.state.step}%)`,
      },
      {
        type: "reset",
        label: "Reset",
        icon: "refresh",
        disabled: this.state.zoom === 100 || this.state.disabled,
        shortcut: "Ctrl+0",
        tooltip: "Reset to 100%",
      },
      {
        type: "fit",
        label: "Fit",
        icon: "maximize",
        disabled: this.state.disabled,
        shortcut: "Ctrl+F",
        tooltip: "Fit to container",
      },
    ];
  }

  /**
   * Gets preset button configurations.
   */
  getPresetConfigs(): PresetButtonConfig[] {
    return ZOOM_PRESETS.map((preset) => ({
      zoom: preset,
      active: this.state.zoom === preset,
      label: formatZoom(preset),
    }));
  }

  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------

  /**
   * Enables or disables controls.
   */
  setDisabled(disabled: boolean): void {
    if (this.state.disabled !== disabled) {
      this.state.disabled = disabled;
      this.notifyStateChange();
    }
  }

  /**
   * Updates options.
   */
  setOptions(options: Partial<ZoomControlsOptions>): void {
    if (options.minZoom !== undefined) {
      this.state.minZoom = options.minZoom;
      this.options.minZoom = options.minZoom;
    }

    if (options.maxZoom !== undefined) {
      this.state.maxZoom = options.maxZoom;
      this.options.maxZoom = options.maxZoom;
    }

    if (options.step !== undefined) {
      this.state.step = options.step;
      this.options.step = options.step;
    }

    if (options.mode !== undefined) {
      this.state.mode = options.mode;
      this.options.mode = options.mode;
    }

    // Clamp current zoom if out of new bounds
    const clampedZoom = clamp(this.state.zoom, this.state.minZoom, this.state.maxZoom);
    if (clampedZoom !== this.state.zoom) {
      this.setZoomInternal(clampedZoom, "api");
    } else {
      this.notifyStateChange();
    }
  }

  // ---------------------------------------------------------------------------
  // Event Callbacks
  // ---------------------------------------------------------------------------

  /**
   * Registers a callback for zoom changes.
   */
  onChange(callback: ZoomChangeCallback): () => void {
    this.changeCallbacks.add(callback);
    return () => this.changeCallbacks.delete(callback);
  }

  /**
   * Registers a callback for state changes.
   */
  onStateChange(callback: StateChangeCallback): () => void {
    this.stateCallbacks.add(callback);
    return () => this.stateCallbacks.delete(callback);
  }

  private notifyChange(
    previousZoom: number,
    zoom: number,
    source: ZoomChangeSource
  ): void {
    const event: ZoomChangeEvent = {
      previousZoom,
      zoom,
      scale: zoomToScale(zoom),
      source,
      timestamp: Date.now(),
    };

    for (const callback of this.changeCallbacks) {
      try {
        callback(event);
      } catch (e) {
        console.error("ZoomControls change callback error:", e);
      }
    }
  }

  private notifyStateChange(): void {
    const state = this.getState();
    for (const callback of this.stateCallbacks) {
      try {
        callback(state);
      } catch (e) {
        console.error("ZoomControls state callback error:", e);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Disposes the instance and removes event listeners.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.removeEventListeners();
    this.changeCallbacks.clear();
    this.stateCallbacks.clear();
  }
}

// =============================================================================
// Iframe Script
// =============================================================================

/**
 * Script to inject into iframe for wheel zoom support.
 */
export const ZOOM_CONTROLS_SCRIPT = `
(function() {
  if (window.__PLATXA_ZOOM_CONTROLS__) return;
  window.__PLATXA_ZOOM_CONTROLS__ = true;

  // Listen for wheel events with Ctrl/Cmd
  document.addEventListener('wheel', function(e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      window.parent.postMessage({
        type: 'PLATXA_ZOOM_WHEEL',
        deltaY: e.deltaY,
        clientX: e.clientX,
        clientY: e.clientY,
      }, '*');
    }
  }, { passive: false });

  // Listen for keyboard zoom shortcuts
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '_', '0'].includes(e.key)) {
      e.preventDefault();
      window.parent.postMessage({
        type: 'PLATXA_ZOOM_KEYBOARD',
        key: e.key,
      }, '*');
    }
  });
})();
`;

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates a ZoomControls instance.
 */
export function createZoomControls(options?: ZoomControlsOptions): ZoomControls {
  return new ZoomControls(options);
}

// =============================================================================
// Export
// =============================================================================

export default ZoomControls;
