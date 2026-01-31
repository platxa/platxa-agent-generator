/**
 * Tests for Orientation Toggle
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getOrientation,
  setOrientation,
  toggleOrientation,
  getOrientationState,
  getCurrentDimensions,
  getPortraitDimensions,
  getLandscapeDimensions,
  getAspectRatio,
  isPortrait,
  isLandscape,
  getSelectedDevice,
  selectDevice,
  getDevices,
  getDevicesByCategory,
  addCustomDevice,
  removeDevice,
  getAnimationConfig,
  setAnimationConfig,
  setAnimating,
  isAnimating,
  getRotationTransform,
  getAnimationStyle,
  getFrameStyles,
  getViewportMeta,
  getMediaQuery,
  getToggleButtonState,
  handleToggleClick,
  getRotationHistory,
  getRotationCount,
  clearRotationHistory,
  onChange,
  shouldShowMobileNav,
  shouldShowTabletLayout,
  shouldShowDesktopLayout,
  getBreakpoint,
  resetOrientationToggle,
  type OrientationChangeEvent,
} from '../../lib/agent-bridge/orientation-toggle';

describe('Orientation Toggle', () => {
  beforeEach(() => {
    resetOrientationToggle();
  });

  describe('Core Orientation', () => {
    it('should default to portrait orientation', () => {
      expect(getOrientation()).toBe('portrait');
    });

    it('should set orientation to landscape', () => {
      setOrientation('landscape');
      expect(getOrientation()).toBe('landscape');
    });

    it('should set orientation to portrait', () => {
      setOrientation('landscape');
      setOrientation('portrait');
      expect(getOrientation()).toBe('portrait');
    });

    it('should toggle from portrait to landscape', () => {
      toggleOrientation();
      expect(getOrientation()).toBe('landscape');
    });

    it('should toggle from landscape to portrait', () => {
      setOrientation('landscape');
      toggleOrientation();
      expect(getOrientation()).toBe('portrait');
    });

    it('should return orientation state', () => {
      const state = getOrientationState();

      expect(state.orientation).toBe('portrait');
      expect(state.dimensions).toBeDefined();
      expect(state.isAnimating).toBe(false);
      expect(state.rotationAngle).toBe(0);
    });

    it('should return rotation angle 90 for landscape', () => {
      setOrientation('landscape');
      const state = getOrientationState();

      expect(state.rotationAngle).toBe(90);
    });
  });

  describe('Dimensions', () => {
    it('should return portrait dimensions by default', () => {
      const dims = getCurrentDimensions();
      expect(dims.height).toBeGreaterThan(dims.width);
    });

    it('should swap dimensions in landscape', () => {
      const portraitDims = getCurrentDimensions();
      setOrientation('landscape');
      const landscapeDims = getCurrentDimensions();

      expect(landscapeDims.width).toBe(portraitDims.height);
      expect(landscapeDims.height).toBe(portraitDims.width);
    });

    it('should get portrait dimensions', () => {
      const dims = getPortraitDimensions();
      expect(dims.height).toBeGreaterThan(dims.width);
    });

    it('should get landscape dimensions', () => {
      const dims = getLandscapeDimensions();
      expect(dims.width).toBeGreaterThan(dims.height);
    });

    it('should calculate aspect ratio', () => {
      const ratio = getAspectRatio();
      expect(ratio).toBeGreaterThan(0);
      expect(ratio).toBeLessThan(1); // Portrait is taller than wide
    });

    it('should have aspect ratio > 1 in landscape', () => {
      setOrientation('landscape');
      const ratio = getAspectRatio();
      expect(ratio).toBeGreaterThan(1);
    });

    it('should check if portrait', () => {
      expect(isPortrait()).toBe(true);
      expect(isLandscape()).toBe(false);
    });

    it('should check if landscape', () => {
      setOrientation('landscape');
      expect(isPortrait()).toBe(false);
      expect(isLandscape()).toBe(true);
    });
  });

  describe('Device Selection', () => {
    it('should have default device selected', () => {
      const device = getSelectedDevice();
      expect(device.name).toBeDefined();
      expect(device.portraitWidth).toBeGreaterThan(0);
    });

    it('should select device by name', () => {
      const device = selectDevice('iPhone SE');

      expect(device).not.toBeNull();
      expect(device?.name).toBe('iPhone SE');
      expect(getSelectedDevice().name).toBe('iPhone SE');
    });

    it('should return null for non-existent device', () => {
      expect(selectDevice('NonExistent')).toBeNull();
    });

    it('should update dimensions when selecting device', () => {
      selectDevice('iPhone SE');
      const dims1 = getCurrentDimensions();

      selectDevice('iPad Pro 12.9"');
      const dims2 = getCurrentDimensions();

      expect(dims2.width).not.toBe(dims1.width);
    });

    it('should get all devices', () => {
      const devices = getDevices();
      expect(devices.length).toBeGreaterThan(0);
    });

    it('should get devices by category', () => {
      const phones = getDevicesByCategory('phone');
      const tablets = getDevicesByCategory('tablet');

      expect(phones.length).toBeGreaterThan(0);
      expect(tablets.length).toBeGreaterThan(0);
      expect(phones.every(d => d.category === 'phone')).toBe(true);
    });

    it('should add custom device', () => {
      const custom = addCustomDevice({
        name: 'Custom Device',
        portraitWidth: 400,
        portraitHeight: 800,
        devicePixelRatio: 2,
        category: 'phone',
      });

      expect(custom.name).toBe('Custom Device');
      expect(getDevices().find(d => d.name === 'Custom Device')).toBeDefined();
    });

    it('should remove custom device', () => {
      addCustomDevice({
        name: 'Removable',
        portraitWidth: 400,
        portraitHeight: 800,
        devicePixelRatio: 2,
        category: 'phone',
      });

      expect(removeDevice('Removable')).toBe(true);
      expect(getDevices().find(d => d.name === 'Removable')).toBeUndefined();
    });

    it('should not remove selected device', () => {
      addCustomDevice({
        name: 'Selected Custom',
        portraitWidth: 400,
        portraitHeight: 800,
        devicePixelRatio: 2,
        category: 'phone',
      });
      selectDevice('Selected Custom');

      expect(removeDevice('Selected Custom')).toBe(false);
    });

    it('should not remove default devices', () => {
      expect(removeDevice('iPhone SE')).toBe(false);
    });
  });

  describe('Animation', () => {
    it('should have default animation config', () => {
      const config = getAnimationConfig();

      expect(config.duration).toBe(300);
      expect(config.easing).toBeDefined();
      expect(config.enabled).toBe(true);
    });

    it('should update animation config', () => {
      setAnimationConfig({ duration: 500 });

      expect(getAnimationConfig().duration).toBe(500);
    });

    it('should track animating state', () => {
      expect(isAnimating()).toBe(false);

      setAnimating(true);
      expect(isAnimating()).toBe(true);

      setAnimating(false);
      expect(isAnimating()).toBe(false);
    });

    it('should return rotation transform', () => {
      expect(getRotationTransform()).toBe('rotate(0deg)');

      setOrientation('landscape');
      expect(getRotationTransform()).toBe('rotate(90deg)');
    });

    it('should return animation style', () => {
      const style = getAnimationStyle();

      expect(style.transition).toContain('300ms');
      expect(style.transform).toBe('rotate(0deg)');
    });

    it('should return empty style when animation disabled', () => {
      setAnimationConfig({ enabled: false });
      const style = getAnimationStyle();

      expect(Object.keys(style).length).toBe(0);
    });
  });

  describe('CSS Helpers', () => {
    it('should return frame styles', () => {
      const styles = getFrameStyles();

      expect(styles.width).toContain('px');
      expect(styles.height).toContain('px');
    });

    it('should return viewport meta', () => {
      const meta = getViewportMeta();

      expect(meta).toContain('width=');
      expect(meta).toContain('initial-scale=');
    });

    it('should return media query', () => {
      const query = getMediaQuery();

      expect(query).toContain('max-width');
      expect(query).toContain('orientation: portrait');
    });

    it('should return landscape media query', () => {
      setOrientation('landscape');
      const query = getMediaQuery();

      expect(query).toContain('orientation: landscape');
    });
  });

  describe('Toggle Button State', () => {
    it('should return button state for portrait', () => {
      const state = getToggleButtonState();

      expect(state.isPortrait).toBe(true);
      expect(state.isLandscape).toBe(false);
      expect(state.label).toBe('Landscape');
      expect(state.ariaLabel).toContain('landscape');
      expect(state.disabled).toBe(false);
    });

    it('should return button state for landscape', () => {
      setOrientation('landscape');
      const state = getToggleButtonState();

      expect(state.isPortrait).toBe(false);
      expect(state.isLandscape).toBe(true);
      expect(state.label).toBe('Portrait');
    });

    it('should disable button when animating', () => {
      setAnimating(true);
      const state = getToggleButtonState();

      expect(state.disabled).toBe(true);
    });

    it('should handle toggle click', () => {
      const result = handleToggleClick();

      expect(result).not.toBeNull();
      expect(result?.orientation).toBe('landscape');
    });

    it('should not toggle when animating', () => {
      setAnimating(true);
      const result = handleToggleClick();

      expect(result).toBeNull();
      expect(getOrientation()).toBe('portrait');
    });
  });

  describe('History', () => {
    it('should track rotation history', () => {
      toggleOrientation();
      toggleOrientation();
      toggleOrientation();

      const history = getRotationHistory();
      expect(history).toEqual(['portrait', 'landscape', 'portrait', 'landscape']);
    });

    it('should count rotations', () => {
      expect(getRotationCount()).toBe(0);

      toggleOrientation();
      expect(getRotationCount()).toBe(1);

      toggleOrientation();
      expect(getRotationCount()).toBe(2);
    });

    it('should clear history', () => {
      toggleOrientation();
      toggleOrientation();

      clearRotationHistory();

      expect(getRotationCount()).toBe(0);
      expect(getRotationHistory()).toEqual([getOrientation()]);
    });
  });

  describe('Change Handlers', () => {
    it('should notify on orientation change', () => {
      const events: OrientationChangeEvent[] = [];
      onChange(event => events.push(event));

      toggleOrientation();

      expect(events.length).toBe(1);
      expect(events[0].previousOrientation).toBe('portrait');
      expect(events[0].newOrientation).toBe('landscape');
    });

    it('should include dimensions in event', () => {
      const events: OrientationChangeEvent[] = [];
      onChange(event => events.push(event));

      toggleOrientation();

      expect(events[0].previousDimensions).toBeDefined();
      expect(events[0].newDimensions).toBeDefined();
      expect(events[0].newDimensions.width).toBe(events[0].previousDimensions.height);
    });

    it('should unsubscribe handler', () => {
      const events: OrientationChangeEvent[] = [];
      const unsubscribe = onChange(event => events.push(event));

      toggleOrientation();
      expect(events.length).toBe(1);

      unsubscribe();
      toggleOrientation();
      expect(events.length).toBe(1);
    });

    it('should not notify when orientation unchanged', () => {
      const events: OrientationChangeEvent[] = [];
      onChange(event => events.push(event));

      setOrientation('portrait'); // Already portrait

      expect(events.length).toBe(0);
    });
  });

  describe('Responsive Helpers', () => {
    it('should detect mobile nav for phones', () => {
      selectDevice('iPhone 14');
      expect(shouldShowMobileNav()).toBe(true);
    });

    it('should not show mobile nav for tablets', () => {
      selectDevice('iPad Pro 12.9"');
      expect(shouldShowMobileNav()).toBe(false);
    });

    it('should detect tablet layout', () => {
      selectDevice('iPad Mini');
      expect(shouldShowTabletLayout()).toBe(true);
    });

    it('should detect desktop layout', () => {
      selectDevice('Desktop Full HD');
      expect(shouldShowDesktopLayout()).toBe(true);
    });

    it('should return correct breakpoint', () => {
      selectDevice('iPhone 14');
      expect(getBreakpoint()).toBe('mobile');

      selectDevice('iPad Mini');
      expect(getBreakpoint()).toBe('tablet');

      selectDevice('Desktop Full HD');
      expect(getBreakpoint()).toBe('desktop');
    });
  });

  describe('Reset', () => {
    it('should reset all state', () => {
      setOrientation('landscape');
      selectDevice('iPad Pro 12.9"');
      setAnimationConfig({ duration: 500 });

      resetOrientationToggle();

      expect(getOrientation()).toBe('portrait');
      expect(getSelectedDevice().name).toBe('iPhone 14');
      expect(getAnimationConfig().duration).toBe(300);
    });
  });

  describe('Verification: Button rotates device frame between portrait and landscape', () => {
    it('should rotate from portrait to landscape on button click', () => {
      expect(getOrientation()).toBe('portrait');

      const result = handleToggleClick();

      expect(result?.orientation).toBe('landscape');
      expect(getOrientation()).toBe('landscape');
    });

    it('should rotate from landscape to portrait on button click', () => {
      setOrientation('landscape');

      const result = handleToggleClick();

      expect(result?.orientation).toBe('portrait');
      expect(getOrientation()).toBe('portrait');
    });

    it('should swap device frame dimensions on rotation', () => {
      const portraitDims = getCurrentDimensions();

      handleToggleClick();

      const landscapeDims = getCurrentDimensions();

      // Width and height should be swapped
      expect(landscapeDims.width).toBe(portraitDims.height);
      expect(landscapeDims.height).toBe(portraitDims.width);
    });

    it('should apply rotation transform', () => {
      expect(getRotationTransform()).toBe('rotate(0deg)');

      handleToggleClick();

      expect(getRotationTransform()).toBe('rotate(90deg)');
    });

    it('should complete full rotation cycle', () => {
      // Disable animation to allow synchronous multiple clicks
      // (animation uses setTimeout which doesn't complete in sync tests)
      setAnimationConfig({ enabled: false });

      // Start portrait
      expect(isPortrait()).toBe(true);

      // Click 1: portrait -> landscape
      handleToggleClick();
      expect(isLandscape()).toBe(true);

      // Click 2: landscape -> portrait
      handleToggleClick();
      expect(isPortrait()).toBe(true);
    });
  });
});
