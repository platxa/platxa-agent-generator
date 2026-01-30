/**
 * SectionKeyboardNavigator — Keyboard navigation between sibling sections.
 *
 * Feature #76: Implement keyboard navigation between sections (arrow keys)
 * Verification: Up/down arrows move selection between sibling sections
 *
 * Enables arrow key navigation between sibling sections in the preview iframe.
 * When a section is selected, pressing up/down arrow keys moves selection to
 * the previous/next sibling section at the same DOM level.
 *
 * @module lib/preview/section-keyboard-navigator
 */

import type { SelectModeController, SelectedElement } from "./select-mode";

// =============================================================================
// Types
// =============================================================================

/** Navigation direction */
export type NavigationDirection = "up" | "down" | "first" | "last";

/** Keyboard navigation options */
export interface SectionKeyboardNavigatorOptions {
  /** CSS selector for navigable sections (default: same as SelectModeController) */
  sectionSelector?: string;
  /** Whether to wrap around at boundaries (default: false) */
  wrapAround?: boolean;
  /** Whether to skip hidden/collapsed sections (default: true) */
  skipHidden?: boolean;
  /** Whether navigation is initially enabled (default: true) */
  enabled?: boolean;
  /** Custom key bindings */
  keyBindings?: {
    up?: string[];
    down?: string[];
    first?: string[];
    last?: string[];
  };
}

/** State of the keyboard navigator */
export interface NavigatorState {
  /** Whether navigation is enabled */
  enabled: boolean;
  /** Currently selected section index */
  currentIndex: number;
  /** Total number of navigable sections */
  totalSections: number;
  /** IDs of all navigable sections in order */
  sectionIds: string[];
}

/** Navigation event emitted on navigation */
export interface NavigationEvent {
  /** Direction of navigation */
  direction: NavigationDirection;
  /** Previously selected section */
  from: SelectedElement | null;
  /** Newly selected section */
  to: SelectedElement | null;
  /** Index of the new section */
  index: number;
  /** Total sections */
  total: number;
  /** Timestamp */
  timestamp: number;
}

/** Callback for navigation events */
export type NavigationCallback = (event: NavigationEvent) => void;

// =============================================================================
// SectionKeyboardNavigator Class
// =============================================================================

/**
 * Handles keyboard navigation between sibling sections.
 *
 * @example
 * ```typescript
 * const selectController = new SelectModeController();
 * const navigator = new SectionKeyboardNavigator(selectController, {
 *   wrapAround: true,
 * });
 *
 * // Connect to iframe
 * navigator.connect(iframe);
 *
 * // Listen for navigation events
 * navigator.onNavigation((event) => {
 *   console.log(`Navigated ${event.direction} to section ${event.index}`);
 * });
 *
 * // Clean up
 * navigator.dispose();
 * ```
 */
export class SectionKeyboardNavigator {
  private selectController: SelectModeController;
  private options: Required<SectionKeyboardNavigatorOptions>;
  private iframe: HTMLIFrameElement | null = null;
  private state: NavigatorState;
  private callbacks = new Set<NavigationCallback>();
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private messageHandler: ((e: MessageEvent) => void) | null = null;
  private disposed = false;

  constructor(
    selectController: SelectModeController,
    options: SectionKeyboardNavigatorOptions = {}
  ) {
    this.selectController = selectController;
    this.options = {
      sectionSelector:
        options.sectionSelector ?? selectController.getSelectableSelector(),
      wrapAround: options.wrapAround ?? false,
      skipHidden: options.skipHidden ?? true,
      enabled: options.enabled ?? true,
      keyBindings: options.keyBindings ?? {
        up: ["ArrowUp"],
        down: ["ArrowDown"],
        first: ["Home"],
        last: ["End"],
      },
    };

    this.state = {
      enabled: this.options.enabled,
      currentIndex: -1,
      totalSections: 0,
      sectionIds: [],
    };
  }

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------

  /**
   * Connects to a preview iframe and starts listening for keyboard events.
   */
  connect(iframe: HTMLIFrameElement): void {
    if (this.disposed) {
      throw new Error("SectionKeyboardNavigator has been disposed");
    }

    this.iframe = iframe;

    // Listen for keyboard events on the parent window
    this.keydownHandler = this.handleKeyDown.bind(this);
    window.addEventListener("keydown", this.keydownHandler);

    // Listen for section list updates from iframe
    this.messageHandler = this.handleMessage.bind(this);
    window.addEventListener("message", this.messageHandler);

    // Request initial section list from iframe
    this.requestSectionList();
  }

  /**
   * Disconnects from the iframe and stops listening.
   */
  disconnect(): void {
    if (this.keydownHandler) {
      window.removeEventListener("keydown", this.keydownHandler);
      this.keydownHandler = null;
    }

    if (this.messageHandler) {
      window.removeEventListener("message", this.messageHandler);
      this.messageHandler = null;
    }

    this.iframe = null;
  }

  /**
   * Checks if connected to an iframe.
   */
  isConnected(): boolean {
    return this.iframe !== null;
  }

  // ---------------------------------------------------------------------------
  // Keyboard Handling
  // ---------------------------------------------------------------------------

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.state.enabled || !this.selectController.isEnabled()) return;

    // Don't handle if typing in an input
    if (this.isTypingInInput(event)) return;

    const direction = this.getDirectionFromKey(event.key);
    if (!direction) return;

    // Only navigate if there's a current selection
    const selected = this.selectController.getSelected();
    if (!selected) return;

    event.preventDefault();
    this.navigate(direction);
  }

  private isTypingInInput(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    if (!target || !target.tagName) return false;

    const tagName = target.tagName.toLowerCase();
    return (
      tagName === "input" ||
      tagName === "textarea" ||
      tagName === "select" ||
      target.isContentEditable
    );
  }

  private getDirectionFromKey(key: string): NavigationDirection | null {
    const { keyBindings } = this.options;

    if (keyBindings.up?.includes(key)) return "up";
    if (keyBindings.down?.includes(key)) return "down";
    if (keyBindings.first?.includes(key)) return "first";
    if (keyBindings.last?.includes(key)) return "last";

    return null;
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  /**
   * Navigates in the specified direction.
   */
  navigate(direction: NavigationDirection): void {
    if (!this.state.enabled || this.state.totalSections === 0) return;

    const currentSelected = this.selectController.getSelected();
    const currentIndex = this.getCurrentIndex();
    let newIndex = this.calculateNewIndex(currentIndex, direction);

    if (newIndex === currentIndex && !this.options.wrapAround) {
      // At boundary and not wrapping
      return;
    }

    // Send navigation command to iframe
    this.sendNavigationCommand(newIndex, direction);
  }

  /**
   * Navigates to a specific section by index.
   */
  navigateToIndex(index: number): void {
    if (!this.state.enabled) return;

    if (index < 0 || index >= this.state.totalSections) {
      return;
    }

    this.sendNavigationCommand(index, "down");
  }

  /**
   * Navigates to a specific section by ID.
   */
  navigateToId(sectionId: string): void {
    const index = this.state.sectionIds.indexOf(sectionId);
    if (index !== -1) {
      this.navigateToIndex(index);
    }
  }

  private getCurrentIndex(): number {
    const selected = this.selectController.getSelected();
    if (!selected) return -1;

    const id = selected.snippetId || selected.elementId || selected.selector;
    return this.state.sectionIds.indexOf(id);
  }

  private calculateNewIndex(
    currentIndex: number,
    direction: NavigationDirection
  ): number {
    const total = this.state.totalSections;
    if (total === 0) return -1;

    switch (direction) {
      case "up":
        if (currentIndex <= 0) {
          return this.options.wrapAround ? total - 1 : 0;
        }
        return currentIndex - 1;

      case "down":
        if (currentIndex >= total - 1) {
          return this.options.wrapAround ? 0 : total - 1;
        }
        return currentIndex + 1;

      case "first":
        return 0;

      case "last":
        return total - 1;

      default:
        return currentIndex;
    }
  }

  private sendNavigationCommand(index: number, direction: NavigationDirection): void {
    if (!this.iframe?.contentWindow) return;

    this.iframe.contentWindow.postMessage(
      {
        type: "platxa:section-navigate",
        index,
        direction,
        sectionId: this.state.sectionIds[index],
      },
      "*"
    );
  }

  // ---------------------------------------------------------------------------
  // Message Handling
  // ---------------------------------------------------------------------------

  private handleMessage(event: MessageEvent): void {
    if (!event.data?.type?.startsWith("platxa:section")) return;

    switch (event.data.type) {
      case "platxa:section-list":
        this.updateSectionList(event.data.sections);
        break;

      case "platxa:section-navigated":
        this.handleNavigated(event.data);
        break;
    }
  }

  private updateSectionList(sections: string[]): void {
    this.state.sectionIds = sections;
    this.state.totalSections = sections.length;
    this.state.currentIndex = this.getCurrentIndex();
  }

  private handleNavigated(data: {
    direction: NavigationDirection;
    from: SelectedElement | null;
    to: SelectedElement | null;
    index: number;
  }): void {
    this.state.currentIndex = data.index;

    // Update select controller
    if (data.to) {
      this.selectController.select(data.to);
    }

    // Emit navigation event
    const event: NavigationEvent = {
      direction: data.direction,
      from: data.from,
      to: data.to,
      index: data.index,
      total: this.state.totalSections,
      timestamp: Date.now(),
    };

    this.notifyNavigation(event);
  }

  private requestSectionList(): void {
    if (!this.iframe?.contentWindow) return;

    this.iframe.contentWindow.postMessage(
      {
        type: "platxa:section-list-request",
        selector: this.options.sectionSelector,
        skipHidden: this.options.skipHidden,
      },
      "*"
    );
  }

  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------

  /**
   * Enables keyboard navigation.
   */
  enable(): void {
    this.state.enabled = true;
  }

  /**
   * Disables keyboard navigation.
   */
  disable(): void {
    this.state.enabled = false;
  }

  /**
   * Toggles enabled state.
   */
  toggle(): boolean {
    this.state.enabled = !this.state.enabled;
    return this.state.enabled;
  }

  /**
   * Checks if navigation is enabled.
   */
  isEnabled(): boolean {
    return this.state.enabled;
  }

  /**
   * Gets current navigator state.
   */
  getState(): NavigatorState {
    return { ...this.state };
  }

  /**
   * Refreshes the section list from the iframe.
   */
  refresh(): void {
    this.requestSectionList();
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  /**
   * Registers a navigation callback.
   */
  onNavigation(callback: NavigationCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private notifyNavigation(event: NavigationEvent): void {
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (e) {
        console.error("SectionKeyboardNavigator callback error:", e);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Disposes the navigator and cleans up resources.
   */
  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.disconnect();
    this.callbacks.clear();
  }
}

// =============================================================================
// Iframe Script
// =============================================================================

/**
 * Script to inject into the preview iframe for section keyboard navigation.
 * Handles section discovery, navigation commands, and sibling detection.
 */
export const SECTION_KEYBOARD_NAV_SCRIPT = `
<script>
(function() {
  var sectionNav = {
    selector: '[data-snippet-id], section, [data-snippet]',
    skipHidden: true,
    sections: [],
    currentIndex: -1
  };

  function isVisible(el) {
    if (!sectionNav.skipHidden) return true;
    var style = window.getComputedStyle(el);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0' &&
           el.offsetParent !== null;
  }

  function getSections() {
    var elements = document.querySelectorAll(sectionNav.selector);
    sectionNav.sections = Array.from(elements).filter(isVisible);
    return sectionNav.sections;
  }

  function getSectionId(el) {
    return el.getAttribute('data-snippet-id') ||
           el.getAttribute('data-element-id') ||
           el.getAttribute('id') ||
           generateSelector(el);
  }

  function generateSelector(el) {
    var parts = [];
    var current = el;
    while (current && current !== document.body) {
      var selector = current.tagName.toLowerCase();
      if (current.id) {
        return '#' + current.id + (parts.length ? ' > ' + parts.join(' > ') : '');
      }
      var parent = current.parentElement;
      if (parent) {
        var siblings = Array.from(parent.children).filter(function(c) {
          return c.tagName === current.tagName;
        });
        if (siblings.length > 1) {
          selector += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')';
        }
      }
      parts.unshift(selector);
      current = parent;
    }
    return parts.join(' > ');
  }

  function getElementInfo(el) {
    if (!el) return null;
    var rect = el.getBoundingClientRect();
    return {
      snippetId: el.getAttribute('data-snippet-id'),
      elementId: el.getAttribute('data-element-id'),
      tagName: el.tagName.toLowerCase(),
      classes: Array.from(el.classList),
      bounds: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      selector: getSectionId(el)
    };
  }

  function findSiblings(element) {
    if (!element || !element.parentElement) return [];

    var parent = element.parentElement;
    var siblings = Array.from(parent.children).filter(function(child) {
      return child.matches && child.matches(sectionNav.selector) && isVisible(child);
    });

    return siblings;
  }

  function navigateToIndex(index, direction) {
    var sections = getSections();
    if (index < 0 || index >= sections.length) return;

    var fromEl = sectionNav.currentIndex >= 0 ? sections[sectionNav.currentIndex] : null;
    var toEl = sections[index];

    // Clear previous selection
    if (fromEl) {
      fromEl.classList.remove('platxa-select-selected');
    }

    // Apply new selection
    toEl.classList.add('platxa-select-selected');
    toEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

    sectionNav.currentIndex = index;

    // Notify parent
    window.parent.postMessage({
      type: 'platxa:section-navigated',
      direction: direction,
      from: getElementInfo(fromEl),
      to: getElementInfo(toEl),
      index: index
    }, '*');
  }

  function sendSectionList() {
    var sections = getSections();
    var ids = sections.map(getSectionId);

    // Find current selected
    var selectedEl = document.querySelector('.platxa-select-selected');
    if (selectedEl) {
      sectionNav.currentIndex = sections.indexOf(selectedEl);
    }

    window.parent.postMessage({
      type: 'platxa:section-list',
      sections: ids,
      currentIndex: sectionNav.currentIndex
    }, '*');
  }

  // Listen for navigation commands
  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;

    switch (e.data.type) {
      case 'platxa:section-list-request':
        if (e.data.selector) sectionNav.selector = e.data.selector;
        if (e.data.skipHidden !== undefined) sectionNav.skipHidden = e.data.skipHidden;
        sendSectionList();
        break;

      case 'platxa:section-navigate':
        navigateToIndex(e.data.index, e.data.direction);
        break;
    }
  });

  // Handle arrow keys directly in iframe too (for when iframe has focus)
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    var sections = getSections();
    if (sections.length === 0) return;

    var selectedEl = document.querySelector('.platxa-select-selected');
    if (!selectedEl) return;

    // Find selected in siblings first, then fallback to all sections
    var siblings = findSiblings(selectedEl);
    var currentList = siblings.length > 1 ? siblings : sections;
    var currentIndex = currentList.indexOf(selectedEl);

    if (currentIndex === -1) return;

    var newIndex = currentIndex;
    var direction = null;

    if (e.key === 'ArrowUp') {
      direction = 'up';
      newIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
    } else if (e.key === 'ArrowDown') {
      direction = 'down';
      newIndex = currentIndex < currentList.length - 1 ? currentIndex + 1 : currentIndex;
    } else if (e.key === 'Home') {
      direction = 'first';
      newIndex = 0;
    } else if (e.key === 'End') {
      direction = 'last';
      newIndex = currentList.length - 1;
    }

    if (direction && newIndex !== currentIndex) {
      e.preventDefault();

      var fromEl = currentList[currentIndex];
      var toEl = currentList[newIndex];

      fromEl.classList.remove('platxa-select-selected');
      toEl.classList.add('platxa-select-selected');
      toEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

      sectionNav.currentIndex = sections.indexOf(toEl);

      window.parent.postMessage({
        type: 'platxa:section-navigated',
        direction: direction,
        from: getElementInfo(fromEl),
        to: getElementInfo(toEl),
        index: sectionNav.currentIndex
      }, '*');
    }
  });

  // Notify parent that section navigation is ready
  window.parent.postMessage({ type: 'platxa:section-nav-ready' }, '*');
})();
</script>`;

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a SectionKeyboardNavigator connected to a SelectModeController.
 *
 * @example
 * ```typescript
 * const selectController = createSelectMode();
 * const navigator = createSectionNavigator(selectController, {
 *   wrapAround: true,
 * });
 *
 * navigator.connect(iframe);
 * ```
 */
export function createSectionNavigator(
  selectController: SelectModeController,
  options?: SectionKeyboardNavigatorOptions
): SectionKeyboardNavigator {
  return new SectionKeyboardNavigator(selectController, options);
}

// =============================================================================
// Exports
// =============================================================================

export default SectionKeyboardNavigator;
