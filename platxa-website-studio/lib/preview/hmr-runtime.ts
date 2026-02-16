/**
 * HMR Runtime — Injected script providing Hot Module Replacement capabilities.
 *
 * Exposes a `__PLATXA_HMR__` global object in the iframe with methods for:
 * - CSS injection and updates
 * - Snippet HTML updates with morphdom diffing
 * - Select mode toggling
 * - Communication with parent window
 */

// =============================================================================
// Types
// =============================================================================

/** HMR runtime API exposed as window.__PLATXA_HMR__ */
export interface PlatxaHMRRuntime {
  /** Injects or updates CSS styles */
  injectCss: (css: string, id?: string) => void;
  /** Updates a snippet's HTML content */
  updateSnippet: (snippetId: string, html: string) => boolean;
  /** Enables select mode for element selection */
  enableSelectMode: () => void;
  /** Disables select mode */
  disableSelectMode: () => void;
  /** Toggles select mode */
  toggleSelectMode: () => boolean;
  /** Checks if select mode is enabled */
  isSelectModeEnabled: () => boolean;
  /** Gets the current version */
  version: string;
  /** Checks if HMR is ready */
  ready: boolean;
}

/** Configuration for the HMR runtime */
export interface HMRRuntimeConfig {
  /** Enable debug logging (default: false) */
  debug?: boolean;
  /** Enable morphdom for HTML diffing (default: true) */
  useMorphdom?: boolean;
  /** CSS style element ID prefix (default: "platxa-hmr-style") */
  styleIdPrefix?: string;
  /** Select mode highlight color (default: "#3b82f6") */
  selectHighlightColor?: string;
  /** Selected element color (default: "#10b981") */
  selectedColor?: string;
}

/** Message types for parent-iframe communication */
export type HMRMessageType =
  | "platxa:hmr-ready"
  | "platxa:hmr-css-injected"
  | "platxa:hmr-snippet-updated"
  | "platxa:hmr-select-mode-changed"
  | "platxa:hmr-element-selected"
  | "platxa:hmr-element-hovered"
  | "platxa:hmr-error";

/** Message sent from HMR runtime to parent */
export interface HMRMessage {
  type: HMRMessageType;
  payload?: unknown;
  timestamp: number;
}

// =============================================================================
// HMR Runtime Script Generator
// =============================================================================

/**
 * Generates the HMR runtime script to inject into the iframe.
 */
export function generateHMRRuntimeScript(config: HMRRuntimeConfig = {}): string {
  const debug = config.debug ?? false;
  const useMorphdom = config.useMorphdom ?? true;
  const styleIdPrefix = config.styleIdPrefix ?? "platxa-hmr-style";
  const selectHighlightColor = config.selectHighlightColor ?? "#3b82f6";
  const selectedColor = config.selectedColor ?? "#10b981";

  return `
<script>
(function() {
  'use strict';

  var config = {
    debug: ${debug},
    useMorphdom: ${useMorphdom},
    styleIdPrefix: '${styleIdPrefix}',
    selectHighlightColor: '${selectHighlightColor}',
    selectedColor: '${selectedColor}'
  };

  var state = {
    selectModeEnabled: false,
    hoveredElement: null,
    selectedElement: null,
    styleElements: new Map()
  };

  function log() {
    if (config.debug) {
      console.log.apply(console, ['[PLATXA_HMR]'].concat(Array.from(arguments)));
    }
  }

  function postMessage(type, payload) {
    window.parent.postMessage({
      type: type,
      payload: payload,
      timestamp: Date.now()
    }, '*');
  }

  // ---------------------------------------------------------------------------
  // CSS Injection
  // ---------------------------------------------------------------------------

  function injectCss(css, id) {
    var styleId = id || (config.styleIdPrefix + '-' + Date.now());
    var existing = document.getElementById(styleId);

    if (existing) {
      existing.textContent = css;
      log('Updated CSS:', styleId);
    } else {
      var style = document.createElement('style');
      style.id = styleId;
      style.textContent = css;
      document.head.appendChild(style);
      state.styleElements.set(styleId, style);
      log('Injected CSS:', styleId);
    }

    postMessage('platxa:hmr-css-injected', { id: styleId, length: css.length });
  }

  // ---------------------------------------------------------------------------
  // Snippet Updates
  // ---------------------------------------------------------------------------

  function updateSnippet(snippetId, html) {
    var selector = '[data-snippet-id="' + snippetId + '"]';
    var element = document.querySelector(selector);

    if (!element) {
      log('Snippet not found:', snippetId);
      postMessage('platxa:hmr-error', { error: 'Snippet not found', snippetId: snippetId });
      return false;
    }

    try {
      if (config.useMorphdom && typeof morphdom !== 'undefined') {
        // Use morphdom for efficient DOM diffing
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var newElement = doc.body.firstElementChild;
        if (newElement) {
          morphdom(element, newElement, {
            onBeforeElUpdated: function(fromEl, toEl) {
              // Preserve focus state
              if (fromEl === document.activeElement) {
                return false;
              }
              return true;
            }
          });
        }
      } else {
        // Fallback to safe DOM replacement
        var fallbackDoc = new DOMParser().parseFromString(html, 'text/html');
        var replacement = fallbackDoc.body.firstElementChild;
        if (replacement) {
          element.replaceWith(replacement);
        }
      }

      log('Updated snippet:', snippetId);
      postMessage('platxa:hmr-snippet-updated', { snippetId: snippetId, success: true });
      return true;
    } catch (e) {
      log('Error updating snippet:', e);
      postMessage('platxa:hmr-error', { error: e.message, snippetId: snippetId });
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Select Mode
  // ---------------------------------------------------------------------------

  function injectSelectModeStyles() {
    if (document.getElementById('platxa-select-mode-styles')) return;

    var style = document.createElement('style');
    style.id = 'platxa-select-mode-styles';
    style.textContent = [
      '.platxa-select-mode { cursor: crosshair !important; }',
      '.platxa-select-mode * { cursor: crosshair !important; }',
      '.platxa-select-hover {',
      '  outline: 2px dashed ' + config.selectHighlightColor + ' !important;',
      '  outline-offset: 2px;',
      '  background-color: rgba(59, 130, 246, 0.05) !important;',
      '}',
      '.platxa-select-selected {',
      '  outline: 2px solid ' + config.selectedColor + ' !important;',
      '  outline-offset: 2px;',
      '  background-color: rgba(16, 185, 129, 0.05) !important;',
      '}'
    ].join('\\n');
    document.head.appendChild(style);
  }

  function findSelectable(el) {
    var selector = '[data-snippet-id], [data-element-id], section, [data-snippet]';
    while (el && el !== document.body) {
      if (el.matches && el.matches(selector)) {
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
      bounds: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
    };
  }

  function clearHover() {
    if (state.hoveredElement) {
      state.hoveredElement.classList.remove('platxa-select-hover');
      state.hoveredElement = null;
    }
  }

  function clearSelection() {
    if (state.selectedElement) {
      state.selectedElement.classList.remove('platxa-select-selected');
      state.selectedElement = null;
    }
  }

  function handleMouseMove(e) {
    if (!state.selectModeEnabled) return;
    var target = findSelectable(e.target);
    if (target !== state.hoveredElement) {
      clearHover();
      if (target && target !== state.selectedElement) {
        state.hoveredElement = target;
        target.classList.add('platxa-select-hover');
        postMessage('platxa:hmr-element-hovered', { element: getElementInfo(target) });
      }
    }
  }

  function handleClick(e) {
    if (!state.selectModeEnabled) return;
    e.preventDefault();
    e.stopPropagation();

    var target = findSelectable(e.target);
    if (!target) return;

    clearHover();
    if (target === state.selectedElement) {
      clearSelection();
      postMessage('platxa:hmr-element-selected', { element: null });
    } else {
      clearSelection();
      state.selectedElement = target;
      target.classList.add('platxa-select-selected');
      postMessage('platxa:hmr-element-selected', { element: getElementInfo(target) });
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape' && state.selectModeEnabled) {
      disableSelectMode();
    }
  }

  function enableSelectMode() {
    if (state.selectModeEnabled) return;
    injectSelectModeStyles();
    state.selectModeEnabled = true;
    document.body.classList.add('platxa-select-mode');
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
    log('Select mode enabled');
    postMessage('platxa:hmr-select-mode-changed', { enabled: true });
  }

  function disableSelectMode() {
    if (!state.selectModeEnabled) return;
    state.selectModeEnabled = false;
    document.body.classList.remove('platxa-select-mode');
    clearHover();
    clearSelection();
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeyDown, true);
    log('Select mode disabled');
    postMessage('platxa:hmr-select-mode-changed', { enabled: false });
  }

  function toggleSelectMode() {
    if (state.selectModeEnabled) {
      disableSelectMode();
    } else {
      enableSelectMode();
    }
    return state.selectModeEnabled;
  }

  function isSelectModeEnabled() {
    return state.selectModeEnabled;
  }

  // ---------------------------------------------------------------------------
  // Message Handler
  // ---------------------------------------------------------------------------

  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;

    switch (e.data.type) {
      case 'platxa:hmr-inject-css':
        injectCss(e.data.css, e.data.id);
        break;
      case 'platxa:hmr-update-snippet':
        updateSnippet(e.data.snippetId, e.data.html);
        break;
      case 'platxa:hmr-enable-select':
        enableSelectMode();
        break;
      case 'platxa:hmr-disable-select':
        disableSelectMode();
        break;
      case 'platxa:hmr-toggle-select':
        toggleSelectMode();
        break;
    }
  });

  // ---------------------------------------------------------------------------
  // Expose Global API
  // ---------------------------------------------------------------------------

  window.__PLATXA_HMR__ = {
    injectCss: injectCss,
    updateSnippet: updateSnippet,
    enableSelectMode: enableSelectMode,
    disableSelectMode: disableSelectMode,
    toggleSelectMode: toggleSelectMode,
    isSelectModeEnabled: isSelectModeEnabled,
    version: '1.0.0',
    ready: true
  };

  log('HMR Runtime initialized');
  postMessage('platxa:hmr-ready', { version: '1.0.0' });
})();
</script>`;
}

/**
 * Default HMR runtime script with standard configuration.
 */
export const HMR_RUNTIME_SCRIPT = generateHMRRuntimeScript();

// =============================================================================
// Parent-side Controller
// =============================================================================

/**
 * Controller for managing HMR runtime in iframe from parent window.
 */
export class HMRRuntimeController {
  private iframe: HTMLIFrameElement | null = null;
  private ready = false;
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private callbacks = new Map<HMRMessageType, Set<(payload: unknown) => void>>();

  /**
   * Connects to an iframe containing the HMR runtime.
   */
  connect(iframe: HTMLIFrameElement): void {
    this.iframe = iframe;
    this.setupMessageHandler();
  }

  /**
   * Disconnects from the iframe.
   */
  disconnect(): void {
    if (this.messageHandler) {
      window.removeEventListener("message", this.messageHandler);
      this.messageHandler = null;
    }
    this.iframe = null;
    this.ready = false;
  }

  /**
   * Checks if the HMR runtime is ready.
   */
  isReady(): boolean {
    return this.ready;
  }

  /**
   * Injects CSS into the iframe.
   */
  injectCss(css: string, id?: string): void {
    this.postToIframe("platxa:hmr-inject-css", { css, id });
  }

  /**
   * Updates a snippet's HTML in the iframe.
   */
  updateSnippet(snippetId: string, html: string): void {
    this.postToIframe("platxa:hmr-update-snippet", { snippetId, html });
  }

  /**
   * Enables select mode in the iframe.
   */
  enableSelectMode(): void {
    this.postToIframe("platxa:hmr-enable-select", {});
  }

  /**
   * Disables select mode in the iframe.
   */
  disableSelectMode(): void {
    this.postToIframe("platxa:hmr-disable-select", {});
  }

  /**
   * Toggles select mode in the iframe.
   */
  toggleSelectMode(): void {
    this.postToIframe("platxa:hmr-toggle-select", {});
  }

  /**
   * Registers a callback for HMR messages.
   */
  on(type: HMRMessageType, callback: (payload: unknown) => void): () => void {
    if (!this.callbacks.has(type)) {
      this.callbacks.set(type, new Set());
    }
    this.callbacks.get(type)!.add(callback);
    return () => this.callbacks.get(type)?.delete(callback);
  }

  /**
   * Waits for the HMR runtime to be ready.
   */
  waitForReady(timeout = 5000): Promise<void> {
    if (this.ready) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const unsubscribe = this.on("platxa:hmr-ready", () => {
        unsubscribe();
        resolve();
      });

      setTimeout(() => {
        unsubscribe();
        if (!this.ready) {
          reject(new Error("HMR runtime did not become ready within timeout"));
        }
      }, timeout);
    });
  }

  private setupMessageHandler(): void {
    this.messageHandler = (event: MessageEvent) => {
      if (!event.data?.type?.startsWith("platxa:hmr")) return;

      const type = event.data.type as HMRMessageType;
      const payload = event.data.payload;

      if (type === "platxa:hmr-ready") {
        this.ready = true;
      }

      const callbacks = this.callbacks.get(type);
      if (callbacks) {
        for (const callback of callbacks) {
          try {
            callback(payload);
          } catch (e) {
            console.error("HMR callback error:", e);
          }
        }
      }
    };

    window.addEventListener("message", this.messageHandler);
  }

  private postToIframe(type: string, data: Record<string, unknown>): void {
    if (!this.iframe?.contentWindow) return;
    this.iframe.contentWindow.postMessage({ type, ...data }, "*");
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates an HMR runtime controller.
 */
export function createHMRRuntime(): HMRRuntimeController {
  return new HMRRuntimeController();
}

/**
 * Creates the HMR runtime script with custom configuration.
 */
export function createHMRRuntimeScript(config?: HMRRuntimeConfig): string {
  return generateHMRRuntimeScript(config);
}
