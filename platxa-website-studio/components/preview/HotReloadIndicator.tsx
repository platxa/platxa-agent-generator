"use client";

import { useEffect, useState } from "react";
import { Zap, RefreshCw, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { HotReloadState } from "@/lib/hooks";

interface HotReloadIndicatorProps {
  state: HotReloadState;
  className?: string;
}

/**
 * Visual indicator for hot reload status
 */
export function HotReloadIndicator({ state, className }: HotReloadIndicatorProps) {
  const [showSuccess, setShowSuccess] = useState(false);

  // Show success flash after reload
  useEffect(() => {
    if (state.lastReload && state.reloadCount > 0) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [state.lastReload, state.reloadCount]);

  // Don't show indicator when idle with no recent activity
  if (!state.isPending && !state.isReloading && !showSuccess) {
    return null;
  }

  const getStatus = () => {
    if (state.isReloading) {
      return {
        icon: RefreshCw,
        text: "Updating...",
        variant: "reloading" as const,
        animate: true,
      };
    }
    if (state.isPending) {
      return {
        icon: Zap,
        text: "Changes detected",
        variant: "pending" as const,
        animate: true,
      };
    }
    if (showSuccess) {
      return {
        icon: Check,
        text: "Updated",
        variant: "success" as const,
        animate: false,
      };
    }
    return null;
  };

  const status = getStatus();
  if (!status) return null;

  const Icon = status.icon;

  return (
    <div
      className={cn(
        "hot-reload-indicator",
        status.variant,
        className
      )}
    >
      <span className="dot" />
      <Icon className={cn("w-3 h-3", status.animate && status.variant === "reloading" && "animate-spin")} />
      <span>{status.text}</span>
    </div>
  );
}

/**
 * Toast notification for hot reload events
 */
interface HotReloadToastProps {
  changedFiles: string[];
  onDismiss: () => void;
}

export function HotReloadToast({ changedFiles, onDismiss }: HotReloadToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onDismiss, 200);
    }, 3000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  const fileCount = changedFiles.length;
  const displayFiles = changedFiles.slice(0, 3);
  const moreCount = fileCount - displayFiles.length;

  return (
    <div className={cn("hot-reload-toast", isExiting && "exiting")}>
      <div className="flex items-center gap-2 text-primary">
        <Zap className="w-4 h-4" />
        <span className="font-medium">Hot Reload</span>
      </div>
      <div className="text-muted-foreground">
        {fileCount === 1 ? (
          <span>{getFileName(changedFiles[0])}</span>
        ) : (
          <span>
            {fileCount} files updated
            {moreCount > 0 && ` (+${moreCount} more)`}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Get file name from path
 */
function getFileName(path: string): string {
  return path.split("/").pop() || path;
}
