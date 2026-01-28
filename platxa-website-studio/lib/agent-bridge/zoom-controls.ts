/**
 * Zoom Controls for Preview Panel
 *
 * Zoom slider with presets (25, 50, 75, 100, 150, 200%)
 * and fit-to-screen auto-zoom calculation.
 */

// =============================================================================
// Types
// =============================================================================

export interface ZoomConfig {
  /** Minimum zoom percentage */
  minZoom: number;
  /** Maximum zoom percentage */
  maxZoom: number;
  /** Zoom step for increment/decrement */
  step: number;
  /** Preset zoom levels */
  presets: number[];
  /** Padding (px) for fit-to-screen calculation */
  fitPadding: number;
}

export const DEFAULT_ZOOM_CONFIG: ZoomConfig = {
  minZoom: 25,
  maxZoom: 200,
  step: 25,
  presets: [25, 50, 75, 100, 150, 200],
  fitPadding: 40,
};

export interface ViewportDimensions {
  width: number;
  height: number;
}

export interface ZoomState {
  /** Current zoom percentage (25-200) */
  zoom: number;
  /** Config */
  config: ZoomConfig;
  /** Whether currently in fit-to-screen mode */
  fitToScreen: boolean;
  /** Panel viewport dimensions */
  panelSize: ViewportDimensions;
  /** Content dimensions */
  contentSize: ViewportDimensions;
}

// =============================================================================
// State
// =============================================================================

export function createZoomState(
  config: Partial<ZoomConfig> = {},
  panelSize: ViewportDimensions = { width: 1024, height: 768 },
  contentSize: ViewportDimensions = { width: 1440, height: 900 },
): ZoomState {
  return {
    zoom: 100,
    config: { ...DEFAULT_ZOOM_CONFIG, ...config },
    fitToScreen: false,
    panelSize,
    contentSize,
  };
}

// =============================================================================
// Zoom Operations
// =============================================================================

function clampZoom(zoom: number, config: ZoomConfig): number {
  return Math.max(config.minZoom, Math.min(config.maxZoom, zoom));
}

/** Sets zoom to an exact percentage. */
export function setZoom(state: ZoomState, zoom: number): ZoomState {
  return {
    ...state,
    zoom: clampZoom(Math.round(zoom), state.config),
    fitToScreen: false,
  };
}

/** Zooms in by one step. */
export function zoomIn(state: ZoomState): ZoomState {
  return setZoom(state, state.zoom + state.config.step);
}

/** Zooms out by one step. */
export function zoomOut(state: ZoomState): ZoomState {
  return setZoom(state, state.zoom - state.config.step);
}

/** Resets zoom to 100%. */
export function resetZoom(state: ZoomState): ZoomState {
  return setZoom(state, 100);
}

/** Sets zoom to a preset value. Returns same state if preset not found. */
export function setPreset(state: ZoomState, preset: number): ZoomState {
  if (!state.config.presets.includes(preset)) return state;
  return setZoom(state, preset);
}

/** Snaps to nearest preset. */
export function snapToPreset(state: ZoomState): ZoomState {
  const { presets } = state.config;
  let nearest = presets[0];
  let minDist = Math.abs(state.zoom - nearest);
  for (const p of presets) {
    const dist = Math.abs(state.zoom - p);
    if (dist < minDist) {
      minDist = dist;
      nearest = p;
    }
  }
  return setZoom(state, nearest);
}

// =============================================================================
// Fit to Screen
// =============================================================================

/**
 * Calculates the zoom level to fit content within the panel.
 * Accounts for padding on all sides.
 */
export function calculateFitZoom(
  panelSize: ViewportDimensions,
  contentSize: ViewportDimensions,
  padding: number,
): number {
  const availableWidth = Math.max(1, panelSize.width - padding * 2);
  const availableHeight = Math.max(1, panelSize.height - padding * 2);

  const scaleX = availableWidth / Math.max(1, contentSize.width);
  const scaleY = availableHeight / Math.max(1, contentSize.height);

  return Math.round(Math.min(scaleX, scaleY) * 100);
}

/** Activates fit-to-screen mode. */
export function fitToScreen(state: ZoomState): ZoomState {
  const fitZoom = calculateFitZoom(
    state.panelSize,
    state.contentSize,
    state.config.fitPadding,
  );
  return {
    ...state,
    zoom: clampZoom(fitZoom, state.config),
    fitToScreen: true,
  };
}

/** Updates panel size and recalculates if in fit-to-screen mode. */
export function setPanelSize(
  state: ZoomState,
  panelSize: ViewportDimensions,
): ZoomState {
  const updated = { ...state, panelSize };
  if (state.fitToScreen) {
    return fitToScreen(updated);
  }
  return updated;
}

/** Updates content size and recalculates if in fit-to-screen mode. */
export function setContentSize(
  state: ZoomState,
  contentSize: ViewportDimensions,
): ZoomState {
  const updated = { ...state, contentSize };
  if (state.fitToScreen) {
    return fitToScreen(updated);
  }
  return updated;
}

// =============================================================================
// Queries & Helpers
// =============================================================================

/** Returns zoom as a CSS scale factor (0.25-2.0). */
export function getScaleFactor(state: ZoomState): number {
  return state.zoom / 100;
}

/** Returns whether zoom-in is possible. */
export function canZoomIn(state: ZoomState): boolean {
  return state.zoom < state.config.maxZoom;
}

/** Returns whether zoom-out is possible. */
export function canZoomOut(state: ZoomState): boolean {
  return state.zoom > state.config.minZoom;
}

/** Returns the CSS transform string for the current zoom. */
export function getTransformCSS(state: ZoomState): string {
  const scale = getScaleFactor(state);
  return `transform: scale(${scale}); transform-origin: top center;`;
}

/** Returns zoom label string (e.g. "100%"). */
export function getZoomLabel(state: ZoomState): string {
  return `${state.zoom}%`;
}
