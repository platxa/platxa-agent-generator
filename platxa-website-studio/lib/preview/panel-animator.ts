/**
 * Panel Collapse/Expand Animations
 *
 * Feature #121: Implement panel collapse/expand animations
 * Verification: Panels animate smoothly when collapsed/expanded
 */

// ============================================================================
// Types
// ============================================================================

/** Animation direction */
export type AnimationDirection = "expand" | "collapse";

/** Animation style */
export type AnimationStyle = "slide" | "fade" | "scale" | "slideAndFade" | "none";

/** Easing function name */
export type EasingFunction =
  | "linear"
  | "ease"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "cubic-bezier";

/** Panel orientation */
export type PanelOrientation = "horizontal" | "vertical";

/** Animation state */
export type AnimationState = "idle" | "animating" | "expanded" | "collapsed";

/** Animation configuration */
export interface AnimationConfig {
  /** Animation duration in ms */
  duration: number;
  /** Easing function */
  easing: EasingFunction;
  /** Custom cubic-bezier values (if easing is 'cubic-bezier') */
  cubicBezier?: [number, number, number, number];
  /** Animation style */
  style: AnimationStyle;
  /** Panel orientation (for slide animations) */
  orientation: PanelOrientation;
  /** Delay before animation starts in ms */
  delay?: number;
}

/** Panel dimensions */
export interface PanelDimensions {
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Min width (for horizontal collapse) */
  minWidth?: number;
  /** Min height (for vertical collapse) */
  minHeight?: number;
}

/** Animation frame data */
export interface AnimationFrame {
  /** Progress from 0 to 1 */
  progress: number;
  /** Eased progress */
  easedProgress: number;
  /** Current width */
  width: number;
  /** Current height */
  height: number;
  /** Current opacity */
  opacity: number;
  /** Current scale */
  scale: number;
  /** Elapsed time in ms */
  elapsed: number;
}

/** Panel state */
export interface PanelState {
  /** Panel ID */
  id: string;
  /** Is expanded */
  expanded: boolean;
  /** Animation state */
  animationState: AnimationState;
  /** Current dimensions */
  dimensions: PanelDimensions;
  /** Expanded dimensions (remembered for restore) */
  expandedDimensions: PanelDimensions;
  /** Collapsed dimensions */
  collapsedDimensions: PanelDimensions;
}

/** CSS styles for animation */
export interface AnimationStyles {
  /** Width style */
  width?: string;
  /** Height style */
  height?: string;
  /** Opacity style */
  opacity?: string;
  /** Transform style */
  transform?: string;
  /** Transition style */
  transition?: string;
  /** Overflow style */
  overflow?: string;
}

/** Animation callback */
export type AnimationCallback = (frame: AnimationFrame) => void;

/** State change callback */
export type StateChangeCallback = (state: PanelState) => void;

/** Animation complete callback */
export type CompleteCallback = (panelId: string, expanded: boolean) => void;

/** Panel animator options */
export interface PanelAnimatorOptions {
  /** Default animation config */
  defaultConfig?: Partial<AnimationConfig>;
  /** Respect reduced motion preference */
  respectReducedMotion?: boolean;
  /** Use requestAnimationFrame for JS animations */
  useRAF?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Default animation configuration */
export const DEFAULT_CONFIG: AnimationConfig = {
  duration: 300,
  easing: "ease-out",
  style: "slide",
  orientation: "horizontal",
  delay: 0,
};

/** Easing CSS values */
export const EASING_CSS: Record<EasingFunction, string> = {
  linear: "linear",
  ease: "ease",
  "ease-in": "ease-in",
  "ease-out": "ease-out",
  "ease-in-out": "ease-in-out",
  "cubic-bezier": "cubic-bezier(0.4, 0, 0.2, 1)",
};

/** Common easing presets */
export const EASING_PRESETS = {
  /** Material Design standard easing */
  standard: "cubic-bezier(0.4, 0, 0.2, 1)",
  /** Material Design decelerate */
  decelerate: "cubic-bezier(0, 0, 0.2, 1)",
  /** Material Design accelerate */
  accelerate: "cubic-bezier(0.4, 0, 1, 1)",
  /** Smooth bounce */
  bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
  /** Snappy */
  snappy: "cubic-bezier(0.5, 0, 0.1, 1)",
};

/** Animation style CSS templates */
export const ANIMATION_STYLES: Record<AnimationStyle, (config: AnimationConfig) => string> = {
  slide: (config) => {
    const prop = config.orientation === "horizontal" ? "width" : "height";
    return `${prop} ${config.duration}ms ${getEasingValue(config)}`;
  },
  fade: (config) => `opacity ${config.duration}ms ${getEasingValue(config)}`,
  scale: (config) => `transform ${config.duration}ms ${getEasingValue(config)}`,
  slideAndFade: (config) => {
    const prop = config.orientation === "horizontal" ? "width" : "height";
    const easing = getEasingValue(config);
    return `${prop} ${config.duration}ms ${easing}, opacity ${config.duration}ms ${easing}`;
  },
  none: () => "none",
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get CSS easing value from config
 */
export function getEasingValue(config: AnimationConfig): string {
  if (config.easing === "cubic-bezier" && config.cubicBezier) {
    return `cubic-bezier(${config.cubicBezier.join(", ")})`;
  }
  return EASING_CSS[config.easing];
}

/**
 * Apply easing function to progress
 */
export function applyEasing(progress: number, easing: EasingFunction): number {
  switch (easing) {
    case "linear":
      return progress;
    case "ease-in":
      return progress * progress;
    case "ease-out":
      return 1 - Math.pow(1 - progress, 2);
    case "ease-in-out":
      return progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    case "ease":
    case "cubic-bezier":
    default:
      // Approximate ease curve
      return progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
  }
}

/**
 * Generate transition CSS
 */
export function generateTransitionCSS(config: AnimationConfig): string {
  const styleFn = ANIMATION_STYLES[config.style];
  return styleFn(config);
}

/**
 * Generate animation styles for a frame
 */
export function generateFrameStyles(
  frame: AnimationFrame,
  config: AnimationConfig,
  direction: AnimationDirection
): AnimationStyles {
  const styles: AnimationStyles = {
    overflow: "hidden",
  };

  const progress = direction === "expand" ? frame.easedProgress : 1 - frame.easedProgress;

  switch (config.style) {
    case "slide":
      if (config.orientation === "horizontal") {
        styles.width = `${frame.width}px`;
      } else {
        styles.height = `${frame.height}px`;
      }
      break;

    case "fade":
      styles.opacity = frame.opacity.toString();
      break;

    case "scale":
      styles.transform = `scale(${frame.scale})`;
      styles.opacity = frame.opacity.toString();
      break;

    case "slideAndFade":
      if (config.orientation === "horizontal") {
        styles.width = `${frame.width}px`;
      } else {
        styles.height = `${frame.height}px`;
      }
      styles.opacity = frame.opacity.toString();
      break;

    case "none":
      // No animation styles
      break;
  }

  return styles;
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

/**
 * Interpolate between two values
 */
export function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Generate unique panel ID
 */
export function generatePanelId(): string {
  return `panel-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================================================
// PanelAnimator Class
// ============================================================================

/**
 * Panel animator for collapse/expand animations
 */
export class PanelAnimator {
  private panels: Map<string, PanelState> = new Map();
  private animations: Map<string, number> = new Map(); // RAF IDs
  private config: AnimationConfig;
  private respectReducedMotion: boolean;
  private useRAF: boolean;
  private stateCallbacks: Set<StateChangeCallback> = new Set();
  private completeCallbacks: Set<CompleteCallback> = new Set();
  private disposed = false;

  constructor(options: PanelAnimatorOptions = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options.defaultConfig };
    this.respectReducedMotion = options.respectReducedMotion ?? true;
    this.useRAF = options.useRAF ?? true;
  }

  /**
   * Register a panel
   */
  registerPanel(
    id: string,
    expandedDimensions: PanelDimensions,
    collapsedDimensions: PanelDimensions,
    initialExpanded: boolean = true
  ): PanelState {
    if (this.disposed) {
      throw new Error("PanelAnimator is disposed");
    }

    const state: PanelState = {
      id,
      expanded: initialExpanded,
      animationState: initialExpanded ? "expanded" : "collapsed",
      dimensions: initialExpanded ? { ...expandedDimensions } : { ...collapsedDimensions },
      expandedDimensions: { ...expandedDimensions },
      collapsedDimensions: { ...collapsedDimensions },
    };

    this.panels.set(id, state);
    return state;
  }

  /**
   * Unregister a panel
   */
  unregisterPanel(id: string): boolean {
    this.cancelAnimation(id);
    return this.panels.delete(id);
  }

  /**
   * Get panel state
   */
  getPanel(id: string): PanelState | undefined {
    return this.panels.get(id);
  }

  /**
   * Get all panels
   */
  getAllPanels(): PanelState[] {
    return Array.from(this.panels.values());
  }

  /**
   * Toggle panel expanded state
   * @returns The new expanded state after toggle (true=expanded, false=collapsed)
   */
  toggle(id: string, config?: Partial<AnimationConfig>): boolean {
    const panel = this.panels.get(id);
    if (!panel) return false;

    if (panel.expanded) {
      this.collapse(id, config);
    } else {
      this.expand(id, config);
    }

    // Return the NEW expanded state (updated by collapse/expand)
    return panel.expanded;
  }

  /**
   * Expand a panel with animation
   */
  expand(id: string, configOverride?: Partial<AnimationConfig>): void {
    if (this.disposed) {
      throw new Error("PanelAnimator is disposed");
    }

    const panel = this.panels.get(id);
    if (!panel || panel.expanded) return;

    this.animate(id, "expand", configOverride);
  }

  /**
   * Collapse a panel with animation
   */
  collapse(id: string, configOverride?: Partial<AnimationConfig>): void {
    if (this.disposed) {
      throw new Error("PanelAnimator is disposed");
    }

    const panel = this.panels.get(id);
    if (!panel || !panel.expanded) return;

    this.animate(id, "collapse", configOverride);
  }

  /**
   * Animate panel
   */
  private animate(
    id: string,
    direction: AnimationDirection,
    configOverride?: Partial<AnimationConfig>
  ): void {
    const panel = this.panels.get(id);
    if (!panel) return;

    // Cancel any existing animation
    this.cancelAnimation(id);

    const config = { ...this.config, ...configOverride };

    // Check for reduced motion
    if (this.respectReducedMotion && prefersReducedMotion()) {
      this.completeAnimation(id, direction);
      return;
    }

    // Instant animation if style is none or duration is 0
    if (config.style === "none" || config.duration === 0) {
      this.completeAnimation(id, direction);
      return;
    }

    panel.animationState = "animating";
    this.notifyStateChange(panel);

    const startDimensions = { ...panel.dimensions };
    const endDimensions =
      direction === "expand" ? panel.expandedDimensions : panel.collapsedDimensions;

    const startTime = performance.now() + (config.delay ?? 0);

    const animateFrame = (currentTime: number) => {
      if (this.disposed) return;

      const elapsed = currentTime - startTime;

      if (elapsed < 0) {
        // Still in delay period
        this.animations.set(id, requestAnimationFrame(animateFrame));
        return;
      }

      const progress = clamp(elapsed / config.duration, 0, 1);
      const easedProgress = applyEasing(progress, config.easing);

      const frame: AnimationFrame = {
        progress,
        easedProgress,
        width: lerp(startDimensions.width, endDimensions.width, easedProgress),
        height: lerp(startDimensions.height, endDimensions.height, easedProgress),
        opacity: direction === "expand" ? easedProgress : 1 - easedProgress,
        scale: direction === "expand" ? lerp(0.95, 1, easedProgress) : lerp(1, 0.95, easedProgress),
        elapsed,
      };

      // Update panel dimensions
      panel.dimensions = {
        width: frame.width,
        height: frame.height,
        minWidth: panel.collapsedDimensions.minWidth,
        minHeight: panel.collapsedDimensions.minHeight,
      };

      if (progress >= 1) {
        this.completeAnimation(id, direction);
      } else {
        this.animations.set(id, requestAnimationFrame(animateFrame));
      }
    };

    this.animations.set(id, requestAnimationFrame(animateFrame));
  }

  /**
   * Complete animation
   */
  private completeAnimation(id: string, direction: AnimationDirection): void {
    const panel = this.panels.get(id);
    if (!panel) return;

    panel.expanded = direction === "expand";
    panel.animationState = direction === "expand" ? "expanded" : "collapsed";
    panel.dimensions = direction === "expand"
      ? { ...panel.expandedDimensions }
      : { ...panel.collapsedDimensions };

    this.animations.delete(id);
    this.notifyStateChange(panel);
    this.notifyComplete(id, panel.expanded);
  }

  /**
   * Cancel animation for panel
   */
  cancelAnimation(id: string): void {
    const rafId = this.animations.get(id);
    if (rafId !== undefined) {
      cancelAnimationFrame(rafId);
      this.animations.delete(id);
    }
  }

  /**
   * Get CSS styles for panel
   */
  getStyles(id: string): AnimationStyles {
    const panel = this.panels.get(id);
    if (!panel) return {};

    const styles: AnimationStyles = {
      transition: generateTransitionCSS(this.config),
      overflow: panel.animationState === "animating" ? "hidden" : undefined,
    };

    if (this.config.orientation === "horizontal") {
      styles.width = `${panel.dimensions.width}px`;
    } else {
      styles.height = `${panel.dimensions.height}px`;
    }

    if (this.config.style === "fade" || this.config.style === "slideAndFade") {
      styles.opacity = panel.expanded ? "1" : "0";
    }

    if (this.config.style === "scale") {
      styles.transform = panel.expanded ? "scale(1)" : "scale(0.95)";
      styles.opacity = panel.expanded ? "1" : "0";
    }

    return styles;
  }

  /**
   * Get inline style string
   */
  getStyleString(id: string): string {
    const styles = this.getStyles(id);
    return Object.entries(styles)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${camelToKebab(key)}: ${value}`)
      .join("; ");
  }

  /**
   * Update default config
   */
  setConfig(config: Partial<AnimationConfig>): void {
    if (this.disposed) {
      throw new Error("PanelAnimator is disposed");
    }
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current config
   */
  getConfig(): AnimationConfig {
    return { ...this.config };
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(callback: StateChangeCallback): () => void {
    if (this.disposed) {
      throw new Error("PanelAnimator is disposed");
    }

    this.stateCallbacks.add(callback);
    return () => {
      this.stateCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to animation complete
   */
  onComplete(callback: CompleteCallback): () => void {
    if (this.disposed) {
      throw new Error("PanelAnimator is disposed");
    }

    this.completeCallbacks.add(callback);
    return () => {
      this.completeCallbacks.delete(callback);
    };
  }

  /**
   * Notify state change
   */
  private notifyStateChange(state: PanelState): void {
    for (const callback of this.stateCallbacks) {
      try {
        callback(state);
      } catch (err) {
        console.error("PanelAnimator state callback error:", err);
      }
    }
  }

  /**
   * Notify animation complete
   */
  private notifyComplete(panelId: string, expanded: boolean): void {
    for (const callback of this.completeCallbacks) {
      try {
        callback(panelId, expanded);
      } catch (err) {
        console.error("PanelAnimator complete callback error:", err);
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

    // Cancel all animations
    for (const id of this.animations.keys()) {
      this.cancelAnimation(id);
    }

    this.disposed = true;
    this.panels.clear();
    this.animations.clear();
    this.stateCallbacks.clear();
    this.completeCallbacks.clear();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new PanelAnimator instance
 */
export function createPanelAnimator(
  options?: PanelAnimatorOptions
): PanelAnimator {
  return new PanelAnimator(options);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert camelCase to kebab-case
 */
function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Create smooth animation config
 */
export function createSmoothConfig(duration: number = 300): AnimationConfig {
  return {
    duration,
    easing: "ease-out",
    style: "slideAndFade",
    orientation: "horizontal",
  };
}

/**
 * Create snappy animation config
 */
export function createSnappyConfig(duration: number = 200): AnimationConfig {
  return {
    duration,
    easing: "cubic-bezier",
    cubicBezier: [0.5, 0, 0.1, 1],
    style: "slide",
    orientation: "horizontal",
  };
}

/**
 * Create bounce animation config
 */
export function createBounceConfig(duration: number = 400): AnimationConfig {
  return {
    duration,
    easing: "cubic-bezier",
    cubicBezier: [0.68, -0.55, 0.265, 1.55],
    style: "scale",
    orientation: "horizontal",
  };
}
