"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FileCode, Eye, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { getFileIcon, getFileLanguage } from "@/lib/utils/file-icons";
import { CodeBlock } from "./CodeBlock";
import type { ParsedFile } from "@/lib/ai/parser";

interface FileListProps {
  files: ParsedFile[];
  onFileClick?: (file: ParsedFile) => void;
}

export function FileList({ files, onFileClick }: FileListProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const toggleFile = (path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  return (
    <div className="space-y-1">
      {files.map((file) => {
        const isExpanded = expandedFiles.has(file.path);
        const fileName = file.path.split("/").pop() || file.path;
        const Icon = getFileIcon(fileName);

        return (
          <div key={file.path} className="rounded-lg border overflow-hidden">
            {/* File header */}
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-2 cursor-pointer",
                "hover:bg-muted/50 transition-colors",
                isExpanded && "bg-muted/30"
              )}
              onClick={() => toggleFile(file.path)}
            >
              <button className="p-0.5">
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </button>
              <Icon className="w-4 h-4 text-muted-foreground" />
              <span className="flex-1 text-sm font-mono truncate">
                {file.path}
              </span>
              <div className="flex items-center gap-1">
                <span
                  className={cn(
                    "px-1.5 py-0.5 text-xs rounded",
                    file.action === "create"
                      ? "bg-green-100 text-green-700"
                      : "bg-blue-100 text-blue-700"
                  )}
                >
                  {file.action}
                </span>
                {onFileClick && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFileClick(file);
                    }}
                  >
                    <Eye className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* File content */}
            {isExpanded && (
              <div className="border-t">
                <CodeBlock
                  code={file.content}
                  language={file.language}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
