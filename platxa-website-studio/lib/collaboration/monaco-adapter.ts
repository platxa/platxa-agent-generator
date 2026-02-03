/**
 * Monaco Editor Cursor Adapter
 *
 * Renders remote collaborator cursors and selections in Monaco Editor.
 * Integrates with the collaboration provider to show real-time presence.
 */

import type { editor, IDisposable } from "monaco-editor";
import type { CollaboratorInfo } from "./provider";

// =============================================================================
// Types
// =============================================================================

export interface RemoteCursor {
  /** Collaborator info */
  collaborator: CollaboratorInfo;
  /** Monaco decoration IDs */
  decorationIds: string[];
  /** Widget element for cursor label */
  widget: editor.IContentWidget | null;
}

export interface MonacoCursorAdapterConfig {
  /** Show cursor labels */
  showLabels: boolean;
  /** Label display duration (0 = always show) */
  labelDuration: number;
  /** Cursor animation style */
  cursorAnimation: "none" | "blink" | "pulse";
  /** Selection opacity (0-1) */
  selectionOpacity: number;
}

const DEFAULT_CONFIG: MonacoCursorAdapterConfig = {
  showLabels: true,
  labelDuration: 3000,
  cursorAnimation: "pulse",
  selectionOpacity: 0.3,
};

// =============================================================================
// Monaco Cursor Adapter
// =============================================================================

export class MonacoCursorAdapter {
  private editor: editor.IStandaloneCodeEditor;
  private monaco: typeof import("monaco-editor");
  private config: MonacoCursorAdapterConfig;
  private remoteCursors: Map<number, RemoteCursor> = new Map();
  private styleElement: HTMLStyleElement | null = null;
  private disposables: IDisposable[] = [];

  constructor(
    editorInstance: editor.IStandaloneCodeEditor,
    monacoModule: typeof import("monaco-editor"),
    config: Partial<MonacoCursorAdapterConfig> = {}
  ) {
    this.editor = editorInstance;
    this.monaco = monacoModule;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.injectStyles();
  }

  // ---------------------------------------------------------------------------
  // Cursor Management
  // ---------------------------------------------------------------------------

  /**
   * Updates a remote collaborator's cursor position.
   */
  updateCursor(collaborator: CollaboratorInfo): void {
    const { clientId, cursor, color, name } = collaborator;

    if (!cursor) {
      this.removeCursor(clientId);
      return;
    }

    let remoteCursor = this.remoteCursors.get(clientId);

    if (!remoteCursor) {
      remoteCursor = {
        collaborator,
        decorationIds: [],
        widget: null,
      };
      this.remoteCursors.set(clientId, remoteCursor);
    }

    // Update collaborator info
    remoteCursor.collaborator = collaborator;

    // Create cursor decoration
    const cursorDecoration: editor.IModelDeltaDecoration = {
      range: new this.monaco.Range(cursor.line, cursor.column, cursor.line, cursor.column),
      options: {
        className: `remote-cursor remote-cursor-${clientId}`,
        stickiness: this.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        beforeContentClassName: `remote-cursor-line remote-cursor-line-${clientId}`,
      },
    };

    // Apply decoration
    const model = this.editor.getModel();
    if (model) {
      remoteCursor.decorationIds = model.deltaDecorations(
        remoteCursor.decorationIds,
        [cursorDecoration]
      );
    }

    // Update or create label widget
    if (this.config.showLabels) {
      this.updateLabelWidget(clientId, cursor.line, cursor.column, name, color);
    }

    // Update dynamic styles for this cursor
    this.updateCursorStyle(clientId, color);
  }

  /**
   * Updates a remote collaborator's selection.
   */
  updateSelection(collaborator: CollaboratorInfo): void {
    const { clientId, selection, color } = collaborator;

    if (!selection) {
      return;
    }

    let remoteCursor = this.remoteCursors.get(clientId);

    if (!remoteCursor) {
      remoteCursor = {
        collaborator,
        decorationIds: [],
        widget: null,
      };
      this.remoteCursors.set(clientId, remoteCursor);
    }

    remoteCursor.collaborator = collaborator;

    // Create selection decoration
    const selectionDecoration: editor.IModelDeltaDecoration = {
      range: new this.monaco.Range(
        selection.start.line,
        selection.start.column,
        selection.end.line,
        selection.end.column
      ),
      options: {
        className: `remote-selection remote-selection-${clientId}`,
        stickiness: this.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
      },
    };

    // Apply decoration
    const model = this.editor.getModel();
    if (model) {
      remoteCursor.decorationIds = model.deltaDecorations(
        remoteCursor.decorationIds,
        [selectionDecoration]
      );
    }

    // Update selection style
    this.updateSelectionStyle(clientId, color);
  }

  /**
   * Removes a remote cursor.
   */
  removeCursor(clientId: number): void {
    const remoteCursor = this.remoteCursors.get(clientId);
    if (!remoteCursor) return;

    // Remove decorations
    const model = this.editor.getModel();
    if (model && remoteCursor.decorationIds.length > 0) {
      model.deltaDecorations(remoteCursor.decorationIds, []);
    }

    // Remove widget
    if (remoteCursor.widget) {
      this.editor.removeContentWidget(remoteCursor.widget);
    }

    this.remoteCursors.delete(clientId);
  }

  /**
   * Updates all remote cursors from collaborator list.
   */
  updateFromCollaborators(collaborators: CollaboratorInfo[], currentFilePath: string): void {
    const activeClientIds = new Set<number>();

    for (const collaborator of collaborators) {
      // Skip local user
      if (collaborator.isLocal) continue;

      // Only show cursors for users in the same file
      if (collaborator.currentFile !== currentFilePath) {
        this.removeCursor(collaborator.clientId);
        continue;
      }

      activeClientIds.add(collaborator.clientId);

      if (collaborator.cursor) {
        this.updateCursor(collaborator);
      }

      if (collaborator.selection) {
        this.updateSelection(collaborator);
      }
    }

    // Remove cursors for users no longer present
    for (const clientId of this.remoteCursors.keys()) {
      if (!activeClientIds.has(clientId)) {
        this.removeCursor(clientId);
      }
    }
  }

  /**
   * Clears all remote cursors.
   */
  clearAll(): void {
    for (const clientId of this.remoteCursors.keys()) {
      this.removeCursor(clientId);
    }
    this.remoteCursors.clear();
  }

  // ---------------------------------------------------------------------------
  // Label Widget
  // ---------------------------------------------------------------------------

  private updateLabelWidget(
    clientId: number,
    line: number,
    column: number,
    name: string,
    color: string
  ): void {
    const remoteCursor = this.remoteCursors.get(clientId);
    if (!remoteCursor) return;

    // Remove existing widget
    if (remoteCursor.widget) {
      this.editor.removeContentWidget(remoteCursor.widget);
    }

    // Create new widget
    const widgetId = `cursor-label-${clientId}`;
    const widget: editor.IContentWidget = {
      getId: () => widgetId,
      getDomNode: () => {
        const node = document.createElement("div");
        node.className = "remote-cursor-label";
        node.style.backgroundColor = color;
        node.style.color = "#ffffff";
        node.style.padding = "2px 6px";
        node.style.borderRadius = "3px";
        node.style.fontSize = "11px";
        node.style.fontWeight = "500";
        node.style.whiteSpace = "nowrap";
        node.style.pointerEvents = "none";
        node.style.zIndex = "1000";
        node.style.marginTop = "-20px";
        node.style.boxShadow = "0 1px 3px rgba(0,0,0,0.2)";
        node.textContent = name;

        // Auto-hide label after duration
        if (this.config.labelDuration > 0) {
          setTimeout(() => {
            node.style.opacity = "0";
            node.style.transition = "opacity 0.3s";
          }, this.config.labelDuration);
        }

        return node;
      },
      getPosition: () => ({
        position: { lineNumber: line, column },
        preference: [this.monaco.editor.ContentWidgetPositionPreference.ABOVE],
      }),
    };

    this.editor.addContentWidget(widget);
    remoteCursor.widget = widget;
  }

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  private injectStyles(): void {
    if (this.styleElement) return;

    this.styleElement = document.createElement("style");
    this.styleElement.id = "monaco-collaboration-styles";
    this.styleElement.textContent = `
      .remote-cursor-line {
        border-left: 2px solid;
        margin-left: -1px;
      }

      .remote-cursor-label {
        animation: fadeIn 0.2s ease-in;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(5px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes cursorBlink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0.3; }
      }

      @keyframes cursorPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
    `;

    document.head.appendChild(this.styleElement);
  }

  private updateCursorStyle(clientId: number, color: string): void {
    const styleId = `cursor-style-${clientId}`;
    let styleEl = document.getElementById(styleId) as HTMLStyleElement;

    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    const animation =
      this.config.cursorAnimation === "blink"
        ? "animation: cursorBlink 1s infinite;"
        : this.config.cursorAnimation === "pulse"
          ? "animation: cursorPulse 1.5s infinite;"
          : "";

    styleEl.textContent = `
      .remote-cursor-line-${clientId} {
        border-left-color: ${color} !important;
        ${animation}
      }
    `;
  }

  private updateSelectionStyle(clientId: number, color: string): void {
    const styleId = `selection-style-${clientId}`;
    let styleEl = document.getElementById(styleId) as HTMLStyleElement;

    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    // Convert hex to rgba for opacity
    const rgba = hexToRgba(color, this.config.selectionOpacity);

    styleEl.textContent = `
      .remote-selection-${clientId} {
        background-color: ${rgba} !important;
      }
    `;
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Disposes the adapter and cleans up resources.
   */
  dispose(): void {
    this.clearAll();

    // Remove global styles
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }

    // Remove per-cursor styles
    for (const clientId of this.remoteCursors.keys()) {
      document.getElementById(`cursor-style-${clientId}`)?.remove();
      document.getElementById(`selection-style-${clientId}`)?.remove();
    }

    // Dispose Monaco disposables
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Converts hex color to rgba.
 */
function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(0, 0, 0, ${alpha})`;

  return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`;
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Creates a Monaco cursor adapter.
 */
export function createMonacoCursorAdapter(
  editor: editor.IStandaloneCodeEditor,
  monaco: typeof import("monaco-editor"),
  config?: Partial<MonacoCursorAdapterConfig>
): MonacoCursorAdapter {
  return new MonacoCursorAdapter(editor, monaco, config);
}
