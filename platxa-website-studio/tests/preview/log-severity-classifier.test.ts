/**
 * Tests for Log Severity Classification
 *
 * Feature #131: Create log severity classification (error, warning, info)
 * Verification: Each log entry has severity level; errors sorted first
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  LogSeverityClassifier,
  createLogSeverityClassifier,
  SEVERITY_PRIORITY,
  SEVERITY_LABELS,
  SEVERITY_COLORS,
  SEVERITY_ICONS,
  SEVERITY_PATTERNS,
  SOURCE_PATTERNS,
  CATEGORY_PATTERNS,
  DEFAULT_MAX_ENTRIES,
  generateLogId,
  compareSeverity,
  meetsSeverityThreshold,
  getSeverityFromPriority,
  classifyMessage,
  detectSource,
  detectCategory,
  createLogEntry,
  sortLogEntries,
  filterLogEntries,
  calculateLogStats,
  formatLogEntry,
  type LogSeverity,
  type LogEntry,
} from "../../lib/preview/log-severity-classifier";

// ============================================================================
// Type Exports
// ============================================================================

describe("Type exports", () => {
  it("should export LogSeverity type", () => {
    const severity: LogSeverity = "error";
    expect(severity).toBe("error");
  });

  it("should support all severity levels", () => {
    const severities: LogSeverity[] = ["fatal", "error", "warning", "info", "debug", "trace"];
    expect(severities.length).toBe(6);
  });
});

// ============================================================================
// Constants
// ============================================================================

describe("Constants", () => {
  describe("SEVERITY_PRIORITY", () => {
    it("should have fatal as highest priority (lowest number)", () => {
      expect(SEVERITY_PRIORITY.fatal).toBe(0);
    });

    it("should have error higher priority than warning", () => {
      expect(SEVERITY_PRIORITY.error).toBeLessThan(SEVERITY_PRIORITY.warning);
    });

    it("should have warning higher priority than info", () => {
      expect(SEVERITY_PRIORITY.warning).toBeLessThan(SEVERITY_PRIORITY.info);
    });

    it("should have trace as lowest priority", () => {
      expect(SEVERITY_PRIORITY.trace).toBe(5);
    });
  });

  describe("SEVERITY_LABELS", () => {
    it("should have labels for all severities", () => {
      expect(SEVERITY_LABELS.fatal).toBe("Fatal");
      expect(SEVERITY_LABELS.error).toBe("Error");
      expect(SEVERITY_LABELS.warning).toBe("Warning");
      expect(SEVERITY_LABELS.info).toBe("Info");
      expect(SEVERITY_LABELS.debug).toBe("Debug");
      expect(SEVERITY_LABELS.trace).toBe("Trace");
    });
  });

  describe("SEVERITY_COLORS", () => {
    it("should have colors for all severities", () => {
      expect(SEVERITY_COLORS.fatal).toBe("#dc2626");
      expect(SEVERITY_COLORS.error).toBe("#ef4444");
      expect(SEVERITY_COLORS.warning).toBe("#f59e0b");
      expect(SEVERITY_COLORS.info).toBe("#3b82f6");
    });
  });

  describe("SEVERITY_ICONS", () => {
    it("should have icons for all severities", () => {
      expect(SEVERITY_ICONS.error).toBe("alert-circle");
      expect(SEVERITY_ICONS.warning).toBe("alert-triangle");
      expect(SEVERITY_ICONS.info).toBe("info");
    });
  });

  describe("SEVERITY_PATTERNS", () => {
    it("should have multiple patterns", () => {
      expect(SEVERITY_PATTERNS.length).toBeGreaterThan(10);
    });

    it("should include common error patterns", () => {
      const errorPatterns = SEVERITY_PATTERNS.filter((p) => p.severity === "error");
      expect(errorPatterns.length).toBeGreaterThan(5);
    });
  });

  describe("DEFAULT_MAX_ENTRIES", () => {
    it("should be 1000", () => {
      expect(DEFAULT_MAX_ENTRIES).toBe(1000);
    });
  });
});

// ============================================================================
// Utility Functions
// ============================================================================

describe("Utility Functions", () => {
  describe("generateLogId", () => {
    it("should generate unique IDs", () => {
      const id1 = generateLogId();
      const id2 = generateLogId();
      expect(id1).not.toBe(id2);
    });

    it("should start with log-", () => {
      const id = generateLogId();
      expect(id.startsWith("log-")).toBe(true);
    });
  });

  describe("compareSeverity", () => {
    it("should return negative when first is more severe", () => {
      expect(compareSeverity("error", "warning")).toBeLessThan(0);
      expect(compareSeverity("fatal", "error")).toBeLessThan(0);
    });

    it("should return positive when second is more severe", () => {
      expect(compareSeverity("warning", "error")).toBeGreaterThan(0);
      expect(compareSeverity("info", "warning")).toBeGreaterThan(0);
    });

    it("should return 0 for same severity", () => {
      expect(compareSeverity("error", "error")).toBe(0);
    });
  });

  describe("meetsSeverityThreshold", () => {
    it("should return true when severity meets threshold", () => {
      expect(meetsSeverityThreshold("error", "warning")).toBe(true);
      expect(meetsSeverityThreshold("error", "error")).toBe(true);
    });

    it("should return false when severity below threshold", () => {
      expect(meetsSeverityThreshold("info", "warning")).toBe(false);
      expect(meetsSeverityThreshold("debug", "info")).toBe(false);
    });
  });

  describe("getSeverityFromPriority", () => {
    it("should return correct severity for priority", () => {
      expect(getSeverityFromPriority(0)).toBe("fatal");
      expect(getSeverityFromPriority(1)).toBe("error");
      expect(getSeverityFromPriority(2)).toBe("warning");
      expect(getSeverityFromPriority(3)).toBe("info");
    });

    it("should return info for unknown priority", () => {
      expect(getSeverityFromPriority(99)).toBe("info");
    });
  });

  describe("classifyMessage", () => {
    it("should classify error messages", () => {
      const result = classifyMessage("Error: Something went wrong");
      expect(result.severity).toBe("error");
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("should classify warning messages", () => {
      const result = classifyMessage("Warning: Deprecated API usage");
      expect(result.severity).toBe("warning");
    });

    it("should classify info messages", () => {
      const result = classifyMessage("Info: Server started successfully");
      expect(result.severity).toBe("info");
    });

    it("should classify fatal messages", () => {
      const result = classifyMessage("Fatal: System crash detected");
      expect(result.severity).toBe("fatal");
    });

    it("should classify TypeError", () => {
      const result = classifyMessage("TypeError: Cannot read property 'x' of undefined");
      expect(result.severity).toBe("error");
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it("should default to info for unrecognized messages", () => {
      const result = classifyMessage("Hello world");
      expect(result.severity).toBe("info");
      expect(result.confidence).toBeLessThan(0.5);
    });

    it("should return matched patterns", () => {
      const result = classifyMessage("Error: Failed to load resource");
      expect(result.matchedPatterns.length).toBeGreaterThan(0);
    });
  });

  describe("detectSource", () => {
    it("should detect console source", () => {
      expect(detectSource("console.log() called")).toBe("console");
    });

    it("should detect qweb source", () => {
      expect(detectSource("QWeb template error")).toBe("qweb");
    });

    it("should detect scss source", () => {
      expect(detectSource("SCSS compilation failed")).toBe("scss");
    });

    it("should detect network source", () => {
      expect(detectSource("Network fetch failed")).toBe("network");
    });

    it("should default to system", () => {
      expect(detectSource("Something happened")).toBe("system");
    });
  });

  describe("detectCategory", () => {
    it("should detect syntax category", () => {
      expect(detectCategory("Syntax error: unexpected token")).toBe("syntax");
    });

    it("should detect runtime category", () => {
      expect(detectCategory("Runtime exception occurred")).toBe("runtime");
    });

    it("should detect network category", () => {
      expect(detectCategory("HTTP request failed with CORS error")).toBe("network");
    });

    it("should detect security category", () => {
      expect(detectCategory("XSS attack detected")).toBe("security");
    });

    it("should detect performance category", () => {
      expect(detectCategory("Slow query detected, memory leak possible")).toBe("performance");
    });

    it("should default to general", () => {
      expect(detectCategory("Something happened")).toBe("general");
    });
  });

  describe("createLogEntry", () => {
    it("should create entry with auto-classification", () => {
      const entry = createLogEntry("Error: Failed");
      expect(entry.id).toBeDefined();
      expect(entry.message).toBe("Error: Failed");
      expect(entry.severity).toBe("error");
      expect(entry.timestamp).toBeDefined();
    });

    it("should use provided options", () => {
      const entry = createLogEntry("Test message", {
        severity: "warning",
        source: "qweb",
        file: "test.ts",
        line: 10,
      });
      expect(entry.severity).toBe("warning");
      expect(entry.source).toBe("qweb");
      expect(entry.file).toBe("test.ts");
      expect(entry.line).toBe(10);
    });

    it("should set read to false by default", () => {
      const entry = createLogEntry("Test");
      expect(entry.read).toBe(false);
    });
  });

  describe("sortLogEntries", () => {
    const entries: LogEntry[] = [
      createLogEntry("Info message", { severity: "info" }),
      createLogEntry("Error message", { severity: "error" }),
      createLogEntry("Warning message", { severity: "warning" }),
      createLogEntry("Fatal message", { severity: "fatal" }),
    ];

    it("should sort by severity (errors first) by default", () => {
      const sorted = sortLogEntries(entries, "severity");
      expect(sorted[0].severity).toBe("fatal");
      expect(sorted[1].severity).toBe("error");
      expect(sorted[2].severity).toBe("warning");
      expect(sorted[3].severity).toBe("info");
    });

    it("should sort by time ascending", () => {
      const sorted = sortLogEntries(entries, "time-asc");
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].timestamp).toBeGreaterThanOrEqual(sorted[i - 1].timestamp);
      }
    });

    it("should sort by time descending", () => {
      const sorted = sortLogEntries(entries, "time-desc");
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].timestamp).toBeLessThanOrEqual(sorted[i - 1].timestamp);
      }
    });

    it("should sort by source", () => {
      const mixedEntries = [
        createLogEntry("A", { source: "qweb" }),
        createLogEntry("B", { source: "console" }),
        createLogEntry("C", { source: "network" }),
      ];
      const sorted = sortLogEntries(mixedEntries, "source");
      expect(sorted[0].source).toBe("console");
      expect(sorted[1].source).toBe("network");
      expect(sorted[2].source).toBe("qweb");
    });
  });

  describe("filterLogEntries", () => {
    const entries: LogEntry[] = [
      createLogEntry("Error in file.ts", { severity: "error", source: "console", read: false }),
      createLogEntry("Warning about API", { severity: "warning", source: "network", read: true }),
      createLogEntry("Info message", { severity: "info", source: "system", read: false }),
      createLogEntry("Debug output", { severity: "debug", source: "console", read: true }),
    ];

    it("should filter by minimum severity", () => {
      const filtered = filterLogEntries(entries, { minSeverity: "warning" });
      expect(filtered.length).toBe(2);
      expect(filtered.every((e) => ["error", "warning"].includes(e.severity))).toBe(true);
    });

    it("should filter by sources", () => {
      const filtered = filterLogEntries(entries, { sources: ["console"] });
      expect(filtered.length).toBe(2);
      expect(filtered.every((e) => e.source === "console")).toBe(true);
    });

    it("should filter by search text", () => {
      const filtered = filterLogEntries(entries, { search: "file" });
      expect(filtered.length).toBe(1);
      expect(filtered[0].message).toContain("file");
    });

    it("should filter unread only", () => {
      const filtered = filterLogEntries(entries, { unreadOnly: true });
      expect(filtered.length).toBe(2);
      expect(filtered.every((e) => !e.read)).toBe(true);
    });

    it("should apply limit", () => {
      const filtered = filterLogEntries(entries, { limit: 2 });
      expect(filtered.length).toBe(2);
    });

    it("should combine filters", () => {
      const filtered = filterLogEntries(entries, {
        minSeverity: "warning",
        sources: ["console"],
      });
      expect(filtered.length).toBe(1);
      expect(filtered[0].severity).toBe("error");
    });
  });

  describe("calculateLogStats", () => {
    const entries: LogEntry[] = [
      createLogEntry("Error 1", { severity: "error", source: "console", read: false }),
      createLogEntry("Error 2", { severity: "error", source: "network", read: true }),
      createLogEntry("Warning", { severity: "warning", source: "console", read: false }),
      createLogEntry("Info", { severity: "info", source: "system", read: true }),
    ];

    it("should calculate total", () => {
      const stats = calculateLogStats(entries);
      expect(stats.total).toBe(4);
    });

    it("should count by severity", () => {
      const stats = calculateLogStats(entries);
      expect(stats.bySeverity.error).toBe(2);
      expect(stats.bySeverity.warning).toBe(1);
      expect(stats.bySeverity.info).toBe(1);
    });

    it("should count by source", () => {
      const stats = calculateLogStats(entries);
      expect(stats.bySource.console).toBe(2);
      expect(stats.bySource.network).toBe(1);
      expect(stats.bySource.system).toBe(1);
    });

    it("should count unread", () => {
      const stats = calculateLogStats(entries);
      expect(stats.unread).toBe(2);
    });

    it("should track last timestamp", () => {
      const stats = calculateLogStats(entries);
      expect(stats.lastTimestamp).toBeDefined();
    });
  });

  describe("formatLogEntry", () => {
    it("should format entry with all fields", () => {
      const entry = createLogEntry("Test message", {
        severity: "error",
        source: "console",
        file: "test.ts",
        line: 10,
        column: 5,
      });
      const formatted = formatLogEntry(entry);
      expect(formatted).toContain("[ERROR]");
      expect(formatted).toContain("[console]");
      expect(formatted).toContain("Test message");
      expect(formatted).toContain("test.ts:10:5");
    });

    it("should format entry without location", () => {
      const entry = createLogEntry("Test message", { severity: "info" });
      const formatted = formatLogEntry(entry);
      expect(formatted).toContain("[INFO]");
      expect(formatted).not.toContain("undefined");
    });
  });
});

// ============================================================================
// LogSeverityClassifier Class
// ============================================================================

describe("LogSeverityClassifier", () => {
  let classifier: LogSeverityClassifier;

  beforeEach(() => {
    classifier = new LogSeverityClassifier();
  });

  afterEach(() => {
    classifier.dispose();
  });

  describe("constructor", () => {
    it("should create with default options", () => {
      expect(classifier.isDisposed()).toBe(false);
    });

    it("should accept custom patterns", () => {
      const c = new LogSeverityClassifier({
        customPatterns: [
          { pattern: /custom/, severity: "warning", weight: 1.0, description: "Custom" },
        ],
      });
      const result = c.classify("custom pattern");
      expect(result.severity).toBe("warning");
      c.dispose();
    });

    it("should accept default severity", () => {
      const c = new LogSeverityClassifier({ defaultSeverity: "debug" });
      expect(c.isDisposed()).toBe(false);
      c.dispose();
    });
  });

  describe("add", () => {
    it("should add string message", () => {
      const entry = classifier.add("Test error message");
      expect(entry.id).toBeDefined();
      expect(entry.message).toBe("Test error message");
    });

    it("should add LogEntry object", () => {
      const entry: LogEntry = createLogEntry("Existing entry");
      const added = classifier.add(entry);
      expect(added.id).toBe(entry.id);
    });

    it("should auto-classify severity", () => {
      const entry = classifier.add("Error: Something failed");
      expect(entry.severity).toBe("error");
    });

    it("should trigger change callback", () => {
      const callback = vi.fn();
      classifier.onChange(callback);
      classifier.add("Test");
      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].type).toBe("add");
    });

    it("should throw if disposed", () => {
      classifier.dispose();
      expect(() => classifier.add("Test")).toThrow("disposed");
    });
  });

  describe("addBatch", () => {
    it("should add multiple entries", () => {
      const entries = classifier.addBatch(["Error 1", "Error 2", "Error 3"]);
      expect(entries.length).toBe(3);
      expect(classifier.getAll().length).toBe(3);
    });
  });

  describe("get", () => {
    it("should get entry by ID", () => {
      const added = classifier.add("Test");
      const retrieved = classifier.get(added.id);
      expect(retrieved).toEqual(added);
    });

    it("should return undefined for unknown ID", () => {
      expect(classifier.get("unknown")).toBeUndefined();
    });
  });

  describe("getAll", () => {
    it("should return all entries sorted by severity", () => {
      classifier.add("Info message", { severity: "info" });
      classifier.add("Error message", { severity: "error" });
      classifier.add("Warning message", { severity: "warning" });

      const all = classifier.getAll();
      expect(all.length).toBe(3);
      expect(all[0].severity).toBe("error");
      expect(all[1].severity).toBe("warning");
      expect(all[2].severity).toBe("info");
    });

    it("should accept sort order", () => {
      classifier.add("A");
      classifier.add("B");
      const all = classifier.getAll("time-asc");
      expect(all.length).toBe(2);
    });
  });

  describe("getFiltered", () => {
    beforeEach(() => {
      classifier.add("Error 1", { severity: "error" });
      classifier.add("Error 2", { severity: "error" });
      classifier.add("Warning", { severity: "warning" });
      classifier.add("Info", { severity: "info" });
    });

    it("should filter by severity", () => {
      const filtered = classifier.getFiltered({ minSeverity: "error" });
      expect(filtered.length).toBe(2);
    });

    it("should sort results", () => {
      const filtered = classifier.getFiltered({}, "severity");
      expect(filtered[0].severity).toBe("error");
    });
  });

  describe("getBySeverity", () => {
    beforeEach(() => {
      classifier.add("Error 1", { severity: "error" });
      classifier.add("Error 2", { severity: "error" });
      classifier.add("Warning", { severity: "warning" });
    });

    it("should get entries by severity", () => {
      const errors = classifier.getBySeverity("error");
      expect(errors.length).toBe(2);
      expect(errors.every((e) => e.severity === "error")).toBe(true);
    });
  });

  describe("getErrors", () => {
    beforeEach(() => {
      classifier.add("Fatal", { severity: "fatal" });
      classifier.add("Error", { severity: "error" });
      classifier.add("Warning", { severity: "warning" });
    });

    it("should get errors and fatals sorted by severity", () => {
      const errors = classifier.getErrors();
      expect(errors.length).toBe(2);
      expect(errors[0].severity).toBe("fatal");
      expect(errors[1].severity).toBe("error");
    });
  });

  describe("getWarnings", () => {
    beforeEach(() => {
      classifier.add("Error", { severity: "error" });
      classifier.add("Warning 1", { severity: "warning" });
      classifier.add("Warning 2", { severity: "warning" });
    });

    it("should get only warnings", () => {
      const warnings = classifier.getWarnings();
      expect(warnings.length).toBe(2);
      expect(warnings.every((e) => e.severity === "warning")).toBe(true);
    });
  });

  describe("update", () => {
    it("should update entry", () => {
      const entry = classifier.add("Test");
      const result = classifier.update(entry.id, { severity: "error" });
      expect(result).toBe(true);
      expect(classifier.get(entry.id)?.severity).toBe("error");
    });

    it("should return false for unknown ID", () => {
      expect(classifier.update("unknown", { severity: "error" })).toBe(false);
    });

    it("should trigger change callback", () => {
      const entry = classifier.add("Test");
      const callback = vi.fn();
      classifier.onChange(callback);
      classifier.update(entry.id, { read: true });
      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].type).toBe("update");
    });

    it("should throw if disposed", () => {
      const entry = classifier.add("Test");
      classifier.dispose();
      expect(() => classifier.update(entry.id, {})).toThrow("disposed");
    });
  });

  describe("markRead", () => {
    it("should mark entry as read", () => {
      const entry = classifier.add("Test");
      expect(entry.read).toBe(false);
      classifier.markRead(entry.id);
      expect(classifier.get(entry.id)?.read).toBe(true);
    });
  });

  describe("markAllRead", () => {
    it("should mark all entries as read", () => {
      classifier.add("Test 1");
      classifier.add("Test 2");
      classifier.add("Test 3");

      const count = classifier.markAllRead();
      expect(count).toBe(3);

      const stats = classifier.getStats();
      expect(stats.unread).toBe(0);
    });

    it("should return 0 if all already read", () => {
      const entry = classifier.add("Test");
      classifier.markRead(entry.id);
      expect(classifier.markAllRead()).toBe(0);
    });
  });

  describe("remove", () => {
    it("should remove entry", () => {
      const entry = classifier.add("Test");
      const result = classifier.remove(entry.id);
      expect(result).toBe(true);
      expect(classifier.get(entry.id)).toBeUndefined();
    });

    it("should return false for unknown ID", () => {
      expect(classifier.remove("unknown")).toBe(false);
    });

    it("should trigger change callback", () => {
      const entry = classifier.add("Test");
      const callback = vi.fn();
      classifier.onChange(callback);
      classifier.remove(entry.id);
      expect(callback.mock.calls[0][0].type).toBe("remove");
    });

    it("should throw if disposed", () => {
      const entry = classifier.add("Test");
      classifier.dispose();
      expect(() => classifier.remove(entry.id)).toThrow("disposed");
    });
  });

  describe("clear", () => {
    it("should clear all entries", () => {
      classifier.add("Test 1");
      classifier.add("Test 2");
      classifier.clear();
      expect(classifier.getAll().length).toBe(0);
    });

    it("should trigger change callback", () => {
      classifier.add("Test");
      const callback = vi.fn();
      classifier.onChange(callback);
      classifier.clear();
      expect(callback.mock.calls[0][0].type).toBe("clear");
    });

    it("should throw if disposed", () => {
      classifier.dispose();
      expect(() => classifier.clear()).toThrow("disposed");
    });
  });

  describe("getStats", () => {
    it("should return statistics", () => {
      classifier.add("Error", { severity: "error" });
      classifier.add("Warning", { severity: "warning" });
      const stats = classifier.getStats();
      expect(stats.total).toBe(2);
      expect(stats.bySeverity.error).toBe(1);
      expect(stats.bySeverity.warning).toBe(1);
    });
  });

  describe("classify", () => {
    it("should classify message using patterns", () => {
      const result = classifier.classify("Error: Something failed");
      expect(result.severity).toBe("error");
    });
  });

  describe("addPattern", () => {
    it("should add custom pattern", () => {
      classifier.addPattern({
        pattern: /myerror/,
        severity: "fatal",
        weight: 1.0,
        description: "My Error",
      });
      const result = classifier.classify("myerror occurred");
      expect(result.severity).toBe("fatal");
    });

    it("should throw if disposed", () => {
      classifier.dispose();
      expect(() =>
        classifier.addPattern({
          pattern: /test/,
          severity: "error",
          weight: 1.0,
          description: "Test",
        })
      ).toThrow("disposed");
    });
  });

  describe("getPatterns", () => {
    it("should return all patterns", () => {
      const patterns = classifier.getPatterns();
      expect(patterns.length).toBeGreaterThan(10);
    });
  });

  describe("onChange", () => {
    it("should subscribe to changes", () => {
      const callback = vi.fn();
      classifier.onChange(callback);
      classifier.add("Test");
      expect(callback).toHaveBeenCalled();
    });

    it("should return unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = classifier.onChange(callback);
      unsubscribe();
      classifier.add("Test");
      expect(callback).not.toHaveBeenCalled();
    });

    it("should catch callback errors", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      classifier.onChange(() => {
        throw new Error("Callback error");
      });
      classifier.add("Test");
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it("should throw if disposed", () => {
      classifier.dispose();
      expect(() => classifier.onChange(() => {})).toThrow("disposed");
    });
  });

  describe("max entries", () => {
    it("should remove oldest when max reached", () => {
      const c = new LogSeverityClassifier({ maxEntries: 3 });

      c.add("First", { timestamp: 1000 });
      c.add("Second", { timestamp: 2000 });
      c.add("Third", { timestamp: 3000 });
      c.add("Fourth", { timestamp: 4000 });

      expect(c.getAll().length).toBe(3);
      // First should be removed
      const messages = c.getAll().map((e) => e.message);
      expect(messages).not.toContain("First");

      c.dispose();
    });
  });

  describe("isDisposed", () => {
    it("should return false when not disposed", () => {
      expect(classifier.isDisposed()).toBe(false);
    });

    it("should return true when disposed", () => {
      classifier.dispose();
      expect(classifier.isDisposed()).toBe(true);
    });
  });

  describe("dispose", () => {
    it("should clear entries and callbacks", () => {
      classifier.add("Test");
      classifier.onChange(() => {});
      classifier.dispose();
      expect(classifier.isDisposed()).toBe(true);
    });

    it("should be idempotent", () => {
      classifier.dispose();
      expect(() => classifier.dispose()).not.toThrow();
    });
  });
});

// ============================================================================
// Factory Function
// ============================================================================

describe("createLogSeverityClassifier", () => {
  it("should create LogSeverityClassifier instance", () => {
    const c = createLogSeverityClassifier();
    expect(c).toBeInstanceOf(LogSeverityClassifier);
    c.dispose();
  });

  it("should pass options to constructor", () => {
    const c = createLogSeverityClassifier({ maxEntries: 50 });
    expect(c.isDisposed()).toBe(false);
    c.dispose();
  });
});

// ============================================================================
// Integration: Errors Sorted First
// ============================================================================

describe("Integration: Errors sorted first", () => {
  it("should return errors before warnings before info", () => {
    const c = createLogSeverityClassifier();

    // Add in random order
    c.add("Info message", { severity: "info" });
    c.add("Debug output", { severity: "debug" });
    c.add("Error occurred", { severity: "error" });
    c.add("Warning: check this", { severity: "warning" });
    c.add("Another error", { severity: "error" });
    c.add("Fatal crash", { severity: "fatal" });

    const all = c.getAll("severity");

    // Verify order: fatal, error, error, warning, info, debug
    expect(all[0].severity).toBe("fatal");
    expect(all[1].severity).toBe("error");
    expect(all[2].severity).toBe("error");
    expect(all[3].severity).toBe("warning");
    expect(all[4].severity).toBe("info");
    expect(all[5].severity).toBe("debug");

    c.dispose();
  });

  it("should auto-classify severity from message content", () => {
    const c = createLogSeverityClassifier();

    c.add("TypeError: Cannot read property");
    c.add("Successfully loaded module");
    c.add("Warning: Deprecated method");
    c.add("Fatal: Out of memory");

    const all = c.getAll("severity");

    expect(all[0].severity).toBe("fatal");
    expect(all[1].severity).toBe("error");
    expect(all[2].severity).toBe("warning");
    expect(all[3].severity).toBe("info");

    c.dispose();
  });
});
