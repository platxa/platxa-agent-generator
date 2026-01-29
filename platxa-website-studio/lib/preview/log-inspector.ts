/**
 * LogInspector — Unified error/log aggregation for Platxa preview system.
 *
 * Collects and normalizes logs from multiple sources:
 * - SCSS compilation errors
 * - QWeb template parsing errors
 * - Odoo/preview runtime errors
 * - Message bridge errors
 *
 * Provides a unified stream for debugging and error reporting.
 */

// =============================================================================
// Types
// =============================================================================

/** Severity levels for log entries */
export type LogSeverity = "error" | "warning" | "info" | "debug";

/** Source of the log entry */
export type LogSource =
  | "scss"
  | "qweb"
  | "odoo"
  | "preview"
  | "bridge"
  | "hmr"
  | "unknown";

/** Unified log entry structure */
export interface LogEntry {
  /** Unique identifier for this log entry */
  id: string;
  /** Timestamp when the log was created */
  timestamp: number;
  /** Severity level */
  severity: LogSeverity;
  /** Source system that generated this log */
  source: LogSource;
  /** Human-readable message */
  message: string;
  /** Optional error code */
  code?: string;
  /** File path if applicable */
  file?: string;
  /** Line number if applicable */
  line?: number;
  /** Column number if applicable */
  column?: number;
  /** Additional context/details */
  details?: Record<string, unknown>;
  /** Stack trace if available */
  stack?: string;
}

/** Filter options for querying logs */
export interface LogFilter {
  /** Filter by severity levels */
  severity?: LogSeverity[];
  /** Filter by source systems */
  source?: LogSource[];
  /** Filter by time range (start timestamp) */
  since?: number;
  /** Filter by time range (end timestamp) */
  until?: number;
  /** Filter by file path pattern */
  filePattern?: RegExp;
  /** Maximum number of entries to return */
  limit?: number;
}

/** Options for LogInspector configuration */
export interface LogInspectorOptions {
  /** Maximum number of entries to keep in memory (default: 1000) */
  maxEntries?: number;
  /** Whether to include debug-level logs (default: false) */
  includeDebug?: boolean;
  /** Callback when new log is added */
  onLog?: (entry: LogEntry) => void;
  /** Callback when error-level log is added */
  onError?: (entry: LogEntry) => void;
}

/** Statistics about collected logs */
export interface LogStats {
  /** Total number of log entries */
  total: number;
  /** Count by severity */
  bySeverity: Record<LogSeverity, number>;
  /** Count by source */
  bySource: Record<LogSource, number>;
  /** Oldest entry timestamp */
  oldestTimestamp: number | null;
  /** Newest entry timestamp */
  newestTimestamp: number | null;
}

// =============================================================================
// LogInspector Class
// =============================================================================

/**
 * Aggregates errors and logs from all Platxa preview sources.
 *
 * @example
 * ```typescript
 * const inspector = new LogInspector({
 *   onError: (entry) => console.error('Error:', entry.message),
 * });
 *
 * // Add SCSS compilation error
 * inspector.addScssError({
 *   success: false,
 *   error: 'Invalid syntax',
 *   file: 'theme.scss',
 * });
 *
 * // Add QWeb parse errors
 * inspector.addQwebErrors(['Missing closing tag'], 'template.xml');
 *
 * // Get all errors
 * const errors = inspector.query({ severity: ['error'] });
 * ```
 */
export class LogInspector {
  private entries: LogEntry[] = [];
  private entryCounter = 0;
  private options: Required<LogInspectorOptions>;

  constructor(options: LogInspectorOptions = {}) {
    this.options = {
      maxEntries: options.maxEntries ?? 1000,
      includeDebug: options.includeDebug ?? false,
      onLog: options.onLog ?? (() => {}),
      onError: options.onError ?? (() => {}),
    };
  }

  // ---------------------------------------------------------------------------
  // Adding Logs from Different Sources
  // ---------------------------------------------------------------------------

  /**
   * Add an SCSS compilation result (error or success).
   */
  addScssResult(result: {
    success: boolean;
    error: string | null;
    file: string;
    durationMs?: number;
  }): LogEntry | null {
    if (result.success) {
      // Optionally log successful compilations as debug
      if (this.options.includeDebug) {
        return this.add({
          severity: "debug",
          source: "scss",
          message: `Compiled ${result.file} in ${result.durationMs ?? 0}ms`,
          file: result.file,
          details: { durationMs: result.durationMs },
        });
      }
      return null;
    }

    return this.add({
      severity: "error",
      source: "scss",
      message: result.error ?? "SCSS compilation failed",
      file: result.file,
      details: { durationMs: result.durationMs },
    });
  }

  /**
   * Add QWeb parsing errors.
   */
  addQwebErrors(
    errors: string[],
    file?: string,
    templateName?: string
  ): LogEntry[] {
    return errors.map((error) =>
      this.add({
        severity: "error",
        source: "qweb",
        message: error,
        file,
        details: templateName ? { templateName } : undefined,
      })
    );
  }

  /**
   * Add a single QWeb warning.
   */
  addQwebWarning(message: string, file?: string, line?: number): LogEntry {
    return this.add({
      severity: "warning",
      source: "qweb",
      message,
      file,
      line,
    });
  }

  /**
   * Add an Odoo/preview runtime error.
   */
  addOdooError(
    message: string,
    details?: {
      snippetId?: string;
      elementSelector?: string;
      stack?: string;
    }
  ): LogEntry {
    return this.add({
      severity: "error",
      source: "odoo",
      message,
      details: details as Record<string, unknown>,
      stack: details?.stack,
    });
  }

  /**
   * Add a preview/iframe error.
   */
  addPreviewError(
    message: string,
    details?: {
      url?: string;
      snippetId?: string;
      elementId?: string;
    }
  ): LogEntry {
    return this.add({
      severity: "error",
      source: "preview",
      message,
      details: details as Record<string, unknown>,
    });
  }

  /**
   * Add a message bridge error.
   */
  addBridgeError(
    error: {
      code?: string;
      message: string;
      details?: unknown;
    },
    context?: {
      messageType?: string;
      messageId?: string;
    }
  ): LogEntry {
    return this.add({
      severity: "error",
      source: "bridge",
      message: error.message,
      code: error.code,
      details: {
        ...context,
        errorDetails: error.details,
      },
    });
  }

  /**
   * Add an HMR-related log.
   */
  addHmrLog(
    severity: LogSeverity,
    message: string,
    details?: {
      updateType?: string;
      snippetId?: string;
      file?: string;
    }
  ): LogEntry {
    return this.add({
      severity,
      source: "hmr",
      message,
      file: details?.file,
      details: details as Record<string, unknown>,
    });
  }

  /**
   * Add a generic log entry.
   */
  add(
    entry: Omit<LogEntry, "id" | "timestamp"> & { timestamp?: number }
  ): LogEntry {
    const fullEntry: LogEntry = {
      id: this.generateId(),
      timestamp: entry.timestamp ?? Date.now(),
      severity: entry.severity,
      source: entry.source,
      message: entry.message,
      code: entry.code,
      file: entry.file,
      line: entry.line,
      column: entry.column,
      details: entry.details,
      stack: entry.stack,
    };

    // Skip debug if not included
    if (fullEntry.severity === "debug" && !this.options.includeDebug) {
      return fullEntry;
    }

    this.entries.push(fullEntry);

    // Enforce max entries limit
    if (this.entries.length > this.options.maxEntries) {
      this.entries.shift();
    }

    // Invoke callbacks
    this.options.onLog(fullEntry);
    if (fullEntry.severity === "error") {
      this.options.onError(fullEntry);
    }

    return fullEntry;
  }

  // ---------------------------------------------------------------------------
  // Querying Logs
  // ---------------------------------------------------------------------------

  /**
   * Query logs with optional filters.
   */
  query(filter?: LogFilter): LogEntry[] {
    let results = [...this.entries];

    if (filter) {
      if (filter.severity && filter.severity.length > 0) {
        results = results.filter((e) => filter.severity!.includes(e.severity));
      }

      if (filter.source && filter.source.length > 0) {
        results = results.filter((e) => filter.source!.includes(e.source));
      }

      if (filter.since !== undefined) {
        results = results.filter((e) => e.timestamp >= filter.since!);
      }

      if (filter.until !== undefined) {
        results = results.filter((e) => e.timestamp <= filter.until!);
      }

      if (filter.filePattern) {
        results = results.filter(
          (e) => e.file && filter.filePattern!.test(e.file)
        );
      }

      if (filter.limit !== undefined && filter.limit > 0) {
        results = results.slice(-filter.limit);
      }
    }

    return results;
  }

  /**
   * Get all errors (severity: error).
   */
  getErrors(): LogEntry[] {
    return this.query({ severity: ["error"] });
  }

  /**
   * Get all warnings (severity: warning).
   */
  getWarnings(): LogEntry[] {
    return this.query({ severity: ["warning"] });
  }

  /**
   * Get logs from a specific source.
   */
  getBySource(source: LogSource): LogEntry[] {
    return this.query({ source: [source] });
  }

  /**
   * Get logs for a specific file.
   */
  getByFile(file: string): LogEntry[] {
    return this.entries.filter((e) => e.file === file);
  }

  /**
   * Get the most recent N entries.
   */
  getRecent(count: number): LogEntry[] {
    return this.entries.slice(-count);
  }

  /**
   * Get a single entry by ID.
   */
  getById(id: string): LogEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  // ---------------------------------------------------------------------------
  // Statistics and Utilities
  // ---------------------------------------------------------------------------

  /**
   * Get statistics about collected logs.
   */
  getStats(): LogStats {
    const bySeverity: Record<LogSeverity, number> = {
      error: 0,
      warning: 0,
      info: 0,
      debug: 0,
    };

    const bySource: Record<LogSource, number> = {
      scss: 0,
      qweb: 0,
      odoo: 0,
      preview: 0,
      bridge: 0,
      hmr: 0,
      unknown: 0,
    };

    for (const entry of this.entries) {
      bySeverity[entry.severity]++;
      bySource[entry.source]++;
    }

    return {
      total: this.entries.length,
      bySeverity,
      bySource,
      oldestTimestamp: this.entries.length > 0 ? this.entries[0].timestamp : null,
      newestTimestamp:
        this.entries.length > 0
          ? this.entries[this.entries.length - 1].timestamp
          : null,
    };
  }

  /**
   * Check if there are any errors.
   */
  hasErrors(): boolean {
    return this.entries.some((e) => e.severity === "error");
  }

  /**
   * Get count of errors.
   */
  errorCount(): number {
    return this.entries.filter((e) => e.severity === "error").length;
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Clear entries matching a filter.
   */
  clearMatching(filter: LogFilter): number {
    const toRemove = new Set(this.query(filter).map((e) => e.id));
    const originalCount = this.entries.length;
    this.entries = this.entries.filter((e) => !toRemove.has(e.id));
    return originalCount - this.entries.length;
  }

  /**
   * Get all entries (for serialization/export).
   */
  getAll(): LogEntry[] {
    return [...this.entries];
  }

  /**
   * Export logs as a formatted string.
   */
  export(format: "text" | "json" = "text"): string {
    if (format === "json") {
      return JSON.stringify(this.entries, null, 2);
    }

    return this.entries
      .map((e) => {
        const time = new Date(e.timestamp).toISOString();
        const loc = e.file ? ` [${e.file}${e.line ? `:${e.line}` : ""}]` : "";
        return `[${time}] [${e.severity.toUpperCase()}] [${e.source}]${loc} ${e.message}`;
      })
      .join("\n");
  }

  // ---------------------------------------------------------------------------
  // Streaming Support
  // ---------------------------------------------------------------------------

  /**
   * Create a stream that yields new entries as they arrive.
   */
  createStream(): LogStream {
    return new LogStream(this);
  }

  /**
   * Subscribe to log entries matching a filter.
   */
  subscribe(
    callback: (entry: LogEntry) => void,
    filter?: Omit<LogFilter, "limit" | "since" | "until">
  ): () => void {
    const wrappedCallback = (entry: LogEntry) => {
      if (filter) {
        if (filter.severity && !filter.severity.includes(entry.severity)) {
          return;
        }
        if (filter.source && !filter.source.includes(entry.source)) {
          return;
        }
        if (filter.filePattern && entry.file && !filter.filePattern.test(entry.file)) {
          return;
        }
      }
      callback(entry);
    };

    // Store original onLog and wrap it
    const originalOnLog = this.options.onLog;
    this.options.onLog = (entry) => {
      originalOnLog(entry);
      wrappedCallback(entry);
    };

    // Return unsubscribe function
    return () => {
      this.options.onLog = originalOnLog;
    };
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private generateId(): string {
    this.entryCounter++;
    return `log_${Date.now()}_${this.entryCounter}`;
  }
}

// =============================================================================
// LogStream Class
// =============================================================================

/**
 * Stream interface for consuming logs in real-time.
 */
export class LogStream {
  private inspector: LogInspector;
  private callbacks: Array<(entry: LogEntry) => void> = [];
  private unsubscribe: (() => void) | null = null;

  constructor(inspector: LogInspector) {
    this.inspector = inspector;
  }

  /**
   * Start the stream.
   */
  start(): this {
    if (this.unsubscribe) return this;

    this.unsubscribe = this.inspector.subscribe((entry) => {
      for (const callback of this.callbacks) {
        callback(entry);
      }
    });

    return this;
  }

  /**
   * Stop the stream.
   */
  stop(): this {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    return this;
  }

  /**
   * Add a listener to the stream.
   */
  onEntry(callback: (entry: LogEntry) => void): this {
    this.callbacks.push(callback);
    return this;
  }

  /**
   * Filter stream to only errors.
   */
  onError(callback: (entry: LogEntry) => void): this {
    this.callbacks.push((entry) => {
      if (entry.severity === "error") {
        callback(entry);
      }
    });
    return this;
  }

  /**
   * Filter stream to specific sources.
   */
  onSource(sources: LogSource[], callback: (entry: LogEntry) => void): this {
    this.callbacks.push((entry) => {
      if (sources.includes(entry.source)) {
        callback(entry);
      }
    });
    return this;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new LogInspector instance.
 */
export function createLogInspector(
  options?: LogInspectorOptions
): LogInspector {
  return new LogInspector(options);
}

/**
 * Create a LogInspector that logs errors to console.
 */
export function createConsoleLogInspector(
  options?: Omit<LogInspectorOptions, "onError">
): LogInspector {
  return new LogInspector({
    ...options,
    onError: (entry) => {
      const loc = entry.file ? ` [${entry.file}${entry.line ? `:${entry.line}` : ""}]` : "";
      console.error(`[${entry.source}]${loc} ${entry.message}`);
      if (entry.stack) {
        console.error(entry.stack);
      }
    },
  });
}

/**
 * Parse an error object into a log entry.
 */
export function parseErrorToLogEntry(
  error: unknown,
  source: LogSource = "unknown"
): Omit<LogEntry, "id" | "timestamp"> {
  if (error instanceof Error) {
    return {
      severity: "error",
      source,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === "string") {
    return {
      severity: "error",
      source,
      message: error,
    };
  }

  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    return {
      severity: "error",
      source,
      message: String(obj.message ?? obj.error ?? "Unknown error"),
      code: obj.code as string | undefined,
      details: obj,
    };
  }

  return {
    severity: "error",
    source,
    message: String(error),
  };
}
