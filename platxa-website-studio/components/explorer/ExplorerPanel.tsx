"use client";

import { useState } from "react";
import {
  FolderPlus,
  FilePlus,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileTree } from "./FileTree";
import { NewFileDialog } from "./NewFileDialog";
import { NewFolderDialog } from "./NewFolderDialog";
import { ExportDialog } from "./ExportDialog";
import { useProjectStore, useEditorStore } from "@/lib/stores";

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
  actions,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      <div
        className="flex items-center justify-between px-2 py-1.5 cursor-pointer hover:bg-muted/50"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-1">
          {isOpen ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
        </div>
        {actions && (
          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </div>
      {isOpen && children}
    </div>
  );
}

export function ExplorerPanel() {
  const { projectName, files, addFile } = useProjectStore();
  const { openTab, setFileContent } = useEditorStore();

  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const handleCreateFile = (path: string, language: string) => {
    // Create empty file with template content
    const templates: Record<string, string> = {
      xml: `<?xml version="1.0" encoding="utf-8"?>\n<odoo>\n  <template id="new_template" name="New Template">\n    <!-- Your content here -->\n  </template>\n</odoo>`,
      scss: `// New SCSS file\n\n.custom-class {\n  // Your styles here\n}`,
      css: `/* New CSS file */\n\n.custom-class {\n  /* Your styles here */\n}`,
      python: `# -*- coding: utf-8 -*-\n\n# New Python file\n`,
      javascript: `// New JavaScript file\n\n`,
      json: `{\n  \n}`,
    };

    const content = templates[language] || "";
    const name = path.split("/").pop() || path;

    addFile({
      id: `file-${Date.now()}`,
      name,
      path,
      type: "file",
      content,
      isModified: true,
    });

    // Open the new file in editor
    openTab({ path, name: name, language });
    setFileContent(path, content);
  };

  const handleCreateFolder = (path: string) => {
    const name = path.split("/").pop() || path;

    addFile({
      id: `folder-${Date.now()}`,
      name,
      path,
      type: "directory",
      children: [],
    });
  };

  const handleRefresh = () => {
    // Refresh from sidecar if available
    console.log("Refresh files from sidecar");
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-medium truncate">{projectName}</span>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowNewFileDialog(true)}
                >
                  <FilePlus className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New File</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowNewFolderDialog(true)}
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New Folder</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleRefresh}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowExportDialog(true)}
                >
                  <Download className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export as ZIP</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* File Tree */}
        <ScrollArea className="flex-1">
          <CollapsibleSection
            title="Files"
            actions={
              <span className="text-xs text-muted-foreground">
                {countFiles(files)} files
              </span>
            }
          >
            <div data-testid="file-tree">
              <FileTree />
            </div>
          </CollapsibleSection>
        </ScrollArea>
      </div>

      {/* Dialogs */}
      <NewFileDialog
        open={showNewFileDialog}
        onOpenChange={setShowNewFileDialog}
        onCreateFile={handleCreateFile}
      />
      <NewFolderDialog
        open={showNewFolderDialog}
        onOpenChange={setShowNewFolderDialog}
        onCreateFolder={handleCreateFolder}
      />
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
      />
    </TooltipProvider>
  );
}

/**
 * Count total files in the tree
 */
function countFiles(nodes: any[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === "file") {
      count++;
    }
    if (node.children) {
      count += countFiles(node.children);
    }
  }
  return count;
}
