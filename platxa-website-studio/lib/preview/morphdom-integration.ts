/**
 * Morphdom Integration — Efficient DOM diffing for HMR preview updates.
 *
 * Provides a configured morphdom instance with hooks for:
 * - Preserving focus state during updates
 * - Skipping animation/transition elements
 * - Custom element update callbacks
 * - Performance optimization via selective updates
 */

import morphdom from "morphdom";

// =============================================================================
// Types
// =============================================================================

/** Options for morphdom diffing */
export interface MorphdomConfig {
  /** Called before updating an element. Return false to skip update. */
  onBeforeElUpdated?: (fromEl: HTMLElement, toEl: HTMLElement) => boolean;
  /** Called after an element is updated */
  onElUpdated?: (el: HTMLElement) => void;
  /** Called before a node is discarded. Return false to skip removal. */
  onBeforeNodeDiscarded?: (node: Node) => boolean;
  /** Called after a node is discarded */
  onNodeDiscarded?: (node: Node) => void;
  /** Called before adding a child. Return false to skip, or return the node to add. */
  onBeforeNodeAdded?: (node: Node) => Node | false;
  /** Called after a node is added */
  onNodeAdded?: (node: Node) => void;
  /** Called before updating element's children. Return false to skip. */
  onBeforeElChildrenUpdated?: (fromEl: HTMLElement, toEl: HTMLElement) => boolean;
  /** Whether to morph the node's children only (default: false) */
  childrenOnly?: boolean;
  /** Whether to preserve focus (default: true) */
  preserveFocus?: boolean;
  /** Whether to skip elements with transitions (default: true) */
  skipTransitions?: boolean;
  /** CSS selector for elements to always skip (default: none) */
  skipSelector?: string;
  /** Whether to preserve form input values (default: true) */
  preserveFormValues?: boolean;
}

/** Result of a morphdom operation */
export interface MorphResult {
  /** Whether the morph completed successfully */
  success: boolean;
  /** Number of elements updated */
  elementsUpdated: number;
  /** Number of elements added */
  elementsAdded: number;
  /** Number of elements removed */
  elementsRemoved: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Error if morph failed */
  error?: string;
}

/** Callback for morph events */
export type MorphCallback = (result: MorphResult) => void;

// =============================================================================
// Default Hooks
// =============================================================================

/**
 * Default onBeforeElUpdated hook that preserves focus and handles transitions.
 */
export function createDefaultBeforeElUpdated(
  config: Pick<MorphdomConfig, "preserveFocus" | "skipTransitions" | "skipSelector" | "preserveFormValues">
): (fromEl: HTMLElement, toEl: HTMLElement) => boolean {
  return (fromEl: HTMLElement, toEl: HTMLElement): boolean => {
    // Preserve focus - don't update the active element
    if (config.preserveFocus !== false && fromEl === document.activeElement) {
      return false;
    }

    // Skip elements with active transitions/animations
    if (config.skipTransitions !== false) {
      const computedStyle = window.getComputedStyle(fromEl);
      const hasTransition = computedStyle.transition !== "none" &&
                           computedStyle.transition !== "" &&
                           computedStyle.transition !== "all 0s ease 0s";
      const hasAnimation = computedStyle.animationName !== "none" &&
                          computedStyle.animationName !== "";

      if (hasTransition || hasAnimation) {
        // Check if element is currently animating
        const animations = fromEl.getAnimations?.();
        if (animations && animations.length > 0) {
          return false;
        }
      }
    }

    // Skip elements matching custom selector
    if (config.skipSelector && fromEl.matches(config.skipSelector)) {
      return false;
    }

    // Preserve form input values
    if (config.preserveFormValues !== false) {
      if (fromEl instanceof HTMLInputElement && toEl instanceof HTMLInputElement) {
        // Preserve checkbox/radio checked state if user interacted
        if (fromEl.type === "checkbox" || fromEl.type === "radio") {
          toEl.checked = fromEl.checked;
        }
        // Preserve text input values
        if (fromEl.type === "text" || fromEl.type === "password" || fromEl.type === "email") {
          toEl.value = fromEl.value;
        }
      }
      if (fromEl instanceof HTMLTextAreaElement && toEl instanceof HTMLTextAreaElement) {
        toEl.value = fromEl.value;
      }
      if (fromEl instanceof HTMLSelectElement && toEl instanceof HTMLSelectElement) {
        toEl.value = fromEl.value;
      }
    }

    return true;
  };
}

/**
 * Creates an onBeforeElUpdated hook that preserves specific attributes.
 */
export function createAttributePreservingHook(
  attributesToPreserve: string[]
): (fromEl: HTMLElement, toEl: HTMLElement) => boolean {
  return (fromEl: HTMLElement, toEl: HTMLElement): boolean => {
    for (const attr of attributesToPreserve) {
      const value = fromEl.getAttribute(attr);
      if (value !== null) {
        toEl.setAttribute(attr, value);
      }
    }
    return true;
  };
}

/**
 * Combines multiple onBeforeElUpdated hooks.
 */
export function combineBeforeElUpdatedHooks(
  ...hooks: Array<(fromEl: HTMLElement, toEl: HTMLElement) => boolean>
): (fromEl: HTMLElement, toEl: HTMLElement) => boolean {
  return (fromEl: HTMLElement, toEl: HTMLElement): boolean => {
    for (const hook of hooks) {
      if (!hook(fromEl, toEl)) {
        return false;
      }
    }
    return true;
  };
}

// =============================================================================
// MorphdomIntegration Class
// =============================================================================

/**
 * Configured morphdom integration for HMR preview updates.
 *
 * @example
 * ```typescript
 * const morpher = new MorphdomIntegration({
 *   preserveFocus: true,
 *   skipTransitions: true,
 * });
 *
 * // Morph an element
 * const result = morpher.morph(targetElement, newHtml);
 *
 * // Morph with callback
 * morpher.morph(targetElement, newHtml, (result) => {
 *   console.log(`Updated ${result.elementsUpdated} elements`);
 * });
 * ```
 */
export class MorphdomIntegration {
  private config: MorphdomConfig;
  private stats = {
    elementsUpdated: 0,
    elementsAdded: 0,
    elementsRemoved: 0,
  };

  constructor(config: MorphdomConfig = {}) {
    this.config = {
      preserveFocus: config.preserveFocus ?? true,
      skipTransitions: config.skipTransitions ?? true,
      preserveFormValues: config.preserveFormValues ?? true,
      ...config,
    };
  }

  /**
   * Morphs a target element to match the given HTML.
   */
  morph(
    target: Element,
    newContent: string | Element,
    callback?: MorphCallback
  ): MorphResult {
    const startTime = performance.now();
    this.resetStats();

    try {
      const options = this.buildMorphdomOptions();

      if (typeof newContent === "string") {
        // Parse HTML string safely via DOMParser
        const parsed = new DOMParser().parseFromString(newContent.trim(), "text/html");
        const newElement = parsed.body.firstElementChild;

        if (!newElement) {
          throw new Error("Invalid HTML: no root element found");
        }

        morphdom(target, newElement, options);
      } else {
        morphdom(target, newContent, options);
      }

      const result: MorphResult = {
        success: true,
        elementsUpdated: this.stats.elementsUpdated,
        elementsAdded: this.stats.elementsAdded,
        elementsRemoved: this.stats.elementsRemoved,
        durationMs: performance.now() - startTime,
      };

      callback?.(result);
      return result;
    } catch (error) {
      const result: MorphResult = {
        success: false,
        elementsUpdated: 0,
        elementsAdded: 0,
        elementsRemoved: 0,
        durationMs: performance.now() - startTime,
        error: (error as Error).message,
      };

      callback?.(result);
      return result;
    }
  }

  /**
   * Morphs only the children of a target element.
   */
  morphChildren(
    target: Element,
    newContent: string | Element,
    callback?: MorphCallback
  ): MorphResult {
    const originalChildrenOnly = this.config.childrenOnly;
    this.config.childrenOnly = true;

    const result = this.morph(target, newContent, callback);

    this.config.childrenOnly = originalChildrenOnly;
    return result;
  }

  /**
   * Gets the current configuration.
   */
  getConfig(): MorphdomConfig {
    return { ...this.config };
  }

  /**
   * Updates the configuration.
   */
  updateConfig(config: Partial<MorphdomConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private buildMorphdomOptions(): Parameters<typeof morphdom>[2] {
    const defaultHook = createDefaultBeforeElUpdated(this.config);

    return {
      childrenOnly: this.config.childrenOnly ?? false,

      onBeforeElUpdated: (fromEl: HTMLElement, toEl: HTMLElement) => {
        this.stats.elementsUpdated++;

        // Run default hook first
        if (!defaultHook(fromEl, toEl)) {
          return false;
        }

        // Run custom hook if provided
        if (this.config.onBeforeElUpdated) {
          return this.config.onBeforeElUpdated(fromEl, toEl);
        }

        return true;
      },

      onElUpdated: (el: HTMLElement) => {
        this.config.onElUpdated?.(el);
      },

      onBeforeNodeDiscarded: (node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          this.stats.elementsRemoved++;
        }
        if (this.config.onBeforeNodeDiscarded) {
          return this.config.onBeforeNodeDiscarded(node);
        }
        return true;
      },

      onNodeDiscarded: this.config.onNodeDiscarded,

      onBeforeNodeAdded: (node: Node) => {
        if (this.config.onBeforeNodeAdded) {
          return this.config.onBeforeNodeAdded(node);
        }
        return node;
      },

      onNodeAdded: (node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          this.stats.elementsAdded++;
        }
        this.config.onNodeAdded?.(node);
      },

      onBeforeElChildrenUpdated: this.config.onBeforeElChildrenUpdated,
    };
  }

  private resetStats(): void {
    this.stats = {
      elementsUpdated: 0,
      elementsAdded: 0,
      elementsRemoved: 0,
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a configured morphdom integration.
 */
export function createMorphdom(config?: MorphdomConfig): MorphdomIntegration {
  return new MorphdomIntegration(config);
}

/**
 * Quick morph function for one-off updates.
 */
export function quickMorph(
  target: Element,
  newContent: string | Element,
  config?: MorphdomConfig
): MorphResult {
  const integration = new MorphdomIntegration(config);
  return integration.morph(target, newContent);
}

/**
 * Direct access to morphdom with default HMR-optimized options.
 * Returns the morphed element (same reference as fromNode after morphing).
 */
export function morphWithDefaults(
  fromNode: Element,
  toNode: Element | string,
  additionalOptions?: Parameters<typeof morphdom>[2]
): Element {
  const defaultHook = createDefaultBeforeElUpdated({
    preserveFocus: true,
    skipTransitions: true,
    preserveFormValues: true,
  });

  const options: Parameters<typeof morphdom>[2] = {
    onBeforeElUpdated: (fromEl, toEl) => {
      if (!defaultHook(fromEl, toEl)) {
        return false;
      }
      return additionalOptions?.onBeforeElUpdated?.(fromEl, toEl) ?? true;
    },
    ...additionalOptions,
  };

  if (typeof toNode === "string") {
    const parsed = new DOMParser().parseFromString(toNode.trim(), "text/html");
    const newElement = parsed.body.firstElementChild;
    if (!newElement) {
      throw new Error("Invalid HTML: no root element found");
    }
    // morphdom returns the morphed node (same as fromNode when tags match)
    return morphdom(fromNode, newElement, options) as Element;
  }

  return morphdom(fromNode, toNode, options) as Element;
}

// Re-export morphdom for direct access
export { morphdom };
