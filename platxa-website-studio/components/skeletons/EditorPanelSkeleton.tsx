"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

/**
 * File tree item skeleton
 */
function FileTreeItemSkeleton({ indent = 0 }: { indent?: number }) {
  return (
    <div
      className="flex items-center gap-2 py-1 px-2"
      style={{ paddingLeft: `${indent * 16 + 8}px` }}
    >
      <Skeleton className="h-4 w-4 rounded" />
      <Skeleton className="h-4 flex-1 max-w-[120px]" />
    </div>
  );
}

/**
 * Editor tab skeleton
 */
function EditorTabSkeleton() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-r">
      <Skeleton className="h-4 w-4 rounded" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-3 w-3 rounded-full" />
    </div>
  );
}

/**
 * Code line skeleton
 */
function CodeLineSkeleton({ lineNumber }: { lineNumber: number }) {
  // Varying widths to simulate code
  const widths = ["60%", "80%", "40%", "70%", "55%", "90%", "45%", "75%"];
  const width = widths[lineNumber % widths.length];

  return (
    <div className="flex items-center h-5 font-mono text-sm">
      <div className="w-12 text-right pr-4 text-muted-foreground/50">
        <Skeleton className="h-3 w-6 ml-auto" />
      </div>
      <Skeleton className="h-3" style={{ width }} />
    </div>
  );
}

/**
 * Editor panel loading skeleton
 */
export function EditorPanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Tabs bar */}
      <div className="flex items-center border-b bg-muted/30">
        <EditorTabSkeleton />
        <EditorTabSkeleton />
        <div className="flex-1" />
        <div className="flex items-center gap-1 px-2">
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-6 w-6 rounded" />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* File tree sidebar */}
        <div className="w-56 border-r bg-muted/20 overflow-hidden">
          <div className="flex items-center justify-between p-2 border-b">
            <Skeleton className="h-4 w-20" />
            <div className="flex gap-1">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-5 rounded" />
            </div>
          </div>
          <div className="p-1">
            <FileTreeItemSkeleton indent={0} />
            <FileTreeItemSkeleton indent={1} />
            <FileTreeItemSkeleton indent={1} />
            <FileTreeItemSkeleton indent={2} />
            <FileTreeItemSkeleton indent={2} />
            <FileTreeItemSkeleton indent={1} />
            <FileTreeItemSkeleton indent={0} />
            <FileTreeItemSkeleton indent={1} />
            <FileTreeItemSkeleton indent={1} />
            <FileTreeItemSkeleton indent={2} />
          </div>
        </div>

        {/* Code editor area */}
        <div className="flex-1 overflow-hidden">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 px-4 py-2 border-b bg-muted/10">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-24" />
          </div>

          {/* Code lines */}
          <div className="p-4 space-y-1">
            {Array.from({ length: 20 }).map((_, i) => (
              <CodeLineSkeleton key={i} lineNumber={i + 1} />
            ))}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1 border-t bg-muted/30 text-xs">
        <div className="flex items-center gap-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-8" />
        </div>
      </div>
    </div>
  );
}

export default EditorPanelSkeleton;
