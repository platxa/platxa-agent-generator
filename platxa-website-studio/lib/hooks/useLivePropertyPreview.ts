/**
 * useLivePropertyPreview — Real-time Property Preview Hook
 *
 * Production-grade hook for live CSS property updates in the preview iframe.
 * Changes are applied instantly via HMR injection without full reload.
 *
 * Features:
 * - Instant CSS injection for style changes
 * - Debounced updates to prevent thrashing
 * - Optimistic updates with rollback on error
 * - Batch multiple changes
 * - Type-safe property mapping
 */

import { useCallback, useRef, useEffect, useState } from "react";
import type { HMRRuntimeController } from "@/lib/preview/hmr-runtime";

// =============================================================================
// Types
// =============================================================================

export type CSSPropertyType =
  | "color"
  | "backgroundColor"
  | "borderColor"
  | "fontSize"
  | "fontWeight"
  | "fontFamily"
  | "padding"
  | "margin"
  | "borderRadius"
  | "boxShadow"
  | "opacity"
  | "width"
  | "height"
  | "gap"
  | "lineHeight"
  | "letterSpacing"
  | "textAlign"
  | "display"
  | "flexDirection"
  | "justifyContent"
  | "alignItems";

export interface PropertyUpdate {
  /** CSS selector for the element */
  selector: string;
  /** CSS property name (camelCase) */
  property: CSSPropertyType | string;
  /** New value */
  value: string;
  /** Previous value for rollback */
  previousValue?: string;
}

export interface LivePreviewState {
  /** Whether updates are being applied */
  isApplying: boolean;
  /** Pending updates count */
  pendingCount: number;
  /** Last applied timestamp */
  lastApplied: number | null;
  /** Error if last update failed */
  error: string | null;
}

export interface UseLivePropertyPreviewOptions {
  /** HMR controller reference */
  hmrController: React.RefObject<HMRRuntimeController | null>;
  /** Debounce delay in ms (default: 16 for 60fps) */
  debounceMs?: number;
  /** Callback when update is applied */
  onApplied?: (updates: PropertyUpdate[]) => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

export interface UseLivePropertyPreviewResult {
  /** Current state */
  state: LivePreviewState;
  /** Update a single property */
  updateProperty: (update: PropertyUpdate) => void;
  /** Update multiple properties at once */
  batchUpdate: (updates: PropertyUpdate[]) => void;
  /** Rollback last change */
  rollback: () => void;
  /** Clear all pending updates */
  clearPending: () => void;
  /** Generate CSS from current updates */
  generateCSS: () => string;
}

// =============================================================================
// CSS Utilities
// =============================================================================

/** Convert camelCase to kebab-case */
function toKebabCase(str: string): string {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}

/** Generate CSS rule from property update */
function generateCSSRule(update: PropertyUpdate): string {
  const property = toKebabCase(update.property);
  return `${update.selector} { ${property}: ${update.value} !important; }`;
}

/** Generate combined CSS from multiple updates */
function generateCombinedCSS(updates: PropertyUpdate[]): string {
  // Group by selector for efficiency
  const bySelector = new Map<string, Map<string, string>>();

  for (const update of updates) {
    if (!bySelector.has(update.selector)) {
      bySelector.set(update.selector, new Map());
    }
    bySelector.get(update.selector)!.set(update.property, update.value);
  }

  const rules: string[] = [];
  for (const [selector, properties] of bySelector) {
    const declarations = Array.from(properties.entries())
      .map(([prop, val]) => `${toKebabCase(prop)}: ${val} !important`)
      .join("; ");
    rules.push(`${selector} { ${declarations}; }`);
  }

  return rules.join("\n");
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useLivePropertyPreview(
  options: UseLivePropertyPreviewOptions
): UseLivePropertyPreviewResult {
  const { hmrController, debounceMs = 16, onApplied, onError } = options;

  // State
  const [state, setState] = useState<LivePreviewState>({
    isApplying: false,
    pendingCount: 0,
    lastApplied: null,
    error: null,
  });

  // Refs for batching and history
  const pendingUpdates = useRef<PropertyUpdate[]>([]);
  const appliedUpdates = useRef<PropertyUpdate[]>([]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const styleId = useRef("platxa-live-preview-" + Date.now().toString(36));

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // Apply pending updates to iframe via HMR
  const applyUpdates = useCallback(() => {
    if (pendingUpdates.current.length === 0) return;

    const controller = hmrController.current;
    if (!controller?.isReady()) {
      setState((prev) => ({
        ...prev,
        error: "Preview not ready for live updates",
      }));
      onError?.("Preview not ready for live updates");
      return;
    }

    setState((prev) => ({ ...prev, isApplying: true, error: null }));

    try {
      // Generate CSS from all pending updates
      const css = generateCombinedCSS(pendingUpdates.current);

      // Inject via HMR
      controller.injectCss(css, styleId.current);

      // Store for rollback
      appliedUpdates.current = [...pendingUpdates.current];

      // Clear pending
      const appliedCount = pendingUpdates.current.length;
      pendingUpdates.current = [];

      setState({
        isApplying: false,
        pendingCount: 0,
        lastApplied: Date.now(),
        error: null,
      });

      onApplied?.(appliedUpdates.current);

      console.log(`[LivePreview] Applied ${appliedCount} property updates`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to apply updates";
      setState((prev) => ({
        ...prev,
        isApplying: false,
        error: message,
      }));
      onError?.(message);
    }
  }, [hmrController, onApplied, onError]);

  // Schedule debounced apply
  const scheduleApply = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    setState((prev) => ({
      ...prev,
      pendingCount: pendingUpdates.current.length,
    }));

    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      applyUpdates();
    }, debounceMs);
  }, [applyUpdates, debounceMs]);

  // Update a single property
  const updateProperty = useCallback(
    (update: PropertyUpdate) => {
      // Check if this property was already updated - replace it
      const existingIndex = pendingUpdates.current.findIndex(
        (u) => u.selector === update.selector && u.property === update.property
      );

      if (existingIndex >= 0) {
        pendingUpdates.current[existingIndex] = update;
      } else {
        pendingUpdates.current.push(update);
      }

      scheduleApply();
    },
    [scheduleApply]
  );

  // Batch update multiple properties
  const batchUpdate = useCallback(
    (updates: PropertyUpdate[]) => {
      for (const update of updates) {
        const existingIndex = pendingUpdates.current.findIndex(
          (u) => u.selector === update.selector && u.property === update.property
        );

        if (existingIndex >= 0) {
          pendingUpdates.current[existingIndex] = update;
        } else {
          pendingUpdates.current.push(update);
        }
      }

      scheduleApply();
    },
    [scheduleApply]
  );

  // Rollback to previous values
  const rollback = useCallback(() => {
    if (appliedUpdates.current.length === 0) return;

    const controller = hmrController.current;
    if (!controller?.isReady()) return;

    // Generate rollback CSS from previous values
    const rollbackUpdates = appliedUpdates.current
      .filter((u) => u.previousValue !== undefined)
      .map((u) => ({
        ...u,
        value: u.previousValue!,
      }));

    if (rollbackUpdates.length > 0) {
      const css = generateCombinedCSS(rollbackUpdates);
      controller.injectCss(css, styleId.current);
      console.log(`[LivePreview] Rolled back ${rollbackUpdates.length} changes`);
    }

    appliedUpdates.current = [];
  }, [hmrController]);

  // Clear pending updates
  const clearPending = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    pendingUpdates.current = [];
    setState((prev) => ({ ...prev, pendingCount: 0 }));
  }, []);

  // Generate CSS without applying
  const generateCSS = useCallback(() => {
    return generateCombinedCSS([...appliedUpdates.current, ...pendingUpdates.current]);
  }, []);

  return {
    state,
    updateProperty,
    batchUpdate,
    rollback,
    clearPending,
    generateCSS,
  };
}

// =============================================================================
// Convenience Hooks
// =============================================================================

/**
 * Hook for specific property type updates
 */
export function useColorPreview(
  hmrController: React.RefObject<HMRRuntimeController | null>,
  selector: string
) {
  const preview = useLivePropertyPreview({ hmrController });

  return {
    setColor: (color: string, previousValue?: string) =>
      preview.updateProperty({
        selector,
        property: "color",
        value: color,
        previousValue,
      }),
    setBackgroundColor: (color: string, previousValue?: string) =>
      preview.updateProperty({
        selector,
        property: "backgroundColor",
        value: color,
        previousValue,
      }),
    setBorderColor: (color: string, previousValue?: string) =>
      preview.updateProperty({
        selector,
        property: "borderColor",
        value: color,
        previousValue,
      }),
    rollback: preview.rollback,
    state: preview.state,
  };
}

/**
 * Hook for spacing property updates
 */
export function useSpacingPreview(
  hmrController: React.RefObject<HMRRuntimeController | null>,
  selector: string
) {
  const preview = useLivePropertyPreview({ hmrController });

  return {
    setPadding: (value: string, previousValue?: string) =>
      preview.updateProperty({
        selector,
        property: "padding",
        value,
        previousValue,
      }),
    setMargin: (value: string, previousValue?: string) =>
      preview.updateProperty({
        selector,
        property: "margin",
        value,
        previousValue,
      }),
    setGap: (value: string, previousValue?: string) =>
      preview.updateProperty({
        selector,
        property: "gap",
        value,
        previousValue,
      }),
    rollback: preview.rollback,
    state: preview.state,
  };
}

// =============================================================================
// Export
// =============================================================================

export default useLivePropertyPreview;
