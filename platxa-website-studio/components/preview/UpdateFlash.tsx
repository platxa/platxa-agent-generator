"use client";

/**
 * UpdateFlash - Visual feedback animation for changed sections
 *
 * Feature #65: Create update flash animation for visual feedback on changed sections
 * Verification: Updated sections flash with subtle highlight for 300ms
 *
 * Provides visual indication when content is updated via HMR or streaming,
 * with a subtle highlight animation that draws attention without being distracting.
 *
 * @module components/preview/UpdateFlash
 */

import {
  useEffect,
  useState,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
  type ReactNode,
  type CSSProperties,
} from "react";
import { cn } from "@/lib/utils/cn";

// ============================================================================
// Types
// ============================================================================

/** Flash configuration options */
export interface FlashConfig {
  /** Duration of the flash animation in milliseconds (default: 300) */
  duration?: number;
  /** Flash color (default: theme primary with opacity) */
  color?: string;
  /** Flash intensity (0-1, default: 0.3) */
  intensity?: number;
  /** Easing function (default: ease-out) */
  easing?: string;
  /** Whether to flash on mount (default: false) */
  flashOnMount?: boolean;
  /** Delay before flash starts in ms (default: 0) */
  delay?: number;
}

/** Props for UpdateFlash component */
export interface UpdateFlashProps {
  /** Child content to wrap */
  children: ReactNode;
  /** Whether content has been updated (triggers flash) */
  isUpdated?: boolean;
  /** Unique key to trigger flash on change */
  updateKey?: string | number;
  /** Flash configuration */
  config?: FlashConfig;
  /** Additional class name */
  className?: string;
  /** Additional styles */
  style?: CSSProperties;
  /** Callback when flash animation starts */
  onFlashStart?: () => void;
  /** Callback when flash animation ends */
  onFlashEnd?: () => void;
  /** Disable flash animation */
  disabled?: boolean;
  /** HTML element type (default: div) */
  as?: keyof JSX.IntrinsicElements;
}

/** Flash state for tracking animation */
export type FlashState = "idle" | "flashing" | "fading";

/** Imperative handle for UpdateFlash */
export interface UpdateFlashHandle {
  /** Trigger flash manually */
  flash: () => void;
  /** Get current flash state */
  getState: () => FlashState;
  /** Cancel ongoing flash */
  cancel: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Default flash configuration */
const DEFAULT_CONFIG: Required<FlashConfig> = {
  duration: 300,
  color: "var(--flash-highlight, rgba(59, 130, 246, 0.3))",
  intensity: 0.3,
  easing: "ease-out",
  flashOnMount: false,
  delay: 0,
};

/** CSS custom properties for theming */
export const FLASH_CSS_VARS = {
  /** Primary flash highlight color */
  highlight: "--flash-highlight",
  /** Success flash color */
  success: "--flash-success",
  /** Warning flash color */
  warning: "--flash-warning",
  /** Error flash color */
  error: "--flash-error",
} as const;

// ============================================================================
// Component
// ============================================================================

/**
 * UpdateFlash - Wrapper component that flashes when content updates
 *
 * @example
 * ```tsx
 * // Flash on prop change
 * <UpdateFlash isUpdated={hasChanged}>
 *   <MyComponent />
 * </UpdateFlash>
 *
 * // Flash on key change
 * <UpdateFlash updateKey={content.version}>
 *   <ContentDisplay content={content} />
 * </UpdateFlash>
 *
 * // Manual control with ref
 * const flashRef = useRef<UpdateFlashHandle>(null);
 * <UpdateFlash ref={flashRef}>
 *   <MyComponent />
 * </UpdateFlash>
 * flashRef.current?.flash();
 *
 * // Custom configuration
 * <UpdateFlash
 *   config={{ duration: 500, color: 'rgba(34, 197, 94, 0.4)' }}
 *   isUpdated={saved}
 * >
 *   <SavedIndicator />
 * </UpdateFlash>
 * ```
 */
export const UpdateFlash = forwardRef<UpdateFlashHandle, UpdateFlashProps>(
  function UpdateFlash(
    {
      children,
      isUpdated,
      updateKey,
      config = {},
      className,
      style,
      onFlashStart,
      onFlashEnd,
      disabled = false,
      as: Element = "div",
    },
    ref
  ) {
    const [flashState, setFlashState] = useState<FlashState>("idle");
    const [isFlashing, setIsFlashing] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
    const prevKeyRef = useRef(updateKey);
    const mountedRef = useRef(false);

    // Merge config with defaults
    const mergedConfig: Required<FlashConfig> = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    // Trigger flash animation
    const triggerFlash = useCallback(() => {
      if (disabled) return;

      // Cancel any existing animation
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Start flash after delay
      const startFlash = () => {
        setFlashState("flashing");
        setIsFlashing(true);
        onFlashStart?.();

        // Transition to fading
        timeoutRef.current = setTimeout(() => {
          setFlashState("fading");

          // End animation
          timeoutRef.current = setTimeout(() => {
            setFlashState("idle");
            setIsFlashing(false);
            onFlashEnd?.();
          }, mergedConfig.duration);
        }, 50); // Brief hold at peak
      };

      if (mergedConfig.delay > 0) {
        timeoutRef.current = setTimeout(startFlash, mergedConfig.delay);
      } else {
        startFlash();
      }
    }, [disabled, mergedConfig.delay, mergedConfig.duration, onFlashStart, onFlashEnd]);

    // Cancel animation
    const cancelFlash = useCallback(() => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setFlashState("idle");
      setIsFlashing(false);
    }, []);

    // Expose imperative handle
    useImperativeHandle(
      ref,
      () => ({
        flash: triggerFlash,
        getState: () => flashState,
        cancel: cancelFlash,
      }),
      [triggerFlash, flashState, cancelFlash]
    );

    // Flash on isUpdated prop change
    useEffect(() => {
      if (isUpdated && mountedRef.current) {
        triggerFlash();
      }
    }, [isUpdated, triggerFlash]);

    // Flash on updateKey change
    useEffect(() => {
      if (mountedRef.current && updateKey !== prevKeyRef.current) {
        triggerFlash();
      }
      prevKeyRef.current = updateKey;
    }, [updateKey, triggerFlash]);

    // Flash on mount if configured
    useEffect(() => {
      if (mergedConfig.flashOnMount) {
        triggerFlash();
      }
      mountedRef.current = true;

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Calculate animation styles
    const animationStyle: CSSProperties = isFlashing
      ? {
          boxShadow:
            flashState === "flashing"
              ? `inset 0 0 0 2000px ${mergedConfig.color}`
              : "none",
          transition: `box-shadow ${mergedConfig.duration}ms ${mergedConfig.easing}`,
        }
      : {};

    return (
      <Element
        className={cn(
          "update-flash",
          isFlashing && "update-flash--active",
          flashState === "flashing" && "update-flash--peak",
          flashState === "fading" && "update-flash--fading",
          className
        )}
        style={{
          position: "relative",
          ...animationStyle,
          ...style,
        }}
        data-flash-state={flashState}
      >
        {children}
      </Element>
    );
  }
);

// ============================================================================
// Hook
// ============================================================================

/** Options for useUpdateFlash hook */
export interface UseUpdateFlashOptions extends FlashConfig {
  /** Initial flash state */
  initialState?: FlashState;
}

/** Return type for useUpdateFlash hook */
export interface UseUpdateFlashReturn {
  /** Current flash state */
  state: FlashState;
  /** Whether currently flashing */
  isFlashing: boolean;
  /** Trigger flash animation */
  flash: () => void;
  /** Cancel flash animation */
  cancel: () => void;
  /** Props to spread on target element */
  flashProps: {
    className: string;
    style: CSSProperties;
    "data-flash-state": FlashState;
  };
}

/**
 * Hook for managing flash animation state
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { flash, flashProps, isFlashing } = useUpdateFlash({
 *     duration: 300,
 *     color: 'rgba(59, 130, 246, 0.3)',
 *   });
 *
 *   const handleUpdate = () => {
 *     updateContent();
 *     flash();
 *   };
 *
 *   return (
 *     <div {...flashProps}>
 *       <button onClick={handleUpdate}>Update</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useUpdateFlash(
  options: UseUpdateFlashOptions = {}
): UseUpdateFlashReturn {
  const [state, setState] = useState<FlashState>(options.initialState ?? "idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const config: Required<FlashConfig> = {
    ...DEFAULT_CONFIG,
    ...options,
  };

  const flash = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const startFlash = () => {
      setState("flashing");

      timeoutRef.current = setTimeout(() => {
        setState("fading");

        timeoutRef.current = setTimeout(() => {
          setState("idle");
        }, config.duration);
      }, 50);
    };

    if (config.delay > 0) {
      timeoutRef.current = setTimeout(startFlash, config.delay);
    } else {
      startFlash();
    }
  }, [config.delay, config.duration]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setState("idle");
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const isFlashing = state !== "idle";

  const flashProps = {
    className: cn(
      "update-flash",
      isFlashing && "update-flash--active",
      state === "flashing" && "update-flash--peak",
      state === "fading" && "update-flash--fading"
    ),
    style: {
      position: "relative" as const,
      boxShadow:
        state === "flashing"
          ? `inset 0 0 0 2000px ${config.color}`
          : "none",
      transition: `box-shadow ${config.duration}ms ${config.easing}`,
    },
    "data-flash-state": state,
  };

  return {
    state,
    isFlashing,
    flash,
    cancel,
    flashProps,
  };
}

// ============================================================================
// Preset Configurations
// ============================================================================

/** Preset flash configurations for common use cases */
export const FlashPresets = {
  /** Default subtle highlight (300ms, blue) */
  default: {
    duration: 300,
    color: "rgba(59, 130, 246, 0.3)",
    intensity: 0.3,
    easing: "ease-out",
  } as FlashConfig,

  /** Success indicator (300ms, green) */
  success: {
    duration: 300,
    color: "rgba(34, 197, 94, 0.3)",
    intensity: 0.3,
    easing: "ease-out",
  } as FlashConfig,

  /** Warning indicator (400ms, amber) */
  warning: {
    duration: 400,
    color: "rgba(245, 158, 11, 0.3)",
    intensity: 0.35,
    easing: "ease-out",
  } as FlashConfig,

  /** Error indicator (400ms, red) */
  error: {
    duration: 400,
    color: "rgba(239, 68, 68, 0.3)",
    intensity: 0.4,
    easing: "ease-out",
  } as FlashConfig,

  /** Quick flash (150ms, subtle) */
  quick: {
    duration: 150,
    color: "rgba(59, 130, 246, 0.2)",
    intensity: 0.2,
    easing: "ease-out",
  } as FlashConfig,

  /** Slow attention-grabbing flash (500ms) */
  attention: {
    duration: 500,
    color: "rgba(139, 92, 246, 0.35)",
    intensity: 0.35,
    easing: "ease-in-out",
  } as FlashConfig,
} as const;

// ============================================================================
// CSS Styles (to be included in global CSS or component CSS module)
// ============================================================================

/**
 * CSS styles for UpdateFlash component
 *
 * Include these in your global CSS or CSS module:
 *
 * ```css
 * .update-flash {
 *   --flash-highlight: rgba(59, 130, 246, 0.3);
 *   --flash-success: rgba(34, 197, 94, 0.3);
 *   --flash-warning: rgba(245, 158, 11, 0.3);
 *   --flash-error: rgba(239, 68, 68, 0.3);
 * }
 *
 * .update-flash--active {
 *   z-index: 1;
 * }
 *
 * .update-flash--peak {
 *   animation: flash-peak 50ms ease-out;
 * }
 *
 * .update-flash--fading {
 *   animation: flash-fade 300ms ease-out;
 * }
 *
 * @keyframes flash-peak {
 *   from { opacity: 0; }
 *   to { opacity: 1; }
 * }
 *
 * @keyframes flash-fade {
 *   from { opacity: 1; }
 *   to { opacity: 0; }
 * }
 * ```
 */
export const UpdateFlashStyles = `
.update-flash {
  --flash-highlight: rgba(59, 130, 246, 0.3);
  --flash-success: rgba(34, 197, 94, 0.3);
  --flash-warning: rgba(245, 158, 11, 0.3);
  --flash-error: rgba(239, 68, 68, 0.3);
}

.update-flash--active {
  z-index: 1;
}

.update-flash--peak {
  animation: flash-peak 50ms ease-out;
}

.update-flash--fading {
  animation: flash-fade 300ms ease-out;
}

@keyframes flash-peak {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes flash-fade {
  from { opacity: 1; }
  to { opacity: 0; }
}
`;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a custom flash configuration
 */
export function createFlashConfig(
  overrides: Partial<FlashConfig>
): FlashConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
  };
}

/**
 * Get flash color for a specific variant
 */
export function getFlashColor(
  variant: "default" | "success" | "warning" | "error"
): string {
  return FlashPresets[variant].color!;
}

// ============================================================================
// Exports
// ============================================================================

export default UpdateFlash;
