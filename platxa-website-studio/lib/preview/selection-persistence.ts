/**
 * SelectionPersistence — Preserves element selection across HMR updates.
 *
 * Feature #77: Add selection persistence across HMR updates
 * Verification: Selection restored by ID after DOM morph
 *
 * When the preview DOM is morphed during HMR updates, the selected element
 * may be replaced. This module saves the selection before updates and
 * restores it after the morph completes by finding the element with the
 * same ID (data-snippet-id, data-element-id, or CSS selector).
 *
 * @module lib/preview/selection-persistence
 */

import type { SelectModeController, SelectedElement } from "./select-mode";

// =============================================================================
// Types
// =============================================================================

/** Selection identifier used to restore selection */
export interface SelectionIdentifier {
  /** Primary: data-snippet-id */
  snippetId: string | null;
  /** Secondary: data-element-id */
  elementId: string | null;
  /** Fallback: CSS selector */
  selector: string;
  /** Element tag name for validation */
  tagName: string;
  /** Timestamp when saved */
  savedAt: number;
}

/** Options for selection persistence */
export interface SelectionPersistenceOptions {
  /** Timeout in ms to wait for element to appear after morph (default: 100) */
  restoreTimeout?: number;
  /** Whether to scroll restored element into view (default: false) */
  scrollIntoView?: boolean;
  /** Whether to flash restored element (default: true) */
  flashOnRestore?: boolean;
  /** Flash duration in ms (default: 300) */
  flashDuration?: number;
  /** Whether to validate tag name matches (default: true) */
  validateTagName?: boolean;
  /** Maximum age of saved selection in ms (default: 5000) */
  maxAge?: number;
}

/** State of selection persistence */
export interface PersistenceState {
  /** Whether persistence is enabled */
  enabled: boolean;
  /** Saved selection identifier */
  savedSelection: SelectionIdentifier | null;
  /** Whether a restore is pending */
  restorePending: boolean;
  /** Number of successful restores */
  restoreCount: number;
  /** Number of failed restores */
  failCount: number;
}

/** Result of a restore operation */
export interface RestoreResult {
  /** Whether restore succeeded */
  success: boolean;
  /** The restored element (if successful) */
  element: SelectedElement | null;
  /** Method used to find element */
  method: "snippetId" | "elementId" | "selector" | "none";
  /** Duration in ms */
  durationMs: number;
  /** Error message if failed */
  error?: string;
}

/** Callback for restore events */
export type RestoreCallback = (result: RestoreResult) => void;

// =============================================================================
// SelectionPersistence Class
// =============================================================================

/**
 * Manages selection persistence across HMR DOM updates.
 *
 * @example
 * ```typescript
 * const selectController = new SelectModeController();
 * const persistence = new SelectionPersistence(selectController, {
 *   restoreTimeout: 100,
 *   flashOnRestore: true,
 * });
 *
 * // Connect to iframe
 * persistence.connect(iframe);
 *
 * // Before HMR update
 * persistence.save();
 *
 * // After morph completes
 * const result = await persistence.restore();
 *
 * // Listen for restore events
 * persistence.onRestore((result) => {
 *   console.log(`Restore ${result.success ? 'succeeded' : 'failed'}`);
 * });
 * ```
 */
export class SelectionPersistence {
  private selectController: SelectModeController;
  private options: Required<SelectionPersistenceOptions>;
  private iframe: HTMLIFrameElement | null = null;
  private state: PersistenceState;
  private callbacks = new Set<RestoreCallback>();
  private messageHandler: ((e: MessageEvent) => void) | null = null;
  private disposed = false;

  constructor(
    selectController: SelectModeController,
    options: SelectionPersistenceOptions = {}
  ) {
    this.selectController = selectController;
    this.options = {
      restoreTimeout: options.restoreTimeout ?? 100,
      scrollIntoView: options.scrollIntoView ?? false,
      flashOnRestore: options.flashOnRestore ?? true,
      flashDuration: options.flashDuration ?? 300,
      validateTagName: options.validateTagName ?? true,
      maxAge: options.maxAge ?? 5000,
    };

    this.state = {
      enabled: true,
      savedSelection: null,
      restorePending: false,
      restoreCount: 0,
      failCount: 0,
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
      throw new Error("SelectionPersistence has been disposed");
    }

    this.iframe = iframe;

    // Listen for morph events from iframe
    this.messageHandler = this.handleMessage.bind(this);
    window.addEventListener("message", this.messageHandler);
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
  }

  /**
   * Checks if connected.
   */
  isConnected(): boolean {
    return this.iframe !== null;
  }

  // ---------------------------------------------------------------------------
  // Save Selection
  // ---------------------------------------------------------------------------

  /**
   * Saves the current selection for later restoration.
   * Call this before HMR updates.
   */
  save(): SelectionIdentifier | null {
    if (!this.state.enabled) return null;

    const selected = this.selectController.getSelected();
    if (!selected) {
      this.state.savedSelection = null;
      return null;
    }

    this.state.savedSelection = {
      snippetId: selected.snippetId,
      elementId: selected.elementId,
      selector: selected.selector,
      tagName: selected.tagName,
      savedAt: Date.now(),
    };

    return this.state.savedSelection;
  }

  /**
   * Gets the currently saved selection.
   */
  getSaved(): SelectionIdentifier | null {
    return this.state.savedSelection;
  }

  /**
   * Clears the saved selection.
   */
  clearSaved(): void {
    this.state.savedSelection = null;
  }

  // ---------------------------------------------------------------------------
  // Restore Selection
  // ---------------------------------------------------------------------------

  /**
   * Restores the previously saved selection.
   * Call this after HMR updates complete.
   */
  async restore(): Promise<RestoreResult> {
    const startTime = Date.now();

    if (!this.state.enabled || !this.state.savedSelection) {
      return {
        success: false,
        element: null,
        method: "none",
        durationMs: Date.now() - startTime,
        error: "No saved selection or persistence disabled",
      };
    }

    // Check if saved selection is too old
    const age = Date.now() - this.state.savedSelection.savedAt;
    if (age > this.options.maxAge) {
      this.state.savedSelection = null;
      return {
        success: false,
        element: null,
        method: "none",
        durationMs: Date.now() - startTime,
        error: "Saved selection expired",
      };
    }

    this.state.restorePending = true;

    // Wait a short time for DOM to settle after morph
    await this.waitForDom();

    const result = await this.findAndRestoreElement();

    this.state.restorePending = false;

    if (result.success) {
      this.state.restoreCount++;
    } else {
      this.state.failCount++;
    }

    result.durationMs = Date.now() - startTime;

    // Notify callbacks
    this.notifyRestore(result);

    // Clear saved selection after restore attempt
    this.state.savedSelection = null;

    return result;
  }

  private async waitForDom(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, this.options.restoreTimeout);
    });
  }

  private async findAndRestoreElement(): Promise<RestoreResult> {
    const saved = this.state.savedSelection!;

    // Try to find element by various methods
    let element: SelectedElement | null = null;
    let method: RestoreResult["method"] = "none";

    // Try snippetId first (most reliable)
    if (saved.snippetId) {
      element = await this.findElementById("snippetId", saved.snippetId, saved.tagName);
      if (element) method = "snippetId";
    }

    // Try elementId
    if (!element && saved.elementId) {
      element = await this.findElementById("elementId", saved.elementId, saved.tagName);
      if (element) method = "elementId";
    }

    // Try selector as fallback
    if (!element && saved.selector) {
      element = await this.findElementBySelector(saved.selector, saved.tagName);
      if (element) method = "selector";
    }

    if (!element) {
      return {
        success: false,
        element: null,
        method: "none",
        durationMs: 0,
        error: "Element not found after morph",
      };
    }

    // Restore selection
    this.selectController.select(element);

    // Apply visual feedback
    if (this.options.flashOnRestore || this.options.scrollIntoView) {
      this.applyRestoreEffects(element);
    }

    return {
      success: true,
      element,
      method,
      durationMs: 0,
    };
  }

  private async findElementById(
    idType: "snippetId" | "elementId",
    id: string,
    expectedTagName: string
  ): Promise<SelectedElement | null> {
    if (!this.iframe?.contentWindow) return null;

    return new Promise((resolve) => {
      const handler = (e: MessageEvent) => {
        if (e.data?.type === "platxa:selection-restore-result") {
          window.removeEventListener("message", handler);
          resolve(e.data.element);
        }
      };

      window.addEventListener("message", handler);

      // Timeout fallback
      setTimeout(() => {
        window.removeEventListener("message", handler);
        resolve(null);
      }, 500);

      this.iframe!.contentWindow!.postMessage(
        {
          type: "platxa:selection-restore-find",
          idType,
          id,
          expectedTagName: this.options.validateTagName ? expectedTagName : null,
        },
        "*"
      );
    });
  }

  private async findElementBySelector(
    selector: string,
    expectedTagName: string
  ): Promise<SelectedElement | null> {
    if (!this.iframe?.contentWindow) return null;

    return new Promise((resolve) => {
      const handler = (e: MessageEvent) => {
        if (e.data?.type === "platxa:selection-restore-result") {
          window.removeEventListener("message", handler);
          resolve(e.data.element);
        }
      };

      window.addEventListener("message", handler);

      setTimeout(() => {
        window.removeEventListener("message", handler);
        resolve(null);
      }, 500);

      this.iframe!.contentWindow!.postMessage(
        {
          type: "platxa:selection-restore-find",
          idType: "selector",
          selector,
          expectedTagName: this.options.validateTagName ? expectedTagName : null,
        },
        "*"
      );
    });
  }

  private applyRestoreEffects(element: SelectedElement): void {
    if (!this.iframe?.contentWindow) return;

    this.iframe.contentWindow.postMessage(
      {
        type: "platxa:selection-restore-effects",
        selector: element.selector,
        scrollIntoView: this.options.scrollIntoView,
        flash: this.options.flashOnRestore,
        flashDuration: this.options.flashDuration,
      },
      "*"
    );
  }

  // ---------------------------------------------------------------------------
  // Message Handling
  // ---------------------------------------------------------------------------

  private handleMessage(event: MessageEvent): void {
    if (!event.data?.type?.startsWith("platxa:morph")) return;

    switch (event.data.type) {
      case "platxa:morph-before":
        // Auto-save before morph
        this.save();
        break;

      case "platxa:morph-after":
        // Auto-restore after morph
        this.restore();
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------

  /**
   * Enables selection persistence.
   */
  enable(): void {
    this.state.enabled = true;
  }

  /**
   * Disables selection persistence.
   */
  disable(): void {
    this.state.enabled = false;
    this.state.savedSelection = null;
  }

  /**
   * Toggles enabled state.
   */
  toggle(): boolean {
    this.state.enabled = !this.state.enabled;
    if (!this.state.enabled) {
      this.state.savedSelection = null;
    }
    return this.state.enabled;
  }

  /**
   * Checks if enabled.
   */
  isEnabled(): boolean {
    return this.state.enabled;
  }

  /**
   * Gets current state.
   */
  getState(): PersistenceState {
    return { ...this.state };
  }

  /**
   * Resets restore statistics.
   */
  resetStats(): void {
    this.state.restoreCount = 0;
    this.state.failCount = 0;
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  /**
   * Registers a restore callback.
   */
  onRestore(callback: RestoreCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private notifyRestore(result: RestoreResult): void {
    for (const callback of this.callbacks) {
      try {
        callback(result);
      } catch (e) {
        console.error("SelectionPersistence callback error:", e);
      }
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
    this.disconnect();
    this.callbacks.clear();
    this.state.savedSelection = null;
  }
}

// =============================================================================
// Iframe Script
// =============================================================================

/**
 * Script to inject into the preview iframe for selection persistence.
 * Handles element finding and restore effects.
 */
export const SELECTION_PERSISTENCE_SCRIPT = `
<script>
(function() {
  function getElementInfo(el) {
    if (!el) return null;
    var rect = el.getBoundingClientRect();
    return {
      snippetId: el.getAttribute('data-snippet-id'),
      elementId: el.getAttribute('data-element-id'),
      tagName: el.tagName.toLowerCase(),
      classes: Array.from(el.classList),
      bounds: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      selector: el.getAttribute('data-snippet-id')
        ? '[data-snippet-id="' + el.getAttribute('data-snippet-id') + '"]'
        : el.getAttribute('data-element-id')
          ? '[data-element-id="' + el.getAttribute('data-element-id') + '"]'
          : generateSelector(el)
    };
  }

  function generateSelector(el) {
    var parts = [];
    var current = el;
    while (current && current !== document.body) {
      var selector = current.tagName.toLowerCase();
      if (current.id) {
        return '#' + current.id + (parts.length ? ' > ' + parts.join(' > ') : '');
      }
      var parent = current.parentElement;
      if (parent) {
        var siblings = Array.from(parent.children).filter(function(c) {
          return c.tagName === current.tagName;
        });
        if (siblings.length > 1) {
          selector += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')';
        }
      }
      parts.unshift(selector);
      current = parent;
    }
    return parts.join(' > ');
  }

  function findElement(idType, id, selector, expectedTagName) {
    var el = null;

    if (idType === 'snippetId' && id) {
      el = document.querySelector('[data-snippet-id="' + id + '"]');
    } else if (idType === 'elementId' && id) {
      el = document.querySelector('[data-element-id="' + id + '"]');
    } else if (idType === 'selector' && selector) {
      try {
        el = document.querySelector(selector);
      } catch (e) {
        // Invalid selector
      }
    }

    // Validate tag name if required
    if (el && expectedTagName && el.tagName.toLowerCase() !== expectedTagName) {
      return null;
    }

    return el;
  }

  function flashElement(el, duration) {
    if (!el) return;

    var originalBackground = el.style.backgroundColor;
    var originalTransition = el.style.transition;

    el.style.transition = 'background-color ' + (duration / 2) + 'ms ease-out';
    el.style.backgroundColor = 'rgba(59, 130, 246, 0.3)';

    setTimeout(function() {
      el.style.backgroundColor = originalBackground;
      setTimeout(function() {
        el.style.transition = originalTransition;
      }, duration / 2);
    }, duration / 2);
  }

  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;

    switch (e.data.type) {
      case 'platxa:selection-restore-find':
        var el = findElement(
          e.data.idType,
          e.data.id,
          e.data.selector,
          e.data.expectedTagName
        );

        window.parent.postMessage({
          type: 'platxa:selection-restore-result',
          element: getElementInfo(el)
        }, '*');
        break;

      case 'platxa:selection-restore-effects':
        var targetEl = document.querySelector(e.data.selector);
        if (targetEl) {
          if (e.data.scrollIntoView) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          if (e.data.flash) {
            flashElement(targetEl, e.data.flashDuration || 300);
          }
          // Ensure selection class is applied
          targetEl.classList.add('platxa-select-selected');
        }
        break;
    }
  });

  // Notify parent that persistence script is ready
  window.parent.postMessage({ type: 'platxa:selection-persistence-ready' }, '*');
})();
</script>`;

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a SelectionPersistence instance.
 */
export function createSelectionPersistence(
  selectController: SelectModeController,
  options?: SelectionPersistenceOptions
): SelectionPersistence {
  return new SelectionPersistence(selectController, options);
}

/**
 * Creates morphdom hooks that integrate with selection persistence.
 * Use these hooks with morphdom to auto-save/restore selection.
 */
export function createMorphdomSelectionHooks(
  persistence: SelectionPersistence
): {
  onBeforeMorph: () => void;
  onAfterMorph: () => Promise<RestoreResult>;
} {
  return {
    onBeforeMorph: () => {
      persistence.save();
    },
    onAfterMorph: async () => {
      return persistence.restore();
    },
  };
}

// =============================================================================
// Exports
// =============================================================================

export default SelectionPersistence;
