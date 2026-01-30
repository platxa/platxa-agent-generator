/**
 * Error Deduplication
 *
 * Feature #136: Implement error deduplication for repeated issues
 * Verification: Same error from multiple places collapsed into single issue with count
 */

// ============================================================================
// Types
// ============================================================================

/** Error fingerprint for deduplication */
export type ErrorFingerprint = string;

/** Fingerprint strategy */
export type FingerprintStrategy =
  | "message"
  | "message-and-type"
  | "message-and-file"
  | "message-and-stack"
  | "custom";

/** Error occurrence location */
export interface ErrorLocation {
  /** File path */
  file?: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Function name */
  function?: string;
  /** Timestamp of occurrence */
  timestamp: number;
}

/** Raw error input */
export interface ErrorInput {
  /** Error message */
  message: string;
  /** Error type (e.g., TypeError, SyntaxError) */
  type?: string;
  /** Stack trace */
  stack?: string;
  /** Source file */
  file?: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Error code */
  code?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/** Deduplicated error group */
export interface ErrorGroup {
  /** Unique fingerprint */
  fingerprint: ErrorFingerprint;
  /** Representative error message */
  message: string;
  /** Error type */
  type?: string;
  /** Error code */
  code?: string;
  /** Total occurrence count */
  count: number;
  /** First occurrence timestamp */
  firstSeen: number;
  /** Last occurrence timestamp */
  lastSeen: number;
  /** All occurrence locations */
  locations: ErrorLocation[];
  /** Unique files where error occurred */
  uniqueFiles: Set<string>;
  /** Sample stack trace */
  sampleStack?: string;
  /** Additional context from first occurrence */
  context?: Record<string, unknown>;
  /** Whether group is muted/acknowledged */
  muted: boolean;
  /** Whether group has been viewed */
  viewed: boolean;
}

/** Deduplication statistics */
export interface DeduplicationStats {
  /** Total raw errors received */
  totalErrors: number;
  /** Number of unique error groups */
  uniqueGroups: number;
  /** Deduplication ratio (1 - unique/total) */
  deduplicationRatio: number;
  /** Most frequent error fingerprint */
  mostFrequent: ErrorFingerprint | null;
  /** Most frequent count */
  mostFrequentCount: number;
  /** Errors by type */
  byType: Map<string, number>;
  /** Errors by file */
  byFile: Map<string, number>;
}

/** Group change event */
export interface GroupChangeEvent {
  /** Type of change */
  type: "add" | "update" | "remove" | "clear";
  /** Affected group */
  group: ErrorGroup | null;
  /** Current stats */
  stats: DeduplicationStats;
}

/** Group change callback */
export type GroupChangeCallback = (event: GroupChangeEvent) => void;

/** Threshold callback (triggered when error exceeds threshold) */
export type ThresholdCallback = (group: ErrorGroup) => void;

/** Custom fingerprint function */
export type CustomFingerprinter = (error: ErrorInput) => ErrorFingerprint;

/** Deduplicator options */
export interface ErrorDeduplicatorOptions {
  /** Fingerprinting strategy */
  strategy?: FingerprintStrategy;
  /** Custom fingerprint function (if strategy is 'custom') */
  customFingerprinter?: CustomFingerprinter;
  /** Maximum locations to store per group */
  maxLocationsPerGroup?: number;
  /** Maximum groups to store */
  maxGroups?: number;
  /** Threshold count for notification */
  thresholdCount?: number;
  /** Time window for rate limiting (ms) */
  rateWindow?: number;
  /** Normalize messages before fingerprinting */
  normalizeMessages?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Default max locations per group */
export const DEFAULT_MAX_LOCATIONS = 100;

/** Default max groups */
export const DEFAULT_MAX_GROUPS = 500;

/** Default threshold count */
export const DEFAULT_THRESHOLD_COUNT = 10;

/** Default rate window (1 minute) */
export const DEFAULT_RATE_WINDOW = 60000;

/** Message normalization patterns - ORDER MATTERS: specific patterns first, general last */
export const NORMALIZATION_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // 1. Most specific patterns first (before numbers corrupt them)
  // Replace timestamps (contains numbers in specific format)
  { pattern: /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, replacement: "<TIMESTAMP>" },
  // Replace UUIDs (contains hex digits in specific format)
  { pattern: /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, replacement: "<UUID>" },
  // Replace URLs (must run before path pattern)
  { pattern: /https?:\/\/[^\s"'<>]+/g, replacement: "<URL>" },
  // Replace file paths with extensions
  { pattern: /(?:\/[\w\-./]+)+\.\w+/g, replacement: "<PATH>" },
  // Replace hex values (0x prefix)
  { pattern: /0x[a-f0-9]+/gi, replacement: "<HEX>" },

  // 2. General patterns last
  // Replace quoted strings
  { pattern: /"[^"]*"/g, replacement: '"<STR>"' },
  { pattern: /'[^']*'/g, replacement: "'<STR>'" },
  // Replace numbers (must be last - would corrupt specific patterns above)
  { pattern: /\b\d+\b/g, replacement: "<N>" },
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate unique group ID
 */
export function generateGroupId(): string {
  return `grp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Normalize error message for fingerprinting
 */
export function normalizeMessage(message: string): string {
  let normalized = message.trim();

  for (const { pattern, replacement } of NORMALIZATION_PATTERNS) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.toLowerCase();
}

/**
 * Extract error type from message or stack
 */
export function extractErrorType(error: ErrorInput): string {
  if (error.type) return error.type;

  // Try to extract from message
  const messageMatch = error.message.match(/^(\w+Error):/);
  if (messageMatch) return messageMatch[1];

  // Try to extract from stack
  if (error.stack) {
    const stackMatch = error.stack.match(/^(\w+Error):/);
    if (stackMatch) return stackMatch[1];
  }

  return "Error";
}

/**
 * Generate fingerprint using message strategy
 */
export function fingerprintByMessage(error: ErrorInput, normalize: boolean = true): ErrorFingerprint {
  const message = normalize ? normalizeMessage(error.message) : error.message;
  return hashString(message);
}

/**
 * Generate fingerprint using message and type
 */
export function fingerprintByMessageAndType(error: ErrorInput, normalize: boolean = true): ErrorFingerprint {
  const message = normalize ? normalizeMessage(error.message) : error.message;
  const type = extractErrorType(error);
  return hashString(`${type}:${message}`);
}

/**
 * Generate fingerprint using message and file
 */
export function fingerprintByMessageAndFile(error: ErrorInput, normalize: boolean = true): ErrorFingerprint {
  const message = normalize ? normalizeMessage(error.message) : error.message;
  const file = error.file ?? "unknown";
  return hashString(`${file}:${message}`);
}

/**
 * Generate fingerprint using message and stack
 */
export function fingerprintByMessageAndStack(error: ErrorInput, normalize: boolean = true): ErrorFingerprint {
  const message = normalize ? normalizeMessage(error.message) : error.message;
  // Use first 3 lines of stack for fingerprinting
  const stackLines = (error.stack ?? "").split("\n").slice(0, 3).join("\n");
  return hashString(`${message}:${stackLines}`);
}

/**
 * Simple string hash function
 */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to positive hex string
  return Math.abs(hash).toString(16).padStart(8, "0");
}

/**
 * Create error location from input
 */
export function createErrorLocation(error: ErrorInput): ErrorLocation {
  return {
    file: error.file,
    line: error.line,
    column: error.column,
    timestamp: Date.now(),
  };
}

/**
 * Check if location is unique in array
 */
export function isUniqueLocation(location: ErrorLocation, locations: ErrorLocation[]): boolean {
  return !locations.some(
    (loc) =>
      loc.file === location.file &&
      loc.line === location.line &&
      loc.column === location.column
  );
}

/**
 * Format error group for display
 */
export function formatErrorGroup(group: ErrorGroup): string {
  const files = Array.from(group.uniqueFiles).join(", ");
  const age = Date.now() - group.firstSeen;
  const ageStr = formatDuration(age);

  return `[${group.count}x] ${group.message}\n` +
    `  Type: ${group.type ?? "Error"}\n` +
    `  Files: ${files || "N/A"}\n` +
    `  First seen: ${ageStr} ago`;
}

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
  return `${Math.floor(ms / 3600000)}h`;
}

/**
 * Sort groups by count (most frequent first)
 */
export function sortByCount(groups: ErrorGroup[]): ErrorGroup[] {
  return [...groups].sort((a, b) => b.count - a.count);
}

/**
 * Sort groups by last seen (most recent first)
 */
export function sortByRecent(groups: ErrorGroup[]): ErrorGroup[] {
  return [...groups].sort((a, b) => b.lastSeen - a.lastSeen);
}

/**
 * Get occurrences in time window
 */
export function getOccurrencesInWindow(group: ErrorGroup, windowMs: number): number {
  const cutoff = Date.now() - windowMs;
  return group.locations.filter((loc) => loc.timestamp >= cutoff).length;
}

// ============================================================================
// ErrorDeduplicator Class
// ============================================================================

/**
 * Error deduplicator for collapsing repeated errors
 */
export class ErrorDeduplicator {
  private groups: Map<ErrorFingerprint, ErrorGroup> = new Map();
  private strategy: FingerprintStrategy;
  private customFingerprinter?: CustomFingerprinter;
  private maxLocationsPerGroup: number;
  private maxGroups: number;
  private thresholdCount: number;
  private rateWindow: number;
  private normalizeMessages: boolean;
  private totalErrors = 0;

  private changeCallbacks: Set<GroupChangeCallback> = new Set();
  private thresholdCallbacks: Set<ThresholdCallback> = new Set();
  private disposed = false;

  constructor(options: ErrorDeduplicatorOptions = {}) {
    this.strategy = options.strategy ?? "message-and-type";
    this.customFingerprinter = options.customFingerprinter;
    this.maxLocationsPerGroup = options.maxLocationsPerGroup ?? DEFAULT_MAX_LOCATIONS;
    this.maxGroups = options.maxGroups ?? DEFAULT_MAX_GROUPS;
    this.thresholdCount = options.thresholdCount ?? DEFAULT_THRESHOLD_COUNT;
    this.rateWindow = options.rateWindow ?? DEFAULT_RATE_WINDOW;
    this.normalizeMessages = options.normalizeMessages ?? true;
  }

  /**
   * Add an error and get deduplicated group
   */
  add(error: ErrorInput): ErrorGroup {
    if (this.disposed) {
      throw new Error("ErrorDeduplicator is disposed");
    }

    this.totalErrors++;

    const fingerprint = this.generateFingerprint(error);
    const existingGroup = this.groups.get(fingerprint);

    if (existingGroup) {
      return this.updateGroup(existingGroup, error);
    } else {
      return this.createGroup(fingerprint, error);
    }
  }

  /**
   * Add multiple errors
   */
  addBatch(errors: ErrorInput[]): ErrorGroup[] {
    return errors.map((error) => this.add(error));
  }

  /**
   * Get group by fingerprint
   */
  get(fingerprint: ErrorFingerprint): ErrorGroup | undefined {
    return this.groups.get(fingerprint);
  }

  /**
   * Get all groups
   */
  getAll(): ErrorGroup[] {
    return Array.from(this.groups.values());
  }

  /**
   * Get groups sorted by count (most frequent first)
   */
  getMostFrequent(limit?: number): ErrorGroup[] {
    const sorted = sortByCount(this.getAll());
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /**
   * Get groups sorted by recent occurrence
   */
  getMostRecent(limit?: number): ErrorGroup[] {
    const sorted = sortByRecent(this.getAll());
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /**
   * Get groups exceeding threshold
   */
  getAboveThreshold(): ErrorGroup[] {
    return this.getAll().filter((g) => g.count >= this.thresholdCount);
  }

  /**
   * Get groups with high rate in window
   */
  getHighRate(minOccurrences: number = 5): ErrorGroup[] {
    return this.getAll().filter(
      (g) => getOccurrencesInWindow(g, this.rateWindow) >= minOccurrences
    );
  }

  /**
   * Get unviewed groups
   */
  getUnviewed(): ErrorGroup[] {
    return this.getAll().filter((g) => !g.viewed);
  }

  /**
   * Get unmuted groups
   */
  getUnmuted(): ErrorGroup[] {
    return this.getAll().filter((g) => !g.muted);
  }

  /**
   * Mark group as viewed
   */
  markViewed(fingerprint: ErrorFingerprint): boolean {
    const group = this.groups.get(fingerprint);
    if (!group) return false;

    group.viewed = true;
    this.notifyChange("update", group);
    return true;
  }

  /**
   * Mark all groups as viewed
   */
  markAllViewed(): number {
    let count = 0;
    for (const group of this.groups.values()) {
      if (!group.viewed) {
        group.viewed = true;
        count++;
      }
    }
    if (count > 0) {
      this.notifyChange("update", null);
    }
    return count;
  }

  /**
   * Mute a group
   */
  mute(fingerprint: ErrorFingerprint): boolean {
    const group = this.groups.get(fingerprint);
    if (!group) return false;

    group.muted = true;
    this.notifyChange("update", group);
    return true;
  }

  /**
   * Unmute a group
   */
  unmute(fingerprint: ErrorFingerprint): boolean {
    const group = this.groups.get(fingerprint);
    if (!group) return false;

    group.muted = false;
    this.notifyChange("update", group);
    return true;
  }

  /**
   * Remove a group
   */
  remove(fingerprint: ErrorFingerprint): boolean {
    if (this.disposed) {
      throw new Error("ErrorDeduplicator is disposed");
    }

    const group = this.groups.get(fingerprint);
    if (!group) return false;

    this.groups.delete(fingerprint);
    this.notifyChange("remove", group);
    return true;
  }

  /**
   * Clear all groups
   */
  clear(): void {
    if (this.disposed) {
      throw new Error("ErrorDeduplicator is disposed");
    }

    this.groups.clear();
    this.totalErrors = 0;
    this.notifyChange("clear", null);
  }

  /**
   * Get statistics
   */
  getStats(): DeduplicationStats {
    const groups = this.getAll();
    const byType = new Map<string, number>();
    const byFile = new Map<string, number>();

    let mostFrequent: ErrorFingerprint | null = null;
    let mostFrequentCount = 0;

    for (const group of groups) {
      // Track by type
      const type = group.type ?? "Error";
      byType.set(type, (byType.get(type) ?? 0) + group.count);

      // Track by file
      for (const file of group.uniqueFiles) {
        byFile.set(file, (byFile.get(file) ?? 0) + 1);
      }

      // Track most frequent
      if (group.count > mostFrequentCount) {
        mostFrequentCount = group.count;
        mostFrequent = group.fingerprint;
      }
    }

    return {
      totalErrors: this.totalErrors,
      uniqueGroups: groups.length,
      deduplicationRatio:
        this.totalErrors > 0
          ? 1 - groups.length / this.totalErrors
          : 0,
      mostFrequent,
      mostFrequentCount,
      byType,
      byFile,
    };
  }

  /**
   * Subscribe to group changes
   */
  onChange(callback: GroupChangeCallback): () => void {
    if (this.disposed) {
      throw new Error("ErrorDeduplicator is disposed");
    }

    this.changeCallbacks.add(callback);
    return () => {
      this.changeCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to threshold notifications
   */
  onThreshold(callback: ThresholdCallback): () => void {
    if (this.disposed) {
      throw new Error("ErrorDeduplicator is disposed");
    }

    this.thresholdCallbacks.add(callback);
    return () => {
      this.thresholdCallbacks.delete(callback);
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
    this.groups.clear();
    this.changeCallbacks.clear();
    this.thresholdCallbacks.clear();
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  private generateFingerprint(error: ErrorInput): ErrorFingerprint {
    switch (this.strategy) {
      case "message":
        return fingerprintByMessage(error, this.normalizeMessages);
      case "message-and-type":
        return fingerprintByMessageAndType(error, this.normalizeMessages);
      case "message-and-file":
        return fingerprintByMessageAndFile(error, this.normalizeMessages);
      case "message-and-stack":
        return fingerprintByMessageAndStack(error, this.normalizeMessages);
      case "custom":
        if (this.customFingerprinter) {
          return this.customFingerprinter(error);
        }
        return fingerprintByMessageAndType(error, this.normalizeMessages);
      default:
        return fingerprintByMessageAndType(error, this.normalizeMessages);
    }
  }

  private createGroup(fingerprint: ErrorFingerprint, error: ErrorInput): ErrorGroup {
    // Enforce max groups
    if (this.groups.size >= this.maxGroups) {
      this.removeOldestGroup();
    }

    const location = createErrorLocation(error);

    const group: ErrorGroup = {
      fingerprint,
      message: error.message,
      type: extractErrorType(error),
      code: error.code,
      count: 1,
      firstSeen: location.timestamp,
      lastSeen: location.timestamp,
      locations: [location],
      uniqueFiles: new Set(error.file ? [error.file] : []),
      sampleStack: error.stack,
      context: error.context,
      muted: false,
      viewed: false,
    };

    this.groups.set(fingerprint, group);
    this.notifyChange("add", group);

    return group;
  }

  private updateGroup(group: ErrorGroup, error: ErrorInput): ErrorGroup {
    const location = createErrorLocation(error);

    group.count++;
    group.lastSeen = location.timestamp;

    // Add unique location
    if (group.locations.length < this.maxLocationsPerGroup) {
      if (isUniqueLocation(location, group.locations)) {
        group.locations.push(location);
      }
    }

    // Track unique files
    if (error.file) {
      group.uniqueFiles.add(error.file);
    }

    this.notifyChange("update", group);

    // Check threshold
    if (group.count === this.thresholdCount) {
      this.notifyThreshold(group);
    }

    return group;
  }

  private removeOldestGroup(): void {
    let oldest: ErrorGroup | null = null;
    let oldestFingerprint: ErrorFingerprint | null = null;

    for (const [fingerprint, group] of this.groups) {
      if (!oldest || group.lastSeen < oldest.lastSeen) {
        oldest = group;
        oldestFingerprint = fingerprint;
      }
    }

    if (oldestFingerprint) {
      this.groups.delete(oldestFingerprint);
    }
  }

  private notifyChange(
    type: "add" | "update" | "remove" | "clear",
    group: ErrorGroup | null
  ): void {
    const event: GroupChangeEvent = {
      type,
      group,
      stats: this.getStats(),
    };

    for (const callback of this.changeCallbacks) {
      try {
        callback(event);
      } catch (err) {
        console.error("ErrorDeduplicator callback error:", err);
      }
    }
  }

  private notifyThreshold(group: ErrorGroup): void {
    for (const callback of this.thresholdCallbacks) {
      try {
        callback(group);
      } catch (err) {
        console.error("ErrorDeduplicator threshold callback error:", err);
      }
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new ErrorDeduplicator instance
 */
export function createErrorDeduplicator(
  options?: ErrorDeduplicatorOptions
): ErrorDeduplicator {
  return new ErrorDeduplicator(options);
}
