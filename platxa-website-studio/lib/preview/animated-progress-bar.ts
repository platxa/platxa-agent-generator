/**
 * AnimatedProgressBar — Animated progress bar with phase-specific colors.
 *
 * Feature #101: Create animated progress bar with phase-specific colors
 * Verification: Blue for planning, green for generating, yellow for validating
 *
 * Provides smooth animated transitions between progress states with
 * configurable phase-based color schemes.
 *
 * @module lib/preview/animated-progress-bar
 */

// =============================================================================
// Types
// =============================================================================

/** Progress phase types */
export type ProgressPhase =
  | "idle"
  | "planning"
  | "generating"
  | "validating"
  | "deploying"
  | "complete"
  | "error";

/** Animation style options */
export type AnimationStyle =
  | "smooth"
  | "striped"
  | "pulse"
  | "shimmer"
  | "none";

/** Progress size variants */
export type ProgressSize = "xs" | "sm" | "md" | "lg" | "xl";

/** Phase color configuration */
export interface PhaseColor {
  /** Background color (Tailwind class or hex) */
  bg: string;
  /** Foreground/bar color (Tailwind class or hex) */
  fg: string;
  /** Text color for labels */
  text: string;
  /** Glow/shadow color for effects */
  glow?: string;
}

/** Progress bar state */
export interface ProgressBarState {
  /** Current progress (0-100) */
  progress: number;
  /** Target progress for animation */
  targetProgress: number;
  /** Current phase */
  phase: ProgressPhase;
  /** Whether animation is active */
  animating: boolean;
  /** Whether indeterminate mode */
  indeterminate: boolean;
  /** Current phase label */
  label: string;
  /** Optional sublabel/details */
  sublabel?: string;
  /** Whether bar is visible */
  visible: boolean;
}

/** Progress bar options */
export interface ProgressBarOptions {
  /** Initial progress (0-100, default: 0) */
  initialProgress?: number;
  /** Initial phase (default: 'idle') */
  initialPhase?: ProgressPhase;
  /** Animation duration in ms (default: 300) */
  animationDuration?: number;
  /** Animation easing function (default: 'ease-out') */
  animationEasing?: string;
  /** Animation style (default: 'smooth') */
  animationStyle?: AnimationStyle;
  /** Size variant (default: 'md') */
  size?: ProgressSize;
  /** Show percentage label (default: true) */
  showPercentage?: boolean;
  /** Show phase label (default: true) */
  showPhaseLabel?: boolean;
  /** Custom phase colors */
  phaseColors?: Partial<Record<ProgressPhase, PhaseColor>>;
  /** Enable glow effect (default: true) */
  enableGlow?: boolean;
  /** Update callback interval in ms (default: 16 for 60fps) */
  updateInterval?: number;
}

/** Style configuration for rendering */
export interface ProgressBarStyles {
  /** Container classes */
  container: string;
  /** Track/background classes */
  track: string;
  /** Bar/fill classes */
  bar: string;
  /** Label classes */
  label: string;
  /** Inline styles for bar width/animation */
  barStyle: Record<string, string>;
  /** Animation keyframes if needed */
  keyframes?: string;
}

/** State change callback */
export type StateChangeCallback = (state: ProgressBarState) => void;

/** Phase change callback */
export type PhaseChangeCallback = (
  phase: ProgressPhase,
  previousPhase: ProgressPhase
) => void;

/** Progress complete callback */
export type CompleteCallback = () => void;

// =============================================================================
// Constants
// =============================================================================

/** Default phase colors (Tailwind classes) */
export const PHASE_COLORS: Record<ProgressPhase, PhaseColor> = {
  idle: {
    bg: "bg-gray-200 dark:bg-gray-700",
    fg: "bg-gray-400 dark:bg-gray-500",
    text: "text-gray-600 dark:text-gray-400",
  },
  planning: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    fg: "bg-blue-500 dark:bg-blue-400",
    text: "text-blue-700 dark:text-blue-300",
    glow: "shadow-blue-500/50",
  },
  generating: {
    bg: "bg-green-100 dark:bg-green-900/30",
    fg: "bg-green-500 dark:bg-green-400",
    text: "text-green-700 dark:text-green-300",
    glow: "shadow-green-500/50",
  },
  validating: {
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    fg: "bg-yellow-500 dark:bg-yellow-400",
    text: "text-yellow-700 dark:text-yellow-300",
    glow: "shadow-yellow-500/50",
  },
  deploying: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    fg: "bg-purple-500 dark:bg-purple-400",
    text: "text-purple-700 dark:text-purple-300",
    glow: "shadow-purple-500/50",
  },
  complete: {
    bg: "bg-green-100 dark:bg-green-900/30",
    fg: "bg-green-600 dark:bg-green-500",
    text: "text-green-700 dark:text-green-300",
    glow: "shadow-green-600/50",
  },
  error: {
    bg: "bg-red-100 dark:bg-red-900/30",
    fg: "bg-red-500 dark:bg-red-400",
    text: "text-red-700 dark:text-red-300",
    glow: "shadow-red-500/50",
  },
};

/** Phase labels */
export const PHASE_LABELS: Record<ProgressPhase, string> = {
  idle: "Ready",
  planning: "Planning...",
  generating: "Generating...",
  validating: "Validating...",
  deploying: "Deploying...",
  complete: "Complete",
  error: "Error",
};

/** Size configurations */
export const SIZE_CONFIG: Record<ProgressSize, { height: string; text: string }> = {
  xs: { height: "h-1", text: "text-xs" },
  sm: { height: "h-2", text: "text-sm" },
  md: { height: "h-3", text: "text-sm" },
  lg: { height: "h-4", text: "text-base" },
  xl: { height: "h-6", text: "text-lg" },
};

/** Animation keyframes for different styles */
export const ANIMATION_KEYFRAMES: Record<AnimationStyle, string> = {
  none: "",
  smooth: "",
  striped: `
    @keyframes progress-stripes {
      0% { background-position: 1rem 0; }
      100% { background-position: 0 0; }
    }
  `,
  pulse: `
    @keyframes progress-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
  `,
  shimmer: `
    @keyframes progress-shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `,
};

/** Default options */
const DEFAULT_OPTIONS: Required<ProgressBarOptions> = {
  initialProgress: 0,
  initialPhase: "idle",
  animationDuration: 300,
  animationEasing: "ease-out",
  animationStyle: "smooth",
  size: "md",
  showPercentage: true,
  showPhaseLabel: true,
  phaseColors: {},
  enableGlow: true,
  updateInterval: 16,
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Clamps a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Gets phase color configuration.
 */
export function getPhaseColor(
  phase: ProgressPhase,
  customColors?: Partial<Record<ProgressPhase, PhaseColor>>
): PhaseColor {
  return customColors?.[phase] ?? PHASE_COLORS[phase];
}

/**
 * Gets phase label.
 */
export function getPhaseLabel(phase: ProgressPhase): string {
  return PHASE_LABELS[phase];
}

/**
 * Formats progress percentage for display.
 */
export function formatProgress(progress: number): string {
  return `${Math.round(progress)}%`;
}

/**
 * Generates CSS classes for animation style.
 */
export function getAnimationClasses(style: AnimationStyle): string {
  switch (style) {
    case "striped":
      return "bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:1rem_100%] animate-[progress-stripes_1s_linear_infinite]";
    case "pulse":
      return "animate-[progress-pulse_2s_ease-in-out_infinite]";
    case "shimmer":
      return "bg-gradient-to-r from-transparent via-white/30 to-transparent bg-[length:200%_100%] animate-[progress-shimmer_2s_linear_infinite]";
    case "smooth":
    case "none":
    default:
      return "";
  }
}

/**
 * Generates indeterminate animation classes.
 */
export function getIndeterminateClasses(): string {
  return "animate-[indeterminate_1.5s_ease-in-out_infinite]";
}

// =============================================================================
// AnimatedProgressBar Class
// =============================================================================

/**
 * AnimatedProgressBar — Progress bar with smooth animations and phase colors.
 *
 * @example
 * ```typescript
 * const progressBar = new AnimatedProgressBar({
 *   initialPhase: 'planning',
 *   animationStyle: 'smooth',
 * });
 *
 * // Set progress
 * progressBar.setProgress(50);
 *
 * // Change phase
 * progressBar.setPhase('generating');
 *
 * // Listen for updates
 * progressBar.onStateChange((state) => {
 *   updateUI(state);
 * });
 *
 * // Complete
 * progressBar.complete();
 * ```
 */
export class AnimatedProgressBar {
  private options: Required<ProgressBarOptions>;
  private state: ProgressBarState;
  private animationFrame: number | null = null;
  private stateCallbacks = new Set<StateChangeCallback>();
  private phaseCallbacks = new Set<PhaseChangeCallback>();
  private completeCallbacks = new Set<CompleteCallback>();
  private disposed = false;

  constructor(options: ProgressBarOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.state = {
      progress: this.options.initialProgress,
      targetProgress: this.options.initialProgress,
      phase: this.options.initialPhase,
      animating: false,
      indeterminate: false,
      label: getPhaseLabel(this.options.initialPhase),
      visible: true,
    };
  }

  // ---------------------------------------------------------------------------
  // Progress Control
  // ---------------------------------------------------------------------------

  /**
   * Sets the target progress with animation.
   */
  setProgress(progress: number): void {
    if (this.disposed) return;

    const clamped = clamp(progress, 0, 100);
    this.state.targetProgress = clamped;

    if (this.state.indeterminate) {
      this.state.indeterminate = false;
    }

    this.startAnimation();
  }

  /**
   * Sets progress immediately without animation.
   */
  setProgressImmediate(progress: number): void {
    if (this.disposed) return;

    const clamped = clamp(progress, 0, 100);
    this.state.progress = clamped;
    this.state.targetProgress = clamped;
    this.state.animating = false;

    if (this.state.indeterminate) {
      this.state.indeterminate = false;
    }

    this.notifyStateChange();
  }

  /**
   * Increments progress by amount.
   */
  increment(amount: number = 1): void {
    this.setProgress(this.state.targetProgress + amount);
  }

  /**
   * Sets indeterminate mode (animated without specific progress).
   */
  setIndeterminate(indeterminate: boolean = true): void {
    if (this.disposed) return;

    this.state.indeterminate = indeterminate;
    this.notifyStateChange();
  }

  // ---------------------------------------------------------------------------
  // Phase Control
  // ---------------------------------------------------------------------------

  /**
   * Sets the current phase.
   */
  setPhase(phase: ProgressPhase): void {
    if (this.disposed) return;

    const previousPhase = this.state.phase;
    if (phase === previousPhase) return;

    this.state.phase = phase;
    this.state.label = getPhaseLabel(phase);

    this.notifyPhaseChange(phase, previousPhase);
    this.notifyStateChange();
  }

  /**
   * Sets custom label for current phase.
   */
  setLabel(label: string, sublabel?: string): void {
    if (this.disposed) return;

    this.state.label = label;
    this.state.sublabel = sublabel;
    this.notifyStateChange();
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Starts the progress bar.
   */
  start(phase: ProgressPhase = "planning"): void {
    if (this.disposed) return;

    this.state.progress = 0;
    this.state.targetProgress = 0;
    this.state.phase = phase;
    this.state.label = getPhaseLabel(phase);
    this.state.visible = true;
    this.state.indeterminate = false;

    this.notifyStateChange();
  }

  /**
   * Completes the progress bar.
   */
  complete(): void {
    if (this.disposed) return;

    this.stopAnimation();
    this.state.progress = 100;
    this.state.targetProgress = 100;
    this.state.phase = "complete";
    this.state.label = getPhaseLabel("complete");
    this.state.animating = false;
    this.state.indeterminate = false;

    this.notifyStateChange();
    this.notifyComplete();
  }

  /**
   * Sets error state.
   */
  error(message?: string): void {
    if (this.disposed) return;

    this.stopAnimation();
    this.state.phase = "error";
    this.state.label = message ?? getPhaseLabel("error");
    this.state.animating = false;
    this.state.indeterminate = false;

    this.notifyStateChange();
  }

  /**
   * Resets to initial state.
   */
  reset(): void {
    if (this.disposed) return;

    this.stopAnimation();
    this.state = {
      progress: this.options.initialProgress,
      targetProgress: this.options.initialProgress,
      phase: this.options.initialPhase,
      animating: false,
      indeterminate: false,
      label: getPhaseLabel(this.options.initialPhase),
      visible: true,
    };

    this.notifyStateChange();
  }

  /**
   * Hides the progress bar.
   */
  hide(): void {
    if (this.disposed) return;

    this.state.visible = false;
    this.notifyStateChange();
  }

  /**
   * Shows the progress bar.
   */
  show(): void {
    if (this.disposed) return;

    this.state.visible = true;
    this.notifyStateChange();
  }

  // ---------------------------------------------------------------------------
  // Animation
  // ---------------------------------------------------------------------------

  private startAnimation(): void {
    if (this.state.animating) return;

    this.state.animating = true;
    this.animate();
  }

  private stopAnimation(): void {
    this.state.animating = false;
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  private animate(): void {
    if (this.disposed || !this.state.animating) return;

    const diff = this.state.targetProgress - this.state.progress;
    const step = diff * 0.15; // Smooth easing factor

    if (Math.abs(diff) < 0.5) {
      // Close enough, snap to target
      this.state.progress = this.state.targetProgress;
      this.state.animating = false;
      this.notifyStateChange();

      if (this.state.progress >= 100) {
        this.notifyComplete();
      }
      return;
    }

    this.state.progress += step;
    this.notifyStateChange();

    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  /**
   * Gets current state.
   */
  getState(): ProgressBarState {
    return { ...this.state };
  }

  /**
   * Gets current progress.
   */
  getProgress(): number {
    return this.state.progress;
  }

  /**
   * Gets current phase.
   */
  getPhase(): ProgressPhase {
    return this.state.phase;
  }

  /**
   * Checks if animating.
   */
  isAnimating(): boolean {
    return this.state.animating;
  }

  /**
   * Checks if complete.
   */
  isComplete(): boolean {
    return this.state.phase === "complete" && this.state.progress >= 100;
  }

  /**
   * Checks if visible.
   */
  isVisible(): boolean {
    return this.state.visible;
  }

  // ---------------------------------------------------------------------------
  // Style Generation
  // ---------------------------------------------------------------------------

  /**
   * Gets style configuration for rendering.
   */
  getStyles(): ProgressBarStyles {
    const colors = getPhaseColor(this.state.phase, this.options.phaseColors);
    const size = SIZE_CONFIG[this.options.size];
    const animClasses = getAnimationClasses(this.options.animationStyle);

    const glowClass =
      this.options.enableGlow && colors.glow ? `shadow-lg ${colors.glow}` : "";

    const container = [
      "relative w-full overflow-hidden rounded-full",
      size.height,
      colors.bg,
    ]
      .filter(Boolean)
      .join(" ");

    const track = "absolute inset-0";

    const bar = [
      "h-full rounded-full transition-all",
      colors.fg,
      glowClass,
      animClasses,
      this.state.indeterminate ? getIndeterminateClasses() : "",
    ]
      .filter(Boolean)
      .join(" ");

    const label = [size.text, colors.text, "font-medium"]
      .filter(Boolean)
      .join(" ");

    const barStyle: Record<string, string> = {
      width: this.state.indeterminate ? "30%" : `${this.state.progress}%`,
      transition: `width ${this.options.animationDuration}ms ${this.options.animationEasing}`,
    };

    if (this.state.indeterminate) {
      barStyle.animation = "indeterminate 1.5s ease-in-out infinite";
    }

    const keyframes = [
      ANIMATION_KEYFRAMES[this.options.animationStyle],
      `@keyframes indeterminate {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(400%); }
      }`,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      container,
      track,
      bar,
      label,
      barStyle,
      keyframes,
    };
  }

  /**
   * Gets formatted percentage string.
   */
  getFormattedProgress(): string {
    return formatProgress(this.state.progress);
  }

  /**
   * Gets the phase colors for current phase.
   */
  getPhaseColors(): PhaseColor {
    return getPhaseColor(this.state.phase, this.options.phaseColors);
  }

  // ---------------------------------------------------------------------------
  // Callbacks
  // ---------------------------------------------------------------------------

  /**
   * Registers a state change callback.
   */
  onStateChange(callback: StateChangeCallback): () => void {
    this.stateCallbacks.add(callback);
    return () => this.stateCallbacks.delete(callback);
  }

  /**
   * Registers a phase change callback.
   */
  onPhaseChange(callback: PhaseChangeCallback): () => void {
    this.phaseCallbacks.add(callback);
    return () => this.phaseCallbacks.delete(callback);
  }

  /**
   * Registers a complete callback.
   */
  onComplete(callback: CompleteCallback): () => void {
    this.completeCallbacks.add(callback);
    return () => this.completeCallbacks.delete(callback);
  }

  private notifyStateChange(): void {
    if (this.disposed) return;

    const state = this.getState();
    for (const callback of this.stateCallbacks) {
      try {
        callback(state);
      } catch (e) {
        console.error("AnimatedProgressBar state callback error:", e);
      }
    }
  }

  private notifyPhaseChange(
    phase: ProgressPhase,
    previousPhase: ProgressPhase
  ): void {
    if (this.disposed) return;

    for (const callback of this.phaseCallbacks) {
      try {
        callback(phase, previousPhase);
      } catch (e) {
        console.error("AnimatedProgressBar phase callback error:", e);
      }
    }
  }

  private notifyComplete(): void {
    if (this.disposed) return;

    for (const callback of this.completeCallbacks) {
      try {
        callback();
      } catch (e) {
        console.error("AnimatedProgressBar complete callback error:", e);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Disposes the progress bar.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.stopAnimation();
    this.stateCallbacks.clear();
    this.phaseCallbacks.clear();
    this.completeCallbacks.clear();
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates an AnimatedProgressBar instance.
 */
export function createAnimatedProgressBar(
  options?: ProgressBarOptions
): AnimatedProgressBar {
  return new AnimatedProgressBar(options);
}

// =============================================================================
// Iframe Script
// =============================================================================

/**
 * Script to inject into iframe for progress bar rendering.
 */
export const PROGRESS_BAR_SCRIPT = `
(function() {
  if (window.__PLATXA_PROGRESS_BAR__) return;

  const style = document.createElement('style');
  style.textContent = \`
    @keyframes progress-stripes {
      0% { background-position: 1rem 0; }
      100% { background-position: 0 0; }
    }
    @keyframes progress-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    @keyframes progress-shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    @keyframes indeterminate {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(400%); }
    }
  \`;
  document.head.appendChild(style);

  window.__PLATXA_PROGRESS_BAR__ = {
    initialized: true,
    update: function(progress, phase) {
      const bar = document.querySelector('[data-platxa-progress-bar]');
      if (!bar) return;

      bar.style.width = progress + '%';
      bar.dataset.phase = phase;
    }
  };
})();
`;

// =============================================================================
// Export
// =============================================================================

export default AnimatedProgressBar;
