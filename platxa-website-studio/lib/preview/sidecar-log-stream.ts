/**
 * Sidecar Log Stream
 *
 * Streams logs from the editor-sync sidecar to LogInspector via WebSocket.
 * Provides real-time log monitoring for debugging and error tracking.
 */

import type { LogInspector, LogSeverity, LogEntry } from "./log-inspector";

// =============================================================================
// Types
// =============================================================================

/** Log message from sidecar WebSocket */
export interface SidecarLogMessage {
  /** Log level from sidecar */
  level: "debug" | "info" | "warning" | "error" | "critical";
  /** Log message */
  message: string;
  /** Timestamp (ISO string or Unix ms) */
  timestamp?: string | number;
  /** Optional logger name */
  logger?: string;
  /** Optional file path */
  file?: string;
  /** Optional line number */
  line?: number;
  /** Optional error code */
  code?: string;
  /** Optional stack trace */
  stack?: string;
  /** Additional data */
  data?: Record<string, unknown>;
}

/** Configuration for sidecar log stream */
export interface SidecarLogStreamConfig {
  /** WebSocket URL for log streaming (e.g., ws://localhost:8069/ws/logs) */
  wsUrl: string;
  /** Authentication token */
  authToken?: string;
  /** Reconnect on disconnect */
  autoReconnect: boolean;
  /** Maximum reconnect attempts */
  maxReconnectAttempts: number;
  /** Base delay between reconnect attempts (ms) */
  reconnectDelay: number;
  /** Minimum log level to stream */
  minLevel: LogSeverity;
  /** Whether to include debug logs */
  includeDebug: boolean;
}

/** Connection state for WebSocket */
export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

/** Stream event types */
export type StreamEventType =
  | "connect"
  | "disconnect"
  | "reconnect"
  | "error"
  | "log";

/** Stream event */
export interface StreamEvent {
  type: StreamEventType;
  timestamp: number;
  data?: unknown;
}

/** Stream event callback */
export type StreamEventCallback = (event: StreamEvent) => void;

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: SidecarLogStreamConfig = {
  wsUrl: "ws://localhost:8069/ws/logs",
  autoReconnect: true,
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
  minLevel: "info",
  includeDebug: false,
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Maps sidecar log level to LogSeverity.
 */
export function mapLogLevel(
  level: SidecarLogMessage["level"]
): LogSeverity {
  switch (level) {
    case "debug":
      return "debug";
    case "info":
      return "info";
    case "warning":
      return "warning";
    case "error":
    case "critical":
      return "error";
    default:
      return "info";
  }
}

/**
 * Parses timestamp from sidecar message.
 */
export function parseTimestamp(
  timestamp: string | number | undefined
): number {
  if (!timestamp) return Date.now();

  if (typeof timestamp === "number") {
    // If it looks like seconds, convert to ms
    return timestamp < 1e12 ? timestamp * 1000 : timestamp;
  }

  const parsed = Date.parse(timestamp);
  return isNaN(parsed) ? Date.now() : parsed;
}

/**
 * Checks if log level meets minimum threshold.
 */
export function meetsMinLevel(
  level: LogSeverity,
  minLevel: LogSeverity
): boolean {
  const levels: LogSeverity[] = ["debug", "info", "warning", "error"];
  return levels.indexOf(level) >= levels.indexOf(minLevel);
}

/**
 * Parses a WebSocket message as SidecarLogMessage.
 */
export function parseSidecarLogMessage(
  data: string
): SidecarLogMessage | null {
  try {
    const parsed = JSON.parse(data);

    // Validate required fields
    if (!parsed.message || !parsed.level) {
      return null;
    }

    return {
      level: parsed.level,
      message: parsed.message,
      timestamp: parsed.timestamp,
      logger: parsed.logger,
      file: parsed.file,
      line: parsed.line,
      code: parsed.code,
      stack: parsed.stack,
      data: parsed.data,
    };
  } catch {
    return null;
  }
}

// =============================================================================
// SidecarLogStream Class
// =============================================================================

/**
 * Streams logs from sidecar to LogInspector via WebSocket.
 *
 * @example
 * ```typescript
 * const inspector = new LogInspector();
 * const stream = new SidecarLogStream(inspector, {
 *   wsUrl: "ws://localhost:8069/ws/logs",
 *   authToken: "my-token",
 * });
 *
 * stream.connect();
 *
 * // Later...
 * stream.disconnect();
 * ```
 */
export class SidecarLogStream {
  private inspector: LogInspector;
  private config: SidecarLogStreamConfig;
  private ws: WebSocket | null = null;
  private state: ConnectionState = "disconnected";
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private callbacks: StreamEventCallback[] = [];
  private logsReceived = 0;

  constructor(
    inspector: LogInspector,
    config: Partial<SidecarLogStreamConfig> = {}
  ) {
    this.inspector = inspector;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ---------------------------------------------------------------------------
  // Connection Management
  // ---------------------------------------------------------------------------

  /**
   * Connects to the sidecar WebSocket.
   */
  connect(): void {
    if (this.state === "connected" || this.state === "connecting") {
      return;
    }

    this.state = "connecting";

    try {
      // Build WebSocket with auth token in subprotocol
      const protocols = this.config.authToken
        ? [`bearer-${this.config.authToken}`]
        : undefined;

      this.ws = new WebSocket(this.config.wsUrl, protocols);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch (error) {
      this.state = "error";
      this.emit({
        type: "error",
        timestamp: Date.now(),
        data: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  /**
   * Disconnects from the sidecar WebSocket.
   */
  disconnect(): void {
    this.clearReconnectTimer();
    this.reconnectAttempts = 0;

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }

    this.state = "disconnected";
    this.emit({ type: "disconnect", timestamp: Date.now() });
  }

  /**
   * Reconnects to the sidecar WebSocket.
   */
  reconnect(): void {
    this.disconnect();
    this.connect();
  }

  // ---------------------------------------------------------------------------
  // State Queries
  // ---------------------------------------------------------------------------

  /**
   * Gets current connection state.
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Checks if connected.
   */
  isConnected(): boolean {
    return this.state === "connected";
  }

  /**
   * Gets number of logs received.
   */
  getLogsReceived(): number {
    return this.logsReceived;
  }

  /**
   * Gets current configuration.
   */
  getConfig(): SidecarLogStreamConfig {
    return { ...this.config };
  }

  /**
   * Updates configuration.
   */
  updateConfig(config: Partial<SidecarLogStreamConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ---------------------------------------------------------------------------
  // Event Handling
  // ---------------------------------------------------------------------------

  /**
   * Registers event callback.
   */
  onEvent(callback: StreamEventCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Removes event callback.
   */
  offEvent(callback: StreamEventCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
    }
  }

  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

  private handleOpen(): void {
    this.state = "connected";
    this.reconnectAttempts = 0;

    // Log successful connection
    this.inspector.add({
      severity: "info",
      source: "sidecar",
      message: "Connected to sidecar log stream",
      details: { wsUrl: this.config.wsUrl },
    });

    this.emit({ type: "connect", timestamp: Date.now() });
  }

  private handleMessage(event: MessageEvent): void {
    const logMessage = parseSidecarLogMessage(event.data);

    if (!logMessage) {
      // Invalid message format
      return;
    }

    const severity = mapLogLevel(logMessage.level);

    // Check minimum level
    if (!this.config.includeDebug && severity === "debug") {
      return;
    }

    if (!meetsMinLevel(severity, this.config.minLevel)) {
      return;
    }

    // Add to LogInspector
    const entry = this.inspector.add({
      severity,
      source: "sidecar",
      message: logMessage.message,
      timestamp: parseTimestamp(logMessage.timestamp),
      file: logMessage.file,
      line: logMessage.line,
      code: logMessage.code,
      stack: logMessage.stack,
      details: {
        logger: logMessage.logger,
        ...logMessage.data,
      },
    });

    this.logsReceived++;

    this.emit({
      type: "log",
      timestamp: Date.now(),
      data: entry,
    });
  }

  private handleClose(event: CloseEvent): void {
    this.state = "disconnected";
    this.ws = null;

    // Log disconnection
    this.inspector.add({
      severity: "warning",
      source: "sidecar",
      message: `Sidecar log stream disconnected: ${event.reason || "Connection closed"}`,
      code: String(event.code),
    });

    this.emit({
      type: "disconnect",
      timestamp: Date.now(),
      data: { code: event.code, reason: event.reason },
    });

    // Attempt reconnect if configured
    if (this.config.autoReconnect) {
      this.scheduleReconnect();
    }
  }

  private handleError(event: Event): void {
    this.state = "error";

    this.inspector.add({
      severity: "error",
      source: "sidecar",
      message: "Sidecar log stream error",
      details: { event: String(event) },
    });

    this.emit({
      type: "error",
      timestamp: Date.now(),
      data: { event: String(event) },
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.inspector.add({
        severity: "error",
        source: "sidecar",
        message: `Failed to reconnect after ${this.config.maxReconnectAttempts} attempts`,
      });
      return;
    }

    this.state = "reconnecting";
    this.reconnectAttempts++;

    // Exponential backoff
    const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    this.inspector.add({
      severity: "info",
      source: "sidecar",
      message: `Reconnecting to sidecar in ${delay}ms (attempt ${this.reconnectAttempts})`,
    });

    this.reconnectTimer = setTimeout(() => {
      this.emit({ type: "reconnect", timestamp: Date.now() });
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private emit(event: StreamEvent): void {
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch {
        // Ignore callback errors
      }
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a SidecarLogStream instance.
 */
export function createSidecarLogStream(
  inspector: LogInspector,
  config?: Partial<SidecarLogStreamConfig>
): SidecarLogStream {
  return new SidecarLogStream(inspector, config);
}

/**
 * Creates and connects a SidecarLogStream instance.
 */
export function connectSidecarLogStream(
  inspector: LogInspector,
  config?: Partial<SidecarLogStreamConfig>
): SidecarLogStream {
  const stream = new SidecarLogStream(inspector, config);
  stream.connect();
  return stream;
}

// =============================================================================
// Mock WebSocket (for testing)
// =============================================================================

/** Mock CloseEvent for Node.js environment where CloseEvent is not available */
export class MockCloseEvent {
  readonly type: string;
  readonly code: number;
  readonly reason: string;
  readonly wasClean: boolean;

  constructor(type: string, init?: { code?: number; reason?: string; wasClean?: boolean }) {
    this.type = type;
    this.code = init?.code ?? 1000;
    this.reason = init?.reason ?? "";
    this.wasClean = init?.wasClean ?? true;
  }
}

/** Mock Event for Node.js environment */
export class MockEvent {
  readonly type: string;

  constructor(type: string) {
    this.type = type;
  }
}

/** Mock MessageEvent for Node.js environment */
export class MockMessageEvent {
  readonly type: string;
  readonly data: string;

  constructor(type: string, init?: { data?: string }) {
    this.type = type;
    this.data = init?.data ?? "";
  }
}

/** Mock WebSocket for testing */
export class MockWebSocket {
  static instances: MockWebSocket[] = [];

  onopen: ((event: MockEvent) => void) | null = null;
  onmessage: ((event: MockMessageEvent) => void) | null = null;
  onclose: ((event: MockCloseEvent) => void) | null = null;
  onerror: ((event: MockEvent) => void) | null = null;

  readonly url: string;
  readonly protocol: string;
  readyState: number = 0; // CONNECTING

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocol = Array.isArray(protocols) ? protocols[0] || "" : protocols || "";
    MockWebSocket.instances.push(this);
  }

  close(code?: number, reason?: string): void {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose(new MockCloseEvent("close", { code: code || 1000, reason: reason || "" }));
    }
  }

  /** Simulate connection open */
  simulateOpen(): void {
    this.readyState = 1; // OPEN
    if (this.onopen) {
      this.onopen(new MockEvent("open"));
    }
  }

  /** Simulate message received */
  simulateMessage(data: string): void {
    if (this.onmessage) {
      this.onmessage(new MockMessageEvent("message", { data }));
    }
  }

  /** Simulate error */
  simulateError(): void {
    if (this.onerror) {
      this.onerror(new MockEvent("error"));
    }
  }

  /** Simulate close */
  simulateClose(code?: number, reason?: string): void {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose(new MockCloseEvent("close", { code: code || 1000, reason: reason || "" }));
    }
  }

  static clearInstances(): void {
    MockWebSocket.instances = [];
  }

  static getLastInstance(): MockWebSocket | undefined {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }
}
