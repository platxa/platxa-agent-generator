"use client";

import { useCallback, useMemo } from "react";
import { Tree, type NodeApi } from "react-arborist";
import { useProjectStore, useEditorStore } from "@/lib/stores";
import { FileNode } from "./FileNode";
import type { FileNode as FileNodeType } from "@/lib/stores/project-store";

/**
 * Convert our FileNode structure to react-arborist format
 */
interface TreeNode {
  id: string;
  name: string;
  children?: TreeNode[];
  data: FileNodeType;
}

function convertToTreeNodes(nodes: FileNodeType[]): TreeNode[] {
  return nodes.map((node) => ({
    id: node.path,
    name: node.name,
    children: node.children ? convertToTreeNodes(node.children) : undefined,
    data: node,
  }));
}

export function FileTree() {
  const { files, activeFile, setActiveFile } = useProjectStore();
  const { openTab } = useEditorStore();

  // Convert files to tree format
  const treeData = useMemo(() => convertToTreeNodes(files), [files]);

  // Handle file selection - uses NodeApi from react-arborist
  const handleSelect = useCallback(
    (nodes: NodeApi<TreeNode>[]) => {
      const node = nodes[0];
      if (node && node.data.data.type === "file") {
        setActiveFile(node.id);
        openTab({
          path: node.data.data.path,
          name: node.data.data.name,
          language: getLanguageFromPath(node.data.data.path),
        });
      }
    },
    [setActiveFile, openTab]
  );

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <p className="text-sm text-muted-foreground">No files yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Use the AI assistant to generate your website
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto custom-scrollbar">
      <Tree<TreeNode>
        data={treeData}
        openByDefault={true}
        selection={activeFile || undefined}
        onSelect={handleSelect}
        indent={16}
        rowHeight={28}
        overscanCount={5}
        disableDrag
        disableDrop
      >
        {(props) => <FileNode {...props} />}
      </Tree>
    </div>
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
