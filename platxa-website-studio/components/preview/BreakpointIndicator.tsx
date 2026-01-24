"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Bootstrap 5 breakpoint definitions
 */
const BREAKPOINTS = [
  { name: "xs", min: 0, max: 575, color: "#ef4444", label: "Extra Small" },
  { name: "sm", min: 576, max: 767, color: "#f97316", label: "Small" },
  { name: "md", min: 768, max: 991, color: "#eab308", label: "Medium" },
  { name: "lg", min: 992, max: 1199, color: "#22c55e", label: "Large" },
  { name: "xl", min: 1200, max: 1399, color: "#3b82f6", label: "Extra Large" },
  { name: "xxl", min: 1400, max: Infinity, color: "#8b5cf6", label: "XX-Large" },
];

interface BreakpointIndicatorProps {
  width: number;
  className?: string;
  showLabel?: boolean;
}

/**
 * Breakpoint Indicator Component
 *
 * Shows the current responsive breakpoint based on preview width.
 * Matches Bootstrap 5 breakpoints used by Odoo 18.
 */
export function BreakpointIndicator({
  width,
  className,
  showLabel = false,
}: BreakpointIndicatorProps) {
  const current = useMemo(() => {
    return BREAKPOINTS.find((bp) => width >= bp.min && width <= bp.max) || BREAKPOINTS[0];
  }, [width]);

  if (width <= 0) return null;

  return (
    <div className={cn("flex items-center gap-2 text-xs", className)}>
      {/* Breakpoint badge */}
      <span
        className="px-2 py-0.5 rounded-full font-mono font-medium text-white uppercase tracking-wide"
        style={{ backgroundColor: current.color }}
      >
        {current.name}
      </span>

      {/* Width display */}
      <span className="text-muted-foreground font-mono">
        {width}px
      </span>

      {/* Optional label */}
      {showLabel && (
        <span className="text-muted-foreground hidden sm:inline">
          ({current.label})
        </span>
      )}

      {/* Breakpoint bar visualization */}
      <div className="hidden md:flex items-center gap-0.5 ml-2">
        {BREAKPOINTS.slice(0, -1).map((bp) => (
          <div
            key={bp.name}
            className={cn(
              "h-1.5 w-3 rounded-full transition-opacity",
              width >= bp.min ? "opacity-100" : "opacity-30"
            )}
            style={{ backgroundColor: bp.color }}
            title={`${bp.name}: ${bp.min}-${bp.max}px`}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Get breakpoint name for a given width
 */
export function getBreakpointName(width: number): string {
  const bp = BREAKPOINTS.find((b) => width >= b.min && width <= b.max);
  return bp?.name || "xs";
}

/**
 * Check if width is mobile (xs or sm)
 */
export function isMobileWidth(width: number): boolean {
  return width < 768;
}

/**
 * Check if width is tablet (md)
 */
export function isTabletWidth(width: number): boolean {
  return width >= 768 && width < 992;
}

/**
 * Check if width is desktop (lg+)
 */
export function isDesktopWidth(width: number): boolean {
  return width >= 992;
}
