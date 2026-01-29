/**
 * SelectMode — Visual element selection mode for preview iframe.
 *
 * Enables a toggle-able selection mode where clicking elements in the preview
 * highlights them and emits selection events. When disabled, normal click
 * behavior is restored.
 *
 * Features:
 * - Toggle button state management
 * - Cursor changes (crosshair in select mode)
 * - Hover highlighting with outline
 * - Click-to-select with event emission
 * - Keyboard shortcut support (Escape to exit)
 */

// =============================================================================
// Types
// =============================================================================

/** Selection mode state */
export type SelectModeState = "disabled" | "enabled" | "selecting";

/** Selected element information */
export interface SelectedElement {
  /** Element's data-snippet-id if present */
  snippetId: string | null;
  /** Element's data-element-id if present */
  elementId: string | null;
  /** Element tag name */
  tagName: string;
  /** Element's class list */
  classes: string[];
  /** Bounding rect relative to viewport */
  bounds: DOMRect;
  /** XPath or CSS selector to identify element */
  selector: string;
}

/** Event emitted when selection changes */
export interface SelectionEvent {
  type: "select" | "deselect" | "hover" | "unhover";
  element: SelectedElement | null;
  timestamp: number;
}

/** Options for SelectMode */
export interface SelectModeOptions {
  /** CSS selector for selectable elements (default: "[data-snippet-id], [data-element-id], section, [data-snippet]") */
  selectableSelector?: string;
  /** Highlight color for hover (default: "#3b82f6") */
  highlightColor?: string;
  /** Highlight color for selected (default: "#10b981") */
  selectedColor?: string;
  /** Whether to prevent default click behavior in select mode (default: true) */
  preventDefault?: boolean;
  /** Keyboard shortcut to toggle (default: "Escape" to disable) */
  escapeToDisable?: boolean;
}

/** Callback for selection events */
export type SelectionCallback = (event: SelectionEvent) => void;

// =============================================================================
// SelectModeController Class
// =============================================================================

/**
 * Controls selection mode state and behavior.
 *
 * @example
 * ```typescript
 * const controller = new SelectModeController();
 * controller.onSelection((event) => {
 *   if (event.type === 'select') {
 *     console.log('Selected:', event.element?.snippetId);
 *   }
 * });
 *
 * controller.enable();  // Enter select mode
 * controller.disable(); // Exit select mode
 * controller.toggle();  // Toggle state
 * ```
 */
export class SelectModeController {
  private state: SelectModeState = "disabled";
  private selectedElement: SelectedElement | null = null;
  private hoveredElement: SelectedElement | null = null;
  private callbacks: Set<SelectionCallback> = new Set();
  private options: Required<SelectModeOptions>;

  constructor(options: SelectModeOptions = {}) {
    this.options = {
      selectableSelector: options.selectableSelector ?? "[data-snippet-id], [data-element-id], section, [data-snippet]",
      highlightColor: options.highlightColor ?? "#3b82f6",
      selectedColor: options.selectedColor ?? "#10b981",
      preventDefault: options.preventDefault ?? true,
      escapeToDisable: options.escapeToDisable ?? true,
    };
  }

  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------

  /** Gets current selection mode state */
  getState(): SelectModeState {
    return this.state;
  }

  /** Checks if selection mode is enabled */
  isEnabled(): boolean {
    return this.state !== "disabled";
  }

  /** Enables selection mode */
  enable(): void {
    if (this.state === "disabled") {
      this.state = "enabled";
    }
  }

  /** Disables selection mode and clears selection */
  disable(): void {
    if (this.state !== "disabled") {
      this.clearSelection();
      this.clearHover();
      this.state = "disabled";
    }
  }

  /** Toggles selection mode */
  toggle(): boolean {
    if (this.state === "disabled") {
      this.enable();
    } else {
      this.disable();
    }
    return this.isEnabled();
  }

  // ---------------------------------------------------------------------------
  // Selection Management
  // ---------------------------------------------------------------------------

  /** Gets currently selected element */
  getSelected(): SelectedElement | null {
    return this.selectedElement;
  }

  /** Gets currently hovered element */
  getHovered(): SelectedElement | null {
    return this.hoveredElement;
  }

  /** Selects an element */
  select(element: SelectedElement): void {
    if (this.state === "disabled") return;

    this.selectedElement = element;
    this.state = "selecting";
    this.emit({ type: "select", element, timestamp: Date.now() });
  }

  /** Clears the current selection */
  clearSelection(): void {
    if (this.selectedElement) {
      this.emit({ type: "deselect", element: this.selectedElement, timestamp: Date.now() });
      this.selectedElement = null;
    }
    if (this.state === "selecting") {
      this.state = "enabled";
    }
  }

  /** Sets hovered element */
  setHover(element: SelectedElement): void {
    if (this.state === "disabled") return;
    if (this.hoveredElement?.selector === element.selector) return;

    this.hoveredElement = element;
    this.emit({ type: "hover", element, timestamp: Date.now() });
  }

  /** Clears hover state */
  clearHover(): void {
    if (this.hoveredElement) {
      this.emit({ type: "unhover", element: this.hoveredElement, timestamp: Date.now() });
      this.hoveredElement = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Event Handling
  // ---------------------------------------------------------------------------

  /** Registers a selection callback */
  onSelection(callback: SelectionCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /** Emits a selection event to all callbacks */
  private emit(event: SelectionEvent): void {
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (e) {
        console.error("SelectMode callback error:", e);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  /** Gets the selectable element selector */
  getSelectableSelector(): string {
    return this.options.selectableSelector;
  }

  /** Gets highlight color for hover */
  getHighlightColor(): string {
    return this.options.highlightColor;
  }

  /** Gets highlight color for selected */
  getSelectedColor(): string {
    return this.options.selectedColor;
  }

  /** Whether to prevent default in select mode */
  shouldPreventDefault(): boolean {
    return this.options.preventDefault;
  }

  /** Whether Escape key disables select mode */
  shouldEscapeDisable(): boolean {
    return this.options.escapeToDisable;
  }
}

// =============================================================================
// DOM Element Extraction
// =============================================================================

/**
 * Extracts SelectedElement info from a DOM element.
 */
export function extractElementInfo(element: Element): SelectedElement {
  const rect = element.getBoundingClientRect();

  return {
    snippetId: element.getAttribute("data-snippet-id"),
    elementId: element.getAttribute("data-element-id"),
    tagName: element.tagName.toLowerCase(),
    classes: Array.from(element.classList),
    bounds: rect,
    selector: generateSelector(element),
  };
}

/**
 * Generates a unique CSS selector for an element.
 */
export function generateSelector(element: Element): string {
  // Prefer data attributes for uniqueness
  const snippetId = element.getAttribute("data-snippet-id");
  if (snippetId) return `[data-snippet-id="${snippetId}"]`;

  const elementId = element.getAttribute("data-element-id");
  if (elementId) return `[data-element-id="${elementId}"]`;

  const id = element.getAttribute("id");
  if (id) return `#${id}`;

  // Fall back to path-based selector
  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector = `#${current.id}`;
      path.unshift(selector);
      break;
    }

    const parent: Element | null = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c: Element) => c.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    current = parent;
  }

  return path.join(" > ");
}

/**
 * Finds the closest selectable ancestor of an element.
 */
export function findSelectableAncestor(
  element: Element,
  selector: string
): Element | null {
  return element.closest(selector);
}

// =============================================================================
// Iframe Injection Script
// =============================================================================

/**
 * Script to inject into the preview iframe for select mode functionality.
 * Handles mouse events, cursor changes, and postMessage communication.
 */
export const SELECT_MODE_SCRIPT = `
<script>
(function() {
  var selectMode = {
    enabled: false,
    selector: '[data-snippet-id], [data-element-id], section, [data-snippet]',
    highlightColor: '#3b82f6',
    selectedColor: '#10b981',
    hoveredEl: null,
    selectedEl: null
  };

  // Inject styles
  var style = document.createElement('style');
  style.id = 'platxa-select-mode-styles';
  style.textContent = [
    '.platxa-select-mode { cursor: crosshair !important; }',
    '.platxa-select-mode * { cursor: crosshair !important; }',
    '.platxa-select-hover {',
    '  outline: 2px dashed ' + selectMode.highlightColor + ' !important;',
    '  outline-offset: 2px;',
    '  background-color: rgba(59, 130, 246, 0.05) !important;',
    '}',
    '.platxa-select-selected {',
    '  outline: 2px solid ' + selectMode.selectedColor + ' !important;',
    '  outline-offset: 2px;',
    '  background-color: rgba(16, 185, 129, 0.05) !important;',
    '}'
  ].join('\\n');
  document.head.appendChild(style);

  function findSelectable(el) {
    while (el && el !== document.body) {
      if (el.matches && el.matches(selectMode.selector)) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function getElementInfo(el) {
    if (!el) return null;
    var rect = el.getBoundingClientRect();
    return {
      snippetId: el.getAttribute('data-snippet-id'),
      elementId: el.getAttribute('data-element-id'),
      tagName: el.tagName.toLowerCase(),
      classes: Array.from(el.classList).filter(function(c) {
        return !c.startsWith('platxa-select');
      }),
      bounds: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      selector: el.getAttribute('data-snippet-id')
        ? '[data-snippet-id="' + el.getAttribute('data-snippet-id') + '"]'
        : el.getAttribute('data-element-id')
          ? '[data-element-id="' + el.getAttribute('data-element-id') + '"]'
          : el.tagName.toLowerCase()
    };
  }

  function clearHover() {
    if (selectMode.hoveredEl) {
      selectMode.hoveredEl.classList.remove('platxa-select-hover');
      window.parent.postMessage({
        type: 'platxa:select-unhover',
        element: getElementInfo(selectMode.hoveredEl)
      }, '*');
      selectMode.hoveredEl = null;
    }
  }

  function clearSelection() {
    if (selectMode.selectedEl) {
      selectMode.selectedEl.classList.remove('platxa-select-selected');
      window.parent.postMessage({
        type: 'platxa:select-deselect',
        element: getElementInfo(selectMode.selectedEl)
      }, '*');
      selectMode.selectedEl = null;
    }
  }

  function handleMouseMove(e) {
    if (!selectMode.enabled) return;

    var target = findSelectable(e.target);

    if (target !== selectMode.hoveredEl) {
      clearHover();
      if (target && target !== selectMode.selectedEl) {
        selectMode.hoveredEl = target;
        target.classList.add('platxa-select-hover');
        window.parent.postMessage({
          type: 'platxa:select-hover',
          element: getElementInfo(target)
        }, '*');
      }
    }
  }

  function handleClick(e) {
    if (!selectMode.enabled) return;

    e.preventDefault();
    e.stopPropagation();

    var target = findSelectable(e.target);
    if (!target) return;

    clearHover();

    if (target === selectMode.selectedEl) {
      clearSelection();
    } else {
      clearSelection();
      selectMode.selectedEl = target;
      target.classList.add('platxa-select-selected');
      window.parent.postMessage({
        type: 'platxa:select-select',
        element: getElementInfo(target)
      }, '*');
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape' && selectMode.enabled) {
      window.parent.postMessage({ type: 'platxa:select-escape' }, '*');
    }
  }

  function enableSelectMode() {
    selectMode.enabled = true;
    document.body.classList.add('platxa-select-mode');
  }

  function disableSelectMode() {
    selectMode.enabled = false;
    document.body.classList.remove('platxa-select-mode');
    clearHover();
    clearSelection();
  }

  // Listen for commands from parent
  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;

    switch (e.data.type) {
      case 'platxa:select-mode-enable':
        enableSelectMode();
        break;
      case 'platxa:select-mode-disable':
        disableSelectMode();
        break;
      case 'platxa:select-mode-toggle':
        if (selectMode.enabled) {
          disableSelectMode();
        } else {
          enableSelectMode();
        }
        window.parent.postMessage({
          type: 'platxa:select-mode-state',
          enabled: selectMode.enabled
        }, '*');
        break;
      case 'platxa:select-mode-config':
        if (e.data.selector) selectMode.selector = e.data.selector;
        if (e.data.highlightColor) selectMode.highlightColor = e.data.highlightColor;
        if (e.data.selectedColor) selectMode.selectedColor = e.data.selectedColor;
        break;
    }
  });

  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);

  // Notify parent that select mode is ready
  window.parent.postMessage({ type: 'platxa:select-mode-ready' }, '*');
})();
</script>`;

// =============================================================================
// Iframe Bridge
// =============================================================================

/**
 * Creates a bridge to control select mode in an iframe.
 */
export function createSelectModeBridge(
  iframe: HTMLIFrameElement,
  controller: SelectModeController
): { dispose: () => void } {
  const handleMessage = (event: MessageEvent) => {
    if (!event.data?.type?.startsWith("platxa:select")) return;

    switch (event.data.type) {
      case "platxa:select-mode-ready":
        // Send initial config
        iframe.contentWindow?.postMessage({
          type: "platxa:select-mode-config",
          selector: controller.getSelectableSelector(),
          highlightColor: controller.getHighlightColor(),
          selectedColor: controller.getSelectedColor(),
        }, "*");
        break;

      case "platxa:select-hover":
        if (event.data.element) {
          controller.setHover(event.data.element);
        }
        break;

      case "platxa:select-unhover":
        controller.clearHover();
        break;

      case "platxa:select-select":
        if (event.data.element) {
          controller.select(event.data.element);
        }
        break;

      case "platxa:select-deselect":
        controller.clearSelection();
        break;

      case "platxa:select-escape":
        if (controller.shouldEscapeDisable()) {
          controller.disable();
          iframe.contentWindow?.postMessage({
            type: "platxa:select-mode-disable",
          }, "*");
        }
        break;

      case "platxa:select-mode-state":
        // Sync state if needed
        break;
    }
  };

  window.addEventListener("message", handleMessage);

  // Sync controller state changes to iframe
  const unsubscribe = controller.onSelection(() => {
    if (controller.isEnabled()) {
      iframe.contentWindow?.postMessage({ type: "platxa:select-mode-enable" }, "*");
    } else {
      iframe.contentWindow?.postMessage({ type: "platxa:select-mode-disable" }, "*");
    }
  });

  return {
    dispose: () => {
      window.removeEventListener("message", handleMessage);
      unsubscribe();
    },
  };
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a SelectModeController with optional initial state.
 */
export function createSelectMode(
  options?: SelectModeOptions & { initiallyEnabled?: boolean }
): SelectModeController {
  const controller = new SelectModeController(options);
  if (options?.initiallyEnabled) {
    controller.enable();
  }
  return controller;
}
