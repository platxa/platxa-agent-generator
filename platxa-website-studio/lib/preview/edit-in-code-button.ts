/**
 * EditInCodeButton — 'Edit in Code' button jumping to source in editor.
 *
 * Feature #84: Create 'Edit in Code' button jumping to source in editor
 * Verification: Button opens file in editor at selected element's source line
 *
 * Provides a controller for an "Edit in Code" button that, when clicked,
 * opens the source file in the editor at the line where the selected
 * element is defined. Integrates with the preview source map and editor.
 *
 * @module lib/preview/edit-in-code-button
 */

import type { EditorIntegration, NavigationResult } from "./preview-source-navigator";

// =============================================================================
// Types
// =============================================================================

/** Source location for an element */
export interface SourceLocation {
  /** File path */
  path: string;
  /** Start line (1-based) */
  startLine: number;
  /** End line (1-based) */
  endLine: number;
  /** Start column (optional) */
  startColumn?: number;
  /** End column (optional) */
  endColumn?: number;
}

/** Selected element with source information */
export interface SelectedElementSource {
  /** Element identifier (snippet ID or element ID) */
  elementId: string;
  /** Source location if available */
  source: SourceLocation | null;
  /** Element tag name */
  tagName?: string;
  /** Element snippet type (e.g., "s_banner", "s_features") */
  snippetType?: string;
}

/** Button state */
export type ButtonState = "idle" | "ready" | "navigating" | "error" | "disabled";

/** Configuration for EditInCodeButton */
export interface EditInCodeButtonOptions {
  /** Editor integration for file/line navigation */
  editor?: EditorIntegration;
  /** Callback to resolve element ID to source location */
  resolveSource?: (elementId: string) => SourceLocation | null;
  /** Whether to auto-reveal line after navigation */
  autoReveal?: boolean;
  /** Button label text */
  label?: string;
  /** Button tooltip text */
  tooltip?: string;
  /** Keyboard shortcut (e.g., "Ctrl+E") */
  shortcut?: string;
  /** Enable debug logging */
  debug?: boolean;
}

/** Current state of the button controller */
export interface EditInCodeButtonState {
  /** Current button state */
  state: ButtonState;
  /** Currently selected element */
  selectedElement: SelectedElementSource | null;
  /** Last navigation result */
  lastNavigation: NavigationResult | null;
  /** Error message if any */
  error: string | null;
  /** Whether button is enabled */
  enabled: boolean;
}

/** Event emitted when button is clicked */
export interface EditInCodeClickEvent {
  /** Element being edited */
  element: SelectedElementSource;
  /** Source location */
  source: SourceLocation;
  /** Timestamp */
  timestamp: number;
}

/** Callback for click events */
export type ClickCallback = (event: EditInCodeClickEvent) => void;

/** Callback for navigation events */
export type NavigationCallback = (result: NavigationResult) => void;

/** Callback for state changes */
export type StateChangeCallback = (state: EditInCodeButtonState) => void;

// =============================================================================
// Constants
// =============================================================================

/** Default button label */
export const DEFAULT_LABEL = "Edit in Code";

/** Default tooltip */
export const DEFAULT_TOOLTIP = "Open source file in editor";

/** Default shortcut */
export const DEFAULT_SHORTCUT = "Ctrl+E";

// =============================================================================
// EditInCodeButton Class
// =============================================================================

/**
 * Controller for an "Edit in Code" button that opens source in editor.
 *
 * @example
 * ```typescript
 * const button = new EditInCodeButton({
 *   editor: editorIntegration,
 *   resolveSource: (id) => sourceMap.get(id),
 * });
 *
 * // Select an element to edit
 * button.setSelectedElement({
 *   elementId: "snippet-1",
 *   source: { path: "template.xml", startLine: 10, endLine: 25 },
 * });
 *
 * // Trigger navigation (e.g., on button click)
 * button.click();
 *
 * // Listen for navigation
 * button.onNavigate((result) => {
 *   console.log(`Opened ${result.path}:${result.startLine}`);
 * });
 * ```
 */
export class EditInCodeButton {
  private options: Required<Omit<EditInCodeButtonOptions, "editor" | "resolveSource">> & {
    editor?: EditorIntegration;
    resolveSource?: (elementId: string) => SourceLocation | null;
  };
  private state: EditInCodeButtonState;
  private clickCallbacks = new Set<ClickCallback>();
  private navigationCallbacks = new Set<NavigationCallback>();
  private stateCallbacks = new Set<StateChangeCallback>();
  private disposed = false;

  constructor(options: EditInCodeButtonOptions = {}) {
    this.options = {
      editor: options.editor,
      resolveSource: options.resolveSource,
      autoReveal: options.autoReveal ?? true,
      label: options.label ?? DEFAULT_LABEL,
      tooltip: options.tooltip ?? DEFAULT_TOOLTIP,
      shortcut: options.shortcut ?? DEFAULT_SHORTCUT,
      debug: options.debug ?? false,
    };

    this.state = {
      state: "idle",
      selectedElement: null,
      lastNavigation: null,
      error: null,
      enabled: false,
    };

    // Set correct initial state based on configuration
    this.updateButtonState();
  }

  // ---------------------------------------------------------------------------
  // Editor Integration
  // ---------------------------------------------------------------------------

  /**
   * Sets the editor integration.
   */
  setEditor(editor: EditorIntegration): void {
    this.options.editor = editor;
    this.updateButtonState();
  }

  /**
   * Sets the source resolver function.
   */
  setSourceResolver(resolver: (elementId: string) => SourceLocation | null): void {
    this.options.resolveSource = resolver;
    this.updateButtonState();
  }

  /**
   * Checks if editor is configured.
   */
  hasEditor(): boolean {
    return this.options.editor !== undefined;
  }

  // ---------------------------------------------------------------------------
  // Element Selection
  // ---------------------------------------------------------------------------

  /**
   * Sets the currently selected element.
   */
  setSelectedElement(element: SelectedElementSource | null): void {
    this.state.selectedElement = element;
    this.state.error = null;

    // Try to resolve source if not provided
    if (element && !element.source && this.options.resolveSource) {
      const resolved = this.options.resolveSource(element.elementId);
      if (resolved) {
        this.state.selectedElement = { ...element, source: resolved };
      }
    }

    this.updateButtonState();
    this.notifyStateChange();
  }

  /**
   * Clears the selection.
   */
  clearSelection(): void {
    this.setSelectedElement(null);
  }

  /**
   * Gets the currently selected element.
   */
  getSelectedElement(): SelectedElementSource | null {
    return this.state.selectedElement;
  }

  // ---------------------------------------------------------------------------
  // Button Actions
  // ---------------------------------------------------------------------------

  /**
   * Triggers the "Edit in Code" action.
   * Opens the source file in the editor at the element's line.
   */
  click(): NavigationResult | null {
    if (this.disposed) {
      this.log("Button is disposed");
      return null;
    }

    if (!this.state.enabled) {
      this.log("Button is not enabled");
      return null;
    }

    const element = this.state.selectedElement;
    if (!element || !element.source) {
      this.log("No element or source available");
      return null;
    }

    this.log(`Navigating to ${element.source.path}:${element.source.startLine}`);

    // Update state to navigating
    this.state.state = "navigating";
    this.notifyStateChange();

    // Emit click event
    const clickEvent: EditInCodeClickEvent = {
      element,
      source: element.source,
      timestamp: Date.now(),
    };
    this.notifyClick(clickEvent);

    // Perform navigation
    const result = this.navigateToSource(element.source);

    // Update state based on result
    this.state.lastNavigation = result;
    if (result.success) {
      this.state.state = "ready";
      this.state.error = null;
    } else {
      this.state.state = "error";
      this.state.error = result.error || "Navigation failed";
    }

    this.notifyStateChange();
    this.notifyNavigation(result);

    return result;
  }

  /**
   * Checks if the button is enabled.
   */
  isEnabled(): boolean {
    return this.state.enabled;
  }

  /**
   * Gets the current button state.
   */
  getButtonState(): ButtonState {
    return this.state.state;
  }

  // ---------------------------------------------------------------------------
  // UI Properties
  // ---------------------------------------------------------------------------

  /**
   * Gets the button label.
   */
  getLabel(): string {
    return this.options.label;
  }

  /**
   * Gets the button tooltip.
   */
  getTooltip(): string {
    if (this.state.selectedElement?.source) {
      const { path, startLine } = this.state.selectedElement.source;
      const fileName = path.split("/").pop() || path;
      return `${this.options.tooltip} (${fileName}:${startLine})`;
    }
    return this.options.tooltip;
  }

  /**
   * Gets the keyboard shortcut.
   */
  getShortcut(): string {
    return this.options.shortcut;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /**
   * Gets the full button state.
   */
  getState(): EditInCodeButtonState {
    return { ...this.state };
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  /**
   * Registers a callback for click events.
   */
  onClick(callback: ClickCallback): () => void {
    this.clickCallbacks.add(callback);
    return () => this.clickCallbacks.delete(callback);
  }

  /**
   * Registers a callback for navigation events.
   */
  onNavigate(callback: NavigationCallback): () => void {
    this.navigationCallbacks.add(callback);
    return () => this.navigationCallbacks.delete(callback);
  }

  /**
   * Registers a callback for state changes.
   */
  onStateChange(callback: StateChangeCallback): () => void {
    this.stateCallbacks.add(callback);
    return () => this.stateCallbacks.delete(callback);
  }

  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

  private updateButtonState(): void {
    const hasEditor = !!this.options.editor;
    const hasElement = !!this.state.selectedElement;
    const hasSource = !!this.state.selectedElement?.source;

    if (!hasEditor) {
      this.state.state = "disabled";
      this.state.enabled = false;
    } else if (!hasElement || !hasSource) {
      this.state.state = "idle";
      this.state.enabled = false;
    } else {
      this.state.state = "ready";
      this.state.enabled = true;
    }
  }

  private navigateToSource(source: SourceLocation): NavigationResult {
    const result: NavigationResult = {
      success: false,
      path: source.path,
      startLine: source.startLine,
      endLine: source.endLine,
    };

    if (!this.options.editor) {
      result.error = "No editor integration configured";
      return result;
    }

    try {
      // Open the file
      this.options.editor.openFile(source.path);

      // Set cursor to start line
      this.options.editor.setCursorPosition(
        source.startLine,
        source.startColumn ?? 1
      );

      // Highlight the range
      this.options.editor.setSelection(
        source.startLine,
        source.endLine,
        source.startColumn ?? 1,
        source.endColumn ?? 1
      );

      // Reveal the line
      if (this.options.autoReveal) {
        this.options.editor.revealLine(source.startLine);
      }

      result.success = true;
      this.log(`Navigation successful: ${source.path}:${source.startLine}`);
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      this.log(`Navigation failed: ${result.error}`);
    }

    return result;
  }

  private notifyClick(event: EditInCodeClickEvent): void {
    for (const callback of this.clickCallbacks) {
      try {
        callback(event);
      } catch (e) {
        console.error("EditInCodeButton click callback error:", e);
      }
    }
  }

  private notifyNavigation(result: NavigationResult): void {
    for (const callback of this.navigationCallbacks) {
      try {
        callback(result);
      } catch (e) {
        console.error("EditInCodeButton navigation callback error:", e);
      }
    }
  }

  private notifyStateChange(): void {
    const state = this.getState();
    for (const callback of this.stateCallbacks) {
      try {
        callback(state);
      } catch (e) {
        console.error("EditInCodeButton state callback error:", e);
      }
    }
  }

  private log(message: string): void {
    if (this.options.debug) {
      console.log(`[EditInCodeButton] ${message}`);
    }
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
    this.clickCallbacks.clear();
    this.navigationCallbacks.clear();
    this.stateCallbacks.clear();
  }
}

// =============================================================================
// Iframe Script
// =============================================================================

/**
 * Script to inject into preview iframe for "Edit in Code" button support.
 * Adds a floating button that appears when an element is selected.
 */
export const EDIT_IN_CODE_SCRIPT = `
<script>
(function() {
  var currentElement = null;
  var button = null;

  function createButton() {
    if (button) return button;

    button = document.createElement('button');
    button.id = 'platxa-edit-in-code-btn';
    button.textContent = 'Edit in Code';
    button.style.cssText = [
      'position: fixed',
      'z-index: 999999',
      'padding: 6px 12px',
      'background: #2563eb',
      'color: white',
      'border: none',
      'border-radius: 4px',
      'font-size: 12px',
      'font-family: system-ui, sans-serif',
      'cursor: pointer',
      'box-shadow: 0 2px 8px rgba(0,0,0,0.2)',
      'display: none',
      'transition: opacity 0.15s'
    ].join(';');

    button.addEventListener('click', function(e) {
      e.stopPropagation();
      if (currentElement) {
        var sourceId = currentElement.getAttribute('data-source-id');
        var snippetId = currentElement.getAttribute('data-snippet-id');
        var elementId = currentElement.getAttribute('data-element-id') || currentElement.id;

        window.parent.postMessage({
          type: 'platxa:edit-in-code',
          sourceId: sourceId,
          snippetId: snippetId,
          elementId: elementId
        }, '*');
      }
    });

    button.addEventListener('mouseenter', function() {
      button.style.background = '#1d4ed8';
    });

    button.addEventListener('mouseleave', function() {
      button.style.background = '#2563eb';
    });

    document.body.appendChild(button);
    return button;
  }

  function showButton(element) {
    var btn = createButton();
    currentElement = element;

    var rect = element.getBoundingClientRect();
    var btnWidth = 100; // approximate
    var btnHeight = 28;

    // Position above the element, centered
    var left = rect.left + (rect.width / 2) - (btnWidth / 2);
    var top = rect.top - btnHeight - 8;

    // Keep in viewport
    if (left < 8) left = 8;
    if (left + btnWidth > window.innerWidth - 8) left = window.innerWidth - btnWidth - 8;
    if (top < 8) top = rect.bottom + 8; // Show below if no room above

    btn.style.left = left + 'px';
    btn.style.top = top + 'px';
    btn.style.display = 'block';
  }

  function hideButton() {
    if (button) {
      button.style.display = 'none';
    }
    currentElement = null;
  }

  // Listen for selection messages from parent
  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;

    switch (e.data.type) {
      case 'platxa:show-edit-button':
        var el = document.querySelector('[data-snippet-id="' + e.data.elementId + '"]') ||
                 document.querySelector('[data-element-id="' + e.data.elementId + '"]') ||
                 document.getElementById(e.data.elementId);
        if (el) showButton(el);
        break;

      case 'platxa:hide-edit-button':
        hideButton();
        break;
    }
  });

  // Notify parent that script is ready
  window.parent.postMessage({ type: 'platxa:edit-in-code-ready' }, '*');
})();
</script>`;

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates an EditInCodeButton instance.
 */
export function createEditInCodeButton(
  options?: EditInCodeButtonOptions
): EditInCodeButton {
  return new EditInCodeButton(options);
}

// =============================================================================
// Exports
// =============================================================================

export default EditInCodeButton;
