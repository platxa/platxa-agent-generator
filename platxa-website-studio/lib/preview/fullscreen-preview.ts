/**
 * Full-Screen Preview Mode
 *
 * Feature #123: Create full-screen preview mode
 * Verification: Button expands preview to fill window; ESC exits
 */

// ============================================================================
// Types
// ============================================================================

/** Fullscreen mode state */
export type FullscreenState = "normal" | "entering" | "fullscreen" | "exiting";

/** Fullscreen trigger method */
export type FullscreenTrigger = "button" | "keyboard" | "api" | "double-click";

/** Exit trigger method */
export type ExitTrigger = "esc" | "button" | "api" | "click-outside";

/** Fullscreen API support level */
export type FullscreenSupport = "full" | "prefixed" | "none";

/** Fullscreen enter event */
export interface FullscreenEnterEvent {
  /** Trigger that initiated fullscreen */
  trigger: FullscreenTrigger;
  /** Target element */
  targetId: string;
  /** Timestamp */
  timestamp: number;
}

/** Fullscreen exit event */
export interface FullscreenExitEvent {
  /** Trigger that initiated exit */
  trigger: ExitTrigger;
  /** Duration in fullscreen (ms) */
  duration: number;
  /** Timestamp */
  timestamp: number;
}

/** Fullscreen state change event */
export interface FullscreenStateEvent {
  /** Previous state */
  previousState: FullscreenState;
  /** New state */
  newState: FullscreenState;
  /** Is currently fullscreen */
  isFullscreen: boolean;
  /** Timestamp */
  timestamp: number;
}

/** Fullscreen button configuration */
export interface FullscreenButtonConfig {
  /** Button label when not fullscreen */
  enterLabel: string;
  /** Button label when fullscreen */
  exitLabel: string;
  /** Enter tooltip */
  enterTooltip: string;
  /** Exit tooltip */
  exitTooltip: string;
  /** Enter icon */
  enterIcon: string;
  /** Exit icon */
  exitIcon: string;
  /** Keyboard shortcut for enter */
  enterShortcut: string;
  /** Keyboard shortcut for exit */
  exitShortcut: string;
}

/** Fullscreen overlay configuration */
export interface OverlayConfig {
  /** Show close button in fullscreen */
  showCloseButton: boolean;
  /** Close button position */
  closeButtonPosition: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  /** Show escape hint */
  showEscapeHint: boolean;
  /** Escape hint duration (ms, 0 = always show) */
  escapeHintDuration: number;
  /** Background color */
  backgroundColor: string;
  /** Animation duration (ms) */
  animationDuration: number;
}

/** Fullscreen preview options */
export interface FullscreenPreviewOptions {
  /** Target element ID or selector */
  targetSelector?: string;
  /** Use native Fullscreen API if available */
  useNativeFullscreen?: boolean;
  /** Overlay configuration */
  overlay?: Partial<OverlayConfig>;
  /** Button configuration */
  button?: Partial<FullscreenButtonConfig>;
  /** Enable ESC key to exit */
  enableEscKey?: boolean;
  /** Enable keyboard shortcuts */
  enableKeyboardShortcuts?: boolean;
  /** Enable double-click to toggle */
  enableDoubleClick?: boolean;
  /** Z-index for fullscreen overlay */
  zIndex?: number;
  /** Preserve scroll position on exit */
  preserveScrollPosition?: boolean;
}

/** Enter callback */
export type EnterCallback = (event: FullscreenEnterEvent) => void;

/** Exit callback */
export type ExitCallback = (event: FullscreenExitEvent) => void;

/** State change callback */
export type StateChangeCallback = (event: FullscreenStateEvent) => void;

/** Error callback */
export type ErrorCallback = (error: Error) => void;

// ============================================================================
// Constants
// ============================================================================

/** Default button configuration */
export const DEFAULT_BUTTON_CONFIG: FullscreenButtonConfig = {
  enterLabel: "Fullscreen",
  exitLabel: "Exit Fullscreen",
  enterTooltip: "Enter fullscreen mode (F11)",
  exitTooltip: "Exit fullscreen mode (ESC)",
  enterIcon: "maximize",
  exitIcon: "minimize",
  enterShortcut: "F11",
  exitShortcut: "Escape",
};

/** Default overlay configuration */
export const DEFAULT_OVERLAY_CONFIG: OverlayConfig = {
  showCloseButton: true,
  closeButtonPosition: "top-right",
  showEscapeHint: true,
  escapeHintDuration: 3000,
  backgroundColor: "#000000",
  animationDuration: 200,
};

/** Fullscreen keyboard shortcuts */
export const FULLSCREEN_SHORTCUTS = {
  enter: ["F11", "Ctrl+Shift+F", "Cmd+Shift+F"],
  exit: ["Escape", "F11"],
};

/** CSS classes */
export const CSS_CLASSES = {
  container: "fullscreen-preview-container",
  overlay: "fullscreen-preview-overlay",
  content: "fullscreen-preview-content",
  closeButton: "fullscreen-preview-close",
  escapeHint: "fullscreen-preview-escape-hint",
  entering: "fullscreen-preview-entering",
  exiting: "fullscreen-preview-exiting",
  active: "fullscreen-preview-active",
};

/** Default z-index */
export const DEFAULT_Z_INDEX = 9999;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check fullscreen API support
 */
export function checkFullscreenSupport(): FullscreenSupport {
  if (typeof document === "undefined") return "none";

  if (document.fullscreenEnabled) return "full";

  // Check for prefixed versions
  const doc = document as any;
  if (doc.webkitFullscreenEnabled || doc.mozFullScreenEnabled || doc.msFullscreenEnabled) {
    return "prefixed";
  }

  return "none";
}

/**
 * Check if currently in native fullscreen
 */
export function isNativeFullscreen(): boolean {
  if (typeof document === "undefined") return false;

  const doc = document as any;
  return !!(
    document.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  );
}

/**
 * Request native fullscreen
 */
export async function requestNativeFullscreen(element: HTMLElement): Promise<boolean> {
  try {
    const el = element as any;
    if (element.requestFullscreen) {
      await element.requestFullscreen();
    } else if (el.webkitRequestFullscreen) {
      await el.webkitRequestFullscreen();
    } else if (el.mozRequestFullScreen) {
      await el.mozRequestFullScreen();
    } else if (el.msRequestFullscreen) {
      await el.msRequestFullscreen();
    } else {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Exit native fullscreen
 */
export async function exitNativeFullscreen(): Promise<boolean> {
  try {
    const doc = document as any;
    if (document.exitFullscreen) {
      await document.exitFullscreen();
    } else if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
    } else if (doc.mozCancelFullScreen) {
      await doc.mozCancelFullScreen();
    } else if (doc.msExitFullscreen) {
      await doc.msExitFullscreen();
    } else {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Create fullscreen overlay styles
 */
export function createOverlayStyles(config: OverlayConfig, zIndex: number): string {
  return `
    .${CSS_CLASSES.overlay} {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-color: ${config.backgroundColor};
      z-index: ${zIndex};
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      visibility: hidden;
      transition: opacity ${config.animationDuration}ms ease-out,
                  visibility ${config.animationDuration}ms ease-out;
    }

    .${CSS_CLASSES.overlay}.${CSS_CLASSES.active} {
      opacity: 1;
      visibility: visible;
    }

    .${CSS_CLASSES.content} {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .${CSS_CLASSES.closeButton} {
      position: absolute;
      ${config.closeButtonPosition.includes("top") ? "top: 16px" : "bottom: 16px"};
      ${config.closeButtonPosition.includes("right") ? "right: 16px" : "left: 16px"};
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: background 150ms ease;
      z-index: ${zIndex + 1};
    }

    .${CSS_CLASSES.closeButton}:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .${CSS_CLASSES.escapeHint} {
      position: absolute;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 14px;
      opacity: 1;
      transition: opacity 300ms ease-out;
      z-index: ${zIndex + 1};
    }

    .${CSS_CLASSES.escapeHint}.hidden {
      opacity: 0;
    }
  `;
}

/**
 * Generate button HTML
 */
export function generateButtonHTML(
  config: FullscreenButtonConfig,
  isFullscreen: boolean,
  className: string = "fullscreen-btn"
): string {
  const label = isFullscreen ? config.exitLabel : config.enterLabel;
  const tooltip = isFullscreen ? config.exitTooltip : config.enterTooltip;
  const icon = isFullscreen ? config.exitIcon : config.enterIcon;

  return `
    <button
      class="${className}"
      title="${tooltip}"
      aria-label="${label}"
      aria-pressed="${isFullscreen}"
      data-fullscreen="${isFullscreen}"
    >
      <span class="icon">${icon}</span>
      <span class="label">${label}</span>
    </button>
  `;
}

/**
 * Generate fullscreen script for iframe injection
 */
export const FULLSCREEN_SCRIPT = `
(function() {
  window.__PLATXA_FULLSCREEN__ = {
    isFullscreen: false,

    enter: function() {
      this.isFullscreen = true;
      window.parent.postMessage({ type: 'fullscreen:enter' }, '*');
    },

    exit: function() {
      this.isFullscreen = false;
      window.parent.postMessage({ type: 'fullscreen:exit' }, '*');
    },

    toggle: function() {
      if (this.isFullscreen) {
        this.exit();
      } else {
        this.enter();
      }
    }
  };

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && window.__PLATXA_FULLSCREEN__.isFullscreen) {
      window.__PLATXA_FULLSCREEN__.exit();
    }
  });
})();
`;

// ============================================================================
// FullscreenPreview Class
// ============================================================================

/**
 * Fullscreen preview controller
 */
export class FullscreenPreview {
  private state: FullscreenState = "normal";
  private targetSelector: string;
  private useNativeFullscreen: boolean;
  private overlayConfig: OverlayConfig;
  private buttonConfig: FullscreenButtonConfig;
  private enableEscKey: boolean;
  private enableKeyboardShortcuts: boolean;
  private enableDoubleClick: boolean;
  private zIndex: number;
  private preserveScrollPosition: boolean;

  private overlay: HTMLDivElement | null = null;
  private originalParent: HTMLElement | null = null;
  private originalNextSibling: Node | null = null;
  private targetElement: HTMLElement | null = null;
  private scrollPosition: { x: number; y: number } = { x: 0, y: 0 };
  private enterTime: number = 0;
  private escapeHintTimeout: ReturnType<typeof setTimeout> | null = null;

  private enterCallbacks: Set<EnterCallback> = new Set();
  private exitCallbacks: Set<ExitCallback> = new Set();
  private stateChangeCallbacks: Set<StateChangeCallback> = new Set();
  private errorCallbacks: Set<ErrorCallback> = new Set();

  private boundKeyHandler: ((e: KeyboardEvent) => void) | null = null;
  private boundDoubleClickHandler: ((e: MouseEvent) => void) | null = null;
  private boundNativeFullscreenHandler: (() => void) | null = null;

  private disposed = false;

  constructor(options: FullscreenPreviewOptions = {}) {
    this.targetSelector = options.targetSelector ?? "#preview";
    this.useNativeFullscreen = options.useNativeFullscreen ?? false;
    this.overlayConfig = { ...DEFAULT_OVERLAY_CONFIG, ...options.overlay };
    this.buttonConfig = { ...DEFAULT_BUTTON_CONFIG, ...options.button };
    this.enableEscKey = options.enableEscKey ?? true;
    this.enableKeyboardShortcuts = options.enableKeyboardShortcuts ?? true;
    this.enableDoubleClick = options.enableDoubleClick ?? false;
    this.zIndex = options.zIndex ?? DEFAULT_Z_INDEX;
    this.preserveScrollPosition = options.preserveScrollPosition ?? true;

    this.setupEventListeners();
  }

  /**
   * Get current state
   */
  getState(): FullscreenState {
    return this.state;
  }

  /**
   * Check if in fullscreen
   */
  isFullscreen(): boolean {
    return this.state === "fullscreen";
  }

  /**
   * Enter fullscreen mode
   */
  async enter(trigger: FullscreenTrigger = "api"): Promise<boolean> {
    if (this.disposed) {
      throw new Error("FullscreenPreview is disposed");
    }

    if (this.state !== "normal") {
      return false;
    }

    this.setState("entering");

    // Find target element
    if (typeof document !== "undefined") {
      this.targetElement = document.querySelector(this.targetSelector);
    }

    if (!this.targetElement) {
      this.notifyError(new Error(`Target element not found: ${this.targetSelector}`));
      this.setState("normal");
      return false;
    }

    // Save scroll position
    if (this.preserveScrollPosition && typeof window !== "undefined") {
      this.scrollPosition = { x: window.scrollX, y: window.scrollY };
    }

    // Try native fullscreen first if enabled
    if (this.useNativeFullscreen && checkFullscreenSupport() !== "none") {
      const success = await requestNativeFullscreen(this.targetElement);
      if (success) {
        this.enterTime = Date.now();
        this.setState("fullscreen");
        this.notifyEnter({ trigger, targetId: this.targetSelector, timestamp: Date.now() });
        return true;
      }
    }

    // Fall back to overlay fullscreen
    this.createOverlay();
    this.moveToOverlay();

    this.enterTime = Date.now();
    this.setState("fullscreen");
    this.notifyEnter({ trigger, targetId: this.targetSelector, timestamp: Date.now() });

    // Show and then hide escape hint
    if (this.overlayConfig.showEscapeHint && this.overlayConfig.escapeHintDuration > 0) {
      this.escapeHintTimeout = setTimeout(() => {
        this.hideEscapeHint();
      }, this.overlayConfig.escapeHintDuration);
    }

    return true;
  }

  /**
   * Exit fullscreen mode
   */
  async exit(trigger: ExitTrigger = "api"): Promise<boolean> {
    if (this.disposed) {
      throw new Error("FullscreenPreview is disposed");
    }

    if (this.state !== "fullscreen") {
      return false;
    }

    this.setState("exiting");

    // Clear escape hint timeout
    if (this.escapeHintTimeout) {
      clearTimeout(this.escapeHintTimeout);
      this.escapeHintTimeout = null;
    }

    const duration = Date.now() - this.enterTime;

    // Exit native fullscreen if active
    if (isNativeFullscreen()) {
      await exitNativeFullscreen();
    }

    // Restore from overlay
    this.restoreFromOverlay();
    this.removeOverlay();

    // Restore scroll position
    if (this.preserveScrollPosition && typeof window !== "undefined") {
      window.scrollTo(this.scrollPosition.x, this.scrollPosition.y);
    }

    this.setState("normal");
    this.notifyExit({ trigger, duration, timestamp: Date.now() });

    return true;
  }

  /**
   * Toggle fullscreen mode
   */
  async toggle(trigger: FullscreenTrigger = "api"): Promise<boolean> {
    if (this.state === "fullscreen") {
      return this.exit(trigger === "button" ? "button" : "api");
    } else if (this.state === "normal") {
      return this.enter(trigger);
    }
    return false;
  }

  /**
   * Get button configuration for current state
   */
  getButtonConfig(): { label: string; tooltip: string; icon: string; shortcut: string } {
    const isFs = this.state === "fullscreen";
    return {
      label: isFs ? this.buttonConfig.exitLabel : this.buttonConfig.enterLabel,
      tooltip: isFs ? this.buttonConfig.exitTooltip : this.buttonConfig.enterTooltip,
      icon: isFs ? this.buttonConfig.exitIcon : this.buttonConfig.enterIcon,
      shortcut: isFs ? this.buttonConfig.exitShortcut : this.buttonConfig.enterShortcut,
    };
  }

  /**
   * Generate button HTML
   */
  getButtonHTML(className?: string): string {
    return generateButtonHTML(this.buttonConfig, this.state === "fullscreen", className);
  }

  /**
   * Subscribe to enter events
   */
  onEnter(callback: EnterCallback): () => void {
    if (this.disposed) {
      throw new Error("FullscreenPreview is disposed");
    }

    this.enterCallbacks.add(callback);
    return () => {
      this.enterCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to exit events
   */
  onExit(callback: ExitCallback): () => void {
    if (this.disposed) {
      throw new Error("FullscreenPreview is disposed");
    }

    this.exitCallbacks.add(callback);
    return () => {
      this.exitCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(callback: StateChangeCallback): () => void {
    if (this.disposed) {
      throw new Error("FullscreenPreview is disposed");
    }

    this.stateChangeCallbacks.add(callback);
    return () => {
      this.stateChangeCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to errors
   */
  onError(callback: ErrorCallback): () => void {
    if (this.disposed) {
      throw new Error("FullscreenPreview is disposed");
    }

    this.errorCallbacks.add(callback);
    return () => {
      this.errorCallbacks.delete(callback);
    };
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

    // Exit fullscreen if active
    if (this.state === "fullscreen") {
      this.restoreFromOverlay();
      this.removeOverlay();
    }

    // Clear timeout
    if (this.escapeHintTimeout) {
      clearTimeout(this.escapeHintTimeout);
    }

    // Remove event listeners
    this.removeEventListeners();

    this.disposed = true;
    this.enterCallbacks.clear();
    this.exitCallbacks.clear();
    this.stateChangeCallbacks.clear();
    this.errorCallbacks.clear();
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  private setState(newState: FullscreenState): void {
    const previousState = this.state;
    this.state = newState;

    this.notifyStateChange({
      previousState,
      newState,
      isFullscreen: newState === "fullscreen",
      timestamp: Date.now(),
    });
  }

  private setupEventListeners(): void {
    if (typeof document === "undefined") return;

    // Keyboard handler
    if (this.enableEscKey || this.enableKeyboardShortcuts) {
      this.boundKeyHandler = (e: KeyboardEvent) => this.handleKeyDown(e);
      document.addEventListener("keydown", this.boundKeyHandler);
    }

    // Double-click handler
    if (this.enableDoubleClick) {
      this.boundDoubleClickHandler = (e: MouseEvent) => this.handleDoubleClick(e);
      document.addEventListener("dblclick", this.boundDoubleClickHandler);
    }

    // Native fullscreen change handler
    this.boundNativeFullscreenHandler = () => this.handleNativeFullscreenChange();
    document.addEventListener("fullscreenchange", this.boundNativeFullscreenHandler);
    document.addEventListener("webkitfullscreenchange", this.boundNativeFullscreenHandler);
    document.addEventListener("mozfullscreenchange", this.boundNativeFullscreenHandler);
    document.addEventListener("MSFullscreenChange", this.boundNativeFullscreenHandler);
  }

  private removeEventListeners(): void {
    if (typeof document === "undefined") return;

    if (this.boundKeyHandler) {
      document.removeEventListener("keydown", this.boundKeyHandler);
    }
    if (this.boundDoubleClickHandler) {
      document.removeEventListener("dblclick", this.boundDoubleClickHandler);
    }
    if (this.boundNativeFullscreenHandler) {
      document.removeEventListener("fullscreenchange", this.boundNativeFullscreenHandler);
      document.removeEventListener("webkitfullscreenchange", this.boundNativeFullscreenHandler);
      document.removeEventListener("mozfullscreenchange", this.boundNativeFullscreenHandler);
      document.removeEventListener("MSFullscreenChange", this.boundNativeFullscreenHandler);
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // ESC to exit
    if (this.enableEscKey && e.key === "Escape" && this.state === "fullscreen") {
      e.preventDefault();
      this.exit("esc");
      return;
    }

    // Keyboard shortcuts
    if (this.enableKeyboardShortcuts) {
      const isEnterShortcut = FULLSCREEN_SHORTCUTS.enter.some((shortcut) =>
        this.matchesShortcut(e, shortcut)
      );

      if (isEnterShortcut && this.state === "normal") {
        e.preventDefault();
        this.enter("keyboard");
      }
    }
  }

  private matchesShortcut(e: KeyboardEvent, shortcut: string): boolean {
    const parts = shortcut.toLowerCase().split("+");
    const key = parts[parts.length - 1];

    const needsCtrl = parts.includes("ctrl");
    const needsShift = parts.includes("shift");
    const needsCmd = parts.includes("cmd");
    const needsAlt = parts.includes("alt");

    return (
      e.key.toLowerCase() === key &&
      e.ctrlKey === needsCtrl &&
      e.shiftKey === needsShift &&
      e.metaKey === needsCmd &&
      e.altKey === needsAlt
    );
  }

  private handleDoubleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const previewElement = document.querySelector(this.targetSelector);

    if (previewElement?.contains(target)) {
      this.toggle("double-click");
    }
  }

  private handleNativeFullscreenChange(): void {
    // Sync state with native fullscreen
    if (!isNativeFullscreen() && this.state === "fullscreen" && this.useNativeFullscreen) {
      this.setState("normal");
      this.notifyExit({
        trigger: "esc",
        duration: Date.now() - this.enterTime,
        timestamp: Date.now(),
      });
    }
  }

  private createOverlay(): void {
    if (typeof document === "undefined" || this.overlay) return;

    // Create style element
    const style = document.createElement("style");
    style.id = "fullscreen-preview-styles";
    style.textContent = createOverlayStyles(this.overlayConfig, this.zIndex);
    document.head.appendChild(style);

    // Create overlay
    this.overlay = document.createElement("div");
    this.overlay.className = CSS_CLASSES.overlay;

    // Create content container
    const content = document.createElement("div");
    content.className = CSS_CLASSES.content;
    this.overlay.appendChild(content);

    // Add close button
    if (this.overlayConfig.showCloseButton) {
      const closeBtn = document.createElement("button");
      closeBtn.className = CSS_CLASSES.closeButton;
      closeBtn.textContent = this.buttonConfig.exitLabel;
      closeBtn.onclick = () => this.exit("button");
      this.overlay.appendChild(closeBtn);
    }

    // Add escape hint
    if (this.overlayConfig.showEscapeHint) {
      const hint = document.createElement("div");
      hint.className = CSS_CLASSES.escapeHint;
      hint.textContent = "Press ESC to exit fullscreen";
      this.overlay.appendChild(hint);
    }

    document.body.appendChild(this.overlay);

    // Trigger reflow and add active class
    requestAnimationFrame(() => {
      this.overlay?.classList.add(CSS_CLASSES.active);
    });
  }

  private removeOverlay(): void {
    if (!this.overlay) return;

    this.overlay.classList.remove(CSS_CLASSES.active);

    // Wait for animation
    setTimeout(() => {
      this.overlay?.remove();
      this.overlay = null;

      // Remove styles
      document.getElementById("fullscreen-preview-styles")?.remove();
    }, this.overlayConfig.animationDuration);
  }

  private moveToOverlay(): void {
    if (!this.targetElement || !this.overlay) return;

    // Save original position
    this.originalParent = this.targetElement.parentElement;
    this.originalNextSibling = this.targetElement.nextSibling;

    // Move to overlay
    const content = this.overlay.querySelector(`.${CSS_CLASSES.content}`);
    if (content) {
      content.appendChild(this.targetElement);
    }
  }

  private restoreFromOverlay(): void {
    if (!this.targetElement || !this.originalParent) return;

    // Move back to original position
    if (this.originalNextSibling) {
      this.originalParent.insertBefore(this.targetElement, this.originalNextSibling);
    } else {
      this.originalParent.appendChild(this.targetElement);
    }

    this.originalParent = null;
    this.originalNextSibling = null;
  }

  private hideEscapeHint(): void {
    if (!this.overlay) return;
    const hint = this.overlay.querySelector(`.${CSS_CLASSES.escapeHint}`);
    hint?.classList.add("hidden");
  }

  private notifyEnter(event: FullscreenEnterEvent): void {
    for (const callback of this.enterCallbacks) {
      try {
        callback(event);
      } catch (err) {
        console.error("FullscreenPreview enter callback error:", err);
      }
    }
  }

  private notifyExit(event: FullscreenExitEvent): void {
    for (const callback of this.exitCallbacks) {
      try {
        callback(event);
      } catch (err) {
        console.error("FullscreenPreview exit callback error:", err);
      }
    }
  }

  private notifyStateChange(event: FullscreenStateEvent): void {
    for (const callback of this.stateChangeCallbacks) {
      try {
        callback(event);
      } catch (err) {
        console.error("FullscreenPreview state change callback error:", err);
      }
    }
  }

  private notifyError(error: Error): void {
    for (const callback of this.errorCallbacks) {
      try {
        callback(error);
      } catch (err) {
        console.error("FullscreenPreview error callback error:", err);
      }
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new FullscreenPreview instance
 */
export function createFullscreenPreview(
  options?: FullscreenPreviewOptions
): FullscreenPreview {
  return new FullscreenPreview(options);
}
