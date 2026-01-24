"use client";

import {
  MessageSquare,
  FolderTree,
  Eye,
  EyeOff,
  Settings,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";

interface SidebarProps {
  activePanel: "chat" | "explorer";
  onPanelChange: (panel: "chat" | "explorer") => void;
  showPreview: boolean;
  onTogglePreview: () => void;
}

export function Sidebar({
  activePanel,
  onPanelChange,
  showPreview,
  onTogglePreview,
}: SidebarProps) {
  return (
    <div className="flex flex-col w-12 border-r bg-muted/30">
      {/* Logo */}
      <div className="flex items-center justify-center h-12 border-b">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex flex-col items-center py-2 gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={activePanel === "chat" ? "secondary" : "ghost"}
              size="icon"
              className="h-10 w-10"
              onClick={() => onPanelChange("chat")}
            >
              <MessageSquare className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">AI Chat</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={activePanel === "explorer" ? "secondary" : "ghost"}
              size="icon"
              className="h-10 w-10"
              onClick={() => onPanelChange("explorer")}
            >
              <FolderTree className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">File Explorer</TooltipContent>
        </Tooltip>

        <Separator className="my-2 w-8" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showPreview ? "secondary" : "ghost"}
              size="icon"
              className="h-10 w-10"
              onClick={onTogglePreview}
            >
              {showPreview ? (
                <Eye className="w-5 h-5" />
              ) : (
                <EyeOff className="w-5 h-5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {showPreview ? "Hide Preview" : "Show Preview"}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Bottom Actions */}
      <div className="mt-auto flex flex-col items-center py-2 gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <HelpCircle className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Help</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <Settings className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
