"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ZoomIn, ZoomOut, Maximize, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils/cn";

export interface ZoomControlsProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  /** Container width for fit calculations */
  containerWidth?: number;
  /** Container height for fit calculations */
  containerHeight?: number;
  /** Content width (device viewport) */
  contentWidth?: number;
  /** Content height (device viewport) */
  contentHeight?: number;
  className?: string;
}

const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 200];
const MIN_ZOOM = 10;
const MAX_ZOOM = 300;
const ZOOM_STEP = 25;
const ZOOM_FINE_STEP = 10;

/**
 * Calculate zoom level to fit content within container
 */
function calculateFitZoom(
  containerWidth: number,
  containerHeight: number,
  contentWidth: number,
  contentHeight: number,
  mode: "width" | "height" | "contain" = "contain",
  padding: number = 32
): number {
  const availableWidth = containerWidth - padding * 2;
  const availableHeight = containerHeight - padding * 2;

  if (mode === "width") {
    return Math.floor((availableWidth / contentWidth) * 100);
  }
  if (mode === "height") {
    return Math.floor((availableHeight / contentHeight) * 100);
  }
  // Contain - fit both dimensions
  const widthRatio = availableWidth / contentWidth;
  const heightRatio = availableHeight / contentHeight;
  return Math.floor(Math.min(widthRatio, heightRatio) * 100);
}

/**
 * Zoom controls for the preview panel
 */
export function ZoomControls({
  zoom,
  onZoomChange,
  containerWidth,
  containerHeight,
  contentWidth = 1920,
  contentHeight = 1080,
  className,
}: ZoomControlsProps) {
  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(MAX_ZOOM, zoom + ZOOM_STEP);
    onZoomChange(newZoom);
  }, [zoom, onZoomChange]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(MIN_ZOOM, zoom - ZOOM_STEP);
    onZoomChange(newZoom);
  }, [zoom, onZoomChange]);

  const handleReset = useCallback(() => {
    onZoomChange(100);
  }, [onZoomChange]);

  const handleFitToWidth = useCallback(() => {
    if (containerWidth && contentWidth) {
      const fitZoom = calculateFitZoom(
        containerWidth,
        containerHeight || containerWidth,
        contentWidth,
        contentHeight,
        "width"
      );
      onZoomChange(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom)));
    } else {
      onZoomChange(100);
    }
  }, [containerWidth, containerHeight, contentWidth, contentHeight, onZoomChange]);

  const handleFitToContainer = useCallback(() => {
    if (containerWidth && containerHeight && contentWidth && contentHeight) {
      const fitZoom = calculateFitZoom(
        containerWidth,
        containerHeight,
        contentWidth,
        contentHeight,
        "contain"
      );
      onZoomChange(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom)));
    } else {
      onZoomChange(100);
    }
  }, [containerWidth, containerHeight, contentWidth, contentHeight, onZoomChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl/Cmd key
      if (!e.ctrlKey && !e.metaKey) return;

      switch (e.key) {
        case "=":
        case "+":
          e.preventDefault();
          handleZoomIn();
          break;
        case "-":
          e.preventDefault();
          handleZoomOut();
          break;
        case "0":
          e.preventDefault();
          handleReset();
          break;
        case "1":
          e.preventDefault();
          handleFitToContainer();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleReset, handleFitToContainer]);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* Zoom out */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Zoom Out (Ctrl+-)</TooltipContent>
      </Tooltip>

      {/* Zoom level dropdown */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 min-w-[52px] font-mono text-xs"
              >
                {zoom}%
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Zoom Level</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="center" className="min-w-[120px]">
          {ZOOM_PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset}
              onClick={() => onZoomChange(preset)}
              className={cn(
                "font-mono text-sm justify-center",
                zoom === preset && "bg-primary/10 text-primary"
              )}
            >
              {preset}%
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleFitToWidth} className="text-sm justify-center">
            Fit to Width
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleFitToContainer} className="text-sm justify-center">
            Fit to View (Ctrl+1)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Zoom in */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Zoom In (Ctrl++)</TooltipContent>
      </Tooltip>

      {/* Divider */}
      <div className="w-px h-4 bg-border mx-1" />

      {/* Fit to container */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleFitToContainer}
          >
            <Square className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Fit to View (Ctrl+1)</TooltipContent>
      </Tooltip>

      {/* Reset */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleReset}
            disabled={zoom === 100}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Reset Zoom (Ctrl+0)</TooltipContent>
      </Tooltip>
    </div>
  );
}

/**
 * Hook for managing zoom state with mouse wheel support
 */
export function useZoom(initialZoom = 100, containerRef?: React.RefObject<HTMLElement>) {
  const [zoom, setZoomState] = useState(initialZoom);

  const zoomIn = useCallback(() => {
    setZoomState((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomState((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  }, []);

  const reset = useCallback(() => {
    setZoomState(100);
  }, []);

  const setZoom = useCallback((level: number) => {
    setZoomState(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level)));
  }, []);

  // Mouse wheel zoom (Ctrl/Cmd + wheel)
  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;

      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_FINE_STEP : ZOOM_FINE_STEP;
      setZoomState((prev) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)));
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [containerRef]);

  return {
    zoom,
    zoomIn,
    zoomOut,
    reset,
    setZoom,
  };
}

/**
 * Compact zoom indicator for status bar
 */
export function ZoomIndicator({ zoom }: { zoom: number }) {
  return (
    <span className={cn(
      "font-mono text-xs",
      zoom !== 100 && "text-primary"
    )}>
      {zoom}%
    </span>
  );
}

/**
 * Utility to get container dimensions
 */
export function useContainerDimensions(ref: React.RefObject<HTMLElement>) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);

  return dimensions;
}
