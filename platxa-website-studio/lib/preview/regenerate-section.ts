/**
 * RegenerateSection — Triggers agent regeneration for selected snippets.
 *
 * Provides a controller for the "Regenerate Section" button that appears
 * when a snippet is selected. Extracts context from the selected section
 * and triggers an agent callback with that context.
 */

import type { SelectedElement } from "./select-mode";

// =============================================================================
// Types
// =============================================================================

/** Context passed to the agent for regeneration */
export interface RegenerateSectionContext {
  /** The selected snippet's unique instance ID */
  snippetId: string;
  /** The snippet type (e.g., "s_banner") */
  snippetType: string | null;
  /** Current HTML content of the section */
  currentHtml: string | null;
  /** Bounding rect of the section */
  bounds: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  /** CSS selector to target this section */
  selector: string;
  /** User instruction for regeneration (optional) */
  instruction?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/** Request to regenerate a section */
export interface RegenerateRequest {
  /** The context for regeneration */
  context: RegenerateSectionContext;
  /** Timestamp of the request */
  timestamp: number;
  /** Request ID for tracking */
  requestId: string;
}

/** Result of a regeneration */
export interface RegenerateResult {
  /** Whether regeneration succeeded */
  success: boolean;
  /** New HTML content if successful */
  newHtml?: string;
  /** Error message if failed */
  error?: string;
  /** Request ID this result corresponds to */
  requestId: string;
  /** Duration in milliseconds */
  durationMs: number;
}

/** Options for the regenerate controller */
export interface RegenerateSectionOptions {
  /** Whether to extract HTML from iframe (default: true) */
  extractHtml?: boolean;
  /** Maximum HTML length to extract (default: 50000) */
  maxHtmlLength?: number;
  /** Message type for postMessage (default: "platxa:regenerate-section") */
  messageType?: string;
}

/** Callback triggered when regeneration is requested */
export type RegenerateCallback = (request: RegenerateRequest) => void | Promise<void>;

/** Callback triggered when regeneration completes */
export type RegenerateResultCallback = (result: RegenerateResult) => void;

// =============================================================================
// RegenerateSectionController Class
// =============================================================================

/**
 * Controls the "Regenerate Section" functionality.
 *
 * @example
 * ```typescript
 * const controller = new RegenerateSectionController();
 *
 * controller.onRegenerate(async (request) => {
 *   const { context } = request;
 *   // Call agent with context
 *   const newHtml = await agent.regenerateSection(context);
 *   controller.complete(request.requestId, { success: true, newHtml });
 * });
 *
 * // When user clicks "Regenerate Section" button
 * controller.trigger(selectedElement);
 * ```
 */
export class RegenerateSectionController {
  private callbacks = new Set<RegenerateCallback>();
  private resultCallbacks = new Set<RegenerateResultCallback>();
  private options: Required<RegenerateSectionOptions>;
  private pendingRequests = new Map<string, { startTime: number; context: RegenerateSectionContext }>();
  private requestCounter = 0;
  private enabled = true;

  constructor(options: RegenerateSectionOptions = {}) {
    this.options = {
      extractHtml: options.extractHtml ?? true,
      maxHtmlLength: options.maxHtmlLength ?? 50000,
      messageType: options.messageType ?? "platxa:regenerate-section",
    };
  }

  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------

  /** Enables regeneration functionality */
  enable(): void {
    this.enabled = true;
  }

  /** Disables regeneration functionality */
  disable(): void {
    this.enabled = false;
  }

  /** Checks if regeneration is enabled */
  isEnabled(): boolean {
    return this.enabled;
  }

  /** Checks if there are pending regeneration requests */
  hasPendingRequests(): boolean {
    return this.pendingRequests.size > 0;
  }

  /** Gets the number of pending requests */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  // ---------------------------------------------------------------------------
  // Trigger Regeneration
  // ---------------------------------------------------------------------------

  /**
   * Triggers regeneration for a selected element.
   * Returns the request ID for tracking.
   */
  trigger(
    element: SelectedElement,
    html?: string,
    instruction?: string
  ): string | null {
    if (!this.enabled) return null;
    if (!element.snippetId) return null;

    const requestId = this.generateRequestId();
    const context = this.buildContext(element, html, instruction);

    const request: RegenerateRequest = {
      context,
      timestamp: Date.now(),
      requestId,
    };

    this.pendingRequests.set(requestId, {
      startTime: Date.now(),
      context,
    });

    this.emitRegenerate(request);

    return requestId;
  }

  /**
   * Triggers regeneration with a pre-built context.
   */
  triggerWithContext(
    context: RegenerateSectionContext,
    instruction?: string
  ): string | null {
    if (!this.enabled) return null;

    const requestId = this.generateRequestId();
    const fullContext = instruction ? { ...context, instruction } : context;

    const request: RegenerateRequest = {
      context: fullContext,
      timestamp: Date.now(),
      requestId,
    };

    this.pendingRequests.set(requestId, {
      startTime: Date.now(),
      context: fullContext,
    });

    this.emitRegenerate(request);

    return requestId;
  }

  /**
   * Completes a regeneration request with the result.
   */
  complete(requestId: string, result: Omit<RegenerateResult, "requestId" | "durationMs">): void {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;

    const durationMs = Date.now() - pending.startTime;
    this.pendingRequests.delete(requestId);

    const fullResult: RegenerateResult = {
      ...result,
      requestId,
      durationMs,
    };

    this.emitResult(fullResult);
  }

  /**
   * Cancels a pending regeneration request.
   */
  cancel(requestId: string): void {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;

    const durationMs = Date.now() - pending.startTime;
    this.pendingRequests.delete(requestId);

    this.emitResult({
      success: false,
      error: "Cancelled",
      requestId,
      durationMs,
    });
  }

  /**
   * Cancels all pending requests.
   */
  cancelAll(): void {
    for (const requestId of this.pendingRequests.keys()) {
      this.cancel(requestId);
    }
  }

  // ---------------------------------------------------------------------------
  // Event Handling
  // ---------------------------------------------------------------------------

  /** Registers a callback for regeneration requests */
  onRegenerate(callback: RegenerateCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /** Registers a callback for regeneration results */
  onResult(callback: RegenerateResultCallback): () => void {
    this.resultCallbacks.add(callback);
    return () => this.resultCallbacks.delete(callback);
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  /** Gets the message type for postMessage communication */
  getMessageType(): string {
    return this.options.messageType;
  }

  /** Whether HTML extraction is enabled */
  shouldExtractHtml(): boolean {
    return this.options.extractHtml;
  }

  /** Gets maximum HTML length to extract */
  getMaxHtmlLength(): number {
    return this.options.maxHtmlLength;
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private generateRequestId(): string {
    return `regen-${Date.now()}-${++this.requestCounter}`;
  }

  private buildContext(
    element: SelectedElement,
    html?: string,
    instruction?: string
  ): RegenerateSectionContext {
    return {
      snippetId: element.snippetId!,
      snippetType: element.classes.find((c) => c.startsWith("s_")) ?? null,
      currentHtml: html ?? null,
      bounds: {
        top: element.bounds.top,
        left: element.bounds.left,
        width: element.bounds.width,
        height: element.bounds.height,
      },
      selector: element.selector,
      instruction,
    };
  }

  private emitRegenerate(request: RegenerateRequest): void {
    for (const callback of this.callbacks) {
      try {
        callback(request);
      } catch (e) {
        console.error("RegenerateSection callback error:", e);
      }
    }
  }

  private emitResult(result: RegenerateResult): void {
    for (const callback of this.resultCallbacks) {
      try {
        callback(result);
      } catch (e) {
        console.error("RegenerateSection result callback error:", e);
      }
    }
  }
}

// =============================================================================
// HTML Extraction
// =============================================================================

/**
 * Extracts HTML content from an element in the iframe.
 */
export function extractSectionHtml(
  element: Element,
  maxLength: number = 50000
): string {
  const html = element.outerHTML;
  if (html.length <= maxLength) {
    return html;
  }
  // Truncate but keep valid HTML structure
  return html.substring(0, maxLength) + "<!-- truncated -->";
}

/**
 * Extracts context from a DOM element for regeneration.
 */
export function extractRegenerateContext(
  element: Element,
  options: { maxHtmlLength?: number; instruction?: string } = {}
): RegenerateSectionContext | null {
  const snippetId = element.getAttribute("data-snippet-id");
  if (!snippetId) return null;

  const rect = element.getBoundingClientRect();
  const classes = Array.from(element.classList);

  return {
    snippetId,
    snippetType: classes.find((c) => c.startsWith("s_")) ?? element.getAttribute("data-snippet"),
    currentHtml: extractSectionHtml(element, options.maxHtmlLength),
    bounds: {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    },
    selector: `[data-snippet-id="${snippetId}"]`,
    instruction: options.instruction,
  };
}

// =============================================================================
// Iframe Script
// =============================================================================

/**
 * Script to inject into the preview iframe for regenerate section support.
 * Extracts HTML when regeneration is requested.
 */
export const REGENERATE_SECTION_SCRIPT = `
<script>
(function() {
  var regenerate = {
    messageType: 'platxa:regenerate-section',
    maxHtmlLength: 50000
  };

  function extractContext(snippetId) {
    var el = document.querySelector('[data-snippet-id="' + snippetId + '"]');
    if (!el) return null;

    var rect = el.getBoundingClientRect();
    var classes = Array.from(el.classList);
    var html = el.outerHTML;
    if (html.length > regenerate.maxHtmlLength) {
      html = html.substring(0, regenerate.maxHtmlLength) + '<!-- truncated -->';
    }

    return {
      snippetId: snippetId,
      snippetType: classes.find(function(c) { return c.startsWith('s_'); }) || el.getAttribute('data-snippet'),
      currentHtml: html,
      bounds: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      selector: '[data-snippet-id="' + snippetId + '"]'
    };
  }

  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;

    switch (e.data.type) {
      case 'platxa:regenerate-extract':
        var context = extractContext(e.data.snippetId);
        window.parent.postMessage({
          type: 'platxa:regenerate-context',
          context: context,
          requestId: e.data.requestId
        }, '*');
        break;

      case 'platxa:regenerate-config':
        if (e.data.maxHtmlLength) regenerate.maxHtmlLength = e.data.maxHtmlLength;
        if (e.data.messageType) regenerate.messageType = e.data.messageType;
        break;
    }
  });

  window.parent.postMessage({ type: 'platxa:regenerate-ready' }, '*');
})();
</script>`;

// =============================================================================
// Iframe Bridge
// =============================================================================

/**
 * Creates a bridge for regenerate section communication with iframe.
 */
export function createRegenerateBridge(
  iframe: HTMLIFrameElement,
  controller: RegenerateSectionController
): { dispose: () => void; extractHtml: (snippetId: string) => Promise<string | null> } {
  const pendingExtracts = new Map<string, (html: string | null) => void>();

  const handleMessage = (event: MessageEvent) => {
    if (!event.data?.type) return;

    switch (event.data.type) {
      case "platxa:regenerate-ready":
        iframe.contentWindow?.postMessage({
          type: "platxa:regenerate-config",
          maxHtmlLength: controller.getMaxHtmlLength(),
          messageType: controller.getMessageType(),
        }, "*");
        break;

      case "platxa:regenerate-context":
        const resolve = pendingExtracts.get(event.data.requestId);
        if (resolve) {
          pendingExtracts.delete(event.data.requestId);
          resolve(event.data.context?.currentHtml ?? null);
        }
        break;
    }
  };

  window.addEventListener("message", handleMessage);

  const extractHtml = (snippetId: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const requestId = `extract-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      pendingExtracts.set(requestId, resolve);

      iframe.contentWindow?.postMessage({
        type: "platxa:regenerate-extract",
        snippetId,
        requestId,
      }, "*");

      // Timeout after 5 seconds
      setTimeout(() => {
        if (pendingExtracts.has(requestId)) {
          pendingExtracts.delete(requestId);
          resolve(null);
        }
      }, 5000);
    });
  };

  return {
    dispose: () => {
      window.removeEventListener("message", handleMessage);
      pendingExtracts.clear();
    },
    extractHtml,
  };
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a RegenerateSectionController with optional configuration.
 */
export function createRegenerateSection(
  options?: RegenerateSectionOptions & { initiallyEnabled?: boolean }
): RegenerateSectionController {
  const controller = new RegenerateSectionController(options);
  if (options?.initiallyEnabled === false) {
    controller.disable();
  }
  return controller;
}
