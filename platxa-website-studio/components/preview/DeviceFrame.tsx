"use client";

import { cn } from "@/lib/utils/cn";

// =============================================================================
// Types & Constants
// =============================================================================

export type DeviceType = "mobile" | "tablet" | "desktop";

export interface DeviceSpec {
  /** Viewport width in pixels (or "100%" for desktop) */
  width: number | string;
  /** Viewport height in pixels (or "100%" for desktop) */
  height: number | string;
  /** Human-readable label */
  label: string;
  /** CSS media query equivalent */
  mediaQuery: string;
}

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

// =============================================================================
// Component
// =============================================================================

interface DeviceFrameProps {
  device: DeviceType;
  children: React.ReactNode;
}

export function DeviceFrame({ device, children }: DeviceFrameProps) {
  const spec = DEVICE_SPECS[device];

  if (device === "desktop") {
    return (
      <div className="w-full h-full bg-white rounded-lg shadow-lg overflow-hidden relative">
        {children}
      </div>
    );
  }

  if (device === "tablet") {
    return (
      <div
        className={cn(
          "relative bg-gray-900 rounded-[1.75rem] p-3 shadow-2xl",
          "transition-all duration-300",
        )}
        style={{
          width: (spec.width as number) + 24,
          height: (spec.height as number) + 48,
        }}
        data-device="tablet"
      >
        {/* Front camera */}
        <div className="flex items-center justify-center mb-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-gray-700 ring-1 ring-gray-600" />
        </div>

        {/* Screen */}
        <div
          className="bg-white rounded-lg overflow-hidden relative"
          style={{ width: spec.width, height: spec.height }}
        >
          {children}
        </div>

        {/* Home button area */}
        <div className="flex items-center justify-center mt-1.5">
          <div className="w-8 h-8 rounded-full border-2 border-gray-700" />
        </div>
      </div>
    );
  }

  // Mobile
  return (
    <div
      className={cn(
        "relative bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl",
        "transition-all duration-300",
      )}
      style={{
        width: (spec.width as number) + 24,
        height: (spec.height as number) + 80,
      }}
      data-device="mobile"
    >
      {/* Dynamic Island / Notch */}
      <div className="flex items-center justify-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-gray-700" />
        <div className="w-16 h-5 rounded-full bg-gray-800 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-gray-700 ring-1 ring-gray-600" />
        </div>
        <div className="w-2 h-2 rounded-full bg-gray-700" />
      </div>

      {/* Screen */}
      <div
        className="bg-white rounded-xl overflow-hidden relative"
        style={{ width: spec.width, height: spec.height }}
      >
        {children}
      </div>

      {/* Home indicator */}
      <div className="flex items-center justify-center mt-3">
        <div className="w-24 h-1 rounded-full bg-gray-700" />
      </div>
    </div>
  );
}
