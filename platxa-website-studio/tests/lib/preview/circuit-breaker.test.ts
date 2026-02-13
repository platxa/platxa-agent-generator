import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ParentBridge } from "@/lib/preview/message-bridge";

// Mock DOM environment for ParentBridge
function createMockIframe(): HTMLIFrameElement {
  const iframe = {
    contentWindow: {
      postMessage: vi.fn(),
    },
  } as unknown as HTMLIFrameElement;
  return iframe;
}

describe("ParentBridge Circuit Breaker", () => {
  let bridge: ParentBridge;
  let iframe: HTMLIFrameElement;

  beforeEach(() => {
    vi.useFakeTimers();
    // Mock window.addEventListener
    vi.spyOn(window, "addEventListener").mockImplementation(() => {});
    vi.spyOn(window, "removeEventListener").mockImplementation(() => {});

    iframe = createMockIframe();
    bridge = new ParentBridge(iframe, { defaultTimeout: 100 });
  });

  afterEach(() => {
    bridge.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts in closed state", () => {
    expect(bridge.getCircuitState()).toBe("closed");
  });

  it("stays closed after fewer failures than threshold", async () => {
    // Trigger 2 failures (threshold is 3)
    const p1 = bridge.request("cmd1").catch(() => {});
    vi.advanceTimersByTime(200);
    await p1;

    const p2 = bridge.request("cmd2").catch(() => {});
    vi.advanceTimersByTime(200);
    await p2;

    expect(bridge.getCircuitState()).toBe("closed");
  });

  it("opens after 3 consecutive failures", async () => {
    // Trigger 3 timeouts
    for (let i = 0; i < 3; i++) {
      const p = bridge.request(`cmd${i}`).catch(() => {});
      vi.advanceTimersByTime(200);
      await p;
    }

    expect(bridge.getCircuitState()).toBe("open");
  });

  it("rejects immediately when open", async () => {
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      const p = bridge.request(`cmd${i}`).catch(() => {});
      vi.advanceTimersByTime(200);
      await p;
    }

    expect(bridge.getCircuitState()).toBe("open");

    // Next request should reject immediately
    await expect(bridge.request("test")).rejects.toThrow("Circuit breaker is open");
  });

  it("transitions to half-open after reset timeout", async () => {
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      const p = bridge.request(`cmd${i}`).catch(() => {});
      vi.advanceTimersByTime(200);
      await p;
    }

    expect(bridge.getCircuitState()).toBe("open");

    // Advance past reset timeout (default 30s)
    vi.advanceTimersByTime(30000);
    expect(bridge.getCircuitState()).toBe("half-open");
  });

  it("closes on successful test request in half-open state", async () => {
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      const p = bridge.request(`cmd${i}`).catch(() => {});
      vi.advanceTimersByTime(200);
      await p;
    }

    // Move to half-open
    vi.advanceTimersByTime(30000);
    expect(bridge.getCircuitState()).toBe("half-open");

    // Simulate a successful request by manually triggering the response handler
    // Send a request (allowed in half-open)
    const requestPromise = bridge.request("test-cmd");

    // Simulate the iframe responding (get messageId from the postMessage call)
    const postMessageMock = (iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>);
    const lastCall = postMessageMock.mock.calls[postMessageMock.mock.calls.length - 1];
    const sentMessage = lastCall[0];

    // Dispatch a response message event
    const messageHandler = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => call[0] === "message"
    )?.[1] as ((event: MessageEvent) => void) | undefined;

    if (messageHandler) {
      messageHandler(new MessageEvent("message", {
        data: {
          type: "platxa:res:test-cmd",
          commandId: sentMessage.messageId,
          success: true,
          payload: "ok",
          timestamp: Date.now(),
        },
      }));
    }

    const result = await requestPromise;
    expect(result).toBe("ok");
    expect(bridge.getCircuitState()).toBe("closed");
  });

  it("reopens on failed test request in half-open state", async () => {
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      const p = bridge.request(`cmd${i}`).catch(() => {});
      vi.advanceTimersByTime(200);
      await p;
    }

    // Move to half-open
    vi.advanceTimersByTime(30000);
    expect(bridge.getCircuitState()).toBe("half-open");

    // Send a request that will timeout (fail)
    const p = bridge.request("test").catch(() => {});
    vi.advanceTimersByTime(200);
    await p;

    expect(bridge.getCircuitState()).toBe("open");
  });

  it("manual reset works", async () => {
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      const p = bridge.request(`cmd${i}`).catch(() => {});
      vi.advanceTimersByTime(200);
      await p;
    }

    expect(bridge.getCircuitState()).toBe("open");

    bridge.resetCircuit();
    expect(bridge.getCircuitState()).toBe("closed");
  });

  it("can be disabled via configuration", async () => {
    bridge.configureCircuitBreaker({ enabled: false });

    // Trigger many failures
    for (let i = 0; i < 5; i++) {
      const p = bridge.request(`cmd${i}`).catch(() => {});
      vi.advanceTimersByTime(200);
      await p;
    }

    // Should still be closed because circuit breaker is disabled
    expect(bridge.getCircuitState()).toBe("closed");
  });
});
