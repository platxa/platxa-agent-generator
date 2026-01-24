"use client";

import { useState, useCallback } from "react";
import { ZoomIn, ZoomOut, Maximize, RotateCcw } from "lucide-react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils/cn";

export interface ZoomControlsProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  className?: string;
}

const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 200];
const MIN_ZOOM = 25;
const MAX_ZOOM = 200;
const ZOOM_STEP = 25;

/**
 * Zoom controls for the preview panel
 */
export function ZoomControls({ zoom, onZoomChange, className }: ZoomControlsProps) {
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
    // This would need container width - for now just set to 100%
    onZoomChange(100);
  }, [onZoomChange]);

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
        <TooltipContent>Zoom Out</TooltipContent>
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
        <DropdownMenuContent align="center" className="min-w-[100px]">
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
        <TooltipContent>Zoom In</TooltipContent>
      </Tooltip>

      {/* Divider */}
      <div className="w-px h-4 bg-border mx-1" />

      {/* Fit to width */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleFitToWidth}
          >
            <Maximize className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Fit to Width</TooltipContent>
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
        <TooltipContent>Reset Zoom</TooltipContent>
      </Tooltip>
    </div>
  );
}

/**
 * Hook for managing zoom state
 */
export function useZoom(initialZoom = 100) {
  const [zoom, setZoom] = useState(initialZoom);

  const zoomIn = useCallback(() => {
    setZoom((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  }, []);

  const reset = useCallback(() => {
    setZoom(100);
  }, []);

  const setZoomLevel = useCallback((level: number) => {
    setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level)));
  }, []);

  return {
    zoom,
    zoomIn,
    zoomOut,
    reset,
    setZoom: setZoomLevel,
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
