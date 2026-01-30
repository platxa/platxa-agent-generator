/**
 * ToolIndicator — Current tool indicator showing active operation.
 *
 * Feature #97: Add current tool indicator showing active operation
 * Verification: Badge shows current tool name with spinning icon
 *
 * Provides state management and UI configuration for displaying
 * the currently active tool/operation with animated indicators.
 *
 * @module lib/preview/tool-indicator
 */

// =============================================================================
// Types
// =============================================================================

/** Tool operation types */
export type ToolOperation =
  | "idle"
  | "searching"
  | "reading"
  | "writing"
  | "editing"
  | "compiling"
  | "validating"
  | "previewing"
  | "generating"
  | "analyzing"
  | "fixing"
  | "deploying"
  | "testing"
  | "indexing"
  | "connecting"
  | "syncing"
  | "processing";

/** Tool category */
export type ToolCategory =
  | "file"
  | "code"
  | "preview"
  | "ai"
  | "network"
  | "system";

/** Tool definition */
export interface ToolDefinition {
  /** Tool operation type */
  operation: ToolOperation;
  /** Display label */
  label: string;
  /** Short label for compact display */
  shortLabel: string;
  /** Icon name/identifier */
  icon: string;
  /** Tool category */
  category: ToolCategory;
  /** Whether to show spinning animation */
  animated: boolean;
  /** Estimated duration hint (optional) */
  estimatedDuration?: "fast" | "medium" | "slow";
}

/** Active tool state */
export interface ActiveTool {
  /** Tool definition */
  tool: ToolDefinition;
  /** Start timestamp */
  startedAt: number;
  /** Target/context (e.g., filename, search query) */
  target?: string;
  /** Progress (0-100, optional) */
  progress?: number;
  /** Sub-operation details */
  details?: string;
}

/** Tool indicator state */
export interface ToolIndicatorState {
  /** Currently active tool (null if idle) */
  activeTool: ActiveTool | null;
  /** Tool history (recent operations) */
  history: ToolHistoryEntry[];
  /** Whether indicator is visible */
  visible: boolean;
  /** Whether indicator is minimized */
  minimized: boolean;
}

/** Tool history entry */
export interface ToolHistoryEntry {
  /** Tool operation */
  operation: ToolOperation;
  /** Target/context */
  target?: string;
  /** Start time */
  startedAt: number;
  /** End time */
  endedAt: number;
  /** Duration in ms */
  duration: number;
  /** Whether operation succeeded */
  success: boolean;
}

/** Tool indicator options */
export interface ToolIndicatorOptions {
  /** Maximum history entries (default: 10) */
  maxHistory?: number;
  /** Auto-hide delay after idle (ms, default: 2000) */
  autoHideDelay?: number;
  /** Start minimized (default: false) */
  startMinimized?: boolean;
  /** Show progress when available (default: true) */
  showProgress?: boolean;
}

/** Badge configuration for UI rendering */
export interface ToolBadgeConfig {
  /** Display label */
  label: string;
  /** Icon name */
  icon: string;
  /** Whether to animate (spin) */
  animated: boolean;
  /** Category for styling */
  category: ToolCategory;
  /** Target text (truncated if needed) */
  target?: string;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Duration since start (formatted) */
  duration: string;
  /** CSS class for styling */
  className: string;
  /** Aria label for accessibility */
  ariaLabel: string;
}

/** Callback for tool changes */
export type ToolChangeCallback = (state: ToolIndicatorState) => void;

/** Callback for tool completion */
export type ToolCompleteCallback = (entry: ToolHistoryEntry) => void;

// =============================================================================
// Constants
// =============================================================================

/** Default options */
const DEFAULT_OPTIONS: Required<ToolIndicatorOptions> = {
  maxHistory: 10,
  autoHideDelay: 2000,
  startMinimized: false,
  showProgress: true,
};

/** Tool definitions registry */
export const TOOL_DEFINITIONS: Record<ToolOperation, ToolDefinition> = {
  idle: {
    operation: "idle",
    label: "Ready",
    shortLabel: "Ready",
    icon: "check-circle",
    category: "system",
    animated: false,
  },
  searching: {
    operation: "searching",
    label: "Searching...",
    shortLabel: "Search",
    icon: "search",
    category: "file",
    animated: true,
    estimatedDuration: "fast",
  },
  reading: {
    operation: "reading",
    label: "Reading...",
    shortLabel: "Read",
    icon: "file-text",
    category: "file",
    animated: true,
    estimatedDuration: "fast",
  },
  writing: {
    operation: "writing",
    label: "Writing...",
    shortLabel: "Write",
    icon: "edit-3",
    category: "file",
    animated: true,
    estimatedDuration: "fast",
  },
  editing: {
    operation: "editing",
    label: "Editing...",
    shortLabel: "Edit",
    icon: "edit",
    category: "code",
    animated: true,
    estimatedDuration: "fast",
  },
  compiling: {
    operation: "compiling",
    label: "Compiling...",
    shortLabel: "Compile",
    icon: "package",
    category: "code",
    animated: true,
    estimatedDuration: "medium",
  },
  validating: {
    operation: "validating",
    label: "Validating...",
    shortLabel: "Validate",
    icon: "check-square",
    category: "code",
    animated: true,
    estimatedDuration: "fast",
  },
  previewing: {
    operation: "previewing",
    label: "Previewing...",
    shortLabel: "Preview",
    icon: "eye",
    category: "preview",
    animated: true,
    estimatedDuration: "fast",
  },
  generating: {
    operation: "generating",
    label: "Generating...",
    shortLabel: "Generate",
    icon: "cpu",
    category: "ai",
    animated: true,
    estimatedDuration: "slow",
  },
  analyzing: {
    operation: "analyzing",
    label: "Analyzing...",
    shortLabel: "Analyze",
    icon: "activity",
    category: "ai",
    animated: true,
    estimatedDuration: "medium",
  },
  fixing: {
    operation: "fixing",
    label: "Fixing...",
    shortLabel: "Fix",
    icon: "tool",
    category: "code",
    animated: true,
    estimatedDuration: "medium",
  },
  deploying: {
    operation: "deploying",
    label: "Deploying...",
    shortLabel: "Deploy",
    icon: "upload-cloud",
    category: "network",
    animated: true,
    estimatedDuration: "slow",
  },
  testing: {
    operation: "testing",
    label: "Testing...",
    shortLabel: "Test",
    icon: "play-circle",
    category: "code",
    animated: true,
    estimatedDuration: "medium",
  },
  indexing: {
    operation: "indexing",
    label: "Indexing...",
    shortLabel: "Index",
    icon: "database",
    category: "system",
    animated: true,
    estimatedDuration: "slow",
  },
  connecting: {
    operation: "connecting",
    label: "Connecting...",
    shortLabel: "Connect",
    icon: "link",
    category: "network",
    animated: true,
    estimatedDuration: "fast",
  },
  syncing: {
    operation: "syncing",
    label: "Syncing...",
    shortLabel: "Sync",
    icon: "refresh-cw",
    category: "network",
    animated: true,
    estimatedDuration: "medium",
  },
  processing: {
    operation: "processing",
    label: "Processing...",
    shortLabel: "Process",
    icon: "loader",
    category: "system",
    animated: true,
    estimatedDuration: "medium",
  },
};

/** Category colors for styling */
export const CATEGORY_STYLES: Record<ToolCategory, string> = {
  file: "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30",
  code: "text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30",
  preview: "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30",
  ai: "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30",
  network: "text-cyan-600 bg-cyan-100 dark:text-cyan-400 dark:bg-cyan-900/30",
  system: "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800",
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Gets tool definition by operation.
 */
export function getToolDefinition(operation: ToolOperation): ToolDefinition {
  return TOOL_DEFINITIONS[operation];
}

/**
 * Formats duration for display.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Truncates target string for display.
 */
export function truncateTarget(target: string, maxLength = 30): string {
  if (target.length <= maxLength) return target;

  // For file paths, show end with ellipsis at start
  if (target.includes("/") || target.includes("\\")) {
    return "..." + target.slice(-(maxLength - 3));
  }

  // For other strings, show start with ellipsis at end
  return target.slice(0, maxLength - 3) + "...";
}

/**
 * Gets category style class.
 */
export function getCategoryStyle(category: ToolCategory): string {
  return CATEGORY_STYLES[category];
}

// =============================================================================
// ToolIndicator Class
// =============================================================================

/**
 * ToolIndicator — Manages current tool/operation state.
 *
 * Tracks active operations and provides UI configuration for
 * displaying tool indicators with animations.
 *
 * @example
 * ```typescript
 * const indicator = new ToolIndicator();
 *
 * // Start an operation
 * indicator.start("searching", "*.ts files");
 *
 * // Update progress
 * indicator.setProgress(50);
 *
 * // Complete operation
 * indicator.complete(true);
 *
 * // Get badge config for UI
 * const badge = indicator.getBadgeConfig();
 *
 * // Listen for changes
 * indicator.onChange((state) => {
 *   updateUI(state);
 * });
 * ```
 */
export class ToolIndicator {
  private state: ToolIndicatorState;
  private options: Required<ToolIndicatorOptions>;
  private changeCallbacks = new Set<ToolChangeCallback>();
  private completeCallbacks = new Set<ToolCompleteCallback>();
  private autoHideTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(options: ToolIndicatorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.state = {
      activeTool: null,
      history: [],
      visible: true,
      minimized: this.options.startMinimized,
    };
  }

  // ---------------------------------------------------------------------------
  // Tool Operations
  // ---------------------------------------------------------------------------

  /**
   * Starts a tool operation.
   */
  start(
    operation: ToolOperation,
    target?: string,
    details?: string
  ): void {
    if (this.disposed) return;

    // Complete any existing operation first
    if (this.state.activeTool) {
      this.complete(true);
    }

    this.cancelAutoHide();

    const tool = getToolDefinition(operation);
    this.state.activeTool = {
      tool,
      startedAt: Date.now(),
      target,
      details,
    };
    this.state.visible = true;

    this.notifyChange();
  }

  /**
   * Updates the current operation's progress.
   */
  setProgress(progress: number): void {
    if (!this.state.activeTool) return;

    this.state.activeTool.progress = Math.max(0, Math.min(100, progress));
    this.notifyChange();
  }

  /**
   * Updates the current operation's details.
   */
  setDetails(details: string): void {
    if (!this.state.activeTool) return;

    this.state.activeTool.details = details;
    this.notifyChange();
  }

  /**
   * Updates the current operation's target.
   */
  setTarget(target: string): void {
    if (!this.state.activeTool) return;

    this.state.activeTool.target = target;
    this.notifyChange();
  }

  /**
   * Completes the current operation.
   */
  complete(success = true): void {
    if (!this.state.activeTool) return;

    const endedAt = Date.now();
    const { tool, startedAt, target } = this.state.activeTool;

    // Add to history
    const entry: ToolHistoryEntry = {
      operation: tool.operation,
      target,
      startedAt,
      endedAt,
      duration: endedAt - startedAt,
      success,
    };

    this.state.history.unshift(entry);
    if (this.state.history.length > this.options.maxHistory) {
      this.state.history.pop();
    }

    // Clear active tool
    this.state.activeTool = null;

    // Notify completion
    this.notifyComplete(entry);
    this.notifyChange();

    // Schedule auto-hide
    this.scheduleAutoHide();
  }

  /**
   * Cancels the current operation without adding to history.
   */
  cancel(): void {
    if (!this.state.activeTool) return;

    this.state.activeTool = null;
    this.notifyChange();
    this.scheduleAutoHide();
  }

  /**
   * Resets to idle state.
   */
  reset(): void {
    this.state.activeTool = null;
    this.state.visible = true;
    this.cancelAutoHide();
    this.notifyChange();
  }

  // ---------------------------------------------------------------------------
  // Visibility
  // ---------------------------------------------------------------------------

  /**
   * Shows the indicator.
   */
  show(): void {
    if (!this.state.visible) {
      this.state.visible = true;
      this.notifyChange();
    }
  }

  /**
   * Hides the indicator.
   */
  hide(): void {
    if (this.state.visible) {
      this.state.visible = false;
      this.notifyChange();
    }
  }

  /**
   * Toggles minimized state.
   */
  toggleMinimized(): void {
    this.state.minimized = !this.state.minimized;
    this.notifyChange();
  }

  /**
   * Sets minimized state.
   */
  setMinimized(minimized: boolean): void {
    if (this.state.minimized !== minimized) {
      this.state.minimized = minimized;
      this.notifyChange();
    }
  }

  private scheduleAutoHide(): void {
    this.cancelAutoHide();

    if (this.options.autoHideDelay > 0) {
      this.autoHideTimer = setTimeout(() => {
        if (!this.state.activeTool) {
          this.hide();
        }
      }, this.options.autoHideDelay);
    }
  }

  private cancelAutoHide(): void {
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  /**
   * Gets the current state.
   */
  getState(): ToolIndicatorState {
    return {
      ...this.state,
      history: [...this.state.history],
    };
  }

  /**
   * Gets the active tool.
   */
  getActiveTool(): ActiveTool | null {
    return this.state.activeTool;
  }

  /**
   * Checks if a tool is active.
   */
  isActive(): boolean {
    return this.state.activeTool !== null;
  }

  /**
   * Gets the current operation.
   */
  getCurrentOperation(): ToolOperation {
    return this.state.activeTool?.tool.operation ?? "idle";
  }

  /**
   * Gets the tool history.
   */
  getHistory(): ToolHistoryEntry[] {
    return [...this.state.history];
  }

  /**
   * Gets badge configuration for UI rendering.
   */
  getBadgeConfig(): ToolBadgeConfig | null {
    const { activeTool, minimized } = this.state;

    if (!activeTool) {
      // Return idle badge
      const idleTool = getToolDefinition("idle");
      return {
        label: minimized ? idleTool.shortLabel : idleTool.label,
        icon: idleTool.icon,
        animated: false,
        category: idleTool.category,
        duration: "",
        className: getCategoryStyle(idleTool.category),
        ariaLabel: "Ready",
      };
    }

    const { tool, startedAt, target, progress } = activeTool;
    const duration = Date.now() - startedAt;

    return {
      label: minimized ? tool.shortLabel : tool.label,
      icon: tool.icon,
      animated: tool.animated,
      category: tool.category,
      target: target ? truncateTarget(target, minimized ? 15 : 30) : undefined,
      progress: this.options.showProgress ? progress : undefined,
      duration: formatDuration(duration),
      className: getCategoryStyle(tool.category),
      ariaLabel: `${tool.label}${target ? ` ${target}` : ""}`,
    };
  }

  // ---------------------------------------------------------------------------
  // Event Callbacks
  // ---------------------------------------------------------------------------

  /**
   * Registers a callback for state changes.
   */
  onChange(callback: ToolChangeCallback): () => void {
    this.changeCallbacks.add(callback);
    return () => this.changeCallbacks.delete(callback);
  }

  /**
   * Registers a callback for tool completion.
   */
  onComplete(callback: ToolCompleteCallback): () => void {
    this.completeCallbacks.add(callback);
    return () => this.completeCallbacks.delete(callback);
  }

  private notifyChange(): void {
    if (this.disposed) return;

    const state = this.getState();
    for (const callback of this.changeCallbacks) {
      try {
        callback(state);
      } catch (e) {
        console.error("ToolIndicator change callback error:", e);
      }
    }
  }

  private notifyComplete(entry: ToolHistoryEntry): void {
    for (const callback of this.completeCallbacks) {
      try {
        callback(entry);
      } catch (e) {
        console.error("ToolIndicator complete callback error:", e);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Disposes the instance.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.cancelAutoHide();
    this.changeCallbacks.clear();
    this.completeCallbacks.clear();
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates a ToolIndicator instance.
 */
export function createToolIndicator(
  options?: ToolIndicatorOptions
): ToolIndicator {
  return new ToolIndicator(options);
}

// =============================================================================
// Export
// =============================================================================

export default ToolIndicator;
