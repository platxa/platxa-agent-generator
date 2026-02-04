/**
 * VisualEditor — Controller for Visual Edit Mode
 *
 * Feature #15: Visual Edit Mode - Element selection and property editing
 *
 * Manages the visual editing workflow:
 * - Element selection in preview
 * - Property panel state
 * - Change application to QWeb templates
 * - Undo/redo for visual edits
 *
 * Integrates with SourceMapper for DOM ↔ source mapping.
 */

import {
  SourceMapper,
  getSourceMapper,
  type MappedElement,
  type SourcePosition,
} from "./source-mapper";
import { getModeManager } from "./mode-manager";

// =============================================================================
// Types
// =============================================================================

/** Editable property types */
export type PropertyType =
  | "text"
  | "color"
  | "size"
  | "spacing"
  | "font"
  | "border"
  | "shadow"
  | "visibility"
  | "class"
  | "attribute"
  | "style";

/** A single editable property */
export interface EditableProperty {
  /** Property identifier */
  id: string;
  /** Display name */
  name: string;
  /** Property type */
  type: PropertyType;
  /** Current value */
  value: string;
  /** CSS property name (if applicable) */
  cssProperty?: string;
  /** Attribute name (if applicable) */
  attributeName?: string;
  /** Allowed values (for enums) */
  allowedValues?: string[];
  /** Whether this is a computed value */
  computed?: boolean;
  /** Unit for numeric values */
  unit?: string;
}

/** Selected element with editable properties */
export interface SelectedElement {
  /** Mapped element info */
  element: MappedElement;
  /** Editable properties extracted from element */
  properties: EditableProperty[];
  /** Computed styles (if available) */
  computedStyles?: Record<string, string>;
  /** Bounding rect in preview */
  boundingRect?: DOMRect;
}

/** A visual edit operation */
export interface VisualEdit {
  /** Unique edit ID */
  id: string;
  /** Element being edited */
  elementId: string;
  /** Property being changed */
  propertyId: string;
  /** Previous value */
  oldValue: string;
  /** New value */
  newValue: string;
  /** Timestamp */
  timestamp: number;
  /** Whether edit has been applied to source */
  applied: boolean;
}

/** Edit batch (multiple edits as one undo unit) */
export interface EditBatch {
  /** Batch ID */
  id: string;
  /** Edits in this batch */
  edits: VisualEdit[];
  /** Batch description */
  description: string;
  /** Timestamp */
  timestamp: number;
}

/** Visual editor state */
export interface VisualEditorState {
  /** Currently selected element */
  selection: SelectedElement | null;
  /** Multi-selection */
  multiSelection: SelectedElement[];
  /** Pending edits (not yet applied to source) */
  pendingEdits: VisualEdit[];
  /** Edit history for undo */
  undoStack: EditBatch[];
  /** Redo stack */
  redoStack: EditBatch[];
  /** Whether editor is active */
  isActive: boolean;
  /** Hover highlight element ID */
  hoveredElementId: string | null;
}

/** Visual editor configuration */
export interface VisualEditorConfig {
  /** Max undo history depth */
  maxUndoDepth: number;
  /** Auto-apply edits to source */
  autoApply: boolean;
  /** Debounce delay for property changes (ms) */
  debounceDelay: number;
  /** Show computed styles */
  showComputedStyles: boolean;
  /** Allow multi-selection */
  allowMultiSelect: boolean;
}

/** Event types */
export type VisualEditorEventType =
  | "selection_changed"
  | "property_changed"
  | "edit_applied"
  | "edit_reverted"
  | "hover_changed"
  | "activated"
  | "deactivated";

/** Event data */
export interface VisualEditorEvent {
  type: VisualEditorEventType;
  elementId?: string;
  propertyId?: string;
  value?: string;
  timestamp: number;
}

/** Event listener */
export type VisualEditorEventListener = (event: VisualEditorEvent) => void;

/** Source update callback */
export type SourceUpdateFn = (
  file: string,
  line: number,
  column: number,
  oldValue: string,
  newValue: string
) => Promise<boolean>;

// =============================================================================
// Constants
// =============================================================================

/** Default configuration */
export const DEFAULT_VISUAL_EDITOR_CONFIG: VisualEditorConfig = {
  maxUndoDepth: 50,
  autoApply: false,
  debounceDelay: 300,
  showComputedStyles: true,
  allowMultiSelect: false,
};

/** Common CSS properties organized by type */
export const PROPERTY_CATEGORIES: Record<PropertyType, string[]> = {
  text: ["color", "font-size", "font-weight", "font-family", "text-align", "line-height"],
  color: ["color", "background-color", "border-color"],
  size: ["width", "height", "max-width", "max-height", "min-width", "min-height"],
  spacing: ["margin", "padding", "margin-top", "margin-bottom", "padding-top", "padding-bottom"],
  font: ["font-family", "font-size", "font-weight", "font-style"],
  border: ["border", "border-radius", "border-width", "border-style", "border-color"],
  shadow: ["box-shadow", "text-shadow"],
  visibility: ["display", "visibility", "opacity"],
  class: [],
  attribute: [],
  style: [],
};

// =============================================================================
// Helpers
// =============================================================================

let _editCounter = 0;
let _batchCounter = 0;

/** Reset counters (for testing) */
export function resetVisualEditorCounters(): void {
  _editCounter = 0;
  _batchCounter = 0;
}

/** Generate edit ID */
function generateEditId(): string {
  return `edit-${_editCounter++}`;
}

/** Generate batch ID */
function generateBatchId(): string {
  return `batch-${_batchCounter++}`;
}

/** Extract editable properties from element */
function extractProperties(element: MappedElement): EditableProperty[] {
  const properties: EditableProperty[] = [];
  let propIndex = 0;

  // Extract class attribute
  if (element.attributes["class"]) {
    properties.push({
      id: `prop-${propIndex++}`,
      name: "Classes",
      type: "class",
      value: element.attributes["class"],
      attributeName: "class",
    });
  }

  // Extract style attribute
  if (element.attributes["style"]) {
    properties.push({
      id: `prop-${propIndex++}`,
      name: "Inline Style",
      type: "style",
      value: element.attributes["style"],
      attributeName: "style",
    });

    // Parse individual style properties
    const styles = element.attributes["style"].split(";");
    for (const style of styles) {
      const [prop, val] = style.split(":").map(s => s.trim());
      if (prop && val) {
        const type = detectPropertyType(prop);
        properties.push({
          id: `prop-${propIndex++}`,
          name: prop,
          type,
          value: val,
          cssProperty: prop,
        });
      }
    }
  }

  // Extract common attributes
  const editableAttrs = ["id", "href", "src", "alt", "title", "placeholder"];
  for (const attr of editableAttrs) {
    if (element.attributes[attr]) {
      properties.push({
        id: `prop-${propIndex++}`,
        name: attr,
        type: "attribute",
        value: element.attributes[attr],
        attributeName: attr,
      });
    }
  }

  // Extract QWeb-specific attributes
  const qwebAttrs = Object.keys(element.attributes).filter(a => a.startsWith("t-"));
  for (const attr of qwebAttrs) {
    properties.push({
      id: `prop-${propIndex++}`,
      name: attr,
      type: "attribute",
      value: element.attributes[attr],
      attributeName: attr,
    });
  }

  return properties;
}

/** Detect property type from CSS property name */
function detectPropertyType(prop: string): PropertyType {
  const lower = prop.toLowerCase();
  if (lower.includes("color")) return "color";
  if (lower.includes("font")) return "font";
  if (lower.includes("margin") || lower.includes("padding")) return "spacing";
  if (lower.includes("border")) return "border";
  if (lower.includes("shadow")) return "shadow";
  if (lower.includes("width") || lower.includes("height")) return "size";
  if (lower.includes("display") || lower.includes("visibility") || lower.includes("opacity")) return "visibility";
  return "text";
}

/** Create initial state */
function createInitialState(): VisualEditorState {
  return {
    selection: null,
    multiSelection: [],
    pendingEdits: [],
    undoStack: [],
    redoStack: [],
    isActive: false,
    hoveredElementId: null,
  };
}

// =============================================================================
// VisualEditor Class
// =============================================================================

/**
 * VisualEditor manages element selection and property editing in visual mode.
 *
 * Usage:
 * ```ts
 * const editor = new VisualEditor();
 *
 * // Activate visual editing
 * editor.activate();
 *
 * // Select an element
 * editor.selectElement('elem-5');
 *
 * // Edit a property
 * editor.setProperty('prop-0', 'red');
 *
 * // Apply changes to source
 * await editor.applyPendingEdits();
 *
 * // Listen for changes
 * editor.on((event) => {
 *   if (event.type === 'property_changed') {
 *     console.log('Property changed:', event.propertyId, event.value);
 *   }
 * });
 * ```
 */
export class VisualEditor {
  private config: VisualEditorConfig;
  private state: VisualEditorState;
  private mapper: SourceMapper;
  private listeners: Set<VisualEditorEventListener> = new Set();
  private sourceUpdater: SourceUpdateFn | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: Partial<VisualEditorConfig> = {}, mapper?: SourceMapper) {
    this.config = { ...DEFAULT_VISUAL_EDITOR_CONFIG, ...config };
    this.state = createInitialState();
    this.mapper = mapper || getSourceMapper();
  }

  // ---------------------------------------------------------------------------
  // Activation
  // ---------------------------------------------------------------------------

  /** Activate visual editing mode */
  activate(): void {
    if (this.state.isActive) return;

    // Switch to visual mode
    const modeManager = getModeManager();
    if (modeManager.getMode() !== "visual") {
      modeManager.toVisualMode("system");
    }

    this.state.isActive = true;
    this.emit({ type: "activated", timestamp: Date.now() });
  }

  /** Deactivate visual editing mode */
  deactivate(): void {
    if (!this.state.isActive) return;

    // Clear selection
    this.clearSelection();

    this.state.isActive = false;
    this.emit({ type: "deactivated", timestamp: Date.now() });
  }

  /** Check if editor is active */
  isActive(): boolean {
    return this.state.isActive;
  }

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------

  /**
   * Select an element by its ID.
   *
   * @param elementId - Element ID from SourceMapper
   * @returns Selected element info or null
   */
  selectElement(elementId: string): SelectedElement | null {
    const element = this.mapper.getElement(elementId);
    if (!element) return null;

    const properties = extractProperties(element);
    const selection: SelectedElement = {
      element,
      properties,
    };

    // Clear multi-selection if not allowed
    if (!this.config.allowMultiSelect) {
      this.state.multiSelection = [];
    }

    this.state.selection = selection;
    this.emit({
      type: "selection_changed",
      elementId,
      timestamp: Date.now(),
    });

    return selection;
  }

  /**
   * Add element to multi-selection.
   */
  addToSelection(elementId: string): SelectedElement | null {
    if (!this.config.allowMultiSelect) {
      return this.selectElement(elementId);
    }

    const element = this.mapper.getElement(elementId);
    if (!element) return null;

    const properties = extractProperties(element);
    const selection: SelectedElement = {
      element,
      properties,
    };

    // Check if already selected
    const existing = this.state.multiSelection.find(
      s => s.element.id === elementId
    );
    if (!existing) {
      this.state.multiSelection.push(selection);
    }

    // Set as primary selection
    this.state.selection = selection;
    this.emit({
      type: "selection_changed",
      elementId,
      timestamp: Date.now(),
    });

    return selection;
  }

  /** Clear current selection */
  clearSelection(): void {
    this.state.selection = null;
    this.state.multiSelection = [];
    this.emit({
      type: "selection_changed",
      timestamp: Date.now(),
    });
  }

  /** Get current selection */
  getSelection(): SelectedElement | null {
    return this.state.selection;
  }

  /** Get multi-selection */
  getMultiSelection(): SelectedElement[] {
    return [...this.state.multiSelection];
  }

  // ---------------------------------------------------------------------------
  // Hover
  // ---------------------------------------------------------------------------

  /** Set hover element */
  setHoveredElement(elementId: string | null): void {
    if (this.state.hoveredElementId === elementId) return;

    this.state.hoveredElementId = elementId;
    this.emit({
      type: "hover_changed",
      elementId: elementId || undefined,
      timestamp: Date.now(),
    });
  }

  /** Get hovered element ID */
  getHoveredElementId(): string | null {
    return this.state.hoveredElementId;
  }

  // ---------------------------------------------------------------------------
  // Property Editing
  // ---------------------------------------------------------------------------

  /**
   * Set a property value.
   *
   * @param propertyId - Property ID
   * @param value - New value
   * @returns true if edit was recorded
   */
  setProperty(propertyId: string, value: string): boolean {
    if (!this.state.selection) return false;

    const property = this.state.selection.properties.find(p => p.id === propertyId);
    if (!property) return false;

    const oldValue = property.value;
    if (oldValue === value) return false;

    // Create edit
    const edit: VisualEdit = {
      id: generateEditId(),
      elementId: this.state.selection.element.id,
      propertyId,
      oldValue,
      newValue: value,
      timestamp: Date.now(),
      applied: false,
    };

    // Update property in memory
    property.value = value;

    // Add to pending edits
    this.state.pendingEdits.push(edit);

    // Clear redo stack (new edit invalidates redo)
    this.state.redoStack = [];

    this.emit({
      type: "property_changed",
      elementId: this.state.selection.element.id,
      propertyId,
      value,
      timestamp: Date.now(),
    });

    // Auto-apply if configured
    if (this.config.autoApply) {
      this.scheduleApply();
    }

    return true;
  }

  /**
   * Get a property value.
   */
  getProperty(propertyId: string): string | undefined {
    if (!this.state.selection) return undefined;
    const property = this.state.selection.properties.find(p => p.id === propertyId);
    return property?.value;
  }

  /** Get all editable properties for current selection */
  getProperties(): EditableProperty[] {
    return this.state.selection?.properties || [];
  }

  /** Get pending edits count */
  getPendingEditCount(): number {
    return this.state.pendingEdits.length;
  }

  // ---------------------------------------------------------------------------
  // Apply / Revert
  // ---------------------------------------------------------------------------

  /** Set the source updater function */
  setSourceUpdater(updater: SourceUpdateFn): void {
    this.sourceUpdater = updater;
  }

  /**
   * Apply pending edits to source files.
   *
   * @returns Number of edits applied
   */
  async applyPendingEdits(): Promise<number> {
    if (this.state.pendingEdits.length === 0) return 0;
    if (!this.sourceUpdater) {
      console.warn("[VisualEditor] No source updater configured");
      return 0;
    }

    const edits = [...this.state.pendingEdits];
    let appliedCount = 0;

    for (const edit of edits) {
      const element = this.mapper.getElement(edit.elementId);
      if (!element) continue;

      const property = this.state.selection?.properties.find(
        p => p.id === edit.propertyId
      );

      try {
        const success = await this.sourceUpdater(
          element.file,
          element.range.start.line,
          element.range.start.column,
          edit.oldValue,
          edit.newValue
        );

        if (success) {
          edit.applied = true;
          appliedCount++;
        }
      } catch (error) {
        console.error("[VisualEditor] Failed to apply edit:", error);
      }
    }

    // Move applied edits to undo stack as a batch
    const appliedEdits = this.state.pendingEdits.filter(e => e.applied);
    if (appliedEdits.length > 0) {
      const batch: EditBatch = {
        id: generateBatchId(),
        edits: appliedEdits,
        description: `Applied ${appliedEdits.length} edit(s)`,
        timestamp: Date.now(),
      };

      this.state.undoStack.push(batch);

      // Trim undo stack if needed
      while (this.state.undoStack.length > this.config.maxUndoDepth) {
        this.state.undoStack.shift();
      }
    }

    // Clear applied edits from pending
    this.state.pendingEdits = this.state.pendingEdits.filter(e => !e.applied);

    this.emit({
      type: "edit_applied",
      timestamp: Date.now(),
    });

    return appliedCount;
  }

  /** Discard pending edits */
  discardPendingEdits(): void {
    // Revert property values
    for (const edit of this.state.pendingEdits) {
      const property = this.state.selection?.properties.find(
        p => p.id === edit.propertyId
      );
      if (property) {
        property.value = edit.oldValue;
      }
    }

    this.state.pendingEdits = [];
  }

  /** Schedule apply with debounce */
  private scheduleApply(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.applyPendingEdits();
    }, this.config.debounceDelay);
  }

  // ---------------------------------------------------------------------------
  // Undo / Redo
  // ---------------------------------------------------------------------------

  /** Check if undo is available */
  canUndo(): boolean {
    return this.state.undoStack.length > 0;
  }

  /** Check if redo is available */
  canRedo(): boolean {
    return this.state.redoStack.length > 0;
  }

  /**
   * Undo last edit batch.
   *
   * @returns true if undo was performed
   */
  async undo(): Promise<boolean> {
    if (!this.canUndo()) return false;

    const batch = this.state.undoStack.pop();
    if (!batch) return false;

    // Revert edits in reverse order
    for (let i = batch.edits.length - 1; i >= 0; i--) {
      const edit = batch.edits[i];

      // Revert property value
      if (this.state.selection?.element.id === edit.elementId) {
        const property = this.state.selection.properties.find(
          p => p.id === edit.propertyId
        );
        if (property) {
          property.value = edit.oldValue;
        }
      }

      // Apply revert to source if updater available
      if (this.sourceUpdater) {
        const element = this.mapper.getElement(edit.elementId);
        if (element) {
          await this.sourceUpdater(
            element.file,
            element.range.start.line,
            element.range.start.column,
            edit.newValue,
            edit.oldValue
          );
        }
      }
    }

    // Move to redo stack
    this.state.redoStack.push(batch);

    this.emit({
      type: "edit_reverted",
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Redo last undone batch.
   *
   * @returns true if redo was performed
   */
  async redo(): Promise<boolean> {
    if (!this.canRedo()) return false;

    const batch = this.state.redoStack.pop();
    if (!batch) return false;

    // Re-apply edits
    for (const edit of batch.edits) {
      // Re-apply property value
      if (this.state.selection?.element.id === edit.elementId) {
        const property = this.state.selection.properties.find(
          p => p.id === edit.propertyId
        );
        if (property) {
          property.value = edit.newValue;
        }
      }

      // Apply to source if updater available
      if (this.sourceUpdater) {
        const element = this.mapper.getElement(edit.elementId);
        if (element) {
          await this.sourceUpdater(
            element.file,
            element.range.start.line,
            element.range.start.column,
            edit.oldValue,
            edit.newValue
          );
        }
      }
    }

    // Move back to undo stack
    this.state.undoStack.push(batch);

    this.emit({
      type: "edit_applied",
      timestamp: Date.now(),
    });

    return true;
  }

  // ---------------------------------------------------------------------------
  // State Access
  // ---------------------------------------------------------------------------

  /** Get current state */
  getState(): VisualEditorState {
    return { ...this.state };
  }

  /** Get configuration */
  getConfig(): VisualEditorConfig {
    return { ...this.config };
  }

  /** Update configuration */
  setConfig(config: Partial<VisualEditorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ---------------------------------------------------------------------------
  // Event System
  // ---------------------------------------------------------------------------

  /** Subscribe to events */
  on(listener: VisualEditorEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Unsubscribe from events */
  off(listener: VisualEditorEventListener): void {
    this.listeners.delete(listener);
  }

  private emit(event: VisualEditorEvent): void {
    const listenersArray: VisualEditorEventListener[] = [];
    this.listeners.forEach(l => listenersArray.push(l));

    for (const listener of listenersArray) {
      try {
        listener(event);
      } catch (error) {
        console.error("[VisualEditor] Listener error:", error);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /** Reset editor state */
  reset(): void {
    this.clearSelection();
    this.state = createInitialState();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /** Clear listeners */
  clearListeners(): void {
    this.listeners.clear();
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let _instance: VisualEditor | null = null;

/** Get the global VisualEditor instance */
export function getVisualEditor(): VisualEditor {
  if (!_instance) {
    _instance = new VisualEditor();
  }
  return _instance;
}

/** Reset the global VisualEditor instance */
export function resetVisualEditor(): void {
  if (_instance) {
    _instance.reset();
    _instance.clearListeners();
    _instance = null;
  }
  resetVisualEditorCounters();
}
