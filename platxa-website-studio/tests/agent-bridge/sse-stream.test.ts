import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createSSEEvent,
  formatSSE,
  parseSSE,
  createSSEEmitter,
  createSSEConsumer,
  resetEventCounter,
} from "@/lib/agent-bridge/sse-stream";
import type { ProgressData, TokenData, DoneData, SectionCompleteData } from "@/lib/agent-bridge/sse-stream";

beforeEach(() => {
  resetEventCounter();
});

describe("SSE Stream", () => {
  describe("createSSEEvent", () => {
    it("creates event with type, data, id, and timestamp", () => {
      const event = createSSEEvent("progress", { phase: "generating", percent: 50, message: "Half done" });
      expect(event.type).toBe("progress");
      expect(event.data).toEqual({ phase: "generating", percent: 50, message: "Half done" });
      expect(event.id).toBe("evt_1");
      expect(event.timestamp).toBeTruthy();
    });

    it("auto-increments event IDs", () => {
      const e1 = createSSEEvent("heartbeat", {});
      const e2 = createSSEEvent("heartbeat", {});
      expect(e1.id).toBe("evt_1");
      expect(e2.id).toBe("evt_2");
    });
  });

  describe("formatSSE", () => {
    it("produces valid SSE wire format", () => {
      const event = createSSEEvent("progress", { percent: 50 });
      const formatted = formatSSE(event);
      expect(formatted).toContain("id: evt_1");
      expect(formatted).toContain("event: progress");
      expect(formatted).toContain('data: {"percent":50}');
      expect(formatted).toMatch(/\n\n$/); // ends with double newline
    });
  });

  describe("parseSSE", () => {
    it("parses formatted SSE back to event", () => {
      const original = createSSEEvent("token", { token: "hello", target: "chat", tokenIndex: 1 });
      const formatted = formatSSE(original);
      const parsed = parseSSE(formatted);
      expect(parsed).not.toBeNull();
      expect(parsed!.type).toBe("token");
      expect((parsed!.data as TokenData).token).toBe("hello");
      expect(parsed!.id).toBe("evt_1");
    });

    it("returns null for empty input", () => {
      expect(parseSSE("")).toBeNull();
    });

    it("roundtrips all event types", () => {
      const types = ["progress", "token", "section", "error", "done", "heartbeat"] as const;
      for (const type of types) {
        const event = createSSEEvent(type, { test: true });
        const parsed = parseSSE(formatSSE(event));
        expect(parsed!.type).toBe(type);
      }
    });
  });

  describe("createSSEEmitter", () => {
    it("emits progress events", () => {
      const chunks: string[] = [];
      const emitter = createSSEEmitter((c) => chunks.push(c));
      emitter.progress("generating", "step1", 50, "Halfway");
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toContain("event: progress");
      expect(chunks[0]).toContain("Halfway");
    });

    it("emits token events with incrementing index", () => {
      const chunks: string[] = [];
      const emitter = createSSEEmitter((c) => chunks.push(c));
      emitter.token("<div>", "html", "s_hero");
      emitter.token("Hello", "html", "s_hero");
      expect(chunks).toHaveLength(2);
      expect(emitter.getTokenCount()).toBe(2);
    });

    it("emits section complete events", () => {
      const chunks: string[] = [];
      const emitter = createSSEEmitter((c) => chunks.push(c));
      emitter.section({
        sectionType: "hero",
        snippetId: "s_hero",
        html: "<section/>",
        scss: ".s_hero {}",
        isValid: true,
      });
      expect(chunks[0]).toContain("event: section");
      expect(chunks[0]).toContain("s_hero");
    });

    it("emits error events", () => {
      const chunks: string[] = [];
      const emitter = createSSEEmitter((c) => chunks.push(c));
      emitter.error("Generation failed", "GEN_ERROR", true);
      expect(chunks[0]).toContain("event: error");
      expect(chunks[0]).toContain("GEN_ERROR");
    });

    it("emits done event with token count and closes", () => {
      const chunks: string[] = [];
      const emitter = createSSEEmitter((c) => chunks.push(c));
      emitter.token("a", "chat");
      emitter.token("b", "chat");
      emitter.done(3, 1500, true);
      expect(emitter.isClosed()).toBe(true);
      const parsed = parseSSE(chunks[2]);
      expect((parsed!.data as DoneData).totalTokens).toBe(2);
      expect((parsed!.data as DoneData).success).toBe(true);
    });

    it("stops emitting after close", () => {
      const chunks: string[] = [];
      const emitter = createSSEEmitter((c) => chunks.push(c));
      emitter.done(0, 0, true);
      emitter.progress("test", "", 0, "should not emit");
      expect(chunks).toHaveLength(1);
    });

    it("emits heartbeat events", () => {
      const chunks: string[] = [];
      const emitter = createSSEEmitter((c) => chunks.push(c));
      emitter.heartbeat();
      expect(chunks[0]).toContain("event: heartbeat");
    });
  });

  describe("createSSEConsumer", () => {
    it("dispatches progress events to handler", () => {
      const onProgress = vi.fn();
      const consumer = createSSEConsumer({ onProgress });
      const event = createSSEEvent<ProgressData>("progress", { phase: "gen", step: "generating", percentage: 75, message: "Almost" });
      consumer.dispatch(event);
      expect(onProgress).toHaveBeenCalledWith({ phase: "gen", step: "generating", percentage: 75, message: "Almost" });
    });

    it("dispatches token events to handler", () => {
      const onToken = vi.fn();
      const consumer = createSSEConsumer({ onToken });
      const event = createSSEEvent<TokenData>("token", { token: "hi", target: "chat", tokenIndex: 1 });
      consumer.dispatch(event);
      expect(onToken).toHaveBeenCalledWith({ token: "hi", target: "chat", tokenIndex: 1 });
    });

    it("dispatches section events to handler", () => {
      const onSection = vi.fn();
      const consumer = createSSEConsumer({ onSection });
      const data: SectionCompleteData = { sectionType: "hero", snippetId: "s_hero", html: "", scss: "", isValid: true };
      consumer.dispatch(createSSEEvent("section", data));
      expect(onSection).toHaveBeenCalledWith(data);
    });

    it("dispatches done events to handler", () => {
      const onDone = vi.fn();
      const consumer = createSSEConsumer({ onDone });
      consumer.dispatch(createSSEEvent<DoneData>("done", { totalSections: 3, totalTokens: 100, durationMs: 2000, success: true }));
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it("processes raw SSE strings end-to-end", () => {
      const onProgress = vi.fn();
      const consumer = createSSEConsumer({ onProgress });
      const event = createSSEEvent<ProgressData>("progress", { phase: "init", step: "", percentage: 0, message: "Starting" });
      consumer.processEvent(formatSSE(event));
      expect(onProgress).toHaveBeenCalledWith({ phase: "init", step: "", percentage: 0, message: "Starting" });
    });

    it("ignores events without handlers", () => {
      const consumer = createSSEConsumer({});
      // Should not throw
      consumer.dispatch(createSSEEvent("heartbeat", {}));
      consumer.dispatch(createSSEEvent("token", { token: "x" }));
    });
  });
});
