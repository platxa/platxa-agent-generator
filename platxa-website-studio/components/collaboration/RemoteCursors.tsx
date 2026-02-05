"use client";

/**
 * RemoteCursors
 *
 * Renders cursor positions and selections of other users in the editor.
 * Shows cursor lines with name labels and selection highlights.
 *
 * Feature #74: Collaboration - Remote cursor visualization
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { CollaboratorInfo } from "@/lib/collaboration";

// =============================================================================
// Types
// =============================================================================

export interface CursorPosition {
  line: number;
  column: number;
}

export interface SelectionRange {
  start: CursorPosition;
  end: CursorPosition;
}

export interface RemoteCursor {
  /** Unique client ID */
  clientId: number;
  /** User's display name */
  name: string;
  /** User's cursor color */
  color: string;
  /** Whether user is an AI */
  isAi: boolean;
  /** Current cursor position */
  cursor: CursorPosition | null;
  /** Current selection range */
  selection: SelectionRange | null;
  /** Current file path */
  filePath: string | null;
  /** User's activity status */
  status: CollaboratorInfo["status"];
  /** Last activity timestamp */
  lastActivity: number;
}

export interface RemoteCursorsProps {
  /** List of collaborators with cursor info */
  collaborators: CollaboratorInfo[];
  /** Current file being viewed */
  currentFile: string;
  /** Function to convert line/column to pixel position */
  getPositionFromLineColumn: (line: number, column: number) => { x: number; y: number } | null;
  /** Line height in pixels */
  lineHeight: number;
  /** Character width in pixels (for selection width calculation) */
  charWidth: number;
  /** Editor container element ref */
  editorRef: React.RefObject<HTMLElement>;
  /** Hide cursors after this many ms of inactivity */
  hideAfterMs?: number;
  /** Show name labels */
  showLabels?: boolean;
  /** Show selection highlights */
  showSelections?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const CURSOR_WIDTH = 2;
const LABEL_OFFSET_Y = -20;
const FADE_DURATION = 300;
const DEFAULT_HIDE_AFTER = 30000; // 30 seconds

// =============================================================================
// Component
// =============================================================================

export function RemoteCursors({
  collaborators,
  currentFile,
  getPositionFromLineColumn,
  lineHeight,
  charWidth,
  editorRef,
  hideAfterMs = DEFAULT_HIDE_AFTER,
  showLabels = true,
  showSelections = true,
  className,
}: RemoteCursorsProps) {
  const [now, setNow] = useState(Date.now());
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  // Update time for activity-based hiding
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(interval);
  }, []);

  // Get portal container from editor ref
  useEffect(() => {
    if (editorRef.current) {
      // Look for or create a cursor overlay container
      let container = editorRef.current.querySelector(".remote-cursors-container") as HTMLElement;
      if (!container) {
        container = document.createElement("div");
        container.className = "remote-cursors-container";
        container.style.cssText = "position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 50;";
        editorRef.current.style.position = "relative";
        editorRef.current.appendChild(container);
      }
      setPortalContainer(container);
    }
  }, [editorRef]);

  // Filter collaborators to those in the current file
  const remoteCursors = useMemo<RemoteCursor[]>(() => {
    return collaborators
      .filter((c) => !c.isLocal && c.currentFile === currentFile)
      .filter((c) => now - c.lastActivity < hideAfterMs)
      .map((c) => ({
        clientId: c.clientId,
        name: c.name,
        color: c.color,
        isAi: c.isAi,
        cursor: c.cursor || null,
        selection: c.selection || null,
        filePath: c.currentFile || null,
        status: c.status,
        lastActivity: c.lastActivity,
      }));
  }, [collaborators, currentFile, now, hideAfterMs]);

  // Don't render if no portal or no cursors
  if (!portalContainer || remoteCursors.length === 0) {
    return null;
  }

  return createPortal(
    <div className={cn("remote-cursors", className)}>
      {remoteCursors.map((cursor) => (
        <RemoteCursorOverlay
          key={cursor.clientId}
          cursor={cursor}
          getPositionFromLineColumn={getPositionFromLineColumn}
          lineHeight={lineHeight}
          charWidth={charWidth}
          showLabel={showLabels}
          showSelection={showSelections}
          fadeOpacity={getFadeOpacity(cursor.lastActivity, now, hideAfterMs)}
        />
      ))}
    </div>,
    portalContainer
  );
}

// =============================================================================
// Cursor Overlay
// =============================================================================

interface RemoteCursorOverlayProps {
  cursor: RemoteCursor;
  getPositionFromLineColumn: (line: number, column: number) => { x: number; y: number } | null;
  lineHeight: number;
  charWidth: number;
  showLabel: boolean;
  showSelection: boolean;
  fadeOpacity: number;
}

function RemoteCursorOverlay({
  cursor,
  getPositionFromLineColumn,
  lineHeight,
  charWidth,
  showLabel,
  showSelection,
  fadeOpacity,
}: RemoteCursorOverlayProps) {
  const [labelVisible, setLabelVisible] = useState(true);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Auto-hide label after a few seconds
  useEffect(() => {
    setLabelVisible(true);
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = setTimeout(() => {
      setLabelVisible(false);
    }, 3000);

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [cursor.cursor?.line, cursor.cursor?.column]);

  // Get cursor position
  const cursorPos = cursor.cursor
    ? getPositionFromLineColumn(cursor.cursor.line, cursor.cursor.column)
    : null;

  if (!cursorPos) {
    return null;
  }

  return (
    <div
      className="remote-cursor-overlay"
      style={{ opacity: fadeOpacity, transition: `opacity ${FADE_DURATION}ms ease` }}
    >
      {/* Selection highlight */}
      {showSelection && cursor.selection && (
        <SelectionHighlight
          selection={cursor.selection}
          color={cursor.color}
          getPositionFromLineColumn={getPositionFromLineColumn}
          lineHeight={lineHeight}
          charWidth={charWidth}
        />
      )}

      {/* Cursor line */}
      <div
        className="absolute transition-all duration-75 ease-out"
        style={{
          left: cursorPos.x,
          top: cursorPos.y,
          width: CURSOR_WIDTH,
          height: lineHeight,
          backgroundColor: cursor.color,
          boxShadow: `0 0 4px ${cursor.color}`,
        }}
      />

      {/* Name label */}
      {showLabel && (
        <CursorLabel
          name={cursor.name}
          color={cursor.color}
          isAi={cursor.isAi}
          status={cursor.status}
          x={cursorPos.x}
          y={cursorPos.y + LABEL_OFFSET_Y}
          visible={labelVisible}
        />
      )}
    </div>
  );
}

// =============================================================================
// Selection Highlight
// =============================================================================

interface SelectionHighlightProps {
  selection: SelectionRange;
  color: string;
  getPositionFromLineColumn: (line: number, column: number) => { x: number; y: number } | null;
  lineHeight: number;
  charWidth: number;
}

function SelectionHighlight({
  selection,
  color,
  getPositionFromLineColumn,
  lineHeight,
  charWidth,
}: SelectionHighlightProps) {
  const { start, end } = selection;

  // Normalize selection (start before end)
  const normalizedStart =
    start.line < end.line || (start.line === end.line && start.column <= end.column)
      ? start
      : end;
  const normalizedEnd =
    start.line < end.line || (start.line === end.line && start.column <= end.column)
      ? end
      : start;

  // Generate selection rects for each line
  const rects: Array<{ x: number; y: number; width: number; height: number }> = [];

  for (let line = normalizedStart.line; line <= normalizedEnd.line; line++) {
    const isFirstLine = line === normalizedStart.line;
    const isLastLine = line === normalizedEnd.line;

    const startCol = isFirstLine ? normalizedStart.column : 0;
    const endCol = isLastLine ? normalizedEnd.column : 200; // Approximate line length

    const startPos = getPositionFromLineColumn(line, startCol);
    const endPos = getPositionFromLineColumn(line, endCol);

    if (startPos && endPos) {
      rects.push({
        x: startPos.x,
        y: startPos.y,
        width: Math.max(endPos.x - startPos.x, charWidth),
        height: lineHeight,
      });
    }
  }

  return (
    <>
      {rects.map((rect, i) => (
        <div
          key={i}
          className="absolute pointer-events-none"
          style={{
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            backgroundColor: color,
            opacity: 0.2,
            borderRadius: 2,
          }}
        />
      ))}
    </>
  );
}

// =============================================================================
// Cursor Label
// =============================================================================

interface CursorLabelProps {
  name: string;
  color: string;
  isAi: boolean;
  status: CollaboratorInfo["status"];
  x: number;
  y: number;
  visible: boolean;
}

function CursorLabel({ name, color, isAi, status, x, y, visible }: CursorLabelProps) {
  return (
    <div
      className={cn(
        "absolute flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap",
        "transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0"
      )}
      style={{
        left: x,
        top: y,
        backgroundColor: color,
        color: getContrastColor(color),
        transform: "translateY(-100%)",
        zIndex: 100,
      }}
    >
      {isAi && <AiIcon />}
      <span>{name}</span>
      {status === "typing" && <TypingIndicator />}
    </div>
  );
}

function AiIcon() {
  return (
    <svg
      className="w-3 h-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3" />
    </svg>
  );
}

function TypingIndicator() {
  return (
    <span className="inline-flex gap-0.5 ml-0.5">
      <span
        className="w-1 h-1 bg-current rounded-full animate-bounce"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="w-1 h-1 bg-current rounded-full animate-bounce"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="w-1 h-1 bg-current rounded-full animate-bounce"
        style={{ animationDelay: "300ms" }}
      />
    </span>
  );
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Get contrasting text color for a background
 */
function getContrastColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace("#", "");

  // Parse RGB
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? "#000000" : "#ffffff";
}

/**
 * Calculate fade opacity based on last activity
 */
function getFadeOpacity(lastActivity: number, now: number, hideAfterMs: number): number {
  const age = now - lastActivity;
  const fadeStart = hideAfterMs * 0.8; // Start fading at 80% of hide time

  if (age < fadeStart) return 1;
  if (age >= hideAfterMs) return 0;

  return 1 - (age - fadeStart) / (hideAfterMs - fadeStart);
}

// =============================================================================
// Hook for Monaco Editor Integration
// =============================================================================

export interface UseRemoteCursorsOptions {
  /** Monaco editor instance */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any;
  /** List of collaborators */
  collaborators: CollaboratorInfo[];
  /** Current file path */
  currentFile: string;
}

/**
 * Hook to integrate remote cursors with Monaco editor
 */
export function useRemoteCursorsMonaco({
  editor,
  collaborators,
  currentFile,
}: UseRemoteCursorsOptions) {
  const [decorations, setDecorations] = useState<string[]>([]);

  useEffect(() => {
    if (!editor) return;

    const remoteCursors = collaborators.filter(
      (c) => !c.isLocal && c.currentFile === currentFile && c.cursor
    );

    // Create decorations for cursors and selections
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newDecorations: any[] = [];

    for (const collab of remoteCursors) {
      if (collab.cursor) {
        // Cursor decoration
        newDecorations.push({
          range: {
            startLineNumber: collab.cursor.line,
            startColumn: collab.cursor.column,
            endLineNumber: collab.cursor.line,
            endColumn: collab.cursor.column + 1,
          },
          options: {
            className: `remote-cursor-${collab.clientId}`,
            beforeContentClassName: `remote-cursor-line-${collab.clientId}`,
            hoverMessage: { value: `**${collab.name}**${collab.isAi ? " (AI)" : ""}` },
          },
        });
      }

      if (collab.selection) {
        // Selection decoration
        newDecorations.push({
          range: {
            startLineNumber: collab.selection.start.line,
            startColumn: collab.selection.start.column,
            endLineNumber: collab.selection.end.line,
            endColumn: collab.selection.end.column,
          },
          options: {
            className: `remote-selection-${collab.clientId}`,
            hoverMessage: { value: `Selected by **${collab.name}**` },
          },
        });
      }

      // Inject dynamic styles
      injectCursorStyles(collab.clientId, collab.color, collab.name);
    }

    // Apply decorations
    const newIds = editor.deltaDecorations(decorations, newDecorations);
    setDecorations(newIds);

    // Cleanup function - clear decorations
    return () => {
      if (editor && !editor.isDisposed?.()) {
        editor.deltaDecorations(newIds, []);
      }
    };
  }, [editor, collaborators, currentFile, decorations]);

  return { decorations };
}

/**
 * Inject dynamic cursor styles into the document
 */
function injectCursorStyles(clientId: number, color: string, name: string) {
  const styleId = `remote-cursor-style-${clientId}`;

  // Check if already injected
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    .remote-cursor-${clientId} {
      background-color: ${color}20;
    }
    .remote-cursor-line-${clientId}::before {
      content: "";
      position: absolute;
      width: 2px;
      height: 18px;
      background-color: ${color};
      box-shadow: 0 0 4px ${color};
      z-index: 100;
    }
    .remote-cursor-line-${clientId}::after {
      content: "${name}";
      position: absolute;
      top: -18px;
      left: 0;
      background-color: ${color};
      color: ${getContrastColor(color)};
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 500;
      white-space: nowrap;
      z-index: 101;
    }
    .remote-selection-${clientId} {
      background-color: ${color}30;
    }
  `;

  document.head.appendChild(style);
}

// =============================================================================
// Export
// =============================================================================

export default RemoteCursors;
