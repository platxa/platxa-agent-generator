/**
 * Odoo Sidecar Log Streaming — Runtime Error Detection
 *
 * Streams Odoo server logs via WebSocket connection and filters
 * for relevant entries (errors, warnings, template issues).
 */

// =============================================================================
// Types
// =============================================================================

/** Log severity levels */
export type LogLevel = "debug" | "info" | "warning" | "error" | "critical";

/** Log entry from Odoo server */
export interface OdooLogEntry {
  /** Unique entry ID */
  id: string;
  /** Timestamp of log entry */
  timestamp: Date;
  /** Log severity level */
  level: LogLevel;
  /** Logger name (module/component) */
  logger: string;
  /** Log message content */
  message: string;
  /** Optional stack trace for errors */
  stackTrace?: string;
  /** Optional additional context */
  context?: Record<string, unknown>;
  /** Whether this is a template/QWeb related error */
  isTemplateError?: boolean;
  /** Whether this is an SCSS/CSS related error */
  isStyleError?: boolean;
}

/** Log filter configuration */
export interface LogFilterConfig {
  /** Minimum log level to include */
  minLevel?: LogLevel;
  /** Logger names to include (empty = all) */
  includeLoggers?: string[];
  /** Logger names to exclude */
  excludeLoggers?: string[];
  /** Include only template-related errors */
  templateErrorsOnly?: boolean;
  /** Include only style-related errors */
  styleErrorsOnly?: boolean;
  /** Custom filter function */
  customFilter?: (entry: OdooLogEntry) => boolean;
}

/** WebSocket connection state */
export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

/** Log stream configuration */
export interface LogStreamConfig {
  /** WebSocket URL */
  url: string;
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect delay in ms */
  reconnectDelay?: number;
  /** Maximum reconnect attempts */
  maxReconnectAttempts?: number;
  /** Default log filters */
  defaultFilters?: LogFilterConfig;
}

/** Log stream event types */
export type LogStreamEvent =
  | { type: "connected" }
  | { type: "disconnected"; reason?: string }
  | { type: "error"; error: Error }
  | { type: "log"; entry: OdooLogEntry }
  | { type: "reconnecting"; attempt: number };

/** Event listener callback */
export type LogStreamListener = (event: LogStreamEvent) => void;

// =============================================================================
// Constants
// =============================================================================

/** Log level severity order (higher = more severe) */
export const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warning: 2,
  error: 3,
  critical: 4,
};

/** Log level display configuration */
export const LOG_LEVEL_CONFIG: Record<
  LogLevel,
  { label: string; color: string; bgColor: string }
> = {
  debug: {
    label: "DEBUG",
    color: "text-gray-500",
    bgColor: "bg-gray-100 dark:bg-gray-800",
  },
  info: {
    label: "INFO",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  warning: {
    label: "WARN",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  error: {
    label: "ERROR",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  critical: {
    label: "CRITICAL",
    color: "text-red-700 dark:text-red-300",
    bgColor: "bg-red-200 dark:bg-red-900/50",
  },
};

/** Default stream configuration */
export const DEFAULT_STREAM_CONFIG: Required<Omit<LogStreamConfig, "url">> = {
  autoReconnect: true,
  reconnectDelay: 3000,
  maxReconnectAttempts: 5,
  defaultFilters: {
    minLevel: "warning",
  },
};

/** Patterns to detect template errors */
export const TEMPLATE_ERROR_PATTERNS = [
  /qweb/i,
  /template/i,
  /t-\w+/i,
  /xml\s*error/i,
  /rendering\s*error/i,
  /view.*not\s*found/i,
  /invalid.*xpath/i,
];

/** Patterns to detect style errors */
export const STYLE_ERROR_PATTERNS = [
  /scss/i,
  /sass/i,
  /css/i,
  /stylesheet/i,
  /asset.*bundle/i,
  /lessc/i,
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Compares two log levels.
 * Returns positive if a > b, negative if a < b, 0 if equal.
 */
export function compareLogLevels(a: LogLevel, b: LogLevel): number {
  return LOG_LEVEL_ORDER[a] - LOG_LEVEL_ORDER[b];
}

/**
 * Checks if a log level meets the minimum threshold.
 */
export function meetsMinLevel(level: LogLevel, minLevel: LogLevel): boolean {
  return compareLogLevels(level, minLevel) >= 0;
}

/**
 * Detects if a log entry is template-related.
 */
export function isTemplateError(entry: OdooLogEntry): boolean {
  if (entry.isTemplateError !== undefined) return entry.isTemplateError;

  const text = `${entry.logger} ${entry.message} ${entry.stackTrace || ""}`;
  return TEMPLATE_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Detects if a log entry is style-related.
 */
export function isStyleError(entry: OdooLogEntry): boolean {
  if (entry.isStyleError !== undefined) return entry.isStyleError;

  const text = `${entry.logger} ${entry.message} ${entry.stackTrace || ""}`;
  return STYLE_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Filters log entries based on configuration.
 */
export function filterLogEntry(
  entry: OdooLogEntry,
  config: LogFilterConfig
): boolean {
  // Check minimum level
  if (config.minLevel && !meetsMinLevel(entry.level, config.minLevel)) {
    return false;
  }

  // Check included loggers
  if (config.includeLoggers && config.includeLoggers.length > 0) {
    const included = config.includeLoggers.some((logger) =>
      entry.logger.toLowerCase().includes(logger.toLowerCase())
    );
    if (!included) return false;
  }

  // Check excluded loggers
  if (config.excludeLoggers && config.excludeLoggers.length > 0) {
    const excluded = config.excludeLoggers.some((logger) =>
      entry.logger.toLowerCase().includes(logger.toLowerCase())
    );
    if (excluded) return false;
  }

  // Check template errors only
  if (config.templateErrorsOnly && !isTemplateError(entry)) {
    return false;
  }

  // Check style errors only
  if (config.styleErrorsOnly && !isStyleError(entry)) {
    return false;
  }

  // Custom filter
  if (config.customFilter && !config.customFilter(entry)) {
    return false;
  }

  return true;
}

/**
 * Parses a raw log line into a structured entry.
 */
export function parseLogLine(line: string, id?: string): OdooLogEntry | null {
  // Common Odoo log format: YYYY-MM-DD HH:MM:SS,mmm PID LEVEL logger: message
  const logPattern =
    /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3})\s+(\d+)\s+(DEBUG|INFO|WARNING|ERROR|CRITICAL)\s+([^:]+):\s*(.*)$/i;

  const match = line.match(logPattern);
  if (!match) {
    // Try simpler format: [LEVEL] logger: message
    const simplePattern = /^\[?(DEBUG|INFO|WARNING|ERROR|CRITICAL)\]?\s+([^:]+):\s*(.*)$/i;
    const simpleMatch = line.match(simplePattern);

    if (simpleMatch) {
      const entry: OdooLogEntry = {
        id: id || generateLogId(),
        timestamp: new Date(),
        level: simpleMatch[1].toLowerCase() as LogLevel,
        logger: simpleMatch[2].trim(),
        message: simpleMatch[3].trim(),
      };

      // Detect error types for simple format too
      entry.isTemplateError = isTemplateError(entry);
      entry.isStyleError = isStyleError(entry);

      return entry;
    }

    return null;
  }

  const entry: OdooLogEntry = {
    id: id || generateLogId(),
    timestamp: new Date(match[1].replace(",", ".")),
    level: match[3].toLowerCase() as LogLevel,
    logger: match[4].trim(),
    message: match[5].trim(),
  };

  // Detect error types
  entry.isTemplateError = isTemplateError(entry);
  entry.isStyleError = isStyleError(entry);

  return entry;
}

/**
 * Generates a unique log entry ID.
 */
let logIdCounter = 0;
export function generateLogId(): string {
  return `log-${Date.now()}-${++logIdCounter}`;
}

/**
 * Resets the log ID counter (for testing).
 */
export function resetLogIdCounter(): void {
  logIdCounter = 0;
}

/**
 * Formats a log entry for display.
 */
export function formatLogEntry(entry: OdooLogEntry): string {
  const timestamp = entry.timestamp.toISOString().slice(11, 23);
  const level = LOG_LEVEL_CONFIG[entry.level].label.padEnd(8);
  return `[${timestamp}] ${level} ${entry.logger}: ${entry.message}`;
}

/**
 * Groups log entries by logger.
 */
export function groupByLogger(
  entries: OdooLogEntry[]
): Record<string, OdooLogEntry[]> {
  return entries.reduce(
    (acc, entry) => {
      if (!acc[entry.logger]) {
        acc[entry.logger] = [];
      }
      acc[entry.logger].push(entry);
      return acc;
    },
    {} as Record<string, OdooLogEntry[]>
  );
}

/**
 * Gets error summary statistics.
 */
export function getErrorSummary(entries: OdooLogEntry[]): {
  total: number;
  byLevel: Record<LogLevel, number>;
  templateErrors: number;
  styleErrors: number;
} {
  const summary = {
    total: entries.length,
    byLevel: {
      debug: 0,
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    } as Record<LogLevel, number>,
    templateErrors: 0,
    styleErrors: 0,
  };

  for (const entry of entries) {
    summary.byLevel[entry.level]++;
    if (isTemplateError(entry)) summary.templateErrors++;
    if (isStyleError(entry)) summary.styleErrors++;
  }

  return summary;
}

// =============================================================================
// OdooLogStream Class
// =============================================================================

/**
 * Service for streaming and filtering Odoo server logs.
 */
export class OdooLogStream {
  private config: LogStreamConfig & Required<Omit<LogStreamConfig, "url">>;
  private ws: WebSocket | null = null;
  private state: ConnectionState = "disconnected";
  private listeners: Set<LogStreamListener> = new Set();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private filters: LogFilterConfig;
  private logBuffer: OdooLogEntry[] = [];
  private maxBufferSize = 1000;

  constructor(config: LogStreamConfig) {
    this.config = { ...DEFAULT_STREAM_CONFIG, ...config };
    this.filters = this.config.defaultFilters || {};
  }

  /**
   * Gets current connection state.
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Gets current filters.
   */
  getFilters(): LogFilterConfig {
    return { ...this.filters };
  }

  /**
   * Sets log filters.
   */
  setFilters(filters: LogFilterConfig): void {
    this.filters = filters;
  }

  /**
   * Gets buffered log entries.
   */
  getLogBuffer(): OdooLogEntry[] {
    return [...this.logBuffer];
  }

  /**
   * Gets filtered log entries from buffer.
   */
  getFilteredLogs(): OdooLogEntry[] {
    return this.logBuffer.filter((entry) => filterLogEntry(entry, this.filters));
  }

  /**
   * Clears the log buffer.
   */
  clearBuffer(): void {
    this.logBuffer = [];
  }

  /**
   * Adds an event listener.
   */
  addEventListener(listener: LogStreamListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Removes an event listener.
   */
  removeEventListener(listener: LogStreamListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Emits an event to all listeners.
   */
  private emit(event: LogStreamEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("Log stream listener error:", err);
      }
    }
  }

  /**
   * Connects to the WebSocket server.
   */
  connect(): void {
    if (this.state === "connected" || this.state === "connecting") {
      return;
    }

    this.state = "connecting";

    try {
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => {
        this.state = "connected";
        this.reconnectAttempts = 0;
        this.emit({ type: "connected" });
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (event) => {
        this.state = "error";
        this.emit({ type: "error", error: new Error("WebSocket error") });
      };

      this.ws.onclose = (event) => {
        this.state = "disconnected";
        this.emit({ type: "disconnected", reason: event.reason });
        this.handleReconnect();
      };
    } catch (err) {
      this.state = "error";
      this.emit({ type: "error", error: err as Error });
    }
  }

  /**
   * Disconnects from the WebSocket server.
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.state = "disconnected";
    this.reconnectAttempts = 0;
  }

  /**
   * Handles incoming WebSocket messages.
   */
  private handleMessage(data: string): void {
    const lines = data.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      const entry = parseLogLine(line);
      if (entry) {
        // Add to buffer
        this.logBuffer.push(entry);
        if (this.logBuffer.length > this.maxBufferSize) {
          this.logBuffer.shift();
        }

        // Emit if passes filter
        if (filterLogEntry(entry, this.filters)) {
          this.emit({ type: "log", entry });
        }
      }
    }
  }

  /**
   * Handles reconnection logic.
   */
  private handleReconnect(): void {
    if (!this.config.autoReconnect) return;
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) return;

    this.reconnectAttempts++;
    this.state = "reconnecting";
    this.emit({ type: "reconnecting", attempt: this.reconnectAttempts });

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.config.reconnectDelay);
  }

  /**
   * Manually triggers a reconnection.
   */
  reconnect(): void {
    this.disconnect();
    this.reconnectAttempts = 0;
    this.connect();
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates an OdooLogStream instance.
 */
export function createLogStream(config: LogStreamConfig): OdooLogStream {
  return new OdooLogStream(config);
}

/**
 * Creates a mock log entry for testing.
 */
export function createMockLogEntry(
  overrides: Partial<OdooLogEntry> = {}
): OdooLogEntry {
  return {
    id: generateLogId(),
    timestamp: new Date(),
    level: "error",
    logger: "odoo.test",
    message: "Test error message",
    ...overrides,
  };
}
