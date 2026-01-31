/**
 * Tests for Border Radius Adjuster
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getValue,
  setValue,
  setCornerValue,
  getUniformValue,
  isLinked,
  setLinked,
  toggleLinked,
  getSliderConfig,
  setSliderConfig,
  getUnit,
  setUnit,
  formatValue,
  formatBorderRadius,
  parseBorderRadius,
  getPresets,
  applyPreset,
  addCustomPreset,
  removePreset,
  findMatchingPreset,
  canUndo,
  canRedo,
  undo,
  redo,
  clearHistory,
  onChange,
  getSliderPosition,
  getValueFromPosition,
  snapToStep,
  getTickMarks,
  toCSSValue,
  toCSSObject,
  toTailwindClass,
  resetBorderRadiusAdjuster,
  type BorderRadiusValue,
  type BorderRadiusChangeEvent,
} from '../../lib/agent-bridge/border-radius-adjuster';

describe('Border Radius Adjuster', () => {
  beforeEach(() => {
    resetBorderRadiusAdjuster();
  });

  describe('Core Value Management', () => {
    it('should return initial value of 0 for all corners', () => {
      const value = getValue();

      expect(value.topLeft).toBe(0);
      expect(value.topRight).toBe(0);
      expect(value.bottomRight).toBe(0);
      expect(value.bottomLeft).toBe(0);
    });

    it('should set all corners at once', () => {
      const newValue = { topLeft: 10, topRight: 20, bottomRight: 30, bottomLeft: 40 };
      setValue(newValue);

      const value = getValue();
      expect(value).toEqual(newValue);
    });

    it('should clamp values to min/max', () => {
      setValue({ topLeft: -10, topRight: 100, bottomRight: 25, bottomLeft: 50 });

      const value = getValue();
      expect(value.topLeft).toBe(0); // Clamped to min
      expect(value.topRight).toBe(50); // Clamped to max
      expect(value.bottomRight).toBe(25);
      expect(value.bottomLeft).toBe(50);
    });

    it('should set individual corner value when linked', () => {
      setCornerValue('topLeft', 15);

      const value = getValue();
      // All corners should be 15 when linked
      expect(value.topLeft).toBe(15);
      expect(value.topRight).toBe(15);
      expect(value.bottomRight).toBe(15);
      expect(value.bottomLeft).toBe(15);
    });

    it('should set individual corner value when unlinked', () => {
      setLinked(false);
      setCornerValue('topLeft', 15);

      const value = getValue();
      expect(value.topLeft).toBe(15);
      expect(value.topRight).toBe(0);
      expect(value.bottomRight).toBe(0);
      expect(value.bottomLeft).toBe(0);
    });

    it('should return uniform value when all corners are equal', () => {
      setValue({ topLeft: 10, topRight: 10, bottomRight: 10, bottomLeft: 10 });
      expect(getUniformValue()).toBe(10);
    });

    it('should return null when corners are not uniform', () => {
      setValue({ topLeft: 10, topRight: 20, bottomRight: 10, bottomLeft: 20 });
      expect(getUniformValue()).toBeNull();
    });
  });

  describe('Linked Mode', () => {
    it('should be linked by default', () => {
      expect(isLinked()).toBe(true);
    });

    it('should toggle linked state', () => {
      expect(toggleLinked()).toBe(false);
      expect(isLinked()).toBe(false);

      expect(toggleLinked()).toBe(true);
      expect(isLinked()).toBe(true);
    });

    it('should set linked state directly', () => {
      setLinked(false);
      expect(isLinked()).toBe(false);

      setLinked(true);
      expect(isLinked()).toBe(true);
    });
  });

  describe('Slider Configuration', () => {
    it('should return default slider config', () => {
      const config = getSliderConfig();

      expect(config.min).toBe(0);
      expect(config.max).toBe(50);
      expect(config.step).toBe(1);
    });

    it('should update slider config', () => {
      setSliderConfig({ min: 0, max: 100, step: 5 });

      const config = getSliderConfig();
      expect(config.max).toBe(100);
      expect(config.step).toBe(5);
    });

    it('should re-clamp values when config changes', () => {
      setValue({ topLeft: 40, topRight: 40, bottomRight: 40, bottomLeft: 40 });
      setSliderConfig({ max: 30 });

      const value = getValue();
      expect(value.topLeft).toBe(30);
    });
  });

  describe('Unit Handling', () => {
    it('should default to px unit', () => {
      expect(getUnit()).toBe('px');
    });

    it('should change unit', () => {
      setUnit('rem');
      expect(getUnit()).toBe('rem');
    });

    it('should format value with unit', () => {
      expect(formatValue(10)).toBe('10px');

      setUnit('rem');
      expect(formatValue(2)).toBe('2rem');
    });

    it('should format uniform border radius', () => {
      setValue({ topLeft: 10, topRight: 10, bottomRight: 10, bottomLeft: 10 });
      expect(formatBorderRadius()).toBe('10px');
    });

    it('should format shorthand border radius', () => {
      setValue({ topLeft: 10, topRight: 20, bottomRight: 10, bottomLeft: 20 });
      expect(formatBorderRadius()).toBe('10px 20px');
    });

    it('should format full border radius', () => {
      setValue({ topLeft: 10, topRight: 20, bottomRight: 30, bottomLeft: 40 });
      expect(formatBorderRadius()).toBe('10px 20px 30px 40px');
    });
  });

  describe('Parse Border Radius', () => {
    it('should parse single value', () => {
      const result = parseBorderRadius('10px');

      expect(result).toEqual({
        topLeft: 10,
        topRight: 10,
        bottomRight: 10,
        bottomLeft: 10,
      });
    });

    it('should parse two values', () => {
      const result = parseBorderRadius('10px 20px');

      expect(result).toEqual({
        topLeft: 10,
        topRight: 20,
        bottomRight: 10,
        bottomLeft: 20,
      });
    });

    it('should parse three values', () => {
      const result = parseBorderRadius('10px 20px 30px');

      expect(result).toEqual({
        topLeft: 10,
        topRight: 20,
        bottomRight: 30,
        bottomLeft: 20,
      });
    });

    it('should parse four values', () => {
      const result = parseBorderRadius('10px 20px 30px 40px');

      expect(result).toEqual({
        topLeft: 10,
        topRight: 20,
        bottomRight: 30,
        bottomLeft: 40,
      });
    });

    it('should handle rem values', () => {
      const result = parseBorderRadius('1.5rem');
      expect(result?.topLeft).toBe(1.5);
    });

    it('should return null for empty string', () => {
      expect(parseBorderRadius('')).toBeNull();
    });

    it('should return null for invalid input', () => {
      expect(parseBorderRadius('invalid')).toBeNull();
    });
  });

  describe('Presets', () => {
    it('should have default presets', () => {
      const presets = getPresets();

      expect(presets.length).toBeGreaterThan(0);
      expect(presets.find(p => p.name === 'None')).toBeDefined();
      expect(presets.find(p => p.name === 'Small')).toBeDefined();
      expect(presets.find(p => p.name === 'Full')).toBeDefined();
    });

    it('should apply preset', () => {
      applyPreset('Medium');

      const value = getValue();
      expect(value.topLeft).toBe(8);
      expect(value.topRight).toBe(8);
    });

    it('should return null for non-existent preset', () => {
      expect(applyPreset('NonExistent')).toBeNull();
    });

    it('should add custom preset', () => {
      setValue({ topLeft: 12, topRight: 12, bottomRight: 12, bottomLeft: 12 });
      const preset = addCustomPreset('My Custom');

      expect(preset.name).toBe('My Custom');
      expect(preset.value.topLeft).toBe(12);

      const presets = getPresets();
      expect(presets.find(p => p.name === 'My Custom')).toBeDefined();
    });

    it('should remove custom preset', () => {
      addCustomPreset('Removable');
      expect(removePreset('Removable')).toBe(true);

      const presets = getPresets();
      expect(presets.find(p => p.name === 'Removable')).toBeUndefined();
    });

    it('should not remove default presets', () => {
      expect(removePreset('None')).toBe(false);
      expect(removePreset('Small')).toBe(false);
    });

    it('should find matching preset', () => {
      applyPreset('Small');
      const match = findMatchingPreset();

      expect(match?.name).toBe('Small');
    });

    it('should return null when no preset matches', () => {
      setValue({ topLeft: 7, topRight: 7, bottomRight: 7, bottomLeft: 7 });
      expect(findMatchingPreset()).toBeNull();
    });
  });

  describe('History (Undo/Redo)', () => {
    it('should not be able to undo initially', () => {
      expect(canUndo()).toBe(false);
    });

    it('should not be able to redo initially', () => {
      expect(canRedo()).toBe(false);
    });

    it('should be able to undo after change', () => {
      setValue({ topLeft: 10, topRight: 10, bottomRight: 10, bottomLeft: 10 });
      expect(canUndo()).toBe(true);
    });

    it('should undo to previous value', () => {
      setValue({ topLeft: 10, topRight: 10, bottomRight: 10, bottomLeft: 10 });
      setValue({ topLeft: 20, topRight: 20, bottomRight: 20, bottomLeft: 20 });

      undo();
      expect(getValue().topLeft).toBe(10);
    });

    it('should redo after undo', () => {
      setValue({ topLeft: 10, topRight: 10, bottomRight: 10, bottomLeft: 10 });
      setValue({ topLeft: 20, topRight: 20, bottomRight: 20, bottomLeft: 20 });

      undo();
      expect(canRedo()).toBe(true);
    });

    it('should return null when nothing to undo', () => {
      expect(undo()).toBeNull();
    });

    it('should return null when nothing to redo', () => {
      expect(redo()).toBeNull();
    });

    it('should clear history', () => {
      setValue({ topLeft: 10, topRight: 10, bottomRight: 10, bottomLeft: 10 });
      setValue({ topLeft: 20, topRight: 20, bottomRight: 20, bottomLeft: 20 });

      clearHistory();

      expect(canUndo()).toBe(false);
      expect(canRedo()).toBe(false);
    });
  });

  describe('Change Handlers', () => {
    it('should notify on value change', () => {
      const events: BorderRadiusChangeEvent[] = [];
      onChange(event => events.push(event));

      setValue({ topLeft: 15, topRight: 15, bottomRight: 15, bottomLeft: 15 });

      expect(events.length).toBe(1);
      expect(events[0].newValue.topLeft).toBe(15);
      expect(events[0].source).toBe('input');
    });

    it('should notify on corner change', () => {
      const events: BorderRadiusChangeEvent[] = [];
      onChange(event => events.push(event));

      setCornerValue('topLeft', 25);

      expect(events.length).toBe(1);
      expect(events[0].source).toBe('slider');
    });

    it('should unsubscribe handler', () => {
      const events: BorderRadiusChangeEvent[] = [];
      const unsubscribe = onChange(event => events.push(event));

      setValue({ topLeft: 10, topRight: 10, bottomRight: 10, bottomLeft: 10 });
      expect(events.length).toBe(1);

      unsubscribe();

      setValue({ topLeft: 20, topRight: 20, bottomRight: 20, bottomLeft: 20 });
      expect(events.length).toBe(1); // No new events
    });
  });

  describe('Slider Interaction', () => {
    it('should calculate slider position', () => {
      expect(getSliderPosition(0)).toBe(0);
      expect(getSliderPosition(25)).toBe(50);
      expect(getSliderPosition(50)).toBe(100);
    });

    it('should get value from position', () => {
      expect(getValueFromPosition(0)).toBe(0);
      expect(getValueFromPosition(50)).toBe(25);
      expect(getValueFromPosition(100)).toBe(50);
    });

    it('should snap to step', () => {
      setSliderConfig({ step: 5 });

      expect(snapToStep(12)).toBe(10);
      expect(snapToStep(13)).toBe(15);
      expect(snapToStep(17)).toBe(15);
      expect(snapToStep(18)).toBe(20);
    });

    it('should generate tick marks', () => {
      const ticks = getTickMarks();

      expect(ticks.length).toBe(6); // 0, 10, 20, 30, 40, 50
      expect(ticks[0].value).toBe(0);
      expect(ticks[0].position).toBe(0);
      expect(ticks[5].value).toBe(50);
      expect(ticks[5].position).toBe(100);
    });
  });

  describe('CSS Output', () => {
    it('should output CSS value', () => {
      setValue({ topLeft: 10, topRight: 10, bottomRight: 10, bottomLeft: 10 });
      expect(toCSSValue()).toBe('10px');
    });

    it('should output CSS object', () => {
      setValue({ topLeft: 10, topRight: 20, bottomRight: 30, bottomLeft: 40 });

      const css = toCSSObject();
      expect(css.borderTopLeftRadius).toBe('10px');
      expect(css.borderTopRightRadius).toBe('20px');
      expect(css.borderBottomRightRadius).toBe('30px');
      expect(css.borderBottomLeftRadius).toBe('40px');
    });

    it('should output Tailwind class for standard value', () => {
      setValue({ topLeft: 8, topRight: 8, bottomRight: 8, bottomLeft: 8 });
      expect(toTailwindClass()).toBe('rounded-lg');
    });

    it('should output Tailwind class for arbitrary value', () => {
      setValue({ topLeft: 15, topRight: 15, bottomRight: 15, bottomLeft: 15 });
      expect(toTailwindClass()).toBe('rounded-[15px]');
    });

    it('should output Tailwind classes for non-uniform values', () => {
      setValue({ topLeft: 10, topRight: 20, bottomRight: 10, bottomLeft: 20 });
      const result = toTailwindClass();

      expect(result).toContain('rounded-tl-[10px]');
      expect(result).toContain('rounded-tr-[20px]');
    });
  });

  describe('Reset', () => {
    it('should reset all state', () => {
      setValue({ topLeft: 25, topRight: 25, bottomRight: 25, bottomLeft: 25 });
      setLinked(false);
      setUnit('rem');
      addCustomPreset('Custom');

      resetBorderRadiusAdjuster();

      expect(getValue().topLeft).toBe(0);
      expect(isLinked()).toBe(true);
      expect(getUnit()).toBe('px');
      expect(getPresets().find(p => p.name === 'Custom')).toBeUndefined();
    });
  });

  describe('Verification: Slider adjusts border radius from 0 to 50px', () => {
    it('should have default range of 0 to 50', () => {
      const config = getSliderConfig();

      expect(config.min).toBe(0);
      expect(config.max).toBe(50);
    });

    it('should accept values from 0 to 50', () => {
      setCornerValue('topLeft', 0);
      expect(getValue().topLeft).toBe(0);

      setCornerValue('topLeft', 25);
      expect(getValue().topLeft).toBe(25);

      setCornerValue('topLeft', 50);
      expect(getValue().topLeft).toBe(50);
    });

    it('should clamp values below 0', () => {
      setValue({ topLeft: -10, topRight: -10, bottomRight: -10, bottomLeft: -10 });
      expect(getValue().topLeft).toBe(0);
    });

    it('should clamp values above 50', () => {
      setValue({ topLeft: 100, topRight: 100, bottomRight: 100, bottomLeft: 100 });
      expect(getValue().topLeft).toBe(50);
    });

    it('should support full slider range interaction', () => {
      // Simulate dragging slider from 0% to 100%
      for (let position = 0; position <= 100; position += 10) {
        const value = getValueFromPosition(position);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(50);
      }
    });

    it('should update all corners when linked and using slider', () => {
      expect(isLinked()).toBe(true);

      setCornerValue('topLeft', 30, 'slider');

      const value = getValue();
      expect(value.topLeft).toBe(30);
      expect(value.topRight).toBe(30);
      expect(value.bottomRight).toBe(30);
      expect(value.bottomLeft).toBe(30);
    });
  });
});
