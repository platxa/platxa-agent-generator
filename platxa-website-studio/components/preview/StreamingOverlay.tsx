"use client";

import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface StreamingOverlayProps {
  isStreaming: boolean;
  progress: number;
  templateCount: number;
  className?: string;
}

/**
 * Streaming Overlay Component
 *
 * Shows a visual indicator when AI is generating code
 * and streaming updates to the preview.
 */
export function StreamingOverlay({
  isStreaming,
  progress,
  templateCount,
  className,
}: StreamingOverlayProps) {
  if (!isStreaming) return null;

  return (
    <div
      className={cn(
        "absolute top-3 left-3 z-20 flex items-center gap-2",
        "px-3 py-1.5 rounded-full",
        "bg-gradient-to-r from-purple-500/90 to-blue-500/90",
        "text-white text-xs font-medium",
        "shadow-lg shadow-purple-500/20",
        "backdrop-blur-sm",
        "animate-pulse",
        className
      )}
    >
      <Sparkles className="w-3.5 h-3.5 animate-spin" />
      <span>Generating...</span>

      {/* Progress bar */}
      <div className="w-16 h-1.5 bg-white/30 rounded-full overflow-hidden">
        <div
          className="h-full bg-white rounded-full transition-all duration-300"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      {/* Template count */}
      {templateCount > 0 && (
        <span className="text-white/80">
          {templateCount} template{templateCount !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

/**
 * Streaming Indicator for status bar
 */
export function StreamingStatusIndicator({
  isStreaming,
  progress,
}: {
  isStreaming: boolean;
  progress: number;
}) {
  if (!isStreaming) return null;

  return (
    <div className="flex items-center gap-2 text-xs">
      <Loader2 className="w-3 h-3 animate-spin text-primary" />
      <span className="text-primary font-medium">
        Streaming {Math.round(progress)}%
      </span>
    </div>
  );
}
