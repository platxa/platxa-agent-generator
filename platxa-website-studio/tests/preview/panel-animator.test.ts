/**
 * Tests for Panel Animator
 *
 * Feature #121: Implement panel collapse/expand animations
 * Verification: Panels animate smoothly when collapsed/expanded
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  PanelAnimator,
  createPanelAnimator,
  DEFAULT_CONFIG,
  EASING_CSS,
  EASING_PRESETS,
  ANIMATION_STYLES,
  getEasingValue,
  applyEasing,
  generateTransitionCSS,
  generateFrameStyles,
  prefersReducedMotion,
  lerp,
  clamp,
  generatePanelId,
  createSmoothConfig,
  createSnappyConfig,
  createBounceConfig,
  type AnimationConfig,
  type AnimationFrame,
  type PanelDimensions,
} from "../../lib/preview/panel-animator";

// ============================================================================
// Type Exports
// ============================================================================

describe("Type exports", () => {
  it("should export AnimationDirection type", () => {
    const direction: import("../../lib/preview/panel-animator").AnimationDirection = "expand";
    expect(direction).toBe("expand");
  });

  it("should export AnimationStyle type", () => {
    const style: import("../../lib/preview/panel-animator").AnimationStyle = "slide";
    expect(style).toBe("slide");
  });

  it("should export EasingFunction type", () => {
    const easing: import("../../lib/preview/panel-animator").EasingFunction = "ease-out";
    expect(easing).toBe("ease-out");
  });

  it("should export PanelOrientation type", () => {
    const orientation: import("../../lib/preview/panel-animator").PanelOrientation = "horizontal";
    expect(orientation).toBe("horizontal");
  });

  it("should export AnimationState type", () => {
    const state: import("../../lib/preview/panel-animator").AnimationState = "idle";
    expect(state).toBe("idle");
  });
});

// ============================================================================
// Constants
// ============================================================================

describe("Constants", () => {
  describe("DEFAULT_CONFIG", () => {
    it("should have expected default values", () => {
      expect(DEFAULT_CONFIG.duration).toBe(300);
      expect(DEFAULT_CONFIG.easing).toBe("ease-out");
      expect(DEFAULT_CONFIG.style).toBe("slide");
      expect(DEFAULT_CONFIG.orientation).toBe("horizontal");
      expect(DEFAULT_CONFIG.delay).toBe(0);
    });
  });

  describe("EASING_CSS", () => {
    it("should map easing functions to CSS values", () => {
      expect(EASING_CSS["linear"]).toBe("linear");
      expect(EASING_CSS["ease"]).toBe("ease");
      expect(EASING_CSS["ease-in"]).toBe("ease-in");
      expect(EASING_CSS["ease-out"]).toBe("ease-out");
      expect(EASING_CSS["ease-in-out"]).toBe("ease-in-out");
      expect(EASING_CSS["cubic-bezier"]).toBe("cubic-bezier(0.4, 0, 0.2, 1)");
    });
  });

  describe("EASING_PRESETS", () => {
    it("should have Material Design presets", () => {
      expect(EASING_PRESETS.standard).toBe("cubic-bezier(0.4, 0, 0.2, 1)");
      expect(EASING_PRESETS.decelerate).toBe("cubic-bezier(0, 0, 0.2, 1)");
      expect(EASING_PRESETS.accelerate).toBe("cubic-bezier(0.4, 0, 1, 1)");
      expect(EASING_PRESETS.bounce).toBe("cubic-bezier(0.68, -0.55, 0.265, 1.55)");
      expect(EASING_PRESETS.snappy).toBe("cubic-bezier(0.5, 0, 0.1, 1)");
    });
  });

  describe("ANIMATION_STYLES", () => {
    it("should have style functions for all animation types", () => {
      expect(typeof ANIMATION_STYLES.slide).toBe("function");
      expect(typeof ANIMATION_STYLES.fade).toBe("function");
      expect(typeof ANIMATION_STYLES.scale).toBe("function");
      expect(typeof ANIMATION_STYLES.slideAndFade).toBe("function");
      expect(typeof ANIMATION_STYLES.none).toBe("function");
    });

    it("should generate correct slide transition", () => {
      const config: AnimationConfig = { ...DEFAULT_CONFIG, style: "slide" };
      expect(ANIMATION_STYLES.slide(config)).toBe("width 300ms ease-out");
    });

    it("should generate correct vertical slide transition", () => {
      const config: AnimationConfig = { ...DEFAULT_CONFIG, style: "slide", orientation: "vertical" };
      expect(ANIMATION_STYLES.slide(config)).toBe("height 300ms ease-out");
    });

    it("should generate correct fade transition", () => {
      const config: AnimationConfig = { ...DEFAULT_CONFIG, style: "fade" };
      expect(ANIMATION_STYLES.fade(config)).toBe("opacity 300ms ease-out");
    });

    it("should generate correct scale transition", () => {
      const config: AnimationConfig = { ...DEFAULT_CONFIG, style: "scale" };
      expect(ANIMATION_STYLES.scale(config)).toBe("transform 300ms ease-out");
    });

    it("should generate correct slideAndFade transition", () => {
      const config: AnimationConfig = { ...DEFAULT_CONFIG, style: "slideAndFade" };
      expect(ANIMATION_STYLES.slideAndFade(config)).toContain("width 300ms ease-out");
      expect(ANIMATION_STYLES.slideAndFade(config)).toContain("opacity 300ms ease-out");
    });

    it("should return none for no animation", () => {
      const config: AnimationConfig = { ...DEFAULT_CONFIG, style: "none" };
      expect(ANIMATION_STYLES.none(config)).toBe("none");
    });
  });
});

// ============================================================================
// Utility Functions
// ============================================================================

describe("Utility Functions", () => {
  describe("getEasingValue", () => {
    it("should return CSS value for standard easing", () => {
      const config: AnimationConfig = { ...DEFAULT_CONFIG, easing: "ease-out" };
      expect(getEasingValue(config)).toBe("ease-out");
    });

    it("should return custom cubic-bezier if provided", () => {
      const config: AnimationConfig = {
        ...DEFAULT_CONFIG,
        easing: "cubic-bezier",
        cubicBezier: [0.1, 0.2, 0.3, 0.4],
      };
      expect(getEasingValue(config)).toBe("cubic-bezier(0.1, 0.2, 0.3, 0.4)");
    });

    it("should use default cubic-bezier if not provided", () => {
      const config: AnimationConfig = { ...DEFAULT_CONFIG, easing: "cubic-bezier" };
      expect(getEasingValue(config)).toBe("cubic-bezier(0.4, 0, 0.2, 1)");
    });
  });

  describe("applyEasing", () => {
    it("should return linear progress for linear easing", () => {
      expect(applyEasing(0, "linear")).toBe(0);
      expect(applyEasing(0.5, "linear")).toBe(0.5);
      expect(applyEasing(1, "linear")).toBe(1);
    });

    it("should apply ease-in (quadratic)", () => {
      expect(applyEasing(0, "ease-in")).toBe(0);
      expect(applyEasing(0.5, "ease-in")).toBe(0.25); // 0.5^2
      expect(applyEasing(1, "ease-in")).toBe(1);
    });

    it("should apply ease-out (inverse quadratic)", () => {
      expect(applyEasing(0, "ease-out")).toBe(0);
      expect(applyEasing(0.5, "ease-out")).toBe(0.75); // 1 - (1-0.5)^2
      expect(applyEasing(1, "ease-out")).toBe(1);
    });

    it("should apply ease-in-out", () => {
      expect(applyEasing(0, "ease-in-out")).toBe(0);
      expect(applyEasing(0.5, "ease-in-out")).toBe(0.5);
      expect(applyEasing(1, "ease-in-out")).toBe(1);
    });

    it("should apply ease (cubic approximation)", () => {
      expect(applyEasing(0, "ease")).toBe(0);
      expect(applyEasing(1, "ease")).toBe(1);
      // Symmetric cubic function equals 0.5 at midpoint by design
      expect(applyEasing(0.5, "ease")).toBe(0.5);
      // But differs from linear at other points (accelerates/decelerates)
      expect(applyEasing(0.25, "ease")).not.toBe(0.25);
      expect(applyEasing(0.75, "ease")).not.toBe(0.75);
    });

    it("should handle cubic-bezier easing", () => {
      expect(applyEasing(0, "cubic-bezier")).toBe(0);
      expect(applyEasing(1, "cubic-bezier")).toBe(1);
    });
  });

  describe("lerp", () => {
    it("should interpolate between values", () => {
      expect(lerp(0, 100, 0)).toBe(0);
      expect(lerp(0, 100, 0.5)).toBe(50);
      expect(lerp(0, 100, 1)).toBe(100);
    });

    it("should handle negative values", () => {
      expect(lerp(-100, 100, 0.5)).toBe(0);
    });

    it("should handle reverse interpolation", () => {
      expect(lerp(100, 0, 0.5)).toBe(50);
    });
  });

  describe("clamp", () => {
    it("should clamp value within range", () => {
      expect(clamp(50, 0, 100)).toBe(50);
      expect(clamp(-10, 0, 100)).toBe(0);
      expect(clamp(150, 0, 100)).toBe(100);
    });

    it("should handle equal min and max", () => {
      expect(clamp(50, 25, 25)).toBe(25);
    });
  });

  describe("generatePanelId", () => {
    it("should generate unique IDs", () => {
      const id1 = generatePanelId();
      const id2 = generatePanelId();
      expect(id1).not.toBe(id2);
    });

    it("should start with panel-", () => {
      const id = generatePanelId();
      expect(id.startsWith("panel-")).toBe(true);
    });
  });

  describe("generateTransitionCSS", () => {
    it("should generate CSS for slide style", () => {
      const config: AnimationConfig = { ...DEFAULT_CONFIG, style: "slide" };
      expect(generateTransitionCSS(config)).toBe("width 300ms ease-out");
    });

    it("should generate CSS for fade style", () => {
      const config: AnimationConfig = { ...DEFAULT_CONFIG, style: "fade" };
      expect(generateTransitionCSS(config)).toBe("opacity 300ms ease-out");
    });
  });

  describe("generateFrameStyles", () => {
    const baseFrame: AnimationFrame = {
      progress: 0.5,
      easedProgress: 0.5,
      width: 150,
      height: 100,
      opacity: 0.5,
      scale: 0.975,
      elapsed: 150,
    };

    it("should generate styles for slide animation", () => {
      const config: AnimationConfig = { ...DEFAULT_CONFIG, style: "slide" };
      const styles = generateFrameStyles(baseFrame, config, "expand");
      expect(styles.width).toBe("150px");
      expect(styles.overflow).toBe("hidden");
    });

    it("should generate styles for vertical slide", () => {
      const config: AnimationConfig = { ...DEFAULT_CONFIG, style: "slide", orientation: "vertical" };
      const styles = generateFrameStyles(baseFrame, config, "expand");
      expect(styles.height).toBe("100px");
    });

    it("should generate styles for fade animation", () => {
      const config: AnimationConfig = { ...DEFAULT_CONFIG, style: "fade" };
      const styles = generateFrameStyles(baseFrame, config, "expand");
      expect(styles.opacity).toBe("0.5");
    });

    it("should generate styles for scale animation", () => {
      const config: AnimationConfig = { ...DEFAULT_CONFIG, style: "scale" };
      const styles = generateFrameStyles(baseFrame, config, "expand");
      expect(styles.transform).toBe("scale(0.975)");
      expect(styles.opacity).toBe("0.5");
    });

    it("should generate styles for slideAndFade animation", () => {
      const config: AnimationConfig = { ...DEFAULT_CONFIG, style: "slideAndFade" };
      const styles = generateFrameStyles(baseFrame, config, "expand");
      expect(styles.width).toBe("150px");
      expect(styles.opacity).toBe("0.5");
    });

    it("should return minimal styles for none animation", () => {
      const config: AnimationConfig = { ...DEFAULT_CONFIG, style: "none" };
      const styles = generateFrameStyles(baseFrame, config, "expand");
      expect(styles.overflow).toBe("hidden");
      expect(styles.width).toBeUndefined();
    });
  });

  describe("prefersReducedMotion", () => {
    it("should return false when window is undefined", () => {
      // In Node.js environment, window is undefined
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;
      expect(prefersReducedMotion()).toBe(false);
      global.window = originalWindow;
    });
  });
});

// ============================================================================
// Config Factory Functions
// ============================================================================

describe("Config Factory Functions", () => {
  describe("createSmoothConfig", () => {
    it("should create smooth animation config with default duration", () => {
      const config = createSmoothConfig();
      expect(config.duration).toBe(300);
      expect(config.easing).toBe("ease-out");
      expect(config.style).toBe("slideAndFade");
      expect(config.orientation).toBe("horizontal");
    });

    it("should use custom duration", () => {
      const config = createSmoothConfig(500);
      expect(config.duration).toBe(500);
    });
  });

  describe("createSnappyConfig", () => {
    it("should create snappy animation config with default duration", () => {
      const config = createSnappyConfig();
      expect(config.duration).toBe(200);
      expect(config.easing).toBe("cubic-bezier");
      expect(config.cubicBezier).toEqual([0.5, 0, 0.1, 1]);
      expect(config.style).toBe("slide");
    });

    it("should use custom duration", () => {
      const config = createSnappyConfig(150);
      expect(config.duration).toBe(150);
    });
  });

  describe("createBounceConfig", () => {
    it("should create bounce animation config with default duration", () => {
      const config = createBounceConfig();
      expect(config.duration).toBe(400);
      expect(config.easing).toBe("cubic-bezier");
      expect(config.cubicBezier).toEqual([0.68, -0.55, 0.265, 1.55]);
      expect(config.style).toBe("scale");
    });

    it("should use custom duration", () => {
      const config = createBounceConfig(600);
      expect(config.duration).toBe(600);
    });
  });
});

// ============================================================================
// PanelAnimator Class
// ============================================================================

describe("PanelAnimator", () => {
  let animator: PanelAnimator;
  const expandedDims: PanelDimensions = { width: 300, height: 400 };
  const collapsedDims: PanelDimensions = { width: 0, height: 400, minWidth: 0 };

  beforeEach(() => {
    animator = new PanelAnimator();
    vi.useFakeTimers();
  });

  afterEach(() => {
    animator.dispose();
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("should create with default options", () => {
      const a = new PanelAnimator();
      expect(a.getConfig()).toEqual(DEFAULT_CONFIG);
      a.dispose();
    });

    it("should merge custom config", () => {
      const a = new PanelAnimator({
        defaultConfig: { duration: 500, style: "fade" },
      });
      expect(a.getConfig().duration).toBe(500);
      expect(a.getConfig().style).toBe("fade");
      a.dispose();
    });

    it("should respect reduced motion option", () => {
      const a = new PanelAnimator({ respectReducedMotion: false });
      expect(a.getConfig()).toBeDefined();
      a.dispose();
    });
  });

  describe("registerPanel", () => {
    it("should register a panel and return state", () => {
      const state = animator.registerPanel("panel-1", expandedDims, collapsedDims);
      expect(state.id).toBe("panel-1");
      expect(state.expanded).toBe(true);
      expect(state.animationState).toBe("expanded");
      expect(state.dimensions).toEqual(expandedDims);
    });

    it("should register collapsed panel", () => {
      const state = animator.registerPanel("panel-1", expandedDims, collapsedDims, false);
      expect(state.expanded).toBe(false);
      expect(state.animationState).toBe("collapsed");
      expect(state.dimensions).toEqual(collapsedDims);
    });

    it("should throw if disposed", () => {
      animator.dispose();
      expect(() => animator.registerPanel("panel-1", expandedDims, collapsedDims)).toThrow(
        "PanelAnimator is disposed"
      );
    });
  });

  describe("unregisterPanel", () => {
    it("should unregister a panel", () => {
      animator.registerPanel("panel-1", expandedDims, collapsedDims);
      expect(animator.unregisterPanel("panel-1")).toBe(true);
      expect(animator.getPanel("panel-1")).toBeUndefined();
    });

    it("should return false for non-existent panel", () => {
      expect(animator.unregisterPanel("non-existent")).toBe(false);
    });
  });

  describe("getPanel", () => {
    it("should return panel state", () => {
      animator.registerPanel("panel-1", expandedDims, collapsedDims);
      const panel = animator.getPanel("panel-1");
      expect(panel?.id).toBe("panel-1");
    });

    it("should return undefined for non-existent panel", () => {
      expect(animator.getPanel("non-existent")).toBeUndefined();
    });
  });

  describe("getAllPanels", () => {
    it("should return all panels", () => {
      animator.registerPanel("panel-1", expandedDims, collapsedDims);
      animator.registerPanel("panel-2", expandedDims, collapsedDims);
      const panels = animator.getAllPanels();
      expect(panels.length).toBe(2);
    });

    it("should return empty array when no panels", () => {
      expect(animator.getAllPanels()).toEqual([]);
    });
  });

  describe("toggle", () => {
    it("should toggle expanded panel to collapsed", () => {
      animator.registerPanel("panel-1", expandedDims, collapsedDims, true);
      // Use instant animation
      const result = animator.toggle("panel-1", { duration: 0 });
      expect(result).toBe(false); // Now collapsed
    });

    it("should toggle collapsed panel to expanded", () => {
      animator.registerPanel("panel-1", expandedDims, collapsedDims, false);
      const result = animator.toggle("panel-1", { duration: 0 });
      expect(result).toBe(true); // Now expanded
    });

    it("should return false for non-existent panel", () => {
      expect(animator.toggle("non-existent")).toBe(false);
    });
  });

  describe("expand", () => {
    it("should expand a collapsed panel instantly when duration is 0", () => {
      animator.registerPanel("panel-1", expandedDims, collapsedDims, false);
      animator.expand("panel-1", { duration: 0 });
      const panel = animator.getPanel("panel-1");
      expect(panel?.expanded).toBe(true);
      expect(panel?.animationState).toBe("expanded");
    });

    it("should not expand already expanded panel", () => {
      const callback = vi.fn();
      animator.onComplete(callback);
      animator.registerPanel("panel-1", expandedDims, collapsedDims, true);
      animator.expand("panel-1", { duration: 0 });
      // Should not trigger callback since panel was already expanded
      expect(callback).not.toHaveBeenCalled();
    });

    it("should throw if disposed", () => {
      animator.registerPanel("panel-1", expandedDims, collapsedDims, false);
      animator.dispose();
      expect(() => animator.expand("panel-1")).toThrow("PanelAnimator is disposed");
    });
  });

  describe("collapse", () => {
    it("should collapse an expanded panel instantly when duration is 0", () => {
      animator.registerPanel("panel-1", expandedDims, collapsedDims, true);
      animator.collapse("panel-1", { duration: 0 });
      const panel = animator.getPanel("panel-1");
      expect(panel?.expanded).toBe(false);
      expect(panel?.animationState).toBe("collapsed");
    });

    it("should not collapse already collapsed panel", () => {
      const callback = vi.fn();
      animator.onComplete(callback);
      animator.registerPanel("panel-1", expandedDims, collapsedDims, false);
      animator.collapse("panel-1", { duration: 0 });
      // Should not trigger callback since panel was already collapsed
      expect(callback).not.toHaveBeenCalled();
    });

    it("should throw if disposed", () => {
      animator.registerPanel("panel-1", expandedDims, collapsedDims, true);
      animator.dispose();
      expect(() => animator.collapse("panel-1")).toThrow("PanelAnimator is disposed");
    });
  });

  describe("cancelAnimation", () => {
    it("should cancel ongoing animation", () => {
      animator.registerPanel("panel-1", expandedDims, collapsedDims, false);
      animator.expand("panel-1", { duration: 1000 });
      animator.cancelAnimation("panel-1");
      // Panel should still be in some state
      expect(animator.getPanel("panel-1")).toBeDefined();
    });

    it("should handle cancelling non-existent animation", () => {
      // Should not throw
      expect(() => animator.cancelAnimation("non-existent")).not.toThrow();
    });
  });

  describe("getStyles", () => {
    it("should return styles for horizontal slide", () => {
      animator.registerPanel("panel-1", expandedDims, collapsedDims, true);
      const styles = animator.getStyles("panel-1");
      expect(styles.width).toBe("300px");
      expect(styles.transition).toContain("width");
    });

    it("should return styles for vertical slide", () => {
      const a = new PanelAnimator({ defaultConfig: { orientation: "vertical" } });
      a.registerPanel("panel-1", expandedDims, collapsedDims, true);
      const styles = a.getStyles("panel-1");
      expect(styles.height).toBe("400px");
      a.dispose();
    });

    it("should return opacity for fade style", () => {
      const a = new PanelAnimator({ defaultConfig: { style: "fade" } });
      a.registerPanel("panel-1", expandedDims, collapsedDims, true);
      const styles = a.getStyles("panel-1");
      expect(styles.opacity).toBe("1");
      a.dispose();
    });

    it("should return transform for scale style", () => {
      const a = new PanelAnimator({ defaultConfig: { style: "scale" } });
      a.registerPanel("panel-1", expandedDims, collapsedDims, true);
      const styles = a.getStyles("panel-1");
      expect(styles.transform).toBe("scale(1)");
      expect(styles.opacity).toBe("1");
      a.dispose();
    });

    it("should return empty object for non-existent panel", () => {
      expect(animator.getStyles("non-existent")).toEqual({});
    });
  });

  describe("getStyleString", () => {
    it("should return inline style string", () => {
      animator.registerPanel("panel-1", expandedDims, collapsedDims, true);
      const styleStr = animator.getStyleString("panel-1");
      expect(styleStr).toContain("width: 300px");
      expect(styleStr).toContain("transition:");
    });

    it("should convert camelCase to kebab-case", () => {
      const a = new PanelAnimator({ defaultConfig: { style: "slideAndFade" } });
      a.registerPanel("panel-1", expandedDims, collapsedDims, false);
      const styleStr = a.getStyleString("panel-1");
      // Should have opacity in kebab-case if applicable
      expect(styleStr).toContain("transition:");
      a.dispose();
    });
  });

  describe("setConfig", () => {
    it("should update configuration", () => {
      animator.setConfig({ duration: 500 });
      expect(animator.getConfig().duration).toBe(500);
    });

    it("should merge with existing config", () => {
      animator.setConfig({ duration: 500 });
      animator.setConfig({ style: "fade" });
      expect(animator.getConfig().duration).toBe(500);
      expect(animator.getConfig().style).toBe("fade");
    });

    it("should throw if disposed", () => {
      animator.dispose();
      expect(() => animator.setConfig({ duration: 500 })).toThrow("PanelAnimator is disposed");
    });
  });

  describe("getConfig", () => {
    it("should return a copy of config", () => {
      const config = animator.getConfig();
      config.duration = 999;
      expect(animator.getConfig().duration).toBe(300); // Original unchanged
    });
  });

  describe("onStateChange", () => {
    it("should subscribe to state changes", () => {
      const callback = vi.fn();
      animator.onStateChange(callback);
      animator.registerPanel("panel-1", expandedDims, collapsedDims, true);
      animator.collapse("panel-1", { duration: 0 });
      expect(callback).toHaveBeenCalled();
    });

    it("should return unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = animator.onStateChange(callback);
      unsubscribe();
      animator.registerPanel("panel-1", expandedDims, collapsedDims, true);
      animator.collapse("panel-1", { duration: 0 });
      expect(callback).not.toHaveBeenCalled();
    });

    it("should throw if disposed", () => {
      animator.dispose();
      expect(() => animator.onStateChange(() => {})).toThrow("PanelAnimator is disposed");
    });

    it("should catch callback errors", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      animator.onStateChange(() => {
        throw new Error("Callback error");
      });
      animator.registerPanel("panel-1", expandedDims, collapsedDims, true);
      animator.collapse("panel-1", { duration: 0 });
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe("onComplete", () => {
    it("should subscribe to animation complete", () => {
      const callback = vi.fn();
      animator.onComplete(callback);
      animator.registerPanel("panel-1", expandedDims, collapsedDims, true);
      animator.collapse("panel-1", { duration: 0 });
      expect(callback).toHaveBeenCalledWith("panel-1", false);
    });

    it("should return unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = animator.onComplete(callback);
      unsubscribe();
      animator.registerPanel("panel-1", expandedDims, collapsedDims, true);
      animator.collapse("panel-1", { duration: 0 });
      expect(callback).not.toHaveBeenCalled();
    });

    it("should throw if disposed", () => {
      animator.dispose();
      expect(() => animator.onComplete(() => {})).toThrow("PanelAnimator is disposed");
    });

    it("should catch callback errors", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      animator.onComplete(() => {
        throw new Error("Callback error");
      });
      animator.registerPanel("panel-1", expandedDims, collapsedDims, true);
      animator.collapse("panel-1", { duration: 0 });
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe("isDisposed", () => {
    it("should return false when not disposed", () => {
      expect(animator.isDisposed()).toBe(false);
    });

    it("should return true when disposed", () => {
      animator.dispose();
      expect(animator.isDisposed()).toBe(true);
    });
  });

  describe("dispose", () => {
    it("should clear all panels and callbacks", () => {
      animator.registerPanel("panel-1", expandedDims, collapsedDims);
      animator.onStateChange(() => {});
      animator.onComplete(() => {});
      animator.dispose();
      expect(animator.getAllPanels()).toEqual([]);
      expect(animator.isDisposed()).toBe(true);
    });

    it("should be idempotent", () => {
      animator.dispose();
      expect(() => animator.dispose()).not.toThrow();
    });

    it("should cancel ongoing animations", () => {
      animator.registerPanel("panel-1", expandedDims, collapsedDims, false);
      animator.expand("panel-1", { duration: 1000 });
      animator.dispose();
      // Should not throw when canceling during dispose
      expect(animator.isDisposed()).toBe(true);
    });
  });
});

// ============================================================================
// Factory Function
// ============================================================================

describe("createPanelAnimator", () => {
  it("should create PanelAnimator instance", () => {
    const animator = createPanelAnimator();
    expect(animator).toBeInstanceOf(PanelAnimator);
    animator.dispose();
  });

  it("should pass options to constructor", () => {
    const animator = createPanelAnimator({
      defaultConfig: { duration: 500 },
    });
    expect(animator.getConfig().duration).toBe(500);
    animator.dispose();
  });
});

// ============================================================================
// Animation with 'none' style
// ============================================================================

describe("Animation with 'none' style", () => {
  it("should complete instantly when style is none", () => {
    const animator = new PanelAnimator({ defaultConfig: { style: "none" } });
    const callback = vi.fn();
    animator.onComplete(callback);
    animator.registerPanel("panel-1", { width: 300, height: 400 }, { width: 0, height: 400 }, false);
    animator.expand("panel-1");
    expect(callback).toHaveBeenCalledWith("panel-1", true);
    animator.dispose();
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Edge cases", () => {
  it("should handle zero dimensions", () => {
    const animator = new PanelAnimator();
    const state = animator.registerPanel(
      "panel-1",
      { width: 0, height: 0 },
      { width: 0, height: 0 },
      true
    );
    expect(state.dimensions.width).toBe(0);
    expect(state.dimensions.height).toBe(0);
    animator.dispose();
  });

  it("should handle very large dimensions", () => {
    const animator = new PanelAnimator();
    const state = animator.registerPanel(
      "panel-1",
      { width: 10000, height: 10000 },
      { width: 0, height: 0 },
      true
    );
    expect(state.dimensions.width).toBe(10000);
    animator.dispose();
  });

  it("should handle multiple panels", () => {
    const animator = new PanelAnimator();
    animator.registerPanel("panel-1", { width: 100, height: 100 }, { width: 0, height: 100 });
    animator.registerPanel("panel-2", { width: 200, height: 200 }, { width: 0, height: 200 });
    animator.registerPanel("panel-3", { width: 300, height: 300 }, { width: 0, height: 300 });

    expect(animator.getAllPanels().length).toBe(3);
    animator.collapse("panel-1", { duration: 0 });
    animator.collapse("panel-2", { duration: 0 });

    expect(animator.getPanel("panel-1")?.expanded).toBe(false);
    expect(animator.getPanel("panel-2")?.expanded).toBe(false);
    expect(animator.getPanel("panel-3")?.expanded).toBe(true);

    animator.dispose();
  });

  it("should handle rapid toggle", () => {
    const animator = new PanelAnimator();
    animator.registerPanel("panel-1", { width: 300, height: 400 }, { width: 0, height: 400 }, true);

    // Rapid toggles with instant animation
    for (let i = 0; i < 10; i++) {
      animator.toggle("panel-1", { duration: 0 });
    }

    // After 10 toggles, should be in original state (expanded)
    expect(animator.getPanel("panel-1")?.expanded).toBe(true);
    animator.dispose();
  });

  it("should preserve minWidth and minHeight", () => {
    const animator = new PanelAnimator();
    const expandedDims = { width: 300, height: 400 };
    const collapsedDims = { width: 50, height: 100, minWidth: 50, minHeight: 100 };

    animator.registerPanel("panel-1", expandedDims, collapsedDims, true);
    animator.collapse("panel-1", { duration: 0 });

    const panel = animator.getPanel("panel-1");
    expect(panel?.dimensions.minWidth).toBe(50);
    expect(panel?.dimensions.minHeight).toBe(100);

    animator.dispose();
  });
});

// ============================================================================
// Integration with callbacks
// ============================================================================

describe("Integration with callbacks", () => {
  it("should call state change before complete", () => {
    const animator = new PanelAnimator();
    const order: string[] = [];

    animator.onStateChange(() => order.push("state"));
    animator.onComplete(() => order.push("complete"));

    animator.registerPanel("panel-1", { width: 300, height: 400 }, { width: 0, height: 400 }, true);
    animator.collapse("panel-1", { duration: 0 });

    expect(order).toEqual(["state", "complete"]);
    animator.dispose();
  });

  it("should call multiple callbacks", () => {
    const animator = new PanelAnimator();
    const stateCallbacks = [vi.fn(), vi.fn(), vi.fn()];
    const completeCallbacks = [vi.fn(), vi.fn()];

    stateCallbacks.forEach((cb) => animator.onStateChange(cb));
    completeCallbacks.forEach((cb) => animator.onComplete(cb));

    animator.registerPanel("panel-1", { width: 300, height: 400 }, { width: 0, height: 400 }, true);
    animator.collapse("panel-1", { duration: 0 });

    stateCallbacks.forEach((cb) => expect(cb).toHaveBeenCalled());
    completeCallbacks.forEach((cb) => expect(cb).toHaveBeenCalled());

    animator.dispose();
  });
});
