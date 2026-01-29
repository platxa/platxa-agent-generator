import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  LogInspector,
  LogStream,
  createLogInspector,
  createConsoleLogInspector,
  parseErrorToLogEntry,
  type LogEntry,
  type LogSeverity,
  type LogSource,
  type LogFilter,
} from "@/lib/preview/log-inspector";

describe("LogInspector", () => {
  let inspector: LogInspector;

  beforeEach(() => {
    inspector = new LogInspector();
  });

  describe("add", () => {
    it("adds a log entry with generated id and timestamp", () => {
      const entry = inspector.add({
        severity: "error",
        source: "scss",
        message: "Test error",
      });

      expect(entry.id).toMatch(/^log_\d+_\d+$/);
      expect(entry.timestamp).toBeGreaterThan(0);
      expect(entry.severity).toBe("error");
      expect(entry.source).toBe("scss");
      expect(entry.message).toBe("Test error");
    });

    it("includes optional fields when provided", () => {
      const entry = inspector.add({
        severity: "warning",
        source: "qweb",
        message: "Test warning",
        file: "template.xml",
        line: 42,
        column: 10,
        code: "QWEB001",
        details: { templateName: "main" },
        stack: "Error: ...\n  at ...",
      });

      expect(entry.file).toBe("template.xml");
      expect(entry.line).toBe(42);
      expect(entry.column).toBe(10);
      expect(entry.code).toBe("QWEB001");
      expect(entry.details).toEqual({ templateName: "main" });
      expect(entry.stack).toBe("Error: ...\n  at ...");
    });

    it("uses provided timestamp when given", () => {
      const customTimestamp = 1700000000000;
      const entry = inspector.add({
        severity: "info",
        source: "hmr",
        message: "Test",
        timestamp: customTimestamp,
      });

      expect(entry.timestamp).toBe(customTimestamp);
    });

    it("enforces maxEntries limit", () => {
      const smallInspector = new LogInspector({ maxEntries: 3 });

      smallInspector.add({ severity: "info", source: "scss", message: "1" });
      smallInspector.add({ severity: "info", source: "scss", message: "2" });
      smallInspector.add({ severity: "info", source: "scss", message: "3" });
      smallInspector.add({ severity: "info", source: "scss", message: "4" });

      const all = smallInspector.getAll();
      expect(all).toHaveLength(3);
      expect(all[0].message).toBe("2");
      expect(all[2].message).toBe("4");
    });

    it("calls onLog callback", () => {
      const onLog = vi.fn();
      const callbackInspector = new LogInspector({ onLog });

      callbackInspector.add({
        severity: "info",
        source: "scss",
        message: "Test",
      });

      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Test" })
      );
    });

    it("calls onError callback for errors", () => {
      const onError = vi.fn();
      const callbackInspector = new LogInspector({ onError });

      callbackInspector.add({
        severity: "error",
        source: "scss",
        message: "Error!",
      });

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ severity: "error" })
      );
    });

    it("does not call onError for non-errors", () => {
      const onError = vi.fn();
      const callbackInspector = new LogInspector({ onError });

      callbackInspector.add({
        severity: "warning",
        source: "scss",
        message: "Warning",
      });

      expect(onError).not.toHaveBeenCalled();
    });

    it("skips debug logs when includeDebug is false", () => {
      inspector.add({ severity: "debug", source: "scss", message: "Debug" });

      expect(inspector.getAll()).toHaveLength(0);
    });

    it("includes debug logs when includeDebug is true", () => {
      const debugInspector = new LogInspector({ includeDebug: true });
      debugInspector.add({ severity: "debug", source: "scss", message: "Debug" });

      expect(debugInspector.getAll()).toHaveLength(1);
    });
  });

  describe("addScssResult", () => {
    it("adds error for failed compilation", () => {
      const entry = inspector.addScssResult({
        success: false,
        error: "Syntax error on line 5",
        file: "theme.scss",
        durationMs: 50,
      });

      expect(entry).not.toBeNull();
      expect(entry!.severity).toBe("error");
      expect(entry!.source).toBe("scss");
      expect(entry!.message).toBe("Syntax error on line 5");
      expect(entry!.file).toBe("theme.scss");
      expect(entry!.details?.durationMs).toBe(50);
    });

    it("returns null for successful compilation without debug", () => {
      const entry = inspector.addScssResult({
        success: true,
        error: null,
        file: "theme.scss",
        durationMs: 30,
      });

      expect(entry).toBeNull();
      expect(inspector.getAll()).toHaveLength(0);
    });

    it("adds debug log for successful compilation with includeDebug", () => {
      const debugInspector = new LogInspector({ includeDebug: true });
      const entry = debugInspector.addScssResult({
        success: true,
        error: null,
        file: "theme.scss",
        durationMs: 30,
      });

      expect(entry).not.toBeNull();
      expect(entry!.severity).toBe("debug");
    });

    it("uses default message when error is null", () => {
      const entry = inspector.addScssResult({
        success: false,
        error: null,
        file: "broken.scss",
      });

      expect(entry!.message).toBe("SCSS compilation failed");
    });
  });

  describe("addQwebErrors", () => {
    it("adds multiple errors", () => {
      const errors = ["Error 1", "Error 2", "Error 3"];
      const entries = inspector.addQwebErrors(errors, "template.xml");

      expect(entries).toHaveLength(3);
      expect(entries[0].message).toBe("Error 1");
      expect(entries[1].message).toBe("Error 2");
      expect(entries[2].message).toBe("Error 3");
      entries.forEach((e) => {
        expect(e.source).toBe("qweb");
        expect(e.severity).toBe("error");
        expect(e.file).toBe("template.xml");
      });
    });

    it("includes template name in details", () => {
      const entries = inspector.addQwebErrors(
        ["Error"],
        "template.xml",
        "main_template"
      );

      expect(entries[0].details?.templateName).toBe("main_template");
    });

    it("handles empty error array", () => {
      const entries = inspector.addQwebErrors([]);
      expect(entries).toHaveLength(0);
    });
  });

  describe("addQwebWarning", () => {
    it("adds a warning entry", () => {
      const entry = inspector.addQwebWarning(
        "Deprecated attribute",
        "template.xml",
        15
      );

      expect(entry.severity).toBe("warning");
      expect(entry.source).toBe("qweb");
      expect(entry.message).toBe("Deprecated attribute");
      expect(entry.file).toBe("template.xml");
      expect(entry.line).toBe(15);
    });
  });

  describe("addOdooError", () => {
    it("adds Odoo error with details", () => {
      const entry = inspector.addOdooError("Widget failed to render", {
        snippetId: "s_banner_123",
        elementSelector: ".s_banner",
        stack: "Error: ...",
      });

      expect(entry.severity).toBe("error");
      expect(entry.source).toBe("odoo");
      expect(entry.message).toBe("Widget failed to render");
      expect(entry.details?.snippetId).toBe("s_banner_123");
      expect(entry.stack).toBe("Error: ...");
    });
  });

  describe("addPreviewError", () => {
    it("adds preview error with details", () => {
      const entry = inspector.addPreviewError("Iframe load failed", {
        url: "http://localhost:8069",
        snippetId: "s_cover",
      });

      expect(entry.severity).toBe("error");
      expect(entry.source).toBe("preview");
      expect(entry.details?.url).toBe("http://localhost:8069");
    });
  });

  describe("addBridgeError", () => {
    it("adds bridge error with context", () => {
      const entry = inspector.addBridgeError(
        { code: "TIMEOUT", message: "Request timed out", details: { timeout: 5000 } },
        { messageType: "platxa:inject-css", messageId: "msg_123" }
      );

      expect(entry.severity).toBe("error");
      expect(entry.source).toBe("bridge");
      expect(entry.code).toBe("TIMEOUT");
      expect(entry.message).toBe("Request timed out");
      expect(entry.details?.messageType).toBe("platxa:inject-css");
    });
  });

  describe("addHmrLog", () => {
    it("adds HMR log at specified severity", () => {
      const entry = inspector.addHmrLog("info", "CSS injected", {
        updateType: "css",
        file: "theme.scss",
      });

      expect(entry.severity).toBe("info");
      expect(entry.source).toBe("hmr");
      expect(entry.file).toBe("theme.scss");
    });
  });

  describe("query", () => {
    beforeEach(() => {
      inspector.add({ severity: "error", source: "scss", message: "E1" });
      inspector.add({ severity: "warning", source: "qweb", message: "W1" });
      inspector.add({ severity: "error", source: "qweb", message: "E2" });
      inspector.add({ severity: "info", source: "hmr", message: "I1" });
      inspector.add({ severity: "error", source: "scss", message: "E3", file: "a.scss" });
    });

    it("returns all entries without filter", () => {
      expect(inspector.query()).toHaveLength(5);
    });

    it("filters by severity", () => {
      const errors = inspector.query({ severity: ["error"] });
      expect(errors).toHaveLength(3);
      errors.forEach((e) => expect(e.severity).toBe("error"));
    });

    it("filters by multiple severities", () => {
      const result = inspector.query({ severity: ["error", "warning"] });
      expect(result).toHaveLength(4);
    });

    it("filters by source", () => {
      const scss = inspector.query({ source: ["scss"] });
      expect(scss).toHaveLength(2);
      scss.forEach((e) => expect(e.source).toBe("scss"));
    });

    it("filters by multiple sources", () => {
      const result = inspector.query({ source: ["scss", "qweb"] });
      expect(result).toHaveLength(4);
    });

    it("filters by time range", () => {
      const now = Date.now();
      const result = inspector.query({ since: now - 1000, until: now + 1000 });
      expect(result).toHaveLength(5);

      const future = inspector.query({ since: now + 10000 });
      expect(future).toHaveLength(0);
    });

    it("filters by file pattern", () => {
      const result = inspector.query({ filePattern: /\.scss$/ });
      expect(result).toHaveLength(1);
      expect(result[0].file).toBe("a.scss");
    });

    it("applies limit", () => {
      const result = inspector.query({ limit: 2 });
      expect(result).toHaveLength(2);
      expect(result[0].message).toBe("I1");
      expect(result[1].message).toBe("E3");
    });

    it("combines multiple filters", () => {
      const result = inspector.query({
        severity: ["error"],
        source: ["scss"],
      });
      expect(result).toHaveLength(2);
    });
  });

  describe("convenience query methods", () => {
    beforeEach(() => {
      inspector.add({ severity: "error", source: "scss", message: "E1" });
      inspector.add({ severity: "warning", source: "qweb", message: "W1" });
      inspector.add({ severity: "error", source: "qweb", message: "E2", file: "t.xml" });
    });

    it("getErrors returns only errors", () => {
      const errors = inspector.getErrors();
      expect(errors).toHaveLength(2);
    });

    it("getWarnings returns only warnings", () => {
      const warnings = inspector.getWarnings();
      expect(warnings).toHaveLength(1);
    });

    it("getBySource returns entries from source", () => {
      const qweb = inspector.getBySource("qweb");
      expect(qweb).toHaveLength(2);
    });

    it("getByFile returns entries for file", () => {
      const entries = inspector.getByFile("t.xml");
      expect(entries).toHaveLength(1);
    });

    it("getRecent returns last N entries", () => {
      const recent = inspector.getRecent(2);
      expect(recent).toHaveLength(2);
      expect(recent[0].message).toBe("W1");
    });

    it("getById returns specific entry", () => {
      const all = inspector.getAll();
      const found = inspector.getById(all[1].id);
      expect(found?.message).toBe("W1");
    });

    it("getById returns undefined for unknown id", () => {
      expect(inspector.getById("unknown")).toBeUndefined();
    });
  });

  describe("statistics", () => {
    beforeEach(() => {
      inspector.add({ severity: "error", source: "scss", message: "E1" });
      inspector.add({ severity: "warning", source: "qweb", message: "W1" });
      inspector.add({ severity: "error", source: "scss", message: "E2" });
    });

    it("getStats returns correct counts", () => {
      const stats = inspector.getStats();

      expect(stats.total).toBe(3);
      expect(stats.bySeverity.error).toBe(2);
      expect(stats.bySeverity.warning).toBe(1);
      expect(stats.bySeverity.info).toBe(0);
      expect(stats.bySource.scss).toBe(2);
      expect(stats.bySource.qweb).toBe(1);
    });

    it("getStats includes timestamps", () => {
      const stats = inspector.getStats();

      expect(stats.oldestTimestamp).toBeGreaterThan(0);
      expect(stats.newestTimestamp).toBeGreaterThanOrEqual(stats.oldestTimestamp!);
    });

    it("getStats handles empty inspector", () => {
      const emptyInspector = new LogInspector();
      const stats = emptyInspector.getStats();

      expect(stats.total).toBe(0);
      expect(stats.oldestTimestamp).toBeNull();
      expect(stats.newestTimestamp).toBeNull();
    });

    it("hasErrors returns correct value", () => {
      expect(inspector.hasErrors()).toBe(true);

      const noErrors = new LogInspector();
      noErrors.add({ severity: "warning", source: "scss", message: "W" });
      expect(noErrors.hasErrors()).toBe(false);
    });

    it("errorCount returns correct count", () => {
      expect(inspector.errorCount()).toBe(2);
    });
  });

  describe("clear methods", () => {
    beforeEach(() => {
      inspector.add({ severity: "error", source: "scss", message: "E1" });
      inspector.add({ severity: "warning", source: "qweb", message: "W1" });
      inspector.add({ severity: "error", source: "qweb", message: "E2" });
    });

    it("clear removes all entries", () => {
      inspector.clear();
      expect(inspector.getAll()).toHaveLength(0);
    });

    it("clearMatching removes matching entries", () => {
      const removed = inspector.clearMatching({ source: ["scss"] });

      expect(removed).toBe(1);
      expect(inspector.getAll()).toHaveLength(2);
    });
  });

  describe("export", () => {
    beforeEach(() => {
      inspector.add({
        severity: "error",
        source: "scss",
        message: "Test error",
        file: "test.scss",
        line: 10,
      });
    });

    it("exports as JSON", () => {
      const json = inspector.export("json");
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].message).toBe("Test error");
    });

    it("exports as text", () => {
      const text = inspector.export("text");

      expect(text).toContain("[ERROR]");
      expect(text).toContain("[scss]");
      expect(text).toContain("Test error");
      expect(text).toContain("[test.scss:10]");
    });
  });

  describe("subscribe", () => {
    it("calls callback for new entries", () => {
      const callback = vi.fn();
      inspector.subscribe(callback);

      inspector.add({ severity: "info", source: "hmr", message: "Test" });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Test" })
      );
    });

    it("filters by severity", () => {
      const callback = vi.fn();
      inspector.subscribe(callback, { severity: ["error"] });

      inspector.add({ severity: "info", source: "hmr", message: "Info" });
      inspector.add({ severity: "error", source: "scss", message: "Error" });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ severity: "error" })
      );
    });

    it("filters by source", () => {
      const callback = vi.fn();
      inspector.subscribe(callback, { source: ["scss"] });

      inspector.add({ severity: "error", source: "qweb", message: "QWeb" });
      inspector.add({ severity: "error", source: "scss", message: "SCSS" });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ source: "scss" })
      );
    });

    it("returns unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = inspector.subscribe(callback);

      inspector.add({ severity: "info", source: "hmr", message: "1" });
      unsubscribe();
      inspector.add({ severity: "info", source: "hmr", message: "2" });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});

describe("LogStream", () => {
  let inspector: LogInspector;
  let stream: LogStream;

  beforeEach(() => {
    inspector = new LogInspector();
    stream = inspector.createStream();
  });

  afterEach(() => {
    stream.stop();
  });

  it("receives entries when started", () => {
    const callback = vi.fn();
    stream.onEntry(callback).start();

    inspector.add({ severity: "info", source: "hmr", message: "Test" });

    expect(callback).toHaveBeenCalled();
  });

  it("does not receive entries when stopped", () => {
    const callback = vi.fn();
    stream.onEntry(callback).start().stop();

    inspector.add({ severity: "info", source: "hmr", message: "Test" });

    expect(callback).not.toHaveBeenCalled();
  });

  it("onError filters to errors only", () => {
    const callback = vi.fn();
    stream.onError(callback).start();

    inspector.add({ severity: "info", source: "hmr", message: "Info" });
    inspector.add({ severity: "error", source: "scss", message: "Error" });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("onSource filters to specific sources", () => {
    const callback = vi.fn();
    stream.onSource(["scss", "qweb"], callback).start();

    inspector.add({ severity: "info", source: "hmr", message: "HMR" });
    inspector.add({ severity: "error", source: "scss", message: "SCSS" });
    inspector.add({ severity: "warning", source: "qweb", message: "QWeb" });

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("supports chaining", () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    stream.onEntry(callback1).onError(callback2).start();

    inspector.add({ severity: "error", source: "scss", message: "Error" });

    expect(callback1).toHaveBeenCalled();
    expect(callback2).toHaveBeenCalled();
  });
});

describe("createLogInspector", () => {
  it("creates a LogInspector instance", () => {
    const inspector = createLogInspector();
    expect(inspector).toBeInstanceOf(LogInspector);
  });

  it("passes options through", () => {
    const onError = vi.fn();
    const inspector = createLogInspector({ onError, maxEntries: 50 });

    inspector.add({ severity: "error", source: "scss", message: "Test" });

    expect(onError).toHaveBeenCalled();
  });
});

describe("createConsoleLogInspector", () => {
  it("creates inspector that logs errors to console", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const inspector = createConsoleLogInspector();
    inspector.add({ severity: "error", source: "scss", message: "Test error" });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("logs stack trace when available", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const inspector = createConsoleLogInspector();
    inspector.add({
      severity: "error",
      source: "scss",
      message: "Test",
      stack: "Error: Test\n  at test.ts:1",
    });

    expect(consoleSpy).toHaveBeenCalledTimes(2);
    consoleSpy.mockRestore();
  });
});

describe("parseErrorToLogEntry", () => {
  it("parses Error instance", () => {
    const error = new Error("Test error");
    error.stack = "Error: Test error\n  at test.ts:1";

    const entry = parseErrorToLogEntry(error, "scss");

    expect(entry.severity).toBe("error");
    expect(entry.source).toBe("scss");
    expect(entry.message).toBe("Test error");
    expect(entry.stack).toBe(error.stack);
  });

  it("parses string error", () => {
    const entry = parseErrorToLogEntry("Simple error", "qweb");

    expect(entry.message).toBe("Simple error");
    expect(entry.source).toBe("qweb");
  });

  it("parses object with message", () => {
    const entry = parseErrorToLogEntry(
      { message: "Object error", code: "ERR001" },
      "bridge"
    );

    expect(entry.message).toBe("Object error");
    expect(entry.code).toBe("ERR001");
  });

  it("parses object with error property", () => {
    const entry = parseErrorToLogEntry({ error: "Error property" }, "preview");

    expect(entry.message).toBe("Error property");
  });

  it("handles unknown types", () => {
    const entry = parseErrorToLogEntry(42, "unknown");

    expect(entry.message).toBe("42");
    expect(entry.source).toBe("unknown");
  });

  it("uses default source when not provided", () => {
    const entry = parseErrorToLogEntry("Test");

    expect(entry.source).toBe("unknown");
  });
});

describe("verification: collects logs from all sources into unified stream", () => {
  it("aggregates errors from SCSS, QWeb, Odoo, and preview", () => {
    const inspector = createLogInspector();

    // Add SCSS error
    inspector.addScssResult({
      success: false,
      error: "Invalid syntax",
      file: "theme.scss",
    });

    // Add QWeb errors
    inspector.addQwebErrors(["Missing t-if", "Invalid attribute"], "template.xml");

    // Add Odoo error
    inspector.addOdooError("Widget render failed", { snippetId: "s_banner" });

    // Add Preview error
    inspector.addPreviewError("Iframe timeout");

    // Verify unified stream
    const all = inspector.getAll();
    expect(all).toHaveLength(5);

    const sources = new Set(all.map((e) => e.source));
    expect(sources.has("scss")).toBe(true);
    expect(sources.has("qweb")).toBe(true);
    expect(sources.has("odoo")).toBe(true);
    expect(sources.has("preview")).toBe(true);
  });

  it("provides real-time streaming of all sources", () => {
    const inspector = createLogInspector();
    const received: LogEntry[] = [];

    const stream = inspector.createStream();
    stream.onEntry((entry) => received.push(entry)).start();

    inspector.addScssResult({ success: false, error: "SCSS fail", file: "a.scss" });
    inspector.addQwebErrors(["QWeb fail"]);
    inspector.addOdooError("Odoo fail");
    inspector.addPreviewError("Preview fail");
    inspector.addBridgeError({ message: "Bridge fail" });
    inspector.addHmrLog("error", "HMR fail");

    stream.stop();

    expect(received).toHaveLength(6);
    const sources = received.map((e) => e.source);
    expect(sources).toContain("scss");
    expect(sources).toContain("qweb");
    expect(sources).toContain("odoo");
    expect(sources).toContain("preview");
    expect(sources).toContain("bridge");
    expect(sources).toContain("hmr");
  });
});
