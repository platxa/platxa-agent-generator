/**
 * Log Severity Classification
 *
 * Feature #131: Create log severity classification (error, warning, info)
 * Verification: Each log entry has severity level; errors sorted first
 */

// ============================================================================
// Types
// ============================================================================

/** Log severity levels (ordered by priority, highest first) */
export type LogSeverity = "fatal" | "error" | "warning" | "info" | "debug" | "trace";

/** Log source identifier */
export type LogSource =
  | "console"
  | "runtime"
  | "network"
  | "qweb"
  | "scss"
  | "validation"
  | "agent"
  | "system"
  | "user";

/** Log category for grouping */
export type LogCategory =
  | "syntax"
  | "runtime"
  | "network"
  | "security"
  | "performance"
  | "deprecation"
  | "validation"
  | "general";

/** Structured log entry */
export interface LogEntry {
  /** Unique entry ID */
  id: string;
  /** Log message */
  message: string;
  /** Severity level */
  severity: LogSeverity;
  /** Log source */
  source: LogSource;
  /** Category */
  category: LogCategory;
  /** Timestamp */
  timestamp: number;
  /** File path (if applicable) */
  file?: string;
  /** Line number (if applicable) */
  line?: number;
  /** Column number (if applicable) */
  column?: number;
  /** Stack trace (if applicable) */
  stack?: string;
  /** Additional context */
  context?: Record<string, unknown>;
  /** Error code (if applicable) */
  code?: string;
  /** Whether entry has been read/acknowledged */
  read?: boolean;
}

/** Classification result */
export interface ClassificationResult {
  /** Detected severity */
  severity: LogSeverity;
  /** Confidence score (0-1) */
  confidence: number;
  /** Matched patterns */
  matchedPatterns: string[];
  /** Classification reason */
  reason: string;
}

/** Log filter options */
export interface LogFilterOptions {
  /** Minimum severity to include */
  minSeverity?: LogSeverity;
  /** Sources to include (empty = all) */
  sources?: LogSource[];
  /** Categories to include (empty = all) */
  categories?: LogCategory[];
  /** Text search query */
  search?: string;
  /** Only unread entries */
  unreadOnly?: boolean;
  /** Start timestamp */
  startTime?: number;
  /** End timestamp */
  endTime?: number;
  /** Maximum entries */
  limit?: number;
}

/** Log statistics */
export interface LogStats {
  /** Total entries */
  total: number;
  /** Counts by severity */
  bySeverity: Record<LogSeverity, number>;
  /** Counts by source */
  bySource: Record<LogSource, number>;
  /** Counts by category */
  byCategory: Record<LogCategory, number>;
  /** Unread count */
  unread: number;
  /** Most recent timestamp */
  lastTimestamp: number | null;
}

/** Sort order for logs */
export type SortOrder = "severity" | "time-asc" | "time-desc" | "source";

/** Log change event */
export interface LogChangeEvent {
  /** Type of change */
  type: "add" | "update" | "remove" | "clear";
  /** Affected entries */
  entries: LogEntry[];
  /** New stats */
  stats: LogStats;
}

/** Severity classification pattern */
export interface SeverityPattern {
  /** Pattern to match (regex or string) */
  pattern: RegExp | string;
  /** Resulting severity */
  severity: LogSeverity;
  /** Pattern weight for confidence */
  weight: number;
  /** Description */
  description: string;
}

/** Log change callback */
export type LogChangeCallback = (event: LogChangeEvent) => void;

/** Classifier options */
export interface LogSeverityClassifierOptions {
  /** Custom severity patterns */
  customPatterns?: SeverityPattern[];
  /** Default severity if no pattern matches */
  defaultSeverity?: LogSeverity;
  /** Maximum entries to store */
  maxEntries?: number;
  /** Auto-classify on add */
  autoClassify?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Severity priority (lower = higher priority) */
export const SEVERITY_PRIORITY: Record<LogSeverity, number> = {
  fatal: 0,
  error: 1,
  warning: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

/** Severity labels */
export const SEVERITY_LABELS: Record<LogSeverity, string> = {
  fatal: "Fatal",
  error: "Error",
  warning: "Warning",
  info: "Info",
  debug: "Debug",
  trace: "Trace",
};

/** Severity colors (for UI) */
export const SEVERITY_COLORS: Record<LogSeverity, string> = {
  fatal: "#dc2626",
  error: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
  debug: "#6b7280",
  trace: "#9ca3af",
};

/** Severity icons */
export const SEVERITY_ICONS: Record<LogSeverity, string> = {
  fatal: "x-circle",
  error: "alert-circle",
  warning: "alert-triangle",
  info: "info",
  debug: "bug",
  trace: "activity",
};

/** Built-in severity patterns */
export const SEVERITY_PATTERNS: SeverityPattern[] = [
  // Fatal patterns
  { pattern: /\bfatal\b/i, severity: "fatal", weight: 1.0, description: "Contains 'fatal'" },
  { pattern: /\bcrash(ed|ing)?\b/i, severity: "fatal", weight: 0.9, description: "Contains 'crash'" },
  { pattern: /\bunrecoverable\b/i, severity: "fatal", weight: 0.9, description: "Contains 'unrecoverable'" },
  { pattern: /out of memory/i, severity: "fatal", weight: 0.9, description: "Out of memory" },

  // Error patterns
  { pattern: /\berror\b/i, severity: "error", weight: 0.9, description: "Contains 'error'" },
  { pattern: /\bexception\b/i, severity: "error", weight: 0.9, description: "Contains 'exception'" },
  { pattern: /\bfailed\b/i, severity: "error", weight: 0.8, description: "Contains 'failed'" },
  { pattern: /\bfailure\b/i, severity: "error", weight: 0.8, description: "Contains 'failure'" },
  { pattern: /\bcannot\b/i, severity: "error", weight: 0.7, description: "Contains 'cannot'" },
  { pattern: /\bunable to\b/i, severity: "error", weight: 0.7, description: "Contains 'unable to'" },
  { pattern: /\binvalid\b/i, severity: "error", weight: 0.6, description: "Contains 'invalid'" },
  { pattern: /\bundefined\b.*\bnot\b/i, severity: "error", weight: 0.7, description: "Undefined reference" },
  { pattern: /\bnull\b.*\breference\b/i, severity: "error", weight: 0.8, description: "Null reference" },
  { pattern: /TypeError:/i, severity: "error", weight: 0.95, description: "TypeError" },
  { pattern: /ReferenceError:/i, severity: "error", weight: 0.95, description: "ReferenceError" },
  { pattern: /SyntaxError:/i, severity: "error", weight: 0.95, description: "SyntaxError" },
  { pattern: /RangeError:/i, severity: "error", weight: 0.95, description: "RangeError" },
  { pattern: /\b[45]\d{2}\b/, severity: "error", weight: 0.6, description: "HTTP error status" },

  // Warning patterns
  { pattern: /\bwarning\b/i, severity: "warning", weight: 0.9, description: "Contains 'warning'" },
  { pattern: /\bwarn\b/i, severity: "warning", weight: 0.8, description: "Contains 'warn'" },
  { pattern: /\bdeprecated\b/i, severity: "warning", weight: 0.85, description: "Deprecated" },
  { pattern: /\bexperimental\b/i, severity: "warning", weight: 0.6, description: "Experimental" },
  { pattern: /\bunsafe\b/i, severity: "warning", weight: 0.7, description: "Contains 'unsafe'" },
  { pattern: /\bslow\b/i, severity: "warning", weight: 0.5, description: "Performance warning" },
  { pattern: /\bmissing\b/i, severity: "warning", weight: 0.6, description: "Contains 'missing'" },
  { pattern: /\bfallback\b/i, severity: "warning", weight: 0.5, description: "Using fallback" },
  { pattern: /\bretry\b/i, severity: "warning", weight: 0.5, description: "Retry needed" },

  // Info patterns
  { pattern: /\binfo\b/i, severity: "info", weight: 0.7, description: "Contains 'info'" },
  { pattern: /\bstarted\b/i, severity: "info", weight: 0.6, description: "Started" },
  { pattern: /\bcompleted\b/i, severity: "info", weight: 0.6, description: "Completed" },
  { pattern: /\bsuccess(ful)?\b/i, severity: "info", weight: 0.7, description: "Success" },
  { pattern: /\bloaded\b/i, severity: "info", weight: 0.5, description: "Loaded" },
  { pattern: /\binitialized\b/i, severity: "info", weight: 0.5, description: "Initialized" },

  // Debug patterns
  { pattern: /\bdebug\b/i, severity: "debug", weight: 0.8, description: "Contains 'debug'" },
  { pattern: /\btrace\b/i, severity: "trace", weight: 0.8, description: "Contains 'trace'" },
  { pattern: /\bverbose\b/i, severity: "trace", weight: 0.7, description: "Verbose output" },
];

/** Source detection patterns */
export const SOURCE_PATTERNS: Array<{ pattern: RegExp; source: LogSource }> = [
  { pattern: /console\.(log|warn|error|info|debug)/i, source: "console" },
  { pattern: /\bqweb\b/i, source: "qweb" },
  { pattern: /\bscss\b|\bsass\b/i, source: "scss" },
  { pattern: /\bfetch\b|\bxhr\b|\bhttp\b|\bnetwork\b/i, source: "network" },
  { pattern: /\bvalidat/i, source: "validation" },
  { pattern: /\bagent\b/i, source: "agent" },
];

/** Category detection patterns */
export const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: LogCategory }> = [
  { pattern: /syntax|parse|token|unexpected/i, category: "syntax" },
  { pattern: /runtime|execution|call\s+stack/i, category: "runtime" },
  { pattern: /network|fetch|xhr|http|cors|ssl/i, category: "network" },
  { pattern: /security|xss|csrf|injection|auth/i, category: "security" },
  { pattern: /performance|slow|memory|leak|optimize/i, category: "performance" },
  { pattern: /deprecated|legacy|obsolete/i, category: "deprecation" },
  { pattern: /validat|schema|constraint/i, category: "validation" },
];

/** Default maximum entries */
export const DEFAULT_MAX_ENTRIES = 1000;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate unique log entry ID
 */
export function generateLogId(): string {
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Compare severity levels
 * @returns negative if a is more severe, positive if b is more severe
 */
export function compareSeverity(a: LogSeverity, b: LogSeverity): number {
  return SEVERITY_PRIORITY[a] - SEVERITY_PRIORITY[b];
}

/**
 * Check if severity meets minimum threshold
 */
export function meetsSeverityThreshold(
  severity: LogSeverity,
  minSeverity: LogSeverity
): boolean {
  return SEVERITY_PRIORITY[severity] <= SEVERITY_PRIORITY[minSeverity];
}

/**
 * Get severity from priority number
 */
export function getSeverityFromPriority(priority: number): LogSeverity {
  const entries = Object.entries(SEVERITY_PRIORITY) as [LogSeverity, number][];
  const found = entries.find(([, p]) => p === priority);
  return found?.[0] ?? "info";
}

/**
 * Classify message severity
 */
export function classifyMessage(
  message: string,
  patterns: SeverityPattern[] = SEVERITY_PATTERNS
): ClassificationResult {
  const matchedPatterns: string[] = [];
  let highestSeverity: LogSeverity = "info";
  let highestWeight = 0;
  let reason = "Default severity";

  for (const { pattern, severity, weight, description } of patterns) {
    const regex = typeof pattern === "string" ? new RegExp(pattern, "i") : pattern;
    if (regex.test(message)) {
      matchedPatterns.push(description);

      // Use highest weight match for severity
      if (weight > highestWeight) {
        highestWeight = weight;
        highestSeverity = severity;
        reason = description;
      } else if (weight === highestWeight && compareSeverity(severity, highestSeverity) < 0) {
        // Same weight, but more severe
        highestSeverity = severity;
        reason = description;
      }
    }
  }

  return {
    severity: highestSeverity,
    confidence: matchedPatterns.length > 0 ? highestWeight : 0.1,
    matchedPatterns,
    reason,
  };
}

/**
 * Detect log source from message
 */
export function detectSource(message: string): LogSource {
  for (const { pattern, source } of SOURCE_PATTERNS) {
    if (pattern.test(message)) {
      return source;
    }
  }
  return "system";
}

/**
 * Detect log category from message
 */
export function detectCategory(message: string): LogCategory {
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(message)) {
      return category;
    }
  }
  return "general";
}

/**
 * Create a log entry
 */
export function createLogEntry(
  message: string,
  options: Partial<Omit<LogEntry, "id" | "message">> = {}
): LogEntry {
  const classification = classifyMessage(message);

  return {
    id: generateLogId(),
    message,
    severity: options.severity ?? classification.severity,
    source: options.source ?? detectSource(message),
    category: options.category ?? detectCategory(message),
    timestamp: options.timestamp ?? Date.now(),
    file: options.file,
    line: options.line,
    column: options.column,
    stack: options.stack,
    context: options.context,
    code: options.code,
    read: options.read ?? false,
  };
}

/**
 * Sort log entries (errors first by default)
 */
export function sortLogEntries(entries: LogEntry[], order: SortOrder = "severity"): LogEntry[] {
  const sorted = [...entries];

  switch (order) {
    case "severity":
      sorted.sort((a, b) => {
        const severityDiff = compareSeverity(a.severity, b.severity);
        if (severityDiff !== 0) return severityDiff;
        return b.timestamp - a.timestamp; // Secondary: newest first
      });
      break;

    case "time-asc":
      sorted.sort((a, b) => a.timestamp - b.timestamp);
      break;

    case "time-desc":
      sorted.sort((a, b) => b.timestamp - a.timestamp);
      break;

    case "source":
      sorted.sort((a, b) => {
        const sourceCompare = a.source.localeCompare(b.source);
        if (sourceCompare !== 0) return sourceCompare;
        return compareSeverity(a.severity, b.severity);
      });
      break;
  }

  return sorted;
}

/**
 * Filter log entries
 */
export function filterLogEntries(
  entries: LogEntry[],
  options: LogFilterOptions
): LogEntry[] {
  let filtered = [...entries];

  if (options.minSeverity) {
    filtered = filtered.filter((e) =>
      meetsSeverityThreshold(e.severity, options.minSeverity!)
    );
  }

  if (options.sources && options.sources.length > 0) {
    filtered = filtered.filter((e) => options.sources!.includes(e.source));
  }

  if (options.categories && options.categories.length > 0) {
    filtered = filtered.filter((e) => options.categories!.includes(e.category));
  }

  if (options.search) {
    const searchLower = options.search.toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.message.toLowerCase().includes(searchLower) ||
        e.file?.toLowerCase().includes(searchLower) ||
        e.code?.toLowerCase().includes(searchLower)
    );
  }

  if (options.unreadOnly) {
    filtered = filtered.filter((e) => !e.read);
  }

  if (options.startTime !== undefined) {
    filtered = filtered.filter((e) => e.timestamp >= options.startTime!);
  }

  if (options.endTime !== undefined) {
    filtered = filtered.filter((e) => e.timestamp <= options.endTime!);
  }

  if (options.limit !== undefined && options.limit > 0) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

/**
 * Calculate log statistics
 */
export function calculateLogStats(entries: LogEntry[]): LogStats {
  const stats: LogStats = {
    total: entries.length,
    bySeverity: { fatal: 0, error: 0, warning: 0, info: 0, debug: 0, trace: 0 },
    bySource: {
      console: 0,
      runtime: 0,
      network: 0,
      qweb: 0,
      scss: 0,
      validation: 0,
      agent: 0,
      system: 0,
      user: 0,
    },
    byCategory: {
      syntax: 0,
      runtime: 0,
      network: 0,
      security: 0,
      performance: 0,
      deprecation: 0,
      validation: 0,
      general: 0,
    },
    unread: 0,
    lastTimestamp: null,
  };

  for (const entry of entries) {
    stats.bySeverity[entry.severity]++;
    stats.bySource[entry.source]++;
    stats.byCategory[entry.category]++;

    if (!entry.read) {
      stats.unread++;
    }

    if (stats.lastTimestamp === null || entry.timestamp > stats.lastTimestamp) {
      stats.lastTimestamp = entry.timestamp;
    }
  }

  return stats;
}

/**
 * Format log entry for display
 */
export function formatLogEntry(entry: LogEntry): string {
  const time = new Date(entry.timestamp).toISOString();
  const location = entry.file
    ? ` at ${entry.file}${entry.line ? `:${entry.line}` : ""}${entry.column ? `:${entry.column}` : ""}`
    : "";

  return `[${time}] [${entry.severity.toUpperCase()}] [${entry.source}] ${entry.message}${location}`;
}

// ============================================================================
// LogSeverityClassifier Class
// ============================================================================

/**
 * Log severity classifier and manager
 */
export class LogSeverityClassifier {
  private entries: Map<string, LogEntry> = new Map();
  private patterns: SeverityPattern[];
  private defaultSeverity: LogSeverity;
  private maxEntries: number;
  private autoClassify: boolean;
  private changeCallbacks: Set<LogChangeCallback> = new Set();
  private disposed = false;

  constructor(options: LogSeverityClassifierOptions = {}) {
    this.patterns = [...SEVERITY_PATTERNS, ...(options.customPatterns ?? [])];
    this.defaultSeverity = options.defaultSeverity ?? "info";
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.autoClassify = options.autoClassify ?? true;
  }

  /**
   * Add a log entry
   */
  add(entry: LogEntry | string, options?: Partial<Omit<LogEntry, "id" | "message">>): LogEntry {
    if (this.disposed) {
      throw new Error("LogSeverityClassifier is disposed");
    }

    let logEntry: LogEntry;

    if (typeof entry === "string") {
      logEntry = createLogEntry(entry, options);
      if (this.autoClassify) {
        const classification = this.classify(entry);
        logEntry.severity = classification.severity;
      }
    } else {
      logEntry = { ...entry };
      if (!logEntry.id) {
        logEntry.id = generateLogId();
      }
    }

    // Enforce max entries
    if (this.entries.size >= this.maxEntries) {
      this.removeOldest();
    }

    this.entries.set(logEntry.id, logEntry);
    this.notifyChange("add", [logEntry]);

    return logEntry;
  }

  /**
   * Add multiple entries
   */
  addBatch(entries: Array<LogEntry | string>): LogEntry[] {
    const added: LogEntry[] = [];
    for (const entry of entries) {
      added.push(this.add(entry));
    }
    return added;
  }

  /**
   * Get entry by ID
   */
  get(id: string): LogEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Get all entries
   */
  getAll(sortOrder: SortOrder = "severity"): LogEntry[] {
    return sortLogEntries(Array.from(this.entries.values()), sortOrder);
  }

  /**
   * Get filtered entries
   */
  getFiltered(options: LogFilterOptions, sortOrder: SortOrder = "severity"): LogEntry[] {
    const all = Array.from(this.entries.values());
    const filtered = filterLogEntries(all, options);
    return sortLogEntries(filtered, sortOrder);
  }

  /**
   * Get entries by severity
   */
  getBySeverity(severity: LogSeverity): LogEntry[] {
    return Array.from(this.entries.values()).filter((e) => e.severity === severity);
  }

  /**
   * Get error and fatal entries (errors sorted first)
   */
  getErrors(): LogEntry[] {
    return this.getFiltered({ minSeverity: "error" }, "severity");
  }

  /**
   * Get warnings
   */
  getWarnings(): LogEntry[] {
    return this.getBySeverity("warning");
  }

  /**
   * Update entry
   */
  update(id: string, updates: Partial<Omit<LogEntry, "id">>): boolean {
    if (this.disposed) {
      throw new Error("LogSeverityClassifier is disposed");
    }

    const entry = this.entries.get(id);
    if (!entry) return false;

    const updated = { ...entry, ...updates };
    this.entries.set(id, updated);
    this.notifyChange("update", [updated]);

    return true;
  }

  /**
   * Mark entry as read
   */
  markRead(id: string): boolean {
    return this.update(id, { read: true });
  }

  /**
   * Mark all entries as read
   */
  markAllRead(): number {
    let count = 0;
    for (const entry of this.entries.values()) {
      if (!entry.read) {
        entry.read = true;
        count++;
      }
    }
    if (count > 0) {
      this.notifyChange("update", Array.from(this.entries.values()));
    }
    return count;
  }

  /**
   * Remove entry
   */
  remove(id: string): boolean {
    if (this.disposed) {
      throw new Error("LogSeverityClassifier is disposed");
    }

    const entry = this.entries.get(id);
    if (!entry) return false;

    this.entries.delete(id);
    this.notifyChange("remove", [entry]);

    return true;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    if (this.disposed) {
      throw new Error("LogSeverityClassifier is disposed");
    }

    const entries = Array.from(this.entries.values());
    this.entries.clear();
    this.notifyChange("clear", entries);
  }

  /**
   * Get statistics
   */
  getStats(): LogStats {
    return calculateLogStats(Array.from(this.entries.values()));
  }

  /**
   * Classify a message
   */
  classify(message: string): ClassificationResult {
    return classifyMessage(message, this.patterns);
  }

  /**
   * Add custom pattern
   */
  addPattern(pattern: SeverityPattern): void {
    if (this.disposed) {
      throw new Error("LogSeverityClassifier is disposed");
    }
    this.patterns.push(pattern);
  }

  /**
   * Get patterns
   */
  getPatterns(): SeverityPattern[] {
    return [...this.patterns];
  }

  /**
   * Subscribe to changes
   */
  onChange(callback: LogChangeCallback): () => void {
    if (this.disposed) {
      throw new Error("LogSeverityClassifier is disposed");
    }

    this.changeCallbacks.add(callback);
    return () => {
      this.changeCallbacks.delete(callback);
    };
  }

  /**
   * Check if disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose
   */
  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.entries.clear();
    this.changeCallbacks.clear();
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  private removeOldest(): void {
    // Find oldest entry
    let oldest: LogEntry | null = null;
    for (const entry of this.entries.values()) {
      if (!oldest || entry.timestamp < oldest.timestamp) {
        oldest = entry;
      }
    }
    if (oldest) {
      this.entries.delete(oldest.id);
    }
  }

  private notifyChange(
    type: "add" | "update" | "remove" | "clear",
    entries: LogEntry[]
  ): void {
    const event: LogChangeEvent = {
      type,
      entries,
      stats: this.getStats(),
    };

    for (const callback of this.changeCallbacks) {
      try {
        callback(event);
      } catch (err) {
        console.error("LogSeverityClassifier callback error:", err);
      }
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new LogSeverityClassifier instance
 */
export function createLogSeverityClassifier(
  options?: LogSeverityClassifierOptions
): LogSeverityClassifier {
  return new LogSeverityClassifier(options);
}
