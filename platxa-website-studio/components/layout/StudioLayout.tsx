"use client";

import { useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/layout/ResizablePanels";
import { ChatPanel } from "@/components/chat";
import { EditorPanel } from "@/components/editor";
import { ExplorerPanel } from "@/components/explorer";
import { PreviewPanel } from "@/components/preview";
import { DeploymentPanelWrapper } from "@/components/deployment/DeploymentPanelWrapper";
import { GitHubPanelWrapper } from "@/components/github/GitHubPanelWrapper";
import { Sidebar, type SidebarPanel } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface StudioLayoutProps {
  projectId: string;
  initialPrompt?: string;
}

export function StudioLayout({ projectId, initialPrompt }: StudioLayoutProps) {
  const [activePanel, setActivePanel] = useState<SidebarPanel>("chat");
  const [showPreview, setShowPreview] = useState(true);

  const renderLeftPanel = () => {
    switch (activePanel) {
      case "chat":
        return <ChatPanel projectId={projectId} initialPrompt={initialPrompt} />;
      case "explorer":
        return <ExplorerPanel />;
      case "deploy":
        return <DeploymentPanelWrapper projectId={projectId} />;
      case "github":
        return <GitHubPanelWrapper projectId={projectId} />;
      default:
        return <ChatPanel projectId={projectId} initialPrompt={initialPrompt} />;
    }
  };

  return (
    <TooltipProvider>
      <div data-testid="studio-layout" className="flex flex-col h-screen bg-background">
        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar */}
          <Sidebar
            activePanel={activePanel}
            onPanelChange={setActivePanel}
            showPreview={showPreview}
            onTogglePreview={() => setShowPreview(!showPreview)}
          />

          {/* Main Panels */}
          <ResizablePanelGroup direction="horizontal" className="flex-1">
            {/* Left Panel - Chat/Explorer/Deploy/GitHub */}
            <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
              <div data-testid="chat-panel" className="h-full border-r">
                <ErrorBoundary>
                  {renderLeftPanel()}
                </ErrorBoundary>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Center Panel - Editor */}
            <ResizablePanel defaultSize={showPreview ? 40 : 75} minSize={30}>
              <div data-testid="editor-panel">
                <ErrorBoundary>
                  <EditorPanel />
                </ErrorBoundary>
              </div>
            </ResizablePanel>

            {/* Right Panel - Preview */}
            {showPreview && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={35} minSize={20} maxSize={50}>
                  <div data-testid="preview-panel">
                    <ErrorBoundary>
                      <PreviewPanel />
                    </ErrorBoundary>
                  </div>
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>

        {/* Status Bar */}
        <StatusBar />
      </div>
    </TooltipProvider>
  );
}
