/**
 * Tests for DeviceFrame — Device frame visualization around preview.
 *
 * Feature #85: Viewport toggle for desktop/tablet/mobile
 * Feature #86: Implement device frame visualization around preview
 * Verification: iPhone/iPad/MacBook frames wrap preview at appropriate sizes
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEVICE_SPECS } from "@/components/preview/DeviceFrame";
import type { DeviceType } from "@/components/preview/DeviceFrame";
import {
  DeviceFrame,
  createDeviceFrame,
  IPHONE_DEVICES,
  IPAD_DEVICES,
  MACBOOK_DEVICES,
  DESKTOP_DEVICES,
  ALL_DEVICES,
  DEFAULT_DEVICE,
  getDevice,
  getDevicesByCategory,
  getScreenDimensions,
  getFrameDimensions,
  calculateFitScale,
  type DeviceDefinition,
} from "../../lib/preview/device-frame";

// =============================================================================
// Feature #85: Viewport Toggle Tests (existing)
// =============================================================================

describe("DeviceFrame Component (Feature #85)", () => {
  describe("viewport toggle for desktop/tablet/mobile", () => {
    it("toggle buttons resize iframe to 1024px desktop width", () => {
      expect(DEVICE_SPECS.desktop.width).toBe("100%");
      expect(DEVICE_SPECS.desktop.mediaQuery).toContain("1024px");
    });

    it("toggle buttons resize iframe to 768px tablet width", () => {
      expect(DEVICE_SPECS.tablet.width).toBe(768);
    });

    it("toggle buttons resize iframe to 375px mobile width", () => {
      expect(DEVICE_SPECS.mobile.width).toBe(375);
    });
  });

  describe("DEVICE_SPECS", () => {
    it("defines mobile at 375x667", () => {
      expect(DEVICE_SPECS.mobile.width).toBe(375);
      expect(DEVICE_SPECS.mobile.height).toBe(667);
    });

    it("defines tablet at 768x1024", () => {
      expect(DEVICE_SPECS.tablet.width).toBe(768);
      expect(DEVICE_SPECS.tablet.height).toBe(1024);
    });

    it("defines desktop at 100%", () => {
      expect(DEVICE_SPECS.desktop.width).toBe("100%");
      expect(DEVICE_SPECS.desktop.height).toBe("100%");
    });

    it("has labels for all devices", () => {
      expect(DEVICE_SPECS.mobile.label).toBeTruthy();
      expect(DEVICE_SPECS.tablet.label).toBeTruthy();
      expect(DEVICE_SPECS.desktop.label).toBeTruthy();
    });

    it("has media queries for all devices", () => {
      expect(DEVICE_SPECS.mobile.mediaQuery).toContain("max-width");
      expect(DEVICE_SPECS.tablet.mediaQuery).toContain("min-width");
      expect(DEVICE_SPECS.desktop.mediaQuery).toContain("min-width");
    });

    it("covers all three device types", () => {
      const types: DeviceType[] = ["mobile", "tablet", "desktop"];
      for (const type of types) {
        expect(DEVICE_SPECS[type]).toBeDefined();
        expect(DEVICE_SPECS[type].width).toBeDefined();
        expect(DEVICE_SPECS[type].height).toBeDefined();
      }
    });

    it("mobile and tablet have numeric dimensions", () => {
      expect(typeof DEVICE_SPECS.mobile.width).toBe("number");
      expect(typeof DEVICE_SPECS.mobile.height).toBe("number");
      expect(typeof DEVICE_SPECS.tablet.width).toBe("number");
      expect(typeof DEVICE_SPECS.tablet.height).toBe("number");
    });
  });
});

// =============================================================================
// Feature #86: Device Frame Visualization Tests
// =============================================================================

describe("Device Catalog (Feature #86)", () => {
  describe("IPHONE_DEVICES", () => {
    it("contains iPhone device definitions", () => {
      expect(IPHONE_DEVICES.length).toBeGreaterThan(0);
      expect(IPHONE_DEVICES.every((d) => d.category === "phone")).toBe(true);
    });

    it("includes iPhone 15 Pro with correct dimensions", () => {
      const iphone15Pro = IPHONE_DEVICES.find((d) => d.id === "iphone-15-pro");
      expect(iphone15Pro).toBeDefined();
      expect(iphone15Pro?.name).toBe("iPhone 15 Pro");
      expect(iphone15Pro?.screenWidth).toBe(393);
      expect(iphone15Pro?.screenHeight).toBe(852);
    });

    it("includes iPhone 14", () => {
      const iphone14 = IPHONE_DEVICES.find((d) => d.id === "iphone-14");
      expect(iphone14).toBeDefined();
      expect(iphone14?.screenWidth).toBe(390);
    });

    it("includes iPhone SE with no rounded corners", () => {
      const iphoneSE = IPHONE_DEVICES.find((d) => d.id === "iphone-se");
      expect(iphoneSE).toBeDefined();
      expect(iphoneSE?.screenBorderRadius).toBe(0);
    });

    it("all iPhones support landscape", () => {
      expect(IPHONE_DEVICES.every((d) => d.supportsLandscape)).toBe(true);
    });
  });

  describe("IPAD_DEVICES", () => {
    it("contains iPad device definitions", () => {
      expect(IPAD_DEVICES.length).toBeGreaterThan(0);
      expect(IPAD_DEVICES.every((d) => d.category === "tablet")).toBe(true);
    });

    it('includes iPad Pro 12.9"', () => {
      const ipadPro12 = IPAD_DEVICES.find((d) => d.id === "ipad-pro-12");
      expect(ipadPro12).toBeDefined();
      expect(ipadPro12?.screenWidth).toBe(1024);
      expect(ipadPro12?.screenHeight).toBe(1366);
    });

    it("includes iPad Air with gold color option", () => {
      const ipadAir = IPAD_DEVICES.find((d) => d.id === "ipad-air");
      expect(ipadAir).toBeDefined();
      expect(ipadAir?.colors).toContain("gold");
    });

    it("all iPads support landscape", () => {
      expect(IPAD_DEVICES.every((d) => d.supportsLandscape)).toBe(true);
    });
  });

  describe("MACBOOK_DEVICES", () => {
    it("contains MacBook device definitions", () => {
      expect(MACBOOK_DEVICES.length).toBeGreaterThan(0);
      expect(MACBOOK_DEVICES.every((d) => d.category === "laptop")).toBe(true);
    });

    it('includes MacBook Pro 16"', () => {
      const macbookPro16 = MACBOOK_DEVICES.find((d) => d.id === "macbook-pro-16");
      expect(macbookPro16).toBeDefined();
      expect(macbookPro16?.screenWidth).toBe(1728);
      expect(macbookPro16?.screenHeight).toBe(1117);
    });

    it("MacBooks do not support landscape rotation", () => {
      expect(MACBOOK_DEVICES.every((d) => !d.supportsLandscape)).toBe(true);
    });
  });

  describe("DESKTOP_DEVICES", () => {
    it("contains desktop device definitions", () => {
      expect(DESKTOP_DEVICES.length).toBeGreaterThan(0);
      expect(DESKTOP_DEVICES.every((d) => d.category === "desktop")).toBe(true);
    });

    it("includes 1920x1080 desktop", () => {
      const desktop1920 = DESKTOP_DEVICES.find((d) => d.id === "desktop-1920");
      expect(desktop1920).toBeDefined();
      expect(desktop1920?.screenWidth).toBe(1920);
      expect(desktop1920?.screenHeight).toBe(1080);
    });

    it("desktops have 1x pixel ratio", () => {
      expect(DESKTOP_DEVICES.every((d) => d.devicePixelRatio === 1)).toBe(true);
    });
  });

  describe("ALL_DEVICES", () => {
    it("combines all device arrays", () => {
      const expectedCount =
        IPHONE_DEVICES.length +
        IPAD_DEVICES.length +
        MACBOOK_DEVICES.length +
        DESKTOP_DEVICES.length;
      expect(ALL_DEVICES.length).toBe(expectedCount);
    });

    it("contains devices from all categories", () => {
      const categories = new Set(ALL_DEVICES.map((d) => d.category));
      expect(categories.has("phone")).toBe(true);
      expect(categories.has("tablet")).toBe(true);
      expect(categories.has("laptop")).toBe(true);
      expect(categories.has("desktop")).toBe(true);
    });
  });

  describe("DEFAULT_DEVICE", () => {
    it("is iPhone 15 Pro", () => {
      expect(DEFAULT_DEVICE.id).toBe("iphone-15-pro");
    });
  });
});

describe("Utility Functions (Feature #86)", () => {
  describe("getDevice", () => {
    it("finds device by ID", () => {
      const device = getDevice("iphone-15-pro");
      expect(device?.id).toBe("iphone-15-pro");
    });

    it("returns undefined for unknown ID", () => {
      expect(getDevice("unknown-device")).toBeUndefined();
    });

    it("searches custom devices array", () => {
      const customDevices: DeviceDefinition[] = [
        {
          id: "custom-phone",
          name: "Custom Phone",
          category: "phone",
          screenWidth: 400,
          screenHeight: 800,
          devicePixelRatio: 2,
          frameWidth: 440,
          frameHeight: 840,
          screenOffsetTop: 20,
          screenOffsetLeft: 20,
          screenBorderRadius: 20,
          supportsLandscape: true,
          colors: ["black"],
        },
      ];
      const device = getDevice("custom-phone", customDevices);
      expect(device?.name).toBe("Custom Phone");
    });
  });

  describe("getDevicesByCategory", () => {
    it("filters devices by phone category", () => {
      const phones = getDevicesByCategory("phone");
      expect(phones.length).toBe(IPHONE_DEVICES.length);
      expect(phones.every((d) => d.category === "phone")).toBe(true);
    });

    it("filters devices by tablet category", () => {
      expect(getDevicesByCategory("tablet").length).toBe(IPAD_DEVICES.length);
    });

    it("filters devices by laptop category", () => {
      expect(getDevicesByCategory("laptop").length).toBe(MACBOOK_DEVICES.length);
    });

    it("filters devices by desktop category", () => {
      expect(getDevicesByCategory("desktop").length).toBe(DESKTOP_DEVICES.length);
    });
  });

  describe("getScreenDimensions", () => {
    const iphone = IPHONE_DEVICES[0];
    const macbook = MACBOOK_DEVICES[0];

    it("returns portrait dimensions in portrait mode", () => {
      const dims = getScreenDimensions(iphone, "portrait");
      expect(dims.width).toBe(iphone.screenWidth);
      expect(dims.height).toBe(iphone.screenHeight);
    });

    it("swaps dimensions in landscape mode for supported devices", () => {
      const dims = getScreenDimensions(iphone, "landscape");
      expect(dims.width).toBe(iphone.screenHeight);
      expect(dims.height).toBe(iphone.screenWidth);
    });

    it("keeps portrait dimensions for non-landscape devices", () => {
      const dims = getScreenDimensions(macbook, "landscape");
      expect(dims.width).toBe(macbook.screenWidth);
      expect(dims.height).toBe(macbook.screenHeight);
    });
  });

  describe("getFrameDimensions", () => {
    const iphone = IPHONE_DEVICES[0];

    it("returns frame dimensions in portrait mode", () => {
      const dims = getFrameDimensions(iphone, "portrait");
      expect(dims.width).toBe(iphone.frameWidth);
      expect(dims.height).toBe(iphone.frameHeight);
    });

    it("swaps frame dimensions in landscape mode", () => {
      const dims = getFrameDimensions(iphone, "landscape");
      expect(dims.width).toBe(iphone.frameHeight);
      expect(dims.height).toBe(iphone.frameWidth);
    });
  });

  describe("calculateFitScale", () => {
    const iphone = IPHONE_DEVICES[0];

    it("calculates scale to fit container", () => {
      const scale = calculateFitScale(iphone, "portrait", 500, 1000, 40);
      expect(scale).toBeLessThanOrEqual(1);
      expect(scale).toBeGreaterThan(0);
    });

    it("does not scale up beyond 100%", () => {
      const scale = calculateFitScale(iphone, "portrait", 2000, 3000, 40);
      expect(scale).toBe(1);
    });

    it("scales down for small containers", () => {
      const scale = calculateFitScale(iphone, "portrait", 200, 400, 20);
      expect(scale).toBeLessThan(1);
    });

    it("considers padding in calculation", () => {
      const scaleLarge = calculateFitScale(iphone, "portrait", 500, 1000, 100);
      const scaleSmall = calculateFitScale(iphone, "portrait", 500, 1000, 20);
      expect(scaleLarge).toBeLessThan(scaleSmall);
    });
  });
});

describe("DeviceFrame Class (Feature #86)", () => {
  describe("constructor", () => {
    it("creates instance with default options", () => {
      const frame = new DeviceFrame();
      expect(frame.getDevice().id).toBe("iphone-15-pro");
      expect(frame.getOrientation()).toBe("portrait");
      expect(frame.getScale()).toBe(1);
      expect(frame.isFrameVisible()).toBe(true);
    });

    it("accepts deviceId option", () => {
      const frame = new DeviceFrame({ deviceId: "ipad-air" });
      expect(frame.getDevice().id).toBe("ipad-air");
    });

    it("accepts orientation option", () => {
      const frame = new DeviceFrame({ orientation: "landscape" });
      expect(frame.getOrientation()).toBe("landscape");
    });

    it("accepts scale option", () => {
      const frame = new DeviceFrame({ scale: 0.75 });
      expect(frame.getScale()).toBe(0.75);
    });

    it("accepts showFrame option", () => {
      const frame = new DeviceFrame({ showFrame: false });
      expect(frame.isFrameVisible()).toBe(false);
    });

    it("accepts custom devices", () => {
      const customDevice: DeviceDefinition = {
        id: "custom-device",
        name: "Custom Device",
        category: "phone",
        screenWidth: 400,
        screenHeight: 800,
        devicePixelRatio: 2,
        frameWidth: 440,
        frameHeight: 840,
        screenOffsetTop: 20,
        screenOffsetLeft: 20,
        screenBorderRadius: 20,
        supportsLandscape: true,
        colors: ["black", "white"],
      };
      const frame = new DeviceFrame({
        deviceId: "custom-device",
        customDevices: [customDevice],
      });
      expect(frame.getDevice().id).toBe("custom-device");
    });

    it("falls back to default device for unknown ID", () => {
      const frame = new DeviceFrame({ deviceId: "unknown-device" });
      expect(frame.getDevice().id).toBe(DEFAULT_DEVICE.id);
    });
  });

  describe("device selection", () => {
    let frame: DeviceFrame;

    beforeEach(() => {
      frame = new DeviceFrame();
    });

    it("setDevice changes the current device", () => {
      const result = frame.setDevice("ipad-air");
      expect(result).toBe(true);
      expect(frame.getDevice().id).toBe("ipad-air");
    });

    it("setDevice returns false for unknown device", () => {
      const result = frame.setDevice("unknown");
      expect(result).toBe(false);
      expect(frame.getDevice().id).toBe("iphone-15-pro");
    });

    it("setDevice resets orientation if new device doesn't support landscape", () => {
      frame.setOrientation("landscape");
      expect(frame.getOrientation()).toBe("landscape");
      frame.setDevice("macbook-pro-16");
      expect(frame.getOrientation()).toBe("portrait");
    });

    it("setDevice resets color if not available on new device", () => {
      frame.setDevice("ipad-air");
      frame.setColor("gold");
      expect(frame.getColor()).toBe("gold");
      frame.setDevice("iphone-15-pro");
      expect(frame.getColor()).not.toBe("gold");
    });

    it("getDevices returns all available devices", () => {
      expect(frame.getDevices().length).toBe(ALL_DEVICES.length);
    });

    it("getDevicesByCategory filters correctly", () => {
      const tablets = frame.getDevicesByCategory("tablet");
      expect(tablets.length).toBe(IPAD_DEVICES.length);
      expect(tablets.every((d) => d.category === "tablet")).toBe(true);
    });
  });

  describe("orientation", () => {
    let frame: DeviceFrame;

    beforeEach(() => {
      frame = new DeviceFrame();
    });

    it("setOrientation changes orientation", () => {
      expect(frame.setOrientation("landscape")).toBe(true);
      expect(frame.getOrientation()).toBe("landscape");
    });

    it("setOrientation returns false for unsupported landscape", () => {
      frame.setDevice("macbook-pro-16");
      expect(frame.setOrientation("landscape")).toBe(false);
      expect(frame.getOrientation()).toBe("portrait");
    });

    it("toggleOrientation switches between portrait and landscape", () => {
      expect(frame.getOrientation()).toBe("portrait");
      frame.toggleOrientation();
      expect(frame.getOrientation()).toBe("landscape");
      frame.toggleOrientation();
      expect(frame.getOrientation()).toBe("portrait");
    });

    it("toggleOrientation returns false for non-landscape devices", () => {
      frame.setDevice("macbook-pro-16");
      expect(frame.toggleOrientation()).toBe(false);
    });
  });

  describe("color", () => {
    let frame: DeviceFrame;

    beforeEach(() => {
      frame = new DeviceFrame();
    });

    it("setColor changes color", () => {
      expect(frame.setColor("silver")).toBe(true);
      expect(frame.getColor()).toBe("silver");
    });

    it("setColor returns false for unavailable color", () => {
      expect(frame.setColor("gold")).toBe(false);
    });

    it("getAvailableColors returns device colors", () => {
      expect(frame.getAvailableColors()).toEqual(frame.getDevice().colors);
    });
  });

  describe("scale", () => {
    let frame: DeviceFrame;

    beforeEach(() => {
      frame = new DeviceFrame();
    });

    it("setScale changes scale", () => {
      frame.setScale(0.5);
      expect(frame.getScale()).toBe(0.5);
    });

    it("setScale clamps to minimum 0.1", () => {
      frame.setScale(0);
      expect(frame.getScale()).toBe(0.1);
    });

    it("setScale clamps to maximum 2", () => {
      frame.setScale(5);
      expect(frame.getScale()).toBe(2);
    });

    it("fitToContainer calculates and sets scale", () => {
      frame.fitToContainer(500, 1000, 40);
      expect(frame.getScale()).toBeLessThanOrEqual(1);
    });
  });

  describe("frame visibility", () => {
    it("setShowFrame changes visibility", () => {
      const frame = new DeviceFrame();
      frame.setShowFrame(false);
      expect(frame.isFrameVisible()).toBe(false);
      frame.setShowFrame(true);
      expect(frame.isFrameVisible()).toBe(true);
    });
  });

  describe("dimensions", () => {
    let frame: DeviceFrame;

    beforeEach(() => {
      frame = new DeviceFrame();
    });

    it("getScreenDimensions returns current screen size", () => {
      const dims = frame.getScreenDimensions();
      expect(dims.width).toBe(393);
      expect(dims.height).toBe(852);
    });

    it("getScreenDimensions swaps in landscape", () => {
      frame.setOrientation("landscape");
      const dims = frame.getScreenDimensions();
      expect(dims.width).toBe(852);
      expect(dims.height).toBe(393);
    });

    it("getFrameDimensions returns current frame size", () => {
      const dims = frame.getFrameDimensions();
      expect(dims.width).toBe(433);
      expect(dims.height).toBe(892);
    });

    it("getScaledDimensions applies scale factor", () => {
      frame.setScale(0.5);
      const scaled = frame.getScaledDimensions();
      expect(scaled.screen.width).toBe(Math.round(393 * 0.5));
      expect(scaled.screen.height).toBe(Math.round(852 * 0.5));
    });
  });

  describe("frame styles", () => {
    let frame: DeviceFrame;

    beforeEach(() => {
      frame = new DeviceFrame();
    });

    it("getFrameStyles returns all style objects", () => {
      const styles = frame.getFrameStyles();
      expect(styles.container).toBeDefined();
      expect(styles.frame).toBeDefined();
      expect(styles.screen).toBeDefined();
    });

    it("styles include correct dimensions", () => {
      const styles = frame.getFrameStyles();
      expect(styles.frame.width).toBe("433px");
      expect(styles.frame.height).toBe("892px");
      expect(styles.screen.width).toBe("393px");
      expect(styles.screen.height).toBe("852px");
    });

    it("styles apply scale factor", () => {
      frame.setScale(0.5);
      const styles = frame.getFrameStyles();
      expect(styles.frame.width).toBe(`${433 * 0.5}px`);
      expect(styles.screen.width).toBe(`${393 * 0.5}px`);
    });

    it("styles include notch for modern iPhones", () => {
      const styles = frame.getFrameStyles();
      expect(styles.notch).toBeDefined();
      expect(styles.homeIndicator).toBeDefined();
    });

    it("styles exclude notch for iPhone SE", () => {
      frame.setDevice("iphone-se");
      const styles = frame.getFrameStyles();
      expect(styles.notch).toBeUndefined();
      expect(styles.homeIndicator).toBeUndefined();
    });

    it("styles show transparent background when frame hidden", () => {
      frame.setShowFrame(false);
      const styles = frame.getFrameStyles();
      expect(styles.frame["background-color"]).toBe("transparent");
      expect(styles.frame["box-shadow"]).toBe("none");
    });

    it("styles apply color correctly", () => {
      frame.setColor("silver");
      const styles = frame.getFrameStyles();
      expect(styles.frame["background-color"]).toBe("#e3e3e8");
    });

    it("styles handle landscape orientation", () => {
      frame.setOrientation("landscape");
      const styles = frame.getFrameStyles();
      expect(styles.frame.width).toBe("892px");
      expect(styles.frame.height).toBe("433px");
    });
  });

  describe("state", () => {
    it("getState returns full state object", () => {
      const frame = new DeviceFrame({
        deviceId: "ipad-air",
        orientation: "landscape",
        color: "gold",
        scale: 0.75,
        showFrame: false,
      });

      const state = frame.getState();
      expect(state.device.id).toBe("ipad-air");
      expect(state.orientation).toBe("landscape");
      expect(state.color).toBe("gold");
      expect(state.scale).toBe(0.75);
      expect(state.showFrame).toBe(false);
    });

    it("getState returns a copy", () => {
      const frame = new DeviceFrame();
      const state1 = frame.getState();
      const state2 = frame.getState();
      expect(state1).not.toBe(state2);
    });
  });

  describe("events", () => {
    let frame: DeviceFrame;

    beforeEach(() => {
      frame = new DeviceFrame();
    });

    it("onChange is called when device changes", () => {
      const callback = vi.fn();
      frame.onChange(callback);
      frame.setDevice("ipad-air");
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          device: expect.objectContaining({ id: "ipad-air" }),
        })
      );
    });

    it("onChange is called when orientation changes", () => {
      const callback = vi.fn();
      frame.onChange(callback);
      frame.setOrientation("landscape");
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ orientation: "landscape" })
      );
    });

    it("onChange is called when scale changes", () => {
      const callback = vi.fn();
      frame.onChange(callback);
      frame.setScale(0.5);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ scale: 0.5 })
      );
    });

    it("onChange unsubscribe works", () => {
      const callback = vi.fn();
      const unsubscribe = frame.onChange(callback);
      frame.setScale(0.5);
      expect(callback).toHaveBeenCalledTimes(1);
      unsubscribe();
      frame.setScale(0.75);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("callback errors are caught", () => {
      const errorCallback = vi.fn(() => {
        throw new Error("Test error");
      });
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      frame.onChange(errorCallback);
      frame.setScale(0.5);
      expect(errorCallback).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("dispose", () => {
    it("clears all callbacks", () => {
      const frame = new DeviceFrame();
      const callback = vi.fn();
      frame.onChange(callback);
      frame.dispose();
      frame.setScale(0.5);
      expect(callback).not.toHaveBeenCalled();
    });

    it("is idempotent", () => {
      const frame = new DeviceFrame();
      frame.dispose();
      frame.dispose(); // Should not throw
    });
  });
});

describe("createDeviceFrame Factory", () => {
  it("creates DeviceFrame instance", () => {
    const frame = createDeviceFrame();
    expect(frame).toBeInstanceOf(DeviceFrame);
  });

  it("passes options to constructor", () => {
    const frame = createDeviceFrame({
      deviceId: "ipad-air",
      scale: 0.5,
    });
    expect(frame.getDevice().id).toBe("ipad-air");
    expect(frame.getScale()).toBe(0.5);
  });
});

describe("Integration: iPhone/iPad/MacBook frames wrap preview (Feature #86)", () => {
  it("iPhone frame wraps preview at appropriate size", () => {
    const frame = createDeviceFrame({ deviceId: "iphone-15-pro" });
    const styles = frame.getFrameStyles();
    expect(styles.screen.width).toBe("393px");
    expect(styles.screen.height).toBe("852px");
    expect(parseInt(styles.frame.width)).toBeGreaterThan(parseInt(styles.screen.width));
  });

  it("iPad frame wraps preview at appropriate size", () => {
    const frame = createDeviceFrame({ deviceId: "ipad-pro-12" });
    const styles = frame.getFrameStyles();
    expect(styles.screen.width).toBe("1024px");
    expect(styles.screen.height).toBe("1366px");
  });

  it("MacBook frame wraps preview at appropriate size", () => {
    const frame = createDeviceFrame({ deviceId: "macbook-pro-16" });
    const styles = frame.getFrameStyles();
    expect(styles.screen.width).toBe("1728px");
    expect(styles.screen.height).toBe("1117px");
  });

  it("switching devices updates all dimensions correctly", () => {
    const frame = createDeviceFrame();
    expect(frame.getScreenDimensions().width).toBe(393);
    frame.setDevice("ipad-air");
    expect(frame.getScreenDimensions().width).toBe(820);
    frame.setDevice("macbook-air-13");
    expect(frame.getScreenDimensions().width).toBe(1470);
    frame.setDevice("desktop-1920");
    expect(frame.getScreenDimensions().width).toBe(1920);
  });

  it("responsive scaling fits device to container", () => {
    const frame = createDeviceFrame({ deviceId: "macbook-pro-16" });
    frame.fitToContainer(2000, 1500);
    expect(frame.getScale()).toBe(1);
    frame.fitToContainer(800, 600);
    expect(frame.getScale()).toBeLessThan(1);
    const scaled = frame.getScaledDimensions();
    expect(scaled.frame.width).toBeLessThanOrEqual(800 - 80);
    expect(scaled.frame.height).toBeLessThanOrEqual(600 - 80);
  });
});
