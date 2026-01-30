/**
 * Message Actions for chat messages
 *
 * Feature #118: Implement message actions (copy, regenerate, edit)
 * Verification: Hover shows action buttons; copy copies text; regenerate re-runs
 */

// ============================================================================
// Types
// ============================================================================

/** Action types */
export type ActionType = "copy" | "regenerate" | "edit" | "delete" | "share" | "bookmark";

/** Action state */
export type ActionState = "idle" | "loading" | "success" | "error";

/** Message role */
export type MessageRole = "user" | "assistant" | "system";

/** Action button configuration */
export interface ActionButton {
  /** Action type */
  type: ActionType;
  /** Display label */
  label: string;
  /** Icon (emoji or icon name) */
  icon: string;
  /** Tooltip text */
  tooltip: string;
  /** Keyboard shortcut */
  shortcut?: string;
  /** Is action enabled */
  enabled: boolean;
  /** Current state */
  state: ActionState;
  /** Is visible */
  visible: boolean;
}

/** Message context for actions */
export interface MessageContext {
  /** Message ID */
  id: string;
  /** Message role */
  role: MessageRole;
  /** Message content (text) */
  content: string;
  /** Raw content (including code blocks) */
  rawContent?: string;
  /** Message index in conversation */
  index: number;
  /** Parent message ID (for threads) */
  parentId?: string;
  /** Timestamp */
  timestamp: number;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/** Action result */
export interface ActionResult {
  /** Was action successful */
  success: boolean;
  /** Action type */
  action: ActionType;
  /** Message ID */
  messageId: string;
  /** Result data (action-specific) */
  data?: unknown;
  /** Error message if failed */
  error?: string;
  /** Duration in ms */
  duration: number;
}

/** Copy options */
export interface CopyOptions {
  /** Include code blocks */
  includeCode?: boolean;
  /** Format as markdown */
  asMarkdown?: boolean;
  /** Strip formatting */
  plainText?: boolean;
}

/** Regenerate options */
export interface RegenerateOptions {
  /** Modified prompt (for editing before regenerate) */
  modifiedPrompt?: string;
  /** Temperature override */
  temperature?: number;
  /** Keep original message */
  keepOriginal?: boolean;
}

/** Edit options */
export interface EditOptions {
  /** Replace or append */
  mode: "replace" | "append";
  /** New content */
  newContent: string;
}

/** Action callback types */
export type CopyCallback = (context: MessageContext, result: ActionResult) => void;
export type RegenerateCallback = (context: MessageContext, options: RegenerateOptions) => Promise<void>;
export type EditCallback = (context: MessageContext, options: EditOptions) => Promise<void>;
export type DeleteCallback = (context: MessageContext) => Promise<boolean>;
export type ActionCallback = (context: MessageContext, action: ActionType, result: ActionResult) => void;

/** Hover state */
export interface HoverState {
  /** Message ID being hovered */
  messageId: string | null;
  /** Is actions panel visible */
  visible: boolean;
  /** Position for panel */
  position: { x: number; y: number } | null;
  /** Show timeout ID */
  showTimeoutId?: ReturnType<typeof setTimeout>;
  /** Hide timeout ID */
  hideTimeoutId?: ReturnType<typeof setTimeout>;
}

/** Message actions options */
export interface MessageActionsOptions {
  /** Actions to show for user messages */
  userActions?: ActionType[];
  /** Actions to show for assistant messages */
  assistantActions?: ActionType[];
  /** Hover delay in ms */
  hoverDelay?: number;
  /** Hide delay in ms */
  hideDelay?: number;
  /** Enable keyboard shortcuts */
  enableShortcuts?: boolean;
  /** Custom action labels */
  labels?: Partial<Record<ActionType, string>>;
  /** Custom action icons */
  icons?: Partial<Record<ActionType, string>>;
}

/** Rendered action panel */
export interface RenderedActionPanel {
  /** Panel HTML */
  html: string;
  /** Buttons */
  buttons: ActionButton[];
  /** Message ID */
  messageId: string;
  /** Is visible */
  visible: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Default action labels */
export const ACTION_LABELS: Record<ActionType, string> = {
  copy: "Copy",
  regenerate: "Regenerate",
  edit: "Edit",
  delete: "Delete",
  share: "Share",
  bookmark: "Bookmark",
};

/** Default action icons */
export const ACTION_ICONS: Record<ActionType, string> = {
  copy: "📋",
  regenerate: "🔄",
  edit: "✏️",
  delete: "🗑️",
  share: "📤",
  bookmark: "🔖",
};

/** Default action tooltips */
export const ACTION_TOOLTIPS: Record<ActionType, string> = {
  copy: "Copy message to clipboard",
  regenerate: "Regenerate response",
  edit: "Edit message",
  delete: "Delete message",
  share: "Share message",
  bookmark: "Bookmark message",
};

/** Default keyboard shortcuts */
export const ACTION_SHORTCUTS: Record<ActionType, string> = {
  copy: "Ctrl+C",
  regenerate: "Ctrl+Shift+R",
  edit: "Ctrl+E",
  delete: "Delete",
  share: "Ctrl+Shift+S",
  bookmark: "Ctrl+B",
};

/** Default user message actions */
export const DEFAULT_USER_ACTIONS: ActionType[] = ["copy", "edit", "delete"];

/** Default assistant message actions */
export const DEFAULT_ASSISTANT_ACTIONS: ActionType[] = ["copy", "regenerate", "bookmark"];

/** Default options */
const DEFAULT_OPTIONS: Required<MessageActionsOptions> = {
  userActions: DEFAULT_USER_ACTIONS,
  assistantActions: DEFAULT_ASSISTANT_ACTIONS,
  hoverDelay: 300,
  hideDelay: 200,
  enableShortcuts: true,
  labels: {},
  icons: {},
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback for older browsers
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}

/**
 * Format content for copying
 */
export function formatForCopy(content: string, options: CopyOptions = {}): string {
  let result = content;

  if (options.plainText) {
    // Strip markdown formatting
    // IMPORTANT: Process triple backticks BEFORE single backticks to prevent corruption
    result = result
      .replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang, code) => {
        return code.trim();
      })
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/^#+\s+/gm, "")
      .replace(/^\s*[-*]\s+/gm, "• ");
  }

  if (!options.includeCode) {
    // Remove code blocks
    result = result.replace(/```[\s\S]*?```/g, "[code block removed]");
  }

  return result.trim();
}

/**
 * Generate action button HTML
 */
export function generateButtonHtml(button: ActionButton): string {
  const disabled = !button.enabled || button.state === "loading" ? "disabled" : "";
  const stateClass = `action-${button.state}`;

  return `<button
    class="action-btn action-${button.type} ${stateClass}"
    data-action="${button.type}"
    title="${button.tooltip}"
    aria-label="${button.label}"
    ${disabled}
  >
    <span class="action-icon">${button.icon}</span>
    <span class="action-label">${button.label}</span>
    ${button.state === "loading" ? '<span class="action-spinner">⏳</span>' : ""}
    ${button.state === "success" ? '<span class="action-check">✓</span>' : ""}
  </button>`;
}

/**
 * Get actions for message role
 */
export function getActionsForRole(
  role: MessageRole,
  options: MessageActionsOptions
): ActionType[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  switch (role) {
    case "user":
      return opts.userActions;
    case "assistant":
      return opts.assistantActions;
    case "system":
      return ["copy"]; // System messages only have copy
    default:
      return ["copy"];
  }
}

/**
 * Create action button from type
 */
export function createActionButton(
  type: ActionType,
  options: MessageActionsOptions = {}
): ActionButton {
  const labels = { ...ACTION_LABELS, ...options.labels };
  const icons = { ...ACTION_ICONS, ...options.icons };

  return {
    type,
    label: labels[type],
    icon: icons[type],
    tooltip: ACTION_TOOLTIPS[type],
    shortcut: options.enableShortcuts !== false ? ACTION_SHORTCUTS[type] : undefined,
    enabled: true,
    state: "idle",
    visible: true,
  };
}

// ============================================================================
// MessageActions Class
// ============================================================================

/**
 * Message actions manager
 */
export class MessageActions {
  private messages: Map<string, MessageContext> = new Map();
  private buttonStates: Map<string, Map<ActionType, ActionButton>> = new Map();
  private hoverState: HoverState = {
    messageId: null,
    visible: false,
    position: null,
  };
  private options: Required<MessageActionsOptions>;
  private actionCallbacks: Set<ActionCallback> = new Set();
  private copyCallbacks: Set<CopyCallback> = new Set();
  private regenerateCallback: RegenerateCallback | null = null;
  private editCallback: EditCallback | null = null;
  private deleteCallback: DeleteCallback | null = null;
  private disposed = false;

  constructor(options: MessageActionsOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Register a message
   */
  registerMessage(context: MessageContext): void {
    if (this.disposed) {
      throw new Error("MessageActions is disposed");
    }

    this.messages.set(context.id, context);

    // Initialize button states
    const actions = getActionsForRole(context.role, this.options);
    const buttons = new Map<ActionType, ActionButton>();

    for (const action of actions) {
      buttons.set(action, createActionButton(action, this.options));
    }

    this.buttonStates.set(context.id, buttons);
  }

  /**
   * Unregister a message
   */
  unregisterMessage(messageId: string): boolean {
    const removed = this.messages.delete(messageId);
    this.buttonStates.delete(messageId);

    if (this.hoverState.messageId === messageId) {
      this.hideActions();
    }

    return removed;
  }

  /**
   * Get message context
   */
  getMessage(messageId: string): MessageContext | undefined {
    return this.messages.get(messageId);
  }

  /**
   * Get all messages
   */
  getAllMessages(): MessageContext[] {
    return Array.from(this.messages.values());
  }

  /**
   * Handle mouse enter on message
   */
  handleMouseEnter(messageId: string, position?: { x: number; y: number }): void {
    if (this.disposed) return;

    // Clear any pending hide
    if (this.hoverState.hideTimeoutId) {
      clearTimeout(this.hoverState.hideTimeoutId);
      this.hoverState.hideTimeoutId = undefined;
    }

    // Set show timeout
    this.hoverState.showTimeoutId = setTimeout(() => {
      this.showActions(messageId, position);
    }, this.options.hoverDelay);
  }

  /**
   * Handle mouse leave on message
   */
  handleMouseLeave(): void {
    if (this.disposed) return;

    // Clear any pending show
    if (this.hoverState.showTimeoutId) {
      clearTimeout(this.hoverState.showTimeoutId);
      this.hoverState.showTimeoutId = undefined;
    }

    // Set hide timeout
    this.hoverState.hideTimeoutId = setTimeout(() => {
      this.hideActions();
    }, this.options.hideDelay);
  }

  /**
   * Show actions for message
   */
  showActions(messageId: string, position?: { x: number; y: number }): void {
    if (this.disposed) return;

    this.hoverState = {
      messageId,
      visible: true,
      position: position ?? null,
    };
  }

  /**
   * Hide actions
   */
  hideActions(): void {
    this.hoverState = {
      messageId: null,
      visible: false,
      position: null,
    };
  }

  /**
   * Check if actions are visible for message
   */
  isActionsVisible(messageId: string): boolean {
    return this.hoverState.messageId === messageId && this.hoverState.visible;
  }

  /**
   * Get hover state
   */
  getHoverState(): HoverState {
    return { ...this.hoverState };
  }

  /**
   * Execute copy action
   */
  async executeCopy(
    messageId: string,
    options: CopyOptions = {}
  ): Promise<ActionResult> {
    const startTime = Date.now();
    const context = this.messages.get(messageId);

    if (!context) {
      return {
        success: false,
        action: "copy",
        messageId,
        error: "Message not found",
        duration: Date.now() - startTime,
      };
    }

    this.setButtonState(messageId, "copy", "loading");

    const content = formatForCopy(context.rawContent ?? context.content, options);
    const success = await copyToClipboard(content);

    const result: ActionResult = {
      success,
      action: "copy",
      messageId,
      data: { copiedLength: content.length },
      error: success ? undefined : "Failed to copy to clipboard",
      duration: Date.now() - startTime,
    };

    this.setButtonState(messageId, "copy", success ? "success" : "error");

    // Reset state after delay
    setTimeout(() => {
      this.setButtonState(messageId, "copy", "idle");
    }, 2000);

    // Notify callbacks
    this.notifyAction(context, "copy", result);
    for (const cb of this.copyCallbacks) {
      try {
        cb(context, result);
      } catch (err) {
        console.error("Copy callback error:", err);
      }
    }

    return result;
  }

  /**
   * Execute regenerate action
   */
  async executeRegenerate(
    messageId: string,
    options: RegenerateOptions = {}
  ): Promise<ActionResult> {
    const startTime = Date.now();
    const context = this.messages.get(messageId);

    if (!context) {
      return {
        success: false,
        action: "regenerate",
        messageId,
        error: "Message not found",
        duration: Date.now() - startTime,
      };
    }

    if (!this.regenerateCallback) {
      return {
        success: false,
        action: "regenerate",
        messageId,
        error: "No regenerate handler registered",
        duration: Date.now() - startTime,
      };
    }

    this.setButtonState(messageId, "regenerate", "loading");

    try {
      await this.regenerateCallback(context, options);

      const result: ActionResult = {
        success: true,
        action: "regenerate",
        messageId,
        duration: Date.now() - startTime,
      };

      this.setButtonState(messageId, "regenerate", "success");

      // Reset state after delay
      setTimeout(() => {
        this.setButtonState(messageId, "regenerate", "idle");
      }, 2000);

      this.notifyAction(context, "regenerate", result);
      return result;
    } catch (err) {
      const result: ActionResult = {
        success: false,
        action: "regenerate",
        messageId,
        error: err instanceof Error ? err.message : "Regenerate failed",
        duration: Date.now() - startTime,
      };

      this.setButtonState(messageId, "regenerate", "error");

      setTimeout(() => {
        this.setButtonState(messageId, "regenerate", "idle");
      }, 2000);

      this.notifyAction(context, "regenerate", result);
      return result;
    }
  }

  /**
   * Execute edit action
   */
  async executeEdit(
    messageId: string,
    options: EditOptions
  ): Promise<ActionResult> {
    const startTime = Date.now();
    const context = this.messages.get(messageId);

    if (!context) {
      return {
        success: false,
        action: "edit",
        messageId,
        error: "Message not found",
        duration: Date.now() - startTime,
      };
    }

    if (!this.editCallback) {
      return {
        success: false,
        action: "edit",
        messageId,
        error: "No edit handler registered",
        duration: Date.now() - startTime,
      };
    }

    this.setButtonState(messageId, "edit", "loading");

    try {
      await this.editCallback(context, options);

      const result: ActionResult = {
        success: true,
        action: "edit",
        messageId,
        duration: Date.now() - startTime,
      };

      this.setButtonState(messageId, "edit", "success");

      setTimeout(() => {
        this.setButtonState(messageId, "edit", "idle");
      }, 2000);

      this.notifyAction(context, "edit", result);
      return result;
    } catch (err) {
      const result: ActionResult = {
        success: false,
        action: "edit",
        messageId,
        error: err instanceof Error ? err.message : "Edit failed",
        duration: Date.now() - startTime,
      };

      this.setButtonState(messageId, "edit", "error");

      setTimeout(() => {
        this.setButtonState(messageId, "edit", "idle");
      }, 2000);

      this.notifyAction(context, "edit", result);
      return result;
    }
  }

  /**
   * Set button state
   */
  private setButtonState(
    messageId: string,
    action: ActionType,
    state: ActionState
  ): void {
    const buttons = this.buttonStates.get(messageId);
    const button = buttons?.get(action);
    if (button) {
      button.state = state;
    }
  }

  /**
   * Get button for message and action
   */
  getButton(messageId: string, action: ActionType): ActionButton | undefined {
    return this.buttonStates.get(messageId)?.get(action);
  }

  /**
   * Get all buttons for message
   */
  getButtons(messageId: string): ActionButton[] {
    const buttons = this.buttonStates.get(messageId);
    return buttons ? Array.from(buttons.values()) : [];
  }

  /**
   * Enable/disable button
   */
  setButtonEnabled(messageId: string, action: ActionType, enabled: boolean): void {
    const button = this.getButton(messageId, action);
    if (button) {
      button.enabled = enabled;
    }
  }

  /**
   * Show/hide button
   */
  setButtonVisible(messageId: string, action: ActionType, visible: boolean): void {
    const button = this.getButton(messageId, action);
    if (button) {
      button.visible = visible;
    }
  }

  /**
   * Render action panel for message
   */
  renderActionPanel(messageId: string): RenderedActionPanel | null {
    const buttons = this.getButtons(messageId).filter((b) => b.visible);

    if (buttons.length === 0) {
      return null;
    }

    const buttonsHtml = buttons.map(generateButtonHtml).join("");
    const visible = this.isActionsVisible(messageId);

    const html = `<div class="message-actions-panel ${visible ? "visible" : "hidden"}" data-message-id="${messageId}">
      <div class="actions-container">
        ${buttonsHtml}
      </div>
    </div>`;

    return {
      html,
      buttons,
      messageId,
      visible,
    };
  }

  /**
   * Set regenerate callback
   */
  onRegenerate(callback: RegenerateCallback): void {
    if (this.disposed) {
      throw new Error("MessageActions is disposed");
    }
    this.regenerateCallback = callback;
  }

  /**
   * Set edit callback
   */
  onEdit(callback: EditCallback): void {
    if (this.disposed) {
      throw new Error("MessageActions is disposed");
    }
    this.editCallback = callback;
  }

  /**
   * Set delete callback
   */
  onDelete(callback: DeleteCallback): void {
    if (this.disposed) {
      throw new Error("MessageActions is disposed");
    }
    this.deleteCallback = callback;
  }

  /**
   * Subscribe to copy events
   */
  onCopy(callback: CopyCallback): () => void {
    if (this.disposed) {
      throw new Error("MessageActions is disposed");
    }

    this.copyCallbacks.add(callback);
    return () => {
      this.copyCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to action events
   */
  onAction(callback: ActionCallback): () => void {
    if (this.disposed) {
      throw new Error("MessageActions is disposed");
    }

    this.actionCallbacks.add(callback);
    return () => {
      this.actionCallbacks.delete(callback);
    };
  }

  /**
   * Notify action callbacks
   */
  private notifyAction(
    context: MessageContext,
    action: ActionType,
    result: ActionResult
  ): void {
    for (const callback of this.actionCallbacks) {
      try {
        callback(context, action, result);
      } catch (err) {
        console.error("Action callback error:", err);
      }
    }
  }

  /**
   * Check if disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose
   */
  dispose(): void {
    if (this.disposed) return;

    // Clear timeouts
    if (this.hoverState.showTimeoutId) {
      clearTimeout(this.hoverState.showTimeoutId);
    }
    if (this.hoverState.hideTimeoutId) {
      clearTimeout(this.hoverState.hideTimeoutId);
    }

    this.disposed = true;
    this.messages.clear();
    this.buttonStates.clear();
    this.actionCallbacks.clear();
    this.copyCallbacks.clear();
    this.regenerateCallback = null;
    this.editCallback = null;
    this.deleteCallback = null;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new MessageActions instance
 */
export function createMessageActions(
  options?: MessageActionsOptions
): MessageActions {
  return new MessageActions(options);
}
