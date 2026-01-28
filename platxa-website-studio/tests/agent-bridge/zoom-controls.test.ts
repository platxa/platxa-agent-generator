import { describe, it, expect } from "vitest";
import {
  DEFAULT_ZOOM_CONFIG,
  createZoomState,
  setZoom,
  zoomIn,
  zoomOut,
  resetZoom,
  setPreset,
  snapToPreset,
  calculateFitZoom,
  fitToScreen,
  setPanelSize,
  setContentSize,
  getScaleFactor,
  canZoomIn,
  canZoomOut,
  getTransformCSS,
  getZoomLabel,
} from "@/lib/agent-bridge/zoom-controls";

describe("Zoom Controls", () => {
  describe("DEFAULT_ZOOM_CONFIG", () => {
    it("has expected presets", () => {
      expect(DEFAULT_ZOOM_CONFIG.presets).toEqual([25, 50, 75, 100, 150, 200]);
      expect(DEFAULT_ZOOM_CONFIG.minZoom).toBe(25);
      expect(DEFAULT_ZOOM_CONFIG.maxZoom).toBe(200);
    });
  });

  describe("createZoomState", () => {
    it("creates state at 100%", () => {
      const state = createZoomState();
      expect(state.zoom).toBe(100);
      expect(state.fitToScreen).toBe(false);
    });
  });

  describe("setZoom", () => {
    it("sets exact zoom", () => {
      expect(setZoom(createZoomState(), 50).zoom).toBe(50);
    });

    it("clamps to min", () => {
      expect(setZoom(createZoomState(), 10).zoom).toBe(25);
    });

    it("clamps to max", () => {
      expect(setZoom(createZoomState(), 300).zoom).toBe(200);
    });

    it("rounds to integer", () => {
      expect(setZoom(createZoomState(), 67.8).zoom).toBe(68);
    });

    it("clears fitToScreen", () => {
      const state = fitToScreen(createZoomState());
      expect(setZoom(state, 100).fitToScreen).toBe(false);
    });

    it("does not mutate input", () => {
      const state = createZoomState();
      setZoom(state, 50);
      expect(state.zoom).toBe(100);
    });
  });

  describe("zoomIn / zoomOut", () => {
    it("zooms in by step", () => {
      expect(zoomIn(createZoomState()).zoom).toBe(125);
    });

    it("zooms out by step", () => {
      expect(zoomOut(createZoomState()).zoom).toBe(75);
    });

    it("clamps at max", () => {
      const state = setZoom(createZoomState(), 200);
      expect(zoomIn(state).zoom).toBe(200);
    });

    it("clamps at min", () => {
      const state = setZoom(createZoomState(), 25);
      expect(zoomOut(state).zoom).toBe(25);
    });
  });

  describe("resetZoom", () => {
    it("resets to 100%", () => {
      expect(resetZoom(setZoom(createZoomState(), 50)).zoom).toBe(100);
    });
  });

  describe("setPreset", () => {
    it("sets to valid preset", () => {
      expect(setPreset(createZoomState(), 75).zoom).toBe(75);
    });

    it("ignores invalid preset", () => {
      const state = createZoomState();
      expect(setPreset(state, 33)).toBe(state);
    });
  });

  describe("snapToPreset", () => {
    it("snaps to nearest preset", () => {
      expect(snapToPreset(setZoom(createZoomState(), 68)).zoom).toBe(75);
      expect(snapToPreset(setZoom(createZoomState(), 110)).zoom).toBe(100);
      expect(snapToPreset(setZoom(createZoomState(), 130)).zoom).toBe(150);
    });
  });

  describe("calculateFitZoom", () => {
    it("calculates zoom to fit content in panel", () => {
      // Panel 1000x800, content 2000x1000, padding 0
      const zoom = calculateFitZoom(
        { width: 1000, height: 800 },
        { width: 2000, height: 1000 },
        0,
      );
      // scaleX = 1000/2000 = 0.5, scaleY = 800/1000 = 0.8 → min = 0.5 → 50%
      expect(zoom).toBe(50);
    });

    it("accounts for padding", () => {
      const zoom = calculateFitZoom(
        { width: 1000, height: 800 },
        { width: 1000, height: 800 },
        40,
      );
      // available = 920x720, content 1000x800 → scaleX=0.92, scaleY=0.9 → 90%
      expect(zoom).toBe(90);
    });

    it("handles zero content", () => {
      const zoom = calculateFitZoom(
        { width: 1000, height: 800 },
        { width: 0, height: 0 },
        0,
      );
      expect(zoom).toBeGreaterThan(0);
    });
  });

  describe("fitToScreen", () => {
    it("sets fitToScreen flag", () => {
      const state = fitToScreen(createZoomState());
      expect(state.fitToScreen).toBe(true);
    });

    it("calculates appropriate zoom", () => {
      const state = fitToScreen(
        createZoomState(
          {},
          { width: 800, height: 600 },
          { width: 1600, height: 900 },
        ),
      );
      // Available: 720x520, scaleX=0.45, scaleY=0.578 → 45%
      expect(state.zoom).toBeGreaterThanOrEqual(25);
      expect(state.zoom).toBeLessThanOrEqual(200);
    });

    it("clamps to min/max", () => {
      // Tiny panel, huge content → would be <25%, clamped
      const state = fitToScreen(
        createZoomState(
          {},
          { width: 100, height: 100 },
          { width: 10000, height: 10000 },
        ),
      );
      expect(state.zoom).toBe(25);
    });
  });

  describe("setPanelSize", () => {
    it("updates panel size", () => {
      const state = setPanelSize(createZoomState(), { width: 500, height: 400 });
      expect(state.panelSize).toEqual({ width: 500, height: 400 });
    });

    it("recalculates when in fit-to-screen mode", () => {
      let state = fitToScreen(createZoomState(
        {},
        { width: 800, height: 600 },
        { width: 1600, height: 900 },
      ));
      const prevZoom = state.zoom;
      state = setPanelSize(state, { width: 1600, height: 900 });
      expect(state.zoom).not.toBe(prevZoom);
      expect(state.fitToScreen).toBe(true);
    });
  });

  describe("setContentSize", () => {
    it("recalculates when in fit-to-screen mode", () => {
      let state = fitToScreen(createZoomState());
      const prevZoom = state.zoom;
      state = setContentSize(state, { width: 3000, height: 2000 });
      expect(state.zoom).not.toBe(prevZoom);
    });
  });

  describe("queries", () => {
    it("getScaleFactor returns decimal", () => {
      expect(getScaleFactor(createZoomState())).toBe(1);
      expect(getScaleFactor(setZoom(createZoomState(), 50))).toBe(0.5);
    });

    it("canZoomIn / canZoomOut", () => {
      expect(canZoomIn(createZoomState())).toBe(true);
      expect(canZoomOut(createZoomState())).toBe(true);
      expect(canZoomIn(setZoom(createZoomState(), 200))).toBe(false);
      expect(canZoomOut(setZoom(createZoomState(), 25))).toBe(false);
    });

    it("getTransformCSS returns valid CSS", () => {
      const css = getTransformCSS(setZoom(createZoomState(), 75));
      expect(css).toContain("scale(0.75)");
      expect(css).toContain("transform-origin");
    });

    it("getZoomLabel returns percentage string", () => {
      expect(getZoomLabel(createZoomState())).toBe("100%");
      expect(getZoomLabel(setZoom(createZoomState(), 50))).toBe("50%");
    });
  });
});
