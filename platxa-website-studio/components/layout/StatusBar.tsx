"use client";

import { Wifi, WifiOff, Cloud, CloudOff, Loader2 } from "lucide-react";
import { useSyncStore, useProjectStore, useEditorStore } from "@/lib/stores";
import { cn } from "@/lib/utils/cn";

export function StatusBar() {
  const { status, isDeploying } = useSyncStore();
  const { projectName, odooStatus } = useProjectStore();
  const { cursorPosition, activeTab } = useEditorStore();

  const isConnected = status === "connected";
  const isOdooConnected = odooStatus === "connected";

  return (
    <div className="flex items-center justify-between h-6 px-3 border-t bg-muted/30 text-xs text-muted-foreground">
      {/* Left side */}
      <div className="flex items-center gap-4">
        {/* Project name */}
        <span className="font-medium">{projectName}</span>

        {/* Sync status */}
        <div className="flex items-center gap-1">
          {isConnected ? (
            <Wifi className="w-3 h-3 text-green-500" />
          ) : (
            <WifiOff className="w-3 h-3 text-red-500" />
          )}
          <span>{isConnected ? "Synced" : "Offline"}</span>
        </div>

        {/* Odoo status */}
        <div className="flex items-center gap-1">
          {isOdooConnected ? (
            <Cloud className="w-3 h-3 text-green-500" />
          ) : (
            <CloudOff className="w-3 h-3 text-yellow-500" />
          )}
          <span>Odoo: {odooStatus}</span>
        </div>

        {/* Deploy status */}
        {isDeploying && (
          <div className="flex items-center gap-1 text-primary">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Deploying...</span>
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Cursor position */}
        {activeTab && (
          <span>
            Ln {cursorPosition.line}, Col {cursorPosition.column}
          </span>
        )}

        {/* Odoo version */}
        <span>Odoo 18</span>
      </div>
    </div>
  );
}
