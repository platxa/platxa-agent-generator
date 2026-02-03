"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

/**
 * Preview panel loading skeleton
 */
export function PreviewPanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col h-full bg-muted/20", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b bg-background">
        {/* Left: Device controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-md bg-muted/50">
            <Skeleton className="h-6 w-6 rounded" />
            <Skeleton className="h-6 w-6 rounded" />
            <Skeleton className="h-6 w-6 rounded" />
          </div>
          <Skeleton className="h-7 w-32 rounded" />
          <Skeleton className="h-6 w-6 rounded" />
        </div>

        {/* Center: URL bar */}
        <div className="flex-1 max-w-md mx-4">
          <Skeleton className="h-8 w-full rounded-md" />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Skeleton className="h-7 w-7 rounded" />
            <Skeleton className="h-7 w-12 rounded" />
            <Skeleton className="h-7 w-7 rounded" />
          </div>
          <div className="w-px h-4 bg-border mx-1" />
          <Skeleton className="h-7 w-7 rounded" />
          <Skeleton className="h-7 w-7 rounded" />
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
        {/* Device frame */}
        <div className="relative">
          {/* Phone frame */}
          <div className="bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl">
            {/* Notch area */}
            <div className="flex items-center justify-center gap-2 mb-2">
              <Skeleton className="h-2 w-2 rounded-full bg-gray-700" />
              <Skeleton className="h-6 w-20 rounded-full bg-gray-800" />
              <Skeleton className="h-2 w-2 rounded-full bg-gray-700" />
            </div>

            {/* Screen */}
            <div className="bg-white rounded-2xl overflow-hidden" style={{ width: 375, height: 667 }}>
              {/* Fake website content */}
              <div className="p-4 space-y-4">
                {/* Nav */}
                <div className="flex items-center justify-between">
                  <Skeleton className="h-8 w-24" />
                  <div className="flex gap-4">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                </div>

                {/* Hero */}
                <div className="py-8 space-y-4">
                  <Skeleton className="h-10 w-3/4 mx-auto" />
                  <Skeleton className="h-6 w-2/3 mx-auto" />
                  <div className="flex justify-center gap-2 pt-4">
                    <Skeleton className="h-10 w-28 rounded-md" />
                    <Skeleton className="h-10 w-28 rounded-md" />
                  </div>
                </div>

                {/* Image placeholder */}
                <Skeleton className="h-40 w-full rounded-lg" />

                {/* Content blocks */}
                <div className="grid grid-cols-3 gap-4 pt-4">
                  <div className="space-y-2">
                    <Skeleton className="h-20 w-full rounded" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-20 w-full rounded" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-20 w-full rounded" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </div>
              </div>
            </div>

            {/* Home indicator */}
            <div className="flex items-center justify-center mt-3">
              <Skeleton className="h-1 w-28 rounded-full bg-gray-700" />
            </div>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t bg-background text-xs">
        <div className="flex items-center gap-2">
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    </div>
  );
}

export default PreviewPanelSkeleton;
