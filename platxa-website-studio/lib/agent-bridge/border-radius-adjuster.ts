/**
 * Border Radius Adjuster
 *
 * Floating editor component for adjusting border radius values.
 * Provides slider control from 0 to 50px with live preview.
 */

// ============================================================================
// Types
// ============================================================================

export interface BorderRadiusValue {
  readonly topLeft: number;
  readonly topRight: number;
  readonly bottomRight: number;
  readonly bottomLeft: number;
}

export interface BorderRadiusAdjusterState {
  readonly value: BorderRadiusValue;
  readonly isLinked: boolean;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit: BorderRadiusUnit;
  readonly presets: readonly BorderRadiusPreset[];
  readonly history: readonly BorderRadiusValue[];
  readonly historyIndex: number;
}

export type BorderRadiusUnit = 'px' | 'rem' | 'em' | '%';

export interface BorderRadiusPreset {
  readonly name: string;
  readonly value: BorderRadiusValue;
  readonly icon?: string;
}

export interface SliderConfig {
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly showTicks: boolean;
  readonly tickInterval: number;
}

export interface BorderRadiusChangeEvent {
  readonly previousValue: BorderRadiusValue;
  readonly newValue: BorderRadiusValue;
  readonly corner: BorderRadiusCorner | 'all';
  readonly source: ChangeSource;
}

export type BorderRadiusCorner = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft';
export type ChangeSource = 'slider' | 'input' | 'preset' | 'undo' | 'redo';

export type BorderRadiusChangeHandler = (event: BorderRadiusChangeEvent) => void;

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PRESETS: readonly BorderRadiusPreset[] = [
  { name: 'None', value: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 }, icon: '⬜' },
  { name: 'Small', value: { topLeft: 4, topRight: 4, bottomRight: 4, bottomLeft: 4 }, icon: '▢' },
  { name: 'Medium', value: { topLeft: 8, topRight: 8, bottomRight: 8, bottomLeft: 8 }, icon: '▢' },
  { name: 'Large', value: { topLeft: 16, topRight: 16, bottomRight: 16, bottomLeft: 16 }, icon: '▢' },
  { name: 'XL', value: { topLeft: 24, topRight: 24, bottomRight: 24, bottomLeft: 24 }, icon: '▢' },
  { name: 'Full', value: { topLeft: 50, topRight: 50, bottomRight: 50, bottomLeft: 50 }, icon: '⬤' },
  { name: 'Pill', value: { topLeft: 9999, topRight: 9999, bottomRight: 9999, bottomLeft: 9999 }, icon: '💊' },
  { name: 'Top Only', value: { topLeft: 16, topRight: 16, bottomRight: 0, bottomLeft: 0 }, icon: '⌓' },
  { name: 'Bottom Only', value: { topLeft: 0, topRight: 0, bottomRight: 16, bottomLeft: 16 }, icon: '⌒' },
  { name: 'Left Only', value: { topLeft: 16, topRight: 0, bottomRight: 0, bottomLeft: 16 }, icon: '◐' },
  { name: 'Right Only', value: { topLeft: 0, topRight: 16, bottomRight: 16, bottomLeft: 0 }, icon: '◑' },
];

const DEFAULT_SLIDER_CONFIG: SliderConfig = {
  min: 0,
  max: 50,
  step: 1,
  showTicks: true,
  tickInterval: 10,
};

const MAX_HISTORY_SIZE = 50;

// ============================================================================
// State
// ============================================================================

let state: BorderRadiusAdjusterState = {
  value: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
  isLinked: true,
  min: 0,
  max: 50,
  step: 1,
  unit: 'px',
  presets: DEFAULT_PRESETS,
  history: [],
  historyIndex: -1,
};

let changeHandlers: BorderRadiusChangeHandler[] = [];

// ============================================================================
// Core Functions
// ============================================================================

export function getValue(): BorderRadiusValue {
  return state.value;
}

export function setValue(value: BorderRadiusValue, source: ChangeSource = 'input'): BorderRadiusValue {
  const previousValue = state.value;
  const clampedValue = clampValue(value);

  // Add to history if value actually changed
  if (!valuesEqual(previousValue, clampedValue)) {
    addToHistory(previousValue);
  }

  state = {
    ...state,
    value: clampedValue,
  };

  notifyChange({
    previousValue,
    newValue: clampedValue,
    corner: 'all',
    source,
  });

  return clampedValue;
}

export function setCornerValue(
  corner: BorderRadiusCorner,
  value: number,
  source: ChangeSource = 'slider'
): BorderRadiusValue {
  const previousValue = state.value;
  const clampedCornerValue = clampNumber(value, state.min, state.max);

  let newValue: BorderRadiusValue;

  if (state.isLinked) {
    // When linked, all corners get the same value
    newValue = {
      topLeft: clampedCornerValue,
      topRight: clampedCornerValue,
      bottomRight: clampedCornerValue,
      bottomLeft: clampedCornerValue,
    };
  } else {
    // When unlinked, only update the specific corner
    newValue = {
      ...previousValue,
      [corner]: clampedCornerValue,
    };
  }

  // Add to history if value actually changed
  if (!valuesEqual(previousValue, newValue)) {
    addToHistory(previousValue);
  }

  state = {
    ...state,
    value: newValue,
  };

  notifyChange({
    previousValue,
    newValue,
    corner: state.isLinked ? 'all' : corner,
    source,
  });

  return newValue;
}

export function getUniformValue(): number | null {
  const { topLeft, topRight, bottomRight, bottomLeft } = state.value;
  if (topLeft === topRight && topRight === bottomRight && bottomRight === bottomLeft) {
    return topLeft;
  }
  return null;
}

// ============================================================================
// Linked Mode
// ============================================================================

export function isLinked(): boolean {
  return state.isLinked;
}

export function setLinked(linked: boolean): void {
  state = {
    ...state,
    isLinked: linked,
  };
}

export function toggleLinked(): boolean {
  const newLinked = !state.isLinked;
  setLinked(newLinked);
  return newLinked;
}

// ============================================================================
// Slider Configuration
// ============================================================================

export function getSliderConfig(): SliderConfig {
  return {
    min: state.min,
    max: state.max,
    step: state.step,
    showTicks: true,
    tickInterval: 10,
  };
}

export function setSliderConfig(config: Partial<SliderConfig>): SliderConfig {
  state = {
    ...state,
    min: config.min ?? state.min,
    max: config.max ?? state.max,
    step: config.step ?? state.step,
  };

  // Re-clamp current value to new bounds
  const clampedValue = clampValue(state.value);
  if (!valuesEqual(state.value, clampedValue)) {
    state = {
      ...state,
      value: clampedValue,
    };
  }

  return getSliderConfig();
}

// ============================================================================
// Unit Handling
// ============================================================================

export function getUnit(): BorderRadiusUnit {
  return state.unit;
}

export function setUnit(unit: BorderRadiusUnit): void {
  state = {
    ...state,
    unit,
  };
}

export function formatValue(value: number): string {
  return `${value}${state.unit}`;
}

export function formatBorderRadius(): string {
  const { topLeft, topRight, bottomRight, bottomLeft } = state.value;
  const unit = state.unit;

  // Check for uniform value
  if (topLeft === topRight && topRight === bottomRight && bottomRight === bottomLeft) {
    return `${topLeft}${unit}`;
  }

  // Check for shorthand (top-left/bottom-right and top-right/bottom-left)
  if (topLeft === bottomRight && topRight === bottomLeft) {
    return `${topLeft}${unit} ${topRight}${unit}`;
  }

  // Full syntax
  return `${topLeft}${unit} ${topRight}${unit} ${bottomRight}${unit} ${bottomLeft}${unit}`;
}

export function parseBorderRadius(cssValue: string): BorderRadiusValue | null {
  const trimmed = cssValue.trim();
  if (!trimmed) {
    return null;
  }

  // Extract numeric values (handle px, rem, em, %)
  const values = trimmed.match(/[\d.]+/g);
  if (!values) {
    return null;
  }

  const nums = values.map(v => parseFloat(v));

  switch (nums.length) {
    case 1:
      return { topLeft: nums[0], topRight: nums[0], bottomRight: nums[0], bottomLeft: nums[0] };
    case 2:
      return { topLeft: nums[0], topRight: nums[1], bottomRight: nums[0], bottomLeft: nums[1] };
    case 3:
      return { topLeft: nums[0], topRight: nums[1], bottomRight: nums[2], bottomLeft: nums[1] };
    case 4:
      return { topLeft: nums[0], topRight: nums[1], bottomRight: nums[2], bottomLeft: nums[3] };
    default:
      return null;
  }
}

// ============================================================================
// Presets
// ============================================================================

export function getPresets(): readonly BorderRadiusPreset[] {
  return state.presets;
}

export function applyPreset(presetName: string): BorderRadiusValue | null {
  const preset = state.presets.find(p => p.name === presetName);
  if (!preset) {
    return null;
  }

  return setValue(preset.value, 'preset');
}

export function addCustomPreset(name: string, value?: BorderRadiusValue): BorderRadiusPreset {
  const presetValue = value ?? state.value;
  const preset: BorderRadiusPreset = {
    name,
    value: presetValue,
    icon: '★',
  };

  state = {
    ...state,
    presets: [...state.presets, preset],
  };

  return preset;
}

export function removePreset(name: string): boolean {
  const index = state.presets.findIndex(p => p.name === name);
  if (index === -1) {
    return false;
  }

  // Don't allow removing default presets
  if (index < DEFAULT_PRESETS.length) {
    return false;
  }

  state = {
    ...state,
    presets: state.presets.filter(p => p.name !== name),
  };

  return true;
}

export function findMatchingPreset(): BorderRadiusPreset | null {
  return state.presets.find(p => valuesEqual(p.value, state.value)) ?? null;
}

// ============================================================================
// History (Undo/Redo)
// ============================================================================

export function canUndo(): boolean {
  return state.historyIndex >= 0;
}

export function canRedo(): boolean {
  return state.historyIndex < state.history.length - 1;
}

export function undo(): BorderRadiusValue | null {
  if (!canUndo()) {
    return null;
  }

  const previousValue = state.value;
  const historyValue = state.history[state.historyIndex];

  state = {
    ...state,
    value: historyValue,
    historyIndex: state.historyIndex - 1,
  };

  notifyChange({
    previousValue,
    newValue: historyValue,
    corner: 'all',
    source: 'undo',
  });

  return historyValue;
}

export function redo(): BorderRadiusValue | null {
  if (!canRedo()) {
    return null;
  }

  const previousValue = state.value;
  const nextIndex = state.historyIndex + 1;
  const historyValue = state.history[nextIndex + 1] ?? previousValue;

  // Move forward in history
  state = {
    ...state,
    historyIndex: nextIndex,
  };

  // Get the value that was at this point
  const newValue = nextIndex + 1 < state.history.length
    ? state.history[nextIndex + 1]
    : state.value;

  if (!valuesEqual(previousValue, newValue)) {
    state = {
      ...state,
      value: newValue,
    };

    notifyChange({
      previousValue,
      newValue,
      corner: 'all',
      source: 'redo',
    });
  }

  return state.value;
}

function addToHistory(value: BorderRadiusValue): void {
  // Truncate any redo history
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(value);

  // Enforce max history size
  if (newHistory.length > MAX_HISTORY_SIZE) {
    newHistory.shift();
  }

  state = {
    ...state,
    history: newHistory,
    historyIndex: newHistory.length - 1,
  };
}

export function clearHistory(): void {
  state = {
    ...state,
    history: [],
    historyIndex: -1,
  };
}

// ============================================================================
// Change Handlers
// ============================================================================

export function onChange(handler: BorderRadiusChangeHandler): () => void {
  changeHandlers.push(handler);

  // Return unsubscribe function
  return () => {
    changeHandlers = changeHandlers.filter(h => h !== handler);
  };
}

function notifyChange(event: BorderRadiusChangeEvent): void {
  for (const handler of changeHandlers) {
    handler(event);
  }
}

// ============================================================================
// Slider Interaction Helpers
// ============================================================================

export function getSliderPosition(value: number): number {
  const range = state.max - state.min;
  if (range === 0) {
    return 0;
  }
  return ((value - state.min) / range) * 100;
}

export function getValueFromPosition(positionPercent: number): number {
  const range = state.max - state.min;
  const rawValue = state.min + (positionPercent / 100) * range;
  return snapToStep(rawValue);
}

export function snapToStep(value: number): number {
  const stepped = Math.round(value / state.step) * state.step;
  return clampNumber(stepped, state.min, state.max);
}

export function getTickMarks(): readonly { position: number; value: number; label: string }[] {
  const config = getSliderConfig();
  if (!config.showTicks) {
    return [];
  }

  const marks: { position: number; value: number; label: string }[] = [];
  for (let value = config.min; value <= config.max; value += config.tickInterval) {
    marks.push({
      position: getSliderPosition(value),
      value,
      label: `${value}`,
    });
  }

  return marks;
}

// ============================================================================
// CSS Output
// ============================================================================

export function toCSSValue(): string {
  return formatBorderRadius();
}

export function toCSSObject(): Record<string, string> {
  const { topLeft, topRight, bottomRight, bottomLeft } = state.value;
  const unit = state.unit;

  return {
    borderTopLeftRadius: `${topLeft}${unit}`,
    borderTopRightRadius: `${topRight}${unit}`,
    borderBottomRightRadius: `${bottomRight}${unit}`,
    borderBottomLeftRadius: `${bottomLeft}${unit}`,
  };
}

export function toTailwindClass(): string {
  const uniform = getUniformValue();

  if (uniform === null) {
    // Non-uniform values - return individual classes
    const { topLeft, topRight, bottomRight, bottomLeft } = state.value;
    return `rounded-tl-[${topLeft}px] rounded-tr-[${topRight}px] rounded-br-[${bottomRight}px] rounded-bl-[${bottomLeft}px]`;
  }

  // Map to Tailwind classes
  const tailwindMap: Record<number, string> = {
    0: 'rounded-none',
    2: 'rounded-sm',
    4: 'rounded',
    6: 'rounded-md',
    8: 'rounded-lg',
    12: 'rounded-xl',
    16: 'rounded-2xl',
    24: 'rounded-3xl',
    9999: 'rounded-full',
  };

  return tailwindMap[uniform] ?? `rounded-[${uniform}px]`;
}

// ============================================================================
// Reset
// ============================================================================

export function resetBorderRadiusAdjuster(): void {
  state = {
    value: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
    isLinked: true,
    min: 0,
    max: 50,
    step: 1,
    unit: 'px',
    presets: DEFAULT_PRESETS,
    history: [],
    historyIndex: -1,
  };
  changeHandlers = [];
}

// ============================================================================
// Helpers
// ============================================================================

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampValue(value: BorderRadiusValue): BorderRadiusValue {
  return {
    topLeft: clampNumber(value.topLeft, state.min, state.max),
    topRight: clampNumber(value.topRight, state.min, state.max),
    bottomRight: clampNumber(value.bottomRight, state.min, state.max),
    bottomLeft: clampNumber(value.bottomLeft, state.min, state.max),
  };
}

function valuesEqual(a: BorderRadiusValue, b: BorderRadiusValue): boolean {
  return (
    a.topLeft === b.topLeft &&
    a.topRight === b.topRight &&
    a.bottomRight === b.bottomRight &&
    a.bottomLeft === b.bottomLeft
  );
}
