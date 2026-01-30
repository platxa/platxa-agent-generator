/**
 * DeviceFrame — Device frame visualization around preview.
 *
 * Feature #86: Implement device frame visualization around preview
 * Verification: iPhone/iPad/MacBook frames wrap preview at appropriate sizes
 *
 * Provides device mockup frames (iPhone, iPad, MacBook) that wrap around
 * the preview iframe to visualize how the site looks on different devices.
 *
 * @module lib/preview/device-frame
 */

// =============================================================================
// Types
// =============================================================================

/** Device type categories */
export type DeviceCategory = "phone" | "tablet" | "laptop" | "desktop";

/** Device orientation */
export type DeviceOrientation = "portrait" | "landscape";

/** Device color variant */
export type DeviceColor = "black" | "white" | "silver" | "gold" | "spacegray";

/** Device definition */
export interface DeviceDefinition {
  /** Unique device identifier */
  id: string;
  /** Display name */
  name: string;
  /** Device category */
  category: DeviceCategory;
  /** Screen width in pixels */
  screenWidth: number;
  /** Screen height in pixels */
  screenHeight: number;
  /** Device pixel ratio */
  devicePixelRatio: number;
  /** Frame dimensions (including bezel) */
  frameWidth: number;
  /** Frame height (including bezel) */
  frameHeight: number;
  /** Screen offset from frame top */
  screenOffsetTop: number;
  /** Screen offset from frame left */
  screenOffsetLeft: number;
  /** Corner radius for screen */
  screenBorderRadius: number;
  /** Whether device supports landscape */
  supportsLandscape: boolean;
  /** Available colors */
  colors: DeviceColor[];
  /** User agent string (optional) */
  userAgent?: string;
}

/** Device frame state */
export interface DeviceFrameState {
  /** Current device */
  device: DeviceDefinition;
  /** Current orientation */
  orientation: DeviceOrientation;
  /** Current color */
  color: DeviceColor;
  /** Scale factor (1 = 100%) */
  scale: number;
  /** Whether frame is visible */
  showFrame: boolean;
}

/** Device frame options */
export interface DeviceFrameOptions {
  /** Initial device ID */
  deviceId?: string;
  /** Initial orientation */
  orientation?: DeviceOrientation;
  /** Initial color */
  color?: DeviceColor;
  /** Initial scale */
  scale?: number;
  /** Show device frame (vs just resize) */
  showFrame?: boolean;
  /** Custom devices to add */
  customDevices?: DeviceDefinition[];
}

/** Frame style output */
export interface FrameStyles {
  /** Container styles */
  container: Record<string, string>;
  /** Frame wrapper styles */
  frame: Record<string, string>;
  /** Screen area styles */
  screen: Record<string, string>;
  /** Notch styles (if applicable) */
  notch?: Record<string, string>;
  /** Home indicator styles (if applicable) */
  homeIndicator?: Record<string, string>;
}

/** Callback for device changes */
export type DeviceChangeCallback = (state: DeviceFrameState) => void;

// =============================================================================
// Device Catalog
// =============================================================================

/** iPhone device definitions */
export const IPHONE_DEVICES: DeviceDefinition[] = [
  {
    id: "iphone-15-pro",
    name: "iPhone 15 Pro",
    category: "phone",
    screenWidth: 393,
    screenHeight: 852,
    devicePixelRatio: 3,
    frameWidth: 433,
    frameHeight: 892,
    screenOffsetTop: 20,
    screenOffsetLeft: 20,
    screenBorderRadius: 47,
    supportsLandscape: true,
    colors: ["black", "white", "silver"],
  },
  {
    id: "iphone-14",
    name: "iPhone 14",
    category: "phone",
    screenWidth: 390,
    screenHeight: 844,
    devicePixelRatio: 3,
    frameWidth: 430,
    frameHeight: 884,
    screenOffsetTop: 20,
    screenOffsetLeft: 20,
    screenBorderRadius: 44,
    supportsLandscape: true,
    colors: ["black", "white", "silver"],
  },
  {
    id: "iphone-se",
    name: "iPhone SE",
    category: "phone",
    screenWidth: 375,
    screenHeight: 667,
    devicePixelRatio: 2,
    frameWidth: 415,
    frameHeight: 737,
    screenOffsetTop: 35,
    screenOffsetLeft: 20,
    screenBorderRadius: 0,
    supportsLandscape: true,
    colors: ["black", "white", "silver"],
  },
];

/** iPad device definitions */
export const IPAD_DEVICES: DeviceDefinition[] = [
  {
    id: "ipad-pro-12",
    name: 'iPad Pro 12.9"',
    category: "tablet",
    screenWidth: 1024,
    screenHeight: 1366,
    devicePixelRatio: 2,
    frameWidth: 1064,
    frameHeight: 1406,
    screenOffsetTop: 20,
    screenOffsetLeft: 20,
    screenBorderRadius: 18,
    supportsLandscape: true,
    colors: ["spacegray", "silver"],
  },
  {
    id: "ipad-pro-11",
    name: 'iPad Pro 11"',
    category: "tablet",
    screenWidth: 834,
    screenHeight: 1194,
    devicePixelRatio: 2,
    frameWidth: 874,
    frameHeight: 1234,
    screenOffsetTop: 20,
    screenOffsetLeft: 20,
    screenBorderRadius: 18,
    supportsLandscape: true,
    colors: ["spacegray", "silver"],
  },
  {
    id: "ipad-air",
    name: "iPad Air",
    category: "tablet",
    screenWidth: 820,
    screenHeight: 1180,
    devicePixelRatio: 2,
    frameWidth: 860,
    frameHeight: 1220,
    screenOffsetTop: 20,
    screenOffsetLeft: 20,
    screenBorderRadius: 18,
    supportsLandscape: true,
    colors: ["spacegray", "silver", "gold"],
  },
];

/** MacBook device definitions */
export const MACBOOK_DEVICES: DeviceDefinition[] = [
  {
    id: "macbook-pro-16",
    name: 'MacBook Pro 16"',
    category: "laptop",
    screenWidth: 1728,
    screenHeight: 1117,
    devicePixelRatio: 2,
    frameWidth: 1800,
    frameHeight: 1200,
    screenOffsetTop: 24,
    screenOffsetLeft: 36,
    screenBorderRadius: 10,
    supportsLandscape: false,
    colors: ["spacegray", "silver"],
  },
  {
    id: "macbook-pro-14",
    name: 'MacBook Pro 14"',
    category: "laptop",
    screenWidth: 1512,
    screenHeight: 982,
    devicePixelRatio: 2,
    frameWidth: 1580,
    frameHeight: 1060,
    screenOffsetTop: 22,
    screenOffsetLeft: 34,
    screenBorderRadius: 10,
    supportsLandscape: false,
    colors: ["spacegray", "silver"],
  },
  {
    id: "macbook-air-13",
    name: 'MacBook Air 13"',
    category: "laptop",
    screenWidth: 1470,
    screenHeight: 956,
    devicePixelRatio: 2,
    frameWidth: 1540,
    frameHeight: 1030,
    screenOffsetTop: 22,
    screenOffsetLeft: 35,
    screenBorderRadius: 10,
    supportsLandscape: false,
    colors: ["spacegray", "silver", "gold"],
  },
];

/** Desktop monitor definitions */
export const DESKTOP_DEVICES: DeviceDefinition[] = [
  {
    id: "desktop-1920",
    name: "Desktop 1920x1080",
    category: "desktop",
    screenWidth: 1920,
    screenHeight: 1080,
    devicePixelRatio: 1,
    frameWidth: 1960,
    frameHeight: 1140,
    screenOffsetTop: 20,
    screenOffsetLeft: 20,
    screenBorderRadius: 0,
    supportsLandscape: false,
    colors: ["black", "silver"],
  },
  {
    id: "desktop-1440",
    name: "Desktop 1440x900",
    category: "desktop",
    screenWidth: 1440,
    screenHeight: 900,
    devicePixelRatio: 1,
    frameWidth: 1480,
    frameHeight: 960,
    screenOffsetTop: 20,
    screenOffsetLeft: 20,
    screenBorderRadius: 0,
    supportsLandscape: false,
    colors: ["black", "silver"],
  },
];

/** All devices combined */
export const ALL_DEVICES: DeviceDefinition[] = [
  ...IPHONE_DEVICES,
  ...IPAD_DEVICES,
  ...MACBOOK_DEVICES,
  ...DESKTOP_DEVICES,
];

/** Default device */
export const DEFAULT_DEVICE = IPHONE_DEVICES[0];

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Gets a device by ID.
 */
export function getDevice(
  id: string,
  devices: DeviceDefinition[] = ALL_DEVICES
): DeviceDefinition | undefined {
  return devices.find((d) => d.id === id);
}

/**
 * Gets devices by category.
 */
export function getDevicesByCategory(
  category: DeviceCategory,
  devices: DeviceDefinition[] = ALL_DEVICES
): DeviceDefinition[] {
  return devices.filter((d) => d.category === category);
}

/**
 * Gets screen dimensions for a device in given orientation.
 */
export function getScreenDimensions(
  device: DeviceDefinition,
  orientation: DeviceOrientation
): { width: number; height: number } {
  if (orientation === "landscape" && device.supportsLandscape) {
    return {
      width: device.screenHeight,
      height: device.screenWidth,
    };
  }
  return {
    width: device.screenWidth,
    height: device.screenHeight,
  };
}

/**
 * Gets frame dimensions for a device in given orientation.
 */
export function getFrameDimensions(
  device: DeviceDefinition,
  orientation: DeviceOrientation
): { width: number; height: number } {
  if (orientation === "landscape" && device.supportsLandscape) {
    return {
      width: device.frameHeight,
      height: device.frameWidth,
    };
  }
  return {
    width: device.frameWidth,
    height: device.frameHeight,
  };
}

/**
 * Calculates scale to fit device in container.
 */
export function calculateFitScale(
  device: DeviceDefinition,
  orientation: DeviceOrientation,
  containerWidth: number,
  containerHeight: number,
  padding = 40
): number {
  const frame = getFrameDimensions(device, orientation);
  const availableWidth = containerWidth - padding * 2;
  const availableHeight = containerHeight - padding * 2;

  const scaleX = availableWidth / frame.width;
  const scaleY = availableHeight / frame.height;

  return Math.min(scaleX, scaleY, 1); // Don't scale up beyond 100%
}

// =============================================================================
// DeviceFrame Class
// =============================================================================

/**
 * Controls device frame visualization around preview.
 *
 * @example
 * ```typescript
 * const frame = new DeviceFrame({
 *   deviceId: "iphone-15-pro",
 *   orientation: "portrait",
 *   showFrame: true,
 * });
 *
 * // Get styles to apply
 * const styles = frame.getFrameStyles();
 *
 * // Change device
 * frame.setDevice("ipad-air");
 *
 * // Toggle orientation
 * frame.toggleOrientation();
 *
 * // Listen for changes
 * frame.onChange((state) => {
 *   console.log(`Now showing ${state.device.name}`);
 * });
 * ```
 */
export class DeviceFrame {
  private devices: DeviceDefinition[];
  private state: DeviceFrameState;
  private callbacks = new Set<DeviceChangeCallback>();
  private disposed = false;

  constructor(options: DeviceFrameOptions = {}) {
    this.devices = [...ALL_DEVICES, ...(options.customDevices ?? [])];

    const device = getDevice(options.deviceId ?? "iphone-15-pro", this.devices) ?? DEFAULT_DEVICE;

    this.state = {
      device,
      orientation: options.orientation ?? "portrait",
      color: options.color ?? device.colors[0],
      scale: options.scale ?? 1,
      showFrame: options.showFrame ?? true,
    };
  }

  // ---------------------------------------------------------------------------
  // Device Selection
  // ---------------------------------------------------------------------------

  /**
   * Sets the current device.
   */
  setDevice(deviceId: string): boolean {
    const device = getDevice(deviceId, this.devices);
    if (!device) return false;

    this.state.device = device;

    // Reset orientation if not supported
    if (this.state.orientation === "landscape" && !device.supportsLandscape) {
      this.state.orientation = "portrait";
    }

    // Reset color if not available
    if (!device.colors.includes(this.state.color)) {
      this.state.color = device.colors[0];
    }

    this.notifyChange();
    return true;
  }

  /**
   * Gets the current device.
   */
  getDevice(): DeviceDefinition {
    return this.state.device;
  }

  /**
   * Gets all available devices.
   */
  getDevices(): DeviceDefinition[] {
    return [...this.devices];
  }

  /**
   * Gets devices by category.
   */
  getDevicesByCategory(category: DeviceCategory): DeviceDefinition[] {
    return this.devices.filter((d) => d.category === category);
  }

  // ---------------------------------------------------------------------------
  // Orientation
  // ---------------------------------------------------------------------------

  /**
   * Sets the orientation.
   */
  setOrientation(orientation: DeviceOrientation): boolean {
    if (orientation === "landscape" && !this.state.device.supportsLandscape) {
      return false;
    }

    this.state.orientation = orientation;
    this.notifyChange();
    return true;
  }

  /**
   * Toggles between portrait and landscape.
   */
  toggleOrientation(): boolean {
    if (!this.state.device.supportsLandscape) return false;

    this.state.orientation =
      this.state.orientation === "portrait" ? "landscape" : "portrait";
    this.notifyChange();
    return true;
  }

  /**
   * Gets the current orientation.
   */
  getOrientation(): DeviceOrientation {
    return this.state.orientation;
  }

  // ---------------------------------------------------------------------------
  // Color
  // ---------------------------------------------------------------------------

  /**
   * Sets the device color.
   */
  setColor(color: DeviceColor): boolean {
    if (!this.state.device.colors.includes(color)) {
      return false;
    }

    this.state.color = color;
    this.notifyChange();
    return true;
  }

  /**
   * Gets the current color.
   */
  getColor(): DeviceColor {
    return this.state.color;
  }

  /**
   * Gets available colors for current device.
   */
  getAvailableColors(): DeviceColor[] {
    return [...this.state.device.colors];
  }

  // ---------------------------------------------------------------------------
  // Scale
  // ---------------------------------------------------------------------------

  /**
   * Sets the scale.
   */
  setScale(scale: number): void {
    this.state.scale = Math.max(0.1, Math.min(2, scale));
    this.notifyChange();
  }

  /**
   * Gets the current scale.
   */
  getScale(): number {
    return this.state.scale;
  }

  /**
   * Fits the device to a container size.
   */
  fitToContainer(containerWidth: number, containerHeight: number, padding = 40): void {
    const scale = calculateFitScale(
      this.state.device,
      this.state.orientation,
      containerWidth,
      containerHeight,
      padding
    );
    this.setScale(scale);
  }

  // ---------------------------------------------------------------------------
  // Frame Visibility
  // ---------------------------------------------------------------------------

  /**
   * Sets whether to show the device frame.
   */
  setShowFrame(show: boolean): void {
    this.state.showFrame = show;
    this.notifyChange();
  }

  /**
   * Gets whether frame is shown.
   */
  isFrameVisible(): boolean {
    return this.state.showFrame;
  }

  // ---------------------------------------------------------------------------
  // Dimensions
  // ---------------------------------------------------------------------------

  /**
   * Gets current screen dimensions.
   */
  getScreenDimensions(): { width: number; height: number } {
    return getScreenDimensions(this.state.device, this.state.orientation);
  }

  /**
   * Gets current frame dimensions.
   */
  getFrameDimensions(): { width: number; height: number } {
    return getFrameDimensions(this.state.device, this.state.orientation);
  }

  /**
   * Gets scaled dimensions.
   */
  getScaledDimensions(): {
    screen: { width: number; height: number };
    frame: { width: number; height: number };
  } {
    const screen = this.getScreenDimensions();
    const frame = this.getFrameDimensions();

    return {
      screen: {
        width: Math.round(screen.width * this.state.scale),
        height: Math.round(screen.height * this.state.scale),
      },
      frame: {
        width: Math.round(frame.width * this.state.scale),
        height: Math.round(frame.height * this.state.scale),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  /**
   * Gets CSS styles for the frame components.
   */
  getFrameStyles(): FrameStyles {
    const { device, orientation, color, scale, showFrame } = this.state;
    const screen = getScreenDimensions(device, orientation);
    const frame = getFrameDimensions(device, orientation);

    const frameColor = this.getFrameColor(color);
    const isLandscape = orientation === "landscape";

    const styles: FrameStyles = {
      container: {
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        padding: "20px",
      },
      frame: {
        position: "relative",
        width: `${frame.width * scale}px`,
        height: `${frame.height * scale}px`,
        "background-color": showFrame ? frameColor : "transparent",
        "border-radius": showFrame ? `${device.screenBorderRadius * scale + 8}px` : "0",
        "box-shadow": showFrame ? "0 25px 50px -12px rgba(0, 0, 0, 0.4)" : "none",
        transition: "all 0.3s ease",
      },
      screen: {
        position: "absolute",
        top: `${(isLandscape ? device.screenOffsetLeft : device.screenOffsetTop) * scale}px`,
        left: `${(isLandscape ? device.screenOffsetTop : device.screenOffsetLeft) * scale}px`,
        width: `${screen.width * scale}px`,
        height: `${screen.height * scale}px`,
        "border-radius": `${device.screenBorderRadius * scale}px`,
        overflow: "hidden",
        "background-color": "#fff",
      },
    };

    // Add notch for modern iPhones
    if (device.category === "phone" && device.screenBorderRadius > 40) {
      styles.notch = {
        position: "absolute",
        top: `${(isLandscape ? device.screenOffsetLeft : device.screenOffsetTop) * scale}px`,
        left: "50%",
        transform: "translateX(-50%)",
        width: `${126 * scale}px`,
        height: `${34 * scale}px`,
        "background-color": frameColor,
        "border-radius": `0 0 ${20 * scale}px ${20 * scale}px`,
        "z-index": "10",
      };

      // Home indicator
      styles.homeIndicator = {
        position: "absolute",
        bottom: `${((isLandscape ? device.screenOffsetLeft : device.screenOffsetTop) + 8) * scale}px`,
        left: "50%",
        transform: "translateX(-50%)",
        width: `${134 * scale}px`,
        height: `${5 * scale}px`,
        "background-color": showFrame ? "rgba(0,0,0,0.3)" : "transparent",
        "border-radius": `${3 * scale}px`,
      };
    }

    return styles;
  }

  private getFrameColor(color: DeviceColor): string {
    switch (color) {
      case "black":
        return "#1f1f1f";
      case "white":
        return "#f5f5f7";
      case "silver":
        return "#e3e3e8";
      case "gold":
        return "#f5e6d3";
      case "spacegray":
        return "#4a4a4f";
      default:
        return "#1f1f1f";
    }
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /**
   * Gets the full state.
   */
  getState(): DeviceFrameState {
    return { ...this.state };
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  /**
   * Registers a callback for device changes.
   */
  onChange(callback: DeviceChangeCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private notifyChange(): void {
    const state = this.getState();
    for (const callback of this.callbacks) {
      try {
        callback(state);
      } catch (e) {
        console.error("DeviceFrame callback error:", e);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Disposes the instance.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.callbacks.clear();
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates a DeviceFrame instance.
 */
export function createDeviceFrame(options?: DeviceFrameOptions): DeviceFrame {
  return new DeviceFrame(options);
}

// =============================================================================
// Exports
// =============================================================================

export default DeviceFrame;
