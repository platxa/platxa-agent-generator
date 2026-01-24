"use client";

import { type NodeRendererProps } from "react-arborist";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { getFileIcon } from "@/lib/utils/file-icons";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useProjectStore, useEditorStore } from "@/lib/stores";
import type { FileNode as FileNodeType } from "@/lib/stores/project-store";

interface TreeNode {
  id: string;
  name: string;
  children?: TreeNode[];
  data: FileNodeType;
}

export function FileNode({ node, style, dragHandle }: NodeRendererProps<TreeNode>) {
  const { deleteFile } = useProjectStore();
  const { openTab, closeTab } = useEditorStore();

  const isDirectory = node.data.data.type === "directory";
  const isOpen = node.isOpen;
  const isSelected = node.isSelected;

  const Icon = getFileIcon(node.data.name, isDirectory, isOpen);

  const handleClick = () => {
    if (isDirectory) {
      node.toggle();
    } else {
      node.select();
    }
  };

  const handleDoubleClick = () => {
    if (!isDirectory) {
      openTab({
        path: node.data.data.path,
        name: node.data.name,
        language: getLanguageFromPath(node.data.data.path),
      });
    }
  };

  const handleDelete = () => {
    deleteFile(node.id);
    closeTab(node.id);
  };

  const handleCopyPath = async () => {
    await navigator.clipboard.writeText(node.data.data.path);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          ref={dragHandle}
          style={style}
          className={cn(
            "file-tree-node group",
            isSelected && "selected bg-accent"
          )}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
        >
          {/* Expand/Collapse button for directories */}
          <span className="w-4 flex-shrink-0">
            {isDirectory && (
              isOpen ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )
            )}
          </span>

          {/* File/Folder icon */}
          <Icon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />

          {/* Name */}
          <span className="text-sm truncate">{node.data.name}</span>

          {/* Modified indicator */}
          {node.data.data.isModified && (
            <span className="ml-auto text-xs text-muted-foreground">*</span>
          )}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        {!isDirectory && (
          <>
            <ContextMenuItem
              onClick={() =>
                openTab({
                  path: node.data.data.path,
                  name: node.data.name,
                  language: getLanguageFromPath(node.data.data.path),
                })
              }
            >
              Open
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem onClick={handleCopyPath}>
          Copy Path
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={handleDelete}
          className="text-destructive focus:text-destructive"
        >
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    py: "python",
    xml: "xml",
    html: "html",
    scss: "scss",
    css: "css",
    js: "javascript",
    json: "json",
  };
  return languageMap[ext || ""] || "plaintext";
}
