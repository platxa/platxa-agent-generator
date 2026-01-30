/**
 * Tests for Animated Progress Bar
 *
 * Feature #101: Create animated progress bar with phase-specific colors
 * Verification: Blue for planning, green for generating, yellow for validating
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  AnimatedProgressBar,
  createAnimatedProgressBar,
  PHASE_COLORS,
  PHASE_LABELS,
  SIZE_CONFIG,
  ANIMATION_KEYFRAMES,
  PROGRESS_BAR_SCRIPT,
  clamp,
  getPhaseColor,
  getPhaseLabel,
  formatProgress,
  getAnimationClasses,
  getIndeterminateClasses,
  type ProgressPhase,
  type AnimationStyle,
} from "../../lib/preview/animated-progress-bar";

describe("AnimatedProgressBar", () => {
  let progressBar: AnimatedProgressBar;

  beforeEach(() => {
    vi.useFakeTimers();
    progressBar = new AnimatedProgressBar();
  });

  afterEach(() => {
    progressBar.dispose();
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("should create instance with default state", () => {
      const state = progressBar.getState();

      expect(state.progress).toBe(0);
      expect(state.targetProgress).toBe(0);
      expect(state.phase).toBe("idle");
      expect(state.animating).toBe(false);
      expect(state.indeterminate).toBe(false);
      expect(state.visible).toBe(true);
    });

    it("should accept custom initial options", () => {
      const custom = new AnimatedProgressBar({
        initialProgress: 50,
        initialPhase: "planning",
      });

      const state = custom.getState();
      expect(state.progress).toBe(50);
      expect(state.phase).toBe("planning");

      custom.dispose();
    });
  });

  describe("setProgress", () => {
    it("should set target progress", () => {
      progressBar.setProgress(75);

      expect(progressBar.getState().targetProgress).toBe(75);
    });

    it("should clamp progress to 0-100", () => {
      progressBar.setProgress(-10);
      expect(progressBar.getState().targetProgress).toBe(0);

      progressBar.setProgress(150);
      expect(progressBar.getState().targetProgress).toBe(100);
    });

    it("should disable indeterminate mode", () => {
      progressBar.setIndeterminate(true);
      expect(progressBar.getState().indeterminate).toBe(true);

      progressBar.setProgress(50);
      expect(progressBar.getState().indeterminate).toBe(false);
    });

    it("should trigger animation", () => {
      progressBar.setProgress(50);

      expect(progressBar.isAnimating()).toBe(true);
    });
  });

  describe("setProgressImmediate", () => {
    it("should set progress without animation", () => {
      progressBar.setProgressImmediate(75);

      const state = progressBar.getState();
      expect(state.progress).toBe(75);
      expect(state.targetProgress).toBe(75);
      expect(state.animating).toBe(false);
    });
  });

  describe("increment", () => {
    it("should increment progress by amount", () => {
      progressBar.setProgressImmediate(50);
      progressBar.increment(10);

      expect(progressBar.getState().targetProgress).toBe(60);
    });

    it("should increment by 1 by default", () => {
      progressBar.setProgressImmediate(50);
      progressBar.increment();

      expect(progressBar.getState().targetProgress).toBe(51);
    });
  });

  describe("setIndeterminate", () => {
    it("should enable indeterminate mode", () => {
      progressBar.setIndeterminate(true);

      expect(progressBar.getState().indeterminate).toBe(true);
    });

    it("should disable indeterminate mode", () => {
      progressBar.setIndeterminate(true);
      progressBar.setIndeterminate(false);

      expect(progressBar.getState().indeterminate).toBe(false);
    });
  });

  describe("setPhase", () => {
    it("should change phase", () => {
      progressBar.setPhase("planning");

      expect(progressBar.getPhase()).toBe("planning");
      expect(progressBar.getState().label).toBe("Planning...");
    });

    it("should trigger phase change callback", () => {
      const callback = vi.fn();
      progressBar.onPhaseChange(callback);

      progressBar.setPhase("generating");

      expect(callback).toHaveBeenCalledWith("generating", "idle");
    });

    it("should not trigger callback for same phase", () => {
      progressBar.setPhase("planning");

      const callback = vi.fn();
      progressBar.onPhaseChange(callback);

      progressBar.setPhase("planning");

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("setLabel", () => {
    it("should set custom label", () => {
      progressBar.setLabel("Custom Label", "Sublabel");

      const state = progressBar.getState();
      expect(state.label).toBe("Custom Label");
      expect(state.sublabel).toBe("Sublabel");
    });
  });

  describe("start", () => {
    it("should start with specified phase", () => {
      progressBar.start("planning");

      const state = progressBar.getState();
      expect(state.progress).toBe(0);
      expect(state.phase).toBe("planning");
      expect(state.visible).toBe(true);
    });

    it("should default to planning phase", () => {
      progressBar.start();

      expect(progressBar.getPhase()).toBe("planning");
    });
  });

  describe("complete", () => {
    it("should set complete state", () => {
      progressBar.start("generating");
      progressBar.setProgress(50);
      progressBar.complete();

      const state = progressBar.getState();
      expect(state.progress).toBe(100);
      expect(state.phase).toBe("complete");
      expect(state.animating).toBe(false);
    });

    it("should trigger complete callback", () => {
      const callback = vi.fn();
      progressBar.onComplete(callback);

      progressBar.complete();

      expect(callback).toHaveBeenCalled();
    });
  });

  describe("error", () => {
    it("should set error state", () => {
      progressBar.start("planning");
      progressBar.error();

      const state = progressBar.getState();
      expect(state.phase).toBe("error");
      expect(state.label).toBe("Error");
    });

    it("should accept custom error message", () => {
      progressBar.error("Something went wrong");

      expect(progressBar.getState().label).toBe("Something went wrong");
    });
  });

  describe("reset", () => {
    it("should reset to initial state", () => {
      progressBar.start("generating");
      progressBar.setProgress(75);

      progressBar.reset();

      const state = progressBar.getState();
      expect(state.progress).toBe(0);
      expect(state.phase).toBe("idle");
      expect(state.animating).toBe(false);
    });
  });

  describe("visibility", () => {
    it("should hide progress bar", () => {
      progressBar.hide();

      expect(progressBar.isVisible()).toBe(false);
    });

    it("should show progress bar", () => {
      progressBar.hide();
      progressBar.show();

      expect(progressBar.isVisible()).toBe(true);
    });
  });

  describe("isComplete", () => {
    it("should return true when complete", () => {
      progressBar.complete();

      expect(progressBar.isComplete()).toBe(true);
    });

    it("should return false when not complete", () => {
      progressBar.setProgress(50);

      expect(progressBar.isComplete()).toBe(false);
    });
  });

  describe("getStyles", () => {
    it("should return style configuration", () => {
      progressBar.setPhase("planning");
      const styles = progressBar.getStyles();

      expect(styles.container).toContain("rounded-full");
      expect(styles.bar).toContain("rounded-full");
      expect(styles.barStyle.width).toBe("0%");
    });

    it("should include phase-specific colors", () => {
      progressBar.setPhase("planning");
      const styles = progressBar.getStyles();

      expect(styles.bar).toContain("bg-blue");
    });

    it("should include animation keyframes", () => {
      const styles = progressBar.getStyles();

      expect(styles.keyframes).toContain("@keyframes indeterminate");
    });

    it("should set width for indeterminate mode", () => {
      progressBar.setIndeterminate(true);
      const styles = progressBar.getStyles();

      expect(styles.barStyle.width).toBe("30%");
    });
  });

  describe("getFormattedProgress", () => {
    it("should format progress as percentage", () => {
      progressBar.setProgressImmediate(75);

      expect(progressBar.getFormattedProgress()).toBe("75%");
    });
  });

  describe("getPhaseColors", () => {
    it("should return current phase colors", () => {
      progressBar.setPhase("generating");
      const colors = progressBar.getPhaseColors();

      expect(colors.fg).toContain("bg-green");
      expect(colors.text).toContain("text-green");
    });
  });

  describe("callbacks", () => {
    it("should support multiple state callbacks", () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      progressBar.onStateChange(cb1);
      progressBar.onStateChange(cb2);

      progressBar.setProgress(50);

      expect(cb1).toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
    });

    it("should return unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = progressBar.onStateChange(callback);

      progressBar.setProgress(25);
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      progressBar.setProgress(50);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should handle callback errors gracefully", () => {
      const errorCb = vi.fn(() => {
        throw new Error("Callback error");
      });
      const normalCb = vi.fn();

      progressBar.onStateChange(errorCb);
      progressBar.onStateChange(normalCb);

      expect(() => progressBar.setProgress(50)).not.toThrow();
      expect(normalCb).toHaveBeenCalled();
    });
  });

  describe("dispose", () => {
    it("should prevent further updates", () => {
      const callback = vi.fn();
      progressBar.onStateChange(callback);

      progressBar.dispose();
      progressBar.setProgress(50);

      expect(callback).not.toHaveBeenCalled();
    });

    it("should be idempotent", () => {
      expect(() => {
        progressBar.dispose();
        progressBar.dispose();
      }).not.toThrow();
    });
  });
});

describe("createAnimatedProgressBar", () => {
  it("should create instance with factory function", () => {
    const bar = createAnimatedProgressBar({ initialPhase: "planning" });

    expect(bar).toBeInstanceOf(AnimatedProgressBar);
    expect(bar.getPhase()).toBe("planning");

    bar.dispose();
  });
});

describe("utility functions", () => {
  describe("clamp", () => {
    it("should clamp values to range", () => {
      expect(clamp(50, 0, 100)).toBe(50);
      expect(clamp(-10, 0, 100)).toBe(0);
      expect(clamp(150, 0, 100)).toBe(100);
    });
  });

  describe("getPhaseColor", () => {
    it("should return default phase color", () => {
      const color = getPhaseColor("planning");

      expect(color.fg).toContain("blue");
      expect(color.text).toContain("blue");
    });

    it("should use custom colors when provided", () => {
      const custom = {
        planning: {
          bg: "bg-custom",
          fg: "fg-custom",
          text: "text-custom",
        },
      };

      const color = getPhaseColor("planning", custom);

      expect(color.fg).toBe("fg-custom");
    });
  });

  describe("getPhaseLabel", () => {
    it("should return phase label", () => {
      expect(getPhaseLabel("planning")).toBe("Planning...");
      expect(getPhaseLabel("generating")).toBe("Generating...");
      expect(getPhaseLabel("validating")).toBe("Validating...");
      expect(getPhaseLabel("complete")).toBe("Complete");
    });
  });

  describe("formatProgress", () => {
    it("should format progress as percentage", () => {
      expect(formatProgress(0)).toBe("0%");
      expect(formatProgress(50)).toBe("50%");
      expect(formatProgress(100)).toBe("100%");
      expect(formatProgress(33.7)).toBe("34%");
    });
  });

  describe("getAnimationClasses", () => {
    it("should return classes for each style", () => {
      expect(getAnimationClasses("none")).toBe("");
      expect(getAnimationClasses("smooth")).toBe("");
      expect(getAnimationClasses("striped")).toContain("animate-");
      expect(getAnimationClasses("pulse")).toContain("animate-");
      expect(getAnimationClasses("shimmer")).toContain("animate-");
    });
  });

  describe("getIndeterminateClasses", () => {
    it("should return indeterminate animation class", () => {
      expect(getIndeterminateClasses()).toContain("animate-");
      expect(getIndeterminateClasses()).toContain("indeterminate");
    });
  });
});

describe("constants", () => {
  describe("PHASE_COLORS", () => {
    it("should have colors for all phases", () => {
      const phases: ProgressPhase[] = [
        "idle",
        "planning",
        "generating",
        "validating",
        "deploying",
        "complete",
        "error",
      ];

      for (const phase of phases) {
        expect(PHASE_COLORS[phase]).toBeDefined();
        expect(PHASE_COLORS[phase].bg).toBeTruthy();
        expect(PHASE_COLORS[phase].fg).toBeTruthy();
        expect(PHASE_COLORS[phase].text).toBeTruthy();
      }
    });

    it("should have blue for planning", () => {
      expect(PHASE_COLORS.planning.fg).toContain("blue");
    });

    it("should have green for generating", () => {
      expect(PHASE_COLORS.generating.fg).toContain("green");
    });

    it("should have yellow for validating", () => {
      expect(PHASE_COLORS.validating.fg).toContain("yellow");
    });
  });

  describe("PHASE_LABELS", () => {
    it("should have labels for all phases", () => {
      expect(PHASE_LABELS.idle).toBe("Ready");
      expect(PHASE_LABELS.planning).toBe("Planning...");
      expect(PHASE_LABELS.generating).toBe("Generating...");
      expect(PHASE_LABELS.validating).toBe("Validating...");
      expect(PHASE_LABELS.deploying).toBe("Deploying...");
      expect(PHASE_LABELS.complete).toBe("Complete");
      expect(PHASE_LABELS.error).toBe("Error");
    });
  });

  describe("SIZE_CONFIG", () => {
    it("should have configuration for all sizes", () => {
      const sizes = ["xs", "sm", "md", "lg", "xl"] as const;

      for (const size of sizes) {
        expect(SIZE_CONFIG[size]).toBeDefined();
        expect(SIZE_CONFIG[size].height).toMatch(/^h-\d+$/);
        expect(SIZE_CONFIG[size].text).toMatch(/^text-/);
      }
    });
  });

  describe("ANIMATION_KEYFRAMES", () => {
    it("should have keyframes for animated styles", () => {
      const styles: AnimationStyle[] = [
        "none",
        "smooth",
        "striped",
        "pulse",
        "shimmer",
      ];

      for (const style of styles) {
        expect(ANIMATION_KEYFRAMES[style]).toBeDefined();
      }

      expect(ANIMATION_KEYFRAMES.striped).toContain("@keyframes");
      expect(ANIMATION_KEYFRAMES.pulse).toContain("@keyframes");
      expect(ANIMATION_KEYFRAMES.shimmer).toContain("@keyframes");
    });
  });

  describe("PROGRESS_BAR_SCRIPT", () => {
    it("should be a non-empty script", () => {
      expect(PROGRESS_BAR_SCRIPT).toBeTruthy();
      expect(PROGRESS_BAR_SCRIPT).toContain("__PLATXA_PROGRESS_BAR__");
    });

    it("should include animation keyframes", () => {
      expect(PROGRESS_BAR_SCRIPT).toContain("@keyframes");
      expect(PROGRESS_BAR_SCRIPT).toContain("indeterminate");
    });
  });
});

describe("phase color verification", () => {
  it("should use blue for planning phase", () => {
    const bar = createAnimatedProgressBar({ initialPhase: "planning" });
    const colors = bar.getPhaseColors();

    expect(colors.fg).toContain("blue");
    expect(colors.bg).toContain("blue");
    expect(colors.text).toContain("blue");

    bar.dispose();
  });

  it("should use green for generating phase", () => {
    const bar = createAnimatedProgressBar({ initialPhase: "generating" });
    const colors = bar.getPhaseColors();

    expect(colors.fg).toContain("green");
    expect(colors.bg).toContain("green");
    expect(colors.text).toContain("green");

    bar.dispose();
  });

  it("should use yellow for validating phase", () => {
    const bar = createAnimatedProgressBar({ initialPhase: "validating" });
    const colors = bar.getPhaseColors();

    expect(colors.fg).toContain("yellow");
    expect(colors.bg).toContain("yellow");
    expect(colors.text).toContain("yellow");

    bar.dispose();
  });
});
