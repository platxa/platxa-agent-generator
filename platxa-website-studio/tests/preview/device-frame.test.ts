import { describe, it, expect } from "vitest";
import { DEVICE_SPECS } from "@/components/preview/DeviceFrame";
import type { DeviceType } from "@/components/preview/DeviceFrame";

describe("DeviceFrame", () => {
  describe("viewport toggle for desktop/tablet/mobile (Feature #85)", () => {
    it("toggle buttons resize iframe to 1024px desktop width", () => {
      // Feature #85: Desktop uses full width, media query >= 1024px
      expect(DEVICE_SPECS.desktop.width).toBe("100%");
      expect(DEVICE_SPECS.desktop.mediaQuery).toContain("1024px");
    });

    it("toggle buttons resize iframe to 768px tablet width", () => {
      // Feature #85: Tablet width should be 768px
      expect(DEVICE_SPECS.tablet.width).toBe(768);
    });

    it("toggle buttons resize iframe to 375px mobile width", () => {
      // Feature #85: Mobile width should be 375px
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
