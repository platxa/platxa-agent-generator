"use client";

import { cn } from "@/lib/utils/cn";

// =============================================================================
// Types & Constants
// =============================================================================

export type DeviceType = "mobile" | "tablet" | "desktop";
export type DeviceOrientation = "portrait" | "landscape";

export interface DeviceModel {
  id: string;
  name: string;
  type: DeviceType;
  width: number;
  height: number;
  /** Whether device supports landscape orientation */
  supportsLandscape: boolean;
  /** Has notch/dynamic island */
  hasNotch: boolean;
  /** Has home button */
  hasHomeButton: boolean;
  /** Device pixel ratio */
  dpr: number;
  /** Bezel radius in rem */
  bezelRadius: number;
}

export interface DeviceSpec {
  width: number | string;
  height: number | string;
  label: string;
  mediaQuery: string;
}

// Full device catalog
export const DEVICE_MODELS: DeviceModel[] = [
  // Phones
  {
    id: "iphone-15-pro",
    name: "iPhone 15 Pro",
    type: "mobile",
    width: 393,
    height: 852,
    supportsLandscape: true,
    hasNotch: true,
    hasHomeButton: false,
    dpr: 3,
    bezelRadius: 2.75,
  },
  {
    id: "iphone-14",
    name: "iPhone 14",
    type: "mobile",
    width: 390,
    height: 844,
    supportsLandscape: true,
    hasNotch: true,
    hasHomeButton: false,
    dpr: 3,
    bezelRadius: 2.75,
  },
  {
    id: "iphone-se",
    name: "iPhone SE",
    type: "mobile",
    width: 375,
    height: 667,
    supportsLandscape: true,
    hasNotch: false,
    hasHomeButton: true,
    dpr: 2,
    bezelRadius: 2,
  },
  {
    id: "pixel-7",
    name: "Pixel 7",
    type: "mobile",
    width: 412,
    height: 915,
    supportsLandscape: true,
    hasNotch: true,
    hasHomeButton: false,
    dpr: 2.625,
    bezelRadius: 2.5,
  },
  {
    id: "samsung-s23",
    name: "Samsung S23",
    type: "mobile",
    width: 360,
    height: 780,
    supportsLandscape: true,
    hasNotch: true,
    hasHomeButton: false,
    dpr: 3,
    bezelRadius: 2.5,
  },
  // Tablets
  {
    id: "ipad-pro-12",
    name: 'iPad Pro 12.9"',
    type: "tablet",
    width: 1024,
    height: 1366,
    supportsLandscape: true,
    hasNotch: false,
    hasHomeButton: false,
    dpr: 2,
    bezelRadius: 1.75,
  },
  {
    id: "ipad-pro-11",
    name: 'iPad Pro 11"',
    type: "tablet",
    width: 834,
    height: 1194,
    supportsLandscape: true,
    hasNotch: false,
    hasHomeButton: false,
    dpr: 2,
    bezelRadius: 1.75,
  },
  {
    id: "ipad-air",
    name: "iPad Air",
    type: "tablet",
    width: 820,
    height: 1180,
    supportsLandscape: true,
    hasNotch: false,
    hasHomeButton: false,
    dpr: 2,
    bezelRadius: 1.75,
  },
  {
    id: "ipad-mini",
    name: "iPad Mini",
    type: "tablet",
    width: 768,
    height: 1024,
    supportsLandscape: true,
    hasNotch: false,
    hasHomeButton: true,
    dpr: 2,
    bezelRadius: 1.5,
  },
  // Desktop/Laptops
  {
    id: "macbook-16",
    name: 'MacBook Pro 16"',
    type: "desktop",
    width: 1728,
    height: 1117,
    supportsLandscape: false,
    hasNotch: true,
    hasHomeButton: false,
    dpr: 2,
    bezelRadius: 0.75,
  },
  {
    id: "macbook-14",
    name: 'MacBook Pro 14"',
    type: "desktop",
    width: 1512,
    height: 982,
    supportsLandscape: false,
    hasNotch: true,
    hasHomeButton: false,
    dpr: 2,
    bezelRadius: 0.75,
  },
  {
    id: "macbook-air",
    name: 'MacBook Air 13"',
    type: "desktop",
    width: 1470,
    height: 956,
    supportsLandscape: false,
    hasNotch: true,
    hasHomeButton: false,
    dpr: 2,
    bezelRadius: 0.75,
  },
  {
    id: "desktop-1920",
    name: "Desktop 1920×1080",
    type: "desktop",
    width: 1920,
    height: 1080,
    supportsLandscape: false,
    hasNotch: false,
    hasHomeButton: false,
    dpr: 1,
    bezelRadius: 0.5,
  },
  {
    id: "desktop-1440",
    name: "Desktop 1440×900",
    type: "desktop",
    width: 1440,
    height: 900,
    supportsLandscape: false,
    hasNotch: false,
    hasHomeButton: false,
    dpr: 1,
    bezelRadius: 0.5,
  },
];

// Simple device specs for backward compatibility
export const DEVICE_SPECS: Record<DeviceType, DeviceSpec> = {
  mobile: {
    width: 375,
    height: 667,
    label: "iPhone SE",
    mediaQuery: "(max-width: 767px)",
  },
  tablet: {
    width: 768,
    height: 1024,
    label: "iPad",
    mediaQuery: "(min-width: 768px) and (max-width: 1023px)",
  },
  desktop: {
    width: "100%",
    height: "100%",
    label: "Desktop",
    mediaQuery: "(min-width: 1024px)",
  },
};

// Get devices by type
export function getDevicesByType(type: DeviceType): DeviceModel[] {
  return DEVICE_MODELS.filter((d) => d.type === type);
}

// Get device by ID
export function getDeviceById(id: string): DeviceModel | undefined {
  return DEVICE_MODELS.find((d) => d.id === id);
}

// Get default device for type
export function getDefaultDevice(type: DeviceType): DeviceModel {
  const devices = getDevicesByType(type);
  return devices[0] || DEVICE_MODELS[0];
}

// =============================================================================
// Component
// =============================================================================

interface DeviceFrameProps {
  /** Device type (simple mode) */
  device?: DeviceType;
  /** Specific device model ID (advanced mode) */
  deviceId?: string;
  /** Orientation (for devices that support it) */
  orientation?: DeviceOrientation;
  /** Children to render inside frame */
  children: React.ReactNode;
  /** Show device chrome (bezels, notch, etc.) */
  showChrome?: boolean;
  /** Scale factor for the entire frame */
  scale?: number;
  /** Additional class names */
  className?: string;
}

export function DeviceFrame({
  device = "desktop",
  deviceId,
  orientation = "portrait",
  children,
  showChrome = true,
  scale = 1,
  className,
}: DeviceFrameProps) {
  // Get device model
  const model = deviceId ? getDeviceById(deviceId) : getDefaultDevice(device);

  if (!model) {
    return (
      <div className="w-full h-full bg-white rounded-lg shadow-lg overflow-hidden relative">
        {children}
      </div>
    );
  }

  // Calculate dimensions based on orientation
  const isLandscape = orientation === "landscape" && model.supportsLandscape;
  const viewportWidth = isLandscape ? model.height : model.width;
  const viewportHeight = isLandscape ? model.width : model.height;

  // Desktop - minimal or no chrome
  if (model.type === "desktop") {
    if (!showChrome) {
      return (
        <div
          className={cn("bg-white overflow-hidden relative", className)}
          style={{
            width: viewportWidth === 1920 || viewportWidth === 1440 ? "100%" : viewportWidth * scale,
            height: "100%",
          }}
        >
          {children}
        </div>
      );
    }

    // MacBook-style frame
    if (model.id.startsWith("macbook")) {
      return (
        <div
          className={cn("flex flex-col items-center", className)}
          style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}
        >
          {/* Screen housing */}
          <div
            className="relative bg-gray-800 rounded-t-xl p-1.5"
            style={{ width: viewportWidth + 24 }}
          >
            {/* Notch */}
            {model.hasNotch && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-gray-900 rounded-b-lg flex items-center justify-center z-10">
                <div className="w-2 h-2 rounded-full bg-gray-700" />
              </div>
            )}
            {/* Screen */}
            <div
              className="bg-white rounded-lg overflow-hidden relative"
              style={{ width: viewportWidth, height: viewportHeight }}
            >
              {children}
            </div>
          </div>
          {/* Base */}
          <div
            className="h-3 bg-gradient-to-b from-gray-700 to-gray-800 rounded-b-lg"
            style={{ width: viewportWidth + 48 }}
          />
          <div
            className="h-1 bg-gray-600 rounded-b"
            style={{ width: viewportWidth + 80 }}
          />
        </div>
      );
    }

    // Regular desktop monitor frame
    return (
      <div
        className={cn("flex flex-col items-center", className)}
        style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}
      >
        <div className="relative bg-gray-900 rounded-lg p-2">
          <div
            className="bg-white rounded overflow-hidden relative"
            style={{ width: "100%", height: "100%", maxWidth: viewportWidth, maxHeight: viewportHeight }}
          >
            {children}
          </div>
        </div>
      </div>
    );
  }

  // Tablet frame
  if (model.type === "tablet") {
    const frameWidth = viewportWidth + 24;
    const frameHeight = viewportHeight + (model.hasHomeButton ? 56 : 40);

    return (
      <div
        className={cn(
          "relative bg-gray-900 shadow-2xl transition-all duration-300",
          className
        )}
        style={{
          width: frameWidth * scale,
          height: frameHeight * scale,
          borderRadius: `${model.bezelRadius}rem`,
          padding: "12px",
          transform: `scale(${scale})`,
          transformOrigin: "top center",
        }}
        data-device="tablet"
        data-orientation={orientation}
      >
        {/* Front camera */}
        <div className="flex items-center justify-center mb-2">
          <div className="w-2.5 h-2.5 rounded-full bg-gray-700 ring-1 ring-gray-600" />
        </div>

        {/* Screen */}
        <div
          className="bg-white rounded-lg overflow-hidden relative"
          style={{ width: viewportWidth, height: viewportHeight }}
        >
          {children}
        </div>

        {/* Home button or indicator */}
        <div className="flex items-center justify-center mt-2">
          {model.hasHomeButton ? (
            <div className="w-10 h-10 rounded-full border-2 border-gray-700" />
          ) : (
            <div className="w-24 h-1 rounded-full bg-gray-700" />
          )}
        </div>
      </div>
    );
  }

  // Mobile phone frame
  const frameWidth = viewportWidth + 24;
  const frameHeight = viewportHeight + (model.hasHomeButton ? 96 : 80);

  return (
    <div
      className={cn(
        "relative bg-gray-900 shadow-2xl transition-all duration-300",
        className
      )}
      style={{
        width: frameWidth * scale,
        height: frameHeight * scale,
        borderRadius: `${model.bezelRadius}rem`,
        padding: "12px",
        transform: `scale(${scale})`,
        transformOrigin: "top center",
      }}
      data-device="mobile"
      data-orientation={orientation}
      data-model={model.id}
    >
      {/* Dynamic Island / Notch / Speaker */}
      <div className="flex items-center justify-center gap-2 mb-2">
        {model.hasNotch ? (
          <>
            <div className="w-2 h-2 rounded-full bg-gray-700" />
            <div className="w-20 h-6 rounded-full bg-gray-800 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-gray-700 ring-1 ring-gray-600" />
            </div>
            <div className="w-2 h-2 rounded-full bg-gray-700" />
          </>
        ) : (
          <>
            <div className="w-12 h-1.5 rounded-full bg-gray-700" />
            <div className="w-2 h-2 rounded-full bg-gray-700 ml-2" />
          </>
        )}
      </div>

      {/* Screen */}
      <div
        className="bg-white overflow-hidden relative"
        style={{
          width: viewportWidth,
          height: viewportHeight,
          borderRadius: model.hasNotch ? "1rem" : "0.5rem",
        }}
      >
        {children}
      </div>

      {/* Home button or indicator */}
      <div className="flex items-center justify-center mt-3">
        {model.hasHomeButton ? (
          <div className="w-12 h-12 rounded-full border-2 border-gray-700" />
        ) : (
          <div className="w-28 h-1 rounded-full bg-gray-700" />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Device Selector Component
// =============================================================================

interface DeviceSelectorProps {
  /** Currently selected device type */
  deviceType: DeviceType;
  /** Currently selected device ID */
  deviceId?: string;
  /** Current orientation */
  orientation: DeviceOrientation;
  /** Callback when device changes */
  onDeviceChange: (type: DeviceType, deviceId?: string) => void;
  /** Callback when orientation changes */
  onOrientationChange: (orientation: DeviceOrientation) => void;
}

export function DeviceSelector({
  deviceType,
  deviceId,
  orientation,
  onDeviceChange,
  onOrientationChange,
}: DeviceSelectorProps) {
  const currentDevice = deviceId ? getDeviceById(deviceId) : getDefaultDevice(deviceType);

  return (
    <div className="flex items-center gap-2">
      {/* Device type quick select is handled in parent */}
      {/* This component provides the detailed model selector */}
      <select
        value={deviceId || currentDevice?.id}
        onChange={(e) => {
          const model = getDeviceById(e.target.value);
          if (model) {
            onDeviceChange(model.type, model.id);
          }
        }}
        className="h-8 px-2 text-xs bg-background border rounded-md"
      >
        <optgroup label="Phones">
          {getDevicesByType("mobile").map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.width}×{d.height})
            </option>
          ))}
        </optgroup>
        <optgroup label="Tablets">
          {getDevicesByType("tablet").map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.width}×{d.height})
            </option>
          ))}
        </optgroup>
        <optgroup label="Desktop">
          {getDevicesByType("desktop").map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.width}×{d.height})
            </option>
          ))}
        </optgroup>
      </select>

      {/* Orientation toggle (only for devices that support it) */}
      {currentDevice?.supportsLandscape && (
        <button
          onClick={() =>
            onOrientationChange(orientation === "portrait" ? "landscape" : "portrait")
          }
          className={cn(
            "h-8 px-2 text-xs border rounded-md transition-colors",
            "hover:bg-muted"
          )}
          title={`Switch to ${orientation === "portrait" ? "landscape" : "portrait"}`}
        >
          {orientation === "portrait" ? "⬜" : "▭"}
        </button>
      )}
    </div>
  );
}
