import { describe, it, expect, vi } from "vitest";
import {
  classifyError,
  formatForChat,
  createErrorPipeline,
} from "@/lib/agent-bridge/error-pipeline";
import type { RawAgentError, PipelineError } from "@/lib/agent-bridge/error-pipeline";

describe("Error Pipeline", () => {
  describe("classifyError", () => {
    it("classifies network errors", () => {
      const result = classifyError({ error: "ECONNREFUSED: connection refused" });
      expect(result.category).toBe("network");
      expect(result.code).toBe("ERR_NETWORK");
      expect(result.recoverable).toBe(true);
    });

    it("classifies timeout errors", () => {
      const result = classifyError({ error: "Operation timed out after 30s" });
      expect(result.category).toBe("timeout");
      expect(result.code).toBe("ERR_TIMEOUT");
      expect(result.recoverable).toBe(true);
    });

    it("classifies permission errors", () => {
      const result = classifyError({ error: "403 Forbidden" });
      expect(result.category).toBe("permission");
      expect(result.code).toBe("ERR_PERMISSION");
      expect(result.recoverable).toBe(false);
    });

    it("classifies rate limit errors", () => {
      const result = classifyError({ error: "429 Too many requests" });
      expect(result.category).toBe("resource");
      expect(result.code).toBe("ERR_RATE_LIMIT");
      expect(result.recoverable).toBe(true);
    });

    it("classifies validation errors", () => {
      const result = classifyError({ error: "Validation failed: missing required field" });
      expect(result.category).toBe("validation");
      expect(result.code).toBe("ERR_VALIDATION");
    });

    it("classifies generation errors", () => {
      const result = classifyError({ error: "LLM generation failed: token limit exceeded" });
      expect(result.category).toBe("generation");
      expect(result.code).toBe("ERR_GENERATION");
    });

    it("classifies not found errors", () => {
      const result = classifyError({ error: "ENOENT: no such file or directory" });
      expect(result.category).toBe("resource");
      expect(result.code).toBe("ERR_NOT_FOUND");
      expect(result.recoverable).toBe(false);
    });

    it("classifies configuration errors", () => {
      const result = classifyError({ error: "API_KEY not configured" });
      expect(result.category).toBe("configuration");
      expect(result.code).toBe("ERR_CONFIG");
    });

    it("falls back to internal for unknown errors", () => {
      const result = classifyError({ error: "something completely unexpected happened" });
      expect(result.category).toBe("internal");
      expect(result.code).toBe("ERR_INTERNAL");
      expect(result.recoverable).toBe(true);
    });

    it("accepts Error objects", () => {
      const result = classifyError({ error: new Error("fetch failed") });
      expect(result.category).toBe("network");
      expect(result.originalMessage).toBe("fetch failed");
    });

    it("preserves original message", () => {
      const msg = "ECONNREFUSED on port 8069";
      const result = classifyError({ error: msg });
      expect(result.originalMessage).toBe(msg);
    });

    it("includes timestamp", () => {
      const result = classifyError({ error: "test" });
      expect(result.timestamp).toBeTruthy();
      expect(() => new Date(result.timestamp)).not.toThrow();
    });

    it("includes suggestions for every error", () => {
      const result = classifyError({ error: "anything" });
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it("provides user-friendly message different from original", () => {
      const result = classifyError({ error: "ECONNREFUSED 127.0.0.1:8069" });
      expect(result.userMessage).not.toBe(result.originalMessage);
    });
  });

  describe("formatForChat", () => {
    it("includes user message", () => {
      const error = classifyError({ error: "timeout exceeded" });
      const chat = formatForChat(error);
      expect(chat).toContain(error.userMessage);
    });

    it("includes suggestion labels", () => {
      const error = classifyError({ error: "ECONNREFUSED" });
      const chat = formatForChat(error);
      expect(chat).toContain("Retry");
    });

    it("includes error code", () => {
      const error = classifyError({ error: "ECONNREFUSED" });
      const chat = formatForChat(error);
      expect(chat).toContain("ERR_NETWORK");
    });

    it("formats as markdown", () => {
      const error = classifyError({ error: "timeout" });
      const chat = formatForChat(error);
      expect(chat).toContain("**");
    });
  });

  describe("createErrorPipeline", () => {
    it("calls handler with processed error", () => {
      const handler = vi.fn();
      const pipeline = createErrorPipeline(handler);
      pipeline.handle({ error: "ECONNREFUSED" });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].category).toBe("network");
    });

    it("accumulates errors", () => {
      const pipeline = createErrorPipeline(() => {});
      pipeline.handle({ error: "timeout" });
      pipeline.handle({ error: "ECONNREFUSED" });
      expect(pipeline.getErrors()).toHaveLength(2);
    });

    it("filters by category", () => {
      const pipeline = createErrorPipeline(() => {});
      pipeline.handle({ error: "timeout" });
      pipeline.handle({ error: "ECONNREFUSED" });
      pipeline.handle({ error: "another timeout" });
      expect(pipeline.getByCategory("timeout")).toHaveLength(2);
      expect(pipeline.getByCategory("network")).toHaveLength(1);
    });

    it("counts by severity", () => {
      const pipeline = createErrorPipeline(() => {});
      pipeline.handle({ error: "timeout" });        // warning
      pipeline.handle({ error: "ECONNREFUSED" });    // error
      const counts = pipeline.countBySeverity();
      expect(counts.warning).toBe(1);
      expect(counts.error).toBe(1);
    });

    it("detects blocking errors", () => {
      const pipeline = createErrorPipeline(() => {});
      pipeline.handle({ error: "timeout" }); // recoverable
      expect(pipeline.hasBlockingErrors()).toBe(false);
      pipeline.handle({ error: "403 Forbidden" }); // not recoverable
      expect(pipeline.hasBlockingErrors()).toBe(true);
    });

    it("clears error history", () => {
      const pipeline = createErrorPipeline(() => {});
      pipeline.handle({ error: "timeout" });
      pipeline.clear();
      expect(pipeline.getErrors()).toHaveLength(0);
    });

    it("returns processed error from handle", () => {
      const pipeline = createErrorPipeline(() => {});
      const result = pipeline.handle({ error: "ECONNREFUSED" });
      expect(result.category).toBe("network");
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });
});
