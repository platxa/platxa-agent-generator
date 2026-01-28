import { describe, it, expect } from "vitest";
import {
  DEFAULT_VR_CONFIG,
  createVRState,
  captureBaseline,
  getBaseline,
  getBaselinePageIds,
  removeBaseline,
  comparePixels,
  compareWithBaseline,
  getHistory,
  getPassRate,
} from "@/lib/agent-bridge/visual-regression";
import type { PixelData } from "@/lib/agent-bridge/visual-regression";

/** Creates a solid-color pixel buffer. */
function solidPixels(w: number, h: number, r: number, g: number, b: number, a = 255): PixelData {
  const data: number[] = [];
  for (let i = 0; i < w * h; i++) {
    data.push(r, g, b, a);
  }
  return { width: w, height: h, data };
}

/** Creates pixels with a specific pixel changed. */
function withPixelChanged(
  base: PixelData,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
): PixelData {
  const data = [...base.data];
  const idx = (y * base.width + x) * 4;
  data[idx] = r;
  data[idx + 1] = g;
  data[idx + 2] = b;
  return { ...base, data };
}

describe("Visual Regression", () => {
  const now = 1000000;

  describe("DEFAULT_VR_CONFIG", () => {
    it("has 5% threshold", () => {
      expect(DEFAULT_VR_CONFIG.diffThreshold).toBe(5);
      expect(DEFAULT_VR_CONFIG.colorTolerance).toBe(10);
      expect(DEFAULT_VR_CONFIG.antiAliasing).toBe(true);
    });
  });

  describe("createVRState", () => {
    it("creates empty state", () => {
      const state = createVRState();
      expect(state.baselines.size).toBe(0);
      expect(state.history).toHaveLength(0);
    });

    it("accepts custom config", () => {
      const state = createVRState({ diffThreshold: 10 });
      expect(state.config.diffThreshold).toBe(10);
      expect(state.config.colorTolerance).toBe(10); // default preserved
    });
  });

  describe("captureBaseline", () => {
    it("stores baseline for page", () => {
      const pixels = solidPixels(10, 10, 255, 0, 0);
      const state = captureBaseline(createVRState(), "home", pixels, { width: 1024, height: 768 }, now);
      expect(state.baselines.size).toBe(1);
      const bl = getBaseline(state, "home");
      expect(bl).toBeDefined();
      expect(bl!.pageId).toBe("home");
      expect(bl!.capturedAt).toBe(now);
    });

    it("overwrites existing baseline", () => {
      const px1 = solidPixels(10, 10, 255, 0, 0);
      const px2 = solidPixels(10, 10, 0, 255, 0);
      let state = captureBaseline(createVRState(), "home", px1, { width: 1024, height: 768 }, now);
      state = captureBaseline(state, "home", px2, { width: 1024, height: 768 }, now + 1000);
      expect(state.baselines.size).toBe(1);
      expect(getBaseline(state, "home")!.capturedAt).toBe(now + 1000);
    });

    it("does not mutate input state", () => {
      const original = createVRState();
      captureBaseline(original, "home", solidPixels(2, 2, 0, 0, 0), { width: 100, height: 100 });
      expect(original.baselines.size).toBe(0);
    });
  });

  describe("getBaselinePageIds", () => {
    it("returns all page IDs", () => {
      const px = solidPixels(2, 2, 0, 0, 0);
      const vp = { width: 100, height: 100 };
      let state = createVRState();
      state = captureBaseline(state, "home", px, vp);
      state = captureBaseline(state, "about", px, vp);
      expect(getBaselinePageIds(state)).toEqual(["home", "about"]);
    });
  });

  describe("removeBaseline", () => {
    it("removes a baseline", () => {
      const px = solidPixels(2, 2, 0, 0, 0);
      let state = captureBaseline(createVRState(), "home", px, { width: 100, height: 100 });
      state = removeBaseline(state, "home");
      expect(state.baselines.size).toBe(0);
    });
  });

  describe("comparePixels", () => {
    it("returns 0% diff for identical images", () => {
      const px = solidPixels(10, 10, 128, 128, 128);
      const diff = comparePixels(px, px);
      expect(diff.diffPercentage).toBe(0);
      expect(diff.withinThreshold).toBe(true);
      expect(diff.changedPixels).toHaveLength(0);
    });

    it("detects changed pixels", () => {
      const base = solidPixels(10, 10, 100, 100, 100);
      const changed = withPixelChanged(base, 5, 5, 255, 0, 0);
      const diff = comparePixels(base, changed, { ...DEFAULT_VR_CONFIG, antiAliasing: false });
      expect(diff.diffPixelCount).toBeGreaterThan(0);
      expect(diff.changedPixels.length).toBeGreaterThan(0);
    });

    it("ignores changes within color tolerance", () => {
      const base = solidPixels(10, 10, 100, 100, 100);
      // Change by only 5 (within default tolerance of 10)
      const changed = withPixelChanged(base, 5, 5, 105, 100, 100);
      const diff = comparePixels(base, changed);
      expect(diff.diffPixelCount).toBe(0);
    });

    it("reports within threshold for small diff", () => {
      const base = solidPixels(100, 100, 200, 200, 200);
      // Change 1 pixel out of 10000 = 0.01%
      const changed = withPixelChanged(base, 0, 0, 0, 0, 0);
      const diff = comparePixels(base, changed, { ...DEFAULT_VR_CONFIG, antiAliasing: false });
      expect(diff.withinThreshold).toBe(true);
      expect(diff.diffPercentage).toBeLessThan(5);
    });

    it("reports exceeding threshold for large diff", () => {
      // 10x10 = 100 pixels. Change 10 = 10%
      const base = solidPixels(10, 10, 200, 200, 200);
      const data = [...base.data];
      for (let i = 0; i < 10; i++) {
        const idx = i * 4;
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
      }
      const changed: PixelData = { ...base, data };
      const diff = comparePixels(base, changed, { ...DEFAULT_VR_CONFIG, antiAliasing: false });
      expect(diff.diffPercentage).toBeGreaterThan(5);
      expect(diff.withinThreshold).toBe(false);
    });

    it("handles different-sized images", () => {
      const small = solidPixels(5, 5, 100, 100, 100);
      const big = solidPixels(10, 10, 100, 100, 100);
      const diff = comparePixels(small, big);
      // Size difference adds extra pixels to diff
      expect(diff.totalPixels).toBe(100); // max area
      expect(diff.diffPixelCount).toBe(75); // 100 - 25
    });

    it("uses configured threshold", () => {
      const base = solidPixels(10, 10, 200, 200, 200);
      const data = [...base.data];
      // Change 2 out of 100 = 2%
      for (let i = 0; i < 2; i++) {
        data[i * 4] = 0;
      }
      const changed: PixelData = { ...base, data };
      const strictConfig = { ...DEFAULT_VR_CONFIG, diffThreshold: 1, antiAliasing: false };
      const diff = comparePixels(base, changed, strictConfig);
      expect(diff.withinThreshold).toBe(false);
      expect(diff.threshold).toBe(1);
    });
  });

  describe("compareWithBaseline", () => {
    it("returns null when no baseline exists", () => {
      const { result } = compareWithBaseline(createVRState(), "home", solidPixels(2, 2, 0, 0, 0));
      expect(result).toBeNull();
    });

    it("compares against stored baseline", () => {
      const px = solidPixels(10, 10, 128, 128, 128);
      let state = captureBaseline(createVRState(), "home", px, { width: 100, height: 100 }, now);
      const { result } = compareWithBaseline(state, "home", px, now + 1000);
      expect(result).not.toBeNull();
      expect(result!.pass).toBe(true);
      expect(result!.diff.diffPercentage).toBe(0);
    });

    it("records comparison in history", () => {
      const px = solidPixels(10, 10, 128, 128, 128);
      let state = captureBaseline(createVRState(), "home", px, { width: 100, height: 100 }, now);
      ({ state } = compareWithBaseline(state, "home", px, now + 1000));
      expect(state.history).toHaveLength(1);
    });

    it("does not mutate input state", () => {
      const px = solidPixels(10, 10, 128, 128, 128);
      const state = captureBaseline(createVRState(), "home", px, { width: 100, height: 100 }, now);
      compareWithBaseline(state, "home", px);
      expect(state.history).toHaveLength(0);
    });
  });

  describe("getHistory", () => {
    it("returns all history", () => {
      const px = solidPixels(5, 5, 100, 100, 100);
      const vp = { width: 100, height: 100 };
      let state = captureBaseline(createVRState(), "home", px, vp, now);
      state = captureBaseline(state, "about", px, vp, now);
      ({ state } = compareWithBaseline(state, "home", px));
      ({ state } = compareWithBaseline(state, "about", px));
      expect(getHistory(state)).toHaveLength(2);
    });

    it("filters by page ID", () => {
      const px = solidPixels(5, 5, 100, 100, 100);
      const vp = { width: 100, height: 100 };
      let state = captureBaseline(createVRState(), "home", px, vp, now);
      state = captureBaseline(state, "about", px, vp, now);
      ({ state } = compareWithBaseline(state, "home", px));
      ({ state } = compareWithBaseline(state, "about", px));
      expect(getHistory(state, "home")).toHaveLength(1);
    });
  });

  describe("getPassRate", () => {
    it("returns 1 for empty history", () => {
      expect(getPassRate(createVRState())).toBe(1);
    });

    it("computes pass rate", () => {
      const px = solidPixels(10, 10, 100, 100, 100);
      const vp = { width: 100, height: 100 };
      let state = createVRState({ antiAliasing: false });
      state = captureBaseline(state, "home", px, vp, now);

      // Pass
      ({ state } = compareWithBaseline(state, "home", px));
      expect(getPassRate(state)).toBe(1);

      // Fail: change >5% of pixels
      const data = [...px.data];
      for (let i = 0; i < 20; i++) { data[i * 4] = 0; }
      ({ state } = compareWithBaseline(state, "home", { ...px, data }));
      expect(getPassRate(state)).toBe(0.5);
    });
  });
});
