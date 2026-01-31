/**
 * Fit-to-Screen Auto-Zoom
 *
 * Calculates optimal zoom level to fill panel without scrolling.
 * Supports various fit modes and maintains aspect ratio.
 */

// ============================================================================
// Types
// ============================================================================

export interface Dimensions {
  readonly width: number;
  readonly height: number;
}

export interface FitToScreenState {
  readonly zoom: number;
  readonly fitMode: FitMode;
  readonly panelDimensions: Dimensions;
  readonly contentDimensions: Dimensions;
  readonly padding: number;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly zoomStep: number;
}

export type FitMode = 'fit' | 'fill' | 'width' | 'height' | 'actual';

export interface ZoomChangeEvent {
  readonly previousZoom: number;
  readonly newZoom: number;
  readonly fitMode: FitMode;
  readonly isAutoFit: boolean;
}

export type ZoomChangeHandler = (event: ZoomChangeEvent) => void;

export interface FitCalculationResult {
  readonly zoom: number;
  readonly scaledWidth: number;
  readonly scaledHeight: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly hasOverflow: boolean;
}

export interface ZoomPreset {
  readonly name: string;
  readonly zoom: number;
  readonly label: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_ZOOM_PRESETS: readonly ZoomPreset[] = [
  { name: '25%', zoom: 0.25, label: '25%' },
  { name: '50%', zoom: 0.5, label: '50%' },
  { name: '75%', zoom: 0.75, label: '75%' },
  { name: '100%', zoom: 1, label: '100%' },
  { name: '125%', zoom: 1.25, label: '125%' },
  { name: '150%', zoom: 1.5, label: '150%' },
  { name: '200%', zoom: 2, label: '200%' },
];

const DEFAULT_MIN_ZOOM = 0.1;
const DEFAULT_MAX_ZOOM = 5;
const DEFAULT_ZOOM_STEP = 0.1;
const DEFAULT_PADDING = 16;

// ============================================================================
// State
// ============================================================================

let state: FitToScreenState = {
  zoom: 1,
  fitMode: 'fit',
  panelDimensions: { width: 800, height: 600 },
  contentDimensions: { width: 1920, height: 1080 },
  padding: DEFAULT_PADDING,
  minZoom: DEFAULT_MIN_ZOOM,
  maxZoom: DEFAULT_MAX_ZOOM,
  zoomStep: DEFAULT_ZOOM_STEP,
};

let changeHandlers: ZoomChangeHandler[] = [];

// ============================================================================
// Core Functions
// ============================================================================

export function getZoom(): number {
  return state.zoom;
}

export function setZoom(zoom: number, isAutoFit: boolean = false): number {
  const previousZoom = state.zoom;
  const clampedZoom = clampZoom(zoom);

  if (clampedZoom === previousZoom) {
    return clampedZoom;
  }

  state = {
    ...state,
    zoom: clampedZoom,
  };

  notifyChange({
    previousZoom,
    newZoom: clampedZoom,
    fitMode: state.fitMode,
    isAutoFit,
  });

  return clampedZoom;
}

export function zoomIn(): number {
  return setZoom(state.zoom + state.zoomStep);
}

export function zoomOut(): number {
  return setZoom(state.zoom - state.zoomStep);
}

export function resetZoom(): number {
  return setZoom(1);
}

// ============================================================================
// Fit-to-Screen Calculation
// ============================================================================

export function fitToScreen(): FitCalculationResult {
  const result = calculateFit(state.fitMode);
  setZoom(result.zoom, true);
  return result;
}

export function calculateFit(mode: FitMode = state.fitMode): FitCalculationResult {
  const availableWidth = state.panelDimensions.width - (state.padding * 2);
  const availableHeight = state.panelDimensions.height - (state.padding * 2);
  const contentWidth = state.contentDimensions.width;
  const contentHeight = state.contentDimensions.height;

  let zoom: number;

  switch (mode) {
    case 'fit':
      // Fit entire content within panel (may have letterboxing)
      zoom = Math.min(
        availableWidth / contentWidth,
        availableHeight / contentHeight
      );
      break;

    case 'fill':
      // Fill panel completely (may crop content)
      zoom = Math.max(
        availableWidth / contentWidth,
        availableHeight / contentHeight
      );
      break;

    case 'width':
      // Fit to width only
      zoom = availableWidth / contentWidth;
      break;

    case 'height':
      // Fit to height only
      zoom = availableHeight / contentHeight;
      break;

    case 'actual':
      // 100% zoom (actual size)
      zoom = 1;
      break;

    default:
      zoom = 1;
  }

  // Clamp zoom to valid range
  zoom = clampZoom(zoom);

  const scaledWidth = contentWidth * zoom;
  const scaledHeight = contentHeight * zoom;

  // Calculate centering offset
  const offsetX = Math.max(0, (state.panelDimensions.width - scaledWidth) / 2);
  const offsetY = Math.max(0, (state.panelDimensions.height - scaledHeight) / 2);

  // Check if there's overflow
  const hasOverflow = scaledWidth > state.panelDimensions.width ||
                      scaledHeight > state.panelDimensions.height;

  return {
    zoom,
    scaledWidth,
    scaledHeight,
    offsetX,
    offsetY,
    hasOverflow,
  };
}

export function calculateOptimalZoom(): number {
  return calculateFit('fit').zoom;
}

// ============================================================================
// Fit Mode
// ============================================================================

export function getFitMode(): FitMode {
  return state.fitMode;
}

export function setFitMode(mode: FitMode): FitCalculationResult {
  state = {
    ...state,
    fitMode: mode,
  };

  return fitToScreen();
}

export function cycleFitMode(): FitMode {
  const modes: FitMode[] = ['fit', 'fill', 'width', 'height', 'actual'];
  const currentIndex = modes.indexOf(state.fitMode);
  const nextIndex = (currentIndex + 1) % modes.length;
  const nextMode = modes[nextIndex];

  setFitMode(nextMode);
  return nextMode;
}

// ============================================================================
// Dimensions
// ============================================================================

export function setPanelDimensions(dimensions: Dimensions): FitCalculationResult {
  state = {
    ...state,
    panelDimensions: dimensions,
  };

  // Recalculate fit when panel size changes
  return calculateFit();
}

export function setContentDimensions(dimensions: Dimensions): FitCalculationResult {
  state = {
    ...state,
    contentDimensions: dimensions,
  };

  // Recalculate fit when content size changes
  return calculateFit();
}

export function getPanelDimensions(): Dimensions {
  return state.panelDimensions;
}

export function getContentDimensions(): Dimensions {
  return state.contentDimensions;
}

// ============================================================================
// Configuration
// ============================================================================

export function setPadding(padding: number): void {
  state = {
    ...state,
    padding: Math.max(0, padding),
  };
}

export function getPadding(): number {
  return state.padding;
}

export function setZoomLimits(min: number, max: number): void {
  state = {
    ...state,
    minZoom: Math.max(0.01, min),
    maxZoom: Math.max(min, max),
  };

  // Re-clamp current zoom
  const clampedZoom = clampZoom(state.zoom);
  if (clampedZoom !== state.zoom) {
    setZoom(clampedZoom);
  }
}

export function getZoomLimits(): { min: number; max: number } {
  return { min: state.minZoom, max: state.maxZoom };
}

export function setZoomStep(step: number): void {
  state = {
    ...state,
    zoomStep: Math.max(0.01, step),
  };
}

export function getZoomStep(): number {
  return state.zoomStep;
}

// ============================================================================
// Zoom Presets
// ============================================================================

export function getZoomPresets(): readonly ZoomPreset[] {
  return DEFAULT_ZOOM_PRESETS;
}

export function applyZoomPreset(presetName: string): number | null {
  const preset = DEFAULT_ZOOM_PRESETS.find(p => p.name === presetName);
  if (!preset) {
    return null;
  }

  return setZoom(preset.zoom);
}

export function findNearestPreset(): ZoomPreset | null {
  let nearest: ZoomPreset | null = null;
  let minDiff = Infinity;

  for (const preset of DEFAULT_ZOOM_PRESETS) {
    const diff = Math.abs(preset.zoom - state.zoom);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = preset;
    }
  }

  return nearest;
}

// ============================================================================
// Button State
// ============================================================================

export interface FitButtonState {
  readonly zoom: number;
  readonly zoomPercent: string;
  readonly fitMode: FitMode;
  readonly canZoomIn: boolean;
  readonly canZoomOut: boolean;
  readonly isActualSize: boolean;
  readonly isFitted: boolean;
  readonly label: string;
  readonly ariaLabel: string;
}

export function getFitButtonState(): FitButtonState {
  const zoomPercent = `${Math.round(state.zoom * 100)}%`;
  const optimalZoom = calculateOptimalZoom();
  const isFitted = Math.abs(state.zoom - optimalZoom) < 0.01;

  return {
    zoom: state.zoom,
    zoomPercent,
    fitMode: state.fitMode,
    canZoomIn: state.zoom < state.maxZoom,
    canZoomOut: state.zoom > state.minZoom,
    isActualSize: Math.abs(state.zoom - 1) < 0.01,
    isFitted,
    label: isFitted ? 'Fitted' : 'Fit',
    ariaLabel: `Fit to screen (current: ${zoomPercent})`,
  };
}

export function handleFitButtonClick(): FitCalculationResult {
  return fitToScreen();
}

// ============================================================================
// CSS Helpers
// ============================================================================

export function getTransformStyle(): Record<string, string> {
  return {
    transform: `scale(${state.zoom})`,
    transformOrigin: 'top left',
  };
}

export function getContainerStyle(): Record<string, string> {
  const result = calculateFit();

  return {
    width: `${result.scaledWidth}px`,
    height: `${result.scaledHeight}px`,
    marginLeft: `${result.offsetX}px`,
    marginTop: `${result.offsetY}px`,
  };
}

export function getScrollContainerStyle(): Record<string, string> {
  const result = calculateFit();

  return {
    overflow: result.hasOverflow ? 'auto' : 'hidden',
    width: `${state.panelDimensions.width}px`,
    height: `${state.panelDimensions.height}px`,
  };
}

// ============================================================================
// Change Handlers
// ============================================================================

export function onChange(handler: ZoomChangeHandler): () => void {
  changeHandlers.push(handler);

  return () => {
    changeHandlers = changeHandlers.filter(h => h !== handler);
  };
}

function notifyChange(event: ZoomChangeEvent): void {
  for (const handler of changeHandlers) {
    handler(event);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function clampZoom(zoom: number): number {
  return Math.max(state.minZoom, Math.min(state.maxZoom, zoom));
}

export function formatZoom(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

export function parseZoom(zoomString: string): number | null {
  const match = zoomString.match(/^(\d+(?:\.\d+)?)\s*%?$/);
  if (!match) {
    return null;
  }

  const value = parseFloat(match[1]);
  if (zoomString.includes('%')) {
    return value / 100;
  }
  return value;
}

export function isZoomValid(zoom: number): boolean {
  return zoom >= state.minZoom && zoom <= state.maxZoom;
}

// ============================================================================
// State Inspection
// ============================================================================

export function getState(): FitToScreenState {
  return { ...state };
}

export function willFitWithoutScrolling(): boolean {
  const result = calculateFit('fit');
  return !result.hasOverflow;
}

export function getScaleFactor(): number {
  return state.zoom;
}

// ============================================================================
// Reset
// ============================================================================

export function resetFitToScreen(): void {
  state = {
    zoom: 1,
    fitMode: 'fit',
    panelDimensions: { width: 800, height: 600 },
    contentDimensions: { width: 1920, height: 1080 },
    padding: DEFAULT_PADDING,
    minZoom: DEFAULT_MIN_ZOOM,
    maxZoom: DEFAULT_MAX_ZOOM,
    zoomStep: DEFAULT_ZOOM_STEP,
  };
  changeHandlers = [];
}
