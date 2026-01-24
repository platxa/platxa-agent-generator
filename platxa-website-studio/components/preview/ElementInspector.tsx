"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Copy, Check, Maximize2, Code2, Palette, Box, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils/cn";

export interface InspectedElement {
  tagName: string;
  id: string;
  className: string;
  computedStyles: Record<string, string>;
  boundingRect: DOMRect;
  attributes: Record<string, string>;
  textContent: string;
  path: string[];
}

interface ElementInspectorProps {
  iframeRef: React.RefObject<HTMLIFrameElement>;
  enabled: boolean;
  onClose: () => void;
}

/**
 * Element Inspector - Provides hover-to-inspect functionality
 * similar to browser DevTools
 */
export function ElementInspector({ iframeRef, enabled, onClose }: ElementInspectorProps) {
  const [hoveredElement, setHoveredElement] = useState<InspectedElement | null>(null);
  const [selectedElement, setSelectedElement] = useState<InspectedElement | null>(null);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [copiedProperty, setCopiedProperty] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  /**
   * Extract element information
   */
  const extractElementInfo = useCallback((element: Element): InspectedElement => {
    const computedStyle = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    // Get relevant computed styles
    const relevantProps = [
      "display", "position", "width", "height",
      "margin", "padding", "border",
      "background", "backgroundColor", "color",
      "fontFamily", "fontSize", "fontWeight", "lineHeight",
      "flexDirection", "justifyContent", "alignItems", "gap",
      "gridTemplateColumns", "gridTemplateRows",
      "opacity", "zIndex", "overflow",
      "borderRadius", "boxShadow", "transform"
    ];

    const computedStyles: Record<string, string> = {};
    for (const prop of relevantProps) {
      const value = computedStyle.getPropertyValue(
        prop.replace(/([A-Z])/g, "-$1").toLowerCase()
      );
      if (value && value !== "none" && value !== "normal" && value !== "auto") {
        computedStyles[prop] = value;
      }
    }

    // Build element path
    const path: string[] = [];
    let current: Element | null = element;
    while (current && current.tagName) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
        selector += `#${current.id}`;
      } else if (current.className && typeof current.className === "string") {
        const classes = current.className.split(" ").filter(c => c && !c.startsWith("preview-"));
        if (classes.length > 0) {
          selector += `.${classes.slice(0, 2).join(".")}`;
        }
      }
      path.unshift(selector);
      current = current.parentElement;
      if (path.length > 5) break;
    }

    // Get attributes
    const attributes: Record<string, string> = {};
    for (const attr of Array.from(element.attributes)) {
      if (!attr.name.startsWith("data-preview-")) {
        attributes[attr.name] = attr.value;
      }
    }

    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id || "",
      className: typeof element.className === "string" ? element.className : "",
      computedStyles,
      boundingRect: rect,
      attributes,
      textContent: element.textContent?.slice(0, 100) || "",
      path,
    };
  }, []);

  /**
   * Handle mouse move in iframe
   */
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!enabled) return;

    const target = e.target as Element;
    if (!target || target.tagName === "HTML" || target.tagName === "BODY") {
      setHoveredElement(null);
      setHighlightRect(null);
      return;
    }

    const info = extractElementInfo(target);
    setHoveredElement(info);

    // Adjust rect for iframe position
    const iframe = iframeRef.current;
    if (iframe) {
      const iframeRect = iframe.getBoundingClientRect();
      const adjustedRect = new DOMRect(
        info.boundingRect.x + iframeRect.x,
        info.boundingRect.y + iframeRect.y,
        info.boundingRect.width,
        info.boundingRect.height
      );
      setHighlightRect(adjustedRect);
    }
  }, [enabled, extractElementInfo, iframeRef]);

  /**
   * Handle click in iframe
   */
  const handleClick = useCallback((e: MouseEvent) => {
    if (!enabled) return;
    e.preventDefault();
    e.stopPropagation();

    const target = e.target as Element;
    if (target && target.tagName !== "HTML" && target.tagName !== "BODY") {
      const info = extractElementInfo(target);
      setSelectedElement(info);
    }
  }, [enabled, extractElementInfo]);

  /**
   * Handle mouse leave
   */
  const handleMouseLeave = useCallback(() => {
    setHoveredElement(null);
    setHighlightRect(null);
  }, []);

  /**
   * Attach event listeners to iframe
   */
  useEffect(() => {
    if (!enabled) {
      setHoveredElement(null);
      setHighlightRect(null);
      return;
    }

    const iframe = iframeRef.current;
    if (!iframe) return;

    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) return;

    // Add cursor style
    iframeDoc.body.style.cursor = "crosshair";

    // Attach listeners
    iframeDoc.addEventListener("mousemove", handleMouseMove);
    iframeDoc.addEventListener("click", handleClick, true);
    iframeDoc.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      iframeDoc.body.style.cursor = "";
      iframeDoc.removeEventListener("mousemove", handleMouseMove);
      iframeDoc.removeEventListener("click", handleClick, true);
      iframeDoc.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [enabled, iframeRef, handleMouseMove, handleClick, handleMouseLeave]);

  /**
   * Copy property value
   */
  const copyValue = (key: string, value: string) => {
    navigator.clipboard.writeText(`${key}: ${value};`);
    setCopiedProperty(key);
    setTimeout(() => setCopiedProperty(null), 1500);
  };

  if (!enabled) return null;

  const displayElement = selectedElement || hoveredElement;

  return (
    <>
      {/* Highlight overlay */}
      {highlightRect && (
        <div
          ref={overlayRef}
          className="fixed pointer-events-none z-50"
          style={{
            left: highlightRect.x,
            top: highlightRect.y,
            width: highlightRect.width,
            height: highlightRect.height,
          }}
        >
          {/* Content box */}
          <div className="absolute inset-0 bg-blue-500/20 border-2 border-blue-500" />

          {/* Element label */}
          <div
            className="absolute -top-6 left-0 px-2 py-0.5 bg-blue-600 text-white text-xs font-mono rounded shadow-lg whitespace-nowrap"
          >
            {hoveredElement?.tagName}
            {hoveredElement?.id && <span className="text-blue-200">#{hoveredElement.id}</span>}
            {hoveredElement?.className && (
              <span className="text-blue-300 ml-1">
                .{hoveredElement.className.split(" ")[0]}
              </span>
            )}
          </div>

          {/* Dimensions */}
          <div
            className="absolute -bottom-5 right-0 px-1.5 py-0.5 bg-gray-800 text-white text-xs font-mono rounded"
          >
            {Math.round(highlightRect.width)} x {Math.round(highlightRect.height)}
          </div>
        </div>
      )}

      {/* Inspector panel */}
      {displayElement && (
        <div className="absolute right-4 top-4 bottom-4 w-80 bg-card border rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden inspector-panel-enter">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm">Element Inspector</span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Element path */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Maximize2 className="w-3 h-3" />
                  <span>Element Path</span>
                </div>
                <div className="font-mono text-xs bg-muted/50 p-2 rounded-lg overflow-x-auto">
                  {displayElement.path.map((part, i) => (
                    <span key={i}>
                      {i > 0 && <span className="text-muted-foreground mx-1">&gt;</span>}
                      <span className="text-primary">{part}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Box model */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Box className="w-3 h-3" />
                  <span>Box Model</span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-center text-xs font-mono">
                  <div />
                  <div className="bg-orange-500/20 text-orange-600 p-1 rounded">
                    {displayElement.computedStyles.marginTop || "0"}
                  </div>
                  <div />
                  <div className="bg-orange-500/20 text-orange-600 p-1 rounded">
                    {displayElement.computedStyles.marginLeft || "0"}
                  </div>
                  <div className="bg-green-500/20 p-1 rounded">
                    <div className="text-green-600 text-[10px]">
                      {Math.round(displayElement.boundingRect.width)} x {Math.round(displayElement.boundingRect.height)}
                    </div>
                  </div>
                  <div className="bg-orange-500/20 text-orange-600 p-1 rounded">
                    {displayElement.computedStyles.marginRight || "0"}
                  </div>
                  <div />
                  <div className="bg-orange-500/20 text-orange-600 p-1 rounded">
                    {displayElement.computedStyles.marginBottom || "0"}
                  </div>
                  <div />
                </div>
              </div>

              {/* Typography */}
              {(displayElement.computedStyles.fontFamily || displayElement.computedStyles.fontSize) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Type className="w-3 h-3" />
                    <span>Typography</span>
                  </div>
                  <div className="space-y-1">
                    {displayElement.computedStyles.fontFamily && (
                      <PropertyRow
                        prop="font-family"
                        value={displayElement.computedStyles.fontFamily}
                        copied={copiedProperty === "font-family"}
                        onCopy={() => copyValue("font-family", displayElement.computedStyles.fontFamily)}
                      />
                    )}
                    {displayElement.computedStyles.fontSize && (
                      <PropertyRow
                        prop="font-size"
                        value={displayElement.computedStyles.fontSize}
                        copied={copiedProperty === "font-size"}
                        onCopy={() => copyValue("font-size", displayElement.computedStyles.fontSize)}
                      />
                    )}
                    {displayElement.computedStyles.fontWeight && (
                      <PropertyRow
                        prop="font-weight"
                        value={displayElement.computedStyles.fontWeight}
                        copied={copiedProperty === "font-weight"}
                        onCopy={() => copyValue("font-weight", displayElement.computedStyles.fontWeight)}
                      />
                    )}
                    {displayElement.computedStyles.lineHeight && (
                      <PropertyRow
                        prop="line-height"
                        value={displayElement.computedStyles.lineHeight}
                        copied={copiedProperty === "line-height"}
                        onCopy={() => copyValue("line-height", displayElement.computedStyles.lineHeight)}
                      />
                    )}
                    {displayElement.computedStyles.color && (
                      <PropertyRow
                        prop="color"
                        value={displayElement.computedStyles.color}
                        copied={copiedProperty === "color"}
                        onCopy={() => copyValue("color", displayElement.computedStyles.color)}
                        showSwatch
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Styles */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Palette className="w-3 h-3" />
                  <span>Computed Styles</span>
                </div>
                <div className="space-y-1">
                  {Object.entries(displayElement.computedStyles)
                    .filter(([key]) => !["fontFamily", "fontSize", "fontWeight", "lineHeight", "color"].includes(key))
                    .map(([key, value]) => (
                      <PropertyRow
                        key={key}
                        prop={key.replace(/([A-Z])/g, "-$1").toLowerCase()}
                        value={value}
                        copied={copiedProperty === key}
                        onCopy={() => copyValue(key, value)}
                        showSwatch={key.toLowerCase().includes("color") || key.toLowerCase().includes("background")}
                      />
                    ))}
                </div>
              </div>

              {/* Attributes */}
              {Object.keys(displayElement.attributes).length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Attributes</div>
                  <div className="space-y-1">
                    {Object.entries(displayElement.attributes).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between text-xs font-mono bg-muted/30 px-2 py-1 rounded"
                      >
                        <span className="text-purple-600">{key}</span>
                        <span className="text-muted-foreground truncate max-w-[180px]">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
            Click element to pin • Hover to inspect
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Property row component
 */
interface PropertyRowProps {
  prop: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  showSwatch?: boolean;
}

function PropertyRow({ prop, value, copied, onCopy, showSwatch }: PropertyRowProps) {
  return (
    <div
      className="group flex items-center justify-between text-xs font-mono bg-muted/30 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={onCopy}
    >
      <div className="flex items-center gap-2">
        {showSwatch && (
          <div
            className="w-3 h-3 rounded border"
            style={{ backgroundColor: value }}
          />
        )}
        <span className="text-blue-600">{prop}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground truncate max-w-[120px]">{value}</span>
        {copied ? (
          <Check className="w-3 h-3 text-green-500" />
        ) : (
          <Copy className="w-3 h-3 opacity-0 group-hover:opacity-50" />
        )}
      </div>
    </div>
  );
}

/**
 * Hook for managing inspector state
 */
export function useElementInspector() {
  const [isEnabled, setIsEnabled] = useState(false);

  const toggle = useCallback(() => {
    setIsEnabled((prev) => !prev);
  }, []);

  const enable = useCallback(() => setIsEnabled(true), []);
  const disable = useCallback(() => setIsEnabled(false), []);

  return {
    isEnabled,
    toggle,
    enable,
    disable,
  };
}
