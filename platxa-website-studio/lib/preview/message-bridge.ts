/**
 * MessageBridge — Robust postMessage communication between parent and iframe.
 *
 * Provides typed, error-handled message passing with:
 * - Parent → Iframe commands
 * - Iframe → Parent events
 * - Request/response pattern with timeouts
 * - Error handling on both sides
 */

// =============================================================================
// Types
// =============================================================================

/** Base message structure */
export interface BridgeMessage<T = unknown> {
  /** Message type identifier */
  type: string;
  /** Message payload */
  payload?: T;
  /** Unique message ID for request/response tracking */
  messageId?: string;
  /** Timestamp when message was created */
  timestamp: number;
  /** Error information if this is an error response */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Command sent from parent to iframe */
export interface BridgeCommand<T = unknown> extends BridgeMessage<T> {
  /** Commands have a specific prefix */
  type: `platxa:cmd:${string}`;
}

/** Event sent from iframe to parent */
export interface BridgeEvent<T = unknown> extends BridgeMessage<T> {
  /** Events have a specific prefix */
  type: `platxa:evt:${string}`;
}

/** Response to a command */
export interface BridgeResponse<T = unknown> extends BridgeMessage<T> {
  /** Responses reference the original command */
  type: `platxa:res:${string}`;
  /** ID of the command this responds to */
  commandId: string;
  /** Whether the command succeeded */
  success: boolean;
}

/** Message handler function */
export type MessageHandler<T = unknown, R = void> = (
  payload: T,
  message: BridgeMessage<T>
) => R | Promise<R>;

/** Error handler function */
export type ErrorHandler = (error: Error, message: BridgeMessage) => void;

/** Bridge configuration */
export interface MessageBridgeConfig {
  /** Namespace prefix for messages (default: "platxa") */
  namespace?: string;
  /** Target origin for postMessage (default: "*") */
  targetOrigin?: string;
  /** Default timeout for request/response (default: 5000ms) */
  defaultTimeout?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

// =============================================================================
// ParentBridge Class
// =============================================================================

/**
 * Bridge for parent window to communicate with iframe.
 *
 * @example
 * ```typescript
 * const bridge = new ParentBridge(iframe);
 *
 * // Send command to iframe
 * bridge.send('update-css', { css: '.foo { color: red }' });
 *
 * // Send command and wait for response
 * const result = await bridge.request('get-html', { selector: '.header' });
 *
 * // Listen for events from iframe
 * bridge.on('element-clicked', (payload) => {
 *   console.log('Clicked:', payload.elementId);
 * });
 * ```
 */
export class ParentBridge {
  private iframe: HTMLIFrameElement;
  private config: Required<MessageBridgeConfig>;
  private handlers = new Map<string, Set<MessageHandler>>();
  private pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();
  private errorHandler: ErrorHandler | null = null;
  private messageListener: ((event: MessageEvent) => void) | null = null;
  private messageCounter = 0;

  constructor(iframe: HTMLIFrameElement, config: MessageBridgeConfig = {}) {
    this.iframe = iframe;
    this.config = {
      namespace: config.namespace ?? "platxa",
      targetOrigin: config.targetOrigin ?? "*",
      defaultTimeout: config.defaultTimeout ?? 5000,
      debug: config.debug ?? false,
    };
    this.setupListener();
  }

  // ---------------------------------------------------------------------------
  // Commands (Parent → Iframe)
  // ---------------------------------------------------------------------------

  /**
   * Sends a command to the iframe (fire-and-forget).
   */
  send<T>(command: string, payload?: T): void {
    const message: BridgeCommand<T> = {
      type: `${this.config.namespace}:cmd:${command}` as `platxa:cmd:${string}`,
      payload,
      messageId: this.generateId(),
      timestamp: Date.now(),
    };

    this.postToIframe(message);
  }

  /**
   * Sends a command and waits for a response.
   */
  request<T, R = unknown>(
    command: string,
    payload?: T,
    timeout?: number
  ): Promise<R> {
    return new Promise((resolve, reject) => {
      const messageId = this.generateId();
      const timeoutMs = timeout ?? this.config.defaultTimeout;

      const message: BridgeCommand<T> = {
        type: `${this.config.namespace}:cmd:${command}` as `platxa:cmd:${string}`,
        payload,
        messageId,
        timestamp: Date.now(),
      };

      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(messageId);
        reject(new Error(`Request '${command}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(messageId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout: timeoutHandle,
      });

      this.postToIframe(message);
    });
  }

  // ---------------------------------------------------------------------------
  // Events (Iframe → Parent)
  // ---------------------------------------------------------------------------

  /**
   * Registers a handler for events from the iframe.
   */
  on<T>(event: string, handler: MessageHandler<T>): () => void {
    const fullType = `${this.config.namespace}:evt:${event}`;
    if (!this.handlers.has(fullType)) {
      this.handlers.set(fullType, new Set());
    }
    this.handlers.get(fullType)!.add(handler as MessageHandler);
    return () => this.handlers.get(fullType)?.delete(handler as MessageHandler);
  }

  /**
   * Registers a one-time handler for an event.
   */
  once<T>(event: string, handler: MessageHandler<T>): () => void {
    const unsubscribe = this.on<T>(event, (payload, message) => {
      unsubscribe();
      return handler(payload, message);
    });
    return unsubscribe;
  }

  /**
   * Removes all handlers for an event.
   */
  off(event: string): void {
    const fullType = `${this.config.namespace}:evt:${event}`;
    this.handlers.delete(fullType);
  }

  // ---------------------------------------------------------------------------
  // Error Handling
  // ---------------------------------------------------------------------------

  /**
   * Sets the global error handler.
   */
  onError(handler: ErrorHandler): () => void {
    this.errorHandler = handler;
    return () => {
      this.errorHandler = null;
    };
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Disconnects the bridge and cleans up resources.
   */
  dispose(): void {
    if (this.messageListener) {
      window.removeEventListener("message", this.messageListener);
      this.messageListener = null;
    }

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Bridge disposed"));
    }
    this.pendingRequests.clear();
    this.handlers.clear();
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private setupListener(): void {
    this.messageListener = (event: MessageEvent) => {
      if (!event.data?.type?.startsWith(this.config.namespace)) return;

      const message = event.data as BridgeMessage;
      this.log("Received:", message.type);

      try {
        // Handle responses
        if (message.type.includes(":res:")) {
          this.handleResponse(message as BridgeResponse);
          return;
        }

        // Handle events
        if (message.type.includes(":evt:")) {
          this.handleEvent(message as BridgeEvent);
          return;
        }
      } catch (error) {
        this.handleError(error as Error, message);
      }
    };

    window.addEventListener("message", this.messageListener);
  }

  private handleResponse(response: BridgeResponse): void {
    const pending = this.pendingRequests.get(response.commandId);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.commandId);

    if (response.success) {
      pending.resolve(response.payload);
    } else {
      pending.reject(
        new Error(response.error?.message ?? "Command failed")
      );
    }
  }

  private handleEvent(event: BridgeEvent): void {
    const handlers = this.handlers.get(event.type);
    if (!handlers) return;

    for (const handler of handlers) {
      try {
        handler(event.payload, event);
      } catch (error) {
        this.handleError(error as Error, event);
      }
    }
  }

  private handleError(error: Error, message: BridgeMessage): void {
    this.log("Error:", error.message);
    if (this.errorHandler) {
      try {
        this.errorHandler(error, message);
      } catch (e) {
        console.error("Error in error handler:", e);
      }
    }
  }

  private postToIframe(message: BridgeMessage): void {
    if (!this.iframe.contentWindow) {
      this.log("Warning: iframe contentWindow not available");
      return;
    }
    this.log("Sending:", message.type);
    this.iframe.contentWindow.postMessage(message, this.config.targetOrigin);
  }

  private generateId(): string {
    return `${this.config.namespace}-${Date.now()}-${++this.messageCounter}`;
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log("[ParentBridge]", ...args);
    }
  }
}

// =============================================================================
// IframeBridge Class (for injection into iframe)
// =============================================================================

/**
 * Bridge for iframe to communicate with parent window.
 * This class is designed to be used within the iframe context.
 */
export class IframeBridge {
  private config: Required<MessageBridgeConfig>;
  private handlers = new Map<string, Set<MessageHandler>>();
  private errorHandler: ErrorHandler | null = null;
  private messageListener: ((event: MessageEvent) => void) | null = null;

  constructor(config: MessageBridgeConfig = {}) {
    this.config = {
      namespace: config.namespace ?? "platxa",
      targetOrigin: config.targetOrigin ?? "*",
      defaultTimeout: config.defaultTimeout ?? 5000,
      debug: config.debug ?? false,
    };
    this.setupListener();
  }

  // ---------------------------------------------------------------------------
  // Events (Iframe → Parent)
  // ---------------------------------------------------------------------------

  /**
   * Emits an event to the parent window.
   */
  emit<T>(event: string, payload?: T): void {
    const message: BridgeEvent<T> = {
      type: `${this.config.namespace}:evt:${event}` as `platxa:evt:${string}`,
      payload,
      timestamp: Date.now(),
    };

    this.postToParent(message);
  }

  /**
   * Responds to a command from the parent.
   */
  respond<T>(commandId: string, command: string, payload?: T, success = true): void {
    const message: BridgeResponse<T> = {
      type: `${this.config.namespace}:res:${command}` as `platxa:res:${string}`,
      commandId,
      payload,
      success,
      timestamp: Date.now(),
    };

    this.postToParent(message);
  }

  /**
   * Responds with an error to a command.
   */
  respondError(commandId: string, command: string, error: Error): void {
    const message: BridgeResponse = {
      type: `${this.config.namespace}:res:${command}` as `platxa:res:${string}`,
      commandId,
      success: false,
      error: {
        code: "ERROR",
        message: error.message,
      },
      timestamp: Date.now(),
    };

    this.postToParent(message);
  }

  // ---------------------------------------------------------------------------
  // Commands (Parent → Iframe)
  // ---------------------------------------------------------------------------

  /**
   * Registers a handler for commands from the parent.
   */
  onCommand<T, R = void>(command: string, handler: MessageHandler<T, R>): () => void {
    const fullType = `${this.config.namespace}:cmd:${command}`;
    if (!this.handlers.has(fullType)) {
      this.handlers.set(fullType, new Set());
    }
    this.handlers.get(fullType)!.add(handler as MessageHandler);
    return () => this.handlers.get(fullType)?.delete(handler as MessageHandler);
  }

  // ---------------------------------------------------------------------------
  // Error Handling
  // ---------------------------------------------------------------------------

  /**
   * Sets the global error handler.
   */
  onError(handler: ErrorHandler): () => void {
    this.errorHandler = handler;
    return () => {
      this.errorHandler = null;
    };
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Disconnects the bridge and cleans up resources.
   */
  dispose(): void {
    if (this.messageListener) {
      window.removeEventListener("message", this.messageListener);
      this.messageListener = null;
    }
    this.handlers.clear();
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private setupListener(): void {
    this.messageListener = (event: MessageEvent) => {
      if (!event.data?.type?.startsWith(this.config.namespace)) return;

      const message = event.data as BridgeMessage;
      this.log("Received:", message.type);

      try {
        // Handle commands
        if (message.type.includes(":cmd:")) {
          this.handleCommand(message as BridgeCommand);
          return;
        }
      } catch (error) {
        this.handleError(error as Error, message);
      }
    };

    window.addEventListener("message", this.messageListener);
  }

  private handleCommand(command: BridgeCommand): void {
    const handlers = this.handlers.get(command.type);
    if (!handlers || handlers.size === 0) {
      this.log("No handler for command:", command.type);
      return;
    }

    for (const handler of handlers) {
      try {
        const result = handler(command.payload, command);

        // If command has messageId, send response
        if (command.messageId) {
          const cmdName = command.type.split(":cmd:")[1];

          // Check if result is a promise
          if (result && typeof (result as Promise<unknown>).then === "function") {
            (result as Promise<unknown>)
              .then((asyncResult) => {
                this.respond(command.messageId!, cmdName, asyncResult, true);
              })
              .catch((error: Error) => {
                this.handleError(error, command);
                this.respondError(command.messageId!, cmdName, error);
              });
          } else {
            // Synchronous result - respond immediately
            this.respond(command.messageId, cmdName, result, true);
          }
        }
      } catch (error) {
        this.handleError(error as Error, command);

        // Send error response if command has messageId
        if (command.messageId) {
          const cmdName = command.type.split(":cmd:")[1];
          this.respondError(command.messageId, cmdName, error as Error);
        }
      }
    }
  }

  private handleError(error: Error, message: BridgeMessage): void {
    this.log("Error:", error.message);
    if (this.errorHandler) {
      try {
        this.errorHandler(error, message);
      } catch (e) {
        console.error("Error in error handler:", e);
      }
    }
  }

  private postToParent(message: BridgeMessage): void {
    if (typeof window === "undefined" || !window.parent) {
      this.log("Warning: parent window not available");
      return;
    }
    this.log("Sending:", message.type);
    window.parent.postMessage(message, this.config.targetOrigin);
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log("[IframeBridge]", ...args);
    }
  }
}

// =============================================================================
// Iframe Bridge Script
// =============================================================================

/**
 * Generates the iframe bridge script for injection.
 */
export function generateIframeBridgeScript(config: MessageBridgeConfig = {}): string {
  const namespace = config.namespace ?? "platxa";
  const targetOrigin = config.targetOrigin ?? "*";
  const debug = config.debug ?? false;

  return `
<script>
(function() {
  'use strict';

  var config = {
    namespace: '${namespace}',
    targetOrigin: '${targetOrigin}',
    debug: ${debug}
  };

  var handlers = new Map();
  var errorHandler = null;

  function log() {
    if (config.debug) {
      console.log.apply(console, ['[IframeBridge]'].concat(Array.from(arguments)));
    }
  }

  function emit(event, payload) {
    var message = {
      type: config.namespace + ':evt:' + event,
      payload: payload,
      timestamp: Date.now()
    };
    log('Emit:', message.type);
    window.parent.postMessage(message, config.targetOrigin);
  }

  function respond(commandId, command, payload, success) {
    var message = {
      type: config.namespace + ':res:' + command,
      commandId: commandId,
      payload: payload,
      success: success !== false,
      timestamp: Date.now()
    };
    log('Respond:', message.type);
    window.parent.postMessage(message, config.targetOrigin);
  }

  function respondError(commandId, command, error) {
    var message = {
      type: config.namespace + ':res:' + command,
      commandId: commandId,
      success: false,
      error: { code: 'ERROR', message: error.message || String(error) },
      timestamp: Date.now()
    };
    log('Respond error:', message.type);
    window.parent.postMessage(message, config.targetOrigin);
  }

  function onCommand(command, handler) {
    var fullType = config.namespace + ':cmd:' + command;
    if (!handlers.has(fullType)) {
      handlers.set(fullType, new Set());
    }
    handlers.get(fullType).add(handler);
    return function() {
      handlers.get(fullType).delete(handler);
    };
  }

  function onError(handler) {
    errorHandler = handler;
    return function() { errorHandler = null; };
  }

  function handleMessage(event) {
    if (!event.data || !event.data.type) return;
    if (!event.data.type.startsWith(config.namespace)) return;

    var message = event.data;
    log('Received:', message.type);

    if (message.type.indexOf(':cmd:') === -1) return;

    var cmdHandlers = handlers.get(message.type);
    if (!cmdHandlers || cmdHandlers.size === 0) {
      log('No handler for:', message.type);
      return;
    }

    cmdHandlers.forEach(function(handler) {
      try {
        var result = handler(message.payload, message);
        if (message.messageId && result !== undefined) {
          var cmdName = message.type.split(':cmd:')[1];
          if (result && typeof result.then === 'function') {
            result.then(function(r) {
              respond(message.messageId, cmdName, r, true);
            }).catch(function(e) {
              respondError(message.messageId, cmdName, e);
            });
          } else {
            respond(message.messageId, cmdName, result, true);
          }
        }
      } catch (e) {
        log('Handler error:', e);
        if (errorHandler) {
          try { errorHandler(e, message); } catch (ee) { console.error(ee); }
        }
        if (message.messageId) {
          var cmdName = message.type.split(':cmd:')[1];
          respondError(message.messageId, cmdName, e);
        }
      }
    });
  }

  window.addEventListener('message', handleMessage);

  window.__PLATXA_BRIDGE__ = {
    emit: emit,
    respond: respond,
    respondError: respondError,
    onCommand: onCommand,
    onError: onError,
    config: config
  };

  log('Bridge initialized');
  emit('bridge-ready', { version: '1.0.0' });
})();
</script>`;
}

/**
 * Default iframe bridge script.
 */
export const IFRAME_BRIDGE_SCRIPT = generateIframeBridgeScript();

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a parent bridge for communicating with an iframe.
 */
export function createParentBridge(
  iframe: HTMLIFrameElement,
  config?: MessageBridgeConfig
): ParentBridge {
  return new ParentBridge(iframe, config);
}

/**
 * Creates an iframe bridge for communicating with parent.
 */
export function createIframeBridge(config?: MessageBridgeConfig): IframeBridge {
  return new IframeBridge(config);
}
