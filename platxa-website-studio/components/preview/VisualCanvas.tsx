"use client";

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type RefObject,
} from "react";
import { cn } from "@/lib/utils/cn";
import {
  getVisualEditor,
  type SelectedElement,
  type VisualEditorEvent,
} from "@/lib/agent-bridge/visual-editor";
import { getSourceMapper } from "@/lib/agent-bridge/source-mapper";

// =============================================================================
// Types
// =============================================================================

interface SelectionHandles {
  top: number;
  left: number;
  width: number;
  height: number;
  visible: boolean;
}

interface CanvasMessage {
  type: string;
  file?: string;
  line?: number;
  column?: number;
  elementId?: string;
  tagName?: string;
  rect?: { top: number; left: number; width: number; height: number };
}

interface VisualCanvasProps {
  /** HTML content to display in iframe */
  html?: string;
  /** URL to load in iframe */
  src?: string;
  /** Called when an element is selected */
  onSelect?: (selection: SelectedElement | null) => void;
  /** Called when element is double-clicked (navigate to source) */
  onNavigateToSource?: (file: string, line: number, column?: number) => void;
  /** Called when hover changes */
  onHover?: (elementId: string | null) => void;
  /** Whether visual editing is enabled */
  editingEnabled?: boolean;
  /** Scale factor for zoom */
  scale?: number;
  /** Additional class name */
  className?: string;
  /** Iframe title for accessibility */
  title?: string;
}

// =============================================================================
// Constants
// =============================================================================

const SELECTION_HANDLE_SIZE = 8;
const SELECTION_BORDER_COLOR = "#3b82f6"; // blue-500
const HOVER_BORDER_COLOR = "#94a3b8"; // slate-400

// =============================================================================
// Helpers
// =============================================================================

/** Inject click handler script into HTML */
function injectClickHandler(html: string): string {
  const script = `
<script>
(function() {
  'use strict';

  var currentSelection = null;
  var currentHover = null;

  function findSourceElement(el) {
    while (el && el !== document.body) {
      var id = el.getAttribute('data-qweb-id') || el.getAttribute('data-source-id');
      if (id) {
        return {
          id: id,
          line: parseInt(el.getAttribute('data-qweb-line') || el.getAttribute('data-source-line') || '0', 10),
          file: el.getAttribute('data-qweb-file') || el.getAttribute('data-source-file') || '',
          column: parseInt(el.getAttribute('data-qweb-col') || '1', 10),
          tagName: el.tagName.toLowerCase(),
          element: el
        };
      }
      el = el.parentElement;
    }
    return null;
  }

  function getRect(el) {
    var rect = el.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height
    };
  }

  // Selection styles
  var style = document.createElement('style');
  style.textContent = [
    '.platxa-selected {',
    '  outline: 2px solid ' + '${SELECTION_BORDER_COLOR}' + ' !important;',
    '  outline-offset: 2px;',
    '}',
    '.platxa-hover {',
    '  outline: 1px dashed ' + '${HOVER_BORDER_COLOR}' + ' !important;',
    '  outline-offset: 1px;',
    '}'
  ].join('\\n');
  document.head.appendChild(style);

  // Click to select
  document.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();

    var info = findSourceElement(e.target);

    // Clear previous selection
    if (currentSelection) {
      currentSelection.classList.remove('platxa-selected');
    }

    if (info) {
      currentSelection = info.element;
      currentSelection.classList.add('platxa-selected');

      window.parent.postMessage({
        type: 'platxa:canvas-select',
        elementId: info.id,
        file: info.file,
        line: info.line,
        column: info.column,
        tagName: info.tagName,
        rect: getRect(info.element)
      }, '*');
    } else {
      currentSelection = null;
      window.parent.postMessage({
        type: 'platxa:canvas-deselect'
      }, '*');
    }
  }, true);

  // Double-click to navigate
  document.addEventListener('dblclick', function(e) {
    e.preventDefault();
    var info = findSourceElement(e.target);
    if (info && info.file && info.line) {
      window.parent.postMessage({
        type: 'platxa:canvas-navigate',
        file: info.file,
        line: info.line,
        column: info.column,
        elementId: info.id
      }, '*');
    }
  }, true);

  // Hover
  document.addEventListener('mouseover', function(e) {
    var info = findSourceElement(e.target);

    if (currentHover && currentHover !== currentSelection) {
      currentHover.classList.remove('platxa-hover');
    }

    if (info && info.element !== currentSelection) {
      currentHover = info.element;
      currentHover.classList.add('platxa-hover');

      window.parent.postMessage({
        type: 'platxa:canvas-hover',
        elementId: info.id,
        rect: getRect(info.element)
      }, '*');
    }
  });

  document.addEventListener('mouseout', function(e) {
    if (currentHover && currentHover !== currentSelection) {
      currentHover.classList.remove('platxa-hover');
    }
    window.parent.postMessage({
      type: 'platxa:canvas-hover-out'
    }, '*');
  });

  // Listen for highlight commands from parent
  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;

    if (e.data.type === 'platxa:highlight') {
      var el = document.querySelector('[data-qweb-id="' + e.data.elementId + '"]') ||
               document.querySelector('[data-source-id="' + e.data.elementId + '"]');
      if (el) {
        if (currentSelection) {
          currentSelection.classList.remove('platxa-selected');
        }
        currentSelection = el;
        currentSelection.classList.add('platxa-selected');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    if (e.data.type === 'platxa:clear-selection') {
      if (currentSelection) {
        currentSelection.classList.remove('platxa-selected');
        currentSelection = null;
      }
    }
  });

  // Ready
  window.parent.postMessage({ type: 'platxa:canvas-ready' }, '*');
})();
</script>`;

  // Inject before </body> or at end
  if (html.includes("</body>")) {
    return html.replace("</body>", script + "</body>");
  }
  return html + script;
}

// =============================================================================
// Selection Overlay Component
// =============================================================================

interface SelectionOverlayProps {
  handles: SelectionHandles;
  scale: number;
}

function SelectionOverlay({ handles, scale }: SelectionOverlayProps) {
  if (!handles.visible) return null;

  const handleStyle = {
    width: SELECTION_HANDLE_SIZE,
    height: SELECTION_HANDLE_SIZE,
    backgroundColor: SELECTION_BORDER_COLOR,
    border: "1px solid white",
    position: "absolute" as const,
  };

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        top: handles.top * scale,
        left: handles.left * scale,
        width: handles.width * scale,
        height: handles.height * scale,
        border: `2px solid ${SELECTION_BORDER_COLOR}`,
        boxShadow: "0 0 0 1px rgba(59, 130, 246, 0.2)",
      }}
    >
      {/* Corner handles */}
      <div
        style={{
          ...handleStyle,
          top: -SELECTION_HANDLE_SIZE / 2,
          left: -SELECTION_HANDLE_SIZE / 2,
          cursor: "nw-resize",
        }}
      />
      <div
        style={{
          ...handleStyle,
          top: -SELECTION_HANDLE_SIZE / 2,
          right: -SELECTION_HANDLE_SIZE / 2,
          cursor: "ne-resize",
        }}
      />
      <div
        style={{
          ...handleStyle,
          bottom: -SELECTION_HANDLE_SIZE / 2,
          left: -SELECTION_HANDLE_SIZE / 2,
          cursor: "sw-resize",
        }}
      />
      <div
        style={{
          ...handleStyle,
          bottom: -SELECTION_HANDLE_SIZE / 2,
          right: -SELECTION_HANDLE_SIZE / 2,
          cursor: "se-resize",
        }}
      />

      {/* Edge handles */}
      <div
        style={{
          ...handleStyle,
          top: -SELECTION_HANDLE_SIZE / 2,
          left: "50%",
          transform: "translateX(-50%)",
          cursor: "n-resize",
        }}
      />
      <div
        style={{
          ...handleStyle,
          bottom: -SELECTION_HANDLE_SIZE / 2,
          left: "50%",
          transform: "translateX(-50%)",
          cursor: "s-resize",
        }}
      />
      <div
        style={{
          ...handleStyle,
          top: "50%",
          left: -SELECTION_HANDLE_SIZE / 2,
          transform: "translateY(-50%)",
          cursor: "w-resize",
        }}
      />
      <div
        style={{
          ...handleStyle,
          top: "50%",
          right: -SELECTION_HANDLE_SIZE / 2,
          transform: "translateY(-50%)",
          cursor: "e-resize",
        }}
      />
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * VisualCanvas - Iframe-based canvas for visual editing with element selection
 *
 * Feature #16: Visual Edit Mode - Click to select elements
 *
 * @example
 * ```tsx
 * <VisualCanvas
 *   html={annotatedHtml}
 *   editingEnabled={true}
 *   onSelect={(selection) => openPropertyPanel(selection)}
 *   onNavigateToSource={(file, line) => editor.goToLine(file, line)}
 * />
 * ```
 */
export function VisualCanvas({
  html,
  src,
  onSelect,
  onNavigateToSource,
  onHover,
  editingEnabled = true,
  scale = 1,
  className,
  title = "Preview Canvas",
}: VisualCanvasProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [selection, setSelection] = useState<SelectionHandles>({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    visible: false,
  });

  const visualEditor = getVisualEditor();
  const sourceMapper = getSourceMapper();

  // Handle messages from iframe
  const handleMessage = useCallback(
    (event: MessageEvent<CanvasMessage>) => {
      if (!event.data || !event.data.type) return;

      const { type, elementId, file, line, column, rect, tagName } = event.data;

      switch (type) {
        case "platxa:canvas-ready":
          setIsReady(true);
          break;

        case "platxa:canvas-select":
          if (elementId && editingEnabled) {
            const selected = visualEditor.selectElement(elementId);
            onSelect?.(selected);

            if (rect) {
              setSelection({
                ...rect,
                visible: true,
              });
            }
          }
          break;

        case "platxa:canvas-deselect":
          visualEditor.clearSelection();
          onSelect?.(null);
          setSelection((prev) => ({ ...prev, visible: false }));
          break;

        case "platxa:canvas-navigate":
          if (file && line) {
            onNavigateToSource?.(file, line, column);
          }
          break;

        case "platxa:canvas-hover":
          if (elementId) {
            visualEditor.setHoveredElement(elementId);
            onHover?.(elementId);
          }
          break;

        case "platxa:canvas-hover-out":
          visualEditor.setHoveredElement(null);
          onHover?.(null);
          break;
      }
    },
    [editingEnabled, visualEditor, onSelect, onNavigateToSource, onHover]
  );

  // Subscribe to iframe messages
  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // Subscribe to visual editor events
  useEffect(() => {
    const unsubscribe = visualEditor.on((event: VisualEditorEvent) => {
      if (event.type === "selection_changed" && !event.elementId) {
        setSelection((prev) => ({ ...prev, visible: false }));
      }
    });
    return unsubscribe;
  }, [visualEditor]);

  // Load HTML content into iframe
  useEffect(() => {
    if (!iframeRef.current || !html) return;

    const processedHtml = editingEnabled ? injectClickHandler(html) : html;

    // Write to iframe document
    const doc = iframeRef.current.contentDocument;
    if (doc) {
      doc.open();
      doc.write(processedHtml);
      doc.close();
    }
  }, [html, editingEnabled]);

  // Highlight element from parent
  const highlightElement = useCallback((elementId: string) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "platxa:highlight", elementId },
        "*"
      );
    }
  }, []);

  // Clear selection from parent
  const clearSelection = useCallback(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "platxa:clear-selection" },
        "*"
      );
    }
    setSelection((prev) => ({ ...prev, visible: false }));
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden bg-white rounded-lg border",
        editingEnabled && "cursor-crosshair",
        className
      )}
    >
      {/* Loading indicator */}
      {!isReady && html && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Loading preview...
          </div>
        </div>
      )}

      {/* Iframe container */}
      <div
        className="relative"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <iframe
          ref={iframeRef}
          src={src}
          title={title}
          className="w-full h-full border-0"
          style={{
            minHeight: "100vh",
            pointerEvents: editingEnabled ? "auto" : "none",
          }}
          sandbox="allow-scripts allow-same-origin"
        />
      </div>

      {/* Selection overlay */}
      {editingEnabled && (
        <SelectionOverlay handles={selection} scale={scale} />
      )}

      {/* Editing mode indicator */}
      {editingEnabled && (
        <div className="absolute top-2 right-2 px-2 py-1 bg-primary/90 text-primary-foreground text-xs rounded-full shadow">
          Visual Edit Mode
        </div>
      )}
    </div>
  );
}

export default VisualCanvas;
