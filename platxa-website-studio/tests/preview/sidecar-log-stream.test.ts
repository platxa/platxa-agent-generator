// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  SidecarLogStream,
  MockWebSocket,
  createSidecarLogStream,
  mapLogLevel,
  parseTimestamp,
  meetsMinLevel,
  parseSidecarLogMessage,
  type SidecarLogMessage,
  type StreamEvent,
} from "@/lib/preview/sidecar-log-stream";
import { LogInspector } from "@/lib/preview/log-inspector";

// Mock global WebSocket with MockWebSocket
const originalWebSocket = globalThis.WebSocket;

describe("Sidecar Log Stream (Feature #175)", () => {
  let inspector: LogInspector;

  beforeEach(() => {
    inspector = new LogInspector();
    MockWebSocket.clearInstances();
    // Replace global WebSocket with mock
    (globalThis as any).WebSocket = MockWebSocket;
  });

  afterEach(() => {
    // Restore original WebSocket
    (globalThis as any).WebSocket = originalWebSocket;
  });

  describe("mapLogLevel", () => {
    it("maps debug to debug", () => {
      expect(mapLogLevel("debug")).toBe("debug");
    });

    it("maps info to info", () => {
      expect(mapLogLevel("info")).toBe("info");
    });

    it("maps warning to warning", () => {
      expect(mapLogLevel("warning")).toBe("warning");
    });

    it("maps error to error", () => {
      expect(mapLogLevel("error")).toBe("error");
    });

    it("maps critical to error", () => {
      expect(mapLogLevel("critical")).toBe("error");
    });
  });

  describe("parseTimestamp", () => {
    it("returns current time for undefined", () => {
      const before = Date.now();
      const result = parseTimestamp(undefined);
      const after = Date.now();

      expect(result).toBeGreaterThanOrEqual(before);
      expect(result).toBeLessThanOrEqual(after);
    });

    it("parses ISO string timestamp", () => {
      const isoString = "2024-01-15T10:30:00.000Z";
      const result = parseTimestamp(isoString);

      expect(result).toBe(Date.parse(isoString));
    });

    it("handles Unix milliseconds", () => {
      const ms = 1705315800000;
      expect(parseTimestamp(ms)).toBe(ms);
    });

    it("converts Unix seconds to milliseconds", () => {
      const seconds = 1705315800;
      expect(parseTimestamp(seconds)).toBe(seconds * 1000);
    });

    it("returns current time for invalid string", () => {
      const before = Date.now();
      const result = parseTimestamp("invalid");
      const after = Date.now();

      expect(result).toBeGreaterThanOrEqual(before);
      expect(result).toBeLessThanOrEqual(after);
    });
  });

  describe("meetsMinLevel", () => {
    it("debug meets debug minimum", () => {
      expect(meetsMinLevel("debug", "debug")).toBe(true);
    });

    it("info meets debug minimum", () => {
      expect(meetsMinLevel("info", "debug")).toBe(true);
    });

    it("debug does not meet info minimum", () => {
      expect(meetsMinLevel("debug", "info")).toBe(false);
    });

    it("error meets all minimums", () => {
      expect(meetsMinLevel("error", "debug")).toBe(true);
      expect(meetsMinLevel("error", "info")).toBe(true);
      expect(meetsMinLevel("error", "warning")).toBe(true);
      expect(meetsMinLevel("error", "error")).toBe(true);
    });

    it("warning does not meet error minimum", () => {
      expect(meetsMinLevel("warning", "error")).toBe(false);
    });
  });

  describe("parseSidecarLogMessage", () => {
    it("parses valid log message", () => {
      const data = JSON.stringify({
        level: "info",
        message: "Test message",
        timestamp: "2024-01-15T10:30:00.000Z",
        logger: "odoo.http",
        file: "/app/odoo.py",
        line: 123,
      });

      const result = parseSidecarLogMessage(data);

      expect(result).not.toBeNull();
      expect(result!.level).toBe("info");
      expect(result!.message).toBe("Test message");
      expect(result!.logger).toBe("odoo.http");
      expect(result!.file).toBe("/app/odoo.py");
      expect(result!.line).toBe(123);
    });

    it("returns null for invalid JSON", () => {
      expect(parseSidecarLogMessage("not json")).toBeNull();
    });

    it("returns null for missing message", () => {
      const data = JSON.stringify({ level: "info" });
      expect(parseSidecarLogMessage(data)).toBeNull();
    });

    it("returns null for missing level", () => {
      const data = JSON.stringify({ message: "Test" });
      expect(parseSidecarLogMessage(data)).toBeNull();
    });

    it("includes optional data field", () => {
      const data = JSON.stringify({
        level: "error",
        message: "Error occurred",
        data: { requestId: "abc123", userId: 42 },
      });

      const result = parseSidecarLogMessage(data);

      expect(result!.data).toEqual({ requestId: "abc123", userId: 42 });
    });
  });

  describe("SidecarLogStream", () => {
    describe("connection", () => {
      it("connects to WebSocket with correct URL", () => {
        const stream = createSidecarLogStream(inspector, {
          wsUrl: "ws://test:8080/ws/logs",
        });

        stream.connect();

        const ws = MockWebSocket.getLastInstance();
        expect(ws).toBeDefined();
        expect(ws!.url).toBe("ws://test:8080/ws/logs");
      });

      it("includes auth token in subprotocol", () => {
        const stream = createSidecarLogStream(inspector, {
          wsUrl: "ws://test:8080/ws/logs",
          authToken: "secret-token",
        });

        stream.connect();

        const ws = MockWebSocket.getLastInstance();
        expect(ws!.protocol).toBe("bearer-secret-token");
      });

      it("sets state to connecting", () => {
        const stream = createSidecarLogStream(inspector);
        expect(stream.getState()).toBe("disconnected");

        stream.connect();

        expect(stream.getState()).toBe("connecting");
      });

      it("sets state to connected on open", () => {
        const stream = createSidecarLogStream(inspector);
        stream.connect();

        const ws = MockWebSocket.getLastInstance();
        ws!.simulateOpen();

        expect(stream.getState()).toBe("connected");
        expect(stream.isConnected()).toBe(true);
      });

      it("emits connect event on open", () => {
        const stream = createSidecarLogStream(inspector);
        const events: StreamEvent[] = [];
        stream.onEvent((e) => events.push(e));

        stream.connect();
        MockWebSocket.getLastInstance()!.simulateOpen();

        expect(events.some((e) => e.type === "connect")).toBe(true);
      });

      it("logs connection to inspector", () => {
        const stream = createSidecarLogStream(inspector);
        stream.connect();
        MockWebSocket.getLastInstance()!.simulateOpen();

        const logs = inspector.getBySource("sidecar");
        expect(logs.some((l) => l.message.includes("Connected"))).toBe(true);
      });
    });

    describe("message handling", () => {
      it("streams logs to LogInspector via WebSocket", () => {
        const stream = createSidecarLogStream(inspector, {
          minLevel: "debug",
          includeDebug: true,
        });
        stream.connect();
        MockWebSocket.getLastInstance()!.simulateOpen();

        // Simulate receiving log message
        MockWebSocket.getLastInstance()!.simulateMessage(
          JSON.stringify({
            level: "info",
            message: "Odoo server started",
            logger: "odoo.service",
          })
        );

        const logs = inspector.getBySource("sidecar");
        expect(logs.some((l) => l.message === "Odoo server started")).toBe(true);
      });

      it("maps log levels correctly", () => {
        const stream = createSidecarLogStream(inspector, { minLevel: "debug", includeDebug: true });
        stream.connect();
        MockWebSocket.getLastInstance()!.simulateOpen();

        MockWebSocket.getLastInstance()!.simulateMessage(
          JSON.stringify({ level: "error", message: "Error message" })
        );

        const logs = inspector.getErrors();
        expect(logs.some((l) => l.message === "Error message" && l.source === "sidecar")).toBe(true);
      });

      it("includes file and line info", () => {
        const stream = createSidecarLogStream(inspector);
        stream.connect();
        MockWebSocket.getLastInstance()!.simulateOpen();

        MockWebSocket.getLastInstance()!.simulateMessage(
          JSON.stringify({
            level: "error",
            message: "Syntax error",
            file: "/app/models.py",
            line: 42,
          })
        );

        const logs = inspector.getBySource("sidecar");
        const errorLog = logs.find((l) => l.message === "Syntax error");
        expect(errorLog).toBeDefined();
        expect(errorLog!.file).toBe("/app/models.py");
        expect(errorLog!.line).toBe(42);
      });

      it("filters by minimum log level", () => {
        const stream = createSidecarLogStream(inspector, { minLevel: "warning" });
        stream.connect();
        MockWebSocket.getLastInstance()!.simulateOpen();

        // Send info (should be filtered)
        MockWebSocket.getLastInstance()!.simulateMessage(
          JSON.stringify({ level: "info", message: "Info message" })
        );

        // Send warning (should pass)
        MockWebSocket.getLastInstance()!.simulateMessage(
          JSON.stringify({ level: "warning", message: "Warning message" })
        );

        const logs = inspector.getBySource("sidecar");
        expect(logs.some((l) => l.message === "Info message")).toBe(false);
        expect(logs.some((l) => l.message === "Warning message")).toBe(true);
      });

      it("filters debug logs when includeDebug is false", () => {
        const stream = createSidecarLogStream(inspector, {
          minLevel: "debug",
          includeDebug: false,
        });
        stream.connect();
        MockWebSocket.getLastInstance()!.simulateOpen();

        MockWebSocket.getLastInstance()!.simulateMessage(
          JSON.stringify({ level: "debug", message: "Debug message" })
        );

        const logs = inspector.getBySource("sidecar");
        expect(logs.some((l) => l.message === "Debug message")).toBe(false);
      });

      it("ignores invalid messages", () => {
        const stream = createSidecarLogStream(inspector);
        stream.connect();
        MockWebSocket.getLastInstance()!.simulateOpen();

        const initialCount = inspector.getAll().length;

        MockWebSocket.getLastInstance()!.simulateMessage("invalid json");
        MockWebSocket.getLastInstance()!.simulateMessage("{}");

        // Should not have added any logs (besides connection log)
        expect(inspector.getAll().length).toBe(initialCount);
      });

      it("increments logs received counter", () => {
        const stream = createSidecarLogStream(inspector);
        stream.connect();
        MockWebSocket.getLastInstance()!.simulateOpen();

        expect(stream.getLogsReceived()).toBe(0);

        MockWebSocket.getLastInstance()!.simulateMessage(
          JSON.stringify({ level: "info", message: "Message 1" })
        );
        MockWebSocket.getLastInstance()!.simulateMessage(
          JSON.stringify({ level: "info", message: "Message 2" })
        );

        expect(stream.getLogsReceived()).toBe(2);
      });

      it("emits log event for each message", () => {
        const stream = createSidecarLogStream(inspector);
        const events: StreamEvent[] = [];
        stream.onEvent((e) => events.push(e));

        stream.connect();
        MockWebSocket.getLastInstance()!.simulateOpen();
        MockWebSocket.getLastInstance()!.simulateMessage(
          JSON.stringify({ level: "info", message: "Test" })
        );

        expect(events.some((e) => e.type === "log")).toBe(true);
      });
    });

    describe("disconnection", () => {
      it("disconnects cleanly", () => {
        const stream = createSidecarLogStream(inspector);
        stream.connect();
        MockWebSocket.getLastInstance()!.simulateOpen();

        stream.disconnect();

        expect(stream.getState()).toBe("disconnected");
        expect(stream.isConnected()).toBe(false);
      });

      it("emits disconnect event", () => {
        const stream = createSidecarLogStream(inspector);
        const events: StreamEvent[] = [];
        stream.onEvent((e) => events.push(e));

        stream.connect();
        MockWebSocket.getLastInstance()!.simulateOpen();
        stream.disconnect();

        expect(events.some((e) => e.type === "disconnect")).toBe(true);
      });

      it("logs disconnection to inspector", () => {
        const stream = createSidecarLogStream(inspector, { autoReconnect: false });
        stream.connect();
        MockWebSocket.getLastInstance()!.simulateOpen();

        MockWebSocket.getLastInstance()!.simulateClose(1000, "Normal closure");

        const logs = inspector.getBySource("sidecar");
        expect(logs.some((l) => l.message.includes("disconnected"))).toBe(true);
      });
    });

    describe("reconnection", () => {
      it("schedules reconnect on close when autoReconnect is true", () => {
        vi.useFakeTimers();

        const stream = createSidecarLogStream(inspector, {
          autoReconnect: true,
          reconnectDelay: 1000,
        });
        stream.connect();
        MockWebSocket.getLastInstance()!.simulateOpen();
        MockWebSocket.getLastInstance()!.simulateClose(1006, "Connection lost");

        expect(stream.getState()).toBe("reconnecting");

        vi.advanceTimersByTime(1000);

        // Should have attempted reconnect
        expect(MockWebSocket.instances.length).toBe(2);

        vi.useRealTimers();
      });

      it("uses exponential backoff for reconnects", () => {
        vi.useFakeTimers();

        const stream = createSidecarLogStream(inspector, {
          autoReconnect: true,
          reconnectDelay: 1000,
          maxReconnectAttempts: 3,
        });

        stream.connect();
        MockWebSocket.getLastInstance()!.simulateOpen();

        // First disconnect
        MockWebSocket.getLastInstance()!.simulateClose(1006, "Lost");
        vi.advanceTimersByTime(1000); // First reconnect at 1s

        // Second disconnect
        MockWebSocket.getLastInstance()!.simulateClose(1006, "Lost");
        vi.advanceTimersByTime(2000); // Second reconnect at 2s

        expect(MockWebSocket.instances.length).toBe(3);

        vi.useRealTimers();
      });

      it("stops reconnecting after max attempts", () => {
        vi.useFakeTimers();

        const stream = createSidecarLogStream(inspector, {
          autoReconnect: true,
          reconnectDelay: 100,
          maxReconnectAttempts: 2,
        });

        stream.connect();
        MockWebSocket.getLastInstance()!.simulateOpen();
        MockWebSocket.getLastInstance()!.simulateClose(1006, "Lost");

        vi.advanceTimersByTime(100); // Attempt 1
        MockWebSocket.getLastInstance()!.simulateClose(1006, "Lost");

        vi.advanceTimersByTime(200); // Attempt 2
        MockWebSocket.getLastInstance()!.simulateClose(1006, "Lost");

        vi.advanceTimersByTime(1000); // Should not reconnect

        // 1 original + 2 reconnects = 3 total
        expect(MockWebSocket.instances.length).toBe(3);

        const logs = inspector.getBySource("sidecar");
        expect(logs.some((l) => l.message.includes("Failed to reconnect"))).toBe(true);

        vi.useRealTimers();
      });

      it("does not reconnect when autoReconnect is false", () => {
        vi.useFakeTimers();

        const stream = createSidecarLogStream(inspector, { autoReconnect: false });
        stream.connect();
        MockWebSocket.getLastInstance()!.simulateOpen();
        MockWebSocket.getLastInstance()!.simulateClose(1006, "Lost");

        vi.advanceTimersByTime(10000);

        expect(MockWebSocket.instances.length).toBe(1);

        vi.useRealTimers();
      });
    });

    describe("error handling", () => {
      it("handles WebSocket error", () => {
        const stream = createSidecarLogStream(inspector);
        stream.connect();
        MockWebSocket.getLastInstance()!.simulateError();

        expect(stream.getState()).toBe("error");
      });

      it("emits error event", () => {
        const stream = createSidecarLogStream(inspector);
        const events: StreamEvent[] = [];
        stream.onEvent((e) => events.push(e));

        stream.connect();
        MockWebSocket.getLastInstance()!.simulateError();

        expect(events.some((e) => e.type === "error")).toBe(true);
      });

      it("logs error to inspector", () => {
        const stream = createSidecarLogStream(inspector);
        stream.connect();
        MockWebSocket.getLastInstance()!.simulateError();

        const errors = inspector.getErrors();
        expect(errors.some((e) => e.source === "sidecar" && e.message.includes("error"))).toBe(true);
      });
    });

    describe("event callbacks", () => {
      it("registers and triggers callbacks", () => {
        const stream = createSidecarLogStream(inspector);
        const callback = vi.fn();

        stream.onEvent(callback);
        stream.connect();
        MockWebSocket.getLastInstance()!.simulateOpen();

        expect(callback).toHaveBeenCalled();
      });

      it("removes callbacks", () => {
        const stream = createSidecarLogStream(inspector);
        const callback = vi.fn();

        stream.onEvent(callback);
        stream.offEvent(callback);
        stream.connect();
        MockWebSocket.getLastInstance()!.simulateOpen();

        expect(callback).not.toHaveBeenCalled();
      });

      it("handles callback errors gracefully", () => {
        const stream = createSidecarLogStream(inspector);
        stream.onEvent(() => {
          throw new Error("Callback error");
        });

        // Should not throw
        expect(() => {
          stream.connect();
          MockWebSocket.getLastInstance()!.simulateOpen();
        }).not.toThrow();
      });
    });

    describe("configuration", () => {
      it("returns current configuration", () => {
        const stream = createSidecarLogStream(inspector, {
          wsUrl: "ws://custom:8080/logs",
          minLevel: "warning",
        });

        const config = stream.getConfig();

        expect(config.wsUrl).toBe("ws://custom:8080/logs");
        expect(config.minLevel).toBe("warning");
      });

      it("updates configuration", () => {
        const stream = createSidecarLogStream(inspector);
        stream.updateConfig({ minLevel: "error" });

        expect(stream.getConfig().minLevel).toBe("error");
      });
    });
  });

  describe("MockWebSocket", () => {
    it("tracks instances", () => {
      new MockWebSocket("ws://test1");
      new MockWebSocket("ws://test2");

      expect(MockWebSocket.instances.length).toBe(2);
    });

    it("clears instances", () => {
      new MockWebSocket("ws://test");
      MockWebSocket.clearInstances();

      expect(MockWebSocket.instances.length).toBe(0);
    });

    it("returns last instance", () => {
      new MockWebSocket("ws://test1");
      const last = new MockWebSocket("ws://test2");

      expect(MockWebSocket.getLastInstance()).toBe(last);
    });
  });
});
