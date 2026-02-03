/**
 * Tests for Fullscreen Preview
 *
 * Feature #123: Create full-screen preview mode
 * Verification: Button expands preview to fill window; ESC exits
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  FullscreenPreview,
  createFullscreenPreview,
  DEFAULT_BUTTON_CONFIG,
  DEFAULT_OVERLAY_CONFIG,
  FULLSCREEN_SHORTCUTS,
  CSS_CLASSES,
  DEFAULT_Z_INDEX,
  FULLSCREEN_SCRIPT,
  checkFullscreenSupport,
  isNativeFullscreen,
  createOverlayStyles,
  generateButtonHTML,
  type FullscreenState,
  type FullscreenTrigger,
  type ExitTrigger,
} from "../../lib/preview/fullscreen-preview";

// ============================================================================
// Type Exports
// ============================================================================

describe("Type exports", () => {
  it("should export FullscreenState type", () => {
    const state: FullscreenState = "normal";
    expect(state).toBe("normal");
  });

  it("should support all fullscreen states", () => {
    const states: FullscreenState[] = ["normal", "entering", "fullscreen", "exiting"];
    expect(states.length).toBe(4);
  });

  it("should export FullscreenTrigger type", () => {
    const trigger: FullscreenTrigger = "button";
    expect(trigger).toBe("button");
  });

  it("should export ExitTrigger type", () => {
    const trigger: ExitTrigger = "esc";
    expect(trigger).toBe("esc");
  });
});

// ============================================================================
// Constants
// ============================================================================

describe("Constants", () => {
  describe("DEFAULT_BUTTON_CONFIG", () => {
    it("should have enter and exit labels", () => {
      expect(DEFAULT_BUTTON_CONFIG.enterLabel).toBe("Fullscreen");
      expect(DEFAULT_BUTTON_CONFIG.exitLabel).toBe("Exit Fullscreen");
    });

    it("should have tooltips", () => {
      expect(DEFAULT_BUTTON_CONFIG.enterTooltip).toContain("Enter fullscreen");
      expect(DEFAULT_BUTTON_CONFIG.exitTooltip).toContain("Exit fullscreen");
    });

    it("should have icons", () => {
      expect(DEFAULT_BUTTON_CONFIG.enterIcon).toBe("maximize");
      expect(DEFAULT_BUTTON_CONFIG.exitIcon).toBe("minimize");
    });

    it("should have keyboard shortcuts", () => {
      expect(DEFAULT_BUTTON_CONFIG.enterShortcut).toBe("F11");
      expect(DEFAULT_BUTTON_CONFIG.exitShortcut).toBe("Escape");
    });
  });

  describe("DEFAULT_OVERLAY_CONFIG", () => {
    it("should show close button by default", () => {
      expect(DEFAULT_OVERLAY_CONFIG.showCloseButton).toBe(true);
    });

    it("should position close button top-right", () => {
      expect(DEFAULT_OVERLAY_CONFIG.closeButtonPosition).toBe("top-right");
    });

    it("should show escape hint", () => {
      expect(DEFAULT_OVERLAY_CONFIG.showEscapeHint).toBe(true);
      expect(DEFAULT_OVERLAY_CONFIG.escapeHintDuration).toBe(3000);
    });

    it("should have animation duration", () => {
      expect(DEFAULT_OVERLAY_CONFIG.animationDuration).toBe(200);
    });

    it("should have background color", () => {
      expect(DEFAULT_OVERLAY_CONFIG.backgroundColor).toBe("#000000");
    });
  });

  describe("FULLSCREEN_SHORTCUTS", () => {
    it("should have enter shortcuts", () => {
      expect(FULLSCREEN_SHORTCUTS.enter).toContain("F11");
      expect(FULLSCREEN_SHORTCUTS.enter).toContain("Ctrl+Shift+F");
    });

    it("should have exit shortcuts", () => {
      expect(FULLSCREEN_SHORTCUTS.exit).toContain("Escape");
      expect(FULLSCREEN_SHORTCUTS.exit).toContain("F11");
    });
  });

  describe("CSS_CLASSES", () => {
    it("should have all required classes", () => {
      expect(CSS_CLASSES.container).toBe("fullscreen-preview-container");
      expect(CSS_CLASSES.overlay).toBe("fullscreen-preview-overlay");
      expect(CSS_CLASSES.content).toBe("fullscreen-preview-content");
      expect(CSS_CLASSES.closeButton).toBe("fullscreen-preview-close");
      expect(CSS_CLASSES.escapeHint).toBe("fullscreen-preview-escape-hint");
      expect(CSS_CLASSES.active).toBe("fullscreen-preview-active");
    });
  });

  describe("DEFAULT_Z_INDEX", () => {
    it("should be a high value", () => {
      expect(DEFAULT_Z_INDEX).toBe(9999);
    });
  });

  describe("FULLSCREEN_SCRIPT", () => {
    it("should contain initialization code", () => {
      expect(FULLSCREEN_SCRIPT).toContain("__PLATXA_FULLSCREEN__");
    });

    it("should have enter/exit methods", () => {
      expect(FULLSCREEN_SCRIPT).toContain("enter:");
      expect(FULLSCREEN_SCRIPT).toContain("exit:");
      expect(FULLSCREEN_SCRIPT).toContain("toggle:");
    });

    it("should handle ESC key", () => {
      expect(FULLSCREEN_SCRIPT).toContain("Escape");
    });
  });
});

// ============================================================================
// Utility Functions
// ============================================================================

describe("Utility Functions", () => {
  describe("checkFullscreenSupport", () => {
    it("should return a valid support level", () => {
      const support = checkFullscreenSupport();
      expect(["full", "prefixed", "none"]).toContain(support);
    });
  });

  describe("isNativeFullscreen", () => {
    it("should return false when not in fullscreen", () => {
      expect(isNativeFullscreen()).toBe(false);
    });
  });

  describe("createOverlayStyles", () => {
    it("should generate CSS with correct z-index", () => {
      const css = createOverlayStyles(DEFAULT_OVERLAY_CONFIG, 9999);
      expect(css).toContain("z-index: 9999");
    });

    it("should include background color", () => {
      const css = createOverlayStyles(DEFAULT_OVERLAY_CONFIG, 9999);
      expect(css).toContain("background-color: #000000");
    });

    it("should include animation duration", () => {
      const css = createOverlayStyles(DEFAULT_OVERLAY_CONFIG, 9999);
      expect(css).toContain("200ms");
    });

    it("should handle different close button positions", () => {
      const topRight = createOverlayStyles(
        { ...DEFAULT_OVERLAY_CONFIG, closeButtonPosition: "top-right" },
        9999
      );
      expect(topRight).toContain("top: 16px");
      expect(topRight).toContain("right: 16px");

      const bottomLeft = createOverlayStyles(
        { ...DEFAULT_OVERLAY_CONFIG, closeButtonPosition: "bottom-left" },
        9999
      );
      expect(bottomLeft).toContain("bottom: 16px");
      expect(bottomLeft).toContain("left: 16px");
    });
  });

  describe("generateButtonHTML", () => {
    it("should generate enter button when not fullscreen", () => {
      const html = generateButtonHTML(DEFAULT_BUTTON_CONFIG, false);
      expect(html).toContain(DEFAULT_BUTTON_CONFIG.enterLabel);
      expect(html).toContain('data-fullscreen="false"');
      expect(html).toContain('aria-pressed="false"');
    });

    it("should generate exit button when fullscreen", () => {
      const html = generateButtonHTML(DEFAULT_BUTTON_CONFIG, true);
      expect(html).toContain(DEFAULT_BUTTON_CONFIG.exitLabel);
      expect(html).toContain('data-fullscreen="true"');
      expect(html).toContain('aria-pressed="true"');
    });

    it("should include tooltip", () => {
      const html = generateButtonHTML(DEFAULT_BUTTON_CONFIG, false);
      expect(html).toContain(`title="${DEFAULT_BUTTON_CONFIG.enterTooltip}"`);
    });

    it("should use custom class name", () => {
      const html = generateButtonHTML(DEFAULT_BUTTON_CONFIG, false, "my-btn");
      expect(html).toContain('class="my-btn"');
    });
  });
});

// ============================================================================
// FullscreenPreview Class
// ============================================================================

describe("FullscreenPreview", () => {
  let preview: FullscreenPreview;
  let mockElement: HTMLDivElement;

  beforeEach(() => {
    // Create mock preview element
    mockElement = document.createElement("div");
    mockElement.id = "preview";
    document.body.appendChild(mockElement);

    preview = new FullscreenPreview({ targetSelector: "#preview" });
  });

  afterEach(() => {
    preview.dispose();
    mockElement.remove();
    // Clean up any overlay styles
    document.getElementById("fullscreen-preview-styles")?.remove();
  });

  describe("constructor", () => {
    it("should create with default options", () => {
      expect(preview.getState()).toBe("normal");
      expect(preview.isFullscreen()).toBe(false);
    });

    it("should accept custom target selector", () => {
      const custom = new FullscreenPreview({ targetSelector: "#custom" });
      expect(custom.getState()).toBe("normal");
      custom.dispose();
    });

    it("should accept custom overlay config", () => {
      const custom = new FullscreenPreview({
        overlay: { backgroundColor: "#ffffff" },
      });
      expect(custom.getState()).toBe("normal");
      custom.dispose();
    });

    it("should accept custom button config", () => {
      const custom = new FullscreenPreview({
        button: { enterLabel: "Go Full" },
      });
      expect(custom.getButtonConfig().label).toBe("Go Full");
      custom.dispose();
    });
  });

  describe("getState", () => {
    it("should return current state", () => {
      expect(preview.getState()).toBe("normal");
    });
  });

  describe("isFullscreen", () => {
    it("should return false when normal", () => {
      expect(preview.isFullscreen()).toBe(false);
    });
  });

  describe("enter", () => {
    it("should enter fullscreen mode", async () => {
      const result = await preview.enter();
      expect(result).toBe(true);
      expect(preview.getState()).toBe("fullscreen");
      expect(preview.isFullscreen()).toBe(true);
    });

    it("should create overlay", async () => {
      await preview.enter();
      const overlay = document.querySelector(`.${CSS_CLASSES.overlay}`);
      expect(overlay).not.toBeNull();
    });

    it("should trigger enter callback", async () => {
      const callback = vi.fn();
      preview.onEnter(callback);
      await preview.enter("button");
      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].trigger).toBe("button");
    });

    it("should trigger state change callback", async () => {
      const callback = vi.fn();
      preview.onStateChange(callback);
      await preview.enter();
      expect(callback).toHaveBeenCalled();
    });

    it("should return false if already fullscreen", async () => {
      await preview.enter();
      const result = await preview.enter();
      expect(result).toBe(false);
    });

    it("should notify error if target not found", async () => {
      const p = new FullscreenPreview({ targetSelector: "#nonexistent" });
      const errorCallback = vi.fn();
      p.onError(errorCallback);
      await p.enter();
      expect(errorCallback).toHaveBeenCalled();
      p.dispose();
    });

    it("should throw if disposed", async () => {
      preview.dispose();
      await expect(preview.enter()).rejects.toThrow("disposed");
    });
  });

  describe("exit", () => {
    it("should exit fullscreen mode", async () => {
      await preview.enter();
      const result = await preview.exit();
      expect(result).toBe(true);
      expect(preview.getState()).toBe("normal");
      expect(preview.isFullscreen()).toBe(false);
    });

    it("should trigger exit callback", async () => {
      const callback = vi.fn();
      preview.onExit(callback);
      await preview.enter();
      await preview.exit("esc");
      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].trigger).toBe("esc");
    });

    it("should include duration in exit event", async () => {
      const callback = vi.fn();
      preview.onExit(callback);
      await preview.enter();
      await new Promise((r) => setTimeout(r, 10));
      await preview.exit();
      expect(callback.mock.calls[0][0].duration).toBeGreaterThanOrEqual(0);
    });

    it("should return false if not fullscreen", async () => {
      const result = await preview.exit();
      expect(result).toBe(false);
    });

    it("should throw if disposed", async () => {
      await preview.enter();
      preview.dispose();
      await expect(preview.exit()).rejects.toThrow("disposed");
    });
  });

  describe("toggle", () => {
    it("should enter when normal", async () => {
      const result = await preview.toggle();
      expect(result).toBe(true);
      expect(preview.isFullscreen()).toBe(true);
    });

    it("should exit when fullscreen", async () => {
      await preview.enter();
      const result = await preview.toggle();
      expect(result).toBe(true);
      expect(preview.isFullscreen()).toBe(false);
    });

    it("should pass trigger correctly", async () => {
      const enterCallback = vi.fn();
      preview.onEnter(enterCallback);
      await preview.toggle("button");
      expect(enterCallback.mock.calls[0][0].trigger).toBe("button");
    });
  });

  describe("getButtonConfig", () => {
    it("should return enter config when normal", () => {
      const config = preview.getButtonConfig();
      expect(config.label).toBe(DEFAULT_BUTTON_CONFIG.enterLabel);
      expect(config.icon).toBe(DEFAULT_BUTTON_CONFIG.enterIcon);
    });

    it("should return exit config when fullscreen", async () => {
      await preview.enter();
      const config = preview.getButtonConfig();
      expect(config.label).toBe(DEFAULT_BUTTON_CONFIG.exitLabel);
      expect(config.icon).toBe(DEFAULT_BUTTON_CONFIG.exitIcon);
    });
  });

  describe("getButtonHTML", () => {
    it("should return button HTML", () => {
      const html = preview.getButtonHTML();
      expect(html).toContain("button");
      expect(html).toContain(DEFAULT_BUTTON_CONFIG.enterLabel);
    });

    it("should accept custom class", () => {
      const html = preview.getButtonHTML("custom-btn");
      expect(html).toContain('class="custom-btn"');
    });
  });

  describe("onEnter", () => {
    it("should subscribe to enter events", async () => {
      const callback = vi.fn();
      preview.onEnter(callback);
      await preview.enter();
      expect(callback).toHaveBeenCalled();
    });

    it("should return unsubscribe function", async () => {
      const callback = vi.fn();
      const unsubscribe = preview.onEnter(callback);
      unsubscribe();
      await preview.enter();
      expect(callback).not.toHaveBeenCalled();
    });

    it("should throw if disposed", () => {
      preview.dispose();
      expect(() => preview.onEnter(() => {})).toThrow("disposed");
    });

    it("should catch callback errors", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      preview.onEnter(() => {
        throw new Error("Callback error");
      });
      await preview.enter();
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe("onExit", () => {
    it("should subscribe to exit events", async () => {
      const callback = vi.fn();
      preview.onExit(callback);
      await preview.enter();
      await preview.exit();
      expect(callback).toHaveBeenCalled();
    });

    it("should return unsubscribe function", async () => {
      const callback = vi.fn();
      const unsubscribe = preview.onExit(callback);
      unsubscribe();
      await preview.enter();
      await preview.exit();
      expect(callback).not.toHaveBeenCalled();
    });

    it("should throw if disposed", () => {
      preview.dispose();
      expect(() => preview.onExit(() => {})).toThrow("disposed");
    });
  });

  describe("onStateChange", () => {
    it("should subscribe to state changes", async () => {
      const callback = vi.fn();
      preview.onStateChange(callback);
      await preview.enter();
      expect(callback).toHaveBeenCalled();
    });

    it("should provide previous and new state", async () => {
      const callback = vi.fn();
      preview.onStateChange(callback);
      await preview.enter();

      // Find the call where it transitions to fullscreen
      const fullscreenCall = callback.mock.calls.find(
        (call) => call[0].newState === "fullscreen"
      );
      expect(fullscreenCall).toBeDefined();
      expect(fullscreenCall![0].previousState).toBe("entering");
    });

    it("should return unsubscribe function", async () => {
      const callback = vi.fn();
      const unsubscribe = preview.onStateChange(callback);
      unsubscribe();
      await preview.enter();
      expect(callback).not.toHaveBeenCalled();
    });

    it("should throw if disposed", () => {
      preview.dispose();
      expect(() => preview.onStateChange(() => {})).toThrow("disposed");
    });
  });

  describe("onError", () => {
    it("should subscribe to errors", async () => {
      const p = new FullscreenPreview({ targetSelector: "#nonexistent" });
      const callback = vi.fn();
      p.onError(callback);
      await p.enter();
      expect(callback).toHaveBeenCalled();
      p.dispose();
    });

    it("should return unsubscribe function", async () => {
      const p = new FullscreenPreview({ targetSelector: "#nonexistent" });
      const callback = vi.fn();
      const unsubscribe = p.onError(callback);
      unsubscribe();
      await p.enter();
      expect(callback).not.toHaveBeenCalled();
      p.dispose();
    });

    it("should throw if disposed", () => {
      preview.dispose();
      expect(() => preview.onError(() => {})).toThrow("disposed");
    });
  });

  describe("isDisposed", () => {
    it("should return false when not disposed", () => {
      expect(preview.isDisposed()).toBe(false);
    });

    it("should return true when disposed", () => {
      preview.dispose();
      expect(preview.isDisposed()).toBe(true);
    });
  });

  describe("dispose", () => {
    it("should clean up resources", () => {
      preview.onEnter(() => {});
      preview.onExit(() => {});
      preview.onStateChange(() => {});
      preview.dispose();
      expect(preview.isDisposed()).toBe(true);
    });

    it("should exit fullscreen if active", async () => {
      await preview.enter();
      preview.dispose();
      // Should not throw and overlay should be cleaned up
      expect(preview.isDisposed()).toBe(true);
    });

    it("should be idempotent", () => {
      preview.dispose();
      expect(() => preview.dispose()).not.toThrow();
    });
  });
});

// ============================================================================
// Factory Function
// ============================================================================

describe("createFullscreenPreview", () => {
  it("should create FullscreenPreview instance", () => {
    const p = createFullscreenPreview();
    expect(p).toBeInstanceOf(FullscreenPreview);
    p.dispose();
  });

  it("should pass options to constructor", () => {
    const p = createFullscreenPreview({
      button: { enterLabel: "Custom" },
    });
    expect(p.getButtonConfig().label).toBe("Custom");
    p.dispose();
  });
});

// ============================================================================
// Keyboard Handling
// ============================================================================

describe("Keyboard handling", () => {
  let preview: FullscreenPreview;
  let mockElement: HTMLDivElement;

  beforeEach(() => {
    mockElement = document.createElement("div");
    mockElement.id = "preview";
    document.body.appendChild(mockElement);

    preview = new FullscreenPreview({
      targetSelector: "#preview",
      enableEscKey: true,
      enableKeyboardShortcuts: true,
    });
  });

  afterEach(() => {
    preview.dispose();
    mockElement.remove();
  });

  it("should exit on ESC key when fullscreen", async () => {
    await preview.enter();
    expect(preview.isFullscreen()).toBe(true);

    const event = new KeyboardEvent("keydown", { key: "Escape" });
    document.dispatchEvent(event);

    // Wait for state change
    await new Promise((r) => setTimeout(r, 50));
    expect(preview.isFullscreen()).toBe(false);
  });

  it("should not exit on ESC when not fullscreen", async () => {
    const callback = vi.fn();
    preview.onExit(callback);

    const event = new KeyboardEvent("keydown", { key: "Escape" });
    document.dispatchEvent(event);

    expect(callback).not.toHaveBeenCalled();
  });

  it("should enter on F11 when not fullscreen", async () => {
    const event = new KeyboardEvent("keydown", { key: "F11" });
    document.dispatchEvent(event);

    // Wait for state change
    await new Promise((r) => setTimeout(r, 50));
    expect(preview.isFullscreen()).toBe(true);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Edge cases", () => {
  it("should handle rapid enter/exit", async () => {
    const mockElement = document.createElement("div");
    mockElement.id = "preview";
    document.body.appendChild(mockElement);

    const p = createFullscreenPreview({ targetSelector: "#preview" });

    await p.enter();
    await p.exit();
    await p.enter();
    await p.exit();

    expect(p.isFullscreen()).toBe(false);
    expect(p.getState()).toBe("normal");

    p.dispose();
    mockElement.remove();
  });

  it("should handle missing target gracefully", async () => {
    const p = createFullscreenPreview({ targetSelector: "#nonexistent" });
    const errorCallback = vi.fn();
    p.onError(errorCallback);

    const result = await p.enter();
    expect(result).toBe(false);
    expect(errorCallback).toHaveBeenCalled();

    p.dispose();
  });

  it("should track duration correctly", async () => {
    const mockElement = document.createElement("div");
    mockElement.id = "preview";
    document.body.appendChild(mockElement);

    const p = createFullscreenPreview({ targetSelector: "#preview" });
    const exitCallback = vi.fn();
    p.onExit(exitCallback);

    await p.enter();
    await new Promise((r) => setTimeout(r, 100));
    await p.exit();

    expect(exitCallback.mock.calls[0][0].duration).toBeGreaterThanOrEqual(90);

    p.dispose();
    mockElement.remove();
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Integration", () => {
  it("should complete full enter/exit cycle with callbacks", async () => {
    const mockElement = document.createElement("div");
    mockElement.id = "preview";
    document.body.appendChild(mockElement);

    const p = createFullscreenPreview({ targetSelector: "#preview" });

    const enterCallback = vi.fn();
    const exitCallback = vi.fn();
    const stateCallback = vi.fn();

    p.onEnter(enterCallback);
    p.onExit(exitCallback);
    p.onStateChange(stateCallback);

    // Enter
    await p.enter("button");
    expect(enterCallback).toHaveBeenCalledTimes(1);
    expect(p.isFullscreen()).toBe(true);

    // Exit
    await p.exit("esc");
    expect(exitCallback).toHaveBeenCalledTimes(1);
    expect(p.isFullscreen()).toBe(false);

    // State changes: entering -> fullscreen -> exiting -> normal
    expect(stateCallback.mock.calls.length).toBeGreaterThanOrEqual(2);

    p.dispose();
    mockElement.remove();
  });

  it("should update button config based on state", async () => {
    const mockElement = document.createElement("div");
    mockElement.id = "preview";
    document.body.appendChild(mockElement);

    const p = createFullscreenPreview({ targetSelector: "#preview" });

    // Before fullscreen
    expect(p.getButtonConfig().label).toBe("Fullscreen");
    expect(p.getButtonConfig().icon).toBe("maximize");

    await p.enter();

    // In fullscreen
    expect(p.getButtonConfig().label).toBe("Exit Fullscreen");
    expect(p.getButtonConfig().icon).toBe("minimize");

    await p.exit();

    // After fullscreen
    expect(p.getButtonConfig().label).toBe("Fullscreen");

    p.dispose();
    mockElement.remove();
  });
});
