"use client";

import { DiffEditor } from "@monaco-editor/react";
import { useEditorStore } from "@/lib/stores";
import { Button } from "@/components/ui/button";
import { X, Check, RotateCcw } from "lucide-react";

interface DiffViewProps {
  originalContent: string;
  modifiedContent: string;
  language: string;
  onAccept?: () => void;
  onReject?: () => void;
  onClose?: () => void;
}

export function DiffView({
  originalContent,
  modifiedContent,
  language,
  onAccept,
  onReject,
  onClose,
}: DiffViewProps) {
  const { fontSize } = useEditorStore();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">Review Changes</span>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded">
              Original
            </span>
            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">
              Modified
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onAccept && (
            <Button size="sm" variant="default" onClick={onAccept}>
              <Check className="w-4 h-4 mr-1" />
              Accept
            </Button>
          )}
          {onReject && (
            <Button size="sm" variant="outline" onClick={onReject}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Reject
            </Button>
          )}
          {onClose && (
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Diff Editor */}
      <div className="flex-1">
        <DiffEditor
          height="100%"
          language={language}
          original={originalContent}
          modified={modifiedContent}
          theme="platxa-dark"
          options={{
            readOnly: true,
            renderSideBySide: true,
            fontSize,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            diffWordWrap: "on",
          }}
          loading={
            <div className="flex items-center justify-center h-full">
              <span className="text-muted-foreground">Loading diff view...</span>
            </div>
          }
        />
      </div>
    </div>
  );
}
