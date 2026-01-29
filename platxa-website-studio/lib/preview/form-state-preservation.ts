/**
 * Form State Preservation - Preserves input state during morphdom updates
 *
 * Ensures form inputs maintain their values and focus state during HMR updates
 * by excluding active elements from morph and restoring values after updates.
 *
 * @module preview/form-state-preservation
 */

// =============================================================================
// Types
// =============================================================================

/** Types of form elements to preserve */
export type FormElementType =
  | 'input'
  | 'textarea'
  | 'select'
  | 'contenteditable';

/** Preserved state for a form element */
export interface FormElementState {
  /** Element selector/identifier */
  selector: string;
  /** Element type */
  type: FormElementType;
  /** Input type attribute (for inputs) */
  inputType?: string;
  /** Current value */
  value: string;
  /** For checkboxes/radios */
  checked?: boolean;
  /** Selected options (for multi-select) */
  selectedOptions?: string[];
  /** Cursor/selection start position */
  selectionStart?: number;
  /** Cursor/selection end position */
  selectionEnd?: number;
  /** Selection direction */
  selectionDirection?: 'forward' | 'backward' | 'none';
  /** Whether element is focused */
  isFocused: boolean;
  /** Element name attribute */
  name?: string;
  /** Element id attribute */
  id?: string;
  /** Capture timestamp */
  capturedAt: number;
}

/** Snapshot of all form states */
export interface FormStateSnapshot {
  /** Snapshot ID */
  id: string;
  /** All captured form states */
  states: FormElementState[];
  /** Active/focused element selector */
  activeElement: string | null;
  /** Timestamp */
  timestamp: number;
}

/** Options for morphdom integration */
export interface MorphdomOptions {
  /** Custom function to check if element should skip morph */
  onBeforeElUpdated?: (fromEl: Element, toEl: Element) => boolean;
}

/** Result of state restoration */
export interface RestoreResult {
  /** Whether restoration was successful */
  success: boolean;
  /** Number of elements restored */
  restoredCount: number;
  /** Elements that couldn't be restored */
  failedElements: string[];
  /** Time taken in ms */
  restoreTimeMs: number;
}

/** Configuration for FormStatePreserver */
export interface FormStatePreserverConfig {
  /** Selectors to always preserve (default: standard form elements) */
  preserveSelectors?: string[];
  /** Whether to preserve focus (default: true) */
  preserveFocus?: boolean;
  /** Whether to preserve selection/cursor (default: true) */
  preserveSelection?: boolean;
  /** Whether to preserve scroll within inputs (default: true) */
  preserveScroll?: boolean;
  /** Enable debug logging */
  debug?: boolean;
}

// =============================================================================
// Form State Preserver Class
// =============================================================================

/**
 * FormStatePreserver - Preserves form input state during morphdom updates
 *
 * Feature #64: Active input elements excluded from morph; values preserved
 *
 * @example
 * ```typescript
 * const preserver = new FormStatePreserver();
 *
 * // Get morphdom options that exclude active inputs
 * const morphOptions = preserver.getMorphdomOptions();
 *
 * // Capture state before morph
 * preserver.capture();
 *
 * // Perform morphdom update
 * morphdom(oldNode, newNode, morphOptions);
 *
 * // Restore values and focus
 * preserver.restore();
 * ```
 */
export class FormStatePreserver {
  private config: Required<FormStatePreserverConfig>;
  private lastSnapshot: FormStateSnapshot | null = null;
  private snapshotIdCounter = 0;

  constructor(config: FormStatePreserverConfig = {}) {
    this.config = {
      preserveSelectors: config.preserveSelectors ?? [
        'input',
        'textarea',
        'select',
        '[contenteditable="true"]',
        '[contenteditable=""]',
      ],
      preserveFocus: config.preserveFocus ?? true,
      preserveSelection: config.preserveSelection ?? true,
      preserveScroll: config.preserveScroll ?? true,
      debug: config.debug ?? false,
    };
  }

  /**
   * Get morphdom options that exclude active input elements from morphing
   *
   * This is the key function for Feature #64 - prevents morphdom from
   * overwriting the element the user is currently typing in.
   */
  getMorphdomOptions(): MorphdomOptions {
    return {
      onBeforeElUpdated: (fromEl: Element, toEl: Element): boolean => {
        // Check if this is a form element
        if (!this.isFormElement(fromEl)) {
          return true; // Allow morph for non-form elements
        }

        // Check if element is focused (active)
        if (typeof document !== 'undefined' && document.activeElement === fromEl) {
          this.log(`Excluding active element from morph: ${this.getElementSelector(fromEl)}`);
          return false; // Skip morph for active/focused element
        }

        // For form elements, preserve value even if not focused
        if (this.shouldPreserveValue(fromEl, toEl)) {
          this.transferValue(fromEl, toEl);
        }

        return true; // Allow morph but with preserved value
      },
    };
  }

  /**
   * Capture current form state for all form elements
   */
  capture(container?: Element): FormStateSnapshot {
    const root = container ?? (typeof document !== 'undefined' ? document.body : null);
    const states: FormElementState[] = [];
    let activeElement: string | null = null;

    if (!root) {
      return this.createEmptySnapshot();
    }

    // Find active element
    if (typeof document !== 'undefined' && document.activeElement) {
      const active = document.activeElement;
      if (this.isFormElement(active)) {
        activeElement = this.getElementSelector(active);
      }
    }

    // Capture all form elements
    for (const selector of this.config.preserveSelectors) {
      const elements = root.querySelectorAll(selector);
      elements.forEach((el) => {
        const state = this.captureElementState(el);
        if (state) {
          states.push(state);
        }
      });
    }

    const snapshot: FormStateSnapshot = {
      id: `form-snap-${++this.snapshotIdCounter}`,
      states,
      activeElement,
      timestamp: Date.now(),
    };

    this.lastSnapshot = snapshot;
    this.log(`Captured ${states.length} form element states`);

    return snapshot;
  }

  /**
   * Capture state for a single element
   */
  captureElementState(element: Element): FormElementState | null {
    if (!this.isFormElement(element)) return null;

    const selector = this.getElementSelector(element);
    const isFocused = typeof document !== 'undefined' && document.activeElement === element;

    const state: FormElementState = {
      selector,
      type: this.getElementType(element),
      isFocused,
      capturedAt: Date.now(),
      value: '',
    };

    // Get value based on element type
    if (element instanceof HTMLInputElement) {
      state.inputType = element.type;
      state.name = element.name || undefined;
      state.id = element.id || undefined;

      if (element.type === 'checkbox' || element.type === 'radio') {
        state.checked = element.checked;
        state.value = element.value;
      } else {
        state.value = element.value;

        // Capture selection for text inputs
        if (this.config.preserveSelection && this.supportsSelection(element)) {
          state.selectionStart = element.selectionStart ?? undefined;
          state.selectionEnd = element.selectionEnd ?? undefined;
          state.selectionDirection = element.selectionDirection as FormElementState['selectionDirection'];
        }
      }
    } else if (element instanceof HTMLTextAreaElement) {
      state.value = element.value;
      state.name = element.name || undefined;
      state.id = element.id || undefined;

      if (this.config.preserveSelection) {
        state.selectionStart = element.selectionStart ?? undefined;
        state.selectionEnd = element.selectionEnd ?? undefined;
        state.selectionDirection = element.selectionDirection as FormElementState['selectionDirection'];
      }
    } else if (element instanceof HTMLSelectElement) {
      state.value = element.value;
      state.name = element.name || undefined;
      state.id = element.id || undefined;

      if (element.multiple) {
        state.selectedOptions = Array.from(element.selectedOptions).map((opt) => opt.value);
      }
    } else if (element.hasAttribute('contenteditable')) {
      state.value = element.innerHTML;
      state.id = element.id || undefined;
    }

    return state;
  }

  /**
   * Restore form state from last snapshot
   */
  restore(container?: Element): RestoreResult {
    const startTime = performance.now();
    const root = container ?? (typeof document !== 'undefined' ? document.body : null);
    let restoredCount = 0;
    const failedElements: string[] = [];

    if (!this.lastSnapshot || !root) {
      return {
        success: false,
        restoredCount: 0,
        failedElements: [],
        restoreTimeMs: performance.now() - startTime,
      };
    }

    // Restore each element's state
    for (const state of this.lastSnapshot.states) {
      const element = this.findElement(root, state);
      if (element) {
        this.restoreElementState(element, state);
        restoredCount++;
      } else {
        failedElements.push(state.selector);
      }
    }

    // Restore focus
    if (this.config.preserveFocus && this.lastSnapshot.activeElement) {
      const activeEl = root.querySelector(this.lastSnapshot.activeElement);
      if (activeEl instanceof HTMLElement) {
        activeEl.focus();
        this.log(`Restored focus to ${this.lastSnapshot.activeElement}`);
      }
    }

    const restoreTimeMs = performance.now() - startTime;
    this.log(`Restored ${restoredCount}/${this.lastSnapshot.states.length} elements in ${restoreTimeMs.toFixed(2)}ms`);

    return {
      success: failedElements.length === 0,
      restoredCount,
      failedElements,
      restoreTimeMs,
    };
  }

  /**
   * Restore state for a single element
   */
  restoreElementState(element: Element, state: FormElementState): boolean {
    try {
      if (element instanceof HTMLInputElement) {
        if (state.inputType === 'checkbox' || state.inputType === 'radio') {
          element.checked = state.checked ?? false;
        } else {
          element.value = state.value;
        }

        // Restore selection
        if (this.config.preserveSelection && this.supportsSelection(element)) {
          if (state.selectionStart !== undefined && state.selectionEnd !== undefined) {
            element.setSelectionRange(
              state.selectionStart,
              state.selectionEnd,
              state.selectionDirection || undefined
            );
          }
        }
      } else if (element instanceof HTMLTextAreaElement) {
        element.value = state.value;

        if (this.config.preserveSelection) {
          if (state.selectionStart !== undefined && state.selectionEnd !== undefined) {
            element.setSelectionRange(
              state.selectionStart,
              state.selectionEnd,
              state.selectionDirection || undefined
            );
          }
        }
      } else if (element instanceof HTMLSelectElement) {
        if (state.selectedOptions && element.multiple) {
          Array.from(element.options).forEach((opt) => {
            opt.selected = state.selectedOptions!.includes(opt.value);
          });
        } else {
          element.value = state.value;
        }
      } else if (element.hasAttribute('contenteditable')) {
        element.innerHTML = state.value;
      }

      return true;
    } catch (error) {
      this.log(`Failed to restore ${state.selector}: ${error}`);
      return false;
    }
  }

  /**
   * Get last captured snapshot
   */
  getLastSnapshot(): FormStateSnapshot | null {
    return this.lastSnapshot;
  }

  /**
   * Clear captured state
   */
  clear(): void {
    this.lastSnapshot = null;
  }

  /**
   * Wrap morphdom with automatic state preservation
   */
  wrapMorphdom<T extends (fromNode: Node, toNode: Node | string, options?: unknown) => Node>(
    morphdom: T
  ): T {
    const morphOptions = this.getMorphdomOptions();

    return ((fromNode: Node, toNode: Node | string, options?: Record<string, unknown>) => {
      this.capture(fromNode instanceof Element ? fromNode : undefined);

      const mergedOptions = {
        ...options,
        onBeforeElUpdated: (fromEl: Element, toEl: Element): boolean => {
          // Call our handler first
          const ourResult = morphOptions.onBeforeElUpdated?.(fromEl, toEl);
          if (ourResult === false) return false;

          // Call user's handler if provided
          const userHandler = options?.onBeforeElUpdated as ((f: Element, t: Element) => boolean) | undefined;
          if (userHandler) {
            return userHandler(fromEl, toEl);
          }

          return true;
        },
      };

      const result = morphdom(fromNode, toNode, mergedOptions);

      // Use requestAnimationFrame to restore after DOM update
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => this.restore());
      } else {
        this.restore();
      }

      return result;
    }) as T;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private isFormElement(element: Element): boolean {
    return (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement ||
      element.hasAttribute('contenteditable')
    );
  }

  private getElementType(element: Element): FormElementType {
    if (element instanceof HTMLInputElement) return 'input';
    if (element instanceof HTMLTextAreaElement) return 'textarea';
    if (element instanceof HTMLSelectElement) return 'select';
    if (element.hasAttribute('contenteditable')) return 'contenteditable';
    return 'input';
  }

  private getElementSelector(element: Element): string {
    // Try ID first
    if (element.id) {
      return `#${element.id}`;
    }

    // Try name for form elements
    if (element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement) {
      if (element.name) {
        return `[name="${element.name}"]`;
      }
    }

    // Fall back to path-based selector
    return this.getElementPath(element);
  }

  private getElementPath(element: Element): string {
    const path: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector = `#${current.id}`;
        path.unshift(selector);
        break;
      }

      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (child) => child.tagName === current!.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }

      path.unshift(selector);
      current = parent;
    }

    return path.join(' > ');
  }

  private findElement(root: Element, state: FormElementState): Element | null {
    // Try by ID first
    if (state.id) {
      const byId = root.querySelector(`#${state.id}`);
      if (byId) return byId;
    }

    // Try by name
    if (state.name) {
      const byName = root.querySelector(`[name="${state.name}"]`);
      if (byName) return byName;
    }

    // Try by selector
    try {
      return root.querySelector(state.selector);
    } catch {
      return null;
    }
  }

  private supportsSelection(element: HTMLInputElement): boolean {
    const nonSelectableTypes = ['checkbox', 'radio', 'hidden', 'submit', 'button', 'reset', 'file', 'image'];
    return !nonSelectableTypes.includes(element.type);
  }

  private shouldPreserveValue(fromEl: Element, toEl: Element): boolean {
    // Preserve if the element has user input
    if (fromEl instanceof HTMLInputElement || fromEl instanceof HTMLTextAreaElement) {
      return fromEl.value !== (fromEl as HTMLInputElement).defaultValue;
    }
    return false;
  }

  private transferValue(fromEl: Element, toEl: Element): void {
    if (fromEl instanceof HTMLInputElement && toEl instanceof HTMLInputElement) {
      toEl.value = fromEl.value;
      if (fromEl.type === 'checkbox' || fromEl.type === 'radio') {
        toEl.checked = fromEl.checked;
      }
    } else if (fromEl instanceof HTMLTextAreaElement && toEl instanceof HTMLTextAreaElement) {
      toEl.value = fromEl.value;
    } else if (fromEl instanceof HTMLSelectElement && toEl instanceof HTMLSelectElement) {
      toEl.value = fromEl.value;
    }
  }

  private createEmptySnapshot(): FormStateSnapshot {
    return {
      id: `form-snap-${++this.snapshotIdCounter}`,
      states: [],
      activeElement: null,
      timestamp: Date.now(),
    };
  }

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[FormStatePreserver] ${message}`);
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new FormStatePreserver
 */
export function createFormStatePreserver(config?: FormStatePreserverConfig): FormStatePreserver {
  return new FormStatePreserver(config);
}

/**
 * Create morphdom options that preserve active inputs
 */
export function createPreservingMorphOptions(): MorphdomOptions {
  return new FormStatePreserver().getMorphdomOptions();
}

// =============================================================================
// Exports
// =============================================================================

export default FormStatePreserver;
