"use client";

import { X, Pin, PinOff } from "lucide-react";
import { useEditorStore } from "@/lib/stores";
import { getFileIcon } from "@/lib/utils/file-icons";
import { cn } from "@/lib/utils/cn";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export function EditorTabs() {
  const {
    openTabs,
    activeTab,
    setActiveTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    pinTab,
    unpinTab,
  } = useEditorStore();

  if (openTabs.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center border-b bg-muted/30 overflow-x-auto">
      {openTabs.map((tab) => {
        const isActive = tab.path === activeTab;
        const Icon = getFileIcon(tab.name);

        return (
          <ContextMenu key={tab.path}>
            <ContextMenuTrigger>
              <div
                className={cn(
                  "group flex items-center gap-2 px-3 py-2 border-r cursor-pointer",
                  "hover:bg-muted/50 transition-colors",
                  isActive && "bg-background border-b-2 border-b-primary"
                )}
                onClick={() => setActiveTab(tab.path)}
              >
                {/* Pin indicator */}
                {tab.isPinned && (
                  <Pin className="w-3 h-3 text-muted-foreground" />
                )}

                {/* File icon */}
                <Icon className="w-4 h-4 text-muted-foreground" />

                {/* File name */}
                <span
                  className={cn(
                    "text-sm truncate max-w-[120px]",
                    tab.isModified && "italic"
                  )}
                >
                  {tab.name}
                  {tab.isModified && " *"}
                </span>

                {/* Close button */}
                <button
                  className={cn(
                    "p-0.5 rounded hover:bg-muted",
                    "opacity-0 group-hover:opacity-100 transition-opacity",
                    isActive && "opacity-100"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.path);
                  }}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </ContextMenuTrigger>

            <ContextMenuContent>
              <ContextMenuItem onClick={() => closeTab(tab.path)}>
                Close
              </ContextMenuItem>
              <ContextMenuItem onClick={() => closeOtherTabs(tab.path)}>
                Close Others
              </ContextMenuItem>
              <ContextMenuItem onClick={closeAllTabs}>
                Close All
              </ContextMenuItem>
              <ContextMenuSeparator />
              {tab.isPinned ? (
                <ContextMenuItem onClick={() => unpinTab(tab.path)}>
                  <PinOff className="w-4 h-4 mr-2" />
                  Unpin Tab
                </ContextMenuItem>
              ) : (
                <ContextMenuItem onClick={() => pinTab(tab.path)}>
                  <Pin className="w-4 h-4 mr-2" />
                  Pin Tab
                </ContextMenuItem>
              )}
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
    </div>
  );
}
