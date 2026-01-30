/**
 * CursorHighlightBridge — Maps editor cursor position to preview element highlighting.
 *
 * Feature #71: Add preview highlight from editor cursor position
 * Verification: Cursor in snippet code highlights corresponding preview section
 *
 * When the user's cursor is positioned within template code in the editor,
 * this bridge finds the corresponding element in the preview iframe and
 * highlights it, creating a visual connection between source and output.
 *
 * @module lib/preview/cursor-highlight-bridge
 */

import type { SourceMapper } from "./source-mapper";

// =============================================================================
// Types
// =============================================================================

/** Cursor position in the editor */
export interface CursorPosition {
  /** 1-based line number */
  line: number;
  /** 1-based column number */
  column: number;
}

/** Options for cursor highlight bridge */
export interface CursorHighlightBridgeOptions {
  /** Debounce delay in ms (default: 50) */
  debounceMs?: number;
  /** Whether to scroll element into view (default: true) */
  scrollIntoView?: boolean;
  /** Message type for highlight requests (default: "platxa:highlight-element") */
  messageType?: string;
  /** Whether to highlight multiple elements at same line (default: false) */
  highlightMultiple?: boolean;
  /** Current file path being edited */
  filePath?: string;
}

/** State of the cursor highlight bridge */
export interface CursorHighlightState {
  /** Whether the bridge is enabled */
  enabled: boolean;
  /** Currently highlighted element IDs */
  highlightedIds: string[];
  /** Last cursor position processed */
  lastPosition: CursorPosition | null;
  /** Current file path */
  currentFile: string | null;
}

/** Callback for highlight state changes */
export type HighlightStateCallback = (state: CursorHighlightState) => void;

/** Highlight request sent to the preview iframe */
export interface HighlightRequest {
  type: string;
  /** Element source ID to highlight */
  sourceId: string | null;
  /** Multiple source IDs when highlightMultiple is true */
  sourceIds?: string[];
  /** Whether to scroll element into view */
  scrollIntoView: boolean;
  /** Additional highlight options */
  options?: {
    /** Custom highlight color */
    color?: string;
    /** Animation duration in ms */
    duration?: number;
  };
}

// =============================================================================
// CursorHighlightBridge Class
// =============================================================================

/**
 * Bridge that maps editor cursor position to preview element highlighting.
 *
 * @example
 * ```typescript
 * const bridge = new CursorHighlightBridge(sourceMapper, {
 *   debounceMs: 100,
 *   scrollIntoView: true,
 * });
 *
 * // Connect to preview iframe
 * bridge.connect(iframeRef.current);
 *
 * // Update cursor position (from editor)
 * bridge.updateCursor({ line: 10, column: 5 }, 'template.xml');
 *
 * // Listen for state changes
 * bridge.onStateChange((state) => {
 *   console.log('Highlighted:', state.highlightedIds);
 * });
 *
 * // Clean up
 * bridge.dispose();
 * ```
 */
export class CursorHighlightBridge {
  private sourceMapper: SourceMapper;
  private options: Required<CursorHighlightBridgeOptions>;
  private iframe: HTMLIFrameElement | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private state: CursorHighlightState;
  private stateCallbacks = new Set<HighlightStateCallback>();
  private disposed = false;

  constructor(sourceMapper: SourceMapper, options: CursorHighlightBridgeOptions = {}) {
    this.sourceMapper = sourceMapper;
    this.options = {
      debounceMs: options.debounceMs ?? 50,
      scrollIntoView: options.scrollIntoView ?? true,
      messageType: options.messageType ?? "platxa:highlight-element",
      highlightMultiple: options.highlightMultiple ?? false,
      filePath: options.filePath ?? "",
    };

    this.state = {
      enabled: true,
      highlightedIds: [],
      lastPosition: null,
      currentFile: this.options.filePath || null,
    };
  }

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------

  /**
   * Connects the bridge to a preview iframe.
   */
  connect(iframe: HTMLIFrameElement): void {
    if (this.disposed) {
      throw new Error("CursorHighlightBridge has been disposed");
    }
    this.iframe = iframe;
  }

  /**
   * Disconnects from the current iframe.
   */
  disconnect(): void {
    // Clear highlight before disconnecting (while iframe is still available)
    this.clearHighlight();
    this.iframe = null;
  }

  /**
   * Checks if connected to an iframe.
   */
  isConnected(): boolean {
    return this.iframe !== null;
  }

  // ---------------------------------------------------------------------------
  // Cursor Update
  // ---------------------------------------------------------------------------

  /**
   * Updates the cursor position and triggers highlight calculation.
   * Debounces rapid cursor movements.
   *
   * @param position - Current cursor position
   * @param filePath - Optional file path (overrides default)
   */
  updateCursor(position: CursorPosition, filePath?: string): void {
    if (this.disposed || !this.state.enabled) return;

    const file = filePath ?? this.options.filePath;
    this.state.currentFile = file || null;

    // Clear existing debounce
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Debounce the highlight update
    this.debounceTimer = setTimeout(() => {
      this.processPosition(position, file || "");
    }, this.options.debounceMs);
  }

  /**
   * Immediately processes a cursor position without debouncing.
   * Useful for explicit user actions (like clicking a line).
   */
  updateCursorImmediate(position: CursorPosition, filePath?: string): void {
    if (this.disposed || !this.state.enabled) return;

    const file = filePath ?? this.options.filePath;
    this.state.currentFile = file || null;

    // Clear any pending debounced update
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.processPosition(position, file || "");
  }

  private processPosition(position: CursorPosition, filePath: string): void {
    this.state.lastPosition = position;

    // Find elements at this line using the source mapper
    const elementIds = this.findElementsAtCursor(position, filePath);

    // Update state
    this.state.highlightedIds = elementIds;
    this.notifyStateChange();

    // Send highlight request to iframe
    this.sendHighlightRequest(elementIds);
  }

  // ---------------------------------------------------------------------------
  // Element Lookup
  // ---------------------------------------------------------------------------

  /**
   * Finds element IDs at the cursor position using the source mapper.
   */
  private findElementsAtCursor(position: CursorPosition, filePath: string): string[] {
    if (!filePath) return [];

    // Use SourceMapper's reverse lookup to find elements at this line
    // Include spanning elements (elements that span across this line)
    const elementIds = this.sourceMapper.getElementsAtLine(filePath, position.line, {
      includeSpanning: true,
    });

    if (this.options.highlightMultiple) {
      return elementIds;
    }

    // Return only the most specific (innermost) element
    // This is typically the last one added at this line
    return elementIds.length > 0 ? [elementIds[elementIds.length - 1]] : [];
  }

  /**
   * Gets elements for a specific line (public API for external use).
   */
  getElementsAtLine(line: number, filePath?: string): string[] {
    const file = filePath ?? this.options.filePath ?? "";
    return this.sourceMapper.getElementsAtLine(file, line, { includeSpanning: true });
  }

  // ---------------------------------------------------------------------------
  // Highlight Control
  // ---------------------------------------------------------------------------

  /**
   * Sends a highlight request to the preview iframe.
   */
  private sendHighlightRequest(elementIds: string[]): void {
    if (!this.iframe?.contentWindow) return;

    const request: HighlightRequest = {
      type: this.options.messageType,
      sourceId: elementIds.length > 0 ? elementIds[0] : null,
      sourceIds: this.options.highlightMultiple ? elementIds : undefined,
      scrollIntoView: this.options.scrollIntoView,
    };

    this.iframe.contentWindow.postMessage(request, "*");
  }

  /**
   * Clears the current highlight.
   */
  clearHighlight(): void {
    this.state.highlightedIds = [];
    this.notifyStateChange();

    if (this.iframe?.contentWindow) {
      this.iframe.contentWindow.postMessage(
        {
          type: this.options.messageType,
          sourceId: null,
          scrollIntoView: false,
        },
        "*"
      );
    }
  }

  /**
   * Manually highlights specific element IDs.
   */
  highlightElements(elementIds: string[]): void {
    if (this.disposed || !this.state.enabled) return;

    this.state.highlightedIds = elementIds;
    this.notifyStateChange();
    this.sendHighlightRequest(elementIds);
  }

  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------

  /**
   * Enables the highlight bridge.
   */
  enable(): void {
    this.state.enabled = true;
    this.notifyStateChange();
  }

  /**
   * Disables the highlight bridge.
   */
  disable(): void {
    this.state.enabled = false;
    this.clearHighlight();
    this.notifyStateChange();
  }

  /**
   * Toggles the enabled state.
   */
  toggle(): boolean {
    if (this.state.enabled) {
      this.disable();
    } else {
      this.enable();
    }
    return this.state.enabled;
  }

  /**
   * Checks if the bridge is enabled.
   */
  isEnabled(): boolean {
    return this.state.enabled;
  }

  /**
   * Gets the current state.
   */
  getState(): CursorHighlightState {
    return { ...this.state };
  }

  /**
   * Registers a callback for state changes.
   */
  onStateChange(callback: HighlightStateCallback): () => void {
    this.stateCallbacks.add(callback);
    return () => this.stateCallbacks.delete(callback);
  }

  private notifyStateChange(): void {
    const stateCopy = { ...this.state };
    for (const callback of this.stateCallbacks) {
      try {
        callback(stateCopy);
      } catch (e) {
        console.error("CursorHighlightBridge callback error:", e);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  /**
   * Updates the source mapper instance.
   */
  setSourceMapper(mapper: SourceMapper): void {
    this.sourceMapper = mapper;
    // Re-process current position with new mapper
    if (this.state.lastPosition && this.state.currentFile) {
      this.processPosition(this.state.lastPosition, this.state.currentFile);
    }
  }

  /**
   * Updates the current file path.
   */
  setFilePath(filePath: string): void {
    this.options.filePath = filePath;
    this.state.currentFile = filePath;
  }

  /**
   * Updates options.
   */
  setOptions(options: Partial<CursorHighlightBridgeOptions>): void {
    if (options.debounceMs !== undefined) {
      this.options.debounceMs = options.debounceMs;
    }
    if (options.scrollIntoView !== undefined) {
      this.options.scrollIntoView = options.scrollIntoView;
    }
    if (options.messageType !== undefined) {
      this.options.messageType = options.messageType;
    }
    if (options.highlightMultiple !== undefined) {
      this.options.highlightMultiple = options.highlightMultiple;
    }
    if (options.filePath !== undefined) {
      this.options.filePath = options.filePath;
      this.state.currentFile = options.filePath;
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Disposes the bridge and cleans up resources.
   */
  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.clearHighlight();
    this.iframe = null;
    this.stateCallbacks.clear();
  }
}

// =============================================================================
// React Hook
// =============================================================================

/**
 * Hook options for useCursorHighlight
 */
export interface UseCursorHighlightOptions extends CursorHighlightBridgeOptions {
  /** Whether to enable highlight on mount (default: true) */
  enableOnMount?: boolean;
}

/**
 * Return type for useCursorHighlight hook
 */
export interface UseCursorHighlightReturn {
  /** Current highlight state */
  state: CursorHighlightState;
  /** Whether any elements are highlighted */
  isHighlighting: boolean;
  /** The highlighted element IDs */
  highlightedIds: string[];
  /** Update cursor position */
  updateCursor: (position: CursorPosition, filePath?: string) => void;
  /** Update cursor immediately (no debounce) */
  updateCursorImmediate: (position: CursorPosition, filePath?: string) => void;
  /** Clear current highlight */
  clearHighlight: () => void;
  /** Enable highlighting */
  enable: () => void;
  /** Disable highlighting */
  disable: () => void;
  /** Toggle highlighting */
  toggle: () => boolean;
  /** Connect to iframe */
  connect: (iframe: HTMLIFrameElement) => void;
  /** Disconnect from iframe */
  disconnect: () => void;
  /** Manually highlight elements */
  highlightElements: (elementIds: string[]) => void;
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a CursorHighlightBridge with the given source mapper.
 *
 * @example
 * ```typescript
 * const mapper = new SourceMapper();
 * mapper.annotate(template, 'hero.xml');
 *
 * const bridge = createCursorHighlightBridge(mapper, {
 *   debounceMs: 100,
 *   filePath: 'hero.xml',
 * });
 *
 * bridge.connect(iframe);
 * bridge.updateCursor({ line: 5, column: 1 });
 * ```
 */
export function createCursorHighlightBridge(
  sourceMapper: SourceMapper,
  options?: CursorHighlightBridgeOptions
): CursorHighlightBridge {
  return new CursorHighlightBridge(sourceMapper, options);
}

// =============================================================================
// Preview Iframe Script
// =============================================================================

/**
 * Script to inject into the preview iframe to handle cursor highlight requests.
 * This extends the existing highlight functionality with cursor-specific features.
 *
 * Handles messages:
 * - platxa:highlight-element - Highlight element(s) from cursor position
 * - platxa:highlight-clear - Clear all highlights
 */
export const CURSOR_HIGHLIGHT_SCRIPT = `
<script>
(function() {
  var cursorHighlight = {
    currentHighlighted: null,
    multipleHighlighted: [],
    style: null
  };

  // Create highlight styles if not exists
  if (!cursorHighlight.style) {
    cursorHighlight.style = document.createElement('style');
    cursorHighlight.style.textContent =
      '[data-cursor-highlight] {' +
      '  outline: 2px solid #3b82f6 !important;' +
      '  outline-offset: 2px;' +
      '  background-color: rgba(59, 130, 246, 0.1) !important;' +
      '  transition: outline 150ms ease-out, background-color 150ms ease-out;' +
      '}' +
      '[data-cursor-highlight-secondary] {' +
      '  outline: 1px dashed #60a5fa !important;' +
      '  outline-offset: 1px;' +
      '  background-color: rgba(59, 130, 246, 0.05) !important;' +
      '}';
    document.head.appendChild(cursorHighlight.style);
  }

  function clearHighlights() {
    if (cursorHighlight.currentHighlighted) {
      cursorHighlight.currentHighlighted.removeAttribute('data-cursor-highlight');
      cursorHighlight.currentHighlighted = null;
    }
    for (var el of cursorHighlight.multipleHighlighted) {
      el.removeAttribute('data-cursor-highlight');
      el.removeAttribute('data-cursor-highlight-secondary');
    }
    cursorHighlight.multipleHighlighted = [];
  }

  function highlightElement(sourceId, scrollIntoView) {
    clearHighlights();
    if (!sourceId) return;

    var el = document.querySelector('[data-element-id="' + sourceId + '"]') ||
             document.querySelector('[data-source-id="' + sourceId + '"]');

    if (el) {
      el.setAttribute('data-cursor-highlight', 'true');
      cursorHighlight.currentHighlighted = el;

      if (scrollIntoView) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  function highlightMultiple(sourceIds, scrollIntoView) {
    clearHighlights();
    if (!sourceIds || sourceIds.length === 0) return;

    for (var i = 0; i < sourceIds.length; i++) {
      var sourceId = sourceIds[i];
      var el = document.querySelector('[data-element-id="' + sourceId + '"]') ||
               document.querySelector('[data-source-id="' + sourceId + '"]');

      if (el) {
        if (i === 0) {
          // Primary highlight for first (innermost) element
          el.setAttribute('data-cursor-highlight', 'true');
          cursorHighlight.currentHighlighted = el;

          if (scrollIntoView) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else {
          // Secondary highlight for containing elements
          el.setAttribute('data-cursor-highlight-secondary', 'true');
        }
        cursorHighlight.multipleHighlighted.push(el);
      }
    }
  }

  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;

    if (e.data.type === 'platxa:highlight-element') {
      if (e.data.sourceIds && e.data.sourceIds.length > 0) {
        highlightMultiple(e.data.sourceIds, e.data.scrollIntoView !== false);
      } else {
        highlightElement(e.data.sourceId, e.data.scrollIntoView !== false);
      }
    }

    if (e.data.type === 'platxa:highlight-clear') {
      clearHighlights();
    }
  });

  // Notify parent that cursor highlight is ready
  window.parent.postMessage({ type: 'platxa:cursor-highlight-ready' }, '*');
})();
</script>`;

// =============================================================================
// Exports
// =============================================================================

export default CursorHighlightBridge;
