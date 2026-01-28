"use client";

import { useEffect, useCallback, useRef } from "react";
import { RefreshCw, Copy, Trash2, Paintbrush } from "lucide-react";
import { useEditorStore } from "@/lib/stores";
import { cn } from "@/lib/utils/cn";

/**
 * Message payload from iframe when user right-clicks a snippet.
 */
export interface SnippetContextMenuMessage {
  type: "platxa:snippet-context";
  snippetId: string;
  element: string;
  /** Screen-relative position for the menu */
  x: number;
  y: number;
}

/**
 * Script addition for right-click handling in the preview iframe.
 * Detects snippet on contextmenu, posts position to parent.
 */
export const SNIPPET_CONTEXT_SCRIPT = `
<script>
(function() {
  var SNIPPET_CLASS_RE = /\\bs_[a-z][a-z0-9_]*/;

  function findSnippetAncestor(el) {
    while (el && el !== document.body) {
      if (el.dataset && el.dataset.snippet) {
        return { id: el.dataset.snippet, element: describeEl(el) };
      }
      if (el.className && typeof el.className === 'string') {
        var match = el.className.match(SNIPPET_CLASS_RE);
        if (match) return { id: match[0], element: describeEl(el) };
      }
      el = el.parentElement;
    }
    return null;
  }

  function describeEl(el) {
    var tag = el.tagName.toLowerCase();
    var cls = (el.className || '').toString().trim();
    return cls ? tag + '.' + cls.split(/\\s+/).join('.') : tag;
  }

  document.addEventListener('contextmenu', function(e) {
    var result = findSnippetAncestor(e.target);
    if (result) {
      e.preventDefault();
      // Get iframe bounding rect relative to parent viewport
      var rect = window.frameElement
        ? window.frameElement.getBoundingClientRect()
        : { left: 0, top: 0 };
      window.parent.postMessage({
        type: 'platxa:snippet-context',
        snippetId: result.id,
        element: result.element,
        x: e.clientX + rect.left,
        y: e.clientY + rect.top
      }, '*');
    }
  }, true);
})();
</script>`;

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  action: string;
  variant?: "default" | "destructive";
}

const MENU_ITEMS: MenuItem[] = [
  { label: "Regenerate Section", icon: <RefreshCw className="w-3.5 h-3.5" />, action: "regenerate" },
  { label: "Restyle Section", icon: <Paintbrush className="w-3.5 h-3.5" />, action: "restyle" },
  { label: "Duplicate Section", icon: <Copy className="w-3.5 h-3.5" />, action: "duplicate" },
  { label: "Remove Section", icon: <Trash2 className="w-3.5 h-3.5" />, action: "remove", variant: "destructive" },
];

interface SnippetContextMenuProps {
  onAction: (action: string, snippetId: string) => void;
}

/**
 * Floating context menu that appears when right-clicking a snippet
 * in the preview iframe. Dispatches actions like regenerate/restyle/remove.
 */
export function SnippetContextMenu({ onAction }: SnippetContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const regenRequest = useEditorStore((s) => s.snippetRegenRequest);
  const clearRequest = useEditorStore((s) => s.clearSnippetRegenRequest);
  const requestRegen = useEditorStore((s) => s.requestSnippetRegen);

  // Listen for contextmenu messages from iframe
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      const data = event.data;
      if (data && data.type === "platxa:snippet-context" && data.snippetId) {
        requestRegen(data.snippetId, { x: data.x, y: data.y });
      }
    },
    [requestRegen],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // Close on outside click or escape
  useEffect(() => {
    if (!regenRequest) return;

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        clearRequest();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearRequest();
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [regenRequest, clearRequest]);

  if (!regenRequest) return null;

  const handleAction = (action: string) => {
    onAction(action, regenRequest.snippetId);
    clearRequest();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] bg-popover border border-border rounded-lg shadow-lg py-1 animate-in fade-in-0 zoom-in-95"
      style={{
        left: regenRequest.position.x,
        top: regenRequest.position.y,
      }}
    >
      <div className="px-3 py-1.5 text-xs text-muted-foreground font-mono border-b mb-1">
        {regenRequest.snippetId}
      </div>
      {MENU_ITEMS.map((item) => (
        <button
          key={item.action}
          className={cn(
            "flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-accent transition-colors",
            item.variant === "destructive" && "text-destructive hover:bg-destructive/10",
          )}
          onClick={() => handleAction(item.action)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
