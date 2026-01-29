/**
 * AI Awareness Cursor
 *
 * Shows agent's current edit position in editor:
 * - Distinct AI cursor color
 * - Real-time position updates
 * - Multiple editor support (Monaco, CodeMirror, Ace)
 */

// =============================================================================
// Types
// =============================================================================

/** Cursor position in editor */
export interface CursorPosition {
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
}

/** Cursor range for selections */
export interface CursorRange {
  /** Start position */
  start: CursorPosition;
  /** End position */
  end: CursorPosition;
}

/** AI cursor state */
export interface AICursorState {
  /** Current position */
  position: CursorPosition;
  /** Selection range (if any) */
  selection?: CursorRange;
  /** File being edited */
  filePath: string;
  /** Whether cursor is visible */
  visible: boolean;
  /** Last update timestamp */
  lastUpdate: number;
  /** Agent ID (for multi-agent scenarios) */
  agentId?: string;
  /** Agent label for display */
  agentLabel?: string;
}

/** Cursor decoration style */
export interface CursorStyle {
  /** Cursor color (CSS color) */
  color: string;
  /** Background color for line highlight */
  backgroundColor: string;
  /** Border color for range highlight */
  borderColor: string;
  /** Cursor width in pixels */
  width: number;
  /** Cursor opacity (0-1) */
  opacity: number;
  /** Animation type */
  animation: "blink" | "pulse" | "solid" | "none";
  /** Label style */
  label: {
    /** Show agent label */
    show: boolean;
    /** Label font size */
    fontSize: number;
    /** Label background */
    background: string;
    /** Label text color */
    textColor: string;
  };
}

/** Editor type */
export type EditorType = "monaco" | "codemirror" | "ace" | "custom";

/** Cursor decoration interface for editor integration */
export interface CursorDecoration {
  /** Decoration ID */
  id: string;
  /** Position */
  position: CursorPosition;
  /** Style */
  style: CursorStyle;
  /** Whether decoration is active */
  active: boolean;
}

/** Editor cursor adapter interface */
export interface CursorEditorAdapter {
  /** Editor type */
  type: EditorType;
  /** Adds cursor decoration */
  addCursor(cursor: AICursorState, style: CursorStyle): CursorDecoration;
  /** Updates cursor position */
  updateCursor(decorationId: string, position: CursorPosition): boolean;
  /** Updates cursor selection */
  updateSelection(decorationId: string, range: CursorRange): boolean;
  /** Removes cursor decoration */
  removeCursor(decorationId: string): boolean;
  /** Sets cursor visibility */
  setCursorVisible(decorationId: string, visible: boolean): boolean;
  /** Gets all cursor decorations */
  getCursors(): CursorDecoration[];
  /** Clears all cursor decorations */
  clearCursors(): void;
  /** Checks if adapter is ready */
  isReady(): boolean;
}

/** Cursor event types */
export type CursorEventType =
  | "cursor:move"
  | "cursor:show"
  | "cursor:hide"
  | "cursor:select"
  | "cursor:clear";

/** Cursor event */
export interface CursorEvent {
  /** Event type */
  type: CursorEventType;
  /** Cursor state */
  cursor: AICursorState;
  /** Timestamp */
  timestamp: number;
}

/** Cursor event callback */
export type CursorEventCallback = (event: CursorEvent) => void;

/** Cursor manager configuration */
export interface AICursorConfig {
  /** Default cursor style */
  defaultStyle: CursorStyle;
  /** Auto-show cursor on move */
  autoShow: boolean;
  /** Auto-hide after inactivity (ms, 0 = never) */
  autoHideDelay: number;
  /** Smooth position transitions */
  smoothTransitions: boolean;
  /** Default agent ID */
  defaultAgentId: string;
  /** Default agent label */
  defaultAgentLabel: string;
}

// =============================================================================
// Default Configuration
// =============================================================================

/** Default AI cursor style - distinct purple/violet color */
const DEFAULT_CURSOR_STYLE: CursorStyle = {
  color: "#9333ea", // Purple/violet - distinct from typical blue user cursor
  backgroundColor: "rgba(147, 51, 234, 0.1)",
  borderColor: "rgba(147, 51, 234, 0.3)",
  width: 2,
  opacity: 1,
  animation: "pulse",
  label: {
    show: true,
    fontSize: 10,
    background: "#9333ea",
    textColor: "#ffffff",
  },
};

const DEFAULT_CONFIG: AICursorConfig = {
  defaultStyle: DEFAULT_CURSOR_STYLE,
  autoShow: true,
  autoHideDelay: 0,
  smoothTransitions: true,
  defaultAgentId: "ai-agent",
  defaultAgentLabel: "AI",
};

// =============================================================================
// Position Utilities
// =============================================================================

/**
 * Creates a cursor position.
 */
export function createPosition(line: number, column: number): CursorPosition {
  return { line: Math.max(1, line), column: Math.max(1, column) };
}

/**
 * Creates a cursor range.
 */
export function createRange(
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number
): CursorRange {
  return {
    start: createPosition(startLine, startColumn),
    end: createPosition(endLine, endColumn),
  };
}

/**
 * Checks if two positions are equal.
 */
export function positionsEqual(a: CursorPosition, b: CursorPosition): boolean {
  return a.line === b.line && a.column === b.column;
}

/**
 * Checks if two ranges are equal.
 */
export function rangesEqual(a: CursorRange, b: CursorRange): boolean {
  return positionsEqual(a.start, b.start) && positionsEqual(a.end, b.end);
}

/**
 * Checks if a position is within a range.
 */
export function positionInRange(pos: CursorPosition, range: CursorRange): boolean {
  if (pos.line < range.start.line || pos.line > range.end.line) {
    return false;
  }
  if (pos.line === range.start.line && pos.column < range.start.column) {
    return false;
  }
  if (pos.line === range.end.line && pos.column > range.end.column) {
    return false;
  }
  return true;
}

/**
 * Calculates distance between two positions (in characters, approximate).
 */
export function positionDistance(a: CursorPosition, b: CursorPosition): number {
  const lineDiff = Math.abs(a.line - b.line);
  const colDiff = Math.abs(a.column - b.column);
  return lineDiff * 80 + colDiff; // Assume ~80 chars per line
}

/**
 * Clones a cursor position.
 */
export function clonePosition(pos: CursorPosition): CursorPosition {
  return { line: pos.line, column: pos.column };
}

/**
 * Clones a cursor range.
 */
export function cloneRange(range: CursorRange): CursorRange {
  return {
    start: clonePosition(range.start),
    end: clonePosition(range.end),
  };
}

// =============================================================================
// Mock Editor Adapter
// =============================================================================

/**
 * Creates a mock cursor editor adapter for testing.
 */
export function createMockCursorAdapter(
  options: {
    type?: EditorType;
    isReady?: boolean;
    failAdd?: boolean;
    failUpdate?: boolean;
  } = {}
): CursorEditorAdapter {
  const cursors = new Map<string, CursorDecoration>();
  let idCounter = 0;

  return {
    type: options.type ?? "monaco",

    addCursor(cursor: AICursorState, style: CursorStyle): CursorDecoration {
      if (options.failAdd) {
        return {
          id: "",
          position: cursor.position,
          style,
          active: false,
        };
      }

      const id = `ai-cursor-${++idCounter}`;
      const decoration: CursorDecoration = {
        id,
        position: clonePosition(cursor.position),
        style,
        active: true,
      };
      cursors.set(id, decoration);
      return decoration;
    },

    updateCursor(decorationId: string, position: CursorPosition): boolean {
      if (options.failUpdate) return false;
      const cursor = cursors.get(decorationId);
      if (!cursor) return false;
      cursor.position = clonePosition(position);
      return true;
    },

    updateSelection(decorationId: string, range: CursorRange): boolean {
      if (options.failUpdate) return false;
      const cursor = cursors.get(decorationId);
      if (!cursor) return false;
      cursor.position = clonePosition(range.start);
      return true;
    },

    removeCursor(decorationId: string): boolean {
      return cursors.delete(decorationId);
    },

    setCursorVisible(decorationId: string, visible: boolean): boolean {
      const cursor = cursors.get(decorationId);
      if (!cursor) return false;
      cursor.active = visible;
      return true;
    },

    getCursors(): CursorDecoration[] {
      return Array.from(cursors.values());
    },

    clearCursors(): void {
      cursors.clear();
    },

    isReady(): boolean {
      return options.isReady ?? true;
    },
  };
}

// =============================================================================
// AICursorManager Class
// =============================================================================

/**
 * Manages AI awareness cursor in editor.
 */
export class AICursorManager {
  private config: AICursorConfig;
  private adapter: CursorEditorAdapter | null = null;
  private state: AICursorState | null = null;
  private decoration: CursorDecoration | null = null;
  private callbacks: CursorEventCallback[] = [];
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(config: Partial<AICursorConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      defaultStyle: {
        ...DEFAULT_CURSOR_STYLE,
        ...config.defaultStyle,
        label: {
          ...DEFAULT_CURSOR_STYLE.label,
          ...config.defaultStyle?.label,
        },
      },
    };
  }

  /**
   * Sets the editor adapter.
   */
  setAdapter(adapter: CursorEditorAdapter): void {
    // Clean up existing cursor
    if (this.decoration && this.adapter) {
      this.adapter.removeCursor(this.decoration.id);
    }
    this.adapter = adapter;
    this.decoration = null;

    // Re-create cursor if state exists
    if (this.state && this.state.visible) {
      this.createDecoration();
    }
  }

  /**
   * Gets the current adapter.
   */
  getAdapter(): CursorEditorAdapter | null {
    return this.adapter;
  }

  /**
   * Shows cursor at position.
   */
  showAt(filePath: string, line: number, column: number): void {
    const position = createPosition(line, column);
    this.updateState({
      position,
      filePath,
      visible: true,
      lastUpdate: Date.now(),
      agentId: this.config.defaultAgentId,
      agentLabel: this.config.defaultAgentLabel,
    });

    this.emit({ type: "cursor:show", cursor: this.snapshotState(), timestamp: Date.now() });
    this.scheduleAutoHide();
  }

  /**
   * Moves cursor to new position.
   */
  moveTo(line: number, column: number): void {
    if (!this.state) return;

    const newPosition = createPosition(line, column);
    if (positionsEqual(this.state.position, newPosition)) return;

    this.state.position = newPosition;
    this.state.lastUpdate = Date.now();
    this.state.selection = undefined;

    if (this.decoration && this.adapter) {
      this.adapter.updateCursor(this.decoration.id, newPosition);
    }

    if (this.config.autoShow && !this.state.visible) {
      this.show();
    }

    this.emit({ type: "cursor:move", cursor: this.snapshotState(), timestamp: Date.now() });
    this.scheduleAutoHide();
  }

  /**
   * Selects a range.
   */
  selectRange(
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number
  ): void {
    if (!this.state) return;

    const range = createRange(startLine, startColumn, endLine, endColumn);
    this.state.selection = range;
    this.state.position = clonePosition(range.end);
    this.state.lastUpdate = Date.now();

    if (this.decoration && this.adapter) {
      this.adapter.updateSelection(this.decoration.id, range);
    }

    this.emit({ type: "cursor:select", cursor: this.snapshotState(), timestamp: Date.now() });
    this.scheduleAutoHide();
  }

  /**
   * Shows the cursor.
   */
  show(): void {
    if (!this.state) return;

    this.state.visible = true;
    this.state.lastUpdate = Date.now();

    if (!this.decoration) {
      this.createDecoration();
    } else if (this.adapter) {
      this.adapter.setCursorVisible(this.decoration.id, true);
    }

    this.emit({ type: "cursor:show", cursor: this.snapshotState(), timestamp: Date.now() });
    this.scheduleAutoHide();
  }

  /**
   * Hides the cursor.
   */
  hide(): void {
    if (!this.state) return;

    this.state.visible = false;
    this.state.lastUpdate = Date.now();

    if (this.decoration && this.adapter) {
      this.adapter.setCursorVisible(this.decoration.id, false);
    }

    this.clearHideTimeout();
    this.emit({ type: "cursor:hide", cursor: this.snapshotState(), timestamp: Date.now() });
  }

  /**
   * Clears the cursor.
   */
  clear(): void {
    if (this.decoration && this.adapter) {
      this.adapter.removeCursor(this.decoration.id);
    }

    const previousState = this.state;
    this.decoration = null;
    this.state = null;
    this.clearHideTimeout();

    if (previousState) {
      this.emit({
        type: "cursor:clear",
        cursor: { ...previousState, visible: false },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Gets current cursor state.
   */
  getState(): AICursorState | null {
    return this.state ? this.snapshotState() : null;
  }

  /**
   * Gets current position.
   */
  getPosition(): CursorPosition | null {
    return this.state ? clonePosition(this.state.position) : null;
  }

  /**
   * Gets current selection.
   */
  getSelection(): CursorRange | null {
    return this.state?.selection ? cloneRange(this.state.selection) : null;
  }

  /**
   * Checks if cursor is visible.
   */
  isVisible(): boolean {
    return this.state?.visible ?? false;
  }

  /**
   * Gets current file path.
   */
  getFilePath(): string | null {
    return this.state?.filePath ?? null;
  }

  /**
   * Registers event callback.
   */
  onEvent(callback: CursorEventCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Removes event callback.
   */
  offEvent(callback: CursorEventCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Updates cursor style.
   */
  updateStyle(style: Partial<CursorStyle>): void {
    this.config.defaultStyle = {
      ...this.config.defaultStyle,
      ...style,
      label: {
        ...this.config.defaultStyle.label,
        ...style.label,
      },
    };

    // Re-create decoration with new style
    if (this.state && this.adapter) {
      if (this.decoration) {
        this.adapter.removeCursor(this.decoration.id);
      }
      this.createDecoration();
    }
  }

  /**
   * Gets current style.
   */
  getStyle(): CursorStyle {
    return { ...this.config.defaultStyle };
  }

  /**
   * Updates configuration.
   */
  updateConfig(config: Partial<AICursorConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      defaultStyle: config.defaultStyle
        ? {
            ...this.config.defaultStyle,
            ...config.defaultStyle,
            label: {
              ...this.config.defaultStyle.label,
              ...config.defaultStyle.label,
            },
          }
        : this.config.defaultStyle,
    };
  }

  /**
   * Gets current configuration.
   */
  getConfig(): AICursorConfig {
    return { ...this.config };
  }

  /**
   * Gets decoration info.
   */
  getDecoration(): CursorDecoration | null {
    return this.decoration;
  }

  // Private methods

  private updateState(state: AICursorState): void {
    this.state = state;

    if (state.visible && this.adapter) {
      if (!this.decoration) {
        this.createDecoration();
      } else {
        this.adapter.updateCursor(this.decoration.id, state.position);
      }
    }
  }

  private createDecoration(): void {
    if (!this.adapter || !this.state) return;

    this.decoration = this.adapter.addCursor(this.state, this.config.defaultStyle);
  }

  private snapshotState(): AICursorState {
    if (!this.state) {
      throw new Error("No cursor state");
    }
    return {
      position: clonePosition(this.state.position),
      selection: this.state.selection ? cloneRange(this.state.selection) : undefined,
      filePath: this.state.filePath,
      visible: this.state.visible,
      lastUpdate: this.state.lastUpdate,
      agentId: this.state.agentId,
      agentLabel: this.state.agentLabel,
    };
  }

  private emit(event: CursorEvent): void {
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch {
        // Ignore callback errors
      }
    }
  }

  private scheduleAutoHide(): void {
    this.clearHideTimeout();

    if (this.config.autoHideDelay > 0) {
      this.hideTimeout = setTimeout(() => {
        this.hide();
      }, this.config.autoHideDelay);
    }
  }

  private clearHideTimeout(): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates an AICursorManager instance.
 */
export function createAICursorManager(
  config?: Partial<AICursorConfig>
): AICursorManager {
  return new AICursorManager(config);
}

/**
 * Creates a cursor manager with an adapter.
 */
export function createAICursorManagerWithAdapter(
  adapter: CursorEditorAdapter,
  config?: Partial<AICursorConfig>
): AICursorManager {
  const manager = new AICursorManager(config);
  manager.setAdapter(adapter);
  return manager;
}

// =============================================================================
// CSS Generation
// =============================================================================

/**
 * Generates CSS for AI cursor styling.
 */
export function generateCursorCSS(style: CursorStyle): string {
  const animations = {
    blink: `
      @keyframes ai-cursor-blink {
        0%, 50% { opacity: ${style.opacity}; }
        51%, 100% { opacity: 0.3; }
      }
    `,
    pulse: `
      @keyframes ai-cursor-pulse {
        0%, 100% { transform: scale(1); opacity: ${style.opacity}; }
        50% { transform: scale(1.1); opacity: ${style.opacity * 0.8}; }
      }
    `,
    solid: "",
    none: "",
  };

  const animationProperty =
    style.animation === "blink"
      ? "animation: ai-cursor-blink 1s infinite;"
      : style.animation === "pulse"
        ? "animation: ai-cursor-pulse 2s infinite;"
        : "";

  return `
    ${animations[style.animation] || ""}

    .ai-cursor {
      position: absolute;
      width: ${style.width}px;
      background-color: ${style.color};
      opacity: ${style.opacity};
      ${animationProperty}
      pointer-events: none;
      z-index: 1000;
    }

    .ai-cursor-line {
      background-color: ${style.backgroundColor};
    }

    .ai-cursor-selection {
      background-color: ${style.backgroundColor};
      border: 1px solid ${style.borderColor};
    }

    .ai-cursor-label {
      position: absolute;
      top: -18px;
      left: 0;
      font-size: ${style.label.fontSize}px;
      background-color: ${style.label.background};
      color: ${style.label.textColor};
      padding: 2px 4px;
      border-radius: 2px;
      white-space: nowrap;
      pointer-events: none;
    }
  `.trim();
}

/**
 * Gets default AI cursor color.
 */
export function getDefaultAICursorColor(): string {
  return DEFAULT_CURSOR_STYLE.color;
}

/**
 * Creates a custom cursor style.
 */
export function createCursorStyle(overrides: Partial<CursorStyle>): CursorStyle {
  return {
    ...DEFAULT_CURSOR_STYLE,
    ...overrides,
    label: {
      ...DEFAULT_CURSOR_STYLE.label,
      ...overrides.label,
    },
  };
}
