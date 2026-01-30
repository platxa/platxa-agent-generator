/**
 * Tests for Preview Error Boundary
 *
 * Feature #94: Implement error boundary for preview failures with fallback UI
 * Verification: Preview errors show friendly message with retry button
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  PreviewErrorBoundary,
  createPreviewErrorBoundary,
  PREVIEW_ERROR_SCRIPT,
  ERROR_MESSAGES,
  SUGGESTED_ACTIONS,
  categorizeError,
  determineSeverity,
  isRecoverable,
  createPreviewError,
  getFallbackUIConfig,
  formatErrorMessage,
  formatErrorForLog,
  type PreviewError,
  type ErrorCategory,
} from "../../lib/preview/preview-error-boundary";

describe("PreviewErrorBoundary", () => {
  let boundary: PreviewErrorBoundary;

  beforeEach(() => {
    boundary = new PreviewErrorBoundary();
  });

  afterEach(() => {
    boundary.dispose();
  });

  describe("constructor", () => {
    it("should create instance with default options", () => {
      const state = boundary.getState();

      expect(state.hasError).toBe(false);
      expect(state.error).toBeNull();
      expect(state.errorHistory).toEqual([]);
      expect(state.retryCount).toBe(0);
      expect(state.maxRetries).toBe(3);
      expect(state.recovering).toBe(false);
    });

    it("should accept custom options", () => {
      const custom = new PreviewErrorBoundary({
        maxRetries: 5,
        maxHistory: 20,
      });
      const state = custom.getState();

      expect(state.maxRetries).toBe(5);
      custom.dispose();
    });
  });

  describe("captureError", () => {
    it("should capture Error instance", () => {
      const error = new Error("Test error");
      const captured = boundary.captureError(error);

      expect(captured).not.toBeNull();
      expect(captured?.message).toBe("Test error");
      expect(boundary.hasError()).toBe(true);
    });

    it("should capture string error", () => {
      const captured = boundary.captureError("String error");

      expect(captured?.message).toBe("String error");
    });

    it("should capture unknown error", () => {
      const captured = boundary.captureError({ custom: "error" });

      expect(captured?.message).toBe("[object Object]");
    });

    it("should set correct error properties", () => {
      const error = new Error("Test error");
      const captured = boundary.captureError(error);

      expect(captured?.id).toMatch(/^err_/);
      expect(captured?.timestamp).toBeLessThanOrEqual(Date.now());
      expect(captured?.category).toBeDefined();
      expect(captured?.severity).toBeDefined();
      expect(captured?.recoverable).toBeDefined();
    });

    it("should add to error history", () => {
      boundary.captureError("Error 1");
      boundary.captureError("Error 2");

      const history = boundary.getErrorHistory();
      expect(history).toHaveLength(2);
      expect(history[0].message).toBe("Error 2"); // Most recent first
      expect(history[1].message).toBe("Error 1");
    });

    it("should limit history size", () => {
      const custom = new PreviewErrorBoundary({ maxHistory: 3 });

      for (let i = 0; i < 5; i++) {
        custom.captureError(`Error ${i}`);
      }

      expect(custom.getErrorHistory()).toHaveLength(3);
      custom.dispose();
    });

    it("should trigger onError callback", () => {
      const callback = vi.fn();
      boundary.onError(callback);

      boundary.captureError("Test error");

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0].message).toBe("Test error");
    });

    it("should apply error filter", () => {
      const custom = new PreviewErrorBoundary({
        errorFilter: (error) => !error.message.includes("ignore"),
      });

      const ignored = custom.captureError("Please ignore this");
      const captured = custom.captureError("This should be captured");

      expect(ignored).toBeNull();
      expect(captured).not.toBeNull();
      expect(custom.getErrorHistory()).toHaveLength(1);

      custom.dispose();
    });

    it("should accept overrides", () => {
      const captured = boundary.captureError("Test", {
        category: "network",
        severity: "warning",
        recoverable: true,
      });

      expect(captured?.category).toBe("network");
      expect(captured?.severity).toBe("warning");
      expect(captured?.recoverable).toBe(true);
    });
  });

  describe("retry", () => {
    it("should execute recovery function", async () => {
      boundary.captureError("Test error");

      const recoveryFn = vi.fn().mockResolvedValue(undefined);
      const success = await boundary.retry(recoveryFn);

      expect(recoveryFn).toHaveBeenCalled();
      expect(success).toBe(true);
      expect(boundary.hasError()).toBe(false);
    });

    it("should increment retry count", async () => {
      boundary.captureError(new Error("Test"), { recoverable: true });

      const failingFn = vi.fn().mockRejectedValue(new Error("Still failing"));
      await boundary.retry(failingFn);

      expect(boundary.getRetryCount()).toBe(1);
    });

    it("should stop after max retries", async () => {
      const custom = new PreviewErrorBoundary({ maxRetries: 2 });
      custom.captureError(new Error("Test"), { recoverable: true });

      const failingFn = vi.fn().mockRejectedValue(new Error("Failing"));

      await custom.retry(failingFn);
      await custom.retry(failingFn);
      const thirdAttempt = await custom.retry(failingFn);

      expect(thirdAttempt).toBe(false);
      expect(failingFn).toHaveBeenCalledTimes(2); // Not called on third attempt

      custom.dispose();
    });

    it("should trigger onRecovery callback", async () => {
      boundary.captureError("Test");

      const callback = vi.fn();
      boundary.onRecovery(callback);

      await boundary.retry(() => Promise.resolve());

      expect(callback).toHaveBeenCalledWith(true, undefined);
    });

    it("should return true if no error", async () => {
      const success = await boundary.retry(() => {});

      expect(success).toBe(true);
    });
  });

  describe("dismiss", () => {
    it("should clear error state", () => {
      boundary.captureError("Test error");
      expect(boundary.hasError()).toBe(true);

      boundary.dismiss();

      expect(boundary.hasError()).toBe(false);
      expect(boundary.getError()).toBeNull();
      expect(boundary.getRetryCount()).toBe(0);
    });

    it("should not affect error history", () => {
      boundary.captureError("Test error");
      boundary.dismiss();

      expect(boundary.getErrorHistory()).toHaveLength(1);
    });

    it("should trigger state change", () => {
      boundary.captureError("Test");

      const callback = vi.fn();
      boundary.onStateChange(callback);

      boundary.dismiss();

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].hasError).toBe(false);
    });
  });

  describe("clearHistory", () => {
    it("should clear error history", () => {
      boundary.captureError("Error 1");
      boundary.captureError("Error 2");
      expect(boundary.getErrorHistory()).toHaveLength(2);

      boundary.clearHistory();

      expect(boundary.getErrorHistory()).toHaveLength(0);
    });
  });

  describe("canRetry", () => {
    it("should return false when no error", () => {
      expect(boundary.canRetry()).toBe(false);
    });

    it("should return true for recoverable error", () => {
      boundary.captureError("Test", { recoverable: true });
      expect(boundary.canRetry()).toBe(true);
    });

    it("should return false for non-recoverable error", () => {
      boundary.captureError("Test", { recoverable: false });
      expect(boundary.canRetry()).toBe(false);
    });

    it("should return false when max retries reached", async () => {
      const custom = new PreviewErrorBoundary({ maxRetries: 1 });
      custom.captureError("Test", { recoverable: true });

      await custom.retry(() => Promise.reject(new Error("Fail")));

      expect(custom.canRetry()).toBe(false);

      custom.dispose();
    });
  });

  describe("getFallbackUI", () => {
    it("should return null when no error", () => {
      expect(boundary.getFallbackUI()).toBeNull();
    });

    it("should return fallback config for error", () => {
      boundary.captureError("Test error", { category: "network" });
      const ui = boundary.getFallbackUI();

      expect(ui).not.toBeNull();
      expect(ui?.title).toBe(ERROR_MESSAGES.network);
      expect(ui?.showRetry).toBe(true); // network is recoverable
      expect(ui?.showDismiss).toBe(true);
    });

    it("should not show retry for non-recoverable", () => {
      boundary.captureError("Test", { category: "syntax", recoverable: false });
      const ui = boundary.getFallbackUI();

      expect(ui?.showRetry).toBe(false);
    });
  });

  describe("callbacks", () => {
    it("should support multiple callbacks", () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      boundary.onError(cb1);
      boundary.onError(cb2);

      boundary.captureError("Test");

      expect(cb1).toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
    });

    it("should return unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = boundary.onError(callback);

      boundary.captureError("Error 1");
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      boundary.captureError("Error 2");
      expect(callback).toHaveBeenCalledTimes(1); // Not called again
    });

    it("should handle callback errors gracefully", () => {
      const errorCb = vi.fn(() => {
        throw new Error("Callback error");
      });
      const normalCb = vi.fn();

      boundary.onError(errorCb);
      boundary.onError(normalCb);

      expect(() => boundary.captureError("Test")).not.toThrow();
      expect(normalCb).toHaveBeenCalled();
    });
  });

  describe("dispose", () => {
    it("should prevent further error capture", () => {
      boundary.dispose();

      const captured = boundary.captureError("Test");
      expect(captured).toBeNull();
    });

    it("should be idempotent", () => {
      expect(() => {
        boundary.dispose();
        boundary.dispose();
      }).not.toThrow();
    });
  });
});

describe("createPreviewErrorBoundary", () => {
  it("should create instance with factory function", () => {
    const instance = createPreviewErrorBoundary({ maxRetries: 5 });

    expect(instance).toBeInstanceOf(PreviewErrorBoundary);
    expect(instance.getState().maxRetries).toBe(5);

    instance.dispose();
  });
});

describe("categorizeError", () => {
  it("should categorize network errors", () => {
    expect(categorizeError("Network request failed")).toBe("network");
    expect(categorizeError("Failed to fetch")).toBe("network");
    expect(categorizeError("CORS error")).toBe("network");
  });

  it("should categorize timeout errors", () => {
    expect(categorizeError("Request timeout")).toBe("timeout");
    expect(categorizeError("Operation timed out")).toBe("timeout");
  });

  it("should categorize syntax errors", () => {
    expect(categorizeError("Syntax error")).toBe("syntax");
    expect(categorizeError("Unexpected token")).toBe("syntax");
  });

  it("should categorize script errors", () => {
    expect(categorizeError("undefined is not a function")).toBe("script");
    expect(categorizeError("Cannot read property 'x' of undefined")).toBe("script");
  });

  it("should categorize resource errors", () => {
    expect(categorizeError("Resource not found")).toBe("resource");
    expect(categorizeError("404 error")).toBe("resource");
  });

  it("should categorize render errors", () => {
    expect(categorizeError("Failed to render component")).toBe("render");
    expect(categorizeError("Hydration mismatch")).toBe("render");
  });

  it("should return unknown for unrecognized", () => {
    expect(categorizeError("Something happened")).toBe("unknown");
  });

  it("should handle Error instances", () => {
    expect(categorizeError(new Error("Network failed"))).toBe("network");
    expect(categorizeError(new Error("Random error"))).toBe("runtime");
  });
});

describe("determineSeverity", () => {
  it("should return error for syntax", () => {
    expect(determineSeverity("syntax")).toBe("error");
  });

  it("should return warning for network", () => {
    expect(determineSeverity("network")).toBe("warning");
  });

  it("should return error for runtime", () => {
    expect(determineSeverity("runtime")).toBe("error");
  });
});

describe("isRecoverable", () => {
  it("should return true for network errors", () => {
    expect(isRecoverable("network")).toBe(true);
  });

  it("should return true for timeout errors", () => {
    expect(isRecoverable("timeout")).toBe(true);
  });

  it("should return false for syntax errors", () => {
    expect(isRecoverable("syntax")).toBe(false);
  });

  it("should return false for script errors", () => {
    expect(isRecoverable("script")).toBe(false);
  });
});

describe("createPreviewError", () => {
  it("should create error from Error instance", () => {
    const error = createPreviewError(new Error("Test"));

    expect(error.message).toBe("Test");
    expect(error.id).toMatch(/^err_/);
    expect(error.timestamp).toBeLessThanOrEqual(Date.now());
  });

  it("should create error from string", () => {
    const error = createPreviewError("String error");

    expect(error.message).toBe("String error");
  });

  it("should extract location from Error stack", () => {
    const error = new Error("Test");
    // Simulate stack with location
    error.stack = `Error: Test
    at someFunction (file.js:10:5)`;

    const preview = createPreviewError(error);

    expect(preview.source).toBe("file.js");
    expect(preview.line).toBe(10);
    expect(preview.column).toBe(5);
  });

  it("should include suggested action", () => {
    const error = createPreviewError("Network failed", { category: "network" });

    expect(error.suggestedAction).toBe(SUGGESTED_ACTIONS.network);
  });
});

describe("getFallbackUIConfig", () => {
  it("should generate UI config from error", () => {
    const error: PreviewError = {
      id: "test",
      message: "Test error",
      category: "render",
      severity: "error",
      timestamp: Date.now(),
      recoverable: false,
    };

    const config = getFallbackUIConfig(error);

    expect(config.title).toBe(ERROR_MESSAGES.render);
    expect(config.description).toBe("Test error");
    expect(config.showRetry).toBe(false);
    expect(config.showDismiss).toBe(true);
    expect(config.icon).toBe("error");
  });

  it("should show warning icon for warnings", () => {
    const error: PreviewError = {
      id: "test",
      message: "Warning",
      category: "network",
      severity: "warning",
      timestamp: Date.now(),
      recoverable: true,
    };

    const config = getFallbackUIConfig(error);

    expect(config.icon).toBe("warning");
    expect(config.showRetry).toBe(true);
  });
});

describe("formatErrorMessage", () => {
  it("should format basic error", () => {
    const error: PreviewError = {
      id: "test",
      message: "Test error",
      category: "unknown",
      severity: "error",
      timestamp: Date.now(),
      recoverable: false,
    };

    expect(formatErrorMessage(error)).toBe("Test error");
  });

  it("should include source location", () => {
    const error: PreviewError = {
      id: "test",
      message: "Test error",
      category: "unknown",
      severity: "error",
      timestamp: Date.now(),
      recoverable: false,
      source: "/path/to/file.js",
      line: 10,
      column: 5,
    };

    const formatted = formatErrorMessage(error);

    expect(formatted).toContain("file.js");
    expect(formatted).toContain(":10:5");
  });
});

describe("formatErrorForLog", () => {
  it("should format error for logging", () => {
    const error: PreviewError = {
      id: "test",
      message: "Test error",
      category: "network",
      severity: "warning",
      timestamp: Date.now(),
      recoverable: true,
    };

    const formatted = formatErrorForLog(error);

    expect(formatted).toContain("[WARNING]");
    expect(formatted).toContain("[network]");
    expect(formatted).toContain("Test error");
  });
});

describe("constants", () => {
  describe("ERROR_MESSAGES", () => {
    it("should have messages for all categories", () => {
      const categories: ErrorCategory[] = [
        "render",
        "script",
        "network",
        "timeout",
        "syntax",
        "runtime",
        "resource",
        "unknown",
      ];

      for (const cat of categories) {
        expect(ERROR_MESSAGES[cat]).toBeTruthy();
      }
    });
  });

  describe("SUGGESTED_ACTIONS", () => {
    it("should have actions for all categories", () => {
      const categories: ErrorCategory[] = [
        "render",
        "script",
        "network",
        "timeout",
        "syntax",
        "runtime",
        "resource",
        "unknown",
      ];

      for (const cat of categories) {
        expect(SUGGESTED_ACTIONS[cat]).toBeTruthy();
      }
    });
  });

  describe("PREVIEW_ERROR_SCRIPT", () => {
    it("should be a non-empty string", () => {
      expect(typeof PREVIEW_ERROR_SCRIPT).toBe("string");
      expect(PREVIEW_ERROR_SCRIPT.length).toBeGreaterThan(100);
    });

    it("should contain error event listener", () => {
      expect(PREVIEW_ERROR_SCRIPT).toContain("addEventListener");
      expect(PREVIEW_ERROR_SCRIPT).toContain("error");
    });

    it("should post messages to parent", () => {
      expect(PREVIEW_ERROR_SCRIPT).toContain("postMessage");
      expect(PREVIEW_ERROR_SCRIPT).toContain("PLATXA_PREVIEW_ERROR");
    });
  });
});
