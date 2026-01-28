/**
 * Layout Grid Overlay
 *
 * Generates a 12-column Bootstrap grid overlay for alignment
 * verification in preview, with gutter visualization and toggle state.
 */

// =============================================================================
// Types
// =============================================================================

export interface GridConfig {
  /** Number of columns */
  columns: number;
  /** Gutter width (px) */
  gutterPx: number;
  /** Container max-width (px), 0 = fluid */
  containerMaxWidth: number;
  /** Column fill color (with alpha) */
  columnColor: string;
  /** Gutter color (with alpha) */
  gutterColor: string;
  /** Baseline grid row height (px), 0 = disabled */
  baselineRowHeight: number;
  /** Baseline grid color */
  baselineColor: string;
}

export const DEFAULT_GRID_CONFIG: GridConfig = {
  columns: 12,
  gutterPx: 30,
  containerMaxWidth: 1140,
  columnColor: "rgba(59, 130, 246, 0.08)",
  gutterColor: "rgba(59, 130, 246, 0.04)",
  baselineRowHeight: 0,
  baselineColor: "rgba(59, 130, 246, 0.06)",
};

/** Bootstrap breakpoint presets */
export interface BreakpointPreset {
  name: string;
  minWidth: number;
  containerMaxWidth: number;
}

export const BOOTSTRAP_BREAKPOINTS: BreakpointPreset[] = [
  { name: "xs", minWidth: 0, containerMaxWidth: 0 },
  { name: "sm", minWidth: 576, containerMaxWidth: 540 },
  { name: "md", minWidth: 768, containerMaxWidth: 720 },
  { name: "lg", minWidth: 992, containerMaxWidth: 960 },
  { name: "xl", minWidth: 1200, containerMaxWidth: 1140 },
  { name: "xxl", minWidth: 1400, containerMaxWidth: 1320 },
];

export interface GridOverlayState {
  /** Whether overlay is visible */
  visible: boolean;
  /** Grid config */
  config: GridConfig;
  /** Active breakpoint name */
  activeBreakpoint: string;
  /** Whether baseline grid is shown */
  showBaseline: boolean;
  /** Opacity (0-1) */
  opacity: number;
}

// =============================================================================
// State
// =============================================================================

export function createGridState(
  config: Partial<GridConfig> = {},
): GridOverlayState {
  return {
    visible: false,
    config: { ...DEFAULT_GRID_CONFIG, ...config },
    activeBreakpoint: "xl",
    showBaseline: false,
    opacity: 1,
  };
}

export function toggleOverlay(state: GridOverlayState): GridOverlayState {
  return { ...state, visible: !state.visible };
}

export function showOverlay(state: GridOverlayState): GridOverlayState {
  return { ...state, visible: true };
}

export function hideOverlay(state: GridOverlayState): GridOverlayState {
  return { ...state, visible: false };
}

export function setBreakpoint(
  state: GridOverlayState,
  breakpoint: string,
): GridOverlayState {
  const preset = BOOTSTRAP_BREAKPOINTS.find((b) => b.name === breakpoint);
  if (!preset) return state;
  return {
    ...state,
    activeBreakpoint: breakpoint,
    config: {
      ...state.config,
      containerMaxWidth: preset.containerMaxWidth,
    },
  };
}

export function toggleBaseline(state: GridOverlayState): GridOverlayState {
  return { ...state, showBaseline: !state.showBaseline };
}

export function setOpacity(
  state: GridOverlayState,
  opacity: number,
): GridOverlayState {
  return { ...state, opacity: Math.max(0, Math.min(1, opacity)) };
}

export function setColumns(
  state: GridOverlayState,
  columns: number,
): GridOverlayState {
  return { ...state, config: { ...state.config, columns: Math.max(1, columns) } };
}

export function setGutter(
  state: GridOverlayState,
  gutterPx: number,
): GridOverlayState {
  return { ...state, config: { ...state.config, gutterPx: Math.max(0, gutterPx) } };
}

// =============================================================================
// CSS Generation
// =============================================================================

/**
 * Generates the CSS for the grid overlay.
 */
export function generateGridCSS(state: GridOverlayState): string {
  if (!state.visible) return "";

  const { config, opacity } = state;
  const rules: string[] = [];

  // Container
  const containerWidth = config.containerMaxWidth > 0
    ? `max-width: ${config.containerMaxWidth}px;`
    : "width: 100%;";

  rules.push(
    `.grid-overlay {\n` +
    `  position: fixed;\n` +
    `  top: 0;\n` +
    `  left: 50%;\n` +
    `  transform: translateX(-50%);\n` +
    `  ${containerWidth}\n` +
    `  width: 100%;\n` +
    `  height: 100vh;\n` +
    `  pointer-events: none;\n` +
    `  z-index: 9999;\n` +
    `  opacity: ${opacity};\n` +
    `  display: flex;\n` +
    `  padding: 0 ${config.gutterPx / 2}px;\n` +
    `}`,
  );

  // Columns
  rules.push(
    `.grid-overlay__column {\n` +
    `  flex: 1;\n` +
    `  background: ${config.columnColor};\n` +
    `  margin: 0 ${config.gutterPx / 2}px;\n` +
    `  height: 100%;\n` +
    `}`,
  );

  // Baseline grid
  if (state.showBaseline && config.baselineRowHeight > 0) {
    rules.push(
      `.grid-overlay__baseline {\n` +
      `  position: fixed;\n` +
      `  top: 0;\n` +
      `  left: 0;\n` +
      `  width: 100%;\n` +
      `  height: 100vh;\n` +
      `  pointer-events: none;\n` +
      `  z-index: 9998;\n` +
      `  background-image: repeating-linear-gradient(\n` +
      `    to bottom,\n` +
      `    ${config.baselineColor} 0px,\n` +
      `    ${config.baselineColor} 1px,\n` +
      `    transparent 1px,\n` +
      `    transparent ${config.baselineRowHeight}px\n` +
      `  );\n` +
      `}`,
    );
  }

  return rules.join("\n\n");
}

/**
 * Generates HTML for the grid overlay element.
 */
export function generateGridHTML(state: GridOverlayState): string {
  if (!state.visible) return "";

  const { config } = state;
  const columns = Array.from(
    { length: config.columns },
    (_, i) => `  <div class="grid-overlay__column" data-col="${i + 1}"></div>`,
  ).join("\n");

  let html = `<div class="grid-overlay">\n${columns}\n</div>`;

  if (state.showBaseline && config.baselineRowHeight > 0) {
    html += `\n<div class="grid-overlay__baseline"></div>`;
  }

  return html;
}

/**
 * Returns a summary of the current grid configuration.
 */
export function getGridSummary(state: GridOverlayState): {
  visible: boolean;
  columns: number;
  gutterPx: number;
  containerMaxWidth: number;
  breakpoint: string;
  showBaseline: boolean;
  opacity: number;
} {
  return {
    visible: state.visible,
    columns: state.config.columns,
    gutterPx: state.config.gutterPx,
    containerMaxWidth: state.config.containerMaxWidth,
    breakpoint: state.activeBreakpoint,
    showBaseline: state.showBaseline,
    opacity: state.opacity,
  };
}

/**
 * Returns the breakpoint matching a given viewport width.
 */
export function getBreakpointForWidth(width: number): string {
  let match = BOOTSTRAP_BREAKPOINTS[0].name;
  for (const bp of BOOTSTRAP_BREAKPOINTS) {
    if (width >= bp.minWidth) match = bp.name;
  }
  return match;
}
