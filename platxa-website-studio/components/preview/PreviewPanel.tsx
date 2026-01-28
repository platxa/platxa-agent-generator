"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  RefreshCw,
  ExternalLink,
  Smartphone,
  Tablet,
  Monitor,
  Loader2,
  AlertCircle,
  Code,
  Globe,
  MousePointer2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSyncStore, useProjectStore, useEditorStore, useChatStore } from "@/lib/stores";
import { useStreamingPreviewSafe, QWebRuntime, detectSnippets, replaceImagesWithPlaceholders } from "@/lib/preview";
import { usePreviewHotReload } from "@/lib/hooks";
import { cn } from "@/lib/utils/cn";
import { DeviceFrame, DEVICE_SPECS } from "./DeviceFrame";
import type { DeviceType } from "./DeviceFrame";
import { BreakpointIndicator } from "./BreakpointIndicator";
import { PreviewErrorBoundary } from "./PreviewErrorBoundary";
import { StreamingOverlay } from "./StreamingOverlay";
import { HotReloadIndicator } from "./HotReloadIndicator";
import { ElementInspector, useElementInspector } from "./ElementInspector";
import { ZoomControls, ZoomIndicator, useZoom } from "./ZoomControls";
import { SnippetSelector, SNIPPET_SELECT_SCRIPT } from "./SnippetSelector";
import { SnippetContextMenu, SNIPPET_CONTEXT_SCRIPT } from "./SnippetContextMenu";

type PreviewMode = "standalone" | "odoo";

/**
 * Convert SCSS variables to CSS custom properties
 */
function convertScssVariables(scss: string): { css: string; variables: string } {
  const variables: Record<string, string> = {};

  // Extract SCSS variables ($var: value;)
  const varRegex = /\$([\w-]+):\s*([^;]+);/g;
  let match;
  while ((match = varRegex.exec(scss)) !== null) {
    variables[match[1]] = match[2].trim();
  }

  // Convert to CSS custom properties
  let cssVariables = ":root {\n";
  for (const [name, value] of Object.entries(variables)) {
    // Replace $var references with var(--var)
    let resolvedValue = value;
    for (const [vName] of Object.entries(variables)) {
      resolvedValue = resolvedValue.replace(new RegExp(`\\$${vName}`, "g"), `var(--${vName})`);
    }
    cssVariables += `  --${name}: ${resolvedValue};\n`;
  }
  cssVariables += "}\n";

  // Convert remaining SCSS to CSS (basic conversion)
  let css = scss
    .replace(/\$[\w-]+:\s*[^;]+;/g, "") // Remove variable declarations
    .replace(/\$([\w-]+)/g, "var(--$1)") // Replace variable usage
    .replace(/&:hover/g, ":hover")
    .replace(/&:focus/g, ":focus")
    .replace(/&:active/g, ":active");

  return { css, variables: cssVariables };
}

/**
 * Create a shared QWebRuntime instance for preview
 */
const qwebRuntime = new QWebRuntime({
  website: {
    name: "Preview Website",
    company_id: {
      name: "Your Company",
      phone: "+1 (555) 123-4567",
      email: "info@example.com",
    },
  },
});

/**
 * Extract and render QWeb template content for preview using QWebRuntime
 */
function extractQwebContent(xml: string): { html: string; snippets: string[] } {
  let html = "";

  // Extract all template contents
  const templateRegex = /<template[^>]*>([\s\S]*?)<\/template>/g;
  let match;
  while ((match = templateRegex.exec(xml)) !== null) {
    html += match[1];
  }

  // If no template tags, try to use content directly
  if (!html && xml.includes("<")) {
    html = xml;
  }

  // Remove t-call to website.layout (we'll wrap content ourselves)
  html = html.replace(/<t\s+t-call=["']website\.layout["'][^>]*>/g, "");

  // Detect snippets used in the template
  const detectedSnippets = detectSnippets(html);

  // Use QWebRuntime for full template rendering
  try {
    html = qwebRuntime.render(html);
  } catch (error) {
    console.warn("QWeb rendering error, using fallback:", error);
    // Fallback to basic cleanup if runtime fails
    html = html
      .replace(/\s*t-if="[^"]*"/g, "")
      .replace(/\s*t-else="[^"]*"/g, "")
      .replace(/\s*t-elif="[^"]*"/g, "")
      .replace(/<t\s+t-esc="([^"]+)"[^/]*\/>/g, '<span class="preview-value">[$1]</span>')
      .replace(/<t\s+t-raw="([^"]+)"[^/]*\/>/g, '<span class="preview-value preview-html">[$1]</span>')
      .replace(/\s*t-attf?-[\w-]+="[^"]*"/g, "");
  }

  // Replace Odoo image URLs with SVG placeholders
  html = replaceImagesWithPlaceholders(html);

  return { html, snippets: detectedSnippets };
}

/**
 * Generate a complete HTML document from generated Odoo files
 */
function generatePreviewHtml(fileContents: Record<string, string>): string {
  let htmlContent = "";
  let cssContent = "";
  let cssVariables = "";
  let jsContent = "";
  const allSnippets: string[] = [];

  for (const [path, content] of Object.entries(fileContents)) {
    const ext = path.split(".").pop()?.toLowerCase();
    const fileName = path.split("/").pop()?.toLowerCase() || "";

    if (ext === "xml") {
      // Odoo QWeb templates - use QWebRuntime
      const { html, snippets } = extractQwebContent(content);
      htmlContent += html;
      allSnippets.push(...snippets);
    } else if (ext === "html") {
      htmlContent += content;
    } else if (ext === "scss") {
      const { css, variables } = convertScssVariables(content);
      cssContent += css;
      cssVariables += variables;
    } else if (ext === "css") {
      cssContent += content;
    } else if (ext === "js") {
      jsContent += content;
    } else if (ext === "py" && fileName === "__manifest__.py") {
      // Show manifest info in a comment (useful for debugging)
      console.log("Odoo manifest detected:", path);
    }
  }

  // If no HTML found, create a placeholder
  if (!htmlContent.trim()) {
    htmlContent = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui, sans-serif; color: #666; text-align: center; padding: 2rem;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 1rem; opacity: 0.5;">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        <h2 style="margin: 0 0 0.5rem; font-size: 1.25rem; font-weight: 600;">Odoo Theme Preview</h2>
        <p style="margin: 0; opacity: 0.7;">Generate an Odoo theme to see a live preview</p>
        <p style="margin: 0.5rem 0 0; font-size: 0.875rem; opacity: 0.5;">Try: "Create a restaurant website with warm colors"</p>
      </div>
    `;
  }

  // Bootstrap 5 CDN (same as Odoo 18 uses)
  const bootstrapCss = "https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css";
  const bootstrapJs = "https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js";
  const fontAwesomeCss = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css";

  // Log detected snippets for debugging
  if (allSnippets.length > 0) {
    console.log("Detected Odoo snippets:", allSnippets);
  }

  // Odoo color classes simulation + preview enhancements
  const odooColorClasses = `
    /* Odoo color classes */
    .o_cc { background-color: var(--o-cc-bg, #fff); color: var(--o-cc-text, #212529); }
    .o_cc1 { --o-cc-bg: #f8f9fa; --o-cc-text: #212529; }
    .o_cc2 { --o-cc-bg: #e9ecef; --o-cc-text: #212529; }
    .o_cc3 { --o-cc-bg: #dee2e6; --o-cc-text: #212529; }
    .o_cc4 { --o-cc-bg: #343a40; --o-cc-text: #fff; }
    .o_cc5 { --o-cc-bg: #212529; --o-cc-text: #fff; }
    .o_colored_level { padding: 2rem; }
    .oe_structure { min-height: 100px; }
    #wrap { min-height: 100vh; }

    /* Odoo spacing utilities */
    .pt16 { padding-top: 1rem; }
    .pt32 { padding-top: 2rem; }
    .pt48 { padding-top: 3rem; }
    .pt64 { padding-top: 4rem; }
    .pt96 { padding-top: 6rem; }
    .pt160 { padding-top: 10rem; }
    .pb16 { padding-bottom: 1rem; }
    .pb32 { padding-bottom: 2rem; }
    .pb48 { padding-bottom: 3rem; }
    .pb64 { padding-bottom: 4rem; }
    .pb96 { padding-bottom: 6rem; }
    .pb160 { padding-bottom: 10rem; }

    /* Preview value placeholders */
    .preview-value {
      display: inline-block;
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      padding: 0.125rem 0.5rem;
      border-radius: 0.25rem;
      font-family: ui-monospace, monospace;
      font-size: 0.75rem;
      color: #92400e;
      border: 1px dashed #f59e0b;
    }
    .preview-value.preview-html {
      background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
      color: #1e40af;
      border-color: #3b82f6;
    }
    .preview-field {
      background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
      color: #065f46;
      border: 1px dashed #10b981;
      padding: 0.125rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
    }

    /* Template call placeholders */
    .preview-template-call {
      border: 2px dashed #d1d5db;
      padding: 1rem;
      margin: 0.5rem 0;
      border-radius: 0.5rem;
      background: #f9fafb;
    }
    .preview-template-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
      font-size: 0.75rem;
      color: #6b7280;
    }
    .preview-template-name {
      font-family: ui-monospace, monospace;
      background: #e5e7eb;
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
    }
    .preview-template-compact {
      display: inline-flex;
      padding: 0.25rem 0.5rem;
      gap: 0.25rem;
    }
    .preview-template-empty {
      color: #9ca3af;
      font-style: italic;
    }

    /* Conditional preview indicators */
    [data-preview-if], [data-preview-elif] {
      position: relative;
      outline: 1px dashed #8b5cf6;
      outline-offset: 2px;
    }
    [data-preview-if]::before, [data-preview-elif]::before {
      content: "if: " attr(data-preview-if) attr(data-preview-elif);
      position: absolute;
      top: -0.75rem;
      left: 0.5rem;
      font-size: 0.625rem;
      background: #8b5cf6;
      color: white;
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-family: ui-monospace, monospace;
      opacity: 0.8;
      z-index: 10;
      white-space: nowrap;
    }
    [data-preview-else] {
      position: relative;
      outline: 1px dashed #ec4899;
      outline-offset: 2px;
    }
    [data-preview-else]::before {
      content: "else";
      position: absolute;
      top: -0.75rem;
      left: 0.5rem;
      font-size: 0.625rem;
      background: #ec4899;
      color: white;
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-family: ui-monospace, monospace;
      opacity: 0.8;
    }

    /* Loop item indicators */
    [data-preview-loop-item] {
      position: relative;
    }
    [data-preview-loop-item]::after {
      content: "#" attr(data-preview-loop-item);
      position: absolute;
      top: 0.25rem;
      right: 0.25rem;
      font-size: 0.625rem;
      background: #10b981;
      color: white;
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-family: ui-monospace, monospace;
      opacity: 0.6;
    }

    /* Editable text indicator */
    .o_default_snippet_text {
      border-bottom: 1px dotted #9ca3af;
    }

    /* Placeholder images */
    img[src^="/web/image"] {
      background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
      min-height: 150px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    img[src^="/web/image"]::before {
      content: "Image Placeholder";
      color: #6366f1;
      font-size: 0.875rem;
    }
  `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Odoo Theme Preview</title>
  <link href="${bootstrapCss}" rel="stylesheet">
  <link href="${fontAwesomeCss}" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
    ${odooColorClasses}
    ${cssVariables}
    ${cssContent}
  </style>
</head>
<body>
  <div id="wrapwrap">
    <div id="wrap" class="oe_structure">
      ${htmlContent}
    </div>
  </div>
  <script src="${bootstrapJs}"></script>
  ${jsContent ? `<script>${jsContent}</script>` : ""}
  ${SNIPPET_SELECT_SCRIPT}
  ${SNIPPET_CONTEXT_SCRIPT}
</body>
</html>
  `.trim();
}

export function PreviewPanel() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<DeviceType>("desktop");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("standalone");
  const [currentPath, setCurrentPath] = useState("/");
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [iframeWidth, setIframeWidth] = useState(0);

  const selectedSnippetId = useEditorStore((s) => s.selectedSnippetId);
  const setInputValue = useChatStore((s) => s.setInputValue);
  const { previewUrl, previewStatus, setPreviewStatus, isDeploying } = useSyncStore();
  const { odooUrl, odooStatus } = useProjectStore();
  const { fileContents, openTabs } = useEditorStore();
  const streamingPreview = useStreamingPreviewSafe();

  // Hot reload integration
  const [hotReloadKey, setHotReloadKey] = useState(0);
  const { state: hotReloadState, triggerReload } = usePreviewHotReload({
    debounceMs: 300,
    enabled: previewMode === "standalone" && !streamingPreview?.isStreaming,
    onBeforeReload: () => {
      setIsLoading(true);
    },
    onReload: (changedFiles) => {
      console.log("Hot reload triggered for:", changedFiles);
      setHotReloadKey((prev) => prev + 1);
    },
    onAfterReload: () => {
      setTimeout(() => setIsLoading(false), 150);
    },
  });

  // Zoom controls
  const { zoom, setZoom } = useZoom(100);

  // Element inspector
  const { isEnabled: inspectorEnabled, toggle: toggleInspector, disable: disableInspector } = useElementInspector();

  // Use odooUrl or default localhost
  const baseUrl = odooUrl || previewUrl || "http://localhost:8069";

  // Check if Odoo is available
  const isOdooAvailable = odooStatus === "connected";

  // Generate standalone preview HTML (with streaming support)
  const standaloneHtml = useMemo(() => {
    if (previewMode !== "standalone") return "";

    // If streaming, use partial content for preview
    if (streamingPreview?.isStreaming && streamingPreview.partialHtml) {
      const streamingFiles: Record<string, string> = {
        "streaming/preview.xml": streamingPreview.partialHtml,
      };
      if (streamingPreview.partialCss) {
        streamingFiles["streaming/preview.scss"] = streamingPreview.partialCss;
      }
      return generatePreviewHtml({ ...fileContents, ...streamingFiles });
    }

    return generatePreviewHtml(fileContents);
  }, [fileContents, previewMode, streamingPreview?.isStreaming, streamingPreview?.partialHtml, streamingPreview?.partialCss]);

  // Create blob URL for standalone preview
  const previewBlobUrl = useMemo(() => {
    if (!standaloneHtml) return null;
    const blob = new Blob([standaloneHtml], { type: "text/html" });
    return URL.createObjectURL(blob);
  }, [standaloneHtml]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewBlobUrl]);

  // Refresh preview
  const refreshPreview = useCallback(() => {
    setIsLoading(true);
    setHasError(false);

    if (previewMode === "odoo" && iframeRef.current) {
      const timestamp = Date.now();
      iframeRef.current.src = `${baseUrl}${currentPath}?_t=${timestamp}`;
    } else {
      // For standalone, just trigger re-render
      setTimeout(() => setIsLoading(false), 300);
    }
  }, [previewMode, baseUrl, currentPath]);

  // Handle iframe load
  const handleIframeLoad = () => {
    setIsLoading(false);
    setPreviewStatus("ready");
  };

  // Handle iframe error
  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
    setPreviewStatus("error");
  };

  // Auto-refresh after deploy
  useEffect(() => {
    if (!isDeploying && previewStatus === "loading" && previewMode === "odoo") {
      const timeout = setTimeout(refreshPreview, 1000);
      return () => clearTimeout(timeout);
    }
  }, [isDeploying, previewStatus, previewMode, refreshPreview]);

  // Update standalone preview when files change
  useEffect(() => {
    if (previewMode === "standalone" && Object.keys(fileContents).length > 0) {
      setIsLoading(true);
      setTimeout(() => setIsLoading(false), 200);
    }
  }, [fileContents, previewMode]);

  // Track iframe width for breakpoint indicator
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        setIframeWidth(width);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Update preview when streaming content changes
  useEffect(() => {
    if (streamingPreview?.isStreaming && previewMode === "standalone") {
      // Force re-render on streaming updates
      setIsLoading(false);
    }
  }, [streamingPreview?.partialHtml, streamingPreview?.isStreaming, previewMode]);

  // Open in new tab
  const openExternal = () => {
    if (previewMode === "standalone" && previewBlobUrl) {
      window.open(previewBlobUrl, "_blank");
    } else {
      window.open(`${baseUrl}${currentPath}`, "_blank");
    }
  };

  // Handle snippet context menu actions
  const handleSnippetAction = useCallback(
    (action: string, snippetId: string) => {
      const prompts: Record<string, string> = {
        regenerate: `Regenerate only the ${snippetId} section with a fresh design, keeping all other sections unchanged.`,
        restyle: `Restyle the ${snippetId} section with different colors and spacing, keeping the same content structure.`,
        duplicate: `Duplicate the ${snippetId} section with a variation below the original.`,
        remove: `Remove the ${snippetId} section from the page.`,
      };
      const prompt = prompts[action];
      if (prompt) {
        setInputValue(prompt);
      }
    },
    [setInputValue],
  );

  const hasGeneratedFiles = Object.keys(fileContents).length > 0;

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-muted/30">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-background">
          {/* Preview Mode Toggle */}
          <div className="flex items-center border rounded-md">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={previewMode === "standalone" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8 rounded-none first:rounded-l-md"
                  onClick={() => setPreviewMode("standalone")}
                >
                  <Code className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Standalone Preview</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={previewMode === "odoo" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8 rounded-none last:rounded-r-md"
                  onClick={() => setPreviewMode("odoo")}
                  disabled={!isOdooAvailable}
                >
                  <Globe className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isOdooAvailable ? "Odoo Preview" : "Odoo not connected"}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Device toggles */}
          <div className="flex items-center border rounded-md">
            {(["mobile", "tablet", "desktop"] as DeviceType[]).map((d) => {
              const Icon = d === "mobile" ? Smartphone : d === "tablet" ? Tablet : Monitor;
              return (
                <Tooltip key={d}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={device === d ? "secondary" : "ghost"}
                      size="icon"
                      className="h-8 w-8 rounded-none first:rounded-l-md last:rounded-r-md"
                      onClick={() => setDevice(d)}
                    >
                      <Icon className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{d.charAt(0).toUpperCase() + d.slice(1)}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* URL input (only for Odoo mode) */}
          {previewMode === "odoo" && (
            <div className="flex-1 flex items-center gap-2">
              <Input
                value={currentPath}
                onChange={(e) => setCurrentPath(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && refreshPreview()}
                placeholder="/"
                className="h-8 text-sm font-mono"
              />
            </div>
          )}

          {/* File count for standalone mode */}
          {previewMode === "standalone" && (
            <div className="flex-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {streamingPreview?.isStreaming
                  ? "Streaming preview..."
                  : hasGeneratedFiles
                  ? `Previewing ${Object.keys(fileContents).length} generated file(s)`
                  : "No files generated yet"}
              </span>
            </div>
          )}

          {/* Breakpoint indicator */}
          {iframeWidth > 0 && (
            <BreakpointIndicator width={iframeWidth} />
          )}

          {/* Hot reload indicator */}
          {previewMode === "standalone" && (
            <HotReloadIndicator state={hotReloadState} />
          )}

          {/* Zoom Controls */}
          {previewMode === "standalone" && (
            <ZoomControls zoom={zoom} onZoomChange={setZoom} />
          )}

          {/* Inspector Toggle */}
          {previewMode === "standalone" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={inspectorEnabled ? "secondary" : "ghost"}
                  size="icon"
                  className={cn("h-8 w-8", inspectorEnabled && "inspector-toggle-active")}
                  onClick={toggleInspector}
                >
                  <MousePointer2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {inspectorEnabled ? "Disable Inspector" : "Element Inspector"}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Actions */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={refreshPreview}
                disabled={isLoading}
              >
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={openExternal}
                disabled={previewMode === "standalone" && !previewBlobUrl}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open in new tab</TooltipContent>
          </Tooltip>
        </div>

        {/* Preview Area */}
        <div ref={containerRef} className="flex-1 flex items-center justify-center p-4 overflow-auto">
          <PreviewErrorBoundary onRetry={refreshPreview}>
            <DeviceFrame device={device}>
              {/* Streaming overlay */}
              {streamingPreview?.isStreaming && (
                <StreamingOverlay
                  isStreaming={streamingPreview.isStreaming}
                  progress={streamingPreview.streamProgress}
                  templateCount={streamingPreview.completedTemplates}
                />
              )}

              {/* Loading overlay */}
              {isLoading && !streamingPreview?.isStreaming && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">
                      {isDeploying ? "Deploying changes..." : "Loading preview..."}
                    </span>
                  </div>
                </div>
              )}

            {/* Error state (only for Odoo mode) */}
            {hasError && !isLoading && previewMode === "odoo" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background z-10">
                <AlertCircle className="w-12 h-12 text-destructive mb-4" />
                <p className="text-sm font-medium mb-2">Unable to load preview</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Make sure Odoo is running at {baseUrl}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPreviewMode("standalone")}>
                    <Code className="w-4 h-4 mr-2" />
                    Use Standalone
                  </Button>
                  <Button size="sm" onClick={refreshPreview}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                </div>
              </div>
            )}

            {/* Preview iframe */}
            {previewMode === "standalone" ? (
              <div
                className={cn(
                  "preview-iframe-container w-full h-full preview-zoom-container",
                  hotReloadState.isReloading && "reloading",
                  inspectorEnabled && "inspector-mode"
                )}
                style={{ transform: `scale(${zoom / 100})` }}
              >
                <iframe
                  key={`${hotReloadKey}-${standaloneHtml.length}`}
                  ref={iframeRef}
                  srcDoc={standaloneHtml}
                  className={cn(
                    "w-full h-full border-0 bg-white",
                    hotReloadState.reloadCount > 0 && "hot-reload-fade-in"
                  )}
                  sandbox="allow-scripts allow-same-origin"
                  title="Standalone Preview"
                  onLoad={handleIframeLoad}
                />
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                src={`${baseUrl}${currentPath}`}
                className="w-full h-full border-0"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                title="Website Preview"
              />
            )}

            {/* Element Inspector */}
            {previewMode === "standalone" && (
              <ElementInspector
                iframeRef={iframeRef}
                enabled={inspectorEnabled}
                onClose={disableInspector}
              />
            )}

            {/* Snippet click-to-select bridge */}
            {previewMode === "standalone" && (
              <SnippetSelector
                iframeRef={iframeRef}
                enabled={!inspectorEnabled}
              />
            )}
            </DeviceFrame>
          </PreviewErrorBoundary>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-3 py-1 border-t bg-background text-xs text-muted-foreground">
          <span>
            {previewMode === "standalone"
              ? streamingPreview?.isStreaming
                ? `Streaming • ${streamingPreview.completedTemplates} templates`
                : `Standalone Preview • ${Object.keys(fileContents).length} files`
              : baseUrl}
          </span>
          <div className="flex items-center gap-2">
            {/* Zoom indicator */}
            {previewMode === "standalone" && zoom !== 100 && (
              <ZoomIndicator zoom={zoom} />
            )}
            {/* Inspector indicator */}
            {previewMode === "standalone" && inspectorEnabled && (
              <span className="text-blue-500 text-xs">Inspector</span>
            )}
            {/* Selected snippet indicator */}
            {previewMode === "standalone" && selectedSnippetId && (
              <span className="text-purple-500 text-xs font-mono">
                {selectedSnippetId}
              </span>
            )}
            {/* Hot reload count */}
            {previewMode === "standalone" && hotReloadState.reloadCount > 0 && (
              <span className="text-muted-foreground/60">
                {hotReloadState.reloadCount} reload{hotReloadState.reloadCount !== 1 ? "s" : ""}
              </span>
            )}
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                hasError && previewMode === "odoo"
                  ? "bg-red-500"
                  : streamingPreview?.isStreaming
                  ? "bg-purple-500 animate-pulse"
                  : hotReloadState.isPending
                  ? "bg-amber-500 animate-pulse"
                  : hotReloadState.isReloading
                  ? "bg-blue-500 animate-pulse"
                  : isLoading
                  ? "bg-yellow-500"
                  : "bg-green-500"
              )}
            />
            <span>
              {previewMode === "standalone"
                ? streamingPreview?.isStreaming
                  ? `Streaming ${Math.round(streamingPreview.streamProgress)}%`
                  : hotReloadState.isPending
                  ? "Changes pending..."
                  : hotReloadState.isReloading
                  ? "Updating..."
                  : hasGeneratedFiles
                  ? "Ready"
                  : "Waiting for code"
                : hasError
                ? "Error"
                : isLoading
                ? "Loading"
                : "Connected"}
            </span>
          </div>
        </div>
      </div>

      {/* Snippet right-click context menu */}
      {previewMode === "standalone" && (
        <SnippetContextMenu onAction={handleSnippetAction} />
      )}
    </TooltipProvider>
  );
}
