"use client";

import {
  MessageSquare,
  FolderTree,
  Eye,
  EyeOff,
  Settings,
  HelpCircle,
  Sparkles,
  Download,
  Loader2,
  Moon,
  Sun,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useEditorStore } from "@/lib/stores";
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
  const [isExporting, setIsExporting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const openTabs = useEditorStore((state) => state.openTabs);
  const fileContents = useEditorStore((state) => state.fileContents);

  // Avoid hydration mismatch for theme
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleExport = async () => {
    const filesToExport = openTabs
      .filter((tab) => fileContents[tab.path])
      .map((tab) => ({
        path: tab.path,
        content: fileContents[tab.path],
      }));

    if (isExporting || filesToExport.length === 0) return;

    setIsExporting(true);
    try {
      const themeName = "theme_custom";
      const exportFiles = filesToExport.map((f) => ({
        path: f.path,
        content: f.content,
        type: f.path.endsWith(".xml") ? "xml" :
              f.path.endsWith(".py") ? "py" :
              f.path.endsWith(".scss") ? "scss" :
              f.path.endsWith(".css") ? "css" :
              f.path.endsWith(".js") ? "js" : "xml",
      }));

      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themeName,
          files: exportFiles,
          options: { validate: true, includeReadme: true },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Export failed");
      }

      // Download the ZIP
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${themeName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
      alert(error instanceof Error ? error.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

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

        <Separator className="my-2 w-8" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={handleExport}
              disabled={isExporting || openTabs.length === 0}
            >
              {isExporting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {openTabs.length === 0 ? "No files to export" : "Download as ZIP"}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Bottom Actions */}
      <div className="mt-auto flex flex-col items-center py-2 gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              {mounted && resolvedTheme === "dark" ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {mounted ? (resolvedTheme === "dark" ? "Light Mode" : "Dark Mode") : "Toggle Theme"}
          </TooltipContent>
        </Tooltip>

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
