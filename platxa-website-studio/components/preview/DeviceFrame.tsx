"use client";

import { cn } from "@/lib/utils/cn";

type DeviceType = "mobile" | "tablet" | "desktop";

interface DeviceFrameProps {
  device: DeviceType;
  children: React.ReactNode;
}

const DEVICE_SIZES: Record<DeviceType, { width: number | string; height: number | string }> = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: "100%", height: "100%" },
};

export function DeviceFrame({ device, children }: DeviceFrameProps) {
  const size = DEVICE_SIZES[device];

  if (device === "desktop") {
    return (
      <div className="w-full h-full bg-white rounded-lg shadow-lg overflow-hidden relative">
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl",
        "transition-all duration-300"
      )}
      style={{
        width: typeof size.width === "number" ? size.width + 24 : size.width,
        height: typeof size.height === "number" ? size.height + 80 : size.height,
      }}
    >
      {/* Top speaker/camera area */}
      <div className="flex items-center justify-center gap-2 mb-2">
        {device === "mobile" && (
          <>
            <div className="w-2 h-2 rounded-full bg-gray-700" />
            <div className="w-16 h-4 rounded-full bg-gray-800" />
            <div className="w-2 h-2 rounded-full bg-gray-700" />
          </>
        )}
      </div>

      {/* Screen */}
      <div
        className="bg-white rounded-xl overflow-hidden relative"
        style={{
          width: size.width,
          height: size.height,
        }}
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
