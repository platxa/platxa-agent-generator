import { describe, it, expect, beforeEach } from "vitest";
import {
  OdooLogStream,
  createLogStream,
  createMockLogEntry,
  parseLogLine,
  filterLogEntry,
  compareLogLevels,
  meetsMinLevel,
  isTemplateError,
  isStyleError,
  formatLogEntry,
  groupByLogger,
  getErrorSummary,
  generateLogId,
  resetLogIdCounter,
  LOG_LEVEL_ORDER,
  LOG_LEVEL_CONFIG,
  DEFAULT_STREAM_CONFIG,
  TEMPLATE_ERROR_PATTERNS,
  STYLE_ERROR_PATTERNS,
  type OdooLogEntry,
  type LogFilterConfig,
  type LogLevel,
} from "@/lib/odoo-log-stream";

describe("OdooLogStream", () => {
  beforeEach(() => {
    resetLogIdCounter();
  });

  describe("streams Odoo server logs via WebSocket; filters relevant entries (Feature #128)", () => {
    it("parseLogLine parses standard Odoo log format", () => {
      // Feature #128: Streams Odoo server logs
      const line = "2024-01-15 10:30:45,123 1234 ERROR odoo.http: Request failed";
      const entry = parseLogLine(line);

      expect(entry).not.toBeNull();
      expect(entry?.level).toBe("error");
      expect(entry?.logger).toBe("odoo.http");
      expect(entry?.message).toBe("Request failed");
    });

    it("filterLogEntry filters by minimum log level", () => {
      // Feature #128: Filters relevant entries
      const entry = createMockLogEntry({ level: "warning" });
      const config: LogFilterConfig = { minLevel: "error" };

      expect(filterLogEntry(entry, config)).toBe(false);

      const errorEntry = createMockLogEntry({ level: "error" });
      expect(filterLogEntry(errorEntry, config)).toBe(true);
    });

    it("filterLogEntry filters template errors", () => {
      // Feature #128: Filters relevant entries (template errors)
      const templateEntry = createMockLogEntry({
        logger: "odoo.addons.base.qweb",
        message: "Template rendering error in view",
      });

      const config: LogFilterConfig = { templateErrorsOnly: true };

      expect(filterLogEntry(templateEntry, config)).toBe(true);

      const otherEntry = createMockLogEntry({
        logger: "odoo.sql",
        message: "Database query failed",
      });

      expect(filterLogEntry(otherEntry, config)).toBe(false);
    });

    it("filterLogEntry filters style errors", () => {
      // Feature #128: Filters relevant entries (style errors)
      const styleEntry = createMockLogEntry({
        logger: "odoo.assets",
        message: "SCSS compilation failed",
      });

      const config: LogFilterConfig = { styleErrorsOnly: true };

      expect(filterLogEntry(styleEntry, config)).toBe(true);

      const otherEntry = createMockLogEntry({
        logger: "odoo.http",
        message: "HTTP error",
      });

      expect(filterLogEntry(otherEntry, config)).toBe(false);
    });
  });

  describe("parseLogLine", () => {
    it("parses full Odoo log format", () => {
      const line = "2024-01-15 10:30:45,123 1234 WARNING odoo.models: Field not found";
      const entry = parseLogLine(line);

      expect(entry?.level).toBe("warning");
      expect(entry?.logger).toBe("odoo.models");
      expect(entry?.message).toBe("Field not found");
    });

    it("parses simple log format with brackets", () => {
      const line = "[ERROR] odoo.http: Connection refused";
      const entry = parseLogLine(line);

      expect(entry?.level).toBe("error");
      expect(entry?.logger).toBe("odoo.http");
      expect(entry?.message).toBe("Connection refused");
    });

    it("parses simple log format without brackets", () => {
      const line = "INFO odoo.service: Server started";
      const entry = parseLogLine(line);

      expect(entry?.level).toBe("info");
      expect(entry?.logger).toBe("odoo.service");
      expect(entry?.message).toBe("Server started");
    });

    it("returns null for invalid format", () => {
      expect(parseLogLine("random text")).toBeNull();
      expect(parseLogLine("")).toBeNull();
    });

    it("detects template errors automatically", () => {
      const line = "ERROR odoo.addons.website.qweb: Template 'web.layout' not found";
      const entry = parseLogLine(line);

      expect(entry?.isTemplateError).toBe(true);
    });

    it("detects style errors automatically", () => {
      const line = "ERROR odoo.assets: SCSS compilation error in theme.scss";
      const entry = parseLogLine(line);

      expect(entry?.isStyleError).toBe(true);
    });
  });

  describe("filterLogEntry", () => {
    it("passes all entries with empty config", () => {
      const entry = createMockLogEntry();
      expect(filterLogEntry(entry, {})).toBe(true);
    });

    it("filters by minimum level", () => {
      const config: LogFilterConfig = { minLevel: "warning" };

      expect(filterLogEntry(createMockLogEntry({ level: "debug" }), config)).toBe(false);
      expect(filterLogEntry(createMockLogEntry({ level: "info" }), config)).toBe(false);
      expect(filterLogEntry(createMockLogEntry({ level: "warning" }), config)).toBe(true);
      expect(filterLogEntry(createMockLogEntry({ level: "error" }), config)).toBe(true);
      expect(filterLogEntry(createMockLogEntry({ level: "critical" }), config)).toBe(true);
    });

    it("filters by included loggers", () => {
      const config: LogFilterConfig = { includeLoggers: ["odoo.http", "odoo.models"] };

      expect(
        filterLogEntry(createMockLogEntry({ logger: "odoo.http" }), config)
      ).toBe(true);
      expect(
        filterLogEntry(createMockLogEntry({ logger: "odoo.models.fields" }), config)
      ).toBe(true);
      expect(
        filterLogEntry(createMockLogEntry({ logger: "odoo.sql" }), config)
      ).toBe(false);
    });

    it("filters by excluded loggers", () => {
      const config: LogFilterConfig = { excludeLoggers: ["odoo.sql"] };

      expect(
        filterLogEntry(createMockLogEntry({ logger: "odoo.http" }), config)
      ).toBe(true);
      expect(
        filterLogEntry(createMockLogEntry({ logger: "odoo.sql.db" }), config)
      ).toBe(false);
    });

    it("supports custom filter function", () => {
      const config: LogFilterConfig = {
        customFilter: (entry) => entry.message.includes("important"),
      };

      expect(
        filterLogEntry(createMockLogEntry({ message: "important error" }), config)
      ).toBe(true);
      expect(
        filterLogEntry(createMockLogEntry({ message: "regular error" }), config)
      ).toBe(false);
    });

    it("combines multiple filters", () => {
      const config: LogFilterConfig = {
        minLevel: "warning",
        includeLoggers: ["odoo.http"],
      };

      // Must match both criteria
      expect(
        filterLogEntry(createMockLogEntry({ level: "error", logger: "odoo.http" }), config)
      ).toBe(true);
      expect(
        filterLogEntry(createMockLogEntry({ level: "info", logger: "odoo.http" }), config)
      ).toBe(false);
      expect(
        filterLogEntry(createMockLogEntry({ level: "error", logger: "odoo.sql" }), config)
      ).toBe(false);
    });
  });

  describe("compareLogLevels", () => {
    it("returns positive when first level is higher", () => {
      expect(compareLogLevels("error", "warning")).toBeGreaterThan(0);
      expect(compareLogLevels("critical", "error")).toBeGreaterThan(0);
    });

    it("returns negative when first level is lower", () => {
      expect(compareLogLevels("info", "warning")).toBeLessThan(0);
      expect(compareLogLevels("debug", "error")).toBeLessThan(0);
    });

    it("returns zero for equal levels", () => {
      expect(compareLogLevels("warning", "warning")).toBe(0);
      expect(compareLogLevels("error", "error")).toBe(0);
    });
  });

  describe("meetsMinLevel", () => {
    it("returns true when level meets minimum", () => {
      expect(meetsMinLevel("error", "warning")).toBe(true);
      expect(meetsMinLevel("warning", "warning")).toBe(true);
      expect(meetsMinLevel("critical", "error")).toBe(true);
    });

    it("returns false when level is below minimum", () => {
      expect(meetsMinLevel("info", "warning")).toBe(false);
      expect(meetsMinLevel("debug", "error")).toBe(false);
    });
  });

  describe("isTemplateError", () => {
    it("detects QWeb errors", () => {
      expect(isTemplateError(createMockLogEntry({ logger: "odoo.qweb" }))).toBe(true);
      expect(isTemplateError(createMockLogEntry({ message: "QWeb rendering failed" }))).toBe(true);
    });

    it("detects template keyword", () => {
      expect(isTemplateError(createMockLogEntry({ message: "Template not found" }))).toBe(true);
    });

    it("detects t-directive errors", () => {
      expect(isTemplateError(createMockLogEntry({ message: "Invalid t-if expression" }))).toBe(true);
    });

    it("returns false for non-template errors", () => {
      expect(isTemplateError(createMockLogEntry({ message: "Database error" }))).toBe(false);
    });

    it("respects explicit isTemplateError flag", () => {
      expect(
        isTemplateError(createMockLogEntry({ isTemplateError: true, message: "unrelated" }))
      ).toBe(true);
      expect(
        isTemplateError(createMockLogEntry({ isTemplateError: false, message: "QWeb error" }))
      ).toBe(false);
    });
  });

  describe("isStyleError", () => {
    it("detects SCSS errors", () => {
      expect(isStyleError(createMockLogEntry({ message: "SCSS compilation failed" }))).toBe(true);
    });

    it("detects CSS errors", () => {
      expect(isStyleError(createMockLogEntry({ message: "CSS parse error" }))).toBe(true);
    });

    it("detects asset bundle errors", () => {
      expect(isStyleError(createMockLogEntry({ message: "Asset bundle failed" }))).toBe(true);
    });

    it("returns false for non-style errors", () => {
      expect(isStyleError(createMockLogEntry({ message: "HTTP error" }))).toBe(false);
    });
  });

  describe("formatLogEntry", () => {
    it("formats entry with timestamp, level, logger, and message", () => {
      const entry = createMockLogEntry({
        timestamp: new Date("2024-01-15T10:30:45.123Z"),
        level: "error",
        logger: "odoo.http",
        message: "Request failed",
      });

      const formatted = formatLogEntry(entry);

      expect(formatted).toContain("10:30:45.123");
      expect(formatted).toContain("ERROR");
      expect(formatted).toContain("odoo.http");
      expect(formatted).toContain("Request failed");
    });
  });

  describe("groupByLogger", () => {
    it("groups entries by logger name", () => {
      const entries = [
        createMockLogEntry({ logger: "odoo.http" }),
        createMockLogEntry({ logger: "odoo.sql" }),
        createMockLogEntry({ logger: "odoo.http" }),
      ];

      const grouped = groupByLogger(entries);

      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped["odoo.http"]).toHaveLength(2);
      expect(grouped["odoo.sql"]).toHaveLength(1);
    });

    it("handles empty array", () => {
      expect(groupByLogger([])).toEqual({});
    });
  });

  describe("getErrorSummary", () => {
    it("calculates summary statistics", () => {
      const entries = [
        createMockLogEntry({ level: "error" }),
        createMockLogEntry({ level: "warning" }),
        createMockLogEntry({ level: "error", message: "QWeb template error" }),
        createMockLogEntry({ level: "error", message: "SCSS compilation failed" }),
      ];

      const summary = getErrorSummary(entries);

      expect(summary.total).toBe(4);
      expect(summary.byLevel.error).toBe(3);
      expect(summary.byLevel.warning).toBe(1);
      expect(summary.templateErrors).toBe(1);
      expect(summary.styleErrors).toBe(1);
    });
  });

  describe("generateLogId", () => {
    it("generates unique IDs", () => {
      const id1 = generateLogId();
      const id2 = generateLogId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^log-\d+-\d+$/);
    });
  });

  describe("LOG_LEVEL_ORDER", () => {
    it("has correct severity ordering", () => {
      expect(LOG_LEVEL_ORDER.debug).toBeLessThan(LOG_LEVEL_ORDER.info);
      expect(LOG_LEVEL_ORDER.info).toBeLessThan(LOG_LEVEL_ORDER.warning);
      expect(LOG_LEVEL_ORDER.warning).toBeLessThan(LOG_LEVEL_ORDER.error);
      expect(LOG_LEVEL_ORDER.error).toBeLessThan(LOG_LEVEL_ORDER.critical);
    });
  });

  describe("LOG_LEVEL_CONFIG", () => {
    it("provides config for all levels", () => {
      const levels: LogLevel[] = ["debug", "info", "warning", "error", "critical"];

      for (const level of levels) {
        expect(LOG_LEVEL_CONFIG[level]).toBeDefined();
        expect(LOG_LEVEL_CONFIG[level].label).toBeTruthy();
        expect(LOG_LEVEL_CONFIG[level].color).toBeTruthy();
        expect(LOG_LEVEL_CONFIG[level].bgColor).toBeTruthy();
      }
    });
  });

  describe("DEFAULT_STREAM_CONFIG", () => {
    it("has sensible defaults", () => {
      expect(DEFAULT_STREAM_CONFIG.autoReconnect).toBe(true);
      expect(DEFAULT_STREAM_CONFIG.reconnectDelay).toBeGreaterThan(0);
      expect(DEFAULT_STREAM_CONFIG.maxReconnectAttempts).toBeGreaterThan(0);
      expect(DEFAULT_STREAM_CONFIG.defaultFilters.minLevel).toBe("warning");
    });
  });

  describe("TEMPLATE_ERROR_PATTERNS", () => {
    it("matches common template error patterns", () => {
      const testCases = ["qweb error", "Template not found", "t-if invalid", "XML error"];

      for (const text of testCases) {
        const matches = TEMPLATE_ERROR_PATTERNS.some((p) => p.test(text));
        expect(matches).toBe(true);
      }
    });
  });

  describe("STYLE_ERROR_PATTERNS", () => {
    it("matches common style error patterns", () => {
      const testCases = ["SCSS error", "CSS invalid", "stylesheet failed", "asset bundle"];

      for (const text of testCases) {
        const matches = STYLE_ERROR_PATTERNS.some((p) => p.test(text));
        expect(matches).toBe(true);
      }
    });
  });

  describe("OdooLogStream class", () => {
    it("initializes with disconnected state", () => {
      const stream = createLogStream({ url: "ws://localhost:8069/logs" });

      expect(stream.getState()).toBe("disconnected");
    });

    it("allows setting and getting filters", () => {
      const stream = createLogStream({ url: "ws://localhost:8069/logs" });

      stream.setFilters({ minLevel: "error" });
      expect(stream.getFilters().minLevel).toBe("error");
    });

    it("provides empty log buffer initially", () => {
      const stream = createLogStream({ url: "ws://localhost:8069/logs" });

      expect(stream.getLogBuffer()).toEqual([]);
      expect(stream.getFilteredLogs()).toEqual([]);
    });

    it("clears buffer on clearBuffer call", () => {
      const stream = createLogStream({ url: "ws://localhost:8069/logs" });
      stream.clearBuffer();

      expect(stream.getLogBuffer()).toEqual([]);
    });
  });

  describe("createMockLogEntry", () => {
    it("creates entry with default values", () => {
      const entry = createMockLogEntry();

      expect(entry.id).toBeTruthy();
      expect(entry.timestamp).toBeInstanceOf(Date);
      expect(entry.level).toBe("error");
      expect(entry.logger).toBe("odoo.test");
      expect(entry.message).toBe("Test error message");
    });

    it("allows overriding values", () => {
      const entry = createMockLogEntry({
        level: "warning",
        logger: "custom.logger",
        message: "Custom message",
      });

      expect(entry.level).toBe("warning");
      expect(entry.logger).toBe("custom.logger");
      expect(entry.message).toBe("Custom message");
    });
  });
});
