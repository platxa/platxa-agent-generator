/**
 * QWeb Hot-Swap Module
 *
 * Uses morphdom for efficient DOM diffing to hot-swap QWeb template changes
 * without full page reload. Preserves form inputs, scroll position, and
 * focus state during updates.
 *
 * @module preview/qweb-hot-swap
 */

import morphdom from 'morphdom';

// =============================================================================
// Types
// =============================================================================

/** Options for morphdom DOM diffing */
export interface MorphdomOptions {
  /** Preserve form input values during morph */
  preserveInputs?: boolean;
  /** Preserve scroll position during morph */
  preserveScroll?: boolean;
  /** Preserve focused element during morph */
  preserveFocus?: boolean;
  /** Callback before node is discarded */
  onBeforeNodeDiscarded?: (node: Node) => boolean;
  /** Callback before element is updated */
  onBeforeElUpdated?: (fromEl: HTMLElement, toEl: HTMLElement) => boolean;
  /** Callback after element is updated */
  onElUpdated?: (el: HTMLElement) => void;
  /** Callback when node is added */
  onNodeAdded?: (node: Node) => Node;
}

/** Result of a hot-swap operation */
export interface HotSwapResult {
  /** Whether the swap was successful */
  success: boolean;
  /** Error message if failed */
  error: string | null;
  /** Duration of the swap in milliseconds */
  durationMs: number;
  /** Number of nodes updated */
  nodesUpdated: number;
  /** Whether scroll position was preserved */
  scrollPreserved: boolean;
  /** Whether focus was preserved */
  focusPreserved: boolean;
}

/** State captured before a hot-swap for restoration */
interface PreSwapState {
  scrollX: number;
  scrollY: number;
  focusedElement: Element | null;
  focusedSelector: string | null;
  inputValues: Map<string, string>;
  checkboxStates: Map<string, boolean>;
  selectValues: Map<string, string>;
}

// =============================================================================
// State Capture & Restoration
// =============================================================================

/**
 * Generate a unique selector for an element.
 */
function getUniqueSelector(el: Element): string | null {
  if (el.id) {
    return `#${el.id}`;
  }

  // Try data attributes
  const dataSourceId = el.getAttribute('data-source-id');
  if (dataSourceId) {
    return `[data-source-id="${dataSourceId}"]`;
  }

  // Try name attribute for form elements
  const name = el.getAttribute('name');
  if (name) {
    const tagName = el.tagName.toLowerCase();
    return `${tagName}[name="${name}"]`;
  }

  // Fall back to path-based selector
  const path: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      path.unshift(`#${current.id}`);
      break;
    }

    const parentEl: Element | null = current.parentElement;
    if (parentEl) {
      const currentTagName = current.tagName;
      const siblings = Array.from(parentEl.children).filter(
        (child: Element) => child.tagName === currentTagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    current = parentEl;
  }

  return path.length > 0 ? path.join(' > ') : null;
}

/**
 * Capture form input values and other state before swap.
 */
function capturePreSwapState(container: Element | Document): PreSwapState {
  const doc = container instanceof Document ? container : container.ownerDocument;
  const root = container instanceof Document ? container.documentElement : container;

  const state: PreSwapState = {
    scrollX: doc?.defaultView?.scrollX ?? 0,
    scrollY: doc?.defaultView?.scrollY ?? 0,
    focusedElement: doc?.activeElement ?? null,
    focusedSelector: doc?.activeElement ? getUniqueSelector(doc.activeElement) : null,
    inputValues: new Map(),
    checkboxStates: new Map(),
    selectValues: new Map(),
  };

  // Capture text input values
  root.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], input[type="search"], input[type="tel"], input[type="url"], textarea').forEach((el) => {
    const input = el as HTMLInputElement | HTMLTextAreaElement;
    const selector = getUniqueSelector(input);
    if (selector) {
      state.inputValues.set(selector, input.value);
    }
  });

  // Capture checkbox/radio states
  root.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach((el) => {
    const input = el as HTMLInputElement;
    const selector = getUniqueSelector(input);
    if (selector) {
      state.checkboxStates.set(selector, input.checked);
    }
  });

  // Capture select values
  root.querySelectorAll('select').forEach((el) => {
    const select = el as HTMLSelectElement;
    const selector = getUniqueSelector(select);
    if (selector) {
      state.selectValues.set(selector, select.value);
    }
  });

  return state;
}

/**
 * Restore captured state after swap.
 */
function restorePreSwapState(
  container: Element | Document,
  state: PreSwapState,
  options: { preserveInputs: boolean; preserveScroll: boolean; preserveFocus: boolean }
): { scrollPreserved: boolean; focusPreserved: boolean } {
  const doc = container instanceof Document ? container : container.ownerDocument;
  const root = container instanceof Document ? container.documentElement : container;
  let scrollPreserved = false;
  let focusPreserved = false;

  // Restore scroll position
  if (options.preserveScroll && doc?.defaultView) {
    doc.defaultView.scrollTo(state.scrollX, state.scrollY);
    scrollPreserved = true;
  }

  // Restore input values
  if (options.preserveInputs) {
    state.inputValues.forEach((value, selector) => {
      const el = root.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el && el.value !== value) {
        el.value = value;
      }
    });

    state.checkboxStates.forEach((checked, selector) => {
      const el = root.querySelector(selector) as HTMLInputElement | null;
      if (el && el.checked !== checked) {
        el.checked = checked;
      }
    });

    state.selectValues.forEach((value, selector) => {
      const el = root.querySelector(selector) as HTMLSelectElement | null;
      if (el && el.value !== value) {
        el.value = value;
      }
    });
  }

  // Restore focus
  if (options.preserveFocus && state.focusedSelector) {
    const el = root.querySelector(state.focusedSelector) as HTMLElement | null;
    if (el && typeof el.focus === 'function') {
      el.focus();
      focusPreserved = true;
    }
  }

  return { scrollPreserved, focusPreserved };
}

// =============================================================================
// Hot-Swap Core
// =============================================================================

/**
 * Hot-swap HTML content using morphdom for efficient DOM diffing.
 * Preserves form inputs, scroll position, and focus state.
 */
export function hotSwapHTML(
  target: HTMLElement,
  newHTML: string,
  options: MorphdomOptions = {}
): HotSwapResult {
  const start = performance.now();
  let nodesUpdated = 0;

  const {
    preserveInputs = true,
    preserveScroll = true,
    preserveFocus = true,
    onBeforeNodeDiscarded,
    onBeforeElUpdated,
    onElUpdated,
    onNodeAdded,
  } = options;

  try {
    // Capture state before swap
    const preSwapState = capturePreSwapState(target);

    // Create a temporary container for the new HTML
    const temp = document.createElement('div');
    temp.innerHTML = newHTML;

    // Use morphdom to efficiently diff and patch the DOM
    morphdom(target, temp, {
      childrenOnly: true,

      onBeforeNodeDiscarded: (node) => {
        if (onBeforeNodeDiscarded) {
          return onBeforeNodeDiscarded(node);
        }
        return true;
      },

      onBeforeElUpdated: (fromEl, toEl) => {
        // Skip updating form elements if preserving inputs
        if (preserveInputs) {
          const tagName = fromEl.tagName.toLowerCase();
          if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
            // Preserve the value but allow other attributes to update
            if (tagName === 'input') {
              const inputType = (fromEl as HTMLInputElement).type;
              if (inputType === 'checkbox' || inputType === 'radio') {
                (toEl as HTMLInputElement).checked = (fromEl as HTMLInputElement).checked;
              } else {
                (toEl as HTMLInputElement).value = (fromEl as HTMLInputElement).value;
              }
            } else if (tagName === 'textarea') {
              (toEl as HTMLTextAreaElement).value = (fromEl as HTMLTextAreaElement).value;
            } else if (tagName === 'select') {
              (toEl as HTMLSelectElement).value = (fromEl as HTMLSelectElement).value;
            }
          }
        }

        if (onBeforeElUpdated) {
          return onBeforeElUpdated(fromEl, toEl);
        }
        return true;
      },

      onElUpdated: (el) => {
        nodesUpdated++;
        if (onElUpdated) {
          onElUpdated(el);
        }
      },

      onNodeAdded: (node) => {
        nodesUpdated++;
        if (onNodeAdded) {
          return onNodeAdded(node);
        }
        return node;
      },
    });

    // Restore state after swap
    const { scrollPreserved, focusPreserved } = restorePreSwapState(
      target,
      preSwapState,
      { preserveInputs, preserveScroll, preserveFocus }
    );

    const durationMs = Math.round((performance.now() - start) * 100) / 100;

    return {
      success: true,
      error: null,
      durationMs,
      nodesUpdated,
      scrollPreserved,
      focusPreserved,
    };
  } catch (err) {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    const error = err instanceof Error ? err.message : String(err);

    return {
      success: false,
      error,
      durationMs,
      nodesUpdated,
      scrollPreserved: false,
      focusPreserved: false,
    };
  }
}

/**
 * Hot-swap content within an iframe using morphdom.
 * Posts a message to the iframe which handles the swap internally.
 */
export function hotSwapIframeHTML(
  iframe: HTMLIFrameElement | null,
  selector: string,
  newHTML: string,
  options: MorphdomOptions = {}
): boolean {
  if (!iframe?.contentWindow) {
    return false;
  }

  iframe.contentWindow.postMessage(
    {
      type: 'platxa:inject-html',
      selector,
      html: newHTML,
      options: {
        preserveInputs: options.preserveInputs ?? true,
        preserveScroll: options.preserveScroll ?? true,
        preserveFocus: options.preserveFocus ?? true,
      },
    },
    '*'
  );

  return true;
}

// =============================================================================
// Iframe Injection Script
// =============================================================================

/**
 * Script injected into the preview iframe that handles HTML hot-swap messages.
 * Uses morphdom for efficient DOM diffing with state preservation.
 */
export const HTML_INJECT_SCRIPT = `
<script src="https://unpkg.com/morphdom@2.7.4/dist/morphdom-umd.min.js"></script>
<script>
(function() {
  function getUniqueSelector(el) {
    if (el.id) return '#' + el.id;
    var dataSourceId = el.getAttribute('data-source-id');
    if (dataSourceId) return '[data-source-id="' + dataSourceId + '"]';
    var name = el.getAttribute('name');
    if (name) return el.tagName.toLowerCase() + '[name="' + name + '"]';
    return null;
  }

  function captureState(root) {
    var state = {
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      focusedSelector: document.activeElement ? getUniqueSelector(document.activeElement) : null,
      inputs: {}
    };

    root.querySelectorAll('input, textarea, select').forEach(function(el) {
      var selector = getUniqueSelector(el);
      if (selector) {
        if (el.type === 'checkbox' || el.type === 'radio') {
          state.inputs[selector] = { checked: el.checked };
        } else {
          state.inputs[selector] = { value: el.value };
        }
      }
    });

    return state;
  }

  function restoreState(root, state, options) {
    if (options.preserveScroll) {
      window.scrollTo(state.scrollX, state.scrollY);
    }

    if (options.preserveInputs) {
      Object.keys(state.inputs).forEach(function(selector) {
        var el = root.querySelector(selector);
        if (el) {
          if ('checked' in state.inputs[selector]) {
            el.checked = state.inputs[selector].checked;
          } else {
            el.value = state.inputs[selector].value;
          }
        }
      });
    }

    if (options.preserveFocus && state.focusedSelector) {
      var el = root.querySelector(state.focusedSelector);
      if (el && el.focus) el.focus();
    }
  }

  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'platxa:inject-html') {
      var selector = e.data.selector || 'body';
      var target = document.querySelector(selector);
      if (!target) return;

      var options = e.data.options || {};
      var preState = captureState(target);

      var temp = document.createElement('div');
      temp.innerHTML = e.data.html || '';

      if (typeof morphdom === 'function') {
        morphdom(target, temp, {
          childrenOnly: true,
          onBeforeElUpdated: function(fromEl, toEl) {
            if (options.preserveInputs) {
              var tag = fromEl.tagName.toLowerCase();
              if (tag === 'input' || tag === 'textarea' || tag === 'select') {
                if (fromEl.type === 'checkbox' || fromEl.type === 'radio') {
                  toEl.checked = fromEl.checked;
                } else {
                  toEl.value = fromEl.value;
                }
              }
            }
            return true;
          }
        });
      } else {
        target.innerHTML = e.data.html || '';
      }

      restoreState(target, preState, options);

      window.parent.postMessage({ type: 'platxa:html-swapped', selector: selector }, '*');
    }
  });
})();
</script>`;

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a hot-swap handler for a specific target element.
 */
export function createHotSwapper(
  target: HTMLElement,
  defaultOptions: MorphdomOptions = {}
) {
  return {
    swap: (html: string, options?: MorphdomOptions) =>
      hotSwapHTML(target, html, { ...defaultOptions, ...options }),

    getTarget: () => target,
  };
}

/**
 * Create a hot-swap handler for an iframe.
 */
export function createIframeHotSwapper(
  iframe: HTMLIFrameElement,
  defaultSelector = 'body',
  defaultOptions: MorphdomOptions = {}
) {
  return {
    swap: (html: string, selector?: string, options?: MorphdomOptions) =>
      hotSwapIframeHTML(
        iframe,
        selector ?? defaultSelector,
        html,
        { ...defaultOptions, ...options }
      ),

    getIframe: () => iframe,
  };
}
