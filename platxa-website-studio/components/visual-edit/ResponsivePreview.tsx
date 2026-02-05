"use client";

/**
 * ResponsivePreview Component
 *
 * Preview controls for switching between viewport sizes (desktop/tablet/mobile).
 * Includes device frame option and custom size input.
 *
 * Features:
 * - Preset device sizes (desktop, tablet, mobile)
 * - Device frame overlay option
 * - Custom width/height input
 * - Zoom controls
 * - Landscape/portrait rotation
 * - Quick access toolbar
 *
 * Feature #27: Visual Edit Mode - Responsive preview controls
 */

import * as React from "react";
import { useState, useCallback, useMemo } from "react";
import {
  Monitor,
  Tablet,
  Smartphone,
  RotateCcw,
  Maximize,
  Minimize,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Settings,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// =============================================================================
// Types
// =============================================================================

/** Device type */
export type DeviceType = "desktop" | "tablet" | "mobile" | "custom";

/** Device orientation */
export type Orientation = "portrait" | "landscape";

/** Device preset */
export interface DevicePreset {
  id: string;
  name: string;
  type: DeviceType;
  width: number;
  height: number;
  icon: React.ComponentType<{ className?: string }>;
  hasFrame?: boolean;
}

/** Viewport state */
export interface ViewportState {
  width: number;
  height: number;
  deviceType: DeviceType;
  deviceId?: string;
  orientation: Orientation;
  zoom: number;
  showFrame: boolean;
}

/** ResponsivePreview props */
export interface ResponsivePreviewProps {
  /** Current viewport state */
  viewport: ViewportState;
  /** Called when viewport changes */
  onViewportChange: (viewport: ViewportState) => void;
  /** Available container width */
  containerWidth?: number;
  /** Available container height */
  containerHeight?: number;
  /** Show device frame toggle */
  showFrameToggle?: boolean;
  /** Show zoom controls */
  showZoomControls?: boolean;
  /** Show custom size input */
  showCustomSize?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Additional class name */
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Device presets */
export const DEVICE_PRESETS: DevicePreset[] = [
  // Desktop
  { id: "desktop-lg", name: "Desktop Large", type: "desktop", width: 1920, height: 1080, icon: Monitor },
  { id: "desktop-md", name: "Desktop", type: "desktop", width: 1440, height: 900, icon: Monitor },
  { id: "desktop-sm", name: "Desktop Small", type: "desktop", width: 1280, height: 800, icon: Monitor },
  // Tablet
  { id: "ipad-pro", name: "iPad Pro 12.9\"", type: "tablet", width: 1024, height: 1366, icon: Tablet, hasFrame: true },
  { id: "ipad", name: "iPad", type: "tablet", width: 768, height: 1024, icon: Tablet, hasFrame: true },
  { id: "ipad-mini", name: "iPad Mini", type: "tablet", width: 768, height: 1024, icon: Tablet, hasFrame: true },
  { id: "surface-pro", name: "Surface Pro", type: "tablet", width: 912, height: 1368, icon: Tablet, hasFrame: true },
  // Mobile
  { id: "iphone-15-pro", name: "iPhone 15 Pro", type: "mobile", width: 393, height: 852, icon: Smartphone, hasFrame: true },
  { id: "iphone-14", name: "iPhone 14", type: "mobile", width: 390, height: 844, icon: Smartphone, hasFrame: true },
  { id: "iphone-se", name: "iPhone SE", type: "mobile", width: 375, height: 667, icon: Smartphone, hasFrame: true },
  { id: "pixel-7", name: "Pixel 7", type: "mobile", width: 412, height: 915, icon: Smartphone, hasFrame: true },
  { id: "galaxy-s23", name: "Galaxy S23", type: "mobile", width: 360, height: 780, icon: Smartphone, hasFrame: true },
];

/** Zoom levels */
const ZOOM_LEVELS = [25, 50, 75, 100, 125, 150, 200];

/** Default viewport state */
export const DEFAULT_VIEWPORT: ViewportState = {
  width: 1440,
  height: 900,
  deviceType: "desktop",
  deviceId: "desktop-md",
  orientation: "landscape",
  zoom: 100,
  showFrame: false,
};

// =============================================================================
// Helper Functions
// =============================================================================

function getDeviceIcon(type: DeviceType): React.ComponentType<{ className?: string }> {
  switch (type) {
    case "desktop":
      return Monitor;
    case "tablet":
      return Tablet;
    case "mobile":
      return Smartphone;
    default:
      return Monitor;
  }
}

function getPresetsByType(type: DeviceType): DevicePreset[] {
  return DEVICE_PRESETS.filter((preset) => preset.type === type);
}

function swapDimensions(viewport: ViewportState): ViewportState {
  return {
    ...viewport,
    width: viewport.height,
    height: viewport.width,
    orientation: viewport.orientation === "portrait" ? "landscape" : "portrait",
  };
}

// =============================================================================
// Sub-Components
// =============================================================================

/** Device type button */
function DeviceTypeButton({
  type,
  isActive,
  onClick,
  compact,
}: {
  type: DeviceType;
  isActive: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  const Icon = getDeviceIcon(type);
  const label = type.charAt(0).toUpperCase() + type.slice(1);

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-4 h-4" />
            {!compact && <span className="text-sm">{label}</span>}
          </button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Zoom control */
function ZoomControl({
  zoom,
  onChange,
  compact,
}: {
  zoom: number;
  onChange: (zoom: number) => void;
  compact?: boolean;
}) {
  const handleZoomIn = () => {
    const nextLevel = ZOOM_LEVELS.find((z) => z > zoom);
    if (nextLevel) onChange(nextLevel);
  };

  const handleZoomOut = () => {
    const prevLevel = [...ZOOM_LEVELS].reverse().find((z) => z < zoom);
    if (prevLevel) onChange(prevLevel);
  };

  return (
    <div className="flex items-center gap-1">
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              disabled={zoom <= ZOOM_LEVELS[0]}
              className="h-8 w-8 p-0"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom Out</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2 min-w-[60px]">
            {zoom}%
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          {ZOOM_LEVELS.map((level) => (
            <DropdownMenuItem
              key={level}
              onClick={() => onChange(level)}
              className={cn(zoom === level && "bg-accent")}
            >
              {level}%
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onChange(100)}>
            Reset to 100%
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomIn}
              disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
              className="h-8 w-8 p-0"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom In</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

/** Custom size input */
function CustomSizeInput({
  width,
  height,
  onChange,
}: {
  width: number;
  height: number;
  onChange: (width: number, height: number) => void;
}) {
  const [localWidth, setLocalWidth] = useState(String(width));
  const [localHeight, setLocalHeight] = useState(String(height));

  const handleApply = () => {
    const w = parseInt(localWidth, 10);
    const h = parseInt(localHeight, 10);
    if (w > 0 && h > 0) {
      onChange(w, h);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2">
          <Settings className="w-4 h-4 mr-1" />
          {width} × {height}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Custom Viewport Size</h4>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="custom-width" className="text-xs">
                Width (px)
              </Label>
              <Input
                id="custom-width"
                type="number"
                value={localWidth}
                onChange={(e) => setLocalWidth(e.target.value)}
                onBlur={handleApply}
                onKeyDown={(e) => e.key === "Enter" && handleApply()}
                min={320}
                max={3840}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="custom-height" className="text-xs">
                Height (px)
              </Label>
              <Input
                id="custom-height"
                type="number"
                value={localHeight}
                onChange={(e) => setLocalHeight(e.target.value)}
                onBlur={handleApply}
                onKeyDown={(e) => e.key === "Enter" && handleApply()}
                min={320}
                max={2160}
                className="h-8"
              />
            </div>
          </div>

          <Button onClick={handleApply} size="sm" className="w-full">
            Apply Size
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ResponsivePreview({
  viewport,
  onViewportChange,
  containerWidth,
  containerHeight,
  showFrameToggle = true,
  showZoomControls = true,
  showCustomSize = true,
  compact = false,
  className,
}: ResponsivePreviewProps) {
  // Handle device type change
  const handleDeviceTypeChange = useCallback(
    (type: DeviceType) => {
      const preset = DEVICE_PRESETS.find((p) => p.type === type);
      if (preset) {
        onViewportChange({
          ...viewport,
          width: preset.width,
          height: preset.height,
          deviceType: type,
          deviceId: preset.id,
          showFrame: preset.hasFrame || false,
        });
      }
    },
    [viewport, onViewportChange]
  );

  // Handle device preset change
  const handlePresetChange = useCallback(
    (preset: DevicePreset) => {
      const isLandscape = viewport.orientation === "landscape";
      onViewportChange({
        ...viewport,
        width: isLandscape && preset.type !== "desktop" ? preset.height : preset.width,
        height: isLandscape && preset.type !== "desktop" ? preset.width : preset.height,
        deviceType: preset.type,
        deviceId: preset.id,
        showFrame: preset.hasFrame || false,
      });
    },
    [viewport, onViewportChange]
  );

  // Handle rotation
  const handleRotate = useCallback(() => {
    onViewportChange(swapDimensions(viewport));
  }, [viewport, onViewportChange]);

  // Handle zoom change
  const handleZoomChange = useCallback(
    (zoom: number) => {
      onViewportChange({ ...viewport, zoom });
    },
    [viewport, onViewportChange]
  );

  // Handle custom size change
  const handleCustomSize = useCallback(
    (width: number, height: number) => {
      onViewportChange({
        ...viewport,
        width,
        height,
        deviceType: "custom",
        deviceId: undefined,
      });
    },
    [viewport, onViewportChange]
  );

  // Handle frame toggle
  const handleFrameToggle = useCallback(() => {
    onViewportChange({ ...viewport, showFrame: !viewport.showFrame });
  }, [viewport, onViewportChange]);

  // Fit to container
  const handleFitToContainer = useCallback(() => {
    if (containerWidth && containerHeight) {
      const scaleX = containerWidth / viewport.width;
      const scaleY = containerHeight / viewport.height;
      const scale = Math.min(scaleX, scaleY, 1) * 100;
      const zoom = Math.floor(scale / 5) * 5; // Round to nearest 5
      onViewportChange({ ...viewport, zoom: Math.max(25, Math.min(zoom, 100)) });
    }
  }, [viewport, onViewportChange, containerWidth, containerHeight]);

  // Get current device preset
  const currentPreset = useMemo(() => {
    return DEVICE_PRESETS.find((p) => p.id === viewport.deviceId);
  }, [viewport.deviceId]);

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2 bg-background border-b",
        className
      )}
    >
      {/* Device type buttons */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
        {(["desktop", "tablet", "mobile"] as const).map((type) => (
          <DeviceTypeButton
            key={type}
            type={type}
            isActive={viewport.deviceType === type}
            onClick={() => handleDeviceTypeChange(type)}
            compact={compact}
          />
        ))}
      </div>

      {/* Device preset dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            {currentPreset?.name || "Custom"}
            <ChevronDown className="w-3 h-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Desktop</DropdownMenuLabel>
          {getPresetsByType("desktop").map((preset) => (
            <DropdownMenuItem
              key={preset.id}
              onClick={() => handlePresetChange(preset)}
              className={cn(viewport.deviceId === preset.id && "bg-accent")}
            >
              <Monitor className="w-4 h-4 mr-2" />
              {preset.name}
              <span className="ml-auto text-xs text-muted-foreground">
                {preset.width}×{preset.height}
              </span>
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Tablet</DropdownMenuLabel>
          {getPresetsByType("tablet").map((preset) => (
            <DropdownMenuItem
              key={preset.id}
              onClick={() => handlePresetChange(preset)}
              className={cn(viewport.deviceId === preset.id && "bg-accent")}
            >
              <Tablet className="w-4 h-4 mr-2" />
              {preset.name}
              <span className="ml-auto text-xs text-muted-foreground">
                {preset.width}×{preset.height}
              </span>
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Mobile</DropdownMenuLabel>
          {getPresetsByType("mobile").map((preset) => (
            <DropdownMenuItem
              key={preset.id}
              onClick={() => handlePresetChange(preset)}
              className={cn(viewport.deviceId === preset.id && "bg-accent")}
            >
              <Smartphone className="w-4 h-4 mr-2" />
              {preset.name}
              <span className="ml-auto text-xs text-muted-foreground">
                {preset.width}×{preset.height}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Separator */}
      <div className="w-px h-6 bg-border" />

      {/* Rotation (for tablet/mobile) */}
      {viewport.deviceType !== "desktop" && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRotate}
                className="h-8 w-8 p-0"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Rotate ({viewport.orientation === "portrait" ? "Landscape" : "Portrait"})
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Frame toggle */}
      {showFrameToggle && viewport.deviceType !== "desktop" && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={viewport.showFrame ? "secondary" : "ghost"}
                size="sm"
                onClick={handleFrameToggle}
                className="h-8 px-2"
              >
                <Smartphone className="w-4 h-4 mr-1" />
                Frame
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Device Frame</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Custom size */}
      {showCustomSize && (
        <CustomSizeInput
          width={viewport.width}
          height={viewport.height}
          onChange={handleCustomSize}
        />
      )}

      {/* Zoom controls */}
      {showZoomControls && (
        <>
          <div className="w-px h-6 bg-border" />
          <ZoomControl
            zoom={viewport.zoom}
            onChange={handleZoomChange}
            compact={compact}
          />

          {/* Fit to container */}
          {containerWidth && containerHeight && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleFitToContainer}
                    className="h-8 w-8 p-0"
                  >
                    <Maximize className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Fit to View</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </>
      )}
    </div>
  );
}

export default ResponsivePreview;
