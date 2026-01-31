/**
 * Tests for Fit-to-Screen Auto-Zoom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getZoom,
  setZoom,
  zoomIn,
  zoomOut,
  resetZoom,
  fitToScreen,
  calculateFit,
  calculateOptimalZoom,
  getFitMode,
  setFitMode,
  cycleFitMode,
  setPanelDimensions,
  setContentDimensions,
  getPanelDimensions,
  getContentDimensions,
  setPadding,
  getPadding,
  setZoomLimits,
  getZoomLimits,
  setZoomStep,
  getZoomStep,
  getZoomPresets,
  applyZoomPreset,
  findNearestPreset,
  getFitButtonState,
  handleFitButtonClick,
  getTransformStyle,
  getContainerStyle,
  getScrollContainerStyle,
  onChange,
  formatZoom,
  parseZoom,
  isZoomValid,
  getState,
  willFitWithoutScrolling,
  getScaleFactor,
  resetFitToScreen,
  type ZoomChangeEvent,
  type FitCalculationResult,
} from '../../lib/agent-bridge/fit-to-screen';

describe('Fit-to-Screen Auto-Zoom', () => {
  beforeEach(() => {
    resetFitToScreen();
  });

  describe('Core Zoom', () => {
    it('should default to 100% zoom', () => {
      expect(getZoom()).toBe(1);
    });

    it('should set zoom level', () => {
      setZoom(0.5);
      expect(getZoom()).toBe(0.5);
    });

    it('should clamp zoom to min', () => {
      setZoom(0.01);
      expect(getZoom()).toBe(0.1); // Default min is 0.1
    });

    it('should clamp zoom to max', () => {
      setZoom(10);
      expect(getZoom()).toBe(5); // Default max is 5
    });

    it('should zoom in', () => {
      const initial = getZoom();
      zoomIn();
      expect(getZoom()).toBeGreaterThan(initial);
    });

    it('should zoom out', () => {
      const initial = getZoom();
      zoomOut();
      expect(getZoom()).toBeLessThan(initial);
    });

    it('should reset zoom to 100%', () => {
      setZoom(0.5);
      resetZoom();
      expect(getZoom()).toBe(1);
    });
  });

  describe('Fit Calculation', () => {
    it('should calculate fit for content larger than panel', () => {
      setPanelDimensions({ width: 800, height: 600 });
      setContentDimensions({ width: 1920, height: 1080 });

      const result = calculateFit('fit');

      expect(result.zoom).toBeLessThan(1);
      expect(result.scaledWidth).toBeLessThanOrEqual(800);
      expect(result.scaledHeight).toBeLessThanOrEqual(600);
    });

    it('should calculate fit for content smaller than panel', () => {
      setPanelDimensions({ width: 1920, height: 1080 });
      setContentDimensions({ width: 400, height: 300 });

      const result = calculateFit('fit');

      expect(result.zoom).toBeGreaterThan(1);
    });

    it('should calculate fill mode', () => {
      setPanelDimensions({ width: 800, height: 600 });
      setContentDimensions({ width: 1920, height: 1080 });

      const result = calculateFit('fill');

      // Fill should be larger than fit
      const fitResult = calculateFit('fit');
      expect(result.zoom).toBeGreaterThanOrEqual(fitResult.zoom);
    });

    it('should calculate width mode', () => {
      setPanelDimensions({ width: 800, height: 600 });
      setContentDimensions({ width: 1600, height: 1200 });
      setPadding(0);

      const result = calculateFit('width');

      expect(result.scaledWidth).toBe(800);
    });

    it('should calculate height mode', () => {
      setPanelDimensions({ width: 800, height: 600 });
      setContentDimensions({ width: 1600, height: 1200 });
      setPadding(0);

      const result = calculateFit('height');

      expect(result.scaledHeight).toBe(600);
    });

    it('should return actual size for actual mode', () => {
      const result = calculateFit('actual');
      expect(result.zoom).toBe(1);
    });

    it('should calculate centering offset', () => {
      setPanelDimensions({ width: 800, height: 600 });
      setContentDimensions({ width: 400, height: 300 });
      setPadding(0);
      setZoomLimits(0.1, 1); // Limit max zoom to 1

      const result = calculateFit('fit');

      expect(result.offsetX).toBeGreaterThan(0);
      expect(result.offsetY).toBeGreaterThan(0);
    });

    it('should detect overflow', () => {
      setPanelDimensions({ width: 400, height: 300 });
      setContentDimensions({ width: 1920, height: 1080 });

      const fillResult = calculateFit('fill');
      expect(fillResult.hasOverflow).toBe(true);

      const fitResult = calculateFit('fit');
      expect(fitResult.hasOverflow).toBe(false);
    });

    it('should apply padding', () => {
      setPanelDimensions({ width: 800, height: 600 });
      setContentDimensions({ width: 800, height: 600 });
      setPadding(50);

      const result = calculateFit('fit');

      // With padding, zoom should be less than 1
      expect(result.zoom).toBeLessThan(1);
    });
  });

  describe('Fit to Screen', () => {
    it('should fit content to screen', () => {
      setPanelDimensions({ width: 800, height: 600 });
      setContentDimensions({ width: 1920, height: 1080 });

      const result = fitToScreen();

      expect(getZoom()).toBe(result.zoom);
      expect(result.hasOverflow).toBe(false);
    });

    it('should calculate optimal zoom', () => {
      setPanelDimensions({ width: 800, height: 600 });
      setContentDimensions({ width: 1920, height: 1080 });

      const optimalZoom = calculateOptimalZoom();

      expect(optimalZoom).toBeLessThan(1);
      expect(optimalZoom).toBeGreaterThan(0);
    });
  });

  describe('Fit Mode', () => {
    it('should default to fit mode', () => {
      expect(getFitMode()).toBe('fit');
    });

    it('should set fit mode', () => {
      setFitMode('fill');
      expect(getFitMode()).toBe('fill');
    });

    it('should cycle through fit modes', () => {
      expect(cycleFitMode()).toBe('fill');
      expect(cycleFitMode()).toBe('width');
      expect(cycleFitMode()).toBe('height');
      expect(cycleFitMode()).toBe('actual');
      expect(cycleFitMode()).toBe('fit');
    });

    it('should recalculate when mode changes', () => {
      setPanelDimensions({ width: 800, height: 600 });
      setContentDimensions({ width: 1920, height: 1080 });

      const fitResult = setFitMode('fit');
      const fillResult = setFitMode('fill');

      expect(fillResult.zoom).not.toBe(fitResult.zoom);
    });
  });

  describe('Dimensions', () => {
    it('should set panel dimensions', () => {
      setPanelDimensions({ width: 1024, height: 768 });
      expect(getPanelDimensions()).toEqual({ width: 1024, height: 768 });
    });

    it('should set content dimensions', () => {
      setContentDimensions({ width: 1280, height: 720 });
      expect(getContentDimensions()).toEqual({ width: 1280, height: 720 });
    });

    it('should recalculate when panel dimensions change', () => {
      setContentDimensions({ width: 1920, height: 1080 });

      setPanelDimensions({ width: 400, height: 300 });
      const small = calculateFit();

      setPanelDimensions({ width: 1600, height: 1200 });
      const large = calculateFit();

      expect(large.zoom).toBeGreaterThan(small.zoom);
    });
  });

  describe('Configuration', () => {
    it('should set padding', () => {
      setPadding(32);
      expect(getPadding()).toBe(32);
    });

    it('should not allow negative padding', () => {
      setPadding(-10);
      expect(getPadding()).toBe(0);
    });

    it('should set zoom limits', () => {
      setZoomLimits(0.25, 3);
      const limits = getZoomLimits();

      expect(limits.min).toBe(0.25);
      expect(limits.max).toBe(3);
    });

    it('should re-clamp zoom when limits change', () => {
      setZoom(2);
      setZoomLimits(0.5, 1.5);

      expect(getZoom()).toBe(1.5);
    });

    it('should set zoom step', () => {
      setZoomStep(0.25);
      expect(getZoomStep()).toBe(0.25);

      const initial = getZoom();
      zoomIn();
      expect(getZoom()).toBe(initial + 0.25);
    });
  });

  describe('Zoom Presets', () => {
    it('should have default presets', () => {
      const presets = getZoomPresets();

      expect(presets.length).toBeGreaterThan(0);
      expect(presets.find(p => p.name === '100%')).toBeDefined();
      expect(presets.find(p => p.zoom === 1)).toBeDefined();
    });

    it('should apply preset', () => {
      applyZoomPreset('50%');
      expect(getZoom()).toBe(0.5);
    });

    it('should return null for non-existent preset', () => {
      expect(applyZoomPreset('NonExistent')).toBeNull();
    });

    it('should find nearest preset', () => {
      setZoom(0.48);
      const nearest = findNearestPreset();

      expect(nearest?.name).toBe('50%');
    });
  });

  describe('Button State', () => {
    it('should return button state', () => {
      const state = getFitButtonState();

      expect(state.zoom).toBe(1);
      expect(state.zoomPercent).toBe('100%');
      expect(state.canZoomIn).toBe(true);
      expect(state.canZoomOut).toBe(true);
    });

    it('should disable zoom in at max', () => {
      setZoom(5);
      const state = getFitButtonState();

      expect(state.canZoomIn).toBe(false);
    });

    it('should disable zoom out at min', () => {
      setZoom(0.1);
      const state = getFitButtonState();

      expect(state.canZoomOut).toBe(false);
    });

    it('should detect actual size', () => {
      setZoom(1);
      expect(getFitButtonState().isActualSize).toBe(true);

      setZoom(0.5);
      expect(getFitButtonState().isActualSize).toBe(false);
    });

    it('should handle fit button click', () => {
      setZoom(2);
      const result = handleFitButtonClick();

      expect(result.zoom).not.toBe(2);
      expect(getZoom()).toBe(result.zoom);
    });
  });

  describe('CSS Helpers', () => {
    it('should return transform style', () => {
      setZoom(0.75);
      const style = getTransformStyle();

      expect(style.transform).toBe('scale(0.75)');
      expect(style.transformOrigin).toBe('top left');
    });

    it('should return container style', () => {
      const style = getContainerStyle();

      expect(style.width).toContain('px');
      expect(style.height).toContain('px');
    });

    it('should return scroll container style', () => {
      const style = getScrollContainerStyle();

      expect(style.width).toContain('px');
      expect(style.height).toContain('px');
      expect(style.overflow).toBeDefined();
    });
  });

  describe('Change Handlers', () => {
    it('should notify on zoom change', () => {
      const events: ZoomChangeEvent[] = [];
      onChange(event => events.push(event));

      setZoom(0.5);

      expect(events.length).toBe(1);
      expect(events[0].previousZoom).toBe(1);
      expect(events[0].newZoom).toBe(0.5);
    });

    it('should indicate auto-fit', () => {
      const events: ZoomChangeEvent[] = [];
      onChange(event => events.push(event));

      fitToScreen();

      expect(events[0].isAutoFit).toBe(true);
    });

    it('should unsubscribe handler', () => {
      const events: ZoomChangeEvent[] = [];
      const unsubscribe = onChange(event => events.push(event));

      setZoom(0.5);
      expect(events.length).toBe(1);

      unsubscribe();
      setZoom(0.75);
      expect(events.length).toBe(1);
    });

    it('should not notify when zoom unchanged', () => {
      const events: ZoomChangeEvent[] = [];
      onChange(event => events.push(event));

      setZoom(1); // Already 1

      expect(events.length).toBe(0);
    });
  });

  describe('Utility Functions', () => {
    it('should format zoom', () => {
      expect(formatZoom(1)).toBe('100%');
      expect(formatZoom(0.5)).toBe('50%');
      expect(formatZoom(1.5)).toBe('150%');
    });

    it('should parse zoom with percent', () => {
      expect(parseZoom('50%')).toBe(0.5);
      expect(parseZoom('100%')).toBe(1);
      expect(parseZoom('150%')).toBe(1.5);
    });

    it('should parse zoom without percent', () => {
      expect(parseZoom('0.5')).toBe(0.5);
      expect(parseZoom('1')).toBe(1);
    });

    it('should return null for invalid zoom string', () => {
      expect(parseZoom('invalid')).toBeNull();
      expect(parseZoom('')).toBeNull();
    });

    it('should validate zoom', () => {
      expect(isZoomValid(1)).toBe(true);
      expect(isZoomValid(0.5)).toBe(true);
      expect(isZoomValid(0.01)).toBe(false); // Below min
      expect(isZoomValid(10)).toBe(false); // Above max
    });

    it('should check if will fit without scrolling', () => {
      setPanelDimensions({ width: 1920, height: 1080 });
      setContentDimensions({ width: 800, height: 600 });

      expect(willFitWithoutScrolling()).toBe(true);
    });

    it('should get scale factor', () => {
      setZoom(0.75);
      expect(getScaleFactor()).toBe(0.75);
    });

    it('should get full state', () => {
      const state = getState();

      expect(state.zoom).toBeDefined();
      expect(state.fitMode).toBeDefined();
      expect(state.panelDimensions).toBeDefined();
    });
  });

  describe('Reset', () => {
    it('should reset all state', () => {
      setZoom(0.5);
      setFitMode('fill');
      setPadding(50);

      resetFitToScreen();

      expect(getZoom()).toBe(1);
      expect(getFitMode()).toBe('fit');
      expect(getPadding()).toBe(16);
    });
  });

  describe('Verification: Button calculates optimal zoom to fill panel without scrolling', () => {
    it('should calculate zoom that fills panel without scrolling', () => {
      setPanelDimensions({ width: 800, height: 600 });
      setContentDimensions({ width: 1920, height: 1080 });

      const result = handleFitButtonClick();

      expect(result.hasOverflow).toBe(false);
      expect(result.scaledWidth).toBeLessThanOrEqual(800);
      expect(result.scaledHeight).toBeLessThanOrEqual(600);
    });

    it('should maximize content within panel', () => {
      setPanelDimensions({ width: 800, height: 600 });
      setContentDimensions({ width: 1920, height: 1080 });
      setPadding(0);

      const result = handleFitButtonClick();

      // One dimension should touch the edge
      const touchesWidth = Math.abs(result.scaledWidth - 800) < 1;
      const touchesHeight = Math.abs(result.scaledHeight - 600) < 1;

      expect(touchesWidth || touchesHeight).toBe(true);
    });

    it('should handle various aspect ratios', () => {
      setPanelDimensions({ width: 800, height: 600 });
      setPadding(0);

      // Wide content
      setContentDimensions({ width: 1920, height: 400 });
      const wideResult = handleFitButtonClick();
      expect(wideResult.hasOverflow).toBe(false);

      // Tall content
      setContentDimensions({ width: 400, height: 1200 });
      const tallResult = handleFitButtonClick();
      expect(tallResult.hasOverflow).toBe(false);

      // Square content
      setContentDimensions({ width: 1000, height: 1000 });
      const squareResult = handleFitButtonClick();
      expect(squareResult.hasOverflow).toBe(false);
    });

    it('should update zoom when button clicked', () => {
      setPanelDimensions({ width: 800, height: 600 });
      setContentDimensions({ width: 1920, height: 1080 });

      setZoom(2); // Start with different zoom

      handleFitButtonClick();

      expect(getZoom()).toBeLessThan(1);
      expect(getZoom()).toBe(calculateOptimalZoom());
    });
  });
});
