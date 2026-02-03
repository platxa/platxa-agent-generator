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
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileTree } from "./FileTree";
import { useProjectStore } from "@/lib/stores";
import { cn } from "@/lib/utils/cn";

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
  const { projectName, files } = useProjectStore();

  const handleNewFile = () => {
    // TODO: Implement new file dialog
    console.log("New file");
  };

  const handleNewFolder = () => {
    // TODO: Implement new folder dialog
    console.log("New folder");
  };

  const handleRefresh = () => {
    // TODO: Implement refresh from sidecar
    console.log("Refresh");
  };

  const handleExport = () => {
    // TODO: Implement ZIP export
    console.log("Export");
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
                  onClick={handleNewFile}
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
                  onClick={handleNewFolder}
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
                  onClick={handleExport}
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
