import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ParentBridge,
  IframeBridge,
  createParentBridge,
  createIframeBridge,
  generateIframeBridgeScript,
  IFRAME_BRIDGE_SCRIPT,
  type BridgeMessage,
  type BridgeCommand,
  type BridgeEvent,
  type BridgeResponse,
} from "@/lib/preview/message-bridge";

describe("ParentBridge", () => {
  let bridge: ParentBridge;
  let iframe: HTMLIFrameElement;
  let postMessageSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    iframe = document.createElement("iframe");
    document.body.appendChild(iframe);

    // Mock contentWindow.postMessage
    postMessageSpy = vi.fn();
    Object.defineProperty(iframe, "contentWindow", {
      value: { postMessage: postMessageSpy },
      writable: true,
    });

    bridge = new ParentBridge(iframe);
  });

  afterEach(() => {
    bridge.dispose();
    document.body.removeChild(iframe);
  });

  describe("send", () => {
    it("sends command to iframe", () => {
      bridge.send("test-cmd", { data: "value" });

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "platxa:cmd:test-cmd",
          payload: { data: "value" },
          timestamp: expect.any(Number),
          messageId: expect.any(String),
        }),
        "*"
      );
    });

    it("sends command without payload", () => {
      bridge.send("simple-cmd");

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "platxa:cmd:simple-cmd",
        }),
        "*"
      );
    });

    it("uses custom namespace", () => {
      bridge.dispose();
      bridge = new ParentBridge(iframe, { namespace: "custom" });

      bridge.send("test", {});

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "custom:cmd:test",
        }),
        "*"
      );
    });
  });

  describe("request", () => {
    it("sends command and returns promise", async () => {
      const promise = bridge.request("get-data", { id: 1 }, 50);

      expect(promise).toBeInstanceOf(Promise);
      expect(postMessageSpy).toHaveBeenCalled();

      // Clean up: let the promise reject via timeout to avoid unhandled rejection
      await expect(promise).rejects.toThrow("timed out");
    });

    it("resolves when response received", async () => {
      const promise = bridge.request<{ id: number }, string>("get-name", { id: 1 });

      // Get the messageId from the sent message
      const sentMessage = postMessageSpy.mock.calls[0][0];
      const messageId = sentMessage.messageId;

      // Simulate response from iframe
      const response: BridgeResponse<string> = {
        type: "platxa:res:get-name",
        commandId: messageId,
        payload: "John",
        success: true,
        timestamp: Date.now(),
      };

      window.dispatchEvent(new MessageEvent("message", { data: response }));

      await expect(promise).resolves.toBe("John");
    });

    it("rejects when error response received", async () => {
      const promise = bridge.request("fail-cmd", {});

      const sentMessage = postMessageSpy.mock.calls[0][0];
      const messageId = sentMessage.messageId;

      const response: BridgeResponse = {
        type: "platxa:res:fail-cmd",
        commandId: messageId,
        success: false,
        error: { code: "ERR", message: "Something went wrong" },
        timestamp: Date.now(),
      };

      window.dispatchEvent(new MessageEvent("message", { data: response }));

      await expect(promise).rejects.toThrow("Something went wrong");
    });

    it("rejects on timeout", async () => {
      const promise = bridge.request("slow-cmd", {}, 50);

      await expect(promise).rejects.toThrow("timed out");
    });
  });

  describe("on", () => {
    it("registers event handler", () => {
      const handler = vi.fn();
      bridge.on("element-clicked", handler);

      const event: BridgeEvent = {
        type: "platxa:evt:element-clicked",
        payload: { elementId: "el-1" },
        timestamp: Date.now(),
      };

      window.dispatchEvent(new MessageEvent("message", { data: event }));

      expect(handler).toHaveBeenCalledWith(
        { elementId: "el-1" },
        expect.objectContaining({ type: "platxa:evt:element-clicked" })
      );
    });

    it("allows multiple handlers for same event", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bridge.on("test-event", handler1);
      bridge.on("test-event", handler2);

      const event: BridgeEvent = {
        type: "platxa:evt:test-event",
        payload: {},
        timestamp: Date.now(),
      };

      window.dispatchEvent(new MessageEvent("message", { data: event }));

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it("returns unsubscribe function", () => {
      const handler = vi.fn();
      const unsubscribe = bridge.on("test-event", handler);

      unsubscribe();

      const event: BridgeEvent = {
        type: "platxa:evt:test-event",
        payload: {},
        timestamp: Date.now(),
      };

      window.dispatchEvent(new MessageEvent("message", { data: event }));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("once", () => {
    it("handles event only once", () => {
      const handler = vi.fn();
      bridge.once("one-time", handler);

      const event: BridgeEvent = {
        type: "platxa:evt:one-time",
        payload: {},
        timestamp: Date.now(),
      };

      window.dispatchEvent(new MessageEvent("message", { data: event }));
      window.dispatchEvent(new MessageEvent("message", { data: event }));

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("off", () => {
    it("removes all handlers for event", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bridge.on("removable", handler1);
      bridge.on("removable", handler2);
      bridge.off("removable");

      const event: BridgeEvent = {
        type: "platxa:evt:removable",
        payload: {},
        timestamp: Date.now(),
      };

      window.dispatchEvent(new MessageEvent("message", { data: event }));

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe("onError", () => {
    it("calls error handler on handler error", () => {
      const errorHandler = vi.fn();
      bridge.onError(errorHandler);

      bridge.on("error-event", () => {
        throw new Error("Handler failed");
      });

      const event: BridgeEvent = {
        type: "platxa:evt:error-event",
        payload: {},
        timestamp: Date.now(),
      };

      window.dispatchEvent(new MessageEvent("message", { data: event }));

      expect(errorHandler).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ type: "platxa:evt:error-event" })
      );
    });

    it("allows unsubscribing error handler", () => {
      const errorHandler = vi.fn();
      const unsubscribe = bridge.onError(errorHandler);

      unsubscribe();

      bridge.on("error-event", () => {
        throw new Error("Handler failed");
      });

      const event: BridgeEvent = {
        type: "platxa:evt:error-event",
        payload: {},
        timestamp: Date.now(),
      };

      window.dispatchEvent(new MessageEvent("message", { data: event }));

      expect(errorHandler).not.toHaveBeenCalled();
    });
  });

  describe("dispose", () => {
    it("cleans up resources", () => {
      const handler = vi.fn();
      bridge.on("test", handler);

      bridge.dispose();

      const event: BridgeEvent = {
        type: "platxa:evt:test",
        payload: {},
        timestamp: Date.now(),
      };

      window.dispatchEvent(new MessageEvent("message", { data: event }));

      expect(handler).not.toHaveBeenCalled();
    });

    it("rejects pending requests", async () => {
      const promise = bridge.request("pending-cmd", {});

      bridge.dispose();

      await expect(promise).rejects.toThrow("Bridge disposed");
    });
  });
});

describe("IframeBridge", () => {
  let bridge: IframeBridge;
  let postMessageSpy: ReturnType<typeof vi.fn>;
  let originalParent: typeof window.parent;

  beforeEach(() => {
    postMessageSpy = vi.fn();
    originalParent = window.parent;

    // Mock window.parent.postMessage
    Object.defineProperty(window, "parent", {
      value: { postMessage: postMessageSpy },
      writable: true,
      configurable: true,
    });

    bridge = new IframeBridge();
  });

  afterEach(() => {
    bridge.dispose();
    Object.defineProperty(window, "parent", {
      value: originalParent,
      writable: true,
      configurable: true,
    });
  });

  describe("emit", () => {
    it("emits event to parent", () => {
      bridge.emit("click", { x: 100, y: 200 });

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "platxa:evt:click",
          payload: { x: 100, y: 200 },
          timestamp: expect.any(Number),
        }),
        "*"
      );
    });

    it("emits event without payload", () => {
      bridge.emit("ready");

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "platxa:evt:ready",
        }),
        "*"
      );
    });
  });

  describe("respond", () => {
    it("sends success response", () => {
      bridge.respond("cmd-123", "get-data", { result: "success" });

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "platxa:res:get-data",
          commandId: "cmd-123",
          payload: { result: "success" },
          success: true,
        }),
        "*"
      );
    });

    it("sends failure response", () => {
      bridge.respond("cmd-456", "fail-cmd", null, false);

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "platxa:res:fail-cmd",
          commandId: "cmd-456",
          success: false,
        }),
        "*"
      );
    });
  });

  describe("respondError", () => {
    it("sends error response", () => {
      bridge.respondError("cmd-789", "error-cmd", new Error("Failed"));

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "platxa:res:error-cmd",
          commandId: "cmd-789",
          success: false,
          error: { code: "ERROR", message: "Failed" },
        }),
        "*"
      );
    });
  });

  describe("onCommand", () => {
    it("handles commands from parent", () => {
      const handler = vi.fn();
      bridge.onCommand("update-css", handler);

      const command: BridgeCommand = {
        type: "platxa:cmd:update-css",
        payload: { css: ".foo {}" },
        timestamp: Date.now(),
      };

      window.dispatchEvent(new MessageEvent("message", { data: command }));

      expect(handler).toHaveBeenCalledWith(
        { css: ".foo {}" },
        expect.objectContaining({ type: "platxa:cmd:update-css" })
      );
    });

    it("returns unsubscribe function", () => {
      const handler = vi.fn();
      const unsubscribe = bridge.onCommand("test-cmd", handler);

      unsubscribe();

      const command: BridgeCommand = {
        type: "platxa:cmd:test-cmd",
        payload: {},
        timestamp: Date.now(),
      };

      window.dispatchEvent(new MessageEvent("message", { data: command }));

      expect(handler).not.toHaveBeenCalled();
    });

    it("auto-responds when handler returns value", () => {
      bridge.onCommand("get-value", () => "result");

      const command: BridgeCommand = {
        type: "platxa:cmd:get-value",
        messageId: "msg-1",
        payload: {},
        timestamp: Date.now(),
      };

      window.dispatchEvent(new MessageEvent("message", { data: command }));

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "platxa:res:get-value",
          commandId: "msg-1",
          payload: "result",
          success: true,
        }),
        "*"
      );
    });

    it("auto-responds with error when handler throws", () => {
      bridge.onCommand("fail-cmd", () => {
        throw new Error("Handler failed");
      });

      const command: BridgeCommand = {
        type: "platxa:cmd:fail-cmd",
        messageId: "msg-2",
        payload: {},
        timestamp: Date.now(),
      };

      window.dispatchEvent(new MessageEvent("message", { data: command }));

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "platxa:res:fail-cmd",
          commandId: "msg-2",
          success: false,
          error: expect.objectContaining({ message: "Handler failed" }),
        }),
        "*"
      );
    });
  });

  describe("onError", () => {
    it("calls error handler on command handler error", () => {
      const errorHandler = vi.fn();
      bridge.onError(errorHandler);

      bridge.onCommand("error-cmd", () => {
        throw new Error("Command failed");
      });

      const command: BridgeCommand = {
        type: "platxa:cmd:error-cmd",
        payload: {},
        timestamp: Date.now(),
      };

      window.dispatchEvent(new MessageEvent("message", { data: command }));

      expect(errorHandler).toHaveBeenCalled();
    });
  });
});

describe("generateIframeBridgeScript", () => {
  it("generates script with default config", () => {
    const script = generateIframeBridgeScript();

    expect(script).toContain("<script>");
    expect(script).toContain("</script>");
    expect(script).toContain("__PLATXA_BRIDGE__");
  });

  it("exposes emit function", () => {
    const script = generateIframeBridgeScript();

    expect(script).toContain("function emit");
    expect(script).toContain("emit: emit");
  });

  it("exposes respond function", () => {
    const script = generateIframeBridgeScript();

    expect(script).toContain("function respond");
    expect(script).toContain("respond: respond");
  });

  it("exposes respondError function", () => {
    const script = generateIframeBridgeScript();

    expect(script).toContain("function respondError");
    expect(script).toContain("respondError: respondError");
  });

  it("exposes onCommand function", () => {
    const script = generateIframeBridgeScript();

    expect(script).toContain("function onCommand");
    expect(script).toContain("onCommand: onCommand");
  });

  it("exposes onError function", () => {
    const script = generateIframeBridgeScript();

    expect(script).toContain("function onError");
    expect(script).toContain("onError: onError");
  });

  it("emits bridge-ready event on init", () => {
    const script = generateIframeBridgeScript();

    expect(script).toContain("emit('bridge-ready'");
  });

  it("uses custom namespace", () => {
    const script = generateIframeBridgeScript({ namespace: "myapp" });

    expect(script).toContain("namespace: 'myapp'");
  });

  it("uses custom targetOrigin", () => {
    const script = generateIframeBridgeScript({ targetOrigin: "https://example.com" });

    expect(script).toContain("targetOrigin: 'https://example.com'");
  });

  it("enables debug mode", () => {
    const script = generateIframeBridgeScript({ debug: true });

    expect(script).toContain("debug: true");
  });
});

describe("IFRAME_BRIDGE_SCRIPT", () => {
  it("is pre-generated with defaults", () => {
    expect(IFRAME_BRIDGE_SCRIPT).toContain("__PLATXA_BRIDGE__");
    expect(IFRAME_BRIDGE_SCRIPT).toContain("namespace: 'platxa'");
  });
});

describe("createParentBridge", () => {
  it("creates a ParentBridge", () => {
    const iframe = document.createElement("iframe");
    const bridge = createParentBridge(iframe);

    expect(bridge).toBeInstanceOf(ParentBridge);

    bridge.dispose();
  });
});

describe("createIframeBridge", () => {
  it("creates an IframeBridge", () => {
    const bridge = createIframeBridge();

    expect(bridge).toBeInstanceOf(IframeBridge);

    bridge.dispose();
  });
});

describe("verification: parent posts commands; iframe posts events; both handle errors", () => {
  it("parent posts commands to iframe", () => {
    const iframe = document.createElement("iframe");
    const postMessageSpy = vi.fn();
    Object.defineProperty(iframe, "contentWindow", {
      value: { postMessage: postMessageSpy },
    });

    const bridge = createParentBridge(iframe);
    bridge.send("test-command", { data: 123 });

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "platxa:cmd:test-command",
        payload: { data: 123 },
      }),
      "*"
    );

    bridge.dispose();
  });

  it("iframe posts events to parent", () => {
    const postMessageSpy = vi.fn();
    const originalParent = window.parent;
    Object.defineProperty(window, "parent", {
      value: { postMessage: postMessageSpy },
      configurable: true,
    });

    const bridge = createIframeBridge();
    bridge.emit("test-event", { value: "abc" });

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "platxa:evt:test-event",
        payload: { value: "abc" },
      }),
      "*"
    );

    bridge.dispose();
    Object.defineProperty(window, "parent", {
      value: originalParent,
      configurable: true,
    });
  });

  it("parent handles errors gracefully", () => {
    const iframe = document.createElement("iframe");
    Object.defineProperty(iframe, "contentWindow", {
      value: { postMessage: vi.fn() },
    });

    const bridge = createParentBridge(iframe);
    const errorHandler = vi.fn();
    bridge.onError(errorHandler);

    bridge.on("error-prone", () => {
      throw new Error("Handler error");
    });

    const event: BridgeEvent = {
      type: "platxa:evt:error-prone",
      payload: {},
      timestamp: Date.now(),
    };

    // Should not throw
    expect(() => {
      window.dispatchEvent(new MessageEvent("message", { data: event }));
    }).not.toThrow();

    expect(errorHandler).toHaveBeenCalled();

    bridge.dispose();
  });

  it("iframe handles errors gracefully", () => {
    const postMessageSpy = vi.fn();
    const originalParent = window.parent;
    Object.defineProperty(window, "parent", {
      value: { postMessage: postMessageSpy },
      configurable: true,
    });

    const bridge = createIframeBridge();
    const errorHandler = vi.fn();
    bridge.onError(errorHandler);

    bridge.onCommand("error-cmd", () => {
      throw new Error("Command error");
    });

    const command: BridgeCommand = {
      type: "platxa:cmd:error-cmd",
      payload: {},
      timestamp: Date.now(),
    };

    // Should not throw
    expect(() => {
      window.dispatchEvent(new MessageEvent("message", { data: command }));
    }).not.toThrow();

    expect(errorHandler).toHaveBeenCalled();

    bridge.dispose();
    Object.defineProperty(window, "parent", {
      value: originalParent,
      configurable: true,
    });
  });
});
