/**
 * Activity Listener
 *
 * Connects to the editor-sync sidecar's /ws/activity WebSocket endpoint
 * to receive real-time events (deploy status, file changes, AI activity).
 * Forwards typed events to the agent store for UI rendering.
 */

// =============================================================================
// Activity Event Types (mirrors editor-sync ActivityEventType + AI extensions)
// =============================================================================

export type ActivityEventType =
  | "deploy_started"
  | "deploy_progress"
  | "preview_ready"
  | "deploy_failed"
  | "file_changed"
  | "file_deleted"
  | "file_renamed"
  // AI activity extensions (Phase 7 will add these to editor-sync)
  | "ai_generation_started"
  | "ai_generation_completed"
  | "ai_quality_report";

export interface ActivityEvent {
  type: ActivityEventType;
  data: Record<string, unknown>;
  timestamp: string;
}

// =============================================================================
// Connection Management
// =============================================================================

export interface ActivityListenerOptions {
  /** WebSocket URL (e.g. ws://localhost:8765/ws/activity) */
  wsUrl: string;
  /** Callback for incoming events */
  onEvent: (event: ActivityEvent) => void;
  /** Callback for connection state changes */
  onConnectionChange?: (connected: boolean) => void;
  /** Reconnect delay in ms (default: 3000) */
  reconnectDelay?: number;
  /** Max reconnect attempts (default: 5) */
  maxReconnectAttempts?: number;
}

interface ListenerHandle {
  close: () => void;
  isConnected: () => boolean;
}

/**
 * Subscribes to the editor-sync activity WebSocket.
 * Automatically reconnects on disconnection.
 *
 * @returns A handle to close the connection
 */
export function subscribeToActivity(
  options: ActivityListenerOptions,
): ListenerHandle {
  const {
    wsUrl,
    onEvent,
    onConnectionChange,
    reconnectDelay = 3000,
    maxReconnectAttempts = 5,
  } = options;

  let ws: WebSocket | null = null;
  let connected = false;
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  function connect() {
    if (closed) return;

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        connected = true;
        reconnectAttempts = 0;
        onConnectionChange?.(true);
      };

      ws.onmessage = (event) => {
        try {
          const parsed: ActivityEvent = JSON.parse(
            typeof event.data === "string" ? event.data : "",
          );
          if (parsed.type) {
            onEvent(parsed);
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        connected = false;
        onConnectionChange?.(false);
        scheduleReconnect();
      };

      ws.onerror = () => {
        // onclose will fire after onerror
      };
    } catch {
      connected = false;
      onConnectionChange?.(false);
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    if (closed || reconnectAttempts >= maxReconnectAttempts) return;

    reconnectAttempts++;
    reconnectTimer = setTimeout(connect, reconnectDelay);
  }

  function close() {
    closed = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      ws.onclose = null; // Prevent reconnect
      ws.close();
      ws = null;
    }
    connected = false;
    onConnectionChange?.(false);
  }

  // Start initial connection
  connect();

  return {
    close,
    isConnected: () => connected,
  };
}
