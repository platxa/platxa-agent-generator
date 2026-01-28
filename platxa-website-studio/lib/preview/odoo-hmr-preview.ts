/**
 * OdooHMRPreview - Hot Module Replacement Preview Manager
 *
 * Manages iframe communication and hot updates for the Odoo preview panel.
 * Consolidates iframe reference, source map tracking, pending updates queue,
 * and message bridge into a single class for coordinated HMR operations.
 *
 * @module preview/odoo-hmr-preview
 */

import type { QWebSourceMap, SourceMapEntry } from './qweb-source-map';
import { buildSourceMap } from './qweb-source-map';

// =============================================================================
// Types
// =============================================================================

/** Types of HMR updates that can be applied */
export type HMRUpdateType =
  | 'css'           // CSS-only update (no reload)
  | 'html'          // HTML content update
  | 'highlight'     // Highlight element in preview
  | 'scroll-to'     // Scroll to element
  | 'full-reload';  // Full iframe reload

/** A single HMR update to be applied */
export interface HMRUpdate {
  /** Unique identifier for this update */
  id: string;
  /** Type of update */
  type: HMRUpdateType;
  /** Update content (CSS string, HTML string, etc.) */
  content?: string;
  /** Source ID for highlight/scroll operations */
  sourceId?: string;
  /** File path associated with this update */
  file?: string;
  /** Line number for source navigation */
  line?: number;
  /** Priority (higher = applied first) */
  priority?: number;
  /** Timestamp when update was queued */
  timestamp: number;
}

/** State of the pending updates queue */
export interface UpdateQueueState {
  /** Number of pending updates */
  pendingCount: number;
  /** Whether updates are currently being applied */
  isApplying: boolean;
  /** Timestamp of last applied update */
  lastApplied: number | null;
  /** Total updates applied since creation */
  totalApplied: number;
}

/** Message types for iframe ↔ parent communication */
export type MessageType =
  | 'platxa:inject-css'
  | 'platxa:inject-html'
  | 'platxa:highlight-element'
  | 'platxa:scroll-to-element'
  | 'platxa:source-navigate'
  | 'platxa:snippet-select'
  | 'platxa:snippet-context'
  | 'platxa:reload'
  | 'platxa:ready'
  | 'platxa:error';

/** Message payload for iframe communication */
export interface BridgeMessage {
  type: MessageType;
  [key: string]: unknown;
}

/** Handler function for message events */
export type MessageHandler = (data: BridgeMessage) => void;

/** Configuration options for OdooHMRPreview */
export interface OdooHMRPreviewConfig {
  /** Debounce delay for applying updates (ms) */
  debounceMs?: number;
  /** Maximum queue size before forcing apply */
  maxQueueSize?: number;
  /** Origin for postMessage security (default: '*') */
  targetOrigin?: string;
  /** Enable debug logging */
  debug?: boolean;
}

// =============================================================================
// OdooHMRPreview Class
// =============================================================================

/**
 * OdooHMRPreview manages the preview iframe with hot module replacement support.
 *
 * Features:
 * - Iframe reference management with lifecycle tracking
 * - Bidirectional source map for DOM ↔ source navigation
 * - Pending updates queue with debounced batch application
 * - Message bridge for secure iframe communication
 *
 * @example
 * ```typescript
 * const hmr = new OdooHMRPreview({ debounceMs: 100 });
 *
 * // Set iframe reference
 * hmr.setIframe(iframeElement);
 *
 * // Queue CSS update
 * hmr.queueUpdate({ type: 'css', content: compiledCss });
 *
 * // Listen for messages from iframe
 * const unsubscribe = hmr.onMessage('platxa:source-navigate', (data) => {
 *   editor.goToLine(data.file, data.line);
 * });
 *
 * // Cleanup
 * hmr.dispose();
 * ```
 */
export class OdooHMRPreview {
  // -------------------------------------------------------------------------
  // Private State
  // -------------------------------------------------------------------------

  /** Reference to the preview iframe element */
  private iframeRef: HTMLIFrameElement | null = null;

  /** Bidirectional source map for DOM ↔ source navigation */
  private sourceMap: QWebSourceMap | null = null;

  /** Queue of pending updates to apply */
  private pendingUpdates: HMRUpdate[] = [];

  /** Whether updates are currently being applied */
  private isApplying = false;

  /** Debounce timer for batching updates */
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  /** Message handler for window message events */
  private boundMessageHandler: ((event: MessageEvent) => void) | null = null;

  /** Registered message listeners by type */
  private messageListeners: Map<MessageType, Set<MessageHandler>> = new Map();

  /** Configuration options */
  private config: Required<OdooHMRPreviewConfig>;

  /** Statistics tracking */
  private stats = {
    totalApplied: 0,
    lastApplied: null as number | null,
  };

  /** Unique ID counter for updates */
  private updateIdCounter = 0;

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  constructor(config: OdooHMRPreviewConfig = {}) {
    this.config = {
      debounceMs: config.debounceMs ?? 50,
      maxQueueSize: config.maxQueueSize ?? 100,
      targetOrigin: config.targetOrigin ?? '*',
      debug: config.debug ?? false,
    };

    // Bind and register the message handler
    this.boundMessageHandler = this.handleWindowMessage.bind(this);
    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.boundMessageHandler);
    }

    this.log('OdooHMRPreview initialized', this.config);
  }

  // -------------------------------------------------------------------------
  // Iframe Management
  // -------------------------------------------------------------------------

  /**
   * Set the iframe element reference.
   * Automatically detects when iframe is ready for communication.
   */
  setIframe(iframe: HTMLIFrameElement | null): void {
    const previousIframe = this.iframeRef;
    this.iframeRef = iframe;

    if (previousIframe !== iframe) {
      this.log('Iframe reference updated', { hasIframe: !!iframe });

      // Clear pending updates when iframe changes
      if (!iframe) {
        this.clearPendingUpdates();
      }
    }
  }

  /**
   * Get the current iframe element reference.
   */
  getIframe(): HTMLIFrameElement | null {
    return this.iframeRef;
  }

  /**
   * Check if iframe is ready for communication.
   */
  isIframeReady(): boolean {
    return !!(this.iframeRef?.contentWindow);
  }

  // -------------------------------------------------------------------------
  // Source Map Management
  // -------------------------------------------------------------------------

  /**
   * Set the source map for DOM ↔ source bidirectional lookup.
   */
  setSourceMap(map: QWebSourceMap): void {
    this.sourceMap = map;
    this.log('Source map updated', { entryCount: map.entries.length });
  }

  /**
   * Build and set source map from entries.
   */
  setSourceMapFromEntries(entries: SourceMapEntry[]): void {
    this.sourceMap = buildSourceMap(entries);
    this.log('Source map built from entries', { entryCount: entries.length });
  }

  /**
   * Get the current source map.
   */
  getSourceMap(): QWebSourceMap | null {
    return this.sourceMap;
  }

  /**
   * Find source location for a DOM selector.
   */
  findSource(domSelector: string): SourceMapEntry | undefined {
    return this.sourceMap?.findSource(domSelector);
  }

  /**
   * Find DOM selectors for a source location.
   */
  findDom(file: string, line: number): SourceMapEntry[] {
    return this.sourceMap?.findDom(file, line) ?? [];
  }

  // -------------------------------------------------------------------------
  // Pending Updates Queue
  // -------------------------------------------------------------------------

  /**
   * Queue an update to be applied.
   * Updates are batched and applied after debounce delay.
   */
  queueUpdate(update: Omit<HMRUpdate, 'id' | 'timestamp'>): void {
    const fullUpdate: HMRUpdate = {
      ...update,
      id: `update-${++this.updateIdCounter}`,
      timestamp: Date.now(),
      priority: update.priority ?? this.getDefaultPriority(update.type),
    };

    this.pendingUpdates.push(fullUpdate);
    this.log('Update queued', { id: fullUpdate.id, type: fullUpdate.type });

    // Force apply if queue is too large
    if (this.pendingUpdates.length >= this.config.maxQueueSize) {
      this.log('Queue size limit reached, forcing apply');
      this.applyPendingUpdates();
      return;
    }

    // Schedule debounced apply
    this.scheduleApply();
  }

  /**
   * Queue a CSS injection update.
   */
  queueCSSUpdate(css: string, file?: string): void {
    this.queueUpdate({ type: 'css', content: css, file });
  }

  /**
   * Queue an HTML content update.
   */
  queueHTMLUpdate(html: string, file?: string): void {
    this.queueUpdate({ type: 'html', content: html, file });
  }

  /**
   * Queue a highlight element update.
   */
  queueHighlight(sourceId: string): void {
    this.queueUpdate({ type: 'highlight', sourceId });
  }

  /**
   * Queue a scroll-to-element update.
   */
  queueScrollTo(sourceId: string): void {
    this.queueUpdate({ type: 'scroll-to', sourceId });
  }

  /**
   * Queue a full reload.
   */
  queueFullReload(): void {
    // Clear all other pending updates
    this.pendingUpdates = [];
    this.queueUpdate({ type: 'full-reload', priority: 0 });
  }

  /**
   * Get current queue state.
   */
  getQueueState(): UpdateQueueState {
    return {
      pendingCount: this.pendingUpdates.length,
      isApplying: this.isApplying,
      lastApplied: this.stats.lastApplied,
      totalApplied: this.stats.totalApplied,
    };
  }

  /**
   * Clear all pending updates without applying them.
   */
  clearPendingUpdates(): void {
    this.pendingUpdates = [];
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.log('Pending updates cleared');
  }

  /**
   * Apply all pending updates immediately.
   */
  async applyPendingUpdates(): Promise<void> {
    if (this.isApplying || this.pendingUpdates.length === 0) {
      return;
    }

    // Cancel any pending debounce
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.isApplying = true;
    const updates = [...this.pendingUpdates];
    this.pendingUpdates = [];

    // Sort by priority (higher first)
    updates.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    this.log('Applying updates', { count: updates.length });

    try {
      for (const update of updates) {
        await this.applyUpdate(update);
      }

      this.stats.totalApplied += updates.length;
      this.stats.lastApplied = Date.now();
    } finally {
      this.isApplying = false;
    }
  }

  // -------------------------------------------------------------------------
  // Message Bridge
  // -------------------------------------------------------------------------

  /**
   * Post a message to the iframe.
   * Returns true if message was sent, false if iframe is not ready.
   */
  postMessage(type: MessageType, data: Record<string, unknown> = {}): boolean {
    if (!this.isIframeReady()) {
      this.log('Cannot post message: iframe not ready', { type });
      return false;
    }

    const message: BridgeMessage = { type, ...data };
    this.iframeRef!.contentWindow!.postMessage(message, this.config.targetOrigin);
    this.log('Message posted', { type });
    return true;
  }

  /**
   * Register a handler for messages from the iframe.
   * Returns an unsubscribe function.
   */
  onMessage(type: MessageType, handler: MessageHandler): () => void {
    if (!this.messageListeners.has(type)) {
      this.messageListeners.set(type, new Set());
    }

    this.messageListeners.get(type)!.add(handler);
    this.log('Message handler registered', { type });

    return () => {
      this.messageListeners.get(type)?.delete(handler);
      this.log('Message handler unregistered', { type });
    };
  }

  /**
   * Remove all handlers for a message type.
   */
  offMessage(type: MessageType): void {
    this.messageListeners.delete(type);
    this.log('All handlers removed', { type });
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Dispose of all resources.
   * Call this when unmounting the component using this class.
   */
  dispose(): void {
    // Remove window message listener
    if (this.boundMessageHandler && typeof window !== 'undefined') {
      window.removeEventListener('message', this.boundMessageHandler);
      this.boundMessageHandler = null;
    }

    // Clear debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Clear all state
    this.iframeRef = null;
    this.sourceMap = null;
    this.pendingUpdates = [];
    this.messageListeners.clear();
    this.isApplying = false;

    this.log('OdooHMRPreview disposed');
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  /**
   * Schedule debounced apply of pending updates.
   */
  private scheduleApply(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.applyPendingUpdates();
    }, this.config.debounceMs);
  }

  /**
   * Apply a single update to the iframe.
   */
  private async applyUpdate(update: HMRUpdate): Promise<void> {
    switch (update.type) {
      case 'css':
        this.postMessage('platxa:inject-css', { css: update.content ?? '' });
        break;

      case 'html':
        this.postMessage('platxa:inject-html', { html: update.content ?? '' });
        break;

      case 'highlight':
        this.postMessage('platxa:highlight-element', { sourceId: update.sourceId });
        break;

      case 'scroll-to':
        this.postMessage('platxa:scroll-to-element', { sourceId: update.sourceId });
        break;

      case 'full-reload':
        if (this.iframeRef) {
          // Reload by re-setting src
          const currentSrc = this.iframeRef.src;
          this.iframeRef.src = '';
          // Use setTimeout to ensure the src reset takes effect
          await new Promise((resolve) => setTimeout(resolve, 0));
          this.iframeRef.src = currentSrc;
        }
        break;
    }

    this.log('Update applied', { id: update.id, type: update.type });
  }

  /**
   * Get default priority for an update type.
   * Higher priority updates are applied first.
   */
  private getDefaultPriority(type: HMRUpdateType): number {
    const priorities: Record<HMRUpdateType, number> = {
      'full-reload': 0,   // Lowest - if needed, replaces everything
      'html': 50,         // Medium - structural changes
      'css': 100,         // High - style changes (fast, safe)
      'highlight': 150,   // Higher - visual feedback
      'scroll-to': 150,   // Higher - visual feedback
    };
    return priorities[type] ?? 50;
  }

  /**
   * Handle incoming window messages.
   */
  private handleWindowMessage(event: MessageEvent): void {
    // Verify message is from our iframe (if we have a reference)
    if (this.iframeRef && event.source !== this.iframeRef.contentWindow) {
      return;
    }

    const data = event.data as BridgeMessage;
    if (!data || typeof data.type !== 'string' || !data.type.startsWith('platxa:')) {
      return;
    }

    this.log('Message received', { type: data.type });

    // Dispatch to registered handlers
    const handlers = this.messageListeners.get(data.type as MessageType);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`[OdooHMRPreview] Handler error for ${data.type}:`, error);
        }
      }
    }
  }

  /**
   * Debug logging helper.
   */
  private log(message: string, data?: Record<string, unknown>): void {
    if (this.config.debug) {
      console.log(`[OdooHMRPreview] ${message}`, data ?? '');
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new OdooHMRPreview instance with default configuration.
 */
export function createHMRPreview(config?: OdooHMRPreviewConfig): OdooHMRPreview {
  return new OdooHMRPreview(config);
}

/**
 * Create a pre-configured OdooHMRPreview for development with debug enabled.
 */
export function createDebugHMRPreview(): OdooHMRPreview {
  return new OdooHMRPreview({
    debug: true,
    debounceMs: 100,
  });
}

// =============================================================================
// Default Export
// =============================================================================

export default OdooHMRPreview;
