/**
 * Visual Regression Tests for Preview Components (Feature #186)
 *
 * Screenshot comparison tests for:
 * - Selection mode (hover/selected states, outlines, labels)
 * - Device frames (bezels, notches, orientations)
 * - Floating editor (panels, tabs, positioning)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createVRState,
  captureBaseline,
  compareWithBaseline,
  comparePixels,
  getBaseline,
  getHistory,
  getPassRate,
  type VisualRegressionState,
  type PixelData,
  type DiffResult,
  DEFAULT_VR_CONFIG,
} from '@/lib/agent-bridge/visual-regression';

// =============================================================================
// Test Fixtures - Mock Pixel Data Generators
// =============================================================================

/**
 * Creates mock pixel data with a solid color
 */
function createSolidPixelData(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
  a: number = 255
): PixelData {
  const data: number[] = [];
  for (let i = 0; i < width * height; i++) {
    data.push(r, g, b, a);
  }
  return { width, height, data };
}

/**
 * Creates mock pixel data with a rectangle (simulating an element)
 */
function createRectPixelData(
  width: number,
  height: number,
  rectX: number,
  rectY: number,
  rectW: number,
  rectH: number,
  bgColor: [number, number, number] = [255, 255, 255],
  rectColor: [number, number, number] = [0, 0, 0]
): PixelData {
  const data: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inRect =
        x >= rectX && x < rectX + rectW && y >= rectY && y < rectY + rectH;
      if (inRect) {
        data.push(rectColor[0], rectColor[1], rectColor[2], 255);
      } else {
        data.push(bgColor[0], bgColor[1], bgColor[2], 255);
      }
    }
  }
  return { width, height, data };
}

/**
 * Creates mock pixel data with an outline (simulating selection mode)
 */
function createOutlinePixelData(
  width: number,
  height: number,
  outlineX: number,
  outlineY: number,
  outlineW: number,
  outlineH: number,
  borderWidth: number = 2,
  bgColor: [number, number, number] = [255, 255, 255],
  outlineColor: [number, number, number] = [59, 130, 246] // #3b82f6 blue
): PixelData {
  const data: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Check if on outline border
      const inOutlineRect =
        x >= outlineX && x < outlineX + outlineW && y >= outlineY && y < outlineY + outlineH;
      const inInnerRect =
        x >= outlineX + borderWidth &&
        x < outlineX + outlineW - borderWidth &&
        y >= outlineY + borderWidth &&
        y < outlineY + outlineH - borderWidth;

      if (inOutlineRect && !inInnerRect) {
        data.push(outlineColor[0], outlineColor[1], outlineColor[2], 255);
      } else {
        data.push(bgColor[0], bgColor[1], bgColor[2], 255);
      }
    }
  }
  return { width, height, data };
}

/**
 * Creates mock device frame pixel data with bezel
 */
function createDeviceFramePixelData(
  width: number,
  height: number,
  bezelWidth: number = 20,
  bezelColor: [number, number, number] = [30, 30, 30], // Dark bezel
  screenColor: [number, number, number] = [255, 255, 255] // White screen
): PixelData {
  const data: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isBezel =
        x < bezelWidth ||
        x >= width - bezelWidth ||
        y < bezelWidth ||
        y >= height - bezelWidth;
      if (isBezel) {
        data.push(bezelColor[0], bezelColor[1], bezelColor[2], 255);
      } else {
        data.push(screenColor[0], screenColor[1], screenColor[2], 255);
      }
    }
  }
  return { width, height, data };
}

/**
 * Creates mock floating editor panel pixel data
 */
function createFloatingPanelPixelData(
  width: number,
  height: number,
  panelX: number,
  panelY: number,
  panelW: number,
  panelH: number,
  bgColor: [number, number, number] = [240, 240, 240],
  panelColor: [number, number, number] = [255, 255, 255],
  shadowColor: [number, number, number] = [200, 200, 200]
): PixelData {
  const data: number[] = [];
  const shadowOffset = 4;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Shadow (offset by shadowOffset)
      const inShadow =
        x >= panelX + shadowOffset &&
        x < panelX + panelW + shadowOffset &&
        y >= panelY + shadowOffset &&
        y < panelY + panelH + shadowOffset;

      // Panel
      const inPanel =
        x >= panelX && x < panelX + panelW && y >= panelY && y < panelY + panelH;

      if (inPanel) {
        data.push(panelColor[0], panelColor[1], panelColor[2], 255);
      } else if (inShadow) {
        data.push(shadowColor[0], shadowColor[1], shadowColor[2], 255);
      } else {
        data.push(bgColor[0], bgColor[1], bgColor[2], 255);
      }
    }
  }
  return { width, height, data };
}

// =============================================================================
// Visual Regression Tests: Selection Mode
// =============================================================================

describe('Visual Regression Tests for Preview (Feature #186)', () => {
  describe('Selection Mode Visual Regression', () => {
    let state: VisualRegressionState;

    beforeEach(() => {
      // Use strict threshold (1%) for selection mode tests
      // Outlines cover ~2% of 200x200 image, so 5% threshold wouldn't detect changes
      // Production-grade: small UI elements need stricter thresholds
      state = createVRState({ diffThreshold: 1, colorTolerance: 10 });
    });

    it('captures baseline for selection mode hover state', () => {
      // Simulate selection mode with blue outline on hover
      const hoverStatePixels = createOutlinePixelData(
        400,
        300,
        50,
        50,
        200,
        100,
        2,
        [255, 255, 255], // White background
        [59, 130, 246] // Blue outline #3b82f6
      );

      state = captureBaseline(
        state,
        'selection-mode-hover',
        hoverStatePixels,
        { width: 400, height: 300 }
      );

      const baseline = getBaseline(state, 'selection-mode-hover');
      expect(baseline).toBeDefined();
      expect(baseline!.pageId).toBe('selection-mode-hover');
      expect(baseline!.pixels.width).toBe(400);
      expect(baseline!.pixels.height).toBe(300);
    });

    it('captures baseline for selection mode selected state', () => {
      // Simulate selection mode with green outline when selected
      const selectedStatePixels = createOutlinePixelData(
        400,
        300,
        50,
        50,
        200,
        100,
        3, // Thicker border for selected
        [255, 255, 255],
        [16, 185, 129] // Green outline #10b981
      );

      state = captureBaseline(
        state,
        'selection-mode-selected',
        selectedStatePixels,
        { width: 400, height: 300 }
      );

      const baseline = getBaseline(state, 'selection-mode-selected');
      expect(baseline).toBeDefined();
    });

    it('detects visual regression when outline color changes', () => {
      // Baseline: blue outline
      const baselinePixels = createOutlinePixelData(
        200,
        200,
        20,
        20,
        100,
        100,
        2,
        [255, 255, 255],
        [59, 130, 246] // Blue
      );

      state = captureBaseline(state, 'outline-test', baselinePixels, {
        width: 200,
        height: 200,
      });

      // Current: red outline (regression!)
      const currentPixels = createOutlinePixelData(
        200,
        200,
        20,
        20,
        100,
        100,
        2,
        [255, 255, 255],
        [239, 68, 68] // Red - different color
      );

      const { result } = compareWithBaseline(state, 'outline-test', currentPixels);

      expect(result).not.toBeNull();
      expect(result!.pass).toBe(false); // Should fail - outline color changed
      expect(result!.diff.diffPercentage).toBeGreaterThan(0);
    });

    it('passes when selection mode visuals match baseline', () => {
      const pixels = createOutlinePixelData(200, 200, 20, 20, 100, 100, 2);

      state = captureBaseline(state, 'matching-test', pixels, {
        width: 200,
        height: 200,
      });

      const { result } = compareWithBaseline(state, 'matching-test', pixels);

      expect(result).not.toBeNull();
      expect(result!.pass).toBe(true);
      expect(result!.diff.diffPercentage).toBe(0);
    });

    it('detects regression when outline position changes', () => {
      // Baseline: outline at (20, 20)
      const baselinePixels = createOutlinePixelData(200, 200, 20, 20, 100, 100, 2);
      state = captureBaseline(state, 'position-test', baselinePixels, {
        width: 200,
        height: 200,
      });

      // Current: outline shifted to (40, 40) - regression!
      const currentPixels = createOutlinePixelData(200, 200, 40, 40, 100, 100, 2);

      const { result } = compareWithBaseline(state, 'position-test', currentPixels);

      expect(result!.pass).toBe(false);
      expect(result!.diff.diffPixelCount).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Visual Regression Tests: Device Frames
  // ===========================================================================

  describe('Device Frame Visual Regression', () => {
    let state: VisualRegressionState;

    beforeEach(() => {
      state = createVRState({ diffThreshold: 5 });
    });

    it('captures baseline for iPhone frame (portrait)', () => {
      // Simulate iPhone frame with dark bezel
      const iphoneFrame = createDeviceFramePixelData(
        393, // iPhone 15 Pro width
        852, // iPhone 15 Pro height
        20, // Bezel width
        [30, 30, 30], // Dark bezel
        [255, 255, 255] // White screen
      );

      state = captureBaseline(state, 'iphone-15-portrait', iphoneFrame, {
        width: 393,
        height: 852,
      });

      const baseline = getBaseline(state, 'iphone-15-portrait');
      expect(baseline).toBeDefined();
      expect(baseline!.viewport.width).toBe(393);
      expect(baseline!.viewport.height).toBe(852);
    });

    it('captures baseline for iPad frame (landscape)', () => {
      // Simulate iPad frame
      const ipadFrame = createDeviceFramePixelData(
        1194, // iPad Pro 11" landscape width
        834, // iPad Pro 11" landscape height
        30, // Bezel width
        [50, 50, 50], // Bezel
        [255, 255, 255]
      );

      state = captureBaseline(state, 'ipad-pro-landscape', ipadFrame, {
        width: 1194,
        height: 834,
      });

      const baseline = getBaseline(state, 'ipad-pro-landscape');
      expect(baseline).toBeDefined();
    });

    it('captures baseline for desktop frame', () => {
      const desktopFrame = createDeviceFramePixelData(
        1920,
        1080,
        0, // No bezel for desktop
        [0, 0, 0],
        [255, 255, 255]
      );

      state = captureBaseline(state, 'desktop-1080p', desktopFrame, {
        width: 1920,
        height: 1080,
      });

      const baseline = getBaseline(state, 'desktop-1080p');
      expect(baseline).toBeDefined();
    });

    it('detects regression when device bezel changes', () => {
      // Baseline: thin bezel
      const thinBezel = createDeviceFramePixelData(400, 600, 10);
      state = captureBaseline(state, 'bezel-test', thinBezel, {
        width: 400,
        height: 600,
      });

      // Current: thick bezel (regression)
      const thickBezel = createDeviceFramePixelData(400, 600, 30);

      const { result } = compareWithBaseline(state, 'bezel-test', thickBezel);

      expect(result!.pass).toBe(false);
      expect(result!.diff.diffPercentage).toBeGreaterThan(0);
    });

    it('detects regression when device dimensions change', () => {
      // Baseline: 400x600
      const baseline = createDeviceFramePixelData(400, 600, 20);
      state = captureBaseline(state, 'dimension-test', baseline, {
        width: 400,
        height: 600,
      });

      // Current: 500x700 (different size - regression)
      const current = createDeviceFramePixelData(500, 700, 20);

      const { result } = compareWithBaseline(state, 'dimension-test', current);

      expect(result!.pass).toBe(false);
      // Size difference should be detected
    });

    it('passes when device frame matches baseline', () => {
      const frame = createDeviceFramePixelData(400, 600, 20);
      state = captureBaseline(state, 'match-test', frame, {
        width: 400,
        height: 600,
      });

      const { result } = compareWithBaseline(state, 'match-test', frame);

      expect(result!.pass).toBe(true);
      expect(result!.diff.diffPercentage).toBe(0);
    });
  });

  // ===========================================================================
  // Visual Regression Tests: Floating Editor
  // ===========================================================================

  describe('Floating Editor Visual Regression', () => {
    let state: VisualRegressionState;

    beforeEach(() => {
      state = createVRState({ diffThreshold: 5 });
    });

    it('captures baseline for floating editor panel', () => {
      // Simulate floating editor positioned at right side
      const floatingPanel = createFloatingPanelPixelData(
        800, // Full viewport width
        600, // Full viewport height
        500, // Panel X (right side)
        100, // Panel Y (top offset)
        280, // Panel width
        400 // Panel height
      );

      state = captureBaseline(state, 'floating-editor-panel', floatingPanel, {
        width: 800,
        height: 600,
      });

      const baseline = getBaseline(state, 'floating-editor-panel');
      expect(baseline).toBeDefined();
    });

    it('captures baseline for floating editor with tabs', () => {
      // Simulate panel with tab bar
      const panelWithTabs = createFloatingPanelPixelData(
        800,
        600,
        500,
        100,
        280,
        400,
        [240, 240, 240],
        [255, 255, 255],
        [220, 220, 220]
      );

      state = captureBaseline(state, 'floating-editor-tabs', panelWithTabs, {
        width: 800,
        height: 600,
      });

      const baseline = getBaseline(state, 'floating-editor-tabs');
      expect(baseline).toBeDefined();
    });

    it('detects regression when panel position changes', () => {
      // Baseline: panel at (500, 100)
      const baselinePanel = createFloatingPanelPixelData(
        800,
        600,
        500,
        100,
        280,
        400
      );
      state = captureBaseline(state, 'position-test', baselinePanel, {
        width: 800,
        height: 600,
      });

      // Current: panel at (300, 150) - moved position
      const currentPanel = createFloatingPanelPixelData(
        800,
        600,
        300, // Different X
        150, // Different Y
        280,
        400
      );

      const { result } = compareWithBaseline(state, 'position-test', currentPanel);

      expect(result!.pass).toBe(false);
    });

    it('detects regression when panel size changes', () => {
      // Baseline: 280x400 panel
      const baselinePanel = createFloatingPanelPixelData(
        800,
        600,
        500,
        100,
        280,
        400
      );
      state = captureBaseline(state, 'size-test', baselinePanel, {
        width: 800,
        height: 600,
      });

      // Current: 320x450 panel (larger - regression)
      const currentPanel = createFloatingPanelPixelData(
        800,
        600,
        500,
        100,
        320, // Wider
        450 // Taller
      );

      const { result } = compareWithBaseline(state, 'size-test', currentPanel);

      expect(result!.pass).toBe(false);
    });

    it('passes when floating editor matches baseline', () => {
      const panel = createFloatingPanelPixelData(800, 600, 500, 100, 280, 400);
      state = captureBaseline(state, 'match-test', panel, {
        width: 800,
        height: 600,
      });

      const { result } = compareWithBaseline(state, 'match-test', panel);

      expect(result!.pass).toBe(true);
      expect(result!.diff.diffPercentage).toBe(0);
    });
  });

  // ===========================================================================
  // Visual Regression Pipeline Tests
  // ===========================================================================

  describe('Visual Regression Pipeline', () => {
    it('tracks comparison history across multiple pages', () => {
      let state = createVRState();

      // Capture baselines for all preview components
      const selectionModePixels = createOutlinePixelData(400, 300, 50, 50, 200, 100, 2);
      const deviceFramePixels = createDeviceFramePixelData(393, 852, 20);
      const floatingEditorPixels = createFloatingPanelPixelData(800, 600, 500, 100, 280, 400);

      state = captureBaseline(state, 'selection-mode', selectionModePixels, {
        width: 400,
        height: 300,
      });
      state = captureBaseline(state, 'device-frame', deviceFramePixels, {
        width: 393,
        height: 852,
      });
      state = captureBaseline(state, 'floating-editor', floatingEditorPixels, {
        width: 800,
        height: 600,
      });

      // Run comparisons
      let result;
      ({ state, result } = compareWithBaseline(state, 'selection-mode', selectionModePixels));
      expect(result!.pass).toBe(true);

      ({ state, result } = compareWithBaseline(state, 'device-frame', deviceFramePixels));
      expect(result!.pass).toBe(true);

      ({ state, result } = compareWithBaseline(state, 'floating-editor', floatingEditorPixels));
      expect(result!.pass).toBe(true);

      // Check history
      const history = getHistory(state);
      expect(history).toHaveLength(3);

      // All should pass
      expect(getPassRate(state)).toBe(1);
    });

    it('reports partial failures correctly', () => {
      let state = createVRState();

      // Capture baselines
      const goodPixels = createSolidPixelData(100, 100, 255, 255, 255, 255);
      state = captureBaseline(state, 'page-1', goodPixels, { width: 100, height: 100 });
      state = captureBaseline(state, 'page-2', goodPixels, { width: 100, height: 100 });

      // Page 1: passes
      let result;
      ({ state, result } = compareWithBaseline(state, 'page-1', goodPixels));
      expect(result!.pass).toBe(true);

      // Page 2: fails (different color)
      const badPixels = createSolidPixelData(100, 100, 0, 0, 0, 255);
      ({ state, result } = compareWithBaseline(state, 'page-2', badPixels));
      expect(result!.pass).toBe(false);

      // Pass rate should be 50%
      expect(getPassRate(state)).toBe(0.5);
    });

    it('handles missing baseline gracefully', () => {
      const state = createVRState();
      const pixels = createSolidPixelData(100, 100, 255, 255, 255, 255);

      const { result } = compareWithBaseline(state, 'nonexistent-page', pixels);

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // Threshold Configuration Tests
  // ===========================================================================

  describe('Visual Regression Threshold Configuration', () => {
    it('allows small variations with default threshold (5%)', () => {
      let state = createVRState({ diffThreshold: 5 });

      // Baseline: white
      const baseline = createSolidPixelData(100, 100, 255, 255, 255, 255);
      state = captureBaseline(state, 'threshold-test', baseline, {
        width: 100,
        height: 100,
      });

      // Current: 1% of pixels changed (within threshold)
      const current = createSolidPixelData(100, 100, 255, 255, 255, 255);
      // Change 100 pixels (1% of 10000)
      for (let i = 0; i < 100; i++) {
        current.data[i * 4] = 0; // Change R to 0
      }

      const { result } = compareWithBaseline(state, 'threshold-test', current);

      expect(result!.pass).toBe(true);
      expect(result!.diff.diffPercentage).toBeLessThanOrEqual(5);
    });

    it('fails when exceeding threshold', () => {
      let state = createVRState({ diffThreshold: 1 }); // Strict 1% threshold

      const baseline = createSolidPixelData(100, 100, 255, 255, 255, 255);
      state = captureBaseline(state, 'strict-test', baseline, {
        width: 100,
        height: 100,
      });

      // Change 5% of pixels (500 out of 10000)
      const current = createSolidPixelData(100, 100, 255, 255, 255, 255);
      for (let i = 0; i < 500; i++) {
        current.data[i * 4] = 0;
      }

      const { result } = compareWithBaseline(state, 'strict-test', current);

      expect(result!.pass).toBe(false);
      expect(result!.diff.diffPercentage).toBeGreaterThan(1);
    });

    it('respects color tolerance for minor variations', () => {
      // With high color tolerance, small color changes are ignored
      let state = createVRState({ colorTolerance: 50 });

      const baseline = createSolidPixelData(100, 100, 100, 100, 100, 255);
      state = captureBaseline(state, 'tolerance-test', baseline, {
        width: 100,
        height: 100,
      });

      // Slightly different color (within tolerance of 50)
      const current = createSolidPixelData(100, 100, 120, 120, 120, 255);

      const { result } = compareWithBaseline(state, 'tolerance-test', current);

      expect(result!.pass).toBe(true);
      expect(result!.diff.diffPixelCount).toBe(0);
    });
  });

  // ===========================================================================
  // Screenshot Comparison Algorithm Tests
  // ===========================================================================

  describe('Pixel Comparison Algorithm', () => {
    it('computes exact diff percentage correctly', () => {
      // 100x100 = 10000 pixels
      // Change 1000 pixels = 10% diff
      const baseline = createSolidPixelData(100, 100, 255, 255, 255, 255);
      const current = createSolidPixelData(100, 100, 255, 255, 255, 255);

      // Change first 1000 pixels completely
      for (let i = 0; i < 1000; i++) {
        current.data[i * 4] = 0;
        current.data[i * 4 + 1] = 0;
        current.data[i * 4 + 2] = 0;
      }

      const diff = comparePixels(baseline, current, {
        ...DEFAULT_VR_CONFIG,
        antiAliasing: false,
      });

      expect(diff.diffPixelCount).toBe(1000);
      expect(diff.totalPixels).toBe(10000);
      expect(diff.diffPercentage).toBe(10);
    });

    it('handles size differences between baseline and current', () => {
      const baseline = createSolidPixelData(100, 100, 255, 255, 255, 255);
      const current = createSolidPixelData(150, 150, 255, 255, 255, 255);

      const diff = comparePixels(baseline, current, DEFAULT_VR_CONFIG);

      // Size difference contributes to diff
      expect(diff.totalPixels).toBe(150 * 150); // Max dimensions
      expect(diff.diffPixelCount).toBeGreaterThan(0); // Size diff counted
    });

    it('identifies changed pixel indices correctly', () => {
      const baseline = createSolidPixelData(10, 10, 255, 255, 255, 255);
      const current = createSolidPixelData(10, 10, 255, 255, 255, 255);

      // Change pixel at (5, 5) = index 55
      current.data[55 * 4] = 0;
      current.data[55 * 4 + 1] = 0;
      current.data[55 * 4 + 2] = 0;

      const diff = comparePixels(baseline, current, {
        ...DEFAULT_VR_CONFIG,
        antiAliasing: false,
      });

      expect(diff.changedPixels).toContain(55);
      expect(diff.diffPixelCount).toBe(1);
    });
  });
});
