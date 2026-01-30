/**
 * SpacingControls — Box model controls for margin and padding adjustments.
 *
 * Feature #81: Create spacing controls for margin and padding adjustments
 * Verification: Box model control with drag handles or input fields
 *
 * Provides interactive controls for adjusting element spacing with:
 * - Individual control for each side (top, right, bottom, left)
 * - Support for both margin and padding
 * - Drag handles for visual adjustment
 * - Input fields for precise values
 * - Live preview updates via iframe communication
 *
 * @module lib/preview/spacing-controls
 */

// =============================================================================
// Types
// =============================================================================

/** Spacing side identifiers */
export type SpacingSide = "top" | "right" | "bottom" | "left";

/** Spacing type (margin or padding) */
export type SpacingType = "margin" | "padding";

/** All sides shorthand */
export type SpacingAllSides = "all";

/** Spacing unit types */
export type SpacingUnit = "px" | "rem" | "em" | "%" | "auto";

/** A single spacing value */
export interface SpacingValue {
  /** Numeric value (undefined for 'auto') */
  value?: number;
  /** Unit of measurement */
  unit: SpacingUnit;
}

/** Box model spacing for all sides */
export interface BoxSpacing {
  top: SpacingValue;
  right: SpacingValue;
  bottom: SpacingValue;
  left: SpacingValue;
}

/** Complete element spacing (margin + padding) */
export interface ElementSpacing {
  margin: BoxSpacing;
  padding: BoxSpacing;
}

/** Spacing preset definition */
export interface SpacingPreset {
  /** Preset identifier */
  id: string;
  /** Display name */
  name: string;
  /** Value in pixels */
  value: number;
  /** CSS variable name (optional) */
  cssVar?: string;
}

/** Spacing controls configuration */
export interface SpacingControlsOptions {
  /** Default unit for new values */
  defaultUnit?: SpacingUnit;
  /** Available presets */
  presets?: SpacingPreset[];
  /** Minimum value (in pixels) */
  minValue?: number;
  /** Maximum value (in pixels) */
  maxValue?: number;
  /** Step for increment/decrement */
  step?: number;
  /** Allow negative margins */
  allowNegative?: boolean;
  /** Show linked/unlinked toggle for all sides */
  showLinkToggle?: boolean;
}

/** Current state of the controls */
export interface SpacingControlsState {
  /** Currently selected element ID */
  selectedElementId: string | null;
  /** Current margin values */
  margin: BoxSpacing;
  /** Current padding values */
  padding: BoxSpacing;
  /** Whether all sides are linked */
  marginLinked: boolean;
  /** Whether all padding sides are linked */
  paddingLinked: boolean;
  /** Currently active input */
  activeInput: { type: SpacingType; side: SpacingSide } | null;
  /** Is dragging a handle */
  isDragging: boolean;
}

/** Spacing change event */
export interface SpacingChangeEvent {
  /** Element being modified */
  elementId: string;
  /** Type of spacing changed */
  type: SpacingType;
  /** Side changed (or 'all' if linked) */
  side: SpacingSide | SpacingAllSides;
  /** Previous value */
  previousValue: SpacingValue;
  /** New value */
  newValue: SpacingValue;
  /** Full new spacing */
  spacing: ElementSpacing;
}

/** Callback for spacing changes */
export type SpacingChangeCallback = (event: SpacingChangeEvent) => void;

/** Callback for drag events */
export type DragCallback = (
  type: SpacingType,
  side: SpacingSide,
  delta: number,
  isComplete: boolean
) => void;

// =============================================================================
// Constants
// =============================================================================

/** Default spacing presets based on common design systems */
export const SPACING_PRESETS: SpacingPreset[] = [
  { id: "0", name: "None", value: 0 },
  { id: "xs", name: "Extra Small", value: 4, cssVar: "--spacing-xs" },
  { id: "sm", name: "Small", value: 8, cssVar: "--spacing-sm" },
  { id: "md", name: "Medium", value: 16, cssVar: "--spacing-md" },
  { id: "lg", name: "Large", value: 24, cssVar: "--spacing-lg" },
  { id: "xl", name: "Extra Large", value: 32, cssVar: "--spacing-xl" },
  { id: "2xl", name: "2X Large", value: 48, cssVar: "--spacing-2xl" },
  { id: "3xl", name: "3X Large", value: 64, cssVar: "--spacing-3xl" },
];

/** Default box spacing (all zeros) */
export const DEFAULT_BOX_SPACING: BoxSpacing = {
  top: { value: 0, unit: "px" },
  right: { value: 0, unit: "px" },
  bottom: { value: 0, unit: "px" },
  left: { value: 0, unit: "px" },
};

/** Default element spacing */
export const DEFAULT_ELEMENT_SPACING: ElementSpacing = {
  margin: { ...DEFAULT_BOX_SPACING },
  padding: { ...DEFAULT_BOX_SPACING },
};

/** Sides in clockwise order (CSS shorthand order) */
export const SIDES_ORDER: SpacingSide[] = ["top", "right", "bottom", "left"];

// =============================================================================
// Utilities
// =============================================================================

/**
 * Formats a spacing value as CSS string.
 */
export function formatSpacingValue(spacing: SpacingValue): string {
  if (spacing.unit === "auto") {
    return "auto";
  }
  return `${spacing.value ?? 0}${spacing.unit}`;
}

/**
 * Parses a CSS spacing string into SpacingValue.
 */
export function parseSpacingValue(css: string): SpacingValue {
  const trimmed = css.trim().toLowerCase();

  if (trimmed === "auto") {
    return { unit: "auto" };
  }

  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)(px|rem|em|%)$/);
  if (match) {
    return {
      value: parseFloat(match[1]),
      unit: match[2] as SpacingUnit,
    };
  }

  // Default to 0px if unparseable
  return { value: 0, unit: "px" };
}

/**
 * Formats box spacing as CSS shorthand.
 */
export function formatBoxSpacing(spacing: BoxSpacing): string {
  const { top, right, bottom, left } = spacing;

  const t = formatSpacingValue(top);
  const r = formatSpacingValue(right);
  const b = formatSpacingValue(bottom);
  const l = formatSpacingValue(left);

  // Optimize shorthand
  if (t === r && r === b && b === l) {
    return t; // All same: "10px"
  }
  if (t === b && r === l) {
    return `${t} ${r}`; // Top/bottom and left/right: "10px 20px"
  }
  if (r === l) {
    return `${t} ${r} ${b}`; // Left equals right: "10px 20px 30px"
  }
  return `${t} ${r} ${b} ${l}`; // All different: "10px 20px 30px 40px"
}

/**
 * Parses CSS shorthand into BoxSpacing.
 */
export function parseBoxSpacing(css: string): BoxSpacing {
  const parts = css.trim().split(/\s+/);

  if (parts.length === 1) {
    const v = parseSpacingValue(parts[0]);
    return { top: v, right: { ...v }, bottom: { ...v }, left: { ...v } };
  }
  if (parts.length === 2) {
    const tb = parseSpacingValue(parts[0]);
    const lr = parseSpacingValue(parts[1]);
    return { top: tb, right: lr, bottom: { ...tb }, left: { ...lr } };
  }
  if (parts.length === 3) {
    const t = parseSpacingValue(parts[0]);
    const lr = parseSpacingValue(parts[1]);
    const b = parseSpacingValue(parts[2]);
    return { top: t, right: lr, bottom: b, left: { ...lr } };
  }
  return {
    top: parseSpacingValue(parts[0] || "0"),
    right: parseSpacingValue(parts[1] || "0"),
    bottom: parseSpacingValue(parts[2] || "0"),
    left: parseSpacingValue(parts[3] || "0"),
  };
}

/**
 * Gets a preset by value.
 */
export function getPresetByValue(
  value: number,
  presets: SpacingPreset[] = SPACING_PRESETS
): SpacingPreset | undefined {
  return presets.find((p) => p.value === value);
}

/**
 * Gets closest preset to a value.
 */
export function getClosestPreset(
  value: number,
  presets: SpacingPreset[] = SPACING_PRESETS
): SpacingPreset {
  return presets.reduce((closest, preset) =>
    Math.abs(preset.value - value) < Math.abs(closest.value - value)
      ? preset
      : closest
  );
}

/**
 * Converts spacing value to pixels.
 */
export function toPixels(spacing: SpacingValue, baseFontSize = 16): number {
  if (spacing.unit === "auto" || spacing.value === undefined) {
    return 0;
  }

  switch (spacing.unit) {
    case "px":
      return spacing.value;
    case "rem":
      return spacing.value * baseFontSize;
    case "em":
      return spacing.value * baseFontSize;
    case "%":
      return spacing.value; // Context-dependent, return as-is
    default:
      return spacing.value;
  }
}

/**
 * Creates a deep copy of element spacing.
 */
export function cloneElementSpacing(spacing: ElementSpacing): ElementSpacing {
  return {
    margin: {
      top: { ...spacing.margin.top },
      right: { ...spacing.margin.right },
      bottom: { ...spacing.margin.bottom },
      left: { ...spacing.margin.left },
    },
    padding: {
      top: { ...spacing.padding.top },
      right: { ...spacing.padding.right },
      bottom: { ...spacing.padding.bottom },
      left: { ...spacing.padding.left },
    },
  };
}

// =============================================================================
// SpacingControls Class
// =============================================================================

/**
 * Manages spacing controls for margin and padding adjustments.
 *
 * @example
 * ```typescript
 * const controls = new SpacingControls({
 *   defaultUnit: "px",
 *   presets: SPACING_PRESETS,
 * });
 *
 * // Connect to preview iframe
 * controls.connect(iframe);
 *
 * // Select an element
 * controls.selectElement("snippet-1");
 *
 * // Listen for changes
 * controls.onChange((event) => {
 *   console.log(`Changed ${event.type}-${event.side} to ${event.newValue}`);
 * });
 *
 * // Update padding
 * controls.setPadding("top", { value: 16, unit: "px" });
 * ```
 */
export class SpacingControls {
  private options: Required<SpacingControlsOptions>;
  private state: SpacingControlsState;
  private iframe: HTMLIFrameElement | null = null;
  private changeCallbacks = new Set<SpacingChangeCallback>();
  private dragCallbacks = new Set<DragCallback>();
  private disposed = false;

  constructor(options: SpacingControlsOptions = {}) {
    this.options = {
      defaultUnit: options.defaultUnit ?? "px",
      presets: options.presets ?? SPACING_PRESETS,
      minValue: options.minValue ?? 0,
      maxValue: options.maxValue ?? 500,
      step: options.step ?? 1,
      allowNegative: options.allowNegative ?? false,
      showLinkToggle: options.showLinkToggle ?? true,
    };

    this.state = {
      selectedElementId: null,
      margin: cloneElementSpacing(DEFAULT_ELEMENT_SPACING).margin,
      padding: cloneElementSpacing(DEFAULT_ELEMENT_SPACING).padding,
      marginLinked: false,
      paddingLinked: false,
      activeInput: null,
      isDragging: false,
    };
  }

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------

  /**
   * Connects to a preview iframe.
   */
  connect(iframe: HTMLIFrameElement): void {
    if (this.disposed) {
      throw new Error("SpacingControls has been disposed");
    }
    this.iframe = iframe;
  }

  /**
   * Disconnects from the iframe.
   */
  disconnect(): void {
    this.iframe = null;
  }

  /**
   * Checks if connected.
   */
  isConnected(): boolean {
    return this.iframe !== null;
  }

  // ---------------------------------------------------------------------------
  // Element Selection
  // ---------------------------------------------------------------------------

  /**
   * Selects an element to edit spacing for.
   */
  selectElement(elementId: string, initialSpacing?: ElementSpacing): void {
    this.state.selectedElementId = elementId;

    if (initialSpacing) {
      this.state.margin = cloneElementSpacing(initialSpacing).margin;
      this.state.padding = cloneElementSpacing(initialSpacing).padding;
    } else {
      // Request current spacing from iframe
      this.requestElementSpacing(elementId);
    }
  }

  /**
   * Clears the current selection.
   */
  clearSelection(): void {
    this.state.selectedElementId = null;
    this.state.margin = cloneElementSpacing(DEFAULT_ELEMENT_SPACING).margin;
    this.state.padding = cloneElementSpacing(DEFAULT_ELEMENT_SPACING).padding;
  }

  /**
   * Gets the currently selected element ID.
   */
  getSelectedElementId(): string | null {
    return this.state.selectedElementId;
  }

  // ---------------------------------------------------------------------------
  // Margin Controls
  // ---------------------------------------------------------------------------

  /**
   * Sets margin for a specific side.
   */
  setMargin(side: SpacingSide, value: SpacingValue): void {
    if (!this.state.selectedElementId) return;

    const previous = { ...this.state.margin[side] };

    if (this.state.marginLinked) {
      // Apply to all sides
      for (const s of SIDES_ORDER) {
        this.state.margin[s] = { ...value };
      }
      this.notifyChange("margin", "all", previous, value);
    } else {
      this.state.margin[side] = { ...value };
      this.notifyChange("margin", side, previous, value);
    }

    this.applySpacingToElement();
  }

  /**
   * Sets all margin sides at once.
   */
  setMarginAll(spacing: BoxSpacing): void {
    if (!this.state.selectedElementId) return;

    const previous = { ...this.state.margin.top };
    this.state.margin = {
      top: { ...spacing.top },
      right: { ...spacing.right },
      bottom: { ...spacing.bottom },
      left: { ...spacing.left },
    };

    this.notifyChange("margin", "all", previous, spacing.top);
    this.applySpacingToElement();
  }

  /**
   * Gets current margin value for a side.
   */
  getMargin(side: SpacingSide): SpacingValue {
    return { ...this.state.margin[side] };
  }

  /**
   * Gets all margin values.
   */
  getAllMargin(): BoxSpacing {
    return {
      top: { ...this.state.margin.top },
      right: { ...this.state.margin.right },
      bottom: { ...this.state.margin.bottom },
      left: { ...this.state.margin.left },
    };
  }

  // ---------------------------------------------------------------------------
  // Padding Controls
  // ---------------------------------------------------------------------------

  /**
   * Sets padding for a specific side.
   */
  setPadding(side: SpacingSide, value: SpacingValue): void {
    if (!this.state.selectedElementId) return;

    const previous = { ...this.state.padding[side] };

    if (this.state.paddingLinked) {
      // Apply to all sides
      for (const s of SIDES_ORDER) {
        this.state.padding[s] = { ...value };
      }
      this.notifyChange("padding", "all", previous, value);
    } else {
      this.state.padding[side] = { ...value };
      this.notifyChange("padding", side, previous, value);
    }

    this.applySpacingToElement();
  }

  /**
   * Sets all padding sides at once.
   */
  setPaddingAll(spacing: BoxSpacing): void {
    if (!this.state.selectedElementId) return;

    const previous = { ...this.state.padding.top };
    this.state.padding = {
      top: { ...spacing.top },
      right: { ...spacing.right },
      bottom: { ...spacing.bottom },
      left: { ...spacing.left },
    };

    this.notifyChange("padding", "all", previous, spacing.top);
    this.applySpacingToElement();
  }

  /**
   * Gets current padding value for a side.
   */
  getPadding(side: SpacingSide): SpacingValue {
    return { ...this.state.padding[side] };
  }

  /**
   * Gets all padding values.
   */
  getAllPadding(): BoxSpacing {
    return {
      top: { ...this.state.padding.top },
      right: { ...this.state.padding.right },
      bottom: { ...this.state.padding.bottom },
      left: { ...this.state.padding.left },
    };
  }

  // ---------------------------------------------------------------------------
  // Link Toggle
  // ---------------------------------------------------------------------------

  /**
   * Links/unlinks margin sides.
   */
  setMarginLinked(linked: boolean): void {
    this.state.marginLinked = linked;
  }

  /**
   * Links/unlinks padding sides.
   */
  setPaddingLinked(linked: boolean): void {
    this.state.paddingLinked = linked;
  }

  /**
   * Checks if margin sides are linked.
   */
  isMarginLinked(): boolean {
    return this.state.marginLinked;
  }

  /**
   * Checks if padding sides are linked.
   */
  isPaddingLinked(): boolean {
    return this.state.paddingLinked;
  }

  // ---------------------------------------------------------------------------
  // Drag Handling
  // ---------------------------------------------------------------------------

  /**
   * Starts a drag operation on a spacing handle.
   */
  startDrag(type: SpacingType, side: SpacingSide): void {
    this.state.isDragging = true;
    this.state.activeInput = { type, side };
  }

  /**
   * Updates during a drag operation.
   */
  updateDrag(type: SpacingType, side: SpacingSide, deltaPixels: number): void {
    if (!this.state.isDragging || !this.state.selectedElementId) return;

    const current = type === "margin" ? this.state.margin[side] : this.state.padding[side];
    const currentPx = toPixels(current);
    let newValue = currentPx + deltaPixels;

    // Clamp to allowed range
    if (!this.options.allowNegative && type === "padding") {
      newValue = Math.max(0, newValue);
    }
    newValue = Math.max(this.options.minValue, Math.min(this.options.maxValue, newValue));

    // Apply step
    newValue = Math.round(newValue / this.options.step) * this.options.step;

    const newSpacing: SpacingValue = {
      value: newValue,
      unit: current.unit === "auto" ? "px" : current.unit,
    };

    if (type === "margin") {
      this.setMargin(side, newSpacing);
    } else {
      this.setPadding(side, newSpacing);
    }

    // Notify drag callbacks
    for (const cb of this.dragCallbacks) {
      try {
        cb(type, side, deltaPixels, false);
      } catch (e) {
        console.error("SpacingControls drag callback error:", e);
      }
    }
  }

  /**
   * Ends a drag operation.
   */
  endDrag(): void {
    if (this.state.isDragging && this.state.activeInput) {
      const { type, side } = this.state.activeInput;
      for (const cb of this.dragCallbacks) {
        try {
          cb(type, side, 0, true);
        } catch (e) {
          console.error("SpacingControls drag end callback error:", e);
        }
      }
    }

    this.state.isDragging = false;
    this.state.activeInput = null;
  }

  /**
   * Checks if currently dragging.
   */
  isDragging(): boolean {
    return this.state.isDragging;
  }

  // ---------------------------------------------------------------------------
  // Preset Application
  // ---------------------------------------------------------------------------

  /**
   * Applies a preset to margin.
   */
  applyMarginPreset(presetId: string, side?: SpacingSide): void {
    const preset = this.options.presets.find((p) => p.id === presetId);
    if (!preset) return;

    const value: SpacingValue = { value: preset.value, unit: "px" };

    if (side) {
      this.setMargin(side, value);
    } else {
      this.setMarginAll({
        top: value,
        right: { ...value },
        bottom: { ...value },
        left: { ...value },
      });
    }
  }

  /**
   * Applies a preset to padding.
   */
  applyPaddingPreset(presetId: string, side?: SpacingSide): void {
    const preset = this.options.presets.find((p) => p.id === presetId);
    if (!preset) return;

    const value: SpacingValue = { value: preset.value, unit: "px" };

    if (side) {
      this.setPadding(side, value);
    } else {
      this.setPaddingAll({
        top: value,
        right: { ...value },
        bottom: { ...value },
        left: { ...value },
      });
    }
  }

  /**
   * Gets available presets.
   */
  getPresets(): SpacingPreset[] {
    return [...this.options.presets];
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /**
   * Gets the full current spacing.
   */
  getSpacing(): ElementSpacing {
    return {
      margin: this.getAllMargin(),
      padding: this.getAllPadding(),
    };
  }

  /**
   * Gets the full state.
   */
  getState(): SpacingControlsState {
    return {
      ...this.state,
      margin: this.getAllMargin(),
      padding: this.getAllPadding(),
    };
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  /**
   * Registers a callback for spacing changes.
   */
  onChange(callback: SpacingChangeCallback): () => void {
    this.changeCallbacks.add(callback);
    return () => this.changeCallbacks.delete(callback);
  }

  /**
   * Registers a callback for drag events.
   */
  onDrag(callback: DragCallback): () => void {
    this.dragCallbacks.add(callback);
    return () => this.dragCallbacks.delete(callback);
  }

  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

  private notifyChange(
    type: SpacingType,
    side: SpacingSide | SpacingAllSides,
    previousValue: SpacingValue,
    newValue: SpacingValue
  ): void {
    if (!this.state.selectedElementId) return;

    const event: SpacingChangeEvent = {
      elementId: this.state.selectedElementId,
      type,
      side,
      previousValue,
      newValue,
      spacing: this.getSpacing(),
    };

    for (const cb of this.changeCallbacks) {
      try {
        cb(event);
      } catch (e) {
        console.error("SpacingControls change callback error:", e);
      }
    }
  }

  private requestElementSpacing(elementId: string): void {
    if (!this.iframe?.contentWindow) return;

    this.iframe.contentWindow.postMessage(
      {
        type: "platxa:get-element-spacing",
        elementId,
      },
      "*"
    );
  }

  private applySpacingToElement(): void {
    if (!this.iframe?.contentWindow || !this.state.selectedElementId) return;

    this.iframe.contentWindow.postMessage(
      {
        type: "platxa:apply-element-spacing",
        elementId: this.state.selectedElementId,
        margin: formatBoxSpacing(this.state.margin),
        padding: formatBoxSpacing(this.state.padding),
      },
      "*"
    );
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Disposes and cleans up resources.
   */
  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.iframe = null;
    this.changeCallbacks.clear();
    this.dragCallbacks.clear();
  }
}

// =============================================================================
// Iframe Script
// =============================================================================

/**
 * Script to inject into the preview iframe for spacing manipulation.
 */
export const SPACING_CONTROLS_SCRIPT = `
<script>
(function() {
  function getElementSpacing(elementId) {
    var el = document.querySelector('[data-snippet-id="' + elementId + '"]') ||
             document.querySelector('[data-element-id="' + elementId + '"]') ||
             document.getElementById(elementId);

    if (!el) {
      window.parent.postMessage({
        type: 'platxa:element-spacing-error',
        elementId: elementId,
        error: 'Element not found'
      }, '*');
      return;
    }

    var style = window.getComputedStyle(el);
    window.parent.postMessage({
      type: 'platxa:element-spacing',
      elementId: elementId,
      margin: {
        top: style.marginTop,
        right: style.marginRight,
        bottom: style.marginBottom,
        left: style.marginLeft
      },
      padding: {
        top: style.paddingTop,
        right: style.paddingRight,
        bottom: style.paddingBottom,
        left: style.paddingLeft
      }
    }, '*');
  }

  function applyElementSpacing(elementId, margin, padding) {
    var el = document.querySelector('[data-snippet-id="' + elementId + '"]') ||
             document.querySelector('[data-element-id="' + elementId + '"]') ||
             document.getElementById(elementId);

    if (!el) {
      window.parent.postMessage({
        type: 'platxa:spacing-apply-error',
        elementId: elementId,
        error: 'Element not found'
      }, '*');
      return;
    }

    if (margin) el.style.margin = margin;
    if (padding) el.style.padding = padding;

    window.parent.postMessage({
      type: 'platxa:spacing-applied',
      elementId: elementId,
      margin: margin,
      padding: padding
    }, '*');
  }

  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;

    switch (e.data.type) {
      case 'platxa:get-element-spacing':
        getElementSpacing(e.data.elementId);
        break;

      case 'platxa:apply-element-spacing':
        applyElementSpacing(e.data.elementId, e.data.margin, e.data.padding);
        break;
    }
  });

  // Notify parent that spacing script is ready
  window.parent.postMessage({ type: 'platxa:spacing-script-ready' }, '*');
})();
</script>`;

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a SpacingControls instance.
 */
export function createSpacingControls(
  options?: SpacingControlsOptions
): SpacingControls {
  return new SpacingControls(options);
}

// =============================================================================
// Exports
// =============================================================================

export default SpacingControls;
