/**
 * MultiSelect — Multi-element selection for batch editing
 *
 * Feature #17: Visual Edit Mode - Multi-select
 *
 * Enables selecting multiple elements with Cmd/Ctrl+Click:
 * - Add/remove elements from selection
 * - Find shared properties across selected elements
 * - Apply batch edits to all selected elements
 * - Selection state management with events
 */

import {
  type SelectedElement,
  type EditableProperty,
  type VisualEdit,
  getVisualEditor,
} from "./visual-editor";

// =============================================================================
// Types
// =============================================================================

/** Multi-selection state */
export interface MultiSelectState {
  /** Selected elements */
  elements: SelectedElement[];
  /** Shared properties across all selected elements */
  sharedProperties: EditableProperty[];
  /** Whether selection is active */
  isActive: boolean;
  /** Last modified timestamp */
  lastModified: number;
}

/** Selection mode */
export type SelectionMode =
  | "single"      // Replace selection
  | "add"         // Add to selection (Cmd/Ctrl+Click)
  | "toggle"      // Toggle in selection (Cmd/Ctrl+Click on selected)
  | "range";      // Range selection (Shift+Click)

/** Selection change event */
export interface SelectionChangeEvent {
  /** Previous selection */
  previous: SelectedElement[];
  /** Current selection */
  current: SelectedElement[];
  /** Element that triggered the change */
  trigger?: SelectedElement;
  /** Selection mode used */
  mode: SelectionMode;
  /** Timestamp */
  timestamp: number;
}

/** Batch edit operation */
export interface BatchEdit {
  /** Property ID to change */
  propertyId: string;
  /** New value */
  value: string;
  /** Elements affected */
  elementIds: string[];
}

/** Batch edit result */
export interface BatchEditResult {
  /** Whether all edits succeeded */
  success: boolean;
  /** Number of successful edits */
  successCount: number;
  /** Number of failed edits */
  failedCount: number;
  /** Failed element IDs */
  failedElements: string[];
  /** Edits that were applied */
  appliedEdits: VisualEdit[];
}

/** Multi-select configuration */
export interface MultiSelectConfig {
  /** Maximum number of elements that can be selected */
  maxSelections: number;
  /** Whether to show selection count badge */
  showSelectionCount: boolean;
  /** Whether range selection is enabled */
  enableRangeSelect: boolean;
  /** Key for multi-select modifier (meta = Cmd on Mac, ctrl on others) */
  multiSelectKey: "meta" | "ctrl" | "alt";
}

/** Event types */
export type MultiSelectEventType =
  | "selection_change"
  | "batch_edit_start"
  | "batch_edit_complete"
  | "selection_clear";

/** Event payload */
export interface MultiSelectEvent {
  type: MultiSelectEventType;
  timestamp: number;
  data: unknown;
}

/** Event listener */
export type MultiSelectEventListener = (event: MultiSelectEvent) => void;

// =============================================================================
// Constants
// =============================================================================

/** Default configuration */
export const DEFAULT_MULTI_SELECT_CONFIG: MultiSelectConfig = {
  maxSelections: 50,
  showSelectionCount: true,
  enableRangeSelect: true,
  multiSelectKey: "meta",
};

// =============================================================================
// Helpers
// =============================================================================

/** Find shared properties across multiple elements */
function findSharedProperties(elements: SelectedElement[]): EditableProperty[] {
  if (elements.length === 0) return [];
  if (elements.length === 1) return elements[0].properties;

  // Start with first element's properties
  const firstProps = elements[0].properties;
  const shared: EditableProperty[] = [];

  for (const prop of firstProps) {
    // Check if this property exists in all other elements
    let isShared = true;
    let sharedValue: string | null = prop.value;

    for (let i = 1; i < elements.length; i++) {
      const otherProp = elements[i].properties.find(
        (p) => p.cssProperty === prop.cssProperty || p.name === prop.name
      );

      if (!otherProp) {
        isShared = false;
        break;
      }

      // Check if values are the same
      if (otherProp.value !== sharedValue) {
        sharedValue = null; // Mixed values
      }
    }

    if (isShared) {
      shared.push({
        ...prop,
        value: sharedValue ?? "(mixed)",
        // Mark as mixed if values differ
        allowedValues: sharedValue === null ? ["(mixed)", ...(prop.allowedValues || [])] : prop.allowedValues,
      });
    }
  }

  return shared;
}

/** Check if element is in selection */
function isElementSelected(
  element: SelectedElement,
  selection: SelectedElement[]
): boolean {
  return selection.some(
    (s) =>
      s.element.id === element.element.id ||
      (s.element.file === element.element.file &&
        s.element.range.start.line === element.element.range.start.line)
  );
}

/** Detect modifier key based on platform */
function getModifierKey(): "meta" | "ctrl" {
  if (typeof navigator !== "undefined") {
    return navigator.platform.toLowerCase().includes("mac") ? "meta" : "ctrl";
  }
  return "meta";
}

// =============================================================================
// MultiSelectManager Class
// =============================================================================

/**
 * MultiSelectManager handles multi-element selection for batch editing.
 *
 * Usage:
 * ```ts
 * const manager = new MultiSelectManager();
 *
 * // Handle click with modifier detection
 * manager.handleClick(element, { metaKey: true, shiftKey: false });
 *
 * // Get shared properties for property panel
 * const props = manager.getSharedProperties();
 *
 * // Apply batch edit
 * const result = await manager.applyBatchEdit("color", "#ff0000");
 *
 * // Listen for selection changes
 * manager.on((event) => {
 *   if (event.type === "selection_change") {
 *     updateUI(event.data);
 *   }
 * });
 * ```
 */
export class MultiSelectManager {
  private config: MultiSelectConfig;
  private state: MultiSelectState;
  private listeners: MultiSelectEventListener[] = [];

  constructor(config: Partial<MultiSelectConfig> = {}) {
    this.config = { ...DEFAULT_MULTI_SELECT_CONFIG, ...config };
    this.state = {
      elements: [],
      sharedProperties: [],
      isActive: false,
      lastModified: Date.now(),
    };
  }

  // ---------------------------------------------------------------------------
  // Selection Operations
  // ---------------------------------------------------------------------------

  /**
   * Handle element click with modifier key detection.
   */
  handleClick(
    element: SelectedElement,
    modifiers: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean }
  ): void {
    const multiKey = this.config.multiSelectKey === "meta" ? modifiers.metaKey : modifiers.ctrlKey;

    if (multiKey) {
      // Multi-select mode
      if (isElementSelected(element, this.state.elements)) {
        this.removeFromSelection(element);
      } else {
        this.addToSelection(element);
      }
    } else if (modifiers.shiftKey && this.config.enableRangeSelect) {
      // Range selection (not fully implemented - would need element ordering)
      this.addToSelection(element);
    } else {
      // Single selection - replace
      this.setSelection([element]);
    }
  }

  /**
   * Add element to selection.
   */
  addToSelection(element: SelectedElement): boolean {
    if (this.state.elements.length >= this.config.maxSelections) {
      return false;
    }

    if (isElementSelected(element, this.state.elements)) {
      return false;
    }

    const previous = [...this.state.elements];
    this.state.elements.push(element);
    this.updateState("add", element, previous);
    return true;
  }

  /**
   * Remove element from selection.
   */
  removeFromSelection(element: SelectedElement): boolean {
    const index = this.state.elements.findIndex(
      (s) =>
        s.element.id === element.element.id ||
        (s.element.file === element.element.file &&
          s.element.range.start.line === element.element.range.start.line)
    );

    if (index < 0) {
      return false;
    }

    const previous = [...this.state.elements];
    this.state.elements.splice(index, 1);
    this.updateState("toggle", element, previous);
    return true;
  }

  /**
   * Set selection (replace existing).
   */
  setSelection(elements: SelectedElement[]): void {
    const previous = [...this.state.elements];
    this.state.elements = elements.slice(0, this.config.maxSelections);
    this.updateState("single", elements[0], previous);
  }

  /**
   * Clear all selection.
   */
  clearSelection(): void {
    const previous = [...this.state.elements];
    this.state.elements = [];
    this.state.sharedProperties = [];
    this.state.isActive = false;
    this.state.lastModified = Date.now();

    this.emit("selection_clear", { previous });
  }

  /**
   * Toggle element in selection.
   */
  toggleSelection(element: SelectedElement): void {
    if (isElementSelected(element, this.state.elements)) {
      this.removeFromSelection(element);
    } else {
      this.addToSelection(element);
    }
  }

  // ---------------------------------------------------------------------------
  // Properties
  // ---------------------------------------------------------------------------

  /**
   * Get shared properties across all selected elements.
   */
  getSharedProperties(): EditableProperty[] {
    return this.state.sharedProperties;
  }

  /**
   * Check if a property has mixed values across selection.
   */
  hasPropertyMixedValues(propertyId: string): boolean {
    const prop = this.state.sharedProperties.find((p) => p.id === propertyId);
    return prop?.value === "(mixed)";
  }

  /**
   * Get property value (or null if mixed).
   */
  getPropertyValue(propertyId: string): string | null {
    const prop = this.state.sharedProperties.find((p) => p.id === propertyId);
    if (!prop || prop.value === "(mixed)") return null;
    return prop.value;
  }

  // ---------------------------------------------------------------------------
  // Batch Editing
  // ---------------------------------------------------------------------------

  /**
   * Apply a property change to all selected elements.
   */
  async applyBatchEdit(propertyId: string, value: string): Promise<BatchEditResult> {
    const editor = getVisualEditor();
    const appliedEdits: VisualEdit[] = [];
    const failedElements: string[] = [];

    this.emit("batch_edit_start", { propertyId, value, count: this.state.elements.length });

    for (const element of this.state.elements) {
      try {
        // Find the property in this element
        const prop = element.properties.find(
          (p) => p.id === propertyId || p.cssProperty === propertyId || p.name === propertyId
        );

        if (prop) {
          // Create edit
          const edit: VisualEdit = {
            id: `batch-${Date.now()}-${element.element.id}`,
            elementId: element.element.id,
            propertyId: prop.id,
            oldValue: prop.value,
            newValue: value,
            timestamp: Date.now(),
            applied: false,
          };

          // Apply through visual editor
          editor.setProperty(prop.id, value);
          appliedEdits.push(edit);
        } else {
          failedElements.push(element.element.id);
        }
      } catch {
        failedElements.push(element.element.id);
      }
    }

    const result: BatchEditResult = {
      success: failedElements.length === 0,
      successCount: appliedEdits.length,
      failedCount: failedElements.length,
      failedElements,
      appliedEdits,
    };

    this.emit("batch_edit_complete", result);

    // Refresh shared properties
    this.state.sharedProperties = findSharedProperties(this.state.elements);

    return result;
  }

  /**
   * Apply multiple property changes to all selected elements.
   */
  async applyBatchEdits(
    edits: Array<{ propertyId: string; value: string }>
  ): Promise<BatchEditResult> {
    const allApplied: VisualEdit[] = [];
    const allFailed: string[] = [];

    for (const edit of edits) {
      const result = await this.applyBatchEdit(edit.propertyId, edit.value);
      allApplied.push(...result.appliedEdits);
      allFailed.push(...result.failedElements);
    }

    return {
      success: allFailed.length === 0,
      successCount: allApplied.length,
      failedCount: allFailed.length,
      failedElements: Array.from(new Set(allFailed)),
      appliedEdits: allApplied,
    };
  }

  // ---------------------------------------------------------------------------
  // State Access
  // ---------------------------------------------------------------------------

  /**
   * Get current selection state.
   */
  getState(): MultiSelectState {
    return { ...this.state };
  }

  /**
   * Get selected elements.
   */
  getSelectedElements(): SelectedElement[] {
    return [...this.state.elements];
  }

  /**
   * Get selection count.
   */
  getSelectionCount(): number {
    return this.state.elements.length;
  }

  /**
   * Check if multi-select is active (more than one element).
   */
  isMultiSelectActive(): boolean {
    return this.state.elements.length > 1;
  }

  /**
   * Check if element is selected.
   */
  isSelected(element: SelectedElement): boolean {
    return isElementSelected(element, this.state.elements);
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  /**
   * Add event listener.
   */
  on(listener: MultiSelectEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  private emit(type: MultiSelectEventType, data: unknown): void {
    const event: MultiSelectEvent = {
      type,
      timestamp: Date.now(),
      data,
    };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }

  private updateState(
    mode: SelectionMode,
    trigger: SelectedElement | undefined,
    previous: SelectedElement[]
  ): void {
    this.state.sharedProperties = findSharedProperties(this.state.elements);
    this.state.isActive = this.state.elements.length > 0;
    this.state.lastModified = Date.now();

    const event: SelectionChangeEvent = {
      previous,
      current: [...this.state.elements],
      trigger,
      mode,
      timestamp: Date.now(),
    };

    this.emit("selection_change", event);
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  /**
   * Get configuration.
   */
  getConfig(): MultiSelectConfig {
    return { ...this.config };
  }

  /**
   * Update configuration.
   */
  setConfig(config: Partial<MultiSelectConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let _instance: MultiSelectManager | null = null;

/** Get the global MultiSelectManager instance */
export function getMultiSelectManager(): MultiSelectManager {
  if (!_instance) {
    _instance = new MultiSelectManager();
  }
  return _instance;
}

/** Reset the global MultiSelectManager instance */
export function resetMultiSelectManager(): void {
  if (_instance) {
    _instance.clearSelection();
  }
  _instance = null;
}

// =============================================================================
// React Hook Helper
// =============================================================================

/**
 * Create a hook factory for React integration.
 */
export function createMultiSelectHook() {
  return function useMultiSelect() {
    const manager = getMultiSelectManager();

    return {
      handleClick: manager.handleClick.bind(manager),
      addToSelection: manager.addToSelection.bind(manager),
      removeFromSelection: manager.removeFromSelection.bind(manager),
      clearSelection: manager.clearSelection.bind(manager),
      toggleSelection: manager.toggleSelection.bind(manager),
      getSelectedElements: manager.getSelectedElements.bind(manager),
      getSharedProperties: manager.getSharedProperties.bind(manager),
      getSelectionCount: manager.getSelectionCount.bind(manager),
      isMultiSelectActive: manager.isMultiSelectActive.bind(manager),
      isSelected: manager.isSelected.bind(manager),
      applyBatchEdit: manager.applyBatchEdit.bind(manager),
      on: manager.on.bind(manager),
    };
  };
}
