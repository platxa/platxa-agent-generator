/**
 * Error Source Navigator
 *
 * Implements error-to-source navigation:
 * - Click error → opens file in editor
 * - Highlights error line
 * - Supports multiple editor integrations
 */

// =============================================================================
// Types
// =============================================================================

/** Source location for navigation */
export interface SourceLocation {
  /** File path */
  filePath: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based, optional) */
  column?: number;
  /** End line for range highlight */
  endLine?: number;
  /** End column for range highlight */
  endColumn?: number;
}

/** Editor type for navigation */
export type EditorType =
  | "monaco"      // Monaco editor (VS Code-like)
  | "codemirror"  // CodeMirror
  | "ace"         // Ace editor
  | "textarea"    // Plain textarea
  | "custom";     // Custom editor

/** Navigation result */
export interface NavigationResult {
  /** Whether navigation succeeded */
  success: boolean;
  /** Source location navigated to */
  location: SourceLocation;
  /** Editor that handled navigation */
  editor?: EditorType;
  /** Error message if failed */
  error?: string;
  /** Whether line was highlighted */
  highlighted: boolean;
  /** Timestamp of navigation */
  timestamp: number;
}

/** Editor adapter interface */
export interface EditorAdapter {
  /** Editor type identifier */
  type: EditorType;
  /** Opens a file in the editor */
  openFile(filePath: string): Promise<boolean> | boolean;
  /** Navigates to a specific line */
  goToLine(line: number, column?: number): boolean;
  /** Highlights a line or range */
  highlightLine(line: number, endLine?: number): boolean;
  /** Highlights a range with column precision */
  highlightRange(
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number
  ): boolean;
  /** Clears all highlights */
  clearHighlights(): void;
  /** Scrolls to make line visible */
  scrollToLine(line: number): boolean;
  /** Gets current file path */
  getCurrentFile(): string | null;
  /** Checks if editor is ready */
  isReady(): boolean;
}

/** Navigation callback */
export type NavigationCallback = (result: NavigationResult) => void;

/** Navigator configuration */
export interface NavigatorConfig {
  /** Primary editor adapter */
  editor?: EditorAdapter;
  /** Fallback behavior when editor unavailable */
  fallbackBehavior: "log" | "alert" | "callback" | "none";
  /** Auto-scroll to line */
  autoScroll: boolean;
  /** Auto-highlight line */
  autoHighlight: boolean;
  /** Highlight duration in ms (0 = permanent) */
  highlightDuration: number;
  /** Navigation callbacks */
  callbacks: NavigationCallback[];
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: NavigatorConfig = {
  fallbackBehavior: "log",
  autoScroll: true,
  autoHighlight: true,
  highlightDuration: 3000,
  callbacks: [],
};

// =============================================================================
// Mock Editor Adapter (for testing)
// =============================================================================

/**
 * Creates a mock editor adapter for testing.
 */
export function createMockEditorAdapter(
  options: {
    type?: EditorType;
    currentFile?: string;
    isReady?: boolean;
    failOpen?: boolean;
    failGoTo?: boolean;
  } = {}
): EditorAdapter {
  let currentFile = options.currentFile ?? null;
  let highlightedLines: number[] = [];
  let currentLine = 1;
  let currentColumn = 1;

  return {
    type: options.type ?? "monaco",

    openFile(filePath: string): boolean {
      if (options.failOpen) return false;
      currentFile = filePath;
      return true;
    },

    goToLine(line: number, column?: number): boolean {
      if (options.failGoTo) return false;
      currentLine = line;
      currentColumn = column ?? 1;
      return true;
    },

    highlightLine(line: number, endLine?: number): boolean {
      highlightedLines = endLine
        ? Array.from({ length: endLine - line + 1 }, (_, i) => line + i)
        : [line];
      return true;
    },

    highlightRange(
      startLine: number,
      startColumn: number,
      endLine: number,
      endColumn: number
    ): boolean {
      highlightedLines = Array.from(
        { length: endLine - startLine + 1 },
        (_, i) => startLine + i
      );
      return true;
    },

    clearHighlights(): void {
      highlightedLines = [];
    },

    scrollToLine(line: number): boolean {
      return true;
    },

    getCurrentFile(): string | null {
      return currentFile;
    },

    isReady(): boolean {
      return options.isReady ?? true;
    },
  };
}

// =============================================================================
// Source Location Utilities
// =============================================================================

/**
 * Parses a location string like "file.ts:10:5" into SourceLocation.
 */
export function parseLocationString(locationStr: string): SourceLocation | null {
  // Match patterns like: file.ts:10:5 or file.ts:10 or just file.ts
  const match = locationStr.match(/^(.+?)(?::(\d+))?(?::(\d+))?$/);
  if (!match) return null;

  const [, filePath, lineStr, columnStr] = match;
  if (!filePath) return null;

  return {
    filePath,
    line: lineStr ? parseInt(lineStr, 10) : 1,
    column: columnStr ? parseInt(columnStr, 10) : undefined,
  };
}

/**
 * Formats a SourceLocation to a string.
 */
export function formatLocationString(location: SourceLocation): string {
  let result = location.filePath;
  if (location.line) {
    result += `:${location.line}`;
    if (location.column) {
      result += `:${location.column}`;
    }
  }
  return result;
}

/**
 * Creates a SourceLocation from parts.
 */
export function createSourceLocation(
  filePath: string,
  line: number,
  column?: number,
  endLine?: number,
  endColumn?: number
): SourceLocation {
  return {
    filePath,
    line,
    column,
    endLine,
    endColumn,
  };
}

/**
 * Validates a SourceLocation.
 */
export function isValidLocation(location: SourceLocation): boolean {
  return (
    typeof location.filePath === "string" &&
    location.filePath.length > 0 &&
    typeof location.line === "number" &&
    location.line >= 1 &&
    (location.column === undefined || location.column >= 1) &&
    (location.endLine === undefined || location.endLine >= location.line)
  );
}

/**
 * Compares two locations for equality.
 */
export function isSameLocation(a: SourceLocation, b: SourceLocation): boolean {
  return (
    a.filePath === b.filePath &&
    a.line === b.line &&
    a.column === b.column
  );
}

// =============================================================================
// ErrorSourceNavigator Class
// =============================================================================

/**
 * Manages error-to-source navigation.
 */
export class ErrorSourceNavigator {
  private config: NavigatorConfig;
  private navigationHistory: NavigationResult[] = [];
  private highlightTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(config: Partial<NavigatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Sets the editor adapter.
   */
  setEditor(editor: EditorAdapter): void {
    this.config.editor = editor;
  }

  /**
   * Gets the current editor adapter.
   */
  getEditor(): EditorAdapter | undefined {
    return this.config.editor;
  }

  /**
   * Adds a navigation callback.
   */
  onNavigate(callback: NavigationCallback): void {
    this.config.callbacks.push(callback);
  }

  /**
   * Navigates to a source location.
   */
  async navigateTo(location: SourceLocation): Promise<NavigationResult> {
    const result: NavigationResult = {
      success: false,
      location,
      highlighted: false,
      timestamp: Date.now(),
    };

    // Validate location
    if (!isValidLocation(location)) {
      result.error = "Invalid source location";
      this.handleFallback(result);
      this.notifyCallbacks(result);
      return result;
    }

    // Check editor availability
    const editor = this.config.editor;
    if (!editor) {
      result.error = "No editor configured";
      this.handleFallback(result);
      this.notifyCallbacks(result);
      return result;
    }

    if (!editor.isReady()) {
      result.error = "Editor not ready";
      this.handleFallback(result);
      this.notifyCallbacks(result);
      return result;
    }

    result.editor = editor.type;

    try {
      // Open file if different from current
      const currentFile = editor.getCurrentFile();
      if (currentFile !== location.filePath) {
        const opened = await editor.openFile(location.filePath);
        if (!opened) {
          result.error = `Failed to open file: ${location.filePath}`;
          this.handleFallback(result);
          this.notifyCallbacks(result);
          return result;
        }
      }

      // Navigate to line
      const navigated = editor.goToLine(location.line, location.column);
      if (!navigated) {
        result.error = `Failed to navigate to line ${location.line}`;
        this.handleFallback(result);
        this.notifyCallbacks(result);
        return result;
      }

      // Scroll to line
      if (this.config.autoScroll) {
        editor.scrollToLine(location.line);
      }

      // Highlight line
      if (this.config.autoHighlight) {
        this.clearHighlightTimeout();

        if (location.endLine && location.column && location.endColumn) {
          editor.highlightRange(
            location.line,
            location.column,
            location.endLine,
            location.endColumn
          );
        } else {
          editor.highlightLine(location.line, location.endLine);
        }
        result.highlighted = true;

        // Auto-clear highlight after duration
        if (this.config.highlightDuration > 0) {
          this.highlightTimeout = setTimeout(() => {
            editor.clearHighlights();
          }, this.config.highlightDuration);
        }
      }

      result.success = true;
    } catch (e) {
      result.error = e instanceof Error ? e.message : String(e);
      this.handleFallback(result);
    }

    // Record in history
    this.navigationHistory.push(result);

    // Notify callbacks
    this.notifyCallbacks(result);

    return result;
  }

  /**
   * Navigates to a location string.
   */
  async navigateToString(locationStr: string): Promise<NavigationResult> {
    const location = parseLocationString(locationStr);
    if (!location) {
      const result: NavigationResult = {
        success: false,
        location: { filePath: locationStr, line: 1 },
        highlighted: false,
        timestamp: Date.now(),
        error: `Invalid location string: ${locationStr}`,
      };
      this.notifyCallbacks(result);
      return result;
    }
    return this.navigateTo(location);
  }

  /**
   * Navigates to file, line, and optional column.
   */
  async navigateToPosition(
    filePath: string,
    line: number,
    column?: number
  ): Promise<NavigationResult> {
    return this.navigateTo(createSourceLocation(filePath, line, column));
  }

  /**
   * Clears current highlight.
   */
  clearHighlight(): void {
    this.clearHighlightTimeout();
    this.config.editor?.clearHighlights();
  }

  /**
   * Gets navigation history.
   */
  getHistory(): NavigationResult[] {
    return [...this.navigationHistory];
  }

  /**
   * Gets last navigation result.
   */
  getLastNavigation(): NavigationResult | undefined {
    return this.navigationHistory[this.navigationHistory.length - 1];
  }

  /**
   * Clears navigation history.
   */
  clearHistory(): void {
    this.navigationHistory = [];
  }

  /**
   * Updates configuration.
   */
  updateConfig(config: Partial<NavigatorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets current configuration.
   */
  getConfig(): NavigatorConfig {
    return { ...this.config };
  }

  // Private methods

  private clearHighlightTimeout(): void {
    if (this.highlightTimeout) {
      clearTimeout(this.highlightTimeout);
      this.highlightTimeout = null;
    }
  }

  private handleFallback(result: NavigationResult): void {
    const message = `Navigation failed: ${result.error} (${formatLocationString(result.location)})`;

    switch (this.config.fallbackBehavior) {
      case "log":
        console.warn(message);
        break;
      case "alert":
        // In browser environment
        if (typeof alert !== "undefined") {
          alert(message);
        }
        break;
      case "callback":
        // Just notify callbacks (done separately)
        break;
      case "none":
        // Do nothing
        break;
    }
  }

  private notifyCallbacks(result: NavigationResult): void {
    for (const callback of this.config.callbacks) {
      try {
        callback(result);
      } catch {
        // Ignore callback errors
      }
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates an ErrorSourceNavigator instance.
 */
export function createSourceNavigator(
  config?: Partial<NavigatorConfig>
): ErrorSourceNavigator {
  return new ErrorSourceNavigator(config);
}

/**
 * Creates a navigator with an editor adapter.
 */
export function createSourceNavigatorWithEditor(
  editor: EditorAdapter,
  config?: Partial<NavigatorConfig>
): ErrorSourceNavigator {
  const navigator = new ErrorSourceNavigator(config);
  navigator.setEditor(editor);
  return navigator;
}

// =============================================================================
// React Hook (for component integration)
// =============================================================================

/** Hook state */
export interface UseSourceNavigatorState {
  /** Navigate to a location */
  navigateTo: (location: SourceLocation) => Promise<NavigationResult>;
  /** Navigate to a location string */
  navigateToString: (locationStr: string) => Promise<NavigationResult>;
  /** Navigate to file and line */
  navigateToPosition: (filePath: string, line: number, column?: number) => Promise<NavigationResult>;
  /** Last navigation result */
  lastResult: NavigationResult | null;
  /** Clear highlight */
  clearHighlight: () => void;
  /** Set editor */
  setEditor: (editor: EditorAdapter) => void;
  /** Navigator instance */
  navigator: ErrorSourceNavigator;
}

/**
 * Creates hook state for source navigation.
 * Note: This is a factory function, not a React hook.
 * Use with useState in your component.
 */
export function createNavigatorState(
  navigator: ErrorSourceNavigator
): UseSourceNavigatorState {
  return {
    navigateTo: (location) => navigator.navigateTo(location),
    navigateToString: (str) => navigator.navigateToString(str),
    navigateToPosition: (file, line, col) => navigator.navigateToPosition(file, line, col),
    lastResult: navigator.getLastNavigation() ?? null,
    clearHighlight: () => navigator.clearHighlight(),
    setEditor: (editor) => navigator.setEditor(editor),
    navigator,
  };
}
