/**
 * Tests for Zoom Controls
 *
 * Feature #88: Create zoom controls for preview panel (25%-200%)
 * Verification: Slider or buttons adjust preview scale; shows current percentage
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  ZoomControls,
  createZoomControls,
  ZOOM_PRESETS,
  KEYBOARD_SHORTCUTS,
  ZOOM_CONTROLS_SCRIPT,
  zoomToScale,
  scaleToZoom,
  formatZoom,
  getClosestPreset,
  isPreset,
  type ZoomChangeEvent,
  type ZoomControlsState,
} from "../../lib/preview/zoom-controls";

describe("ZoomControls", () => {
  let zoom: ZoomControls;

  beforeEach(() => {
    zoom = new ZoomControls();
  });

  afterEach(() => {
    zoom.dispose();
  });

  describe("constructor", () => {
    it("should create instance with default options", () => {
      const state = zoom.getState();

      expect(state.zoom).toBe(100);
      expect(state.scale).toBe(1);
      expect(state.minZoom).toBe(25);
      expect(state.maxZoom).toBe(200);
      expect(state.step).toBe(25);
      expect(state.disabled).toBe(false);
      expect(state.mode).toBe("both");
    });

    it("should accept custom initial zoom", () => {
      const custom = new ZoomControls({ initialZoom: 150 });
      expect(custom.getZoom()).toBe(150);
      expect(custom.getScale()).toBe(1.5);
      custom.dispose();
    });

    it("should clamp initial zoom to bounds", () => {
      const tooLow = new ZoomControls({ initialZoom: 10 });
      expect(tooLow.getZoom()).toBe(25);
      tooLow.dispose();

      const tooHigh = new ZoomControls({ initialZoom: 300 });
      expect(tooHigh.getZoom()).toBe(200);
      tooHigh.dispose();
    });

    it("should accept custom min/max zoom", () => {
      const custom = new ZoomControls({
        minZoom: 50,
        maxZoom: 150,
        initialZoom: 100,
      });
      const state = custom.getState();
      expect(state.minZoom).toBe(50);
      expect(state.maxZoom).toBe(150);
      custom.dispose();
    });

    it("should accept custom step", () => {
      const custom = new ZoomControls({ step: 10 });
      expect(custom.getState().step).toBe(10);
      custom.dispose();
    });
  });

  describe("setZoom", () => {
    it("should set zoom level", () => {
      zoom.setZoom(150);
      expect(zoom.getZoom()).toBe(150);
      expect(zoom.getScale()).toBe(1.5);
    });

    it("should clamp zoom to min", () => {
      zoom.setZoom(10);
      expect(zoom.getZoom()).toBe(25);
    });

    it("should clamp zoom to max", () => {
      zoom.setZoom(300);
      expect(zoom.getZoom()).toBe(200);
    });

    it("should trigger onChange callback", () => {
      const callback = vi.fn();
      zoom.onChange(callback);

      zoom.setZoom(150);

      expect(callback).toHaveBeenCalledTimes(1);
      const event: ZoomChangeEvent = callback.mock.calls[0][0];
      expect(event.previousZoom).toBe(100);
      expect(event.zoom).toBe(150);
      expect(event.scale).toBe(1.5);
      expect(event.source).toBe("api");
    });

    it("should not trigger callback if zoom unchanged", () => {
      const callback = vi.fn();
      zoom.onChange(callback);

      zoom.setZoom(100); // Same as initial
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("setScale", () => {
    it("should set zoom via scale", () => {
      zoom.setScale(0.5);
      expect(zoom.getZoom()).toBe(50);
      expect(zoom.getScale()).toBe(0.5);
    });

    it("should clamp scale to bounds", () => {
      zoom.setScale(0.1); // 10% - below min
      expect(zoom.getZoom()).toBe(25);

      zoom.setScale(3); // 300% - above max
      expect(zoom.getZoom()).toBe(200);
    });
  });

  describe("zoomIn / zoomOut", () => {
    it("should zoom in by step", () => {
      zoom.zoomIn();
      expect(zoom.getZoom()).toBe(125);
    });

    it("should zoom out by step", () => {
      zoom.zoomOut();
      expect(zoom.getZoom()).toBe(75);
    });

    it("should not exceed max zoom", () => {
      zoom.setZoom(200);
      zoom.zoomIn();
      expect(zoom.getZoom()).toBe(200);
    });

    it("should not go below min zoom", () => {
      zoom.setZoom(25);
      zoom.zoomOut();
      expect(zoom.getZoom()).toBe(25);
    });

    it("should use custom step", () => {
      const custom = new ZoomControls({ step: 10 });
      custom.zoomIn();
      expect(custom.getZoom()).toBe(110);
      custom.zoomOut();
      expect(custom.getZoom()).toBe(100);
      custom.dispose();
    });
  });

  describe("reset", () => {
    it("should reset to 100%", () => {
      zoom.setZoom(150);
      zoom.reset();
      expect(zoom.getZoom()).toBe(100);
    });

    it("should trigger onChange with 'button' source", () => {
      const callback = vi.fn();
      zoom.setZoom(150);
      zoom.onChange(callback);

      zoom.reset();

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].source).toBe("button");
    });
  });

  describe("setPreset", () => {
    it("should set zoom to preset value", () => {
      zoom.setPreset(75);
      expect(zoom.getZoom()).toBe(75);
    });

    it("should trigger onChange with 'preset' source", () => {
      const callback = vi.fn();
      zoom.onChange(callback);

      zoom.setPreset(50);

      expect(callback.mock.calls[0][0].source).toBe("preset");
    });
  });

  describe("fitToContainer", () => {
    it("should calculate fit zoom", () => {
      // Content: 800x600, Container: 400x300 (no padding)
      zoom.fitToContainer(800, 600, 400, 300, 0);
      expect(zoom.getZoom()).toBe(50); // 400/800 = 0.5 = 50%
    });

    it("should account for padding", () => {
      // Content: 800x600, Container: 480x380 (with 40px padding = 400x300 available)
      zoom.fitToContainer(800, 600, 480, 380, 40);
      expect(zoom.getZoom()).toBe(50);
    });

    it("should clamp to min/max", () => {
      // Very large content should clamp to min
      zoom.fitToContainer(10000, 10000, 100, 100, 0);
      expect(zoom.getZoom()).toBe(25);
    });

    it("should round to step", () => {
      // 800x600 in 480x360 = 60% -> rounds to nearest 25 = 50%
      zoom.fitToContainer(800, 600, 480, 360, 0);
      expect(zoom.getZoom()).toBe(50);
    });
  });

  describe("canZoomIn / canZoomOut", () => {
    it("should return true when can zoom", () => {
      zoom.setZoom(100);
      expect(zoom.canZoomIn()).toBe(true);
      expect(zoom.canZoomOut()).toBe(true);
    });

    it("should return false at max", () => {
      zoom.setZoom(200);
      expect(zoom.canZoomIn()).toBe(false);
      expect(zoom.canZoomOut()).toBe(true);
    });

    it("should return false at min", () => {
      zoom.setZoom(25);
      expect(zoom.canZoomIn()).toBe(true);
      expect(zoom.canZoomOut()).toBe(false);
    });
  });

  describe("getZoomFormatted", () => {
    it("should return formatted percentage", () => {
      expect(zoom.getZoomFormatted()).toBe("100%");

      zoom.setZoom(75);
      expect(zoom.getZoomFormatted()).toBe("75%");

      zoom.setZoom(150);
      expect(zoom.getZoomFormatted()).toBe("150%");
    });
  });

  describe("getSliderConfig", () => {
    it("should return slider configuration", () => {
      const config = zoom.getSliderConfig();

      expect(config.min).toBe(25);
      expect(config.max).toBe(200);
      expect(config.step).toBe(25);
      expect(config.value).toBe(100);
      expect(config.displayValue).toBe("100%");
      expect(config.ariaLabel).toContain("100%");
    });

    it("should update with zoom changes", () => {
      zoom.setZoom(150);
      const config = zoom.getSliderConfig();

      expect(config.value).toBe(150);
      expect(config.displayValue).toBe("150%");
    });
  });

  describe("getButtonConfigs", () => {
    it("should return button configurations", () => {
      const buttons = zoom.getButtonConfigs();

      expect(buttons).toHaveLength(4);
      expect(buttons.map((b) => b.type)).toEqual([
        "zoomOut",
        "zoomIn",
        "reset",
        "fit",
      ]);
    });

    it("should disable zoomIn at max", () => {
      zoom.setZoom(200);
      const buttons = zoom.getButtonConfigs();
      const zoomIn = buttons.find((b) => b.type === "zoomIn");
      const zoomOut = buttons.find((b) => b.type === "zoomOut");

      expect(zoomIn?.disabled).toBe(true);
      expect(zoomOut?.disabled).toBe(false);
    });

    it("should disable zoomOut at min", () => {
      zoom.setZoom(25);
      const buttons = zoom.getButtonConfigs();
      const zoomIn = buttons.find((b) => b.type === "zoomIn");
      const zoomOut = buttons.find((b) => b.type === "zoomOut");

      expect(zoomIn?.disabled).toBe(false);
      expect(zoomOut?.disabled).toBe(true);
    });

    it("should disable reset at 100%", () => {
      const buttons = zoom.getButtonConfigs();
      const reset = buttons.find((b) => b.type === "reset");

      expect(reset?.disabled).toBe(true);

      zoom.setZoom(150);
      const updatedButtons = zoom.getButtonConfigs();
      const updatedReset = updatedButtons.find((b) => b.type === "reset");

      expect(updatedReset?.disabled).toBe(false);
    });
  });

  describe("getPresetConfigs", () => {
    it("should return preset configurations", () => {
      const presets = zoom.getPresetConfigs();

      expect(presets).toHaveLength(ZOOM_PRESETS.length);
      expect(presets.map((p) => p.zoom)).toEqual(ZOOM_PRESETS);
    });

    it("should mark active preset", () => {
      const presets = zoom.getPresetConfigs();
      const active = presets.find((p) => p.active);

      expect(active?.zoom).toBe(100);
    });

    it("should update active on zoom change", () => {
      zoom.setZoom(75);
      const presets = zoom.getPresetConfigs();
      const active = presets.find((p) => p.active);

      expect(active?.zoom).toBe(75);
    });

    it("should have no active when zoom is not a preset", () => {
      zoom.setOptions({ step: 10 });
      zoom.setZoom(110); // Not a preset

      const presets = zoom.getPresetConfigs();
      const active = presets.find((p) => p.active);

      expect(active).toBeUndefined();
    });
  });

  describe("setDisabled", () => {
    it("should disable controls", () => {
      zoom.setDisabled(true);
      expect(zoom.getState().disabled).toBe(true);
    });

    it("should trigger state change", () => {
      const callback = vi.fn();
      zoom.onStateChange(callback);

      zoom.setDisabled(true);

      expect(callback).toHaveBeenCalled();
    });

    it("should disable all buttons when disabled", () => {
      zoom.setDisabled(true);
      const buttons = zoom.getButtonConfigs();

      expect(buttons.every((b) => b.disabled)).toBe(true);
    });
  });

  describe("setOptions", () => {
    it("should update options", () => {
      zoom.setOptions({ minZoom: 50, maxZoom: 150, step: 10 });
      const state = zoom.getState();

      expect(state.minZoom).toBe(50);
      expect(state.maxZoom).toBe(150);
      expect(state.step).toBe(10);
    });

    it("should clamp zoom when bounds change", () => {
      zoom.setZoom(200);
      zoom.setOptions({ maxZoom: 150 });

      expect(zoom.getZoom()).toBe(150);
    });
  });

  describe("onChange / onStateChange", () => {
    it("should support multiple callbacks", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      zoom.onChange(callback1);
      zoom.onChange(callback2);

      zoom.setZoom(150);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it("should return unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = zoom.onChange(callback);

      zoom.setZoom(150);
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      zoom.setZoom(175);
      expect(callback).toHaveBeenCalledTimes(1); // Not called again
    });

    it("should handle callback errors gracefully", () => {
      const errorCallback = vi.fn(() => {
        throw new Error("Test error");
      });
      const normalCallback = vi.fn();

      zoom.onChange(errorCallback);
      zoom.onChange(normalCallback);

      // Should not throw
      expect(() => zoom.setZoom(150)).not.toThrow();
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe("dispose", () => {
    it("should prevent further updates", () => {
      const callback = vi.fn();
      zoom.onChange(callback);

      zoom.dispose();
      zoom.setZoom(150);

      expect(callback).not.toHaveBeenCalled();
    });

    it("should be idempotent", () => {
      expect(() => {
        zoom.dispose();
        zoom.dispose();
      }).not.toThrow();
    });
  });
});

describe("createZoomControls", () => {
  it("should create instance with factory function", () => {
    const instance = createZoomControls({ initialZoom: 75 });

    expect(instance).toBeInstanceOf(ZoomControls);
    expect(instance.getZoom()).toBe(75);

    instance.dispose();
  });
});

describe("utility functions", () => {
  describe("zoomToScale", () => {
    it("should convert zoom to scale", () => {
      expect(zoomToScale(100)).toBe(1);
      expect(zoomToScale(50)).toBe(0.5);
      expect(zoomToScale(200)).toBe(2);
      expect(zoomToScale(25)).toBe(0.25);
    });
  });

  describe("scaleToZoom", () => {
    it("should convert scale to zoom", () => {
      expect(scaleToZoom(1)).toBe(100);
      expect(scaleToZoom(0.5)).toBe(50);
      expect(scaleToZoom(2)).toBe(200);
      expect(scaleToZoom(0.25)).toBe(25);
    });
  });

  describe("formatZoom", () => {
    it("should format zoom as percentage", () => {
      expect(formatZoom(100)).toBe("100%");
      expect(formatZoom(75)).toBe("75%");
      expect(formatZoom(150)).toBe("150%");
    });

    it("should round decimals", () => {
      expect(formatZoom(99.5)).toBe("100%");
      expect(formatZoom(74.4)).toBe("74%");
    });
  });

  describe("getClosestPreset", () => {
    it("should return exact preset", () => {
      expect(getClosestPreset(100)).toBe(100);
      expect(getClosestPreset(75)).toBe(75);
    });

    it("should return closest preset", () => {
      expect(getClosestPreset(90)).toBe(100);
      expect(getClosestPreset(85)).toBe(75);
      expect(getClosestPreset(110)).toBe(100);
      expect(getClosestPreset(140)).toBe(150);
    });
  });

  describe("isPreset", () => {
    it("should return true for presets", () => {
      expect(isPreset(25)).toBe(true);
      expect(isPreset(100)).toBe(true);
      expect(isPreset(200)).toBe(true);
    });

    it("should return false for non-presets", () => {
      expect(isPreset(90)).toBe(false);
      expect(isPreset(110)).toBe(false);
      expect(isPreset(33)).toBe(false);
    });
  });
});

describe("constants", () => {
  describe("ZOOM_PRESETS", () => {
    it("should have expected presets", () => {
      expect(ZOOM_PRESETS).toEqual([25, 50, 75, 100, 125, 150, 175, 200]);
    });
  });

  describe("KEYBOARD_SHORTCUTS", () => {
    it("should have zoom shortcuts", () => {
      expect(KEYBOARD_SHORTCUTS.zoomIn).toContain("+");
      expect(KEYBOARD_SHORTCUTS.zoomIn).toContain("=");
      expect(KEYBOARD_SHORTCUTS.zoomOut).toContain("-");
      expect(KEYBOARD_SHORTCUTS.reset).toContain("0");
      expect(KEYBOARD_SHORTCUTS.fit).toContain("f");
    });
  });

  describe("ZOOM_CONTROLS_SCRIPT", () => {
    it("should be a non-empty string", () => {
      expect(typeof ZOOM_CONTROLS_SCRIPT).toBe("string");
      expect(ZOOM_CONTROLS_SCRIPT.length).toBeGreaterThan(100);
    });

    it("should contain wheel event handler", () => {
      expect(ZOOM_CONTROLS_SCRIPT).toContain("wheel");
    });

    it("should contain keyboard event handler", () => {
      expect(ZOOM_CONTROLS_SCRIPT).toContain("keydown");
    });

    it("should post messages to parent", () => {
      expect(ZOOM_CONTROLS_SCRIPT).toContain("postMessage");
      expect(ZOOM_CONTROLS_SCRIPT).toContain("PLATXA_ZOOM");
    });
  });
});
