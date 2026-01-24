"use client";

import { useMemo } from "react";
import { FileCode, Settings } from "lucide-react";
import { useEditorStore, useProjectStore } from "@/lib/stores";
import { CodeEditor } from "./CodeEditor";
import { EditorTabs } from "./EditorTabs";
import { DiffView } from "./DiffView";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getFileLanguage } from "@/lib/utils/file-icons";

export function EditorPanel() {
  const {
    activeTab,
    openTabs,
    showDiff,
    diffOriginal,
    diffModified,
    hideDiffView,
    cursorPosition,
    toggleMinimap,
    toggleWordWrap,
    setFontSize,
    fontSize,
    showMinimap,
    wordWrap,
  } = useEditorStore();

  const { files, updateFile } = useProjectStore();

  // Find active file content
  const activeFileContent = useMemo(() => {
    if (!activeTab) return null;

    const findFile = (nodes: typeof files, path: string): string | null => {
      for (const node of nodes) {
        if (node.path === path && node.type === "file") {
          return node.content || "";
        }
        if (node.children) {
          const found = findFile(node.children, path);
          if (found !== null) return found;
        }
      }
      return null;
    };

    return findFile(files, activeTab);
  }, [activeTab, files]);

  const activeTabData = openTabs.find((t) => t.path === activeTab);

  // Show diff view if active
  if (showDiff && diffOriginal !== null && diffModified !== null) {
    return (
      <div className="flex flex-col h-full">
        <DiffView
          originalContent={diffOriginal}
          modifiedContent={diffModified}
          language={activeTabData?.language || "plaintext"}
          onAccept={() => {
            if (activeTab && diffModified) {
              updateFile(activeTab, diffModified);
            }
            hideDiffView();
          }}
          onReject={hideDiffView}
          onClose={hideDiffView}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Tabs */}
      <EditorTabs />

      {/* Editor Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab && activeFileContent !== null ? (
          <CodeEditor
            filePath={activeTab}
            content={activeFileContent}
            onChange={(content) => updateFile(activeTab, content)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FileCode className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No file selected</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Select a file from the explorer or generate code with AI
            </p>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-1 border-t bg-muted/30 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          {activeTab && (
            <>
              <span>
                Ln {cursorPosition.line}, Col {cursorPosition.column}
              </span>
              <span>{getFileLanguage(activeTab)}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Settings className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Editor Settings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={toggleMinimap}>
                {showMinimap ? "Hide" : "Show"} Minimap
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleWordWrap}>
                {wordWrap ? "Disable" : "Enable"} Word Wrap
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs">Font Size</DropdownMenuLabel>
              <div className="flex items-center gap-2 px-2 py-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setFontSize(fontSize - 1)}
                >
                  -
                </Button>
                <span className="w-8 text-center">{fontSize}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setFontSize(fontSize + 1)}
                >
                  +
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
