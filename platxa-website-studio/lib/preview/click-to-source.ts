/**
 * ClickToSource — Maps iframe clicks to source locations.
 *
 * When a user clicks an element in the preview iframe, this module
 * extracts the element's ID and bounding rect, posting a message
 * to the parent window for source navigation.
 *
 * Works with SourceMapper in the parent to resolve elementId → line numbers.
 */

// =============================================================================
// Types
// =============================================================================

/** Data sent when an element is clicked */
export interface ClickToSourceEvent {
  /** Element's data-element-id if present */
  elementId: string | null;
  /** Element's data-snippet-id if present */
  snippetId: string | null;
  /** Bounding rectangle of the clicked element */
  bounds: {
    top: number;
    left: number;
    width: number;
    height: number;
    right: number;
    bottom: number;
  };
  /** Tag name of the element */
  tagName: string;
  /** Click coordinates relative to viewport */
  clickPosition: {
    x: number;
    y: number;
  };
}

/** Configuration for click-to-source behavior */
export interface ClickToSourceOptions {
  /** CSS selector for source-mapped elements (default: "[data-element-id], [data-snippet-id]") */
  sourceSelector?: string;
  /** Whether to prevent default click behavior (default: false) */
  preventDefault?: boolean;
  /** Whether to stop propagation (default: false) */
  stopPropagation?: boolean;
  /** Modifier key required for click-to-source (default: none) */
  modifierKey?: "ctrl" | "meta" | "alt" | "shift" | null;
  /** Message type prefix (default: "platxa:click-to-source") */
  messageType?: string;
}

/** Callback for click-to-source events */
export type ClickToSourceCallback = (event: ClickToSourceEvent) => void;

// =============================================================================
// ClickToSourceController Class
// =============================================================================

/**
 * Controls click-to-source behavior in the parent window.
 *
 * @example
 * ```typescript
 * const controller = new ClickToSourceController();
 * controller.onClickToSource((event) => {
 *   if (event.elementId) {
 *     const location = sourceMapper.getLocation(event.elementId);
 *     editor.navigateTo(location.path, location.startLine);
 *   }
 * });
 *
 * // Connect to iframe
 * const bridge = createClickToSourceBridge(iframe, controller);
 * ```
 */
export class ClickToSourceController {
  private callbacks = new Set<ClickToSourceCallback>();
  private options: Required<ClickToSourceOptions>;
  private enabled = true;

  constructor(options: ClickToSourceOptions = {}) {
    this.options = {
      sourceSelector: options.sourceSelector ?? "[data-element-id], [data-snippet-id]",
      preventDefault: options.preventDefault ?? false,
      stopPropagation: options.stopPropagation ?? false,
      modifierKey: options.modifierKey ?? null,
      messageType: options.messageType ?? "platxa:click-to-source",
    };
  }

  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------

  /** Enables click-to-source handling */
  enable(): void {
    this.enabled = true;
  }

  /** Disables click-to-source handling */
  disable(): void {
    this.enabled = false;
  }

  /** Checks if click-to-source is enabled */
  isEnabled(): boolean {
    return this.enabled;
  }

  /** Toggles enabled state */
  toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  // ---------------------------------------------------------------------------
  // Event Handling
  // ---------------------------------------------------------------------------

  /** Registers a callback for click-to-source events */
  onClickToSource(callback: ClickToSourceCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /** Handles a click-to-source event from the iframe */
  handleEvent(event: ClickToSourceEvent): void {
    if (!this.enabled) return;

    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (e) {
        console.error("ClickToSource callback error:", e);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  /** Gets the source element selector */
  getSourceSelector(): string {
    return this.options.sourceSelector;
  }

  /** Gets the message type */
  getMessageType(): string {
    return this.options.messageType;
  }

  /** Gets the required modifier key */
  getModifierKey(): string | null {
    return this.options.modifierKey;
  }

  /** Whether to prevent default on source clicks */
  shouldPreventDefault(): boolean {
    return this.options.preventDefault;
  }

  /** Whether to stop propagation on source clicks */
  shouldStopPropagation(): boolean {
    return this.options.stopPropagation;
  }
}

// =============================================================================
// DOM Helpers
// =============================================================================

/**
 * Finds the closest ancestor with source mapping attributes.
 */
export function findSourceElement(
  element: Element,
  selector: string
): Element | null {
  return element.closest(selector);
}

/**
 * Extracts click-to-source event data from an element.
 */
export function extractClickEvent(
  element: Element,
  clickX: number,
  clickY: number
): ClickToSourceEvent {
  const rect = element.getBoundingClientRect();

  return {
    elementId: element.getAttribute("data-element-id"),
    snippetId: element.getAttribute("data-snippet-id"),
    bounds: {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      right: rect.right,
      bottom: rect.bottom,
    },
    tagName: element.tagName.toLowerCase(),
    clickPosition: {
      x: clickX,
      y: clickY,
    },
  };
}

/**
 * Checks if the required modifier key is pressed.
 */
export function checkModifierKey(
  event: MouseEvent,
  modifierKey: string | null
): boolean {
  if (!modifierKey) return true;

  switch (modifierKey) {
    case "ctrl":
      return event.ctrlKey;
    case "meta":
      return event.metaKey;
    case "alt":
      return event.altKey;
    case "shift":
      return event.shiftKey;
    default:
      return true;
  }
}

// =============================================================================
// Iframe Injection Script
// =============================================================================

/**
 * Script to inject into the preview iframe for click-to-source functionality.
 * Posts messages to parent when source-mapped elements are clicked.
 */
export const CLICK_TO_SOURCE_SCRIPT = `
<script>
(function() {
  var clickToSource = {
    enabled: true,
    selector: '[data-element-id], [data-snippet-id]',
    modifierKey: null,
    preventDefault: false,
    stopPropagation: false,
    messageType: 'platxa:click-to-source'
  };

  function findSourceElement(el) {
    while (el && el !== document.body) {
      if (el.matches && el.matches(clickToSource.selector)) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function checkModifier(e) {
    if (!clickToSource.modifierKey) return true;
    switch (clickToSource.modifierKey) {
      case 'ctrl': return e.ctrlKey;
      case 'meta': return e.metaKey;
      case 'alt': return e.altKey;
      case 'shift': return e.shiftKey;
      default: return true;
    }
  }

  function handleClick(e) {
    if (!clickToSource.enabled) return;
    if (!checkModifier(e)) return;

    var target = findSourceElement(e.target);
    if (!target) return;

    if (clickToSource.preventDefault) {
      e.preventDefault();
    }
    if (clickToSource.stopPropagation) {
      e.stopPropagation();
    }

    var rect = target.getBoundingClientRect();
    window.parent.postMessage({
      type: clickToSource.messageType,
      elementId: target.getAttribute('data-element-id'),
      snippetId: target.getAttribute('data-snippet-id'),
      bounds: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom
      },
      tagName: target.tagName.toLowerCase(),
      clickPosition: { x: e.clientX, y: e.clientY }
    }, '*');
  }

  // Listen for configuration from parent
  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;

    switch (e.data.type) {
      case 'platxa:click-to-source-enable':
        clickToSource.enabled = true;
        break;
      case 'platxa:click-to-source-disable':
        clickToSource.enabled = false;
        break;
      case 'platxa:click-to-source-config':
        if (e.data.selector) clickToSource.selector = e.data.selector;
        if (e.data.modifierKey !== undefined) clickToSource.modifierKey = e.data.modifierKey;
        if (e.data.preventDefault !== undefined) clickToSource.preventDefault = e.data.preventDefault;
        if (e.data.stopPropagation !== undefined) clickToSource.stopPropagation = e.data.stopPropagation;
        if (e.data.messageType) clickToSource.messageType = e.data.messageType;
        break;
    }
  });

  document.addEventListener('click', handleClick, true);

  // Notify parent that click-to-source is ready
  window.parent.postMessage({ type: 'platxa:click-to-source-ready' }, '*');
})();
</script>`;

// =============================================================================
// Iframe Bridge
// =============================================================================

/**
 * Creates a bridge to receive click-to-source events from an iframe.
 */
export function createClickToSourceBridge(
  iframe: HTMLIFrameElement,
  controller: ClickToSourceController
): { dispose: () => void } {
  const handleMessage = (event: MessageEvent) => {
    if (!event.data?.type) return;

    const messageType = controller.getMessageType();

    if (event.data.type === `${messageType}-ready` || event.data.type === "platxa:click-to-source-ready") {
      // Send initial configuration
      iframe.contentWindow?.postMessage({
        type: "platxa:click-to-source-config",
        selector: controller.getSourceSelector(),
        modifierKey: controller.getModifierKey(),
        preventDefault: controller.shouldPreventDefault(),
        stopPropagation: controller.shouldStopPropagation(),
        messageType: controller.getMessageType(),
      }, "*");
      return;
    }

    if (event.data.type === messageType || event.data.type === "platxa:click-to-source") {
      controller.handleEvent({
        elementId: event.data.elementId,
        snippetId: event.data.snippetId,
        bounds: event.data.bounds,
        tagName: event.data.tagName,
        clickPosition: event.data.clickPosition,
      });
    }
  };

  window.addEventListener("message", handleMessage);

  return {
    dispose: () => {
      window.removeEventListener("message", handleMessage);
    },
  };
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a ClickToSourceController with optional initial configuration.
 */
export function createClickToSource(
  options?: ClickToSourceOptions & { initiallyEnabled?: boolean }
): ClickToSourceController {
  const controller = new ClickToSourceController(options);
  if (options?.initiallyEnabled === false) {
    controller.disable();
  }
  return controller;
}
