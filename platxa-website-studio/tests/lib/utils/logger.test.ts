import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  Logger,
  createLogger,
  generateRequestId,
  loggerFromRequest,
} from "@/lib/utils/logger";

describe("logger", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  describe("Logger level filtering", () => {
    it("logs debug messages in development", () => {
      process.env.NODE_ENV = "development";
      const logger = new Logger({ minLevel: "debug" });
      logger.debug("test debug");
      expect(console.debug).toHaveBeenCalledOnce();
    });

    it("suppresses debug messages in production", () => {
      process.env.NODE_ENV = "production";
      const logger = new Logger(); // defaults to "warn" in production
      logger.debug("test debug");
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
    });

    it("suppresses info messages in production by default", () => {
      process.env.NODE_ENV = "production";
      const logger = new Logger();
      logger.info("test info");
      expect(console.log).not.toHaveBeenCalled();
    });

    it("logs warn messages in production", () => {
      process.env.NODE_ENV = "production";
      const logger = new Logger();
      logger.warn("test warn");
      expect(console.warn).toHaveBeenCalledOnce();
    });

    it("logs error messages in production", () => {
      process.env.NODE_ENV = "production";
      const logger = new Logger();
      logger.error("test error");
      expect(console.error).toHaveBeenCalledOnce();
    });
  });

  describe("Logger context and child loggers", () => {
    it("child logger merges context from parent", () => {
      process.env.NODE_ENV = "development";
      const parent = new Logger({
        minLevel: "debug",
        context: { source: "test", requestId: "req-123" },
      });
      const child = parent.child({ userId: "user-456" });
      child.info("hello");
      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(output).toContain("[test]");
      expect(output).toContain("hello");
    });
  });

  describe("Error logging", () => {
    it("extracts error name, message, and stack from Error objects", () => {
      process.env.NODE_ENV = "production";
      const logger = new Logger({ minLevel: "error" });
      const err = new Error("Something broke");
      logger.error("Operation failed", err);

      const output = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.errorName).toBe("Error");
      expect(parsed.errorMessage).toBe("Something broke");
      expect(parsed.stack).toBeDefined();
    });

    it("handles null error gracefully", () => {
      process.env.NODE_ENV = "production";
      const logger = new Logger({ minLevel: "error" });
      logger.error("Operation failed", null);
      expect(console.error).toHaveBeenCalledOnce();
    });
  });

  describe("Output format", () => {
    it("outputs JSON in production", () => {
      process.env.NODE_ENV = "production";
      const logger = new Logger({ minLevel: "warn" });
      logger.warn("test warning", { key: "value" });

      const output = (console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.level).toBe("warn");
      expect(parsed.message).toBe("test warning");
      expect(parsed.key).toBe("value");
      expect(parsed.timestamp).toBeDefined();
    });

    it("outputs human-readable format in development", () => {
      process.env.NODE_ENV = "development";
      const logger = new Logger({
        minLevel: "info",
        context: { source: "api" },
      });
      logger.info("request received", { method: "GET" });

      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(output).toContain("[INFO]");
      expect(output).toContain("[api]");
      expect(output).toContain("request received");
    });
  });

  describe("generateRequestId", () => {
    it("creates unique IDs", () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      expect(id1).not.toBe(id2);
    });

    it("starts with req_ prefix", () => {
      const id = generateRequestId();
      expect(id).toMatch(/^req_/);
    });
  });

  describe("loggerFromRequest", () => {
    it("extracts method and pathname from request", () => {
      process.env.NODE_ENV = "development";
      const req = new Request("https://example.com/api/deploy", {
        method: "POST",
      });
      const logger = loggerFromRequest(req, "deploy");
      logger.warn("test");

      const output = (console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(output).toContain("[deploy]");
    });

    it("includes requestId in context", () => {
      process.env.NODE_ENV = "production";
      const req = new Request("https://example.com/api/deploy", {
        method: "POST",
      });
      const logger = loggerFromRequest(req, "deploy");
      logger.warn("test");

      const output = (console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.requestId).toMatch(/^req_/);
      expect(parsed.method).toBe("POST");
      expect(parsed.pathname).toBe("/api/deploy");
    });
  });
});
