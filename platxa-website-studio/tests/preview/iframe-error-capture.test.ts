import { describe, it, expect, beforeEach } from "vitest";
import {
  IframeErrorCapture,
  createErrorCapture,
  createMockError,
  createJsError,
  createResourceError,
  createUnhandledRejectionError,
  detectResourceType,
  shouldIgnoreError,
  formatCapturedError,
  groupErrorsByType,
  getErrorStats,
  generateCaptureScript,
  generateErrorId,
  resetErrorIdCounter,
  DEFAULT_CAPTURE_CONFIG,
  IFRAME_ERROR_MESSAGE_TYPE,
  RESOURCE_TYPE_PATTERNS,
  ERROR_SEVERITY,
  type IframeCapturedError,
  type ErrorCaptureConfig,
} from "@/lib/preview/iframe-error-capture";

describe("IframeErrorCapture", () => {
  beforeEach(() => {
    resetErrorIdCounter();
  });

  describe("captures window.onerror and resource load failures in iframe (Feature #129)", () => {
    it("createJsError captures JavaScript errors with source info", () => {
      // Feature #129: Captures window.onerror
      const error = createJsError(
        "Uncaught TypeError: Cannot read property 'x' of undefined",
        "https://example.com/app.js",
        42,
        15,
        new Error("test")
      );

      expect(error.type).toBe("javascript");
      expect(error.message).toContain("Cannot read property");
      expect(error.source).toBe("https://example.com/app.js");
      expect(error.line).toBe(42);
      expect(error.column).toBe(15);
      expect(error.stack).toBeDefined();
    });

    it("createResourceError captures failed resource loads", () => {
      // Feature #129: Captures resource load failures
      const error = createResourceError(
        "https://example.com/styles.css",
        "LINK"
      );

      expect(error.type).toBe("resource");
      expect(error.resourceType).toBe("stylesheet");
      expect(error.message).toContain("Failed to load stylesheet");
      expect(error.source).toBe("https://example.com/styles.css");
      expect(error.context?.tagName).toBe("LINK");
    });

    it("generateCaptureScript includes window.onerror handler", () => {
      // Feature #129: Captures window.onerror in iframe
      const script = generateCaptureScript({ captureJsErrors: true });

      expect(script).toContain("window.onerror");
      expect(script).toContain("postMessage");
      expect(script).toContain(IFRAME_ERROR_MESSAGE_TYPE);
    });

    it("generateCaptureScript includes resource error handler", () => {
      // Feature #129: Captures resource load failures in iframe
      const script = generateCaptureScript({ captureResourceErrors: true });

      expect(script).toContain("addEventListener('error'");
      expect(script).toContain("target.src || target.href");
    });

    it("IframeErrorCapture buffers errors correctly", () => {
      // Feature #129: Captures and buffers errors
      const capture = createErrorCapture({ maxBufferSize: 5 });

      for (let i = 0; i < 7; i++) {
        capture.addError(createMockError({ message: `Error ${i}` }));
      }

      const errors = capture.getErrors();
      expect(errors.length).toBe(5);
      expect(errors[0].message).toBe("Error 2"); // First two were removed
      expect(errors[4].message).toBe("Error 6");
    });
  });

  describe("createJsError", () => {
    it("creates error with all fields", () => {
      const jsError = new Error("Test error");
      jsError.stack = "Error: Test\n  at test.js:1:1";

      const error = createJsError("Test error", "test.js", 1, 1, jsError);

      expect(error.type).toBe("javascript");
      expect(error.message).toBe("Test error");
      expect(error.source).toBe("test.js");
      expect(error.line).toBe(1);
      expect(error.column).toBe(1);
      expect(error.stack).toContain("at test.js");
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it("handles missing optional fields", () => {
      const error = createJsError("Simple error");

      expect(error.message).toBe("Simple error");
      expect(error.source).toBeUndefined();
      expect(error.line).toBeUndefined();
    });

    it("provides default message for empty string", () => {
      const error = createJsError("");

      expect(error.message).toBe("Unknown JavaScript error");
    });
  });

  describe("createResourceError", () => {
    it("detects script resource type", () => {
      const error = createResourceError("https://cdn.example.com/lib.js");

      expect(error.resourceType).toBe("script");
      expect(error.message).toContain("Failed to load script");
    });

    it("detects stylesheet resource type", () => {
      const error = createResourceError("https://cdn.example.com/style.css");

      expect(error.resourceType).toBe("stylesheet");
    });

    it("detects image resource type", () => {
      const error = createResourceError("https://cdn.example.com/logo.png");

      expect(error.resourceType).toBe("image");
    });

    it("detects font resource type", () => {
      const error = createResourceError("https://cdn.example.com/font.woff2");

      expect(error.resourceType).toBe("font");
    });

    it("defaults to other for unknown types", () => {
      const error = createResourceError("https://cdn.example.com/data.xml");

      expect(error.resourceType).toBe("other");
    });
  });

  describe("createUnhandledRejectionError", () => {
    it("handles Error objects", () => {
      const reason = new Error("Promise failed");
      reason.stack = "Error: Promise failed\n  at async.js:10";

      const error = createUnhandledRejectionError(reason);

      expect(error.type).toBe("unhandled_rejection");
      expect(error.message).toBe("Promise failed");
      expect(error.stack).toContain("async.js");
    });

    it("handles string reasons", () => {
      const error = createUnhandledRejectionError("Network timeout");

      expect(error.message).toBe("Network timeout");
    });

    it("handles other types", () => {
      const error = createUnhandledRejectionError({ code: 500 });

      expect(error.message).toBe("Unhandled promise rejection");
    });
  });

  describe("detectResourceType", () => {
    it("detects JavaScript files", () => {
      expect(detectResourceType("app.js")).toBe("script");
      expect(detectResourceType("bundle.mjs")).toBe("script");
      expect(detectResourceType("lib.js?v=123")).toBe("script");
    });

    it("detects CSS files", () => {
      expect(detectResourceType("styles.css")).toBe("stylesheet");
      expect(detectResourceType("theme.scss")).toBe("stylesheet");
    });

    it("detects image files", () => {
      expect(detectResourceType("logo.png")).toBe("image");
      expect(detectResourceType("banner.jpg")).toBe("image");
      expect(detectResourceType("icon.svg")).toBe("image");
      expect(detectResourceType("photo.webp")).toBe("image");
    });

    it("detects font files", () => {
      expect(detectResourceType("roboto.woff2")).toBe("font");
      expect(detectResourceType("arial.ttf")).toBe("font");
      expect(detectResourceType("custom.otf")).toBe("font");
    });

    it("returns other for unknown types", () => {
      expect(detectResourceType("data.json")).toBe("other");
      expect(detectResourceType("config.xml")).toBe("other");
    });
  });

  describe("shouldIgnoreError", () => {
    it("returns false with empty patterns", () => {
      const error = createMockError({ message: "Any error" });

      expect(shouldIgnoreError(error, [])).toBe(false);
    });

    it("ignores errors matching message pattern", () => {
      const error = createMockError({ message: "ResizeObserver loop limit exceeded" });
      const patterns = [/ResizeObserver/i];

      expect(shouldIgnoreError(error, patterns)).toBe(true);
    });

    it("ignores errors matching source pattern", () => {
      const error = createMockError({ source: "chrome-extension://abc123" });
      const patterns = [/chrome-extension/i];

      expect(shouldIgnoreError(error, patterns)).toBe(true);
    });

    it("does not ignore non-matching errors", () => {
      const error = createMockError({ message: "Real error" });
      const patterns = [/ResizeObserver/i, /chrome-extension/i];

      expect(shouldIgnoreError(error, patterns)).toBe(false);
    });
  });

  describe("formatCapturedError", () => {
    it("formats error with all details", () => {
      const error = createMockError({
        type: "javascript",
        message: "TypeError: x is not a function",
        source: "app.js",
        line: 42,
        column: 10,
      });

      const formatted = formatCapturedError(error);

      expect(formatted).toContain("[JAVASCRIPT]");
      expect(formatted).toContain("TypeError: x is not a function");
      expect(formatted).toContain("app.js:42:10");
    });

    it("formats error without source", () => {
      const error = createMockError({
        type: "unhandled_rejection",
        message: "Promise rejected",
      });

      const formatted = formatCapturedError(error);

      expect(formatted).toContain("[UNHANDLED_REJECTION]");
      expect(formatted).not.toContain("at ");
    });
  });

  describe("groupErrorsByType", () => {
    it("groups errors correctly", () => {
      const errors = [
        createMockError({ type: "javascript" }),
        createMockError({ type: "resource" }),
        createMockError({ type: "javascript" }),
        createMockError({ type: "unhandled_rejection" }),
      ];

      const grouped = groupErrorsByType(errors);

      expect(grouped.javascript.length).toBe(2);
      expect(grouped.resource.length).toBe(1);
      expect(grouped.unhandled_rejection.length).toBe(1);
      expect(grouped.network.length).toBe(0);
    });
  });

  describe("getErrorStats", () => {
    it("calculates statistics correctly", () => {
      const errors = [
        createMockError({ type: "javascript" }),
        createMockError({ type: "javascript" }),
        createMockError({ type: "resource" }),
        createMockError({ type: "security" }),
      ];

      const stats = getErrorStats(errors);

      expect(stats.total).toBe(4);
      expect(stats.byType.javascript).toBe(2);
      expect(stats.byType.resource).toBe(1);
      expect(stats.byType.security).toBe(1);
      expect(stats.bySeverity.high).toBe(2); // javascript errors
      expect(stats.bySeverity.medium).toBe(1); // resource error
      expect(stats.bySeverity.critical).toBe(1); // security error
    });
  });

  describe("generateCaptureScript", () => {
    it("generates script with all handlers by default", () => {
      const script = generateCaptureScript();

      expect(script).toContain("window.onerror");
      expect(script).toContain("unhandledrejection");
      expect(script).toContain("addEventListener('error'");
    });

    it("can disable JS error capture", () => {
      const script = generateCaptureScript({ captureJsErrors: false });

      expect(script).not.toContain("window.onerror");
    });

    it("can disable resource error capture", () => {
      const script = generateCaptureScript({ captureResourceErrors: false });

      expect(script).not.toContain("target.src || target.href");
    });

    it("can disable unhandled rejection capture", () => {
      const script = generateCaptureScript({ captureUnhandledRejections: false });

      expect(script).not.toContain("unhandledrejection");
    });

    it("includes postMessage to parent", () => {
      const script = generateCaptureScript();

      expect(script).toContain("window.parent.postMessage");
      expect(script).toContain(IFRAME_ERROR_MESSAGE_TYPE);
    });

    it("exposes global API", () => {
      const script = generateCaptureScript();

      expect(script).toContain("window.__iframeErrorCapture");
      expect(script).toContain("getErrors");
      expect(script).toContain("clearErrors");
    });
  });

  describe("IframeErrorCapture class", () => {
    it("starts inactive", () => {
      const capture = createErrorCapture();

      expect(capture.getState().isActive).toBe(false);
    });

    it("tracks error count", () => {
      const capture = createErrorCapture();

      capture.addError(createMockError());
      capture.addError(createMockError());

      expect(capture.getState().errorCount).toBe(2);
    });

    it("tracks last error timestamp", () => {
      const capture = createErrorCapture();
      const now = new Date();

      capture.addError(createMockError({ timestamp: now }));

      expect(capture.getState().lastErrorAt).toEqual(now);
    });

    it("clears errors", () => {
      const capture = createErrorCapture();

      capture.addError(createMockError());
      capture.addError(createMockError());
      capture.clearErrors();

      expect(capture.getErrors().length).toBe(0);
    });

    it("filters ignored errors", () => {
      const capture = createErrorCapture({
        ignorePatterns: [/ResizeObserver/i],
      });

      capture.addError(createMockError({ message: "Real error" }));
      capture.addError(createMockError({ message: "ResizeObserver loop" }));

      // addError already filters, so only real error is added
      expect(capture.getFilteredErrors().length).toBe(1);
    });

    it("notifies listeners on error", () => {
      const capture = createErrorCapture();
      const received: IframeCapturedError[] = [];

      capture.addListener((error) => received.push(error));
      capture.addError(createMockError({ message: "Test" }));

      expect(received.length).toBe(1);
      expect(received[0].message).toBe("Test");
    });

    it("removes listeners correctly", () => {
      const capture = createErrorCapture();
      const received: IframeCapturedError[] = [];
      const listener = (error: IframeCapturedError) => received.push(error);

      const unsubscribe = capture.addListener(listener);
      capture.addError(createMockError());
      unsubscribe();
      capture.addError(createMockError());

      expect(received.length).toBe(1);
    });

    it("generates capture script", () => {
      const capture = createErrorCapture({ captureJsErrors: true });
      const script = capture.getCaptureScript();

      expect(script).toContain("window.onerror");
    });
  });

  describe("DEFAULT_CAPTURE_CONFIG", () => {
    it("has sensible defaults", () => {
      expect(DEFAULT_CAPTURE_CONFIG.captureJsErrors).toBe(true);
      expect(DEFAULT_CAPTURE_CONFIG.captureResourceErrors).toBe(true);
      expect(DEFAULT_CAPTURE_CONFIG.captureUnhandledRejections).toBe(true);
      expect(DEFAULT_CAPTURE_CONFIG.maxBufferSize).toBeGreaterThan(0);
    });
  });

  describe("ERROR_SEVERITY", () => {
    it("assigns correct severity levels", () => {
      expect(ERROR_SEVERITY.javascript).toBe("high");
      expect(ERROR_SEVERITY.resource).toBe("medium");
      expect(ERROR_SEVERITY.security).toBe("critical");
      expect(ERROR_SEVERITY.unhandled_rejection).toBe("high");
    });
  });

  describe("RESOURCE_TYPE_PATTERNS", () => {
    it("has patterns for all resource types", () => {
      expect(RESOURCE_TYPE_PATTERNS.script).toBeInstanceOf(RegExp);
      expect(RESOURCE_TYPE_PATTERNS.stylesheet).toBeInstanceOf(RegExp);
      expect(RESOURCE_TYPE_PATTERNS.image).toBeInstanceOf(RegExp);
      expect(RESOURCE_TYPE_PATTERNS.font).toBeInstanceOf(RegExp);
    });
  });

  describe("generateErrorId", () => {
    it("generates unique IDs", () => {
      const id1 = generateErrorId();
      const id2 = generateErrorId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^err-\d+-\d+$/);
    });
  });
});
