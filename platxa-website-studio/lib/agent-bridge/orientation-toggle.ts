/**
 * Orientation Toggle
 *
 * Manages device frame orientation for mobile preview.
 * Supports portrait/landscape toggle with rotation animation.
 */

// ============================================================================
// Types
// ============================================================================

export type Orientation = 'portrait' | 'landscape';

export interface DeviceDimensions {
  readonly width: number;
  readonly height: number;
}

export interface OrientationState {
  readonly orientation: Orientation;
  readonly dimensions: DeviceDimensions;
  readonly isAnimating: boolean;
  readonly rotationAngle: number;
}

export interface DevicePreset {
  readonly name: string;
  readonly portraitWidth: number;
  readonly portraitHeight: number;
  readonly devicePixelRatio: number;
  readonly category: DeviceCategory;
}

export type DeviceCategory = 'phone' | 'tablet' | 'desktop';

export interface OrientationChangeEvent {
  readonly previousOrientation: Orientation;
  readonly newOrientation: Orientation;
  readonly previousDimensions: DeviceDimensions;
  readonly newDimensions: DeviceDimensions;
  readonly device: DevicePreset;
}

export type OrientationChangeHandler = (event: OrientationChangeEvent) => void;

export interface AnimationConfig {
  readonly duration: number;
  readonly easing: string;
  readonly enabled: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_DEVICE_PRESETS: readonly DevicePreset[] = [
  // Phones
  { name: 'iPhone SE', portraitWidth: 375, portraitHeight: 667, devicePixelRatio: 2, category: 'phone' },
  { name: 'iPhone 14', portraitWidth: 390, portraitHeight: 844, devicePixelRatio: 3, category: 'phone' },
  { name: 'iPhone 14 Pro Max', portraitWidth: 430, portraitHeight: 932, devicePixelRatio: 3, category: 'phone' },
  { name: 'Pixel 7', portraitWidth: 412, portraitHeight: 915, devicePixelRatio: 2.625, category: 'phone' },
  { name: 'Samsung Galaxy S23', portraitWidth: 360, portraitHeight: 780, devicePixelRatio: 3, category: 'phone' },
  // Tablets
  { name: 'iPad Mini', portraitWidth: 768, portraitHeight: 1024, devicePixelRatio: 2, category: 'tablet' },
  { name: 'iPad Air', portraitWidth: 820, portraitHeight: 1180, devicePixelRatio: 2, category: 'tablet' },
  { name: 'iPad Pro 11"', portraitWidth: 834, portraitHeight: 1194, devicePixelRatio: 2, category: 'tablet' },
  { name: 'iPad Pro 12.9"', portraitWidth: 1024, portraitHeight: 1366, devicePixelRatio: 2, category: 'tablet' },
  { name: 'Samsung Galaxy Tab S8', portraitWidth: 800, portraitHeight: 1280, devicePixelRatio: 2, category: 'tablet' },
  // Desktop
  { name: 'Desktop HD', portraitWidth: 1280, portraitHeight: 720, devicePixelRatio: 1, category: 'desktop' },
  { name: 'Desktop Full HD', portraitWidth: 1920, portraitHeight: 1080, devicePixelRatio: 1, category: 'desktop' },
  { name: 'Desktop 2K', portraitWidth: 2560, portraitHeight: 1440, devicePixelRatio: 1, category: 'desktop' },
];

const DEFAULT_ANIMATION_CONFIG: AnimationConfig = {
  duration: 300,
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  enabled: true,
};

// ============================================================================
// State
// ============================================================================

interface OrientationToggleState {
  readonly orientation: Orientation;
  readonly selectedDevice: DevicePreset;
  readonly devices: readonly DevicePreset[];
  readonly animationConfig: AnimationConfig;
  readonly isAnimating: boolean;
  readonly rotationHistory: readonly Orientation[];
}

let state: OrientationToggleState = {
  orientation: 'portrait',
  selectedDevice: DEFAULT_DEVICE_PRESETS[1], // iPhone 14
  devices: DEFAULT_DEVICE_PRESETS,
  animationConfig: DEFAULT_ANIMATION_CONFIG,
  isAnimating: false,
  rotationHistory: ['portrait'],
};

let changeHandlers: OrientationChangeHandler[] = [];

// ============================================================================
// Core Functions
// ============================================================================

export function getOrientation(): Orientation {
  return state.orientation;
}

export function setOrientation(orientation: Orientation): OrientationState {
  if (orientation === state.orientation) {
    return getOrientationState();
  }

  const previousOrientation = state.orientation;
  const previousDimensions = getCurrentDimensions();

  state = {
    ...state,
    orientation,
    rotationHistory: [...state.rotationHistory, orientation],
  };

  const newDimensions = getCurrentDimensions();

  notifyChange({
    previousOrientation,
    newOrientation: orientation,
    previousDimensions,
    newDimensions,
    device: state.selectedDevice,
  });

  return getOrientationState();
}

export function toggleOrientation(): OrientationState {
  const newOrientation: Orientation = state.orientation === 'portrait' ? 'landscape' : 'portrait';
  return setOrientation(newOrientation);
}

export function getOrientationState(): OrientationState {
  return {
    orientation: state.orientation,
    dimensions: getCurrentDimensions(),
    isAnimating: state.isAnimating,
    rotationAngle: state.orientation === 'portrait' ? 0 : 90,
  };
}

// ============================================================================
// Dimensions
// ============================================================================

export function getCurrentDimensions(): DeviceDimensions {
  const { portraitWidth, portraitHeight } = state.selectedDevice;

  if (state.orientation === 'portrait') {
    return { width: portraitWidth, height: portraitHeight };
  }

  // Landscape: swap width and height
  return { width: portraitHeight, height: portraitWidth };
}

export function getPortraitDimensions(): DeviceDimensions {
  return {
    width: state.selectedDevice.portraitWidth,
    height: state.selectedDevice.portraitHeight,
  };
}

export function getLandscapeDimensions(): DeviceDimensions {
  return {
    width: state.selectedDevice.portraitHeight,
    height: state.selectedDevice.portraitWidth,
  };
}

export function getAspectRatio(): number {
  const { width, height } = getCurrentDimensions();
  return width / height;
}

export function isPortrait(): boolean {
  return state.orientation === 'portrait';
}

export function isLandscape(): boolean {
  return state.orientation === 'landscape';
}

// ============================================================================
// Device Selection
// ============================================================================

export function getSelectedDevice(): DevicePreset {
  return state.selectedDevice;
}

export function selectDevice(deviceName: string): DevicePreset | null {
  const device = state.devices.find(d => d.name === deviceName);
  if (!device) {
    return null;
  }

  const previousDimensions = getCurrentDimensions();

  state = {
    ...state,
    selectedDevice: device,
  };

  const newDimensions = getCurrentDimensions();

  // Notify if dimensions changed
  if (previousDimensions.width !== newDimensions.width ||
      previousDimensions.height !== newDimensions.height) {
    notifyChange({
      previousOrientation: state.orientation,
      newOrientation: state.orientation,
      previousDimensions,
      newDimensions,
      device,
    });
  }

  return device;
}

export function getDevices(): readonly DevicePreset[] {
  return state.devices;
}

export function getDevicesByCategory(category: DeviceCategory): readonly DevicePreset[] {
  return state.devices.filter(d => d.category === category);
}

export function addCustomDevice(device: DevicePreset): DevicePreset {
  state = {
    ...state,
    devices: [...state.devices, device],
  };
  return device;
}

export function removeDevice(deviceName: string): boolean {
  // Don't allow removing if it's the selected device
  if (state.selectedDevice.name === deviceName) {
    return false;
  }

  const index = state.devices.findIndex(d => d.name === deviceName);
  if (index === -1) {
    return false;
  }

  // Don't remove default devices
  if (index < DEFAULT_DEVICE_PRESETS.length) {
    return false;
  }

  state = {
    ...state,
    devices: state.devices.filter(d => d.name !== deviceName),
  };

  return true;
}

// ============================================================================
// Animation
// ============================================================================

export function getAnimationConfig(): AnimationConfig {
  return state.animationConfig;
}

export function setAnimationConfig(config: Partial<AnimationConfig>): AnimationConfig {
  state = {
    ...state,
    animationConfig: {
      ...state.animationConfig,
      ...config,
    },
  };
  return state.animationConfig;
}

export function setAnimating(isAnimating: boolean): void {
  state = {
    ...state,
    isAnimating,
  };
}

export function isAnimating(): boolean {
  return state.isAnimating;
}

export function getRotationTransform(): string {
  const angle = state.orientation === 'portrait' ? 0 : 90;
  return `rotate(${angle}deg)`;
}

export function getAnimationStyle(): Record<string, string> {
  if (!state.animationConfig.enabled) {
    return {};
  }

  return {
    transition: `transform ${state.animationConfig.duration}ms ${state.animationConfig.easing}`,
    transform: getRotationTransform(),
  };
}

// ============================================================================
// CSS Helpers
// ============================================================================

export function getFrameStyles(): Record<string, string> {
  const dimensions = getCurrentDimensions();

  return {
    width: `${dimensions.width}px`,
    height: `${dimensions.height}px`,
    ...getAnimationStyle(),
  };
}

export function getViewportMeta(): string {
  const dimensions = getCurrentDimensions();
  const dpr = state.selectedDevice.devicePixelRatio;

  return `width=${dimensions.width}, initial-scale=${1 / dpr}`;
}

export function getMediaQuery(): string {
  const dimensions = getCurrentDimensions();
  const orientationQuery = state.orientation === 'portrait'
    ? 'orientation: portrait'
    : 'orientation: landscape';

  return `(max-width: ${dimensions.width}px) and (${orientationQuery})`;
}

// ============================================================================
// Button State
// ============================================================================

export interface ToggleButtonState {
  readonly isPortrait: boolean;
  readonly isLandscape: boolean;
  readonly icon: string;
  readonly label: string;
  readonly ariaLabel: string;
  readonly disabled: boolean;
}

export function getToggleButtonState(): ToggleButtonState {
  const isPortraitMode = state.orientation === 'portrait';

  return {
    isPortrait: isPortraitMode,
    isLandscape: !isPortraitMode,
    icon: isPortraitMode ? '📱' : '📱',
    label: isPortraitMode ? 'Landscape' : 'Portrait',
    ariaLabel: `Switch to ${isPortraitMode ? 'landscape' : 'portrait'} orientation`,
    disabled: state.isAnimating,
  };
}

export function handleToggleClick(): OrientationState | null {
  if (state.isAnimating) {
    return null;
  }

  if (state.animationConfig.enabled) {
    setAnimating(true);

    // Auto-clear animating state after animation completes
    setTimeout(() => {
      setAnimating(false);
    }, state.animationConfig.duration);
  }

  return toggleOrientation();
}

// ============================================================================
// History
// ============================================================================

export function getRotationHistory(): readonly Orientation[] {
  return state.rotationHistory;
}

export function getRotationCount(): number {
  return state.rotationHistory.length - 1; // Subtract initial state
}

export function clearRotationHistory(): void {
  state = {
    ...state,
    rotationHistory: [state.orientation],
  };
}

// ============================================================================
// Change Handlers
// ============================================================================

export function onChange(handler: OrientationChangeHandler): () => void {
  changeHandlers.push(handler);

  return () => {
    changeHandlers = changeHandlers.filter(h => h !== handler);
  };
}

function notifyChange(event: OrientationChangeEvent): void {
  for (const handler of changeHandlers) {
    handler(event);
  }
}

// ============================================================================
// Responsive Helpers
// ============================================================================

export function shouldShowMobileNav(): boolean {
  const { width } = getCurrentDimensions();
  return width < 768;
}

export function shouldShowTabletLayout(): boolean {
  const { width } = getCurrentDimensions();
  return width >= 768 && width < 1024;
}

export function shouldShowDesktopLayout(): boolean {
  const { width } = getCurrentDimensions();
  return width >= 1024;
}

export function getBreakpoint(): 'mobile' | 'tablet' | 'desktop' {
  const { width } = getCurrentDimensions();

  if (width < 768) {
    return 'mobile';
  }
  if (width < 1024) {
    return 'tablet';
  }
  return 'desktop';
}

// ============================================================================
// Reset
// ============================================================================

export function resetOrientationToggle(): void {
  state = {
    orientation: 'portrait',
    selectedDevice: DEFAULT_DEVICE_PRESETS[1],
    devices: DEFAULT_DEVICE_PRESETS,
    animationConfig: DEFAULT_ANIMATION_CONFIG,
    isAnimating: false,
    rotationHistory: ['portrait'],
  };
  changeHandlers = [];
}
